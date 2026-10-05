// Dev preview for the UI V2 pieces (not part of the game build).
//   /previews/ui-v2.html?s=backdrop     the lobby backdrop alone (full-bleed)
//   /previews/ui-v2.html?s=components   panels, buttons, pills, level badge, tags
//   /previews/ui-v2.html?s=rotate       the rotate-your-device overlay
//   /previews/ui-v2.html?s=menu         the Menu Tab modal
import '../src/ui/styles/base.css';
import '../src/ui/styles/meta-a.css';
import { h, button, panel, levelBadge, currencyPills, iconButton, menuTabModal, glyph, svgEl, tabs } from '../src/ui/components.js';
import { lobbyBackdropSVG } from '../src/art/backdrops.js';

const s = new URLSearchParams(location.search).get('s') || 'components';
document.body.dataset.s = s;
const app = document.getElementById('app');

if (s === 'backdrop') {
  const bg = h('div.ma-lobby-bg', { html: lobbyBackdropSVG() });
  bg.style.position = 'fixed';
  bg.style.inset = '0';
  bg.querySelector('svg').setAttribute('preserveAspectRatio', 'xMidYMid slice');
  app.appendChild(bg);
} else if (s === 'rotate') {
  const el = h('div.rotate-overlay', h('div.rotate-phone'), h('div.rotate-title', 'Please rotate your device 🌸'), h('p.rotate-text', 'Sakura Sentinels is designed for landscape — turn your phone sideways for the full academy view.'), h('div.row', button('Go fullscreen', { kind: 'yellow' }), button('Continue in portrait', { kind: 'ghost' })));
  app.appendChild(el);
} else if (s === 'menu') {
  app.appendChild(h('div.screen', h('main.screen-body', h('p', 'Menu tab modal opens on load.'))));
  menuTabModal();
} else {
  const body = h('main.screen-body');
  body.append(
    h('div.row', levelBadge(undefined, { name: 'Sensei' }), currencyPills(), iconButton('mail', { badge: 3, label: 'Mail' }), iconButton('menu', { label: 'Menu' }), iconButton('notice', { dot: true, label: 'Notice' })),
    h('div.row', button('Primary'), button('Yellow CTA', { kind: 'yellow', icon: 'play' }), button('Ghost', { kind: 'ghost' }), button('Pink', { kind: 'pink' }), button('Danger', { kind: 'danger' }), button('Small', { kind: 'primary', small: true })),
    h('div.row', h('span.tag-ribbon', h('span', 'In Progress')), h('span.tag-kicker', h('span', 'Chapter 1')), h('span.chip', svgEl(glyph('story')), 'story'), h('span.chip', svgEl(glyph('fullscreen')), 'fullscreen'), h('span.chip', svgEl(glyph('tasks')), 'tasks'), h('span.chip', svgEl(glyph('account')), 'account'), h('span.chip', svgEl(glyph('rotate')), 'rotate')),
    tabs([{ id: 'a', label: 'Daily' }, { id: 'b', label: 'Weekly', badge: true }, { id: 'c', label: 'Login' }], 'a', () => {}),
    panel('Location Select', h('p', 'White, slightly translucent panel with a blue→white gradient header and the yellow underline.'), h('div.row', button('Bounty Shop', { kind: 'yellow' }))),
    panel('Second panel', h('p.muted', 'Panels pop in over 220 ms with the shared easing.')),
  );
  app.appendChild(h('div.screen', h('header.topbar', h('button.topbar-back', svgEl(glyph('back'))), h('div.topbar-title', 'Students'), h('div.topbar-spacer'), currencyPills(), h('div.topbar-group', h('button.topbar-icon', svgEl(glyph('settings'))), h('button.topbar-icon', svgEl(glyph('home'))))), body));
}
