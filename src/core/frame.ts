import type { PerspectiveCamera, Vector3 } from 'three';
import type { EnvState } from '../camera/envTracks';
import type { ChapterId } from '../config/chapters';
import type { QualitySettings } from '../config/quality';

/** Per-frame state handed to every scene module. */
export interface FrameContext {
  /** Animation clock in seconds, already scaled by `motion`. */
  time: number;
  /** Real frame delta in seconds (clamped). */
  dt: number;
  /** Global scroll progress 0..1. */
  progress: number;
  chapter: ChapterId;
  chapterLocal: number;
  camera: PerspectiveCamera;
  /** Point the camera is looking at. */
  cameraTarget: Vector3;
  env: EnvState;
  quality: QualitySettings;
  /** 1 normally; reduced under prefers-reduced-motion to slow autonomous animation. */
  motion: number;
}
