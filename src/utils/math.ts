export const clamp = (v: number, min = 0, max = 1): number => Math.min(max, Math.max(min, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const invLerp = (a: number, b: number, v: number): number => (a === b ? 0 : (v - a) / (b - a));

/** Maps v from [a0, a1] to [b0, b1], clamped. */
export const remap = (v: number, a0: number, a1: number, b0: number, b1: number): number =>
  lerp(b0, b1, clamp(invLerp(a0, a1, v)));

export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp(invLerp(e0, e1, x));
  return t * t * (3 - 2 * t);
};

/**
 * Cubic Hermite curve from (0,0) to (1,1) with end slopes m0 and m1.
 * Slopes of 0 make the motion settle at that end; slopes of 1 at both ends give a straight line.
 */
export const hermite01 = (t: number, m0: number, m1: number): number => {
  const t2 = t * t;
  const t3 = t2 * t;
  return (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) + (t3 - t2) * m1;
};

/** Frame-rate independent exponential approach of `current` towards `target`. */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** Geometric interpolation for strictly positive values spanning orders of magnitude. */
export const logLerp = (a: number, b: number, t: number): number => a * Math.pow(b / a, t);

/** Deterministic PRNG (mulberry32) so procedural content is identical on every load. */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample via Box-Muller. */
export function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
