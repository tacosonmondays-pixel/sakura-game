// The A3 plan's M2 screenshot scenes (wiring and the audit fixes; e2e/ui-shots.mjs --scenes m2-…): a seeded save, each
// written as <scene>-<W>x<H>.png. Battle scenes drive the sim directly (window.__ab, e2e/lib/battleKit.mjs).
//   m2-tips-ouka     Ouka's Profile sheet: her tips with the ⚡ line (her Assembly Bell runs)
//   m2-tips-kage     Kage's Profile sheet: no ⚡ line (Shadow Doubles has no button yet)
//   m2-hana-bio      Hana's Profile sheet: the bio says Kaze swoops out at every enemy she shoots, flyers first
//   m2-gear-haste    Aoi's shoes (Skill Haste main stat, Bell Club): the piece's Details sheet says Skill Haste
//   m2-club-bell     the Club Armband picker (Academy Clubs) with Bell Club in the list
//   m2-ouka-office   a battle: Ouka at Club Mentors, her panel's Office line ("abilities +15%")
//   m2-ouka-covered  the girl she covers: "Council rules … ability +15% charge"
//   m2-azami-crit    a battle frame: Azami's strips critting (crit gear), orange "123!" numbers
import { openApp, seedSave, openBattle, settle, until } from './battleKit.mjs';
import { uiProbe, formatProbe, BATTLE_BOXES } from './uiProbe.mjs';

export const M2_SCENES = ['m2-tips-ouka', 'm2-tips-kage', 'm2-hana-bio', 'm2-gear-haste', 'm2-club-bell', 'm2-ouka-office', 'm2-ouka-covered', 'm2-azami-crit'];
const GIRLS = ['hikari', 'aoi', 'ouka', 'kage', 'hana', 'azami', 'rei', 'yuki'];
const SQUAD = ['ouka', 'aoi', 'azami', 'kage', 'rei', 'yuki'];

const clearToasts = (page) => page.evaluate(() => document.querySelectorAll('[data-testid="battle-feed"] .bt-toast').forEach((t) => t.remove()));
const removeOverlays = (page) => page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));

/** Hand-made gear on the save: Aoi's Bell Club shoes (Skill Haste main), Azami's crit set. */
async function seedGear(page) {
  return page.evaluate(async () => {
    const { store } = window.__sakura;
    const gear = await import('/src/systems/gear.js');
    const p = store.profile;
    const piece = (slot, main, subs, extra = {}) => gear.addGear(p, {
      slot, rarity: 'legendary', level: 10, main: { stat: main[0], value: main[1], base: main[1] / 1.6 },
      subs: subs.map(([stat, v, ups = 0]) => ({ stat, value: v, base: v, upgrades: ups })), locked: false, equippedBy: null, name: extra.name || 'Test', ...extra,
    });
    const shoes = piece('shoes', ['ultHaste', 0.192], [['ratePct', 0.046], ['atkPct', 0.052], ['rangePct', 0.031], ['critChance', 0.04]], { club: 'bell', name: 'Dawnspark Loafers' });
    gear.equipGear(p, 'aoi', shoes);
    // her charm (Taiko Club), for the armband picker: Bell is one of the clubs it can join
    const spare = piece('charm', ['atkPct', 0.3], [['critDmg', 0.1], ['ratePct', 0.03], ['rangePct', 0.02], ['armorPen', 1.2]], { club: 'taiko', name: 'Festival Charm' });
    gear.equipGear(p, 'aoi', spare);
    p.items.club_band = 3;
    // Azami: crit on every piece (0.75 cap) and crit damage
    gear.equipGear(p, 'azami', piece('ribbon', ['critChance', 0.55], [['critDmg', 0.3], ['atkPct', 0.05]], { name: 'Prefect Ribbon' }));
    gear.equipGear(p, 'azami', piece('charm', ['critDmg', 0.6], [['critChance', 0.2], ['atkPct', 0.05]], { name: 'Prefect Charm' }));
    store.commit('e2e');
    store.saveNow?.();
    return { shoes, spare };
  });
}

/** The girl page's Profile sheet (Info → Profile ▸), its tips scrolled into view. */
async function openProfile(page, id) {
  await page.evaluate((u) => { location.hash = `#/student/${u}?tab=info`; }, id);
  await page.waitForFunction(() => document.querySelector('#app')?.dataset.screen === 'student' && document.querySelector('[data-testid="info-profile"]'), null, { timeout: 30000 });
  await settle(page, 6500); // (a new save's lesson and achievement pop-ups slide away first)
  await removeOverlays(page);
  await page.locator('[data-testid="info-profile"]').click({ force: true });
  await page.waitForSelector('[data-testid="profile-sheet"]', { timeout: 10000 });
  await settle(page, 600);
}

/**
 * @param {import('playwright').Page} page
 * @param {{ base: string, vp: string, want: string[], shot: (name: string) => Promise<void>, log?: (s: string) => void }} o
 * @returns {Promise<object>} probe results and texts by scene
 */
export async function runM2Scenes(page, { base, vp, want, shot: rawShot, log = console.log }) {
  const has = (n) => want.includes(n);
  const shot = async (n) => {
    await clearToasts(page).catch(() => {});
    await rawShot(n);
  };
  const out = {};
  await openApp(page, base);
  await seedSave(page, { girls: GIRLS, hero: 'hikari', towers: SQUAD, settings: { reduceMotion: false } });
  const seeded = await seedGear(page);

  for (const [name, id, focus] of [['m2-tips-ouka', 'ouka', 'tips'], ['m2-tips-kage', 'kage', 'tips'], ['m2-hana-bio', 'hana', 'bio']]) {
    if (!has(name)) continue;
    await openProfile(page, id);
    if (focus === 'tips') {
      await page.evaluate(() => document.querySelector('[data-testid="profile-tips"]')?.scrollIntoView({ block: 'end' }));
      await settle(page, 300);
    }
    const text = await page.locator('[data-testid="profile-sheet"]').innerText();
    const tips = await page.evaluate(() => [...document.querySelectorAll('[data-testid="profile-tips"] li')].map((li) => ({ text: li.textContent, bolt: !!li.querySelector('.kit-bolt') })));
    out[name] = { tips, bio: text.split('\n').find((l) => /Kaze|bow|blazer|uniform/.test(l)) || null };
    log(`  ${name}: ${JSON.stringify(out[name]).slice(0, 600)}`);
    out[name].probe = await uiProbe(page);
    log(`  probe ${name}: ${formatProbe(out[name].probe)}`);
    await shot(name);
    await page.keyboard.press('Escape');
    await settle(page, 300);
  }

  if (has('m2-gear-haste') || has('m2-club-bell')) {
    await page.evaluate(() => { location.hash = '#/student/aoi?tab=gear'; });
    await page.waitForFunction(() => document.querySelector('[data-testid="slot-shoes"]'), null, { timeout: 30000 });
    await settle(page, 6500);
    await removeOverlays(page);
    await page.locator('[data-testid="slot-shoes"]').click({ force: true });
    await page.waitForSelector('[data-testid="gear-sheet"]', { timeout: 10000 });
    await settle(page, 500);
    if (has('m2-gear-haste')) {
      await page.locator('[data-testid="gear-item-more"]').click({ force: true });
      await page.waitForSelector('[data-testid="gear-details"]', { timeout: 10000 });
      await settle(page, 500);
      const text = await page.locator('[data-testid="gear-details"]').innerText();
      out['m2-gear-haste'] = { skillHaste: /Skill Haste/.test(text), ultHaste: /Ult Haste/i.test(text), text: text.replace(/\s+/g, ' ').slice(0, 400) };
      log(`  m2-gear-haste: ${JSON.stringify(out['m2-gear-haste'])}`);
      await shot('m2-gear-haste');
      await page.keyboard.press('Escape');
      await settle(page, 300);
    }
    if (has('m2-club-bell')) {
      // her charm (Taiko Club): the armband picker, Bell picked
      await page.keyboard.press('Escape');
      await settle(page, 300);
      await page.locator('[data-testid="slot-charm"]').click({ force: true });
      await page.waitForSelector('[data-testid="gear-sheet"] [data-testid="gear-club"]', { timeout: 10000 });
      await settle(page, 400);
      await page.locator('[data-testid="gear-sheet"] [data-testid="gear-club"]').click({ force: true });
      await page.waitForSelector('[data-testid="armband-modal"]', { timeout: 10000 });
      await settle(page, 500);
      await page.locator('[data-testid="club-bell"]').click({ force: true });
      await settle(page, 300);
      // the list holds every live club; Bell is the last row: bring it into view
      await page.evaluate(() => document.querySelector('[data-testid="club-bell"]')?.scrollIntoView({ block: 'center' }));
      await settle(page, 300);
      const rows = await page.evaluate(() => [...document.querySelectorAll('[data-testid="armband-modal"] [role="radio"]')].map((b) => b.dataset.testid));
      out['m2-club-bell'] = { rows };
      log(`  m2-club-bell: ${JSON.stringify(rows)}`);
      await shot('m2-club-bell');
      await removeOverlays(page);
      await page.keyboard.press('Escape');
      await settle(page, 300);
    }
  }
  void seeded;

  const battle = ['m2-ouka-office', 'm2-ouka-covered', 'm2-azami-crit'];
  if (battle.some(has)) {
    await page.evaluate(() => { location.hash = '#/lobby'; });
    await settle(page, 600);
    await openBattle(page, { stage: '1-2' });
    const u = await page.evaluate(() => {
      const ouka = __ab.place('ouka');
      __ab.up(ouka, 1, 3); // Assembly to Club Mentors
      const aoi = __ab.place('aoi', { near: ouka, min: 1 });
      __ab.unlock(aoi);
      return { ouka, aoi };
    });
    await settle(page, 600);
    for (const [name, uid, line] of [['m2-ouka-office', u.ouka, 'Office'], ['m2-ouka-covered', u.aoi, 'Council rules']]) {
      // (her office line: src/sim/Sim.js towerStats now carries `hub`; before M2 the panel never drew it)
      if (!has(name)) continue;
      await page.evaluate((x) => window.__battle.ui.select(x), uid);
      await page.waitForFunction(() => { const el = document.querySelector('[data-testid="tower-panel"]'); return el && !el.hidden; }, null, { timeout: 15000 });
      await settle(page, 900);
      const found = await page.evaluate((label) => {
        const panel = document.querySelector('[data-testid="tower-panel"]');
        const cell = [...panel.querySelectorAll('*')].find((el) => el.children.length <= 3 && el.textContent.trim().startsWith(label) && el.textContent.length < 200);
        const row = cell?.closest('.bt-stat') || cell;
        row?.scrollIntoView({ block: 'center' });
        return row ? row.textContent.replace(/\s+/g, ' ').trim() : null;
      }, line);
      await settle(page, 400);
      out[name] = { line: found };
      log(`  ${name}: ${found}`);
      out[name].probe = await uiProbe(page, { boxes: BATTLE_BOXES });
      log(`  probe ${name}: ${formatProbe(out[name].probe)}`);
      await shot(name);
    }
    await page.evaluate(() => window.__battle.ui.select(null));
    await settle(page, 300);

    if (has('m2-azami-crit')) {
      const az = await page.evaluate((x) => {
        const { sim } = window.__battle;
        // only her on the board (no other girl's crit numbers in the frame)
        for (const uid of [x.ouka, x.aoi]) sim.sellTower(uid);
        // by the road nearest the map's middle (the camera's centre), Charged Strips (path 1 tier 4)
        const cx = sim.map.width / 2;
        const cy = sim.map.height / 2;
        let best = null;
        for (let y = 0.5; y < sim.map.height; y += 0.25) {
          for (let xx = 0.5; xx < sim.map.width; xx += 0.25) {
            if (!sim.canPlace('azami', xx, y).ok || sim.placement.pathDistance(xx, y) > 1.1) continue;
            const d = (xx - cx) * (xx - cx) + (y - cy) * (y - cy);
            if (!best || d < best.d) best = { x: xx, y, d };
          }
        }
        const t = sim.placeTower('azami', best.x, best.y);
        __ab.up(t.uid, 0, 4);
        return { uid: t.uid, crit: t.eff.critChance, mul: t.eff.critMul, specCrit: t.trapSpec?.critChance, boomCrit: t.stripBoomSpec?.critChance };
      }, u);
      log(`  m2-azami-crit: Azami crit ${az.crit} ×${az.mul}, strip spec crit ${az.specCrit}`);
      // her strips' hits, recorded (a crit flag per hit from her strip spec)
      await page.evaluate((uid) => {
        const { sim } = window.__battle;
        const t = sim.getTower(uid);
        window.__stripHits = [];
        const hit = sim._hit.bind(sim);
        const emit = sim._emit.bind(sim);
        let cur = false;
        sim._emit = (type, p) => {
          if (cur && type === 'hit') {
            window.__stripHits.push({ at: performance.now(), crit: !!p.crit, amount: p.amount });
            // (staging a still: the battle holds right after the Nth crit, so its numbers stay on screen)
            if (p.crit && window.__freezeOn > 0 && --window.__freezeOn === 0) window.__battle.ui.paused = true;
          }
          return emit(type, p);
        };
        sim._hit = (e, tower, spec, ...rest) => {
          const prev = cur;
          cur = tower === t && (spec === t.trapSpec || spec === t.stripBoomSpec || spec === t.stripAirSpec);
          try {
            return hit(e, tower, spec, ...rest);
          } finally {
            cur = prev;
          }
        };
        __ab.keepWave(25);
        window.__battle.ui.speed = 2;
      }, az.uid);
      // her strips down along the road first; then (staging) a sturdy slime parked on each of her armed strips, so
      // several strips hit at once: the frame shows their crit numbers together
      await until(page, (uid) => window.__battle.sim.getTower(uid).trapCount >= 6, az.uid, 60000);
      const parked = await page.evaluate(async (uid) => {
        const { sim, ui } = window.__battle;
        ui.speed = 1;
        const { samplePath } = await import('/src/sim/path.js');
        const mine = sim.traps.filter((tr) => tr.strip && tr.ownerUid === uid && tr.armed && tr.hits > 1).slice(0, 6);
        let n = 0;
        for (const tr of mine) {
          let best = null;
          for (const path of sim.pathData) {
            for (const s of samplePath(path, 0.1)) {
              const d2 = (s.x - tr.x) * (s.x - tr.x) + (s.y - tr.y) * (s.y - tr.y);
              if (!best || d2 < best.d2) best = { d2, pathIndex: path.index, d: s.d };
            }
          }
          const e = sim.spawnEnemy('slime_green', { pathIndex: best.pathIndex, dist: best.d });
          if (!e) continue;
          e.hp = e.maxHp = 1e6;
          e.__sturdy = 1;
          e.baseSpeed = 0;
          n++;
        }
        window.__stripHits.length = 0;
        window.__freezeOn = Math.min(4, n);
        return n;
      }, az.uid);
      const seen = await until(page, () => window.__battle.ui.paused === true, null, 20000);
      await settle(page, 400);
      log(`  m2-azami-crit: ${parked} slimes parked on her strips`);
      const recent = await page.evaluate(() => ({
        n: window.__stripHits.length, crits: window.__stripHits.filter((h) => h.crit).length,
        recent: window.__stripHits.map((h) => `${Math.round(h.amount)}${h.crit ? '!' : ''}`),
      }));
      out['m2-azami-crit'] = { ...az, seen, ...recent };
      log(`  m2-azami-crit hits: ${JSON.stringify(recent)} (seen ${seen})`);
      await shot('m2-azami-crit');
    }
  }
  return out;
}
