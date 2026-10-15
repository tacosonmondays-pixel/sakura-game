// Settings → Online: connection status, the online display name, and transfer codes (move a
// save to another device with a one-time code that expires after 24 hours). The save itself
// stays local; the code only carries a copy of it through the server.
import '../styles/online.css';
import '../styles/social.css';
import { h, button, toast } from '../components.js';
import { store } from '../../core/store.js';
import { getBackend } from '../../online/backend.js';
import { errorText } from '../../online/errors.js';
import { onlinePill, ensureOnline, askName, storedName } from './common.js';
import { navigate } from '../router.js';
import { ledgerBusy } from '../../online/donateLedger.js';
import { DM_PRIVACY, DM_PRIVACY_DEFAULT, PRIVACY_LABELS, PRIVACY_HELP, formatFriendCode } from '../../online/socialRules.js';
import { setPrivacyCache } from './socialHub.js';

/**
 * [social] Who can message me · friend code · blocked players. Filled once the account is online
 * (Settings never creates an online account) and the server has the social update.
 */
function socialRows() {
  const box = h('div.sc-settings', { 'data-testid': 'settings-social' });
  const note = (text) => box.replaceChildren(h('div.ma-set-row', h('div.ma-set-text', h('div.ma-set-label', 'Who can message me'), h('div.ma-set-desc', text))));
  if (!storedName()) {
    note('Messages and friends start once you go online (chat, clans or co-op).');
    return box;
  }
  note('Checking…');
  (async () => {
    let b;
    try {
      b = await ensureOnline({ ask: false });
    } catch {
      note('Online features are offline right now.');
      return;
    }
    const st = await b.socialStatus();
    if (st !== 'ready') {
      note(st === 'needs_update' ? 'Needs the latest server update — the game\'s owner has to run one setup step. Chat, clans and co-op work as usual.' : 'Online features are offline right now.');
      box.querySelector('.ma-set-row')?.setAttribute('data-testid', 'settings-social-update');
      return;
    }
    let summary;
    let code;
    let blocked;
    try {
      [summary, code, blocked] = await Promise.all([b.socialSummary(), b.myFriendCode(), b.blocked()]);
    } catch (e) {
      note(errorText(e));
      return;
    }
    let value = summary.privacy || DM_PRIVACY_DEFAULT;
    const seg = h('div.ol-seg.sc-set-seg');
    const help = h('div.ma-set-desc', PRIVACY_HELP[value]);
    const paint = () => {
      help.textContent = PRIVACY_HELP[value];
      seg.replaceChildren(...DM_PRIVACY.map((p) => h(`button.ol-seg-btn${p === value ? '.on' : ''}`, {
        type: 'button', 'data-testid': `settings-privacy-${p}`,
        onclick: async () => {
          try {
            await b.setPrivacy(p);
            value = p;
            setPrivacyCache(p);
            paint();
            toast(`Who can message me: ${PRIVACY_LABELS[p]}`, 'good');
          } catch (e) {
            toast(errorText(e), 'bad');
          }
        },
      }, PRIVACY_LABELS[p])));
    };
    paint();
    const codeEl = h('b.sc-mycode', { 'data-testid': 'settings-friend-code' }, formatFriendCode(code.code));
    box.replaceChildren(
      h('div.ma-set-row',
        h('div.ma-set-text', h('div.ma-set-label', 'Who can message me'), help),
        h('div.ma-set-control', seg)),
      h('div.ma-set-row',
        h('div.ma-set-text', h('div.ma-set-label', 'Friend code'), h('div.ma-set-desc', 'Give it to people you know so they can add you. A new code makes the old one stop working.')),
        h('div.ma-set-control.ol-settings-row', codeEl,
          button('Copy', { kind: 'ghost', small: true, onClick: () => navigator.clipboard?.writeText(formatFriendCode(code.code)).then(() => toast('Copied', 'good'), () => {}) }),
          button('New code', { kind: 'ghost', small: true, testid: 'settings-friend-code-new', onClick: async () => {
            try {
              code = await b.resetFriendCode();
              codeEl.textContent = formatFriendCode(code.code);
            } catch (e) {
              toast(errorText(e), 'bad');
            }
          } }))),
      h('div.ma-set-row',
        h('div.ma-set-text', h('div.ma-set-label', 'Blocked players'), h('div.ma-set-desc', blocked.length ? `${blocked.length} blocked. They can't message, invite or friend you.` : 'Nobody blocked.')),
        h('div.ma-set-control', button(blocked.length ? 'Manage' : 'Open list', { kind: 'ghost', small: true, icon: 'close', testid: 'settings-blocked', onClick: () => navigate('messages', { tab: 'blocked' }) }))),
    );
  })();
  return box;
}

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
    // [social] a save copied mid-donation could hand out the same items twice: finish first
    if (ledgerBusy(store.profile)) {
      toast('Finishing your clan donation or collect first — open Clan → Requests, then try again.', 'info', 3600);
      return;
    }
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
    socialRows(),
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
