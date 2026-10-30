// Heroes (docs/specs/HERO_REWORK.md): free to deploy, they level 1–25 inside each battle from
// time in a wave, wave clears and the damage they deal (with a stage pace so short stages play the
// same arc as long ones), buy the rest of a level with coins, grow +3 % damage a level (Mastery past
// Lv 25), rank their ultimate at Lv 10 and 20, and can be moved (no selling).
//
// View rule (co-op): nothing called from inside the step reads sim.hero / sim.heroConfig (they
// follow the viewing / commanding player); tickHero and the wave-clear XP loop over sim.heroes.
// Only the command functions below (heroLevelStatus, buyHeroLevel, canMoveHero, moveHero,
// heroUltStatus, activateUlt) take the active hero, through their Sim wrappers.
// Ult shapes: nova (centred on the hero or on her aim point) / timeWarp / tide / strike / runner (Seiran's
// dragon, Kogane's plow with `push`) / barricade (Norika's Hold the Line); any ult may add a team damage buff
// (dmgBuff, roster B3). Kogane's Move keys: heroMoveCooldown / heroMoveDowntime.

import { BATTLE } from '../data/types.js';
import { HERO_XP_STEPS, HERO_LEVEL_PRICES, HERO_XP, HERO_MOVE } from '../data/heroTracks.js';
import { ULT_INITIAL_CHARGE, KNOCKBACK_RESIST, DEFAULT_UNIT_STATS, HERO_MOVE_CD_MIN, HERO_MOVE_DOWNTIME_MIN } from './constants.js';
import { buffDur, statusCtxFor } from './setRules.js';
import { SKILL_HASTE_CAP, ULT_HASTE_MAX } from './gearRules.js';
import { normalizeBase } from './mods.js';
import { applyStatus } from './status.js';
import { syncStatusFlags, placeOnPath } from './enemies.js';
import { ultWithPotential } from './potential.js';
import { isEligible } from './combat.js';
import { startRunner, runnerSegment } from './runners.js';
import { targetScore, refreshEffective } from './towers.js';
import { resiteBarricades, holdTheLine } from './barricades.js';

/** XP for each level-up 2..25 (a hero's own `levelXp`, else the shared table). */
export function heroSteps(heroDef) {
  return heroDef?.levelXp || HERO_XP_STEPS;
}

/** Coins for each level 2..25 from an empty bar (a hero's own `levelPrices`, else the shared table). */
export function heroPrices(heroDef) {
  return heroDef?.levelPrices || HERO_LEVEL_PRICES;
}

/** Cumulative XP needed to reach `level` (level 1 = 0; a level past the hero's steps = Infinity). */
export function xpToReach(heroDef, level) {
  const steps = heroSteps(heroDef);
  let total = 0;
  for (let l = 2; l <= level; l++) total += steps[l - 2] ?? Infinity;
  return total;
}

/** Level for an accumulated XP total. */
export function levelForXp(heroDef, xp) {
  let level = 1;
  while (level < BATTLE.maxHeroLevel && xp >= xpToReach(heroDef, level + 1)) level++;
  return level;
}

/** XP stops counting here: Lv 25 plus every Mastery step (74,280 with the shared tables). */
export function heroXpCap(heroDef) {
  const top = xpToReach(heroDef, BATTLE.maxHeroLevel);
  const steps = HERO_XP.masteryXp > 0 && HERO_XP.masteryStep > 0 ? Math.round(HERO_XP.masteryMax / HERO_XP.masteryStep) : 0;
  return top + steps * HERO_XP.masteryXp;
}

/**
 * Stage pace k = clamp(refWaves / totalWaves, 1, paceMax): wave n of a short stage counts as wave
 * n × k of a long one, k times, and time XP is × k. Endless (or no wave count) = 1.
 */
export function heroPace(sim) {
  const n = sim.totalWaves;
  if (!Number.isFinite(n) || !(n > 0)) return 1;
  return Math.min(HERO_XP.paceMax, Math.max(1, HERO_XP.refWaves / n));
}

/** XP every placed hero gets for clearing wave n at pace k. */
export function waveClearXp(n, k = 1) {
  return (HERO_XP.waveBase + HERO_XP.wavePer * n * k) * k;
}

/** XP for damage dealt, measured in the enemy's base HP (stage / difficulty / co-op HP do not change it). */
export function damageXp(dealt, e) {
  const m = e && e.hpMul > 0 ? e.hpMul : 1;
  return (dealt / m) * HERO_XP.perBaseHp;
}

/** Mastery damage bonus (0 below Lv 25): +masteryStep per masteryXp past Lv 25, at most masteryMax. */
export function heroMastery(hero) {
  if (!hero || hero.level < BATTLE.maxHeroLevel || !(HERO_XP.masteryXp > 0)) return 0;
  const past = hero.xp - xpToReach(hero.def.hero, BATTLE.maxHeroLevel);
  if (!(past > 0)) return 0;
  return Math.min(HERO_XP.masteryMax, Math.floor(past / HERO_XP.masteryXp) * HERO_XP.masteryStep);
}

/** Ult rank: 1, plus one for every reached `ult.ranks` level. */
export function ultRank(hero) {
  let r = 1;
  for (const k of hero?.def?.hero?.ult?.ranks || []) if (hero.level >= k.level) r++;
  return r;
}

/**
 * The ult effect at her current rank (each reached rank's partial effect merged over the base), then
 * her Potential `ult` steps (src/sim/potential.js N4; absent at P1).
 */
export function ultEffect(hero) {
  const ult = hero.def.hero.ult;
  let e = ult.effect || { type: 'nova', damage: 0, radius: 0 };
  for (const k of ult.ranks || []) if (hero.level >= k.level && k.effect) e = { ...e, ...k.effect };
  const pu = hero.stats?.ult;
  return pu ? ultWithPotential(e, pu) : e;
}

/** Effective ult cooldown: reached ranks' cooldownMul, then ultHaste plus her Potential haste (capped at -50%). */
export function ultCooldown(hero) {
  const ult = hero.def.hero?.ult;
  if (!ult) return Infinity;
  let cd = ult.cooldown ?? 60;
  for (const k of ult.ranks || []) if (hero.level >= k.level && k.cooldownMul > 0) cd *= k.cooldownMul;
  const pot = hero.stats?.ult?.haste || 0;
  const gear = hero.unitStats?.ultHaste || 0;
  // (LR gear's raised cap: her own gear haste above 50 % lifts the ceiling, up to ULT_HASTE_MAX)
  const cap = Math.min(ULT_HASTE_MAX, Math.max(SKILL_HASTE_CAP, gear));
  const haste = Math.min(cap, Math.max(0, pot > 0 ? gear + pot : gear));
  return cd * (1 - haste);
}

function maybeUnlockUlt(hero) {
  const ult = hero.def.hero?.ult;
  if (!ult || hero.ultUnlocked) return;
  if (hero.level >= (ult.unlockLevel ?? 3)) {
    hero.ultUnlocked = true;
    hero.ultCooldown = ultCooldown(hero) * ULT_INITIAL_CHARGE;
  }
}

/** Initialises hero-only fields on a freshly placed hero tower. */
export function initHero(hero) {
  hero.level = 1;
  hero.xp = 0;
  hero.ultUnlocked = false;
  hero.ultCooldown = 0;
  hero.levelSpent = 0;
  hero.levelsBought = 0;
  hero.mastery = 0;
  hero.moveCd = 0;
  hero.moveLock = 0;
  maybeUnlockUlt(hero);
}

/**
 * Adds XP from `src` ('time' | 'wave' | 'damage' | 'bought' | 'restore'); levels up (one
 * 'heroLevel' event per level), feeds Mastery at Lv 25 and refreshes her stats when either changes.
 * `atLeast` (a bought level) lifts the total to that threshold so float rounding cannot leave it short.
 * @returns {number} levels gained
 */
export function gainHeroXp(sim, hero, amount, src = 'damage', atLeast = null) {
  if (!hero || hero.removed || !(amount > 0)) return 0;
  const hd = hero.def.hero;
  const cap = heroXpCap(hd);
  if (!(hero.xp < cap)) return 0;
  const add = Math.min(amount, cap - hero.xp);
  hero.xp += add;
  if (atLeast != null && hero.xp < atLeast) hero.xp = atLeast;
  const xs = sim.stats?.heroXp;
  if (xs) xs[src] = (xs[src] || 0) + add;
  let gained = 0;
  while (hero.level < BATTLE.maxHeroLevel && hero.xp >= xpToReach(hd, hero.level + 1)) {
    hero.level++;
    gained++;
    sim._emit('heroLevel', { level: hero.level, towerUid: hero.uid });
  }
  if (gained) maybeUnlockUlt(hero);
  const m = heroMastery(hero);
  const mastered = m !== (hero.mastery || 0);
  if (mastered) {
    hero.mastery = m;
    sim._emit('heroMastery', { towerUid: hero.uid, bonus: m });
  }
  if (gained || mastered) sim._refreshTower(hero);
  return gained;
}

/** XP progress for UI: { level, xp, current, next, mastery } (next = null at max level). */
export function heroXpInfo(hero) {
  const hd = hero.def.hero;
  const cur = xpToReach(hd, hero.level);
  const next = hero.level >= BATTLE.maxHeroLevel ? null : xpToReach(hd, hero.level + 1);
  return { level: hero.level, xp: hero.xp, current: cur, next, mastery: hero.mastery || 0 };
}

/**
 * Per step, for every placed hero (never the view-dependent sim.hero): move timers count down in
 * any state; time XP (× the stage pace) and the ult charge only run during a wave.
 */
export function tickHero(sim, dt) {
  const list = sim.heroes;
  if (!list) return;
  const wave = sim.state === 'wave';
  const k = wave ? heroPace(sim) : 1;
  for (let i = 0; i < list.length; i++) {
    const h = list[i];
    if (!h || h.removed) continue;
    if (h.moveCd > 0) h.moveCd = Math.max(0, h.moveCd - dt);
    if (h.moveLock > 0) h.moveLock = Math.max(0, h.moveLock - dt);
    // Overdrive runs in wave time and ends with the wave (a calm point holds none)
    if (h.overdriveLeft > 0) {
      h.overdriveLeft = wave ? Math.max(0, h.overdriveLeft - dt) : 0;
      if (h.overdriveLeft === 0) refreshEffective(h, sim.globalRateMul, sim.globalDmgMul);
    }
    if (!wave) continue;
    gainHeroXp(sim, h, HERO_XP.perSecond * k * dt, 'time');
    if (h.ultUnlocked && h.ultCooldown > 0) h.ultCooldown = Math.max(0, h.ultCooldown - dt);
  }
}

/**
 * What buying her next level costs now: the level's price × the share of its XP still missing ×
 * difficulty and gear Cost Reduction (cost-cut auras do not apply), rounded up to 5 (min 5).
 * `want = { level, maxPrice }` (what the button showed) refuses as 'stale' when she already
 * levelled past it or the price rose, so a delayed tap never buys a dearer level.
 * @returns {{ level: number, max: number, next: number, price: number, xpLeft: number,
 *   reason: null|'noHero'|'ended'|'max'|'stale'|'cash' }}
 */
export function heroLevelStatus(sim, hero, want = null) {
  const max = BATTLE.maxHeroLevel;
  if (!hero || hero.removed || !hero.isHero) return { level: 0, max, next: 0, price: 0, xpLeft: 0, reason: 'noHero' };
  const level = hero.level;
  const out = { level, max, next: Math.min(max, level + 1), price: 0, xpLeft: 0, reason: null };
  if (level >= max) out.reason = 'max';
  else {
    const hd = hero.def.hero;
    const cur = xpToReach(hd, level);
    const nxt = xpToReach(hd, level + 1);
    const step = nxt - cur;
    out.xpLeft = Math.max(0, nxt - hero.xp);
    const base = heroPrices(hd)[level - 1] ?? Infinity;
    const us = hero.unitStats || DEFAULT_UNIT_STATS;
    const raw = base * (step > 0 ? out.xpLeft / step : 1) * (sim.diff.costMul ?? 1) * (us.costMul ?? 1);
    out.price = Math.max(5, Math.ceil(raw / 5 - 1e-9) * 5);
  }
  if (sim.state === 'won' || sim.state === 'lost') out.reason = 'ended';
  else if (!out.reason && want && (want.level !== level + 1 || !(out.price <= want.maxPrice))) out.reason = 'stale';
  else if (!out.reason && sim.cash < out.price) out.reason = 'cash';
  return out;
}

/**
 * Buys the rest of her current level (exactly the missing XP, so a bought level is the same as an
 * earned one). @returns {{ ok: boolean, reason: string|null, price: number, level?: number }}
 */
export function buyHeroLevel(sim, hero, want = null) {
  const st = heroLevelStatus(sim, hero, want);
  if (st.reason) return { ok: false, reason: st.reason, price: st.price };
  const target = xpToReach(hero.def.hero, st.level + 1);
  sim._spend(st.price);
  hero.levelSpent = (hero.levelSpent || 0) + st.price;
  hero.levelsBought = (hero.levelsBought || 0) + 1;
  sim.stats.heroLevelsBought = (sim.stats.heroLevelsBought || 0) + 1;
  gainHeroXp(sim, hero, target - hero.xp, 'bought', target);
  sim._emit('heroBuy', { towerUid: hero.uid, level: hero.level, price: st.price });
  return { ok: true, reason: null, price: st.price, level: hero.level };
}

/**
 * Seconds before she can Move again after a Move during a wave: HERO_MOVE.cooldown minus her `moveCd` (Kogane's
 * Treads and awakening), never below HERO_MOVE_CD_MIN. Without the key: exactly HERO_MOVE.cooldown.
 */
export function heroMoveCooldown(hero) {
  const cut = hero?.stats?.moveCd || 0;
  return cut > 0 ? Math.max(HERO_MOVE_CD_MIN, HERO_MOVE.cooldown - cut) : HERO_MOVE.cooldown;
}

/** Seconds she stops attacking after a Move during a wave: HERO_MOVE.downtime minus her `moveDowntime` (Kogane's Quick Clutch). */
export function heroMoveDowntime(hero) {
  const cut = hero?.stats?.moveDowntime || 0;
  return cut > 0 ? Math.max(HERO_MOVE_DOWNTIME_MIN, HERO_MOVE.downtime - cut) : HERO_MOVE.downtime;
}

/**
 * Can she move to world (x, y)? Free and instant before or between waves; during a wave she pauses
 * HERO_MOVE.downtime seconds and cannot move again for HERO_MOVE.cooldown.
 * @returns {{ ok: boolean, reason: null|'noHero'|'ended'|'cooldown'|'same'|string, downtime: number }}
 */
export function canMoveHero(sim, x, y, hero) {
  const downtime = sim.state === 'wave' ? heroMoveDowntime(hero) : 0;
  if (!hero || hero.removed || !hero.isHero) return { ok: false, reason: 'noHero', downtime };
  if (sim.state === 'won' || sim.state === 'lost') return { ok: false, reason: 'ended', downtime };
  if (hero.moveCd > 0) return { ok: false, reason: 'cooldown', downtime, cooldownLeft: hero.moveCd };
  if (!Number.isFinite(x) || !Number.isFinite(y) || !sim.placement.inBounds(x, y)) return { ok: false, reason: 'outOfBounds', downtime };
  if (x === hero.x && y === hero.y) return { ok: false, reason: 'same', downtime };
  const geo = sim.placement.check(hero.def, x, y, sim.towers.filter((t) => t !== hero));
  if (geo) return { ok: false, reason: geo, downtime };
  return { ok: true, reason: null, downtime };
}

/** Moves her (see canMoveHero). @returns {{ ok: boolean, reason: string|null }} */
export function moveHero(sim, x, y, hero) {
  const chk = canMoveHero(sim, x, y, hero);
  if (!chk.ok) return { ok: false, reason: chk.reason };
  const fromX = hero.x;
  const fromY = hero.y;
  sim._relocate(hero, x, y);
  if (chk.downtime > 0) {
    hero.moveLock = chk.downtime;
    hero.moveCd = heroMoveCooldown(hero);
    // Kogane's Big Yellow Overdrive (Potential P6): faster for a while after a Move during a wave
    const od = hero.stats?.overdrive;
    if (od && od.time > 0) {
      hero.overdriveLeft = od.time;
      refreshEffective(hero, sim.globalRateMul, sim.globalDmgMul);
    }
  }
  // Norika's barricades follow her to her new range (src/sim/barricades.js)
  if (hero.bars) resiteBarricades(sim, hero);
  sim._emit('heroMove', { towerUid: hero.uid, x: hero.x, y: hero.y, fromX, fromY, downtime: chk.downtime });
  return { ok: true, reason: null };
}

/** { unlocked, ready, cooldownLeft, cooldown, unlockLevel, name, rank } for the active hero. */
export function heroUltStatus(sim) {
  const h = sim.hero;
  const ult = h?.def.hero?.ult;
  if (!h || !ult) return { unlocked: false, ready: false, cooldownLeft: 0, cooldown: 0, rank: 0 };
  const cd = ultCooldown(h);
  return {
    unlocked: h.ultUnlocked,
    ready: h.ultUnlocked && h.ultCooldown <= 0,
    cooldownLeft: h.ultUnlocked ? h.ultCooldown : cd,
    cooldown: cd,
    unlockLevel: ult.unlockLevel ?? 3,
    name: ult.name,
    rank: ultRank(h),
  };
}

/**
 * Attack-look tiers for a track hero (render hand-off): per old path, the highest tier among the
 * reached levels' `from` (mapped by pathKeys; `also` is ignored). Hikari Lv 10 → [2, 2, 3].
 */
export function heroLookTiers(def, level) {
  const keys = def?.hero?.pathKeys || [];
  const out = [0, 0, 0];
  for (const l of def?.hero?.levels || []) {
    if (l.level > level || typeof l.from !== 'string') continue;
    const [k, t] = l.from.split('.');
    const p = keys.indexOf(k);
    if (p >= 0 && Number(t) > out[p]) out[p] = Number(t);
  }
  return out;
}

/** Ult damage scales with the hero's current damage relative to its base damage. */
function ultDamageScale(h) {
  const base = normalizeBase(h.def.base, h.def).damage;
  if (base > 0) return h.eff.damage / base;
  return (h.unitStats?.damageMul || 1) * h.buff.dmgMul;
}

function ultSpec(h, effect, damage) {
  return {
    damage,
    attackType: effect.attackType || h.eff.attackType,
    element: h.eff.element,
    critChance: 0,
    critMul: 1,
    armorPen: h.eff.armorPen,
    eliteMul: 1,
    bossMul: 1,
    barrierMul: 1,
    detection: true,
    canHitAir: true,
    status: effect.status || [],
    mark: null,
    silence: 0,
    reveal: 0,
    knockback: 0,
  };
}

function pushBack(e, tiles, path) {
  let amt = tiles * (KNOCKBACK_RESIST[e.tier] ?? 1);
  if (e.kbLeft != null) { amt = Math.min(amt, e.kbLeft); e.kbLeft -= amt; }
  if (amt <= 0) return;
  e.dist = Math.max(0, e.dist - amt);
  placeOnPath(e, path);
}

/** Best eligible victim by a target mode (ties: earlier in sim.enemies), or null. */
function bestVictim(victims, spec, mode, x, y) {
  let best = null;
  let bestS = -Infinity;
  for (const e of victims) {
    if (!isEligible(e, spec)) continue;
    const s = targetScore(mode, x, y, e);
    if (s > bestS) {
      bestS = s;
      best = e;
    }
  }
  return best;
}

/**
 * Fires the hero ultimate if unlocked and charged. Shapes that need a target (strike, aimed
 * nova without an aim) return false without spending the cooldown when there is none.
 * @returns {boolean}
 */
export function activateUlt(sim) {
  const h = sim.hero;
  const ult = h?.def.hero?.ult;
  if (!h || !ult || !h.ultUnlocked || h.ultCooldown > 0) return false;
  if (sim.state === 'won' || sim.state === 'lost') return false;
  const effect = ultEffect(h);
  const scale = ultDamageScale(h);
  const ctx = statusCtxFor({ rng: sim.rng, element: h.eff.element, attackType: effect.attackType || h.eff.attackType }, h);
  const victims = sim.enemies.filter((e) => !e.dead && !e.hidden); // tunnels shelter enemies from ults too
  let ux = h.x; // where the ult lands (event position)
  let uy = h.y;

  if (effect.type === 'nova') {
    const r = effect.radius || 0;
    const spec = ultSpec(h, effect, (effect.damage || 0) * scale);
    let cx = h.x;
    let cy = h.y;
    if (effect.center === 'aim') {
      if (h.aim) {
        cx = h.aim.x;
        cy = h.aim.y;
      } else {
        const lead = bestVictim(victims, spec, 'first', h.x, h.y);
        if (!lead) return false;
        cx = lead.x;
        cy = lead.y;
      }
      ux = cx;
      uy = cy;
    }
    for (const e of victims) {
      if (r > 0 && Math.hypot(e.x - cx, e.y - cy) > r) continue;
      if (effect.reveal) applyStatus(e, { type: 'reveal', duration: effect.reveal }, ctx);
      syncStatusFlags(e);
      sim._hit(e, h, spec, 1);
    }
  } else if (effect.type === 'timeWarp') {
    for (const e of victims) {
      applyStatus(e, { type: 'slow', amount: effect.slow ?? 0.4, duration: effect.duration ?? 4 }, ctx);
      // (a Potential step's statuses on her Moonfall, e.g. Luna's Brittle: every victim; none at P1)
      if (effect.status) for (const st of effect.status) applyStatus(e, st, ctx);
    }
    const rb = effect.rateBuff ?? 0.25;
    // the caster's uid (the buff icons tint the ultimate by her; nothing reads the view getter)
    sim.addGlobalRateBuff(rb > 1 ? rb : 1 + rb, (effect.buffDuration ?? effect.duration ?? 6) * buffDur(h.unitStats), h.uid);
  } else if (effect.type === 'tide') {
    const spec = ultSpec(h, effect, (effect.damage || 0) * scale);
    for (const e of victims) {
      sim._hit(e, h, spec, 1);
      if (e.dead) continue;
      if (effect.pushback) pushBack(e, effect.pushback, sim.pathData[e.pathIndex]);
      if (effect.slow) applyStatus(e, { type: 'slow', amount: effect.slow, duration: effect.duration ?? 3 }, ctx);
    }
  } else if (effect.type === 'runner') {
    // a sky dragon that flies back along the road from her aim point (else a busy path's exit);
    // `toStart`: all the way to that road's START (src/sim/runners.js)
    const spec = ultSpec(h, effect, (effect.damage || 0) * scale);
    const r = startRunner(sim, h, effect, spec, h.aim);
    if (!r) return false;
    const p = runnerSegment(sim, r, 0);
    if (p) {
      ux = p.x;
      uy = p.y;
    }
  } else if (effect.type === 'barricade') {
    // Hold the Line (Norika): temporary barricades on the road at her aim point, else ahead of the lead walker
    // in her range (src/sim/barricades.js); nothing to block: the ult waits. Only during a wave: its timers run
    // with the wave, and a calm point (the battle save) holds no lines
    if (!h.bars || sim.state !== 'wave') return false;
    const walkers = h.aim ? null : victims.filter((e) => !e.airborne && (e.x - h.x) * (e.x - h.x) + (e.y - h.y) * (e.y - h.y) <= h.eff.range * h.eff.range);
    const lead = walkers ? bestVictim(walkers, { ...h.eff, canHitAir: false, detection: true }, 'first', h.x, h.y) : null;
    const at = holdTheLine(sim, h, effect, h.aim, lead);
    if (!at) return false;
    ux = at.x;
    uy = at.y;
  } else if (effect.type === 'strike') {
    // one huge blow on the strongest (or first) enemy anywhere, splashing its neighbours
    const spec = ultSpec(h, effect, (effect.damage || 0) * scale);
    spec.armorPen = effect.armorPen ?? h.eff.armorPen;
    const target = bestVictim(victims, spec, effect.target === 'first' ? 'first' : 'strong', h.x, h.y);
    if (!target) return false;
    ux = target.x;
    uy = target.y;
    sim._hit(target, h, spec, 1); // applies effect.status through the usual on-hit path
    const splash = effect.splash || 0;
    if (splash > 0) {
      const splashSpec = { ...spec, damage: spec.damage * (effect.splashMul ?? 0.3), status: [] };
      const r2 = splash * splash;
      for (const e of victims) {
        if (e === target || e.dead) continue;
        const dx = e.x - ux;
        const dy = e.y - uy;
        if (dx * dx + dy * dy <= r2) sim._hit(e, h, splashSpec, 1);
      }
    }
  }
  if (effect.dmgBuff > 1) sim.addGlobalDamageBuff(effect.dmgBuff, effect.dmgBuffDuration ?? 4, h.uid);
  h.ultCooldown = ultCooldown(h);
  sim.stats.ultsUsed = (sim.stats.ultsUsed || 0) + 1;
  if (sim.tryout) sim.tryoutCount(h.heroIndex ?? 0, 'ults');
  sim._emit('ult', { name: ult.name || 'Ultimate', effect: effect.type, x: ux, y: uy, fromX: h.x, fromY: h.y, towerUid: h.uid, rank: ultRank(h) });
  return true;
}
