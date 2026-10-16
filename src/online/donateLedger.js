// Exactly-once donations with a LOCAL save (the server never holds inventories). Two small
// ledgers live in the save, `profile.social`; every helper here is pure over the profile and the
// caller writes the save at once afterwards (store.saveNow(): one localStorage write = atomic).
//
// Donor: Donate → holdDonation() moves the pieces from the backpack into `escrow` → server
// donate(key) → finalizeDonation() (reward coins) or refundDonation(). Only a DEFINITIVE server
// refusal refunds at once (errors.js `definitive`); a lost answer keeps the escrow, and recovery
// asks settle_donations(keys), which voids a key the server never applied (a tombstone taken under
// the same lock as donate(), so a slow donate can never land after its void). The client refunds
// only after the server answered "voided" — never on a guess (SOCIAL_CRITIC #2, #3).
//
// Requester: Collect → beginClaim(key) is saved first → server claim_donations(key) stamps the
// donations with the key (the same key replays the same set) → applyClaim() adds the items and
// remembers the key. A crash anywhere loses nothing and pays nothing twice.
//
// Every step is idempotent by key (SOCIAL_CRITIC #12): finalize / refund only act while the key
// is still in escrow, finalize never twice; applyClaim never twice. Entries made under another
// online account (two local tabs share one save, or the auth session was lost) are left alone and
// reported as `foreign`, never refunded.
import { addItems, consumeItems, itemCount } from '../systems/inventory.js';
import { getItem } from '../data/items.js';
import { ESCROW_GIVE_UP_DAYS } from './donateRules.js';
import { track } from '../systems/missions.js';
import { newSocial, ESCROW_MAX, DONATED_KEEP, CLAIMED_KEEP, isKey } from './socialSave.js';

export { newSocial, cleanSocial } from './socialSave.js';

const DAY = 86400000;
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

function ledger(profile) {
  if (!isObj(profile.social)) profile.social = newSocial();
  const s = profile.social;
  s.escrow ||= [];
  s.donated ||= [];
  s.claimed ||= [];
  if (s.pendingClaim === undefined) s.pendingClaim = null;
  return s;
}

/** A random donation / claim key (uuid v4). */
export function newKey(rand = globalThis.crypto) {
  if (rand?.randomUUID) return rand.randomUUID();
  const b = new Uint8Array(16);
  if (rand?.getRandomValues) rand.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Is anything waiting for the server (a transfer code must not copy a save in this state)? */
export function ledgerBusy(profile) {
  const s = profile?.social;
  return !!(s && ((s.escrow && s.escrow.length) || s.pendingClaim));
}

/**
 * Takes `count` pieces out of the backpack into escrow. False when the player does not have them
 * (or too many donations are still unconfirmed).
 */
export function holdDonation(profile, { key, uid, requestId, item, count, now = Date.now() }) {
  const s = ledger(profile);
  const n = Math.floor(count);
  if (!isKey(key) || !uid || !(n >= 1) || s.escrow.length >= ESCROW_MAX) return false;
  if (s.escrow.some((e) => e.key === key) || s.donated.includes(key)) return false;
  if (itemCount(profile, item) < n || !consumeItems(profile, [{ id: item, count: n }])) return false;
  s.escrow.push({ key, uid, requestId: String(requestId || ''), item, count: n, at: now, tries: 0 });
  return true;
}

/**
 * The server applied the donation: drop the escrow entry and pay the reward. Idempotent: only
 * while the key is in escrow and was never finalized.
 * @returns {boolean} something changed
 */
export function finalizeDonation(profile, key, { coins = 0 } = {}) {
  const s = ledger(profile);
  const i = s.escrow.findIndex((e) => e.key === key);
  if (i < 0 || s.donated.includes(key)) return false;
  s.escrow.splice(i, 1);
  const c = Math.max(0, Math.floor(Number(coins) || 0));
  if (c) addItems(profile, [{ id: 'coins', count: c }]);
  s.donated.push(key);
  track(profile, 'donate', 1); // achievements (Lending a Hand, Generous Heart): once per finalized key
  if (s.donated.length > DONATED_KEEP) s.donated.splice(0, s.donated.length - DONATED_KEEP);
  return true;
}

/** The server refused or voided the donation: the pieces go back. Idempotent (escrow only). */
export function refundDonation(profile, key) {
  const s = ledger(profile);
  const i = s.escrow.findIndex((e) => e.key === key);
  if (i < 0 || s.donated.includes(key)) return false;
  const [e] = s.escrow.splice(i, 1);
  addItems(profile, [{ id: e.item, count: e.count }]);
  return true;
}

/** Collect, step 1 (saved before the server call). Reuses an unfinished claim of this account. */
export function beginClaim(profile, { key, uid, now = Date.now() }) {
  const s = ledger(profile);
  if (s.pendingClaim && s.pendingClaim.uid === uid && !s.claimed.includes(s.pendingClaim.key)) return s.pendingClaim.key;
  s.pendingClaim = { key, uid, at: now };
  return key;
}

/**
 * Collect, step 2: the server's answer for `key`. Adds the items once.
 * @param {{ item: string, count: number }[]} items
 * @returns {{ id: string, count: number }[]} what was added ([] on a replay already applied)
 */
export function applyClaim(profile, key, items = []) {
  const s = ledger(profile);
  if (s.claimed.includes(key)) {
    if (s.pendingClaim?.key === key) s.pendingClaim = null;
    return [];
  }
  if (!s.pendingClaim || s.pendingClaim.key !== key) return [];
  const list = (items || []).filter((x) => getItem(x?.item) && x.count > 0).map((x) => ({ id: x.item, count: Math.floor(x.count) }));
  const added = list.length ? addItems(profile, list) : [];
  s.claimed.push(key);
  if (s.claimed.length > CLAIMED_KEEP) s.claimed.splice(0, s.claimed.length - CLAIMED_KEEP);
  s.pendingClaim = null;
  return added;
}

/** Forget an unfinished claim (the server says it expired / there was nothing). */
export function dropClaim(profile, key) {
  const s = ledger(profile);
  if (s.pendingClaim?.key !== key) return false;
  s.pendingClaim = null;
  return true;
}

/** Forget unconfirmed entries of another online account (the player chose "Dismiss"). */
export function dismissForeign(profile, uid) {
  const s = ledger(profile);
  const before = s.escrow.length;
  s.escrow = s.escrow.filter((e) => e.uid === uid);
  const claimGone = s.pendingClaim && s.pendingClaim.uid !== uid;
  if (claimGone) s.pendingClaim = null;
  return before !== s.escrow.length || !!claimGone;
}

/** What the ledger still waits for, for the UI ("Checking your donation…"). */
export function ledgerState(profile, uid, now = Date.now()) {
  const s = profile?.social || newSocial();
  const mine = (s.escrow || []).filter((e) => e.uid === uid);
  return {
    pending: mine.length,
    pendingItems: mine.map((e) => ({ item: e.item, count: e.count, key: e.key, tries: e.tries || 0, old: now - e.at > ESCROW_GIVE_UP_DAYS * DAY })),
    foreign: (s.escrow || []).filter((e) => e.uid !== uid).length + (s.pendingClaim && s.pendingClaim.uid !== uid ? 1 : 0),
    claimPending: !!(s.pendingClaim && s.pendingClaim.uid === uid),
  };
}

/**
 * Settles everything this account left unfinished: escrow entries through settle_donations
 * (applied → finalize with the reward, voided → refund) and an unfinished claim through its key.
 * Keys in `inFlight` (a donate call still running in this tab) are skipped. `save()` runs after
 * every change. Never throws: a failure leaves the entries for the next try (and counts it).
 * @param {object} profile
 * @param {{ settleDonations: Function, claimDonations: Function }} backend
 * @param {{ uid: string, save: () => void, inFlight?: Set<string>, now?: number }} opts
 */
export async function recoverLedger(profile, backend, { uid, save = () => {}, inFlight = new Set(), now = Date.now() }) {
  const s = ledger(profile);
  const out = { finalized: [], refunded: [], gaveUp: [], claimed: null, failed: false };
  if (!uid) return out;
  // too old to settle safely (the server forgets keys after 90 days): never refund, just stop waiting
  for (const e of [...s.escrow]) {
    if (e.uid === uid && now - e.at > ESCROW_GIVE_UP_DAYS * DAY) {
      s.escrow.splice(s.escrow.indexOf(e), 1);
      out.gaveUp.push(e.key);
    }
  }
  if (out.gaveUp.length) save();
  const keys = s.escrow.filter((e) => e.uid === uid && !inFlight.has(e.key)).map((e) => e.key).slice(0, 20);
  if (keys.length) {
    try {
      const rows = await backend.settleDonations(keys);
      for (const r of rows || []) {
        if (inFlight.has(r.key)) continue;
        if (r.state === 'applied' && finalizeDonation(profile, r.key, { coins: r.coins })) out.finalized.push(r);
        else if (r.state === 'voided' && refundDonation(profile, r.key)) out.refunded.push(r);
      }
    } catch {
      out.failed = true;
      for (const e of s.escrow) if (keys.includes(e.key)) e.tries = (e.tries || 0) + 1;
    }
    save();
  }
  const pc = s.pendingClaim;
  if (pc && pc.uid === uid) {
    if (s.claimed.includes(pc.key)) {
      s.pendingClaim = null;
      save();
    } else {
      try {
        const r = await backend.claimDonations(pc.key);
        if (r?.expired || !r?.items?.length) dropClaim(profile, pc.key);
        else out.claimed = { key: pc.key, added: applyClaim(profile, pc.key, r.items), from: r.items };
        save();
      } catch {
        out.failed = true;
      }
    }
  }
  return out;
}
