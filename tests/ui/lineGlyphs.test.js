// [ui-ink] The UI v2 line glyphs (src/ui/lineGlyphs.js; notes/ui-v2/UI_V2_DIRECTION.md section 9): all 86 of the
// approved set and every name the kit draws exist; 24 grid; no fills but the allowed dots and the play triangle; the
// frame glyphs carry their 2.5 px corner cut; the game names chrome asks for map onto real line glyphs.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  LINE_GLYPHS, GLYPH_GROUPS, CORE_GLYPHS, FRAME_GLYPHS, LINE_ALIASES, EMBLEM_GLYPHS, CHAPTER_EMBLEMS, chapterEmblem, lineGlyph, lineFor, hasLineGlyph, emblemSvg,
} from '../../src/ui/lineGlyphs.js';

/** The glyph names the kit fixture (the approved specimen's boards) draws with <i data-g="…">. */
const FIXTURE = readFileSync(new URL('../../e2e/fixtures/ink-kit.html', import.meta.url), 'utf8');
const FIXTURE_NAMES = [...new Set([...FIXTURE.matchAll(/data-g="([\w]+)"/g)].map((m) => m[1]))];

/** Walks a path (absolute and relative M L H V A C S Q) and returns its straight line segments as [dx, dy]. */
function segments(d) {
  const out = [];
  const tok = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)/g) || [];
  const ARGS = { m: 2, l: 2, h: 1, v: 1, a: 7, c: 6, s: 4, q: 4, t: 2, z: 0 };
  let x = 0;
  let y = 0;
  let cmd = '';
  for (let i = 0; i < tok.length;) {
    if (/[a-zA-Z]/.test(tok[i])) {
      cmd = tok[i++];
      if (cmd === 'z' || cmd === 'Z') cmd = '';
      continue;
    }
    if (!cmd) { i++; continue; }
    const k = ARGS[cmd.toLowerCase()];
    const v = tok.slice(i, i + k).map(Number);
    i += k;
    const rel = cmd === cmd.toLowerCase();
    const c = cmd.toLowerCase();
    if (c === 'h') x = rel ? x + v[0] : v[0];
    else if (c === 'v') y = rel ? y + v[0] : v[0];
    else {
      const nx = rel ? x + v[k - 2] : v[k - 2];
      const ny = rel ? y + v[k - 1] : v[k - 1];
      if (c === 'l') out.push([nx - x, ny - y]);
      x = nx;
      y = ny;
      if (c === 'm') cmd = rel ? 'l' : 'L';
    }
  }
  return out;
}

describe('line glyphs', () => {
  it('the approved set: 86 glyphs in five groups, each one drawn', () => {
    expect(CORE_GLYPHS).toHaveLength(86);
    for (const names of Object.values(GLYPH_GROUPS)) for (const n of names) expect(hasLineGlyph(n), n).toBe(true);
    expect(Object.keys(LINE_GLYPHS)).toHaveLength(95); // the 86 + armorbreak, pierce and lantern (the mock-ups) + Tryout Day's 6
    expect(GLYPH_GROUPS['Tryout Day']).toEqual(['marble', 'eraser', 'hall-pass', 'desk', 'stamp', 'chalk']);
  });
  it('every glyph the kit fixture draws exists', () => {
    expect(FIXTURE_NAMES.length).toBeGreaterThan(36);
    for (const n of FIXTURE_NAMES) expect(hasLineGlyph(n), n).toBe(true);
    // coins and gems wear their colour art (kit.js curArt; owner, Oct 27), never the line coin or gem
    expect(FIXTURE_NAMES).not.toContain('coin');
    expect(FIXTURE_NAMES).not.toContain('gem');
    expect([...FIXTURE.matchAll(/data-cur="(\w+)"/g)].map((m) => m[1]).sort()).toEqual(['coins', 'coins', 'gems', 'gems']);
  });
  it('a 24 grid: a 0 0 24 24 view box and every coordinate inside it', () => {
    for (const [n, body] of Object.entries(LINE_GLYPHS)) {
      expect(lineGlyph(n)).toContain('viewBox="0 0 24 24"');
      for (const [, v] of body.matchAll(/(-?\d*\.?\d+)/g)) expect(Math.abs(Number(v)), `${n}: ${v}`).toBeLessThanOrEqual(24);
    }
  });
  it('currentColor line art: strokes from the svg, no fills except dots of 2 px or more and the play triangle', () => {
    const svg = lineGlyph('mail');
    expect(svg).toMatch(/fill="none"/);
    expect(svg).toMatch(/stroke="currentColor"/);
    expect(svg).toMatch(/stroke-width="1.5"/);
    for (const [n, body] of Object.entries(LINE_GLYPHS)) {
      const fills = [...body.matchAll(/<(\w+)[^>]*fill="currentColor"[^>]*>/g)];
      for (const [tag, el] of fills.map((m) => [m[1], m[0]])) {
        if (n === 'play') { expect(tag).toBe('path'); continue; }
        expect(tag, n).toBe('circle');
        expect(Number(/r="([\d.]+)"/.exec(el)[1]) * 2, `${n}: a dot under 2 px`).toBeGreaterThanOrEqual(2);
      }
      expect(body, n).not.toMatch(/fill="(?!none|currentColor)/);
    }
    expect(Object.keys(LINE_GLYPHS).filter((n) => /fill="currentColor"/.test(LINE_GLYPHS[n])).sort()).toEqual(['help', 'info', 'key', 'play', 'target']);
  });
  it('the frame glyphs cut their top-right corner by 2.5 px (the panel chamfer in miniature)', () => {
    for (const n of FRAME_GLYPHS) {
      const segs = [...LINE_GLYPHS[n].matchAll(/ d="([^"]+)"/g)].flatMap((m) => segments(m[1]));
      expect(segs.some(([dx, dy]) => Math.abs(Math.abs(dx) - 2.5) < 1e-6 && Math.abs(Math.abs(dy) - 2.5) < 1e-6), n).toBe(true);
    }
  });
  it('the game icon names chrome uses map onto line glyphs; game-data icons do not', () => {
    for (const [from, to] of Object.entries(LINE_ALIASES)) expect(hasLineGlyph(to), `${from} → ${to}`).toBe(true);
    expect(lineFor('home')).toBe('house');
    expect(lineFor('close')).toBe('x');
    expect(lineFor('settings')).toBe('settings');
    expect(lineFor('calendar')).toBe('daily');
    for (const dataIcon of ['marksman', 'fire', 'frost', 'armorPen', 'slow', 'bounty', 'assault', 'sell', 'teleport', 'dice']) expect(lineFor(dataIcon), dataIcon).toBeNull();
  });
  it('class "g lg" plus the size, or "lg" alone for a game icon in its own box', () => {
    expect(lineGlyph('check', 's')).toMatch(/class="g lg s"/);
    expect(lineGlyph('check', '', { kitSize: false })).toMatch(/class="lg"/);
    expect(() => lineGlyph('nope')).toThrow(/no line glyph/);
  });
  it('a chapter emblem for each of the eight chapters (V2 drew the other six), each the rings, four ticks (the first cyan) and its glyph', () => {
    expect(Object.keys(EMBLEM_GLYPHS).sort()).toEqual(['cog', 'gate', 'lantern', 'moon', 'petal', 'reeds', 'shrine', 'wing']);
    expect({ ...CHAPTER_EMBLEMS }).toEqual({ 1: 'petal', 2: 'moon', 3: 'shrine', 4: 'gate', 5: 'reeds', 6: 'cog', 7: 'lantern', 8: 'wing' });
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8]) expect(EMBLEM_GLYPHS[chapterEmblem(id)], `chapter ${id}`).toBeTruthy();
    expect(chapterEmblem(99)).toBe('gate');
    for (const n of Object.keys(EMBLEM_GLYPHS)) {
      // the glyph inside the inner ring (r 22.6): every stroke starts inside it
      for (const [, x, y] of EMBLEM_GLYPHS[n].matchAll(/M\s*(-?\d*\.?\d+)[\s,]*(-?\d*\.?\d+)/g)) expect(Math.hypot(Number(x), Number(y)), `${n}: M${x} ${y}`).toBeLessThanOrEqual(21);
      // line art: no fills
      expect(EMBLEM_GLYPHS[n], n).not.toMatch(/fill=/);
    }
    for (const n of Object.keys(EMBLEM_GLYPHS)) {
      const svg = emblemSvg(n, { size: 64 });
      expect(svg).toMatch(/width="64" height="64"/);
      expect((svg.match(/class="tk-on"/g) || []).length).toBe(1);
      expect((svg.match(/class="tk"/g) || []).length).toBe(3);
      expect(svg).toContain(EMBLEM_GLYPHS[n]);
    }
  });
});
