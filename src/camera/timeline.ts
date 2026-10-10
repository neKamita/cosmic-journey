import { Color } from 'three';
import { resolveAnchor, type Anchor, type ChapterRanges } from './anchors';
import { lerp, logLerp } from '../utils/math';

export type Ease = (t: number) => number;

export const linear: Ease = (t) => t;
export const smooth: Ease = (t) => t * t * (3 - 2 * t);

export interface Segment {
  readonly index: number;
  readonly t: number;
}

/**
 * Locates p within sorted stops. Before the first stop the result is (0, 0); after the last stop it
 * is (n - 2, 1). Zero-length segments resolve to t = 1.
 */
export function findSegment(stops: readonly number[], p: number): Segment {
  const n = stops.length;
  if (n < 2) return { index: 0, t: 0 };
  if (p <= stops[0]!) return { index: 0, t: 0 };
  if (p >= stops[n - 1]!) return { index: n - 2, t: 1 };
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (stops[mid]! <= p) lo = mid;
    else hi = mid;
  }
  const a = stops[lo]!;
  const b = stops[hi]!;
  return { index: lo, t: b > a ? (p - a) / (b - a) : 1 };
}

/** Turns anchors into non-decreasing global progress stops. */
export function resolveStops(anchors: readonly Anchor[], ranges: ChapterRanges): number[] {
  const stops: number[] = [];
  for (const anchor of anchors) {
    const p = resolveAnchor(anchor, ranges);
    stops.push(stops.length ? Math.max(p, stops[stops.length - 1]!) : p);
  }
  return stops;
}

export interface AnchoredKey<T> {
  readonly at: Anchor;
  readonly value: T;
  /** Easing of the segment that starts at this key. Defaults to smoothstep. */
  readonly ease?: Ease;
}

abstract class AnchoredTrack<T> {
  protected stops: number[];

  constructor(
    protected readonly keys: readonly AnchoredKey<T>[],
    ranges: ChapterRanges,
  ) {
    if (keys.length === 0) throw new Error('Track needs at least one key');
    this.stops = resolveStops(
      keys.map((k) => k.at),
      ranges,
    );
  }

  resolve(ranges: ChapterRanges): void {
    this.stops = resolveStops(
      this.keys.map((k) => k.at),
      ranges,
    );
  }

  protected locate(p: number): { a: T; b: T; t: number } {
    const seg = findSegment(this.stops, p);
    const from = this.keys[seg.index]!;
    const to = this.keys[seg.index + 1] ?? from;
    return { a: from.value, b: to.value, t: (from.ease ?? smooth)(seg.t) };
  }
}

export class NumberTrack extends AnchoredTrack<number> {
  constructor(
    keys: readonly AnchoredKey<number>[],
    ranges: ChapterRanges,
    private readonly mode: 'linear' | 'log' = 'linear',
  ) {
    super(keys, ranges);
  }

  sample(p: number): number {
    const { a, b, t } = this.locate(p);
    return this.mode === 'log' ? logLerp(a, b, t) : lerp(a, b, t);
  }
}

export class ColorTrack extends AnchoredTrack<Color> {
  private readonly out = new Color();

  /** Returns a shared Color instance; copy it if you need to keep the value. */
  sample(p: number): Color {
    const { a, b, t } = this.locate(p);
    return this.out.lerpColors(a, b, t);
  }
}
