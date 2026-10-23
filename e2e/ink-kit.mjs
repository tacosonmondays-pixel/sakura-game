// [ui-ink] The UI v2 "Ink & Paper" kit on its own page (e2e/fixtures/ink-kit.html: the approved specimen's boards built
// from the repo's src/ui/styles/ink.css and src/ui/lineGlyphs.js), at 844x390 (touch) and 1280x720 (mouse):
//   1. the page builds (no kit error), every glyph it names exists, and no text is under 12 px
//   2. S4: the folder-tab junction probe on the five panels (each tab active in turn): no navy wedge (e2e/pixels.mjs)
//   3. S3: the one ring runs on along both chamfers (the chamfer-pair panel) and the single cut (a chip)
//   4. medium 3: a selected gear tile and a selected item tile keep their rarity frame and carry the pink check chip and
//      a 3 px pink bottom bar; the Mythic tiles beside them carry neither (on the DOM and on the pixels)
//   5. the girl tiles: the caption's rarity tag ≥ 3 px from the innermost frame line, each tile's own face band clear
//   6. the probe (e2e/probe.mjs) in v2 mode: pink only with a reason, every control on top at its centre; the tap
//      report prints the number it asserts
//
//   node e2e/ink-kit.mjs [--viewport 844x390] [--out <dir>]   # --out: full-page shots for the specimen compare + 3x crops
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 on any failure.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';
import { probe, summaryV2 } from './probe.mjs';
import { tabJunction, ringContinuity, tagToFrame, faceBand } from './pixels.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720'];
const out = opt('out', null);
if (out) mkdirSync(join(out, 'zoom'), { recursive: true });

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${msg}`);
  if (!ok) failures++;
};
const report = (name, r) => {
  const bad = r.checks.filter((c) => !c.ok);
  check(bad.length === 0 && r.checks.length > 0, `${name}: ${r.checks.length - bad.length}/${r.checks.length} pixel checks${bad.length ? ` (${bad.slice(0, 4).map((c) => c.msg).join(' | ')})` : ''}`);
};

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/e2e/fixtures/ink-kit.html`;
const { browser, label } = await launchChromium();
console.log(`browser: ${label}`);

try {
  for (const vp of viewports) {
    const [W, H] = vp.split('x').map(Number);
    const touch = W < 1000;
    console.log(`\n=== ${vp} ===`);
    for (const dsf of [1, 3]) {
      const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dsf, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => document.body?.dataset.kitReady === '1', null, { timeout: 60000 });
      const kitError = await page.evaluate(() => document.body.dataset.kitError || '');
      if (dsf === 1) {
        check(!kitError, `the kit page builds${kitError ? `: ${kitError}` : ''}`);
        if (kitError) { await context.close(); continue; }
        const left = await page.evaluate(() => document.querySelectorAll('i[data-g], i[data-emblem]').length);
        check(left === 0, `every glyph the page names exists in lineGlyphs.js (${left} left unhydrated)`);
        const small = await page.evaluate(() => {
          const o = [];
          for (const el of document.querySelectorAll('body *')) {
            if (el.closest('[aria-hidden="true"], svg, .cap-h')) continue;
            if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            const fs = parseFloat(getComputedStyle(el).fontSize);
            if (fs < 12) o.push(`${fs}px "${el.textContent.trim().slice(0, 30)}"`);
          }
          return o;
        });
        check(small.length === 0, `no text under 12 px${small.length ? `: ${small.slice(0, 6).join(', ')}` : ''}`);
        // medium 3 on the DOM: the frame stays, the chip and the bar are there, the Mythic tile has neither
        const m3 = await page.evaluate(() => {
          const pinkInk = 'rgb(210, 58, 116)';
          const one = (sel) => {
            const t = document.querySelector(sel);
            if (!t) return null;
            const cs = getComputedStyle(t);
            const chip = t.querySelector(':scope > .ui-pick');
            const bar = t.querySelector(':scope > .ui-pickbar');
            return {
              border: cs.borderBottomColor, borderW: parseFloat(cs.borderBottomWidth), selected: t.classList.contains('selected') || t.classList.contains('sel'),
              chip: chip ? getComputedStyle(chip).backgroundColor : null, bar: bar ? { bg: getComputedStyle(bar).backgroundColor, h: bar.getBoundingClientRect().height } : null,
              pinkInk,
            };
          };
          return { sel: one('[data-testid="kit-gear-selected"]'), myth: one('[data-testid="kit-gear-mythic"]'), item: one('[data-testid="kit-item-selected"]') };
        });
        const pink = 'rgb(210, 58, 116)';
        check(m3.sel && m3.sel.selected && m3.sel.border !== pink && m3.sel.borderW >= 2, `medium 3: the selected gear tile keeps its rarity frame (${m3.sel?.border}, ${m3.sel?.borderW}px), never a pink ring`);
        check(m3.sel?.chip === pink, `medium 3: the selected gear tile carries the pink check chip (${m3.sel?.chip})`);
        check(m3.sel?.bar?.bg === pink && Math.abs((m3.sel?.bar?.h || 0) - 3) < 0.6, `medium 3: the selected gear tile has the 3 px pink bottom bar (${m3.sel?.bar?.bg}, ${m3.sel?.bar?.h}px)`);
        check(m3.myth && !m3.myth.chip && !m3.myth.bar && !m3.myth.selected, 'medium 3: the Mythic gear tile beside it has no check chip and no bar');
        check(m3.item?.chip === pink && m3.item?.bar?.bg === pink, `medium 3: the selected item tile carries the chip and the bar (${m3.item?.chip}, ${m3.item?.bar?.bg})`);
        // the probe in v2 mode on the first screenful
        const r = await probe(page, { kind: 'list', v2: true, root: 'body' });
        console.log(`    probe: ${summaryV2(r.v2)}`);
        check(r.v2.pinkStrayCount === 0, `pink only with a reason (${r.v2.pinkStrayCount}: ${r.v2.pinkStray.slice(0, 3).join('; ')})`);
        check(typeof r.v2.tapMinText === 'string' && Number(r.v2.tapMinText) === r.v2.tapMin, `the tap report prints the number it judges (${r.v2.tapMinText} = ${r.v2.tapMin})`);
        if (out) {
          await page.screenshot({ path: join(out, `ink-kit-${vp}.png`), fullPage: true });
          console.log(`    saved ${join(out, `ink-kit-${vp}.png`)}`);
        }
      } else {
        if (kitError) { await context.close(); continue; }
        // pixels at 3x: the probes scroll their surfaces into view one by one
        const each = async (sel, fn) => {
          const n = await page.evaluate((s) => document.querySelectorAll(s).length, sel);
          const all = { checks: [], fails: 0 };
          for (let i = 0; i < n; i++) {
            await page.evaluate(([s, k]) => document.querySelectorAll(s)[k].scrollIntoView({ block: 'center' }), [sel, i]);
            await page.evaluate(([s, k]) => document.querySelectorAll(s).forEach((e, j) => e.classList.toggle('px-on', j === k)), [sel, i]);
            const r = await fn(`${sel}.px-on`);
            all.checks.push(...r.checks);
            all.fails += r.fails;
          }
          return all;
        };
        report('S4 folder tabs (5 positions)', await each('.ui-tabbed.tprobe', (s) => tabJunction(page, s)));
        report('S3 chamfer-pair ring', await each('.ui-panel.cprobe', (s) => ringContinuity(page, s, { shape: 'pair' })));
        report('S3 single-cut ring (chip)', await each('.ui-chip.rprobe', (s) => ringContinuity(page, s, { shape: 'cut' })));
        await page.evaluate(() => document.querySelector('.ui-girltile')?.scrollIntoView({ block: 'center' }));
        report('girl tiles: rarity tag to frame (≥ 3 px)', await tagToFrame(page, '.ui-girltile', '.cap .ui-rar'));
        report('girl tiles: each tile\'s own face band', await faceBand(page, '.ui-girltile[data-face-top]', { ui: ':scope > .st, :scope > .role, :scope > .cap, :scope > .tr' }));
        // medium 3 on the pixels: the selected tile's bottom inner rows are pink, the Mythic one's are not
        await page.evaluate(() => document.querySelector('[data-testid="kit-gear-selected"]')?.scrollIntoView({ block: 'center' }));
        const bars = await page.evaluate(() => ['kit-gear-selected', 'kit-gear-mythic'].map((id) => {
          const t = document.querySelector(`[data-testid="${id}"]`);
          const r = t.getBoundingClientRect();
          const bw = parseFloat(getComputedStyle(t).borderBottomWidth) || 0;
          return { id, x: r.left + r.width / 2, y: r.bottom - bw - 1.5 };
        }));
        const shot = await page.screenshot({ type: 'png' });
        const px = await page.evaluate(async ({ b64, pts }) => {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          const cv = new OffscreenCanvas(bmp.width, bmp.height);
          const cx = cv.getContext('2d');
          cx.drawImage(bmp, 0, 0);
          const k = bmp.width / innerWidth;
          return pts.map((p) => [...cx.getImageData(Math.round(p.x * k), Math.round(p.y * k), 1, 1).data].slice(0, 3));
        }, { b64: shot.toString('base64'), pts: bars });
        const isPinkInk = (c) => Math.abs(c[0] - 210) < 14 && Math.abs(c[1] - 58) < 14 && Math.abs(c[2] - 116) < 14;
        check(isPinkInk(px[0]) && !isPinkInk(px[1]), `medium 3 (pixels): the selected tile's bottom bar is pink (${px[0]}) and the Mythic tile's is not (${px[1]})`);
        if (out) {
          // the reviewers' 3x crops: every tab position and the medium 3 pair
          for (let i = 0; i < 5; i++) {
            const box = await page.evaluate((k) => { const e = document.querySelectorAll('.ui-tabbed.tprobe')[k]; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: Math.min(r.height, 70) }; }, i);
            await page.screenshot({ path: join(out, 'zoom', `ink-kit-tabs-${i + 1}-${vp}@3x.png`), clip: box });
          }
          const pair = await page.evaluate(() => { const a = document.querySelector('[data-testid="kit-gear-selected"]'); a.scrollIntoView({ block: 'center' }); const r = a.getBoundingClientRect(); return { x: r.left - 90, y: r.top - 14, width: r.width * 2 + 120, height: r.height + 28 }; });
          await page.screenshot({ path: join(out, 'zoom', `ink-kit-medium3-${vp}@3x.png`), clip: pair });
          const it = await page.evaluate(() => { const a = document.querySelector('[data-testid="kit-item-selected"]'); a.scrollIntoView({ block: 'center' }); const r = a.getBoundingClientRect(); return { x: r.left - 80, y: r.top - 12, width: r.width + 100, height: r.height + 24 }; });
          await page.screenshot({ path: join(out, 'zoom', `ink-kit-item-selected-${vp}@3x.png`), clip: it });
        }
      }
      check(errors.length === 0, `no page errors at dsf ${dsf}${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(failures ? `\n${failures} INK KIT CHECK(S) FAILED` : '\nALL INK KIT CHECKS PASSED');
process.exit(failures ? 1 : 0);
