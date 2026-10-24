// BALANCE REVIEW ONLY (untracked scratch, never commit): the campaign balance bot of
// tests/integration/balance.test.js (autoPlan, free units only, EXPECTED_LEVEL, seed 1) as a plain Node run, so the
// proposal preload (tools/_propPreload.mjs) can be measured against it.
//   node --import ./tools/simLoader.mjs [--import ./tools/_propPreload.mjs] tools/_camp.mjs --stages 1-1,...|ch1-3 [--headroom] [--diffs easy,normal,hard,nightmare] --label x --out f.jsonl
import { appendFileSync } from 'node:fs';
import { defaultData } from '../src/sim/data.js';
import { runHeadless, autoPlan } from '../src/sim/headless.js';
import { unitBattleStats } from '../src/systems/progression.js';
import { headroom } from './balance/headroom.js';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const flag = (k) => args.includes(`--${k}`);
const EXPECTED_LEVEL = { 1: 1, 2: 8, 3: 14, 4: 20, 5: 25, 6: 30, 7: 35, 8: 40 };
const d = defaultData();
const campaign = Object.values(d.stages).filter((s) => s.kind === 'campaign');
const order = new Map(campaign.map((s, i) => [s.id, i]));

function freeUnitsBefore(stageId) {
  const idx = order.get(stageId);
  const avail = Object.values(d.units).filter((u) => {
    const a = u.acquisition || {};
    if (a.type === 'starter') return true;
    return a.type === 'free' && order.has(a.afterStage) && order.get(a.afterStage) < idx;
  });
  const recency = (u) => (u.acquisition?.type === 'free' ? order.get(u.acquisition.afterStage) : -1);
  const towers = avail.filter((u) => u.kind === 'tower').sort((a, b) => recency(b) - recency(a)).slice(0, 8);
  const hero = avail.filter((u) => u.kind === 'hero').sort((a, b) => recency(b) - recency(a))[0] || null;
  return { towers: towers.map((u) => u.id), hero: hero?.id || null };
}
function statsAtLevel(unitId, level) {
  const breakthrough = Math.max(0, Math.ceil((level - 10) / 10));
  return unitBattleStats({ units: { [unitId]: { level, breakthrough, awaken: 0, gear: {} } }, gear: {} }, unitId);
}
// --with ena,chigusa: a player who also owns these (gacha) girls: they lead the roster (still 8 at most)
const WITH = (args.includes('--with') ? args[args.indexOf('--with') + 1] : '').split(',').filter(Boolean);
function runStage(stageId, difficulty, level, seed = 1, { hpMul = 1 } = {}) {
  const free = freeUnitsBefore(stageId);
  const towers = [...WITH, ...free.towers.filter((id) => !WITH.includes(id))].slice(0, 8);
  const hero = free.hero;
  const plan = autoPlan(stageId, [...towers, ...(hero ? [hero] : [])]);
  const st = d.stages[stageId];
  const r = runHeadless({
    stageId, difficulty, plan, seed, maxTime: 7200,
    data: hpMul === 1 ? undefined : { stage: { ...st, hpScale: (st.hpScale ?? 1) * hpMul } },
    loadout: towers.map((id) => ({ unitId: id, stats: statsAtLevel(id, level) })),
    hero: hero ? { unitId: hero, stats: statsAtLevel(hero, level) } : null,
  });
  const tiers = r.sim.towers.filter((t) => !t.isHero).map((t) => `${t.unitId}:${t.tiers.join('')}`);
  return { won: r.won, wave: r.wave, total: r.sim.totalWaves, lives: r.lives, maxLives: r.maxLives, units: [...towers, ...(hero ? [hero] : [])], tiers };
}

let stages = opt('stages', 'ch1-3');
if (/^ch\d-\d$/.test(stages)) {
  const [a, b] = stages.slice(2).split('-').map(Number);
  stages = campaign.filter((s) => s.chapter >= a && s.chapter <= b).map((s) => s.id).join(',');
} else if (stages === 'all') stages = campaign.map((s) => s.id).join(',');
const DIFFS = opt('diffs', 'easy,normal,hard,nightmare').split(',').filter(Boolean);
const OUT = opt('out', null);
const label = opt('label', null);
for (const id of stages.split(',')) {
  const t0 = Date.now();
  const lv = EXPECTED_LEVEL[d.stages[id].chapter] || 1;
  const row = { label, stage: id, level: lv };
  for (const k of DIFFS) {
    const r = runStage(id, k, lv);
    row[k] = { won: r.won, wave: r.wave, total: r.total, lives: r.lives, maxLives: r.maxLives };
    if (k === 'normal' || (!row.units && k === DIFFS[0])) {
      row.units = r.units;
      row.tiers = r.tiers;
    }
  }
  if (flag('headroom')) {
    const hr = headroom((m) => runStage(id, 'normal', lv, 1, { hpMul: m }));
    row.headroom = hr.capped ? 16 : hr.value;
    row.headroomCapped = hr.capped;
  }
  row.ms = Date.now() - t0;
  const line = JSON.stringify(row);
  console.log(line);
  if (OUT) appendFileSync(OUT, `${line}\n`);
}
