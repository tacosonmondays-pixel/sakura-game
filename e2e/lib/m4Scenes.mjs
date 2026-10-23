// The A3 plan's M4 screenshot scenes (the tactical girl drawer, the hero drawer, the battle number style;
// e2e/ui-shots.mjs --scenes m4-…): a seeded save, each written as <scene>-<W>x<H>.png. Battle scenes drive the sim
// directly (window.__ab, e2e/lib/battleKit.mjs) and run the shared DOM probe (e2e/lib/uiProbe.mjs) on every still.
//   m4-drawer-aoi        Aoi 2-0-1 on 1-1, the approved image's layout (stat row DMG · RATE · RANGE · PIERCE)
//   m4-drawer-armed      the same drawer after tap 1 on her first price: the row open, "Buy · 650"
//   m4-drawer-locked     a second Aoi 4-2-0 beside a 5-0-0: the crosspath line and the final-tier holder with Show ›
//   m4-drawer-azami      Azami at Checkpoint T3: the strip chips (Near exit · Spread · Checkpoint)
//   m4-drawer-chika      Chika with her drones out: the Flight row and the pick control on the Glance
//   m4-drawer-chika-more Chika's MORE: the split bar and the Overall · Chika · Drones tabs
//   m4-drawer-more       Aoi's MORE (the stats sheet): compact numbers (136.2k damage dealt, 12.3k kills)
//   m4-hero-drawer       Hikari's drawer (LV, XP bar, Level up · price, Next, the ult row): the HUD widget hidden
//   m4-reduce-motion     (844 only) the game's Reduce motion on: 60 ms after the tap the drawer is already in place
//                        (base.css cuts every animation to 1 ms: no slide, no scale)
// M4 review fixes (look-1, look-3):
//   m4-drawer-ability    Aoi 0-3-0: her ⚡ ability row on the Glance, the three path rows still in view at 844
//   m4-drawer-ability-armed  the same after tap 1 on her third row: the open row is one line, its Buy in view
//   m4-drawer-midori     Midori 2-0-0: the BREW pick row on the Glance
//   m4-drawer-iroha      Iroha: the MIRROR aim row; at 844 her attack type keeps only its icon (the words would wrap)
//   m4-drawer-teaser     Aoi 0-2-0 after tap 1 on Rapid Volley: the open row's "⚡ Unlocks Skyfall Volley"
//   m4-hero-more         Hikari LV 7's MORE: the ult text with "(rank 2 at LV n)"
// Every drawer still is checked (the run fails on a miss): at 844 each path row and its price inside the scroll body
// (an open row: its Buy in view, the rest in view or the scroll cue shown), the cue shown exactly when the body
// overflows, the open row one line; the drawer's smallest text ≥ 12 px at 844 and ≥ 13 px at 1280; nothing cut by
// an ellipsis.
import { openApp, seedSave, openBattle, settle, until } from './battleKit.mjs';
import { uiProbe, formatProbe, drawerPathsInView, BATTLE_BOXES } from './uiProbe.mjs';

export const M4_SCENES = [
  'm4-drawer-aoi', 'm4-drawer-armed', 'm4-drawer-locked', 'm4-drawer-azami', 'm4-drawer-chika', 'm4-drawer-chika-more', 'm4-drawer-more', 'm4-hero-drawer', 'm4-reduce-motion',
  'm4-drawer-ability', 'm4-drawer-ability-armed', 'm4-drawer-midori', 'm4-drawer-iroha', 'm4-drawer-teaser', 'm4-hero-more',
];
const GIRLS = ['hikari', 'aoi', 'azami', 'chika', 'miko', 'momo', 'rei', 'akane', 'midori', 'iroha'];
const SQUAD = ['aoi', 'azami', 'chika', 'miko', 'momo', 'midori', 'iroha'];
const BOXES = BATTLE_BOXES;

const clearToasts = (page) => page.evaluate(() => document.querySelectorAll('[data-testid="battle-feed"] .bt-toast').forEach((t) => t.remove()));
const panelOpen = (page) => page.waitForFunction(() => { const el = document.querySelector('[data-testid="tower-panel"]'); return el && !el.hidden; }, null, { timeout: 15000 });

/** What the drawer shows: width, its sections' numbers, the texts the checks read. */
async function drawerFacts(page) {
  return page.evaluate(() => {
    const p = document.querySelector('[data-testid="tower-panel"]');
    if (!p || p.hidden) return null;
    const r = p.getBoundingClientRect();
    const nums = (el) => {
      if (!el) return 0;
      const seen = new Set();
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const e = n.parentElement;
        if (!/\d/.test(n.nodeValue) || !e || e.closest('[hidden]') || !e.getClientRects().length) continue;
        seen.add(e);
      }
      return seen.size;
    };
    const sections = {
      header: nums(p.querySelector('.bt-panel-head')),
      ability: nums(p.querySelector('[data-testid="ability-row"]')),
      target: nums(p.querySelector('.bt-target')),
      stats: nums(p.querySelector('[data-testid="drawer-stats"]')),
      ...Object.fromEntries([...p.querySelectorAll('.bt-path')].map((row, i) => [`path${i}`, nums(row)])),
      footer: nums(p.querySelector('.bt-panel-foot')),
    };
    return {
      width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(innerHeight - r.bottom),
      sections, total: nums(p),
      stats: [...p.querySelectorAll('[data-testid="drawer-stats"] .bt-dw-stat')].map((c) => c.textContent.replace(/\s+/g, ' ').trim()),
      target: [...p.querySelectorAll('.bt-target .bt-tchip')].map((c) => `${c.textContent}${c.classList.contains('on') ? '*' : ''}`),
      rows: [...p.querySelectorAll('.bt-path')].map((row) => row.innerText.replace(/\s+/g, ' ').trim()),
      foot: p.querySelector('.bt-panel-foot')?.innerText.replace(/\s+/g, ' ').trim(),
      more: !!p.querySelector('[data-testid="panel-details"]'),
      bar: (() => { const b = document.querySelector('[data-testid="ability-bar"]'); const br = b?.getBoundingClientRect(); return br && br.width ? { right: Math.round(innerWidth - br.right), panelLeft: Math.round(r.left), barRight: Math.round(br.right) } : null; })(),
      herow: (() => { const w = document.querySelector('[data-testid="hero-widget"]'); return w ? getComputedStyle(w).display !== 'none' && !w.hidden : null; })(),
    };
  });
}

/**
 * @param {import('playwright').Page} page
 * @param {{ base: string, vp: string, want: string[], shot: (name: string) => Promise<void>, log?: (s: string) => void }} o
 * @returns {Promise<object>} probe results and drawer facts by scene
 */
export async function runM4Scenes(page, { base, vp, want, shot: rawShot, log = console.log }) {
  const has = (n) => want.includes(n) && (n !== 'm4-reduce-motion' || vp === '844x390');
  const out = { failures: [] };
  const phone = vp === '844x390';
  const floor = phone ? 12 : 13; // UI_DIRECTION P6: 12 px [13 px]
  const fail = (name, what) => {
    out.failures.push(`${name} ${vp}: ${what}`);
    log(`  FAIL ${name}: ${what}`);
  };
  const still = async (name, { armed = false } = {}) => {
    await clearToasts(page).catch(() => {});
    await settle(page, 250);
    const facts = await drawerFacts(page);
    const probe = await uiProbe(page, { boxes: BOXES });
    // the drawer on its own (its smallest text, truncation, numbers): the HUD and the card strip are M5's
    const drawer = await uiProbe(page, { root: '[data-testid="tower-panel"]' });
    const paths = await drawerPathsInView(page);
    out[name] = { facts, probe, drawer, paths };
    log(`  ${name}: ${JSON.stringify(facts)}`);
    log(`  probe ${name}: ${formatProbe(probe)}`);
    log(`  drawer probe ${name}: numbers ${drawer.numbers} · smallest ${drawer.smallest ? `${drawer.smallest.px}px (${drawer.smallest.text})` : '–'} · ${drawer.truncated.length} truncated`);
    log(`  paths ${name}: ${JSON.stringify(paths)}`);
    if (drawer.smallest && drawer.smallest.px < floor) fail(name, `drawer text under ${floor} px: ${drawer.smallest.px}px "${drawer.smallest.text}" (${drawer.smallest.sel})`);
    if (drawer.truncated.length) fail(name, `drawer text cut by an ellipsis: ${JSON.stringify(drawer.truncated)}`);
    if (paths?.rows.length) {
      // (the scroll cue says exactly when more of the body sits below)
      if (paths.cue !== paths.overflow) fail(name, `the scroll cue is ${paths.cue ? 'on' : 'off'} while the body ${paths.overflow ? 'overflows' : 'fits'}`);
      if (paths.openOneLine === false) fail(name, 'the open row is more than one line, or a piece of it is cut');
      if (phone && !armed && !paths.allIn) fail(name, `a path row or its price is out of the scroll body at 844: ${JSON.stringify(paths.rows)}`);
      if (armed && !paths.armedIn) fail(name, `the open row or its Buy is out of view: ${JSON.stringify(paths.rows)}`);
      if (armed && !paths.allIn && !paths.cue) fail(name, 'a row sits below the fold with no scroll cue');
    }
    await rawShot(name);
  };
  await openApp(page, base);
  await seedSave(page, { girls: GIRLS, hero: 'hikari', towers: SQUAD, settings: { reduceMotion: false }, aoi: { level: 48, breakthrough: 4, awaken: 3 }, cleared: ['1-1'] });

  await openBattle(page, { stage: '1-1', cash: 1e6 });
  const u = await page.evaluate(() => {
    const { sim } = window.__battle;
    const aoi = __ab.place('aoi');
    __ab.up(aoi, 0, 2);
    __ab.up(aoi, 2, 1);
    sim.cash = 1250;
    return { aoi };
  });
  await settle(page, 500);

  if (has('m4-drawer-aoi') || has('m4-drawer-armed')) {
    await page.evaluate((x) => window.__battle.ui.select(x.aoi), u);
    await panelOpen(page);
    await settle(page, 700);
    if (has('m4-drawer-aoi')) await still('m4-drawer-aoi');
    if (has('m4-drawer-armed')) {
      await page.locator('[data-testid="tower-panel"] [data-testid="buy-0"]').click({ force: true });
      await settle(page, 200);
      await still('m4-drawer-armed', { armed: true });
      const armed = await page.evaluate(() => document.querySelector('[data-testid="buy-0"]')?.textContent);
      log(`  m4-drawer-armed: buy-0 reads "${armed}"`);
    }
    await page.evaluate(() => window.__battle.ui.select(null));
    await settle(page, 300);
  }

  if (has('m4-drawer-more')) {
    await page.evaluate((x) => {
      const { sim, ui } = window.__battle;
      sim.cash = 1e6;
      const t = sim.getTower(x.aoi);
      t.damageDealt = 136234.5;
      t.kills = 12345;
      ui.select(x.aoi);
      sim.cash = 1250;
    }, u);
    await panelOpen(page);
    await page.locator('[data-testid="tower-panel"] [data-testid="panel-more"]').click({ force: true });
    await page.waitForSelector('[data-testid="panel-details"]', { timeout: 10000 });
    await settle(page, 500);
    await still('m4-drawer-more');
    const dealt = await page.evaluate(() => ({ kills: document.querySelector('[data-testid="stat-kills"] b')?.textContent, dealt: document.querySelector('[data-testid="stat-dealt"] b')?.textContent }));
    log(`  m4-drawer-more: ${JSON.stringify(dealt)}`);
    await page.locator('[data-testid="tower-panel"] [data-testid="panel-more"]').click({ force: true });
    await page.evaluate(() => window.__battle.ui.select(null));
    await settle(page, 300);
  }

  if (has('m4-drawer-locked')) {
    const b = await page.evaluate((x) => {
      const { sim, ui } = window.__battle;
      sim.cash = 1e7;
      const a5 = __ab.place('aoi', { near: x.aoi, min: 2.5 });
      __ab.up(a5, 0, 5);
      const b4 = __ab.place('aoi', { near: x.aoi, min: 4 });
      __ab.up(b4, 0, 4);
      __ab.up(b4, 1, 2);
      sim.cash = 1250;
      ui.select(b4);
      return { a5, b4, tiers: sim.getTower(b4).tiers.join('-'), held: sim.upgradeStatus(b4, 0).reason, p1: sim.upgradeStatus(b4, 1).reason, p2: sim.upgradeStatus(b4, 2).reason };
    }, u);
    log(`  m4-drawer-locked staging: ${JSON.stringify(b)}`);
    await panelOpen(page);
    await settle(page, 600);
    await still('m4-drawer-locked');
    await page.evaluate(() => window.__battle.ui.select(null));
    await settle(page, 300);
  }

  if (has('m4-drawer-azami')) {
    const z = await page.evaluate((x) => {
      const { sim, ui } = window.__battle;
      sim.cash = 1e7;
      const t = __ab.place('azami', { near: x.aoi, min: 3 });
      const p = sim.getTower(t).def.paths.findIndex((q) => /checkpoint/i.test(q.name));
      __ab.up(t, p >= 0 ? p : 0, 3);
      sim.cash = 1250;
      ui.select(t);
      return { t, path: p, tiers: sim.getTower(t).tiers.join('-') };
    }, u);
    log(`  m4-drawer-azami staging: ${JSON.stringify(z)}`);
    await panelOpen(page);
    await settle(page, 600);
    await still('m4-drawer-azami');
    await page.evaluate(() => window.__battle.ui.select(null));
    await settle(page, 300);
  }

  if (has('m4-drawer-chika') || has('m4-drawer-chika-more')) {
    const c = await page.evaluate((x) => {
      const { sim } = window.__battle;
      sim.cash = 1e7;
      const t = __ab.place('chika', { near: x.aoi, min: 2 });
      __ab.up(t, 0, 2);
      __ab.up(t, 1, 1);
      return { t };
    }, u);
    // a wave so her drones fly, then hold the frame
    await page.evaluate(() => __ab.keepWave(40));
    await until(page, (x) => (window.__battle.sim.getTower(x.t)?.turrets?.length || 0) >= 2, c, 40000);
    await page.evaluate((x) => {
      __ab.hold(true);
      window.__battle.sim.cash = 1250;
      window.__battle.ui.select(x.t);
    }, c);
    await panelOpen(page);
    await settle(page, 600);
    if (has('m4-drawer-chika')) await still('m4-drawer-chika');
    if (has('m4-drawer-chika-more')) {
      await page.locator('[data-testid="tower-panel"] [data-testid="panel-more"]').click({ force: true });
      await page.waitForSelector('[data-testid="tab-overall"]', { timeout: 10000 });
      await settle(page, 400);
      await still('m4-drawer-chika-more');
      await page.locator('[data-testid="tower-panel"] [data-testid="panel-more"]').click({ force: true });
    }
    await page.evaluate(() => { window.__battle.ui.select(null); __ab.hold(false); });
    await settle(page, 300);
  }

  // ---- the M4 review's look-1 / look-3 scenes: a Glance with one more row, and the text the first probe never opened
  const stage = (fn, arg) => page.evaluate(fn, arg);
  const show = async (uid) => {
    await page.evaluate((x) => { window.__battle.sim.cash = 1250; window.__battle.ui.select(x); }, uid);
    await panelOpen(page);
    await settle(page, 600);
  };
  const done = async () => {
    await page.evaluate(() => window.__battle.ui.select(null));
    await settle(page, 300);
  };
  if (has('m4-drawer-ability') || has('m4-drawer-ability-armed')) {
    const a3 = await stage((x) => {
      window.__battle.sim.cash = 1e7;
      const t = __ab.place('aoi', { near: x.aoi, min: 3 });
      __ab.unlock(t, 3);
      return { t, tiers: window.__battle.sim.getTower(t).tiers.join('-') };
    }, u);
    log(`  m4-drawer-ability staging: ${JSON.stringify(a3)}`);
    await show(a3.t);
    if (has('m4-drawer-ability')) await still('m4-drawer-ability');
    if (has('m4-drawer-ability-armed')) {
      await page.evaluate(() => { window.__battle.sim.cash = 1e6; });
      await settle(page, 200);
      await page.locator('[data-testid="tower-panel"] [data-testid="buy-2"]').click({ force: true });
      await settle(page, 200);
      await still('m4-drawer-ability-armed', { armed: true });
    }
    await done();
  }
  if (has('m4-drawer-midori')) {
    const m = await stage((x) => {
      window.__battle.sim.cash = 1e7;
      const t = __ab.place('midori', { near: x.aoi, min: 3 });
      __ab.up(t, 0, 2);
      return { t, tiers: window.__battle.sim.getTower(t).tiers.join('-') };
    }, u);
    log(`  m4-drawer-midori staging: ${JSON.stringify(m)}`);
    await show(m.t);
    await still('m4-drawer-midori');
    await done();
  }
  if (has('m4-drawer-iroha')) {
    const r = await stage((x) => ({ t: __ab.place('iroha', { near: x.aoi, min: 3 }) }), u);
    await show(r.t);
    await still('m4-drawer-iroha');
    const tags = await page.evaluate(() => {
      const c = document.querySelector('[data-testid="tower-panel"] .bt-dw-chips');
      const [a, b] = c ? [...c.children] : [];
      return { oneLine: !!a && !!b && Math.abs(a.offsetTop - b.offsetTop) <= 2, icons: !!c?.classList.contains('bt-dw-chips-icons'), label: b?.getAttribute('aria-label') };
    });
    log(`  m4-drawer-iroha: role / attack chips ${JSON.stringify(tags)}`);
    if (!tags.oneLine) fail('m4-drawer-iroha', `her role and attack chips wrap onto two lines (${JSON.stringify(tags)})`);
    await done();
  }
  if (has('m4-drawer-teaser')) {
    const z = await stage((x) => {
      window.__battle.sim.cash = 1e7;
      const t = __ab.place('aoi', { near: x.aoi, min: 4 });
      __ab.up(t, __ab.abilPath(t), 2);
      return { t, path: __ab.abilPath(t), tiers: window.__battle.sim.getTower(t).tiers.join('-') };
    }, u);
    log(`  m4-drawer-teaser staging: ${JSON.stringify(z)}`);
    await show(z.t);
    await page.evaluate(() => { window.__battle.sim.cash = 1e6; });
    await settle(page, 200);
    await page.locator(`[data-testid="tower-panel"] [data-testid="buy-${z.path}"]`).click({ force: true });
    await settle(page, 200);
    const teaser = await page.evaluate((p) => {
      const e = document.querySelector(`[data-testid="tower-panel"] [data-testid="path-abil-${p}"]`);
      return e ? { text: e.textContent, px: parseFloat(getComputedStyle(e).fontSize) } : null;
    }, z.path);
    log(`  m4-drawer-teaser: ${JSON.stringify(teaser)}`);
    if (!teaser || !/Unlocks/.test(teaser.text)) fail('m4-drawer-teaser', `the open ⚡ row shows no "Unlocks …" line (${JSON.stringify(teaser)})`);
    else if (teaser.px < floor) fail('m4-drawer-teaser', `the ⚡ line is ${teaser.px}px (floor ${floor})`);
    await still('m4-drawer-teaser', { armed: true });
    await done();
  }

  if (has('m4-hero-drawer')) {
    const hv = await page.evaluate((x) => {
      const { sim, ui } = window.__battle;
      __ab.hold(true);
      let hero = sim.hero;
      if (!hero) {
        const uid = __ab.place('hikari', { near: x.aoi, min: 1.5 });
        hero = sim.getTower(uid);
      }
      sim.cash = 1250;
      ui.select(hero.uid);
      return { uid: hero.uid, level: hero.level };
    }, u);
    log(`  m4-hero-drawer staging: ${JSON.stringify(hv)}`);
    await panelOpen(page);
    await settle(page, 600);
    await still('m4-hero-drawer');
    await page.evaluate(() => { window.__battle.ui.select(null); __ab.hold(false); });
    await settle(page, 300);
  }

  if (has('m4-hero-more')) {
    const hv = await stage((x) => {
      const { sim } = window.__battle;
      __ab.hold(true);
      sim.cash = 1e7;
      if (!sim.hero) __ab.place('hikari', { near: x.aoi, min: 1.5 });
      __ab.heroTo(7);
      return { uid: sim.hero?.uid ?? null, level: sim.hero?.level ?? 0 };
    }, u);
    log(`  m4-hero-more staging: ${JSON.stringify(hv)}`);
    await show(hv.uid);
    await page.locator('[data-testid="tower-panel"] [data-testid="panel-more"]').click({ force: true });
    await page.waitForSelector('[data-testid="panel-details"]', { timeout: 10000 });
    await settle(page, 400);
    const rank = await page.evaluate(() => {
      const s = document.querySelector('[data-testid="tower-panel"] .bt-dt-ult small');
      if (!s) return null;
      s.scrollIntoView({ block: 'nearest' });
      return { text: s.textContent, px: parseFloat(getComputedStyle(s).fontSize) };
    });
    log(`  m4-hero-more: ult aside ${JSON.stringify(rank)}`);
    if (!rank) fail('m4-hero-more', 'no "(rank n at LV n)" aside in the ult text');
    else if (rank.px < floor) fail('m4-hero-more', `"${rank.text.trim()}" is ${rank.px}px (floor ${floor})`);
    await still('m4-hero-more');
    await page.locator('[data-testid="tower-panel"] [data-testid="panel-more"]').click({ force: true });
    await page.evaluate(() => { window.__battle.ui.select(null); __ab.hold(false); });
    await settle(page, 300);
  }

  if (has('m4-reduce-motion')) {
    // the game's own Reduce motion switch (html[data-reduce-motion]) with the system setting off, so the still shows
    // the game's rule: the drawer never slides in
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => {
      const { store } = window.__sakura;
      store.profile.settings.reduceMotion = true;
      store.commit('e2e');
      document.documentElement.setAttribute('data-reduce-motion', '');
    });
    await page.evaluate((x) => {
      window.__battle.sim.cash = 1250;
      window.__battle.ui.select(x.aoi);
    }, u);
    await page.waitForTimeout(60);
    const anim = await page.evaluate(() => {
      const p = document.querySelector('[data-testid="tower-panel"]');
      const cs = getComputedStyle(p);
      return { animation: cs.animationName, duration: cs.animationDuration, transform: cs.transform, opacity: cs.opacity };
    });
    log(`  m4-reduce-motion: ${JSON.stringify(anim)}`);
    out['m4-reduce-motion'] = { anim };
    await rawShot('m4-reduce-motion');
    await settle(page, 400);
    await page.emulateMedia({ reducedMotion: 'reduce' });
  }
  return out;
}
