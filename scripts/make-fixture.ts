/**
 * Generate a deterministic synthetic draw history.
 *
 * `data.ny.gov` is not reachable from every development environment, and the real
 * snapshot only lands when the refresh workflow runs. This produces a stand-in with
 * the exact same shape — correct eras, correct draw days, correct ball ranges — so
 * the app, the tests and the dev server all work offline.
 *
 * The output is explicitly tagged `source: 'fixture'` and the UI shows a warning
 * badge for it, so synthetic data can never be mistaken for real results.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAMES, GAME_IDS, eraForDate, type GameDef } from '../src/lib/games.ts';
import type { DrawTuple } from '../src/lib/data.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../public/data');

/** mulberry32 — deterministic so the fixture is byte-stable across runs. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateInt(d: Date): number {
  return Number(iso(d).replace(/-/g, ''));
}

/**
 * Powerball moved from two draws a week to three (adding Monday) in August 2021.
 * Mega Millions has always been Tuesday and Friday.
 */
function drawDaysFor(gameId: string, date: Date): number[] {
  if (gameId === 'megamillions') return [2, 5];
  return iso(date) >= '2021-08-23' ? [1, 3, 6] : [3, 6];
}

function pickDistinct(rng: () => number, max: number, count: number): number[] {
  const chosen = new Set<number>();
  while (chosen.size < count) chosen.add(1 + Math.floor(rng() * max));
  return [...chosen].sort((a, b) => a - b);
}

function buildGame(game: GameDef, seed: number): DrawTuple[] {
  const rng = makeRng(seed);
  const draws: DrawTuple[] = [];

  // Powerball's dataset starts in 2010; Mega Millions' in 2002.
  const start = new Date(game.id === 'powerball' ? '2010-02-03T00:00:00Z' : '2002-05-17T00:00:00Z');
  const end = new Date();

  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (!drawDaysFor(game.id, d).includes(d.getUTCDay())) continue;
    const era = eraForDate(game, iso(d));
    if (!era) continue;
    const white = pickDistinct(rng, era.whiteMax, game.whiteCount);
    const special = 1 + Math.floor(rng() * era.specialMax);
    draws.push([dateInt(d), white[0], white[1], white[2], white[3], white[4], special]);
  }
  return draws;
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();
  const manifestGames: Record<string, { draws: number; latestDraw: string }> = {};

  GAME_IDS.forEach((id, i) => {
    const game = GAMES[id];
    const draws = buildGame(game, 0x5eed + i * 7919);
    writeFileSync(
      resolve(OUT_DIR, `${id}.json`),
      JSON.stringify({ game: id, generatedAt, source: 'fixture', draws }),
    );
    const latest = draws[draws.length - 1][0];
    manifestGames[id] = {
      draws: draws.length,
      latestDraw: String(latest).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
    };
    console.log(`${game.name}: ${draws.length} synthetic draws`);
  });

  writeFileSync(
    resolve(OUT_DIR, 'manifest.json'),
    JSON.stringify({ generatedAt, source: 'fixture', games: manifestGames }, null, 2),
  );
  console.log(`\nWrote synthetic fixture to ${OUT_DIR}`);
  console.log('Run `npm run ingest` with network access to replace it with real results.');
}

main();
