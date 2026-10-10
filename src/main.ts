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
import { CHAPTERS, type ChapterId } from './config/chapters';
import { AccentColor } from './ui/accent';
import { DistanceCounter } from './ui/distanceCounter';
import { LoaderScreen } from './ui/loader';
import { ProgressNav } from './ui/progressNav';
import { initSectionReveal } from './ui/sectionReveal';

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
  const loader = new LoaderScreen(qs<HTMLElement>('#loader'));

  if (!hasWebGL2()) {
    // Static, fully readable page without the 3D layer.
    canvas.remove();
    loader.done();
    document.documentElement.classList.add('no-webgl');
    return;
  }
  document.documentElement.classList.add('js');
  loader.setProgress(0.05, 'готовим сцену');

  const forcedTier = tierFromQuery(location.search);
  let quality = QUALITY[forcedTier ?? 'medium'];
  const core = createRenderCore(canvas, quality);
  if (!forcedTier) {
    quality = QUALITY[detectTier(readDeviceInfo(core.renderer.getContext()))];
    core.applyQuality(quality);
  }

  const main = qs<HTMLElement>('#journey');
  const scroll = new ScrollController(main, !reducedMotion);
  const path = new CameraPath(CAMERA_KEYS, scroll.ranges);
  const env = new EnvTimeline(scroll.ranges);
  const director = new SceneDirector(core.scene, quality);
  const distance = new DistanceCounter(qs<HTMLElement>('#distance'), scroll.ranges);
  const nav = new ProgressNav(qs<HTMLElement>('#progress-nav'), scroll);
  const accent = new AccentColor();

  const starfield = new Starfield(quality);
  director.add(starfield);
  director.add(new Placeholders());

  scroll.onMeasure((ranges) => {
    path.resolve(ranges);
    env.resolve(ranges);
    director.resolve(ranges);
    distance.resolve(ranges);
  });

  core.resize();
  starfield.setPixelRatio(core.size.dpr);
  loader.setProgress(0.4, 'строим Солнечную систему');
  await director.init({ renderer: core.renderer, quality });
  loader.setProgress(0.8, 'компилируем шейдеры');

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

    distance.update(p);
    nav.update(chapter.id, p);
    accent.update(state.accent);

    if (!forcedTier) governor.sample(dt);
  };

  window.addEventListener('resize', () => {
    if (core.resize()) starfield.setPixelRatio(core.size.dpr);
  });

  scroll.init();
  initSectionReveal(
    CHAPTERS.map((c) => qs<HTMLElement>(`section[data-chapter="${c.id}"]`)),
    { reducedMotion, lite: quality.tier === 'low' },
  );
  const hash = location.hash.slice(1) as ChapterId;
  if (hash && CHAPTERS.some((c) => c.id === hash)) scroll.scrollToChapter(hash, true);

  gsap.ticker.add(frame);
  loader.done();

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
