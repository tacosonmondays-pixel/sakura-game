import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

// Online config (src/online/backend.js): the deploy workflow passes the repository secrets
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY into the build. A secret that is not set arrives
// as an empty string, and Vite lets ANY existing process variable (even '') override the
// .env files, so drop empty ones here: then .env.production (the public URL + publishable key)
// still applies, and with neither the game builds in offline / local mode.
for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
  if (process.env[key] != null && !String(process.env[key]).trim()) delete process.env[key];
}

// Co-op refuses to pair two different builds (src/online/coop/version.js): the bundle carries
// the commit it was built from (GitHub Actions: GITHUB_SHA; locally: git, '+' when the tree has
// uncommitted changes; 'dev' without git).
function buildId() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 12);
  try {
    const sha = execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain --untracked-files=no', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return sha + (dirty ? '+' : '');
  } catch {
    return 'dev';
  }
}

// base './' so the build works on GitHub Pages under /sakura-game/ and from any folder.
export default defineConfig({
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
