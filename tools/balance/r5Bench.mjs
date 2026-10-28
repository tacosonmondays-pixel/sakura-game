// Balance round 5 bench (docs/BALANCE.md "Balance round 5"): every girl FULLY MAXED, her honest DPS (what the battle
// drawer's live meter shows: damage the sim credits her a second, src/ui/battle/dpsView.js) on her ruler.
//
//   node --import ./tools/simLoader.mjs tools/balance/r5Bench.mjs [girls…] [--support um|none] [--targets boss,crowd]
//        [--builds best|all|p0t5,…] [--stage 4-5] [--seed 9] [--warm 15] [--run 40] [--no-resonance] [--json]
//
// Fully maxed (the profile a player reaches): L85, ★5, 10 gates, P6, three UR +12 Taiko pieces at average rolls
// (crit damage / crit chance / attack speed mains, ATK and crit subs), through the game's own unitBattleStats, with
// UR Resonance on (the clock is set past its Nov 2 week; ★5 SSRs ×1.10 damage, ×1.04 speed) and the duo at LR.
// Builds pNtM: path N to tier M with a tier-2 crosspath (P1 x-0-2, P2 2-x-0, P3 2-0-x); `best` = all three at tier 5,
// the best one reported. Supports `um` (default): Umeko 2-5-0 and Midori 5-0-2, both fully maxed, placed in her reach
// (the round-3 fixed bench); `none`: she stands alone (a partner-less run).
// Targets never die (healed every step), so her number is her rate, not the HP left to take: `boss` = the Ashwing
// Matriarch (3e7 HP) held at her nearest road point; `bossw` = the same boss walking through from 1.5 tiles before it
// (a trap or strip girl's boss); `crowd` = a late stream, an Orc Grunt every 0.5 s at 2e6 HP.
import { Sim } from '../../src/sim/Sim.js';
import { defaultData } from '../../src/sim/data.js';
import { samplePath } from '../../src/sim/path.js';
import { withDetMath } from '../../src/core/detMath.js';
import { placeOnPath } from '../../src/sim/enemies.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { mainStatRange, substatRange, subGrowth } from '../../src/systems/gear.js';

const argv = process.argv.slice(2);
const VALUED = ['--crowd-every', '--boss-hp', '--crowd-hp', '--support', '--targets', '--builds', '--stage', '--seed', '--warm', '--run'];
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const names = argv.filter((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1]));

// UR Resonance switches on at the Nov 2 game week (src/systems/limitBreak.js resonanceOn): measure with it on
if (!argv.includes('--no-resonance')) {
  const fixed = Date.UTC(2026, 10, 4, 12);
  Date.now = () => fixed;
}

const avg = ([a, b]) => (a + b) / 2;
function piece(uid, slot, mainStat, subs) {
  const mb = +avg(mainStatRange(mainStat, 'legendary')).toFixed(4);
  const growth = mainStat === 'armorPen' ? 0.04 : 0.06;
  const main = { stat: mainStat, base: mb, value: +(mb * (1 + growth * 12)).toFixed(4) };
  const sl = subs.map(([stat, ups]) => {
    const base = +avg(substatRange(stat, 'legendary')).toFixed(4);
    return { stat, base, upgrades: ups, tuned: 0, value: +(base + ups * subGrowth(stat, 'legendary')).toFixed(4) };
  });
  return { uid, slot, rarity: 'legendary', level: 12, main, subs: sl, ur: 1, club: 'taiko', locked: false, equippedBy: null, name: uid };
}
/** The fully maxed profile (the round-3/4 bench's, unchanged), plus the duo's Limit Break. */
export function maxedProfile(id) {
  const c = piece(`${id}_c`, 'charm', 'critDmg', [['atkPct', 2], ['critChance', 2], ['ratePct', 0], ['armorPen', 0]]);
  const r = piece(`${id}_r`, 'ribbon', 'critChance', [['atkPct', 2], ['critDmg', 2], ['ratePct', 0], ['armorPen', 0]]);
  const s = piece(`${id}_s`, 'shoes', 'ratePct', [['atkPct', 2], ['critChance', 1], ['critDmg', 1], ['armorPen', 0]]);
  for (const g of [c, r, s]) g.equippedBy = id;
  return {
    units: { [id]: { level: 85, awaken: 5, breakthrough: 10, pl: 6, gear: { charm: c.uid, ribbon: r.uid, shoes: s.uid } } },
    gear: { [c.uid]: c, [r.uid]: r, [s.uid]: s },
    missions: { counters: { [`lr:${id}`]: 1, [`lbt:${id}`]: 1 } },
  };
}
export const maxedStats = (id) => unitBattleStats(maxedProfile(id), id);

const CROSS = [2, 0, 0];
const BOSS_HP = Number(opt('boss-hp', 3e7));
const CROWD_HP = Number(opt('crowd-hp', 2e6));
const CROWD_EVERY = Math.round(60 * Number(opt('crowd-every', 0.5)));
const parseBuild = (b) => {
  const m = /^p(\d)t(\d)$/.exec(b);
  return [+m[1], +m[2]];
};

/**
 * One run: her (fully maxed) on the best-covered spot, the supports beside her, a never-dying target.
 * @returns {{ dps, tiers, support: object }|{ error }}
 */
export function measure({ d, unitId, build, target, support = 'um', stageId = '4-5', seed = 9, warm = 15, run = 40 }) {
  const def = d.units[unitId];
  const sup = support === 'um' ? [['umeko', [1, 5, 0, 2]], ['midori', [0, 5, 2, 2]]].filter(([id]) => id !== unitId) : [];
  const loadout = [{ unitId, stats: maxedStats(unitId) }, ...sup.map(([id]) => ({ unitId: id, stats: maxedStats(id) }))];
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
    const [mp, mt] = build;
    for (let i = 0; i < 2; i++) sim.upgradeTower(t.uid, CROSS[mp]);
    for (let i = 0; i < mt; i++) sim.upgradeTower(t.uid, mp);
    // supports: inside 1.6 tiles of her (every aura reaches), on the most road they can
    for (const [sid, [p1, t1, p2, t2]] of sup) {
      const ps = lattice.filter((c) => (c.x - spot.x) ** 2 + (c.y - spot.y) ** 2 < 1.6 * 1.6).map((c) => ({ ...c, cov: cov(c, 3) }))
        .sort((a, b) => b.cov - a.cov).find((c) => sim.canPlace(sid, c.x, c.y).ok);
      if (!ps) continue;
      const st = sim.placeTower(sid, ps.x, ps.y);
      for (let i = 0; i < t2; i++) sim.upgradeTower(st.uid, p2);
      for (let i = 0; i < t1; i++) sim.upgradeTower(st.uid, p1);
    }
    sim.update(0.5);
    const hpOf = (id) => sim.data.enemy(id)?.hp || 1;
    const near = path0.reduce((b, s) => {
      const dd = (s.x - spot.x) ** 2 + (s.y - spot.y) ** 2;
      return dd < b.dd ? { dd, s } : b;
    }, { dd: 1e9 }).s;
    const dealt = () => t.damageDealt || 0;
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
    out = { dps: Math.round((dealt() - d0) / run), tiers: t.tiers.join('-'), supports: sim.towers.length - 1 };
  });
  return out;
}

const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));

if (import.meta.url === `file://${process.argv[1]}`) {
  const d = defaultData();
  const targets = opt('targets', 'boss,bossw,crowd').split(',');
  const buildsOpt = opt('builds', 'best');
  const support = opt('support', 'um');
  const common = { d, support, stageId: opt('stage', '4-5'), seed: Number(opt('seed', 9)), warm: Number(opt('warm', 15)), run: Number(opt('run', 40)) };
  const girls = names.length ? names : Object.keys(d.units).filter((id) => d.units[id].kind !== 'hero');
  for (const unitId of girls) {
    for (const target of targets) {
      const builds = buildsOpt === 'best' || buildsOpt === 'all' ? ['p0t5', 'p1t5', 'p2t5'] : buildsOpt.split(',');
      const rows = builds.map((b) => ({ b, ...measure({ ...common, unitId, build: parseBuild(b), target }) }));
      const ok = rows.filter((r) => !r.error);
      const best = ok.reduce((a, r) => (!a || r.dps > a.dps ? r : a), null);
      const row = { unitId, target, support, best: best?.b ?? null, dps: best?.dps ?? 0, tiers: best?.tiers, all: Object.fromEntries(rows.map((r) => [r.b, r.error ?? r.dps])) };
      console.log(argv.includes('--json') ? JSON.stringify(row) : `${unitId} ${target} [${support}]: ${fmt(row.dps)} (${row.best} ${row.tiers ?? ''}) ${JSON.stringify(row.all)}`);
    }
  }
}
