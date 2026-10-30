// Teams and gear loadouts (docs/specs/GEAR_UPDATE.md §7, §11.1; milestone M1) at 844 x 390, 1280 x 720 and
// 390 x 844: the team chips on Formation (switch, Rename, Copy, the loadout letter on a squad tile), Loadout A · B · C
// on the girl page (add, switch, the takes list before a switch that moves a piece from a classmate, Undo), the Team
// chip beside Start on Stage Prep (no scroll) and its picker, and the co-op hub's "You bring Team 1" line. No
// horizontal overflow anywhere.
// Usage: node e2e/teams.mjs [--shots dir]
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const SHOTS = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser } = await launchChromium();
const fails = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); };

async function noOverflow(page, W, label) {
  const sw = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
  check(sw <= W + 1, `${label}: no horizontal overflow (${sw} <= ${W})`);
}

try {
  for (const [W, H] of [[844, 390], [1280, 720], [390, 844]]) {
    const touch = W < 1000;
    const tag = `${W}x${H}`;
    const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    const tap = async (sel) => {
      const loc = typeof sel === 'string' ? page.locator(sel).first() : sel;
      await loc.scrollIntoViewIfNeeded({ timeout: 15000 }).catch(() => {});
      await (touch ? loc.tap({ timeout: 15000 }) : loc.click({ timeout: 15000 }));
      await page.waitForTimeout(200);
    };
    const go = async (hash, sel) => {
      await page.evaluate((x) => { location.hash = x; }, hash);
      await page.waitForSelector(sel, { timeout: 20000 });
      await page.waitForTimeout(300);
    };
    await page.goto(`${base}?online=local&onboarding=0#/lobby`, { waitUntil: 'load' });
    await page.evaluate(() => { localStorage.clear(); });
    await page.goto(`${base}?online=local&onboarding=0#/lobby`, { waitUntil: 'load' });
    const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 15000 }).catch(() => null);
    if (later) { await later.click({ force: true }); await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 10000 }).catch(() => {}); }
    const seeded = await page.evaluate(async () => {
      const { store } = window.__sakura;
      const gear = await import('/src/systems/gear.js');
      const { grantUnit } = await import('/src/systems/unlocks.js');
      const { createRng } = await import('/src/core/rng.js');
      const p = store.profile;
      for (const id of ['kage', 'yuki', 'momo']) grantUnit(p, id, Date.now());
      // every menu open (a story save gates gear and some hubs)
      if (p.story) p.story.legacy = true;
      const rng = createRng(5);
      const c1 = gear.addGear(p, gear.rollGear(rng, { slot: 'charm', rarity: 'mythic', level: 4 }));
      const c2 = gear.addGear(p, gear.rollGear(rng, { slot: 'charm', rarity: 'epic', level: 2 }));
      const r1 = gear.addGear(p, gear.rollGear(rng, { slot: 'ribbon', rarity: 'legendary', level: 6 }));
      gear.equipGear(p, 'kage', c1);
      gear.equipGear(p, 'kage', r1);
      gear.equipGear(p, 'aoi', c2);
      p.formation = { hero: 'hikari', towers: ['aoi', 'kage'] };
      store.commit('test');
      store.saveNow?.();
      return { c1, c2, r1 };
    });

    // ----- Formation: the team chips -----
    await go('#/formation', '[data-testid="team-bar"]');
    check(await page.locator('[data-testid="team-bar"] .tb-chip').count() === 5, `${tag} Formation: 5 team chips`);
    check(await page.locator('[data-testid="team-1"]').getAttribute('aria-pressed') === 'true', `${tag} Team 1 is in use`);
    const chipBox = await page.locator('[data-testid="team-1"]').boundingBox();
    check(chipBox && chipBox.height >= 36, `${tag} team chip is a 36 px target (${chipBox && Math.round(chipBox.height)})`);
    await noOverflow(page, W, `${tag} Formation`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/formation-${tag}.png` });
    // Team 2: empty; add a girl; back to Team 1 keeps both squads
    await tap('[data-testid="team-2"]');
    check(await page.locator('[data-testid="team-2"]').getAttribute('aria-pressed') === 'true', `${tag} Team 2 switched on`);
    const f2 = await page.evaluate(() => window.__sakura.store.profile.formation);
    check(!f2.hero && !f2.towers.length, `${tag} Team 2 starts empty`);
    await tap('[data-testid="pick-kind-tower"]');
    await tap(page.locator('.mb-pick-grid .mb-pick button, .mb-pick-grid .mb-pick [role="button"], .mb-pick-grid .mb-pick > *').first());
    const f2b = await page.evaluate(() => window.__sakura.store.profile.formation);
    check(f2b.towers.length === 1, `${tag} a girl joins Team 2 (${f2b.towers.join(',')})`);
    await tap('[data-testid="team-1"]');
    const f1 = await page.evaluate(() => window.__sakura.store.profile.formation);
    check(f1.hero === 'hikari' && f1.towers.join() === 'aoi,kage', `${tag} back on Team 1: its squad (${f1.hero} ${f1.towers.join(',')})`);
    // Rename
    await tap('[data-testid="team-rename"]');
    await page.fill('[data-testid="team-rename-in"]', 'Bosses');
    await tap('[data-testid="team-rename-ok"]');
    check((await page.locator('[data-testid="team-name"]').innerText()).trim() === 'Bosses', `${tag} Rename: "Bosses"`);
    // Copy goes to the first empty team (Team 3: Team 2 has a girl)
    await tap('[data-testid="team-copy"]');
    const copied = await page.evaluate(() => window.__sakura.store.profile.teams.list[2]);
    check(copied.hero === 'hikari' && copied.towers.join() === 'aoi,kage', `${tag} Copy → Team 3`);

    // ----- the girl page: Loadout A · B · C -----
    await go('#/student?id=kage&tab=gear', '[data-testid="loadouts"]');
    check(await page.locator('[data-testid="loadout-A"]').getAttribute('aria-pressed') === 'true', `${tag} Kage wears Loadout A`);
    await noOverflow(page, W, `${tag} girl page`);
    await tap('[data-testid="loadout-B"]');
    const k1 = await page.evaluate(() => { const u = window.__sakura.store.profile.units.kage; return { n: u.presets.length, preset: u.preset }; });
    check(k1.n === 2 && k1.preset === 1, `${tag} Add Loadout B: a copy, worn (${k1.n} loadouts, on ${k1.preset})`);
    check(await page.locator('[data-testid="team-undo"]').count() >= 1, `${tag} the notice offers Undo`);
    // B takes Aoi's charm: the list first, then Switch, then Undo
    await page.evaluate(async ({ c2 }) => {
      const { store } = window.__sakura;
      const gear = await import('/src/systems/gear.js');
      const teams = await import('/src/systems/teams.js');
      const p = store.profile;
      gear.equipGear(p, 'kage', c2);
      teams.usePreset(p, 'kage', 0);
      gear.equipGear(p, 'aoi', c2);
      store.commit('teams');
    }, seeded);
    await go('#/formation', '[data-testid="team-bar"]');
    // the squad tile shows no letter on A; Team 1 remembers Kage on A now
    await go('#/student?id=kage&tab=gear', '[data-testid="loadouts"]');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/loadouts-${tag}.png` });
    await tap('[data-testid="loadout-B"]');
    await page.waitForSelector('[data-testid="takes-list"]', { timeout: 5000 }).catch(() => null);
    const takes = await page.locator('[data-testid="takes-list"]').innerText().catch(() => '');
    check(/Takes .+ from Aoi/.test(takes), `${tag} the takes list says "${takes.split('\n')[0]}"`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/takes-${tag}.png` });
    await tap('[data-testid="takes-ok"]');
    const after = await page.evaluate(({ c2 }) => window.__sakura.store.profile.gear[c2].equippedBy, seeded);
    check(after === 'kage', `${tag} Switch: Kage wears Aoi's charm`);
    await tap(page.locator('[data-testid="team-undo"]').last());
    const undone = await page.evaluate(({ c2 }) => ({ by: window.__sakura.store.profile.gear[c2].equippedBy, preset: window.__sakura.store.profile.units.kage.preset }), seeded);
    check(undone.by === 'aoi' && undone.preset === 0, `${tag} Undo: back to Aoi, Kage on A`);
    // Kage on B in Team 1: the squad tile carries the letter
    await tap('[data-testid="loadout-B"]');
    await page.waitForSelector('[data-testid="takes-ok"]', { timeout: 5000 }).catch(() => null);
    if (await page.locator('[data-testid="takes-ok"]').count()) await tap('[data-testid="takes-ok"]');
    await go('#/formation', '[data-testid="team-bar"]');
    check(await page.locator('.fm-squad [data-testid="squad-loadout"]').count() === 1, `${tag} Formation: Kage's tile shows "B"`);

    // ----- Stage Prep: the Team chip beside Start -----
    await go('#/stage?id=1-1', '[data-testid="stage-start"]');
    const chip = await page.locator('[data-testid="stage-team"]').boundingBox();
    const start = await page.locator('[data-testid="stage-start"]').boundingBox();
    check(!!chip && chip.y + chip.height <= H + 1 && chip.x >= 0 && chip.x + chip.width <= W + 1, `${tag} Stage Prep: the Team chip is on screen`);
    check(!!start && start.y + start.height <= H + 1, `${tag} Stage Prep: Start still on screen without scrolling`);
    check(/Bosses/i.test(await page.locator('[data-testid="stage-team"]').innerText()), `${tag} the chip names the team`);
    await noOverflow(page, W, `${tag} Stage Prep`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/stage-${tag}.png` });
    await tap('[data-testid="stage-team"]');
    check(await page.locator('[data-testid="team-pick"] .tb-chip').count() === 5, `${tag} the chip opens the 5 teams`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/stage-pick-${tag}.png` });
    await tap('[data-testid="team-3"]');
    await page.waitForTimeout(300);
    // (Team 3 is a copy of Team 1: a switch that moves or shares pieces lists them first)
    if (await page.locator('.modal-overlay:not(.closing) [data-testid="takes-ok"]').count()) {
      check(await page.locator('[data-testid="takes-list"], [data-testid="clash-list"]').count() >= 1, `${tag} the switch lists what moves or is shared`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/switch-confirm-${tag}.png` });
      await tap('.modal-overlay:not(.closing) [data-testid="takes-ok"]');
    }
    check(/Team 3/i.test(await page.locator('[data-testid="stage-team"]').innerText()), `${tag} switched to Team 3 from Stage Prep`);

    // ----- the co-op hub: "You bring Team 3" -----
    // (the local test backend asks for a player name once)
    await page.evaluate(() => { location.hash = '#/chat'; });
    const nameIn = await page.waitForSelector('[data-testid="name-input"]', { timeout: 15000 }).catch(() => null);
    if (nameIn) {
      await page.fill('[data-testid="name-input"]', 'Tester');
      await tap('[data-testid="name-save"]');
      await page.waitForSelector('[data-testid="name-input"]', { state: 'detached', timeout: 10000 }).catch(() => {});
    }
    await page.evaluate(() => { location.hash = '#/coop'; });
    const team = await page.waitForSelector('[data-testid="coop-team"]', { timeout: 30000 }).catch(() => null);
    if (team) {
      check(/Team 3/i.test(await team.innerText()), `${tag} co-op hub: the Host panel's chip says Team 3`);
      const b = await team.boundingBox();
      check(!!b && b.y + b.height <= H + 400 && b.x >= 0 && b.x + b.width <= W + 1, `${tag} co-op hub: the chip fits across`);
      const bring = page.locator('[data-testid="coop-bring"]');
      if (await bring.isVisible().catch(() => false)) check(/You bring Team 3/i.test(await bring.innerText()), `${tag} co-op hub: "You bring Team 3"`);
      // a switch here redraws the chip in place
      await tap('[data-testid="coop-team"]');
      await tap('[data-testid="team-pick"] [data-testid="team-1"]');
      await page.waitForTimeout(300);
      if (await page.locator('.modal-overlay:not(.closing) [data-testid="takes-ok"]').count()) await tap('.modal-overlay:not(.closing) [data-testid="takes-ok"]');
      check(/Bosses/i.test(await page.locator('[data-testid="coop-team"]').innerText()), `${tag} co-op hub: switched to Team 1 ("Bosses")`);
      await noOverflow(page, W, `${tag} co-op hub`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/coop-${tag}.png` });
    } else {
      // (review r1 M2: a hidden chip is a failure, never a skip)
      check(false, `${tag} co-op hub: the team chip is on screen`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/coop-skip-${tag}.png` });
    }

    check(!errs.length, `${tag} no page errors${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
if (fails.length) {
  console.log(`\n${fails.length} FAILED`);
  process.exit(1);
}
console.log('\nall ok');
