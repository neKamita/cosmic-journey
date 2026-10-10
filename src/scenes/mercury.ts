import surface from '../shaders/planets/mercury.glsl';
import { at } from '../camera/anchors';
import { MERCURY } from '../config/layout';
import type { QualitySettings } from '../config/quality';
import { PlanetBody } from './shared/PlanetBody';

/** Mercury: airless and cratered. */
export class Mercury extends PlanetBody {
  constructor(quality: QualitySettings) {
    super(
      {
        id: 'mercury',
        layout: MERCURY,
        active: [at('sun', 0.45), at('mars', 0.2)],
        surface,
        normalStrength: 0.035,
        texture: 'mercury',
        normalTexture: 'mercury_normal',
        roughness: 0.97,
        normalScale: 1.2,
        initialSpin: 1.1,
      },
      quality,
    );
  }
}
