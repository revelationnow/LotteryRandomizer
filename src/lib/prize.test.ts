import { describe, it, expect } from 'vitest';
import { checkTicket, applyMultiplier } from './prize';
import type { Draw } from './data';

const draw: Draw = { date: '2026-08-12', white: [4, 12, 23, 38, 51], special: 9 };

function ticket(white: number[], special: number) {
  return { white, special, relaxed: false };
}

describe('checkTicket', () => {
  it('identifies the jackpot', () => {
    const r = checkTicket('powerball', ticket([4, 12, 23, 38, 51], 9), draw);
    expect(r.whiteMatches).toBe(5);
    expect(r.specialMatch).toBe(true);
    expect(r.tier?.label).toBe('Jackpot');
    expect(r.tier?.prize).toBeNull();
  });

  it('identifies five white balls without the Powerball', () => {
    const r = checkTicket('powerball', ticket([4, 12, 23, 38, 51], 10), draw);
    expect(r.tier?.prize).toBe(1_000_000);
  });

  it('identifies the Powerball alone', () => {
    const r = checkTicket('powerball', ticket([1, 2, 3, 5, 6], 9), draw);
    expect(r.whiteMatches).toBe(0);
    expect(r.tier?.prize).toBe(4);
    expect(r.won).toBe(true);
  });

  it('reports a losing ticket', () => {
    const r = checkTicket('powerball', ticket([1, 2, 3, 5, 6], 10), draw);
    expect(r.won).toBe(false);
    expect(r.tier).toBeNull();
  });

  it('reports two white balls with no special as a loss', () => {
    // Two whites only pays when the Powerball also matches.
    const r = checkTicket('powerball', ticket([4, 12, 1, 2, 3], 10), draw);
    expect(r.whiteMatches).toBe(2);
    expect(r.won).toBe(false);
  });

  it('uses the Mega Millions table for Mega Millions', () => {
    const r = checkTicket('megamillions', ticket([4, 12, 23, 38, 1], 9), draw);
    // Four whites plus the Mega Ball pays $10,000, not Powerball's $50,000.
    expect(r.tier?.prize).toBe(10_000);
  });

  it('lists which numbers matched', () => {
    const r = checkTicket('powerball', ticket([4, 12, 99, 98, 97], 1), draw);
    expect(r.matchedWhite).toEqual([4, 12]);
  });
});

describe('applyMultiplier', () => {
  it('scales a fixed prize', () => {
    const tier = { whiteMatches: 3, specialMatch: false, prize: 10, label: '$10' };
    expect(applyMultiplier(tier, 5)).toBe('$50');
  });

  it('leaves the jackpot alone', () => {
    const tier = { whiteMatches: 5, specialMatch: true, prize: null, label: 'Jackpot' };
    expect(applyMultiplier(tier, 10)).toBe('Jackpot');
  });

  it('ignores a missing or 1x multiplier', () => {
    const tier = { whiteMatches: 3, specialMatch: false, prize: 10, label: '$10' };
    expect(applyMultiplier(tier, null)).toBe('$10');
    expect(applyMultiplier(tier, 1)).toBe('$10');
  });
});
