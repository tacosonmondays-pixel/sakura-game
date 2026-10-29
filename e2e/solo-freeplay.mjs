// End-to-end test of SOLO freeplay (owner, Oct 14: "free play HAS to come … not even available
// for coop" — and solo too). A strong test save (eight girls and Hikari at level 60, ★5, 1-1 and
// 1-2 cleared) plays:
//   1. Stage prep 1-1: the Freeplay row (Off · Blossom · Tempest · Crimson Moon), Blossom picked,
//      what it brings; Start → a freeplay battle (the HUD chip FREEPLAY · BLOSSOM).
//   2. 12/12 cleared: the clear card (STAGE CLEAR ✓ / GO BEYOND ▶ Wave 13/12), the clear banked
//      and saved once (clears + 1). GO BEYOND: the HUD pill overflows "13/12" in the tier colours
//      (BEYOND), the glitch banner "13/12 — BEYOND THE LAST WAVE".
//   3. The defence falls a few waves later: FREEPLAY OVER, "Cleared wave N / 12", "New best on 1-1
//      (Blossom)!", the best saved (progress.stages['1-1'].freeplayBest.blossom) and shown back in
//      stage prep as "Best: wave N (Blossom)".
//   4. Keep going: a normal 1-2 run wins its last wave; the victory sheet offers KEEP GOING with
//      the tier chips; Tempest → the battle goes on (FREEPLAY · TEMPEST, 15/14 after GO BEYOND),
//      Finish run from the pause menu → FREEPLAY COMPLETE, the medal from the win kept, the
//      Tempest best saved.
// The battle's own clock is pumped (sim.update, like e2e/smoke.mjs) and the battle coins topped up
// so the run reaches the goal in seconds; placements and upgrades go through window.__battle.ui.act
// (the tower bar's path). Screenshots at 1280×720 and 844×390 go to --shots <dir>.
//
//   node e2e/solo-freeplay.mjs [--shots /tmp/shots]
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1
// when a check fails.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const SIZES = [[1280, 720], [844, 390]];

const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i,
  /Failed to load resource: net::ERR_(CERT_AUTHORITY_INVALID|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|PROXY_CONNECTION_FAILED|TUNNEL_CONNECTION_FAILED|CONNECTION_REFUSED)/i,
];
const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/`;

// ---- the strong test save -------------------------------------------------------------------
const save = await server.ssrLoadModule('/src/systems/save.js');
const GIRLS = ['kage', 'shiro', 'aoi', 'akane', 'miko', 'momo', 'sango', 'yuki'];
const profile = save.createProfile();
for (const id of [...GIRLS, 'hikari']) profile.units[id] = { ...save.newUnitState(), level: 60, breakthrough: 5, awaken: 5 };
profile.formation = { ...(profile.formation || {}), towers: GIRLS, hero: 'hikari' };
for (const id of ['1-1', '1-2']) profile.progress.stages[id] = { easy: false, normal: id === '1-1', hard: false, nightmare: false, clears: id === '1-1' ? 1 : 0 };
profile.progress.stages['1-1'].normal = true;
// 1-2 not cleared yet: its normal run below is a first clear (and still offers Keep going)
delete profile.progress.stages['1-2'];
profile.settings = { ...profile.settings, autoStart: false, defaultSpeed: 3 };
const saveText = JSON.stringify(profile);

const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await context.addInitScript(([key, text]) => {
  if (!sessionStorage.getItem('fp-e2e-seeded')) {
    localStorage.setItem(key, text);
    sessionStorage.setItem('fp-e2e-seeded', '1');
  }
}, [save.SAVE_KEY, saveText]);
const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (!IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const settle = (ms = 250) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);
async function snap(name, size) {
  const leaked = await page.evaluate(() => (document.body.innerText.match(/\b(null|undefined|NaN|Infinity)\b/g) || []).join(', ')).catch(() => '');
  check(!leaked, `${name}: no "null" / "undefined" / "NaN" / "Infinity" on screen${leaked ? ` (${leaked})` : ''}`);
  if (!shotsDir) return;
  const vp = page.viewportSize();
  const tag = size ? `${size[0]}x${size[1]}` : `${vp.width}x${vp.height}`;
  await page.screenshot({ path: `${shotsDir}/solo-${name}-${tag}.png`, timeout: 90000 }).catch((e) => log(`    (screenshot ${name}: ${String(e.message).split('\n')[0]})`));
}
/** The same view at both sizes; `again` re-shows a transient piece (a banner) after the resize. */
async function snapAll(name, again = null) {
  const vp = page.viewportSize();
  for (const size of SIZES) {
    await page.setViewportSize({ width: size[0], height: size[1] });
    await settle(450);
    if (again) await again();
    await settle(350);
    await snap(name, size);
  }
  await page.setViewportSize(vp);
  await settle(300);
}
const go = (hash) => page.evaluate((h) => { location.hash = h; }, hash);
const tap = (sel) => page.locator(sel).first().click({ timeout: 20000 }).catch(() => page.locator(sel).first().click({ timeout: 20000, force: true }));
/** Stage prep's Mode sheet (battle modes and the Freeplay row), and closing every sheet through its own X. */
const closeSheets = async () => {
  await page.evaluate(() => document.querySelectorAll('.ui-layer .ui-close').forEach((b) => b.click()));
  await page.waitForTimeout(300);
};
const openModeSheet = async () => {
  await page.waitForSelector('#app [data-testid="prep-mode"]', { timeout: 30000 });
  await closeSheets();
  await tap('#app [data-testid="prep-mode"]');
  await page.waitForSelector('[data-testid="mode-sheet"]', { timeout: 10000 }).catch(() => null);
};
const waitBattle = () => page.waitForFunction(() => window.__battle?.ui?.act && window.__battle.ui.results, null, { timeout: 90000 });
const textOf = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent || '', sel);

/** Deploys and upgrades the formation through the battle's own action path (coins topped up). */
async function build() {
  return page.evaluate(() => {
    const { sim, ui } = window.__battle;
    sim.cash = Math.max(sim.cash, 2e6);
    const ids = [...sim.loadout.keys(), ...(sim.heroConfig ? [sim.heroConfig.unitId] : [])];
    let placed = 0;
    outer: for (let y = 0.6; y < sim.map.height; y += 0.9) {
      for (let x = 0.6; x < sim.map.width; x += 0.9) {
        if (placed >= 14) break outer;
        const id = ids[placed % ids.length];
        if (!sim.canPlace(id, x, y).ok) continue;
        // only spots near the road
        const near = sim.paths.some((p) => p.some(([px, py]) => (px - x) ** 2 + (py - y) ** 2 < 4));
        if (!near) continue;
        if (ui.act.place(id, x, y)) placed++;
      }
    }
    for (const t of sim.towers) for (const p of [0, 0, 0, 0, 0, 2, 2]) ui.act.upgrade(t.uid, p);
    return { placed: sim.towers.length };
  });
}
/** Runs the battle clock until `until(sim)` (checked between chunks) or the battle ends. */
async function pump(untilSrc, { max = 600, start = true } = {}) {
  for (let i = 0; i < max; i++) {
    const r = await page.evaluate(([src, start]) => {
      const { sim } = window.__battle;
      const until = new Function('sim', `return (${src});`);
      for (let k = 0; k < 40; k++) {
        if (until(sim) || sim.state === 'won' || sim.state === 'lost') break;
        if (start && (sim.state === 'prep' || sim.state === 'between') && !(sim.freeplay && sim.wave === sim.totalWaves)) sim.startNextWave();
        sim.cash = Math.max(sim.cash, 1e6);
        sim.update(0.25);
      }
      return { done: until(sim), state: sim.state, wave: sim.wave, cleared: sim.wavesCleared };
    }, [untilSrc, start]);
    if (r.done || r.state === 'won' || r.state === 'lost') return r;
    await page.waitForTimeout(30);
  }
  return page.evaluate(() => ({ done: false, state: window.__battle.sim.state, wave: window.__battle.sim.wave }));
}
const prof = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__sakura.store.profile.progress.stages)));

try {
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 60000 });
  check(await page.evaluate(() => window.__sakura.store.profile.units.kage?.level === 60), 'the strong test save is loaded (Kage Lv 60)');

  // ---- 1. stage prep -----------------------------------------------------------------------
  log('\n--- stage prep: the Freeplay row ---');
  await go('#/stage/1-1');
  // (UI v2 M1: the Freeplay row lives in stage prep's Mode sheet, behind the Mode chip)
  await openModeSheet();
  await page.waitForSelector('[data-testid="prep-freeplay"]', { timeout: 30000 });
  check(/Off.*Blossom.*Tempest.*Crimson Moon/s.test(await textOf('[data-testid="prep-freeplay"]')), 'prep: Off · Blossom · Tempest · Crimson Moon');
  await tap('[data-testid="prep-fp-blossom"]');
  await page.waitForSelector('[data-testid="prep-fp-info"]', { timeout: 10000 });
  check(/12 waves, then freeplay \(Blossom\)/.test(await textOf('[data-testid="prep-fp-info"]')), 'prep: "12 waves, then freeplay (Blossom) …"');
  check(/Blossom/i.test(await textOf('[data-testid="stage-start"]')), `prep: the Start button names the tier (${(await textOf('[data-testid="stage-start"]')).trim()})`);
  check((await page.evaluate(() => location.hash)).includes('freeplay=blossom'), 'prep: the pick is kept in the URL');
  await page.evaluate(() => document.querySelector('[data-testid="prep-freeplay"]')?.scrollIntoView({ block: 'center' }));
  await snapAll('prep-toggle', () => page.evaluate(() => document.querySelector('[data-testid="prep-freeplay"]')?.scrollIntoView({ block: 'center' })));
  await closeSheets();

  // ---- 2. the goal and 13/12 -----------------------------------------------------------------
  log('\n--- freeplay battle 1-1 Blossom ---');
  const clears0 = (await prof())['1-1']?.clears || 0;
  await tap('[data-testid="stage-start"]');
  await waitBattle();
  const b0 = await page.evaluate(() => ({ fp: window.__battle.sim.freeplay, tier: window.__battle.sim.stage.freeplay?.id, goal: window.__battle.sim.totalWaves, hash: location.hash }));
  check(b0.fp && b0.tier === 'blossom' && b0.goal === 12, `battle: a freeplay battle on Blossom, goal 12 (${JSON.stringify(b0)})`);
  check(/freeplay · blossom/i.test(await textOf('[data-testid="hud-freeplay"]')), 'HUD: FREEPLAY · BLOSSOM chip');
  const built = await build();
  check(built.placed >= 4, `battle: ${built.placed} girls deployed and upgraded through ui.act`);
  const g = await pump('sim.wavesCleared >= sim.totalWaves');
  check(g.state === 'between' && g.cleared === 12, `the goal: 12/12 cleared and the battle goes on (${JSON.stringify(g)})`);
  await page.waitForSelector('[data-testid="clear-card"]:not([hidden])', { timeout: 15000 }).catch(() => null);
  check(!!(await page.$('[data-testid="clear-card"]:not([hidden])')), 'the clear card: STAGE CLEAR ✓');
  check(/GO BEYOND/i.test(await textOf('[data-testid="start-wave"]')) && /13\/12/.test(await textOf('[data-testid="start-wave"]')), 'GO BEYOND ▶ Wave 13/12');
  await page.waitForFunction((c) => (window.__sakura.store.profile.progress.stages['1-1']?.clears || 0) === c + 1, clears0, { timeout: 10000 }).catch(() => null);
  check(((await prof())['1-1']?.clears || 0) === clears0 + 1, 'the clear is banked once and saved (clears + 1)');
  await tap('[data-testid="start-wave"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="hud-wave-box"]')?.classList.contains('bt-wave-over'), null, { timeout: 15000 }).catch(() => null);
  const pill = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="hud-wave-box"]');
    return { over: b?.classList.contains('bt-wave-over'), tier: b?.dataset.tier, text: b?.querySelector('[data-testid="hud-wave"]')?.textContent, label: b?.textContent };
  });
  check(pill.over && pill.tier === 'blossom' && pill.text === '13/12', `HUD: the overflow pill 13/12 in the Blossom colours (${JSON.stringify(pill)})`);
  const banner = await page.evaluate(() => document.body.innerText);
  check(/BEYOND THE LAST WAVE/i.test(banner), 'the crossing banner: 13/12 — BEYOND THE LAST WAVE');
  await snap('overflow', [1280, 720]);
  await page.setViewportSize({ width: 844, height: 390 });
  await settle(600);
  await snap('overflow', [844, 390]);
  await page.setViewportSize({ width: 1280, height: 720 });
  await settle(300);
  // a few freeplay waves, then the defence falls (all girls sold, one life left)
  const f = await pump('sim.wavesCleared >= sim.totalWaves + 3');
  check(f.cleared >= 15, `three freeplay waves cleared (${f.cleared}/12)`);
  await page.evaluate(() => {
    const { sim } = window.__battle;
    for (const t of [...sim.towers]) if (!t.isHero) sim.sellTower(t.uid);
    sim.lives = 1;
    // the payout's write fails (storage full) until the sheet is checked: the freeplay sheet says
    // so, as the victory and defeat sheets do (restored and saved right after)
    const s = window.__sakura.store;
    window.__realSaveNow = s.saveNow;
    s.saveNow = () => false;
  });
  const lost = await pump('false', { max: 400 });
  check(lost.state === 'lost', `the run falls (${JSON.stringify(lost)})`);

  // ---- 3. the results and the best wave -----------------------------------------------------
  await page.waitForSelector('[data-testid="freeplay-result"]', { timeout: 30000 }).catch(() => null);
  const res = await textOf('[data-testid="freeplay-result"]');
  check(/FREEPLAY OVER/i.test(res), 'results: FREEPLAY OVER');
  check(!!(await page.$('[data-testid="freeplay-result"] [data-testid="result-save-failed"]')), 'results: "Your rewards couldn\'t be saved…" when the payout\'s write failed');
  await page.evaluate(() => {
    const s = window.__sakura.store;
    if (window.__realSaveNow) s.saveNow = window.__realSaveNow;
    delete window.__realSaveNow;
    s.saveNow();
  });
  // (the shared freeplay sheet reads "Cleared wave N / 12": the waves the run actually cleared)
  check(/Cleared wave \d+ \/ 12/.test(res), `results: "Cleared wave N / 12" (${(res.match(/Cleared wave \d+ \/ \d+/) || [''])[0]})`);
  check(/New best on 1-1 \(Blossom\)!/.test(res), 'results: "New best on 1-1 (Blossom)!"');
  check(/Stage clear · saved at 12\/12/i.test(res) && /Freeplay bonus/i.test(res), 'results: the clear (saved at 12/12) and the freeplay bonus');
  await snapAll('results');
  const best = (await prof())['1-1']?.freeplayBest?.blossom;
  check(best >= 15, `save: freeplayBest.blossom = ${best}`);
  await go('#/stage/1-1');
  await openModeSheet();
  await page.waitForSelector('[data-testid="prep-fp-best"]', { timeout: 30000 }).catch(() => null);
  check(new RegExp(`Best: wave ${best} \\(Blossom\\)`).test(await textOf('[data-testid="prep-fp-best"]')), `prep: "Best: wave ${best} (Blossom)"`);
  await page.evaluate(() => document.querySelector('[data-testid="prep-fp-best"]')?.scrollIntoView({ block: 'center' }));
  await snapAll('prep-best', () => page.evaluate(() => document.querySelector('[data-testid="prep-fp-best"]')?.scrollIntoView({ block: 'center' })));

  // ---- 4. Keep going from a normal victory --------------------------------------------------
  log('\n--- Keep going: a normal 1-2 run ---');
  await go('#/battle?stage=1-2&difficulty=normal');
  await waitBattle();
  check(await page.evaluate(() => !window.__battle.sim.freeplay), 'a normal run is a normal battle');
  check(await page.evaluate(() => document.querySelector('[data-testid="hud-freeplay"]')?.hidden === true), 'HUD: no freeplay chip in a normal run');
  await build();
  const won = await pump('false');
  check(won.state === 'won' && won.cleared === 14, `1-2 won at 14/14 (${JSON.stringify(won)})`);
  await page.waitForSelector('[data-testid="keep-going"]', { timeout: 30000 }).catch(() => null);
  check(!!(await page.$('[data-testid="keep-going"]')), 'victory: KEEP GOING');
  check(/Wave 15\/14/.test(await textOf('[data-testid="keep-going"]')), 'KEEP GOING ▶ Wave 15/14');
  check(((await prof())['1-2']?.normal) === true, 'the win is saved (1-2 Normal medal)');
  await tap('[data-testid="keep-tier-tempest"]');
  check(await page.evaluate(() => document.querySelector('[data-testid="keep-tier-tempest"]')?.classList.contains('on')), 'the Tempest chip is picked');
  await snapAll('keep-going');
  await tap('[data-testid="keep-going"]');
  await page.waitForFunction(() => window.__battle.sim.freeplay && window.__battle.sim.state === 'between', null, { timeout: 10000 }).catch(() => null);
  const k = await page.evaluate(() => ({ fp: window.__battle.sim.freeplay, tier: window.__battle.sim.stage.freeplay?.id, state: window.__battle.sim.state, sheet: !document.querySelector('[data-testid="result"]')?.hidden }));
  check(k.fp && k.tier === 'tempest' && k.state === 'between' && !k.sheet, `Keep going: the battle goes on as Tempest freeplay (${JSON.stringify(k)})`);
  await settle(300);
  check(/freeplay · tempest/i.test(await textOf('[data-testid="hud-freeplay"]')), 'HUD: FREEPLAY · TEMPEST chip');
  check(/GO BEYOND/i.test(await textOf('[data-testid="start-wave"]')), 'the clear card offers GO BEYOND');
  await tap('[data-testid="start-wave"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="hud-wave"]')?.textContent === '15/14', null, { timeout: 15000 }).catch(() => null);
  check(await page.evaluate(() => document.querySelector('[data-testid="hud-wave-box"]')?.dataset.tier === 'tempest' && document.querySelector('[data-testid="hud-wave"]')?.textContent === '15/14'), 'HUD: 15/14 in the Tempest colours');
  const kk = await pump('sim.wavesCleared >= sim.totalWaves + 2');
  check(kk.cleared >= 16, `two freeplay waves cleared (${kk.cleared}/14)`);
  await tap('[data-testid="pause"]');
  await page.waitForSelector('[data-testid="pause-finish"]', { timeout: 10000 }).catch(() => null);
  check(!!(await page.$('[data-testid="pause-finish"]')), 'pause menu: Finish run');
  await tap('[data-testid="pause-finish"]');
  await page.waitForSelector('[data-testid="freeplay-result"]', { timeout: 30000 }).catch(() => null);
  const res2 = await textOf('[data-testid="freeplay-result"]');
  check(/FREEPLAY COMPLETE/i.test(res2) && /Finished after wave \d+/.test(res2) && !/together/i.test(res2), 'results: FREEPLAY COMPLETE, "Finished after wave N"');
  check(/New best on 1-2 \(Tempest\)!/.test(res2), 'results: "New best on 1-2 (Tempest)!"');
  const st2 = (await prof())['1-2'];
  check(st2?.freeplayBest?.tempest === kk.cleared && st2?.normal === true && st2?.clears === 1, `save: 1-2 Tempest best ${st2?.freeplayBest?.tempest}, one clear, the medal kept`);
  await snapAll('results-complete');
} catch (e) {
  check(false, `crashed: ${e.stack || e.message}`);
} finally {
  check(!errors.length, `no page errors${errors.length ? `:\n    ${errors.slice(0, 6).join('\n    ')}` : ''}`);
  await browser.close().catch(() => {});
  await server.close().catch(() => {});
}
log(failures.length ? `\n${failures.length} check(s) FAILED` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
