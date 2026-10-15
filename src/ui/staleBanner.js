// "Open in another tab — reload" (src/core/store.js turns stale when another tab saved after this
// one): this tab no longer saves, so the newer save is never overwritten. A small pill at the
// bottom centre (the top one is the update pill's); Reload brings this tab to the newest save.
import './styles/update.css';
import { h, button } from './components.js';
import { store } from '../core/store.js';

let bar = null;

function show() {
  if (bar || typeof document === 'undefined') return;
  bar = h('div.upd-bar.save-stale', { role: 'status', 'data-testid': 'save-stale' },
    h('span.upd-dot', { 'aria-hidden': 'true' }),
    h('span.upd-text', h('b', 'Open in another tab'), h('small', ' — progress here is not saved')),
    button('Reload', { kind: 'yellow', small: true, icon: 'refresh', testid: 'save-stale-reload', onClick: () => location.reload() }));
  document.body.appendChild(bar);
  document.body.classList.add('has-save-stale'); // sheets and dialogs leave room for it (update.css)
}

/** Once, from main.js. */
export function initStaleBanner() {
  store.on('stale', show);
  if (store.stale) show();
  // the ledger (or an import) took the newest save in this tab: it saves again
  store.on('change', ({ reason } = {}) => {
    if ((reason === 'reload' || reason === 'replace') && !store.stale) {
      bar?.remove();
      bar = null;
      document.body.classList.remove('has-save-stale');
    }
  });
}
