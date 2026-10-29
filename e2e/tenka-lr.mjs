// Tenka's Limit Break (docs/specs/BANNERS.md §C.2): her girl page shows the Limit Break panel (no more "LR form
// coming"), names her LR form Critical Mass · Event Horizon and her trial Thesis Defense, and the fee opens the trial;
// after a seeded LR state her page wears the Nightglass frame with her own crest (an orbit ring around a spark, not
// the duo's twin stars), the Students tile too, and the ability Details name Event Horizon. Settings → Online keeps
// the Support Student rows hidden until the friend-support SQL is live. In battle, an LR Tenka's Critical Mass draws
// the pull ring, then the second detonation (the `abilityHorizon` and horizon `abilityShell` events reach the renderer).
// Phone (844x390, touch) and PC (1280x720).
//   node e2e/tenka-lr.mjs [--viewport 844x390] [--shots <dir>]
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 on any failure.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';
import { openApp, seedSave, openBattle, settle, until } from './lib/battleKit.mjs';

const args = process.argv.slice(2);
const opt = (name, def = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport') ? [opt('viewport')] : ['844x390', '1280x720'];
const SHOTS = opt('shots');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium();
console.log(`browser: ${label}`);
const fails = [];
const check = (c, m) => {
  console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`);
  if (!c) fails.push(m);
};
const T = 60000;

/** Tenka owned at L60 gate 5, ★5 (UR), with the Limit Break fee in her bag. */
async function seedTenka(page) {
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    const unlocks = await import('/src/systems/unlocks.js');
    const lb = await import('/src/systems/limitBreak.js');
    const p = store.profile;
    if (!p.units.tenka) unlocks.grantUnit(p, 'tenka', 1760000000000);
    Object.assign(p.units.tenka, { level: 60, breakthrough: 5, awaken: 5 });
    for (const f of lb.limitBreakFee('tenka')) {
      if (f.id === 'coins') p.currencies.coins = (p.currencies.coins || 0) + f.count;
      else p.items[f.id] = (p.items[f.id] || 0) + f.count;
    }
    store.commit('e2e');
    store.saveNow?.();
  });
}

async function go(page, hash, selector) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForSelector(selector, { timeout: T });
  await page.waitForTimeout(400);
}

/** The crest inside a frame: its class, whether it is drawn, its box. */
async function crestInfo(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const c = el.querySelector(':scope > .lr-frame > .lr-crest');
    const r = c?.getBoundingClientRect();
    const cs = c ? getComputedStyle(c) : null;
    return {
      lr: el.classList.contains('is-lr') || el.classList.contains('lr'),
      crest: c ? [...c.classList].join(' ') : null,
      shown: !!cs && cs.display !== 'none' && r.width > 0 && r.height > 0,
      w: r ? Math.round(r.width) : 0,
      h: r ? Math.round(r.height) : 0,
      ring: c ? getComputedStyle(c, '::before').borderTopWidth : null,
      spark: c ? getComputedStyle(c, '::after').clipPath : null,
    };
  }, sel);
}

try {
  for (const vp of viewports) {
    const [W, H] = vp.split('x').map(Number);
    const touch = W < 1000;
    console.log(`viewport ${vp} (${touch ? 'touch' : 'mouse'})`);
    const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
    page.setDefaultTimeout(T);
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    const tap = async (sel) => (touch ? page.locator(sel).first().tap({ force: true }) : page.locator(sel).first().click({ force: true }));
    const shot = async (name) => {
      if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}-${vp}.png`), timeout: 150000 }).catch((e) => console.log(`  warn screenshot ${name}: ${String(e.message).split('\n')[0]}`));
    };

    await openApp(page, base);
    await seedTenka(page);
    const clearToasts = () => page.evaluate(() => document.querySelectorAll('.toast-host > *').forEach((o) => o.remove()));
    const setTenka = (o) => page.evaluate((o) => {
      const { store } = window.__sakura;
      Object.assign(store.profile.units.tenka, o);
      store.commit('e2e');
    }, o);

    // ---- 0. every locked step says what is missing (owner: never locked or greyed out without a reason) -------------
    await setTenka({ level: 50, breakthrough: 4, awaken: 4 });
    await go(page, '#/student/tenka?tab=awaken', '[data-testid="lb-next"]');
    let next = await page.locator('[data-testid="lb-next"]').innerText();
    check(/^Next: reach level 60 with all 5 gates \(now Lv 50, 4\/5 gates\)\.$/.test(next.trim()), `${vp} not maxed: "${next.trim()}"`);
    check(/The fee opens Thesis Defense: clear 8-5 on Nightmare/.test(await page.locator('[data-testid="lb-panel"]').innerText()), `${vp} … and the trial step names Thesis Defense and how to clear it`);
    await clearToasts();
    await page.evaluate(() => document.querySelector('[data-testid="lb-panel"]')?.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(250);
    await shot('page-locked');
    await setTenka({ level: 60, breakthrough: 5, awaken: 4 });
    await go(page, '#/lobby', 'body');
    await go(page, '#/student/tenka?tab=awaken', '[data-testid="lb-next"]');
    next = await page.locator('[data-testid="lb-next"]').innerText();
    check(/^Next: awaken Tenka to ★5 UR \(now ★4\)\.$/.test(next.trim()), `${vp} not ★5: "${next.trim()}"`);
    const coins = await page.evaluate(() => window.__sakura.store.profile.currencies.coins);
    await page.evaluate(() => { const p = window.__sakura.store.profile; p.currencies.coins = 1000; window.__sakura.store.commit('e2e'); });
    await setTenka({ awaken: 5 });
    await go(page, '#/lobby', 'body');
    await go(page, '#/student/tenka?tab=awaken', '[data-testid="lb-next"]');
    next = await page.locator('[data-testid="lb-next"]').innerText();
    check(/^Next: gather the fee \(still missing [\d.,]+[kKM]? coins\)\.$/.test(next.trim()), `${vp} fee short: "${next.trim()}"`);
    await page.evaluate((c) => { const p = window.__sakura.store.profile; p.currencies.coins = c; window.__sakura.store.commit('e2e'); }, coins);
    await go(page, '#/lobby', 'body');

    // ---- 1. her page before Limit Break: the panel, her form and trial, the fee ------------------------------------
    await go(page, '#/student/tenka?tab=awaken', '[data-testid="lb-panel"]');
    next = await page.locator('[data-testid="lb-next"]').innerText();
    check(next.trim() === 'Ready: pay the fee to open Thesis Defense.', `${vp} all set: "${next.trim()}"`);
    const before = (await page.locator('[data-testid="lb-panel"]').innerText()).replace(/\s+/g, ' ');
    check(!/LR form coming/.test(before), `${vp} her page shows the Limit Break panel, not "LR form coming"`);
    check(/Limit Break/.test(before) && /Critical Mass · Event Horizon/.test(before), `${vp} the panel names her LR form Critical Mass · Event Horizon`);
    check(/Event Horizon: the blast pulls enemies toward its centre for 1\.5s, then detonates again for 50% of the blast\./.test(before), `${vp} one short line says what Event Horizon does`);
    check(/The fee opens Thesis Defense: clear 8-5 on Nightmare with Tenka placed, solo, without a Support Student\./.test(before), `${vp} the panel says what Thesis Defense asks`);
    check(/L60 ✓/.test(before) && /★5 ✓/.test(before) && /Fee/.test(before) && /Thesis Defense/.test(before), `${vp} the steps: L60 ✓ · ★5 ✓ · Fee · Thesis Defense`);
    check(await page.locator('[data-testid="lb-pay"]').isEnabled(), `${vp} the fee can be paid`);
    await clearToasts();
    await page.evaluate(() => document.querySelector('[data-testid="lb-panel"]')?.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(250);
    await shot('page-before');
    await tap('[data-testid="lb-pay"]');
    await page.waitForSelector('[data-testid="confirm-ok"]', { timeout: 10000 });
    await tap('[data-testid="confirm-ok"]');
    await page.waitForSelector('[data-testid="lb-trial"]', { timeout: 10000 });
    const open = (await page.locator('[data-testid="lb-panel"]').innerText()).replace(/\s+/g, ' ');
    check(/Thesis Defense is open: clear 8-5 on Nightmare with Tenka placed, solo, without a Support Student\. First clear: LR, 300 gems and a Recruit Ticket\./.test(open), `${vp} the fee paid: Thesis Defense is open`);
    const paid = await page.evaluate(() => window.__sakura.store.profile.missions.counters['lbt:tenka']);
    check(paid === 1, `${vp} the fee is saved (lbt:tenka ${paid})`);
    await shot('page-open');

    // ---- 2. Settings → Online: no Support Student rows before the friend-support SQL is live ------------------------
    await go(page, '#/settings?section=online', '[data-section="online"]');
    check((await page.locator('[data-testid="settings-support"]').count()) === 0, `${vp} Settings → Online hides the Support Student rows while friend support is not live`);
    await page.evaluate(async () => (await import('/src/systems/banners.js')).setFriendshipLive(true));
    await go(page, '#/lobby', 'body');
    await go(page, '#/settings?section=online', '[data-section="online"] [data-testid="settings-support"]');
    check((await page.locator('[data-testid="settings-support"]').count()) === 1, `${vp} … and shows them once it is live`);
    await page.evaluate(async () => (await import('/src/systems/banners.js')).setFriendshipLive(false));

    // ---- 3. a seeded LR state: the Nightglass frame and her orbit crest ---------------------------------------------
    await page.evaluate(() => {
      const { store } = window.__sakura;
      store.profile.missions.counters['lr:tenka'] = 1;
      store.commit('e2e');
      store.saveNow?.();
    });
    await go(page, '#/lobby', 'body');
    await go(page, '#/student/tenka?tab=awaken', '[data-testid="ur-panel"]');
    const after = (await page.locator('[data-testid="lb-panel"]').innerText()).replace(/\s+/g, ' ');
    check(/LR · \+15% damage · \+5% attack speed · Critical Mass · Event Horizon/.test(after), `${vp} after Limit Break: "LR · +15% damage · +5% attack speed · Critical Mass · Event Horizon"`);
    check(/Event Horizon: the blast pulls enemies/.test(after), `${vp} … with the Event Horizon line`);
    const urText = await page.locator('[data-testid="ur-panel"]').innerText();
    check(/Limit Break: LR/.test(urText), `${vp} her Awakening shows "Limit Break: LR"`);
    const tagText = (await page.locator('[data-testid="rarity-tag"]').first().innerText()).trim();
    check(tagText === 'LR', `${vp} her rarity tag reads LR (${tagText})`);
    const stage = await crestInfo(page, '.mb-show-stage');
    check(!!stage?.lr && /\borbit\b/.test(stage.crest || '') && stage.shown, `${vp} her page frame is LR with the orbit crest drawn (${JSON.stringify(stage)})`);
    check(!!stage && stage.ring !== '0px' && /polygon/.test(stage.spark || ''), `${vp} the crest is an orbit ring (border ${stage?.ring}) around a spark (${String(stage?.spark).slice(0, 18)}…)`);
    await page.evaluate(() => document.querySelector('.mb-show-stage')?.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(250);
    await shot('page-lr-frame');
    await clearToasts();
    await page.evaluate(() => document.querySelector('[data-testid="lb-panel"]')?.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(250);
    await shot('page-after');

    // the Students tile wears it too (her own crest, not the duo's twin stars)
    await go(page, '#/students', '[data-unit="tenka"]');
    const tile = await crestInfo(page, '[data-unit="tenka"]');
    check(!!tile?.lr && /\borbit\b/.test(tile.crest || ''), `${vp} her Students tile is LR with the orbit crest (${JSON.stringify(tile)})`);

    // the ability Details name Event Horizon
    await go(page, '#/student/tenka?tab=info', '[data-testid="info-ability"]');
    await tap('[data-testid="info-ability"]');
    await page.waitForSelector('[data-testid="ability-sheet"]', { timeout: 10000 });
    const sheet = (await page.locator('[data-testid="ability-sheet"]').innerText()).replace(/\s+/g, ' ');
    check(/At LR/i.test(sheet) && /Event Horizon: the blast collapses into a gravity pull for 1\.5s/.test(sheet) && /50% of the first blast/.test(sheet), `${vp} her ability Details: "At LR · Event Horizon: …"`);
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => document.querySelectorAll('.modal-overlay, .ui-sheet-scrim').forEach((o) => o.remove()));

    // ---- 4. in battle: the pull ring, then the second detonation ---------------------------------------------------
    await seedSave(page, { girls: ['hikari', 'tenka', 'aoi'], hero: 'hikari', towers: ['tenka', 'aoi'] });
    await openBattle(page, { stage: '1-2' });
    const uid = await page.evaluate(() => __ab.place('tenka'));
    check(uid != null, `${vp} LR Tenka placed`);
    const lr = await page.evaluate((u) => window.__battle.sim.getTower(u).unitStats?.lr === true, uid);
    check(lr, `${vp} her battle stats carry the LR flag`);
    await page.evaluate((u) => __ab.unlock(u, 3), uid);
    await page.evaluate(() => window.__battle.ui.placement?.cancel?.());
    await page.evaluate(() => __ab.keepWave(60));
    await until(page, () => window.__battle.sim.state === 'wave', null, 10000);
    // (step the sim until a few enemies stand in her own range, where Critical Mass looks: a software-rendered page
    // draws few frames a second)
    const near = await page.evaluate((u) => {
      const { sim } = window.__battle;
      const t = sim.getTower(u);
      const inRange = () => sim.enemies.filter((e) => !e.dead && !e.hidden && (e.x - t.x) ** 2 + (e.y - t.y) ** 2 <= (t.eff.range * 0.9) ** 2).length;
      for (let i = 0; i < 60 * 90 && sim.state === 'wave' && inRange() < 3; i++) {
        // (sturdy at once, every one: a synchronous walk outruns keepWave's timer, and her bolts would end the wave)
        for (const e of sim.enemies) if (!e.__sturdy) { e.__sturdy = 1; e.hp *= 60; e.maxHp *= 60; }
        sim.update(1 / 60);
      }
      return inRange();
    }, uid);
    check(near >= 1, `${vp} enemies in her range (${near})`);
    await page.evaluate((u) => __ab.ready(u), uid);
    await page.evaluate(() => { window.__battle.ui.speed = 1; document.querySelectorAll('.bt-feed, .bt-toast, .toast').forEach((o) => o.remove()); });
    const cast = await page.evaluate((u) => window.__battle.sim.castAbility(u), uid);
    check(cast?.ok === true, `${vp} Critical Mass cast (${JSON.stringify(cast)})`);
    const pullAt = await page.evaluate(() => window.__battle.sim.time);
    // (the pull ring, frozen half-way through: the renderer's FX stand still while the battle is paused)
    await until(page, (t0) => window.__battle.sim.time - t0 >= 0.6, pullAt, 30000);
    await page.evaluate(() => __ab.hold(true));
    await settle(page, 300);
    const pull = await page.evaluate(() => (window.__abilEv || []).filter((e) => e.type === 'abilityHorizon'));
    check(pull.length === 1 && pull[0].time === 1.5 && pull[0].radius === 2, `${vp} the pull started (abilityHorizon ${JSON.stringify(pull[0] || null)})`);
    await shot('battle-pull');
    await page.evaluate(() => __ab.hold(false));
    // (the pull lasts 90 ticks of the battle clock: wait for the detonation, and freeze on it)
    const blasted = await until(page, () => (window.__abilEv || []).some((e) => e.type === 'abilityShell' && e.horizon), null, 60000);
    await page.evaluate(() => __ab.hold(true));
    check(blasted, `${vp} the second detonation landed after the pull`);
    await settle(page, 300);
    await shot('battle-detonation');
    await page.evaluate(() => __ab.hold(false));
    const at = await page.evaluate(() => {
      const ev = window.__abilEv;
      const h = ev.find((e) => e.type === 'abilityHorizon');
      const b = ev.find((e) => e.type === 'abilityShell' && e.horizon);
      return h && b ? Math.round((b.at - h.at) * 60) : -1;
    });
    check(at === 90, `${vp} the detonation came 90 ticks (1.5 s) after the pull began (${at})`);
    check(!errors.length, `${vp} no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
    await page.evaluate(() => clearInterval(window.__keepWave));
    await page.close();
  }
} catch (e) {
  fails.push(`crashed: ${e.stack || e}`);
  console.log(e);
} finally {
  await browser.close().catch(() => {});
  await server.close();
}
console.log(fails.length ? `\n${fails.length} CHECK(S) FAILED` : '\nALL TENKA LR CHECKS PASSED');
process.exit(fails.length ? 1 : 0);
