// Potential (owner, Oct 14: "add potential levels when you get dupes … max 6"; Oct 15: "the more
// levels you have the better they should be"; spec docs/specs/POTENTIAL.md v3 §11–§13.3, v2 §7, §11.3).
// On a fresh save: Aoi ×3 (P4) and Kaede ×5 (P6) through grantUnit, then
//   students: card pills (P4 plum, P6 sakura with the crown), the Potential sort, the formation and
//   stage-prep slots;
//   Aoi's page: the showcase pill (its title names the next step) opens the Info tab at the Potential
//   section: six nodes with the stat line under each (`stat · cap` once Potential raises her cap),
//   the five-step list (owned ✓, NEXT · 1 more duplicate, later muted, the P6 crown), the footer,
//   "Yours" damage = base × 1.04 × 1.04, no sideways scroll;
//   recruit: a real 10-pull of owned R girls (corner tags, the step ribbon under each duplicate's
//   name, "▲ N Potential" on one line), the counts; spark an owned P6 Kaede (MAX, kicker "SSR · P6 ·
//   MAX") and a new Hotaru; an SSR Select Ticket on the owned Hotaru (confirm "P1 → P2: ✦ Firefly
//   Lamps", the unlocked step); a spark of the P2 Hotaru played out: the "Potential up!" card (her
//   trick, Next) before the results, and the summary chip opens it again; the first-gain tip;
//   battle 1-1: Aoi's panel pill P4 and the panel DPS = the sim's; Kage P6's rhythm pips, tempo pips
//   and shuriken per throw; the longest name line fits;
//   a save from an older build (no dupes, 40 history entries, no v3 mark) → its pills, one "Potential
//   grew!" letter with each girl's newest step and how her duplicates were counted, the NEW badge on
//   each P2+ card until her Info tab is opened, a reload keeps one letter and the same Potential.
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
    const ribbons = [...document.querySelectorAll('[data-testid="reveal-potstep"]')];
    const spans = sum ? [...sum.children].filter((c) => getComputedStyle(c).display !== 'none') : [];
    const tops = new Set(spans.map((c) => Math.round(c.getBoundingClientRect().top)));
    return {
      tags: [...document.querySelectorAll('.ma-gc-pot')].map((e) => e.textContent.trim()),
      summary: sum?.textContent.replace(/\s+/g, ' ').trim() || '',
      oneLine: tops.size <= 1,
      kicker: document.querySelector('[data-testid="showcase-kicker"]')?.textContent || null,
      ribbons: ribbons.map((e) => ({ text: e.textContent, title: e.title, fits: e.scrollWidth <= e.clientWidth + 1 || getComputedStyle(e).textOverflow === 'ellipsis' })),
      cards: document.querySelectorAll('[data-testid="pot-up"]').length,
    };
  });
}

async function closeReveal(page) {
  await page.click('[data-testid="reveal-close"]', { force: true }).catch(() => {});
  await page.waitForTimeout(500);
}

const profileOf = (page) => page.evaluate(() => {
  const p = window.__sakura.store.profile;
  return { dupes: Object.fromEntries(Object.entries(p.units).map(([id, u]) => [id, u.dupes])), seenIntro: p.seenIntro, letters: (p.mail?.letters || []).map((l) => l.id), delivered: p.mail?.delivered || [] };
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
        return { text: e.textContent, p6: e.classList.contains('p6'), color: cs.color, title: e.getAttribute('title'), crown: !!e.querySelector('.pot-pill-crown svg') };
      };
      return { aoi: pill('aoi'), kaede: pill('kaede'), rei: pill('rei') };
    });
    check(cards.aoi?.text === 'P4' && !cards.aoi.p6 && cards.aoi.color === 'rgb(255, 255, 255)', `${tag} students: Aoi's card pill "P4" (plum, white text): ${JSON.stringify(cards.aoi)}`);
    check(cards.kaede?.text === 'P6' && cards.kaede.p6 && cards.kaede.color === 'rgb(59, 35, 80)' && cards.kaede.crown, `${tag} students: Kaede's card pill "P6" (sakura, dark plum text, the crown): ${JSON.stringify(cards.kaede)}`);
    check(cards.aoi?.title === 'Potential 4 of 6 — Keen Fletching' && !cards.aoi.crown, `${tag} students: Aoi's pill title names her newest step ("${cards.aoi?.title}")`);
    check(!(await page.$('[data-testid="card-potnew"]')), `${tag} students: no NEW badge on a save made by this build`);
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
    const showPill = await page.evaluate(() => { const e = document.querySelector('[data-testid="show-potential"]'); return { text: e.textContent, title: e.title }; });
    check(showPill.text === 'P4' && showPill.title === 'Potential 4 of 6 — Keen Fletching. Next: P5 unlocks ✦ Twin Fletch (1 more duplicate) — see her Info tab', `${tag} Aoi's page: showcase pill "${showPill.text}" titled "${showPill.title}"`);
    await page.click('[data-testid="show-potential"]');
    await page.waitForSelector('[data-testid="potential-section"]', { timeout: T });
    await page.waitForTimeout(900);
    // measure with the real fonts in (a fallback font is narrower and hides a cut-off cap)
    await page.evaluate(() => document.fonts.ready);
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
        lines: nodes.map((n) => [n?.querySelector('.pot-node-stat')?.textContent || '', n?.querySelector('.pot-node-cap')?.textContent || ''].filter(Boolean).join(' + ')),
        // the cap span sits whole inside its node, and the stat beside it is not cut short
        capsInside: nodes.every((n) => { const c = n?.querySelector('.pot-node-cap'); if (!c) return true; const a = c.getBoundingClientRect(); const b = n.getBoundingClientRect(); return a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && c.scrollWidth <= c.clientWidth + 1; }),
        rule: document.querySelector('.pot-rule.muted')?.textContent,
        kit: nodes.map((n) => !!n?.querySelector('.pot-node-kit')),
        nodeFits: nodes.every((n) => { const l = n?.querySelector('.pot-node-stat'); return !l || l.scrollWidth <= l.clientWidth + 1; }),
        crownNode: !!nodes[5]?.querySelector('.pot-node-crown svg'),
        steps: [2, 3, 4, 5, 6].map((k) => { const e = document.querySelector(`[data-testid="potential-step-${k}"]`); return e ? { cls: e.className, mark: e.querySelector('.pot-step-mark')?.textContent, name: e.querySelector('.pot-step-name')?.textContent, long: e.querySelector('.pot-step-long')?.textContent, crown: !!e.querySelector('.pot-step-crown svg'), cap: e.querySelector('.pot-step-cap')?.textContent || null } : null; }),
        nextTags: [...document.querySelectorAll('[data-testid="potential-next"]')].map((e) => ({ text: e.textContent, step: e.closest('[data-testid^="potential-step-"]')?.dataset.testid })),
        oldSig: !!document.querySelector('[data-testid="potential-signature"]'),
        footer: document.querySelector('[data-testid="potential-footer"]')?.textContent,
        yours: dmgRow ? [...dmgRow.children].map((c) => c.textContent) : null,
      };
    });
    check(sec.tab === 'tab-info' && sec.hash.includes('focus=potential') && sec.inView, `${tag} Aoi's page: the pill opens the Info tab with the Potential section in view (${sec.tab}, ${sec.hash})`);
    check(sec.on.join() === 'true,true,true,true,false,false' && sec.next[4] === true, `${tag} Aoi's page: nodes P1–P4 on, P5 next (${sec.on.join()})`);
    // Potential v3 (docs/specs/POTENTIAL.md v3 §5.2): her node labels and capstone
    check(sec.labels.join('|') === 'Base|+4% DMG|PEN+CRIT|CRIT+6%|TWIN 1/12|HAWK', `${tag} Aoi's page: node labels ${sec.labels.join(' | ')}`);
    check(sec.kit.join() === 'false,false,true,true,true,true' && sec.crownNode, `${tag} Aoi's page: ✦ on her kit nodes (P3–P6), the crown on P6`);
    // the stat line under each node: her R track and her level cap at that P (two spans: the cap
    // wraps under the stat on a narrow node instead of hiding behind an ellipsis)
    const caps = await page.evaluate(async () => { const m = await import('/src/systems/progression.js'); return [1, 2, 3, 4, 5, 6].map((p) => m.potentialLevelCap(p)); });
    const stat = ['', '+4% DMG', '+4% SPD', '+4% DMG', '+4% SPD', '+5% DMG'];
    // (P2 is a stat step: its label is her stat, so its line shows only the cap)
    const wantLines = stat.map((x, i) => [i === 1 ? '' : x, i > 0 && caps[i] > caps[0] ? `Lv ${caps[i]}` : ''].filter(Boolean).join(' + '));
    check(sec.lines.join('|') === wantLines.join('|') && sec.nodeFits && sec.capsInside, `${tag} Aoi's page: the line under each node "${sec.lines.join(' | ')}" (caps ${caps.join('/')}), the cap whole inside its node`);
    check(/Once all 5 breakthrough gates are open, every step also raises her level cap \(up to 85 at P6\)/.test(sec.rule || ''), `${tag} Aoi's page: the rule ties the level cap to the breakthrough gates "${sec.rule}"`);
    check(sec.steps.every(Boolean) && sec.steps.slice(0, 3).every((x) => /\bon\b/.test(x.cls) && x.mark === '✓') && /\bnext\b/.test(sec.steps[3].cls) && /\blater\b/.test(sec.steps[4].cls), `${tag} Aoi's page: steps P2–P4 ✓, P5 next, P6 later`);
    check(sec.nextTags.length === 1 && sec.nextTags[0].text === 'NEXT · 1 more duplicate' && sec.nextTags[0].step === 'potential-step-5', `${tag} Aoi's page: one NEXT tag, on P5 (${JSON.stringify(sec.nextTags)})`);
    check(sec.steps[4].name === '✦ Hawk Companion' && sec.steps[4].crown && /^\+5% damage\. Twin Fletch comes every 10th volley/.test(sec.steps[4].long), `${tag} Aoi's page: the P6 capstone row "${sec.steps[4].name}" with the crown`);
    check(sec.steps[0].name === 'Dawn Practice' && sec.steps[0].long === '+4% damage.', `${tag} Aoi's page: her P2 stat step "${sec.steps[0].name}: ${sec.steps[0].long}"`);
    // (Aoi is at gate 0: each step's cap is what that P opens after her breakthroughs)
    check(sec.steps.every((x, i) => (caps[i + 1] > caps[0] ? x.cap === `Level cap ${caps[i + 1]} after all 5 breakthroughs` : x.cap === null)), `${tag} Aoi's page: each step's level-cap line follows the level rule for a gate-0 girl (${sec.steps.map((x) => x.cap).join(' | ')})`);
    check(!sec.oldSig, `${tag} Aoi's page: the step list replaces v1's signature box`);
    check(sec.footer === 'Duplicates so far: 3 · Next: P5 ✦ Twin Fletch with 1 more duplicate', `${tag} Aoi's page: footer "${sec.footer}"`);
    check(sec.yours?.[1] === '4' && sec.yours?.[2] === '4.33', `${tag} Aoi's page: "Yours" damage per hit = 4 × 1.04 × 1.04 (${sec.yours?.join(' / ')})`);
    check(await noSideScroll(page), `${tag} Aoi's page: no sideways scroll`);
    await shot(page, `student-aoi-potential-${tag}`);
    // an unowned girl still shows her six steps (all locked)
    await go(page, '#/student/raika', '[data-testid="potential-section"]');
    const unowned = await page.evaluate(() => ({ on: document.querySelectorAll('.pot-node.on').length, footer: document.querySelector('[data-testid="potential-footer"]')?.textContent, pill: !!document.querySelector('[data-testid="show-potential"]') }));
    check(unowned.on === 0 && unowned.footer === 'Recruit her to start at P1.' && !unowned.pill, `${tag} Raika (not owned): the section previews her steps, all locked`);
    await go(page, '#/student/kaede?tab=info&focus=potential', '[data-testid="potential-section"]');
    const kae = await page.evaluate(() => ({ footer: document.querySelector('[data-testid="potential-footer"]')?.textContent, on: document.querySelectorAll('.pot-node.on').length, steps: document.querySelectorAll('.pot-step.on').length, next: document.querySelectorAll('[data-testid="potential-next"]').length }));
    check(kae.on === 6 && kae.steps === 5 && kae.next === 0 && /^Potential maxed — duplicates now give Star Fragments \(\+40 each\) and 5 Akashic Tomes/.test(kae.footer), `${tag} Kaede (P6): six nodes and five steps on, no NEXT, "${kae.footer}"`);
    check(await noSideScroll(page), `${tag} Kaede's page: no sideways scroll`);
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
    check(pull.ribbons.length === pull.tags.filter((t) => t !== 'MAX').length && pull.ribbons.every((r) => /^P[2-6] unlocked: /.test(r.title) && r.text.length > 2 && r.fits), `${tag} recruit: a step ribbon under each duplicate that rose (${pull.ribbons.map((r) => r.text).join(', ')})`);
    check(pull.cards === 0, `${tag} recruit: Skip goes straight to the results (no "Potential up!" card)`);
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
    check(meta.kaede === 'P6 → fragments + Tomes' && /she gains \+1 Potential \(up to P6\)/.test(meta.text) && /at P6: 5 Akashic Tomes as well/.test(meta.text), `${tag} spark: grid "${meta.kaede}", text "${meta.text}"`);
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
    check(/Already in your academy\? She gains \+1 Potential \(up to P6\) and 40 Star Fragments \(at P6: also 5 Akashic Tomes\)\./.test(pick), `${tag} select ticket: picker text "${pick}"`);
    // a P6 girl (Kaede): the ticket becomes her past-P6 payout, fragments and Tomes (then cancel)
    await page.click('[data-testid="sst-kaede"]');
    await page.waitForSelector('[data-testid="confirm-cancel"]');
    const confMax = await page.evaluate(() => [...document.querySelectorAll('.modal')].pop()?.textContent.replace(/\s+/g, ' '));
    check(/Kaede is at P6: the ticket becomes 40 Star Fragments and 5 Akashic Tomes\. Use it\?/.test(confMax || ''), `${tag} select ticket: P6 confirm "${confMax?.slice(0, 120)}"`);
    await page.click('[data-testid="confirm-cancel"]');
    await page.waitForTimeout(200);
    await page.click('[data-testid="sst-hotaru"]');
    await page.waitForSelector('[data-testid="confirm-ok"]');
    const conf = await page.evaluate(() => [...document.querySelectorAll('.modal')].pop()?.textContent.replace(/\s+/g, ' '));
    check(/Hotaru is already in your academy: she gains \+1 Potential \(P1 → P2: ✦ Firefly Lamps\) and 40 Star Fragments\. Use it\?/.test(conf) && /Use ticket/.test(conf), `${tag} select ticket: confirm "${conf?.slice(0, 140)}"`);
    await page.click('[data-testid="confirm-ok"]');
    const joined = await page.waitForSelector('[data-testid="sst-joined-text"]').then((e) => e.textContent());
    check(joined === 'Hotaru was already here — Potential 2 ▲ and +40 Star Fragments.', `${tag} select ticket: "${joined}"`);
    const unlocked = await page.evaluate(() => document.querySelector('[data-testid="sst-joined-step"]')?.textContent || '');
    check(/^P2 unlocked: ✦ Firefly Lamps\+5% damage\. On every path, girls within 2\.6 tiles deal \+6% damage/.test(unlocked), `${tag} select ticket: the unlocked step "${unlocked.slice(0, 80)}"`);
    await shot(page, `select-ticket-${tag}`);
    await page.click('[data-testid="sst-ok"]', { force: true });

    // a spark of the P2 Hotaru, played out: the "Potential up!" card before the results (her five
    // breakthrough gates open, so her own cap rises with the step)
    await page.evaluate(() => { const p = window.__sakura.store.profile; p.gacha.recruitPoints = 200; p.units.hotaru.breakthrough = 5; window.__sakura.store.commit('test'); });
    await go(page, '#/recruit', '[data-testid="spark"]');
    await page.click('[data-testid="spark"]');
    await page.waitForSelector('[data-testid="spark-hotaru"]');
    const hoMeta = await page.evaluate(() => document.querySelector('[data-testid="spark-meta-hotaru"]')?.textContent);
    check(hoMeta === 'Owned · P2 → P3 ✦ Firefly Parade', `${tag} spark: grid "${hoMeta}"`);
    await page.click('[data-testid="spark-hotaru"]');
    await page.waitForSelector('.ma-showcase', { timeout: 20000 });
    await page.waitForTimeout(600);
    await page.click('.ma-showcase', { force: true });
    const up = await page.waitForSelector('[data-testid="pot-up-card"]', { timeout: 15000 }).then(() => page.evaluate(() => {
      const c = document.querySelector('[data-testid="pot-up-card"]');
      const r = c.getBoundingClientRect();
      return {
        trick: c.querySelector('[data-testid="pot-up-trick"]')?.textContent, next: c.querySelector('[data-testid="pot-up-next"]')?.textContent,
        cap: c.querySelector('[data-testid="pot-up-cap"]')?.textContent || null,
        who: c.querySelector('.pot-up-who')?.textContent, inView: r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.left >= 0 && r.right <= window.innerWidth + 1,
        closeCovered: (() => { const b = document.querySelector('[data-testid="reveal-close"]'); if (!b) return true; const q = b.getBoundingClientRect(); const top = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return !b.contains(top); })(),
      };
    })).catch(() => null);
    check(up && up.trick === '✦ Firefly Parade' && up.next === 'Next: P4 ✦ Lantern Rite — 1 more duplicate' && /Hotaru · P3/.test(up.who), `${tag} spark played out: "Potential up!" card ${JSON.stringify(up)}`);
    check(up?.inView && up.closeCovered, `${tag} spark: the card fits the screen and sits over the results`);
    check(up?.cap === 'Level cap 63 → 67', `${tag} spark: the "Potential up!" card's level-cap line "${up?.cap}"`);
    await page.waitForTimeout(700); // its fade-in
    await shot(page, `potential-up-${tag}`);
    await page.click('[data-testid="pot-up-go"]');
    await page.waitForTimeout(300);
    const after2 = await page.evaluate(() => ({ cards: document.querySelectorAll('[data-testid="pot-up"]').length, sum: document.querySelector('[data-testid="reveal-sum-pot"]')?.tagName, tricks: document.querySelector('[data-testid="reveal-sum-pot"]')?.textContent }));
    check(after2.cards === 0 && after2.sum === 'BUTTON', `${tag} spark: Done closes the card, the results stay (${JSON.stringify(after2)})`);
    await page.click('[data-testid="reveal-sum-pot"]');
    const reopened = await page.waitForSelector('[data-testid="pot-up-card"]', { timeout: 5000 }).then(() => true).catch(() => false);
    check(reopened, `${tag} spark: the summary's Potential chip opens the card again`);
    await page.click('[data-testid="pot-up-skip"]');
    await page.waitForTimeout(200);
    await closeReveal(page);

    // mall: the Recruit Exchange stock line
    await go(page, '#/mall?tab=recruit', '.ma-offer');
    const stock = await page.evaluate(() => [...document.querySelectorAll('.ma-offer.unit')].map((o) => o.textContent).join(' | '));
    check(/P6 → fragments/.test(stock) && /Owned → P[2-6] ✦ [A-Z][\w' ]+ & fragments/.test(stock), `${tag} mall: Recruit Exchange stock reads "P6 → fragments" / "Owned → P3 ✦ <step> & fragments" (${stock.slice(0, 160)})`);

    // 7. battle 1-1: Aoi's panel, and Kage at P6 (her rhythm, tempo and shuriken rows)
    await page.evaluate(async () => {
      const { store } = window.__sakura;
      const { grantUnit } = await import('/src/systems/unlocks.js');
      const p = store.profile;
      for (let i = 0; i < 6; i++) grantUnit(p, 'kage');
      p.formation = { hero: 'hikari', towers: ['aoi', 'kaede', 'rei', 'kage'] };
      store.commit('test');
    });
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
      for (const id of ['aoi', 'kaede', 'kage']) {
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
    // her rhythm (Twin Fletch) comes at P5: every 12th volley, every 10th from P6; below P5 no row
    const aoiRow = await page.evaluate(() => { const e = document.querySelector('[data-testid="tower-panel"] [data-testid="pot-rhythm"]'); return e ? { name: e.querySelector('b')?.textContent, pips: e.querySelectorAll('.bt-pot-pip').length } : null; });
    check(aoiP >= 5 ? aoiRow?.name === 'Twin Fletch' && aoiRow.pips === (aoiP >= 6 ? 10 : 12) : aoiRow === null, `${tag} battle: Aoi P${aoiP} rhythm row ${JSON.stringify(aoiRow)}`);
    // Kage P6: start the wave and step the battle until she has thrown twice. The battle is paused
    // (the frame loop stops stepping it but keeps painting the panel) and stepped here in game time,
    // so the panel and the sim are read from one state: no real-time wait on software GL
    const thrown = await page.evaluate((uid) => {
      const { sim, ui } = window.__battle;
      ui.paused = true;
      if (sim.state !== 'wave') sim.startNextWave();
      const t = sim.towers.find((x) => x.uid === uid);
      for (let i = 0; i < 60 * 180 && (t.potCount || 0) < 2 && sim.state !== 'won' && sim.state !== 'lost'; i++) {
        if (sim.state !== 'wave') sim.startNextWave();
        sim.update(1 / 60);
      }
      // open her panel now, as a player would mid-wave
      ui.select(null);
      ui.select(uid);
      return t.potCount || 0;
    }, placed.kage);
    check(thrown >= 2, `${tag} battle: Kage threw at least twice within three minutes of game time (${thrown})`);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const kp = await page.evaluate((uid) => {
      const p = document.querySelector('[data-testid="tower-panel"]');
      const row = (k) => { const e = p.querySelector(`[data-testid="pot-${k}"]`); return e ? { name: e.querySelector('b')?.textContent, pips: e.querySelectorAll('.bt-pot-pip').length, on: e.querySelectorAll('.bt-pot-pip.on').length, text: e.querySelector('small')?.textContent, fits: e.scrollWidth <= e.clientWidth + 1 } : null; };
      const t = window.__battle.sim.towers.find((x) => x.uid === uid);
      const nm = p.querySelector('.bt-panel-nm');
      // her Potential rows sit inside the panel's visible scroll area as it opens (not below the paths)
      const sc = p.querySelector('.bt-panel-scroll');
      const pb = p.querySelector('[data-testid="panel-potential"]');
      const sr = sc?.getBoundingClientRect();
      const br = pb?.getBoundingClientRect();
      const potInView = !!(sr && br && br.height > 0 && br.top >= sr.top - 0.5 && br.bottom <= sr.bottom + 0.5 && sc.scrollTop === 0);
      return { rhythm: row('rhythm'), tempo: row('tempo'), shots: row('shots'), count: (t.potCount ?? 0) % 8, stacks: t.tempoStacks || 0, proj: window.__battle.sim.towerStats(uid).projectiles, pill: p.querySelector('[data-testid="panel-pot"]')?.textContent, crown: !!p.querySelector('[data-testid="panel-pot"] .pot-pill-crown svg'), nameFull: nm && nm.scrollWidth <= nm.clientWidth + 1, potInView, potAt: br && sr ? [Math.round(br.top - sr.top), Math.round(br.bottom - sr.top), Math.round(sr.height)] : null };
    }, placed.kage);
    check(kp.potInView, `${tag} battle: Kage's Potential rows are in view when her panel opens (top/bottom/visible ${kp.potAt?.join(' / ')})`);
    check(kp.rhythm?.name === 'Shuriken Storm' && kp.rhythm.pips === 8 && kp.rhythm.text === 'every 8th' && kp.rhythm.on === kp.count, `${tag} battle: Kage's storm pips ${JSON.stringify(kp.rhythm)} (count ${kp.count})`);
    check(kp.tempo?.name === 'Shadow Tempo' && kp.tempo.pips === 6 && kp.tempo.on === kp.stacks && kp.tempo.text === `+${kp.stacks}%`, `${tag} battle: Kage's tempo pips ${JSON.stringify(kp.tempo)} (stacks ${kp.stacks})`);
    check(kp.shots?.name === 'Shuriken' && kp.shots.text === `${kp.proj} → ${+(kp.proj * 1.08).toFixed(2)} / throw`, `${tag} battle: shuriken per throw "${kp.shots?.text}"`);
    check(kp.pill === 'P6' && kp.crown && [kp.rhythm, kp.tempo, kp.shots].every((r) => r?.fits), `${tag} battle: Kage's P6 pill wears the crown, the rows fit the panel`);
    check(kp.nameFull, `${tag} battle: "Kage" is not cut short beside 0-0-0 and the crowned P6 pill`);
    await shot(page, `battle-kage-p6-${tag}`);
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
    await page.evaluate(() => { window.__sakura.store.profile.units.kaede.awaken = 0; window.__battle.ui.paused = false; });

    // 7b. levels above 60 (v3 §4): the cap line, the Potential cap card at gate 5, a level-up past 60 with an Akashic Tome
    const keep = await page.evaluate(() => {
      const { store } = window.__sakura;
      const p = store.profile;
      const pick = (u) => ({ level: u.level, exp: u.exp, breakthrough: u.breakthrough, dupes: u.dupes });
      const k = { aoi: pick(p.units.aoi), kaede: pick(p.units.kaede), tomes: p.items.book_legendary || 0, coins: p.currencies.coins };
      Object.assign(p.units.aoi, { level: 60, exp: 0, breakthrough: 5, dupes: 3 });
      p.items.book_legendary = 2;
      p.currencies.coins = 50000;
      store.commit('test');
      return k;
    });
    await go(page, '#/student/aoi?tab=level', '[data-testid="potential-cap-card"]');
    const lv = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="potential-cap-card"]').getBoundingClientRect();
      return {
        cap: document.querySelector('[data-testid="level-cap"]')?.textContent,
        line: document.querySelector('[data-testid="potential-cap-line"]')?.textContent,
        price: document.querySelector('[data-testid="level-tome-price"]')?.textContent,
        steps: [...document.querySelectorAll('.mb-potcap-steps .mb-gate')].map((e) => `${e.textContent}${e.classList.contains('on') ? '*' : ''}`),
        fits: card.left >= 0 && card.right <= window.innerWidth + 1,
      };
    });
    check(lv.cap === 'Cap 72 · P4 · max 85', `${tag} levels: Aoi P4 at gate 5 "${lv.cap}"`);
    check(lv.line === 'Level cap 72 · Next: 78 at P5 (1 more duplicate)', `${tag} levels: the Potential cap card "${lv.line}"`);
    check(lv.steps.join('|') === 'P1 · 60*|P2 · 63*|P3 · 67*|P4 · 72*|P5 · 78|P6 · 85' && lv.fits, `${tag} levels: the card's six caps ${lv.steps.join(' | ')}`);
    check(lv.price === 'Lv 60 → 61 · 30,000 EXP (1 Akashic Tome) · 12,000 coins', `${tag} levels: the price of a level above 60 "${lv.price}"`);
    await page.evaluate(() => {
      const row = [...document.querySelectorAll('.mb-book')].find((r) => r.querySelector('.mb-book-name')?.textContent === 'Akashic Tome');
      row.querySelectorAll('.mb-step')[1].click();
    });
    await page.waitForTimeout(150);
    const pv = await page.evaluate(() => [...document.querySelectorAll('.mb-pv-line b')].map((b) => b.textContent));
    check(pv[1] === '60 → 61' && pv[2] === '12,000', `${tag} levels: one Tome previews "${pv.join(' / ')}"`);
    await page.click('[data-testid="level-up"]');
    await page.waitForTimeout(400);
    const lvUp = await page.evaluate(() => {
      const p = window.__sakura.store.profile;
      return { level: p.units.aoi.level, tomes: p.items.book_legendary || 0, coins: p.currencies.coins, shadow: p.missions.counters['lv:aoi'], big: document.querySelector('.mb-lv-big b')?.textContent };
    });
    check(lvUp.level === 61 && lvUp.big === '61' && lvUp.tomes === 1 && lvUp.coins === 50000 - 12000 && lvUp.shadow === 61, `${tag} levels: Aoi levels 60 → 61 with one Akashic Tome and 12,000 coins ${JSON.stringify(lvUp)}`);
    check(await noSideScroll(page), `${tag} levels: no sideways scroll`);
    await shot(page, `level-cap-${tag}`);
    await page.evaluate(() => { const { store } = window.__sakura; Object.assign(store.profile.units.kaede, { level: 85, exp: 0, breakthrough: 5 }); store.commit('test'); });
    await go(page, '#/student/kaede?tab=level', '[data-testid="potential-cap-card"]');
    const kc = await page.evaluate(() => ({ cap: document.querySelector('[data-testid="level-cap"]')?.textContent, line: document.querySelector('[data-testid="potential-cap-line"]')?.textContent, exp: document.querySelector('.mb-lv-exp')?.textContent }));
    check(kc.cap === 'Cap 85 · P6 · max 85' && kc.line === 'Level cap 85 · Full Potential' && kc.exp === 'Max level reached', `${tag} levels: Kaede P6 at 85 ${JSON.stringify(kc)}`);
    await shot(page, `level-cap-full-${tag}`);
    await page.evaluate((k) => {
      const { store } = window.__sakura;
      const p = store.profile;
      Object.assign(p.units.aoi, k.aoi);
      Object.assign(p.units.kaede, k.kaede);
      p.items.book_legendary = k.tomes;
      p.currencies.coins = k.coins;
      delete p.missions.counters['lv:aoi'];
      delete p.missions.counters['lv:kaede'];
      store.commit('test');
    }, keep);

    // 8. a save from before Potential: no dupes, 40 history entries, an old createdAt
    const t0 = Date.now() - 30 * 86400000;
    await page.evaluate(([key, t0]) => {
      const { store } = window.__sakura;
      const p = JSON.parse(JSON.stringify(store.profile));
      p.createdAt = t0;
      for (const u of Object.values(p.units)) { delete u.dupes; u.obtainedAt = t0; }
      for (const k of Object.keys(p.missions.counters)) if (k.startsWith('pot:')) delete p.missions.counters[k];
      // (an older build: no v3 mark, no letter yet)
      p.seenIntro = p.seenIntro.filter((s) => s !== 'potential-backfilled' && s !== 'potential-tip' && s !== 'potential-v3' && !s.startsWith('pot3-new:'));
      p.mail.delivered = p.mail.delivered.filter((d) => d !== 'potential-arrived-1' && d !== 'potential-v3-1');
      p.mail.letters = p.mail.letters.filter((l) => l.id !== 'potential-arrived-1' && l.id !== 'potential-v3-1');
      const hist = [];
      const at = (i) => t0 + 3600000 + i * 60000;
      // Aoi 12 (P6), Rei 2 (P3), Yuki 1 (P2), Kaede 1 (P2), and 24 recruits of a girl not owned (Shiro)
      for (let i = 0; i < 12; i++) hist.push({ unitId: 'aoi', rarity: 'R', at: at(i) });
      for (let i = 0; i < 2; i++) hist.push({ unitId: 'rei', rarity: 'R', at: at(20 + i) });
      hist.push({ unitId: 'yuki', rarity: 'R', at: at(30) }, { unitId: 'kaede', rarity: 'SSR', at: at(31) });
      for (let i = 0; i < 24; i++) hist.push({ unitId: 'shiro', rarity: 'SR', at: at(40 + i) });
      p.gacha.history = hist;
      p.gacha.totalPulls = hist.length;
      for (const id of ['momo', 'hotaru', 'shiro', 'kage']) delete p.units[id];
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
    check(mig.letters.filter((id) => id === 'potential-v3-1').length === 1 && !mig.letters.includes('potential-arrived-1'), `${tag} old save: one "Potential grew!" letter (v1's letter is not sent any more)`);
    // (and v1's letter counts as delivered, so an older build's tab never sends it to this backfilled save)
    check(mig.delivered.includes('potential-arrived-1') && mig.delivered.includes('potential-v3-1'), `${tag} old save: v1's letter marked delivered ${JSON.stringify(mig.delivered)}`);
    check(mig.seenIntro.includes('potential-v3') && ['aoi', 'rei', 'yuki', 'kaede'].every((id) => mig.seenIntro.includes(`pot3-new:${id}`)), `${tag} old save: marked for v3, NEW for each girl at P2+`);
    await go(page2, '#/students', '.unit-card[data-unit="aoi"]');
    const migCards = await page2.evaluate(() => Object.fromEntries(['aoi', 'rei', 'yuki', 'kaede'].map((id) => [id, document.querySelector(`.unit-card[data-unit="${id}"] [data-testid="card-pot"]`)?.textContent || null])));
    check(migCards.aoi === 'P6' && migCards.rei === 'P3' && migCards.yuki === 'P2' && migCards.kaede === 'P2', `${tag} old save: cards ${JSON.stringify(migCards)}`);
    const badges = await page2.evaluate(() => Object.fromEntries(['aoi', 'rei', 'yuki', 'kaede', 'hikari'].map((id) => [id, !!document.querySelector(`.unit-card[data-unit="${id}"] [data-testid="card-potnew"]`)])));
    check(badges.aoi && badges.rei && badges.yuki && badges.kaede && !badges.hikari, `${tag} old save: NEW on each P2+ card ${JSON.stringify(badges)}`);
    const bAoi = await rectOf(page2, '.unit-card[data-unit="aoi"] [data-testid="card-potnew"]');
    const cAoi = await rectOf(page2, '.unit-card[data-unit="aoi"]');
    const pAoi = await rectOf(page2, '.unit-card[data-unit="aoi"] [data-testid="card-pot"]');
    check(inside(bAoi, cAoi) && overlap(bAoi, pAoi) === 0, `${tag} old save: the badge sits inside the card, clear of the pill`);
    await shot(page2, `old-save-new-badges-${tag}`);
    // the letter in the mailbox
    await page2.evaluate(async () => (await import('/src/ui/lobby/mailbox.js')).openMailbox());
    const letter = await page2.waitForSelector('[data-testid="mail-potential-v3-1"]', { timeout: 15000 }).then((e) => e.textContent()).catch(() => '');
    check(/Potential grew!/.test(letter) && /Aoi P6 ✦ Hawk Companion, Rei P3 ✦ Third Step/.test(letter) && /we estimated/.test(letter) && /Every step also raises her level cap once all five breakthrough gates are open, up to level 85 at P6; each level above 60 uses one Akashic Tome \(from Library Courtyard III on Nightmare, Freeplay caches \(up to 2 a week\), the Bounty Exchange, and duplicates past P6\)/.test(letter) && /Nothing got weaker/.test(letter) && /Info tab/.test(letter) && !/small passive/.test(letter), `${tag} old save: the letter reads "${letter.replace(/\s+/g, ' ')}"`);
    await page2.click('[data-testid="mail-potential-v3-1"] .mbx-letter-body', { force: true });
    await page2.waitForTimeout(250);
    const full = await page2.evaluate(() => { const b = document.querySelector('[data-testid="mail-potential-v3-1"] .mbx-letter-body'); return b.scrollHeight <= b.clientHeight + 1; });
    check(full, `${tag} old save: a tap shows the whole letter`);
    await shot(page2, `letter-${tag}`);
    await page2.click('[data-testid="mail-close"]', { force: true }).catch(() => {});
    // her Info tab clears her NEW badge (the others keep theirs)
    await go(page2, '#/student/aoi?tab=info', '[data-testid="potential-section"]');
    await go(page2, '#/students', '.unit-card[data-unit="aoi"]');
    const badges2 = await page2.evaluate(() => Object.fromEntries(['aoi', 'rei'].map((id) => [id, !!document.querySelector(`.unit-card[data-unit="${id}"] [data-testid="card-potnew"]`)])));
    check(!badges2.aoi && badges2.rei, `${tag} old save: opening Aoi's Info tab clears her NEW, Rei keeps hers ${JSON.stringify(badges2)}`);
    await page2.evaluate(() => window.__sakura.store.saveNow?.());
    await page2.waitForTimeout(300);
    await load(page2);
    const again = await profileOf(page2);
    check(again.letters.filter((id) => id === 'potential-v3-1').length === 1 && JSON.stringify(again.dupes) === JSON.stringify(mig.dupes) && !again.seenIntro.includes('pot3-new:aoi') && again.seenIntro.includes('pot3-new:rei'), `${tag} reload: still one letter, the same Potential, Aoi's badge stays cleared`);
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
