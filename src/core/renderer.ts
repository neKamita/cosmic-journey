import {
  ACESFilmicToneMapping,
  NoToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from 'three';
import type { QualitySettings } from '../config/quality';

export interface ViewportSize {
  width: number;
  height: number;
  dpr: number;
}

export interface RenderCore {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly size: ViewportSize;
  /** Re-reads the canvas size; returns true when it changed. */
  resize(): boolean;
  applyQuality(quality: QualitySettings): void;
  /**
   * Shifts the projection so the camera target sits beside the text column: horizontally on wide
   * screens, upwards on portrait screens where text sits at the bottom.
   */
  applyFraming(frame: number): void;
}

export function createRenderCore(canvas: HTMLCanvasElement, quality: QualitySettings): RenderCore {
  const renderer = new WebGLRenderer({
    canvas,
    // MSAA comes from the composer when post-processing is on.
    antialias: !quality.postfx,
    alpha: false,
    stencil: false,
    depth: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 5000);
  const size: ViewportSize = { width: 0, height: 0, dpr: 1 };
  let maxDpr = quality.maxDpr;
  let currentFrame = Number.NaN;

  const core: RenderCore = {
    renderer,
    scene,
    camera,
    size,
    resize() {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      if (width === size.width && height === size.height && dpr === size.dpr) return false;
      size.width = width;
      size.height = height;
      size.dpr = dpr;
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const frame = currentFrame;
      currentFrame = Number.NaN;
      core.applyFraming(Number.isNaN(frame) ? 0 : frame);
      return true;
    },
    applyQuality(q) {
      maxDpr = q.maxDpr;
      renderer.toneMapping = q.postfx ? NoToneMapping : ACESFilmicToneMapping;
      renderer.shadowMap.enabled = q.shadows;
      renderer.shadowMap.needsUpdate = true;
      core.resize();
    },
    applyFraming(frame) {
      if (frame === currentFrame) return;
      currentFrame = frame;
      const { width, height } = size;
      const portrait = height > width * 1.05;
      const x = portrait ? 0 : -frame * width;
      const y = portrait ? 0.17 * height : 0;
      camera.setViewOffset(width, height, x, y, width, height);
    },
  };

  core.applyQuality(quality);
  return core;
}
