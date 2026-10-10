import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import { at, defaultRanges, resolveAnchor } from './anchors';
import { ColorTrack, NumberTrack, findSegment, linear, resolveStops } from './timeline';

describe('findSegment', () => {
  const stops = [0, 0.2, 0.5, 1];

  it('clamps before the first and after the last stop', () => {
    expect(findSegment(stops, -1)).toEqual({ index: 0, t: 0 });
    expect(findSegment(stops, 2)).toEqual({ index: 2, t: 1 });
  });

  it('locates the containing segment and local t', () => {
    const seg = findSegment(stops, 0.35);
    expect(seg.index).toBe(1);
    expect(seg.t).toBeCloseTo(0.5);
  });

  it('handles zero-length segments without NaN', () => {
    const seg = findSegment([0, 0.5, 0.5, 1], 0.5);
    expect(Number.isNaN(seg.t)).toBe(false);
  });
});

describe('resolveStops', () => {
  it('never decreases even if anchors are out of order', () => {
    const ranges = defaultRanges();
    const stops = resolveStops([at('mars', 0.5), at('moon', 0.5), at('saturn', 0)], ranges);
    expect(stops[1]).toBe(stops[0]);
    expect(stops[2]!).toBeGreaterThan(stops[1]!);
  });
});

describe('NumberTrack', () => {
  const ranges = defaultRanges();
  const p0 = resolveAnchor(at('sun', 0), ranges);
  const p1 = resolveAnchor(at('sun', 1), ranges);

  it('returns key values at key positions and clamps outside', () => {
    const track = new NumberTrack(
      [
        { at: at('sun', 0), value: 2 },
        { at: at('sun', 1), value: 4 },
      ],
      ranges,
    );
    expect(track.sample(p0)).toBe(2);
    expect(track.sample(p1)).toBe(4);
    expect(track.sample(0)).toBe(2);
    expect(track.sample(1)).toBe(4);
  });

  it('interpolates geometrically in log mode', () => {
    const track = new NumberTrack(
      [
        { at: at('sun', 0), value: 1, ease: linear },
        { at: at('sun', 1), value: 100 },
      ],
      ranges,
      'log',
    );
    expect(track.sample((p0 + p1) / 2)).toBeCloseTo(10);
  });

  it('supports a single key', () => {
    const track = new NumberTrack([{ at: at('earth', 0), value: 7 }], ranges);
    expect(track.sample(0.5)).toBe(7);
  });
});

describe('ColorTrack', () => {
  it('lerps colours between keys', () => {
    const ranges = defaultRanges();
    const track = new ColorTrack(
      [
        { at: at('moon', 0), value: new Color(0, 0, 0), ease: linear },
        { at: at('moon', 1), value: new Color(1, 1, 1) },
      ],
      ranges,
    );
    const mid = (resolveAnchor(at('moon', 0), ranges) + resolveAnchor(at('moon', 1), ranges)) / 2;
    expect(track.sample(mid).r).toBeCloseTo(0.5);
  });
});
