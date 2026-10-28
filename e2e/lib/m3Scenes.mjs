// The A3 plan's M3 screenshot scenes (the returning girls' abilities; e2e/ui-shots.mjs --scenes m3-…): a seeded save,
// each written as <scene>-<W>x<H>.png. Battle scenes drive the sim directly (window.__ab, e2e/lib/battleKit.mjs).
//   m3-bar-returning   mid-wave: Hana, Ruri (Moonhound), Noa and Ena in the ability bar, Yoriko's skill button by her
//                      portrait (Puppet Hex)
//   m3-teaser-fuu      Fuu at Returning Gale tier 3: her panel's ability row says "Comes in a later update"
//   m3-teaser-iroha    Iroha at Mirror Hall tier 3: the same
//   m3-swoop           Kaze's Swoop: Kaze out on a dive at one of the flyers it marked
//   m3-lance           Storm Lance: the chain through its targets (hero Seiran, a second battle)
//   m3-firstaid        First Aid Call: the rally ring and glow on the girls around Noa, a life back (the toast and
//                      the heart)
//   m3-girl-info-ruri  the girl page: Ruri's ⚡ chip naming her three path abilities
//   m3-girl-details-ruri  (extra) its Details sheet: one section per familiar path, the two that wait marked
import { openApp, seedSave, openBattle, settle, until } from './battleKit.mjs';
import { uiProbe, formatProbe, BATTLE_BOXES } from './uiProbe.mjs';

export const M3_SCENES = ['m3-bar-returning', 'm3-teaser-fuu', 'm3-teaser-iroha', 'm3-swoop', 'm3-lance', 'm3-firstaid', 'm3-girl-info-ruri', 'm3-girl-details-ruri'];
const GIRLS = ['hikari', 'yoriko', 'seiran', 'hana', 'ruri', 'noa', 'ena', 'fuu', 'iroha', 'aoi'];
const SQUAD = ['hana', 'ruri', 'noa', 'ena', 'fuu', 'iroha', 'aoi'];

const clearToasts = (page) => page.evaluate(() => document.querySelectorAll('[data-testid="battle-feed"] .bt-toast').forEach((t) => t.remove()));
const removeOverlays = (page) => page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));

/** The road spot nearest a girl (sim coordinates), for staging enemies by her. */
async function installM3Helpers(page) {
  await page.evaluate(async () => {
    const { sim } = window.__battle;
    const { samplePath } = await import('/src/sim/path.js');
    const samples = sim.pathData.flatMap((p) => samplePath(p, 0.1).filter((s) => !s.hidden).map((s) => ({ ...s, pathIndex: p.index })));
    window.__m3 = {
      /** Parks `n` sturdy enemies of `id` on the road around the spot nearest (x, y), `gap` tiles apart. */
      park(id, x, y, n = 1, gap = 0.4, { hp = 1e6 } = {}) {
        let best = null;
        for (const s of samples) {
          const d2 = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y);
          if (!best || d2 < best.d2) best = { d2, s };
        }
        const out = [];
        for (let k = 0; k < n; k++) {
          const e = sim.spawnEnemy(id, { pathIndex: best.s.pathIndex, dist: Math.max(0.2, best.s.d + gap * (k - (n - 1) / 2)) });
          if (!e) continue;
          e.hp = e.maxHp = hp;
          e.__sturdy = 1;
          e.baseSpeed = 0;
          out.push(e.uid);
        }
        return out;
      },
      /** Places a girl by the road nearest the map's middle (clear of the HUD and the toasts in a still). */
      placeCentre(unitId) {
        const cx = sim.map.width / 2;
        const cy = sim.map.height / 2;
        let best = null;
        for (let y = 0.5; y < sim.map.height; y += 0.25) {
          for (let x = 0.5; x < sim.map.width; x += 0.25) {
            if (!sim.canPlace(unitId, x, y).ok || sim.placement.pathDistance(x, y) > 1.2) continue;
            const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
            if (!best || d < best.d) best = { x, y, d };
          }
        }
        return best ? sim.placeTower(unitId, best.x, best.y)?.uid ?? null : null;
      },
      /** Every enemy on the board gone (no kill: a clean frame for the next still). */
      clear() {
        for (const e of sim.enemies) e.dead = true;
        sim._removeDead();
      },
    };
  });
}

/**
 * @param {import('playwright').Page} page
 * @param {{ base: string, vp: string, want: string[], shot: (name: string) => Promise<void>, log?: (s: string) => void }} o
 * @returns {Promise<object>} probe results and texts by scene
 */
export async function runM3Scenes(page, { base, vp, want, shot: rawShot, log = console.log }) {
  const has = (n) => want.includes(n);
  const keepToast = new Set(['m3-firstaid']);
  const shot = async (n) => {
    if (!n.startsWith('m3-girl-') && !keepToast.has(n)) await clearToasts(page).catch(() => {});
    await rawShot(n);
  };
  const out = {};
  await openApp(page, base);
  await seedSave(page, { girls: GIRLS, hero: 'yoriko', towers: SQUAD, settings: { reduceMotion: false }, cleared: ['1-1', '1-2'] });

  // ---- the girl page: Ruri's chip and its Details ----
  if (has('m3-girl-info-ruri') || has('m3-girl-details-ruri')) {
    await page.evaluate(() => { location.hash = '#/student/ruri?tab=info'; });
    await page.waitForFunction(() => document.querySelector('#app')?.dataset.screen === 'student' && document.querySelector('[data-testid="info-ability"]'), null, { timeout: 30000 });
    await settle(page, 6500); // (a new save's lesson and achievement pop-ups slide away first)
    await removeOverlays(page);
    await page.evaluate(() => document.querySelector('[data-testid="info-ability"]')?.scrollIntoView({ block: 'center' }));
    await settle(page, 300);
    const chip = await page.locator('[data-testid="info-ability"]').innerText();
    out['m3-girl-info-ruri'] = { chip: chip.replace(/\s+/g, ' ').trim() };
    log(`  m3-girl-info-ruri: ${out['m3-girl-info-ruri'].chip}`);
    if (has('m3-girl-info-ruri')) {
      out['m3-girl-info-ruri'].probe = await uiProbe(page);
      log(`  probe m3-girl-info-ruri: ${formatProbe(out['m3-girl-info-ruri'].probe)}`);
      await shot('m3-girl-info-ruri');
    }
    if (has('m3-girl-details-ruri')) {
      await page.locator('[data-testid="info-ability"]').click({ force: true });
      await page.waitForSelector('[data-testid="ability-sheet"]', { timeout: 10000 });
      await settle(page, 600);
      const text = (await page.locator('[data-testid="ability-sheet"]').innerText()).replace(/\s+/g, ' ');
      out['m3-girl-details-ruri'] = { text: text.slice(0, 900) };
      log(`  m3-girl-details-ruri: ${text.slice(0, 500)}`);
      await shot('m3-girl-details-ruri');
      await page.keyboard.press('Escape');
      await settle(page, 300);
    }
  }

  // ---- battle 1 (1-2, hero Yoriko): the bar, the teasers, the swoop, First Aid Call ----
  const battle1 = ['m3-bar-returning', 'm3-teaser-fuu', 'm3-teaser-iroha', 'm3-swoop', 'm3-firstaid'];
  if (battle1.some(has)) {
    await page.evaluate(() => { location.hash = '#/lobby'; });
    await settle(page, 600);
    await openBattle(page, { stage: '1-2' });
    await installM3Helpers(page);
    const u = await page.evaluate(() => {
      const noa = __m3.placeCentre('noa');
      const hana = __ab.place('hana', { near: noa, min: 1.3 });
      const ena = __ab.place('ena', { near: noa, min: 2.2 });
      const ruri = __ab.place('ruri', { near: noa, min: 3 });
      const hero = __ab.place('yoriko', { near: noa, min: 1.6 });
      for (const t of [noa, hana, ena]) __ab.unlock(t);
      __ab.up(ruri, 0, 3); // Moonhound
      __ab.heroTo(7);
      return { noa, hana, ena, ruri, hero };
    });
    await settle(page, 600);
    // a wave, sturdy enemies on the road
    await page.evaluate(() => __ab.keepWave(60));
    const onRoad = await until(page, (x) => __ab.inReach(x.noa) >= 2, u, 40000);
    log(`  staging: enemies by Noa ${onRoad}`);

    if (has('m3-bar-returning')) {
      await page.evaluate((x) => {
        __ab.hold(true);
        __ab.ready(x.hana);
        __ab.ready(x.ruri, { cd: Math.round(9.4 * 60) * 100 });
        __ab.ready(x.noa);
        __ab.ready(x.ena, { cd: Math.round(21.2 * 60) * 100 });
        __ab.ready(x.hero);
        window.__battle.ui.abilityBar.refresh();
      }, u);
      await clearToasts(page);
      await settle(page, 600);
      const bar = await page.evaluate(() => ({
        slots: [...document.querySelectorAll('[data-testid="ability-bar"] [data-testid^="ability-slot"]')].map((s) => s.getAttribute('aria-label') || s.title || s.dataset.testid),
        skill: document.querySelector('[data-testid="hero-skill"]')?.getAttribute('aria-label') || null,
        skillHidden: document.querySelector('[data-testid="hero-skill"]')?.hidden ?? null,
      }));
      out['m3-bar-returning'] = { bar };
      log(`  m3-bar-returning: ${JSON.stringify(bar)}`);
      out['m3-bar-returning'].probe = await uiProbe(page, { boxes: BATTLE_BOXES });
      log(`  probe m3-bar-returning: ${formatProbe(out['m3-bar-returning'].probe)}`);
      await shot('m3-bar-returning');
    }

    // (last in this battle: a girl placed for them never leaves a sale's coin pop in the other stills)
    const teasers = async () => { for (const [name, id] of [['m3-teaser-fuu', 'fuu'], ['m3-teaser-iroha', 'iroha']]) {
      if (!has(name)) continue;
      const uid = await page.evaluate(([gid, near]) => {
        const t = __ab.place(gid, { near, min: 4 });
        __ab.up(t, 0, 3);
        window.__battle.ui.select(t);
        return t;
      }, [id, u.noa]);
      await page.waitForFunction(() => { const el = document.querySelector('[data-testid="tower-panel"]'); return el && !el.hidden; }, null, { timeout: 15000 });
      await settle(page, 700);
      const row = await page.evaluate(() => {
        const r = document.querySelector('[data-testid="tower-panel"] [data-testid="ability-row"]');
        r?.scrollIntoView({ block: 'center' });
        return r ? { text: r.textContent.replace(/\s+/g, ' ').trim(), cls: r.className } : null;
      });
      await settle(page, 300);
      const slots = await page.evaluate(() => [...document.querySelectorAll('[data-testid="ability-bar"] [data-testid^="ability-slot"]')].length);
      out[name] = { uid, row, slots };
      log(`  ${name}: ${JSON.stringify(out[name])}`);
      out[name].probe = await uiProbe(page, { boxes: BATTLE_BOXES });
      log(`  probe ${name}: ${formatProbe(out[name].probe)}`);
      await shot(name);
      await page.evaluate(() => window.__battle.ui.select(null));
      await settle(page, 300);
    } };

    if (has('m3-swoop')) {
      // flyers in the sky by her, then the swoop; the frame when Kaze is out on his first dive
      const flyers = await page.evaluate((x) => {
        const { sim } = window.__battle;
        __ab.hold(false);
        window.__battle.ui.speed = 1;
        const h = sim.getTower(x.hana);
        return [...__m3.park('slime_bubble', h.x + 1.6, h.y, 2, 0.9), ...__m3.park('goblin_glider', h.x - 1.6, h.y, 2, 0.9)];
      }, u);
      await settle(page, 600);
      const r = await page.evaluate(async (x) => {
        const { ui, renderer } = window.__battle;
        __ab.ready(x.hana);
        const res = ui.castAbility(x.hana, { group: false });
        // Kaze out on the dive (the probe of the figure layer), then the frame held
        const t0 = performance.now();
        let row = null;
        let dive = 0;
        while (performance.now() - t0 < 3000) {
          await new Promise((rr) => requestAnimationFrame(rr));
          row = renderer.companionsProbe?.().actors.find((a) => a.cid === 'kaze');
          // (half a dive in: he is out by the flyer; a plain swoop of hers in flight first is waited out)
          if (row?.diving && !dive) dive = performance.now();
          if (dive && performance.now() - dive > 270) break;
        }
        __ab.hold(true);
        return { cast: res?.ok || res?.reason, kaze: row ? { mode: row.mode, diving: row.diving, dives: row.dives, target: row.targetUid } : null, enabled: renderer.companionsProbe?.().enabled };
      }, u);
      out['m3-swoop'] = { flyers, ...r };
      log(`  m3-swoop: ${JSON.stringify(out['m3-swoop'])}`);
      await clearToasts(page);
      await settle(page, 200);
      await shot('m3-swoop');
      await page.evaluate(() => { __ab.hold(false); });
    }

    if (has('m3-firstaid')) {
      // the rally on the girls around her; then (staging) kills at her feet bring a life back
      const r = await page.evaluate(async (x) => {
        const { sim, ui } = window.__battle;
        __ab.hold(false);
        ui.speed = 1;
        __m3.clear();
        const n = sim.getTower(x.noa);
        __m3.park('orc_grunt', n.x, n.y, 6, 0.35);
        sim.lives = Math.max(1, sim.maxLives - 5);
        __ab.ready(x.noa);
        const res = ui.castAbility(x.noa, { group: false });
        await new Promise((rr) => setTimeout(rr, 250));
        // ten kills a little way off (the rally counts any kill within 3 tiles of her), so their puffs leave her heart
        // in clear view; the frame when the puffs have faded and the heart is rising
        const off = sim.enemies.find((e) => !e.dead && e.__sturdy) || { x: n.x + 1.5, y: n.y };
        for (let k = 0; k < 10; k++) {
          const e = sim.spawnEnemy('slime_green', { dist: 1 });
          e.x = off.x;
          e.y = off.y;
          sim._killEnemy(e, sim.getTower(x.hana));
        }
        await new Promise((rr) => setTimeout(rr, 520));
        __ab.hold(true);
        return { cast: res?.ok || res?.reason, lives: sim.lives, max: sim.maxLives, toasts: __ab.toasts() };
      }, u);
      out['m3-firstaid'] = r;
      log(`  m3-firstaid: ${JSON.stringify(r)}`);
      const seen = await page.evaluate(() => __ab.toastSeen('First Aid Call'));
      out['m3-firstaid'].toast = seen;
      log(`  m3-firstaid toast: ${JSON.stringify(seen)}`);
      out['m3-firstaid'].probe = await uiProbe(page, { boxes: BATTLE_BOXES });
      log(`  probe m3-firstaid: ${formatProbe(out['m3-firstaid'].probe)}`);
      await shot('m3-firstaid');
    }
    await page.evaluate(() => { __ab.hold(true); });
    await teasers();
  }

  // ---- battle 2 (1-1, hero Seiran): Storm Lance's chain ----
  if (has('m3-lance')) {
    await page.evaluate(() => {
      const { store } = window.__sakura;
      store.profile.formation = { hero: 'seiran', towers: ['hana', 'aoi'] };
      store.commit('e2e');
      location.hash = '#/lobby';
    });
    await settle(page, 600);
    // (1-1: the 1-2 run above was saved when the page left it, and a saved stage opens on its prep screen)
    await openBattle(page, { stage: '1-1' });
    await installM3Helpers(page);
    const r = await page.evaluate(async () => {
      const { sim, ui } = window.__battle;
      const hero = __m3.placeCentre('seiran');
      __ab.heroTo(7);
      __ab.keepWave(60);
      ui.speed = 1;
      // (after the WAVE 1 banner has gone)
      await new Promise((rr) => setTimeout(rr, 1900));
      __m3.clear();
      const h = sim.getTower(hero);
      const foes = __m3.park('orc_grunt', h.x, h.y, 9, 0.7);
      await new Promise((rr) => setTimeout(rr, 120));
      __ab.ready(hero);
      const res = ui.castAbility(hero, { group: false });
      await new Promise((rr) => setTimeout(rr, 70));
      __ab.hold(true);
      const ev = window.__abilEv.filter((e) => e.type === 'ability' && e.id === 'seiran.stormLance').pop();
      return { hero, foes: foes.length, cast: res?.ok || res?.reason, chain: ev?.targets?.length ?? 0, level: sim.getTower(hero).level };
    });
    out['m3-lance'] = r;
    log(`  m3-lance: ${JSON.stringify(r)}`);
    await clearToasts(page);
    await settle(page, 100);
    await shot('m3-lance');
  }
  void vp;
  return out;
}
