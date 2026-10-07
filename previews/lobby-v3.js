// Dev preview for the lobby V3 art (not part of the game build).
//   /previews/lobby-v3.html?s=icons    every illustrated lobby icon on a light and a dark ground
//   /previews/lobby-v3.html?s=room     the painted lobby room, all layers composed (full-bleed)
//   /previews/lobby-v3.html?s=room&layer=far|mid|near   one layer
import { lobbyIcon, LOBBY_ICON_NAMES, campaignFolderSVG } from '../src/art/lobbyIcons.js';
import { themeBackdropSVG } from '../src/art/backdrops.js';

const q = new URLSearchParams(location.search);
const s = q.get('s') || 'icons';
const app = document.getElementById('app');

if (s === 'icons') {
  for (const bg of ['pv-bg-a', 'pv-bg-b']) {
    const wrap = document.createElement('div');
    wrap.className = `pv-icons ${bg}`;
    for (const name of LOBBY_ICON_NAMES) {
      const c = document.createElement('div');
      c.className = 'pv-cell';
      c.innerHTML = `${lobbyIcon(name, { uid: `${bg}-${name}` })}<span>${name}</span>`;
      wrap.appendChild(c);
    }
    const big = document.createElement('div');
    big.className = 'pv-cell pv-big';
    big.style.width = '220px';
    big.innerHTML = `${campaignFolderSVG({ uid: bg, art: themeBackdropSVG('sakura') })}<span>campaign folder</span>`;
    wrap.appendChild(big);
    app.appendChild(wrap);
  }
} else if (s === 'room') {
  import('../src/art/backdrops.js').then(({ lobbyRoomSVG }) => {
    const layers = q.get('layer') ? [q.get('layer')] : ['far', 'mid', 'near'];
    for (const l of layers) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(new Blob([lobbyRoomSVG(l)], { type: 'image/svg+xml' }));
      Object.assign(img.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', objectFit: 'cover' });
      app.appendChild(img);
    }
  });
}
