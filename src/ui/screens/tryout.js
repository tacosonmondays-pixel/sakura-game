// Tryout Day hub (docs/specs/TRYOUT_DAY.md §10, §13.2; docs/review/tryout-day/M3_PLAN.md §1): the Ink & Paper hub.
// Wakaba, the track team manager with her clipboard, runs the tryouts: her stand in the left 35% (or, by the collapse
// rule, her chip in the head row) with a line for the state (locked / fresh / run in progress / weekly done). Hub
// tiles: Start (or the Continue band of an open run), Weekly Timetable (its reset countdown in the corner, locked before
// a Grade 4 clear), Marble Jar, Yearbook and Records; under them the share-code box. Marbles sit in the top bar
// (registerWallet, the Tryout routes only).
// Routes: #/tryout (this hub), #/tryout/class (Before Class: ./tryoutSetup.js; ?weekly=1 the week's timetable,
// ?code=XXXXX-XXXXX a shared seed as practice, ?again=1 from the Class Photo), #/tryout/jar (./tryoutJar.js),
// #/tryout/yearbook (./tryoutYearbook.js; ?tab=records opens its Records), ?makeup=<run id> the defeat sheet's
// Make-up Test (straight back into the open run). The battle's "Again" / "Replay this seed" land on #/tryout with
// ?again / ?code: they open Before Class too.
import '../styles/hubs.css';
import '../styles/tryout.css';
import { h, screen, toast, confirmDialog } from '../components.js';
import { hubTile, countdownChip, secondaryBtn, primaryBtn, fillIn } from '../kit.js';
import { girlTile } from '../components.js';
import { hubBackdrop } from '../hubArt.js';
import { hostStand } from '../host.js';
import { hubMode, placeHost, viewport, watchHostMode } from '../hubHost.js';
import { linesFor } from '../hostLines.js';
import { registerWallet, walletDef } from '../wallets.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { SIM_ID } from '../../core/buildInfo.js';
import { UNIT_MAP } from '../../data/units.js';
import { getMap } from '../../data/maps.js';
import { TRYOUT } from '../../data/tryout.js';
import { themeBackdropSVG } from '../../art/backdrops.js';
import { isOwned } from '../../systems/unlocks.js';
import {
  tryoutUnlocked, TRYOUT_UNLOCK, TRYOUT_GRADES, gradeOpen, gradeCleared, getTryoutRun, clearTryoutRun, continueKind, weeklyState, parseShareCode,
} from '../../systems/tryoutRuns.js';
import { weekState, marbles, applyTryoutRecord } from '../../systems/tryoutRewards.js';
import { yearbookPages } from '../../systems/tryoutYearbook.js';
import { buildTryoutPlan } from '../../sim/tryout/plan.js';
import { MODE_NAME, LENGTH_NAMES, MARBLES, WEEKLY_TEXT, SHARE_TEXT, HUB_TEXT, rewardLines } from '../text/tryout.js';
import { renderSetup } from './tryoutSetup.js';
import { renderJar, tyIco } from './tryoutJar.js';
import { renderYearbook } from './tryoutYearbook.js';

/** The Continue band's tiles: the hero and four girls (the rest as "+n"). */
const SQUAD_SHOWN = 5;

/** Wakaba hosts the tryouts (hosts.js has no Tryout row yet: the hub builds her stand itself, as hubHost would). */
export const TRYOUT_HOST = 'wakaba';

// Marbles in the top bar on the Tryout routes (once, at module load; a hot reload keeps the first registration). They
// live in the mission counters, not profile.items: the bar reads them through count(profile) (a read-only view).
if (!walletDef('marbles')) registerWallet({ id: 'marbles', count: (p) => marbles(p), label: MARBLES, glyph: 'marble', screens: ['tryout'] });

/** Pure: the hub's state for Wakaba's lines and the tiles (hostLines.js `tryout`). */
export function hubState(profile, now = Date.now()) {
  const locked = !tryoutUnlocked(profile);
  const w = weeklyState(profile, now);
  return {
    locked, unlock: TRYOUT_UNLOCK, running: !locked && !!getTryoutRun(profile),
    weeklyOpen: !locked && w.open, weeklyDone: !locked && w.open && w.done,
  };
}

/** The hub's state word (data-state on the hub, for tests and styles). */
export const stateWord = (s) => (s.locked ? 'locked' : s.running ? 'run' : s.weeklyDone ? 'weekly-done' : 'fresh');

/** A tile's picture: a drawn scene with one big line glyph over it. */
function tileArt(theme, glyph) {
  return h('span.ty-tile-art',
    h('span.ty-tile-scene', { html: themeBackdropSVG(theme) }),
    glyph ? tyIco(glyph, 'ty-tile-glyph') : null);
}

export function render(root, params = {}) {
  const p0 = store.profile;
  // the Make-up Test from the defeat sheet: straight back into the open run (the Continue spends it)
  if (params.makeup && getTryoutRun(p0)?.id === params.makeup) {
    queueMicrotask(() => navigate('battle', { tryout: params.makeup }, { replace: true }));
    return () => {};
  }
  if (tryoutUnlocked(p0)) {
    if (params.id === 'jar') return renderJar(root, params);
    if (params.id === 'yearbook') return renderYearbook(root, params);
    if (!getTryoutRun(p0) && (params.id === 'class' || params.code || params.weekly || params.again)) return renderSetup(root, params);
  }
  return renderHub(root);
}

function renderHub(root) {
  const { el, body } = screen(MODE_NAME, { cls: 'ty-screen ty-hub-screen hb-screen' });
  el.insertBefore(hubBackdrop('tryout'), el.firstChild);
  root.appendChild(el);

  let drawn = hubMode(viewport());
  const host = hostStand(UNIT_MAP[TRYOUT_HOST], { lines: linesFor('tryout', hubState(store.profile)), kind: 'hub', mode: drawn, testid: 'host' });
  const head = h('div.ty-hub-head');
  const grid = h('div.ty-hub-grid');
  const code = h('div.ty-hub-code');
  const main = h('div.hb-main.ty-hub-main', { 'data-testid': 'tryout-hub' }, head, grid, code);
  const hb = h('div.hb.ty-hb', main);
  body.append(hb);
  placeHost(host, drawn, { hb, slot: head });
  const offResize = watchHostMode(el, () => drawn, () => hubMode(viewport()), () => {
    drawn = hubMode(viewport());
    placeHost(host, drawn, { hb, slot: head });
  });

  const draw = () => {
    const p = store.profile;
    const st = hubState(p);
    main.dataset.state = stateWord(st);
    host.setLines(linesFor('tryout', st));
    const run = st.running ? getTryoutRun(p) : null;
    const lock = st.locked ? HUB_TEXT.locked(TRYOUT_UNLOCK) : null;
    const lockedTap = () => toast(HUB_TEXT.lockedWhy(TRYOUT_UNLOCK), 'info');
    const w = weeklyState(p);
    const wk = weekState(p);
    const yb = st.locked ? null : yearbookPages(p);

    // Start (or the open run's Continue band in its place)
    const len = LENGTH_NAMES.half;
    let grade = 1;
    if (!st.locked) for (let g = TRYOUT_GRADES; g > 1; g--) if (gradeOpen(p, g).open) { grade = g; break; }
    const first = run ? continueBand(run) : hubTile({
      title: HUB_TEXT.start, kicker: st.locked ? null : HUB_TEXT.startKicker(len, grade), line: st.locked ? HUB_TEXT.pitch : HUB_TEXT.startLine,
      art: tileArt('sakura', 'desk'), lock, testid: 'tryout-tile-start', cls: 'ty-tile-start',
      onClick: st.locked ? lockedTap : () => navigate('tryout', { id: 'class' }),
    });

    // the Weekly Timetable: its reset in the corner (a weekly cycle: never red), locked before a Grade 4 clear
    const weeklyLock = st.locked ? lock : !w.open ? HUB_TEXT.weeklyLocked : null;
    const weekly = hubTile({
      title: WEEKLY_TEXT.name, sm: true,
      line: weeklyLock ? null : w.done ? HUB_TEXT.weeklyDone(w.best) : HUB_TEXT.weeklyOpen,
      corner: weeklyLock ? null : countdownChip(w.resetsAt - Date.now(), { label: HUB_TEXT.weeklyResets, urgent: false, testid: 'tryout-weekly-cd', onDone: () => draw() }),
      art: tileArt('campus', 'weekly'), lock: weeklyLock, testid: 'tryout-weekly-go', cls: 'ty-tile-weekly',
      label: weeklyLock ? `${WEEKLY_TEXT.name}: ${st.locked ? HUB_TEXT.lockedWhy(TRYOUT_UNLOCK) : WEEKLY_TEXT.locked}` : null,
      onClick: () => {
        if (st.locked) return lockedTap();
        if (!w.open) return toast(WEEKLY_TEXT.locked, 'info');
        if (run) return toast(HUB_TEXT.runOpen, 'info');
        navigate('tryout', { id: 'class', weekly: 1 });
      },
    });
    weekly.dataset.state = weeklyLock ? 'locked' : w.done ? 'done' : 'open';

    const jar = hubTile({
      title: HUB_TEXT.jar, sm: true, line: st.locked ? null : HUB_TEXT.jarLine(wk.week, wk.cap), art: tileArt('festival', 'marble'), lock,
      testid: 'tryout-open-jar', cls: 'ty-tile-jar', onClick: st.locked ? lockedTap : () => navigate('tryout', { id: 'jar' }),
    });
    const girlsIn = yb ? yb.girls.filter((g) => g.stamped).length : 0;
    const book = hubTile({
      title: HUB_TEXT.yearbook, sm: true, line: yb ? HUB_TEXT.yearbookLine(girlsIn, yb.girls.length, yb.stamps) : null, art: tileArt('shrine', 'book'), lock,
      testid: 'tryout-open-yearbook', cls: 'ty-tile-yearbook', onClick: st.locked ? lockedTap : () => navigate('tryout', { id: 'yearbook' }),
    });
    const best = yb ? Math.max(0, ...yb.records.map((r) => r.score)) : 0;
    const records = hubTile({
      title: HUB_TEXT.records, sm: true, line: st.locked ? null : HUB_TEXT.recordsLine(gradeCleared(p), best), art: tileArt('arena', 'trophy'), lock,
      testid: 'tryout-open-records', cls: 'ty-tile-records', onClick: st.locked ? lockedTap : () => navigate('tryout', { id: 'yearbook', tab: 'records' }),
    });
    for (const t of [first, jar, book, records]) if (t.classList.contains('ui-hubtile')) t.dataset.state = t.classList.contains('locked') ? 'locked' : 'open';
    grid.classList.toggle('run', !!run);
    fillIn(grid, first, weekly, jar, book, records);
    fillIn(code, st.locked ? null : codeBox(!!run));
  };

  /** The share-code box: a code from a friend's Class Photo plays as practice. */
  function codeBox(running) {
    const input = h('input', { type: 'text', 'data-testid': 'tryout-code-in', placeholder: SHARE_TEXT.enter, maxlength: 13, 'aria-label': SHARE_TEXT.title, autocomplete: 'off', spellcheck: false });
    const go = () => {
      if (running) return toast(HUB_TEXT.runOpen, 'info');
      const c = parseShareCode(input.value);
      if (!c) return toast(SHARE_TEXT.bad, 'warn');
      navigate('tryout', { id: 'class', code: input.value.trim().toUpperCase() });
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    return [
      h('span.lbl.ty-code-lbl', SHARE_TEXT.title),
      h('label.ui-input.ty-code-in', input),
      secondaryBtn(HUB_TEXT.codeGo, { testid: 'tryout-code-go', title: SHARE_TEXT.note, onClick: go }),
      h('span.ty-code-note', SHARE_TEXT.note),
    ];
  }

  /** The open run: its squad as small girl tiles, one line, Continue (the one yellow) and Give up. */
  function continueBand(run) {
    const kind = continueKind(run, SIM_ID);
    const plan = buildTryoutPlan(run);
    const len = TRYOUT.lengths[run.length || 'half'] || TRYOUT.lengths.half;
    const note = kind === 'makeup' ? HUB_TEXT.makeup : kind === 'practice' ? HUB_TEXT.practice : kind === 'stale' ? HUB_TEXT.stale : null;
    const tag = Number.isInteger(run.weekly) ? `${WEEKLY_TEXT.name} · ` : run.practice ? 'Practice · ' : '';
    let mapName = plan.mapId;
    try {
      mapName = getMap(plan.mapId).name;
    } catch { /* (an unknown map id: its id) */ }
    const p = store.profile;
    // the hero and the first girls as small tiles (one row on a phone), the rest as a count
    const ids = [run.hero?.unitId, ...run.squad].filter((id) => UNIT_MAP[id]);
    const squad = ids.slice(0, SQUAD_SHOWN).map((id) => girlTile(id, {
      owned: true, potential: isOwned(p, id) ? undefined : 0, level: null, cls: 'ty-sq', testid: null,
    }));
    for (const t of squad) t.tabIndex = -1;
    if (ids.length > SQUAD_SHOWN) squad.push(h('span.ui-chip.ink.ty-cont-n', { title: ids.slice(SQUAD_SHOWN).map((id) => UNIT_MAP[id].name).join(', ') }, `+${ids.length - SQUAD_SHOWN}`));
    const line = HUB_TEXT.continueLine(Math.ceil(((run.wave || 0) + 1) / len.wavesPerPeriod), (run.wave || 0) + 1, run.lives ?? TRYOUT.grades[run.grade]?.hearts ?? '');
    const primary = kind === 'stale' ? null : primaryBtn(HUB_TEXT.continueGo, { icon: 'play', testid: 'tryout-go-continue', onClick: () => navigate('battle', { tryout: run.id }) });
    return h('section.ui-panel.ty-cont', { 'data-testid': 'tryout-continue', 'data-kind': kind },
      h('div.ty-cont-squad', { 'aria-label': 'Squad' }, squad),
      h('div.ty-cont-body',
        h('span.lbl.ty-cont-kicker', `${tag}${LENGTH_NAMES[plan.length] || LENGTH_NAMES.half} · Grade ${plan.grade} · ${mapName}`),
        h('b.ty-cont-title', HUB_TEXT.continueTitle),
        h('p.ty-cont-line', line, note ? h('span.ty-cont-note', ` · ${note}`) : null),
        kind === 'makeup' ? h('p.ty-cont-more', HUB_TEXT.makeupLine) : kind === 'stale' ? h('p.ty-cont-more', HUB_TEXT.staleLine) : null,
        h('div.ty-cont-acts',
          secondaryBtn(HUB_TEXT.giveUp, { testid: 'tryout-abandon', onClick: () => giveUp(run) }),
          primary)));
  }

  async function giveUp(run) {
    if (!(await confirmDialog(HUB_TEXT.giveUpAsk, { title: MODE_NAME, ok: 'Give up', danger: true }))) return;
    const cur = getTryoutRun(store.profile);
    if (!cur || cur.id !== run.id) return draw();
    // paid from its last calm point (§12.4), deleted in the same write
    let out = null;
    try {
      out = applyTryoutRecord(store.profile, cur);
    } catch (e) {
      console.error('[tryout] paying a given-up run failed', e);
    }
    clearTryoutRun(store.profile, run.id);
    store.commit('tryout-run');
    store.saveNow();
    const line = rewardLines(out?.run).find((l) => l.key === 'marbles');
    if (out?.run && (out.run.marbles?.paid || out.run.box?.fill)) toast(`Run over. ${line ? line.text : ''}`, 'good');
    draw();
  }

  draw();
  return () => offResize();
}
