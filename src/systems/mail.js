// Mailbox (academy style): letters with attached rewards, "Claim all", optional expiry
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
import { UNITS } from '../data/units.js';
import { potentialLevel, potentialStepInfo, BACKFILL_MARKER, MAX_POTENTIAL, V3_MARKER, NEW_PREFIX } from './potential.js';
import { potentialLevelCap, levelCapAt, MAX_BREAKTHROUGH, MAX_LEVEL, BREAKTHROUGH_LEVEL_CAP, BASE_GATES } from './progression.js';
import { FREEPLAY_REWARDS } from '../online/coop/rewards.js';
import { HONOR_REWARD_PREFIX, HONOR_GIFT_MARK } from './profileHonors.js';

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
    + '(choose any SSR student you like), a big bundle of upgrade materials, coins and gems. '
    + 'We can\'t wait to see your academy grow! (LR units arrive only through their LR Banners.)',
  rewards: [
    { id: 'ticket_recruit10', count: 5 },
    { id: 'ticket_ssr_select', count: 1 },
    { id: 'gems', count: 3000 },
    { id: 'coins', count: 300000 },
    ...betaMaterials(),
  ],
  expiresAt: null,
};

/**
 * [banners G0] The Beta letter once promised "ANY SSR"; LR units cannot be chosen with a Select Ticket
 * (BANNERS §I.1 Beta letter fix, J13). A stored copy with the old wording is rewritten on load (cleanMail):
 * the check is on the text itself, so it happens exactly once and never touches a letter already amended.
 */
export function amendBetaLetter(letter) {
  if (letter?.id !== BETA_GIFT_ID || typeof letter.body !== 'string' || !letter.body.includes('choose ANY SSR')) return false;
  letter.body = BETA_GIFT.body;
  return true;
}

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
  return { ok: true, rewards: payRewards(profile, l.rewards), letter: l };
}

/**
 * A letter's rewards into the save: items and currencies to the Backpack, an 'honor:<achId>' reward as that Honor
 * Ribbon (the 'hgift:' counter mark; the ribbon only, never the achievement). Returns every reward paid.
 */
function payRewards(profile, rewards) {
  const list = normalizeList(rewards);
  const c = ((profile.missions ||= {}).counters ||= {});
  for (const r of list) if (r.id.startsWith(HONOR_REWARD_PREFIX)) c[HONOR_GIFT_MARK + r.id.slice(HONOR_REWARD_PREFIX.length)] = 1;
  addItems(profile, list.filter((r) => !r.id.startsWith(HONOR_REWARD_PREFIX)));
  return list;
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

/**
 * How the Notice board shows the beta gift: 'active' (new accounts still qualify — "Until Nov 7"),
 * 'unclaimed' (the window closed but this player's letter still waits in the Mail) or 'ended'
 * (window closed, nothing to claim: the article is hidden).
 * @returns {'active'|'unclaimed'|'ended'}
 */
export function betaNoticeState(profile, now = Date.now()) {
  if (ms(now) < BETA_DEADLINE) return 'active';
  return pendingBetaGift(profile, now) ? 'unclaimed' : 'ended';
}

/**
 * v1's one-time letter ("New: Potential!", v0.1.34, to saves whose duplicates were counted from the
 * recruit history). Not sent any more; its id stays because old saves list it in `delivered`.
 */
export const POTENTIAL_LETTER_ID = 'potential-arrived-1';
/** The one-time Potential v3 letter ("Potential grew!", docs/specs/POTENTIAL.md v3 §12). */
export const POTENTIAL_V3_LETTER_ID = 'potential-v3-1';
const POTENTIAL_LETTER_NAMES = 12;

/**
 * One girl's line: "Kage P5 ✦ Moonpiercer", plus " · level cap 78" where her own cap is that: all five
 * breakthrough gates open (below gate 5 her cap is the gates' 10 + 10 × gates, so no cap is named) and
 * Potential raising it above P1's. `unitState` is her save state (none: every gate counts as open).
 */
export function potentialLetterLine(def, p, unitState = null) {
  const info = p >= 2 ? potentialStepInfo(def, p) : null;
  const gates = unitState ? Math.max(0, Math.floor(Number(unitState.breakthrough) || 0)) : MAX_BREAKTHROUGH;
  // her cap once she is past gate 5 (gates 6–10 raise it with her Potential, ASCENSION.md §B)
  const cap = gates >= BASE_GATES ? levelCapAt(gates, p) : null;
  const step = info ? (info.kit ? ` ${info.brief}` : ` (${info.brief})`) : '';
  return `${def.name} P${p}${step}${cap != null && cap > potentialLevelCap(1) ? ` · level cap ${cap}` : ''}`;
}

/**
 * The Potential v3 letter's text (v3 §12): every girl at P2+, highest first (12 names, then "and N
 * more"), each with her newest step and her level cap. A save whose duplicates were counted from
 * the recruit history and never got v1's letter also reads how they were counted.
 * @returns {object|null} the letter, or null when no girl is at P2+
 */
export function potentialLetter(profile) {
  const girls = UNITS.map((u, i) => ({ u, i, p: profile.units?.[u.id] ? potentialLevel(profile.units[u.id]) : 0 }))
    .filter((g) => g.p >= 2)
    .sort((a, b) => b.p - a.p || a.i - b.i);
  if (!girls.length) return null;
  const names = girls.slice(0, POTENTIAL_LETTER_NAMES).map((g) => potentialLetterLine(g.u, g.p, profile.units[g.u.id]));
  const more = girls.length - names.length;
  const estimated = profile.seenIntro?.includes(BACKFILL_MARKER) && !profile.mail?.delivered?.includes(POTENTIAL_LETTER_ID);
  return {
    id: POTENTIAL_V3_LETTER_ID,
    from: 'Sakura Academy Staff',
    title: 'Potential grew!',
    body: `Every duplicate gives a girl Essence to raise her Potential by 1, from P1 up to P${MAX_POTENTIAL}, and from today every step makes her `
      + 'much stronger: a stat boost at every step and, from P3 (from P2 for SSR girls and heroes), a new trick built on what she '
      + `does best, up to her capstone at P${MAX_POTENTIAL}. Your girls keep their Potential and have every step they earned, right away: `
      + `${names.join(', ')}${more > 0 ? `, and ${more} more` : ''}. `
      + (estimated ? 'We counted the duplicates in your recruit history; for recruits older than your last 100 we estimated (average luck for R and SR girls, a cautious guess for SSR girls). ' : '')
      + `Every step also opens a new level gate past ${BREAKTHROUGH_LEVEL_CAP}, up to level ${MAX_LEVEL} at P${MAX_POTENTIAL}; `
      + `each level above ${BREAKTHROUGH_LEVEL_CAP} uses one Akashic Tome (from Library Courtyard III on Nightmare, Freeplay caches (up to ${FREEPLAY_REWARDS.cacheTome.weeklyCap} a week), `
      + 'the Bounty Exchange and Titan Trials). '
      + 'Nothing got weaker: P1 is exactly the girl you know. You can see each girl\'s steps on her Info tab.',
    rewards: [],
    expiresAt: null,
  };
}

/**
 * The first app start of a v3 build (call on app start, next to ensureBetaGift, and after a reset or
 * an import): marks the save (seenIntro 'potential-v3'; createProfile marks new saves, so only a
 * save made by an older build reaches the rest) and, when some girl is at P2+, delivers the
 * "Potential grew!" letter once and gives each of those girls the one-time NEW badge on her card.
 * No rewards.
 * @returns {object|null} the delivered letter
 */
export function ensurePotentialLetter(profile, now = Date.now()) {
  if (!profile) return null;
  const seen = (profile.seenIntro ||= []);
  const fresh = !seen.includes(V3_MARKER);
  const delivered = box(profile).delivered;
  // (the letter reads whether v1's letter came, for its "we counted" sentence, before the mark below)
  const letter = fresh && !delivered.includes(POTENTIAL_V3_LETTER_ID) ? potentialLetter(profile) : null;
  // a backfilled save never gets v1's letter now: mark it sent (on every call, so a save backfilled
  // after its v3 mark is covered too), or a build from before v3 (which mails it to every backfilled
  // save without it) would send the outdated "small passive" text after ours
  if (seen.includes(BACKFILL_MARKER) && !delivered.includes(POTENTIAL_LETTER_ID)) delivered.push(POTENTIAL_LETTER_ID);
  if (!fresh) return null;
  seen.push(V3_MARKER);
  if (!letter) return null;
  for (const u of UNITS) {
    const st = profile.units?.[u.id];
    if (st && potentialLevel(st) >= 2 && !seen.includes(NEW_PREFIX + u.id)) seen.push(NEW_PREFIX + u.id);
  }
  return deliverMail(profile, letter, now);
}

/** Ascension's switch-over letter (docs/specs/ASCENSION.md §A.7): no rewards (the pouch was paid into the Backpack). */
export const ESSENCE_LETTER_ID = 'essence-arrived-1';

/**
 * Once, to a save the Essence migration ran on (missions.counters 'ess:pouch' > 0): explains the
 * switch and the welcome pouch it already paid. A fresh save is born on Essence (no pouch, no letter).
 * @returns {object|null} the delivered letter
 */
export function ensureEssenceLetter(profile, now = Date.now()) {
  const pouch = Math.floor(Number(profile?.missions?.counters?.['ess:pouch']) || 0);
  if (!pouch || box(profile).delivered.includes(ESSENCE_LETTER_ID)) return null;
  const mementos = Math.floor(pouch / 1000);
  const moonpearls = pouch % 1000;
  return deliverMail(profile, {
    id: ESSENCE_LETTER_ID,
    from: 'Sakura Academy Staff',
    title: 'Duplicates are now Essence!',
    body: 'From today every duplicate gives that girl 1 Essence. Use Essence and coins to raise her Potential on her page, '
      + 'then break her new level gates (up to level 85) with materials from the new Titan Trials. '
      + 'Every Potential step your girls had already earned is unlocked for free, and extra copies became Mementos and Moonpearls '
      + `for the new Memento Exchange in the Mall: ${mementos} Mementos and ${moonpearls} Moonpearls are already in your Backpack.`,
    rewards: [],
    expiresAt: null,
  }, now);
}
