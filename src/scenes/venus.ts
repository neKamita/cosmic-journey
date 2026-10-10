import surface from '../shaders/planets/venus.glsl';
import { at } from '../camera/anchors';
import { VENUS } from '../config/layout';
import type { QualitySettings } from '../config/quality';
import { PlanetBody } from './shared/PlanetBody';

/** Venus: only its featureless cloud deck is visible, wrapped in a thick, bright atmosphere. */
export class Venus extends PlanetBody {
  constructor(quality: QualitySettings) {
    super(
      {
        id: 'venus',
        layout: VENUS,
        active: [at('sun', 0.45), at('mars', 0.35)],
        surface,
        texture: 'venus_atmosphere',
        roughness: 1,
        haze: { day: '#f6e2b0', twilight: '#c9773e', strength: 0.55, power: 1.4 },
        atmosphere: {
          thickness: 0.075,
          dayColor: '#f4dcaa',
          twilightColor: '#d38b4c',
          intensity: 1.15,
          falloff: 1.6,
          forward: 0.9,
        },
      },
      quality,
    );
  }
}
