// Balance round 5 bench (docs/BALANCE.md "Balance round 5"): every girl FULLY MAXED, her honest DPS (what the battle
// drawer's live meter shows: damage the sim credits her a second, src/ui/battle/dpsView.js) on her ruler.
//
//   node --import ./tools/simLoader.mjs tools/balance/r5Bench.mjs [girls…] [--support um|none] [--targets boss,crowd]
//        [--builds best|all|p0t5,…] [--stage 4-5] [--seed 9] [--seeds 9,1,2] [--warm 15] [--run 40] [--no-resonance] [--no-lr] [--ally] [--json]
//
// --no-lr: an LR unit (the duo, Tenka) at UR, without her Limit Break (no LR form, no LR boost).
//
// Fully maxed (the profile a player reaches): L85, ★5, 10 gates, P6, three UR +12 Taiko pieces at average rolls
// (crit damage / crit chance / attack speed mains, ATK and crit subs), through the game's own unitBattleStats, with
// UR Resonance on (the clock is set past its Nov 2 week; ★5 SSRs ×1.10 damage, ×1.04 speed) and the duo at LR.
// Builds pNtM: path N to tier M with a tier-2 crosspath (P1 x-0-2, P2 2-x-0, P3 2-0-x); `best` = all three at tier 5,
// the best one reported. Supports `um` (default): Umeko 2-5-0 and Midori 5-0-2, both fully maxed, placed in her reach
// (the round-3 fixed bench); `none`: she stands alone (a partner-less run); `girl:pNtM`: one support at that build
// (a support's boost: the striker's DPS beside her ÷ alone); `girl:pNtM+girl:pNtM…`: those supports together.
// A build `pNtMcK` puts her tier-2 crosspath on path K instead (measure's `build` [N, M, K]).
// Targets never die (healed every step), so her number is her rate, not the HP left to take: `boss` = the Ashwing
// Matriarch (3e7 HP) held at her nearest road point; `bossw` = the same boss walking through from 1.5 tiles before it
// (a trap or strip girl's boss); `crowd` = a late stream, an Orc Grunt every 0.5 s at 2e6 HP. A hero (no paths) is
// placed as the battle's hero and maxed at Lv 25 with Mastery full; her `build` is ignored.
import { Sim } from '../../src/sim/Sim.js';
import { defaultData } from '../../src/sim/data.js';
import { samplePath } from '../../src/sim/path.js';
import { withDetMath } from '../../src/core/detMath.js';
import { placeOnPath } from '../../src/sim/enemies.js';
import { gainHeroXp, heroXpCap } from '../../src/sim/hero.js';
import { maxedProfile, maxedStats, RESONANCE_ON } from './maxedProfile.mjs';

const argv = process.argv.slice(2);
const VALUED = ['--seeds', '--crowd-every', '--boss-hp', '--crowd-hp', '--support', '--targets', '--builds', '--stage', '--seed', '--warm', '--run'];
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const names = argv.filter((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1]));

// UR Resonance switches on at the Nov 2 game week (src/systems/limitBreak.js resonanceOn): measure with it on
if (!argv.includes('--no-resonance')) {
  Date.now = () => RESONANCE_ON;
}

export { maxedProfile, maxedStats };

const CROSS = [2, 0, 0];
const BOSS_HP = Number(opt('boss-hp', 3e7));
const CROWD_HP = Number(opt('crowd-hp', 2e6));
const CROWD_EVERY = Math.round(60 * Number(opt('crowd-every', 0.5)));
const parseBuild = (b) => {
  const m = /^p(\d)t(\d)(?:c(\d))?$/.exec(b);
  return m[3] != null ? [+m[1], +m[2], +m[3]] : [+m[1], +m[2]];
};

/**
 * One run: her (fully maxed) on the best-covered spot, the supports beside her, a never-dying target.
 * @returns {{ dps, tiers, support: object }|{ error }}
 */
export function measure({ d, unitId, build, target, support = 'um', stageId = '4-5', seed = 9, warm = 15, run = 40, lr = true, ally = false, profile = 'maxed', setup = null }) {
  const def = d.units[unitId];
  // `support`: 'um' (Umeko 2-5-0 + Midori 5-0-2), 'none', or 'girl:pNtM' joined by '+' (those supports at those builds)
  const many = support === 'um' || support === 'none' ? [] : support.split('+').map((s) => /^([a-z_]+):p(\d)t(\d)$/.exec(s));
  if (many.some((m) => !m)) return { error: `support ${support}` };
  const sup = support === 'um' ? [['umeko', [1, 5, 0, 2]], ['midori', [0, 5, 2, 2]]].filter(([id]) => id !== unitId)
    : many.map((m) => [m[1], [+m[2], +m[3], CROSS[+m[2]], 2]]).filter(([id]) => id !== unitId);
  const loadout = [{ unitId, stats: maxedStats(unitId, null, { lr, profile }) }, ...sup.map(([id]) => ({ unitId: id, stats: maxedStats(id) }))];
  const sim = withDetMath(() => new Sim({ stageId, loadout, hero: null, seed }));
  sim.cash = 1e15;
  sim.lives = 1e15;
  const samples = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((s) => !s.hidden);
  const path0 = samplePath(sim.pathData[0], 0.5).filter((s) => !s.hidden);
  const hold = target === 'boss';
  if (target === 'bossw') target = 'boss';
  let out = null;
  withDetMath(() => {
    const lattice = [];
    for (let y = 0.3; y < sim.map.height; y += 0.25) for (let x = 0.3; x < sim.map.width; x += 0.25) lattice.push({ x: x + 0.013, y: y + 0.007 });
    const cov = (c, r) => path0.reduce((a, s) => a + ((s.x - c.x) ** 2 + (s.y - c.y) ** 2 <= r * r ? 1 : 0), 0);
    const r = Math.min(4, def.base.range || 3);
    const spot = lattice.map((c) => ({ ...c, cov: cov(c, r) })).sort((a, b) => b.cov - a.cov).find((c) => sim.canPlace(unitId, c.x, c.y).ok);
    if (!spot) {
      out = { error: 'no spot' };
      return;
    }
    const t = sim.placeTower(unitId, spot.x, spot.y);
    const [mp, mt, mc = CROSS[mp]] = build;
    if (def.kind === 'hero') {
      // a hero has no paths: she is maxed at Lv 25 with Mastery full (her whole XP cap; `build` is ignored)
      gainHeroXp(sim, t, heroXpCap(def.hero) + 1, 'bought');
    } else {
      for (let i = 0; i < 2; i++) sim.upgradeTower(t.uid, mc);
      for (let i = 0; i < mt; i++) sim.upgradeTower(t.uid, mp);
    }
    // supports: inside 1.6 tiles of her (every aura reaches), on the most road they can
    for (const [sid, [p1, t1, p2, t2]] of sup) {
      const ps = lattice.filter((c) => (c.x - spot.x) ** 2 + (c.y - spot.y) ** 2 < 1.6 * 1.6).map((c) => ({ ...c, cov: cov(c, 3) }))
        .sort((a, b) => b.cov - a.cov).find((c) => sim.canPlace(sid, c.x, c.y).ok);
      if (!ps) continue;
      const st = sim.placeTower(sid, ps.x, ps.y);
      for (let i = 0; i < t2; i++) sim.upgradeTower(st.uid, p2);
      for (let i = 0; i < t1; i++) sim.upgradeTower(st.uid, p1);
    }
    // a caller's own set-up before the run (tools/balance/irohaLayouts.mjs: her mirrors placed by hand)
    if (setup) setup(sim, t, { spot, path0 });
    sim.update(0.5);
    const hpOf = (id) => sim.data.enemy(id)?.hp || 1;
    const near = path0.reduce((b, s) => {
      const dd = (s.x - spot.x) ** 2 + (s.y - spot.y) ** 2;
      return dd < b.dd ? { dd, s } : b;
    }, { dd: 1e9 }).s;
    // --ally: the damage of everyone beside her (her boost to an ally, e.g. a girl whose shots split at her mirror)
    const dealt = ally ? () => sim.towers.reduce((a, o) => a + (o === t ? 0 : o.damageDealt || 0), 0) : () => t.damageDealt || 0;
    let d0 = 0;
    for (let step = 0; step < (warm + run) * 60; step++) {
      if (target === 'crowd' && step % CROWD_EVERY === 0) sim.spawnEnemy('orc_grunt', { pathIndex: 0, dist: 0, hpMul: CROWD_HP / hpOf('orc_grunt') });
      if (target === 'boss' && !sim.enemies.some((e) => !e.dead && e.id === 'dragon_ashwing')) {
        const e = sim.spawnEnemy('dragon_ashwing', { pathIndex: 0, dist: 0, hpMul: BOSS_HP / hpOf('dragon_ashwing') });
        // (path samples carry `d`: the boss walks in from 1.5 tiles before her nearest road point)
        if (e) e.dist = Math.max(0, (near.d ?? 0) - 1.5);
      }
      if (sim.state !== 'wave') sim.state = 'wave';
      sim.update(1 / 60);
      sim.drainEvents();
      for (const e of sim.enemies) {
        if (e.dead) continue;
        e.hp = e.maxHp;
        // the boss is held at her nearest road point (a boss she is fighting: her sustained single-target DPS)
        if (e.id === 'dragon_ashwing' && hold) {
          e.dist = near.d ?? 0;
          placeOnPath(e, sim.pathData[0]);
        }
      }
      if (step === warm * 60) d0 = dealt();
    }
    out = { dps: Math.round((dealt() - d0) / run), tiers: t.tiers.join('-'), supports: sim.towers.length - 1, ...(t.isHero ? { level: t.level } : {}) };
  });
  return out;
}

const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));

if (import.meta.url === `file://${process.argv[1]}`) {
  const d = defaultData();
  const targets = opt('targets', 'boss,bossw,crowd').split(',');
  const buildsOpt = opt('builds', 'best');
  const support = opt('support', 'um');
  const common = { d, support, lr: !argv.includes('--no-lr'), ally: argv.includes('--ally'), stageId: opt('stage', '4-5'), seed: Number(opt('seed', 9)), warm: Number(opt('warm', 15)), run: Number(opt('run', 40)) };
  const girls = names.length ? names : Object.keys(d.units).filter((id) => d.units[id].kind !== 'hero');
  for (const unitId of girls) {
    for (const target of targets) {
      const builds = buildsOpt === 'best' || buildsOpt === 'all' ? ['p0t5', 'p1t5', 'p2t5'] : buildsOpt.split(',');
      // --seeds 9,1,2: each build's mean over the seeds (a kit's rolls and the stream's timing move a run by a few %)
      const seeds = opt('seeds', String(common.seed)).split(',').map(Number);
      const rows = builds.map((b) => {
        const rs = seeds.map((seed) => measure({ ...common, seed, unitId, build: parseBuild(b), target }));
        const bad = rs.find((r) => r.error);
        return bad ? { b, ...bad } : { b, ...rs[0], dps: Math.round(rs.reduce((a, r) => a + r.dps, 0) / rs.length) };
      });
      const ok = rows.filter((r) => !r.error);
      const best = ok.reduce((a, r) => (!a || r.dps > a.dps ? r : a), null);
      const row = { unitId, target, support, best: best?.b ?? null, dps: best?.dps ?? 0, tiers: best?.tiers, all: Object.fromEntries(rows.map((r) => [r.b, r.error ?? r.dps])) };
      console.log(argv.includes('--json') ? JSON.stringify(row) : `${unitId} ${target} [${support}]: ${fmt(row.dps)} (${row.best} ${row.tiers ?? ''}) ${JSON.stringify(row.all)}`);
    }
  }
}
