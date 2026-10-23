// Contrast table (docs/specs/UI_DIRECTION.md §8, gate 4): every token pair used as text, with WCAG ratios read from
// the real token values in src/ui/styles/base.css. Translucent backgrounds are composited over the surface they sit
// on (the worst case where it varies). Text needs 4.5:1; numbers of 22 px and up need 3:1.
//
//   node tools/contrast.mjs            # markdown table; exit 1 when a pair fails
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE_CSS = new URL('../src/ui/styles/base.css', import.meta.url);

/** The custom properties of base.css's top-level :root block, var() resolved. */
export function tokens() {
  const css = readFileSync(BASE_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const block = css.match(/(?:^|\n):root\s*\{([\s\S]*?)\n\}/)[1];
  const t = {};
  for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) t[name] = value.trim();
  for (const k of Object.keys(t)) {
    for (let i = 0; i < 5; i++) {
      const m = /^var\((--[\w-]+)\)$/.exec(t[k]);
      if (!m) break;
      t[k] = t[m[1]];
    }
  }
  return t;
}

/** '#rgb', '#rrggbb', 'white', 'rgba(r, g, b, a)' → [r, g, b, a]. */
export function parse(c) {
  c = String(c).trim().toLowerCase();
  if (c === 'white') return [255, 255, 255, 1];
  if (c === 'black') return [0, 0, 0, 1];
  let m = /^#([0-9a-f]{3})$/.exec(c);
  if (m) return [...m[1]].map((x) => parseInt(x + x, 16)).concat(1);
  m = /^#([0-9a-f]{6})$/.exec(c);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = /^rgba?\(([^)]+)\)$/.exec(c);
  if (m) {
    const p = m[1].split(',').map((x) => Number(x.trim()));
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  throw new Error(`contrast: cannot parse colour "${c}"`);
}

/** A colour over a stack of layers, bottom first: composite(['#cfe8ff', 'rgba(255,255,255,0.9)']). */
export function composite(layers) {
  let out = [0, 0, 0];
  for (const layer of layers) {
    const [r, g, b, a] = parse(layer);
    out = [r * a + out[0] * (1 - a), g * a + out[1] * (1 - a), b * a + out[2] * (1 - a)];
  }
  return out;
}

const lin = (v) => {
  v /= 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export function ratio(fg, bg) {
  const a = lum(fg);
  const b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * The text pairs in use: [text token or colour, background layers (bottom first), where, min ratio].
 * Token names are looked up in base.css; anything else is a literal colour.
 */
export const PAIRS = [
  // light surfaces: body ink and the darker muted
  ['--ink', ['white'], 'body text on a white panel', 4.5],
  ['--ink', ['--sky-1'], 'stat chip number on its --sky-1 fill', 4.5],
  ['--ink', ['--sky-3', 'rgba(255, 255, 255, 0.72)'], 'inactive tab word on the rail (over --sky-3, the darkest sky)', 4.5],
  ['--ink', ['--yellow'], 'MORE sticker / primary button label', 4.5],
  ['--plate', ['--pink'], 'pink sticker letters', 4.5],
  ['--muted', ['white'], 'secondary text on white', 4.5],
  ['--muted', ['--panel-solid', '--panel'], 'secondary text on a glass panel', 4.5],
  ['--muted', ['--sky-3', '--panel'], 'secondary text on a glass panel over --sky-3', 4.5],
  ['--muted', ['--sky-1'], 'chip label on --sky-1', 4.5],
  ['--muted', ['--sky-2'], 'secondary text on --sky-2', 4.5],
  ['--muted', ['--blue-soft'], 'secondary text on --blue-soft', 4.5],
  ['--muted', ['--sky-3', 'rgba(255, 255, 255, 0.72)'], 'locked tab word on the rail', 4.5],
  ['--muted', ['black', 'rgba(255, 255, 255, 0.92)'], 'drawer body text (worst case: a black map behind it)', 4.5],
  ['--muted', ['#e6ecf4'], '"Medal owned" tag on the results screen (battle.css .bt-medal-tag.old)', 4.5],
  ['--ink', ['#d8dbda'], 'an idle club trick on the flat-grey set chip (girl.css .gk-set.idle)', 4.5],
  ['--plate', ['#d8dbda'], 'flat-grey sticker letters (components.css .ui-sticker.off, gear-ur.css .gu-strip-line.idle b)', 4.5],
  ['--blue-text', ['white'], 'links, "+N" chip, ghost button', 4.5],
  ['--blue-text', ['--sky-2'], 'selected text on --sky-2', 4.5],
  ['white', ['--blue-text'], 'white on a --blue-text fill', 4.5],
  ['--pink-text', ['white'], 'hero / selection text on white', 4.5],
  ['--pink-text', ['--pink-soft'], 'in-progress text on --pink-soft', 4.5],
  ['--good-text', ['white'], '▲ delta chip on white', 4.5],
  ['--good-text', ['--sky-1'], '▲ delta chip on its --sky-1 fill', 4.5],
  ['--good-text', ['--sky-2'], 'ready text on --sky-2', 4.5],
  ['--bad-text', ['white'], '▼ delta chip / danger label on white', 4.5],
  ['--bad-text', ['--sky-1'], '▼ delta chip on its --sky-1 fill', 4.5],
  ['--bad-text', ['--sky-2'], 'warning on --sky-2', 4.5],
  // ink plates
  ['--on-plate', ['--plate'], 'numbers and names on a plate', 4.5],
  ['--on-plate', ['--sky-3', '--plate-glass'], 'white on the glass plate over a light map', 4.5],
  ['--on-plate', ['--plate', 'rgba(255, 255, 255, 0.08)'], 'number in an on-plate chip', 4.5],
  ['--on-plate-dim', ['--plate'], 'caps labels on a plate; an unaffordable price', 4.5],
  ['--on-plate-dim', ['--plate', 'rgba(255, 255, 255, 0.08)'], 'label in an on-plate chip', 4.5],
  ['--on-plate-dim', ['--sky-3', '--plate-glass'], 'caps label on the glass plate over a light map', 4.5],
  ['--plate-accent', ['--plate'], 'the accent number / an affordable price', 4.5],
  ['--good-on-plate', ['--plate'], '▲ delta on a plate', 4.5],
  ['--good-on-plate', ['--plate', 'rgba(255, 255, 255, 0.08)'], '▲ delta in an on-plate chip', 4.5],
  ['--bad-on-plate', ['--plate'], '▼ delta / warning on a plate', 4.5],
  ['--bad-on-plate', ['--plate', 'rgba(255, 255, 255, 0.08)'], '▼ delta in an on-plate chip', 4.5],
  ['--blue-on-plate', ['--plate'], 'links / selection on a plate', 4.5],
  // rarity tags: rarity-coloured letters on --plate (12-13 px caps, so 4.5:1)
  ['--rar-r', ['--plate'], 'R tag', 4.5],
  ['--rar-sr', ['--plate'], 'SR tag', 4.5],
  ['--rar-ssr', ['--plate'], 'SSR tag', 4.5],
  ['--rar-ur', ['--plate'], 'UR tag (flat)', 4.5],
  ['#ff9bc8', ['--plate'], 'UR tag gradient stop 1', 4.5],
  ['#ffe066', ['--plate'], 'UR tag gradient stop 2', 4.5],
  ['#8ef0b0', ['--plate'], 'UR tag gradient stop 3', 4.5],
  ['#7fd3ff', ['--plate'], 'UR tag gradient stop 4', 4.5],
  ['#c9a8ff', ['--plate'], 'UR tag gradient stop 5', 4.5],
  ['--rar-lr', ['--lr-edge'], 'LR tag (gold end)', 4.5],
  ['white', ['--lr-edge'], 'LR tag (white end)', 4.5],
  ['--gear-common', ['--plate'], 'Common tag', 4.5],
  ['--gear-rare', ['--plate'], 'Rare tag', 4.5],
  ['--gear-super', ['--plate'], 'Super Rare tag', 4.5],
  ['--gear-mythic', ['--plate'], 'Mythic tag', 4.5],
  ['--gear-legendary', ['--plate'], 'Legendary tag', 4.5],
];

/** The table rows: { text, bg, where, ratio, min, ok }. */
export function contrastTable(t = tokens()) {
  const col = (c) => (c.startsWith('--') ? t[c] : c);
  return PAIRS.map(([fg, layers, where, min]) => {
    const r = ratio(composite([col(fg)]), composite(layers.map(col)));
    return { text: fg, bg: layers.join(' + '), where, ratio: Math.round(r * 100) / 100, min, ok: r >= min };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rows = contrastTable();
  console.log('| Text | Background (bottom first) | Used for | Ratio | Needs | |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| \`${r.text}\` | ${r.bg.replace(/--[\w-]+/g, (m) => `\`${m}\``)} | ${r.where} | ${r.ratio.toFixed(2)} | ${r.min} | ${r.ok ? 'pass' : '**FAIL**'} |`);
  const bad = rows.filter((r) => !r.ok);
  console.log(`\n${rows.length - bad.length}/${rows.length} pairs pass`);
  process.exit(bad.length ? 1 : 0);
}
