import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { at, defaultRanges } from './anchors';
import { CAMERA_KEYS } from './cameraKeys';
import { CameraPath, createCameraSample, type CameraKey } from './cameraPath';

const keys: CameraKey[] = [
  { at: at('earth', 0), position: new Vector3(0, 0, 0), target: new Vector3(0, 0, -1), fov: 40, near: 0.1, far: 100 },
  { at: at('moon', 0.5), position: new Vector3(10, 0, 0), target: new Vector3(10, 0, -1), fov: 60, stop: false },
  { at: at('sun', 0.5), position: new Vector3(20, 5, 0), target: new Vector3(20, 0, -1), near: 1, far: 10000 },
];

describe('CameraPath', () => {
  const ranges = defaultRanges();
  const path = new CameraPath(keys, ranges);
  const sample = createCameraSample();

  it('passes exactly through every key at its anchor', () => {
    keys.forEach((key, i) => {
      path.sample(path.keyProgress(i), sample);
      expect(sample.position.distanceTo(key.position)).toBeLessThan(1e-6);
      expect(sample.target.distanceTo(key.target)).toBeLessThan(1e-6);
    });
  });

  it('carries optional values forward from the previous key', () => {
    path.sample(path.keyProgress(1), sample);
    expect(sample.near).toBeCloseTo(0.1);
    expect(sample.far).toBeCloseTo(100);
    path.sample(path.keyProgress(2), sample);
    expect(sample.fov).toBeCloseTo(60);
  });

  it('clamps outside the keyed range', () => {
    path.sample(1, sample);
    expect(sample.position.distanceTo(keys[2]!.position)).toBeLessThan(1e-6);
  });

  it('interpolates near/far geometrically', () => {
    const mid = (path.keyProgress(1) + path.keyProgress(2)) / 2;
    path.sample(mid, sample);
    expect(sample.near).toBeGreaterThan(0.1);
    expect(sample.near).toBeLessThan(1);
  });
});

describe('CAMERA_KEYS', () => {
  it('are ordered along the journey and produce finite samples everywhere', () => {
    const ranges = defaultRanges();
    const path = new CameraPath(CAMERA_KEYS, ranges);
    for (let i = 1; i < path.keyCount; i++) {
      expect(path.keyProgress(i)).toBeGreaterThanOrEqual(path.keyProgress(i - 1));
    }
    const sample = createCameraSample();
    for (let p = 0; p <= 1.0001; p += 0.01) {
      path.sample(p, sample);
      expect(Number.isFinite(sample.position.x + sample.position.y + sample.position.z)).toBe(true);
      expect(sample.near).toBeLessThan(sample.far);
      expect(sample.position.distanceTo(sample.target)).toBeGreaterThan(sample.near);
    }
  });
});
