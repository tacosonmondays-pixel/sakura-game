// Per-stage rule skins (src/ui/text/rules.js; Gate Arc): display text a stage lays over a shipped
// rule's name and description. The sim never reads them (src/data/rules.js holds the rule), so the
// numbers must stay the rule's own: every number in the rule's description reappears in the skin's.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  RULE_TEXT, STAGE_RULE_SKINS, SKIN_FIELDS, ruleTextFor, laneClosedText, LANE_CLOSED_LINE, STAGE_LANE_TEXT,
} from '../../src/ui/text/rules.js';
import { STAGE_MAP, STAGES } from '../../src/data/stages.js';

/** The numbers in a text ("6 s in every 16 … 25%" → ['6', '16', '25']). */
const numbers = (text) => [...new Set(String(text || '').match(/\d+(?:\.\d+)?/g) || [])];

/** What is wrong with a skin over its rule (empty = fine). */
function skinProblems(stageId, skin) {
  const out = [];
  const base = RULE_TEXT[skin.rule];
  if (!base) return [`${stageId}: unknown rule ${skin.rule}`];
  for (const k of Object.keys(skin)) if (k !== 'rule' && !SKIN_FIELDS.includes(k)) out.push(`${stageId}: unknown field ${k}`);
  for (const k of ['name', 'desc']) if (!(typeof skin[k] === 'string' && skin[k].trim())) out.push(`${stageId}: a skin needs its own ${k}`);
  for (const n of numbers(base.desc)) if (!numbers(skin.desc).includes(n)) out.push(`${stageId}: ${n} from "${base.desc}" is missing in "${skin.desc}"`);
  if (skin.toast && base.toast) for (const n of numbers(base.toast)) if (!numbers(skin.toast).includes(n)) out.push(`${stageId}: toast lost ${n}`);
  if (skin.toast && !base.toast) out.push(`${stageId}: the rule has no toast to skin`);
  return out;
}

// a fixture skin (the 1-7 idea: the gusts of Tailwind become the rush hour on a Noon street)
const FIXTURE = {
  '9-7': {
    rule: 'tailwind',
    name: 'Rush Hour',
    short: 'Rush',
    desc: 'The crowd surges (6 s in every 16): enemies move 25% faster, and Pierce, Slash and Blast hit 25% harder in the crush.',
    toast: 'Rush hour! Enemies faster; Pierce, Slash, Blast +25% (6 s)',
    activeWord: 'surge',
  },
};

describe('rule skins', () => {
  it('a skin replaces the name, short name, description and toast; the icon and the numbers stay', () => {
    const stage = { id: '9-7', rule: { id: 'tailwind' } };
    const t = ruleTextFor(stage, 'tailwind', FIXTURE);
    expect(t).toMatchObject({ name: 'Rush Hour', short: 'Rush', toast: FIXTURE['9-7'].toast, activeWord: 'surge', icon: RULE_TEXT.tailwind.icon, baseName: 'Tailwind' });
    expect(t.desc).toBe(FIXTURE['9-7'].desc);
    expect(skinProblems('9-7', FIXTURE['9-7'])).toEqual([]);
    // the stage's rule is read by default
    expect(ruleTextFor(stage, undefined, FIXTURE).name).toBe('Rush Hour');
    // the shipped table itself is untouched
    expect(RULE_TEXT.tailwind.name).toBe('Tailwind');
  });

  it('a skin applies only to the rule it names; stages without one read the rule as before', () => {
    const stage = { id: '9-7', rule: { id: 'tailwind' } };
    // another rule in force on that stage (a mode, a test): the plain text
    expect(ruleTextFor(stage, 'heat_mirage', FIXTURE)).toBe(RULE_TEXT.heat_mirage);
    expect(ruleTextFor({ id: '9-8', rule: { id: 'tailwind' } }, 'tailwind', FIXTURE)).toBe(RULE_TEXT.tailwind);
    expect(ruleTextFor({ id: '9-7' }, null, FIXTURE)).toBe(null);
    expect(ruleTextFor(null)).toBe(null);
    expect(ruleTextFor({ id: 'x', rule: { id: 'nope' } })).toBe(null);
    // every stage with a rule and no skin (all of Act I) reads exactly its RULE_TEXT entry
    for (const s of STAGES) if (s.rule && !STAGE_RULE_SKINS[s.id]) expect(ruleTextFor(s), s.id).toBe(RULE_TEXT[s.rule.id]);
    for (const s of STAGES) if (s.act === 1) expect(STAGE_RULE_SKINS[s.id], s.id).toBeUndefined();
  });

  it('the numbers check catches a skin that changed or dropped a number', () => {
    const bad = { ...FIXTURE['9-7'], desc: 'The crowd surges (5 s in every 16): enemies move 30% faster.' };
    const p = skinProblems('9-7', bad);
    expect(p.some((x) => x.includes(' 6 '))).toBe(true);
    expect(p.some((x) => x.includes(' 25 '))).toBe(true);
    expect(skinProblems('9-7', { ...FIXTURE['9-7'], colour: 'red' }).join()).toMatch(/unknown field colour/);
  });

  it('every shipped skin keeps its rule\'s numbers, names a stage that exists, and matches its rule', () => {
    for (const [id, skin] of Object.entries(STAGE_RULE_SKINS)) {
      expect(skinProblems(id, skin), id).toEqual([]);
      const st = STAGE_MAP[id];
      expect(st, `${id}: a skin for a stage that does not exist`).toBeTruthy();
      expect(st.rule?.id, `${id}: the stage's rule`).toBe(skin.rule);
    }
  });

  it('the lane-closed banner line: the default, or the stage\'s own wording', () => {
    expect(laneClosedText(null)).toBe(LANE_CLOSED_LINE);
    expect(laneClosedText({ id: '1-1' })).toBe(LANE_CLOSED_LINE);
    for (const [id, text] of Object.entries(STAGE_LANE_TEXT)) {
      expect(STAGE_MAP[id], id).toBeTruthy();
      expect(laneClosedText({ id })).toBe(text);
    }
  });

  it('every screen that shows a stage\'s rule reads it through ruleTextFor (battle, co-op room, rule card, stage chip)', () => {
    const src = (p) => readFileSync(resolve(__dirname, '../../src', p), 'utf8');
    for (const f of ['ui/battle/modes.js', 'ui/screens/coop.js', 'ui/screens/stageModes.js']) {
      const s = src(f);
      expect(s, f).toMatch(/ruleTextFor\(/);
      expect(s, `${f} indexes RULE_TEXT directly`).not.toMatch(/RULE_TEXT\[/);
    }
  });
});

describe('the rule card stays readable on a phone', () => {
  it('every font size on the rule card (.ma-rule*) is at least 12 px', () => {
    const css = readFileSync(new URL('../../src/ui/styles/modes.css', import.meta.url), 'utf8');
    const sizes = [];
    for (const m of css.matchAll(/([^{}]*\.ma-rule[^{}]*)\{([^}]*)\}/g)) {
      for (const f of m[2].matchAll(/font-size:\s*([\d.]+)(px|rem)/g)) sizes.push([m[1].trim(), Number(f[1]) * (f[2] === 'rem' ? 16 : 1)]);
    }
    expect(sizes.length).toBeGreaterThan(3);
    for (const [sel, px] of sizes) expect(px, sel).toBeGreaterThanOrEqual(12);
  });
});

describe('Chapter 1 · Act II skins (Rush Hour)', () => {
  it('every Act II stage of chapter 1 shows its rule under its modern name, with the base name kept', () => {
    const names = { '1-6': 'Rush-hour Evacuation', '1-7': 'Crowd Surge', '1-8': 'Time Sale', '1-9': 'Lock Cycle', '1-10': 'Brigade Airdrop' };
    for (const [id, name] of Object.entries(names)) {
      const t = ruleTextFor(STAGE_MAP[id]);
      expect(t.name, id).toBe(name);
      expect(t.baseName, id).toBe(RULE_TEXT[STAGE_MAP[id].rule.id].name);
      expect(t.icon, id).toBe(RULE_TEXT[STAGE_MAP[id].rule.id].icon);
    }
  });
});
