// The recruit cinematic (docs/RECRUIT_CINEMATIC.md): the academy's Gate powering on (blue; an SSR surges it to a
// rainbow with arcs and shake; an LR on to the starlit Nightglass), then a full-screen reveal for every SSR and
// LR (silhouette → her art sweeps in → name, title, stars → her mark stamps in). Display only: the pull is
// already saved when this starts, and nothing here reads or writes the save beyond the comfort settings.
//
// Comfort: a tap during the Gate runs it TAP_SPEED× faster (a second tap opens it), a tap mid-reveal shows it
// all at once (another moves on), Skip all ends everything. Reduce motion plays the calm fade version; Flashes &
// shake off drops the shake and the flashes; flashes otherwise go through the flash guard (src/render/vfx/flashGuard.js).
// Time: one requestAnimationFrame loop advancing its own clock by the frame delta (capped), never Date.now or
// performance.now; randomness only from the seeded visual stream.
import { h } from '../dom.js';
import { createVisualRandom, visualSeed } from '../../render/vfx/random.js';
import { FlashGuard, FAINT } from '../../render/vfx/flashGuard.js';
import { portraitUrl, portraitHTML } from '../../art/portraits.js';
import { planCinematic, gateAt, gatePhaseStart, revealAt, revealHoldStart, revealStars, TAP_SPEED } from './plan.js';
import { createGate } from './gate.js';
import { CinematicFx } from './fx.js';
import { markSVG } from './emblem.js';

/** Longest frame step (s): a dropped frame or a background tab never jumps the cinematic ahead. */
const MAX_STEP = 1 / 10;
/** Canvas resolution cap (phones first). */
const MAX_DPR = 1.5;
/** How long a flash takes to fade (s). */
const FLASH_FADE = 0.3;

const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * @param {HTMLElement} overlay the reveal overlay (.ma-gacha)
 * @param {Array<object>} results the pull (already saved)
 * @param {{ reduce?: boolean, effects?: boolean, skipGate?: boolean, isLegend?: (id: string) => boolean,
 *   unitOf: (id: string) => object, kickerOf?: (r: object) => string, cue?: (name: string, data?: object) => void }} o
 */
export function createCinematic(overlay, results, o) {
  const plan = planCinematic(results, o);
  const unitOf = o.unitOf;
  const cue = o.cue || (() => {});
  const seed = visualSeed('recruit', ...results.map((r) => r.unitId));
  const rand = createVisualRandom(seed);
  const guard = new FlashGuard({ reduceMotion: plan.reduce });
  const fx = new CinematicFx(rand.fork('fx'), { reduce: plan.reduce });
  let gate = null;

  // layers behind the stage: the Gate and the effects (they shake together, sideways only), and the flash tint
  const shakeEl = h('div.rc-shake');
  const layers = h(`div.rc-layers.tier-${plan.tier}${plan.reduce ? '.rc-calm' : ''}`, { 'aria-hidden': 'true' }, shakeEl);
  const flashEl = h('div.rc-flash', { 'aria-hidden': 'true' });
  shakeEl.appendChild(fx.el);
  overlay.prepend(layers);
  overlay.appendChild(flashEl);

  // her art starts loading now, while the Gate plays (one webp each)
  for (const r of plan.reveals) {
    const url = portraitUrl(r.unitId, 'cut');
    if (url) {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  }

  const state = {
    mode: 'idle', // 'gate' | 'reveal' | 'idle' | 'settled' | 'disposed'
    t: 0, // the clock (s), scaled by timeScale
    rt: 0, // real seconds since start (the flash guard's window)
    timeScale: 1,
    gateT: 0,
    gatePhase: plan.gate ? 'power' : 'done',
    flash: 0,
    flashPeak: 0,
    shake: 0,
    reveal: null,
    taps: 0,
    seen: [], // phases and stages in the order they played (e2e)
    frozen: false, // e2e captures: the clock holds still
  };
  let raf = 0;
  let last = null;
  let gateDone = null;
  let lastPhase = null;

  // e2e and debugging: what is playing (window.__sakura.recruitCinematic)
  const debug = () => ({ tier: plan.tier, mode: state.mode, gatePhase: state.gatePhase, reveal: state.reveal ? { unitId: state.reveal.r.unitId, lr: state.reveal.r.lr, stage: state.reveal.stage } : null,
    reveals: plan.reveals.length, reduce: plan.reduce, shake: plan.shake, flashes: plan.flashes, flashCount: guard.times.length, refused: guard.refused, timeScale: state.timeScale,
    seen: state.seen.slice() });
  try {
    window.__sakura ||= {};
    // freeze(true) holds the clock still so a capture lands on an exact moment (e2e, the owner boards)
    window.__sakura.recruitCinematic = { state: debug, freeze: (on) => { state.frozen = !!on; if (!on) { last = null; run(); } } };
  } catch { /* no window */ }

  function size() {
    const w = overlay.clientWidth || window.innerWidth;
    const hh = overlay.clientHeight || window.innerHeight;
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    fx.resize(w, hh, dpr);
    gate?.resize(w, hh, dpr);
    if (gate) fx.center = gate.center();
  }
  const onResize = () => size();
  window.addEventListener('resize', onResize);

  function flash(strength) {
    // with Flashes & shake off or Reduce motion only a faint tint (too weak to count as a flash)
    const o2 = plan.flashes ? guard.flash(strength, state.rt) : Math.min(FAINT, strength);
    if (o2 > state.flash) {
      state.flash = o2;
      state.flashPeak = o2;
    }
  }

  function setGateFx(s) {
    const { phase, p } = s;
    const tier = plan.tier;
    fx.center = gate.center();
    const gold = plan.accent === 'gold';
    fx.sparkColor = gold ? [255, 214, 130] : [170, 220, 255];
    fx.sparkHue = null;
    fx.arcHue = null;
    fx.rayHue = null;
    fx.rayColor = [160, 215, 255];
    fx.arcRate = 0;
    fx.petalRate = plan.reduce ? 1.5 : 4;
    state.shake = 0;
    if (phase === 'power') {
      fx.sparkRate = plan.reduce ? 0 : 8 + 30 * p;
      fx.rays = 0;
    } else if (phase === 'surge') {
      fx.sparkRate = plan.reduce ? 6 : 40 + 70 * p;
      fx.sparkHue = s.hue;
      fx.arcRate = plan.arcs ? 6 + 20 * p : 0;
      fx.arcHue = s.hue;
      fx.rays = plan.reduce ? 0.15 * p : 0.1 + 0.3 * p;
      fx.rayHue = plan.reduce ? null : s.hue;
      if (plan.shake) state.shake = 2 + 6 * smooth(p);
    } else if (phase === 'night') {
      const k = smooth(clamp01(p * 1.6));
      fx.sparkRate = plan.reduce ? 4 : 50 * (1 - k) + 25;
      fx.sparkHue = k < 0.6 ? s.hue : null;
      fx.sparkColor = [255, 214, 140];
      fx.arcRate = plan.arcs ? 18 * (1 - k) + 3 : 0;
      fx.arcHue = k < 0.5 ? s.hue : null;
      fx.arcColor = [255, 220, 150];
      fx.starAmount = k;
      fx.rays = 0.3 + 0.15 * Math.sin(p * Math.PI);
      fx.rayHue = k < 0.5 && !plan.reduce ? s.hue : null;
      fx.rayColor = [255, 222, 160];
      if (plan.shake) state.shake = 8 * (1 - k) + 2 * Math.sin(p * Math.PI);
    } else if (phase === 'open') {
      fx.sparkRate = 0;
      fx.arcRate = 0;
      fx.rays = 0.6 * (1 - p * 0.5);
      fx.rayHue = tier === 'rainbow' && !plan.reduce ? s.hue : null;
      fx.rayColor = tier === 'lr' ? [255, 222, 160] : [170, 220, 255];
      if (plan.shake) state.shake = 9 * (1 - smooth(p));
    }
  }

  function gateEnergy(phase, p) {
    if (phase === 'power') return 0.15 + 0.55 * smooth(p);
    if (phase === 'surge') return 0.7 + 0.3 * p;
    if (phase === 'night') return 0.85 + 0.15 * Math.sin(p * Math.PI * 3);
    return 1;
  }

  function stepGate(dt) {
    state.gateT += dt;
    const at = gateAt(plan.gate, state.gateT);
    const hue = (state.t * 220) % 360;
    if (at.phase !== lastPhase) {
      lastPhase = at.phase;
      state.gatePhase = at.phase;
      state.seen.push(at.phase);
      if (at.phase === 'surge') cue('gacha.surge', { tier: plan.tier });
      if (at.phase === 'night') cue('gacha.surge', { tier: 'lr' });
      if (at.phase === 'open') {
        cue('gacha.open');
        const c = gate.center();
        fx.burst(c.x, c.y, { count: plan.tier === 'blue' ? 50 : plan.tier === 'lr' ? 140 : 110, speed: plan.tier === 'lr' ? 620 : 520,
          hue: plan.tier === 'rainbow' ? hue : null, color: plan.tier === 'lr' ? [255, 222, 160] : plan.accent === 'gold' ? [255, 214, 130] : [190, 230, 255] });
        flash(plan.tier === 'blue' ? 0.35 : 0.5);
      }
      if (at.phase === 'done') {
        state.mode = 'idle';
        layers.classList.add('rc-opened');
        fx.rays = 0;
        fx.starAmount = plan.tier === 'lr' ? 0.35 : 0;
        const done = gateDone;
        gateDone = null;
        done?.();
      }
    }
    const s = { t: state.t, dt, phase: at.phase, p: at.p, tier: plan.tier, accent: plan.accent, energy: gateEnergy(at.phase, at.p), hue, reduce: plan.reduce, openPeak: plan.flashes ? guard.cap : 0.3 };
    if (at.phase !== 'done') setGateFx(s);
    gate.update(s);
  }

  function stepReveal(dt) {
    const rv = state.reveal;
    rv.t += dt;
    const at = revealAt(rv.r.times, rv.t);
    if (at.stage !== rv.stage) enterStage(rv, at.stage);
    if (rv.stage === 'mark' && !rv.stamped && at.p >= 0.45) stamp(rv);
    if (at.stage === 'done') endReveal();
  }

  function enterStage(rv, stage) {
    rv.stage = stage;
    state.seen.push(`reveal:${stage}`);
    if (stage === 'done') return;
    rv.el.classList.add(`s-${stage}`);
    rv.el.dataset.stage = stage;
    const box = rv.el.getBoundingClientRect();
    const art = rv.art.getBoundingClientRect();
    fx.center = { x: art.left - box.left + art.width / 2, y: art.top - box.top + art.height * 0.45, r: Math.min(art.width, art.height) * 0.4 };
    fx.sparkColor = rv.r.lr ? [255, 214, 140] : [255, 200, 235];
    fx.sparkHue = rv.r.lr || plan.reduce ? null : (state.t * 120) % 360;
    if (stage === 'silhouette') fx.sparkRate = plan.reduce ? 0 : rv.r.lr ? 50 : 30;
    if (stage === 'sweep') {
      fx.sparkRate = plan.reduce ? 0 : 18;
      if (!plan.reduce) fx.burst(fx.center.x - fx.center.r, fx.center.y, { count: 24, speed: 260, color: fx.sparkColor, hue: fx.sparkHue, ring: false });
    }
    if (stage === 'text') cue('gacha.name', { unitId: rv.r.unitId, lr: rv.r.lr });
    if (stage === 'hold') {
      fx.sparkRate = plan.reduce ? 0 : 6;
      fx.petalRate = plan.reduce ? 1.5 : 7;
    }
  }

  function stamp(rv, quiet = false) {
    rv.stamped = true;
    const box = rv.el.getBoundingClientRect();
    const m = rv.mark.getBoundingClientRect();
    const x = m.left - box.left + m.width / 2;
    const y = m.top - box.top + m.height / 2;
    cue('gacha.stamp', { unitId: rv.r.unitId, lr: rv.r.lr });
    fx.burst(x, y, { count: quiet ? 20 : rv.r.lr ? 90 : 60, speed: rv.r.lr ? 480 : 380, color: rv.r.lr ? [255, 222, 160] : [255, 220, 240], hue: rv.r.lr || plan.reduce ? null : (state.t * 120) % 360 });
    if (!quiet) {
      flash(rv.r.lr ? 0.42 : 0.32);
      if (plan.shake) state.shake = rv.r.lr ? 7 : 4;
    }
  }

  let revealDone = null;
  function endReveal() {
    const rv = state.reveal;
    if (!rv) return;
    state.reveal = null;
    state.mode = 'idle';
    layers.querySelector('.rc-shake')?.appendChild(fx.el);
    fx.center = gate ? gate.center() : fx.center;
    fx.sparkRate = 0;
    fx.petalRate = plan.reduce ? 1 : 3;
    rv.el.classList.add('rc-out');
    setTimeout(() => rv.el.remove(), 220);
    const done = revealDone;
    revealDone = null;
    done?.();
  }

  function frame(ts) {
    raf = 0;
    if (state.mode === 'disposed') return;
    if (state.frozen) return; // held still for a capture: nothing redraws until freeze(false)
    // a frame-rate cap (window.__sakura.recruitFrameCap, e2e on software-rendered browsers): skipped frames draw
    // nothing and the next drawn one steps the clock by the whole gap, so the timeline keeps real time
    const cap = window.__sakura?.recruitFrameCap;
    if (cap > 0 && last != null && ts - last < 1000 / cap) { raf = requestAnimationFrame(frame); return; }
    const dtReal = last == null ? 1 / 60 : Math.min(MAX_STEP, Math.max(0, (ts - last) / 1000));
    last = ts;
    state.rt += dtReal;
    const dt = dtReal * state.timeScale;
    state.t += dt;
    if (state.mode === 'gate' && gate) stepGate(dt);
    // (behind a full-screen reveal the Gate is hidden: it is not redrawn)
    else if (gate && state.mode !== 'settled' && state.mode !== 'reveal') gate.update({ t: state.t, dt, phase: 'done', p: 1, tier: plan.tier, accent: plan.accent, energy: 0.5, hue: (state.t * 60) % 360, reduce: plan.reduce, openPeak: 0 });
    if (state.mode === 'reveal' && state.reveal) stepReveal(dtReal);
    fx.update(dtReal);
    // the flash fades out; the shake is a sideways shift only (never a rotation)
    if (state.flash > 0) state.flash = Math.max(0, state.flash - (state.flashPeak / FLASH_FADE) * dtReal);
    flashEl.style.opacity = state.flash.toFixed(3);
    if (state.mode !== 'gate' && state.mode !== 'reveal') state.shake = Math.max(0, state.shake - 30 * dtReal);
    const sx = plan.shake && state.shake > 0.05 ? state.shake * (Math.sin(state.rt * 47) * 0.6 + Math.sin(state.rt * 31 + 1) * 0.4) : 0;
    const shaken = plan.shake && state.shake > 0.05;
    shakeEl.style.transform = shaken ? `translate3d(${sx.toFixed(2)}px,0,0)` : '';
    if (state.reveal && plan.shake) state.reveal.el.style.transform = shaken ? `translate3d(${(sx * 0.6).toFixed(2)}px,0,0)` : '';
    if (state.mode === 'settled' && !fx.busy && state.flash <= 0) return; // nothing left moving: stop drawing
    raf = requestAnimationFrame(frame);
  }
  const run = () => { if (!raf && state.mode !== 'disposed') raf = requestAnimationFrame(frame); };

  /** A tap anywhere during the Gate: faster, then straight to the opening. */
  function tapGate() {
    if (state.mode !== 'gate') return;
    state.taps++;
    if (state.timeScale === 1) state.timeScale = TAP_SPEED;
    else {
      const openAt = gatePhaseStart(plan.gate, 'open');
      if (state.gateT < openAt) state.gateT = openAt;
    }
  }

  /** A tap mid-reveal shows it all at once; at the hold it moves on. */
  function tapReveal() {
    const rv = state.reveal;
    if (!rv) return;
    if (rv.stage === 'hold') return endReveal();
    rv.el.classList.add('rc-instant', 's-silhouette', 's-sweep', 's-text', 's-mark');
    rv.t = revealHoldStart(rv.r.times);
    if (!rv.stamped) stamp(rv, true);
    enterStage(rv, 'hold');
  }

  function revealEl(r) {
    const u = unitOf(r.unitId);
    const cut = portraitUrl(u, 'cut');
    const stars = revealStars(r.lr);
    const art = h('div.rc-rv-art',
      cut ? h('img.rc-rv-sil', { src: cut, alt: '', draggable: false, decoding: 'async' }) : null,
      cut ? h('img.rc-rv-paint', { src: cut, alt: u.name, draggable: false, decoding: 'async' }) : h('div.rc-rv-paint.rc-rv-svg', { html: portraitHTML(u, 'full', { eager: true }) }),
      h('i.rc-rv-bar'),
    );
    const mark = h('div.rc-rv-mark', { 'data-testid': 'reveal-mark', html: markSVG(u, { lr: r.lr, label: `${u.name}'s mark` }) });
    const res = results[r.index] || {};
    const el = h(`div.ma-showcase.rc-reveal${r.lr ? '.is-lr' : '.is-ssr'}${plan.reduce ? '.rc-calm' : ''}`, {
      'data-testid': 'reveal-cine', 'data-unit': r.unitId, 'data-stage': 'start', role: 'group', 'aria-label': `${r.lr ? 'LR' : 'SSR'}: ${u.name}, ${u.title}`,
      onclick: (e) => { e.stopPropagation(); tapReveal(); },
    },
    h('div.rc-rv-bg', h('i.rc-rv-rays'), h('i.rc-rv-glow')),
    art,
    h('div.rc-rv-text',
      h('div.rc-rv-stars', { 'aria-label': `${stars} stars` }, Array.from({ length: stars }, (_, i) => h('span.rc-rv-star', { style: { '--i': i } }, '★'))),
      h('div.ma-showcase-kicker.rc-rv-kicker', { 'data-testid': 'showcase-kicker' }, o.kickerOf ? o.kickerOf(res) : r.lr ? 'LR unit' : 'SSR'),
      r.lr ? h('div.bn-lr-reveal', { 'data-testid': 'lr-reveal' }, h('i.bn-lr-crest.unlit'), 'LR unit · Limit Break to awaken her LR form') : null,
      h('div.rc-rv-name', u.name),
      h('div.rc-rv-title', u.title),
      u.quote ? h('div.rc-rv-quote', `“${u.quote}”`) : null,
    ),
    mark,
    h('div.rc-rv-tap', 'Tap to continue'),
    );
    const t = r.times;
    for (const [k, v] of Object.entries({ sil: t.silhouette, sweep: t.sweep, text: t.text, mark: t.mark })) el.style.setProperty(`--d-${k}`, `${Math.round(v * 1000)}ms`);
    return { el, art, mark };
  }

  const onOverlayTap = () => tapGate();
  overlay.addEventListener('click', onOverlayTap);

  return {
    plan,
    /** Plays the Gate (or nothing with skipGate). @returns {Promise<void>} once it has opened (or was skipped) */
    async playGate() {
      gate = await createGate({ reduce: plan.reduce, rand: rand.fork('gate') });
      if (state.mode === 'disposed' || state.mode === 'settled') { gate.dispose?.(); gate = null; return; }
      gate.el.classList.add('rc-gate');
      shakeEl.prepend(gate.el);
      size();
      if (!plan.gate) {
        cue('gacha.open');
        layers.classList.add('rc-opened');
        state.gatePhase = 'done';
        run();
        return;
      }
      state.mode = 'gate';
      cue('gacha.gate', { tier: plan.tier, count: results.length });
      run();
      await new Promise((resolve) => { gateDone = resolve; });
    },
    /** The full-screen reveal of plan.reveals[i]. @returns {Promise<void>} once it is done (tap, wait or skip) */
    reveal(i) {
      const r = plan.reveals[i];
      if (!r || state.mode === 'disposed' || state.mode === 'settled') return Promise.resolve();
      const { el, art, mark } = revealEl(r);
      overlay.insertBefore(el, flashEl);
      el.insertBefore(fx.el, el.querySelector('.rc-rv-text')); // the sparks play over her art, under her name
      fx.resize(overlay.clientWidth || window.innerWidth, overlay.clientHeight || window.innerHeight, Math.min(MAX_DPR, window.devicePixelRatio || 1));
      fx.starAmount = r.lr ? 0.8 : 0;
      cue('gacha.showcase', { unitId: r.unitId, lr: r.lr });
      state.mode = 'reveal';
      state.reveal = { r, el, art, mark, t: 0, stage: null, stamped: false };
      run();
      return new Promise((resolve) => { revealDone = resolve; });
    },
    /** Skip all / the results are up: everything ends now; the Gate stays dimly lit behind the results. */
    settle() {
      if (state.mode === 'disposed') return;
      if (state.reveal) {
        state.reveal.el.remove();
        state.reveal = null;
        layers.querySelector('.rc-shake')?.appendChild(fx.el);
      }
      state.mode = 'settled';
      state.shake = 0;
      fx.sparkRate = fx.arcRate = fx.petalRate = 0;
      fx.rays = 0;
      fx.starAmount = 0;
      layers.classList.add('rc-opened', 'rc-settled');
      shakeEl.style.transform = '';
      const g = gateDone;
      const rd = revealDone;
      gateDone = revealDone = null;
      g?.();
      rd?.();
      run();
    },
    get state() { return debug(); },
    dispose() {
      if (state.mode === 'disposed') return;
      state.mode = 'disposed';
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener('resize', onResize);
      overlay.removeEventListener('click', onOverlayTap);
      gate?.dispose?.();
      fx.dispose();
      const g = gateDone;
      const rd = revealDone;
      gateDone = revealDone = null;
      g?.();
      rd?.();
      try { if (window.__sakura?.recruitCinematic) delete window.__sakura.recruitCinematic; } catch { /* no window */ }
    },
  };
}
