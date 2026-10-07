// Finds Playwright and a Chromium to drive, without machine-specific install paths. Shared by
// e2e/smoke.mjs and e2e/shot.mjs.
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
export const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

async function loadPlaywright() {
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
 * Launches a headless Chromium with SwiftShader WebGL.
 * @param {{ args?: string[] }} [options]
 * @returns {Promise<{ browser: import('playwright').Browser, label: string }>}
 */
export async function launchChromium({ args = [] } = {}) {
  const { chromium } = await loadPlaywright();
  const base = { args: [...GL_ARGS, ...args] };
  const exe = process.env.CHROME_PATH;
  const channel = process.env.PLAYWRIGHT_CHANNEL;
  const attempts = exe
    ? [[{ executablePath: exe }, `CHROME_PATH=${exe}`]]
    : channel
      ? [[{ channel }, `channel ${channel}`]]
      : [[{}, 'Playwright Chromium'], [{ channel: 'chrome' }, 'system Chrome'], [{ channel: 'msedge' }, 'system Edge']];
  const errors = [];
  for (const [how, label] of attempts) {
    try {
      const browser = await chromium.launch({ ...base, ...how });
      return { browser, label: `${label} ${browser.version()}` };
    } catch (e) {
      errors.push(`${label}: ${String(e.message).split('\n')[0]}`);
    }
  }
  throw new Error(`No browser could be launched. Install Chrome or Edge, or set CHROME_PATH.\n  ${errors.join('\n  ')}`);
}
