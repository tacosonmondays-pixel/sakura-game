// Balance round 5: Titan Trials keep today's numbers (src/data/balance.js TITAN_POWER false). One headless titan battle
// per titan with a fully maxed team (tools/balance/r5Bench.mjs maxedProfile) and the autoPlan bot: total damage and the
// sim hash after 240 s, to compare before and after the round (they must match bit for bit).
//   node --import ./tools/simLoader.mjs tools/balance/r5Titans.mjs [--json]
import { Sim } from '../../src/sim/Sim.js';
import { TITANS, titanBattle } from '../../src/data/titans.js';
import { autoPlan } from '../../src/sim/headless.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { maxedStats } from './r5Bench.mjs';

const TEAM = ['kage', 'aoi', 'ena', 'akane', 'hana', 'umeko', 'midori', 'kinu'];
for (const t of TITANS) {
  const b = titanBattle(t.id, 'normal', 0);
  const sim = new Sim({ stageId: b.stage.id, difficulty: 'normal', seed: 7, loadout: TEAM.map((id) => ({ unitId: id, stats: maxedStats(id) })), hero: { unitId: 'hikari', stats: maxedStats('hikari') }, data: { stage: b.stage, enemies: b.enemies }, options: { autoStart: false } });
  sim.cash = 1e9;
  for (const a of autoPlan(b.stage.id, [...TEAM, 'hikari'], { data: { stage: b.stage }, maxCopies: 1 })) if (a.action === 'place') sim.placeTower(a.unitId, a.x, a.y);
  for (let i = 0; i < 240 * 4 && sim.state !== 'won' && sim.state !== 'lost'; i++) {
    if (sim.state === 'prep' || sim.state === 'between') sim.startNextWave();
    sim.update(0.25);
  }
  const dmg = Math.round(Object.values(sim.stats.damageByTower).reduce((a, x) => a + x, 0));
  const row = { titan: t.id, damage: dmg, hash: hashSim(sim).toString(16), state: sim.state };
  console.log(process.argv.includes('--json') ? JSON.stringify(row) : `${t.id}: ${dmg} ${row.hash} ${row.state}`);
}
