// Tryout Day (docs/specs/TRYOUT_DAY.md §3.4, §4.5, §5, §8): the pick's rarity and its cards. Every draw comes
// from a named stream of the run seed (`rarity:<pick>:<slot>`, `offer:<pick>:<slot>:<erasers>`); the inputs
// are run state and the board at that wave end, so a co-op peer, a reload and a Continue all agree. The open
// offer is stored in run state when it is made.
import { TRYOUT, PEP_CARDS, SCALE, TRYOUT_STUDENTS, MAP_WIDE } from '../../data/tryout.js';
import { stream, lengthOf, examPrepAt, lastPickAt, econOkAt, tryoutPickAt, lrCapAt, lastWaveOf } from './plan.js';
import { familySums, inSet, pairSide } from './pep.js';
import { enemyTraitKeys } from '../enemies.js';
import { TRAITS } from '../../data/types.js';

/** Content shipped so far: the first ship's cards and assignments (`ship`; M1 played the 20 `m1` cards). */
export const CONTENT = 'ship';
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
  if (examPrepAt(len, pick)) f = Math.max(f, TRYOUT.teacher.examPrep);
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

/** Squad girls (and the hero) in a Group card's set. */
function setCount(sim, owner, set) {
  return teamTargets(sim, owner).filter((u) => inSet(sim, set, u.id)).length;
}

/** Does a girl of the squad have a Hidden Talent card already (one per girl)? */
const hasTalent = (p, unit) => p.cards.some((x) => PEP_CARDS[x.id]?.group === 'talent' && x.unit === unit);
/** Varsity: from an arrival package or the Varsity Letter. */
export const hasVarsity = (p, unit) => !!p.varsity?.[unit] || p.cards.some((x) => PEP_CARDS[x.id]?.varsity && x.unit === unit);

/** Notes what an offer showed her (the Yearbook's seen Pep Talks and girls who tried out; once each, in order). */
function noteSeen(p, cards) {
  for (const c of cards || []) {
    const list = c.girl ? (p.tried || (p.tried = [])) : (p.seen || (p.seen = []));
    const id = c.girl || c.id;
    if (id && !list.includes(id)) list.push(id);
  }
}

/** Can this card be offered to this player at this pick (§4.5)? */
export function cardOk(sim, owner, inst, pick) {
  const ty = sim.tryout;
  const c = PEP_CARDS[inst.id];
  if (!live(c) || !c.rar.includes(inst.r)) return false;
  const p = ty.players[owner];
  const len = lengthOf(ty.length);
  const last = lastPickAt(len, pick);
  if (c.one && p.cards.some((x) => x.id === inst.id)) return false;
  if (c.team && ty.players.some((q) => q.cards.some((x) => x.id === inst.id))) return false;
  if (c.econ && !econOkAt(len, pick)) return false;
  if (c.solo && ty.coop) return false;
  if (c.next && last) return false;
  if (c.heals && !sim.canHeal()) return false;
  switch (c.group) {
    case 'personal':
      if (!p.squad.includes(inst.unit)) return false;
      if (c.reach && MAP_WIDE.includes(inst.unit)) return false;
      return !capped(sim, owner, inst, [{ id: inst.unit, hero: false }]);
    case 'everyone':
    case 'placement':
      return !capped(sim, owner, inst, teamTargets(sim, owner));
    case 'group':
      // two squad girls in the set (one at SSR and above), and room under the caps for at least one of them
      if (setCount(sim, owner, c.set) < (inst.r >= 2 ? 1 : 2)) return false;
      return !capped(sim, owner, inst, teamTargets(sim, owner).filter((u) => inSet(sim, c.set, u.id)));
    case 'talent':
      return p.squad.includes(c.unit) && inst.unit === c.unit && !hasTalent(p, c.unit);
    case 'build':
      if (c.pair) {
        // both halves in the squad (a girl or the hero)
        const defs = teamTargets(sim, owner).map((u) => sim.data.unit(u.id));
        return c.pair.every((half) => defs.some((d) => pairSide(d, half)));
      }
      if (c.varsity) return p.squad.includes(inst.unit) && !hasVarsity(p, inst.unit);
      return true;
    case 'capstone':
      if (c.girls) return squadRoom(sim, owner) > 0;
      return true;
    case 'board':
      return true;
    default:
      return false;
  }
}

const key = (inst) => (inst.girl ? `g:${inst.girl}` : inst.varsityGirl ? `v:${inst.varsityGirl}` : `${inst.id}:${inst.unit || ''}`);

function drawCard(sim, owner, rng, list, pick, taken, prev) {
  const ok = list.filter((inst) => !taken.has(key(inst)) && cardOk(sim, owner, inst, pick));
  const fresh = prev ? ok.filter((inst) => key(inst) !== key(prev)) : ok;
  const from = fresh.length ? fresh : ok;
  if (!from.length) return null;
  return rng.weighted(from, (inst) => inst.w || 1);
}

const ids = (test) => Object.entries(PEP_CARDS).filter(([, c]) => test(c)).map(([id]) => id);

/** Every Team card instance at rarity r (Everyone, Group, Placement). */
function teamList(r) {
  return ids((c) => c.group === 'everyone' || c.group === 'group' || c.group === 'placement').map((id) => ({ id, r }));
}

/** Every One-girl card instance at rarity r for a player's squad (3× toward placed girls). */
function personalList(sim, owner, r) {
  const p = sim.tryout.players[owner];
  const placed = placedOf(sim, owner);
  const out = [];
  for (const id of ids((c) => c.group === 'personal' || (c.group === 'build' && c.varsity))) {
    for (const u of p.squad) out.push({ id, unit: u, r, w: placed.has(u) ? 3 : 1 });
  }
  return out;
}

/** Hidden Talents for the squad's girls (SSR, or the pick's rarity up to UR). */
function talentList(sim, owner, r) {
  const p = sim.tryout.players[owner];
  return ids((c) => c.group === 'talent').map((id) => ({ id, unit: PEP_CARDS[id].unit, r: Math.min(3, Math.max(2, r)) })).filter((x) => p.squad.includes(x.unit));
}

/** Every Wild-only card at rarity r: Board cards, the UR build cards, the LR capstones. */
function wildList(r) {
  // the Wild slot's own cards weigh more than the Team and One-girl cards it can also show (§1.1: Board cards, the UR
  // and LR cards with drawbacks)
  return ids((c) => c.group === 'board' || c.group === 'build' || c.group === 'capstone').filter((id) => !PEP_CARDS[id].varsity)
    .map((id) => ({ id, r, w: PEP_CARDS[id].group === 'board' ? WILD_W.board : WILD_W.big }));
}
const WILD_W = { board: 4, big: 12 };

/** Room for one more girl type in this player's squad. */
export function squadRoom(sim, owner) {
  const ty = sim.tryout;
  const p = ty.players[owner];
  const max = (ty.coop ? TRYOUT.squad.coopMax : TRYOUT.squad.soloMax) + p.squadAdd;
  return max - p.squad.length;
}

/**
 * The traits of the next block (flyers, veiled, heavy armour, regeneration, spectral) the player's squad cannot answer
 * (§5 coverage): from the coming waves' spawn lists and each girl's capabilities (hers or a path's).
 * @returns {string[]} trait keys with no answer
 */
export function uncovered(sim, owner) {
  const ty = sim.tryout;
  const len = lengthOf(ty.length);
  const from = ty.period * len.wavesPerPeriod + 1;
  const to = Math.min(lastWaveOf(len), from + 2 * len.wavesPerPeriod - 1);
  const traits = new Set();
  for (let w = from; w <= to; w++) {
    for (const sp of sim._getWave(w).spawns) {
      const def = sim.data.enemy(sp.enemyId);
      if (!def) continue;
      for (const k of enemyTraitKeys(def)) if (COVER[k]) traits.add(k);
      if (def.armorClass === 'heavy') traits.add('armored');
      if (def.armorClass === 'spectral') traits.add('spectral');
    }
  }
  const p = ty.players[owner];
  const caps = new Set();
  const holy = [];
  for (const id of [...p.squad, sim.heroConfigs[owner]?.unitId].filter(Boolean)) {
    const def = sim.data.unit(id);
    for (const c of [...(def?.capabilities || []), ...(def?.pathCapabilities || [])]) caps.add(c);
    if (def?.attackType === 'holy') holy.push(id);
  }
  return [...traits].filter((k) => (k === 'spectral' ? !holy.length : !COVER[k].some((c) => caps.has(c))));
}

/** The answers to each covered trait (unit capability keys; spectral: a holy girl). */
const COVER = {
  airborne: TRAITS.airborne?.counters || ['antiAir'],
  veiled: TRAITS.veiled?.counters || ['detection', 'reveal'],
  armored: TRAITS.armored?.counters || ['armorPen', 'armorShred'],
  regen: TRAITS.regen?.counters || ['antiHeal'],
  spectral: [],
};

/** Does a girl answer one of these traits? */
function answers(sim, id, gaps) {
  const def = sim.data.unit(id);
  const caps = new Set([...(def?.capabilities || []), ...(def?.pathCapabilities || [])]);
  return gaps.some((k) => (k === 'spectral' ? def?.attackType === 'holy' : COVER[k].some((c) => caps.has(c))));
}

/**
 * Girls who can try out for this player (not in the squad), with their weights (§5): owned 1.5, not owned 1; a girl who
 * answers a gap of the next block +0.5; the girl declined at the last pick skipped once; a squad girl without Varsity
 * comes as a Varsity card (0.5). `gaps` (the coverage guarantee): only girls who answer them.
 */
export function girlList(sim, owner, { varsity = true, gaps = null } = {}) {
  const ty = sim.tryout;
  const p = ty.players[owner];
  const owned = sim._tryoutCfg?.pools[owner] || {};
  const need = gaps || uncovered(sim, owner);
  const out = TRYOUT_STUDENTS.filter((id) => !p.squad.includes(id) && id !== p.declined && sim.data.unit(id))
    .filter((id) => !gaps || answers(sim, id, gaps))
    .map((id) => ({ girl: id, w: (owned[id] ? TRYOUT.squad.owned : TRYOUT.squad.notOwned) + (need.length && answers(sim, id, need) ? 0.5 : 0) }));
  if (varsity && !gaps) for (const id of p.squad) if (!hasVarsity(p, id)) out.push({ varsityGirl: id, w: TRYOUT.squad.varsityWeight });
  return out;
}

function drawGirls(sim, owner, rng, n, prev = null, opts = {}) {
  const out = [];
  let list = girlList(sim, owner, opts);
  for (let i = 0; i < n && list.length; i++) {
    const avoid = prev?.[i] ? key(prev[i]) : null;
    const fresh = list.filter((g) => key(g) !== avoid);
    const g = rng.weighted(fresh.length ? fresh : list, (x) => x.w);
    out.push(g.girl ? { girl: g.girl } : { varsityGirl: g.varsityGirl });
    list = list.filter((x) => key(x) !== key(g));
  }
  return out;
}

/**
 * The offer's cards at its rarity. A Tryout pick: 3 girls. Otherwise Team · One girl · Wild (Multiple Choice: a second
 * Wild; the Varsity Letter's drawback: only 2 cards). At SSR+ the One-girl slot is a Hidden Talent half the time when
 * a squad girl has none; at UR+ the Wild slot draws from the build cards and capstones too. The Wild card is a girl 30 %
 * of the time while the squad has room (forced after 3 picks without one); the coverage guarantee draws her from the
 * girls who answer the next block. `prev`: the cards an Eraser replaces.
 */
export function drawOffer(sim, owner, pick, rarity, erasers, prev = null) {
  const ty = sim.tryout;
  const p = ty.players[owner];
  const len = lengthOf(ty.length);
  const rng = stream(ty.seed, `offer:${pick}:${owner}:${erasers}`);
  const tryoutPick = (tryoutPickAt(len, pick) || p.tryoutNext) && squadRoom(sim, owner) > 0;
  if (tryoutPick) return { kind: 'girls', cards: drawGirls(sim, owner, rng, 3, prev, { varsity: false }) };
  const two = p.nextCards === 2 || !!(prev && prev.two);
  const taken = new Set();
  const team = drawCard(sim, owner, rng, teamList(rarity), pick, taken, prev?.[0]) || { id: 'E01', r: rarity };
  taken.add(key(team));
  let one = null;
  if (rarity >= 2 && rng.next() < 0.5) one = drawCard(sim, owner, rng, talentList(sim, owner, rarity), pick, taken, prev?.[1]);
  if (!one) one = drawCard(sim, owner, rng, personalList(sim, owner, rarity), pick, taken, prev?.[1]) || { id: 'P01', unit: p.squad[0], r: rarity };
  taken.add(key(one));
  const cards = [team, one];
  const wilds = two ? 0 : 1 + (p.extraCards || 0);
  for (let i = 0; i < wilds; i++) {
    const prevW = prev?.[2 + i];
    let wild = null;
    const girlRoll = rng.next() * 100;
    if (i === 0 && squadRoom(sim, owner) > 0 && (girlRoll < TRYOUT.squad.girlChance || p.pity.noGirl >= TRYOUT.squad.forceAfter)) {
      const gaps = uncovered(sim, owner);
      const g = drawGirls(sim, owner, rng, 1, prevW ? [prevW] : null, gaps.length ? { varsity: false, gaps } : {});
      if (g.length) wild = gaps.length && g[0].girl ? { ...g[0], cover: gaps } : g[0];
    }
    if (!wild) {
      const pool = [...teamList(rarity), ...personalList(sim, owner, rarity), ...wildList(rarity), ...(rarity >= 2 ? talentList(sim, owner, rarity) : [])];
      // an LR pick shows an LR capstone in the Wild slot when one is eligible (§4.2)
      const cap = rarity === 4 ? drawCard(sim, owner, rng, wildList(4).filter((x) => PEP_CARDS[x.id].group === 'capstone'), pick, taken, prevW) : null;
      wild = cap || drawCard(sim, owner, rng, pool, pick, taken, prevW);
    }
    if (wild) {
      cards.push(wild);
      taken.add(key(wild));
    }
  }
  return { kind: 'cards', cards: cards.map(({ w, ...c }) => c) };
}

/**
 * Whole Class Turns Up (X02): 4 girls, the player takes 2, both with the SSR arrival package (§4.3).
 * @returns {object} the follow-up offer
 */
export function classOffer(sim, owner, pick) {
  const ty = sim.tryout;
  const p = ty.players[owner];
  const rng = stream(ty.seed, `offer:${pick}:${owner}:class`);
  const girls = drawGirls(sim, owner, rng, PEP_CARDS.X02.of, null, { varsity: false });
  p.seq++;
  p.offer = { seq: p.seq, pick, rarity: PEP_CARDS.X02.arrival, credits: 0, floor: 0, kind: 'girls', cards: girls, erasers: 0, multi: PEP_CARDS.X02.girls, follow: true };
  noteSeen(p, girls);
  return p.offer;
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
  const w = rarityWeights(band, k, floor, p.lr >= lrCapAt(len, pick));
  const rarity = rollRarity(stream(ty.seed, `rarity:${pick}:${owner}`), w);
  const drawn = drawOffer(sim, owner, pick, rarity, 0);
  const two = p.nextCards === 2 && drawn.kind === 'cards';
  delete p.nextCards; // (the Varsity Letter's drawback is spent on this pick)
  p.seq++;
  p.offer = { seq: p.seq, pick, rarity, credits: k, floor, kind: drawn.kind, cards: drawn.cards, erasers: 0, ...(two ? { two: true } : null) };
  noteSeen(p, drawn.cards);
  return p.offer;
}

/** Eraser: redraws every card at the same rarity; refused when no slot can change (§8.2). */
export function eraseOffer(sim, owner) {
  const ty = sim.tryout;
  const p = ty.players[owner];
  const o = p.offer;
  if (!o) return { ok: false, reason: 'noOffer' };
  if (p.erasers <= 0) return { ok: false, reason: 'noEraser' };
  if (o.follow) return { ok: false, reason: 'noOther' };
  const prev = Object.assign(o.cards.slice(), { two: !!o.two });
  const drawn = drawOffer(sim, owner, o.pick, o.rarity, o.erasers + 1, prev);
  const same = drawn.cards.length === o.cards.length && drawn.cards.every((c, i) => key(c) === key(o.cards[i]));
  if (same) return { ok: false, reason: 'noOther' };
  p.erasers--;
  o.erasers++;
  o.cards = drawn.cards;
  noteSeen(p, drawn.cards);
  o.kind = drawn.kind;
  p.seq++;
  o.seq = p.seq;
  return { ok: true };
}
