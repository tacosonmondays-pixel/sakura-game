// The ability bar milestone's screenshot scenes (plan M1 acceptance; e2e/ui-shots.mjs --scenes m1-…): staged battle
// states on a seeded save, each written as <scene>-<W>x<H>.png. The staging drives the sim directly (window.__ab,
// e2e/lib/battleKit.mjs) and freezes the frame for stills; e2e/abilities.mjs checks the same features by input.
//   m1-between        the bar before a wave: grey slots, WAVE
//   m1-bar-idle       mid-wave, three slots: ready with its glow, charging with ring + seconds, ×2 with A; the hero
//                     skill button; the wave control lifted; nothing overlapping (the probe numbers are logged)
//   m1-bar-panel      a girl's panel open: the bar left of it with "+N" (phone), the ability row in view
//   m1-hold-card      the info card and the reach ring
//   m1-aim-wakaba     Time Out!'s aim mode: the banner, the girls ringed
//   m1-teaser         Aoi at 0-2-0: the ⚡ teaser on her path rows
//   m1-teaser-kage    Kage at tier 3: "Comes in a later update"
//   m1-cast-fx        Skyfall's lines and Starmine's warning rings
//   m1-girl-info-aoi  the girl page's ability chip (the kit bolt)
//   m1-girl-details-aoi / -hikari  its Details sheet: how to fire it (her portrait bottom right / the hero's bolt button)
//   m1-girl-tree-aoi  the bolt sticker on her ability path in the Tree tab
//   m1-reduce-motion  (844 only) Reduce motion: a still ready ring, FX that only fade
import { openApp, seedSave, openBattle, settle, until } from './battleKit.mjs';
import { uiProbe, formatProbe, BATTLE_BOXES } from './uiProbe.mjs';

export const M1_SCENES = ['m1-between', 'm1-bar-idle', 'm1-bar-panel', 'm1-hold-card', 'm1-aim-wakaba', 'm1-teaser', 'm1-teaser-kage', 'm1-cast-fx', 'm1-girl-info-aoi', 'm1-girl-details-aoi', 'm1-girl-details-hikari', 'm1-girl-tree-aoi', 'm1-reduce-motion'];
const GIRLS = ['hikari', 'aoi', 'akane', 'momo', 'wakaba', 'rei', 'yuki', 'miko', 'kage'];
const SQUAD = ['aoi', 'akane', 'momo', 'wakaba', 'rei', 'yuki', 'miko', 'kage'];

/** Staging: every enemy (and every one that spawns later) far sturdier, so a wave stays on the road for the stills. */
async function sturdyEnemies(page) {
  await page.evaluate(() => {
    const { sim } = window.__battle;
    clearInterval(window.__sturdy);
    window.__sturdy = setInterval(() => {
      for (const e of sim.enemies) {
        if (e.__sturdy) continue;
        e.__sturdy = 1;
        e.hp *= 60;
        e.maxHp *= 60;
      }
    }, 30);
  });
}
/** Removes the feed's toasts (several "learned" toasts at once only happen in staging). */
const clearToasts = (page) => page.evaluate(() => document.querySelectorAll('[data-testid="battle-feed"] .bt-toast').forEach((t) => t.remove()));

/**
 * @param {import('playwright').Page} page
 * @param {{ base: string, vp: string, want: string[], shot: (name: string) => Promise<void>, log?: (s: string) => void }} o
 * @returns {Promise<object>} probe results by scene
 */
export async function runM1Scenes(page, { base, vp, want, shot: rawShot, log = console.log }) {
  const has = (n) => want.includes(n);
  // (a battle still: the feed's staging toasts cleared first)
  const shot = async (n) => {
    if (!n.startsWith('m1-girl-')) await clearToasts(page).catch(() => {});
    await rawShot(n);
  };
  const probes = {};
  const phone = Number(vp.split('x')[0]) < 1000;
  await openApp(page, base);
  await seedSave(page, { girls: GIRLS, hero: 'hikari', towers: SQUAD, settings: { reduceMotion: false } });

  if (has('m1-girl-info-aoi')) {
    await page.evaluate(() => { location.hash = '#/student/aoi?tab=info'; });
    await page.waitForFunction(() => document.querySelector('#app')?.dataset.screen === 'student' && document.querySelector('[data-testid="info-ability"]'), null, { timeout: 30000 });
    // (a new save's lesson and achievement pop-ups slide away first)
    await settle(page, 6500);
    probes['m1-girl-info-aoi'] = await uiProbe(page);
    log(`  probe m1-girl-info-aoi: ${formatProbe(probes['m1-girl-info-aoi'])}`);
    await shot('m1-girl-info-aoi');
  }
  // the ability's Details sheet (how to fire it in battle: her portrait at the bottom right / the hero's bolt button)
  for (const id of ['aoi', 'hikari']) {
    const name = `m1-girl-details-${id}`;
    if (!has(name)) continue;
    await page.evaluate((u) => { location.hash = `#/student/${u}?tab=info`; }, id);
    await page.waitForFunction(() => document.querySelector('#app')?.dataset.screen === 'student' && document.querySelector('[data-testid="info-ability"]'), null, { timeout: 30000 });
    await settle(page, 6500);
    await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
    await page.locator('[data-testid="info-ability"]').click({ force: true });
    await page.waitForSelector('[data-testid="ability-sheet"]', { timeout: 10000 });
    await settle(page, 600);
    log(`  ${name}: ${(await page.locator('[data-testid="ability-sheet"]').innerText()).replace(/\s+/g, ' ').slice(0, 400)}`);
    await shot(name);
    await page.keyboard.press('Escape');
    await settle(page, 300);
  }
  if (has('m1-girl-tree-aoi')) {
    await page.evaluate(() => { location.hash = '#/student/aoi?tab=tree'; });
    await page.waitForFunction(() => document.querySelector('[data-testid="ug-abil-1"]'), null, { timeout: 30000 });
    await settle(page, 1500);
    probes['m1-girl-tree-aoi'] = await uiProbe(page);
    log(`  probe m1-girl-tree-aoi: ${formatProbe(probes['m1-girl-tree-aoi'])}`);
    await shot('m1-girl-tree-aoi');
  }

  const battleScenes = M1_SCENES.filter((s) => !s.startsWith('m1-girl-') && s !== 'm1-reduce-motion');
  if (battleScenes.some(has)) {
    await openBattle(page, { stage: '1-2' });
    const u = await page.evaluate(() => {
      const aoi = __ab.place('aoi');
      const akane = __ab.place('akane', { near: aoi, min: 1.3 });
      const m1 = __ab.place('momo', { near: aoi, min: 2.2 });
      const m2 = __ab.place('momo', { near: aoi, min: 3 });
      const hero = __ab.place('hikari', { near: aoi, min: 0.8 });
      for (const t of [aoi, akane, m1, m2]) __ab.unlock(t);
      __ab.heroTo(7);
      return { aoi, akane, m1, m2, hero };
    });
    await settle(page, 600);
    if (has('m1-between')) {
      probes['m1-between'] = await uiProbe(page, { boxes: BATTLE_BOXES });
      log(`  probe m1-between: ${formatProbe(probes['m1-between'])}`);
      await shot('m1-between');
    }
    // a wave with (sturdy) enemies on the road, then frozen
    await sturdyEnemies(page);
    await page.evaluate(() => { window.__battle.ui.startWave(); window.__battle.ui.speed = 2; });
    const onRoad = await until(page, (a) => __ab.inReach(a) >= 2, u.aoi, 40000);
    log(`  staging: enemies in Aoi's reach ${onRoad}`);
    await page.evaluate((x) => {
      __ab.hold(true);
      __ab.ready(x.aoi);
      __ab.ready(x.akane, { cd: Math.round(12.4 * 60) * 100 });
      __ab.ready(x.m1, { auto: true });
      __ab.ready(x.m2, { auto: true });
      __ab.ready(x.hero);
    }, u);
    await clearToasts(page);
    await settle(page, 500);
    if (has('m1-bar-idle')) {
      probes['m1-bar-idle'] = await uiProbe(page, { boxes: BATTLE_BOXES });
      log(`  probe m1-bar-idle: ${formatProbe(probes['m1-bar-idle'])}`);
      log(`    numbers: ${JSON.stringify(probes['m1-bar-idle'].numberTexts)}`);
      await shot('m1-bar-idle');
    }
    // more girls: the bar outgrows the room beside an open panel ("+N")
    const more = await page.evaluate((a) => {
      const out = {};
      for (const [id, n] of [['wakaba', 1.5], ['rei', 2.5], ['yuki', 3.4], ['miko', 4.2]]) {
        out[id] = __ab.place(id, { near: a, min: n });
        __ab.unlock(out[id]);
        __ab.ready(out[id]);
      }
      return out;
    }, u.aoi);
    if (has('m1-bar-panel')) {
      await page.evaluate((a) => window.__battle.ui.select(a), u.aoi);
      await clearToasts(page);
      await settle(page, 900);
      // the bar has finished sliding beside the panel (its right edge at --bt-abar-panel-r)
      const slid = await until(page, () => {
        const b = document.querySelector('[data-testid="ability-bar"]');
        if (!b || b.hidden || getComputedStyle(b).display === 'none') return true;
        const cs = getComputedStyle(b);
        return Math.abs(parseFloat(cs.right) - parseFloat(cs.getPropertyValue('--bt-abar-panel-r'))) < 1.5;
      }, null, 5000);
      if (!slid) log(`  (the bar is still at right ${await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="ability-bar"]')).right)})`);
      probes['m1-bar-panel'] = await uiProbe(page, { boxes: BATTLE_BOXES });
      log(`  probe m1-bar-panel: ${formatProbe(probes['m1-bar-panel'])}`);
      await shot('m1-bar-panel');
      await page.evaluate(() => window.__battle.ui.select(null));
      await settle(page, 300);
    }
    if (has('m1-hold-card')) {
      await page.evaluate(() => window.__battle.ui.abilityBar.openCard('aoi.skyfall'));
      await settle(page, 400);
      probes['m1-hold-card'] = await uiProbe(page, { boxes: { ...BATTLE_BOXES, card: '[data-testid="ability-card"]' } });
      log(`  probe m1-hold-card: ${formatProbe(probes['m1-hold-card'])}`);
      await shot('m1-hold-card');
      await page.evaluate(() => window.__battle.ui.abilityBar.closeCard());
    }
    if (has('m1-aim-wakaba')) {
      await page.evaluate((w) => { __ab.ready(w); window.__battle.ui.abilityBar.fireId('wakaba.timeOut'); }, more.wakaba);
      await settle(page, 400);
      await shot('m1-aim-wakaba');
      await page.evaluate(() => window.__battle.ui.aim.cancel());
    }
    if (has('m1-teaser')) {
      const a2 = await page.evaluate((a) => {
        const t = __ab.place('aoi', { near: a, min: 5 });
        __ab.up(t, 1, 2);
        window.__battle.ui.select(t);
        return t;
      }, u.aoi);
      await settle(page, 700);
      // her ⚡ path's next row (T3: the teaser) in view
      await page.evaluate(() => document.querySelector('[data-testid="tower-panel"] [data-testid="path-abil-1"]')?.closest('.bt-path')?.scrollIntoView({ block: 'center' }));
      await settle(page, 300);
      probes['m1-teaser'] = await uiProbe(page, { boxes: BATTLE_BOXES });
      log(`  probe m1-teaser: ${formatProbe(probes['m1-teaser'])} (Aoi ${a2})`);
      await shot('m1-teaser');
    }
    if (has('m1-teaser-kage')) {
      await page.evaluate((a) => {
        const k = __ab.place('kage', { near: a, min: 5.5 });
        __ab.unlock(k);
        window.__battle.ui.select(k);
      }, u.aoi);
      await settle(page, 700);
      await shot('m1-teaser-kage');
    }
    if (has('m1-cast-fx')) {
      await page.evaluate(() => {
        const { ui, sim } = window.__battle;
        ui.select(null);
        __ab.hold(false);
        ui.speed = 1;
        if (sim.state !== 'wave') ui.startWave();
      });
      await until(page, (x) => window.__battle.sim.state === 'wave' && __ab.inReach(x.aoi) >= 2 && __ab.inReach(x.akane) >= 2, u, 60000);
      const ok = await page.evaluate(async (x) => {
        const { ui } = window.__battle;
        let a = null;
        for (let i = 0; i < 60 && !a?.ok; i++) {
          __ab.ready(x.akane);
          a = ui.castAbility(x.akane, { group: false });
          if (!a?.ok) await new Promise((r) => setTimeout(r, 100));
        }
        // her warning rings are up; Aoi's volley lands while they are
        await new Promise((r) => setTimeout(r, 120));
        __ab.ready(x.aoi);
        const b = ui.castAbility(x.aoi, { group: false });
        return [a?.ok || a?.reason, b?.ok || b?.reason];
      }, u);
      log(`  m1-cast-fx casts: Starmine ${ok[0]}, Skyfall ${ok[1]}`);
      await clearToasts(page);
      await page.waitForTimeout(90);
      await shot('m1-cast-fx');
    }
  }

  if (has('m1-reduce-motion') && phone) {
    await page.evaluate(() => {
      const { store } = window.__sakura;
      store.profile.settings.reduceMotion = true;
      store.commit('e2e');
      location.hash = '#/lobby';
    });
    await settle(page, 600);
    // (1-1: the 1-2 run above was saved when the page left it, and a saved stage opens on its prep screen)
    await openBattle(page, { stage: '1-1' });
    await sturdyEnemies(page);
    const r = await page.evaluate(() => {
      const aoi = __ab.place('aoi');
      const akane = __ab.place('akane', { skip: 10 });
      __ab.unlock(aoi);
      __ab.unlock(akane);
      window.__battle.ui.startWave();
      window.__battle.ui.speed = 2;
      return { aoi, akane };
    });
    await until(page, (a) => __ab.inReach(a) >= 2, r.aoi, 40000);
    const cast = await page.evaluate(async (x) => {
      const { ui } = window.__battle;
      ui.speed = 1;
      __ab.ready(x.akane);
      __ab.ready(x.aoi);
      const res = ui.castAbility(x.aoi, { group: false });
      __ab.ready(x.aoi);
      return res?.ok || res?.reason;
    }, r);
    log(`  m1-reduce-motion cast: ${cast}`);
    await clearToasts(page);
    // (the bar has rebuilt: Akane's still ready ring; Aoi's volley lines are fading)
    await page.waitForTimeout(280);
    await shot('m1-reduce-motion');
  }
  return probes;
}
