// Node ESM loader hook so plain `node` can import the sim. src/sim/data.js resolves the game
// data with Vite's `import.meta.glob([...], { eager: true })`, which only exists under
// Vite/Vitest. This hook rewrites that call into static namespace imports (literal paths
// and simple `*` patterns; files that do not exist are left out, exactly like Vite).
// Registered by tools/balance/register.mjs — never imported by game code.

import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const GLOB_CALL = /import\.meta\.glob\(\s*(\[[^\]]*\]|'[^']*'|"[^"]*")\s*,\s*\{\s*eager\s*:\s*true\s*,?\s*\}\s*,?\s*\)/g;
const STRING = /'([^']*)'|"([^"]*)"/g;

/** Expands one glob pattern (relative to `dir`) into existing relative paths. */
function expand(pattern, dir) {
  if (!pattern.includes('*')) return existsSync(path.resolve(dir, pattern)) ? [pattern] : [];
  const slash = pattern.lastIndexOf('/');
  const folder = pattern.slice(0, slash + 1);
  const re = new RegExp(`^${pattern.slice(slash + 1).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
  const abs = path.resolve(dir, folder || './');
  if (!existsSync(abs)) return [];
  return readdirSync(abs).filter((f) => re.test(f)).sort().map((f) => `${folder}${f}`);
}

/** Rewrites eager import.meta.glob calls in one module's source. */
export function rewriteGlobs(source, fileUrl) {
  if (!source.includes('import.meta.glob')) return source;
  const dir = path.dirname(fileURLToPath(fileUrl));
  const header = [];
  let n = 0;
  const out = source.replace(GLOB_CALL, (_, arg) => {
    const patterns = [...arg.matchAll(STRING)].map((m) => m[1] ?? m[2]);
    const entries = [];
    for (const p of patterns) {
      for (const rel of expand(p, dir)) {
        const name = `__balanceGlob${n++}`;
        header.push(`import * as ${name} from ${JSON.stringify(rel)};`);
        entries.push(`${JSON.stringify(rel)}: ${name}`);
      }
    }
    return `({ ${entries.join(', ')} })`;
  });
  return `${header.join('\n')}\n${out}`;
}

/** Node `load` hook. */
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (!url.startsWith('file:') || !url.includes('/src/') || result.format !== 'module') return result;
  const text = typeof result.source === 'string' ? result.source : Buffer.from(result.source).toString('utf8');
  if (!text.includes('import.meta.glob')) return result;
  return { ...result, source: rewriteGlobs(text, url) };
}
