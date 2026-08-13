import { describe, it, expect } from 'vitest';
import { generateTicket, generateTickets, validate, sumBounds, countOdd, sum } from './constraints';
import type { GenerateInput } from './constraints';
import { GAMES } from './games';
import { whiteStats, specialStats } from './stats';
import type { DrawTuple } from './data';

function history(count = 400): DrawTuple[] {
  const draws: DrawTuple[] = [];
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < count; i++) {
    const set = new Set<number>();
    while (set.size < 5) set.add(1 + Math.floor(rnd() * 69));
    const w = [...set].sort((a, b) => a - b);
    draws.push([20200101 + i, w[0], w[1], w[2], w[3], w[4], 1 + Math.floor(rnd() * 26)]);
  }
  return draws;
}

function input(options: Partial<GenerateInput['options']> = {}, seed?: string): GenerateInput {
  const draws = history();
  return {
    game: GAMES.powerball,
    whiteStats: whiteStats(draws, 69),
    specialStats: specialStats(draws, 26),
    options: { beta: 0, ...options },
    seed,
  };
}

describe('generateTicket', () => {
  it('produces a valid Powerball ticket', () => {
    for (let i = 0; i < 200; i++) {
      const t = generateTicket(input());
      expect(t.white).toHaveLength(5);
      expect(new Set(t.white).size).toBe(5);
      expect([...t.white].sort((a, b) => a - b)).toEqual(t.white);
      for (const b of t.white) {
        expect(b).toBeGreaterThanOrEqual(1);
        expect(b).toBeLessThanOrEqual(69);
      }
      expect(t.special).toBeGreaterThanOrEqual(1);
      expect(t.special).toBeLessThanOrEqual(26);
    }
  });

  it('always includes pinned numbers', () => {
    for (let i = 0; i < 100; i++) {
      const t = generateTicket(input({ pinned: [7, 42] }));
      expect(t.white).toContain(7);
      expect(t.white).toContain(42);
      expect(t.white).toHaveLength(5);
    }
  });

  it('never includes excluded numbers', () => {
    const excluded = [1, 2, 3, 4, 5, 13, 69];
    for (let i = 0; i < 200; i++) {
      const t = generateTicket(input({ excluded }));
      for (const b of excluded) expect(t.white).not.toContain(b);
    }
  });

  it('honours a pinned special ball', () => {
    const t = generateTicket(input({ pinnedSpecial: 19 }));
    expect(t.special).toBe(19);
  });

  it('respects an odd/even split', () => {
    for (let i = 0; i < 50; i++) {
      const t = generateTicket(input({ oddCount: 3 }));
      expect(t.relaxed).toBe(false);
      expect(countOdd(t.white)).toBe(3);
    }
  });

  it('respects a sum range', () => {
    for (let i = 0; i < 50; i++) {
      const t = generateTicket(input({ sumRange: [120, 180] }));
      expect(t.relaxed).toBe(false);
      expect(sum(t.white)).toBeGreaterThanOrEqual(120);
      expect(sum(t.white)).toBeLessThanOrEqual(180);
    }
  });

  it('satisfies odd/even and sum together', () => {
    for (let i = 0; i < 30; i++) {
      const t = generateTicket(input({ oddCount: 2, sumRange: [100, 200] }));
      expect(t.relaxed).toBe(false);
      expect(countOdd(t.white)).toBe(2);
      expect(sum(t.white)).toBeGreaterThanOrEqual(100);
    }
  });

  it('flags a relaxed ticket instead of hanging on impossible constraints', () => {
    // The five lowest balls sum to 15, so no ticket can reach 1000.
    const t = generateTicket(input({ sumRange: [1000, 1001] }));
    expect(t.relaxed).toBe(true);
    expect(t.white).toHaveLength(5);
  });

  it('reproduces an identical ticket from the same seed', () => {
    const a = generateTicket(input({ beta: 5 }, 'ORRERY42'));
    const b = generateTicket(input({ beta: 5 }, 'ORRERY42'));
    const c = generateTicket(input({ beta: 5 }, 'DIFFERENT'));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('reproduces a whole batch from the same seed', () => {
    const a = generateTickets(input({}, 'BATCH1'), 5);
    const b = generateTickets(input({}, 'BATCH1'), 5);
    expect(a).toEqual(b);
  });

  it('leans towards hot numbers at a high positive bias', () => {
    // Build a history where balls 1-10 are drawn far more often than the rest.
    const draws: DrawTuple[] = [];
    for (let i = 0; i < 600; i++) {
      const base = (i % 6) * 1;
      draws.push([20200101 + i, 1 + base, 2 + base, 3 + base, 4 + base, 5 + base, 1]);
    }
    for (let i = 0; i < 600; i++) {
      const b = 30 + (i % 39);
      draws.push([20240101 + i, b, ((b + 1) % 39) + 30, ((b + 2) % 39) + 30, ((b + 3) % 39) + 30, ((b + 4) % 39) + 30, 2]);
    }
    const inp: GenerateInput = {
      game: GAMES.powerball,
      whiteStats: whiteStats(draws, 69),
      specialStats: specialStats(draws, 26),
      options: { beta: 8 },
      seed: 'HOT',
    };
    let hotHits = 0;
    const trials = 400;
    for (let i = 0; i < trials; i++) {
      hotHits += generateTicket(inp).white.filter((b) => b <= 10).length;
    }
    const coldInp = { ...inp, options: { beta: -8 }, seed: 'COLD' };
    let coldHits = 0;
    for (let i = 0; i < trials; i++) {
      coldHits += generateTicket(coldInp).white.filter((b) => b <= 10).length;
    }
    expect(hotHits).toBeGreaterThan(coldHits);
  });
});

describe('validate', () => {
  it('rejects pinning more numbers than fit', () => {
    expect(validate(input({ pinned: [1, 2, 3, 4, 5, 6] }))).toMatch(/at most 5/);
  });

  it('rejects a number that is both pinned and excluded', () => {
    expect(validate(input({ pinned: [7], excluded: [7] }))).toMatch(/both pinned and excluded/);
  });

  it('rejects an out-of-range pin', () => {
    expect(validate(input({ pinned: [70] }))).toMatch(/outside the 1–69 pool/);
  });

  it('rejects duplicate pins', () => {
    expect(validate(input({ pinned: [5, 5] }))).toMatch(/pinned twice/);
  });

  it('rejects an out-of-range special ball', () => {
    expect(validate(input({ pinnedSpecial: 27 }))).toMatch(/between 1 and 26/);
  });

  it('rejects excluding almost everything', () => {
    const excluded = Array.from({ length: 66 }, (_, i) => i + 1);
    expect(validate(input({ excluded }))).toMatch(/Too many numbers are excluded/);
  });

  it('accepts a sane configuration', () => {
    expect(validate(input({ pinned: [7], excluded: [13], pinnedSpecial: 4 }))).toBeNull();
  });
});

describe('sumBounds', () => {
  it('computes the reachable sum range', () => {
    expect(sumBounds(69, 5)).toEqual([15, 335]);
    expect(sumBounds(70, 5)).toEqual([15, 340]);
  });
});
