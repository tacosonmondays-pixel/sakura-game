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

// ---------------------------------------------------------------------------------------------------------------
// [ui-ink] UI v2 "Ink & Paper": the mock-ups' sample save (notes/ui-v2, the build plan's V1 tooling)
// ---------------------------------------------------------------------------------------------------------------

/**
 * The clock of the `ink` seed: Thursday 4:30 PM Central, so Pumpkin Lantern Night's countdown reads "10d 4h" as on
 * the mock-ups (it ends 2026-11-02 01:00 UTC; the chip rounds up).
 */
export const INK_NOW = '2026-10-22T21:30:00Z';
/** The `ink` roster: the shots' girls plus Ruri (the mock-ups' secretary, with Kon) and Marumi (the living home). */
export const INK_GIRLS = [...GIRLS, 'ruri', 'marumi'];
/** Math.random's seed for the `ink` runs (inkRandomInit). */
export const INK_RANDOM_SEED = 0x5a4b;
/**
 * Ruri's three pieces as the girl page mock-up shows them, plus the spares the gear picker and the Backpack's salvage
 * shots need: a Mythic charm beside the others (medium 3: a selected tile next to an unselected Mythic one).
 * [slot, rarity, level, main stat, name, equipped]
 */
export const INK_GEAR = Object.freeze([
  ['charm', 'legendary', 8, 'atkPct', 'Fierce Omamori of the Eternal Sakura', true],
  ['ribbon', 'superRare', 4, 'rangePct', 'Starlit Hair Bow', true],
  ['shoes', 'rare', 2, 'ratePct', 'Swift Sneakers', true],
  ['charm', 'mythic', 3, 'critDmg', 'Ruthless Pendant of the Crimson Moon', false],
  ['charm', 'rare', 0, 'atkPct', 'Valiant Brooch', false],
  ['charm', 'superRare', 2, 'critDmg', 'Keen Charm Bracelet', false],
  ['ribbon', 'mythic', 0, 'rangePct', 'Farsight Ribbon of the Crimson Moon', false],
  ['shoes', 'common', 0, 'ratePct', 'Swift Loafers', false],
]);

/**
 * An init script (page.addInitScript(inkRandomInit, INK_RANDOM_SEED)): Math.random from a fixed seed (mulberry32),
 * so anything the UI rolls with it is the same every run. With the fixed clock it keeps the `ink` shots repeatable.
 * @param {number} seed
 */
export function inkRandomInit(seed) {
  let a = seed >>> 0;
  Math.random = function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The `ink` seed: the mock-ups' sample save. Ruri is the secretary (with Kon), LV 24/40, P4, wearing Fierce Omamori,
 * Starlit Hair Bow and Swift Sneakers; chapter 4 at 3/5 with 4-4 next (chapters 1-3 cleared, so every hub mode is
 * open); 12 Recruit Tickets, 284,650 coins and 16,570 gems; Morning Roll Call and Study Session ready to claim,
 * Patrol Duty at 1/3. The beta letter is the one unread letter. The page has window.__sakura.
 * @param {import('playwright').Page} page
 */
export async function seedInkSave(page) {
  await page.evaluate(async ([girls, squad, pieces]) => {
    const { store } = window.__sakura;
    const unlocks = await import('/src/systems/unlocks.js');
    const gear = await import('/src/systems/gear.js');
    const { createRng } = await import('/src/core/rng.js');
    const { levelCapAt } = await import('/src/systems/progression.js');
    const missions = await import('/src/systems/missions.js');
    const p = store.profile;
    for (const id of girls) if (!p.units[id]) unlocks.grantUnit(p, id, 1760000000000);
    Object.assign(p.units.aoi, { level: 48, breakthrough: 4, awaken: 3 });
    Object.assign(p.units.hikari, { level: 30, breakthrough: 3, awaken: 2 });
    let gates = 0;
    while (gates < 8 && levelCapAt(gates, 4) < 40) gates++;
    Object.assign(p.units.ruri, { level: 24, breakthrough: gates, pl: 4 });
    p.secretary = 'ruri';
    p.formation = { hero: 'hikari', towers: ['ruri', ...squad.slice(0, 7)] };
    Object.assign(p.currencies, { coins: 284650, gems: 16570 });
    p.items ||= {};
    p.items.ticket_recruit = 12;
    Object.assign(p.settings, { autoStart: false });
    for (let c = 1; c <= 3; c++) for (let s = 1; s <= 5; s++) p.progress.stages[`${c}-${s}`] = { easy: true, normal: true, hard: false, nightmare: false, clears: 1 };
    for (let s = 1; s <= 3; s++) p.progress.stages[`4-${s}`] = { easy: true, normal: true, hard: false, nightmare: false, clears: 1 };
    // each piece rolled from the first seed whose main stat is the one the mock-up shows, then named as it shows it
    for (const [slot, rarity, level, main, name, worn] of pieces) {
      let g = null;
      for (let s = 1; s < 4000 && !g; s++) {
        const r = gear.rollGear(createRng(7000 + s), { slot, rarity, level });
        if (r.main.stat === main) g = r;
      }
      if (!g) continue;
      g.name = name;
      const uid = gear.addGear(p, g);
      if (worn) gear.equipGear(p, 'ruri', uid);
    }
    missions.track(p, 'levelUp', 1);
    missions.track(p, 'battleWin', 1);
    store.commit('e2e');
    store.saveNow?.();
  }, [INK_GIRLS, SQUAD, INK_GEAR]);
}

/** The friend whose co-op invite the Multiplayer shots show (her account lives in the local test server only). */
export const INVITE_FRIEND = Object.freeze({ id: 'shot-bea', name: 'Bea', level: 42, avatar: 'sango', room: 'BEA42', stage: '1-3' });

/**
 * UI M5d: this tab goes online on the local test server (dev builds without a project use it) as "Aiko", and a friend
 * ("Bea") opens a co-op room and invites Aiko by DM: the open invite the Multiplayer button counts and the hub lists.
 * The social hub is started, so the lobby and the hub read it as they would after a real sign-in.
 * @param {import('playwright').Page} page
 * @returns {Promise<string>} this tab's online id
 */
export async function seedOnlineInvite(page) {
  return page.evaluate(async (f) => {
    const { getBackend } = await import('/src/online/backend.js');
    const { writeIdentity } = await import('/src/online/identity.js');
    const common = await import('/src/ui/online/common.js');
    const social = await import('/src/ui/online/socialHub.js');
    const { createLocalDb } = await import('/src/online/adapters/localDb.js');
    writeIdentity({ name: 'Aiko' }, getBackend().status.mode === 'local');
    const backend = await common.ensureOnline({ ask: false });
    await social.startSocialHub({ force: true });
    const me = backend.uid;
    const KEY = 'ss-online-db';
    const db = createLocalDb({ read: () => JSON.parse(localStorage.getItem(KEY) || 'null'), write: (s) => localStorage.setItem(KEY, JSON.stringify(s)) });
    db.signIn(f.id, { name: f.name, level: f.level, avatar: f.avatar });
    db.addFriend(f.id, me);
    const req = db.friendRequests(me).incoming.find((r) => r.userId === f.id);
    if (req) db.answerFriend(me, req.id, true);
    db.openRoom(f.id, f.room);
    // (once per tab: a second seed finds the invite still open, and the fixed clock would trip the invite limit)
    const open = db.inbox(me).threads.some((t) => t.peer?.userId === f.id && t.last?.kind === 'invite' && t.last.inviteState === 'open');
    if (!open) db.sendCoopInvite(f.id, me, { room: f.room, stage: f.stage, difficulty: 'normal' });
    return me;
  }, INVITE_FRIEND);
}

/**
 * UI M5d review: four more friends for the busy hub (four open invites; not Bea, whose invite the earlier shots of a run
 * already sent on the fixed clock). Their accounts live in the local test server only.
 */
export const MORE_FRIENDS = Object.freeze([
  Object.freeze({ id: 'shot-mio', name: 'Mio', level: 12, avatar: 'momo', room: 'MIO12', stage: '3-5' }),
  Object.freeze({ id: 'shot-rin', name: 'Rin', level: 33, avatar: 'kage', room: 'RIN33', stage: '1-1' }),
  Object.freeze({ id: 'shot-tama', name: 'Tama', level: 50, avatar: 'luna', room: 'TAMA5', stage: '2-4' }),
  Object.freeze({ id: 'shot-nao', name: 'Nao', level: 27, avatar: 'yuki', room: 'NAO27', stage: '2-1' }),
]);

/**
 * UI M5d review: a fresh online player on the local test server ("Aiko", a new account: the tab's online keys are
 * cleared first), invited by `friends` (each once), with a "Your last room" from ten minutes ago when `last`.
 * @param {import('playwright').Page} page
 * @param {{ friends?: object[], last?: boolean }} [o]
 * @returns {Promise<string>} this tab's online id
 */
export async function seedOnlineHub(page, { friends = [], last = false } = {}) {
  await goOffline(page);
  return page.evaluate(async ([list, withLast]) => {
    const { getBackend } = await import('/src/online/backend.js');
    const { writeIdentity } = await import('/src/online/identity.js');
    const common = await import('/src/ui/online/common.js');
    const social = await import('/src/ui/online/socialHub.js');
    const { createLocalDb } = await import('/src/online/adapters/localDb.js');
    writeIdentity({ name: 'Aiko' }, getBackend().status.mode === 'local');
    const backend = await common.ensureOnline({ ask: false });
    await social.startSocialHub({ force: true });
    const me = backend.uid;
    const KEY = 'ss-online-db';
    const db = createLocalDb({ read: () => JSON.parse(localStorage.getItem(KEY) || 'null'), write: (s) => localStorage.setItem(KEY, JSON.stringify(s)) });
    for (const f of list) {
      db.signIn(f.id, { name: f.name, level: f.level, avatar: f.avatar });
      db.addFriend(f.id, me);
      const req = db.friendRequests(me).incoming.find((r) => r.userId === f.id);
      if (req) db.answerFriend(me, req.id, true);
      db.openRoom(f.id, f.room);
      db.sendCoopInvite(f.id, me, { room: f.room, stage: f.stage, difficulty: 'normal' });
    }
    if (withLast) {
      const all = JSON.parse(localStorage.getItem('ss-coop-last') || '{}');
      all[me] = { code: 'AIKO7', host: true, stageId: '1-1', difficulty: 'normal', freeplay: null, mode: 'standard', at: Date.now() - 10 * 60e3 };
      localStorage.setItem('ss-coop-last', JSON.stringify(all));
    }
    return me;
  }, [friends, last]);
}

/**
 * UI M5d: the tab as a player who never went online (no name, no account, the social hub never started): the online
 * keys of this tab are cleared and the page reloads, so nothing of an earlier sign-in stays in memory.
 * @param {import('playwright').Page} page
 */
export async function goOffline(page) {
  await page.evaluate(() => {
    window.__sakura?.store?.saveNow?.();
    for (const st of [sessionStorage, localStorage]) for (const k of ['ss-online-tab', 'ss-online-v1', 'ss-online-auth']) st.removeItem(k);
  });
  await page.reload({ waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 30000 });
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
}

// ---------------------------------------------------------------------------------------------------------------
// [ui-v2-menus] M0: the extra states the menus milestones shoot (docs/specs/UI_V2_MENUS.md section 5, M0). Each one
// adds to the `ink` save already seeded and is safe to call twice.
// ---------------------------------------------------------------------------------------------------------------

/** The girl at each Potential state the Board shots use (M4): P1, P4 with a Raise she can afford, P6, a hero. */
export const POTENTIAL_GIRLS = Object.freeze({ p1: 'momo', p4: 'aoi', p6: 'kaede', hero: 'hikari' });

/**
 * M4: Momo at P1, Aoi at P4 with one Essence and the coins for her Raise, Kaede at P6 (the girls of POTENTIAL_GIRLS;
 * Hikari, the hero, stays as the `ink` save has her). The page has window.__sakura.
 * @param {import('playwright').Page} page
 */
export async function seedPotentialStates(page) {
  await page.evaluate(async (g) => {
    const { store } = window.__sakura;
    const p = store.profile;
    const ess = await import('/src/systems/essence.js');
    Object.assign(p.units[g.p1], { pl: 1, dupes: 0 });
    Object.assign(p.units[g.p4], { pl: 4 });
    // (one Essence: what she was given for the steps she bought, plus one)
    for (let d = 0; d < 12 && ess.essenceBalance(p, g.p4) < 1; d++) p.units[g.p4].dupes = (p.units[g.p4].dupes || 0) + 1;
    Object.assign(p.units[g.p6], { pl: 6, level: Math.max(p.units[g.p6].level || 1, 70) });
    store.commit('e2e');
    store.saveNow?.();
  }, POTENTIAL_GIRLS);
}

/**
 * M2: 30 gear pieces in all (the Backpack's Equipment target, "≤ 32 numbers for 30 pieces"): the `ink` save's eight
 * plus 22 rolled from fixed seeds over every slot and rarity, a few worn by the squad.
 * @param {import('playwright').Page} page
 */
export async function seedGearMany(page) {
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    const p = store.profile;
    const gear = await import('/src/systems/gear.js');
    const { createRng } = await import('/src/core/rng.js');
    const slots = ['charm', 'ribbon', 'shoes'];
    const rarities = ['common', 'rare', 'superRare', 'mythic', 'legendary'];
    const wearers = ['aoi', 'rei', 'yuki', 'momo'];
    const have = Object.keys(p.gear || {}).length;
    for (let i = 0; have + i < 30; i++) {
      const g = gear.rollGear(createRng(9100 + i), { slot: slots[i % 3], rarity: rarities[(i * 7) % 5], level: (i * 5) % 13 });
      const uid = gear.addGear(p, g);
      if (i < 8) gear.equipGear(p, wearers[Math.floor(i / 3) % wearers.length], uid);
    }
    store.commit('e2e');
    store.saveNow?.();
  });
}
