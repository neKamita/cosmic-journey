import { Color } from 'three';
import { at } from '../camera/anchors';
import { GALAXY } from '../config/layout';
import type { QualitySettings } from '../config/quality';
import type { FrameContext } from '../core/frame';
import { createRng, gaussian } from '../utils/math';
import type { SceneModule } from './SceneModule';
import { kelvinToColor } from './starfield';
import {
  CloudBuilder,
  createCloud,
  createDeepRoot,
  setCloudPixelRatio,
  updateCloud,
  type Cloud,
} from './shared/deepSpace';

const STARS = 120000;
const DUST = 16000;
const ARMS = 4;
const PITCH = (18 * Math.PI) / 180;
const BAR_ANGLE = (27 * Math.PI) / 180;

/**
 * The Milky Way as a barred spiral: bulge, bar, four logarithmic arms (two major, two minor) with
 * young blue stars and pink HII regions, a smooth old disk, and dust lanes on the inner arm edges.
 * Colour runs from the warm, old core to the blue outer arms.
 */
function buildStars(rng: () => number): CloudBuilder {
  const R = GALAXY.radius;
  const out = new CloudBuilder();
  const color = new Color();
  const warm = new Color(1, 0.8, 0.55);
  const young = new Color(0.62, 0.74, 1);
  const r0 = 0.1 * R;

  for (let i = 0; i < STARS; i++) {
    const kind = rng();
    if (kind < 0.13) {
      // Bulge: old, warm, slightly flattened.
      const x = gaussian(rng) * R * 0.085;
      const y = gaussian(rng) * R * 0.055;
      const z = gaussian(rng) * R * 0.085;
      color.copy(warm).multiplyScalar(0.8 + rng() * 0.5);
      out.push(x, y, z, color.r, color.g, color.b, 70 + rng() * 90, 0.45 + rng() * 0.5);
    } else if (kind < 0.21) {
      // Central bar.
      const t = (rng() * 2 - 1) * R * 0.22;
      const x = t + gaussian(rng) * R * 0.025;
      const z = gaussian(rng) * R * 0.03;
      const y = gaussian(rng) * R * 0.02;
      const c = Math.cos(BAR_ANGLE);
      const s = Math.sin(BAR_ANGLE);
      kelvinToColor(4200 + rng() * 1400, color).multiplyScalar(0.9);
      out.push(x * c - z * s, y, x * s + z * c, color.r, color.g, color.b, 60 + rng() * 70, 0.4 + rng() * 0.4);
    } else if (kind < 0.84) {
      // Spiral arms.
      const arm = Math.floor(rng() * ARMS);
      const major = arm % 2 === 0;
      const r = R * (0.11 + 0.89 * Math.pow(rng(), 0.9));
      const spread = (major ? 0.16 : 0.24) + 0.1 * (r / R);
      const offset = gaussian(rng) * spread;
      const theta = Math.log(r / r0) / Math.tan(PITCH) + (arm * Math.PI * 2) / ARMS + offset;
      const y = gaussian(rng) * R * (0.008 + 0.01 * (r / R));
      const onArm = Math.exp(-((offset / (spread * 0.45)) ** 2));
      const radial = r / R;
      color.copy(warm).lerp(young, Math.min(1, radial * 0.8 + onArm * 0.5));
      let size = 50 + rng() * 80;
      let bright = (0.35 + rng() * 0.55) * (major ? 1 : 0.75);
      if (onArm > 0.6 && rng() < 0.045) {
        // HII region: glowing hydrogen around newborn stars.
        color.setRGB(1, 0.36, 0.52);
        size *= 3.2;
        bright = 0.9;
      } else if (onArm > 0.5 && rng() < 0.08) {
        kelvinToColor(14000 + rng() * 12000, color);
        bright = 1;
      }
      out.push(r * Math.cos(theta), y, r * Math.sin(theta), color.r, color.g, color.b, size, bright);
    } else {
      // Smooth old disk between the arms.
      const r = Math.min(R * 1.05, -Math.log(1 - rng() * 0.98) * R * 0.28);
      const theta = rng() * Math.PI * 2;
      kelvinToColor(4600 + rng() * 2400, color).multiplyScalar(0.7);
      out.push(
        r * Math.cos(theta),
        gaussian(rng) * R * 0.015,
        r * Math.sin(theta),
        color.r,
        color.g,
        color.b,
        55 + rng() * 60,
        0.25 + rng() * 0.3,
      );
    }
  }
  return out;
}

function buildDust(rng: () => number): CloudBuilder {
  const R = GALAXY.radius;
  const out = new CloudBuilder();
  const r0 = 0.1 * R;
  for (let i = 0; i < DUST; i++) {
    const arm = Math.floor(rng() * ARMS);
    const r = R * (0.16 + 0.7 * rng());
    // Dust lanes trail on the inner (concave) edge of each arm.
    const theta = Math.log(r / r0) / Math.tan(PITCH) + (arm * Math.PI * 2) / ARMS - 0.16 + gaussian(rng) * 0.07;
    const shade = 0.03 + rng() * 0.03;
    out.push(
      r * Math.cos(theta),
      gaussian(rng) * R * 0.005,
      r * Math.sin(theta),
      shade * 1.4,
      shade,
      shade * 0.8,
      280 + rng() * 420,
      0.16 + rng() * 0.12,
    );
  }
  return out;
}

export class MilkyWay implements SceneModule {
  readonly id = 'milky-way';
  readonly root = createDeepRoot();
  readonly active = [at('heliopause', 0.55), at('universe', 1)] as const;
  private readonly stars: Cloud;
  private readonly dust: Cloud;

  constructor(quality: QualitySettings) {
    const rng = createRng(2026);
    // Stars are point sources: capping the sprite size keeps a fly-through looking like a starfield,
    // while from afar their density alone draws the galaxy.
    this.stars = createCloud(buildStars(rng).build(rng), { rotate: 0.0015, nearFade: [300, 1500], maxSize: 4 });
    this.dust = createCloud(buildDust(rng).build(rng), { dust: true, rotate: 0.0015, nearFade: [1200, 4000], maxSize: 48 });
    this.root.add(this.stars, this.dust);
    this.setQuality(quality);
  }

  setQuality(quality: QualitySettings): void {
    this.stars.geometry.setDrawRange(0, Math.floor(STARS * quality.particleScale));
    this.dust.geometry.setDrawRange(0, Math.floor(DUST * Math.max(0.4, quality.particleScale)));
  }

  setPixelRatio(dpr: number): void {
    setCloudPixelRatio(this.stars, dpr);
    setCloudPixelRatio(this.dust, dpr);
  }

  update(ctx: FrameContext): void {
    const scale = ctx.env.deepScale;
    this.root.scale.setScalar(scale);
    const opacity = ctx.env.galaxy;
    this.root.visible = opacity > 0.001;
    updateCloud(this.stars, ctx, opacity, scale);
    updateCloud(this.dust, ctx, opacity, scale);
  }
}
