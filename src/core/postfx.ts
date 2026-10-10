import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  GodRaysEffect,
  KernelSize,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { HalfFloatType, Vector2, type Mesh, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three';
import type { EnvState } from '../camera/envTracks';
import type { QualitySettings } from '../config/quality';
import { GradeEffect } from './effects/GradeEffect';
import { LensEffect } from './effects/LensEffect';

/**
 * Post-processing chain (pmndrs/postprocessing):
 *   RenderPass → [black hole lens] → [god rays] → [bloom, grade, ACES, vignette, grain] → [CA]
 * Effects that sample neighbouring texels (lens, god rays, chromatic aberration) live in their own
 * passes, as the library requires. The last pass must stay enabled because it renders to screen.
 */
export class PostFX {
  readonly composer: EffectComposer;
  private readonly bloom: BloomEffect;
  private readonly grade = new GradeEffect();
  private readonly vignette: VignetteEffect;
  private readonly noise: NoiseEffect;
  private readonly aberration: ChromaticAberrationEffect | null = null;
  private readonly godRays: GodRaysEffect | null = null;
  private readonly godRaysPass: EffectPass | null = null;
  private readonly lens: LensEffect | null = null;
  private readonly lensPass: EffectPass | null = null;
  private quality: QualitySettings;
  private grainEnabled: boolean;
  private readonly reducedMotion: boolean;

  constructor(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera,
    quality: QualitySettings,
    sunLightSource: Mesh,
    reducedMotion: boolean,
  ) {
    this.quality = quality;
    this.reducedMotion = reducedMotion;
    this.grainEnabled = quality.grain && !reducedMotion;
    this.composer = new EffectComposer(renderer, {
      frameBufferType: HalfFloatType,
      multisampling: quality.multisampling,
    });
    this.composer.addPass(new RenderPass(scene, camera));

    if (quality.lens) {
      this.lens = new LensEffect(camera);
      this.lensPass = new EffectPass(camera, this.lens);
      this.lensPass.enabled = false;
      this.composer.addPass(this.lensPass);
    }

    if (quality.godRays) {
      this.godRays = new GodRaysEffect(camera, sunLightSource, {
        blendFunction: BlendFunction.SCREEN,
        samples: quality.tier === 'high' ? 60 : 40,
        density: 0.94,
        decay: 0.92,
        weight: 0.22,
        exposure: 0.34,
        clampMax: 1,
        resolutionScale: 0.5,
        blur: true,
        kernelSize: KernelSize.SMALL,
      });
      this.godRaysPass = new EffectPass(camera, this.godRays);
      this.composer.addPass(this.godRaysPass);
    }

    this.bloom = new BloomEffect({
      mipmapBlur: true,
      luminanceThreshold: 1.05,
      luminanceSmoothing: 0.3,
      intensity: 1,
      radius: 0.7,
      levels: quality.tier === 'high' ? 8 : 6,
    });
    this.vignette = new VignetteEffect({ offset: 0.32, darkness: 0.4 });
    this.noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    this.noise.blendMode.opacity.value = 0;
    this.composer.addPass(
      new EffectPass(
        camera,
        this.bloom,
        this.grade,
        new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
        this.vignette,
        this.noise,
      ),
    );

    if (quality.aberration) {
      this.aberration = new ChromaticAberrationEffect({
        offset: new Vector2(0.0005, 0.0005),
        radialModulation: true,
        modulationOffset: 0.18,
      });
      this.composer.addPass(new EffectPass(camera, this.aberration));
    }
  }

  /** Whether the ray-traced black hole lens is part of this chain. */
  get hasLens(): boolean {
    return this.lens !== null;
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  setQuality(quality: QualitySettings): void {
    this.quality = quality;
    this.composer.multisampling = quality.multisampling;
    this.grainEnabled = this.grainEnabled && quality.grain;
  }

  update(env: EnvState, time: number): void {
    if (this.lens && this.lensPass) {
      this.lens.setState(time, env.lens);
      this.lensPass.enabled = env.lens > 0.01;
    }
    this.bloom.intensity = env.bloom;
    this.grade.setGrade(env.tint, env.saturation);
    this.vignette.darkness = env.vignette;
    this.noise.blendMode.opacity.value = this.grainEnabled ? env.grain : 0;
    if (this.aberration) {
      const a = this.quality.aberration && !this.reducedMotion ? env.aberration : 0;
      this.aberration.offset.set(a, a);
    }
    if (this.godRays && this.godRaysPass) {
      this.godRays.blendMode.opacity.value = env.godRays;
      this.godRaysPass.enabled = env.godRays > 0.01;
    }
  }

  render(dt: number): void {
    this.composer.render(dt);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
