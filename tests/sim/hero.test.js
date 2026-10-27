import { describe, test, expect } from 'vitest';
import { makeSim, startEmptyWave, run, UNITS, STAGE } from './fixtures.js';
import {
  xpToReach, levelForXp, heroPace, waveClearXp, damageXp, heroMastery, heroXpCap, heroLookTiers, ultRank,
} from '../../src/sim/hero.js';
import { HERO_XP, HERO_LEVEL_PRICES, HERO_MOVE } from '../../src/data/heroTracks.js';
import { resolveStats } from '../../src/sim/mods.js';
import { getUnit } from '../../src/data/units.js';
import { HERO_POWER } from '../../src/data/balance.js';
import { Sim } from '../../src/sim/Sim.js';

function park(sim, id, dist) {
  const e = sim.spawnEnemy(id, { dist });
  e.baseSpeed = 0;
  return e;
}
const quietStage = (waves = 3) => ({ ...STAGE, waves, waveGen: { pool: [], budget: { start: 1, growth: 1 } } });
const HERO_SPOT = [8.5, 5.6]; // heroes (r 0.5) stay 1.05 from the path centre line and clear the rocks

describe('hero XP, pace and levels', () => {
  test('a hero may carry her own levelXp (heroine: 10 levels); the others use the shared 25-level table', () => {
    const hd = UNITS.heroine.hero;
    expect(xpToReach(hd, 1)).toBe(0);
    expect(xpToReach(hd, 2)).toBe(100);
    expect(xpToReach(hd, 3)).toBe(300);
    expect(levelForXp(hd, 299)).toBe(2);
    expect(levelForXp(hd, 1e9)).toBe(10);
    expect(xpToReach(UNITS.warper.hero, 25)).toBe(24280);
    expect(levelForXp(UNITS.warper.hero, 1e9)).toBe(25);
    expect(heroXpCap(UNITS.warper.hero)).toBe(74280);
  });

  test('formulas: wave XP, stage pace and damage XP in base HP', () => {
    expect(waveClearXp(5, 1)).toBe(150);
    const pace = (waves) => heroPace({ totalWaves: waves });
    expect(pace(12)).toBeCloseTo(1.8333, 3);
    expect(pace(16)).toBeCloseTo(1.375, 6);
    expect(pace(22)).toBe(1);
    expect(pace(30)).toBe(1);
    expect(pace(10)).toBe(2);
    expect(pace(Infinity)).toBe(1);
    // the same base-HP kill gives the same XP on a ×1 and a ×6.5 stage
    expect(damageXp(100, { hpMul: 1 })).toBeCloseTo(40, 9);
    expect(damageXp(650, { hpMul: 6.5 })).toBeCloseTo(40, 9);
    expect(damageXp(100, null)).toBeCloseTo(40, 9);
  });

  test('damage dealt grants XP (÷ hpMul × 0.4); levels apply mods + growth and emit heroLevel once each', () => {
    const sim = makeSim({ hero: 'heroine' });
    startEmptyWave(sim);
    const h = sim.placeTower('heroine', ...HERO_SPOT);
    expect(h).toMatchObject({ isHero: true, level: 1, xp: 0, heroIndex: 0 });
    expect(sim.hero).toBe(h);
    expect(sim.heroes).toEqual([h]);
    expect(h.eff.damage).toBe(10);
    const e = park(sim, 'tank', 7);
    sim._credit(h, 250, e); // 250 ÷ 1 × 0.4 = 100 XP
    expect(h.xp).toBeCloseTo(100, 9);
    expect(h.level).toBe(2);
    expect(h.eff.damage).toBeCloseTo(15 * 1.03, 9); // base 10 + level-2 mods (+5), × growth +3 %
    const ev = sim.drainEvents().filter((x) => x.type === 'heroLevel');
    expect(ev).toEqual([expect.objectContaining({ level: 2, towerUid: h.uid })]);
    expect(sim.stats.heroXp.damage).toBeCloseTo(100, 9);
  });

  test('wave clears give paced XP to every placed hero; time XP runs only during waves', () => {
    const sim = makeSim({ hero: 'warper', stage: quietStage(11) }); // 11 waves → k = 2
    const h = sim.placeTower('warper', ...HERO_SPOT);
    run(sim, 5);
    expect(h.xp).toBe(0); // no time XP before the first wave
    sim.startNextWave();
    run(sim, 0.1);
    expect(sim.state).toBe('between');
    const k = 2;
    expect(h.xp).toBeCloseTo(waveClearXp(1, k) + HERO_XP.perSecond * k * (1 / 60), 6); // one wave step + the clear
    const xp = h.xp;
    run(sim, 10);
    expect(h.xp).toBe(xp);
    startEmptyWave(sim);
    park(sim, 'tank', 3); // keeps the wave going
    run(sim, 10);
    expect(h.xp - xp).toBeCloseTo(HERO_XP.perSecond * k * 10, 3);
    expect(sim.stats.heroXp.wave).toBeCloseTo(waveClearXp(1, k), 6);
  });

  test('cap at Lv 25, then Mastery: +1 % per 2,000 XP, at most +25 %, one event per step, XP capped', () => {
    const sim = makeSim({ hero: 'warper' });
    const h = sim.placeTower('warper', ...HERO_SPOT);
    sim.drainEvents();
    sim._credit(h, 24280 / 0.4);
    expect(h.level).toBe(25);
    expect(sim.drainEvents().filter((e) => e.type === 'heroLevel')).toHaveLength(24);
    expect(heroMastery(h)).toBe(0);
    const d25 = h.eff.damage;
    sim._credit(h, 2000 / 0.4);
    expect(h.mastery).toBeCloseTo(0.01, 9);
    expect(sim.drainEvents().filter((e) => e.type === 'heroMastery')).toEqual([expect.objectContaining({ bonus: h.mastery })]);
    expect(h.eff.damage).toBeGreaterThan(d25);
    sim._credit(h, 1e9);
    expect(h.xp).toBe(74280);
    expect(h.mastery).toBeCloseTo(0.25, 9);
    // track sum × (1 + 24 × 3 % + Mastery 25 %): warper's track is +1 damage per level
    expect(h.eff.damage).toBeCloseTo((10 + 24) * (1 + 0.72 + 0.25), 6);
    sim._credit(h, 1e9);
    expect(sim.drainEvents().filter((e) => e.type === 'heroMastery')).toHaveLength(1); // the one capping step only
  });

  test('growth: Lv 25 damage = the track sum × (1 + 24 × 0.03) × her Lv 25 power (src/data/balance.js) for the real heroes', () => {
    for (const id of ['hikari', 'luna', 'nami']) {
      const u = getUnit(id);
      const s = resolveStats(u, { heroLevel: 25 });
      let add = u.base.damage;
      let mul = 1;
      for (const l of u.hero.levels) {
        add += l.mods.damage || 0;
        mul *= l.mods.damageMul || 1;
      }
      const lv25 = HERO_POWER[id]?.[HERO_POWER[id].length - 1] ?? 1;
      expect(s.damage, id).toBeCloseTo(add * mul * 1.72 * lv25, 6);
    }
  });
});

describe('buying levels', () => {
  test('price = table × missing share × difficulty × gear costMul, rounded up to 5; it shrinks as she earns XP', () => {
    const sim = makeSim({ hero: 'warper', heroStats: { costMul: 0.9 }, difficulty: 'hard' });
    const h = sim.placeTower('warper', ...HERO_SPOT);
    const st = sim.heroLevelStatus();
    expect(st).toMatchObject({ level: 1, next: 2, max: 25, reason: null, xpLeft: 200 });
    expect(st.price).toBe(Math.ceil((HERO_LEVEL_PRICES[0] * 1.08 * 0.9) / 5) * 5);
    sim._credit(h, 100 / 0.4); // half the bar
    expect(sim.heroLevelStatus().price).toBe(Math.ceil((150 * 0.5 * 1.08 * 0.9) / 5) * 5);
  });

  test('cost-cut auras do not discount hero levels', () => {
    const sim = makeSim({ hero: 'warper' });
    expect(sim.placeTower('chime', 10.5, 6.5)).toBeTruthy(); // 10 % cost cut aura
    sim.placeTower('warper', ...HERO_SPOT);
    expect(sim.hero.buff.costCut).toBeGreaterThan(0);
    expect(sim.heroLevelStatus().price).toBe(150);
  });

  test('buy adds exactly the missing XP, spends, counts and emits heroBuy', () => {
    const sim = makeSim({ hero: 'warper', cash: 1000 });
    const h = sim.placeTower('warper', ...HERO_SPOT);
    sim._credit(h, 50 / 0.4);
    const st = sim.heroLevelStatus();
    sim.drainEvents();
    const r = sim.buyHeroLevel({ level: 2, maxPrice: st.price });
    expect(r).toMatchObject({ ok: true, price: st.price, level: 2 });
    expect(h.level).toBe(2);
    expect(h.xp).toBe(xpToReach(h.def.hero, 2));
    expect(sim.cash).toBe(1000 - st.price);
    expect(h).toMatchObject({ levelSpent: st.price, levelsBought: 1 });
    expect(sim.stats.heroLevelsBought).toBe(1);
    const ev = sim.drainEvents();
    expect(ev.find((e) => e.type === 'heroBuy')).toMatchObject({ towerUid: h.uid, level: 2, price: st.price });
    expect(ev.some((e) => e.type === 'heroLevel' && e.level === 2)).toBe(true);
    expect(sim.stats.heroXp.bought).toBeCloseTo(150, 6);
  });

  test('stale guard: a wave clear levels her first → refused, nothing spent; a dearer price → refused', () => {
    const sim = makeSim({ hero: 'warper', stage: quietStage(22), cash: 5000 });
    const h = sim.placeTower('warper', ...HERO_SPOT);
    const seen = sim.heroLevelStatus(); // what the button shows: Lv 2 for 150
    sim.startNextWave();
    run(sim, 0.1); // wave 1 clears: 78 XP, still Lv 1, price drops
    sim._credit(h, 130 / 0.4); // she reaches Lv 2 on her own
    expect(h.level).toBe(2);
    const cash = sim.cash;
    expect(sim.buyHeroLevel({ level: seen.level + 1, maxPrice: seen.price })).toMatchObject({ ok: false, reason: 'stale' });
    expect(sim.cash).toBe(cash);
    const now = sim.heroLevelStatus();
    expect(sim.buyHeroLevel({ level: now.level + 1, maxPrice: now.price - 5 })).toMatchObject({ ok: false, reason: 'stale' });
    expect(sim.buyHeroLevel({ level: now.level + 1, maxPrice: now.price })).toMatchObject({ ok: true });
  });

  test('reasons: cash, max, ended, noHero', () => {
    const sim = makeSim({ hero: 'warper', cash: 0 });
    expect(sim.heroLevelStatus().reason).toBe('noHero');
    const h = sim.placeTower('warper', ...HERO_SPOT); // free: placed with 0 coins
    expect(h).toBeTruthy();
    expect(sim.buyHeroLevel()).toMatchObject({ ok: false, reason: 'cash' });
    sim._credit(h, 1e9);
    expect(sim.heroLevelStatus().reason).toBe('max');
    sim.state = 'lost';
    expect(sim.buyHeroLevel()).toMatchObject({ ok: false, reason: 'ended' });
  });
});

describe('free placement, no selling', () => {
  test('heroes cost 0 and can be placed with 0 coins; towers still cost', () => {
    const sim = makeSim({ hero: 'heroine', cash: 0 });
    expect(sim.placeCost('heroine')).toBe(0);
    expect(sim.canPlace('heroine', ...HERO_SPOT)).toMatchObject({ ok: true, cost: 0 });
    expect(sim.placeCost('archer')).toBe(200);
    const real = new Sim({ stageId: '1-2', hero: { unitId: 'hikari' }, loadout: [{ unitId: 'aoi' }] });
    expect(real.placeCost('hikari')).toBe(0);
  });

  test('a difficulty heroCost puts a deploy price back (Q2 fallback knob)', () => {
    const sim = makeSim({ hero: 'heroine' });
    sim.diff = { ...sim.diff, heroCost: 500 };
    expect(sim.placeCost('heroine')).toBe(500);
  });

  test('canSell / sellTower refuse a hero: she stays, no refund, no event; unknown uid → 0', () => {
    const sim = makeSim({ hero: 'heroine' });
    const h = sim.placeTower('heroine', ...HERO_SPOT);
    const a = sim.placeTower('archer', 2.5, 1.5);
    expect(sim.canSell(h.uid)).toEqual({ ok: false, reason: 'hero' });
    expect(sim.canSell(a.uid)).toEqual({ ok: true, reason: null });
    expect(sim.canSell(999)).toEqual({ ok: false, reason: 'none' });
    sim.drainEvents();
    const cash = sim.cash;
    expect(sim.sellTower(h.uid)).toBe(false);
    expect(sim.hero).toBe(h);
    expect(sim.getTower(h.uid)).toBe(h);
    expect(sim.cash).toBe(cash);
    expect(sim.drainEvents().some((e) => e.type === 'sell')).toBe(false);
    expect(sim.sellTower(999)).toBe(0);
    expect(sim.towerStats(h.uid)).toMatchObject({ canSell: false, sellValue: 0 });
  });

  test('a hero has no upgrade paths', () => {
    const sim = makeSim({ hero: 'heroine' });
    const h = sim.placeTower('heroine', ...HERO_SPOT);
    expect(sim.upgradeStatus(h.uid, 0)).toMatchObject({ locked: true, reason: 'max' });
    expect(sim.upgradeTower(h.uid, 0)).toBe(false);
  });
});

describe('ultimate', () => {
  test('ult unlocks at its level, charges only during waves, nova damages and reveals', () => {
    const sim = makeSim({ hero: 'heroine', heroStats: { ultHaste: 0.2 } });
    const h = sim.placeTower('heroine', 0, 0);
    expect(sim.heroUltStatus()).toMatchObject({ unlocked: false, ready: false });
    sim._credit(h, 300 / 0.4);
    expect(h.level).toBe(3);
    const st = sim.heroUltStatus();
    expect(st).toMatchObject({ unlocked: true, rank: 1 });
    expect(st.cooldown).toBeCloseTo(24, 6); // 30 × (1 - 0.2)
    expect(st.cooldownLeft).toBeCloseTo(12, 6);
    run(sim, 5);
    expect(sim.heroUltStatus().cooldownLeft).toBeCloseTo(12, 6); // no charging outside waves
    expect(sim.activateUlt()).toBe(false);
    startEmptyWave(sim);
    const v = park(sim, 'veil', 14);
    const w = park(sim, 'wyvern', 15);
    park(sim, 'tank', 16);
    run(sim, 12.1);
    expect(sim.heroUltStatus().ready).toBe(true);
    sim.drainEvents();
    expect(sim.activateUlt()).toBe(true);
    expect(v.dead && w.dead).toBe(true);
    const ev = sim.drainEvents();
    expect(ev.find((e) => e.type === 'ult')).toMatchObject({ name: 'Bloom', effect: 'nova', rank: 1 });
    expect(sim.heroUltStatus()).toMatchObject({ ready: false, cooldownLeft: 24 });
    expect(sim.activateUlt()).toBe(false);
  });

  test('ranks at Lv 10 and 20: cooldown × 0.85 each, bigger bloom (real Hikari)', () => {
    const sim = new Sim({ stageId: '1-2', hero: { unitId: 'hikari' }, loadout: [{ unitId: 'aoi' }] });
    const spot = (() => {
      for (let y = 0.5; y < sim.map.height; y += 0.5) for (let x = 0.5; x < sim.map.width; x += 0.5) if (sim.canPlace('hikari', x, y).ok) return [x, y];
      return null;
    })();
    const h = sim.placeTower('hikari', ...spot);
    sim._credit(h, xpToReach(h.def.hero, 10) / 0.4);
    expect(h.level).toBe(10);
    expect(ultRank(h)).toBe(2);
    expect(sim.heroUltStatus()).toMatchObject({ rank: 2 });
    expect(sim.heroUltStatus().cooldown).toBeCloseTo(70 * 0.85, 6);
    sim._credit(h, (xpToReach(h.def.hero, 20) - h.xp) / 0.4 + 1);
    expect(h.level).toBe(20);
    expect(sim.heroUltStatus()).toMatchObject({ rank: 3 });
    expect(sim.heroUltStatus().cooldown).toBeCloseTo(70 * 0.85 * 0.85, 6);
    h.ultCooldown = 0;
    startEmptyWave(sim);
    const near = sim.spawnEnemy('slime_green', { dist: 0 }) || null;
    sim.drainEvents();
    expect(sim.activateUlt()).toBe(true);
    expect(sim.drainEvents().find((e) => e.type === 'ult')).toMatchObject({ rank: 3 });
    if (near && !near.dead) expect(near.statuses.vulnerable || near.statuses.stun || Math.hypot(near.x - h.x, near.y - h.y) > 7).toBeTruthy();
  });

  test('timeWarp slows enemies and hastes every tower temporarily', () => {
    const sim = makeSim({ hero: 'warper' });
    startEmptyWave(sim);
    const h = sim.placeTower('warper', 0, 0);
    const a = sim.placeTower('archer', 2, 2);
    h.ultCooldown = 0;
    const e = sim.spawnEnemy('tank', { dist: 16 });
    expect(sim.activateUlt()).toBe(true);
    expect(e.statuses.slow.amount).toBe(0.5);
    run(sim, 1 / 60);
    expect(a.eff.rate).toBeCloseTo(3, 6);
    expect(a.buffed).toBe(true);
    run(sim, 4.1);
    expect(a.eff.rate).toBeCloseTo(2, 6);
  });

  test('tide damages, pushes back (not bosses) and slows', () => {
    const sim = makeSim({ hero: 'tider' });
    startEmptyWave(sim);
    const h = sim.placeTower('tider', 4, 1);
    expect(h).toBeTruthy();
    h.ultCooldown = 0;
    const e = park(sim, 'tank', 10);
    const b = park(sim, 'boss', 10);
    expect(sim.activateUlt()).toBe(true);
    expect(e.dist).toBeCloseTo(7, 6);
    expect(b.dist).toBeCloseTo(10, 6);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(e.statuses.slow).toBeTruthy();
  });
});

describe('moving the hero', () => {
  test('before or between waves: instant, no lock; keeps level, XP and ult state', () => {
    const sim = makeSim({ hero: 'warper' });
    const h = sim.placeTower('warper', ...HERO_SPOT);
    sim._credit(h, 1000);
    const { level, xp, ultCooldown } = h;
    sim.drainEvents();
    expect(sim.moveHero(2.5, 1.5)).toEqual({ ok: true, reason: null });
    expect([h.x, h.y, h.tx, h.ty]).toEqual([2.5, 1.5, 2, 1]);
    expect(h).toMatchObject({ level, xp, ultCooldown, moveLock: 0, moveCd: 0 });
    expect(sim.drainEvents().find((e) => e.type === 'heroMove')).toMatchObject({ towerUid: h.uid, x: 2.5, y: 1.5, fromX: HERO_SPOT[0], fromY: HERO_SPOT[1], downtime: 0 });
    expect(sim.moveHero(...HERO_SPOT).ok).toBe(true); // no recharge outside waves
  });

  test('validates terrain and overlap ignoring herself; same spot refused', () => {
    const sim = makeSim({ hero: 'warper' });
    sim.placeTower('warper', ...HERO_SPOT);
    sim.placeTower('archer', 2.5, 1.5);
    expect(sim.canMoveHero(5, 4).reason).toBe('path');
    expect(sim.canMoveHero(2.6, 1.6).reason).toBe('occupied');
    expect(sim.canMoveHero(HERO_SPOT[0] + 0.2, HERO_SPOT[1]).ok).toBe(true); // overlapping her own old spot is fine
    expect(sim.canMoveHero(...HERO_SPOT).reason).toBe('same');
    expect(sim.canMoveHero(-5, -5).reason).toBe('outOfBounds');
  });

  test('during a wave: she pauses 3 s (deals nothing) and Move recharges 15 s', () => {
    const sim = makeSim({ hero: 'warper' });
    startEmptyWave(sim);
    const h = sim.placeTower('warper', ...HERO_SPOT);
    park(sim, 'tank', 9.5);
    run(sim, 1);
    expect(h.damageDealt).toBeGreaterThan(0);
    expect(sim.moveHero(8.5, 2.4)).toMatchObject({ ok: true });
    expect(h.moveLock).toBe(HERO_MOVE.downtime);
    expect(h.moveCd).toBe(HERO_MOVE.cooldown);
    const dealt = h.damageDealt;
    run(sim, 2.9);
    expect(h.damageDealt).toBe(dealt);
    run(sim, 1);
    expect(h.damageDealt).toBeGreaterThan(dealt);
    expect(sim.canMoveHero(...HERO_SPOT)).toMatchObject({ ok: false, reason: 'cooldown' });
    run(sim, 11.2);
    expect(sim.canMoveHero(...HERO_SPOT).ok).toBe(true);
  });

  test('_relocate clears traps/targets and refreshes auras (old aura lost, new aura gained)', () => {
    const u = { ...UNITS.warper, hero: { ...UNITS.warper.hero, levels: UNITS.warper.hero.levels.map((l, i) => (i === 1 ? { ...l, mods: { aura: { range: 2, dmgMul: 1.5 } } } : l)) } };
    const sim = makeSim({ hero: 'warper' });
    sim.data.unit = ((orig) => (id) => (id === 'warper' ? u : orig(id)))(sim.data.unit.bind(sim.data));
    const h = sim.placeTower('warper', 8.5, 5.6);
    sim._credit(h, 1000);
    const near = sim.placeTower('archer', 10, 5.9);
    const far = sim.placeTower('archer', 2.5, 1.5);
    expect(near.buff.dmgMul).toBe(1.5);
    expect(far.buff.dmgMul).toBe(1);
    h.targetUid = 123;
    h.trapSpots = [];
    sim.moveHero(3.5, 2.6);
    expect(near.buff.dmgMul).toBe(1);
    expect(far.buff.dmgMul).toBe(1.5);
    expect(h.targetUid).toBe(null);
    expect(h.trapSpots).toBe(null);
  });
});

describe('render hand-off', () => {
  test('heroLookTiers: per old path, the highest reached tier', () => {
    const h = getUnit('hikari');
    expect(heroLookTiers(h, 1)).toEqual([0, 0, 0]);
    expect(heroLookTiers(h, 9)).toEqual([2, 2, 1]);
    expect(heroLookTiers(h, 10)).toEqual([2, 2, 3]);
    expect(heroLookTiers(h, 15)).toEqual([3, 3, 3]);
    expect(heroLookTiers(h, 22)).toEqual([5, 4, 4]);
    expect(heroLookTiers(h, 25)).toEqual([5, 5, 5]);
  });
});
