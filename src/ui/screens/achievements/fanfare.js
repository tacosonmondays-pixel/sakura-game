// The special Honor Ribbon fanfare (docs/specs/ACHIEVEMENTS.md §5.3): a full-screen moment before the rewards modal.
// Violet → navy backdrop, one-shot rays and sparks, a "SPECIAL HONOR RIBBON" kicker in static rainbow letters, the
// ribbon live on a bracketed stage, its name, number and effect, the source, the new title, and Skip ›. It waits for
// a tap. Several specials play in sequence (at most 3; with 4 or more, one grid card). Under Reduce Motion everything
// appears at once in the rest frame. The list underneath drops its live ribbons while it is open (the governor).

import { h } from '../../dom.js';
import { ACHIEVEMENT_MAP } from '../../../data/achievements.js';
import { HONOR_MAP, HONOR_EFFECTS } from '../../../data/honors.js';
import { ribbonArt, titlePlate, liveHonors } from '../../honorFx.js';

const phone = () => typeof matchMedia === 'function' && matchMedia('(max-height: 480px)').matches;

function card(id) {
  const hh = HONOR_MAP[id];
  const a = ACHIEVEMENT_MAP[id];
  const size = phone() ? 140 : 196;
  return h('div.ach-ff-card', { 'data-testid': `ach-fanfare-${id}` },
    h('div.ach-ff-kicker', 'Special Honor Ribbon'),
    h('div.ach-ff-stage', h('i.tk.tl'), h('i.tk.tr'), h('i.tk.bl'), h('i.tk.br'), ribbonArt(id, size, { live: true, prio: 9 })),
    h('h2.ach-ff-name', hh.name),
    h('div.ach-ff-no', `HR-${String(hh.no).padStart(2, '0')} · Effect: ${HONOR_EFFECTS[hh.effect]}`),
    h('p.ach-ff-from', 'from ', h('b', a.name), ` · ${a.desc.replace(/\.$/, '')}`),
    a.title ? h('div.ach-ff-title', h('span.ach-micro', 'New title'), titlePlate(id, { live: true })) : null,
  );
}

function gridCard(ids) {
  return h('div.ach-ff-card.grid', { 'data-testid': 'ach-fanfare-grid' },
    h('div.ach-ff-kicker', `${ids.length} Special Honor Ribbons`),
    h('div.ach-ff-grid', ids.map((id) => h('div.ach-ff-cell', ribbonArt(id, phone() ? 64 : 92, { live: true, prio: 8 }), h('b', HONOR_MAP[id].name.replace(/ Ribbon$/, '')), h('small', HONOR_EFFECTS[HONOR_MAP[id].effect])))));
}

/**
 * Show the fanfare for these special ribbons; resolves when the player taps through (or skips).
 * @param {string[]} ids achievement ids of special Honor Ribbons
 * @returns {Promise<void>}
 */
export function showSpecialFanfare(ids, { onDone = null } = {}) {
  const list = ids.filter((id) => HONOR_MAP[id]?.class === 'special');
  if (!list.length || typeof document === 'undefined') return Promise.resolve();
  const pages = list.length >= 4 ? [gridCard(list)] : list.map(card);
  return new Promise((resolve) => {
    let i = 0;
    let stop = null;
    const host = h('div.ach-ff-host');
    const skip = h('button.ach-ff-skip', { 'data-testid': 'ach-fanfare-skip', 'aria-label': 'Skip' }, 'Skip ›');
    const hint = h('div.ach-ff-hint', 'Tap to continue');
    const el = h('div.ach-fanfare', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Special Honor Ribbon', 'data-testid': 'ach-fanfare' },
      h('div.ach-ff-rays'), h('div.ach-ff-sparks', Array.from({ length: 16 }, () => h('i'))), host, skip, hint);
    const finish = () => {
      stop?.();
      el.classList.add('out');
      setTimeout(() => el.remove(), 180);
      onDone?.();
      resolve();
    };
    const show = () => {
      stop?.();
      host.replaceChildren(pages[i]);
      el.classList.remove('again');
      void el.offsetWidth;
      el.classList.add('again');
      hint.textContent = i < pages.length - 1 ? `Tap for the next one (${i + 2} of ${pages.length})` : 'Tap to see all rewards';
      stop = liveHonors(host, { budget: list.length >= 4 ? 4 : 1, ignoreOverlays: true });
    };
    el.addEventListener('click', (e) => {
      if (e.target === skip) return finish();
      i += 1;
      if (i >= pages.length) finish();
      else show();
    });
    const onKey = (e) => {
      if (!el.isConnected) return document.removeEventListener('keydown', onKey);
      if (e.key === 'Escape') finish();
      else if (e.key === 'Enter' || e.key === ' ') el.click();
    };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(el);
    show();
  });
}
