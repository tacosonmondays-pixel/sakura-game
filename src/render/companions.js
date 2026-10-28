// Companion actors in battle (display only: reads the sim's towers and drained events, never writes):
//   Kon (Ruri)    sits by her; runs along the ground to her relay origin (t.ox / t.oy) and sits there;
//                 her bolts leap out of him (attack clip); runs back when the spot goes away; on Moon Pounce
//                 (her ⚡) he leaps at its target and back (Reduce motion: he stays put and plays his attack)
//   Kaze (Hana)   perches on her left shoulder (rides her shoulder bone); on her attacks he swoops to the
//                 target and back in a short arc, one swoop at a time; on Kaze's Swoop (her ⚡) he dives on
//                 each of its targets within her reach in turn, quicker, never across the map (the far ones take
//                 abilityFx's feather strike from the sky); Reduce motion: no dive — he stays on her shoulder,
//                 turns to the first target and plays his attack, and the strikes are still fades on the targets
//   the doll      (Yoriko) hangs in front of her raised hand on thin strings tied to her control bar; each of
//                 her attacks plays Command → Extend → Strike → Reel and a pendulum settle, the strike on the
//                 sim's hit; Dream Detour too (./marionette.js, rules ./marionetteLogic.js)
// One actor per placed girl who has a companion (co-op partners' girls too: they are in the shared sim);
// 'appear' plays when she is placed, the actor goes when she is sold. Models and the manifest contract:
// src/models/companions.js. Rules (pure): ./companionLogic.js.
//
//   const c = new Companions({ sim, scene, actors, terrain, quality });
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
  konState, konStep, konSpot, konAttacks, sortieState, startSortie, retarget, sortieStep, reconcile, swoopDives, diveReach,
  SWOOP_TIME, SWOOP_LIFT, DASH_TIME, DASH_REACH, DASH_STOP, DASH_LIFT, DIVE_TIME, POUNCE_TIME, POUNCE_STOP, POUNCE_LIFT,
} from './companionLogic.js';
import { Marionette } from './marionette.js';

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
const _pos = { x: 0, y: 0, z: 0, out: false };

export class Companions {
  /** @param {{ sim, scene: THREE.Scene, actors, terrain, quality: string, reduceMotion?: boolean }} o */
  constructor({ sim, scene, actors, terrain, quality, reduceMotion = false }) {
    this.sim = sim;
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
    this._make = (t, cid) => this._create(t, cid);
    this._drop = (a) => this._dispose(a);
    this._of = (unitId) => companionOf(unitId);
    // Yoriko's doll: stages, strings, needles' origin (./marionette.js)
    this.marionette = new Marionette({ sim, actors, root: this.root, quality, reduceMotion: this.reduceMotion });
    this._nearest = (x, z, r) => this._nearestEnemy(x, z, r);
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
    this.marionette.quality = q;
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

  /** Where Yoriko `uid`'s doll is drawn ({ x, z, h }: its body, where her needles leave it) or null. */
  dollAt(uid) {
    const a = this.list.get(uid);
    if (!a || a.cid !== 'doll' || !a.group) return null;
    return this.marionette.at(a);
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
      if (a.mar) dollRow(rows[rows.length - 1], a, this.marionette.probe(a));
    }
    return { enabled: this.enabled, quality: this.quality, detail: this.detail, actors: rows };
  }

  // ---- events --------------------------------------------------------------------------------

  /** Observes a sim event (never consumes it). */
  handle(ev) {
    if (ev.type === 'attack') {
      const a = this.list.get(ev.towerUid);
      if (a?.group && a.cid === 'doll') this.marionette.onAttack(a, ev);
      else if (a?.group) this._onAttack(a, ev.targetUid, null);
    } else if (ev.type === 'ult') {
      const a = this.list.get(ev.towerUid);
      // Dream Detour: the doll dashes toward the ult's centre
      if (a?.group && a.cid === 'doll' && ev.x != null) this.marionette.onPoint(a, ev.x, ev.y, this._nearest);
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
    startSortie(a.pounce, e.x, e.y + (e.height || 0.4) * 0.4, e.z, POUNCE_TIME, uid);
  }

  _onAttack(a, targetUid, point) {
    // (her ⚡ dives come first: her plain swoops wait until they are done)
    if (a.cid === 'kaze' && (a.dives?.length || a.diving)) return;
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
    const dur = a.cid === 'kaze' ? SWOOP_TIME : DASH_TIME;
    if (startSortie(a.sortie, tx, ty, tz, dur, point ? null : targetUid)) a.group.userData.playAttack?.();
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
    this.marionette.tick(dt);
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
      kon: cid === 'kon' ? { s: konState(), view: { x: 0, z: 0, h: 0.2, away: false } } : null,
      sortie: cid === 'kon' ? null : sortieState(),
    };
    if (a.kon) a.kon.s.hold = KON_HOLD;
    this._instance(a, asset);
    a.group.userData.playClip?.('appear');
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
    a.group = g;
    a.detail = asset.detail;
    a.height = asset.height || a.entry.height || 0.2;
    // the doll's thread tops: where the bar bone sits at home, kept there while the doll dashes
    a.barRest = g.userData.bar ? boneAtIdle(asset, g.userData.bar.name) : null;
    this.root.add(g);
    // the doll: its GLB threads give way to the drawn strings
    if (a.cid === 'doll') this.marionette.bind(a, asset);
  }

  _dispose(a) {
    if (a.cid === 'doll') this.marionette.release(a);
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
    if (a.cid === 'doll') {
      this.marionette.update(a, v, t, dt, scale);
      return;
    }
    let state = 'idle';
    let facing = v.facing;
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
      } else if (s.mode === 'spot') {
        facing = a.faceT > 0 ? a.face : v.facing;
      }
      // Moon Pounce: a leap from where he stands to its target and back (he follows it while it walks)
      const pc = a.pounce;
      if (pc?.busy) {
        if (pc.uid != null) {
          const e = this.actors.enemyPos(pc.uid);
          if (e) retarget(pc, e.x, e.y + (e.height || 0.4) * 0.4, e.z);
        }
        sortieStep(pc, dt, g.position.x, g.position.y, g.position.z, _pos, POUNCE_OPTS);
        if (pc.busy) {
          const dx = pc.tx - g.position.x;
          const dz = pc.tz - g.position.z;
          g.position.set(_pos.x, _pos.y, _pos.z);
          state = 'move';
          if (dx * dx + dz * dz > 1e-6) facing = Math.atan2(dx, dz) + (_pos.out ? 0 : Math.PI);
        }
      }
      const kv = a.kon.view;
      kv.x = g.position.x;
      kv.z = g.position.z;
      kv.h = g.position.y + a.height * scale * 0.62;
      kv.away = s.mode !== 'home';
    } else {
      const s = a.sortie;
      // Kaze's Swoop: the next dive as soon as he is back from the last one
      if (!s.busy && a.cid === 'kaze' && (a.dives?.length || a.diving)) this._nextDive(a);
      if (s.busy && s.uid != null) {
        const e = this.actors.enemyPos(s.uid);
        if (e) retarget(s, e.x, e.y + (e.height || 0.5) * 0.5, e.z);
      }
      // (a dive flies no farther than her reach, even after a target that walks away)
      const opts = a.cid === 'kaze' ? ((a.diving && a.diveOpts) || SWOOP_OPTS) : DASH_OPTS;
      sortieStep(s, dt, a.home.x, a.home.y, a.home.z, _pos, opts);
      g.position.set(_pos.x, _pos.y, _pos.z);
      if (s.busy) {
        state = a.cid === 'kaze' ? 'move' : 'idle';
        const dx = s.tx - a.home.x;
        const dz = s.tz - a.home.z;
        if (dx * dx + dz * dz > 1e-6) facing = Math.atan2(dx, dz) + (_pos.out || a.cid === 'doll' ? 0 : Math.PI);
      } else if (a.cid === 'kaze' && a.faceT > 0) {
        // a Swoop called from her shoulder (Reduce motion, or no target near): turned to its first target
        facing = a.face;
      }
    }
    a.faceT = Math.max(0, a.faceT - dt);
    a.facing = lerpAngle(a.facing, facing, Math.min(1, dt * 10));
    g.rotation.y = a.facing;
    a.state = state;
    g.userData.animate?.(this.time, dt, state);
    // the doll's threads stay tied to Yoriko's control bar while it dashes
    const bar = g.userData.bar;
    if (bar && a.barRest && bar.parent) {
      _bar.copy(a.barRest).applyAxisAngle(_v.set(0, 1, 0), v.facing).multiplyScalar(scale).add(a.home);
      g.updateMatrixWorld(true);
      bar.position.copy(bar.parent.worldToLocal(_bar));
    }
  }

  dispose() {
    this.disposed = true;
    this.clear();
    this.marionette.dispose();
    this.root.removeFromParent();
  }
}

/** The doll's probe row: 'sortie' from Command to the end of the settle, its target and stage. */
function dollRow(row, a, m) {
  const s = a.mar;
  const out = s.stage !== 'idle';
  row.mode = out ? 'sortie' : 'home';
  row.target = out ? [+s.tx.toFixed(3), +s.ty.toFixed(3), +s.tz.toFixed(3)] : null;
  row.targetUid = out ? (s.uid ?? null) : null;
  row.marionette = m;
}

const SWOOP_OPTS = { lift: SWOOP_LIFT };
const DASH_OPTS = { reach: DASH_REACH, stop: DASH_STOP, lift: DASH_LIFT };
const POUNCE_OPTS = { stop: POUNCE_STOP, lift: POUNCE_LIFT };
