import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import dustVert from '../shaders/asteroids/dust.vert';
import spinChunk from '../shaders/asteroids/spin.glsl';
import starFrag from '../shaders/stars/star.frag';
import { at } from '../camera/anchors';
import { BELT, polar } from '../config/layout';
import type { QualitySettings } from '../config/quality';
import type { FrameContext } from '../core/frame';
import { createRng, gaussian } from '../utils/math';
import type { SceneModule } from './SceneModule';
import { patchMaterial } from './shared/planet';

const SHAPES = 4;
const SECTORS = 16;
const MAX_ROCKS = 4200;
const DUST_COUNT = 22000;
/** Longitude around which the camera crosses the belt; rocks are densest there. */
const PATH_THETA = -0.18;
/**
 * Segments kept clear of rocks: the camera's path through the belt (matches the asteroid chapter
 * keys) and the line of sight from the hover point to the comet.
 */
const CLEAR_SEGMENTS: ReadonlyArray<readonly [Vector3, Vector3]> = [
  [polar(735, -0.26, 10), polar(800, -0.2, 5)],
  [polar(800, -0.2, 5), polar(905, -0.12, 0)],
  [polar(800, -0.2, 5), polar(845, 0.02, 22)],
];

/** Lumpy rock: an icosphere displaced by a few random low-frequency waves. */
function createRockGeometry(seed: number): BufferGeometry {
  const rng = createRng(1000 + seed);
  let geometry: BufferGeometry = new IcosahedronGeometry(1, 4);
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  geometry = mergeVertices(geometry);

  const waves = Array.from({ length: 12 }, (_, i) => ({
    dir: new Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize(),
    freq: 1.1 + i * 1.5 + rng(),
    amp: 0.18 / (1 + i * i * 0.18),
    phase: rng() * Math.PI * 2,
  }));
  const squash = new Vector3(0.8 + rng() * 0.4, 0.65 + rng() * 0.3, 0.85 + rng() * 0.35);

  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const v = new Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).normalize();
    let d = 1;
    for (const w of waves) d += w.amp * Math.sin(v.dot(w.dir) * w.freq * 3 + w.phase);
    // Occasional crater-like dents.
    d -= 0.12 * Math.max(0, Math.sin(v.x * 9 + seed) * Math.sin(v.y * 7 - seed) * Math.sin(v.z * 8)) ** 3;
    v.multiplyScalar(d).multiply(squash);
    position.setXYZ(i, v.x, v.y, v.z);
    const shade = 0.78 + 0.22 * Math.sin(v.x * 5.3 + v.y * 3.1 + seed) * Math.cos(v.z * 4.7);
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Distance to the nearest clear segment and the closest point on it. */
function nearestClearPoint(p: Vector3, closest: Vector3): number {
  let best = Infinity;
  const ab = new Vector3();
  const ap = new Vector3();
  for (const [a, b] of CLEAR_SEGMENTS) {
    ab.subVectors(b, a);
    ap.subVectors(p, a);
    const t = Math.min(1, Math.max(0, ap.dot(ab) / ab.lengthSq()));
    const point = a.clone().addScaledVector(ab, t);
    const d = point.distanceTo(p);
    if (d < best) {
      best = d;
      closest.copy(point);
    }
  }
  return best;
}

/** Linear albedos of carbonaceous (C), stony (S) and metallic (M) asteroids: they are dark. */
const ROCK_COLORS = [new Color(0.05, 0.048, 0.045), new Color(0.14, 0.095, 0.065), new Color(0.17, 0.17, 0.18)];

/** The main belt: instanced rocks in angular sectors (so frustum culling works) plus distant specks. */
export class AsteroidBelt implements SceneModule {
  readonly id = 'asteroids';
  readonly root = new Group();
  readonly active = [at('mars', 0.55), at('jupiter', 0.35)] as const;

  private readonly sectors: Array<{ mesh: InstancedMesh; total: number }> = [];
  private readonly dust: Points<BufferGeometry, ShaderMaterial>;
  private readonly uniforms = { uTime: { value: 0 } };

  constructor(quality: QualitySettings) {
    const material = patchMaterial(
      new MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0.04 }),
      {
        key: 'asteroid-spin',
        uniforms: this.uniforms,
        vertex: [
          ['#include <common>', `#include <common>\n${spinChunk}`],
          [
            '#include <beginnormal_vertex>',
            `#include <beginnormal_vertex>
            mat3 spinRotation = axisRotation(aSpin.xyz, aPhase + uTime * aSpin.w);
            objectNormal = spinRotation * objectNormal;`,
          ],
          ['#include <begin_vertex>', '#include <begin_vertex>\ntransformed = spinRotation * transformed;'],
        ],
      },
    );

    const shapes = Array.from({ length: SHAPES }, (_, i) => createRockGeometry(i));
    const span = (BELT.thetaEnd - BELT.thetaStart) / SECTORS;
    const weights = Array.from({ length: SECTORS }, (_, i) => {
      const center = BELT.thetaStart + (i + 0.5) * span;
      return 0.2 + Math.exp(-(((center - PATH_THETA) / 0.13) ** 2));
    });
    const weightSum = weights.reduce((a, b) => a + b, 0);

    const rng = createRng(77);
    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    const euler = new Euler();
    const color = new Color();
    const axis = new Vector3();
    const closest = new Vector3();
    const away = new Vector3();

    for (let s = 0; s < SECTORS; s++) {
      const count = Math.max(8, Math.round((weights[s]! / weightSum) * MAX_ROCKS));
      const geometry = shapes[s % SHAPES]!.clone();
      const spin = new Float32Array(count * 4);
      const phase = new Float32Array(count);
      const mesh = new InstancedMesh(geometry, material, count);

      for (let i = 0; i < count; i++) {
        const theta = BELT.thetaStart + (s + rng()) * span;
        const r = BELT.inner + (BELT.outer - BELT.inner) * (rng() + rng()) * 0.5;
        position.copy(polar(r, theta, gaussian(rng) * BELT.thickness * 0.5));
        // Size distribution: mostly pebbles and boulders, rare large bodies.
        const size = 0.12 + Math.pow(rng(), 7) * 3.6 + rng() * 0.25;
        // Keep the camera's corridor and the view of the comet clear: push rocks radially out of it.
        const needed = size * 3 + 5;
        const distance = nearestClearPoint(position, closest);
        if (distance < needed) {
          away.subVectors(position, closest);
          if (away.lengthSq() < 1e-6) away.set(0, 1, 0);
          position.copy(closest).addScaledVector(away.normalize(), needed + rng() * 2);
        }

        euler.set(rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2);
        quaternion.setFromEuler(euler);
        scale.set(size * (0.75 + rng() * 0.5), size * (0.65 + rng() * 0.45), size * (0.8 + rng() * 0.5));
        mesh.setMatrixAt(i, matrix.compose(position, quaternion, scale));

        const base = ROCK_COLORS[Math.floor(rng() * ROCK_COLORS.length)]!;
        mesh.setColorAt(i, color.copy(base).multiplyScalar(0.8 + rng() * 0.45));

        axis.set(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize();
        spin[i * 4] = axis.x;
        spin[i * 4 + 1] = axis.y;
        spin[i * 4 + 2] = axis.z;
        spin[i * 4 + 3] = (0.04 + rng() * 0.5) / Math.sqrt(size + 0.3);
        phase[i] = rng() * Math.PI * 2;
      }
      geometry.setAttribute('aSpin', new InstancedBufferAttribute(spin, 4));
      geometry.setAttribute('aPhase', new InstancedBufferAttribute(phase, 1));
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.sectors.push({ mesh, total: count });
      this.root.add(mesh);
    }

    this.dust = this.createDust();
    this.root.add(this.dust);
    this.setQuality(quality);
  }

  setQuality(quality: QualitySettings): void {
    for (const { mesh, total } of this.sectors) mesh.count = Math.max(1, Math.floor(total * quality.particleScale));
    this.dust.geometry.setDrawRange(0, Math.floor(DUST_COUNT * quality.particleScale));
  }

  setPixelRatio(dpr: number): void {
    this.dust.material.uniforms.uPixelRatio!.value = dpr;
  }

  update(ctx: FrameContext): void {
    this.uniforms.uTime.value = ctx.time;
  }

  private createDust(): Points<BufferGeometry, ShaderMaterial> {
    const rng = createRng(91);
    const positions = new Float32Array(DUST_COUNT * 3);
    const colors = new Float32Array(DUST_COUNT * 3);
    const sizes = new Float32Array(DUST_COUNT);
    const bright = new Float32Array(DUST_COUNT);
    const color = new Color();
    for (let i = 0; i < DUST_COUNT; i++) {
      const theta = BELT.thetaStart - 0.3 + rng() * (BELT.thetaEnd - BELT.thetaStart + 0.6);
      const r = BELT.inner - 20 + (BELT.outer - BELT.inner + 40) * (rng() + rng()) * 0.5;
      polar(r, theta, gaussian(rng) * BELT.thickness * 0.7).toArray(positions, i * 3);
      color.copy(ROCK_COLORS[i % ROCK_COLORS.length]!).multiplyScalar(6).toArray(colors, i * 3);
      sizes[i] = 0.5 + rng() * 1.2;
      bright[i] = 0.3 + rng() * 0.7;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geometry.setAttribute('aBright', new BufferAttribute(bright, 1));
    geometry.computeBoundingSphere();
    const material = new ShaderMaterial({
      vertexShader: dustVert,
      fragmentShader: starFrag,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      uniforms: { uPixelRatio: { value: 1 }, uOpacity: { value: 0.9 } },
    });
    return new Points(geometry, material);
  }
}
