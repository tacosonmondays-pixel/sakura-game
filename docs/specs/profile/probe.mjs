// Proves the profile SQL sketch on PGlite after the real online + social migrations (wt-social).
// Run with cwd = /home/user/wt-social (pgHarness reads supabase/migrations from the cwd):
//   cd /home/user/wt-social && node docs/specs/profile/probe.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDb, MIGRATION_SQL } from '/home/user/wt-social/tests/online/pgHarness.js';

const HERE = new URL('.', import.meta.url).pathname;
const PROFILE_SQL = readFileSync(join(HERE, '20261016000000_profile.sql'), 'utf8');
const ONLINE_SQL = readFileSync('/home/user/wt-social/supabase/migrations/20261008000000_online.sql', 'utf8');
const SOCIAL_SQL = readFileSync('/home/user/wt-social/supabase/migrations/20261013000000_social.sql', 'utf8');

let fails = 0;
const ok = (cond, label, extra) => {
  if (!cond) fails++;
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${extra !== undefined ? ` — ${typeof extra === 'string' ? extra : JSON.stringify(extra)}` : ''}`);
};
async function err(p) {
  try {
    await p;
    return null;
  } catch (e) {
    return e.message;
  }
}

const U = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const [A, B, C, D, E, F] = [1, 2, 3, 4, 5, 6].map(U);
const users = [[A, 'Aiko'], [B, 'Bea'], [C, 'Cora'], [D, 'Dina'], [E, 'Emi'], [F, 'Fumi']];

// 0. order guard: profile before social is refused, nothing created
{
  const { db } = await createDb({ defaultGrants: true, sql: ONLINE_SQL, runs: 1 });
  const m = await err(db.exec(PROFILE_SQL));
  ok(/Run 20261013000000_social\.sql first/.test(m || ''), 'profile SQL refuses to run before the social SQL', m);
  const t = (await db.query(`select to_regclass('public.profile_cards') as t`)).rows[0].t;
  ok(t === null, 'nothing created by the refused paste');
}

const { db, as, one } = await createDb({ defaultGrants: true, users, sql: `${MIGRATION_SQL}\n${PROFILE_SQL}` });
const sup = (q, p = []) => db.query(q, p);

// 1. ACLs
{
  const names = ['profile_flat', 'profile_contact_free', 'profile_bio_ok', 'profile_num', 'profile_opt_id', 'profile_stat_ok', 'profile_counts_ok', 'valid_profile_card',
    'profile_can_see', 'profile_owner_muted', 'profile_own_json', 'profile_evidence', 'profile_maybe_hide', 'reports_profile_evidence', 'reports_profile_hide',
    'profile_version', 'profile_view', 'my_profile_card', 'set_profile_card', 'set_profile_bio', 'set_profile_visibility'];
  const rows = (await sup(`select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as a, has_function_privilege('anon', p.oid, 'execute') as an
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1)`, [names])).rows;
  ok(JSON.stringify(rows.filter((r) => r.a).map((r) => r.proname).sort()) === JSON.stringify(['my_profile_card', 'profile_version', 'profile_view', 'set_profile_bio', 'set_profile_card', 'set_profile_visibility']),
    'players execute only the 6 entry points', rows.filter((r) => r.a).map((r) => r.proname));
  ok(rows.every((r) => !r.an), 'anon executes none');
  ok(/permission denied/.test(await err(as(A, 'select * from profile_cards')) || ''), 'no direct read of profile_cards');
  ok(/permission denied/.test(await err(as(A, `insert into profile_cards (user_id, bio) values ($1, 'x')`, [A])) || ''), 'no direct insert');
  ok(/permission denied/.test(await err(as(A, `select profile_maybe_hide($1)`, [B])) || ''), 'helpers not callable');
  ok(await one(A, 'select profile_version() as r') === 1, 'profile_version() = 1');
  const lf = (await sup(`select char_length('АВСЕНІЈКМОРЅТХУҮҺԀԚԜӀѴавсеніјкморѕтхуүһԁԛԝӏѵΑΒΕΖΗΙΚΜΝΟΡΤΥΧαβεζηικμνορτυχϳıɑɡɩ。․‧·') as a, char_length('abcehijkmopstxyyhdqwlvabcehijkmopstxyyhdqwlvabezhikmnoptyxabezhikmnoptyxjiagi....') as b`)).rows[0];
  ok(lf.a === lf.b, 'translate tables have equal length', lf);
}

// 2. the heaviest card + its size
const gear = (s, main) => ({ s, r: 'legendary', l: 10, m: [main, 0.1234], x: [['critChance', 0.0512, 2], ['rangePct', 0.0421, 1], ['armorPen', 12.4], ['ratePct', 0.0333]] });
const unit = (id) => ({ id, lv: 60, bt: 5, aw: 5, p: 6, sk: `${id}_sentinel_school`, g: [gear('charm', 'atkPct'), gear('ribbon', 'critChance'), gear('shoes', 'ratePct')] });
const MAX = {
  v: 1, fav: 'hikari', ban: 'theme:festival', frm: 'eclipse', ttl: 'fp_crimson',
  units: ['hikari', 'luna', 'nami', 'aoi', 'rei', 'yuki', 'momo', 'akane'].map(unit),
  med: { a: [59, 59, 59, 59], r: [160, 160, 160, 160, 160], pins: ['8-5:nightmare', '1-1:hard:rush', '3-2:perfect', 'ach:a_bestiary_100'] },
  fp: { blossom: { w: 212, s: '5-4', c: 1 }, tempest: { w: 168, s: '8-1' }, crimson: { w: 121, s: 'boss-ashwing', c: 1 } },
  st: { u: 19, s: 59, b: 100, k: 1234567 },
};
{
  const r = await one(A, 'select set_profile_card($1::jsonb, $2) as r', [JSON.stringify(MAX), 'h1']);
  ok(r?.hash === 'h1', 'publish the heaviest card');
  const sz = (await sup(`select octet_length(card::text) as t, pg_column_size(card) as b from profile_cards where user_id = $1`, [A])).rows[0];
  ok(sz.t <= 8192, 'heaviest card fits the 8 KB ceiling', { jsonStringify: Buffer.byteLength(JSON.stringify(MAX)), jsonbText: sz.t, jsonbBinary: sz.b });
}

// 3. shape refusals
{
  const bad = {
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
    stExtra: { ...MAX, st: { gems: 999999 } },
    subUps10: { ...MAX, units: [{ ...unit('hikari'), g: [{ ...gear('charm', 'atkPct'), x: [['atkPct', 0.01, 10]] }] }] },
    mainWithUps: { ...MAX, units: [{ ...unit('hikari'), g: [{ ...gear('charm', 'atkPct'), m: ['atkPct', 0.1, 1] }] }] },
    noVersion: { units: [] },
    v2: { ...MAX, v: 2 },
    arrayCard: [1, 2, 3],
  };
  // a card over 8 KB as jsonb text: long numeric literals (JS numbers cannot carry them)
  const tooBigText = JSON.stringify(MAX).replace(/0\.1234\b/g, '0.' + '1'.repeat(200));
  for (const [k, v] of [...Object.entries(bad), ['tooBigLiteral', null]]) {
    const text = k === 'tooBigLiteral' ? tooBigText : JSON.stringify(v);
    if (k === 'tooBigLiteral') console.log('     (tooBigLiteral text bytes', Buffer.byteLength(text), ')');
    const m = await err(as(B, 'select set_profile_card($1::jsonb, $2) as r', [text, 'x1']));
    ok(/not valid/.test(m || ''), `refused: ${k}`, m ? undefined : 'ACCEPTED');
  }
  const okCards = { empty: { v: 1 }, nulls: { v: 1, fav: null, ttl: null, frm: null, fp: null }, noGear: { v: 1, units: [{ id: 'hikari', lv: 1, bt: 0, aw: 0 }] },
    medalsOnly: { v: 1, med: { a: [3, 1, 0, 0], pins: ['1-1:normal'] } }, emptyFp: { v: 1, fp: {} }, someStats: { v: 1, st: { u: 3, k: 0 } } };
  for (const [k, v] of Object.entries(okCards)) {
    await sup(`delete from rate_events where user_id = $1`, [B]);
    const m = await err(as(B, 'select set_profile_card($1::jsonb, $2) as r', [JSON.stringify(v), 'x1']));
    ok(m === null, `accepted: ${k}`, m || undefined);
  }
}

// 4. bio rules
{
  const allowed = ['Hikari is the best sensei!', 'Lv 60 Hikari ★5 P6', 'gg wp everyone', 'Cleared 8-5 on Nightmare 🌸', 'wave 147 on 8-5 crimson moon', 'polka dot dress fan',
    'I love Aoi. Me too!', 'wait...me too', 'No.1 Luna fan', 'Rei > all', 'うちのひかりちゃん最高www', 'Sensei since 2026', 'Ver.2 build', 'oh hi. to be honest i like rei', 'St.Hikari academy',
    'GG! #1 Kaede fan', 'e.g. Luna or Nami', 'I play every day after school', '最高www.', 'lol www'];
  const refused = ['visit sakura.gg', 'discord.gg/abc', 'https://x.y', 'www.example.org', 'mail me hikari@gmail', 'hikari＠mail', 'add me @hikari_fan', 'Hikari#1234',
    'call 555-1234', '(555) 123 4567', '５５５１２３４５６７', 'my bday 2014/03/09', 'add me on d1sc0rd', 'my Snap Chat: hikari', 'sakura dot com', 'sakura (dot) gg', 'my insta hikari_fan',
    'kik me', 'sakura.com', 'ѕakura.com', 'yt: hikari', 'find me on tik tok', 'ig hikari_fan', 'ⓓⓘⓢⓒⓞⓡⓓ', 'w w w.sakura', 'www.sakura', 'hikari.io/me'];
  for (const s of allowed) ok((await sup('select profile_contact_free($1) as r', [s])).rows[0].r === true, `bio allowed: ${s}`);
  for (const s of refused) ok((await sup('select profile_contact_free($1) as r', [s])).rows[0].r === false, `bio refused: ${s}`);
  ok((await sup(`select profile_bio_ok($1) as r`, ['x'.repeat(81)])).rows[0].r === false, 'bio: 81 characters refused');
  ok((await sup(`select profile_bio_ok('') as r`)).rows[0].r === true, 'bio: empty allowed');
  ok((await sup(`select profile_bio_ok($1) as r`, ['hi​there'])).rows[0].r === false, 'bio: zero-width space refused (DM rules)');
}

// 5. bio writes, mute, visibility, blocks
{
  ok(/other apps/.test(await err(one(A, 'select set_profile_bio($1) as r', ['add me on discord'])) || ''), 'set_profile_bio refuses contact info with a readable message');
  const r1 = await one(A, 'select set_profile_bio($1) as r', ['Hikari is the best!']);
  ok(r1.bio === 'Hikari is the best!' && r1.bioHidden === false, 'set_profile_bio stores the bio');
  const v1 = await one(B, 'select profile_view($1) as r', [A]);
  ok(v1.profileWhy === null && v1.profile.bio === 'Hikari is the best!' && v1.profile.card.fav === 'hikari', 'B sees A (everyone)');
  ok(!('updatedAt' in (v1.profile || {})) && v1.own === null, 'no change time and no own state for others');
  ok(/^\d{4}-\d{2}$/.test(v1.since || ''), 'since is the join month only', v1.since);
  ok(v1.name === 'Aiko' && 'canMessage' in v1 && 'blockedByMe' in v1, 'profile_view carries the player card');

  const self = await one(A, 'select profile_view($1) as r', [A]);
  ok(self.own?.exists === true && self.own.visibility === 'everyone', 'own state on my own profile');
  const none = await one(C, 'select profile_view($1) as r', [D]);
  ok(none.profileWhy === 'none' && none.profile === null, 'no card yet → none');

  await one(A, `select set_profile_visibility('nobody') as r`);
  const vNobody = await one(B, 'select profile_view($1) as r', [A]);
  ok(vNobody.profileWhy === 'private' && vNobody.profile === null, 'nobody → private');
  await one(A, `select set_profile_visibility('friends_clan') as r`);
  ok((await one(B, 'select profile_view($1) as r', [A])).profileWhy === 'private', 'friends_clan, stranger → private');
  await sup(`insert into friends (user_id, friend_id) values ($1, $2), ($2, $1)`, [A, B]);
  ok((await one(B, 'select profile_view($1) as r', [A])).profileWhy === null, 'friends_clan, friend → shown');
  await sup(`delete from friends`);
  await one(A, `select set_profile_visibility('everyone') as r`);

  // A blocks B: B gets exactly the 'nobody' answer
  await one(A, 'select block_player($1) as r', [B]);
  const vBlocked = await one(B, 'select profile_view($1) as r', [A]);
  ok(vBlocked.profileWhy === 'private' && vBlocked.profile === null, 'blocked by the owner → private (same as nobody)');
  const vBlocker = await one(A, 'select profile_view($1) as r', [B]);
  ok(vBlocker.profileWhy === 'blocked_by_me' || vBlocker.profileWhy === 'none', 'the blocker → blocked_by_me', vBlocker.profileWhy);
  await one(A, 'select unblock_player($1) as r', [B]);

  // mute: bio edits refused, clearing allowed; owner mute hides the bio from others
  await sup(`insert into social_mutes (user_id, until, reason, created_by) values ($1, now() + interval '1 day', 't', 'owner')`, [A]);
  ok(/can't change your bio/.test(await err(one(A, 'select set_profile_bio($1) as r', ['new text here'])) || ''), 'muted → bio edit refused');
  ok((await one(B, 'select profile_view($1) as r', [A])).profile.bio === '', 'owner mute hides the bio from others');
  ok((await one(A, 'select profile_view($1) as r', [A])).own.bioHidden === true, 'the owner of the bio is told it is hidden');
  await sup(`delete from social_mutes`);
  ok((await one(B, 'select profile_view($1) as r', [A])).profile.bio === 'Hikari is the best!', 'mute lifted → bio back');
}

// 6. reports: evidence + auto-hide + lock
{
  // (profiles_before_write keeps created_at: age accounts with triggers off, like socialSchema.test.js)
  await db.exec(`set session_replication_role = replica; update profiles set created_at = now() - interval '3 days' where id in ('${B}', '${C}', '${D}', '${E}'); set session_replication_role = default;`);
  await one(B, `select report_player($1, 'inappropriate', '', 'profile', null) as r`, [A]);
  let ev = (await sup(`select evidence from reports where reporter_id = $1 and target_id = $2`, [B, A])).rows[0].evidence;
  ok(ev.profile?.bio === 'Hikari is the best!' && ev.profile.units.length === 8 && ev.profile.fav === 'hikari', 'report evidence holds the bio and card ids', ev.profile);
  ok(Array.isArray(ev.dms) && ev.target?.name === 'Aiko', 'social evidence untouched');
  // A edits; B reports again: the earlier bio stays in the evidence
  await one(A, 'select set_profile_bio($1) as r', ['Second bio']);
  await sup(`delete from rate_events where action = 'report'`);
  await one(B, `select report_player($1, 'bullying', '', 'profile', null) as r`, [A]);
  ev = (await sup(`select evidence from reports where reporter_id = $1 and target_id = $2`, [B, A])).rows[0].evidence;
  ok(ev.profile.bio === 'Second bio' && ev.profile.earlier.some((e) => e.bio === 'Hikari is the best!'), 'repeat report keeps the earlier bio', ev.profile.earlier);
  // the owner's review update does not fire / fail
  ok(await err(sup(`update reports set status = 'reviewed', updated_at = now() where reporter_id = $1`, [B])) === null, 'owner review update works');
  await sup(`update reports set status = 'open' where reporter_id = $1`, [B]);

  // a fresh alt (F, account < 1 day) does not count; C + D + B do
  await one(F, `select report_player($1, 'spam', '', 'profile', null) as r`, [A]);
  await one(C, `select report_player($1, 'spam', '', 'profile', null) as r`, [A]);
  ok((await one(E, 'select profile_view($1) as r', [A])).profile.bio === 'Second bio', '2 counted reporters + 1 fresh alt → still shown');
  await one(D, `select report_player($1, 'spam', '', 'profile', null) as r`, [A]);
  ok((await one(E, 'select profile_view($1) as r', [A])).profile.bio === '', '3 counted reporters → bio hidden');
  ok((await one(A, 'select my_profile_card() as r')).bioHidden === true, 'owner sees bioHidden');
  ok((await one(A, 'select set_profile_bio($1) as r', ['Second bio'])).bioHidden === true, 'the same bio again stays hidden');
  await one(A, 'select set_profile_bio($1) as r', ['Third bio']);
  ok((await one(E, 'select profile_view($1) as r', [A])).profile.bio === 'Third bio', 'a new bio shows again');
  // reports from before the change do not count; three new ones → second strike → locked
  for (const who of [B, C, D]) {
    await sup(`delete from rate_events where action = 'report'`);
    await one(who, `select report_player($1, 'spam', '', 'profile', null) as r`, [A]);
  }
  const own = await one(A, 'select my_profile_card() as r');
  ok(own.bioHidden === true && own.bioLockedUntil, 'second hide in 30 days → bio locked 7 days', own);
  ok(/can't change your bio/.test(await err(one(A, 'select set_profile_bio($1) as r', ['Fourth bio'])) || ''), 'locked → new bio refused');
  ok(await err(one(A, `select set_profile_bio('') as r`)) === null, 'locked → clearing still allowed');
}

// 7. rate limit: 1 per second
{
  await sup(`delete from rate_events where user_id = $1`, [C]);
  await one(C, 'select set_profile_card($1::jsonb, $2) as r', [JSON.stringify({ v: 1 }), 'c1']);
  const m = await err(one(C, 'select set_profile_card($1::jsonb, $2) as r', [JSON.stringify({ v: 1 }), 'c2']));
  ok(/rate_limited/.test(m || ''), 'publish twice in a second → rate_limited', m);
}

// 8. re-paste orders
{
  await db.exec(SOCIAL_SQL);
  const trg = (await sup(`select tgname from pg_trigger where tgrelid = 'public.reports'::regclass and not tgisinternal order by 1`)).rows.map((r) => r.tgname);
  ok(trg.includes('reports_profile_evidence') && trg.includes('reports_profile_hide'), 'social re-paste keeps the report triggers', trg);
  ok(await err(one(B, 'select profile_view($1) as r', [A])) === null, 'social re-paste keeps profile grants');
  await db.exec(ONLINE_SQL);
  const m = await err(one(B, 'select profile_version() as r'));
  ok(/permission denied/.test(m || ''), 'online re-paste revokes profile grants (needs_update in the game)', m);
  await db.exec(SOCIAL_SQL);
  await db.exec(PROFILE_SQL);
  ok(await one(B, 'select profile_version() as r') === 1, 'online → social → profile re-paste restores everything');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
