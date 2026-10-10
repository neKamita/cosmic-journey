import { Color, Vector3 } from 'three';
import { at } from '../camera/anchors';
import type { QualitySettings } from '../config/quality';
import type { FrameContext } from '../core/frame';
import { createRng, gaussian, smoothstep } from '../utils/math';
import type { SceneModule } from './SceneModule';
import {
  CloudBuilder,
  createCloud,
  createDeepRoot,
  setCloudPixelRatio,
  updateCloud,
  type Cloud,
} from './shared/deepSpace';

const HALF_SIZE = 5.2e6;
const NODES = 220;
const NEIGHBOURS = 3;
const FILAMENT_POINTS = 95000;
const NODE_POINTS = 26000;

/**
 * The cosmic web: galaxy clusters (nodes) joined by filaments, with voids in between. Built from
 * random nodes, each linked to its nearest neighbours, with points scattered along the links.
 * Our galaxy sits on the node at the origin.
 */
export class CosmicWeb implements SceneModule {
  readonly id = 'cosmic-web';
  readonly root = createDeepRoot();
  readonly active = [at('galaxy', 0.75), at('universe', 1)] as const;
  private readonly cloud: Cloud;
  private readonly total: number;

  constructor(quality: QualitySettings) {
    const rng = createRng(13800);
    // Nodes fill a sphere around us: the observable universe is a sphere centred on the observer.
    const nodes: Vector3[] = [new Vector3(0, 0, 0)];
    while (nodes.length < NODES) {
      const candidate = new Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
      if (candidate.lengthSq() <= 1) nodes.push(candidate.multiplyScalar(HALF_SIZE));
    }

    const edges: Array<[Vector3, Vector3]> = [];
    const seen = new Set<string>();
    nodes.forEach((a, i) => {
      const nearest = nodes
        .map((b, j) => ({ j, d: a.distanceToSquared(b) }))
        .filter((e) => e.j !== i)
        .sort((x, y) => x.d - y.d)
        .slice(0, NEIGHBOURS);
      for (const { j, d } of nearest) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key) || Math.sqrt(d) > HALF_SIZE * 0.75) continue;
        seen.add(key);
        edges.push([a, nodes[j]!]);
      }
    });
    const totalLength = edges.reduce((sum, [a, b]) => sum + a.distanceTo(b), 0);

    const out = new CloudBuilder();
    const p = new Vector3();
    const dir = new Vector3();
    const side = new Vector3();
    const up = new Vector3();
    const filament = new Color(0.5, 0.56, 1);
    const cluster = new Color(1, 0.86, 0.72);
    const c = new Color();

    for (const [a, b] of edges) {
      const length = a.distanceTo(b);
      const count = Math.round((length / totalLength) * FILAMENT_POINTS);
      dir.subVectors(b, a).normalize();
      side.set(dir.z, 0, -dir.x);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize();
      up.crossVectors(dir, side).normalize();
      for (let i = 0; i < count; i++) {
        const t = rng();
        // Filaments are thickest midway and pinch into the clusters at both ends.
        const width = (0.018 * length + 2.5e4) * (0.35 + Math.sin(t * Math.PI));
        p.copy(a)
          .lerp(b, t)
          .addScaledVector(side, gaussian(rng) * width)
          .addScaledVector(up, gaussian(rng) * width);
        c.copy(filament).multiplyScalar(0.55 + rng() * 0.6);
        out.push(p.x, p.y, p.z, c.r, c.g, c.b, 2.2e4 + rng() * 2.4e4, 0.35 + rng() * 0.45);
      }
    }
    for (let i = 0; i < NODE_POINTS; i++) {
      const node = nodes[Math.floor(rng() * nodes.length)]!;
      const sigma = 4e4 + rng() * 1.1e5;
      p.set(gaussian(rng), gaussian(rng), gaussian(rng)).multiplyScalar(sigma).add(node);
      c.copy(cluster).lerp(filament, rng() * 0.35);
      out.push(p.x, p.y, p.z, c.r, c.g, c.b, 2.6e4 + rng() * 3e4, 0.5 + rng() * 0.5);
    }

    this.total = out.count;
    this.cloud = createCloud(out.build(rng), { nearFade: [0, 1], maxSize: 14 });
    this.root.add(this.cloud);
    this.setQuality(quality);
  }

  setQuality(quality: QualitySettings): void {
    this.cloud.geometry.setDrawRange(0, Math.floor(this.total * Math.max(0.35, quality.particleScale)));
  }

  setPixelRatio(dpr: number): void {
    setCloudPixelRatio(this.cloud, dpr);
  }

  update(ctx: FrameContext): void {
    const scale = ctx.env.deepScale;
    this.root.scale.setScalar(scale);
    // Only once everything has shrunk enough for the web to read as a structure, not as blobs.
    const opacity = ctx.env.web * (1 - smoothstep(0.006, 0.02, scale));
    this.root.visible = opacity > 0.001;
    updateCloud(this.cloud, ctx, opacity, scale);
  }
}
