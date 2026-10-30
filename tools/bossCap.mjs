// Freeplay boss kill capacity (owner, Oct 30: "certain bosses on nightmare past 100-200 are impossible to kill"): the
// board tools/capBot.mjs builds with real coins up to a wave, then each freeplay boss alone (its own phases, shell,
// regen, summons and split, no escorts and no swarm) walking the longest lane; a geometric bisection on its HP finds
// the most the board kills before it or anything it splits into walks off. Compared with the HP that boss has on its
// scheduled boss waves (src/sim/freeplay.js) at this stage, tier and difficulty.
//
//   node --import ./tools/simLoader.mjs tools/bossCap.mjs --stage 4-5 --tier crimson --difficulty nightmare
//        --build A2 --profile full --waves 100,150,200 [--bosses grave_lych,iron_colossus,…] [capBot's flags]
//
// One JSON line per checkpoint wave: the run's own fall (if it fell before the checkpoint, the board it had), and per
// boss: kc (HP it kills), the boss's scheduled HP on the boss waves in [wave, wave + 24], its walk time with no damage
// (the time on the road), the board's DPS on it (kc ÷ the seconds it lived) and kc ÷ scheduled (≥ 1: killable alone).
// Its summons and its split children carry the wave's pool HP and the split's own share, as in a real boss wave.
import { runCapBot } from './capBot.mjs';
import { soloFreeplayStage } from '../src/data/freeplaySolo.js';
import { freeplayBosses, freeplayHpRamp, freeplayBossFactor } from '../src/sim/freeplay.js';
import { DIFFICULTIES } from '../src/data/types.js';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const stageId = opt('stage', '4-5');
const tier = opt('tier', 'blossom');
const difficulty = opt('difficulty', 'normal');
const WAVES = opt('waves', '100,150,200').split(',').map(Number);
const BOSSES = opt('bosses', 'grave_lych,iron_colossus,fp_foundry_titan,fp_gloom_regent,fp_hyakki_daimyo,dragon_ashwing').split(',');
const WINDOW = Number(opt('window', 24));

const stage = soloFreeplayStage(stageId, tier);
const fp = stage.freeplay;
const diff = DIFFICULTIES[difficulty];
const base = (stage.hpScale ?? 1) * diff.hpMul;
const rankOf = (id, def) => (id === fp.finale.enemy ? 'finale' : id === fp.calamity?.enemy ? 'calamity' : fp.titans.includes(id) ? 'titan' : def.tier === 'miniboss' ? 'miniboss' : 'boss');

/** The boss's scheduled HP on its boss waves in [w0, w0 + WINDOW]: [{ wave, hp }]. */
function scheduled(data, id, w0) {
  const out = [];
  for (let w = w0; w <= w0 + WINDOW; w++) {
    const bw = freeplayBosses(stage, w);
    if (!bw || !bw.bosses.includes(id)) continue;
    const def = data.enemy(id);
    out.push({ wave: w, hp: Math.round(def.hp * base * freeplayHpRamp(stage, w) * freeplayBossFactor(stage, w, bw, rankOf(id, def), id)) });
  }
  return out;
}

/** The longest lane (a boss wave's own). */
function longestPath(sim) {
  let best = 0;
  for (let i = 1; i < sim.pathData.length; i++) if (sim.pathData[i].length > sim.pathData[best].length) best = i;
  return best;
}

/** One walk of boss `id` at HP `H` alone: { killed, sec } (killed: it and everything it split into died, none leaked). */
function walk(sim, id, H, w, path) {
  for (const e of sim.enemies) e.dead = true;
  sim._removeDead();
  const def = sim.data.enemy(id);
  const leaks0 = sim._bossCapLeaks.length;
  // its summons and split children's own summons: the wave's pool HP (a real boss wave's childHpMul)
  const e = sim.spawnEnemy(id, { pathIndex: path, dist: 0, hpMul: H / def.hp, childHpMul: base * freeplayHpRamp(stage, w) });
  if (!e) return null;
  const line = new Set([e.uid]);
  const t0 = sim.time;
  if (sim.state !== 'wave') sim.state = 'wave';
  let alive = true;
  for (let i = 0; i < 6000 && alive; i++) {
    sim.update(0.1);
    sim.drainEvents();
    sim.lives = 1e9;
    alive = false;
    for (const o of sim.enemies) {
      if (o.parentUid != null && line.has(o.parentUid)) line.add(o.uid);
      if (!o.dead && line.has(o.uid)) alive = true;
    }
  }
  const leaked = sim._bossCapLeaks.slice(leaks0).some((u) => line.has(u));
  const sec = sim.time - t0;
  for (const o of sim.enemies) o.dead = true;
  sim._removeDead();
  return { killed: !alive && !leaked, sec };
}

/** The time a boss walks the lane with no damage (its phases never trigger): the time on the road. */
function roadTime(sim, id, path) {
  for (const e of sim.enemies) e.dead = true;
  sim._removeDead();
  const e = sim.spawnEnemy(id, { pathIndex: path, dist: 0, hpMul: 1 });
  const L = sim.pathData[path].length;
  const v = e.speed ?? e.baseSpeed ?? sim.data.enemy(id).speed;
  e.dead = true;
  sim._removeDead();
  return Math.round(L / Math.max(0.01, v));
}

/**
 * The kill capacity of the board `sim` stands on, against each of `bosses` at wave `w` (tools/wyrmGate.mjs calls it on
 * its own board). Leaves the board standing, its enemies cleared.
 */
export function measure(sim, w, bosses = BOSSES) {
  const keepTowers = sim.towers.length;
  for (const e of sim.enemies) e.dead = true;
  sim._removeDead();
  if (sim.state === 'lost') sim.state = 'between';
  sim.lives = 1e9;
  // record the uid of every leak (the leak log keeps only the id)
  sim._bossCapLeaks = [];
  const emit0 = sim._emit.bind(sim);
  sim._emit = (type, p) => {
    if (type === 'leak') sim._bossCapLeaks.push(p.uid);
    return emit0(type, p);
  };
  const path = longestPath(sim);
  const res = {};
  for (const id of bosses) {
    const sch = scheduled(sim.data, id, w);
    let lo = 1e4;
    let hi = 1e13;
    for (let i = 0; i < 22 && hi / lo > 1.05; i++) {
      const mid = Math.sqrt(lo * hi);
      const r = walk(sim, id, mid, w, path);
      if (r && r.killed) lo = mid;
      else hi = mid;
    }
    const r = walk(sim, id, lo, w, path);
    const need = sch.length ? Math.max(...sch.map((s) => s.hp)) : null;
    res[id] = {
      kc: Math.round(lo), ttk: r ? +r.sec.toFixed(1) : null, dps: r ? Math.round(lo / Math.max(1, r.sec)) : null,
      road: roadTime(sim, id, path), armor: sim.data.enemy(id).armor ?? 0,
      scheduled: sch, ratio: need ? +(lo / need).toFixed(3) : null,
    };
  }
  sim._emit = emit0;
  return { towers: keepTowers, path, res };
}

export function bossCap() {
  const out = [];
  for (const w of WAVES) {
    const r = runCapBot({ after: (sim) => measure(sim, w), maxWave: w - 1 });
    const { kc, ...rest } = r;
    out.push({ checkpoint: w, difficulty, ...rest, kc });
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) for (const r of bossCap()) console.log(JSON.stringify(r));
