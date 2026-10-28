// The Yearbook (docs/specs/TRYOUT_DAY.md §10.4, §13.10): a plain hub sub-screen (#/tryout/yearbook) until the Ink &
// Paper screens (M3). A page per student (pencil while she is a Loaner, colour once she is yours), the Pep Talks
// taken, the bosses beaten and the best scores. Rules: src/systems/tryoutYearbook.js.
import { h, svgEl, button } from '../components.js';
import { store } from '../../core/store.js';
import { UNIT_MAP } from '../../data/units.js';
import { ENEMY_MAP } from '../../data/enemies.js';
import { getMap } from '../../data/maps.js';
import { portraitHTML } from '../../art/portraits.js';
import { fmtNum } from '../format.js';
import { yearbookPages } from '../../systems/tryoutYearbook.js';
import { CARD_TEXT, YEARBOOK_TEXT, LENGTH_NAMES } from '../text/tryout.js';

/** @param {{ back: () => void }} o @returns {HTMLElement} */
export function yearbookPanel({ back }) {
  const yb = yearbookPages(store.profile);
  const girl = (g) => h(`div.ty-page${g.stamped ? (g.colour ? '.ty-colour' : '.ty-pencil') : '.ty-blank'}`, {
    'data-testid': `yb-girl-${g.id}`, title: g.stamped && !g.colour ? YEARBOOK_TEXT.pencil : undefined,
  }, svgEl(portraitHTML(UNIT_MAP[g.id], 'thumb'), 'ty-squad-art'), h('span', g.stamped ? UNIT_MAP[g.id].name : '?'));
  const taken = yb.cards.filter((c) => c.taken);
  return h('section.panel.ty-hub', { 'data-testid': 'tryout-yearbook' },
    h('div.ty-sheet-title', YEARBOOK_TEXT.title),
    h('p.ty-dim', { 'data-testid': 'yb-stamps' }, YEARBOOK_TEXT.line(yb.stamps, yb.nextAt, yb.per, yb.marbles)),
    h('b', `${YEARBOOK_TEXT.girls} · ${yb.girls.filter((g) => g.stamped).length} / ${yb.girls.length}`),
    h('div.ty-pages', ...yb.girls.map(girl)),
    h('b', `${YEARBOOK_TEXT.cards} · ${taken.length} / ${yb.cards.length}`),
    taken.length ? h('div.ty-list', ...yb.cards.map((c) => h(`span${c.taken ? '.ty-on' : ''}`, c.taken || c.seen ? CARD_TEXT[c.id]?.name || c.id : '?'))) : h('p.muted', YEARBOOK_TEXT.none),
    h('b', `${YEARBOOK_TEXT.bosses} · ${yb.bosses.length}`),
    yb.bosses.length ? h('div.ty-list', ...yb.bosses.map((id) => h('span.ty-on', ENEMY_MAP[id]?.name || id))) : h('p.muted', YEARBOOK_TEXT.none),
    h('b', YEARBOOK_TEXT.records),
    yb.records.length
      ? h('div.ty-list', { 'data-testid': 'yb-records' }, ...yb.records.map((r) => h('span', `${LENGTH_NAMES[r.length] || r.length} · Grade ${r.grade} · ${getMap(r.mapId)?.name || r.mapId}: ${fmtNum(r.score, 'count', { detail: true })}`)))
      : h('p.muted', YEARBOOK_TEXT.none),
    h('div.ty-actions', button('Back', { kind: 'ghost', small: true, icon: 'back', testid: 'tryout-sub-back', onClick: back })));
}
