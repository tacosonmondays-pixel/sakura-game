import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { simId } from './tools/simId.mjs';

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

// The version players see (title screen, Settings, co-op lobby): <major>.<minor> from
// package.json + the deploy number (GitHub Actions run number of the Pages workflow), so every
// deploy gets a new, increasing number — "0.1.17". Local builds say "0.1.dev".
function appVersion() {
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  const [major = '0', minor = '1'] = String(pkg.version || '0.1.0').split('.');
  const run = String(process.env.GITHUB_RUN_NUMBER || '').trim();
  return `${major}.${minor}.${/^\d+$/.test(run) ? run : 'dev'}`;
}

const BUILD = Object.freeze({
  version: appVersion(),
  build: buildId(),
  sim: simId().id, // co-op compatibility (tools/simId.mjs)
  time: new Date().toISOString(),
});

// dist/version.json: what is deployed right now. A running game fetches it (no cache) to notice
// a newer deploy and offer an update (src/core/updates.js).
function versionFile() {
  return {
    name: 'sakura-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify(BUILD)}\n` });
    },
  };
}

// base './' so the build works on GitHub Pages under /sakura-game/ and from any folder.
export default defineConfig({
  base: './',
  plugins: [versionFile()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD.build),
    __APP_VERSION__: JSON.stringify(BUILD.version),
    __SIM_ID__: JSON.stringify(BUILD.sim),
    __BUILD_TIME__: JSON.stringify(BUILD.time),
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // co-op view rule: sim.hero / sim.heroConfig must not be read inside the step (throws under tests)
    setupFiles: ['tests/setup.js'],
    // the game's home time zone (its daily reset), so local-time rules (the local-week double drops) test the same on
    // every machine: CI runs in UTC, where the local week ends before Halloween's close and Happening Now's order differs
    env: { TZ: 'America/Chicago' },
  },
});
