// Exactly-once Friend Points with a LOCAL wallet (missions.counters 'frp:bal'; the server never holds it), the
// donation ledger's pattern (src/online/donateLedger.js): every step is saved before the server call, every
// server answer is applied once by key, and a crash anywhere loses nothing and pays nothing twice. The ledger
// lives in profile.social.support; every helper here is pure over the profile and the caller saves at once.
//
// Borrower: battle start → beginBorrow(key) saved → server use_support(key) → markUsed (or a definitive refusal:
// dropBorrow, the battle just has no FP). Wave 3 (or a shorter stage won) → markDue saved → server
// settle_support(key) (the same key answers the same) → applySettle adds the borrower's FP once. A borrow whose
// use_support answer was lost is retried with the SAME key only while its game day is unchanged.
//
// Lender: Collect → beginSupportClaim(key, room) saved (room = 5,000 − wallet then) → server
// claim_support_points(key, room) (the same key replays the same total for 24 h) → applySupportClaim adds it once.
import { addFp, fpRoom } from '../systems/friendSupport.js';

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isKey = (v) => typeof v === 'string' && /^[0-9a-f-]{8,64}$/i.test(v);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Borrows waiting at once (a new battle beyond it drops the oldest unpaid one). */
export const BORROWS_MAX = 10;
export const SETTLED_KEEP = 50;
export const CLAIMED_KEEP = 20;

/** A fresh ledger. */
export function newSupportLedger() {
  return { borrows: [], settled: [], pendingClaim: null, claimed: [] };
}

/** Save sanitizer for profile.social.support (null when absent: an older save). */
export function cleanSupportLedger(raw) {
  if (!isObj(raw)) return null;
  const s = newSupportLedger();
  for (const b of Array.isArray(raw.borrows) ? raw.borrows : []) {
    if (!isObj(b) || !isKey(b.key) || typeof b.uid !== 'string' || !DAY_RE.test(String(b.day)) || typeof b.owner !== 'string' || typeof b.unitId !== 'string') continue;
    s.borrows.push({ key: b.key, uid: b.uid, day: b.day, owner: b.owner, unitId: b.unitId, at: Number(b.at) || 0, used: !!b.used, due: !!b.due });
  }
  s.borrows = s.borrows.slice(-BORROWS_MAX);
  s.settled = (Array.isArray(raw.settled) ? raw.settled.filter(isKey) : []).slice(-SETTLED_KEEP);
  s.claimed = (Array.isArray(raw.claimed) ? raw.claimed.filter(isKey) : []).slice(-CLAIMED_KEEP);
  const pc = raw.pendingClaim;
  if (isObj(pc) && isKey(pc.key) && typeof pc.uid === 'string') s.pendingClaim = { key: pc.key, uid: pc.uid, room: Math.max(0, Math.floor(Number(pc.room) || 0)), at: Number(pc.at) || 0 };
  return s;
}

function ledger(p) {
  p.social ||= {};
  if (!isObj(p.social.support)) p.social.support = newSupportLedger();
  const s = p.social.support;
  s.borrows ||= [];
  s.settled ||= [];
  s.claimed ||= [];
  if (s.pendingClaim === undefined) s.pendingClaim = null;
  return s;
}

/** The borrow of `key`, or null. */
export const borrowOf = (p, key) => (p?.social?.support?.borrows || []).find((b) => b.key === key) || null;

/** Battle start, step 1 (saved before use_support). @returns {boolean} recorded */
export function beginBorrow(p, { key, uid, day, owner, unitId, now = Date.now() }) {
  const s = ledger(p);
  if (!isKey(key) || !uid || !DAY_RE.test(String(day)) || !owner || !unitId) return false;
  if (s.borrows.some((b) => b.key === key) || s.settled.includes(key)) return false;
  s.borrows.push({ key, uid, day, owner, unitId, at: now, used: false, due: false });
  // a full ledger drops its oldest borrow that never reached wave 3 (nothing to pay there)
  while (s.borrows.length > BORROWS_MAX) {
    const i = s.borrows.findIndex((b) => !b.due);
    s.borrows.splice(i < 0 ? 0 : i, 1);
  }
  return true;
}

/** The server accepted the borrow (use_support answered). */
export function markUsed(p, key) {
  const b = borrowOf(p, key);
  if (!b || b.used) return false;
  b.used = true;
  return true;
}

/** The run reached wave 3 (or won a shorter stage): saved before settle_support. */
export function markDue(p, key) {
  const b = borrowOf(p, key);
  if (!b || b.due) return false;
  b.due = true;
  return true;
}

/** Forget a borrow that will never pay (a definitive refusal, or its day is over before wave 3). */
export function dropBorrow(p, key) {
  const s = ledger(p);
  const i = s.borrows.findIndex((b) => b.key === key);
  if (i < 0) return false;
  s.borrows.splice(i, 1);
  return true;
}

/**
 * settle_support answered for `key`: the borrower's FP go into the wallet once (clamped to 5,000).
 * @returns {number} FP added (0 on a replay already applied)
 */
export function applySettle(p, key, points) {
  const s = ledger(p);
  if (s.settled.includes(key)) {
    dropBorrow(p, key);
    return 0;
  }
  if (!borrowOf(p, key)) return 0;
  const added = addFp(p, points);
  dropBorrow(p, key);
  s.settled.push(key);
  if (s.settled.length > SETTLED_KEEP) s.settled.splice(0, s.settled.length - SETTLED_KEEP);
  return added;
}

/** Collect, step 1 (saved before the server call). Reuses an unfinished collect of this account. @returns {{ key, room }} */
export function beginSupportClaim(p, { key, uid, now = Date.now() }) {
  const s = ledger(p);
  const pc = s.pendingClaim;
  if (pc && pc.uid === uid && !s.claimed.includes(pc.key)) return { key: pc.key, room: pc.room };
  s.pendingClaim = { key, uid, room: fpRoom(p), at: now };
  return { key, room: s.pendingClaim.room };
}

/** Collect, step 2: the server's total for `key` goes into the wallet once. @returns {number} FP added */
export function applySupportClaim(p, key, total) {
  const s = ledger(p);
  if (s.claimed.includes(key)) {
    if (s.pendingClaim?.key === key) s.pendingClaim = null;
    return 0;
  }
  if (!s.pendingClaim || s.pendingClaim.key !== key) return 0;
  const added = addFp(p, total);
  s.claimed.push(key);
  if (s.claimed.length > CLAIMED_KEEP) s.claimed.splice(0, s.claimed.length - CLAIMED_KEEP);
  s.pendingClaim = null;
  return added;
}

/** Forget an unfinished collect (the server says the key is too old, or there was nothing). */
export function dropSupportClaim(p, key) {
  const s = ledger(p);
  if (s.pendingClaim?.key !== key) return false;
  s.pendingClaim = null;
  return true;
}

const definitive = (e) => !!e?.definitive && e.code !== 'rate_limited' && e.code !== 'offline';

/**
 * Finishes what this account left unfinished: due borrows are settled (use_support first when its answer was lost
 * and the day is unchanged), borrows of an earlier day that never reached wave 3 are dropped, an unfinished collect
 * is replayed by its key. `save()` runs after every change. Never throws.
 * @param {object} p profile
 * @param {{ useSupport: Function, settleSupport: Function, claimSupportPoints: Function }} backend
 * @param {{ uid: string, today: string, save?: () => void, inFlight?: Set<string> }} opts
 */
export async function recoverSupport(p, backend, { uid, today, save = () => {}, inFlight = new Set() }) {
  const out = { settled: [], dropped: [], claimed: null, failed: false, fp: 0 };
  if (!uid || !p?.social?.support) return out;
  const s = ledger(p);
  for (const b of [...s.borrows]) {
    if (b.uid !== uid || inFlight.has(b.key)) continue;
    if (!b.due) {
      if (b.day !== today) {
        dropBorrow(p, b.key);
        out.dropped.push(b.key);
        save();
      }
      continue;
    }
    try {
      if (!b.used) {
        if (b.day !== today) {
          dropBorrow(p, b.key);
          out.dropped.push(b.key);
          save();
          continue;
        }
        await backend.useSupport(b.owner, b.unitId, b.key, b.day);
        markUsed(p, b.key);
        save();
      }
      const r = await backend.settleSupport(b.key);
      const add = applySettle(p, b.key, r?.points);
      out.fp += add;
      out.settled.push({ key: b.key, points: add, paid: !!r?.paid, why: r?.why ?? null });
      save();
    } catch (e) {
      if (definitive(e)) {
        dropBorrow(p, b.key);
        out.dropped.push(b.key);
        save();
      } else out.failed = true;
    }
  }
  const pc = s.pendingClaim;
  if (pc && pc.uid === uid) {
    if (s.claimed.includes(pc.key)) {
      s.pendingClaim = null;
      save();
    } else {
      try {
        const r = await backend.claimSupportPoints(pc.key, pc.room);
        const add = applySupportClaim(p, pc.key, r?.total);
        out.fp += add;
        out.claimed = { key: pc.key, added: add };
        save();
      } catch (e) {
        if (definitive(e)) {
          dropSupportClaim(p, pc.key);
          save();
        } else out.failed = true;
      }
    }
  }
  return out;
}
