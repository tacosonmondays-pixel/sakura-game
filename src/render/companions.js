// Companion actors in battle (display only: reads the sim's towers and drained events, never writes):
//   Kon (Ruri)    sits by her; bounds along the ground to her relay origin (t.ox / t.oy) and sits there (a hop,
//                 a pitch and a dust puff per stride, a faint holo streak behind him); her bolts leap out of him
//                 (attack clip); runs back when the spot goes away; on Moon Pounce (her ⚡) he crouches, leaps at
//                 its target in an arc, lands with a puff and a ring there and hops back (Reduce motion: he stays
//                 put and plays his attack)
//   Kaze (Hana)   perches on her left shoulder (rides her shoulder bone); on her attacks (every enemy she shoots,
//                 flyers first: the sim's attack event names it) he climbs, stoops onto that target and swings back
//                 with a wing ribbon behind him and a feather burst where he strikes; one swoop in flight, at most
//                 one waiting (the latest target, a flyer kept over a walker) and a short rest on her shoulder in
//                 between, so a fast Hana never turns him into a blur; on Kaze's Swoop (her ⚡) he dives on
//                 each of its targets within her reach in turn, quicker, never across the map (the far ones take
//                 abilityFx's feather strike from the sky); Reduce motion: no dive — he stays on her shoulder,
//                 turns to the first target and plays his attack, and the strikes are still fades on the targets;
//                 his plain swoops still fly, but their feathers and puffs are still fades
//   Low graphics: no ribbons, fewer puffs and feathers (FxSystem density).
//   the doll      (Yoriko) floats in front of her raised hand on glowing threads that stay tied to her
//                 control bar; dashes at the target and back on her needles and on Dream Detour
// One actor per placed girl who has a companion (co-op partners' girls too: they are in the shared sim);
// 'appear' plays when she is placed, the actor goes when she is sold. Models and the manifest contract:
// src/models/companions.js. Rules (pure): ./companionLogic.js.
//
//   const c = new Companions({ sim, scene, actors, terrain, quality, reduceMotion, fx, batches, atlas, camera });
//   (fx / batches / atlas / camera are optional: without them the figures still move, with no trails or puffs)
//   c.handle(ev)      // every drained sim event (observes only, never consumes)
//   c.update(dt, zoom) // once per frame after actors.sync
import * as THREE from 'three';
import {
  loadCompanionManifest, companionOf, companionEntry, loadCompanion, getCompanion, buildCompanion, HomeAnchor, boneAtIdle,
} from '../models/companions.js';
import { disposeObject } from '../models/index.js';
import { lerpAngle } from './geo.js';
import { WATER_Y, PATH_H } from './terrain.js';
import {
  konState, konStep, konSpot, konAttacks, konGait, sortieState, startSortie, retarget, sortieStep, reconcile, swoopDives, diveReach,
  pounceStep, stoopStep, perchState, queueSwoop, perchFree, perchStep, perchClear, trailState, trailPush, trailAt, trailFade, trailClear,
  SWOOP_TIME, SWOOP_LIFT, DASH_TIME, DASH_REACH, DASH_STOP, DASH_LIFT, DIVE_TIME, POUNCE_TIME, POUNCE_STOP, POUNCE_LIFT,
  TRAIL_LIFE,
} from './companionLogic.js';

/** The ⚡ abilities a companion performs (the sim's `ability` event id → his move). */
const SWOOP_ID = 'hana.swoop';
const POUNCE_ID = 'ruri.moonPounce';

/** Zoom at which the full-detail files take over from the LOD ones (quality high only), with hysteresis. */
const FULL_AT = 2.0;
const LOD_AT = 1.7;
const KON_HOLD = 0.5; // his appear clip, then he may run

const _home = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _bar = new THREE.Vector3();
const _spot = { x: 0, z: 0 };
const _pos = { x: 0, y: 0, z: 0, out: false, hit: false, phase: null, squash: 1, pitch: 0 };
const _gait = { lift: 0, pitch: 0, stretch: 1 };
const _la = new THREE.Vector3();
const _lb = new THREE.Vector3();
const TAU = Math.PI * 2;
/** Kaze is drawn this much bigger out in flight than on her shoulder (he reads at phone zoom; eased by distance). */
const FLIGHT_SCALE = 1.45;
/** Colours of their moves (THREE.Color: spawned without parsing a string per particle). */
const C = {
  holo: new THREE.Color('#8fd8ff'),
  dust: new THREE.Color('#d9c6a2'),
  white: new THREE.Color('#ffffff'),
  wing: new THREE.Color('#f2dc96'),
  feather: new THREE.Color('#d9b48a'),
  moon: new THREE.Color('#cfe9ff'),
};
/** One reused spawn record (FxSystem.spawn copies it): no object per particle. */
const _sp = {
  batch: 'bbN', uv: null, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, s0: 0.2, s1: 0.2, asp: 1, life: 0.5,
  color: null, a0: 1, a1: 0, rot: 0, vrot: 0, fadeIn: 0, flags: 0,
};

export class Companions {
  /** @param {{ sim, scene: THREE.Scene, actors, terrain, quality: string, reduceMotion?: boolean }} o */
  constructor({ sim, scene, actors, terrain, quality, reduceMotion = false, fx = null, batches = null, atlas = null, camera = null }) {
    this.sim = sim;
    this.fx = fx;
    this.b = batches;
    this.R = atlas?.regions || null;
    this.camera = camera;
    this.actors = actors;
    this.terrain = terrain;
    this.quality = quality;
    this.reduceMotion = !!reduceMotion;
    this.root = new THREE.Group();
    this.root.name = 'companions';
    scene.add(this.root);
    this.list = new Map(); // tower uid -> actor
    this.ready = false;
    this.disposed = false;
    this.frame = 0;
    this.time = 0;
    this.zoom = 1;
    this.detail = 'lod';
    this.requested = new Set(); // `${cid}|${detail}` loads asked for
    this._make = (t, cid) => {
      const a = this._create(t, cid);
      return a ? this._kit(a) : null;
    };
    this._drop = (a) => this._dispose(a);
    this._of = (unitId) => companionOf(unitId);
    loadCompanionManifest().then((m) => {
      if (!this.disposed) this.ready = !!m;
    });
  }

  /**
   * On at every graphics setting once the manifest is here: each companion is one small mesh, drawn from the LOD
   * file below quality high and without outlines at low (instantiateCharacter), so Low shows Yoriko's doll, Kon and
   * Kaze too. Kon's procedural holo fox (rosterFx) stays the fallback while a figure loads or after an error.
   */
  get enabled() {
    return this.ready;
  }

  setQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    // girls' views are rebuilt at the new detail too; companions follow on the next update
    this.clear();
  }

  /** Drops every companion (they are recreated from the sim on the next update). */
  clear() {
    for (const a of this.list.values()) this._dispose(a);
    this.list.clear();
  }

  // ---- queries (rosterFx, attackFx) ---------------------------------------------------------

  /** True when a companion figure is drawn for this girl. */
  has(uid) {
    return !!this.list.get(uid)?.group;
  }

  /**
   * The targets of Hana `uid`'s last Kaze's Swoop that Kaze's figure dives on (within her reach, strike order; none on
   * Reduce motion), or null when no Kaze is drawn for her. abilityFx gives every other target its feather strike.
   */
  swoopTargets(uid) {
    const a = this.list.get(uid);
    if (!a || a.cid !== 'kaze' || !a.group) return null;
    return a.swoopTargets || [];
  }

  /** Where Kon is drawn for Ruri `uid` ({ x, z, h: muzzle height, away: not by her side }) or null. */
  konAt(uid) {
    const a = this.list.get(uid);
    if (!a || a.cid !== 'kon' || !a.group) return null;
    return a.kon.view;
  }

  /** Test / e2e probe: one row per actor. */
  probe() {
    const rows = [];
    for (const [uid, a] of this.list) {
      const g = a.group;
      rows.push({
        uid, cid: a.cid, unitId: a.unitId, detail: a.detail, visible: !!g?.visible, x: g ? +g.position.x.toFixed(3) : null,
        y: g ? +g.position.y.toFixed(3) : null, z: g ? +g.position.z.toFixed(3) : null, mode: a.kon ? a.kon.s.mode : (a.sortie?.busy ? 'sortie' : 'home'),
        homeX: +a.home.x.toFixed(3), homeY: +a.home.y.toFixed(3), homeZ: +a.home.z.toFixed(3), scale: g ? +g.scale.x.toFixed(3) : null,
        battleScale: a.battleScale,
        target: a.sortie?.busy ? [+a.sortie.tx.toFixed(3), +a.sortie.ty.toFixed(3), +a.sortie.tz.toFixed(3)] : null, height: a.height ?? null,
        // what set the sortie off: the enemy her attack hit (uid), null for a point (Dream Detour's centre)
        targetUid: a.sortie?.busy ? (a.sortie.uid ?? null) : null,
        // her ⚡ through him: Kaze's dives still queued (and whether one is a dive), Kon's pounce in flight
        dives: a.dives?.length ?? 0, diving: !!a.diving, pounce: a.pounce?.busy ? (a.pounce.uid ?? null) : null,
      });
    }
    return { enabled: this.enabled, quality: this.quality, detail: this.detail, actors: rows };
  }

  // ---- events --------------------------------------------------------------------------------

  /** Observes a sim event (never consumes it). */
  handle(ev) {
    if (ev.type === 'attack') {
      const a = this.list.get(ev.towerUid);
      if (a?.group) this._onAttack(a, ev.targetUid, null);
    } else if (ev.type === 'ult') {
      const a = this.list.get(ev.towerUid);
      // Dream Detour: the doll dashes toward the ult's centre
      if (a?.group && a.cid === 'doll' && ev.x != null) this._onAttack(a, null, { x: ev.x, z: ev.y });
    } else if (ev.type === 'ability') {
      const a = this.list.get(ev.towerUid);
      if (!a?.group) return;
      if (a.cid === 'kaze' && ev.id === SWOOP_ID) this._onSwoop(a, ev.targets);
      else if (a.cid === 'kon' && ev.id === POUNCE_ID) this._onPounce(a, Array.isArray(ev.targets) ? ev.targets[0] : null);
    }
  }

  /**
   * Kaze's Swoop: a dive on each target within her reach in turn (after any swoop in flight), each flight capped at
   * that reach. Reduce motion, or every target far off: no dive — he turns to the first target on her shoulder and
   * plays his attack; abilityFx strikes the rest from the sky (swoopTargets says which are his).
   */
  _onSwoop(a, targets) {
    const t = this.sim.getTower ? this.sim.getTower(a.uid) : null;
    const reach = diveReach(t?.eff?.range);
    // (the dives' flight options: capped at her reach)
    if (!a.diveOpts) a.diveOpts = { reach, lift: SWOOP_LIFT };
    a.diveOpts.reach = reach;
    const hx = a.home.x;
    const hz = a.home.z;
    perchClear(a.perch);
    a.dives = swoopDives(targets, {
      reduceMotion: this.reduceMotion,
      inReach: (uid) => {
        const e = this.actors.enemyPos(uid);
        return !!e && Math.hypot(e.x - hx, e.z - hz) <= reach;
      },
    });
    // (abilityFx asks right after this event which targets his figure takes: swoopTargets)
    a.swoopTargets = a.dives.slice();
    if (a.dives.length) {
      if (!a.sortie.busy) this._nextDive(a);
      return;
    }
    a.group.userData.playAttack?.();
    const first = Array.isArray(targets) && targets.length ? this.actors.enemyPos(targets[0]) : null;
    if (first) {
      a.face = Math.atan2(first.x - a.home.x, first.z - a.home.z);
      a.faceT = 0.8;
    }
  }

  /** Starts the next queued dive whose target is still drawn (a gone one is skipped). */
  _nextDive(a) {
    a.diving = false;
    while (a.dives?.length) {
      const uid = a.dives.shift();
      const e = this.actors.enemyPos(uid);
      if (!e) continue;
      if (startSortie(a.sortie, e.x, e.y + (e.height || 0.5) * 0.5, e.z, DIVE_TIME, uid)) {
        a.diving = true;
        a.group.userData.playAttack?.();
      }
      return;
    }
  }

  /** Moon Pounce: Kon leaps at the target and back (Reduce motion: he turns to it and plays his attack in place). */
  _onPounce(a, uid) {
    const e = uid != null ? this.actors.enemyPos(uid) : null;
    a.group.userData.playAttack?.();
    if (!e) return;
    a.face = Math.atan2(e.x - a.group.position.x, e.z - a.group.position.z);
    a.faceT = 0.8;
    if (this.reduceMotion) return;
    if (!a.pounce) a.pounce = sortieState();
    a.pounce.busy = false;
    a.pPhase = null;
    startSortie(a.pounce, e.x, e.y + (e.height || 0.4) * 0.4, e.z, POUNCE_TIME, uid);
  }

  /** The drawn enemy `uid` (its view: x, y, z, height, airborne) or null; no object made per call. */
  _enemy(uid) {
    if (uid == null) return null;
    const v = this.actors.enemies?.get?.(uid);
    if (v) return v.hidden ? null : v;
    return this.actors.enemyPos ? this.actors.enemyPos(uid) : null;
  }

  /** Kaze sets off on a plain swoop at the enemy Hana shot (her reach caps the flight). */
  _swoopAt(a, uid, e) {
    const t = this.sim.getTower ? this.sim.getTower(a.uid) : null;
    a.swoopOpts.reach = diveReach(t?.eff?.range ?? 6);
    if (startSortie(a.sortie, e.x, e.y + (e.height || 0.5) * 0.5, e.z, SWOOP_TIME, uid)) a.group.userData.playAttack?.();
  }

  _onAttack(a, targetUid, point) {
    if (a.cid === 'kaze') {
      // (her ⚡ dives come first: her plain swoops wait until they are done)
      if (a.dives?.length || a.diving) return;
      // the enemy she shot (her targeting: every enemy, flyers first); busy or resting: it waits (latest, flyers kept)
      const e = this._enemy(targetUid);
      if (!e) return;
      if (perchFree(a.perch, a.sortie.busy)) this._swoopAt(a, targetUid, e);
      else queueSwoop(a.perch, targetUid, e.airborne ?? e.y > 0.3);
      return;
    }
    if (a.cid === 'kon') {
      if (!konAttacks(a.kon.s)) return;
      a.group.userData.playAttack?.();
      const e = targetUid != null ? this.actors.enemyPos(targetUid) : null;
      if (e) a.face = Math.atan2(e.x - a.group.position.x, e.z - a.group.position.z);
      a.faceT = 0.8;
      return;
    }
    let tx;
    let ty;
    let tz;
    if (point) {
      tx = point.x;
      tz = point.z;
      ty = 0.3;
      // an ult centred on her own spot: dash at the nearest monster instead (or a step ahead of her)
      if (Math.hypot(tx - a.home.x, tz - a.home.z) < 0.6) {
        const e = this._nearestEnemy(a.home.x, a.home.z, 4);
        if (e) {
          tx = e.x;
          tz = e.z;
          ty = e.y + (e.height || 0.5) * 0.5;
        } else {
          tx = a.home.x + Math.sin(a.facing) * 1.2;
          tz = a.home.z + Math.cos(a.facing) * 1.2;
        }
      }
    } else {
      const e = targetUid != null ? this.actors.enemyPos(targetUid) : null;
      if (!e) return;
      tx = e.x;
      tz = e.z;
      ty = e.y + (e.height || 0.5) * 0.5;
    }
    if (startSortie(a.sortie, tx, ty, tz, DASH_TIME, point ? null : targetUid)) a.group.userData.playAttack?.();
  }

  // ---- frame ---------------------------------------------------------------------------------

  /** @param {number} dt @param {number} [zoom] camera zoom (1 = fitted view) */
  update(dt, zoom = 1) {
    if (this.disposed) return;
    this.time += dt;
    this.frame++;
    if (!this.enabled) {
      if (this.list.size) this.clear();
      return;
    }
    // full files when zoomed in on quality high, LOD otherwise
    this.zoom = zoom;
    if (this.quality !== 'high') this.detail = 'lod';
    else if (this.detail === 'lod' && zoom >= FULL_AT) this.detail = 'full';
    else if (this.detail === 'full' && zoom <= LOD_AT) this.detail = 'lod';
    reconcile(this.list, this.sim.towers, this._of, this._make, this._drop, this.frame);
    for (const a of this.list.values()) this._update(a, dt);
  }

  /** The nearest drawn monster within `r` tiles ({ x, y, z, height }) or null. */
  _nearestEnemy(x, z, r) {
    let best = null;
    let bd = r * r;
    for (const v of this.actors.enemies.values()) {
      if (v.hidden) continue;
      const d = (v.x - x) ** 2 + (v.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  _asset(cid) {
    const exact = getCompanion(cid, this.detail, true);
    if (exact) return exact;
    const key = `${cid}|${this.detail}`;
    if (!this.requested.has(key)) {
      this.requested.add(key);
      loadCompanion(cid, this.detail).catch(() => {});
    }
    return getCompanion(cid, this.detail);
  }

  _create(t, cid) {
    const v = this.actors.towers.get(t.uid);
    const entry = companionEntry(cid);
    if (!v || !entry) return null;
    const asset = this._asset(cid);
    if (!asset) return null; // still loading: Kon's procedural fallback keeps drawing meanwhile
    const a = {
      uid: t.uid, unitId: t.unitId, cid, entry, group: null, detail: null, anchor: new HomeAnchor(entry),
      home: new THREE.Vector3(), facing: v.facing, face: 0, faceT: 0, state: 'idle', barRest: null,
      // manifest battleScale: a battle-only size factor over her scale (the student page keeps the figure's own size)
      battleScale: entry.battleScale > 0 ? entry.battleScale : 1,
      kon: cid === 'kon' ? { s: konState(), view: { x: 0, z: 0, h: 0.2, away: false }, steps: 0 } : null,
      sortie: cid === 'kon' ? null : sortieState(),
    };
    this._kit(a);
    if (a.kon) a.kon.s.hold = KON_HOLD;
    this._instance(a, asset);
    a.group.userData.playClip?.('appear');
    return a;
  }

  /**
   * The per-actor state of their moves, made once: Kaze's perch between swoops and his flight options; Kon's and
   * Kaze's trail ring (the doll keeps its threads); the pitch and Kon's pounce beat.
   */
  _kit(a) {
    if (a.kitted) return a;
    a.kitted = true;
    if (a.cid === 'kaze') {
      a.perch = perchState();
      a.swoopOpts = { reach: Infinity, lift: SWOOP_LIFT };
    }
    a.trail = a.cid === 'doll' ? null : trailState();
    if (a.kon) a.kon.steps ??= 0;
    a.pitch = 0;
    a.pPhase = null;
    a.lastY = 0;
    return a;
  }

  /** (Re)builds the figure of an actor from an asset (first time, or a detail swap). */
  _instance(a, asset) {
    if (a.group) {
      this.root.remove(a.group);
      a.group.userData.dispose?.();
      disposeObject(a.group);
    }
    const g = buildCompanion(asset, { quality: this.quality });
    g.rotation.order = 'YXZ'; // turn, then pitch about his own side axis (a bound, a stoop)
    a.group = g;
    a.detail = asset.detail;
    a.height = asset.height || a.entry.height || 0.2;
    // the doll's thread tops: where the bar bone sits at home, kept there while the doll dashes
    a.barRest = g.userData.bar ? boneAtIdle(asset, g.userData.bar.name) : null;
    this.root.add(g);
  }

  _dispose(a) {
    if (!a.group) return;
    this.root.remove(a.group);
    a.group.userData.dispose?.();
    disposeObject(a.group);
    a.group = null;
  }

  _groundAt(x, z) {
    const tr = this.terrain;
    const tx = Math.floor(x);
    const tz = Math.floor(z);
    if (tr?.isWater?.(tx, tz) && !tr.isPath?.(tx, tz)) return WATER_Y + 0.03;
    // a rooftop ('U'): beside a girl standing on it
    const roof = tr?.roofAt?.(x, z) || 0;
    if (roof) return roof + 0.05;
    return tr?.isPath?.(tx, tz) ? PATH_H : 0.05;
  }

  _update(a, dt) {
    const v = this.actors.towers.get(a.uid);
    const t = this.sim.getTower ? this.sim.getTower(a.uid) : null;
    if (!a.group || !v || !t) {
      if (a.group) a.group.visible = false;
      return;
    }
    // detail swap (zoom crossed the threshold) once that file is here; the old figure is disposed, so read
    // a.group only after this
    if (a.detail !== this.detail) {
      const asset = this._asset(a.cid);
      if (asset && asset.detail !== a.detail) this._instance(a, asset);
    }
    const g = a.group;
    g.visible = true;
    const m = v.model;
    // home point in world space: the girl's current transform × the home point in her space
    a.anchor.bind(m);
    a.anchor.local(_home);
    _m.compose(m.position, m.quaternion, m.scale);
    a.home.copy(_home).applyMatrix4(_m);
    const scale = m.scale.x * a.battleScale;
    g.scale.setScalar(scale);
    let state = 'idle';
    let facing = v.facing;
    let pitch = 0;
    if (a.kon) {
      const s = a.kon.s;
      konStep(s, dt, a.home.x, a.home.z, konSpot(t, _spot));
      if (s.mode === 'home') {
        g.position.copy(a.home);
      } else {
        g.position.set(s.x, this._groundAt(s.x, s.z), s.z);
      }
      if (s.mode === 'travel') {
        state = 'move';
        facing = Math.atan2(s.dx, s.dz);
        // a bounding run: a hop and a pitch per stride, stretched in the air, a dust puff where each bound lands
        konGait(s, _gait);
        g.position.y += _gait.lift;
        pitch = -_gait.pitch;
        g.scale.z *= _gait.stretch;
        if (s.steps !== a.kon.steps) {
          a.kon.steps = s.steps;
          this._stride(g.position.x, g.position.y - _gait.lift, g.position.z, a.height * scale);
        }
      } else if (s.mode === 'spot') {
        facing = a.faceT > 0 ? a.face : v.facing;
      }
      if (s.mode !== 'travel') a.kon.steps = s.steps;
      // Moon Pounce: crouch, an arc leap at its target (he follows it while it walks), the impact, a hop back
      const pc = a.pounce;
      if (pc?.busy) {
        if (pc.uid != null) {
          const e = this._enemy(pc.uid);
          if (e) retarget(pc, e.x, e.y + (e.height || 0.4) * 0.4, e.z);
        }
        const gy = g.position.y;
        pounceStep(pc, dt, g.position.x, gy, g.position.z, _pos, POUNCE_OPTS);
        if (_pos.phase === 'leap' && a.pPhase === 'crouch') this._dust(g.position.x, gy, g.position.z, 5, 0.45); // the push-off
        if (_pos.hit) this._pounceImpact(_pos.x, _pos.y, _pos.z);
        a.pPhase = _pos.phase;
        if (pc.busy) {
          const dx = pc.lx - g.position.x;
          const dz = pc.lz - g.position.z;
          g.position.set(_pos.x, _pos.y, _pos.z);
          state = _pos.phase === 'crouch' || _pos.phase === 'impact' ? 'idle' : 'move';
          if (dx * dx + dz * dz > 1e-6) facing = Math.atan2(dx, dz) + (_pos.out ? 0 : Math.PI);
          // squash and stretch (volume kept), nose up as he rises and down as he drops
          const sq = _pos.squash;
          g.scale.y *= sq;
          const w = 1 / Math.sqrt(sq);
          g.scale.x *= w;
          g.scale.z *= w;
          const vy = dt > 0 ? (g.position.y - a.lastY) / dt : 0;
          if (_pos.phase === 'leap' || _pos.phase === 'return') pitch = Math.max(-0.5, Math.min(0.5, -vy * 0.18));
        }
      }
      a.lastY = g.position.y;
      const kv = a.kon.view;
      kv.x = g.position.x;
      kv.z = g.position.z;
      kv.h = g.position.y + a.height * scale * 0.62;
      kv.away = s.mode !== 'home';
      // a faint holo streak along his run and his leap
      if (s.mode === 'travel' || pc?.busy) trailPush(a.trail, g.position.x, g.position.y + a.height * scale * 0.35, g.position.z, this.time);
    } else if (a.cid === 'kaze') {
      const s = a.sortie;
      // Kaze's Swoop: the next dive as soon as he is back from the last one
      if (!s.busy && (a.dives?.length || a.diving)) this._nextDive(a);
      if (s.busy && s.uid != null) {
        const e = this._enemy(s.uid);
        if (e) retarget(s, e.x, e.y + (e.height || 0.5) * 0.5, e.z);
      }
      // (a dive or a swoop flies no farther than her reach, even after a target that walks away)
      stoopStep(s, dt, a.home.x, a.home.y, a.home.z, _pos, (a.diving && a.diveOpts) || a.swoopOpts);
      g.position.set(_pos.x, _pos.y, _pos.z);
      if (_pos.hit) this._featherBurst(_pos.x, _pos.y, _pos.z);
      if (s.busy) {
        state = 'move';
        const dx = s.lx - a.home.x;
        const dz = s.lz - a.home.z;
        if (dx * dx + dz * dz > 1e-6) facing = Math.atan2(dx, dz) + (_pos.out ? 0 : Math.PI);
        pitch = _pos.pitch;
        trailPush(a.trail, _pos.x, _pos.y + a.height * scale * 0.4, _pos.z, this.time);
        // bigger out in flight than on her shoulder (eased in over the first tile)
        const away = Math.min(1, Math.hypot(_pos.x - a.home.x, _pos.y - a.home.y, _pos.z - a.home.z) / 0.9);
        g.scale.multiplyScalar(1 + (FLIGHT_SCALE - 1) * away);
      } else if (a.faceT > 0) {
        // a Swoop called from her shoulder (Reduce motion, or no target near): turned to its first target
        facing = a.face;
      }
      // the swoop that waited for him (after his rest on her shoulder), if its enemy is still drawn
      const next = perchStep(a.perch, dt, s.busy || !!a.diving || !!a.dives?.length);
      if (next != null) {
        const e = this._enemy(next);
        if (e) this._swoopAt(a, next, e);
      }
    } else {
      const s = a.sortie;
      if (s.busy && s.uid != null) {
        const e = this.actors.enemyPos(s.uid);
        if (e) retarget(s, e.x, e.y + (e.height || 0.5) * 0.5, e.z);
      }
      sortieStep(s, dt, a.home.x, a.home.y, a.home.z, _pos, DASH_OPTS);
      g.position.set(_pos.x, _pos.y, _pos.z);
      if (s.busy) {
        const dx = s.tx - a.home.x;
        const dz = s.tz - a.home.z;
        if (dx * dx + dz * dz > 1e-6) facing = Math.atan2(dx, dz);
      }
    }
    a.faceT = Math.max(0, a.faceT - dt);
    a.facing = lerpAngle(a.facing, facing, Math.min(1, dt * 10));
    a.pitch += (pitch - a.pitch) * Math.min(1, dt * 14);
    g.rotation.y = a.facing;
    g.rotation.x = a.pitch;
    a.state = state;
    g.userData.animate?.(this.time, dt, state);
    if (a.trail) this._ribbon(a);
    // the doll's threads stay tied to Yoriko's control bar while it dashes
    const bar = g.userData.bar;
    if (bar && a.barRest && bar.parent) {
      _bar.copy(a.barRest).applyAxisAngle(_v.set(0, 1, 0), v.facing).multiplyScalar(scale).add(a.home);
      g.updateMatrixWorld(true);
      bar.position.copy(bar.parent.worldToLocal(_bar));
    }
  }

  // ---- their moves' effects (FxSystem particles and quad batches: pooled, nothing made per frame) ---------------

  /** One particle from the shared spawn record (`_sp`, filled by the caller). */
  _spawn() {
    return this.fx.spawn(_sp);
  }

  _setSp(batch, uv, x, y, z, s0, s1, life, color, a0 = 1) {
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
  }

  /**
   * One bound of Kon's run lands: a dust puff, a glowing holo paw mark on the ground that fades behind him and a soft
   * afterimage glow on his body (`h`: his drawn height), so the run reads from the battle camera.
   */
  _stride(x, y, z, h) {
    const R = this.R;
    if (!this.fx || !R) return;
    this._dust(x, y, z, 4, 0.5);
    this._setSp('groundA', R.glow, x, y + 0.03, z, 0.5, 0.3, 0.75, C.holo, 0.75);
    _sp.flags = 1; // flat on the ground
    this._spawn();
    if (this.quality !== 'low') {
      this._setSp('bbA', R.glow, x, y + h * 0.4, z, h * 0.9, h * 1.3, 0.28, C.holo, 0.45);
      this._spawn();
    }
  }

  /** A little dust puff where Kon's paws land (`n` puffs, before the graphics density). Reduce motion: still. */
  _dust(x, y, z, n, size) {
    const fx = this.fx;
    if (!fx || !this.R) return;
    const k = fx.n(n);
    for (let i = 0; i < k; i++) {
      const a = Math.random() * TAU;
      this._setSp('bbN', this.R.smoke, x + Math.cos(a) * 0.08, y + 0.14, z + Math.sin(a) * 0.08, size * 0.5, size * 1.2, 0.5, C.dust, 0.85);
      if (!this.reduceMotion) {
        _sp.vx = Math.cos(a) * 0.5;
        _sp.vz = Math.sin(a) * 0.5;
        _sp.vy = 0.35;
        _sp.drag = 3;
        _sp.rot = a;
        _sp.vrot = 1.5;
      }
      this._spawn();
    }
  }

  /** Kon lands his Moon Pounce: a moonlit flash, a ground ring, a dust burst and a few star sparks (full motion only). */
  _pounceImpact(x, y, z) {
    const fx = this.fx;
    const R = this.R;
    if (!fx || !R) return;
    this._setSp('bbA', R.glow, x, y + 0.2, z, 0.9, 1.6, 0.28, C.moon, 0.95);
    this._spawn();
    this._setSp('groundA', R.ringThick || R.ringSoft, x, 0.07, z, 0.3, 2.2, 0.4, C.holo, 0.9);
    _sp.flags = 1; // flat on the ground
    this._spawn();
    this._dust(x, y, z, 6, 0.5);
    const k = fx.n(6);
    for (let i = 0; i < k; i++) {
      const a = (i / k) * TAU + Math.random() * 0.4;
      this._setSp('bbA', R.star || R.spark, x, y + 0.2, z, 0.26, 0.06, 0.45, C.white, 1);
      _sp.vx = Math.cos(a) * 1.6;
      _sp.vz = Math.sin(a) * 1.6;
      _sp.vy = 1.4;
      _sp.g = -4;
      _sp.drag = 1.5;
      _sp.rot = a;
      _sp.vrot = 6;
      this._spawn();
    }
  }

  /** Kaze strikes: a white flash and his feathers bursting off the hit, drifting down (Reduce motion: still feathers). */
  _featherBurst(x, y, z) {
    const fx = this.fx;
    const R = this.R;
    if (!fx || !R) return;
    this._setSp('bbA', R.glow, x, y, z, 0.6, 1.0, 0.18, C.white, 0.85);
    this._spawn();
    const feather = R.feather || R.glow;
    const k = fx.n(this.reduceMotion ? 3 : 7);
    for (let i = 0; i < k; i++) {
      const a = (i / k) * TAU + Math.random() * 0.5;
      this._setSp('bbN', feather, x, y, z, 0.3, 0.22, this.reduceMotion ? 0.5 : 0.85, i % 2 ? C.white : C.feather, 1);
      _sp.asp = 2;
      _sp.rot = a;
      if (this.reduceMotion) {
        _sp.x = x + Math.cos(a) * 0.3;
        _sp.z = z + Math.sin(a) * 0.25;
      } else {
        const sp = 1.2 + (i % 3) * 0.3;
        _sp.vx = Math.cos(a) * sp;
        _sp.vz = Math.sin(a) * sp;
        _sp.vy = 1 + (i % 2) * 0.5;
        _sp.g = -2.6;
        _sp.drag = 2.2;
        _sp.vrot = i % 2 ? 5 : -5;
      }
      this._spawn();
    }
  }

  /**
   * The trail behind Kaze (a gold wing ribbon) or Kon (a faint holo streak): camera-facing quads between its recent
   * points, thinning and fading with age. Not at low graphics.
   */
  _ribbon(a) {
    const tr = a.trail;
    if (!tr.count) return;
    const B = this.b?.bbA;
    if (!B || !this.camera || !this.R || this.quality === 'low') {
      if (this.time - tr.t[trailAt(tr, 0)] > TRAIL_LIFE) trailClear(tr);
      return;
    }
    const kaze = a.cid === 'kaze';
    const col = kaze ? C.wing : C.holo;
    const w0 = kaze ? 0.22 : 0.24;
    const a0 = kaze ? 0.9 : 0.8;
    let fresh = false;
    for (let i = 0; i + 1 < tr.count; i++) {
      const p = trailAt(tr, i);
      const q = trailAt(tr, i + 1);
      const f = trailFade(tr.t[q], this.time);
      if (f <= 0) break;
      fresh = true;
      const taper = 1 - i / tr.count;
      this._line(B, tr.x[p], tr.y[p], tr.z[p], tr.x[q], tr.y[q], tr.z[q], w0 * (0.4 + 0.6 * taper), col, a0 * f);
    }
    if (!fresh && this.time - tr.t[trailAt(tr, 0)] > TRAIL_LIFE) trailClear(tr);
  }

  /** A camera-facing quad from a to b (world x, height, z) with the soft beam sprite. */
  _line(B, ax, ay, az, bx, by, bz, w, c, alpha) {
    const view = this.camera.matrixWorldInverse;
    _la.set(ax, ay, az).applyMatrix4(view);
    _lb.set(bx, by, bz).applyMatrix4(view);
    const dx = _lb.x - _la.x;
    const dy = _lb.y - _la.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.005) return;
    B.push((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, len, w, this.R.beam || this.R.glow, c.r, c.g, c.b, alpha, Math.atan2(dy, dx));
  }

  dispose() {
    this.disposed = true;
    this.clear();
    this.root.removeFromParent();
  }
}

const DASH_OPTS = { reach: DASH_REACH, stop: DASH_STOP, lift: DASH_LIFT };
const POUNCE_OPTS = { stop: POUNCE_STOP, lift: POUNCE_LIFT };
