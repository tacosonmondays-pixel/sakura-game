// LR units and Limit Break (docs/specs/BANNERS.md §C.2-§C.4, docs/specs/DUO_LR.md §5). An LR unit is pulled in
// SSR form, becomes UR at ★5 like every SSR, and becomes LR through Limit Break: level 60 with all 5 gates and
// ★5, a one-time fee, then her trial stage (solo, from the player's own copy, no Support Student). The first
// clear makes her LR and pays 300 gems + 1 Recruit Ticket once. Pure functions, no DOM; not co-op hashed.
//
// Counters (missions.counters, numbers; older builds keep them word for word):
//   lbt:<unit>   1 = the Limit Break fee is paid (her trial is open)
//   lr:<unit>    1 = she is LR (her trial was cleared; the reward was paid with it)

import { UNIT_MAP } from '../data/units.js';
import { isLegendUnit } from '../data/banners.js';
import { materialId, zenithId } from '../data/items.js';
import { consumeItems, itemCount } from './inventory.js';
import { gameWeekNumber, gameDayStart } from '../core/reset.js';

/** Level and gates "max out" means (J6: level 60 with all 5 gates, one copy reaches it). */
export const LB_LEVEL = 60;
export const LB_GATES = 5;
export const LB_STARS = 5;
export const LB_REWARD = Object.freeze([{ id: 'gems', count: 300 }, { id: 'ticket_recruit', count: 1 }]);

/**
 * Each LR unit's trial. `standIn` is what counts until her own stage exists: a win on that stage and
 * difficulty with her placed from the player's own loadout, solo, with no Support Student (§C.2).
 * `null` = her trial has not shipped yet ("LR form coming").
 */
export const LR_TRIALS = Object.freeze({
  kohaku_tsubaki: { name: 'Starfall Trial', form: 'Prismfall · Twin Star · beams to the map edge (3% past her reach) · +10% damage', crest: 'twin stars', standIn: { stageId: '8-5', difficulty: 'nightmare' } },
  // her own stage ("prove the theory": armoured elites and two bosses) comes later; until then the same stand-in
  tenka: { name: 'Thesis Defense', form: 'Critical Mass · Event Horizon', crest: 'orbit ring', standIn: { stageId: '8-5', difficulty: 'nightmare' } },
});

const cnt = (p, k) => Number(p?.missions?.counters?.[k]) || 0;
const counters = (p) => ((p.missions ||= {}).counters ||= {});

/** The one-time Limit Break fee: 450,000 coins, 6 legendary + 3 Zenith of her family, 1 Rainbow Crown (§C.2). */
export function limitBreakFee(unitId) {
  const fam = UNIT_MAP[unitId]?.materialFamily || 'ember';
  return [
    { id: 'coins', count: 450000 },
    { id: materialId(fam, 'legendary'), count: 6 },
    { id: zenithId(fam), count: 3 },
    { id: 'crown_rainbow', count: 1 },
  ];
}

/** Is she LR (Limit Break cleared)? Only an LR unit can be. */
export function isLR(profile, unitId) {
  return isLegendUnit(unitId) && !!profile?.units?.[unitId] && cnt(profile, `lr:${unitId}`) >= 1;
}

/**
 * Where she stands on the climb: { legend, owned, ur, maxed, feePaid, lr, trial, steps: [{ key, label, done }],
 * canPay, missing: [{ id, need, have }] }.
 */
export function limitBreakState(profile, unitId) {
  const legend = isLegendUnit(unitId);
  const st = profile?.units?.[unitId];
  const owned = !!st;
  const ur = owned && (Number(st.awaken) || 0) >= LB_STARS;
  const maxed = owned && (Number(st.level) || 1) >= LB_LEVEL && (Number(st.breakthrough) || 0) >= LB_GATES;
  const feePaid = cnt(profile, `lbt:${unitId}`) >= 1;
  const lr = isLR(profile, unitId);
  const trial = LR_TRIALS[unitId] ?? null;
  const fee = limitBreakFee(unitId);
  const missing = fee.map((f) => ({ id: f.id, need: f.count, have: itemCount(profile, f.id) })).filter((f) => f.have < f.need);
  return {
    legend, owned, ur, maxed, feePaid, lr, trial, fee, missing,
    canPay: legend && owned && ur && maxed && !feePaid && !!trial && missing.length === 0,
    steps: [
      { key: 'level', label: `L${LB_LEVEL}`, done: maxed },
      { key: 'ur', label: '★5', done: ur },
      { key: 'fee', label: 'Fee', done: feePaid },
      { key: 'trial', label: trial?.name || 'Trial', done: lr },
    ],
  };
}

/** Pay the Limit Break fee (opens her trial). @returns {{ ok: boolean, error?: 'notLegend'|'notOwned'|'notUR'|'notMaxed'|'paid'|'noTrial'|'funds' }} */
export function payLimitBreak(profile, unitId) {
  const s = limitBreakState(profile, unitId);
  if (!s.legend) return { ok: false, error: 'notLegend' };
  if (!s.owned) return { ok: false, error: 'notOwned' };
  if (s.feePaid || s.lr) return { ok: false, error: 'paid' };
  if (!s.trial) return { ok: false, error: 'noTrial' };
  if (!s.ur) return { ok: false, error: 'notUR' };
  if (!s.maxed) return { ok: false, error: 'notMaxed' };
  if (!consumeItems(profile, s.fee)) return { ok: false, error: 'funds' };
  counters(profile)[`lbt:${unitId}`] = 1;
  return { ok: true };
}

/**
 * After a solo battle (rewards.js applyBattleResult): a won trial (or its stand-in) with her placed from the
 * player's own copy and no Support Student makes her LR, once. Co-op never unlocks things (it never calls this).
 * @returns {string[]} the units that became LR (empty almost always)
 */
export function creditLimitBreak(profile, result, difficulty) {
  if (!result?.won || result.support || result.coop || result.sandbox) return [];
  const placed = new Set(Object.values(result.stats?.towerUnits || {}));
  const out = [];
  for (const [unitId, trial] of Object.entries(LR_TRIALS)) {
    if (!trial || !profile.units?.[unitId] || cnt(profile, `lbt:${unitId}`) < 1 || cnt(profile, `lr:${unitId}`) >= 1) continue;
    const t = trial.standIn;
    if (result.stageId !== t.stageId || difficulty !== t.difficulty || !placed.has(unitId)) continue;
    counters(profile)[`lr:${unitId}`] = 1; // her reward rides the battle's rewards (rewards.js adds LB_REWARD)
    out.push(unitId);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The stat boosts (§C.3): UR Resonance (every SSR at ★5) and Limit Break (LR), along her own Potential axis
// ---------------------------------------------------------------------------

/**
 * The boosts switch on at the first weekly reset after their release (BANNERS §C.3), so a Titan board week is never
 * split between boosted and unboosted runs. A game-day key inside the first week they count (set at ship: the
 * Monday-keyed day after the release's first Sunday 7 PM Central).
 */
export const RESONANCE_FROM_DAY = '2026-11-02';
export const resonanceOn = (now = Date.now()) => gameWeekNumber(+now) >= gameWeekNumber(gameDayStart(RESONANCE_FROM_DAY));

/** UR Resonance: damage ×1.10 and attack speed ×1.04; an aura girl's aura bonus ×1.10 (J7, first pass). */
export const UR_RESONANCE = Object.freeze({ damage: 1.1, rate: 1.04, aura: 1.1 });
/** Limit Break (LR), on top: damage ×1.15 and attack speed ×1.05; an aura girl's aura bonus ×1.15. */
export const LR_BOOST = Object.freeze({ damage: 1.15, rate: 1.05, aura: 1.15 });

/**
 * Her rank boosts: { ur, lr, damage, rate, aura } as multipliers (1 when none). `track` is her Potential stat
 * track: 'aura' girls get the aura factor and their own shots' speed; everyone else damage and speed (the
 * coins track has no battle-coin stat in the loadout yet, so it takes the attacker factors: owner question).
 */
export function rankBoost(profile, unitId, track = null, now = Date.now()) {
  const def = UNIT_MAP[unitId];
  const st = profile?.units?.[unitId];
  const ur = !!def && def.rarity === 'SSR' && (Number(st?.awaken) || 0) >= LB_STARS;
  const lr = ur && isLR(profile, unitId);
  // (her LR form, `lr`, is not a stat boost: it stays on from Limit Break; the factors wait for their week)
  const on = resonanceOn(now);
  const f = (k) => (on && ur ? UR_RESONANCE[k] : 1) * (on && lr ? LR_BOOST[k] : 1);
  const aura = track === 'aura';
  return { ur, lr, damage: aura ? 1 : f('damage'), rate: f('rate'), aura: aura ? f('aura') : 1 };
}
