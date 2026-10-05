// Gacha card illustrations (CONTRACTS §8). Pure function → SVG markup string.
//
// Layer order (back → front): background, halo, back accessories, back weapon, cape,
// back hair (+tails), body/outfit, braid, cranium, ears, face, eyes, mouth, side locks,
// bangs, brows, head accessories, front weapon, foreground petals, frame / name plate.

import { slug } from './svgUtil.js';
import { makeRig, makeColors } from './card/rig.js';
import { faceDefs, ears, faceSkin, neck, eyes, brows, mouthAndBlush, skinHighlights } from './card/face.js';
import { hairDefs, bangsPath, bangs, cranium, sideLocks, backHair, hairTies, braid } from './card/hair.js';
import { outfitDefs, outfit, cape } from './card/outfit.js';
import { accessoryDefs, halo, accessoryBack, accessoryMid, accessoryFront } from './card/accessory.js';
import { weapon } from './card/weapon.js';
import { sceneDefs, background, foreground, rarityDefs, fullFrame, portraitFrame, thumbCrop, thumbFrame } from './card/scene.js';

const ROUND_ATTRS = / stroke-line(?:join|cap)="round"/g;
const ROOT_ATTRS = 'stroke-linejoin="round" stroke-linecap="round"';
const FALLBACK_LOOK = { hairStyle: 'long', bangs: 'straight', accessory: 'none', outfit: 'sailor', weapon: 'bow', halo: 'ring', eyeStyle: 'round', expression: 'smile' };
const FALLBACK_PALETTE = { hair: '#6cc4ff', hairShade: '#2f86d6', eyes: '#2563c9', skin: '#ffe5d6', outfit: '#ffffff', outfitShade: '#cfe2f5', accent: '#ff6f91', halo: '#a6e1ff', weapon: '#f4d27a' };

/** The character itself (no background / frame), in 300×500 card space. */
function character(p, unit, r, c, look) {
  const bp = bangsPath(r, look);
  const braidSide = look.hairStyle === 'braid' ? -1 : 0;
  let s = '';
  s += halo(p, r, c, look);
  s += accessoryBack(p, r, c, look);
  s += weapon(r, c, look, unit.element, 'back');
  s += cape(r, c, look);
  s += backHair(p, r, c, look);
  s += neck(p, r, c);
  s += outfit(p, r, c, look);
  s += cranium(p, r, c);
  s += hairTies(p, r, c, look);
  s += accessoryMid(p, r, c, look);
  s += ears(r, c);
  s += faceSkin(p, r, c, bp);
  s += mouthAndBlush(p, r, c, look);
  s += skinHighlights(r);
  s += eyes(p, r, c, look);
  s += sideLocks(p, r, c, look, braidSide);
  if (braidSide) s += braid(p, r, c);
  s += bangs(p, r, c, look, bp);
  s += brows(r, c, look);
  s += accessoryFront(p, r, c, look);
  s += weapon(r, c, look, unit.element, 'front');
  return s;
}

/**
 * Gacha card illustration for a unit.
 * @param {object} unitDef UnitDef (palette + look drive everything)
 * @param {{variant?: 'full'|'portrait'|'thumb', awaken?: number}} [opts]
 * @returns {string} SVG markup
 */
export function cardArtSVG(unitDef, { variant = 'full', awaken = 0 } = {}) {
  const unit = {
    ...unitDef,
    id: unitDef?.id || 'unknown',
    name: unitDef?.name || 'Unknown',
    title: unitDef?.title || '',
    rarity: unitDef?.rarity || 'R',
    palette: { ...FALLBACK_PALETTE, ...(unitDef?.palette || {}) },
    look: { ...FALLBACK_LOOK, ...(unitDef?.look || {}) },
  };
  const aw = Math.max(0, Math.min(5, Math.floor(awaken || 0)));
  const v = variant === 'portrait' || variant === 'thumb' ? variant : 'full';
  const p = `ca-${slug(unit.id)}-${v[0]}${aw}`;
  const r = makeRig(unit);
  const c = makeColors(unit);
  const defs = `<defs>${sceneDefs(p, unit)}${rarityDefs(p, unit)}${hairDefs(p, r, c)}${faceDefs(p, r, c)}${outfitDefs(p, c)}${accessoryDefs(p, c)}</defs>`;
  // Round joins/caps are set once on the root; strip the per-element copies to keep cards small.
  const body = (background(p, unit, r) + character(p, unit, r, c, unit.look) + foreground(p, unit, aw)).replace(ROUND_ATTRS, '');
  const label = `${unit.name}${unit.title ? `, ${unit.title}` : ''}`.replace(/"/g, '');
  if (v === 'thumb') {
    const crop = thumbCrop(r);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${crop.x} ${crop.y} ${crop.s} ${crop.s}" role="img" aria-label="${label}" ${ROOT_ATTRS}><clipPath id="${p}-cut"><rect x="${crop.x}" y="${crop.y}" width="${crop.s}" height="${crop.s}" rx="${Math.round(crop.s * 0.06)}"/></clipPath>${defs}<g clip-path="url(#${p}-cut)">${body}</g>${thumbFrame(p, crop)}</svg>`;
  }
  const frame = v === 'full' ? fullFrame(p, unit, aw) : portraitFrame(p);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 500" role="img" aria-label="${label}" ${ROOT_ATTRS}><clipPath id="${p}-cut"><rect width="300" height="500" rx="${v === 'full' ? 16 : 10}"/></clipPath>${defs}<g clip-path="url(#${p}-cut)">${body}${frame}</g></svg>`;
}
