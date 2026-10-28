// The Marble Jar (docs/specs/TRYOUT_DAY.md §10.3, §13.10): a plain hub sub-screen (#/tryout/jar) until the Ink &
// Paper screens (M3). Three shelves: Desk Supplies (bought once, each with its own on/off switch), Cosmetics (bought
// once; the first of a kind goes into use) and Materials (a weekly stock). Rules: src/systems/tryoutJar.js.
import { h, button, toast } from '../components.js';
import { store } from '../../core/store.js';
import { MATERIAL_FAMILIES } from '../../data/types.js';
import { jarShelves, buyJar, setPerk, selectCosmetic } from '../../systems/tryoutJar.js';
import { weekState } from '../../systems/tryoutRewards.js';
import { JAR_TEXT, JAR_SHELVES, JAR_NOTES, JAR_ERRORS, MARBLES } from '../text/tryout.js';

/** Which family the material pack buys (kept between redraws of this screen). */
let packFamily = Object.keys(MATERIAL_FAMILIES)[0];

/**
 * @param {{ redraw: () => void, back: () => void }} o
 * @returns {HTMLElement}
 */
export function jarPanel({ redraw, back }) {
  const p = store.profile;
  const shelves = jarShelves(p);
  const wk = weekState(p);
  const save = (reason) => {
    store.commit(reason);
    store.saveNow();
    redraw();
  };
  const buy = (row) => {
    const r = buyJar(store.profile, row.id, { family: row.family ? packFamily : null });
    if (!r.ok) {
      toast(JAR_ERRORS[r.error] || JAR_ERRORS.unknown, 'warn');
      return;
    }
    toast(`${JAR_TEXT[row.id]?.name || row.id}: yours!`, 'good');
    save('tryout-jar');
  };

  const item = (row) => {
    const t = JAR_TEXT[row.id] || { name: row.id, line: '' };
    const actions = [];
    if (row.shelf === 'desk' && row.owned) {
      const b = button(row.on ? 'On' : 'Off', {
        kind: row.on ? 'primary' : 'ghost', small: true, testid: `jar-toggle-${row.id}`,
        onClick: () => {
          setPerk(store.profile, row.perk, !row.on);
          save('tryout-jar');
        },
      });
      b.setAttribute('aria-pressed', row.on ? 'true' : 'false');
      actions.push(b);
    } else if (row.shelf === 'cosmetic' && row.owned) {
      actions.push(button(row.selected ? 'In use' : 'Use', {
        kind: row.selected ? 'primary' : 'ghost', small: true, testid: `jar-use-${row.id}`,
        onClick: () => {
          selectCosmetic(store.profile, row.kind, row.selected ? null : row.id);
          save('tryout-jar');
        },
      }));
    } else if (row.left > 0) {
      if (row.family) {
        actions.push(h('select.ty-brush', { 'data-testid': 'jar-family', onchange: (e) => { packFamily = e.target.value; } },
          ...Object.entries(MATERIAL_FAMILIES).map(([id, f]) => h('option', { value: id, selected: id === packFamily }, f.name))));
      }
      actions.push(button(`${row.price} ${MARBLES}`, { small: true, testid: `jar-buy-${row.id}`, disabled: !row.canBuy, onClick: () => buy(row) }));
    }
    const state = row.shelf === 'material' ? `${row.left} of ${row.perWeek} left this week` : row.owned ? 'Yours' : `${row.price} ${MARBLES}`;
    return h(`div.ty-item${row.owned ? '.ty-owned' : ''}`, { 'data-testid': `jar-item-${row.id}` },
      h('b', t.name), h('span', t.line), h('span.ty-dim', state), actions.length ? h('div.ty-actions', ...actions) : null);
  };

  const shelf = (id, rows) => [
    h('b', JAR_SHELVES[id]), h('p.muted', JAR_NOTES[id]),
    h('div.ty-shelf', { 'data-testid': `jar-shelf-${id}` }, ...rows.map(item)),
  ];
  return h('section.panel.ty-hub', { 'data-testid': 'tryout-jar' },
    h('div.ty-sheet-title', 'Marble Jar'),
    h('div.ty-wallet', { 'data-testid': 'jar-wallet' }, h('span', h('b', String(shelves.marbles)), ` ${MARBLES}`), h('span.ty-dim', `${wk.week} / ${wk.cap} earned this week`)),
    ...shelf('desk', shelves.desk), ...shelf('cosmetic', shelves.cosmetic), ...shelf('material', shelves.material),
    h('div.ty-actions', button('Back', { kind: 'ghost', small: true, icon: 'back', testid: 'tryout-sub-back', onClick: back })));
}
