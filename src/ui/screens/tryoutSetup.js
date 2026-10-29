// Tryout Day: Before Class (docs/specs/TRYOUT_DAY.md §13.3; docs/review/tryout-day/M3_PLAN.md §1), split out of the hub.
// Route #/tryout/class (the hub's Start tile), ?weekly=1 (the week's timetable, everyone at the floor), ?code=… (a
// shared seed: practice), ?again=1 (the Class Photo's Again). The Grade row (a segRow 1-12: a locked Grade says why in
// the line under it, where the Grade's twist line sits), Half / Full Day, the seed's two maps as cards with their
// thumbnails, the six (seven with Bigger Draft) as girl tiles (tap 3; "Yours · band cap" or "Loaner" on an ink chip
// above the caption), one Redraw, the hero picker, and Start class: the one yellow, with the reason when it waits.
// The timetable strip (one slim row under the Grade row) previews each period; the Grade's line sits in the head.
import '../styles/tryout.css';
import { h, screen, toast, girlTile, svgEl } from '../components.js';
import { segRow, secondaryBtn, primaryBtn, ico, fillIn } from '../kit.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { SIM_ID } from '../../core/buildInfo.js';
import { UNIT_MAP } from '../../data/units.js';
import { getMap } from '../../data/maps.js';
import { TRYOUT } from '../../data/tryout.js';
import { portraitHTML } from '../../art/portraits.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { isOwned } from '../../systems/unlocks.js';
import {
  TRYOUT_GRADES, gradeOpen, gradeCleared, newRunSeed, beforeClass, newRunRecord, putTryoutRun, activePerks, weeklyState, parseShareCode,
  practiceOpen, RUN_LENGTHS, lengthOpen,
} from '../../systems/tryoutRuns.js';
import { LENGTH_NAMES, JAR_TEXT, WEEKLY_TEXT, SHARE_TEXT, CLASS_TEXT, EXTENDED_TEXT, RANDOM_TEXT, gradeTwist, gradeWhy } from '../text/tryout.js';
import { beforeClassTimetable, closeBeforeClassTimetable } from '../battle/tryout/timetable.js';
import { fullTag } from './tryoutTag.js';

/** Before Class's choices survive a redraw and a re-render (not a reload: a new seed then). */
let pending = null;

/**
 * The run options a Before Class shows and starts with (§20.8): Extended Day and Random Class only on a normal day
 * (the Weekly and a shared code play a fixed Half or Full Day, Random Class off, §20.6).
 * @param {{ mode: string, length: string, random?: boolean }} pend
 * @returns {{ length: string, random: boolean }}
 */
export function setupOptions(pend) {
  const normal = pend?.mode === 'normal';
  const length = pend?.length === 'full' || (normal && pend?.length === 'after') ? pend.length : 'half';
  return { length, random: normal && pend?.random === true };
}

/**
 * Why Start class waits (null: it may start). Random Class needs no picks: the Sim draws the three (§20.4).
 * @param {{ pick: string[], random?: boolean, mode: string }} pend
 * @param {number} start the squad's starting size
 */
export function startWhy(pend, start) {
  if (setupOptions(pend).random) return null;
  const n = pend?.pick?.length || 0;
  return n === start ? null : CLASS_TEXT.pickMore(start - n);
}

/** The New Run record's options from a Before Class (newRunRecord's arguments past the profile). */
export function startArgs(pend, { simId = null } = {}) {
  const { length, random } = setupOptions(pend);
  return {
    seed: pend.seed, grade: pend.grade, length, mapId: pend.mapId, hero: pend.hero, squad: random ? [] : pend.pick.slice(), simId,
    perks: pend.perks, ...(random ? { random: true } : null),
    ...(pend.mode === 'weekly' ? { weekly: pend.week } : null), ...(pend.mode === 'practice' ? { practice: true, shared: true } : null),
  };
}

/** The theme words of a map card ("Sakura · 2 roads"). */
const THEME_WORDS = { sakura: 'Sakura', lake: 'Lakeshore', shrine: 'Shrine', mountain: 'Mountain', marsh: 'Marsh', foundry: 'Foundry', festival: 'Festival', volcano: 'Volcano', snow: 'Snow', night: 'Night', arena: 'Arena', city: 'City', campus: 'Campus' };

function mapOf(id) {
  try {
    return getMap(id);
  } catch {
    return null;
  }
}

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
    ...bc, mode, length, perks, redraw: 0, pick: [], week: fixed?.week ?? null, random: false,
    maps: fixed?.mapId ? [fixed.mapId] : bc.maps, mapId: fixed?.mapId || bc.maps[0],
    hero: bc.heroes.includes(p.formation?.hero) ? p.formation.hero : bc.heroes[0],
  };
}

/**
 * @param {HTMLElement} root
 * @param {{ weekly?: any, code?: string, again?: any }} params
 */
export function renderSetup(root, params = {}) {
  const { el, body } = screen(CLASS_TEXT.title, { cls: 'ty-screen ty-class-screen' });
  root.appendChild(el);
  const profile = () => store.profile;
  const panel = h('section.ui-panel.ty-bc', { 'data-testid': 'tryout-before-class' });
  body.appendChild(panel);
  /** The Grade's line (in the head, over the Grade row): the chosen Grade's twist, or why a tapped Grade is locked. */
  let why = null;

  // what this visit opened: the week's timetable or a shared code (practice); else a normal run
  const p0 = profile();
  // (Start, a bad or locked code and a locked Weekly never reopen a Weekly or practice draft: a normal day instead. M3
  // review and fix check M3)
  const dropDraft = () => {
    if (pending && pending.mode !== 'normal') pending = null;
  };
  if (params.weekly) {
    const w = weeklyState(p0);
    if (w.open) pending = fresh(p0, 'weekly', { seed: w.seed, grade: w.grade, length: w.length, mapId: w.mapId, week: w.week });
    else {
      toast(WEEKLY_TEXT.locked, 'warn');
      dropDraft();
    }
  } else if (params.code) {
    const c = parseShareCode(String(params.code));
    // practice records nothing, so the ladder does not gate it; the Grade's content window still does (checked
    // directly: a Grade 12 code never opens for a player who has only Spring Term)
    if (!c || !practiceOpen(p0, c.grade)) {
      toast(c ? SHARE_TEXT.locked : SHARE_TEXT.bad, 'warn');
      dropDraft();
    } else pending = fresh(p0, 'practice', c);
  } else dropDraft();
  // a Desk Supply bought or switched in the Jar since: a normal run's Before Class starts over with it
  if (pending?.mode === 'normal' && JSON.stringify(pending.perks) !== JSON.stringify(activePerks(p0))) pending = null;
  if (!pending) pending = fresh(p0, 'normal');

  const draw = () => {
    const p = profile();
    const mode = pending.mode;
    const free = mode === 'normal';
    const g = TRYOUT.grades[pending.grade];
    const opts = setupOptions(pending);
    const len = TRYOUT.lengths[opts.length === 'after' ? 'full' : opts.length] || TRYOUT.lengths.half;
    const start = TRYOUT.squad.start;
    const waitWhy = startWhy(pending, start);
    const ready = !waitWhy;
    panel.dataset.mode = mode;
    panel.dataset.length = opts.length;
    panel.dataset.random = opts.random ? 'on' : 'off';

    // ---- the head: what kind of day this is
    const title = mode === 'weekly' ? `${WEEKLY_TEXT.name} · Grade ${pending.grade}`
      : mode === 'practice' ? `Practice · ${LENGTH_NAMES[pending.length]} · Grade ${pending.grade}`
        : `${LENGTH_NAMES[pending.length]} · Grade ${pending.grade}${opts.random ? ` · ${RANDOM_TEXT.name}` : ''}`;
    const head = h('div.ty-bc-head',
      h('h2.ty-bc-title', title),
      mode === 'weekly' ? h('p.ty-bc-note', `${WEEKLY_TEXT.line} ${WEEKLY_TEXT.reward}`) : null,
      mode === 'practice' ? h('p.ty-bc-note', { 'data-testid': 'tryout-practice-note' }, SHARE_TEXT.note) : null,
      free ? null : secondaryBtn(CLASS_TEXT.normal, {
        testid: 'tryout-normal', icon: 'back',
        onClick: () => {
          pending = fresh(profile(), 'normal');
          why = null;
          draw();
        },
      }));

    // ---- the Grade row (a normal run picks; the Weekly and a shared seed are fixed) and the length
    let gradeBox = null;
    // Random Class (§20.4, a normal day only): the switch rides in the squad's row, its help line in the foot (both cost
    // no row of their own: the six stay above the foot at 844 x 390 and 1280 x 720)
    let randomSwitch = null;
    if (free) {
      const items = Array.from({ length: TRYOUT_GRADES }, (_, i) => {
        const n = i + 1;
        const st = gradeOpen(p, n);
        const reason = st.open ? null : gradeWhy(st.why, n, TRYOUT.windows[TRYOUT.grades[n]?.window]?.unlock || '');
        return { id: String(n), label: String(n), locked: !st.open, title: reason || `Grade ${n}`, why: reason };
      });
      const grades = segRow(items, String(pending.grade), (id, it) => {
        if (it.locked) {
          why = it.why;
          return paintLine();
        }
        why = null;
        const n = Number(id);
        if (n === pending.grade) return paintLine();
        // a Grade can change the content window: its maps come with it (the draft stays)
        pending.grade = n;
        pending.maps = beforeClass(store.profile, pending.seed, n, pending.redraw, { perks: pending.perks }).maps;
        if (!pending.maps.includes(pending.mapId)) pending.mapId = pending.maps[0];
        draw();
      }, { label: CLASS_TEXT.grade, testidPrefix: 'tryout-grade-', min: 40, cls: 'ty-bc-grades' });
      // Half Day · Full Day · Extended Day (§20.8): a length waits for the clear before it (halfCleared, fullCleared)
      const lengths = TRYOUT.lengths.full ? segRow(RUN_LENGTHS.map((id) => {
        const st = lengthOpen(p, id);
        const reason = st.why === 'full' ? EXTENDED_TEXT.locked : CLASS_TEXT.full;
        return { id, label: LENGTH_NAMES[id], locked: !st.open, title: st.open ? LENGTH_NAMES[id] : reason, why: reason };
      }), pending.length, (id, it) => {
        if (it.locked) {
          why = it.why;
          return paintLine();
        }
        why = null;
        pending.length = id;
        draw();
      }, { label: CLASS_TEXT.length, testidPrefix: 'tryout-length-', min: 76, cls: 'ty-bc-lengths' }) : null;
      randomSwitch = h(`button.ui-opt.ty-switch.ty-bc-random${opts.random ? '.on' : ''}`, {
        type: 'button', 'data-testid': 'tryout-random', 'aria-pressed': opts.random ? 'true' : 'false',
        'aria-label': `${RANDOM_TEXT.name}: ${opts.random ? RANDOM_TEXT.on : RANDOM_TEXT.off}`, 'aria-describedby': 'ty-bc-random-help',
        onclick: () => {
          pending.random = !opts.random;
          draw();
        },
      }, h('span.ty-switch-knob', { 'aria-hidden': 'true' }), h('span', RANDOM_TEXT.name));
      // the Grade's line (its twist, or why a tapped Grade is locked) sits in the head beside the title, right over the
      // Grade row; the timetable strip takes the line's old place under the row, one slim row (the six stay above the
      // foot, R2 review)
      head.append(line);
      if (lengths) head.append(lengths);
      gradeBox = h('div.ty-bc-gradebox',
        h('div.ty-bc-row.ty-bc-graderow', h('span.lbl.ty-bc-lbl', `${CLASS_TEXT.grade}${gradeCleared(p) ? ` · cleared ${gradeCleared(p)}` : ''}`), grades),
        beforeClassTimetable(pending));
    }

    // ---- the maps: the seed's two, as cards with their thumbnails
    const maps = h('div.ty-bc-maps', { role: 'radiogroup', 'aria-label': CLASS_TEXT.maps },
      ...pending.maps.map((id) => {
        const m = mapOf(id);
        const on = pending.mapId === id;
        return h(`button.ui-panel.ty-map${on ? '.on' : ''}`, {
          type: 'button', role: 'radio', 'data-testid': `tryout-map-${id}`, 'aria-checked': on ? 'true' : 'false', 'aria-pressed': on ? 'true' : 'false',
          onclick: () => {
            if (pending.mapId === id) return;
            pending.mapId = id;
            draw();
          },
        },
        h('span.ty-map-thumb', { 'aria-hidden': 'true', html: m ? stageThumbSVG(m, { width: 320, height: 200 }) : '' }),
        h('span.ty-map-txt', h('b.ty-map-name', m?.name || id), h('span.ty-map-line', `${THEME_WORDS[m?.theme] || ''}${m?.tracks ? ` · ${CLASS_TEXT.roads(m.tracks.length)}` : ''}`)));
      }));

    // ---- the six: tap 3 (a girl tile each; the kit's tag chip above her caption: one short word, the full words in its
    // title and her spoken name. Every draft tile is drawn as owned, a Loaner too, so the tag shows on each)
    // (Random Class: the six the Sim draws from, its first draw's, never a Redraw's or Bigger Draft's; shown, not
    // pickable: the class draws the three at the bell, §20.4)
    const six = opts.random ? beforeClass(p, pending.seed, pending.grade, 0, { perks: null }).draft : pending.draft;
    const tiles = six.map((id, i) => {
      const picked = !opts.random && pending.pick.includes(id);
      const mine = mode !== 'weekly' && isOwned(p, id);
      const full = mode === 'weekly' ? CLASS_TEXT.floor : mine ? CLASS_TEXT.yours : CLASS_TEXT.loaner;
      const short = mode === 'weekly' ? CLASS_TEXT.floorShort : mine ? CLASS_TEXT.yoursShort : CLASS_TEXT.loaner;
      const t = girlTile(id, {
        owned: true, selected: picked, potential: mine ? undefined : 0, level: mine ? p.units?.[id]?.level ?? null : null, tag: short, testid: `tryout-draft-${i}`, cls: 'ty-draft',
        onClick: () => {
          if (opts.random) return;
          if (pending.pick.includes(id)) pending.pick = pending.pick.filter((x) => x !== id);
          else if (pending.pick.length < start) pending.pick.push(id);
          else return toast(`Pick exactly ${start}. Tap a picked girl to put her back first.`, 'info');
          draw();
        },
      });
      if (opts.random) {
        t.classList.add('ty-drawn');
        t.setAttribute('aria-disabled', 'true');
        t.tabIndex = -1;
      } else t.setAttribute('aria-pressed', picked ? 'true' : 'false');
      fullTag(t, short, full);
      return t;
    });
    const redraws = TRYOUT.squad.redraws - pending.redraw;
    const redraw = secondaryBtn(redraws > 0 ? CLASS_TEXT.redraw(redraws) : CLASS_TEXT.redrawn, {
      icon: 'refresh', testid: 'tryout-redraw', disabled: redraws <= 0,
      onClick: () => {
        pending.redraw++;
        pending.draft = beforeClass(store.profile, pending.seed, pending.grade, pending.redraw, { floor: mode === 'weekly', perks: pending.perks }).draft;
        pending.pick = [];
        draw();
      },
    });
    const squadLbl = opts.random ? RANDOM_TEXT.squad : CLASS_TEXT.squad(pending.pick.length, start);
    const squad = h(`div.ty-bc-squad${opts.random ? '.random' : ''}`,
      h('div.ty-bc-row', h('span.lbl.ty-bc-lbl', { 'data-testid': 'tryout-squad-label' }, squadLbl), opts.random ? null : redraw, randomSwitch),
      h('div.ty-bc-six', { role: 'group', 'aria-label': opts.random ? `${squadLbl}. ${RANDOM_TEXT.six}` : squadLbl, 'data-n': String(tiles.length), 'data-testid': 'tryout-six' }, tiles));

    // ---- the hero picker: one option each (her portrait, name and whose she is)
    const heroes = h('div.ty-bc-heroes', { role: 'radiogroup', 'aria-label': CLASS_TEXT.hero, 'data-testid': 'tryout-hero' },
      ...pending.heroes.map((id) => {
        const u = UNIT_MAP[id];
        const on = pending.hero === id;
        const whose = mode === 'weekly' ? CLASS_TEXT.floor : isOwned(p, id) ? CLASS_TEXT.heroYours : CLASS_TEXT.heroFree;
        return h(`button.ui-opt.ty-hero${on ? '.on' : ''}`, {
          type: 'button', role: 'radio', 'data-testid': `tryout-hero-${id}`, 'aria-checked': on ? 'true' : 'false', 'aria-label': `${u?.name || id}, ${whose}`,
          onclick: () => {
            pending.hero = id;
            draw();
          },
        }, svgEl(portraitHTML(u, 'thumb', { eager: true }), 'ty-hero-art'), h('span.ty-hero-txt', h('b', u?.name || id), h('span.ty-hero-whose', whose)));
      }));

    // ---- the foot: the facts, the Desk Supplies, Start class (the one yellow) with its reason
    const perkNames = Object.keys(pending.perks || {}).map((k) => JAR_TEXT[k]?.name || k);
    // (Random Class: no Erasers, §20.4)
    const erasers = opts.random ? 0 : g.erasers + (pending.perks?.eraser ? 1 : 0);
    const startBtn = primaryBtn(CLASS_TEXT.start, {
      icon: 'play', testid: 'tryout-start', disabled: !ready, reason: waitWhy,
      onClick: () => {
        const args = startArgs(pending, { simId: SIM_ID });
        const rec = newRunRecord(store.profile, args);
        // (the run's options ride on its record for the Sim's config, src/ui/battle/setup.js createTryoutSim)
        rec.length = args.length;
        if (args.random) rec.random = true;
        putTryoutRun(store.profile, rec);
        store.commit('tryout-run');
        if (!store.saveNow()) toast('This run could not be saved on this device.', 'warn');
        pending = null;
        navigate('battle', { tryout: rec.id });
      },
    });
    // (the kit's reason line beside a disabled primary: the e2e reads it by its test id)
    startBtn.querySelector?.('.ui-sec-why')?.setAttribute('data-testid', 'tryout-start-why');
    const foot = h('div.ty-bc-foot',
      h('div.ty-bc-facts',
        h('span.ty-bc-fact', opts.length === 'after' ? EXTENDED_TEXT.facts(g, erasers) : CLASS_TEXT.facts(g, len, erasers)),
        // (what Random Class promises, plainly; the short words on a short screen)
        free ? h('span.ty-bc-random-help', { id: 'ty-bc-random-help', 'data-testid': 'tryout-random-help' },
          h('span.long', RANDOM_TEXT.help), h('span.short', RANDOM_TEXT.helpShort)) : null,
        perkNames.length ? h('span.ty-bc-fact', { 'data-testid': 'tryout-perks' }, CLASS_TEXT.perks(perkNames)) : null),
      h('div.ty-bc-go', startBtn));

    fillIn(panel, head,
      // [timetable strip] (a Weekly or practice day: on its own row, no Grade row above it)
      gradeBox || beforeClassTimetable(pending),
      h('div.ty-bc-cols',
        h('div.ty-bc-col.ty-bc-col-maps', h('span.lbl.ty-bc-lbl', CLASS_TEXT.maps), maps),
        h('div.ty-bc-col.ty-bc-col-squad', squad),
        h('div.ty-bc-col.ty-bc-col-hero', h('span.lbl.ty-bc-lbl', CLASS_TEXT.hero), heroes)),
      foot);
    paintLine();
  };

  /** The line under the Grade row: why a tapped Grade is locked, else the chosen Grade's twist. */
  const line = h('p.ty-bc-twist', { 'data-testid': 'tryout-grade-line', 'aria-live': 'polite' });
  function paintLine() {
    line.classList.toggle('why', !!why);
    // (replaceChildren prints a null child as the text "null": only real nodes go in)
    line.replaceChildren(...[why ? ico('lock') : null, h('span', why || gradeTwist(TRYOUT.grades, TRYOUT.windows, pending.grade))].filter(Boolean));
  }

  draw();
  // leaving: an open timetable preview lets go of its listeners (the next screen's first Escape is its own)
  const cleanup = () => closeBeforeClassTimetable();
  cleanup.stop = cleanup;
  return cleanup;
}
