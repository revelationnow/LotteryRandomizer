import { describe, it, expect } from 'vitest';
import { weightedSampleWithoutReplacement, weightedPickOne } from './sample';
import { seededRng, type Rng } from './rng';

/** Reference implementation: draw one at a time proportional to weight, no replacement. */
function sequentialSample(weights: number[], k: number, rng: Rng): number[] {
  const pool = weights.map((w, i) => ({ ball: i, w })).filter((e) => e.ball > 0 && e.w > 0);
  const out: number[] = [];
  for (let i = 0; i < k; i++) {
    const total = pool.reduce((a, e) => a + e.w, 0);
    let r = rng() * total;
    let idx = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].w;
      if (r <= 0) {
        idx = j;
        break;
      }
    }
    out.push(pool[idx].ball);
    pool.splice(idx, 1);
  }
  return out;
}

describe('weightedSampleWithoutReplacement', () => {
  const weights = [0, 1, 1, 1, 1, 1];

  it('returns k distinct balls from the pool', () => {
    const rng = seededRng('DISTINCT');
    for (let i = 0; i < 200; i++) {
      const picked = weightedSampleWithoutReplacement(weights, 3, rng);
      expect(picked).toHaveLength(3);
      expect(new Set(picked).size).toBe(3);
      for (const b of picked) expect(b).toBeGreaterThanOrEqual(1);
      for (const b of picked) expect(b).toBeLessThanOrEqual(5);
    }
  });

  it('never picks a zero-weight ball', () => {
    const rng = seededRng('EXCLUDE');
    const w = [0, 1, 0, 1, 0, 1];
    for (let i = 0; i < 500; i++) {
      const picked = weightedSampleWithoutReplacement(w, 3, rng);
      expect(picked.sort((a, b) => a - b)).toEqual([1, 3, 5]);
    }
  });

  it('throws when the pool is too small', () => {
    expect(() => weightedSampleWithoutReplacement([0, 1, 1], 3, seededRng('X'))).toThrow(
      /Only 2 numbers are available/,
    );
  });

  it('picks a single ball exactly in proportion to its weight', () => {
    const rng = seededRng('PROPORTION');
    const w = [0, 1, 2, 3, 4];
    const total = 10;
    const trials = 200_000;
    const hits = new Array(5).fill(0);
    for (let i = 0; i < trials; i++) hits[weightedPickOne(w, rng)]++;
    for (let b = 1; b <= 4; b++) {
      expect(hits[b] / trials).toBeCloseTo(w[b] / total, 2);
    }
  });

  it('matches sequential weighted draw-without-replacement', () => {
    // Efraimidis-Spirakis should be distributionally identical to drawing one at a
    // time proportional to weight. Compare the full distribution over 3-subsets.
    const w = [0, 1, 2, 3, 4, 5];
    const trials = 120_000;
    const es = new Map<string, number>();
    const seq = new Map<string, number>();
    const rngA = seededRng('ES');
    const rngB = seededRng('SEQ');

    for (let i = 0; i < trials; i++) {
      const a = weightedSampleWithoutReplacement(w, 3, rngA).sort((x, y) => x - y).join(',');
      es.set(a, (es.get(a) ?? 0) + 1);
      const b = sequentialSample(w, 3, rngB).sort((x, y) => x - y).join(',');
      seq.set(b, (seq.get(b) ?? 0) + 1);
    }

    const keys = new Set([...es.keys(), ...seq.keys()]);
    expect(keys.size).toBe(10); // C(5,3)
    for (const k of keys) {
      const pa = (es.get(k) ?? 0) / trials;
      const pb = (seq.get(k) ?? 0) / trials;
      expect(Math.abs(pa - pb)).toBeLessThan(0.006);
    }
  });

  it('produces a visibly uniform spread with equal weights', () => {
    const rng = seededRng('UNIFORM');
    const w = new Array(70).fill(1);
    w[0] = 0;
    const trials = 40_000;
    const hits = new Array(70).fill(0);
    for (let i = 0; i < trials; i++) {
      for (const b of weightedSampleWithoutReplacement(w, 5, rng)) hits[b]++;
    }
    const expected = (trials * 5) / 69;
    for (let b = 1; b <= 69; b++) {
      expect(Math.abs(hits[b] - expected) / expected).toBeLessThan(0.08);
    }
  });
});
