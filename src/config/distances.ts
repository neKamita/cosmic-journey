import { at, type Anchor } from '../camera/anchors';
import { LIGHT_YEAR_KM } from '../utils/format';

/**
 * Real distances from Earth (km) at points of the journey. Values between keys are interpolated
 * geometrically, which keeps the counter readable across 20 orders of magnitude.
 */
export const DISTANCE_KEYS: ReadonlyArray<{ at: Anchor; km: number }> = [
  { at: at('earth', 0), km: 400 },
  { at: at('earth', 0.5), km: 2_000 },
  { at: at('moon', 0.18), km: 384_400 },
  { at: at('sun', 0.18), km: 149.6e6 },
  { at: at('inner', 0.16), km: 77e6 },
  { at: at('inner', 0.52), km: 38e6 },
  { at: at('mars', 0.18), km: 54.6e6 },
  { at: at('asteroids', 0.3), km: 180e6 },
  { at: at('jupiter', 0.18), km: 588e6 },
  { at: at('saturn', 0.14), km: 1.2e9 },
  { at: at('ice', 0.14), km: 2.6e9 },
  { at: at('ice', 0.52), km: 4.3e9 },
  { at: at('heliopause', 0.2), km: 25.9e9 },
  { at: at('heliopause', 0.7), km: 1 * LIGHT_YEAR_KM },
  { at: at('blackhole', 0.18), km: 26_700 * LIGHT_YEAR_KM },
  { at: at('galaxy', 0.3), km: 150_000 * LIGHT_YEAR_KM },
  { at: at('galaxy', 0.6), km: 2.5e6 * LIGHT_YEAR_KM },
  { at: at('galaxy', 0.85), km: 54e6 * LIGHT_YEAR_KM },
  { at: at('universe', 0.3), km: 46.5e9 * LIGHT_YEAR_KM },
];
