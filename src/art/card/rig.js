// Proportion rigs for the card illustrations (300×500 canvas).
// Students are cute (big head, big eyes, short neck); heroes are adults with elegant,
// taller proportions (smaller head, almond eyes, long neck, broader shoulders).

import { mix, lighten, darken, lineOf } from '../svgUtil.js';

/**
 * Geometry for one character. All parts of the card read from this object so the student
 * and hero builds stay consistent.
 * @param {object} unit UnitDef
 */
export function makeRig(unit) {
  const adult = !!unit.adult || unit.kind === 'hero';
  const cx = 150;
  if (adult) {
    return {
      adult, cx,
      headCY: 168, headRX: 64, headRY: 62, // hair cranium
      fw: 49, faceTop: 140, jawY: 186, chinY: 246, // face
      eyeY: 198, eyeDX: 24, eyeW: 30, eyeH: 25,
      browY: 180, noseY: 218, mouthY: 231, blushY: 219,
      neckW: 12, neckTop: 228, neckBot: 300,
      shoulderY: 312, shoulderW: 112,
      haloY: 84, haloR: 52,
      bangsY: 182, sideLockEnd: 330, backHairEnd: 480,
      earY: 200,
    };
  }
  return {
    adult, cx,
    headCY: 190, headRX: 78, headRY: 74,
    fw: 62, faceTop: 160, jawY: 206, chinY: 278,
    eyeY: 224, eyeDX: 31, eyeW: 38, eyeH: 43,
    browY: 196, noseY: 250, mouthY: 262, blushY: 248,
    neckW: 16, neckTop: 258, neckBot: 306,
    shoulderY: 322, shoulderW: 118,
    haloY: 100, haloR: 58,
    bangsY: 206, sideLockEnd: 312, backHairEnd: 470,
    earY: 226,
  };
}

/** Derived colours used across the illustration. */
export function makeColors(unit) {
  const p = unit.palette;
  return {
    ...p,
    hairHi: lighten(p.hair, 0.45),
    hairLine: lineOf(p.hairShade, 0.45),
    hairDeep: darken(p.hairShade, 0.18),
    skinShade: mix(p.skin, '#e88a8a', 0.28),
    skinDeep: mix(p.skin, '#c96a6a', 0.45),
    skinLine: mix(darken(p.skin, 0.55), '#7a3b3b', 0.4),
    eyesDark: darken(p.eyes, 0.55),
    eyesLight: lighten(p.eyes, 0.55),
    outfitLine: lineOf(p.outfitShade, 0.5),
    accentLine: lineOf(p.accent, 0.45),
    weaponLine: lineOf(p.weapon, 0.5),
    blush: '#ff8fa3',
  };
}
