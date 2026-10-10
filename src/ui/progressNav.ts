import type { ChapterId } from '../config/chapters';
import type { ScrollController } from '../scroll/scrollController';

/**
 * Side progress indicator. Links are real in-page anchors (they work without JS); with JS a click
 * flies the camera there through the smooth scroller instead of jumping.
 */
export class ProgressNav {
  private readonly links = new Map<ChapterId, HTMLAnchorElement>();
  private active: ChapterId | null = null;
  private lastProgress = -1;

  constructor(
    private readonly list: HTMLElement,
    private readonly scroll: ScrollController,
  ) {
    for (const link of list.querySelectorAll<HTMLAnchorElement>('a[data-chapter]')) {
      this.links.set(link.dataset.chapter as ChapterId, link);
    }
    document.addEventListener('click', this.onClick);
  }

  update(chapter: ChapterId, progress: number): void {
    if (chapter !== this.active) {
      if (this.active) this.links.get(this.active)?.removeAttribute('aria-current');
      this.links.get(chapter)?.setAttribute('aria-current', 'step');
      this.active = chapter;
    }
    if (Math.abs(progress - this.lastProgress) > 0.0005) {
      this.list.style.setProperty('--progress', progress.toFixed(4));
      this.lastProgress = progress;
    }
  }

  private readonly onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[data-chapter]');
    if (!link) return;
    const id = link.dataset.chapter as ChapterId;
    event.preventDefault();
    this.scroll.scrollToChapter(id);
    history.replaceState(null, '', `#${id}`);
    // Move focus to the chapter heading for keyboard and screen reader users.
    const heading = document.querySelector<HTMLElement>(`section[data-chapter="${id}"] h1, section[data-chapter="${id}"] h2`);
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  };
}
