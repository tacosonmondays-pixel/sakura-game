// Path looks socket probe (debug): where each piece's pivot and the weapon-tip muzzle land in figure space, next to her
// bones, for one girl.
//   node e2e/path-looks-probe.mjs --unit yuki --tiers 0,0,4 [--hero luna]
import { createServer } from 'vite';
import { launchChromium } from './browser.mjs';
import { openApp, seedSave, openBattle } from './lib/battleKit.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const unit = opt('unit', 'akane');
const hero = opt('hero', 'luna');
const tiers = opt('tiers', '3,0,0').split(',').map(Number);
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser } = await launchChromium();
const [W, H] = opt('size', '800x600').split('x').map(Number);
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
await openApp(page, base);
const girls = [...new Set(['aoi', 'akane', unit].filter((u) => !['luna', 'nami', 'hikari'].includes(u)))];
await seedSave(page, { girls: [...girls, 'luna', 'nami', 'hikari'], hero, towers: girls, settings: { quality: 'low' } });
await openBattle(page, { stage: '1-2' });
const uid = await page.evaluate((u) => window.__ab.place(u), unit);
await page.evaluate(([uid, t]) => window.__battle.renderer.setPathLookOverride(uid, t), [uid, tiers]);
await page.waitForFunction((uid) => window.__battle.renderer.pathLooksProbe(uid)?.pieces.length, uid, { timeout: 20000 }).catch(() => null);
const out = await page.evaluate((uid) => {
  const model = window.__battle.renderer.towerModel(uid);
  model.updateMatrixWorld(true);
  const inv = model.matrixWorld.clone().invert();
  const fig = (p) => { const e = inv.elements; return [p.x * e[0] + p.y * e[4] + p.z * e[8] + e[12], p.x * e[1] + p.y * e[5] + p.z * e[9] + e[13], p.x * e[2] + p.y * e[6] + p.z * e[10] + e[14]].map((v) => +v.toFixed(3)); };
  const pos = (o) => ({ x: o.matrixWorld.elements[12], y: o.matrixWorld.elements[13], z: o.matrixWorld.elements[14] });
  const rows = [];
  model.traverse((o) => {
    if (o.isBone && ['head', 'chest', 'root', 'hand_L', 'hand_R'].includes(o.name)) rows.push(['bone', o.name, fig(pos(o))]);
    if (o.name?.startsWith('pathLook')) rows.push(['piece', o.name, fig(pos(o)), (o.userData.pieces || []).join('+')]);
  });
  const mz = model.userData.anchors?.muzzle;
  if (mz) rows.push(['muzzle', '', fig(mz)]);
  return { rows, blocked: window.__battle.renderer.pathLooksMuzzleBlocked(uid) };
}, uid);
for (const r of out.rows) console.log(r.join('  '));
console.log('muzzle blocked now:', out.blocked);
// --swing: 30 frames with two attack swings; print the muzzle (figure space) on every frame a piece blocks it
if (args.includes('--swing')) {
  for (let f = 0; f < 30; f++) {
    if (f === 5 || f === 18) await page.evaluate((uid) => window.__battle.renderer.setPathLookPose(uid, 'attack'), uid);
    const r = await page.evaluate((uid) => new Promise((res) => requestAnimationFrame(() => {
      const model = window.__battle.renderer.towerModel(uid);
      const inv = model.matrixWorld.clone().invert();
      const mz = model.userData.anchors?.muzzle;
      const e = inv.elements;
      const p = mz ? [mz.x * e[0] + mz.y * e[4] + mz.z * e[8] + e[12], mz.x * e[1] + mz.y * e[5] + mz.z * e[9] + e[13], mz.x * e[2] + mz.y * e[6] + mz.z * e[10] + e[14]].map((v) => +v.toFixed(3)) : null;
      res({ b: window.__battle.renderer.pathLooksMuzzleBlocked(uid), p, yaw: +(model.rotation.y).toFixed(2), cam: window.__battle.renderer.cameraState.position });
    })), uid);
    console.log(f, r.b ? 'BLOCKED' : 'clear  ', JSON.stringify(r.p), 'facing', r.yaw);
  }
}
await browser.close();
await server.close();
