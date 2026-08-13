/**
 * Match a ticket against an official result.
 *
 * Prize amounts are the advertised base prizes for a standard play. Powerball
 * figures assume no Power Play. Mega Millions figures are the April 2025 structure,
 * where every non-jackpot prize is then multiplied by the drawn 2x-10x multiplier —
 * `applyMultiplier` handles that when the draw records one.
 *
 * Actual payouts vary by jurisdiction, and pari-mutuel states differ entirely, so
 * these are labelled as typical rather than guaranteed in the UI.
 */

import type { GameId } from './games';
import type { Draw } from './data';
import type { Ticket } from './constraints';

export interface Tier {
  whiteMatches: number;
  specialMatch: boolean;
  /** null means the jackpot, which has no fixed value. */
  prize: number | null;
  label: string;
}

const POWERBALL_TIERS: Tier[] = [
  { whiteMatches: 5, specialMatch: true, prize: null, label: 'Jackpot' },
  { whiteMatches: 5, specialMatch: false, prize: 1_000_000, label: '$1,000,000' },
  { whiteMatches: 4, specialMatch: true, prize: 50_000, label: '$50,000' },
  { whiteMatches: 4, specialMatch: false, prize: 100, label: '$100' },
  { whiteMatches: 3, specialMatch: true, prize: 100, label: '$100' },
  { whiteMatches: 3, specialMatch: false, prize: 7, label: '$7' },
  { whiteMatches: 2, specialMatch: true, prize: 7, label: '$7' },
  { whiteMatches: 1, specialMatch: true, prize: 4, label: '$4' },
  { whiteMatches: 0, specialMatch: true, prize: 4, label: '$4' },
];

const MEGAMILLIONS_TIERS: Tier[] = [
  { whiteMatches: 5, specialMatch: true, prize: null, label: 'Jackpot' },
  { whiteMatches: 5, specialMatch: false, prize: 1_000_000, label: '$1,000,000' },
  { whiteMatches: 4, specialMatch: true, prize: 10_000, label: '$10,000' },
  { whiteMatches: 4, specialMatch: false, prize: 500, label: '$500' },
  { whiteMatches: 3, specialMatch: true, prize: 200, label: '$200' },
  { whiteMatches: 3, specialMatch: false, prize: 10, label: '$10' },
  { whiteMatches: 2, specialMatch: true, prize: 10, label: '$10' },
  { whiteMatches: 1, specialMatch: true, prize: 7, label: '$7' },
  { whiteMatches: 0, specialMatch: true, prize: 5, label: '$5' },
];

const TIERS: Record<GameId, Tier[]> = {
  powerball: POWERBALL_TIERS,
  megamillions: MEGAMILLIONS_TIERS,
};

export interface MatchResult {
  whiteMatches: number;
  specialMatch: boolean;
  matchedWhite: number[];
  tier: Tier | null;
  won: boolean;
}

export function checkTicket(game: GameId, ticket: Ticket, draw: Draw): MatchResult {
  const winning = new Set(draw.white);
  const matchedWhite = ticket.white.filter((b) => winning.has(b));
  const specialMatch = ticket.special === draw.special;

  const tier =
    TIERS[game].find(
      (t) => t.whiteMatches === matchedWhite.length && t.specialMatch === specialMatch,
    ) ?? null;

  return {
    whiteMatches: matchedWhite.length,
    specialMatch,
    matchedWhite,
    tier,
    won: tier !== null,
  };
}

/** Non-jackpot Mega Millions prizes are scaled by the drawn multiplier. */
export function applyMultiplier(tier: Tier, multiplier: number | null): string {
  if (tier.prize === null || !multiplier || multiplier <= 1) return tier.label;
  return `$${(tier.prize * multiplier).toLocaleString()}`;
}
