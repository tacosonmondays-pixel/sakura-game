// Co-op battle state on top of the unchanged single-player Sim: both players' wallets,
// tower ownership, and the command set. Every client runs one CoopSim built from the same
// start message; Lockstep feeds it the same commands at the same ticks, so all clients stay
// identical. No DOM, no clock: tests run it in Node.
//
// Wallets: each command runs with that player's cash, loadout and hero swapped into the Sim,
// then swapped back. Each tick starts from the players' combined cash (tower interest reads
// it), and whatever the tick earned is split evenly between the players still connected
// (odd coins take turns). At rest the Sim shows the local player's view
// (their cash, their cards), so the single-player HUD, tower bar and panels work unchanged.
import { Sim } from '../../sim/Sim.js';
import { STEP, DEFAULT_UNIT_STATS } from '../../sim/constants.js';
import { coopStage, COOP } from '../../data/coop.js';
import { TARGET_MODES } from '../../data/types.js';
import { hashSim } from './simHash.js';

/** Command kinds: place[unitId,qx,qy] upg[uid,path] sell[uid] tgt[uid,mode] ult[] wave[] auto[bool] speed[n]. */
export const KINDS = ['place', 'upg', 'sell', 'tgt', 'ult', 'wave', 'auto', 'speed'];
const Q = 1024;

/** World coordinate → integer 1/1024 tile, never both whole tiles (a Sim tile call). */
export function quantize(x, y) {
  let qx = Math.round(x * Q);
  const qy = Math.round(y * Q);
  if (qx % Q === 0 && qy % Q === 0) qx += 1;
  return [qx, qy];
}

/** Orders commands for one tick: player slot, then that player's sequence number. */
export function compareCmds(a, b) {
  return a.t - b.t || a.p - b.p || a.s - b.s;
}

/** Validates the shape of a command from the network. */
export function isValidCmd(c) {
  return !!c && Number.isInteger(c.t) && c.t >= 0 && Number.isInteger(c.p) && c.p >= 0 && c.p < 2
    && Number.isInteger(c.s) && KINDS.includes(c.k) && Array.isArray(c.a) && c.a.length <= 4;
}

/**
 * @param {{ seed: number, stageId: string, difficulty: string,
 *   players: { slot: number, uid: string, name: string, loadout: {unitId: string, stats?: object}[], hero?: {unitId: string, stats?: object}|null }[] }} start
 * @param {{ mySlot?: number, stage?: object }} [opts]
 */
export function createCoopSim(start, { mySlot = 0, stage = null } = {}) {
  const stageDef = stage || coopStage(start.stageId);
  if (!stageDef) throw new Error(`[coop] unknown stage ${start.stageId}`);
  const players = [...start.players].sort((a, b) => a.slot - b.slot);
  const host = players[0];
  const union = [];
  const seen = new Set();
  for (const p of players) for (const e of p.loadout || []) if (e && !seen.has(e.unitId)) {
    seen.add(e.unitId);
    union.push(e);
  }
  const sim = new Sim({
    stageId: stageDef.id, difficulty: start.difficulty, loadout: union, hero: host.hero || null, seed: start.seed >>> 0,
    options: { endless: false, autoStart: false }, data: { stage: stageDef },
  });
  const heroCfg = sim.heroConfig;
  const views = players.map((p) => {
    const lo = new Map();
    for (const e of p.loadout || []) {
      const def = e && sim.data.unit(e.unitId);
      if (def && def.kind !== 'hero') lo.set(def.id, { ...DEFAULT_UNIT_STATS, ...(e.stats || {}) });
    }
    return { loadout: lo, heroConfig: p.slot === host.slot ? heroCfg : null };
  });
  const startCash = Math.round(sim.cash * COOP.cashShare);
  const wallets = players.map(() => startCash);
  const owners = new Map();
  const gone = new Set();
  let viewSlot = Math.max(0, players.findIndex((p) => p.slot === mySlot));
  let speed = 1;
  let tick = 0;
  let oddTurn = 0; // who gets the next odd coin

  function view(slot) {
    sim.cash = wallets[slot];
    sim.loadout = views[slot].loadout;
    sim.heroConfig = views[slot].heroConfig;
  }
  view(viewSlot);

  function ownsTower(slot, uid) {
    return owners.get(uid) === slot;
  }

  /**
   * Executes one command for its player. Never throws on bad input (a no-op instead).
   * @returns {{ ok: boolean, reason?: string, tower?: object, refund?: number }}
   */
  function apply(cmd) {
    const slot = cmd.p;
    if (!views[slot]) return { ok: false, reason: 'slot' };
    view(slot);
    let res = { ok: false, reason: 'invalid' };
    try {
      const a = cmd.a;
      switch (cmd.k) {
        case 'place': {
          const [unitId, qx, qy] = a;
          const x = qx / Q;
          const y = qy / Q;
          const chk = sim.canPlace(unitId, x, y);
          if (!chk.ok) {
            res = { ok: false, reason: chk.reason };
            break;
          }
          const t = sim.placeTower(unitId, x, y);
          if (t) {
            owners.set(t.uid, slot);
            res = { ok: true, tower: t };
          }
          break;
        }
        case 'upg':
          if (!ownsTower(slot, a[0])) res = { ok: false, reason: 'notYours' };
          else res = sim.upgradeTower(a[0], a[1]) ? { ok: true } : { ok: false, reason: 'cash' };
          break;
        case 'sell':
          if (!ownsTower(slot, a[0])) res = { ok: false, reason: 'notYours' };
          else {
            const refund = sim.sellTower(a[0]);
            owners.delete(a[0]);
            res = { ok: true, refund };
          }
          break;
        case 'tgt':
          if (!ownsTower(slot, a[0]) || !TARGET_MODES[a[1]]) res = { ok: false, reason: 'notYours' };
          else res = { ok: sim.setTargetMode(a[0], a[1]) };
          break;
        case 'ult':
          res = views[slot].heroConfig && sim.hero ? { ok: !!sim.activateUlt() } : { ok: false, reason: 'noHero' };
          break;
        case 'wave':
          res = { ok: sim.startNextWave() };
          break;
        case 'auto':
          sim.options.autoStart = !!a[0];
          if (sim.options.autoStart && sim.state === 'between') sim.startNextWave();
          res = { ok: true };
          break;
        case 'speed':
          if ([1, 2, 3].includes(a[0])) {
            speed = a[0];
            res = { ok: true };
          }
          break;
        default:
          break;
      }
    } finally {
      wallets[slot] = sim.cash;
      view(viewSlot);
    }
    return res;
  }

  /** Advances the battle by one fixed 1/60 s step and splits the coins it earned. */
  function step() {
    let total = 0;
    for (const w of wallets) total += w;
    sim.cash = total;
    sim.update(STEP);
    const income = sim.cash - total;
    if (income > 0) {
      const alive = players.map((_, i) => i).filter((i) => !gone.has(i));
      const to = alive.length ? alive : [viewSlot];
      const share = Math.floor(income / to.length);
      let rest = income - share * to.length;
      for (const i of to) wallets[i] += share;
      for (; rest > 0; rest--) wallets[to[oddTurn++ % to.length]] += 1;
    }
    tick++;
    view(viewSlot);
  }

  return {
    sim,
    players,
    get tick() {
      return tick;
    },
    get speed() {
      return speed;
    },
    get wallets() {
      return wallets.slice();
    },
    get mySlot() {
      return players[viewSlot].slot;
    },
    apply,
    step,
    ownerOf: (uid) => owners.get(uid),
    isMine: (uid) => owners.get(uid) === viewSlot,
    /** Marks a player as disconnected: their towers stay, future income goes to the others. */
    markGone(slot) {
      gone.add(slot);
    },
    isGone: (slot) => gone.has(slot),
    hash: () => hashSim(sim, { tick, wallets }),
  };
}
