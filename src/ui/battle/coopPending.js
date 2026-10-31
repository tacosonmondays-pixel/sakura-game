// Co-op orders in flight (display only). A co-op order runs on both screens a fixed input delay
// after the tap (0.5 s on Supabase rooms, up to 1 s after a quiet spell: src/data/coop.js
// COOP_NET), so without this the tap seems to do nothing for that long. While a placement,
// upgrade or sale is on its way the battle screen shows it at once: the girl's ghost stays on her
// spot, the price button says "Ordered", and the HUD shows the coins already spoken for. Nothing
// here touches the sim: every entry clears when its command runs (controller onApplied, ok or
// refused), when the battle screen is rebuilt (a resync remounts it: clear), or once the lockstep
// has run past the command's tick without it (a rejoin voided an order the host never got).
// Never by the clock: an ally frozen for 6–12 s (under the drop timeout) keeps my order queued, and an
// "Ordered" button that turned back into a price would let a second tap buy the tier twice (review r1 F1).
// (tests/battle-ui/coopPending.test.js)

/** Without a lockstep tick source (tests, tools): an order still not back after this long is forgotten. */
export const STALE_MS = 6000;

const nowMs = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

/**
 * @param {{ now?: () => number, tick?: () => number, paused?: () => boolean, known?: (key: string) => boolean }} [opts]
 *   tick: the lockstep's tick (an order whose tick has run without coming back is stale); paused: true while the
 *   lockstep is stalled or rebuilding (nothing goes stale then); known: is the order (`${p}:${s}`) still in the
 *   lockstep's log (a rejoin's catch-up voids the orders the host never got: stale at once, review r2 R2-3).
 *   Without `tick` the wall clock (STALE_MS) decides.
 */
export function createCoopPending({ now = nowMs, tick = null, paused = () => false, known = null } = {}) {
  /** `${p}:${s}` (the queued command) → { k, uid?, path?, unitId?, x?, y?, cost, at } */
  const orders = new Map();
  let rev = 0;

  const key = (cmd) => `${cmd.p}:${cmd.s}`;

  function add(cmd, entry) {
    if (!cmd) return;
    orders.set(key(cmd), { ...entry, k: cmd.k, t: Number.isInteger(cmd.t) ? cmd.t : null, cost: Math.max(0, Number(entry.cost) || 0), at: now() });
    rev++;
  }

  function expire() {
    if (!orders.size || paused()) return;
    const T = tick ? tick() : null;
    const t = now();
    for (const [k, o] of orders) {
      // (onApplied clears an order during its own tick, so one still here once the lockstep is past it never ran)
      if ((known && !known(k)) || (T != null && o.t != null ? T > o.t : t - o.at > STALE_MS)) {
        orders.delete(k);
        rev++;
      }
    }
  }

  return {
    /** An upgrade order (`cmd` from Lockstep.queue) for path `path` of girl `uid`, costing `cost`. */
    upgrade(cmd, uid, path, cost) {
      add(cmd, { uid, path, cost });
    },
    /** A placement order: `unitId` at world (x, y), costing `cost`. */
    place(cmd, unitId, x, y, cost) {
      add(cmd, { unitId, x, y, cost });
    },
    /** A hero level order (`hlv`): only its price, held until it runs (review r2 R2-2). */
    level(cmd, cost) {
      add(cmd, { cost });
    },
    /** A sale order for girl `uid`. */
    sell(cmd, uid) {
      add(cmd, { uid, cost: 0 });
    },
    /** A command ran on this client (any player's): mine stop waiting. @returns {object|null} the entry it cleared */
    landed(cmd) {
      const k = key(cmd);
      const o = orders.get(k) || null;
      if (o) {
        orders.delete(k);
        rev++;
      }
      return o;
    },
    /** The battle screen is remounted (a resync): whatever was in flight is gone or already ran. (An in-place rejoin
     *  needs no clear: the orders the host kept still land, the voided ones go stale once their tick has passed.) */
    clear() {
      if (!orders.size) return;
      orders.clear();
      rev++;
    },
    /** Coins spoken for by my orders in flight (the HUD shows my cash less these). */
    reserved() {
      expire();
      let n = 0;
      for (const o of orders.values()) n += o.cost;
      return n;
    },
    /** Is an upgrade of this path (any path when `path` is null) on its way? */
    upgrading(uid, path = null) {
      expire();
      for (const o of orders.values()) if (o.k === 'upg' && o.uid === uid && (path == null || o.path === path)) return true;
      return false;
    },
    /** Is a sale of this girl on its way? */
    selling(uid) {
      expire();
      for (const o of orders.values()) if (o.k === 'sell' && o.uid === uid) return true;
      return false;
    },
    /** Placements on their way: [{ unitId, x, y }] (oldest first). */
    placements() {
      expire();
      return [...orders.values()].filter((o) => o.k === 'place').map(({ unitId, x, y }) => ({ unitId, x, y }));
    },
    /** Changes whenever an order is added or cleared (the drawer's re-render signature). */
    get rev() {
      return rev;
    },
    get size() {
      return orders.size;
    },
  };
}
