// Battle panel numbers the owner reported (Oct 14): "Chika's drones dont properly show dps" and
// "make it so cost reduction affects upgrades". Chika at 5-2-0 with a 20% Cost Reduction gear
// piece: her DPS must include the drone wing, the Drones line shows damage × rate each, the
// price buttons show the real (cheaper) price, MORE says how much cheaper, and buying charges
// exactly the shown price. Phone and PC sizes.
// Since A3 M4 her drawer has the price buttons on its Glance (two taps: arm, then buy) and MORE
// holds the tabs Overall · Chika · Drones: the summed DPS and the Drones line on Overall.
// Usage: node e2e/stat-display.mjs [--shots dir]
import { createServer } from 'vite';
import { launchChromium } from './browser.mjs';
import { mkdirSync } from 'node:fs';
import { fmtNum } from '../src/ui/format.js';
const args = process.argv.slice(2);
const SHOTS = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
// (Playwright and a Chromium through e2e/browser.mjs: no machine-specific install paths)
const { browser } = await launchChromium();
const fails = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
const num = (s) => Number(String(s).replace(/[^\d.]/g, ''));
try {
  for (const [W, H] of [[844, 390], [1280, 720]]) {
    const touch = W < 1000;
    const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
    await page.evaluate(() => { localStorage.clear(); });
    await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
    const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 15000 }).catch(() => null);
    if (later) { await later.click({ force: true }); await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 10000 }).catch(() => {}); }
    // Chika owned, in the formation, wearing shoes with a 20% Cost Reduction main stat
    await page.evaluate(async () => {
      const { store } = window.__sakura;
      const unlocks = await import('/src/systems/unlocks.js');
      const gear = await import('/src/systems/gear.js');
      const { createRng } = await import('/src/core/rng.js');
      const p = store.profile;
      if (!p.units.chika) unlocks.grantUnit(p, 'chika');
      p.formation = { ...(p.formation || {}), towers: ['chika'] };
      const g = gear.rollGear(createRng(5), { slot: 'shoes', rarity: 'legendary' });
      g.main = { stat: 'costCut', value: 0.2 };
      const uid = gear.addGear(p, g);
      gear.equipGear(p, 'chika', uid);
      store.commit('test'); store.saveNow?.();
    });
    await page.evaluate(() => { location.hash = '#/battle?stage=1-1&difficulty=normal'; });
    await page.waitForFunction(() => window.__battle?.sim && window.__battle.ui?.select, null, { timeout: 60000 });
    // the free hero card arms itself at wave 0 (hero rework, ~0.7 s in), which would close the
    // panel we open: let it arm, then put it back
    await page.waitForFunction(() => window.__battle.ui.placement?.unitId, null, { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => window.__battle.ui.placement?.cancel?.());
    const placed = await page.evaluate(() => {
      const { sim, ui } = window.__battle;
      sim.cash = 1e6;
      let uid = null;
      for (let y = 0.5; y < sim.map.height && uid == null; y += 0.5) {
        for (let x = 0.5; x < sim.map.width && uid == null; x += 0.5) {
          if (!sim.canPlace('chika', x, y).ok) continue;
          const r = sim.placeTower('chika', x, y);
          uid = r?.uid ?? (typeof r === 'number' ? r : null);
        }
      }
      if (uid == null) return null;
      const t = sim.getTower(uid);
      const before = sim.upgradeStatus(uid, 0);
      ui.select(uid);
      return { uid, costMul: t.unitStats?.costMul, cost: before.cost, full: Math.max(5, Math.round((sim.data.unit('chika').paths[0].tiers[0].cost * (sim.diff.costMul ?? 1)) / 5) * 5) };
    });
    check(placed && placed.costMul === 0.8, `${W}x${H} Chika placed with gear costMul ${placed?.costMul}`);
    // her drawer (A3 M4): the price buttons on the Glance, her stats (and the discount) in MORE's Overall tab
    await page.waitForFunction(() => { const el = document.querySelector('[data-testid="tower-panel"]'); return el && !el.hidden && el.querySelector('[data-testid="buy-0"]'); }, null, { timeout: 15000 });
    await page.waitForTimeout(300);
    const btn = await page.locator('[data-testid="buy-0"]').innerText();
    // the price shown is the real one: the cheaper price only, no struck-through full price (UI_DIRECTION §6.6)
    check(placed.cost < placed.full && btn.includes(placed.cost.toLocaleString('en-US')) && !btn.includes(String(placed.full)), `${W}x${H} first price button "${btn.replace(/\s+/g, ' ')}" shows the real price ${placed.cost} (full ${placed.full} not shown)`);
    const was = await page.locator('[data-testid="buy-0"] s').count();
    check(was === 0, `${W}x${H} no struck-through price`);
    await page.locator('[data-testid="panel-more"]').click({ force: true });
    await page.waitForFunction(() => !!document.querySelector('[data-testid="stats-overall"]'), null, { timeout: 15000 });
    const overall0 = await page.locator('[data-testid="tower-panel"]').innerText();
    check(/Upgrades\s*20% cheaper \(gear 20%\)/i.test(overall0), `${W}x${H} MORE's Overall says "Upgrades 20% cheaper (gear 20%)"`);
    await page.locator('[data-testid="panel-more"]').click({ force: true });
    await page.waitForFunction(() => !!document.querySelector('[data-testid="tower-panel"] [data-testid="buy-0"]'), null, { timeout: 15000 });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/chika-base-${W}x${H}.png` });
    // buying charges the shown (cheaper) price: tap 1 arms ("Buy · …"), tap 2 buys
    const cash0 = await page.evaluate(() => window.__battle.sim.cash);
    await page.locator('[data-testid="buy-0"]').click({ force: true });
    await page.waitForTimeout(150);
    const armed = await page.locator('[data-testid="buy-0"]').innerText();
    check(/Buy/.test(armed) && (await page.evaluate(() => window.__battle.sim.cash)) === cash0, `${W}x${H} tap 1 arms the price ("${armed.replace(/\s+/g, ' ')}") and spends nothing`);
    await page.locator('[data-testid="buy-0"]').click({ force: true });
    await page.waitForTimeout(250);
    const cash1 = await page.evaluate(() => window.__battle.sim.cash);
    check(cash0 - cash1 === placed.cost, `${W}x${H} buying charged ${cash0 - cash1} (shown ${placed.cost})`);
    // 5-2-0 and the DPS line
    const want = await page.evaluate((uid) => {
      const { sim, ui } = window.__battle;
      while (sim.getTower(uid).tiers[0] < 5) sim.upgradeTower(uid, 0);
      while (sim.getTower(uid).tiers[1] < 2) sim.upgradeTower(uid, 1);
      ui.select(null);
      ui.select(uid);
      document.querySelector('[data-testid="panel-more"]')?.click();
      const t = sim.getTower(uid);
      const st = sim.towerStats(uid);
      return { tiers: t.tiers.join('-'), own: st.dps, droneEach: t.turretSpec.damage * t.turretSpec.rate, max: t.stats.turret.max };
    }, placed.uid);
    await page.waitForTimeout(300);
    await page.locator('[data-testid="tab-overall"]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(200);
    const panel = await page.locator('[data-testid="tower-panel"]').innerText();
    const dpsText = (panel.match(/DPS(?: \(FULL WING\))?\s*\n?\s*([\d,.]+[kMB]?)/i) || [])[1];
    const expected = want.own + want.droneEach * want.max;
    // the one number style ('stat': one decimal below 100, whole numbers with commas below 10,000, then "12.3k")
    check(dpsText === fmtNum(expected, 'stat') && expected > 100, `${W}x${H} Chika ${want.tiers} DPS shown ${dpsText} = own ${want.own.toFixed(2)} + ${want.max} drones × ${want.droneEach.toFixed(1)} (${fmtNum(expected, 'stat')})`);
    check(/Drones\s*\d+\/9 · [\d.]+ dmg × [\d.]+\/s each/i.test(panel), `${W}x${H} Drones line: ${(panel.match(/drones\s*\d+\/9[^\n]*/i) || ['(missing)'])[0]}`);
    check(/Drones fly\s*[\d.]+ tiles/i.test(panel), `${W}x${H} Overall says how far her drones fly: ${(panel.match(/drones fly[^\n]*\n?[^\n]*/i) || ['(missing)'])[0].replace(/\s+/g, ' ')}`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/chika-520-${W}x${H}.png` });
    // the girl page says upgrades are cheaper too
    await page.evaluate(() => { location.hash = '#/student/chika?tab=info'; });
    // the base stats sit behind the ink strip's MORE (UI_DIRECTION.md §6.2)
    await page.waitForSelector('[data-testid="info-more"]', { timeout: 30000 }).catch(() => {});
    await page.click('[data-testid="info-more"]').catch(() => {});
    await page.waitForFunction(() => /Base stats/i.test(document.querySelector('[data-testid="stats-sheet"]')?.innerText || ''), null, { timeout: 30000 }).catch(() => {});
    const student = await page.evaluate(() => document.body.innerText);
    check(/Upgrade costs\s*(Full price\s*)?20% cheaper/i.test(student), `${W}x${H} girl page: "Upgrade costs … 20% cheaper"`);
    check(errs.length === 0, `${W}x${H} no page errors${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`);
    await page.close();
  }
} catch (e) {
  fails.push(`crashed: ${e.stack || e}`);
  console.log(e);
} finally {
  await browser.close().catch(() => {});
  await server.close();
}
console.log(fails.length ? `\n${fails.length} CHECK(S) FAILED` : '\nALL STAT DISPLAY CHECKS PASSED');
process.exit(fails.length ? 1 : 0);
