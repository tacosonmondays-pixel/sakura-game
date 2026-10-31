// Items 2 + 3 against the live build through the relay. node portraits-boss.mjs WxH shotsDir
import { launchChromium } from '/home/user/sakura-game/e2e/browser.mjs';
const [W, H] = process.argv[2].split('x').map(Number);
const SHOTS = process.argv[3];
const base = 'http://127.0.0.1:5199/';
const V3 = { akane: '0097c02f', aoi: '3acf9992', chika: '102f9515', ena: '638ab8a4', fuu: 'd4f80a41', hana: 'd0188224', hikari: '84490632', hotaru: 'c222e786', kaede: 'e0a3c3e6', kage: '0ed701cf', kanna: 'ff4d6f99', midori: '0f9ea55c', miko: '9d976c9a', momo: 'e5d16bbc', nami: '608ea322', noa: '8f1204eb', norika: 'ceac2fe7', raika: 'fb307843', rei: 'a71a7b5d', ruri: '722bebaa', shiro: '18baac5c', suzu: '5e2b5877', umeko: '942c2f84', yuki: 'cdf7d2d5' };
const { browser } = await launchChromium();
const touch = W < 1000;
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const errs = []; const portraitRes = []; const bad = [];
page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/GPU stall|too many errors|software WebGL|GroupMarkerNotSet/.test(m.text())) errs.push('console ' + m.text()); });
page.on('response', (r) => { const u = r.url(); if (u.includes('/art/portraits/')) portraitRes.push([r.status(), u]); if (r.status() >= 400) bad.push([r.status(), u]); });
page.on('requestfailed', (r) => bad.push(['failed', r.url(), r.failure()?.errorText]));
await page.addInitScript(() => { try { sessionStorage.setItem('sakura-beta-gift-shown', '1'); sessionStorage.setItem('sakura-ui-rotate-dismissed', '1'); } catch {} });
const fails = []; const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); return c; };
const clean = () => page.evaluate(() => document.querySelectorAll('.modal-overlay, .toast, .jn-toast, .ach-toast').forEach((n) => n.remove()));
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-${W}x${H}.jpg`, type: 'jpeg', quality: 70 }); };
async function go(hash, screen) {
  await page.evaluate((hh) => { location.hash = hh; }, hash);
  await page.waitForFunction((s) => document.querySelector('#app')?.dataset.screen === s && !document.documentElement.dataset.tx, screen, { timeout: 30000 }).catch(() => {});
  await clean(); await page.waitForTimeout(900);
}
/** portrait imgs inside `scope`: count, broken, v3 ones missing/wrong ?v= */
async function audit(scope, what) {
  await page.evaluate(() => document.querySelectorAll('img[src*="/art/portraits/"][loading="lazy"]').forEach((i) => { i.loading = 'eager'; }));
  await page.waitForFunction((s) => [...document.querySelectorAll(`${s} img[src*="/art/portraits/"]`)].every((i) => i.complete), scope, { timeout: 20000 }).catch(() => {});
  const r = await page.evaluate(([s, V3]) => {
    const imgs = [...document.querySelectorAll(`${s} img[src*="/art/portraits/"]`)];
    const out = { n: imgs.length, broken: [], noV: [], v3: 0, ids: new Set() };
    for (const i of imgs) {
      const src = i.getAttribute('src');
      if (!i.naturalWidth) out.broken.push(src);
      const m = src.match(/portraits\/([a-z_]+)-(full|card|bust|thumb)\.webp(\?v=([0-9a-f]+))?/);
      if (m && V3[m[1]]) { out.ids.add(m[1]); if (m[4] === V3[m[1]]) out.v3++; else out.noV.push(src); }
    }
    return { ...out, ids: [...out.ids] };
  }, [scope, V3]);
  check(r.n > 0 && !r.broken.length && !r.noV.length, `${what}: ${r.n} portraits, ${r.v3} v3 with ?v=<hash>, broken: ${r.broken.join(',') || 'none'}, v3 without ?v: ${r.noV.join(',') || 'none'}`);
  return r;
}
try {
  await page.goto(`${base}?online=local&onboarding=0#/lobby`, { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${base}?online=local&onboarding=0#/lobby`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 60000 });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 5000 }).catch(() => null);
  if (later) await later.click({ force: true });
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    const { grantUnit } = await import('/src/systems/unlocks.js');
    const { UNITS } = await import('/src/data/units.js');
    const p = store.profile;
    for (const u of UNITS) if (!p.units[u.id]) grantUnit(p, u.id, 1760000000000);
    for (const id of ['suzu', 'azami']) Object.assign(p.units[id], { level: 60 });
    p.formation = { hero: 'hikari', towers: ['suzu', 'azami', 'aoi', 'yuki', 'norika', 'kage', 'momo', 'rei'] };
    for (let s = 1; s <= 4; s++) p.progress.stages[`1-${s}`] = { easy: true, normal: true, hard: false, nightmare: false, clears: 1 };
    Object.assign(p.settings, { autoStart: false, quality: 'low', shadows: false, bloom: false });
    store.commit('e2e'); store.saveNow?.();
  });
  // ---- item 2: portraits
  await go('#/students', 'students');
  await page.evaluate(async () => {
    const sc = [...document.querySelectorAll('*')].find((n) => n.scrollHeight > n.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(n).overflowY));
    if (!sc) return;
    for (let y = 0; y <= sc.scrollHeight; y += sc.clientHeight / 2) { sc.scrollTop = y; await new Promise((r) => setTimeout(r, 120)); }
    sc.scrollTop = 0;
  });
  const list = await audit('#app', 'girls list');
  check(list.ids.length === 24, `girls list shows all 24 v3 girls (${list.ids.length})`);
  await shot('02-girls-list-v3');
  for (const id of ['suzu', 'norika', 'hikari']) {
    await go(`#/student/${id}`, 'student');
    await audit('#app', `${id} girl page`);
    if (id === 'suzu') await shot('03-girl-page-suzu-v3');
  }
  await go('#/formation', 'formation');
  await audit('#app', 'squad');
  await shot('04-squad-v3');
  // ---- item 3: battle on 1-5 (boss wave 18: the Slime Prince)
  await page.evaluate(() => { location.hash = '#/battle?stage=1-5&difficulty=normal'; });
  await page.waitForFunction(() => window.__battle?.sim && window.__battle.ui?.select, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__battle.ui.placement?.cancel?.());
  await clean();
  await audit('[data-testid="tower-bar"]', 'battle tower bar');
  const placed = await page.evaluate(() => {
    const { sim } = window.__battle;
    sim.cash = 1e7;
    const place = (id, skip) => {
      const spots = [];
      for (let y = 0.5; y < sim.map.height; y += 0.3) for (let x = 0.5; x < sim.map.width; x += 0.3) if (sim.canPlace(id, x, y).ok) spots.push([sim.placement.pathDistance(x, y), x, y]);
      spots.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
      // a spot near the road, at about the middle of the route
      const mid = spots.filter((s) => s[0] < 0.9);
      const pick = mid[Math.floor(mid.length * skip)] || spots[0];
      return sim.placeTower(id, pick[1], pick[2])?.uid ?? null;
    };
    const s = place('suzu', 0.45); const a = place('azami', 0.55);
    for (const uid of [s, a]) for (const p of [0, 1, 2]) for (let i = 0; i < 2; i++) sim.upgradeTower(uid, p);
    sim.wave = 17;
    return { s, a };
  });
  check(placed.s != null && placed.a != null, `Suzu (${placed.s}) and Azami (${placed.a}) placed by the road`);
  await page.evaluate(() => { window.__battle.ui.startWave(); window.__battle.ui.speed = 3; });
  // keep enemies alive enough and watch for boss-under traps
  await page.evaluate(([s, a]) => {
    const { sim } = window.__battle;
    window.__seen = { bossWave: 0, bossIds: [], bells: 0, bellsRiding: 0, strips: 0, bossOnStripHits: 0, bossInSuzu: 0, bossInAzami: 0 };
    const tS = sim.getTower(s); const tA = sim.getTower(a);
    window.__trapIv = setInterval(() => {
      const seen = window.__seen;
      seen.bossWave = sim.wave;
      const bosses = sim.enemies.filter((e) => !e.dead && (e.tier === 'boss' || e.tier === 'miniboss'));
      for (const b of bosses) { if (!seen.bossIds.includes(b.def?.id || b.id)) seen.bossIds.push(b.def?.id || b.id); if (b.hp < b.maxHp * 0.5) b.hp = b.maxHp; }
      for (const b of bosses) {
        if (Math.hypot(b.x - tS.x, b.y - tS.y) <= tS.eff.range) seen.bossInSuzu++;
        if (Math.hypot(b.x - tA.x, b.y - tA.y) <= tA.eff.range) seen.bossInAzami++;
      }
      const under = sim.traps.filter((tr) => !tr.dead && tr.under);
      seen.bells = Math.max(seen.bells, under.filter((tr) => tr.owner === tS && !tr.strip).length);
      seen.bellsRiding = Math.max(seen.bellsRiding, under.filter((tr) => tr.owner === tS && tr.boss).length);
      seen.strips = Math.max(seen.strips, under.filter((tr) => tr.owner === tA && tr.strip).length);
    }, 50);
  }, [placed.s, placed.a]);
  const ok = await page.waitForFunction(() => window.__seen.bells > 0 && window.__seen.strips > 0, null, { timeout: 240000, polling: 500 }).then(() => true).catch(() => false);
  const seen = await page.evaluate(() => window.__seen);
  console.log('    seen', JSON.stringify(seen));
  check(seen.bossWave === 18 && seen.bossIds.some((x) => /slime_prince/.test(x)), `wave 18 runs with the boss (${seen.bossIds.join(',')})`);
  check(ok && seen.bells > 0, `Suzu sets bells under the boss (max ${seen.bells} at once, ${seen.bellsRiding} riding on it)`);
  check(ok && seen.strips > 0, `Azami lays strips under the boss (max ${seen.strips} at once)`);
  // a still of the boss with its traps
  await page.evaluate(() => { window.__battle.ui.speed = 1; window.__battle.ui.paused = true; });
  await page.waitForTimeout(600);
  await clean();
  await shot('05-boss-bells-strips-1-5');
  await page.evaluate(() => { window.__battle.ui.paused = false; });
  // ---- More page: Suzu and Azami
  for (const [uid, key, label, name] of [[placed.s, 'bossBells', 'Boss bells', 'suzu'], [placed.a, 'bossStrips', 'Boss strips', 'azami']]) {
    await page.evaluate((u) => window.__battle.ui.select(u), uid);
    await page.waitForSelector('[data-testid="tower-panel"]:not([hidden]) [data-testid="panel-more"]', { timeout: 15000 });
    if (!(await page.$('[data-testid="tower-panel"].bt-drawer-more'))) await page.locator('[data-testid="tower-panel"] [data-testid="panel-more"]').click({ force: true });
    await page.waitForTimeout(900);
    const row = await page.evaluate((k) => {
      const c = document.querySelector(`[data-testid="tower-panel"] [data-testid="kit-${k}"]`);
      if (!c) return null;
      c.scrollIntoView({ block: 'center' });
      return c.textContent.replace(/\s+/g, ' ').trim();
    }, key);
    check(!!row && row.startsWith(label), `${name} More page: "${label}" row: ${row}`);
    if (name === 'suzu') await audit('[data-testid="tower-panel"]', 'More page header (Suzu)');
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.__battle.ui.paused = true; });
    await clean();
    await shot(`0${name === 'suzu' ? 6 : 7}-more-${key}`);
    await page.evaluate(() => { window.__battle.ui.paused = false; });
  }
  const p404 = portraitRes.filter(([s]) => s !== 200 && s !== 304);
  const v3Res = portraitRes.filter(([, u]) => /\?v=/.test(u)).length;
  check(p404.length === 0, `portrait responses: ${portraitRes.length}, ${v3Res} with ?v=, non-200: ${JSON.stringify(p404.slice(0, 5))}`);
  check(errs.length === 0, `no page/console errors${errs.length ? ': ' + errs.slice(0, 4).join(' || ') : ''}`);
  const badLive = bad.filter((b) => !/\/@vite\/|ws:/.test(b[1]));
  check(badLive.length === 0, `no failed or non-200 requests ${JSON.stringify(badLive.slice(0, 5))}`);
} catch (e) { check(false, 'threw: ' + e.message.split('\n')[0]); }
await browser.close();
console.log(`RESULT ${W}x${H}: ${fails.length ? 'FAIL ' + fails.length : 'PASS'}`);
process.exit(fails.length ? 1 : 0);
