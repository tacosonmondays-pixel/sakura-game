#!/usr/bin/env node
// Builds a single-file desktop executable of Sakura Sentinels using Node's
// Single Executable Application (SEA) feature. No Electron, no installer: one
// .exe that embeds the whole web build and serves it on localhost.
//
//   node desktop/build.mjs                 # Windows x64 exe (downloads node.exe once)
//   node desktop/build.mjs --platform linux  # Linux binary using the local node
//   node desktop/build.mjs --skip-web        # reuse the existing dist/
//
// Output: desktop/out/SakuraSentinels.exe (or desktop/out/sakura-sentinels on Linux)
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const platform = opt('platform', 'win');
const skipWeb = args.includes('--skip-web');

const NODE_VERSION = 'v22.12.0';
const NODE_WIN_SHA256 = 'b3b117a08ee61efee09e6fd523ab33c0c018da1b570bde08e4fd914dc1170ed6';
const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

const dist = path.join(root, 'dist');
const out = path.join(here, 'out');
const cache = path.join(here, '.cache');
const work = path.join(here, '.work');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(cache, { recursive: true });
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });

const log = (m) => console.log(`[desktop] ${m}`);

// 1. Web build -----------------------------------------------------------------
if (!skipWeb || !fs.existsSync(path.join(dist, 'index.html'))) {
  log('building web bundle (vite build)…');
  execFileSync('npx', ['vite', 'build'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
}

// 2. Asset manifest -----------------------------------------------------------
const files = {};
const assets = { '__manifest.json': path.join(work, '__manifest.json') };
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else {
      const rel = path.relative(dist, full).split(path.sep).join('/');
      files[rel] = fs.statSync(full).size;
      assets[rel] = full;
    }
  }
}
walk(dist);
fs.writeFileSync(assets['__manifest.json'], JSON.stringify({ files, builtAt: new Date().toISOString() }));
const total = Object.values(files).reduce((a, b) => a + b, 0);
log(`${Object.keys(files).length} files, ${(total / 1e6).toFixed(1)} MB embedded`);

// 3. SEA blob -------------------------------------------------------------------
const seaConfig = {
  main: path.join(here, 'launcher.cjs'),
  output: path.join(work, 'sea-prep.blob'),
  disableExperimentalSEAWarning: true,
  useCodeCache: false,
  assets,
};
fs.writeFileSync(path.join(work, 'sea-config.json'), JSON.stringify(seaConfig, null, 2));
log('generating SEA blob…');
execFileSync(process.execPath, ['--experimental-sea-config', path.join(work, 'sea-config.json')], { stdio: 'inherit' });

// 4. Runtime binary -------------------------------------------------------------
let binary;
let target;
if (platform === 'win') {
  binary = path.join(cache, `node-${NODE_VERSION}-win-x64.exe`);
  if (!fs.existsSync(binary)) {
    const url = `https://nodejs.org/dist/${NODE_VERSION}/win-x64/node.exe`;
    log(`downloading ${url}…`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    fs.writeFileSync(binary, Buffer.from(await res.arrayBuffer()));
  }
  const sha = createHash('sha256').update(fs.readFileSync(binary)).digest('hex');
  if (sha !== NODE_WIN_SHA256) throw new Error(`node.exe checksum mismatch (${sha})`);
  target = path.join(out, 'SakuraSentinels.exe');
} else {
  binary = process.execPath;
  target = path.join(out, 'sakura-sentinels');
}
fs.copyFileSync(binary, target);
fs.chmodSync(target, 0o755);

// 5. Inject ------------------------------------------------------------------
log('injecting the game into the runtime (postject)…');
const postject = path.join(root, 'node_modules', 'postject', 'dist', 'cli.js');
const inject = spawnSync(process.execPath, [postject, target, 'NODE_SEA_BLOB', seaConfig.output, '--sentinel-fuse', SEA_FUSE, ...(platform === 'mac' ? ['--macho-segment-name', 'NODE_SEA'] : [])], { stdio: 'inherit' });
if (inject.status !== 0) throw new Error('postject failed');

const size = fs.statSync(target).size;
log(`done → ${path.relative(root, target)} (${(size / 1e6).toFixed(1)} MB)`);
if (platform === 'win') {
  log('Windows note: the exe is unsigned, so SmartScreen may ask once ("More info → Run anyway").');
}
