// Halos and head accessories for the card illustrations.

import { n, lighten, darken, mix, starPoints, petalPath, linGrad } from '../svgUtil.js';

/** Glow filter + accessory gradients. */
export function accessoryDefs(p, c) {
  return (
    `<filter id="${p}-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter>` +
    linGrad(`${p}-horn`, [[0, '#fffaf0'], [1, c.accent]]) +
    linGrad(`${p}-lens`, [[0, '#e8fbff'], [0.5, '#7fd6ff'], [1, '#2a6fb0']])
  );
}

// --- halos ---------------------------------------------------------------------

function haloShape(kind, R) {
  // Returns markup in local coordinates centred at (0,0). Flat (perspective) halos use flat=true.
  switch (kind) {
    case 'ring': {
      let ticks = '';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r1 = R * 0.78;
        const r2 = R * (i % 3 === 0 ? 0.62 : 0.7);
        ticks += `M${n(Math.cos(a) * r1)} ${n(Math.sin(a) * r1)}L${n(Math.cos(a) * r2)} ${n(Math.sin(a) * r2)}`;
      }
      return { flat: true, d: `<circle r="${R}" stroke-width="7"/><circle r="${n(R * 0.8)}" stroke-width="2.5"/><path d="${ticks}" stroke-width="3"/>` };
    }
    case 'petal': {
      let s = `<circle r="${n(R * 0.55)}" stroke-width="3"/>`;
      for (let i = 0; i < 6; i++) s += `<path d="${petalPath(R * 0.55)}" transform="rotate(${i * 60}) translate(0 ${n(-R * 0.45)})" stroke-width="3"/>`;
      return { flat: true, d: s };
    }
    case 'gear': {
      let d = '';
      const teeth = 12;
      for (let i = 0; i < teeth * 2; i++) {
        const a0 = (i / (teeth * 2)) * Math.PI * 2;
        const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
        const rr = i % 2 ? R * 0.84 : R;
        d += `${i ? 'L' : 'M'}${n(Math.cos(a0) * rr)} ${n(Math.sin(a0) * rr)}L${n(Math.cos(a1) * rr)} ${n(Math.sin(a1) * rr)}`;
      }
      return { flat: true, d: `<path d="${d}Z" stroke-width="5"/><circle r="${n(R * 0.55)}" stroke-width="3"/>` };
    }
    case 'wave': {
      let d = '';
      const k = 10;
      for (let i = 0; i <= k * 4; i++) {
        const a = (i / (k * 4)) * Math.PI * 2;
        const rr = R + Math.sin(i * (Math.PI / 2)) * 6;
        d += `${i ? 'L' : 'M'}${n(Math.cos(a) * rr)} ${n(Math.sin(a) * rr)}`;
      }
      return { flat: true, d: `<path d="${d}Z" stroke-width="5"/><circle r="${n(R * 0.72)}" stroke-width="3"/>` };
    }
    case 'snow': {
      let d = '';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(a);
        const y = Math.sin(a);
        d += `M0 0L${n(x * R * 0.62)} ${n(y * R * 0.62)}`;
        const bx = x * R * 0.4;
        const by = y * R * 0.4;
        const px = -y * R * 0.14;
        const py = x * R * 0.14;
        d += `M${n(bx + px)} ${n(by + py)}L${n(x * R * 0.5)} ${n(y * R * 0.5)}L${n(bx - px)} ${n(by - py)}`;
      }
      return { flat: false, d: `<circle r="${n(R * 0.72)}" stroke-width="3"/><path d="${d}" stroke-width="4" stroke-linecap="round"/>`, y: -6 };
    }
    case 'star':
      return { flat: false, d: `<polygon points="${starPoints(0, 0, R * 0.62, R * 0.28)}" stroke-width="5" stroke-linejoin="round"/><circle r="${n(R * 0.82)}" stroke-width="2.5" stroke-dasharray="4 7"/>`, y: -8 };
    case 'moon':
      return { flat: false, d: `<path d="M${n(-R * 0.1)} ${n(-R * 0.62)}A${n(R * 0.62)} ${n(R * 0.62)} 0 1 0 ${n(R * 0.56)} ${n(R * 0.24)}A${n(R * 0.5)} ${n(R * 0.5)} 0 1 1 ${n(-R * 0.1)} ${n(-R * 0.62)}Z" stroke-width="4"/><polygon points="${starPoints(R * 0.5, -R * 0.42, 9, 3.6)}" stroke-width="2"/><polygon points="${starPoints(-R * 0.62, R * 0.1, 6, 2.4)}" stroke-width="2"/>`, y: -6 };
    case 'flame':
      return { flat: false, d: `<path d="M0 ${n(R * 0.5)}C${n(-R * 0.6)} ${n(R * 0.4)} ${n(-R * 0.6)} ${n(-R * 0.1)} ${n(-R * 0.3)} ${n(-R * 0.3)}C${n(-R * 0.3)} ${n(-R * 0.05)} ${n(-R * 0.15)} 0 ${n(-R * 0.1)} ${n(-R * 0.05)}C${n(-R * 0.2)} ${n(-R * 0.4)} ${n(-R * 0.05)} ${n(-R * 0.6)} ${n(R * 0.1)} ${n(-R * 0.75)}C${n(R * 0.05)} ${n(-R * 0.45)} ${n(R * 0.3)} ${n(-R * 0.4)} ${n(R * 0.32)} ${n(-R * 0.2)}C${n(R * 0.42)} ${n(-R * 0.3)} ${n(R * 0.45)} ${n(-R * 0.42)} ${n(R * 0.42)} ${n(-R * 0.55)}C${n(R * 0.7)} ${n(-R * 0.2)} ${n(R * 0.6)} ${n(R * 0.4)} 0 ${n(R * 0.5)}Z" stroke-width="4" stroke-linejoin="round"/><ellipse cy="${n(R * 0.5)}" rx="${n(R * 0.85)}" ry="${n(R * 0.2)}" stroke-width="3"/>`, y: -14 };
    case 'crown':
      return { flat: false, d: `<path d="M${n(-R * 0.75)} ${n(R * 0.2)}L${n(-R * 0.8)} ${n(-R * 0.35)}L${n(-R * 0.4)} ${n(-R * 0.05)}L0 ${n(-R * 0.55)}L${n(R * 0.4)} ${n(-R * 0.05)}L${n(R * 0.8)} ${n(-R * 0.35)}L${n(R * 0.75)} ${n(R * 0.2)}Z" stroke-width="4" stroke-linejoin="round"/><ellipse cy="${n(R * 0.24)}" rx="${n(R * 0.95)}" ry="${n(R * 0.2)}" stroke-width="4"/><circle cy="${n(-R * 0.62)}" r="4" stroke-width="2"/>`, y: -6 };
    case 'bolt':
      return { flat: false, d: `<circle r="${n(R * 0.72)}" stroke-width="3" stroke-dasharray="14 6"/><path d="M${n(R * 0.1)} ${n(-R * 0.62)}L${n(-R * 0.3)} ${n(R * 0.06)}L${n(-R * 0.02)} ${n(R * 0.06)}L${n(-R * 0.14)} ${n(R * 0.62)}L${n(R * 0.32)} ${n(-R * 0.12)}L${n(R * 0.04)} ${n(-R * 0.12)}Z" stroke-width="4" stroke-linejoin="round"/>`, y: -6 };
    case 'leaf': {
      // maple leaf
      const s = R * 0.62;
      const d = `M0 ${n(s * 0.9)}L0 ${n(s * 0.3)}L${n(-s * 0.55)} ${n(s * 0.45)}L${n(-s * 0.45)} ${n(s * 0.2)}L${n(-s * 0.95)} ${n(-s * 0.15)}L${n(-s * 0.72)} ${n(-s * 0.25)}L${n(-s * 0.8)} ${n(-s * 0.6)}L${n(-s * 0.42)} ${n(-s * 0.45)}L${n(-s * 0.3)} ${n(-s * 0.68)}L0 ${n(-s * 1.05)}L${n(s * 0.3)} ${n(-s * 0.68)}L${n(s * 0.42)} ${n(-s * 0.45)}L${n(s * 0.8)} ${n(-s * 0.6)}L${n(s * 0.72)} ${n(-s * 0.25)}L${n(s * 0.95)} ${n(-s * 0.15)}L${n(s * 0.45)} ${n(s * 0.2)}L${n(s * 0.55)} ${n(s * 0.45)}L0 ${n(s * 0.3)}`;
      return { flat: false, d: `<path d="${d}" stroke-width="4" stroke-linejoin="round"/><circle r="${n(R * 0.82)}" stroke-width="2.5"/>`, y: -6 };
    }
    case 'eye':
      return { flat: false, d: `<path d="M${n(-R * 0.85)} 0Q0 ${n(-R * 0.7)} ${n(R * 0.85)} 0Q0 ${n(R * 0.7)} ${n(-R * 0.85)} 0Z" stroke-width="4"/><circle r="${n(R * 0.24)}" stroke-width="4"/><circle r="${n(R * 0.07)}" stroke-width="3"/><path d="M0 ${n(-R * 0.5)}V${n(-R * 0.75)}M0 ${n(R * 0.5)}V${n(R * 0.75)}M${n(-R * 0.98)} 0H${n(-R * 1.1)}M${n(R * 0.98)} 0H${n(R * 1.1)}" stroke-width="3"/>`, y: -4 };
    default:
      return haloShape('ring', R);
  }
}

/** Halo behind the head (with glow). */
export function halo(p, r, c, look) {
  const { flat, d, y = 0 } = haloShape(look.halo, r.haloR);
  const t = flat ? `translate(${r.cx} ${r.haloY + 4}) scale(1 0.36)` : `translate(${r.cx} ${r.haloY + y}) scale(0.82)`;
  const col = c.halo;
  const deep = darken(mix(c.halo, c.accent, 0.6), 0.12);
  return `<defs><g id="${p}-h">${d}</g></defs><g transform="${t}" fill="${col}" fill-opacity="0.18" stroke="${deep}" stroke-linecap="round"><use href="#${p}-h" filter="url(#${p}-glow)" stroke="${col}"/><use href="#${p}-h"/></g>`;
}

// --- accessories -------------------------------------------------------------------

function ears(p, r, c, kind) {
  const { cx, headCY, headRX, headRY } = r;
  let s = '';
  for (const dir of [-1, 1]) {
    const bx = cx + dir * headRX * 0.62;
    const by = headCY - headRY * 0.78;
    if (kind === 'bunnyEars') {
      const tilt = dir * 14 + (dir > 0 ? 18 : 0);
      s += `<g transform="rotate(${tilt} ${n(bx)} ${n(by + 10)})"><path d="M${n(bx - 13)} ${n(by + 10)}C${n(bx - 20)} ${n(by - 50)} ${n(bx - 14)} ${n(by - 96)} ${n(bx)} ${n(by - 98)}C${n(bx + 14)} ${n(by - 96)} ${n(bx + 20)} ${n(by - 50)} ${n(bx + 13)} ${n(by + 10)}Z" fill="#fffafc" stroke="${darken(c.accent, 0.35)}" stroke-width="2.2"/><path d="M${n(bx - 6)} ${n(by)}C${n(bx - 10)} ${n(by - 44)} ${n(bx - 6)} ${n(by - 80)} ${n(bx)} ${n(by - 84)}C${n(bx + 6)} ${n(by - 80)} ${n(bx + 10)} ${n(by - 44)} ${n(bx + 6)} ${n(by)}Z" fill="${lighten(c.accent, 0.35)}"/></g>`;
    } else {
      const fox = kind === 'foxEars';
      const h = fox ? 60 : 44;
      const w = fox ? 26 : 24;
      const tipX = bx + dir * (fox ? 16 : 12);
      const outer = `M${n(bx - dir * w)} ${n(by + 14)}Q${n(bx - dir * 4)} ${n(by - h * 0.7)} ${n(tipX)} ${n(by - h)}Q${n(bx + dir * w * 1.1)} ${n(by - h * 0.3)} ${n(bx + dir * w)} ${n(by + 20)}Z`;
      const inner = `M${n(bx - dir * w * 0.5)} ${n(by + 10)}Q${n(bx)} ${n(by - h * 0.55)} ${n(tipX - dir * 2)} ${n(by - h * 0.8)}Q${n(bx + dir * w * 0.8)} ${n(by - h * 0.3)} ${n(bx + dir * w * 0.6)} ${n(by + 14)}Z`;
      s += `<path d="${outer}" fill="url(#${p}-hair)" stroke="${c.hairLine}" stroke-width="2.2" stroke-linejoin="round"/>`;
      s += `<path d="${inner}" fill="${fox ? '#fff3e6' : '#ffc4d6'}"/>`;
      if (fox) s += `<path d="M${n(tipX)} ${n(by - h)}Q${n(tipX + dir * 2)} ${n(by - h * 0.7)} ${n(tipX - dir * 12)} ${n(by - h * 0.62)}Q${n(tipX - dir * 4)} ${n(by - h * 0.82)} ${n(tipX)} ${n(by - h)}Z" fill="#fff" stroke="${c.hairLine}" stroke-width="1.4"/>`;
    }
  }
  return s;
}

/** Accessory parts drawn BEHIND the head (before the cranium). */
export function accessoryBack(p, r, c, look) {
  const { cx, headCY, headRX, headRY } = r;
  switch (look.accessory) {
    case 'bunnyEars':
      return ears(p, r, c, 'bunnyEars');
    case 'hood':
      return `<path d="M${n(cx - headRX - 16)} ${headCY + 10}C${n(cx - headRX - 24)} ${n(headCY - headRY - 30)} ${n(cx + headRX + 24)} ${n(headCY - headRY - 30)} ${n(cx + headRX + 16)} ${headCY + 10}C${n(cx + headRX + 22)} ${headCY + 80} ${n(cx + headRX + 30)} ${headCY + 120} ${n(cx + headRX * 0.6)} ${headCY + 132}L${n(cx - headRX * 0.6)} ${headCY + 132}C${n(cx - headRX - 30)} ${headCY + 120} ${n(cx - headRX - 22)} ${headCY + 80} ${n(cx - headRX - 16)} ${headCY + 10}Z" fill="${c.outfitShade}" stroke="${c.outfitLine}" stroke-width="2.2"/>`;
    case 'witchHat':
      return '';
    default:
      return '';
  }
}

/** Accessory parts drawn on top of the cranium but under the bangs. */
export function accessoryMid(p, r, c, look) {
  if (look.accessory === 'catEars' || look.accessory === 'foxEars') return ears(p, r, c, look.accessory);
  if (look.accessory === 'horns') {
    const { cx, headCY, headRX, headRY } = r;
    let s = '';
    for (const dir of [-1, 1]) {
      const bx = cx + dir * headRX * 0.42;
      const by = headCY - headRY * 0.86;
      s += `<path d="M${n(bx - 10)} ${n(by + 10)}Q${n(bx - 6 + dir * 2)} ${n(by - 20)} ${n(bx + dir * 14)} ${n(by - 38)}Q${n(bx + dir * 6)} ${n(by - 12)} ${n(bx + 10)} ${n(by + 12)}Z" fill="url(#${p}-horn)" stroke="${darken(c.accent, 0.45)}" stroke-width="2" stroke-linejoin="round"/><path d="M${n(bx - 6)} ${n(by - 2)}q8 -2 12 2M${n(bx - 3)} ${n(by - 14)}q6 -2 9 2" stroke="${darken(c.accent, 0.3)}" stroke-width="1.4" fill="none"/>`;
    }
    return s;
  }
  return '';
}

/** Accessory parts drawn in front of everything on the head. */
export function accessoryFront(p, r, c, look) {
  const { cx, headCY, headRX, headRY, faceTop } = r;
  const acc = c.accent;
  const accLine = darken(acc, 0.45);
  switch (look.accessory) {
    case 'ribbon': {
      const x = cx + headRX * 0.62;
      const y = headCY - headRY * 0.72;
      const col = acc === '#ffffff' ? '#ff5d73' : acc;
      return `<g transform="rotate(24 ${n(x)} ${n(y)})">${bowShape(x, y, 1.5, col, darken(col, 0.45))}</g>`;
    }
    case 'hairpin': {
      const x = cx - headRX * 0.62;
      const y = faceTop + 8;
      return `<g transform="rotate(-30 ${n(x)} ${n(y)})"><rect x="${n(x - 18)}" y="${n(y - 3)}" width="36" height="6" rx="3" fill="${acc}" stroke="${accLine}" stroke-width="1.4"/><rect x="${n(x - 14)}" y="${n(y + 7)}" width="30" height="6" rx="3" fill="${lighten(acc, 0.3)}" stroke="${accLine}" stroke-width="1.4"/></g><polygon points="${starPoints(x + 16, y - 10, 9, 4)}" fill="#ffe066" stroke="#b8860b" stroke-width="1.4" stroke-linejoin="round"/>`;
    }
    case 'beret': {
      const x = cx + 12;
      const y = headCY - headRY * 0.78;
      const col = c.outfit;
      return `<g transform="rotate(-12 ${x} ${n(y)})"><path d="M${n(x - headRX * 0.95)} ${n(y + 16)}C${n(x - headRX * 1.1)} ${n(y - 40)} ${n(x + headRX * 1.15)} ${n(y - 44)} ${n(x + headRX * 1.0)} ${n(y + 14)}Q${x} ${n(y + 28)} ${n(x - headRX * 0.95)} ${n(y + 16)}Z" fill="${col}" stroke="${c.outfitLine}" stroke-width="2.2"/><path d="M${n(x - headRX * 0.7)} ${n(y - 6)}Q${x} ${n(y - 30)} ${n(x + headRX * 0.6)} ${n(y - 10)}" fill="none" stroke="${lighten(col, 0.3)}" stroke-width="3" opacity="0.7"/><path d="M${x - 3} ${n(y - 26)}l4 -10l4 10z" fill="${col}" stroke="${c.outfitLine}" stroke-width="1.4"/><circle cx="${n(x + headRX * 0.55)}" cy="${n(y + 4)}" r="8" fill="${acc}" stroke="${accLine}" stroke-width="1.6"/><circle cx="${n(x + headRX * 0.55)}" cy="${n(y + 4)}" r="3" fill="#fff"/></g>`;
    }
    case 'witchHat': {
      const y = headCY - headRY * 0.62;
      const col = c.outfit;
      const shade = c.outfitShade;
      return `<path d="M${n(cx - headRX * 0.7)} ${n(y + 4)}C${n(cx - headRX * 0.4)} ${n(y - 70)} ${n(cx - 10)} ${n(y - 120)} ${n(cx + headRX * 0.9)} ${n(y - 150)}C${n(cx + headRX * 0.5)} ${n(y - 110)} ${n(cx + headRX * 0.6)} ${n(y - 50)} ${n(cx + headRX * 0.8)} ${n(y + 2)}Z" fill="${col}" stroke="${lighten(col, 0.35)}" stroke-width="2"/>` +
        `<path d="M${n(cx - headRX * 0.66)} ${n(y - 14)}Q${cx} ${n(y - 34)} ${n(cx + headRX * 0.74)} ${n(y - 16)}L${n(cx + headRX * 0.78)} ${n(y - 2)}Q${cx} ${n(y - 20)} ${n(cx - headRX * 0.7)} ${n(y)}Z" fill="${acc}" stroke="${accLine}" stroke-width="1.4"/>` +
        `<ellipse cx="${cx}" cy="${n(y + 4)}" rx="${n(headRX * 1.55)}" ry="${n(headRY * 0.26)}" fill="${shade}" stroke="${lighten(col, 0.35)}" stroke-width="2"/>` +
        `<path d="M${n(cx - headRX * 1.4)} ${n(y + 8)}Q${cx} ${n(y + 30)} ${n(cx + headRX * 1.4)} ${n(y + 8)}" fill="none" stroke="${acc}" stroke-width="2" opacity="0.8"/>` +
        `<polygon points="${starPoints(cx + headRX * 0.9, y - 150, 9, 4)}" fill="#ffe680" stroke="#b8860b" stroke-width="1.2"/>` +
        `<path d="M${n(cx + headRX * 0.3)} ${n(y - 22)}a9 9 0 1 0 10 -12a7 7 0 1 1 -10 12z" fill="#fff3b0"/>`;
    }
    case 'flower': {
      const x = cx - headRX * 0.78;
      const y = headCY - headRY * 0.25;
      const col = mix(acc, '#ff6f91', 0.5);
      let s = `<g transform="translate(${n(x)} ${n(y)})">`;
      for (let i = 0; i < 5; i++) s += `<ellipse cx="0" cy="-13" rx="10" ry="14" transform="rotate(${i * 72 + 10})" fill="${col}" stroke="${darken(col, 0.4)}" stroke-width="1.6"/>`;
      s += `<circle r="6" fill="#ffe066" stroke="#c99a00" stroke-width="1.2"/><circle cx="-2" cy="-2" r="2" fill="#fff"/>`;
      s += `<path d="M14 6q14 6 22 0q-6 12 -22 0z" fill="#5cb85c" stroke="#2e7d32" stroke-width="1.2"/></g>`;
      return s;
    }
    case 'goggles': {
      const y = faceTop - 8;
      const strap = darken(acc, 0.1);
      let s = `<path d="M${n(cx - headRX - 2)} ${y + 10}Q${cx} ${y - 22} ${n(cx + headRX + 2)} ${y + 10}" fill="none" stroke="${strap}" stroke-width="9"/>`;
      for (const dir of [-1, 1]) {
        const gx = cx + dir * 26;
        s += `<circle cx="${gx}" cy="${y - 4}" r="17" fill="#5c6b7a" stroke="#2b2d42" stroke-width="2"/><circle cx="${gx}" cy="${y - 4}" r="12" fill="url(#${p}-lens)"/><path d="M${gx - 7} ${y - 9}q4 -4 8 -3" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
      }
      s += `<rect x="${cx - 9}" y="${y - 8}" width="18" height="7" rx="3" fill="#5c6b7a" stroke="#2b2d42" stroke-width="1.4"/>`;
      return s;
    }
    case 'hood': {
      const top = headCY - headRY - 10;
      const trim = c.accent === '#ffffff' ? '#ffffff' : c.accent;
      const d = `M${n(cx - headRX - 14)} ${headCY + 40}C${n(cx - headRX - 22)} ${n(top)} ${n(cx + headRX + 22)} ${n(top)} ${n(cx + headRX + 14)} ${headCY + 40}L${n(cx + headRX - 2)} ${headCY + 40}C${n(cx + headRX)} ${n(top + 24)} ${n(cx - headRX)} ${n(top + 24)} ${n(cx - headRX + 2)} ${headCY + 40}Z`;
      return `<path d="${d}" fill="${c.outfit}" stroke="${c.outfitLine}" stroke-width="2.2" stroke-linejoin="round"/><path d="M${n(cx - headRX + 4)} ${headCY + 38}C${n(cx - headRX + 2)} ${n(top + 26)} ${n(cx + headRX - 2)} ${n(top + 26)} ${n(cx + headRX - 4)} ${headCY + 38}" fill="none" stroke="${trim}" stroke-width="7" stroke-linecap="round"/><path d="M${n(cx - headRX + 4)} ${headCY + 38}C${n(cx - headRX + 2)} ${n(top + 26)} ${n(cx + headRX - 2)} ${n(top + 26)} ${n(cx + headRX - 4)} ${headCY + 38}" fill="none" stroke="${darken(trim, 0.25)}" stroke-width="1.4" stroke-dasharray="2 5"/>`;
    }
    case 'headband': {
      const y = faceTop - 4;
      const col = acc;
      return `<path d="M${n(cx - headRX - 2)} ${y + 14}Q${cx} ${y - 16} ${n(cx + headRX + 2)} ${y + 14}L${n(cx + headRX)} ${y + 26}Q${cx} ${y - 4} ${n(cx - headRX)} ${y + 26}Z" fill="${col}" stroke="${darken(col, 0.45)}" stroke-width="2"/><path d="M${n(cx + headRX - 2)} ${y + 18}q30 6 46 30l-10 4q-14 -18 -36 -24zM${n(cx + headRX - 2)} ${y + 20}q24 18 26 46l-10 0q-2 -24 -16 -40z" fill="${col}" stroke="${darken(col, 0.45)}" stroke-width="1.8" stroke-linejoin="round"/><rect x="${cx - 16}" y="${y - 2}" width="32" height="14" rx="3" fill="#dfe6f0" stroke="#5c6b7a" stroke-width="1.6"/><path d="M${cx - 8} ${y + 5}h16" stroke="#5c6b7a" stroke-width="2"/>`;
    }
    case 'crown': {
      const y = headCY - headRY * 0.86;
      const gold = '#ffd166';
      return `<path d="M${cx - 34} ${n(y + 10)}L${cx - 38} ${n(y - 12)}L${cx - 20} ${n(y)}L${cx - 10} ${n(y - 22)}L${cx} ${n(y - 8)}L${cx + 10} ${n(y - 22)}L${cx + 20} ${n(y)}L${cx + 38} ${n(y - 12)}L${cx + 34} ${n(y + 10)}Q${cx} ${n(y + 18)} ${cx - 34} ${n(y + 10)}Z" fill="${gold}" stroke="#a8740a" stroke-width="2" stroke-linejoin="round"/><circle cx="${cx}" cy="${n(y + 4)}" r="5" fill="#7fc8ff" stroke="#2a6fb0" stroke-width="1.4"/><circle cx="${cx - 22}" cy="${n(y + 6)}" r="3" fill="#ff8fab"/><circle cx="${cx + 22}" cy="${n(y + 6)}" r="3" fill="#ff8fab"/><path d="M${cx - 28} ${n(y + 2)}q10 -4 18 -2" stroke="#fff" stroke-width="2" fill="none" opacity="0.7"/>`;
    }
    default:
      return '';
  }
}

function bowShape(x, y, s, fill, line) {
  return `<path d="M${x} ${y}C${n(x - 12 * s)} ${n(y - 18 * s)} ${n(x - 28 * s)} ${n(y - 12 * s)} ${n(x - 26 * s)} ${y}C${n(x - 28 * s)} ${n(y + 12 * s)} ${n(x - 12 * s)} ${n(y + 14 * s)} ${x} ${y}ZM${x} ${y}C${n(x + 12 * s)} ${n(y - 18 * s)} ${n(x + 28 * s)} ${n(y - 12 * s)} ${n(x + 26 * s)} ${y}C${n(x + 28 * s)} ${n(y + 12 * s)} ${n(x + 12 * s)} ${n(y + 14 * s)} ${x} ${y}Z" fill="${fill}" stroke="${line}" stroke-width="2" stroke-linejoin="round"/><path d="M${n(x - 18 * s)} ${n(y - 6 * s)}q7 -6 13 -1M${n(x + 6 * s)} ${n(y - 6 * s)}q7 -5 12 0" fill="none" stroke="#fff" stroke-width="2" opacity="0.55" stroke-linecap="round"/><ellipse cx="${x}" cy="${y}" rx="${n(6 * s)}" ry="${n(7 * s)}" fill="${fill}" stroke="${line}" stroke-width="2"/>`;
}
