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
// M4 re-review (look-1, the scroll cue), in a second battle with another squad:
//   m4-drawer-fit        stills m4-fit-<girl>-<tiers>: Midori, Iroha, Chika, Tenka 3-2-0, Azami, Sango, Aoi 0-3-2 and
//                        Raika 2-0-3 (her ⚡ path at T3 and a second path at T2: the third row a lock), closed, then tap 1
//                        on each price (checked, no screenshot); m4-fit-cue: on Aoi's drawer the last row put exactly
//                        on the fold (scrollHeight overflows by its "i"'s tap area): no cue; 10 px lower: the cue;
//                        m4-fit-held: Aoi 4-2-0 beside a 5-0-0 in a corner of the map ("Held by Aoi 5-0-0 · bottom
//                        right · Show ›" would wrap at 844: the place steps away, the row stays one row high)
//   m4-drawer-ally       a co-op partner's Aoi 1-3-0 and 2-3-0 (m4-drawer-ally-230, her owner's name 16 characters
//                        long): the ally note one line at 844
// M4 re-review, round 3 (the lock "i"'s reason was cut on a phone, and hidden under the drawer at 1280 on 1-1):
//   m4-lock-why          each lock "i" tapped for real (a touch tap at 844, a click at 1280) on 1-1, where the spawn
//                        sends the feed to the right: Aoi 2-3-0's capped row, then at once her third row (the toast
//                        swaps its words: one lock toast), Sango 3-2-0 (the longest path names), Sango 4-2-0 beside a
//                        5-0-0 (the held final tier: its "i" on a phone; at 1280 the rule in the row), tap 2 on a price
//                        she cannot pay ("Need N more coins."), then one "i" with the feed forced into each top corner.
//                        Each toast must be on top at its centre (not under the drawer) and one line, nothing cut
//                        (battleKit toastSeen); stills m4-lock-why-<case>
// Every drawer still is checked (the run fails on a miss): at 844 each path row and its price inside the scroll body
// (an open row: its Buy in view, the rest in view or the scroll cue shown), each lock row one row high (its lock line
// in the tier line's place), the cue shown exactly when content sits below the fold (measured from the body's
// children, never scrollHeight), the open row one line; the drawer's smallest text ≥ 12 px at 844 and ≥ 13 px at
// 1280; nothing cut by an ellipsis.
import { openApp, seedSave, openBattle, settle, until } from './battleKit.mjs';
import { uiProbe, formatProbe, drawerPathsInView, BATTLE_BOXES } from './uiProbe.mjs';

export const M4_SCENES = [
  'm4-drawer-aoi', 'm4-drawer-armed', 'm4-drawer-locked', 'm4-drawer-azami', 'm4-drawer-chika', 'm4-drawer-chika-more', 'm4-drawer-more', 'm4-hero-drawer', 'm4-reduce-motion',
  'm4-drawer-ability', 'm4-drawer-ability-armed', 'm4-drawer-midori', 'm4-drawer-iroha', 'm4-drawer-teaser', 'm4-hero-more',
  'm4-drawer-fit', 'm4-drawer-ally', 'm4-lock-why',
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
  const still = async (name, { armed = false, shot = true } = {}) => {
    await clearToasts(page).catch(() => {});
    await settle(page, 250);
    // (the rows first: an open row closes 2.6 s after tap 1, and the whole-page probe can take a second on a busy PC)
    const paths = await drawerPathsInView(page);
    const facts = await drawerFacts(page);
    const probe = await uiProbe(page, { boxes: BOXES });
    // the drawer on its own (its smallest text, truncation, numbers): the HUD and the card strip are M5's
    const drawer = await uiProbe(page, { root: '[data-testid="tower-panel"]' });
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
      if (phone && armed && paths.armedTopH > 20) fail(name, `the open row's name line wraps (${paths.armedTopH} px)`);
      // (a phone's lock row is one row high: its lock line takes the tier line's place, one line high)
      for (const r of phone ? paths.rows.filter((x) => x.locked) : []) {
        if (r.tier || r.lockH == null || r.lockH > 20) fail(name, `lock row ${r.path} is more than one row high (tier line ${r.tier ? 'shown' : 'hidden'}, lock line ${r.lockH} px, row ${r.h} px)`);
      }
    }
    if (shot) await rawShot(name);
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

  // ---- the M4 re-review (look-1 and the scroll cue): a second battle with another squad
  if (has('m4-drawer-fit') || has('m4-drawer-ally') || has('m4-lock-why')) {
    // (a real page load: a goto that only changes the hash would keep the first battle's page; and the first battle's
    // save goes, or 1-1 would open on Continue)
    await page.goto('about:blank');
    await openApp(page, base);
    await seedSave(page, { girls: ['hikari', ...FIT_SQUAD], hero: 'hikari', towers: FIT_SQUAD, settings: { reduceMotion: false }, cleared: ['1-1'] });
    const rm = await page.evaluate(() => {
      const { store } = window.__sakura;
      store.profile.battleSaves = {};
      store.commit('e2e');
      store.saveNow?.();
      // (the page's save on leaving can carry the m4-reduce-motion scene's Reduce motion into this load, past
      // openApp's localStorage.clear(); main.js reads it once at start: these stills are with Reduce motion off)
      const before = document.documentElement.hasAttribute('data-reduce-motion');
      document.documentElement.toggleAttribute('data-reduce-motion', !!store.profile.settings.reduceMotion);
      return { attrBefore: before, setting: !!store.profile.settings.reduceMotion };
    });
    log(`  m4 second battle: Reduce motion ${JSON.stringify(rm)}`);
    try {
      await openBattle(page, { stage: '1-1', cash: 1e7 });
    } catch (e) {
      const diag = await page.evaluate(() => ({ hash: location.hash, screen: document.querySelector('#app')?.dataset.screen, modals: [...document.querySelectorAll('.modal-overlay, [role="dialog"]')].map((m) => m.textContent.slice(0, 120)), battle: !!window.__battle, sim: !!window.__battle?.sim, ui: Object.keys(window.__battle?.ui || {}).slice(0, 12) })).catch((x) => String(x));
      log(`  DIAG openBattle: ${JSON.stringify(diag)}`);
      await rawShot('m4-diag-openbattle');
      throw e;
    }
    await settle(page, 500);
    const sellAll = (uids) => page.evaluate((us) => {
      window.__battle.ui.select(null);
      for (const x of us) if (x != null) window.__battle.sim.sellTower(x);
    }, uids);
    // (staging: buys go through the sim; the ⚡ path to 3, the next path to 2)
    const build = (g, plan) => stage(([g, plan]) => {
      const { sim } = window.__battle;
      sim.cash = 1e7;
      const t = __ab.place(g);
      if (t == null) return { err: `no spot for ${g}` };
      const ap = __ab.abilPath(t);
      for (const [p, n] of plan === 'abil3+2' ? [[ap, 3], [(ap + 1) % 3, 2]] : plan) __ab.up(t, p, n);
      sim.cash = 1250;
      return { t, tiers: sim.getTower(t).tiers.join('-') };
    }, [g, plan]);

    /**
     * The scroll cue's rule in the real layout (the re-review: the cue showed over a third row fully in view): a spacer
     * at the top of the body puts the last row's bottom exactly on the scroll port's (its "i"'s tap area pokes out below,
     * so scrollHeight overflows), then 10 px lower. The cue must be off, then on.
     */
    const cueRule = async (tiers) => {
      const r = await page.evaluate(() => {
        const p = document.querySelector('[data-testid="tower-panel"]');
        const sc = p.querySelector('.bt-panel-scroll');
        const rows = sc.querySelectorAll('.bt-path');
        const last = rows[rows.length - 1];
        const port = () => sc.getBoundingClientRect().top + sc.clientTop + sc.clientHeight;
        const spacer = document.createElement('div');
        // (no transition: under the game's Reduce motion base.css gives every property a 1 ms transition, and a
        // height read in the same task would still be the old one)
        spacer.style.cssText = 'flex: none; height: 0; transition: none !important';
        sc.prepend(spacer);
        const read = () => {
          sc.scrollTop = 0;
          sc.dispatchEvent(new Event('scroll'));
          const extra = sc.scrollHeight - sc.clientHeight - sc.scrollTop;
          return { lastBottom: Math.round(last.getBoundingClientRect().bottom), port: Math.round(port()), scrollExtra: extra, oldRule: extra > 6, cue: p.classList.contains('bt-scroll-more'), scrollTop: sc.scrollTop, spacer: Math.round(spacer.getBoundingClientRect().height) };
        };
        spacer.style.height = `${Math.max(0, port() - last.getBoundingClientRect().bottom)}px`;
        const fit = read();
        spacer.style.height = `${parseFloat(spacer.style.height) + 10}px`;
        const cut = read();
        spacer.remove();
        sc.dispatchEvent(new Event('scroll'));
        return { lastIsLock: last.classList.contains('locked'), fit, cut };
      });
      out['m4-fit-cue'] = r;
      log(`  m4-fit-cue (Aoi ${tiers}): ${JSON.stringify(r)}`);
      if (r.fit.cue) fail('m4-fit-cue', `the cue shows over a last row that is fully in view (${JSON.stringify(r.fit)})`);
      if (!r.cut.cue) fail('m4-fit-cue', `no cue with the last row 10 px below the fold (${JSON.stringify(r.cut)})`);
    };

    if (has('m4-drawer-fit')) {
      // the standard crosspath build once abilities unlock at T3 (owner #53): the ⚡ path at T3 and a second path at T2,
      // so the third row is a lock; with an aim, pick, strip or Flight row (Iroha, Midori, Azami, Chika); Raika 2-0-3,
      // whose one buyable row is the third; Aoi 0-3-2 and Tenka 3-2-0, whose third row is fully in view (no cue over
      // it). Each closed drawer is a still; tap 1 on each price is checked too (no screenshot).
      for (const [g, plan] of FIT_BUILDS) {
        const b = await build(g, plan);
        if (b.err) {
          fail('m4-drawer-fit', b.err);
          continue;
        }
        const name = `m4-fit-${g}-${b.tiers.replace(/-/g, '')}`;
        log(`  ${name} staging: ${JSON.stringify(b)}`);
        await show(b.t);
        await still(name);
        if (g === 'aoi') await cueRule(b.tiers);
        for (const p of [0, 1, 2]) {
          await page.evaluate(() => { window.__battle.sim.cash = 1e6; });
          await settle(page, 200);
          const btn = page.locator(`[data-testid="tower-panel"] [data-testid="buy-${p}"]:not([disabled])`);
          if (!(await btn.count())) continue;
          await btn.click({ force: true });
          await settle(page, 120);
          const armedNow = await page.evaluate((q) => !!document.querySelector(`[data-testid="tower-panel"] .bt-path.armed[data-path="${q}"]`), p);
          if (!armedNow) fail(`${name}-tap${p}`, 'tap 1 on the price did not open the row');
          else await still(`${name}-tap${p}`, { armed: true, shot: false });
          await page.evaluate(() => window.__battle.ui.select(null));
          await show(b.t);
        }
        await sellAll([b.t]);
        await settle(page, 200);
      }

      // a final tier another copy holds, her holder in a corner of the map (the re-review's Aoi 4-2-0 beside a held
      // 5-0-0): "Held by Aoi 5-0-0 · bottom right · Show ›" is too long for a phone's one line, so the place steps away,
      // whole, and the row stays one row high (still() checks every lock row); at 1280 the whole line shows
      const held = await stage(() => {
        const { sim } = window.__battle;
        sim.cash = 1e7;
        const w = sim.map.width;
        const hh = sim.map.height;
        // the corners' thirds, the longest place first ("bottom right", "bottom left", "top right", "top left")
        const corners = [[(x) => x > (2 * w) / 3, (y) => y > (2 * hh) / 3], [(x) => x < w / 3, (y) => y > (2 * hh) / 3], [(x) => x > (2 * w) / 3, (y) => y < hh / 3], [(x) => x < w / 3, (y) => y < hh / 3]];
        let a5 = null;
        for (const [cx, cy] of corners) {
          for (let y = 0.5; y < hh && a5 == null; y += 0.3) {
            for (let x = 0.5; x < w && a5 == null; x += 0.3) {
              if (cx(x) && cy(y) && sim.canPlace('aoi', x, y).ok) a5 = sim.placeTower('aoi', x, y)?.uid ?? null;
            }
          }
          if (a5 != null) break;
        }
        if (a5 == null) return { err: 'no corner spot for the holder' };
        __ab.up(a5, 0, 5);
        const b4 = __ab.place('aoi', { near: a5, min: 2 });
        if (b4 == null) return { err: 'no spot beside the holder' };
        __ab.up(b4, 0, 4);
        __ab.up(b4, 1, 2);
        sim.cash = 1250;
        return { a5, b4, tiers: `${sim.getTower(a5).tiers.join('-')} / ${sim.getTower(b4).tiers.join('-')}` };
      });
      if (held.err) fail('m4-fit-held', held.err);
      else {
        log(`  m4-fit-held staging: ${JSON.stringify(held)}`);
        await show(held.b4);
        const line = await page.evaluate(() => {
          const b = document.querySelector('[data-testid="tower-panel"] [data-testid="final-show-0"]');
          const where = b?.querySelector('.bt-final-where');
          return b ? { text: b.textContent, title: b.title, who: b.querySelector('.bt-final-who')?.textContent, where: where?.textContent || '', whereShown: !!where && getComputedStyle(where).display !== 'none', h: Math.round(b.getBoundingClientRect().height), over: b.scrollWidth > b.clientWidth + 1 } : null;
        });
        log(`  m4-fit-held: holder ${JSON.stringify(line)}`);
        if (!line) fail('m4-fit-held', 'no holder line on her first path');
        else {
          const place = line.where.replace(/^ · /, '');
          if (line.who !== 'Held by Aoi 5-0-0' || !/^(bottom|top) (left|right)$/.test(place)) fail('m4-fit-held', `the holder line reads "${line.text}"`);
          if (!line.title.includes(place)) fail('m4-fit-held', `the button's title "${line.title}" leaves out her place`);
          if (line.over) fail('m4-fit-held', 'the holder line runs out of its button');
          if (!phone && !line.whereShown) fail('m4-fit-held', 'at 1280 the holder line leaves out her place');
        }
        await still('m4-fit-held');
        await sellAll([held.b4, held.a5]);
        await settle(page, 200);
      }
    }

    if (has('m4-drawer-ally')) {
      // a co-op partner's girl (her note, her ⚡ row, read-only prices): Aoi 1-3-0, and 2-3-0 with two lock rows whose
      // owner has a 16-character name (the most a name holds, common.js askName). The co-op seam is stubbed for the
      // still (the online e2e drives the real two-client drawer).
      for (const [name, plan, owner] of [['m4-drawer-ally', [[1, 3], [0, 1]], 'Bea'], ['m4-drawer-ally-230', [[1, 3], [0, 2]], 'Sakuramochi_1234']]) {
        const b = await build('aoi', plan);
        if (b.err) {
          fail(name, b.err);
          continue;
        }
        log(`  ${name} staging: ${JSON.stringify(b)}`);
        await page.evaluate(([u, who]) => {
          const { ui } = window.__battle;
          window.__m4RealCoop = ui.coop;
          ui.coop = { isMine: (x) => x !== u, colorOf: () => '#ff8fab', ownerName: () => who, ownerOf: () => 1, send: () => false, players: [] };
        }, [b.t, owner]);
        await show(b.t);
        const note = await page.evaluate(() => {
          const n = document.querySelector('[data-testid="tower-panel"] [data-testid="ally-note"]');
          return n ? { text: n.textContent, title: n.title, h: Math.round(n.getBoundingClientRect().height), px: parseFloat(getComputedStyle(n).fontSize) } : null;
        });
        log(`  ${name}: note ${JSON.stringify(note)}`);
        if (!note) fail(name, 'no ally note');
        else {
          const full = `${owner}'s girl — only ${owner} can upgrade, retarget or sell her.`;
          const want = phone ? `${owner}'s girl · view only` : full;
          if (note.text.trim() !== want || note.title !== full) fail(name, `the ally note reads "${note.text}" (title "${note.title}")`);
          if (phone && note.h > 24) fail(name, `the ally note is more than one line at 844 (${note.h} px)`);
        }
        await still(name);
        await page.evaluate(() => { window.__battle.ui.select(null); window.__battle.ui.coop = window.__m4RealCoop; });
        await sellAll([b.t]);
        await settle(page, 200);
      }
    }

    if (has('m4-lock-why')) {
      // (the M4 re-review, round 3: the "i" put two sentences in the feed, cut mid-word on a phone; at 1280 on 1-1 the
      // feed docks right, and its toast sat under the open drawer)
      const L = (out['m4-lock-why'] = { cases: {} });
      const tap = (loc) => (phone ? loc.tap() : loc.click());
      const infoOf = (row) => page.locator(`[data-testid="tower-panel"] .bt-path[data-path="${row}"] .bt-path-lock .bt-dw-info`);
      // (the toasts' font: its Latin subset loaded, or the widths below are a fallback's; the font has hundreds of
      // unicode-range faces, so the check names the letters)
      L.fonts = await page.evaluate(async () => {
        await document.fonts.load('700 13px "M PLUS Rounded 1c"', 'Max two paths');
        return { rounded: document.fonts.check('700 13px "M PLUS Rounded 1c"', 'Max two paths'), toast: getComputedStyle(document.body).fontFamily };
      });
      log(`  m4-lock-why fonts: ${JSON.stringify(L.fonts)}`);
      /** The toast matching `re`: on top at its centre, one line, nothing cut (battleKit toastSeen), and clear of the drawer. */
      const seenToast = async (label, re, { shot: stillName = null, one = false } = {}) => {
        await settle(page, 200);
        // (measured where it rests: its slide-in starts 14 px off, and a busy SwiftShader frame can hold that a while)
        await page.evaluate(() => Promise.race([
          Promise.all([...document.querySelectorAll('[data-testid="battle-feed"] .bt-toast')].flatMap((t) => t.getAnimations()).map((an) => an.finished.catch(() => null))),
          new Promise((r) => setTimeout(r, 1500)),
        ]));
        const s = await page.evaluate((src) => window.__ab.toastSeen(src), re);
        const at = await page.evaluate(() => ({
          feed: document.querySelector('[data-testid="battle-feed"]')?.className,
          lockToasts: document.querySelectorAll('[data-testid="battle-feed"] .bt-toast[data-key="path-lock"]').length,
          drawerLeft: Math.round(document.querySelector('[data-testid="tower-panel"]:not([hidden])')?.getBoundingClientRect().left ?? -1),
        }));
        L.cases[label] = { ...s, ...at };
        log(`  m4-lock-why ${label}: ${JSON.stringify(L.cases[label])}`);
        if (!s.found) fail('m4-lock-why', `${label}: no toast matches /${re}/ (the feed holds ${JSON.stringify(await page.evaluate(() => window.__ab.toasts()))})`);
        else {
          if (!s.onTop) fail('m4-lock-why', `${label}: the toast "${s.text}" is not on top (the hit test finds ${s.hit})`);
          if (!s.oneLine) fail('m4-lock-why', `${label}: the toast "${s.text}" is cut or wraps (${JSON.stringify(s.rect)})`);
          if (at.drawerLeft >= 0 && s.rect[0] + s.rect[2] > at.drawerLeft) fail('m4-lock-why', `${label}: the toast reaches under the drawer (toast ${JSON.stringify(s.rect)}, drawer from x ${at.drawerLeft})`);
        }
        if (one && at.lockToasts !== 1) fail('m4-lock-why', `${label}: ${at.lockToasts} lock toasts in the feed (one at a time)`);
        if (stillName) await rawShot(stillName);
      };

      // Aoi 2-3-0: her first row capped at T2 (Rapid Volley is T3), her third row locked (two paths in use)
      const a = await build('aoi', [[1, 3], [0, 2]]);
      if (a.err) fail('m4-lock-why', a.err);
      else {
        log(`  m4-lock-why staging: ${JSON.stringify(a)}`);
        await show(a.t);
        await clearToasts(page);
        const title = await infoOf(0).getAttribute('title').catch(() => null);
        L.title = title;
        if (title !== 'Capped at T2 — Rapid Volley is already T3. One path can go past T2, a second up to T2.') fail('m4-lock-why', `the capped "i"'s title reads "${title}" (the full reason, then the rule)`);
        await tap(infoOf(0));
        const t0 = Date.now();
        await seenToast('capped', '^Capped at T2: Rapid Volley is T3$', { one: true });
        // at once the third row's "i": the same toast takes its words (it used to be throttled away for about 1.5 s)
        L.secondTapAfterMs = Date.now() - t0;
        await tap(infoOf(2));
        await seenToast('two', '^Max two paths per girl$', { shot: 'm4-lock-why-two', one: true });
        await tap(infoOf(0));
        await seenToast('capped-again', '^Capped at T2: Rapid Volley is T3$', { shot: 'm4-lock-why-capped', one: true });
        log(`  m4-lock-why: the second "i" tapped ${L.secondTapAfterMs} ms after the first (the throttle window is ${phone ? 1248 : 1560} ms)`);
        // tap 2 on a price she cannot pay: "Need N more coins." (the same feed, the same docking)
        await clearToasts(page);
        await page.evaluate(() => { window.__battle.sim.cash = 10; });
        await settle(page, 300);
        const buy = page.locator('[data-testid="tower-panel"] [data-testid="buy-1"]');
        await tap(buy);
        await settle(page, 150);
        await tap(buy);
        await seenToast('need', '^Need [\\d,.]+[kM]? more coins\\.$', { shot: 'm4-lock-why-need' });
        await sellAll([a.t]);
        await settle(page, 200);
      }

      // Sango 3-2-0: the longest path names of any girl ("Capped at T2: Armor-Breaker Shells is T3")
      const s = await build('sango', [[0, 3], [1, 2]]);
      if (s.err) fail('m4-lock-why', s.err);
      else {
        log(`  m4-lock-why staging: ${JSON.stringify(s)}`);
        await show(s.t);
        await clearToasts(page);
        await tap(infoOf(1));
        await seenToast('sango-capped', '^Capped at T2: Armor-Breaker Shells is T3$', { shot: 'm4-lock-why-sango', one: true });
        await tap(infoOf(2));
        await seenToast('sango-two', '^Max two paths per girl$', { one: true });
        await sellAll([s.t]);
        await settle(page, 200);
      }

      // the held final tier, Sango 4-2-0 beside a 5-0-0 (her longest pair): on a phone the row is one line and its "i"
      // gives the rule; at 1280 the rule stays in the row, whole, with no "i"
      const held = await stage(() => {
        const { sim } = window.__battle;
        sim.cash = 1e7;
        const a5 = __ab.place('sango', { skip: 30 });
        if (a5 == null) return { err: 'no spot for the holder' };
        __ab.up(a5, 0, 5);
        const b4 = __ab.place('sango', { near: a5, min: 2.5 });
        if (b4 == null) return { err: 'no spot beside the holder' };
        __ab.up(b4, 0, 4);
        __ab.up(b4, 1, 2);
        sim.cash = 1250;
        return { a5, b4, tiers: `${sim.getTower(a5).tiers.join('-')} / ${sim.getTower(b4).tiers.join('-')}`, reason: sim.upgradeStatus(b4, 0).reason };
      });
      if (held.err) fail('m4-lock-why', held.err);
      else {
        log(`  m4-lock-why staging: ${JSON.stringify(held)}`);
        await show(held.b4);
        await clearToasts(page);
        const why = page.locator('[data-testid="tower-panel"] [data-testid="final-lock-0"] .bt-lock-why');
        const row = await page.evaluate(() => {
          const lock = document.querySelector('[data-testid="tower-panel"] [data-testid="final-lock-0"]');
          const line = lock?.querySelector('.bt-lock-line');
          const i = lock?.querySelector('.bt-lock-why');
          const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
          return lock ? { line: line?.textContent, lineShown: vis(line), iShown: vis(i), iTitle: i?.title } : null;
        });
        L.held = row;
        log(`  m4-lock-why held row: ${JSON.stringify(row)}`);
        const full = 'Only one Sango can hold Armor-Breaker Shells V. Sell or upgrade that one.';
        if (!row) fail('m4-lock-why', 'no final-tier lock on her first row');
        else if (phone) {
          if (!row.iShown) fail('m4-lock-why', 'held: no "i" on the one-line held row at 844');
          else {
            if (row.iTitle !== full) fail('m4-lock-why', `held: the "i"'s title reads "${row.iTitle}"`);
            await tap(why);
            await seenToast('held', '^Only one Sango can hold Armor-Breaker Shells V$', { shot: 'm4-lock-why-held', one: true });
          }
        } else {
          if (!row.lineShown || row.line !== full) fail('m4-lock-why', `held at 1280: the row's rule line reads "${row.line}" (${row.lineShown ? 'shown' : 'hidden'})`);
          if (row.iShown) fail('m4-lock-why', 'held at 1280: an "i" beside a rule the row already shows');
          await rawShot('m4-lock-why-held');
        }
        await sellAll([held.b4, held.a5]);
        await settle(page, 200);
      }

      // one "i" with the feed in each top corner (1-1 sends it right; the other corner is staged: the feed keeps the
      // corner it is given once its avoid points are gone). Last: the feed's spawn docking is off from here on.
      const d = await build('aoi', [[1, 3], [0, 2]]);
      if (d.err) fail('m4-lock-why', d.err);
      else {
        await show(d.t);
        await page.evaluate(() => window.__battle.ui.feed.setAvoid(() => []));
        for (const dock of ['bt-feed-l', 'bt-feed-r']) {
          await clearToasts(page);
          await page.evaluate((cls) => {
            const f = document.querySelector('[data-testid="battle-feed"]');
            f.classList.remove('bt-feed-l', 'bt-feed-r');
            f.classList.add(cls);
          }, dock);
          await tap(infoOf(0));
          await seenToast(`dock-${dock.slice(-1)}`, '^Capped at T2: Rapid Volley is T3$', { one: true });
        }
        await sellAll([d.t]);
        await settle(page, 200);
      }
    }
  }
  return out;
}

// the M4 re-review's squad and builds ('abil3+2': the ⚡ path to 3, the next path round to 2)
const FIT_SQUAD = ['midori', 'iroha', 'chika', 'tenka', 'azami', 'sango', 'aoi', 'raika'];
const FIT_BUILDS = FIT_SQUAD.map((g) => [g, 'abil3+2']);
