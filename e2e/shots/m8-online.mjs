// M8 (docs/specs/UI_V2_MENUS.md): the online screens and Settings. e2e/menus.mjs --milestone m8.
// The online shots run on the local test server (dev builds without a project use it): this tab is "Aiko", a friend
// ("Bea") invited Aiko to co-op (uiSeed.mjs seedOnlineInvite). Every online surface here is rebuilt in v2 (the radius
// check, S5, applies). The settings-* shots are the Settings half's (lane A).
import { isScreen } from './_util.mjs';
import { seedOnlineInvite, INVITE_FRIEND, MORE_FRIENDS } from '../uiSeed.mjs';

export const milestone = 'm8';

/** Aiko's clan on the local test server: Bea leads "Petal Guard" [PTL], Aiko is an officer, Mio a member, Rin asks to join. */
export const SHOT_CLAN = Object.freeze({ name: 'Petal Guard', tag: 'PTL', emblem: 'assault', joinMode: 'request', description: 'Friendly co-op every evening. Boss runs on weekends!' });

/**
 * seedOnlineInvite once per tab (a second call would send Bea's friend request again, and on the fixed clock the
 * server's request limit stops it); later shots only make sure Aiko is signed in.
 * @param {import('playwright').Page} page
 */
export async function seedOnline(page) {
  const done = await page.evaluate(() => sessionStorage.getItem('m8-online-seeded') === '1');
  if (!done) {
    await seedOnlineInvite(page);
    await page.evaluate(() => sessionStorage.setItem('m8-online-seeded', '1'));
    return;
  }
  await page.evaluate(async () => {
    const common = await import('/src/ui/online/common.js');
    const social = await import('/src/ui/online/socialHub.js');
    await common.ensureOnline({ ask: false });
    await social.startSocialHub({ force: true });
  });
}

/**
 * M8: Aiko (seedOnlineInvite) in a clan on the local test server, as an officer (so the Applicants tab shows): Bea
 * founded it, Mio is a member, Rin's join request waits, everyone joined three days ago, Bea asks for a material, and
 * the clan chat has two lines. Safe to call twice.
 * @param {import('playwright').Page} page
 */
export async function seedClanMember(page) {
  await seedOnline(page);
  return page.evaluate(async ([clan, bea, mio, rin]) => {
    const { getBackend } = await import('/src/online/backend.js');
    const { createLocalDb } = await import('/src/online/adapters/localDb.js');
    const { ITEMS } = await import('/src/data/items.js');
    const me = getBackend().uid;
    const KEY = 'ss-online-db';
    const read = () => JSON.parse(localStorage.getItem(KEY) || 'null');
    const write = (s) => localStorage.setItem(KEY, JSON.stringify(s));
    const db = createLocalDb({ read, write });
    if (db.myClan(me)) return me;
    for (const f of [mio, rin]) db.signIn(f.id, { name: f.name, level: f.level, avatar: f.avatar });
    const c = db.createClan(bea.id, clan);
    for (const uid of [me, mio.id]) {
      db.requestJoin(uid, c.id);
      db.answerRequest(bea.id, c.id, uid, true);
    }
    db.setRole(bea.id, me, 'officer');
    db.requestJoin(rin.id, c.id);
    // (three days together: a material request needs a day in the clan)
    const s = read();
    for (const m of Object.values(s.members)) if (m.clanId === c.id) m.joinedAt -= 3 * 86400000;
    write(s);
    const mat = Object.values(ITEMS).find((i) => i.category === 'material' && i.rarity === 'common');
    if (mat) db.requestMaterials(bea.id, mat.id);
    db.send(bea.id, `clan:${c.id}`, 'Boss run tonight? I can bring two healers!');
    db.send(mio.id, `clan:${c.id}`, 'Count me in after dinner.');
    return me;
  }, [SHOT_CLAN, INVITE_FRIEND, MORE_FRIENDS[0], MORE_FRIENDS[1]]);
}

/** Aiko with one friend request waiting (from Tama) and one blocked player (Nao). Safe to call twice. */
async function seedRequestAndBlock(page) {
  await seedOnline(page);
  return page.evaluate(async ([tama, nao]) => {
    const { getBackend } = await import('/src/online/backend.js');
    const { createLocalDb } = await import('/src/online/adapters/localDb.js');
    const social = await import('/src/ui/online/socialHub.js');
    const me = getBackend().uid;
    const KEY = 'ss-online-db';
    const db = createLocalDb({ read: () => JSON.parse(localStorage.getItem(KEY) || 'null'), write: (s) => localStorage.setItem(KEY, JSON.stringify(s)) });
    for (const f of [tama, nao]) db.signIn(f.id, { name: f.name, level: f.level, avatar: f.avatar });
    if (!db.friendRequests(me).incoming.some((r) => r.userId === tama.id)) db.addFriend(tama.id, me);
    if (!db.blocked(me).some((b) => b.userId === nao.id)) {
      db.block(me, nao.id);
      social.setBlocked?.(nao.id, true, nao.name);
    }
    return me;
  }, [MORE_FRIENDS[2], MORE_FRIENDS[3]]);
}

/** The social pop-ups (Bea's invite shows as one when the hub notices it) close first: a shot is of the screen. */
/** (a pop-up can arrive any time while a shot opens or settles: they stay hidden, except in the pop-up's own shot) */
const quiet = (page, show = false) => page.evaluate((on) => {
  document.querySelectorAll('.sc-toast-host').forEach((x) => x.remove());
  let st = document.getElementById('m8-no-toasts');
  if (!st) document.head.append((st = Object.assign(document.createElement('style'), { id: 'm8-no-toasts', textContent: '.sc-toast-host { display: none !important; }' })));
  st.disabled = on;
}, show);
const withQuiet = (open, toast = false) => async (page) => {
  await quiet(page, toast);
  if (open) await open(page);
};
const online = (hash, screenId, { open, toast, ...more } = {}) => ({ hash, ready: isScreen(screenId), prepare: seedOnline, settleMs: 1800, rebuilt: true, ...more, open: withQuiet(open, toast) });
const clanTab = (tab, { open, ...more } = {}) => ({ hash: `#/clan?tab=${tab}`, ready: isScreen('clan'), prepare: seedClanMember, settleMs: 2200, rebuilt: true, ...more, open: withQuiet(open) });

export const shots = {
  messages: online('#/messages', 'messages'),
  // a conversation open (Bea's co-op invite in it)
  'messages-thread': online('#/messages', 'messages', {
    open: async (page) => {
      await page.click('#app [data-testid="thread-row"]', { timeout: 10000 });
      await page.waitForSelector('#app [data-testid="thread-list"][data-ready="1"]', { timeout: 10000 });
    },
  }),
  'messages-friends': online('#/messages?tab=friends', 'messages'),
  'messages-requests': online('#/messages?tab=requests', 'messages', { prepare: seedRequestAndBlock }),
  'messages-blocked': online('#/messages?tab=blocked', 'messages', { prepare: seedRequestAndBlock }),
  chat: online('#/chat', 'chat'),
  // Find / Create (before the clan shots make Aiko a member)
  clan: online('#/clan', 'clan'),
  // a friend's player card (Bea), and the report dialog on top of the Messages screen
  'player-card': online('#/messages', 'messages', {
    open: async (page) => {
      await page.evaluate(async (f) => (await import('/src/ui/online/playerCard.js')).openPlayerCard(f.id, { name: f.name }), INVITE_FRIEND);
      await page.waitForSelector('[data-testid="player-card"] [data-testid="card-actions"] .btn', { timeout: 10000 });
    },
  }),
  'report-dialog': online('#/messages', 'messages', {
    open: async (page) => {
      await page.evaluate(async (f) => { (await import('/src/ui/online/reportDialog.js')).openReportDialog({ userId: f.id, name: f.name, context: 'dm' }); }, INVITE_FRIEND);
      await page.waitForSelector('[data-testid="report-send"]', { timeout: 10000 });
      await page.click('[data-testid="report-spam"]', { timeout: 5000 }).catch(() => {});
    },
  }),
  // the co-op menu with Bea's invite, and a room's lobby (the host, waiting)
  'coop-invites': online('#/coop', 'coop'),
  'coop-room': online('#/coop/AIKO7?host=1', 'coop', { settleMs: 2500 }),
  // the co-op invite pop-up (src/ui/online/inviteToast.js) over the co-op menu
  'invite-toast': online('#/coop', 'coop', {
    toast: true,
    open: async (page) => {
      await page.evaluate(async (f) => {
        const { showSocialToast } = await import('/src/ui/online/inviteToast.js');
        showSocialToast({ kind: 'invite', avatar: f.avatar, title: `${f.name} invites you to co-op`, text: `${f.stage} · Normal`, ms: 600000, alert: true, expires: Date.now() + 9 * 60000, testid: 'shot-invite-toast',
          actions: [{ label: 'Later', kind: 'ghost' }, { label: 'Join', kind: 'yellow' }] });
      }, INVITE_FRIEND);
      await page.waitForSelector('[data-testid="shot-invite-toast"]', { timeout: 5000 });
    },
    after: (page) => quiet(page),
  }),
  // Aiko in a clan: the six tabs (Supply Bot is the developer clan's only: no shot)
  'clan-members': clanTab('members'),
  'clan-chat': clanTab('chat'),
  'clan-requests': clanTab('donate'),
  'clan-boss': clanTab('boss'),
  'clan-applicants': clanTab('requests'),
  // the server before the social update (?social=0): the needs-update card
  'needs-update': { page: '?onboarding=0&social=0#/messages', ready: '() => !!document.querySelector(\'[data-testid="needs-update"]\')', rebuilt: true },
  'settings-battle': {
    hash: '#/settings?section=battle', ready: isScreen('settings'), kind: 'list',
    open: async (page) => { const t = await page.$('#app [data-testid="tab-battle"]'); if (t) await t.click(); },
  },
  'settings-account': {
    hash: '#/settings?section=account', ready: isScreen('settings'), kind: 'list',
    open: async (page) => { const t = await page.$('#app [data-testid="tab-account"]'); if (t) await t.click(); },
  },
  'settings-about': {
    hash: '#/settings?section=about', ready: isScreen('settings'), kind: 'list',
    open: async (page) => { const t = await page.$('#app [data-testid="tab-about"]'); if (t) await t.click(); },
  },
};
/** Gate options for ui-shots' own `coop` shot (the co-op menu: it runs after the messages shots signed Aiko in). */
export const gate = { coop: { rebuilt: true } };
/** The online half's shots (the Settings half adds its own). */
export const ONLINE = ['messages', 'messages-thread', 'messages-friends', 'messages-requests', 'messages-blocked', 'chat', 'clan', 'player-card', 'report-dialog',
  'coop', 'coop-invites', 'coop-room', 'invite-toast', 'clan-members', 'clan-chat', 'clan-requests', 'clan-boss', 'clan-applicants', 'needs-update'];
export const list = [...ONLINE, 'settings', 'settings-display', 'settings-audio', 'settings-battle', 'settings-account', 'settings-about'];
