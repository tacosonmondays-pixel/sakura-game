// Tryout Day (docs/specs/TRYOUT_DAY.md §3.4, §4.5, §5, §8): the pick's rarity and its cards. Every draw comes
// from a named stream of the run seed (`rarity:<pick>:<slot>`, `offer:<pick>:<slot>:<erasers>`); the inputs
// are run state and the board at that wave end, so a co-op peer, a reload and a Continue all agree. The open
// offer is stored in run state when it is made.
import { TRYOUT, PEP_CARDS, SCALE, TRYOUT_STUDENTS, MAP_WIDE } from '../../data/tryout.js';
import { stream, lengthOf } from './plan.js';
import { familySums } from './pep.js';

/** Content shipped so far: M1 offers only the `m1` cards (the first ship adds every `ship` card). */
export const CONTENT = 'm1';
const live = (c) => !!c && !!c[CONTENT];

/** A rarity row with floors and the LR cap applied; weights in percent. */
export function rarityWeights(band, credits, floor, lrOff) {
  const w = TRYOUT.odds[band][Math.min(TRYOUT.creditsMax, Math.max(0, credits))].slice();
  for (let i = 0; i < floor; i++) w[i] = 0;
  if (lrOff) {
    w[3] += w[4];
    w[4] = 0;
  }
  if (w.every((x) => x === 0)) w[Math.min(floor, lrOff ? 3 : 4)] = 1;
  return w;
}

/** Teacher's Note floor for a player's next pick (§3.4). */
export function pityFloor(p, pick, len) {
  let f = 0;
  if (p.pity.r >= TRYOUT.teacher.rStreak) f = Math.max(f, 1);
  if (p.pity.noSsr >= TRYOUT.teacher.noSsr) f = Math.max(f, 2);
  if (pick === len.examPrep) f = Math.max(f, TRYOUT.teacher.examPrep);
  return f;
}

/** Rolls one rarity from integer weights (one draw). */
export function rollRarity(rng, w) {
  const tot = w.reduce((a, b) => a + b, 0);
  let x = Math.floor(rng.next() * tot);
  for (let i = 0; i < 5; i++) {
    x -= w[i];
    if (x < 0) return i;
  }
  return 4;
}

/** Owned girls this player has placed (for Personal weights). */
function placedOf(sim, owner) {
  const s = new Set();
  for (const t of sim.towers) if (!t.isHero && (t.owner ?? 0) === owner) s.add(t.unitId);
  return s;
}

/**
 * Would at least half of this card's value be cut by a cap for every target? (§4.5 filter 2). Only the
 * main family of the card is checked (damage, speed, reach, crit, a vs bonus).
 */
function capped(sim, owner, inst, targets) {
  const c = PEP_CARDS[inst.id];
  const mods = c.steps ? c.steps[inst.r] : c.mods;
  if (!mods) return false;
  const k = c.steps ? 1 : SCALE[inst.r];
  const caps = TRYOUT.caps;
  const capOf = { damageMul: caps.damageMul, rateMul: caps.rateMul, range: caps.range, critChance: caps.critChance, airMul: caps.vs, eliteMul: caps.vs, barrierMul: caps.vs, costCut: caps.costCut };
  if (mods.classMul) {
    // a vs-armour card (Can Opener): capped when every class it lifts is within half its value of the vs cap
    for (const u of targets) {
      const s = familySums(sim, owner, u.id, u.hero);
      if (Object.entries(mods.classMul).some(([c, x]) => caps.vs - (s.classMul[c] || 0) >= (x * k) / 2)) return false;
    }
    return true;
  }
  const key = Object.keys(mods).find((x) => x in capOf);
  if (!key) return false;
  const v = mods[key] * k;
  for (const u of targets) {
    const s = familySums(sim, owner, u.id, u.hero);
    if (capOf[key] - s[key] >= v / 2) return false;
  }
  return true;
}

/** Everyone a Team card reaches: the player's squad and hero. */
function teamTargets(sim, owner) {
  const p = sim.tryout.players[owner];
  const out = p.squad.map((id) => ({ id, hero: false }));
  const h = sim.heroConfigs[owner];
  if (h) out.push({ id: h.unitId, hero: true });
  return out;
}

/** Can this card be offered to this player at this pick (§4.5)? */
export function cardOk(sim, owner, inst, pick) {
  const ty = sim.tryout;
  const c = PEP_CARDS[inst.id];
  if (!live(c) || !c.rar.includes(inst.r)) return false;
  const p = ty.players[owner];
  const len = lengthOf(ty.length);
  const last = pick === len.picks.length;
  if (c.one && p.cards.some((x) => x.id === inst.id)) return false;
  if (c.team && ty.players.some((q) => q.cards.some((x) => x.id === inst.id))) return false;
  if (c.econ && pick > len.picks.length - 2) return false;
  if (c.solo && ty.coop) return false;
  if (c.next && last) return false;
  if (c.heals && !sim.canHeal()) return false;
  if (c.group === 'personal') {
    if (!p.squad.includes(inst.unit)) return false;
    if (c.reach && MAP_WIDE.includes(inst.unit)) return false;
    return !capped(sim, owner, inst, [{ id: inst.unit, hero: false }]);
  }
  if (c.group === 'everyone') return !capped(sim, owner, inst, teamTargets(sim, owner));
  return c.group === 'board';
}

const key = (inst) => (inst.girl ? `g:${inst.girl}` : `${inst.id}:${inst.unit || ''}`);

function drawCard(sim, owner, rng, list, pick, taken, prev) {
  const ok = list.filter((inst) => !taken.has(key(inst)) && cardOk(sim, owner, inst, pick));
  const fresh = prev ? ok.filter((inst) => key(inst) !== key(prev)) : ok;
  const from = fresh.length ? fresh : ok;
  if (!from.length) return null;
  return rng.weighted(from, (inst) => inst.w || 1);
}

/** Every Team card instance at rarity r. */
function teamList(r) {
  return Object.entries(PEP_CARDS).filter(([, c]) => c.group === 'everyone' || c.group === 'group').map(([id]) => ({ id, r }));
}

/** Every One-girl card instance at rarity r for a player's squad (3× toward placed girls). */
function personalList(sim, owner, r) {
  const p = sim.tryout.players[owner];
  const placed = placedOf(sim, owner);
  const out = [];
  for (const [id, c] of Object.entries(PEP_CARDS)) {
    if (c.group !== 'personal') continue;
    for (const u of p.squad) out.push({ id, unit: u, r, w: placed.has(u) ? 3 : 1 });
  }
  return out;
}

function boardList(r) {
  return Object.entries(PEP_CARDS).filter(([, c]) => c.group === 'board').map(([id]) => ({ id, r }));
}

/** Room for one more girl type in this player's squad. */
export function squadRoom(sim, owner) {
  const ty = sim.tryout;
  const p = ty.players[owner];
  const max = (ty.coop ? TRYOUT.squad.coopMax : TRYOUT.squad.soloMax) + p.squadAdd;
  return max - p.squad.length;
}

/** Girls who can try out for this player (not in the squad), with their weights (§5). */
export function girlList(sim, owner) {
  const ty = sim.tryout;
  const p = ty.players[owner];
  const owned = sim._tryoutCfg?.pools[owner] || {};
  return TRYOUT_STUDENTS.filter((id) => !p.squad.includes(id) && id !== p.declined && sim.data.unit(id))
    .map((id) => ({ girl: id, w: owned[id] ? TRYOUT.squad.owned : TRYOUT.squad.notOwned }));
}

function drawGirls(sim, owner, rng, n, prev = null) {
  const out = [];
  let list = girlList(sim, owner);
  for (let i = 0; i < n && list.length; i++) {
    const avoid = prev?.[i]?.girl;
    const fresh = list.filter((g) => g.girl !== avoid);
    const g = rng.weighted(fresh.length ? fresh : list, (x) => x.w);
    out.push({ girl: g.girl });
    list = list.filter((x) => x.girl !== g.girl);
  }
  return out;
}

/**
 * The offer's cards at its rarity (a Tryout pick: 3 girls). `prev`: the cards an Eraser replaces (each
 * slot tries a different card first).
 */
export function drawOffer(sim, owner, pick, rarity, erasers, prev = null) {
  const ty = sim.tryout;
  const p = ty.players[owner];
  const len = lengthOf(ty.length);
  const rng = stream(ty.seed, `offer:${pick}:${owner}:${erasers}`);
  const tryoutPick = (len.tryoutPicks.includes(pick) || p.tryoutNext) && squadRoom(sim, owner) > 0;
  if (tryoutPick) return { kind: 'girls', cards: drawGirls(sim, owner, rng, 3, prev) };
  const taken = new Set();
  const team = drawCard(sim, owner, rng, teamList(rarity), pick, taken, prev?.[0]) || { id: 'E01', r: rarity };
  taken.add(key(team));
  const one = drawCard(sim, owner, rng, personalList(sim, owner, rarity), pick, taken, prev?.[1]) || { id: 'P01', unit: p.squad[0], r: rarity };
  taken.add(key(one));
  // the Wild card: a girl 30 % of the time while the squad has room (forced after 3 picks without one)
  let wild = null;
  const girlRoll = rng.next() * 100;
  if (squadRoom(sim, owner) > 0 && (girlRoll < TRYOUT.squad.girlChance || p.pity.noGirl >= TRYOUT.squad.forceAfter)) {
    const g = drawGirls(sim, owner, rng, 1, prev?.[2]?.girl ? [prev[2]] : null);
    if (g.length) wild = g[0];
  }
  if (!wild) wild = drawCard(sim, owner, rng, [...teamList(rarity), ...personalList(sim, owner, rarity), ...boardList(rarity)], pick, taken, prev?.[2]);
  const cards = [team, one];
  if (wild) cards.push(wild);
  return { kind: 'cards', cards: cards.map(({ w, ...c }) => c) };
}

/**
 * Opens a player's pick: credits, the rarity roll and the cards; stored in run state.
 * @returns {object} the offer
 */
export function openOffer(sim, owner, pick, credits) {
  const ty = sim.tryout;
  const p = ty.players[owner];
  const len = lengthOf(ty.length);
  const band = len.bands[pick - 1] || 'late';
  const k = Math.min(TRYOUT.creditsMax, credits);
  const floor = pityFloor(p, pick, len);
  const w = rarityWeights(band, k, floor, p.lr >= len.lrCap);
  const rarity = rollRarity(stream(ty.seed, `rarity:${pick}:${owner}`), w);
  const drawn = drawOffer(sim, owner, pick, rarity, 0);
  p.seq++;
  p.offer = { seq: p.seq, pick, rarity, credits: k, floor, kind: drawn.kind, cards: drawn.cards, erasers: 0 };
  return p.offer;
}

/** Eraser: redraws every card at the same rarity; refused when no slot can change (§8.2). */
export function eraseOffer(sim, owner) {
  const ty = sim.tryout;
  const p = ty.players[owner];
  const o = p.offer;
  if (!o) return { ok: false, reason: 'noOffer' };
  if (p.erasers <= 0) return { ok: false, reason: 'noEraser' };
  const drawn = drawOffer(sim, owner, o.pick, o.rarity, o.erasers + 1, o.cards);
  const same = drawn.cards.length === o.cards.length && drawn.cards.every((c, i) => key(c) === key(o.cards[i]));
  if (same) return { ok: false, reason: 'noOther' };
  p.erasers--;
  o.erasers++;
  o.cards = drawn.cards;
  o.kind = drawn.kind;
  p.seq++;
  o.seq = p.seq;
  return { ok: true };
}
