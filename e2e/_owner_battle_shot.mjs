// Real game battle screenshots: hero Hikari placed next to another girl at default zoom.
// usage (cwd = worktree): node <this> <outPrefix> [viewports=1280x720,844x390] [stage=1-1] [partner=aoi]
import { createServer } from 'vite';
import { launchChromium } from './browser.mjs';
const [out, vps = '1280x720,844x390', stage = '1-1', partner = 'aoi'] = process.argv.slice(2);
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const { browser } = await launchChromium();
for (const vp of vps.split(',')) {
  const [w, h] = vp.split('x').map(Number);
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__sakura && document.querySelector('#app')?.children.length > 0, null, { timeout: 180000 });
  await page.evaluate((p) => {
    const prof = window.__sakura.store.profile;
    if (!prof.units[p]) prof.units[p] = { ...(prof.units.aoi || {}), id: p };
  }, partner);
  await page.evaluate((s) => { location.hash = `#/battle?stage=${s}&difficulty=easy`; }, stage);
  await page.waitForFunction(() => window.__battle?.ui?.placement, null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  const res = await page.evaluate((partner) => {
    const { sim, ui } = window.__battle;
    const hero = sim.heroConfig?.unitId;
    const ids = [hero, partner].filter(Boolean);
    sim.cash = 99999;
    const cx = sim.map.width / 2; const cy = sim.map.height / 2;
    const cand = [];
    for (let y = 0.25; y < sim.map.height; y += 0.5) for (let x = 0.25; x < sim.map.width; x += 0.5) cand.push([x, y]);
    cand.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
    let spot = null;
    for (const [x, y] of cand) {
      if (sim.canPlace(ids[0], x, y).ok && sim.canPlace(ids[1], x + 1.5, y).ok) { spot = [x, y]; break; }
    }
    const placed = [];
    ids.forEach((id, i) => { ui.placement.start(id); placed.push([id, !!ui.placement.tryPlace(spot[0] + i * 1.5, spot[1])]); });
    return { hero, placed, spot, loadout: [...sim.loadout.keys()] };
  }, partner);
  console.log(vp, JSON.stringify(res));
  await page.waitForTimeout(4000);
  const glb = await page.evaluate(() => {
    const r = window.__battle.renderer;
    const out = [];
    for (const v of (r.actors?.towers || new Map()).values()) out.push([v.model.userData.unitId, !!v.model.userData.glb, v.model.userData.height]);
    return out;
  }).catch((e) => e.message);
  console.log('models', JSON.stringify(glb));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 300)))));
  await page.screenshot({ path: `${out}-${vp}.png`, timeout: 180000 });
  console.log('saved', `${out}-${vp}.png`, errors.length ? `errors: ${errors.slice(0, 5).join(' | ')}` : '');
  await page.close();
}
await browser.close();
await server.close();
