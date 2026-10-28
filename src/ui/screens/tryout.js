// Tryout Day hub and Before Class (docs/specs/TRYOUT_DAY.md §13.2, §13.3): the plain M1 screen on today's components
// (the Ink & Paper hub with Wakaba comes in M3). Route: #/tryout. Continue the open run, or start a Half Day: pick
// one of two maps, your hero and 3 of 6 drafted girls (one free redraw).
import '../styles/tryout.css';
import { h, clear, screen, svgEl, button, toast, confirmDialog } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { SIM_ID } from '../../core/buildInfo.js';
import { UNIT_MAP } from '../../data/units.js';
import { ROLES } from '../../data/types.js';
import { getMap } from '../../data/maps.js';
import { TRYOUT } from '../../data/tryout.js';
import { portraitHTML } from '../../art/portraits.js';
import { isOwned } from '../../systems/unlocks.js';
import {
  tryoutUnlocked, TRYOUT_UNLOCK, newRunSeed, beforeClass, newRunRecord, getTryoutRun, putTryoutRun, clearTryoutRun, continueKind,
} from '../../systems/tryoutRuns.js';
import { buildTryoutPlan } from '../../sim/tryout/plan.js';
import { MODE_NAME } from '../text/tryout.js';

/** Before Class's choices survive a redraw and a re-render (not a reload: a new seed then). */
let pending = null;

export function render(root) {
  const { el, body } = screen(MODE_NAME, { cls: 'ty-screen' });
  root.appendChild(el);
  const profile = () => store.profile;

  const draw = () => {
    clear(body);
    const p = profile();
    if (!tryoutUnlocked(p)) {
      body.appendChild(h('section.panel.ty-hub', { 'data-testid': 'tryout-locked' },
        h('b', `Clear ${TRYOUT_UNLOCK} to open ${MODE_NAME}`),
        h('p.muted', 'One school day of defense: pick Pep Talks after every period, take in girls who try out, and move your squad at Recess.')));
      return;
    }
    const run = getTryoutRun(p);
    if (run) {
      body.appendChild(continueBand(run));
      return;
    }
    if (!pending) {
      const seed = newRunSeed();
      const bc = beforeClass(p, seed, 1, 0);
      pending = { ...bc, redraw: 0, mapId: bc.maps[0], hero: bc.heroes.includes(p.formation?.hero) ? p.formation.hero : bc.heroes[0], pick: [] };
    }
    body.appendChild(beforeClassPanel(p));
  };

  function continueBand(run) {
    const kind = continueKind(run, SIM_ID);
    const plan = buildTryoutPlan(run);
    const note = kind === 'makeup' ? ' · uses your Make-up Test' : kind === 'practice' ? ' · continues as practice' : kind === 'stale' ? ' · closed by an update' : '';
    return h('section.panel.ty-hub', { 'data-testid': 'tryout-continue' },
      h('b', `Half Day · ${getMap(plan.mapId)?.name || plan.mapId}`),
      h('p', `Period ${run.period} · wave ${(run.wave || 0) + 1} · ♥ ${run.lives ?? TRYOUT.grades[run.grade].hearts}${note}`),
      h('div.ty-squad', ...run.squad.map((id) => svgEl(portraitHTML(UNIT_MAP[id], 'thumb', { eager: true }), 'ty-squad-art'))),
      kind === 'makeup' ? h('p.muted', 'You left during a wave: continuing replays that wave once, and that period\'s assignments no longer count.') : null,
      h('div.ty-actions',
        kind === 'stale' ? null : button('Continue', { testid: 'tryout-go-continue', icon: 'play', onClick: () => navigate('battle', { tryout: run.id }) }),
        button('Give up this run', {
          kind: 'ghost', testid: 'tryout-abandon',
          onClick: async () => {
            if (!(await confirmDialog('Give up this run? It ends here.', { title: MODE_NAME, ok: 'Give up', danger: true }))) return;
            clearTryoutRun(store.profile, run.id);
            store.commit('tryout-run');
            store.saveNow();
            draw();
          },
        })));
  }

  function girlTile(id, i) {
    const def = UNIT_MAP[id];
    const picked = pending.pick.includes(id);
    const owned = isOwned(profile(), id);
    return h(`button.ty-card.ty-draft${picked ? '.ty-picked' : ''}`, {
      'data-testid': `tryout-draft-${i}`, 'aria-pressed': picked ? 'true' : 'false',
      onclick: () => {
        if (picked) pending.pick = pending.pick.filter((x) => x !== id);
        else if (pending.pick.length < TRYOUT.squad.start) pending.pick.push(id);
        draw();
      },
    },
    svgEl(portraitHTML(def, 'thumb', { eager: true }), 'ty-card-art'),
    h('b.ty-card-name', def.name),
    h('span.ty-card-line', `${ROLES[def.role]?.name || ''} · ${def.attackType}${def.base?.canHitAir ? ' · hits flyers' : ''}`),
    h('span.ty-card-line.ty-dim', owned ? 'Yours · plays in the band' : 'Loaner'));
  }

  function beforeClassPanel(p) {
    const maps = h('div.ty-actions', ...pending.maps.map((id) => {
      const b = button(getMap(id)?.name || id, { kind: pending.mapId === id ? 'primary' : 'ghost', small: true, testid: `tryout-map-${id}`, onClick: () => { pending.mapId = id; draw(); } });
      b.setAttribute('aria-pressed', pending.mapId === id ? 'true' : 'false');
      return b;
    }));
    const heroes = h('select.ty-brush', { 'data-testid': 'tryout-hero', onchange: (e) => { pending.hero = e.target.value || null; } },
      ...pending.heroes.map((id) => h('option', { value: id, selected: id === pending.hero }, `${UNIT_MAP[id].name}${isOwned(p, id) ? '' : ' (Loaner)'}`)));
    const ready = pending.pick.length === TRYOUT.squad.start;
    return h('section.panel.ty-hub', { 'data-testid': 'tryout-before-class' },
      h('div.ty-sheet-title', 'Before Class · Half Day · Grade 1'),
      h('p.muted', '7 periods of 4 waves. After each period, pick a Pep Talk; at Recess and Cleaning Time the Window Seats move and you get 3 Hall Passes.'),
      h('b', 'Map'), maps,
      h('b', 'Hero'), h('div.ty-actions', heroes),
      h('b', `Squad · pick ${TRYOUT.squad.start} (${pending.pick.length}/${TRYOUT.squad.start})`),
      h('div.ty-cards', ...pending.draft.map(girlTile)),
      h('div.ty-actions',
        button(`Redraw (${TRYOUT.squad.redraws - pending.redraw})`, {
          kind: 'ghost', small: true, testid: 'tryout-redraw', disabled: pending.redraw >= TRYOUT.squad.redraws,
          onClick: () => {
            pending.redraw++;
            pending.draft = beforeClass(store.profile, pending.seed, 1, pending.redraw).draft;
            pending.pick = [];
            draw();
          },
        }),
        button(ready ? 'Start class' : `Pick ${TRYOUT.squad.start - pending.pick.length} more`, {
          testid: 'tryout-start', icon: 'play', disabled: !ready,
          onClick: () => {
            const rec = newRunRecord(store.profile, { seed: pending.seed, grade: 1, length: 'half', mapId: pending.mapId, hero: pending.hero, squad: pending.pick, simId: SIM_ID });
            putTryoutRun(store.profile, rec);
            store.commit('tryout-run');
            if (!store.saveNow()) toast('This run could not be saved on this device.', 'warn');
            pending = null;
            navigate('battle', { tryout: rec.id });
          },
        })));
  }

  draw();
  return () => {};
}
