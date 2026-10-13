// Tutorial coach (owner: story; STORY_SPEC §2.3–2.4). Mounted into the battle shell by one block in
// src/ui/battle/controller.js when the route carries `tutorial=1`:
//
//   const off = attachCoach(ctx);   // ctx = the battle context (sim, layer, bar, placement, renderer, speed, …)
//
// Hikari's tips sit on top of the real battle UI: a soft scrim with a spotlight hole, a pulsing ring on the
// control to use, a ghost hand for the first drag and her speech bubble ([–] minimises to a "Hikari's tips" pill,
// [Skip tutorial] asks first). The coach only READS battle state on its own 200 ms timer — it never pauses the sim
// and never blocks input: the player moves on by doing what the tip says (src/ui/story/coachSteps.js).
// On a win the tutorial is done: once the victory sheet is up, the "First Petals" outro plays over it, then a small
// Hikari card on the sheet points to Rewards and Home. On a defeat the sheet gets [Retry with Hikari] / [Skip].
import '../styles/coach.css';
import { h } from '../dom.js';
import { confirmDialog, modal } from '../components.js';
import { store } from '../../core/store.js';
import { UNIT_MAP } from '../../data/units.js';
import { portraitHTML } from '../../art/portraits.js';
import { COACH_STEP_MAP, TUTORIAL_TEXT } from '../../data/story/tutorial.js';
import { resolveText } from '../../data/story/tokens.js';
import { setTutorial, storyOf } from '../../systems/story.js';
import {
  coachSnapshot, updateDone, nextStep, suggestSpots, focusTower, retarget, FREE_MS, CORE_STEPS,
} from './coachSteps.js';

const TICK_MS = 200;
/** A tip's scrim fades after this long (the ring and bubble stay), so a long wave is not played in the dark. */
const SCRIM_MS = 12000;
/** The victory sheet shows this long before the outro opens over it. */
const OUTRO_DELAY_MS = 900;
/** Same lift as src/ui/battle/placement.js: a touch drag aims this far above the finger. */
const TOUCH_LIFT = 46;

const HAND_SVG = `<svg viewBox="0 0 40 50" aria-hidden="true"><g fill="#1d3a6b" stroke="#1d3a6b" stroke-width="5" stroke-linejoin="round">
<rect x="14" y="3" width="9" height="26" rx="4.5"/><rect x="8" y="20" width="27" height="25" rx="9"/><rect x="3" y="24" width="9" height="15" rx="4.5" transform="rotate(-25 7 31)"/></g>
<g fill="#fff"><rect x="14" y="3" width="9" height="26" rx="4.5"/><rect x="8" y="20" width="27" height="25" rx="9"/><rect x="3" y="24" width="9" height="15" rx="4.5" transform="rotate(-25 7 31)"/></g>
<path d="M24.5 24v5M30 25.5v4.5" stroke="#9fb3d1" stroke-width="1.8" stroke-linecap="round"/></svg>`;

const reducedMotion = (profile) => {
  if (profile?.settings?.reduceMotion) return true;
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Rect of an element relative to `base` (null when hidden / zero-sized). */
function relRect(el, base) {
  if (!el || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
}
const overlaps = (a, b, pad = 0) => !!a && !!b
  && a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
const roundRectPath = ({ x, y, w, h: hh }, r) => {
  const rr = Math.max(0, Math.min(r, w / 2, hh / 2));
  return `M${x + rr},${y}H${x + w - rr}A${rr},${rr} 0 0 1 ${x + w},${y + rr}V${y + hh - rr}A${rr},${rr} 0 0 1 ${x + w - rr},${y + hh}H${x + rr}A${rr},${rr} 0 0 1 ${x},${y + hh - rr}V${y + rr}A${rr},${rr} 0 0 1 ${x + rr},${y}Z`;
};

/**
 * Mount the coach on a running battle.
 * @param {object} ctx battle context (src/ui/battle/controller.js)
 * @returns {() => void} cleanup
 */
export function attachCoach(ctx) {
  const { sim, layer } = ctx;
  const profile = store.profile;
  const heroId = sim.heroConfig?.unitId || null;
  const towerId = focusTower(sim) || 'aoi';
  const hikari = UNIT_MAP.hikari || UNIT_MAP[heroId] || null;
  const text = (s) => resolveText(retarget(s, { tower: towerId, hero: heroId || 'hikari' }));
  const thumb = (cls = 'tc-thumb') => h(`div.${cls}`, { html: hikari ? portraitHTML(hikari, 'thumb', { eager: true, alt: '' }) : '' });

  // ---- DOM ---------------------------------------------------------------------------------------
  const svgNS = 'http://www.w3.org/2000/svg';
  const scrim = document.createElementNS(svgNS, 'svg');
  scrim.setAttribute('class', 'tc-scrim');
  scrim.setAttribute('aria-hidden', 'true');
  const scrimPath = document.createElementNS(svgNS, 'path');
  scrim.appendChild(scrimPath);
  const ring = h('div.tc-ring', { 'aria-hidden': 'true' });
  const ghost = h('div.tc-hand-ghost', { html: UNIT_MAP[towerId] ? portraitHTML(UNIT_MAP[towerId], 'thumb', { eager: true, alt: '' }) : '' });
  const hand = h('div.tc-hand', { 'aria-hidden': 'true', 'data-testid': 'coach-hand' }, ghost, h('i.tc-hand-dot'), h('span', { html: HAND_SVG }));

  const titleEl = h('b.tc-title');
  const bodyEl = h('p.tc-body');
  const actionsEl = h('div.tc-actions');
  const minBtn = h('button.tc-min', { type: 'button', 'data-testid': 'coach-min', title: resolveText(TUTORIAL_TEXT.minimise), 'aria-label': resolveText(TUTORIAL_TEXT.minimise), onclick: () => minimise(true) }, '–');
  const bubble = h('div.tc-bubble', { 'data-testid': 'coach-bubble', role: 'status', 'aria-live': 'polite' },
    thumb(),
    h('div.tc-speech',
      h('div.tc-head', h('span.tc-name', h('span', hikari?.name || 'Hikari')), h('span.tc-head-tag', hikari?.title || ''), minBtn),
      titleEl, bodyEl, actionsEl));
  const pill = h('button.tc-pill', { type: 'button', 'data-testid': 'coach-pill', hidden: true, onclick: () => expand() },
    thumb('tc-pill-thumb'), h('span', resolveText(TUTORIAL_TEXT.pill)));
  const root = h(`div.tc${reducedMotion(profile) ? '.tc-reduce' : ''}`, { 'data-testid': 'coach' }, scrim, ring, hand, bubble, pill);
  if (hikari?.palette?.accent) root.style.setProperty('--tc-accent', hikari.palette.accent);
  layer.appendChild(root);

  // ---- state -------------------------------------------------------------------------------------
  const done = new Set();
  let step = null;
  let lastCore = null; // the last core tip shown: it comes back after the ultimate cut in
  let stepSince = 0;
  let userMin = false;
  let autoMin = false;
  let peekUntil = 0;
  let dead = false;
  let skipping = false;
  let won = false;
  let outro = 'none'; // none → waiting → playing → over
  let spots = null; // world candidates for the drag hand
  let spotIdx = -1;
  const inline = { el: null, kind: null };
  let pulsed = null;
  const timers = new Set();
  const later = (fn, ms) => {
    const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms);
    timers.add(t);
    return t;
  };

  const commitStory = () => {
    try {
      store.commit('story');
    } catch (e) {
      console.warn('[coach] saving the tutorial state failed', e);
    }
  };

  // ---- bubble content ----------------------------------------------------------------------------
  function skipButton() {
    return h('button.tc-skip', { type: 'button', 'data-testid': 'coach-skip', onclick: () => askSkip() }, resolveText(TUTORIAL_TEXT.skip));
  }
  function fillBubble(id) {
    const copy = COACH_STEP_MAP[id] || COACH_STEP_MAP.free;
    titleEl.textContent = text(copy.title);
    bodyEl.textContent = text(copy.body);
    const btns = [];
    if (id === 'upgrade') {
      btns.push(h('button.tc-btn', { type: 'button', 'data-testid': 'coach-show', onclick: () => showGirl() }, text(TUTORIAL_TEXT.showGirl)));
    }
    btns.push(skipButton());
    actionsEl.replaceChildren(...btns);
    bubble.dataset.step = id;
  }

  function upgradeTarget() {
    const placed = sim.towers.filter((t) => !t.isHero);
    if (!placed.length) return null;
    return placed.find((t) => t.unitId === towerId) || placed[0];
  }
  function showGirl() {
    const t = upgradeTarget();
    if (t && ctx.select) ctx.select(t.uid);
    tick();
  }

  function setStep(next) {
    step = next;
    stepSince = performance.now();
    root.dataset.step = next || '';
    if (next !== 'place') spots = null;
    if (!next) return;
    fillBubble(next);
    if (next === 'free') return;
    if (autoMin) autoMin = false; // a new lesson opens the tips again after the encouragement folded them away
    if (userMin) {
      pill.classList.remove('ping');
      void pill.offsetWidth;
      pill.classList.add('ping');
    }
  }

  function minimise(byUser) {
    if (byUser) userMin = true;
    else autoMin = true;
    peekUntil = 0;
    render();
  }
  function expand() {
    userMin = false;
    autoMin = false;
    if (!step) {
      // nothing to do right now: show the encouragement for a moment
      fillBubble('free');
      peekUntil = performance.now() + 4000;
    }
    render();
  }

  async function askSkip() {
    if (skipping || dead) return;
    skipping = true;
    const yes = await confirmDialog(resolveText(TUTORIAL_TEXT.skipConfirm), {
      title: resolveText(TUTORIAL_TEXT.skip), ok: resolveText(TUTORIAL_TEXT.skipYes), cancel: resolveText(TUTORIAL_TEXT.skipNo),
    });
    skipping = false;
    if (!yes || dead) return;
    if (!won && setTutorial(store.profile, 'skipped')) commitStory();
    dispose();
  }

  // ---- geometry ----------------------------------------------------------------------------------
  const q = (sel) => layer.querySelector(sel);
  function domTarget(id) {
    switch (id) {
      case 'place': return ctx.bar?.cardFor?.(towerId) || q(`[data-testid="card-${towerId}"]`);
      case 'start': return q('[data-testid="start-wave"]');
      case 'hero': return heroId ? (ctx.bar?.cardFor?.(heroId) || q(`[data-testid="card-${heroId}"]`)) : null;
      case 'speed': return q('[data-testid="speed"]');
      case 'ult': return q('[data-testid="ult"]');
      default: return null;
    }
  }

  /**
   * The buy button to light in the open panel for the coached girl: the cheapest tier-1 path the player can see
   * without scrolling (on a phone the panel scrolls), else the cheapest one, scrolled into view once.
   */
  let scrolledTo = null;
  function buyButton(t) {
    const panel = q('[data-testid="tower-panel"]');
    if (!panel || panel.hidden || ctx.selectedUid !== t.uid) return null;
    const visible = (btn) => {
      const r = btn.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      for (let el = btn.parentElement; el && el !== panel.parentElement; el = el.parentElement) {
        if (el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1) continue;
        const v = el.getBoundingClientRect();
        if (r.top < v.top - 1 || r.bottom > v.bottom + 1) return false;
      }
      return true;
    };
    let best = null;
    let bestSeen = null;
    for (let p = 0; p < 3; p++) {
      const st = sim.upgradeStatus(t.uid, p);
      if (!st.next || (st.reason && st.reason !== 'cash')) continue;
      const btn = panel.querySelector(`[data-testid="buy-${p}"]`);
      if (!btn) continue;
      if (!best || st.cost < best.cost) best = { btn, cost: st.cost };
      if (visible(btn) && (!bestSeen || st.cost < bestSeen.cost)) bestSeen = { btn, cost: st.cost };
    }
    if (bestSeen) return bestSeen.btn;
    const scroller = best?.btn.closest('.bt-panel-scroll');
    if (best && scroller && scrolledTo !== best.btn) {
      // only the panel's own scroller moves (scrollIntoView could shift the battle layer too)
      scrolledTo = best.btn;
      const r = best.btn.getBoundingClientRect();
      const v = scroller.getBoundingClientRect();
      if (r.bottom > v.bottom) scroller.scrollTop += r.bottom - v.bottom + 12;
      else if (r.top < v.top) scroller.scrollTop -= v.top - r.top + 12;
    }
    return best?.btn || null;
  }

  /** On-screen point of a world position, relative to the layer (null when off screen or under the HUD/bar). */
  function screenPoint(x, y, z, base) {
    const p = ctx.renderer?.worldToScreen?.(x, y, z);
    if (!p?.visible) return null;
    return { x: p.clientX - base.left, y: p.clientY - base.top, cx: p.clientX, cy: p.clientY };
  }
  function onCanvas(cx, cy) {
    const el = document.elementFromPoint(cx, cy);
    return !!el && el === ctx.renderer?.canvas;
  }
  /** Touch drags aim TOUCH_LIFT px above the finger (src/ui/battle/placement.js): the hand shows that too. */
  const lift = (() => {
    try {
      return (navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches) ? TOUCH_LIFT : 0;
    } catch {
      return 0;
    }
  })();
  hand.style.setProperty('--lift', `${lift}px`);

  /** The drop spot on screen (where she will stand) and where the finger lets go; null when none is visible. */
  function handSpot(base) {
    if (!spots) {
      try {
        spots = suggestSpots(sim, towerId);
      } catch (e) {
        console.warn('[coach] no drag spot', e);
        spots = [];
      }
      spotIdx = -1;
    }
    const barTop = ctx.bar?.el?.getBoundingClientRect().top ?? Infinity;
    // keep the current spot while it stays usable; otherwise the first usable candidate
    const order = spotIdx >= 0 ? [spotIdx, ...spots.keys()] : [...spots.keys()];
    for (const i of order) {
      const s = spots[i];
      if (!s) continue;
      const p = screenPoint(s.x, s.y, 0, base);
      if (!p || !onCanvas(p.cx, p.cy)) continue;
      // the finger must let go on the board, never over the tower bar (that cancels the drag)
      const fy = p.cy + lift;
      if (fy > barTop - 10 || !onCanvas(p.cx, fy)) continue;
      spotIdx = i;
      return { spot: p, finger: { x: p.x, y: p.y + lift } };
    }
    return null;
  }

  function placeBubble(base, keepOut, jump = false) {
    const W = base.width;
    const hud = relRect(q('.bt-hud'), base);
    const bar = relRect(ctx.bar?.el, base);
    const bw = bubble.offsetWidth || 320;
    const bh = bubble.offsetHeight || 110;
    const top = Math.round((hud ? hud.y + hud.h : 56) + 8);
    const barTop = bar ? bar.y : base.height - 100;
    const panel = relRect(q('[data-testid="tower-panel"]:not([hidden])'), base);
    const avoid = [...keepOut, panel].filter(Boolean);
    const candidates = [
      { x: (W - bw) / 2, y: top },
      { x: 12, y: top },
      { x: W - bw - 12, y: top },
      { x: (W - bw) / 2, y: Math.max(top, barTop - bh - 10) },
      { x: 12, y: Math.max(top, barTop - bh - 10) },
    ];
    const fit = candidates.find((c) => !avoid.some((r) => overlaps({ x: c.x, y: c.y, w: bw, h: bh }, r, 6))) || candidates[0];
    // a bubble that is just appearing jumps to its spot (no slide from the corner)
    if (jump) bubble.style.transition = 'opacity 200ms ease, translate 200ms ease';
    bubble.style.left = `${Math.round(Math.max(8, Math.min(W - bw - 8, fit.x)))}px`;
    bubble.style.top = `${Math.round(fit.y)}px`;
    if (jump) {
      void bubble.offsetWidth;
      bubble.style.transition = '';
    }
  }

  function setScrim(base, holes, on) {
    if (!on || !holes.length) {
      scrim.classList.remove('on');
      return;
    }
    const W = Math.round(base.width);
    const H = Math.round(base.height);
    scrim.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const parts = [`M0,0H${W}V${H}H0Z`];
    for (const hole of holes) parts.push(roundRectPath(hole, hole.r ?? 14));
    scrimPath.setAttribute('d', parts.join(''));
    scrim.classList.add('on');
  }

  function setRing(rect, round) {
    if (!rect) {
      ring.classList.remove('on');
      return;
    }
    // a ring that is just appearing jumps onto its target (it glides only from one target to the next)
    const jump = !ring.classList.contains('on');
    if (jump) ring.style.transition = 'none';
    ring.classList.toggle('round', !!round);
    ring.style.left = `${Math.round(rect.x)}px`;
    ring.style.top = `${Math.round(rect.y)}px`;
    ring.style.width = `${Math.round(rect.w)}px`;
    ring.style.height = `${Math.round(rect.h)}px`;
    if (jump) {
      void ring.offsetWidth;
      ring.style.transition = '';
    }
    ring.classList.add('on');
  }

  function setHand(from, to) {
    if (!from || !to) {
      hand.classList.remove('on');
      return;
    }
    hand.style.setProperty('--x0', `${Math.round(from.x)}px`);
    hand.style.setProperty('--y0', `${Math.round(from.y)}px`);
    hand.style.setProperty('--x1', `${Math.round(to.x)}px`);
    hand.style.setProperty('--y1', `${Math.round(to.y)}px`);
    hand.classList.add('on');
  }

  const pad = (r, p) => r && { x: r.x - p, y: r.y - p, w: r.w + p * 2, h: r.h + p * 2 };

  // ---- results-sheet helpers (defeat card, rewards/home pointer) --------------------------------
  function clearInline() {
    inline.el?.remove();
    inline.el = null;
    inline.kind = null;
    if (pulsed) pulsed.classList.remove('tc-pulse');
    pulsed = null;
  }
  function pulse(el) {
    if (pulsed === el) return;
    if (pulsed) pulsed.classList.remove('tc-pulse');
    pulsed = el || null;
    if (el) el.classList.add('tc-pulse');
  }
  /** Hikari's card inside the visible result sheet (re-added when the sheet is redrawn). */
  function inlineCard(kind, title, body, buttons = []) {
    const sheet = q('[data-testid="result"]:not([hidden]) .bt-result');
    if (!sheet) return false;
    if (inline.el && inline.kind === kind && sheet.contains(inline.el)) return true;
    inline.el?.remove();
    const card = h('div.tc-inline', { 'data-testid': `coach-inline-${kind}` }, thumb(),
      h('div.tc-inline-text', h('b', title), body ? h('p', body) : null, buttons.length ? h('div.tc-actions', buttons) : null));
    const anchor = sheet.querySelector('.bt-result-actions') || sheet.querySelector('.bt-rewards-body');
    if (anchor) sheet.insertBefore(card, anchor);
    else sheet.appendChild(card);
    inline.el = card;
    inline.kind = kind;
    return true;
  }

  function lostCard() {
    const copy = COACH_STEP_MAP.lost;
    const retry = h('button.tc-btn', { type: 'button', 'data-testid': 'coach-retry', onclick: () => ctx.restart?.() }, resolveText(TUTORIAL_TEXT.lostRetry));
    const skip = h('button.tc-btn.ghost', { type: 'button', 'data-testid': 'coach-skip', onclick: () => askSkip() }, resolveText(TUTORIAL_TEXT.lostSkip));
    inlineCard('lost', text(copy.title), text(copy.body), [retry, skip]);
  }

  function pointerCard() {
    const rewards = q('[data-testid="result"]:not([hidden]) [data-testid="view-rewards"]');
    const home = q('[data-testid="result"]:not([hidden]) [data-testid="home"]');
    if (rewards) {
      inlineCard('rewards', text(TUTORIAL_TEXT.rewardsPointer), null);
      pulse(rewards);
    } else if (home) {
      inlineCard('home', text(TUTORIAL_TEXT.homePointer), null);
      pulse(home);
    }
  }

  // ---- the win: tutorial done → outro over the victory sheet → pointer --------------------------
  function onWon() {
    if (!won) {
      won = true;
      if (setTutorial(store.profile, 'done')) commitStory();
      setStep(null);
      hideFloating();
      outro = 'waiting';
    }
    const sheetUp = !!q('[data-testid="result"]:not([hidden]) .bt-result');
    if (outro === 'waiting' && sheetUp) {
      outro = 'scheduled';
      later(playOutro, OUTRO_DELAY_MS);
    }
    if (outro === 'over' && sheetUp) pointerCard();
  }

  async function playOutro() {
    outro = 'playing';
    try {
      const [idx, play] = await Promise.all([import('../../data/story/index.js'), import('./play.js')]);
      const scene = idx.sceneById('tut.outro');
      if (scene && !dead) await play.playStoryScene(scene, { host: document.body, overlay: true, scenes: idx.SCENE_LIST });
    } catch (e) {
      console.warn('[coach] the tutorial outro failed', e);
    }
    outro = 'over';
    if (!dead) tick();
  }

  function hideFloating() {
    bubble.classList.remove('on');
    ring.classList.remove('on');
    hand.classList.remove('on');
    scrim.classList.remove('on');
    pill.hidden = true;
  }

  // ---- render ------------------------------------------------------------------------------------
  function render() {
    if (dead) return;
    root.hidden = !!ctx.paused;
    if (ctx.paused) return;
    if (won) {
      hideFloating();
      return;
    }
    if (step === 'lost') {
      hideFloating();
      lostCard();
      return;
    }
    if (inline.kind === 'lost') clearInline();

    const now = performance.now();
    const peeking = !step && peekUntil > now;
    const folded = userMin || (autoMin && !peeking);
    const showBubble = !folded && (!!step || peeking);
    pill.hidden = !(folded && (userMin || autoMin));
    if (!showBubble) {
      bubble.classList.remove('on');
      ring.classList.remove('on');
      hand.classList.remove('on');
      scrim.classList.remove('on');
      return;
    }

    const base = layer.getBoundingClientRect();
    if (base.width < 10) return;
    const placing = !!ctx.placement?.unitId;
    let target = null;
    let round = false;
    let from = null;
    let to = null;
    const holes = [];
    if (step && step !== 'free') {
      if (step === 'upgrade') {
        const t = upgradeTarget();
        const buy = t ? buyButton(t) : null;
        if (buy) target = pad(relRect(buy, base), 5);
        else if (t) {
          const p = screenPoint(t.x, t.y, 0.45, base);
          if (p) {
            target = { x: p.x - 34, y: p.y - 40, w: 68, h: 68 };
            round = true;
          }
        }
      } else {
        target = pad(relRect(domTarget(step), base), 5);
      }
      if (target) holes.push({ ...target, r: round ? target.w / 2 : 14 });
      if (step === 'place' && !placing && target) {
        const hs = handSpot(base);
        if (hs) {
          from = { x: target.x + target.w / 2, y: target.y + target.h * 0.42 };
          to = hs.finger;
          holes.push({ x: hs.spot.x - 34, y: hs.spot.y - 34, w: 68, h: 68 + lift, r: 34 });
          root.dataset.spotX = String(Math.round(hs.spot.x));
          root.dataset.spotY = String(Math.round(hs.spot.y));
        }
      }
    }
    // keep the ring inside the screen (the speed button sits in the top-right corner)
    if (target && !round) {
      const x0 = Math.max(4, target.x);
      const y0 = Math.max(4, target.y);
      target = { x: x0, y: y0, w: Math.min(base.width - 4, target.x + target.w) - x0, h: Math.min(base.height - 4, target.y + target.h) - y0 };
    }
    setRing(target, round);
    setHand(from, to);
    const fresh = now - stepSince < SCRIM_MS;
    setScrim(base, holes, fresh && !placing && step !== 'free' && !ctx.ended);
    const keepOut = [target, to && { x: to.x - 44, y: to.y - lift - 64, w: 88, h: lift + 120 }].filter(Boolean);
    placeBubble(base, keepOut, !bubble.classList.contains('on'));
    bubble.classList.add('on');
  }

  // ---- loop --------------------------------------------------------------------------------------
  function tick() {
    if (dead) return;
    let snap;
    try {
      snap = coachSnapshot(sim, ctx);
    } catch (e) {
      console.warn('[coach] snapshot failed', e);
      return;
    }
    if (snap.state === 'won' || won) {
      onWon();
      render();
      return;
    }
    updateDone(snap, done);
    if (step === 'free' && performance.now() - stepSince >= FREE_MS) {
      done.add('free');
      minimise(false);
    }
    const next = nextStep(snap, done, lastCore);
    if (next !== step) setStep(next);
    if (CORE_STEPS.includes(next)) lastCore = next;
    render();
  }

  const onResize = () => render();
  window.addEventListener('resize', onResize);
  const timer = setInterval(tick, TICK_MS);
  tick();

  function dispose() {
    if (dead) return;
    dead = true;
    clearInterval(timer);
    for (const t of timers) clearTimeout(t);
    timers.clear();
    window.removeEventListener('resize', onResize);
    clearInline();
    root.remove();
  }

  // a battle that ended in victory always counts, even if the player leaves before the outro
  return () => {
    if (!dead && sim.state === 'won' && storyOf(store.profile).tutorial === 'pending' && setTutorial(store.profile, 'done')) commitStory();
    dispose();
  };
}

/**
 * 1-1 stage prep prompt for a tutorial that was started but not finished (STORY_SPEC §2.1): [Start with Hikari]
 * opens the coached battle, [Not now] marks it skipped so it is never asked again.
 * @param {{ onStart: () => void, onLater: () => void }} handlers
 */
export function showTutorialPrompt({ onStart, onLater }) {
  const hikari = UNIT_MAP.hikari;
  const body = h('div.tp-body', { 'data-testid': 'tutorial-prompt' },
    h('div.tc-thumb', { html: hikari ? portraitHTML(hikari, 'thumb', { eager: true, alt: '' }) : '' }),
    h('p', resolveText(TUTORIAL_TEXT.prepPrompt), h('small', resolveText(TUTORIAL_TEXT.prepNote))));
  return new Promise((resolve) => {
    let off = () => {};
    const end = (how, fn) => (close) => {
      off();
      close();
      fn?.();
      resolve(how);
    };
    const m = modal({
      title: resolveText('{name:hikari}'),
      body,
      cls: 'tp-modal',
      dismissable: false,
      actions: [
        { label: resolveText(TUTORIAL_TEXT.prepLater), kind: 'ghost', testid: 'tutorial-later', onClick: end('later', onLater) },
        { label: resolveText(TUTORIAL_TEXT.prepStart), kind: 'primary', testid: 'tutorial-start', onClick: end('start', onStart) },
      ],
    });
    // leaving stage prep (browser back) closes the question without answering it
    const onScreen = () => end('closed')(m.close);
    window.addEventListener('screenchange', onScreen);
    off = () => window.removeEventListener('screenchange', onScreen);
  });
}
