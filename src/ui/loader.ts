/** Full-screen loading overlay with an accessible progress bar. */
export class LoaderScreen {
  private readonly fill: HTMLElement | null;
  private readonly value: HTMLElement | null;
  private readonly label: HTMLElement | null;
  private shown = 0;

  constructor(private readonly root: HTMLElement) {
    this.fill = root.querySelector('#loader-fill');
    this.value = root.querySelector('#loader-value');
    this.label = root.querySelector('#loader-label');
    document.getElementById('journey')?.setAttribute('aria-busy', 'true');
  }

  /** fraction 0..1; never moves backwards. */
  setProgress(fraction: number, label?: string): void {
    const pct = Math.round(Math.min(1, Math.max(this.shown, fraction)) * 100);
    this.shown = pct / 100;
    this.root.setAttribute('aria-valuenow', String(pct));
    if (this.fill) this.fill.style.transform = `scaleX(${this.shown})`;
    if (this.value) this.value.textContent = String(pct);
    if (label && this.label) this.label.textContent = label;
  }

  done(): void {
    this.setProgress(1, 'готово');
    this.root.classList.add('is-done');
    this.root.setAttribute('aria-hidden', 'true');
    document.getElementById('journey')?.removeAttribute('aria-busy');
  }
}
