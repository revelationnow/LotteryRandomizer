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

  const data = useMemo<GameData | null>(() => {
    if (!snapshot || !manifest) return null;
    const game = GAMES[gameId];
    const era = game.eras[0];

    const whiteDraws = eligibleWhiteDraws(game, snapshot.draws);
    const specialDraws = eligibleSpecialDraws(game, snapshot.draws);
    const white = whiteStats(whiteDraws, era.whiteMax);
    const special = specialStats(specialDraws, era.specialMax);

    return {
      snapshot,
      manifest,
      white,
      special,
      whiteChi: chiSquare(white),
      specialChi: chiSquare(special),
      totalDraws: snapshot.draws.length,
      latestDraw: manifest.games[gameId]?.latestDraw ?? null,
    };
  }, [snapshot, manifest, gameId]);

  return { data, error, loading: !data && !error };
}
