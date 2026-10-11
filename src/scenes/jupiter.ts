import { Group, Mesh, MeshStandardMaterial, Vector2, type SphereGeometry } from 'three';
import flowChunk from '../shaders/jupiter/flow.glsl';
import galilean from '../shaders/planets/galilean.glsl';
import surface from '../shaders/planets/jupiter.glsl';
import { at, resolveAnchor, type ChapterRanges } from '../camera/anchors';
import { JUPITER, SUN } from '../config/layout';
import type { QualitySettings } from '../config/quality';
import type { TextureName } from '../core/assets';
import type { FrameContext } from '../core/frame';
import type { InitContext, ShadowFocus } from './SceneModule';
import { bakeSurface, disposeBaked } from './shared/bake';
import { unitSphere } from './shared/planet';
import { PlanetBody } from './shared/PlanetBody';

interface MoonSpec {
  readonly index: number;
  readonly radius: number;
  readonly orbit: number;
  /** Orbital phase relative to the direction of the Sun (radians). */
  readonly phase: number;
  /** Angular speed (rad/s) keeping the real period ratios of roughly 1 : 2 : 4 : 9.4. */
  readonly speed: number;
}

/**
 * Spin at which the Great Red Spot (longitude 1.35 rad in the surface map) faces the camera's first
 * Jupiter key: world azimuth of a surface point is (PI - phi - spin), and that key looks from
 * azimuth ~2.27 rad.
 */
const GRS_FACING_SPIN = Math.PI - 1.35 - 2.27;

/** Real maps by moon index (Io, Europa); Ganymede and Callisto stay procedural. */
const MOON_TEXTURES: Partial<Record<number, TextureName>> = { 0: 'io', 1: 'europa' };

const MOONS: readonly MoonSpec[] = [
  // Io sits almost between Jupiter and the Sun so its shadow falls on the visible disk.
  { index: 0, radius: 2.2, orbit: 78, phase: 0.06, speed: 0.012 },
  { index: 1, radius: 1.9, orbit: 108, phase: 1.9, speed: 0.006 },
  { index: 2, radius: 3.2, orbit: 148, phase: -1.2, speed: 0.003 },
  { index: 3, radius: 2.9, orbit: 196, phase: 2.8, speed: 0.0013 },
];

/** Jupiter with differentially rotating cloud bands and the four Galilean moons casting shadows. */
export class Jupiter extends PlanetBody {
  private readonly flow: { uFlowTime: { value: number } };
  private readonly moonGroup: Group;
  private readonly moons: Array<{ spec: MoonSpec; mesh: Mesh<SphereGeometry, MeshStandardMaterial> }>;
  private readonly focus: ShadowFocus;
  private readonly sunAngle: number;
  private focusProgress = 0.45;

  constructor(quality: QualitySettings) {
    const flow = { uFlowTime: { value: 0 } };
    super(
      {
        id: 'jupiter',
        layout: JUPITER,
        active: [at('asteroids', 0.3), at('saturn', 0.3)],
        surface,
        texture: 'jupiter',
        roughness: 1,
        receiveShadow: true,
        initialSpin: 0.6,
        haze: { day: '#e4d2b4', twilight: '#b37a52', strength: 0.18, power: 3 },
        atmosphere: {
          thickness: 0.025,
          dayColor: '#d9c6a6',
          twilightColor: '#a86b45',
          intensity: 0.45,
          falloff: 2.4,
          forward: 0.5,
        },
        shaderPatch: {
          uniforms: flow,
          fragment: [
            ['#include <common>', `#include <common>\n${flowChunk}`],
            [
              '#include <map_fragment>',
              `#ifdef USE_MAP
              diffuseColor *= texture2D(map, jupiterFlowUv(vMapUv));
              #endif`,
            ],
          ],
        },
      },
      quality,
    );
    this.flow = flow;
    this.focus = { center: JUPITER.position, radius: 215 };

    const toSun = SUN.position.clone().sub(JUPITER.position);
    this.sunAngle = Math.atan2(toSun.z, toSun.x);

    // The planet group is tilted; counter-rotate so the moons orbit in the ecliptic plane.
    this.moonGroup = new Group();
    this.moonGroup.rotation.z = -JUPITER.tilt;
    this.root.add(this.moonGroup);
    this.moons = MOONS.map((spec) => {
      const mesh = new Mesh(unitSphere(48), new MeshStandardMaterial({ color: '#b5b0a8', roughness: 0.95, metalness: 0 }));
      mesh.scale.setScalar(spec.radius);
      mesh.castShadow = true;
      this.moonGroup.add(mesh);
      return { spec, mesh };
    });
    this.placeMoons(0);
  }

  init(ctx: InitContext): void {
    super.init(ctx);
    for (const { spec, mesh } of this.moons) {
      const baked = bakeSurface(ctx.renderer, `#define MOON ${spec.index}\n${galilean}`, {
        width: ctx.quality.tier === 'low' ? 256 : 512,
        normalStrength: spec.index >= 2 ? 0.03 : 0.012,
      });
      mesh.material.map = baked.map;
      mesh.material.normalMap = baked.normal;
      mesh.material.normalScale = new Vector2(1, 1);
      mesh.material.color.set('#ffffff');
      mesh.material.needsUpdate = true;

      // Real NASA mosaics replace the procedural look where available. The baked relief does not
      // match their features, so the normal map is dropped with them.
      const real = MOON_TEXTURES[spec.index];
      if (real) {
        void ctx.assets.queue(real).then((map) => {
          if (!map) return;
          mesh.material.map = map;
          mesh.material.normalMap = null;
          mesh.material.needsUpdate = true;
          disposeBaked(baked.map);
          disposeBaked(baked.normal);
        });
      }
    }
  }

  resolve(ranges: ChapterRanges): void {
    this.focusProgress = resolveAnchor(at('jupiter', 0.18), ranges);
  }

  update(ctx: FrameContext): void {
    super.update(ctx);
    // Spin is tied to scroll so the Great Red Spot faces the camera when it arrives; the
    // differential band flow keeps the clouds alive on top of that.
    this.spin.rotation.y = GRS_FACING_SPIN + (ctx.progress - this.focusProgress) * 7 + ctx.time * 0.004;
    this.flow.uFlowTime.value = ctx.time;
    this.placeMoons(ctx.time);
  }

  shadowFocus(): ShadowFocus {
    return this.focus;
  }

  private placeMoons(time: number): void {
    for (const { spec, mesh } of this.moons) {
      const a = this.sunAngle + spec.phase + time * spec.speed;
      mesh.position.set(Math.cos(a) * spec.orbit, Math.sin(a * 0.7) * 2, Math.sin(a) * spec.orbit);
      // Tidally locked: the same face always points at Jupiter.
      mesh.rotation.y = -a;
    }
  }
}
