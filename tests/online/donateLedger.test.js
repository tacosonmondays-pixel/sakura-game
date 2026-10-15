// src/online/donateLedger.js — exactly-once donations and collects with a LOCAL save: escrow →
// finalize / refund, recovery through settle (voided → refund, applied → finalize), claim replay
// after a crash between any two steps, idempotency by key in every order, foreign accounts.
import { describe, it, expect } from 'vitest';
import {
  holdDonation, finalizeDonation, refundDonation, beginClaim, applyClaim, recoverLedger, ledgerState, ledgerBusy, newKey, cleanSocial, dismissForeign,
} from '../../src/online/donateLedger.js';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { itemCount } from '../../src/systems/inventory.js';

const K = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const fresh = () => {
  const p = createProfile();
  p.items.mat_feather_rare = 5;
  return p;
};
/** A save round trip, like a reload: what was saved is all that survives. */
const reload = (p) => migrateProfile(JSON.parse(JSON.stringify(p)));

describe('donation escrow', () => {
  it('hold moves the pieces out of the backpack; finalize pays the reward once', () => {
    const p = fresh();
    const coins = p.currencies.coins;
    expect(holdDonation(p, { key: K(1), uid: 'u1', requestId: 'r', item: 'mat_feather_rare', count: 3 })).toBe(true);
    expect(itemCount(p, 'mat_feather_rare')).toBe(2);
    expect(ledgerBusy(p)).toBe(true);
    expect(holdDonation(p, { key: K(1), uid: 'u1', requestId: 'r', item: 'mat_feather_rare', count: 1 })).toBe(false); // same key
    expect(holdDonation(p, { key: K(2), uid: 'u1', requestId: 'r', item: 'mat_feather_rare', count: 3 })).toBe(false); // only 2 left
    expect(finalizeDonation(p, K(1), { coins: 300 })).toBe(true);
    expect(finalizeDonation(p, K(1), { coins: 300 })).toBe(false); // a replayed answer
    expect(refundDonation(p, K(1))).toBe(false); // too late to refund
    expect(p.currencies.coins).toBe(coins + 300);
    expect(itemCount(p, 'mat_feather_rare')).toBe(2);
    expect(ledgerBusy(p)).toBe(false);
  });

  it('refund returns the pieces once and never after a finalize', () => {
    const p = fresh();
    holdDonation(p, { key: K(3), uid: 'u1', requestId: 'r', item: 'mat_feather_rare', count: 2 });
    expect(refundDonation(p, K(3))).toBe(true);
    expect(refundDonation(p, K(3))).toBe(false);
    expect(finalizeDonation(p, K(3), { coins: 100 })).toBe(false);
    expect(itemCount(p, 'mat_feather_rare')).toBe(5);
  });

  it('survives a reload at every step (the escrow is in the save)', () => {
    let p = fresh();
    holdDonation(p, { key: K(4), uid: 'u1', requestId: 'r', item: 'mat_feather_rare', count: 3 });
    p = reload(p);
    expect(p.social.escrow).toHaveLength(1);
    expect(itemCount(p, 'mat_feather_rare')).toBe(2);
    expect(finalizeDonation(p, K(4), { coins: 300 })).toBe(true);
    p = reload(p);
    expect(p.social.donated).toEqual([K(4)]);
    expect(finalizeDonation(p, K(4), { coins: 300 })).toBe(false);
  });

  it('recovery: applied → finalize with the reward, voided → refund, in-flight keys untouched, failures counted', async () => {
    const p = fresh();
    for (const [n, c] of [[5, 1], [6, 1], [7, 1]]) holdDonation(p, { key: K(n), uid: 'u1', requestId: 'r', item: 'mat_feather_rare', count: c });
    const calls = [];
    const backend = {
      settleDonations: async (keys) => {
        calls.push(keys);
        return keys.map((k) => (k === K(5) ? { key: k, state: 'applied', item: 'mat_feather_rare', count: 1, coins: 100 } : { key: k, state: 'voided' }));
      },
      claimDonations: async () => ({ items: [] }),
    };
    let saves = 0;
    const coins = p.currencies.coins;
    const out = await recoverLedger(p, backend, { uid: 'u1', save: () => saves++, inFlight: new Set([K(7)]) });
    expect(calls).toEqual([[K(5), K(6)]]);
    expect(out.finalized.map((r) => r.key)).toEqual([K(5)]);
    expect(out.refunded.map((r) => r.key)).toEqual([K(6)]);
    expect(p.currencies.coins).toBe(coins + 100);
    expect(itemCount(p, 'mat_feather_rare')).toBe(3); // 5 − 3 held + 1 refunded
    expect(p.social.escrow.map((e) => e.key)).toEqual([K(7)]);
    expect(saves).toBeGreaterThan(0);
    // a failing server keeps everything and counts the try
    const down = { settleDonations: async () => { throw new Error('Failed to fetch'); }, claimDonations: async () => ({}) };
    const o2 = await recoverLedger(p, down, { uid: 'u1' });
    expect(o2.failed).toBe(true);
    expect(p.social.escrow[0].tries).toBe(1);
  });

  it('entries of another online account are never refunded or finalized (two tabs share a save)', async () => {
    const p = fresh();
    holdDonation(p, { key: K(8), uid: 'other', requestId: 'r', item: 'mat_feather_rare', count: 2 });
    const backend = { settleDonations: async () => { throw new Error('must not be called'); }, claimDonations: async () => ({ items: [] }) };
    await recoverLedger(p, backend, { uid: 'me' });
    expect(itemCount(p, 'mat_feather_rare')).toBe(3);
    expect(ledgerState(p, 'me')).toMatchObject({ pending: 0, foreign: 1 });
    expect(dismissForeign(p, 'me')).toBe(true); // the player chose "Dismiss": no refund
    expect(itemCount(p, 'mat_feather_rare')).toBe(3);
    expect(ledgerState(p, 'me').foreign).toBe(0);
  });

  it('very old unconfirmed donations are given up without a refund (the server forgets keys after 90 days)', async () => {
    const p = fresh();
    holdDonation(p, { key: K(9), uid: 'u1', requestId: 'r', item: 'mat_feather_rare', count: 1, now: Date.now() - 81 * 86400000 });
    const out = await recoverLedger(p, { settleDonations: async () => [], claimDonations: async () => ({}) }, { uid: 'u1' });
    expect(out.gaveUp).toEqual([K(9)]);
    expect(itemCount(p, 'mat_feather_rare')).toBe(4);
  });
});

describe('collect (claim with a replayable key)', () => {
  const items = [{ item: 'mat_feather_rare', count: 6, from: ['Fumi', 'Gin'] }];

  it('applies once; a crash after the server answered replays the same key on the next start', async () => {
    let p = fresh();
    const key = beginClaim(p, { key: K(20), uid: 'u1' });
    expect(key).toBe(K(20));
    p = reload(p); // crash: the server stamped the donations, the answer never arrived
    expect(p.social.pendingClaim.key).toBe(K(20));
    const seen = [];
    const backend = { settleDonations: async () => [], claimDonations: async (k) => { seen.push(k); return { key: k, items, replayed: true }; } };
    const out = await recoverLedger(p, backend, { uid: 'u1' });
    expect(seen).toEqual([K(20)]);
    expect(out.claimed.added).toEqual([{ id: 'mat_feather_rare', count: 6 }]);
    expect(itemCount(p, 'mat_feather_rare')).toBe(11);
    expect(applyClaim(p, K(20), items)).toEqual([]); // a late duplicate answer
    expect(itemCount(p, 'mat_feather_rare')).toBe(11);
    p = reload(p);
    expect(p.social.pendingClaim).toBeNull();
    expect(p.social.claimed).toEqual([K(20)]);
  });

  it('an unfinished claim is reused instead of starting a new key; an expired replay is dropped', async () => {
    const p = fresh();
    beginClaim(p, { key: K(21), uid: 'u1' });
    expect(beginClaim(p, { key: K(22), uid: 'u1' })).toBe(K(21));
    await recoverLedger(p, { settleDonations: async () => [], claimDonations: async () => ({ items: [], expired: true }) }, { uid: 'u1' });
    expect(p.social.pendingClaim).toBeNull();
    expect(itemCount(p, 'mat_feather_rare')).toBe(5);
  });

  it('the save sanitizer keeps only well-formed ledger entries', () => {
    const s = cleanSocial({ escrow: [{ key: K(1), uid: 'u', item: 'mat_feather_rare', count: 2, at: 1 }, { key: 'x', uid: 'u', item: 'nope', count: 1 }, { key: K(2), uid: 'u', item: 'gems', count: 99999 }], donated: [K(3), 7], pendingClaim: { key: K(4), uid: 'u' }, claimed: 'bad' });
    expect(s.escrow).toHaveLength(1);
    expect(s.donated).toEqual([K(3)]);
    expect(s.pendingClaim).toMatchObject({ key: K(4), uid: 'u' });
    expect(s.claimed).toEqual([]);
    expect(newKey()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
