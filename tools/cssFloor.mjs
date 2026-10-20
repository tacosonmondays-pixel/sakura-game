// CSS floor lint (docs/specs/UI_DIRECTION.md §8, gate 1): counts the `font-size` and `font:` declarations under
// 12 px in every stylesheet under src/, outside `.deco` rules. A ratchet, not a big bang: each file's count may only
// go down. The stored baseline is tools/cssFloor.baseline.json; a file over its baseline (or a new file with any)
// fails.
//
//   node tools/cssFloor.mjs            # report + check against the baseline (exit 1 on a rise)
//   node tools/cssFloor.mjs --list     # also print every offending declaration
//   node tools/cssFloor.mjs --update   # lower the baseline to today's counts (never raises one)
//
// Sizes: px as is, rem and em at 16 px (the root size; em is a floor estimate), pt × 4/3. clamp() / min() / max()
// count by their smallest fixed size. var(), %, keywords (small, smaller, inherit) and calc() with no fixed size
// are not counted.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'tools', 'cssFloor.baseline.json');
export const FLOOR_PX = 12;

function cssFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...cssFiles(p));
    else if (name.endsWith('.css')) out.push(p);
  }
  return out.sort();
}

/** The fixed sizes (px) in a value, or [] when none (var(), %, keywords). */
function sizesPx(value) {
  const out = [];
  for (const [, n, unit] of value.matchAll(/(-?\d*\.?\d+)(px|rem|em|pt)\b/g)) {
    const v = Number(n);
    out.push(unit === 'px' ? v : unit === 'pt' ? (v * 4) / 3 : v * 16);
  }
  return out;
}

/** The font size of a `font:` shorthand: the token before the optional "/line-height" and the family. */
function shorthandSize(value) {
  const v = value.replace(/var\([^)]*\)/g, (m) => m.replace(/\s+/g, ''));
  const m = v.match(/(?:^|\s)((?:clamp|min|max|calc)\([^)]*\)|-?\d*\.?\d+(?:px|rem|em|pt))(?:\s*\/\s*[^\s]+)?\s+[^\s]/);
  return m ? m[1] : null;
}

/** Declarations under the floor in one stylesheet: [{ line, selector, decl, px }]. */
export function scanCss(css) {
  const found = [];
  // blank out comments but keep line numbers
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const lineAt = (idx) => text.slice(0, idx).split('\n').length;
  const stack = [];
  let buf = '';
  let start = -1; // index of the first non-space character of the current chunk
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      stack.push(buf.trim());
      buf = '';
      start = -1;
    } else if (ch === '}' || ch === ';') {
      if (start >= 0) check(buf.trim(), lineAt(start));
      if (ch === '}') stack.pop();
      buf = '';
      start = -1;
    } else {
      if (start < 0 && !/\s/.test(ch)) start = i;
      buf += ch;
    }
  }
  function check(decl, at) {
    const m = /^(font-size|font)\s*:\s*([\s\S]+)$/i.exec(decl);
    if (!m) return;
    const selector = stack.filter((s) => !s.startsWith('@')).at(-1) || '';
    if (/\.deco\b/.test(selector)) return;
    const value = m[1].toLowerCase() === 'font' ? shorthandSize(m[2].trim()) : m[2].trim();
    if (!value) return;
    const px = sizesPx(value);
    if (!px.length) return;
    const size = Math.min(...px);
    if (size < FLOOR_PX) found.push({ line: at, selector: selector.replace(/\s+/g, ' '), decl: decl.replace(/\s+/g, ' '), px: Math.round(size * 100) / 100 });
  }
  return found;
}

/** { 'src/ui/styles/x.css': [...offenders] } for every stylesheet under src/. */
export function scanAll() {
  const out = {};
  for (const f of cssFiles(join(ROOT, 'src'))) out[relative(ROOT, f).split('\\').join('/')] = scanCss(readFileSync(f, 'utf8'));
  return out;
}

export function readBaseline() {
  return existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')).files : {};
}

/** Files whose count went over the baseline (a missing file in the baseline counts as 0). */
export function compare(scan, baseline) {
  const rises = [];
  for (const [file, list] of Object.entries(scan)) {
    const base = baseline[file] ?? 0;
    if (list.length > base) rises.push({ file, count: list.length, baseline: base });
  }
  return rises;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const scan = scanAll();
  const baseline = readBaseline();
  let total = 0;
  for (const [file, list] of Object.entries(scan)) {
    total += list.length;
    if (!list.length && !baseline[file]) continue;
    const base = baseline[file] ?? 0;
    const mark = list.length > base ? '  ▲ OVER' : list.length < base ? '  ▼ down' : '';
    console.log(`${String(list.length).padStart(4)}  (baseline ${String(base).padStart(3)})  ${file}${mark}`);
    if (args.includes('--list')) for (const d of list) console.log(`        ${d.line}: ${d.selector} { ${d.decl} }  → ${d.px}px`);
  }
  const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
  console.log(`total ${total} declarations under ${FLOOR_PX}px outside .deco (baseline ${baseTotal})`);
  if (args.includes('--update')) {
    const next = {};
    for (const [file, list] of Object.entries(scan)) {
      const base = baseline[file];
      const n = base == null ? list.length : Math.min(base, list.length);
      if (n) next[file] = n;
    }
    const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(BASELINE, `${JSON.stringify({ floorPx: FLOOR_PX, note: 'Per-file counts may only go down (docs/specs/UI_DIRECTION.md §8). Lower with: node tools/cssFloor.mjs --update', files: sorted }, null, 2)}\n`);
    console.log(`baseline written: ${Object.values(sorted).reduce((a, b) => a + b, 0)}`);
  }
  const rises = compare(scan, baseline);
  for (const r of rises) console.log(`FAIL ${r.file}: ${r.count} declarations under ${FLOOR_PX}px (baseline ${r.baseline})`);
  process.exit(rises.length ? 1 : 0);
}
