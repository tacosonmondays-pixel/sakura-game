// Tryout Day's pick sheet numbers (docs/specs/TRYOUT_DAY.md §3.4, §4.4, §13.6): each Pep Talk card's cap bar (how
// full its main family's cap is for the girl it reaches now, and after taking it), and the MORE sheet's odds table and
// per-girl caps. Read-only: the real fold (src/sim/tryout/pep.js familySums / runModsFor / cardFactor) runs on a view
// of the run with the card added, never on the Sim's own state.
import { PEP_CARDS, TRYOUT, MAP_WIDE } from '../../../data/tryout.js';
import { cardMods, cardTargets, familySums, runModsFor, cardFactor } from '../../../sim/tryout/pep.js';
import { rarityWeights } from '../../../sim/tryout/offers.js';
import { UNIT_MAP } from '../../../data/units.js';
import { CAP_TEXT } from '../../text/tryout.js';

/** The families a cap bar can show: the run key → its cap key in TRYOUT.caps and how its numbers read. */
export const BAR_FAMILIES = Object.freeze({
  damageMul: { cap: 'damageMul', unit: 'pct' },
  rateMul: { cap: 'rateMul', unit: 'pct' },
  range: { cap: 'range', unit: 'tiles' },
  critChance: { cap: 'critChance', unit: 'pct' },
  critMul: { cap: 'critMul', unit: 'plain' },
  pierce: { cap: 'pierce', unit: 'count' },
  projectiles: { cap: 'projectiles', unit: 'count' },
  chain: { cap: 'chain', unit: 'count' },
  splash: { cap: 'splash', unit: 'tiles' },
  airMul: { cap: 'vs', unit: 'pct' },
  eliteMul: { cap: 'vs', unit: 'pct' },
  bossMul: { cap: 'vs', unit: 'pct' },
  barrierMul: { cap: 'vs', unit: 'pct' },
  dotMul: { cap: 'vs', unit: 'pct' },
  costCut: { cap: 'costCut', unit: 'cut' },
  auraRange: { cap: 'range', unit: 'tiles' },
  auraPoints: { cap: 'auraPoints', unit: 'points' },
});

const round = (v, d = 100) => Math.round(v * d) / d;
/**
 * A family value as words: +36%, +0.3 tiles (bare: +0.3, the bar's now and after), +6 points, +1, +0.15; a cost cut
 * always reads as a cut (−10%, its cap −30%), as on the MORE sheet.
 */
export function fmtFam(unit, v, { sign = true, bare = false } = {}) {
  const s = sign ? (v < 0 ? '−' : '+') : '';
  const a = Math.abs(v);
  if (unit === 'cut') return `${a > 0 ? '−' : ''}${round(a * 100, 10)}%`;
  if (unit === 'pct') return `${s}${round(a * 100, 10)}%`;
  if (unit === 'tiles') return `${s}${round(a)}${bare ? '' : ' tiles'}`;
  if (unit === 'points') return `${s}${round(a * 100, 10)}`;
  return `${s}${round(a)}`;
}

/**
 * A card's main family (the first capped key of its numbers at its rarity), or null (board cards, talents, pairs, …).
 * @returns {{ key: string, cls: string|null, value: number }|null}
 */
export function mainFamily(inst) {
  const c = PEP_CARDS[inst.id];
  if (!c || c.group === 'talent' || c.group === 'board' || c.pair || c.varsity) return null;
  const m = cardMods(c, inst.r);
  if (!m) return null;
  for (const [k, v] of Object.entries(m)) {
    if (k === 'classMul' && v && typeof v === 'object') {
      const [cls, x] = Object.entries(v)[0] || [];
      if (cls) return { key: 'classMul', cls, value: x };
    }
    if (k in BAR_FAMILIES && typeof v === 'number' && v > 0) return { key: k, cls: null, value: v };
  }
  return null;
}

/** Everyone of a player's a card can reach: the squad girls, then the hero. */
function team(sim, owner) {
  const p = sim.tryout.players[owner];
  const out = (p?.squad || []).map((id) => ({ id, hero: false }));
  const hero = sim.heroConfigs?.[owner]?.unitId || (owner === 0 ? sim.heroConfig?.unitId : null);
  if (hero) out.push({ id: hero, hero: true });
  return out;
}

/** A view of the run with one more card in this player's hand (for the fold only; the Sim is never touched). */
export function withCard(sim, owner, inst) {
  const ty = sim.tryout;
  return {
    data: sim.data, towers: sim.towers, heroConfigs: sim.heroConfigs, heroConfig: sim.heroConfig,
    tryout: { ...ty, players: ty.players.map((p, i) => (i === owner ? { ...p, cards: [...p.cards, { ...inst }] } : p)) },
  };
}

const famOf = (s, fam) => (fam.key === 'classMul' ? s.classMul[fam.cls] || 0 : s[fam.key] || 0);
/** The "vs" families runModsFor trims to the run-damage room left after damage and crit (src/sim/tryout/pep.js). */
const VS_TRIMMED = new Set(['airMul', 'eliteMul', 'bossMul', 'barrierMul', 'classMul']);
/** A family's value in a girl's real run fold (runModsFor: capped, then the vs bonus trimmed to the room left). */
function foldOf(sim, owner, u, t, fam) {
  let m = runModsFor(sim, owner, u.id, u.hero, t);
  if (Array.isArray(m)) m = m[0];
  if (!m) return 0;
  const v = fam.key === 'classMul' ? m.classMul?.[fam.cls] : m[fam.key];
  return typeof v === 'number' ? Math.max(0, v - 1) : 0;
}
const towerOf = (sim, owner, u) => sim.towers?.find((t) => !t.removed && t.unitId === u.id && !!t.isHero === u.hero && (t.owner ?? 0) === owner) || null;

/**
 * The cap bar of one Pep Talk card (§13.6): for the girl it reaches (a Team / Group card: the one the cap cuts most),
 * the family's value now and after the card (both capped), the cap, and on how many of its girls it adds in full.
 * @param {object} sim the Sim (read only)
 * @param {number} owner
 * @param {{ id: string, unit?: string, r: number }} inst the offered card
 * @returns {null | { key: string, cls: string|null, unit: string, cap: number, who: string, hero: boolean,
 *   now: number, after: number, value: number, full: number, of: number, text: string, nowText: string, afterText: string, capText: string }}
 */
export function capBar(sim, owner, inst) {
  const fam = mainFamily(inst);
  if (!fam || !sim?.tryout?.players?.[owner]) return null;
  const def = fam.key === 'classMul' ? { cap: 'vs', unit: 'pct' } : BAR_FAMILIES[fam.key];
  const cap = TRYOUT.caps[def.cap];
  if (!(cap > 0)) return null;
  const view = withCard(sim, owner, inst);
  const rows = [];
  for (const u of team(sim, owner)) {
    if (!cardTargets(sim, inst, u.id, u.hero)) continue;
    if ((fam.key === 'range') && MAP_WIDE.includes(u.id)) continue; // (map-wide girls take no reach)
    const t = towerOf(sim, owner, u);
    const before = famOf(familySums(sim, owner, u.id, u.hero, t), fam);
    // (a placement card adds only where she stands: the bar shows what it gives once the placement holds)
    const placement = PEP_CARDS[inst.id].group === 'placement';
    const after = placement ? before + fam.value : famOf(familySums(view, owner, u.id, u.hero, t), fam);
    let now = Math.min(cap, before);
    let then = Math.min(cap, after);
    // a "vs" bonus counts inside the run-damage cap: now and after from the real fold on the view (a girl at her damage
    // cap gets only the room left, R2 review)
    if (VS_TRIMMED.has(fam.key) && !placement) {
      now = foldOf(sim, owner, u, t, fam);
      then = Math.max(now, foldOf(view, owner, u, t, fam));
    }
    const value = Math.max(0, after - before);
    rows.push({ u, now, after: then, value, cut: value - (then - now) });
  }
  if (!rows.length) return null;
  // the girl the cap cuts most (ties: the fullest)
  rows.sort((a, b) => b.cut - a.cut || b.now - a.now);
  const top = rows[0];
  const full = rows.filter((r) => r.cut <= 1e-9).length;
  const famName = fam.key === 'classMul' ? CAP_TEXT.cls(fam.cls) : CAP_TEXT.fam[fam.key] || fam.key;
  const nowText = fmtFam(def.unit, top.now, { bare: true });
  const afterText = fmtFam(def.unit, top.after, { bare: true });
  const capText = fmtFam(def.unit, cap, { sign: false });
  // a Team or Group card that adds in full to everyone it reaches: only the value it adds ("Damage +6% to all 5")
  const all = rows.length > 1 && full === rows.length;
  const addText = fmtFam(def.unit, top.value, { bare: true });
  return {
    key: fam.key, cls: fam.cls, unit: def.unit, cap, who: top.u.id, hero: top.u.hero, now: top.now, after: top.after, value: top.value,
    full, of: rows.length, all, famName, nowText, afterText, addText, capText,
    text: all ? CAP_TEXT.toAll(famName, addText, rows.length) : CAP_TEXT.label(famName, nowText, afterText, capText),
  };
}

/** The girl's display name for a bar ("Kage"; a hero reads as herself). */
export const barWho = (bar) => UNIT_MAP[bar.who]?.name || bar.who;

/**
 * The odds table for this pick (§3.4): every credit row of the pick's band with this pick's Teacher's Note floor and the
 * LR cap applied (rarityWeights, as the roll used them), in whole percents; `current` marks the row of the credits held.
 * @param {{ band: string, credits: number, floor: number, lrOff: boolean }} o
 */
export function oddsTable({ band, credits, floor = 0, lrOff = false }) {
  const rows = [];
  for (let c = 0; c <= TRYOUT.creditsMax; c++) {
    const w = rarityWeights(band, c, floor, lrOff);
    const tot = w.reduce((a, b) => a + b, 0) || 1;
    rows.push({ credits: c, pct: w.map((x) => Math.round((100 * x) / tot)), current: c === Math.min(TRYOUT.creditsMax, credits) });
  }
  return rows;
}

/**
 * The per-girl caps (§4.4) with the highest value any of this player's girls has now (from the real fold: a map-wide
 * girl takes no reach, the "vs" bonuses as trimmed to the run-damage room, Run damage with her Window Seat).
 * @returns {{ id: string, cap: string, top: string|null, who: string|null }[]}
 */
export function capsTable(sim, owner) {
  const c = TRYOUT.caps;
  const girls = sim?.tryout?.players?.[owner] ? team(sim, owner) : [];
  const sums = girls.map((u) => {
    const t = towerOf(sim, owner, u);
    let m = runModsFor(sim, owner, u.id, u.hero, t);
    if (Array.isArray(m)) m = m[0];
    return { u, t, s: familySums(sim, owner, u.id, u.hero, t), m: m || null };
  });
  const best = (fn) => {
    let top = null;
    for (const x of sums) {
      const v = fn(x.s, x.u, x);
      if (v > 0 && (!top || v > top.v)) top = { v, u: x.u };
    }
    return top;
  };
  const pick = (key) => best((s, u) => (key === 'range' && MAP_WIDE.includes(u.id) ? 0 : Math.min(c[BAR_FAMILIES[key]?.cap || key] ?? Infinity, s[key] || 0)));
  // (the largest "vs" bonus a girl's fold gives: flyers, barriers, elites, bosses, a class, burns and poisons)
  const vsTop = best((s, u, x) => {
    const m = x.m || {};
    return Math.max(0, ...[m.airMul, m.eliteMul, m.bossMul, m.barrierMul, m.dotMul, ...Object.values(m.classMul || {})].map((v) => (v || 1) - 1));
  });
  // (her cards' whole damage factor times her Window Seat's bonus, as the seat clamp keeps it under the cap)
  const runTop = best((s, u, x) => {
    const f = Math.min(c.runDamage, cardFactor({ runMods: x.m }) * (x.t?.padMul || 1));
    return f > 1 + 1e-9 ? f : 0;
  });
  const who = (t) => (t ? UNIT_MAP[t.u.id]?.name || t.u.id : null);
  const row = (id, cap, top, fmt) => ({ id, cap, top: top ? fmt(top.v) : null, who: who(top) });
  const crit = pick('critChance');
  const critM = pick('critMul');
  const hits = ['pierce', 'projectiles', 'chain'].map(pick);
  return [
    row('damageMul', fmtFam('pct', c.damageMul), pick('damageMul'), (v) => fmtFam('pct', v)),
    row('rateMul', fmtFam('pct', c.rateMul), pick('rateMul'), (v) => fmtFam('pct', v)),
    row('range', fmtFam('tiles', c.range), pick('range'), (v) => fmtFam('tiles', v)),
    { id: 'crit', cap: `${fmtFam('pct', c.critChance)} / ${fmtFam('plain', c.critMul)}`, top: crit || critM ? `${fmtFam('pct', crit?.v || 0)} / ${fmtFam('plain', critM?.v || 0)}` : null, who: who(crit || critM) },
    { id: 'hits', cap: `+${c.pierce} / +${c.projectiles} / +${c.chain}`, top: hits.some(Boolean) ? hits.map((x) => `+${round(x?.v || 0)}`).join(' / ') : null, who: who(hits.find(Boolean)) },
    row('splash', fmtFam('tiles', c.splash), pick('splash'), (v) => fmtFam('tiles', v)),
    row('vs', fmtFam('pct', c.vs), vsTop, (v) => fmtFam('pct', v)),
    row('costCut', fmtFam('cut', c.costCut), pick('costCut'), (v) => fmtFam('cut', v)),
    row('runDamage', `×${c.runDamage}`, runTop, (v) => `×${round(v)}`),
  ];
}
