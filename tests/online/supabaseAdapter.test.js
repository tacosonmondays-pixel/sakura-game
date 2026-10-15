// The Supabase adapter against the migration, without a network: @supabase/supabase-js is
// replaced by a recording fake, every adapter method runs once, and each recorded request is
// checked against supabase/migrations/*.sql — tables and columns exist, embedded relations have
// a foreign key, every rpc() names a function players may execute with exactly its parameter
// names, and realtime subscriptions only listen to published tables. This catches drift between
// the SQL and the client, which the PGlite run (schema.test.js) and the local adapter cannot see.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ---- the migration, parsed ------------------------------------------------------------------
const DIR = join(process.cwd(), 'supabase', 'migrations');
const sql = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(DIR, f), 'utf8')).join('\n');

const TABLES = {};
for (const m of sql.matchAll(/create table if not exists public\.(\w+) \(([\s\S]*?)\n\);/g)) {
  const cols = {};
  for (const line of m[2].split('\n')) {
    const c = line.match(/^\s+(\w+)\s+(uuid|text|int|bigint|boolean|timestamptz|jsonb|numeric)\b(.*)$/);
    if (c && c[1] !== 'primary') cols[c[1]] = { type: c[2], ref: c[3].match(/references public\.(\w+)/)?.[1] || null };
  }
  TABLES[m[1]] = cols;
}
const FUNCS = {};
for (const m of sql.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)) {
  FUNCS[m[1]] = m[2].trim() ? m[2].split(',').map((p) => p.trim().split(/\s+/)[0]) : [];
}
// every grant block of every migration (the social update adds its own)
const GRANTED = new Set([...sql.matchAll(/grant execute on function([\s\S]*?)to authenticated;/g)].flatMap((g) => [...g[1].matchAll(/public\.(\w+)\(/g)].map((m) => m[1])));
// table privileges: which tables players may read, and which columns they may insert / update
const SELECTABLE = new Set([...sql.matchAll(/grant select on ([\s\S]*?) to authenticated;/g)].flatMap((g) => [...g[1].matchAll(/public\.(\w+)/g)].map((m) => m[1])));
const WRITABLE = {};
for (const m of sql.matchAll(/grant (insert|update) \(([^)]+)\) on public\.(\w+) to authenticated;/g)) {
  WRITABLE[`${m[1]} ${m[3]}`] = new Set(m[2].split(',').map((c) => c.trim()));
}
// the realtime publication blocks (a foreach that adds tables to supabase_realtime)
const PUBLISHED = new Set([...sql.matchAll(/foreach t in array array\[([^\]]+)\] loop\s+if not exists \(select 1 from pg_publication_tables/g)]
  .flatMap((m) => m[1].split(',').map((x) => x.trim().replace(/'/g, ''))));

// ---- a recording stand-in for @supabase/supabase-js ----------------------------------------
const UID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const rec = { from: [], rpc: [], channels: [], auth: [] };
let profileExists = false;

const profileRow = () => ({ id: UID, name: 'Aiko', level: 7, avatar: 'aoi', last_active: '2026-10-08T00:00:00Z', created_at: '2026-10-01T00:00:00Z' });
const clanRow = { id: CID, name: 'Petal Squad', tag: 'PS', emblem: 'assault', join_mode: 'code', description: 'hi', leader_id: UID, xp: 1600, max_members: 30, is_dev: false, created_at: '2026-10-01T00:00:00Z', clan_members: [{ count: 2 }] };
const bossJson = {
  clanId: CID, week: '2026-W41', bossId: 'ashwing', maxHp: 300000, hp: 120000, defeated: false,
  board: [{ userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Bea', damage: 90000, hits: 2 }, { userId: UID, name: 'Aiko', damage: 90000, hits: 1 }],
  myHitsToday: 1, claimed: false, prev: { week: '2026-W40', defeated: true, damage: 5000, rank: 1, claimed: false },
};

function answer(call) {
  const single = call.ops.some(([op]) => op === 'maybeSingle' || op === 'single');
  const op = call.ops.find(([o]) => o === 'insert' || o === 'upsert' || o === 'update')?.[0];
  switch (call.table) {
    case 'profiles':
      if (op === 'upsert') {
        profileExists = true;
        return null;
      }
      if (op === 'update') return null;
      return profileExists ? profileRow() : null;
    case 'clan_members':
      if (single) return { clan_id: CID, role: 'leader' };
      return [
        { user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', clan_id: CID, role: 'member', joined_at: '2026-10-02T00:00:00Z', profiles: { name: 'Bea', level: 3, avatar: 'rei', last_active: '2026-10-08T00:00:00Z' } },
        { user_id: UID, clan_id: CID, role: 'leader', joined_at: '2026-10-01T00:00:00Z', profiles: { name: 'Aiko', level: 7, avatar: 'aoi', last_active: '2026-10-07T00:00:00Z' } },
      ];
    case 'clans':
      return single ? clanRow : [clanRow];
    case 'clan_codes':
      return { code: 'K7Q2ZP' };
    case 'clan_requests':
      return [{ clan_id: CID, user_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', created_at: '2026-10-08T00:00:00Z', profiles: { name: 'Dee', level: 2, avatar: 'yuki' } }];
    case 'messages':
      if (op === 'insert') return { id: 9, channel: 'global', user_id: UID, name: 'Aiko', level: 7, avatar: 'aoi', body: 'hello', kind: 'text', meta: null, created_at: '2026-10-08T00:00:01Z' };
      return [{ id: 8, channel: 'global', user_id: UID, name: 'Aiko', level: 7, avatar: 'aoi', body: 'second', kind: 'text', meta: null, created_at: '2026-10-08T00:00:00Z' },
        { id: 7, channel: 'global', user_id: UID, name: 'Aiko', level: 7, avatar: 'aoi', body: 'first', kind: 'text', meta: null, created_at: '2026-10-07T00:00:00Z' }];
    default:
      return null;
  }
}

const SECRET = 'K7Q2ZPMN4XW8TR6H';
const rpcOverride = {};
// [social] a failing call: { fn: { error, status } } (e.g. the function does not exist yet)
const rpcFail = {};
const BID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TID = '77777777-7777-4777-8777-777777777777';
const RID = '99999999-9999-4999-8999-999999999999';
const KEY1 = '11111111-0000-4000-8000-000000000001';
const dmJson = { id: 41, threadId: TID, senderId: UID, recipientId: BID, name: 'Aiko', level: 7, avatar: 'aoi', body: 'hi', kind: 'text', meta: null, createdAt: '2026-10-13T20:00:00Z', mine: true, inviteState: null };
const reqJson = { id: RID, clanId: CID, userId: BID, name: 'Bea', avatar: 'rei', item: 'mat_feather_rare', wanted: 6, received: 2, status: 'open', gameDay: '2026-10-14', createdAt: '2026-10-13T19:00:00Z', open: true, perDonor: 3, points: 2, myGiven: 2, donors: ['Aiko'] };
const SOCIAL_ANSWERS = {
  social_version: 1,
  social_summary: { unreadDms: 2, friendRequests: 1, donationsReady: 6, privacy: 'friends_clan' },
  player_card: { userId: BID, name: 'Bea', level: 3, avatar: 'rei', clan: { id: CID, name: 'Petal Squad', tag: 'PS' }, clanmate: true, lastActive: '2026-10-13T20:00:00Z', isSelf: false, friend: 'none', requestId: null, blockedByMe: false, canMessage: true, why: null, canFriend: true, friendWhy: null, threadId: TID },
  my_friend_code: { code: 'K7Q2ZP4M' }, reset_friend_code: { code: 'Z9Y8X7W6' },
  list_friends: [{ userId: BID, name: 'Bea', level: 3, avatar: 'rei', lastActive: '2026-10-13T20:00:00Z', online: true, since: '2026-10-12T00:00:00Z', canMessage: true }],
  invite_candidates: [{ userId: BID, name: 'Bea', level: 3, avatar: 'rei', lastActive: '2026-10-13T20:00:00Z', online: true, friend: true, canMessage: true }],
  list_friend_requests: { incoming: [{ id: 5, userId: BID, name: 'Bea', level: 3, avatar: 'rei', via: 'clan', at: '2026-10-13T20:00:00Z' }], outgoing: [{ id: 6, name: 'Cleo', level: 4, avatar: 'aoi', at: '2026-10-13T20:00:00Z' }] },
  send_friend_request: { state: 'requested' }, add_friend_by_code: { name: 'Dee', level: 2, avatar: 'yuki', state: 'requested' },
  list_blocked: [{ userId: BID, name: 'Bea', level: 3, avatar: 'rei', at: '2026-10-13T20:00:00Z' }],
  dm_inbox: { threads: [{ id: TID, peer: { userId: BID, name: 'Bea', level: 3, avatar: 'rei' }, last: dmJson, unread: 2, canMessage: true, lastAt: '2026-10-13T20:00:00Z' }], unread: 2 },
  dm_history: { threadId: TID, peer: { userId: BID, name: 'Bea', level: 3, avatar: 'rei' }, canMessage: true, why: null, messages: [dmJson], hasMore: false },
  send_dm: dmJson,
  send_coop_invite: { ...dmJson, id: 42, kind: 'invite', body: 'Co-op invite: stage 1-3 (Hard)', meta: { room: 'K7Q2Z', stage: '1-3', difficulty: 'hard', expires: 1792000000000 }, inviteState: 'open' },
  invite_state: 'open',
  donation_state: { today: '2026-10-14', nextReset: 1792000000000, serverNow: 1791990000000, cap: 30, donatedToday: 4, clanId: CID, clanLevel: 3, canRequest: false, requestWhy: 'used', canDonate: true, donateWhy: null, tenureReadyAt: '2026-10-10T00:00:00Z', requestReadyAt: '2026-10-09T00:00:00Z', mythicOpen: false, weekly: { superRare: 1, mythic: 0 }, myRequest: null, requests: [reqJson], collectable: [{ item: 'mat_feather_rare', count: 6 }] },
  request_materials: reqJson,
  donate: { key: KEY1, item: 'mat_feather_rare', count: 1, points: 2, reward: { coins: 100 }, replayed: false, request: reqJson, donatedToday: 6, cap: 30 },
  settle_donations: [{ key: KEY1, state: 'applied', item: 'mat_feather_rare', count: 1, coins: 100 }],
  claim_donations: { key: KEY1, replayed: false, items: [{ item: 'mat_feather_rare', count: 6, from: ['Aiko'] }] },
};
function rpcAnswer(fn) {
  if (fn in rpcOverride) return rpcOverride[fn];
  if (fn in SOCIAL_ANSWERS) return SOCIAL_ANSWERS[fn];
  return {
    create_clan: { ...clanRow }, join_clan: { ...clanRow }, join_clan_by_code: { id: CID },
    boss_state: bossJson, start_boss_attempt: { attemptId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', bossId: 'ashwing', cap: 195000 },
    submit_boss_damage: bossJson, claim_boss_reward: { tier: 'A' },
    create_transfer: { code: 'AB2C-DE3F-GH4J', expiresAt: '2026-10-09T00:00:00Z' }, redeem_transfer: { payload: '{"v":2}' },
    open_room: { code: 'K7Q2Z', secret: SECRET, host: true }, join_room: { error: 'full' },
  }[fn] ?? null;
}

function builder(table) {
  const call = { table, ops: [] };
  rec.from.push(call);
  const proxy = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (ok, bad) => Promise.resolve({ data: answer(call), error: null }).then(ok, bad);
      return (...args) => {
        call.ops.push([prop, ...args]);
        return proxy;
      };
    },
  });
  return proxy;
}

function fakeChannel(name, opts) {
  const ch = { name, opts, listeners: [], tracked: [], sent: [], state: 'closed' };
  rec.channels.push(ch);
  Object.assign(ch, {
    on(type, filter, cb) {
      ch.listeners.push({ type, filter, cb });
      return ch;
    },
    subscribe(cb) {
      ch.state = 'joined';
      Promise.resolve().then(() => cb?.('SUBSCRIBED'));
      return ch;
    },
    presenceState: () => ({ [UID]: [{ name: 'Aiko' }], 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb': [{ name: 'Bea', host: true }] }),
    track: async (meta) => ch.tracked.push(meta),
    untrack: async () => {},
    send: (m) => ch.sent.push(m),
  });
  return ch;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: (url, key, opts) => {
    rec.client = { url, key, opts };
    return {
      auth: {
        getSession: async () => {
          rec.auth.push('getSession');
          return { data: { session: null }, error: null };
        },
        signInAnonymously: async () => {
          rec.auth.push('signInAnonymously');
          return { data: { user: { id: UID, is_anonymous: true } }, error: null };
        },
      },
      from: (t) => builder(t),
      rpc: (fn, args) => {
        rec.rpc.push({ fn, args });
        if (rpcFail[fn]) return Promise.resolve({ data: null, ...rpcFail[fn] });
        return Promise.resolve({ data: rpcAnswer(fn), error: null });
      },
      channel: (name, opts) => fakeChannel(name, opts),
      removeChannel: (ch) => {
        ch.removed = true;
      },
    };
  },
}));

/** 'a,b,rel(c,d)' → ['a', 'b', ['rel', ['c', 'd']]] */
function parseSelect(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of `${s},`) {
    if (ch === ',' && depth === 0) {
      const t = cur.trim();
      cur = '';
      if (!t) continue;
      const m = t.match(/^(\w+)\((.*)\)$/);
      out.push(m ? [m[1], parseSelect(m[2])] : t);
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    cur += ch;
  }
  return out;
}

function checkColumns(table, cols, where) {
  expect(TABLES[table], `${where}: table ${table} exists`).toBeTruthy();
  for (const c of cols) {
    if (Array.isArray(c)) {
      const [rel, inner] = c;
      // an embedded resource needs a foreign key between the two tables (either direction)
      const fk = Object.values(TABLES[table]).some((d) => d.ref === rel) || Object.values(TABLES[rel] || {}).some((d) => d.ref === table);
      expect(fk, `${where}: ${table} → ${rel} foreign key`).toBe(true);
      if (!(inner.length === 1 && inner[0] === 'count')) checkColumns(rel, inner, `${where} (${rel})`);
      continue;
    }
    if (c === '*') continue;
    expect(TABLES[table][c], `${where}: column ${table}.${c}`).toBeTruthy();
  }
}

let adapter;
let results;

beforeAll(async () => {
  const { createSupabaseAdapter } = await import('../../src/online/adapters/supabase.js');
  adapter = createSupabaseAdapter({ url: 'https://example.supabase.co', key: 'public-anon-key' });
  await adapter.init();
  results = {};
  results.me = await adapter.signIn({ name: 'Aiko', level: 7, avatar: 'aoi' });
  results.update = await adapter.updateProfile({ name: 'Aiko', level: 8, avatar: 'aoi' });
  await adapter.touch();
  results.history = await adapter.history('global', 50);
  results.sent = await adapter.send('global', ' hello ', {});
  results.unsubChat = adapter.subscribe(`clan:${CID}`, () => {});
  results.clans = await adapter.listClans({ query: 'pet%al,(x)' });
  results.clan = await adapter.getClan(CID);
  results.myClan = await adapter.myClan();
  results.created = await adapter.createClan({ name: 'Petal Squad', tag: 'PS', emblem: 'assault', joinMode: 'code', description: '' });
  await adapter.joinClan(CID);
  await adapter.joinByCode('PETAL123');
  await adapter.requestJoin(CID);
  results.requests = await adapter.listRequests(CID);
  await adapter.answerRequest(CID, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', true);
  await adapter.setRole('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'officer');
  await adapter.kick('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  await adapter.leaveClan();
  results.members = await adapter.members(CID);
  results.unsubClan = adapter.subscribeClan(CID, () => {});
  adapter.subscribeClan('_list', () => {});
  results.boss = await adapter.bossState(CID);
  results.attempt = await adapter.startBossAttempt();
  results.hit = await adapter.submitBossDamage(results.attempt.attemptId, 12345.7);
  results.claim = await adapter.claimBossReward('2026-W40');
  results.transfer = await adapter.createTransfer('{"v":2}');
  results.redeemed = await adapter.redeemTransfer('ab12-cd34');
  results.room = adapter.openRoom('K7Q2Z', { host: true, meta: { name: 'Aiko', host: true }, onMessage: () => {}, onPresence: () => {} });
  results.roomErrors = [];
  results.fullRoom = adapter.openRoom('QQQQQ', { meta: { name: 'Aiko' }, onError: (e) => results.roomErrors.push(e.code) });
  // [social] every method once
  const so = (results.social = {});
  so.probe = await adapter.socialProbe();
  so.summary = await adapter.socialSummary();
  so.card = await adapter.playerCard(BID);
  await adapter.setPrivacy('friends');
  so.code = await adapter.myFriendCode();
  so.reset = await adapter.resetFriendCode();
  so.friends = await adapter.friends();
  so.candidates = await adapter.inviteCandidates();
  so.requests = await adapter.friendRequests();
  so.add = await adapter.addFriend(BID);
  so.byCode = await adapter.addFriendByCode('k7q2-zp4m');
  await adapter.answerFriend('5', true);
  await adapter.cancelFriendRequest(6);
  await adapter.removeFriend(BID);
  await adapter.block(BID);
  await adapter.unblock(BID);
  so.blocked = await adapter.blocked();
  await adapter.report(BID, { reason: 'spam', note: 'hm', context: 'dm', messageId: '41' });
  so.inbox = await adapter.inbox();
  so.history = await adapter.dmHistory(TID, { before: 50, limit: 30 });
  so.sent = await adapter.sendDm(BID, '  hi  ');
  so.invite = await adapter.sendCoopInvite(BID, { room: 'K7Q2Z', stage: '1-3', difficulty: 'hard' });
  so.inviteState = await adapter.inviteState(42);
  await adapter.markRead(TID, 41);
  await adapter.clearThread(TID);
  so.state = await adapter.donationState();
  so.req = await adapter.requestMaterials('mat_feather_rare');
  await adapter.cancelMaterialRequest();
  so.donate = await adapter.donate(RID, 1, KEY1);
  so.settle = await adapter.settleDonations([KEY1]);
  so.claim = await adapter.claimDonations(KEY1);
  so.offInbox = adapter.subscribeInbox(() => {});
  so.offDonations = adapter.subscribeDonations(CID, () => {});
  await new Promise((r) => setTimeout(r, 10));
});

describe('supabase adapter ↔ migration', () => {
  it('uses only the public URL + anon key and signs in anonymously once', () => {
    expect(rec.client.url).toBe('https://example.supabase.co');
    expect(rec.client.key).toBe('public-anon-key');
    expect(rec.client.opts.auth.persistSession).toBe(true);
    expect(rec.auth).toEqual(['getSession', 'signInAnonymously']);
    // first visit: the profile row is created as the signed-in player (a second tab racing
    // the first one must not fail: insert … on conflict do nothing)
    const ins = rec.from.find((c) => c.table === 'profiles' && c.ops.some(([o]) => o === 'upsert'));
    const [, row, opts] = ins.ops.find(([o]) => o === 'upsert');
    expect(row).toMatchObject({ id: UID, name: 'Aiko', level: 7, avatar: 'aoi' });
    expect(opts).toEqual({ onConflict: 'id', ignoreDuplicates: true });
    expect(results.me).toMatchObject({ id: UID, name: 'Aiko', clanId: CID });
  });

  it('reads and writes only tables and columns that exist', () => {
    expect(rec.from.length).toBeGreaterThan(10);
    for (const call of rec.from) {
      const where = `${call.table} ${call.ops.map(([o]) => o).join('.')}`;
      expect(SELECTABLE.has(call.table), `${where}: select on ${call.table} is granted`).toBe(true);
      for (const [op, ...args] of call.ops) {
        if (op === 'select' && args[0]) checkColumns(call.table, parseSelect(args[0]), where);
        if (op === 'eq' || op === 'order') checkColumns(call.table, [args[0]], where);
        if (op === 'insert' || op === 'upsert' || op === 'update') {
          checkColumns(call.table, Object.keys(args[0]), where);
          // column-level grants: a write naming any other column is refused by Postgres
          const kind = op === 'update' ? 'update' : 'insert';
          const granted = WRITABLE[`${kind} ${call.table}`];
          expect(granted, `${where}: ${kind} on ${call.table} is granted`).toBeTruthy();
          for (const col of Object.keys(args[0])) expect(granted.has(col), `${where}: ${kind} (${col}) is granted`).toBe(true);
        }
        if (op === 'or') checkColumns(call.table, args[0].split(',').map((p) => p.split('.')[0]), where);
      }
    }
    // the search text cannot break out of the PostgREST or() filter
    const search = rec.from.find((c) => c.ops.some(([o]) => o === 'or'));
    expect(search.ops.find(([o]) => o === 'or')[1]).toBe('name.ilike.%petalx%,tag.ilike.%petalx%');
    // chat rows are written as the player; the trigger stamps name / level / avatar
    const msg = rec.from.find((c) => c.table === 'messages' && c.ops.some(([o]) => o === 'insert'));
    expect(msg.ops.find(([o]) => o === 'insert')[1]).toEqual({ channel: 'global', user_id: UID, body: 'hello', kind: 'text', meta: null });
  });

  it('calls only functions players may execute, with exactly their parameter names', () => {
    expect(rec.rpc.length).toBeGreaterThan(10);
    for (const { fn, args } of rec.rpc) {
      expect(FUNCS[fn], `function ${fn} exists`).toBeTruthy();
      expect(GRANTED.has(fn), `${fn} is granted to authenticated`).toBe(true);
      expect(Object.keys(args).sort(), `${fn} parameters`).toEqual([...FUNCS[fn]].sort());
    }
    const names = new Set(rec.rpc.map((r) => r.fn));
    for (const fn of ['create_clan', 'join_clan', 'join_clan_by_code', 'request_join', 'answer_request', 'leave_clan', 'set_role', 'kick', 'touch_active', 'boss_state',
      'start_boss_attempt', 'submit_boss_damage', 'claim_boss_reward', 'create_transfer', 'redeem_transfer', 'open_room', 'join_room']) {
      expect(names.has(fn), `${fn} is used`).toBe(true);
    }
    // whole damage numbers only (the column is bigint), against the started attempt
    expect(rec.rpc.find((r) => r.fn === 'submit_boss_damage').args).toEqual({ p_attempt: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', p_damage: 12345 });
  });

  it('listens only to published tables, filtered by existing columns', () => {
    const pg = rec.channels.flatMap((c) => c.listeners.filter((l) => l.type === 'postgres_changes'));
    expect(pg.length).toBeGreaterThanOrEqual(4);
    for (const l of pg) {
      expect(l.filter.schema).toBe('public');
      expect(SELECTABLE.has(l.filter.table), `${l.filter.table}: realtime needs select`).toBe(true);
      expect(PUBLISHED.has(l.filter.table), `${l.filter.table} is in supabase_realtime`).toBe(true);
      const col = l.filter.filter.split('=')[0];
      expect(TABLES[l.filter.table][col], `${l.filter.table}.${col}`).toBeTruthy();
    }
    expect(pg.some((l) => l.filter.filter === `channel=eq.clan:${CID}`)).toBe(true);
    // the browse list has no realtime feed (clans are not published): no channel for '_list'
    expect(rec.channels.some((c) => c.name.includes('_list'))).toBe(false);
    results.unsubChat();
    results.unsubClan();
    expect(rec.channels.filter((c) => c.name.startsWith('chat:') || c.name.startsWith('clan:')).every((c) => c.removed)).toBe(true);
  });

  it('co-op rooms: seat from open_room / join_room, then a broadcast-only channel named by the secret', async () => {
    expect(rec.rpc.find((r) => r.fn === 'open_room').args).toEqual({ p_code: 'K7Q2Z' });
    expect(rec.channels.some((c) => c.name === 'coop:K7Q2Z')).toBe(false); // never the guessable name
    const ch = rec.channels.find((c) => c.name === `coop:K7Q2Z:${SECRET}`);
    // a full room: the error reaches the lobby and no channel is opened
    expect(results.roomErrors).toEqual(['full']);
    expect(rec.channels.some((c) => c.name.startsWith('coop:QQQQQ'))).toBe(false);
    expect(ch.opts.config.broadcast).toEqual({ self: false, ack: false });
    // no Realtime presence at all: a presence track() could hang the channel on some server
    // nodes until the server crashed it (see adapters/supabase.js openRoom)
    expect(ch.opts.config.presence).toBeUndefined();
    expect(ch.listeners.map((l) => l.type)).toEqual(['broadcast']);
    expect(ch.tracked).toEqual([]);
    expect(results.room.status).toBe('connected');
    expect(results.room.connected).toBe(true);
    expect(results.room.send({ type: 'hello' })).toBe(true);
    expect(ch.sent.at(-1)).toEqual({ type: 'broadcast', event: 'm', payload: { uid: UID, msg: { type: 'hello' } } });
    results.room.close();
    expect(ch.removed).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(rec.rpc.filter((r) => r.fn === 'leave_room').map((r) => r.args)).toEqual([{ p_code: 'K7Q2Z' }]); // frees the code
  });

  it('wrong codes come back as { error } (so the server keeps the counted try) and still throw', async () => {
    rpcOverride.join_clan_by_code = { error: 'not_found' };
    rpcOverride.redeem_transfer = { error: 'expired' };
    await expect(adapter.joinByCode('NOPE')).rejects.toMatchObject({ code: 'not_found' });
    await expect(adapter.redeemTransfer('AAAA-BBBB-CCCC')).rejects.toMatchObject({ code: 'expired' });
    delete rpcOverride.join_clan_by_code;
    delete rpcOverride.redeem_transfer;
  });

  it('maps rows into the same shapes the local adapter returns', () => {
    expect(results.history.map((m) => m.body)).toEqual(['first', 'second']); // oldest first
    expect(results.sent).toMatchObject({ id: 9, userId: UID, body: 'hello', kind: 'text' });
    expect(results.clans[0]).toMatchObject({ id: CID, tag: 'PS', joinMode: 'code', memberCount: 2, maxMembers: 30, level: 3, isDev: false });
    expect(results.clan.joinCode).toBe('K7Q2ZP');
    expect(results.myClan).toMatchObject({ role: 'leader', clan: { id: CID } });
    expect(results.members.map((m) => m.role)).toEqual(['leader', 'member']);
    expect(results.members[0]).toMatchObject({ userId: UID, name: 'Aiko', level: 7, avatar: 'aoi' });
    expect(results.requests[0]).toMatchObject({ userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'Dee' });
    expect(results.boss).toMatchObject({ week: '2026-W41', hp: 120000, myRank: 2, myDamage: 90000, myHitsToday: 1, defeated: false });
    expect(results.boss.prev).toMatchObject({ week: '2026-W40', rank: 1, tier: 'S' });
    expect(results.claim.tier).toBe('A');
    expect(results.claim.rewards.length).toBeGreaterThan(0);
    expect(results.transfer.code).toBe('AB2C-DE3F-GH4J');
    expect(results.attempt).toEqual({ attemptId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', bossId: 'ashwing', cap: 195000 });
    expect(results.transfer.expiresAt).toBe(Date.parse('2026-10-09T00:00:00Z'));
    expect(results.redeemed).toBe('{"v":2}');
  });
});

describe('server errors → player-facing codes', () => {
  it('maps the errors Supabase returns', async () => {
    const { toOnlineError, errorText } = await import('../../src/online/errors.js');
    // enforce_rate() raises 'rate_limited:<ms>' (Postgres P0001)
    expect(toOnlineError({ code: 'P0001', message: 'rate_limited:1400' })).toMatchObject({ code: 'rate_limited', retryMs: 1400 });
    expect(errorText({ code: 'P0001', message: 'rate_limited:1400' })).toBe('Slow down — try again in 1.4 s.');
    expect(toOnlineError({ code: 'P0001', message: 'not_found: no clan uses that code' })).toMatchObject({ code: 'not_found', message: 'no clan uses that code' });
    expect(toOnlineError({ code: 'P0001', message: 'already_member' }).code).toBe('already_member');
    expect(toOnlineError({ code: '42501', message: 'new row violates row-level security policy for table "messages"' }).code).toBe('forbidden');
    // the project exists but the migration has not run yet
    expect(toOnlineError({ code: 'PGRST205', message: "Could not find the table 'public.profiles' in the schema cache" }).code).toBe('offline');
    expect(toOnlineError(new TypeError('Failed to fetch')).code).toBe('offline');
  });
});

describe('supabase adapter: the social update', () => {
  it('calls only granted social functions with their exact parameters', () => {
    const social = rec.rpc.filter((r) => r.fn in SOCIAL_ANSWERS || ['set_dm_privacy', 'answer_friend_request', 'cancel_friend_request', 'remove_friend', 'block_player', 'unblock_player', 'report_player', 'dm_mark_read', 'dm_clear', 'cancel_material_request'].includes(r.fn));
    expect(new Set(social.map((r) => r.fn)).size).toBe(31); // every social entry point
    expect(rec.rpc.find((r) => r.fn === 'send_dm').args).toEqual({ p_to: BID, p_body: 'hi' });
    expect(rec.rpc.find((r) => r.fn === 'answer_friend_request').args).toEqual({ p_id: 5, p_accept: true });
    expect(rec.rpc.find((r) => r.fn === 'report_player').args).toEqual({ p_target: BID, p_reason: 'spam', p_note: 'hm', p_context: 'dm', p_message: 41 });
    // the server writes the invite text: the client sends only the room, stage and difficulty
    expect(rec.rpc.find((r) => r.fn === 'send_coop_invite').args).toEqual({ p_to: BID, p_room: 'K7Q2Z', p_stage: '1-3', p_difficulty: 'hard' });
    expect(rec.rpc.find((r) => r.fn === 'donate').args).toEqual({ p_request: RID, p_count: 1, p_key: KEY1 });
  });

  it('maps the answers into the local adapter\'s shapes', () => {
    const so = results.social;
    expect(so.probe).toBe('ready');
    expect(so.summary).toEqual({ unreadDms: 2, friendRequests: 1, donationsReady: 6, privacy: 'friends_clan' });
    expect(so.card).toMatchObject({ userId: BID, canMessage: true, lastActive: Date.parse('2026-10-13T20:00:00Z'), threadId: TID });
    expect(so.requests.incoming[0]).toMatchObject({ id: 5, userId: BID, at: Date.parse('2026-10-13T20:00:00Z') });
    expect(so.requests.outgoing[0]).not.toHaveProperty('userId');
    expect(so.candidates[0]).toMatchObject({ userId: BID, friend: true, canMessage: true });
    expect(so.inbox.threads[0]).toMatchObject({ id: TID, unread: 2, last: { id: 41, mine: true, createdAt: Date.parse('2026-10-13T20:00:00Z') } });
    expect(so.history.messages[0].body).toBe('hi');
    expect(so.invite).toMatchObject({ kind: 'invite', meta: { room: 'K7Q2Z' }, inviteState: 'open' });
    expect(so.state).toMatchObject({ nextReset: 1792000000000, donatedToday: 4, requests: [{ id: RID, myGiven: 2, createdAt: Date.parse('2026-10-13T19:00:00Z') }] });
    expect(so.donate).toMatchObject({ key: KEY1, reward: { coins: 100 }, request: { received: 2 } });
    expect(so.claim.items[0]).toMatchObject({ item: 'mat_feather_rare', count: 6 });
  });

  it('live DMs, friend requests and clan requests: INSERT / UPDATE only, filtered to me / my clan', () => {
    const inbox = rec.channels.find((c) => c.name.startsWith(`inbox:${UID}:`));
    expect(inbox.listeners.map((l) => [l.filter.table, l.filter.event, l.filter.filter])).toEqual([
      ['direct_messages', 'INSERT', `recipient_id=eq.${UID}`],
      ['friend_requests', 'INSERT', `to_id=eq.${UID}`],
      ['donation_requests', 'UPDATE', `user_id=eq.${UID}`],
    ]);
    const don = rec.channels.find((c) => c.name.startsWith(`donate:${CID}:`));
    expect(don.listeners.map((l) => l.filter.event)).toEqual(['INSERT', 'UPDATE']);
    expect(don.listeners.every((l) => l.filter.filter === `clan_id=eq.${CID}`)).toBe(true);
    // the clan's own channel never listens to a social table (an unknown table would break it)
    const clanCh = rec.channels.filter((c) => c.name.startsWith('clan:'));
    expect(clanCh.flatMap((c) => c.listeners).some((l) => ['donation_requests', 'direct_messages', 'friend_requests'].includes(l.filter?.table))).toBe(false);
    results.social.offInbox();
    results.social.offDonations();
    expect(inbox.removed).toBe(true);
    expect(don.removed).toBe(true);
  });

  it('a server without the social migration answers needs_update for social calls only', async () => {
    const missing = { error: { code: 'PGRST202', message: 'Could not find the function public.social_version without parameters in the schema cache' }, status: 404 };
    rpcFail.social_version = missing;
    rpcFail.send_dm = { error: { code: 'PGRST202', message: 'Could not find the function public.send_dm(p_body, p_to) in the schema cache' }, status: 404 };
    rpcFail.create_clan = missing;
    expect(await adapter.socialProbe()).toBe('needs_update');
    await expect(adapter.sendDm(BID, 'hi')).rejects.toMatchObject({ code: 'needs_update', definitive: true });
    // core calls keep their own errors (never "needs the social update")
    await expect(adapter.createClan({ name: 'X', tag: 'X' })).rejects.not.toMatchObject({ code: 'needs_update' });
    // a definitive server refusal vs an ambiguous gateway error (donations refund only on the first)
    rpcFail.donate = { error: { code: 'P0001', message: 'daily_limit:3600000' } };
    await expect(adapter.donate(RID, 1, KEY1)).rejects.toMatchObject({ code: 'daily_limit', retryMs: 3600000, definitive: true });
    rpcFail.donate = { error: { message: '<html>502 Bad Gateway</html>' }, status: 502 };
    await expect(adapter.donate(RID, 1, KEY1)).rejects.toMatchObject({ definitive: false });
    for (const k of Object.keys(rpcFail)) delete rpcFail[k];
  });
});
