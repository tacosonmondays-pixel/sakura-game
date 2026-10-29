// Hit DPS bench (docs/specs/TRYOUT_DAY.md §9.3): real damage dealt per second, not panel DPS. One girl (one
// copy) on a long dummy stream of the real Sim; `sim.stats.damageByTower[uid]` over the measured seconds after a
// warm-up, so crits, chains, splash, statuses, the seat's padMul and rule pulses all count.
// Run through tools/bench.mjs:
//
//   node --import ./tools/simLoader.mjs tools/bench.mjs --hit [girls…] [--stage 4-5] [--preset strong|maxed|ceiling]
//        [--builds p0t5,p1t5,p2t5] [--targets crowd,boss] [--seed 9] [--run 30] [--warm 10] [--hp 1e6] [--json]
//   node --import ./tools/simLoader.mjs tools/bench.mjs --hit --ceiling [girls…] [--no-talents] [--talents-only]
//        [--hand all|personal] [--vs] [--no-crit] [--no-range] [--maxed plain|kit|geared] [--builds best|all|p0t5,…] [--stage 6-1] …
//
// --ceiling (the M2 gate): each Tryout student at the run ceiling against the same girl fully maxed, both on the
// same Prism Conduits pad (6-1). Ceiling: account stats at the band cap (bandStats of an over-cap account at the
// last Run Level), `t.runMods` = the real card fold (src/sim/tryout/pep.js runModsFor) of a hand that hits every
// capped family she can reach (damage +100 %, rate +50 %, range +1.0, crit +20 % / +0.5, pierce, splash, … see capFold),
// seat padMul = min(1 + seat cap, runDamage cap / card factor) with the seat reach at its cap. Maxed: DEFAULT
// unit stats with damageMul 7.57 / rateMul 3.10 (--maxed-kit also gives her the ceiling's kit: awakening passive,
// Potential 3; --maxed geared: every other account key at the band cap as well), on the pad at Prism's own padMul
// 1.25 / reach +0.7. --no-range drops the range cards and keeps the seat reach at Prism's +0.7 (damage only). Each shipping Hidden Talent (PEP_CARDS
// `ship`) is measured too: the talent card at SSR added to the same hand, so the Sim's own fold appends its raw set.
// Builds: `best` (default) = the path whose tier-5 build (tier-2 crosspath) gives the maxed girl the most hit
// DPS; `all` = every path at tier 5. A row fails when ceiling / maxed > 1 (or above its CEILING_EXCEPTIONS entry) or
// ceiling > 2.5M × 1.25; exit 1.
import { Sim } from '../src/sim/Sim.js';
import { defaultData } from '../src/sim/data.js';
import { samplePath } from '../src/sim/path.js';
import { withDetMath } from '../src/core/detMath.js';
import { DEFAULT_UNIT_STATS } from '../src/sim/constants.js';
import { TRYOUT, TRYOUT_STUDENTS, PEP_CARDS } from '../src/data/tryout.js';
import { bandStats } from '../src/sim/tryout/power.js';
import { runModsFor, cardFactor, pairSide } from '../src/sim/tryout/pep.js';

const CROSS = [2, 0, 0];
const MAXED = Object.freeze({ ...DEFAULT_UNIT_STATS, damageMul: 7.57, rateMul: 3.10 });
const MAXED_KIT = Object.freeze({ ...MAXED, awakenPassive: true, awaken: 3, level: 85, potential: 3 });
// --maxed geared: the maxed girl with every other account key at the band cap too (a maxed girl's gear and kit are
// at least a Lv 60 geared girl's), so only damage / rate (account) and the run's cards and seat differ
const maxedGeared = () => Object.freeze({ ...bandStats(OVER_CAP, TRYOUT.runLevel.last), damageMul: 7.57, rateMul: 3.10 });
/** An account above the band cap on every key: bandStats clamps it to the cap. */
const OVER_CAP = Object.freeze({
  ...DEFAULT_UNIT_STATS, damageMul: 7.57, rateMul: 3.10, rangeMul: 1.3, critChance: 0.5, critMul: 2.5, armorPen: 10, costMul: 0.7,
  ultHaste: 0.3, pierceK: 100, auraPct: 0.3, auraRangeMul: 1.3, dotMul: 1.5, awakenPassive: true, level: 85, awaken: 3, potential: 6,
});
const lv = (L, bt, st) => 1 + 0.018 * (L - 1) + 0.02 * bt + 0.05 * st;
const rt = (L) => 1 + 0.004 * (L - 1);
const STRONG = { ...DEFAULT_UNIT_STATS, damageMul: +(lv(60, 5, 3) * 1.45).toFixed(4), rateMul: +(rt(60) * 1.2).toFixed(4), critChance: 0.25, critMul: 1.3, armorPen: 1, awakenPassive: true, level: 60, awaken: 3 };
/** A Personal-card hand whose capped fold reaches every capped family (LR = × 3). */
const CAP_HAND = ['P01', 'P01', 'P01', 'P02', 'P02', 'P03', 'P03', 'P05', 'P05'];
const SEAT_PAD = 1.25; // Prism Conduits' own padDmgMul (src/data/rules.js)
const SEAT_REACH = 0.7;
const ABS_CAP = 2.5e6 * 1.25;
// Recorded exceptions to `ceiling / maxed ≤ 1` (girl or girl|talent → the highest ratio allowed): the attack shapes'
// Blade Cyclone (S1) lifts Kage's run-ceiling crowd DPS (×1.185, ×1.584 with T_kage; ×0.75 / ×0.99 on v0.1.60). The
// coordinator's call, Oct 29, under the owner's "no cap, everyone close to Kage": accepted, Kage is not trimmed; Tryout
// difficulty is watched on the sweeps instead (docs/BALANCE.md "Balance round 5").
export const CEILING_EXCEPTIONS = Object.freeze({ kage: 1.2, 'kage|T_kage': 1.6 });
const ADD = new Set(['range', 'projectiles', 'pierce', 'chain', 'maxTargets', 'splash', 'armorPen', 'projectileSpeed', 'silence', 'reveal', 'knockback', 'gather']);

export function ceilingStats() {
  return bandStats(OVER_CAP, TRYOUT.runLevel.last);
}

/**
 * The capped card fold at the cap for one girl: the real pep.js runModsFor over a hand that maxes every family she
 * can reach. hand 'all' (default): three LR copies of every shipping Everyone, Group and Personal card, plus the
 * shipping build and capstone cards (each at its rarity), plus her Hidden Talent at SSR when `talent` names it;
 * hand 'personal': only Personal damage / speed / reach / crit cards. Returns `t.runMods` (one ModSet, or
 * [fold, raw talent set] once a talent is in hand). crit / range false strip those keys from the fold afterwards.
 */
export function capFold(data, unitId, { crit = true, range = true, hand = 'all', talent = null, vs = false } = {}) {
  const cards = [];
  const def = data.units[unitId];
  if (hand === 'personal') for (const id of CAP_HAND) cards.push({ id, unit: unitId, r: 4 });
  else {
    for (const [id, c] of Object.entries(PEP_CARDS)) {
      if (!c.ship) continue;
      // a "vs" bonus only moves damage around inside the ×2.5 cards × seat clamp and lowers it against every other
      // foe: left out unless asked (`vs`), so the hand is the most a girl deals to the dummy stream
      if (!vs && c.mods && ['airMul', 'eliteMul', 'bossMul', 'barrierMul', 'classMul'].some((k) => k in c.mods)) continue;
      if (['everyone', 'group', 'personal'].includes(c.group)) for (let i = 0; i < 3; i++) cards.push({ id, unit: unitId, r: Math.max(...c.rar) });
      // a pair card only when she is in one of its halves (else it is only her drawback)
      else if (['build', 'capstone'].includes(c.group) && (!c.pair || c.pair.some((h) => pairSide(def, h)))) cards.push({ id, unit: unitId, r: c.rar[0] });
    }
  }
  if (talent) cards.push({ id: talent, unit: unitId, r: 2 });
  const view = typeof data.unit === 'function' ? data : { ...data, unit: (id) => data.units[id] };
  const out = runModsFor({ data: view, tryout: { players: [{ cards, varsity: {} }], bell: 0 }, towers: [] }, 0, unitId, false);
  const fold = Array.isArray(out) ? out[0] : out;
  if (fold && !crit) delete fold.crit;
  if (fold && !range) delete fold.range;
  return out;
}

/** The seat the ceiling girl sits on: padMul clamped by her cards (§4.4, pep.js cardFactor), reach at its cap. */
export function ceilingSeat(runMods) {
  const s = TRYOUT.seats;
  return { padMul: Math.min(1 + s.dmgCap, Math.max(1, TRYOUT.caps.runDamage / cardFactor({ runMods }))), padRangeAdd: s.reachCap };
}

/**
 * One measured run. `pad`: stand inside a stage pad (and override padMul / padRangeAdd when given).
 * @returns {{ hitDps, panelDps, kills, tiers, padMul, onPad, error? }}
 */
export function measure({ d, unitId, stats, build, stageId, seed = 9, warm = 10, run = 30, target = 'crowd', hp = 1e6, bossHp = 3e7, pad = false, runMods = null, padMul = null, padRangeAdd = null }) {
  const def = d.units[unitId];
  const sim = withDetMath(() => new Sim({ stageId, loadout: [{ unitId, stats }], hero: null, seed }));
  sim.cash = 1e15;
  sim.lives = 1e15;
  const path = sim.pathData[0];
  const samples = samplePath(path, 0.5).filter((s) => !s.hidden);
  const r = Math.min(4, def.base.range || 3);
  const cov = (c) => samples.reduce((a, s) => a + ((s.x - c.x) ** 2 + (s.y - c.y) ** 2 <= r * r ? 1 : 0), 0);
  let out = null;
  withDetMath(() => {
    const lattice = [];
    for (let y = 0.3; y < sim.map.height; y += 0.25) for (let x = 0.3; x < sim.map.width; x += 0.25) lattice.push({ x: x + 0.013, y: y + 0.007 });
    const pads = sim.rule?.pads || [];
    const inPad = (c) => pads.some((p) => (c.x - p.x) ** 2 + (c.y - p.y) ** 2 <= p.r * p.r * 0.95);
    const cand = (pad ? lattice.filter(inPad) : lattice).map((c) => ({ ...c, cov: cov(c) })).sort((a, b) => b.cov - a.cov);
    const spot = cand.find((c) => sim.canPlace(unitId, c.x, c.y).ok);
    if (!spot) {
      out = { error: pad ? 'no pad spot' : 'no spot' };
      return;
    }
    const t = sim.placeTower(unitId, spot.x, spot.y);
    const [mp, mt] = build;
    for (let i = 0; i < 2; i++) sim.upgradeTower(t.uid, CROSS[mp]);
    for (let i = 0; i < mt; i++) sim.upgradeTower(t.uid, mp);
    if (pad && !t.onPad) {
      out = { error: 'not on a pad' };
      return;
    }
    if (runMods || padMul != null) {
      if (runMods) t.runMods = runMods;
      if (padMul != null) t.padMul = padMul;
      if (padRangeAdd != null) t.padRangeAdd = padRangeAdd;
      sim._refreshTower(t);
    }
    sim.update(0.5);
    const panel = sim.towerStats(t.uid);
    const enemyHp = (id) => sim.data.enemy(id)?.hp || 1;
    const near = samples.reduce((b, s) => {
      const dd = (s.x - spot.x) ** 2 + (s.y - spot.y) ** 2;
      return dd < b.d ? { d: dd, s } : b;
    }, { d: 1e9 }).s;
    const dealt = () => sim.stats.damageByTower[t.uid] || 0;
    let d0 = 0;
    let k0 = 0;
    for (let step = 0; step < (warm + run) * 60; step++) {
      if (target === 'crowd' && step % 6 === 0) sim.spawnEnemy('orc_grunt', { pathIndex: 0, dist: 0, hpMul: hp / enemyHp('orc_grunt') });
      if (target === 'boss' && !sim.enemies.some((e) => !e.dead && e.id === 'dragon_ashwing')) {
        const e = sim.spawnEnemy('dragon_ashwing', { pathIndex: 0, dist: 0, hpMul: bossHp / enemyHp('dragon_ashwing') });
        e.dist = Math.max(0, (near.dist ?? 0) - 1.5);
      }
      if (sim.state !== 'wave') sim.state = 'wave';
      sim.update(1 / 60);
      sim.drainEvents();
      for (const e of sim.enemies) if (!e.dead) e.hp = e.maxHp;
      if (step === warm * 60) {
        d0 = dealt();
        k0 = t.kills || 0;
      }
    }
    out = {
      hitDps: Math.round((dealt() - d0) / run),
      panelDps: Math.round(panel?.dps ?? 0),
      kills: (t.kills || 0) - k0,
      tiers: t.tiers.join('-'),
      padMul: t.padMul ?? 1,
      onPad: !!t.onPad,
    };
  });
  return out;
}

const parseBuild = (b) => {
  const m = /^p(\d)t(\d)$/.exec(b);
  if (!m) throw new Error(`bad build ${b}`);
  return [+m[1], +m[2]];
};
const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));

export async function main(argv) {
  const VALUED = ['--stage', '--seed', '--builds', '--targets', '--preset', '--run', '--warm', '--hp', '--maxed', '--hand'];
  const opt = (k, dflt) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : dflt);
  const names = argv.filter((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1]));
  const json = argv.includes('--json');
  const d = defaultData();
  const common = { d, seed: Number(opt('seed', 9)), run: Number(opt('run', 30)), warm: Number(opt('warm', 10)), hp: Number(opt('hp', 1e6)) };
  const targets = opt('targets', 'crowd').split(',');
  const t0 = Date.now();

  if (!argv.includes('--ceiling')) {
    const preset = opt('preset', 'strong');
    const stats = preset === 'maxed' ? MAXED : preset === 'ceiling' ? ceilingStats() : STRONG;
    const girls = names.length ? names : TRYOUT_STUDENTS;
    const builds = opt('builds', 'p0t5,p1t5,p2t5').split(',');
    const stageId = opt('stage', '4-5');
    for (const unitId of girls) {
      for (const b of builds) {
        for (const target of targets) {
          const r = measure({ ...common, unitId, stats, build: parseBuild(b), stageId, target });
          const row = { unitId, build: b, target, preset, stage: stageId, ...r };
          console.log(json ? JSON.stringify(row) : `${unitId} ${b} ${target}: hit ${r.error ?? fmt(r.hitDps)} (panel ${fmt(r.panelDps ?? 0)}, ${r.tiers ?? ''}, kills ${r.kills ?? '-'})`);
        }
      }
    }
    if (!json) console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s`);
    return 0;
  }

  // ---- --ceiling: the M2 gate ----
  const stageId = opt('stage', '6-1');
  const crit = !argv.includes('--no-crit');
  const noRange = argv.includes('--no-range');
  const hand = opt('hand', 'all');
  const maxedMode = opt('maxed', argv.includes('--maxed-kit') ? 'kit' : 'plain');
  const maxedStats = maxedMode === 'geared' ? maxedGeared() : maxedMode === 'kit' ? MAXED_KIT : MAXED;
  const ceil = ceilingStats();
  const buildsOpt = opt('builds', 'best');
  const talentsOnly = argv.includes('--talents-only');
  const girls = names.length ? names : TRYOUT_STUDENTS;
  const talents = argv.includes('--no-talents') ? [] : Object.entries(PEP_CARDS)
    .filter(([, c]) => c.group === 'talent' && c.ship && girls.includes(c.unit)).map(([id, c]) => ({ id, unit: c.unit, mods: c.mods }));
  const rows = [];
  const cases = [];
  for (const unitId of girls) {
    if (!talentsOnly) cases.push({ unitId, talent: null });
    for (const tl of talents) if (tl.unit === unitId) cases.push({ unitId, talent: tl });
  }
  const bestCache = new Map();
  const maxedCache = new Map();
  const maxedRun = (unitId, b, target) => {
    const k = `${unitId}|${b}|${target}`;
    if (!maxedCache.has(k)) maxedCache.set(k, measure({ ...common, unitId, stats: maxedStats, build: parseBuild(b), stageId, target, pad: true }));
    return maxedCache.get(k);
  };
  let fails = 0;
  for (const { unitId, talent } of cases) {
    for (const target of targets) {
      let builds;
      if (buildsOpt === 'all') builds = ['p0t5', 'p1t5', 'p2t5'];
      else if (buildsOpt === 'best') {
        const k = `${unitId}|${target}`;
        if (!bestCache.has(k)) {
          let best = null;
          for (const b of ['p0t5', 'p1t5', 'p2t5']) {
            const r = maxedRun(unitId, b, target);
            if (!r.error && (!best || r.hitDps > best.r.hitDps)) best = { b, r };
          }
          bestCache.set(k, best ? best.b : 'p0t5');
        }
        builds = [bestCache.get(k)];
      } else builds = buildsOpt.split(',');
      for (const b of builds) {
        const ts = Date.now();
        const mx = maxedRun(unitId, b, target);
        const runMods = capFold(d, unitId, { crit, range: !noRange, hand, talent: talent?.id, vs: argv.includes('--vs') });
        const seat = ceilingSeat(runMods);
        if (noRange) seat.padRangeAdd = SEAT_REACH;
        const ce = measure({ ...common, unitId, stats: ceil, build: parseBuild(b), stageId, target, pad: true, runMods, padMul: seat.padMul, padRangeAdd: seat.padRangeAdd });
        const err = mx.error || ce.error;
        const ratio = err || !mx.hitDps ? NaN : ce.hitDps / mx.hitDps;
        const allow = CEILING_EXCEPTIONS[talent ? `${unitId}|${talent.id}` : unitId] ?? 1;
        const ok = !err && (ratio <= allow || !mx.hitDps && !ce.hitDps) && ce.hitDps <= ABS_CAP;
        const excepted = ok && ratio > 1;
        const unknown = talent ? Object.keys(talent.mods).filter((k) => !KNOWN.has(k)) : [];
        const row = {
          unitId, talent: talent?.id ?? null, build: b, target, ceilingDps: ce.hitDps, maxedDps: mx.hitDps, ratio: Number.isFinite(ratio) ? +ratio.toFixed(3) : null,
          ceilingPanel: ce.panelDps, maxedPanel: mx.panelDps, padMul: +seat.padMul.toFixed(3), maxedPadMul: mx.padMul, kills: [ce.kills, mx.kills], tiers: ce.tiers,
          ok, excepted: excepted || undefined, error: err || undefined, runMods, unknownKeys: unknown.length ? unknown : undefined, ms: Date.now() - ts,
        };
        if (!ok) fails++;
        rows.push(row);
        if (json) console.log(JSON.stringify(row));
      }
    }
  }
  if (!json) {
    console.log(`Hit DPS at the run ceiling vs fully maxed on a Prism pad (stage ${stageId}, ${targets.join('+')}, warm ${common.warm} s + ${common.run} s, foe HP ${fmt(common.hp)}, hand ${hand}, crit cards ${crit ? 'on' : 'off'}, maxed ${maxedMode}${noRange ? ', no range cards, Prism seat reach' : ''})`);
    console.log(`ceiling stats: damage ×${ceil.damageMul} rate ×${ceil.rateMul} range ×${ceil.rangeMul} crit ${ceil.critChance}/${ceil.critMul}; maxed: ×${maxedStats.damageMul} / ×${maxedStats.rateMul}, pad ×${SEAT_PAD} +${SEAT_REACH}`);
    console.log('| girl | talent | build | target | ceiling hit DPS | maxed-on-pad hit DPS | ratio | seat padMul | ≤ 3.125M | ok |');
    console.log('|---|---|---|---|---:|---:|---:|---:|---|---|');
    for (const r of rows) {
      console.log(`| ${r.unitId} | ${r.talent ?? '–'}${r.unknownKeys ? ` (ignored keys: ${r.unknownKeys.join(',')})` : ''} | ${r.build} ${r.tiers ?? ''} | ${r.target} | ${r.error ?? fmt(r.ceilingDps)} | ${fmt(r.maxedDps ?? 0)} | ${r.ratio ?? '–'} | ${r.padMul} | ${r.ceilingDps <= ABS_CAP ? 'yes' : 'NO'} | ${r.excepted ? 'ok (recorded exception)' : r.ok ? 'ok' : 'FAIL'} |`);
    }
    const rs = rows.filter((r) => r.ratio != null).map((r) => r.ratio);
    console.log(`${rows.length} rows, ${fails} failing; ratio max ${Math.max(...rs).toFixed(3)}, mean ${(rs.reduce((a, b) => a + b, 0) / Math.max(1, rs.length)).toFixed(3)}; ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  return fails ? 1 : 0;
}

/** ModSet keys mods.js applyModSet understands (a talent key outside these is silently ignored by the Sim). */
const KNOWN = new Set([...ADD, 'damage', 'damageMul', 'rateMul', 'eliteMul', 'bossMul', 'barrierMul', 'airMul', 'canHitAir', 'detection', 'attackType', 'element', 'behavior',
  'status', 'crit', 'aura', 'income', 'trap', 'strip', 'ring', 'drink', 'sentry', 'ball', 'vine', 'hub', 'blade', 'turret', 'ramp', 'mark', 'brew', 'link', 'hpPct', 'lab', 'well',
  'lastLine', 'relay', 'statusAdd', 'proc', 'ult', 'bountyAura', 'harvest', 'dotSpread', 'keepRamp', 'projScale', 'tempo', 'classMul', 'dotMul', 'auraBoost']);
