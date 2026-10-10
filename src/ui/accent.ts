import type { Color } from 'three';

/** Mirrors the scroll-interpolated accent colour into the --accent CSS custom property. */
export class AccentColor {
  private hex = '';

  constructor(private readonly root: HTMLElement = document.documentElement) {}

  update(color: Color): void {
    const hex = `#${color.getHexString()}`;
    if (hex === this.hex) return;
    this.root.style.setProperty('--accent', hex);
    this.hex = hex;
  }
}
