// HANDOFF §6 "Names": no other game's or anime's name in code, docs, tests or tools. The names are checked by hash so
// this file never spells them out (the same idea as tests/data/achievements.test.js). A hit prints the file and line;
// rewrite it in our own words (a placeholder like "[the reference TD game]" inside an owner quote).
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIRS = ['src', 'docs', 'tests', 'e2e', 'tools', 'previews', 'supabase'];
const TOP = ['README.md', 'CONTRACTS.md', 'CLAUDE.md', 'index.html'];
const EXT = new Set(['.js', '.mjs', '.cjs', '.md', '.txt', '.css', '.html', '.py', '.json', '.sql', '.yml', '.yaml']);
// (git-ignored folders too: local reference shots, renders, caches, private fonts, e2e output)
const SKIP = new Set(['node_modules', 'dist', '.git', 'cache', 'build', 'private', 'out', 'thirdparty']);

/** sha256 (first 16 hex) of each lower-case name or two-word name. */
const BANNED = new Set([
  'a95ea24dce17386d', 'aea3f60cd08a93ff', 'd2c76d1c39851cb7', '1858de2a69bb5e3b', '3d7dd07e0152d1e5', 'b87fd15e47995967',
  '0b49b310b47d3be4', 'ca5d07252d99f5b5', '28079be306e978d3', 'bf756d984a7758c2', 'a9dc6dae308b1d1d', '856b73d026fffbec',
  '4b4c654410f25eb8', '5ad2c16222cf9c57', '61c220d696ce5502', 'eaa2bded32cc585d', '7c5232c54cf5dce6', '8d01416611a03b7c',
  'abffbe4fe8a67dfd', 'f11876c74ace8c5c', '57143466352c3ab3', '073ca93741e8c2ff', 'fd129c14475d47d7', 'e900eabe043a4f03',
  '8cdc99edef7b5d77', 'ffe4df2f28dd2c4a', '157eacb84ec0fc8b', '1645e59ce27f63eb', 'be4b8fc3fcdc660a', '0d53820772a05c89',
  '363ad2cd8099c90e',
]);
/** Known hits that cannot change in a display-only release: a map's design note inside the co-op build id. */
const ALLOWED = new Set(['src/data/maps.js:fd129c14475d47d7']);

const memo = new Map();
const hash = (s) => {
  let h = memo.get(s);
  if (h === undefined) memo.set(s, (h = createHash('sha256').update(s).digest('hex').slice(0, 16)));
  return h;
};

function files() {
  const out = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      if (SKIP.has(f)) continue;
      const p = join(d, f);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (EXT.has(extname(f).toLowerCase()) && st.size < 3e6) out.push(p);
    }
  };
  for (const d of DIRS) { try { walk(join(ROOT, d)); } catch { /* a folder this checkout doesn't have */ } }
  for (const f of TOP) { try { if (statSync(join(ROOT, f)).isFile()) out.push(join(ROOT, f)); } catch { /* none */ } }
  return out;
}

describe("other games' names", () => {
  it('appear nowhere in the repo text (by hash)', () => {
    const hits = [];
    for (const p of files()) {
      const rel = relative(ROOT, p).split('\\').join('/');
      const lines = readFileSync(p, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const words = line.toLowerCase().match(/[\p{L}\p{N}]+/gu);
        if (!words) return;
        for (let k = 0; k < words.length; k++) {
          for (const s of [words[k], k + 1 < words.length ? `${words[k]} ${words[k + 1]}` : null]) {
            if (!s || s.length < 4 || s.length > 16) continue;
            const h = hash(s);
            if (BANNED.has(h) && !ALLOWED.has(`${rel}:${h}`)) hits.push(`${rel}:${i + 1}`);
          }
        }
      });
    }
    expect(hits).toEqual([]);
  }, 60000);
});
