// Tryout Day e2e (docs/specs/TRYOUT_DAY.md, M1 plain UI): plays the real game in a browser.
//   1. locked before 2-5; the hub opens once 2-5 is cleared; Before Class: 2 maps, a hero, 6 girls, pick 3, Redraw
//   2. Start class → the battle: the tracker under the HUD, the hero and squad cards
//   3. waves played (the Sim stepped from the page) to the first pick: the Tryout pick sheet (the tracker steps
//      aside; Eraser and Hand-in above the fold); take a girl → her card joins the bar; the next wave waits while a
//      pick is open. Between periods the class bar shows each Subject's twist (a short line on phones) and the
//      Dare's reward; once the period runs, the tracker head and the rule pill name its Subject
//   4. to Recess: the break bar, the next block's seats; a Hall Pass move and Undo; Back to class
//   5. a reload mid-break continues the same run at the same break (the run's own save slot)
//   6. a reload mid-wave: the hub's Continue says it uses the Make-up Test; Continue voids that period
//   7. Give up removes the run (and pays what it banked)
//   8. M4 meta: the hub's wallet; the Weekly Timetable is locked before a Grade 4 clear; a run ends in an Early
//      Dismissal and the Class Photo shows its rewards and share code; Replay this seed opens a practice Before Class;
//      the Yearbook opens with stamps; the Marble Jar opens and a purchase works (its perk shows at Before Class)
// Screenshots go to --shots. node e2e/tryout.mjs [--viewports 844x390,1280x720] [--shots dir]
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewports', '844x390,1280x720').split(',').map((v) => v.split('x').map(Number));
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const SAVE_KEY = 'sakura-sentinels-save-v1';
const IGNORE = [/GPU stall/i, /WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i, /Failed to load resource/i];

const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/?online=local&onboarding=0`;
const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const errors = [];

for (const [W, H] of viewports) {
  log(`\n=== viewport ${W}x${H} ===`);
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: Math.min(W, H) < 600, reducedMotion: 'reduce' });
  // a test-only unlock: once the test sets the flag, 1-1 … 2-5 count as cleared in the stored save before the app loads
  await context.addInitScript((key) => {
    if (!sessionStorage.getItem('__tyUnlock')) return;
    try {
      const s = JSON.parse(localStorage.getItem(key) || 'null');
      if (!s) return;
      s.progress = s.progress || {};
      s.progress.stages = s.progress.stages || {};
      for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '2-1', '2-2', '2-3', '2-4', '2-5']) s.progress.stages[id] = { ...(s.progress.stages[id] || {}), normal: true };
      // (a test-only Marble grant for the Jar step: missions.counters 'ty:mb')
      const mb = Number(sessionStorage.getItem('__tyMarbles') || 0);
      if (mb) {
        s.missions = s.missions || {};
        s.missions.counters = { ...(s.missions.counters || {}), 'ty:mb': mb };
        sessionStorage.removeItem('__tyMarbles');
      }
      localStorage.setItem(key, JSON.stringify(s));
    } catch { /* (a test helper) */ }
  }, SAVE_KEY);
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((r) => r.test(m.text()))) errors.push(`${W}x${H} ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${W}x${H} pageerror ${e.message}`));
  const shot = async (name) => { if (shotsDir) await page.screenshot({ path: `${shotsDir}/${name}-${W}x${H}.png` }); };
  const screenIs = (name) => page.waitForFunction((n) => document.querySelector('#app')?.dataset.screen === n && !document.documentElement.dataset.tx, name, { timeout: 60000, polling: 100 }).then(() => true).catch(() => false);
  const battleReady = () => page.waitForFunction(() => window.__battle?.ui?.tryoutUi && document.querySelector('#app')?.dataset.screen === 'battle' && !document.documentElement.dataset.tx, null, { timeout: 300000, polling: 250 }).then(() => true).catch(() => false);

  // 1. locked, then open
  await page.goto(`${base}#/tryout`);
  await screenIs('tryout');
  check(await page.locator('[data-testid="tryout-locked"]').isVisible(), 'locked before 2-5');
  await page.evaluate(() => sessionStorage.setItem('__tyUnlock', '1'));
  await page.reload();
  await screenIs('tryout');
  check(await page.locator('[data-testid="tryout-before-class"]').isVisible({ timeout: 10000 }).catch(() => false), 'Before Class shows after 2-5');
  check(await page.locator('[data-testid^="tryout-draft-"]').count() === 6, 'six drafted girls');
  check(await page.locator('[data-testid="tryout-wallet"]').isVisible(), 'the hub shows the Marble wallet');
  check(await page.locator('[data-testid="tryout-weekly-go"]').isDisabled() && /Grade 4/.test(await page.locator('[data-testid="tryout-weekly"]').textContent()),
    'the Weekly Timetable is locked before a Grade 4 clear');
  check(await page.locator('[data-testid="tryout-start"]').isDisabled(), 'Start waits for 3 girls');
  await page.click('[data-testid="tryout-redraw"]');
  check(await page.locator('[data-testid="tryout-redraw"]').isDisabled(), 'one free redraw');
  for (const i of [0, 1, 2]) await page.click(`[data-testid="tryout-draft-${i}"]`);
  await shot('ty-before-class');
  const noScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check(noScroll, 'no horizontal scroll on Before Class');

  // 2. the battle
  await page.click('[data-testid="tryout-start"]');
  check(await battleReady(), 'battle mounts with the run UI');
  check(await page.locator('[data-testid="ty-tracker"]').isVisible(), 'tracker shows');
  const squad = await page.evaluate(() => window.__battle.sim.tryout.players[0].squad.slice());
  for (const id of squad) check(await page.locator(`[data-testid="card-${id}"]`).count() === 1, `card for ${id}`);

  // 3. play to the first pick
  const playToWindow = () => page.evaluate(() => {
    const { sim, ui } = window.__battle;
    const spots = [];
    for (let y = 0.75; y < sim.map.height; y += 0.5) for (let x = 0.75; x < sim.map.width; x += 0.5) if (!sim.placementReason('aoi', x, y)) spots.push([x, y]);
    let guard = 0;
    while (!sim.tryoutWindowOpen() && sim.state !== 'won' && sim.state !== 'lost' && guard++ < 60) {
      // (a UI-flow test, not a balance test: hearts and coins topped up between waves)
      sim.lives = sim.maxLives;
      sim.cash += 3000;
      for (const id of [sim.heroConfig?.unitId, ...sim.loadout.keys()]) {
        if (!id || sim.towers.some((t) => t.unitId === id)) continue;
        const s = spots.find(([x, y]) => sim.canPlace(id, x, y).ok);
        if (s) ui.act.place(id, s[0], s[1]);
      }
      for (const t of sim.towers) if (!t.isHero) ui.act.upgrade(t.uid, 0) || ui.act.upgrade(t.uid, 2);
      ui.startWave();
      for (let i = 0; i < 6000 && sim.state === 'wave'; i++) sim.update(1 / 60);
    }
    return { wave: sim.wave, win: sim.tryout.players[0].win, state: sim.state };
  });
  let st = await playToWindow();
  check(st.win === 'pick' && st.wave === 4, `first pick after wave 4 (${JSON.stringify(st)})`);
  await page.waitForSelector('[data-testid="ty-pick"]:not([hidden])', { timeout: 5000 }).catch(() => {});
  check(await page.locator('[data-testid="ty-pick"]').isVisible(), 'pick sheet shows');
  check(await page.locator('[data-testid^="ty-card-"]').count() === 3, 'three cards');
  check(!(await page.locator('[data-testid="ty-tracker"]').isVisible()), 'the tracker steps aside while the pick sheet shows');
  const fold = await page.evaluate(() => {
    const r = (q) => document.querySelector(q)?.getBoundingClientRect();
    const sheet = r('[data-testid="ty-pick"] .ty-sheet');
    const low = ['[data-testid="ty-erase"]', '[data-testid="ty-hand"]', '[data-testid^="ty-path-"]'].map(r).filter(Boolean);
    return { ok: !!sheet && low.every((b) => b.bottom <= Math.min(window.innerHeight, sheet.bottom) + 1), bottoms: low.map((b) => Math.round(b.bottom)), sheet: sheet && Math.round(sheet.bottom), h: window.innerHeight };
  });
  check(fold.ok, `Eraser, Hand it in and the path buttons are above the fold (${JSON.stringify(fold)})`);
  await shot('ty-pick');
  const waited = await page.evaluate(() => !window.__battle.sim.startNextWave());
  check(waited, 'the next wave waits while the pick is open');
  const girl = await page.evaluate(() => window.__battle.sim.tryout.players[0].offer.cards[0].girl);
  await page.click('[data-testid="ty-card-0"]');
  await page.waitForSelector(`[data-testid="card-${girl}"]`, { timeout: 30000 }).catch(() => {});
  check(girl && await page.locator(`[data-testid="card-${girl}"]`).count() === 1, `the Tryout girl (${girl}) joins the bar`);

  // 3b. between periods: the class choice and Double Dare
  await page.waitForSelector('[data-testid="ty-class"]:not([hidden])', { timeout: 30000 }).catch(() => {});
  check(await page.locator('[data-testid^="ty-subject-"]').count() === 2, 'the class choice shows two Subjects');
  const bar = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="ty-class"]');
    const vis = (q) => { const e = el.querySelector(q); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; };
    const twist = [...el.querySelectorAll('[data-testid^="ty-subject-"]')].every((b) => [...b.querySelectorAll('.ty-short, .ty-long')].some((t) => t.getClientRects().length && t.textContent.trim()));
    return { w: Math.round(el.getBoundingClientRect().width), vw: window.innerWidth, twist, gain: vis('[data-testid="ty-dare-gain"]') || vis('.ty-dare ~ .ty-long') };
  });
  check(bar.twist && bar.gain, `each Subject shows its twist and the Dare its reward (${JSON.stringify(bar)})`);
  check(bar.w <= bar.vw * 0.5 + 2, `the class bar stays within half the screen (${bar.w}px of ${bar.vw})`);
  const subjName = (await page.locator('[data-testid="ty-subject-1"] b').textContent()).trim();
  await page.click('[data-testid="ty-subject-1"]');
  await page.click('[data-testid="ty-dare"]');
  await page.waitForTimeout(200);
  const cls = await page.evaluate(() => { const t = window.__battle.sim.tryout; return { next: t.nextSubject, pair: t.subjects[2], dare: t.players[0].dare }; });
  check(cls.next === cls.pair[1] && cls.dare === true, `a Subject and the Dare are chosen (${JSON.stringify(cls)})`);
  await shot('ty-class');
  await page.click('[data-testid="ty-dare"]'); // (off again: the rest of the run plays without the curse)
  // the period starts: its Subject is named in the tracker head (and on the rule pill when it has a map rule)
  await page.evaluate(() => {
    const { sim, ui } = window.__battle;
    ui.startWave();
    for (let i = 0; i < 30 && sim.state === 'wave'; i++) sim.update(1 / 60);
  });
  const headSubj = await page.waitForFunction(() => document.querySelector('[data-testid="ty-head-subject"]')?.textContent, null, { timeout: 10000, polling: 100 })
    .then((x) => x.jsonValue()).catch(() => '');
  check(headSubj.includes(subjName), `the tracker head names the period's Subject (${JSON.stringify(headSubj)} vs ${subjName})`);
  const pill = await page.evaluate(() => {
    const p = document.querySelector('[data-testid="rule-pill"]');
    return { rule: window.__battle.sim.rule?.id, shown: !!p && !p.hidden && p.getClientRects().length > 0, text: p?.textContent || '' };
  });
  check(pill.rule === 'tryout' ? !pill.shown : pill.shown && pill.text.includes(subjName), `the rule pill follows the period's Subject (${JSON.stringify(pill)})`);
  await shot('ty-period');

  // 4. to Recess
  for (let k = 0; k < 3; k++) {
    st = await playToWindow();
    if (st.win === 'pick') {
      await page.waitForSelector('[data-testid="ty-pick"]:not([hidden])', { timeout: 30000 }).catch(() => {});
      await page.click('[data-testid="ty-card-0"]');
      await page.waitForFunction(() => !window.__battle.sim.tryout.players[0].offer, null, { timeout: 30000 }).catch(() => {});
    }
    if (await page.evaluate(() => window.__battle.sim.tryout.players[0].win === 'break')) break;
  }
  check(await page.evaluate(() => window.__battle?.sim.tryout.players[0].win === 'break'), `Recess opens after pick 3 (${JSON.stringify(st)})`);
  await page.waitForSelector('[data-testid="ty-break"]:not([hidden])', { timeout: 30000 }).catch(() => {});
  check(await page.locator('[data-testid="ty-break"]').isVisible(), 'break bar shows');
  check(await page.evaluate(() => window.__battle.sim.ruleInfo().nextPads.length > 0), 'next seats show during the break');
  await shot('ty-break');
  const moved = await page.evaluate(() => {
    const { sim } = window.__battle;
    const t = sim.towers.find((x) => !x.isHero);
    for (let y = 0.75; y < sim.map.height; y += 0.5) for (let x = 0.75; x < sim.map.width; x += 0.5) {
      if ((x - t.x) ** 2 + (y - t.y) ** 2 < 4) continue;
      if (sim.tryoutMove(0, t.uid, x, y).ok) return { uid: t.uid, passes: sim.tryout.players[0].passes };
    }
    return null;
  });
  check(moved && moved.passes === 2, 'a Hall Pass move spends a pass');

  // 5. reload mid-break: the same run, the same break
  await page.evaluate(() => window.__battle.ui.saver?.markProgress?.({ now: true }));
  await page.reload();
  check(await battleReady(), 'a reload continues the run');
  check(await page.evaluate(() => window.__battle.sim.tryout.players[0].win === 'break'), 'still at the break after the reload');
  await page.waitForSelector('[data-testid="ty-ready"]', { timeout: 30000 }).catch(() => {});
  await page.click('[data-testid="ty-ready"]');
  check(await page.evaluate(() => window.__battle.sim.tryout.players[0].win === null), 'Back to class closes the break');

  // 5b. out of hearts: the Make-up Test replaces the defeat sheet and replays the wave
  await page.evaluate(() => {
    const { sim, ui } = window.__battle;
    ui.startWave();
    for (let i = 0; i < 1800 && !sim.enemies.length; i++) sim.update(1 / 60);
    ui.saver.tick();
    sim.lives = 1;
    // (a leak costs at least one heart: leak until the hearts run out)
    for (let k = 0; k < 20 && sim.state === 'wave' && sim.enemies.length; k++) sim._leak(sim.enemies[0]);
  });
  const mk = await page.waitForSelector('[data-testid="ty-makeup"]', { timeout: 30000 }).then(() => true).catch(() => false);
  check(mk, 'the Make-up Test sheet shows at 0 hearts');
  check(!(await page.locator('[data-testid="ty-tracker"]').isVisible()), 'the tracker steps aside for the Make-up sheet');
  await shot('ty-makeup');
  const wave0 = await page.evaluate(() => window.__battle.sim.wave);
  await page.click('[data-testid="ty-makeup-go"]');
  await page.waitForFunction(() => window.__battle?.sim.state !== 'lost', null, { timeout: 30000 }).catch(() => {});
  check(await battleReady(), 'the Make-up Test reopens the battle');
  const mu = await page.evaluate(() => ({ wave: window.__battle.sim.wave, state: window.__battle.sim.state, resumed: window.__battle.sim.tryout.assign.resumed, lives: window.__battle.sim.lives }));
  check(mu.wave === wave0 - 1 && mu.state !== 'wave' && mu.resumed === true && mu.lives > 0, `the wave replays from its start with the hearts of then (${JSON.stringify(mu)})`);

  // 6. reload mid-wave after the Make-up Test: practice
  await page.evaluate(() => {
    const { sim, ui } = window.__battle;
    ui.startWave();
    for (let i = 0; i < 120; i++) sim.update(1 / 60);
    ui.saver.tick();
  });
  await page.goto(`${base}#/tryout`);
  await screenIs('tryout');
  const band = await page.locator('[data-testid="tryout-continue"]').textContent({ timeout: 5000 }).catch(async () => `NONE ${await page.locator('main, body').first().innerText().catch(() => '')}`.slice(0, 300));
  check(/practice/.test(band), 'Continue says the run goes on as practice');
  await shot('ty-hub-continue');
  await page.click('[data-testid="tryout-go-continue"]');
  check(await battleReady(), 'Continue after a mid-wave leave');
  check(await page.evaluate(() => window.__battle.sim.tryout.assign.resumed === true && window.__battle.sim.state !== 'wave'), 'the wave replays from its start and the period is resumed');

  // 7. give up
  await page.goto(`${base}#/tryout`);
  await screenIs('tryout');
  page.once('dialog', (d) => d.accept());
  await page.click('[data-testid="tryout-abandon"]');
  await page.locator('.modal button', { hasText: 'Give up' }).click().catch(() => {});
  await page.waitForTimeout(400);
  check(await page.locator('[data-testid="tryout-before-class"]').isVisible().catch(() => false), 'Give up removes the run');
  const paidGiveUp = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).missions.counters['ty:lbw'] || 0, SAVE_KEY);
  check(paidGiveUp > 0, `giving up paid the periods it banked (Lunchbox sevenths ${paidGiveUp})`);

  // 8. a new run to an Early Dismissal: the Class Photo shows its rewards
  for (const i of [0, 1, 2]) await page.click(`[data-testid="tryout-draft-${i}"]`);
  await page.click('[data-testid="tryout-start"]');
  check(await battleReady(), 'a second run starts');
  st = await playToWindow();
  await page.waitForSelector('[data-testid="ty-pick"]:not([hidden])', { timeout: 30000 }).catch(() => {});
  await page.click('[data-testid="ty-card-0"]');
  await page.waitForFunction(() => !window.__battle.sim.tryout.players[0].offer, null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => {
    const { sim, ui } = window.__battle;
    ui.startWave();
    for (let i = 0; i < 1800 && !sim.enemies.length; i++) sim.update(1 / 60);
    ui.saver.tick();
    sim.lives = 1;
    // (a leak costs at least one heart: leak until the hearts run out)
    for (let k = 0; k < 20 && sim.state === 'wave' && sim.enemies.length; k++) sim._leak(sim.enemies[0]);
  });
  await page.waitForSelector('[data-testid="ty-makeup-no"]', { timeout: 30000 }).catch(() => {});
  await page.click('[data-testid="ty-makeup-no"]');
  const photo = await page.waitForSelector('[data-testid="ty-photo-rewards"]', { timeout: 30000 }).then(() => true).catch(() => false);
  check(photo, 'the Class Photo shows the run\'s rewards');
  const mline = await page.locator('[data-testid="ty-reward-marbles"]').textContent().catch(() => '');
  check(/^Marbles \+\d+ · \d+ \/ 150 this week/.test(mline), `the Marbles line (${mline})`);
  check(await page.locator('[data-testid="ty-reward-box"]').isVisible(), 'the Lunchbox line');
  const code = (await page.locator('[data-testid="ty-share-code"] b').textContent().catch(() => '')).trim();
  check(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/.test(code), `the share code shows (${code})`);
  const photoFit = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="ty-photo-sheet"]').getBoundingClientRect();
    return r.right <= window.innerWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth + 1;
  });
  check(photoFit, 'the Class Photo fits the width');
  await shot('ty-photo');

  // 9. Replay this seed: a practice Before Class of the same seed
  await page.click('[data-testid="ty-replay"]');
  await screenIs('tryout');
  check(await page.waitForSelector('[data-testid="tryout-before-class"][data-mode="practice"]', { timeout: 10000 }).then(() => true).catch(() => false), 'Replay this seed opens a practice Before Class');
  check(await page.locator('[data-testid="tryout-practice-note"]').isVisible(), 'the practice note says it pays nothing');
  await shot('ty-practice');

  // 10. the Yearbook
  await page.click('[data-testid="tryout-open-yearbook"]');
  await screenIs('tryout');
  check(await page.waitForSelector('[data-testid="tryout-yearbook"]', { timeout: 10000 }).then(() => true).catch(() => false), 'the Yearbook opens');
  const stamps = await page.locator('[data-testid="yb-stamps"]').textContent().catch(() => '');
  check(/^[1-9]\d* stamps/.test(stamps), `the Yearbook has stamps (${stamps})`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll in the Yearbook');
  await shot('ty-yearbook');

  // 11. the Marble Jar: a purchase (Pencil Money) and its switch; the perk rides into Before Class
  await page.evaluate(() => sessionStorage.setItem('__tyMarbles', '200'));
  await page.goto(`${base}#/tryout/jar`);
  await page.reload();
  await screenIs('tryout');
  check(await page.waitForSelector('[data-testid="tryout-jar"]', { timeout: 10000 }).then(() => true).catch(() => false), 'the Marble Jar opens');
  const wallet = async () => Number((await page.locator('[data-testid="jar-wallet"] b').textContent()).trim());
  const before = await wallet();
  check(before >= 60, `Marbles to spend (${before})`);
  await page.click('[data-testid="jar-buy-coins"]');
  await page.waitForSelector('[data-testid="jar-toggle-coins"]', { timeout: 5000 }).catch(() => {});
  check(await wallet() === before - 60, 'a purchase spends its Marbles');
  check(await page.locator('[data-testid="jar-toggle-coins"]').getAttribute('aria-pressed') === 'true', 'a bought Desk Supply is on, with its switch');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll in the Marble Jar');
  await shot('ty-jar');
  await page.click('[data-testid="tryout-sub-back"]');
  await screenIs('tryout');
  await page.waitForSelector('[data-testid="tryout-before-class"]', { timeout: 10000 }).catch(() => {});
  if (await page.locator('[data-testid="tryout-normal"]').isVisible().catch(() => false)) await page.click('[data-testid="tryout-normal"]');
  check(/Pencil Money/.test(await page.locator('[data-testid="tryout-perks"]').textContent().catch(() => '')), 'Before Class lists the Desk Supply');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll on the hub');
  await shot('ty-hub');
  await context.close();
}

await browser.close();
await server.close();
if (errors.length) {
  log('\nconsole errors:');
  for (const e of errors.slice(0, 20)) log(`  ${e}`);
}
check(errors.length === 0, 'no console errors');
log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
