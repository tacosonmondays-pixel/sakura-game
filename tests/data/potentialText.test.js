// Potential's player text (src/data/potentialText.js; docs/specs/POTENTIAL.md v3 §5, §13.2): a text
// row for every girl, node labels that fit the six-node track, and long text that states every
// number of the step's data (the v2 text rule), plus each step's paper size for Power.
import { describe, test, expect } from 'vitest';
import { POTENTIAL_TEXT, potentialTextRow } from '../../src/data/potentialText.js';
import { POTENTIAL_GIRLS, potentialSteps } from '../../src/data/potential.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';

/** Keys whose numbers read as "+N %" (a multiplier m → (m − 1) × 100, or "m×"). */
const MUL_KEYS = new Set(['damageMul', 'rateMul', 'rangeMul', 'incomeMul', 'dotMul', 'bossMul', 'bountyAura', 'dmgMul', 'spectral']);
/** Keys whose numbers are fractions read as percent or points (× 100). */
const FRACTION_KEYS = new Set(['chance', 'bonus', 'share', 'projScale', 'per', 'max', 'foeVuln', 'critChance', 'haste', 'rateBuff', 'pct', 'echo', 'keepRamp']);
/** Context keys whose value is not player-facing on its own. */
const SKIP_KEYS = new Set(['name', 'type', 'of', 'kind', 'volley']);
const WORDS = { 0.5: ['half'], 1: ['one', 'once'], 2: ['twice', 'two'], 3: ['three'] };

const fmt = (x) => String(Math.round(x * 1000) / 1000);

/**
 * The ways a number of the data may be written: `+4%` for a 1.04 multiplier, `6%` for 0.06, `6th`
 * for every 6, words for the small ones. A neutral value (a share of 1, a radius of 0) needs none.
 */
function candidates(key, v, parent, parentKey) {
  if (typeof v !== 'number') return null;
  if (v === 0) return null;
  if (key === 'share' && v === 1) return null;
  const out = new Set();
  const words = [];
  // ramp.max and tempo.max: fraction (focus cap points, tempo %); trap.max / turret.max: a count
  const fractional = FRACTION_KEYS.has(key) && !(key === 'max' && (parentKey === 'trap' || parentKey === 'turret'));
  if (key === 'amount' && parent?.type === 'slow') out.add(fmt(v * 100));
  else if (key === 'amount') out.add(fmt(v));
  else if (key === 'rateMul' && parentKey === 'overclock') out.add(fmt((v - 1) * 100));
  else if (MUL_KEYS.has(key) || key === 'rateMul') {
    out.add(fmt((v - 1) * 100));
    out.add(fmt(v));
    if (v === 2) words.push('twice');
  } else if (key === 'damageMul' || key === 'dotMul') out.add(fmt((v - 1) * 100));
  else if (fractional) {
    out.add(fmt(v * 100));
    if (key === 'pct') out.add(fmt(v * 100));
    for (const w of WORDS[v] || []) words.push(w);
  } else {
    out.add(fmt(v));
    for (const w of WORDS[v] || []) words.push(w);
  }
  return { nums: [...out], words };
}

/** Every [key path, candidates] of a step's data. */
function numbersOf(step) {
  const out = [];
  const visit = (o, path, parentKey) => {
    if (Array.isArray(o)) {
      o.forEach((x) => visit(x, path, parentKey));
      return;
    }
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (SKIP_KEYS.has(k)) continue;
      if (v && typeof v === 'object') visit(v, `${path}.${k}`, k);
      else {
        const c = candidates(k, v, o, parentKey);
        if (c) out.push([`${path}.${k}=${v}`, c]);
      }
    }
  };
  visit(step.girl, 'girl', 'girl');
  visit(step.mods, 'mods', 'mods');
  return out;
}

describe('Potential text', () => {
  test('every girl has a five-step text row; nothing for a girl who does not exist; frozen', () => {
    for (const u of UNITS) {
      expect(POTENTIAL_TEXT[u.id], u.id).toBeTruthy();
      expect(POTENTIAL_TEXT[u.id].length, u.id).toBe(5);
      expect(potentialTextRow(u)).toBe(POTENTIAL_TEXT[u.id]);
    }
    for (const id of Object.keys(POTENTIAL_TEXT)) expect(UNIT_MAP[id.split('@')[0]], id).toBeTruthy();
    expect(Object.keys(POTENTIAL_TEXT).sort()).toEqual(Object.keys(POTENTIAL_GIRLS).sort());
    expect(Object.isFrozen(POTENTIAL_TEXT) && Object.isFrozen(POTENTIAL_TEXT.kage) && Object.isFrozen(POTENTIAL_TEXT.kage[0])).toBe(true);
    expect(potentialTextRow({ id: 'nobody' })).toBe(null);
  });

  test('node labels fit the six-node track (≤ 9 characters); long text, power and an FX cue for every step', () => {
    for (const [id, row] of Object.entries(POTENTIAL_TEXT)) {
      row.forEach((t, i) => {
        const where = `${id} P${i + 2}`;
        expect(Object.keys(t).sort(), where).toEqual(['fx', 'long', 'node', 'power']);
        expect(t.node.length, `${where} "${t.node}"`).toBeLessThanOrEqual(9);
        expect(t.node.length, where).toBeGreaterThan(1);
        expect(t.long.length, where).toBeGreaterThan(8);
        expect(t.long, where).not.toMatch(/src\/|\.js|`/); // player text, no code references
        expect(t.power, where).toBeGreaterThanOrEqual(1.03); // no dead step
        expect(t.power, where).toBeLessThan(1.5);
        expect(typeof t.fx === 'string' && t.fx.length > 1, where).toBe(true);
      });
    }
    // the stat steps open with their stat; Kage's labels as in the spec table
    expect(POTENTIAL_TEXT.kage.map((t) => t.node)).toEqual(['+4% SPD', 'SHURIKEN+', 'TEMPO', 'PIERCE+1', 'STORM']);
    expect(POTENTIAL_TEXT.shiro[4].node).toBe('HERON');
  });

  test('every number in a step\'s data appears in its long text', () => {
    for (const u of UNITS) {
      const steps = potentialSteps(u);
      steps.forEach((s, i) => {
        const text = POTENTIAL_TEXT[u.id][i].long;
        const lower = text.toLowerCase();
        const nums = new Set((text.match(/\d+(?:\.\d+)?/g) || []).map((x) => fmt(Number(x))));
        for (const [path, c] of numbersOf(s)) {
          const ok = c.nums.some((n) => nums.has(n)) || c.words.some((w) => new RegExp(`\\b${w}\\b`).test(lower));
          expect(ok, `${u.id} P${s.step} (${s.name}): ${path} not in "${text}"`).toBe(true);
        }
      });
    }
  });

  test('Power per girl: the step sizes multiply to her §3.2 band (B1-measured; gate B5)', () => {
    const band = { R: [1.33, 1.70], SR: [1.30, 1.95], SSR: [1.44, 2.45] };
    for (const u of UNITS) {
      const p = POTENTIAL_TEXT[u.id].reduce((a, t) => a * t.power, 1);
      const [lo, hi] = band[u.rarity];
      expect(p, u.id).toBeGreaterThanOrEqual(lo);
      expect(p, u.id).toBeLessThanOrEqual(hi);
    }
    const prod = (id) => POTENTIAL_TEXT[id].reduce((a, t) => a * t.power, 1);
    // the B1 bench's E(P6)/E(P1) (docs/specs/POTENTIAL.md v3 build notes, "B1 / B5"): within ±10 %
    expect(prod('kage') / 1.93).toBeGreaterThan(0.9);
    expect(prod('kage') / 1.93).toBeLessThan(1.1);
    expect(prod('aoi') / 1.52).toBeGreaterThan(0.9);
    expect(prod('aoi') / 1.52).toBeLessThan(1.1);
    expect(prod('kaede') / 2.25).toBeGreaterThan(0.9);
    expect(prod('kaede') / 2.25).toBeLessThan(1.1);
    expect(prod('shiro') / 1.84).toBeGreaterThan(0.9);
    expect(prod('shiro') / 1.84).toBeLessThan(1.1);
  });
});
