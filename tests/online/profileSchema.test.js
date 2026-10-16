// The profile migration (supabase/migrations/20261016000000_profile.sql, docs/specs/PROFILE.md §6) on a real
// Postgres (PGlite): every migration applied twice, with and without Supabase's default grants. Lint (RLS, no
// grants, the client's rate numbers and contact strings in the SQL), the JS mirror ≡ SQL (bio vectors, card
// shapes), the ACL allow-list, the order guard, the heaviest card + refusals, bio rules, visibility (friend,
// clanmate under / over 72 h), blocks, no presence, `since` as a month, mutes and locks, report evidence with
// earlier bios, auto-hide + strike + lock, the owner's review update, rate limits and re-paste orders.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import { RULES } from '../../src/online/limits.js';
import { CONTACT_PATTERNS, CONTACT_APPS, CONTACT_WORDS, contactFree, bioError, validCard } from '../../src/online/profileRules.js';
import { MIGRATIONS_DIR, MIGRATION_SQL, PGlite, createDb, refused } from './pgHarness.js';

const read = (f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
const PROFILE_SQL = read('20261016000000_profile.sql');
const ONLINE_SQL = read('20261008000000_online.sql');
const SOCIAL_SQLS = ['20261013000000_social.sql', '20261015000000_social_open_friends.sql'].map(read).join('\n');
const ENTRY = ['my_profile_card', 'profile_version', 'profile_view', 'set_profile_bio', 'set_profile_card', 'set_profile_visibility'];
const HELPERS = ['profile_flat', 'profile_contact_free', 'profile_bio_ok', 'profile_num', 'profile_opt_id', 'profile_stat_ok', 'profile_counts_ok', 'valid_profile_card',
  'profile_can_see', 'profile_owner_muted', 'profile_own_json', 'profile_evidence', 'profile_maybe_hide', 'reports_profile_evidence', 'reports_profile_hide'];

const gear = (s, main) => ({ s, r: 'legendary', l: 10, m: [main, 0.1234], x: [['critChance', 0.0512, 2], ['rangePct', 0.0421, 1], ['armorPen', 12.4], ['ratePct', 0.0333]] });
const unit = (id) => ({ id, lv: 60, bt: 5, aw: 5, p: 6, sk: `${id}_sentinel_school`, g: [gear('charm', 'atkPct'), gear('ribbon', 'critChance'), gear('shoes', 'ratePct')] });
const MAX = {
  v: 1, fav: 'hikari', ban: 'theme:festival', frm: 'eclipse', ttl: 'fp_crimson', units: ['hikari', 'luna', 'nami', 'aoi', 'rei', 'yuki', 'momo', 'akane'].map(unit),
  med: { a: [59, 59, 59, 59], r: [160, 160, 160, 160, 160], pins: ['8-5:nightmare', '1-1:hard:rush', '3-2:perfect', 'ach:a_bestiary_100'] },
  fp: { blossom: { w: 212, s: '5-4', c: 1 }, tempest: { w: 168, s: '8-1' }, crimson: { w: 121, s: 'boss-ashwing', c: 1 } }, st: { u: 19, s: 59, b: 100, k: 1234567, h: 32 },
};
const BAD = {
  nineUnits: { ...MAX, units: [...MAX.units, unit('kage')] },
  dupUnit: { ...MAX, units: [unit('hikari'), unit('hikari')] },
  unknownKey: { ...MAX, gems: 999999 },
  unitExtraKey: { ...MAX, units: [{ ...unit('hikari'), uid: 'g123' }] },
  gearExtraKey: { ...MAX, units: [{ ...unit('hikari'), g: [{ ...gear('charm', 'atkPct'), name: 'Legendary Charm' }] }] },
  badId: { ...MAX, fav: 'Hikari!' },
  textInId: { ...MAX, ttl: 'add me on discord' },
  lvZero: { ...MAX, units: [{ ...unit('hikari'), lv: 0 }] },
  lvString: { ...MAX, units: [{ ...unit('hikari'), lv: '60' }] },
  lvFraction: { ...MAX, units: [{ ...unit('hikari'), lv: 59.5 }] },
  sevenSubs: { ...MAX, units: [{ ...unit('hikari'), g: [{ ...gear('charm', 'atkPct'), x: Array.from({ length: 7 }, () => ['atkPct', 0.01]) }] }] },
  dupSlot: { ...MAX, units: [{ ...unit('hikari'), g: [gear('charm', 'atkPct'), gear('charm', 'atkPct')] }] },
  negStat: { ...MAX, units: [{ ...unit('hikari'), g: [{ ...gear('charm', 'atkPct'), m: ['atkPct', -1] }] }] },
  hugeStat: { ...MAX, units: [{ ...unit('hikari'), g: [{ ...gear('charm', 'atkPct'), m: ['atkPct', 1e9] }] }] },
  fivePins: { ...MAX, med: { ...MAX.med, pins: ['1-1:easy', '1-2:easy', '1-3:easy', '1-4:easy', '1-5:easy'] } },
  dupPin: { ...MAX, med: { ...MAX.med, pins: ['1-1:easy', '1-1:easy'] } },
  badPin: { ...MAX, med: { ...MAX.med, pins: ['1-1:insane'] } },
  textPin: { ...MAX, med: { ...MAX.med, pins: ['ach:add me on discord'] } },
  perfectWithDiff: { ...MAX, med: { ...MAX.med, pins: ['1-1:hard:perfect:x'] } },
  medCountsShort: { ...MAX, med: { a: [1, 2, 3] } },
  oldMedKey: { ...MAX, med: { c: [1, 2, 3, 4] } },
  ribbonsNine: { ...MAX, med: { r: [1, 1, 1, 1, 1, 1, 1, 1, 1] } },
  fpExtra: { ...MAX, fp: { crimson: { w: 1, s: '8-5', at: 1 } } },
  fpOldShape: { ...MAX, fp: { w: 147, t: 'crimson', s: '8-5' } },
  fpFiveTiers: { ...MAX, fp: { a: { w: 1, s: '1-1' }, b: { w: 1, s: '1-1' }, c: { w: 1, s: '1-1' }, d: { w: 1, s: '1-1' }, e: { w: 1, s: '1-1' } } },
  fpCoopTwo: { ...MAX, fp: { crimson: { w: 1, s: '8-5', c: 2 } } },
  oldAchKey: { ...MAX, ach: ['a_gold_40'] },
  stBestiary101: { ...MAX, st: { b: 101 } },
  stHonors1000: { ...MAX, st: { h: 1000 } },
  stExtra: { ...MAX, st: { gems: 999999 } },
  subUps10: { ...MAX, units: [{ ...unit('hikari'), g: [{ ...gear('charm', 'atkPct'), x: [['atkPct', 0.01, 10]] }] }] },
  mainWithUps: { ...MAX, units: [{ ...unit('hikari'), g: [{ ...gear('charm', 'atkPct'), m: ['atkPct', 0.1, 1] }] }] },
  noVersion: { units: [] },
  v2: { ...MAX, v: 2 },
  arrayCard: [1, 2, 3],
};
const GOOD = {
  max: MAX, empty: { v: 1 }, nulls: { v: 1, fav: null, ttl: null, frm: null, fp: null }, noGear: { v: 1, units: [{ id: 'hikari', lv: 1, bt: 0, aw: 0 }] },
  medalsOnly: { v: 1, med: { a: [3, 1, 0, 0], pins: ['1-1:normal'] } }, emptyFp: { v: 1, fp: {} }, someStats: { v: 1, st: { u: 3, k: 0, h: 0 } },
};
const BIOS_ALLOWED = ['Hikari is the best sensei!', 'Lv 60 Hikari ★5 P6', 'gg wp everyone', 'Cleared 8-5 on Nightmare 🌸', 'wave 147 on 8-5 crimson moon', 'polka dot dress fan',
  'I love Aoi. Me too!', 'wait...me too', 'No.1 Luna fan', 'Rei > all', 'うちのひかりちゃん最高www', 'Sensei since 2026', 'Ver.2 build', 'oh hi. to be honest i like rei', 'St.Hikari academy',
  'GG! #1 Kaede fan', 'e.g. Luna or Nami', 'I play every day after school', '最高www.', 'lol www', 'ABCD2345 add me', 'I am 12 years old'];
const BIOS_REFUSED = ['visit sakura.gg', 'discord.gg/abc', 'https://x.y', 'www.example.org', 'mail me hikari@gmail', 'hikari＠mail', 'add me @hikari_fan', 'Hikari#1234',
  'call 555-1234', '(555) 123 4567', '５５５１２３４５６７', 'my bday 2014/03/09', 'add me on d1sc0rd', 'my Snap Chat: hikari', 'sakura dot com', 'sakura (dot) gg', 'my insta hikari_fan',
  'kik me', 'sakura.com', 'ѕakura.com', 'yt: hikari', 'find me on tik tok', 'ig hikari_fan', 'ⓓⓘⓢⓒⓞⓡⓓ', 'w w w.sakura', 'www.sakura', 'hikari.io/me', 'Ｈｉｋａｒｉ．ｃｏｍ', 'hikari。com',
  'DISCORD', 'Dïscörd', '8-5 8-4 8-3 8-2', 'oh snap'];

describe('profile migration (lint)', () => {
  it('RLS on, no player grants on the table, and an order guard before anything is created', () => {
    expect(PROFILE_SQL).toContain('alter table public.profile_cards enable row level security;');
    expect(PROFILE_SQL).toContain('revoke all on public.profile_cards from anon, authenticated;');
    expect(PROFILE_SQL).not.toMatch(/grant [^;]* on (table )?public\.profile_cards/i);
    expect(PROFILE_SQL.indexOf('Run 20261013000000_social.sql first')).toBeLessThan(PROFILE_SQL.indexOf('create '));
  });
  it('uses the client limiter\'s numbers', () => {
    const call = (action) => PROFILE_SQL.match(new RegExp(`enforce_rate\\('${action}', (\\d+), (\\d+), interval '1 (hour|day)'\\)`));
    for (const action of ['profile', 'bio', 'settings']) {
      const m = call(action);
      expect(m, action).toBeTruthy();
      expect(Number(m[1]), `${action} gap`).toBe(RULES[action].gapMs);
      expect(Number(m[2]), `${action} max`).toBe(RULES[action].max);
      expect(m[3] === 'hour' ? 3600e3 : 86400e3, `${action} window`).toBe(RULES[action].windowMs);
    }
  });
  it('carries every contact string of the JS mirror word for word', () => {
    for (const p of [...CONTACT_PATTERNS, CONTACT_APPS, CONTACT_WORDS]) expect(PROFILE_SQL, p).toContain(p);
  });
  it('sits after the social migrations', () => {
    expect('20261016000000_profile.sql' > '20261015000000_social_open_friends.sql').toBe(true);
  });
});

const U = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const [A, B, C, D, E, F, G] = [1, 2, 3, 4, 5, 6, 7].map(U);
const NAMES = [[A, 'Aiko'], [B, 'Bea'], [C, 'Cleo'], [D, 'Dara'], [E, 'Emi'], [F, 'Fumi'], [G, 'Gin']];

describe.skipIf(!PGlite)('profile migration: order guard', () => {
  it('refuses to run before the social file, and creates nothing', async () => {
    const { db } = await createDb({ defaultGrants: true, sql: ONLINE_SQL, runs: 1 });
    await refused(db.exec(PROFILE_SQL), /Run 20261013000000_social\.sql first/);
    await db.exec('rollback'); // the file is one transaction: the refused paste is still open
    expect((await db.query(`select to_regclass('public.profile_cards') as t`)).rows[0].t).toBeNull();
  }, 60000);
});

for (const defaultGrants of [true, false])
describe.skipIf(!PGlite)(`profile migration (run on Postgres, ${defaultGrants ? 'with' : 'without'} default grants)`, () => {
  let db; let as; let one;
  const sup = (text, params) => db.query(text, params);
  const age = (uids, days) => db.exec(`set session_replication_role = replica;
    update profiles set created_at = now() - interval '${Number(days)} days' where id = any(array[${uids.map((u) => `'${u}'::uuid`).join(',')}]);
    set session_replication_role = default;`);
  const view = (who, of) => one(who, 'select profile_view($1) as r', [of]);
  const publish = (who, card, hash = 'h1') => one(who, 'select set_profile_card($1::jsonb, $2) as r', [typeof card === 'string' ? card : JSON.stringify(card), hash]);
  const clearRate = (action, uid = null) => (uid ? sup('delete from rate_events where user_id = $1 and action = $2', [uid, action]) : sup('delete from rate_events where action = $1', [action]));

  beforeAll(async () => {
    ({ db, as, one } = await createDb({ defaultGrants, users: NAMES }));
  }, 120000);

  it('players execute only the 6 entry points; anon none; no direct table access', async () => {
    const rows = (await sup(`select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as a, has_function_privilege('anon', p.oid, 'execute') as an
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1)`, [[...ENTRY, ...HELPERS]])).rows;
    expect([...new Set(rows.filter((r) => r.a).map((r) => r.proname))].sort()).toEqual(ENTRY);
    expect(rows.filter((r) => r.an)).toEqual([]);
    await refused(as(A, 'select * from profile_cards'), /permission denied/);
    await refused(as(A, `insert into profile_cards (user_id, bio) values ($1, 'x')`, [A]), /permission denied/);
    await refused(as(A, 'select profile_maybe_hide($1)', [B]), /permission denied/);
    expect(await one(A, 'select profile_version() as r')).toBe(1);
  });

  it('the JS mirror says what the SQL says: bios and card shapes', async () => {
    for (const s of [...BIOS_ALLOWED, ...BIOS_REFUSED, 'x'.repeat(80), 'x'.repeat(81), '', 'a​b']) {
      const r = (await sup('select profile_contact_free($1) as c, profile_bio_ok($1) as b', [s])).rows[0];
      expect(r.c, `contact ${s}`).toBe(contactFree(s));
      expect(r.b, `bio ${s}`).toBe(bioError(s) === null);
    }
    for (const s of BIOS_ALLOWED) expect(contactFree(s), s).toBe(true);
    for (const s of BIOS_REFUSED) expect(contactFree(s), s).toBe(false);
    for (const [k, c] of [...Object.entries(BAD), ...Object.entries(GOOD)]) {
      const r = (await sup('select valid_profile_card($1::jsonb) as r', [JSON.stringify(c)])).rows[0].r;
      expect(r, k).toBe(validCard(c));
      expect(r, k).toBe(k in GOOD);
    }
  });

  it('publishes the heaviest card within 8 KB, refuses every bad shape', async () => {
    expect((await publish(A, MAX)).hash).toBe('h1');
    const sz = (await sup('select octet_length(card::text) as t from profile_cards where user_id = $1', [A])).rows[0];
    expect(sz.t).toBeLessThanOrEqual(8192);
    for (const [k, c] of Object.entries(BAD)) await refused(publish(B, c, 'x1'), /not valid/, k);
    await refused(publish(B, JSON.stringify(MAX).replace(/0\.1234\b/g, `0.${'1'.repeat(200)}`), 'x1'), /not valid/);
    await refused(publish(B, { v: 1 }, 'NOT A HASH'), /bad card hash/);
    for (const c of Object.values(GOOD)) {
      await clearRate('profile', B);
      await publish(B, c, 'x1');
    }
  });

  it('bio: stored, readable errors, and visitors never see when it changed', async () => {
    await refused(one(A, 'select set_profile_bio($1) as r', ['add me on discord']), /other apps/);
    await refused(one(A, 'select set_profile_bio($1) as r', ['x'.repeat(81)]), /up to 80/);
    const r = await one(A, 'select set_profile_bio($1) as r', ['  Hikari is the best!  ']);
    expect(r).toMatchObject({ bio: 'Hikari is the best!', bioHidden: false, exists: true });
    const v = await view(B, A);
    expect(v.profileWhy).toBeNull();
    expect(v.profile.bio).toBe('Hikari is the best!');
    expect(v.profile.card.fav).toBe('hikari');
    expect(Object.keys(v.profile).sort()).toEqual(['bio', 'card']);
    expect(v.own).toBeNull();
    expect(v.since).toMatch(/^\d{4}-\d{2}$/);
    expect(v).toMatchObject({ name: 'Aiko', blockedByMe: false });
    expect('canMessage' in v).toBe(true);
    const self = await view(A, A);
    expect(self.own).toMatchObject({ exists: true, visibility: 'everyone', bio: 'Hikari is the best!' });
    expect(await view(C, D)).toMatchObject({ profileWhy: 'none', profile: null });
    expect((await view(D, D)).own.exists).toBe(false);
  });

  it('visibility: nobody, friends & clan (friend; clanmate under and over 72 h), everyone', async () => {
    await one(A, `select set_profile_visibility('nobody') as r`);
    expect(await view(B, A)).toMatchObject({ profileWhy: 'private', profile: null });
    await clearRate('settings', A);
    await one(A, `select set_profile_visibility('friends_clan') as r`);
    expect((await view(B, A)).profileWhy).toBe('private');
    await sup('insert into friends (user_id, friend_id) values ($1, $2), ($2, $1)', [A, B]);
    expect((await view(B, A)).profileWhy).toBeNull();
    await sup('delete from friends');
    const clan = (await sup(`insert into clans (name, tag, leader_id) values ('Sakura Club', 'SKR', $1) returning id`, [A])).rows[0].id;
    await sup(`insert into clan_members (user_id, clan_id, role, joined_at) values ($1, $3, 'leader', now()), ($2, $3, 'member', now())`, [A, C, clan]);
    expect((await view(C, A)).profileWhy).toBe('private');
    await sup(`update clan_members set joined_at = now() - interval '73 hours' where clan_id = $1`, [clan]);
    expect((await view(C, A)).profileWhy).toBeNull();
    await sup('delete from clan_members where clan_id = $1', [clan]);
    await refused(one(A, `select set_profile_visibility('public') as r`), /unknown setting/);
    await one(A, `select set_profile_visibility('everyone') as r`);
    expect((await view(B, A)).profileWhy).toBeNull();
  });

  it('blocks: blocked by the owner reads exactly like "Only me"; the blocker is told', async () => {
    await one(A, 'select block_player($1) as r', [B]);
    const blocked = await view(B, A);
    expect(blocked).toMatchObject({ profileWhy: 'private', profile: null });
    expect(await view(A, B)).toMatchObject({ profileWhy: 'blocked_by_me', profile: null });
    await one(A, 'select unblock_player($1) as r', [B]);
    expect((await view(B, A)).profileWhy).toBeNull();
  });

  it('mutes: no new bio while muted (clearing allowed); an owner mute hides the bio from others', async () => {
    await sup(`insert into social_mutes (user_id, until, reason, created_by) values ($1, now() + interval '1 day', 't', 'owner')`, [A]);
    await refused(one(A, 'select set_profile_bio($1) as r', ['new text here']), /can't change your bio/);
    expect((await view(B, A)).profile.bio).toBe('');
    expect((await view(A, A)).own.bioHidden).toBe(true);
    await sup('delete from social_mutes');
    expect((await view(B, A)).profile.bio).toBe('Hikari is the best!');
  });

  it('reports: evidence with earlier bios, auto-hide, strike, lock', async () => {
    await age([B, C, D, E], 3);
    await one(B, `select report_player($1, 'inappropriate', '', 'profile', null) as r`, [A]);
    let ev = (await sup('select evidence from reports where reporter_id = $1 and target_id = $2', [B, A])).rows[0].evidence;
    expect(ev.profile).toMatchObject({ bio: 'Hikari is the best!', fav: 'hikari' });
    expect(ev.profile.units).toHaveLength(8);
    expect(ev.target?.name).toBe('Aiko');
    await clearRate('bio', A);
    await one(A, 'select set_profile_bio($1) as r', ['Second bio']);
    await clearRate('report');
    await one(B, `select report_player($1, 'bullying', '', 'profile', null) as r`, [A]);
    ev = (await sup('select evidence from reports where reporter_id = $1 and target_id = $2', [B, A])).rows[0].evidence;
    expect(ev.profile.bio).toBe('Second bio');
    expect(ev.profile.earlier.some((e) => e.bio === 'Hikari is the best!')).toBe(true);
    await sup(`update reports set status = 'reviewed', updated_at = now() where reporter_id = $1`, [B]);
    await sup(`update reports set status = 'open' where reporter_id = $1`, [B]);
    // a fresh alt (F, < 1 day) does not count; B + C + D do
    await one(F, `select report_player($1, 'spam', '', 'profile', null) as r`, [A]);
    await one(C, `select report_player($1, 'spam', '', 'profile', null) as r`, [A]);
    expect((await view(E, A)).profile.bio).toBe('Second bio');
    await one(D, `select report_player($1, 'spam', '', 'profile', null) as r`, [A]);
    expect((await view(E, A)).profile.bio).toBe('');
    expect((await one(A, 'select my_profile_card() as r')).bioHidden).toBe(true);
    expect((await one(A, 'select set_profile_bio($1) as r', ['Second bio'])).bioHidden).toBe(true);
    await one(A, 'select set_profile_bio($1) as r', ['Third bio']);
    expect((await view(E, A)).profile.bio).toBe('Third bio');
    for (const who of [B, C, D]) {
      await clearRate('report');
      await one(who, `select report_player($1, 'spam', '', 'profile', null) as r`, [A]);
    }
    const own = await one(A, 'select my_profile_card() as r');
    expect(own.bioHidden).toBe(true);
    expect(own.bioLockedUntil).toBeTruthy();
    await refused(one(A, 'select set_profile_bio($1) as r', ['Fourth bio']), /can't change your bio/);
    await one(A, `select set_profile_bio('') as r`);
  });

  it('rate limits: one card a second, ten bios a day', async () => {
    await clearRate('profile', G);
    await publish(G, { v: 1 }, 'g1');
    await refused(publish(G, { v: 1 }, 'g2'), /rate_limited/);
    await clearRate('bio', G);
    for (let i = 0; i < 10; i++) await one(G, 'select set_profile_bio($1) as r', [`bio number ${i}`]);
    await refused(one(G, 'select set_profile_bio($1) as r', ['one more']), /rate_limited/);
  });

  it('re-paste orders: social keeps the profile triggers and grants; online → social → profile restores everything', async () => {
    await db.exec(SOCIAL_SQLS);
    const trg = (await sup(`select tgname from pg_trigger where tgrelid = 'public.reports'::regclass and not tgisinternal order by 1`)).rows.map((r) => r.tgname);
    expect(trg).toEqual(expect.arrayContaining(['reports_profile_evidence', 'reports_profile_hide']));
    await view(B, A);
    await db.exec(ONLINE_SQL);
    await refused(one(B, 'select profile_version() as r'), /permission denied/);
    await db.exec(SOCIAL_SQLS);
    await db.exec(PROFILE_SQL);
    expect(await one(B, 'select profile_version() as r')).toBe(1);
    expect((await view(B, A)).profileWhy).toBeNull();
  });

  it('the whole migration set still contains the profile file', () => {
    expect(MIGRATION_SQL).toContain('create table if not exists public.profile_cards');
  });
});
