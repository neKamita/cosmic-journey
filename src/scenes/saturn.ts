import { Vector3, type Texture } from 'three';
import surface from '../shaders/planets/saturn.glsl';
import ringShadowChunk from '../shaders/saturn/ringShadow.glsl';
import { at } from '../camera/anchors';
import { SATURN } from '../config/layout';
import type { QualitySettings } from '../config/quality';
import { createRng } from '../utils/math';
import type { InitContext } from './SceneModule';
import { PlanetBody } from './shared/PlanetBody';
import { RingSystem, ringProfileTexture, type RingSample } from './shared/rings';

/** Ring extent in planet radii for the procedural profile (inner D ring to the F ring). */
const PROCEDURAL_RANGE: readonly [number, number] = [1.11, 2.33];
/** Assumed extent of the Solar System Scope ring map (C ring inner edge to A ring outer edge). */
const SSS_RANGE: readonly [number, number] = [1.239, 2.27];

const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const band = (r: number, a: number, b: number, soft = 0.004): number =>
  smooth(a - soft, a + soft, r) * (1 - smooth(b - soft, b + soft, r));

/**
 * Radial opacity/colour profile of Saturn's rings from published radii (in Saturn radii): faint D,
 * translucent C, dense B, the Cassini Division, A with the Encke and Keeler gaps, and the narrow F.
 */
function createRingSampler(): (r: number) => RingSample {
  const rng = createRng(26);
  const waves = Array.from({ length: 24 }, () => ({ f: 40 + rng() * 900, p: rng() * 6.283, a: 0.03 + rng() * 0.08 }));
  return (r) => {
    let ringlets = 0;
    for (const w of waves) ringlets += Math.sin(r * w.f + w.p) * w.a;
    const d = band(r, 1.11, 1.236) * 0.04;
    const c = band(r, 1.239, 1.527) * (0.14 + ringlets * 0.6);
    const b = band(r, 1.527, 1.951) * (0.72 + 0.2 * smooth(1.527, 1.65, r) + ringlets);
    const cassini = band(r, 1.951, 2.027) * 0.05;
    const encke = 1 - band(r, 2.21, 2.218, 0.0015) * 0.95;
    const keeler = 1 - band(r, 2.262, 2.265, 0.001) * 0.9;
    const a = band(r, 2.027, 2.269) * (0.55 + ringlets * 0.8) * encke * keeler;
    const f = band(r, 2.322, 2.33, 0.002) * 0.4;
    const alpha = d + c + b + cassini + a + f;

    // Linear albedo: C ring darker and greyer, B ring brightest and creamy, A slightly cooler.
    const cw = band(r, 1.11, 1.527, 0.02);
    const bw = band(r, 1.527, 1.951, 0.02);
    const aw = 1 - cw - bw;
    const shade = 0.9 + ringlets;
    return [
      shade * (cw * 0.32 + bw * 0.72 + aw * 0.6),
      shade * (cw * 0.28 + bw * 0.62 + aw * 0.55),
      shade * (cw * 0.24 + bw * 0.47 + aw * 0.47),
      alpha,
    ];
  };
}

/** Saturn with its rings; the rings and the planet shadow each other analytically. */
export class Saturn extends PlanetBody {
  private readonly rings: RingSystem;
  private readonly ringUniforms: {
    uRingShadowMap: { value: Texture };
    uRingInner: { value: number };
    uRingOuter: { value: number };
  };

  constructor(quality: QualitySettings) {
    const ringNormal = new Vector3(0, 1, 0).applyAxisAngle(new Vector3(0, 0, 1), SATURN.tilt);
    const ringMap = ringProfileTexture(PROCEDURAL_RANGE, createRingSampler());
    const [inner, outer] = PROCEDURAL_RANGE;
    const sunDir = SATURN.position.clone().negate().normalize();
    const ringUniforms = {
      uRingShadowMap: { value: ringMap as Texture },
      uRingNormal: { value: ringNormal },
      uRingCenter: { value: SATURN.position.clone() },
      uRingSunDir: { value: sunDir },
      uRingInner: { value: inner * SATURN.radius },
      uRingOuter: { value: outer * SATURN.radius },
    };
    super(
      {
        id: 'saturn',
        layout: SATURN,
        active: [at('jupiter', 0.4), at('ice', 0.3)],
        surface,
        texture: 'saturn',
        roughness: 1,
        initialSpin: 0.3,
        haze: { day: '#e9dcb8', twilight: '#b98a5c', strength: 0.16, power: 3 },
        atmosphere: {
          thickness: 0.025,
          dayColor: '#e6d6b0',
          twilightColor: '#b07a4a',
          intensity: 0.42,
          falloff: 2.4,
          forward: 0.8,
        },
        shaderPatch: {
          uniforms: ringUniforms,
          vertex: [
            ['#include <common>', '#include <common>\nvarying vec3 vRingWorldPos;'],
            ['#include <project_vertex>', '#include <project_vertex>\nvRingWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'],
          ],
          fragment: [
            ['#include <common>', `#include <common>\n${ringShadowChunk}`],
            [
              '#include <lights_fragment_end>',
              `#include <lights_fragment_end>
              float ringShade = ringShadow();
              reflectedLight.directDiffuse *= 1.0 - ringShade;
              reflectedLight.directSpecular *= 1.0 - ringShade;`,
            ],
          ],
        },
      },
      quality,
    );
    this.ringUniforms = ringUniforms;

    this.rings = new RingSystem({
      center: SATURN.position,
      planetRadius: SATURN.radius,
      normal: ringNormal,
      sunDir,
      inner: inner * SATURN.radius,
      outer: outer * SATURN.radius,
      map: ringMap,
      light: 1.05,
    });
    this.root.add(this.rings.mesh);
  }

  init(ctx: InitContext): void {
    super.init(ctx);
    void ctx.assets.queue('saturn_ring').then((map) => {
      if (!map) return;
      const r0 = SSS_RANGE[0] * SATURN.radius;
      const r1 = SSS_RANGE[1] * SATURN.radius;
      this.rings.setMap(map, r0, r1);
      this.ringUniforms.uRingShadowMap.value = map;
      this.ringUniforms.uRingInner.value = r0;
      this.ringUniforms.uRingOuter.value = r1;
    });
  }
}
