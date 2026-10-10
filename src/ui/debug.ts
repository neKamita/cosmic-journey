import type { WebGLRenderer } from 'three';
import type { EnvState } from '../camera/envTracks';
import type { Tier } from '../config/quality';

export interface DebugHooks {
  readonly renderer: WebGLRenderer;
  readonly env: EnvState;
  getTier(): Tier;
  setTier(tier: Tier): void;
  getState(): { progress: number; chapter: string; calls: number; triangles: number; programs: number };
}

export interface DebugPanel {
  update(): void;
}

/**
 * Developer overlay behind `?debug`: stats-gl (FPS, CPU/GPU time) and a lil-gui panel with the
 * quality tier, live render stats and the scroll-driven environment values. Loaded lazily so it
 * never ships in the main bundle path.
 */
export async function initDebug(hooks: DebugHooks): Promise<DebugPanel> {
  const [{ default: Stats }, { default: GUI }] = await Promise.all([import('stats-gl'), import('lil-gui')]);

  const stats = new Stats({ trackGPU: true, horizontal: false });
  await stats.init(hooks.renderer);
  Object.assign(stats.dom.style, { position: 'fixed', top: '0', left: '0', zIndex: '50' });
  document.body.appendChild(stats.dom);

  const gui = new GUI({ title: 'Debug' });
  gui.domElement.style.zIndex = '50';
  const view = { tier: hooks.getTier(), progress: 0, chapter: '', calls: 0, triangles: 0, programs: 0 };
  gui
    .add(view, 'tier', ['low', 'medium', 'high'])
    .name('quality tier')
    .onChange((tier: Tier) => hooks.setTier(tier));
  const stateFolder = gui.addFolder('Render');
  for (const key of ['progress', 'chapter', 'calls', 'triangles', 'programs'] as const) {
    stateFolder.add(view, key).listen().disable();
  }
  const envFolder = gui.addFolder('Environment (scroll-driven)').close();
  const env = hooks.env;
  for (const key of ['exposure', 'bloom', 'stars', 'godRays', 'lens', 'deepScale', 'galaxy', 'cluster', 'web'] as const) {
    envFolder.add(env, key).listen().disable();
  }

  return {
    update() {
      stats.update();
      const state = hooks.getState();
      view.progress = Number(state.progress.toFixed(4));
      view.chapter = state.chapter;
      view.calls = state.calls;
      view.triangles = state.triangles;
      view.programs = state.programs;
      view.tier = hooks.getTier();
    },
  };
}
