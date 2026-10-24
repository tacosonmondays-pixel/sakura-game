// scratch probe: every tower girl's effective kit at max investment, per build (no waves)
import { maxProfile, parseBuild, FINAL_BUILDS } from './benchLib.mjs';
import { Sim } from '../src/sim/Sim.js';
import { withDetMath } from '../src/core/detMath.js';
import { soloFreeplayStage } from '../src/data/freeplaySolo.js';
import { defaultData } from '../src/sim/data.js';
import { ABILITIES, abilityRuns } from '../src/data/abilities.js';

const d = defaultData();
const want = process.argv.slice(2);
const girls = want.length ? want : Object.values(d.units).filter((u) => u.kind === 'tower').map((u) => u.id);
const stage = soloFreeplayStage('4-5', 'blossom');
for (const id of girls) {
  const st = maxProfile(id, { rolls: 'mid' }).stats;
  const abil = Object.keys(ABILITIES).filter((k) => k === id || k.startsWith(`${id}@`)).map((k) => {
    const row = ABILITIES[k];
    const list = Array.isArray(row) ? row : [row];
    return list.map((e) => `${k}:${e.kind}${abilityRuns(e) ? '' : '(locked)'}`).join(',');
  }).join(' ');
  for (const b of FINAL_BUILDS) {
    const sim = withDetMath(() => new Sim({ stageId: '4-5', difficulty: 'normal', loadout: [{ unitId: id, stats: st }], hero: null, seed: 9, options: { freeplay: true, autoStart: false }, data: { stage } }));
    sim.cash = 1e15;
    let t = null;
    withDetMath(() => {
      for (let y = 1; y < sim.map.height && !t; y += 0.5) for (let x = 1; x < sim.map.width && !t; x += 0.5) if (sim.canPlace(id, x, y).ok) t = sim.placeTower(id, x, y);
      const [mp, mt, cp, ct] = parseBuild(b.name);
      for (let i = 0; i < ct; i++) sim.upgradeTower(t.uid, cp);
      for (let i = 0; i < mt; i++) sim.upgradeTower(t.uid, mp);
      sim.update(0.1);
    });
    const e = t.eff;
    const s = t.stats;
    const ts = sim.towerStats(t.uid);
    const extra = ['ramp', 'tempo', 'focus', 'mark', 'trap', 'turret', 'ball', 'vine', 'strip', 'sentry', 'ring', 'drone', 'brew', 'link', 'aura', 'income', 'execute', 'proc', 'zone', 'echo', 'stack', 'hex']
      .filter((k) => s?.[k] || e?.[k]).join('+');
    console.log(JSON.stringify({
      id, rarity: d.units[id].rarity, role: d.units[id].role, attackType: d.units[id].attackType, build: b.name, tiers: t.tiers.join('-'),
      beh: e.behavior, dmg: +e.damage.toFixed(1), rate: +e.rate.toFixed(2), range: +e.range.toFixed(2), proj: e.projectiles, pierce: e.pierce, splash: +(e.splash || 0).toFixed(2), chain: e.chain,
      maxT: e.maxTargets, air: e.canHitAir, crit: [+(e.crit?.chance || 0).toFixed(2), +(e.crit?.mul || 0).toFixed(2)], pen: e.armorPen, bossMul: e.bossMul, eliteMul: e.eliteMul,
      status: (e.status || []).map((x) => x.type).join(','), extra, panel: Math.round(ts.dps), abil,
    }));
  }
}
