// Chika flight-mode measurements on the real sim (docs/specs/CHIKA_REWORK.md §16).
//   node tools/chika/run.mjs tools/chika/measure.js boss     [--modes hover,hold,patrol,pursuit]
//   node tools/chika/run.mjs tools/chika/measure.js waves    (Chika alone, real waves, enemies that die)
//   node tools/chika/run.mjs tools/chika/measure.js sabo     (sapper stages: jams, time disabled)
//   node tools/chika/run.mjs tools/chika/measure.js freeplay (co-op freeplay team bot with Chika lines)
//   node tools/chika/run.mjs tools/chika/measure.js perf     (µs per step, 6 Chikas, a dense crowd)
// Every command prints one JSON line per case and a table at the end.
import { Sim } from '../../src/sim/Sim.js';
import { samplePath } from '../../src/sim/path.js';
import { coopStage } from '../../src/data/coop.js';
import { STEP } from '../../src/sim/constants.js';
import { autoPlan } from '../../src/sim/headless.js';

/** Neutral stats, and the freeplay / Potential "strong" preset (L60, ★5, mythic gear). */
export const PROFILES = {
  base: {},
  strong: { damageMul: 2.87, rateMul: 1.53, rangeMul: 1, critChance: 0.39, critMul: 1.48, armorPen: 2, costMul: 1, awakenPassive: true, level: 60, awaken: 5 },
};
export const MODES = ['hover', 'hold', 'patrol', 'pursuit'];

const log = (o) => console.log(JSON.stringify(o));

function opt(args, name, dflt) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
}

// ---------------------------------------------------------------------------
// Spots and flight points (what a sensible player picks)
// ---------------------------------------------------------------------------

export function laneSamples(sim) {
  return sim.pathData.flatMap((p, pi) => samplePath(p, 0.5).filter((s) => !s.hidden).map((s) => ({ x: s.x, y: s.y, d: s.d, pi })));
}

function cover(samples, x, y, r) {
  let n = 0;
  for (const s of samples) if ((s.x - x) ** 2 + (s.y - y) ** 2 <= r * r) n++;
  return n;
}

function nearestLane(samples, x, y) {
  let b = Infinity;
  for (const s of samples) b = Math.min(b, (s.x - x) ** 2 + (s.y - y) ** 2);
  return Math.sqrt(b);
}

/** Candidate spots for `unitId`: 'best' (most lane within her 3.0 range), 'reach' (within 5.0), 'far' (3.6–4.2 from the lane). */
export function chikaSpot(sim, kind, samples = laneSamples(sim), unitId = 'chika', taken = []) {
  let best = null;
  let bestS = -Infinity;
  for (let y = 0.3; y < sim.map.height; y += 0.25) {
    for (let x = 0.3; x < sim.map.width; x += 0.25) {
      const cx = x + 0.013;
      const cy = y + 0.007;
      if (sim.placementReason(unitId, cx, cy)) continue;
      if (taken.some((p) => (p.x - cx) ** 2 + (p.y - cy) ** 2 < 0.9 * 0.9)) continue;
      let s;
      if (kind === 'far') {
        const nl = nearestLane(samples, cx, cy);
        if (nl < 3.6 || nl > 4.2) continue;
        s = cover(samples, cx, cy, 5.0);
      } else s = cover(samples, cx, cy, kind === 'reach' ? 5.0 : 3.0);
      if (s > bestS) {
        bestS = s;
        best = { x: cx, y: cy };
      }
    }
  }
  return best;
}

/**
 * Hold point: the lane point inside her signal range whose surroundings (roam + gun) hold the
 * most lane. Patrol: that point and the best other one at least 3 tiles away.
 */
export function flightPoints(sim, t, samples = laneSamples(sim)) {
  const info = sim.flightInfo(t.uid);
  const sig = info.signal;
  const r = info.roam + t.turretSpec.range;
  const inSig = samples.filter((s) => (s.x - t.x) ** 2 + (s.y - t.y) ** 2 <= sig * sig);
  let a = null;
  let aS = -1;
  for (const s of inSig) {
    const c = cover(samples, s.x, s.y, r);
    if (c > aS) {
      aS = c;
      a = s;
    }
  }
  let b = null;
  let bS = -1;
  for (const s of inSig) {
    if (!a || (s.x - a.x) ** 2 + (s.y - a.y) ** 2 < 9) continue;
    const c = cover(samples, s.x, s.y, r);
    if (c > bS) {
      bS = c;
      b = s;
    }
  }
  return { a: a ? [a.x, a.y] : [t.x, t.y], b: b ? [b.x, b.y] : a ? [a.x, a.y] : [t.x, t.y] };
}

export function applyMode(sim, t, mode, samples) {
  if (mode === 'hover') return;
  if (mode === 'pursuit') {
    sim.setFlight(t.uid, 'pursuit');
    return;
  }
  const p = flightPoints(sim, t, samples);
  if (mode === 'hold') sim.setFlight(t.uid, 'hold', p.a[0], p.a[1]);
  else sim.setFlight(t.uid, 'patrol', p.a[0], p.a[1], p.b[0], p.b[1]);
}

/** Upgrades a girl to a build like '5-0-2' (main path first). */
export function buildTo(sim, t, build) {
  if (!build || build === 't0') return;
  const tiers = build.split('-').map(Number);
  const order = [0, 1, 2].sort((a, b) => tiers[b] - tiers[a]);
  for (const p of order) for (let k = 0; k < tiers[p]; k++) sim.upgradeTower(t.uid, p);
}

function chikaSim(stageId, profile, seed, extra = {}) {
  const sim = new Sim({ stageId, difficulty: extra.difficulty || 'normal', loadout: [{ unitId: 'chika', stats: PROFILES[profile] }], seed, options: { autoStart: false } });
  sim.cash = 1e12;
  return sim;
}

function run(sim, seconds) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n && sim.state !== 'lost'; i++) {
    sim.update(STEP);
    sim.events.length = 0;
  }
}

/** Keeps a wave open with nothing spawning (drones are built only during waves). */
function holdWaveOpen(sim) {
  if (sim.state !== 'wave') sim.startNextWave();
  sim._spawnQueue = [{ t: 1e12, enemyId: 'slime_green', pathIndex: 0 }];
  sim._spawnIndex = 0;
}

// ---------------------------------------------------------------------------
// boss: an immortal boss walks the whole lane once per path, after a 45 s warm-up
// ---------------------------------------------------------------------------

const BOSS_CASES = [
  ['4-5', 'strong', 't0'], ['4-5', 'strong', '3-0-0'], ['4-5', 'strong', '5-2-0'], ['4-5', 'strong', '5-0-2'], ['4-5', 'strong', '2-0-5'],
  ['4-5', 'base', '3-0-0'], ['4-5', 'base', '5-0-2'],
  ['8-5', 'strong', '5-0-2'], ['2-5', 'strong', '5-0-2'],
];

export function bossPass(stageId, profile, build, mode, spotKind = 'best', bossId = 'dragon_ashwing') {
  const sim = chikaSim(stageId, profile, 9);
  const samples = laneSamples(sim);
  const sp = chikaSpot(sim, spotKind, samples);
  const t = sim.placeTower('chika', sp.x, sp.y);
  buildTo(sim, t, build);
  sim.setTargetMode(t.uid, 'strong');
  applyMode(sim, t, mode, samples);
  sim.lives = 1e12;
  holdWaveOpen(sim);
  run(sim, 45);
  const perPath = [];
  for (let pi = 0; pi < sim.pathData.length; pi++) {
    const e = sim.spawnEnemy(bossId, { pathIndex: pi, dist: 0 });
    e.hp = e.maxHp = 1e13;
    e.leak = 1;
    const d0 = t.damageDealt;
    const time0 = sim.time;
    while (!e.dead && sim.time - time0 < 900) run(sim, 1);
    perPath.push(Math.round(t.damageDealt - d0));
    if (!e.dead) e.dead = true;
    run(sim, 8); // the wing comes back before the next pass
  }
  return { perPath, total: perPath.reduce((a, b) => a + b, 0), drones: t.turrets.length };
}

function cmdBoss(args) {
  const modes = opt(args, 'modes', MODES.join(',')).split(',');
  const rows = [];
  for (const [stageId, profile, build] of BOSS_CASES) {
    const row = { stageId, profile, build };
    for (const mode of modes) {
      const r = bossPass(stageId, profile, build, mode);
      row[mode] = r.total;
      row[`${mode}Paths`] = r.perPath;
    }
    log({ test: 'boss', ...row });
    rows.push(row);
  }
  console.log('\n| Stage | Profile | Build | ' + modes.join(' | ') + ' |');
  console.log('|---|---|---|' + modes.map(() => '---').join('|') + '|');
  for (const r of rows) {
    const h = r.hover || 1;
    console.log(`| ${r.stageId} | ${r.profile} | ${r.build} | ` + modes.map((m) => (m === 'hover' ? fmt(r[m]) : `${fmt(r[m])} (${pct(r[m], h)})`)).join(' | ') + ' |');
  }
}

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const pct = (a, b) => `${a >= b ? '+' : ''}${Math.round((a / b - 1) * 100)}%`;

// ---------------------------------------------------------------------------
// waves: Chika alone in a real stage, enemies that die, lives 10^9; kills
// ---------------------------------------------------------------------------

const WAVE_CASES = [
  ['1-3', 'base', 't0'], ['1-3', 'base', '0-0-2'], ['2-5', 'base', '3-0-0'], ['2-5', 'base', '0-0-3'], ['3-5', 'base', '3-0-0'],
  ['4-5', 'base', '5-0-2'], ['4-5', 'base', '2-0-5'], ['4-5', 'strong', '3-0-0'], ['6-5', 'strong', '5-0-2'],
];
const SEEDS = [9, 21, 33];

export function wavesRun(stageId, profile, build, mode, spotKind, seed) {
  const sim = chikaSim(stageId, profile, seed);
  const samples = laneSamples(sim);
  const sp = chikaSpot(sim, spotKind, samples);
  if (!sp) return null;
  const t = sim.placeTower('chika', sp.x, sp.y);
  buildTo(sim, t, build);
  applyMode(sim, t, mode, samples);
  sim.lives = 1e9;
  let jams = 0;
  let disabledSteps = 0;
  while (sim.state !== 'won' && sim.state !== 'lost' && sim.time < 3600) {
    if (sim.state === 'prep' || sim.state === 'between') sim.startNextWave();
    sim.update(STEP);
    if (t.disabled > 0) disabledSteps++;
    for (const ev of sim.events) if (ev.type === 'sabotage' && ev.turretUid != null && ev.towerUid === t.uid) jams++;
    sim.events.length = 0;
  }
  return { kills: t.kills, lost: 1e9 - sim.lives, droneShare: t.damageDealt ? t.droneDmg / t.damageDealt : 0, jams, disabled: Math.round(disabledSteps * STEP) };
}

function mean(a) {
  return a.reduce((x, y) => x + y, 0) / a.length;
}

function cmdWaves(args, cases = WAVE_CASES, test = 'waves') {
  const modes = opt(args, 'modes', MODES.join(',')).split(',');
  const spots = opt(args, 'spots', 'best,far').split(',');
  const rows = [];
  for (const [stageId, profile, build] of cases) {
    for (const spotKind of spots) {
      const row = { stageId, profile, build, spot: spotKind };
      for (const mode of modes) {
        const rs = SEEDS.map((seed) => wavesRun(stageId, profile, build, mode, spotKind, seed)).filter(Boolean);
        if (!rs.length) continue;
        row[mode] = Math.round(mean(rs.map((r) => r.kills)));
        row[`${mode}Lost`] = Math.round(mean(rs.map((r) => r.lost)));
        row[`${mode}Jams`] = Math.round(mean(rs.map((r) => r.jams)));
        row[`${mode}Disabled`] = Math.round(mean(rs.map((r) => r.disabled)));
      }
      if (row.hover == null) continue;
      log({ test, ...row });
      rows.push(row);
    }
  }
  console.log(`\n| Stage | Profile | Build | Spot | ${modes.map((m) => `${m} kills (lives lost${test === 'sabo' ? ', jams' : ''})`).join(' | ')} |`);
  console.log('|---|---|---|---|' + modes.map(() => '---').join('|') + '|');
  for (const r of rows) {
    console.log(`| ${r.stageId} | ${r.profile} | ${r.build} | ${r.spot} | ` + modes.map((m) => {
      const extra = test === 'sabo' ? `, ${r[`${m}Jams`]}` : '';
      const d = m === 'hover' ? '' : ` ${pct(r[m], r.hover || 1)}`;
      return `${r[m]}${d} (${r[`${m}Lost`]}${extra})`;
    }).join(' | ') + ' |');
  }
}

const SABO_CASES = [['6-3', 'base', '3-0-0'], ['6-4', 'base', '3-0-0'], ['6-4', 'base', '5-0-2'], ['6-5', 'base', '3-0-0'], ['6-5', 'base', '5-0-2']];

// ---------------------------------------------------------------------------
// freeplay: the co-op freeplay team bot with Chika lines (every other copy a Chika 5-0-2 / 2-0-5)
// ---------------------------------------------------------------------------

const FP_TEAM = ['kage', 'shiro', 'aoi', 'akane', 'miko', 'chika'];
const FP_CYCLE = [['kage', 0, 2], ['chika', 0, 2], ['shiro', 0, 2], ['chika', 2, 0], ['aoi', 1, 2], ['chika', 0, 2], ['akane', 0, 2], ['chika', 0, 2], ['miko', 0, 2]];

export function freeplayRun(stageId, tier, mode, { maxWave = 220, seed = 5, chikaLines = true } = {}) {
  const stage = coopStage(stageId, { freeplay: tier });
  const team = chikaLines ? FP_TEAM : FP_TEAM.filter((u) => u !== 'chika');
  const sim = new Sim({ stageId, loadout: team.map((unitId) => ({ unitId, stats: PROFILES.strong })), seed, options: { freeplay: true }, data: { stage } });
  const samples = laneSamples(sim);
  const cycle = chikaLines ? FP_CYCLE : FP_CYCLE.filter((c) => c[0] !== 'chika');
  const placed = [];
  let next = 0;
  const towers = [];
  let firstLeak = null;
  const act = () => {
    // upgrade what we own first (main to 5, cross to 2), then buy the next girl in the cycle
    for (const rec of towers) {
      if (rec.t.removed) continue;
      for (const [p, cap] of [[rec.main, 5], [rec.cross, 2]]) {
        while (rec.t.tiers[p] < cap) {
          const st = sim.upgradeStatus(rec.t.uid, p);
          if (st.locked) break;
          sim.upgradeTower(rec.t.uid, p);
          if (rec.t.unitId === 'chika') applyMode(sim, rec.t, mode, samples);
        }
      }
    }
    for (let guard = 0; guard < 4; guard++) {
      const [u, main, cross] = cycle[next % cycle.length];
      const r = u === 'chika' ? 'reach' : 'best';
      const sp = chikaSpot(sim, r, samples, u, placed);
      if (!sp) { next++; continue; }
      if (sim.cash < sim.placeCost(u, sp.x, sp.y)) return;
      const t = sim.placeTower(u, sp.x, sp.y);
      if (!t) { next++; continue; }
      placed.push(sp);
      towers.push({ t, main, cross });
      if (u === 'shiro') sim.setTargetMode(t.uid, 'strong');
      if (u === 'chika') applyMode(sim, t, mode, samples);
      next++;
    }
  };
  while (sim.state !== 'won' && sim.state !== 'lost' && sim.wave <= maxWave) {
    if (sim.state === 'prep' || sim.state === 'between') {
      act();
      sim.startNextWave();
    }
    sim.update(0.25);
    for (const ev of sim.events) if (ev.type === 'leak' && firstLeak == null) firstLeak = sim.wave;
    sim.events.length = 0;
    if (Math.round(sim.time * 4) % 20 === 0) act();
  }
  let chikaDmg = 0;
  let all = 0;
  for (const t of sim.towers) {
    all += t.damageDealt;
    if (t.unitId === 'chika') chikaDmg += t.damageDealt;
  }
  return { wave: sim.wave, state: sim.state, firstLeak, chikas: sim.towers.filter((t) => t.unitId === 'chika').length, share: all ? chikaDmg / all : 0 };
}

function cmdFreeplay(args) {
  const modes = opt(args, 'modes', MODES.join(',')).split(',');
  const stages = opt(args, 'stages', '1-3,8-5').split(',');
  const tier = opt(args, 'tier', 'blossom');
  const rows = [];
  for (const stageId of stages) {
    const row = { stageId, tier };
    const none = freeplayRun(stageId, tier, 'hover', { chikaLines: false });
    row.noChika = none.wave;
    for (const mode of modes) {
      const r = freeplayRun(stageId, tier, mode);
      row[mode] = r.wave;
      row[`${mode}Leak`] = r.firstLeak;
      row[`${mode}Share`] = Math.round(r.share * 100);
      row[`${mode}Chikas`] = r.chikas;
    }
    log({ test: 'freeplay', ...row });
    rows.push(row);
  }
  console.log(`\n| Stage | Tier | no Chika | ${modes.map((m) => `${m}: dies at (first leak, Chika share)`).join(' | ')} |`);
  console.log('|---|---|---|' + modes.map(() => '---').join('|') + '|');
  for (const r of rows) console.log(`| ${r.stageId} | ${r.tier} | ${r.noChika} | ` + modes.map((m) => `${r[m]} (${r[`${m}Leak`]}, ${r[`${m}Share`]}%)`).join(' | ') + ' |');
}

// ---------------------------------------------------------------------------
// perf: 6 Chikas at 5-0-2 (60 drones) in an immortal crowd, µs per step per mode
// ---------------------------------------------------------------------------

function cmdPerf(args) {
  const modes = opt(args, 'modes', MODES.join(',')).split(',');
  const every = Number(opt(args, 'every', '2'));
  const rounds = Number(opt(args, 'rounds', '3'));
  const res = {};
  for (let round = 0; round < rounds; round++) {
    for (const mode of modes) {
      const sim = chikaSim('4-5', 'strong', 9);
      const samples = laneSamples(sim);
      const placed = [];
      for (let i = 0; i < 6; i++) {
        const sp = chikaSpot(sim, 'reach', samples, 'chika', placed);
        placed.push(sp);
        const t = sim.placeTower('chika', sp.x, sp.y);
        buildTo(sim, t, '5-0-2');
        applyMode(sim, t, mode, samples);
      }
      sim.lives = 1e12;
      holdWaveOpen(sim);
      run(sim, 40);
      let k = 0;
      const stepOnce = () => {
        if (k++ % every === 0) {
          for (let pi = 0; pi < sim.pathData.length; pi++) {
            const e = sim.spawnEnemy('orc_grunt', { pathIndex: pi, dist: 0 });
            if (e) {
              e.hp = e.maxHp = 1e12;
              e.leak = 0;
            }
          }
        }
        sim.update(STEP);
        sim.events.length = 0;
      };
      for (let i = 0; i < 1800; i++) stepOnce();
      const times = [];
      for (let i = 0; i < 600; i++) {
        const a = performance.now();
        stepOnce();
        times.push(performance.now() - a);
      }
      times.sort((a, b) => a - b);
      const m = mean(times) * 1000;
      (res[mode] ||= []).push({ mean: Math.round(m), median: Math.round(times[300] * 1000), alive: sim.enemies.length });
    }
  }
  for (const mode of modes) log({ test: 'perf', mode, rounds: res[mode] });
}

// ---------------------------------------------------------------------------
// campaign: an autoPlan team (Hikari, Chika, Aoi, Yuki, ≤ 2 copies), Normal and Hard, 3 seeds;
// every Chika flies the mode under test (points re-picked after each of her upgrades)
// ---------------------------------------------------------------------------

const CAMPAIGN_STAGES = ['1-5', '2-3', '2-5', '3-5', '4-3', '4-5', '5-5', '6-5', '7-5', '8-5'];
const CAMPAIGN_TEAM = ['hikari', 'chika', 'aoi', 'yuki'];

export function campaignRun(stageId, difficulty, seed, mode) {
  const plan = autoPlan(stageId, CAMPAIGN_TEAM, { maxCopies: 2 });
  const sim = new Sim({
    stageId, difficulty, seed, options: { autoStart: false },
    loadout: CAMPAIGN_TEAM.filter((u) => u !== 'hikari').map((unitId) => ({ unitId })), hero: { unitId: 'hikari' },
  });
  const samples = laneSamples(sim);
  const pending = plan.slice();
  const exec = (a) => {
    if (a.action === 'place') {
      const chk = sim.canPlace(a.unitId, a.x, a.y);
      if (!chk.ok) return chk.reason === 'cash' ? 'wait' : 'fail';
      const t = sim.placeTower(a.unitId, a.x, a.y);
      if (t && t.unitId === 'chika') applyMode(sim, t, mode, samples);
      return t ? 'done' : 'fail';
    }
    const t = sim.towerAt(a.x, a.y);
    if (!t) return 'fail';
    const st = sim.upgradeStatus(t.uid, a.path ?? 0);
    if (st.locked) return st.reason === 'cash' ? 'wait' : 'fail';
    sim.upgradeTower(t.uid, a.path ?? 0);
    if (t.unitId === 'chika') applyMode(sim, t, mode, samples);
    return 'done';
  };
  while (sim.state !== 'won' && sim.state !== 'lost' && sim.time < 3600) {
    while (pending.length && (pending[0].at ?? 1) <= sim.wave + 1) {
      const r = exec(pending[0]);
      if (r === 'wait') break;
      pending.shift();
    }
    if (sim.state === 'prep' || sim.state === 'between') sim.startNextWave();
    sim.update(0.25);
    sim.events.length = 0;
  }
  let chika = 0;
  let all = 0;
  for (const t of sim.towers) {
    all += t.damageDealt;
    if (t.unitId === 'chika') chika += t.damageDealt;
  }
  return { won: sim.state === 'won', wave: sim.wave, lives: sim.lives, share: all ? chika / all : 0 };
}

function cmdCampaign(args) {
  const modes = opt(args, 'modes', MODES.join(',')).split(',');
  const rows = [];
  for (const stageId of opt(args, 'stages', CAMPAIGN_STAGES.join(',')).split(',')) {
    for (const difficulty of ['normal', 'hard']) {
      const row = { stageId, difficulty };
      for (const mode of modes) {
        const rs = SEEDS.map((seed) => campaignRun(stageId, difficulty, seed, mode));
        row[mode] = rs.map((r) => (r.won ? `W${r.lives}` : `L${r.wave}`)).join(' ');
        row[`${mode}Share`] = Math.round(mean(rs.map((r) => r.share)) * 100);
      }
      log({ test: 'campaign', ...row });
      rows.push(row);
    }
  }
  console.log(`\n| Stage | Diff | ${modes.map((m) => `${m} (W lives / L wave; Chika share)`).join(' | ')} |`);
  console.log('|---|---|' + modes.map(() => '---').join('|') + '|');
  for (const r of rows) console.log(`| ${r.stageId} | ${r.difficulty} | ` + modes.map((m) => `${r[m]} (${r[`${m}Share`]}%)`).join(' | ') + ' |');
}

export async function main(args) {
  const [cmd, ...rest] = args;
  if (cmd === 'boss') cmdBoss(rest);
  else if (cmd === 'waves') cmdWaves(rest);
  else if (cmd === 'sabo') cmdWaves(rest, SABO_CASES, 'sabo');
  else if (cmd === 'freeplay') cmdFreeplay(rest);
  else if (cmd === 'perf') cmdPerf(rest);
  else if (cmd === 'campaign') cmdCampaign(rest);
  else throw new Error(`unknown command ${cmd}`);
}
