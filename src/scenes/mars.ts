import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial, Vector3 } from 'three';
import dustFrag from '../shaders/planet/dust.frag';
import dustVert from '../shaders/planet/dust.vert';
import surface from '../shaders/planets/mars.glsl';
import { at } from '../camera/anchors';
import { MARS } from '../config/layout';
import type { QualitySettings } from '../config/quality';
import type { FrameContext } from '../core/frame';
import { createRng, smoothstep } from '../utils/math';
import { PlanetBody } from './shared/PlanetBody';

const DUST_COUNT = 6000;

/** Mars with a thin dusty atmosphere (blue at sunset) and dust motes during the close approach. */
export class Mars extends PlanetBody {
  private readonly dust: Points<BufferGeometry, ShaderMaterial>;

  constructor(quality: QualitySettings) {
    super(
      {
        id: 'mars',
        layout: MARS,
        active: [at('inner', 0.35), at('asteroids', 0.7)],
        surface,
        normalStrength: 0.03,
        texture: 'mars',
        normalTexture: 'mars_normal',
        roughness: 0.95,
        normalScale: 1.1,
        initialSpin: 2.6,
        haze: { day: '#e2a37c', twilight: '#7d9be0', strength: 0.32, power: 2.2 },
        atmosphere: {
          thickness: 0.035,
          dayColor: '#e3a57e',
          twilightColor: '#7393e0',
          intensity: 0.85,
          falloff: 2.6,
          forward: 0.7,
        },
      },
      quality,
    );
    this.dust = this.createDust();
    this.root.add(this.dust);
    this.setQuality(quality);
  }

  setQuality(quality: QualitySettings): void {
    this.dust.geometry.setDrawRange(0, Math.floor(DUST_COUNT * quality.particleScale));
  }

  setPixelRatio(dpr: number): void {
    this.dust.material.uniforms.uPixelRatio!.value = dpr;
  }

  update(ctx: FrameContext): void {
    super.update(ctx);
    const local = ctx.chapter === 'mars' ? ctx.chapterLocal : 0;
    const opacity = smoothstep(0.2, 0.4, local) * (1 - smoothstep(0.6, 0.85, local));
    const uniforms = this.dust.material.uniforms;
    uniforms.uOpacity!.value = opacity;
    uniforms.uTime!.value = ctx.time;
    this.dust.visible = opacity > 0.001;
  }

  private createDust(): Points<BufferGeometry, ShaderMaterial> {
    const rng = createRng(31);
    const positions = new Float32Array(DUST_COUNT * 3);
    const seeds = new Float32Array(DUST_COUNT);
    const dir = new Vector3();
    for (let i = 0; i < DUST_COUNT; i++) {
      const z = rng() * 2 - 1;
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      dir.set(r * Math.cos(a), z, r * Math.sin(a));
      // Dense near the surface, thinning with altitude.
      const altitude = MARS.radius * (1.01 + Math.pow(rng(), 2) * 0.35);
      dir.multiplyScalar(altitude).toArray(positions, i * 3);
      seeds[i] = rng();
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    geometry.computeBoundingSphere();
    const material = new ShaderMaterial({
      vertexShader: dustVert,
      fragmentShader: dustFrag,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uOpacity: { value: 0 },
        uSize: { value: 2.2 },
        uColor: { value: new Color(1, 0.72, 0.5).multiplyScalar(0.55) },
      },
    });
    const points = new Points(geometry, material);
    points.visible = false;
    return points;
  }
}
