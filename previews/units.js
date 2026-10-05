// Dev-only palette check for src/data/units.js (not part of the game build).
import { UNITS } from '../src/data/units.js';

const HALO = {
  ring: '<ellipse cx="50" cy="14" rx="22" ry="6" fill="none" stroke-width="4"/>',
  star: '<polygon points="50,2 55,12 66,13 58,20 60,31 50,25 40,31 42,20 34,13 45,12" stroke-width="2"/>',
  moon: '<path d="M38 14 a14 10 0 1 0 24 -6 a12 8 0 1 1 -24 6z" stroke-width="2"/>',
  crown: '<polygon points="30,22 34,6 42,16 50,4 58,16 66,6 70,22" stroke-width="2"/>',
};
const head = (u) => {
  const p = u.palette;
  const halo = HALO[u.look.halo] || `<circle cx="50" cy="13" r="9" fill="none" stroke-width="4"/>`;
  const tails = u.look.hairStyle === 'twintails' ? `<ellipse cx="18" cy="70" rx="10" ry="22" fill="${p.hair}"/><ellipse cx="82" cy="70" rx="10" ry="22" fill="${p.hair}"/>` : '';
  const long = ['long', 'hime', 'wavy'].includes(u.look.hairStyle) ? `<rect x="22" y="40" width="56" height="52" rx="18" fill="${p.hairShade}"/>` : '';
  return `<svg viewBox="0 0 100 110" width="96" height="104">
    <g fill="${p.halo}" stroke="${p.halo}">${halo}</g>${long}${tails}
    <rect x="30" y="80" width="40" height="30" rx="8" fill="${p.outfit}" stroke="${p.outfitShade}" stroke-width="3"/>
    <circle cx="50" cy="52" r="28" fill="${p.hair}"/>
    <ellipse cx="50" cy="58" rx="22" ry="20" fill="${p.skin}"/>
    <path d="M24 50 Q50 22 76 50 Q62 38 50 44 Q38 38 24 50z" fill="${p.hair}"/>
    <ellipse cx="41" cy="60" rx="4.5" ry="6" fill="${p.eyes}"/><ellipse cx="59" cy="60" rx="4.5" ry="6" fill="${p.eyes}"/>
    <circle cx="42.5" cy="57.5" r="1.6" fill="#fff"/><circle cx="60.5" cy="57.5" r="1.6" fill="#fff"/>
    <rect x="64" y="84" width="22" height="5" rx="2" fill="${p.weapon}"/><circle cx="50" cy="86" r="3" fill="${p.accent}"/>
  </svg>`;
};

const grid = document.getElementById('grid');
grid.innerHTML = UNITS.map((u) => `
  <div class="card">
    ${head(u)}
    <b>${u.name} <span class="meta">${u.rarity} · ${u.kind}</span></b>
    <div class="meta">${u.title}</div>
    <div class="meta">${u.look.hairStyle} · ${u.look.accessory} · ${u.look.outfit} · ${u.look.weapon}</div>
    <div class="sw">${Object.values(u.palette).map((c) => `<i style="background:${c}"></i>`).join('')}</div>
  </div>`).join('');
