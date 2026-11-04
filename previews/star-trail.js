// Star trail lab (docs/VFX.md "Star trail"): the effect in src/render/vfx/starTrail.js on a recruit-like night sky, landing
// on a recruit card and playing its burst. Dev-only: nothing here is in the game build, and the lil-gui panel lives
// only in previews/star-trail-gui.js (never in src).
//
// It loops preset × tier × Reduce Motion at 844x390, 1280x720 and 390x844 (the "cycle" toggle, or ?cycle=1), or one
// combination: ?preset=prism|nightglass&tier=high|medium|low&rm=1&vp=844x390|1280x720|390x844.
// Captures: ?manual=1 (the stage fills the window, no animation loop) and drive it from the page:
//   window.__lab.set({ preset, tier, rm })   window.__lab.seek(seconds) → stats   window.__lab.timeline()
//   window.__lab.setReduceMotion(on)  (mid-flight, as the game's setting would)
//   (the stats carry `head`: the star's centre and drawn radius this frame, in CSS px, for the board's pixel gate)
// The host side is set up as the recruit overlay will be: its own transparent canvas (alpha, premultiplied, no
// antialias), DPR capped by the tier, an orthographic camera in CSS px (y down), the effect stepped by the lab's clock.
import * as THREE from 'three';
import { createStarTrail, SHAPE } from '../src/render/vfx/starTrail.js';
import { STAR_TRAIL_PRESETS, STAR_TRAIL_TIERS, STAR_TRAIL_CALM } from '../src/render/vfx/starTrailPresets.js';
import { createVisualRandom, visualSeed } from '../src/render/vfx/random.js';
import { UNIT_MAP } from '../src/data/units.js';
import { markRecipe } from '../src/ui/recruit/emblem.js';

const Q = new URLSearchParams(location.search);
const MANUAL = Q.get('manual') === '1';
const FILL = MANUAL || Q.get('fill') === '1';
if (FILL) document.body.classList.add('fill');

export const VIEWPORTS = ['844x390', '1280x720', '390x844'];
const PRESETS = Object.keys(STAR_TRAIL_PRESETS);
const TIERS = Object.keys(STAR_TRAIL_TIERS);
/** whose card each preset lands on (an SSR for Prism, an LR for Nightglass); her mark's accent tints the star */
const GIRL = { prism: 'luna', nightglass: 'tenka' };
const RARITY = { prism: { label: 'SSR', color: '#ff7ad9' }, nightglass: { label: 'LR', color: '#ffd27a' } };

const state = {
  preset: PRESETS.includes(Q.get('preset')) ? Q.get('preset') : 'prism',
  tier: TIERS.includes(Q.get('tier')) ? Q.get('tier') : 'high',
  rm: Q.get('rm') === '1',
  viewport: VIEWPORTS.includes(Q.get('vp')) ? Q.get('vp') : '844x390',
  accent: Q.get('accent') !== '0',
  loop: true,
  cycle: Q.get('cycle') === '1',
  speed: Number(Q.get('speed')) || 1,
  pause: false,
};

const stage = document.getElementById('stage');
const starsCanvas = stage.querySelector('canvas.stars');
const fxCanvas = stage.querySelector('canvas.fx');
const card = stage.querySelector('.card');
const hud = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ canvas: fxCanvas, alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, 844, 0, 390, -10, 10);
const rand = createVisualRandom(1);
const trail = createStarTrail({ parent: scene, quality: state.tier, reduceMotion: state.rm, rand });

let W = 844;
let H = 390;
let from = [0, 0];
let to = [0, 0];
let clock = 0; // the lab's visual clock (seconds since this run's launch)
let endAt = Infinity;
let flipAt = Infinity;
let lastCalls = 0;
let maxCalls = 0;

function size() {
  if (FILL) return [window.innerWidth, window.innerHeight];
  const [w, h] = state.viewport.split('x').map(Number);
  return [w, h];
}

function layout() {
  [W, H] = size();
  stage.style.width = `${W}px`;
  stage.style.height = `${H}px`;
  const tier = STAR_TRAIL_TIERS[state.tier];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.dpr || 1));
  renderer.setSize(W, H, false);
  camera.left = 0;
  camera.right = W;
  camera.top = 0;
  camera.bottom = H;
  camera.updateProjectionMatrix();
  trail.setView(W, H);
  // the card: the middle of the screen, as a 1× pull deals it
  const portrait = H > W;
  const ch = portrait ? (W * 0.4) / 0.6 : H * 0.52;
  const cw = ch * 0.6;
  const cx = W * 0.5;
  const cy = H * 0.54;
  Object.assign(card.style, { width: `${cw}px`, height: `${ch}px`, left: `${cx - cw / 2}px`, top: `${cy - ch / 2}px` });
  to = [cx, cy]; // on the card back's own sparkle
  from = portrait ? [W * 0.12, H * 0.13] : [W * 0.08, H * 0.14];
  paintStars();
}

/** A faint seeded star field (the recruit's own starlight is drawn the same way, on its 2D canvas). */
function paintStars() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  starsCanvas.width = Math.round(W * dpr);
  starsCanvas.height = Math.round(H * dpr);
  const g = starsCanvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const r = createVisualRandom(visualSeed('star-lab-sky', W, H));
  const n = Math.round((W * H) / 4200);
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const y = r() * H;
    const s = 0.5 + r() * r() * 1.4;
    g.globalAlpha = 0.18 + r() * 0.5;
    g.fillStyle = r() < 0.25 ? '#cfd8ff' : r() < 0.5 ? '#ffe6f4' : '#ffffff';
    g.beginPath();
    g.arc(x, y, s, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

function setCard() {
  const id = GIRL[state.preset];
  const u = UNIT_MAP[id];
  const rar = RARITY[state.preset];
  card.style.setProperty('--rc', rar.color);
  card.classList.toggle('lr', state.preset === 'nightglass');
  card.querySelector('img').src = `/art/portraits/${id}-card.webp`;
  card.querySelector('.rar').textContent = rar.label;
  card.querySelector('.nm').textContent = u?.name || id;
}

function flip(on) {
  card.classList.toggle('instant', MANUAL);
  card.classList.toggle('flipped', on);
}

/** The timeline of the current combination (s): flight, swell, shards, total; Reduce Motion: fade in, hold, out. */
function timeline() {
  const p = STAR_TRAIL_PRESETS[state.preset];
  if (state.rm) {
    const C = STAR_TRAIL_CALM;
    return { calm: true, land: C.fadeIn, total: C.fadeIn + C.hold + C.fadeOut };
  }
  return { calm: false, flight: p.flight.seconds, swell: p.burst.swell, shards: p.burst.seconds, land: p.flight.seconds, total: p.flight.seconds + p.burst.swell + p.burst.seconds };
}

function restart() {
  setCard();
  flip(false);
  card.classList.add('instant');
  void card.offsetWidth; // (the reset is instant, the landing flip animates)
  if (!MANUAL) card.classList.remove('instant');
  trail.setQuality(state.tier);
  trail.setReduceMotion(state.rm);
  rand.reseed(visualSeed('star-lab', state.preset, state.tier));
  clock = 0;
  maxCalls = 0;
  endAt = Infinity;
  flipAt = Infinity;
  const p = STAR_TRAIL_PRESETS[state.preset];
  const accent = state.accent ? markRecipe(UNIT_MAP[GIRL[state.preset]], { lr: state.preset === 'nightglass' }).accent : null;
  const ok = trail.launch(state.preset, from, to, {
    bend: -p.flight.bend,
    accent,
    // the host turns her card once the star has landed (step 2 waits on this). Here it turns half-way through the
    // shards: the swell and the burst play over the dark card back, then her art comes round
    // (Reduce Motion: once the still star has been seen on the card back)
    onLand: () => {
      flipAt = clock + (state.rm ? STAR_TRAIL_CALM.hold : p.burst.swell + p.burst.seconds * 0.55);
    },
  });
  if (!ok) endAt = 1.2; // low: no WebGL (the 2D fallback comes in step 2)
}

function step(dt) {
  clock += dt;
  trail.update(dt);
  if (clock >= flipAt) {
    flip(true);
    flipAt = Infinity;
  }
  const s = trail.stats();
  if (!s.alive && endAt === Infinity) endAt = clock + 0.7;
}

function render() {
  renderer.render(scene, camera);
  lastCalls = renderer.info.render.calls;
  maxCalls = Math.max(maxCalls, lastCalls);
}

/** The star this frame (its STAR4 instance): { x, y, r } in CSS px, or null when none is drawn. */
function head() {
  const { iA, iB } = trail.buffers;
  const n = trail.stats().sprites;
  for (let i = 0; i < n; i++) if (iA[i * 4 + 3] === SHAPE.STAR4) return { x: iA[i * 4], y: iA[i * 4 + 1], r: iB[i * 4] };
  return null;
}

function hudText() {
  const s = trail.stats();
  const tier = STAR_TRAIL_TIERS[state.tier];
  const dpr = renderer.getPixelRatio();
  return [
    `${STAR_TRAIL_PRESETS[state.preset].label} · ${state.tier}${state.rm ? ' · Reduce Motion' : ''} · ${W}x${H} @${dpr}x`,
    `phase ${s.phase.padEnd(8)} t ${clock.toFixed(2)} s`,
    tier.webgl ? `calls ${lastCalls} (renderer) / ${s.calls} (effect) · max ${maxCalls}` : 'low: no WebGL (2D fallback is step 2)',
    `joints ${s.joints} · sprites ${s.sprites} · area ${s.screens.toFixed(3)} screens (peak ${s.peakScreens.toFixed(3)})`,
    MANUAL ? '' : 'keys: P preset · T tier · R reduce motion · V viewport · C cycle · Space replay · L land now',
  ].filter(Boolean).join('\n');
}

const COMBOS = [];
for (const viewport of VIEWPORTS) for (const preset of PRESETS) for (const tier of ['high', 'medium']) for (const rm of [false, true]) COMBOS.push({ viewport, preset, tier, rm });
let comboAt = 0;

function next() {
  if (state.cycle) {
    comboAt = (comboAt + 1) % COMBOS.length;
    Object.assign(state, COMBOS[comboAt]);
    layout();
  }
  restart();
}

function apply() {
  layout();
  restart();
}

let last = 0;
function frame(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
  last = now;
  if (!state.pause) {
    step(dt * state.speed);
    if (clock >= endAt && state.loop) next();
  }
  render();
  hud.textContent = hudText();
  requestAnimationFrame(frame);
}

const lab = {
  state,
  apply,
  replay: restart,
  land: () => trail.land(),
  setReduceMotion(on) {
    state.rm = !!on;
    trail.setReduceMotion(state.rm);
    return lab.info();
  },
  set(o = {}) {
    Object.assign(state, o);
    apply();
    return lab.info();
  },
  /** Restarts and steps the clock to `t` seconds at 60 Hz (exact, repeatable), then renders. */
  seek(t) {
    restart();
    const n = Math.round(Math.max(0, t) * 60);
    for (let i = 0; i < n; i++) step(1 / 60);
    render();
    return lab.info();
  },
  /** Steps on from where it is (frame strips). */
  advance(frames = 1) {
    for (let i = 0; i < frames; i++) step(1 / 60);
    render();
    return lab.info();
  },
  timeline,
  info() {
    return { ...trail.stats(), head: head(), rendererCalls: lastCalls, maxCalls, W, H, dpr: renderer.getPixelRatio(), clock, state: { ...state } };
  },
};
window.__lab = lab;

window.addEventListener('resize', () => FILL && apply());
window.addEventListener('keydown', (e) => {
  const cyc = (list, v) => list[(list.indexOf(v) + 1) % list.length];
  const k = e.key.toLowerCase();
  if (k === 'p') state.preset = cyc(PRESETS, state.preset);
  else if (k === 't') state.tier = cyc(TIERS, state.tier);
  else if (k === 'r') state.rm = !state.rm;
  else if (k === 'v') state.viewport = cyc(VIEWPORTS, state.viewport);
  else if (k === 'c') state.cycle = !state.cycle;
  else if (k === 'l') return trail.land();
  else if (k !== ' ') return;
  e.preventDefault();
  apply();
});

apply();
if (MANUAL) {
  render();
} else {
  requestAnimationFrame(frame);
  // the panel is optional: lil-gui is a dev dependency, and the lab still runs on the keys without it
  import('./star-trail-gui.js').then((m) => m.mountGui(lab, { presets: PRESETS, tiers: TIERS, viewports: VIEWPORTS })).catch(() => {});
}
