import { Color, Vector3 } from 'three';
import { at } from '../camera/anchors';
import { galacticPoint } from '../config/layout';
import type { QualitySettings } from '../config/quality';
import type { FrameContext } from '../core/frame';
import { createRng, gaussian } from '../utils/math';
import type { SceneModule } from './SceneModule';
import {
  CloudBuilder,
  createCloud,
  createDeepRoot,
  setCloudPixelRatio,
  toDeepLocal,
  updateCloud,
  type Cloud,
} from './shared/deepSpace';

const GAS = 7000;
const STARS = 260;
const DUST = 2200;

/** Emission-line palette: H-alpha red, [O III] teal, [S II] amber and blue reflection nebulosity. */
const PALETTE = [new Color(1, 0.24, 0.38), new Color(0.22, 0.85, 0.85), new Color(0.95, 0.5, 0.2), new Color(0.38, 0.55, 1)];

/**
 * A star-forming nebula beside the camera's path out of the galactic centre: clumpy glowing gas
 * in several emission colours, embedded young stars and dark dust.
 */
export class Nebula implements SceneModule {
  readonly id = 'nebula';
  readonly root = createDeepRoot();
  readonly active = [at('blackhole', 0.7), at('galaxy', 0.45)] as const;
  private readonly gas: Cloud;
  private readonly dust: Cloud;

  constructor(quality: QualitySettings) {
    const rng = createRng(1054);
    const center = toDeepLocal(galacticPoint(3900, 80, 15));
    const clumps = Array.from({ length: 14 }, (_, i) => ({
      center: new Vector3(gaussian(rng), gaussian(rng) * 0.6, gaussian(rng)).multiplyScalar(420).add(center),
      radius: 140 + rng() * 300,
      stretch: new Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize(),
      color: PALETTE[i % PALETTE.length]!,
    }));

    const gas = new CloudBuilder();
    const p = new Vector3();
    const c = new Color();
    for (let i = 0; i < GAS; i++) {
      const k = clumps[Math.floor(rng() * clumps.length)]!;
      const r = k.radius * (0.35 + rng() * 0.8);
      p.set(gaussian(rng), gaussian(rng), gaussian(rng)).multiplyScalar(r * 0.55);
      p.addScaledVector(k.stretch, gaussian(rng) * k.radius * 0.9).add(k.center);
      c.copy(k.color).lerp(PALETTE[(i * 7) % PALETTE.length]!, rng() * 0.25);
      gas.push(p.x, p.y, p.z, c.r, c.g, c.b, 140 + rng() * 140, 0.05 + rng() * 0.08);
    }
    for (let i = 0; i < STARS; i++) {
      const k = clumps[Math.floor(rng() * clumps.length)]!;
      p.set(gaussian(rng), gaussian(rng), gaussian(rng)).multiplyScalar(k.radius * 0.6).add(k.center);
      gas.push(p.x, p.y, p.z, 0.8, 0.88, 1, 22 + rng() * 26, 1);
    }
    this.gas = createCloud(gas.build(rng), { nearFade: [60, 400], maxSize: 64 });

    const dust = new CloudBuilder();
    for (let i = 0; i < DUST; i++) {
      const k = clumps[Math.floor(rng() * 5)]!;
      p.set(gaussian(rng), gaussian(rng) * 0.4, gaussian(rng)).multiplyScalar(k.radius * 0.7);
      p.addScaledVector(k.stretch, gaussian(rng) * k.radius).add(k.center);
      dust.push(p.x, p.y, p.z, 0.03, 0.022, 0.02, 160 + rng() * 160, 0.22 + rng() * 0.2);
    }
    this.dust = createCloud(dust.build(rng), { dust: true, nearFade: [60, 400], maxSize: 64 });
    this.root.add(this.gas, this.dust);
    this.setQuality(quality);
  }

  setQuality(quality: QualitySettings): void {
    const scale = Math.max(0.45, quality.particleScale);
    this.gas.geometry.setDrawRange(0, Math.floor((GAS + STARS) * scale));
    this.dust.geometry.setDrawRange(0, Math.floor(DUST * scale));
  }

  setPixelRatio(dpr: number): void {
    setCloudPixelRatio(this.gas, dpr);
    setCloudPixelRatio(this.dust, dpr);
  }

  update(ctx: FrameContext): void {
    const scale = ctx.env.deepScale;
    this.root.scale.setScalar(scale);
    const opacity = ctx.env.nebula;
    this.root.visible = opacity > 0.001;
    updateCloud(this.gas, ctx, opacity, scale);
    updateCloud(this.dust, ctx, opacity, scale);
  }
}
