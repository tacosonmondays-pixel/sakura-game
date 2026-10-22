// The save the UI screenshots and the hub checks share (e2e/ui-shots.mjs, e2e/hubs.mjs): every girl the shots show,
// a squad, fixed currencies and six gear pieces rolled from fixed seeds (two on Aoi); `m5` adds chapters 1-3 cleared
// (the event, Titan Trials, Bounty, Challenge and Sandbox open). Same every run, so two builds differ only where the
// build differs.

export const GIRLS = ['hikari', 'aoi', 'rei', 'luna', 'nami', 'yuki', 'momo', 'akane', 'sango', 'kage', 'umeko', 'shiro', 'midori', 'suzu', 'raika', 'miko', 'hotaru', 'kaede', 'chika'];
export const SQUAD = ['aoi', 'rei', 'yuki', 'momo', 'akane', 'sango', 'kage', 'chika'];
/** A Tuesday noon in Central: no weekly reset on the day. */
export const SHOT_NOW = '2026-10-27T17:00:00Z';

/**
 * Seeds the open game's save (the page has window.__sakura). m5: chapters 1-3 cleared.
 * @param {import('playwright').Page} page
 * @param {boolean} m5
 */
export async function seedUiSave(page, m5) {
  await page.evaluate(async ([girls, squad, withM5]) => {
    const { store } = window.__sakura;
    const unlocks = await import('/src/systems/unlocks.js');
    const gear = await import('/src/systems/gear.js');
    const { createRng } = await import('/src/core/rng.js');
    const p = store.profile;
    for (const id of girls) if (!p.units[id]) unlocks.grantUnit(p, id, 1760000000000);
    Object.assign(p.units.aoi, { level: 48, breakthrough: 4, awaken: 3 });
    Object.assign(p.units.hikari, { level: 30, breakthrough: 3, awaken: 2 });
    p.formation = { hero: 'hikari', towers: [...squad] };
    Object.assign(p.currencies, { coins: 284650, gems: 16570 });
    Object.assign(p.settings, { autoStart: false });
    const rolls = [['charm', 'legendary'], ['ribbon', 'mythic'], ['shoes', 'super'], ['charm', 'rare'], ['ribbon', 'common'], ['shoes', 'legendary']];
    const uids = rolls.map(([slot, rarity], i) => gear.addGear(p, gear.rollGear(createRng(100 + i), { slot, rarity, level: 3 * i })));
    gear.equipGear(p, 'aoi', uids[0]);
    gear.equipGear(p, 'aoi', uids[1]);
    if (withM5) {
      for (let c = 1; c <= 3; c++) for (let s = 1; s <= 5; s++) p.progress.stages[`${c}-${s}`] = { easy: true, normal: true, hard: false, nightmare: false, clears: 1 };
    }
    store.commit('e2e');
    store.saveNow?.();
  }, [GIRLS, SQUAD, m5]);
}
