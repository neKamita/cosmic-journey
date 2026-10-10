import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export interface RevealOptions {
  /** Opacity-only transitions (prefers-reduced-motion). */
  readonly reducedMotion: boolean;
  /** Skip blur filters, which are expensive on weak GPUs. */
  readonly lite: boolean;
}

/**
 * Scroll-scrubbed text transitions for every chapter: children of `.chapter__content` rise in with a
 * blur-to-sharp fade while the section scrolls into place, stay put while the sticky inner is
 * pinned, and drift up and blur out as the section leaves.
 */
export function initSectionReveal(sections: readonly HTMLElement[], options: RevealOptions): void {
  const blur = !options.reducedMotion && !options.lite;
  const move = !options.reducedMotion;

  const hidden = (direction: 1 | -1): gsap.TweenVars => ({
    opacity: 0,
    y: move ? 46 * direction : 0,
    filter: blur ? 'blur(12px)' : 'none',
  });
  const shown: gsap.TweenVars = { opacity: 1, y: 0, filter: blur ? 'blur(0px)' : 'none' };

  sections.forEach((section, index) => {
    const content = section.querySelector<HTMLElement>('.chapter__content');
    if (!content) return;
    const parts = Array.from(content.children) as HTMLElement[];
    const extras = Array.from(section.querySelectorAll<HTMLElement>('.scroll-hint'));
    const isFirst = index === 0;

    const timeline = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: section,
        start: isFirst ? 'top top' : 'top 72%',
        end: 'bottom 40%',
        scrub: options.reducedMotion ? true : 0.6,
        invalidateOnRefresh: true,
      },
    });

    // Timeline time is measured in viewport heights so tween lengths stay constant per section.
    const vh = (): number => window.innerHeight || 1;
    const span = (): number => (section.offsetHeight + (isFirst ? 0 : 0.72 * vh()) - 0.4 * vh()) / vh();
    const total = span();
    const fadeIn = 0.62;
    const fadeOut = 0.5;

    if (isFirst) {
      gsap.set(parts, shown);
      gsap.set(content, { '--scrim': 1 });
    } else {
      timeline.fromTo(parts, hidden(1), { ...shown, duration: fadeIn, stagger: 0.06 }, 0);
      timeline.fromTo(content, { '--scrim': 0 }, { '--scrim': 1, duration: fadeIn }, 0);
    }
    const outAt = Math.max(fadeIn + 0.1, total - fadeOut - 0.12);
    timeline.to(parts, { ...hidden(-1), duration: fadeOut, stagger: 0.03 }, outAt);
    timeline.to(content, { '--scrim': 0, duration: fadeOut }, outAt);
    if (extras.length) timeline.to(extras, { opacity: 0, duration: 0.25 }, 0);
    timeline.set({}, {}, total);
  });
}
