// MEASURE pass for owner decision #161 (scratch tool in the wt-balance measuring copy; not committed).
// Every girl at max investment (tools/benchLib.mjs maxProfile: L85, 10 gates, ★5, P6, the standard UR +12
// best-in-slot set) in real Freeplay waves (solo, Normal, Blossom, infinite lives; each wave played from a
// jump on a board built once, as tools/bench.mjs runWaves). Damage is credited per girl through the Sim's
// own seam (Sim._credit), split into boss-rank and airborne (not grounded) targets; leaked HP is summed
// through Sim._leak, so each wave's HP = everything dealt + everything that walked off.
//
//   node --import ./tools/simLoader.mjs tools/measure.mjs solo   --girls kage,shiro [--builds all|5-2-0,…] --scen A|B|C [--buff] [--out f]
//   node --import ./tools/simLoader.mjs tools/measure.mjs team   --core 'kage:5-2-0,hotaru:5-2-0,akane:5-0-2' [--extra 'umeko:2-5-0'] [--hero luna] --scen A
//   node --import ./tools/simLoader.mjs tools/measure.mjs copies --girl kage --main 5-2-0 --copy 4-2-0 --n 0,1,2,4,8 --scen A
//   node --import ./tools/simLoader.mjs tools/measure.mjs hero   --hero luna --scen A          (the hero alone, Lv 25 + full Mastery)
//   node --import ./tools/simLoader.mjs tools/measure.mjs panel  --core 'kage:5-2-0' --extra '…' [--hero luna] --wave 150   (panel DPS readout)
//
// Scenarios: A = stage 4-5 (The Iron General, ground orcs, armour) waves 101–200 every 3rd; B = stage 8-2 (Frozen
// Falls) waves 191–200 (the finale prelude: home pool and visitors are chapter 8, the sky chapter; 200 = the
// Matriarch); C = stage 4-5 boss waves 150–200 every 5th (every one a boss wave on Blossom).
import { appendFileSync } from 'node:fs';
import { Sim } from '../src/sim/Sim.js';
import { defaultData } from '../src/sim/data.js';
import { samplePath } from '../src/sim/path.js';
import { withDetMath } from '../src/core/detMath.js';
import { soloFreeplayStage } from '../src/data/freeplaySolo.js';
import { gainHeroXp, heroXpCap, xpToReach } from '../src/sim/hero.js';
import { maxProfile, FINAL_BUILDS, parseBuild, releaseAbilities } from './benchLib.mjs';
import { PROFILES, profileStats } from './potentialProfiles.mjs';

const args = process.argv.slice(2);
const MODE = args[0];
const opt = (k, dflt) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : dflt);
const flag = (k) => args.includes(`--${k}`);
const SEED = Number(opt('seed', 9));
const ROLLS = opt('rolls', 'mid');
const TIER = opt('tier', 'blossom');
const OUT = opt('out', null);
const CLUB = opt('club', null);
const HERO_LV = opt('hero-level', 'cap');
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
  // deep Freeplay, unsaturated even for a buffed carry or a team: 4-5 waves 152–230 every 3rd
  D: { stage: '4-5', waves: span(152, 230, 3) },
  // deeper still, for teams with a full support stack (they clear every wave of D): 4-5 waves 230–299 every 3rd
  E: { stage: '4-5', waves: span(230, 300, 3) },
  // the buffed solo runs (her + three buffers): 4-5 waves 191–230 every 3rd, where a buffed carry still leaks
  F: { stage: '4-5', waves: span(191, 230, 3) },
};
const scenArg = opt('scen', 'A');
const SC = SCEN[scenArg] || { stage: opt('stage', '4-5'), waves: opt('waves', '150').split(',').map(Number) };
if (opt('stage', null)) SC.stage = opt('stage');
if (opt('waves', null)) SC.waves = opt('waves').split(',').map(Number);

const statCache = new Map();
// --profile p1|f2p-steady|f2p-late|whale: the Potential v3 profiles (tools/potentialProfiles.mjs) instead of max investment
const PROF = opt('profile', null);
const statsOf = (unitId) => {
  const k = `${unitId}|${CLUB || ''}`;
  if (!statCache.has(k)) statCache.set(k, PROF ? profileStats(unitId, PROFILES[PROF]) : maxProfile(unitId, { rolls: ROLLS, club: CLUB }).stats);
  return statCache.get(k);
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

/**
 * A Freeplay board. towers: [{ unitId, build, role: 'carry'|'copy'|'support' }] in placement order;
 * hero: { unitId, role: 'solo'|'aura' } (Lv 25 + full Mastery, or --hero-level N).
 * Carry 1 (and every copy) takes the lattice spot covering the most road for her reach (min(4, base range));
 * later carries the best such spot within --cluster tiles (default 2.5) of carry 1; supports and an aura hero
 * the free spot nearest the carries' centre.
 */
function board({ stageId, towers, hero = null }) {
  const stage = soloFreeplayStage(stageId, TIER);
  if (!stage?.freeplay) throw new Error(`no freeplay on ${stageId}/${TIER}`);
  const ids = [...new Set(towers.map((t) => t.unitId))];
  const loadout = ids.map((unitId) => ({ unitId, stats: statsOf(unitId) }));
  const heroCfg = hero ? { unitId: hero.unitId, stats: statsOf(hero.unitId) } : null;
  const sim = withDetMath(() => new Sim({ stageId, difficulty: 'normal', loadout, hero: heroCfg, seed: SEED, options: { freeplay: true, autoStart: false }, data: { stage } }));
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
  withDetMath(() => {
    for (const t of towers) {
      const def = d.units[t.unitId];
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
      const def = d.units[hero.unitId];
      const r = Math.min(4, def.base.range || 3);
      const spot = hero.role === 'aura' && placed.length ? nearestFree(hero.unitId, centre()) : ranked(r).find((c) => sim.canPlace(hero.unitId, c.x, c.y).ok);
      const h = sim.placeTower(hero.unitId, spot.x, spot.y);
      if (!h) throw new Error(`hero ${hero.unitId} not placed`);
      const hd = h.def.hero;
      const xp = HERO_LV === 'cap' ? heroXpCap(hd) : xpToReach(hd, Number(HERO_LV));
      gainHeroXp(sim, h, xp, 'bought', xp);
      placed.push({ unitId: hero.unitId, build: `Lv${h.level}+${Math.round((h.mastery || 0) * 100)}%`, role: 'hero', uid: h.uid, x: h.x, y: h.y, tiers: '', spent: 0 });
    }
    sim.update(0.5);
    sim.drainEvents();
  });
  return { sim, placed };
}

/** Which placed girls each aura / brew / link reaches (a coverage check for the team runs). */
function coverage(sim, placed) {
  const out = {};
  for (const p of placed) {
    const src = sim.buffSources?.(p.uid) || [];
    out[`${p.unitId}#${p.uid}`] = src.map((s) => `${s.key}:${s.kind}:${s.unitId}`).slice(0, 10);
  }
  return out;
}

/**
 * Plays every wave of `waves` from a jump. Returns per-wave rows and totals for the watched uids (each
 * girl's own row too), the HP every wave carried (dealt by anyone + leaked), boss and air splits.
 */
function playWaves(sim, waves, watched, { heroUlt = false, panelUid = null, covPlaced = null } = {}) {
  let cov = null;
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
    // the finale and the calamity take every life (leak Infinity): with "infinite" lives that still ends the
    // run and cuts the wave short, so a leak here costs a finite count and the lives are topped up each wave
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
  const panel = [];
  withDetMath(() => {
    releaseAbilities(sim, !flag('no-abilities'));
    for (const w of waves) {
      sim.wave = w - 1;
      sim.wavesCleared = w - 1;
      sim.lives = 1e15;
      sim.state = 'between';
      sim.startNextWave();
      const d0 ={ all: sumW('all'), boss: sumW('boss'), air: sumW('air') };
      const a0 = { all: sumAll('all'), boss: sumAll('boss'), air: sumAll('air') };
      const l0 = { ...leak };
      const per0 = new Map(watched.map((u) => [u, acc.get(u)?.all || 0]));
      const t0 = sim.time;
      let mark = d0.all;
      let peak = 0;
      let steps = 0;
      while (sim.state === 'wave' && steps < 600 * 4) {
        if (heroUlt && sim.heroUltStatus?.().ready) sim.activateUlt();
        sim.update(0.25);
        sim.drainEvents();
        steps++;
        if (covPlaced && !cov && steps === 120) cov = coverage(sim, covPlaced);
        if (panelUid != null && steps % 2 === 0) {
          const st = sim.towerStats(panelUid);
          if (st) panel.push(st.dps);
        }
        if (steps % 4 === 0) {
          const now = sumW('all');
          peak = Math.max(peak, now - mark);
          mark = now;
        }
      }
      const dealtAll = sumAll('all') - a0.all;
      const lk = leak.hp - l0.hp;
      rows.push({
        w,
        dmg: r0(sumW('all') - d0.all),
        boss: r0(sumW('boss') - d0.boss),
        air: r0(sumW('air') - d0.air),
        hp: r0(dealtAll + lk),
        hpBoss: r0(sumAll('boss') - a0.boss + leak.boss - l0.boss),
        hpAir: r0(sumAll('air') - a0.air + leak.air - l0.air),
        leakHp: r0(lk),
        leaks: leak.n - l0.n,
        sec: Math.round((sim.time - t0) * 100) / 100,
        peak1s: r0(peak),
        per: Object.fromEntries(watched.map((u) => [u, r0((acc.get(u)?.all || 0) - per0.get(u))])),
      });
    }
  });
  sim._credit = origCredit;
  sim._leak = origLeak;
  const tot = (k) => rows.reduce((s, r) => s + r[k], 0);
  const best = rows.reduce((b, r) => (r.dmg > (b?.dmg ?? -1) ? r : b), null);
  const per = {};
  for (const u of watched) per[u] = rows.reduce((s, r) => s + r.per[u], 0);
  const out = {
    total: tot('dmg'), boss: tot('boss'), air: tot('air'), hp: tot('hp'), hpBoss: tot('hpBoss'), hpAir: tot('hpAir'), leakHp: tot('leakHp'),
    peakWave: best?.w ?? null, peakWaveDmg: best?.dmg ?? 0, peak1s: Math.max(0, ...rows.map((r) => r.peak1s)), per,
    waves: rows.map(({ per: _p, ...r }) => r),
    cov,
  };
  if (panelUid != null && panel.length) {
    const s = [...panel].sort((a, b) => a - b);
    out.panel = { max: r0(s[s.length - 1]), p90: r0(s[Math.floor(s.length * 0.9)]), med: r0(s[Math.floor(s.length / 2)]) };
  }
  return out;
}

const emit = (row) => {
  const line = JSON.stringify(row);
  console.log(line);
  if (OUT) appendFileSync(OUT, `${line}\n`);
};
const t00 = Date.now();

if (MODE === 'solo') {
  // each girl alone (or with --buff: Umeko 2-5-0, Chika 2-5-0, Wakaba 5-0-2, the three buffers that deal next
  // to no damage; Midori is left out because her poison deals and takes kills itself) at every build
  const girls = opt('girls', '').split(',').filter(Boolean);
  const all = girls.length ? girls : Object.values(d.units).filter((u) => u.kind === 'tower').map((u) => u.id);
  const BUFF = flag('buff') ? parseList(opt('buffs', 'umeko:2-5-0,chika:2-5-0,wakaba:5-0-2')) : [];
  for (const g of all) {
    const builds = opt('builds', 'all') === 'all' ? FINAL_BUILDS.map((b) => b.name) : opt('builds').split(',');
    for (const b of builds) {
      const t0 = Date.now();
      const towers = [{ unitId: g, build: b, role: 'carry' }, ...BUFF.filter((s) => s.unitId !== g).map((s) => ({ ...s, role: 'support' }))];
      const { sim, placed } = board({ stageId: SC.stage, towers });
      const me = placed[0];
      const r = playWaves(sim, SC.waves, [me.uid]);
      emit({ mode: 'solo', scen: scenArg, stage: SC.stage, unitId: g, rarity: d.units[g].rarity, role: d.units[g].role, build: b, tiers: me.tiers, buff: BUFF.length ? BUFF.map((s) => `${s.unitId} ${s.build}`).join(', ') : null, rolls: ROLLS, club: CLUB, ...r, per: undefined, ms: Date.now() - t0 });
    }
  }
} else if (MODE === 'team') {
  const core = parseList(opt('core', 'kage:5-2-0,hotaru:5-2-0,akane:5-0-2')).map((t) => ({ ...t, role: 'carry' }));
  const extra = parseList(opt('extra', '')).map((t) => ({ ...t, role: 'support' }));
  const heroId = opt('hero', null);
  const t0 = Date.now();
  const { sim, placed } = board({ stageId: SC.stage, towers: [...core, ...extra], hero: heroId ? { unitId: heroId, role: 'aura' } : null });
  const coreUids = placed.filter((p) => p.role === 'carry').map((p) => p.uid);
  const allUids = placed.map((p) => p.uid);
  const r = playWaves(sim, SC.waves, allUids, { heroUlt: !!heroId, covPlaced: placed });
  const cov = r.cov;
  const coreDmg = coreUids.reduce((s, u) => s + r.per[u], 0);
  emit({
    mode: 'team', scen: scenArg, stage: SC.stage, label: opt('label', null), core: core.map((t) => `${t.unitId} ${t.build}`), extra: extra.map((t) => `${t.unitId} ${t.build}`), hero: heroId,
    placed: placed.map((p) => ({ unitId: p.unitId, build: p.build, tiers: p.tiers, x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, dmg: r.per[p.uid] })),
    coreDmg, teamDmg: r.total, hp: r.hp, hpBoss: r.hpBoss, boss: r.boss, air: r.air, leakHp: r.leakHp, peakWave: r.peakWave, peakWaveDmg: r.peakWaveDmg, peak1s: r.peak1s,
    waves: r.waves, cov, rolls: ROLLS, ms: Date.now() - t0,
  });
} else if (MODE === 'copies') {
  const g = opt('girl', 'kage');
  const main = opt('main', '5-2-0');
  const copy = opt('copy', '4-2-0');
  for (const n of opt('n', '0,1,2,4,8').split(',').map(Number)) {
    const t0 = Date.now();
    const towers = [{ unitId: g, build: main, role: 'copy' }];
    for (let i = 0; i < n; i++) towers.push({ unitId: g, build: copy, role: 'copy' });
    const { sim, placed } = board({ stageId: SC.stage, towers });
    const r = playWaves(sim, SC.waves, placed.map((p) => p.uid));
    const mainDmg = r.per[placed[0].uid];
    const copyDmg = placed.slice(1).reduce((s, p) => s + r.per[p.uid], 0);
    emit({ mode: 'copies', scen: scenArg, stage: SC.stage, unitId: g, main, copy, n, tiers: placed.map((p) => p.tiers), mainDmg, copyDmg, total: r.total, perCopy: n ? Math.round(copyDmg / n) : null, costMain: placed[0].spent, costCopies: placed.slice(1).reduce((s, p) => s + p.spent, 0), hp: r.hp, leakHp: r.leakHp, peakWaveDmg: r.peakWaveDmg, ms: Date.now() - t0 });
  }
} else if (MODE === 'hero') {
  for (const h of opt('hero', 'hikari,luna,nami,yoriko,seiran,kanna').split(',')) {
    const t0 = Date.now();
    const { sim, placed } = board({ stageId: SC.stage, towers: [], hero: { unitId: h, role: 'solo' } });
    const me = placed[placed.length - 1];
    const r = playWaves(sim, SC.waves, [me.uid], { heroUlt: !flag('no-ult') });
    emit({ mode: 'hero', scen: scenArg, stage: SC.stage, unitId: h, rarity: d.units[h].rarity, level: me.build, ...r, per: undefined, ms: Date.now() - t0 });
  }
} else if (MODE === 'panel') {
  const core = parseList(opt('core', 'kage:5-2-0')).map((t) => ({ ...t, role: 'carry' }));
  const extra = parseList(opt('extra', '')).map((t) => ({ ...t, role: 'support' }));
  const heroId = opt('hero', null);
  const { sim, placed } = board({ stageId: SC.stage, towers: [...core, ...extra], hero: heroId ? { unitId: heroId, role: 'aura' } : null });
  const me = placed[0];
  const before = sim.towerStats(me.uid).dps;
  const r = playWaves(sim, opt('wave', '150').split(',').map(Number), [me.uid], { heroUlt: !!heroId, panelUid: me.uid, covPlaced: placed });
  emit({ mode: 'panel', stage: SC.stage, core: core.map((t) => `${t.unitId} ${t.build}`), extra: extra.map((t) => `${t.unitId} ${t.build}`), hero: heroId, rolls: ROLLS, club: CLUB, panelPlaced: Math.round(before), panel: r.panel, dealt: r.total, waves: r.waves, cov: r.cov });
} else {
  console.error('mode: solo | team | copies | hero | panel');
  process.exit(2);
}
console.error(`done in ${Math.round((Date.now() - t00) / 1000)} s`);
