// Dev-only contact sheet of every map's track (Tracks v3): the stage thumbnail as players see
// it on map cards, or the debug drawing (path tiles, band, crossings, tunnels, decor).
//   /previews/tracks.html            thumbnails
//   /previews/tracks.html?debug=1    debug drawings      ?cols=N  grid columns
//   ?only=id1,id2                    just these maps
import { MAPS } from '../src/data/maps.js';
import { MAP_TIERS } from '../src/data/types.js';
import { stageThumbSVG } from '../src/art/stageThumb.js';
import { trackDebugSVG } from './trackDebug.js';

const q = new URLSearchParams(location.search);
const debug = q.get('debug') === '1';
const out = document.getElementById('out');
const nav = document.getElementById('nav');
nav.innerHTML = `<button class="${debug ? '' : 'on'}" data-d="0">Thumbnails</button><button class="${debug ? 'on' : ''}" data-d="1">Debug</button>`;
nav.addEventListener('click', (e) => {
  const d = e.target.dataset?.d;
  if (d == null) return;
  q.set('debug', d);
  location.search = q.toString();
});
const grid = document.createElement('div');
grid.className = 'grid';
grid.style.setProperty('--cols', q.get('cols') || (debug ? 3 : 7));
const only = (q.get('only') || '').split(',').filter(Boolean);
for (const m of MAPS) {
  if (only.length && !only.includes(m.id)) continue;
  const card = document.createElement('div');
  card.className = 'card';
  const total = m.tracks.reduce((a, t) => a + t.length, 0);
  const svg = debug ? trackDebugSVG(m, { scale: 20 }) : stageThumbSVG(m, { width: 300, height: 180 });
  card.innerHTML = `${svg}<div><b>${m.name}</b> <span class="tier" style="background:${MAP_TIERS[m.tier].color}">${m.tier}</span></div>
    <div class="meta">${m.id} · ${m.tracks.length} path(s) · ${total.toFixed(0)} tiles · ${m.crossings.length} crossing(s)</div>
    <div class="meta">${m.concept}</div>`;
  grid.appendChild(card);
}
out.appendChild(grid);
