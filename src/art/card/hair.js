// Hair for the card illustrations: back layer, cranium, side locks, bangs, shine.
// Built from broad, deliberately curved clumps (anime style), not many thin strands.

import { n, linGrad, lighten, mix } from '../svgUtil.js';

/** Gradients + clip for hair. */
export function hairDefs(p, r, c) {
  return (
    linGrad(`${p}-hair`, [[0, lighten(c.hair, 0.12)], [0.5, c.hair], [1, c.hairShade]]) +
    linGrad(`${p}-hairB`, [[0, c.hairShade], [0.55, mix(c.hair, c.hairShade, 0.55)], [1, c.hairShade]]) +
    linGrad(`${p}-hairS`, [[0, c.hairShade], [0.5, c.hair], [1, c.hairShade]], { x2: 1, y2: 0 }) +
    `<clipPath id="${p}-crown"><ellipse cx="${r.cx}" cy="${r.headCY}" rx="${r.headRX}" ry="${r.headRY}"/></clipPath>`
  );
}

const stroke = (c, w = 2.2) => `stroke="${c.hairLine}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

// --- bangs --------------------------------------------------------------------

/** Tip layouts per bang style: u = -1..1 across the forehead, y = offset from bangsY, b = lean. */
const BANGS = {
  straight: { notch: -16, tips: [[-1.08, 18, -2], [-0.74, 4, -1], [-0.42, 8, 0], [-0.1, 10, 1], [0.2, 7, 1], [0.5, 9, 2], [0.78, 4, 2], [1.08, 18, 3]] },
  swept: { notch: -14, tips: [[-1.08, 14, -4], [-0.78, -4, 6], [-0.5, 2, 8], [-0.18, 8, 9], [0.16, 14, 10], [0.46, 16, 9], [0.76, 10, 6], [1.08, 22, 4]] },
  split: { notch: -12, tips: [[-1.08, 24, -2], [-0.8, 14, -6], [-0.52, 6, -8], [-0.22, -4, -8], [0.22, -4, 8], [0.52, 6, 8], [0.8, 14, 6], [1.08, 24, 2]], center: -40 },
  hime: { notch: -5, tips: [[-1.08, 8, 0], [-0.8, 3, 0], [-0.52, 4, 0], [-0.26, 5, 0], [0, 5, 0], [0.26, 5, 0], [0.52, 4, 0], [0.8, 3, 0], [1.08, 8, 0]] },
  messy: { notch: -18, tips: [[-1.08, 16, -6], [-0.8, 2, -10], [-0.5, 12, 4], [-0.22, 4, -6], [0.06, 14, 6], [0.34, 2, 10], [0.6, 12, -4], [0.84, 6, 8], [1.1, 20, 6]] },
};

/** Bangs path: cranium top arc + jagged fringe. Returned so the face can cast its shadow. */
export function bangsPath(r, look) {
  const def = BANGS[look.bangs] || BANGS.straight;
  const { cx, headCY, headRX, headRY, bangsY, fw } = r;
  const span = fw + 9;
  const k = r.adult ? 0.8 : 1;
  const tips = def.tips.map(([u, y, b]) => ({ x: cx + u * span, y: bangsY + y * k, b: b * k }));
  const startY = headCY + 2;
  const sx = cx - headRX + 3;
  const ex = cx + headRX - 3;
  let d = `M${n(ex)} ${n(startY)}A${headRX - 1} ${headRY - 1} 0 1 0 ${n(sx)} ${n(startY)}`;
  d += `L${n(tips[0].x - 3)} ${n(tips[0].y - 20)}`;
  for (let i = 0; i < tips.length; i++) {
    const t = tips[i];
    if (i === 0) {
      d += `Q${n(t.x - 4 + t.b)} ${n(t.y - 8)} ${n(t.x)} ${n(t.y)}`;
    }
    const next = tips[i + 1];
    if (!next) break;
    let ny = bangsY + def.notch * k;
    if (def.center != null && t.x < cx && next.x > cx) ny = bangsY + def.center * k;
    const nx = (t.x + next.x) / 2 + (t.b + next.b) * 0.4;
    d += `C${n(t.x + t.b * 0.4)} ${n(t.y - (t.y - ny) * 0.45)} ${n(nx - (nx - t.x) * 0.25)} ${n(ny + 3)} ${n(nx)} ${n(ny)}`;
    d += `C${n(nx + (next.x - nx) * 0.25)} ${n(ny + 3)} ${n(next.x + next.b * 0.4)} ${n(next.y - (next.y - ny) * 0.45)} ${n(next.x)} ${n(next.y)}`;
  }
  const last = tips[tips.length - 1];
  d += `Q${n(last.x + 4 + last.b)} ${n(last.y - 8)} ${n(last.x + 3)} ${n(last.y - 20)}Z`;
  return d;
}

/** Drawn bangs with strand lines and shine band. */
export function bangs(p, r, c, look, path) {
  const def = BANGS[look.bangs] || BANGS.straight;
  const { cx, bangsY, fw, headCY, headRY } = r;
  const span = fw + 9;
  const k = r.adult ? 0.8 : 1;
  let s = `<path d="${path}" fill="url(#${p}-hair)" ${stroke(c)}/>`;
  // strand lines: from the crown towards some tips
  let lines = '';
  def.tips.forEach(([u, y, b], i) => {
    if (i === 0 || i === def.tips.length - 1 || i % 2 === 0) return;
    const tx = cx + u * span;
    const ty = bangsY + y * k - 10;
    lines += `M${n(cx + u * span * 0.45)} ${n(headCY - headRY * 0.55)}Q${n(tx - b)} ${n(ty - 30)} ${n(tx + b * 0.3)} ${n(ty)}`;
  });
  s += `<path d="${lines}" fill="none" stroke="${c.hairShade}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>`;
  s += shineBand(p, r, c);
  return s;
}

/** Angel-ring shine across the top of the head, clipped to the cranium. */
export function shineBand(p, r, c) {
  const { cx, headCY, headRX, headRY } = r;
  const y = headCY - headRY * 0.42;
  const w = headRX * 0.92;
  let zig = '';
  const steps = 9;
  for (let i = steps; i >= 0; i--) {
    const x = cx - w + (2 * w * i) / steps;
    const dip = i % 2 === 0 ? 10 : 3;
    zig += `L${n(x)} ${n(y + dip + Math.abs(i - steps / 2) * 1.2)}`;
  }
  return `<g clip-path="url(#${p}-crown)"><path d="M${n(cx - w)} ${n(y - 4)}Q${cx} ${n(y - 18)} ${n(cx + w)} ${n(y - 4)}${zig}Z" fill="${c.hairHi}" opacity="0.55"/><path d="M${n(cx - w * 0.55)} ${n(y - 6)}Q${cx - 10} ${n(y - 13)} ${n(cx - w * 0.1)} ${n(y - 9)}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.55"/></g>`;
}

/** Cranium (the hair mass behind the face). */
export function cranium(p, r, c) {
  const { cx, headCY, headRX, headRY } = r;
  let s = `<ellipse cx="${cx}" cy="${headCY}" rx="${headRX}" ry="${headRY}" fill="url(#${p}-hair)" ${stroke(c)}/>`;
  // depth: darker hair mass around the face, plus a few broad strand curves on the crown
  s += `<g clip-path="url(#${p}-crown)"><ellipse cx="${cx}" cy="${n(headCY + headRY * 0.55)}" rx="${n(headRX * 0.95)}" ry="${n(headRY * 0.62)}" fill="${c.hairDeep}" opacity="0.45"/></g>`;
  s += `<path d="M${cx} ${n(headCY - headRY + 6)}Q${n(cx - headRX * 0.55)} ${n(headCY - headRY * 0.6)} ${n(cx - headRX * 0.86)} ${n(headCY + 6)}M${cx} ${n(headCY - headRY + 6)}Q${n(cx + headRX * 0.55)} ${n(headCY - headRY * 0.6)} ${n(cx + headRX * 0.86)} ${n(headCY + 6)}" fill="none" stroke="${c.hairShade}" stroke-width="1.6" opacity="0.6"/>`;
  return s;
}

// --- side locks ---------------------------------------------------------------

function lockPath(r, dir, style) {
  const { cx, fw, faceTop, jawY, chinY, sideLockEnd } = r;
  const top = faceTop - 6;
  const ox = cx + dir * (fw + 10);
  const ix = cx + dir * (fw - 10);
  if (style === 'hime') {
    const bot = chinY + 4;
    return `M${ox} ${top}C${ox + dir * 2} ${jawY} ${ox + dir * 2} ${bot - 20} ${ox + dir * 1} ${bot}L${ix - dir * 4} ${bot}C${ix - dir * 2} ${bot - 30} ${ix} ${jawY} ${ix + dir * 2} ${top + 10}Z`;
  }
  if (style === 'bob') {
    const bot = chinY + 10;
    return `M${ox} ${top}C${ox + dir * 12} ${jawY} ${ox + dir * 10} ${bot - 10} ${ix - dir * 6} ${bot}C${ix + dir * 2} ${bot - 18} ${ix} ${jawY} ${ix + dir * 2} ${top + 10}Z`;
  }
  const end = style === 'short' ? jawY + 40 : style === 'wavy' ? sideLockEnd + 18 : sideLockEnd;
  const tipX = cx + dir * (fw - 2);
  if (style === 'wavy') {
    const m1 = (top + end) / 2;
    return `M${ox} ${top}C${ox + dir * 14} ${top + 40} ${ox - dir * 4} ${m1 - 10} ${ox + dir * 8} ${m1 + 20}C${ox + dir * 18} ${end - 30} ${tipX + dir * 10} ${end - 10} ${tipX} ${end}C${tipX - dir * 2} ${end - 30} ${ix - dir * 6} ${m1 + 10} ${ix} ${m1 - 10}C${ix + dir * 4} ${jawY - 10} ${ix} ${top + 30} ${ix + dir * 2} ${top + 10}Z`;
  }
  return `M${ox} ${top}C${ox + dir * 8} ${jawY} ${ox + dir * 2} ${end - 46} ${tipX + dir * 12} ${end}C${tipX - dir * 2} ${end - 30} ${ix - dir * 4} ${jawY + 30} ${ix + dir * 2} ${top + 10}Z`;
}

/** Side locks framing the face. `skip` = side (-1/1) replaced by a braid. */
export function sideLocks(p, r, c, look, skip = 0) {
  const style = { hime: 'hime', bob: 'bob', short: 'short', wavy: 'wavy' }[look.hairStyle] || 'long';
  let s = '';
  for (const dir of [-1, 1]) {
    if (dir === skip) continue;
    const d = lockPath(r, dir, style);
    s += `<path d="${d}" fill="url(#${p}-hairS)" ${stroke(c, 2)}/>`;
    const x = r.cx + dir * (r.fw + 2);
    s += `<path d="M${x} ${r.faceTop + 6}Q${x + dir * 3} ${r.jawY + 20} ${x - dir * 1} ${r.chinY}" fill="none" stroke="${c.hairShade}" stroke-width="1.4" opacity="0.7"/>`;
    s += `<path d="M${x + dir * 5} ${r.faceTop + 16}Q${x + dir * 8} ${r.jawY} ${x + dir * 6} ${r.jawY + 26}" fill="none" stroke="${c.hairHi}" stroke-width="2.4" opacity="0.45"/>`;
  }
  return s;
}

// --- back hair ------------------------------------------------------------------

/** Tail (ponytail/twintail/side tail). from = tie point, dir = -1 left / 1 right. */
function tail(p, c, fx, fy, dir, len, width, curl = 1) {
  const bx = fx + dir * width * 1.25;
  const tipX = fx + dir * width * 0.55;
  const tipY = fy + len;
  const outer = `M${n(fx)} ${n(fy - 6)}C${n(bx + dir * width * 0.4)} ${n(fy - 10)} ${n(bx + dir * width * 0.25)} ${n(fy + len * 0.45)} ${n(bx - dir * width * 0.05)} ${n(fy + len * 0.7)}C${n(bx - dir * width * 0.2)} ${n(fy + len * 0.85)} ${n(tipX + dir * 12 * curl)} ${n(tipY - 4)} ${n(tipX - dir * 10 * curl)} ${n(tipY)}`;
  const inner = `C${n(tipX + dir * 6)} ${n(tipY - 30)} ${n(fx + dir * width * 0.45)} ${n(fy + len * 0.6)} ${n(fx + dir * width * 0.25)} ${n(fy + len * 0.35)}C${n(fx + dir * width * 0.05)} ${n(fy + len * 0.15)} ${n(fx - dir * 4)} ${n(fy + 14)} ${n(fx)} ${n(fy + 6)}Z`;
  let s = `<path d="${outer}${inner}" fill="url(#${p}-hair)" ${stroke(c, 2.2)}/>`;
  s += `<path d="M${n(fx + dir * 6)} ${n(fy + 4)}C${n(bx)} ${n(fy + len * 0.25)} ${n(bx - dir * width * 0.1)} ${n(fy + len * 0.6)} ${n(tipX + dir * 6)} ${n(tipY - 26)}" fill="none" stroke="${c.hairShade}" stroke-width="1.6" opacity="0.7"/>`;
  s += `<path d="M${n(fx + dir * 10)} ${n(fy + 10)}C${n(bx - dir * 6)} ${n(fy + len * 0.2)} ${n(bx - dir * width * 0.15)} ${n(fy + len * 0.4)} ${n(bx - dir * width * 0.3)} ${n(fy + len * 0.55)}" fill="none" stroke="${c.hairHi}" stroke-width="3" opacity="0.5" stroke-linecap="round"/>`;
  return s;
}

/** Hair tie / scrunchie. */
function tie(c, x, y, rr = 7) {
  return `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${rr}" ry="${n(rr * 0.75)}" fill="${c.accent}" stroke="${c.accentLine}" stroke-width="1.6"/><circle cx="${n(x - rr * 0.3)}" cy="${n(y - rr * 0.25)}" r="${n(rr * 0.25)}" fill="#fff" opacity="0.6"/>`;
}

/** Back hair layer (behind the body). */
export function backHair(p, r, c, look) {
  const { cx, headCY, headRX, chinY, backHairEnd } = r;
  const hs = look.hairStyle;
  const L = cx - headRX;
  const R = cx + headRX;
  let s = '';
  if (hs === 'long' || hs === 'hime' || hs === 'wavy') {
    const end = backHairEnd;
    const flare = hs === 'hime' ? 10 : hs === 'wavy' ? 34 : 24;
    // Right side outer edge and left handled symmetrical by constructing explicitly:
    let d = `M${n(L + 6)} ${headCY - 10}`;
    if (hs === 'wavy') {
      d += `C${n(L - 30)} ${headCY + 40} ${n(L - 6)} ${headCY + 110} ${n(L - flare)} ${headCY + 170}C${n(L - flare - 18)} ${headCY + 230} ${n(L - 8)} ${n(end - 60)} ${n(L - flare + 4)} ${n(end)}`;
    } else {
      d += `C${n(L - flare * 0.5)} ${headCY + 70} ${n(L - flare)} ${n(end - 140)} ${n(L - flare + 4)} ${n(end)}`;
    }
    const count = hs === 'hime' ? 1 : 7;
    if (hs === 'hime') {
      d += `L${n(R + flare - 4)} ${n(end)}`;
    } else {
      // bottom tips from left to right
      for (let i = 1; i <= count; i++) {
        const xa = L - flare + 4 + ((R + flare - 4 - (L - flare + 4)) * (i - 0.5)) / count;
        const xb = L - flare + 4 + ((R + flare - 4 - (L - flare + 4)) * i) / count;
        const tipY = end + (i % 2 ? 16 : 8) + (hs === 'wavy' ? 6 : 0);
        d += `Q${n(xa - 6)} ${n(tipY - 4)} ${n(xa)} ${n(tipY)}Q${n(xa + 4)} ${n(end - 6)} ${n(xb)} ${n(end)}`;
      }
    }
    if (hs === 'wavy') {
      d += `C${n(R + 8)} ${n(end - 60)} ${n(R + flare + 18)} ${headCY + 230} ${n(R + flare)} ${headCY + 170}C${n(R + 6)} ${headCY + 110} ${n(R + 30)} ${headCY + 40} ${n(R - 6)} ${headCY - 10}Z`;
    } else {
      d += `C${n(R + flare)} ${n(end - 140)} ${n(R + flare * 0.5)} ${headCY + 70} ${n(R - 6)} ${headCY - 10}Z`;
    }
    s += `<path d="${d}" fill="url(#${p}-hairB)" ${stroke(c, 2.4)}/>`;
    // inner strand lines
    s += `<path d="M${n(L + 10)} ${headCY + 60}Q${n(L - 4)} ${n(end - 100)} ${n(L - flare + 24)} ${n(end - 6)}M${n(R - 10)} ${headCY + 60}Q${n(R + 4)} ${n(end - 100)} ${n(R + flare - 24)} ${n(end - 6)}" fill="none" stroke="${c.hairDeep}" stroke-width="1.8" opacity="0.6"/>`;
    s += `<path d="M${n(L + 2)} ${headCY + 40}Q${n(L - flare * 0.6)} ${headCY + 120} ${n(L - flare * 0.7)} ${headCY + 200}" fill="none" stroke="${c.hairHi}" stroke-width="3.5" opacity="0.35" stroke-linecap="round"/>`;
    return s;
  }
  // medium / short base behind the head
  const end = hs === 'short' ? chinY + 4 : hs === 'bob' ? chinY + 22 : chinY + 30;
  const flare = hs === 'bob' ? 16 : 8;
  let d = `M${n(L + 4)} ${headCY - 10}C${n(L - flare)} ${headCY + 30} ${n(L - flare)} ${n(end - 30)} ${n(L - flare + 10)} ${n(end)}`;
  const count = 6;
  for (let i = 1; i <= count; i++) {
    const x0 = L - flare + 10;
    const x1 = R + flare - 10;
    const xa = x0 + ((x1 - x0) * (i - 0.5)) / count;
    const xb = x0 + ((x1 - x0) * i) / count;
    const tipY = end + (hs === 'bob' ? 4 : i % 2 ? 10 : 4);
    d += `Q${n(xa - 5)} ${n(tipY - 3)} ${n(xa)} ${n(tipY)}Q${n(xa + 4)} ${n(end - 8)} ${n(xb)} ${n(end)}`;
  }
  d += `C${n(R + flare)} ${n(end - 30)} ${n(R + flare)} ${headCY + 30} ${n(R - 4)} ${headCY - 10}Z`;
  // tails go behind the head mass
  if (hs === 'twintails') {
    const ty = headCY - r.headRY * 0.45;
    s += tail(p, c, L + 10, ty, -1, r.adult ? 260 : 270, 46);
    s += tail(p, c, R - 10, ty, 1, r.adult ? 260 : 270, 46);
  } else if (hs === 'ponytail') {
    s += tail(p, c, cx + headRX * 0.55, headCY - r.headRY * 0.78, 1, 250, 58, 1.4);
  } else if (hs === 'side') {
    s += tail(p, c, L + 8, headCY - r.headRY * 0.35, -1, 230, 44);
  } else if (hs === 'buns') {
    for (const dir of [-1, 1]) {
      const bx = cx + dir * headRX * 0.66;
      const by = headCY - r.headRY * 0.78;
      s += `<circle cx="${n(bx)}" cy="${n(by)}" r="${n(headRX * 0.36)}" fill="url(#${p}-hair)" ${stroke(c)}/>`;
      s += `<path d="M${n(bx - dir * headRX * 0.2)} ${n(by - headRX * 0.2)}Q${n(bx + dir * 6)} ${n(by - headRX * 0.3)} ${n(bx + dir * headRX * 0.24)} ${n(by - 4)}" fill="none" stroke="${c.hairHi}" stroke-width="3" opacity="0.55" stroke-linecap="round"/>`;
      s += `<path d="M${n(bx - headRX * 0.2)} ${n(by + 2)}Q${n(bx)} ${n(by + 10)} ${n(bx + headRX * 0.2)} ${n(by + 2)}" fill="none" stroke="${c.hairShade}" stroke-width="1.6" opacity="0.8"/>`;
    }
  }
  s = `<path d="${d}" fill="url(#${p}-hairB)" ${stroke(c, 2.4)}/>` + s;
  return s;
}

/** Ties / ornaments that sit on top of tails (drawn after the cranium). */
export function hairTies(p, r, c, look) {
  const { cx, headCY, headRX, headRY } = r;
  const hs = look.hairStyle;
  if (hs === 'twintails') {
    const ty = headCY - headRY * 0.45;
    return tie(c, cx - headRX + 10, ty, 8) + tie(c, cx + headRX - 10, ty, 8);
  }
  if (hs === 'ponytail') return tie(c, cx + headRX * 0.55, headCY - headRY * 0.78, 8);
  if (hs === 'side') return tie(c, cx - headRX + 8, headCY - headRY * 0.35, 8);
  if (hs === 'buns') {
    let s = '';
    for (const dir of [-1, 1]) {
      const bx = cx + dir * headRX * 0.66;
      const by = headCY - headRY * 0.78 + headRX * 0.3;
      s += `<path d="M${n(bx - 12)} ${n(by)}Q${n(bx)} ${n(by + 6)} ${n(bx + 12)} ${n(by)}" fill="none" stroke="${c.accent}" stroke-width="4" stroke-linecap="round"/>`;
    }
    return s;
  }
  return '';
}

/** Braid hanging over the left shoulder (front layer). */
export function braid(p, r, c) {
  const { cx, fw, jawY } = r;
  const x0 = cx - fw - 2;
  const y0 = jawY - 10;
  let s = `<path d="M${cx - fw - 12} ${r.faceTop}C${cx - fw - 14} ${jawY - 20} ${x0 - 10} ${y0 + 10} ${x0 - 4} ${y0 + 30}L${x0 + 14} ${y0 + 26}C${cx - fw + 6} ${jawY - 20} ${cx - fw} ${r.faceTop + 10} ${cx - fw + 6} ${r.faceTop - 4}Z" fill="url(#${p}-hairS)" ${stroke(c, 2)}/>`;
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const x = x0 + 4 - t * 22 + Math.sin(t * 3) * 4;
    const y = y0 + 34 + i * 22;
    const rot = i % 2 ? 22 : -22;
    const sz = 15 - t * 4;
    s += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(sz)}" ry="${n(sz * 0.8)}" transform="rotate(${rot} ${n(x)} ${n(y)})" fill="url(#${p}-hair)" ${stroke(c, 1.8)}/>`;
    s += `<path d="M${n(x - sz * 0.5)} ${n(y - 3)}q${n(sz * 0.5)} -5 ${n(sz)} 0" fill="none" stroke="${c.hairHi}" stroke-width="2" opacity="0.6"/>`;
  }
  const ex = x0 + 4 - 22 + Math.sin(3) * 4;
  const ey = y0 + 34 + segs * 22 - 6;
  s += tie(c, ex, ey, 8);
  s += `<path d="M${n(ex - 8)} ${n(ey + 4)}Q${n(ex - 12)} ${n(ey + 26)} ${n(ex - 4)} ${n(ey + 34)}Q${n(ex)} ${n(ey + 20)} ${n(ex + 2)} ${n(ey + 34)}Q${n(ex + 10)} ${n(ey + 22)} ${n(ex + 8)} ${n(ey + 4)}Z" fill="url(#${p}-hair)" ${stroke(c, 1.8)}/>`;
  return s;
}
