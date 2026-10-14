// UR display (owner, Oct 14: "when you awaken ssr's all the way, give it a rainbow border, and
// change the ssr to UR with rainbow font"). displayRarity is display only: an owned SSR at the
// last awaken star shows as UR; everything else keeps its drop rarity, and the game data
// (UNIT_RARITIES, the gacha pools) never learns about UR.
import { describe, it, expect } from 'vitest';
import { displayRarity, isUR, rarityInfo, rarityColor, UR, DISPLAY_RARITY_RANK } from '../../src/ui/rarity.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { UNIT_RARITIES } from '../../src/data/types.js';
import { MAX_AWAKEN } from '../../src/systems/progression.js';
import { POOL } from '../../src/systems/gacha.js';
import { createProfile } from '../../src/systems/save.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { cardArtSVG } from '../../src/art/cardArt.js';

const byRarity = (r) => UNITS.find((u) => u.rarity === r && u.kind === 'tower') || UNITS.find((u) => u.rarity === r);
const SSR = byRarity('SSR');
const SR = byRarity('SR');
const R = byRarity('R');

function profileWith(entries) {
  const p = createProfile();
  for (const [id, awaken] of entries) {
    if (!p.units[id]) grantUnit(p, id);
    p.units[id].awaken = awaken;
  }
  return p;
}

describe('displayRarity', () => {
  it('has one girl of every rarity to test with', () => {
    expect(SSR && SR && R).toBeTruthy();
    expect(MAX_AWAKEN).toBe(5);
  });

  it('an owned SSR at the last awaken star shows as UR', () => {
    const p = profileWith([[SSR.id, MAX_AWAKEN]]);
    expect(displayRarity(SSR.id, p)).toBe('UR');
    expect(displayRarity(SSR, p)).toBe('UR'); // a def (battle) works the same as an id
    expect(isUR(SSR.id, p)).toBe(true);
  });

  it('an SSR one star short (★4) is still SSR, and so is ★0', () => {
    expect(displayRarity(SSR.id, profileWith([[SSR.id, 4]]))).toBe('SSR');
    expect(displayRarity(SSR.id, profileWith([[SSR.id, 0]]))).toBe('SSR');
    expect(isUR(SSR.id, profileWith([[SSR.id, 4]]))).toBe(false);
  });

  it('an unowned SSR is SSR (no profile, or a profile without her)', () => {
    const p = createProfile();
    delete p.units[SSR.id];
    expect(displayRarity(SSR.id, p)).toBe('SSR');
    expect(displayRarity(SSR.id, null)).toBe('SSR');
    expect(displayRarity(SSR.id)).toBe('SSR');
    expect(isUR(SSR.id, undefined)).toBe(false);
  });

  it('SR and R girls at ★5 keep SR and R', () => {
    const p = profileWith([[SR.id, MAX_AWAKEN], [R.id, MAX_AWAKEN]]);
    expect(displayRarity(SR.id, p)).toBe('SR');
    expect(displayRarity(R.id, p)).toBe('R');
    expect(isUR(SR.id, p) || isUR(R.id, p)).toBe(false);
  });

  it('every SSR (towers and heroes) can ascend; no other rarity ever does', () => {
    const p = profileWith(UNITS.map((u) => [u.id, MAX_AWAKEN]));
    for (const u of UNITS) expect(displayRarity(u.id, p), u.id).toBe(u.rarity === 'SSR' ? 'UR' : u.rarity);
  });

  it('unknown ids are null, odd awaken values never crash', () => {
    expect(displayRarity('nobody', createProfile())).toBe(null);
    const p = profileWith([[SSR.id, 0]]);
    p.units[SSR.id].awaken = '5';
    expect(displayRarity(SSR.id, p)).toBe('UR');
    p.units[SSR.id].awaken = undefined;
    expect(displayRarity(SSR.id, p)).toBe('SSR');
  });

  it('only one girl changes: the others keep their own rarity', () => {
    const p = profileWith([[SSR.id, MAX_AWAKEN]]);
    for (const u of UNITS.filter((x) => x.id !== SSR.id)) expect(displayRarity(u.id, p), u.id).toBe(u.rarity);
  });
});

describe('UR is display only', () => {
  it('UNIT_RARITIES, unit defs and gacha pools stay R / SR / SSR', () => {
    expect(Object.keys(UNIT_RARITIES)).toEqual(['R', 'SR', 'SSR']);
    expect(UNITS.every((u) => ['R', 'SR', 'SSR'].includes(u.rarity))).toBe(true);
    expect(Object.keys(POOL).sort()).toEqual(['R', 'SR', 'SSR']);
    const p = profileWith([[SSR.id, MAX_AWAKEN]]);
    displayRarity(SSR.id, p);
    expect(UNIT_MAP[SSR.id].rarity).toBe('SSR');
    expect(p.units[SSR.id].awaken).toBe(MAX_AWAKEN); // reading never writes
  });

  it('rarityInfo / rarityColor / sort rank know UR', () => {
    expect(rarityInfo('UR')).toBe(UR);
    expect(rarityInfo('SSR')).toBe(UNIT_RARITIES.SSR);
    expect(rarityInfo('??')).toBe(UNIT_RARITIES.R);
    const p = profileWith([[SSR.id, MAX_AWAKEN], [SR.id, MAX_AWAKEN]]);
    expect(rarityColor(SSR.id, p)).toBe(UR.color);
    expect(rarityColor(SR.id, p)).toBe(UNIT_RARITIES.SR.color);
    expect(DISPLAY_RARITY_RANK.UR).toBeGreaterThan(DISPLAY_RARITY_RANK.SSR);
  });
});

describe('SVG card art fallback (girls without a drawing)', () => {
  const badge = (svg) => (svg.match(/<text x="45" y="38"[^>]*>([^<]*)<\/text>/) || [])[1];
  it('an SSR card at ★5 reads UR in rainbow; ★4 and SR/R at ★5 keep their rarity', () => {
    const ur = cardArtSVG(SSR, { variant: 'full', awaken: 5 });
    expect(badge(ur)).toBe('UR');
    expect(ur).toMatch(/-ur"/);
    expect(badge(cardArtSVG(SSR, { variant: 'full', awaken: 4 }))).toBe('SSR');
    expect(badge(cardArtSVG(SR, { variant: 'full', awaken: 5 }))).toBe('SR');
    expect(badge(cardArtSVG(R, { variant: 'full', awaken: 5 }))).toBe('R');
  });
});
