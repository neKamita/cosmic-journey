import type { Object3D, Vector3, WebGLRenderer } from 'three';
import type { Anchor } from '../camera/anchors';
import type { QualitySettings } from '../config/quality';
import type { AssetLibrary } from '../core/assets';
import type { FrameContext } from '../core/frame';

export interface InitContext {
  readonly renderer: WebGLRenderer;
  readonly quality: QualitySettings;
  readonly assets: AssetLibrary;
}

/** Region the sun's shadow camera should cover while this module is in focus. */
export interface ShadowFocus {
  readonly center: Vector3;
  readonly radius: number;
}

/**
 * One object of the journey (a planet, the starfield, the galaxy...). The director adds `root` to the
 * scene, hides it outside its active scroll interval and only calls `update` while it is visible.
 */
export interface SceneModule {
  readonly id: string;
  readonly root: Object3D;
  /** Scroll interval in which the module is rendered. Omit to keep it always active. */
  readonly active?: readonly [Anchor, Anchor];
  /** One-time GPU work (baking, shader warm-up helpers). */
  init?(ctx: InitContext): void | Promise<void>;
  update(ctx: FrameContext): void;
  setQuality?(quality: QualitySettings): void;
  shadowFocus?(): ShadowFocus | null;
}
