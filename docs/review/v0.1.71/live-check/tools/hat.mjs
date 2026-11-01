// Halloween close-up: a Goblin Runner in its pumpkin hat on ev-halloween-1 (live via the relay). node hat.mjs WxH out
import { launchChromium } from '/home/user/sakura-game/e2e/browser.mjs';
import { createServer } from '/home/user/sakura-game/node_modules/vite/dist/node/index.js';
const [W, H] = process.argv[2].split('x').map(Number);
const OUT = process.argv[3];
const server = await createServer({ root: '/home/user/sakura-game', server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' });
const save = await server.ssrLoadModule('/src/systems/save.js');
const profile = save.createProfile();
profile.settings = { ...profile.settings, autoStart: false, quality: 'high', camera: 'free', attackFx: false };
const { browser } = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: W < 600 ? 2 : 1 });
await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem('h')) { localStorage.clear(); localStorage.setItem(k, v); sessionStorage.setItem('h', '1'); } try { sessionStorage.setItem('sakura-beta-gift-shown', '1'); } catch {} }, [save.SAVE_KEY, JSON.stringify(profile)]);
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const settle = (ms = 150) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms);
await page.goto('http://127.0.0.1:5199/?online=local&onboarding=0', { waitUntil: 'load' });
await page.waitForFunction(() => window.__sakura?.store?.profile);
await page.evaluate(() => { location.hash = '#/battle?stage=ev-halloween-1&difficulty=normal'; });
await page.waitForFunction(() => window.__battle?.ui?.act && window.__battle.sim?.stage?.id === 'ev-halloween-1', null, { timeout: 120000 });
await page.waitForSelector('[data-testid=place-cancel]', { timeout: 8000 }).catch(() => null);
await page.evaluate(() => window.__battle.ui.placement?.cancel?.());
await page.click('[data-testid=place-cancel]', { timeout: 3000 }).catch(() => null);
await settle(300);
// goblins one at a time until one wears the pumpkin hat
const pick = await page.evaluate(async () => {
  const { pointAt } = await import('/src/sim/path.js');
  const { sim, renderer, ui } = window.__battle;
  ui.paused = false; sim._spawnQueue = [];
  const p0 = sim.pathData[0];
  let best = null;
  for (let d = 0.5; d < p0.length - 0.8; d += 0.25) { const p = pointAt(p0, d); const s = renderer.worldToScreen(p.x, p.y, 0); if (!s.visible) continue; const c = Math.hypot(s.clientX - innerWidth / 2, s.clientY - innerHeight * 0.55); if (!best || c < best.c) best = { d, c }; }
  for (let i = 0; i < 30; i++) {
    sim.enemies.splice(0);
    const e = sim.spawnEnemy('goblin_runner', { pathIndex: 0, dist: best.d, hpMul: 1e7 });
    e.baseSpeed = 0.0;
    let kind = null;
    for (let k = 0; k < 60 && kind === null; k++) {
      await new Promise((r) => setTimeout(r, 100));
      renderer.sceneProbe().traverse((o) => { if (o.name === 'enemy:goblin_runner' && o.visible) { kind = 'none'; o.traverse((c) => { if (c.name.startsWith('costume:')) kind = c.name.slice(8); }); } });
    }
    if (kind === 'pumpkinHat') return { uid: e.uid, x: e.x, y: e.y, tries: i + 1 };
  }
  return null;
});
console.log('hat goblin', JSON.stringify(pick));
if (pick) {
  await page.evaluate(() => window.__battle.renderer.resetCamera?.());
  await settle(300);
  for (let i = 0; i < (W < 600 ? 8 : 9); i++) {
    const at = await page.evaluate(([x, y]) => window.__battle.renderer.worldToScreen(x, y, 0.2), [pick.x, pick.y]);
    await page.mouse.move(at.clientX, at.clientY); await page.mouse.wheel(0, -240); await settle(60);
  }
  await settle(800);
  await page.evaluate(() => { window.__battle.ui.paused = true; document.querySelectorAll('.jn-toast, .toast').forEach((e) => e.remove()); });
  await settle(400);
  await page.screenshot({ path: `${OUT}/halloween-goblin-pumpkin-hat-${W}x${H}.jpg`, type: 'jpeg', quality: 75, timeout: 180000 });
}
console.log('errors', errs.length);
await browser.close(); await server.close();
