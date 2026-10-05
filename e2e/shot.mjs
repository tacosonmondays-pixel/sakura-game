// Screenshot helper for visual checks.
//   node e2e/shot.mjs <path> <out.png> [--viewport 1280x720] [--wait <css selector>] [--delay ms] [--eval "<js>"]
// Starts its own Vite dev server on a free port, so several people can use it at once.
// Examples:
//   node e2e/shot.mjs /previews/models.html /tmp/models.png --delay 1500
//   node e2e/shot.mjs "/#/students" /tmp/students.png --viewport 390x844
import { createServer } from 'vite';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const args = process.argv.slice(2);
const [path = '/', out = '/tmp/shot.png'] = args;
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const [vw, vh] = opt('viewport', '1280x720').split('x').map(Number);
const wait = opt('wait', null);
const delay = Number(opt('delay', '800'));
const evalJs = opt('eval', null);

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
try {
  await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'load', timeout: 60000 });
  if (wait) await page.waitForSelector(wait, { timeout: 30000 });
  if (evalJs) await page.evaluate(evalJs);
  await page.waitForTimeout(delay);
  await page.screenshot({ path: out });
  console.log(`saved ${out}`);
} catch (e) {
  console.log(`FAILED: ${e.message}`);
  process.exitCode = 1;
} finally {
  if (errors.length) console.log(`console problems:\n${errors.slice(0, 30).join('\n')}`);
  await browser.close();
  await server.close();
}
