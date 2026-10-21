// Angled orthographic battle camera: frames the map with margins (respecting HUD insets),
// supports pan / zoom around a screen point / reset, clamps so the board never leaves the
// screen, auto-rotates 90° in portrait so the long side of the map runs down the screen,
// and shakes for impacts (trauma: sized in screen pixels, smooth noise, a hint of roll) with a
// small zoom punch for ultimates (docs/VFX.md §M1). Locked (setLocked, the default camera setting —
// src/render/cameraPolicy.js) it holds the fitted view: pan / zoom calls do nothing. A focus
// shift (setFocusShift) slides the framing itself, locked or not, so a selected girl's ring
// clears the info panel; it glides there and back and holds still while a girl is placed.
import * as THREE from 'three';

const PITCH = THREE.MathUtils.degToRad(48);
const MAX_ZOOM = 3.2;

/** Shake at full trauma, as a share of the short side of the view (CSS px)… */
export const SHAKE_SHARE = 0.034;
/** …but at least / at most this many CSS px. */
export const SHAKE_MIN_PX = 9;
export const SHAKE_MAX_PX = 24;
/** Camera roll at full trauma (radians). */
export const SHAKE_ROLL = THREE.MathUtils.degToRad(0.7);
/** Trauma lost per second (1 → 0 in ≈ 0.65 s). */
export const TRAUMA_DECAY = 1.55;
/** Largest zoom punch (share of the view) and its longest length (s). */
export const PUNCH_MAX = 0.12;
export const PUNCH_MAX_S = 0.6;

/** Smooth 1-D noise in [-1, 1]: two detuned sines (no randomness; same picture every run). */
function wave(t, f1, f2, p1, p2) {
  return 0.62 * Math.sin(t * f1 + p1) + 0.38 * Math.sin(t * f2 + p2);
}

/** Zoom punch envelope over k = 0..1: a quick swell (18 %), then an eased return to exactly 0. */
export function punchEnvelope(k) {
  if (!(k > 0) || k >= 1) return 0;
  if (k < 0.18) {
    const u = k / 0.18;
    return 1 - (1 - u) * (1 - u);
  }
  const u = (k - 0.18) / 0.82;
  return 1 - u * u * (3 - 2 * u);
}

/**
 * Focus slide (CSS px, ≥ 0) that brings the screen span a..b inside lo..hi from the far side:
 * just far enough when it fits, else centred in lo..hi; never more than `max`.
 */
export function clearSlide(lo, hi, a, b, max) {
  if (b <= hi) return 0;
  const s = b - a <= hi - lo ? b - hi : (a + b) / 2 - (lo + hi) / 2;
  return Math.max(0, Math.min(max, s));
}

export class CameraRig {
  /**
   * @param {{ width: number, height: number }} map size in tiles
   */
  constructor(map) {
    this.mapW = map.width;
    this.mapH = map.height;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.dist = 40;
    this.viewW = 1; // CSS px
    this.viewH = 1;
    this.insets = { top: 0, right: 0, bottom: 0, left: 0 };
    this.yaw = 0;
    this.fitScale = 0.05; // world units per CSS px at zoom 1
    this.zoom = 1;
    this.pan = new THREE.Vector2(); // view-space offset (world units)
    this.extent = new THREE.Vector2(1, 1); // half extents of the map in view space
    this.baseOffset = new THREE.Vector2();
    this.trauma = 0; // 0..1: shake size = trauma² × the view's shake px
    this.shakeT = 0;
    this.shakePx = { x: 0, y: 0, roll: 0 }; // this frame's shake (CSS px / radians; read-only)
    this._punch = null; // { t, dur, amt }
    this.punchZoom = 1; // this frame's zoom-punch factor (1 = none; read-only)
    this.forceYaw = null;
    this.locked = false;
    this.target = new THREE.Vector3(); // the world point the camera looks at (after apply)
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._center = new THREE.Vector3(this.mapW / 2, 0, this.mapH / 2);
    this._anim = null;
    this.focus = new THREE.Vector2(); // CSS px the framing is slid by (x: board moves left, y: up)
    this.focusGoal = new THREE.Vector2();
    this._focusHold = false;
  }

  /** Sets the viewport size (CSS px) and HUD insets; refits. */
  setViewport(w, h, insets = this.insets) {
    this.viewW = Math.max(1, w);
    this.viewH = Math.max(1, h);
    this.insets = { top: 0, right: 0, bottom: 0, left: 0, ...insets };
    const portrait = this.viewH > this.viewW * 1.08;
    this.yaw = this.forceYaw ?? (portrait && this.mapW > this.mapH ? Math.PI / 2 : 0);
    this._fit();
    this.apply();
  }

  /** Orientation vectors for the current yaw. */
  _basis() {
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    // forward points from camera to target (down + toward -z when yaw = 0)
    this._fwd.set(-sy * Math.cos(PITCH), -Math.sin(PITCH), -cy * Math.cos(PITCH));
    this._right.set(cy, 0, -sy);
    this._up.crossVectors(this._right, this._fwd).normalize();
  }

  _fit() {
    this._basis();
    // Project the map box (with a little height for props/characters) onto the view plane.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const p = new THREE.Vector3();
    const pad = 0.35;
    for (const x of [-pad, this.mapW + pad]) {
      for (const z of [-pad, this.mapH + pad]) {
        for (const y of [0, 1.1]) {
          p.set(x - this._center.x, y, z - this._center.z);
          const vx = p.dot(this._right);
          const vy = p.dot(this._up);
          minX = Math.min(minX, vx);
          maxX = Math.max(maxX, vx);
          minY = Math.min(minY, vy);
          maxY = Math.max(maxY, vy);
        }
      }
    }
    const { top, right, bottom, left } = this.insets;
    const availW = Math.max(80, this.viewW - left - right);
    const availH = Math.max(80, this.viewH - top - bottom);
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    this.fitScale = Math.max(spanX / availW, spanY / availH);
    this.extent.set(spanX / 2, spanY / 2);
    // Centre of the box in view space, and the shift needed to centre it in the inset area.
    const cx = (minX + maxX) / 2;
    const cyv = (minY + maxY) / 2;
    const offPxX = (left - right) / 2;
    const offPxY = (bottom - top) / 2;
    this.baseOffset.set(cx - offPxX * this.fitScale, cyv - offPxY * this.fitScale);
  }

  /** World units per CSS px at the current zoom. */
  get scale() {
    return this.fitScale / this.zoom;
  }

  /** Shake size at full trauma for this view (CSS px). */
  get shakeMaxPx() {
    return THREE.MathUtils.clamp(Math.min(this.viewW, this.viewH) * SHAKE_SHARE, SHAKE_MIN_PX, SHAKE_MAX_PX);
  }

  /**
   * @param {number} dt visual seconds (glides)
   * @param {number} [focusDt] real seconds for the focus slide (it also runs while paused)
   * @param {number} [shakeDt] frame seconds for the shake and zoom punch (they keep going
   *   through a hit-stop: the picture holds, the camera still jolts)
   */
  apply(dt = 0, focusDt = dt, shakeDt = dt) {
    if (this._anim) {
      const a = this._anim;
      a.t = Math.min(1, a.t + dt / a.dur);
      const k = 1 - (1 - a.t) ** 3;
      this.zoom = a.z0 + (a.z1 - a.z0) * k;
      this.pan.set(a.p0.x + (a.p1.x - a.p0.x) * k, a.p0.y + (a.p1.y - a.p0.y) * k);
      if (a.t >= 1) this._anim = null;
    }
    if (this.locked && !this._anim) {
      // locked: exactly the fitted framing, whatever touched zoom / pan
      this.zoom = 1;
      this.pan.set(0, 0);
    }
    if (!this._focusHold && focusDt > 0) {
      const f = this.focus;
      const g = this.focusGoal;
      const k = 1 - Math.exp(-focusDt * 12);
      f.x += (g.x - f.x) * k;
      f.y += (g.y - f.y) * k;
      if (Math.abs(g.x - f.x) < 0.5) f.x = g.x;
      if (Math.abs(g.y - f.y) < 0.5) f.y = g.y;
    }
    this._focusHold = false;
    this._clamp();
    const s = this.scale;
    // zoom punch: the frustum narrows a little and comes back to exactly the framing
    this.punchZoom = 1;
    const pu = this._punch;
    if (pu) {
      pu.t += Math.max(0, shakeDt);
      const k = pu.t / pu.dur;
      if (k >= 1) this._punch = null;
      else this.punchZoom = 1 + pu.amt * punchEnvelope(k);
    }
    const fs = s / this.punchZoom;
    const hw = (this.viewW * fs) / 2;
    const hh = (this.viewH * fs) / 2;
    const cam = this.camera;
    cam.left = -hw;
    cam.right = hw;
    cam.top = hh;
    cam.bottom = -hh;
    // shake: trauma² × the view's shake px, smooth noise, a hint of roll
    const sp = this.shakePx;
    sp.x = 0;
    sp.y = 0;
    sp.roll = 0;
    if (this.trauma > 0) {
      this.shakeT += Math.max(0, shakeDt);
      const t = this.shakeT;
      const amp = this.trauma * this.trauma;
      const px = this.shakeMaxPx * amp;
      sp.x = px * wave(t, 57.0, 98.7, 0.4, 2.1);
      sp.y = px * wave(t, 49.3, 87.1, 1.7, 5.2);
      sp.roll = SHAKE_ROLL * amp * wave(t, 36.1, 71.9, 3.3, 0.9);
      this.trauma = Math.max(0, this.trauma - Math.max(0, shakeDt) * TRAUMA_DECAY);
    }
    const ox = this.baseOffset.x + this.pan.x + sp.x * s + this.focus.x * s;
    const oy = this.baseOffset.y + this.pan.y + sp.y * s - this.focus.y * s;
    const target = this.target.copy(this._center).addScaledVector(this._right, ox).addScaledVector(this._up, oy);
    cam.position.copy(target).addScaledVector(this._fwd, -this.dist);
    cam.up.copy(this._up);
    if (sp.roll) cam.up.applyAxisAngle(this._fwd, sp.roll);
    cam.lookAt(target);
    cam.near = 0.1;
    cam.far = this.dist * 2 + 60;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  _clamp() {
    this.zoom = THREE.MathUtils.clamp(this.zoom, 1, MAX_ZOOM);
    const s = this.scale;
    const visX = (this.viewW * s) / 2;
    const visY = (this.viewH * s) / 2;
    const slack = 0.8;
    const ax = Math.max(0, this.extent.x - visX * 0.55) + slack / this.zoom;
    const ay = Math.max(0, this.extent.y - visY * 0.55) + slack / this.zoom;
    this.pan.x = THREE.MathUtils.clamp(this.pan.x, -ax, ax);
    this.pan.y = THREE.MathUtils.clamp(this.pan.y, -ay, ay);
  }

  /**
   * Locks the view on the fitted framing (pan / zoom calls are ignored; a moved view glides
   * back to the fit) or frees it again.
   */
  setLocked(on, animated = true) {
    const next = !!on;
    if (next === this.locked) return;
    this.locked = next;
    if (next && !this.isDefault) this.reset(animated);
  }

  /** Pans by a screen delta in CSS px (drag). Ignored while locked. */
  panBy(dxPx, dyPx) {
    if (this.locked) return;
    this._anim = null;
    const s = this.scale;
    this.pan.x -= dxPx * s;
    this.pan.y += dyPx * s;
  }

  /** Zooms by factor keeping the world point under (px, py) (CSS px in the viewport) fixed. Ignored while locked. */
  zoomAt(factor, px, py) {
    if (this.locked) return;
    this._anim = null;
    const before = this.scale;
    const z0 = this.zoom;
    this.zoom = THREE.MathUtils.clamp(this.zoom * factor, 1, MAX_ZOOM);
    if (this.zoom === z0) return;
    const after = this.scale;
    const cx = px - this.viewW / 2;
    const cy = this.viewH / 2 - py;
    this.pan.x += cx * (before - after);
    this.pan.y += cy * (before - after);
  }

  /** Smoothly returns to the fitted view. */
  reset(animated = true) {
    if (!animated) {
      this.zoom = 1;
      this.pan.set(0, 0);
      this._anim = null;
      return;
    }
    this._anim = { t: 0, dur: 0.35, z0: this.zoom, z1: 1, p0: this.pan.clone(), p1: new THREE.Vector2() };
  }

  /**
   * Adds shake trauma (0..1): the shake is trauma² × shakeMaxPx CSS px and dies away in about
   * 1 / TRAUMA_DECAY s. Stacking hits grow it, never past 1.
   */
  kick(trauma) {
    const t = THREE.MathUtils.clamp(Number(trauma) || 0, 0, 1);
    if (t <= 0) return;
    this.trauma = Math.min(1, Math.max(this.trauma, t) + t * 0.15);
  }

  /** Legacy amount (world units, 0.03–0.25) → trauma (kick). */
  shake(amount) {
    this.kick(Math.min(1, (Number(amount) || 0) / 0.12));
  }

  /** A zoom punch: the view zooms in by `amount` (≤ PUNCH_MAX) and back over `seconds`. */
  punch(amount = 0.06, seconds = 0.34) {
    const amt = THREE.MathUtils.clamp(Number(amount) || 0, 0, PUNCH_MAX);
    const dur = THREE.MathUtils.clamp(Number(seconds) || 0, 0.05, PUNCH_MAX_S);
    if (amt <= 0) return;
    if (this._punch && this._punch.amt >= amt && this._punch.t / this._punch.dur < 0.5) return;
    this._punch = { t: 0, dur, amt };
  }

  /** Is a shake or a zoom punch moving the view? */
  get jolting() {
    return this.trauma > 0 || !!this._punch;
  }

  /**
   * Holds the view where it is (called every frame while a girl is being placed): a running
   * shake and zoom punch stop, and so does a reset glide in free mode. Locked, a glide still lands
   * on the fit — the only place a locked camera may be. A focus slide waits where it is until she
   * is placed.
   */
  holdStill() {
    this.trauma = 0;
    this._punch = null;
    if (!this.locked) this._anim = null;
    this._focusHold = true;
  }

  /**
   * Slides the framing by (x, y) CSS px — x > 0 moves the board left, y > 0 up — gliding there
   * (≈ 0.25 s). Applies locked or free: it is part of the framing, never a drag.
   */
  setFocusShift(x, y) {
    this.focusGoal.set(Math.max(0, x || 0), Math.max(0, y || 0));
  }

  get isDefault() {
    return this.zoom < 1.01 && this.pan.lengthSq() < 0.01;
  }
}
