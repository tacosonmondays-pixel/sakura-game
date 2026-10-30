// Kohaku's beam bench (the duo's partner weapon, src/sim/duo.js): her beam's own DPS at every Prism Corridor tier,
// with Tsubaki's shells held (her main weapon's cooldown is kept full, so the tower's damage is the beam's alone).
// The real Sim on a real stage, the bench preset of tools/bench.mjs (strong: crit, armour pen, awakened), targets
// healed every step so nothing dies: a boss walking the road through her reach (one target at a time), the same boss
// parked in her reach (held the whole run: Resonant Light's ramp to its cap), a crowd stream (pierce and the extra
// beams) and an armoured, crystal-shelled boss walking through (flat armour and the shell's cap).
//
//   node --import ./tools/simLoader.mjs tools/duoBeam.mjs [--builds c0,c1,…,c5,s2] [--targets boss,held,crowd,armor] [--crit 0.25] [--json]
//
// Builds: cN = Prism Corridor tier N (crosspath Starfall 2 from tier 3 on, as the bench does: 2-N-0), sN = Starfall
// tier N with Prism Corridor 2 (N-2-0; Quick Reload speeds her beam up too). tests/sim/duoBeam.test.js runs the same
// rows against the numbers recorded before the constant beam (v0.1 per-flash beam) and keeps them within a few %.
import { Sim } from '../src/sim/Sim.js';
import { defaultData } from '../src/sim/data.js';
import { samplePath } from '../src/sim/path.js';
import { withDetMath } from '../src/core/detMath.js';

const ID = 'kohaku_tsubaki';
const lv = (L, bt, st) => 1 + 0.018 * (L - 1) + 0.02 * bt + 0.05 * st;
const rt = (L) => 1 + 0.004 * (L - 1);
/** tools/bench.mjs's strong preset (level 60, awakened 3), without crits: a few dozen old flashes are too few for a
 * fair crit average, so the old-vs-new comparison runs on the expected hit (--crit 0.25 puts the bench's crits back). */
export const STRONG = { damageMul: +(lv(60, 5, 3) * 1.45).toFixed(4), rateMul: +(rt(60) * 1.2).toFixed(4), rangeMul: 1, critChance: 0, critMul: 1.3, armorPen: 1, costMul: 1, ultHaste: 0, awakenPassive: true, level: 60, awaken: 3 };
const TARGETS = {
  boss: { id: 'dragon_ashwing', hp: 3e7, every: 0 },
  held: { id: 'dragon_ashwing', hp: 3e7, every: 0, park: true },
  crowd: { id: 'orc_grunt', hp: 5e4, every: 6 },
  armor: { id: 'iron_colossus', hp: 3e7, every: 0 },
};

/** [main, corridor, refraction] tiers of a build name. */
export function buildTiers(b) {
  const m = /^([cs])(\d)$/.exec(b);
  if (!m) throw new Error(`build ${b}`);
  const n = +m[2];
  return m[1] === 'c' ? [n >= 3 ? 2 : 0, n, 0] : [n, 2, 0];
}

/**
 * Her beam's DPS on one target kind: { dps, hits } over `run` seconds after a `warm`-second warm-up.
 * `powerOff`: without the balance rows (src/data/balance.js; as a titan battle reads her), for the mechanics checks.
 * @param {{ build: string, target: 'boss'|'crowd'|'armor', run?: number, warm?: number, seed?: number, crit?: number, data?: object, powerOff?: boolean }} o
 */
export function duoBeamDps({ build, target, run = 60, warm = 10, seed = 9, crit = 0, data = defaultData(), powerOff = false }) {
  const tg = TARGETS[target];
  const tiers = buildTiers(build);
  // the parked boss is measured from her first beam on it, so the ramp's climb is in the number
  if (tg.park) warm = 0;
  return withDetMath(() => {
    const sim = new Sim({ stageId: '4-5', loadout: [{ unitId: ID, stats: { ...STRONG, critChance: crit, ...(powerOff ? { powerOff: true } : {}) } }], hero: null, seed, data });
    sim.cash = 1e15;
    sim.lives = 1e15;
    const samples = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((s) => !s.hidden);
    const R = 3.4;
    let best = null;
    for (let y = 0.3; y < sim.map.height; y += 0.25) {
      for (let x = 0.3; x < sim.map.width; x += 0.25) {
        const c = { x: x + 0.013, y: y + 0.007 };
        let cov = 0;
        for (const s of samples) if ((s.x - c.x) ** 2 + (s.y - c.y) ** 2 <= R * R) cov++;
        if ((!best || cov > best.cov) && sim.canPlace(ID, c.x, c.y).ok) best = { ...c, cov };
      }
    }
    const t = sim.placeTower(ID, best.x, best.y);
    // crosspath first, then the measured path (the bench's order)
    const order = tiers[1] >= tiers[0] ? [0, 1] : [1, 0];
    for (const p of order) for (let k = 0; k < tiers[p]; k++) sim.upgradeTower(t.uid, p);
    const near = samples.reduce((b, s) => {
      const dd = (s.x - best.x) ** 2 + (s.y - best.y) ** 2;
      return dd < b.d ? { d: dd, s } : b;
    }, { d: 1e9 }).s;
    const hpOf = sim.data.enemy(tg.id)?.hp || 1;
    const spawn = (dist = 0, pathIndex = 0) => sim.spawnEnemy(tg.id, { pathIndex, dist, hpMul: tg.hp / hpOf });
    let d0 = 0;
    let hits = 0;
    const steps = Math.round((warm + run) * 60);
    for (let step = 0; step < steps; step++) {
      if (tg.every > 0 && step % tg.every === 0) spawn();
      if (!tg.every && !sim.enemies.some((e) => !e.dead && e.id === tg.id)) {
        // (parked: placed on the road beside her and never moving)
        const e = tg.park ? spawn(near.d, near.pathIndex) : spawn();
        if (tg.park) e.baseSpeed = 0;
      }
      if (sim.state !== 'wave') sim.state = 'wave';
      t.cooldown = 1e9; // Tsubaki's shells held: the tower's damage is Kohaku's beam alone
      sim.update(1 / 60);
      const ev = sim.drainEvents();
      if (step >= warm * 60) for (const e of ev) if (e.type === 'hit') hits++;
      for (const e of sim.enemies) if (!e.dead) e.hp = e.maxHp;
      if (step === warm * 60 - 1) d0 = t.damageDealt; // (warm 0: from the start)
    }
    return { build, target, tiers: tiers.join('-'), dps: Math.round(((t.damageDealt - d0) / run) * 100) / 100, hitsPerS: Math.round((hits / run) * 10) / 10 };
  });
}

export const BUILDS = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 's2'];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
  const builds = opt('builds', BUILDS.join(',')).split(',');
  const targets = opt('targets', Object.keys(TARGETS).join(',')).split(',');
  for (const build of builds) {
    for (const target of targets) {
      const r = duoBeamDps({ build, target, crit: Number(opt('crit', 0)) });
      console.log(args.includes('--json') ? JSON.stringify(r) : `${build} (${r.tiers}) ${target}: beam ${r.dps} dps, ${r.hitsPerS} hits/s`);
    }
  }
}
