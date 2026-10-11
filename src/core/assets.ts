import {
  LoadingManager,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
  type WebGLRenderer,
} from 'three';
import manifestJson from '../config/textures.json';
import type { QualitySettings } from '../config/quality';
import { whenIdle } from '../utils/schedule';

export type TextureName =
  | 'earth_day'
  | 'earth_night'
  | 'earth_clouds'
  | 'earth_normal'
  | 'earth_roughness'
  | 'moon_color'
  | 'moon_normal'
  | 'mercury'
  | 'mercury_normal'
  | 'venus_atmosphere'
  | 'mars'
  | 'mars_normal'
  | 'jupiter'
  | 'saturn'
  | 'saturn_ring'
  | 'uranus'
  | 'neptune';

type Manifest = Partial<Record<string, { '4k'?: string; '2k'?: string }>>;
const MANIFEST = manifestJson as Manifest;

const idle = (): Promise<void> => whenIdle();

/** Maps holding colour (decoded as sRGB). Everything else is data (normals, roughness, coverage). */
const COLOR_MAPS = new Set<TextureName>([
  'earth_day',
  'earth_night',
  'moon_color',
  'mercury',
  'venus_atmosphere',
  'mars',
  'jupiter',
  'saturn',
  'saturn_ring',
  'uranus',
  'neptune',
]);

/** Textures needed for the first screen; the loader waits for these. */
export const CRITICAL_TEXTURES: readonly TextureName[] = [
  'earth_day',
  'earth_night',
  'earth_clouds',
  'earth_normal',
  'earth_roughness',
  'moon_color',
  'moon_normal',
];

/**
 * Texture registry backed by the manifest the texture pipeline writes. Missing entries resolve to
 * null so scene modules can keep their procedural fallback. Loads are de-duplicated, uploaded to the
 * GPU right away (avoids hitches the first time an object appears) and split between a critical
 * manager (drives the loading screen) and a background one (streams the rest in route order).
 */
export class AssetLibrary {
  readonly critical = new LoadingManager();
  readonly background = new LoadingManager();
  private readonly cache = new Map<TextureName, Promise<Texture | null>>();
  private readonly anisotropy: number;

  constructor(
    private readonly renderer: WebGLRenderer,
    private quality: QualitySettings,
  ) {
    this.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

  has(name: TextureName): boolean {
    return this.url(name) !== null;
  }

  /** Requests a texture immediately; resolves with null when it is not available. */
  load(name: TextureName, critical = false): Promise<Texture | null> {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const promise = this.fetch(name, critical);
    this.cache.set(name, promise);
    return promise;
  }

  /**
   * Requests a texture through a serial background queue: one download and GPU upload at a time,
   * each started when the main thread is idle, in the order modules ask (= route order).
   */
  queue(name: TextureName): Promise<Texture | null> {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const promise = this.chain.then(idle).then(() => this.fetch(name, false));
    this.chain = promise.catch(() => null);
    this.cache.set(name, promise);
    return promise;
  }

  private chain: Promise<unknown> = Promise.resolve();

  private fetch(name: TextureName, critical: boolean): Promise<Texture | null> {
    const url = this.url(name);
    if (!url) return Promise.resolve(null);
    return new TextureLoader(critical ? this.critical : this.background)
      .loadAsync(url)
      .then((texture) => this.prepare(name, texture))
      .catch((error: unknown) => {
        console.warn(`[assets] ${name} failed to load, using fallback`, error);
        return null;
      });
  }

  /** Loads the critical set and reports progress (0..1) as files complete. */
  async preloadCritical(onProgress: (fraction: number) => void): Promise<void> {
    const names = CRITICAL_TEXTURES.filter((n) => this.has(n));
    if (names.length === 0) {
      onProgress(1);
      return;
    }
    this.critical.onProgress = (_url, loaded, total) => onProgress(total ? loaded / total : 1);
    await Promise.all(names.map((n) => this.load(n, true)));
  }

  setQuality(quality: QualitySettings): void {
    // Already loaded textures are kept; only future loads use the new resolution.
    this.quality = quality;
  }

  private url(name: TextureName): string | null {
    const entry = MANIFEST[name];
    if (!entry) return null;
    const preferred = this.quality.textures === '4k' ? (entry['4k'] ?? entry['2k']) : (entry['2k'] ?? entry['4k']);
    return preferred ? `${import.meta.env.BASE_URL}${preferred}` : null;
  }

  private prepare(name: TextureName, texture: Texture): Texture {
    texture.colorSpace = COLOR_MAPS.has(name) ? SRGBColorSpace : NoColorSpace;
    texture.anisotropy = this.anisotropy;
    if (name !== 'saturn_ring') texture.wrapS = RepeatWrapping;
    texture.name = name;
    this.renderer.initTexture(texture);
    return texture;
  }
}
