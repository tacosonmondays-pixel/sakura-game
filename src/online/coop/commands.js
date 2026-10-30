// Co-op battle state on top of the unchanged single-player Sim: both players' wallets,
// tower ownership, and the command set. Every client runs one CoopSim built from the same
// start message; Lockstep feeds it the same commands at the same ticks, so all clients stay
// identical. No DOM, no clock: tests run it in Node.
//
// Heroes: each player brings her own (sim.heroes[i] by player index); the Sim's `hero` getter
// follows the view, so during a command it is the commanding player's hero.
// Wallets: each command runs with that player's cash, loadout and hero swapped into the Sim,
// then swapped back. Each tick starts from the players' combined cash (tower interest reads
// it), and whatever the tick earned is split evenly between the players still connected
// (odd coins take turns). So are the kill rewards of a manual ability cast, which kills inside
// its `abil` command: the same split as when Auto fires it inside a step (spec §7.1).
// Owner-credited coins (an econ ability, auto or manual: sim.ownerCash, GAPS P-16) are never
// pooled: after every command and every step they move into their owner's wallet. At rest the
// Sim shows the local player's view (their cash, their cards), so the single-player HUD, tower
// bar and panels work unchanged.
// Every Sim call here runs inside withDetMath() (detMath.js): bit-identical trig and hypot on
// every JS engine, so an iPhone and an Android phone stay in lockstep too.
import { modeId } from '../../data/modes.js';
import { Sim } from '../../sim/Sim.js';
import { STEP, DEFAULT_UNIT_STATS, FLIGHT_MODES } from '../../sim/constants.js';
import { coopStage, COOP } from '../../data/coop.js';
import { freeplayTier } from '../../data/freeplay.js';
import { TARGET_MODES } from '../../data/types.js';
import { hashSim } from './simHash.js';
import { withDetMath } from './detMath.js';
import { buildTryoutPlan, buildTryoutStage, tryoutGone, tryoutLoadouts } from '../../sim/tryout/index.js';
import { checkedDraft } from '../../sim/tryout/draft.js';

/**
 * Command kinds: place[unitId,qx,qy] upg[uid,path] sell[uid] tgt[uid,mode] ult[] wave[] auto[bool]
 * speed[n] end[bool] (freeplay: this player's Finish vote; the run ends when everyone still in
 * the room has voted, and only after the stage's goal wave) hlv[level,maxPrice] (buy her hero's
 * next level: refused 'stale' if she already levelled past `level` or it now costs more than
 * `maxPrice`) hmv[qx,qy] (move her hero)
 * fly[uid, mode, qx1?, qy1?, qx2?, qy2?] (a drone wing's flight mode, owner only like tgt: Hold
 * takes point 1, Patrol points 1 and 2, in 1/1024 tiles; docs/specs/CHIKA_REWORK.md §16).
 * upg is refused 'onePerPath' when another of that player's girls of the same kind holds the path's
 * final tier (one final tier per path per girl type and player; src/sim/finalTier.js). A Tenka tier that
 * absorbs (Joint Research, Unified Theory) reports `absorbed: [uid…]`: her player's girls who joined her lab
 * team, now off the field and nobody's.
 * aim[uid, qx, qy(, k)] / aim[uid, null]: a girl's standing aim point (a mortar's centre, Iroha's mirror k), see
 * the 'aim' case. pick[uid, targetUid]: the girl this player's Midori brews / Chika links first (-1 = auto); the
 * target may be an ally's girl (Sim.setBuffPick).
 * abil[uid, group, qx, qy]: fire her own girl's (or hero's) ⚡ ability (ABILITIES_SPEC §7.2): group 0|1
 * (1: her player's best ready copy of that girl), an aim point in 1/1024 tiles or -1, -1 for none (an
 * ability on one girl takes the girl nearest it, within 0.6 tiles; Yuzuha's Emergency Deploy lands at the
 * edge spots nearest it). Refused 'notYours' / 'invalid', or
 * with the sim's reason at the command's tick (a tap behind an auto-cast: 'cooldown'; after the clear:
 * 'notWave'); a refusal spends nothing. `abilArgs()` builds it.
 * acast[uid, on]: her Auto switch, on 0|1; uid 0 = every girl she owns now and her default for the
 * ones that unlock later (sim.abilityAutoDefault; the start message's players[i].autoAbil sets it first).
 * Tryout Day (docs/specs/TRYOUT_DAY.md §11; only in a run, start.tryout): tr[op, a, b] a run command of this
 * player's (src/sim/tryout/index.js tryoutCommand: take / erase / hand carry the open offer's sequence number,
 * snack, brush, undo, ready); mv[uid, qx, qy] a Hall Pass move of one of their own girls, in 1/1024 tiles. Both are
 * validated inside the Sim at their tick; a stale or wrong one is a no-op with a reason.
 */
export const KINDS = ['place', 'upg', 'sell', 'tgt', 'ult', 'wave', 'auto', 'speed', 'end', 'hlv', 'hmv', 'fly', 'pick', 'aim', 'abil', 'acast', 'tr', 'mv'];
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

/** The `fly` command's arguments for a flight mode and its points (world coordinates). */
export function flyArgs(uid, mode, a = null, b = null) {
  const q = (v) => Math.round(v * Q);
  if (mode === 'hold' && a) return [uid, mode, q(a[0]), q(a[1])];
  if (mode === 'patrol' && a && b) return [uid, mode, q(a[0]), q(a[1]), q(b[0]), q(b[1])];
  return [uid, mode];
}

/**
 * The `abil` command's arguments: her uid, a group tap (her player's best ready copy) and an aim point
 * (world coordinates, quantized to 1/1024 tile; none = -1, -1).
 * @param {number} uid
 * @param {{ group?: boolean, aim?: number[]|null }} [opts]
 */
export function abilArgs(uid, { group = false, aim = null } = {}) {
  const q = (v) => Math.max(0, Math.round(v * Q));
  return aim ? [uid, group ? 1 : 0, q(aim[0]), q(aim[1])] : [uid, group ? 1 : 0, -1, -1];
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
    && Number.isInteger(c.s) && (KINDS.includes(c.k) || (markers && MARKERS.includes(c.k))) && Array.isArray(c.a) && c.a.length <= (c.k === 'fly' ? 6 : 4);
}

/**
 * @param {{ seed: number, stageId: string, difficulty: string, freeplay?: string|null, mode?: string,
 *   players: { slot: number, uid: string, name: string, loadout: {unitId: string, stats?: object}[], hero?: {unitId: string, stats?: object}|null, autoAbil?: boolean }[] }} start
 *   `freeplay` is the room's freeplay tier (FREEPLAY_TIERS) or null/absent for a normal battle.
 *   `autoAbil`: that player's Auto-cast setting (only `true` turns it on; absent = Off).
 * @param {{ mySlot?: number, stage?: object, units?: object }} [opts] `stage` / `units`: test fixtures (a
 *   StageDef; extra UnitDefs by id), never from the network
 * A Tryout Day run (`start.tryout` = { seed, grade, length, mapId }, each player's `draft` (3 girl ids) and `pool`
 * (their frozen account stats by girl id)): the stage comes from the run's plan, every player's loadout from their
 * squad inside the band (src/sim/tryout).
 */
export function createCoopSim(start, { mySlot = 0, stage = null, units = null } = {}) {
  if (start.tryout) return createCoopSimOn(start, { mySlot, units }, tryoutSim(start, stage, units));
  return createCoopSimOn(start, { mySlot, units }, null, stage);
}

/** The Sim of a Tryout Day co-op run (2 players). */
function tryoutSim(start, stage, units) {
  const ty = start.tryout;
  const players = [...start.players].sort((a, b) => a.slot - b.slot);
  const plan = buildTryoutPlan({ seed: ty.seed >>> 0, grade: ty.grade, length: ty.length, mapId: ty.mapId });
  const stageDef = stage || buildTryoutStage(plan, { coop: true });
  return withDetMath(() => new Sim({
    stageId: stageDef.id, difficulty: 'normal', loadout: [], heroes: players.map((p) => p.hero || null), seed: start.seed >>> 0,
    options: {
      endless: false, autoStart: false,
      tryout: {
        seed: plan.seed, grade: plan.grade, length: plan.length, mapId: plan.mapId,
        // (each three checked against that player's own six: a forged draft plays the first three of it; Random Class
        // ignores the drafts, and the Sim draws each player's three from their pool and the seed, §20.4)
        ...(ty.random === true ? { random: true } : null),
        players: players.map((p) => ({ squad: ty.random === true ? [] : checkedDraft(p.draft, p.pool, plan.seed, p.slot) })),
        pools: players.map((p) => (p.pool && typeof p.pool === 'object' ? p.pool : {})),
      },
    },
    data: { stage: stageDef, ...(units ? { units } : null) },
  }));
}

function createCoopSimOn(start, { mySlot = 0, units = null }, tySim, stage = null) {
  const freeplay = tySim ? null : freeplayTier(start.freeplay);
  const stageDef = tySim ? tySim.stage : stage || coopStage(start.stageId, { freeplay });
  if (!stageDef) throw new Error(`[coop] unknown stage ${start.stageId}`);
  const players = [...start.players].sort((a, b) => a.slot - b.slot);
  const host = players[0];
  const union = [];
  const seen = new Set();
  for (const p of players) for (const e of p.loadout || []) if (e && !seen.has(e.unitId)) {
    seen.add(e.unitId);
    union.push(e);
  }
  const sim = tySim || withDetMath(() => new Sim({
    stageId: stageDef.id, difficulty: start.difficulty, loadout: union, heroes: players.map((p) => p.hero || null), seed: start.seed >>> 0,
    // the battle mode is the only mode/rule field read from the message (the rule rides on the
    // StageDef; freeplay runs in Standard in v1: docs/specs/CODEX_MODES.md §6.4)
    options: { endless: false, autoStart: false, freeplay: !!freeplay, mode: modeId(freeplay ? 'standard' : start.mode) }, data: { stage: stageDef, ...(units ? { units } : null) },
  }));
  // abilities (src/sim/abilities.js): owner-credited coins wait in ownerCash until flushOwnerCash, and
  // each player's Auto-cast setting comes from the start message (the same on every client)
  sim.ownerCash = players.map(() => 0);
  players.forEach((p, i) => { sim.abilityAutoDefault[i] = p.autoAbil === true; });
  const views = players.map((p, i) => {
    // a run: the Sim built each player's loadout from their squad (src/sim/tryout); their view shares that map
    if (sim.tryout) return { loadout: sim._loadouts[i], heroConfig: sim.heroConfigs[i] || null };
    const lo = new Map();
    for (const e of p.loadout || []) {
      const def = e && sim.data.unit(e.unitId);
      if (def && def.kind !== 'hero') lo.set(def.id, { ...DEFAULT_UNIT_STATS, ...(e.stats || {}) });
    }
    return { loadout: lo, heroConfig: sim.heroConfigs[i] || null };
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
    if (sim.tryout) sim.viewOwner = slot;
  }
  view(viewSlot);

  /** Every player's loadout stats and hero config: what a girl's unitStats points at (snapshots). */
  function config() {
    return { players: views.map((v) => ({ loadout: Object.fromEntries(v.loadout), hero: v.heroConfig })) };
  }

  function ownsTower(slot, uid) {
    return owners.get(uid) === slot;
  }

  /**
   * Pooled coins (kill rewards, wave income) split evenly between the players still connected
   * (everyone gone: this client's player); an odd coin takes turns.
   */
  function splitIncome(income) {
    if (!(income > 0)) return;
    const alive = players.map((_, i) => i).filter((i) => !gone.has(i));
    const to = alive.length ? alive : [viewSlot];
    const share = Math.floor(income / to.length);
    let rest = income - share * to.length;
    for (const i of to) wallets[i] += share;
    for (; rest > 0; rest--) wallets[to[oddTurn++ % to.length]] += 1;
  }

  /** Owner-credited coins (sim.ownerCash) into their owners' wallets: after every command and step. */
  function flushOwnerCash() {
    const oc = sim.ownerCash;
    for (let i = 0; i < wallets.length; i++) {
      if (!oc[i]) continue;
      wallets[i] += oc[i];
      oc[i] = 0;
    }
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
      // a run: their open pick or break resolves at once, and so does every later one while they stay gone
      if (sim.tryout) withDetMath(() => tryoutGone(sim, slot, cmd.k === 'gone'));
      // the one left can finish alone (her vote may already be in)
      if (cmd.k === 'gone') checkEndVotes();
      return { ok: true };
    }
    view(slot);
    let res = { ok: false, reason: 'invalid' };
    let pool = null; // a cast's cash before it fired: what it earned on top is pooled (splitIncome)
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
          // her player is hers from the start (placeTower sets t.owner before her ability syncs)
          const t = sim.placeTower(unitId, x, y, { owner: slot });
          if (t) {
            owners.set(t.uid, slot);
            res = { ok: true, tower: t };
          }
          break;
        }
        case 'upg':
          if (!ownsTower(slot, a[0])) res = { ok: false, reason: 'notYours' };
          else if (!UPGRADE_PATHS.includes(a[1])) res = { ok: false, reason: 'invalid' };
          else {
            // that player's view (cash, owner), the same on every client; never options from the network
            const st = sim.upgradeStatus(a[0], a[1]);
            // Tenka's Joint Research / Unified Theory absorb inside this command (src/sim/lab.js): only girls
            // whose t.owner is hers (this slot), so never the partner's, gone or not; who joined is the new
            // tail of her lab record (no Sim field outlives the command)
            const tw = st.locked ? null : sim.getTower(a[0]);
            const had = tw?.lab ? tw.lab.uids.length : 0;
            res = st.locked ? { ok: false, reason: st.reason, holder: st.holder ?? null } : { ok: sim.upgradeTower(a[0], a[1]) };
            // the girls who joined left the field, like a sale: nobody's now (a later command on one is
            // 'notYours'; GAPS 5.10 co-op)
            const joined = res.ok && tw?.lab ? tw.lab.uids.slice(had) : null;
            if (joined && joined.length) {
              for (const uid of joined) owners.delete(uid);
              res.absorbed = joined;
            }
          }
          break;
        case 'sell':
          if (!ownsTower(slot, a[0])) res = { ok: false, reason: 'notYours' };
          else if (sim.canSell(a[0]).reason === 'hero') res = { ok: false, reason: 'hero' }; // she stays, and stays hers
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
        case 'fly': {
          // own girls only; points are whole 1/1024 tiles (Hold: 1, Patrol: 2)
          const [uid, mode, ...q] = a;
          const need = mode === 'hold' ? 2 : mode === 'patrol' ? 4 : 0;
          if (!ownsTower(slot, uid)) res = { ok: false, reason: 'notYours' };
          else if (typeof mode !== 'string' || !FLIGHT_MODES.includes(mode) || q.length < need || !q.slice(0, need).every(Number.isInteger)) res = { ok: false, reason: 'invalid' };
          else res = { ok: sim.setFlight(uid, mode, need ? q[0] / Q : null, need ? q[1] / Q : null, need > 2 ? q[2] / Q : null, need > 2 ? q[3] / Q : null) };
          break;
        }
        case 'ult':
          res = views[slot].heroConfig && sim.hero ? { ok: !!sim.activateUlt() } : { ok: false, reason: 'noHero' };
          break;
        case 'hlv': {
          if (!Number.isInteger(a[0]) || !Number.isInteger(a[1])) break;
          const r = sim.buyHeroLevel({ level: a[0], maxPrice: a[1] });
          res = r.ok ? { ok: true, price: r.price } : { ok: false, reason: r.reason };
          break;
        }
        case 'hmv': {
          if (!Number.isInteger(a[0]) || !Number.isInteger(a[1])) break;
          const r = sim.moveHero(a[0] / Q, a[1] / Q);
          res = r.ok ? { ok: true } : { ok: false, reason: r.reason };
          break;
        }
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
        case 'pick':
          // limited buffs (src/sim/buffs.js): my brewer / linker, any girl as the target (teamwork)
          if (!ownsTower(slot, a[0])) res = { ok: false, reason: 'notYours' };
          else if (!Number.isInteger(a[1])) res = { ok: false, reason: 'invalid' };
          else res = sim.setBuffPick(a[0], a[1]);
          break;
        // ---- aim[uid, qx, qy] / aim[uid, null] (roster B3, track 5; GAPS P-2) ----------------
        // An aim point for a girl of this player that has one (a mortar's centre, a mirror's spot,
        // an aimed hero ult): whole 1/1024 tiles, like `place`; [uid, null] clears it (automatic
        // aim). The Sim quantises, clamps into the map (a mirror into her reach) and refuses girls
        // without an aim mode. Owner only, like tgt.
        // Iroha (src/sim/mirrors.js): aim[uid, qx, qy, k] places her mirror k (0-based); without k the nearest moves.
        case 'aim': {
          const [uid, qx, qy, k] = a;
          if (!ownsTower(slot, uid)) res = { ok: false, reason: 'notYours' };
          else if (qx === null && a.length <= 2) res = { ok: sim.clearAim(uid) };
          else if (!Number.isInteger(qx) || !Number.isInteger(qy) || (a.length > 3 && !(Number.isInteger(k) && k >= 0))) res = { ok: false, reason: 'invalid' };
          else res = { ok: sim.setAim(uid, qx / Q, qy / Q, a.length > 3 ? k : null) };
          break;
        }
        // ---- end aim ------------------------------------------------------------------------
        case 'abil': {
          // her own girl or hero (heroes are placed by `place`, so they are in owners); never sim.hero
          const [uid, group, qx, qy] = a;
          if (!Number.isInteger(uid) || (group !== 0 && group !== 1) || !Number.isInteger(qx) || !Number.isInteger(qy)
            || !((qx === -1 && qy === -1) || (qx >= 0 && qy >= 0))) res = { ok: false, reason: 'invalid' };
          else if (!ownsTower(slot, uid)) res = { ok: false, reason: 'notYours' };
          else {
            // an instant strike or burst kills inside the command: those bounties are the team's, split as a
            // step splits them (an auto-cast's), never the caster's alone; econ coins go through ownerCash
            pool = sim.cash;
            const r = sim.castAbility(uid, { group: group === 1, aim: qx >= 0 ? [qx / Q, qy / Q] : null, owner: slot });
            res = r.ok ? { ok: true, casterUid: r.casterUid } : { ok: false, reason: r.reason, casterUid: r.casterUid };
          }
          break;
        }
        // ---- Tryout Day (docs/specs/TRYOUT_DAY.md §11) ------------------------------------------------
        case 'tr': {
          const [op, x, y, z] = a;
          if (!sim.tryout) res = { ok: false, reason: 'noRun' };
          else if (typeof op !== 'string' || a.slice(1).some((v) => v != null && !Number.isInteger(v))) res = { ok: false, reason: 'invalid' };
          else res = sim.tryoutCommand(slot, op, [x, y, z]);
          break;
        }
        case 'mv': {
          const [uid, qx, qy] = a;
          if (!sim.tryout) res = { ok: false, reason: 'noRun' };
          else if (!Number.isInteger(uid) || !Number.isInteger(qx) || !Number.isInteger(qy)) res = { ok: false, reason: 'invalid' };
          else if (!ownsTower(slot, uid)) res = { ok: false, reason: 'notYours' };
          else res = sim.tryoutMove(slot, uid, qx / Q, qy / Q);
          break;
        }
        case 'acast': {
          const [uid, on] = a;
          if (!Number.isInteger(uid) || uid < 0 || (on !== 0 && on !== 1)) res = { ok: false, reason: 'invalid' };
          else if (uid === 0) {
            sim.setAbilityAutoAll(slot, on === 1);
            res = { ok: true };
          } else if (!ownsTower(slot, uid)) res = { ok: false, reason: 'notYours' };
          else {
            const r = sim.setAbilityAuto(uid, on === 1);
            res = r.ok ? { ok: true } : { ok: false, reason: r.reason };
          }
          break;
        }
        default:
          break;
      }
    } finally {
      const won = pool != null && sim.cash > pool ? sim.cash - pool : 0;
      wallets[slot] = sim.cash - won;
      splitIncome(won);
      flushOwnerCash();
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
    splitIncome(sim.cash - total);
    // what the step paid to an owner (an auto-cast Market Day) is hers alone, never part of the split
    flushOwnerCash();
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
        // a run: each player's squad (join order) and the period whose Run Level is applied travel beside the
        // Sim, so a fresh client rebuilds every loadout entry before the restore (docs/specs/TRYOUT_DAY.md §12.2)
        const run = sim.tryout ? { squads: sim.tryout.players.map((p) => p.squad.slice()), period: sim.tryout.started || 1 } : null;
        return { v: 1, tick, speed, oddTurn, wallets: wallets.slice(), owners: [...owners], gone: [...gone], endVotes: endVotes.slice(), ...run, sim: sim.snapshot(config()) };
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
      if (sim.tryout) {
        if (!Array.isArray(snap.squads) || snap.squads.length !== players.length || !Number.isInteger(snap.period)) throw new Error('[coop] a run checkpoint without its squads');
        withDetMath(() => tryoutLoadouts(sim, snap.squads.map((q) => (Array.isArray(q) ? q.filter((id) => typeof id === 'string') : [])), snap.period));
      }
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
