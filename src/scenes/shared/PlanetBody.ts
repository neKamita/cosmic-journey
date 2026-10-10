import { Group, MeshStandardMaterial, Vector2, type LOD, type Texture } from 'three';
import type { Anchor } from '../../camera/anchors';
import type { BodyLayout } from '../../config/layout';
import type { QualitySettings } from '../../config/quality';
import type { TextureName } from '../../core/assets';
import type { FrameContext } from '../../core/frame';
import type { InitContext, SceneModule } from '../SceneModule';
import { Atmosphere, type AtmosphereOptions } from './atmosphere';
import { bakeSurface, bakeWidth } from './bake';
import {
  HAZE_FRAGMENT,
  SunDirection,
  createSphereLOD,
  hazeUniforms,
  patchMaterial,
  type HazeUniforms,
  type ShaderPatch,
} from './planet';

export interface PlanetBodyConfig {
  readonly id: string;
  readonly layout: BodyLayout;
  readonly active: readonly [Anchor, Anchor];
  /** GLSL defining surfaceColor(vec3) and surfaceHeight(vec3); baked as the fallback look. */
  readonly surface: string;
  /** Relief exaggeration of the baked normal map; 0 for smooth (gaseous) bodies. */
  readonly normalStrength?: number;
  /** Real map from the texture pipeline that replaces the baked one when available. */
  readonly texture?: TextureName;
  readonly normalTexture?: TextureName;
  readonly roughness?: number;
  readonly normalScale?: number;
  readonly atmosphere?: Omit<AtmosphereOptions, 'radius'>;
  readonly haze?: { readonly day: string; readonly twilight: string; readonly strength: number; readonly power?: number };
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
  readonly initialSpin?: number;
  /** Extra shader chunk replacements merged with the haze patch. */
  readonly shaderPatch?: Omit<ShaderPatch, 'key'>;
  /** Hide the planet beyond this camera distance (it would be a sub-pixel dot in reality). */
  readonly maxViewDistance?: number;
}

/**
 * A lit sphere planet: LOD mesh with a standard PBR material, an optional atmosphere shell and disk
 * haze, a procedurally baked surface available instantly, and the real texture streamed in later.
 */
export class PlanetBody implements SceneModule {
  readonly id: string;
  readonly root = new Group();
  readonly active: readonly [Anchor, Anchor];

  protected readonly spin = new Group();
  protected readonly material: MeshStandardMaterial;
  protected readonly surface: LOD;
  protected readonly sun: SunDirection;
  protected readonly haze: HazeUniforms | null = null;
  protected readonly atmosphere: Atmosphere | null = null;

  constructor(
    protected readonly config: PlanetBodyConfig,
    quality: QualitySettings,
  ) {
    this.id = config.id;
    this.active = config.active;
    const { layout } = config;
    this.root.position.copy(layout.position);
    this.root.rotation.z = layout.tilt;
    this.spin.rotation.y = config.initialSpin ?? 0;
    this.root.add(this.spin);
    this.sun = new SunDirection(layout.position);

    this.material = new MeshStandardMaterial({ roughness: config.roughness ?? 0.95, metalness: 0 });
    if (config.haze) {
      this.haze = hazeUniforms(config.haze.day, config.haze.twilight, config.haze.strength, config.haze.power);
    }
    const extra = config.shaderPatch;
    if (this.haze || extra) {
      patchMaterial(this.material, {
        key: `${config.id}-surface`,
        uniforms: { ...this.haze, ...extra?.uniforms },
        vertex: extra?.vertex ?? [],
        fragment: [...(this.haze ? HAZE_FRAGMENT : []), ...(extra?.fragment ?? [])],
      });
    }
    this.surface = createSphereLOD(this.material, layout.radius, quality.sphereSegments, {
      castShadow: config.castShadow ?? false,
      receiveShadow: config.receiveShadow ?? false,
    });
    this.spin.add(this.surface);

    if (config.atmosphere) {
      this.atmosphere = new Atmosphere(layout.position, this.sun.world, { radius: layout.radius, ...config.atmosphere });
      this.root.add(this.atmosphere.mesh);
    }
  }

  init({ renderer, assets, quality }: InitContext): void {
    const baked = bakeSurface(renderer, this.config.surface, {
      width: bakeWidth(quality.tier),
      normalStrength: this.config.normalStrength ?? 0,
    });
    this.applyMaps(baked.map, baked.normal);

    const { texture, normalTexture } = this.config;
    if (texture) {
      void assets.queue(texture).then(async (map) => {
        if (!map) return;
        const normal = normalTexture ? await assets.queue(normalTexture) : null;
        this.applyMaps(map, normal ?? baked.normal);
      });
    }
  }

  update(ctx: FrameContext): void {
    const max = this.config.maxViewDistance;
    if (max !== undefined && ctx.camera.position.distanceTo(this.config.layout.position) > max) {
      this.root.visible = false;
      return;
    }
    this.spin.rotation.y += ctx.dt * ctx.motion * this.config.layout.spin;
    this.sun.update(ctx.camera);
    this.haze?.uHazeSunDir.value.copy(this.sun.view);
  }

  protected applyMaps(map: Texture, normal: Texture | null): void {
    this.material.map = map;
    this.material.normalMap = normal;
    const s = this.config.normalScale ?? 1;
    this.material.normalScale = new Vector2(s, s);
    this.material.needsUpdate = true;
  }
}
