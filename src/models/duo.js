// A duo unit's battle figure (docs/specs/DUO_LR.md §1.6): both girls on one round base, side by side, each at
// DUO_SCALE so the pair fits the footprint. Each member is her own game-ready Meshy figure
// (public/models/characters/<member>.glb + .lod.glb, built through the GLB runtime like any girl's:
// src/models/glbChibi.js). Until her GLB is loaded, and for good when it fails to load (or in node tests, with no
// WebGL), she is a procedural stand-in (models/chibi.js) in her drawn colours and look (DUO_MEMBERS).
//
// Layout (tools/art/src/meshy-oct20/DUO_READY.md §2.3, DUO_LAYOUT): Tsubaki on the left, Kohaku on the right, each
// turned 12° outward, so Kohaku's prism emitter (beside her left shoulder) sits on the outside and Tsubaki's mortar
// behind, between them; both faces stay clear from the 48° battle camera. The battle keeps the pair's faces to the
// camera (src/render/facing.js) and the pair keeps standing side by side across the screen (see animate).
//
// userData follows buildChibi's contract (animate, playAttack, setHighlight, setExpression, dispose, height),
// forwarded to both members. playAttack(kind) picks who moves: the beam is Kohaku's (`attack_beam`), every other
// attack (the mortar shells) is Tsubaki's (`attack_mortar`); with no kind (the girl page's Attack button) both
// move. playCheer() is the Prismfall cast (both cheer); victory cheers through the 'victory' state and the battle's
// disabled state plays both girls' `hurt`. `anchors` gives the FX the world positions of Kohaku's lens and
// Tsubaki's muzzle (see buildDuo).
import * as THREE from 'three';
import { liftChin } from './chibi.js';
import { UNIT_MAP } from '../data/units.js';

/** Each member's size on the shared base. */
export const DUO_SCALE = 0.85;
/** How far each member stands from the base's centre (model units, before the tower scale; DUO_READY §2.3). */
export const DUO_SPREAD = 0.28;
/** How far each member is turned outward (rad; DUO_READY §2.3: 12°). */
export const DUO_TURN_OUT = (12 * Math.PI) / 180;

/**
 * Where each member stands on the base (DUO_READY §2.3): x across the base (− left, + right), z toward the
 * camera, yaw her own turn (+ turns her front toward +x).
 */
export const DUO_LAYOUT = Object.freeze({
  tsubaki: Object.freeze({ x: -DUO_SPREAD, z: -0.02, yaw: -DUO_TURN_OUT }),
  kohaku: Object.freeze({ x: DUO_SPREAD, z: 0.02, yaw: DUO_TURN_OUT }),
});

/** A member's spot: her DUO_LAYOUT row, else the first listed on the left and the next on the right. */
export function memberSpot(id, i) {
  if (DUO_LAYOUT[id]) return DUO_LAYOUT[id];
  const side = i === 0 ? -1 : 1;
  return { x: side * DUO_SPREAD, z: 0, yaw: side * DUO_TURN_OUT };
}

/**
 * The members' own palettes and looks, as drawn (public/art/portraits/kohaku_tsubaki-*): their procedural stand-ins
 * (the fallback, see buildDuo) wear these. Students in academy uniforms: Kohaku's lilac council blazer with a
 * short white cape, a plaid skirt, a gold headband and monocle and her prism staff; Tsubaki's navy cadet cap and
 * uniform over a grey vest, binoculars on a strap and her star launcher. `anchor`: the FX anchor her GLB carries
 * (asset.extras.anchors) and its name on the duo's userData.anchors.
 */
export const DUO_MEMBERS = Object.freeze({
  kohaku: Object.freeze({
    name: 'Kohaku', role: 'beam', anchor: Object.freeze({ key: 'beam', as: 'lens' }),
    palette: Object.freeze({
      hair: '#c9aef2', hairShade: '#9c80d2', eyes: '#8c5fd0', skin: '#fde6d8',
      outfit: '#b89de4', outfitShade: '#9479c8', accent: '#6c3fa8', halo: '#ffe1a6', weapon: '#dccbff',
    }),
    look: Object.freeze({ hairStyle: 'long', bangs: 'straight', accessory: 'councilBand', outfit: 'council', weapon: 'staff', halo: 'star', eyeStyle: 'sparkle', expression: 'smile' }),
  }),
  tsubaki: Object.freeze({
    name: 'Tsubaki', role: 'shells', anchor: Object.freeze({ key: 'muzzle', as: 'muzzle' }),
    palette: Object.freeze({
      hair: '#262c5e', hairShade: '#171b3e', eyes: '#e2a838', skin: '#fbe2d4',
      outfit: '#283464', outfitShade: '#1d2649', accent: '#dcae4a', halo: '#ffe3a1', weapon: '#2c3a70',
    }),
    look: Object.freeze({ hairStyle: 'long', bangs: 'swept', accessory: 'cadetCap', outfit: 'cadet', weapon: 'cannon', halo: 'star', eyeStyle: 'sharp', expression: 'determined' }),
  }),
});

/**
 * Chin-up (rad) on each procedural stand-in member's head (chibi.js liftChin): the battle camera looks down at 48°
 * and their bangs and Tsubaki's cap brim would hide their eyes. (The GLBs carry their own chin-up in every clip.)
 */
export const DUO_CHIN_UP = 0.3;

/** How long (s) the Prismfall cheer plays (the GLBs' `cheer` clip is 1.2 s). */
export const DUO_CHEER_TIME = 1.2;
/** A member's attack clip restarts at most this often (s; her clips are 0.6 s): a fast beam does not stutter. */
export const DUO_ATTACK_GAP = 0.7;

/** The pseudo-def a member is built from: her id (her model asset), her palette and look, the duo's kind. */
export function memberDef(unitDef, id) {
  const m = DUO_MEMBERS[id];
  return { ...unitDef, id, name: m?.name || id, duo: undefined, palette: m?.palette || unitDef.palette, look: m?.look || unitDef.look };
}

/** The member model assets of a duo asset key or unit id ('kohaku_tsubaki' -> ['kohaku', 'tsubaki']), else null. */
export function duoMemberAssets(key) {
  const m = UNIT_MAP[key]?.duo?.members;
  return m?.length ? [...m] : null;
}

/**
 * Model asset keys to fetch for a unit: a duo's two member files (there is no `<duo>.glb`), else the unit itself.
 */
export function modelIds(unitDef) {
  return unitDef?.duo?.members?.length ? [...unitDef.duo.members] : [unitDef.id];
}

const _m = new THREE.Matrix4();

/**
 * A member's FX anchor (asset.extras.anchors[key]: { bone, pos, dir } in the GLB's stored position space, bind
 * pose) as a live world-space reader: pos goes into the bone's space once (its inverse bind matrix; the GLTFLoader
 * binds with an identity bind matrix), then follows the bone as the clips move it. Null when the member is not
 * her GLB or carries no such anchor.
 */
function glbAnchor(fig, key) {
  const a = fig.userData.anchorDefs?.[key];
  if (!a?.bone || a.pos?.length !== 3) return null;
  let mesh = null;
  fig.traverse((o) => {
    if (!mesh && o.isSkinnedMesh && !o.userData.isOutline) mesh = o;
  });
  const bones = mesh?.skeleton?.bones || [];
  const j = bones.findIndex((b) => b.name === a.bone);
  if (j < 0) return null;
  const bone = bones[j];
  const inv = mesh.skeleton.boneInverses[j];
  const local = new THREE.Vector3(...a.pos).applyMatrix4(inv);
  const localDir = a.dir?.length === 3 ? new THREE.Vector3(...a.dir).transformDirection(inv) : null;
  const pos = new THREE.Vector3();
  const dir = new THREE.Vector3();
  return {
    pos() {
      bone.updateWorldMatrix(true, false);
      return pos.copy(local).applyMatrix4(bone.matrixWorld);
    },
    dir() {
      if (!localDir) return null;
      bone.updateWorldMatrix(true, false);
      return dir.copy(localDir).transformDirection(bone.matrixWorld);
    },
  };
}

/** The stand-in's guess at an anchor (her figure's own space), for a member that is not her GLB. */
const STANDIN_ANCHOR = { beam: [0.16, 0.58, 0.12], muzzle: [0.16, 0.95, 0] };

/**
 * Builds the duo figure. `build(def, opts, onUpgrade)` builds one member (models/index.js: her GLB when loaded,
 * else a procedural placeholder upgraded in place when it arrives; it calls `onUpgrade()` then). A member that is
 * not a GLB gets the stand-in chin-up.
 * @returns {THREE.Group}
 */
export function buildDuo(unitDef, opts, build) {
  const group = new THREE.Group();
  group.name = `duo:${unitDef.id}`;
  const ids = unitDef.duo.members;
  const spots = ids.map((id, i) => memberSpot(id, i));
  const anchors = new Map(); // fig -> glbAnchor | null (rebuilt after an upgrade)
  // The battle turns the whole figure toward her target (group.rotation.y): the pair keeps standing side by side
  // across the screen (their spots counter-turn, see animate), and each of them turns with the group.
  let lastTurn = null;
  let time = 0;
  let cheerUntil = -1;
  const lastAttack = new Map();
  const figs = ids.map((id, i) => {
    const fig = build(memberDef(unitDef, id), opts, () => {
      anchors.delete(fig);
      lastTurn = null;
    });
    if (!fig.userData.glb) liftChin(fig, DUO_CHIN_UP);
    fig.scale.setScalar(DUO_SCALE);
    fig.position.set(spots[i].x, 0, spots[i].z);
    fig.rotation.y = spots[i].yaw;
    group.add(fig);
    return fig;
  });
  const role = (id) => DUO_MEMBERS[id]?.role || null;
  const beamer = figs[Math.max(0, ids.findIndex((id) => role(id) === 'beam'))];
  const shooter = figs[Math.max(0, ids.findIndex((id) => role(id) !== 'beam'))];
  const ud = group.userData;
  ud.unitId = unitDef.id;
  ud.kind = 'chibi';
  ud.duo = true;
  ud.memberIds = [...ids];
  // (her tallest member's own height, live: a placeholder's until her GLB arrives. The bar and ring above a figure
  // follow it like a single girl's)
  Object.defineProperty(ud, 'height', {
    enumerable: true,
    configurable: true,
    get: () => Math.max(...figs.map((f) => f.userData.height || 0.9)),
  });
  ud.animate = (t, dt, state) => {
    time = t;
    const r = group.rotation.y;
    if (r !== lastTurn) {
      lastTurn = r;
      const c = Math.cos(r);
      const sn = Math.sin(r);
      figs.forEach((f, i) => {
        const { x, z } = spots[i];
        f.position.x = x * c - z * sn;
        f.position.z = x * sn + z * c;
      });
    }
    // the Prismfall cheer for a moment (a hurt or a victory wins: they are states of their own)
    const s = t < cheerUntil && (!state || state === 'idle' || state === 'attack') ? 'cheer' : state;
    for (const f of figs) f.userData.animate?.(t, dt, s);
  };
  const attack = (f) => {
    const last = lastAttack.get(f);
    if (last != null && time - last >= 0 && time - last < DUO_ATTACK_GAP) return;
    lastAttack.set(f, time);
    f.userData.playAttack?.();
  };
  ud.playAttack = (kind) => {
    if (kind == null) {
      for (const f of figs) attack(f);
      return;
    }
    attack(kind === 'beam' ? beamer : shooter);
  };
  /** Both girls cheer (the Prismfall cast). */
  ud.playCheer = (seconds = DUO_CHEER_TIME) => {
    cheerUntil = time + seconds;
  };
  ud.playClip = (name) => {
    if (name === 'cheer') ud.playCheer();
    else for (const f of figs) f.userData.playClip?.(name);
  };
  ud.setHighlight = (on) => {
    for (const f of figs) f.userData.setHighlight?.(on);
  };
  ud.setExpression = (name) => {
    for (const f of figs) f.userData.setExpression?.(name);
  };
  ud.dispose = () => {
    ud.disposed = true;
    for (const f of figs) f.userData.dispose?.();
  };
  // (both members on their GLB / both procedural stand-ins for good: either way the figure is final)
  ud.isGlb = () => figs.every((f) => !!f.userData.glb);
  ud.isStandIn = () => figs.every((f) => !!f.userData.standIn);
  // FX anchors, world space (read-only vectors, reused per call): Kohaku's prism lens (`lens`, on her chest) and
  // Tsubaki's mortar muzzle (`muzzle`, on her head), following the clips. ud.anchorDir(name) is the matching
  // world direction (the lens's front, the tube's open end), null for a stand-in.
  const anchorOf = (as) => {
    const i = ids.findIndex((id) => DUO_MEMBERS[id]?.anchor?.as === as);
    if (i < 0) return null;
    const f = figs[i];
    const key = DUO_MEMBERS[ids[i]].anchor.key;
    if (!anchors.has(f)) anchors.set(f, f.userData.glb ? glbAnchor(f, key) : null);
    return { f, key, a: anchors.get(f) };
  };
  const fallback = new THREE.Vector3();
  const anchorPos = (as) => {
    const r = anchorOf(as);
    if (!r) return null;
    if (r.a) return r.a.pos();
    const p = STANDIN_ANCHOR[r.key];
    const h = r.f.userData.height || 0.9;
    r.f.updateWorldMatrix(true, false);
    return r.f.localToWorld(fallback.set(p[0], p[1] * h, p[2]));
  };
  ud.anchors = Object.freeze({
    get lens() { return anchorPos('lens'); },
    get muzzle() { return anchorPos('muzzle'); },
  });
  ud.anchorDir = (as) => anchorOf(as)?.a?.dir() || null;
  return group;
}
