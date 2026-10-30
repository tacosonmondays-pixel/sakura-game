// The Build Coach on screen (docs/specs/BUILD_COACH.md §8, milestone C1): the girl page's Coach tab ("Set as Main", her
// build score and next three steps, To max, Farm, Gear plan, Potential) and Stage Prep's "Farming for Kage: …" tag. The
// home adds no element: her next step is a page of its news chip (src/ui/screens/lobby.js chipPages). Not the
// tutorial's coach (src/ui/story/coach.js). The rules and numbers are src/systems/buildCoach.js; this file only draws
// them. Styles: src/ui/styles/buildCoach.css (.bc-*).
import './styles/buildCoach.css';
import { h, toast } from './components.js';
import { store } from '../core/store.js';
import { navigate } from './router.js';
import { UNIT_MAP } from '../data/units.js';
import { getItem } from '../data/items.js';
import { statName } from '../data/gearStats.js';
import {
  mainGirl, setMain, clearMain, coachPaths, gearPlan, toMax, farmPlan, potentialPlan, buildScore, farmingHere,
} from '../systems/buildCoach.js';
import { ico, curArt, secondaryBtn, primaryBtn } from './kit.js';
import { openSheet } from './sheet.js';
import { fmtNum } from './format.js';

const n = (v) => fmtNum(v, 'count', { detail: true });
/** The path each girl's coach shows (this session). */
const pathPick = new Map();

const goBtn = (go, { testid = null, label = 'Go' } = {}) => (go
  ? h('button.ui-btn.ghost.bc-go', { type: 'button', 'data-testid': testid, 'data-route': go.route, onclick: () => navigate(go.route, go.params || {}) }, label, ico('chevR'))
  : null);

function card(title, { testid, onOpen = null, right = null }, ...body) {
  return h(`section.ui-panel.bc-card${onOpen ? '.tap' : ''}`, { 'data-testid': testid },
    h('div.ui-panel-in',
      h('div.bc-card-head', h('span.ui-kicker', title), h('span.bc-gap'), right,
        onOpen ? h('button.ui-ghost.bc-more', { type: 'button', 'data-testid': `${testid}-more`, onclick: onOpen, 'aria-label': `${title}: all details` }, 'All', ico('chevR')) : null),
      ...body));
}

/** One "need N · have M · missing K" line. */
function needLine(r) {
  const name = r.id === 'coins' ? 'Coins' : getItem(r.id)?.name || r.id;
  return h(`li.bc-need${r.missing ? '' : '.ok'}`, h('span.bc-need-name', name),
    h('span.num', `${n(r.need)}`), h('span.bc-need-have', `have ${n(r.have)}`),
    r.missing ? h('b.num.bc-miss', `−${n(r.missing)}`) : ico('check'));
}

/**
 * The Coach tab for one girl.
 * @param {object} unit UnitDef
 * @param {{ onChange?: Function }} o
 */
export function coachTab(unit, { onChange = () => {} } = {}) {
  const p = store.profile;
  const isMain = mainGirl(p) === unit.id;
  const paths = coachPaths(unit.id);
  const pathIndex = pathPick.has(unit.id) ? pathPick.get(unit.id) : paths[0]?.path ?? null;
  const plan = gearPlan(p, unit.id, pathIndex);
  const need = toMax(p, unit.id, plan.row);
  const farm = farmPlan(p, need.missing);
  const score = buildScore(p, unit.id, pathIndex);
  const pot = potentialPlan(p, unit.id);
  const redraw = () => onChange();

  const mainBtn = isMain
    ? secondaryBtn('Clear Main', { icon: 'close', testid: 'coach-clear-main', onClick: () => { clearMain(p); store.commit('build-coach'); redraw(); } })
    : primaryBtn('Set as Main', { icon: 'star', testid: 'coach-set-main', onClick: () => {
      const was = mainGirl(p);
      setMain(p, unit.id);
      store.commit('build-coach');
      toast(was && was !== unit.id ? `${unit.name} is your Main now (was ${UNIT_MAP[was]?.name})` : `${unit.name} is your Main: her next step shows on the home screen`, 'good');
      redraw();
    } });

  const head = h('div.bc-head',
    h('div.bc-score', { 'data-testid': 'coach-score', title: 'Build: what she wears against her best build of what you have. Max: against her fully maxed plan.' },
      h('span.lbl', 'Build'), h('b.num', String(score.score)), h('span.lbl', 'Max'), h('b.num', String(score.max))),
    isMain ? h('span.ui-chip.bc-main-tag', { 'data-testid': 'coach-main-tag' }, ico('star'), 'Main') : null,
    h('span.bc-gap'),
    mainBtn);

  const pathRow = paths.length > 1 ? h('div.bc-paths', { role: 'group', 'aria-label': 'Path', 'data-testid': 'coach-paths' },
    h('span.lbl', 'Path'),
    paths.map((r) => h(`button.ui-opt.bc-path${r.path === plan.row?.path ? '.on' : ''}`, {
      type: 'button', 'data-testid': `coach-path-${r.path}`, 'aria-pressed': r.path === plan.row?.path ? 'true' : 'false',
      onclick: () => { pathPick.set(unit.id, r.path); redraw(); },
    }, r.name))) : null;

  // Score: the next best steps
  const steps = card('Next steps', { testid: 'coach-steps' },
    score.steps.length
      ? h('ol.bc-steps', score.steps.map((s, i) => h('li.bc-step', { 'data-testid': `coach-step-${i}` },
        h('span.bc-step-txt', s.text, h('small.bc-step-sub', [s.gain ? `+${s.gain}` : null, s.costText,
          s.short ? `need ${getItem(s.short)?.name || s.short}${s.farm ? ` (${s.farm.label})` : ''}` : null].filter(Boolean).join(' · '))),
        goBtn(s.go, { testid: `coach-step-go-${i}` }))))
      : h('p.bc-line', 'Her gear is the best of what you have. Farm for better pieces, or level her up.'));

  // To max
  const maxCard = card('To max', { testid: 'coach-max', onOpen: () => openMaxSheet(unit, need) },
    h('ul.bc-rows', need.rows.map((r) => h(`li.bc-row${r.done ? '.done' : ''}`, { 'data-testid': `coach-max-${r.key}` },
      r.done ? ico('check') : ico('upgrade'),
      h('span.bc-row-t', h('b', r.title), h('span', r.line))))),
    h('p.bc-line.bc-coins', { 'data-testid': 'coach-coins' }, curArt('coins'), `Coins to max: ${n(need.coins.need)} (you have ${n(need.coins.have)})`));

  // Farm
  const farmCard = card('Farm', { testid: 'coach-farm', onOpen: farm.length ? () => openFarmSheet(farm) : null },
    farm.length
      ? h('ul.bc-rows', farm.slice(0, 3).map((f, i) => h('li.bc-row.bc-farm', { 'data-testid': `coach-farm-${i}` },
        h('span.bc-row-t', h('b', `${f.name} ×${n(f.missing)}`), h('span', f.sources[0] ? `${f.sources[0].label} · ${f.sources[0].note}` : f.later ? `Opens later: ${f.later.label}` : 'Opens later in the campaign')),
        goBtn(f.sources[0]?.go, { testid: `coach-farm-go-${i}` }))))
      : h('p.bc-line', 'Nothing missing: everything she needs is in your bag.'));

  // Gear plan
  const g = plan;
  const gearCard = card('Gear plan', { testid: 'coach-gear' },
    h('ul.bc-rows', g.slots.map((s) => h(`li.bc-row${s.piece?.ok ? '.done' : ''}`, { 'data-testid': `coach-slot-${s.slot}` },
      s.piece?.ok ? ico('check') : ico('info'),
      h('span.bc-row-t', h('b', `${s.name}: ${s.wantName || 'any main'}`),
        h('span', !s.piece ? 'Empty: equip one' : !s.want || s.piece.ok ? `${s.piece.name}${s.want ? ' has it' : ''}` : `${s.piece.name} has ${statName(s.piece.main)}: change it with a Prism Dice`))))),
    h('p.bc-line', { 'data-testid': 'coach-subs' }, h('b', 'Substats: '), g.subs.slice(0, 5).map((x) => statName(x)).join(' > ')),
    // (review r1 M6: what the bench measured and what follows her role, said plainly)
    g.club ? h('p.bc-line', { 'data-testid': 'coach-club' }, h('b', 'Club: '), g.club.split, g.club.now ? ` (now ${g.club.now})` : '', h('span.bc-role', ' · by her role')) : null,
    g.set ? h('p.bc-line', { 'data-testid': 'coach-set' }, h('b', 'Set: '), `${g.set.name} (no cap on ${g.set.stat}), then ${g.set.nextName}`, h('span.bc-role', ' · by her role')) : null,
    g.pins ? h('p.bc-line', { 'data-testid': 'coach-pins' }, h('b', 'Pins: '), `Tie Pin on her ${g.pins.tieName}; Collar Pins on ${g.pins.collar.join(', ')}`) : null,
    g.lr ? h('p.bc-line', { 'data-testid': 'coach-lr' }, h('b', 'Limit Break: '), g.lr === 'blank' ? 'Blank LR (her best lines are capped stats)' : 'Set LR (keep her set)', h('span.bc-role', ' · by her role')) : null,
    g.row ? h('p.bc-note', { 'data-testid': 'coach-basis' }, basisNote(g.row, g.est)) : null);

  // Potential
  const potCard = card('Potential', { testid: 'coach-pot' },
    pot.length
      ? h('ul.bc-rows', pot.slice(0, 3).map((s) => h('li.bc-row', h('span.bc-row-t', h('b', `P${s.step} · ${s.name}`), s.text ? h('span', s.text) : null),
        h('small.num.bc-row-cost', `1 Essence · ${n(s.coins)}`))))
      : h('p.bc-line', 'P6: her Potential is full.'));

  return h('div.mb-tab-body.bc', { 'data-testid': 'coach-tab' }, head, pathRow,
    h('div.bc-grid', steps, maxCard, farmCard, gearCard, potCard));
}

/** What her plan stands on, said per ruler (review r1 M6). */
function basisNote(row, est) {
  if (row.ruler === 'hero') return 'A hero: her plan follows her role (heroes are not benched yet).';
  if (row.ruler === 'support') return 'Her worth on this path is her team: her plan follows her role, not a bench run.';
  if (!row.measured) return 'Her damage on this path barely answers a short bench run (it grows over a long fight): her plan follows her role.';
  const on = row.ruler === 'boss' ? 'a walking boss' : 'a crowd';
  return `Measured on ${on}${est.length ? `; ${est.join(' and ')} estimated (a short run cannot see ${est.length > 1 ? 'them' : 'it'})` : ''}.`;
}

function openMaxSheet(unit, need) {
  openSheet({
    title: `${unit.name}: to max`, testid: 'coach-max-sheet', full: true,
    body: h('div.bc-sheet', need.rows.map((r) => h('section.bc-sec',
      h('div.bc-sec-head', h('b', r.title), h('span', r.line), h('span.bc-gap'), goBtn(r.go)),
      r.needs.length ? h('ul.bc-needs', r.needs.map(needLine)) : h('p.bc-line', 'Done.'))),
    h('p.bc-line', `Coins to max: ${n(need.coins.need)} · you have ${n(need.coins.have)}`)),
  });
}

function openFarmSheet(farm) {
  openSheet({
    title: 'Farm', testid: 'coach-farm-sheet', full: true,
    body: h('div.bc-sheet', h('p.bc-note', 'Best places first, by how many drop per run. Only what you earn by playing.'),
      farm.map((f) => h('section.bc-sec',
        h('div.bc-sec-head', h('b', `${f.name} ×${n(f.missing)}`)),
        h('ul.bc-rows', f.sources.map((s) => h('li.bc-row.bc-farm', h('span.bc-row-t', h('b', s.label), h('span', s.note)), goBtn(s.go)))),
        f.later ? h('p.bc-note', { 'data-testid': 'farm-later-note' }, `Opens later: ${f.later.label} drops it (not open yet).`) : !f.sources.length ? h('p.bc-note', 'Opens later in the campaign.') : null,
        f.recruit ? h('p.bc-note', { 'data-testid': 'farm-recruit-note' }, 'Also from recruiting (spare duplicates and their exchanges): not part of the plan.') : null))),
  });
}

/** Stage Prep: a map tag "Farming for Kage: Phoenix Plume ×2 +1" when this stage drops what she misses (null otherwise). */
export function stageFarmTag(stageId) {
  const f = farmingHere(store.profile, stageId);
  if (!f) return null;
  const first = f.items[0];
  const more = f.items.length - 1;
  const all = f.items.map((i) => `${i.name} ×${n(i.missing)}`).join(', ');
  return h('span.ui-chip.stp-tag.bc-farm-tag', { 'data-testid': 'stage-farming', title: `Farming for ${UNIT_MAP[f.unitId]?.name}: ${all}` },
    ico('star'), h('span.bc-farm-t', `For ${UNIT_MAP[f.unitId]?.name}: ${first.name} ×${n(first.missing)}`), more ? h('b.bc-farm-more', `+${more}`) : null);
}
