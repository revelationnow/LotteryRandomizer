import { describe, it, expect } from 'vitest';
import { GAMES, GAME_IDS, eraForDate, currentEra } from './games';
import { eligibleWhiteDraws, eligibleSpecialDraws, isoToDateInt, dateIntToIso } from './data';
import type { DrawTuple } from './data';

describe('eraForDate', () => {
  it('places Powerball draws in the right matrix', () => {
    const pb = GAMES.powerball;
    // Last draw under 5/59 + 1/35.
    expect(eraForDate(pb, '2015-10-04')).toMatchObject({ whiteMax: 59, specialMax: 35 });
    // First draw under the current 5/69 + 1/26.
    expect(eraForDate(pb, '2015-10-07')).toMatchObject({ whiteMax: 69, specialMax: 26 });
    expect(eraForDate(pb, '2011-06-01')).toMatchObject({ whiteMax: 59, specialMax: 39 });
    expect(eraForDate(pb, '2026-08-12')).toMatchObject({ whiteMax: 69, specialMax: 26 });
  });

  it('places Mega Millions draws in the right matrix', () => {
    const mm = GAMES.megamillions;
    expect(eraForDate(mm, '2017-10-28')).toMatchObject({ whiteMax: 75, specialMax: 15 });
    expect(eraForDate(mm, '2017-10-31')).toMatchObject({ whiteMax: 70, specialMax: 25 });
    // The April 2025 change kept the white pool but dropped Mega Ball 25.
    expect(eraForDate(mm, '2025-04-04')).toMatchObject({ whiteMax: 70, specialMax: 25 });
    expect(eraForDate(mm, '2025-04-08')).toMatchObject({ whiteMax: 70, specialMax: 24 });
  });

  it('returns null before the table begins', () => {
    expect(eraForDate(GAMES.megamillions, '1999-01-01')).toBeNull();
  });

  it('has no gaps or overlaps between consecutive eras', () => {
    for (const id of GAME_IDS) {
      const eras = GAMES[id].eras;
      for (let i = 0; i < eras.length - 1; i++) {
        const newer = eras[i];
        const older = eras[i + 1];
        expect(older.to).not.toBeNull();
        // The older era must end strictly before the newer one starts.
        expect(older.to! < newer.from).toBe(true);
      }
      // Only the newest era is open-ended.
      expect(eras[0].to).toBeNull();
      expect(eras.slice(1).every((e) => e.to !== null)).toBe(true);
    }
  });

  it('exposes the live matrix as the current era', () => {
    expect(currentEra(GAMES.powerball)).toMatchObject({ whiteMax: 69, specialMax: 26 });
    expect(currentEra(GAMES.megamillions)).toMatchObject({ whiteMax: 70, specialMax: 24 });
  });
});

describe('eligibility filtering', () => {
  const pb = GAMES.powerball;

  it('excludes Powerball draws from before the 5/69 matrix', () => {
    const draws: DrawTuple[] = [
      // Old 5/59 era — must not feed the weights.
      [20150103, 5, 12, 30, 44, 59, 30],
      [20151003, 1, 2, 3, 4, 55, 20],
      // Current era.
      [20151007, 1, 2, 3, 4, 69, 26],
      [20260812, 10, 20, 30, 40, 50, 5],
    ];
    const eligible = eligibleWhiteDraws(pb, draws);
    expect(eligible).toHaveLength(2);
    expect(eligible.map((d) => d[0])).toEqual([20151007, 20260812]);
  });

  it('excludes old high Powerball numbers from the special pool', () => {
    const draws: DrawTuple[] = [
      [20150103, 5, 12, 30, 44, 59, 30], // Powerball 30 no longer exists
      [20151007, 1, 2, 3, 4, 69, 26],
    ];
    expect(eligibleSpecialDraws(pb, draws)).toHaveLength(1);
  });

  it('keeps the Mega Millions white pool across the April 2025 change', () => {
    const mm = GAMES.megamillions;
    const draws: DrawTuple[] = [
      [20171031, 1, 2, 3, 4, 70, 25],
      [20250404, 5, 6, 7, 8, 70, 25],
      [20250408, 9, 10, 11, 12, 70, 24],
    ];
    // All three share the 1..70 white pool.
    expect(eligibleWhiteDraws(mm, draws)).toHaveLength(3);
    // Only draws whose Mega Ball still exists count towards the special pool,
    // so the two that landed on 25 drop out.
    const special = eligibleSpecialDraws(mm, draws);
    expect(special).toHaveLength(1);
    expect(special[0][6]).toBe(24);
  });

  it('drops pre-2017 Mega Millions draws with balls above 70', () => {
    const mm = GAMES.megamillions;
    const draws: DrawTuple[] = [[20150101, 1, 2, 3, 4, 75, 10]];
    expect(eligibleWhiteDraws(mm, draws)).toHaveLength(0);
  });
});

describe('date helpers', () => {
  it('round-trips between ISO strings and packed integers', () => {
    expect(isoToDateInt('2026-08-13')).toBe(20260813);
    expect(dateIntToIso(20260813)).toBe('2026-08-13');
    expect(dateIntToIso(isoToDateInt('2002-05-17'))).toBe('2002-05-17');
  });
});
