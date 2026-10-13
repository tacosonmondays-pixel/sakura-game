// src/online/socialRules.js + donateRules.js — the pure rules both adapters and the SQL share.
import { describe, it, expect } from 'vitest';
import {
  bodyError, validMessageBody, validDmMeta, dmAllows, inviteBody, inviteStateOf, formatFriendCode, normalizeFriendCode, DM_PRIVACY,
  MESSAGE_INVISIBLE, nameLooksBlank, whyText, presenceText,
} from '../../src/online/socialRules.js';
import { validateName } from '../../src/online/clanRules.js';
import { donatableItems, requestRule, maxDonation, DONATE_RULES, donorReward, DONOR_DAILY_POINTS } from '../../src/online/donateRules.js';
import { ITEMS } from '../../src/data/items.js';

describe('message text rules (SQL: valid_dm_body; the chat guard trigger)', () => {
  it('refuses every format / control character except ZWJ / ZWNJ, plus line separators and blank fillers', () => {
    let refusedCount = 0;
    for (let c = 1; c <= 0x10ffff; c++) {
      if (c >= 0xd800 && c <= 0xdfff) continue;
      const ch = String.fromCodePoint(c);
      if (/[\p{Cf}\p{Cc}]/u.test(ch) && c !== 0x200c && c !== 0x200d && c !== 0x09 && c !== 0x0a && c !== 0x0d) {
        expect(MESSAGE_INVISIBLE.test(ch), `U+${c.toString(16)}`).toBe(true);
        refusedCount++;
      }
    }
    expect(refusedCount).toBeGreaterThan(150);
    for (const c of [0x2028, 0x2029, 0x3164, 0x115f, 0x1160, 0xffa0, 0x2800]) expect(MESSAGE_INVISIBLE.test(String.fromCodePoint(c))).toBe(true);
    expect(MESSAGE_INVISIBLE.test('\u200d')).toBe(false);
  });

  it('bodies: 1–200 characters, trimmed, visible, no stacked accents; emoji sequences fine', () => {
    expect(validMessageBody('Hi Bea! 🌸')).toBe(true);
    expect(validMessageBody('👩\u200d👩\u200d👧 family')).toBe(true);
    expect(validMessageBody('🏳\ufe0f\u200d🌈')).toBe(true);
    expect(validMessageBody('é'.repeat(200))).toBe(true);
    expect(validMessageBody('😀'.repeat(200))).toBe(true); // 200 code points
    for (const bad of ['', ' hi', 'hi ', 'x'.repeat(201), 'a\u202eb', 'a\u200bb', '\u2028', '\u3164', '\u200d\u200d', 'z\u0300\u0301\u0302\u0303\u0304']) {
      expect(validMessageBody(bad), JSON.stringify(bad)).toBe(false);
    }
    expect(bodyError('a\u202eb')).toMatch(/invisible/);
    expect(bodyError('   ')).toMatch(/Type a message/);
    expect(bodyError('x'.repeat(201))).toMatch(/1–200/);
    expect(bodyError(' hello ')).toBeNull(); // the client trims before sending
  });

  it('names must look like names', () => {
    for (const bad of ['Ai\u3164ko', '\u2800\u2800', 'A\u2028B', 'Zz\u0300\u0301\u0302\u0303\u0304']) expect(validateName(bad), bad).toBeTruthy();
    expect(validateName('Mika-chan 2')).toBeNull();
    expect(nameLooksBlank('\u3164\u3164')).toBe(true);
    expect(nameLooksBlank('桜ミカ')).toBe(false);
  });

  it('invite meta: exactly room, campaign stage, difficulty, expires', () => {
    const ok = { room: 'K7Q2Z', stage: '1-3', difficulty: 'hard', expires: 1760000000000 };
    expect(validDmMeta('invite', ok)).toBe(true);
    expect(validDmMeta('text', null)).toBe(true);
    expect(validDmMeta('text', ok)).toBe(false);
    for (const bad of [{ ...ok, stage: 'boss-lych' }, { ...ok, room: 'k7q2z' }, { ...ok, difficulty: 'insane' }, { ...ok, expires: '1' }, { ...ok, x: 1 }, null, ['K7Q2Z']]) {
      expect(validDmMeta('invite', bad), JSON.stringify(bad)).toBe(false);
    }
    expect(inviteBody('1-3', 'hard')).toBe('Co-op invite: stage 1-3 (Hard)');
  });

  it('privacy: no Everyone; a missing setting is the default; Nobody is nobody', () => {
    expect(DM_PRIVACY).toEqual(['friends_clan', 'friends', 'nobody']);
    expect(dmAllows(undefined, {})).toBe(false);
    expect(dmAllows(undefined, { clanmates: true })).toBe(true);
    expect(dmAllows('everyone', {})).toBe(false); // unknown → default
    expect(dmAllows('friends', { clanmates: true })).toBe(false);
    expect(dmAllows('friends', { friends: true })).toBe(true);
    expect(dmAllows('nobody', { friends: true, clanmates: true })).toBe(false);
  });

  it('invite state, friend codes, texts', () => {
    const meta = { expires: 1000 };
    expect(inviteStateOf({ meta, senderId: 'a', room: { hostId: 'a', guestId: null }, viewer: 'b', now: 999 })).toBe('open');
    expect(inviteStateOf({ meta, senderId: 'a', room: { hostId: 'a', guestId: 'c' }, viewer: 'b', now: 999 })).toBe('full');
    expect(inviteStateOf({ meta, senderId: 'a', room: { hostId: 'a', guestId: 'b' }, viewer: 'b', now: 999 })).toBe('open');
    expect(inviteStateOf({ meta, senderId: 'a', room: { hostId: 'z', guestId: null }, viewer: 'b', now: 999 })).toBe('closed');
    expect(inviteStateOf({ meta, senderId: 'a', room: null, viewer: 'b', now: 1001 })).toBe('expired');
    expect(formatFriendCode('k7q2zp4m')).toBe('K7Q2-ZP4M');
    expect(normalizeFriendCode(' k7q2-zp4m ')).toBe('K7Q2ZP4M');
    expect(whyText('not_allowed', 'Bea')).toMatch(/Bea can't get messages/);
    expect(presenceText(Date.now() - 1000)).toBe('Online');
    expect(presenceText(Date.now() - 3 * 3600000)).toBe('Active 3 h ago');
  });
});

describe('clan material requests (donateRules)', () => {
  it('28 requestable materials: every family, common → mythic, never legendary or anything else', () => {
    const items = donatableItems();
    expect(items).toHaveLength(28);
    expect(new Set(items.map((i) => i.rarity))).toEqual(new Set(['common', 'rare', 'superRare', 'mythic']));
    for (const id of Object.keys(ITEMS)) {
      const it = ITEMS[id];
      const allowed = it.category === 'material' && it.rarity !== 'legendary';
      expect(!!requestRule(id), id).toBe(allowed);
    }
    expect(requestRule('mat_feather_rare')).toMatchObject({ name: 'Swallow Plume', size: 6, perDonor: 3, points: 2 });
  });

  it('caps: request sizes need at least two donors (except mythic), 30 points a day', () => {
    for (const [r, rule] of Object.entries(DONATE_RULES)) {
      if (r !== 'mythic') expect(rule.perDonor * 2, r).toBeGreaterThanOrEqual(rule.size);
      expect(rule.size * rule.points, r).toBeLessThanOrEqual(DONOR_DAILY_POINTS);
    }
    const rule = requestRule('mat_rune_superRare');
    expect(maxDonation({ rule, remaining: 3, given: 0, have: 10, pointsLeft: 30 })).toBe(2);
    expect(maxDonation({ rule, remaining: 3, given: 1, have: 10, pointsLeft: 30 })).toBe(1);
    expect(maxDonation({ rule, remaining: 3, given: 0, have: 10, pointsLeft: 9 })).toBe(1);
    expect(maxDonation({ rule, remaining: 3, given: 0, have: 0, pointsLeft: 30 })).toBe(0);
    expect(donorReward(30)).toBe(1500);
  });
});
