// profile.social: the donation / collect ledgers kept in the local save (src/online/donateLedger.js
// explains them). Sanitizer only, so src/systems/save.js stays light; no SAVE_VERSION bump (an
// older build simply ignores the block).
import { getItem } from '../data/items.js';
import { cleanSupportLedger } from './supportLedger.js';

export const ESCROW_MAX = 20;
export const DONATED_KEEP = 50;
export const CLAIMED_KEEP = 20;

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
export const isKey = (v) => typeof v === 'string' && /^[0-9a-f-]{8,64}$/i.test(v);

/** @returns {{ escrow: object[], donated: string[], pendingClaim: object|null, claimed: string[] }} */
export function newSocial() {
  return { escrow: [], donated: [], pendingClaim: null, claimed: [] };
}

/** Save sanitizer for profile.social. */
export function cleanSocial(raw) {
  const s = newSocial();
  if (!isObj(raw)) return s;
  if (Array.isArray(raw.escrow)) {
    for (const e of raw.escrow) {
      if (!isObj(e) || !isKey(e.key) || typeof e.uid !== 'string' || !getItem(e.item)) continue;
      const count = Math.floor(Number(e.count));
      if (!(count >= 1 && count <= 1000)) continue;
      s.escrow.push({ key: e.key, uid: e.uid, requestId: String(e.requestId || ''), item: e.item, count, at: Number(e.at) || 0, tries: Math.max(0, Math.floor(Number(e.tries) || 0)) });
    }
    s.escrow = s.escrow.slice(-ESCROW_MAX);
  }
  s.donated = (Array.isArray(raw.donated) ? raw.donated.filter(isKey) : []).slice(-DONATED_KEEP);
  s.claimed = (Array.isArray(raw.claimed) ? raw.claimed.filter(isKey) : []).slice(-CLAIMED_KEEP);
  const pc = raw.pendingClaim;
  if (isObj(pc) && isKey(pc.key) && typeof pc.uid === 'string') s.pendingClaim = { key: pc.key, uid: pc.uid, at: Number(pc.at) || 0 };
  // [friend support] the Friend Points ledger (src/online/supportLedger.js), only once there is one
  const sup = cleanSupportLedger(raw.support);
  if (sup) s.support = sup;
  return s;
}
