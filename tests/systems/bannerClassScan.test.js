// BANNERS §I.1 G0: every rule that must keep LR units out (spark, Select Ticket, Chosen Essence, the Standard pool)
// asks unitClass(), never the rarity: LR units keep rarity 'SSR' in their data. This scan fails when a new file
// starts reading POOL.SSR or `rarity === 'SSR'`; a file is allowed only after checking that its use is about the
// look or the Potential track (where an LR unit really is an SSR), not about who can be pulled or chosen.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ALLOW = new Set([
  'src/art/card/scene.js', // card art: SSR glow and the UR look
  'src/art/icons/ascension.js', // Essence icon art by rarity
  'src/data/banners.js', // the class rule itself
  'src/data/shop.js', // spark rows: rarity AND unitClass
  'src/systems/achievementMetrics.js', // UR count (an LR unit at ★5 is UR too)
  'src/systems/banners.js', // the class rule itself
  'src/systems/gacha.js', // pity line bookkeeping (SSR-class results, LR included)
  'src/systems/potential.js', // Potential estimates by rarity track
  'src/systems/profileTrophies.js', // UR trophy (an LR unit at ★5 is UR too)
  'src/systems/shop.js', // Chosen Essence: rarity AND chosenEssenceAllowed
  'src/systems/limitBreak.js', // UR Resonance: every SSR at ★5 (LR units included)
  'src/ui/screens/student.js', // the ★5 → UR preview line
  'src/ui/potential.js', // Kindred by rarity (Kindred is allowed on LR units, J14)
  'src/ui/rarity.js', // the UR look
  'src/ui/screens/backpack.js', // the how-to-get line: unitClass first
  'src/ui/screens/recruit.js', // the reveal's SSR moment
]);

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

describe('class scan (BANNERS §I.1 G0)', () => {
  it('nothing outside the allowlist decides on POOL.SSR or rarity === SSR', () => {
    const hits = walk('src').filter((f) => !f.startsWith('src/sim/') && /POOL\.SSR|rarity\s*[!=]==\s*'SSR'/.test(readFileSync(f, 'utf8')));
    expect(hits.filter((f) => !ALLOW.has(f))).toEqual([]);
  });
});
