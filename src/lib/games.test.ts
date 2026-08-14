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
    // An earlier version of this test only asserted older.to < newer.from, which
    // a gap satisfies just as happily as adjacency — and a real gap did slip
    // through: the Powerball draw on 2012-01-14 belonged to no era, so ingest
    // rejected the whole dataset. Assert exact day-adjacency instead.
    const dayAfter = (iso: string) => {
      const d = new Date(`${iso}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    };

    for (const id of GAME_IDS) {
      const eras = GAMES[id].eras;
      for (let i = 0; i < eras.length - 1; i++) {
        const newer = eras[i];
        const older = eras[i + 1];
        expect(older.to).not.toBeNull();
        expect(dayAfter(older.to!)).toBe(newer.from);
      }
      // Only the newest era is open-ended.
      expect(eras[0].to).toBeNull();
      expect(eras.slice(1).every((e) => e.to !== null)).toBe(true);
    }
  });

  it('covers every date from the start of the table onwards', () => {
    // Walk week by week; a single uncovered date is enough to fail ingest.
    for (const id of GAME_IDS) {
      const eras = GAMES[id].eras;
      const start = new Date(`${eras[eras.length - 1].from}T00:00:00Z`);
      const end = new Date();
      for (const d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        expect(eraForDate(GAMES[id], iso), `${id} has no era for ${iso}`).not.toBeNull();
      }
    }
  });

  it('places the final draw before the 2012 Powerball price change correctly', () => {
    // Regression: the $2 matrix went on sale 2012-01-15 and was first drawn on the
    // 18th, so the Saturday 14th draw is still the old 5/59 + 1/39 game.
    expect(eraForDate(GAMES.powerball, '2012-01-14')).toMatchObject({
      whiteMax: 59,
      specialMax: 39,
    });
    expect(eraForDate(GAMES.powerball, '2012-01-15')).toMatchObject({
      whiteMax: 59,
      specialMax: 35,
    });
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
