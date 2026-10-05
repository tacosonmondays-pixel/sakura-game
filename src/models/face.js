// Anime face: eyes, brows, mouth and blush painted on a canvas atlas and projected onto
// the head surface with a decal, so the face sits exactly on the owner's head mesh.
//
// Atlas layout (2×2 cells): 0 = neutral (the unit's expression), 1 = blink,
// 2 = happy (cheer / victory), 3 = dizzy (disabled).
import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { LM, REGION, BONES } from './body.js';
import { bindBone, paint } from './geom.js';
import { mixHex, darkenHex, lightenHex } from './toon.js';

export const FACE_CELL = { neutral: 0, blink: 1, happy: 2, dizzy: 3 };
export const FACE_SIZE = { w: 1.74, h: 1.18, cy: 2.36 };
const CELL_W = 512;
const CELL_H = Math.round((CELL_W * FACE_SIZE.h) / FACE_SIZE.w);
const PX = CELL_W / FACE_SIZE.w; // pixels per girl-space unit

const textureCache = new Map();
const decalCache = new Map();

export function canDrawFaces() {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}

/** Projects the face decal onto the head of `base` (cached per base geometry). */
export function faceGeometry(base) {
  let g = decalCache.get(base);
  if (g) return g;
  // Only feed head triangles to the projector (much faster, no leaks onto the body).
  const src = base.geometry;
  const idx = src.index.array;
  const keep = [];
  for (let i = 0; i < idx.length; i += 3) {
    if (base.regions[idx[i]] === REGION.HEAD && base.regions[idx[i + 1]] === REGION.HEAD && base.regions[idx[i + 2]] === REGION.HEAD) {
      keep.push(idx[i], idx[i + 1], idx[i + 2]);
    }
  }
  const headGeo = new THREE.BufferGeometry();
  headGeo.setAttribute('position', src.attributes.position);
  headGeo.setAttribute('normal', src.attributes.normal);
  headGeo.setIndex(keep);
  const mesh = new THREE.Mesh(headGeo);
  mesh.updateMatrixWorld(true);
  g = new DecalGeometry(
    mesh,
    new THREE.Vector3(0, FACE_SIZE.cy, LM.faceZ),
    new THREE.Euler(0, 0, 0),
    new THREE.Vector3(FACE_SIZE.w, FACE_SIZE.h, 1.1),
  );
  // Lift slightly off the skin along the normal to avoid z-fighting at distance.
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + nor.getX(i) * 0.012, pos.getY(i) + nor.getY(i) * 0.012, pos.getZ(i) + nor.getZ(i) * 0.012);
  }
  paint(g, '#ffffff');
  bindBone(g, BONES.head);
  decalCache.set(base, g);
  return g;
}

/** Cached face atlas texture for a unit (shared source; instances clone the Texture). */
export function faceTexture(unit) {
  const key = `${unit.id}|${unit.look?.eyeStyle}|${unit.look?.expression}|${unit.palette?.eyes}`;
  let tex = textureCache.get(key);
  if (tex) return tex;
  const canvas = document.createElement('canvas');
  canvas.width = CELL_W * 2;
  canvas.height = CELL_H * 2;
  const ctx = canvas.getContext('2d');
  const look = unit.look || {};
  const adult = !!(unit.adult || unit.kind === 'hero');
  const cells = [
    { eyes: look.eyeStyle || 'round', mouth: look.expression || 'smile', blush: look.expression },
    { eyes: 'blink', mouth: look.expression || 'smile', blush: look.expression },
    { eyes: 'happy', mouth: 'cheer', blush: 'cheerful' },
    { eyes: 'dizzy', mouth: 'wobble', blush: 'none' },
  ];
  if (look.eyeStyle === 'closed') cells[0].eyes = 'closed';
  cells.forEach((cell, i) => {
    ctx.save();
    ctx.translate((i % 2) * CELL_W, Math.floor(i / 2) * CELL_H);
    drawFace(ctx, unit, cell, adult);
    ctx.restore();
  });
  tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.repeat.set(0.5, 0.5);
  tex.offset.set(0, 0.5);
  textureCache.set(key, tex);
  return tex;
}

/** Sets the atlas cell on a (per-instance) face texture. */
export function setFaceCell(tex, cell) {
  tex.offset.set((cell % 2) * 0.5, cell < 2 ? 0.5 : 0);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function u2x(x) { return CELL_W / 2 + x * PX; }
function u2y(y) { return CELL_H / 2 - (y - FACE_SIZE.cy) * PX; }

function drawFace(ctx, unit, cell, adult) {
  const pal = unit.palette || {};
  const eyeColor = pal.eyes || '#5a8dee';
  const lash = mixHex(darkenHex(pal.hairShade || '#3a2a3a', 0.55), '#2a1a28', 0.6);
  const ex = adult ? 0.41 : 0.44;
  const ey = u2y(LM.eyeY);
  const ew = (adult ? 0.29 : 0.335) * PX;
  const eh = (adult ? 0.39 : 0.46) * PX;

  // Blush first (under everything).
  if (cell.blush !== 'none') drawBlush(ctx, cell.blush, pal);

  for (const side of [-1, 1]) {
    const cx = u2x(side * ex);
    switch (cell.eyes) {
      case 'blink': drawClosedEye(ctx, cx, ey + eh * 0.12, ew, lash, side, 'down'); break;
      case 'closed': drawClosedEye(ctx, cx, ey + eh * 0.08, ew, lash, side, 'down', true); break;
      case 'happy': drawClosedEye(ctx, cx, ey + eh * 0.05, ew, lash, side, 'up'); break;
      case 'dizzy': drawSwirl(ctx, cx, ey + eh * 0.05, ew * 0.8, lash); break;
      default: drawEye(ctx, cx, ey, ew, eh, side, eyeColor, lash, cell.eyes, adult);
    }
  }
  drawBrows(ctx, ex, ey - eh * 0.78, ew, lash, cell.mouth, unit.look?.expression);
  drawMouth(ctx, u2x(0), u2y(LM.mouthY), cell.mouth, lash, adult);
}

function ellipsePath(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
}

/** Main glossy anime eye. `side` = -1 for the eye on the viewer's left. */
function drawEye(ctx, cx, cy, w, h, side, color, lash, style, adult) {
  const sharp = style === 'sharp';
  const sleepy = style === 'sleepy';
  const hh = sharp ? h * 0.86 : h;
  const o = side; // outer corner direction: +1 = towards +x for the eye on the viewer's right

  // Eye white (soft lower curve, flatter top under the lash).
  ctx.save();
  ctx.beginPath();
  const top = cy - hh * 0.5;
  const bot = cy + hh * 0.5;
  const lift = sharp ? hh * 0.12 : 0;
  ctx.moveTo(cx - w * 0.5 * o, top + hh * 0.12 + lift * -0.5);
  ctx.bezierCurveTo(cx - w * 0.2 * o, top - hh * 0.04, cx + w * 0.3 * o, top - hh * 0.02 - lift, cx + w * 0.52 * o, top + hh * 0.1 - lift);
  ctx.bezierCurveTo(cx + w * 0.62 * o, cy + hh * 0.2, cx + w * 0.3 * o, bot + hh * 0.02, cx, bot);
  ctx.bezierCurveTo(cx - w * 0.36 * o, bot, cx - w * 0.58 * o, cy + hh * 0.2, cx - w * 0.5 * o, top + hh * 0.12 + lift * -0.5);
  ctx.closePath();
  ctx.fillStyle = '#fbfbff';
  ctx.fill();
  ctx.clip();

  // Iris with vertical gradient (dark top -> bright bottom).
  const ir = w * 0.46;
  const irh = hh * 0.47;
  const icx = cx + w * 0.02 * o;
  const icy = cy + hh * 0.06;
  const grad = ctx.createLinearGradient(0, icy - irh, 0, icy + irh);
  grad.addColorStop(0, darkenHex(color, 0.55));
  grad.addColorStop(0.45, color);
  grad.addColorStop(1, lightenHex(color, 0.45));
  ellipsePath(ctx, icx, icy, ir, irh);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = w * 0.06;
  ctx.strokeStyle = darkenHex(color, 0.6);
  ctx.stroke();
  // Pupil.
  ellipsePath(ctx, icx, icy - irh * 0.05, ir * 0.42, irh * 0.48);
  ctx.fillStyle = darkenHex(color, 0.72);
  ctx.fill();
  // Lower-iris glow crescent.
  ctx.globalAlpha = 0.55;
  ellipsePath(ctx, icx, icy + irh * 0.55, ir * 0.62, irh * 0.32);
  ctx.fillStyle = lightenHex(color, 0.65);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Lash shadow on the top of the eye.
  const sh = ctx.createLinearGradient(0, top, 0, top + hh * 0.35);
  sh.addColorStop(0, 'rgba(40,20,50,0.55)');
  sh.addColorStop(1, 'rgba(40,20,50,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(cx - w, top - 4, w * 2, hh * 0.4);
  // Highlights.
  ctx.fillStyle = '#ffffff';
  if (style === 'sparkle') {
    drawSparkle(ctx, icx - ir * 0.28 * o, icy - irh * 0.38, ir * 0.62);
    drawSparkle(ctx, icx + ir * 0.4 * o, icy + irh * 0.45, ir * 0.3);
  } else {
    ellipsePath(ctx, icx - ir * 0.3 * o, icy - irh * 0.42, ir * 0.36, irh * 0.26);
    ctx.fill();
    ellipsePath(ctx, icx + ir * 0.38 * o, icy + irh * 0.45, ir * 0.16, irh * 0.1);
    ctx.fill();
  }
  ctx.restore();

  // Sleepy lid: a soft lid band over the top third.
  if (sleepy) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.62, top - 2);
    ctx.lineTo(cx + w * 0.62, top - 2);
    ctx.lineTo(cx + w * 0.62, top + hh * 0.3);
    ctx.quadraticCurveTo(cx, top + hh * 0.36, cx - w * 0.62, top + hh * 0.3);
    ctx.closePath();
    ctx.fillStyle = '#f6d8cf';
    ctx.globalAlpha = 0.97;
    ctx.fill();
    ctx.restore();
  }

  // Upper lash line (thick, with a flick at the outer corner).
  ctx.save();
  ctx.strokeStyle = lash;
  ctx.fillStyle = lash;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const lidY = sleepy ? top + hh * 0.3 : top + hh * 0.06;
  ctx.lineWidth = w * (adult ? 0.16 : 0.15);
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.56 * o, lidY + hh * 0.1 + (sharp ? lift * 0.5 : 0));
  ctx.bezierCurveTo(cx - w * 0.2 * o, lidY - hh * 0.1, cx + w * 0.3 * o, lidY - hh * 0.1 - lift, cx + w * 0.6 * o, lidY + hh * 0.02 - lift);
  ctx.stroke();
  // Outer flick.
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.42 * o, lidY - hh * 0.04 - lift);
  ctx.quadraticCurveTo(cx + w * 0.72 * o, lidY - hh * 0.08 - lift, cx + w * (adult ? 0.86 : 0.76) * o, lidY - hh * (adult ? 0.2 : 0.14) - lift);
  ctx.lineWidth = w * 0.09;
  ctx.stroke();
  if (adult) {
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.5 * o, lidY + hh * 0.02 - lift);
    ctx.quadraticCurveTo(cx + w * 0.75 * o, lidY + hh * 0.02 - lift, cx + w * 0.84 * o, lidY - hh * 0.04 - lift);
    ctx.lineWidth = w * 0.06;
    ctx.stroke();
  }
  // Lower lash hint (outer side).
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = w * 0.05;
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.05 * o, bot + hh * 0.03);
  ctx.quadraticCurveTo(cx + w * 0.34 * o, bot - hh * 0.0, cx + w * 0.46 * o, cy + hh * 0.28);
  ctx.stroke();
  ctx.restore();
}

function drawSparkle(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.3;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawClosedEye(ctx, cx, cy, w, lash, side, dir, lashes = false) {
  ctx.save();
  ctx.strokeStyle = lash;
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.15;
  ctx.beginPath();
  const k = dir === 'up' ? -1 : 1;
  ctx.moveTo(cx - w * 0.55, cy - k * w * 0.05);
  ctx.quadraticCurveTo(cx, cy + k * w * 0.42, cx + w * 0.55, cy - k * w * 0.05);
  ctx.stroke();
  if (lashes) {
    ctx.lineWidth = w * 0.07;
    for (const f of [0.35, 0.6]) {
      const px = cx + side * w * f;
      ctx.beginPath();
      ctx.moveTo(px, cy + w * 0.12 + (f - 0.35) * -w * 0.2);
      ctx.lineTo(px + side * w * 0.12, cy + w * 0.3);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawSwirl(ctx, cx, cy, r, lash) {
  ctx.save();
  ctx.strokeStyle = lash;
  ctx.lineWidth = r * 0.12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 5; a += 0.15) {
    const rr = (a / (Math.PI * 5)) * r * 0.55;
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr * 1.1;
    if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBrows(ctx, ex, by, ew, lash, mouth, expression) {
  ctx.save();
  ctx.strokeStyle = lash;
  ctx.globalAlpha = 0.85;
  ctx.lineCap = 'round';
  ctx.lineWidth = ew * 0.08;
  for (const side of [-1, 1]) {
    const cx = u2x(side * ex);
    let inner = 0;
    let outer = 0;
    if (expression === 'determined' && mouth !== 'cheer') { inner = 10; outer = -6; }
    if (expression === 'shy' || mouth === 'wobble') { inner = -8; outer = 6; }
    if (expression === 'smug' && mouth !== 'cheer') { inner = side > 0 ? 3 : -4; }
    ctx.beginPath();
    ctx.moveTo(cx - side * ew * 0.42, by + inner);
    ctx.quadraticCurveTo(cx + side * ew * 0.05, by - ew * 0.12 + (inner + outer) / 2, cx + side * ew * 0.48, by + outer + 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBlush(ctx, kind, pal) {
  const strong = kind === 'shy' || kind === 'cheerful';
  ctx.save();
  for (const side of [-1, 1]) {
    const cx = u2x(side * 0.6);
    const cy = u2y(LM.eyeY - 0.36);
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 0.2 * PX);
    const base = mixHex('#ff7d9a', pal.skin || '#ffe0d6', 0.15);
    g.addColorStop(0, base);
    g.addColorStop(1, 'rgba(255,125,154,0)');
    ctx.globalAlpha = strong ? 0.75 : 0.5;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 0.22 * PX, 0.11 * PX, 0, 0, Math.PI * 2);
    ctx.fill();
    if (strong) {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#ff5f86';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(cx + k * 14 + 5, cy - 7);
        ctx.lineTo(cx + k * 14 - 3, cy + 7);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawMouth(ctx, cx, cy, kind, lash, adult) {
  ctx.save();
  ctx.strokeStyle = mixHex(lash, '#a0303c', 0.4);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  const s = adult ? 0.9 : 1;
  switch (kind) {
    case 'cheer':
    case 'cheerful': {
      // Open happy mouth with tongue.
      ctx.beginPath();
      ctx.moveTo(cx - 20 * s, cy - 6);
      ctx.quadraticCurveTo(cx, cy - 2, cx + 20 * s, cy - 6);
      ctx.quadraticCurveTo(cx + 14 * s, cy + 22 * s, cx, cy + 22 * s);
      ctx.quadraticCurveTo(cx - 14 * s, cy + 22 * s, cx - 20 * s, cy - 6);
      ctx.closePath();
      ctx.fillStyle = '#9b2b3e';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#ff8fa3';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 20 * s, 13 * s, 9 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 3.5;
      ctx.stroke();
      break;
    }
    case 'smug': {
      // Cat mouth "ω" with a little smirk.
      ctx.beginPath();
      ctx.moveTo(cx - 18 * s, cy - 4);
      ctx.quadraticCurveTo(cx - 9 * s, cy + 9, cx, cy - 1);
      ctx.quadraticCurveTo(cx + 9 * s, cy + 9, cx + 18 * s, cy - 6);
      ctx.stroke();
      break;
    }
    case 'calm': {
      ctx.beginPath();
      ctx.moveTo(cx - 9 * s, cy);
      ctx.quadraticCurveTo(cx, cy + 4, cx + 9 * s, cy);
      ctx.stroke();
      break;
    }
    case 'determined': {
      ctx.beginPath();
      ctx.moveTo(cx - 11 * s, cy + 2);
      ctx.quadraticCurveTo(cx, cy - 3, cx + 11 * s, cy + 2);
      ctx.stroke();
      break;
    }
    case 'shy':
    case 'wobble': {
      ctx.beginPath();
      ctx.moveTo(cx - 13 * s, cy + 1);
      ctx.quadraticCurveTo(cx - 6 * s, cy - 6, cx, cy + 1);
      ctx.quadraticCurveTo(cx + 6 * s, cy + 7, cx + 13 * s, cy);
      ctx.stroke();
      break;
    }
    default: {
      // Gentle smile.
      ctx.beginPath();
      ctx.moveTo(cx - 14 * s, cy - 3);
      ctx.quadraticCurveTo(cx, cy + 12 * s, cx + 14 * s, cy - 3);
      ctx.stroke();
    }
  }
  ctx.restore();
}
