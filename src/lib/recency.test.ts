import { describe, it, expect } from 'vitest';
import { whiteStats, specialStats, chiSquare } from './stats';
import {
  sliderToHalfLife,
  effectiveWindow,
  computeWeights,
  sliderToBeta,
  RECENCY_MIN_HALF_LIFE,
} from './weights';
import { generateTicket } from './constraints';
import { seededRng } from './rng';
import { GAMES } from './games';
import type { DrawTuple } from './data';

/**
 * A history split into two halves of equal length where ball 1 is hot only in the
 * older half and ball 2 is hot only in the newer half. Their totals are identical,
 * so only recency can tell them apart.
 */
function twoEraHistory(halfLength = 300): DrawTuple[] {
  const draws: DrawTuple[] = [];
  for (let i = 0; i < halfLength; i++) {
    // Older half: ball 1 appears every draw, ball 2 never does.
    draws.push([20200101 + i, 1, 30, 31, 32, 33, 1]);
  }
  for (let i = 0; i < halfLength; i++) {
    // Newer half: ball 2 appears every draw, ball 1 never does.
    draws.push([20250101 + i, 2, 30, 31, 32, 33, 2]);
  }
  return draws;
}

describe('recency decay', () => {
  it('is a no-op at half-life null', () => {
    const draws = twoEraHistory();
    const plain = whiteStats(draws, 69);
    const explicit = whiteStats(draws, 69, { halfLife: null });
    expect(explicit.counts).toEqual(plain.counts);
    expect(explicit.weighted).toBe(false);
    expect(explicit.effectiveDraws).toBeCloseTo(explicit.draws, 6);
  });

  it('leaves equal totals indistinguishable without decay', () => {
    const s = whiteStats(twoEraHistory(), 69);
    expect(s.counts[1]).toBe(s.counts[2]);
  });

  it('favours the recently hot number by exactly the decay factor', () => {
    const s = whiteStats(twoEraHistory(), 69, { halfLife: 50 });
    expect(s.weighted).toBe(true);
    // Ball 1's appearances are all exactly 300 draws older than ball 2's, so its
    // weight is down by 2^(300/50) = 64 — not approximately, exactly.
    expect(s.counts[2] / s.counts[1]).toBeCloseTo(64, 4);
  });

  it('shrinks the effective sample as the half-life shortens', () => {
    const draws = twoEraHistory();
    const long = whiteStats(draws, 69, { halfLife: 2000 });
    const short = whiteStats(draws, 69, { halfLife: 30 });
    expect(short.effectiveDraws).toBeLessThan(long.effectiveDraws);
    expect(short.effectiveDraws).toBeLessThan(draws.length);
    // Both still report the true number of draws they scanned.
    expect(short.draws).toBe(draws.length);
  });

  it('keeps expected counts consistent with the weighted total', () => {
    // Sum of counts must equal perDraw * total weight, decayed or not.
    for (const halfLife of [null, 500, 40]) {
      const s = whiteStats(twoEraHistory(), 69, { halfLife });
      const total = s.counts.reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(s.expected * s.size, 6);
    }
  });

  it('applies to the special ball too', () => {
    const s = specialStats(twoEraHistory(), 26, { halfLife: 50 });
    expect(s.counts[2] / s.counts[1]).toBeCloseTo(64, 4);
  });

  it('leaves drought measured in real draws, not weighted ones', () => {
    const s = whiteStats(twoEraHistory(), 69, { halfLife: 20 });
    // Ball 1 last appeared at the end of the older half.
    expect(s.drought[1]).toBe(300);
    expect(s.drought[2]).toBe(0);
  });
});

describe('chiSquare guard', () => {
  it('refuses weighted counts, which would make the p-value meaningless', () => {
    const weighted = whiteStats(twoEraHistory(), 69, { halfLife: 50 });
    expect(() => chiSquare(weighted)).toThrow(/unweighted/);
  });

  it('still accepts an undecayed tally', () => {
    expect(() => chiSquare(whiteStats(twoEraHistory(), 69))).not.toThrow();
  });
});

describe('sliderToHalfLife', () => {
  it('treats zero as no decay at all', () => {
    expect(sliderToHalfLife(0)).toBeNull();
  });

  it('bottoms out at the minimum half-life', () => {
    expect(sliderToHalfLife(100)).toBeCloseTo(RECENCY_MIN_HALF_LIFE, 6);
  });

  it('decreases monotonically as the slider rises', () => {
    let previous = Infinity;
    for (let s = 5; s <= 100; s += 5) {
      const h = sliderToHalfLife(s)!;
      expect(h).toBeLessThan(previous);
      previous = h;
    }
  });

  it('clamps out-of-range input', () => {
    expect(sliderToHalfLife(-50)).toBeNull();
    expect(sliderToHalfLife(500)).toBeCloseTo(RECENCY_MIN_HALF_LIFE, 6);
  });
});

describe('effectiveWindow', () => {
  it('is null when there is no decay', () => {
    expect(effectiveWindow(null)).toBeNull();
  });

  it('matches the Kish effective size measured from a long decayed history', () => {
    // Build a history long enough that the analytic infinite-horizon formula holds.
    const halfLife = 40;
    const draws: DrawTuple[] = [];
    for (let i = 0; i < 4000; i++) draws.push([20000101 + i, 1, 2, 3, 4, 5, 1]);
    const measured = whiteStats(draws, 69, { halfLife }).effectiveDraws;
    expect(effectiveWindow(halfLife)!).toBeCloseTo(measured, 3);
  });

  it('grows with the half-life', () => {
    expect(effectiveWindow(200)!).toBeGreaterThan(effectiveWindow(20)!);
  });
});

describe('recency in the generator', () => {
  const draws = twoEraHistory();

  function pickRate(recency: number, bias: number, ball: number, trials = 600): number {
    const halfLife = sliderToHalfLife(recency);
    const input = {
      game: GAMES.powerball,
      whiteStats: whiteStats(draws, 69, { halfLife }),
      specialStats: specialStats(draws, 26, { halfLife }),
      options: { beta: sliderToBeta(bias) },
    };
    // One rng threaded through every trial. Passing `seed` on the input instead
    // would rebuild the generator from the same seed on each call and hand back
    // the identical ticket 600 times over.
    const rng = seededRng(`r${recency}b${bias}`);
    let hits = 0;
    for (let i = 0; i < trials; i++) {
      if (generateTicket(input, rng).white.includes(ball)) hits++;
    }
    return hits / trials;
  }

  it('picks the recently hot number far more often than the historically hot one', () => {
    const recent = pickRate(100, 80, 2);
    const stale = pickRate(100, 80, 1);
    expect(recent).toBeGreaterThan(stale * 2);
  });

  it('treats the two identically when recency is off', () => {
    // Asserted on the weights rather than by sampling: the two balls have equal
    // totals, so their weights must be exactly equal, and a Monte Carlo estimate
    // of an exact identity would only add a flaky threshold.
    const w = computeWeights(whiteStats(draws, 69), { beta: sliderToBeta(80) });
    expect(w[1]).toBeCloseTo(w[2], 12);
  });

  it('shifts the sampled rate towards the recent number when recency is on', () => {
    // Tolerance is set well outside sampling noise: at n = 3000 the standard error
    // of a difference in proportions is about 0.013, so 0.15 is more than 10 sigma.
    const recentWithDecay = pickRate(100, 80, 2, 3000);
    const recentWithout = pickRate(0, 80, 2, 3000);
    expect(recentWithDecay - recentWithout).toBeGreaterThan(0.15);
  });

  it('does nothing at all while bias is fair', () => {
    // Every weight is 1 at beta 0 no matter how the counts were tallied.
    const halfLife = sliderToHalfLife(100);
    const decayed = computeWeights(whiteStats(draws, 69, { halfLife }), { beta: 0 });
    const plain = computeWeights(whiteStats(draws, 69), { beta: 0 });
    expect(decayed).toEqual(plain);
  });
});
