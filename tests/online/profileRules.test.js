// Sensei Profile rules (docs/specs/PROFILE.md §7.1, §8): the bio filter, the card shape and the hash.
// The vectors are the ones parity.mjs proved equal to the SQL (docs/specs/profile/).
import { describe, it, expect } from 'vitest';
import { bioError, contactFree, validCard, cardHash, profileFlat, BIO_MAX, PIN_RE } from '../../src/online/profileRules.js';
import { QUICK_LINES } from '../../src/data/profileArt.js';

const ALLOWED = ['Hikari is the best sensei!', 'Lv 60 Hikari ★5 P6', 'gg wp everyone', 'Cleared 8-5 on Nightmare 🌸', 'polka dot dress fan', 'I love Aoi. Me too!',
  'wait...me too', 'No.1 Luna fan', 'うちのひかりちゃん最高www', '最高www.', 'lol www', 'St.Hikari academy', 'GG! #1 Kaede fan', 'e.g. Luna or Nami',
  'oh hi. to be honest i like rei', 'my eye twitches', 'I am 12 years old', 'ABCD2345 add me', 'x'.repeat(80), '', '   '];
const REFUSED = ['visit sakura.gg', 'discord.gg/abc', 'https://x.y', 'www.example.org', 'w w w.sakura', 'mail me hikari@gmail', 'hikari＠mail', 'add me @hikari_fan',
  'Hikari#1234', 'call 555-1234', '(555) 123 4567', '５５５１２３４５６７', 'my bday 2014/03/09', 'add me on d1sc0rd', 'my Snap Chat: hikari', 'sakura dot com',
  'sakura (dot) gg', 'my insta hikari_fan', 'kik me', 'sakura.com', 'ѕakura.com', 'yt: hikari', 'find me on tik tok', 'ig hikari_fan', 'ⓓⓘⓢⓒⓞⓡⓓ', 'hikari.io/me',
  'Ｈｉｋａｒｉ．ｃｏｍ', 'hikari。com', 'DISCORD', 'Dïscörd', 'x'.repeat(81), 'a​b'];
// accepted false positives: the message says what to change
const FALSE_POSITIVES = ['8-5 8-4 8-3 8-2', 'oh snap', 'my twitch is hikari'];

describe('bioError', () => {
  it.each(ALLOWED)('allows %j', (s) => expect(bioError(s)).toBeNull());
  it.each(REFUSED)('refuses %j', (s) => expect(bioError(s)).toBeTypeOf('string'));
  it.each(FALSE_POSITIVES)('refuses the known false positive %j', (s) => expect(contactFree(s)).toBe(false));
  it('gives the player-facing messages', () => {
    expect(bioError('x'.repeat(BIO_MAX + 1))).toBe('Bios are up to 80 characters.');
    expect(bioError('hi‮there')).toBe('Bios can\'t contain invisible characters.');
    expect(bioError('discord.gg/x')).toBe('Keep links, e-mails, @names, phone numbers and other apps out of your bio.');
  });
  it('flattens look-alikes before matching', () => {
    expect(profileFlat('ѕakura')).toBe('sakura');
  });
  it('every Quick line passes', () => {
    for (const q of QUICK_LINES) expect(bioError(q)).toBeNull();
  });
});

const gear = (s, main) => ({ s, r: 'legendary', l: 10, m: [main, 0.1234], x: [['critChance', 0.0512, 2], ['rangePct', 0.0421, 1], ['armorPen', 12.4], ['ratePct', 0.0333]] });
const unit = (id) => ({ id, lv: 60, bt: 5, aw: 5, p: 6, sk: `${id}_sentinel_school`, g: [gear('charm', 'atkPct'), gear('ribbon', 'critChance'), gear('shoes', 'ratePct')] });
const MAX = {
  v: 1, fav: 'hikari', ban: 'theme:festival', frm: 'eclipse', ttl: 'fp_crimson', units: ['hikari', 'luna', 'nami', 'aoi', 'rei', 'yuki', 'momo', 'akane'].map(unit),
  med: { a: [59, 59, 59, 59], r: [160, 160, 160, 160, 160], pins: ['8-5:nightmare', '1-1:hard:rush', '3-2:perfect', 'ach:a_bestiary_100'] },
  fp: { blossom: { w: 212, s: '5-4', c: 1 }, tempest: { w: 168, s: '8-1' }, crimson: { w: 121, s: 'boss-ashwing', c: 1 } }, st: { u: 19, s: 59, b: 100, k: 1234567, h: 32 },
};

describe('validCard (the 29 parity shapes)', () => {
  const VALID = [MAX, { v: 1 }, { v: 1, fav: null, fp: null }, { ...MAX, units: [{ id: 'hikari', lv: 1, bt: 0, aw: 0, sk: null }] },
    { ...MAX, med: { pins: ['3-2:perfect', 'ach:a_gold_40', 'boss-ashwing:nightmare'] } }, { ...MAX, fp: {} }];
  const INVALID = [{ ...MAX, units: [...MAX.units, unit('kage')] }, { ...MAX, units: [unit('hikari'), unit('hikari')] }, { ...MAX, gems: 1 }, { ...MAX, fav: 'Hikari!' },
    { ...MAX, units: [{ ...unit('hikari'), lv: 0 }] }, { ...MAX, units: [{ ...unit('hikari'), lv: 59.5 }] },
    { ...MAX, units: [{ ...unit('hikari'), g: [gear('charm', 'atkPct'), gear('charm', 'atkPct')] }] }, { ...MAX, med: { a: [1, 2, 3] } }, { ...MAX, med: { pins: ['1-1:insane'] } },
    { ...MAX, ach: ['a_gold_40'] }, { ...MAX, v: 2 }, { ...MAX, fp: { crimson: { w: -1, s: '8-5' } } },
    { ...MAX, med: { pins: ['1-1:easy', '1-2:easy', '1-3:easy', '1-4:easy', '1-5:easy'] } }, { ...MAX, med: { pins: ['ach:A_gold'] } },
    { ...MAX, med: { r: [1, 2, 3, 4, 5, 6, 7, 8, 9] } }, { ...MAX, med: { r: [] } }, { ...MAX, fp: { w: 147, t: 'crimson', s: '8-5' } },
    { ...MAX, fp: { crimson: { w: 1, s: '8-5', c: 2 } } }, { ...MAX, st: { b: 101 } }, { ...MAX, st: { k: 2000000001 } }, { ...MAX, st: { u: 3.5 } },
    { ...MAX, units: [{ ...unit('hikari'), g: [{ ...gear('charm', 'atkPct'), x: [['atkPct', 0.01, 10]] }] }] },
    { ...MAX, units: [{ ...unit('hikari'), g: [{ ...gear('charm', 'atkPct'), m: ['atkPct', 0.1, 1] }] }] }];
  it('has 29 shapes', () => expect(VALID.length + INVALID.length).toBe(29));
  it.each(VALID.map((c, i) => [i, c]))('accepts shape %i', (_, c) => expect(validCard(c)).toBe(true));
  it.each(INVALID.map((c, i) => [i, c]))('refuses shape %i', (_, c) => expect(validCard(c)).toBe(false));
  it('accepts the Honor Ribbon count st.h (0–999) and refuses more', () => {
    expect(validCard({ v: 1, st: { h: 0 } })).toBe(true);
    expect(validCard({ v: 1, st: { h: 1000 } })).toBe(false);
  });
  it('refuses text where an id belongs', () => {
    expect(validCard({ v: 1, ttl: 'add me on discord' })).toBe(false);
    expect(PIN_RE.test('ach:add me')).toBe(false);
  });
  it('the heaviest card stays well under the budget', () => expect(JSON.stringify(MAX).length).toBeLessThan(6000));
});

describe('cardHash', () => {
  it('is stable and short base 36', () => {
    expect(cardHash(MAX)).toBe(cardHash(JSON.parse(JSON.stringify(MAX))));
    expect(cardHash(MAX)).toMatch(/^[0-9a-z]{1,16}$/);
    expect(cardHash({ v: 1 })).not.toBe(cardHash({ v: 1, fav: 'luna' }));
  });
});
