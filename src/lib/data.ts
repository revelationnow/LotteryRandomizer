/**
 * Snapshot format and era-aware filtering.
 *
 * Draws are stored as flat number tuples rather than objects to keep the committed
 * snapshot small: [yyyymmdd, w1, w2, w3, w4, w5, special].
 */

import { GAMES, type GameDef, type GameId } from './games';

export type DrawTuple = [number, number, number, number, number, number, number];

export interface Snapshot {
  game: GameId;
  generatedAt: string;
  /** 'socrata' for real data, 'fixture' for the synthetic development set. */
  source: 'socrata' | 'fixture';
  draws: DrawTuple[];
}

export interface Manifest {
  generatedAt: string;
  source: 'socrata' | 'fixture';
  games: Record<GameId, { draws: number; latestDraw: string }>;
}

export interface Draw {
  /** ISO date, e.g. '2026-08-12'. */
  date: string;
  white: number[];
  special: number;
}

export function dateIntToIso(n: number): string {
  const s = String(n).padStart(8, '0');
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

export function isoToDateInt(iso: string): number {
  return Number(iso.replace(/-/g, ''));
}

export function tupleToDraw(t: DrawTuple): Draw {
  return { date: dateIntToIso(t[0]), white: t.slice(1, 6), special: t[6] };
}

/** Draws eligible to weight the white-ball pool: same white matrix as today. */
export function eligibleWhiteDraws(game: GameDef, draws: DrawTuple[]): DrawTuple[] {
  const from = isoToDateInt(game.whiteWeightingFrom);
  const max = game.eras[0].whiteMax;
  return draws.filter(
    (d) => d[0] >= from && d.slice(1, 6).every((b) => b >= 1 && b <= max),
  );
}

/**
 * Draws eligible to weight the special-ball pool. Draws whose special ball is above
 * the current pool are dropped individually rather than excluding the whole era —
 * this is what lets Mega Millions reuse its 2017+ history after Mega Ball 25 was
 * retired in April 2025.
 */
export function eligibleSpecialDraws(game: GameDef, draws: DrawTuple[]): DrawTuple[] {
  const from = isoToDateInt(game.specialWeightingFrom);
  const max = game.eras[0].specialMax;
  return draws.filter((d) => d[0] >= from && d[6] >= 1 && d[6] <= max);
}

const BASE = import.meta.env?.BASE_URL ?? '/';

/**
 * The standalone single-file build inlines the draw history on the page instead of
 * shipping it as a separate asset, so the app works with no network requests at
 * all. Normal builds fall through to fetching from public/data.
 */
interface EmbeddedData {
  snapshots: Partial<Record<GameId, Snapshot>>;
  manifest: Manifest;
}

function embedded(): EmbeddedData | undefined {
  return (globalThis as { __ORRERY_DATA__?: EmbeddedData }).__ORRERY_DATA__;
}

/**
 * Requests started by the inline snippet in index.html, before this bundle even
 * parsed. Each resolves to null if it failed, so we fall back to a normal fetch.
 */
type Prefetch = Partial<Record<GameId | 'manifest', Promise<unknown | null>>>;

function prefetched(key: GameId | 'manifest'): Promise<unknown | null> | undefined {
  return (globalThis as { __ORRERY_PREFETCH__?: Prefetch }).__ORRERY_PREFETCH__?.[key];
}

/**
 * In-flight requests, keyed by file. Several components ask for the same game on
 * first render; caching the promise rather than only the result means they share
 * one request instead of racing to issue duplicates.
 */
const inFlight = new Map<string, Promise<unknown>>();

function once<T>(key: string, start: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const p = start().catch((err: unknown) => {
    // A failure should not be cached, or a transient blip is permanent.
    inFlight.delete(key);
    throw err;
  });
  inFlight.set(key, p);
  return p;
}

export function loadSnapshot(game: GameId): Promise<Snapshot> {
  const inline = embedded()?.snapshots[game];
  if (inline) return Promise.resolve(inline);

  return once(game, async () => {
    const early = (await prefetched(game)) as Snapshot | null | undefined;
    if (early) return early;

    const res = await fetch(`${BASE}data/${game}.json`);
    if (!res.ok) throw new Error(`Could not load ${game} draw history (${res.status})`);
    return (await res.json()) as Snapshot;
  });
}

export function loadManifest(): Promise<Manifest> {
  const inline = embedded()?.manifest;
  if (inline) return Promise.resolve(inline);

  return once('manifest', async () => {
    const early = (await prefetched('manifest')) as Manifest | null | undefined;
    if (early) return early;

    const res = await fetch(`${BASE}data/manifest.json`);
    if (!res.ok) throw new Error(`Could not load data manifest (${res.status})`);
    return (await res.json()) as Manifest;
  });
}

export function gameOf(id: GameId): GameDef {
  return GAMES[id];
}
