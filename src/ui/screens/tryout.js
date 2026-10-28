// Tryout Day hub and Before Class (docs/specs/TRYOUT_DAY.md §10, §13.2, §13.3): the plain screens on today's
// components (the Ink & Paper hub with Wakaba comes in M3). Routes: #/tryout (the hub: Marbles, the Weekly Timetable,
// a share code, then Continue or Before Class), #/tryout/jar (the Marble Jar), #/tryout/yearbook (the Yearbook);
// ?weekly=1 opens the week's timetable, ?code=XXXXX-XXXXX a shared seed as practice.
import '../styles/tryout.css';
import { h, clear, screen, svgEl, button, toast, confirmDialog } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { SIM_ID } from '../../core/buildInfo.js';
import { UNIT_MAP } from '../../data/units.js';
import { ROLES } from '../../data/types.js';
import { getMap } from '../../data/maps.js';
import { TRYOUT } from '../../data/tryout.js';
import { TRYOUT_META } from '../../data/tryoutMeta.js';
import { portraitHTML } from '../../art/portraits.js';
import { isOwned } from '../../systems/unlocks.js';
import {
  tryoutUnlocked, TRYOUT_UNLOCK, halfCleared, TRYOUT_GRADES, gradeOpen, gradeCleared, newRunSeed, beforeClass, newRunRecord, getTryoutRun, putTryoutRun, clearTryoutRun, continueKind,
  activePerks, weeklyState, parseShareCode,
} from '../../systems/tryoutRuns.js';
import { weekState, applyTryoutRecord } from '../../systems/tryoutRewards.js';
import { buildTryoutPlan } from '../../sim/tryout/plan.js';
import { MODE_NAME, LENGTH_NAMES, MARBLES, JAR_TEXT, WEEKLY_TEXT, SHARE_TEXT, rewardLines } from '../text/tryout.js';
import { jarPanel } from './tryoutJar.js';
import { yearbookPanel } from './tryoutYearbook.js';

/** Before Class's choices survive a redraw and a re-render (not a reload: a new seed then). */
let pending = null;

const fmtLeft = (ms) => {
  const hrs = Math.max(0, Math.round(ms / 3600000));
  return hrs >= 48 ? `${Math.round(hrs / 24)} days` : `${hrs} h`;
};

export function render(root, params = {}) {
  // the Make-up Test from the defeat sheet: straight back into the open run (the Continue spends it)
  if (params.makeup && getTryoutRun(store.profile)?.id === params.makeup) {
    queueMicrotask(() => navigate('battle', { tryout: params.makeup }, { replace: true }));
    return () => {};
  }
  const sub = params.id === 'jar' || params.id === 'yearbook' ? params.id : null;
  const { el, body } = screen(sub === 'jar' ? 'Marble Jar' : sub === 'yearbook' ? 'Yearbook' : MODE_NAME, { cls: 'ty-screen' });
  root.appendChild(el);
  const profile = () => store.profile;
  // what this visit opened: a shared code (practice) or the week's timetable; consumed by the first draw
  let ask = params.code ? { code: String(params.code) } : params.weekly ? { weekly: true } : null;

  const draw = () => {
    clear(body);
    const p = profile();
    if (!tryoutUnlocked(p)) {
      body.appendChild(h('section.panel.ty-hub', { 'data-testid': 'tryout-locked' },
        h('b', `Clear ${TRYOUT_UNLOCK} to open ${MODE_NAME}`),
        h('p.muted', 'One school day of defense: pick Pep Talks after every period, take in girls who try out, and move your squad at Recess.')));
      return;
    }
    const hub = () => navigate('tryout', {}, { back: true });
    if (sub === 'jar') return void body.appendChild(jarPanel({ redraw: draw, back: hub }));
    if (sub === 'yearbook') return void body.appendChild(yearbookPanel({ back: hub }));
    const run = getTryoutRun(p);
    if (run) {
      body.appendChild(continueBand(run));
      body.appendChild(walletPanel(p, true));
      return;
    }
    body.appendChild(walletPanel(p, false));
    if (ask) {
      const a = ask;
      ask = null;
      if (a.weekly) startWeekly(p);
      else startCode(p, a.code);
    }
    // a Desk Supply bought or switched in the Jar since: a normal run's Before Class starts over with it
    if (pending?.mode === 'normal' && JSON.stringify(pending.perks) !== JSON.stringify(activePerks(p))) pending = null;
    if (!pending) pending = fresh(p, 'normal');
    body.appendChild(beforeClassPanel(p));
  };

  /** A new Before Class: a normal run (the highest open Grade), the week's timetable, or a shared seed (practice). */
  function fresh(p, mode, fixed = null) {
    const weekly = mode === 'weekly';
    const seed = fixed ? fixed.seed : newRunSeed();
    let grade = fixed ? fixed.grade : 1;
    if (!fixed) for (let g = TRYOUT_GRADES; g > 1; g--) if (gradeOpen(p, g).open) { grade = g; break; }
    const perks = weekly ? {} : activePerks(p);
    const bc = beforeClass(p, seed, grade, 0, { floor: weekly, perks });
    const length = fixed?.length || 'half';
    return {
      ...bc, mode, length, perks, redraw: 0, pick: [], week: fixed?.week ?? null,
      maps: fixed?.mapId ? [fixed.mapId] : bc.maps, mapId: fixed?.mapId || bc.maps[0],
      hero: bc.heroes.includes(p.formation?.hero) ? p.formation.hero : bc.heroes[0],
    };
  }

  function startWeekly(p) {
    const w = weeklyState(p);
    if (!w.open) return toast(WEEKLY_TEXT.locked, 'warn');
    pending = fresh(p, 'weekly', { seed: w.seed, grade: w.grade, length: w.length, mapId: w.mapId, week: w.week });
  }

  function startCode(p, text) {
    const c = parseShareCode(text);
    if (!c) return toast(SHARE_TEXT.bad, 'warn');
    // practice records nothing, so the ladder does not gate it; the Grade's content window still does
    const st = gradeOpen(p, c.grade);
    if (!st.open && st.why !== 'ladder') return toast(SHARE_TEXT.locked, 'warn');
    pending = fresh(p, 'practice', c);
  }

  function walletPanel(p, running) {
    const wk = weekState(p);
    const w = weeklyState(p);
    const codeIn = h('input.ty-code-in', { 'data-testid': 'tryout-code-in', placeholder: SHARE_TEXT.enter, maxlength: 13, 'aria-label': SHARE_TEXT.title });
    const weeklyBtn = button(w.open ? (w.done ? `${WEEKLY_TEXT.name} ✓` : WEEKLY_TEXT.name) : `${WEEKLY_TEXT.name} 🔒`, {
      small: true, kind: w.open && !w.done ? 'primary' : 'ghost', testid: 'tryout-weekly-go', disabled: !w.open || running,
      title: w.open ? `${WEEKLY_TEXT.line} ${w.done ? WEEKLY_TEXT.done : WEEKLY_TEXT.reward}` : WEEKLY_TEXT.locked,
      onClick: () => {
        startWeekly(profile());
        draw();
      },
    });
    // one compact strip (phones: the run's own panel stays near the top): the wallet, then the meta doors
    return h('section.panel.ty-hub.ty-meta', { 'data-testid': 'tryout-hub' },
      h('div.ty-wallet', { 'data-testid': 'tryout-wallet' },
        h('span', h('b', String(wk.marbles)), ` ${MARBLES}`),
        h('span.ty-dim', `${wk.week} / ${wk.cap} this week`),
        h('span.ty-dim', `Lunchboxes ${Math.floor(wk.boxesLeft * 10) / 10} / ${TRYOUT_META.lunchbox.perWeek} left`),
        h('span.ty-dim', `Grade cleared ${gradeCleared(p) || '–'}`)),
      h('div.ty-actions',
        button('Marble Jar', { small: true, testid: 'tryout-open-jar', onClick: () => navigate('tryout', { id: 'jar' }) }),
        button('Yearbook', { small: true, kind: 'ghost', testid: 'tryout-open-yearbook', onClick: () => navigate('tryout', { id: 'yearbook' }) }),
        weeklyBtn,
        h('span.ty-codebox', codeIn, button('Go', {
          small: true, kind: 'ghost', testid: 'tryout-code-go', disabled: running, title: SHARE_TEXT.note,
          onClick: () => {
            startCode(profile(), codeIn.value);
            draw();
          },
        }))),
      h('p.ty-dim.ty-weekly-line', { 'data-testid': 'tryout-weekly' },
        w.open ? `${WEEKLY_TEXT.name}: ${w.done ? `${WEEKLY_TEXT.done}${w.best ? ` Best ${w.best}.` : ''}` : WEEKLY_TEXT.reward} New timetable in ${fmtLeft(w.resetsAt - Date.now())}.` : WEEKLY_TEXT.locked));
  }

  function continueBand(run) {
    const kind = continueKind(run, SIM_ID);
    const plan = buildTryoutPlan(run);
    const len = TRYOUT.lengths[run.length || 'half'] || TRYOUT.lengths.half;
    const note = kind === 'makeup' ? ' · uses your Make-up Test' : kind === 'practice' ? ' · continues as practice' : kind === 'stale' ? ' · closed by an update' : '';
    const tag = Number.isInteger(run.weekly) ? `${WEEKLY_TEXT.name} · ` : run.practice ? 'Practice · ' : '';
    return h('section.panel.ty-hub', { 'data-testid': 'tryout-continue' },
      h('b', `${tag}${LENGTH_NAMES[plan.length] || 'Half Day'} · Grade ${plan.grade} · ${getMap(plan.mapId)?.name || plan.mapId}`),
      h('p', `Period ${Math.ceil(((run.wave || 0) + 1) / len.wavesPerPeriod)} · wave ${(run.wave || 0) + 1} · ♥ ${run.lives ?? TRYOUT.grades[run.grade].hearts}${note}`),
      h('div.ty-squad', ...run.squad.map((id) => svgEl(portraitHTML(UNIT_MAP[id], 'thumb', { eager: true }), 'ty-squad-art'))),
      kind === 'makeup' ? h('p.muted', 'You left during a wave: continuing replays that wave once, and that period\'s assignments no longer count.') : null,
      h('div.ty-actions',
        kind === 'stale' ? null : button('Continue', { testid: 'tryout-go-continue', icon: 'play', onClick: () => navigate('battle', { tryout: run.id }) }),
        button('Give up this run', {
          kind: 'ghost', testid: 'tryout-abandon',
          onClick: async () => {
            if (!(await confirmDialog('Give up this run? It ends here, and the periods you finished are paid.', { title: MODE_NAME, ok: 'Give up', danger: true }))) return;
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
          },
        })));
  }

  function girlTile(id, i) {
    const def = UNIT_MAP[id];
    const picked = pending.pick.includes(id);
    const owned = pending.mode !== 'weekly' && isOwned(profile(), id);
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
    h('span.ty-card-line.ty-dim', owned ? 'Yours · plays in the band' : pending.mode === 'weekly' ? 'At the floor' : 'Loaner'));
  }

  function beforeClassPanel(p) {
    const mode = pending.mode;
    const free = mode === 'normal';
    const maps = h('div.ty-actions', ...pending.maps.map((id) => {
      const b = button(getMap(id)?.name || id, { kind: pending.mapId === id ? 'primary' : 'ghost', small: true, testid: `tryout-map-${id}`, onClick: () => { pending.mapId = id; draw(); } });
      b.setAttribute('aria-pressed', pending.mapId === id ? 'true' : 'false');
      return b;
    }));
    const heroes = h('select.ty-brush', { 'data-testid': 'tryout-hero', onchange: (e) => { pending.hero = e.target.value || null; } },
      ...pending.heroes.map((id) => h('option', { value: id, selected: id === pending.hero }, `${UNIT_MAP[id].name}${isOwned(p, id) && mode !== 'weekly' ? '' : mode === 'weekly' ? ' (at the floor)' : ' (Loaner)'}`)));
    const ready = pending.pick.length === TRYOUT.squad.start;
    const g = TRYOUT.grades[pending.grade];
    const len = TRYOUT.lengths[pending.length] || TRYOUT.lengths.half;
    const grades = free ? h('div.ty-actions', ...Array.from({ length: TRYOUT_GRADES }, (_, i) => {
      const n = i + 1;
      const st = gradeOpen(p, n);
      const b = button(st.open ? `${n}` : `${n} 🔒`, {
        kind: pending.grade === n ? 'primary' : 'ghost', small: true, testid: `tryout-grade-${n}`, disabled: !st.open,
        onClick: () => {
          // a Grade can change the content window: its maps come with it (the draft stays)
          pending.grade = n;
          pending.maps = beforeClass(store.profile, pending.seed, n, pending.redraw, { perks: pending.perks }).maps;
          if (!pending.maps.includes(pending.mapId)) pending.mapId = pending.maps[0];
          draw();
        },
      });
      b.setAttribute('aria-pressed', pending.grade === n ? 'true' : 'false');
      if (!st.open) b.title = st.why === 'window' ? `Needs ${TRYOUT.windows[TRYOUT.grades[n].window].unlock} cleared` : st.why === 'build' ? 'Coming later' : `Clear Grade ${n - 1} first`;
      return b;
    })) : null;
    // Half Day, or a Full Day once a Half Day is cleared (§16 Q3)
    const lengths = free && TRYOUT.lengths.full ? h('div.ty-actions', ...['half', 'full'].map((id) => {
      const locked = id === 'full' && !halfCleared(p);
      const b = button(locked ? `${LENGTH_NAMES[id]} 🔒` : LENGTH_NAMES[id], {
        kind: pending.length === id ? 'primary' : 'ghost', small: true, testid: `tryout-length-${id}`, disabled: locked,
        onClick: () => { pending.length = id; draw(); },
      });
      b.setAttribute('aria-pressed', pending.length === id ? 'true' : 'false');
      if (locked) b.title = 'Clear a Half Day first';
      return b;
    })) : null;
    const perkNames = Object.keys(pending.perks || {}).map((k) => JAR_TEXT[k]?.name || k);
    const title = mode === 'weekly' ? `${WEEKLY_TEXT.name} · Grade ${pending.grade}` : mode === 'practice' ? `Practice · ${LENGTH_NAMES[pending.length]} · Grade ${pending.grade}` : `Before Class · ${LENGTH_NAMES[pending.length]} · Grade ${pending.grade}`;
    return h('section.panel.ty-hub', { 'data-testid': 'tryout-before-class', 'data-mode': mode },
      h('div.ty-sheet-title', title),
      mode === 'weekly' ? h('p.muted', `${WEEKLY_TEXT.line} ${WEEKLY_TEXT.reward}`) : null,
      mode === 'practice' ? h('p.muted', { 'data-testid': 'tryout-practice-note' }, SHARE_TEXT.note) : null,
      free ? h('b', `Grade${gradeCleared(p) ? ` · cleared up to ${gradeCleared(p)}` : ''}`) : null, grades, lengths,
      h('p.muted', `${g.hearts} hearts · ${g.seats} Window Seats · ${g.erasers + (pending.perks?.eraser ? 1 : 0)} Eraser${g.erasers === 1 && !pending.perks?.eraser ? '' : 's'}${g.hpMul > 1 ? ` · foes +${Math.round((g.hpMul - 1) * 100)} % HP` : ''}`),
      h('p.muted', `${len.periods} periods of ${len.wavesPerPeriod} waves. After each period, pick a Pep Talk; at each break the Window Seats move and you get Hall Passes.`),
      perkNames.length ? h('p.muted', { 'data-testid': 'tryout-perks' }, `Desk Supplies: ${perkNames.join(', ')}`) : null,
      h('b', 'Map'), maps,
      h('b', 'Hero'), h('div.ty-actions', heroes),
      h('b', `Squad · pick ${TRYOUT.squad.start} (${pending.pick.length}/${TRYOUT.squad.start})`),
      h('div.ty-cards', ...pending.draft.map(girlTile)),
      h('div.ty-actions',
        button(`Redraw (${TRYOUT.squad.redraws - pending.redraw})`, {
          kind: 'ghost', small: true, testid: 'tryout-redraw', disabled: pending.redraw >= TRYOUT.squad.redraws,
          onClick: () => {
            pending.redraw++;
            pending.draft = beforeClass(store.profile, pending.seed, pending.grade, pending.redraw, { floor: mode === 'weekly', perks: pending.perks }).draft;
            pending.pick = [];
            draw();
          },
        }),
        mode === 'normal' ? null : button('Back to a normal run', {
          kind: 'ghost', small: true, testid: 'tryout-normal',
          onClick: () => {
            pending = fresh(store.profile, 'normal');
            draw();
          },
        }),
        button(ready ? 'Start class' : `Pick ${TRYOUT.squad.start - pending.pick.length} more`, {
          testid: 'tryout-start', icon: 'play', disabled: !ready,
          onClick: () => {
            const rec = newRunRecord(store.profile, {
              seed: pending.seed, grade: pending.grade, length: pending.length, mapId: pending.mapId, hero: pending.hero, squad: pending.pick, simId: SIM_ID,
              perks: pending.perks, ...(mode === 'weekly' ? { weekly: pending.week } : null), ...(mode === 'practice' ? { practice: true, shared: true } : null),
            });
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
