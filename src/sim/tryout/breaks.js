// Tryout Day (docs/specs/TRYOUT_DAY.md §6): Window Seats, the Seat Change, Hall Passes, Snack and Brush Up.
// Seats are drawn for every block at the run's start (`seats:<block>`), shown one block ahead and switched at
// the next period's start. A seat's holder is stored: the first girl to sit keeps it until she leaves it, so
// a moved girl with an older uid never takes a held seat and a co-op partner's girl never takes yours.
import { TRYOUT, PEP_CARDS } from '../../data/tryout.js';
import { PATH_HALF_WIDTH } from '../placement.js';
import { aimMode, signalRange, hasRoamingDrones } from '../towers.js';
import { stream, lengthOf, blockOf } from './plan.js';
import { seatBonus, cardFactor } from './pep.js';

/** Seats drawn per block (more than any run can use: the count in play is the Grade's + cards). */
const SEATS_DRAWN = 6;
const STEP = 0.5;

/**
 * Every block's seat positions, seeded: land spots 1.2-2.6 tiles from the road, weighted by how much road
 * lies within 3 tiles, at least `spacing` apart. Integer weights; positions on a half-tile lattice.
 */
export function drawSeats(sim, seed, blocks) {
  const pl = sim.placement;
  const map = sim.map;
  const s = TRYOUT.seats;
  const samples = [];
  for (const p of sim._pathsFwd) {
    for (let d = 0; d <= p.length; d += 0.5) {
      const seg = p.points;
      samples.push(pointOn(seg, d));
    }
  }
  const cands = [];
  for (let y = STEP / 2; y < map.height; y += STEP) {
    for (let x = STEP / 2; x < map.width; x += STEP) {
      const ch = pl.terrainAt(x, y);
      if (ch !== '.' && ch !== ',') continue;
      const d = pl.pathDistance(x, y) - PATH_HALF_WIDTH;
      if (d < s.minDist || d > s.maxDist) continue;
      if (pl.obstacleDistance(x, y) < 0.5) continue;
      let w = 0;
      for (const q of samples) if ((q[0] - x) * (q[0] - x) + (q[1] - y) * (q[1] - y) <= 9) w++;
      if (w > 0) cands.push({ x, y, w });
    }
  }
  const out = [];
  for (let b = 0; b < blocks; b++) {
    const rng = stream(seed, `seats:${b}`);
    const list = [];
    let pool = cands.slice();
    while (list.length < SEATS_DRAWN && pool.length) {
      const c = rng.weighted(pool, (o) => o.w);
      list.push({ x: c.x, y: c.y, r: s.radius });
      pool = pool.filter((o) => (o.x - c.x) * (o.x - c.x) + (o.y - c.y) * (o.y - c.y) >= s.spacing * s.spacing);
    }
    out.push(list);
  }
  return out;
}

/** A point at distance d along a polyline of [x, y] points (no trig). */
function pointOn(pts, d) {
  let rest = d;
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1][0];
    const ay = pts[i - 1][1];
    const dx = pts[i][0] - ax;
    const dy = pts[i][1] - ay;
    const L = Math.sqrt(dx * dx + dy * dy);
    if (rest <= L || i === pts.length - 1) {
      const k = L > 0 ? Math.min(1, rest / L) : 0;
      return [ax + dx * k, ay + dy * k];
    }
    rest -= L;
  }
  return pts[0] ? [pts[0][0], pts[0][1]] : [0, 0];
}

/** How many seats are in play now (the Grade's, one more in co-op, Sunny Window SSR). */
export function seatCount(sim) {
  const ty = sim.tryout;
  const g = TRYOUT.grades[ty.grade];
  return Math.min(SEATS_DRAWN, g.seats + (ty.coop ? 1 : 0) + seatBonus(sim).add);
}

/** The seats of block b in play. */
export function seatsOf(sim, b) {
  const list = sim.tryout.seats.blocks[b] || [];
  return list.slice(0, seatCount(sim));
}

const inside = (t, p) => (t.x - p.x) * (t.x - p.x) + (t.y - p.y) * (t.y - p.y) <= p.r * p.r;

/**
 * The run's seat assigner (replaces the lowest-uid pad rule for runs, rules.js assignPads): stored holders,
 * students only; a free seat goes to the earliest break mover inside it, else the lowest uid inside.
 * Sets padIndex / onPad / padMul / padRangeAdd, with the cards × seat clamp (§4.4).
 */
export function assignSeats(sim) {
  const ty = sim.tryout;
  const pads = sim.rule?.pads || [];
  const holder = ty.seats.holder;
  holder.length = pads.length;
  const held = new Set();
  for (let i = 0; i < pads.length; i++) {
    const t = holder[i] != null ? sim.getTower(holder[i]) : null;
    if (t && !t.isHero && inside(t, pads[i]) && !held.has(t.uid)) held.add(t.uid);
    else holder[i] = null;
  }
  const order = ty.breakMoves;
  for (let i = 0; i < pads.length; i++) {
    if (holder[i] != null) continue;
    let best = null;
    let bestRank = Infinity;
    for (const t of sim.towers) {
      if (t.isHero || held.has(t.uid) || !inside(t, pads[i])) continue;
      const k = order.indexOf(t.uid);
      const rank = k >= 0 ? k - 1e6 : t.uid;
      if (rank < bestRank) {
        best = t;
        bestRank = rank;
      }
    }
    holder[i] = best ? best.uid : null;
    if (best) held.add(best.uid);
  }
  const bonus = seatBonus(sim);
  const seatMul = 1 + bonus.dmg;
  const cap = TRYOUT.caps.runDamage;
  for (const t of sim.towers) {
    const i = holder.indexOf(t.uid);
    const card = cardFactor(t);
    const mul = i >= 0 ? Math.min(seatMul, Math.max(1, cap / card)) : 1;
    const add = i >= 0 ? bonus.reach : 0;
    if ((t.padIndex ?? -1) === i && t.padMul === mul && t.padRangeAdd === add) continue;
    t.padIndex = i;
    t.onPad = i >= 0;
    t.padMul = mul;
    t.padRangeAdd = add;
    sim._buffsDirty = true;
  }
}

// ---------------------------------------------------------------------------
// Hall Passes (§6.3, §6.4)
// ---------------------------------------------------------------------------

/**
 * Can player `owner` move her girl `uid` to (x, y) now? Only during her break, her own student, a pass in
 * hand (moving back to where she stood at the break's start is free), a legal spot.
 * @returns {{ ok: boolean, reason: string|null, cost?: number }}
 */
export function canMoveGirl(sim, owner, uid, x, y) {
  const ty = sim.tryout;
  const p = ty?.players[owner];
  if (!p || p.win !== 'break') return { ok: false, reason: 'notBreak' };
  const t = sim.getTower(uid);
  if (!t || (t.owner ?? 0) !== owner) return { ok: false, reason: 'notYours' };
  if (t.isHero) return { ok: false, reason: 'hero' };
  if (!Number.isFinite(x) || !Number.isFinite(y) || !sim.placement.inBounds(x, y)) return { ok: false, reason: 'outOfBounds' };
  const home = p.start[uid];
  const back = !!home && home[0] === x && home[1] === y;
  if (!back && p.passes <= 0) return { ok: false, reason: 'noPass' };
  const geo = sim.placement.check(t.def, x, y, sim.towers.filter((o) => o !== t));
  if (geo) return { ok: false, reason: geo };
  return { ok: true, reason: null, cost: back ? -(p.used[uid] || 0) : 1 };
}

/** Puts a girl somewhere else and applies the §6.4 table. */
function relocateGirl(sim, t, x, y) {
  sim._relocate(t, x, y);
  // Ouka's Rally Banners beyond her banner reach are picked up (she plants them again)
  const h = t.stats?.hub;
  if (t.banners?.length && h) {
    const r2 = h.bannerReach * h.bannerReach;
    t.banners = t.banners.filter((b) => (b.x - x) * (b.x - x) + (b.y - y) * (b.y - y) <= r2);
    if (!t.banners.length) delete t.banners;
  }
  // a mirror or checkpoint aim is clamped to her reach from the new spot
  const mode = aimMode(t);
  if (t.aim && (mode === 'mirror' || mode === 'checkpoint')) sim.setAim(t.uid, t.aim.x, t.aim.y);
  // Chika's Hold and Patrol points outside her signal range: back to Hover
  if (hasRoamingDrones(t) && t.flight && (t.flight.mode === 'hold' || t.flight.mode === 'patrol')) {
    const r = signalRange(t);
    const far = (px, py) => (px - x) * (px - x) + (py - y) * (py - y) > r * r;
    if (far(t.flight.ax, t.flight.ay) || far(t.flight.bx, t.flight.by)) sim.setFlight(t.uid, 'hover');
  }
}

/** A Hall Pass move (the `mv` command). */
export function moveGirl(sim, owner, uid, x, y) {
  const chk = canMoveGirl(sim, owner, uid, x, y);
  if (!chk.ok) return chk;
  const ty = sim.tryout;
  const p = ty.players[owner];
  const t = sim.getTower(uid);
  if (!p.start[uid]) p.start[uid] = [t.x, t.y];
  p.undo.push({ uid, x: t.x, y: t.y, passes: p.passes, used: p.used[uid] || 0 });
  if (chk.cost > 0) {
    p.passes -= 1;
    p.used[uid] = (p.used[uid] || 0) + 1;
  } else {
    p.passes = Math.min(TRYOUT.passes.max, p.passes - chk.cost);
    p.used[uid] = 0;
  }
  ty.moves++;
  if (!ty.breakMoves.includes(uid)) ty.breakMoves.push(uid);
  relocateGirl(sim, t, x, y);
  sim._emit('tryoutMove', { towerUid: uid, x, y, owner });
  return { ok: true, reason: null };
}

/** Undo: takes back the player's last move and refunds its pass. */
export function undoMove(sim, owner) {
  const p = sim.tryout.players[owner];
  if (!p || p.win !== 'break') return { ok: false, reason: 'notBreak' };
  const m = p.undo.pop();
  if (!m) return { ok: false, reason: 'nothing' };
  const t = sim.getTower(m.uid);
  p.passes = m.passes;
  p.used[m.uid] = m.used;
  if (t) relocateGirl(sim, t, m.x, m.y);
  sim._emit('tryoutMove', { towerUid: m.uid, x: m.x, y: m.y, owner, undo: true });
  return { ok: true, reason: null };
}

/** A break opens for a player: her passes for this break and a clean Undo stack. */
export function openBreak(sim, owner) {
  const ty = sim.tryout;
  const p = ty.players[owner];
  const g = TRYOUT.grades[ty.grade];
  const draw = p.cards.filter((x) => PEP_CARDS[x.id]?.draw?.passes).reduce((a, x) => a + PEP_CARDS[x.id].draw.passes, 0);
  p.passes = Math.max(0, Math.min(TRYOUT.passes.max, p.passes + g.passes + p.passBonus + draw));
  p.win = 'break';
  p.undo = [];
  p.start = {};
  p.used = {};
  p.snack = false;
}

/** Snack: heal hearts (at full hearts: +5 max; where nothing heals: +1 Hall Pass). Once per break. */
export function snack(sim, owner) {
  const ty = sim.tryout;
  const p = ty.players[owner];
  if (!p || p.win !== 'break') return { ok: false, reason: 'notBreak' };
  if (p.snack) return { ok: false, reason: 'used' };
  p.snack = true;
  if (!sim.canHeal()) {
    p.passes = Math.min(TRYOUT.passes.max, p.passes + 1);
    return { ok: true, reason: null };
  }
  const s = TRYOUT.snack;
  const heal = ty.coop ? s.coopHeal : s.heal;
  if (sim.lives >= sim.maxLives) {
    const rise = Math.min(s.fullMax, Math.max(0, TRYOUT.heartsMaxRise - ty.heartsAdded));
    ty.heartsAdded += rise;
    sim.maxLives += rise;
    sim.lives += rise;
  } else sim.lives = Math.min(sim.maxLives, sim.lives + heal);
  return { ok: true, reason: null };
}

/** Brush Up: one scaling Pep Talk the player owns goes up one rarity (max UR). Once per break, instead of Snack. */
export function brushUp(sim, owner, index) {
  const p = sim.tryout.players[owner];
  if (!p || p.win !== 'break') return { ok: false, reason: 'notBreak' };
  if (p.snack) return { ok: false, reason: 'used' };
  const inst = p.cards[index];
  const c = inst && PEP_CARDS[inst.id];
  if (!c || (!c.mods && !c.steps) || c.rar.length < 4 || inst.r >= 3) return { ok: false, reason: 'invalid' };
  p.snack = true;
  inst.r++;
  return { ok: true, reason: null, refresh: true };
}

/** The block whose seats are in play during period p, and the next block's (shown one ahead). */
export function seatBlocks(sim, p) {
  const len = lengthOf(sim.tryout.length);
  const b = blockOf(len, p);
  return { now: b, next: Math.min(len.blocks.length - 1, b + 1) };
}

/** During a break: the next block's seats (shown dashed, §6.2), else []. Read-only, for the board. */
export function nextSeats(sim) {
  const ty = sim.tryout;
  if (!ty.players.some((p) => p.win === 'break')) return [];
  const len = lengthOf(ty.length);
  const b = blockOf(len, Math.min(len.periods, ty.period + 1));
  if (b === ty.seats.block) return [];
  return seatsOf(sim, b).map((p) => ({ x: p.x, y: p.y, r: p.r }));
}
