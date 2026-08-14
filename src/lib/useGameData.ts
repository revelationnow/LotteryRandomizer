import { useEffect, useMemo, useState } from 'react';
import {
  loadManifest,
  loadSnapshot,
  eligibleWhiteDraws,
  eligibleSpecialDraws,
  type Manifest,
  type Snapshot,
} from './data';
import { GAMES, type GameId } from './games';
import { whiteStats, specialStats, chiSquare, type PoolStats, type ChiSquareResult } from './stats';

export interface GameData {
  snapshot: Snapshot;
  manifest: Manifest;
  white: PoolStats;
  special: PoolStats;
  whiteChi: ChiSquareResult;
  specialChi: ChiSquareResult;
  /** Total draws in the file, before era filtering. */
  totalDraws: number;
  latestDraw: string | null;
}

const cache = new Map<GameId, Snapshot>();
let manifestCache: Manifest | null = null;

/**
 * Derived statistics, keyed by the snapshot they came from.
 *
 * Several components on a screen use the same game, and each useMemo would
 * otherwise tally every draw again. A WeakMap keyed on the snapshot object means
 * the work happens once and is released when the snapshot is.
 */
const derived = new WeakMap<Snapshot, GameData>();

function derive(gameId: GameId, snapshot: Snapshot, manifest: Manifest): GameData {
  const hit = derived.get(snapshot);
  if (hit) return hit;

  // Marks are near-free and make it possible to see, in a real profile on a real
  // device, whether a slow first paint is the network, the tally, or React.
  performance.mark('orrery:derive-start');
  const game = GAMES[gameId];
  const era = game.eras[0];
  const white = whiteStats(eligibleWhiteDraws(game, snapshot.draws), era.whiteMax);
  const special = specialStats(eligibleSpecialDraws(game, snapshot.draws), era.specialMax);

  const value: GameData = {
    snapshot,
    manifest,
    white,
    special,
    whiteChi: chiSquare(white),
    specialChi: chiSquare(special),
    totalDraws: snapshot.draws.length,
    latestDraw: manifest.games[gameId]?.latestDraw ?? null,
  };
  derived.set(snapshot, value);
  performance.mark('orrery:derive-end');
  performance.measure('orrery:derive', 'orrery:derive-start', 'orrery:derive-end');
  return value;
}

/**
 * Load a game's snapshot and derive its statistics.
 *
 * Only draws from the matrix currently in force feed the weights — see
 * eligibleWhiteDraws / eligibleSpecialDraws — so the counts shown next to each pool
 * are usually smaller than the total number of draws in the file.
 */
export function useGameData(gameId: GameId) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(cache.get(gameId) ?? null);
  const [manifest, setManifest] = useState<Manifest | null>(manifestCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = cache.get(gameId);
    if (cached) setSnapshot(cached);

    Promise.all([cached ? Promise.resolve(cached) : loadSnapshot(gameId), manifestCache ? Promise.resolve(manifestCache) : loadManifest()])
      .then(([snap, man]) => {
        if (cancelled) return;
        cache.set(gameId, snap);
        manifestCache = man;
        setSnapshot(snap);
        setManifest(man);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const data = useMemo<GameData | null>(
    () => (snapshot && manifest ? derive(gameId, snapshot, manifest) : null),
    [snapshot, manifest, gameId],
  );

  return { data, error, loading: !data && !error };
}
