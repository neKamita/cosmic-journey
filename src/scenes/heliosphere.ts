import { AdditiveBlending, Color, DoubleSide, Group, Mesh, ShaderMaterial, SphereGeometry } from 'three';
import heliosphereFrag from '../shaders/heliosphere/heliosphere.frag';
import heliosphereVert from '../shaders/heliosphere/heliosphere.vert';
import { at } from '../camera/anchors';
import { GALAXY, SUN } from '../config/layout';
import type { FrameContext } from '../core/frame';
import type { SceneModule } from './SceneModule';

/** Radius of the (artistic) heliopause around the Sun, crossed on the way out. */
const HELIOPAUSE_RADIUS = 3000;

/** The heliosphere bubble: the Sun's sphere of influence, blunt towards its direction of motion. */
export class Heliosphere implements SceneModule {
  readonly id = 'heliosphere';
  readonly root = new Group();
  readonly active = [at('ice', 0.45), at('blackhole', 0)] as const;
  private readonly mesh: Mesh<SphereGeometry, ShaderMaterial>;

  constructor() {
    this.mesh = new Mesh(
      new SphereGeometry(1, 96, 48),
      new ShaderMaterial({
        vertexShader: heliosphereVert,
        fragmentShader: heliosphereFrag,
        side: DoubleSide,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 0 },
          uColor: { value: new Color(0.35, 0.5, 1).multiplyScalar(0.6) },
        },
      }),
    );
    // Compressed towards the direction the Sun travels (roughly towards the galactic centre side
    // in this scene) and stretched into a tail behind it.
    this.mesh.scale.set(HELIOPAUSE_RADIUS * 1.25, HELIOPAUSE_RADIUS * 0.95, HELIOPAUSE_RADIUS);
    this.mesh.lookAt(GALAXY.center);
    this.mesh.position.copy(SUN.position).addScaledVector(GALAXY.center.clone().normalize(), -HELIOPAUSE_RADIUS * 0.2);
    this.root.add(this.mesh);
  }

  update(ctx: FrameContext): void {
    const d = ctx.camera.position.distanceTo(SUN.position);
    // Faint from inside and outside, flaring as the camera crosses the boundary.
    const crossing = Math.exp(-(((d - HELIOPAUSE_RADIUS) / 320) ** 2));
    const u = this.mesh.material.uniforms;
    u.uIntensity!.value = 0.1 + crossing * 0.9;
    u.uTime!.value = ctx.time;
  }
}
