import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, ShaderMaterial, Vector3 } from 'three';
import diskFrag from '../shaders/blackhole/diskMesh.frag';
import diskVert from '../shaders/blackhole/diskMesh.vert';
import { at } from '../camera/anchors';
import { BLACK_HOLE } from '../config/layout';
import { DISK_INNER, DISK_OUTER, diskBasis } from '../core/effects/LensEffect';
import type { FrameContext } from '../core/frame';
import type { SceneModule } from './SceneModule';
import { unitSphere } from './shared/planet';

/** Apparent radius of the black hole's shadow in r_s (photon capture radius, 3*sqrt(3)/2). */
const SHADOW_RADIUS = 2.6;

/**
 * Sgr A*. With post-processing the lens effect ray-traces the hole, its disk and the lensed sky;
 * this module only draws a non-lensed fallback (shadow sphere + disk) when that effect is off.
 */
export class BlackHole implements SceneModule {
  readonly id = 'blackhole';
  readonly root = new Group();
  readonly active = [at('heliopause', 0.5), at('galaxy', 0.15)] as const;
  private lensActive = false;
  private readonly fallback = new Group();
  private readonly disk: Mesh<RingGeometry, ShaderMaterial>;

  constructor() {
    const rs = BLACK_HOLE.horizon;
    const basis = diskBasis();
    this.root.position.copy(BLACK_HOLE.position);

    const shadow = new Mesh(unitSphere(64), new MeshBasicMaterial({ color: '#000000' }));
    shadow.scale.setScalar(SHADOW_RADIUS * rs);

    this.disk = new Mesh(
      new RingGeometry(DISK_INNER * rs, DISK_OUTER * rs, 192, 8),
      new ShaderMaterial({
        vertexShader: diskVert,
        fragmentShader: diskFrag,
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uCenter: { value: BLACK_HOLE.position.clone() },
          uRs: { value: rs },
          uNormal: { value: basis.normal },
          uBasisU: { value: basis.u },
          uBasisV: { value: basis.v },
          uInner: { value: DISK_INNER },
          uOuter: { value: DISK_OUTER },
          uTime: { value: 0 },
          uDiskIntensity: { value: 0.75 },
        },
      }),
    );
    // Lay the ring (XY plane, normal +Z) into the disk plane.
    this.disk.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), basis.normal);
    this.fallback.add(shadow, this.disk);
    this.root.add(this.fallback);
  }

  setLensActive(active: boolean): void {
    this.lensActive = active;
  }

  update(ctx: FrameContext): void {
    // The lens pass renders everything while its strength is above zero.
    this.fallback.visible = !(this.lensActive && ctx.env.lens > 0.01);
    this.disk.material.uniforms.uTime!.value = ctx.time;
  }
}
