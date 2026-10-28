// The scene player (owner: story; STORY_SPEC §1.3). One academy-style visual-novel player for every story
// episode: forced flows and replays mount it as a screen (#/scene/<id>), queued scenes as an overlay over the
// current screen. It reads only the normalised lines from src/data/story/format.js and takes the scene object,
// so it never imports the scene chunk itself.
//
//   const run = playScene(scene, { host, overlay, prefs, onPrefs, onChoice, episode, reduceMotion, skipNote });
//   await run;          // 'done' | 'skipped' | 'closed' (closed = run.close() from outside, e.g. a route change)
//
// Controls: tap (or Space / Enter) completes the typing, then advances; hold Ctrl to fast-forward (desktop);
// AUTO advances after 900 ms + 30 ms per character (4 s cap) and pauses on choices; SKIP asks first; LOG lists
// every line shown (the chosen option marked ▶); the eye button (or a long press) hides the UI until the next tap;
// Esc opens the skip confirm (or closes the log). Reduced motion: instant text, no slides, hops, shakes, flashes
// or petals — crossfades only. Test ids: story-player, story-text, story-next, story-log, story-auto, story-skip,
// story-skip-confirm, story-choice-<i>, story-hide (+ story-log-close, story-keep-reading, story-speed-<id>).
import '../styles/story.css';
import { h } from '../dom.js';
import { miniMochi } from '../loading/loader.js';
import { UNIT_MAP } from '../../data/units.js';
import { ENEMY_MAP, FAMILIES } from '../../data/enemies.js';
import { CHAPTERS } from '../../data/stages.js';
import { portraitHTML, portraitUrl } from '../../art/portraits.js';
import { FACES, isNpc, playableLines, STAGE_POSITIONS } from '../../data/story/format.js';
import { resolveText } from '../../data/story/tokens.js';
import { STAND_NUDGE } from '../../data/story/backgrounds.js';
import { TEXT_SPEEDS, SPEED_IDS } from '../../systems/story.js';
import { createBackdrop, backgroundUrls, preloadImage } from './backdrop.js';
import { emoteSVG } from './emotes.js';
import { storyMusic, storySfx, musicSnapshot, restoreMusic } from './music.js';

const SPEED_LABEL = { slow: 'Slow', normal: 'Normal', fast: 'Fast', instant: 'Instant' };
const PLAIN_PLATES = { sensei: 'Sensei', unknown: '???' };
const SKY = '#5fb7ff';
const LONG_PRESS_MS = 520;
const PRELOAD_CAP_MS = 2500;
const TITLE_CARD_MS = 1600;
const FX_MS = { hop: 420, bounce: 640, jolt: 300, nod: 460, tilt: 520, 'shake-small': 420, droop: 700, sway: 1400, 'slide-in': 260, fade: 260 };

/** Auto-advance delay after a fully shown line (STORY_SPEC §1.3). */
export function autoDelay(text) {
  return Math.min(4000, 900 + 30 * Array.from(String(text || '')).length);
}

/** Title-card wording: "Chapter 1 · Sakura Gardens" (an Act II episode: "Chapter 1 · Rush Hour") + "Episode 3". */
export function titleCardText(scene, episode = 0) {
  const ch = CHAPTERS.find((c) => c.id === scene.chapter);
  if (scene.kind === 'lesson') return { kicker: "Captain's Journal", title: resolveText(scene.title), sub: '' };
  const kicker = scene.act === 2 ? `Chapter ${scene.chapter}${ch?.act2Name ? ` · ${ch.act2Name}` : ''}`
    : scene.kind === 'event' ? 'Event Story' : scene.chapter === 0 ? 'Opening' : `Chapter ${scene.chapter}${ch ? ` · ${ch.name}` : ''}`;
  return { kicker, title: resolveText(scene.title), sub: episode ? `Episode ${episode}` : '' };
}

/** Name plate for a speaker: { name, title, color } (null for narration). */
export function plateFor(who, override) {
  if (who === 'narrator') return null;
  if (override) return { name: resolveText(override), title: '', color: SKY };
  if (PLAIN_PLATES[who]) return { name: PLAIN_PLATES[who], title: '', color: SKY };
  const u = UNIT_MAP[who];
  if (u) return { name: u.name, title: u.title || '', color: u.palette?.accent || SKY };
  const e = ENEMY_MAP[who];
  if (e) return { name: e.name, title: FAMILIES[e.family]?.name || '', color: FAMILIES[e.family]?.color || e.color || SKY, enemy: true };
  return { name: who.charAt(0).toUpperCase() + who.slice(1), title: '', color: SKY };
}

/** True for a speaker that gets a drawn stand on stage. */
function hasStand(who) {
  return !!UNIT_MAP[who] && !isNpc(who);
}

const prefersReduced = () => {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * Play a scene.
 * @param {object} scene a scene from src/data/story (format.js shape)
 * @param {{
 *   host?: HTMLElement, overlay?: boolean, episode?: number, prefs?: { speed?: string, auto?: boolean },
 *   onPrefs?: (prefs: object) => void, onChoice?: (index: number) => void, onLine?: (line: object) => void,
 *   reduceMotion?: boolean, skipNote?: string|null, hasUnit?: (id: string) => boolean, replay?: boolean,
 * }} [opts]
 * @returns {Promise<'done'|'skipped'|'closed'> & { close: () => void, el: HTMLElement }}
 */
export function playScene(scene, opts = {}) {
  const {
    host = document.body, overlay = false, episode = 0, onPrefs = null, onChoice = null, onLine = null,
    skipNote = null, hasUnit = (id) => !!UNIT_MAP[id],
  } = opts;
  const reduce = !!opts.reduceMotion || prefersReduced();
  const prefs = { speed: SPEED_IDS.includes(opts.prefs?.speed) ? opts.prefs.speed : 'normal', auto: !!opts.prefs?.auto };
  const lines = playableLines(scene, hasUnit);

  let settle;
  const result = new Promise((r) => { settle = r; });
  let finished = false;
  const timers = new Set();
  const later = (fn, ms) => {
    const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
    timers.add(t);
    return t;
  };
  const sleep = (ms) => new Promise((r) => later(r, ms));

  // ---- DOM -------------------------------------------------------------------------------------
  const bgEl = h('div.sp-bg', { 'aria-hidden': 'true' });
  const petalsEl = h('div.sp-petals', { 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, i) => h(`i.sp-petal.p${i}`)));
  const stageEl = h('div.sp-stage', { 'aria-hidden': 'true' });
  const flashEl = h('div.sp-flash', { 'aria-hidden': 'true' });
  const fadeEl = h('div.sp-fade', { 'aria-hidden': 'true' });
  const card = titleCardText(scene, episode);
  const titleCard = h('div.sp-title-card', { 'aria-hidden': 'true' },
    h('span.sp-tc-kicker', card.kicker), h('b.sp-tc-title', card.title), card.sub ? h('span.sp-tc-sub', card.sub) : null);
  const tap = h('button.sp-tap', { 'data-testid': 'story-next', 'aria-label': 'Next line', type: 'button' });
  // a content note (scene.note, Gate Arc): its own card before the title card; tap, Continue, Space or Enter goes on
  let noteGo = null;
  const noteBtn = h('button.sp-note-go', { type: 'button', 'data-testid': 'story-note-continue', onclick: () => advance() }, 'Continue');
  const noteEl = scene.note ? h('div.sp-note', { role: 'note', 'data-testid': 'story-note', hidden: true },
    h('span.sp-note-kicker', 'Content note'), h('p.sp-note-text', resolveText(scene.note)), noteBtn) : null;

  const plateName = h('b.sp-plate-name');
  const plateTitle = h('span.sp-plate-title');
  const plate = h('div.sp-plate', plateName, plateTitle);
  const textEl = h('p.sp-text', { 'data-testid': 'story-text', 'aria-hidden': 'true' });
  const caret = h('i.sp-caret', { 'aria-hidden': 'true' });
  const live = h('div.sp-sr', { 'aria-live': 'polite', role: 'status' });
  const box = h('div.sp-box', plate, textEl, caret, live);

  const choicesEl = h('div.sp-choices');
  const autoBtn = h('button.sp-btn.sp-auto', { 'data-testid': 'story-auto', 'aria-pressed': String(prefs.auto), 'aria-label': 'Auto advance', type: 'button' }, 'AUTO');
  const logBtn = h('button.sp-btn', { 'data-testid': 'story-log', 'aria-label': 'Log', type: 'button' }, 'LOG');
  const skipBtn = h('button.sp-btn.sp-skip', { 'data-testid': 'story-skip', 'aria-label': 'Skip episode', type: 'button' }, 'SKIP', h('span.sp-skip-arrow', '›'));
  const hideBtn = h('button.sp-btn.sp-eye', { 'data-testid': 'story-hide', 'aria-label': 'Hide text', title: 'Hide text', type: 'button', html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>' });
  const top = h('div.sp-top', hideBtn, logBtn, autoBtn, skipBtn);

  const logList = h('ol.sp-log-list');
  const speedRow = h('div.sp-speed', { role: 'radiogroup', 'aria-label': 'Text speed' }, h('span.sp-speed-label', 'Text speed'),
    SPEED_IDS.map((id) => h(`button.sp-speed-btn${id === prefs.speed ? '.on' : ''}`, {
      type: 'button', role: 'radio', 'aria-checked': String(id === prefs.speed), 'data-testid': `story-speed-${id}`, dataset: { speed: id },
      onclick: () => setSpeed(id),
    }, SPEED_LABEL[id])));
  const logClose = h('button.sp-sheet-x', { type: 'button', 'aria-label': 'Close log', 'data-testid': 'story-log-close', onclick: () => closeLog() }, '✕');
  const logSheet = h('div.sp-sheet.sp-log', { hidden: true, role: 'dialog', 'aria-label': 'Log' },
    h('div.sp-sheet-panel', h('div.sp-sheet-head', h('b', 'Log'), speedRow, logClose), logList));

  const confirmSkip = h('button.sp-cbtn.sp-cbtn-yes', { type: 'button', 'data-testid': 'story-skip-confirm', onclick: () => finish('skipped') }, 'Skip');
  const confirmKeep = h('button.sp-cbtn', { type: 'button', 'data-testid': 'story-keep-reading', onclick: () => closeConfirm() }, 'Keep reading');
  const confirmEl = h('div.sp-sheet.sp-confirm', { hidden: true, role: 'alertdialog', 'aria-label': 'Skip this episode?' },
    h('div.sp-confirm-panel',
      h('b.sp-confirm-title', 'Skip this episode?'),
      h('p', 'You can read it again from the Story archive.'),
      skipNote ? h('p.sp-confirm-note', resolveText(skipNote)) : null,
      h('div.sp-confirm-actions', confirmKeep, confirmSkip)));

  // Mochi, the loading slime (src/ui/loading), bottom-right, until the first background is up
  const spinner = h('div.sp-loading', { 'aria-label': 'Loading', role: 'status' }, miniMochi({ dark: true, size: 40 }));
  const ui = h('div.sp-ui', top, choicesEl, box);
  const root = h(`div.sp${overlay ? '.sp-overlay' : '.sp-screen'}${reduce ? '.sp-reduce' : ''}`, {
    'data-testid': 'story-player', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Story: ${card.title}`, tabindex: '-1',
    dataset: { scene: scene.id },
  }, bgEl, petalsEl, stageEl, flashEl, tap, ui, titleCard, noteEl, fadeEl, spinner, logSheet, confirmEl);
  root.classList.toggle('sp-auto-on', prefs.auto);
  host.appendChild(root);

  const backdrop = createBackdrop(bgEl, { chapter: scene.chapter });
  const snapshot = musicSnapshot();

  // ---- state -----------------------------------------------------------------------------------
  const actors = new Map(); // who → { el, fig, emote, slot, spoke }
  let clock = 0;
  let typing = null; // { complete() }
  let waiting = null; // resolve fn while a full line waits for the player
  let choosing = false;
  let autoTimer = null;
  let ff = false; // Ctrl held
  let lastText = '';
  const log = [];

  // ---- prefs -----------------------------------------------------------------------------------
  function savePrefs() {
    try {
      onPrefs?.({ ...prefs });
    } catch (e) {
      console.warn('[story] saving prefs failed', e);
    }
  }
  function setSpeed(id) {
    if (!SPEED_IDS.includes(id)) return;
    prefs.speed = id;
    for (const b of speedRow.querySelectorAll('.sp-speed-btn')) {
      const on = b.dataset.speed === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    }
    savePrefs();
  }
  function setAuto(on) {
    prefs.auto = !!on;
    root.classList.toggle('sp-auto-on', prefs.auto);
    autoBtn.setAttribute('aria-pressed', String(prefs.auto));
    if (waiting && !choosing) armAuto();
    else if (!prefs.auto) clearTimeout(autoTimer);
    savePrefs();
  }
  const cps = () => (reduce ? Infinity : TEXT_SPEEDS[prefs.speed] ?? TEXT_SPEEDS.normal);

  // ---- portraits -------------------------------------------------------------------------------
  function slotFree(slot, except) {
    for (const a of actors.values()) if (a.slot === slot && a.who !== except) return false;
    return true;
  }
  function pickSlot(who) {
    for (const s of ['center', 'left', 'right']) if (slotFree(s, who)) return s;
    // all three taken: replace whoever has gone longest without speaking
    let oldest = null;
    for (const a of actors.values()) if (!oldest || a.spoke < oldest.spoke) oldest = a;
    return oldest.slot;
  }
  function exitActor(who, { instant = false } = {}) {
    const a = actors.get(who);
    if (!a) return;
    actors.delete(who);
    a.el.classList.add('sp-exit');
    later(() => a.el.remove(), instant || reduce ? 0 : 240);
  }
  function enterActor(who, slot, { fx = null } = {}) {
    if (!hasStand(who)) return null;
    for (const a of [...actors.values()]) if (a.slot === slot && a.who !== who) exitActor(a.who);
    let a = actors.get(who);
    if (a) {
      if (a.slot !== slot) {
        a.el.classList.remove(`sp-slot-${a.slot}`);
        a.el.classList.add(`sp-slot-${slot}`);
        a.slot = slot;
      }
      return a;
    }
    const fig = h('div.sp-fig', { html: portraitHTML(UNIT_MAP[who], 'cut', { eager: true, alt: '' }) });
    const emote = h('div.sp-emote');
    const el = h(`div.sp-actor.sp-slot-${slot}`, { dataset: { who } }, fig, emote);
    const nudge = STAND_NUDGE[who];
    if (nudge) el.style.setProperty('--sp-nudge', `${nudge}vh`);
    stageEl.appendChild(el);
    a = { who, el, fig, emote, slot, spoke: clock };
    actors.set(who, a);
    const enter = fx === 'slide-in' ? (slot === 'right' ? 'sp-enter-right' : slot === 'left' ? 'sp-enter-left' : 'sp-enter-up') : 'sp-enter-fade';
    if (!reduce) {
      el.classList.add(enter);
      later(() => el.classList.remove(enter), 320);
    }
    return a;
  }
  function playFx(a, fx) {
    if (!a || !fx || reduce || fx === 'slide-in' || fx === 'fade') return;
    const cls = `fx-${fx}`;
    a.fig.classList.remove(cls);
    void a.fig.offsetWidth;
    a.fig.classList.add(cls);
    later(() => a.fig.classList.remove(cls), FX_MS[fx] || 500);
  }
  function showEmote(a, face) {
    if (!a) return;
    const glyph = FACES[face]?.glyph || null;
    a.emote.innerHTML = glyph ? emoteSVG(glyph) : '';
    a.emote.className = `sp-emote${glyph ? ` sp-emote-${glyph} on` : ''}`;
  }
  function focus(who) {
    for (const a of actors.values()) {
      a.el.classList.toggle('sp-speaking', a.who === who);
      a.el.classList.toggle('sp-dim', a.who !== who);
      if (a.who !== who) showEmote(a, null);
    }
  }
  function syncCg() {
    root.classList.toggle('sp-cg', backdrop.isCg);
  }

  // ---- text ------------------------------------------------------------------------------------
  function setPlate(p) {
    box.classList.toggle('sp-narrate', !p);
    plate.hidden = !p;
    if (!p) return;
    plateName.textContent = p.name;
    plateTitle.textContent = p.title || '';
    plate.style.setProperty('--sp-accent', p.color || SKY);
    plate.classList.toggle('sp-plate-enemy', !!p.enemy);
  }
  function typeOn(text) {
    const chars = Array.from(text);
    lastText = text;
    live.textContent = text;
    box.classList.remove('sp-full');
    const speed = ff ? Infinity : cps();
    return new Promise((resolve) => {
      const done = () => {
        if (!typing) return;
        clearInterval(typing.timer);
        typing = null;
        textEl.textContent = text;
        box.classList.add('sp-full');
        resolve();
      };
      typing = { complete: done, timer: null };
      if (speed === Infinity) return done();
      const t0 = performance.now();
      textEl.textContent = '';
      typing.timer = setInterval(() => {
        if (ff) return done();
        const n = Math.min(chars.length, Math.floor(((performance.now() - t0) / 1000) * speed) + 1);
        textEl.textContent = chars.slice(0, n).join('');
        if (n >= chars.length) done();
      }, 28);
    });
  }
  function armAuto() {
    clearTimeout(autoTimer);
    if (!waiting) return;
    if (ff) autoTimer = later(advance, 70);
    else if (prefs.auto) autoTimer = later(advance, autoDelay(lastText));
  }
  function waitForPlayer() {
    return new Promise((resolve) => {
      waiting = resolve;
      armAuto();
    });
  }
  function advance() {
    if (finished || choosing || !logSheet.hidden || !confirmEl.hidden) return;
    if (noteGo) {
      const go = noteGo;
      noteGo = null;
      go();
      return;
    }
    if (root.classList.contains('sp-ui-hidden')) {
      root.classList.remove('sp-ui-hidden');
      return;
    }
    if (typing) {
      typing.complete();
      return;
    }
    if (waiting) {
      const w = waiting;
      waiting = null;
      clearTimeout(autoTimer);
      w();
    }
  }

  function addLog(entry) {
    log.push(entry);
    const li = h(`li.sp-log-row${entry.choice ? '.choice' : ''}${entry.plate ? '' : '.narrate'}`,
      entry.plate ? h('b.sp-log-name', { style: { '--sp-accent': entry.plate.color } }, entry.plate.name) : null,
      h('span.sp-log-text', entry.choice ? `▶ ${entry.text}` : entry.text));
    logList.appendChild(li);
  }

  async function sayLine(line) {
    clock++;
    const text = resolveText(line.text);
    if (line.t === 'narrate' || line.who === 'narrator') {
      focus(null);
      setPlate(null);
      addLog({ plate: null, text });
    } else {
      const who = line.who;
      let a = null;
      if (hasStand(who) && line.at !== 'off') {
        const known = actors.get(who);
        const slot = STAGE_POSITIONS.includes(line.at) ? line.at : known ? known.slot : pickSlot(who);
        a = enterActor(who, slot, { fx: line.fx });
        if (a) a.spoke = clock;
      }
      focus(a ? who : null);
      const plateInfo = plateFor(who, line.name);
      setPlate(plateInfo);
      if (a) {
        showEmote(a, line.face);
        playFx(a, line.fx || FACES[line.face]?.fx || null);
      }
      if (line.sfx) storySfx(line.sfx);
      addLog({ plate: plateInfo, text });
    }
    try {
      onLine?.(line);
    } catch { /* test hook */ }
    await typeOn(text);
    if (finished) return;
    await waitForPlayer();
  }

  async function runCue(c) {
    if (c.music) storyMusic(c.music);
    if (c.sfx) storySfx(c.sfx);
    if (c.exit) {
      const ids = c.exit === 'all' ? [...actors.keys()] : c.exit;
      ids.forEach((id) => exitActor(id));
    }
    if (c.bg) {
      backdrop.show(c.bg);
      petalsEl.classList.remove('on');
      syncCg();
    }
    if (c.enter) {
      for (const e of c.enter) {
        const a = enterActor(e.who, e.at, { fx: e.fx });
        if (a) a.spoke = ++clock;
      }
      focus(null);
    }
    if (c.petals && !reduce) petalsEl.classList.add('on');
    if (c.flash && !reduce) {
      flashEl.className = `sp-flash ${c.flash}`;
      void flashEl.offsetWidth;
      flashEl.classList.add('go');
    }
    if (c.shake && !reduce) {
      root.classList.remove('sp-shake');
      void root.offsetWidth;
      root.classList.add('sp-shake');
      later(() => root.classList.remove('sp-shake'), 520);
    }
    if (c.fade === 'out') {
      box.classList.add('sp-box-out');
      fadeEl.classList.add('on');
      if (!ff) await sleep(reduce ? 200 : 650);
    } else if (c.fade === 'in') {
      fadeEl.classList.add('instant', 'on');
      void fadeEl.offsetWidth;
      fadeEl.classList.remove('instant', 'on');
      box.classList.remove('sp-box-out');
      if (!ff) await sleep(reduce ? 150 : 520);
    }
    if (c.wait && !ff) await sleep(reduce ? Math.min(c.wait, 300) : c.wait);
  }

  async function runChoice(line) {
    clearTimeout(autoTimer);
    choosing = true;
    root.classList.add('sp-choosing');
    const picked = await new Promise((resolve) => {
      choicesEl.replaceChildren(...line.options.map((o, i) => h('button.sp-choice', {
        type: 'button', 'data-testid': `story-choice-${i}`, onclick: (e) => { e.stopPropagation(); resolve(i); },
      }, h('span', resolveText(o.text)))));
      choicesEl.querySelector('button')?.focus({ preventScroll: true });
    });
    choicesEl.replaceChildren();
    root.classList.remove('sp-choosing');
    choosing = false;
    if (finished) return;
    const opt = line.options[picked];
    addLog({ plate: { name: 'Sensei', color: SKY }, text: resolveText(opt.text), choice: true });
    try {
      onChoice?.(picked);
    } catch (e) {
      console.warn('[story] recording the choice failed', e);
    }
    root.focus({ preventScroll: true });
    for (const reply of opt.lines) {
      if (finished) return;
      await sayLine(reply);
    }
  }

  // ---- log / confirm / hide --------------------------------------------------------------------
  function openLog() {
    if (finished) return;
    clearTimeout(autoTimer);
    logSheet.hidden = false;
    logList.lastElementChild?.scrollIntoView?.({ block: 'end' });
    logClose.focus({ preventScroll: true });
  }
  function closeLog() {
    logSheet.hidden = true;
    root.focus({ preventScroll: true });
    if (waiting) armAuto();
  }
  function openConfirm() {
    if (finished) return;
    clearTimeout(autoTimer);
    logSheet.hidden = true;
    confirmEl.hidden = false;
    confirmKeep.focus({ preventScroll: true });
  }
  function closeConfirm() {
    confirmEl.hidden = true;
    root.focus({ preventScroll: true });
    if (waiting) armAuto();
  }
  const hideUi = () => root.classList.add('sp-ui-hidden');

  // the top buttons hand focus back to the scene, so Space / Enter keep advancing instead of pressing them again
  autoBtn.addEventListener('click', (e) => { e.stopPropagation(); setAuto(!prefs.auto); root.focus({ preventScroll: true }); });
  logBtn.addEventListener('click', (e) => { e.stopPropagation(); openLog(); });
  skipBtn.addEventListener('click', (e) => { e.stopPropagation(); openConfirm(); });
  hideBtn.addEventListener('click', (e) => { e.stopPropagation(); hideUi(); root.focus({ preventScroll: true }); });
  logSheet.addEventListener('click', (e) => { if (e.target === logSheet) closeLog(); });
  confirmEl.addEventListener('click', (e) => { if (e.target === confirmEl) closeConfirm(); });

  // tap / long press on the scene
  let press = null;
  tap.addEventListener('pointerdown', () => {
    clearTimeout(press);
    press = later(() => { press = 'long'; hideUi(); }, LONG_PRESS_MS);
  });
  const endPress = () => {
    if (press && press !== 'long') clearTimeout(press);
  };
  tap.addEventListener('pointerup', endPress);
  tap.addEventListener('pointercancel', endPress);
  tap.addEventListener('pointerleave', endPress);
  tap.addEventListener('click', (e) => {
    e.stopPropagation();
    if (press === 'long') {
      press = null;
      return;
    }
    press = null;
    advance();
  });
  // a tap anywhere on the box also advances (it sits above the tap layer)
  box.addEventListener('click', (e) => { e.stopPropagation(); advance(); });

  function onKey(e) {
    if (finished) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!logSheet.hidden) closeLog();
      else if (!confirmEl.hidden) closeConfirm();
      else openConfirm();
      return;
    }
    if (e.key === 'Control') {
      if (!ff && logSheet.hidden && confirmEl.hidden && !choosing) {
        ff = true;
        if (typing) typing.complete();
        if (waiting) armAuto();
      }
      return;
    }
    if (e.key === 'Tab') {
      trapFocus(e);
      return;
    }
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      const t = e.target;
      // Enter / Space on a focused button presses that button; anywhere else it advances
      if (t instanceof HTMLButtonElement && t !== tap) return;
      e.preventDefault();
      advance();
    }
  }
  function onKeyUp(e) {
    if (e.key === 'Control') {
      ff = false;
      if (waiting) armAuto();
    }
  }
  function trapFocus(e) {
    const visible = [...root.querySelectorAll('button')].filter((b) => !b.closest('[hidden]') && b.offsetParent !== null && !b.disabled);
    if (!visible.length) return;
    const i = visible.indexOf(document.activeElement);
    const next = e.shiftKey ? (i <= 0 ? visible.length - 1 : i - 1) : (i + 1) % visible.length;
    e.preventDefault();
    visible[next].focus();
  }
  const onBlur = () => {
    if (ff) {
      ff = false;
      if (waiting) armAuto();
    }
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onBlur);

  // ---- lifecycle -------------------------------------------------------------------------------
  function finish(how) {
    if (finished) return;
    finished = true;
    clearTimeout(autoTimer);
    if (typing) clearInterval(typing.timer);
    typing = null;
    for (const t of timers) clearTimeout(t);
    timers.clear();
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('blur', onBlur);
    if (how !== 'closed') restoreMusic(snapshot);
    const remove = () => {
      backdrop.dispose();
      root.remove();
    };
    if (overlay && how !== 'closed' && !reduce) {
      root.classList.add('sp-leave');
      setTimeout(remove, 260);
    } else remove();
    try {
      window.dispatchEvent(new CustomEvent('story-end', { detail: { id: scene.id, how } }));
    } catch { /* no window */ }
    settle(how);
  }

  async function run() {
    try {
      window.dispatchEvent(new CustomEvent('story-start', { detail: { id: scene.id } }));
    } catch { /* no window */ }
    root.focus({ preventScroll: true });
    // the first background, the cast's stands (capped; the rest load while she talks)
    backdrop.show(scene.bg, { instant: true });
    syncCg();
    if (scene.music) storyMusic(scene.music);
    const urls = [...backgroundUrls(scene.bg, scene.chapter), ...(scene.cast || []).map((id) => portraitUrl(id, 'cut')).filter(Boolean)];
    await Promise.race([Promise.all(urls.map((u) => preloadImage(u, PRELOAD_CAP_MS))), sleep(PRELOAD_CAP_MS)]);
    if (finished) return;
    root.classList.add('sp-ready');
    try {
      window.dispatchEvent(new CustomEvent('story-stage-ready', { detail: { id: scene.id } }));
    } catch { /* no window */ }
    if (noteEl) {
      noteEl.hidden = false;
      noteBtn.focus({ preventScroll: true });
      await new Promise((resolve) => { noteGo = resolve; });
      noteEl.remove();
      if (finished) return;
      root.focus({ preventScroll: true });
    }
    titleCard.classList.add('on');
    later(() => titleCard.classList.add('out'), TITLE_CARD_MS);
    later(() => titleCard.remove(), TITLE_CARD_MS + (reduce ? 0 : 500));
    for (const line of lines) {
      if (finished) return;
      if (line.t === 'cue') await runCue(line);
      else if (line.t === 'choice') await runChoice(line);
      else await sayLine(line);
    }
    if (!finished) finish('done');
  }
  run().catch((e) => {
    console.error('[story] scene player failed', e);
    finish('done');
  });

  result.close = () => finish('closed');
  result.el = root;
  result.log = log;
  return result;
}
