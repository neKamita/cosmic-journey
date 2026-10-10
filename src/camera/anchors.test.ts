import { describe, expect, it } from 'vitest';
import { at, chapterAt, defaultRanges, rangesFromGeometry, resolveAnchor } from './anchors';
import { CHAPTERS } from '../config/chapters';

describe('rangesFromGeometry', () => {
  it('maps section tops to progress so chapters tile the journey', () => {
    const ranges = rangesFromGeometry(
      CHAPTERS.map((_, i) => i * 200),
      CHAPTERS.map(() => 200),
      CHAPTERS.length * 200 - 100,
    );
    const first = ranges.earth;
    const second = ranges.moon;
    expect(first[0]).toBe(0);
    expect(first[1]).toBeCloseTo(second[0]);
  });
});

describe('defaultRanges', () => {
  it('starts at 0 and puts the end of the scroll inside the last chapter', () => {
    const ranges = defaultRanges();
    expect(ranges.earth[0]).toBe(0);
    const [start, end] = ranges.universe;
    expect(start).toBeLessThan(1);
    expect(end).toBeGreaterThan(1);
  });

  it('produces non-decreasing chapter starts in configured order', () => {
    const ranges = defaultRanges();
    const starts = CHAPTERS.map((c) => ranges[c.id][0]);
    for (let i = 1; i < starts.length; i++) expect(starts[i]!).toBeGreaterThan(starts[i - 1]!);
  });
});

describe('resolveAnchor', () => {
  it('interpolates within the chapter and clamps to [0, 1]', () => {
    const ranges = defaultRanges();
    const [s, e] = ranges.moon;
    expect(resolveAnchor(at('moon', 0.5), ranges)).toBeCloseTo((s + e) / 2);
    expect(resolveAnchor(at('universe', 1), ranges)).toBe(1);
  });
});

describe('chapterAt', () => {
  it('finds the chapter and local position for a progress value', () => {
    const ranges = defaultRanges();
    const [s, e] = ranges.saturn;
    const hit = chapterAt(s + (e - s) * 0.25, ranges);
    expect(hit.id).toBe('saturn');
    expect(hit.local).toBeCloseTo(0.25);
  });

  it('returns the first chapter at progress 0 and the last at 1', () => {
    const ranges = defaultRanges();
    expect(chapterAt(0, ranges).id).toBe('earth');
    expect(chapterAt(1, ranges).id).toBe('universe');
  });
});
