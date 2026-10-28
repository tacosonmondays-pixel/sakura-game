// Potential's player text (src/data/potentialText.js; docs/specs/POTENTIAL.md v3 §5, §13.2): a text
// row for every girl, node labels that fit the six-node track, and long text that states every
// number of the step's data (the v2 text rule), plus each step's paper size for Power; and the
// Potential Board's card lines (docs/specs/POTENTIAL_BOARD.md "Cards"): one short sentence and at
// most two short chips per step, every number of them from the step's long text.
import { describe, test, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { POTENTIAL_TEXT, potentialTextRow } from '../../src/data/potentialText.js';
import { POTENTIAL_GIRLS, potentialSteps } from '../../src/data/potential.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { BASE_CARD, firstSentence, cardFromText, stepCardText } from '../../src/ui/potentialBoard/card.js';

/** Keys whose numbers read as "+N %" (a multiplier m → (m − 1) × 100, or "m×"). */
const MUL_KEYS = new Set(['damageMul', 'rateMul', 'rangeMul', 'incomeMul', 'dotMul', 'bossMul', 'bountyAura', 'dmgMul', 'spectral', 'shareMul',
  // Norika's barricade budget (BANNERS §D.4)
  'budgetMul']);
/** Keys whose numbers are fractions read as percent or points (× 100). */
const FRACTION_KEYS = new Set(['held', 'chance', 'bonus', 'share', 'projScale', 'per', 'max', 'foeVuln', 'critChance', 'haste', 'rateBuff', 'pct', 'echo', 'keepRamp',
  // Wakaba's drink bonuses (drink.dmg 0.03 = 3%); Ouka's extra discount (hub.cutAdd 0.02 = 2%)
  'dmg', 'rate', 'cutAdd']);
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
  const fractional = FRACTION_KEYS.has(key) && !(key === 'max' && (parentKey === 'trap' || parentKey === 'turret' || parentKey === 'sentry'));
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
    if (v < 0) out.add(fmt(-v)); // ("comes 0.5 s sooner" for vine.every -0.5)
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
        // the four fields every step has, and the Board's optional card lines (card + chips, written together)
        expect(Object.keys(t).filter((k) => k !== 'card' && k !== 'chips').sort(), where).toEqual(['fx', 'long', 'node', 'power']);
        expect('card' in t, where).toBe('chips' in t);
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

/** Numbers a card line states: digit groups and the number words (an idiom like "at once" is not one). */
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, twice: 2, double: 2, half: 50 };
const digits = (s) => (s.match(/\d+(?:\.\d+)?/g) || []).map((x) => fmt(Number(x)));
const numberWords = (s) => (s.toLowerCase().match(/[a-z]+/g) || []).filter((w) => w in NUMBER_WORDS);

describe('Potential Board card lines', () => {
  const steps = Object.entries(POTENTIAL_TEXT).flatMap(([id, row]) => row.map((t, i) => ({ id, p: i + 2, t, where: `${id} P${i + 2}` })));

  test('every girl has a card line for every step (all 35 written)', () => {
    for (const u of UNITS) for (const t of POTENTIAL_TEXT[u.id]) expect(typeof t.card, u.id).toBe('string');
    expect(steps.filter((s) => s.t.card).length).toBe(UNITS.length * 5);
  });

  test('a card is one sentence of at most 60 characters with at most one number', () => {
    for (const { t, where } of steps.filter((s) => s.t.card)) {
      expect(t.card.length, `${where} "${t.card}"`).toBeLessThanOrEqual(60);
      expect(t.card, where).toMatch(/^[A-Z][^]*[.!]$/);
      expect(firstSentence(t.card), `${where}: one sentence`).toBe(t.card);
      expect(digits(t.card).length + numberWords(t.card).length, `${where} "${t.card}"`).toBeLessThanOrEqual(1);
      expect(t.card, where).not.toMatch(/src\/|\.js|`/);
    }
  });

  test('chips: at most two, at most 14 characters each, in capitals, each naming its stat', () => {
    for (const { t, where } of steps.filter((s) => s.t.card)) {
      expect(Array.isArray(t.chips), where).toBe(true);
      expect(t.chips.length, where).toBeLessThanOrEqual(2);
      for (const ch of t.chips) {
        expect(ch.length, `${where} "${ch}"`).toBeLessThanOrEqual(14);
        expect(ch, where).toBe(ch.toUpperCase());
        expect(ch, `${where} "${ch}" names a stat`).toMatch(/[A-Z]{2,}/);
      }
      expect(Object.isFrozen(t.chips), where).toBe(true);
    }
  });

  test("every number a card or chip states is in that step's long text (so it says what the step really does)", () => {
    for (const { t, where } of steps.filter((s) => s.t.card)) {
      const inLong = new Set(digits(t.long));
      for (const w of numberWords(t.long)) inLong.add(fmt(NUMBER_WORDS[w]));
      for (const s of [t.card, ...t.chips]) {
        for (const n of digits(s)) expect(inLong.has(n), `${where}: ${n} in "${s}" is not in "${t.long}"`).toBe(true);
      }
    }
  });

  test("no other game's name and no forbidden Board word in the card lines", () => {
    // the hashed list lives in tests/data/otherNames.test.js; read it from there so the two never drift
    const guard = readFileSync(new URL('./otherNames.test.js', import.meta.url), 'utf8');
    const block = guard.slice(guard.indexOf('const BANNED'), guard.indexOf(']);', guard.indexOf('const BANNED')));
    const banned = new Set(block.match(/[0-9a-f]{16}/g));
    expect(banned.size).toBeGreaterThan(20);
    const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
    const stem = String.fromCharCode(115, 105, 103, 110);
    for (const { t, where } of steps.filter((s) => s.t.card)) {
      for (const s of [t.card, ...t.chips]) {
        const words = s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
        words.forEach((w, k) => {
          for (const x of [w, words[k + 1] ? `${w} ${words[k + 1]}` : null]) if (x) expect(banned.has(hash(x)), `${where}: "${s}"`).toBe(false);
        });
        expect(s.toLowerCase().includes(stem), `${where}: "${s}"`).toBe(false);
      }
    }
  });

  test('the card falls back to the node label and the first sentence of the long text', () => {
    expect(firstSentence('+5% attack speed. Every throw carries 8% more shuriken (13 → 14.04 on average).')).toBe('+5% attack speed.');
    expect(firstSentence('Aura +3% damage and 0.4 tiles wider (4.2 → 4.6).')).toBe('Aura +3% damage and 0.4 tiles wider (4.2 → 4.6).');
    expect(firstSentence('no full stop')).toBe('no full stop');
    expect(firstSentence(undefined)).toBe('');
    expect(cardFromText({ node: 'TEMPO', long: '+5% attack speed. Every throw in a run is faster.' }))
      .toEqual({ node: 'TEMPO', card: '+5% attack speed.', chips: [], fallback: true });
    expect(cardFromText(POTENTIAL_TEXT.aoi[2])).toEqual({ node: 'CRIT+6%', card: POTENTIAL_TEXT.aoi[2].card, chips: ['CRIT +6%'], fallback: false });
    // her card for a step: the label, the sentence, the stat chip and the kit chips; P1 is her base
    expect(stepCardText(UNIT_MAP.aoi, 4)).toMatchObject({ step: 4, node: 'CRIT+6%', stat: '+4% DMG', chips: ['CRIT +6%'], kit: true, fallback: false });
    expect(stepCardText(UNIT_MAP.kage, 1)).toMatchObject({ step: 1, node: BASE_CARD.node, card: BASE_CARD.card, chips: [] });
    expect(BASE_CARD.card.length).toBeLessThanOrEqual(60);
    // a girl without a text row (a fixture) reads the describer's label and its first sentence
    const fixture = stepCardText({ ...UNIT_MAP.kage, id: 'kage-fixture' }, 3);
    expect(fixture).toMatchObject({ node: '+5% DMG', card: '+5% damage', chips: [], fallback: true });
    for (const u of UNITS) for (let p = 1; p <= 6; p++) expect(stepCardText(u, p).card.length, `${u.id} P${p}`).toBeGreaterThan(5);
  });
});
