// Tryout Day: Before Class (docs/specs/TRYOUT_DAY.md §13.3; docs/review/tryout-day/M3_PLAN.md §1), split out of the hub.
// Route #/tryout/class (the hub's Start tile), ?weekly=1 (the week's timetable, everyone at the floor), ?code=… (a
// shared seed: practice), ?again=1 (the Class Photo's Again). The Grade row (a segRow 1-12: a locked Grade says why in
// the line under it, where the Grade's twist line sits), Half / Full Day, the seed's two maps as cards with their
// thumbnails, the six (seven with Bigger Draft) as girl tiles (tap 3; "Yours · band cap" or "Loaner" on an ink chip
// above the caption), one Redraw, the hero picker, and Start class: the one yellow, with the reason when it waits.
import '../styles/tryout.css';
import { h, screen, toast, girlTile, svgEl } from '../components.js';
import { segRow, secondaryBtn, ico, fillIn } from '../kit.js';
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
  halfCleared, TRYOUT_GRADES, gradeOpen, gradeCleared, newRunSeed, beforeClass, newRunRecord, putTryoutRun, activePerks, weeklyState, parseShareCode,
} from '../../systems/tryoutRuns.js';
import { LENGTH_NAMES, JAR_TEXT, WEEKLY_TEXT, SHARE_TEXT, CLASS_TEXT, gradeTwist, gradeWhy } from '../text/tryout.js';
import { paintMarblesPill } from './tryout.js';

/** Before Class's choices survive a redraw and a re-render (not a reload: a new seed then). */
let pending = null;

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
    ...bc, mode, length, perks, redraw: 0, pick: [], week: fixed?.week ?? null,
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
  const offPill = paintMarblesPill(el);
  const profile = () => store.profile;
  const panel = h('section.ui-panel.ty-bc', { 'data-testid': 'tryout-before-class' });
  body.appendChild(panel);
  /** The line under the Grade row: the chosen Grade's twist, or why a tapped Grade is locked. */
  let why = null;

  // what this visit opened: the week's timetable or a shared code (practice); else a normal run
  const p0 = profile();
  if (params.weekly) {
    const w = weeklyState(p0);
    if (w.open) pending = fresh(p0, 'weekly', { seed: w.seed, grade: w.grade, length: w.length, mapId: w.mapId, week: w.week });
    else toast(WEEKLY_TEXT.locked, 'warn');
  } else if (params.code) {
    const c = parseShareCode(String(params.code));
    // practice records nothing, so the ladder does not gate it; the Grade's content window still does
    const st = c ? gradeOpen(p0, c.grade) : null;
    if (!c) toast(SHARE_TEXT.bad, 'warn');
    else if (!st.open && st.why !== 'ladder') toast(SHARE_TEXT.locked, 'warn');
    else pending = fresh(p0, 'practice', c);
  } else if (pending && pending.mode !== 'normal' && params.again) pending = null;
  // a Desk Supply bought or switched in the Jar since: a normal run's Before Class starts over with it
  if (pending?.mode === 'normal' && JSON.stringify(pending.perks) !== JSON.stringify(activePerks(p0))) pending = null;
  if (!pending) pending = fresh(p0, 'normal');

  const draw = () => {
    const p = profile();
    const mode = pending.mode;
    const free = mode === 'normal';
    const g = TRYOUT.grades[pending.grade];
    const len = TRYOUT.lengths[pending.length] || TRYOUT.lengths.half;
    const start = TRYOUT.squad.start;
    const ready = pending.pick.length === start;
    panel.dataset.mode = mode;

    // ---- the head: what kind of day this is
    const title = mode === 'weekly' ? `${WEEKLY_TEXT.name} · Grade ${pending.grade}`
      : mode === 'practice' ? `Practice · ${LENGTH_NAMES[pending.length]} · Grade ${pending.grade}`
        : `${LENGTH_NAMES[pending.length]} · Grade ${pending.grade}`;
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
      const lengths = TRYOUT.lengths.full ? segRow(['half', 'full'].map((id) => {
        const locked = id === 'full' && !halfCleared(p);
        return { id, label: LENGTH_NAMES[id], locked, title: locked ? CLASS_TEXT.full : LENGTH_NAMES[id] };
      }), pending.length, (id, it) => {
        if (it.locked) {
          why = CLASS_TEXT.full;
          return paintLine();
        }
        why = null;
        pending.length = id;
        draw();
      }, { label: CLASS_TEXT.length, testidPrefix: 'tryout-length-', min: 104, cls: 'ty-bc-lengths' }) : null;
      if (lengths) head.append(lengths);
      gradeBox = h('div.ty-bc-gradebox',
        h('div.ty-bc-row.ty-bc-graderow', h('span.lbl.ty-bc-lbl', `${CLASS_TEXT.grade}${gradeCleared(p) ? ` · cleared ${gradeCleared(p)}` : ''}`), grades),
        line);
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

    // ---- the six: tap 3 (a girl tile each; "Yours · band cap" / "Loaner" above her caption)
    const tiles = pending.draft.map((id, i) => {
      const picked = pending.pick.includes(id);
      const mine = mode !== 'weekly' && isOwned(p, id);
      const t = girlTile(id, {
        owned: true, selected: picked, potential: mine ? undefined : 0, level: mine ? p.units?.[id]?.level ?? null : null, testid: `tryout-draft-${i}`, cls: 'ty-draft',
        onClick: () => {
          if (pending.pick.includes(id)) pending.pick = pending.pick.filter((x) => x !== id);
          else if (pending.pick.length < start) pending.pick.push(id);
          else return toast(`Pick exactly ${start}. Tap a picked girl to put her back first.`, 'info');
          draw();
        },
      });
      t.setAttribute('aria-pressed', picked ? 'true' : 'false');
      t.append(h('span.ui-chip.ink.dup.ty-tag', { 'data-testid': 'tryout-draft-tag' }, mode === 'weekly' ? CLASS_TEXT.floor : mine ? CLASS_TEXT.yours : CLASS_TEXT.loaner));
      return t;
    });
    const left = start - pending.pick.length;
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
    const squad = h('div.ty-bc-squad',
      h('div.ty-bc-row', h('span.lbl.ty-bc-lbl', CLASS_TEXT.squad(pending.pick.length, start)), redraw),
      h('div.ty-bc-six', { role: 'group', 'aria-label': CLASS_TEXT.squad(pending.pick.length, start), 'data-n': String(tiles.length) }, tiles));

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
    const erasers = g.erasers + (pending.perks?.eraser ? 1 : 0);
    const startBtn = h('button.ui-hit.ty-pri', {
      type: 'button', 'data-testid': 'tryout-start', disabled: !ready, 'aria-describedby': ready ? null : 'ty-start-why',
      onclick: () => {
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
    }, h('span.ui-btn.pri', ready ? ico('play') : ico('lock'), h('span', CLASS_TEXT.start)));
    const foot = h('div.ty-bc-foot',
      h('div.ty-bc-facts',
        h('span.ty-bc-fact', CLASS_TEXT.facts(g, len, erasers)),
        perkNames.length ? h('span.ty-bc-fact', { 'data-testid': 'tryout-perks' }, CLASS_TEXT.perks(perkNames)) : null),
      h('div.ty-bc-go',
        ready ? null : h('span.ty-bc-why', { id: 'ty-start-why', 'data-testid': 'tryout-start-why' }, CLASS_TEXT.pickMore(left)),
        startBtn));

    fillIn(panel, head, gradeBox,
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
    line.replaceChildren(why ? ico('lock') : null, h('span', why || gradeTwist(TRYOUT.grades, TRYOUT.windows, pending.grade)));
  }

  draw();
  return () => offPill();
}
