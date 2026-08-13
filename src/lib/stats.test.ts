import { describe, it, expect } from 'vitest';
import { chiSquare, chiSquarePValue, tally, whiteStats, specialStats } from './stats';
import type { DrawTuple } from './data';

describe('chiSquarePValue', () => {
  // Reference values from the standard chi-square distribution.
  it('matches known critical points', () => {
    expect(chiSquarePValue(3.841459, 1)).toBeCloseTo(0.05, 4);
    expect(chiSquarePValue(5.991465, 2)).toBeCloseTo(0.05, 4);
    expect(chiSquarePValue(124.342, 100)).toBeCloseTo(0.05, 3);
    // chi2 equal to df sits just under 0.5: the distribution is right-skewed, so
    // the median (~67.3 by Wilson-Hilferty) falls a little below the mean of df.
    expect(chiSquarePValue(68, 68)).toBeCloseTo(0.4772, 3);
  });

  it('returns 1 for a perfect fit and ~0 for an extreme one', () => {
    expect(chiSquarePValue(0, 68)).toBe(1);
    expect(chiSquarePValue(1000, 68)).toBeLessThan(1e-100);
  });
});

describe('tally', () => {
  const draws: DrawTuple[] = [
    [20260101, 1, 2, 3, 4, 5, 1],
    [20260104, 1, 2, 3, 4, 6, 2],
    [20260108, 7, 8, 9, 10, 11, 1],
  ];

  it('counts white balls across draws', () => {
    const s = whiteStats(draws, 12);
    expect(s.draws).toBe(3);
    expect(s.perDraw).toBe(5);
    expect(s.counts[1]).toBe(2);
    expect(s.counts[5]).toBe(1);
    expect(s.counts[12]).toBe(0);
    expect(s.expected).toBeCloseTo((5 * 3) / 12);
  });

  it('measures drought as draws since the last appearance', () => {
    const s = whiteStats(draws, 12);
    // Ball 7 came up in the most recent draw.
    expect(s.drought[7]).toBe(0);
    // Ball 1 last appeared one draw ago.
    expect(s.drought[1]).toBe(1);
    // Ball 5 last appeared two draws ago.
    expect(s.drought[5]).toBe(2);
    // Ball 12 has never appeared, so the drought is the full history.
    expect(s.drought[12]).toBe(3);
  });

  it('measures drought from chronological order regardless of input order', () => {
    const shuffled = [draws[2], draws[0], draws[1]];
    expect(whiteStats(shuffled, 12).drought[7]).toBe(0);
  });

  it('counts the special ball separately', () => {
    const s = specialStats(draws, 5);
    expect(s.perDraw).toBe(1);
    expect(s.counts[1]).toBe(2);
    expect(s.counts[2]).toBe(1);
    expect(s.expected).toBeCloseTo(3 / 5);
  });

  it('ignores balls outside the pool', () => {
    const s = tally([[20260101, 1, 2, 3, 4, 99, 1]], 10, (d) => d.slice(1, 6));
    expect(s.counts.reduce((a, b) => a + b, 0)).toBe(4);
  });
});

describe('chiSquare', () => {
  it('reports uniform for a perfectly even spread', () => {
    const draws: DrawTuple[] = [];
    // Every ball 1..10 appears exactly once as the special ball.
    for (let b = 1; b <= 10; b++) draws.push([20260000 + b, 1, 2, 3, 4, 5, b]);
    const result = chiSquare(specialStats(draws, 10));
    expect(result.chi2).toBeCloseTo(0);
    expect(result.df).toBe(9);
    expect(result.uniform).toBe(true);
  });

  it('rejects uniformity for a rigged pool', () => {
    const draws: DrawTuple[] = [];
    // Ball 1 wins every single time.
    for (let i = 0; i < 200; i++) draws.push([20260000 + i, 1, 2, 3, 4, 5, 1]);
    const result = chiSquare(specialStats(draws, 10));
    expect(result.uniform).toBe(false);
    expect(result.pValue).toBeLessThan(0.001);
  });
});
