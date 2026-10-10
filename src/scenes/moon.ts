import { Group, MeshStandardMaterial, Vector2, type LOD } from 'three';
import { at } from '../camera/anchors';
import { EARTH, MOON } from '../config/layout';
import type { QualitySettings } from '../config/quality';
import type { FrameContext } from '../core/frame';
import type { InitContext, SceneModule } from './SceneModule';
import { createSphereLOD } from './shared/planet';

export class Moon implements SceneModule {
  readonly id = 'moon';
  readonly root = new Group();
  readonly active = [at('earth', 0), at('sun', 0.5)] as const;

  private readonly material: MeshStandardMaterial;
  private readonly surface: LOD;

  constructor(quality: QualitySettings) {
    this.root.position.copy(MOON.position);
    // Tidally locked: the near side (longitude 0, local +X) faces Earth.
    const toEarth = EARTH.position.clone().sub(MOON.position);
    this.root.rotation.y = -Math.atan2(toEarth.z, toEarth.x);
    this.root.rotation.z = MOON.tilt * 0.2;

    this.material = new MeshStandardMaterial({ color: '#8d8a86', roughness: 1, metalness: 0 });
    this.surface = createSphereLOD(this.material, MOON.radius, quality.sphereSegments, {
      castShadow: true,
      receiveShadow: true,
    });
    this.root.add(this.surface);
  }

  async init({ assets }: InitContext): Promise<void> {
    const [color, normal] = await Promise.all([assets.load('moon_color', true), assets.load('moon_normal', true)]);
    if (color) {
      this.material.map = color;
      this.material.color.set('#ffffff');
    }
    if (normal) {
      this.material.normalMap = normal;
      this.material.normalScale = new Vector2(1.1, 1.1);
    }
    this.material.needsUpdate = true;
  }

  update(ctx: FrameContext): void {
    // Libration-scale wobble only; the Moon stays locked to Earth.
    this.surface.rotation.y = Math.sin(ctx.time * 0.05) * 0.04;
  }
}
