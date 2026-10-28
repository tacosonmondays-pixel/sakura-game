// Tryout Day, the roguelike run mode (docs/specs/TRYOUT_DAY.md): the run inside the Sim. `sim.tryout` is plain
// data (every own field of it rides in battle snapshots and co-op checkpoints); the constructor-only inputs
// (each player's frozen account stats, their loadout maps, the viewing player) live in fields the snapshot
// skips (REBUILT). Every choice is a command (`tryoutCommand`, co-op `tr` / `mv`) validated here at its
// tick; every draw comes from a named stream of the run seed. Nothing here runs per step but the co-op
// window clock. A Sim without `options.tryout` never reaches this file.
import { TRYOUT, PEP_CARDS } from '../../data/tryout.js';
import { AUTO_START_DELAY } from '../constants.js';
import { createRuleRuntime, rebuildRuleTables, ruleBountyAdd } from '../rules.js';
import { lengthOf, periodWaves, blockOf, buildTryoutPlan } from './plan.js';
import { runLevelOf, bandStats } from './power.js';
import { openOffer, eraseOffer, squadRoom } from './offers.js';
import { refreshRunMods, runModsFor, applyBoardCard, boardWaveClear, boardPeriodEnd, seatBonus, spareChange, costCutFor } from './pep.js';
import {
  drawAssignments, storeBaseline, waveEndCheck, evaluatePeriod, killPoints, pointsOf, bossSpawned, bossGone,
} from './assign.js';
import { drawSeats, seatsOf, assignSeats, openBreak, moveGirl, undoMove, snack, brushUp } from './breaks.js';

export { assignProgress } from './assign.js';
export { buildTryoutPlan, buildTryoutStage, mapChoices } from './plan.js';
export { bandStats, runLevelOf } from './power.js';
export { canMoveGirl } from './breaks.js';

const newCtr = () => ({ spent: 0, placed: 0, upgrades: 0, sells: 0, ults: 0 });

/**
 * Fills each player's loadout (and banded hero stats) for their squad at period p's Run Level, in place:
 * a loadout entry object keeps its identity (a girl's t.unitStats points at it). Called by the constructor
 * and, before a restore, with the squads and period the save or checkpoint carries (§12.2).
 */
export function tryoutLoadouts(sim, squads, period) {
  const cfg = sim._tryoutCfg;
  const level = runLevelOf(cfg.length, period);
  squads.forEach((squad, i) => {
    const lo = sim._loadouts[i];
    if (!lo) return;
    const pool = sim._tryoutCfg.pools[i] || {};
    for (const id of [...lo.keys()]) if (!squad.includes(id)) lo.delete(id);
    for (const id of squad) {
      if (!sim.data.unit(id)) continue;
      const st = bandStats(pool[id] || null, level);
      const cur = lo.get(id);
      if (cur) {
        for (const k of Object.keys(cur)) delete cur[k];
        Object.assign(cur, st);
      } else lo.set(id, st);
    }
    const h = sim.heroConfigs[i];
    if (h) {
      const st = bandStats(cfg.heroAcct?.[i] || null, level);
      for (const k of Object.keys(h.stats)) delete h.stats[k];
      Object.assign(h.stats, st);
    }
  });
  return level;
}

/** The run's one rule runtime: this block's Window Seats and the run's bounty (§2.4). */
export function installRule(sim) {
  const ty = sim.tryout;
  const bonus = seatBonus(sim);
  const def = {
    id: 'tryout', cycle: null, active: {},
    always: { padDmgMul: 1 + bonus.dmg, padRangeAdd: bonus.reach, ...(spareChange(sim) ? { bountyAdd: spareChange(sim) } : null) },
    pads: seatsOf(sim, ty.seats.block).map((p) => ({ ...p })),
  };
  sim.rule = createRuleRuntime(def);
  sim._waveTick = 0;
  sim._bountyAdd = ruleBountyAdd(def, sim);
  rebuildRuleTables(sim);
  assignSeats(sim);
  sim._buffsDirty = true;
}

/**
 * Builds sim.tryout from the constructor's config (Sim.js). `cfg`: { seed, grade, length, mapId, players:
 * [{ squad, hero, heroStats }] }; `sim._tryoutCfg.pools[i]` = player i's frozen account stats by girl id.
 */
export function createTryout(sim, cfg) {
  const len = lengthOf(cfg.length);
  const plan = buildTryoutPlan(cfg);
  const g = TRYOUT.grades[plan.grade];
  const n = cfg.players.length;
  sim.tryout = {
    v: 1,
    seed: plan.seed,
    grade: plan.grade,
    length: plan.length,
    mapId: plan.mapId,
    coop: n > 1,
    period: 1,
    started: 0,
    level: runLevelOf(plan.length, 1),
    done: false,
    moves: 0,
    breakMoves: [],
    heartsAdded: 0,
    seats: { block: 0, blocks: drawSeats(sim, plan.seed, len.blocks.length), holder: [] },
    ctr: cfg.players.map(newCtr),
    base: null,
    best: 0,
    periodScore: 0,
    lastIncome: 0,
    score: 0,
    periods: [],
    assign: null,
    pickNo: 0,
    players: cfg.players.map((p) => ({
      squad: (p.squad || []).filter((id) => sim.data.unit(id)),
      cards: [],
      vouchers: {},
      refills: {},
      bank: 0,
      erasers: g.erasers,
      passes: 0,
      passBonus: 0,
      squadAdd: 0,
      lr: 0,
      pity: { r: 0, noSsr: 0, noGirl: 0 },
      seq: 0,
      offer: null,
      win: null,
      winTicks: 0,
      declined: null,
      fund: [],
      undo: [],
      start: {},
      used: {},
      snack: false,
      gone: false,
      cleared: 0,
      picks: [],
    })),
  };
  sim.maxLives = g.hearts;
  sim.lives = g.hearts;
  drawAssignments(sim, 1);
  installRule(sim);
}

/** After a restore (both paths, §12.2 step 4): the rule, seats, and every girl's run ModSet. */
export function tryoutRestore(sim) {
  installRule(sim);
  refreshRunMods(sim);
  assignSeats(sim);
}

// ---------------------------------------------------------------------------
// Windows: picks and breaks
// ---------------------------------------------------------------------------

/** Is any player's pick or break still open? (wave and auto are refused while one is.) */
export function windowOpen(sim) {
  return sim.tryout.players.some((p) => p.win);
}

function maybeClose(sim) {
  const ty = sim.tryout;
  if (windowOpen(sim)) return;
  if (sim.options.autoStart && sim.state === 'between') sim._autoTimer = AUTO_START_DELAY;
}

/** A gone player's open window resolves at once: a pick hands in, a break becomes Ready (§11). */
function autoResolve(sim, owner) {
  const p = sim.tryout.players[owner];
  if (p.win === 'pick') resolvePick(sim, owner, -1);
  if (p.win === 'break') p.win = null;
}

/** Co-op: a player left (or came back). Their girls keep fighting; their windows resolve by themselves. */
export function tryoutGone(sim, owner, gone = true) {
  const p = sim.tryout?.players[owner];
  if (!p) return;
  p.gone = !!gone;
  if (p.gone) {
    autoResolve(sim, owner);
    maybeClose(sim);
  }
}

/**
 * Every step (co-op only): each player's open window has its own clock (a pick and the break after it each get the
 * whole timeout); a window that runs out resolves by itself, on the same tick everywhere, and only that window.
 */
export function tryoutTick(sim) {
  const ty = sim.tryout;
  if (!ty.coop || !windowOpen(sim)) return;
  let closed = false;
  ty.players.forEach((p, i) => {
    if (!p.win) return;
    p.winTicks++;
    if (p.winTicks < TRYOUT.coopTimeoutTicks) return;
    if (p.win === 'pick') resolvePick(sim, i, -1);
    else p.win = null;
    closed = true;
  });
  if (closed) maybeClose(sim);
}

function updatePity(p, offer, tookGirl) {
  p.pity.r = offer.rarity === 0 ? p.pity.r + 1 : 0;
  p.pity.noSsr = offer.rarity >= 2 ? 0 : p.pity.noSsr + 1;
  p.pity.noGirl = tookGirl ? 0 : p.pity.noGirl + 1;
}

/** A girl joins a player's squad at the current Run Level, with a voucher for her first copy (§5). */
function joinSquad(sim, owner, id) {
  const ty = sim.tryout;
  const p = ty.players[owner];
  if (p.squad.includes(id) || squadRoom(sim, owner) <= 0) return false;
  p.squad.push(id);
  const pool = sim._tryoutCfg.pools[owner] || {};
  sim._loadouts[owner].set(id, bandStats(pool[id] || null, ty.level));
  p.vouchers[id] = (p.vouchers[id] || 0) + 1;
  sim._emit('tryoutJoin', { owner, unitId: id, loaner: !pool[id] });
  return true;
}

/**
 * Resolves a player's open pick: index ≥ 0 takes that card, -1 hands the pick in (Hand it in later: coins to
 * their wallet and +1 credit on the next pick, coins only at the last pick).
 */
function resolvePick(sim, owner, index) {
  const ty = sim.tryout;
  const p = ty.players[owner];
  const o = p.offer;
  const len = lengthOf(ty.length);
  const last = o.pick === len.picks.length;
  let tookGirl = false;
  let rule = false;
  if (index < 0) {
    const coins = (TRYOUT.handIn.base + TRYOUT.handIn.perPeriod * ty.period) * sim.cashScale;
    const noPay = p.cards.some((x) => PEP_CARDS[x.id]?.draw?.handInCoins === 0);
    if (!noPay) sim._gainCashFor(owner, coins);
    if (!last) p.bank = 1;
    p.picks.push({ pick: o.pick, rarity: o.rarity, hand: true });
  } else {
    const c = o.cards[index];
    if (c.girl) {
      tookGirl = joinSquad(sim, owner, c.girl);
      p.declined = null;
      p.picks.push({ pick: o.pick, rarity: o.rarity, girl: c.girl });
    } else {
      let inst = { id: c.id, r: c.r, ...(c.unit ? { unit: c.unit } : null) };
      // a team-wide one-of-a-kind card the partner took earlier on this tick: Big Breakfast instead (§11)
      if (PEP_CARDS[c.id].team && ty.players.some((q) => q.cards.some((x) => x.id === c.id))) inst = { id: 'E01', r: c.r };
      p.cards.push(inst);
      const card = PEP_CARDS[inst.id];
      if (inst.id === 'P06') p.refills[inst.unit] = (p.refills[inst.unit] || 0) + card.refills[inst.r];
      if (card.group === 'board') rule = applyBoardCard(sim, owner, inst);
      p.picks.push({ pick: o.pick, rarity: o.rarity, card: inst.id, unit: inst.unit || null });
    }
    // a girl the player passed over is skipped once at the next pick
    const passed = o.cards.find((x, i) => i !== index && x.girl);
    if (passed && !c.girl) p.declined = passed.girl;
  }
  if (p.tryoutNext && o.kind === 'girls') p.tryoutNext = false;
  // an LR roll counts toward the LR cap however the pick was resolved (§3.4)
  if (o.rarity === 4) p.lr++;
  updatePity(p, o, tookGirl);
  p.offer = null;
  refreshRunMods(sim, owner);
  if (rule) installRule(sim);
  else assignSeats(sim);
  const brk = len.breaks[o.pick] ? true : false;
  if (brk) openBreak(sim, owner);
  else p.win = null;
  if (p.gone) autoResolve(sim, owner);
}

/**
 * One run command for player `slot` (solo: 0). Ops (co-op `tr[op, a, b, c]`):
 *   take [seq, index]   take a card of the open offer      erase [seq]   Eraser      hand [seq]   Hand it in later
 *   snack []            Snack (break)                       brush [index]   Brush Up a card (break)
 *   undo []             undo the last Hall Pass move        ready []    Back to class (closes the break)
 * Never throws; a stale or invalid op is a no-op with a reason.
 * @returns {{ ok: boolean, reason: string|null }}
 */
export function tryoutCommand(sim, slot, op, args = []) {
  const ty = sim.tryout;
  const p = ty?.players[slot];
  if (!p) return { ok: false, reason: 'slot' };
  if (sim.state === 'won' || sim.state === 'lost') return { ok: false, reason: 'ended' };
  const [a, b] = args;
  switch (op) {
    case 'take':
    case 'hand':
    case 'erase': {
      if (p.win !== 'pick' || !p.offer) return { ok: false, reason: 'noOffer' };
      if (a !== p.offer.seq) return { ok: false, reason: 'stale' };
      if (op === 'erase') return eraseOffer(sim, slot);
      if (op === 'hand') {
        resolvePick(sim, slot, -1);
        maybeClose(sim);
        return { ok: true, reason: null };
      }
      if (!Number.isInteger(b) || b < 0 || b >= p.offer.cards.length) return { ok: false, reason: 'invalid' };
      if (p.offer.cards[b].girl && squadRoom(sim, slot) <= 0) return { ok: false, reason: 'squadFull' };
      resolvePick(sim, slot, b);
      maybeClose(sim);
      return { ok: true, reason: null };
    }
    case 'snack':
      return snack(sim, slot);
    case 'brush': {
      const r = brushUp(sim, slot, a);
      if (r.ok) {
        refreshRunMods(sim, slot);
        assignSeats(sim);
      }
      return { ok: r.ok, reason: r.reason };
    }
    case 'undo':
      return undoMove(sim, slot);
    case 'ready':
      if (p.win !== 'break') return { ok: false, reason: 'notBreak' };
      p.win = null;
      maybeClose(sim);
      return { ok: true, reason: null };
    default:
      return { ok: false, reason: 'invalid' };
  }
}

/** A Hall Pass move (co-op `mv[uid, qx, qy]`). */
export function tryoutMove(sim, slot, uid, x, y) {
  return moveGirl(sim, slot, uid, x, y);
}

// ---------------------------------------------------------------------------
// Sim hooks (each behind `if (this.tryout)` in Sim.js)
// ---------------------------------------------------------------------------

/** startNextWave: refused while a window is open; a period's first wave starts the period. */
export function tryoutCanStart(sim) {
  return !sim.tryout.done && !windowOpen(sim);
}

/** Called by startNextWave after the wave number moved on. */
export function tryoutWaveStart(sim) {
  const ty = sim.tryout;
  const len = lengthOf(ty.length);
  const p = Math.ceil(sim.wave / len.wavesPerPeriod);
  if (p === ty.started) return;
  ty.started = p;
  ty.period = p;
  // the Run Level floor rises (in place: t.unitStats identity holds)
  const level = runLevelOf(ty.length, p);
  if (level !== ty.level) {
    ty.level = level;
    tryoutLoadouts(sim, ty.players.map((x) => x.squad), p);
    for (const t of sim.towers) sim._refreshTower(t);
  }
  // the Seat Change takes effect
  const b = blockOf(len, p);
  if (b !== ty.seats.block) {
    ty.seats.block = b;
    ty.seats.holder = [];
    installRule(sim);
  }
  ty.breakMoves = [];
  storeBaseline(sim);
  if (ty.assign?.period !== p) drawAssignments(sim, p);
}

/** A foe spawned (Quick Answer's clock). */
export function tryoutSpawn(sim, e) {
  if (e.tier === 'boss' && e.parentUid == null) e.leak = TRYOUT.grades[sim.tryout.grade].bossLeak;
  if (sim.tryout.base) bossSpawned(sim, e);
}

/** A foe fell: the score. */
export function tryoutKill(sim, e) {
  sim.tryout.periodScore += killPoints(sim, e);
  bossGone(sim, e, false);
}

/** A foe leaked: −2 × its points. */
export function tryoutLeak(sim, e) {
  sim.tryout.periodScore -= TRYOUT.score.leakMul * pointsOf(e);
  bossGone(sim, e, true);
}

/** A per-owner counter (placed, spent, upgrades, sells, ults). */
export function tryoutCount(sim, owner, key, n = 1) {
  const c = sim.tryout.ctr[owner ?? 0];
  if (c) c[key] += n;
}

/** Placement price parts for player `owner`: a voucher (free) and that girl's cost cut. */
export function tryoutPlaceCost(sim, owner, unitId) {
  const p = sim.tryout.players[owner ?? 0];
  if (!p) return { free: false, cut: 0 };
  return { free: (p.vouchers[unitId] || 0) > 0, cut: costCutFor(sim, owner ?? 0, unitId) };
}

/** A girl's run ModSet as she is placed (before her stats resolve). */
export function tryoutTowerMods(sim, t) {
  t.runMods = runModsFor(sim, t.owner ?? 0, t.unitId, t.isHero);
}

/** A girl was placed: her voucher is used up if she was free; the counters. */
export function tryoutPlaced(sim, owner, t, cost) {
  const p = sim.tryout.players[owner ?? 0];
  if (!t.isHero && cost === 0 && p && (p.vouchers[t.unitId] || 0) > 0) {
    p.vouchers[t.unitId]--;
    t.gift = 1;
  }
  if (!t.isHero) tryoutCount(sim, owner, 'placed');
  tryoutCount(sim, owner, 'spent', cost);
}

/** Upgrade price: Free Refills (P06) for tiers 1-3 make it 0; Scholarship cuts it. */
export function tryoutUpgradeCost(sim, t, tierIndex) {
  const p = sim.tryout.players[t.owner ?? 0];
  if (!p || t.isHero) return { free: false, cut: 0 };
  const free = (p.refills[t.unitId] || 0) > 0 && tierIndex < PEP_CARDS.P06.maxTier;
  return { free, cut: costCutFor(sim, t.owner ?? 0, t.unitId) };
}

/** An upgrade was bought. */
export function tryoutUpgraded(sim, t, cost, tierIndex) {
  const p = sim.tryout.players[t.owner ?? 0];
  if (p && !t.isHero && cost === 0 && (p.refills[t.unitId] || 0) > 0 && tierIndex < PEP_CARDS.P06.maxTier) p.refills[t.unitId]--;
  tryoutCount(sim, t.owner, 'upgrades');
  tryoutCount(sim, t.owner, 'spent', cost);
}

/**
 * _checkWaveEnd, after the wave's own clear (before won / between): Snack Fund pays, Speed Round's clock,
 * and at a period's last wave the period ends: judge, bank the score, the period bonus, open each player's
 * pick (and break), draw the next period's assignments.
 */
export function tryoutWaveEnd(sim) {
  const ty = sim.tryout;
  const len = lengthOf(ty.length);
  boardWaveClear(sim);
  if (!ty.base) return;
  waveEndCheck(sim);
  const [, last] = periodWaves(len, ty.period);
  if (sim.wave !== last) return;
  const p = ty.period;
  const cleared = evaluatePeriod(sim);
  ty.periods.push({
    period: p,
    score: ty.periodScore,
    best: ty.best,
    team: ty.assign.team.map((x) => [x.id, x.st]),
    own: ty.assign.own.map((l) => l.map((x) => [x.id, x.st])),
    resumed: !!ty.assign.resumed,
  });
  ty.score += ty.periodScore;
  ty.lastIncome = sim.stats.cashEarned - ty.base.earned;
  const bonus = sim._gainCash((TRYOUT.stage.periodBonus.base + TRYOUT.stage.periodBonus.perPeriod * p) * sim.cashScale);
  if (bonus > 0) sim._emit('cash', { amount: bonus, reason: 'period' });
  boardPeriodEnd(sim);
  ty.players.forEach((pl, i) => {
    pl.cleared += cleared[i];
    if (cleared[i] >= 3) pl.erasers = Math.min(TRYOUT.erasers.max, pl.erasers + TRYOUT.erasers.perfectBonus);
  });
  ty.base = null;
  sim._emit('tryoutPeriod', { period: p, cleared, score: ty.periods[ty.periods.length - 1].score });
  if (p >= len.periods) {
    ty.done = true;
    return;
  }
  const pick = len.picks.indexOf(p) + 1;
  if (pick > 0) {
    ty.pickNo = pick;
    ty.players.forEach((pl, i) => {
      const credits = cleared[i] + pl.bank;
      pl.bank = 0;
      openOffer(sim, i, pick, credits);
      pl.win = 'pick';
      pl.winTicks = 0;
    });
  } else if (len.breaks[p]) ty.players.forEach((_, i) => openBreak(sim, i));
  drawAssignments(sim, p + 1);
  ty.players.forEach((pl, i) => { if (pl.gone) autoResolve(sim, i); });
  sim._autoTimer = -1;
}

/** The run's result block (Sim.result()): scores, assignments, picks. */
export function tryoutResult(sim) {
  const ty = sim.tryout;
  const per = TRYOUT.score;
  const runScore = ty.players.map((p) => Math.floor(((ty.score + per.perAssignment * p.cleared + per.perHeart * Math.max(0, sim.lives)) * (9 + ty.grade)) / 10));
  return {
    seed: ty.seed, grade: ty.grade, length: ty.length, mapId: ty.mapId, periods: ty.periods.map((x) => ({ ...x })),
    score: ty.score, runScore, cleared: ty.players.map((p) => p.cleared), moves: ty.moves,
    players: ty.players.map((p) => ({ squad: p.squad.slice(), cards: p.cards.map((c) => ({ ...c })), picks: p.picks.map((c) => ({ ...c })) })),
  };
}
