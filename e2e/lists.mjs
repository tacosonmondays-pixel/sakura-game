// UI M5c: the left-rail list screens (docs/specs/UI_DIRECTION.md §5.5, §5.9, §5.10 E1-E3, E6, E9; notes/ui-m5/PLAN.md
// §5 M5c) on the ui-shots save (chapters 1-3 cleared) at 844x390 and 1280x720, on a fixed clock (e2e/uiSeed.mjs):
//   - the rail on the Mailroom, the Mall, Happening Now and Settings: the active tab an ink slab with yellow italic
//     words, the others white glass with ink words, every tab ≥ 44 px tall, tab-<id> test ids, red dots only, no
//     counts on tabs
//   - the probe (e2e/probe.mjs) on every screen and section: text ≥ 12 / 13 px, ≤ 12 numbers, no "…" on a number, no
//     sideways scroll, a content window ≥ 300 px, ≤ 1 yellow, taps ≥ 40 px (the shared top bar aside), the host within
//     her share and her bubble clear of the list; the host is the right girl (Hotaru, Midori, Suzu) on the right
//   - the Mailroom: the lobby's Mail button, the Menu's Mail and Esc; the rows in order; the expiry chip red under
//     24 h (and turning red as the clock moves: a clock override); claim one, Claim all (the one yellow, gone once
//     nothing waits); a tap reads a letter; History; the designed empty state; mail-close goes back
//   - the Mall: every buy is a cost button (no yellow price pill), each balance once (coins and gems only in the top
//     bar, a token shop's wallet once), the restock chip in the plate header, a buy still works, "i" opens a bottom
//     sheet, the wallet chip's Total Assault arrows back to the shop
//   - Happening Now: the rows and their Go (no "In Progress" sticker on a row; Bounty and Titan Trials arrow back
//     here), Coming Up, Free pulls (the "?" sheet and MORE), nothing sells here; every door that promises free pulls
//     (the lobby card, the Notice, Recruit's "Not enough gems") opens Free pulls; on the events' dev clock: the
//     off-season band (E9) on Happening Now and on the event page's ended and upcoming phases
//   - Settings: every section reachable from the rail (and the lit tab follows), a deep link, the Menu's Account,
//     descriptions behind "i" (in view on a row without a control)
//   - Recruit: the pity shows once
//   - portrait 390x844 (UI M5 merge review): the Mailroom (a long title wraps clear of its row's controls, the bundle's
//     words inside the letter, the plate title clear of Claim all), a letter read, History, the Mall, Happening Now,
//     Free pulls and Settings, each probed with the clip check too (text cut off by a box or run under a neighbour)
//
//   node e2e/lists.mjs [--viewport 844x390|1280x720|390x844] [--shots <dir>]
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 on any failure.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';
import { probe, judge, summary } from './probe.mjs';
import { seedUiSave, SHOT_NOW } from './uiSeed.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720', '390x844'];
const shots = opt('shots', null);
if (shots) mkdirSync(shots, { recursive: true });

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${msg}`);
  if (!ok) failures++;
  return ok;
};

const H = 3600e3;
const NOW = Date.parse(SHOT_NOW);
const PLATE = 'rgb(14, 25, 48)';
const YELLOW = 'rgb(255, 221, 74)';
const INK = 'rgb(31, 42, 68)';
const BAD_ON_PLATE = 'rgb(255, 128, 149)';

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium();
console.log(`browser: ${label}; clock: ${SHOT_NOW}`);

const settle = (page, ms = 600) => page.waitForTimeout(ms)
  .then(() => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 150))))));
const closeModals = (page) => page.evaluate(() => document.querySelectorAll('.modal-overlay, .ui-layer').forEach((o) => o.remove()));
const screenIs = (page, s) => page.evaluate((x) => document.querySelector('#app')?.dataset.screen === x, s);
const waitScreen = (page, s) => page.waitForFunction((x) => document.querySelector('#app')?.dataset.screen === x, s, { timeout: 60000 })
  .then(() => page.waitForFunction(() => !document.documentElement.dataset.tx && !document.querySelector('.ld-chip.on'), null, { timeout: 60000 }).catch(() => {}))
  .then(() => settle(page));

async function go(page, hash, s) {
  await page.evaluate((hh) => { location.hash = hh; }, hash);
  await waitScreen(page, s);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
}

async function shot(page, name, vp) {
  if (shots) await page.screenshot({ path: join(shots, `${name}-${vp}.png`) });
}

/** The letters the Mailroom checks use (delivered at the fixed clock). */
async function seedMail(page) {
  await page.evaluate(async (now) => {
    const { deliverMail } = await import('/src/systems/mail.js');
    const p = window.__sakura.store.profile;
    deliverMail(p, { id: 'm5c-later', from: 'Sakura Academy', title: 'A gift for later', body: 'This one keeps for a while yet, but not forever.', rewards: [{ id: 'coins', count: 1000 }], expiresAt: now + 30 * 3600e3 }, now - 2 * 3600e3);
    deliverMail(p, { id: 'm5c-soon', from: 'Hikari', title: 'Hurry, Sensei!', body: 'This little gift expires today, so do not wait too long to open it, okay?', rewards: [{ id: 'gems', count: 50 }], expiresAt: now + 5 * 3600e3 }, now - 3600e3);
    deliverMail(p, { id: 'm5c-notice', from: 'Sakura Academy Staff', title: 'A notice', body: 'A notice with no gift: it is news for a week, then it files itself under History.', rewards: [] }, now);
    window.__sakura.store.commit('mail');
    window.__sakura.store.saveNow?.();
  }, NOW);
}

async function open(vp) {
  const [W, Ht] = vp.split('x').map(Number);
  const touch = W < 1000;
  const ctx = await browser.newContext({ viewport: { width: W, height: Ht }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce', deviceScaleFactor: 1, timezoneId: 'America/Chicago' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (page.clock?.setFixedTime) await page.clock.setFixedTime(new Date(SHOT_NOW));
  await page.addInitScript(() => {
    const css = '.toast-host, .jn-toast { display: none !important; }';
    document.addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: css })));
    sessionStorage.setItem('sakura-title-seen', '1');
  });
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load', timeout: 120000 });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 60000 });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 8000 }).catch(() => null);
  if (later) await later.click({ force: true, timeout: 15000 }).catch(() => {});
  await closeModals(page);
  await seedUiSave(page, true);
  // the game's own Reduce motion (smooth scrolls, the rail's jump): as a player who turned it on
  await page.evaluate(() => { window.__sakura.store.profile.settings.reduceMotion = true; window.__sakura.store.commit('settings'); });
  await seedMail(page);
  return { ctx, page, errors, touch };
}

/** The rail's tabs as drawn. */
const railInfo = (page) => page.evaluate(() => [...document.querySelectorAll('#app .ls-rail .ui-stab')].map((b) => {
  const cs = getComputedStyle(b);
  const word = b.querySelector('.ui-stab-in');
  const r = b.getBoundingClientRect();
  return {
    id: b.dataset.testid, on: b.classList.contains('on'), selected: b.getAttribute('aria-selected') === 'true', bg: cs.backgroundColor, color: getComputedStyle(word).color,
    italic: getComputedStyle(word).fontStyle === 'italic', h: Math.round(r.height), w: Math.round(r.width), text: b.textContent.trim(),
    dots: b.querySelectorAll('.ui-bdg.dot').length, others: b.querySelectorAll('.ui-bdg:not(.dot), .ui-dot, .tab-badge, .icon-btn-badge').length,
  };
}));

/** The rail: the right tabs, the active and inactive looks, ≥ 44 px, red dots only, never a count. */
async function checkRail(page, name, ids, active) {
  const rail = await railInfo(page);
  check(rail.map((t) => t.id).join() === ids.map((i) => `tab-${i}`).join(), `${name}: the rail holds ${ids.join(' · ')} (test ids tab-<id>)`);
  const on = rail.find((t) => t.on);
  check(!!on && on.id === `tab-${active}` && on.selected, `${name}: ${active} is the lit tab (aria-selected)`);
  if (on) check(on.bg === PLATE && on.color === YELLOW && on.italic, `${name}: the lit tab is an ink slab with yellow italic words (${on.bg}, ${on.color})`);
  const off = rail.filter((t) => !t.on);
  check(off.every((t) => t.bg.startsWith('rgba(255, 255, 255') && t.color === INK), `${name}: the other tabs are white glass with ink words (${[...new Set(off.map((t) => `${t.bg} / ${t.color}`))].join(', ')})`);
  check(rail.every((t) => t.h >= 44), `${name}: every tab is at least 44 px tall (${rail.map((t) => t.h).join(', ')})`);
  check(rail.every((t) => !/\d/.test(t.text) && t.others === 0), `${name}: red dots only on the tabs, never a count (${rail.map((t) => `${t.text}${t.dots ? '•' : ''}`).join(', ')})`);
  return rail;
}

/** The probe on a list screen: every limit, the shared top bar aside; her bubble clear of the list panel. */
async function probeScreen(page, name, { host = true } = {}) {
  const r = await probe(page, { kind: 'list', list: '.ls-panel:not(.bare), .ls-list', tapSkip: '.topbar' });
  const fails = judge(r, { skip: host ? [] : ['host', 'bubble'] });
  check(fails.length === 0, `${name}: probe ${summary(r)}${fails.length ? ` → ${fails.join(' | ')}` : ''}`);
  return r;
}

/** The host: who she is, her mode by the collapse rule, on the right of the list, one line ≤ 24 characters. */
async function checkHost(page, name, want) {
  const h1 = await page.evaluate(async () => {
    const el = document.querySelector('#app [data-testid="host"]');
    if (!el) return null;
    const { listMode, viewport } = await import('/src/ui/hubHost.js');
    const r = el.getBoundingClientRect();
    const panel = document.querySelector('#app .ls-panel')?.getBoundingClientRect();
    const b = el.querySelector('.ui-host-bubble').getBoundingClientRect();
    const line = el.querySelector('.ui-host-line');
    return {
      id: el.dataset.host, mode: el.dataset.mode, rule: listMode(viewport()), share: r.width / innerWidth, right: r.right >= innerWidth - 2,
      clear: !panel || r.left >= panel.right - 1 || el.dataset.mode === 'chip', bubbleIn: b.left >= r.left - 1 && b.right <= r.right + 1,
      line: line.textContent, boxes: line.getClientRects().length,
    };
  });
  if (!check(!!h1, `${name}: a host girl is on the screen`)) return;
  check(h1.id === want, `${name}: the host is ${want} (${h1.id})`);
  check(h1.mode === h1.rule, `${name}: her mode is the collapse rule's (${h1.mode})`);
  if (h1.mode === 'stand') {
    check(h1.right && h1.clear && h1.bubbleIn, `${name}: she stands on the right, beside the list, her bubble inside her column`);
    check(h1.share <= 0.305, `${name}: she takes ${(h1.share * 100).toFixed(1)}% of the width (list screens: 26% / 30%)`);
  }
  check(h1.line.length > 0 && h1.line.length <= 24 && h1.boxes === 1, `${name}: one line in her bubble, ≤ 24 characters ("${h1.line}")`);
}

// ---------------------------------------------------------------------------------------------------------------
// The Mailroom
// ---------------------------------------------------------------------------------------------------------------
async function mailroom(page, vp, touch) {
  console.log(`-- Mailroom ${vp}`);
  await go(page, '#/lobby', 'lobby');
  await page.click('[data-testid="top-mail"]');
  await waitScreen(page, 'mail');
  check(await page.evaluate(() => location.hash.startsWith('#/mail')), `the lobby's Mail button opens the Mailroom (${await page.evaluate(() => location.hash)})`);
  await checkRail(page, 'mail', ['unclaimed', 'history'], 'unclaimed');
  const rail = await railInfo(page);
  check(rail[0].dots === 1 && rail[1].dots === 0, 'mail: a red dot on Unclaimed while a gift waits, none on History');
  await checkHost(page, 'mail', 'hotaru');
  const rows = await page.evaluate(() => [...document.querySelectorAll('#app .mbx-list > .mbx-letter')].map((r) => [r.dataset.testid, r.classList.contains('k-gift')]));
  const firstNotice = rows.findIndex(([, gift]) => !gift);
  check(rows[0]?.[0] === 'mail-m5c-soon' && rows[1]?.[0] === 'mail-m5c-later' && rows.some(([id]) => id === 'mail-m5c-notice') && (firstNotice < 0 || rows.slice(firstNotice).every(([, gift]) => !gift)),
    `mail: the gift that expires soonest first, then the next; notices after every gift (${rows.map(([id]) => id).join(', ')})`);
  const chips = await page.evaluate(() => ['m5c-soon', 'm5c-later'].map((id) => {
    const c = document.querySelector(`#app [data-testid="mail-expiry-${id}"]`);
    return c ? { urgent: c.classList.contains('urgent'), color: getComputedStyle(c.querySelector('.ui-cd-time')).color, text: c.textContent } : null;
  }));
  check(chips[0]?.urgent && chips[0].color === BAD_ON_PLATE, `mail: the expiry chip is red under 24 h ("${chips[0]?.text}", ${chips[0]?.color})`);
  check(chips[1] && !chips[1].urgent, `mail: a gift with 30 h left keeps a white chip ("${chips[1]?.text}")`);
  const head = await page.evaluate(() => {
    const b = document.querySelector('#app .ui-plate-head [data-testid="mail-claim-all"]');
    return {
      claimAll: !!b, primary: b?.hasAttribute('data-primary'), count: b?.querySelector('.ui-btn-n')?.textContent, gifts: document.querySelectorAll('#app .mbx-letter.k-gift').length,
      inks: [...document.querySelectorAll('#app .mbx-letter.k-gift [data-testid^="mail-claim-"]')].every((x) => x.classList.contains('ui-cost') && x.classList.contains('ui-ink')),
    };
  });
  check(head.claimAll && head.primary && Number(head.count) === head.gifts && head.gifts >= 3, `mail: Claim all is the one yellow, in the plate header, with its count (${head.count} = the gift rows)`);
  check(head.inks, 'mail: every row\'s Claim is the ink row button');
  await probeScreen(page, 'mail unclaimed');
  await shot(page, 'mail', vp);

  // a tap reads the whole letter (and who sent it, and when)
  await page.click('#app [data-testid="mail-m5c-soon"] .mbx-read');
  const read = await page.evaluate(() => {
    const b = document.querySelector('#app [data-testid="mail-m5c-soon"] .mbx-letter-body');
    const f = document.querySelector('#app [data-testid="mail-m5c-soon"] .mbx-from');
    return { open: b.classList.contains('open'), whole: b.scrollWidth <= b.clientWidth + 1 && b.scrollHeight <= b.clientHeight + 1, from: f.getClientRects().length > 0 ? f.textContent : '' };
  });
  check(read.open && read.whole && /^From Hikari/.test(read.from), `mail: a tap reads the whole letter ("${read.from}")`);

  // the clock moves 7 h: the 30 h gift now has 23 h left, and its chip turns red
  await page.clock.setFixedTime(new Date(NOW + 7 * H));
  await go(page, '#/lobby', 'lobby');
  await go(page, '#/mail', 'mail');
  const later = await page.evaluate(() => document.querySelector('#app [data-testid="mail-expiry-m5c-later"]')?.classList.contains('urgent'));
  check(later === true, 'mail: 7 h later the other gift has 23 h left and its chip turned red (clock override)');
  await page.clock.setFixedTime(new Date(SHOT_NOW));
  await go(page, '#/lobby', 'lobby');
  await go(page, '#/mail', 'mail');

  // claim one (other letters may have arrived on their own meanwhile: the story's welcome gift, the event's daily gift)
  const n0 = Number(await page.evaluate(() => document.querySelector('#app [data-testid="mail-claim-all"] .ui-btn-n')?.textContent));
  const coins0 = await page.evaluate(() => window.__sakura.store.profile.currencies.coins);
  await page.click('#app [data-testid="mail-claim-m5c-later"]');
  await settle(page, 300);
  const one = await page.evaluate(() => ({
    coins: window.__sakura.store.profile.currencies.coins, row: !!document.querySelector('#app [data-testid="mail-m5c-later"]'),
    count: document.querySelector('#app [data-testid="mail-claim-all"] .ui-btn-n')?.textContent,
  }));
  check(one.coins === coins0 + 1000 && !one.row && Number(one.count) === n0 - 1, `mail: claim one pays (+${one.coins - coins0} coins), the row leaves Unclaimed, Claim all counts one less (${n0} → ${one.count})`);
  // Claim all
  const gems0 = await page.evaluate(() => window.__sakura.store.profile.currencies.gems);
  await page.click('#app [data-testid="mail-claim-all"]');
  await settle(page, 500);
  await closeModals(page); // (the beta gift's SSR Select Ticket asks to pick a girl)
  const all = await page.evaluate(async () => {
    const { mailList } = await import('/src/systems/mail.js');
    return {
      left: mailList(window.__sakura.store.profile).filter((l) => l.claimable).length, gems: window.__sakura.store.profile.currencies.gems,
      claimAll: !!document.querySelector('#app [data-testid="mail-claim-all"]'), rows: [...document.querySelectorAll('#app .mbx-list > .mbx-letter')].map((r) => r.dataset.testid),
      notices: [...document.querySelectorAll('#app .mbx-list > .mbx-letter')].every((r) => r.classList.contains('k-notice') && r.querySelector('.mbx-tag')?.textContent === 'Notice'),
      dot: document.querySelectorAll('#app .ls-rail [data-testid="tab-unclaimed"] .ui-bdg.dot').length, line: document.querySelector('#app .ui-host-line')?.textContent,
    };
  });
  check(all.left === 0 && all.gems > gems0 && !all.claimAll, `mail: Claim all claims every gift and is gone once nothing waits (+${all.gems - gems0} gems)`);
  check(all.rows.includes('mail-m5c-notice') && all.notices && all.dot === 0, `mail: Unclaimed keeps this week's notices only (no Claim on them), the red dot is gone (${all.rows.join(', ')})`);
  check(all.line === 'All caught up, Sensei!', `mail: Hotaru says "${all.line}"`);
  // History
  await page.click('#app [data-testid="tab-history"]');
  await settle(page, 300);
  const hist = await page.evaluate(() => ({
    hash: location.hash, rows: [...document.querySelectorAll('#app .mbx-list > .mbx-letter')].map((r) => [r.dataset.testid, r.querySelector('.mbx-tag')?.textContent]),
  }));
  check(hist.hash.includes('tab=history') && hist.rows.length >= 3 && hist.rows.every(([, t]) => t === 'Claimed'), `mail: History lists the claimed letters newest first (${hist.rows.map(([id]) => id).join(', ')})`);
  await checkRail(page, 'mail history', ['unclaimed', 'history'], 'history');
  await probeScreen(page, 'mail history');
  await shot(page, 'mail-history', vp);
  // mail-close: back where it was opened
  await page.click('#app [data-testid="mail-close"]');
  await waitScreen(page, 'lobby');
  check(await screenIs(page, 'lobby'), 'mail: mail-close (the arrow) goes back to the lobby');
  // the Menu's Mail, and Esc on desktop
  await page.click('[data-testid="top-menu"]');
  await page.click('[data-testid="menu-mail"]');
  await waitScreen(page, 'mail');
  check(await screenIs(page, 'mail'), 'mail: the Menu\'s Mail opens the Mailroom');
  if (!touch) {
    await page.keyboard.press('Escape');
    await waitScreen(page, 'lobby');
    check(await screenIs(page, 'lobby'), 'mail: Esc goes back (E8)');
  }
  // the designed empty state
  await page.evaluate(() => { window.__sakura.store.profile.mail.letters = []; window.__sakura.store.commit('mail'); });
  await go(page, '#/mail?tab=unclaimed', 'mail');
  const empty = await page.evaluate(() => ({ el: !!document.querySelector('#app [data-testid="mail-empty"]'), text: document.querySelector('#app [data-testid="mail-empty"]')?.textContent || '', claimAll: !!document.querySelector('#app [data-testid="mail-claim-all"]') }));
  check(empty.el && /All caught up!/.test(empty.text) && !empty.claimAll, `mail: an empty Unclaimed is the designed state ("${empty.text.slice(0, 40)}")`);
  await probeScreen(page, 'mail empty');
  await shot(page, 'mail-empty', vp);
}

// ---------------------------------------------------------------------------------------------------------------
// The Mall
// ---------------------------------------------------------------------------------------------------------------
async function mall(page, vp) {
  console.log(`-- Mall ${vp}`);
  await go(page, '#/mall?tab=general', 'mall');
  await checkRail(page, 'mall', ['general', 'gems', 'recruit', 'boss', 'bounty', 'memento'], 'general');
  await checkHost(page, 'mall', 'midori');
  const general = await page.evaluate(() => {
    const coins = window.__sakura.store.profile.currencies.coins.toLocaleString('en-US');
    const own = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join('').trim();
    const shown = [...document.querySelectorAll('#app *')].filter((e) => e.getClientRects().length && own(e) === coins);
    const buys = [...document.querySelectorAll('#app [data-testid^="buy-"]')];
    return {
      coinsIn: shown.map((e) => (e.closest('.topbar') ? 'bar' : e.className)), wallet: !!document.querySelector('#app [data-testid="mall-wallet"]'),
      buys: buys.length, cost: buys.every((b) => b.classList.contains('ui-cost')), pills: document.querySelectorAll('#app .ma-offer-buy').length,
      restock: !!document.querySelector('#app .ui-plate-head [data-testid="mall-restock"]'), title: document.querySelector('#app .ls-panel .ui-plate-title')?.textContent,
    };
  });
  check(general.coinsIn.join() === 'bar' && !general.wallet, `mall: the coin balance shows once, in the top bar (${general.coinsIn.join(', ')}); the coin shop has no wallet chip`);
  check(general.buys > 5 && general.cost && general.pills === 0, `mall: every buy is a cost button (${general.buys}), no yellow price pill left`);
  check(general.restock && general.title === 'General', `mall: the plate header holds the shop's name and its restock chip ("${general.title}")`);
  await probeScreen(page, 'mall general');
  await shot(page, 'mall-general', vp);
  // a buy with the cost button
  const before = await page.evaluate(() => ({ coins: window.__sakura.store.profile.currencies.coins, books: window.__sakura.store.profile.items.book_common || 0 }));
  await page.click('#app [data-testid="buy-gen_book_common"]');
  await page.click('[data-testid="buy-confirm"]', { timeout: 5000 });
  await settle(page, 400);
  await closeModals(page);
  const after = await page.evaluate(() => ({ coins: window.__sakura.store.profile.currencies.coins, books: window.__sakura.store.profile.items.book_common || 0 }));
  check(after.coins < before.coins && after.books > before.books, `mall: a buy with the cost button pays and delivers (${before.coins - after.coins} coins, +${after.books - before.books} books)`);
  // the Boss Exchange: its wallet once, in the plate header
  await page.click('#app [data-testid="tab-boss"]');
  await settle(page, 400);
  const boss = await page.evaluate(async () => {
    const { itemCount } = await import('/src/systems/inventory.js');
    const n = itemCount(window.__sakura.store.profile, 'token_boss').toLocaleString('en-US');
    const wallets = [...document.querySelectorAll('#app [data-testid="mall-wallet"]')];
    return { hash: location.hash, wallets: wallets.length, inHead: !!wallets[0]?.closest('.ui-plate-head'), value: wallets[0]?.textContent.trim(), want: n, balances: document.querySelectorAll('#app .ma-balance').length };
  });
  check(boss.hash === '#/mall?tab=boss', `mall: the rail's Boss tab opens the Boss Exchange (${boss.hash})`);
  check(boss.wallets === 1 && boss.inHead && boss.value === boss.want && boss.balances === 0, `mall: the Assault Token wallet shows once, in the plate header (${boss.value})`);
  await checkRail(page, 'mall boss', ['general', 'gems', 'recruit', 'boss', 'bounty', 'memento'], 'boss');
  await probeScreen(page, 'mall boss');
  await shot(page, 'mall-boss', vp);
  // the shop's sentence behind "i": a bottom sheet (P1), never a toast over the header
  await page.click('#app [data-testid="mall-info"]');
  const sheet = await page.waitForSelector('[data-testid="mall-info-sheet"]', { timeout: 5000 }).catch(() => null);
  const info = sheet ? await page.evaluate(() => ({ title: document.querySelector('[data-testid="mall-info-sheet"] .ui-title')?.textContent, text: document.querySelector('[data-testid="mall-info-sheet"] .ui-body')?.textContent.trim() })) : null;
  check(!!info && info.title === 'Boss Exchange' && info.text.length > 10, `mall: "i" opens the shop's sentence in a bottom sheet ("${info?.title}": "${info?.text}")`);
  if (sheet) {
    const r = await probe(page, { kind: 'detail', root: '[data-testid="mall-info-sheet"]' });
    check(r.minText >= r.floor, `mall: the "i" sheet passes the text floor (${r.minText} px)`);
    await page.click('[data-testid="mall-info-sheet-close"]');
    await settle(page, 300);
  }
  // the token wallet goes where the tokens are earned (Total Assault), and the arrow comes back to this shop
  await page.click('#app [data-testid="mall-wallet"]');
  await waitScreen(page, 'assault');
  await page.click('#app .topbar [data-testid="back"]');
  await waitScreen(page, 'mall');
  check(await page.evaluate(() => location.hash) === '#/mall?tab=boss', `mall: back from the wallet's Total Assault lands on the Boss Exchange (${await page.evaluate(() => location.hash)})`);
}

// ---------------------------------------------------------------------------------------------------------------
// The doors that promise free pulls open Happening Now on Free pulls
// ---------------------------------------------------------------------------------------------------------------
async function freeDoors(page, vp) {
  console.log(`-- Free pulls doors ${vp}`);
  const landed = () => page.evaluate(() => [location.hash, document.querySelector('#app .ls-rail .ui-stab.on')?.dataset.testid, !!document.querySelector('#app [data-testid="happening-free"]')]);
  const isFree = (l) => l[0] === '#/rewards?tab=free' && l[1] === 'tab-free' && l[2];
  await go(page, '#/lobby', 'lobby');
  await page.evaluate(() => document.querySelector('#app [data-testid="banner-f2p"]').click()); // (a carousel slide)
  await waitScreen(page, 'rewards');
  let l = await landed();
  check(isFree(l), `doors: the lobby's "Free pulls" card opens Happening Now on Free pulls (${l.join(', ')})`);
  await shot(page, 'door-lobby-f2p', vp);
  await go(page, '#/lobby', 'lobby');
  await page.click('[data-testid="shortcut-notice"]');
  await page.click('.lb-notice-modal [data-testid="notice-f2p"]');
  await page.click('.lb-notice-modal:not(.closing) .lb-notice-cta button');
  await waitScreen(page, 'rewards');
  l = await landed();
  check(isFree(l), `doors: the Notice's "See the overview" opens Free pulls (${l.join(', ')})`);
  await closeModals(page);
  // Recruit with no gems and no tickets: "Not enough gems" → "Income overview"
  const keep = await page.evaluate(() => {
    const p = window.__sakura.store.profile;
    const k = { gems: p.currencies.gems, t1: p.items?.ticket_recruit || 0, t10: p.items?.ticket_recruit10 || 0 };
    p.currencies.gems = 0;
    p.items.ticket_recruit = 0;
    p.items.ticket_recruit10 = 0;
    window.__sakura.store.commit('pull');
    return k;
  });
  await go(page, '#/recruit', 'recruit');
  await page.click('#app [data-testid="pull-1"]');
  await page.waitForSelector('.modal-overlay:not(.closing)', { timeout: 5000 });
  const said = await page.evaluate(() => document.querySelector('.modal-overlay:not(.closing) p')?.textContent || '');
  check(/Happening\sNow › Free\spulls/.test(said) && !/Events page/.test(said), `doors: "Not enough gems" names Happening Now › Free pulls ("${said.slice(-70)}")`);
  await page.click('.modal-overlay:not(.closing) button:has-text("Income overview")');
  await waitScreen(page, 'rewards');
  l = await landed();
  check(isFree(l), `doors: Recruit's "Income overview" opens Free pulls (${l.join(', ')})`);
  await closeModals(page);
  await page.evaluate((k) => {
    const p = window.__sakura.store.profile;
    p.currencies.gems = k.gems;
    p.items.ticket_recruit = k.t1;
    p.items.ticket_recruit10 = k.t10;
    window.__sakura.store.commit('pull');
  }, keep);
  // a closed event's page points at Happening Now by its name
  await go(page, '#/event/no-such-event', 'event');
  const btn = await page.evaluate(() => document.querySelector('#app .empty button')?.textContent.trim());
  check(btn === 'Happening Now', `doors: a closed event's page has a "Happening Now" button ("${btn}")`);
}

// ---------------------------------------------------------------------------------------------------------------
// Happening Now
// ---------------------------------------------------------------------------------------------------------------
async function happening(page, vp) {
  console.log(`-- Happening Now ${vp}`);
  await go(page, '#/rewards', 'rewards');
  const title = await page.evaluate(() => document.querySelector('#app .topbar-title')?.textContent);
  check(title === 'Happening Now', `happening: the route #/rewards is titled "${title}"`);
  await checkRail(page, 'happening', ['now', 'soon', 'free'], 'now');
  await checkHost(page, 'happening', 'suzu');
  const now = await page.evaluate(() => [...document.querySelectorAll('#app .hn-row')].map((r) => ({
    id: r.dataset.testid, title: r.querySelector('.hn-title')?.textContent, chip: !!r.querySelector('.ui-cd'), go: !!r.querySelector('.ui-cost.ui-ink'), locked: r.classList.contains('locked'),
    inprog: !!r.querySelector('.ui-bdg.inprog'), icon: !!r.querySelector('.hn-ico'), line: !!r.querySelector('.hn-line, .hn-lock'),
  })));
  check(now.length >= 3 && now[0].id === 'hn-row-halloween-2026' && now[0].chip && now[0].go, `happening: the running event first, with its chip and Go (${now.map((r) => r.title).join(' · ')})`);
  check(now.every((r) => !r.inprog), 'happening: no "In Progress" sticker on a row (the tab and the plate header say it once)');
  check(now.every((r) => r.icon && r.line && (r.locked ? !r.go : true)), 'happening: every row has its icon tile, title and one line; a locked row says why and has no Go');
  check(await page.evaluate(() => !document.querySelector('#app .hn-screen .ui-cost:not(.ui-ink), #app [data-testid^="buy-"]')), 'happening: nothing sells here');
  await probeScreen(page, 'happening now');
  await shot(page, 'happening', vp);
  // Go: the event page, and back
  await page.click('#app [data-testid="events-go-halloween-2026"]');
  await waitScreen(page, 'event');
  check(await page.evaluate(() => location.hash.startsWith('#/event/halloween-2026')), 'happening: the event row\'s Go opens its page');
  await page.click('#app .topbar [data-testid="back"]');
  await waitScreen(page, 'rewards');
  // Go on the week's double drops: its Bounty arena
  const arena = await page.evaluate(async () => (await import('/src/systems/missions.js')).currentEvent().arena);
  await page.click('#app [data-testid="event-go"]');
  await waitScreen(page, 'bounty');
  check(await page.evaluate((a) => location.hash.includes(`arena=${a}`), arena), `happening: the double drops' Go opens Bounty on ${arena}`);
  // every Go comes back: Bounty has a fixed parent (Missions), but opened from a list hub its arrow returns there
  await page.click('#app .topbar [data-testid="back"]');
  await waitScreen(page, 'rewards');
  check(await page.evaluate(() => location.hash === '#/rewards' && document.querySelector('#app .ls-rail .ui-stab.on')?.dataset.testid === 'tab-now'), 'happening: back from the double drops\' Bounty lands on Happening Now (In Progress), not Missions');
  await page.click('#app [data-testid="hn-go-titans"]');
  await waitScreen(page, 'titans');
  await page.click('#app .topbar [data-testid="back"]');
  await waitScreen(page, 'rewards');
  check(await screenIs(page, 'rewards'), 'happening: back from Titan Trials lands on Happening Now');
  await go(page, '#/rewards?tab=soon', 'rewards');
  const soon = await page.evaluate(() => [...document.querySelectorAll('#app .hn-row')].map((r) => ({ id: r.dataset.testid, chip: r.querySelector('.ui-cd')?.textContent || '', go: !!r.querySelector('.ui-cost') })));
  check(soon.filter((r) => /^hn-row-week-/.test(r.id)).length === 2 && soon.every((r) => /Starts in|Opens in/i.test(r.chip)), `happening: Coming Up holds the next two weeks with their start chips (${soon.map((r) => r.id).join(', ')})`);
  await checkRail(page, 'happening soon', ['now', 'soon', 'free'], 'soon');
  await probeScreen(page, 'happening soon');
  // Free pulls: three numbers + MORE, the "?" sheet
  await page.click('#app [data-testid="tab-free"]');
  await settle(page, 300);
  const free = await page.evaluate(() => ({ strip: document.querySelectorAll('#app [data-testid="free-strip"] .ui-cell').length, bars: document.querySelectorAll('#app .hn-chart .hn-row').length }));
  check(free.strip === 3 && free.bars >= 3, `happening: Free pulls shows three headline numbers and the sources as bars (${free.bars})`);
  await probeScreen(page, 'happening free');
  await shot(page, 'happening-free', vp);
  await page.click('#app [data-testid="free-help"]');
  check(!!(await page.waitForSelector('[data-testid="free-help-sheet"]', { timeout: 5000 }).catch(() => null)), 'happening: the "?" opens how the chart is counted');
  await closeModals(page);
  await page.click('#app [data-testid="free-more"]');
  const det = await page.waitForSelector('[data-testid="free-details"]', { timeout: 5000 }).catch(() => null);
  check(!!det && (await page.evaluate(() => document.querySelectorAll('[data-testid="free-details"] table').length)) === 2, 'happening: MORE opens the full tables (recurring and one-time)');
  if (det) {
    const r = await probe(page, { kind: 'detail', root: '[data-testid="free-details"]' });
    check(r.minText >= r.floor, `happening: the tables' sheet passes the text floor (${r.minText} px)`);
  }
  await closeModals(page);
}

// ---------------------------------------------------------------------------------------------------------------
// Off season (E9), on the events' dev clock
// ---------------------------------------------------------------------------------------------------------------
async function devClock(page, iso) {
  await page.evaluate((t) => {
    window.__sakura?.store?.saveNow?.();
    if (t) localStorage.setItem('sakura-dev-now', t);
    else localStorage.removeItem('sakura-dev-now');
  }, iso);
  await page.reload({ waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 60000 });
  await closeModals(page);
}

async function offSeason(page, vp) {
  console.log(`-- Off season ${vp}`);
  // the upcoming phase first (before Halloween opened): settling at its end is final (an ended event never reopens)
  await devClock(page, '2026-10-18T12:00:00Z');
  await go(page, '#/event/halloween-2026', 'event');
  const up = await page.evaluate(() => ({ band: !!document.querySelector('#app [data-testid="event-upcoming"]'), chip: document.querySelector('#app [data-testid="event-opens"]')?.textContent || '', intro: !!document.querySelector('#app [data-testid="event-intro"]') }));
  check(up.band && /Opens in/.test(up.chip) && up.intro, `event: the upcoming phase opens on the E9 band with its chip ("${up.chip}")`);
  await shot(page, 'event-halloween-upcoming', vp);
  await go(page, '#/rewards?tab=soon', 'rewards');
  const teased = await page.evaluate(() => ({ row: document.querySelector('#app [data-testid="hn-row-halloween-2026"] .ui-cd')?.textContent || '' }));
  check(/Opens in/.test(teased.row), `happening: a teased event is Coming Up with its "Opens in" chip ("${teased.row}")`);
  await go(page, '#/rewards?tab=now', 'rewards');
  const bandUp = await page.evaluate(() => document.querySelector('#app [data-testid="happening-offseason"] .ui-offseason-date')?.textContent || '');
  check(/^Opens [A-Z][a-z]{2} \d{1,2}$/.test(bandUp), `happening: before it opens, the band gives the next date ("${bandUp}")`);
  // after the event and its exchange closed
  await devClock(page, '2026-11-20T18:00:00Z');
  await go(page, '#/rewards', 'rewards');
  const band = await page.evaluate(() => {
    const b = document.querySelector('#app [data-testid="happening-offseason"]');
    return { band: !!b, text: b?.querySelector('.ui-offseason-text')?.textContent || '', art: !!b?.querySelector('.hub-bg img'), event: !!document.querySelector('#app [data-testid="hn-row-halloween-2026"]') };
  });
  check(band.band && band.art && /No festival right now/.test(band.text) && !band.event, `happening: nothing limited runs: the off-season band (E9) on its location art ("${band.text}"); the ended event left In Progress`);
  await probeScreen(page, 'happening empty');
  await shot(page, 'happening-empty', vp);
  await page.click('#app [data-testid="happening-past"]');
  await waitScreen(page, 'event');
  const ended = await page.evaluate(() => {
    const b = document.querySelector('#app [data-testid="event-season-ended"]');
    return { band: !!b, art: !!b?.querySelector('img'), text: document.querySelector('#app [data-testid="event-ended"]')?.textContent || '', ink: b ? getComputedStyle(b.querySelector('.ui-offseason-band')).backgroundColor : '' };
  });
  check(ended.band && ended.art && /^Thanks for coming!/.test(ended.text), `event: the ended phase opens on the E9 band ("${ended.text.slice(0, 50)}")`);
  check(/rgba\(14, 25, 48, 0\.9\)/.test(ended.ink), `event: one ink band (${ended.ink})`);
  const r = await probe(page, { kind: 'hub', tapSkip: '.topbar' });
  const fails = judge(r, { skip: ['host', 'bubble'] });
  check(fails.length === 0, `event ended: probe ${summary(r)}${fails.length ? ` → ${fails.join(' | ')}` : ''}`);
  await shot(page, 'event-halloween-ended', vp);
  await devClock(page, null);
}

// ---------------------------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------------------------
const SECTION_PROBE = { display: 'set-fullscreen', audio: 'set-music', battle: 'set-showRanges', account: 'online-pill', about: 'settings-version' };

async function settings(page, vp) {
  console.log(`-- Settings ${vp}`);
  await go(page, '#/settings', 'settings');
  await checkRail(page, 'settings', ['display', 'audio', 'battle', 'account', 'about'], 'display');
  check(await page.evaluate(() => !document.querySelector('#app [data-testid="host"]')), 'settings: no host (not on the E1 list)');
  for (const id of ['audio', 'battle', 'account', 'about', 'display']) {
    await page.click(`#app [data-testid="tab-${id}"]`);
    await settle(page, 500);
    const s = await page.evaluate(([sid, probeId]) => {
      const list = document.querySelector('#app .ls-list');
      const g = document.querySelector(`#app .st-group[data-rail="${sid}"]`);
      const lr = list.getBoundingClientRect();
      const gr = g.getBoundingClientRect();
      const ctl = document.querySelector(`#app [data-testid="${probeId}"]`)?.getBoundingClientRect();
      return {
        top: Math.round(gr.top - lr.top), lit: document.querySelector('#app .ls-rail .ui-stab.on')?.dataset.testid,
        inView: !!ctl && ctl.top >= lr.top - 1 && ctl.top < lr.bottom, hash: location.hash,
      };
    }, [id, SECTION_PROBE[id]]);
    check(Math.abs(s.top) <= 2 && s.lit === `tab-${id}` && s.inView, `settings: the ${id} tab brings its section to the top, lit, its rows in view (top ${s.top}, ${s.hash})`);
    await probeScreen(page, `settings ${id}`, { host: false });
    if (id === 'audio' || id === 'display') await shot(page, `settings-${id}`, vp);
  }
  // the lit tab follows the scroll
  await page.evaluate(() => { const g = document.querySelector('#app .st-group[data-rail="battle"]'); document.querySelector('#app .ls-list').scrollTop = g.offsetTop + 10; });
  await settle(page, 300);
  check(await page.evaluate(() => document.querySelector('#app .ls-rail .ui-stab.on')?.dataset.testid) === 'tab-battle', 'settings: scrolling to Battle lights its tab');
  // descriptions behind "i"
  const info = await page.evaluate(() => {
    const row = [...document.querySelectorAll('#app .ma-set-row.st-has-i')].find((r) => r.querySelector('[data-testid="set-music"]'));
    const desc = row?.querySelector('.ma-set-desc');
    return { found: !!row, hidden: !!desc && desc.getClientRects().length === 0 };
  });
  check(info.found && info.hidden, 'settings: a row\'s description sits behind its "i"');
  await page.evaluate(() => [...document.querySelectorAll('#app .ma-set-row.st-has-i')].find((r) => r.querySelector('[data-testid="set-music"]'))?.querySelector('.st-i')?.scrollIntoView({ block: 'center' }));
  await page.click('#app .ma-set-row.st-has-i:has([data-testid="set-music"]) .st-i');
  check(await page.evaluate(() => document.querySelector('#app .ma-set-row.st-has-i:has([data-testid="set-music"]) .ma-set-desc')?.getClientRects().length > 0), 'settings: "i" shows the description');
  // a row without a control keeps its description in view, with no "i" (Install; "Who can message me" while offline)
  const bare = await page.evaluate(() => ['Install', 'Who can message me'].map((name) => {
    const row = [...document.querySelectorAll('#app .ma-set-row')].find((r) => r.querySelector('.ma-set-label')?.textContent.trim() === name);
    const d = row?.querySelector('.ma-set-desc');
    return { name, found: !!row, kids: row?.querySelector('.ma-set-control')?.childElementCount ?? 0, shown: !!d && d.getClientRects().length > 0, i: !!row?.querySelector('.st-i') };
  }));
  for (const b of bare) check(b.found && b.kids === 0 && b.shown && !b.i, `settings: "${b.name}" has no control, so its description stays in view with no "i" (${JSON.stringify(b)})`);
  // a deep link, and the Menu's Account
  await go(page, '#/lobby', 'lobby');
  await go(page, '#/settings?section=audio', 'settings');
  await settle(page, 300);
  check(await page.evaluate(() => document.querySelector('#app .ls-rail .ui-stab.on')?.dataset.testid) === 'tab-audio', 'settings: #/settings?section=audio opens on Audio');
  await go(page, '#/lobby', 'lobby');
  await page.click('[data-testid="top-menu"]');
  await page.click('[data-testid="menu-account"]');
  await waitScreen(page, 'settings');
  await settle(page, 400);
  check(await page.evaluate(() => document.querySelector('#app .ls-rail .ui-stab.on')?.dataset.testid) === 'tab-account', 'settings: the Menu\'s Account opens on Account');
}

// ---------------------------------------------------------------------------------------------------------------
// Recruit
// ---------------------------------------------------------------------------------------------------------------
async function recruit(page, vp) {
  console.log(`-- Recruit ${vp}`);
  await go(page, '#/recruit', 'recruit');
  const p = await page.evaluate(async () => {
    const { GACHA } = await import('/src/data/types.js');
    const pity = new RegExp(`\\bpity\\b|guaranteed SSR|\\b${GACHA.pity}\\b`, 'i');
    const out = [];
    const walker = document.createTreeWalker(document.querySelector('#app'), NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !el.getClientRects().length || el.closest('[aria-hidden="true"], .topbar')) continue;
      if (pity.test(n.nodeValue)) out.push({ text: n.nodeValue.trim(), inPanel: !!el.closest('[data-testid="pity"]') });
    }
    return { out, left: document.querySelectorAll('#app [data-testid="pity-left"]').length, bg: !!document.querySelector('#app .hub-bg[data-loc="recruit"]') };
  });
  const outside = p.out.filter((x) => !x.inPanel);
  check(p.left === 1 && outside.length === 0, `recruit: the pity shows once, in its panel (${p.out.map((x) => `"${x.text}"${x.inPanel ? '' : ' OUTSIDE'}`).join(', ')})`);
  check(p.bg, 'recruit: the admissions-hall tint behind (E6)');
  const r = await probe(page, { kind: 'hub', tapSkip: '.topbar' });
  const fails = judge(r, { skip: ['host', 'bubble'] });
  check(fails.length === 0, `recruit: probe ${summary(r)}${fails.length ? ` → ${fails.join(' | ')}` : ''}`);
  await shot(page, 'recruit', vp);
}

// ---------------------------------------------------------------------------------------------------------------
// Portrait (390x844): a phone held upright, the fallback when the rotate overlay is dismissed. The UI M5 merge review
// found the Mailroom's long title running under its row's Claim, the material bundle's words cut by the letter's edge
// and the plate title touching Claim all, none of which the spill check sees (it skips clipped text): here every list
// screen is probed with the clip check too (e2e/probe.mjs: text cut off by a box, or run under a neighbour).
// ---------------------------------------------------------------------------------------------------------------
/** The probe on a portrait list screen: every limit (no host in portrait: the M5b rule) and the clip check. */
async function probePortrait(page, name) {
  const r = await probe(page, { kind: 'list', list: '.ls-panel:not(.bare), .ls-list', tapSkip: '.topbar' });
  const fails = judge(r, { skip: ['host', 'bubble'], also: ['clip'] });
  check(fails.length === 0, `${name}: probe ${summary(r)}${fails.length ? ` → ${fails.join(' | ')}` : ''}`);
  return r;
}

/** Each letter's title lines clear of its own row's controls; the bundle's words inside the letter; the plate head. */
const mailLayout = (page) => page.evaluate(() => {
  const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
  const rows = [...document.querySelectorAll('#app .mbx-list > .mbx-letter')].map((row) => {
    const title = row.querySelector('.mbx-title');
    const range = document.createRange();
    range.selectNodeContents(title);
    const lines = [...range.getClientRects()];
    const ctrls = [...row.querySelectorAll('.mbx-letter-side > *')].map((c) => c.getBoundingClientRect());
    const letter = row.getBoundingClientRect();
    const words = [...row.querySelectorAll('.mbx-bundle > span *')].flatMap((w) => {
      const rr = document.createRange();
      rr.selectNodeContents(w);
      return [...rr.getClientRects()];
    });
    return {
      id: row.dataset.testid, under: lines.some((l) => ctrls.some((c) => hit(l, c))), wide: title.scrollWidth > title.clientWidth + 1,
      bundleOut: words.some((w) => w.right > letter.right - 1 || w.left < letter.left + 1),
    };
  });
  const t = document.querySelector('#app .ls-panel > .ui-plate-head .ui-plate-title > span')?.getBoundingClientRect();
  const right = document.querySelector('#app .ls-panel > .ui-plate-head .ui-plate-right')?.getBoundingClientRect();
  return { rows, headClear: !t || !right || right.left >= t.right + 4 || right.top >= t.bottom - 0.5 };
});

async function portrait(page, vp) {
  console.log(`-- portrait ${vp}`);
  // the story's welcome letter too, with its long title ("Ten new possibilities, on us ♡"), and the beta gift's bundle
  await page.evaluate(async (now) => {
    const { deliverMail } = await import('/src/systems/mail.js');
    const { WELCOME_MAIL } = await import('/src/data/story/lessons.js');
    const p = window.__sakura.store.profile;
    if (!(p.mail?.letters || []).some((l) => l.id === WELCOME_MAIL.id)) {
      const fill = (s) => s.replace(/\{name:hikari\}/g, 'Hikari');
      deliverMail(p, { id: WELCOME_MAIL.id, from: fill(WELCOME_MAIL.from), title: fill(WELCOME_MAIL.title), body: fill(WELCOME_MAIL.body), rewards: WELCOME_MAIL.rewards }, now);
    }
    window.__sakura.store.commit('mail');
  }, NOW);
  await go(page, '#/mail', 'mail');
  const m = await mailLayout(page);
  const ids = m.rows.map((r) => r.id);
  check(ids.includes('mail-story-welcome-10pull') && ids.includes('mail-beta-thanks-2026'), `portrait mail: the long-titled letter and the bundle letter are on the list (${ids.join(', ')})`);
  const under = m.rows.filter((r) => r.under || r.wide).map((r) => r.id);
  check(under.length === 0, `portrait mail: every title wraps inside its column, clear of its row's expiry chip and Claim${under.length ? ` (${under.join(', ')})` : ''}`);
  const out = m.rows.filter((r) => r.bundleOut).map((r) => r.id);
  check(out.length === 0, `portrait mail: the material bundle's words stay inside the letter${out.length ? ` (${out.join(', ')})` : ''}`);
  check(m.headClear, 'portrait mail: the plate title and Claim all keep apart (the button wraps under the title)');
  await probePortrait(page, 'portrait mail unclaimed');
  await shot(page, 'portrait-mail', vp);
  // a letter read in full
  await page.click('#app [data-testid="mail-story-welcome-10pull"] .mbx-read').catch(() => page.click('#app .mbx-letter .mbx-read'));
  await settle(page, 300);
  await probePortrait(page, 'portrait mail, a letter read');
  await shot(page, 'portrait-mail-read', vp);
  await page.click('#app [data-testid="tab-history"]');
  await settle(page, 300);
  await probePortrait(page, 'portrait mail history');
  // the other list screens
  for (const [hash, s, name] of [['#/mall?tab=general', 'mall', 'mall general'], ['#/mall?tab=boss', 'mall', 'mall boss'], ['#/rewards?tab=now', 'rewards', 'happening now'],
    ['#/rewards?tab=free', 'rewards', 'free pulls'], ['#/settings', 'settings', 'settings']]) {
    await go(page, hash, s);
    await probePortrait(page, `portrait ${name}`);
    await shot(page, `portrait-${name.replace(/\s+/g, '-')}`, vp);
  }
}

for (const vp of viewports) {
  console.log(`\n=== ${vp} ===`);
  const { ctx, page, errors, touch } = await open(vp);
  const [vw, vh] = vp.split('x').map(Number);
  for (const step of vh > vw ? [portrait] : [mailroom, mall, happening, freeDoors, settings, recruit, offSeason]) {
    try {
      await step(page, vp, touch);
    } catch (e) {
      check(false, `${step.name} ${vp}: ${e.message.split('\n')[0]}`);
      await closeModals(page).catch(() => {});
    }
  }
  check(errors.length === 0, `${vp}: no page errors${errors.length ? ` (${errors.slice(0, 3).join(' | ')})` : ''}`);
  await ctx.close();
}

await browser.close();
await server.close();
console.log(failures ? `\n${failures} check(s) FAILED` : '\nALL LIST CHECKS PASSED');
process.exit(failures ? 1 : 0);
