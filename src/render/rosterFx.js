// Roster mechanics on the board (roster B3, docs/ATTACK_FX.md "Roster mechanics"): mortar warning
// rings + shell arcs, relay props (Ruri's holo fox, Iroha's mirror panel) with a dashed tether, aim
// reticles, curse bursts, Kanna's drum strike and Seiran's sky dragon. Purely visual: it reads sim
// events and sim state (towers, shells, runners, sim.time) and never writes to them. Iroha's panel moves
// with src/render/mirrorFx.js (this.mirrors): it flips and glints for each relayed bolt, leaves afterimages
// when it jumps and echoes while Mirror Shift runs.
//
//   const roster = new RosterFx({ sim, scene, fx, batches, atlas, actors, quality, reduceMotion });
//   roster.handle(ev)   // every drained sim event (BattleRenderer.handleEvents); true = drawn here
//   roster.update(dt)   // once per frame, after the events
import * as THREE from 'three';
import { GeoBuilder } from './geo.js';
import { createVisualRandom, visualSeed } from './vfx/random.js';
import { aimMode } from '../sim/towers.js';
import { runnerSegment } from '../sim/runners.js';
import { pointAt } from '../sim/path.js';
import { MirrorFx } from './mirrorFx.js';
import { panelSpot } from './mirrorPanel.js';
import { loadTripoProp, getTripoProp } from './tripoProps.js';

const TAU = Math.PI * 2;
const _spot = { x: 0, y: 0, beside: false };

/** Caps (keep draw calls and quads modest on phones). */
const MAX_WARN = 48;
const MAX_PROPS = 64;
/** Iroha's reflected-beam lines a frame (every girl together; low graphics: half). */
export const BEAMS_PER_FRAME = 48;
/** Body beads: one per sim segment and one between each two (the body reads as one serpent), all dragons together. */
const MAX_DRAGON_SEGS = 96;
const MAX_DRAGON_HEADS = 6;
/**
 * The sky dragon's look (display only; every bead sits on a sim segment from runnerSegment or halfway between two):
 * head and body sizes (instance scale), how high it flies, the arrival roar (seconds, head pop), the cloud trail's
 * spacing (seconds per puff, medium/high), its whisker / mane ribbons (points each).
 */
const DRAGON_HEAD = 3.1;
const DRAGON_BODY = 2.75;
const DRAGON_TAIL = 1.35;
const DRAGON_ALT = 1.3;
const ROAR_TIME = 0.6;
const ROAR_POP = 0.3;
const CLOUD_EVERY = 0.07;
const RIBBON_PTS = 5;
const MAX_CURSE_PER_FRAME = 10;
/**
 * Ena's spreading curse ('curseSpread'): a thin red card-thread from the passing enemy to the one that caught it, drawn
 * a little above the ground for SPREAD_LIFE s (shorter with Reduce motion, and drawn whole at once instead of running
 * out from the source). Alpha-blended ground quads only, no additive sprite and no flash, so the flash guard never
 * counts it; at most SPREAD_MAX live threads (the oldest gives way).
 */
const SPREAD_LIFE = 0.5;
const SPREAD_LIFE_RM = 0.3;
const SPREAD_MAX = 24;
const SPREAD_W = 0.06;
const SPREAD_RGB = [0.86, 0.12, 0.24];
/** A warning ring with no shellLand (wave clear, sold girl) disappears this long after its delay. */
const WARN_GRACE = 0.25;
/**
 * Sky dragons the wave clear removed mid-flight (ghosts) finish their flight to START on the board. All in
 * real seconds: within GHOST_TIME; with Auto start on, GHOST_LEAD before the next wave starts (its 1 s pause is
 * sim time, so 0.5 / 0.33 s at 2x / 3x); and a ghost still flying when a wave starts anyway (started early,
 * or the game sped up) rushes there within GHOST_RUSH.
 */
const GHOST_TIME = 1.2;
const GHOST_LEAD = 0.1;
const GHOST_RUSH = 0.2;

const COL = {
  warn: '#ff9a3c',
  shell: '#3a3f4a',
  familiar: '#9fdcff',
  mirror: '#d8c4f0',
  aimMortar: '#ffa040',
  aimMirror: '#d8b4ff',
  // Iroha's reflected legs (hers; an ally's copy), the Laser Web and the mirror being placed
  mirrorBeam: '#efe4ff',
  mirrorAlly: '#bfe6ff',
  mirrorWeb: '#c99cff',
  aimPick: '#ffd84a',
  aimUlt: '#9fd8ff',
  curse: '#b46cff',
  cursePetal: '#e9a8ff',
  drum: '#f589a0',
  sky: '#9fd8ff',
  gold: '#ffd77a',
  white: '#f4fbff',
};

function rgb(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}
const RGB = Object.fromEntries(Object.entries(COL).map(([k, v]) => [k, rgb(v)]));

// ---------------------------------------------------------------------------
// shared geometry (built once per renderer, merged + vertex coloured: one draw call per prop)
// ---------------------------------------------------------------------------

/** Kon: a small low-poly fox sitting up, facing +z (white with a pale-blue holo tint). */
function foxGeometry() {
  const W = '#f4fbff';
  const B = '#a8dcff';
  const K = '#1d2b4f';
  return new GeoBuilder({ flat: true })
    .blob(0.13, { y: 0.15, sx: 0.85, sy: 1.15, sz: 1.1, color: W }) // body
    .blob(0.11, { y: 0.34, z: 0.05, sx: 1.1, color: W }) // head
    .cone(0.05, 0.13, 4, { y: 0.31, z: 0.14, rx: Math.PI / 2, color: W }) // snout
    .blob(0.022, { y: 0.31, z: 0.27, color: K }) // nose
    .blob(0.022, { x: -0.05, y: 0.37, z: 0.14, color: K }) // eyes
    .blob(0.022, { x: 0.05, y: 0.37, z: 0.14, color: K })
    .cone(0.055, 0.15, 3, { x: -0.065, y: 0.4, z: 0.03, rz: 0.35, color: W }) // big ears
    .cone(0.055, 0.15, 3, { x: 0.065, y: 0.4, z: 0.03, rz: -0.35, color: W })
    .cone(0.03, 0.08, 3, { x: -0.07, y: 0.42, z: 0.045, rz: 0.35, color: B }) // inner ears
    .cone(0.03, 0.08, 3, { x: 0.07, y: 0.42, z: 0.045, rz: -0.35, color: B })
    .blob(0.09, { y: 0.2, z: -0.22, sx: 0.9, sz: 2.0, rx: 0.7, color: W }) // bushy tail, curling up
    .blob(0.06, { y: 0.33, z: -0.33, color: B }) // glowing tail tip
    .finish();
}

/** Iroha's mirror: an oval panel leaning back on a little tripod easel, facing +z. */
function mirrorGeometry() {
  const LEG = '#4a4560';
  const FRAME = '#9a6cc8';
  const GLASS = '#f4f2ff';
  const TILT = -0.5; // leans back so the glass reads from the high battle camera
  const g = new GeoBuilder({ flat: true });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + Math.PI / 6;
    g.cyl(0.012, 0.016, 0.36, 4, { x: Math.sin(a) * 0.09, z: Math.cos(a) * 0.09, rx: Math.cos(a) * 0.25, rz: -Math.sin(a) * 0.25, color: LEG });
  }
  g.torus(0.15, 0.022, 4, 18, { y: 0.52, sy: 1.4, rx: TILT, color: FRAME });
  const glass = new THREE.CircleGeometry(0.145, 18);
  const back = glass.clone();
  back.rotateY(Math.PI);
  glass.translate(0, 0, 0.005);
  back.translate(0, 0, -0.005);
  g.add(glass, { y: 0.52, sy: 1.4, rx: TILT, color: GLASS });
  g.add(back, { y: 0.52, sy: 1.4, rx: TILT, color: '#b8b0d0' });
  g.cone(0.03, 0.06, 4, { y: 0.74, z: -0.1, color: FRAME }); // little finial
  g.cyl(0.03, 0.03, 0.03, 6, { y: 0.32, color: LEG }); // easel head
  return g.finish();
}

/**
 * Dragon head (facing +z): light-blue skull and long snout, an open jaw, gold antler horns, a gold mane fanning back,
 * cheek frills and whisker roots (the long whiskers are ribbons drawn each frame, medium/high graphics).
 */
export function dragonHeadGeometry() {
  const S = '#9fd8ff';
  const D = '#6fb4e8';
  const L = '#e8f6ff';
  const G = '#ffd166';
  const O = '#ffb347';
  const K = '#1d2b4f';
  const g = new GeoBuilder({ flat: true })
    .blob(0.17, { sz: 1.2, color: S }) // skull
    .box(0.15, 0.09, 0.24, { y: -0.04, z: 0.2, color: D }) // snout
    .blob(0.055, { y: -0.01, z: 0.33, sx: 1.3, color: D }) // nose
    .box(0.13, 0.035, 0.2, { y: -0.11, z: 0.17, rx: 0.28, color: L }) // open jaw
    .blob(0.042, { x: -0.085, y: 0.05, z: 0.13, color: '#ffffff' }) // eyes
    .blob(0.042, { x: 0.085, y: 0.05, z: 0.13, color: '#ffffff' })
    .blob(0.026, { x: -0.09, y: 0.05, z: 0.165, color: K })
    .blob(0.026, { x: 0.09, y: 0.05, z: 0.165, color: K })
    .cone(0.03, 0.09, 4, { x: -0.08, y: 0.1, z: 0.12, rx: -1.2, color: G }) // brows
    .cone(0.03, 0.09, 4, { x: 0.08, y: 0.1, z: 0.12, rx: -1.2, color: G });
  for (const sx of [-1, 1]) {
    g.cone(0.036, 0.3, 4, { x: 0.07 * sx, y: 0.12, z: -0.06, rx: -1.1, rz: -0.25 * sx, color: G }); // antler
    g.cone(0.022, 0.13, 4, { x: 0.1 * sx, y: 0.2, z: -0.13, rx: -0.3, rz: -0.6 * sx, color: G }); // its tine
    g.cone(0.05, 0.16, 4, { x: 0.15 * sx, y: -0.02, z: 0.0, rz: -1.6 * sx, rx: -0.4, color: O }); // cheek frill
    g.cone(0.014, 0.18, 3, { x: 0.09 * sx, y: -0.04, z: 0.3, rz: -1.3 * sx, rx: -0.5, color: L }); // whisker root
  }
  // the mane: gold tufts fanning back from the crown and the nape
  const MANE = [[0, 0.17, G], [-0.08, 0.13, O], [0.08, 0.13, O], [-0.13, 0.05, G], [0.13, 0.05, G], [-0.06, -0.04, O], [0.06, -0.04, O]];
  for (const [x, y, c] of MANE) g.cone(0.055, 0.24, 4, { x, y, z: -0.15, rx: -1.75, rz: -x * 2.2, color: c });
  return g.finish();
}

/** Dragon body segment: a light-blue bead with a pale belly and a two-tone gold dorsal mane. */
function dragonSegGeometry() {
  return new GeoBuilder({ flat: true })
    .blob(0.14, { sz: 1.3, color: '#86ccf6' })
    .blob(0.1, { y: -0.055, sx: 0.95, sz: 1.2, color: '#e8f6ff' })
    .cone(0.07, 0.2, 4, { y: 0.1, rx: -0.6, color: '#ffd166' })
    .cone(0.05, 0.14, 4, { y: 0.09, z: -0.09, rx: -0.95, color: '#ffb347' })
    .finish();
}

/** Dragon tail tip: a tapering bead and a gold tuft fanning back. */
function dragonTailGeometry() {
  const g = new GeoBuilder({ flat: true }).blob(0.11, { sz: 1.4, color: '#86ccf6' });
  for (const [x, y, c] of [[0, 0.03, '#ffd166'], [-0.05, 0, '#ffb347'], [0.05, 0, '#ffb347']]) {
    g.cone(0.06, 0.26, 4, { x, y, z: -0.16, rx: -1.6, rz: -x * 4, color: c });
  }
  return g.finish();
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _seg = {};
const _segN = {};
const _head = { x: 0, y: 0 };
const _start = {};
const _la = new THREE.Vector3();
const _lb = new THREE.Vector3();
/** One reused FX spawn record (FxSystem.spawn copies it): no object per particle. */
const _sp = { batch: 'bbA', uv: null, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, s0: 0.2, s1: 0.2, asp: 1, life: 0.5, color: null, a0: 1, a1: 0, rot: 0, vrot: 0, fadeIn: 0, flags: 0 };
function fillSp(batch, uv, x, y, z, s0, s1, life, color, a0) {
  _sp.batch = batch;
  _sp.uv = uv;
  _sp.x = x;
  _sp.y = y;
  _sp.z = z;
  _sp.vx = 0;
  _sp.vy = 0;
  _sp.vz = 0;
  _sp.g = 0;
  _sp.drag = 0;
  _sp.s0 = s0;
  _sp.s1 = s1;
  _sp.asp = 1;
  _sp.life = life;
  _sp.color = color;
  _sp.a0 = a0;
  _sp.a1 = 0;
  _sp.rot = 0;
  _sp.vrot = 0;
  _sp.fadeIn = 0;
  _sp.flags = 0;
  return _sp;
}

export class RosterFx {
  /** @param {{ sim, scene, fx, batches, atlas, actors, quality?, camera?, reduceMotion?, rand? }} o */
  constructor({ sim, scene, fx, batches, atlas, actors, quality = 'medium', camera = null, reduceMotion = false, rand = null }) {
    this.sim = sim;
    // seeded render-only randomness (src/render/vfx/random.js): never Math.random, never the sim's rng
    this.rand = rand || createVisualRandom(visualSeed('roster'));
    /** the battle camera (the dragon's ribbons face it); none: no ribbons */
    this.camera = camera;
    this.reduceMotion = !!reduceMotion;
    this.fx = fx;
    this.b = batches;
    this.R = atlas.regions;
    this.actors = actors;
    this.quality = quality;
    this.time = 0;
    /** game speed (1-3x; setTimeScale): sim seconds per real second */
    this.timeScale = 1;
    this.selectedUid = null;
    this.root = new THREE.Group();
    this.root.name = 'rosterFx';
    scene.add(this.root);
    /** mortar warnings: { uid, x, y, r, delay, t0, towerUid, fx, fy } */
    this.warns = [];
    /** relay props by tower uid: { kind, mesh, x, y } */
    this.props = new Map();
    this._geo = null; // built on first need
    this._mats = null;
    this._dragon = null;
    /** last head position per runner uid (for the exit sparkle) */
    this._heads = new Map();
    /** each sky dragon in flight by runner uid, as last drawn: { pathIndex, dist, speed, segments, gap, end, seen } */
    this._flying = new Map();
    /**
     * dragons whose runner the wave clear removed mid-flight (Sim._checkWaveEnd: no runnerEnd). Nothing is
     * left to hit, so they fly on to START here and sparkle there:
     * { pathIndex, dist, speed (sim tiles/s), segments, gap, end, rem (real s left to reach START), head }
     */
    this._ghosts = [];
    this._spreads = []; // the spreading curse's live threads ('curseSpread', _drawSpreads)
    this._frame = 0;
    this._nh = 0; // heads / beads written this frame
    this._nb = 0;
    this._curseThisFrame = 0;
    /** companion figures (src/render/companions.js, set by the renderer): Kon's 3D figure replaces the holo fox */
    this.companions = null;
    /** Iroha's panel motion (flips, glints, afterimages; styles/iroha.js reports her relayed bolts to it) */
    this.mirrors = new MirrorFx({
      sim, fx, batches, atlas, root: this.root, quality, reduceMotion: this.reduceMotion,
      geometry: () => {
        this._ensureGeo();
        return this._geo.mirror;
      },
    });
  }

  setQuality(q) {
    this.quality = q;
    this.mirrors.setQuality(q);
  }

  /** Iroha's mirror being placed (aimControl.js; null: none): her reach ring, that mirror pulsing yellow. */
  setMirrorPick(uid, k = -1) {
    this.mirrorPick = uid == null ? null : { uid, k };
  }

  /** Test / e2e probe: the sky dragon meshes drawn this frame. */
  probe() {
    const D = this._dragon;
    return { heads: D ? D.head.count : 0, beads: D ? D.body.count : 0, tails: D ? D.tail.count : 0, ghosts: this._ghosts.length };
  }

  /** Game speed (1-3x, co-op: the shared speed): the board's frames are real time, the sim's clock is this much faster. */
  setTimeScale(s) {
    this.timeScale = Math.max(0.1, Math.min(8, Number(s) || 1));
  }

  setSelected(uid) {
    this.selectedUid = uid ?? null;
  }

  _tower(uid) {
    return uid != null && this.sim.getTower ? this.sim.getTower(uid) : null;
  }

  // ---- events ----------------------------------------------------------------------------

  /** @returns {boolean} true when the event was fully drawn here */
  handle(ev) {
    switch (ev.type) {
      case 'mortarWarn': {
        if (this.warns.length >= MAX_WARN) this.warns.shift();
        const t = this._tower(ev.towerUid);
        this.warns.push({
          uid: ev.uid, x: ev.x, y: ev.y, r: Math.max(0.2, ev.radius || 0.5), delay: Math.max(0.05, ev.delay || 1),
          t0: this.sim.time, towerUid: ev.towerUid, fx: t ? t.ox ?? t.x : null, fy: t ? t.oy ?? t.y : null,
        });
        return true;
      }
      case 'shellLand':
        this._dropWarn((w) => w.uid === ev.uid);
        return true; // the 'explode' event draws the blast
      case 'relay': {
        const p = this.props.get(ev.towerUid);
        if (p && p.kind === 'mirror') {
          // where the panel will be drawn (beside her when the origin is her own spot)
          const t = this._tower(ev.towerUid);
          const s = t ? this._mirrorSpot(t, ev.x, ev.y) : { x: ev.x, y: ev.y, beside: false };
          if (Math.hypot(p.x - s.x, p.y - s.y) > 0.5) {
            // the panel jumps (no glide): afterimages bridge where it was and where it lands
            this.mirrors.jump(ev.towerUid, p.x, p.y, s.x, s.y);
            p.x = s.x;
            p.y = s.y;
            if (this.reduceMotion) this.fx.ring(s.x, s.y, 0.5, 0.5, 0.35, COL.mirror);
            else this.fx.ring(s.x, s.y, 0.1, 0.6, 0.35, COL.mirror);
          }
          return true;
        }
        if (p && Math.hypot(p.x - ev.x, p.y - ev.y) > 0.5) {
          // the 3D Kon runs there himself: no puff where he left
          if (!this.companions?.konAt(ev.towerUid)) this.fx.puff(p.x, 0.2, p.y, '#ffffff', 4, 0.3, 0.25);
          this.fx.ring(ev.x, ev.y, 0.1, 0.55, 0.35, COL.familiar);
        }
        return true;
      }
      case 'ability':
        // Laser Web opens her echo window (the generic ability FX still draws the cast); the beams are drawn every
        // frame while it runs (_drawWebs)
        if (ev.id === 'iroha.mirrorShift') this.mirrors.ability(ev, this._tower(ev.towerUid));
        return false;
      case 'mirrorGlint': {
        // a bounce's glint (src/sim/mirrors.js): a thin flash from the mirror to the enemy it struck (the same budget)
        const cap = this.quality === 'low' ? BEAMS_PER_FRAME / 2 : BEAMS_PER_FRAME;
        if (this._beamsThisFrame >= cap) return true;
        this._beamsThisFrame++;
        this.fx.beam([ev.x, ev.y], [ev.tx, ev.ty], 0.03, COL.mirrorBeam, { life: 0.12, y: 0.8 });
        return true;
      }
      case 'mirrorBounce': {
        // a bolt reflected off one of Iroha's mirrors (src/sim/mirrors.js): the leg it just flew as a bright line, and a
        // glint on the glass (capped per frame; low graphics halves it)
        const cap = this.quality === 'low' ? BEAMS_PER_FRAME / 2 : BEAMS_PER_FRAME;
        if (this._beamsThisFrame >= cap) return true;
        this._beamsThisFrame++;
        this.fx.beam([ev.fx, ev.fy], [ev.x, ev.y], 0.05, ev.ownerUid === ev.towerUid ? COL.mirrorBeam : COL.mirrorAlly, { life: 0.18, y: 0.7 });
        if (this.quality !== 'low') this.fx.flash(ev.x, 0.9, ev.y, '#ffffff', 0.45, 0.12);
        // her first mirror turns toward the reflected bolt (mirrorFx's flip and glint)
        if (ev.mirror === 0) this.mirrors.shot(ev.towerUid, ev.x - ev.fx, ev.y - ev.fy);
        return true;
      }
      case 'aim':
        if (ev.x != null) {
          const t = this._tower(ev.towerUid);
          this.fx.ring(ev.x, ev.y, 0.5, 0.15, 0.3, aimColor(aimMode(t)), { uv: 'ringThick' });
        }
        return true;
      case 'sell': {
        const p = this.props.get(ev.towerUid);
        if (p) {
          this.fx.puff(p.x, 0.25, p.y, '#ffffff', 5, 0.3, 0.3);
          this._dropProp(ev.towerUid);
        }
        this._dropWarn((w) => w.towerUid === ev.towerUid);
        return false; // the renderer still draws its sell puff + coin
      }
      case 'curseBurst':
        this._curse(ev);
        return true;
      case 'curseSpread':
        if (this._spreads.length >= SPREAD_MAX) this._spreads.shift();
        // at the two enemies' own height (an overpass deck: e.elev), each read once
        // (a target that died the same frame is gone from the list: it takes the source's height)
        const h0 = this._elevOf(ev.from, 0);
        this._spreads.push({ x0: ev.x0, y0: ev.y0, x1: ev.x1, y1: ev.y1, h0, h1: this._elevOf(ev.to, h0), age: 0 });
        return true;
      case 'ult':
        // the renderer keeps its screen flash + shake; the map-wide ring is skipped for these two
        if (ev.effect === 'strike') this._strike(ev);
        // (Kogane's plow draws its own entry: src/render/staffFx.js)
        else if (ev.effect === 'runner' && this._tower(ev.towerUid)?.def?.hero?.ult?.effect?.runner !== 'plow') this._dragonEnter(ev);
        return false;
      case 'runner':
        // (seeded here too, so a dragon the wave clear removes before its first frame still finishes)
        if (ev.kind === 'dragon' && !this._flying.has(ev.uid)) {
          const segments = Math.max(1, ev.segments || 1);
          const gap = ev.gap ?? 0.6;
          const end = -(segments - 1) * gap;
          this._flying.set(ev.uid, { pathIndex: ev.pathIndex, dist: ev.dist, speed: (ev.dist - end) / Math.max(0.1, ev.time || 1), segments, gap, end, seen: this._frame, born: this.time, roared: false, cloud: 0 });
        }
        return false;
      case 'runnerEnd': {
        this._flying.delete(ev.uid);
        const h = this._heads.get(ev.uid);
        if (h) {
          this._exitSparkle(h.x, h.y);
          this._heads.delete(ev.uid);
        }
        return true;
      }
      case 'waveEnd':
        this._ghostDragons();
        return false;
      case 'waveStart':
        // a ghost still flying (the wave was started early, or the game sped up after the clear) rushes
        // to START and sparkles there: never dropped mid-road, never long over the next wave's spawns
        for (const g of this._ghosts) g.rem = Math.min(g.rem, GHOST_RUSH);
        return false;
      default:
        return false;
    }
  }

  _dropWarn(pred) {
    const w = this.warns;
    let n = 0;
    for (let i = 0; i < w.length; i++) if (!pred(w[i])) w[n++] = w[i];
    w.length = n;
  }

  _curse(ev) {
    if (this._curseThisFrame++ >= MAX_CURSE_PER_FRAME) return;
    const fx = this.fx;
    const d = Math.max(0, ev.depth || 0);
    const k = Math.max(0.4, 1 - 0.2 * d); // deeper generations: smaller + fainter
    const r = Math.max(0.3, ev.radius || 1);
    fx.ring(ev.x, ev.y, r * 0.15, r * k, 0.42, COL.curse, { a0: 0.95 * k });
    fx.spawn({ batch: 'groundA', uv: this.R.disc, x: ev.x, y: 0.05, z: ev.y, s0: r * 0.6, s1: r * 1.6 * k, life: 0.3, color: COL.curse, a0: 0.3 * k, flags: 8 });
    fx.flash(ev.x, 0.45, ev.y, COL.cursePetal, 0.8 * k, 0.16);
    const n = fx.n(Math.max(2, 6 - 2 * d));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + this.rand() * 0.5;
      const sp = 0.9 + this.rand() * 0.6;
      fx.spawn({
        batch: i % 2 ? 'bbA' : 'bbN', uv: i % 2 ? this.R.spark : this.R.petal, x: ev.x, y: 0.4, z: ev.y,
        vx: Math.cos(a) * sp * k, vy: 0.8 + this.rand() * 0.6, vz: Math.sin(a) * sp * k, g: -2.5, drag: 1.8,
        s0: 0.16 * k, s1: 0.08, life: 0.6, color: i % 2 ? COL.curse : COL.cursePetal, a0: k, rot: a, vrot: 5,
      });
    }
  }

  /** Kanna's Festival Drumfall: a light pillar onto the struck enemy and concentric coral shockwaves. */
  _strike(ev) {
    const fx = this.fx;
    const x = ev.x;
    const z = ev.y;
    fx.spawn({ batch: 'bbA', uv: this.R.ray || this.R.beam, x, y: 1.4, z, s0: 2.8, s1: 2.4, asp: 0.22, life: 0.3, color: COL.drum, a0: 0.95 });
    fx.flash(x, 0.5, z, '#ffd0da', 1.8, 0.25);
    // concentric rings: same start, staggered speeds → three waves rolling out together
    fx.ring(x, z, 0.2, 1.0, 0.3, COL.drum, { uv: 'ringThick' });
    fx.ring(x, z, 0.2, 1.8, 0.5, COL.drum, { uv: 'ringThick', a0: 0.85 });
    fx.ring(x, z, 0.2, 2.6, 0.75, COL.drum, { uv: 'ring', a0: 0.75 });
    if (this.quality !== 'low') fx.ring(x, z, 0.1, 3.2, 0.95, '#ffffff', { uv: 'ringSoft', a0: 0.4 });
    fx.shards(x, 0.4, z, COL.drum, 8);
    if (ev.fromX != null) fx.beam([ev.fromX, ev.fromY], [x, z], 0.08, COL.drum, { life: 0.18, y: 0.7 });
  }

  _dragonEnter(ev) {
    const x = ev.x;
    const z = ev.y;
    if (x == null) return;
    this.fx.ring(x, z, 0.2, 1.8, 0.5, COL.sky, { uv: 'ringThick' });
    this.fx.sparkle(x, z, COL.gold, { count: 18, height: 1.8, ring: false });
    this.fx.flash(x, 1.1, z, '#e8f6ff', 2.4, 0.35);
  }

  /**
   * The dragon's arrival roar where its head first shows: a big sky flash, two shock rings rolling out and (full motion)
   * eight roar streaks bursting from the head; its head pops for ROAR_TIME (_serpent). Reduce motion: the flash and
   * one ring only.
   */
  _roar(x, z) {
    const fx = this.fx;
    const R = this.R;
    fx.flash(x, DRAGON_ALT, z, COL.sky, 3.2, 0.4);
    fx.ring(x, z, 0.3, 3.4, 0.6, '#ffffff', { uv: 'ringThick', a0: 0.8 });
    if (this.reduceMotion) return;
    fx.ring(x, z, 0.2, 2.2, 0.45, COL.gold, { uv: 'ringSoft', a0: 0.9 });
    if (this.quality === 'low' || !R.beam) return;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      fillSp('bbA', R.beam, x + dx * 0.7, DRAGON_ALT, z + dz * 0.7, 0.5, 1.4, 0.35, i % 2 ? COL.gold : '#ffffff', 0.9);
      _sp.vx = dx * 4;
      _sp.vz = dz * 4;
      _sp.drag = 3;
      _sp.asp = 0.25;
      _sp.rot = Math.atan2(-dz, dx); // along the streak on screen (the camera looks north, down at the board)
      fx.spawn(_sp);
    }
  }

  /** Where a sky dragon leaves the road (its last head position, by START). */
  _exitSparkle(x, z) {
    this.fx.sparkle(x, z, COL.sky, { count: 12, height: 1.2, ring: false });
    this.fx.puff(x, 0.8, z, '#e8f6ff', 5, 0.4, 0.35);
  }

  /** The wave clear: every dragon still in flight becomes a ghost that finishes the flight (display only). */
  _ghostDragons() {
    for (const [uid, f] of this._flying) {
      const left = f.dist - f.end;
      const h = this._heads.get(uid);
      this._heads.delete(uid);
      if (!(left > 0.01) || this._ghosts.length >= MAX_DRAGON_HEADS) continue;
      this._ghosts.push({
        pathIndex: f.pathIndex, dist: f.dist, segments: f.segments, gap: f.gap, end: f.end,
        speed: f.speed > 0 ? f.speed : 0, rem: GHOST_TIME, head: h ? { x: h.x, y: h.y } : null, roared: true, cloud: 0,
        // the roads as they run now: a wave start may flip the route (reverse rules) while it still flies
        world: { pathData: this.sim.pathData },
      });
    }
    this._flying.clear();
  }

  /**
   * Real seconds a ghost has left to reach START before Auto start begins the next wave (GHOST_LEAD early);
   * Infinity when no wave is due. Read each frame, so a speed change after the clear is followed too.
   */
  _autoStartIn() {
    const s = this.sim;
    if (s.state !== 'between' || !(s._autoTimer > 0)) return Infinity;
    return s._autoTimer / this.timeScale - GHOST_LEAD;
  }

  /** A ghost reached START: the exit sparkle there (its last head position when the road is unknown). */
  _ghostExit(g) {
    const path = (g.world || this.sim).pathData?.[g.pathIndex];
    if (path) {
      pointAt(path, 0, _start);
      this._exitSparkle(_start.x, _start.y);
    } else if (g.head) this._exitSparkle(g.head.x, g.head.y);
  }

  // ---- shared meshes -----------------------------------------------------------------------

  _ensureGeo() {
    if (this._geo) return;
    this._geo = { fox: foxGeometry(), mirror: mirrorGeometry() };
    this._mats = {
      // the holo fox glows: emissive blue, a little see-through
      fox: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.92, emissive: new THREE.Color('#4f86b0') }),
      mirror: new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#4a3e66') }),
    };
  }

  _ensureDragon() {
    if (this._dragon) return this._dragon;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#2c5878') });
    const head = new THREE.InstancedMesh(dragonHeadGeometry(), mat, MAX_DRAGON_HEADS);
    const body = new THREE.InstancedMesh(dragonSegGeometry(), mat, MAX_DRAGON_SEGS);
    const tail = new THREE.InstancedMesh(dragonTailGeometry(), mat, MAX_DRAGON_HEADS);
    for (const m of [head, body, tail]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      this.root.add(m);
    }
    this._dragon = { head, body, tail, mat, tripoHead: false };
    loadTripoProp('seiran_dragon_head'); // her Tripo head (batch 2); the procedural one until it arrives
    return this._dragon;
  }

  /** Swaps the procedural head for the Tripo one once its file is in (body beads and tail stay procedural). */
  _swapDragonHead(D) {
    if (D.tripoHead) return;
    const prop = getTripoProp('seiran_dragon_head');
    if (!prop) return;
    D.tripoHead = true;
    D.head.geometry.dispose();
    D.head.geometry = prop.geometry;
    D.head.material = prop.material;
    D.head.name = 'tripo:seiran_dragon_head';
  }

  _dropProp(uid) {
    const p = this.props.get(uid);
    if (!p) return;
    this.root.remove(p.mesh);
    this.props.delete(uid);
    if (p.kind === 'mirror') this.mirrors.drop(uid);
  }

  // ---- frame -------------------------------------------------------------------------------

  update(dt) {
    this.time += dt;
    this._curseThisFrame = 0;
    this._beamsThisFrame = 0;
    this.mirrors.update(dt);
    this._drawSpreads(dt);
    this._drawWarns();
    this._syncProps(dt);
    this._drawAims();
    this._drawWebs();
    this._drawDragons(dt);
  }

  _drawWarns() {
    const w = this.warns;
    if (!w.length) return;
    const now = this.sim.time;
    const R = this.R;
    const gA = this.b.groundA;
    const gN = this.b.groundN;
    const [r, g, b] = RGB.warn;
    let n = 0;
    for (let i = 0; i < w.length; i++) {
      const s = w[i];
      const el = now - s.t0;
      // times out on its own (a wave clear removes shells without a shellLand); a sold girl's too
      if (el < -0.01 || el > s.delay + WARN_GRACE || (s.towerUid != null && !this._tower(s.towerUid))) continue;
      w[n++] = s;
      const k = Math.max(0, Math.min(1, el / s.delay));
      const d = s.r * 2;
      gA.push(s.x, 0.08, s.y, d, d, R.ring, r, g, b, 0.9);
      gN.push(s.x, 0.075, s.y, d * k, d * k, R.disc, r, g, b, 0.18 + 0.17 * k);
      gA.push(s.x, 0.085, s.y, 0.16, 0.16, R.dot, r, g, b, 0.9);
      // the shell's arc from her firing point (a lob: high in the middle, lands at k = 1)
      if (s.fx != null) {
        const dist = Math.hypot(s.x - s.fx, s.y - s.fy);
        const hMax = 1.2 + dist * 0.12;
        const px = s.fx + (s.x - s.fx) * k;
        const pz = s.fy + (s.y - s.fy) * k;
        const ph = 0.5 * (1 - k) + 4 * hMax * k * (1 - k) + 0.1;
        const [sr, sg, sb] = RGB.shell;
        this.b.bbN.push(px, ph, pz, 0.16, 0.16, R.dot, sr, sg, sb, 1);
        this.b.bbA.push(px, ph, pz, 0.3, 0.3, R.glow, r, g, b, 0.6);
        gN.push(px, 0.06, pz, 0.22, 0.22, R.shadow, 0.05, 0.05, 0.1, 0.25 * k);
      }
    }
    w.length = n;
  }

  _syncProps(dt) {
    const sim = this.sim;
    const seen = this._seen || (this._seen = new Set());
    seen.clear();
    for (let i = 0; i < sim.towers.length; i++) {
      const t = sim.towers[i];
      const relay = t.stats?.relay;
      if (!relay || !t.origin) continue;
      // Iroha's mirror network: one panel per mirror (mirror 0 is her relay origin and keeps the flips; the others
      // are keyed `${uid}#k` and sway idle). Mirror 0 is drawn where _mirrorSpot puts it (beside her when it would
      // stand on her), as the 'relay' event places it.
      const ms = relay.kind === 'mirror' && t.mirrors ? t.mirrors : null;
      for (let k = 0; k < (ms ? ms.length : 1); k++) {
        const key = k === 0 ? t.uid : `${t.uid}#${k}`;
        // (slot 0 is her relay origin t.ox / t.oy: towers.js updateRelayOrigin sets it from her first mirror)
        let tx = ms && k > 0 ? ms[k].x : t.ox;
        let ty = ms && k > 0 ? ms[k].y : t.oy;
        let beside = false;
        if (k === 0 && relay.kind === 'mirror') {
          const s = this._mirrorSpot(t, tx, ty);
          tx = s.x;
          ty = s.y;
          beside = s.beside;
        }
        seen.add(key);
        let p = this.props.get(key);
        if (!p) {
          if (this.props.size >= MAX_PROPS) continue;
          this._ensureGeo();
          const kind = relay.kind === 'mirror' ? 'mirror' : 'familiar';
          const mesh = new THREE.Mesh(kind === 'mirror' ? this._geo.mirror : this._geo.fox, kind === 'mirror' ? this._mats.mirror : this._mats.fox);
          mesh.frustumCulled = false;
          // yaw first, then the tip about the panel's own axis (mirrorFx flips)
          mesh.rotation.order = 'YXZ';
          this.root.add(mesh);
          p = { kind, mesh, x: tx, y: ty, k, beside };
          this.props.set(key, p);
        }
        p.beside = beside;
        this._glideProp(t, p, tx, ty, dt);
      }
    }
    for (const uid of this.props.keys()) if (!seen.has(uid)) this._dropProp(uid);
  }

  /**
   * Where Iroha's panel is drawn for the origin (ox, oy) (display only, src/render/mirrorPanel.js panelSpot): an
   * un-aimed origin (her own spot) stands beside her, a little behind on screen and on the side away from the
   * road, so the bright glass never covers her. A shared scratch: copy what you keep.
   */
  _mirrorSpot(t, ox, oy) {
    let fx = 0;
    let fz = -1;
    const cam = this.camera;
    if (cam?.matrixWorld) {
      // the camera's own +z (backward) in world space; its ground part, reversed, is the view's forward
      const e = cam.matrixWorld.elements;
      const l = Math.hypot(e[8], e[10]);
      if (l > 1e-4) {
        fx = -e[8] / l;
        fz = -e[10] / l;
      }
    }
    return panelSpot(t.x, t.y, ox, oy, fx, fz, this.sim.placement?.pathDistance || null, _spot);
  }

  /** Glides a prop to its sim spot (snaps when far: a new placement) and draws it. */
  _glideProp(t, p, tx, ty, dt) {
    const dd = Math.hypot(tx - p.x, ty - p.y);
    if (dd > 6) {
      p.x = tx;
      p.y = ty;
    } else {
      const k = 1 - Math.exp(-12 * dt);
      p.x += (tx - p.x) * k;
      p.y += (ty - p.y) * k;
    }
    this._drawProp(t, p);
  }

  _drawProp(t, p) {
    const R = this.R;
    const v = this.actors.towers.get(t.uid);
    const facing = v ? v.facing : t.facing || 0;
    // standing on the girl (origin = her spot): step aside so both read (her panel already stands beside her)
    let x = p.x;
    let y = p.y;
    const self = p.kind === 'mirror' ? p.beside : Math.hypot(x - t.x, y - t.y) < 0.3;
    if (self && p.kind !== 'mirror') {
      x = t.x + Math.cos(facing) * 0.34;
      y = t.y - Math.sin(facing) * 0.34;
    }
    const c = p.kind === 'mirror' ? RGB.mirror : RGB.familiar;
    const m = p.mesh;
    // Kon's own figure is drawn (src/render/companions.js): the procedural fox is only the fallback (files
    // not loaded, lowest graphics setting); the tether then runs from Ruri to wherever Kon is
    const kon = p.kind === 'familiar' ? this.companions?.konAt(t.uid) : null;
    m.visible = !kon;
    if (kon) {
      if (kon.away) this._tether(t.x, t.y, kon.x, kon.z, c, 0.7);
      return;
    }
    if (p.kind === 'familiar') {
      const bob = 0.12 + 0.04 * Math.sin(this.time * 3 + t.uid);
      m.position.set(x, bob, y);
      m.rotation.set(0, facing, 0);
      m.scale.setScalar(1.7);
      this.b.groundA.push(x, 0.07, y, 0.7, 0.7, R.glow, c[0], c[1], c[2], 0.5);
      this.b.groundA.push(x, 0.072, y, 0.6, 0.6, R.ring, c[0], c[1], c[2], 0.55 + 0.2 * Math.sin(this.time * 5), this.time);
      if (this.quality !== 'low') this.b.bbA.push(x, bob + 0.4, y, 0.8, 0.8, R.glow, c[0], c[1], c[2], 0.3);
    } else {
      // idle, the glass faces the camera side (the sim's mirror has no facing) with a slow sway; each relayed
      // bolt flips it toward the shot with a glint (mirrorFx)
      m.position.set(x, 0.02, y);
      const sway = 0.25 * Math.sin(this.time * 0.7 + t.uid + (p.k || 0) * 1.3);
      if (!p.k) this.mirrors.pose(t, m, x, y, sway);
      else {
        // (her other mirrors: the idle camera-facing sway, a little smaller than her first)
        m.rotation.set(0, this.reduceMotion ? 0 : sway, 0);
        m.scale.setScalar(1.6 * 0.85);
      }
      this.b.groundN.push(x, 0.06, y, 0.55, 0.55, R.shadow, 0.05, 0.05, 0.1, 0.35);
      this.b.groundA.push(x, 0.07, y, 0.6, 0.6, R.ring, c[0], c[1], c[2], 0.45, this.time * 0.5);
      // a soft sheen on the glass and a glint sweeping over it
      if (this.quality !== 'low') this.b.bbA.push(x, 0.9, y, 0.55, 0.7, R.glow, c[0], c[1], c[2], 0.22);
      const g = (this.time * 0.6 + t.uid * 0.13) % 1;
      if (g < 0.3) this.b.bbA.push(x, 0.95, y, 0.4, 0.4, R.star, 1, 1, 1, Math.sin((g / 0.3) * Math.PI) * 0.9, this.time * 3);
    }
    // dashed tether from the girl to her prop (ground dashes flowing outward)
    if (!self) this._tether(t.x, t.y, x, y, c, p.kind === 'mirror' ? 0.6 : 0.7);
  }

  /** An enemy's road height by uid (`fallback` when gone); the uid map is built at most once a frame, only when a pass came. */
  _elevOf(uid, fallback) {
    if (this._elevFrame !== this.time) {
      this._elevFrame = this.time;
      const m = this._elevMap || (this._elevMap = new Map());
      m.clear();
      for (const e of this.sim.enemies || []) m.set(e.uid, e.elev || 0);
    }
    const h = this._elevMap.get(uid);
    return h === undefined ? fallback : h;
  }

  /** The spreading curse's threads (see SPREAD_LIFE): one stretched ground quad each, fading out. */
  _drawSpreads(dt) {
    const list = this._spreads;
    if (!list.length) return;
    const life = this.reduceMotion ? SPREAD_LIFE_RM : SPREAD_LIFE;
    const R = this.R;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      t.age += dt;
      if (t.age >= life) continue;
      list[n++] = t;
      const f = t.age / life;
      // the thread runs out from the passing enemy over its first third (whole at once with Reduce motion)
      const run = this.reduceMotion ? 1 : Math.min(1, f * 3);
      const dx = (t.x1 - t.x0) * run;
      const dy = (t.y1 - t.y0) * run;
      const len = Math.hypot(dx, dy);
      if (len < 0.05) continue;
      const a = 0.85 * (1 - f);
      this.b.groundN.push(t.x0 + dx / 2, 0.12 + t.h0 + ((t.h1 - t.h0) * run) / 2, t.y0 + dy / 2, len, SPREAD_W, R.white, SPREAD_RGB[0], SPREAD_RGB[1], SPREAD_RGB[2], a, Math.atan2(-dy, dx));
    }
    list.length = n;
  }

  _tether(x0, y0, x1, y1, c, a) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.45) return;
    const step = 0.26;
    const rot = Math.atan2(-dy, dx); // ground quads: local x → world x, local y → world −z
    const off = (this.time * 0.6) % step;
    const R = this.R;
    const n = Math.min(40, Math.floor(len / step));
    for (let i = 0; i < n; i++) {
      const d = 0.22 + off + i * step;
      if (d > len - 0.18) break;
      const f = d / len;
      this.b.groundN.push(x0 + dx * f, 0.075, y0 + dy * f, 0.13, 0.04, R.white, c[0], c[1], c[2], a, rot);
    }
  }

  /** Iroha's Laser Web while it runs: a pulsing beam between every pair of her mirrors (ground + a raised core). */
  _drawWebs() {
    const sim = this.sim;
    const R = this.R;
    for (let i = 0; i < sim.towers.length; i++) {
      const t = sim.towers[i];
      const ms = t.mirrors;
      if (!ms || ms.length < 2 || !(t.abil?.active > 0) || t.abil.id !== 'iroha.mirrorShift') continue;
      const [r, g, b] = RGB.mirrorWeb;
      const a = this.reduceMotion ? 0.75 : 0.6 + 0.25 * Math.sin(this.time * 12 + t.uid);
      for (let p = 0; p < ms.length; p++) {
        for (let q = p + 1; q < ms.length; q++) {
          const dx = ms[q].x - ms[p].x;
          const dy = ms[q].y - ms[p].y;
          const len = Math.hypot(dx, dy);
          if (len < 0.05) continue;
          const rot = Math.atan2(-dy, dx);
          const cx = (ms[p].x + ms[q].x) / 2;
          const cy = (ms[p].y + ms[q].y) / 2;
          this.b.groundA.push(cx, 0.1, cy, len, 0.5, R.glow, r, g, b, a * 0.45, rot);
          this.b.groundA.push(cx, 0.105, cy, len, 0.1, R.white, 1, 1, 1, a, rot);
        }
      }
    }
  }

  _drawAims() {
    const sim = this.sim;
    const R = this.R;
    // Iroha selected: a ring and a number of dots under each of her mirrors (mirror k: k + 1 dots), a filled centre on
    // the ones her player placed; while one is being placed, her reach ring and that mirror pulsing yellow
    for (let i = 0; i < sim.towers.length; i++) {
      const t = sim.towers[i];
      if (!t.mirrors || (this.selectedUid !== t.uid && this.mirrorPick?.uid !== t.uid)) continue;
      const pick = this.mirrorPick?.uid === t.uid ? this.mirrorPick.k : -1;
      if (pick >= 0) {
        const r2 = t.stats.relay.reach * 2;
        const [yr, yg, yb] = RGB.aimPick;
        this.b.groundA.push(t.x, 0.085, t.y, r2, r2, R.ringDashed || R.ring, yr, yg, yb, 0.7, this.time * 0.2);
      }
      for (let k = 0; k < t.mirrors.length; k++) {
        const m = t.mirrors[k];
        const c = k === pick ? RGB.aimPick : RGB.aimMirror;
        const s = k === pick ? 0.85 + 0.1 * Math.sin(this.time * 8) : 0.7;
        this.b.groundA.push(m.x, 0.09, m.y, s, s, R.reticle || R.ringDashed, c[0], c[1], c[2], 0.9, this.time * 0.8);
        if (t.mirrorAim?.[k]) this.b.groundA.push(m.x, 0.092, m.y, 0.14, 0.14, R.dot, c[0], c[1], c[2], 0.95);
        for (let d = 0; d <= k; d++) this.b.groundA.push(m.x - 0.09 * k + 0.18 * d, 0.093, m.y + 0.5, 0.09, 0.09, R.dot, c[0], c[1], c[2], 0.95);
      }
    }
    for (let i = 0; i < sim.towers.length; i++) {
      const t = sim.towers[i];
      if (!t.aim) continue;
      const mode = aimMode(t);
      if (!mode) continue;
      if (mode !== 'mortar' && this.selectedUid !== t.uid) continue;
      const c = RGB[mode === 'mortar' ? 'aimMortar' : mode === 'mirror' ? 'aimMirror' : 'aimUlt'];
      const sel = this.selectedUid === t.uid;
      const s = sel ? 0.75 : 0.6;
      this.b.groundA.push(t.aim.x, 0.09, t.aim.y, s, s, R.reticle || R.ringDashed, c[0], c[1], c[2], sel ? 0.95 : 0.7, this.time * 0.8);
      this.b.groundA.push(t.aim.x, 0.092, t.aim.y, 0.12, 0.12, R.dot, c[0], c[1], c[2], 0.9);
    }
  }

  _drawDragons(dt = 0) {
    const runners = this.sim.runners;
    const has = runners && runners.length > 0;
    const ghosts = this._ghosts;
    if (!has && !ghosts.length && !this._dragon) return;
    const D = this._ensureDragon();
    this._swapDragonHead(D);
    const frame = ++this._frame;
    this._nh = 0;
    this._nb = 0;
    this._nt = 0;
    if (has) {
      for (let i = 0; i < runners.length; i++) {
        const r = runners[i];
        if (r.dead || r.kind !== 'dragon') continue;
        let f = this._flying.get(r.uid);
        if (!f) this._flying.set(r.uid, (f = { born: this.time, roared: false, cloud: 0 }));
        f.born ??= this.time;
        const h = this._serpent(D, r, this.sim, f, dt);
        if (h) {
          let last = this._heads.get(r.uid);
          if (!last) this._heads.set(r.uid, (last = { x: 0, y: 0 }));
          last.x = h.x;
          last.y = h.y;
        }
        f.pathIndex = r.pathIndex;
        f.dist = r.dist;
        f.speed = r.speed;
        f.segments = r.segments;
        f.gap = r.gap;
        f.end = r.end ?? -(Math.max(1, r.segments) - 1) * r.gap;
        f.seen = frame;
      }
    }
    // ghosts (wave clear): on to START, never slower on screen than the dragon flew at this game speed, and
    // there before their time runs out (GHOST_TIME, the Auto start, a wave start's rush); then the exit sparkle
    let n = 0;
    const auto = ghosts.length ? this._autoStartIn() : Infinity;
    for (let i = 0; i < ghosts.length; i++) {
      const g = ghosts[i];
      if (dt > 0) {
        const rem = Math.min(g.rem, auto);
        const v = Math.max(g.speed * this.timeScale, (g.dist - g.end) / Math.max(dt, rem));
        g.dist = Math.max(g.end, g.dist - v * dt);
        g.rem -= dt;
      }
      const h = this._serpent(D, g, g.world, g, dt);
      if (h) {
        if (!g.head) g.head = { x: 0, y: 0 };
        g.head.x = h.x;
        g.head.y = h.y;
      }
      if (g.dist <= g.end) this._ghostExit(g);
      else ghosts[n++] = g;
    }
    ghosts.length = n;
    D.head.count = this._nh;
    D.body.count = this._nb;
    D.tail.count = this._nt;
    if (this._nh) D.head.instanceMatrix.needsUpdate = true;
    if (this._nb) D.body.instanceMatrix.needsUpdate = true;
    if (this._nt) D.tail.instanceMatrix.needsUpdate = true;
    // runners gone without a runnerEnd or a wave clear (her girl sold): forget them
    for (const [uid, f] of this._flying) {
      if (f.seen === frame) continue;
      this._flying.delete(uid);
      this._heads.delete(uid);
    }
    if (!has && this._heads.size) this._heads.clear();
  }

  /**
   * One sky dragon: head, body beads and tail tip along the road from runnerSegment (a sim runner or a ghost:
   * { pathIndex, dist, segments, gap }; `world` holds the pathData it flies on, the sim's by default). A bead sits on
   * every sim segment and one halfway between each two, so the body is one serpent in step with what the sim hits.
   * `f` keeps its look's state ({ born, roared, cloud }): the arrival roar, the head pop, the cloud trail.
   * @returns {{ x, y }|null} the head (a shared scratch), null off the road
   */
  _serpent(D, r, world = this.sim, f = null, dt = 0) {
    const R = this.R;
    const glow = this.quality !== 'low';
    const [cr, cg, cb] = RGB.sky;
    const segs = Math.max(1, Math.min(r.segments || 1, MAX_DRAGON_SEGS));
    const last = segs - 1;
    // the head pops as it arrives (Reduce motion: no pop)
    const age = f?.born != null ? this.time - f.born : Infinity;
    const pop = !this.reduceMotion && age < ROAR_TIME ? 1 + ROAR_POP * Math.sin((Math.PI * age) / ROAR_TIME) : 1;
    let headAt = null;
    let headYaw = 0;
    let headAlt = DRAGON_ALT;
    let tailX = null;
    let tailZ = 0;
    // k: 0 (head), 0.5, 1, … last, then the tail tip half a gap past the last segment
    const steps = last * 2 + 1;
    for (let j = 0; j <= steps; j++) {
      const k = j * 0.5;
      const p = runnerSegment(world, r, k, _seg);
      if (!p) continue;
      const px = p.x;
      const py = p.y;
      // heading: from the next point back toward this one (head leads, flying back along the road)
      let yaw = 0;
      const q = runnerSegment(world, r, k + 0.5, _segN);
      if (q) yaw = Math.atan2(px - q.x, py - q.y);
      else if (p.facing != null) yaw = p.facing + Math.PI;
      const alt = DRAGON_ALT + 0.18 * Math.sin(this.time * 4.5 - k * 0.9);
      const head = j === 0;
      const tail = j === steps && last > 0;
      // the body tapers from the neck to the tail
      const u = last > 0 ? Math.min(1, k / last) : 0;
      const sc = head ? DRAGON_HEAD * pop : tail ? DRAGON_TAIL : DRAGON_BODY - (DRAGON_BODY - DRAGON_TAIL - 0.1) * u * u;
      _e.set(Math.cos(this.time * 4.5 - k * 0.9) * 0.25, yaw, 0, 'YXZ');
      _q.setFromEuler(_e);
      _p.set(px, alt, py);
      _s.set(sc, sc, sc);
      _m.compose(_p, _q, _s);
      if (head) {
        if (this._nh < MAX_DRAGON_HEADS) D.head.setMatrixAt(this._nh++, _m);
        _head.x = px;
        _head.y = py;
        headAt = _head;
        headYaw = yaw;
        headAlt = alt;
      } else if (tail) {
        if (this._nt < MAX_DRAGON_HEADS) D.tail.setMatrixAt(this._nt++, _m);
        tailX = px;
        tailZ = py;
      } else if (this._nb < MAX_DRAGON_SEGS) D.body.setMatrixAt(this._nb++, _m);
      // (a soft sky glow on every sim segment, not the in-between beads: the same light as before, twice the body)
      if (glow && (k % 1 === 0)) this.b.bbA.push(px, alt, py, 0.55 * sc, 0.55 * sc, R.glow, cr, cg, cb, head ? 0.45 : 0.3);
      if (k % 1 === 0) this.b.groundN.push(px, 0.06, py, 0.34 * sc, 0.34 * sc, R.shadow, 0.05, 0.05, 0.1, 0.22);
    }
    if (headAt) {
      // the arrival roar, once, where the head first shows
      if (f && !f.roared) {
        f.roared = true;
        this._roar(headAt.x, headAt.y);
      }
      if (glow && this.camera) this._whiskers(headAt.x, headAlt, headAt.y, headYaw, DRAGON_HEAD * pop, r.uid ?? 0);
    }
    if (glow && tailX != null) {
      // a cloud trail behind the tail (and the gold sparkles it sheds)
      if (f) {
        f.cloud = (f.cloud || 0) + dt;
        if (f.cloud >= CLOUD_EVERY && R.smoke) {
          f.cloud = 0;
          fillSp('bbN', R.smoke, tailX + (this.rand() - 0.5) * 0.3, DRAGON_ALT - 0.1, tailZ + (this.rand() - 0.5) * 0.3, 0.6, 1.5, 0.9, '#eef8ff', 0.55);
          _sp.vy = 0.12;
          _sp.rot = this.rand() * TAU;
          _sp.vrot = 0.6;
          this.fx.spawn(_sp);
        }
      }
      if (this.rand() < 0.35 && R.star) {
        fillSp('bbA', R.star, tailX + (this.rand() - 0.5) * 0.3, DRAGON_ALT - 0.2, tailZ + (this.rand() - 0.5) * 0.3, 0.16, 0.05, 0.55, COL.gold, 1);
        _sp.vy = -0.3;
        _sp.rot = this.rand() * TAU;
        _sp.vrot = 4;
        this.fx.spawn(_sp);
      }
    }
    return headAt;
  }

  /**
   * Its long whiskers and mane ribbons: four camera-facing ribbons trailing back from the head, rippling (medium /
   * high graphics). Two pale whiskers from the snout's sides, two gold mane streamers from the nape.
   */
  _whiskers(x, y, z, yaw, sc, seed) {
    const B = this.b.bbA;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const t = this.time * 6 + seed;
    for (let w = 0; w < 4; w++) {
      const mane = w >= 2;
      const side = w % 2 ? 1 : -1;
      // root: the snout's side (whiskers) or the nape (mane), in the head's own frame times its scale
      const along = (mane ? -0.16 : 0.3) * sc;
      const out = (mane ? 0.07 : 0.1) * sc * side;
      const up = (mane ? 0.08 : -0.04) * sc;
      let ax = x + fx * along + rx * out;
      let ay = y + up;
      let az = z + fz * along + rz * out;
      const len = (mane ? 0.3 : 0.24) * sc;
      const c = mane ? RGB.gold : RGB.white;
      for (let i = 1; i <= RIBBON_PTS; i++) {
        const k = i / RIBBON_PTS;
        const wave = Math.sin(t - i * 1.1 + side) * 0.06 * sc * k;
        const back = along - len * i;
        const spread = out + side * (mane ? 0.03 : 0.07) * sc * i + wave * (mane ? 0.4 : 1);
        const bx = x + fx * back + rx * spread;
        const by = y + up + (mane ? wave : -0.02 * sc * i + wave * 0.5);
        const bz = z + fz * back + rz * spread;
        this._ribbonQuad(B, ax, ay, az, bx, by, bz, (mane ? 0.16 : 0.09) * (1 - k * 0.6), c, (mane ? 0.75 : 0.85) * (1 - k * 0.5));
        ax = bx;
        ay = by;
        az = bz;
      }
    }
  }

  /** A camera-facing quad from a to b (world x, height, z) with the soft beam sprite. */
  _ribbonQuad(B, ax, ay, az, bx, by, bz, w, c, alpha) {
    const view = this.camera.matrixWorldInverse;
    _la.set(ax, ay, az).applyMatrix4(view);
    _lb.set(bx, by, bz).applyMatrix4(view);
    const dx = _lb.x - _la.x;
    const dy = _lb.y - _la.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.005) return;
    B.push((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, len, w, this.R.beam || this.R.glow, c[0], c[1], c[2], alpha, Math.atan2(dy, dx));
  }

  dispose() {
    for (const uid of [...this.props.keys()]) this._dropProp(uid);
    this.mirrors.dispose();
    if (this._geo) {
      this._geo.fox.dispose();
      this._geo.mirror.dispose();
      this._mats.fox.dispose();
      this._mats.mirror.dispose();
    }
    if (this._dragon) {
      for (const m of [this._dragon.head, this._dragon.body, this._dragon.tail]) {
        // (a Tripo head's geometry and material are shared, freed by clearTripoProps)
        if (!m.name.startsWith('tripo:')) m.geometry.dispose();
        m.dispose();
      }
      this._dragon.mat.dispose();
    }
    this.root.parent?.remove(this.root);
    this.warns.length = 0;
  }
}

function aimColor(mode) {
  return mode === 'mortar' || mode === 'checkpoint' ? COL.aimMortar : mode === 'mirror' ? COL.aimMirror : COL.aimUlt;
}
