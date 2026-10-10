import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { defaultRanges, rangesFromGeometry, resolveAnchor, type ChapterRanges } from '../camera/anchors';
import { CHAPTERS, chapterMeta, type ChapterId } from '../config/chapters';
import { clamp } from '../utils/math';

gsap.registerPlugin(ScrollTrigger);

const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Owns scrolling: Lenis smoothing (unless reduced motion), the global journey progress and the
 * mapping between chapters and progress, re-measured from the DOM on every ScrollTrigger refresh.
 */
export class ScrollController {
  ranges: ChapterRanges = defaultRanges();

  private lenis: Lenis | null = null;
  private readonly sections: HTMLElement[];
  private mainTop = 0;
  private scrollable = 1;
  private readonly listeners = new Set<(ranges: ChapterRanges) => void>();

  constructor(
    private readonly main: HTMLElement,
    private readonly smooth: boolean,
  ) {
    this.sections = CHAPTERS.map((c) => {
      const el = main.querySelector<HTMLElement>(`section[data-chapter="${c.id}"]`);
      if (!el) throw new Error(`Missing section for chapter "${c.id}"`);
      // The config is the source of truth; inline --len values in HTML are the no-JS fallback.
      el.style.setProperty('--len', String(c.len));
      return el;
    });
  }

  init(): void {
    ScrollTrigger.config({ ignoreMobileResize: true });
    if (this.smooth) {
      this.lenis = new Lenis({ autoRaf: false, lerp: 0.085, smoothWheel: true, syncTouch: false });
      this.lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(this.raf);
    }
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.addEventListener('refresh', this.measure);
    this.measure();
    void document.fonts?.ready.then(() => ScrollTrigger.refresh());
  }

  onMeasure(listener: (ranges: ChapterRanges) => void): () => void {
    this.listeners.add(listener);
    listener(this.ranges);
    return () => this.listeners.delete(listener);
  }

  /** Global journey progress 0..1, following the smoothed scroll position. */
  get progress(): number {
    return clamp((window.scrollY - this.mainTop) / this.scrollable);
  }

  /** Scroll velocity in progress units per second (signed), 0 without Lenis. */
  get velocity(): number {
    return this.lenis ? (this.lenis.velocity * 60) / this.scrollable : 0;
  }

  scrollToProgress(p: number, immediate = false): void {
    const y = this.mainTop + clamp(p) * this.scrollable;
    if (this.lenis) {
      const distance = Math.abs(p - this.progress);
      this.lenis.scrollTo(y, {
        immediate,
        duration: clamp(1.1 + distance * 5, 1.1, 4.5),
        easing: easeInOutCubic,
      });
    } else {
      window.scrollTo({ top: y, behavior: 'auto' });
    }
  }

  scrollToChapter(id: ChapterId, immediate = false): void {
    this.scrollToProgress(this.chapterFocus(id), immediate);
  }

  /** Progress at which a chapter's object is in focus and its text is fully shown. */
  chapterFocus(id: ChapterId): number {
    return resolveAnchor({ chapter: id, t: chapterMeta(id).focus }, this.ranges);
  }

  stop(): void {
    this.lenis?.stop();
  }

  start(): void {
    this.lenis?.start();
  }

  private readonly raf = (time: number): void => {
    this.lenis?.raf(time * 1000);
  };

  private readonly measure = (): void => {
    const scrollY = window.scrollY;
    this.mainTop = this.main.getBoundingClientRect().top + scrollY;
    const tops = this.sections.map((s) => s.getBoundingClientRect().top + scrollY - this.mainTop);
    const heights = this.sections.map((s) => s.offsetHeight);
    this.scrollable = Math.max(1, this.main.offsetHeight - window.innerHeight);
    this.ranges = rangesFromGeometry(tops, heights, this.scrollable);
    for (const listener of this.listeners) listener(this.ranges);
  };
}
