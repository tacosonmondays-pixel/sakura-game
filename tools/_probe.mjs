// scratch probe: max-investment stats and a placed girl's effective stats
import { maxProfile, parseBuild } from './benchLib.mjs';
import { Sim } from '../src/sim/Sim.js';
import { withDetMath } from '../src/core/detMath.js';
import { soloFreeplayStage } from '../src/data/freeplaySolo.js';
import { gainHeroXp, heroXpCap, xpToReach } from '../src/sim/hero.js';
import { HERO_XP, HERO_XP_STEPS } from '../src/data/heroTracks.js';

const ids = process.argv.slice(2);
console.log('HERO_XP', JSON.stringify(HERO_XP), 'to25', HERO_XP_STEPS.reduce((a, b) => a + b, 0));
for (const spec of ids) {
  const [id, build, lv] = spec.split(':');
  const st = maxProfile(id, { rolls: 'mid' }).stats;
  const stage = soloFreeplayStage('4-5', 'blossom');
  const isHero = !build;
  const sim = withDetMath(() => new Sim({ stageId: '4-5', difficulty: 'normal', loadout: isHero ? [] : [{ unitId: id, stats: st }], hero: isHero ? { unitId: id, stats: st } : null, seed: 9, options: { freeplay: true, autoStart: false }, data: { stage } }));
  sim.cash = 1e15;
  let t = null;
  withDetMath(() => {
    for (let y = 1; y < sim.map.height && !t; y += 0.5) for (let x = 1; x < sim.map.width && !t; x += 0.5) if (sim.canPlace(id, x, y).ok) t = sim.placeTower(id, x, y);
    if (isHero) {
      const xp = lv === 'cap' || !lv ? heroXpCap(t.def.hero) : xpToReach(t.def.hero, Number(lv));
      gainHeroXp(sim, t, xp, 'bought', xp);
    } else {
      const [mp, mt, cp, ct] = parseBuild(build);
      for (let i = 0; i < ct; i++) sim.upgradeTower(t.uid, cp);
      for (let i = 0; i < mt; i++) sim.upgradeTower(t.uid, mp);
    }
    sim.update(0.1);
  });
  const e = t.eff;
  const ts = sim.towerStats(t.uid);
  console.log(JSON.stringify({ id, build, level: t.level, mastery: t.mastery, unitStats: { damageMul: st.damageMul, rateMul: st.rateMul, rangeMul: st.rangeMul, critChance: st.critChance, critMul: st.critMul, pierceK: st.pierceK }, eff: { behavior: e.behavior, damage: +e.damage.toFixed(1), rate: +e.rate.toFixed(3), range: +e.range.toFixed(2), projectiles: e.projectiles, pierce: e.pierce, splash: e.splash, chain: e.chain, maxTargets: e.maxTargets, canHitAir: e.canHitAir, crit: e.crit, armorPen: e.armorPen, bossMul: e.bossMul, eliteMul: e.eliteMul, status: (e.status || []).map((s) => s.type) }, panelDps: Math.round(ts.dps), aura: t.stats.aura || null }));
}
