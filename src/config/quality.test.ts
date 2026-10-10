import { describe, expect, it, vi } from 'vitest';
import { FpsGovernor, detectTier, lowerTier, tierFromQuery, type DeviceInfo } from './quality';

const desktop = (gpu: string, extra: Partial<DeviceInfo> = {}): DeviceInfo => ({
  isMobile: false,
  cores: 8,
  memory: 16,
  gpu,
  saveData: false,
  ...extra,
});

describe('detectTier', () => {
  it('picks high for discrete desktop GPUs', () => {
    expect(detectTier(desktop('ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11)'))).toBe('high');
    expect(detectTier(desktop('Apple M2'))).toBe('high');
  });

  it('picks medium for integrated GPUs and unknown renderers', () => {
    expect(detectTier(desktop('ANGLE (AMD, AMD Radeon 780M Graphics (radeonsi phoenix ACO), OpenGL ES 3.2)'))).toBe('medium');
    expect(detectTier(desktop('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)'))).toBe('medium');
    expect(detectTier(desktop(''))).toBe('medium');
  });

  it('caps discrete GPUs on low-memory machines', () => {
    expect(detectTier(desktop('NVIDIA GeForce GTX 1650', { memory: 4 }))).toBe('medium');
  });

  it('falls back to low for software rendering, save-data and very few cores', () => {
    expect(detectTier(desktop('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))'))).toBe('low');
    expect(detectTier(desktop('NVIDIA GeForce RTX 4090', { saveData: true }))).toBe('low');
    expect(detectTier(desktop('NVIDIA GeForce RTX 4090', { cores: 2 }))).toBe('low');
  });

  it('keeps phones on low unless the GPU and memory are strong', () => {
    expect(detectTier({ ...desktop('Adreno (TM) 610'), isMobile: true, memory: 4 })).toBe('low');
    expect(detectTier({ ...desktop('Apple GPU'), isMobile: true, memory: undefined })).toBe('medium');
    expect(detectTier({ ...desktop('Adreno (TM) 740'), isMobile: true, memory: 8 })).toBe('medium');
  });
});

describe('tierFromQuery', () => {
  it('reads a valid override and ignores junk', () => {
    expect(tierFromQuery('?quality=low')).toBe('low');
    expect(tierFromQuery('?quality=ultra')).toBeNull();
    expect(tierFromQuery('')).toBeNull();
  });
});

describe('lowerTier', () => {
  it('steps down and saturates at low', () => {
    expect(lowerTier('high')).toBe('medium');
    expect(lowerTier('low')).toBe('low');
  });
});

describe('FpsGovernor', () => {
  const options = { window: 1, warmup: 0.5, strikes: 2, minFps: { high: 50, medium: 28, low: 0 } };

  it('downgrades after consecutive slow windows only', () => {
    const onDowngrade = vi.fn();
    const governor = new FpsGovernor('high', onDowngrade, options);
    for (let i = 0; i < 30; i++) governor.sample(1 / 30); // warm-up + half a slow window
    expect(onDowngrade).not.toHaveBeenCalled();
    for (let i = 0; i < 60; i++) governor.sample(1 / 30); // two complete slow windows

    expect(onDowngrade).toHaveBeenCalledWith('medium');
    expect(governor.current).toBe('medium');
  });

  it('resets strikes after a fast window and ignores long hitches', () => {
    const onDowngrade = vi.fn();
    const governor = new FpsGovernor('high', onDowngrade, options);
    for (let i = 0; i < 45; i++) governor.sample(1 / 30);
    for (let i = 0; i < 70; i++) governor.sample(1 / 60);
    for (let i = 0; i < 31; i++) governor.sample(1 / 30);
    governor.sample(2);
    expect(onDowngrade).not.toHaveBeenCalled();
  });
});
