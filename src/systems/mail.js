// Mailbox (Blue Archive style): letters with attached rewards, "Claim all", optional expiry
// (owner: systems). The first letter is the Beta Tester Thank-You gift (owner: "push out some
// rewards for beta players that tried the codex version… all new accounts until november 7th
// get a few free multis, a select ticket for an SSR, some materials, money and gems").
//
// Profile: profile.mail = { letters: Letter[], delivered: string[], legacy: boolean }
//   Letter = { id, from, title, body, rewards: [{id,count}], sentAt, expiresAt|null, claimed, claimedAt? }
//   delivered — ids ever delivered (a letter is never delivered twice, even after it is gone)
//   legacy    — the save existed before the mailbox did (it belongs to a beta player)
// Pure functions: no DOM.

import { addItems, normalizeList } from './inventory.js';
import { materialId, bookId } from '../data/items.js';
import { MATERIAL_FAMILIES } from '../data/types.js';

/** Most letters kept (oldest claimed letters are dropped first). */
export const MAIL_LIMIT = 60;

/**
 * Beta window: accounts created (or first opened) on or before 2026-11-07 23:59 America/Chicago.
 * US daylight time ends on 2026-11-01, so Nov 7 is CST (UTC−6): the window closes at
 * 2026-11-08 06:00 UTC (exclusive).
 */
export const BETA_DEADLINE = Date.UTC(2026, 10, 8, 6, 0, 0);
export const BETA_GIFT_ID = 'beta-thanks-2026';

/** A generous bundle of every material family plus books. */
function betaMaterials() {
  const out = [];
  for (const fam of Object.keys(MATERIAL_FAMILIES)) {
    out.push({ id: materialId(fam, 'common'), count: 30 });
    out.push({ id: materialId(fam, 'rare'), count: 15 });
    out.push({ id: materialId(fam, 'superRare'), count: 6 });
    out.push({ id: materialId(fam, 'mythic'), count: 2 });
  }
  out.push({ id: bookId('rare'), count: 30 }, { id: bookId('superRare'), count: 10 }, { id: bookId('mythic'), count: 3 });
  return out;
}

/** The Beta Tester Thank-You package. */
export const BETA_GIFT = {
  id: BETA_GIFT_ID,
  from: 'Sakura Academy Staff',
  title: 'Thank you, beta Sensei!',
  body: 'You were with us from the very first petals — including everyone who tried the original Codex version. '
    + 'As a thank-you for testing Sakura Sentinels, please accept five 10× Recruit Tickets, an SSR Select Ticket '
    + '(choose ANY SSR student you like), a big bundle of upgrade materials, coins and gems. '
    + 'We can\'t wait to see your academy grow!',
  rewards: [
    { id: 'ticket_recruit10', count: 5 },
    { id: 'ticket_ssr_select', count: 1 },
    { id: 'gems', count: 3000 },
    { id: 'coins', count: 300000 },
    ...betaMaterials(),
  ],
  expiresAt: null,
};

/** Fresh mailbox state. */
export function emptyMail() {
  return { letters: [], delivered: [], legacy: false };
}

function box(profile) {
  if (!profile.mail || typeof profile.mail !== 'object') profile.mail = emptyMail();
  profile.mail.letters ||= [];
  profile.mail.delivered ||= [];
  return profile.mail;
}

const ms = (t) => (t instanceof Date ? t.getTime() : Number(t));

/**
 * Deliver a letter once (by id). Returns the stored letter, or null if it was already delivered.
 * @param {object} profile
 * @param {{id:string, from?:string, title:string, body?:string, rewards?:object[], expiresAt?:number|null}} letter
 * @param {number|Date} [now]
 */
export function deliverMail(profile, letter, now = Date.now()) {
  const mb = box(profile);
  if (!letter?.id || mb.delivered.includes(letter.id)) return null;
  const entry = {
    id: letter.id,
    from: letter.from || 'Sakura Academy',
    title: letter.title || 'Mail',
    body: letter.body || '',
    rewards: normalizeList(letter.rewards || []),
    sentAt: ms(now),
    expiresAt: letter.expiresAt == null ? null : ms(letter.expiresAt),
    claimed: false,
  };
  mb.letters.unshift(entry);
  mb.delivered.push(letter.id);
  if (mb.letters.length > MAIL_LIMIT) {
    // drop the oldest claimed (then oldest) letters
    while (mb.letters.length > MAIL_LIMIT) {
      let i = mb.letters.map((l) => l.claimed).lastIndexOf(true);
      if (i < 0) i = mb.letters.length - 1;
      mb.letters.splice(i, 1);
    }
  }
  return entry;
}

const expired = (l, now) => l.expiresAt != null && ms(now) >= l.expiresAt;

/**
 * Letters, newest first, with display flags.
 * @returns {{ id, from, title, body, rewards, sentAt, expiresAt, claimed, expired: boolean, claimable: boolean }[]}
 */
export function mailList(profile, now = Date.now()) {
  return box(profile).letters.map((l) => {
    const ex = expired(l, now);
    return { ...l, rewards: l.rewards.map((r) => ({ ...r })), expired: ex, claimable: !l.claimed && !ex && l.rewards.length > 0 };
  });
}

/** @returns {number} letters with rewards still waiting */
export function unclaimedMailCount(profile, now = Date.now()) {
  return mailList(profile, now).filter((l) => l.claimable).length;
}

/**
 * Claim one letter's rewards.
 * @returns {{ ok: boolean, error?: 'unknown'|'claimed'|'expired', rewards: object[], letter?: object }}
 */
export function claimMail(profile, id, now = Date.now()) {
  const l = box(profile).letters.find((x) => x.id === id);
  if (!l) return { ok: false, error: 'unknown', rewards: [] };
  if (l.claimed) return { ok: false, error: 'claimed', rewards: [] };
  if (expired(l, now)) return { ok: false, error: 'expired', rewards: [] };
  l.claimed = true;
  l.claimedAt = ms(now);
  return { ok: true, rewards: addItems(profile, l.rewards), letter: l };
}

/**
 * Claim every claimable letter.
 * @returns {{ ok: boolean, count: number, rewards: object[] }} merged rewards
 */
export function claimAllMail(profile, now = Date.now()) {
  const all = [];
  let count = 0;
  for (const l of box(profile).letters) {
    if (l.claimed || expired(l, now) || !l.rewards.length) continue;
    const r = claimMail(profile, l.id, now);
    if (r.ok) {
      count++;
      all.push(...r.rewards);
    }
  }
  return { ok: count > 0, count, rewards: normalizeList(all) };
}

/**
 * Beta players: saves that existed before the mailbox (legacy) and every account created on or
 * before the deadline.
 */
export function isBetaEligible(profile, now = Date.now()) {
  if (profile?.mail?.legacy) return true;
  const created = Number.isFinite(profile?.createdAt) ? profile.createdAt : ms(now);
  return created < BETA_DEADLINE;
}

/**
 * Deliver the Beta Tester Thank-You letter once to eligible accounts (call on app start).
 * @returns {object|null} the delivered letter (null when not eligible or already delivered)
 */
export function ensureBetaGift(profile, now = Date.now()) {
  if (!isBetaEligible(profile, now)) return null;
  return deliverMail(profile, BETA_GIFT, now);
}

/** @returns {object|null} the beta letter while its rewards are still unclaimed */
export function pendingBetaGift(profile, now = Date.now()) {
  return mailList(profile, now).find((l) => l.id === BETA_GIFT_ID && l.claimable) || null;
}
