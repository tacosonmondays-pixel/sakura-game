// Angled orthographic battle camera: frames the map with margins (respecting HUD insets),
// supports pan / zoom around a screen point / reset, clamps so the board never leaves the
// screen, auto-rotates 90° in portrait so the long side of the map runs down the screen,
// and adds a small decaying shake for impacts.
import * as THREE from 'three';

const PITCH = THREE.MathUtils.degToRad(48);
const MAX_ZOOM = 3.2;

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
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._center = new THREE.Vector3(this.mapW / 2, 0, this.mapH / 2);
    this._anim = null;
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

  apply(dt = 0) {
    if (this._anim) {
      const a = this._anim;
      a.t = Math.min(1, a.t + dt / a.dur);
      const k = 1 - (1 - a.t) ** 3;
      this.zoom = a.z0 + (a.z1 - a.z0) * k;
      this.pan.set(a.p0.x + (a.p1.x - a.p0.x) * k, a.p0.y + (a.p1.y - a.p0.y) * k);
      if (a.t >= 1) this._anim = null;
    }
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
    const ox = this.baseOffset.x + this.pan.x + sx;
    const oy = this.baseOffset.y + this.pan.y + sy;
    const target = this._center.clone().addScaledVector(this._right, ox).addScaledVector(this._up, oy);
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

  /** Pans by a screen delta in CSS px (drag). */
  panBy(dxPx, dyPx) {
    this._anim = null;
    const s = this.scale;
    this.pan.x -= dxPx * s;
    this.pan.y += dyPx * s;
  }

  /** Zooms by factor keeping the world point under (px, py) (CSS px in the viewport) fixed. */
  zoomAt(factor, px, py) {
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

  get isDefault() {
    return this.zoom < 1.01 && this.pan.lengthSq() < 0.01;
  }
}
