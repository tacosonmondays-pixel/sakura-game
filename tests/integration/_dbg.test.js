import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { defaultData } from '../../src/sim/data.js';
import { runHeadless, autoPlan } from '../../src/sim/headless.js';
import { unitBattleStats } from '../../src/systems/progression.js';
const out = [];
const st = (id, level) => unitBattleStats({ units: { [id]: { level, breakthrough: 5, awaken: 5, gear: {} } }, gear: {} }, id);
test('dbg', () => {
  for (const [sid, units] of [['1-1',['aoi','rei','hikari']],['1-5',['yuki','aoi','rei','hikari']],['3-1',['kage','sango','yuki','aoi','rei','nami']],['5-5',['midori','shiro','umeko','kage','sango','yuki','aoi','rei','nami']],['8-1',['suzu','midori','shiro','umeko','kage','sango','yuki','aoi','nami']]]) {
    for (const lv of [40, 60]) {
      const base = autoPlan(sid, units);
      const hi = base.findIndex((a) => a.unitId === units[units.length-1] && a.action === 'place');
      const plan = [...base.slice(0, hi), ...base.slice(hi+1, hi+3), base[hi], ...base.slice(hi+3)];
      const towers = units.slice(0,-1);
      const r = runHeadless({ stageId: sid, difficulty: 'nightmare', plan, seed: 1, maxTime: 7200,
        loadout: towers.map((id) => ({ unitId: id, stats: st(id, lv) })), hero: { unitId: units[units.length-1], stats: st(units[units.length-1], lv) } });
      out.push(`${sid} L${lv} ${r.won} wave ${r.wave}/${r.sim.totalWaves}`);
    }
  }
  writeFileSync('/tmp/claude-0/sc/dbg.txt', out.join('\n'));
}, 600000);
