/**
 * Pull the official draw history from NY Open Data and write the committed snapshot.
 *
 * Runs in CI (see .github/workflows/refresh-data.yml) and can be run by hand with
 * `npm run ingest` from any machine that can reach data.ny.gov.
 *
 * The important part is step 4: every ball is validated against the matrix that was
 * in force on its draw date, and the run fails loudly on any violation. That makes
 * the era table in src/lib/games.ts self-checking — if a boundary date is wrong, the
 * ingest breaks instead of quietly poisoning the weights.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAMES, GAME_IDS, eraForDate, type GameDef } from '../src/lib/games.ts';
import type { DrawTuple } from '../src/lib/data.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../public/data');
const PAGE_SIZE = 5000;

interface SocrataRow {
  draw_date?: string;
  winning_numbers?: string;
  mega_ball?: string;
  multiplier?: string;
}

async function fetchAll(game: GameDef): Promise<SocrataRow[]> {
  const rows: SocrataRow[] = [];
  const headers: Record<string, string> = { Accept: 'application/json' };
  // Optional, but raises the anonymous rate limit considerably.
  if (process.env.SOCRATA_APP_TOKEN) headers['X-App-Token'] = process.env.SOCRATA_APP_TOKEN;

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url =
      `https://data.ny.gov/resource/${game.datasetId}.json` +
      `?$limit=${PAGE_SIZE}&$offset=${offset}&$order=draw_date ASC`;
    const res = await fetchWithRetry(url, headers);
    const page = (await res.json()) as SocrataRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchWithRetry(url: string, headers: Record<string, string>): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return res;
      // 4xx other than throttling will not fix themselves.
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`${res.status} ${res.statusText} for ${url}`);
      }
      lastError = new Error(`${res.status} ${res.statusText}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Gave up fetching ${url}: ${String(lastError)}`);
}

interface ParseResult {
  draws: DrawTuple[];
  skipped: string[];
}

/**
 * Parse Socrata rows into draw tuples.
 *
 * The two datasets are not shaped identically, and Mega Millions is not even
 * self-consistent across its own history: newer rows carry the Mega Ball in its own
 * `mega_ball` column with five numbers in `winning_numbers`, while older rows pack
 * all six into `winning_numbers`. Handle both rather than trusting either.
 */
function parseRows(game: GameDef, rows: SocrataRow[]): ParseResult {
  const draws: DrawTuple[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    const date = row.draw_date?.slice(0, 10);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      skipped.push(`bad draw_date: ${JSON.stringify(row.draw_date)}`);
      continue;
    }

    const tokens = (row.winning_numbers ?? '').trim().split(/\s+/).filter(Boolean).map(Number);
    if (tokens.some((n) => !Number.isInteger(n))) {
      skipped.push(`${date}: non-numeric winning_numbers ${JSON.stringify(row.winning_numbers)}`);
      continue;
    }

    let white: number[];
    let special: number;

    if (tokens.length === game.whiteCount + 1) {
      // Six tokens: the last one is the special ball.
      white = tokens.slice(0, game.whiteCount);
      special = tokens[game.whiteCount];
    } else if (tokens.length === game.whiteCount && row.mega_ball != null) {
      white = tokens;
      special = Number(row.mega_ball);
    } else {
      skipped.push(`${date}: unexpected shape (${tokens.length} numbers, mega_ball=${row.mega_ball})`);
      continue;
    }

    if (!Number.isInteger(special)) {
      skipped.push(`${date}: non-numeric special ball`);
      continue;
    }
    if (new Set(white).size !== white.length) {
      skipped.push(`${date}: duplicate white balls ${white.join(' ')}`);
      continue;
    }

    white.sort((a, b) => a - b);
    draws.push([
      Number(date.replace(/-/g, '')),
      white[0],
      white[1],
      white[2],
      white[3],
      white[4],
      special,
    ]);
  }

  draws.sort((a, b) => a[0] - b[0]);
  return { draws, skipped };
}

/**
 * Check every ball against the matrix in force on its draw date.
 * Returns the list of problems; an empty list means the era table agrees with reality.
 */
function validateEras(game: GameDef, draws: DrawTuple[]): string[] {
  const problems: string[] = [];
  for (const d of draws) {
    const iso = String(d[0]).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    const era = eraForDate(game, iso);
    if (!era) {
      problems.push(`${iso}: no era covers this date`);
      continue;
    }
    const white = d.slice(1, 6);
    for (const b of white) {
      if (b < 1 || b > era.whiteMax) {
        problems.push(`${iso}: white ball ${b} outside 1-${era.whiteMax} for its era`);
      }
    }
    if (d[6] < 1 || d[6] > era.specialMax) {
      problems.push(`${iso}: ${game.specialName} ${d[6]} outside 1-${era.specialMax} for its era`);
    }
  }
  return problems;
}

function isoOf(dateInt: number): string {
  return String(dateInt).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();
  const manifestGames: Record<string, { draws: number; latestDraw: string }> = {};
  let failed = false;

  for (const id of GAME_IDS) {
    const game = GAMES[id];
    process.stdout.write(`Fetching ${game.name} (${game.datasetId})... `);
    const rows = await fetchAll(game);
    console.log(`${rows.length} rows`);

    const { draws, skipped } = parseRows(game, rows);
    if (skipped.length) {
      console.warn(`  skipped ${skipped.length} malformed row(s):`);
      for (const s of skipped.slice(0, 10)) console.warn(`    - ${s}`);
      if (skipped.length > 10) console.warn(`    ... and ${skipped.length - 10} more`);
    }

    const problems = validateEras(game, draws);
    if (problems.length) {
      failed = true;
      console.error(`\n  ERA VALIDATION FAILED for ${game.name} — ${problems.length} problem(s).`);
      console.error('  The era table in src/lib/games.ts disagrees with the official results.');
      for (const p of problems.slice(0, 20)) console.error(`    - ${p}`);
      if (problems.length > 20) console.error(`    ... and ${problems.length - 20} more`);
      continue;
    }

    if (draws.length === 0) {
      failed = true;
      console.error(`  ${game.name}: no usable draws parsed — refusing to write an empty snapshot.`);
      continue;
    }

    writeFileSync(
      resolve(OUT_DIR, `${id}.json`),
      JSON.stringify({ game: id, generatedAt, source: 'socrata', draws }),
    );

    const latest = isoOf(draws[draws.length - 1][0]);
    manifestGames[id] = { draws: draws.length, latestDraw: latest };
    const eligible = draws.filter((d) => isoOf(d[0]) >= game.whiteWeightingFrom).length;
    console.log(
      `  ${draws.length} draws (${eligible} in the current matrix), latest ${latest}\n`,
    );
  }

  if (failed) {
    console.error('Ingest failed — existing snapshots left untouched.');
    process.exit(1);
  }

  writeFileSync(
    resolve(OUT_DIR, 'manifest.json'),
    JSON.stringify({ generatedAt, source: 'socrata', games: manifestGames }, null, 2),
  );
  console.log(`Wrote real draw history to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
