// UI M5a: the shared hub kit on its own page (e2e/fixtures/m5-kit.html), at 844x390 (touch) and 1280x720 (mouse):
//   1. the probe (e2e/probe.mjs) passes on every rail section and on the hub and chip views
//   2. the left rail: sections ≥ 44 px tall, tab-<id> test ids, the active one an ink slab with yellow text, red dots only
//   3. the countdown chip: "6d 4h", "6d", "11h", "24h", "12:05"; red (--bad-on-plate) under 24 h only on a deadline,
//      never on a recurring reset (urgent: false); at zero the done word alone ("Ended", no label)
//   4. the badge vocabulary: red dot, red number, n/m, In Progress, NEW, yellow dot, navy New, Open!, ink Coming soon
//   5. the host: her width share (26% / 30% on a list, ≤ 35% on a hub), EVERY line of every screen in every state
//      (tests/fixtures/hostStates.js) on one line in her bubble, the bubble clear of the list, a tap shows the next
//      line, no bounce under Reduce motion; the collapse rule's 96 px bust chip
//   6. keyboard hints hidden on touch, shown with a mouse; Space presses the one [data-primary], Esc the back arrow
//   7. the hub view's locked tiles: PvP "Coming soon" (lock, Rival Run inside, no NEW flag), Titan Co-op "Soon"
//
//   node e2e/m5-kit.mjs [--viewport 844x390] [--shots <dir>]
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 on any failure.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';
import { probe, judge, summary } from './probe.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720'];
const shots = opt('shots', null);
if (shots) mkdirSync(shots, { recursive: true });

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${msg}`);
  if (!ok) failures++;
};

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/e2e/fixtures/m5-kit.html`;
const { browser, label } = await launchChromium();
console.log(`browser: ${label}`);

async function open(page, query = '') {
  await page.goto(`${base}${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.body?.dataset.kitReady === '1', null, { timeout: 30000 });
  const err = await page.evaluate(() => document.body.dataset.kitError || '');
  if (err) throw new Error(`kit page: ${err}`);
  // (her stand is an image: on a busy machine a shot taken before it decodes shows the bubble alone)
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(250);
}
const rect = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}, sel);

/**
 * Every line `kind` screens can say (each screen × every state in tests/fixtures/hostStates.js), shown one by one in
 * the page's host bubble: the lines that wrap past one line box. Then the page's own lines (`back`) go back in.
 */
const wrappedLines = (page, kind, back) => page.evaluate(async ([k, [backScreen, backState]]) => {
  const { LINES, linesFor, lineKind } = await import('/src/ui/hostLines.js');
  const { hostStates } = await import('/tests/fixtures/hostStates.js');
  const host = document.querySelector('.ui-host');
  const span = host.querySelector('.ui-host-line');
  const all = new Set();
  for (const screen of Object.keys(LINES)) if (lineKind(screen) === k) for (const s of hostStates(screen)) for (const l of linesFor(screen, s)) all.add(l);
  const out = { count: all.size, wrapped: [], widest: 0 };
  for (const line of all) {
    host.setLines([line]);
    const boxes = span.getClientRects().length;
    out.widest = Math.max(out.widest, Math.round(span.getBoundingClientRect().width));
    if (boxes !== 1) out.wrapped.push(`${line} (${boxes} lines)`);
  }
  host.setLines(linesFor(backScreen, backState));
  out.bubbleW = Math.round(host.querySelector('.ui-host-bubble').getBoundingClientRect().width);
  return out;
}, [kind, back]);

try {
  for (const vp of viewports) {
    const [W, H] = vp.split('x').map(Number);
    const touch = W < 1000;
    console.log(`\n=== ${vp} (${touch ? 'touch' : 'mouse'}) ===`);
    for (const motion of ['reduce', 'no-preference']) {
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1, reducedMotion: motion });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await open(page);

      if (motion === 'reduce') {
        // ---- 1. the probe on every section ----
        for (const s of ['timers', 'badges', 'plates', 'hosts']) {
          await page.click(`[data-testid="tab-${s}"]`);
          await page.waitForTimeout(120);
          const r = await probe(page, { kind: 'list', list: '[data-probe-list]' });
          const fails = judge(r);
          check(fails.length === 0, `probe ${s}: ${summary(r)}${fails.length ? ` → ${fails.join(' | ')}` : ''}`);
          if (shots) await page.screenshot({ path: join(shots, `m5-kit-${s}-${vp}.png`) });
        }
        await page.click('[data-testid="tab-timers"]');
        await page.waitForTimeout(400); // (the rail's colour transition, --t-panel)

        // ---- 2. the rail ----
        const railInfo = await page.evaluate(() => [...document.querySelectorAll('.ui-srail .ui-stab')].map((b) => {
          const r = b.getBoundingClientRect();
          const cs = getComputedStyle(b);
          return { id: b.dataset.testid, h: r.height, w: r.width, on: b.classList.contains('on'), color: cs.color, bg: cs.backgroundColor, dot: !!b.querySelector('.ui-bdg.dot'), count: !!b.querySelector('.ui-bdg.count') };
        }));
        check(railInfo.length === 4 && railInfo.every((t) => /^tab-/.test(t.id)), `rail: 4 sections with tab-<id> ids (${railInfo.map((t) => t.id).join(', ')})`);
        check(railInfo.every((t) => t.h >= 44), `rail: every section ≥ 44 px tall (${railInfo.map((t) => Math.round(t.h)).join(', ')})`);
        const on = railInfo.find((t) => t.on);
        check(on?.id === 'tab-timers' && on.color === 'rgb(255, 221, 74)' && on.bg === 'rgb(14, 25, 48)', `rail: the active section is an ink slab with yellow text (${on?.color} on ${on?.bg})`);
        check(railInfo.filter((t) => !t.on).every((t) => t.color === 'rgb(31, 42, 68)'), 'rail: inactive sections are ink on white glass');
        check(railInfo.some((t) => t.dot) && !railInfo.some((t) => t.count), 'rail: red dots only, never a count');

        // ---- 3. the countdown chips ----
        const cds = await page.evaluate(() => Object.fromEntries(['cd-days', 'cd-day', 'cd-hours', 'cd-urgent', 'cd-minutes', 'cd-done'].map((id) => {
          const el = document.querySelector(`[data-testid="${id}"]`);
          const t = el?.querySelector('.ui-cd-time');
          const lb = el?.querySelector('.ui-cd-lbl');
          return [id, { text: t?.textContent, urgent: el?.classList.contains('urgent'), color: t ? getComputedStyle(t).color : null, label: lb ? getComputedStyle(lb).display !== 'none' : false, aria: el?.getAttribute('aria-label'), visible: el ? el.innerText.replace(/\s+/g, ' ').trim() : '' }];
        })));
        check(cds['cd-days'].text === '6d 4h' && cds['cd-day'].text === '6d' && cds['cd-hours'].text === '11h' && cds['cd-urgent'].text === '24h' && cds['cd-minutes'].text === '12:05',
          `countdown: the long forms read ${Object.values(cds).map((c) => c.text).join(' · ')}`);
        check(!cds['cd-days'].urgent && !cds['cd-day'].urgent && cds['cd-days'].color === 'rgb(255, 255, 255)', 'countdown: a day or more stays white');
        check(cds['cd-urgent'].urgent && cds['cd-minutes'].urgent && cds['cd-urgent'].color === 'rgb(255, 128, 149)', `countdown: a deadline under 24 h turns --bad-on-plate (${cds['cd-urgent'].color})`);
        check(!cds['cd-hours'].urgent && cds['cd-hours'].color === 'rgb(255, 255, 255)', `countdown: a recurring reset under 24 h stays white (urgent: false; ${cds['cd-hours'].color})`);
        check(cds['cd-done'].text === 'Ended' && !cds['cd-done'].label && cds['cd-done'].aria === 'Ended' && cds['cd-done'].visible === 'Ended',
          `countdown: at zero the done word stands alone ("${cds['cd-done'].visible}", aria "${cds['cd-done'].aria}")`);

        // ---- 4. the badges ----
        await page.click('[data-testid="tab-badges"]');
        await page.waitForTimeout(100);
        const bd = await page.evaluate(() => {
          const q = (id) => document.querySelector(`[data-testid="${id}"]`);
          const bg = (id) => (q(id) ? getComputedStyle(q(id)).backgroundColor : null);
          return {
            dot: bg('bdg-dot'), count: q('bdg-count')?.textContent, countBg: bg('bdg-count'), prog: q('bdg-prog')?.textContent,
            inprog: q('bdg-inprog')?.textContent, inprogBg: bg('bdg-inprog'), news: q('bdg-new')?.textContent, ydot: bg('bdg-ydot'),
            newtab: q('bdg-newtab')?.textContent, newtabBg: bg('bdg-newtab'), open: q('bdg-open')?.textContent, openBg: bg('bdg-open'),
            soon: q('bdg-soon')?.textContent, soonBg: bg('bdg-soon'), soonLock: !!q('bdg-soon')?.querySelector('svg'),
          };
        });
        check(bd.dot === 'rgb(212, 24, 59)' && bd.countBg === 'rgb(212, 24, 59)' && bd.count === '3', `badges: red dot and red number "${bd.count}" share the badge red`);
        check(bd.prog === '2/5', `badges: progress reads n/m ("${bd.prog}")`);
        check(bd.inprog === 'In Progress' && bd.inprogBg === 'rgb(255, 122, 168)', 'badges: the pink "In Progress"');
        check(bd.news === 'NEW' && bd.open === 'Open!' && bd.openBg === 'rgb(255, 221, 74)', 'badges: the yellow NEW and Open! stickers');
        check(bd.ydot === 'rgb(255, 221, 74)', 'badges: the yellow dot');
        check(bd.newtab === 'New' && bd.newtabBg === 'rgb(34, 56, 92)', 'badges: the navy New tab');
        check(bd.soon === 'Coming soon' && bd.soonBg === 'rgb(14, 25, 48)' && bd.soonLock, `badges: the ink "Coming soon" sticker with a lock (${bd.soonBg})`);

        // ---- 5. the host ----
        const host = await page.evaluate(() => {
          const el = document.querySelector('.ui-host');
          const b = el.querySelector('.ui-host-bubble');
          return { mode: el.dataset.mode, share: el.getBoundingClientRect().width / innerWidth, line: b.textContent, anim: getComputedStyle(b).animationName };
        });
        const want = touch ? 0.26 : 0.3;
        check(host.mode === 'stand' && Math.abs(host.share - want) < 0.01, `host: a list host stands at ${Math.round(want * 100)}% (${(host.share * 100).toFixed(1)}%)`);
        check(host.line.length > 0 && host.line.length <= 24, `host: a list line of ≤ 24 characters ("${host.line}")`);
        const listWrap = await wrappedLines(page, 'list', ['mail', { gifts: 2 }]);
        check(listWrap.count > 0 && listWrap.wrapped.length === 0, `host: all ${listWrap.count} list-screen lines fit her ${listWrap.bubbleW} px bubble on one line (widest ${listWrap.widest} px)${listWrap.wrapped.length ? ` → wrapped: ${listWrap.wrapped.join(' | ')}` : ''}`);
        const r = await probe(page, { kind: 'list', list: '[data-probe-list]' });
        check(!r.bubbleOverList, 'host: the bubble stays clear of the list');
        await page.click('.ui-host-bubble');
        await page.waitForTimeout(60);
        const next = await page.evaluate(() => ({ line: document.querySelector('.ui-host-bubble').textContent, anim: getComputedStyle(document.querySelector('.ui-host-bubble')).animationName }));
        check(next.line !== host.line && next.line.length <= 24, `host: a tap shows the next line ("${next.line}")`);
        check(next.anim === 'none', `host: no bounce under Reduce motion (animation ${next.anim})`);

        // ---- 6. keyboard hints and keys ----
        const kbd = await page.evaluate(() => [...document.querySelectorAll('.ui-kbd')].map((k) => getComputedStyle(k).display));
        if (touch) check(kbd.length > 0 && kbd.every((d) => d === 'none'), 'keys: the hints are hidden on touch');
        else {
          check(kbd.length > 0 && kbd.every((d) => d !== 'none'), 'keys: the hints show with a mouse');
          await page.evaluate(() => document.activeElement?.blur());
          await page.keyboard.press('Space');
          check(await page.evaluate(() => document.body.dataset.primaryPressed === '1'), 'keys: Space presses the one [data-primary]');
          await page.focus('[data-testid="tab-plates"]');
          await page.keyboard.press('Space');
          check(await page.evaluate(() => document.body.dataset.primaryPressed === '1'), 'keys: Space on a focused button presses that button only');
          await page.evaluate(() => document.activeElement?.blur());
          await page.keyboard.press('Escape');
          check(await page.evaluate(() => document.body.dataset.closed === '1'), 'keys: Esc presses the back arrow');
        }

        // ---- the hub and chip views ----
        await open(page, '?view=hub');
        const hub = await probe(page, { kind: 'hub', list: '[data-probe-list]' });
        const hubFails = judge(hub);
        check(hubFails.length === 0 && hub.hostShare <= 0.355, `hub view: ${summary(hub)}${hubFails.length ? ` → ${hubFails.join(' | ')}` : ''}`);
        if (shots) await page.screenshot({ path: join(shots, `m5-kit-hub-${vp}.png`) });
        // ---- 7. the locked tiles (owner #108) ----
        const locked = await page.evaluate(() => {
          const tile = (id) => {
            const el = document.querySelector(`[data-testid="${id}"]`);
            if (!el) return null;
            const soon = el.querySelector('.ui-bdg.soon');
            // one lock, the sticker's (UI M5d review 2: a second one in the corner ran under a long sticker)
            const locks = [...el.querySelectorAll('.ui-ico')].filter((x) => !x.closest('.ui-ltile-art'));
            const lock = locks.length === 1 && !!soon?.contains(locks[0]) && !!locks[0].querySelector('svg');
            return { soon: soon?.textContent, lock, locks: locks.length, line: el.querySelector('.ui-ltile-line')?.textContent || '', newFlag: !!el.querySelector('.ui-bdg.newtab, .ui-bdg.new'), opacity: getComputedStyle(el).opacity };
          };
          return { pvp: tile('kit-pvp'), titan: tile('kit-titan-coop'), anyNewFlag: !!document.querySelector('.kit-tiles .ui-bdg.newtab') };
        });
        check(locked.pvp?.soon === 'Coming soon' && locked.pvp.lock && locked.pvp.line === 'Rival Run inside' && !locked.pvp.newFlag && locked.pvp.opacity === '1',
          `hub view: PvP is locked "Coming soon" with Rival Run inside, one lock (the sticker's), no fade (${JSON.stringify(locked.pvp)})`);
        check(locked.titan?.soon === 'Soon' && locked.titan.lock && !locked.anyNewFlag, `hub view: Titan Co-op wears "Soon" with one lock (the sticker's); no tile wears a NEW flag (${JSON.stringify(locked.titan)})`);
        const hubWrap = await wrappedLines(page, 'hub', ['multiplayer', { invites: 1 }]);
        check(hubWrap.count > 0 && hubWrap.wrapped.length === 0, `host: all ${hubWrap.count} hub-screen lines fit her ${hubWrap.bubbleW} px bubble on one line (widest ${hubWrap.widest} px)${hubWrap.wrapped.length ? ` → wrapped: ${hubWrap.wrapped.join(' | ')}` : ''}`);
        await open(page, '?view=chip');
        const chip = await page.evaluate(() => {
          const el = document.querySelector('.ui-host');
          const bust = el.querySelector('.ui-host-bust').getBoundingClientRect();
          return { mode: el.dataset.mode, bust: [Math.round(bust.width), Math.round(bust.height)] };
        });
        const chipProbe = await probe(page, { kind: 'list', list: '[data-probe-list]' });
        const chipFails = judge(chipProbe, { skip: ['host'] });
        check(chip.mode === 'chip' && chip.bust[0] === 96 && chip.bust[1] === 96, `chip view: the 96 px bust chip (${chip.bust.join('x')})`);
        check(chipFails.length === 0 && !chipProbe.bubbleOverList, `chip view: ${summary(chipProbe)}${chipFails.length ? ` → ${chipFails.join(' | ')}` : ''}`);
        if (shots) await page.screenshot({ path: join(shots, `m5-kit-chip-${vp}.png`) });
      } else {
        // with motion on, a new line pops (and the rest above holds without it)
        await page.click('.ui-host-bubble');
        await page.waitForTimeout(30);
        const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.ui-host-bubble')).animationName);
        check(anim === 'ui-bubble-pop', `host: the line pops with motion on (${anim})`);
      }
      check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
      await ctx.close();
    }
  }
} catch (e) {
  failures++;
  console.log(`  FAIL ${e.stack || e.message}`);
} finally {
  await browser.close();
  await server.close();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
