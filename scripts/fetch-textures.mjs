#!/usr/bin/env node
/**
 * Texture pipeline.
 *
 * 1. Downloads public-domain NASA source maps into textures-src/nasa/ (skipped when already present).
 * 2. Picks up Solar System Scope maps (CC BY 4.0) downloaded manually into textures-src/sss/.
 *    Their site is behind a captcha, so they cannot be fetched automatically.
 * 3. Writes web-ready textures into public/textures/{4k,2k}/ and a manifest (src/config/textures.json)
 *    listing what exists, so the app never requests a missing file and falls back to procedural
 *    materials instead.
 *
 * Usage:
 *   npm run textures                 download (if needed) and process everything available
 *   npm run textures -- --offline    only process files already on disk
 *   npm run textures -- --rebuild    rebuild all outputs from sources already on disk
 *   npm run textures -- --force      re-download NASA sources and rebuild all outputs
 */
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NASA_DIR = join(ROOT, 'textures-src', 'nasa');
const SSS_DIR = join(ROOT, 'textures-src', 'sss');
const OUT_DIR = join(ROOT, 'public', 'textures');
const MANIFEST = join(ROOT, 'src', 'config', 'textures.json');

const argv = new Set(process.argv.slice(2));
const OFFLINE = argv.has('--offline');
const FORCE = argv.has('--force');
/** Rebuild outputs from sources already on disk (implied by --force). */
const REBUILD = FORCE || argv.has('--rebuild');

/** Output widths; equirectangular maps are 2:1. */
const SIZES = { '4k': 4096, '2k': 2048 };

sharp.cache(false);

const NASA_EO = 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng';
const MOON_KIT = 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720';
const NASA_3D = 'https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/Images%20and%20Textures';

/** Public-domain sources (NASA). Attribution is listed in README.md and in the site footer. */
export const NASA_SOURCES = {
  earthDay: { file: 'world.200407.3x5400x2700.jpg', url: `${NASA_EO}/bmng-base/july/world.200407.3x5400x2700.jpg` },
  earthElevation: { file: 'gebco_08_rev_elev_5400x2700.jpg', url: `${NASA_EO}/topography/gebco_08_rev_elev_5400x2700.jpg` },
  earthBathymetry: { file: 'gebco_08_rev_bath_5400x2700.jpg', url: `${NASA_EO}/bathymetry/gebco_08_rev_bath_5400x2700.jpg` },
  earthNight: {
    file: 'BlackMarble_2016_3km.jpg',
    url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg',
  },
  earthClouds: {
    file: 'cloud_combined_8192.tif',
    url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_8192.tif',
  },
  moonColor: { file: 'lroc_color_poles_4k.tif', url: `${MOON_KIT}/lroc_color_poles_4k.tif` },
  moonHeight: { file: 'ldem_16_uint.tif', url: `${MOON_KIT}/ldem_16_uint.tif` },
  // NASA 3D Resources (https://github.com/nasa/NASA-3D-Resources). Their Jupiter, Saturn and
  // Neptune maps are only 720x360 (sharper procedural versions are used instead), and the
  // Ganymede and Callisto maps have large no-data gaps, so only these three are taken.
  marsNasa: { file: 'nasa3d_mars.jpg', url: `${NASA_3D}/Mars/Mars.jpg` },
  io: { file: 'nasa3d_io.jpg', url: `${NASA_3D}/Jupiter%20-%20Io%20%28A%29/Jupiter%20-%20Io%20%28A%29.jpg` },
  europa: { file: 'nasa3d_europa.jpg', url: `${NASA_3D}/Jupiter%20-%20Europa/Jupiter%20-%20Europa.jpg` },
};

/**
 * Solar System Scope maps, matched by suffix: any resolution prefix (2k_, 4k_, 8k_) works and the
 * largest file wins. Download from https://www.solarsystemscope.com/textures/
 */
export const SSS_SOURCES = {
  mercury: 'mercury.jpg',
  venusAtmosphere: 'venus_atmosphere.jpg',
  mars: 'mars.jpg',
  jupiter: 'jupiter.jpg',
  saturn: 'saturn.jpg',
  saturnRing: 'saturn_ring_alpha.png',
  uranus: 'uranus.jpg',
  neptune: 'neptune.jpg',
};

const log = (...parts) => console.log('[textures]', ...parts);

async function download(source) {
  const target = join(NASA_DIR, source.file);
  if (existsSync(target) && !FORCE) return target;
  if (OFFLINE) return existsSync(target) ? target : null;
  log(`downloading ${source.file}`);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(source.url, { redirect: 'follow' });
      const type = response.headers.get('content-type') ?? '';
      if (!response.ok || !response.body || type.startsWith('text/')) {
        throw new Error(`HTTP ${response.status} (${type})`);
      }
      const partial = `${target}.part`;
      await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
      await rename(partial, target);
      return target;
    } catch (error) {
      log(`  attempt ${attempt} failed: ${error.message}`);
      await rm(`${target}.part`, { force: true });
    }
  }
  log(`  giving up on ${source.file}; the app will use a procedural fallback`);
  return null;
}

/** Largest manually downloaded Solar System Scope file with the given suffix. */
async function findSss(suffix) {
  if (!existsSync(SSS_DIR)) return null;
  const files = (await readdir(SSS_DIR)).filter((f) => f.toLowerCase().endsWith(suffix));
  if (!files.length) return null;
  const rank = (f) => Number(/^(\d+)k_/i.exec(f)?.[1] ?? 0);
  files.sort((a, b) => rank(b) - rank(a));
  return join(SSS_DIR, files[0]);
}

const manifest = {};

function record(name, size, relPath) {
  manifest[name] ??= {};
  manifest[name][size] = relPath;
}

/** Sizes to emit for a source: never upscale beyond the source resolution. */
async function sizesFor(input) {
  const { width = 0 } = await sharp(input, { limitInputPixels: false }).metadata();
  return Object.entries(SIZES).filter(([, w]) => w <= Math.max(width, SIZES['2k']));
}

/**
 * Writes one texture in every applicable size. `build(width)` returns a sharp pipeline already
 * resized to the target width.
 */
async function emit(name, input, build, { format = 'jpg', quality = 88 } = {}) {
  for (const [size, width] of await sizesFor(input)) {
    const rel = `textures/${size}/${name}.${format}`;
    const out = join(OUT_DIR, size, `${name}.${format}`);
    if (existsSync(out) && !REBUILD) {
      record(name, size, rel);
      continue;
    }
    await mkdir(dirname(out), { recursive: true });
    let pipe = await build(width);
    pipe = format === 'png' ? pipe.png({ compressionLevel: 9 }) : pipe.jpeg({ quality, mozjpeg: true });
    await pipe.toFile(out);
    record(name, size, rel);
    log(`  wrote ${rel}`);
  }
}

const open = (input) => sharp(input, { limitInputPixels: false });

const resized = (input, width, height = width / 2) =>
  open(input).resize(width, Math.round(height), { fit: 'fill', kernel: 'lanczos3' });

/** Single-channel 8-bit raw heights at the given size. */
async function heights(input, width, height, { normalise = false } = {}) {
  let pipe = open(input);
  if (normalise) pipe = pipe.normalise();
  const { data, info } = await pipe
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
    .toColourspace('b-w')
    .extractChannel(0)
    .raw({ depth: 'uchar' })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Tangent-space normal map from an equirectangular height map: R = east, G = north, B = up.
 * Strength is scaled with resolution so the relief looks the same at 2K and 4K.
 */
function normalsFromHeights({ data, width, height }, strength) {
  const out = Buffer.alloc(width * height * 3);
  const k = (strength * width) / 2048 / 255;
  for (let y = 0; y < height; y++) {
    const up = Math.max(0, y - 1) * width;
    const down = Math.min(height - 1, y + 1) * width;
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const left = (x - 1 + width) % width;
      const right = (x + 1) % width;
      const dx = (data[row + right] - data[row + left]) * k;
      const dy = (data[down + x] - data[up + x]) * k;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (row + x) * 3;
      out[i] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((dy * inv * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((inv * 0.5 + 0.5) * 255);
    }
  }
  return sharp(out, { raw: { width, height, channels: 3 } });
}

async function processEarth(src) {
  if (src.earthDay) {
    log('earth: day map');
    await emit('earth_day', src.earthDay, (w) => resized(src.earthDay, w));
  }
  if (src.earthNight) {
    log('earth: city lights');
    // Black Marble also shows moonlit terrain and ice, which is bluish (B > R), while city lights are
    // warm (R > B). R - 0.6 B isolates the lights; the rest is stretched to full range.
    await emit('earth_night', src.earthNight, (w) =>
      resized(src.earthNight, w)
        .recomb([
          [1, 0, -0.6],
          [1, 0, -0.6],
          [1, 0, -0.6],
        ])
        .linear(3.2, -12)
        .toColourspace('b-w'),
    );
  }
  if (src.earthClouds) {
    log('earth: clouds');
    await emit('earth_clouds', src.earthClouds, (w) => resized(src.earthClouds, w).greyscale());
  }
  if (src.earthElevation) {
    log('earth: normal map');
    await emit('earth_normal', src.earthElevation, async (w) =>
      normalsFromHeights(await heights(src.earthElevation, w, w / 2), 4.5),
    );
  }
  if (src.earthBathymetry) {
    log('earth: roughness (ocean mask)');
    // GEBCO bathymetry is pure white on land and grey over oceans. Oceans become glossy
    // (roughness 0.35) so the sun glints off them; land stays matte (0.85).
    await emit('earth_roughness', src.earthBathymetry, (w) =>
      resized(src.earthBathymetry, w)
        .greyscale()
        .threshold(250)
        .linear(0.5, 0.35 * 255)
        .blur(0.6),
    );
  }
}

async function processMoon(src) {
  if (src.moonColor) {
    log('moon: colour');
    await emit('moon_color', src.moonColor, (w) => resized(src.moonColor, w).toColourspace('srgb'));
  }
  if (src.moonHeight) {
    log('moon: normal map');
    await emit('moon_normal', src.moonHeight, async (w) =>
      normalsFromHeights(await heights(src.moonHeight, w, w / 2, { normalise: true }), 7),
    );
  }
}

async function processJupiterMoons(src) {
  if (src.io) {
    log('io: colour');
    await emit('io', src.io, (w) => resized(src.io, w));
  }
  if (src.europa) {
    log('europa: colour');
    // The NASA mosaic is greyscale; give the ice its faint beige cast.
    await emit('europa', src.europa, (w) =>
      resized(src.europa, w)
        .toColourspace('b-w')
        .toColourspace('srgb')
        .recomb([
          [1, 0, 0],
          [0, 0.94, 0],
          [0, 0, 0.84],
        ]),
    );
  }
}

async function processSss(src) {
  const plain = ['venusAtmosphere', 'jupiter', 'saturn', 'uranus', 'neptune'];
  const names = {
    mercury: 'mercury',
    venusAtmosphere: 'venus_atmosphere',
    mars: 'mars',
    jupiter: 'jupiter',
    saturn: 'saturn',
    uranus: 'uranus',
    neptune: 'neptune',
  };
  for (const key of plain) {
    if (!src[key]) continue;
    log(`${names[key]}: colour`);
    await emit(names[key], src[key], (w) => resized(src[key], w));
  }
  for (const [key, strength] of [
    ['mercury', 3],
    ['mars', 2.4],
  ]) {
    if (!src[key]) continue;
    log(`${names[key]}: colour + normal map from luminance`);
    await emit(names[key], src[key], (w) => resized(src[key], w));
    await emit(`${names[key]}_normal`, src[key], async (w) =>
      normalsFromHeights(await heights(src[key], w, w / 2), strength),
    );
  }
  if (src.saturnRing) {
    log('saturn: ring');
    const { width = 2048, height = 64 } = await open(src.saturnRing).metadata();
    for (const [size, w] of [
      ['4k', 2048],
      ['2k', 1024],
    ]) {
      const target = Math.min(w, width);
      const rel = `textures/${size}/saturn_ring.png`;
      const out = join(OUT_DIR, size, 'saturn_ring.png');
      if (!existsSync(out) || REBUILD) {
        await mkdir(dirname(out), { recursive: true });
        await open(src.saturnRing)
          .resize(target, Math.max(1, Math.round((height * target) / width)), { fit: 'fill' })
          .ensureAlpha()
          .png({ compressionLevel: 9 })
          .toFile(out);
        log(`  wrote ${rel}`);
      }
      record('saturn_ring', size, rel);
    }
  }
}

async function main() {
  await mkdir(NASA_DIR, { recursive: true });
  await mkdir(SSS_DIR, { recursive: true });

  const src = {};
  for (const [key, source] of Object.entries(NASA_SOURCES)) src[key] = await download(source);
  for (const [key, suffix] of Object.entries(SSS_SOURCES)) src[key] = await findSss(suffix);
  // A manually added Solar System Scope map wins; otherwise fall back to NASA's.
  const marsFromSss = Boolean(src.mars);
  src.mars ??= src.marsNasa;

  const missingSss = Object.entries(SSS_SOURCES)
    .filter(([key]) => (key === 'mars' ? !marsFromSss : !src[key]))
    .map(([, suffix]) => suffix);

  await processEarth(src);
  await processMoon(src);
  await processJupiterMoons(src);
  await processSss(src);

  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
  log(`manifest: ${Object.keys(sorted).length} textures -> src/config/textures.json`);

  if (missingSss.length) {
    log('');
    log('Solar System Scope maps not found in textures-src/sss/ (procedural fallbacks will be used):');
    for (const suffix of missingSss) log(`  *_${suffix}`);
    log('Download them from https://www.solarsystemscope.com/textures/ and run `npm run textures` again.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
