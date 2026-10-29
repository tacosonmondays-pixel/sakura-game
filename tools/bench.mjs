// Girl bench: one girl (or N copies) on the best-covered spots of a stage, the real Sim, targets that
// never die (late-Freeplay HP: crowd 50k, boss 30M, healed every step), damage per second after a
// warm-up — a crowd stream (Orc Grunts) and a walking boss (the Ashwing Matriarch). Every girl gets a partner (an un-upgraded Aoi; Kage for Aoi herself) standing in
// her reach, so auras, brews, links, marks and shred show up as the partner's DPS.
//
//   node --import ./tools/simLoader.mjs tools/bench.mjs [girls…] [--stage 4-5] [--seed 9]
//        [--builds p0t3,p0t4,…] [--targets crowd,boss] [--preset strong|L25] [--partner kage]
//        [--copies '[[0,5,2,2],[0,4,2,2]]'] [--compare tools/baselines/bench-today-s9.jsonl] [--json]
//        [--partner-build p0t5] [--strip-buffs]
//   node --import ./tools/simLoader.mjs tools/bench.mjs --hit [--ceiling] …   (real hit DPS; the run-ceiling gate: tools/benchHit.mjs)
//
// Builds pNtM: path N to tier M with a tier-2 crosspath (P1 x-0-2, P2 2-x-0, P3 2-0-x); default: every
// path at tiers 3, 4 and 5. One JSON line per run (--json) or a table; with --compare, the change of
// every row against a baseline file of the same rows (today's numbers: tools/baselines/bench-today-s9.jsonl,
// live fddf01c): own DPS on the crowd and the boss, the partner's DPS.
// --partner-build upgrades the partner like a build (Kage 5-0-2: p0t5); --strip-buffs removes the measured
// girls' auras, brews and links every step, so the partner's DPS without them is the baseline of a
// buff ratio (spec M4: partner DPS / partner DPS with --strip-buffs, same tree, same spots).
import { readFileSync, existsSync } from 'node:fs';
import { Sim } from '../src/sim/Sim.js';
import { defaultData } from '../src/sim/data.js';
import { samplePath } from '../src/sim/path.js';
import { withDetMath } from '../src/core/detMath.js';

const args = process.argv.slice(2);
// --hit: real hit DPS on a dummy stream, and --hit --ceiling, the Tryout Day run-ceiling gate (tools/benchHit.mjs)
if (args.includes('--hit')) {
  const { main } = await import('./benchHit.mjs');
  process.exit(await main(args.filter((a) => a !== '--hit')));
}
const VALUED = ['--stage', '--seed', '--builds', '--targets', '--preset', '--partner', '--copies', '--compare', '--run', '--partner-build'];
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const names = args.filter((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]));
const STAGE = opt('stage', '4-5');
const SEED = Number(opt('seed', 9));
const RUN = Number(opt('run', 40));
const d = defaultData();
const lv = (L, bt, st) => 1 + 0.018 * (L - 1) + 0.02 * bt + 0.05 * st;
const rt = (L) => 1 + 0.004 * (L - 1);
const PRESET = opt('preset', 'strong');
const early = (L) => {
  const bt = Math.max(0, Math.ceil((L - 10) / 10));
  return { damageMul: +lv(L, bt, 0).toFixed(4), rateMul: +rt(L).toFixed(4), rangeMul: 1, critChance: 0, critMul: 1, armorPen: 0, costMul: 1, ultHaste: 0, awakenPassive: false, level: L, awaken: 0 };
};
const STRONG = { damageMul: +(lv(60, 5, 3) * 1.45).toFixed(4), rateMul: +(rt(60) * 1.2).toFixed(4), rangeMul: 1, critChance: 0.25, critMul: 1.3, armorPen: 1, costMul: 1, ultHaste: 0, awakenPassive: true, level: 60, awaken: 3 };
const STATS = PRESET === 'strong' ? STRONG : early(Number(PRESET.slice(1)));
const STREAM = { crowd: 'orc_grunt', boss: PRESET === 'strong' ? 'dragon_ashwing' : 'slime_courtier' };
const PARTNER = (id) => opt('partner', id === 'aoi' ? 'kage' : 'aoi');
const HP_CROWD = 5e4;
const HP_BOSS = PRESET === 'strong' ? 3e7 : 5e4;

function run(unitId, target, copies, stageId) {
  const def = d.units[unitId];
  const partner = args.includes('--no-partner') ? null : PARTNER(unitId);
  const loadout = [{ unitId, stats: STATS }, ...(partner && partner !== unitId ? [{ unitId: partner, stats: STATS }] : [])];
  const sim = withDetMath(() => new Sim({ stageId, loadout, hero: null, seed: SEED }));
  sim.cash = 1e15;
  sim.lives = 1e15;
  const samples = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((s) => !s.hidden);
  const lattice = [];
  for (let y = 0.3; y < sim.map.height; y += 0.25) for (let x = 0.3; x < sim.map.width; x += 0.25) lattice.push({ x: x + 0.013, y: y + 0.007 });
  const cov = (c, r) => samples.reduce((a, s) => a + ((s.x - c.x) ** 2 + (s.y - c.y) ** 2 <= r * r ? 1 : 0), 0);
  let out = null;
  withDetMath(() => {
    const r = Math.min(4, def.base.range || 3);
    const ranked = lattice.map((c) => ({ ...c, cov: cov(c, r) })).sort((a, b) => b.cov - a.cov);
    const placed = [];
    for (const [mp, mt, cp, ct] of copies) {
      const spot = ranked.find((c) => sim.canPlace(unitId, c.x, c.y).ok);
      if (!spot) {
        out = { error: 'no spot' };
        return;
      }
      const t = sim.placeTower(unitId, spot.x, spot.y);
      for (let i = 0; i < ct; i++) sim.upgradeTower(t.uid, cp);
      // a refused final tier (another copy holds it) stays at tier 4: the bench measures the rule too
      for (let i = 0; i < mt; i++) sim.upgradeTower(t.uid, mp);
      placed.push({ t, spot });
    }
    const measured = placed.map((p) => p.t);
    const spot = placed[0].spot;
    let pt = null;
    if (partner) {
      const ps = lattice.filter((c) => (c.x - spot.x) ** 2 + (c.y - spot.y) ** 2 < 2.2 * 2.2).map((c) => ({ ...c, cov: cov(c, 3.2) }))
        .sort((a, b) => b.cov - a.cov).find((c) => sim.canPlace(partner, c.x, c.y).ok);
      pt = ps ? sim.placeTower(partner, ps.x, ps.y) : null;
      const pb = /^p(\d)t(\d)$/.exec(opt('partner-build', '') || '');
      if (pt && pb) {
        for (let i = 0; i < 2; i++) sim.upgradeTower(pt.uid, [2, 0, 0][+pb[1]]);
        for (let i = 0; i < +pb[2]; i++) sim.upgradeTower(pt.uid, +pb[1]);
      }
    }
    const STRIP = args.includes('--strip-buffs');
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
    // targets with a late-Freeplay HP (crowd ~50k, boss ~30M), healed back every step: %-max-HP damage
    // (burn / poison pct, execution) meets realistic numbers and nothing ever dies
    const hpOf = (id) => sim.data.enemy(id)?.hp || 1;
    const spawn = (id) => sim.spawnEnemy(id, { pathIndex: 0, dist: 0, hpMul: (id === STREAM.boss ? HP_BOSS : HP_CROWD) / hpOf(id) });
    const near = samples.reduce((b, s) => {
      const dd = (s.x - spot.x) ** 2 + (s.y - spot.y) ** 2;
      return dd < b.d ? { d: dd, s } : b;
    }, { d: 1e9 }).s;
    const WARM = 15;
    const dealt = () => measured.reduce((a, t) => a + t.damageDealt, 0);
    let dmg0 = 0;
    let pd0 = 0;
    for (let step = 0; step < (WARM + RUN) * 60; step++) {
      if (target === 'crowd' && step % 6 === 0) spawn(STREAM.crowd);
      if (target === 'boss' && !sim.enemies.some((e) => !e.dead && e.id === STREAM.boss)) {
        const e = spawn(STREAM.boss);
        e.dist = Math.max(0, (near.dist ?? 0) - 1.5);
      }
      if (sim.state !== 'wave') sim.state = 'wave';
      if (STRIP) strip();
      sim.update(1 / 60);
      sim.drainEvents();
      for (const e of sim.enemies) if (!e.dead) e.hp = e.maxHp;
      if (step === WARM * 60) {
        dmg0 = dealt();
        pd0 = pt ? pt.damageDealt : 0;
      }
    }
    out = {
      panelDps: Math.round(panel.reduce((a, p) => a + p.dps, 0) * 100) / 100,
      realDps: Math.round(((dealt() - dmg0) / RUN) * 100) / 100,
      partnerDps: pt ? Math.round(((pt.damageDealt - pd0) / RUN) * 100) / 100 : null,
      cost: placed.reduce((a, p) => a + p.t.spent, 0),
      tiers: placed.map((p) => p.t.tiers.join('-')).join(' '),
    };
  });
  return out;
}

const girls = names.length ? names : Object.values(d.units).filter((u) => u.kind === 'tower').map((u) => u.id);
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
      if (args.includes('--json')) console.log(JSON.stringify(row));
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
} else if (!args.includes('--json')) {
  for (const r of rows) console.log(`${r.unitId} ${r.build} ${r.target}: own ${r.realDps} partner ${r.partnerDps ?? '-'} (panel ${r.panelDps}, ${r.tiers}, ${r.cost} coins)`);
}
