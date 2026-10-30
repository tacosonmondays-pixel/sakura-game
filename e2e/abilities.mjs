// The ability bar in a real battle (ABILITIES_SPEC §13 e2e row; milestone A3 / plan M1), at 844x390 (touch) and
// 1280x720 (mouse), stage 1-2 Normal with coins to spare:
//   - Aoi to Rapid Volley 3 through her panel's buy buttons → her slot appears with the one-line unlock toast, which
//     is really visible (on top, even with the phone's panel open); the path chip is the kit bolt, never the ⚡ emoji
//   - a tap before the wave → "Abilities work during waves."; Shift+2 / Shift+1 arm cards (PC)
//   - a wave: the slot charges (whole seconds), a tap fires it (an `ability` event, the cooldown restarts, enemies
//     pinned), key 1 fires it again (PC), E / the skill button fires Hikari's Lv 7 skill
//   - hold (touch) / right-click (mouse) Momo's slot → the info card (the recharge once, no reach ring for coins, no
//     girl under it) → Auto on → Market Day fires by itself
//   - a card armed: the bar fades to 35% and a tap on it never casts, nor does the click that follows the board tap
//     that ended the placement once the fade is gone (replayed in that order: no frame timing)
//   - Wakaba's Time Out!: her slot enters aim mode, a tap on Aoi gives Aoi the rally; arming a card ends the aim and
//     the next board tap places the girl (no ability fires); from her panel's FIRE the aim banner stays on screen left
//     of the panel and a toast during the aim is not under it
//   - the DOM probe: no overlap between the bar, the hero widget, the wave control, the feed, the panel and the tower
//     bar; phone slots ≥ 44 px; the panel's ability row is in view without scrolling, one 44 px line on a phone, and
//     the first affordable Buy button stays fully in view; a tap on its name opens the live line
//   - the wave clears and the page reloads: Continue keeps the charging cooldown and the Auto switch (battle save)
//   - no page errors, no console errors
//
//   node e2e/abilities.mjs [--viewport 844x390] [--shots <dir>]
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 on any failure.
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';
import { openApp, seedSave, openBattle, settle, until, touchHold } from './lib/battleKit.mjs';
import { uiProbe, formatProbe, BATTLE_BOXES } from './lib/uiProbe.mjs';

const args = process.argv.slice(2);
const opt = (name, def = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport') ? [opt('viewport')] : ['844x390', '1280x720'];
const SHOTS = opt('shots');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium();
console.log(`browser: ${label}`);
const fails = [];
const report = {};
const check = (c, m) => {
  console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`);
  if (!c) fails.push(m);
};

for (const vp of viewports) {
  const [W, H] = vp.split('x').map(Number);
  const touch = W < 1000;
  console.log(`viewport ${vp} (${touch ? 'touch' : 'mouse'})`);
  const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // a missing optional model / art file is the loaders' business (they fall back), not a script error
    if (/Failed to load resource|404 \(Not Found\)|net::ERR/.test(t)) return;
    errors.push(`console: ${t}`);
  });
  const tap = async (sel) => (touch ? page.locator(sel).tap({ force: true }) : page.locator(sel).click({ force: true }));
  const tapAt = async (x, y) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  /**
   * Waits for `fn(arg)` in GAME time: polls it, stepping the sim a quarter-second between polls, up to `gameSec` game
   * seconds. A software-rendered page draws a few frames a second and the game clock moves per frame, so a real-time
   * wait for something the battle has to do (an enemy walks into reach, Auto fires, a wave ends) can take minutes;
   * e2e/gate-arc.mjs steps the sim the same way.
   */
  const gameUntil = async (fn, arg, gameSec) => {
    for (let i = 0; i < gameSec * 4; i++) {
      if (await page.evaluate(fn, arg)) return true;
      await page.evaluate(() => {
        const { sim } = window.__battle;
        for (let k = 0; k < 15 && sim.state !== 'won' && sim.state !== 'lost'; k++) sim.update(1 / 60);
      });
    }
    return page.evaluate(fn, arg);
  };
  const shot = async (name) => {
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}-${vp}.png`) });
  };
  const ev = (filter) => page.evaluate((f) => window.__abilEv.filter((e) => e.type === f.type && (!f.id || e.id === f.id)), filter);
  const probes = {};
  try {
    await openApp(page, base);
    await seedSave(page, { girls: ['hikari', 'aoi', 'akane', 'momo', 'wakaba'], hero: 'hikari', towers: ['aoi', 'akane', 'momo', 'wakaba'] });
    await openBattle(page, { stage: '1-2' });

    // ---- 1. Aoi to Rapid Volley 3 through her panel ----------------------------------------------------------
    const aoi = await page.evaluate(() => __ab.place('aoi'));
    check(aoi != null, `${vp} Aoi placed`);
    await page.evaluate((u) => window.__battle.ui.select(u), aoi);
    await page.waitForSelector('[data-testid="tower-panel"]:not([hidden]) [data-testid="buy-1"]', { timeout: 15000 });
    const teaser = await page.locator('[data-testid="tower-panel"]').innerText();
    const boltChip = await page.locator('[data-testid="path-bolt-1"] svg').count();
    // (the bolt is the kit's yellow SVG everywhere: the ⚡ character is a colour emoji that differs per phone)
    check(boltChip === 1 && !/⚡/.test(teaser), `${vp} her panel marks the ability path with the kit bolt before she has it (svg ${boltChip}, no ⚡ emoji)`);
    // (the drawer's two-tap buy: tap 1 arms the price, tap 2 buys; a tap that lands while the drawer redraws after the
    // last buy is simply tapped again. On a busy machine two Playwright taps can land seconds apart, past the 2.6 s
    // arm window, so the arm is held for the loop: towerPanel holdArm, as the M4 scenes do)
    await page.evaluate(() => window.__battle.ui.panel.holdArm(true));
    for (let i = 0; i < 8; i++) {
      const tier = await page.evaluate((u) => window.__battle.sim.getTower(u).tiers[1], aoi);
      if (tier >= 3) break;
      await tap('[data-testid="tower-panel"] [data-testid="buy-1"]');
      await settle(page, 60);
      await tap('[data-testid="tower-panel"] [data-testid="buy-1"]');
      await page.waitForFunction(([u, n]) => window.__battle.sim.getTower(u).tiers[1] > n, [aoi, tier], { timeout: 2000 }).catch(() => {});
      await settle(page, 120);
    }
    await page.evaluate(() => window.__battle.ui.panel.holdArm(false));
    const tiers = await page.evaluate((u) => window.__battle.sim.getTower(u).tiers.join('-'), aoi);
    check(tiers === '0-3-0', `${vp} Aoi bought to 0-3-0 through the panel (${tiers})`);
    await page.waitForSelector('[data-testid="ability-slot-0"]', { timeout: 5000 });
    const slot0 = await page.locator('[data-testid="ability-slot-0"]').getAttribute('data-state');
    check(slot0 === 'between', `${vp} her slot appears, grey before the wave (${slot0})`);
    // the first-unlock toast points at what is on screen (her portrait in the bar), on one line, and is SEEN: on a
    // phone the tier is bought from the open panel, so the feed must not sit under it
    // (polled: on a slow frame rate the toast can show a moment after the buy)
    await until(page, () => __ab.toastSeen('^Skyfall Volley: ').found, null, 5000);
    const seen = await page.evaluate(() => __ab.toastSeen('^Skyfall Volley: '));
    const learned = seen.text || '';
    check(seen.found && (touch ? learned === 'Skyfall Volley: tap Aoi, bottom right' : learned === 'Skyfall Volley: press 1 or tap Aoi'), `${vp} unlock toast: "${learned}"`);
    check(seen.onTop && seen.oneLine, `${vp} the unlock toast is visible over the open panel's screen, on one line (${JSON.stringify(seen)})`);
    check(!/⚡/.test(learned), `${vp} the toast has no ⚡ emoji (its bolt is the kit icon)`);
    await shot('e2e-unlock');
    const row = await page.locator('[data-testid="ability-row"]').innerText().catch(() => '');
    check(/Skyfall Volley/.test(row) && /WAVE/.test(row), `${vp} her panel's ability row: "${row.replace(/\s+/g, ' ')}"`);

    // ---- 2. before the wave: a tap is refused politely; PC keys arm cards -----------------------------------
    await page.evaluate(() => window.__battle.ui.select(null));
    await settle(page);
    await tap('[data-testid="ability-slot-0"]');
    // (the toast, read as soon as it shows: a software-rendered 1280x720 draws a few frames a second)
    check(await until(page, () => __ab.toasts().some((t) => t === 'Abilities work during waves.'), null, 5000), `${vp} a tap before the wave: "Abilities work during waves."`);
    check((await page.evaluate((u) => __ab.abil(u).n, aoi)) === 0, `${vp} nothing was spent`);
    await shot('e2e-prep');
    if (!touch) {
      await page.keyboard.press('Shift+Digit2');
      check((await page.evaluate(() => window.__battle.ui.placement.unitId)) === 'aoi', `${vp} Shift+2 arms card 2 (Aoi)`);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Shift+Digit1');
      check((await page.evaluate(() => window.__battle.ui.placement.unitId)) === 'hikari', `${vp} Shift+1 arms card 1 (the hero)`);
      await page.keyboard.press('Escape');
      check((await page.evaluate(() => window.__battle.ui.placement.unitId)) == null, `${vp} Esc puts the card back`);
    }

    // ---- 3. a wave: charge → tap → cast ----------------------------------------------------------------------
    await tap('[data-testid="start-wave"]');
    await until(page, () => window.__battle.sim.state === 'wave', null, 10000);
    await page.evaluate(() => { window.__battle.ui.speed = 3; });
    await settle(page, 300);
    const charging = await page.evaluate(() => {
      const b = document.querySelector('[data-testid="ability-slot-0"]');
      return { state: b.dataset.state, label: b.querySelector('.bt-ab-num')?.textContent };
    });
    check(charging.state === 'charging' && /^\d+s$/.test(charging.label), `${vp} the slot charges with whole seconds (${charging.state} "${charging.label}")`);
    await shot('e2e-charging');
    // (speed it along: the last few seconds of the charge)
    await page.evaluate((u) => __ab.ready(u, { cd: 60 * 100 }), aoi);
    // (and the walk: step the sim until an enemy is in her reach, as e2e/gate-arc.mjs does; a software-rendered
    // 1280x720 draws a few frames a second, and the game clock moves per frame, so a real-time walk took minutes)
    await page.evaluate((u) => {
      const { sim } = window.__battle;
      for (let i = 0; i < 60 * 40 && sim.state === 'wave' && __ab.inReach(u) < 1; i++) sim.update(1 / 60);
    }, aoi);
    check(await until(page, (u) => document.querySelector('[data-testid="ability-slot-0"]')?.dataset.state === 'ready' && __ab.inReach(u) >= 1, aoi, 40000), `${vp} the slot is ready with enemies in reach`);
    const before = await page.evaluate(() => window.__abilEv.length);
    // (sturdier enemies for this check, so the volley's pin can be seen on survivors)
    await page.evaluate(() => window.__battle.sim.enemies.forEach((e) => { e.hp *= 40; e.maxHp *= 40; }));
    await tap('[data-testid="ability-slot-0"]');
    await settle(page, 100);
    const cast = (await ev({ type: 'ability', id: 'aoi.skyfall' }))[0];
    const st1 = await page.evaluate((u) => __ab.abil(u), aoi);
    check(!!cast && st1.n === 1, `${vp} a tap fires Skyfall Volley (an ability event, n=${st1.n})`);
    check(st1.cd > st1.cdMax * 0.8, `${vp} the cooldown restarted (${st1.cd}/${st1.cdMax})`);
    check((cast?.targets?.length || 0) > 0 && cast.pinned > 0 && cast.pinned + cast.defeated === cast.targets.length,
      `${vp} her targets are pinned (${cast?.pinned} pinned, ${cast?.defeated} defeated of ${cast?.targets?.length})`);
    check(!(await page.evaluate(() => __ab.toasts())).some((t) => /Skyfall/.test(t) && !/tap Aoi/.test(t)), `${vp} no toast for her own cast`);
    check((await page.evaluate(() => window.__abilEv.length)) > before, `${vp} the cast reached the renderer's event stream`);
    if (!touch) {
      await page.evaluate((u) => __ab.ready(u), aoi);
      await gameUntil((u) => __ab.inReach(u) >= 1, aoi, 40);
      await page.keyboard.press('Digit1');
      await settle(page, 100);
      check((await page.evaluate((u) => __ab.abil(u).n, aoi)) === 2, `${vp} key 1 fires slot 1`);
    }

    // ---- 4. the hero's Lv 7 skill (E / the skill button) -------------------------------------------------------
    const hero = await page.evaluate((u) => __ab.place('hikari', { near: u, min: 0.8 }), aoi);
    const lv = await page.evaluate(() => __ab.heroTo(7));
    check(hero != null && lv >= 7, `${vp} Hikari placed beside Aoi and levelled to ${lv}`);
    await settle(page, 200);
    check(await page.locator('[data-testid="hero-skill"]').isVisible(), `${vp} the hero widget shows her skill button`);
    await page.evaluate((u) => __ab.ready(u), hero);
    await settle(page, 150);
    if (touch) await tap('[data-testid="hero-skill"]');
    else await page.keyboard.press('KeyE');
    await settle(page, 150);
    const skill = await ev({ type: 'ability', id: 'hikari.rally' });
    check(skill.length === 1, `${vp} ${touch ? 'the skill button' : 'E'} fires Hikari's Morning Rally (${skill.length})`);

    // ---- 5. hold → the info card → Auto on → it fires by itself (Momo's Market Day) -----------------------------
    const momo = await page.evaluate(() => __ab.place('momo', { skip: 3 }));
    await page.evaluate((u) => __ab.unlock(u), momo);
    await settle(page, 300);
    const momoSlot = await page.evaluate(() => [...document.querySelectorAll('.bt-ab[data-id]')].findIndex((b) => b.dataset.id === 'momo.marketDay'));
    check(momoSlot >= 0, `${vp} Momo's slot (${momoSlot})`);
    const momoSel = `[data-testid="ability-slot-${momoSlot}"]`;
    // (what the card asks the map to ring: Market Day pays coins, it hits no area, so no ring)
    await page.evaluate(() => {
      const r = window.__battle.renderer;
      const orig = r.setAbilityReach.bind(r);
      window.__reach = 'unset';
      r.setAbilityReach = (o) => { window.__reach = o; return orig(o); };
    });
    if (touch) await touchHold(page, momoSel);
    else await page.locator(momoSel).click({ button: 'right', force: true });
    check(await until(page, () => !!document.querySelector('[data-testid="ability-card"]'), null, 3000), `${vp} ${touch ? 'a hold' : 'a right-click'} opens the info card`);
    const cardText = await page.locator('[data-testid="ability-card"]').innerText().catch(() => '');
    // the recharge shows once (the state chip while charging, the total otherwise); no Details-only sentence
    const recharges = (cardText.match(/Recharg/g) || []).length;
    check(/Market Day/.test(cardText) && recharges === 1 && !/uncharged/.test(cardText), `${vp} the card: name, live description, the recharge once (${recharges}): "${cardText.replace(/\s+/g, ' ').slice(0, 140)}"`);
    // the card never hides a girl when the other side of the screen is clear (her own spot, the centre of her ring)
    const under = await page.evaluate(() => __ab.girlsUnder('[data-testid="ability-card"]'));
    const side = await page.locator('[data-testid="ability-card"]').getAttribute('data-side');
    check(Array.isArray(under) && under.length === 0, `${vp} the card (${side}) covers no girl (${JSON.stringify(under)})`);
    const reach = await page.evaluate(() => window.__reach);
    check(reach === null, `${vp} Market Day's card draws no reach ring on the map (${JSON.stringify(reach)})`);
    await shot('e2e-card');
    await tap('[data-testid="ability-auto"]');
    await settle(page, 150);
    check((await page.evaluate((u) => __ab.abil(u).auto, momo)) === true, `${vp} the card's switch turns her Auto on`);
    await page.evaluate((u) => __ab.ready(u), momo);
    check(await gameUntil((u) => __ab.abil(u).n >= 1, momo, 8), `${vp} with Auto on, Market Day fires by itself`);
    await page.locator('[data-testid="ability-card-close"]').click({ force: true }).catch(() => {});

    // ---- 6. a card armed: the bar fades and ignores taps -------------------------------------------------------
    await page.evaluate((u) => __ab.ready(u), aoi);
    await settle(page, 150);
    const n0 = await page.evaluate((u) => __ab.abil(u).n, aoi);
    await page.evaluate(() => window.__battle.ui.onCardTap('akane'));
    // (the fade is a 0.15 s transition: on a busy software-GL page a frame can take longer than that)
    await until(page, () => Number(getComputedStyle(document.querySelector('[data-testid="ability-bar"]')).opacity) < 0.4, null, 5000);
    await settle(page, 100);
    const faded = await page.evaluate(() => {
      const b = document.querySelector('[data-testid="ability-bar"]');
      const cs = getComputedStyle(b);
      const r = document.querySelector('[data-testid="ability-slot-0"]').getBoundingClientRect();
      return { opacity: Number(cs.opacity), pe: cs.pointerEvents, x: r.left + r.width / 2, y: r.top + r.height / 2, placing: document.querySelector('[data-testid="battle"]').classList.contains('bt-placing') };
    });
    check(faded.placing && Math.abs(faded.opacity - 0.35) < 0.05 && faded.pe === 'none', `${vp} placing: the bar at ${faded.opacity}, pointer-events ${faded.pe}`);
    await tapAt(faded.x, faded.y);
    await settle(page, 150);
    check((await page.evaluate((u) => __ab.abil(u).n, aoi)) === n0, `${vp} a tap on the faded bar never casts`);
    await page.evaluate(() => window.__battle.ui.placement.cancel());
    await settle(page, 150);
    // the phone's worst case (M1 review r2), replayed in a fixed order instead of left to frame timing: the board tap
    // under the bar ends the placement, a frame drops the fade, and only then does the touch's click reach the slot
    // under the finger. Aoi is ready, and no cast may even be tried (ctx.castAbility is counted).
    await page.evaluate((u) => __ab.ready(u), aoi);
    await page.evaluate(() => window.__battle.ui.onCardTap('akane'));
    await until(page, () => document.querySelector('[data-testid="battle"]').classList.contains('bt-placing'), null, 5000);
    const late = await page.evaluate(async () => {
      const ui = window.__battle.ui;
      const shell = document.querySelector('[data-testid="battle"]');
      const slot = document.querySelector('[data-testid="ability-slot-0"]');
      const r = slot.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const cast = ui.castAbility;
      let tries = 0;
      ui.castAbility = (...a) => {
        tries++;
        return cast(...a);
      };
      // (the renderer's tap there: off the field, which ends the placement — what the review's probe logged)
      const used = ui.placement.handleTap({ inBounds: false, x: null, y: null, towerUid: null });
      const ended = used && ui.placement.unitId == null;
      // the frame that runs between the touch's end and its click: what controller.js's frame loop does with the fade
      // (done here at once, so a slow software-GL frame cannot stretch the replay past a real click's few ms)
      shell.classList.toggle('bt-placing', !!ui.placement.unitId);
      const under = document.elementFromPoint(x, y);
      const onSlot = !!under && slot.contains(under);
      (onSlot ? under : slot).click();
      ui.castAbility = cast;
      // and the real frame loop agrees: the fade stays off
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      return { ended, fadeGone: !shell.classList.contains('bt-placing'), onSlot, tries };
    });
    await settle(page, 150);
    const nLate = await page.evaluate((u) => __ab.abil(u).n, aoi);
    check(late.ended && late.fadeGone && late.onSlot && late.tries === 0 && nLate === n0,
      `${vp} the click that follows the placement's board tap, after the fade is gone, never casts (${JSON.stringify(late)}, n ${n0}→${nLate})`);
    // (past PLACE_GUARD_MS: the next tap on the bar is a tap again)
    await settle(page, 450);

    // ---- 7. Wakaba's Time Out!: aim at a girl ------------------------------------------------------------------
    const wak = await page.evaluate((u) => __ab.place('wakaba', { near: u, min: 1.6 }), aoi);
    await page.evaluate((u) => __ab.unlock(u), wak);
    // (a wave that lasts through the aim: the cast is refused between waves. On a loaded machine a wave can still clear
    // just as the slot is tapped — "Abilities work during waves.", nothing spent — so the next one starts and the tap
    // is made again)
    const aimFromSlot = async (sel) => {
      let before = null;
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => __ab.keepWave());
        await until(page, () => window.__battle.sim.state === 'wave' && window.__battle.sim.enemies.filter((e) => !e.dead).length >= 2
          && document.querySelector('.bt-ab[data-id="wakaba.timeOut"]')?.dataset.state === 'ready', null, 10000);
        before = await page.evaluate((u) => ({ slot: document.querySelector('.bt-ab[data-id="wakaba.timeOut"]')?.dataset.state, st: window.__battle.sim.abilityStatus(u), state: window.__battle.sim.state }), wak);
        await tap(sel);
        await settle(page, 150);
        if ((await page.evaluate(() => window.__battle.ui.aim.abilityId)) === 'wakaba.timeOut') return { aiming: 'wakaba.timeOut', tries: i + 1, before };
      }
      return { aiming: null, tries: 3, before, toasts: await page.evaluate(() => __ab.toasts()) };
    };
    await page.evaluate((u) => __ab.ready(u), wak);
    await settle(page, 300);
    const wakSlot = await page.evaluate(() => [...document.querySelectorAll('.bt-ab[data-id]')].findIndex((b) => b.dataset.id === 'wakaba.timeOut'));
    const aim7 = await aimFromSlot(`[data-testid="ability-slot-${wakSlot}"]`);
    if (!aim7.aiming || aim7.tries > 1) console.log(`  (step 7 aim: ${JSON.stringify(aim7)})`);
    const banner = await page.locator('[data-testid="aim-banner"]').innerText().catch(() => '');
    check(/should coach/.test(banner) && /tap her portrait again/.test(banner) && !/⚡/.test(banner), `${vp} her slot enters aim mode: "${banner.split('\n')[0]}"`);
    await shot('e2e-aim');
    // (the camera is locked and a girl never moves: her spot on screen holds for the tap; her feet = her footprint)
    const at = await page.evaluate((u) => __ab.screenOf(u, 0), aoi);
    // (the aim waits through a wave's end; the cast needs a wave, so one runs when Aoi is tapped)
    await page.evaluate(() => __ab.keepWave());
    await until(page, () => window.__battle.sim.state === 'wave', null, 10000);
    await tapAt(at.x, at.y);
    await settle(page, 150);
    // (the cast's event names the girl it went to; the rally itself may already be over if the wave just ended)
    const rally = await page.evaluate(([w, a]) => window.__abilEv.some((e) => e.type === 'ability' && e.towerUid === w && e.targets?.length === 1 && e.targets[0] === a), [wak, aoi]);
    const why = rally ? '' : JSON.stringify(await page.evaluate(([w, p]) => ({
      pick: window.__battle.renderer.pick(p.x, p.y), ev: window.__abilEv.filter((e) => e.towerUid === w).slice(-3), toasts: __ab.toasts(), rallies: window.__battle.sim._rallies,
    }), [wak, at]));
    check(rally, `${vp} a tap on Aoi gives her Time Out! ${why}`);
    check(!(await page.locator('[data-testid="aim-banner"]').isVisible()), `${vp} the aim banner leaves`);

    // ---- 7b. one board-tap mode at a time: arming a card ends the ability aim, the next tap places the girl -------
    // (her Time Out! from step 7 runs 12 s: the slot is "active" until it ends, so the staging ends it; and on a loaded
    // machine the wave from step 7 can clear meanwhile: the slot is grey between waves, so the next one starts)
    await page.evaluate((u) => __ab.ready(u, { endActive: true }), wak);
    const wakN = await page.evaluate((u) => __ab.abil(u).n, wak);
    const aim7b = await aimFromSlot('.bt-ab[data-id="wakaba.timeOut"]');
    const aiming = aim7b.aiming;
    if (!aiming || aim7b.tries > 1) console.log(`  (step 7b aim: ${JSON.stringify(aim7b)})`);
    await page.evaluate(() => window.__battle.ui.onCardTap('akane'));
    await settle(page, 150);
    const afterArm = await page.evaluate(() => ({ aim: window.__battle.ui.aim.abilityId, banner: !document.querySelector('[data-testid="aim-banner"]').hidden, placing: window.__battle.ui.placement.unitId }));
    check(aiming === 'wakaba.timeOut' && afterArm.aim == null && !afterArm.banner && afterArm.placing === 'akane',
      `${vp} arming a card ends the ability aim (was ${aiming}; now ${JSON.stringify(afterArm)})`);
    const spot = await page.evaluate(() => __ab.spotOnScreen('akane'));
    const akBefore = await page.evaluate(() => window.__battle.sim.towers.filter((t) => t.unitId === 'akane').length);
    if (spot) await tapAt(spot.x, spot.y);
    await settle(page, 200);
    const akAfter = await page.evaluate(() => window.__battle.sim.towers.filter((t) => t.unitId === 'akane').length);
    const wakAfter = await page.evaluate((u) => __ab.abil(u).n, wak);
    check(!!spot && akAfter === akBefore + 1 && wakAfter === wakN, `${vp} the placement tap places Akane and fires nothing (Akane ${akBefore}→${akAfter}, Time Out! ${wakN}→${wakAfter})`);
    await page.evaluate(() => window.__battle.ui.placement.cancel());

    // ---- 7c. the aim banner from her panel's FIRE: inside the map beside the panel, the feed below it (M1 review r2) --
    // (the wave may have cleared meanwhile: FIRE reads WAVE between waves, so the next one starts)
    await page.evaluate((u) => __ab.ready(u), wak);
    await page.evaluate((u) => window.__battle.ui.select(u), wak);
    await page.waitForSelector('[data-testid="tower-panel"]:not([hidden]) [data-testid="ability-fire"]', { timeout: 10000 });
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => __ab.keepWave());
      if (await until(page, () => window.__battle.sim.state === 'wave' && document.querySelector('[data-testid="tower-panel"] [data-testid="ability-fire"]')?.textContent === 'FIRE', null, 8000)) break;
    }
    await settle(page, 300);
    const fireBefore = await page.evaluate((u) => ({ label: document.querySelector('[data-testid="tower-panel"] [data-testid="ability-fire"]')?.textContent, st: window.__battle.sim.abilityStatus(u), state: window.__battle.sim.state }), wak);
    await tap('[data-testid="tower-panel"] [data-testid="ability-fire"]');
    await settle(page, 200);
    const aimNow = await page.evaluate(() => ({ aim: window.__battle.ui.aim.abilityId, banner: !document.querySelector('[data-testid="aim-banner"]').hidden, toasts: __ab.toasts() }));
    if (!aimNow.banner) console.log(`  (FIRE before the tap: ${JSON.stringify(fireBefore)}; after: ${JSON.stringify(aimNow)})`);
    // (15 s: a slow software-rendered frame can let a few real seconds pass before the read below)
    await page.evaluate(() => window.__battle.ui.feed.push('Tap a point on the map.', 'warn', { key: 'e2e-aim-feed', ms: 15000 }));
    await settle(page, 250);
    const panelAim = await page.evaluate(() => {
      const b = document.querySelector('[data-testid="aim-banner"]');
      if (!b || b.hidden) return null;
      const r = b.getBoundingClientRect();
      const p = document.querySelector('[data-testid="tower-panel"]').getBoundingClientRect();
      const t = [...document.querySelectorAll('[data-testid="battle-feed"] .bt-toast')].find((n) => /Tap a point on the map/.test(n.textContent))?.getBoundingClientRect();
      const meets = (a, c) => !!a && !!c && a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
      return {
        text: b.textContent, left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), panelLeft: Math.round(p.left),
        width: innerWidth, toast: t ? [Math.round(t.left), Math.round(t.top), Math.round(t.right), Math.round(t.bottom)] : null, toastUnder: meets(r, t),
      };
    });
    check(!!panelAim && /tap FIRE again/.test(panelAim.text) && panelAim.left >= 0 && panelAim.right <= panelAim.panelLeft,
      `${vp} the aim banner from her panel's FIRE stays on screen and left of the panel (${JSON.stringify(panelAim)})`);
    const feedNow = panelAim?.toast ? null : await page.evaluate(() => [...document.querySelectorAll('[data-testid="battle-feed"] .bt-toast')].map((n) => `${n.dataset.key || '-'}:${n.className.replace('bt-toast ', '')}:${n.textContent.slice(0, 40)}`));
    check(!!panelAim?.toast && !panelAim.toastUnder, `${vp} a toast during the aim is not under the banner (${JSON.stringify(panelAim?.toast)}${feedNow ? `; feed: ${JSON.stringify(feedNow)}` : ''})`);
    await shot('e2e-panel-aim');
    await page.keyboard.press('Escape');
    await settle(page, 150);
    check(!(await page.locator('[data-testid="aim-banner"]').isVisible()), `${vp} Esc ends the panel's aim`);

    // ---- 8. the DOM probe: overlaps, sizes, the panel row in view ----------------------------------------------
    await page.evaluate(() => window.__battle.ui.select(null));
    await settle(page, 300);
    probes.idle = await uiProbe(page, { boxes: BATTLE_BOXES });
    console.log(`  probe (idle): ${formatProbe(probes.idle)}`);
    const barOverlaps = probes.idle.overlaps.filter((o) => o.a === 'bar' || o.b === 'bar');
    check(barOverlaps.length === 0, `${vp} the bar overlaps nothing (${JSON.stringify(barOverlaps)})`);
    check(!probes.idle.overflowX, `${vp} no sideways scroll`);
    const sizes = await page.evaluate(() => [...document.querySelectorAll('.bt-abar-list .bt-ab')].map((b) => [b.offsetWidth, b.offsetHeight]));
    check(sizes.length > 0 && sizes.every(([w, h]) => w >= 44 && h >= 44), `${vp} slots ≥ 44 px (${JSON.stringify(sizes)})`);
    await page.evaluate((u) => window.__battle.ui.select(u), aoi);
    await settle(page, 450);
    // (the drawer slides in and the bar moves aside, 0.22 s each: on a slow frame rate wait until both have landed)
    await until(page, () => {
      const b = document.querySelector('[data-testid="ability-bar"]')?.getBoundingClientRect();
      const p = document.querySelector('[data-testid="tower-panel"]')?.getBoundingClientRect();
      return !b || !p || b.right <= p.left || b.bottom <= p.top;
    }, null, 5000);
    probes.panel = await uiProbe(page, { boxes: BATTLE_BOXES });
    console.log(`  probe (panel): ${formatProbe(probes.panel)}`);
    const panelBar = probes.panel.overlaps.filter((o) => o.a === 'bar' || o.b === 'bar');
    check(panelBar.length === 0, `${vp} with her panel open the bar overlaps nothing (${JSON.stringify(panelBar)})`);
    // (at the top of the panel, as it opens: "without scrolling")
    const fold = await page.evaluate(() => {
      const p = document.querySelector('[data-testid="tower-panel"] .bt-panel-scroll');
      const r = document.querySelector('[data-testid="tower-panel"] [data-testid="ability-row"]');
      if (!p || !r) return null;
      p.scrollTop = 0;
      const a = p.getBoundingClientRect();
      const b = r.getBoundingClientRect();
      const buy = p.querySelector('.bt-buy:not(.poor):not([disabled])');
      const c = buy?.getBoundingClientRect();
      return {
        row: b.top >= a.top - 1 && b.bottom <= a.bottom + 1, rowH: Math.round(b.height),
        buy: buy ? buy.dataset.testid : null, buyIn: !!c && c.top >= a.top - 1 && c.bottom <= a.bottom + 1, at: c ? [Math.round(c.top), Math.round(c.bottom)] : null, viewport: [Math.round(a.top), Math.round(a.bottom)],
      };
    });
    check(!!fold?.row, `${vp} her ability row is in view without scrolling`);
    // ABILITIES_SPEC §8.4: about 44 px on a phone, so the row never pushes the first Buy button below the fold
    if (touch) check((fold?.rowH || 99) <= 46, `${vp} the phone ability row is one line (${fold?.rowH} px)`);
    check(!!fold?.buy && fold.buyIn, `${vp} the first affordable Buy button is fully in view with the row present (${JSON.stringify(fold)})`);
    if (touch) {
      // her live line and Auto open with a tap on the ability's name (and close again)
      const lineShown = () => page.evaluate(() => {
        const l = document.querySelector('[data-testid="tower-panel"] [data-testid="ability-line"]');
        return l && l.getClientRects().length ? l.textContent : null;
      });
      const before = await lineShown();
      await tap('[data-testid="tower-panel"] [data-testid="ability-row-name"]');
      await settle(page, 100);
      const opened = await lineShown();
      await shot('e2e-row-open');
      await tap('[data-testid="tower-panel"] [data-testid="ability-row-name"]');
      await settle(page, 100);
      check(before == null && !!opened && (await lineShown()) == null, `${vp} a tap on her ability's name opens its live line ("${opened}") and closes it`);
    }
    await shot('e2e-panel');
    await page.evaluate(() => window.__battle.ui.select(null));

    // ---- 9. Continue keeps a charging ability and the Auto switch (battle save) ---------------------------------
    await page.evaluate(() => clearInterval(window.__keepWave));
    await page.evaluate((u) => __ab.ready(u, { cd: Math.round(window.__battle.sim.getTower(u).abil.cdMax * 0.7), auto: true }), aoi);
    check(await gameUntil(() => window.__battle.sim.state === 'between', null, 120), `${vp} the wave clears`);
    await settle(page, 400);
    const kept = await page.evaluate(([a, m]) => {
      const s = window.__battle.sim;
      window.__battle.save?.flush?.();
      return { aoi: { cd: s.getTower(a).abil.cd, auto: s.getTower(a).abil.auto }, momo: { auto: s.getTower(m).abil.auto } };
    }, [aoi, momo]);
    check(kept.aoi.cd > 0, `${vp} Aoi still charging at the calm point (${kept.aoi.cd})`);
    await page.reload({ waitUntil: 'load', timeout: 120000 }); // (a cold dev-server reload of the battle: slow under load)
    await page.waitForFunction(() => window.__battle?.sim?.towers?.length > 0, null, { timeout: 90000 });
    await settle(page, 600);
    const back = await page.evaluate(() => {
      const s = window.__battle.sim;
      const find = (id) => s.towers.find((t) => t.unitId === id && t.abil);
      return { aoi: find('aoi')?.abil, momo: find('momo')?.abil, slots: document.querySelectorAll('.bt-abar-list .bt-ab').length };
    });
    check(back.aoi && back.aoi.cd === kept.aoi.cd && back.aoi.auto === true, `${vp} Continue: Aoi's cooldown (${back.aoi?.cd}) and Auto (${back.aoi?.auto}) came back`);
    check(back.momo?.auto === true, `${vp} Continue: Momo's Auto came back`);
    check(back.slots >= 3, `${vp} Continue: the bar is back (${back.slots} slots)`);
  } catch (e) {
    check(false, `${vp} threw: ${e.stack || e.message}`);
    const state = await page.evaluate(() => ({
      panel: !document.querySelector('[data-testid="tower-panel"]')?.hidden, selected: window.__battle?.ui?.selectedUid, placing: window.__battle?.ui?.placement?.unitId,
      state: window.__battle?.sim?.state, paused: window.__battle?.ui?.paused, toasts: window.__ab?.toasts?.(),
    })).catch(() => null);
    console.log(`  state at the failure: ${JSON.stringify(state)}`);
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `e2e-fail-${vp}.png`) }).catch(() => {});
  }
  check(errors.length === 0, `${vp} no page or console errors${errors.length ? `: ${errors.slice(0, 5).join(' | ')}` : ''}`);
  report[vp] = { probes, errors };
  await page.close();
}

await browser.close();
await server.close();
if (opt('report')) writeFileSync(opt('report'), JSON.stringify(report, null, 2));
console.log(fails.length ? `\n${fails.length} FAILED:\n  ${fails.join('\n  ')}` : '\nall ability bar checks passed');
process.exit(fails.length ? 1 : 0);
