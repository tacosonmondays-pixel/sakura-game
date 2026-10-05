// Dev-only preview of src/data/{maps,stages,enemies}.js (not part of the game build).
import { MAPS, pathTiles, buildableTiles } from '../src/data/maps.js';
import { CHAPTERS, STAGES, getStage } from '../src/data/stages.js';
import { ENEMIES, FAMILY_ORDER, FAMILIES, enemiesByFamily, enemyTraits } from '../src/data/enemies.js';
import { MAP_TIERS } from '../src/data/types.js';

const GROUND = { sakura: '#a8d672', lake: '#9fd39a', shrine: '#9cc98a', mountain: '#b9c4a0', marsh: '#7f9b6a', foundry: '#b8b3a8', festival: '#c9d98a', volcano: '#a89a8a', snow: '#e9f1f7', night: '#6f8f7a', arena: '#d9cfa8' };
const TILE = { '~': '#4cc9f0', T: '#2d6a4f', R: '#8d8d8d', H: '#c26a5a', X: '#3b1f1f', B: '#c79a5b', ',': '#ffafcc' };
const PATH = '#e9d8b4';
const PATH_COLORS = ['#ff4d6d', '#3a86ff', '#8338ec'];

function drawMap(map, px = 12) {
  const c = document.createElement('canvas');
  c.width = map.width * px;
  c.height = map.height * px;
  const g = c.getContext('2d');
  const tiles = pathTiles(map);
  map.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    g.fillStyle = GROUND[map.theme] || '#9c9';
    g.fillRect(x * px, y * px, px, px);
    if (tiles.has(`${x},${y}`)) {
      g.fillStyle = ch === 'B' ? TILE.B : PATH;
      g.fillRect(x * px, y * px, px, px);
    } else if (ch === ',') {
      g.fillStyle = TILE[','];
      g.fillRect(x * px + px * 0.35, y * px + px * 0.35, px * 0.3, px * 0.3);
    } else if (TILE[ch]) {
      g.fillStyle = TILE[ch];
      if (ch === 'T') { g.beginPath(); g.arc(x * px + px / 2, y * px + px / 2, px * 0.45, 0, 7); g.fill(); } else g.fillRect(x * px, y * px, px, px);
    }
  }));
  map.paths.forEach((p, i) => {
    g.strokeStyle = PATH_COLORS[i % 3];
    g.lineWidth = 2;
    g.beginPath();
    p.forEach(([x, y], k) => (k ? g.lineTo : g.moveTo).call(g, x * px + px / 2, y * px + px / 2));
    g.stroke();
    const [sx, sy] = p[0];
    g.fillStyle = '#2ecc71';
    g.fillRect(sx * px + 2, sy * px + 2, px - 4, px - 4);
    const [ex, ey] = p[p.length - 1];
    g.fillStyle = '#e63946';
    g.fillRect(ex * px + 2, ey * px + 2, px - 4, px - 4);
  });
  for (const d of map.decor) {
    g.fillStyle = '#ffd84d';
    g.beginPath(); g.arc(d.x * px + px / 2, d.y * px + px / 2, px * 0.25, 0, 7); g.fill();
  }
  return c;
}

const usedBy = {};
for (const s of STAGES) (usedBy[s.mapId] ||= []).push(s.id);

const views = {
  maps() {
    const wrap = document.createElement('div');
    wrap.className = 'grid';
    for (const m of MAPS) {
      const card = document.createElement('div');
      card.className = 'card';
      const b = buildableTiles(m);
      card.innerHTML = `<b>${m.name}</b> <span class="tier" style="background:${MAP_TIERS[m.tier].color}">${m.tier}</span>
        <div class="meta">${m.id} · ${m.theme} · ${m.width}×${m.height} · ${m.paths.length} path(s) · land ${b.land} · water ${b.water}</div>
        <div class="meta">${(usedBy[m.id] || []).join(', ')}</div>`;
      card.appendChild(drawMap(m));
      wrap.appendChild(card);
    }
    return wrap;
  },
  campaign() {
    const wrap = document.createElement('div');
    for (const ch of CHAPTERS) {
      const h = document.createElement('h2');
      h.textContent = `${ch.id}. ${ch.name} — ${ch.mechanic}`;
      wrap.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'grid';
      for (const sid of ch.stages) {
        const s = getStage(sid);
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<b>${s.id} ${s.name}</b> <span class="meta">${s.waves} waves · hp×${s.hpScale} · $${s.startCash}</span>
          <div class="meta">${s.desc}</div>
          <div>${s.introduces.map((i) => `<span class="tr">New: ${i}</span>`).join('')}</div>
          <div>${s.recommended.map((i) => `<span class="tr">${i}</span>`).join('')}${s.unlocks.units ? ` <b>Unlocks ${s.unlocks.units.join(', ')}</b>` : ''}</div>`;
        card.appendChild(drawMap(MAPS.find((m) => m.id === s.mapId), 10));
        grid.appendChild(card);
      }
      wrap.appendChild(grid);
    }
    return wrap;
  },
  bestiary() {
    const wrap = document.createElement('div');
    for (const fam of FAMILY_ORDER) {
      const h = document.createElement('h2');
      h.innerHTML = `<span class="dot" style="background:${FAMILIES[fam].color}"></span> ${FAMILIES[fam].name} — ${FAMILIES[fam].behavior}`;
      wrap.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'grid';
      for (const e of enemiesByFamily(fam)) {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<span class="dot" style="background:${e.color};border-color:${e.accent}"></span> <b>${e.name}</b> <span class="meta">${e.tier} · ${e.introducedIn}</span>
          <div class="meta">hp ${e.hp} · spd ${e.speed} · ${e.armorClass}${e.armor ? ` · armor ${e.armor}` : ''} · $${e.bounty} · threat ${e.threat}</div>
          <div>${enemyTraits(e).map((t) => `<span class="tr">${t}</span>`).join('')}</div>
          <div class="meta">model: ${e.model.variant} [${e.model.props.join(', ')}]</div>
          <div class="meta"><i>${e.counters}</i></div>`;
        grid.appendChild(card);
      }
      wrap.appendChild(grid);
    }
    return wrap;
  },
};

const nav = document.getElementById('nav');
const out = document.getElementById('out');
function show(name) {
  out.replaceChildren(views[name]());
  for (const b of nav.children) b.classList.toggle('on', b.textContent === name);
  location.hash = name;
}
for (const name of Object.keys(views)) {
  const b = document.createElement('button');
  b.textContent = name;
  b.onclick = () => show(name);
  nav.appendChild(b);
}
show(views[location.hash.slice(1)] ? location.hash.slice(1) : 'maps');
console.log(`${MAPS.length} maps, ${STAGES.length} stages, ${ENEMIES.length} enemies`);
