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
