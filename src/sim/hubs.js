// The rule-changing campus hub (Ouka, Student Council President; docs/specs/UNIT_GAPS.md §5.5, P-9):
// she never attacks. Girls inside her office radius (or within bannerRange of one of her banners)
// follow her rules: cheaper upgrades, free first tiers, a better sell value, faster ability charge,
// Veil Sight, anti-air, a cleanse that blocks sabotage, a type-chart floor and stat bonuses. Kills
// inside her radius pay her owner extra coins.
//
// State:
//   t.rules   { src, freeTiers, sellMul, cdCut, airGrant, typeFloor } on a covered girl; absent on
//             every other girl (so a battle without a hub never carries the field). Stat keys (costCut,
//             rateMul, rangeMul, dmgMul, detection, cleanse) fold into her t.buff with the auras: the
//             strongest per key wins, so the base discount does not stack with Momo's Coupon Book.
//   t.banners [{ x, y }] on a hub girl with Rally Banner, oldest first (set by the aim command;
//             they stay at the wave clear and ride in the battle save).
//
// Determinism: squared distances, placement order (ties go to the girl placed first), max / OR merges,
// whole coins through the owner-credited wallet; no rng, no trig.

import { AIM_QUANT } from './constants.js';

const HUBS = [];

/** The hub girls that can rule now (placement order; a sabotaged hub rules nobody). Reused array. */
export function hubsOn(sim) {
  HUBS.length = 0;
  for (const a of sim.towers) if (a.stats?.hub && !a.removed && !(a.disabled > 0)) HUBS.push(a);
  return HUBS;
}

/** Does hub `a` cover point (x, y): her office radius, or (banners: true) one of her banners? */
export function hubCovers(a, x, y, banners = true) {
  const h = a.stats.hub;
  const dx = a.x - x;
  const dy = a.y - y;
  if (dx * dx + dy * dy <= h.radius * h.radius) return true;
  if (!banners || !a.banners?.length) return false;
  const r2 = h.bannerRange * h.bannerRange;
  for (const b of a.banners) {
    const bx = b.x - x;
    const by = b.y - y;
    if (bx * bx + by * by <= r2) return true;
  }
  return false;
}

const sameRules = (a, b) => a.freeTiers === b.freeTiers && a.sellMul === b.sellMul && a.cdCut === b.cdCut
  && a.airGrant === b.airGrant && a.typeFloor === b.typeFloor && a.src === b.src;

/**
 * recomputeBuffs, after the auras (src/sim/towers.js): the hubs covering girl `t` fold their stat keys
 * into `nb` (strongest wins; `by` records the winner for the buff icons) and their rule keys into
 * t.rules. Never her own rules. @returns {boolean} t.rules changed (her effective stats need a refresh)
 */
// BALANCE MEASUREMENT ONLY (revert before any commit): BAL_RULE=ouka multiplies the strongest office's keys on top
const BAL_OUKA = (globalThis.process?.env?.BAL_RULE || '').split(',').includes('ouka');
// (round 2: the last call's office multipliers, read by the monotone hero layer in towers.js)
export const BAL_HUB_OM = { r: 1, g: 1, d: 1 };

export function applyHubs(t, nb, by, hubs) {
  let r = null;
  const om = { r: 1, g: 1, d: 1 };
  BAL_HUB_OM.r = 1; BAL_HUB_OM.g = 1; BAL_HUB_OM.d = 1;
  for (let i = 0; i < hubs.length; i++) {
    const a = hubs[i];
    if (a === t || !hubCovers(a, t.x, t.y)) continue;
    const h = a.stats.hub;
    if (!r) r = { src: a.uid, freeTiers: 0, sellMul: 0, cdCut: 0, airGrant: false, typeFloor: 0 };
    if (BAL_OUKA) {
      if (h.rateMul > om.r) om.r = h.rateMul;
      if (h.rangeMul > om.g) om.g = h.rangeMul;
      if (h.dmgMul > om.d) om.d = h.dmgMul;
      if (h.costCut > nb.costCut) { nb.costCut = h.costCut; by.cost = a.uid; }
      if (h.detection && !nb.detection) { nb.detection = true; by.det = a.uid; }
      if (h.cleanse && !nb.cleanse) { nb.cleanse = true; by.cleanse = a.uid; }
      if (h.freeTiers > r.freeTiers) r.freeTiers = h.freeTiers;
      if (h.sellMul > r.sellMul) r.sellMul = h.sellMul;
      if (h.cdCut > r.cdCut) r.cdCut = h.cdCut;
      if (h.airGrant) r.airGrant = true;
      if (h.typeFloor > r.typeFloor) r.typeFloor = h.typeFloor;
      continue;
    }
    if (h.costCut > nb.costCut) { nb.costCut = h.costCut; by.cost = a.uid; }
    if (h.rateMul > nb.rateMul) { nb.rateMul = h.rateMul; by.rate = a.uid; }
    if (h.rangeMul > nb.rangeMul) { nb.rangeMul = h.rangeMul; by.range = a.uid; }
    if (h.dmgMul > nb.dmgMul) { nb.dmgMul = h.dmgMul; by.dmg = a.uid; }
    if (h.detection && !nb.detection) { nb.detection = true; by.det = a.uid; }
    if (h.cleanse && !nb.cleanse) { nb.cleanse = true; by.cleanse = a.uid; }
    if (h.freeTiers > r.freeTiers) r.freeTiers = h.freeTiers;
    if (h.sellMul > r.sellMul) r.sellMul = h.sellMul;
    if (h.cdCut > r.cdCut) r.cdCut = h.cdCut;
    if (h.airGrant) r.airGrant = true;
    if (h.typeFloor > r.typeFloor) r.typeFloor = h.typeFloor;
  }
  if (BAL_OUKA) {
    nb.rateMul *= om.r;
    nb.rangeMul *= om.g;
    nb.dmgMul *= om.d;
    BAL_HUB_OM.r = om.r; BAL_HUB_OM.g = om.g; BAL_HUB_OM.d = om.d;
  }
  const old = t.rules;
  if (!r) {
    if (!old) return false;
    delete t.rules; // (absent, not null: a girl restored from a save has no such field)
    return true;
  }
  if (old && sameRules(old, r)) return false;
  t.rules = r;
  return true;
}

/** Free tiers: tier `index` (0-based) of any path costs nothing for a girl her rules cover (never a hero). */
export function isFreeTier(t, index) {
  return !t.isHero && index != null && index < (t.rules?.freeTiers || 0);
}

/**
 * Sponsorship / Golden Charter (Sim._killEnemy): a kill inside a hub's office radius pays her owner
 * killBounty coins (the strongest hub covering the spot; ties: the one placed first). Banners do not
 * count. Scaled like income; nothing where income is off. @returns {number} coins paid
 */
export function payHubBounty(sim, e) {
  if (sim.diff.noIncome) return 0;
  let best = null;
  for (const a of sim.towers) {
    const h = a.stats?.hub;
    if (!h || !(h.killBounty > 0) || a.removed || a.disabled > 0) continue;
    if (best && h.killBounty <= best.stats.hub.killBounty) continue;
    if (hubCovers(a, e.x, e.y, false)) best = a;
  }
  if (!best) return 0;
  const coins = best.stats.hub.killBounty * (sim.diff.cashMul ?? 1) * (sim.incomeMul ?? 1);
  const paid = sim._gainCashFor(best.owner ?? 0, coins);
  if (paid > 0) sim._emit('cash', { amount: paid, reason: 'bounty', towerUid: best.uid, owner: best.owner ?? 0 });
  return paid;
}

/**
 * Rally Banner (Sim.setAim for a hub girl): a banner at (x, y), clamped to bannerReach of her. A girl
 * holds `banners` of them; a new one past that moves the oldest. Positions are quantised like every aim.
 */
export function plantBanner(sim, t, x, y) {
  const h = t.stats.hub;
  let ax = x;
  let ay = y;
  const dx = ax - t.x;
  const dy = ay - t.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > h.bannerReach * h.bannerReach) {
    const k = h.bannerReach / Math.sqrt(d2);
    ax = Math.round((t.x + dx * k) * AIM_QUANT) / AIM_QUANT;
    ay = Math.round((t.y + dy * k) * AIM_QUANT) / AIM_QUANT;
  }
  const list = t.banners || (t.banners = []);
  list.push({ x: ax, y: ay });
  while (list.length > h.banners) list.shift();
  t.aim = { x: ax, y: ay };
  sim._buffsDirty = true;
  return t.aim;
}

/** Banners down (the panel's "Auto"). */
export function clearBanners(sim, t) {
  if (t.banners) delete t.banners;
  sim._buffsDirty = true;
}
