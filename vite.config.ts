import { defineConfig } from 'vitest/config';
import glsl from 'vite-plugin-glsl';

// Node globals for this config only; the app itself is typed for the browser.
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  // Sub-path for project hosting (GitHub Pages serves the site from /<repository>/).
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    glsl({
      include: ['**/*.glsl', '**/*.vert', '**/*.frag'],
      minify: true,
      watch: true,
      removeDuplicatedImports: true,
      warnDuplicatedImports: false,
    }),
  ],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    host: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
