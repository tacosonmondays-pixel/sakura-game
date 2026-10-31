// Stickers in the UI (docs/specs/STICKERS.md): the picture, the picker (co-op battle, clan chat, private messages)
// and the per-player mute. The picture always comes from this build's own table and files; a network message only
// ever names an id (src/online/stickerWire.js).
import '../styles/online.css';
import { h } from '../dom.js';
import { artUrl } from '../../art/portraits.js';
import { STICKERS, STICKER_MAP, stickerAlt, stickerHint } from '../../data/stickers.js';
import { ownedStickers } from '../../systems/stickers.js';
import { onEscape } from '../hold.js';

/** <img> of a sticker (the 128 px file up to 96 px on screen, else the 256 px one). */
export function stickerImg(id, px = 64, cls = 'stk-img') {
  const s = STICKER_MAP[id];
  if (!s) return null;
  const file = px > 96 ? 256 : 128;
  return h(`img.${cls}`, { src: artUrl(`stickers/${s.id}-${file}.webp`), alt: stickerAlt(s), width: px, height: px, draggable: 'false', decoding: 'async' });
}

// Players whose stickers this page does not show (the co-op picker's "Mute"; for this visit, by uid)
const muted = new Set();
export const stickerMuted = (uid) => !!uid && muted.has(uid);
export function setStickerMuted(uid, on) {
  if (!uid) return;
  if (on) muted.add(uid);
  else muted.delete(uid);
}

/**
 * The sticker picker: every sticker, the owned ones first and tappable, the others locked with how to get them.
 * @param {{ profile: object, onPick: (id: string) => void, onClose?: () => void, title?: string, extra?: HTMLElement|null, cls?: string }} o
 * @returns {{ el: HTMLElement, close(): void }}
 */
export function openStickerPicker({ profile, onPick, onClose = null, title = 'Stickers', extra = null, cls = '' }) {
  const own = new Set(ownedStickers(profile));
  const line = h('p.stk-pick-line', { 'data-testid': 'stk-pick-line' }, `${own.size} of ${STICKERS.length} · tap one to send`);
  // the owned ones first (the quick picks), then the locked ones in table order
  const tiles = [...STICKERS.filter((s) => own.has(s.id)), ...STICKERS.filter((s) => !own.has(s.id))].map((s) => {
    const mine = own.has(s.id);
    return h(`button.stk-tile${mine ? '' : '.locked'}`, {
      type: 'button',
      'data-testid': `stk-${s.id}`,
      'aria-label': mine ? `Send: ${stickerAlt(s)}` : `${stickerAlt(s)} (locked: ${stickerHint(s)})`,
      title: mine ? s.label : stickerHint(s),
      onclick: () => {
        if (!mine) {
          line.textContent = `${s.who}'s "${s.label}" — ${stickerHint(s)}`;
          return;
        }
        close();
        onPick(s.id);
      },
    }, stickerImg(s.id, 64), mine ? null : h('i.stk-lock', { 'aria-hidden': 'true' }));
  });
  const panel = h('div.stk-pick', { role: 'dialog', 'aria-label': title, 'data-testid': 'stk-picker' },
    h('header.stk-pick-head', h('b', title), h('button.stk-pick-x', { type: 'button', 'aria-label': 'Close', 'data-testid': 'stk-close', onclick: () => close() }, '×')),
    h('div.stk-grid', tiles), line, extra);
  const el = h(`div.stk-pick-overlay${cls ? `.${cls}` : ''}`, { onpointerdown: (e) => { if (e.target === el) close(); } }, panel);
  let open = true;
  function close() {
    if (!open) return;
    open = false;
    offEsc();
    window.removeEventListener('hashchange', close);
    el.remove();
    onClose?.();
  }
  const offEsc = onEscape(() => close()); // (the shared stack: Escape closes the picker only, not the battle's menus)
  window.addEventListener('hashchange', close); // (another screen: the picker goes with this one)
  document.body.append(el);
  return { el, close };
}
