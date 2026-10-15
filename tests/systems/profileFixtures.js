// Saves for the Sensei Profile tests: a fresh one and a late-game one (every girl maxed in legendary
// +10 gear, every medal, freeplay marks, claimed achievements).
import { createProfile } from '../../src/systems/save.js';
import { UNITS } from '../../src/data/units.js';
import { STAGES } from '../../src/data/stages.js';
import { ACHIEVEMENTS } from '../../src/data/missions.js';
import { rollGear, addGear } from '../../src/systems/gear.js';
import { createRng } from '../../src/core/rng.js';

export function freshSave() {
  return createProfile();
}

export function lateSave() {
  const p = createProfile();
  const rng = createRng('profile-late');
  for (const u of UNITS) {
    p.units[u.id] = { level: 60, exp: 0, breakthrough: 5, awaken: 5, gear: { charm: null, ribbon: null, shoes: null }, obtainedAt: 1, favorite: false, dupes: 5 };
    for (const slot of ['charm', 'ribbon', 'shoes']) {
      const g = rollGear(rng, { slot, rarity: 'legendary', level: 10 });
      const uid = addGear(p, g);
      p.gear[uid].equippedBy = u.id;
      p.units[u.id].gear[slot] = uid;
    }
  }
  for (const s of STAGES) p.progress.stages[s.id] = { clears: 3, easy: true, normal: true, hard: true, nightmare: true, freeplayBest: { blossom: 150 } };
  p.progress.stages['5-4'].freeplayBest = { blossom: 212 };
  p.progress.stages['8-1'].coopBestWave = { tempest: 168 };
  p.progress.stages['7-3'].coopBestWave = { crimson: 121 };
  p.missions.counters['fpm:blossom:matriarch'] = 1;
  p.missions.counters['fpm:crimson:matriarch'] = 1;
  p.missions.counters['fpm:crimson:wyrm'] = 1;
  for (const a of ACHIEVEMENTS) p.missions.achievements[a.id] = true;
  p.stats.kills = 25310;
  return p;
}
