// Procedural art for the 'pb:' profile banners that have no painted place (src/data/profileBanners.js `svg`).
// Gradients and patterns only, drawn from a fixed seed so every viewer sees the same picture. Display only.
// Each returns an SVG string sized 1280 × 440 that covers its box (xMidYMid slice), like a banner photo.

const W = 1280;
const H = 440;

/** A small fixed-seed generator (mulberry32), so the patterns never change between loads. */
function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => Math.round(n * 10) / 10;
const wrap = (id, defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`;

/** A five-petal sakura blossom path centred on 0,0 with radius r. */
function blossom(r) {
  let d = '';
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 - 90) * Math.PI / 180;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    const lx = Math.cos(a - 0.5) * r * 0.55;
    const ly = Math.sin(a - 0.5) * r * 0.55;
    const rx = Math.cos(a + 0.5) * r * 0.55;
    const ry = Math.sin(a + 0.5) * r * 0.55;
    d += `M0 0Q${f(lx)} ${f(ly)} ${f(x * 0.92)} ${f(y * 0.92)}L${f(x)} ${f(y)}Q${f(rx)} ${f(ry)} 0 0Z`;
  }
  return d;
}
const PETAL = 'M0 -9C6 -6 7 3 0 9C-7 3 -6 -6 0 -9Z';

function petals(rnd, n, colors, { scale = [0.6, 1.6], ys = [0, H] } = {}) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = rnd() * W;
    const y = ys[0] + rnd() * (ys[1] - ys[0]);
    const s = scale[0] + rnd() * (scale[1] - scale[0]);
    out += `<path d="${PETAL}" fill="${colors[i % colors.length]}" opacity="${f(0.55 + rnd() * 0.45)}" transform="translate(${f(x)} ${f(y)}) rotate(${Math.round(rnd() * 360)}) scale(${f(s)})"/>`;
  }
  return out;
}

function stars(rnd, n, color, maxR = 2.2) {
  let out = '';
  for (let i = 0; i < n; i++) out += `<circle cx="${f(rnd() * W)}" cy="${f(rnd() * H)}" r="${f(0.4 + rnd() * maxR)}" fill="${color}" opacity="${f(0.35 + rnd() * 0.65)}"/>`;
  return out;
}

/** A four-point twinkle. */
const twinkle = (x, y, r, fill) => `<path d="M${f(x)} ${f(y - r)}Q${f(x + r * 0.16)} ${f(y - r * 0.16)} ${f(x + r)} ${f(y)}Q${f(x + r * 0.16)} ${f(y + r * 0.16)} ${f(x)} ${f(y + r)}Q${f(x - r * 0.16)} ${f(y + r * 0.16)} ${f(x - r)} ${f(y)}Q${f(x - r * 0.16)} ${f(y - r * 0.16)} ${f(x)} ${f(y - r)}Z" fill="${fill}"/>`;

const ART = {
  /** LR collection: the Nightglass navy with white-gold stars and a slow arc of light (the LR frame's colours). */
  nightglass() {
    const rnd = rand(4242);
    let tw = '';
    for (let i = 0; i < 14; i++) tw += twinkle(rnd() * W, rnd() * H * 0.8, 5 + rnd() * 9, i % 3 ? '#ffe7a8' : '#ffffff');
    return wrap('ng', '<radialGradient id="ng-sky" cx="70%" cy="20%" r="95%"><stop offset="0" stop-color="#3a4f8c"/><stop offset="0.45" stop-color="#16244a"/><stop offset="1" stop-color="#0a1226"/></radialGradient>'
      + '<linearGradient id="ng-arc" x1="0" x2="1"><stop offset="0" stop-color="#ffd27a" stop-opacity="0"/><stop offset="0.5" stop-color="#ffd27a" stop-opacity="0.9"/><stop offset="1" stop-color="#fff3c9" stop-opacity="0"/></linearGradient>',
      `<rect width="${W}" height="${H}" fill="url(#ng-sky)"/>${stars(rnd, 220, '#dfe8ff')}`
      + `<path d="M-40 380Q640 40 1320 300" fill="none" stroke="url(#ng-arc)" stroke-width="3"/><path d="M-40 410Q640 90 1320 340" fill="none" stroke="url(#ng-arc)" stroke-width="1.2" opacity="0.6"/>${tw}`
      + `<rect y="${H - 70}" width="${W}" height="70" fill="#0a1226" opacity="0.35"/>`);
  },

  /** 100,000 enemies: a whirl of sakura petals on a deep pink sky. */
  petalStorm() {
    const rnd = rand(1717);
    let swirl = '';
    for (let k = 0; k < 5; k++) swirl += `<path d="M${-60 + k * 30} ${120 + k * 50}C300 ${-40 + k * 60} 700 ${420 - k * 40} 1340 ${60 + k * 70}" fill="none" stroke="#fff" stroke-opacity="${f(0.1 + k * 0.04)}" stroke-width="${18 - k * 3}" stroke-linecap="round"/>`;
    return wrap('ps', '<linearGradient id="ps-sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8fb8"/><stop offset="0.55" stop-color="#e2557f"/><stop offset="1" stop-color="#7d2a5a"/></linearGradient>',
      `<rect width="${W}" height="${H}" fill="url(#ps-sky)"/>${swirl}${petals(rnd, 170, ['#ffe4ee', '#ffc4d8', '#ffffff', '#ffd6e4'], { scale: [0.7, 2.2] })}`);
  },

  /** Spring: a pale sky, a blossoming branch across the top and falling petals. */
  spring() {
    const rnd = rand(303);
    let flowers = '';
    const pts = [[80, 40], [190, 70], [300, 52], [420, 96], [520, 60], [660, 88], [760, 50], [900, 80], [1010, 46], [1130, 74], [1230, 56]];
    for (const [x, y] of pts) {
      for (let k = 0; k < 3; k++) flowers += `<path d="${blossom(13 + rnd() * 8)}" fill="${k % 2 ? '#ffd1e0' : '#ffb3cc'}" transform="translate(${f(x + (rnd() - 0.5) * 70)} ${f(y + (rnd() - 0.5) * 40)}) rotate(${Math.round(rnd() * 72)})"/>`;
    }
    return wrap('sp', '<linearGradient id="sp-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3ff"/><stop offset="0.7" stop-color="#fdeef4"/><stop offset="1" stop-color="#ffe3ec"/></linearGradient>',
      `<rect width="${W}" height="${H}" fill="url(#sp-sky)"/>`
      + `<path d="M-20 70C150 30 260 110 420 80S700 30 820 70 1100 100 1300 40" fill="none" stroke="#6b4a3c" stroke-width="10" stroke-linecap="round"/>`
      + `<path d="M300 75C320 120 360 140 400 150M760 62C790 110 840 130 880 120" fill="none" stroke="#6b4a3c" stroke-width="5" stroke-linecap="round"/>`
      + `${flowers}${petals(rnd, 70, ['#ffb3cc', '#ffd1e0', '#ffffff'], { ys: [110, H] })}`
      + `<path d="M0 ${H - 60}Q320 ${H - 100} 640 ${H - 64}T1280 ${H - 70}V${H}H0Z" fill="#c9eabf" opacity="0.8"/>`);
  },

  /** Summer: an evening festival sky with fireworks and a string of paper lanterns. */
  summer() {
    const rnd = rand(808);
    const burst = (cx, cy, r, color, n = 18) => {
      let s = '';
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        s += `<line x1="${f(cx + Math.cos(a) * r * 0.25)}" y1="${f(cy + Math.sin(a) * r * 0.25)}" x2="${f(cx + Math.cos(a) * r)}" y2="${f(cy + Math.sin(a) * r)}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`
          + `<circle cx="${f(cx + Math.cos(a) * r * 1.08)}" cy="${f(cy + Math.sin(a) * r * 1.08)}" r="3" fill="${color}"/>`;
      }
      return s;
    };
    let lanterns = '';
    for (let i = 0; i < 13; i++) {
      const x = 40 + i * 100;
      const y = 352 + Math.sin(i * 0.9) * 10;
      lanterns += `<line x1="${x}" y1="${f(y - 18)}" x2="${x}" y2="${f(y - 8)}" stroke="#3b2a3e" stroke-width="2"/><ellipse cx="${x}" cy="${f(y + 6)}" rx="15" ry="19" fill="${i % 2 ? '#ff7a59' : '#ffb347'}"/><rect x="${x - 8}" y="${f(y - 14)}" width="16" height="5" rx="1" fill="#3b2a3e"/><rect x="${x - 8}" y="${f(y + 23)}" width="16" height="5" rx="1" fill="#3b2a3e"/>`;
    }
    return wrap('su', '<linearGradient id="su-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1f4b"/><stop offset="0.65" stop-color="#4a2f6e"/><stop offset="1" stop-color="#c0567a"/></linearGradient>',
      `<rect width="${W}" height="${H}" fill="url(#su-sky)"/>${stars(rnd, 90, '#ffffff', 1.4)}`
      + burst(260, 130, 90, '#ffd27a') + burst(620, 90, 70, '#7ee0ff', 16) + burst(980, 150, 110, '#ff8fb8', 22) + burst(1180, 70, 50, '#b8ff9a', 12)
      + `<path d="M0 334Q640 380 1280 334" fill="none" stroke="#3b2a3e" stroke-width="2"/>${lanterns}`);
  },

  /** Autumn: a warm dusk with drifting maple leaves. */
  autumn() {
    const rnd = rand(1111);
    const LEAF = 'M0 -16L4 -6L13 -9L8 0L15 4L5 5L6 14L0 8L-6 14L-5 5L-15 4L-8 0L-13 -9L-4 -6Z';
    let leaves = '';
    const cols = ['#e2572b', '#f08a24', '#f4b63f', '#c43a2f', '#ffcf6b'];
    for (let i = 0; i < 95; i++) leaves += `<path d="${LEAF}" fill="${cols[i % cols.length]}" opacity="${f(0.6 + rnd() * 0.4)}" transform="translate(${f(rnd() * W)} ${f(rnd() * H)}) rotate(${Math.round(rnd() * 360)}) scale(${f(0.7 + rnd() * 1.6)})"/>`;
    return wrap('au', '<linearGradient id="au-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd59a"/><stop offset="0.6" stop-color="#f6a05a"/><stop offset="1" stop-color="#a8473a"/></linearGradient>',
      `<rect width="${W}" height="${H}" fill="url(#au-sky)"/><circle cx="1010" cy="120" r="70" fill="#fff1c9" opacity="0.7"/>`
      + `<path d="M0 ${H - 90}Q260 ${H - 150} 520 ${H - 100}T1040 ${H - 110}T1280 ${H - 120}V${H}H0Z" fill="#7a3a33" opacity="0.55"/>${leaves}`);
  },

  /** Winter: snow falling over quiet rooftops. */
  winter() {
    const rnd = rand(2468);
    const flake = (x, y, r) => {
      let s = '';
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI / 3;
        s += `<line x1="${f(x - Math.cos(a) * r)}" y1="${f(y - Math.sin(a) * r)}" x2="${f(x + Math.cos(a) * r)}" y2="${f(y + Math.sin(a) * r)}"/>`;
      }
      return s;
    };
    let flakes = '';
    for (let i = 0; i < 24; i++) flakes += flake(rnd() * W, rnd() * H * 0.75, 6 + rnd() * 8);
    let roofs = '';
    for (let i = 0; i < 9; i++) {
      const x = i * 150 - 30;
      const w = 130 + rnd() * 40;
      const top = H - 120 - rnd() * 50;
      roofs += `<path d="M${f(x)} ${H}V${f(top + 30)}L${f(x + w / 2)} ${f(top)}L${f(x + w)} ${f(top + 30)}V${H}Z" fill="#5d7aa6"/><path d="M${f(x - 6)} ${f(top + 32)}L${f(x + w / 2)} ${f(top - 4)}L${f(x + w + 6)} ${f(top + 32)}L${f(x + w)} ${f(top + 38)}L${f(x + w / 2)} ${f(top + 8)}L${f(x)} ${f(top + 38)}Z" fill="#ffffff"/><rect x="${f(x + w / 2 - 10)}" y="${f(top + 50)}" width="20" height="22" fill="#ffe08a" opacity="0.85"/>`;
    }
    return wrap('wi', '<linearGradient id="wi-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc7ef"/><stop offset="0.7" stop-color="#e3f1fc"/><stop offset="1" stop-color="#ffffff"/></linearGradient>',
      `<rect width="${W}" height="${H}" fill="url(#wi-sky)"/><g stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.9">${flakes}</g>${stars(rnd, 160, '#ffffff', 2.6)}${roofs}`
      + `<rect y="${H - 26}" width="${W}" height="26" fill="#ffffff"/>`);
  },
};

/** SVG for a 'pb:' banner's `svg` pattern name ('' for an unknown name). */
const cache = new Map();
export function pbBannerSVG(name) {
  if (!ART[name]) return '';
  if (!cache.has(name)) cache.set(name, ART[name]());
  return cache.get(name);
}
export const PB_SVG_NAMES = Object.freeze(Object.keys(ART));
