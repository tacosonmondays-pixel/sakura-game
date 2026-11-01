// Path looks socket probe (debug): where each piece's pivot lands in figure space, next to its bone, for one girl.
//   node e2e/path-looks-probe.mjs --unit akane --tiers 3,0,0
import { createServer } from 'vite';
import { launchChromium } from './browser.mjs';
import { openApp, seedSave, openBattle } from './lib/battleKit.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const unit = opt('unit', 'akane');
const tiers = opt('tiers', '3,0,0').split(',').map(Number);
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser } = await launchChromium();
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await openApp(page, base);
await seedSave(page, { girls: ['aoi', 'akane', 'luna'], hero: 'luna', towers: ['aoi', 'akane'], settings: { quality: 'low' } });
await openBattle(page, { stage: '1-2' });
const uid = await page.evaluate((u) => window.__ab.place(u), unit);
await page.evaluate(([uid, t]) => window.__battle.renderer.setPathLookOverride(uid, t), [uid, tiers]);
await page.waitForFunction((uid) => window.__battle.renderer.pathLooksProbe(uid)?.pieces.length, uid, { timeout: 20000 }).catch(() => null);
const out = await page.evaluate((uid) => {
  const model = window.__battle.renderer.towerModel(uid);
  model.updateMatrixWorld(true);
  const inv = model.matrixWorld.clone().invert();
  const rows = [];
  const fig = (o) => { const e = o.matrixWorld.elements; const x = e[12], y = e[13], z = e[14]; const i = inv.elements; return [x * i[0] + y * i[4] + z * i[8] + i[12], x * i[1] + y * i[5] + z * i[9] + i[13], x * i[2] + y * i[6] + z * i[10] + i[14]].map((v) => +v.toFixed(3)); };
  model.traverse((o) => {
    if (o.isBone && ['head', 'chest', 'root', 'hand_L', 'hand_R', 'hips'].includes(o.name)) rows.push(['bone', o.name, fig(o)]);
    if (o.name?.startsWith('pathLookSocket:')) rows.push(['piece', o.name, fig(o), 'parent', o.parent.name, o.parent.type]);
  });
  const named = [];
  model.traverse((o) => { if (o.name === 'head') named.push(o.type); });
  return { rows, headNodes: named, rest: model.userData.restBone?.('head')?.elements.map((v) => +v.toFixed(3)) };
}, uid);
console.log(JSON.stringify(out, null, 1));
await browser.close();
await server.close();
