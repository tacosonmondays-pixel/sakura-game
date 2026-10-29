// The local adapter's FRIEND SUPPORT "server": the same rules as supabase/migrations/20261028000000_friend_support.sql
// over the local JSON document (state.support), mixed into createLocalDb() next to localSocial.js. It reuses
// social's relation helpers (friends with their `since`, blocks). Pure apart from the injected clock.
// `?support=0` (or `?social=0`) simulates the live project before the owner pastes the file.
import { OnlineError } from '../errors.js';
import { gameDay, nextDailyReset } from '../../core/reset.js';
import {
  SUPPORT_FP, BORROW_CAP, LEND_CAP, FP_WALLET_CAP, FRIEND_MIN_HOURS, ACCOUNT_MIN_DAYS, DEV_LAB_DAYS, UNCOLLECTED_DAYS, CLAIMED_KEEP_DAYS,
  CLAIM_REPLAY_HOURS, HOUSEKEEP_BATCH, LEND, validCardUnit,
} from '../supportRules.js';

const H = 3600000;
const DAY = 24 * H;
const HASH_RE = /^[0-9a-z]{1,16}$/;
const KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

/**
 * @param {{ tx: Function, rate: Function, now: () => number, enabled: () => boolean, devClanId: string,
 *   relations: { S: Function, isBlocked: Function, areFriends: Function } }} ctx
 */
export function createLocalSupport({ tx, rate, now, enabled, devClanId, relations: R }) {
  const fail = (c, msg, extra = {}) => {
    throw new OnlineError(c, msg, { ...extra, definitive: true });
  };
  const gate = () => {
    if (!enabled()) fail('needs_update', 'Needs the latest server update.');
  };
  const T = (s) => {
    s.support ||= {};
    const x = s.support;
    x.cards ||= {};
    x.uses ||= [];
    x.claims ||= {};
    x.seq ||= 1;
    return x;
  };
  const today = () => gameDay(now());
  const me = (s, uid) => {
    if (!s.users[uid]) fail('forbidden', 'sign in first');
    return s.users[uid];
  };
  const since = (s, a, b) => R.S(s).friends[a]?.[b] ?? null;
  const devLab = (s, u) => {
    const c = s.members[u]?.clanId;
    if (c && (c === devClanId || s.clans[c]?.isDev)) return true;
    return (R.S(s).devVisits[u] || 0) > now() - DEV_LAB_DAYS * DAY;
  };
  const uncollected = (x, u) => x.uses
    .filter((r) => r.ownerId === u && !r.claimKey && r.ownerPoints > 0 && r.settledAt != null && r.createdAt > now() - UNCOLLECTED_DAYS * DAY)
    .reduce((n, r) => n + r.ownerPoints, 0);
  function housekeeping(x) {
    let n = 0;
    x.uses = x.uses.filter((r) => {
      const old = (!r.claimKey && r.createdAt < now() - UNCOLLECTED_DAYS * DAY) || (r.claimedAt != null && r.claimedAt < now() - CLAIMED_KEEP_DAYS * DAY);
      if (old && n < HOUSEKEEP_BATCH) {
        n += 1;
        return false;
      }
      return true;
    });
    let m = 0;
    for (const [k, c] of Object.entries(x.claims)) {
      if (m >= HOUSEKEEP_BATCH) break;
      if (c.at < now() - CLAIMED_KEEP_DAYS * DAY) {
        delete x.claims[k];
        m += 1;
      }
    }
  }
  const useOut = (x, r, replayed) => {
    const c = x.cards[r.ownerId];
    return {
      key: r.key, owner: r.ownerId, unitId: r.unit, unit: c?.unit?.id === r.unit ? clone(c.unit) : null,
      paid: r.paid, why: r.why, day: r.gameDay, replayed, serverNow: now(),
    };
  };

  return {
    /** The deploy probe (SQL: support_version()). */
    supportProbe() {
      return enabled() ? 'ready' : 'needs_update';
    },

    setSupport(uid, unit, hash, lend = 'friends') {
      gate();
      return tx((s) => {
        me(s, uid);
        if (!LEND.includes(lend)) fail('invalid', 'unknown setting');
        if (!HASH_RE.test(String(hash ?? ''))) fail('invalid', 'bad support hash');
        if (unit != null && !validCardUnit(unit)) fail('invalid', 'that Support Student is not valid');
        rate(s, uid, 'support_set');
        T(s).cards[uid] = { unit: clone(unit ?? null), hash: String(hash), lend, updatedAt: now() };
        return { hash: String(hash), lend };
      });
    },

    mySupport(uid) {
      gate();
      return tx((s) => {
        const c = T(s).cards[uid];
        return { exists: !!c, unit: clone(c?.unit ?? null), hash: c?.hash || '', lend: c?.lend || 'friends', updatedAt: c?.updatedAt ?? null };
      }, { save: false });
    },

    supportCandidates(uid) {
      gate();
      return tx((s) => {
        me(s, uid);
        rate(s, uid, 'support_list');
        const x = T(s);
        const d = today();
        return Object.entries(R.S(s).friends[uid] || {})
          .map(([id, sinceAt]) => ({ id, sinceAt, c: x.cards[id], p: s.users[id] }))
          .filter(({ id, c, p }) => p && c && c.lend === 'friends' && c.unit && !R.isBlocked(R.S(s), uid, id))
          .map(({ id, sinceAt, c, p }) => {
            const lastActive = p.lastActive || 0;
            return {
              userId: id, name: p.name || 'Sensei', level: p.level || 1, avatar: p.avatar || 'hikari', lastActive, online: lastActive > now() - 5 * 60000,
              since: sinceAt, unit: clone(c.unit), hash: c.hash,
              paidToday: x.uses.some((r) => r.borrowerId === uid && r.ownerId === id && r.gameDay === d && r.paid),
            };
          })
          .sort((a, b) => Number(b.online) - Number(a.online) || Number(a.paidToday) - Number(b.paidToday) || a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
          .slice(0, 60);
      });
    },

    useSupport(uid, owner, unitId, key, day) {
      gate();
      return tx((s) => {
        const u = me(s, uid);
        const x = T(s);
        if (!key || !KEY_RE.test(key)) fail('invalid', 'missing support key');
        const old = x.uses.find((r) => r.borrowerId === uid && r.key === key);
        if (old) return useOut(x, old, true);
        const d = today();
        if (day !== d) fail('stale_day', 'that battle\'s day is over', { retryMs: nextDailyReset(now()) - now() });
        if (!owner || owner === uid || !unitId) fail('invalid', 'pick a friend\'s Support Student');
        rate(s, uid, 'support_use');
        const c = x.cards[owner];
        const sinceAt = since(s, uid, owner);
        if (sinceAt == null || !c || c.lend !== 'friends' || !c.unit || R.isBlocked(R.S(s), uid, owner)) fail('unavailable', 'That Support Student isn\'t available');
        if (c.unit.id !== unitId) fail('stale_card', 'That Support Student changed. Pick again.');
        const them = s.users[owner];
        const paidCount = (f) => x.uses.filter((r) => r.gameDay === d && r.paid && f(r)).length;
        let why = null;
        if (paidCount((r) => r.borrowerId === uid && r.ownerId === owner)) why = 'pair';
        else if (paidCount((r) => r.borrowerId === uid) >= BORROW_CAP) why = 'borrower_cap';
        else if (paidCount((r) => r.ownerId === owner) >= LEND_CAP) why = 'lender_cap';
        else if (sinceAt > now() - FRIEND_MIN_HOURS * H) why = 'new_friend';
        else if ((u.createdAt ?? now()) > now() - ACCOUNT_MIN_DAYS * DAY || (them?.createdAt ?? now()) > now() - ACCOUNT_MIN_DAYS * DAY) why = 'new_account';
        else if (devLab(s, uid) || devLab(s, owner)) why = 'dev_lab';
        const r = {
          id: x.seq++, borrowerId: uid, ownerId: owner, unit: unitId, gameDay: d, key, paid: why === null, why,
          settledAt: null, ownerPoints: 0, borrowerPoints: 0, claimKey: null, claimedAt: null, createdAt: now(),
        };
        x.uses.push(r);
        u.lastActive = now();
        housekeeping(x);
        return useOut(x, r, false);
      });
    },

    settleSupport(uid, key) {
      gate();
      return tx((s) => {
        me(s, uid);
        const x = T(s);
        if (!key) fail('invalid', 'missing support key');
        const r = x.uses.find((y) => y.borrowerId === uid && y.key === key);
        if (!r) fail('not_found', 'that borrow is gone');
        let replayed = true;
        if (r.settledAt == null) {
          replayed = false;
          r.settledAt = now();
          if (r.gameDay !== today()) {
            r.paid = false;
            r.why ||= 'void';
          } else {
            r.ownerPoints = r.paid ? SUPPORT_FP : 0;
            r.borrowerPoints = r.paid ? SUPPORT_FP : 0;
          }
        }
        return { key, paid: r.paid, why: r.why, points: r.borrowerPoints, replayed, serverNow: now() };
      });
    },

    supportState(uid) {
      gate();
      return tx((s) => {
        const x = T(s);
        const d = today();
        const c = x.cards[uid];
        return {
          day: d, serverNow: now(), nextReset: nextDailyReset(now()),
          card: { exists: !!c, unit: clone(c?.unit ?? null), hash: c?.hash || '', lend: c?.lend || 'friends' },
          borrowsPaid: x.uses.filter((r) => r.borrowerId === uid && r.gameDay === d && r.paid).length, borrowCap: BORROW_CAP,
          lentToday: x.uses.filter((r) => r.ownerId === uid && r.gameDay === d && r.paid).length * SUPPORT_FP, lendCap: LEND_CAP * SUPPORT_FP,
          uncollected: uncollected(x, uid),
        };
      }, { save: false });
    },

    claimSupportPoints(uid, key, room) {
      gate();
      return tx((s) => {
        me(s, uid);
        const x = T(s);
        if (!key) fail('invalid', 'missing collect key');
        const id = `${uid}|${key}`;
        const k = x.claims[id];
        if (k) {
          if (k.at < now() - CLAIM_REPLAY_HOURS * H) fail('stale_key', 'that collect is too old');
          return { key, total: k.total, replayed: true, left: uncollected(x, uid), serverNow: now() };
        }
        const cap = Math.min(FP_WALLET_CAP, Math.max(0, Math.floor(Number(room) || 0)));
        let total = 0;
        const rows = x.uses
          .filter((r) => r.ownerId === uid && !r.claimKey && r.ownerPoints > 0 && r.settledAt != null && r.createdAt > now() - UNCOLLECTED_DAYS * DAY)
          .sort((a, b) => a.settledAt - b.settledAt || a.id - b.id);
        for (const r of rows) {
          if (total + r.ownerPoints > cap) break;
          r.claimKey = key;
          r.claimedAt = now();
          total += r.ownerPoints;
        }
        if (total > 0) x.claims[id] = { total, at: now() };
        housekeeping(x);
        return { key, total, replayed: false, left: uncollected(x, uid), serverNow: now() };
      });
    },

    supportSummary(uid) {
      gate();
      return tx((s) => ({ uncollected: uncollected(T(s), uid) }), { save: false });
    },
  };
}
