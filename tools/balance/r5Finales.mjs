// Balance round 5: the campaign finales on Nightmare (and Hard) with the teams players actually field
// (docs/BALANCE.md "Balance round 5"; the round-4 critic's finding 3: a common gacha team lost Nightmare finales).
//
//   node --import ./tools/simLoader.mjs tools/balance/r5Finales.mjs [--diff nightmare] [--teams free,common]
//        [--levels mid,late] [--seeds 1,2,3] [--stages 1-5,2-5,…] [--json]
//
// Teams (the bot's autoPlan; 8 girls and the free hero):
//   free    the free roster before the stage (tests/sim/modesBot.js freeUnitsBefore)
//   common  the girls most players own: the free roster with its last four swapped for the four gacha girls every
//           account pulls first (R and SR at the base rates: Akane, Raika, Miko, Kinu)
// Accounts: `mid` = the census level of the chapter (tests/integration/balance.test.js expectedLevel), no stars, no
// gear; `max` = fully maxed (tools/balance/r5Bench.mjs maxedProfile); `late` = Lv 60, ★3, gates 5, two Epic +6 pieces of ATK / attack speed (a player who farms Nightmare).
import { defaultData } from '../../src/sim/data.js';
import { runHeadless, autoPlan } from '../../src/sim/headless.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { freeUnitsBefore } from '../../tests/sim/modesBot.js';
import { maxedStats } from './r5Bench.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const EXPECTED_LEVEL = { 1: 1, 2: 8, 3: 14, 4: 20, 5: 25, 6: 30, 7: 35, 8: 40 };
const expectedLevel = (s) => EXPECTED_LEVEL[s.act === 2 ? Math.min(8, s.chapter + 1) : s.chapter] || 1;
export const COMMON_GACHA = ['akane', 'raika', 'miko', 'kinu'];

function stats(id, level, late) {
  if (late === 'max') return maxedStats(id);
  if (!late) return unitBattleStats({ units: { [id]: { level, breakthrough: Math.max(0, Math.ceil((level - 10) / 10)), awaken: 0, gear: {} } }, gear: {} }, id);
  const piece = (uid, slot, stat, value) => ({ uid, slot, rarity: 'epic', level: 6, main: { stat, base: value, value }, subs: [], ur: 0, club: null, equippedBy: id, name: uid });
  const a = piece(`${id}_a`, 'charm', 'atkPct', 0.3);
  const b = piece(`${id}_b`, 'shoes', 'ratePct', 0.15);
  return unitBattleStats({ units: { [id]: { level: 60, breakthrough: 5, awaken: 3, gear: { charm: a.uid, shoes: b.uid } } }, gear: { [a.uid]: a, [b.uid]: b } }, id);
}

export function team(d, stageId, kind) {
  const free = freeUnitsBefore(d, stageId);
  if (kind !== 'common') return free;
  const keep = free.towers.filter((id) => !COMMON_GACHA.includes(id)).slice(0, 8 - COMMON_GACHA.length);
  return { towers: [...keep, ...COMMON_GACHA], hero: free.hero };
}

export function runFinale(d, stageId, difficulty, kind, levelKind, seed) {
  const s = d.stages[stageId];
  const { towers, hero } = team(d, stageId, kind);
  const late = levelKind === 'max' ? 'max' : levelKind === 'late';
  const level = late ? 60 : expectedLevel(s);
  const plan = autoPlan(stageId, [...towers, ...(hero ? [hero] : [])]);
  const r = runHeadless({
    stageId, difficulty, plan, seed, maxTime: 7200,
    loadout: towers.map((id) => ({ unitId: id, stats: stats(id, level, late) })),
    hero: hero ? { unitId: hero, stats: stats(hero, level, late) } : null,
  });
  return { stageId, difficulty, team: kind, account: levelKind, seed, won: r.won, wave: r.wave, total: r.sim.totalWaves, lives: r.lives, maxLives: r.maxLives };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const d = defaultData();
  const finales = Object.values(d.stages).filter((s) => s.kind === 'campaign' && (s.id.endsWith('-5') || s.id.endsWith('-10'))).map((s) => s.id);
  const stages = opt('stages', '') ? opt('stages').split(',') : finales;
  const diffs = opt('diff', 'nightmare').split(',');
  const teams = opt('teams', 'free,common').split(',');
  const levels = opt('levels', 'mid,late').split(',');
  const seeds = opt('seeds', '1,2,3').split(',').map(Number);
  for (const stageId of stages) {
    for (const difficulty of diffs) {
      for (const kind of teams) {
        for (const lk of levels) {
          for (const seed of seeds) {
            const r = runFinale(d, stageId, difficulty, kind, lk, seed);
            console.log(argv.includes('--json') ? JSON.stringify(r) : `${stageId} ${difficulty} ${kind} ${lk} s${seed}: ${r.won ? 'WON' : 'lost'} w${r.wave}/${r.total} lives ${r.lives}/${r.maxLives}`);
          }
        }
      }
    }
  }
}
