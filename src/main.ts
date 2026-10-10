import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles/main.css';

import { gsap } from 'gsap';
import { chapterAt } from './camera/anchors';
import { CAMERA_KEYS } from './camera/cameraKeys';
import { CameraPath, createCameraSample } from './camera/cameraPath';
import { EnvTimeline } from './camera/envTracks';
import { FpsGovernor, QUALITY, detectTier, readDeviceInfo, tierFromQuery, type Tier } from './config/quality';
import type { FrameContext } from './core/frame';
import { createRenderCore } from './core/renderer';
import { Placeholders } from './scenes/placeholders';
import { SceneDirector } from './scenes/SceneDirector';
import { Starfield } from './scenes/starfield';
import { ScrollController } from './scroll/scrollController';
import type { ChapterId } from './config/chapters';

function qs<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element ${selector}`);
  return el;
}

function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const reducedMotion =
    params.get('motion') === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = qs<HTMLCanvasElement>('#scene');
  const loader = qs<HTMLElement>('#loader');

  if (!hasWebGL2()) {
    // Static, fully readable page without the 3D layer.
    canvas.remove();
    loader.classList.add('is-done');
    document.documentElement.classList.add('no-webgl');
    return;
  }

  const forcedTier = tierFromQuery(location.search);
  let quality = QUALITY[forcedTier ?? 'medium'];
  const core = createRenderCore(canvas, quality);
  if (!forcedTier) {
    quality = QUALITY[detectTier(readDeviceInfo(core.renderer.getContext()))];
    core.applyQuality(quality);
  }

  const scroll = new ScrollController(qs<HTMLElement>('#journey'), !reducedMotion);
  const path = new CameraPath(CAMERA_KEYS, scroll.ranges);
  const env = new EnvTimeline(scroll.ranges);
  const director = new SceneDirector(core.scene, quality);

  const starfield = new Starfield(quality);
  director.add(starfield);
  director.add(new Placeholders());

  scroll.onMeasure((ranges) => {
    path.resolve(ranges);
    env.resolve(ranges);
    director.resolve(ranges);
  });

  core.resize();
  starfield.setPixelRatio(core.size.dpr);
  await director.init({ renderer: core.renderer, quality });

  const sample = createCameraSample();
  const ctx: FrameContext = {
    time: 0,
    dt: 0,
    progress: 0,
    chapter: 'earth',
    chapterLocal: 0,
    camera: core.camera,
    cameraTarget: sample.target,
    env: env.state,
    quality,
    motion: reducedMotion ? 0.2 : 1,
  };

  const applyQuality = (tier: Tier): void => {
    quality = QUALITY[tier];
    ctx.quality = quality;
    core.applyQuality(quality);
    director.setQuality(quality);
    starfield.setPixelRatio(core.size.dpr);
  };
  const governor = new FpsGovernor(quality.tier, applyQuality);

  const frame = (_time: number, deltaMs: number): void => {
    const dt = Math.min(deltaMs / 1000, 0.1);
    ctx.dt = dt;
    ctx.time += dt * ctx.motion;

    const p = scroll.progress;
    ctx.progress = p;
    const chapter = chapterAt(p, scroll.ranges);
    ctx.chapter = chapter.id;
    ctx.chapterLocal = chapter.local;

    path.sample(p, sample);
    const camera = core.camera;
    camera.position.copy(sample.position);
    camera.lookAt(sample.target);
    camera.fov = sample.fov;
    camera.near = sample.near;
    camera.far = sample.far;
    core.applyFraming(sample.frame);
    camera.updateProjectionMatrix();

    const state = env.sample(p);
    core.renderer.setClearColor(state.background, 1);
    core.renderer.toneMappingExposure = state.exposure;

    director.update(ctx);
    core.renderer.render(core.scene, camera);

    if (!forcedTier) governor.sample(dt);
  };

  window.addEventListener('resize', () => {
    if (core.resize()) starfield.setPixelRatio(core.size.dpr);
  });

  scroll.init();
  const hash = location.hash.slice(1) as ChapterId;
  if (hash && document.querySelector(`section[data-chapter="${hash}"]`)) scroll.scrollToChapter(hash, true);

  gsap.ticker.add(frame);
  loader.classList.add('is-done');
  loader.setAttribute('aria-valuenow', '100');

  if (params.has('qa') || params.has('debug')) {
    Object.assign(window, {
      __journey: {
        scrollToProgress: (p: number, immediate = false) => scroll.scrollToProgress(p, immediate),
        scrollToChapter: (id: ChapterId, immediate = false) => scroll.scrollToChapter(id, immediate),
        debugState: () => ({
          progress: Number(ctx.progress.toFixed(4)),
          chapter: ctx.chapter,
          local: Number(ctx.chapterLocal.toFixed(3)),
          tier: quality.tier,
          calls: core.renderer.info.render.calls,
          triangles: core.renderer.info.render.triangles,
          programs: core.renderer.info.programs?.length ?? 0,
        }),
      },
    });
  }
}

void boot();
