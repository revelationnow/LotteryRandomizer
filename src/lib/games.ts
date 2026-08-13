/**
 * Game definitions and matrix era tables.
 *
 * This is the single source of truth for the whole app. Both games have changed
 * their number pools several times; weighting across a boundary would mix in balls
 * that no longer exist (or miss balls that did not exist yet), so every draw is
 * tagged with the era it belongs to and only same-matrix draws feed the weights.
 *
 * `ingest.ts` validates every ingested ball against its era's range and fails the
 * run on any violation, which makes this table self-checking: a wrong boundary
 * date cannot slip through silently.
 */

export type GameId = 'powerball' | 'megamillions';

export interface Era {
  /** Inclusive ISO start date of this matrix. */
  from: string;
  /** Inclusive ISO end date, or null for the currently running era. */
  to: string | null;
  /** Highest white ball; the pool is always 1..whiteMax. */
  whiteMax: number;
  /** Highest special ball (Powerball / Mega Ball). */
  specialMax: number;
}

export interface GameDef {
  id: GameId;
  name: string;
  shortName: string;
  /** Socrata dataset identifier on data.ny.gov. */
  datasetId: string;
  /** How many white balls are drawn per draw. */
  whiteCount: number;
  specialName: string;
  /** Newest era first. */
  eras: Era[];
  /**
   * Draws where the special ball exceeds the current pool are excluded from
   * special-ball weighting rather than excluding the whole era. Mega Millions
   * dropped Mega Ball 25 in April 2025 but left the white pool untouched, so the
   * 2017+ history stays usable for both pools with only ball 25 discarded.
   */
  specialWeightingFrom: string;
  whiteWeightingFrom: string;
  drawDays: string;
  /** Tailwind-facing accent for the special ball. */
  accent: { from: string; to: string; glow: string };
}

export const GAMES: Record<GameId, GameDef> = {
  powerball: {
    id: 'powerball',
    name: 'Powerball',
    shortName: 'PB',
    datasetId: 'd6yy-54nr',
    whiteCount: 5,
    specialName: 'Powerball',
    eras: [
      // 5/69 + 1/26 — current matrix.
      { from: '2015-10-07', to: null, whiteMax: 69, specialMax: 26 },
      // 5/59 + 1/35.
      { from: '2012-01-15', to: '2015-10-04', whiteMax: 59, specialMax: 35 },
      // 5/59 + 1/39 — the dataset begins in 2010, partway through this era.
      { from: '2009-01-07', to: '2012-01-11', whiteMax: 59, specialMax: 39 },
    ],
    whiteWeightingFrom: '2015-10-07',
    specialWeightingFrom: '2015-10-07',
    drawDays: 'Mon · Wed · Sat',
    accent: { from: '#fb7185', to: '#e11d48', glow: '251, 113, 133' },
  },
  megamillions: {
    id: 'megamillions',
    name: 'Mega Millions',
    shortName: 'MM',
    datasetId: '5xaw-6ayf',
    whiteCount: 5,
    specialName: 'Mega Ball',
    eras: [
      // 5/70 + 1/24 — Mega Ball 25 retired, ticket price rose to $5.
      { from: '2025-04-08', to: null, whiteMax: 70, specialMax: 24 },
      // 5/70 + 1/25.
      { from: '2017-10-31', to: '2025-04-04', whiteMax: 70, specialMax: 25 },
      // 5/75 + 1/15.
      { from: '2013-10-22', to: '2017-10-28', whiteMax: 75, specialMax: 15 },
      // 5/56 + 1/46.
      { from: '2005-06-24', to: '2013-10-18', whiteMax: 56, specialMax: 46 },
      // 5/52 + 1/52 — earliest rows in the dataset.
      { from: '2002-05-17', to: '2005-06-21', whiteMax: 52, specialMax: 52 },
    ],
    // The white pool has been 1..70 continuously since 2017, spanning both of the
    // recent special-ball eras, so all of it is eligible.
    whiteWeightingFrom: '2017-10-31',
    specialWeightingFrom: '2017-10-31',
    drawDays: 'Tue · Fri',
    accent: { from: '#fbbf24', to: '#f59e0b', glow: '251, 191, 36' },
  },
};

export const GAME_IDS: GameId[] = ['powerball', 'megamillions'];

/** The matrix currently in force for a game. */
export function currentEra(game: GameDef): Era {
  return game.eras[0];
}

/** Find the era a draw date falls in, or null if it predates the table. */
export function eraForDate(game: GameDef, isoDate: string): Era | null {
  for (const era of game.eras) {
    if (isoDate >= era.from && (era.to === null || isoDate <= era.to)) return era;
  }
  return null;
}
