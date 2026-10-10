import { CatmullRomCurve3, Vector3 } from 'three';
import type { Anchor, ChapterRanges } from './anchors';
import { findSegment, resolveStops } from './timeline';
import { hermite01, lerp, logLerp } from '../utils/math';

export interface CameraKey {
  readonly at: Anchor;
  readonly position: Vector3;
  readonly target: Vector3;
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
  /** Horizontal framing: fraction of the viewport width the target is shifted by (+ = right). */
  readonly frame?: number;
  /** The camera settles (zero velocity) at this key. Pass-through keys keep it moving. */
  readonly stop?: boolean;
}

export interface CameraSample {
  readonly position: Vector3;
  readonly target: Vector3;
  fov: number;
  near: number;
  far: number;
  frame: number;
}

export function createCameraSample(): CameraSample {
  return { position: new Vector3(), target: new Vector3(), fov: 45, near: 0.1, far: 1000, frame: 0 };
}

interface FilledKey {
  fov: number;
  near: number;
  far: number;
  frame: number;
  stop: boolean;
}

/**
 * Scroll-driven camera rail. Positions and look-at targets follow two Catmull-Rom curves through the
 * keys. The curve parameter is index-based, so key i is reached exactly at its anchor; within each
 * segment a cubic Hermite ease decides whether the camera settles at a key or flies through it.
 */
export class CameraPath {
  private readonly positions: CatmullRomCurve3;
  private readonly targets: CatmullRomCurve3;
  private readonly filled: FilledKey[];
  private stops: number[];

  constructor(
    private readonly keys: readonly CameraKey[],
    ranges: ChapterRanges,
  ) {
    if (keys.length < 2) throw new Error('CameraPath needs at least two keys');
    this.positions = new CatmullRomCurve3(
      keys.map((k) => k.position.clone()),
      false,
      'centripetal',
    );
    this.targets = new CatmullRomCurve3(
      keys.map((k) => k.target.clone()),
      false,
      'centripetal',
    );

    let prev: FilledKey = { fov: 45, near: 0.1, far: 2000, frame: 0, stop: true };
    this.filled = keys.map((k) => {
      prev = {
        fov: k.fov ?? prev.fov,
        near: k.near ?? prev.near,
        far: k.far ?? prev.far,
        frame: k.frame ?? prev.frame,
        stop: k.stop ?? true,
      };
      return prev;
    });
    this.stops = resolveStops(
      keys.map((k) => k.at),
      ranges,
    );
  }

  get keyCount(): number {
    return this.keys.length;
  }

  /** Global progress at which key i is reached. */
  keyProgress(i: number): number {
    return this.stops[i] ?? 0;
  }

  resolve(ranges: ChapterRanges): void {
    this.stops = resolveStops(
      this.keys.map((k) => k.at),
      ranges,
    );
  }

  sample(p: number, out: CameraSample): CameraSample {
    const seg = findSegment(this.stops, p);
    const a = this.filled[seg.index]!;
    const b = this.filled[seg.index + 1] ?? a;
    const eased = hermite01(seg.t, a.stop ? 0 : 1, b.stop ? 0 : 1);
    const u = (seg.index + eased) / (this.keys.length - 1);

    this.positions.getPoint(u, out.position);
    this.targets.getPoint(u, out.target);
    out.fov = lerp(a.fov, b.fov, eased);
    out.near = logLerp(a.near, b.near, eased);
    out.far = logLerp(a.far, b.far, eased);
    out.frame = lerp(a.frame, b.frame, eased);
    return out;
  }
}
