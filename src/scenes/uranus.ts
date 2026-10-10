import { Vector3 } from 'three';
import surface from '../shaders/planets/uranus.glsl';
import { at } from '../camera/anchors';
import { URANUS } from '../config/layout';
import type { QualitySettings } from '../config/quality';
import { PlanetBody } from './shared/PlanetBody';
import { RingSystem, ringProfileTexture } from './shared/rings';

/** Uranus' narrow rings, in Uranus radii (6, 5, 4, α, β, η, γ, δ, λ, ε). */
const RINGS: ReadonlyArray<readonly [radius: number, width: number, alpha: number]> = [
  [1.637, 0.002, 0.45],
  [1.652, 0.002, 0.45],
  [1.666, 0.002, 0.45],
  [1.75, 0.003, 0.6],
  [1.786, 0.003, 0.6],
  [1.849, 0.0025, 0.4],
  [1.863, 0.002, 0.55],
  [1.9, 0.003, 0.6],
  [1.96, 0.0015, 0.3],
  [2.0, 0.008, 0.9],
];
const RANGE: readonly [number, number] = [1.6, 2.05];

/** Uranus: tipped on its side (98°) with dark, narrow rings. */
export class Uranus extends PlanetBody {
  constructor(quality: QualitySettings) {
    super(
      {
        id: 'uranus',
        layout: URANUS,
        active: [at('saturn', 0.5), at('heliopause', 0.35)],
        surface,
        texture: 'uranus',
        roughness: 1,
        initialSpin: 0.4,
        maxViewDistance: 1400,
        haze: { day: '#bfeaf2', twilight: '#7fb3c8', strength: 0.35, power: 2.2 },
        atmosphere: {
          thickness: 0.045,
          dayColor: '#a8e2ee',
          twilightColor: '#6ea4c4',
          intensity: 0.8,
          falloff: 2,
          forward: 0.6,
        },
      },
      quality,
    );

    const map = ringProfileTexture(RANGE, (r) => {
      let alpha = 0;
      for (const [radius, width, a] of RINGS) alpha += a * Math.exp(-(((r - radius) / width) ** 2));
      return [0.12, 0.12, 0.13, Math.min(0.85, alpha)];
    });
    const rings = new RingSystem({
      center: URANUS.position,
      planetRadius: URANUS.radius,
      normal: new Vector3(0, 1, 0).applyAxisAngle(new Vector3(0, 0, 1), URANUS.tilt),
      sunDir: URANUS.position.clone().negate().normalize(),
      inner: RANGE[0] * URANUS.radius,
      outer: RANGE[1] * URANUS.radius,
      map,
      light: 0.9,
    });
    this.root.add(rings.mesh);
  }
}
