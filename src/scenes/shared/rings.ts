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
  type Texture,
  type Vector3,
} from 'three';
import ringsFrag from '../../shaders/saturn/rings.frag';
import ringsVert from '../../shaders/saturn/rings.vert';

export type RingSample = readonly [r: number, g: number, b: number, a: number];

/**
 * 1D RGBA profile texture across a ring system. `sample` receives the radius in planet radii and
 * returns linear colour plus opacity. Mipmapped so fine ringlets do not shimmer at a distance.
 */
export function ringProfileTexture(range: readonly [number, number], sample: (radius: number) => RingSample, width = 2048): DataTexture {
  const data = new Uint8Array(width * 4);
  const [r0, r1] = range;
  for (let i = 0; i < width; i++) {
    const s = sample(r0 + ((i + 0.5) / width) * (r1 - r0));
    for (let c = 0; c < 4; c++) data[i * 4 + c] = Math.round(255 * Math.min(1, Math.max(0, s[c]!)));
  }
  const texture = new DataTexture(data, width, 1, RGBAFormat, UnsignedByteType);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export interface RingSystemOptions {
  readonly center: Vector3;
  readonly planetRadius: number;
  /** Ring plane normal in world space (the planet's spin axis). */
  readonly normal: Vector3;
  readonly sunDir: Vector3;
  /** Inner and outer radius in world units. */
  readonly inner: number;
  readonly outer: number;
  readonly map: Texture;
  readonly light: number;
}

/**
 * A planetary ring system drawn as a flat annulus with the shared ring shader (planet shadow,
 * transmission, forward scattering). Add `mesh` to the planet's tilted group.
 */
export class RingSystem {
  readonly mesh: Mesh<RingGeometry, ShaderMaterial>;

  constructor(options: RingSystemOptions) {
    this.mesh = new Mesh(
      new RingGeometry(options.inner, options.outer, 256, 1),
      new ShaderMaterial({
        vertexShader: ringsVert,
        fragmentShader: ringsFrag,
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uRingMap: { value: options.map },
          uSunDir: { value: options.sunDir.clone() },
          uPlanetCenter: { value: options.center.clone() },
          uPlanetRadius: { value: options.planetRadius },
          uRingNormal: { value: options.normal.clone() },
          uLight: { value: options.light },
          uInner: { value: options.inner },
          uOuter: { value: options.outer },
        },
      }),
    );
    // RingGeometry lies in the local XY plane; lay it into the equatorial plane.
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 1;
  }

  setMap(map: Texture, inner: number, outer: number): void {
    this.mesh.geometry.dispose();
    this.mesh.geometry = new RingGeometry(inner, outer, 256, 1);
    const u = this.mesh.material.uniforms;
    u.uRingMap!.value = map;
    u.uInner!.value = inner;
    u.uOuter!.value = outer;
  }
}
