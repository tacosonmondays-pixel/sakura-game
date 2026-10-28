// Edit Showcase (docs/specs/PROFILE.md §1.5): 8 numbered slots (× to remove, drag or tap-tap to
// reorder) over "Your students" (sorted by Power | Rarity | Level). Tap a girl to put her in the
// selected slot or the first empty one; hold her for her build. Save writes `sensei.showcase`.
import { h, svgEl, glyph, toast } from '../components.js';
import { store } from '../../core/store.js';
import { UNIT_MAP } from '../../data/units.js';
import { portraitHTML } from '../../art/portraits.js';
import { unitPower } from '../../systems/progression.js';
import { autoShowcase } from '../../systems/profileTrophies.js';
import { setSensei } from '../../systems/senseiSave.js';
import { SHOWCASE_MAX } from '../../online/profileRules.js';
import { openSheetFor } from '../hold.js';
import { displayRarity, rarityInfo, DISPLAY_RARITY_RANK } from '../rarity.js';
import { ico, attachHold, openSheetFrame, kitBtn } from './parts.js';

const SORTS = [['power', 'Power'], ['rarity', 'Rarity'], ['level', 'Level']];
const DRAG_PX = 8;

/**
 * @param {{ slot?: number|null }} [o] the slot to select first (a tap on a showcase card)
 */
export function openShowcaseEditor({ slot = null } = {}) {
  const p = store.profile;
  const start = p.sensei.showcase.length ? p.sensei.showcase : autoShowcase(p);
  const picked = Array.from({ length: SHOWCASE_MAX }, (_, i) => start[i] || null);
  let selected = Number.isInteger(slot) && slot >= 0 && slot < SHOWCASE_MAX ? slot : null;
  let sort = 'power';
  const detach = [];

  const row = h('div.es-row', { 'data-testid': 'showcase-slots' });
  const grid = h('div.es-grid', { 'data-testid': 'showcase-picker' });
  const count = h('span.pf-count.es-count');
  const sortBar = h('span.es-sort');

  const owned = () => Object.keys(p.units).filter((id) => UNIT_MAP[id]);
  const color = (id) => rarityInfo(displayRarity(UNIT_MAP[id], p)).color;

  function place(id) {
    const at = picked.indexOf(id);
    if (at >= 0) {
      // already shown: move her into the selected slot (swap), or take her out
      if (selected != null && selected !== at) [picked[at], picked[selected]] = [picked[selected], picked[at]];
      else picked[at] = null;
      selected = null;
    } else {
      const target = selected != null ? selected : picked.indexOf(null);
      if (target < 0) {
        toast('The showcase is full: remove a girl or pick a slot first.');
        return;
      }
      picked[target] = id;
      selected = null;
    }
    draw();
  }

  function tapSlot(i) {
    if (selected != null && selected !== i) {
      [picked[selected], picked[i]] = [picked[i], picked[selected]];
      selected = null;
    } else selected = selected === i ? null : i;
    draw();
  }

  function slotEl(id, i) {
    const n = h('span.es-n', String(i + 1));
    if (!id) {
      return h(`button.es-slot.empty${selected === i ? '.sel' : ''}`, { type: 'button', 'data-slot': String(i), 'data-testid': 'showcase-slot', 'data-probe': 'tile', onclick: () => tapSlot(i) }, n, ico('plus'), h('span.es-nm', 'Add'));
    }
    // (data-probe: a repeated tile, its numbers budgeted per tile; e2e/probe.mjs)
    const el = h(`div.es-slot${selected === i ? '.sel' : ''}`, { 'data-slot': String(i), 'data-unit': id, 'data-testid': 'showcase-slot', 'data-probe': 'tile', role: 'button', tabindex: '0' },
      svgEl(portraitHTML(UNIT_MAP[id], 'thumb', { alt: '' }), 'es-art'), n,
      h('button.es-x', { type: 'button', 'aria-label': `Remove ${UNIT_MAP[id].name}`, 'data-testid': 'showcase-remove', onclick: (e) => { e.stopPropagation(); picked[i] = null; if (selected === i) selected = null; draw(); } }, svgEl(glyph('close'), 'pf-ico-fill')),
      h('span.es-grip', h('i'), h('i'), h('i')),
      h('span.es-nm', UNIT_MAP[id].name));
    el.style.setProperty('--rarity', color(id));
    dragSlot(el, i);
    return el;
  }

  /** Drag a filled slot onto another to move her there (the others shift); a short press is a tap. */
  function dragSlot(el, i) {
    let start = null;
    let ghost = null;
    const onMove = (e) => {
      if (!start) return;
      if (!ghost && Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_PX) return;
      if (!ghost) {
        ghost = el.cloneNode(true);
        ghost.classList.add('es-ghost');
        ghost.style.width = `${el.offsetWidth}px`;
        ghost.style.height = `${el.offsetHeight}px`;
        document.body.append(ghost);
        el.classList.add('dragging');
      }
      ghost.style.transform = `translate(${e.clientX - el.offsetWidth / 2}px, ${e.clientY - el.offsetHeight / 2}px)`;
    };
    const onUp = (e) => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      const dragged = !!ghost;
      ghost?.remove();
      ghost = null;
      start = null;
      el.classList.remove('dragging');
      if (!dragged) {
        if (e.type === 'pointerup' && !e.target.closest?.('.es-x')) tapSlot(i);
        return;
      }
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.es-slot');
      const to = over ? Number(over.dataset.slot) : -1;
      if (to >= 0 && to !== i) {
        const [id] = picked.splice(i, 1);
        picked.splice(to, 0, id);
        selected = null;
        draw();
      }
    };
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.es-x') || (e.pointerType === 'mouse' && e.button !== 0)) return;
      start = { x: e.clientX, y: e.clientY };
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onUp, true);
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapSlot(i); } });
    // [ui-v2 M7a] the slot answers taps itself (its tap is the pointerup above): a node with a click handler is a tap
    // target to the browser's touch adjustment, so a finger on the slot's face is never moved onto the 44 px × beside it
    el.addEventListener('click', () => {});
  }

  function sorted() {
    const key = {
      power: (id) => unitPower(p, id),
      rarity: (id) => DISPLAY_RARITY_RANK[displayRarity(UNIT_MAP[id], p)] * 1e6 + unitPower(p, id),
      level: (id) => (p.units[id].level || 1) * 1e6 + unitPower(p, id),
    }[sort];
    return owned().sort((a, b) => key(b) - key(a) || a.localeCompare(b));
  }

  function pickEl(id) {
    const at = picked.indexOf(id);
    const el = h(`button.es-pick${at >= 0 ? '.on' : ''}`, { type: 'button', 'data-unit': id, 'data-testid': 'showcase-pick', 'data-probe': 'tile', title: `${UNIT_MAP[id].name} · hold for her build` },
      svgEl(portraitHTML(UNIT_MAP[id], 'thumb', { alt: '' }), 'es-art'),
      h('span.es-lv', `Lv.${p.units[id].level || 1}`),
      at >= 0 ? h('span.es-on', String(at + 1)) : null,
      h('span.es-pw', ico('sword'), unitPower(p, id).toLocaleString('en-US')));
    el.style.setProperty('--rarity', color(id));
    detach.push(attachHold(el, { onTap: () => place(id), onHold: (x) => openSheetFor(id, { tab: 'build', origin: x }) }));
    return el;
  }

  function draw() {
    for (const off of detach.splice(0)) off();
    row.replaceChildren(...picked.map(slotEl));
    count.textContent = `${picked.filter(Boolean).length} / ${SHOWCASE_MAX}`;
    sortBar.replaceChildren(...SORTS.map(([id, label]) => h(`button${sort === id ? '.on' : ''}`, { type: 'button', 'data-testid': `showcase-sort-${id}`, onclick: () => { sort = id; draw(); } }, label)));
    grid.replaceChildren(...sorted().map(pickEl));
  }

  const save = () => {
    setSensei(store.profile, { showcase: picked.filter(Boolean) });
    store.commit('sensei'); // M2: also marks the profile sync dirty (syncProfile({ reason: 'edit' }))
    frame.close();
    toast('Showcase saved');
  };

  const frame = openSheetFrame({
    title: 'Edit Showcase',
    cls: 'es-sheet',
    testid: 'showcase-editor',
    head: [count, h('span.es-tip', ico('hold'), 'Drag to reorder · × to remove · tap a girl to add · hold for her build')],
    body: h('div.es-body', row, h('div.es-bar', h('span.es-bar-t', 'Your students'), sortBar, h('span.es-note', 'Only girls you own · the picture is taken when you save')), grid),
    foot: h('div.es-foot.pf-sheet-foot',
      kitBtn('ghost', '', { 'data-testid': 'showcase-autofill', onclick: () => { const auto = autoShowcase(p); for (let i = 0; i < SHOWCASE_MAX; i++) picked[i] = auto[i] || null; selected = null; draw(); } }, h('span', 'Auto-fill by power')),
      h('span.es-spacer'),
      kitBtn('sec', '', { 'data-testid': 'showcase-cancel', onclick: () => frame.close() }, h('span', 'Cancel')),
      kitBtn('pri', '', { 'data-testid': 'showcase-save', onclick: save }, h('span', 'Save showcase'))),
    onClose: () => { for (const off of detach.splice(0)) off(); },
  });
  draw();
  return frame;
}
