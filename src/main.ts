import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles/main.css';

import { gsap } from 'gsap';
import { chapterAt } from './camera/anchors';
import { CAMERA_KEYS } from './camera/cameraKeys';
import { CameraPath, createCameraSample } from './camera/cameraPath';
import { EnvTimeline } from './camera/envTracks';
import { FpsGovernor, QUALITY, detectTier, readDeviceInfo, tierFromQuery, type Tier } from './config/quality';
import { AssetLibrary } from './core/assets';
import type { FrameContext } from './core/frame';
import { createRenderCore } from './core/renderer';
import { AsteroidBelt } from './scenes/asteroids';
import { Comets } from './scenes/comet';
import { Earth } from './scenes/earth';
import { Jupiter } from './scenes/jupiter';
import { Mars } from './scenes/mars';
import { BlackHole } from './scenes/blackHole';
import { Heliosphere } from './scenes/heliosphere';
import { Neptune } from './scenes/neptune';
import { Saturn } from './scenes/saturn';
import { Uranus } from './scenes/uranus';
import { Mercury } from './scenes/mercury';
import { Moon } from './scenes/moon';
import { Venus } from './scenes/venus';
import { CosmicWeb } from './scenes/cosmicWeb';
import { MilkyWay } from './scenes/galaxy';
import { GalaxyCluster } from './scenes/galaxyCluster';
import { Nebula } from './scenes/nebula';
import { SceneDirector } from './scenes/SceneDirector';
import { Starfield } from './scenes/starfield';
import { Sun } from './scenes/sun';
import { PostFX } from './core/postfx';
import { ScrollController } from './scroll/scrollController';
import { CHAPTERS, type ChapterId } from './config/chapters';
import { AccentColor } from './ui/accent';
import { DistanceCounter } from './ui/distanceCounter';
import { LoaderScreen } from './ui/loader';
import { ProgressNav } from './ui/progressNav';
import type { SceneModule } from './scenes/SceneModule';
import type { DebugPanel } from './ui/debug';
import { whenIdle, whenLaidOut, yieldToMain } from './utils/schedule';
import { initSectionReveal } from './ui/sectionReveal';

const initDebug = async (...args: Parameters<typeof import('./ui/debug').initDebug>) =>
  (await import('./ui/debug')).initDebug(...args);

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
  // Embedded in a frame that is still hidden, there is nothing to measure yet: wait for layout.
  await whenLaidOut(canvas);

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

  // Modules in route order (their textures stream in this order too), built one per task so the
  // loading screen stays responsive.
  const sun = new Sun(quality);
  const blackHole = new BlackHole();
  const factories: Array<() => SceneModule> = [
    () => new Starfield(quality),
    () => sun,
    () => new Earth(quality),
    () => new Moon(quality),
    () => new Mercury(quality),
    () => new Venus(quality),
    () => new Mars(quality),
    () => new AsteroidBelt(quality),
    () => new Comets(quality),
    () => new Jupiter(quality),
    () => new Saturn(quality),
    () => new Uranus(quality),
    () => new Neptune(quality),
    () => new Heliosphere(),
    () => blackHole,
  ];
  for (const create of factories) {
    director.add(create());
    await yieldToMain();
  }
  // Hundreds of thousands of deep-space particles are only needed at the end of the journey:
  // they are generated after the page is interactive, in idle time.
  const deferredFactories: Array<() => SceneModule> = [
    () => new MilkyWay(quality),
    () => new Nebula(quality),
    () => new GalaxyCluster(quality),
    () => new CosmicWeb(quality),
  ];

  scroll.onMeasure((ranges) => {
    path.resolve(ranges);
    env.resolve(ranges);
    director.resolve(ranges);
    distance.resolve(ranges);
  });

  core.resize();
  director.setPixelRatio(core.size.dpr);

  const assets = new AssetLibrary(core.renderer, quality);
  await assets.preloadCritical((f) => loader.setProgress(0.08 + f * 0.62, 'загружаем Землю и Луну'));
  loader.setProgress(0.72, 'строим Солнечную систему');
  await director.init({ renderer: core.renderer, quality, assets }, (f) =>
    loader.setProgress(0.72 + f * 0.13, 'строим Солнечную систему'),
  );
  loader.setProgress(0.85, 'компилируем шейдеры');

  // Compile every module's shaders up front so entering a chapter never stalls on a shader build.
  director.showAll();
  await core.renderer.compileAsync(core.scene, core.camera);
  loader.setProgress(0.95, 'почти готово');

  const createPostFX = (q: typeof quality): PostFX | null => {
    if (!q.postfx) return null;
    const fx = new PostFX(core.renderer, core.scene, core.camera, q, sun.lightSource, reducedMotion);
    fx.setSize(core.size.width, core.size.height);
    return fx;
  };
  let postfx = createPostFX(quality);
  blackHole.setLensActive(postfx?.hasLens ?? false);
  core.renderer.info.autoReset = false;

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
    viewportHeight: core.size.height,
  };

  /**
   * Switches the quality tier at runtime. Downgrades from the FPS governor adjust the existing
   * post-processing chain; `rebuild` (debug panel) recreates it so effects can come back too.
   */
  const applyQuality = (tier: Tier, rebuild = false): void => {
    quality = QUALITY[tier];
    ctx.quality = quality;
    core.applyQuality(quality);
    director.setQuality(quality);
    director.setPixelRatio(core.size.dpr);
    assets.setQuality(quality);
    if (rebuild || !quality.postfx) {
      postfx?.dispose();
      postfx = createPostFX(quality);
    } else if (postfx) {
      postfx.setQuality(quality);
      postfx.setSize(core.size.width, core.size.height);
    }
    blackHole.setLensActive(postfx?.hasLens ?? false);
  };
  const governor = new FpsGovernor(quality.tier, (tier) => applyQuality(tier));
  let debug: DebugPanel | null = null;

  const frame = (_time: number, deltaMs: number): void => {
    const dt = Math.min(deltaMs / 1000, 0.1);
    ctx.dt = dt;
    ctx.time += dt * ctx.motion;

    const p = scroll.progress;
    ctx.progress = p;
    const chapter = chapterAt(p, scroll.ranges);
    ctx.chapter = chapter.id;
    ctx.chapterLocal = chapter.local;
    ctx.viewportHeight = core.size.height;

    path.sample(p, sample);
    const camera = core.camera;
    camera.position.copy(sample.position);
    camera.lookAt(sample.target);
    core.setFov(sample.fov);
    camera.near = sample.near;
    camera.far = sample.far;
    core.applyFraming(sample.frame);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    const state = env.sample(p);
    core.renderer.setClearColor(state.background, 1);
    core.renderer.toneMappingExposure = state.exposure;

    director.update(ctx);
    core.renderer.info.reset();
    if (postfx) {
      postfx.update(state, ctx.time);
      postfx.render(dt);
    } else {
      core.renderer.render(core.scene, camera);
    }

    distance.update(p);
    nav.update(chapter.id, p);
    accent.update(state.accent);

    if (!forcedTier && !debug) governor.sample(dt);
    debug?.update();
  };

  const onResize = (): void => {
    if (!core.resize()) return;
    director.setPixelRatio(core.size.dpr);
    postfx?.setSize(core.size.width, core.size.height);
  };
  // Window resizes cover DPR changes; the observer covers size changes without one (e.g. a frame
  // that is shown or resized by its parent page).
  window.addEventListener('resize', onResize);
  new ResizeObserver(onResize).observe(canvas);

  scroll.init();
  initSectionReveal(
    CHAPTERS.map((c) => qs<HTMLElement>(`section[data-chapter="${c.id}"]`)),
    { reducedMotion, lite: quality.tier === 'low' },
  );
  const hash = location.hash.slice(1) as ChapterId;
  if (hash && CHAPTERS.some((c) => c.id === hash)) scroll.scrollToChapter(hash, true);

  gsap.ticker.add(frame);
  loader.done();

  void (async () => {
    for (const create of deferredFactories) {
      await whenIdle(1200);
      await director.addLate(create(), { renderer: core.renderer, quality, assets }, core.camera);
    }
  })().catch((error: unknown) => {
    // The solar-system journey keeps working; only the deep-space chapters lose their content.
    console.warn('[scene] deferred deep-space content failed to build', error);
  });

  const renderState = () => ({
    progress: Number(ctx.progress.toFixed(4)),
    chapter: ctx.chapter,
    local: Number(ctx.chapterLocal.toFixed(3)),
    tier: quality.tier,
    calls: core.renderer.info.render.calls,
    triangles: core.renderer.info.render.triangles,
    programs: core.renderer.info.programs?.length ?? 0,
  });

  if (params.has('debug')) {
    debug = await initDebug({
      renderer: core.renderer,
      env: env.state,
      getTier: () => quality.tier,
      setTier: (tier) => applyQuality(tier, true),
      getState: renderState,
    });
  }

  if (params.has('qa') || params.has('debug')) {
    // Automation hook for visual QA scripts.
    Object.assign(window, {
      __journey: {
        scrollToProgress: (p: number, immediate = false) => scroll.scrollToProgress(p, immediate),
        scrollToChapter: (id: ChapterId, immediate = false) => scroll.scrollToChapter(id, immediate),
        debugState: renderState,
      },
    });
  }
}

void boot();
