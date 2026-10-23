// Girl bench: one girl (or N copies) on the best-covered spots of a stage, the real Sim, targets that
// never die (late-Freeplay HP: crowd 50k, boss 30M, healed every step; ×40 at max investment), damage per second after a
// warm-up — a crowd stream (Orc Grunts) and a walking boss (the Ashwing Matriarch). Every girl gets a partner (an un-upgraded Aoi; Kage for Aoi herself) standing in
// her reach, so auras, brews, links, marks and shred show up as the partner's DPS.
//
//   node --import ./tools/simLoader.mjs tools/bench.mjs [girls…] [--stage 4-5] [--seed 9]
//        [--builds p0t3,p0t4,…] [--targets crowd,boss] [--preset strong|L25] [--partner kage]
//        [--copies '[[0,5,2,2],[0,4,2,2]]'] [--compare tools/baselines/bench-today-s9.jsonl] [--json]
//        [--partner-build p0t5] [--strip-buffs] [--ramp 10] [--run 40] [--abilities] [--hp 5e4,3e7]
//
// Builds pNtM: path N to tier M with a tier-2 crosspath (P1 x-0-2, P2 2-x-0, P3 2-0-x); default: every
// path at tiers 3, 4 and 5. One JSON line per run (--json) or a table; with --compare, the change of
// every row against a baseline file of the same rows (today's numbers: tools/baselines/bench-today-s9.jsonl,
// live fddf01c; recorded before the fix below, so boss rows and crowd rows on long stages moved): own DPS
// on the crowd and the boss, the partner's DPS.
// --partner-build upgrades the partner like a build (Kage 5-0-2: p0t5); --strip-buffs removes the measured
// girls' auras, brews and links every step, so the partner's DPS without them is the baseline of a
// buff ratio (spec M4: partner DPS / partner DPS with --strip-buffs, same tree, same spots).
//
// How a run measures (helpers in tools/benchLib.mjs):
//   - The boss walks the path whose sample is nearest her spot, entering half a tile before the stretch of
//     that path inside her reach (path distance `d` of the samples); once it walks past the stretch it is
//     replaced at the entry, so boss DPS is her single-target DPS while a boss is in reach. `passSec`: how
//     long one walk through her reach lasts (range and slows count); `passDmg`: boss DPS × passSec.
//   - The crowd streams on the path she covers most, from its start. Warm-up scales with the stage: the time
//     an unslowed grunt needs from the path start to the end of her reach, plus --ramp seconds (default 10)
//     for focus, tempo and stacks; the boss warm-up is 15 s. `warm` reports it. (Her slows and holds don't
//     lengthen it: waiting for the stream to fill a held lane only grows the pile-up.)
//   - No ability casts or charges before measuring starts; --abilities turns every girl's auto-cast on when
//     it starts (off by default: the live game has no cast button yet).
//   - `panelDps`: the panel's DPS right after placement (unbuffed, as before); `panelLive`: the panel at the
//     start of measuring (auras, brews and links on); `peak1s`: the best single second of the window;
//     `kills`: targets she killed in the window anyway (one step's damage above their HP, or an execute; a
//     support's kills are not hers; raise --hp crowd,boss).
//
// MAX INVESTMENT (--max): every girl at level 85 (Akashic Tomes; the P6 cap), 10 gates, ★5, Potential P6
// and the standard best-in-slot gear (tools/benchLib.mjs BIS: three UR +12 pieces read through
// unitBattleStats, so BATTLE_CAPS and Every Line Counts apply; --rolls mid|max, --club <id>).
//   node --import ./tools/simLoader.mjs tools/bench.mjs --max [girls…] [--stage 4-5] [--tier blossom]
//        [--supports umeko:2-5-0,midori:5-0-2|full|none] [--waves 100,150,200] [--no-waves] [--rolls mid]
//        [--abilities on|off] [--out file.jsonl]
//   1. path search: the six path-cap-legal single-copy builds (tier 5 + a tier-2 crosspath), alone, on the
//      crowd and the boss; best = the highest geometric mean (support girls: the highest uplift);
//   2. the best build with the standard support pair (max investment too; a girl in the pair is dropped from it);
//   3. uplift: a max Kage 5-0-2 (Shiro 2-0-5 for Kage) next to her vs the same Kage with her sold before the run;
//   4. real Freeplay waves (--waves, solo, Normal, --tier) with infinite lives, alone and with the pair: her
//      damage per wave, the peak wave, total damage over those waves and the best single second. (The lives stay
//      infinite past the wave-200 Matriarch, who takes every life when she leaks: benchLib keepLives.)
//   Abilities default on in --max (off: --abilities off). One JSON line per girl, then a table.
//   (--preset max without --max runs the classic build grid with the max-investment stats.)
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { Sim } from '../src/sim/Sim.js';
import { defaultData } from '../src/sim/data.js';
import { samplePath } from '../src/sim/path.js';
import { withDetMath } from '../src/core/detMath.js';
import { soloFreeplayStage } from '../src/data/freeplaySolo.js';
import { bossEntry, streamPath, crowdWarmup, holdAbilities, releaseAbilities, keepLives, maxProfile, FINAL_BUILDS, parseBuild } from './benchLib.mjs';

const args = process.argv.slice(2);
const VALUED = ['--stage', '--seed', '--builds', '--targets', '--preset', '--partner', '--copies', '--compare', '--run', '--partner-build', '--ramp', '--hp',
  '--supports', '--waves', '--rolls', '--club', '--tier', '--out', '--support-girls'];
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const flag = (k) => args.includes(`--${k}`);
// (--abilities takes an optional on / off)
const names = args.filter((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]) && !(args[i - 1] === '--abilities' && (a === 'on' || a === 'off')));
const STAGE = opt('stage', '4-5');
const SEED = Number(opt('seed', 9));
const RUN = Number(opt('run', 40));
const RAMP = Number(opt('ramp', 10));
const MAX = flag('max');
const ABIL = (() => {
  const v = opt('abilities', null);
  if (v === 'on') return true;
  if (v === 'off') return false;
  return flag('abilities') || MAX;
})();
const d = defaultData();
const lv = (L, bt, st) => 1 + 0.018 * (L - 1) + 0.02 * bt + 0.05 * st;
const rt = (L) => 1 + 0.004 * (L - 1);
const PRESET = MAX ? 'max' : opt('preset', 'strong');
const early = (L) => {
  const bt = Math.max(0, Math.ceil((L - 10) / 10));
  return { damageMul: +lv(L, bt, 0).toFixed(4), rateMul: +rt(L).toFixed(4), rangeMul: 1, critChance: 0, critMul: 1, armorPen: 0, costMul: 1, ultHaste: 0, awakenPassive: false, level: L, awaken: 0 };
};
const STRONG = { damageMul: +(lv(60, 5, 3) * 1.45).toFixed(4), rateMul: +(rt(60) * 1.2).toFixed(4), rangeMul: 1, critChance: 0.25, critMul: 1.3, armorPen: 1, costMul: 1, ultHaste: 0, awakenPassive: true, level: 60, awaken: 3 };
const ROLLS = opt('rolls', 'mid');
const CLUB = opt('club', null);
const maxCache = new Map();
/** Battle stats of a girl under the run's preset (max: her own best-in-slot block). */
const statsOf = (unitId) => {
  if (PRESET === 'strong') return STRONG;
  if (PRESET !== 'max') return early(Number(PRESET.slice(1)));
  if (!maxCache.has(unitId)) maxCache.set(unitId, maxProfile(unitId, { rolls: ROLLS, club: CLUB }).stats);
  return maxCache.get(unitId);
};
const STREAM = { crowd: 'orc_grunt', boss: PRESET === 'strong' || PRESET === 'max' ? 'dragon_ashwing' : 'slime_courtier' };
// Target HP: late Freeplay for the strong preset; ×40 for max investment (a wave-230 grunt, the same 1 : 600
// crowd-to-boss ratio), because a maxed, buffed girl deals more than 50k to one grunt inside one step and the
// heal-every-step trick then fails (`kills` counts her kills in the window: it should stay 0). --hp crowd,boss.
const HP = (opt('hp', null) || (PRESET === 'max' ? '2e6,1.2e9' : PRESET === 'strong' ? '5e4,3e7' : '5e4,5e4')).split(',').map(Number);
const HP_CROWD = HP[0];
const HP_BOSS = HP[1] ?? HP[0];
/** The boss warm-up (it spawns inside her reach); the crowd's is the stream's travel time to her reach's end + RAMP. */
const BOSS_WARM = 15;

const r2 = (v) => Math.round(v * 100) / 100;
const lattice = (sim) => {
  const out = [];
  for (let y = 0.3; y < sim.map.height; y += 0.25) for (let x = 0.3; x < sim.map.width; x += 0.25) out.push({ x: x + 0.013, y: y + 0.007 });
  return out;
};

/** Upgrades a placed girl: crosspath first, then the main path (a refused final tier stays at tier 4). */
function upgrade(sim, uid, [mp, mt, cp, ct]) {
  for (let i = 0; i < ct; i++) sim.upgradeTower(uid, cp);
  for (let i = 0; i < mt; i++) sim.upgradeTower(uid, mp);
}

/**
 * Places the measured girl (copies), then the partner and the supports, on a fresh Sim. `stage`: a Freeplay
 * stage object for the wave runs (null: the campaign stage of the test-target runs).
 * @returns {{ sim, samples, placed, spot, pt, sup, error? }}
 */
function setup({ unitId, copies, stageId, partner = null, partnerStats = null, partnerBuild = null, supports = [], stage = null }) {
  const def = d.units[unitId];
  const loadout = [{ unitId, stats: statsOf(unitId) }];
  if (partner && partner !== unitId) loadout.push({ unitId: partner, stats: partnerStats || statsOf(partner) });
  for (const s of supports) if (!loadout.some((l) => l.unitId === s.unitId)) loadout.push({ unitId: s.unitId, stats: statsOf(s.unitId) });
  const sim = withDetMath(() => new Sim(stage
    ? { stageId, difficulty: 'normal', loadout, hero: null, seed: SEED, options: { freeplay: true, autoStart: false }, data: { stage } }
    : { stageId, loadout, hero: null, seed: SEED }));
  sim.cash = 1e15;
  sim.lives = 1e15;
  const samples = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((s) => !s.hidden);
  const lat = lattice(sim);
  const cov = (c, r) => samples.reduce((a, s) => a + ((s.x - c.x) ** 2 + (s.y - c.y) ** 2 <= r * r ? 1 : 0), 0);
  let out = null;
  withDetMath(() => {
    const r = Math.min(4, def.base.range || 3);
    const ranked = lat.map((c) => ({ ...c, cov: cov(c, r) })).sort((a, b) => b.cov - a.cov);
    const placed = [];
    for (const cp of copies) {
      const spot = ranked.find((c) => sim.canPlace(unitId, c.x, c.y).ok);
      if (!spot) {
        out = { error: 'no spot' };
        return;
      }
      const t = sim.placeTower(unitId, spot.x, spot.y);
      upgrade(sim, t.uid, cp);
      placed.push({ t, spot });
    }
    const spot = placed[0].spot;
    let pt = null;
    if (partner) {
      const ps = lat.filter((c) => (c.x - spot.x) ** 2 + (c.y - spot.y) ** 2 < 2.2 * 2.2).map((c) => ({ ...c, cov: cov(c, 3.2) }))
        .sort((a, b) => b.cov - a.cov).find((c) => sim.canPlace(partner, c.x, c.y).ok);
      pt = ps ? sim.placeTower(partner, ps.x, ps.y) : null;
      if (pt && partnerBuild) upgrade(sim, pt.uid, partnerBuild);
    }
    // supports stand on the free spot nearest her (ties: the better-covered), so her aura / brew / link reaches
    const sup = [];
    for (const s of supports) {
      const ss = lat.map((c) => ({ ...c, dd: (c.x - spot.x) ** 2 + (c.y - spot.y) ** 2, cov: 0 }))
        .filter((c) => c.dd > 0.01).sort((a, b) => a.dd - b.dd).find((c) => sim.canPlace(s.unitId, c.x, c.y).ok);
      if (!ss) continue;
      const st = sim.placeTower(s.unitId, ss.x, ss.y);
      upgrade(sim, st.uid, parseBuild(s.build));
      sup.push(st);
    }
    out = { sim, samples, placed, spot, pt, sup };
  });
  return out;
}

/**
 * One test-target run (crowd or boss). `soldBaseline`: sell the measured girl before the run (the partner's
 * baseline at the very same spots). Returns the row fields.
 */
function run(unitId, target, copies, stageId, o = {}) {
  const partner = o.partner === undefined ? (flag('no-partner') ? null : opt('partner', unitId === 'aoi' ? 'kage' : 'aoi')) : o.partner;
  const pb = /^p(\d)t(\d)$/.exec(opt('partner-build', '') || '');
  const partnerBuild = o.partnerBuild !== undefined ? o.partnerBuild : pb ? [+pb[1], +pb[2], [2, 0, 0][+pb[1]], 2] : null;
  const s = setup({ unitId, copies, stageId, partner, partnerStats: o.partnerStats, partnerBuild, supports: o.supports || [] });
  if (s.error) return s;
  const { sim, samples, placed, spot, pt } = s;
  let out = null;
  withDetMath(() => {
    const measured = placed.map((p) => p.t);
    const STRIP = flag('strip-buffs');
    const strip = () => {
      for (const t of measured) {
        if (!t.stats) continue;
        t.stats.brew = null;
        t.stats.link = null;
        t.stats.aura = null;
      }
    };
    if (STRIP) strip();
    sim.update(0.5);
    const panel = placed.map((p) => sim.towerStats(p.t.uid));
    // her reach after upgrades and gear (the panel's range), for where the boss and the crowd meet her
    const reach = Math.max(...panel.map((p) => p.range || 0), 0.5);
    const boss = bossEntry(samples, spot, reach);
    const stream = streamPath(samples, spot, reach);
    if (o.soldBaseline) for (const t of measured) sim.sellTower(t.uid);
    const live = o.soldBaseline ? [] : measured;
    // targets with a late-Freeplay HP (HP_CROWD / HP_BOSS), healed back every step: %-max-HP damage
    // (burn / poison pct, execution) meets realistic numbers and nothing dies (`kills` checks it)
    const hpOf = (id) => sim.data.enemy(id)?.hp || 1;
    const spawn = (id, pathIndex, dist) => sim.spawnEnemy(id, { pathIndex, dist, hpMul: (id === STREAM.boss ? HP_BOSS : HP_CROWD) / hpOf(id) });
    const dealt = () => live.reduce((a, t) => a + t.damageDealt, 0);
    const pinned = new Map();
    let warmEnd = target === 'boss' ? BOSS_WARM : null;
    let start = null;
    let dmg0 = 0;
    let pd0 = 0;
    let panelLive = null;
    let bossNow = null;
    let passFrom = null;
    const passes = [];
    const secs = [];
    let secMark = 0;
    let secDmg = 0;
    let kills = 0;
    for (let step = 0; ; step++) {
      const t = step / 60;
      if (start != null && t >= start + RUN) break;
      if (target === 'crowd' && step % 6 === 0) {
        const e = spawn(STREAM.crowd, stream.pathIndex, 0);
        if (warmEnd == null && e) warmEnd = crowdWarmup(stream.last, e.speed, RAMP);
      }
      if (target === 'boss') {
        if (bossNow && !bossNow.dead && bossNow.dist > boss.exit + 0.5) {
          passes.push(t - passFrom);
          sim._leak(bossNow);
        }
        if (!bossNow || bossNow.dead) {
          bossNow = spawn(STREAM.boss, boss.pathIndex, boss.dist);
          passFrom = t;
        }
      }
      if (sim.state !== 'wave') sim.state = 'wave';
      if (STRIP) strip();
      if (start == null) holdAbilities(sim, pinned);
      sim.update(1 / 60);
      sim.drainEvents();
      for (const e of sim.enemies) if (!e.dead) e.hp = e.maxHp;
      if (start == null && warmEnd != null && t + 1e-9 >= warmEnd) {
        start = t;
        dmg0 = dealt();
        pd0 = pt ? pt.damageDealt : 0;
        secMark = dmg0;
        kills = -live.reduce((a, x) => a + (x.kills || 0), 0);
        panelLive =live.length ? live.reduce((a, x) => a + (sim.towerStats(x.uid)?.dps || 0), 0) : 0;
        releaseAbilities(sim, ABIL);
      }
      if (start != null && (step + 1) % 60 === 0) {
        const now = dealt();
        secDmg = now - secMark;
        secMark = now;
        secs.push(secDmg);
      }
    }
    out = {
      panelDps: r2(panel.reduce((a, p) => a + p.dps, 0)),
      panelLive: r2(panelLive),
      realDps: r2((dealt() - dmg0) / RUN),
      peak1s: r2(secs.length ? Math.max(...secs) : 0),
      partnerDps: pt ? r2((pt.damageDealt - pd0) / RUN) : null,
      // one walk through her reach: its mean length (warm-up walks count) × her DPS while a boss is in reach
      passSec: target === 'boss' && passes.length ? r2(passes.reduce((a, b) => a + b, 0) / passes.length) : null,
      passDmg: target === 'boss' && passes.length ? Math.round(((dealt() - dmg0) / RUN) * (passes.reduce((a, b) => a + b, 0) / passes.length)) : null,
      cost: placed.reduce((a, p) => a + p.t.spent, 0),
      tiers: placed.map((p) => p.t.tiers.join('-')).join(' '),
      warm: r2(start),
      path: target === 'boss' ? boss.pathIndex : stream.pathIndex,
      reach: r2(reach),
      kills: kills + live.reduce((a, x) => a + (x.kills || 0), 0),
    };
  });
  return out;
}

/**
 * Real Freeplay waves with infinite lives (max mode): the board is built once, then each listed wave is played
 * from a jump (the waves are a pure function of their number). Her damage per wave, the best single second.
 */
function runWaves(unitId, copies, stageId, waves, supports = []) {
  const tier = opt('tier', 'blossom');
  const stage = soloFreeplayStage(stageId, tier);
  if (!stage?.freeplay) return { error: `no freeplay on ${stageId}/${tier}` };
  const s = setup({ unitId, copies, stageId, supports, stage });
  if (s.error) return s;
  const { sim, placed } = s;
  const measured = placed.map((p) => p.t);
  const dealt = () => measured.reduce((a, t) => a + t.damageDealt, 0);
  const rows = [];
  // (the wave-200 Matriarch took every life: the run ended as she walked off and every later wave stopped at its first leak)
  const topUp = keepLives(sim);
  withDetMath(() => {
    if (ABIL) releaseAbilities(sim, true);
    for (const w of waves) {
      sim.wave = w - 1;
      sim.wavesCleared = w - 1;
      topUp();
      sim.state = 'between';
      sim.startNextWave();
      const d0 = dealt();
      const t0 = sim.time;
      const l0 = sim.stats.enemiesLeaked;
      let mark = d0;
      let peak = 0;
      let steps = 0;
      while (sim.state === 'wave' && steps < 600 * 4) {
        sim.update(0.25);
        sim.drainEvents();
        steps++;
        if (steps % 4 === 0) {
          const now = dealt();
          peak = Math.max(peak, now - mark);
          mark = now;
        }
      }
      rows.push({ wave: w, dmg: Math.round(dealt() - d0), sec: r2(sim.time - t0), peak1s: Math.round(peak), leaked: sim.stats.enemiesLeaked - l0 });
    }
  });
  const best = rows.reduce((b, r) => (r.dmg > (b?.dmg ?? -1) ? r : b), null);
  return { waves: rows, peakWave: best?.wave ?? null, peakWaveDmg: best?.dmg ?? 0, totalDmg: rows.reduce((a, r) => a + r.dmg, 0), peak1s: Math.max(0, ...rows.map((r) => r.peak1s)) };
}

const girls = names.length ? names : Object.values(d.units).filter((u) => u.kind === 'tower').map((u) => u.id);

if (!MAX) {
  const CROSS = [2, 0, 0];
  const defaultBuilds = [];
  for (let p = 0; p < 3; p++) for (const t of [3, 4, 5]) defaultBuilds.push(`p${p}t${t}`);
  const BUILDS = opt('builds', defaultBuilds.join(',')).split(',');
  const copiesArg = opt('copies', null);
  const rows = [];
  for (const id of girls) {
    for (const b of BUILDS) {
      let copies;
      if (copiesArg) copies = JSON.parse(copiesArg);
      else {
        const m = /^p(\d)t(\d)$/.exec(b);
        copies = [[+m[1], +m[2], CROSS[+m[1]], 2]];
      }
      for (const target of opt('targets', 'crowd,boss').split(',')) {
        const t0 = Date.now();
        let r = run(id, target, copies, STAGE);
        if (r?.error) r = run(id, target, copies, '1-5');
        const row = { unitId: id, build: copiesArg ? 'copies' : b, target, ...r, preset: PRESET, seed: SEED, stage: STAGE, ms: Date.now() - t0 };
        rows.push(row);
        if (flag('json')) console.log(JSON.stringify(row));
      }
      if (copiesArg) break;
    }
  }

  const base = opt('compare', null);
  if (base && existsSync(base)) {
    const old = new Map(readFileSync(base, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((r) => [`${r.unitId}|${r.build}|${r.target}`, r]));
    const pc = (a, b) => (b > 0 && Number.isFinite(a) ? `${a >= b ? '+' : ''}${Math.round((a / b - 1) * 100)}%` : '–');
    console.log('| Girl | Build | crowd own (today → now) | boss own | partner (crowd) |');
    console.log('|---|---|---|---|---|');
    const by = new Map();
    for (const r of rows) {
      const k = `${r.unitId}|${r.build}`;
      if (!by.has(k)) by.set(k, {});
      by.get(k)[r.target] = r;
    }
    for (const [k, v] of by) {
      const [u, b] = k.split('|');
      const oc = old.get(`${u}|${b}|crowd`);
      const ob = old.get(`${u}|${b}|boss`);
      const c = v.crowd;
      const bo = v.boss;
      console.log(`| ${u} | ${b} | ${c ? `${oc?.realDps ?? '–'} → ${c.realDps} (${pc(c.realDps, oc?.realDps)})` : '–'} | ${bo ? `${ob?.realDps ?? '–'} → ${bo.realDps} (${pc(bo.realDps, ob?.realDps)})` : '–'} | ${c ? pc(c.partnerDps, oc?.partnerDps) : '–'} |`);
    }
  } else if (!flag('json')) {
    for (const r of rows) console.log(`${r.unitId} ${r.build} ${r.target}: own ${r.realDps} partner ${r.partnerDps ?? '-'} (panel ${r.panelDps}, ${r.tiers}, ${r.cost} coins, warm ${r.warm}s)`);
  }
} else {
  // ---- max investment ----
  const PAIRS = {
    standard: 'umeko:2-5-0,midori:5-0-2',
    full: 'umeko:2-5-0,midori:5-0-2,chika:2-5-0,wakaba:5-0-2',
    none: '',
  };
  const supArg = opt('supports', 'standard');
  const SUPPORTS = (PAIRS[supArg] ?? supArg).split(',').filter(Boolean).map((x) => {
    const [unitId, build] = x.split(':');
    return { unitId, build: build || '5-0-2' };
  });
  /** Girls judged by the damage they add to a carry, not their own (their build is the best uplift). */
  const SUPPORT_GIRLS = new Set(opt('support-girls', 'umeko,miko,noa,midori,chika,wakaba,ouka,yuki').split(','));
  const WAVES = flag('no-waves') ? [] : opt('waves', '100,150,200').split(',').map(Number).filter((w) => w > 0);
  const outFile = opt('out', null);
  const geo = (c, b) => Math.sqrt(Math.max(c, 0) * Math.max(b, 1));
  const results = [];
  for (const id of girls) {
    const t0 = Date.now();
    const carry = id === 'kage' ? { unitId: 'shiro', build: '2-0-5' } : { unitId: 'kage', build: '5-0-2' };
    const carryStats = statsOf(carry.unitId);
    const carryBuild = parseBuild(carry.build);
    const builds = [];
    for (const b of FINAL_BUILDS) {
      const copies = [[b.main, 5, b.cross, 2]];
      const row = { build: b.name };
      for (const target of ['crowd', 'boss']) {
        const r = run(id, target, copies, STAGE, { partner: null });
        row[target] = r.error ? null : r;
      }
      if (row.crowd && SUPPORT_GIRLS.has(id)) {
        for (const target of ['crowd', 'boss']) {
          const w = run(id, target, copies, STAGE, { partner: carry.unitId, partnerStats: carryStats, partnerBuild: carryBuild });
          const b0 = run(id, target, copies, STAGE, { partner: carry.unitId, partnerStats: carryStats, partnerBuild: carryBuild, soldBaseline: true });
          row[`uplift_${target}`] = b0.partnerDps > 0 ? Math.round((w.partnerDps / b0.partnerDps) * 1000) / 1000 : null;
        }
      }
      builds.push(row);
    }
    const ok = builds.filter((b) => b.crowd && b.boss && b.crowd.tiers.split('-').includes('5'));
    const score = (b) => (SUPPORT_GIRLS.has(id) ? Math.sqrt((b.uplift_crowd || 0) * (b.uplift_boss || 0)) : geo(b.crowd.realDps, b.boss.realDps));
    const best = ok.sort((a, b) => score(b) - score(a))[0] || builds[0];
    const copies = [parseBuild(best.build)];
    const sup = SUPPORTS.filter((s) => s.unitId !== id);
    const withPair = {};
    for (const target of ['crowd', 'boss']) withPair[target] = run(id, target, copies, STAGE, { partner: null, supports: sup });
    const uplift = {};
    if (best.uplift_crowd != null) {
      uplift.crowd = best.uplift_crowd;
      uplift.boss = best.uplift_boss;
    } else {
      for (const target of ['crowd', 'boss']) {
        const w = run(id, target, copies, STAGE, { partner: carry.unitId, partnerStats: carryStats, partnerBuild: carryBuild });
        const b0 = run(id, target, copies, STAGE, { partner: carry.unitId, partnerStats: carryStats, partnerBuild: carryBuild, soldBaseline: true });
        uplift[target] = b0.partnerDps > 0 ? Math.round((w.partnerDps / b0.partnerDps) * 1000) / 1000 : null;
      }
    }
    const wavesAlone = WAVES.length ? runWaves(id, copies, STAGE, WAVES) : null;
    const wavesPair = WAVES.length && sup.length ? runWaves(id, copies, STAGE, WAVES, sup) : null;
    const st = statsOf(id);
    const row = {
      unitId: id, rarity: d.units[id].rarity, role: d.units[id].role, support: SUPPORT_GIRLS.has(id),
      best: best.build, stage: STAGE, seed: SEED, rolls: ROLLS, abilities: ABIL,
      stats: { damageMul: st.damageMul, rateMul: st.rateMul, rangeMul: st.rangeMul, critChance: st.critChance, critMul: st.critMul, pierceK: st.pierceK, auraPct: st.auraPct, club: st.club },
      alone: { crowd: best.crowd?.realDps ?? null, boss: best.boss?.realDps ?? null, panel: best.crowd?.panelLive ?? null, peak1s: best.crowd?.peak1s ?? null, passDmg: best.boss?.passDmg ?? null, warm: best.crowd?.warm ?? null, kills: (best.crowd?.kills ?? 0) + (best.boss?.kills ?? 0) },
      pair: { with: sup.map((s) => `${s.unitId} ${s.build}`), crowd: withPair.crowd?.realDps ?? null, boss: withPair.boss?.realDps ?? null, panel: withPair.crowd?.panelLive ?? null, peak1s: withPair.crowd?.peak1s ?? null, passDmg: withPair.boss?.passDmg ?? null, warm: withPair.crowd?.warm ?? null, kills: (withPair.crowd?.kills ?? 0) + (withPair.boss?.kills ?? 0) },
      uplift: { carry: `${carry.unitId} ${carry.build}`, ...uplift },
      waves: wavesAlone, wavesPair,
      builds: builds.map((b) => ({ build: b.build, tiers: b.crowd?.tiers ?? null, crowd: b.crowd?.realDps ?? null, boss: b.boss?.realDps ?? null, ...(b.uplift_crowd != null ? { uplift_crowd: b.uplift_crowd, uplift_boss: b.uplift_boss } : {}) })),
      ms: Date.now() - t0,
    };
    results.push(row);
    console.log(JSON.stringify(row));
    if (outFile) appendFileSync(outFile, `${JSON.stringify(row)}\n`);
  }
  if (!flag('json')) {
    const k = (v) => (v == null ? '–' : v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : String(Math.round(v)));
    console.log('\n| Girl | R | Best | crowd | boss | panel | +pair crowd | +pair boss | +pair panel | uplift c/b | peak wave dmg (alone / pair) | total (alone) |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const r of results) {
      console.log(`| ${r.unitId} | ${r.rarity} | ${r.best} | ${k(r.alone.crowd)} | ${k(r.alone.boss)} | ${k(r.alone.panel)} | ${k(r.pair.crowd)} | ${k(r.pair.boss)} | ${k(r.pair.panel)} | ${r.uplift.crowd ?? '–'} / ${r.uplift.boss ?? '–'} | ${r.waves ? `${k(r.waves.peakWaveDmg)} (w${r.waves.peakWave})` : '–'} / ${r.wavesPair ? k(r.wavesPair.peakWaveDmg) : '–'} | ${r.waves ? k(r.waves.totalDmg) : '–'} |`);
    }
  }
}
