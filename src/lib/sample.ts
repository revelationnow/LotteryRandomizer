/**
 * Weighted sampling without replacement.
 *
 * Efraimidis-Spirakis: give every ball the key -ln(u) / w and take the k smallest.
 * This is exact for successive weighted draws without replacement, runs in
 * O(K log K), and handles exclusions (weight 0) and pins (sample the remainder from
 * a reduced pool) with no special cases.
 */

import type { Rng } from './rng';

/**
 * Pick `k` distinct balls from a weight array indexed 1..size.
 * Balls with weight <= 0 are never selected.
 */
export function weightedSampleWithoutReplacement(
  weights: number[],
  k: number,
  rng: Rng,
): number[] {
  const keyed: { ball: number; key: number }[] = [];
  for (let b = 1; b < weights.length; b++) {
    const w = weights[b];
    if (!(w > 0)) continue;
    let u = rng();
    // -ln(0) is infinite; nudge off the boundary.
    if (u <= 0) u = Number.MIN_VALUE;
    keyed.push({ ball: b, key: -Math.log(u) / w });
  }

  if (keyed.length < k) {
    throw new Error(
      `Only ${keyed.length} numbers are available but ${k} are needed — remove some exclusions.`,
    );
  }

  keyed.sort((a, b) => a.key - b.key);
  return keyed.slice(0, k).map((e) => e.ball);
}

/** Pick a single ball by weight. */
export function weightedPickOne(weights: number[], rng: Rng): number {
  return weightedSampleWithoutReplacement(weights, 1, rng)[0];
}
