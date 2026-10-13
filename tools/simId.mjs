// Which co-op clients can play together (src/online/coop/version.js): two builds are compatible
// when everything the lockstep battle runs on is byte-identical — the sim, the co-op protocol
// code, the data they read and the adapters' net settings (input delay). This hashes exactly
// those source files: the static + literal dynamic import graph from the entry points below.
// A deploy that only touches art, audio, menus or the renderer keeps the same id, so an open tab
// from before that deploy can still play with a fresh one.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, join } from 'node:path';

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
// import.meta.glob(['../data/units.js', …]) in src/sim/data.js: literal paths only (no wildcards)
const GLOB_RE = /import\.meta\.glob\(\s*(\[[^\]]*\]|['"][^'"]+['"])/g;

/** Entry points (relative to the repo root): every file in these folders. */
export const SIM_ENTRY_DIRS = ['src/sim', 'src/online/coop', 'src/online/adapters'];

function filesIn(root, dir) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).filter((f) => f.endsWith('.js')).map((f) => join(abs, f));
}

function resolveImport(from, spec) {
  if (!spec.startsWith('.')) return null; // packages: pinned by package-lock, not hashed here
  let p = resolve(dirname(from), spec);
  if (!p.endsWith('.js') && existsSync(p + '.js')) p += '.js';
  return existsSync(p) && statSync(p).isFile() && p.endsWith('.js') ? p : null;
}

/** @returns {{ id: string, files: string[] }} 12 hex chars + the hashed files (repo-relative). */
export function simId(root = process.cwd(), dirs = SIM_ENTRY_DIRS) {
  const seen = new Set();
  const stack = dirs.flatMap((d) => filesIn(root, d));
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    const specs = [...src.matchAll(IMPORT_RE)].map((m) => m[1] || m[2] || m[3]);
    for (const g of src.matchAll(GLOB_RE)) specs.push(...[...g[1].matchAll(/['"]([^'"*]+)['"]/g)].map((m) => m[1]));
    for (const spec of specs) {
      const next = resolveImport(file, spec);
      if (next && !seen.has(next)) stack.push(next);
    }
  }
  const files = [...seen].map((f) => relative(root, f).split('\\').join('/')).sort();
  const h = createHash('sha256');
  for (const f of files) h.update(f).update('\0').update(readFileSync(join(root, f), 'utf8').replace(/\r\n/g, '\n')).update('\0');
  return { id: h.digest('hex').slice(0, 12), files };
}
