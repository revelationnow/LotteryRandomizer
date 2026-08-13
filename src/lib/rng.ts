/**
 * Random number sources.
 *
 * Default is the platform CSPRNG. An optional seed switches to sfc32 so a share
 * card can encode its seed and reproduce the exact same set of numbers.
 */

export type Rng = () => number;

/** Uniform in [0, 1), drawn from crypto.getRandomValues. */
export const cryptoRng: Rng = () => {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  // Build a 53-bit mantissa so the whole double range is reachable.
  return ((buf[0] >>> 5) * 2 ** 26 + (buf[1] >>> 6)) / 2 ** 53;
};

/** sfc32 — small, fast, and good enough for reproducing a draw. */
function sfc32(a: number, b: number, c: number, d: number): Rng {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Expand a string seed into four 32-bit words. */
function hashSeed(seed: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export function seededRng(seed: string): Rng {
  const [a, b, c, d] = hashSeed(seed);
  const rng = sfc32(a, b, c, d);
  // Discard the first few outputs so short seeds do not correlate.
  for (let i = 0; i < 16; i++) rng();
  return rng;
}

export function rngFor(seed?: string | null): Rng {
  return seed ? seededRng(seed) : cryptoRng;
}

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A short, human-shareable seed with no ambiguous characters. */
export function newSeed(length = 8): string {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => SEED_ALPHABET[b % SEED_ALPHABET.length]).join('');
}

export function normalizeSeed(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
