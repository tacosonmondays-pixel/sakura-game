// Path looks (docs/specs/path-looks.md): what a girl's model shows of the upgrade paths she takes, display only.
//
//   pips    a small gauge on the ground in front of every girl: five pips per path in its PATH_COLORS colour
//   glows   T1–T2: a soft glow in the path colour at her weapon hand (her leading path) and her other hand (the second)
//   pieces  T3 attachment, T4 escalated, T5 capstone (catalog.js): small GLB props socketed to her bones, so they
//           follow every clip; a hero wears every path she has reached at T3+ at once
//   aura    T5: a ground glow and rising motes in the capstone path's colour
//
// Reads tiers (a hero: her track level through heroLookTiers) and never writes to the sim: the sim id is unchanged.
// Actors owns one PathLooks; each tower view carries its own state in `v.pl`.
import * as THREE from 'three';
import { heroLookTiers } from '../../sim/hero.js';
import { pathLayers, stagePieces, pipAngles } from './rules.js';
import { pathLooksFor, pieceFile } from './catalog.js';
import { findBone } from '../../models/glbChibi.js';
import { loadPieces, getPiece, fileStatus, instancePiece } from './pieces.js';
import { createVisualRandom, visualSeed } from '../vfx/random.js';

export const PATH_COLORS = ['#ff6b8b', '#4cc9f0', '#ffd43b'];
const PATH_RGB = PATH_COLORS.map((h) => new THREE.Color(h));
/** Pip gauge: ring radius, pip length (tangential) and thickness (world units). */
const PIP_R = 0.4;
/** A hero's pips ride her gold ring (her gown is wider than a student's skirt, it would hide them). */
const PIP_R_HERO = 0.48;
const PIP_LEN = 0.078;
const PIP_W = 0.078;
const TAU = Math.PI * 2;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _w = new THREE.Vector3();

export class PathLooks {
  /**
   * @param {{ quality?: string, rand?: () => number }} [o] rand: seeded render-only randomness (src/render/vfx/random.js)
   */
  constructor({ quality = 'high', rand = createVisualRandom(visualSeed('pathLooks')) } = {}) {
    this.quality = quality;
    this.rand = rand;
    this.shadows = false;
    this.overrides = new Map(); // uid -> tiers (staging / previews only: e2e/path-looks.mjs)
    this.enabled = true;
    this.gen = 0; // bumped by setEnabled: every view re-dresses
  }

  setQuality(q) {
    this.quality = q;
  }

  /** Whole layer on / off (perf baselines: off draws nothing and wears nothing, as before path looks). */
  setEnabled(on) {
    this.enabled = !!on;
    this.gen = (this.gen || 0) + 1;
  }

  /** Staging hook (render only): draw this girl as if her tiers were `tiers` (null: her real tiers). */
  setOverride(uid, tiers) {
    if (tiers) this.overrides.set(uid, [...tiers]);
    else this.overrides.delete(uid);
  }

  _tiers(t) {
    const o = this.overrides.get(t.uid);
    if (o) return o;
    return t.isHero ? heroLookTiers(t.def, t.level || 1) : t.tiers || [0, 0, 0];
  }

  _state(v) {
    return v.pl || (v.pl = { tkey: null, layers: null, root: null, key: null, holders: [], anims: [], hands: null });
  }

  /** Once per frame per girl, after her model has animated: layers, pieces, piece animation. */
  update(v, t, time) {
    const st = this._state(v);
    const tiers = this._tiers(t);
    const tkey = `${tiers[0]}${tiers[1]}${tiers[2]}${t.isHero ? 'h' : ''}`;
    if (tkey !== st.tkey) {
      st.tkey = tkey;
      st.layers = pathLayers(tiers, { multi: !!t.isHero });
      st.key = null;
    }
    const ud = v.model.userData;
    const root = ud.glb && !ud.duo ? ud.glbRoot || null : null;
    if (root !== st.root) {
      // the GLB arrived (the placeholder's children were replaced) or the model was rebuilt: re-socket everything
      st.root = root;
      st.holders = [];
      st.anims = [];
      st.hands = null;
      st.key = null;
    }
    if (st.gen !== this.gen) {
      st.gen = this.gen;
      st.key = null;
    }
    if (st.key !== st.layers.key) this._build(v, t, st);
    for (const a of st.anims) {
      const an = a.anim;
      if (an.spin) a.node.rotation.y = time * an.spin + a.phase;
      if (an.spinZ) a.node.rotation.z = time * an.spinZ + a.phase;
      if (an.bob) a.node.position.y = an.bob[0] * Math.sin(time * an.bob[1] * TAU + a.phase);
    }
  }

  _build(v, t, st) {
    for (const h of st.holders) h.removeFromParent();
    st.holders = [];
    st.anims = [];
    st.key = st.layers.key;
    const unitId = t.unitId || t.def?.id;
    const row = pathLooksFor(unitId);
    const ud = v.model.userData;
    if (!row || !st.root || !ud.restBone || !this.enabled) return;
    for (const { path, tier } of st.layers.pieces) {
      const list = stagePieces(row.paths[path], tier);
      if (!list) continue;
      const file = pieceFile(unitId, path);
      const status = fileStatus(file);
      if (status === 'failed') continue;
      if (status !== 'ready') {
        loadPieces(file).then((ok) => {
          if (ok) st.key = null; // rebuild on the next frame
        });
        continue;
      }
      for (const entry of list) this._attach(v, st, entry, getPiece(file, entry.piece));
    }
  }

  _attach(v, st, entry, piece) {
    const bone = findBone(st.root, entry.bone);
    const rest = v.model.userData.restBone(entry.bone);
    if (!piece || !bone || !rest) return;
    // the pivot sits at the bone's rest position + `at` in figure axes; the holder undoes the bone's rest frame so the
    // piece keeps the figure's axes and units at rest, then rides every clip with the bone
    _p.setFromMatrixPosition(rest).add(_w.fromArray(entry.at));
    _q.setFromEuler(_e.set(entry.rot[0], entry.rot[1], entry.rot[2]));
    _s.setScalar(entry.scale || 1);
    _m.compose(_p, _q, _s);
    const holder = new THREE.Group();
    holder.name = `pathLookSocket:${entry.piece}`;
    holder.matrixAutoUpdate = false;
    holder.matrix.copy(rest).invert().multiply(_m);
    const inner = new THREE.Group();
    const inst = instancePiece(piece, { quality: this.quality, shadows: this.shadows });
    inner.add(inst);
    holder.add(inner);
    holder.userData.meshes = inst.userData.meshes;
    holder.userData.triangles = inst.userData.triangles;
    bone.add(holder);
    st.holders.push(holder);
    if (entry.anim) st.anims.push({ node: inner, anim: entry.anim, phase: (v.uid * 1.618) % TAU });
  }

  /** Hand bones of a GLB girl ({ weapon, off }) or null. */
  _hands(v, t, st) {
    if (st.hands !== null) return st.hands || null;
    const row = pathLooksFor(t.unitId || t.def?.id);
    const wName = row?.weaponHand || 'hand_R';
    const oName = wName === 'hand_R' ? 'hand_L' : 'hand_R';
    const w = findBone(st.root, wName);
    const o = findBone(st.root, oName);
    st.hands = w && o ? { weapon: w, off: o } : false;
    return st.hands || null;
  }

  /**
   * Ground and billboard layers of one girl (drawn by Actors.drawGround).
   * @param {object} o { tw (sim tower), v (view), y (ground y), gN, gA, bbA, R, time, cameraYaw, fx }
   */
  draw({ tw, v, y, gN, gA, bbA, R, time, cameraYaw, fx }) {
    const st = this._state(v);
    if (!st.layers || !this.enabled) return;
    const L = st.layers;
    const s = v.scale || 1;
    // ---- pips: the side facing the camera, path 0 on the left; filled pips bright, the rest dark sockets ----
    const ang = pipAngles(cameraYaw);
    const r = tw.isHero ? PIP_R_HERO : PIP_R;
    for (let p = 0; p < 3; p++) {
      const tier = L.tiers[p];
      const c = PATH_RGB[p];
      for (let k = 0; k < 5; k++) {
        const a = ang[p][k];
        const px = tw.x + Math.cos(a) * r;
        const pz = tw.y + Math.sin(a) * r;
        const rot = Math.atan2(-Math.cos(a), -Math.sin(a));
        const on = k < tier;
        gN.push(px, y + 0.006, pz, PIP_LEN * 1.32, PIP_W * 1.5, R.dot, 0.07, 0.06, 0.14, on ? 0.7 : 0.42, rot);
        if (on) {
          gN.push(px, y + 0.007, pz, PIP_LEN, PIP_W, R.dot, c.r, c.g, c.b, 1, rot);
          gA.push(px, y + 0.008, pz, PIP_LEN * 1.6, PIP_W * 2.4, R.glow, c.r, c.g, c.b, 0.35, rot);
        } else {
          gN.push(px, y + 0.007, pz, PIP_LEN * 0.55, PIP_W * 0.55, R.dot, c.r * 0.55, c.g * 0.55, c.b * 0.55, 0.55, rot);
        }
      }
    }
    // ---- T1–T2 glows at the hands ----
    if (L.glows.length) {
      const hands = st.root ? this._hands(v, tw, st) : null;
      for (const g of L.glows) {
        const c = PATH_RGB[g.path];
        let hx;
        let hy;
        let hz;
        if (hands) {
          (g.hand === 'weapon' ? hands.weapon : hands.off).getWorldPosition(_w);
          hx = _w.x;
          hy = _w.y;
          hz = _w.z;
        } else {
          const side = g.hand === 'weapon' ? -1 : 1;
          hx = tw.x + Math.cos(v.facing) * 0.16 * side * s;
          hy = y + 0.36 * s;
          hz = tw.y - Math.sin(v.facing) * 0.16 * side * s;
        }
        const pulse = 0.5 + 0.5 * Math.sin(time * 3 + g.path * 2 + tw.uid);
        const size = (g.tier >= 2 ? 0.24 : 0.17) * s;
        bbA.push(hx, hy, hz, size, size, R.glow, c.r, c.g, c.b, (g.tier >= 2 ? 0.55 : 0.38) + 0.15 * pulse);
        if (g.tier >= 2) bbA.push(hx, hy, hz, size * 0.42, size * 0.42, R.spark, 1, 1, 1, 0.35 + 0.3 * pulse, time * 2 + tw.uid);
      }
    }
    // ---- T4 sparkles and the T5 aura ----
    for (const pc of L.pieces) {
      if (pc.tier !== 4) continue;
      if (this.rand() < 0.04) {
        const c = PATH_COLORS[pc.path];
        fx?.spawn({ batch: 'bbA', uv: R.star, x: tw.x + (this.rand() - 0.5) * 0.5 * s, y: y + (0.5 + this.rand() * 0.5) * s, z: tw.y + (this.rand() - 0.5) * 0.4 * s, vy: 0.35, s0: 0.09, s1: 0.01, life: 0.8, color: c });
      }
    }
    if (L.aura.length) {
      const n = L.aura.length;
      // a hero with several capstones: the aura's colour walks through them
      const idx = n > 1 ? Math.floor(time / 1.6) % n : 0;
      const p = L.aura[idx];
      const c = PATH_RGB[p];
      const d = 0.8 * s;
      gA.push(tw.x, y + 0.003, tw.y, d, d, R.glow, c.r, c.g, c.b, 0.18 + 0.05 * Math.sin(time * 2 + tw.uid));
      const ph = (time * 0.55 + tw.uid * 0.37) % 1;
      gA.push(tw.x, y + 0.005, tw.y, d * (0.55 + 0.6 * ph), d * (0.55 + 0.6 * ph), R.ringSoft, c.r, c.g, c.b, 0.38 * (1 - ph));
      if (this.rand() < 0.12) {
        const a = this.rand() * TAU;
        const rr = (0.12 + this.rand() * 0.22) * s;
        fx?.spawn({ batch: 'bbA', uv: this.rand() < 0.5 ? R.star : R.glow, x: tw.x + Math.cos(a) * rr, y: y + 0.08, z: tw.y + Math.sin(a) * rr, vy: 0.55 + this.rand() * 0.3, s0: 0.1, s1: 0.02, life: 1.1, color: PATH_COLORS[p] });
      }
    }
  }

  /** Debug / e2e: what one girl wears now. */
  probe(v) {
    const st = v?.pl;
    if (!st) return null;
    let meshes = 0;
    let triangles = 0;
    for (const h of st.holders) {
      meshes += h.userData.meshes || 0;
      triangles += h.userData.triangles || 0;
    }
    return {
      tiers: st.layers?.tiers || null, pieces: st.holders.map((h) => h.name.split(':')[1]), glows: st.layers?.glows.map((g) => `${g.path}:${g.hand}`) || [],
      aura: st.layers?.aura || [], meshes, triangles, glb: !!st.root,
    };
  }
}
