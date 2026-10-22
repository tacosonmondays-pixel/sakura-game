// Impact frames (docs/VFX.md §M1): on a hero ultimate or a boss kill the picture becomes, for
// IMPACT_FRAMES rendered frames, a tinted two-tone anime frame — the board stays where it is, turned
// navy (multiplied by a navy-blue, not an ink blackout: the road and the field stay readable), and
// every girl, monster, companion, drone and shot turns into a flat pink silhouette at about 60 %
// value, drawn over the tint, with the additive effects still burning on top. Then everything comes
// back exactly as it was.
//
//   frame 0   the board × NAVY (TINT[0]), pink silhouettes
//   frame 1   a lighter tint TINT[1], the same silhouettes (it eases back)
//
// The frame is never brighter than the board it covers (a multiply, mid-value silhouettes) and
// counts as one impact in the flash guard (src/render/vfx/flashGuard.js). The
// caller decides whether it may run at all (Reduce Motion, Flashes & shake, the Impact frames
// setting, the flash budget) and draws a soft tint otherwise.
//
// Costs nothing between impacts; during one, a single full-screen quad more and the normal-blend
// effect batches skipped. The silhouette material is compiled once, the first time.
import * as THREE from 'three';
import { impactMaterial } from '../../models/toon.js';

/** Rendered frames an impact lasts. */
export const IMPACT_FRAMES = 2;
/**
 * The tint laid over the board: the board is multiplied by this navy-blue (so every shape, edge and
 * the road stay readable, just in navy), at TINT strength on each frame (1 = the full colour, 0 =
 * none). Its brightest channel stays well above black: the frame dims the board, it never blacks it out.
 */
export const NAVY = '#7f8fd6';
/** Strength of the navy tint on each frame (it eases back on the second). */
export const TINT = [1, 0.5];
/** The silhouettes' colour: sakura pink with a touch of the moment's colour… */
export const PINK = '#ff7aa8';
export const MOMENT_MIX = 0.3;
/** …at this value (the brightest channel, display space): readable on the tint, never a flash. */
export const SILHOUETTE_VALUE = 0.6;
/**
 * Render order of the tint (after every opaque thing and the board's own see-through parts, before
 * the additive ground rings at 3) and of the silhouettes (over the tint).
 */
const TINT_ORDER = 2.5;
const FIGURE_ORDER = 10;

const _c = new THREE.Color();

/** The silhouette colour for a moment colour, in display (sRGB) space: { r, g, b } with max = SILHOUETTE_VALUE. */
export function silhouetteRGB(color) {
  _c.set(PINK).lerp(new THREE.Color(color || PINK), MOMENT_MIX);
  const s = { r: 0, g: 0, b: 0 };
  _c.getRGB(s, THREE.SRGBColorSpace);
  const m = Math.max(s.r, s.g, s.b, 1e-4);
  const k = SILHOUETTE_VALUE / m;
  return { r: s.r * k, g: s.g * k, b: s.b * k };
}

function tintCard() {
  // multiply blend: out = board × mix(white, NAVY, strength)
  const mat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(NAVY) }, opacity: { value: TINT[0] } },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
uniform vec3 color;
uniform float opacity;
void main() {
  gl_FragColor = vec4(mix(vec3(1.0), color, opacity), 1.0);
  #include <colorspace_fragment>
}`,
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstColorFactor,
    blendDst: THREE.ZeroFactor,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  card.name = 'impactTint';
  card.frustumCulled = false;
  card.renderOrder = TINT_ORDER;
  card.matrixAutoUpdate = false;
  return card;
}

export class ImpactFrames {
  /**
   * @param {{ scene: THREE.Scene, figures: () => THREE.Object3D[], hide?: () => THREE.Object3D[] }} o
   *   figures: roots whose meshes become silhouettes (actors, companions); hide: scene children
   *   left out for the frames (the normal-blend effect batches, whose soft shapes would sit oddly on
   *   the tint). Everything else stays drawn under the tint.
   */
  constructor({ scene, figures, hide = () => [] }) {
    this.scene = scene;
    this.figures = figures;
    this.hide = hide;
    this.left = 0;
    this.index = 0;
    this.count = 0; // impacts played (stats)
    this.fill = impactMaterial();
    this.card = tintCard();
    this.silhouette = silhouetteRGB(PINK);
    this._swapped = []; // [mesh, original material, original render order]
    this._hidden = []; // objects hidden for the impact
    this._on = false;
  }

  get active() {
    return this.left > 0;
  }

  /** Starts an impact in the given colour (the next rendered frame is its first). */
  start(color) {
    this.silhouette = silhouetteRGB(color);
    this.left = IMPACT_FRAMES;
    this.index = 0;
    this.count++;
  }

  /** Before rendering: shows this frame of the impact (no-op when none is running). */
  begin() {
    if (this.left <= 0) return;
    if (!this._on) this._apply();
    const s = this.silhouette;
    this.fill.color.setRGB(s.r, s.g, s.b, THREE.SRGBColorSpace);
    this.card.material.uniforms.opacity.value = TINT[Math.min(this.index, TINT.length - 1)];
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
    for (const o of this.hide()) {
      if (!o || !o.visible) continue;
      o.visible = false;
      this._hidden.push(o);
    }
    scene.add(this.card);
    for (const root of this.figures()) {
      root.traverse((o) => {
        if (!o.isMesh || !o.visible) return;
        const m = o.material;
        // outlines keep their ink (tinted with the board: a dark rim round each silhouette); glows,
        // bubbles, faces painted on top and see-through parts go
        if (o.userData.isOutline || m?.userData?.outline) return;
        if (o.userData.fx || o.name === 'haloGlow' || (m && !Array.isArray(m) && (m.transparent || m.blending !== THREE.NormalBlending))) {
          o.visible = false;
          this._hidden.push(o);
          return;
        }
        this._swapped.push(o, m, o.renderOrder);
        o.material = this.fill;
        o.renderOrder = FIGURE_ORDER;
      });
    }
  }

  _restore() {
    this._on = false;
    const scene = this.scene;
    scene.remove(this.card);
    for (const o of this._hidden) o.visible = true;
    this._hidden.length = 0;
    const s = this._swapped;
    for (let i = 0; i < s.length; i += 3) {
      const o = s[i];
      const m = s[i + 1];
      if (o.material === this.fill) o.material = m;
      o.renderOrder = s[i + 2];
      // a model removed during the impact: its own material was never handed to disposeObject
      if (!attached(o, scene) && m && !m.userData?.shared && !Array.isArray(m)) m.dispose?.();
    }
    s.length = 0;
  }

  dispose() {
    this.cancel();
    this.card.geometry.dispose();
    this.card.material.dispose();
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
