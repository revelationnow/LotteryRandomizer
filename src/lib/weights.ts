/**
 * The weighting model.
 *
 * One continuous control spans cold -> uniform -> hot rather than three separate
 * algorithms:
 *
 *   E   = perDraw * N / K            expected count under a fair machine
 *   r_b = (c_b + a) / (E + a)        smoothed deviation ratio, a = E
 *   w_b = r_b ^ beta                 beta is the bias exponent
 *
 * The Dirichlet-style prior (a = E) is centred on uniform and worth one full
 * pseudo-history, so a ball that has never been drawn still gets a sane weight
 * instead of zero. Because real lottery data genuinely is uniform, r_b sits around
 * 1 +/- 0.1; the exponent is what makes the tilt visible. That is honest — and the
 * Observatory says out loud that a high bias is amplifying noise.
 */

import type { PoolStats } from './stats';

/** The slider runs -100..100 in the UI and maps onto this exponent range. */
export const MAX_BIAS_EXPONENT = 8;

export function sliderToBeta(slider: number): number {
  return (clamp(slider, -100, 100) / 100) * MAX_BIAS_EXPONENT;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export interface WeightOptions {
  /** Bias exponent. 0 is exactly uniform, positive favours hot, negative cold. */
  beta: number;
  /** Balls the user never wants drawn. */
  exclude?: Iterable<number>;
}

/**
 * Weights indexed 1..size (index 0 is unused and always 0).
 *
 * At beta === 0 every eligible weight is exactly 1, so the generator collapses to a
 * plain fair draw. That exactness is relied on by the tests.
 */
export function computeWeights(stats: PoolStats, opts: WeightOptions): number[] {
  const { size, counts, expected } = stats;
  const excluded = new Set(opts.exclude ?? []);
  const weights = new Array<number>(size + 1).fill(0);

  const alpha = expected;
  const hasHistory = expected > 0;

  for (let b = 1; b <= size; b++) {
    if (excluded.has(b)) continue;
    if (!hasHistory || opts.beta === 0) {
      weights[b] = 1;
      continue;
    }
    const ratio = (counts[b] + alpha) / (expected + alpha);
    weights[b] = Math.pow(ratio, opts.beta);
  }
  return weights;
}

/** Weights as probabilities for a single pick, for display in the UI. */
export function normalize(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return weights.map(() => 0);
  return weights.map((w) => w / total);
}
