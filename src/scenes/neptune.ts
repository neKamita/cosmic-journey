import surface from '../shaders/planets/neptune.glsl';
import { at } from '../camera/anchors';
import { NEPTUNE } from '../config/layout';
import type { QualitySettings } from '../config/quality';
import { PlanetBody } from './shared/PlanetBody';

/** Neptune: the deep blue, windiest planet, at the edge of the planetary system. */
export class Neptune extends PlanetBody {
  constructor(quality: QualitySettings) {
    super(
      {
        id: 'neptune',
        layout: NEPTUNE,
        active: [at('saturn', 0.6), at('heliopause', 0.4)],
        surface,
        texture: 'neptune',
        roughness: 1,
        initialSpin: 2.2,
        maxViewDistance: 1400,
        haze: { day: '#6f98ff', twilight: '#4c6bc9', strength: 0.2, power: 2.6 },
        atmosphere: {
          thickness: 0.045,
          dayColor: '#6d95ff',
          twilightColor: '#3c5ab8',
          intensity: 0.9,
          falloff: 2,
          forward: 0.6,
        },
      },
      quality,
    );
  }
}
