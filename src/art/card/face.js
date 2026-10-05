// Face, eyes and expressions for the card illustrations.

import { n, linGrad, radGrad, sparklePath, lighten, mix } from '../svgUtil.js';

/** Face outline path (top is hidden under the hair). */
export function facePath(r) {
  const { cx, fw, faceTop, jawY, chinY } = r;
  const cw = r.adult ? 9 : 11; // chin width
  const ry = Math.max(16, Math.min(fw, faceTop - (r.headCY - r.headRY) - 12)); // forehead stays under the hair
  return `M${cx - fw} ${faceTop}L${cx - fw} ${jawY}C${n(cx - fw + 1)} ${n(jawY + (chinY - jawY) * 0.55)} ${n(cx - fw * 0.62)} ${n(chinY - 12)} ${cx - cw} ${chinY - 3}Q${cx} ${chinY + 2} ${cx + cw} ${chinY - 3}C${n(cx + fw * 0.62)} ${n(chinY - 12)} ${n(cx + fw - 1)} ${n(jawY + (chinY - jawY) * 0.55)} ${cx + fw} ${jawY}L${cx + fw} ${faceTop}A${fw} ${ry} 0 0 0 ${cx - fw} ${faceTop}Z`;
}

/** Gradient / clip definitions needed by the face. */
export function faceDefs(p, r, c) {
  return (
    linGrad(`${p}-skin`, [[0, lighten(c.skin, 0.25)], [0.7, c.skin], [1, mix(c.skin, c.skinShade, 0.5)]]) +
    linGrad(`${p}-iris`, [[0, c.eyesDark], [0.45, c.eyes], [1, c.eyesLight]]) +
    radGrad(`${p}-blush`, [[0, c.blush, 0.75], [1, c.blush, 0]]) +
    `<clipPath id="${p}-face"><path d="${facePath(r)}"/></clipPath>`
  );
}

/** Ears drawn behind the side locks. */
export function ears(r, c) {
  const { cx, fw, earY } = r;
  const s = r.adult ? 0.8 : 1;
  const one = (dir) => {
    const x = cx + dir * fw;
    return `<path d="M${x} ${earY - 12 * s}C${n(x + dir * 11 * s)} ${earY - 18 * s} ${n(x + dir * 13 * s)} ${earY + 4 * s} ${x + dir * 1} ${earY + 13 * s}Z" fill="${c.skin}" stroke="${c.skinLine}" stroke-width="1.6"/><path d="M${x + dir * 2} ${earY - 6 * s}Q${n(x + dir * 8 * s)} ${earY - 6 * s} ${x + dir * 3} ${earY + 5 * s}" fill="none" stroke="${c.skinShade}" stroke-width="2"/>`;
  };
  return one(-1) + one(1);
}

/** Face skin, with cast shadow from the bangs (bangsPath) and soft cheek light. */
export function faceSkin(p, r, c, bangsPath) {
  const { cx, fw, chinY } = r;
  return (
    `<path d="${facePath(r)}" fill="url(#${p}-skin)" stroke="${c.skinLine}" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<g clip-path="url(#${p}-face)">` +
    `<path d="${bangsPath}" transform="translate(2 9)" fill="${c.skinShade}" opacity="0.55"/>` +
    `<ellipse cx="${cx}" cy="${chinY + 4}" rx="${fw * 0.5}" ry="10" fill="${c.skinShade}" opacity="0.25"/>` +
    `</g>`
  );
}

/** Neck with the shadow cast by the chin. */
export function neck(p, r, c) {
  const { cx, neckW, neckTop, neckBot, chinY } = r;
  return (
    `<path d="M${cx - neckW} ${neckTop}L${cx - neckW - 1} ${neckBot}L${cx + neckW + 1} ${neckBot}L${cx + neckW} ${neckTop}Z" fill="${c.skin}" stroke="${c.skinLine}" stroke-width="1.8"/>` +
    `<path d="M${cx - neckW} ${chinY - 14}L${cx + neckW} ${chinY - 14}L${cx + neckW} ${chinY + 8}Q${cx} ${chinY + 20} ${cx - neckW} ${chinY + 8}Z" fill="${c.skinShade}" opacity="0.8"/>`
  );
}

// --- eyes -------------------------------------------------------------------

const EYE_STYLE = {
  round: { top: 0.56, tilt: 0, h: 1 },
  sparkle: { top: 0.56, tilt: 0, h: 1 },
  sharp: { top: 0.44, tilt: -7, h: 0.82 },
  sleepy: { top: 0.2, tilt: 3, h: 0.95 },
  closed: { top: 0.5, tilt: 0, h: 1 },
};

/** One open eye in local coordinates (outer corner = +x). */
function openEye(p, w, h, top, c, adult) {
  const t = -h * top;
  const lashW = adult ? 3.2 : 4.2;
  const white = `M${n(-w * 0.5)} ${n(-h * 0.08)}C${n(-w * 0.32)} ${n(t)} ${n(w * 0.22)} ${n(t - h * 0.06)} ${n(w * 0.52)} ${n(t * 0.45)}C${n(w * 0.56)} ${n(h * 0.2)} ${n(w * 0.3)} ${n(h * 0.5)} 0 ${n(h * 0.5)}C${n(-w * 0.34)} ${n(h * 0.48)} ${n(-w * 0.52)} ${n(h * 0.22)} ${n(-w * 0.5)} ${n(-h * 0.08)}Z`;
  const lash = `M${n(-w * 0.56)} ${n(-h * 0.02)}C${n(-w * 0.34)} ${n(t - lashW * 0.6)} ${n(w * 0.24)} ${n(t - h * 0.06 - lashW)} ${n(w * 0.6)} ${n(t * 0.5 - lashW * 0.5)}L${n(w * 0.74)} ${n(t * 0.62 - lashW * 0.9)}L${n(w * 0.62)} ${n(t * 0.3)}L${n(w * 0.5)} ${n(t * 0.38)}C${n(w * 0.2)} ${n(t - h * 0.02)} ${n(-w * 0.3)} ${n(t + lashW * 0.4)} ${n(-w * 0.47)} ${n(h * 0.02)}Z`;
  const ix = -w * 0.03;
  const iy = h * 0.05;
  const irx = w * 0.36;
  const iry = h * 0.47;
  return (
    `<path d="${white}" fill="#fffafa"/>` +
    `<g clip-path="url(#${p}-eye)">` +
    `<path d="${white}" fill="${c.skinShade}" opacity="0.35" transform="translate(0 -4)"/>` +
    `<ellipse cx="${n(ix)}" cy="${n(iy)}" rx="${n(irx)}" ry="${n(iry)}" fill="url(#${p}-iris)" stroke="${c.eyesDark}" stroke-width="1.6"/>` +
    `<ellipse cx="${n(ix)}" cy="${n(iy - iry * 0.55)}" rx="${n(irx)}" ry="${n(iry * 0.5)}" fill="${c.eyesDark}" opacity="0.55"/>` +
    `<ellipse cx="${n(ix)}" cy="${n(iy + iry * 0.08)}" rx="${n(irx * 0.42)}" ry="${n(iry * 0.5)}" fill="${c.eyesDark}"/>` +
    `<ellipse cx="${n(ix)}" cy="${n(iy + iry * 0.6)}" rx="${n(irx * 0.62)}" ry="${n(iry * 0.28)}" fill="${c.eyesLight}" opacity="0.65"/>` +
    `<path d="${white}" fill="none" stroke="${c.eyesDark}" stroke-width="0.8" opacity="0.4"/>` +
    `</g>` +
    `<path d="${lash}" fill="#2a1a2e"/>` +
    `<path d="M${n(w * 0.12)} ${n(h * 0.5)}Q${n(w * 0.36)} ${n(h * 0.44)} ${n(w * 0.46)} ${n(h * 0.28)}" fill="none" stroke="#5a3340" stroke-width="1.4" stroke-linecap="round" opacity="0.8"/>` +
    (adult ? `<path d="M${n(w * 0.6)} ${n(t * 0.5)}l${n(w * 0.16)} -2" stroke="#2a1a2e" stroke-width="1.6" stroke-linecap="round"/>` : '')
  );
}

/** Closed (serene) eye, local coordinates. */
function closedEye(w, h, cheerful) {
  if (cheerful) {
    return `<path d="M${n(-w * 0.48)} ${n(h * 0.12)}Q0 ${n(-h * 0.32)} ${n(w * 0.48)} ${n(h * 0.12)}" fill="none" stroke="#2a1a2e" stroke-width="3.6" stroke-linecap="round"/>`;
  }
  return (
    `<path d="M${n(-w * 0.5)} ${n(-h * 0.02)}Q0 ${n(h * 0.3)} ${n(w * 0.5)} ${n(-h * 0.06)}" fill="none" stroke="#2a1a2e" stroke-width="3.4" stroke-linecap="round"/>` +
    `<path d="M${n(w * 0.42)} ${n(h * 0.02)}l${n(w * 0.2)} ${n(-h * 0.1)}M${n(w * 0.28)} ${n(h * 0.12)}l${n(w * 0.14)} ${n(h * 0.06)}" stroke="#2a1a2e" stroke-width="2" stroke-linecap="round"/>`
  );
}

/** Both eyes + highlights. */
export function eyes(p, r, c, look) {
  const style = EYE_STYLE[look.eyeStyle] || EYE_STYLE.round;
  const w = r.eyeW;
  const h = r.eyeH * style.h;
  const { cx, eyeY, eyeDX } = r;
  const t = -h * style.top;
  // Eye clip shape (local coordinates; reused by both eyes through their transforms).
  const clip = `<clipPath id="${p}-eye"><path d="M${n(-w * 0.5)} ${n(-h * 0.08)}C${n(-w * 0.32)} ${n(t)} ${n(w * 0.22)} ${n(t - h * 0.06)} ${n(w * 0.52)} ${n(t * 0.45)}C${n(w * 0.56)} ${n(h * 0.2)} ${n(w * 0.3)} ${n(h * 0.5)} 0 ${n(h * 0.5)}C${n(-w * 0.34)} ${n(h * 0.48)} ${n(-w * 0.52)} ${n(h * 0.22)} ${n(-w * 0.5)} ${n(-h * 0.08)}Z"/></clipPath>`;
  const closed = look.eyeStyle === 'closed';
  const body = closed ? closedEye(w, h, look.expression === 'cheerful') : openEye(p, w, h, style.top, c, r.adult);
  let s = `<defs>${clip}<g id="${p}-e">${body}</g></defs>`;
  if (r.adult) {
    // soft eyeshadow for the grown-up guardians
    const shadow = mix(c.eyes, '#ff7f9f', 0.5);
    for (const ex of [cx - eyeDX, cx + eyeDX]) s += `<ellipse cx="${ex}" cy="${n(eyeY - h * 0.42)}" rx="${n(w * 0.62)}" ry="${n(h * 0.34)}" fill="${shadow}" opacity="0.28"/>`;
  }
  s += `<use href="#${p}-e" transform="translate(${cx + eyeDX} ${eyeY}) rotate(${style.tilt})"/>`;
  s += `<use href="#${p}-e" transform="translate(${cx - eyeDX} ${eyeY}) scale(-1 1) rotate(${style.tilt})"/>`;
  if (!closed) {
    // Highlights share one light direction (upper-left) for both eyes.
    const hy = eyeY - h * (look.eyeStyle === 'sleepy' ? 0.0 : 0.12);
    for (const ex of [cx - eyeDX, cx + eyeDX]) {
      const hx = ex - w * 0.13;
      if (look.eyeStyle === 'sparkle') {
        s += `<path d="${sparklePath(hx, hy, w * 0.17)}" fill="#fff"/>`;
        s += `<circle cx="${n(ex + w * 0.12)}" cy="${n(eyeY + h * 0.2)}" r="${n(w * 0.06)}" fill="#fff"/>`;
        s += `<path d="${sparklePath(ex + w * 0.1, eyeY - h * 0.02, w * 0.07)}" fill="#fff" opacity="0.9"/>`;
      } else {
        s += `<ellipse cx="${n(hx)}" cy="${n(hy)}" rx="${n(w * 0.12)}" ry="${n(h * (r.adult ? 0.13 : 0.12))}" fill="#fff" transform="rotate(-20 ${n(hx)} ${n(hy)})"/>`;
        s += `<circle cx="${n(ex + w * 0.12)}" cy="${n(eyeY + h * 0.2)}" r="${n(w * 0.055)}" fill="#fff"/>`;
      }
    }
  }
  return s;
}

/** Eyebrows (drawn over the bangs at partial opacity, anime style). */
export function brows(r, c, look) {
  const { cx, eyeDX, browY, eyeW } = r;
  const e = look.expression;
  const one = (dir) => {
    const inner = cx + dir * (eyeDX - eyeW * 0.38);
    const outer = cx + dir * (eyeDX + eyeW * 0.5);
    let innerY = browY;
    let outerY = browY + 1;
    let arch = -4;
    if (e === 'determined') { innerY += 5; outerY -= 2; arch = -1; }
    if (e === 'shy') { innerY -= 4; outerY += 3; arch = -2; }
    if (e === 'smug') { if (dir > 0) { innerY -= 3; outerY -= 4; } else { innerY += 2; } }
    if (e === 'cheerful' || e === 'smile') { innerY -= 1; arch = -5; }
    const mx = (inner + outer) / 2;
    const my = (innerY + outerY) / 2 + arch;
    return `<path d="M${n(inner)} ${n(innerY)}Q${n(mx)} ${n(my)} ${n(outer)} ${n(outerY)}" fill="none" stroke="${c.hairLine}" stroke-width="${r.adult ? 2.2 : 2.6}" stroke-linecap="round"/>`;
  };
  return `<g opacity="0.85">${one(-1)}${one(1)}</g>`;
}

/** Nose, mouth and blush for the expression. */
export function mouthAndBlush(p, r, c, look) {
  const { cx, noseY, mouthY, blushY, eyeDX } = r;
  const e = look.expression;
  const k = r.adult ? 0.8 : 1;
  let s = '';
  // blush
  const blushOp = e === 'shy' ? 1 : e === 'cheerful' ? 0.85 : r.adult ? 0.45 : 0.7;
  for (const dir of [-1, 1]) {
    const bx = cx + dir * (eyeDX + 6);
    s += `<ellipse cx="${bx}" cy="${blushY}" rx="${n(15 * k)}" ry="${n(7 * k)}" fill="url(#${p}-blush)" opacity="${blushOp}"/>`;
    if (e === 'shy' || e === 'cheerful') {
      for (let i = 0; i < 3; i++) s += `<path d="M${n(bx - 7 + i * 5)} ${blushY + 3}l3 -6" stroke="#ff6f8f" stroke-width="1.3" stroke-linecap="round" opacity="0.7"/>`;
    }
  }
  // nose (tiny highlight + shadow tick)
  s += `<path d="M${cx + 1} ${noseY - 2}q2 3 -1 4" fill="none" stroke="${c.skinDeep}" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>`;
  // mouth
  const line = '#7a2e3a';
  const m = mouthY;
  if (e === 'cheerful') {
    s += `<path d="M${n(cx - 9 * k)} ${m - 2}Q${cx} ${m - 4} ${n(cx + 9 * k)} ${m - 2}Q${n(cx + 7 * k)} ${n(m + 10 * k)} ${cx} ${n(m + 10 * k)}Q${n(cx - 7 * k)} ${n(m + 10 * k)} ${n(cx - 9 * k)} ${m - 2}Z" fill="#c2364f" stroke="${line}" stroke-width="1.5" stroke-linejoin="round"/>`;
    s += `<path d="M${n(cx - 5 * k)} ${n(m + 6 * k)}Q${cx} ${n(m + 2 * k)} ${n(cx + 5 * k)} ${n(m + 6 * k)}Q${cx} ${n(m + 10 * k)} ${n(cx - 5 * k)} ${n(m + 6 * k)}Z" fill="#ff8fa3"/>`;
  } else if (e === 'smile') {
    s += `<path d="M${n(cx - 8 * k)} ${m}Q${cx} ${n(m + 7 * k)} ${n(cx + 8 * k)} ${m}" fill="#e85d75" stroke="${line}" stroke-width="1.6" stroke-linecap="round"/>`;
  } else if (e === 'smug') {
    s += `<path d="M${n(cx - 9 * k)} ${m + 1}Q${n(cx - 4 * k)} ${m + 5} ${cx} ${m + 1}Q${n(cx + 5 * k)} ${m + 4} ${n(cx + 9 * k)} ${m - 3}" fill="none" stroke="${line}" stroke-width="1.8" stroke-linecap="round"/>`;
    s += `<path d="M${n(cx + 3 * k)} ${m + 2}l1.4 3.4l1.6 -3.8" fill="#fff" stroke="${line}" stroke-width="0.8"/>`;
  } else if (e === 'determined') {
    s += `<path d="M${n(cx - 7 * k)} ${m + 2}Q${cx} ${m - 1} ${n(cx + 7 * k)} ${m + 2}Q${cx} ${n(m + 5 * k)} ${n(cx - 7 * k)} ${m + 2}Z" fill="#c2364f" stroke="${line}" stroke-width="1.5"/>`;
  } else if (e === 'shy') {
    s += `<path d="M${n(cx - 6 * k)} ${m + 1}q3 -3 6 0q3 3 6 0" fill="none" stroke="${line}" stroke-width="1.6" stroke-linecap="round"/>`;
  } else {
    s += `<path d="M${n(cx - 6 * k)} ${m}Q${cx} ${n(m + 3.5 * k)} ${n(cx + 6 * k)} ${m}" fill="none" stroke="${line}" stroke-width="1.7" stroke-linecap="round"/>`;
  }
  if (r.adult) {
    // refined lip tint for the adult guardians
    s += `<path d="M${cx - 5} ${m + 3}Q${cx} ${m + 6} ${cx + 5} ${m + 3}" fill="none" stroke="#e07a8a" stroke-width="1.4" stroke-linecap="round" opacity="0.6"/>`;
  }
  return s;
}

/** Shine / reflected-light accents on the skin (cheek and nose). */
export function skinHighlights(r) {
  const { cx, eyeDX, blushY } = r;
  return `<ellipse cx="${cx - eyeDX - 4}" cy="${blushY - 4}" rx="5" ry="2.4" fill="#fff" opacity="0.55"/><ellipse cx="${cx + eyeDX + 10}" cy="${blushY - 5}" rx="3" ry="1.6" fill="#fff" opacity="0.4"/>`;
}
