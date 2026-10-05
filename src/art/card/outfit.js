// Torso + outfits for the card illustrations. Bust framing: shoulders down to the card edge.

import { n, linGrad, lighten, darken, mix, luminance, petalPath } from '../svgUtil.js';

/** Torso silhouette (shoulders + upper arms) ending below the canvas. */
export function torsoPath(r, widen = 0) {
  const { cx, neckW, neckBot, shoulderY, shoulderW } = r;
  const sw = shoulderW + widen;
  const nb = neckBot - 18;
  const half = (dir) => {
    const x = (v) => n(cx + dir * v);
    return [
      `${x(neckW + 2)} ${nb}`,
      `C${x(neckW + 6)} ${nb + 14} ${x(sw * 0.45)} ${shoulderY - 12} ${x(sw * 0.72)} ${shoulderY - 6}`,
      `C${x(sw * 0.94)} ${shoulderY} ${x(sw * 1.02)} ${shoulderY + 22} ${x(sw * 1.04)} ${shoulderY + 56}`,
      `L${x(sw * 1.1)} 520`,
    ];
  };
  const l = half(-1);
  const rr = half(1);
  return `M${l[0]}${l[1]}${l[2]}${l[3]}L${n(cx + (shoulderW + widen) * 1.1)} 520L${n(cx + (shoulderW + widen) * 1.04)} ${shoulderY + 56}C${n(cx + sw * 1.02)} ${shoulderY + 22} ${n(cx + sw * 0.94)} ${shoulderY} ${n(cx + sw * 0.72)} ${shoulderY - 6}C${n(cx + sw * 0.45)} ${shoulderY - 12} ${n(cx + neckW + 6)} ${nb + 14} ${rr[0]}Z`;
}

/** Gradients used by outfits. */
export function outfitDefs(p, c) {
  return (
    linGrad(`${p}-cloth`, [[0, c.outfitShade], [0.22, c.outfit], [0.6, lighten(c.outfit, 0.08)], [1, c.outfitShade]], { x2: 1, y2: 0 }) +
    linGrad(`${p}-acc`, [[0, lighten(c.accent, 0.25)], [1, darken(c.accent, 0.12)]]) +
    `<g id="${p}-bl">${[0, 72, 144, 216, 288].map((a) => `<path d="${petalPath(8)}" transform="rotate(${a})"/>`).join('')}<circle r="1.8" fill="currentColor"/></g>`
  );
}

const ln = (c, w = 2) => `stroke="${c.outfitLine}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

/** Small bow (ribbon) centred at x,y. */
export function bow(x, y, s, fill, line) {
  return (
    `<path d="M${x} ${y}C${n(x - 10 * s)} ${n(y - 14 * s)} ${n(x - 24 * s)} ${n(y - 10 * s)} ${n(x - 22 * s)} ${y}C${n(x - 24 * s)} ${n(y + 10 * s)} ${n(x - 10 * s)} ${n(y + 12 * s)} ${x} ${y}Z` +
    `M${x} ${y}C${n(x + 10 * s)} ${n(y - 14 * s)} ${n(x + 24 * s)} ${n(y - 10 * s)} ${n(x + 22 * s)} ${y}C${n(x + 24 * s)} ${n(y + 10 * s)} ${n(x + 10 * s)} ${n(y + 12 * s)} ${x} ${y}Z" fill="${fill}" stroke="${line}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M${n(x - 3 * s)} ${n(y + 3 * s)}L${n(x - 12 * s)} ${n(y + 30 * s)}L${n(x - 4 * s)} ${n(y + 26 * s)}L${n(x)} ${n(y + 32 * s)}L${n(x + 1 * s)} ${n(y + 4 * s)}ZM${n(x + 3 * s)} ${n(y + 3 * s)}L${n(x + 14 * s)} ${n(y + 28 * s)}L${n(x + 6 * s)} ${n(y + 26 * s)}L${n(x + 3 * s)} ${n(y + 32 * s)}Z" fill="${fill}" stroke="${line}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<ellipse cx="${x}" cy="${y}" rx="${n(5 * s)}" ry="${n(6 * s)}" fill="${fill}" stroke="${line}" stroke-width="1.6"/>` +
    `<path d="M${n(x - 16 * s)} ${n(y - 4 * s)}q6 -5 11 -1" fill="none" stroke="#fff" stroke-width="2" opacity="0.5" stroke-linecap="round"/>`
  );
}

function folds(r, c) {
  const { cx, shoulderY, shoulderW } = r;
  return `<path d="M${n(cx - shoulderW * 0.78)} ${shoulderY + 70}Q${n(cx - shoulderW * 0.8)} ${shoulderY + 130} ${n(cx - shoulderW * 0.86)} 500M${n(cx + shoulderW * 0.78)} ${shoulderY + 70}Q${n(cx + shoulderW * 0.8)} ${shoulderY + 130} ${n(cx + shoulderW * 0.86)} 500" fill="none" stroke="${c.outfitShade}" stroke-width="3" opacity="0.9"/>` +
    `<path d="M${n(cx - shoulderW * 0.82)} ${shoulderY + 60}L${n(cx - shoulderW * 0.86)} 500M${n(cx + shoulderW * 0.82)} ${shoulderY + 60}L${n(cx + shoulderW * 0.86)} 500" fill="none" ${ln(c, 1.6)} opacity="0.55"/>`;
}

const navy = '#2c3e6b';

function sailor(p, r, c) {
  const { cx, neckW, neckBot, shoulderY, shoulderW } = r;
  const collar = luminance(c.accent) < 0.25 ? c.accent : navy;
  const ribbon = luminance(c.accent) < 0.25 ? '#ff5d73' : c.accent;
  const vy = shoulderY + 72;
  const nb = neckBot - 16;
  const sw = shoulderW;
  let s = folds(r, c);
  // collar (evenodd: outer shape minus the front V)
  const outer = `M${cx - neckW - 4} ${nb - 4}C${n(cx - sw * 0.5)} ${shoulderY - 12} ${n(cx - sw * 0.92)} ${shoulderY - 2} ${n(cx - sw * 0.98)} ${shoulderY + 22}L${n(cx - sw * 0.5)} ${shoulderY + 48}L${cx} ${vy + 6}L${n(cx + sw * 0.5)} ${shoulderY + 48}L${n(cx + sw * 0.98)} ${shoulderY + 22}C${n(cx + sw * 0.92)} ${shoulderY - 2} ${n(cx + sw * 0.5)} ${shoulderY - 12} ${cx + neckW + 4} ${nb - 4}Z`;
  const inner = `M${cx - neckW - 2} ${nb}L${cx} ${vy - 6}L${cx + neckW + 2} ${nb}Z`;
  // dickey under the V
  s += `<path d="${inner}" fill="${c.outfit}"/>`;
  s += `<path d="${outer}${inner}" fill="${collar}" fill-rule="evenodd" stroke="${darken(collar, 0.35)}" stroke-width="2" stroke-linejoin="round"/>`;
  s += `<path d="M${n(cx - sw * 0.9)} ${shoulderY + 22}L${n(cx - sw * 0.48)} ${shoulderY + 41}L${cx - 6} ${vy - 2}M${n(cx + sw * 0.9)} ${shoulderY + 22}L${n(cx + sw * 0.48)} ${shoulderY + 41}L${cx + 6} ${vy - 2}" fill="none" stroke="#fff" stroke-width="2.4" opacity="0.9"/>`;
  s += bow(cx, vy + 4, 1.1, ribbon, darken(ribbon, 0.4));
  return s;
}

function blazer(p, r, c) {
  const { cx, neckW, neckBot, shoulderY, shoulderW } = r;
  const nb = neckBot - 16;
  const vy = shoulderY + 110;
  let s = '';
  s += `<path d="M${cx - neckW - 3} ${nb}L${cx} ${vy}L${cx + neckW + 3} ${nb}Z" fill="#fbfbff"/>`;
  // tie
  s += `<path d="M${cx - 6} ${nb + 10}L${cx + 6} ${nb + 10}L${cx + 9} ${vy - 10}L${cx} ${vy + 2}L${cx - 9} ${vy - 10}Z" fill="url(#${p}-acc)" stroke="${c.accentLine}" stroke-width="1.6"/>`;
  s += `<path d="M${cx - 8} ${nb + 2}L${cx + 8} ${nb + 2}L${cx + 5} ${nb + 12}L${cx - 5} ${nb + 12}Z" fill="${c.accent}" stroke="${c.accentLine}" stroke-width="1.4"/>`;
  // shirt collar points
  s += `<path d="M${cx - neckW - 4} ${nb - 4}L${cx - 2} ${nb + 6}L${cx - 16} ${nb + 18}ZM${cx + neckW + 4} ${nb - 4}L${cx + 2} ${nb + 6}L${cx + 16} ${nb + 18}Z" fill="#fff" stroke="#9aa7c0" stroke-width="1.4" stroke-linejoin="round"/>`;
  // lapels
  for (const dir of [-1, 1]) {
    const x = (v) => n(cx + dir * v);
    s += `<path d="M${x(neckW + 4)} ${nb - 2}L${x(shoulderW * 0.42)} ${shoulderY - 4}L${x(shoulderW * 0.38)} ${shoulderY + 30}L${x(shoulderW * 0.5)} ${shoulderY + 34}L${x(4)} ${vy + 4}L${x(14)} ${vy - 30}Z" fill="${c.outfitShade}" ${ln(c)}/>`;
  }
  s += `<circle cx="${cx - 14}" cy="${vy + 20}" r="4" fill="#e2c275" stroke="#8a6d2a" stroke-width="1.2"/><circle cx="${cx - 14}" cy="${vy + 50}" r="4" fill="#e2c275" stroke="#8a6d2a" stroke-width="1.2"/>`;
  s += `<path d="M${n(cx + shoulderW * 0.42)} ${shoulderY + 80}h26v6h-26z" fill="${c.outfitShade}" ${ln(c, 1.4)}/>`;
  s += `<path d="M${n(cx + shoulderW * 0.46)} ${shoulderY + 70}l6 -14l6 14" fill="${c.accent}" stroke="${c.accentLine}" stroke-width="1"/>`;
  s += folds(r, c);
  return s;
}

function crossedCollar(r, c, band, under) {
  const { cx, neckW, neckBot, shoulderY } = r;
  const nb = neckBot - 16;
  const vy = shoulderY + 64;
  const dk = darken(band, 0.35);
  let s = `<path d="M${cx - neckW - 2} ${nb}L${cx + 4} ${vy}L${cx + neckW + 2} ${nb}Z" fill="${under}"/>`;
  // right panel (under), then left panel overlapping it: a clean "y" fold, not an X
  s += `<path d="M${cx + neckW + 2} ${nb - 6}L${cx + neckW + 16} ${nb - 4}L${cx + 10} ${vy - 4}L${cx + 2} ${vy - 14}Z" fill="${band}" stroke="${dk}" stroke-width="1.8" stroke-linejoin="round"/>`;
  s += `<path d="M${cx - neckW - 2} ${nb - 6}L${cx - neckW - 16} ${nb - 4}L${cx + 8} ${vy + 18}L${cx + 18} ${vy + 6}Z" fill="${band}" stroke="${dk}" stroke-width="1.8" stroke-linejoin="round"/>`;
  s += `<path d="M${cx + 18} ${vy + 6}Q${cx + 40} ${vy + 40} ${cx + 44} ${vy + 120}" fill="none" stroke="${c.outfitLine}" stroke-width="1.6" opacity="0.7"/>`;
  return s;
}

function miko(p, r, c) {
  const { cx, shoulderY, shoulderW } = r;
  let s = folds(r, c);
  s += crossedCollar(r, c, '#ffffff', c.accent);
  s += `<path d="M${n(cx - shoulderW * 0.92)} ${shoulderY + 8}q-8 26 -4 60M${n(cx + shoulderW * 0.92)} ${shoulderY + 8}q8 26 4 60" fill="none" stroke="${c.accent}" stroke-width="3" stroke-dasharray="6 5"/>`;
  // hakama
  s += `<path d="M${n(cx - shoulderW * 0.86)} 470L${n(cx + shoulderW * 0.86)} 470L${n(cx + shoulderW * 0.9)} 520L${n(cx - shoulderW * 0.9)} 520Z" fill="${c.accent}" stroke="${darken(c.accent, 0.4)}" stroke-width="2"/>`;
  s += `<path d="M${cx - 40} 470l-6 30M${cx + 30} 470l4 30" stroke="${darken(c.accent, 0.3)}" stroke-width="2"/>`;
  s += bow(cx, 470, 0.9, c.accent, darken(c.accent, 0.4));
  return s;
}

function kimono(p, r, c) {
  const { cx, shoulderY, shoulderW } = r;
  let s = '';
  const petal = mix(c.accent, '#ffffff', 0.55);
  const spots = [[-0.6, 60], [0.55, 40], [-0.35, 125], [0.7, 120], [0.2, 150], [-0.75, 165]];
  for (const [u, dy] of spots) s += `<use href="#${p}-bl" x="${n(cx + u * shoulderW)}" y="${shoulderY + dy}" fill="${petal}" color="${c.accent}"/>`;
  s += folds(r, c);
  s += crossedCollar(r, c, c.accent, '#fff6f0');
  s += `<path d="M${n(cx - shoulderW * 0.9)} 452L${n(cx + shoulderW * 0.9)} 452L${n(cx + shoulderW * 0.94)} 500L${n(cx - shoulderW * 0.94)} 500Z" fill="url(#${p}-acc)" stroke="${c.accentLine}" stroke-width="2"/>`;
  s += `<path d="M${n(cx - shoulderW * 0.9)} 474L${n(cx + shoulderW * 0.9)} 474" stroke="#ffd166" stroke-width="4"/>`;
  s += `<circle cx="${cx + 20}" cy="474" r="6" fill="#ffd166" stroke="#a86f00" stroke-width="1.4"/>`;
  return s;
}

function hoodie(p, r, c) {
  const { cx, neckW, neckBot, shoulderY, shoulderW } = r;
  const nb = neckBot - 16;
  let s = folds(r, c);
  // hood bunched around the neck
  s += `<path d="M${n(cx - shoulderW * 0.62)} ${shoulderY - 6}C${n(cx - shoulderW * 0.5)} ${nb - 26} ${n(cx - neckW - 10)} ${nb - 14} ${cx} ${nb + 24}C${n(cx + neckW + 10)} ${nb - 14} ${n(cx + shoulderW * 0.5)} ${nb - 26} ${n(cx + shoulderW * 0.62)} ${shoulderY - 6}C${n(cx + shoulderW * 0.4)} ${shoulderY + 20} ${n(cx - shoulderW * 0.4)} ${shoulderY + 20} ${n(cx - shoulderW * 0.62)} ${shoulderY - 6}Z" fill="${c.outfitShade}" ${ln(c)}/>`;
  s += `<path d="M${n(cx - shoulderW * 0.5)} ${shoulderY + 4}Q${cx} ${shoulderY + 26} ${n(cx + shoulderW * 0.5)} ${shoulderY + 4}" fill="none" stroke="${c.accent}" stroke-width="3" opacity="0.8"/>`;
  // zipper and drawstrings
  s += `<path d="M${cx} ${shoulderY + 18}L${cx} 520" stroke="${darken(c.outfit, 0.3)}" stroke-width="3"/><path d="M${cx} ${shoulderY + 18}L${cx} 520" stroke="${lighten(c.outfit, 0.3)}" stroke-width="1" stroke-dasharray="2 3"/>`;
  for (const dir of [-1, 1]) {
    s += `<path d="M${cx + dir * 16} ${shoulderY + 12}q${dir * 2} 40 ${dir * -2} 70" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><rect x="${cx + dir * 14 - 3}" y="${shoulderY + 80}" width="6" height="10" rx="2" fill="${c.accent}"/>`;
  }
  // chest print
  s += `<path d="M${cx + 38} ${shoulderY + 50}l-10 22h9l-6 18l18 -26h-10l7 -14z" fill="${c.accent}" opacity="0.95"/>`;
  s += `<path d="M${n(cx - shoulderW * 0.7)} 470Q${cx} 486 ${n(cx + shoulderW * 0.7)} 470" fill="none" ${ln(c, 2)}/>`;
  return s;
}

function scallops(x0, x1, y, rr, fill, line) {
  let d = `M${n(x0)} ${n(y)}`;
  const count = Math.max(2, Math.round((x1 - x0) / (rr * 2)));
  const step = (x1 - x0) / count;
  for (let i = 0; i < count; i++) d += `a${n(step / 2)} ${n(rr)} 0 0 0 ${n(step)} 0`;
  return `<path d="${d}L${n(x1)} ${n(y - rr)}L${n(x0)} ${n(y - rr)}Z" fill="${fill}" stroke="${line}" stroke-width="1.5"/>`;
}

function dress(p, r, c) {
  const { cx, neckW, neckBot, shoulderY, shoulderW } = r;
  const nb = neckBot - 16;
  let s = folds(r, c);
  // puffy sleeves
  for (const dir of [-1, 1]) {
    s += `<path d="M${n(cx + dir * shoulderW * 0.62)} ${shoulderY - 8}C${n(cx + dir * shoulderW * 1.12)} ${shoulderY - 14} ${n(cx + dir * shoulderW * 1.2)} ${shoulderY + 50} ${n(cx + dir * shoulderW * 1.02)} ${shoulderY + 70}C${n(cx + dir * shoulderW * 0.9)} ${shoulderY + 60} ${n(cx + dir * shoulderW * 0.8)} ${shoulderY + 30} ${n(cx + dir * shoulderW * 0.62)} ${shoulderY - 8}Z" fill="url(#${p}-cloth)" ${ln(c)}/>`;
    s += `<path d="M${n(cx + dir * shoulderW * 0.86)} ${shoulderY + 6}q${dir * 8} 24 ${dir * 6} 48" fill="none" stroke="${c.outfitShade}" stroke-width="2"/>`;
  }
  // round frilly collar
  for (const dir of [-1, 1]) {
    s += `<path d="M${cx} ${nb + 6}C${cx + dir * 12} ${nb - 6} ${n(cx + dir * shoulderW * 0.52)} ${nb - 4} ${n(cx + dir * shoulderW * 0.5)} ${nb + 22}C${n(cx + dir * shoulderW * 0.44)} ${nb + 46} ${cx + dir * 20} ${nb + 44} ${cx} ${nb + 30}Z" fill="#ffffff" stroke="${c.outfitLine}" stroke-width="1.8" stroke-linejoin="round"/>`;
  }
  s += `<path d="M${cx - neckW - 2} ${nb - 4}L${cx + neckW + 2} ${nb - 4}L${cx} ${nb + 10}Z" fill="${c.skin}"/>`;
  s += bow(cx, nb + 14, 0.85, c.accent === '#ffffff' ? '#7fc8f8' : c.accent, c.accent === '#ffffff' ? '#2f6f9f' : c.accentLine);
  // bodice lace band
  s += scallops(cx - shoulderW * 0.8, cx + shoulderW * 0.8, 440, 6, '#ffffff', c.outfitLine);
  for (let i = 0; i < 3; i++) s += `<circle cx="${cx}" cy="${nb + 70 + i * 26}" r="3.6" fill="#fff" stroke="${c.outfitLine}" stroke-width="1.2"/>`;
  return s;
}

function armor(p, r, c) {
  const { cx, neckW, neckBot, shoulderY, shoulderW } = r;
  const gold = c.accent;
  const goldLine = darken(gold, 0.45);
  const nb = neckBot - 16;
  let s = '';
  // gorget / high collar
  s += `<path d="M${cx - neckW - 6} ${nb - 26}L${cx - neckW - 10} ${nb + 6}Q${cx} ${nb + 18} ${cx + neckW + 10} ${nb + 6}L${cx + neckW + 6} ${nb - 26}Q${cx} ${nb - 16} ${cx - neckW - 6} ${nb - 26}Z" fill="#2f4fa8" stroke="#1b2f6b" stroke-width="2"/>`;
  s += `<path d="M${cx - neckW - 8} ${nb - 4}Q${cx} ${nb + 8} ${cx + neckW + 8} ${nb - 4}" fill="none" stroke="${gold}" stroke-width="2.5"/>`;
  // breastplate
  const bp = `M${n(cx - shoulderW * 0.62)} ${shoulderY + 4}C${n(cx - shoulderW * 0.3)} ${nb + 6} ${n(cx + shoulderW * 0.3)} ${nb + 6} ${n(cx + shoulderW * 0.62)} ${shoulderY + 4}C${n(cx + shoulderW * 0.7)} ${shoulderY + 80} ${n(cx + shoulderW * 0.58)} ${shoulderY + 150} ${cx} ${shoulderY + 200}C${n(cx - shoulderW * 0.58)} ${shoulderY + 150} ${n(cx - shoulderW * 0.7)} ${shoulderY + 80} ${n(cx - shoulderW * 0.62)} ${shoulderY + 4}Z`;
  s += `<path d="${bp}" fill="url(#${p}-cloth)" stroke="${goldLine}" stroke-width="2.4"/>`;
  s += `<path d="${bp}" fill="none" stroke="${gold}" stroke-width="3" transform="translate(${cx} ${shoulderY + 90}) scale(0.9) translate(${-cx} ${-(shoulderY + 90)})"/>`;
  s += `<path d="M${cx} ${shoulderY + 20}L${cx} ${shoulderY + 186}" stroke="${c.outfitShade}" stroke-width="3"/>`;
  // emblem: sun-cross
  const ey = shoulderY + 70;
  s += `<circle cx="${cx}" cy="${ey}" r="15" fill="${gold}" stroke="${goldLine}" stroke-width="2"/><path d="M${cx} ${ey - 24}L${cx + 5} ${ey}L${cx} ${ey + 24}L${cx - 5} ${ey}ZM${cx - 24} ${ey}L${cx} ${ey - 5}L${cx + 24} ${ey}L${cx} ${ey + 5}Z" fill="#fff8d6" stroke="${goldLine}" stroke-width="1.2"/><circle cx="${cx}" cy="${ey}" r="5" fill="#7fc8ff" stroke="${goldLine}" stroke-width="1.2"/>`;
  // pauldrons
  for (const dir of [-1, 1]) {
    const px = cx + dir * shoulderW * 0.86;
    for (let i = 2; i >= 0; i--) {
      const yy = shoulderY - 4 + i * 16;
      s += `<path d="M${n(px - dir * 40)} ${yy + 6}C${n(px - dir * 30)} ${yy - 26} ${n(px + dir * 34)} ${yy - 26} ${n(px + dir * 44)} ${yy + 20}C${n(px + dir * 20)} ${yy + 22} ${n(px - dir * 20)} ${yy + 18} ${n(px - dir * 40)} ${yy + 6}Z" fill="url(#${p}-cloth)" stroke="${goldLine}" stroke-width="2"/>`;
      s += `<path d="M${n(px - dir * 36)} ${yy + 6}C${n(px - dir * 18)} ${yy + 14} ${n(px + dir * 20)} ${yy + 16} ${n(px + dir * 42)} ${yy + 16}" fill="none" stroke="${gold}" stroke-width="2.4"/>`;
    }
    s += `<circle cx="${n(px)}" cy="${shoulderY - 6}" r="4" fill="${gold}" stroke="${goldLine}" stroke-width="1"/>`;
  }
  return s;
}

function coat(p, r, c) {
  const { cx, neckW, neckBot, shoulderY, shoulderW } = r;
  const gold = c.accent;
  const goldLine = darken(gold, 0.45);
  const nb = neckBot - 16;
  let s = folds(r, c);
  // shirt + jabot
  s += `<path d="M${cx - neckW - 4} ${nb - 6}L${cx - 22} ${shoulderY + 100}L${cx + 22} ${shoulderY + 100}L${cx + neckW + 4} ${nb - 6}Z" fill="#fbfbff"/>`;
  for (let i = 0; i < 3; i++) {
    const y = nb + 6 + i * 16;
    s += `<path d="M${cx - 14 + i} ${y}Q${cx} ${y + 20} ${cx + 14 - i} ${y}Q${cx + 6} ${y + 10} ${cx} ${y + 4}Q${cx - 6} ${y + 10} ${cx - 14 + i} ${y}Z" fill="#fff" stroke="#b9c2d6" stroke-width="1.2"/>`;
  }
  s += `<circle cx="${cx}" cy="${nb + 4}" r="5" fill="${gold}" stroke="${goldLine}" stroke-width="1.4"/>`;
  // stand collar + lapels
  for (const dir of [-1, 1]) {
    const x = (v) => n(cx + dir * v);
    s += `<path d="M${x(neckW + 2)} ${nb - 30}L${x(neckW + 22)} ${nb - 20}L${x(neckW + 26)} ${nb + 6}L${x(neckW + 4)} ${nb}Z" fill="${c.outfitShade}" stroke="${goldLine}" stroke-width="1.8"/>`;
    s += `<path d="M${x(neckW + 6)} ${nb}L${x(shoulderW * 0.5)} ${shoulderY}L${x(shoulderW * 0.4)} ${shoulderY + 40}L${x(24)} ${shoulderY + 104}L${x(20)} ${nb + 10}Z" fill="${c.outfitShade}" ${ln(c)}/>`;
    s += `<path d="M${x(neckW + 8)} ${nb + 4}L${x(shoulderW * 0.46)} ${shoulderY + 2}L${x(shoulderW * 0.37)} ${shoulderY + 40}L${x(26)} ${shoulderY + 98}" fill="none" stroke="${gold}" stroke-width="2"/>`;
    // double-breasted buttons
    for (let i = 0; i < 3; i++) s += `<circle cx="${x(34)}" cy="${shoulderY + 120 + i * 30}" r="4.4" fill="${gold}" stroke="${goldLine}" stroke-width="1.2"/>`;
    // epaulette
    const ex = cx + dir * shoulderW * 0.8;
    s += `<path d="M${n(ex - dir * 30)} ${shoulderY - 10}Q${n(ex)} ${shoulderY - 22} ${n(ex + dir * 30)} ${shoulderY + 2}L${n(ex + dir * 28)} ${shoulderY + 12}Q${n(ex)} ${shoulderY - 4} ${n(ex - dir * 30)} ${shoulderY}Z" fill="${gold}" stroke="${goldLine}" stroke-width="1.6"/>`;
    let fringe = '';
    for (let i = 0; i < 6; i++) fringe += `M${n(ex - dir * 4 + dir * i * 6)} ${shoulderY + 4 + i}l${dir * 2} 14`;
    s += `<path d="${fringe}" stroke="${gold}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  return s;
}

function apron(p, r, c) {
  const { cx, neckW, neckBot, shoulderY, shoulderW } = r;
  const nb = neckBot - 16;
  const under = mix(c.accent, '#ffffff', 0.25);
  let s = '';
  // dress underneath (accent tinted) visible at shoulders
  s += `<path d="${torsoPath(r)}" fill="${under}" stroke="${darken(under, 0.4)}" stroke-width="2"/>`;
  s += `<path d="M${cx - neckW - 4} ${nb - 4}Q${cx} ${nb + 14} ${cx + neckW + 4} ${nb - 4}L${cx + neckW + 10} ${nb + 6}Q${cx} ${nb + 24} ${cx - neckW - 10} ${nb + 6}Z" fill="#fff" stroke="${c.outfitLine}" stroke-width="1.4"/>`;
  // apron bib
  const top = shoulderY + 30;
  const bw = shoulderW * 0.5;
  s += `<path d="M${n(cx - bw)} ${top}Q${cx} ${top - 10} ${n(cx + bw)} ${top}L${n(cx + bw + 14)} 520L${n(cx - bw - 14)} 520Z" fill="url(#${p}-cloth)" ${ln(c)}/>`;
  s += scallops(cx - bw, cx + bw, top + 2, 5, c.outfit, c.outfitLine).replace('Z"', 'Z" transform="scale(1 -1) translate(0 -' + (2 * top + 4) + ')"');
  for (const dir of [-1, 1]) {
    s += `<path d="M${n(cx + dir * bw)} ${top + 2}L${n(cx + dir * shoulderW * 0.56)} ${shoulderY - 8}" stroke="${c.outfit}" stroke-width="10" stroke-linecap="round"/><path d="M${n(cx + dir * bw)} ${top + 2}L${n(cx + dir * shoulderW * 0.56)} ${shoulderY - 8}" stroke="${c.outfitLine}" stroke-width="1.4" stroke-dasharray="3 3"/>`;
  }
  s += `<path d="M${cx - 26} ${top + 70}h52v34q-26 10 -52 0z" fill="${c.outfitShade}" ${ln(c, 1.6)}/>`;
  s += `<path d="M${cx} ${top + 78}c-4 -6 -12 -2 -8 4l8 8l8 -8c4 -6 -4 -10 -8 -4z" fill="${c.accent}"/>`;
  return s;
}

function jumpsuit(p, r, c) {
  const { cx, neckW, neckBot, shoulderY, shoulderW } = r;
  const nb = neckBot - 16;
  let s = folds(r, c);
  // wide collar
  for (const dir of [-1, 1]) {
    s += `<path d="M${cx + dir * (neckW + 2)} ${nb - 8}L${n(cx + dir * shoulderW * 0.45)} ${shoulderY - 6}L${cx + dir * 22} ${shoulderY + 30}L${cx + dir * 2} ${nb + 18}Z" fill="${c.outfitShade}" ${ln(c)}/>`;
  }
  s += `<path d="M${cx - neckW} ${nb - 6}L${cx} ${nb + 18}L${cx + neckW} ${nb - 6}Z" fill="#2b2d42"/>`;
  s += `<path d="M${cx} ${nb + 18}L${cx} 520" stroke="${darken(c.outfit, 0.35)}" stroke-width="3"/><rect x="${cx - 4}" y="${shoulderY + 34}" width="8" height="14" rx="2" fill="#c0c7d6" stroke="#5c6b7a"/>`;
  // chest pockets
  for (const dir of [-1, 1]) {
    const px = cx + dir * 46;
    s += `<rect x="${px - 20}" y="${shoulderY + 50}" width="40" height="38" rx="5" fill="${c.outfit}" ${ln(c, 1.6)}/><path d="M${px - 21} ${shoulderY + 50}h42v12q-21 6 -42 0z" fill="${c.outfitShade}" ${ln(c, 1.6)}/><circle cx="${px}" cy="${shoulderY + 60}" r="2.5" fill="${c.accent}"/>`;
  }
  // utility strap
  s += `<path d="M${n(cx - shoulderW * 0.7)} ${shoulderY + 10}L${n(cx + shoulderW * 0.6)} 500" stroke="${c.accent}" stroke-width="12" opacity="0.95"/><path d="M${n(cx - shoulderW * 0.7)} ${shoulderY + 10}L${n(cx + shoulderW * 0.6)} 500" stroke="${lighten(c.accent, 0.3)}" stroke-width="2" stroke-dasharray="4 6"/>`;
  s += `<rect x="${cx + 4}" y="${shoulderY + 112}" width="20" height="16" rx="3" fill="#dfe6f0" stroke="#5c6b7a" stroke-width="1.5" transform="rotate(32 ${cx + 14} ${shoulderY + 120})"/>`;
  return s;
}

function robe(p, r, c) {
  const { cx, neckW, neckBot, shoulderY, shoulderW } = r;
  const nb = neckBot - 16;
  const trim = c.accent;
  const trimLine = darken(trim, 0.4);
  let s = folds(r, c);
  // star embroidery
  const star = (x, y, sz) => `<path d="M${x} ${y - sz}L${n(x + sz * 0.28)} ${n(y - sz * 0.28)}L${x + sz} ${y}L${n(x + sz * 0.28)} ${n(y + sz * 0.28)}L${x} ${y + sz}L${n(x - sz * 0.28)} ${n(y + sz * 0.28)}L${x - sz} ${y}L${n(x - sz * 0.28)} ${n(y - sz * 0.28)}Z" fill="${trim}" opacity="0.85"/>`;
  s += star(cx - 70, 450, 6) + star(cx + 64, 470, 8) + star(cx + 30, 430, 4) + star(cx - 30, 490, 5);
  // central panel with trim
  s += `<path d="M${cx - 22} ${nb}L${cx - 30} 520M${cx + 22} ${nb}L${cx + 30} 520" stroke="${trim}" stroke-width="4"/>`;
  // layered capelet with scalloped hem
  const cy = shoulderY + 60;
  let hem = '';
  const count = 8;
  const x0 = cx - shoulderW * 1.02;
  const x1 = cx + shoulderW * 1.02;
  for (let i = 0; i < count; i++) {
    const xa = x0 + ((x1 - x0) * i) / count;
    const xb = x0 + ((x1 - x0) * (i + 1)) / count;
    const sag = 14 - Math.abs(i - (count - 1) / 2) * 1.5;
    hem += `Q${n((xa + xb) / 2)} ${n(cy + sag + 12 + Math.abs(i - 3.5) * -2)} ${n(xb)} ${n(cy + Math.abs(i + 1 - count / 2) * -3)}`;
  }
  const cape = `M${cx - neckW - 4} ${nb - 8}C${n(cx - shoulderW * 0.5)} ${shoulderY - 16} ${n(cx - shoulderW * 1.0)} ${shoulderY - 6} ${n(x0)} ${n(cy - 12)}${hem}C${n(cx + shoulderW * 1.0)} ${shoulderY - 6} ${n(cx + shoulderW * 0.5)} ${shoulderY - 16} ${cx + neckW + 4} ${nb - 8}Z`;
  s += `<path d="${cape}" fill="${c.outfitShade}" stroke="${trimLine}" stroke-width="2"/>`;
  s += `<path d="${cape}" fill="none" stroke="${trim}" stroke-width="2.4" transform="translate(${cx} ${shoulderY}) scale(0.94) translate(${-cx} ${-shoulderY})" opacity="0.9"/>`;
  // high collar
  for (const dir of [-1, 1]) {
    s += `<path d="M${cx + dir * (neckW - 2)} ${nb - 34}C${cx + dir * (neckW + 18)} ${nb - 30} ${cx + dir * (neckW + 26)} ${nb - 10} ${cx + dir * (neckW + 22)} ${nb + 6}L${cx + dir * 4} ${nb + 6}Z" fill="${c.outfit}" stroke="${trimLine}" stroke-width="1.8"/>`;
  }
  // clasp gem
  s += `<path d="M${cx} ${nb - 6}l10 10l-10 12l-10 -12z" fill="${lighten(trim, 0.2)}" stroke="${trimLine}" stroke-width="1.6"/><circle cx="${cx - 3}" cy="${nb + 1}" r="2.2" fill="#fff"/>`;
  s += `<path d="M${cx - 10} ${nb + 6}Q${cx - 40} ${nb + 40} ${cx - 52} ${nb + 28}M${cx + 10} ${nb + 6}Q${cx + 40} ${nb + 40} ${cx + 52} ${nb + 28}" fill="none" stroke="${trim}" stroke-width="2"/>`;
  return s;
}

const OUTFITS = { sailor, blazer, miko, kimono, hoodie, dress, armor, coat, apron, jumpsuit, robe };

/** Cape drawn behind the body (heroes with armor / coats). */
export function cape(r, c, look) {
  const { cx, shoulderY, shoulderW } = r;
  if (look.outfit !== 'armor') return '';
  const col = '#2f4fa8';
  return `<path d="M${n(cx - shoulderW * 0.7)} ${shoulderY - 10}C${n(cx - shoulderW * 1.5)} ${shoulderY + 40} ${n(cx - shoulderW * 1.45)} 440 ${n(cx - shoulderW * 1.3)} 520L${n(cx + shoulderW * 1.3)} 520C${n(cx + shoulderW * 1.45)} 440 ${n(cx + shoulderW * 1.5)} ${shoulderY + 40} ${n(cx + shoulderW * 0.7)} ${shoulderY - 10}Z" fill="${col}" stroke="#1b2f6b" stroke-width="2"/><path d="M${n(cx - shoulderW * 1.2)} ${shoulderY + 60}Q${n(cx - shoulderW * 1.3)} 430 ${n(cx - shoulderW * 1.22)} 520M${n(cx + shoulderW * 1.2)} ${shoulderY + 60}Q${n(cx + shoulderW * 1.3)} 430 ${n(cx + shoulderW * 1.22)} 520" fill="none" stroke="#5f7fe0" stroke-width="3" opacity="0.6"/><path d="M${n(cx - shoulderW * 1.32)} 505L${n(cx + shoulderW * 1.32)} 505" stroke="${c.accent}" stroke-width="5"/>`;
}

/** Torso with outfit details. */
export function outfit(p, r, c, look) {
  const fn = OUTFITS[look.outfit] || sailor;
  let s = `<path d="${torsoPath(r)}" fill="url(#${p}-cloth)" ${ln(c, 2.4)}/>`;
  s += fn(p, r, c);
  // soft shadow cast by the head/hair onto the collar
  s += `<ellipse cx="${r.cx}" cy="${r.neckBot - 8}" rx="${n(r.shoulderW * 0.42)}" ry="16" fill="#2b2340" opacity="0.12"/>`;
  return s;
}
