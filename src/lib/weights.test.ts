import { describe, it, expect } from 'vitest';
import { computeWeights, normalize, sliderToBeta, MAX_BIAS_EXPONENT } from './weights';
import { whiteStats } from './stats';
import type { DrawTuple } from './data';

/** A history where low balls are drawn more often than high ones. */
function skewedStats(size = 10) {
  const draws: DrawTuple[] = [];
  for (let i = 0; i < 100; i++) {
    // Balls 1-5 appear in every draw; 6-10 never do.
    draws.push([20260000 + i, 1, 2, 3, 4, 5, 1]);
  }
  for (let i = 0; i < 100; i++) {
    draws.push([20270000 + i, 6, 7, 8, 9, 10, 1]);
  }
  // Give ball 1 a genuine edge on top of the even split.
  for (let i = 0; i < 40; i++) draws.push([20280000 + i, 1, 2, 6, 7, 8, 1]);
  return whiteStats(draws, size);
}

describe('computeWeights', () => {
  it('is exactly uniform at beta = 0', () => {
    const stats = skewedStats();
    const w = computeWeights(stats, { beta: 0 });
    for (let b = 1; b <= stats.size; b++) expect(w[b]).toBe(1);
  });

  it('favours hot balls when beta > 0', () => {
    const stats = skewedStats();
    const w = computeWeights(stats, { beta: 4 });
    // Ball 1 is the hottest; ball 10 is among the coldest.
    expect(stats.counts[1]).toBeGreaterThan(stats.counts[10]);
    expect(w[1]).toBeGreaterThan(w[10]);
  });

  it('favours cold balls when beta < 0', () => {
    const stats = skewedStats();
    const w = computeWeights(stats, { beta: -4 });
    expect(w[1]).toBeLessThan(w[10]);
  });

  it('is monotone in the observed count', () => {
    const stats = skewedStats();
    const w = computeWeights(stats, { beta: 3 });
    for (let a = 1; a <= stats.size; a++) {
      for (let b = 1; b <= stats.size; b++) {
        if (stats.counts[a] > stats.counts[b]) expect(w[a]).toBeGreaterThan(w[b]);
        if (stats.counts[a] === stats.counts[b]) expect(w[a]).toBeCloseTo(w[b], 12);
      }
    }
  });

  it('gives an unseen ball a non-zero weight thanks to smoothing', () => {
    const draws: DrawTuple[] = [];
    for (let i = 0; i < 50; i++) draws.push([20260000 + i, 1, 2, 3, 4, 5, 1]);
    const stats = whiteStats(draws, 20);
    const w = computeWeights(stats, { beta: 8 });
    expect(stats.counts[20]).toBe(0);
    expect(w[20]).toBeGreaterThan(0);
  });

  it('zeroes excluded balls at every bias setting', () => {
    const stats = skewedStats();
    for (const beta of [-8, 0, 8]) {
      const w = computeWeights(stats, { beta, exclude: [3, 7] });
      expect(w[3]).toBe(0);
      expect(w[7]).toBe(0);
      expect(w[4]).toBeGreaterThan(0);
    }
  });

  it('stays uniform when there is no history at all', () => {
    const stats = whiteStats([], 10);
    const w = computeWeights(stats, { beta: 8 });
    for (let b = 1; b <= 10; b++) expect(w[b]).toBe(1);
  });
});

describe('sliderToBeta', () => {
  it('maps the slider onto the exponent range and clamps', () => {
    expect(sliderToBeta(0)).toBe(0);
    expect(sliderToBeta(100)).toBe(MAX_BIAS_EXPONENT);
    expect(sliderToBeta(-100)).toBe(-MAX_BIAS_EXPONENT);
    expect(sliderToBeta(999)).toBe(MAX_BIAS_EXPONENT);
  });
});

describe('normalize', () => {
  it('produces probabilities that sum to one', () => {
    const p = normalize([0, 1, 3, 4, 2]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(p[2]).toBeCloseTo(0.3);
  });
});
