// Impact frames (docs/VFX.md §M1): on a hero ultimate or a boss kill the picture becomes, for
// IMPACT_FRAMES rendered frames, a stark two-tone anime frame — the board drops away to an ink
// screen layer and every girl, monster, drone and shot turns into a flat silhouette (the toon
// figures swap to one flat impact material, src/models/toon.js impactMaterial), with the effects'
// light still burning on top. Then everything comes back exactly as it was.
//
//   frame 0, 1   ink screen, white silhouettes
//   frame 2      a deep shade of the ult's colour, ink silhouettes
//
// The whole sequence stays dark (no frame is ever bright, never white) and counts as one impact
// in the flash guard (src/render/vfx/flashGuard.js). The caller decides whether it may run at all
// (Reduce Motion, the Hit effects setting, the flash budget) and draws a soft tint otherwise.
//
// Costs nothing between impacts; during one, the board is simply not drawn (fewer draw calls) and
// the two silhouette materials are compiled once, the first time.
import * as THREE from 'three';
import { impactMaterial } from '../../models/toon.js';

/** Rendered frames an impact lasts. */
export const IMPACT_FRAMES = 3;
/** The ink of the screen layer (and the dark silhouettes). */
export const INK = '#0b0a12';
/** The colour frame never gets brighter than this (linear, per channel). */
export const SHADE_MAX = 0.22;

const _c = new THREE.Color();

export class ImpactFrames {
  /**
   * @param {{ scene: THREE.Scene, figures: () => THREE.Object3D[], keep: () => THREE.Object3D[] }} o
   *   figures: roots whose meshes become silhouettes (actors); keep: other scene children that stay
   *   drawn (the additive effect batches). Every other child of the scene is hidden for the frames.
   */
  constructor({ scene, figures, keep }) {
    this.scene = scene;
    this.figures = figures;
    this.keep = keep;
    this.left = 0;
    this.index = 0;
    this.count = 0; // impacts played (stats)
    this.color = new THREE.Color('#ffffff');
    this.fill = impactMaterial('fill');
    this._swapped = []; // [mesh, original material]
    this._hidden = []; // objects hidden for the impact
    this._bg = null;
    this._fog = null;
    this._screen = new THREE.Color(INK); // the screen layer (the scene background while it runs)
    this._on = false;
  }

  get active() {
    return this.left > 0;
  }

  /** Starts an impact in the given colour (the next rendered frame is its first). */
  start(color) {
    this.color.set(color || '#ffffff');
    this.left = IMPACT_FRAMES;
    this.index = 0;
    this.count++;
  }

  /** Before rendering: shows this frame of the impact (no-op when none is running). */
  begin() {
    if (this.left <= 0) return;
    if (!this._on) this._apply();
    const ink = _c.set(INK);
    if (this.index < IMPACT_FRAMES - 1) {
      this._screen.copy(ink);
      this.fill.color.setRGB(1, 1, 1);
    } else {
      // a deep shade of the ult's colour (dark: the frame never flashes bright)
      const c = this.color;
      const m = Math.max(c.r, c.g, c.b, 1e-4);
      const k = SHADE_MAX / m;
      this._screen.setRGB(c.r * k, c.g * k, c.b * k);
      this.fill.color.copy(ink);
    }
  }

  /** After rendering: counts the frame down, and puts everything back after the last one. */
  end() {
    if (this.left <= 0) return;
    this.left--;
    this.index++;
    if (this.left <= 0) this._restore();
  }

  /** Ends a running impact at once (dispose, quality change). */
  cancel() {
    this.left = 0;
    if (this._on) this._restore();
  }

  _apply() {
    this._on = true;
    const scene = this.scene;
    this._bg = scene.background;
    this._fog = scene.fog;
    scene.background = this._screen;
    scene.fog = null;
    const keep = new Set([...this.figures(), ...this.keep()]);
    for (const o of scene.children) {
      if (keep.has(o) || o.isLight || !o.visible) continue;
      o.visible = false;
      this._hidden.push(o);
    }
    for (const root of this.figures()) {
      root.traverse((o) => {
        if (!o.isMesh || !o.visible) return;
        const m = o.material;
        // outlines keep their ink; glows, bubbles, faces painted on top and see-through parts go
        if (o.userData.isOutline || m?.userData?.outline) return;
        if (o.userData.fx || o.name === 'haloGlow' || (m && !Array.isArray(m) && (m.transparent || m.blending !== THREE.NormalBlending))) {
          o.visible = false;
          this._hidden.push(o);
          return;
        }
        this._swapped.push(o, m);
        o.material = this.fill;
      });
    }
  }

  _restore() {
    this._on = false;
    const scene = this.scene;
    scene.background = this._bg;
    scene.fog = this._fog;
    this._bg = null;
    this._fog = null;
    for (const o of this._hidden) o.visible = true;
    this._hidden.length = 0;
    const s = this._swapped;
    for (let i = 0; i < s.length; i += 2) {
      const o = s[i];
      const m = s[i + 1];
      if (o.material === this.fill) o.material = m;
      // a model removed during the impact: its own material was never handed to disposeObject
      if (!attached(o, scene) && m && !m.userData?.shared && !Array.isArray(m)) m.dispose?.();
    }
    s.length = 0;
  }
}

function attached(o, scene) {
  let p = o;
  while (p) {
    if (p === scene) return true;
    p = p.parent;
  }
  return false;
}
