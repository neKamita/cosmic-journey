import type { ChapterRanges } from '../camera/anchors';
import { NumberTrack } from '../camera/timeline';
import { DISTANCE_KEYS } from '../config/distances';
import { formatDistance } from '../utils/format';

/** "Distance from Earth" readout, interpolated geometrically between real distances. */
export class DistanceCounter {
  private readonly track: NumberTrack;
  private text = '';

  constructor(
    private readonly el: HTMLElement,
    ranges: ChapterRanges,
  ) {
    this.track = new NumberTrack(
      DISTANCE_KEYS.map((k) => ({ at: k.at, value: k.km })),
      ranges,
      'log',
    );
  }

  resolve(ranges: ChapterRanges): void {
    this.track.resolve(ranges);
  }

  update(progress: number): void {
    const text = formatDistance(this.track.sample(progress));
    if (text !== this.text) {
      this.el.textContent = text;
      this.text = text;
    }
  }
}
