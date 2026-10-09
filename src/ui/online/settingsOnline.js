// Settings → Online: connection status, the online display name, and transfer codes (move a
// save to another device with a one-time code that expires after 24 hours). The save itself
// stays local; the code only carries a copy of it through the server.
import '../styles/online.css';
import { h, button, toast } from '../components.js';
import { store } from '../../core/store.js';
import { getBackend } from '../../online/backend.js';
import { errorText } from '../../online/errors.js';
import { onlinePill, ensureOnline, askName, storedName } from './common.js';

/**
 * @param {{ redraw: () => void, importText: (text: string, status: HTMLElement, redraw: () => void) => Promise<boolean> }} opts
 */
export function onlineSection({ redraw, importText }) {
  const backend = getBackend();
  const nameEl = h('b', { 'data-testid': 'online-name' }, storedName() || 'Not set');
  const codeOut = h('div.ol-settings-row', { 'data-testid': 'transfer-out' });
  const status = h('div.ma-code-status');
  // codes are 12 characters (60 random bits), shown as XXXX-XXXX-XXXX; dashes are optional
  const redeemBox = h('input.ma-input', { placeholder: 'XXXX-XXXX-XXXX', maxlength: 16, 'data-testid': 'transfer-code', autocomplete: 'off', spellcheck: false });
  redeemBox.addEventListener('input', () => {
    redeemBox.value = redeemBox.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  });

  const rename = async () => {
    try {
      await ensureOnline({ ask: false });
    } catch (e) {
      toast(errorText(e), 'bad');
      return;
    }
    nameEl.textContent = (await askName({ title: storedName() ? 'Change name' : 'Choose your name', current: storedName() })) || 'Not set';
  };

  const create = async () => {
    try {
      const b = await ensureOnline();
      store.saveNow();
      const { code, expiresAt } = await b.createTransfer(store.exportSave());
      const until = new Date(expiresAt);
      codeOut.replaceChildren(
        h('span.ol-transfer-code', { 'data-testid': 'transfer-created' }, code),
        h('span.muted', `One use · valid until ${until.toLocaleString()}`),
      );
      try {
        await navigator.clipboard.writeText(code);
        toast('Transfer code copied', 'good');
      } catch {
        /* shown on screen */
      }
    } catch (e) {
      toast(errorText(e), 'bad');
    }
  };

  let held = null;
  const redeem = async () => {
    const code = redeemBox.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    status.className = 'ma-code-status';
    status.textContent = '';
    if (code.length !== 12) {
      status.classList.add('bad');
      status.textContent = 'Enter the 12-character transfer code (XXXX-XXXX-XXXX).';
      return;
    }
    try {
      // a code works once: if the player cancels the import confirmation, keep the fetched save
      // so pressing Redeem again (same code) imports it without asking the server a second time
      let text = held?.code === code ? held.text : null;
      if (!text) {
        const b = await ensureOnline();
        text = await b.redeemTransfer(code);
        held = { code, text };
      }
      if (await importText(text, status, redraw)) {
        held = null;
        redeemBox.value = '';
      } else if (!status.textContent) {
        status.textContent = 'Not imported. The code is used up, but this screen keeps the save: press Redeem again to import it.';
      }
    } catch (e) {
      status.classList.add('bad');
      status.textContent = errorText(e);
    }
  };

  const { mode, reason } = backend.status;
  const statusText = mode !== 'local'
    ? 'Chat, clans and co-op use the game server. Your progress itself is always saved on this device.'
    : reason === 'forced'
      ? 'Local test mode (?online=local): chat, clans and co-op work between tabs of this browser. Your progress is always saved on this device.'
      : 'The game server is not available in this build or right now: chat, clans and co-op only work between tabs of this browser. Your progress is always saved on this device.';
  return h('section.panel', { 'data-section': 'online' },
    h('h3.panel-title', 'Online'),
    h('div.ma-set-row',
      h('div.ma-set-text', h('div.ma-set-label', 'Status'), h('div.ma-set-desc', statusText)),
      h('div.ma-set-control', onlinePill())),
    h('div.ma-set-row',
      h('div.ma-set-text', h('div.ma-set-label', 'Online name'), h('div.ma-set-desc', 'Shown in chat, clans and co-op.')),
      h('div.ma-set-control.ol-settings-row', nameEl, button(storedName() ? 'Change' : 'Set', { kind: 'ghost', small: true, testid: 'online-rename', onClick: rename }))),
    h('div.ma-save-block',
      h('div.ma-set-label', 'Transfer code'),
      h('p.muted', 'Move your save to another device: create a code here, then redeem it on the other device within 24 hours. Each code works once — treat it like a password and never share it.'),
      codeOut,
      h('div.ma-row-actions', button('Create transfer code', { kind: 'primary', small: true, icon: 'upgrade', testid: 'transfer-create', onClick: create }))),
    h('div.ma-save-block',
      h('div.ma-set-label', 'Redeem a transfer code'),
      h('div.ma-code-row', redeemBox, button('Redeem', { kind: 'yellow', small: true, icon: 'backpack', testid: 'transfer-redeem', onClick: redeem })),
      status),
  );
}
