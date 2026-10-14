// Rewards for a co-op battle, applied by each player to their own save: the stage's normal
// drops on a win (and coins per wave on a loss), bestiary sightings and mission kill counts.
// No medals, first-clear gems or unlocks — those stay a solo achievement.
import { rollStageDrops } from '../../systems/rewards.js';
import { addItems } from '../../systems/inventory.js';
import { track } from '../../systems/missions.js';
import { STAGE_MAP } from '../../data/stages.js';
import { ENEMY_MAP } from '../../data/enemies.js';

/**
 * @param {object} profile
 * @param {object} result Sim.result()
 * @param {{ next(): number }} rng
 * @returns {object} the same shape applyBattleResult returns, plus `coop: true`
 */
export function applyCoopResult(profile, result, rng) {
  const out = { firstClear: false, newMedal: false, medal: null, rewards: [], gear: [], unlockedUnits: [], discovered: [], gemsEarned: 0, eventBonus: false, practice: false, coop: true };
  const stage = STAGE_MAP[result?.stageId];
  if (!stage) return out;
  profile.bestiary ||= {};
  let kills = 0;
  for (const id of new Set([...(result.encountered || []), ...Object.keys(result.kills || {})])) {
    if (!ENEMY_MAP[id]) continue;
    const b = (profile.bestiary[id] ||= { seen: false, discovered: false, kills: 0 });
    b.seen = true;
    const n = Math.max(0, Math.floor(Number(result.kills?.[id]) || 0));
    b.kills += n;
    kills += n;
  }
  const rewards = [];
  if (result.won) {
    const drops = rollStageDrops(stage.id, result.difficulty, rng);
    for (const d of drops) if (d && d.id && !d.gear) rewards.push({ id: d.id, count: d.count });
    rewards.push({ id: 'coins', count: 300 + 40 * (result.wavesCleared || 0) });
  } else if (result.wavesCleared > 0) {
    rewards.push({ id: 'coins', count: 40 * result.wavesCleared });
  }
  if (kills) track(profile, 'kill', kills);
  out.rewards = addItems(profile, rewards);
  return out;
}
