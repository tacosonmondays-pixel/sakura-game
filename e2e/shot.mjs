// Screenshot helper for visual checks.
//   node e2e/shot.mjs <path> <out.png> [--viewport 1280x720] [--wait <css selector>] [--delay ms] [--eval "<js>"] [--transparent]
//   (--transparent keeps the alpha of a page with a transparent background, e.g. previews/models-v2.html?bg=none)
// Starts its own Vite dev server on a free port, so several people can use it at once.
// Playwright and the browser are found by e2e/browser.mjs (PLAYWRIGHT_MODULE, CHROME_PATH, ...).
// Examples:
//   node e2e/shot.mjs /previews/models.html /tmp/models.png --delay 1500
//   node e2e/shot.mjs "/#/students" /tmp/students.png --viewport 844x390
import { createServer } from 'vite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const [path = '/', out = join(tmpdir(), 'shot.png')] = args;
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const [vw, vh] = opt('viewport', '1280x720').split('x').map(Number);
const wait = opt('wait', null);
const delay = Number(opt('delay', '800'));
const evalJs = opt('eval', null);
const transparent = args.includes('--transparent');

/**
 * Game pages get `?onboarding=0` (before the hash): a fresh save would otherwise be sent from the lobby to
 * the "Meet Hikari" opening (src/ui/story/install.js). Preview pages and explicit queries stay as given.
 */
function withoutOnboarding(p) {
  const [beforeHash, hash = null] = p.split(/#(.*)/s);
  if (!/^\/?(index\.html)?$/.test(beforeHash.replace(/\?.*$/, '')) || /onboarding=/.test(beforeHash)) return p;
  const sep = beforeHash.includes('?') ? '&' : '?';
  return `${beforeHash || '/'}${sep}onboarding=0${hash != null ? `#${hash}` : ''}`;
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const { browser } = await launchChromium();
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
try {
  await page.goto(`http://127.0.0.1:${port}${withoutOnboarding(path)}`, { waitUntil: 'load', timeout: 60000 });
  if (wait) await page.waitForSelector(wait, { timeout: 30000 });
  if (evalJs) await page.evaluate(evalJs);
  await page.waitForTimeout(delay);
  // An idle headless page produces no frames, so a CSS entrance animation (or a per-frame HUD
  // refresh) can still be pending at its first frame when the screenshot frame is drawn. Force
  // two animation frames first, like a real browser's continuous frame loop would.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 300)))));
  await page.screenshot({ path: out, omitBackground: transparent });
  console.log(`saved ${out}`);
} catch (e) {
  console.log(`FAILED: ${e.message}`);
  process.exitCode = 1;
} finally {
  if (errors.length) console.log(`console problems:\n${errors.slice(0, 30).join('\n')}`);
  await browser.close();
  await server.close();
}
