// Potential (owner, Oct 14: "add potential levels when you get dupes, perhaps they get small
// passives … max 6"; spec docs/specs/POTENTIAL.md §11.3). On a fresh save: Aoi ×3 (P4) and
// Kaede ×5 (P6) through grantUnit, then
//   students: card pills (P4 plum, P6 sakura), the Potential sort, the formation and stage-prep slots;
//   Aoi's page: the showcase pill opens the Info tab at the Potential section (nodes, signature,
//   footer), "Yours" damage = base × 1.04 × 1.04 (Potential v3), no sideways scroll;
//   recruit: a real 10-pull of owned R girls (corner tags, "▲ N Potential" on one line), the counts;
//   spark an owned P6 Kaede (MAX, kicker "SSR · P6 · MAX") and a new Hotaru; an SSR Select Ticket
//   on the owned Hotaru (confirm "P1 → P2", "Potential 2 ▲"); the first-gain tip points at the Info tab;
//   battle 1-1: Aoi's panel pill P4 and the panel DPS = the sim's; the longest name line fits;
//   a save from before Potential (no dupes, 40 history entries) → its pills, one letter, a reload
//   keeps one letter and the same Potential.
// Phone (844×390, touch) and PC (1280×720). Screenshots: --shots <dir> (default $SCR/potential).
// Usage: node e2e/potential.mjs [--shots dir]
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const SHOTS = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : process.env.SCR ? join(process.env.SCR, 'potential') : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const require = createRequire('/opt/node22/lib/node_modules/playwright/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const fails = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
const T = 60000;
const SAVE_KEY = 'sakura-sentinels-save-v1';

async function go(page, hash, selector) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForSelector(selector, { timeout: T });
  await page.waitForTimeout(450);
}

async function shot(page, name) {
  if (!SHOTS) return;
  for (let i = 0; i < 2; i++) {
    try {
      await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 120000 });
      return;
    } catch (e) {
      if (i) console.log(`  warn screenshot ${name} skipped: ${String(e.message).split('\n')[0]}`);
    }
  }
}

async function dismissGift(page) {
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 20000 }).catch(() => null);
  if (later) { await later.click({ force: true }); await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 15000 }).catch(() => {}); }
}

async function load(page, hash = '#/lobby') {
  await page.goto(`${base}${hash}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: T });
}

/** No element wider than the page (no sideways scroll). */
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && document.body.scrollWidth <= window.innerWidth + 1);

const rectOf = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
const inside = (a, b) => a && b && a.l >= b.l - 0.5 && a.t >= b.t - 0.5 && a.r <= b.r + 0.5 && a.b <= b.b + 0.5;
const overlap = (a, b) => (a && b ? Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t)) : 0);

/** Plays a reveal to its results and returns what the cards and the summary show. */
async function revealToResults(page) {
  const skip = await page.waitForSelector('[data-testid="reveal-skip"]', { timeout: 20000 }).catch(() => null);
  if (skip) await skip.click({ force: true }).catch(() => {});
  await page.waitForSelector('[data-testid="reveal-close"]', { timeout: 30000 });
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const sum = document.querySelector('[data-testid="reveal-summary"]');
    const spans = sum ? [...sum.children].filter((c) => getComputedStyle(c).display !== 'none') : [];
    const tops = new Set(spans.map((c) => Math.round(c.getBoundingClientRect().top)));
    return {
      tags: [...document.querySelectorAll('.ma-gc-pot')].map((e) => e.textContent.trim()),
      summary: sum?.textContent.replace(/\s+/g, ' ').trim() || '',
      oneLine: tops.size <= 1,
      kicker: document.querySelector('[data-testid="showcase-kicker"]')?.textContent || null,
    };
  });
}

async function closeReveal(page) {
  await page.click('[data-testid="reveal-close"]', { force: true }).catch(() => {});
  await page.waitForTimeout(500);
}

const profileOf = (page) => page.evaluate(() => {
  const p = window.__sakura.store.profile;
  return { dupes: Object.fromEntries(Object.entries(p.units).map(([id, u]) => [id, u.dupes])), seenIntro: p.seenIntro, letters: (p.mail?.letters || []).map((l) => l.id) };
});
const P = (d) => Math.min(6, 1 + (d || 0));

try {
  for (const [W, H] of [[844, 390], [1280, 720]]) {
    const tag = `${W}x${H}`;
    const touch = W < 1000;
    console.log(`viewport ${tag}`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage();
    page.setDefaultTimeout(T);
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));

    await load(page);
    await page.evaluate(() => localStorage.clear());
    await load(page);
    await dismissGift(page);
    // 1. Aoi ×3 → P4, Kaede ×5 → P6 (her first copy + 5), one 10-pull ticket
    await page.evaluate(async () => {
      const { store } = window.__sakura;
      const { grantUnit } = await import('/src/systems/unlocks.js');
      const p = store.profile;
      for (let i = 0; i < 3; i++) grantUnit(p, 'aoi');
      for (let i = 0; i < 6; i++) grantUnit(p, 'kaede');
      p.units.kaede.level = 30;
      p.units.kaede.breakthrough = 2;
      p.formation = { hero: 'hikari', towers: ['aoi', 'kaede', 'rei'] };
      p.items.ticket_recruit10 = 1;
      store.commit('test');
      store.saveNow?.();
    });

    // 2. students: pills and the Potential sort
    await go(page, '#/students', '.unit-card[data-unit="kaede"]');
    const cards = await page.evaluate(() => {
      const pill = (id) => {
        const e = document.querySelector(`.unit-card[data-unit="${id}"] [data-testid="card-pot"] .pot-pill`);
        if (!e) return null;
        const cs = getComputedStyle(e);
        return { text: e.textContent, p6: e.classList.contains('p6'), color: cs.color, title: e.getAttribute('title') };
      };
      return { aoi: pill('aoi'), kaede: pill('kaede'), rei: pill('rei') };
    });
    check(cards.aoi?.text === 'P4' && !cards.aoi.p6 && cards.aoi.color === 'rgb(255, 255, 255)', `${tag} students: Aoi's card pill "P4" (plum, white text): ${JSON.stringify(cards.aoi)}`);
    check(cards.kaede?.text === 'P6' && cards.kaede.p6 && cards.kaede.color === 'rgb(59, 35, 80)', `${tag} students: Kaede's card pill "P6" (sakura, dark plum text): ${JSON.stringify(cards.kaede)}`);
    check(cards.rei === null, `${tag} students: no pill at P1 (Rei)`);
    const kCard = await rectOf(page, '.unit-card[data-unit="kaede"]');
    const kPill = await rectOf(page, '.unit-card[data-unit="kaede"] [data-testid="card-pot"]');
    const kBadges = await rectOf(page, '.unit-card[data-unit="kaede"] .mb-card-badges');
    const kLevel = await rectOf(page, '.unit-card[data-unit="kaede"] .unit-card-level');
    check(inside(kPill, kCard) && overlap(kPill, kBadges) === 0 && overlap(kPill, kLevel) === 0, `${tag} students: the pill sits inside the card, under "Lv.30", clear of the badges ${JSON.stringify({ kCard, kPill, kBadges, kLevel })}`);
    await page.selectOption('.mb-sort select', 'potential');
    await page.waitForTimeout(400);
    const order = await page.evaluate(() => [...document.querySelectorAll('.mb-student-grid .unit-card')].map((c) => c.dataset.unit));
    check(order[0] === 'kaede' && order[1] === 'aoi', `${tag} students: the Potential sort puts Kaede (P6) then Aoi (P4) first (${order.slice(0, 3).join(', ')})`);
    check(await noSideScroll(page), `${tag} students: no sideways scroll`);
    await shot(page, `students-${tag}`);
    await page.selectOption('.mb-sort select', 'power');

    // formation squad slots and stage prep slots
    await go(page, '#/formation', '.mb-fslot.filled[data-unit="kaede"]');
    const fs = await rectOf(page, '.mb-fslot.filled[data-unit="kaede"]');
    const fp = await rectOf(page, '.mb-fslot.filled[data-unit="kaede"] [data-testid="fslot-pot"]');
    const fx = await rectOf(page, '.mb-fslot.filled[data-unit="kaede"] .mb-fslot-x');
    check(inside(fp, fs) && overlap(fp, fx) === 0, `${tag} formation: Kaede's squad slot pill is inside the slot, clear of the ×`);
    await shot(page, `formation-${tag}`);
    await go(page, '#/stage/1-1', '.ma-fslot .unit-card[data-unit="kaede"]');
    const ps = await rectOf(page, '.ma-fslot .unit-card[data-unit="kaede"]');
    const pp = await rectOf(page, '.ma-fslot .unit-card[data-unit="kaede"] [data-testid="card-pot"]');
    const pr = await rectOf(page, '.ma-fslot .unit-card[data-unit="kaede"] .unit-card-rarity');
    const pl = await rectOf(page, '.ma-fslot .unit-card[data-unit="kaede"] .unit-card-level');
    const nameText = await page.evaluate(() => { const e = document.querySelector('.ma-fslot .unit-card[data-unit="kaede"] .unit-card-name'); const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
    const levelText = await page.evaluate(() => { const e = document.querySelector('.ma-fslot .unit-card[data-unit="kaede"] .unit-card-level'); const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
    check(overlap(levelText, nameText) <= 3 * (levelText.r - levelText.l), `${tag} stage prep: "Lv.30" and the name stay apart on the slot with a pill ${JSON.stringify({ levelText, nameText })}`);
    const prVisible = await page.evaluate(() => { const e = document.querySelector('.ma-fslot .unit-card[data-unit="kaede"] .unit-card-rarity'); return e && getComputedStyle(e).display !== 'none'; });
    check(inside(pp, ps) && (!prVisible || overlap(pp, pr) === 0) && overlap(pp, pl) === 0, `${tag} stage prep: the slot pill stays inside the slot and off the rarity tag and level ${JSON.stringify({ ps, pp, pr, pl, prVisible })}`);
    await page.evaluate(() => document.querySelector('.ma-fslot .unit-card[data-unit="kaede"]')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(250);
    await shot(page, `stage-prep-${tag}`);

    // 3. Aoi's page: showcase pill → Info tab at the Potential section
    await go(page, '#/student/aoi?tab=level', '[data-testid="show-potential"]');
    const showPill = await page.evaluate(() => document.querySelector('[data-testid="show-potential"]').textContent);
    check(showPill === 'P4', `${tag} Aoi's page: showcase pill "${showPill}"`);
    await page.click('[data-testid="show-potential"]');
    await page.waitForSelector('[data-testid="potential-section"]', { timeout: T });
    await page.waitForTimeout(900);
    const sec = await page.evaluate(() => {
      const s = document.querySelector('[data-testid="potential-section"]');
      const r = s.getBoundingClientRect();
      const nodes = [1, 2, 3, 4, 5, 6].map((n) => document.querySelector(`[data-testid="potential-node-${n}"]`));
      const dmgRow = [...document.querySelectorAll('.mb-stats tr')].find((tr) => tr.firstChild?.textContent === 'Damage per hit');
      return {
        tab: document.querySelector('.mb-tab.active')?.dataset.testid,
        hash: location.hash,
        inView: r.top < window.innerHeight && r.bottom > 0,
        on: nodes.map((n) => n?.classList.contains('on')),
        next: nodes.map((n) => n?.classList.contains('next')),
        labels: nodes.map((n) => n?.querySelector('.pot-node-label')?.textContent),
        sig: document.querySelector('[data-testid="potential-signature"]')?.textContent.replace(/\s+/g, ' ').trim(),
        footer: document.querySelector('[data-testid="potential-footer"]')?.textContent,
        yours: dmgRow ? [...dmgRow.children].map((c) => c.textContent) : null,
      };
    });
    check(sec.tab === 'tab-info' && sec.hash.includes('focus=potential') && sec.inView, `${tag} Aoi's page: the pill opens the Info tab with the Potential section in view (${sec.tab}, ${sec.hash})`);
    check(sec.on.join() === 'true,true,true,true,false,false' && sec.next[4] === true, `${tag} Aoi's page: nodes P1–P4 on, P5 next (${sec.on.join()})`);
    // Potential v3 (docs/specs/POTENTIAL.md v3 §5.2): her node labels and capstone
    check(sec.labels.join('|') === "Base|+4% DMG|PIERCE+1|CRIT+6%|TWIN 1/12|HAWK✦", `${tag} Aoi's page: node labels ${sec.labels.join(' | ')}`);
    check(/Hawk Companion — \+5% damage\. Twin Fletch comes every 10th volley/.test(sec.sig) && /Unlocks at P6 \(2 more duplicates\)/.test(sec.sig) && /Active in every battle/.test(sec.sig), `${tag} Aoi's page: signature box "${sec.sig}"`);
    check(sec.footer === 'Duplicates so far: 3 · Next: P5 with 1 more duplicate', `${tag} Aoi's page: footer "${sec.footer}"`);
    check(sec.yours?.[1] === '4' && sec.yours?.[2] === '4.33', `${tag} Aoi's page: "Yours" damage per hit = 4 × 1.04 × 1.04 (${sec.yours?.join(' / ')})`);
    check(await noSideScroll(page), `${tag} Aoi's page: no sideways scroll`);
    await shot(page, `student-aoi-potential-${tag}`);
    // an unowned girl still shows her six steps (all locked)
    await go(page, '#/student/raika', '[data-testid="potential-section"]');
    const unowned = await page.evaluate(() => ({ on: document.querySelectorAll('.pot-node.on').length, footer: document.querySelector('[data-testid="potential-footer"]')?.textContent, pill: !!document.querySelector('[data-testid="show-potential"]') }));
    check(unowned.on === 0 && unowned.footer === 'Recruit her to start at P1.' && !unowned.pill, `${tag} Raika (not owned): the section previews her steps, all locked`);
    await go(page, '#/student/kaede?tab=info&focus=potential', '[data-testid="potential-section"]');
    const kae = await page.evaluate(() => ({ footer: document.querySelector('[data-testid="potential-footer"]')?.textContent, on: document.querySelectorAll('.pot-node.on').length, sig: document.querySelector('[data-testid="potential-signature"]')?.classList.contains('on') }));
    check(kae.on === 6 && kae.sig && /^Potential maxed — duplicates now give Star Fragments only \(\+40 each\)/.test(kae.footer), `${tag} Kaede (P6): six nodes on, "${kae.footer}"`);
    await shot(page, `student-kaede-p6-${tag}`);

    // 4. recruit: all four R girls owned below P6, a real 10-pull
    await page.evaluate(async () => {
      const { store } = window.__sakura;
      const { grantUnit } = await import('/src/systems/unlocks.js');
      const p = store.profile;
      for (const id of ['yuki', 'momo']) if (!p.units[id]) grantUnit(p, id);
      store.commit('test');
    });
    const before = await profileOf(page);
    await go(page, '#/recruit', '[data-testid="pull-10"]');
    await page.click('[data-testid="pull-10"]');
    const cp = await page.waitForSelector('[data-testid="confirm-pull"]', { timeout: 3000 }).catch(() => null);
    if (cp) await cp.click();
    const pull = await revealToResults(page);
    const after = await profileOf(page);
    const ups = Object.keys(after.dupes).filter((id) => P(after.dupes[id]) > P(before.dupes[id] ?? -1) && before.dupes[id] != null).length;
    // a girl new in this pull starts at P1; her later copies in the same pull are steps too
    const rises = Object.keys(after.dupes).reduce((a, id) => a + P(after.dupes[id]) - (before.dupes[id] != null ? P(before.dupes[id]) : 1), 0);
    check(pull.tags.length >= 1 && pull.tags.every((t) => /^P[2-6] ▲$|^MAX$/.test(t)), `${tag} recruit: corner tags on duplicates (${pull.tags.join(', ')})`);
    check(pull.summary.includes(`▲ ${rises} Potential`) && rises >= 1, `${tag} recruit: summary "${pull.summary}" counts the ${rises} steps (${ups} girls)`);
    check(pull.oneLine, `${tag} recruit: the summary stays on one line`);
    check(W > 1000 ? pull.summary.includes('Star Fragments') : !/Star Fragments/.test(await page.evaluate(() => document.querySelector('[data-testid="reveal-summary"]').innerText)), `${tag} recruit: "Star Fragments" ${W > 1000 ? 'spelled out on PC' : 'hidden on the phone (icon + number stay)'}`);
    await shot(page, `recruit-10-${tag}`);
    await closeReveal(page);
    // 6. the first-gain tip (once)
    // (other toasts may stand with it, e.g. an achievement completed by this pull)
    const tip = await page.waitForFunction(() => [...document.querySelectorAll('.toast')].map((e) => e.textContent).find((t) => /See her Info tab/.test(t)) || null, null, { timeout: 4000 })
      .then((h) => h.jsonValue()).catch(() => page.evaluate(() => [...document.querySelectorAll('.toast')].map((e) => e.textContent).join(' | ')));
    check(/See her Info tab/.test(tip), `${tag} recruit: the first Potential gain shows the tip "${tip}"`);
    const seen = await profileOf(page);
    check(seen.seenIntro.includes('potential-tip'), `${tag} recruit: the tip is remembered`);

    // 5. spark: an owned P6 Kaede (MAX) and a new Hotaru
    await page.evaluate(() => { const p = window.__sakura.store.profile; p.gacha.recruitPoints = 400; window.__sakura.store.commit('test'); });
    await go(page, '#/recruit', '[data-testid="spark"]');
    await page.click('[data-testid="spark"]');
    await page.waitForSelector('[data-testid="spark-kaede"]');
    const meta = await page.evaluate(() => ({ kaede: document.querySelector('[data-testid="spark-meta-kaede"]')?.textContent, hotaru: document.querySelector('[data-testid="spark-meta-hotaru"]')?.textContent, text: document.querySelector('.modal p')?.textContent }));
    check(meta.kaede === 'P6 → fragments' && /she gains \+1 Potential \(up to P6\)/.test(meta.text), `${tag} spark: grid "${meta.kaede}", text "${meta.text}"`);
    await shot(page, `spark-grid-${tag}`);
    await page.click('[data-testid="spark-kaede"]');
    let r = await revealToResults(page);
    const kick = await page.evaluate(() => document.querySelector('.ma-gc .ma-gc-pot')?.textContent);
    check(kick === 'MAX', `${tag} spark: Kaede at P6 shows "MAX" (${kick})`);
    await closeReveal(page);
    // the kicker: play the reveal again without skipping to the showcase
    await page.evaluate(() => { const p = window.__sakura.store.profile; p.gacha.recruitPoints = 200; window.__sakura.store.commit('test'); });
    await go(page, '#/recruit', '[data-testid="spark"]');
    await page.click('[data-testid="spark"]');
    await page.waitForSelector('[data-testid="spark-kaede"]');
    await page.click('[data-testid="spark-kaede"]');
    const kicker = await page.waitForSelector('[data-testid="showcase-kicker"]', { timeout: 15000 }).then((e) => e.textContent()).catch(() => null);
    check(kicker === 'SSR · P6 · MAX', `${tag} spark: showcase kicker "${kicker}"`);
    await page.waitForTimeout(1600); // the showcase text fades in
    await shot(page, `spark-kicker-${tag}`);
    await page.click('.ma-showcase', { force: true }).catch(() => {});
    await page.waitForSelector('[data-testid="reveal-close"]', { timeout: 20000 });
    await closeReveal(page);
    // a new girl (Hotaru) by spark
    await page.evaluate(() => { const p = window.__sakura.store.profile; p.gacha.recruitPoints = 200; window.__sakura.store.commit('test'); });
    await go(page, '#/recruit', '[data-testid="spark"]');
    await page.click('[data-testid="spark"]');
    await page.waitForSelector('[data-testid="spark-hotaru"]');
    await page.click('[data-testid="spark-hotaru"]');
    r = await revealToResults(page);
    check(r.tags.length === 0, `${tag} spark: a new girl gets no Potential tag (NEW instead)`);
    await closeReveal(page);

    // SSR Select Ticket on the owned Hotaru (P1 → P2)
    await page.evaluate(async () => {
      const p = window.__sakura.store.profile;
      p.items.ticket_ssr_select = 1;
      window.__sakura.store.commit('test');
      (await import('/src/ui/selectTicket.js')).openSelectTicket();
    });
    await page.waitForSelector('[data-testid="sst-hotaru"]');
    const pick = await page.evaluate(() => document.querySelector('.sst p')?.textContent);
    check(/Already in your academy\? She gains \+1 Potential \(up to P6\) and 40 Star Fragments\./.test(pick), `${tag} select ticket: picker text "${pick}"`);
    await page.click('[data-testid="sst-hotaru"]');
    await page.waitForSelector('[data-testid="confirm-ok"]');
    const conf = await page.evaluate(() => [...document.querySelectorAll('.modal')].pop()?.textContent.replace(/\s+/g, ' '));
    check(/Hotaru is already in your academy: she gains \+1 Potential \(P1 → P2\) and 40 Star Fragments\. Use it\?/.test(conf) && /Use ticket/.test(conf), `${tag} select ticket: confirm "${conf?.slice(0, 120)}"`);
    await page.click('[data-testid="confirm-ok"]');
    const joined = await page.waitForSelector('[data-testid="sst-joined-text"]').then((e) => e.textContent());
    check(joined === 'Hotaru was already here — Potential 2 ▲ and +40 Star Fragments.', `${tag} select ticket: "${joined}"`);
    await shot(page, `select-ticket-${tag}`);
    await page.click('[data-testid="sst-ok"]', { force: true });

    // mall: the Recruit Exchange stock line
    await go(page, '#/mall?tab=recruit', '.ma-offer');
    const stock = await page.evaluate(() => [...document.querySelectorAll('.ma-offer.unit')].map((o) => o.textContent).join(' | '));
    check(/P6 → fragments/.test(stock) && /Owned → P\+1 & fragments/.test(stock), `${tag} mall: Recruit Exchange stock reads "P6 → fragments" / "Owned → P+1 & fragments"`);

    // 7. battle 1-1: Aoi's panel
    const counts = await profileOf(page);
    const aoiP = P(counts.dupes.aoi);
    await page.evaluate(() => { location.hash = '#/battle?stage=1-1&difficulty=normal'; });
    await page.waitForFunction(() => window.__battle?.sim && window.__battle.ui?.select && document.querySelector('[data-testid="card-aoi"]'), null, { timeout: 90000 });
    // the free hero card arms itself at wave 0 (hero rework, ~0.7 s in), which would close the
    // panel we open: let it arm, then put it back
    await page.waitForFunction(() => window.__battle.ui.placement?.unitId, null, { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => window.__battle.ui.placement?.cancel?.());
    await page.waitForTimeout(800);
    const placed = await page.evaluate(() => {
      const { sim, ui } = window.__battle;
      sim.cash = 1e6;
      const out = {};
      for (const id of ['aoi', 'kaede']) {
        for (let y = 0.5; y < sim.map.height && out[id] == null; y += 0.5) {
          for (let x = 0.5; x < sim.map.width && out[id] == null; x += 0.5) {
            if (!sim.canPlace(id, x, y).ok) continue;
            const t = sim.placeTower(id, x, y);
            out[id] = t?.uid ?? null;
          }
        }
      }
      ui.select(out.aoi);
      return out;
    });
    await page.waitForFunction(() => { const el = document.querySelector('[data-testid="tower-panel"]'); return el && !el.hidden; }, null, { timeout: T });
    await page.waitForTimeout(400);
    const panel = await page.evaluate((uid) => {
      const p = document.querySelector('[data-testid="tower-panel"]');
      const name = p.querySelector('.bt-panel-name');
      const st = window.__battle.sim.towerStats(uid);
      const txt = p.textContent.replace(/\s+/g, ' ');
      return { pill: p.querySelector('[data-testid="panel-pot"]')?.textContent, cls: p.querySelector('[data-testid="panel-pot"]')?.className, title: p.querySelector('[data-testid="panel-pot"]')?.title, overflow: name.scrollWidth > name.clientWidth + 1, dps: st.dps, txt };
    }, placed.aoi);
    check(panel.pill === `P${aoiP}` && /bt-panel-pot/.test(panel.cls), `${tag} battle: Aoi's panel pill "${panel.pill}" (P${aoiP})`);
    check(/^Potential \d: Dawn Practice, Through-Shot/.test(panel.title), `${tag} battle: the pill's tooltip "${panel.title}"`);
    check(!panel.overflow, `${tag} battle: the name line does not overflow`);
    const aoiSim = await page.evaluate((uid) => { const t = window.__battle.sim.towers.find((x) => x.uid === uid); return { p: t.unitStats.potential, dmg: t.stats.damage, base: t.def.base.damage }; }, placed.aoi);
    check(aoiSim.p === aoiP && Math.abs(aoiSim.dmg - aoiSim.base * (aoiP >= 6 ? 1.04 * 1.04 * 1.05 : aoiP >= 4 ? 1.04 * 1.04 : 1.04)) < 1e-9, `${tag} battle: Aoi fights at P${aoiSim.p} (damage ${aoiSim.dmg})`);
    await shot(page, `battle-aoi-${tag}`);
    // the longest name in the panel: Kaede UR + 5-0-2 + P6 (+ the longest girl's name)
    await page.evaluate((uid) => {
      const { sim, ui } = window.__battle;
      for (let i = 0; i < 5; i++) sim.upgradeTower(uid, 0);
      for (let i = 0; i < 2; i++) sim.upgradeTower(uid, 2);
      const t = sim.towers.find((x) => x.uid === uid);
      t.def = { ...t.def, name: 'Kaede Longest-Name' };
      window.__sakura.store.profile.units.kaede.awaken = 5;
      ui.select(null);
      ui.select(uid);
    }, placed.kaede);
    await page.waitForTimeout(400);
    const wide = await page.evaluate(() => { const n = document.querySelector('[data-testid="tower-panel"] .bt-panel-name'); const pill = n.querySelector('.pot-pill'); const r = n.getBoundingClientRect(); const pr = pill?.getBoundingClientRect(); return { overflow: n.scrollWidth > n.clientWidth + 1, pillIn: pr && pr.right <= r.right + 0.5, text: n.textContent }; });
    check(!wide.overflow && wide.pillIn, `${tag} battle: "${wide.text}" fits the name line, the P6 pill inside`);
    await shot(page, `battle-longname-${tag}`);
    await page.evaluate(() => { window.__sakura.store.profile.units.kaede.awaken = 0; });

    // 8. a save from before Potential: no dupes, 40 history entries, an old createdAt
    const t0 = Date.now() - 30 * 86400000;
    await page.evaluate(([key, t0]) => {
      const { store } = window.__sakura;
      const p = JSON.parse(JSON.stringify(store.profile));
      p.createdAt = t0;
      for (const u of Object.values(p.units)) { delete u.dupes; u.obtainedAt = t0; }
      for (const k of Object.keys(p.missions.counters)) if (k.startsWith('pot:')) delete p.missions.counters[k];
      p.seenIntro = p.seenIntro.filter((s) => s !== 'potential-backfilled' && s !== 'potential-tip');
      p.mail.delivered = p.mail.delivered.filter((d) => d !== 'potential-arrived-1');
      p.mail.letters = p.mail.letters.filter((l) => l.id !== 'potential-arrived-1');
      const hist = [];
      const at = (i) => t0 + 3600000 + i * 60000;
      // Aoi 12 (P6), Rei 2 (P3), Yuki 1 (P2), Kaede 1 (P2), and 24 recruits of a girl not owned (Shiro)
      for (let i = 0; i < 12; i++) hist.push({ unitId: 'aoi', rarity: 'R', at: at(i) });
      for (let i = 0; i < 2; i++) hist.push({ unitId: 'rei', rarity: 'R', at: at(20 + i) });
      hist.push({ unitId: 'yuki', rarity: 'R', at: at(30) }, { unitId: 'kaede', rarity: 'SSR', at: at(31) });
      for (let i = 0; i < 24; i++) hist.push({ unitId: 'shiro', rarity: 'SR', at: at(40 + i) });
      p.gacha.history = hist;
      p.gacha.totalPulls = hist.length;
      for (const id of ['momo', 'hotaru', 'shiro']) delete p.units[id];
      store.saveNow = () => {};
      window.onbeforeunload = null;
      localStorage.setItem(key, JSON.stringify(p));
    }, [SAVE_KEY, t0]);
    const ctx2 = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, storageState: await ctx.storageState() });
    await ctx.close();
    const page2 = await ctx2.newPage();
    page2.on('pageerror', (e) => errs.push(e.message));
    await load(page2);
    await dismissGift(page2);
    const mig = await profileOf(page2);
    check(mig.seenIntro.includes('potential-backfilled'), `${tag} old save: backfilled once`);
    check(P(mig.dupes.aoi) === 6 && P(mig.dupes.rei) === 3 && P(mig.dupes.yuki) === 2 && P(mig.dupes.kaede) === 2, `${tag} old save: Aoi P${P(mig.dupes.aoi)}, Rei P${P(mig.dupes.rei)}, Yuki P${P(mig.dupes.yuki)}, Kaede P${P(mig.dupes.kaede)} from the history`);
    check(mig.letters.filter((id) => id === 'potential-arrived-1').length === 1, `${tag} old save: one "New: Potential!" letter`);
    await go(page2, '#/students', '.unit-card[data-unit="aoi"]');
    const migCards = await page2.evaluate(() => Object.fromEntries(['aoi', 'rei', 'yuki', 'kaede'].map((id) => [id, document.querySelector(`.unit-card[data-unit="${id}"] [data-testid="card-pot"]`)?.textContent || null])));
    check(migCards.aoi === 'P6' && migCards.rei === 'P3' && migCards.yuki === 'P2' && migCards.kaede === 'P2', `${tag} old save: cards ${JSON.stringify(migCards)}`);
    // the letter in the mailbox
    await page2.evaluate(async () => (await import('/src/ui/lobby/mailbox.js')).openMailbox());
    const letter = await page2.waitForSelector('[data-testid="mail-potential-arrived-1"]', { timeout: 15000 }).then((e) => e.textContent()).catch(() => '');
    check(/New: Potential!/.test(letter) && /Aoi P6, Rei P3/.test(letter) && /Info tab/.test(letter), `${tag} old save: the letter reads "${letter.replace(/\s+/g, ' ')}"`);
    await page2.click('[data-testid="mail-potential-arrived-1"] .mbx-letter-body', { force: true });
    await page2.waitForTimeout(250);
    const full = await page2.evaluate(() => { const b = document.querySelector('[data-testid="mail-potential-arrived-1"] .mbx-letter-body'); return b.scrollHeight <= b.clientHeight + 1; });
    check(full, `${tag} old save: a tap shows the whole letter`);
    await shot(page2, `letter-${tag}`);
    await page2.click('[data-testid="mail-close"]', { force: true }).catch(() => {});
    await page2.evaluate(() => window.__sakura.store.saveNow?.());
    await page2.waitForTimeout(300);
    await load(page2);
    const again = await profileOf(page2);
    check(again.letters.filter((id) => id === 'potential-arrived-1').length === 1 && JSON.stringify(again.dupes) === JSON.stringify(mig.dupes), `${tag} reload: still one letter and the same Potential`);
    check(!errs.length, `${tag} no page errors${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`);
    await ctx2.close();
  }
} finally {
  await browser.close();
  await server.close();
}
if (fails.length) {
  console.log(`\n${fails.length} failed`);
  process.exit(1);
}
console.log('\npotential: all ok');
