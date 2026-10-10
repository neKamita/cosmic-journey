export type Tier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  readonly tier: Tier;
  readonly maxDpr: number;
  /** Post-processing chain (bloom, tone mapping, grading). Off on low: direct render with ACES. */
  readonly postfx: boolean;
  readonly multisampling: number;
  readonly aberration: boolean;
  readonly grain: boolean;
  readonly godRays: boolean;
  readonly lens: boolean;
  readonly shadows: boolean;
  readonly shadowMapSize: number;
  readonly textures: '4k' | '2k';
  /** Fraction of particles / instances drawn. */
  readonly particleScale: number;
  /** Width segments of the highest planet LOD. */
  readonly sphereSegments: number;
}

export const QUALITY: Readonly<Record<Tier, QualitySettings>> = {
  high: {
    tier: 'high',
    maxDpr: 2,
    postfx: true,
    multisampling: 4,
    aberration: true,
    grain: true,
    godRays: true,
    lens: true,
    shadows: true,
    shadowMapSize: 2048,
    textures: '4k',
    particleScale: 1,
    sphereSegments: 128,
  },
  medium: {
    tier: 'medium',
    maxDpr: 1.5,
    postfx: true,
    multisampling: 0,
    aberration: false,
    grain: true,
    godRays: true,
    lens: true,
    shadows: true,
    shadowMapSize: 1024,
    textures: '2k',
    particleScale: 0.6,
    sphereSegments: 96,
  },
  low: {
    tier: 'low',
    maxDpr: 1,
    postfx: false,
    multisampling: 0,
    aberration: false,
    grain: false,
    godRays: false,
    lens: false,
    shadows: false,
    shadowMapSize: 512,
    textures: '2k',
    particleScale: 0.3,
    sphereSegments: 64,
  },
};

export const TIER_ORDER: readonly Tier[] = ['low', 'medium', 'high'];

export function lowerTier(tier: Tier): Tier {
  const i = TIER_ORDER.indexOf(tier);
  return TIER_ORDER[Math.max(0, i - 1)]!;
}

export interface DeviceInfo {
  readonly isMobile: boolean;
  readonly cores: number;
  /** navigator.deviceMemory in GB when exposed. */
  readonly memory?: number | undefined;
  /** Unmasked WebGL renderer string, or empty when unavailable. */
  readonly gpu: string;
  readonly saveData: boolean;
}

const SOFTWARE_GPU = /swiftshader|llvmpipe|softpipe|software|microsoft basic/i;
const STRONG_MOBILE_GPU = /apple gpu|adreno \(tm\) (7[3-9]\d|8\d\d)|adreno 7[3-9]\d|adreno 8\d\d|mali-g7[1-9]|mali-g[6-9]\d\d|immortalis/i;
const DISCRETE_GPU = /nvidia|geforce|quadro|rtx|radeon rx|radeon pro|arc a\d|arc b\d|apple m\d/i;
const INTEGRATED_GPU = /intel|uhd|iris|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics|\d{3}m graphics|adreno|mali/i;

/** Initial quality tier from device hints. Pure, so it can be unit-tested. */
export function detectTier(info: DeviceInfo): Tier {
  if (info.saveData || SOFTWARE_GPU.test(info.gpu)) return 'low';
  if (info.cores > 0 && info.cores < 4) return 'low';

  if (info.isMobile) {
    const strong = STRONG_MOBILE_GPU.test(info.gpu) && (info.memory === undefined || info.memory >= 6);
    return strong ? 'medium' : 'low';
  }

  const memoryCap: Tier = info.memory !== undefined && info.memory <= 4 ? 'medium' : 'high';
  if (DISCRETE_GPU.test(info.gpu)) return memoryCap;
  if (INTEGRATED_GPU.test(info.gpu)) return 'medium';
  return 'medium';
}

export function tierFromQuery(search: string): Tier | null {
  const value = new URLSearchParams(search).get('quality');
  return value === 'low' || value === 'medium' || value === 'high' ? value : null;
}

export function readDeviceInfo(gl: WebGLRenderingContext | WebGL2RenderingContext | null): DeviceInfo {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
    userAgentData?: { mobile?: boolean };
  };
  let gpu = '';
  if (gl) {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  }
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 820;
  return {
    isMobile: nav.userAgentData?.mobile ?? (coarse && small),
    cores: nav.hardwareConcurrency ?? 4,
    memory: nav.deviceMemory,
    gpu,
    saveData: nav.connection?.saveData ?? false,
  };
}

export interface GovernorOptions {
  /** Seconds per measurement window. */
  readonly window: number;
  /** Ignore the first seconds after start (shader warm-up, texture uploads). */
  readonly warmup: number;
  /** Consecutive slow windows required to downgrade. */
  readonly strikes: number;
  /** Minimum average FPS per tier before a downgrade is considered. */
  readonly minFps: Readonly<Record<Tier, number>>;
}

const DEFAULT_GOVERNOR: GovernorOptions = {
  window: 2,
  warmup: 4,
  strikes: 2,
  minFps: { high: 50, medium: 28, low: 0 },
};

/**
 * Watches frame times and steps the quality tier down when the device cannot keep up.
 * It never steps back up, which avoids oscillating between tiers.
 */
export class FpsGovernor {
  private elapsed = 0;
  private windowTime = 0;
  private windowFrames = 0;
  private slowWindows = 0;

  constructor(
    private tier: Tier,
    private readonly onDowngrade: (tier: Tier) => void,
    private readonly options: GovernorOptions = DEFAULT_GOVERNOR,
  ) {}

  get current(): Tier {
    return this.tier;
  }

  /** Feed one frame. dt in seconds. Frames longer than 0.5 s (tab switches, hitches) are ignored. */
  sample(dt: number): void {
    if (dt <= 0 || dt > 0.5 || this.tier === 'low') return;
    this.elapsed += dt;
    if (this.elapsed < this.options.warmup) return;

    this.windowTime += dt;
    this.windowFrames += 1;
    if (this.windowTime < this.options.window) return;

    const fps = this.windowFrames / this.windowTime;
    this.windowTime = 0;
    this.windowFrames = 0;
    this.slowWindows = fps < this.options.minFps[this.tier] ? this.slowWindows + 1 : 0;

    if (this.slowWindows >= this.options.strikes) {
      this.tier = lowerTier(this.tier);
      this.slowWindows = 0;
      this.elapsed = 0;
      this.onDowngrade(this.tier);
    }
  }
}
