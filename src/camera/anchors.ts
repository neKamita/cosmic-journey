import { CHAPTERS, type ChapterId } from '../config/chapters';
import { clamp, lerp } from '../utils/math';

/** A position on the scroll timeline expressed relative to a chapter (t = 0..1 of its scroll span). */
export interface Anchor {
  readonly chapter: ChapterId;
  readonly t: number;
}

export const at = (chapter: ChapterId, t: number): Anchor => ({ chapter, t });

/** Global progress interval [start, end) per chapter. The last chapter's end may exceed 1. */
export type ChapterRanges = Readonly<Record<ChapterId, readonly [number, number]>>;

/**
 * Chapter i spans from the moment its section top reaches the viewport top to the moment the next
 * section's top does. `tops` and `heights` are in any consistent unit; `scrollable` is the total
 * scroll distance of the journey (container height minus one viewport).
 */
export function rangesFromGeometry(
  tops: readonly number[],
  heights: readonly number[],
  scrollable: number,
): ChapterRanges {
  const ranges = {} as Record<ChapterId, readonly [number, number]>;
  CHAPTERS.forEach((c, i) => {
    const top = tops[i] ?? 0;
    const height = heights[i] ?? 0;
    ranges[c.id] = [top / scrollable, (top + height) / scrollable] as const;
  });
  return ranges;
}

/** Ranges derived from the configured section lengths (viewport units), used before DOM measurement. */
export function defaultRanges(): ChapterRanges {
  const tops: number[] = [];
  let acc = 0;
  for (const c of CHAPTERS) {
    tops.push(acc);
    acc += c.len;
  }
  return rangesFromGeometry(
    tops,
    CHAPTERS.map((c) => c.len),
    acc - 1,
  );
}

export function resolveAnchor(anchor: Anchor, ranges: ChapterRanges): number {
  const [start, end] = ranges[anchor.chapter];
  return clamp(lerp(start, end, anchor.t));
}

/** Chapter containing global progress p and the chapter-local position within it. */
export function chapterAt(p: number, ranges: ChapterRanges): { id: ChapterId; local: number; index: number } {
  for (let i = CHAPTERS.length - 1; i >= 0; i--) {
    const c = CHAPTERS[i]!;
    const [start, end] = ranges[c.id];
    if (p >= start || i === 0) {
      return { id: c.id, local: clamp((p - start) / (end - start)), index: i };
    }
  }
  return { id: CHAPTERS[0].id, local: 0, index: 0 };
}
