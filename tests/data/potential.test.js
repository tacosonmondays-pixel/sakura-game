// Potential v3 data (src/data/potential.js; docs/specs/POTENTIAL.md v3 §3, §5, §7, §13.2): a full
// five-step row with a name for every girl, names that clash with nothing, kinds by rarity, the
// allowlist and the bans, one-girl keys, every §3.4 ceiling, climbing stat tracks, one rhythm per
// girl, echo only where it works, every step effective on every reference build, and the fold.
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  POTENTIAL_VERSION, MAX_POTENTIAL, POTENTIAL_GIRL_KEYS, POTENTIAL_MOD_KEYS, POTENTIAL_WHOLE_KEYS, POTENTIAL_GIRL_ONLY,
  POTENTIAL_LADDERS, POTENTIAL_SIGNATURE_DEFAULT, POTENTIAL_GIRLS, POTENTIAL_TRACK_OF,
  potentialSteps, potentialFold, potentialRow, potentialRarity, potentialTrack,
} from '../../src/data/potential.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { STAGES } from '../../src/data/stages.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { BATTLE_MODES } from '../../src/data/modes.js';
import { resolveStats } from '../../src/sim/mods.js';

const ROOT = join(import.meta.dirname, '../..');
const STEPS = ['p2', 'p3', 'p4', 'p5', 'p6'];

/** Flat ModSet keys: nested objects as "a.b", except the whole-object keys (proc, ult, statusAdd …). */
function modKeys(mods) {
  const out = [];
  for (const [k, v] of Object.entries(mods || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && !POTENTIAL_WHOLE_KEYS.includes(k)) for (const k2 of Object.keys(v)) out.push(`${k}.${k2}`);
    else out.push(k);
  }
  return out;
}

/** The merged rhythm of a row up to step `upTo` (later fields replace, statuses merge by type). */
function mergedProc(steps, upTo = MAX_POTENTIAL) {
  let p = null;
  for (const s of steps) {
    if (s.step > upTo || !s.mods?.proc) continue;
    p = { ...(p || {}), ...s.mods.proc, status: [...(p?.status || []), ...(s.mods.proc.status || [])] };
  }
  return p;
}

/** The stat part of a step on her track (spec §3.1): the girl multiplier, or her aura's, or her coins. */
function statOf(def, s) {
  const track = potentialTrack(def);
  if (track === 'coins') return s.girl?.incomeMul ?? 1;
  if (track === 'aura') return s.mods?.aura?.dmgMul ?? s.mods?.aura?.rateMul ?? 1;
  return (s.girl?.damageMul ?? 1) * (s.girl?.rateMul ?? 1);
}

function isDeepFrozen(o) {
  if (!o || typeof o !== 'object') return true;
  return Object.isFrozen(o) && Object.values(o).every(isDeepFrozen);
}

function walk(dir) {
  let out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

/** Reference builds (spec §3.2): tier 0, every path 4/2 and 5/2; heroes Lv 1 / 10 / 25. */
function builds(u) {
  if (u.kind === 'hero') return [1, 10, 25].map((heroLevel) => ({ tiers: [0, 0, 0], heroLevel, label: `Lv ${heroLevel}` }));
  const out = [{ tiers: [0, 0, 0], heroLevel: 0, label: '0-0-0' }];
  for (let p = 0; p < 3; p++) {
    for (const [a, b] of [[4, 2], [5, 2]]) {
      for (let q = 0; q < 3; q++) {
        if (q === p) continue;
        const tiers = [0, 0, 0];
        tiers[p] = a;
        tiers[q] = b;
        out.push({ tiers, heroLevel: 0, label: tiers.join('-') });
      }
    }
  }
  return out;
}

/** Every field a step can change that a girl's behaviour reads (her kit part, not damage / rate). */
function kitFields(s) {
  const f = {
    pierce: s.pierce, chain: s.chain, maxTargets: s.maxTargets, armorPen: s.armorPen, canHitAir: s.canHitAir, silence: s.silence,
    crit: s.crit.chance, bossMul: s.bossMul, status: s.status, mark: s.mark, ramp: s.ramp, trap: s.trap && [s.trap.max, s.trap.status],
    turret: s.turret && [s.turret.max, s.turret.range, s.turret.status, s.turret.overclock], aura: s.aura, brew: s.brew?.targets, link: s.link?.targets,
    proc: s.proc, ult: s.ult, bountyAura: s.bountyAura, harvest: s.harvest, dotSpread: s.dotSpread, keepRamp: s.keepRamp,
    projScale: s.projScale, tempo: s.tempo, classMul: s.classMul,
    // the new girls' own blocks (UNIT_GAPS §5)
    strip: s.strip, ring: s.ring, drink: s.drink, sentry: s.sentry, hub: s.hub, vine: s.vine, ball: s.ball,
    // Kaede's blade arts (her AoE rework)
    blade: s.blade,
    // the duo's beam and prism (src/sim/duo.js)
    duo: s.duo,
    // the staff heroes (BANNERS §D): Norika's barricades and skill count, Kogane's Move downtime and Overdrive
    barricade: s.barricade, skillCount: s.skillCount, moveDowntime: s.moveDowntime, overdrive: s.overdrive,
  };
  return JSON.stringify(f);
}

describe('Potential v3 data: rows', () => {
  test('version 3; every girl has her own full row: five named steps P2…P6', () => {
    expect(POTENTIAL_VERSION).toBe(3);
    expect(MAX_POTENTIAL).toBe(6);
    for (const u of UNITS) {
      const row = POTENTIAL_GIRLS[u.id];
      expect(row, u.id).toBeTruthy();
      expect(Object.keys(row).sort(), u.id).toEqual(STEPS);
      const steps = potentialSteps(u);
      expect(steps.map((s) => s.step)).toEqual([2, 3, 4, 5, 6]);
      for (const s of steps) {
        expect(typeof s.name === 'string' && s.name.length >= 3, `${u.id} P${s.step} name`).toBe(true);
        expect(!!(s.girl || s.mods), `${u.id} P${s.step} empty`).toBe(true);
        expect(Object.keys(row[`p${s.step}`]).sort(), `${u.id} P${s.step} shape`).toEqual(['girl', 'kind', 'mods', 'name']);
      }
    }
    // no row for a girl who does not exist (a kit variant is `id@kitStyle`)
    for (const id of Object.keys(POTENTIAL_GIRLS)) expect(UNIT_MAP[id.split('@')[0]], id).toBeTruthy();
    expect(Object.keys(POTENTIAL_GIRLS).length).toBe(UNITS.length); // one row per girl (no kit-variant rows yet)
  });

  test('kind per step matches the rarity table (heroes, Nami included, use the SSR kinds)', () => {
    expect(POTENTIAL_LADDERS.kinds).toEqual({ R: ['stat', 'kit', 'kit', 'kit', 'cap'], SR: ['stat', 'kit', 'kit', 'kit', 'cap'], SSR: ['kit', 'kit', 'kit', 'kit', 'cap'] });
    for (const u of UNITS) {
      const kinds = POTENTIAL_LADDERS.kinds[potentialRarity(u)];
      expect(potentialSteps(u).map((s) => s.kind), u.id).toEqual(kinds);
      // a stat step has no kit part; every kit / cap step has one
      for (const s of potentialSteps(u)) {
        const kit = modKeys(s.mods).filter((k) => !(potentialTrack(u) === 'aura' && (k === 'aura.dmgMul' || k === 'aura.rateMul')));
        if (s.kind === 'stat') expect(kit, `${u.id} P${s.step}`).toEqual([]);
        else expect(kit.length, `${u.id} P${s.step} has no kit part`).toBeGreaterThan(0);
      }
    }
    expect(potentialRarity(UNIT_MAP.nami)).toBe('SSR');
    expect(potentialRarity(UNIT_MAP.kage)).toBe('SR');
    expect(potentialRarity(UNIT_MAP.aoi)).toBe('R');
  });

  test('step names are unique and clash with no other name in the game', () => {
    const names = Object.values(POTENTIAL_GIRLS).flatMap((row) => STEPS.map((k) => row[k].name));
    expect(names.length).toBe(UNITS.length * STEPS.length); // five steps per girl
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
    const taken = new Set();
    const add = (n) => { if (typeof n === 'string' && n) taken.add(n.toLowerCase()); };
    for (const u of UNITS) {
      add(u.name);
      add(u.title);
      add(u.awakenPassive?.name);
      for (const p of u.paths || []) {
        add(p.name);
        for (const t of p.tiers) add(t.name);
      }
      if (u.hero) {
        add(u.hero.ult?.name);
        for (const l of u.hero.levels || []) add(/^([^:]+):/.exec(l.desc || '')?.[1]);
      }
    }
    for (const s of STAGES) add(s.name);
    for (const e of ENEMIES) add(e.name);
    for (const m of Object.values(BATTLE_MODES)) add(m.name);
    for (const n of names) expect(taken.has(n.toLowerCase()), `${n} is taken`).toBe(false);
    // Codex modes and map rules (display text), and every battle-feed / banner string: case-insensitive
    const ui = [...walk(join(ROOT, 'src/ui/battle')), ...walk(join(ROOT, 'src/ui/text'))].map((f) => readFileSync(f, 'utf8').toLowerCase());
    for (const n of names) for (const txt of ui) expect(txt.includes(n.toLowerCase()), `${n} appears in a battle / mode string`).toBe(false);
    // story text: never as a name (case-sensitive; "the shrine steps" in a narration is not one)
    const story = walk(join(ROOT, 'src/data/story')).map((f) => readFileSync(f, 'utf8'));
    for (const n of names) for (const txt of story) expect(txt.includes(n), `${n} appears in the story`).toBe(false);
    // the names the critic pass replaced stay replaced
    expect(POTENTIAL_GIRLS.shiro.p6.name).toBe('White Heron');
    expect(POTENTIAL_GIRLS.chika.p2.name).toBe('Throttle Up');
  });

  test('tables are deep-frozen', () => {
    expect(isDeepFrozen(POTENTIAL_LADDERS)).toBe(true);
    expect(isDeepFrozen(POTENTIAL_SIGNATURE_DEFAULT)).toBe(true);
    expect(isDeepFrozen(POTENTIAL_GIRLS)).toBe(true);
    expect(isDeepFrozen(POTENTIAL_GIRL_ONLY)).toBe(true);
    expect(isDeepFrozen(POTENTIAL_TRACK_OF)).toBe(true);
  });
});

describe('Potential v3 data: keys', () => {
  test('only allowlisted keys appear; the banned keys are not on the list', () => {
    for (const row of Object.values(POTENTIAL_GIRLS)) {
      for (const k of STEPS) {
        const s = row[k];
        for (const g of Object.keys(s.girl || {})) expect(POTENTIAL_GIRL_KEYS, g).toContain(g);
        for (const m of modKeys(s.mods)) expect(POTENTIAL_MOD_KEYS, `${s.name}: ${m}`).toContain(m);
      }
    }
    const banned = [{ behavior: 'beam' }, { attackType: 'holy' }, { element: 'fire' }, { knockback: 1 }, { aura: { costCut: 0.1 } }, { costCut: 0.1 },
      { hpPct: { pct: 0.01 } }, { damage: 1 }, { range: 0.1 }, { projectiles: 1 }, { income: { perWave: 2 } }, { splash: 0.1 }, { status: [] },
      { eliteMul: 1.1 }, { crit: { mul: 2 } }, { trap: { damage: 1 } }, { turret: { damage: 1 } }];
    for (const bad of banned) expect(modKeys(bad).every((k) => POTENTIAL_MOD_KEYS.includes(k)), JSON.stringify(bad)).toBe(false);
  });

  test('one-girl keys: projScale and tempo Kage, classMul Hotaru (spectral only), bossMul Kaede, the Move keys Kogane, skillCount Norika', () => {
    const seen = {};
    for (const [id, row] of Object.entries(POTENTIAL_GIRLS)) {
      for (const k of STEPS) {
        for (const key of Object.keys(POTENTIAL_GIRL_ONLY)) {
          if (row[k].mods?.[key] == null) continue;
          expect(POTENTIAL_GIRL_ONLY[key], `${id} uses ${key}`).toContain(id.split('@')[0]);
          (seen[key] ||= new Set()).add(id);
        }
        const cm = row[k].mods?.classMul;
        if (cm) expect(Object.keys(cm)).toEqual(['spectral']);
      }
    }
    expect(Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v]]))).toEqual({ projScale: ['kage'], tempo: ['kage'], classMul: ['hotaru'], bossMul: ['kaede'], moveDowntime: ['kogane'], overdrive: ['kogane'], skillCount: ['norika'] });
  });

  test('projScale only where every build is a projectile attack; echo only on projectile / beam / chain / pulse (a duel only at a share < 1; never traps)', () => {
    for (const u of UNITS) {
      const steps = potentialSteps(u);
      const echo = mergedProc(steps)?.echo;
      const scale = steps.some((s) => s.mods?.projScale);
      for (const b of builds(u)) {
        const s = resolveStats(u, { tiers: b.tiers, heroLevel: b.heroLevel, unitStats: { potential: 6 } });
        if (scale) expect(s.behavior, `${u.id} ${b.label}`).toBe('projectile');
        if (echo == null) continue;
        expect(s.proc.of, u.id).not.toBe('trap');
        if (s.behavior === 'duel') expect(typeof echo === 'number' && echo < 1, `${u.id} ${b.label} duel echo`).toBe(true);
        else expect(['projectile', 'beam', 'chain', 'pulse'], `${u.id} ${b.label}`).toContain(s.behavior);
      }
      for (const s of steps) {
        const e = s.mods?.proc?.echo;
        if (e != null) expect(e === true || (typeof e === 'number' && e > 0 && e < 1), `${u.id} P${s.step} echo ${e}`).toBe(true);
      }
    }
  });

  test('one rhythm per girl: the step that introduces it names it, later steps upgrade it', () => {
    for (const u of UNITS) {
      const steps = potentialSteps(u);
      const procs = steps.filter((s) => s.mods?.proc);
      if (!procs.length) continue;
      const named = procs.filter((s) => s.mods.proc.name);
      expect(named.length, u.id).toBe(1);
      expect(named[0], u.id).toBe(procs[0]);
      expect(procs[0].mods.proc.every, `${u.id}: the first rhythm step sets every`).toBeGreaterThan(0);
      // "every Nth" only ever shortens
      let every = Infinity;
      for (const s of procs) {
        if (s.mods.proc.every == null) continue;
        expect(s.mods.proc.every, `${u.id} P${s.step}`).toBeLessThanOrEqual(every);
        every = s.mods.proc.every;
      }
    }
  });
});

describe('Potential v3 data: stat tracks and ceilings (§3.1, §3.4)', () => {
  test('the stat tracks: non-decreasing, the products of the spec', () => {
    const prod = (a) => a.reduce((p, x) => p * x, 1);
    const T = POTENTIAL_LADDERS.statTrack;
    for (const [k, track] of Object.entries(T)) {
      expect(track.length, k).toBe(5);
      for (let i = 1; i < 5; i++) expect(track[i], `${k} P${i + 2}`).toBeGreaterThanOrEqual(track[i - 1]);
    }
    expect(prod(T.R)).toBeCloseTo(1.228, 3);
    expect(prod(T.SR)).toBeCloseTo(1.3005, 3);
    expect(prod(T.SSR)).toBeCloseTo(1.415, 3);
    expect(prod(T.nami)).toBeCloseTo(1.288, 3);
    expect(prod(T.aura)).toBeCloseTo(1.159, 3);
    expect(prod(T.coins)).toBeCloseTo(1.193, 3);
    // the step slots climb: every step bigger than the one before
    for (const [k, slots] of Object.entries(POTENTIAL_LADDERS.stepSlot)) for (let i = 1; i < 5; i++) expect(slots[i], `${k} slot P${i + 2}`).toBeGreaterThan(slots[i - 1]);
    expect(prod(POTENTIAL_LADDERS.stepSlot.R)).toBeCloseTo(1.59, 2);
    expect(prod(POTENTIAL_LADDERS.stepSlot.SR)).toBeCloseTo(1.83, 2);
    expect(prod(POTENTIAL_LADDERS.stepSlot.SSR)).toBeCloseTo(2.28, 2);
  });

  test('every girl spends exactly her track, one stat key a step, and the number under a node never shrinks', () => {
    expect(potentialTrack(UNIT_MAP.nami)).toBe('nami');
    expect(potentialTrack(UNIT_MAP.umeko)).toBe('aura');
    expect(potentialTrack(UNIT_MAP.momo)).toBe('coins');
    expect(potentialTrack(UNIT_MAP.hikari)).toBe('SSR');
    for (const u of UNITS) {
      const track = POTENTIAL_LADDERS.statTrack[potentialTrack(u)];
      const steps = potentialSteps(u);
      let prev = 0;
      steps.forEach((s, i) => {
        const v = statOf(u, s);
        expect(v, `${u.id} P${s.step} stat`).toBe(track[i]);
        expect(v, `${u.id} P${s.step} shrinks`).toBeGreaterThanOrEqual(prev);
        prev = v;
        // R / SR / SSR / Nami tracks: exactly one of damageMul / rateMul carries it
        if (!['aura', 'coins'].includes(potentialTrack(u))) expect([s.girl?.damageMul, s.girl?.rateMul].filter((x) => x != null).length, `${u.id} P${s.step}`).toBe(1);
      });
    }
    // Miko's own talismans take the SR track next to her aura's
    expect(potentialSteps(UNIT_MAP.miko).map((s) => (s.girl.damageMul ?? 1) * (s.girl.rateMul ?? 1))).toEqual(POTENTIAL_LADDERS.statTrack.SR);
  });

  test('the §3.4 ceilings, summed over her five steps', () => {
    for (const u of UNITS) {
      const ssr = potentialRarity(u) === 'SSR' && u.rarity === 'SSR';
      const steps = potentialSteps(u);
      const prod = (f) => steps.reduce((p, s) => p * (f(s) ?? 1), 1);
      const sum = (f) => steps.reduce((p, s) => p + (f(s) || 0), 0);
      const statusSpecs = (s) => [...(s.mods?.statusAdd || []), ...(s.mods?.proc?.status || []), ...(s.mods?.ult?.status || []), ...(s.mods?.ult?.statusAdd || [])];
      const where = u.id;
      // stat-track product (damageMul × rateMul)
      const stat = prod((s) => s.girl?.damageMul) * prod((s) => s.girl?.rateMul);
      expect(stat, `${where} stat product`).toBeLessThanOrEqual(ssr ? 1.42 : u.rarity === 'R' ? 1.23 : 1.31);
      // her own armor pen; aura pen
      expect(sum((s) => s.mods?.armorPen), `${where} pen`).toBeLessThanOrEqual(ssr ? 4 : 3);
      expect(sum((s) => s.mods?.aura?.armorPen), `${where} aura pen`).toBeLessThanOrEqual(1);
      // Brittle + mark points (statusAdd, rhythm, ultimate, aura foeVuln)
      const points = sum((s) => statusSpecs(s).filter((x) => x.type === 'vulnerable' || x.type === 'mark').reduce((a, x) => a + (x.bonus || 0), 0) + (s.mods?.aura?.foeVuln || 0));
      expect(points * 100, `${where} Brittle + mark`).toBeLessThanOrEqual((ssr ? 20 : 15) + 1e-9);
      // income / DoT / aura track
      expect(prod((s) => s.girl?.incomeMul), `${where} income`).toBeLessThanOrEqual(1.20);
      expect(prod((s) => s.girl?.dotMul), `${where} dotMul`).toBeLessThanOrEqual(1.20);
      expect(prod((s) => s.mods?.aura?.dmgMul), `${where} aura dmg`).toBeLessThanOrEqual(1.16);
      expect(prod((s) => s.mods?.aura?.rateMul), `${where} aura rate`).toBeLessThanOrEqual(1.16);
      // shred amount; DoT % of max HP per second
      expect(sum((s) => statusSpecs(s).filter((x) => x.type === 'shred').reduce((a, x) => a + (x.amount || 0), 0)), `${where} shred`).toBeLessThanOrEqual(2);
      expect(sum((s) => statusSpecs(s).filter((x) => x.type === 'burn' || x.type === 'poison').reduce((a, x) => a + (x.pct || 0), 0)), `${where} DoT pct`).toBeLessThanOrEqual(0.0015);
      // repeats: echo share ÷ every plus a nova volley, at every P
      for (let p = 2; p <= MAX_POTENTIAL; p++) {
        const pr = mergedProc(steps, p);
        if (!pr) continue;
        const echo = pr.echo === true ? 1 : pr.echo || 0;
        const volley = pr.nova?.volley ? pr.nova.share ?? 1 : 0;
        expect((echo + volley) / pr.every, `${where} P${p} repeats`).toBeLessThanOrEqual(0.25);
      }
      // projScale, tempo, ult haste, brew / link targets
      expect(sum((s) => s.mods?.projScale), `${where} projScale`).toBeLessThanOrEqual(0.35);
      for (const s of steps) if (s.mods?.tempo) expect(s.mods.tempo.max, where).toBeLessThanOrEqual(0.10);
      expect(sum((s) => s.mods?.ult?.haste), `${where} ult haste`).toBeLessThanOrEqual(0.20 + 1e-12);
      expect(sum((s) => s.mods?.brew?.targetsAdd), `${where} brew +`).toBeLessThanOrEqual(1);
      expect(sum((s) => s.mods?.link?.targetsAdd), `${where} link +`).toBeLessThanOrEqual(1);
      // hard CC only on a rhythm, at least 0.3 s
      for (const s of steps) {
        for (const x of s.mods?.statusAdd || []) expect(['freeze', 'stun', 'shock'], `${where} P${s.step} hard CC outside a rhythm`).not.toContain(x.type);
        for (const x of s.mods?.proc?.status || []) if (['freeze', 'stun', 'shock'].includes(x.type)) expect(x.duration, where).toBeGreaterThanOrEqual(0.3);
      }
      // boss / class multipliers: Kaede ≤ 1.25, Hotaru spectral ≤ 1.25, nobody else (one-girl test)
      expect(prod((s) => s.mods?.bossMul), `${where} bossMul`).toBeLessThanOrEqual(1.25);
      expect(prod((s) => s.mods?.classMul?.spectral), `${where} classMul`).toBeLessThanOrEqual(1.25);
    }
    // brews never above 4 on any build
    for (const b of builds(UNIT_MAP.midori)) expect(resolveStats(UNIT_MAP.midori, { tiers: b.tiers, unitStats: { potential: 6 } }).brew?.targets ?? 0, b.label).toBeLessThanOrEqual(4);
  });
});

describe('Potential v3 data: every step works on every reference build', () => {
  test('each step changes her stats (damage or speed) and, from its kit part, a field her behaviour reads (0-0-0, every 4/2 and 5/2, heroes Lv 1 / 10 / 25)', () => {
    for (const u of UNITS) {
      for (const b of builds(u)) {
        const at = (p) => resolveStats(u, { tiers: b.tiers, heroLevel: b.heroLevel, unitStats: { potential: p } });
        let prev = at(1);
        for (let p = 2; p <= MAX_POTENTIAL; p++) {
          const cur = at(p);
          const where = `${u.id} ${b.label} P${p}`;
          const step = potentialSteps(u)[p - 2];
          const statMoved = cur.damage !== prev.damage || cur.rate !== prev.rate || cur.income?.perWave !== prev.income?.perWave
            || JSON.stringify(cur.aura) !== JSON.stringify(prev.aura) || cur.trap?.damage !== prev.trap?.damage
            || cur.hub?.costCut !== prev.hub?.costCut; // (Ouka's coins track deepens her discount)
          expect(statMoved, `${where}: no stat change`).toBe(true);
          if (step.kind !== 'stat') expect(kitFields(cur), `${where}: the kit part changes nothing`).not.toBe(kitFields(prev));
          prev = cur;
        }
      }
    }
  });

  test('P1 is untouched: no Potential field on any girl at P1', () => {
    for (const u of UNITS) {
      for (const b of builds(u)) {
        const s = resolveStats(u, { tiers: b.tiers, heroLevel: b.heroLevel, unitStats: { potential: 1 } });
        for (const k of ['proc', 'ult', 'bountyAura', 'harvest', 'dotSpread', 'keepRamp', 'projScale', 'tempo', 'classMul']) expect(k in s, `${u.id} ${b.label} ${k}`).toBe(false);
        if (s.aura) expect('foeVuln' in s.aura, u.id).toBe(false);
        if (s.turret) expect('overclock' in s.turret, u.id).toBe(false);
      }
    }
  });
});

describe('potentialSteps / potentialRow / defaults', () => {
  test('a kit variant uses its own row when it has one, else the base row; fixtures win; no row → the rarity default', () => {
    const variant = { ...UNIT_MAP.miko, kitStyle: 'fantasy' };
    expect(potentialRow(variant)).toBe(POTENTIAL_GIRLS.miko);
    const fx = { id: 'fx', rarity: 'SR', potential: { p3: { name: 'Fixture', kind: 'kit', girl: { damageMul: 1.01 }, mods: { pierce: 1 } } } };
    const steps = potentialSteps(fx);
    expect(steps[1]).toEqual({ step: 3, name: 'Fixture', kind: 'kit', girl: { damageMul: 1.01 }, mods: { pierce: 1 } });
    expect(steps[0]).toEqual({ step: 2, name: null, kind: 'stat', girl: null, mods: null }); // a fixture row's missing step is empty
    const none = potentialSteps({ id: 'nobody', rarity: 'SSR' });
    expect(none.map((s) => s.girl.damageMul)).toEqual(POTENTIAL_LADDERS.statTrack.SSR);
    expect(none[4].name).toBe('Full Bloom');
    expect(potentialSteps({ id: 'nobody', kind: 'hero', rarity: 'SR' }).map((s) => s.kind)).toEqual(POTENTIAL_LADDERS.kinds.SSR);
  });
});

describe('potentialFold', () => {
  const kage = UNIT_MAP.kage;
  test('anything that is not a whole 2…6 number is neutral', () => {
    for (const p of [undefined, null, NaN, '6', 0, 1, -3, Infinity]) {
      const f = potentialFold(kage, p);
      expect(f.level, String(p)).toBe(1);
      expect([f.damageMul, f.rateMul, f.rangeMul, f.incomeMul, f.dotMul, f.sets.length]).toEqual([1, 1, 1, 1, 1, 0]);
    }
  });
  test('6 and 99 give all five steps (Kage: the SR track on speed); 2.7 counts as P2', () => {
    const six = potentialFold(kage, 6);
    expect(potentialFold(kage, 99)).toBe(six);
    expect(six.rateMul).toBe(1.04 * 1.05 * 1.05 * 1.06 * 1.07);
    expect(six.damageMul).toBe(1);
    expect(six.sets.length).toBe(4);
    expect(potentialFold(kage, 2.7).level).toBe(2);
    expect(potentialFold(kage, 2.7).sets).toEqual([]);
    expect(Object.isFrozen(six)).toBe(true);
    // Akane's dotMul folds like the other girl keys
    expect(potentialFold(UNIT_MAP.akane, 6).dotMul).toBe(1.04 * 1.05 * 1.07);
  });
  test('memoised per def object', () => {
    expect(potentialFold(kage, 4)).toBe(potentialFold(kage, 4));
    expect(potentialFold({ ...kage }, 4)).not.toBe(potentialFold(kage, 4));
    expect(potentialFold({ ...kage }, 4)).toEqual(potentialFold(kage, 4));
  });
});
