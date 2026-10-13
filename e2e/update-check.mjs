// Version + update flow on a real production build (owner: "can you add a version number
// somewhere? it just says chuu runs a different version of the game ... both of you reload the
// page but its the same link"). Builds with a deploy number, serves the build from disk, then:
//   1. the version shows on the title screen and in Settings → About;
//   2. Settings "Check for updates" says "newest", then a new deploy (version.json rewritten) is
//      found: the "New version ready" pill appears, and Update reloads into ?v=<build>;
//   3. a screen file deleted by a deploy: the page reloads itself once into the new build, and
//      within a minute of that it shows "This screen did not load" + Try again instead of a
//      blank page;
//   4. co-op (local online mode): an ally whose game is one deploy older (sim id + label patched
//      into that page's scripts) is told to update, and the newer player is told the ally is
//      behind — both see the two version numbers.
// Usage: node e2e/update-check.mjs [--viewport 844x390] [--shots dir]
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, renameSync, existsSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const [W, H] = arg('--viewport', '1280x720').split('x').map(Number);
const shotsDir = arg('--shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const touch = W < 1000;

const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}

// ---- build with a deploy number --------------------------------------------------------------
const out = join(tmpdir(), `sakura-update-e2e-${process.pid}`);
rmSync(out, { recursive: true, force: true });
log('building (GITHUB_RUN_NUMBER=17)…');
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], {
  env: { ...process.env, GITHUB_RUN_NUMBER: '17' },
  stdio: 'inherit',
});
const deployed = JSON.parse(readFileSync(join(out, 'version.json'), 'utf8'));
check(deployed.version === '0.1.17' && /^[0-9a-f]{12}$/.test(deployed.sim) && deployed.build, `version.json: ${JSON.stringify(deployed)}`);

// ---- static server (no caching; files can change between requests) ---------------------------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = resolve(out, `.${path}`);
  if (!file.startsWith(out)) return res.writeHead(403).end();
  if (path.endsWith('/')) file = join(file, 'index.html');
  if (!existsSync(file)) return res.writeHead(404).end('not found');
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const require = createRequire('/opt/node22/lib/node_modules/playwright/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
const IGNORE = [/Failed to load resource/, /favicon/, /WebGL/i, /GPU stall/i, /failed to load screen/i, /dynamically imported module/i];
const errors = [];
async function openPage(name) {
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errors.push(`[${name}] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[${name} pageerror] ${e.message}`));
  return page;
}
const shot = async (page, name) => {
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/update-${name}-${W}x${H}.png` });
};
const tap = async (page, sel) => {
  const el = page.locator(sel).first();
  await (touch ? el.tap({ timeout: 20000 }) : el.click({ timeout: 20000 }));
};
const dismissGift = async (page) => {
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 4000 }).catch(() => null);
  if (later) {
    await tap(page, '[data-testid="beta-gift-later"]');
    await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 10000 }).catch(() => null);
  }
};
// first visit: the name prompt and the beta gift can both open, in either order
async function settle(page, name) {
  for (let i = 0; i < 6; i++) {
    const nameInput = await page.$('[data-testid="name-input"]');
    if (nameInput && name && (await nameInput.isVisible())) {
      await page.fill('[data-testid="name-input"]', name);
      await page.locator('[data-testid="name-save"]').first().click({ force: true });
      await page.waitForSelector('[data-testid="name-input"]', { state: 'detached', timeout: 10000 }).catch(() => {});
      continue;
    }
    const later = await page.$('[data-testid="beta-gift-later"]');
    if (later && (await later.isVisible())) {
      await later.click({ force: true });
      await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 10000 }).catch(() => {});
      continue;
    }
    await page.waitForTimeout(700);
  }
}
const setVersionJson = (info) => writeFileSync(join(out, 'version.json'), `${JSON.stringify(info)}\n`);

let A;
let B;
try {
  // ---- 1. version visible ----------------------------------------------------------------------
  A = await openPage('A');
  await A.goto(`${base}#/title`, { waitUntil: 'load' });
  const titleVer = await A.waitForSelector('[data-testid="title-version"]', { timeout: 30000 }).then((e) => e.innerText()).catch(() => '');
  check(/0\.1\.17/.test(titleVer), `title screen shows the deploy version ("${titleVer}")`);
  await shot(A, 'title');
  await A.goto(`${base}#/settings`, { waitUntil: 'load' });
  await dismissGift(A);
  const setVer = await A.waitForSelector('[data-testid="settings-version"]', { timeout: 20000 }).then((e) => e.innerText()).catch(() => '');
  check(/^Version 0\.1\.17 · build [0-9a-f]{7}/.test(setVer), `Settings → About shows "${setVer}"`);

  // ---- 2. update found + Update reloads into ?v=<build> ----------------------------------------
  await tap(A, '[data-testid="check-updates"]');
  await A.waitForFunction(() => /newest/i.test(document.querySelector('[data-testid="update-status"]')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
  check(/newest/i.test(await A.locator('[data-testid="update-status"]').innerText()), 'Check for updates: "You have the newest version."');
  const next = { ...deployed, version: '0.1.18', build: 'feedface0001' };
  setVersionJson(next);
  await tap(A, '[data-testid="check-updates"]');
  const found = await A.waitForSelector('[data-testid="update-now-settings"]', { timeout: 10000 }).then(() => true).catch(() => false);
  check(found && /0\.1\.18/.test(await A.locator('[data-testid="update-status"]').innerText()), 'a new deploy is found: "A new version (v0.1.18) is ready." + Update now');
  const pill = await A.waitForSelector('[data-testid="update-bar"]', { timeout: 5000 }).then(() => true).catch(() => false);
  check(pill, 'the "New version ready" pill appears');
  await shot(A, 'pill');
  await Promise.all([A.waitForURL(/[?&]v=feedface0001/, { timeout: 20000 }).catch(() => {}), tap(A, '[data-testid="update-now"]')]);
  check(/[?&]v=feedface0001/.test(A.url()) && /#\/settings/.test(A.url()), `Update reloads into a fresh URL, same screen (${A.url().replace(base, '/')})`);
  setVersionJson(deployed);

  // ---- 3. a screen file missing after a deploy --------------------------------------------------
  const chunk = readdirSync(join(out, 'assets')).find((f) => /^bestiary-.*\.js$/.test(f));
  check(!!chunk, `found the bestiary screen chunk (${chunk})`);
  renameSync(join(out, 'assets', chunk), join(out, 'assets', `${chunk}.gone`));
  // just reloaded (step 2): no second automatic reload within a minute → message, not a blank page
  await A.evaluate(() => { location.hash = '#/bestiary'; });
  const failBox = await A.waitForSelector('[data-testid="load-fail"]', { timeout: 15000 }).then(() => true).catch(() => false);
  check(failBox, 'missing screen right after an update: "This screen did not load" with Try again / Reload (no blank page)');
  await shot(A, 'load-fail');
  // later (guard expired): the page reloads itself into the newest build
  await A.evaluate(() => sessionStorage.removeItem('sakura-fresh-reload'));
  setVersionJson({ ...deployed, build: 'feedface0002', version: '0.1.19' });
  await A.evaluate(() => { location.hash = '#/settings'; });
  await A.waitForSelector('[data-testid="settings-version"]', { timeout: 15000 });
  await Promise.all([A.waitForURL(/[?&]v=feedface0002/, { timeout: 20000 }).catch(() => {}), A.evaluate(() => { location.hash = '#/bestiary'; })]);
  check(/[?&]v=feedface0002/.test(A.url()), `a stale tab missing a screen file reloads itself into the new build (${A.url().replace(base, '/')})`);
  renameSync(join(out, 'assets', `${chunk}.gone`), join(out, 'assets', chunk));
  setVersionJson(deployed);
  await A.close();

  // ---- 4. co-op: one player a deploy behind -----------------------------------------------------
  const local = `${base}?online=local`;
  A = await openPage('A');
  await A.goto(`${local}#/lobby`, { waitUntil: 'load' });
  await A.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await A.goto(`${local}#/chat`, { waitUntil: 'load' });
  await settle(A, 'Aiko');
  B = await openPage('B');
  // B runs "v0.1.16" with a different battle engine: patch its scripts as they load
  await B.route('**/assets/*.js', async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    body = body.split(deployed.sim).join('0123456789ab');
    for (const q of ['"', "'", '`']) body = body.split(`${q}0.1.17${q}`).join(`${q}0.1.16${q}`);
    await route.fulfill({ response: res, body, headers: { ...res.headers(), 'content-type': 'text/javascript' } });
  });
  await B.goto(`${local}#/chat`, { waitUntil: 'load' });
  await settle(B, 'Chuu');
  await A.evaluate(() => { location.hash = '#/coop'; });
  await A.waitForSelector('[data-testid="coop-create"]', { timeout: 15000 });
  await tap(A, '[data-testid="coop-create"]');
  await A.waitForSelector('[data-testid="coop-room-code"]', { timeout: 15000 });
  const code = (await A.locator('[data-testid="coop-room-code"]').innerText()).trim();
  check(/0\.1\.17/.test(await A.locator('[data-testid="coop-my-version"]').innerText().catch(() => '')), 'the room shows "Your game version: v0.1.17"');
  await B.evaluate(() => { location.hash = '#/coop'; });
  await B.waitForSelector('[data-testid="coop-code"]', { timeout: 15000 });
  await B.fill('[data-testid="coop-code"]', code);
  await tap(B, '[data-testid="coop-join"]');
  const aText = await A.waitForSelector('[data-testid="coop-version"]', { timeout: 20000 }).then((e) => e.innerText()).catch(() => '');
  const bText = await B.waitForSelector('[data-testid="coop-version"]', { timeout: 20000 }).then((e) => e.innerText()).catch(() => '');
  check(/Chuu is on v0\.1\.16 and you're on v0\.1\.17/.test(aText) && /reload/i.test(aText), `newer player: "${aText.replace(/\s+/g, ' ')}"`);
  check(/Aiko is on v0\.1\.17 and you're on v0\.1\.16/.test(bText) && (await B.locator('[data-testid="coop-version-update"]').count()) === 1, `older player gets Update: "${bText.replace(/\s+/g, ' ')}"`);
  check((await A.locator('[data-testid="coop-player-1"]').count()) === 0, 'the two versions are not paired');
  await shot(A, 'coop-newer');
  await shot(B, 'coop-older');
} catch (e) {
  failures.push(`crashed: ${e.stack || e}`);
  log(e);
} finally {
  check(errors.length === 0, `no page errors${errors.length ? `:\n    ${errors.slice(0, 8).join('\n    ')}` : ''}`);
  await browser.close().catch(() => {});
  server.close();
  rmSync(out, { recursive: true, force: true });
}

log(failures.length ? `\n${failures.length} UPDATE CHECK(S) FAILED` : '\nALL UPDATE CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
