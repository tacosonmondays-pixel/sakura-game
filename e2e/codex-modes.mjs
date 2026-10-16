// Battle modes + map rules end to end (docs/specs/CODEX_MODES.md §10 "e2e"), at 844×390 and 1280×720.
//   node e2e/codex-modes.mjs [--viewport 844x390] [--shots <dir>] [--only prep,battle,ambush,win,coop]
// Steps: (1) fresh 1-4 prep: locked modes + the Petal Sanctuary rule panel; (2) a granted 1-4 clear:
// six cards, Goblin Rush → Start label, URL, ribbon corners, the first-clear note, the reward line,
// Last Petal → Lives 1; (3) in battle: the mode chip and the rule pill, the pill flips ACTIVE on 3-3,
// the popover; (4) 4-2 Rear Ambush in Standard and Reverse Route: banners and the scout's ⇄; (5) a
// fast-forwarded win → ribbon results, then prep "Ribbon ✓" and the stage card count; (6) Nightmare:
// the Last Petal card is disabled; (7) co-op two tabs (host picks Rush, the guest sees it, a changed
// mode clears Ready, both HUDs show the chip, Freeplay disables the segment). Screenshots go to --shots.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720'];
const shotsDir = opt('shots', join(tmpdir(), 'codex-modes-shots'));
const only = opt('only', 'prep,battle,ambush,win,coop').split(',');
mkdirSync(shotsDir, { recursive: true });

let fails = 0;
let passes = 0;
const log = (...a) => console.log(...a);
const check = (ok, msg) => {
  if (ok) passes++;
  else fails++;
  log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`);
};

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/`;
const { browser } = await launchChromium();

async function newPage(vp) {
  const [w, hgt] = vp.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 60000 });
  // a fresh profile gets the beta-tester gift popup on start (until Nov 7): "Later"
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 4000 }).catch(() => null);
  if (later) await later.click({ force: true }).catch(() => null);
  return page;
}

/** Clears campaign stages up to (not including) `upTo` on Normal; `extra` patches entries. */
async function grant(page, upTo, extra = {}) {
  await page.evaluate(({ upTo, extra }) => {
    const { store } = window.__sakura;
    const p = store.profile;
    p.progress ||= { stages: {} };
    const ids = [];
    for (let c = 1; c <= 8; c++) for (let s = 1; s <= 5; s++) ids.push(`${c}-${s}`);
    for (const id of ids.slice(0, ids.indexOf(upTo))) p.progress.stages[id] = { clears: 1, easy: true, normal: true, hard: false, nightmare: false, ...(p.progress.stages[id] || {}) };
    for (const [id, e] of Object.entries(extra)) p.progress.stages[id] = { clears: 0, easy: false, normal: false, hard: false, nightmare: false, ...(p.progress.stages[id] || {}), ...e };
    // a strong enough formation for fast-forwarded wins
    p.formation = { hero: p.formation?.hero ?? null, towers: Object.keys(p.units).filter((id) => id !== p.formation?.hero).slice(0, 8) };
    store.commit('replace');
  }, { upTo, extra });
}

const go = async (page, hash) => {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForTimeout(500);
};
const text = (page, sel) => page.evaluate((s) => document.querySelector(s)?.textContent?.trim() ?? null, sel);
const shot = (page, vp, name) => page.screenshot({ path: join(shotsDir, `${vp}-${name}.png`) });

async function waitBattle(page, mode = null) {
  await page.waitForFunction((m) => window.__battle?.sim && (!m || window.__battle.sim.mode?.id === m) && document.querySelector('[data-testid=battle-hud]'), mode, { timeout: 60000 });
  await page.waitForTimeout(900);
}

/** Opens a battle route from the campaign map (a fresh mount every time). */
async function openBattle(page, hash, mode) {
  await go(page, '#/campaign');
  await page.waitForFunction(() => !window.__battle, null, { timeout: 20000 }).catch(() => null);
  await go(page, hash);
  await waitBattle(page, mode);
}

/** Runs the battle's sim forward by `seconds` of game time (in chunks, so the HUD keeps up). */
async function fastForward(page, seconds, until = null) {
  for (let left = seconds; left > 0; left -= 5) {
    const done = await page.evaluate(({ s, until }) => {
      const sim = window.__battle?.sim;
      if (!sim) return true;
      for (let i = 0; i < s * 4; i++) {
        if (sim.state === 'prep' || sim.state === 'between') sim.startNextWave();
        sim.update(0.25);
        if (sim.state === 'won' || sim.state === 'lost') return true;
        if (until && new Function('sim', `return (${until})`)(sim)) return true;
      }
      return false;
    }, { s: Math.min(5, left), until });
    await page.waitForTimeout(30);
    if (done) break;
  }
}

for (const vp of viewports) {
  log(`\n== ${vp}`);
  const page = await newPage(vp);

  if (only.includes('prep')) {
    log('(1) fresh profile, 1-4 prep');
    await grant(page, '1-4');
    await go(page, '#/stage/1-4?difficulty=normal');
    check(!!(await page.$('[data-testid=modes-locked]')), 'modes locked: "Clear this stage once…"');
    check((await text(page, '[data-testid=modes-locked]'))?.includes('Clear this stage once to unlock battle modes.'), 'locked text');
    check((await text(page, '[data-testid=rule-panel]'))?.includes('Petal Sanctuary'), 'Map rule: Petal Sanctuary');
    await shot(page, vp, 'prep-locked');

    log('(2) 1-4 cleared on Normal: the mode grid');
    await grant(page, '1-4', { '1-4': { normal: true, clears: 1 } });
    await go(page, '#/campaign');
    await go(page, '#/stage/1-4?difficulty=normal');
    const cards = await page.$$('[data-testid^=mode-]:not([data-testid=mode-selected-text]):not([data-testid=mode-reward-line])');
    check(cards.length === 6, `six mode cards (${cards.length})`);
    await page.click('[data-testid=mode-rush]');
    await page.waitForTimeout(300);
    const start = await text(page, '[data-testid=stage-start]');
    check(/Start · Normal · Goblin Rush/i.test(start || ''), `Start reads "${start}"`);
    check((await page.evaluate(() => location.hash)).includes('mode=rush'), 'URL has mode=rush');
    await page.click('[data-testid=diff-hard]');
    await page.waitForTimeout(300);
    const corner = await text(page, '[data-testid=diff-hard] .ma-ribbon-corner');
    check(corner === 'Ribbon' && !(await page.$('[data-testid=diff-hard] .ma-diff-gems')), `Hard button shows "Ribbon", no +60 (${corner})`);
    check((await page.evaluate(() => document.body.textContent)).includes('Battle modes earn ribbons, not medals or medal gems.'), 'first clear note');
    check((await text(page, '[data-testid=mode-reward-line]'))?.includes('Drops as Normal: beat Hard in Standard here for Hard drops.'), 'reward line with Hard selected');
    await shot(page, vp, 'prep-rush-hard');
    await page.click('[data-testid=mode-laststand]');
    await page.waitForTimeout(300);
    const lives = await page.evaluate(() => [...document.querySelectorAll('.ma-fact')].find((f) => /lives/i.test(f.textContent))?.querySelector('.ma-fact-value')?.textContent);
    check(lives === '1', `Last Petal → Lives 1 (${lives})`);
    await shot(page, vp, 'prep-laststand');

    log('(6) Nightmare: Last Petal is merged');
    await page.click('[data-testid=diff-nightmare]');
    await page.waitForTimeout(300);
    check(await page.$eval('[data-testid=mode-laststand]', (b) => b.disabled), 'Last Petal card disabled on Nightmare');
    check((await text(page, '[data-testid=mode-laststand]'))?.includes('Same as Nightmare'), 'merge text');
    await page.click('[data-testid=diff-normal]');
    await page.click('[data-testid=mode-standard]');

    // campaign card chips
    await go(page, '#/campaign?chapter=6');
    check(!!(await page.$('[data-testid=rule-chip-6-3]')), 'stage card rule chip (6-3)');
    await shot(page, vp, 'campaign-ch6');
    await go(page, '#/stage/6-1?difficulty=normal');
    await shot(page, vp, 'prep-6-1-pads');
  }

  if (only.includes('battle')) {
    log('(3) in battle: mode chip and rule pill');
    await grant(page, '3-4', { '3-3': { normal: true, clears: 1 } });
    await openBattle(page, '#/battle?stage=3-3&difficulty=normal&mode=rush', 'rush');
    check(!!(await page.$('.bt-mode.bt-mode-rush')), 'HUD .bt-mode-rush');
    check(!!(await page.$('[data-testid=rule-pill]')), 'rule pill');
    await shot(page, vp, 'hud-resting');
    await fastForward(page, 14.5, "sim.rule && sim.rule.active");
    await page.waitForTimeout(1200);
    const pillOn = await page.evaluate(() => document.querySelector('[data-testid=rule-pill]')?.classList.contains('on'));
    check(pillOn, 'rule pill ACTIVE on 3-3 after 14 s');
    await shot(page, vp, 'hud-active');
    await page.click('[data-testid=rule-pill]');
    await page.waitForTimeout(400);
    check(!!(await page.$('.bt-rule-pop')), 'popover opens');
    await shot(page, vp, 'hud-popover');
    await page.click('[data-testid=rule-pill]');
  }

  if (only.includes('ambush')) {
    log('(4) 4-2 Rear Ambush in Standard and Reverse Route');
    for (const mode of ['standard', 'reverse']) {
      await grant(page, '4-3', { '4-2': { normal: true, clears: 1 } });
      await openBattle(page, `#/battle?stage=4-2&difficulty=easy&mode=${mode}`, mode);
      const banners = [];
      const scout = [];
      for (let w = 1; w <= 2; w++) {
        scout.push(await page.evaluate(() => document.querySelector('[data-testid=scout-label], .bt-scout-label')?.textContent || ''));
        await page.evaluate(() => {
          const sim = window.__battle.sim;
          sim.startNextWave();
        });
        // the banner shows for about a second: catch it as it appears
        banners.push(await page.waitForFunction((w) => [...document.querySelectorAll('.bt-banner')].map((b) => b.textContent).find((t) => t.includes(`WAVE ${w}`)) || null, w, { timeout: 5000 }).then((x) => x.jsonValue()).catch(() => ''));
        await page.evaluate(() => {
          const sim = window.__battle.sim;
          for (const e of sim.enemies) e.dead = true;
          sim._spawnQueue = [];
          sim.update(0.1);
        });
        await page.waitForTimeout(400);
      }
      check(!/rear ambush/i.test(banners[0]) && /rear ambush/i.test(banners[1]), `${mode}: wave 1 banner without "REAR AMBUSH", wave 2 with it (${JSON.stringify(banners)})`);
      check(!scout[0].includes('⇄') && scout[1].includes('⇄'), `${mode}: scout ⇄ only before the even wave (${JSON.stringify(scout)})`);
      if (mode === 'reverse') await shot(page, vp, 'ambush-reverse-w2');
    }
  }

  if (only.includes('win')) {
    log('(5) a Goblin Rush win → ribbon results, prep "Ribbon ✓", card count');
    await grant(page, '1-2', { '1-1': { normal: true, hard: false, clears: 1 } });
    await openBattle(page, '#/battle?stage=1-1&difficulty=hard&mode=rush', 'rush');
    // a sure win: every enemy falls the step it appears
    for (let k = 0; k < 400; k++) {
      const st = await page.evaluate(() => {
        const sim = window.__battle?.sim;
        if (!sim) return 'gone';
        for (let i = 0; i < 40 && sim.state !== 'won' && sim.state !== 'lost'; i++) {
          if (sim.state === 'prep' || sim.state === 'between') sim.startNextWave();
          sim.update(0.25);
          for (const e of sim.enemies) if (!e.dead) sim._killEnemy(e, null);
        }
        return sim.state;
      });
      if (st !== 'wave' && st !== 'between' && st !== 'prep') break;
      await page.waitForTimeout(20);
    }
    await page.waitForSelector('.res-root, [data-testid=results], .bt-results', { timeout: 30000 }).catch(() => null);
    await page.waitForTimeout(1500);
    const body = await page.evaluate(() => document.body.textContent);
    check(/Goblin Rush ribbon earned!/i.test(body), 'results: "Goblin Rush ribbon earned!"');
    check(/Win in Standard for the Hard medal\./i.test(body), 'results: "Win in Standard for the Hard medal."');
    await shot(page, vp, 'results-ribbon');
    await go(page, '#/stage/1-1?difficulty=hard&mode=rush');
    check((await text(page, '[data-testid=mode-rush]'))?.includes('Ribbon ✓'), 'prep: Rush card "Ribbon ✓"');
    await go(page, '#/campaign?chapter=1');
    check((await text(page, '[data-testid=ribbons-1-1]')) === 'Ribbons 1/20', `stage card "${await text(page, '[data-testid=ribbons-1-1]')}"`);
  }

  if (page.errors.length) log(`  page errors: ${page.errors.slice(0, 5).join(' | ')}`);
  check(!page.errors.some((e) => !/favicon|net::|Failed to load resource|supabase/i.test(e)), 'no page errors');
  await page.context().close();
}

if (only.includes('coop')) {
  const { runCoop } = await import('./codex-modes-coop.mjs').catch(() => ({ runCoop: null }));
  if (runCoop) await runCoop({ browser, base, check, log, shotsDir, grant, go, waitBattle });
  else log('(7) co-op: e2e/codex-modes-coop.mjs not present');
}

await browser.close();
await server.close();
log(`\n${fails ? 'FAILED' : 'OK'}: ${passes} passed, ${fails} failed · screenshots in ${shotsDir}`);
process.exit(fails ? 1 : 0);
