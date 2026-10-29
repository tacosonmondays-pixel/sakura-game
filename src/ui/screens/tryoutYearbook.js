// The Yearbook (docs/specs/TRYOUT_DAY.md §10.4, §13.10; docs/review/tryout-day/M3_PLAN.md §1): #/tryout/yearbook, a
// kit list screen. The rail: Students (n / 29), Pep Talks (taken / in the game), Bosses and Records (?tab=records opens
// it: the hub's Records tile). A page per student as her girl tile: colour once she tried out and is yours, a pencil
// sketch while she is a Loaner ("Not in your class yet", the tile's not-met frame), blank before she tries out; a tap
// opens her page (her nameplate, how her page fills in). Rules: src/systems/tryoutYearbook.js.
import '../styles/hubs.css';
import '../styles/v2-roster.css';
import '../styles/tryout.css';
import { h, girlTile } from '../components.js';
import { ghostBtn } from '../kit.js';
import { listScreen } from '../listScreen.js';
import { openSheet } from '../sheet.js';
import { namePlate } from '../girlFrame.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { UNIT_MAP } from '../../data/units.js';
import { ENEMY_MAP } from '../../data/enemies.js';
import { getMap } from '../../data/maps.js';
import { portraitHTML } from '../../art/portraits.js';
import { fmtNum } from '../format.js';
import { yearbookPages } from '../../systems/tryoutYearbook.js';
import { CARD_TEXT, YEARBOOK_TEXT, YEARBOOK_SCREEN, LENGTH_NAMES } from '../text/tryout.js';
import { paintMarblesPill } from './tryout.js';
import { railCounts } from './tryoutJar.js';

export const YB_SECTIONS = Object.freeze(['girls', 'cards', 'bosses', 'records']);
const YB_GLYPH = { girls: 'cap', cards: 'stamp', bosses: 'crown', records: 'trophy' };

/** Pure: a student's page kind: colour (tried out, yours), pencil (tried out as a Loaner) or blank. */
export const pageKind = (g) => (g.stamped ? (g.colour ? 'colour' : 'pencil') : 'blank');

/** Pure: each section's count for its rail tab. */
export function sectionCounts(yb) {
  return {
    girls: `${yb.girls.filter((g) => g.stamped).length}/${yb.girls.length}`,
    cards: `${yb.cards.filter((c) => c.taken).length}/${yb.cards.length}`,
    bosses: String(yb.bosses.length),
    records: String(yb.records.length),
  };
}

let sectionOn = 'girls';

/** Her Yearbook page: her card art under the nameplate, and how her page fills in. */
function openGirlPage(g) {
  const u = UNIT_MAP[g.id];
  const kind = pageKind(g);
  const line = kind === 'colour' ? YEARBOOK_SCREEN.colourLine : kind === 'pencil' ? YEARBOOK_SCREEN.pencilLine : YEARBOOK_SCREEN.blankLine;
  openSheet({
    title: u.name, testid: 'yb-page', cls: 'ty-yb-sheet',
    body: h(`div.ty-yb-page.${kind}`,
      h('div.ty-yb-art', h('span.ty-yb-pic', { html: portraitHTML(u, 'card', { eager: true }) }), h('div.gp-plate-host.ty-yb-plate', namePlate(u, store.profile, { potTestid: null }))),
      h('div.ty-yb-side',
        h('p.ty-yb-line', { 'data-testid': 'yb-page-line' }, line),
        ghostBtn(YEARBOOK_SCREEN.fullPage, { testid: 'yb-page-full', onClick: () => navigate('student', { id: u.id }) }))),
  });
}

export function renderYearbook(root, params = {}) {
  if (YB_SECTIONS.includes(params.tab)) sectionOn = params.tab;
  const ls = listScreen({
    title: YEARBOOK_TEXT.title, cls: 'ty-screen ty-yb-screen', location: 'academy', host: null, headTestid: 'yb-head',
    sections: YB_SECTIONS.map((id) => ({ id, label: YEARBOOK_SCREEN.sections[id] })), active: sectionOn, railLabel: 'Yearbook sections',
    onPick: (id) => {
      sectionOn = id;
      ls.rail.setActive(id);
      draw();
    },
  });
  root.appendChild(ls.el);
  const offPill = paintMarblesPill(ls.el);
  ls.rail.dataset.testid = 'yb-rail';

  const girls = (yb) => h('div.ty-yb-girls', yb.girls.map((g) => {
    const kind = pageKind(g);
    const t = girlTile(g.id, {
      owned: kind === 'colour', potential: 0, rule: kind === 'pencil' ? YEARBOOK_SCREEN.pencilRule : kind === 'blank' ? YEARBOOK_SCREEN.blankRule : null,
      testid: `yb-girl-${g.id}`, cls: `ty-yb-${kind}`, onClick: () => openGirlPage(g),
    });
    t.dataset.page = kind;
    // (blank: no chip, so the pencil sketches stand out; her aria-label still says how her page fills in)
    if (kind === 'blank') t.querySelector('.gt-join')?.remove();
    if (kind === 'pencil') t.title = `${UNIT_MAP[g.id].name}: ${YEARBOOK_TEXT.pencil}`;
    return t;
  }));

  const cards = (yb) => {
    const shown = yb.cards.filter((c) => c.taken || c.seen);
    if (!shown.length) return h('p.ty-list-note', YEARBOOK_TEXT.none);
    return h('div.ty-yb-cards', yb.cards.map((c) => {
      const name = c.taken || c.seen ? CARD_TEXT[c.id]?.name || c.id : YEARBOOK_SCREEN.unseen;
      return h(`span.ui-chip.ty-yb-card${c.taken ? '.on' : c.seen ? '.seen' : '.unseen'}`, { 'data-card': c.id, title: c.taken ? 'Taken' : c.seen ? 'Seen, not taken yet' : 'Not seen yet' },
        h('span', name));
    }));
  };

  const bosses = (yb) => (yb.bosses.length
    ? h('div.ty-yb-cards', yb.bosses.map((id) => h('span.ui-chip.on.ty-yb-card', h('span', ENEMY_MAP[id]?.name || id))))
    : h('p.ty-list-note', YEARBOOK_TEXT.none));

  const records = (yb) => (yb.records.length
    ? h('div.ty-yb-records', { 'data-testid': 'yb-records' }, yb.records.map((r) => {
      let map = r.mapId;
      try {
        map = getMap(r.mapId).name;
      } catch { /* (its id) */ }
      return h('div.ui-panel.ty-yb-rec', h('span.lbl', `${LENGTH_NAMES[r.length] || r.length} · Grade ${r.grade}`), h('b.ty-yb-rec-map', map),
        h('span.num.ty-yb-rec-score', fmtNum(r.score, 'count', { detail: true })));
    }))
    : h('p.ty-list-note', YEARBOOK_TEXT.none));

  function draw() {
    const yb = yearbookPages(store.profile);
    const counts = sectionCounts(yb);
    railCounts(ls.rail, counts, YB_GLYPH, YEARBOOK_SCREEN.sections);
    ls.setHead(YEARBOOK_SCREEN.sections[sectionOn], []);
    const body = sectionOn === 'cards' ? cards(yb) : sectionOn === 'bosses' ? bosses(yb) : sectionOn === 'records' ? records(yb) : girls(yb);
    ls.list.replaceChildren(h('section.ty-yb', { 'data-testid': 'tryout-yearbook', 'data-section': sectionOn },
      h('p.ty-list-note.ty-yb-stamps', { 'data-testid': 'yb-stamps' }, YEARBOOK_TEXT.line(yb.stamps, yb.nextAt, yb.per, yb.marbles)),
      body));
  }

  draw();
  return () => {
    ls.cleanup();
    offPill();
  };
}
