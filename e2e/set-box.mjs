// Set Boxes e2e (owner, Oct 31: "a party popper box should only give you party popper pieces"): a Freeze Tag box and a
// Party Popper box each show their own set (name, box icon, the five set-look pieces, the set bonus) before they open,
// the pick box shows the set chooser with icons, the Supplies sheet names each box's set, and opening a box gives five
// pieces of that set only, each drawn with its set's own look (gear_<set>_<slot>).
//
//   node e2e/set-box.mjs [--viewport 390x844] [--shots DIR] [--before]
//   --before: screenshots only (the old modal), no checks
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';
import { veteran } from '../tests/fixtures/veterans.js';
import { SAVE_KEY } from '../src/systems/save.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const viewports = opt('viewport', null) ? [opt('viewport')] : ['390x844', '844x390', '1280x720'];
const SHOTS = opt('shots', 'e2e/out/set-box');
const BEFORE = args.includes('--before');
mkdirSync(SHOTS, { recursive: true });
const IGNORE = [/GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i,
  /Failed to load resource: net::ERR_(CERT_AUTHORITY_INVALID|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|PROXY_CONNECTION_FAILED|TUNNEL_CONNECTION_FAILED|CONNECTION_REFUSED)/i];
const fails = [];
const check = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg); return ok; };

function save() {
  const p = veteran('late');
  p.items = { ...(p.items || {}), setbox_freezetag_legendary: 1, setbox_popper_mythic: 1, setbox_pick_legendary: 1, setbox_spirit_ur: 1 };
  return p;
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium();
console.log(`browser: ${label}`);

async function open(context) {
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(([key, text]) => {
    if (!sessionStorage.getItem('sb-seeded')) { localStorage.setItem(key, text); sessionStorage.setItem('sb-seeded', '1'); }
    sessionStorage.setItem('sakura-title-seen', '1');
  }, [SAVE_KEY, JSON.stringify(save())]);
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura && document.querySelector('#app')?.children.length > 0, null, { timeout: 30000 });
  // let the welcome toasts pass, so they never sit over the box in a screenshot
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => !document.querySelector('.toast-host > *'), null, { timeout: 15000 }).catch(() => {});
  // close whatever greets a returning player (gifts, notices), so only the boxes' modals are on screen
  for (let i = 0; i < 6; i++) {
    const top = page.locator('.modal-overlay:not(.closing)').last();
    if (!(await top.count())) break;
    const btn = top.locator('.modal-actions button').last();
    if (await btn.count()) await btn.click().catch(() => {}); else await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  return { page, errors };
}
/** Closes every popup but a Set Box (a late gift or notice can land over it). */
async function closeOthers(page) {
  for (let i = 0; i < 6; i++) {
    const other = page.locator('.modal-overlay:not(.closing):not(:has([data-testid="set-box-modal"]))').last();
    if (!(await other.count())) return;
    const btn = other.locator('.modal-actions button').last();
    if (await btn.count()) await btn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(350);
  }
}
const modalOf = async (page, id) => {
  await closeOthers(page);
  await page.evaluate(async (itemId) => (await import('/src/ui/gearUr.js')).setBoxModal(itemId) && true, id);
};
const imagesIn = (page) => page.waitForFunction(() => [...document.querySelectorAll('[data-testid="set-box-modal"] img')].every((i) => i.complete), null, { timeout: 10000 }).catch(() => {});
const closeModal = async (page) => {
  await closeOthers(page);
  const notNow = page.locator('.modal-overlay:has([data-testid="set-box-modal"]) .modal-actions button').first();
  if (await notNow.count()) await notNow.click();
  await page.waitForSelector('[data-testid="set-box-modal"]', { state: 'detached', timeout: 5000 }).catch(() => {});
};

for (const vp of viewports) {
  const [w, h] = vp.split('x').map(Number);
  console.log(`\n=== ${vp}${BEFORE ? ' (before)' : ''} ===`);
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: Math.min(w, h) < 600 });
  const { page, errors } = await open(context);
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${BEFORE ? 'before' : 'after'}-${name}-${vp}.png`, animations: 'disabled', timeout: 90000 });

  const looks = {};
  for (const [id, set, name] of [['setbox_freezetag_legendary', 'freezetag', 'Freeze Tag'], ['setbox_popper_mythic', 'popper', 'Party Popper']]) {
    await modalOf(page, id);
    await page.waitForSelector('[data-testid="set-box-modal"]', { timeout: 10000 });
    await imagesIn(page);
    await page.waitForTimeout(300);
    await closeOthers(page);
    await shot(set);
    if (!BEFORE) {
      const m = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="set-box-modal"]');
        const head = root.querySelector('[data-testid="set-box-head"]');
        return {
          head: head?.textContent || '',
          kind: root.querySelector('[data-testid="set-box-kind"]')?.textContent || '',
          boxArt: head?.querySelector('img[data-art]')?.dataset.art || null,
          pieces: [...root.querySelectorAll('[data-testid="set-box-pieces"] img[data-art]')].map((i) => i.dataset.art),
          youGet: root.querySelector('[data-testid="set-box-pieces"]')?.textContent || '',
          bonus: root.querySelector('[data-testid="set-box-bonus"]')?.textContent || '',
          pickers: [...root.querySelectorAll('[data-testid^="set-box-slot-"] img[data-art]')].map((i) => i.dataset.art),
        };
      });
      looks[set] = m;
      check(m.head.includes(name) && m.boxArt === id, `${vp} ${name} box: header names the set with its own box icon (${m.boxArt})`);
      check(JSON.stringify(m.pieces) === JSON.stringify(['charm', 'ribbon', 'shoes', 'hair', 'necklace'].map((s) => `gear_${set}_${s}`)), `${vp} ${name} box: the five ${name} pieces in their set look (${m.pieces.join(', ')})`);
      check(m.youGet.includes(`You get these 5 ${name} pieces`), `${vp} ${name} box: "You get these 5 ${name} pieces"`);
      check(m.bonus.length > 10, `${vp} ${name} box: the set bonus line`);
      check(m.kind === (set === 'freezetag' ? 'Preset · Legendary' : 'Preset · Mythic'), `${vp} ${name} box: its kind line ("${m.kind}")`);
      check(m.pickers.length === 5 && m.pickers.every((k, i) => k === m.pieces[i]), `${vp} ${name} box: each main-stat picker wears that piece's set icon`);
      check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `${vp} ${name} box: no horizontal overflow`);
    }
    await closeModal(page);
  }
  if (!BEFORE) {
    check(looks.freezetag.head !== looks.popper.head && looks.freezetag.boxArt !== looks.popper.boxArt, `${vp} the two boxes look different (names and icons)`);
    // a UR box: "Preset · UR" and its five pieces on the rainbow ring
    await modalOf(page, 'setbox_spirit_ur');
    await page.waitForSelector('[data-testid="set-box-modal"]', { timeout: 10000 });
    const ur = await page.evaluate(() => ({
      kind: document.querySelector('[data-testid="set-box-kind"]')?.textContent || '',
      ring: document.querySelectorAll('[data-testid="set-box-pieces"] .gu-sb-piece.ur').length,
    }));
    check(ur.kind === 'Preset · UR' && ur.ring === 5, `${vp} UR box: "${ur.kind}", ${ur.ring} pieces on the rainbow ring`);
    await closeOthers(page);
    await shot('ur');
    await closeModal(page);
    // the pick box: the chooser with icons first, then the same layout for the chosen set
    await modalOf(page, 'setbox_pick_legendary');
    await page.waitForSelector('[data-testid="set-box-modal"]', { timeout: 10000 });
    await imagesIn(page);
    const chooser = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="set-box-set-"]')].map((b) => ({ id: b.dataset.testid.slice(12), art: b.querySelector('img[data-art]')?.dataset.art || null })));
    check(chooser.length === 6 && chooser.every((c) => c.art === `setbox_${c.id}_legendary`), `${vp} pick box: the six sets to choose from, each with its box icon (${chooser.map((c) => c.art).join(', ')})`);
    await page.locator('[data-testid="set-box-set-geometry"]').click();
    const after = await page.evaluate(() => [...document.querySelectorAll('[data-testid="set-box-pieces"] img[data-art]')].map((i) => i.dataset.art));
    check(after.every((k) => k.startsWith('gear_geometry_')) && after.length === 5, `${vp} pick box: choosing Geometry shows the Geometry pieces`);
    await closeOthers(page);
    await shot('pick');
    await closeModal(page);
    // the Supplies sheet: each box names its set
    const lines = await page.evaluate(async () => {
      const { boxLine } = await import('/src/ui/screens/backpack.js');
      const { getItem } = await import('/src/data/items.js');
      return ['setbox_freezetag_legendary', 'setbox_popper_mythic', 'setbox_pick_legendary'].map((id) => boxLine(getItem(id)));
    });
    check(lines[0].startsWith('Opens 5 Freeze Tag pieces') && lines[1].startsWith('Opens 5 Party Popper pieces') && /^Pick a set/.test(lines[2]), `${vp} Supplies: "${lines.join('" / "')}"`);
    // open the Freeze Tag box: five Freeze Tag pieces, each drawn in its set look
    const before = await page.evaluate(() => Object.keys(window.__sakura.store.profile.gear));
    await modalOf(page, 'setbox_freezetag_legendary');
    await page.waitForSelector('[data-testid="set-box-modal"]', { timeout: 10000 });
    await closeOthers(page);
    await page.locator('[data-testid="set-box-open"]').click();
    await page.waitForTimeout(500);
    const got = await page.evaluate(async (old) => {
      const { gearArtKey } = await import('/src/art/icons.js');
      const p = window.__sakura.store.profile;
      return Object.keys(p.gear).filter((u) => !old.includes(u)).map((u) => ({ set: p.gear[u].set, slot: p.gear[u].slot, art: gearArtKey(p.gear[u].slot, p.gear[u].rarity, { set: p.gear[u].set }) }));
    }, before);
    check(got.length === 5 && got.every((g) => g.set === 'freezetag' && g.art === `gear_freezetag_${g.slot}`), `${vp} opening the Freeze Tag box gave 5 Freeze Tag pieces in their set look (${got.map((g) => g.art).join(', ')})`);
    check(!errors.length, `${vp} no page errors (${errors.slice(0, 3).join(' | ')})`);
  }
  await context.close();
}
await browser.close();
await server.close();
console.log(fails.length ? `\n${fails.length} FAILED:\n - ${fails.join('\n - ')}` : (BEFORE ? '\nbefore shots taken' : '\nall set box checks passed'));
process.exit(fails.length ? 1 : 0);
