// Weapon silhouettes for the card illustrations. Each weapon lives either behind the body
// ('back' — slung / held behind the shoulder) or in front ('front' — floating near the hands).

import { n, lighten, darken, starPoints, sparklePath } from '../svgUtil.js';

const FRONT = new Set(['shuriken', 'tome', 'bell', 'lantern', 'flask', 'gohei', 'coinPurse', 'cannon', 'rapier']);

/** Which layer a weapon is drawn on. */
export function weaponLayer(kind) {
  return FRONT.has(kind) ? 'front' : 'back';
}

const metal = (c) => ({ fill: c.weapon, line: c.weaponLine, hi: lighten(c.weapon, 0.6) });

function bow(r, c) {
  const { cx } = r;
  const m = metal(c);
  const x0 = cx + 92;
  return `<path d="M${x0} 150C${x0 + 70} 210 ${x0 + 70} 380 ${x0 - 10} 470" fill="none" stroke="${m.line}" stroke-width="11" stroke-linecap="round"/><path d="M${x0} 150C${x0 + 70} 210 ${x0 + 70} 380 ${x0 - 10} 470" fill="none" stroke="${m.fill}" stroke-width="7" stroke-linecap="round"/><path d="M${x0 + 4} 160C${x0 + 56} 220 ${x0 + 60} 300 ${x0 + 52} 330" fill="none" stroke="${m.hi}" stroke-width="2" opacity="0.8"/><path d="M${x0} 150L${x0 - 10} 470" stroke="#fff" stroke-width="1.4" opacity="0.9"/><rect x="${x0 + 40}" y="290" width="14" height="40" rx="5" fill="${c.accent}" stroke="${c.accentLine}" stroke-width="1.6"/><path d="M${x0 + 47} 330l-6 28l6 -6l6 6z" fill="${c.accent}"/>`;
}

function blade(x1, y1, x2, y2, w, fill, line, hi) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy);
  const nx = (-dy / L) * w;
  const ny = (dx / L) * w;
  return `<path d="M${n(x1 + nx)} ${n(y1 + ny)}L${n(x2 + nx * 0.4)} ${n(y2 + ny * 0.4)}L${n(x2 + dx / L * w * 2.2)} ${n(y2 + dy / L * w * 2.2)}L${n(x2 - nx)} ${n(y2 - ny)}L${n(x1 - nx)} ${n(y1 - ny)}Z" fill="${fill}" stroke="${line}" stroke-width="2" stroke-linejoin="round"/><path d="M${n(x1 + nx * 0.3)} ${n(y1 + ny * 0.3)}L${n(x2 + nx * 0.2)} ${n(y2 + ny * 0.2)}" stroke="${hi}" stroke-width="2" opacity="0.9"/>`;
}

function katana(r, c) {
  const { cx } = r;
  const m = metal(c);
  const hx = cx + 118;
  const hy = 238;
  let s = blade(hx - 22, hy + 24, cx - 140, 500, 6, m.fill, darken(m.line, 0.2), '#ffffff');
  s += `<path d="M${hx - 30} ${hy + 14}l18 22" stroke="#e2c275" stroke-width="9" stroke-linecap="round"/>`;
  s += `<path d="M${hx - 20} ${hy + 22}L${hx + 16} ${hy - 22}" stroke="#2b2f45" stroke-width="10" stroke-linecap="round"/><path d="M${hx - 16} ${hy + 14}l6 -2M${hx - 8} ${hy + 4}l6 -2M${hx} ${hy - 6}l6 -2M${hx + 8} ${hy - 16}l6 -2" stroke="${c.accent}" stroke-width="3"/>`;
  return s;
}

function sword(r, c) {
  const { cx } = r;
  const m = metal(c);
  const hx = cx - 118;
  const hy = 232;
  let s = blade(hx + 18, hy + 30, cx + 150, 520, 11, lighten(m.fill, 0.2), '#8a94a6', '#ffffff');
  s += `<path d="M${hx + 6} ${hy + 50}L${hx + 46} ${hy + 2}" stroke="#d4a017" stroke-width="10" stroke-linecap="round"/><circle cx="${hx + 26}" cy="${hy + 26}" r="7" fill="#7fc8ff" stroke="#a8740a" stroke-width="2"/>`;
  s += `<path d="M${hx + 14} ${hy + 22}L${hx - 12} ${hy - 6}" stroke="#f5f0e1" stroke-width="9" stroke-linecap="round"/><circle cx="${hx - 16}" cy="${hy - 10}" r="7" fill="#d4a017" stroke="#a8740a" stroke-width="2"/>`;
  return s;
}

function rapier(r, c) {
  const { cx } = r;
  const m = metal(c);
  const x = cx + 104;
  let s = `<path d="M${x} 446L${x + 30} 150" stroke="${darken(m.fill, 0.4)}" stroke-width="6" stroke-linecap="round"/><path d="M${x} 446L${x + 30} 150" stroke="${m.fill}" stroke-width="3.4" stroke-linecap="round"/><path d="M${x + 2} 420L${x + 28} 160" stroke="#fff" stroke-width="1" opacity="0.9"/>`;
  s += `<path d="M${x - 26} 452C${x - 30} 420 ${x + 26} 410 ${x + 30} 444C${x + 30} 470 ${x - 20} 476 ${x - 26} 452Z" fill="none" stroke="#d4a017" stroke-width="4"/><path d="M${x - 20} 446L${x + 26} 440" stroke="#d4a017" stroke-width="5" stroke-linecap="round"/><path d="M${x - 2} 448l-4 34" stroke="#2b2f45" stroke-width="8" stroke-linecap="round"/><circle cx="${x - 6}" cy="486" r="6" fill="#d4a017"/><circle cx="${x + 2}" cy="444" r="4" fill="${c.accent}"/>`;
  return `<g transform="translate(0 -56)">${s}</g>`;
}

function staff(r, c, element) {
  const { cx } = r;
  const m = metal(c);
  const x = cx - 118;
  let s = `<path d="M${x - 8} 520L${x + 8} 140" stroke="${darken(m.fill, 0.45)}" stroke-width="10" stroke-linecap="round"/><path d="M${x - 8} 520L${x + 8} 140" stroke="${m.fill}" stroke-width="6" stroke-linecap="round"/>`;
  const hx = x + 9;
  const hy = 118;
  if (element === 'frost') {
    s += `<g transform="translate(${hx} ${hy})"><circle r="26" fill="${lighten(m.fill, 0.6)}" opacity="0.45"/>`;
    for (let i = 0; i < 6; i++) s += `<path d="M0 0L0 -26M0 -14l-7 -7M0 -14l7 -7" transform="rotate(${i * 60})" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/><path d="M0 0L0 -26" transform="rotate(${i * 60})" stroke="${darken(m.fill, 0.2)}" stroke-width="1.4"/>`;
    s += `<circle r="6" fill="#fff" stroke="${darken(m.fill, 0.3)}" stroke-width="1.6"/></g>`;
  } else if (element === 'lightning') {
    s += `<g transform="translate(${hx} ${hy})"><circle r="22" fill="none" stroke="#e2c275" stroke-width="5"/>`;
    for (let i = 0; i < 5; i++) s += `<circle cx="0" cy="-22" r="7" transform="rotate(${i * 72})" fill="${c.accent}" stroke="#7a5a00" stroke-width="1.6"/>`;
    s += `<circle r="12" fill="#bfe9ff" stroke="#2a6fb0" stroke-width="2"/><path d="M2 -9l-7 10h6l-3 9l8 -12h-6z" fill="#ffe066" stroke="#7a5a00" stroke-width="1"/></g>`;
  } else {
    s += `<circle cx="${hx}" cy="${hy}" r="16" fill="${c.accent}" stroke="${c.accentLine}" stroke-width="2"/><circle cx="${hx - 5}" cy="${hy - 5}" r="5" fill="#fff" opacity="0.7"/>`;
  }
  return s;
}

function trident(r, c) {
  const { cx } = r;
  const x = cx + 120;
  const gold = c.weapon;
  const line = darken(gold, 0.45);
  return `<path d="M${x + 8} 520L${x - 6} 150" stroke="${line}" stroke-width="9" stroke-linecap="round"/><path d="M${x + 8} 520L${x - 6} 150" stroke="${gold}" stroke-width="5" stroke-linecap="round"/><path d="M${x - 34} 110C${x - 34} 150 ${x - 20} 158 ${x - 6} 158C${x + 8} 158 ${x + 20} 150 ${x + 22} 112L${x + 14} 138L${x - 4} 96L${x - 22} 136Z" fill="${gold}" stroke="${line}" stroke-width="2" stroke-linejoin="round"/><circle cx="${x - 6}" cy="166" r="7" fill="#4cc9f0" stroke="${line}" stroke-width="2"/>`;
}

function rifle(r, c) {
  const { cx } = r;
  const m = metal(c);
  const line = darken(m.fill, 0.5);
  return `<g transform="rotate(-38 ${cx} 330)"><rect x="${cx - 190}" y="322" width="320" height="12" rx="4" fill="${m.fill}" stroke="${line}" stroke-width="2"/><rect x="${cx + 90}" y="318" width="80" height="22" rx="6" fill="#6b4f3a" stroke="#3a2a1d" stroke-width="2"/><rect x="${cx - 60}" y="306" width="70" height="12" rx="5" fill="${line}"/><circle cx="${cx - 60}" cy="312" r="7" fill="#4fd1c5" stroke="${line}" stroke-width="2"/><rect x="${cx - 200}" y="324" width="16" height="8" fill="${line}"/></g>`;
}

function wrench(r, c) {
  const { cx } = r;
  const m = metal(c);
  const line = darken(m.fill, 0.5);
  return `<g transform="rotate(38 ${cx + 100} 260)"><rect x="${cx + 90}" y="240" width="20" height="230" rx="8" fill="${m.fill}" stroke="${line}" stroke-width="2.2"/><rect x="${cx + 94}" y="340" width="12" height="110" rx="5" fill="${c.accent}"/><path d="M${cx + 72} 250C${cx + 64} 200 ${cx + 92} 186 ${cx + 92} 186L${cx + 92} 222L${cx + 108} 222L${cx + 108} 186C${cx + 108} 186 ${cx + 136} 200 ${cx + 128} 250Z" fill="${m.fill}" stroke="${line}" stroke-width="2.2" stroke-linejoin="round"/><path d="M${cx + 94} 260v160" stroke="#fff" stroke-width="2" opacity="0.6"/></g>`;
}

function fan(r, c) {
  const { cx } = r;
  const fx = cx + 112;
  const fy = 330;
  const red = c.weapon;
  let s = `<g transform="rotate(-20 ${fx} ${fy})">`;
  const R = 92;
  let d = `M${fx} ${fy}`;
  const a0 = -Math.PI * 0.95;
  const a1 = -Math.PI * 0.05;
  for (let i = 0; i <= 8; i++) {
    const a = a0 + ((a1 - a0) * i) / 8;
    d += `L${n(fx + Math.cos(a) * R)} ${n(fy + Math.sin(a) * R)}`;
  }
  s += `<path d="${d}Z" fill="${red}" stroke="${darken(red, 0.45)}" stroke-width="2.4" stroke-linejoin="round"/>`;
  let ribs = '';
  for (let i = 0; i <= 8; i++) {
    const a = a0 + ((a1 - a0) * i) / 8;
    ribs += `M${fx} ${fy}L${n(fx + Math.cos(a) * R)} ${n(fy + Math.sin(a) * R)}`;
  }
  s += `<path d="${ribs}" stroke="${darken(red, 0.4)}" stroke-width="1.6"/>`;
  s += `<path d="M${fx - 60} ${fy}A60 60 0 0 1 ${fx + 60} ${fy}" fill="none" stroke="#ffd23f" stroke-width="6"/><circle cx="${fx}" cy="${fy - 50}" r="16" fill="#ffd23f" opacity="0.95"/><circle cx="${fx}" cy="${fy - 50}" r="9" fill="${red}"/><circle cx="${fx}" cy="${fy}" r="7" fill="#ffd23f" stroke="#7a3b00" stroke-width="2"/></g>`;
  return s;
}

function parasol(r, c) {
  const { cx } = r;
  const px = cx - 90;
  const py = 170;
  const col = c.weapon;
  const R = 108;
  let canopy = `M${px - R} ${py + 30}`;
  for (let i = 0; i < 6; i++) {
    const x0 = px - R + (2 * R * i) / 6;
    const x1 = px - R + (2 * R * (i + 1)) / 6;
    canopy += `Q${n((x0 + x1) / 2)} ${py + 14} ${n(x1)} ${py + 30}`;
  }
  canopy += `C${px + R} ${py - 50} ${px - R} ${py - 50} ${px - R} ${py + 30}Z`;
  let s = `<g transform="rotate(-24 ${px} ${py})"><path d="M${px} ${py - 30}L${px} ${py + 300}" stroke="#7f3a63" stroke-width="5"/>`;
  s += `<path d="${canopy}" fill="${col}" stroke="${darken(col, 0.4)}" stroke-width="2.4" stroke-linejoin="round" opacity="0.96"/>`;
  let ribs = '';
  for (let i = 1; i < 6; i++) ribs += `M${px} ${py - 30}Q${n(px - R + (2 * R * i) / 6)} ${py - 10} ${n(px - R + (2 * R * i) / 6)} ${py + 30}`;
  s += `<path d="${ribs}" fill="none" stroke="${darken(col, 0.25)}" stroke-width="1.6"/>`;
  s += `<path d="M${px - R + 10} ${py + 22}Q${px} ${py + 10} ${px + R - 10} ${py + 22}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="2 6" opacity="0.9"/><circle cx="${px}" cy="${py - 32}" r="5" fill="${c.accent}"/></g>`;
  return s;
}

function cannon(r, c) {
  const { cx } = r;
  const m = metal(c);
  const line = darken(m.fill, 0.5);
  return `<g transform="rotate(-28 ${cx + 92} 330)"><rect x="${cx + 30}" y="300" width="150" height="52" rx="16" fill="${m.fill}" stroke="${line}" stroke-width="2.6"/><rect x="${cx + 160}" y="292" width="34" height="68" rx="10" fill="${darken(m.fill, 0.15)}" stroke="${line}" stroke-width="2.6"/><ellipse cx="${cx + 194}" cy="326" rx="8" ry="24" fill="#1d2433"/><rect x="${cx + 70}" y="298" width="12" height="56" fill="${c.accent}" stroke="${darken(c.accent, 0.4)}" stroke-width="1.6"/><rect x="${cx + 120}" y="298" width="12" height="56" fill="${c.accent}" stroke="${darken(c.accent, 0.4)}" stroke-width="1.6"/><path d="M${cx + 40} 310h120" stroke="#fff" stroke-width="4" opacity="0.4" stroke-linecap="round"/><circle cx="${cx + 52}" cy="326" r="8" fill="#ff7f6e" stroke="${line}" stroke-width="2"/></g>`;
}

function shuriken(r, c) {
  const m = metal(c);
  const one = (x, y, s, rot) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 -22L5 -5L22 0L5 5L0 22L-5 5L-22 0L-5 -5Z" fill="${m.fill}" stroke="${darken(m.fill, 0.5)}" stroke-width="2" stroke-linejoin="round"/><circle r="4" fill="#2b2a3d"/><path d="M0 -18L2 -4" stroke="#fff" stroke-width="1.6"/></g>`;
  const { cx } = r;
  return `<path d="M${cx + 66} 400a50 50 0 0 1 60 -60" fill="none" stroke="${c.accent}" stroke-width="3" opacity="0.6"/>` + one(cx + 106, 350, 1.3, 15) + one(cx + 72, 392, 0.9, 40) + one(cx + 128, 396, 0.7, 5);
}

function tome(r, c) {
  const { cx } = r;
  const x = cx - 100;
  const y = 372;
  const col = c.weapon;
  return `<ellipse cx="${x}" cy="${y + 26}" rx="54" ry="12" fill="${c.accent}" opacity="0.35"/><g transform="rotate(-10 ${x} ${y})"><path d="M${x - 52} ${y - 6}L${x} ${y + 6}L${x + 52} ${y - 6}L${x + 52} ${y + 22}L${x} ${y + 34}L${x - 52} ${y + 22}Z" fill="${col}" stroke="${darken(col, 0.45)}" stroke-width="2"/><path d="M${x - 48} ${y - 10}Q${x - 24} ${y - 18} ${x} ${y}Q${x + 24} ${y - 18} ${x + 48} ${y - 10}L${x + 48} ${y + 16}Q${x + 24} ${y + 8} ${x} ${y + 26}Q${x - 24} ${y + 8} ${x - 48} ${y + 16}Z" fill="#fffaf0" stroke="#b9a77a" stroke-width="1.6"/><path d="M${x - 40} ${y - 4}h28M${x - 40} ${y + 3}h24M${x + 12} ${y - 4}h28M${x + 14} ${y + 3}h22" stroke="${c.accent}" stroke-width="1.6"/></g><path d="${sparklePath(x - 20, y - 40, 9)}" fill="${lighten(c.accent, 0.4)}"/><path d="${sparklePath(x + 26, y - 60, 6)}" fill="#fff"/><polygon points="${starPoints(x + 4, y - 30, 5, 2)}" fill="${c.accent}"/>`;
}

function bell(r, c) {
  const { cx } = r;
  const x = cx + 104;
  const y = 360;
  const gold = c.weapon;
  const line = darken(gold, 0.5);
  return `<path d="M${x - 40} ${y - 70}Q${x - 10} ${y - 40} ${x} ${y - 30}" fill="none" stroke="${c.accent}" stroke-width="5" stroke-linecap="round"/><path d="M${x} ${y - 30}l-14 58M${x} ${y - 30}l16 60" stroke="${c.accent}" stroke-width="4"/><circle cx="${x}" cy="${y}" r="26" fill="${gold}" stroke="${line}" stroke-width="2.4"/><path d="M${x - 26} ${y}h52" stroke="${line}" stroke-width="2"/><path d="M${x - 12} ${y + 8}a12 6 0 0 0 24 0" fill="none" stroke="${line}" stroke-width="2.4"/><circle cx="${x}" cy="${y + 14}" r="3" fill="${line}"/><ellipse cx="${x - 10}" cy="${y - 12}" rx="7" ry="4" fill="#fff" opacity="0.65"/><path d="M${x - 18} ${y + 60}l4 -10l4 10zM${x + 14} ${y + 64}l4 -10l4 10z" fill="${c.accent}"/>`;
}

function lantern(r, c) {
  const { cx } = r;
  const x = cx - 100;
  const y = 362;
  const glow = c.weapon;
  let s = `<circle cx="${x}" cy="${y}" r="56" fill="${glow}" opacity="0.25"/>`;
  s += `<path d="M${x} ${y - 70}v18" stroke="#6b4f3a" stroke-width="3"/><rect x="${x - 16}" y="${y - 54}" width="32" height="8" rx="2" fill="#2b2a3d"/><ellipse cx="${x}" cy="${y}" rx="30" ry="40" fill="${lighten(glow, 0.45)}" stroke="#c46a00" stroke-width="2.4"/><path d="M${x - 30} ${y}h60M${x - 26} ${y - 20}h52M${x - 26} ${y + 20}h52" stroke="#e08a00" stroke-width="1.4" opacity="0.8"/><ellipse cx="${x}" cy="${y}" rx="14" ry="22" fill="#fff8c4"/><rect x="${x - 16}" y="${y + 38}" width="32" height="8" rx="2" fill="#2b2a3d"/><path d="M${x} ${y + 46}v18" stroke="${c.accent}" stroke-width="3"/>`;
  const flies = [[-60, -50], [50, -30], [-40, 60], [70, 40], [30, -80]];
  for (const [dx, dy] of flies) s += `<circle cx="${x + dx}" cy="${y + dy}" r="6" fill="${glow}" opacity="0.4"/><circle cx="${x + dx}" cy="${y + dy}" r="2.4" fill="#fffbe0"/>`;
  return s;
}

function flask(r, c) {
  const { cx } = r;
  const x = cx + 104;
  const y = 372;
  const liq = c.weapon;
  return `<path d="M${x - 8} ${y - 46}h16v18c22 8 30 26 30 40c0 26 -20 38 -38 38s-38 -12 -38 -38c0 -14 8 -32 30 -40z" fill="#e8fbff" fill-opacity="0.7" stroke="#2e6b5a" stroke-width="2.4"/><path d="M${x - 34} ${y + 8}c10 -6 20 4 34 -2s22 -4 34 2c0 22 -18 34 -34 34s-34 -12 -34 -34z" fill="${liq}" stroke="${darken(liq, 0.4)}" stroke-width="1.6"/><rect x="${x - 10}" y="${y - 54}" width="20" height="10" rx="3" fill="#8d6e63" stroke="#4e342e" stroke-width="1.6"/><circle cx="${x - 12}" cy="${y + 18}" r="4" fill="#fff" opacity="0.7"/><circle cx="${x + 8}" cy="${y + 26}" r="3" fill="#fff" opacity="0.6"/><circle cx="${x + 2}" cy="${y - 64}" r="5" fill="${liq}" opacity="0.8"/><circle cx="${x + 10}" cy="${y - 80}" r="3.5" fill="${liq}" opacity="0.6"/><g transform="rotate(20 ${x - 56} ${y + 20})"><rect x="${x - 64}" y="${y - 10}" width="16" height="50" rx="8" fill="#e8fbff" fill-opacity="0.7" stroke="#2e6b5a" stroke-width="2"/><rect x="${x - 62}" y="${y + 14}" width="12" height="24" rx="6" fill="${c.accent}"/></g>`;
}

function gohei(r, c) {
  const { cx } = r;
  const x = cx + 100;
  const y = 420;
  let s = `<path d="M${x} ${y}L${x + 20} ${y - 170}" stroke="#c49a6c" stroke-width="7" stroke-linecap="round"/><path d="M${x} ${y}L${x + 20} ${y - 170}" stroke="#e8d1a8" stroke-width="3" stroke-linecap="round"/>`;
  for (const dir of [-1, 1]) {
    const bx = x + 18;
    const by = y - 150;
    s += `<path d="M${bx} ${by}l${dir * 18} 4l${dir * -8} 14l${dir * 18} 4l${dir * -8} 16l${dir * 18} 4l${dir * -10} 18" fill="none" stroke="#fffdf5" stroke-width="10" stroke-linejoin="miter"/><path d="M${bx} ${by}l${dir * 18} 4l${dir * -8} 14l${dir * 18} 4l${dir * -8} 16l${dir * 18} 4l${dir * -10} 18" fill="none" stroke="#c9c3b0" stroke-width="1" />`;
  }
  s += `<circle cx="${x + 19}" cy="${y - 156}" r="5" fill="${c.accent}"/>`;
  return s;
}

function coinPurse(r, c) {
  const { cx } = r;
  const x = cx - 100;
  const y = 372;
  const col = c.accent;
  let s = `<path d="M${x - 30} ${y - 20}C${x - 50} ${y + 10} ${x - 40} ${y + 44} ${x} ${y + 44}C${x + 40} ${y + 44} ${x + 50} ${y + 10} ${x + 30} ${y - 20}Q${x} ${y - 10} ${x - 30} ${y - 20}Z" fill="${col}" stroke="${darken(col, 0.45)}" stroke-width="2.4"/><path d="M${x - 32} ${y - 22}q-6 -16 6 -18q12 6 26 6q14 0 26 -6q12 2 6 18" fill="${lighten(col, 0.25)}" stroke="${darken(col, 0.45)}" stroke-width="2"/><path d="M${x - 28} ${y - 18}Q${x} ${y - 6} ${x + 28} ${y - 18}" fill="none" stroke="#e6b422" stroke-width="3"/><circle cx="${x}" cy="${y + 16}" r="13" fill="#ffd54a" stroke="#a8740a" stroke-width="2"/><polygon points="${starPoints(x, y + 16.5, 7, 3)}" fill="#fff3b0" stroke="#a8740a" stroke-width="1.4"/>`;
  const coins = [[-44, -46, 10], [34, -58, 8], [50, -24, 7]];
  for (const [dx, dy, rr] of coins) s += `<ellipse cx="${x + dx}" cy="${y + dy}" rx="${rr}" ry="${rr}" fill="#ffd54a" stroke="#a8740a" stroke-width="1.8"/><path d="M${x + dx - rr * 0.4} ${y + dy - rr * 0.3}q${n(rr * 0.4)} ${n(-rr * 0.3)} ${n(rr * 0.7)} 0" stroke="#fff" stroke-width="1.6" fill="none"/>`;
  return s;
}

/** Weapon markup for the given layer ('back'|'front'); '' when it belongs to the other layer. */
export function weapon(r, c, look, element, layer) {
  const kind = look.weapon;
  if (weaponLayer(kind) !== layer) return '';
  switch (kind) {
    case 'bow': return bow(r, c);
    case 'katana': return katana(r, c);
    case 'sword': return sword(r, c);
    case 'rapier': return rapier(r, c);
    case 'staff': return staff(r, c, element);
    case 'trident': return trident(r, c);
    case 'rifle': return rifle(r, c);
    case 'wrench': return wrench(r, c);
    case 'fan': return fan(r, c);
    case 'parasol': return parasol(r, c);
    case 'cannon': return cannon(r, c);
    case 'shuriken': return shuriken(r, c);
    case 'tome': return tome(r, c);
    case 'bell': return bell(r, c);
    case 'lantern': return lantern(r, c);
    case 'flask': return flask(r, c);
    case 'gohei': return gohei(r, c);
    case 'coinPurse': return coinPurse(r, c);
    default: return '';
  }
}

