// JS mirror ≡ SQL: the bio vectors and the card shapes through both. cwd = /home/user/wt-social.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDb, MIGRATION_SQL } from '/home/user/wt-social/tests/online/pgHarness.js';
import { contactFree, bioError, validCard, CONTACT_PATTERNS, CONTACT_APPS, CONTACT_WORDS, cardHash } from './profileRules.sketch.js';

const HERE = new URL('.', import.meta.url).pathname;
const SQL = readFileSync(join(HERE, '20261016000000_profile.sql'), 'utf8');
const { db } = await createDb({ defaultGrants: true, sql: `${MIGRATION_SQL}\n${SQL}`, runs: 1 });
let fails = 0;
const ok = (c, l) => {
  if (!c) fails++;
  if (!c) console.log(`FAIL ${l}`);
};

for (const p of [...CONTACT_PATTERNS, CONTACT_APPS, CONTACT_WORDS]) ok(SQL.includes(p), `SQL contains pattern ${p}`);

const bios = ['Hikari is the best sensei!', 'Lv 60 Hikari ★5 P6', 'gg wp everyone', 'Cleared 8-5 on Nightmare 🌸', 'polka dot dress fan', 'I love Aoi. Me too!',
  'wait...me too', 'No.1 Luna fan', 'うちのひかりちゃん最高www', '最高www.', 'lol www', 'St.Hikari academy', 'GG! #1 Kaede fan', 'e.g. Luna or Nami', 'oh hi. to be honest i like rei',
  'visit sakura.gg', 'discord.gg/abc', 'https://x.y', 'www.example.org', 'w w w.sakura', 'mail me hikari@gmail', 'hikari＠mail', 'add me @hikari_fan', 'Hikari#1234',
  'call 555-1234', '(555) 123 4567', '５５５１２３４５６７', 'my bday 2014/03/09', 'add me on d1sc0rd', 'my Snap Chat: hikari', 'sakura dot com', 'sakura (dot) gg',
  'my insta hikari_fan', 'kik me', 'sakura.com', 'ѕakura.com', 'yt: hikari', 'find me on tik tok', 'ig hikari_fan', 'ⓓⓘⓢⓒⓞⓡⓓ', 'hikari.io/me', '8-5 8-4 8-3 8-2', 'my eye twitches', 'my twitch is hikari', 'oh snap', 'I am 12 years old', 'ABCD2345 add me',
  'Ｈｉｋａｒｉ．ｃｏｍ', 'hikari。com', 'DISCORD', 'Dïscörd', 'x'.repeat(80), 'x'.repeat(81), '', '   ', 'a​b', 'oḱ́́́́'];
let n = 0;
for (const s of bios) {
  const sql = (await db.query('select profile_contact_free($1) as c, profile_bio_ok($1) as b', [s])).rows[0];
  const js = { c: contactFree(s), b: bioError(s) === null };
  // SQL profile_bio_ok takes a trimmed bio ('   ' is not trimmed there: set_profile_bio trims first)
  const sqlB = s.trim() === s ? sql.b : (await db.query('select profile_bio_ok($1) as b', [s.trim()])).rows[0].b;
  ok(sql.c === js.c, `contact parity: ${JSON.stringify(s)} sql=${sql.c} js=${js.c}`);
  ok(sqlB === js.b, `bio parity: ${JSON.stringify(s)} sql=${sqlB} js=${js.b}`);
  n++;
}
console.log(`bio vectors compared: ${n}`);

// card shapes: every valid / invalid case through both
const gear = (s, main) => ({ s, r: 'legendary', l: 10, m: [main, 0.1234], x: [['critChance', 0.0512, 2], ['rangePct', 0.0421, 1], ['armorPen', 12.4], ['ratePct', 0.0333]] });
const unit = (id) => ({ id, lv: 60, bt: 5, aw: 5, p: 6, sk: `${id}_sentinel_school`, g: [gear('charm', 'atkPct'), gear('ribbon', 'critChance'), gear('shoes', 'ratePct')] });
const MAX = { v: 1, fav: 'hikari', ban: 'theme:festival', frm: 'eclipse', ttl: 'fp_crimson', units: ['hikari', 'luna', 'nami', 'aoi', 'rei', 'yuki', 'momo', 'akane'].map(unit),
  med: { a: [59, 59, 59, 59], r: [160, 160, 160, 160, 160], pins: ['8-5:nightmare', '1-1:hard:rush', '3-2:perfect', 'ach:a_bestiary_100'] },
  fp: { blossom: { w: 212, s: '5-4', c: 1 }, tempest: { w: 168, s: '8-1' }, crimson: { w: 121, s: 'boss-ashwing', c: 1 } }, st: { u: 19, s: 59, b: 100, k: 1234567 } };
const cards = [MAX, { v: 1 }, { v: 1, fav: null, fp: null }, { ...MAX, units: [...MAX.units, unit('kage')] }, { ...MAX, units: [unit('hikari'), unit('hikari')] },
  { ...MAX, gems: 1 }, { ...MAX, fav: 'Hikari!' }, { ...MAX, units: [{ ...unit('hikari'), lv: 0 }] }, { ...MAX, units: [{ ...unit('hikari'), lv: 59.5 }] },
  { ...MAX, units: [{ ...unit('hikari'), g: [gear('charm', 'atkPct'), gear('charm', 'atkPct')] }] }, { ...MAX, med: { a: [1, 2, 3] } }, { ...MAX, med: { pins: ['1-1:insane'] } },
  { ...MAX, ach: ['a_gold_40'] }, { ...MAX, v: 2 }, { ...MAX, fp: { crimson: { w: -1, s: '8-5' } } }, { ...MAX, units: [{ id: 'hikari', lv: 1, bt: 0, aw: 0, sk: null }] },
  { ...MAX, med: { pins: ['1-1:easy', '1-2:easy', '1-3:easy', '1-4:easy', '1-5:easy'] } }, { ...MAX, med: { pins: ['3-2:perfect', 'ach:a_gold_40', 'boss-ashwing:nightmare'] } },
  { ...MAX, med: { pins: ['ach:A_gold'] } }, { ...MAX, med: { r: [1, 2, 3, 4, 5, 6, 7, 8, 9] } }, { ...MAX, med: { r: [] } }, { ...MAX, fp: { w: 147, t: 'crimson', s: '8-5' } },
  { ...MAX, fp: { crimson: { w: 1, s: '8-5', c: 2 } } }, { ...MAX, fp: {} }, { ...MAX, st: { b: 101 } }, { ...MAX, st: { k: 2000000001 } }, { ...MAX, st: { u: 3.5 } },
  { ...MAX, units: [{ ...unit('hikari'), g: [{ ...gear('charm', 'atkPct'), x: [['atkPct', 0.01, 10]] }] }] },
  { ...MAX, units: [{ ...unit('hikari'), g: [{ ...gear('charm', 'atkPct'), m: ['atkPct', 0.1, 1] }] }] }];
for (const c of cards) {
  const sql = (await db.query('select valid_profile_card($1::jsonb) as r', [JSON.stringify(c)])).rows[0].r;
  ok(sql === validCard(c), `card parity ${JSON.stringify(c).slice(0, 80)} sql=${sql} js=${validCard(c)}`);
}
console.log(`cards compared: ${cards.length}; heaviest JSON ${JSON.stringify(MAX).length} B; hash ${cardHash(MAX)}`);
console.log(fails ? `${fails} FAILED` : 'parity: all equal');
process.exit(fails ? 1 : 0);
