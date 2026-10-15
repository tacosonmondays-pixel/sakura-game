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
// Every Sim call here runs inside withDetMath() (detMath.js): bit-identical trig and hypot on
// every JS engine, so an iPhone and an Android phone stay in lockstep too.
import { Sim } from '../../sim/Sim.js';
import { STEP, DEFAULT_UNIT_STATS } from '../../sim/constants.js';
import { coopStage, COOP } from '../../data/coop.js';
import { freeplayTier } from '../../data/freeplay.js';
import { TARGET_MODES } from '../../data/types.js';
import { hashSim } from './simHash.js';
import { withDetMath } from './detMath.js';

/**
 * Command kinds: place[unitId,qx,qy] upg[uid,path] sell[uid] tgt[uid,mode] ult[] wave[] auto[bool]
 * speed[n] end[bool] (freeplay: this player's Finish vote; the run ends when everyone still in
 * the room has voted, and only after the stage's goal wave).
 */
export const KINDS = ['place', 'upg', 'sell', 'tgt', 'ult', 'wave', 'auto', 'speed', 'end'];
const Q = 1024;
/** Upgrade paths a tower has (Sim tiers[0..2]). */
const UPGRADE_PATHS = [0, 1, 2];

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

/** Lockstep markers (never sent by players): a player dropped out / came back at tick t. */
export const MARKERS = ['gone', 'join'];

/**
 * Validates the shape of a command from the network. Markers are only accepted from a host's
 * command log (resync / rejoin), never in a player's own command stream.
 * @param {object} c
 * @param {{ markers?: boolean }} [opts]
 */
export function isValidCmd(c, { markers = false } = {}) {
  return !!c && Number.isInteger(c.t) && c.t >= 0 && Number.isInteger(c.p) && c.p >= 0 && c.p < 2
    && Number.isInteger(c.s) && (KINDS.includes(c.k) || (markers && MARKERS.includes(c.k))) && Array.isArray(c.a) && c.a.length <= 4;
}

/**
 * @param {{ seed: number, stageId: string, difficulty: string, freeplay?: string|null,
 *   players: { slot: number, uid: string, name: string, loadout: {unitId: string, stats?: object}[], hero?: {unitId: string, stats?: object}|null }[] }} start
 *   `freeplay` is the room's freeplay tier (FREEPLAY_TIERS) or null/absent for a normal battle.
 * @param {{ mySlot?: number, stage?: object }} [opts]
 */
export function createCoopSim(start, { mySlot = 0, stage = null } = {}) {
  const freeplay = freeplayTier(start.freeplay);
  const stageDef = stage || coopStage(start.stageId, { freeplay });
  if (!stageDef) throw new Error(`[coop] unknown stage ${start.stageId}`);
  const players = [...start.players].sort((a, b) => a.slot - b.slot);
  const host = players[0];
  const union = [];
  const seen = new Set();
  for (const p of players) for (const e of p.loadout || []) if (e && !seen.has(e.unitId)) {
    seen.add(e.unitId);
    union.push(e);
  }
  const sim = withDetMath(() => new Sim({
    stageId: stageDef.id, difficulty: start.difficulty, loadout: union, hero: host.hero || null, seed: start.seed >>> 0,
    options: { endless: false, autoStart: false, freeplay: !!freeplay }, data: { stage: stageDef },
  }));
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
  const endVotes = players.map(() => false); // freeplay Finish votes, by player index

  /** Freeplay: once the goal is cleared, the run ends when every player still here votes Finish. */
  function checkEndVotes() {
    if (!sim.freeplay || sim.wavesCleared < sim.totalWaves) return false;
    if (!players.every((_, i) => gone.has(i) || endVotes[i])) return false;
    if (players.every((_, i) => gone.has(i))) return false;
    return sim.finish();
  }

  function view(slot) {
    sim.cash = wallets[slot];
    sim.loadout = views[slot].loadout;
    sim.heroConfig = views[slot].heroConfig;
  }
  view(viewSlot);

  /** Every player's loadout stats and the hero config: what a girl's unitStats points at (snapshots). */
  function config() {
    return { players: views.map((v) => ({ loadout: Object.fromEntries(v.loadout), hero: v.heroConfig })) };
  }

  function ownsTower(slot, uid) {
    return owners.get(uid) === slot;
  }

  /**
   * Executes one command for its player. Never throws on bad input (a no-op instead).
   * @returns {{ ok: boolean, reason?: string, tower?: object, refund?: number }}
   */
  function apply(cmd) {
    return withDetMath(() => applyCmd(cmd));
  }

  function applyCmd(cmd) {
    const slot = cmd.p;
    if (!views[slot]) return { ok: false, reason: 'slot' };
    if (cmd.k === 'gone' || cmd.k === 'join') {
      if (cmd.k === 'gone') gone.add(slot);
      else gone.delete(slot);
      // the one left can finish alone (her vote may already be in)
      if (cmd.k === 'gone') checkEndVotes();
      return { ok: true };
    }
    view(slot);
    let res = { ok: false, reason: 'invalid' };
    try {
      const a = cmd.a;
      switch (cmd.k) {
        case 'place': {
          const [unitId, qx, qy] = a;
          if (typeof unitId !== 'string' || !Number.isInteger(qx) || !Number.isInteger(qy)) break;
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
          else if (!UPGRADE_PATHS.includes(a[1])) res = { ok: false, reason: 'invalid' };
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
          // own keys only: 'toString' / 'constructor' are not targeting modes
          if (!ownsTower(slot, a[0])) res = { ok: false, reason: 'notYours' };
          else if (typeof a[1] !== 'string' || !Object.hasOwn(TARGET_MODES, a[1])) res = { ok: false, reason: 'invalid' };
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
        case 'end':
          // a Finish vote counts only in freeplay, after the goal, while the run is on
          if (typeof a[0] !== 'boolean') res = { ok: false, reason: 'invalid' };
          else if (!sim.freeplay || sim.wavesCleared < sim.totalWaves || sim.state === 'won' || sim.state === 'lost') res = { ok: false, reason: 'notYet' };
          else {
            endVotes[slot] = a[0];
            checkEndVotes();
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
    withDetMath(stepSim);
  }

  function stepSim() {
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
    /** A disconnected player is back (lockstep rejoin): she shares the income again. */
    markBack(slot) {
      gone.delete(slot);
    },
    isGone: (slot) => gone.has(slot),
    /** Freeplay Finish votes, by player index (for the HUD). */
    endVotes: () => endVotes.slice(),
    hash: () => hashSim(sim, { tick, wallets }),
    /**
     * The whole co-op battle as plain JSON (a lockstep checkpoint): the Sim's snapshot plus the
     * wallets, tower owners, who is gone, the Finish votes, speed and the odd-coin turn. Taken
     * between ticks (after step(), before the next tick's commands). The same on every client: the
     * Sim's cash (this client's view of its own wallet) is stored as 0, the wallets hold the coins.
     */
    snapshot() {
      const mine = sim.cash;
      sim.cash = 0;
      try {
        return { v: 1, tick, speed, oddTurn, wallets: wallets.slice(), owners: [...owners], gone: [...gone], endVotes: endVotes.slice(), sim: sim.snapshot(config()) };
      } finally {
        sim.cash = mine;
      }
    },
    /**
     * Continues from snapshot() (on a CoopSim fresh from the same start message): the next
     * command and step are those of tick `snap.tick`. The view stays this client's own.
     */
    restore(snap) {
      if (!snap || snap.v !== 1 || !Number.isInteger(snap.tick) || snap.wallets?.length !== players.length) throw new Error('[coop] not a co-op checkpoint');
      withDetMath(() => sim.restore(snap.sim, config()));
      tick = snap.tick;
      speed = snap.speed;
      oddTurn = snap.oddTurn;
      snap.wallets.forEach((w, i) => { wallets[i] = w; });
      owners.clear();
      for (const [uid, slot] of snap.owners) owners.set(uid, slot);
      gone.clear();
      for (const i of snap.gone) gone.add(i);
      snap.endVotes.forEach((v, i) => { endVotes[i] = !!v; });
      view(viewSlot);
      return this;
    },
  };
}
