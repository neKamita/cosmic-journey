/**
 * Single source of truth for the journey's chapters. Order matches the <section> order in index.html.
 * `len` is the section height in viewport heights; `focus` is the chapter-local scroll position
 * (0..1) where the camera has arrived at the object and the text is fully visible.
 */
export const CHAPTERS = [
  { id: 'earth', title: 'Земля', accent: '#4da3ff', len: 2, focus: 0, side: 'left' },
  { id: 'moon', title: 'Луна', accent: '#c9ccd6', len: 2, focus: 0.18, side: 'right' },
  { id: 'sun', title: 'Солнце', accent: '#ffb547', len: 2.5, focus: 0.18, side: 'left' },
  { id: 'inner', title: 'Меркурий и Венера', accent: '#e3b26b', len: 2.5, focus: 0.16, side: 'right' },
  { id: 'mars', title: 'Марс', accent: '#e0603a', len: 2.5, focus: 0.18, side: 'left' },
  { id: 'asteroids', title: 'Пояс астероидов', accent: '#a89f91', len: 2.5, focus: 0.18, side: 'right' },
  { id: 'jupiter', title: 'Юпитер', accent: '#d9a77a', len: 2.5, focus: 0.18, side: 'left' },
  { id: 'saturn', title: 'Сатурн', accent: '#e8d3a2', len: 3, focus: 0.14, side: 'right' },
  { id: 'ice', title: 'Уран и Нептун', accent: '#7fd6e8', len: 2.5, focus: 0.14, side: 'left' },
  { id: 'heliopause', title: 'Граница системы', accent: '#b8c4ff', len: 2.5, focus: 0.2, side: 'right' },
  { id: 'blackhole', title: 'Чёрная дыра', accent: '#ff7a3d', len: 3, focus: 0.18, side: 'left' },
  { id: 'galaxy', title: 'Млечный Путь', accent: '#c7a8ff', len: 3.5, focus: 0.3, side: 'right' },
  { id: 'universe', title: 'Вселенная', accent: '#8ab4ff', len: 2.5, focus: 0.3, side: 'left' },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]['id'];
export type ChapterMeta = (typeof CHAPTERS)[number];

export const CHAPTER_IDS: readonly ChapterId[] = CHAPTERS.map((c) => c.id);

export function chapterMeta(id: ChapterId): ChapterMeta {
  const meta = CHAPTERS.find((c) => c.id === id);
  if (!meta) throw new Error(`Unknown chapter: ${id}`);
  return meta;
}
