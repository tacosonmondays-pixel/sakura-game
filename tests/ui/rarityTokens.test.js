// The CSS rarity tokens (src/ui/styles/base.css, docs/specs/UI_DIRECTION.md §4.8) mirror the JS colours, which stay
// the source of truth for game data: UNIT_RARITIES and ITEM_RARITIES in src/data/types.js, and UR in src/ui/rarity.js.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { UNIT_RARITIES, ITEM_RARITIES } from '../../src/data/types.js';

vi.mock('../../src/ui/styles/ur.css', () => ({}));
const rarity = await import('../../src/ui/rarity.js');

/** The custom properties declared in base.css's top-level :root block. */
function rootTokens() {
  const css = readFileSync(new URL('../../src/ui/styles/base.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const block = css.match(/(?:^|\n):root\s*\{([\s\S]*?)\n\}/)[1];
  const tokens = {};
  for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens[name] = value.trim();
  return tokens;
}
const resolve = (tokens, v) => {
  for (let i = 0; i < 5; i++) {
    const m = /^var\((--[\w-]+)\)$/.exec(v);
    if (!m) break;
    v = tokens[m[1]];
  }
  return String(v).toLowerCase();
};

const UNIT_TOKEN = { R: '--rar-r', SR: '--rar-sr', SSR: '--rar-ssr', UR: '--rar-ur', LR: '--rar-lr' };
const ITEM_TOKEN = { common: '--gear-common', rare: '--gear-rare', superRare: '--gear-super', mythic: '--gear-mythic', legendary: '--gear-legendary' };

describe('CSS rarity tokens = JS rarity colours', () => {
  const tokens = rootTokens();

  it('every girl rarity in UNIT_RARITIES has its token, with the same colour', () => {
    for (const [id, r] of Object.entries(UNIT_RARITIES)) {
      expect(UNIT_TOKEN[id], `a token name for ${id}`).toBeTruthy();
      expect(resolve(tokens, tokens[UNIT_TOKEN[id]]), `${UNIT_TOKEN[id]} vs UNIT_RARITIES.${id}.color`).toBe(r.color.toLowerCase());
    }
  });

  it('UR (display rarity in src/ui/rarity.js) matches --rar-ur', () => {
    expect(resolve(tokens, tokens['--rar-ur'])).toBe(rarity.UR.color.toLowerCase());
    expect(resolve(tokens, tokens['--rar-ur'])).toBe(rarity.rarityInfo('UR').color.toLowerCase());
  });

  it('LR, once the JS defines it, matches --rar-lr (and --lr-gold until then)', () => {
    const lr = rarity.LR?.color || UNIT_RARITIES.LR?.color || null;
    expect(resolve(tokens, tokens['--rar-lr'])).toBe((lr || resolve(tokens, tokens['--lr-gold'])).toLowerCase());
  });

  it('every gear rarity in ITEM_RARITIES has its token, with the same colour', () => {
    for (const [id, r] of Object.entries(ITEM_RARITIES)) {
      expect(ITEM_TOKEN[id], `a token name for ${id}`).toBeTruthy();
      expect(resolve(tokens, tokens[ITEM_TOKEN[id]]), `${ITEM_TOKEN[id]} vs ITEM_RARITIES.${id}.color`).toBe(r.color.toLowerCase());
    }
  });

  it('the existing tokens are still there (additive), and only --muted changed', () => {
    for (const t of ['--sky-1', '--sky-2', '--sky-3', '--blue', '--blue-soft', '--blue-deep', '--navy', '--ink', '--panel', '--panel-solid', '--panel-border', '--line', '--yellow', '--yellow-deep', '--pink', '--pink-soft', '--good', '--bad', '--shadow', '--shadow-strong', '--radius', '--skew', '--font', '--font-head', '--gutter', '--ease', '--t-press', '--t-panel', '--t-screen']) {
      expect(tokens[t], t).toBeTruthy();
    }
    expect(tokens['--muted']).toBe('#56647f');
    expect(tokens['--muted-line']).toBe('#6b7a99');
    expect(tokens['--ink']).toBe('#1f2a44');
  });
});
