// The Marble Jar (docs/specs/TRYOUT_DAY.md §10.3, §13.10; docs/review/tryout-day/M3_PLAN.md §1): #/tryout/jar, a kit
// list screen (listScreen.js: the left section rail, the list under its ink plate header). Shelves on the rail with
// their counts: Desk Supplies (bought once, each with its own on/off switch), Cosmetics (bought once; the first of a
// kind goes into use) and Materials (a weekly stock). Each item is a card with one action: Buy (the ink row button),
// its switch, Use, or the reason it waits. Items marked `soon` stay hidden (src/systems/tryoutJar.js jarShelves).
// Marbles are in the top bar.
import '../styles/hubs.css';
import '../styles/tryout.css';
import { h, toast } from '../components.js';
import { inkBtn, secondaryBtn, num, lbl } from '../kit.js';
import { listScreen } from '../listScreen.js';
import { lineGlyph } from '../lineGlyphs.js';
import { store } from '../../core/store.js';
import { MATERIAL_FAMILIES } from '../../data/types.js';
import { jarShelves, buyJar, setPerk, selectCosmetic } from '../../systems/tryoutJar.js';
import { weekState } from '../../systems/tryoutRewards.js';
import { JAR_TEXT, JAR_SHELVES, JAR_NOTES, JAR_ERRORS, JAR_SCREEN, MARBLES } from '../text/tryout.js';
import { paintMarblesPill } from './tryout.js';

/** Which family the material pack buys (kept between redraws of this screen). */
let packFamily = Object.keys(MATERIAL_FAMILIES)[0];
/** The shelf on show (kept while the game runs). */
let shelfOn = 'desk';

/** The shelves, their line glyphs and what each item draws. */
export const JAR_SHELF_IDS = Object.freeze(['desk', 'cosmetic', 'material']);
const SHELF_GLYPH = { desk: 'desk', cosmetic: 'sparkles', material: 'box' };
const ITEM_GLYPH = { eraser: 'eraser', draft7: 'users', coins: 'coin', pocket: 'hall-pass', sg_bundle: 'book', fam_pack: 'box' };
const glyph = (name, cls = 'ui-ico') => h(`span.${cls}`, { 'aria-hidden': 'true', html: lineGlyph(name, '', { kitSize: false }) });

/** Pure: a shelf's count for its rail tab: owned / for sale (once-only shelves), stock left / weekly stock (Materials). */
export function shelfCount(id, rows) {
  if (id === 'material') return `${rows.reduce((a, r) => a + r.left, 0)}/${rows.reduce((a, r) => a + r.perWeek, 0)}`;
  return `${rows.filter((r) => r.owned).length}/${rows.length}`;
}

/**
 * Puts a shelf count (`.num`) and a line glyph into each tab of a kit rail (sideRail takes words only: a kit request).
 * @param {HTMLElement} rail @param {Record<string, string>} counts @param {Record<string, string>} glyphs
 * @param {Record<string, string>} labels
 */
export function railCounts(rail, counts, glyphs, labels) {
  for (const b of rail.querySelectorAll('.ui-stab')) {
    const id = b.dataset.tab;
    const inner = b.querySelector('.ui-stab-in');
    if (!inner) continue;
    if (glyphs[id] && !inner.querySelector('.ty-stab-ico')) inner.prepend(glyph(glyphs[id], 'ui-ico.ty-stab-ico'));
    inner.querySelector('.ty-stab-n')?.remove();
    if (counts[id] != null) {
      inner.append(h('span.num.ty-stab-n', counts[id]));
      b.setAttribute('aria-label', `${labels[id]}, ${counts[id]}`);
    }
  }
}

export function renderJar(root) {
  const shelves0 = jarShelves(store.profile);
  if (!JAR_SHELF_IDS.includes(shelfOn) || !shelves0[shelfOn]?.length) shelfOn = 'desk';
  const ls = listScreen({
    title: JAR_SCREEN.title, cls: 'ty-screen ty-jar-screen', location: 'academy', host: null, headTestid: 'jar-head',
    sections: JAR_SHELF_IDS.map((id) => ({ id, label: JAR_SCREEN.rail[id] })), active: shelfOn, railLabel: 'Shelves',
    onPick: (id) => {
      shelfOn = id;
      ls.rail.setActive(id);
      draw();
    },
  });
  ls.el.dataset.testid = 'tryout-jar-screen';
  root.appendChild(ls.el);
  const offPill = paintMarblesPill(ls.el);
  ls.rail.dataset.testid = 'jar-rail';

  const save = (reason) => {
    store.commit(reason);
    store.saveNow();
    draw();
  };
  const buy = (row) => {
    const r = buyJar(store.profile, row.id, { family: row.family ? packFamily : null });
    if (!r.ok) {
      toast(JAR_ERRORS[r.error] || JAR_ERRORS.unknown, 'warn');
      return;
    }
    toast(JAR_SCREEN.bought(JAR_TEXT[row.id]?.name || row.id), 'good');
    save('tryout-jar');
  };

  /** A card's one action: the switch, Use, Buy, or why it waits. */
  const action = (row, held) => {
    if (row.shelf === 'desk' && row.owned) {
      return h(`button.ui-opt.ty-switch${row.on ? '.on' : ''}`, {
        type: 'button', 'data-testid': `jar-toggle-${row.id}`, 'aria-pressed': row.on ? 'true' : 'false',
        'aria-label': `${JAR_TEXT[row.id]?.name || row.id}: ${row.on ? JAR_SCREEN.on : JAR_SCREEN.off}`,
        onclick: () => {
          setPerk(store.profile, row.perk, !row.on);
          save('tryout-jar');
        },
      }, h('span.ty-switch-knob', { 'aria-hidden': 'true' }), h('span', row.on ? JAR_SCREEN.on : JAR_SCREEN.off));
    }
    if (row.shelf === 'cosmetic' && row.owned) {
      return h(`button.ui-opt.ty-use${row.selected ? '.on' : ''}`, {
        type: 'button', 'data-testid': `jar-use-${row.id}`, 'aria-pressed': row.selected ? 'true' : 'false',
        onclick: () => {
          selectCosmetic(store.profile, row.kind, row.selected ? null : row.id);
          save('tryout-jar');
        },
      }, h('span', row.selected ? JAR_SCREEN.inUse : JAR_SCREEN.use));
    }
    if (row.left <= 0) return h('span.ty-item-why', JAR_SCREEN.soldOut);
    if (!row.canBuy) return secondaryBtn(JAR_SCREEN.buy(row.price), { testid: `jar-buy-${row.id}`, disabled: true, reason: JAR_SCREEN.short(row.price - held) });
    return inkBtn(JAR_SCREEN.buy(row.price), { testid: `jar-buy-${row.id}`, title: `${JAR_TEXT[row.id]?.name || row.id}: ${row.price} ${MARBLES}`, onClick: () => buy(row) });
  };

  const card = (row, held) => {
    const t = JAR_TEXT[row.id] || { name: row.id, line: '' };
    const state = row.shelf === 'material' ? JAR_SCREEN.left(row.left, row.perWeek) : row.owned ? JAR_SCREEN.yours : null;
    const family = row.family && row.left > 0
      ? h('label.ty-select', h('span.lbl', JAR_SCREEN.family),
        h('select', { 'data-testid': 'jar-family', onchange: (e) => { packFamily = e.target.value; } },
          ...Object.entries(MATERIAL_FAMILIES).map(([id, f]) => h('option', { value: id, selected: id === packFamily }, f.name))))
      : null;
    return h(`div.ui-panel.ty-item${row.owned ? '.owned' : ''}`, { 'data-testid': `jar-item-${row.id}`, 'data-shelf': row.shelf },
      h('div.ty-item-top',
        glyph(ITEM_GLYPH[row.id] || (row.kind === 'backdrop' ? 'image' : SHELF_GLYPH[row.shelf]), 'ui-ico.ty-item-ico'),
        h('div.ty-item-txt', h('b.ty-item-name', t.name), h('span.ty-item-line', t.line))),
      h('div.ty-item-foot',
        state ? h('span.ty-item-state', row.owned ? glyph('check', 'ui-ico.ty-item-ok') : null, state) : null,
        family,
        action(row, held)));
  };

  function draw() {
    const shelves = jarShelves(store.profile);
    const wk = weekState(store.profile);
    railCounts(ls.rail, Object.fromEntries(JAR_SHELF_IDS.map((id) => [id, shelfCount(id, shelves[id])])), SHELF_GLYPH, JAR_SHELVES);
    ls.setHead(JAR_SHELVES[shelfOn], [h('span.ui-chip.ink.ty-week', { 'data-testid': 'jar-week', title: `${wk.week} / ${wk.cap} ${MARBLES} earned this week` },
      glyph('marble'), num(`${wk.week}/${wk.cap}`), lbl('this week'))]);
    const rows = shelves[shelfOn] || [];
    ls.list.replaceChildren(
      h('section.ty-jar', { 'data-testid': 'tryout-jar', 'data-shelf': shelfOn },
        h('p.ty-list-note', JAR_NOTES[shelfOn]),
        h('div.ty-shelf', { 'data-testid': `jar-shelf-${shelfOn}` }, rows.map((r) => card(r, shelves.marbles)))));
  }

  draw();
  return () => {
    ls.cleanup();
    offPill();
  };
}
