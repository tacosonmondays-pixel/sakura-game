// [ui-ink] The UI v2 motion layer (src/ui/motion.js, src/ui/styles/motion.css; owner, Oct 27: "add animated
// transitions"): its scope fence (the menus and the home only, never the battle), compositor-only keyframes, Reduce
// Motion everywhere it moves, the timing budgets (paths the player takes many times stay quick), the count-up and the
// badge pop rules.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MOTION_UI, countDuration, easeOutCubic, countTo, shownCount, badgeShown, badgeGone, noteTabPick, recentTabDir } from '../../src/ui/motion.js';
import { MOTION } from '../../src/ui/transitions/kind.js';

const CSS = readFileSync(new URL('../../src/ui/styles/motion.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Style rules as { sel, body } (@media opened) and @keyframes as { name, body }. */
function parse(css) {
  const rules = [];
  const frames = [];
  let i = 0;
  const read = (end) => {
    while (i < css.length) {
      const open = css.indexOf('{', i);
      const close = css.indexOf('}', i);
      if (close !== -1 && (open === -1 || close < open)) { i = close + 1; if (end) return; continue; }
      if (open === -1) return;
      const head = css.slice(i, open).trim();
      i = open + 1;
      if (head.startsWith('@media')) { read(true); continue; }
      if (head.startsWith('@keyframes')) {
        const start = i;
        let d = 1;
        while (d && i < css.length) { if (css[i] === '{') d++; else if (css[i] === '}') d--; i++; }
        frames.push({ name: head.replace('@keyframes', '').trim(), body: css.slice(start, i - 1) });
        continue;
      }
      const stop = css.indexOf('}', i);
      rules.push({ sel: head, body: css.slice(i, stop) });
      i = stop + 1;
    }
  };
  read(false);
  return { rules, frames };
}
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
const { rules, frames } = parse(CSS);
const SCOPED = /^(?:html\[data-reduce-motion\]\s+|html\[data-tx="(?:boot|cut)"\]:not\(\[data-reveal\]\)\s+)?:is\(\.ui-(?:day, \.ui-night|night)\)/;

describe('motion.css', () => {
  it('the scope fence: every selector sits under body.ui-day / body.ui-night (never the battle, the title, a story scene)', () => {
    expect(rules.length).toBeGreaterThan(30);
    const loose = rules.flatMap((r) => split(r.sel)).filter((s) => !SCOPED.test(s));
    expect(loose).toEqual([]);
  });
  it('every keyframe moves opacity, translate or scale only (the compositor; no layout)', () => {
    expect(frames.length).toBeGreaterThan(10);
    for (const f of frames) {
      const props = [...f.body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      for (const p of props) expect(['opacity', 'translate', 'scale'], `${f.name}: ${p}`).toContain(p);
    }
  });
  it('Reduce Motion (the setting and the system) turns the entrances into a 120 ms fade and stops the pops', () => {
    const reduceSetting = rules.filter((r) => r.sel.startsWith('html[data-reduce-motion]'));
    expect(reduceSetting.some((r) => r.sel.includes('[data-mo]') && /mo-fade 120ms/.test(r.body))).toBe(true);
    expect(reduceSetting.some((r) => r.sel.includes('.mo-pop') && /animation: none/.test(r.body))).toBe(true);
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\[data-mo\] \{ animation: mo-fade 120ms/);
  });
  it('a piece waits under a cover (the boot loader, a cut) and plays from the reveal', () => {
    expect(rules.some((r) => r.sel.includes('html[data-tx="boot"]:not([data-reveal])') && /animation-play-state: paused/.test(r.body))).toBe(true);
  });
});

describe('motion timings', () => {
  it('the home: its first entrance is still by about 0.7 s (the wallpaper by 1 s), a return by 0.4 s', () => {
    const M = MOTION_UI;
    const lastFirst = M.pieceFirstBase + M.pieceFirstStep * M.maxSteps + M.pieceFirst;
    expect(lastFirst).toBeLessThanOrEqual(720);
    expect(M.sceneFirst).toBeLessThanOrEqual(1000);
    expect(M.pieceFirstStep).toBeGreaterThanOrEqual(30);
    expect(M.pieceFirstStep).toBeLessThanOrEqual(50);
    expect(M.pieceReturnBase + M.pieceReturnStep * (M.maxSteps - 1) + M.pieceReturn).toBeLessThanOrEqual(420);
    expect(M.girlFirstDelay + M.girlFirst).toBeLessThanOrEqual(450);
  });
  it('the screen changes the player makes many times: forward ≤ 280 ms, back ≤ 220 ms, the wipe as long as the change', () => {
    expect(MOTION.slideOut + MOTION.slide).toBeLessThanOrEqual(280);
    expect(MOTION.slideBackOut + MOTION.slideBack).toBeLessThanOrEqual(220);
    expect(MOTION.wipe).toBe(MOTION.slideOut + MOTION.slide);
    expect(MOTION.wipeBack).toBe(MOTION.slideBackOut + MOTION.slideBack);
    expect(MOTION.slideBackFadeIn).toBeLessThanOrEqual(MOTION.slideBack);
  });
  it('tabs and pops stay short', () => {
    expect(MOTION_UI.tabFade).toBeLessThanOrEqual(120);
    expect(MOTION_UI.tabShift).toBeLessThanOrEqual(180);
    expect(MOTION_UI.pop).toBeLessThanOrEqual(240);
    expect(MOTION_UI.reducedFade).toBeLessThanOrEqual(120);
  });
});

describe('count-ups', () => {
  it('400 ms, a little longer for big jumps, never over 600; nothing for no change', () => {
    expect(countDuration(5, 5)).toBe(0);
    expect(countDuration(100, 150)).toBe(400);
    expect(countDuration(16570, 16670)).toBe(400);
    expect(countDuration(0, 1e6)).toBeLessThanOrEqual(600);
    expect(countDuration(0, 1e9)).toBe(600);
    expect(countDuration(1e6, 0)).toBe(countDuration(0, 1e6));
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
  it('without a frame clock (or on a first draw) the number is simply set, and the key remembers it', () => {
    const el = { textContent: '', removeAttribute() {}, setAttribute() {} };
    countTo(el, 284650, { key: 'test-coins' });
    expect(el.textContent).toBe('284,650');
    expect(shownCount('test-coins')).toBe(284650);
    countTo(el, 284700, { key: 'test-coins' });
    expect(el.textContent).toBe('284,700');
    expect(shownCount('test-coins')).toBe(284700);
  });
});

describe('badge pops', () => {
  const fake = () => {
    const cls = new Set();
    return { cls, classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c) }, addEventListener() {} };
  };
  it('a dot pops the first time it shows, not on a redraw, and again after it went', () => {
    const a = fake();
    badgeShown(a, 'test:dot');
    expect(a.cls.has('mo-pop')).toBe(true);
    const b = fake();
    badgeShown(b, 'test:dot');
    expect(b.cls.has('mo-pop')).toBe(false);
    badgeGone('test:dot');
    const c = fake();
    badgeShown(c, 'test:dot');
    expect(c.cls.has('mo-pop')).toBe(true);
  });
});

describe('tab direction', () => {
  it('a pick along the rail gives the content its shift direction (for half a second)', () => {
    noteTabPick(0, 3);
    expect(recentTabDir()).toBe(1);
    noteTabPick(2, 1);
    expect(recentTabDir()).toBe(-1);
  });
});
