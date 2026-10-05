import { defineConfig } from 'vite';

// base './' so the build works on GitHub Pages under /sakura-game/ and from any folder.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
