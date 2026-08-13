/**
 * Ticket generation: weights + sampler + user constraints.
 *
 * Pins and exclusions are handled inside the sampler (the pool shrinks), which is
 * exact. Shape constraints (odd/even split, sum range) can't be expressed as ball
 * weights, so they're applied by rejection — generate a candidate, test it, retry.
 * If the constraints turn out to be unsatisfiable we say so rather than hanging or
 * silently ignoring them.
 */

import type { GameDef } from './games';
import type { PoolStats } from './stats';
import { computeWeights } from './weights';
import { weightedPickOne, weightedSampleWithoutReplacement } from './sample';
import { rngFor, type Rng } from './rng';

export const MAX_ATTEMPTS = 500;

export interface TicketOptions {
  /** Bias exponent; 0 is a fair draw. */
  beta: number;
  /** White balls forced into every ticket. */
  pinned?: number[];
  /** White balls never drawn. */
  excluded?: number[];
  /** Force a specific special ball. */
  pinnedSpecial?: number | null;
  /** Required count of odd white balls, or null for no constraint. */
  oddCount?: number | null;
  /** Inclusive [min, max] on the sum of the white balls, or null. */
  sumRange?: [number, number] | null;
}

export interface Ticket {
  white: number[];
  special: number;
  /** True when the shape constraints could not be met and were dropped. */
  relaxed: boolean;
}

/** Smallest and largest possible sum of `count` distinct balls from 1..max. */
export function sumBounds(max: number, count: number): [number, number] {
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < count; i++) {
    lo += i + 1;
    hi += max - i;
  }
  return [lo, hi];
}

export function countOdd(balls: number[]): number {
  return balls.filter((b) => b % 2 === 1).length;
}

export function sum(balls: number[]): number {
  return balls.reduce((a, b) => a + b, 0);
}

function satisfies(white: number[], opts: TicketOptions): boolean {
  if (opts.oddCount != null && countOdd(white) !== opts.oddCount) return false;
  if (opts.sumRange) {
    const s = sum(white);
    if (s < opts.sumRange[0] || s > opts.sumRange[1]) return false;
  }
  return true;
}

export interface GenerateInput {
  game: GameDef;
  whiteStats: PoolStats;
  specialStats: PoolStats;
  options: TicketOptions;
  seed?: string | null;
}

/**
 * Validate the pin/exclude configuration. Returns an error message, or null when
 * the request is satisfiable in principle.
 */
export function validate(input: GenerateInput): string | null {
  const { game, options } = input;
  const era = game.eras[0];
  const pinned = options.pinned ?? [];
  const excluded = new Set(options.excluded ?? []);

  if (pinned.length > game.whiteCount) {
    return `You can pin at most ${game.whiteCount} numbers.`;
  }
  if (new Set(pinned).size !== pinned.length) {
    return 'The same number is pinned twice.';
  }
  for (const b of pinned) {
    if (b < 1 || b > era.whiteMax) return `${b} is outside the 1–${era.whiteMax} pool.`;
    if (excluded.has(b)) return `${b} is both pinned and excluded.`;
  }
  const available = era.whiteMax - excluded.size - pinned.length;
  if (available < game.whiteCount - pinned.length) {
    return 'Too many numbers are excluded to fill a ticket.';
  }
  if (options.pinnedSpecial != null) {
    if (options.pinnedSpecial < 1 || options.pinnedSpecial > era.specialMax) {
      return `${game.specialName} must be between 1 and ${era.specialMax}.`;
    }
  }
  return null;
}

export function generateTicket(input: GenerateInput, rngOverride?: Rng): Ticket {
  const { game, whiteStats, specialStats, options } = input;
  const invalid = validate(input);
  if (invalid) throw new Error(invalid);

  const rng = rngOverride ?? rngFor(input.seed);
  const pinned = [...(options.pinned ?? [])];
  const excluded = new Set(options.excluded ?? []);
  // Pinned balls are removed from the sampling pool and added back at the end.
  for (const b of pinned) excluded.add(b);

  const whiteWeights = computeWeights(whiteStats, { beta: options.beta, exclude: excluded });
  const needed = game.whiteCount - pinned.length;

  let white: number[] = [];
  let relaxed = true;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const drawn = needed > 0 ? weightedSampleWithoutReplacement(whiteWeights, needed, rng) : [];
    const candidate = [...pinned, ...drawn].sort((a, b) => a - b);
    if (satisfies(candidate, options)) {
      white = candidate;
      relaxed = false;
      break;
    }
    white = candidate;
  }

  const special =
    options.pinnedSpecial ??
    weightedPickOne(computeWeights(specialStats, { beta: options.beta }), rng);

  return { white, special, relaxed };
}

/** Generate several distinct tickets in one go. */
export function generateTickets(input: GenerateInput, count: number): Ticket[] {
  const rng = rngFor(input.seed);
  const out: Ticket[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    // Give near-duplicates a few chances to differ before accepting one.
    let ticket = generateTicket(input, rng);
    for (let retry = 0; retry < 8 && seen.has(key(ticket)); retry++) {
      ticket = generateTicket(input, rng);
    }
    seen.add(key(ticket));
    out.push(ticket);
  }
  return out;
}

function key(t: Ticket): string {
  return `${t.white.join('-')}|${t.special}`;
}
