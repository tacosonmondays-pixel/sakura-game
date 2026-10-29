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
//   8. M4 meta: a run ends in an Early Dismissal and the Class Photo shows its rewards and share code; Replay this seed
//      opens a practice Before Class; the Yearbook opens with stamps; the Marble Jar opens and a purchase works (its perk
//      shows at Before Class)
//   R2 (the timetable and the cap bar): Before Class's strip (one slim row: the six stay above the foot), a period's
//      preview opens and closes, a tap outside a preview only closes it (it never toggles a girl or takes a card), the
//      pick sheet's cap bars and MORE (the odds and the caps, focus kept inside), a Grade 12 code above the ladder with
//      its window locked opens a normal day
//   M3 (the Ink & Paper menus): the hub's tiles and their states (all locked before 2-5, Weekly locked before a Grade 4
//      clear, its countdown once open), Wakaba's line, Marbles in the top bar on the Tryout routes only, Before Class's
//      Grade segRow (a locked tap says why), its girl tiles selected, the Jar's rail, the Yearbook's pencil tiles, no
//      horizontal scroll on any of them
//   §20 (Extended Day and Random Class, the minimal UI): Extended Day is locked before a Full Day clear (a tap says
//      why) and selectable after one (the strip ends in "P13+", no boss portrait); the Random Class switch with its help
//      line: the six show but are not pickable, Redraw goes, Start is ready with no picks. The battle side (the reveal,
//      the wave count past 48, Home Time) comes after the sim merge: see the TODO markers in step 11b
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
// a Grade 12 share code (its Autumn Term window is locked in this test's save, and the ladder is far below it)
const { encodeShareCode } = await server.ssrLoadModule('/src/systems/tryoutRuns.js');
const { mapChoices } = await server.ssrLoadModule('/src/sim/tryout/plan.js');
const g12Code = encodeShareCode({ seed: 424242, grade: 12, length: 'half', mapId: mapChoices(424242, 12)[0] });
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
  // (a screenshot is not a check: a WebGL frame that will not settle under load is logged and the run goes on)
  const shot = async (name) => {
    if (!shotsDir) return;
    await page.screenshot({ path: `${shotsDir}/${name}-${W}x${H}.png`, timeout: 60000 }).catch((e) => log(`  (shot ${name} skipped: ${e.message.split('\n')[0]})`));
  };
  const screenIs = (name) => page.waitForFunction((n) => document.querySelector('#app')?.dataset.screen === n && !document.documentElement.dataset.tx, name, { timeout: 60000, polling: 100 }).then(() => true).catch(() => false);
  const battleReady = () => page.waitForFunction(() => window.__battle?.ui?.tryoutUi && document.querySelector('#app')?.dataset.screen === 'battle' && !document.documentElement.dataset.tx, null, { timeout: 300000, polling: 250 }).then(() => true).catch(() => false);

  const noHScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1
    && [...document.querySelectorAll('.screen-body, .ls-list, .hb-main')].every((e) => e.scrollWidth <= e.clientWidth + 1));
  /** Every map and hero card ends above Before Class's foot, or sits in a column that scrolls and ends above it. */
  const colsAboveFoot = () => page.evaluate(() => {
    const foot = document.querySelector('.ty-bc-foot')?.getBoundingClientRect().top ?? Infinity;
    const scroller = (el) => {
      for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
        const oy = getComputedStyle(e).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight + 1) return e;
      }
      return null;
    };
    const bad = [];
    for (const el of document.querySelectorAll('.ty-bc-maps > .ty-map, .ty-bc-heroes > .ty-hero')) {
      const r = el.getBoundingClientRect();
      if (r.bottom <= foot + 0.5) continue;
      const sc = scroller(el);
      // (a column that scrolls inside the body's own scroll does not count: it must end above the foot itself)
      if (sc && !sc.classList.contains('screen-body') && sc.getBoundingClientRect().bottom <= foot + 0.5) continue;
      bad.push(`${el.dataset.testid || el.className}:${Math.round(r.bottom)}>${Math.round(foot)}`);
    }
    return bad;
  });
  const tileState = (id) => page.locator(`[data-testid="${id}"]`).getAttribute('data-locked').then((v) => (v ? 'locked' : 'open')).catch(() => 'missing');
  const marblesPill = () => page.locator('.topbar [data-wallet="marbles"]');
  /** A point on one of `sel`'s elements that the open preview card does not cover (null: every one is covered). */
  const pointOutsidePreview = (sel) => page.evaluate((q) => {
    const pv = document.querySelector('[data-testid="ty-tt-preview"]')?.getBoundingClientRect();
    if (!pv) return null;
    const hit = (r) => !(r.right < pv.left || r.left > pv.right || r.bottom < pv.top || r.top > pv.bottom);
    for (const el of document.querySelectorAll(q)) {
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom > innerHeight - 4 || r.top < 0) continue;
      // the element's lower part, below the card when they overlap sideways
      for (const y of [r.bottom - 8, r.top + r.height / 2, r.top + 8]) {
        const x = r.left + r.width / 2;
        if (!hit({ left: x, right: x, top: y, bottom: y }) && document.elementFromPoint(x, y) && el.contains(document.elementFromPoint(x, y))) return { id: el.dataset.testid, x, y };
      }
    }
    return null;
  }, sel);

  // 1. locked: Wakaba, every tile locked with the rule; Marbles already in the top bar
  await page.goto(`${base}#/tryout`);
  await screenIs('tryout');
  check(await page.locator('[data-testid="tryout-hub"][data-state="locked"]').isVisible(), 'the hub is locked before 2-5');
  const lockedTiles = await Promise.all(['tryout-tile-start', 'tryout-weekly-go', 'tryout-open-jar', 'tryout-open-yearbook', 'tryout-open-records'].map(tileState));
  check(lockedTiles.every((x) => x === 'locked'), `every hub tile is locked before 2-5 (${lockedTiles})`);
  check(/Clear 2-5/.test(await page.locator('[data-testid="tryout-tile-start"]').textContent()), 'the Start tile says what opens it');
  check(/2-5/.test(await page.locator('[data-testid="host"]').textContent().catch(() => '')), 'Wakaba says what opens the tryouts');
  check(await marblesPill().isVisible(), 'Marbles sit in the top bar on the Tryout hub');
  await shot('ty-hub-locked');
  await page.evaluate(() => sessionStorage.setItem('__tyUnlock', '1'));
  await page.reload();
  await screenIs('tryout');
  check(await page.waitForSelector('[data-testid="tryout-hub"][data-state="fresh"]', { timeout: 10000 }).then(() => true).catch(() => false), 'the hub opens after 2-5');
  const openTiles = await Promise.all(['tryout-tile-start', 'tryout-open-jar', 'tryout-open-yearbook', 'tryout-open-records'].map(tileState));
  check(openTiles.every((x) => x === 'open'), `Start, the Jar, the Yearbook and Records open after 2-5 (${openTiles})`);
  check(await tileState('tryout-weekly-go') === 'locked' && /Grade 4/.test(await page.locator('[data-testid="tryout-weekly-go"]').textContent()),
    'the Weekly Timetable is locked before a Grade 4 clear');
  check(await page.locator('[data-testid="tryout-weekly-cd"]').count() === 0, 'no countdown on the locked Weekly tile');
  check((await marblesPill().textContent()).trim() === '0', 'the top bar shows the Marbles held (0)');
  check(await noHScroll(), 'no horizontal scroll on the hub');
  await shot('ty-hub-fresh');
  // Before Class: from the Start tile
  await page.click('[data-testid="tryout-tile-start"]');
  check(await page.waitForSelector('[data-testid="tryout-before-class"]', { timeout: 10000 }).then(() => screenIs('tryout')).catch(() => false), 'Start opens Before Class');
  check(await page.locator('[data-testid^="tryout-draft-"]').count() === 6, 'six drafted girls');
  check(await page.locator('.ty-bc-six > .ui-girltile').count() === 6, 'the six are girl tiles');
  const tags = await page.locator('.ty-bc-six [data-testid="card-tag"]').evaluateAll((els) => els.map((e) => ({ t: e.textContent.trim(), title: e.title, h: e.getBoundingClientRect().height })));
  check(tags.length === 6 && tags.every((t) => /^(Yours|Loaner)$/i.test(t.t) && t.title.startsWith(t.t) && t.h < 30),
    `each girl wears the kit's one-line Yours or Loaner tag, the full words in its title (${tags.map((t) => `${t.t}/${t.title}`)})`);
  check(await page.locator('[data-testid="tryout-start"]').isDisabled(), 'Start waits for 3 girls');
  check(/Pick 3 more/.test(await page.locator('[data-testid="tryout-start-why"]').textContent().catch(() => '')), 'the disabled Start says why');
  await shot('ty-before-class-wait');
  // the Grade row: 12 Grades, a locked one says why
  check(await page.locator('[data-testid^="tryout-grade-"]:not([data-testid="tryout-grade-line"])').count() === 12, 'Grades 1-12 in one row');
  const twist = (await page.locator('[data-testid="tryout-grade-line"]').textContent().catch(() => '')).trim();
  check(twist.length > 0 && !/null|undefined/.test(twist), `the Grade line reads as words (${twist})`);
  check(await page.locator('[data-testid="tryout-grade-1"]').getAttribute('aria-checked') === 'true', 'Grade 1 is chosen');
  await page.click('[data-testid="tryout-grade-2"]');
  const why = await page.locator('[data-testid="tryout-grade-line"]').textContent();
  check(/Clear Grade 1/.test(why) && await page.locator('[data-testid="tryout-grade-1"]').getAttribute('aria-checked') === 'true', `a locked Grade says why and stays unchosen (${why})`);
  // R2: the timetable strip, one slim row under the Grade row: the six stay above the foot
  check(await page.locator('[data-testid="ty-bct"]').isVisible(), 'Before Class shows the timetable strip');
  const fit = await page.evaluate(() => {
    const six = document.querySelector('.ty-bc-six').getBoundingClientRect();
    const foot = document.querySelector('.ty-bc-foot').getBoundingClientRect();
    return { six: Math.round(six.bottom), foot: Math.round(foot.top) };
  });
  check(fit.six <= fit.foot, `the six end above the foot (six bottom ${fit.six}, foot top ${fit.foot})`);
  const under = await colsAboveFoot();
  check(under.length === 0, `every map and hero card is above the foot or in a column that scrolls (${under})`);
  await page.click('[data-testid="ty-tt-p3"]');
  check(await page.waitForSelector('[data-testid="ty-tt-preview"]', { timeout: 3000 }).then(() => true).catch(() => false), 'a tap on P3 opens its preview');
  check(await page.locator('[data-testid="ty-tt-p3"]').getAttribute('aria-expanded') === 'true', 'P3 says its preview is open');
  await page.click('[data-testid="ty-tt-preview-close"]');
  check(await page.locator('[data-testid="ty-tt-preview"]').count() === 0, 'the preview\'s × closes it');
  // a tap outside an open preview only closes it: the girl it lands on is not picked
  await page.click('[data-testid="ty-tt-p2"]');
  await page.waitForSelector('[data-testid="ty-tt-preview"]', { timeout: 3000 }).catch(() => {});
  const bcOut = await pointOutsidePreview('.ty-bc-six > .ui-girltile');
  const selBefore = await page.locator('.ty-bc-six > .ui-girltile.sel').count();
  if (bcOut) await page.mouse.click(bcOut.x, bcOut.y);
  await page.waitForTimeout(150);
  check(!!bcOut && await page.locator('[data-testid="ty-tt-preview"]').count() === 0 && await page.locator('.ty-bc-six > .ui-girltile.sel').count() === selBefore,
    `a tap on a girl with a preview open only closes the preview (${bcOut?.id})`);
  await page.click('[data-testid="tryout-redraw"]');
  check(await page.locator('[data-testid="tryout-redraw"]').isDisabled(), 'one free redraw');
  for (const i of [0, 1, 2]) await page.click(`[data-testid="tryout-draft-${i}"]`);
  check(await page.locator('.ty-bc-six > .ui-girltile.sel[aria-pressed="true"]').count() === 3, 'the three picked tiles show selected');
  check(!(await page.locator('[data-testid="tryout-start"]').isDisabled()), 'Start opens with 3 girls');
  await shot('ty-before-class');
  check(await noHScroll(), 'no horizontal scroll on Before Class');

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
      // (hearts topped up inside the wave too: a boss leak at a hard Subject must not end a UI-flow run)
      for (let i = 0; i < 6000 && sim.state === 'wave'; i++) {
        sim.update(1 / 60);
        if (sim.lives < sim.maxLives / 2) sim.lives = sim.maxLives;
      }
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

  // 4. to Recess (R2: at the Pep Talk picks, the cap bars, MORE and a tap outside a preview)
  let barsSeen = 0;
  let moreDone = false;
  for (let k = 0; k < 3; k++) {
    st = await playToWindow();
    if (st.win === 'pick') {
      await page.waitForSelector('[data-testid="ty-pick"]:not([hidden])', { timeout: 30000 }).catch(() => {});
      // (the sheet paints on a frame: wait for this pick's sheet, not the last one's)
      await page.waitForFunction(() => {
        const o = window.__battle.sim.tryout.players[0].offer;
        return !o || !!document.querySelector(`[data-testid="ty-pick"] .ty-pick-sheet[aria-label="Pick ${o.pick}"]`);
      }, null, { timeout: 30000, polling: 100 }).catch(() => {});
      if (await page.evaluate(() => window.__battle.sim.tryout.players[0].offer?.kind !== 'girls')) {
        // every card with a capped family it reaches carries its bar, and only those (the bar's own fold)
        const bars = await page.evaluate(async () => {
          const { capBar } = await import('/src/ui/battle/tryout/caps.js');
          const { sim } = window.__battle;
          const cards = sim.tryout.players[0].offer.cards;
          return cards.map((c, i) => {
            const el = document.querySelector(`[data-testid="ty-cap-${i}"]`);
            const ln = el?.querySelector('.ty-cap-ln');
            return { want: !!capBar(sim, 0, c), has: !!el && el.getClientRects().length > 0, whole: !ln || ln.scrollHeight <= ln.clientHeight + 1, text: ln?.textContent || '' };
          });
        });
        check(bars.every((b) => b.want === b.has), `a cap bar on each Pep Talk that has one (${JSON.stringify(bars.map((b) => b.text || '-'))})`);
        check(bars.every((b) => b.whole), 'each cap line shows whole (no words cut off)');
        barsSeen += bars.filter((b) => b.has).length;
        if (!moreDone) {
          moreDone = true;
          await shot('ty-pick-pep');
          // MORE: the odds and the caps; focus stays inside; × closes it
          await page.click('[data-testid="ty-more"]');
          check(await page.waitForSelector('[data-testid="ty-more-sheet"]', { timeout: 3000 }).then(() => true).catch(() => false), 'MORE opens its sheet');
          check(await page.locator('[data-testid="ty-more-odds"]').isVisible() && await page.locator('[data-testid="ty-more-caps"]').isVisible(), 'MORE shows the odds and the caps');
          await shot('ty-more');
          let inside = true;
          for (let t = 0; t < 4; t++) {
            await page.keyboard.press(t % 2 ? 'Shift+Tab' : 'Tab');
            inside = inside && await page.evaluate(() => !!document.activeElement?.closest('[data-testid="ty-more-sheet"]'));
          }
          check(inside, 'Tab stays inside MORE while it is open');
          await page.click('[data-testid="ty-more-close"]');
          check(await page.locator('[data-testid="ty-more-sheet"]').count() === 0, 'MORE\'s × closes it');
          // a tap outside an open preview only closes it: the card it lands on is not taken, the Eraser not spent
          await page.click('[data-testid="ty-tt-p1"]');
          check(await page.waitForSelector('[data-testid="ty-tt-preview"]', { timeout: 3000 }).then(() => true).catch(() => false), 'a timetable cell on the pick sheet opens its preview');
          const before = await page.evaluate(() => { const p = window.__battle.sim.tryout.players[0]; return { seq: p.offer?.seq, cards: p.cards.length, erasers: p.erasers }; });
          const out = await pointOutsidePreview('[data-testid^="ty-card-"], [data-testid="ty-erase"]');
          if (out) await page.mouse.click(out.x, out.y);
          await page.waitForTimeout(200);
          const after = await page.evaluate(() => { const p = window.__battle.sim.tryout.players[0]; return { seq: p.offer?.seq, cards: p.cards.length, erasers: p.erasers }; });
          check(!!out && await page.locator('[data-testid="ty-tt-preview"]').count() === 0 && JSON.stringify(after) === JSON.stringify(before),
            `a tap outside the preview closes it and takes nothing (${out?.id}: ${JSON.stringify(before)} → ${JSON.stringify(after)})`);
        }
      }
      await page.click('[data-testid="ty-card-0"]');
      await page.waitForFunction(() => !window.__battle.sim.tryout.players[0].offer, null, { timeout: 30000 }).catch(() => {});
    }
    if (await page.evaluate(() => window.__battle.sim.tryout.players[0].win === 'break')) break;
  }
  check(moreDone && barsSeen > 0, `the Pep Talk picks showed cap bars (${barsSeen})`);
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
  check(await page.locator('[data-testid="tryout-tile-start"]').isVisible().catch(() => false) && await page.locator('[data-testid="tryout-continue"]').count() === 0, 'Give up removes the run');
  const paidGiveUp = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).missions.counters['ty:lbw'] || 0, SAVE_KEY);
  check(paidGiveUp > 0, `giving up paid the periods it banked (Lunchbox sevenths ${paidGiveUp})`);

  // 8. a new run to an Early Dismissal: the Class Photo shows its rewards
  await page.click('[data-testid="tryout-tile-start"]');
  await page.waitForSelector('[data-testid="tryout-before-class"]', { timeout: 10000 }).catch(() => {});
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
  const againSeen = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="ty-photo-sheet"]').getBoundingClientRect();
    const b = document.querySelector('[data-testid="ty-again"]').getBoundingClientRect();
    return b.top >= s.top && b.bottom <= Math.min(s.bottom, window.innerHeight) + 1;
  });
  check(againSeen, 'the Class Photo buttons are in view without scrolling');
  await shot('ty-photo');

  // 9. Replay this seed: a practice Before Class of the same seed
  await page.click('[data-testid="ty-replay"]');
  await screenIs('tryout');
  check(await page.waitForSelector('[data-testid="tryout-before-class"][data-mode="practice"]', { timeout: 10000 }).then(() => true).catch(() => false), 'Replay this seed opens a practice Before Class');
  check(await page.locator('[data-testid="tryout-practice-note"]').isVisible(), 'the practice note says it pays nothing');
  await shot('ty-practice');
  // fix check M3: Back, then a bad code (or a locked Weekly) opens a normal day, never the old practice / Weekly draft
  const modeAfter = async (hash) => {
    await page.goto(`${base}#/tryout`);
    await screenIs('tryout');
    await page.goto(`${base}${hash}`);
    await page.waitForSelector('[data-testid="tryout-before-class"]', { timeout: 10000 }).catch(() => {});
    return page.locator('[data-testid="tryout-before-class"]').getAttribute('data-mode').catch(() => 'missing');
  };
  check(await modeAfter('#/tryout/class?code=ZZZZZ-ZZZZZ') === 'normal', 'practice → Back → a bad code: a normal day, not the old practice draft');
  check(await modeAfter(`#/tryout/class?code=${code}`) === 'practice', 'the good code opens practice again');
  check(await modeAfter('#/tryout/class?weekly=1') === 'normal', 'practice → Back → ?weekly=1 while the Weekly is locked: a normal day');
  // R2: a Grade 12 code, above the ladder and its window (Autumn Term) still locked: a normal day, never practice
  check(!!g12Code && await modeAfter(`#/tryout/class?code=${g12Code}`) === 'normal', `a Grade 12 code with its window locked opens a normal day (${g12Code})`);
  check(await page.locator('.toast-host .toast').count() > 0, 'a bad code or a locked Weekly says so in a toast');
  await page.waitForFunction(() => !document.querySelector('.toast-host .toast'), null, { timeout: 10000 }).catch(() => {}); // (clean shots after)

  // 10. the Yearbook (from the hub's tile): the rail with its counts, a page per student, a pencil sketch for a Loaner
  await page.goto(`${base}#/tryout`);
  await screenIs('tryout');
  await page.click('[data-testid="tryout-open-yearbook"]');
  await screenIs('tryout');
  check(await page.waitForSelector('[data-testid="tryout-yearbook"]', { timeout: 10000 }).then(() => true).catch(() => false), 'the Yearbook opens');
  const stamps = await page.locator('[data-testid="yb-stamps"]').textContent().catch(() => '');
  check(/^[1-9]\d* stamps/.test(stamps), `the Yearbook has stamps (${stamps})`);
  const ybTabs = await page.locator('[data-testid="yb-rail"] .ui-stab').evaluateAll((els) => els.map((e) => `${e.dataset.tab}:${e.querySelector('.num')?.textContent || ''}`));
  check(ybTabs.length === 4 && /^girls:\d+\/\d+$/.test(ybTabs[0]), `the Yearbook rail: four sections with counts (${ybTabs})`);
  check(await page.locator('[data-testid^="yb-girl-"].ui-girltile').count() >= 20, 'a girl tile per student');
  // a Loaner who tried out is a pencil sketch: stamp one the player does not own, then look again
  const blank = await page.locator('[data-page="blank"]').first().getAttribute('data-unit').catch(() => null);
  await page.evaluate((id) => {
    const { store } = window.__sakura;
    store.profile.tryoutMeta.yb.girls[id] = 1;
    store.commit('test');
  }, blank);
  await page.goto(`${base}#/tryout/yearbook?tab=girls`);
  await page.waitForSelector(`[data-testid="yb-girl-${blank}"][data-page="pencil"]`, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  await screenIs('tryout'); // (the screen change has finished: no half-faded shot)
  const pencil = page.locator(`[data-testid="yb-girl-${blank}"]`);
  check(blank && await pencil.getAttribute('data-page') === 'pencil' && /Not yours yet/i.test(await pencil.textContent()) && await pencil.evaluate((e) => e.classList.contains('locked')),
    `a Loaner's page is a pencil tile: "Not yours yet" (${blank})`);
  check(await noHScroll(), 'no horizontal scroll in the Yearbook');
  await shot('ty-yearbook');
  await pencil.click();
  check(await page.waitForSelector('[data-testid="yb-page"]', { timeout: 5000 }).then(() => true).catch(() => false) && await page.locator('[data-testid="yb-page"] [data-testid="girl-plate"]').count() === 1, 'her page opens with her nameplate');
  await shot('ty-yearbook-page');
  await page.keyboard.press('Escape');

  // 11. the Marble Jar: a purchase (Pencil Money) and its switch; the perk rides into Before Class
  await page.evaluate(() => sessionStorage.setItem('__tyMarbles', '200'));
  await page.goto(`${base}#/tryout/jar`);
  await page.reload();
  await screenIs('tryout');
  check(await page.waitForSelector('[data-testid="tryout-jar"]', { timeout: 10000 }).then(() => true).catch(() => false), 'the Marble Jar opens');
  const jarTabs = await page.locator('[data-testid="jar-rail"] .ui-stab').evaluateAll((els) => els.map((e) => `${e.dataset.tab}:${e.querySelector('.num')?.textContent || ''}`));
  check(jarTabs.length === 3 && jarTabs[0] === 'desk:0/4', `the Jar's rail: three shelves with counts (${jarTabs})`);
  const wallet = async () => Number((await marblesPill().textContent()).replace(/\D/g, ''));
  const before = await wallet();
  check(before >= 60, `Marbles to spend, in the top bar (${before})`);
  await page.click('[data-testid="jar-buy-coins"]');
  await page.waitForSelector('[data-testid="jar-toggle-coins"]', { timeout: 5000 }).catch(() => {});
  check(await wallet() === before - 60, 'a purchase spends its Marbles');
  check(await page.locator('[data-testid="jar-toggle-coins"]').getAttribute('aria-pressed') === 'true', 'a bought Desk Supply is on, with its switch');
  check(await page.locator('[data-testid="jar-rail"] [data-tab="desk"] .num').textContent() === '1/4', 'the shelf count follows the purchase');
  check(await noHScroll(), 'no horizontal scroll in the Marble Jar');
  await shot('ty-jar');
  await page.goto(`${base}#/tryout`);
  await screenIs('tryout');
  await page.click('[data-testid="tryout-tile-start"]');
  await page.waitForSelector('[data-testid="tryout-before-class"]', { timeout: 10000 }).catch(() => {});
  check(!(await page.locator('[data-testid="tryout-normal"]').isVisible().catch(() => false)), 'Start opens a normal day (no Weekly or practice draft left over)');
  check(/Pencil Money/.test(await page.locator('[data-testid="tryout-perks"]').textContent().catch(() => '')), 'Before Class lists the Desk Supply');

  // 11b. §20: Extended Day (locked before a Full Day clear, selectable after) and the Random Class switch
  const lengthItems = await page.locator('[data-testid^="tryout-length-"]').evaluateAll((els) => els.map((e) => `${e.dataset.id}${e.classList.contains('locked') ? ':locked' : ''}`));
  check(lengthItems.join() === 'half,full:locked,after:locked', `the length row: Half Day · Full Day · Extended Day, the last two locked so far (${lengthItems})`);
  await page.click('[data-testid="tryout-length-after"]');
  const afterWhy = await page.locator('[data-testid="tryout-grade-line"]').textContent().catch(() => '');
  check(/Clear a Full Day first/.test(afterWhy) && await page.locator('[data-testid="tryout-length-after"]').getAttribute('aria-checked') !== 'true',
    `a locked Extended Day tap says why and stays unchosen (${afterWhy})`);
  const help = await page.locator('[data-testid="tryout-random-help"]').textContent().catch(() => '');
  check(await page.locator('[data-testid="tryout-random"]').isVisible() && /striker/.test(help) && /flyers/.test(help) && /Control or Support/.test(help),
    `the Random Class switch shows with its help line (${help})`);
  // a Full Day clear (test-only: the counters a clear writes) opens Extended Day
  await page.evaluate(() => {
    const { store } = window.__sakura;
    store.profile.missions.counters = { ...(store.profile.missions.counters || {}), 'ty:half': 1, 'ty:full': 1 };
    store.commit('test');
    store.saveNow?.();
  });
  await page.goto(`${base}#/tryout`);
  await screenIs('tryout');
  await page.click('[data-testid="tryout-tile-start"]');
  await page.waitForSelector('[data-testid="tryout-before-class"]', { timeout: 10000 }).catch(() => {});
  check(!(await page.locator('[data-testid="tryout-length-after"]').evaluate((e) => e.classList.contains('locked')).catch(() => true)), 'Extended Day opens after a Full Day clear');
  await page.click('[data-testid="tryout-length-after"]');
  await page.waitForSelector('[data-testid="tryout-before-class"][data-length="after"]', { timeout: 5000 }).catch(() => {});
  check(await page.locator('[data-testid="tryout-length-after"]').getAttribute('aria-checked') === 'true'
    && /^Extended Day/.test(await page.locator('.ty-bc-title').textContent().catch(() => '')), 'Extended Day is chosen and names the day');
  check(await page.locator('[data-testid="ty-bct"][data-length="after"] [data-testid="ty-tt-more"]').isVisible()
    && await page.locator('[data-testid="ty-bct"] [data-testid="ty-tt-boss"]').count() === 0
    && (await page.locator('[data-testid="ty-tt-p12"] .ty-tt-p').textContent().catch(() => '')) === 'P12',
  'the Extended Day strip: P1-P12, then "P13+" where the boss portrait was');
  await page.click('[data-testid="tryout-draft-0"]');
  check(await page.locator('.ty-bc-six > .ui-girltile.sel').count() === 1, 'a normal day still picks (one tile selected)');
  await page.click('[data-testid="tryout-random"]');
  await page.waitForSelector('[data-testid="tryout-before-class"][data-random="on"]', { timeout: 5000 }).catch(() => {});
  check(await page.locator('[data-testid="tryout-random"]').getAttribute('aria-pressed') === 'true', 'Random Class switches on');
  check(await page.locator('.ty-bc-six > .ui-girltile').count() === 6 && await page.locator('.ty-bc-six > .ui-girltile.sel').count() === 0
    && await page.locator('.ty-bc-six > .ui-girltile.ty-drawn[aria-disabled="true"]').count() === 6, 'Random Class: the six show, drawn, none selected');
  // (force: the tile is aria-disabled, so Playwright would wait for it to enable; the tap must still pick nothing)
  await page.locator('[data-testid="tryout-draft-1"]').click({ force: true });
  check(await page.locator('.ty-bc-six > .ui-girltile.sel').count() === 0, 'Random Class: a tap on a girl picks nothing (the class draws the three)');
  check(await page.locator('[data-testid="tryout-redraw"]').count() === 0 && /drawn at the bell/i.test(await page.locator('[data-testid="tryout-squad-label"]').textContent().catch(() => '')),
    'Random Class: no Redraw; the squad is drawn at the bell');
  check(!(await page.locator('[data-testid="tryout-start"]').isDisabled()) && await page.locator('[data-testid="tryout-start-why"]').count() === 0, 'Random Class: Start is ready with no picks');
  check(/ 0 Erasers/.test(await page.locator('.ty-bc-facts').textContent().catch(() => '')), 'the facts line follows Random Class (no Erasers)');
  const optsFit = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="tryout-random-help"]').getBoundingClientRect();
    const st = document.querySelector('[data-testid="tryout-start"]').getBoundingClientRect();
    return r.right <= innerWidth + 1 && r.width > 0 && st.bottom <= innerHeight + 1 && st.right <= innerWidth + 1;
  });
  check(optsFit, 'the help line fits the width and Start class stays in view');
  const under2 = await colsAboveFoot();
  const six2 = await page.evaluate(() => document.querySelector('.ty-bc-six').getBoundingClientRect().bottom <= document.querySelector('.ty-bc-foot').getBoundingClientRect().top + 0.5);
  check(under2.length === 0 && six2, `with Extended Day and Random Class: the six, the maps and the heroes stay above the foot (${under2})`);
  check(await noHScroll(), 'no horizontal scroll on Before Class with Extended Day and Random Class');
  await shot('ty-before-class-extended-random');
  // TODO(§20 battle e2e, after the E1/E2 sim merge): Start class here with Extended Day + Random Class on a forced seed
  //   and check: the run's Sim has length 'after' and random (window.__battle.sim.tryout); the first pick opens as the
  //   reveal ([data-testid="ty-reveal"], its ribbon, no ty-erase / ty-hand / ty-path-*, [data-testid="ty-reveal-deck"]
  //   data-landed turns true before the Sim lands it, then the sheet closes by itself with no click); the class bar has
  //   no Double Dare; the Make-up flow past wave 48.
  // TODO(§20 battle e2e): play two periods past wave 48 (sim stepped from the page as playToWindow does): the tracker
  //   head reads "Wave N · Stay Late" ([data-testid="ty-band-wave"]), the HUD wave counter is the bare number, and the
  //   Class Photo is Home Time with [data-testid="ty-photo-wave"] "Wave N" and [data-testid="ty-seed-only"] (no code).
  // (back to a plain day for the steps after this one)
  await page.click('[data-testid="tryout-random"]');
  await page.click('[data-testid="tryout-length-half"]');
  // Marbles only on the Tryout routes
  await page.goto(`${base}#/students`);
  await screenIs('students');
  check(await page.locator('.topbar [data-wallet="marbles"]').count() === 0, 'no Marbles in the top bar off the Tryout routes');
  // a Grade 4 clear (and Summer Term's 4-5) opens the Weekly Timetable: its countdown in the corner, never red
  await page.evaluate(() => {
    const { store } = window.__sakura;
    for (const id of ['3-1', '3-2', '3-3', '3-4', '3-5', '4-1', '4-2', '4-3', '4-4', '4-5']) store.profile.progress.stages[id] = { ...(store.profile.progress.stages[id] || {}), clears: 1, normal: true };
    store.profile.tryoutGrade = 4;
    store.commit('test');
    store.saveNow?.();
  });
  await page.goto(`${base}#/tryout`);
  await screenIs('tryout');
  await page.waitForSelector('[data-testid="tryout-weekly-cd"]', { timeout: 10000 }).catch(() => {});
  const cd = page.locator('[data-testid="tryout-weekly-cd"]');
  check(await tileState('tryout-weekly-go') === 'open' && await cd.isVisible() && await cd.getAttribute('data-urgent') === 'off' && /\d/.test(await cd.textContent()),
    `the open Weekly tile shows its reset countdown, never urgent (${await cd.textContent().catch(() => '')})`);
  check(await noHScroll(), 'no horizontal scroll on the hub');
  await shot('ty-hub');
  await page.click('[data-testid="tryout-weekly-go"]');
  check(await page.waitForSelector('[data-testid="tryout-before-class"][data-mode="weekly"]', { timeout: 10000 }).then(() => true).catch(() => false), 'the Weekly tile opens the week\'s Before Class');
  check(await page.locator('[data-testid^="tryout-grade-"]:not([data-testid="tryout-grade-line"])').count() === 0, 'the Weekly plays a fixed Grade (no Grade row)');
  await shot('ty-before-class-weekly');
  // fix check M3, the Weekly way: Weekly → Back → a bad code opens a normal day under the ?code= URL, not the Weekly draft
  check(await modeAfter('#/tryout/class?code=ZZZZZ-ZZZZZ') === 'normal', 'Weekly → Back → a bad code: a normal day, not the old Weekly draft');
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
