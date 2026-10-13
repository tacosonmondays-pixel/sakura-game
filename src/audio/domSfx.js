// UI sounds without touching UI code (docs/AUDIO.md §1.5): one capture-phase click listener on the
// document resolves the clicked element against a priority table, and a MutationObserver hears
// modals and toasts come and go. `data-sfx="ui.chirp"` on any element overrides (`data-sfx="none"` mutes).

/** [selector, sfx id] in priority order; the first selector the click target sits inside wins. */
export const CLICK_TABLE = [
  ['[data-testid=title-start], .tt-start', 'ui.start'],
  ['.topbar-back, [data-testid=back], .menu-tab-x, [data-testid=reveal-close], .ma-gacha-skip', 'ui.back'],
  ['[role=tab], .tab, .ma-seg-btn, .bt-seg-btn', 'ui.tab'],
  ['[role=switch], .ma-toggle, [aria-pressed]', 'ui.toggle'],
  ['.bt-card', 'bt.pick'],
  ['.btn-yellow, .btn-primary, .bt-cta, .bt-start, .bt-buy', 'ui.confirm'],
  ['.unit-card, .item-tile, .menu-tab-btn', 'ui.select'],
  ['.lb-art, .lb-sec-art, .lb-sec-canvas', 'ui.chirp'],          // tapping the lobby secretary
  ['button, a[href], [role=button]', 'ui.click'],
];

/**
 * Pure-ish: which sound a click on `target` makes. → { id, el } | null
 * @param {Element} target
 */
export function sfxForTarget(target) {
  if (!target || typeof target.closest !== 'function') return null;
  const tagged = target.closest('[data-sfx]');
  if (tagged) {
    const id = tagged.getAttribute('data-sfx');
    return id && id !== 'none' ? { id, el: tagged } : null;
  }
  for (const [sel, id] of CLICK_TABLE) {
    const el = target.closest(sel);
    if (el) {
      if (el.disabled || el.getAttribute?.('aria-disabled') === 'true') return null;
      return { id, el };
    }
  }
  return null;
}

/**
 * Install the delegated listeners. `play(id, opts)` plays a sprite sound; `duck(tag, db)` / `unduck(tag)`
 * reach the music director. Returns an uninstall function.
 */
export function installDomSfx({ play, duck, unduck, onToggle }) {
  if (typeof document === 'undefined') return () => {};
  const onClick = (e) => {
    const hit = sfxForTarget(e.target);
    if (!hit) return;
    if (hit.id === 'ui.toggle') {
      // read the new state after the control's own handler ran
      queueMicrotask(() => {
        const on = hit.el.getAttribute('aria-checked') === 'true' || hit.el.getAttribute('aria-pressed') === 'true' || hit.el.classList.contains('on');
        play('ui.toggle', { rate: on ? 1.12 : 0.89 });
        onToggle?.(hit.el, on);
      });
      return;
    }
    play(hit.id, {});
  };
  const onDown = (e) => {
    const el = e.target?.closest?.('button[disabled], [aria-disabled=true]');
    if (el) play('ui.deny', {});
  };
  let lastTick = 0;
  const onInput = (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || el.type !== 'range') return;
    const t = performance.now();
    if (t - lastTick < 60) return;
    lastTick = t;
    const min = Number(el.min) || 0;
    const max = Number(el.max) || 1;
    const v = (Number(el.value) - min) / (max - min || 1);
    play('ui.tick', { rate: 0.8 + 0.5 * v });
  };
  document.addEventListener('click', onClick, true);
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('input', onInput, true);

  // Modals (.modal-overlay), the toast host and the gacha overlay are direct children of <body>
  // (components.js modal()/toast(), recruit.js playReveal), so the observers stay off the busy
  // battle HUD: body childList only, plus the toast host's children and each open modal's class.
  const openModals = new Map();     // overlay → its class observer
  const closeModal = (el, sound) => {
    const obs = openModals.get(el);
    if (!obs) return;
    obs.disconnect();
    openModals.delete(el);
    if (sound) play('ui.modalClose', {});
    if (!openModals.size) unduck('modal');
  };
  const toastObs = new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) {
        if (n instanceof Element && n.classList.contains('toast')) play(n.classList.contains('toast-bad') ? 'ui.deny' : 'ui.toast', {});
      }
    }
  });
  const added = (n) => {
    if (!(n instanceof Element)) return;
    if (n.classList.contains('modal-overlay') && !openModals.has(n)) {
      const obs = new MutationObserver(() => {
        if (n.classList.contains('closing')) closeModal(n, true);
      });
      obs.observe(n, { attributes: true, attributeFilter: ['class'] });
      openModals.set(n, obs);
      play('ui.modalOpen', {});
      duck('modal', -4);
    } else if (n.classList.contains('toast-host')) {
      toastObs.observe(n, { childList: true });
    } else if (n.classList.contains('ma-gacha')) {
      duck('gacha-safety', -2);
    }
  };
  const bodyObs = new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) added(n);
      for (const n of r.removedNodes) {
        if (!(n instanceof Element)) continue;
        if (openModals.has(n)) closeModal(n, !n.classList.contains('closing'));
        if (n.classList.contains('ma-gacha')) unduck('gacha-safety');
      }
    }
  });
  bodyObs.observe(document.body, { childList: true });
  for (const n of document.body.children) if (n.classList.contains('toast-host')) toastObs.observe(n, { childList: true });
  return () => {
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('input', onInput, true);
    bodyObs.disconnect();
    toastObs.disconnect();
    for (const obs of openModals.values()) obs.disconnect();
    openModals.clear();
  };
}
