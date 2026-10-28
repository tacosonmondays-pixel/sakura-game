// The scene player's root is `.sp` (src/ui/styles/story.css: fixed, full screen, z-index 300, near-black). Its styles stay
// loaded once a story screen has opened, so an element outside the story player that wears a bare `sp` class turns into
// a black layer over the whole screen (the home's top-bar spacer once did, after Story, Journal or the opening scene).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : [p]; });

describe('the story root class stays the story player\'s', () => {
  it('no UI file outside src/ui/story builds an element with a bare .sp class', () => {
    const hits = [];
    for (const f of files('src/ui').filter((p) => p.endsWith('.js') && !p.includes(join('src', 'ui', 'story')))) {
      const src = readFileSync(f, 'utf8');
      // h('tag.sp'), h('tag.a.sp.b'), h(`div.sp${…}`): a selector string whose class list holds `sp` on its own
      for (const m of src.matchAll(/h\(\s*['"`]([a-z0-9]*(?:\.[\w-]+|\$\{[^}]*\})*)/gi)) {
        if (m[1].split('.').slice(1).includes('sp')) hits.push(`${f}: ${m[0]}`);
      }
      if (/classList\.add\(\s*['"]sp['"]|className\s*=\s*['"]sp['" ]/.test(src)) hits.push(`${f}: classList/className sp`);
    }
    expect(hits).toEqual([]);
  });
  it('no stylesheet other than story.css styles a bare .sp', () => {
    const hits = readdirSync('src/ui/styles').filter((n) => n.endsWith('.css') && n !== 'story.css')
      .filter((n) => /\.sp(?![\w-])/.test(readFileSync(join('src/ui/styles', n), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')));
    expect(hits).toEqual([]);
  });
});
