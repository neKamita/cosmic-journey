import {
  DataTexture,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  RGBAFormat,
  RingGeometry,
  ShaderMaterial,
  UnsignedByteType,
  Vector3,
  type Texture,
} from 'three';
import surface from '../shaders/planets/saturn.glsl';
import ringShadowChunk from '../shaders/saturn/ringShadow.glsl';
import ringsFrag from '../shaders/saturn/rings.frag';
import ringsVert from '../shaders/saturn/rings.vert';
import { at } from '../camera/anchors';
import { SATURN } from '../config/layout';
import type { QualitySettings } from '../config/quality';
import type { InitContext } from './SceneModule';
import { createRng } from '../utils/math';
import { PlanetBody } from './shared/PlanetBody';

/** Ring extent in planet radii for the procedural profile (inner D ring to the F ring). */
const PROCEDURAL_RANGE: readonly [number, number] = [1.11, 2.33];
/** Assumed extent of the Solar System Scope ring map (C ring inner edge to A ring outer edge). */
const SSS_RANGE: readonly [number, number] = [1.239, 2.27];

const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const band = (r: number, a: number, b: number, soft = 0.004): number => smooth(a - soft, a + soft, r) * (1 - smooth(b - soft, b + soft, r));

/**
 * Radial opacity/colour profile of Saturn's rings from published radii (in Saturn radii): faint D,
 * translucent C, dense B, the Cassini Division, A with the Encke and Keeler gaps, and the narrow F.
 */
function createRingProfile(width = 2048): DataTexture {
  const rng = createRng(26);
  const waves = Array.from({ length: 24 }, () => ({ f: 40 + rng() * 900, p: rng() * 6.283, a: 0.03 + rng() * 0.08 }));
  const data = new Uint8Array(width * 4);
  const [r0, r1] = PROCEDURAL_RANGE;
  for (let i = 0; i < width; i++) {
    const r = r0 + ((i + 0.5) / width) * (r1 - r0);
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
    const alpha = Math.min(1, Math.max(0, d + c + b + cassini + a + f));

    // Linear albedo: C ring darker and greyer, B ring brightest and creamy, A slightly cooler.
    const cw = band(r, 1.11, 1.527, 0.02);
    const bw = band(r, 1.527, 1.951, 0.02);
    const aw = 1 - cw - bw;
    const shade = 0.9 + ringlets;
    data[i * 4] = Math.round(255 * Math.min(1, shade * (cw * 0.32 + bw * 0.72 + aw * 0.6)));
    data[i * 4 + 1] = Math.round(255 * Math.min(1, shade * (cw * 0.28 + bw * 0.62 + aw * 0.55)));
    data[i * 4 + 2] = Math.round(255 * Math.min(1, shade * (cw * 0.24 + bw * 0.47 + aw * 0.47)));
    data[i * 4 + 3] = Math.round(255 * alpha);
  }
  const texture = new DataTexture(data, width, 1, RGBAFormat, UnsignedByteType);
  texture.magFilter = LinearFilter;
  // Mipmaps keep the fine ringlets from shimmering (moiré) when the rings are small on screen.
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Saturn with its rings; the rings and the planet shadow each other analytically. */
export class Saturn extends PlanetBody {
  private readonly rings: Mesh<RingGeometry, ShaderMaterial>;
  private readonly ringUniforms: Record<string, { value: unknown }>;

  constructor(quality: QualitySettings) {
    const ringNormal = new Vector3(0, 1, 0).applyAxisAngle(new Vector3(0, 0, 1), SATURN.tilt);
    const ringMap = createRingProfile();
    const [inner, outer] = PROCEDURAL_RANGE;
    const sunDir = new Vector3().copy(SATURN.position).negate().normalize();
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

    const geometry = new RingGeometry(inner * SATURN.radius, outer * SATURN.radius, 256, 1);
    this.rings = new Mesh(
      geometry,
      new ShaderMaterial({
        vertexShader: ringsVert,
        fragmentShader: ringsFrag,
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uRingMap: { value: ringMap },
          uSunDir: { value: sunDir },
          uPlanetCenter: { value: SATURN.position.clone() },
          uPlanetRadius: { value: SATURN.radius },
          uRingNormal: { value: ringNormal },
          uLight: { value: 1.05 },
          uInner: { value: inner * SATURN.radius },
          uOuter: { value: outer * SATURN.radius },
        },
      }),
    );
    // RingGeometry lies in the local XY plane; lay it into the (tilted) equatorial plane.
    this.rings.rotation.x = -Math.PI / 2;
    this.rings.renderOrder = 1;
    this.root.add(this.rings);
  }

  init(ctx: InitContext): void {
    super.init(ctx);
    void ctx.assets.queue('saturn_ring').then((map) => {
      if (!map) return;
      const [inner, outer] = SSS_RANGE;
      this.setRingRadii(map, inner, outer);
    });
  }

  private setRingRadii(map: Texture, inner: number, outer: number): void {
    const r0 = inner * SATURN.radius;
    const r1 = outer * SATURN.radius;
    this.rings.geometry.dispose();
    this.rings.geometry = new RingGeometry(r0, r1, 256, 1);
    const u = this.rings.material.uniforms;
    u.uRingMap!.value = map;
    u.uInner!.value = r0;
    u.uOuter!.value = r1;
    this.ringUniforms.uRingShadowMap!.value = map;
    this.ringUniforms.uRingInner!.value = r0;
    this.ringUniforms.uRingOuter!.value = r1;
  }
}
