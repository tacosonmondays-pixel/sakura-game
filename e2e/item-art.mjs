// Item art check: the baked 3D-flat item icons (public/art/items, src/art/itemArt.js) and the slanted item tile on
// every screen that shows items: the lobby pills, the mailbox, the backpack (every tab) and its item detail, the
// rewards pop-up, the login calendar and the income overview, the achievements list with an expanded tier ladder
// (its 14 px reward icons), every Mall tab, the Halloween exchange and operations, stage prep drops, the recruit
// page and a 10-pull's results, and (dev) a slow first open of the backpack with every item image held back. The save
// is seeded the same way every run (every item at a spread of counts, a fixed clock), so a run on the old build and
// one on the new build differ only where the builds differ: use it for before/after screenshots.
//
//   node e2e/item-art.mjs --out /tmp/items-after --expect-art     # both viewports, checks on, PNGs per screen
//   node e2e/item-art.mjs --out /tmp/items-before                 # the old build: screenshots only
//   node e2e/item-art.mjs --out /tmp/x --viewport 844x390 --dpr 2  # one viewport at device pixel ratio 2
//   node e2e/item-art.mjs --out /tmp/x --prod --expect-art         # the production build in dist/ (deploy base)
//
// With --expect-art it fails (exit 1) when an item icon on screen is not the baked image (missing, broken, or the
// drawn fallback), when a tile count is not the short tile form (x2400, x42.3K, x450K), when the old drawing shows
// anywhere but on a failed image (a slow load shows the neutral placeholder), or on page errors.
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server.
import { createServer, preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const out = opt('out', 'item-art-shots');
const viewports = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720'];
const dpr = Number(opt('dpr', '1'));
const expectArt = args.includes('--expect-art');
mkdirSync(out, { recursive: true });

const DAY = '2026-10-22T18:00:00Z'; // the Halloween event is open, the beta gift is still in the mailbox
const COUNTS = [1, 3, 12, 99, 640, 2400, 42350, 450000, 1250000];
const SQUAD = ['aoi', 'rei', 'yuki', 'momo', 'akane', 'sango', 'kage', 'chika'];

// --prod: the production build in dist/ (run `npx vite build` first), which loads the art through the deploy base
// ('./'); the dev clock is off there, so the screens use today's date. The local online adapter is forced, as in
// e2e/smoke.mjs, so a run never signs test players into the live project.
const prod = args.includes('--prod');
let server;
if (prod) {
  server = await preview({ root: process.cwd(), preview: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
} else {
  server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
}
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const entry = `${base}?onboarding=0${prod ? '&online=local' : ''}#/lobby`;
const { browser, label } = await launchChromium();
console.log(`browser: ${label}${expectArt ? ' (checks on)' : ''}`);

const failures = [];
const report = {};
function check(cond, msg) {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}

const { ITEM_IDS } = await import('../src/data/items.js');

/** Every item at a spread of counts, chapter 1 cleared (the event unlock), a squad (dev only), fixed currencies. */
async function seed(page, counts) {
  await page.evaluate(async ([ids, counts, squad, dev]) => {
    const { store } = window.__sakura;
    const p = store.profile;
    ids.forEach((id, i) => { p.items[id] = counts[i % counts.length]; });
    for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5']) p.progress.stages[id] = { easy: true, normal: true, hard: false, nightmare: false, clears: 1 };
    if (dev) {
      const unlocks = await import('/src/systems/unlocks.js');
      for (const id of ['hikari', ...squad]) if (!p.units[id]) unlocks.grantUnit(p, id, 1760000000000);
      p.formation = { hero: 'hikari', towers: [...squad] };
    }
    Object.assign(p.currencies, { coins: 284650, gems: 16570 });
    Object.assign(p.settings, { autoStart: false });
    store.commit('e2e');
    store.saveNow?.();
  }, [ITEM_IDS, counts, SQUAD, !prod]);
}

const settle = (page, ms = 700) => page.waitForTimeout(ms)
  .then(() => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250))))));
const closeModals = (page) => page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));

/** A fresh save on the fixed clock, the beta gift put off, then seeded. */
async function boot(page) {
  await page.goto(entry, { waitUntil: 'load' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('sakura-dev-now', t); }, DAY);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 30000 });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 10000 }).catch(() => null);
  if (later) await later.click({ force: true });
  await seed(page, COUNTS);
}

/** Opens a route and waits until its screen is up and settled. */
async function goTo(page, hash, screenId) {
  await page.evaluate((hh) => { location.hash = hh; }, hash);
  await page.waitForFunction((id) => document.querySelector('#app')?.dataset.screen === id, screenId, { timeout: 30000 });
  await closeModals(page);
  await settle(page);
}

/** Waits (up to 8 s) until every item image inside the viewport has loaded or failed. */
async function waitArt(page) {
  await page.waitForFunction(() => {
    const vw = innerWidth;
    const vh = innerHeight;
    return [...document.querySelectorAll('img.item-art')].every((img) => {
      const r = img.getBoundingClientRect();
      const inView = r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
      return !inView || img.complete;
    });
  }, null, { timeout: 8000, polling: 100 }).catch(() => {});
}

/** What the screen shows: item icons in view (baked / broken / drawn), tiles, counts. */
function inspect(page) {
  return page.evaluate(() => {
    const vw = innerWidth;
    const vh = innerHeight;
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw)) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const boxes = [...document.querySelectorAll('.ia')].filter(visible);
    const imgs = boxes.map((b) => b.querySelector('img.item-art')).filter(Boolean);
    const broken = imgs.filter((i) => i.complete && !i.naturalWidth).map((i) => i.dataset.art);
    const pending = imgs.filter((i) => !i.complete).map((i) => i.dataset.art);
    const drawn = boxes.filter((b) => b.classList.contains('bad') || !b.querySelector('img.item-art')).map((b) => b.dataset.art || '?');
    const tiles = [...document.querySelectorAll('.item-tile')].filter(visible);
    const bare = tiles.filter((t) => !t.querySelector('.ia img.item-art')).map((t) => t.dataset.item || t.className);
    const counts = [...document.querySelectorAll('.item-tile .item-count')].filter(visible).map((c) => c.textContent);
    const badCounts = counts.filter((c) => !/^x\d+(\.\d)?[KMB]?$/.test(c));
    const ratio = tiles.length ? tiles[0].getBoundingClientRect().width / tiles[0].getBoundingClientRect().height : null;
    const svgItems = [...document.querySelectorAll('.item-tile-icon > svg')].filter(visible).length;
    const srcs = imgs.filter((i) => i.complete && i.naturalWidth).map((i) => i.currentSrc);
    return { srcs: [...new Set(srcs.map((s) => s.replace(/[^/]*$/, '')))], icons: boxes.length, loaded: imgs.length - broken.length - pending.length, broken, pending, drawn, tiles: tiles.length, bare, counts: counts.slice(0, 12), badCounts, ratio, svgItems };
  });
}

for (const vp of viewports) {
  const [W, H] = vp.split('x').map(Number);
  const touch = W < 1000;
  const pageOpts = { viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce', deviceScaleFactor: dpr };
  const page = await browser.newPage(pageOpts);
  const errors = [];
  const watch = (pg) => {
    pg.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
    pg.on('console', (m) => { if (m.type() === 'error' && !/GPU stall|WebGL|favicon|net::ERR_(CERT|NAME|INTERNET|PROXY|TUNNEL|CONNECTION)/i.test(m.text())) errors.push(`[console] ${m.text()}`); });
    pg.on('response', (r) => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url()}`); });
  };
  watch(page);
  const tag = dpr === 1 ? vp : `${vp}@${dpr}x`;
  console.log(`viewport ${tag}`);

  const shot = async (name, { full = false } = {}) => {
    await waitArt(page);
    await settle(page, 250);
    const file = join(out, `${name}-${tag}.png`);
    await page.screenshot({ path: file, fullPage: full }).catch((e) => console.log(`  (screenshot ${name} skipped: ${e.message.split('\n')[0]})`));
    const info = await inspect(page);
    report[`${name}-${tag}`] = info;
    console.log(`  ${name}: ${info.icons} icons (${info.loaded} baked), ${info.tiles} tiles, counts ${JSON.stringify(info.counts.slice(0, 6))}  -> ${file}`);
    if (expectArt) {
      check(!info.broken.length && !info.drawn.length && !info.pending.length, `${tag} ${name}: every item icon in view is the baked image${info.broken.length + info.drawn.length + info.pending.length ? ` (broken ${info.broken}, drawn ${info.drawn}, pending ${info.pending})` : ''}`);
      check(!info.bare.length && !info.svgItems, `${tag} ${name}: every item tile shows baked art${info.bare.length ? ` (${info.bare.slice(0, 5)})` : ''}`);
      check(!info.badCounts.length, `${tag} ${name}: tile counts use the short tile form${info.badCounts.length ? ` (${info.badCounts.slice(0, 5)})` : ''}`);
      if (info.ratio) check(Math.abs(info.ratio - 1.09) < 0.03, `${tag} ${name}: item tiles are the 1.09:1 plate (${info.ratio.toFixed(3)})`);
      check(info.srcs.every((s) => s === `${base}art/items/`), `${tag} ${name}: the art loads from the deploy base (${info.srcs.join(', ') || 'no images'})`);
      const errs = errors.splice(0);
      check(!errs.length, `${tag} ${name}: no page errors${errs.length ? ` (${errs.slice(0, 3).join(' | ')})` : ''}`);
    } else {
      errors.splice(0);
    }
  };

  const go = (hash, screenId) => goTo(page, hash, screenId);

  try {
    await boot(page);

    // lobby: the ticket / coin / gem pills (small cuts)
    await go('#/backpack', 'backpack');
    await go('#/lobby', 'lobby');
    await shot('lobby');

    // mailbox: the beta gift letter's reward tiles
    const mail = await page.$('[data-testid="top-mail"]');
    if (mail) {
      await mail.click();
      await page.waitForSelector('.mbx-modal', { timeout: 8000 }).catch(() => null);
      await settle(page);
      await shot('mail');
      await closeModals(page);
    }

    // backpack: the item grid, the first tile's detail, every tab (equipment shows the gear art)
    await go('#/backpack?tab=all', 'backpack');
    await shot('backpack');
    await page.evaluate(() => { const g = document.querySelector('#app .mb-item-grid'); g?.scrollIntoView({ block: 'start' }); });
    const first = await page.$('#app .mb-item-grid .item-tile');
    if (first) {
      await first.click();
      await settle(page);
      await shot('item-info');
      await closeModals(page);
    }
    const tabs = await page.evaluate(() => [...document.querySelectorAll('#app .mb-tab')].map((t) => t.dataset.testid?.replace(/^tab-/, '')).filter((t) => t && t !== 'all'));
    for (const t of tabs) {
      await go(`#/backpack?tab=${t}`, 'backpack');
      await shot(`backpack-${t}`);
    }

    // rewards: the shared rewards pop-up (dev: opened straight from its module), the login calendar, the income
    // overview's icons
    if (!prod) {
      await page.evaluate(async () => {
        const { showRewardsModal } = await import('/src/ui/screens/stage.js');
        showRewardsModal({ title: 'Rewards', rewards: [
          { id: 'gems', count: 300 }, { id: 'coins', count: 450000 }, { id: 'ticket_recruit', count: 10 }, { id: 'book_superRare', count: 3 },
          { id: 'mat_rime_legendary', count: 1 }, { id: 'gearbox_mythic', count: 2 }, { id: 'crown_rainbow', count: 1 }, { id: 'mat_cog_zenith', count: 42350 },
        ] });
      });
      await settle(page);
      await shot('rewards-popup');
      await closeModals(page);
    }
    await go('#/commissions?tab=login', 'commissions');
    await shot('rewards-calendar');
    await go('#/rewards', 'rewards');
    await page.evaluate(() => document.querySelector('#app .ma-stat')?.scrollIntoView({ block: 'center' }));
    await shot('rewards-income');

    // achievements: the list's reward tiles and an expanded tier ladder, whose 14 px gem and gear-box icons must be
    // the baked art in a 14 px .ia box (the small cut for gems), never a drawing pulled out of a tile
    await go('#/commissions?tab=achievements', 'commissions');
    await page.waitForSelector('[data-testid="ach-tab"]', { timeout: 8000 }).catch(() => null);
    if (!(await page.$('#app .ach-ladder'))) {
      await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#app .ach-rowwrap')];
        const withGems = rows.find((r) => r.querySelector('.ach-series') && r.querySelector('.ach-rewards [data-item="gems"]'));
        (withGems || rows.find((r) => r.querySelector('.ach-series')))?.querySelector('.ach-series')?.click();
      });
      await settle(page, 300);
    }
    await page.evaluate(() => document.querySelector('#app .ach-ladder')?.scrollIntoView({ block: 'center' }));
    await shot('achievements-ladder');
    const lad = await page.evaluate(() => [...document.querySelectorAll('#app .ach-ladder .ach-step-ico')].map((s) => {
      const r = s.getBoundingClientRect();
      const ia = s.querySelector(':scope > .ia');
      const img = ia?.querySelector('img.item-art');
      const ir = ia?.getBoundingClientRect();
      return {
        art: ia?.dataset.art || null,
        baked: !!img && img.complete && img.naturalWidth > 0,
        bareSvg: !!s.querySelector(':scope > svg'),
        drawnVisible: !!ia && getComputedStyle(ia.querySelector('svg')).visibility === 'visible',
        box: [Math.round(r.width), Math.round(r.height)],
        ia: ir ? [Math.round(ir.width), Math.round(ir.height)] : null,
        small: !!img && /-small\.webp/.test(img.currentSrc),
      };
    }));
    report[`achievements-ladder-icons-${tag}`] = lad;
    console.log(`  ladder icons: ${lad.length} (${lad.filter((x) => x.baked).length} baked, ${lad.filter((x) => x.bareSvg).length} bare drawings)`);
    if (expectArt) {
      const bad = lad.filter((x) => !x.art || !x.baked || x.bareSvg || x.drawnVisible);
      check(lad.length > 0 && !bad.length, `${tag} achievements: every tier-ladder reward icon is the baked art (${lad.length} icons${bad.length ? `, bad ${JSON.stringify(bad.slice(0, 3))}` : ''})`);
      const off = lad.filter((x) => !x.ia || x.box[0] !== 14 || x.box[1] !== 14 || x.ia[0] !== 14 || x.ia[1] !== 14);
      check(lad.length > 0 && !off.length, `${tag} achievements: .ach-step-ico sizes its .ia box to 14 x 14 px${off.length ? ` (${JSON.stringify(off.slice(0, 3))})` : ''}`);
      const gems = lad.filter((x) => x.art === 'gems');
      if (gems.length) check(gems.every((x) => x.small), `${tag} achievements: the ladder's gem icons use the small cut (${gems.length} gems)`);
    }

    // the Mall: every tab (prod: the tabs the shop shows today)
    const mallTabs = prod
      ? ['general', 'gems', 'recruit', 'boss', 'bounty', 'memento']
      : await page.evaluate(async () => (await import('/src/systems/shop.js')).shopTabs(window.__sakura.store.profile).map((t) => t.id));
    for (const t of mallTabs) {
      await go(`#/mall?tab=${t}`, 'mall');
      await shot(`mall-${t}`);
    }

    // events: the Halloween exchange and operations (the candy icon)
    await go('#/event/halloween-2026?tab=exchange', 'event');
    await shot('event-exchange');
    await go('#/event/halloween-2026?tab=stages', 'event');
    await shot('event-stages');

    // stage prep: first-clear and repeat drops
    await go('#/stage/1-2', 'stage');
    await page.evaluate(() => document.querySelector('#app .ma-drops')?.scrollIntoView({ block: 'center' }));
    await shot('stage-drops');

    // recruit: the page (tickets, spark points) and a 10-pull's results (Essence, mementos)
    await go('#/recruit', 'recruit');
    await shot('recruit');
    const pull = await page.$('[data-testid="pull-10"]');
    if (pull) {
      await pull.click();
      const confirm = await page.waitForSelector('[data-testid="confirm-pull"]', { timeout: 2000 }).catch(() => null);
      if (confirm) await confirm.click();
      const skip = await page.waitForSelector('[data-testid="reveal-skip"]', { timeout: 6000 }).catch(() => null);
      if (skip) await skip.click().catch(() => {});
      await page.waitForSelector('[data-testid="reveal-close"]', { timeout: 20000 }).catch(() => null);
      const potSkip = await page.$('[data-testid="pot-up-skip"]');
      if (potSkip) await potSkip.click({ force: true }).catch(() => {});
      await settle(page, 1200);
      await shot('recruit-results');
    }

    // the fallbacks: a broken image shows the old drawing at once (the only case it ever shows); a slow one shows
    // the neutral placeholder after 0.3 s, never the drawing, and drops it when the image arrives; a cached one
    // shows neither (dev: builds the icons from the module)
    if (expectArt && !prod) {
      let release;
      const held = new Promise((r) => { release = r; });
      await page.route('**/art/items/slow-*.webp*', async (route) => { await held; await route.continue({ url: route.request().url().replace('/slow-', '/gems-') }); });
      const fb = await page.evaluate(async () => {
        const { itemIcon } = await import('/src/art/icons.js');
        const vis = (box) => getComputedStyle(box.querySelector('svg')).visibility;
        const ph = (box) => { const cs = getComputedStyle(box, '::before'); return cs.display === 'none' ? 0 : Number(cs.opacity); };
        const make = (html) => { const d = document.createElement('div'); d.className = 'e2e-ia-probe'; d.style.cssText = 'position:fixed;left:0;top:0;width:48px;height:48px;z-index:9999'; d.innerHTML = html; document.body.append(d); return d.firstElementChild; };
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const broken = make(itemIcon('coins').replace(/src="[^"]*"/, 'src="/art/items/missing-128.webp"').replace(/ srcset="[^"]*"/, ''));
        const slow = make(itemIcon('gems').replace(/src="([^"]*)gems-128/, 'src="$1slow-128').replace(/ srcset="[^"]*"/, ''));
        const cached = make(itemIcon('book_legendary'));
        await wait(150);
        const early = { slow: vis(slow), slowPh: ph(slow), cached: vis(cached), cachedPh: ph(cached) };
        await wait(750);
        const out = {
          early,
          broken: { bad: broken.classList.contains('bad'), img: !!broken.querySelector('img'), svg: vis(broken), ph: ph(broken) },
          slowLate: { svg: vis(slow), ph: ph(slow) },
          cached: { ok: cached.classList.contains('ok'), svg: vis(cached), ph: ph(cached) },
        };
        window.__slowBox = slow;
        window.__phOf = ph;
        return out;
      });
      release();
      await page.waitForFunction(() => window.__slowBox.classList.contains('ok') || window.__slowBox.classList.contains('bad'), null, { timeout: 8000 }).catch(() => {});
      const slowDone = await page.evaluate(() => ({ cls: window.__slowBox.className, svg: getComputedStyle(window.__slowBox.querySelector('svg')).visibility, ph: window.__phOf(window.__slowBox) }));
      check(fb.broken.bad && !fb.broken.img && fb.broken.svg === 'visible' && fb.broken.ph === 0, `${tag} fallback: a broken image shows the drawn icon (${JSON.stringify(fb.broken)})`);
      check(fb.early.slow === 'hidden' && fb.early.slowPh === 0 && fb.slowLate.svg === 'hidden' && fb.slowLate.ph === 1,
        `${tag} fallback: a slow image shows the neutral placeholder after 0.3 s and never the drawing (${JSON.stringify(fb.early)} → ${JSON.stringify(fb.slowLate)})`);
      check(fb.cached.ok && fb.cached.svg === 'hidden' && fb.cached.ph === 0 && fb.early.cached === 'hidden' && fb.early.cachedPh === 0, `${tag} fallback: a loaded image shows neither the drawing nor the placeholder (${JSON.stringify(fb.cached)})`);
      check(slowDone.svg === 'hidden' && slowDone.ph === 0 && /\bok\b/.test(slowDone.cls), `${tag} fallback: the placeholder goes once the slow image arrives (${JSON.stringify(slowDone)})`);
      await page.unroute('**/art/items/slow-*.webp*');
      errors.splice(0); // the missing file's 404 is the point of this check
      await page.evaluate(() => document.querySelectorAll('.e2e-ia-probe').forEach((d) => d.remove()));

      // a slow first open: a fresh browser profile (empty cache) opens the lobby, then every item image is held
      // back while the backpack opens for the first time. The waiting boxes show the placeholder, and no old
      // drawing is on screen (the small cuts preloaded at boot may already be in); then all the art lands.
      const p2 = await browser.newPage(pageOpts);
      watch(p2);
      await boot(p2);
      await goTo(p2, '#/lobby', 'lobby');
      let open;
      const gate = new Promise((r) => { open = r; });
      await p2.route('**/art/items/**', async (route) => { await gate; await route.continue().catch(() => {}); });
      await goTo(p2, '#/backpack?tab=all', 'backpack');
      const slowShot = join(out, `slow-open-${tag}.png`);
      await p2.screenshot({ path: slowShot }).catch(() => {});
      const during = await p2.evaluate(() => {
        const vw = innerWidth;
        const vh = innerHeight;
        const inView = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw; };
        const boxes = [...document.querySelectorAll('.ia')].filter(inView);
        const waiting = boxes.filter((b) => !b.classList.contains('ok') && !b.classList.contains('bad'));
        const ph = (b) => { const cs = getComputedStyle(b, '::before'); return cs.display === 'none' ? 0 : Number(cs.opacity); };
        return {
          boxes: boxes.length,
          waiting: waiting.length,
          placeholders: waiting.filter((b) => ph(b) === 1).length,
          drawn: boxes.filter((b) => getComputedStyle(b.querySelector('svg')).visibility === 'visible').map((b) => b.dataset.art),
        };
      });
      open();
      await waitArt(p2);
      await settle(p2, 250);
      const landed = await inspect(p2);
      await p2.screenshot({ path: join(out, `slow-open-landed-${tag}.png`) }).catch(() => {});
      await p2.unroute('**/art/items/**');
      await p2.close();
      report[`slow-open-${tag}`] = { during, landed };
      console.log(`  slow open: ${during.boxes} icons in view, ${during.waiting} waiting (${during.placeholders} placeholders), ${during.drawn.length} drawn -> ${slowShot}`);
      check(during.waiting > 0 && !during.drawn.length && during.placeholders === during.waiting,
        `${tag} slow first open: the waiting boxes show the placeholder and no old drawing is on screen (${JSON.stringify({ ...during, drawn: during.drawn.slice(0, 5) })})`);
      check(!landed.broken.length && !landed.drawn.length && !landed.pending.length && landed.loaded === landed.icons, `${tag} slow first open: then every icon in view lands as the baked image (${landed.loaded}/${landed.icons})`);
      errors.splice(0);
    }
  } catch (e) {
    failures.push(`${tag}: ${e.message.split('\n')[0]}`);
    console.log(`  FAILED: ${e.message}`);
  }
  await page.close();
}

writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
await browser.close();
await server.close();
if (failures.length) console.log(`\n${failures.length} failure(s):\n  ${failures.join('\n  ')}`);
else console.log('\nall item art checks passed');
process.exit(failures.length ? 1 : 0);
