// "A new version is ready" pill (src/core/updates.js finds the deploy). It never interrupts a
// battle: during one it waits for the next screen. On the title screen nothing is lost by a
// reload, so the game simply reloads into the new version there.
import './styles/update.css';
import { h, button } from './components.js';
import { onUpdate, updateAvailable, reloadFresh, startUpdateWatcher } from '../core/updates.js';
import { versionLabel } from '../core/buildInfo.js';
import { currentRoute } from './router.js';

let bar = null;
let dismissed = null; // build the player closed the pill for

const QUIET_SCREENS = new Set(['battle']);

function show(info) {
  if (!info || dismissed === info.build) return;
  const route = currentRoute()?.name;
  if (QUIET_SCREENS.has(route)) return; // after the battle
  if (route === 'title' && reloadFresh(info.build, { auto: true })) return;
  bar?.remove();
  bar = h('div.upd-bar', { role: 'status', 'data-testid': 'update-bar' },
    h('span.upd-dot', { 'aria-hidden': 'true' }),
    h('span.upd-text', h('b', 'New version ready'), info.version ? h('small', ` ${versionLabel(info.version)}`) : null),
    button('Update', { kind: 'yellow', small: true, icon: 'refresh', testid: 'update-now', onClick: () => reloadFresh(info.build) }),
    h('button.upd-x', { 'aria-label': 'Later', title: 'Later', onclick: () => { dismissed = info.build; bar?.remove(); bar = null; } }, '×'));
  document.body.appendChild(bar);
}

/** Starts the watcher and the pill (once, from main.js). */
export function initUpdateBanner() {
  startUpdateWatcher();
  onUpdate(show);
  window.addEventListener('screenchange', () => {
    const info = updateAvailable();
    if (!info) return;
    if (QUIET_SCREENS.has(currentRoute()?.name)) {
      bar?.remove(); // keep the battle screen clean
      bar = null;
    } else if (!bar) show(info);
  });
}
