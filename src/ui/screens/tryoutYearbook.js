// The Yearbook (docs/specs/TRYOUT_DAY.md §10.4, §13.10; docs/review/tryout-day/M3_PLAN.md §1): #/tryout/yearbook, a
// kit list screen. The rail: Students (n / 29), Pep Talks (taken / in the game), Bosses and Records (?tab=records opens
// it: the hub's Records tile). A page per student as her girl tile: colour once she tried out and is yours, a pencil
// sketch while she is a Loaner ("Not in your class yet", the tile's not-met frame), blank before she tries out; a tap
// opens her page (her nameplate, how her page fills in). A Pep Talk seen or taken opens its page: what it does at each
// rarity it comes in, and its drawback. Rules: src/systems/tryoutYearbook.js.
import '../styles/hubs.css';
import '../styles/v2-roster.css';
import '../styles/tryout.css';
import { h, girlTile } from '../components.js';
import { ghostBtn, rarityTag } from '../kit.js';
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
import { PEP_CARDS, RARITIES } from '../../data/tryout.js';
import { CARD_TEXT, YEARBOOK_TEXT, YEARBOOK_SCREEN, LENGTH_NAMES, WAVE_RECORD_TEXT, PEP_LIST_TEXT, DRAWBACK_TEXT, cardText } from '../text/tryout.js';

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
    records: String(yb.records.length + (yb.waves?.length || 0)),
  };
}

/** Pure: the rail's tabs (sideRail: a glyph, the word and the section's count). */
export const sectionTabs = (yb) => {
  const n = sectionCounts(yb);
  return YB_SECTIONS.map((id) => ({ id, label: YEARBOOK_SCREEN.sections[id], icon: YB_GLYPH[id], count: n[id] }));
};

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

/**
 * Pure: a Pep Talk's Yearbook page: its group, and its effect at each rarity it comes in (a One girl card says "One
 * squad girl"; a Hidden Talent names her), and its drawback.
 * @returns {{ name: string, group: string, rows: Array<{ r: number, rarity: string, line: string }>, drawback: string|null }}
 */
export function cardPage(id) {
  const c = PEP_CARDS[id];
  if (!c) return { name: id, group: '', rows: [], drawback: null };
  const rows = (c.rar || []).map((r) => ({ r, rarity: RARITIES[r], line: cardText({ id, r, unit: c.unit || null }, { who: PEP_LIST_TEXT.yearbookWho }).line }));
  return { name: CARD_TEXT[id]?.name || id, group: PEP_LIST_TEXT.groups[c.group] || c.group, rows, drawback: DRAWBACK_TEXT[id] ? DRAWBACK_TEXT[id]() : null };
}

/** A Pep Talk's page (a sheet): taken or seen, its group, each rarity's line, its drawback. */
function openCardPage(c) {
  const pg = cardPage(c.id);
  openSheet({
    title: pg.name, testid: 'yb-card-page', cls: 'ty-yb-sheet',
    body: h('div.ty-yb-cardpage', { 'data-card': c.id },
      h('p.ty-yb-line', h('span.lbl', PEP_LIST_TEXT.yearbookGroup(pg.group)), ' · ', c.taken ? PEP_LIST_TEXT.yearbookTaken : PEP_LIST_TEXT.yearbookSeen),
      h('ul.ty-yb-rars', { 'aria-label': PEP_LIST_TEXT.yearbookRar },
        ...pg.rows.map((row) => h('li', rarityTag(row.rarity), h('span', row.line)))),
      pg.drawback ? h('p.ty-yb-draw', h('b', `${PEP_LIST_TEXT.drawback}: `), pg.drawback) : null),
  });
}

export function renderYearbook(root, params = {}) {
  if (YB_SECTIONS.includes(params.tab)) sectionOn = params.tab;
  let railKey = JSON.stringify(sectionTabs(yearbookPages(store.profile)));
  const ls = listScreen({
    title: YEARBOOK_TEXT.title, cls: 'ty-screen ty-yb-screen', location: 'academy', host: null, headTestid: 'yb-head',
    sections: JSON.parse(railKey), active: sectionOn, railLabel: 'Yearbook sections',
    onPick: (id) => {
      sectionOn = id;
      ls.rail.setActive(id);
      draw();
    },
  });
  root.appendChild(ls.el);
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
      const state = c.taken ? '.on' : c.seen ? '.seen' : '.unseen';
      const title = c.taken ? 'Taken' : c.seen ? 'Seen, not taken yet' : 'Not seen yet';
      // (a card seen or taken opens its page; an unseen one stays a blank chip)
      if (!c.taken && !c.seen) return h(`span.ui-chip.ty-yb-card${state}`, { 'data-card': c.id, title }, h('span', name));
      return h(`button.ui-chip.ty-yb-card${state}`, { type: 'button', 'data-card': c.id, 'data-testid': `yb-card-${c.id}`, title, onclick: () => openCardPage(c) },
        h('span', name));
    }));
  };

  const bosses = (yb) => (yb.bosses.length
    ? h('div.ty-yb-cards', yb.bosses.map((id) => h('span.ui-chip.on.ty-yb-card', h('span', ENEMY_MAP[id]?.name || id))))
    : h('p.ty-list-note', YEARBOOK_TEXT.none));

  // (Extended Day's best wave per Grade first, §20.5; then the best Run Scores)
  const waveRows = (yb) => (yb.waves || []).map((w) => h('div.ui-panel.ty-yb-rec', { 'data-testid': `yb-aw-${w.grade}` },
    h('span.lbl', WAVE_RECORD_TEXT.ybRow(w.grade)), h('b.ty-yb-rec-map', WAVE_RECORD_TEXT.ybBest), h('span.num.ty-yb-rec-score', fmtNum(w.wave, 'count', { detail: true }))));
  const records = (yb) => (yb.records.length || yb.waves?.length
    ? h('div.ty-yb-records', { 'data-testid': 'yb-records' }, ...waveRows(yb), ...yb.records.map((r) => {
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
    // (the counts only change while the screen is open after a save from elsewhere: the kit rail again, only then)
    const tabs = JSON.stringify(sectionTabs(yb));
    if (tabs !== railKey) {
      railKey = tabs;
      ls.setSections(JSON.parse(tabs), sectionOn);
      ls.rail.dataset.testid = 'yb-rail';
    }
    ls.setHead(YEARBOOK_SCREEN.sections[sectionOn], []);
    const body = sectionOn === 'cards' ? cards(yb) : sectionOn === 'bosses' ? bosses(yb) : sectionOn === 'records' ? records(yb) : girls(yb);
    ls.list.replaceChildren(h('section.ty-yb', { 'data-testid': 'tryout-yearbook', 'data-section': sectionOn },
      h('p.ty-list-note.ty-yb-stamps', { 'data-testid': 'yb-stamps' }, YEARBOOK_TEXT.line(yb.stamps, yb.nextAt, yb.per, yb.marbles)),
      body));
  }

  draw();
  return () => ls.cleanup();
}
