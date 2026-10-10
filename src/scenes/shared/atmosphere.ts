import { AdditiveBlending, BackSide, Color, Mesh, ShaderMaterial, Vector3, type SphereGeometry } from 'three';
import atmosphereFrag from '../../shaders/planet/atmosphere.frag';
import atmosphereVert from '../../shaders/planet/atmosphere.vert';
import { unitSphere } from './planet';

export interface AtmosphereOptions {
  /** Planet radius in world units. */
  readonly radius: number;
  /** Shell height as a fraction of the radius. */
  readonly thickness: number;
  readonly dayColor: string;
  readonly twilightColor: string;
  readonly intensity: number;
  /** Exponent of the density falloff with height (higher = thinner glow). */
  readonly falloff?: number;
  /** Strength of forward scattering when backlit. */
  readonly forward?: number;
}

/** Limb glow shell. Add `mesh` to the planet's (untransformed-scale) group at the planet centre. */
export class Atmosphere {
  readonly mesh: Mesh<SphereGeometry, ShaderMaterial>;

  constructor(center: Vector3, sunDirWorld: Vector3, options: AtmosphereOptions) {
    const shell = options.radius * (1 + options.thickness);
    const material = new ShaderMaterial({
      vertexShader: atmosphereVert,
      fragmentShader: atmosphereFrag,
      side: BackSide,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uCenter: { value: center.clone() },
        uRadius: { value: options.radius },
        uShell: { value: shell },
        uSunDir: { value: sunDirWorld.clone() },
        uDayColor: { value: new Color(options.dayColor) },
        uTwilightColor: { value: new Color(options.twilightColor) },
        uIntensity: { value: options.intensity },
        uFalloff: { value: options.falloff ?? 2.2 },
        uForward: { value: options.forward ?? 0.6 },
      },
    });
    this.mesh = new Mesh(unitSphere(96), material);
    this.mesh.scale.setScalar(shell);
    this.mesh.renderOrder = 2;
  }

  set intensity(value: number) {
    this.mesh.material.uniforms.uIntensity!.value = value;
  }
}
