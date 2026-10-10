import { Color, Quaternion, Vector3 } from 'three';
import { at } from '../camera/anchors';
import type { QualitySettings } from '../config/quality';
import type { FrameContext } from '../core/frame';
import { createRng, gaussian } from '../utils/math';
import type { SceneModule } from './SceneModule';
import {
  CloudBuilder,
  createCloud,
  createDeepRoot,
  setCloudPixelRatio,
  updateCloud,
  type Cloud,
} from './shared/deepSpace';

type Kind = 'spiral' | 'elliptical' | 'irregular';

interface GalaxySpec {
  readonly center: Vector3;
  readonly radius: number;
  readonly normal: Vector3;
  readonly kind: Kind;
  readonly count: number;
}

const WARM = new Color(1, 0.8, 0.58);
const BLUE = new Color(0.6, 0.72, 1);

function addGalaxy(out: CloudBuilder, spec: GalaxySpec, rng: () => number): void {
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), spec.normal);
  const p = new Vector3();
  const c = new Color();
  const R = spec.radius;
  const arms = 2;
  const twist = 2.6 + rng() * 1.5;
  for (let i = 0; i < spec.count; i++) {
    let bright = 0.4 + rng() * 0.5;
    if (spec.kind === 'elliptical') {
      const s = Math.pow(rng(), 1.8);
      p.set(gaussian(rng), gaussian(rng) * 0.7, gaussian(rng)).multiplyScalar(R * 0.32 * (0.3 + s));
      c.copy(WARM).multiplyScalar(0.8 + rng() * 0.3);
    } else if (spec.kind === 'spiral') {
      if (rng() < 0.2) {
        p.set(gaussian(rng), gaussian(rng) * 0.5, gaussian(rng)).multiplyScalar(R * 0.1);
        c.copy(WARM);
      } else {
        const r = R * (0.08 + 0.92 * Math.pow(rng(), 0.8));
        const arm = Math.floor(rng() * arms);
        const theta = Math.log(r / (R * 0.08)) * twist * 0.35 + arm * Math.PI + gaussian(rng) * 0.3;
        p.set(r * Math.cos(theta), gaussian(rng) * R * 0.02, r * Math.sin(theta));
        c.copy(WARM).lerp(BLUE, Math.min(1, r / R + 0.2));
      }
    } else {
      p.set(gaussian(rng), gaussian(rng) * 0.4, gaussian(rng)).multiplyScalar(R * 0.35);
      p.x += (rng() - 0.5) * R * 0.6;
      c.copy(BLUE).lerp(WARM, rng() * 0.4);
      bright *= 0.8;
    }
    p.applyQuaternion(q).add(spec.center);
    out.push(p.x, p.y, p.z, c.r, c.g, c.b, R * (0.006 + rng() * 0.01), bright);
  }
  // A few large soft core particles keep distant galaxies visible as glowing smudges.
  for (let i = 0; i < 6; i++) {
    p.set(gaussian(rng), gaussian(rng) * 0.5, gaussian(rng)).multiplyScalar(R * 0.04).applyQuaternion(q).add(spec.center);
    out.push(p.x, p.y, p.z, WARM.r, WARM.g, WARM.b, R * 0.12, 0.35);
  }
}

/**
 * Neighbouring galaxies that appear as the Milky Way shrinks: a Local Group with an Andromeda-like
 * spiral and a richer cluster further out (deep-space local units, Milky Way radius ~2e4).
 */
export class GalaxyCluster implements SceneModule {
  readonly id = 'galaxy-cluster';
  readonly root = createDeepRoot();
  readonly active = [at('galaxy', 0.4), at('universe', 1)] as const;
  private readonly cloud: Cloud;
  private readonly total: number;

  constructor(quality: QualitySettings) {
    const rng = createRng(31415);
    const out = new CloudBuilder();
    const randomDir = (): Vector3 =>
      new Vector3(gaussian(rng), gaussian(rng) * 0.6, gaussian(rng)).normalize();

    addGalaxy(
      out,
      { center: new Vector3(0.55, 0.25, 0.8).normalize().multiplyScalar(420000), radius: 30000, normal: new Vector3(0.4, 0.8, 0.3).normalize(), kind: 'spiral', count: 7000 },
      rng,
    );
    for (let i = 0; i < 26; i++) {
      const roll = rng();
      const kind: Kind = roll < 0.42 ? 'spiral' : roll < 0.85 ? 'elliptical' : 'irregular';
      const distance = 180000 + Math.pow(rng(), 0.7) * 900000;
      addGalaxy(
        out,
        {
          center: randomDir().multiplyScalar(distance),
          radius: (kind === 'irregular' ? 5000 : 9000) + rng() * 18000,
          normal: randomDir(),
          kind,
          count: kind === 'spiral' ? 2600 : kind === 'elliptical' ? 1700 : 900,
        },
        rng,
      );
    }
    this.total = out.count;
    this.cloud = createCloud(out.build(rng), { nearFade: [0, 1], maxSize: 24 });
    this.root.add(this.cloud);
    this.setQuality(quality);
  }

  setQuality(quality: QualitySettings): void {
    this.cloud.geometry.setDrawRange(0, Math.floor(this.total * Math.max(0.4, quality.particleScale)));
  }

  setPixelRatio(dpr: number): void {
    setCloudPixelRatio(this.cloud, dpr);
  }

  update(ctx: FrameContext): void {
    const scale = ctx.env.deepScale;
    this.root.scale.setScalar(scale);
    const opacity = ctx.env.cluster;
    this.root.visible = opacity > 0.001;
    updateCloud(this.cloud, ctx, opacity, scale);
  }
}
