// Angled orthographic battle camera: frames the map with margins (respecting HUD insets),
// supports pan / zoom around a screen point / reset, clamps so the board never leaves the
// screen, auto-rotates 90° in portrait so the long side of the map runs down the screen,
// and adds a small decaying shake for impacts. Locked (setLocked, the default camera setting —
// src/render/cameraPolicy.js) it holds the fitted view: pan / zoom calls do nothing. A focus
// shift (setFocusShift) slides the framing itself, locked or not, so a selected girl's ring
// clears the info panel; it glides there and back and holds still while a girl is placed.
import * as THREE from 'three';

const PITCH = THREE.MathUtils.degToRad(48);
const MAX_ZOOM = 3.2;

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
    this.shakeAmt = 0;
    this.shakeT = 0;
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

  /**
   * @param {number} dt game-frame seconds (glides, shake)
   * @param {number} [focusDt] real seconds for the focus slide (it also runs while paused)
   */
  apply(dt = 0, focusDt = dt) {
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
    const hw = (this.viewW * s) / 2;
    const hh = (this.viewH * s) / 2;
    const cam = this.camera;
    cam.left = -hw;
    cam.right = hw;
    cam.top = hh;
    cam.bottom = -hh;
    let sx = 0;
    let sy = 0;
    if (this.shakeAmt > 0.001) {
      this.shakeT += dt;
      sx = Math.sin(this.shakeT * 61) * this.shakeAmt;
      sy = Math.cos(this.shakeT * 47) * this.shakeAmt;
      this.shakeAmt *= Math.exp(-dt * 7);
    }
    const ox = this.baseOffset.x + this.pan.x + sx + this.focus.x * s;
    const oy = this.baseOffset.y + this.pan.y + sy - this.focus.y * s;
    const target = this.target.copy(this._center).addScaledVector(this._right, ox).addScaledVector(this._up, oy);
    cam.position.copy(target).addScaledVector(this._fwd, -this.dist);
    cam.up.copy(this._up);
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

  shake(amount) {
    this.shakeAmt = Math.min(0.25, Math.max(this.shakeAmt, amount));
  }

  /**
   * Holds the view where it is (called every frame while a girl is being placed): a running
   * shake stops, and so does a reset glide in free mode. Locked, a glide still lands on the fit
   * — the only place a locked camera may be. A focus slide waits where it is until she is placed.
   */
  holdStill() {
    this.shakeAmt = 0;
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
