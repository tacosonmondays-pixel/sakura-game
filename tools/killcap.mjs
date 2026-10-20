// Board kill capacity (docs/specs/POTENTIAL.md v3, gate K1; design spec §8.4): the biggest lone boss a
// Freeplay board kills before it walks off. tools/capBot.mjs builds the board (Build A by default,
// at --profile, to --maxWave, default 150), then for every stat block in --blocks every girl on that
// SAME board gets the block's stats and a boss-rank dummy with practically endless HP walks each path
// alone; a geometric bisection on its HP finds the most the board kills on every path.
//
//   node --import ./tools/simLoader.mjs tools/killcap.mjs --stage 4-5 --tier blossom [--seed 7]
//        [--build A] [--coop 0|1|2] [--maxWave 150] [--profile p1 …capBot's profile flags]
//        [--blocks p1,f2p-steady,f2p-late,whale] [--dummies neutral,heavy,spectral,scaled] [--shares]
//
// A block is a profile name (tools/potentialProfiles.mjs) or `potential:level:gear` for an isolation
// (`whale:60:maxed` = everyone P6 at L60 in MAXED gear; potential p1 | f2p | whale | 1…6). Prints
// capBot's JSON line with `kc: { <block>: { <dummy>: { kc, ttk, dps } } }`: kc = the HP it kills, ttk
// = seconds that boss lived on path 0, dps = kc ÷ ttk. --shares prints each girl type's share of the
// damage to stderr. The dummies: armor 4 neutral, 6 heavy, 3 spectral (holy ×2, pierce ×0.5) and 4
// scaled; no escorts, no boss abilities.
import { runCapBot } from './capBot.mjs';
import { PROFILES, profileStats } from './potentialProfiles.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);

const dummy = (id, armor, armorClass) => ({ id, name: id, family: 'construct', tier: 'boss', hp: 1, speed: 0.4, armor, armorClass, bounty: 0, threat: 400, size: 2.5, traits: {}, phases: [] });
const DUMMIES = {
  kc_neutral: dummy('kc_neutral', 4, 'bench'),
  kc_heavy: dummy('kc_heavy', 6, 'heavy'),
  kc_spectral: dummy('kc_spectral', 3, 'spectral'),
  kc_scaled: dummy('kc_scaled', 4, 'scaled'),
};

function blockOf(name) {
  if (PROFILES[name]) return PROFILES[name];
  const [potential, level, gear] = name.split(':');
  if (!gear) throw new Error(`unknown block ${name}: a profile (${Object.keys(PROFILES).join(', ')}) or potential:level:gear`);
  return { potential: /^\d$/.test(potential) ? Number(potential) : potential, level: Number(level), gear };
}
const BLOCKS = opt('blocks', 'p1,f2p-steady,f2p-late,whale').split(',');
const ENEMIES = opt('dummies', 'neutral,heavy,spectral,scaled').split(',').map((d) => `kc_${d}`);
const SHARES = args.includes('--shares');

function setStats(sim, block) {
  for (const t of sim.towers) {
    t.unitStats = profileStats(t.unitId, block);
    sim._refreshTower(t);
  }
  sim._buffsDirty = true;
}

/** One dummy with `H` × its 1 HP down path `pathIndex`, alone; the board's damage to it. */
function walkOnce(sim, enemyId, pathIndex, H, label = null) {
  const e = sim.spawnEnemy(enemyId, { pathIndex, hpMul: H });
  if (!e) return null;
  e.leak = 0;
  const hp0 = e.maxHp;
  const t0 = sim.time;
  let last = e.hp;
  const credit0 = new Map(sim.towers.map((t) => [t.uid, t.damageDealt || 0]));
  for (let i = 0; i < 4000 && !e.dead; i++) {
    sim.update(0.1);
    sim.drainEvents();
    if (!e.dead) last = e.hp;
  }
  if (label) {
    const by = {};
    for (const t of sim.towers) by[t.unitId] = (by[t.unitId] || 0) + (t.damageDealt || 0) - credit0.get(t.uid);
    const tot = Object.values(by).reduce((a, b) => a + b, 0) || 1;
    const top = Object.entries(by).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round((100 * v) / tot)}%`);
    process.stderr.write(`${label} ${enemyId} ${H.toExponential(2)} ${e.dead && !e.leaked ? 'killed' : 'walked off'} in ${(sim.time - t0).toFixed(1)} s: ${top.join(', ')}\n`);
  }
  const killed = e.dead && !e.leaked;
  for (const o of sim.enemies) o.dead = true; // stray summons
  sim._removeDead();
  return { killed, dealt: killed ? hp0 : hp0 - last, sec: sim.time - t0 };
}

/** The biggest dummy HP this board kills on every path (geometric bisection to 4 %). */
function capacity(sim, enemyId, label) {
  let lo = 1e4;
  let hi = 1e12;
  const killsAll = (H) => {
    for (let p = 0; p < sim.pathData.length; p++) {
      const r = walkOnce(sim, enemyId, p, H);
      if (!r || !r.killed) return false;
    }
    return true;
  };
  for (let i = 0; i < 16 && hi / lo > 1.04; i++) {
    const mid = Math.sqrt(lo * hi);
    if (killsAll(mid)) lo = mid;
    else hi = mid;
  }
  const r = walkOnce(sim, enemyId, 0, lo, SHARES ? label : null);
  return { kc: Math.round(lo), ttk: r ? +r.sec.toFixed(1) : null, dps: r ? Math.round(lo / Math.max(1, r.sec)) : null };
}

function measure(sim) {
  for (const e of sim.enemies) e.dead = true;
  sim._removeDead();
  sim.update(0.5);
  sim.drainEvents();
  if (sim.state === 'lost') {
    sim.state = 'between';
    sim.lives = 100;
  }
  const res = {};
  for (const name of BLOCKS) {
    setStats(sim, blockOf(name));
    sim.update(0.2);
    res[name] = {};
    for (const en of ENEMIES) res[name][en.slice(3)] = capacity(sim, en, name);
  }
  return res;
}

console.log(JSON.stringify(runCapBot({ data: { enemies: DUMMIES }, after: measure, maxWave: Number(opt('maxWave', 150)) })));
