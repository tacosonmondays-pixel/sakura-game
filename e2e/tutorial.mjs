// End-to-end check of the coached first battle and the chapter hooks (STORY_SPEC §2, §1.4; E-story tutorial part).
// Boots the real game in Chromium at 844×390 (landscape phone, touch) and 1280×720 (mouse):
//   · fresh save: TAP TO START → "Meet Hikari" → Skip → the 1-1 Easy battle with Hikari's coach: the drag hand
//     shows where to drop Aoi, a REAL drag completes step 1, Start wave step 2, then Hikari, Aoi's first upgrade
//     (through the bubble's "Show Aoi"), speed and the encouragement; the win plays "First Petals" over the victory
//     sheet (with no freeplay "Keep going" block), Hikari points at Rewards then Home; Home → the lobby; the
//     tutorial is done and never comes back
//   · Skip tutorial (asks first) → the battle goes on without the coach, tutorial skipped for good
//   · a defeat: Hikari's card on the defeat sheet → Retry with Hikari remounts the coached battle
//   · 1-1 stage prep after an unfinished tutorial: "Shall we finish our first lesson together?" → Start / Not now
//   · chapter hooks: a REAL 1-2 win → Next Stage → 1-3 prep plays the 1-2 epilogue ("Snow in Spring") first;
//     1-5 prep plays its finale intro once; the archive replays both
//   · a legacy save meets none of this
//
//   node e2e/tutorial.mjs                          # both viewports
//   node e2e/tutorial.mjs --viewport 844x390 --shots <dir>
// Exit code 1 if any check fails. Starts its own Vite dev server on a free port (closed at the end).
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720'];
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

const SAVE_KEY = 'sakura-sentinels-save-v1';
const BETA_SHOWN_KEY = 'sakura-beta-gift-shown';
const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i,
  /favicon\.ico/i,
  /Failed to load resource: net::ERR_(CERT_AUTHORITY_INVALID|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|PROXY_CONNECTION_FAILED|TUNNEL_CONNECTION_FAILED|CONNECTION_REFUSED)/i,
];

const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  if (cond) log(`  ok   ${msg}`);
  else {
    log(`  FAIL ${msg}`);
    failures.push(msg);
  }
  return cond;
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/`;

const { createProfile } = await server.ssrLoadModule('/src/systems/save.js');
const { CAMPAIGN_IDS } = await server.ssrLoadModule('/src/data/stages.js');
/** A save built by the game's own code: campaign cleared up to `upTo`, story state merged in. */
function seeded({ upTo = null, legacy = false, story = {} } = {}) {
  const p = createProfile();
  for (const id of CAMPAIGN_IDS) {
    if (!upTo) break;
    p.progress.stages[id] = { clears: 1, easy: false, normal: true, hard: false, nightmare: false };
    if (id === upTo) break;
  }
  if (legacy) {
    // a save from before the story: no block, and never the 'story:new' mark a story-era save carries
    delete p.story;
    delete p.missions.counters['story:new'];
  } else Object.assign(p.story, story);
  return JSON.stringify(p);
}

let browser;
try {
  const launched = await launchChromium();
  browser = launched.browser;
  log(`browser: ${launched.label}`);
} catch (e) {
  await server.close();
  throw e;
}

async function runViewport(vp) {
  const [w, hgt] = vp.split('x').map(Number);
  const touch = Math.min(w, hgt) < 600;
  log(`\n=== viewport ${vp}${touch ? ' (touch)' : ''} ===`);

  const newPage = async ({ save = null } = {}) => {
    const context = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, hasTouch: touch });
    if (save) await context.addInitScript(([k, v]) => { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, [SAVE_KEY, save]);
    await context.addInitScript((k) => sessionStorage.setItem(k, '1'), BETA_SHOWN_KEY);
    // where the coach put its ring (its target geometry: under SwiftShader a CSS glide can lag behind for seconds)
    await context.addInitScript(() => {
      window.__ringBox = () => {
        const ring = document.querySelector('.tc-ring');
        const l = ring.parentElement.getBoundingClientRect();
        const n = (k) => parseFloat(ring.style[k]) || 0;
        const left = l.left + n('left');
        const top = l.top + n('top');
        return { left, top, right: left + n('width'), bottom: top + n('height'), on: ring.classList.contains('on') };
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (!IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
    });
    page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
    page.on('requestfailed', (r) => { if (r.url().startsWith(base)) errors.push(`[requestfailed] ${r.url()}`); });
    return { context, page, errors };
  };
  const shot = async (page, name) => {
    if (!shotsDir) return;
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 150))))).catch(() => {});
    // show where things settle: under SwiftShader a 0.2 s CSS transition can still be on its first frame here
    await page.evaluate(() => document.getAnimations().forEach((a) => { if (a.constructor?.name === 'CSSTransition') a.finish(); })).catch(() => {});
    await page.screenshot({ path: `${shotsDir}/${vp}-${name}.png`, timeout: 60000 }).catch((e) => log(`  (screenshot ${name} skipped: ${e.message.split('\n')[0]})`));
  };
  const story = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__sakura.store.profile.story)));
  const coachStep = (page) => page.evaluate(() => document.querySelector('[data-testid="coach"]')?.dataset.step ?? null);
  const waitStep = (page, id, timeout = 15000) => page.waitForFunction((s) => document.querySelector('[data-testid="coach"]')?.dataset.step === s
    && document.querySelector('[data-testid="coach-bubble"]')?.classList.contains('on'), id, { timeout, polling: 200 }).then(() => true, () => false);
  const errorsOk = (errors, label) => check(!errors.length, `${label}: no errors${errors.length ? `\n       ${errors.slice(0, 5).join('\n       ')}` : ''}`);
  const waitBattle = async (page) => {
    await page.waitForFunction(() => window.__battle?.ui?.placement && window.__battle?.renderer, null, { timeout: 90000, polling: 200 }).catch(() => null);
    // the battle slides in (slow under SwiftShader): aim only once the board stopped moving
    await page.waitForFunction(() => {
      for (let el = window.__battle?.renderer?.canvas; el; el = el.parentElement) {
        if (el.getAnimations().some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity)) return false;
      }
      return true;
    }, null, { timeout: 15000 }).catch(() => null);
  };
  /**
   * Advance the sim in big steps until `until(sim)` (in-page), never placing or buying anything. With
   * `startWaves`, the next wave is started whenever the board is quiet (like a player tapping Next wave).
   */
  const fastForward = (page, until, max = 600, { startWaves = false } = {}) => page.evaluate(async ([src, n, auto]) => {
    const fn = new Function('sim', `return (${src})(sim)`);
    const { sim } = window.__battle;
    for (let i = 0; i < n && !fn(sim) && sim.state !== 'won' && sim.state !== 'lost'; i++) {
      for (let k = 0; k < 8 && !fn(sim); k++) {
        if (auto && sim.state === 'between') sim.startNextWave();
        sim.update(0.25);
      }
      await new Promise((r) => setTimeout(r, 16));
    }
    return { state: sim.state, wave: sim.wave, cash: sim.cash };
  }, [until.toString(), max, startWaves]);
  /** A real pointer drag: press a card, move up and over, release at (rx, ry). Mouse or touch. */
  const realDrag = async (page, context, cardSel, rx, ry) => {
    const card = page.locator(cardSel);
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    const sx = box.x + box.width / 2;
    const sy = box.y + box.height / 2;
    const route = [1, 2, 3].map((i) => [sx, sy - 10 * i]);
    for (let i = 1; i <= 15; i++) route.push([sx + ((rx - sx) * i) / 15, sy - 30 + ((ry - (sy - 30)) * i) / 15]);
    if (touch) {
      const cdp = await context.newCDPSession(page);
      const ev = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
      await ev('touchStart', sx, sy);
      for (const [x, y] of route) await ev('touchMove', x, y);
      await page.waitForTimeout(250);
      await ev('touchEnd');
      await cdp.detach();
    } else {
      await page.mouse.move(sx, sy);
      await page.mouse.down();
      for (const [x, y] of route) await page.mouse.move(x, y);
      await page.waitForTimeout(250);
      await page.mouse.up();
    }
  };

  // ---------------------------------------------------------------- the whole first-time flow
  {
    const { context, page, errors } = await newPage();
    await page.goto(base, { waitUntil: 'load' });
    const start = await page.waitForSelector('[data-testid="title-start"]:not([disabled])', { timeout: 30000 }).catch(() => null);
    if (start) await start.click({ force: true });
    await page.waitForSelector('[data-testid="story-player"].sp-ready', { timeout: 20000 }).catch(() => null);
    check(await page.evaluate(() => location.hash.startsWith('#/scene/opening')), 'fresh save: TAP TO START opens "Meet Hikari"');
    await page.keyboard.press('Escape');
    await page.click('[data-testid="story-skip-confirm"]', { force: true });
    await page.waitForFunction(() => location.hash.includes('tutorial=1'), null, { timeout: 20000, polling: 200 }).catch(() => null);
    await waitBattle(page);

    // step 1: the coach shows Aoi's card, the drag hand and the spot
    const placeOk = await waitStep(page, 'place', 20000);
    check(placeOk, 'tutorial battle: the coach opens on "Meet your first defender!"');
    const first = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="coach"]');
      const bubble = document.querySelector('[data-testid="coach-bubble"]');
      const hand = document.querySelector('[data-testid="coach-hand"]');
      const card = document.querySelector('[data-testid="card-aoi"]').getBoundingClientRect();
      const r = window.__ringBox();
      return {
        title: bubble.querySelector('.tc-title').textContent,
        body: bubble.querySelector('.tc-body').textContent,
        hand: hand.classList.contains('on'),
        scrim: document.querySelector('.tc-scrim').classList.contains('on'),
        ringOnCard: r.on && r.left <= card.left + 1 && r.right >= card.right - 1 && r.top <= card.top + 1,
        spot: root.dataset.spotX ? [Number(root.dataset.spotX), Number(root.dataset.spotY)] : null,
        layer: (() => { const l = document.querySelector('.bt-layer').getBoundingClientRect(); return [l.left, l.top]; })(),
        sim: { wave: window.__battle.sim.wave, state: window.__battle.sim.state, towers: window.__battle.sim.towers.length },
        bubbleRect: (() => { const b = bubble.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round); })(),
      };
    });
    check(/Aoi/.test(first.body) && first.hand && first.scrim && first.ringOnCard && !!first.spot, `step 1: bubble names Aoi from data, ring on her card, scrim + drag hand (${JSON.stringify({ hand: first.hand, scrim: first.scrim, ring: first.ringOnCard, spot: first.spot, bubble: first.bubbleRect })})`);
    check(first.sim.state === 'prep' && first.sim.wave === 0, 'step 1: the coach never starts or pauses anything (still in prep)');
    await page.waitForTimeout(700); // let the hand reach the spot
    await shot(page, 'coach-1-place');

    // no Upgrade Tree in the coached battle: a new player who presses and waits on Aoi's card (or
    // right-clicks it) must not pause the battle behind the tree and hide the coach. The press ends
    // in a pointercancel, so it is no tap either (the real drag below still starts from scratch).
    const held = await page.evaluate(async () => {
      const card = document.querySelector('[data-testid="card-aoi"]');
      const r = card.getBoundingClientRect();
      const o = { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
      card.dispatchEvent(new PointerEvent('pointerdown', o));
      await new Promise((res) => setTimeout(res, 1000));
      const during = { tree: !!window.__battle.ui.tree?.isOpen, paused: !!window.__battle.ui.paused };
      card.dispatchEvent(new PointerEvent('pointercancel', o));
      card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: o.clientX, clientY: o.clientY }));
      await new Promise((res) => setTimeout(res, 300));
      return {
        ...during,
        treeAfter: !!window.__battle.ui.tree?.isOpen,
        coachHidden: document.querySelector('[data-testid="coach"]').hidden,
        placing: window.__battle.ui.placement.unitId ?? null,
      };
    });
    check(!held.tree && !held.paused && !held.treeAfter && !held.coachHidden && !held.placing && await coachStep(page) === 'place',
      `step 1: holding (or right-clicking) Aoi's card opens no Upgrade Tree in the coached battle (${JSON.stringify(held)})`);

    // a REAL drag of Aoi's card to the spot the hand shows (touch: release below it, like the hand)
    if (first.spot) {
      const lift = touch ? 46 : 0;
      await realDrag(page, context, '[data-testid="card-aoi"]', first.layer[0] + first.spot[0], first.layer[1] + first.spot[1] + lift);
    }
    const placed = await page.waitForFunction(() => window.__battle.sim.towers.some((t) => t.unitId === 'aoi'), null, { timeout: 8000, polling: 200 }).then(() => true, () => false);
    check(placed, 'step 1: a real drag of Aoi onto the hand\'s spot places her');
    const startOk = await waitStep(page, 'start', 6000);
    check(startOk, 'step 2: "Ready, Sensei?" points at Start wave');
    await shot(page, 'coach-2-start');
    await page.click('[data-testid="start-wave"]', { force: true });
    await page.waitForFunction(() => window.__battle.sim.wave >= 1, null, { timeout: 8000, polling: 200 }).catch(() => null);
    await page.waitForTimeout(500);
    check(await coachStep(page) === '', `wave 1 running: the coach steps back (step="${await coachStep(page)}")`);

    // between waves: step 3 (Hikari)
    await fastForward(page, (sim) => sim.state === 'between');
    const heroOk = await waitStep(page, 'hero', 6000);
    check(heroOk, 'step 3: between waves, Hikari asks to be deployed (her card is lit)');
    await shot(page, 'coach-3-hero');
    // place her through the battle's own placement controller on the next suggested spot (the drag itself was
    // already exercised above)
    await page.evaluate(() => {
      const { sim, ui } = window.__battle;
      for (let y = 0.25; y < sim.map.height; y += 0.5) {
        for (let x = 0.25; x < sim.map.width; x += 0.5) {
          if (!sim.canPlace('hikari', x, y).ok) continue;
          ui.placement.start('hikari');
          if (ui.placement.tryPlace(x, y)) return;
          ui.placement.cancel();
        }
      }
    });
    // step 4: Aoi's first upgrade, via the bubble's "Show Aoi"
    const upOk = await waitStep(page, 'upgrade', 8000);
    check(upOk, 'step 4: "A tiny upgrade" circles Aoi on the board');
    const ringRound = await page.evaluate(() => document.querySelector('.tc-ring').classList.contains('round'));
    check(ringRound, 'step 4: the ring sits on Aoi herself (round) until her panel opens');
    await shot(page, 'coach-4-upgrade-board');
    await page.click('[data-testid="coach-show"]', { force: true });
    await page.waitForSelector('[data-testid="tower-panel"]:not([hidden])', { timeout: 15000 }).catch(() => null);
    // the coach re-aims on its next 200 ms tick
    const onBuy = await page.waitForFunction(() => {
      const r = window.__ringBox();
      const btns = [...document.querySelectorAll('[data-testid="tower-panel"]:not([hidden]) [data-testid^="buy-"]')];
      const hit = btns.find((b) => { const q = b.getBoundingClientRect(); return r.on && r.left <= q.left + 1 && r.right >= q.right - 1 && r.top <= q.top + 1 && r.bottom >= q.bottom - 1; });
      return hit?.dataset.testid || null;
    }, null, { timeout: 10000, polling: 200 }).then((hnd) => hnd.jsonValue(), () => null);
    check(!!onBuy, `step 4: with her panel open the ring moves to a buy button (${onBuy})`);
    await shot(page, 'coach-4-upgrade-panel');
    if (onBuy) await page.click(`[data-testid="${onBuy}"]`, { force: true });
    await page.waitForFunction(() => window.__battle.sim.towers.some((t) => !t.isHero && t.tiers.some((n) => n > 0)), null, { timeout: 5000, polling: 200 }).catch(() => null);
    await page.click('[data-testid="panel-close"]', { force: true }).catch(() => {});
    // step 5: speed (from wave 2). On a loaded machine wave 1 may still be running here: wait for the button, and
    // skip the tap if the next wave is already under way. The tip's 8 s window starts once the page has wave 2
    // running: at 1280x720 SwiftShader frames can stall the page for seconds under load, so the tap itself (and
    // the NEXT WAVE button it needs, which the frame loop shows) can land late; the tip must not.
    const startBtn = await page.waitForSelector('[data-testid="start-wave"]:not([hidden])', { timeout: 15000 }).catch(() => null);
    if (startBtn && (await page.evaluate(() => window.__battle.sim.wave < 2))) await startBtn.click({ force: true }).catch(() => {});
    await page.waitForFunction(() => window.__battle.sim.wave >= 2, null, { timeout: 20000, polling: 200 }).catch(() => null);
    const spOk = await waitStep(page, 'speed', 8000);
    const sp = await page.evaluate(() => {
      const { sim, ui } = window.__battle;
      const r = window.__ringBox();
      const q = document.querySelector('[data-testid="speed"]')?.getBoundingClientRect();
      const cx = q ? q.left + q.width / 2 : NaN;
      const cy = q ? q.top + q.height / 2 : NaN;
      return {
        step: document.querySelector('[data-testid="coach"]')?.dataset.step,
        bubbleOn: !!document.querySelector('[data-testid="coach-bubble"]')?.classList.contains('on'),
        ringOnSpeed: r.on && r.left <= cx && cx <= r.right && r.top <= cy && cy <= r.bottom,
        wave: sim.wave, state: sim.state, hero: !!sim.hero, paused: !!ui.paused,
      };
    }).catch((e) => ({ error: e.message }));
    check(spOk && sp.ringOnSpeed, `step 5: from wave 2, the speed button is lit${spOk && sp.ringOnSpeed ? '' : ` (${JSON.stringify(sp)})`}`);
    await shot(page, 'coach-5-speed');
    await page.click('[data-testid="speed"]', { force: true });
    const freeOk = await waitStep(page, 'free', 5000);
    check(freeOk, 'step 7: all core steps done → "One petal at a time." encouragement');
    await shot(page, 'coach-7-free');
    await page.waitForFunction(() => !document.querySelector('[data-testid="coach-bubble"]')?.classList.contains('on') && !document.querySelector('[data-testid="coach-pill"]')?.hidden, null, { timeout: 9000, polling: 200 }).catch(() => null);
    check(await page.evaluate(() => !document.querySelector('[data-testid="coach-pill"]').hidden), 'the encouragement folds into the "Hikari\'s tips" pill after a few seconds');
    await shot(page, 'coach-pill');

    // to the end: the ultimate tip when it is ready, then the win
    const ult = await fastForward(page, (sim) => sim.heroUltStatus().ready, 900, { startWaves: true });
    if (ult.state !== 'won' && ult.state !== 'lost') {
      const ultOk = await waitStep(page, 'ult', 5000);
      check(ultOk, `step 6: the ultimate tip opens itself when Celestial Bloom is ready (wave ${ult.wave})`);
      await shot(page, 'coach-6-ult');
      // the HUD repaints the button on render frames, which SwiftShader can stall after a fast-forward: a locked
      // (disabled) paint swallows the tap, so wait for the lit button like a player would
      await page.waitForSelector('[data-testid="ult"].ready', { timeout: 10000 }).catch(() => null);
      await page.click('[data-testid="ult"]', { force: true });
      await page.waitForFunction(() => window.__battle.sim.stats.ultsUsed > 0, null, { timeout: 5000, polling: 200 }).catch(() => null);
      check(await page.evaluate(() => window.__battle.sim.stats.ultsUsed > 0), 'step 6: tapping the lit button fires her ultimate');
    }
    // play out the rest (autostart; upgrades like a player would)
    const end = await page.evaluate(async () => {
      const { sim, ui } = window.__battle;
      ui.setAutoStart(true);
      for (let i = 0; i < 900 && sim.state !== 'won' && sim.state !== 'lost'; i++) {
        for (const t of sim.towers) for (const p of [0, 1, 2]) { const st = sim.upgradeStatus(t.uid, p); if (!st.locked && sim.cash >= st.cost) sim.upgradeTower(t.uid, p); }
        for (let k = 0; k < 8; k++) sim.update(0.25);
        if (sim.state === 'between') sim.startNextWave();
        await new Promise((r) => setTimeout(r, 16));
      }
      return { state: sim.state, lives: sim.lives };
    });
    check(end.state === 'won', `the coached 1-1 Easy is won (${JSON.stringify(end)})`);
    // the coach notices the win on its own 200 ms timer (a loaded machine can stall it for a moment)
    await page.waitForFunction(() => window.__sakura.store.profile.story.tutorial === 'done', null, { timeout: 4000, polling: 200 }).catch(() => null);
    check((await story(page)).tutorial === 'done', 'the win marks the tutorial done right away');
    const outro = await page.waitForSelector('.sp.sp-overlay[data-scene="tut.outro"].sp-ready', { timeout: 20000 }).catch(() => null);
    check(!!outro && await page.evaluate(() => !!document.querySelector('[data-testid="result"]:not([hidden])')), '"First Petals" plays over the victory sheet');
    await page.waitForSelector('.sp-box.sp-full', { timeout: 8000 }).catch(() => null);
    await shot(page, 'outro-over-results');
    await page.click('[data-testid="story-skip"]', { force: true });
    await page.click('[data-testid="story-skip-confirm"]', { force: true });
    await page.waitForFunction(() => !document.querySelector('.sp'), null, { timeout: 8000, polling: 200 }).catch(() => null);
    const ptr = await page.waitForSelector('[data-testid="coach-inline-rewards"]', { timeout: 6000 }).catch(() => null);
    check(!!ptr && await page.evaluate(() => document.querySelector('[data-testid="view-rewards"]')?.classList.contains('tc-pulse')), 'after the outro Hikari points at Rewards on the sheet');
    // a brand-new player's first win ends here: no freeplay "Keep going" block on the coached victory sheet
    check(await page.evaluate(() => !!document.querySelector('[data-testid="result"]') && !document.querySelector('[data-testid="keep-going-block"], [data-testid="keep-going"]')),
      'the coached victory sheet has no "Keep going" (freeplay) block');
    await shot(page, 'pointer-rewards');
    await page.click('[data-testid="view-rewards"]', { force: true });
    const homePtr = await page.waitForSelector('[data-testid="coach-inline-home"]', { timeout: 6000 }).catch(() => null);
    check(!!homePtr && await page.evaluate(() => document.querySelector('[data-testid="home"]')?.classList.contains('tc-pulse')), '…then at Home on the rewards sheet');
    check(await page.evaluate(() => !!document.querySelector('[data-testid="rewards"]') && !document.querySelector('[data-testid="keep-going-block"], [data-testid="keep-going"]')),
      '…and the coached rewards sheet has no "Keep going" block either');
    await shot(page, 'pointer-home');
    const s1 = await story(page);
    check(s1.seen.includes('tut.outro') && s1.tutorial === 'done', `the outro counts as seen (${s1.tutorial}, seen: ${s1.seen.join(', ')})`);
    await page.click('[data-testid="home"]', { force: true });
    await page.waitForFunction(() => location.hash.startsWith('#/lobby'), null, { timeout: 10000, polling: 200 }).catch(() => null);
    await page.waitForTimeout(1200);
    check(await page.evaluate(() => location.hash.startsWith('#/lobby') && !document.querySelector('.sp')), 'Home → the lobby, nothing forced');
    // 1-1 prep: no prompt once the tutorial is done
    await page.evaluate(() => { location.hash = '#/stage/1-1'; });
    await page.waitForTimeout(1800);
    check(await page.evaluate(() => !document.querySelector('[data-testid="tutorial-prompt"]')), '1-1 prep after the tutorial: no prompt');
    errorsOk(errors, 'coached first battle');
    await context.close();
  }

  // ---------------------------------------------------------------- Skip tutorial
  {
    const { context, page, errors } = await newPage({ save: seeded({ story: { opening: 'skipped', seen: ['opening'] } }) });
    await page.goto(`${base}#/battle?stage=1-1&difficulty=easy&tutorial=1`, { waitUntil: 'load' });
    await waitBattle(page);
    check(await waitStep(page, 'place', 20000), 'skip: the coach is up');
    await page.click('[data-testid="coach-min"]', { force: true });
    check(await page.evaluate(() => !document.querySelector('[data-testid="coach-bubble"]').classList.contains('on') && !document.querySelector('[data-testid="coach-pill"]').hidden), '[–] folds the tips into the pill');
    await page.click('[data-testid="coach-pill"]', { force: true });
    check(await page.evaluate(() => document.querySelector('[data-testid="coach-bubble"]').classList.contains('on')), 'the pill opens them again');
    await page.click('[data-testid="coach-skip"]', { force: true });
    await page.waitForSelector('[data-testid="confirm-ok"]', { timeout: 5000 }).catch(() => null);
    await shot(page, 'coach-skip-confirm');
    await page.click('[data-testid="confirm-cancel"]', { force: true });
    await page.waitForTimeout(300);
    check(await page.evaluate(() => !!document.querySelector('[data-testid="coach"]')) && (await story(page)).tutorial === 'pending', 'Keep going: the coach stays');
    await page.click('[data-testid="coach-skip"]', { force: true });
    await page.waitForSelector('[data-testid="confirm-ok"]', { timeout: 5000 }).catch(() => null);
    await page.click('[data-testid="confirm-ok"]', { force: true });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({ coach: !!document.querySelector('[data-testid="coach"]'), battle: !!window.__battle, state: window.__battle?.sim.state, tutorial: window.__sakura.store.profile.story.tutorial }));
    check(!after.coach && after.battle && after.state === 'prep' && after.tutorial === 'skipped', `Skip: the coach leaves, the battle goes on, tutorial skipped (${JSON.stringify(after)})`);
    await page.evaluate(() => { location.hash = '#/stage/1-1'; });
    await page.waitForTimeout(1800);
    check(await page.evaluate(() => !document.querySelector('[data-testid="tutorial-prompt"]')), 'a skipped tutorial is never asked again');
    errorsOk(errors, 'skip tutorial');
    await context.close();
  }

  // ---------------------------------------------------------------- defeat → Retry with Hikari; 1-1 prep prompt
  {
    const { context, page, errors } = await newPage({ save: seeded({ story: { opening: 'skipped', seen: ['opening'] } }) });
    await page.goto(`${base}#/battle?stage=1-1&difficulty=easy&tutorial=1`, { waitUntil: 'load' });
    await waitBattle(page);
    await waitStep(page, 'place', 20000);
    // nobody defends: let the slimes through until the gate falls
    await page.evaluate(() => window.__battle.ui.startWave());
    await page.evaluate(async () => {
      const { sim } = window.__battle;
      for (let i = 0; i < 400 && sim.state !== 'lost'; i++) {
        const e = sim.enemies.find((x) => !x.dead);
        if (e) { sim.lives = Math.min(sim.lives, 1); sim._leak(e); }
        sim.update(0.25);
        if (sim.state === 'between') sim.startNextWave();
        await new Promise((r) => setTimeout(r, 10));
      }
    });
    const lostCard = await page.waitForSelector('[data-testid="coach-inline-lost"]', { timeout: 15000 }).catch(() => null);
    check(!!lostCard && (await story(page)).tutorial === 'pending', 'defeat: Hikari\'s card on the defeat sheet (tutorial still pending)');
    await shot(page, 'coach-lost');
    await page.click('[data-testid="coach-retry"]', { force: true });
    await page.waitForFunction(() => window.__battle?.sim?.state === 'prep' && window.__battle.sim.wave === 0, null, { timeout: 30000, polling: 200 }).catch(() => null);
    await waitBattle(page);
    check(await waitStep(page, 'place', 20000), 'Retry with Hikari: a fresh coached battle');
    // quit → the next 1-1 prep asks once more
    await page.evaluate(() => { location.hash = '#/stage/1-1'; });
    const prompt = await page.waitForSelector('[data-testid="tutorial-prompt"]', { timeout: 10000 }).catch(() => null);
    check(!!prompt, '1-1 prep after leaving the coached battle: "Shall we finish our first lesson together?"');
    await shot(page, 'prep-prompt');
    await page.click('[data-testid="tutorial-start"]', { force: true });
    await page.waitForFunction(() => location.hash.includes('tutorial=1'), null, { timeout: 10000, polling: 200 }).catch(() => null);
    check(await page.evaluate(() => location.hash.includes('tutorial=1')), 'Start with Hikari → the coached battle');
    await page.evaluate(() => { location.hash = '#/stage/1-1'; });
    await page.waitForSelector('[data-testid="tutorial-prompt"]', { timeout: 10000 }).catch(() => null);
    await page.click('[data-testid="tutorial-later"]', { force: true });
    await page.waitForTimeout(300);
    check((await story(page)).tutorial === 'skipped', 'Not now → skipped, never asked again');
    errorsOk(errors, 'defeat + prompt');
    await context.close();
  }

  // ---------------------------------------------------------------- chapter hooks around real battles
  {
    const done = { opening: 'seen', tutorial: 'done', seen: ['opening', 'tut.outro'] };
    const { context, page, errors } = await newPage({ save: seeded({ upTo: '1-1', story: done }) });
    await page.goto(`${base}#/stage/1-2`, { waitUntil: 'load' });
    await page.waitForTimeout(2200);
    check(await page.evaluate(() => !document.querySelector('.sp')), '1-2 prep: no scene (chapter 1 opened with the opening)');
    await page.evaluate(() => { location.hash = '#/battle?stage=1-2&difficulty=easy'; });
    await waitBattle(page);
    check(await page.evaluate(() => !document.querySelector('[data-testid="coach"]')), 'a normal battle has no coach');
    const won = await page.evaluate(async () => {
      const { sim } = window.__battle;
      const ids = [...sim.loadout.keys(), sim.heroConfig?.unitId].filter(Boolean);
      const place = () => {
        for (const id of ids) {
          if (sim.towers.some((t) => t.unitId === id)) continue;
          let best = null;
          for (let y = 0.25; y < sim.map.height; y += 0.5) for (let x = 0.25; x < sim.map.width; x += 0.5) {
            if (!sim.canPlace(id, x, y).ok) continue;
            let n = 0;
            for (const k of sim.pathTiles) { const [px, py] = k.split(',').map(Number); if (Math.hypot(px + 0.5 - x, py + 0.5 - y) <= 3.2) n++; }
            if (!best || n > best.n) best = { x, y, n };
          }
          if (best) sim.placeTower(id, best.x, best.y);
        }
      };
      place();
      sim.startNextWave();
      for (let i = 0; i < 1200 && sim.state !== 'won' && sim.state !== 'lost'; i++) {
        place();
        for (const t of sim.towers) for (const p of [0, 2, 1]) { const st = sim.upgradeStatus(t.uid, p); if (!st.locked && sim.cash >= st.cost) sim.upgradeTower(t.uid, p); }
        for (let k = 0; k < 8; k++) sim.update(0.25);
        if (sim.state === 'between') sim.startNextWave();
        await new Promise((r) => setTimeout(r, 12));
      }
      return sim.state;
    });
    check(won === 'won', `1-2 won (${won})`);
    await page.waitForSelector('[data-testid="view-rewards"]', { timeout: 20000 }).catch(() => null);
    await page.waitForFunction(() => window.__sakura.store.profile.story.queue.includes('ch1.yuki'), null, { timeout: 8000, polling: 200 }).catch(() => null);
    check(await page.evaluate(() => window.__sakura.store.profile.story.queue.includes('ch1.yuki') && !document.querySelector('.sp')), 'the first 1-2 clear queues "Snow in Spring" (nothing plays over the battle)');
    await page.click('[data-testid="view-rewards"]', { force: true });
    await page.click('[data-testid="next-stage"]', { force: true, timeout: 8000 }).catch(() => {});
    const yuki = await page.waitForSelector('.sp.sp-overlay[data-scene="ch1.yuki"].sp-ready', { timeout: 20000 }).catch(() => null);
    check(!!yuki && await page.evaluate(() => location.hash.startsWith('#/stage/1-3')), 'Next Stage → 1-3 prep plays the 1-2 epilogue first');
    await page.waitForSelector('.sp-box.sp-full', { timeout: 8000 }).catch(() => null);
    await shot(page, 'hook-after-1-2');
    await page.keyboard.press('Escape');
    await page.click('[data-testid="story-skip-confirm"]', { force: true });
    await page.waitForFunction(() => !document.querySelector('.sp'), null, { timeout: 8000, polling: 200 }).catch(() => null);
    const s = await story(page);
    check(s.seen.includes('ch1.yuki') && !s.queue.length, 'the epilogue is seen and leaves the queue');
    // finale intro on 1-5 prep: once only
    await page.evaluate(() => {
      const { store } = window.__sakura;
      for (const id of ['1-3', '1-4']) store.profile.progress.stages[id] = { clears: 1, easy: false, normal: true, hard: false, nightmare: false };
      store.commit('test');
      location.hash = '#/stage/1-5';
    });
    const mid = await page.waitForSelector('.sp.sp-overlay[data-scene="ch1.mid"].sp-ready', { timeout: 20000 }).catch(() => null);
    check(!!mid, '1-5 prep (finale): "The Jelly Throne" plays before the boss');
    await shot(page, 'hook-before-1-5');
    await page.keyboard.press('Escape');
    await page.click('[data-testid="story-skip-confirm"]', { force: true });
    await page.waitForFunction(() => !document.querySelector('.sp'), null, { timeout: 8000, polling: 200 }).catch(() => null);
    await page.evaluate(() => { location.hash = '#/campaign'; });
    await page.waitForTimeout(900);
    await page.evaluate(() => { location.hash = '#/stage/1-5'; });
    await page.waitForTimeout(2500);
    check(await page.evaluate(() => !document.querySelector('.sp')), '1-5 prep again: the finale intro only plays the first time');
    // replayable from the archive (no reward the second time)
    const gems = await page.evaluate(() => window.__sakura.store.profile.currencies.gems);
    await page.evaluate(() => { location.hash = '#/story?ch=1'; });
    await page.waitForSelector('[data-testid="story-ep-ch1.yuki"].read', { timeout: 10000 }).catch(() => null);
    await page.click('[data-testid="story-ep-ch1.yuki"]', { force: true });
    await page.waitForSelector('[data-testid="story-player"].sp-ready', { timeout: 15000 }).catch(() => null);
    check(await page.evaluate(() => location.hash.startsWith('#/scene/ch1.yuki')), 'the archive replays an epilogue');
    await page.keyboard.press('Escape');
    await page.click('[data-testid="story-skip-confirm"]', { force: true });
    await page.waitForFunction(() => location.hash.startsWith('#/story'), null, { timeout: 10000, polling: 200 }).catch(() => null);
    check(await page.evaluate((g) => window.__sakura.store.profile.currencies.gems === g, gems), 'a replay grants nothing');
    errorsOk(errors, 'chapter hooks');
    await context.close();
  }

  // ---------------------------------------------------------------- legacy save
  {
    const { context, page, errors } = await newPage({ save: seeded({ upTo: '1-4', legacy: true }) });
    await page.goto(`${base}#/stage/1-1`, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    check(await page.evaluate(() => !document.querySelector('[data-testid="tutorial-prompt"], .sp')), 'legacy save: 1-1 prep asks nothing');
    await page.evaluate(() => { location.hash = '#/stage/1-5'; });
    await page.waitForSelector('.sp.sp-overlay[data-scene="ch1.mid"]', { timeout: 15000 }).catch(() => null);
    check(await page.evaluate(() => !!document.querySelector('.sp[data-scene="ch1.mid"]')), 'legacy save: a stage it has not cleared yet still gets its story the first time');
    errorsOk(errors, 'legacy');
    await context.close();
  }
}

try {
  for (const vp of viewports) await runViewport(vp);
} catch (e) {
  failures.push(`crashed: ${e.stack || e.message}`);
  log(`CRASH ${e.stack || e.message}`);
} finally {
  await browser.close();
  await server.close();
}
log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL TUTORIAL CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
