// Halloween 2026 (Pumpkin Lantern Night) end to end, on the dev preview clock (localStorage
// 'sakura-dev-now', dev builds only: src/ui/events/clock.js). A save that has cleared 1-5 at
// Tue Oct 20 2026, 1 PM CDT (the event opens at ship: game day 2026-10-20): the lobby EVENT card
// and decor → the daily login gift in the Mailbox → Episode 1 (skipped = read) → claim the login
// mission → Operation 1 played for real to victory (candy earned, night look with costumed
// monsters; its Nightmare locked until then) → buy in the Candy Exchange, then the Pumpkin
// Patroller title and the Pumpkin Lantern frame, equipped and shown on the profile and in Preview →
// the Gourdlight Golem beaten on Normal for real (its Nightmare locked until Hard) → Nightmare: the
// Golem's own 20-wave stage in prep, an operation's Nightmare sweep → the exchange phase
// (operations closed) → the event ends: the leftover candy comes back as coins by mail, and the
// page shows the summary.
//
//   node e2e/halloween.mjs                         # 844x390 and 1280x720
//   node e2e/halloween.mjs --viewport 844x390 --shots /tmp/hw
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const SHOTS = opt('shots', null);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const VIEWPORTS = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720'];

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const require = createRequire('/opt/node22/lib/node_modules/playwright/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const fails = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); return c; };
const T = 60000;
const EV = 'halloween-2026';
const CANDY = 'evt_halloween_candy';
const OPEN_DAY = '2026-10-20T18:00:00Z'; // Tue Oct 20, 1 PM CDT (open at ship)
const EXCHANGE = '2026-11-02T18:00:00Z'; // Mon Nov 2, noon CST: operations closed, exchange open
const ENDED = '2026-11-09T18:00:00Z'; // Mon Nov 9: the exchange has closed

let page;
let tag = '';
let battleN = 0;
const window_tag = () => `night-${++battleN}`;
const errors = [];

async function shot(name) {
  if (!SHOTS) return;
  await page.waitForSelector('.toast', { state: 'detached', timeout: 6000 }).catch(() => {});
  await page.screenshot({ path: `${SHOTS}/${tag}-${name}.png`, timeout: 120000 }).catch((e) => console.log(`  warn screenshot ${name}: ${String(e.message).split('\n')[0]}`));
}
const candy = () => page.evaluate((id) => window.__sakura.store.profile.items[id] || 0, CANDY);
const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function go(hash, selector) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForSelector(selector, { timeout: T });
  await page.waitForTimeout(400);
}

/** Reload at a dev-clock instant (the clock reads localStorage at start-up). */
async function reloadAt(iso, hash) {
  await page.evaluate((t) => { window.__sakura.store.saveNow?.(); localStorage.setItem('sakura-dev-now', t); }, iso);
  await page.goto(`${base}?onboarding=0${hash}`, { waitUntil: 'load' });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: T });
  await page.waitForTimeout(600);
}

async function openGame() {
  // the dev clock must be on: a check that fails loudly instead of testing the wrong day
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('sakura-dev-now', t); }, OPEN_DAY);
  await page.reload({ waitUntil: 'load' }); // a real reload: the dev clock reads the key at start-up
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 30000 }).catch(() => null);
  if (later) { await later.click({ force: true }); await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 15000 }).catch(() => {}); }
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: T });
  const clock = await page.evaluate(async () => new Date((await import('/src/ui/events/clock.js')).eventNow()).toISOString());
  check(clock.startsWith(OPEN_DAY.slice(0, 10)), `dev clock on (${clock})`);
  // a player through chapter 1 (the event's unlock), with a level-45 team
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    const unlocks = await import('/src/systems/unlocks.js');
    const p = store.profile;
    for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5']) p.progress.stages[id] = { easy: true, normal: true, hard: false, nightmare: false, clears: 1 };
    for (const id of ['hikari', 'aoi', 'rei', 'yuki', 'sango', 'nami', 'hotaru', 'kage', 'shiro']) {
      if (!p.units[id]) unlocks.grantUnit(p, id);
      Object.assign(p.units[id], { level: 45, breakthrough: 4 });
    }
    p.formation = { hero: 'hikari', towers: ['aoi', 'rei', 'yuki', 'sango', 'hotaru', 'kage', 'shiro'] };
    store.commit('test');
    store.saveNow?.();
  });
}

/** Place every girl on good spots, then fast-forward the battle to its end (upgrading as it goes). */
async function playBattle({ onBoss = null } = {}) {
  await page.waitForFunction(() => window.__battle?.ui?.placement && window.__battle.sim, null, { timeout: 90000 });
  await page.evaluate(() => {
    window.__hwPlace = () => {
      const { sim, ui } = window.__battle;
      const ids = [...sim.loadout.keys(), ...(sim.heroConfig ? [sim.heroConfig.unitId] : [])];
      const placed = new Set(sim.towers.map((t) => t.unitId));
      const score = (x, y) => {
        let n = 0;
        for (const k of sim.pathTiles) {
          const [px, py] = k.split(',').map(Number);
          if (Math.hypot(px + 0.5 - x, py + 0.5 - y) <= 3.2) n++;
        }
        return n;
      };
      for (const unitId of ids) {
        if (placed.has(unitId)) continue;
        let best = null;
        for (let y = 0.25; y < sim.map.height; y += 0.5) {
          for (let x = 0.25; x < sim.map.width; x += 0.5) {
            if (!sim.canPlace(unitId, x, y).ok) continue;
            const s = score(x, y);
            if (!best || s > best.s) best = { x, y, s };
          }
        }
        if (!best) continue;
        ui.placement.start(unitId);
        if (!ui.placement.tryPlace(best.x, best.y)) ui.placement.cancel();
      }
    };
    window.__hwPlace();
    const { ui } = window.__battle;
    ui.setAutoStart(true);
    ui.startWave();
    ui.speed = 3;
  });
  await page.waitForTimeout(3500); // the first costumed monsters walk in
  await shot(`battle-${window_tag()}`);
  let state = 'wave';
  let bossShot = false;
  for (let i = 0; i < 600 && state !== 'won' && state !== 'lost'; i++) {
    const r = await page.evaluate(() => {
      const { sim } = window.__battle;
      window.__hwPlace();
      for (const t of sim.towers) {
        for (const p of [0, 2, 1]) {
          const st = sim.upgradeStatus(t.uid, p);
          if (!st.locked && st.next && sim.cash >= st.cost) sim.upgradeTower(t.uid, p);
        }
      }
      for (let k = 0; k < 12 && sim.state !== 'won' && sim.state !== 'lost'; k++) sim.update(0.25);
      if (sim.state === 'between') sim.startNextWave();
      const boss = sim.enemies?.find?.((e) => e.def?.tier === 'boss' && e.alive !== false && e.hp > 0);
      return { state: sim.state, boss: boss ? { id: boss.def.id, hp: boss.hp, max: boss.maxHp } : null };
    });
    state = r.state;
    if (onBoss && r.boss && !bossShot && r.boss.hp < r.boss.max * 0.85) {
      bossShot = true;
      await page.waitForTimeout(700);
      await onBoss(r.boss);
    }
    await page.waitForTimeout(30);
  }
  return state;
}

try {
  for (const vp of VIEWPORTS) {
    const [W, H] = vp.split('x').map(Number);
    tag = vp;
    console.log(`\n=== ${vp} ===`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: W < 900, timezoneId: 'America/Chicago' });
    page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${vp} pageerror: ${e.message}`));
    await openGame();

    // ---- 1. lobby: the EVENT card and the decor (the first lobby visit since 1-5 was cleared) --
    await go('#/campaign', '#app');
    await go('#/lobby', '[data-testid="lobby"]');
    await page.waitForSelector('[data-testid="event-card"]', { timeout: T }).catch(() => null);
    const card = await page.evaluate(() => document.querySelector('[data-testid="event-card"]')?.textContent || '');
    check(/Pumpkin Lantern Night/.test(card) && /Ends in/i.test(card), `lobby: event card shows the event and its countdown ("${card.trim()}")`);
    check(!!(await page.$('[data-testid="event-decor"]')), 'lobby: lantern + pumpkin decor while the event runs');
    check(await noOverflow(), 'lobby: no horizontal overflow');
    await page.waitForTimeout(1200);
    await shot('lobby');

    // ---- 2. the daily login gift arrives in the Mailbox -------------------------------------
    const gift = await page.evaluate((id) => window.__sakura.store.profile.mail.letters.find((l) => l.id === `ev:${id}:1:login:1`), EV);
    check(!!gift && gift.rewards.some((r) => r.id === 'evt_halloween_candy'), 'login gift: day-1 festival gift letter in the Mailbox');
    await page.evaluate(async (id) => {
      const mail = await import('/src/systems/mail.js');
      mail.claimMail(window.__sakura.store.profile, `ev:${id}:1:login:1`, Date.parse(localStorage.getItem('sakura-dev-now')));
      window.__sakura.store.commit('mail');
    }, EV);

    // ---- 3. the event page, Episode 1 --------------------------------------------------------
    await page.locator('[data-testid="event-card"]').click();
    await page.waitForSelector('[data-testid="event-phase"]', { timeout: T });
    check(/Ends in/i.test(await page.textContent('[data-testid="event-phase"]')), 'event page: phase chip counts down');
    check(await noOverflow(), 'event page: no horizontal overflow');
    await shot('event-story');
    const c0 = await candy();
    await page.locator('[data-testid="event-ep-1"]').click();
    await page.waitForSelector('[data-testid="story-player"]', { timeout: T });
    await page.waitForTimeout(1500);
    await shot('episode-1');
    await page.locator('[data-testid="story-skip"]').click();
    await page.locator('[data-testid="story-skip-confirm"]').click();
    await page.waitForSelector('[data-testid="story-player"]', { state: 'detached', timeout: T }).catch(() => null);
    await page.waitForFunction(() => /Read/.test(document.querySelector('[data-testid="event-ep-1"]')?.textContent || ''), null, { timeout: 15000 }).catch(() => null);
    check((await candy()) - c0 === 50, `story: Episode 1 read (skipped) pays 50 candy (${(await candy()) - c0})`);

    // ---- 4. missions: claim the login mission ------------------------------------------------
    await page.locator('[data-testid="tab-missions"]').click();
    await page.waitForSelector('[data-testid="event-claim-all"]', { timeout: T });
    const c1 = await candy();
    await page.locator('[data-testid="event-claim-all"]').click();
    await page.waitForTimeout(500);
    check((await candy()) - c1 === 30, `missions: Claim all pays the Lantern Roll Call (+${(await candy()) - c1})`);
    await shot('event-missions');

    // ---- 5. Operation 1, played for real -----------------------------------------------------
    await page.locator('[data-testid="tab-stages"]').click();
    await page.waitForSelector('[data-testid="event-op-ev-halloween-1"]', { timeout: T });
    const opCard = await page.evaluate(() => {
      const nm = document.querySelector('[data-testid="event-op-diff-ev-halloween-1-nightmare"]');
      return {
        locked: !!nm?.classList.contains('locked') && !!nm?.querySelector('.ev-diff-lock'),
        why: nm?.getAttribute('title') || '',
        normalLocked: !!document.querySelector('[data-testid="event-op-diff-ev-halloween-1-normal"]')?.classList.contains('locked'),
        candy: document.querySelector('[data-testid="event-op-ev-halloween-1"] .ev-op-candy')?.textContent || '',
      };
    });
    check(opCard.locked && opCard.why === 'Clear Normal first' && !opCard.normalLocked, `operations tab: Op 1's Nightmare chip wears a lock ("${opCard.why}"), Normal does not`);
    check(opCard.candy === '×60 / ×120', `operations tab: Op 1's candy per win on Normal / Nightmare (${opCard.candy})`);
    await shot('event-operations');
    await page.locator('[data-testid="event-op-ev-halloween-1"]').click();
    await page.waitForSelector('[data-testid="event-prep"]', { timeout: T });
    const diffs = await page.evaluate(() => [...document.querySelectorAll('.ma-diff[data-testid^="diff-"]')].map((b) => b.dataset.testid));
    check(diffs.join(',') === 'diff-normal,diff-nightmare', `stage prep: operations offer Normal and Nightmare (${diffs.join(',')})`);
    check(/Clear Normal first/.test((await page.textContent('[data-testid="diff-lock-nightmare"]').catch(() => '')) || ''), 'stage prep: Nightmare is locked until the Normal clear ("Clear Normal first")');
    check(await noOverflow(), 'stage prep: no horizontal overflow');
    await page.waitForTimeout(1200); // the prep page fades in
    await shot('stage-prep');
    const c2 = await candy();
    await page.locator('[data-testid="stage-start"]').click();
    const st1 = await playBattle();
    await shot('op1-battle-end');
    check(st1 === 'won', `operation 1: won (${st1})`);
    await page.waitForSelector('[data-testid="view-rewards"]', { timeout: 30000 }).catch(() => null);
    check((await candy()) - c2 === 160, `operation 1: 60 candy + 100 first clear (${(await candy()) - c2})`);

    // ---- 6. the Candy Exchange ---------------------------------------------------------------
    await go(`#/event/${EV}?tab=exchange`, '[data-testid="event-offer-hw_book_r"]');
    const c3 = await candy();
    await page.locator('[data-testid="event-buy-hw_book_r"]').click();
    await page.locator('[data-testid="event-buy-confirm"]').click();
    await page.waitForTimeout(500);
    check(c3 - (await candy()) === 70, `exchange: 5 Study Guides for 70 candy (−${c3 - (await candy())})`);
    check(/9\/10/.test(await page.textContent('[data-testid="event-offer-hw_book_r"]')), 'exchange: stock 9/10');
    check(await noOverflow(), 'exchange: no horizontal overflow');
    await shot('event-exchange');

    // ---- 6b. the Pumpkin Patroller title + Pumpkin Lantern frame: bought, equipped, shown ---------
    await page.evaluate(async (id) => {
      const inv = await import('/src/systems/inventory.js');
      inv.addItems(window.__sakura.store.profile, [{ id, count: 2400 }]);
      window.__sakura.store.commit('test');
    }, CANDY);
    await go(`#/event/${EV}?tab=exchange`, '[data-testid="event-offer-hw_title"]');
    const c4 = await candy();
    for (const id of ['hw_title', 'hw_frame']) {
      await page.locator(`[data-testid="event-buy-${id}"]`).click();
      await page.locator('[data-testid="event-buy-confirm"]').click();
      await page.waitForTimeout(500);
    }
    check(c4 - (await candy()) === 2400, `exchange: the title (900) and the frame (1,500) bought (−${c4 - (await candy())})`);
    await go('#/profile', '[data-testid="profile"]');
    await page.locator('[data-testid="profile-edit"]').click();
    await page.waitForSelector('[data-testid="edit-profile"]', { timeout: 10000 });
    await page.locator('[data-testid="edit-tab-title"]').click();
    await page.locator('[data-testid="edit-titles"] button[data-title="ev_halloween_2026"]').click();
    await page.locator('[data-testid="edit-tab-picture"]').click();
    await page.locator('[data-testid="edit-frames"] button[data-frame="pumpkin"]').click();
    await page.locator('[data-testid="edit-profile-save"]').click();
    await page.waitForSelector('[data-testid="edit-profile"]', { state: 'detached', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600);
    const plate = (scope) => page.evaluate((sel) => { const el = document.querySelector(`${sel} [data-testid="profile-title"]`); return el ? `${el.textContent.trim()}|${el.classList.contains('tp-gold') ? 'gold' : 'other'}` : null; }, scope);
    check((await plate('[data-testid="profile"]')) === '★ Pumpkin Patroller|gold', `profile: the plate under the name reads "${await plate('[data-testid="profile"]')}"`);
    check((await page.getAttribute('[data-testid="profile"] [data-testid="profile-avatar"]', 'data-frame')) === 'pumpkin', 'profile: the Pumpkin Lantern frame');
    await shot('profile-title');
    await page.locator('[data-testid="profile-preview"]').click();
    await page.waitForSelector('[data-testid="profile-preview-view"]', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(400);
    check((await plate('[data-testid="profile-preview-view"]')) === '★ Pumpkin Patroller|gold', 'Preview (the visitor layout): the title plate reads "★ Pumpkin Patroller"');
    check((await page.getAttribute('[data-testid="profile-preview-view"] [data-testid="profile-avatar"]', 'data-frame').catch(() => null)) === 'pumpkin', 'Preview: the frame');
    await page.locator('[data-testid="profile-preview-close"]').click().catch(() => {});

    // ---- 7. the boss on Normal, for real (operations 2–4 and Episode 2 done through the systems)
    await page.evaluate(async (id) => {
      const ev = await import('/src/systems/events.js');
      const { store } = window.__sakura;
      const p = store.profile;
      const now = Date.parse(localStorage.getItem('sakura-dev-now'));
      for (const s of ['ev-halloween-2', 'ev-halloween-3', 'ev-halloween-4']) p.progress.stages[s] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
      ev.readEpisode(p, id, 'ev.halloween.02', now);
      store.commit('test');
    }, EV);
    await go('#/stage/ev-halloween-boss', '[data-testid="event-prep"]');
    const bdiffs = await page.evaluate(() => [...document.querySelectorAll('.ma-diff[data-testid^="diff-"]')].map((b) => b.dataset.testid));
    check(bdiffs.join(',') === 'diff-normal,diff-hard,diff-nightmare', `boss prep: Normal, Hard and Nightmare (${bdiffs.join(',')})`);
    check(/Clear Hard first/.test((await page.textContent('[data-testid="diff-lock-nightmare"]').catch(() => '')) || ''), 'boss prep: Nightmare is locked until the Hard clear');
    await page.locator('[data-testid="diff-nightmare"]').click();
    await page.waitForTimeout(400);
    check(await page.isDisabled('[data-testid="stage-start"]'), 'boss prep: a locked Nightmare can be looked at but not started');
    check(!!(await page.$('[data-testid="diff-locked-note"]')), 'boss prep: the lock note sits by Start');
    await page.locator('[data-testid="diff-normal"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="stage-start"]').click();
    const st2 = await playBattle({ onBoss: async (b) => { console.log(`  info boss on the field: ${b.id} ${Math.round(b.hp)}/${Math.round(b.max)}`); await shot('boss'); } });
    check(st2 === 'won', `boss: the Gourdlight Golem beaten on Normal (${st2})`);

    const ep3 = await page.waitForSelector('[data-testid="view-rewards"]', { timeout: 30000 }).catch(() => null);
    const boss = await page.evaluate(async (id) => {
      const ev = await import('/src/systems/events.js');
      const { EVENT_MAP } = await import('/src/data/events/index.js');
      const rows = ev.missionRows(window.__sakura.store.profile, EVENT_MAP[id], Date.parse(localStorage.getItem('sakura-dev-now')));
      return rows.total.find((m) => m.id === 'hw_t_boss_n').done;
    }, EV);
    check(boss, 'boss: "Lights Out, Gently" mission complete');
    if (ep3) {
      await ep3.click();
      await page.waitForSelector('[data-testid="result-episodes"]', { timeout: 8000 }).catch(() => null);
      check(/New episode unlocked/.test((await page.textContent('[data-testid="result-episodes"]').catch(() => '')) || ''), 'boss: results say Episode 3 unlocked');
      await shot('boss-rewards');
    }

    // ---- 7b. Nightmare: the Golem's own stage once Hard is cleared; an operation's Nightmare sweep -
    // a locked Nightmare from a battle link plays as practice, and the HUD says why (the stage itself is open)
    await page.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()); location.hash = '#/battle?stage=ev-halloween-boss&difficulty=nightmare'; });
    await page.waitForFunction(() => /Practice run/.test(document.querySelector('[data-testid="battle-feed"]')?.textContent || ''), null, { timeout: 90000 }).catch(() => null);
    const practiceLine = (await page.textContent('[data-testid="battle-feed"]').catch(() => '')) || '';
    check(/Practice run: Nightmare opens after a Hard clear, so nothing from this battle is saved\./.test(practiceLine) && !/still locked on your map/.test(practiceLine), `locked Golem Nightmare by link: the HUD says why it is practice ("${practiceLine.slice(0, 90)}")`);
    await shot('boss-nightmare-practice');
    await page.evaluate(() => {
      const { store } = window.__sakura;
      store.profile.progress.stages['ev-halloween-boss'].hard = true;
      store.commit('test');
    });
    await go('#/stage/ev-halloween-boss?difficulty=nightmare', '[data-testid="event-prep"]');
    await page.waitForSelector('[data-testid="event-variant"]', { timeout: 10000 }).catch(() => null);
    const nmPrep = await page.evaluate(() => ({
      variant: document.querySelector('[data-testid="event-variant"]')?.textContent || '',
      waves: [...document.querySelectorAll('.ma-fact')].find((f) => /Waves/.test(f.textContent))?.querySelector('.ma-fact-value')?.textContent,
      candy: document.querySelector('[data-testid="event-prep"]')?.textContent || '',
      start: document.querySelector('[data-testid="stage-start"]')?.disabled,
      golem: !!document.querySelector('.ma-enemy[data-enemy="construct_gourdlight"]'),
      knight: !!document.querySelector('.ma-enemy[data-enemy="ghost_hollowknight"]'),
      drop: [...document.querySelectorAll('.ma-drop')].find((d) => d.querySelector('[data-item="evt_halloween_candy"]'))?.querySelector('.ma-drop-range')?.textContent || '',
    }));
    check(/Lantern Night Never Ends/.test(nmPrep.variant), `boss Nightmare prep: "${nmPrep.variant.slice(0, 60)}…"`);
    check(nmPrep.waves === '20', `boss Nightmare prep: 20 waves (${nmPrep.waves})`);
    check(/×500 per win/.test(nmPrep.candy), 'boss Nightmare prep: Pumpkin Candy ×500 per win');
    check(nmPrep.drop === '×500', `boss Nightmare prep: the Drops grid shows the sure candy as ×500, not a range (${nmPrep.drop})`);
    check(nmPrep.start === false && nmPrep.golem && nmPrep.knight, 'boss Nightmare prep: Start open, its own enemies scouted (Golem, hollow knights)');
    check(await noOverflow(), 'boss Nightmare prep: no horizontal overflow');
    await page.waitForTimeout(800);
    await shot('boss-nightmare-prep');
    await page.evaluate(() => {
      const { store } = window.__sakura;
      store.profile.progress.stages['ev-halloween-1'].nightmare = true;
      store.commit('test');
    });
    await go('#/stage/ev-halloween-1?difficulty=nightmare', '[data-testid="sweep-10"]');
    const c5 = await candy();
    await page.locator('[data-testid="sweep-10"]').click();
    await page.waitForTimeout(600);
    check((await candy()) - c5 === 1200, `Op 1 Nightmare: Sweep ×10 pays 1,200 candy (+${(await candy()) - c5})`);
    const sleepless = await page.evaluate(async (id) => {
      const ev = await import('/src/systems/events.js');
      const { EVENT_MAP } = await import('/src/data/events/index.js');
      return ev.missionRows(window.__sakura.store.profile, EVENT_MAP[id], Date.parse(localStorage.getItem('sakura-dev-now'))).total.find((m) => m.id === 'hw_t_nm_clear15').progress;
    }, EV);
    check(sleepless === 10, `Op 1 Nightmare: the sweeps count for Sleepless Patrol (${sleepless}/15)`);
    await page.keyboard.press('Escape').catch(() => {});

    // ---- 8. the exchange phase ---------------------------------------------------------------
    await reloadAt(EXCHANGE, `#/event/${EV}?tab=stages`);
    await page.waitForSelector('[data-testid="event-ops-closed"]', { timeout: T });
    check(/Exchange/i.test(await page.textContent('[data-testid="event-phase"]')), 'exchange phase: chip reads Exchange');
    check(!!(await page.$('[data-testid="event-ops-closed"]')), 'exchange phase: operations closed note');

    // ---- 9. the event ends: leftover candy → coins by mail -----------------------------------
    const left = await candy();
    await reloadAt(ENDED, `#/event/${EV}?tab=story`);
    await page.waitForSelector('[data-testid="event-ended"]', { timeout: T }).catch(() => null);
    const end = await page.evaluate((id) => {
      const p = window.__sakura.store.profile;
      const l = p.mail.letters.find((x) => x.id === `ev:${id}:1:leftover`);
      return { candy: p.items.evt_halloween_candy || 0, coins: l?.rewards?.[0]?.count ?? null, settled: !!p.events.byId[id]?.settled };
    }, EV);
    check(end.candy === 0 && end.settled && end.coins === left * 50, `ended: ${left} candy became ${end.coins} coins by mail, settled`);
    check(!!(await page.$('[data-testid="event-ended"]')), 'ended: the page shows the summary');
    await go('#/lobby', '[data-testid="lobby"]');
    check(!(await page.$('[data-testid="event-card"]')) && !!(await page.$('[data-testid="event-strip"]')), 'ended: the lobby card is the weekly event again');
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.close();
}
const real = errors.filter((e) => !/WebGL|GPU|favicon|ERR_/i.test(e));
check(!real.length, `no page errors${real.length ? `: ${real.slice(0, 3).join(' | ')}` : ''}`);
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall halloween checks passed');
process.exit(fails.length ? 1 : 0);
