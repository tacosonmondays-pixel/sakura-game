// Sakura Sentinels desktop launcher.
// Bundled into a single executable with Node's Single Executable Application
// (SEA) feature by desktop/build.mjs. The whole `dist/` folder is embedded as
// SEA assets; this file serves them on localhost and opens the game in a window.
//
// Saves live in the browser's localStorage for http://127.0.0.1:<PORT>, so the
// port is fixed to keep progress between launches.
'use strict';

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { spawn, execFileSync } = require('node:child_process');

const PORT = 47333;
const HOST = '127.0.0.1';
const MARKER = 'sakura-sentinels-desktop';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

// ---------------------------------------------------------------------------
// Asset source: SEA assets when running as the packaged exe, otherwise ../dist
// (so `node desktop/launcher.cjs` works for local testing).
// ---------------------------------------------------------------------------
let sea = null;
try {
  sea = require('node:sea');
  if (!sea.isSea()) sea = null;
} catch {
  sea = null;
}

const distDir = path.resolve(__dirname, '..', 'dist');
let manifest = null; // { files: { 'assets/x.js': size, ... } }
if (sea) {
  manifest = JSON.parse(Buffer.from(sea.getAsset('__manifest.json')).toString('utf8'));
}

/**
 * Returns `readAsset(rel) -> Buffer | null` over the SEA assets listed in the build manifest,
 * or over a folder on disk. Never throws: names the manifest does not own (including inherited
 * keys such as 'constructor' or '__proto__') and paths outside the folder are just missing.
 */
function createAssetReader({ sea: seaApi = null, manifest: list = null, dir = distDir } = {}) {
  if (seaApi) {
    const files = (list && list.files) || {};
    return (rel) => {
      if (!Object.prototype.hasOwnProperty.call(files, rel)) return null;
      try {
        return Buffer.from(seaApi.getAsset(rel));
      } catch {
        return null;
      }
    };
  }
  const root = path.resolve(dir);
  const inside = root.endsWith(path.sep) ? root : root + path.sep;
  return (rel) => {
    const full = path.resolve(root, rel);
    // separator-aware, so '../dist-other/x' cannot pass as being inside 'dist'
    if (!full.startsWith(inside)) return null;
    try {
      return fs.readFileSync(full);
    } catch {
      return null;
    }
  };
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
function sendText(res, status, text) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function serve(req, res, readAsset) {
  let url;
  try {
    url = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    sendText(res, 400, 'Bad request'); // malformed percent-encoding, e.g. '/%'
    return;
  }
  if (url === '/__sakura') {
    sendText(res, 200, MARKER);
    return;
  }
  if (url.endsWith('/')) url += 'index.html';
  const rel = url.replace(/\\/g, '/').replace(/^\/+/, '');
  let served = rel;
  let body = readAsset(rel);
  if (!body && !path.extname(rel)) {
    served = 'index.html'; // SPA-style fallback
    body = readAsset(served);
  }
  if (!body) {
    sendText(res, 404, 'Not found: ' + rel);
    return;
  }
  const ext = path.extname(served).toLowerCase(); // the fallback is HTML, not octet-stream
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-length': body.length,
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
  });
  res.end(body);
}

/** Request handler over `readAsset`; a bad request gets an error status, never a crash. */
function createHandler(readAsset) {
  return function handler(req, res) {
    try {
      serve(req, res, readAsset);
    } catch (e) {
      console.error('[launcher] request failed:', req.url, e && e.message);
      if (res.headersSent) res.destroy();
      else sendText(res, 500, 'Internal error');
    }
  };
}

const handler = createHandler(createAssetReader({ sea, manifest }));

function probe(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: HOST, port, path: '/__sakura', timeout: 800 }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data === MARKER));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function listen(port, onRequest = handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(onRequest);
    server.once('error', reject);
    server.listen(port, HOST, () => resolve(server));
  });
}

// ---------------------------------------------------------------------------
// Open the game in an app-style window when Edge/Chrome exist, else the default browser.
// ---------------------------------------------------------------------------
function findChromiumWindows() {
  const roots = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)'], process.env['LOCALAPPDATA']].filter(Boolean);
  const candidates = [];
  for (const r of roots) {
    candidates.push(path.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    candidates.push(path.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    candidates.push(path.join(r, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'));
  }
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function openWindow(url) {
  const userData = path.join(process.env.APPDATA || process.env.HOME || '.', 'SakuraSentinels', 'window');
  if (process.platform === 'win32') {
    const exe = findChromiumWindows();
    if (exe) {
      spawn(exe, [`--app=${url}`, `--user-data-dir=${userData}`, '--window-size=1280,720', '--no-first-run', '--no-default-browser-check'], { detached: true, stdio: 'ignore' }).unref();
      return 'app-window';
    }
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    return 'browser';
  }
  if (process.platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    return 'browser';
  }
  for (const cmd of ['xdg-open', 'sensible-browser', 'x-www-browser']) {
    try {
      execFileSync('which', [cmd], { stdio: 'ignore' });
      spawn(cmd, [url], { detached: true, stdio: 'ignore' }).unref();
      return 'browser';
    } catch {
      /* try next */
    }
  }
  return 'none';
}

async function main() {
  const noOpen = process.argv.includes('--no-open');
  let port = PORT;
  let server = null;
  for (let i = 0; i < 10 && !server; i++) {
    try {
      server = await listen(port);
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
      if (await probe(port)) {
        // Another copy of the game is already running: just open it.
        const url = `http://${HOST}:${port}/`;
        console.log(`Sakura Sentinels is already running at ${url}`);
        if (!noOpen) openWindow(url);
        return;
      }
      port += 1;
    }
  }
  if (!server) throw new Error('No free port found');
  const url = `http://${HOST}:${port}/`;
  console.log('');
  console.log('  🌸 Sakura Sentinels');
  console.log(`  Running at ${url}`);
  if (port !== PORT) console.log(`  (port ${PORT} was busy — saves are kept per port, so this launch uses a separate save)`);
  console.log('  Close this window to stop the game.');
  console.log('');
  if (!noOpen) {
    const how = openWindow(url);
    if (how === 'none') console.log(`  Open ${url} in your browser.`);
  }
}

// Exported for tests/desktop/launcher.test.js. Inside the exe `require.main` is not set, so the
// SEA check is what starts the game there; `node desktop/launcher.cjs` starts it via require.main.
module.exports = { createAssetReader, createHandler, listen, MARKER, PORT };

if (sea || require.main === module) {
  main().catch((e) => {
    console.error('Failed to start Sakura Sentinels:', e);
    process.exitCode = 1;
  });
}
