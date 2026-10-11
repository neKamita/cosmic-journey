/** Lets the browser paint and handle input before continuing a long start-up sequence. */
export function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler?.yield) return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Resolves once the element has a non-zero layout box. A page embedded in a hidden iframe (for
 * example a preview modal that shows the frame only after it loads) has no layout yet, and
 * measuring it then would size the canvas to 1x1 and collapse every scroll range.
 */
export function whenLaidOut(element: Element): Promise<void> {
  return new Promise((resolve) => {
    const observer = new ResizeObserver((entries) => {
      if (entries.some((e) => e.contentRect.width > 0 && e.contentRect.height > 0)) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(element);
  });
}

/** Resolves when the main thread is idle (or after `timeout` ms at the latest). */
export function whenIdle(timeout = 600): Promise<void> {
  return new Promise((resolve) => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => resolve(), { timeout });
    else setTimeout(resolve, 60);
  });
}
