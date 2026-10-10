import { Color, Group, MeshStandardMaterial, Vector2, type LOD, type Texture } from 'three';
import surfaceChunk from '../shaders/earth/surface.glsl';
import { at } from '../camera/anchors';
import { EARTH } from '../config/layout';
import type { QualitySettings } from '../config/quality';
import type { FrameContext } from '../core/frame';
import type { InitContext, SceneModule } from './SceneModule';
import { Atmosphere } from './shared/atmosphere';
import { HAZE_FRAGMENT, SunDirection, createSphereLOD, hazeUniforms, patchMaterial } from './shared/planet';

/** Initial spin so the day side shows Africa/Europe and the night side Asia's lights at the start. */
const INITIAL_SPIN = 2.35;
const CLOUD_DRIFT = 0.0018;

export class Earth implements SceneModule {
  readonly id = 'earth';
  readonly root = new Group();
  readonly active = [at('earth', 0), at('inner', 0.45)] as const;

  private readonly spin = new Group();
  private readonly sun = new SunDirection(EARTH.position);
  private readonly surfaceMaterial: MeshStandardMaterial;
  private readonly cloudMaterial: MeshStandardMaterial;
  private readonly surface: LOD;
  private readonly clouds: LOD;
  private readonly atmosphere: Atmosphere;
  private readonly haze = hazeUniforms('#6fa8ff', '#a8583a', 0.55, 2.6);
  private readonly uniforms = {
    uSunDirView: { value: this.sun.view },
    uCloudMap: { value: null as Texture | null },
    uCloudShift: { value: 0 },
    uCloudShadow: { value: 0.42 },
  };

  constructor(quality: QualitySettings) {
    this.root.position.copy(EARTH.position);
    this.root.rotation.z = EARTH.tilt;
    this.spin.rotation.y = INITIAL_SPIN;
    this.root.add(this.spin);

    // Fallback look until textures arrive (or when they are missing entirely).
    this.surfaceMaterial = new MeshStandardMaterial({ color: '#2a5aa8', roughness: 0.75, metalness: 0 });
    this.surface = createSphereLOD(this.surfaceMaterial, EARTH.radius, quality.sphereSegments);
    this.spin.add(this.surface);

    this.cloudMaterial = new MeshStandardMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
      visible: false,
    });
    this.clouds = createSphereLOD(this.cloudMaterial, EARTH.radius * 1.007, Math.round(quality.sphereSegments * 0.75));
    this.clouds.renderOrder = 1;
    this.spin.add(this.clouds);

    this.atmosphere = new Atmosphere(EARTH.position, this.sun.world, {
      radius: EARTH.radius,
      thickness: 0.045,
      dayColor: '#5f9bff',
      twilightColor: '#ff7a3a',
      intensity: 1.35,
      falloff: 2.4,
      forward: 0.8,
    });
    this.root.add(this.atmosphere.mesh);
  }

  async init({ assets }: InitContext): Promise<void> {
    const [day, night, clouds, normal, roughness] = await Promise.all([
      assets.load('earth_day', true),
      assets.load('earth_night', true),
      assets.load('earth_clouds', true),
      assets.load('earth_normal', true),
      assets.load('earth_roughness', true),
    ]);
    if (!day) return;

    const m = this.surfaceMaterial;
    m.color.set('#ffffff');
    m.map = day;
    m.roughness = 1;
    if (roughness) m.roughnessMap = roughness;
    if (normal) {
      m.normalMap = normal;
      m.normalScale = new Vector2(1, 1);
    }
    if (night) {
      m.emissiveMap = night;
      m.emissive = new Color(1, 0.72, 0.42);
      m.emissiveIntensity = 7;
    }
    this.uniforms.uCloudMap.value = clouds;
    this.uniforms.uCloudShadow.value = clouds ? 0.42 : 0;

    const fragment: Array<readonly [string, string]> = [
      ['#include <common>', `#include <common>\n${surfaceChunk}`],
      [
        '#include <map_fragment>',
        `#include <map_fragment>
        float cloudCover = ${clouds ? 'earthCloudCover(vMapUv)' : '0.0'};
        diffuseColor.rgb *= 1.0 - uCloudShadow * cloudCover;`,
      ],
      [
        '#include <roughnessmap_fragment>',
        // Ocean 0.35 / land 0.85 in the map; soften the ocean so the sun glint stays a sheen, not a blob.
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.45, 0.92, smoothstep(0.4, 0.8, roughnessFactor));`,
      ],
      [
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance *= earthNight(nonPerturbedNormal) * (1.0 - 0.85 * cloudCover);`,
      ],
      ...HAZE_FRAGMENT,
    ];
    patchMaterial(m, {
      key: `earth-surface-${clouds ? 'c' : 'n'}`,
      uniforms: { ...this.uniforms, ...this.haze },
      fragment,
    });
    m.needsUpdate = true;

    if (clouds) {
      this.cloudMaterial.alphaMap = clouds;
      this.cloudMaterial.visible = true;
      this.cloudMaterial.needsUpdate = true;
    }
  }

  update(ctx: FrameContext): void {
    const step = ctx.dt * ctx.motion;
    this.spin.rotation.y += step * EARTH.spin;
    // Clouds drift relative to the surface; the surface shader shifts its cloud-shadow lookup to match.
    this.clouds.rotation.y += step * CLOUD_DRIFT;
    this.uniforms.uCloudShift.value = -this.clouds.rotation.y / (Math.PI * 2);

    this.sun.update(ctx.camera);
    this.haze.uHazeSunDir.value.copy(this.sun.view);
  }
}
