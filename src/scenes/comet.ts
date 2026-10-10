import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import coronaVert from '../shaders/sun/corona.vert';
import comaFrag from '../shaders/comet/coma.frag';
import tailFrag from '../shaders/comet/tail.frag';
import tailVert from '../shaders/comet/tail.vert';
import { at } from '../camera/anchors';
import { SUN, polar } from '../config/layout';
import type { QualitySettings } from '../config/quality';
import type { FrameContext } from '../core/frame';
import { createRng } from '../utils/math';
import type { SceneModule } from './SceneModule';
import { unitSphere } from './shared/planet';

interface CometSpec {
  readonly position: Vector3;
  readonly length: number;
  readonly width: number;
  readonly particles: number;
  readonly nucleus: number;
  /** Which way the curved dust tail bends (+1 / -1 around the orbital direction). */
  readonly bend: number;
}

const COMETS: readonly CometSpec[] = [
  // Placed off to the side of the camera's line of sight so the anti-solar tail crosses the frame.
  { position: polar(845, 0.02, 22), length: 170, width: 10, particles: 4200, nucleus: 0.6, bend: 1 },
  { position: polar(1010, -0.4, 70), length: 220, width: 14, particles: 3200, nucleus: 0.9, bend: -1 },
];

class Comet {
  readonly group = new Group();
  private readonly tail: Points<BufferGeometry, ShaderMaterial>;

  constructor(private readonly spec: CometSpec, seed: number) {
    const tailDir = spec.position.clone().sub(SUN.position).normalize();
    const orbit = new Vector3().crossVectors(new Vector3(0, 1, 0), tailDir).normalize();

    const nucleus = new Mesh(
      unitSphere(24),
      new MeshStandardMaterial({ color: '#3a342e', roughness: 1, metalness: 0 }),
    );
    nucleus.scale.set(spec.nucleus, spec.nucleus * 0.7, spec.nucleus * 0.85);
    nucleus.position.copy(spec.position);

    const coma = new Mesh(
      new PlaneGeometry(2, 2),
      new ShaderMaterial({
        vertexShader: coronaVert,
        fragmentShader: comaFrag,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        uniforms: { uColor: { value: new Color(0.75, 0.88, 1) }, uIntensity: { value: 2.2 } },
      }),
    );
    coma.scale.setScalar(spec.width * 1.1);
    coma.position.copy(spec.position);
    coma.frustumCulled = false;

    const rng = createRng(500 + seed);
    const seeds = new Float32Array(spec.particles * 4);
    for (let i = 0; i < spec.particles; i++) {
      seeds[i * 4] = rng();
      seeds[i * 4 + 1] = rng();
      seeds[i * 4 + 2] = Math.sqrt(rng());
      seeds[i * 4 + 3] = rng() < 0.3 ? 1 : 0;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(spec.particles * 3), 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    this.tail = new Points(
      geometry,
      new ShaderMaterial({
        vertexShader: tailVert,
        fragmentShader: tailFrag,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uNucleus: { value: spec.position.clone() },
          uTailDir: { value: tailDir },
          uCurveDir: { value: orbit.multiplyScalar(-spec.bend) },
          uLength: { value: spec.length },
          uWidth: { value: spec.width },
          uSpeed: { value: 0.05 },
          uPixelRatio: { value: 1 },
          uIntensity: { value: 0.75 },
          uDustColor: { value: new Color(1, 0.86, 0.66) },
          uIonColor: { value: new Color(0.45, 0.7, 1) },
        },
      }),
    );
    // Particle positions are computed in the shader from uniforms.
    this.tail.frustumCulled = false;
    this.group.add(nucleus, coma, this.tail);
  }

  update(time: number): void {
    this.tail.material.uniforms.uTime!.value = time;
  }

  setPixelRatio(dpr: number): void {
    this.tail.material.uniforms.uPixelRatio!.value = dpr;
  }

  setParticleScale(scale: number): void {
    this.tail.geometry.setDrawRange(0, Math.floor(this.spec.particles * Math.max(0.4, scale)));
  }
}

/** Comets near the asteroid belt with dust and ion tails pointing away from the Sun. */
export class Comets implements SceneModule {
  readonly id = 'comets';
  readonly root = new Group();
  readonly active = [at('mars', 0.5), at('jupiter', 0.4)] as const;
  private readonly comets = COMETS.map((spec, i) => new Comet(spec, i));

  constructor(quality: QualitySettings) {
    for (const comet of this.comets) this.root.add(comet.group);
    this.setQuality(quality);
  }

  setQuality(quality: QualitySettings): void {
    for (const comet of this.comets) comet.setParticleScale(quality.particleScale);
  }

  setPixelRatio(dpr: number): void {
    for (const comet of this.comets) comet.setPixelRatio(dpr);
  }

  update(ctx: FrameContext): void {
    for (const comet of this.comets) comet.update(ctx.time);
  }
}
