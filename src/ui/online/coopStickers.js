// Co-op stickers in battle (docs/specs/STICKERS.md §2.1): the sticker button on the co-op chip opens the picker;
// a sticker sent or heard pops under that player's name on the chip for STICKER_LIMITS.showMs. Hidden when the
// player turned stickers off (Settings → Online) or muted the ally (the picker's Mute row). Nothing here touches the
// sim: the sticker goes over the room's side channel (src/online/coop/socialRoom.js).
import { h } from '../dom.js';
import { store } from '../../core/store.js';
import { STICKER_LIMITS } from '../../data/stickers.js';
import { ownsSticker, showsStickers } from '../../systems/stickers.js';
import { stickerImg, openStickerPicker, stickerMuted, setStickerMuted, STICKER_PX } from './stickers.js';

/**
 * @param {object} ctx battle context (ctx.coop: session, mySlot)
 * @param {HTMLElement[]} chips the co-op chip's player pills, by slot
 * @returns {{ el: HTMLElement|null, destroy(): void }}
 */
export function createCoopStickers(ctx, chips) {
  const session = ctx.coop?.session;
  if (!session?.sendSticker) return { el: null, destroy() {} }; // a session from before stickers (no side channel)
  const mySlot = ctx.coop.mySlot;
  const ally = () => session.player(1 - mySlot) || null;
  const ring = h('i.stk-btn-ring');
  const btn = h('button.stk-btn', { type: 'button', 'data-testid': 'coop-sticker-btn', 'aria-label': 'Send a sticker', title: 'Stickers', onclick: () => pick() },
    stickerImg('slime_hi', 28, 'stk-btn-img'), ring);
  const bubbles = new Map(); // slot → { el, timer }
  let picker = null;
  let coolTimer = 0;

  function cooldown(ms) {
    clearTimeout(coolTimer);
    btn.classList.toggle('cooling', ms > 0);
    ring.style.setProperty('--stk-cool', `${ms}ms`);
    if (ms > 0) coolTimer = setTimeout(() => btn.classList.remove('cooling'), ms);
  }

  function pick() {
    if (picker) return;
    const a = ally();
    const muteBtn = a?.uid ? h('button.stk-mute', {
      type: 'button', 'data-testid': 'stk-mute', 'aria-pressed': stickerMuted(a.uid) ? 'true' : 'false',
      onclick: () => {
        const on = !stickerMuted(a.uid);
        setStickerMuted(a.uid, on);
        muteBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        muteBtn.textContent = muteText(a, on);
        if (on) clear(1 - mySlot);
      },
    }, muteText(a, stickerMuted(a.uid))) : null;
    const off = !showsStickers(store.profile) ? h('p.stk-pick-note', 'Stickers from other players are off (Settings → Online).') : null;
    picker = openStickerPicker({
      profile: store.profile,
      title: 'Send a sticker',
      cls: 'stk-in-battle',
      extra: h('div.stk-pick-foot', muteBtn, off),
      onPick: (id) => send(id),
      onClose: () => {
        picker = null;
      },
    });
  }

  function send(id) {
    if (!ownsSticker(store.profile, id)) return;
    const r = session.sendSticker(id);
    if (r.ok) cooldown(STICKER_LIMITS.gapMs);
    else if (r.waitMs > 0) {
      cooldown(r.waitMs);
      ctx.feed?.push(`Stickers: wait ${Math.ceil(r.waitMs / 1000)} s`, 'warn', { key: 'stk-wait', ms: 1400 });
    }
  }

  function clear(slot) {
    const b = bubbles.get(slot);
    if (!b) return;
    clearTimeout(b.timer);
    b.el.remove();
    bubbles.delete(slot);
  }

  function show(slot, id) {
    const chip = chips[slot];
    const img = stickerImg(id, STICKER_PX.bubble, 'stk-bubble-img');
    if (!chip || !img) return;
    clear(slot);
    const el = h('div.stk-bubble', { 'data-testid': `coop-sticker-${slot}`, 'data-sticker': id, role: 'img', 'aria-label': img.alt }, img);
    chip.append(el);
    bubbles.set(slot, { el, timer: setTimeout(() => clear(slot), STICKER_LIMITS.showMs) });
  }

  const offSticker = session.on('sticker', ({ uid, id, mine }) => {
    if (mine) return show(mySlot, id);
    const slot = [0, 1].find((s) => session.player(s)?.uid === uid);
    if (slot == null || slot === mySlot) return;
    if (!showsStickers(store.profile) || stickerMuted(uid)) return;
    show(slot, id);
  });

  return {
    el: btn,
    destroy() {
      offSticker?.();
      clearTimeout(coolTimer);
      for (const slot of [...bubbles.keys()]) clear(slot);
      picker?.close();
      btn.remove();
    },
  };
}

const muteText = (p, on) => (on ? `Show ${p?.name || 'your ally'}'s stickers` : `Mute ${p?.name || 'your ally'}'s stickers`);
