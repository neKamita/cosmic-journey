import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  NormalBlending,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import dustFrag from '../../shaders/galaxy/dust.frag';
import pointsFrag from '../../shaders/galaxy/points.frag';
import pointsVert from '../../shaders/galaxy/points.vert';
import { GALAXY } from '../../config/layout';
import type { FrameContext } from '../../core/frame';

/**
 * Deep-space frame shared by the galaxy, nebula, cluster and cosmic web: origin at the galactic
 * centre, +Y along the disk normal. The root is scaled by env.deepScale for the Powers-of-Ten zoom.
 */
const inverseOrientation = new Quaternion().copy(GALAXY.orientation).invert();

export function toDeepLocal(world: Vector3): Vector3 {
  return world.clone().sub(GALAXY.center).applyQuaternion(inverseOrientation);
}

export function createDeepRoot(): Group {
  const root = new Group();
  root.position.copy(GALAXY.center);
  root.quaternion.copy(GALAXY.orientation);
  return root;
}

/** Growable typed buffers for a particle cloud. */
export class CloudBuilder {
  readonly positions: number[] = [];
  readonly colors: number[] = [];
  readonly sizes: number[] = [];
  readonly brightness: number[] = [];

  push(x: number, y: number, z: number, r: number, g: number, b: number, size: number, bright: number): void {
    this.positions.push(x, y, z);
    this.colors.push(r, g, b);
    this.sizes.push(size);
    this.brightness.push(bright);
  }

  get count(): number {
    return this.sizes.length;
  }

  /** Builds the geometry with particles shuffled, so a draw range prefix is a fair subsample. */
  build(rng: () => number): BufferGeometry {
    const n = this.count;
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const brightness = new Float32Array(n);
    order.forEach((src, dst) => {
      for (let k = 0; k < 3; k++) {
        positions[dst * 3 + k] = this.positions[src * 3 + k]!;
        colors[dst * 3 + k] = this.colors[src * 3 + k]!;
      }
      sizes[dst] = this.sizes[src]!;
      brightness[dst] = this.brightness[src]!;
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geometry.setAttribute('aBright', new BufferAttribute(brightness, 1));
    geometry.computeBoundingSphere();
    return geometry;
  }
}

export interface CloudOptions {
  readonly dust?: boolean;
  readonly rotate?: number;
  readonly nearFade?: readonly [number, number];
  /** Largest on-screen sprite size in CSS pixels. */
  readonly maxSize?: number;
}

export type Cloud = Points<BufferGeometry, ShaderMaterial>;

export function createCloud(geometry: BufferGeometry, options: CloudOptions = {}): Cloud {
  const material = new ShaderMaterial({
    vertexShader: pointsVert,
    fragmentShader: options.dust ? dustFrag : pointsFrag,
    defines: options.rotate ? { ROTATE: '' } : {},
    blending: options.dust ? NormalBlending : AdditiveBlending,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uRotation: { value: options.rotate ?? 0 },
      uPixelRatio: { value: 1 },
      uProjection: { value: 900 },
      uOpacity: { value: 1 },
      uNearFade0: { value: options.nearFade?.[0] ?? 0 },
      uNearFade1: { value: options.nearFade?.[1] ?? 1 },
      uScale: { value: 1 },
      uMaxSize: { value: options.maxSize ?? 32 },
    },
  });
  const points = new Points(geometry, material);
  if (options.dust) points.renderOrder = 5;
  return points;
}

/** Per-frame uniforms shared by every deep-space cloud. */
export function updateCloud(cloud: Cloud, ctx: FrameContext, opacity: number, scale: number): void {
  const u = cloud.material.uniforms;
  u.uTime!.value = ctx.time;
  u.uOpacity!.value = opacity;
  u.uScale!.value = scale;
  u.uProjection!.value = ctx.viewportHeight / (2 * Math.tan((ctx.camera.fov * Math.PI) / 360));
}

export function setCloudPixelRatio(cloud: Cloud, dpr: number): void {
  cloud.material.uniforms.uPixelRatio!.value = dpr;
}
