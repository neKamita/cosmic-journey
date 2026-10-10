import { Color } from 'three';
import { at, type ChapterRanges } from './anchors';
import { ColorTrack, NumberTrack, linear, type AnchoredKey } from './timeline';
import { CHAPTERS, type ChapterId } from '../config/chapters';

/** Everything about the look of the scene that changes with scroll progress. */
export interface EnvState {
  exposure: number;
  bloom: number;
  background: Color;
  /** Multiplicative colour grade: warm near the Sun, cold at the ice giants. */
  tint: Color;
  saturation: number;
  /** Brightness of the sky star sphere. */
  stars: number;
  /** Opacity of the near parallax star layer. */
  nearStars: number;
  milkyWay: number;
  ambient: number;
  vignette: number;
  aberration: number;
  grain: number;
  /** Scale of the deep-space root ("Powers of Ten" zoom-out). */
  deepScale: number;
  godRays: number;
  lens: number;
  /** Opacity of the deep-space layers. */
  galaxy: number;
  nebula: number;
  cluster: number;
  web: number;
  accent: Color;
}

const n = (chapter: ChapterId, t: number, value: number): AnchoredKey<number> => ({ at: at(chapter, t), value });
const c = (chapter: ChapterId, t: number, hex: string): AnchoredKey<Color> => ({
  at: at(chapter, t),
  value: new Color(hex),
});

const KEYS = {
  exposure: [n('earth', 0, 1), n('sun', 0.18, 0.85), n('inner', 0.2, 1), n('blackhole', 0.2, 1.1), n('galaxy', 0.3, 1.2), n('universe', 0.3, 1.3)],
  bloom: [
    n('earth', 0, 0.55),
    n('sun', 0.18, 0.8),
    n('inner', 0.25, 0.75),
    n('heliopause', 0.2, 1.1),
    n('blackhole', 0.2, 1.5),
    n('galaxy', 0.3, 0.7),
    n('universe', 0.3, 0.9),
  ],
  background: [
    c('earth', 0, '#020309'),
    c('sun', 0.18, '#0b0604'),
    c('inner', 0.3, '#040305'),
    c('mars', 0.2, '#030206'),
    c('ice', 0.2, '#01060c'),
    c('heliopause', 0.2, '#010207'),
    c('blackhole', 0.2, '#000000'),
    c('galaxy', 0.3, '#010006'),
    c('universe', 0.3, '#000003'),
  ],
  tint: [
    c('earth', 0, '#ffffff'),
    c('moon', 0.6, '#ffffff'),
    c('sun', 0.18, '#ffd9b5'),
    c('inner', 0.2, '#fff0dc'),
    c('mars', 0.2, '#fff0e6'),
    c('asteroids', 0.2, '#ffffff'),
    c('ice', 0.2, '#d6eaff'),
    c('heliopause', 0.2, '#eef0ff'),
    c('blackhole', 0.2, '#fff0e0'),
    c('galaxy', 0.3, '#f4eeff'),
    c('universe', 0.3, '#e8efff'),
  ],
  saturation: [n('earth', 0, 1), n('ice', 0.2, 0.9), n('heliopause', 0.2, 1), n('universe', 0.3, 1.08)],
  stars: [
    n('earth', 0, 0.75),
    n('sun', 0.18, 0.3),
    n('inner', 0.3, 0.6),
    n('mars', 0.2, 0.85),
    n('heliopause', 0.2, 1),
    n('blackhole', 0.2, 0.9),
    n('galaxy', 0.06, 0.7),
    n('galaxy', 0.2, 0),
  ],
  nearStars: [n('earth', 0, 0.45), n('heliopause', 0.2, 0.6), n('blackhole', 0.2, 0.3), n('galaxy', 0.06, 0)],
  milkyWay: [n('earth', 0, 0.45), n('sun', 0.18, 0.25), n('mars', 0.2, 0.75), n('heliopause', 0.2, 0.95), n('blackhole', 0.15, 0.25), n('galaxy', 0.1, 0)],
  ambient: [n('earth', 0, 0.035), n('blackhole', 0.2, 0.02)],
  vignette: [n('earth', 0, 0.38), n('sun', 0.18, 0.25), n('blackhole', 0.2, 0.55), n('galaxy', 0.3, 0.4), n('universe', 0.3, 0.5)],
  aberration: [n('earth', 0, 0.0005), n('asteroids', 0.24, 0.0009), n('jupiter', 0.18, 0.0005), n('blackhole', 0.3, 0.0013), n('galaxy', 0.3, 0.0006)],
  grain: [n('earth', 0, 0.06)],
  deepScale: [
    { at: at('galaxy', 0.3), value: 1 },
    { at: at('galaxy', 0.85), value: 0.06, ease: linear },
    { at: at('universe', 0.3), value: 0.0025 },
  ],
  godRays: [n('moon', 0.5, 0), n('sun', 0.08, 0.75), n('sun', 0.62, 0.75), n('inner', 0.08, 0)],
  lens: [n('heliopause', 0.75, 0), n('blackhole', 0.05, 1), n('blackhole', 0.8, 1), n('galaxy', 0.08, 0)],
  galaxy: [n('heliopause', 0.6, 0), n('blackhole', 0, 1), n('galaxy', 0.85, 1), n('universe', 0.3, 0.75)],
  nebula: [n('blackhole', 0.75, 0), n('galaxy', 0.04, 1), n('galaxy', 0.2, 1), n('galaxy', 0.4, 0)],
  cluster: [n('galaxy', 0.45, 0), n('galaxy', 0.7, 1), n('universe', 0.35, 0.65)],
  web: [n('galaxy', 0.8, 0), n('universe', 0.2, 1)],
  accent: CHAPTERS.map((ch) => c(ch.id, ch.focus, ch.accent)),
} as const;

export class EnvTimeline {
  readonly state: EnvState;
  private readonly numbers: Array<[Exclude<keyof EnvState, 'background' | 'tint' | 'accent'>, NumberTrack]>;
  private readonly colors: Array<['background' | 'tint' | 'accent', ColorTrack]>;

  constructor(ranges: ChapterRanges) {
    this.numbers = [
      ['exposure', new NumberTrack(KEYS.exposure, ranges)],
      ['bloom', new NumberTrack(KEYS.bloom, ranges)],
      ['saturation', new NumberTrack(KEYS.saturation, ranges)],
      ['stars', new NumberTrack(KEYS.stars, ranges)],
      ['nearStars', new NumberTrack(KEYS.nearStars, ranges)],
      ['milkyWay', new NumberTrack(KEYS.milkyWay, ranges)],
      ['ambient', new NumberTrack(KEYS.ambient, ranges)],
      ['vignette', new NumberTrack(KEYS.vignette, ranges)],
      ['aberration', new NumberTrack(KEYS.aberration, ranges)],
      ['grain', new NumberTrack(KEYS.grain, ranges)],
      ['deepScale', new NumberTrack(KEYS.deepScale, ranges, 'log')],
      ['godRays', new NumberTrack(KEYS.godRays, ranges)],
      ['lens', new NumberTrack(KEYS.lens, ranges)],
      ['galaxy', new NumberTrack(KEYS.galaxy, ranges)],
      ['nebula', new NumberTrack(KEYS.nebula, ranges)],
      ['cluster', new NumberTrack(KEYS.cluster, ranges)],
      ['web', new NumberTrack(KEYS.web, ranges)],
    ];
    this.colors = [
      ['background', new ColorTrack(KEYS.background, ranges)],
      ['tint', new ColorTrack(KEYS.tint, ranges)],
      ['accent', new ColorTrack(KEYS.accent, ranges)],
    ];
    this.state = {
      exposure: 1,
      bloom: 1,
      background: new Color(),
      tint: new Color(1, 1, 1),
      saturation: 1,
      stars: 1,
      nearStars: 0,
      milkyWay: 0,
      ambient: 0,
      vignette: 0,
      aberration: 0,
      grain: 0,
      deepScale: 1,
      godRays: 0,
      lens: 0,
      galaxy: 0,
      nebula: 0,
      cluster: 0,
      web: 0,
      accent: new Color(),
    };
  }

  resolve(ranges: ChapterRanges): void {
    for (const [, track] of this.numbers) track.resolve(ranges);
    for (const [, track] of this.colors) track.resolve(ranges);
  }

  sample(p: number): EnvState {
    for (const [name, track] of this.numbers) this.state[name] = track.sample(p);
    for (const [name, track] of this.colors) this.state[name].copy(track.sample(p));
    return this.state;
  }
}
