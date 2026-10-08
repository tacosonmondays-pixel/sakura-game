import { defineConfig } from 'vite';

// Online config (src/online/backend.js): the deploy workflow passes the repository secrets
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY into the build. A secret that is not set arrives
// as an empty string, and Vite lets ANY existing process variable (even '') override the
// .env files, so drop empty ones here: then .env.production (the public URL + publishable key)
// still applies, and with neither the game builds in offline / local mode.
for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
  if (process.env[key] != null && !String(process.env[key]).trim()) delete process.env[key];
}

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
