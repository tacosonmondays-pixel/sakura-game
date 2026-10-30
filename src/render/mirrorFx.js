// Iroha's mirror panel in motion (display only; owned by src/render/rosterFx.js, which draws the panel mesh itself).
// It reads sim state (her tower, its relay origin t.ox / t.oy, t.abil) and what the other display layers tell it,
// and never writes to the sim:
//   shot(uid, dx, dy)   a bolt left the panel going (dx, dy) (src/render/attackFx/styles/iroha.js origin(), once per
//                       bolt): the glass flips toward it, a glint sweeps it and a small flash marks where the bolt left
//                       (rate-limited and merged by src/render/mirrorPanel.js, so a fast volley never strobes)
//   jump(uid, ...)      the sim's 'relay' event moved the panel (her aim, an upgrade, Mirror Shift): fading
//                       afterimage panels along the jump and a shimmer where it lands
//   ability(ev)         the sim's 'ability' event for Mirror Shift: while it lasts, a faint ghost panel echoes the
//                       glass and the relayed bolts draw split in two (styles/iroha.js view)
//   pose(t, p, mesh, x, y)   once per frame per panel: the mesh's yaw / tip / pop and every quad above
// Reduce motion: no flip, no tip, no afterimages along the jump (one that fades where the panel was), the shimmer keeps
// still; glints and flashes stay (short fades). Low graphics: billboard afterimages instead of ghost meshes, no
// shimmer sparkles. Pools: per-panel states are reused, afterimage meshes are a fixed pool of MAX_GHOSTS built on the
// first jump; nothing is allocated per shot.
import * as THREE from 'three';
import {
  FLIP, KICK_FLIP, KICK_GLINT, KICK_FLASH, createPanelAnim, panelReset, panelKick, panelPose, glintPhase, flashLevel,
  shotYaw, ghostCount, ghostAt,
} from './mirrorPanel.js';
import { ABILITIES } from '../data/abilities.js';

const TAU = Math.PI * 2;
/** Afterimage meshes in the pool (every panel shares them; a jump past the cap draws fewer). */
export const MAX_GHOSTS = 8;
/** Billboard afterimages (low graphics) alive at once. */
export const MAX_FLAT_GHOSTS = 8;
/** The glass centre's height (rosterFx mirrorGeometry: y 0.52 at scale 1.6, standing 0.02 up). */
export const GLASS_H = 0.86;
const PANEL_SCALE = 1.6;
const GHOST_LIFE = 0.5;
const ARRIVE_LIFE = 0.5;
const SHIFT_ID = 'iroha.mirrorShift';

const SILVER = [0.94, 0.93, 1];
const LILAC = [0.85, 0.77, 0.98];
const PLUM = [0.64, 0.42, 0.82];

const _pose = { yaw: 0, tip: 0, busy: false };
const _g = { x: 0, y: 0, delay: 0 };

export class MirrorFx {
  /**
   * @param {{ sim, fx, batches, atlas, root: THREE.Object3D, geometry: () => THREE.BufferGeometry, quality?: string,
   *   reduceMotion?: boolean }} o geometry: the panel's shared geometry (built by rosterFx on first need)
   */
  constructor({ sim, fx, batches, atlas, root, geometry, quality = 'medium', reduceMotion = false }) {
    this.sim = sim;
    this.fx = fx;
    this.b = batches;
    this.R = atlas.regions;
    this.root = root;
    this.geometry = geometry;
    this.quality = quality;
    this.reduceMotion = !!reduceMotion;
    /** real seconds (the board's frames) */
    this.now = 0;
    /** per tower uid: panel state (createPanelAnim + yaw, arriveT, shiftUntil, lastShotYaw) */
    this.panels = new Map();
    this._free = [];
    /** afterimage meshes: { mesh, mat, live, t, delay, life, x, y, yaw, a0 } */
    this.ghosts = null;
    /** low graphics: billboard afterimages { live, t, delay, x, y, yaw, a0 } */
    this.flat = [];
    for (let i = 0; i < MAX_FLAT_GHOSTS; i++) this.flat.push({ live: false, t: 0, delay: 0, x: 0, y: 0, yaw: 0, a0: 0.5 });
    /** how much bigger the glint / flash / echo draw when the board is zoomed far out (set by the renderer) */
    this.readScale = () => 1;
    this.stats = { shots: 0, flips: 0, merged: 0, glints: 0, flashes: 0, jumps: 0, ghosts: 0, ghostsDropped: 0 };
  }

  setQuality(q) {
    this.quality = q;
  }

  _state(uid) {
    let s = this.panels.get(uid);
    if (!s) {
      s = this._free.pop() || createPanelAnim();
      panelReset(s);
      s.yaw = 0;
      s.arriveT = -1e9;
      s.shiftUntil = -1;
      s.lastShotYaw = 0;
      this.panels.set(uid, s);
    }
    return s;
  }

  drop(uid) {
    const s = this.panels.get(uid);
    if (!s) return;
    this.panels.delete(uid);
    this._free.push(s);
  }

  /** A bolt left her panel going (dx, dy). */
  shot(uid, dx, dy) {
    const s = this._state(uid);
    const yaw = shotYaw(dx, dy);
    s.lastShotYaw = yaw;
    const k = panelKick(s, this.now, yaw, s.yaw, this.reduceMotion);
    this.stats.shots++;
    if (k & KICK_FLIP) this.stats.flips++;
    else if (!this.reduceMotion) this.stats.merged++;
    if (k & KICK_GLINT) this.stats.glints++;
    if (k & KICK_FLASH) this.stats.flashes++;
    return k;
  }

  /** The panel jumped from (fx, fy) to (tx, ty) (drawn positions, tiles). */
  jump(uid, fx, fy, tx, ty) {
    const s = this._state(uid);
    s.arriveT = this.now;
    this.stats.jumps++;
    const rm = this.reduceMotion;
    if (Math.hypot(tx - fx, ty - fy) < 0.5) return;
    const n = ghostCount(this.quality, rm);
    const low = this.quality === 'low';
    if (!low) this._ensureGhosts();
    for (let i = 0; i < n; i++) {
      ghostAt(i, n, fx, fy, tx, ty, rm, _g);
      const g = low ? this._freeFlat() : this._freeGhost();
      if (!g) {
        this.stats.ghostsDropped++;
        continue;
      }
      g.live = true;
      g.t = 0;
      g.delay = _g.delay;
      g.x = _g.x;
      g.y = _g.y;
      g.yaw = s.yaw;
      // the trail brightens toward where it lands
      g.a0 = rm ? 0.45 : 0.3 + 0.3 * ((i + 1) / n);
      this.stats.ghosts++;
    }
  }

  /** The sim's 'ability' event (only Mirror Shift is read): its window, by the sim clock. */
  ability(ev, t) {
    if (ev.id !== SHIFT_ID || !t) return;
    const s = this._state(t.uid);
    const def = ABILITIES.iroha?.[0];
    const t5 = (t.tiers?.[0] | 0) >= 5;
    const dur = (t5 ? def?.t5?.duration : null) ?? def?.duration ?? 8;
    s.shiftUntil = this.sim.time + dur;
    s.arriveT = this.now;
  }

  /** Is her Mirror Shift running (the sim's ability state, else the window its event opened)? */
  shifting(t) {
    if (!t) return false;
    const a = t.abil;
    if (a && a.id === SHIFT_ID && a.active > 0) return true;
    const s = this.panels.get(t.uid);
    return !!s && s.shiftUntil > this.sim.time;
  }

  /** Dev / e2e preview of the Shift window (display only; the sim runs Mirror Shift since A6). */
  previewShift(uid, seconds) {
    const s = this._state(uid);
    s.shiftUntil = this.sim.time + seconds;
    s.arriveT = this.now;
  }

  _ensureGhosts() {
    if (this.ghosts) return;
    this.ghosts = [];
    const geo = this.geometry();
    for (let i = 0; i < MAX_GHOSTS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        vertexColors: true, color: new THREE.Color('#d6c4ff'), transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.rotation.order = 'YXZ';
      mesh.renderOrder = 9;
      this.root.add(mesh);
      this.ghosts.push({ mesh, mat, live: false, t: 0, delay: 0, x: 0, y: 0, yaw: 0, a0: 0.5 });
    }
  }

  _freeGhost() {
    for (const g of this.ghosts) if (!g.live) return g;
    return null;
  }

  _freeFlat() {
    for (const g of this.flat) if (!g.live) return g;
    return null;
  }

  /** Once per frame, before the panels are posed. */
  update(dt) {
    this.now += dt;
    const rm = this.reduceMotion;
    if (this.ghosts) {
      for (const g of this.ghosts) {
        if (!g.live) continue;
        if (g.delay > 0) {
          g.delay -= dt;
          g.mesh.visible = false;
          continue;
        }
        g.t += dt;
        const k = g.t / GHOST_LIFE;
        if (k >= 1) {
          g.live = false;
          g.mesh.visible = false;
          continue;
        }
        g.mesh.visible = true;
        g.mat.opacity = g.a0 * (1 - k) * (1 - k);
        g.mesh.position.set(g.x, 0.02 + (rm ? 0 : 0.06 * k), g.y);
        g.mesh.rotation.set(0, g.yaw, 0);
        g.mesh.scale.setScalar(PANEL_SCALE * (rm ? 1 : 1 - 0.1 * k));
      }
    }
    const R = this.R;
    for (const g of this.flat) {
      if (!g.live) continue;
      if (g.delay > 0) {
        g.delay -= dt;
        continue;
      }
      g.t += dt;
      const k = g.t / GHOST_LIFE;
      if (k >= 1) {
        g.live = false;
        continue;
      }
      const a = g.a0 * (1 - k);
      this.b.bbA.push(g.x, GLASS_H, g.y, 0.42, 0.6, R.mirror || R.glow, LILAC[0], LILAC[1], LILAC[2], a);
    }
  }

  /**
   * Poses her panel mesh and draws its glint, leave flash, Shift echo and arrival shimmer at the drawn spot (x, y).
   * @param {number} rest the idle yaw (the slow sway toward the camera side)
   */
  pose(t, mesh, x, y, rest) {
    const s = this._state(t.uid);
    const now = this.now;
    const rm = this.reduceMotion;
    const low = this.quality === 'low';
    const R = this.R;
    const bbA = this.b.bbA;
    // a far zoom (a phone showing the whole board) draws the cues bigger so they still read
    const rs = Math.max(1, Math.min(1.7, this.readScale() || 1));
    if (rm) {
      _pose.yaw = rest;
      _pose.tip = 0;
    } else panelPose(s, now, rest, _pose);
    s.yaw = _pose.yaw;
    const fl = flashLevel(s, now);
    mesh.rotation.set(_pose.tip, _pose.yaw, 0); // (rosterFx sets the order to YXZ: the tip leans toward the shot)
    mesh.scale.setScalar(PANEL_SCALE * (rm ? 1 : 1 + 0.07 * fl));

    // the specular glint: a bright streak sweeping diagonally over the glass, a star where it peaks
    const gk = glintPhase(s, now);
    if (gk >= 0) {
      const a = Math.sin(gk * Math.PI);
      const off = (gk - 0.5) * 0.46;
      bbA.push(x, GLASS_H, y, 0.5 * rs, 0.09 * rs, R.beam, 1, 1, 1, 0.95 * a, 0.8, off * 0.7, -off * 0.9);
      bbA.push(x, GLASS_H, y, 0.32 * rs, 0.32 * rs, R.glow, SILVER[0], SILVER[1], SILVER[2], 0.5 * a, 0, off * 0.7, -off * 0.9);
      if (!low && gk > 0.35 && gk < 0.8) {
        const sa = (0.36 * Math.sin(((gk - 0.35) / 0.45) * Math.PI) + 0.05) * rs;
        bbA.push(x, GLASS_H, y, sa, sa, R.star, 1, 1, 1, Math.min(1, sa * 2), rm ? 0.4 : now * 4, off * 0.7, -off * 0.9);
      }
    }
    // the leave flash: a silver bloom and a crisp star on the glass
    if (fl > 0) {
      const g1 = (0.35 + 0.45 * fl) * rs;
      const g2 = (0.5 * fl + 0.1) * rs;
      bbA.push(x, GLASS_H, y, g1, g1, R.glow, SILVER[0], SILVER[1], SILVER[2], 0.9 * fl);
      bbA.push(x, GLASS_H, y, g2, g2, R.star, 1, 1, 1, fl, 0.3);
      bbA.push(x, GLASS_H, y, 0.75 * fl * rs, 0.75 * fl * rs, R.glow, PLUM[0], PLUM[1], PLUM[2], 0.35 * fl);
    }
    // Laser Web running: a faint ghost panel beside her first glass echoes it (brighter on every relayed shot)
    if (this.shifting(t)) {
      const side = s.lastShotYaw + Math.PI / 2;
      const ex = x + Math.sin(side) * 0.34;
      const ey = y + Math.cos(side) * 0.34;
      const pulse = rm ? 0 : 0.06 * Math.sin(now * 5 + t.uid);
      const ea = 0.3 + 0.4 * fl + pulse;
      bbA.push(ex, GLASS_H, ey, 0.4 * Math.sqrt(rs), 0.58 * Math.sqrt(rs), R.mirror || R.glow, LILAC[0], LILAC[1], LILAC[2], ea);
      bbA.push(ex, GLASS_H, ey, 0.6, 0.75, R.glow, PLUM[0], PLUM[1], PLUM[2], 0.18 + 0.25 * fl);
      this.b.groundA.push(x, 0.075, y, 1.0, 1.0, R.ringDashed || R.ring, LILAC[0], LILAC[1], LILAC[2], 0.35, rm ? 0 : now * 0.8);
    }
    // the arrival shimmer: a soft column and sparkles circling it (still on Reduce motion)
    const ak = (now - s.arriveT) / ARRIVE_LIFE;
    if (ak >= 0 && ak < 1) {
      const fade = 1 - ak;
      bbA.push(x, 0.75, y, 0.55, 1.5, R.glow, LILAC[0], LILAC[1], LILAC[2], 0.55 * fade);
      bbA.push(x, GLASS_H, y, 0.7, 0.7, R.glow, 1, 1, 1, 0.45 * fade * fade);
      if (!low) {
        const n = 6;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * TAU + (rm ? 0 : ak * 2.6);
          const h = rm ? 0.45 + 0.12 * i : 0.25 + 0.9 * ((i / n + ak * 0.8) % 1);
          const tw = Math.sin((ak * 3 + i * 0.37) * Math.PI);
          bbA.push(x + Math.cos(ang) * 0.34, h, y + Math.sin(ang) * 0.34, 0.16, 0.16, R.star, SILVER[0], SILVER[1], SILVER[2], fade * (0.5 + 0.5 * Math.abs(tw)), rm ? 0 : now * 3);
        }
      }
    }
  }

  /** Stats for the e2e probe (a copy: dev tooling only). */
  probe() {
    let live = 0;
    if (this.ghosts) for (const g of this.ghosts) if (g.live) live++;
    for (const g of this.flat) if (g.live) live++;
    const now = this.now;
    const list = [];
    for (const [uid, s] of this.panels) {
      list.push({ uid, turning: now - s.t0 < FLIP.turn, glint: glintPhase(s, now), flash: flashLevel(s, now), yaw: s.yaw, arriving: now - s.arriveT < ARRIVE_LIFE });
    }
    return { ...this.stats, liveGhosts: live, panels: this.panels.size, pool: this.ghosts ? this.ghosts.length : 0, list };
  }

  dispose() {
    if (this.ghosts) {
      for (const g of this.ghosts) {
        this.root.remove(g.mesh);
        g.mat.dispose();
      }
      this.ghosts = null;
    }
    for (const g of this.flat) g.live = false;
    this.panels.clear();
    this._free.length = 0;
  }
}
