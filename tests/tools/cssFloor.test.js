// The CSS floor lint (tools/cssFloor.mjs, docs/specs/UI_DIRECTION.md §8): font sizes under 12 px outside .deco,
// counted per file against a baseline that may only go down.
import { describe, it, expect, beforeAll } from 'vitest';
import { scanCss, scanAll, readBaseline, compare, nextBaseline } from '../../tools/cssFloor.mjs';

describe('CSS floor lint: the counter', () => {
  it('counts font-size and the size inside a font: shorthand', () => {
    const found = scanCss('.a { font-size: 11px; }\n.b { font: 900 0.56rem/1 var(--font); }\n.c { font: italic 700 12px Nunito; }');
    expect(found.map((d) => [d.selector, d.px])).toEqual([['.a', 11], ['.b', 8.96]]);
    expect(found[1].line).toBe(2);
  });
  it('skips .deco rules, tokens, keywords and percentages', () => {
    expect(scanCss('.deco .serial { font-size: 9px; } .x { font-size: var(--fs-label); } .y { font-size: smaller; } .z { font-size: 80%; }')).toEqual([]);
  });
  it('clamp() counts by its smallest fixed size; rules inside @media count too', () => {
    expect(scanCss('.a { font-size: clamp(0.6rem, 2vw, 1rem); }')[0].px).toBe(9.6);
    expect(scanCss('@media (max-height: 480px) { .a { font-size: 0.7rem; } }')).toHaveLength(1);
  });
  it('ignores comments', () => {
    expect(scanCss('/* .a { font-size: 8px; } */ .b { color: red; }')).toEqual([]);
  });
});

describe('CSS floor lint: line numbers', () => {
  it('a declaration reports the line it starts on, in a big file too', () => {
    const css = `${'.x { color: red; }\n'.repeat(5000)}.a {\n  font-size: 9px;\n}\n/* x\ny */ .b { font-size: 10px; }`;
    expect(scanCss(css).map((d) => d.line)).toEqual([5002, 5005]);
  });
});

describe('CSS floor lint: --update never raises a count or adds a file (M0-1)', () => {
  const scan = { 'a.css': [1, 2, 3], 'b.css': [1], 'new.css': [1, 2], 'clean.css': [] };
  it('lowers to today\'s count, keeps lower baselines, leaves a new file out (it still fails)', () => {
    const base = { 'a.css': 5, 'b.css': 0, 'gone.css': 4 };
    expect(nextBaseline(scan, base)).toEqual({ 'a.css': 3 });
    expect(compare(scan, nextBaseline(scan, base)).map((r) => r.file)).toEqual(['b.css', 'new.css']);
  });
  it('--admit takes a named file in at today\'s count, and only that one', () => {
    expect(nextBaseline(scan, { 'a.css': 5 }, ['new.css'])).toEqual({ 'a.css': 3, 'new.css': 2 });
  });
});

describe('CSS floor lint: the ratchet', () => {
  let scan;
  beforeAll(() => {
    scan = scanAll(); // one scan of every stylesheet for both checks
  });
  it('no stylesheet has more declarations under 12 px than its baseline (run node tools/cssFloor.mjs --list)', () => {
    expect(compare(scan, readBaseline())).toEqual([]);
  });
  it('the new component stylesheet has none', () => {
    expect(scan['src/ui/styles/components.css']).toEqual([]);
  });
});
