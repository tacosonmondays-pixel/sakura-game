// Pin picker (docs/specs/PROFILE.md §1.7, ACHIEVEMENTS.md §6.2): choose up to 4 trophies for the
// shelf from what you have earned, best first: Medals | Ribbons (with the Codex modes) | Achievements.
// No pins = the best 4 medals, shown automatically.
import { h, svgEl, glyph, toast } from '../components.js';
import { store } from '../../core/store.js';
import { pinOptions, autoPins, pinEarned } from '../../systems/profileTrophies.js';
import { setSensei } from '../../systems/senseiSave.js';
import { PINS_MAX } from '../../online/profileRules.js';
import { plaqueEl, openSheetFrame } from './parts.js';

const TABS = [['medals', 'Medals'], ['ribbons', 'Ribbons'], ['achievements', 'Achievements']];
const PAGE = 60;

/** @param {{ pin?: string|null }} [o] pin: preselect an earned pin (Pin to profile from the Ribbon Case) */
export function openPinPicker({ pin: want = null } = {}) {
  const p = store.profile;
  const opts = pinOptions(p);
  let pins = p.sensei.pins.length ? [...p.sensei.pins] : [];
  let tab = 'medals';
  if (want && pinEarned(p, want)) {
    tab = want.startsWith('ach:') ? 'achievements' : want.endsWith(':perfect') || want.split(':').length === 3 ? 'ribbons' : 'medals';
    if (!pins.includes(want)) {
      if (pins.length < PINS_MAX) pins.push(want);
      else setTimeout(() => toast(`Up to ${PINS_MAX} pins: remove one to add it.`), 0);
    }
  }
  let shown = PAGE;
  const top = h('div.pp-row', { 'data-testid': 'pin-slots' });
  const tabs = h('div.es-sort.pp-tabs');
  const list = h('div.pp-list', { 'data-testid': 'pin-options' });
  const note = h('span.pp-note');

  function toggle(pin) {
    const at = pins.indexOf(pin);
    if (at >= 0) pins.splice(at, 1);
    else if (pins.length >= PINS_MAX) {
      toast(`Up to ${PINS_MAX} pins: remove one first.`);
      return;
    } else pins.push(pin);
    draw();
  }

  function draw() {
    const auto = !pins.length;
    const shelf = auto ? autoPins(p) : pins;
    top.replaceChildren(...Array.from({ length: PINS_MAX }, (_, i) => {
      const pin = shelf[i];
      if (!pin) return h('div.pp-slot.empty', h('span', 'Empty'));
      return h(`div.pp-slot${auto ? '.auto' : ''}`, plaqueEl(pin),
        auto ? null : h('button.es-x', { type: 'button', 'aria-label': 'Unpin', 'data-testid': 'pin-remove', onclick: () => toggle(pin) }, svgEl(glyph('close'), 'pf-ico-fill')));
    }));
    note.textContent = auto ? 'Automatic: your best 4 medals' : `${pins.length} / ${PINS_MAX} pinned`;
    tabs.replaceChildren(...TABS.map(([id, label]) => h(`button${tab === id ? '.on' : ''}`, { type: 'button', 'data-testid': `pin-tab-${id}`, onclick: () => { tab = id; shown = PAGE; draw(); } }, `${label} ${opts[id].length}`)));
    const items = opts[tab];
    if (!items.length) {
      list.replaceChildren(h('p.pp-empty', tab === 'ribbons' ? 'Win a battle mode on a cleared stage to earn ribbons.' : tab === 'medals' ? 'Clear stages to earn medals.' : 'Claim achievements in Missions to pin them.'));
      return;
    }
    list.replaceChildren(...[...items.slice(0, shown).map((pin) => {
      const at = pins.indexOf(pin);
      return h(`button.pp-opt${at >= 0 ? '.on' : ''}`, { type: 'button', 'data-pin': pin, 'data-testid': 'pin-option', onclick: () => toggle(pin) }, plaqueEl(pin), at >= 0 ? h('span.es-on', String(at + 1)) : null);
    }), items.length > shown ? h('button.btn.btn-ghost.btn-small.pp-more', { type: 'button', onclick: () => { shown += PAGE; draw(); } }, h('span', `Show more (${items.length - shown})`)) : null].filter(Boolean));
  }

  const save = () => {
    setSensei(store.profile, { pins });
    store.commit('sensei'); // M2: also marks the profile sync dirty
    frame.close();
    toast(pins.length ? 'Pins saved' : 'Showing your best medals');
  };

  const frame = openSheetFrame({
    title: 'Pin trophies',
    cls: 'pp-sheet',
    testid: 'pin-picker',
    head: [note],
    body: h('div.es-body', top, h('div.es-bar', tabs, h('span.es-note', 'Only what you have earned · best first')), list),
    foot: h('div.es-foot',
      h('button.btn.btn-ghost.btn-small', { type: 'button', 'data-testid': 'pin-auto', onclick: () => { pins = []; draw(); } }, h('span', 'Use my best medals')),
      h('span.es-spacer'),
      h('button.btn.btn-ghost.btn-small', { type: 'button', onclick: () => frame.close() }, h('span', 'Cancel')),
      h('button.btn.btn-yellow', { type: 'button', 'data-testid': 'pin-save', onclick: save }, h('span', 'Save pins'))),
  });
  draw();
  return frame;
}
