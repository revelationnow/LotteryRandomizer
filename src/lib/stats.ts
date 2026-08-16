/**
 * Frequency statistics and the uniformity test.
 *
 * The chi-square panel is the point of the app as much as the generator is: it
 * shows, from the live data, that the "hot" numbers are ordinary sampling noise.
 */

import type { DrawTuple } from './data';

export interface PoolStats {
  /** Pool size; balls are 1..size and counts are indexed 1..size (index 0 unused). */
  size: number;
  /** Number of draws these counts came from. */
  draws: number;
  /** How many balls are drawn per draw (5 white, 1 special). */
  perDraw: number;
  /**
   * counts[b] = appearances of ball b.
   *
   * Whole numbers normally. With recency decay these are weighted sums and so are
   * fractional — which is why `weighted` stats must never be fed to chiSquare.
   */
  counts: number[];
  /** Expected count per ball under a fair machine. */
  expected: number;
  /** drought[b] = draws since ball b last appeared; equals `draws` if never seen. */
  drought: number[];
  /** Date of the most recent draw counted, or null when there are none. */
  latestDraw: number | null;
  /** True when recency decay was applied, making the counts fractional. */
  weighted: boolean;
  /**
   * Kish effective sample size: how many equally-weighted draws carry the same
   * information as this decayed history. Equals `draws` when undecayed. This is
   * the number that tells the user how thin the evidence has become.
   */
  effectiveDraws: number;
}

export interface TallyOptions {
  /**
   * Recency half-life, in draws. A draw n draws old contributes 0.5^(n/halfLife).
   * null or Infinity means no decay — every draw counts equally.
   */
  halfLife?: number | null;
}

/**
 * Tally a pool. `pick` pulls the relevant balls out of a draw tuple, so the same
 * routine serves both the white pool and the special ball.
 *
 * Recency is modelled as exponential decay rather than a hard "last N draws"
 * cutoff: a cutoff throws away everything one draw past the boundary and treats
 * the draw just inside it as fully current, which makes the weights jump around
 * as new draws arrive. Decay ages evidence out smoothly instead.
 */
export function tally(
  draws: DrawTuple[],
  size: number,
  pick: (d: DrawTuple) => number[],
  options: TallyOptions = {},
): PoolStats {
  const counts = new Array<number>(size + 1).fill(0);
  const lastSeen = new Array<number>(size + 1).fill(-1);

  // "Draws since" is measured from the end, so order matters. The ingest already
  // writes draws ascending, so check before paying for a copy and a sort.
  const ordered = isAscending(draws) ? draws : [...draws].sort((a, b) => a[0] - b[0]);

  const n = ordered.length;
  const halfLife = options.halfLife;
  const decaying = halfLife != null && Number.isFinite(halfLife) && halfLife > 0;

  let totalWeight = 0;
  let sumSquaredWeight = 0;

  for (let i = 0; i < n; i++) {
    // Age in draws: 0 is the most recent.
    const weight = decaying ? Math.pow(0.5, (n - 1 - i) / halfLife) : 1;
    totalWeight += weight;
    sumSquaredWeight += weight * weight;

    for (const ball of pick(ordered[i])) {
      if (ball >= 1 && ball <= size) {
        counts[ball] += weight;
        lastSeen[ball] = i;
      }
    }
  }

  const perDraw = n > 0 ? pick(ordered[0]).length : 0;
  const drought = new Array<number>(size + 1).fill(n);
  for (let b = 1; b <= size; b++) {
    if (lastSeen[b] >= 0) drought[b] = n - 1 - lastSeen[b];
  }

  return {
    size,
    draws: n,
    perDraw,
    counts,
    expected: n > 0 ? (perDraw * totalWeight) / size : 0,
    drought,
    latestDraw: n > 0 ? ordered[n - 1][0] : null,
    weighted: decaying,
    effectiveDraws:
      sumSquaredWeight > 0 ? (totalWeight * totalWeight) / sumSquaredWeight : 0,
  };
}

function isAscending(draws: DrawTuple[]): boolean {
  for (let i = 1; i < draws.length; i++) {
    if (draws[i][0] < draws[i - 1][0]) return false;
  }
  return true;
}

export function whiteStats(draws: DrawTuple[], size: number, options?: TallyOptions): PoolStats {
  return tally(draws, size, (d) => d.slice(1, 6), options);
}

export function specialStats(draws: DrawTuple[], size: number, options?: TallyOptions): PoolStats {
  return tally(draws, size, (d) => [d[6]], options);
}

export interface ChiSquareResult {
  chi2: number;
  df: number;
  pValue: number;
  /** True when the data is consistent with a fair, uniform machine (p >= 0.05). */
  uniform: boolean;
}

export function chiSquare(stats: PoolStats): ChiSquareResult {
  const { counts, size, expected } = stats;
  if (stats.weighted) {
    // Pearson's chi-square assumes actual counts; on decayed fractional weights the
    // statistic no longer follows a chi-square distribution and the p-value would be
    // meaningless. The fairness verdict must always be computed on raw history.
    throw new Error('chiSquare requires unweighted counts — pass stats tallied without decay.');
  }
  if (expected <= 0) return { chi2: 0, df: Math.max(size - 1, 0), pValue: 1, uniform: true };

  let chi2 = 0;
  for (let b = 1; b <= size; b++) {
    const diff = counts[b] - expected;
    chi2 += (diff * diff) / expected;
  }
  const df = size - 1;
  const pValue = chiSquarePValue(chi2, df);
  return { chi2, df, pValue, uniform: pValue >= 0.05 };
}

/** Upper tail of the chi-square distribution: P(X > chi2). */
export function chiSquarePValue(chi2: number, df: number): number {
  if (df <= 0) return 1;
  if (chi2 <= 0) return 1;
  return upperGamma(df / 2, chi2 / 2);
}

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

export function lnGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  const z = x - 1;
  let a = LANCZOS[0];
  const t = z + 7.5;
  for (let i = 1; i < LANCZOS.length; i++) a += LANCZOS[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

const EPS = 1e-14;
const TINY = 1e-300;

/** Regularized lower incomplete gamma P(a, x) by series expansion. */
function lowerGammaSeries(a: number, x: number): number {
  let ap = a;
  let sum = 1 / a;
  let del = sum;
  for (let n = 0; n < 1000; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
}

/** Regularized upper incomplete gamma Q(a, x) by continued fraction. */
function upperGammaCF(a: number, x: number): number {
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/** Regularized upper incomplete gamma Q(a, x) = 1 - P(a, x). */
export function upperGamma(a: number, x: number): number {
  if (x < 0 || a <= 0) return Number.NaN;
  if (x === 0) return 1;
  return x < a + 1 ? 1 - lowerGammaSeries(a, x) : upperGammaCF(a, x);
}

export interface RankedBall {
  ball: number;
  count: number;
  /** count / expected — 1.0 is exactly average. */
  ratio: number;
  drought: number;
}

export function rankBalls(stats: PoolStats): RankedBall[] {
  const out: RankedBall[] = [];
  for (let b = 1; b <= stats.size; b++) {
    out.push({
      ball: b,
      count: stats.counts[b],
      ratio: stats.expected > 0 ? stats.counts[b] / stats.expected : 1,
      drought: stats.drought[b],
    });
  }
  return out;
}
