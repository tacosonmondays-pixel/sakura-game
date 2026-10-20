// The roster wave's balance bench (tools/balance/rosterWave.js; docs/BALANCE.md "Roster wave"): runs only
// with BALANCE=roster (it benches every tower at three builds, a few minutes).
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/Sim.js';
import { xpToReach } from '../../src/sim/hero.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { UNITS } from '../../src/data/units.js';
import { EXPANSION_IDS } from '../../src/data/unitsExpansion.js';
import { rosterWaveTables } from '../../tools/balance/rosterWave.js';

test.runIf(process.env.BALANCE === 'roster')('roster wave bench: the returning girls beside their rarity bands', () => {
  const only = process.env.BALANCE_ONLY ? new Set(process.env.BALANCE_ONLY.split(',')) : null;
  const text = rosterWaveTables({ Sim, xpToReach, ENEMY_MAP, UNITS, EXPANSION_IDS }, { only });
  if (process.env.BALANCE_OUT) writeFileSync(process.env.BALANCE_OUT, `${text}\n`);
  console.log(text);
}, 3600000);
