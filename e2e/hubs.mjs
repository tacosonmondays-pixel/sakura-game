// UI M5b: the hubs with host girls (docs/specs/UI_DIRECTION.md §5.10 E1, §6.5; notes/ui-m5/PLAN.md §5 M5b), at 844x390
// (touch) and 1280x720 (mouse), on two saves: the ui-shots save (chapters 1-3: Total Assault still locked) and a late
// veteran (everything open). On the six hosted screens (Missions; Commissions on Daily, Weekly, Codes and its Login
// tab; Bounty; Total Assault; Titan Trials):
//   1. the probe (e2e/probe.mjs) passes: text ≥ 12 / 13 px, ≤ 12 numbers, no "…" on a number, no sideways scroll,
//      a content window ≥ 300 px, ≤ 1 yellow primary, taps ≥ 40 px (the shared top bar aside, §5.3 tabs 44 × 36)
//   2. the host is the right girl, within her width (≤ 35%) or, on the collapse rule, the 96 px bust chip
//   3. her bubble holds one line of ≤ 34 characters (≤ 60, the spec's bound) and covers no tile, list or panel
//   4. a tap on the bubble shows the next line; under Reduce motion the bubble does not animate (with motion: it pops)
//   5. one [data-primary] at most, and it is the yellow one
// Achievements (§6.5): no host; Ready first; Done collapsed; ≤ 12 + 2 visible numbers counted the audit's way
// (currencies and rows included); no "1/1" or "×1"; a row opens its ladder sheet; the category sheet has 12
// categories; the whole list scrolls at most 10 screens. Campaign: a stage card holds ≤ 2 numbers and no waves,
// ribbons, rule or mechanic chips.
//
//   node e2e/hubs.mjs [--viewport 844x390] [--save shots|late] [--shots <dir>]
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 on any failure.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';
import { probe, judge, summary } from './probe.mjs';
import { seedUiSave, SHOT_NOW } from './uiSeed.mjs';
import { veteran } from '../tests/fixtures/veterans.js';
import { SAVE_KEY } from '../src/systems/save.js';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720'];
const saves = opt('save', null) ? [opt('save')] : ['shots', 'late'];
const shots = opt('shots', null);
if (shots) mkdirSync(shots, { recursive: true });

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${msg}`);
  if (!ok) failures++;
  return ok;
};

/** The hosted screens: the route, the host (a unit id, or a function of the page), what her bubble must stay clear of. */
const HOSTED = [
  { name: 'missions', hash: '#/missions', screen: 'missions', host: 'secretary', clear: '.ma-hub-grid', list: '.ma-hub-grid' },
  { name: 'commissions-daily', hash: '#/commissions?tab=daily', screen: 'commissions', host: 'miko', clear: '.cm-panel, .cm-tabs', list: '.cm-panel' },
  { name: 'commissions-weekly', hash: '#/commissions?tab=weekly', screen: 'commissions', host: 'miko', clear: '.cm-panel, .cm-tabs', list: '.cm-panel' },
  { name: 'commissions-codes', hash: '#/commissions?tab=codes', screen: 'commissions', host: 'miko', clear: '.cm-panel, .cm-tabs', list: '.cm-panel' },
  { name: 'commissions-login', hash: '#/commissions?tab=login', screen: 'commissions', host: 'miko', clear: '.cm-panel, .cm-tabs', list: '.cm-panel' },
  { name: 'bounty', hash: '#/bounty', screen: 'bounty', host: 'guest', clear: '.bn-panel', list: '.bn-panel' },
  { name: 'assault', hash: '#/assault', screen: 'assault', host: 'rei', clear: '.as-panel', list: '.as-panel' },
  { name: 'titans', hash: '#/titans', screen: 'titans', host: 'kaede', clear: '.tt-cards, .tt-side, .tt-show, .tt-top', list: '.tt-side' },
];

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium();
console.log(`browser: ${label}; clock: ${SHOT_NOW}`);

const settle = (page, ms = 700) => page.waitForTimeout(ms)
  .then(() => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 200))))));

async function go(page, hash, screen) {
  await page.evaluate((hh) => { location.hash = hh; }, hash);
  await page.waitForFunction((s) => document.querySelector('#app')?.dataset.screen === s, screen, { timeout: 60000 });
  await page.waitForFunction(() => !document.documentElement.dataset.tx && !document.querySelector('.ld-chip.on'), null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
  await settle(page);
}

/** A context on a save: 'shots' (the ui-shots save, seeded after load) or 'late' (a veteran, stored before load). */
async function open(save, vp, motion = 'reduce') {
  const [W, H] = vp.split('x').map(Number);
  const touch = W < 1000;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: motion, deviceScaleFactor: 1, timezoneId: 'America/Chicago' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (page.clock?.setFixedTime) await page.clock.setFixedTime(new Date(SHOT_NOW));
  await page.addInitScript(() => {
    const css = '.toast-host, .jn-toast { display: none !important; }';
    document.addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: css })));
    sessionStorage.setItem('sakura-title-seen', '1');
  });
  if (save === 'late') {
    const p = veteran('late');
    await page.addInitScript(([key, text]) => {
      if (!sessionStorage.getItem('hubs-seeded')) {
        localStorage.clear();
        localStorage.setItem(key, text);
        sessionStorage.setItem('hubs-seeded', '1');
      }
    }, [SAVE_KEY, JSON.stringify(p)]);
  }
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load', timeout: 120000 });
  if (save === 'shots') {
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load', timeout: 120000 });
  }
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 60000 });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 8000 }).catch(() => null);
  if (later) await later.click({ force: true, timeout: 15000 }).catch(() => {});
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
  if (save === 'shots') await seedUiSave(page, true);
  return { ctx, page, errors, touch };
}

/** Who should host `s` on this save (the same rules as src/ui/hosts.js, read from the page's own modules). */
const expectedHost = (page, s) => page.evaluate(async (host) => {
  const { hostFor } = await import('/src/ui/hosts.js');
  const { ARENA_GUEST } = await import('/src/ui/lobby/notice.js');
  const { currentEvent } = await import('/src/systems/missions.js');
  const p = window.__sakura.store.profile;
  if (host === 'secretary') return hostFor('missions', p);
  if (host === 'guest') return hostFor('bounty', p, { guest: ARENA_GUEST[currentEvent().arena] });
  return host;
}, s.host);

/** The host, her bubble and what the bubble covers (any of the `clear` elements). */
const hostInfo = (page, clearSel) => page.evaluate((sel) => {
  const el = document.querySelector('#app [data-testid="host"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const b = el.querySelector('.ui-host-bubble');
  const br = b.getBoundingClientRect();
  const line = el.querySelector('.ui-host-line');
  const bust = el.querySelector('.ui-host-bust').getBoundingClientRect();
  const over = [...document.querySelectorAll(sel)].filter((x) => x.getClientRects().length).filter((x) => {
    const o = x.getBoundingClientRect();
    return Math.min(br.right, o.right) - Math.max(br.left, o.left) > 0.5 && Math.min(br.bottom, o.bottom) - Math.max(br.top, o.top) > 0.5;
  }).map((x) => x.className.split(' ')[0]);
  return {
    id: el.dataset.host, mode: el.dataset.mode, share: r.width / innerWidth, line: line.textContent, boxes: line.getClientRects().length,
    bust: [Math.round(bust.width), Math.round(bust.height)], over, bubble: [Math.round(br.width), Math.round(br.height)],
    anim: getComputedStyle(b).animationName,
  };
}, clearSel);

/** The [data-primary] buttons on screen and whether each is yellow. */
const primaries = (page) => page.evaluate(() => [...document.querySelectorAll('#app [data-primary]')].filter((e) => e.getClientRects().length && !e.disabled).map((e) => ({ text: e.textContent.trim(), yellow: e.classList.contains('btn-yellow') || /255, 2[0-4]\d, \d{1,2}\)/.test(getComputedStyle(e).backgroundImage + getComputedStyle(e).backgroundColor) })));

async function hostedScreen(page, s, vp, save) {
  await go(page, s.hash, s.screen);
  const r = await probe(page, { kind: 'hub', list: s.list, tapSkip: '.topbar' });
  const h1 = await hostInfo(page, s.clear);
  const chip = h1?.mode === 'chip';
  const fails = judge(r, { skip: chip ? ['host', 'bubble'] : ['bubble'] });
  check(fails.length === 0, `${s.name}: probe ${summary(r)}${fails.length ? ` → ${fails.join(' | ')}` : ''}`);
  if (!check(!!h1, `${s.name}: a host girl stands on the screen`)) return;
  const want = await expectedHost(page, s);
  check(h1.id === want, `${s.name}: the host is ${want} (${h1.id})`);
  if (chip) {
    // the collapse rule: only where the content left under the screen's header is under 300 px (Titan Trials on phones)
    const rule = await page.evaluate(async () => (await import('/src/ui/screens/titans.js')).titanHostMode());
    check(s.name === 'titans' && rule === 'chip' && h1.bust[0] === 96 && h1.bust[1] === 96, `${s.name}: the collapse rule's 96 px bust chip (${h1.bust.join('x')}, rule: ${rule})`);
  } else {
    check(h1.share <= 0.355, `${s.name}: she takes ${(h1.share * 100).toFixed(1)}% of the width (≤ 35%)`);
  }
  check(h1.line.length > 0 && h1.line.length <= 34 && h1.boxes === 1, `${s.name}: one line in her bubble, ≤ 34 characters ("${h1.line}", ${h1.line.length}, ${h1.boxes} line box)`);
  check(h1.over.length === 0, `${s.name}: the bubble covers no tile, list or panel${h1.over.length ? ` (over ${h1.over.join(', ')})` : ''}`);
  const pr = await primaries(page);
  check(pr.length <= 1 && pr.every((p) => p.yellow), `${s.name}: one [data-primary], the yellow one (${pr.map((p) => p.text).join(' | ') || 'none here'})`);
  // a tap shows the next line; no bounce under Reduce motion
  await page.click('#app [data-testid="host-bubble"]');
  await page.waitForTimeout(80);
  const h2 = await hostInfo(page, s.clear);
  const many = await page.evaluate(() => document.querySelector('#app [data-testid="host-bubble"]').getAttribute('aria-label').includes('tap for the next line'));
  check(!many || h2.line !== h1.line, `${s.name}: a tap shows the next line ("${h2.line}")`);
  check(h2.anim === 'none', `${s.name}: no bounce under Reduce motion (animation ${h2.anim})`);
  check(h2.boxes === 1 && h2.over.length === 0, `${s.name}: the next line is one line too and stays clear`);
  if (shots) await page.screenshot({ path: join(shots, `${s.name}-${save}-${vp}.png`) });
  if (s.name === 'commissions-login') await loginStamp(page, vp, save);
}

/** Claiming today's login gift stamps the day "complete!", the plate shows the next gift, and Miko says so. */
async function loginStamp(page, vp, save) {
  const btn = await page.$('#app [data-testid="login-claim-btn"]');
  if (!btn) {
    console.log('  (login: today already claimed on this save)');
    return;
  }
  const day = await page.evaluate(async () => {
    const { loginCalendar } = await import('/src/systems/missions.js');
    return loginCalendar(window.__sakura.store.profile).days.find((d) => d.today)?.day;
  });
  await btn.click();
  await page.waitForSelector('.modal-overlay', { timeout: 10000 }).catch(() => null);
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
  await settle(page, 400);
  const after = await page.evaluate((d) => ({
    stamp: document.querySelector(`#app [data-testid="login-stamp-${d}"]`)?.textContent || '',
    chip: !!document.querySelector('#app [data-testid="login-reset"]'),
    claim: !!document.querySelector('#app [data-testid="login-claim-btn"]'),
    line: document.querySelector('#app [data-testid="host"] .ui-host-line')?.textContent || '',
  }), day);
  check(after.stamp === 'complete!' && after.chip && !after.claim, `login: day ${day} wears the "complete!" stamp and the plate shows the next gift (${JSON.stringify(after)})`);
  check(after.line === `Day ${day} stamped. See you tomorrow!`, `login: Miko says the day is stamped ("${after.line}")`);
  if (shots) await page.screenshot({ path: join(shots, `commissions-login-claimed-${save}-${vp}.png`) });
}

/** Numbers counted the audit's way (§6.5): every visible text holding a digit inside the screen, rows and currencies too. */
const auditNumbers = (page) => page.evaluate(() => {
  const els = new Set();
  const w = document.createTreeWalker(document.querySelector('#app'), NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!/\d/.test(n.nodeValue)) continue;
    const el = n.parentElement;
    if (!el || el.closest('[aria-hidden="true"], .ld, .ld-chip')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
    const list = el.closest('.ach-list');
    if (list) {
      const lr = list.getBoundingClientRect();
      if (r.bottom <= lr.top || r.top >= lr.bottom) continue;
    }
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    els.add(el);
  }
  return [...els].map((e) => e.textContent.trim().slice(0, 30));
});

const rowsShown = (nums) => nums.join(' · ');

async function achievements(page, vp, save) {
  await go(page, '#/commissions?tab=achievements', 'commissions');
  await page.waitForSelector('[data-testid="ach-tab"] .ach-row', { timeout: 30000 });
  await settle(page, 400);
  const r = await probe(page, { kind: 'list', list: '.ach-list', tapSkip: '.topbar' });
  const fails = judge(r);
  check(fails.length === 0, `achievements: probe ${summary(r)}${fails.length ? ` → ${fails.join(' | ')}` : ''}`);
  const info = await page.evaluate(() => {
    const list = document.querySelector('.ach-list');
    const heads = [...list.querySelectorAll('.ach-ghead')].map((x) => [...x.classList].find((c) => ['ready', 'progress', 'done'].includes(c)));
    const rows = [...list.querySelectorAll('.ach-row')];
    const texts = rows.map((x) => x.innerText.replace(/\s+/g, ' '));
    const ready = list.querySelectorAll('.ach-row.ready').length;
    return {
      host: !!document.querySelector('#app [data-testid="host"]'),
      heads, rows: rows.length, ready,
      doneShown: list.querySelectorAll('.ach-row.done').length,
      doneHead: !!list.querySelector('[data-testid="ach-completed"]'),
      bad: texts.filter((t) => /×\s?1\b(?![\d,.])|(?<![\d/])1\/1(?![\d])|\b0 ?\/ ?\d/.test(t)),
      screens: Math.round((list.scrollHeight / list.clientHeight) * 10) / 10,
      window: list.clientHeight,
      rowH: Math.round(Math.min(...rows.slice(0, 6).map((x) => x.getBoundingClientRect().height))),
      readyN: Number(list.querySelector('[data-testid="ach-ready-n"]')?.textContent || 0),
    };
  });
  check(!info.host, 'achievements: no host on this tab (the list needs the width, notes Q9)');
  check(info.ready === 0 || info.heads[0] === 'ready', `achievements: Ready comes first (${info.heads.join(' → ')})`);
  check(info.ready === 0 || info.readyN === info.ready, `achievements: the Ready header counts its rows (${info.readyN} for ${info.ready})`);
  check(!info.doneHead || info.doneShown === 0, `achievements: Done is collapsed (${info.doneShown} done rows shown)`);
  check(info.bad.length === 0, `achievements: no "1/1", "×1" or "0/n" on a row${info.bad.length ? ` (${info.bad.slice(0, 3).join(' | ')})` : ''}`);
  check(info.rowH >= 56, `achievements: rows are about 60 px (${info.rowH})`);
  // (the target is for the ui-shots save, §6.5; an update-day veteran has dozens ready at once: reported only)
  if (save === 'shots') check(info.screens <= 10, `achievements: the whole list scrolls ${info.screens} screens (≤ 10; window ${info.window} px)`);
  else console.log(`  info achievements: the whole list scrolls ${info.screens} screens with ${info.ready} ready (window ${info.window} px)`);
  // (P3 budgets are counted at 844x390; a taller desktop window shows more rows, each within its row budget)
  const nums = await auditNumbers(page);
  if (vp === '844x390') check(nums.length <= 14, `achievements: ${nums.length} visible numbers counted the audit's way (about 12; ${nums.join(' · ')})`);
  else console.log(`  info achievements: ${nums.length} visible numbers at ${vp} (${rowsShown(nums)})`);
  if (shots) await page.screenshot({ path: join(shots, `achievements-${save}-${vp}.png`) });
  // the category sheet: All + 11
  await page.click('[data-testid="ach-category"]');
  await page.waitForSelector('[data-testid="ach-cat-sheet"]', { timeout: 10000 });
  await settle(page, 300);
  const cats = await page.$$eval('[data-testid^="ach-cat-"]:not([data-testid="ach-cat-sheet"]):not([data-testid="ach-cat-sheet-close"])', (els) => els.map((e) => e.dataset.testid));
  check(cats.length === 12 && cats.includes('ach-cat-codex') && cats.includes('ach-cat-secret'), `achievements: the category sheet lists 12 categories (${cats.length})`);
  if (shots) await page.screenshot({ path: join(shots, `achievements-categories-${save}-${vp}.png`) });
  await page.click('[data-testid="ach-cat-all"]');
  await settle(page, 300);
  // a row opens its ladder sheet
  await page.click('.ach-list .ach-row .ach-title');
  const sheet = await page.waitForSelector('[data-testid="ach-ladder-sheet"]', { timeout: 10000 }).catch(() => null);
  if (check(!!sheet, 'achievements: a row opens its ladder sheet')) {
    await settle(page, 300);
    const steps = await page.$$eval('[data-testid="ach-ladder-sheet"] .ach-ls-step', (els) => els.length);
    check(steps >= 1, `achievements: the sheet lists the tiers (${steps})`);
    if (shots) await page.screenshot({ path: join(shots, `achievements-ladder-${save}-${vp}.png`) });
    await page.click('[data-testid="ach-ladder-sheet-close"]');
    await settle(page, 300);
  }
}

async function campaign(page, vp, save) {
  await go(page, '#/campaign?chapter=1', 'campaign');
  const r = await probe(page, { kind: 'hub', tapSkip: '.topbar' });
  const fails = judge(r, { skip: ['overflow'] }); // (the chapter tab rail scrolls sideways: its own design, flagged)
  check(fails.length === 0, `campaign: probe ${summary(r)}${fails.length ? ` → ${fails.join(' | ')}` : ''}`);
  const cards = await page.evaluate(() => [...document.querySelectorAll('.ma-stage-card')].map((c) => {
    const nums = new Set();
    const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (/\d/.test(n.nodeValue)) nums.add(n.parentElement);
    return { id: c.dataset.testid, nums: nums.size, extra: !!c.querySelector('.ma-sc-mech, .ma-sc-rule, .ma-sc-ribbons') || /\bwaves\b/.test(c.innerText) };
  }));
  check(cards.length > 0 && cards.every((c) => c.nums <= 2), `campaign: every stage card holds ≤ 2 numbers (${cards.map((c) => c.nums).join(' ')})`);
  check(cards.every((c) => !c.extra), 'campaign: no waves, ribbons, rule or mechanic chips on the cards');
  if (shots) await page.screenshot({ path: join(shots, `campaign-${save}-${vp}.png`) });
}

try {
  for (const vp of viewports) {
    for (const save of saves) {
      console.log(`\n=== ${vp} · ${save} save ===`);
      let opened;
      try {
        opened = await open(save, vp);
      } catch (e) {
        check(false, `${vp} ${save}: the game opens (${e.message.split('\n')[0]})`);
        continue;
      }
      const { ctx, page, errors } = opened;
      for (const s of HOSTED) {
        try {
          await hostedScreen(page, s, vp, save);
        } catch (e) {
          check(false, `${s.name}: ${e.message.split('\n')[0]}`);
        }
      }
      try {
        await achievements(page, vp, save);
      } catch (e) {
        check(false, `achievements: ${e.message.split('\n')[0]}`);
      }
      try {
        await campaign(page, vp, save);
      } catch (e) {
        check(false, `campaign: ${e.message.split('\n')[0]}`);
      }
      check(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
      await ctx.close();
    }
    // with motion on, a new line pops
    const { ctx, page } = await open('shots', vp, 'no-preference');
    await go(page, '#/missions', 'missions');
    await page.click('#app [data-testid="host-bubble"]');
    await page.waitForTimeout(30);
    const anim = await page.evaluate(() => getComputedStyle(document.querySelector('#app [data-testid="host-bubble"]')).animationName);
    check(anim === 'ui-bubble-pop', `${vp}: with motion on, the next line pops (${anim})`);
    await ctx.close();
  }
} catch (e) {
  failures++;
  console.log(`  FAIL ${e.stack || e.message}`);
} finally {
  await browser.close();
  await server.close();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall hub checks passed');
process.exit(failures ? 1 : 0);
