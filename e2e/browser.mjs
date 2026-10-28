// Finds Playwright and a Chromium to drive, without machine-specific install paths. Shared by
// e2e/smoke.mjs, e2e/shot.mjs and the other browser scripts; e2e/engines.mjs also finds Firefox and
// WebKit here (launchAttempts).
//
//   Playwright: PLAYWRIGHT_MODULE=<package folder or its index.mjs> if set, else the `playwright`
//               or `playwright-core` package (node_modules, or a folder listed in NODE_PATH).
//   Browser:    CHROME_PATH=<chrome / msedge executable>, or PLAYWRIGHT_CHANNEL=chrome|msedge,
//               else Playwright's own Chromium when it is installed, else the system Chrome,
//               else Edge. No browser download is needed when Chrome or Edge is installed.
import { createRequire } from 'node:module';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

// WebGL through SwiftShader, so the 3D views render on machines (and CI) without a GPU.
export const SWIFTSHADER_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
// [ui-ink] SAKURA_E2E_GL=gpu: the machine's GPU through ANGLE (D3D11 on Windows), still headless (never a visible
// window). Faster on a loaded machine and closer to a player's phone; SwiftShader stays the default for CI.
export const GPU_ARGS = ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
/** 'gpu' or 'swiftshader': what this run renders WebGL with. */
export const GL_MODE = String(process.env.SAKURA_E2E_GL || '').toLowerCase() === 'gpu' ? 'gpu' : 'swiftshader';
export const GL_ARGS = GL_MODE === 'gpu' ? GPU_ARGS : SWIFTSHADER_ARGS;

export async function loadPlaywright() {
  const explicit = process.env.PLAYWRIGHT_MODULE;
  if (explicit) {
    // a package folder loads through require (its "main"); a file through import(). Both resolve a
    // relative path against the working directory (a bare require('x/y') would look for a package)
    const full = resolve(explicit);
    if (statSync(full, { throwIfNoEntry: false })?.isDirectory()) return require(full);
    return import(pathToFileURL(full).href);
  }
  const tried = [];
  for (const name of ['playwright', 'playwright-core']) {
    try {
      return await import(name);
    } catch (e) {
      tried.push(`import('${name}'): ${e.code || e.message}`);
    }
    try {
      return require(name); // CommonJS resolution also searches NODE_PATH
    } catch (e) {
      tried.push(`require('${name}'): ${e.code || e.message}`);
    }
  }
  throw new Error(`Playwright not found. Install it without touching the lockfile (npm i --no-save playwright-core), add its folder to NODE_PATH, or set PLAYWRIGHT_MODULE.\n  ${tried.join('\n  ')}`);
}

/**
 * How to launch one browser engine, in order: [launch options, label] pairs.
 *   chromium  CHROME_PATH or PLAYWRIGHT_CHANNEL if set, else Playwright's Chromium, the system Chrome, Edge
 *   firefox   Playwright's Firefox, else the system Firefox (Playwright drives a stock Firefox through
 *             WebDriver BiDi, channel 'moz-firefox': no download). It gets a throwaway profile and never
 *             reaches a Firefox the user has open (-no-remote); on Windows -wait-for-browser keeps its
 *             launcher process alive, or Playwright loses the browser and a stray Firefox can stay open.
 *   webkit    Playwright's WebKit only
 * @param {'chromium' | 'firefox' | 'webkit'} type
 * @returns {Array<[object, string]>}
 */
export function launchAttempts(type, env = process.env, platform = process.platform) {
  if (type === 'chromium') {
    if (env.CHROME_PATH) return [[{ executablePath: env.CHROME_PATH }, `CHROME_PATH=${env.CHROME_PATH}`]];
    if (env.PLAYWRIGHT_CHANNEL) return [[{ channel: env.PLAYWRIGHT_CHANNEL }, `channel ${env.PLAYWRIGHT_CHANNEL}`]];
    return [[{}, 'Playwright Chromium'], [{ channel: 'chrome' }, 'system Chrome'], [{ channel: 'msedge' }, 'system Edge']];
  }
  if (type === 'firefox') {
    const args = platform === 'win32' ? ['-no-remote', '-wait-for-browser'] : ['-no-remote'];
    // (no slow-script prompt: the engine checks run one long script)
    return [[{}, 'Playwright Firefox'], [{ channel: 'moz-firefox', args, firefoxUserPrefs: { 'dom.max_script_run_time': 0 } }, 'system Firefox']];
  }
  return [[{}, 'Playwright WebKit']];
}

/**
 * Launches a headless Chromium with SwiftShader WebGL (or the GPU with SAKURA_E2E_GL=gpu). Always headless.
 * @param {{ args?: string[] }} [options]
 * @returns {Promise<{ browser: import('playwright').Browser, label: string }>}
 */
export async function launchChromium({ args = [] } = {}) {
  const { chromium } = await loadPlaywright();
  const base = { headless: true, args: [...GL_ARGS, ...args] };
  const attempts = launchAttempts('chromium');
  const errors = [];
  for (const [how, label] of attempts) {
    try {
      const browser = await chromium.launch({ ...base, ...how });
      return { browser, label: `${label} ${browser.version()} (${GL_MODE})` };
    } catch (e) {
      errors.push(`${label}: ${String(e.message).split('\n')[0]}`);
    }
  }
  throw new Error(`No browser could be launched. Install Chrome or Edge, or set CHROME_PATH.\n  ${errors.join('\n  ')}`);
}

/**
 * The e2e pages of one browser context play DIFFERENT players (the local adapter gives every tab
 * its own identity) but would share one game save. Since a tab stops saving once another tab
 * saved over it (src/core/store.js, "Open in another tab — reload"), each page gets its own save
 * key here, like a separate device. The local online "server" (ss-online-db) and BroadcastChannel
 * stay shared.
 * @param {import('playwright').Page} page
 * @param {string} id
 */
export async function ownSave(page, id) {
  await page.addInitScript((tag) => {
    const KEY = 'sakura-sentinels-save-v1';
    const mine = (k) => (k === KEY || k === `${KEY}.backup` ? `${k}#${tag}` : k);
    const { getItem, setItem, removeItem } = Storage.prototype;
    Storage.prototype.getItem = function (k) { return getItem.call(this, this === window.localStorage ? mine(k) : k); };
    Storage.prototype.setItem = function (k, v) { return setItem.call(this, this === window.localStorage ? mine(k) : k, v); };
    Storage.prototype.removeItem = function (k) { return removeItem.call(this, this === window.localStorage ? mine(k) : k); };
  }, id);
}
