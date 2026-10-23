// [ui-ink] The UI v2 stylesheet (src/ui/styles/ink.css) keeps its scope fence (notes/ui-v2/build/PLAN.md rule 2): every
// selector sits under the surface mode classes body.ui-day / body.ui-night, so nothing reaches the battle, the title or
// a story scene. Plus the rules the V1 review checks by name: one countdown chip shape (low 12), the yellow dot turned
// red, the day sheet's blur (low 10), and medium 3's selected tile (the frame stays, the pink chip and bar, no ring).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const CSS = readFileSync(new URL('../../src/ui/styles/ink.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Every style rule as { sel, body }, @media blocks opened, @keyframes left out. */
function rules(css) {
  const out = [];
  let i = 0;
  const read = (end) => {
    while (i < css.length) {
      const open = css.indexOf('{', i);
      const close = css.indexOf('}', i);
      if (close !== -1 && (open === -1 || close < open)) { i = close + 1; if (end) return; continue; }
      if (open === -1) return;
      const head = css.slice(i, open).trim();
      i = open + 1;
      if (head.startsWith('@media') || head.startsWith('@supports')) { read(true); continue; }
      if (head.startsWith('@keyframes')) { let d = 1; while (d && i < css.length) { if (css[i] === '{') d++; else if (css[i] === '}') d--; i++; } continue; }
      const stop = css.indexOf('}', i);
      out.push({ sel: head, body: css.slice(i, stop) });
      i = stop + 1;
    }
  };
  read(false);
  return out;
}
/** Splits a selector list on top-level commas (not the ones inside :is() / :where()). */
function split(sel) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of sel) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

const ALL = rules(CSS);
const SCOPED = /^(?:html\[data-reduce-motion\]\s+)?(?::where\(\.ui-day, \.ui-night\)|:is\(\.ui-day, \.ui-night\)|:is\(\.ui-day\)|:where\(\.ui-night\)|\.ui-day\b|\.ui-night\b|body\.ui-day\b)/;
/** The only unscoped rule: the zero-specificity ring-width reset (a custom property, read only by the kit's shapes). */
const RW_RESET = /^:where\(\.ui-panel,/;

describe('ink.css', () => {
  it('parses into many rules', () => {
    expect(ALL.length).toBeGreaterThan(300);
  });
  it('the scope fence: every selector sits under body.ui-day / body.ui-night', () => {
    const loose = [];
    for (const r of ALL) for (const s of split(r.sel)) if (!SCOPED.test(s) && !RW_RESET.test(s)) loose.push(s);
    expect(loose).toEqual([]);
  });
  it('the changed token values live under the mode classes only (C10), never on :root', () => {
    expect(CSS).not.toMatch(/:root\s*\{/);
    const tok = ALL.find((r) => r.sel === ':where(.ui-day, .ui-night)' && /--cut:/.test(r.body));
    expect(tok?.body).toMatch(/--strip-h:\s*60px/);
  });
  it('one countdown chip shape (low 12): a single cut, no radius, the same in a plate head', () => {
    const shape = ALL.find((r) => r.sel.includes('.ui-cd') && /clip-path: polygon\(0 0, calc\(100% - var\(--c\)\) 0/.test(r.body));
    expect(shape).toBeTruthy();
    expect(ALL.find((r) => r.sel.includes('.ui-cd.s') && /border-radius: 0/.test(r.body))).toBeTruthy();
  });
  it('the yellow "new inside" dot is the red dot (one dot colour)', () => {
    const dot = ALL.find((r) => r.sel.includes('.ui-bdg.ydot'));
    expect(dot.body).toMatch(/background: var\(--badge-red\)/);
  });
  it('a day sheet: a 2 px blur behind it (low 10) and the floating chamfered panel', () => {
    expect(ALL.find((r) => r.sel.includes('.ui-layer > .ui-scrim'))?.body).toMatch(/backdrop-filter: blur\(2px\)/);
    expect(ALL.find((r) => r.sel.includes('.ui-sheet:not(.full)') && /clip-path/.test(r.body))).toBeTruthy();
  });
  it('medium 3: the selected tile keeps its frame and gets the pink chip and bar, never a pink ring', () => {
    const pick = ALL.find((r) => /\.ui-pick$/.test(split(r.sel)[0]));
    expect(pick.body).toMatch(/background: var\(--pink-ink\)/);
    expect(ALL.find((r) => /\.ui-pickbar$/.test(split(r.sel)[0]))?.body).toMatch(/height: 3px/);
    const sel = ALL.filter((r) => r.sel.includes('.ui-gtile.selected'));
    expect(sel.length).toBeGreaterThan(0);
    for (const r of sel) expect(r.body, r.sel).not.toMatch(/border(-color)?:[^;]*pink|outline:[^;]*pink|--pink[^;]*\b3px/);
    const card = ALL.find((r) => r.sel.includes('.mb-gear.selected') && /outline: none/.test(r.body));
    expect(card?.body).toMatch(/inset 0 -3px 0 var\(--pink-ink\)/);
  });
  it('V1 review 1: the narrow bar drops the "+", the night Close is on ink, the pick chip has no frame and keeps low', () => {
    // portrait phones: the "+", the slashes and the hairline go, the title may give way, the icons stay 46 px
    const narrow = ALL.find((r) => r.sel.includes('.topbar :is(.cur-plus, .ui-slash, .ui-vr)'));
    expect(narrow?.body).toMatch(/display: none/);
    expect(ALL.find((r) => r.sel.endsWith('.topbar-title') && /min-width: 0/.test(r.body))).toBeTruthy();
    // the bar's hit squares: the tap size + 2 px, the icon pair with no gap
    expect(ALL.find((r) => r.sel.includes('.cur-plus::before'))?.body).toMatch(/calc\(var\(--tap\) \+ 2px\)/);
    expect(ALL.find((r) => r.sel.includes('.topbar-group:has(> .topbar-icon)'))?.body).toMatch(/gap: 0/);
    // a ghost off paper wears a surface: the pull result's Close is white caps on ink
    const close = ALL.find((r) => r.sel.includes('.ma-gacha .btn-ghost'));
    expect(close?.body).toMatch(/color: var\(--on-ink\)/);
    expect(close?.body).toMatch(/background: var\(--plate\)/);
    // the Formation pick's chip: no border (meta-b's frame reset), at the bottom corner, never at the eye line
    const chip = ALL.find((r) => split(r.sel)[0].endsWith('.mb-pick .mb-pick-check'));
    expect(chip?.body).toMatch(/border: 0/);
    expect(chip?.body).toMatch(/top: auto/);
    expect(chip?.body).toMatch(/bottom: -4px/);
  });
  it('the E3 rail: white caps on the active ink slab and the pink "/" bar (Q1); no yellow words', () => {
    expect(ALL.find((r) => split(r.sel)[0].endsWith('.ui-stab.on'))?.body).toMatch(/color: var\(--on-ink\)/);
    expect(ALL.find((r) => r.sel.includes('.ui-stab.on::before'))?.body).toMatch(/background: var\(--pink\)/);
    for (const r of ALL) expect(r.body, r.sel).not.toMatch(/(^|[^-])color:\s*var\(--yellow\)/);
  });
});
