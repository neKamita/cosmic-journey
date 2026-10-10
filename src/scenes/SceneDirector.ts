import { AmbientLight, DirectionalLight, Vector3, type Scene } from 'three';
import { resolveAnchor, type ChapterRanges } from '../camera/anchors';
import type { QualitySettings } from '../config/quality';
import { SUN } from '../config/layout';
import type { FrameContext } from '../core/frame';
import type { InitContext, SceneModule, ShadowFocus } from './SceneModule';

interface Entry {
  readonly module: SceneModule;
  range: readonly [number, number] | null;
}

/**
 * Owns the scene graph composition: module visibility by scroll range, per-frame updates of visible
 * modules only, and the single directional "sun" light that always points from the Sun towards the
 * object in focus.
 */
export class SceneDirector {
  readonly sunLight = new DirectionalLight(0xfff4e8, 3.4);
  readonly ambient = new AmbientLight(0xa8b4d0, 0.035);

  private readonly entries: Entry[] = [];
  private readonly lightDir = new Vector3();

  constructor(
    private readonly scene: Scene,
    quality: QualitySettings,
  ) {
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.castShadow = quality.shadows;
    this.sunLight.shadow.mapSize.setScalar(quality.shadowMapSize);
    scene.add(this.sunLight, this.sunLight.target, this.ambient);
  }

  add(module: SceneModule): void {
    this.scene.add(module.root);
    this.entries.push({ module, range: null });
  }

  get modules(): readonly SceneModule[] {
    return this.entries.map((e) => e.module);
  }

  async init(ctx: InitContext): Promise<void> {
    await Promise.all(this.entries.map((e) => e.module.init?.(ctx)));
  }

  resolve(ranges: ChapterRanges): void {
    for (const entry of this.entries) {
      const active = entry.module.active;
      entry.range = active ? [resolveAnchor(active[0], ranges), resolveAnchor(active[1], ranges)] : null;
      entry.module.resolve?.(ranges);
    }
  }

  /** Makes every module visible, e.g. to compile all shaders up front. Next update() restores. */
  showAll(): void {
    for (const entry of this.entries) entry.module.root.visible = true;
  }

  update(ctx: FrameContext): void {
    const p = ctx.progress;
    let focus: ShadowFocus | null = null;
    let focusDistance = Infinity;

    for (const entry of this.entries) {
      const visible = !entry.range || (p >= entry.range[0] && p <= entry.range[1]);
      entry.module.root.visible = visible;
      if (!visible) continue;
      entry.module.update(ctx);
      const f = entry.module.shadowFocus?.();
      if (f) {
        const d = f.center.distanceTo(ctx.cameraTarget);
        if (d < focusDistance) {
          focus = f;
          focusDistance = d;
        }
      }
    }

    this.updateLight(ctx, focus);
  }

  setQuality(quality: QualitySettings): void {
    // castShadow is left untouched when possible: toggling it recompiles every lit material.
    this.sunLight.castShadow = quality.shadows;
    if (this.sunLight.shadow.mapSize.x !== quality.shadowMapSize) {
      this.sunLight.shadow.mapSize.setScalar(quality.shadowMapSize);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
    }
    for (const entry of this.entries) entry.module.setQuality?.(quality);
  }

  setPixelRatio(dpr: number): void {
    for (const entry of this.entries) entry.module.setPixelRatio?.(dpr);
  }

  private updateLight(ctx: FrameContext, focus: ShadowFocus | null): void {
    const center = focus?.center ?? ctx.cameraTarget;
    this.lightDir.copy(center).sub(SUN.position);
    // Looking at the Sun itself: light whatever is between it and the camera.
    if (this.lightDir.lengthSq() < (SUN.radius * 3) ** 2) this.lightDir.copy(ctx.camera.position).sub(SUN.position);
    this.lightDir.normalize();

    const radius = focus?.radius ?? 40;
    this.sunLight.target.position.copy(center);
    this.sunLight.position.copy(center).addScaledVector(this.lightDir, -(radius * 2 + 10));
    // The shadow map keeps rendering even without a focus: an unrendered map leaves the shadow
    // sampler unbound and makes every lit draw call fail. Only castShadow meshes are drawn into it.
    if (focus && this.sunLight.castShadow) {
      const cam = this.sunLight.shadow.camera;
      cam.left = -radius;
      cam.right = radius;
      cam.top = radius;
      cam.bottom = -radius;
      cam.near = radius * 0.5;
      cam.far = radius * 4 + 20;
      cam.updateProjectionMatrix();
    }
    this.ambient.intensity = ctx.env.ambient;
  }
}
