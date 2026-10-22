// The battle tree at phone landscape (844x390): a tier's effect line wraps onto a second line instead of ending in "…"
// (Steel Broadheads read "+2 dmg · Ignores 2 ar…"). The layout itself is checked in a browser by e2e/unit-info.mjs
// (step 15, "no tier name or effect line cut short at phone landscape"); this guards the CSS that makes it so.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../src/ui/styles/unit-info.css', import.meta.url), 'utf8');
/** The body of the first `@media (<query>) { … }` block. */
function media(query) {
  const at = css.indexOf(`@media (${query})`);
  expect(at, query).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = css.indexOf('{', at); i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(css.indexOf('{', at) + 1, i);
  }
  return '';
}
const rule = (block, sel) => (block.match(new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g')) || []).join(' ');

describe('battle tree cells at phone landscape', () => {
  it('the effect line wraps to two lines, never one line with an ellipsis', () => {
    const eff = rule(media('max-height: 500px'), '.ut-overlay .ut-eff');
    expect(eff).toMatch(/white-space:\s*normal/);
    expect(eff).toMatch(/-webkit-line-clamp:\s*2/);
    expect(eff).not.toMatch(/nowrap/);
    expect(eff).toMatch(/text-overflow:\s*clip/);
  });

  it('the room for it comes from a smaller tier icon and slimmer padding at ≤ 420 px tall (all 15 cells stay on screen)', () => {
    const short = media('max-height: 420px');
    expect(rule(short, '.ut-overlay .ut-grid')).toMatch(/--circle:\s*26px/);
    expect(rule(short, '.ut-overlay .ut-cell')).toMatch(/padding-top:\s*2px/);
  });
});
