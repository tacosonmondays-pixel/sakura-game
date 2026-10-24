// PROPOSAL pass for owner decision #161 (scratch tool in the wt-balance measuring copy; not committed).
// Same harness as tools/measure.mjs (max investment, Freeplay waves from a jump, damage through Sim._credit),
// plus patched unit defs passed to the Sim as data overrides (notes/balance/proposal/patch.mjs), so one node
// process runs a whole plan of jobs without touching the game files.
//
//   node --import ./tools/simLoader.mjs tools/measureP.mjs sweep --plan plan.json --out rows.jsonl
//     plan: [{ girl, build, scen: 'A'|'B'|'C'|'F'|'D', boost?: M, prop?: true, label? }]
//   node --import ./tools/simLoader.mjs tools/measureP.mjs team --core '…' --extra '…' [--hero h] [--prop all|id,id] --scen D
//   node --import ./tools/simLoader.mjs tools/measureP.mjs copies --girl kage --main 5-2-0 --copy 4-2-0 --n 0,4 [--t4shift 1.3]
import { appendFileSync, readFileSync } from 'node:fs';
import { Sim } from '../src/sim/Sim.js';
import { defaultData } from '../src/sim/data.js';
import { samplePath } from '../src/sim/path.js';
import { withDetMath } from '../src/core/detMath.js';
import { soloFreeplayStage } from '../src/data/freeplaySolo.js';
import { gainHeroXp, heroXpCap } from '../src/sim/hero.js';
import { maxProfile, parseBuild, releaseAbilities } from './benchLib.mjs';
import { clone, boostGirl, applyProposal, PROPOSAL } from '../../notes/balance/proposal/patch.mjs';

const args = process.argv.slice(2);
const MODE = args[0];
const opt = (k, dflt) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : dflt);
const flag = (k) => args.includes(`--${k}`);
const SEED = Number(opt('seed', 9));
const ROLLS = opt('rolls', 'mid');
const TIER = opt('tier', 'blossom');
const OUT = opt('out', null);
const d = defaultData();

const span = (a, b, s) => {
  const o = [];
  for (let w = a; w <= b; w += s) o.push(w);
  return o;
};
const SCEN = {
  A: { stage: '4-5', waves: span(101, 200, 3) },
  B: { stage: '8-2', waves: span(191, 200, 1) },
  C: { stage: '4-5', waves: span(150, 200, 5) },
  D: { stage: '4-5', waves: span(152, 230, 3) },
  F: { stage: '4-5', waves: span(191, 230, 3) },
  // review: the summit (waves 232-250, wave 250 included)
  G: { stage: '4-5', waves: span(232, 250, 3) },
};

const statCache = new Map();
const statsOf = (unitId) => {
  if (!statCache.has(unitId)) statCache.set(unitId, maxProfile(unitId, { rolls: ROLLS }).stats);
  return statCache.get(unitId);
};
const parseList = (s) => (s ? s.split(',').filter(Boolean).map((x) => {
  const [unitId, build] = x.split(':');
  return { unitId, build: build || '5-0-2' };
}) : []);
const BOSSY = (e) => !!e && !!e.tier && e.tier !== 'normal' && e.tier !== 'elite';
const AIR = (e) => !!e && e.airborne && !e.grounded;
const r0 = (v) => Math.round(v);

function upgrade(sim, uid, [mp, mt, cp, ct]) {
  for (let i = 0; i < ct; i++) sim.upgradeTower(uid, cp);
  for (let i = 0; i < mt; i++) sim.upgradeTower(uid, mp);
}

/** Patched defs: { id: def } for the Sim's data override. */
function unitsFor(spec) {
  const out = {};
  for (const [id, how] of Object.entries(spec || {})) {
    const def = clone(d.units[id]);
    if (how.boost) boostGirl(def, how.boost);
    if (how.prop) applyProposal(def, id);
    if (how.t4shift) {
      for (const p of def.paths) {
        const m4 = p.tiers[3].mods;
        const m5 = p.tiers[4].mods;
        m4.damageMul = (m4.damageMul ?? 1) * how.t4shift;
        m5.damageMul = (m5.damageMul ?? 1) / how.t4shift;
      }
    }
    out[id] = def;
  }
  return out;
}

function board({ stageId, towers, hero = null, units = {} }) {
  const stage = soloFreeplayStage(stageId, TIER);
  const ids = [...new Set(towers.map((t) => t.unitId))];
  const loadout = ids.map((unitId) => ({ unitId, stats: statsOf(unitId) }));
  const heroCfg = hero ? { unitId: hero.unitId, stats: statsOf(hero.unitId) } : null;
  const sim = withDetMath(() => new Sim({ stageId, difficulty: 'normal', loadout, hero: heroCfg, seed: SEED, options: { freeplay: true, autoStart: false }, data: { stage, units } }));
  sim.cash = 1e15;
  sim.lives = 1e15;
  const samples = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((s) => !s.hidden);
  const lat = [];
  for (let y = 0.3; y < sim.map.height; y += 0.25) for (let x = 0.3; x < sim.map.width; x += 0.25) lat.push({ x: x + 0.013, y: y + 0.007 });
  const rankCache = new Map();
  const ranked = (r) => {
    const k = r.toFixed(2);
    if (!rankCache.has(k)) rankCache.set(k, lat.map((c) => ({ ...c, cov: samples.reduce((a, s) => a + ((s.x - c.x) ** 2 + (s.y - c.y) ** 2 <= r * r ? 1 : 0), 0) })).sort((a, b) => b.cov - a.cov));
    return rankCache.get(k);
  };
  const CL = Number(opt('cluster', 2.5));
  const placed = [];
  let first = null;
  const carries = [];
  const centre = () => {
    const cs = carries.length ? carries : placed;
    return { x: cs.reduce((a, t) => a + t.x, 0) / cs.length, y: cs.reduce((a, t) => a + t.y, 0) / cs.length };
  };
  const nearestFree = (unitId, c) => lat.map((p) => ({ ...p, dd: (p.x - c.x) ** 2 + (p.y - c.y) ** 2 })).filter((p) => p.dd > 0.01).sort((a, b) => a.dd - b.dd).find((p) => sim.canPlace(unitId, p.x, p.y).ok);
  const defOf = (id) => units[id] || d.units[id];
  withDetMath(() => {
    for (const t of towers) {
      const def = defOf(t.unitId);
      const r = Math.min(4, def.base.range || 3);
      let spot = null;
      if (t.role === 'support') spot = placed.length ? nearestFree(t.unitId, centre()) : ranked(r).find((c) => sim.canPlace(t.unitId, c.x, c.y).ok);
      else if (t.role === 'carry' && first) {
        spot = ranked(r).find((c) => (c.x - first.x) ** 2 + (c.y - first.y) ** 2 <= CL * CL && sim.canPlace(t.unitId, c.x, c.y).ok)
          || ranked(r).find((c) => sim.canPlace(t.unitId, c.x, c.y).ok);
      } else spot = ranked(r).find((c) => sim.canPlace(t.unitId, c.x, c.y).ok);
      if (!spot) throw new Error(`no spot for ${t.unitId}`);
      const tw = sim.placeTower(t.unitId, spot.x, spot.y);
      upgrade(sim, tw.uid, parseBuild(t.build));
      const rec = { ...t, uid: tw.uid, x: tw.x, y: tw.y, tiers: tw.tiers.join('-'), spent: tw.spent };
      placed.push(rec);
      if (t.role === 'carry' || t.role === 'copy') {
        carries.push(rec);
        if (!first) first = rec;
      }
    }
    if (hero) {
      const spot = placed.length ? nearestFree(hero.unitId, centre()) : ranked(3).find((c) => sim.canPlace(hero.unitId, c.x, c.y).ok);
      const h = sim.placeTower(hero.unitId, spot.x, spot.y);
      const xp = heroXpCap(h.def.hero);
      gainHeroXp(sim, h, xp, 'bought', xp);
      placed.push({ unitId: hero.unitId, build: `Lv${h.level}`, role: 'hero', uid: h.uid, x: h.x, y: h.y, tiers: '', spent: 0 });
    }
    sim.update(0.5);
    sim.drainEvents();
  });
  return { sim, placed };
}

function playWaves(sim, waves, watched, { heroUlt = false } = {}) {
  const acc = new Map();
  const get = (uid) => {
    let a = acc.get(uid);
    if (!a) acc.set(uid, (a = { all: 0, boss: 0, air: 0 }));
    return a;
  };
  const origCredit = sim._credit;
  sim._credit = function (tower, dealt, e, drone) {
    origCredit.call(this, tower, dealt, e, drone);
    if (!tower || !(dealt > 0)) return;
    const a = get(tower.uid);
    a.all += dealt;
    if (BOSSY(e)) a.boss += dealt;
    if (AIR(e)) a.air += dealt;
  };
  const leak = { hp: 0, boss: 0, air: 0, n: 0 };
  const origLeak = sim._leak;
  sim._leak = function (e) {
    if (!(e.leak < 1e6)) e.leak = 100;
    if (!e.dead) {
      const h = Math.max(0, e.hp) + Math.max(0, e.barrier || 0);
      leak.hp += h;
      leak.n++;
      if (BOSSY(e)) leak.boss += h;
      if (AIR(e)) leak.air += h;
    }
    return origLeak.call(this, e);
  };
  const sumW = (k) => watched.reduce((s, uid) => s + (acc.get(uid)?.[k] || 0), 0);
  const sumAll = (k) => [...acc.values()].reduce((s, a) => s + a[k], 0);
  const rows = [];
  withDetMath(() => {
    releaseAbilities(sim, !flag('no-abilities'));
    for (const w of waves) {
      sim.wave = w - 1;
      sim.wavesCleared = w - 1;
      sim.lives = 1e15;
      sim.state = 'between';
      sim.startNextWave();
      const d0 = { all: sumW('all'), boss: sumW('boss'), air: sumW('air') };
      const a0 = { all: sumAll('all'), boss: sumAll('boss'), air: sumAll('air') };
      const l0 = { ...leak };
      const per0 = new Map(watched.map((u) => [u, acc.get(u)?.all || 0]));
      let steps = 0;
      while (sim.state === 'wave' && steps < 600 * 4) {
        if (heroUlt && sim.heroUltStatus?.().ready) sim.activateUlt();
        sim.update(0.25);
        sim.drainEvents();
        steps++;
      }
      rows.push({
        w,
        dmg: r0(sumW('all') - d0.all),
        boss: r0(sumW('boss') - d0.boss),
        air: r0(sumW('air') - d0.air),
        hp: r0(sumAll('all') - a0.all + leak.hp - l0.hp),
        hpBoss: r0(sumAll('boss') - a0.boss + leak.boss - l0.boss),
        leakHp: r0(leak.hp - l0.hp),
        per: Object.fromEntries(watched.map((u) => [u, r0((acc.get(u)?.all || 0) - per0.get(u))])),
      });
    }
  });
  sim._credit = origCredit;
  sim._leak = origLeak;
  const tot = (k) => rows.reduce((s, r) => s + r[k], 0);
  const per = {};
  for (const u of watched) per[u] = rows.reduce((s, r) => s + r.per[u], 0);
  const best = rows.reduce((b, r) => (r.dmg > (b?.dmg ?? -1) ? r : b), null);
  return { total: tot('dmg'), boss: tot('boss'), air: tot('air'), hp: tot('hp'), hpBoss: tot('hpBoss'), leakHp: tot('leakHp'), peakWave: best?.w ?? null, peakWaveDmg: best?.dmg ?? 0, per, waves: rows.map(({ per: _p, ...r }) => r) };
}

const emit = (row) => {
  const line = JSON.stringify(row);
  console.log(line);
  if (OUT) appendFileSync(OUT, `${line}\n`);
};
const t00 = Date.now();
const BUFFS = parseList('umeko:2-5-0,chika:2-5-0,wakaba:5-0-2');
const propSpec = (list) => Object.fromEntries((list === 'all' ? Object.keys(PROPOSAL) : (list || '').split(',').filter(Boolean)).map((id) => [id, { prop: true }]));

if (MODE === 'sweep') {
  const plan = JSON.parse(readFileSync(opt('plan'), 'utf8'));
  for (const job of plan) {
    const t0 = Date.now();
    const sc = SCEN[job.scen === 'F' ? 'F' : job.scen];
    const spec = { ...(job.units || {}) };
    if (job.boost || job.prop) spec[job.girl] = { ...(spec[job.girl] || {}), boost: job.boost || 0, prop: !!job.prop };
    const units = unitsFor(spec);
    const towers = [{ unitId: job.girl, build: job.build, role: 'carry' }];
    if (job.scen === 'F') towers.push(...BUFFS.filter((s) => s.unitId !== job.girl).map((s) => ({ ...s, role: 'support' })));
    const { sim, placed } = board({ stageId: sc.stage, towers, units });
    const me = placed[0];
    const r = playWaves(sim, sc.waves, [me.uid]);
    emit({ mode: 'sweep', label: job.label || null, scen: job.scen, girl: job.girl, build: job.build, boost: job.boost || 1, prop: !!job.prop, total: r.total, boss: r.boss, air: r.air, hp: r.hp, hpBoss: r.hpBoss, leakHp: r.leakHp, peakWave: r.peakWave, peakWaveDmg: r.peakWaveDmg, ms: Date.now() - t0 });
  }
} else if (MODE === 'team') {
  const core = parseList(opt('core', 'kage:5-2-0,hotaru:5-2-0,akane:5-0-2')).map((t) => ({ ...t, role: 'carry' }));
  const extra = parseList(opt('extra', '')).map((t) => ({ ...t, role: 'support' }));
  const heroId = opt('hero', null);
  const t0 = Date.now();
  const units = unitsFor(propSpec(opt('prop', '')));
  const { sim, placed } = board({ stageId: SCEN[opt('scen', 'D')].stage, towers: [...core, ...extra], hero: heroId ? { unitId: heroId } : null, units });
  const coreUids = placed.filter((p) => p.role === 'carry').map((p) => p.uid);
  const r = playWaves(sim, SCEN[opt('scen', 'D')].waves, placed.map((p) => p.uid), { heroUlt: !!heroId });
  const deep = r.waves.filter((w) => w.w >= (opt('scen', 'D') === 'G' ? 232 : 203));
  const coreDeep = deep.reduce((a, w) => a, 0);
  emit({
    mode: 'team', label: opt('label', null), rule: process.env.BAL_RULE || null, prop: opt('prop', ''), core: core.map((t) => `${t.unitId} ${t.build}`), extra: extra.map((t) => `${t.unitId} ${t.build}`), hero: heroId,
    placed: placed.map((p) => ({ unitId: p.unitId, build: p.build, dmg: r.per[p.uid] })),
    coreDmg: coreUids.reduce((s, u) => s + r.per[u], 0), teamDmg: r.total, hp: r.hp, leakHp: r.leakHp,
    deepTeam: deep.reduce((a, w) => a + w.dmg, 0), deepHp: deep.reduce((a, w) => a + w.hp, 0), coreDeep,
    waves: r.waves, ms: Date.now() - t0,
  });
} else if (MODE === 'copies') {
  const g = opt('girl', 'kage');
  const main = opt('main', '5-2-0');
  const copy = opt('copy', '4-2-0');
  const shift = Number(opt('t4shift', 1));
  const units = shift !== 1 ? unitsFor({ [g]: { t4shift: shift } }) : {};
  for (const n of opt('n', '0,4').split(',').map(Number)) {
    const t0 = Date.now();
    const towers = [{ unitId: g, build: main, role: 'copy' }];
    for (let i = 0; i < n; i++) towers.push({ unitId: g, build: copy, role: 'copy' });
    const { sim, placed } = board({ stageId: SCEN[opt('scen', 'D')].stage, towers, units });
    const r = playWaves(sim, SCEN[opt('scen', 'D')].waves, placed.map((p) => p.uid));
    const mainDmg = r.per[placed[0].uid];
    const copyDmg = placed.slice(1).reduce((s, p) => s + r.per[p.uid], 0);
    emit({ mode: 'copies', unitId: g, main, copy, n, t4shift: shift, mainDmg, copyDmg, total: r.total, hp: r.hp, ms: Date.now() - t0 });
  }
} else {
  console.error('mode: sweep | team | copies');
  process.exit(2);
}
console.error(`done in ${Math.round((Date.now() - t00) / 1000)} s`);
