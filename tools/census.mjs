// Campaign census: the balance test's bot (autoPlan, the free roster unlocked before each stage, the
// expected level per chapter; tests/integration/balance.test.js) on every campaign stage, on one difficulty.
// Records the outcome, lives, when tier 4 / tier 5 get bought, and compares with a baseline taken before the
// path-cap / final-tier pass (tools/baselines/census-<difficulty>-base.jsonl, live fddf01c).
//
//   node --import ./tools/simLoader.mjs tools/census.mjs [easy|normal|hard] [--stage 3-] [--json]
//
// Output: one line per stage (outcome, lives, tier-4/5 buys, and the baseline's outcome/lives), then a
// summary: outcome flips (win→loss / loss→win) and "trivial" stages (a Hard win with zero leaks on a
// stage that was lost or won with < 80% lives).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Sim } from '../src/sim/Sim.js';
import { defaultData } from '../src/sim/data.js';
import { autoPlan } from '../src/sim/headless.js';
import { unitBattleStats } from '../src/systems/progression.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const diff = args.find((a) => ['easy', 'normal', 'hard', 'nightmare'].includes(a)) || 'normal';
const stageArg = args.includes('--stage') ? args[args.indexOf('--stage') + 1] : '';
const asJson = args.includes('--json');
const EXPECTED_LEVEL = { 1: 1, 2: 8, 3: 14, 4: 20, 5: 25, 6: 30, 7: 35, 8: 40 };
const d = defaultData();

function freeUnitsBefore(stageId) {
  const campaign = Object.values(d.stages).filter((s) => s.kind === 'campaign');
  const order = new Map(campaign.map((s, i) => [s.id, i]));
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

function run(stageId, level, seed = 1) {
  const { towers, hero } = freeUnitsBefore(stageId);
  const plan = autoPlan(stageId, [...towers, ...(hero ? [hero] : [])]);
  const sim = new Sim({
    stageId, difficulty: diff, seed, options: { autoStart: false },
    loadout: towers.map((id) => ({ unitId: id, stats: statsAtLevel(id, level) })),
    hero: hero ? { unitId: hero, stats: statsAtLevel(hero, level) } : null,
  });
  const pending = plan.slice();
  const ev = { t4: [], t5: [], refused: 0 };
  const exec = (a) => {
    if (a.action === 'place') {
      const c = sim.canPlace(a.unitId, a.x, a.y);
      if (c.ok) return sim.placeTower(a.unitId, a.x, a.y) ? 'done' : 'fail';
      return c.reason === 'cash' ? 'wait' : 'fail';
    }
    const t = sim.towerAt(a.x, a.y);
    if (!t) return 'fail';
    const st = sim.upgradeStatus(t.uid, a.path ?? 0);
    if (st.reason === 'onePerPath') ev.refused++;
    if (!st.locked) {
      const ok = sim.upgradeTower(t.uid, a.path ?? 0);
      if (ok) {
        const tier = t.tiers[a.path];
        if (tier === 4) ev.t4.push(`${t.unitId}:${a.path}@w${sim.wave}`);
        if (tier === 5) ev.t5.push(`${t.unitId}:${a.path}@w${sim.wave}`);
      }
      return ok ? 'done' : 'fail';
    }
    return st.reason === 'cash' ? 'wait' : 'fail';
  };
  while (sim.time < 7200 && sim.state !== 'won' && sim.state !== 'lost') {
    while (pending.length) {
      const a = pending[0];
      if ((a.at ?? 1) > sim.wave + 1) break;
      const r = exec(a);
      if (r === 'wait') break;
      pending.shift();
    }
    if (sim.state === 'prep' || sim.state === 'between') {
      if (!sim.startNextWave()) break;
    }
    sim.update(0.25);
    sim.drainEvents();
  }
  const res = sim.result();
  return {
    stageId, diff, level, won: sim.state === 'won', wave: sim.wave, total: sim.totalWaves, lives: sim.lives, maxLives: sim.maxLives,
    cashEarned: Math.round(res.stats?.cashEarned ?? 0), t4: ev.t4, t5: ev.t5, refused: ev.refused, towers: sim.towers.length,
  };
}

const basePath = join(HERE, 'baselines', `census-${diff}-base.jsonl`);
const base = new Map(existsSync(basePath) ? readFileSync(basePath, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((r) => [r.stageId, r]) : []);
const campaign = Object.values(d.stages).filter((s) => s.kind === 'campaign' && (!stageArg || s.id.startsWith(stageArg)));
const flips = [];
const trivial = [];
for (const s of campaign) {
  const r = run(s.id, EXPECTED_LEVEL[s.chapter] || 1);
  const b = base.get(s.id);
  if (b && b.won !== r.won) flips.push(`${s.id} ${b.won ? 'win→loss' : 'loss→win'} (lives ${b.lives} → ${r.lives})`);
  if (diff === 'hard' && r.won && r.lives === r.maxLives && b && (!b.won || b.lives < 0.8 * b.maxLives)) trivial.push(s.id);
  if (asJson) console.log(JSON.stringify({ ...r, base: b ? { won: b.won, wave: b.wave, lives: b.lives } : null }));
  else {
    const was = b ? `${b.won ? 'won' : 'lost'} ${b.lives}/${b.maxLives}` : '-';
    console.log(`${s.id.padEnd(4)} ${diff} ${(r.won ? 'won ' : 'lost').padEnd(4)} w${r.wave}/${r.total} lives ${r.lives}/${r.maxLives} (was ${was}) T4 ${r.t4.join(' ') || '-'} T5 ${r.t5.join(' ') || '-'}`);
  }
}
console.log(`SUMMARY ${diff}: ${campaign.length} stages, flips: ${flips.join('; ') || 'none'}; trivial: ${trivial.join(', ') || 'none'}`);
