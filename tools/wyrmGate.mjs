// G4, the Wyrm gate (docs: GEAR_UPDATE.md §8.4 "G4 in detail"; the owner's Q6: the best full Blank LR team beats the
// wave-250 Eclipse Wyrm in 1–3 of 4 runs, a hard and earned kill). Each run plays tools/capBot.mjs's board with real
// coins to wave 249 and keeps that board, then:
//   win     wave 250 played for real (no more spending): the Wyrm falls and the run stands
//   margin  on a loss, the Wyrm's HP left when the board fell (or the wave it fell on, if earlier); on a win, the
//           seconds the Wyrm lived
//   K       the kill ratio: the most Wyrm HP that board kills alone (tools/bossCap.mjs measure, bisected) ÷ its
//           scheduled HP at 250. The tuner's steering number; only wins count for the band.
//
//   node --import ./tools/simLoader.mjs tools/wyrmGate.mjs [--boards A,A2,W,LR] [--presets urLate5,lrSet5,lrBlank4,lrBlank5]
//        [--stages 4-5,1-5] [--seeds 7,11,13,17,19,23,29,31,37,41,43,47] [--tier blossom] [--difficulty normal]
//        [--jobs N] [--out runs.jsonl] [--resume]
//
// 2 stages × 12 seeds = 24 runs a board and preset; every run is its own process (capBot reads its own command line),
// `--jobs` at a time (default: cores − 1). `--out` appends one JSON line a run; `--resume` skips the runs already in
// it. The pass line (§8.4 G4; exit 1 on a miss):
//   - the best board in lrBlank5 (highest median K) wins 6–18 of 24 (tuned to 6–10), at least 2 on each stage, its
//     median K 0.9–1.15 and its losses' median HP left ≤ 30 %;
//   - every board in urLate5, lrSet5 and lrBlank4 wins 0 of 24 with K ≤ 0.8 on every run.
// A partial matrix (fewer presets, boards or seeds) prints its numbers and checks only the lines it has.
// No accessories: ACCESSORIES A-G2 (the same 24 runs with R5 accessories) waits for the accessories in the tree.
//
// One run alone (what each process does): ... tools/wyrmGate.mjs --one --build W --gear lrBlank5 --stage 4-5 --seed 7
import { spawn } from 'node:child_process';
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { cpus } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { runCapBot } from './capBot.mjs';
import { measure } from './bossCap.mjs';

export const WYRM = 'fp_eclipse_wyrm';
export const WYRM_WAVE = 250;
export const SEEDS = Object.freeze([7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]);
export const BOARDS = Object.freeze(['A', 'A2', 'W', 'LR']);
export const PRESETS = Object.freeze(['urLate5', 'lrSet5', 'lrBlank4', 'lrBlank5']);
/** §8.4 G4's numbers. */
export const BAND = Object.freeze({ min: 6, max: 18, tunedMax: 10, perStage: 2, kLo: 0.9, kHi: 1.15, hpLeftMax: 0.3, weakK: 0.8 });

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const list = (k, d) => String(opt(k, d.join(','))).split(',').filter(Boolean);

/** Wave 250 on the board `sim` stands on (no more spending), then K on that same board (inside capBot's det math). */
function playWyrm(sim) {
  const out = { win: false, fellAt: null, hpLeft: null, lived: null, k: null, kc: null };
  if (sim.state === 'lost') out.fellAt = sim.wave;
  else {
    let leaked = false;
    const emit0 = sim._emit;
    sim._emit = function emit(type, p, ...rest) {
      if (type === 'leak' && p?.id === WYRM) leaked = true;
      return emit0.call(this, type, p, ...rest);
    };
    sim.startNextWave();
    let t0 = null;
    let frac = 1;
    let gone = null;
    for (let i = 0; i < 40000 && sim.state === 'wave'; i++) {
      sim.update(0.5);
      sim.drainEvents();
      let hp = 0;
      let max = 0;
      for (const e of sim.enemies) if (e.id === WYRM && !e.dead) { hp += Math.max(0, e.hp); max += e.maxHp; }
      if (max > 0) {
        if (t0 == null) t0 = sim.time;
        frac = hp / max;
      } else if (t0 != null && gone == null) gone = sim.time;
    }
    sim._emit = emit0;
    const lost = sim.state === 'lost';
    out.win = !lost && !leaked && t0 != null && sim.wavesCleared >= WYRM_WAVE;
    if (out.win) out.lived = +((gone ?? sim.time) - t0).toFixed(1);
    else {
      out.fellAt = lost ? sim.wave : null;
      out.hpLeft = +(leaked || lost ? frac : 0).toFixed(4);
    }
  }
  const m = measure(sim, WYRM_WAVE, [WYRM]).res[WYRM];
  out.k = m.ratio;
  out.kc = m.kc;
  return out;
}

/** One run (the --one process): capBot's board to 249, then playWyrm. */
function runOne() {
  const r = runCapBot({ maxWave: WYRM_WAVE - 1, after: playWyrm });
  const { kc: wyrm } = r;
  const row = {
    board: r.build, preset: opt('gear'), stage: r.stage, tier: r.tier, seed: r.seed, difficulty: opt('difficulty', 'normal'),
    reached249: r.fell == null, fell: r.fell, towers: r.towers, finals: r.finals, ...wyrm, wallSec: r.wallSec,
  };
  console.log(JSON.stringify(row));
}

const median = (xs) => {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

/** The matrix's summary and its pass line. */
export function judge(rows, { stages }) {
  const groups = {};
  for (const r of rows) (groups[`${r.board} ${r.preset}`] ||= []).push(r);
  const sum = Object.entries(groups).map(([key, rs]) => {
    const [board, preset] = key.split(' ');
    const wins = rs.filter((r) => r.win).length;
    const byStage = Object.fromEntries(stages.map((s) => [s, rs.filter((r) => r.stage === s && r.win).length]));
    const losses = rs.filter((r) => !r.win);
    return {
      board, preset, runs: rs.length, wins, byStage, medianK: median(rs.map((r) => r.k)), maxK: Math.max(...rs.map((r) => r.k ?? 0)),
      lossHpLeft: median(losses.map((r) => r.hpLeft)), fellEarly: losses.filter((r) => r.fell != null && r.fell < WYRM_WAVE).length,
    };
  });
  const fails = [];
  const notes = [];
  const top = sum.filter((s) => s.preset === 'lrBlank5').sort((a, b) => (b.medianK ?? -1) - (a.medianK ?? -1))[0];
  if (top) {
    const n = top.runs;
    const full = n === stages.length * SEEDS.length;
    const lo = Math.ceil((BAND.min * n) / 24);
    const hi = Math.floor((BAND.max * n) / 24);
    notes.push(`best board in lrBlank5: ${top.board} (median K ${top.medianK}), ${top.wins} of ${n} wins${full ? '' : ` (a partial matrix: the band scaled to ${lo}–${hi})`}`);
    if (top.wins < lo || top.wins > hi) fails.push(`${top.board} lrBlank5 wins ${top.wins} of ${n}, outside ${lo}–${hi}`);
    else if (top.wins > Math.floor((BAND.tunedMax * n) / 24)) notes.push(`${top.board} lrBlank5 is in the band but above the tuned ${BAND.min}–${BAND.tunedMax} (room for the accessories)`);
    if (full) for (const s of stages) if (top.byStage[s] < BAND.perStage) fails.push(`${top.board} lrBlank5 wins ${top.byStage[s]} on ${s} (< ${BAND.perStage})`);
    if (!(top.medianK >= BAND.kLo && top.medianK <= BAND.kHi)) fails.push(`${top.board} lrBlank5 median K ${top.medianK} outside ${BAND.kLo}–${BAND.kHi}`);
    if (top.lossHpLeft != null && top.lossHpLeft > BAND.hpLeftMax) fails.push(`${top.board} lrBlank5 losses' median HP left ${top.lossHpLeft} > ${BAND.hpLeftMax}`);
  }
  for (const s of sum.filter((x) => x.preset !== 'lrBlank5')) {
    if (s.wins > 0) fails.push(`${s.board} ${s.preset} wins ${s.wins} (a weaker preset must win 0)`);
    if (s.maxK > BAND.weakK) fails.push(`${s.board} ${s.preset} K up to ${s.maxK} (> ${BAND.weakK} on a run)`);
  }
  return { sum, fails, notes };
}

/** The matrix: every run its own process, `jobs` at a time. */
async function runMatrix() {
  const boards = list('boards', BOARDS);
  const presets = list('presets', PRESETS);
  const stages = list('stages', ['4-5', '1-5']);
  const seeds = list('seeds', SEEDS).map(Number);
  const tier = opt('tier', 'blossom');
  const difficulty = opt('difficulty', 'normal');
  const jobs = Math.max(1, Number(opt('jobs', Math.max(1, cpus().length - 1))));
  const out = opt('out', null);
  const key = (r) => `${r.board} ${r.preset} ${r.stage} ${r.tier} ${r.seed} ${r.difficulty}`;
  const rows = out && args.includes('--resume') && existsSync(out) ? readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const done = new Set(rows.map(key));
  const todo = [];
  for (const board of boards) for (const preset of presets) for (const stage of stages) for (const seed of seeds) {
    if (!done.has(key({ board, preset, stage, tier, seed, difficulty }))) todo.push({ board, preset, stage, seed });
  }
  const self = fileURLToPath(import.meta.url);
  const one = (j) => new Promise((resolve) => {
    const argv = ['--import', './tools/simLoader.mjs', self, '--one', '--build', j.board, '--profile', 'full', '--gear', j.preset,
      '--stage', j.stage, '--tier', tier, '--difficulty', difficulty, '--seed', String(j.seed)];
    const p = spawn(process.execPath, argv, { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '';
    p.stdout.on('data', (d) => { buf += d; });
    p.on('close', (code) => {
      const line = buf.trim().split('\n').pop();
      let row = null;
      try { row = JSON.parse(line); } catch { row = { ...j, tier, difficulty, error: `exit ${code}` }; }
      resolve(row);
    });
  });
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const j = todo[next++];
      const row = await one(j);
      rows.push(row);
      if (out) appendFileSync(out, `${JSON.stringify(row)}\n`);
      console.log(JSON.stringify(row));
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, todo.length) }, worker));
  const errs = rows.filter((r) => r.error);
  const { sum, fails, notes } = judge(rows.filter((r) => !r.error), { stages });
  for (const s of sum) console.log(`SUMMARY ${s.board.padEnd(3)} ${s.preset.padEnd(9)} wins ${s.wins}/${s.runs} ${JSON.stringify(s.byStage)} median K ${s.medianK} max K ${s.maxK} losses' HP left ${s.lossHpLeft} fell early ${s.fellEarly}`);
  for (const n of notes) console.log(`NOTE ${n}`);
  for (const e of errs) console.log(`ERROR ${key(e)}: ${e.error}`);
  for (const f of fails) console.log(`FAIL ${f}`);
  console.log(fails.length || errs.length ? `G4: ${fails.length} miss(es), ${errs.length} error(s)` : 'G4: pass');
  process.exit(fails.length || errs.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (args.includes('--one')) runOne();
  else await runMatrix();
}
