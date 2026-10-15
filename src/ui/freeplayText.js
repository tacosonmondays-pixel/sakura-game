// Freeplay texts shared by the co-op room and solo stage prep: each tier's one-line pitch and what
// freeplay brings on a stage ("15 waves, then freeplay (Tempest): …"), read from the same pure boss
// schedule the battle uses.
import { STAGE_MAP } from '../data/stages.js';
import { freeplayTable } from '../data/freeplay.js';
import { freeplayBosses } from '../sim/freeplay.js';

/** Room text per freeplay tier (spec §3.1). */
export const TIER_PITCH = {
  blossom: 'Petals and pressure — the classic climb to the Matriarch.',
  tempest: 'Storm season: bosses come early and hit hard.',
  crimson: 'Under the red moon nothing holds for long.',
};

/**
 * What freeplay brings on this stage and tier, from the same pure schedule the battle uses:
 * "15 waves, then freeplay (Tempest): visitors from every chapter, bosses every 10 waves (every 5
 * deep in), titans from wave 170, the Ashwing Matriarch at 200."
 */
export function freeplaySummary(stageId, tier) {
  const base = STAGE_MAP[stageId];
  const fp = freeplayTable(tier);
  if (!fp || base?.kind !== 'campaign' || !Number.isFinite(base.waves)) return null;
  const st = { ...base, freeplay: fp };
  let titan = null;
  let boss = null;
  for (let w = st.waves + 1; w <= (fp.finale?.wave ?? 200) && !titan; w++) {
    const b = freeplayBosses(st, w);
    if (!boss && b && b.kind !== 'miniboss') boss = w;
    if (b?.kind === 'titan') titan = w;
  }
  const bits = ['visitors from every chapter', 'bosses every 10 waves (every 5 deep in)'];
  if (boss) bits.push(`big bosses from wave ${boss}`);
  if (titan) bits.push(`titans from wave ${titan}`);
  bits.push(`the Ashwing Matriarch at ${fp.finale?.wave ?? 200}`);
  return `${st.waves} waves, then freeplay (${fp.name}): ${bits.join(', ')}.`;
}

