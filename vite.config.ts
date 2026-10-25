import { defineConfig } from 'vite';

/**
 * The build is a static, relative-path bundle so it can be served from a
 * GitHub Pages project path without a rewrite rule (ADR-0004).
 */
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
