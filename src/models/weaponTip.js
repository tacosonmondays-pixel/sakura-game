// Weapon-tip anchors (docs/specs/weapon-muzzles.md): where an armed girl's shots, beams and chains leave her prop,
// following her clips (idle, attack, cheer). Display only: the sim never reads this.
//
// Every armed figure listed in WEAPON_TIPS gets `userData.anchors.muzzle` (a world-space point, read-only, reused per
// call) and `userData.anchorDir('muzzle')` (the matching world direction: down the barrel, along the staff, out of the
// bow), the way the duo exposes Tsubaki's muzzle (src/models/duo.js). The tip is found once per GLB file (full and
// LOD each) from the mesh bounds of the prop part:
//   * a Blender chibi or a re-rigged Tripo figure carries her prop fused into the body mesh, rigidly weighted to one
//     hand bone: the prop is the vertices bound (≥ 98 %) to that bone, minus the hand itself (within `hand` of the
//     bone's rest position, a share of her height);
//   * a separate prop mesh (Hana's bow) or a socketed prop (Tenka's coilgun) is the prop;
//   * Hana's bow carries its own `bow_nock` bone: the arrow sits there.
// Then `pick` says which point of the prop is the tip: 'far' the head of the prop along the hand → farthest-vertex
// axis (a staff's orb, a trident's prongs, a spear's point, a wand's tip, a mic's grille); 'up' its top (a staff held
// planted, its foot as far from the hand as its head); 'fwd' the far end along the figure's forward (+z: a barrel's
// muzzle, a spout); 'center' the middle of the prop (a bow's grip, a sign's
// face, a mirror, a tablet). The tip is stored in the bone's own space (or the prop mesh's), so it follows every clip.
// A figure not listed (unarmed girls, throwers, melee: they keep their hand point), a procedural / stand-in chibi and
// a file whose prop cannot be found get no anchor: attackFx falls back to the old hand point.
import * as THREE from 'three';

/**
 * The armed figures, by model asset (src/data/skins.js `asset`: a girl's own file, her Sentinel / Future outfit).
 *   bone   the hand bone the prop is bound to ('bone' pick: the bone itself)
 *   pick   'far' | 'up' | 'fwd' | 'center' | 'bone' (see above)
 *   kind   how the tip reads: 'gun' and 'bow' flash along the weapon, 'staff' glows at the head
 *   head   (far / fwd) the share of her height at the prop's far end averaged into the tip (default 0.05)
 *   hand   the hand's radius (share of her height) cut out of the prop (default 0.12)
 *   axis   (a separate prop) the barrel's axis in the prop's own space, instead of her forward
 *   prop   a separate prop: 'mesh:<name>' (a mesh of the file) or 'socket:<name>' (a socketed prop GLB)
 */
export const WEAPON_TIPS = Object.freeze({
  // bows (the arrow leaves the grip)
  aoi: { bone: 'hand_L', pick: 'center', kind: 'bow' },
  'sentinel-aoi': { bone: 'hand_L', pick: 'center', kind: 'bow' },
  hana: { bone: 'bow_nock', pick: 'bone', kind: 'bow' },
  // staves, wands, a trident, a spear, a mic: the head
  yuki: { bone: 'hand_R', pick: 'far', kind: 'staff' },
  'sentinel-yuki': { bone: 'hand_R', pick: 'far', kind: 'staff' },
  akane: { bone: 'hand_R', pick: 'far', kind: 'staff' },
  raika: { bone: 'hand_R', pick: 'far', kind: 'staff' },
  'sentinel-raika': { bone: 'hand_R', pick: 'far', kind: 'staff' },
  umeko: { bone: 'hand_R', pick: 'far', kind: 'staff' },
  // (the re-rigged heroes hold their staff / trident planted, its foot near the ground: the head is its top)
  luna: { bone: 'hand_R', pick: 'up', kind: 'staff' },
  nami: { bone: 'hand_L', pick: 'up', kind: 'staff' },
  'future-mizuha': { bone: 'hand_R', pick: 'far', kind: 'staff' },
  seiran: { bone: 'hand_R', pick: 'far', kind: 'staff' },
  miko: { bone: 'hand_R', pick: 'far', kind: 'staff' },
  'sentinel-miko': { bone: 'hand_R', pick: 'far', kind: 'staff' },
  momo: { bone: 'hand_R', pick: 'far', kind: 'staff', hand: 0.1 },
  // guns: the muzzle
  sango: { bone: 'hand_R', pick: 'fwd', kind: 'gun' },
  'sentinel-sango': { bone: 'hand_R', pick: 'fwd', kind: 'gun' },
  shiro: { bone: 'hand_R', pick: 'fwd', kind: 'gun' },
  'sentinel-shiro': { bone: 'hand_R', pick: 'fwd', kind: 'gun' },
  // (the coilgun's own frame: its barrel runs down -x, tenka-coilgun.glb asset.extras.frame)
  tenka: { bone: 'hand_R', pick: 'fwd', kind: 'gun', prop: 'socket:prop_coilgun', axis: [-1, 0, 0] },
  // a spout, a sign, a mirror, a tablet
  chigusa: { bone: 'hand_R', pick: 'fwd', kind: 'staff', hand: 0.1 },
  norika: { bone: 'hand_R', pick: 'center', kind: 'staff' },
  iroha: { bone: 'hand_R', pick: 'center', kind: 'staff', hand: 0.1 },
  yuzuha: { bone: 'hand_L', pick: 'center', kind: 'staff', hand: 0.1 },
});

/** The tip rule of a model asset, else null (unarmed: the hand point stays). */
export function tipRule(assetId) {
  return (assetId && WEAPON_TIPS[assetId]) || null;
}

/** Fewest prop vertices that count as a prop (fewer: no anchor, the hand point stays). */
export const MIN_PROP_VERTS = 12;

/**
 * The tip of a prop from its points (pure: the GLB runtime and the tests share it). Everything is in one space (the
 * figure's rest pose, +y up, +z forward).
 * @param {number[][]} pts prop points [x, y, z]
 * @param {number[]} grip the hand bone's rest position
 * @param {{pick: string, head?: number}} rule
 * @param {number} height her height in this space
 * @returns {{pos: number[], dir: number[], min: number[], max: number[], n: number} | null}
 */
export function pickTip(pts, grip, rule, height) {
  if (!pts || pts.length < MIN_PROP_VERTS) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let c = 0; c < 3; c++) {
    if (p[c] < min[c]) min[c] = p[c];
    if (p[c] > max[c]) max[c] = p[c];
  }
  const mid = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  if (rule.pick === 'center') return { pos: mid, dir: [0, 0, 1], min, max, n: pts.length };
  // the prop's axis: from the grip to its farthest point (far), or the figure's forward (fwd)
  let axis;
  if (rule.axis) axis = rule.axis;
  else if (rule.pick === 'fwd') axis = [0, 0, 1];
  else if (rule.pick === 'up') axis = [0, 1, 0];
  else {
    let far = -1;
    axis = [0, 1, 0];
    for (const p of pts) {
      const d = Math.hypot(p[0] - grip[0], p[1] - grip[1], p[2] - grip[2]);
      if (d > far) {
        far = d;
        axis = [(p[0] - grip[0]) / d, (p[1] - grip[1]) / d, (p[2] - grip[2]) / d];
      }
    }
  }
  const proj = (p) => (p[0] - grip[0]) * axis[0] + (p[1] - grip[1]) * axis[1] + (p[2] - grip[2]) * axis[2];
  let top = -Infinity;
  for (const p of pts) top = Math.max(top, proj(p));
  const cut = top - (rule.head ?? 0.05) * height;
  const pos = [0, 0, 0];
  let n = 0;
  for (const p of pts) {
    if (proj(p) < cut) continue;
    pos[0] += p[0];
    pos[1] += p[1];
    pos[2] += p[2];
    n++;
  }
  pos[0] /= n;
  pos[1] /= n;
  pos[2] /= n;
  // the direction the shot leaves along: from the prop's middle out through the tip (a gun: its barrel)
  const d = [pos[0] - mid[0], pos[1] - mid[1], pos[2] - mid[2]];
  const l = Math.hypot(d[0], d[1], d[2]);
  const dir = rule.pick === 'fwd' || rule.axis || l < 1e-6 ? axis : [d[0] / l, d[1] / l, d[2] / l];
  return { pos, dir, min, max, n: pts.length };
}

/**
 * Prop points of a skinned body (pure; accessors so the tests can feed a GLB they parsed): the vertices bound at
 * least 98 % to bone `k`, outside the hand radius around `grip`.
 * @param {number} count vertex count
 * @param {(i: number, out: number[]) => number[]} pos rest position of vertex i (the same space as grip)
 * @param {(i: number, k: number) => number} weight vertex i's weight on bone k
 */
export function propPoints(count, pos, weight, k, grip, handR) {
  const out = [];
  const tmp = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    if (weight(i, k) < 0.98) continue;
    pos(i, tmp);
    if (Math.hypot(tmp[0] - grip[0], tmp[1] - grip[1], tmp[2] - grip[2]) < handR) continue;
    out.push([tmp[0], tmp[1], tmp[2]]);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// three.js side: find the tip on an instance (once per asset, cached), then read it live
// ---------------------------------------------------------------------------------------------------------------

const _v = new THREE.Vector3();
const _inv = new THREE.Matrix4();

/**
 * Finds the tip on a fresh instance (rest pose, before any clip ran) of `asset`: { follow: 'bone' | 'prop', name,
 * local: [x, y, z], dir: [x, y, z] } in the followed object's own space, or null. Cached on the asset.
 */
function findTip(asset, root, rule) {
  if (asset.weaponTip !== undefined) return asset.weaponTip;
  let tip = null;
  try {
    tip = measure(asset, root, rule);
  } catch {
    tip = null;
  }
  // (a socketed prop still loading is measured on a later instance: only a found tip, or a fused prop, is final)
  if (tip || !rule.prop) asset.weaponTip = tip;
  return tip;
}

function measure(asset, root, rule) {
  root.updateMatrixWorld(true);
  const rootInv = _inv.copy(root.matrixWorld).invert();
  const height = (asset.height || 1) / (asset.unitScale || 1); // her height in the file's own space
  // a separate prop: its geometry is the prop (its own space: the tip follows the mesh)
  if (rule.prop) {
    const [how, name] = rule.prop.split(':');
    let obj = null;
    if (how === 'socket') root.getObjectByName(name)?.traverse((o) => { if (!obj && o.isMesh && o.name === 'prop') obj = o; });
    else root.traverse((o) => { if (!obj && o.isMesh && o.name === name) obj = o; });
    if (!obj?.geometry?.attributes?.position) return null;
    const pa = obj.geometry.attributes.position;
    // (measured in the prop's own space when its frame names the barrel's axis, else in her rest pose)
    const toRoot = rule.axis ? new THREE.Matrix4() : new THREE.Matrix4().multiplyMatrices(rootInv, obj.matrixWorld);
    const pts = [];
    for (let i = 0; i < pa.count; i++) {
      _v.fromBufferAttribute(pa, i).applyMatrix4(toRoot);
      pts.push([_v.x, _v.y, _v.z]);
    }
    const grip = new THREE.Vector3().setFromMatrixPosition(toRoot);
    const t = pickTip(pts, [grip.x, grip.y, grip.z], rule, height);
    if (!t) return null;
    const back = toRoot.clone().invert();
    const local = new THREE.Vector3(...t.pos).applyMatrix4(back);
    const dir = new THREE.Vector3(...t.dir).transformDirection(back);
    return { follow: 'prop', name: rule.prop, local: local.toArray(), dir: dir.toArray(), kind: rule.kind };
  }
  // the prop fused into the skinned body: the vertices rigid to the hand bone, over every skinned part (a file's
  // primitives load as one mesh each; the outline twins are skipped)
  const meshes = [];
  root.traverse((o) => {
    if (o.isSkinnedMesh && !o.userData.isOutline && o.skeleton?.bones.some((b) => b.name === rule.bone)) meshes.push(o);
  });
  if (!meshes.length) return null;
  const mesh = meshes[0];
  const k = mesh.skeleton.bones.findIndex((b) => b.name === rule.bone);
  const bone = mesh.skeleton.bones[k];
  // rest space (the root's): a bone rests at bindMatrix^-1 x boneInverse^-1 in geometry space
  const restOf = (m, kk) => new THREE.Matrix4().copy(m.skeleton.boneInverses[kk]).invert()
    .premultiply(new THREE.Matrix4().copy(m.bindMatrix).invert()).premultiply(new THREE.Matrix4().multiplyMatrices(rootInv, m.matrixWorld));
  const boneRest = restOf(mesh, k);
  const grip = new THREE.Vector3().setFromMatrixPosition(boneRest);
  const g = [grip.x, grip.y, grip.z];
  let t;
  if (rule.pick === 'bone') {
    t = { pos: g, dir: [0, 0, 1] };
  } else {
    const pts = [];
    for (const m of meshes) {
      const geo = m.geometry;
      const pa = geo.attributes.position;
      const si = geo.attributes.skinIndex;
      const sw = geo.attributes.skinWeight;
      const km = m.skeleton.bones.indexOf(bone) >= 0 ? m.skeleton.bones.indexOf(bone) : m.skeleton.bones.findIndex((b) => b.name === rule.bone);
      if (!pa || !si || !sw || km < 0) continue;
      // a skinned vertex rests at boneRest x boneInverse x bindMatrix x position (the same for every bone at rest)
      const geoToRoot = restOf(m, km).multiply(m.skeleton.boneInverses[km]).multiply(m.bindMatrix);
      pts.push(...propPoints(pa.count, (i, out) => {
        _v.fromBufferAttribute(pa, i).applyMatrix4(geoToRoot);
        out[0] = _v.x;
        out[1] = _v.y;
        out[2] = _v.z;
        return out;
      }, (i, kk) => {
        let w = 0;
        for (let c = 0; c < 4; c++) if (si.getComponent(i, c) === kk) w += sw.getComponent(i, c);
        return w;
      }, km, g, (rule.hand ?? 0.12) * height));
    }
    t = pickTip(pts, g, rule, height);
  }
  if (!t) return null;
  // into the bone's own space (bone.matrixWorld = root.matrixWorld x boneRest at rest)
  const back = boneRest.clone().invert();
  const local = new THREE.Vector3(...t.pos).applyMatrix4(back);
  const dir = new THREE.Vector3(...t.dir).transformDirection(back);
  return { follow: 'bone', name: bone.name, local: local.toArray(), dir: dir.toArray(), kind: rule.kind };
}

/**
 * Gives an instance of an armed figure its live muzzle anchor (call right after building it, before any clip runs).
 * Sets userData.anchors.muzzle (world point or null), userData.anchorDir('muzzle') (world unit vector or null) and
 * userData.weaponKind ('gun' | 'bow' | 'staff'). Unlisted / unmeasurable figures are left alone.
 */
export function attachWeaponTip(group, asset, root) {
  const rule = tipRule(asset?.id);
  if (!rule) return group;
  const tip = findTip(asset, root, rule);
  if (!tip) return group;
  let follow = null;
  if (tip.follow === 'bone') {
    root.traverse((o) => { if (!follow && o.isBone && o.name === tip.name) follow = o; });
  } else {
    const [how, name] = tip.name.split(':');
    if (how === 'socket') root.getObjectByName(name)?.traverse((o) => { if (!follow && o.isMesh && o.name === 'prop') follow = o; });
    else root.traverse((o) => { if (!follow && o.isMesh && o.name === name) follow = o; });
  }
  if (!follow) return group;
  const local = new THREE.Vector3(...tip.local);
  const localDir = new THREE.Vector3(...tip.dir);
  const pos = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const ud = group.userData;
  ud.weaponKind = tip.kind;
  ud.anchors = Object.freeze({
    get muzzle() {
      follow.updateWorldMatrix(true, false);
      return pos.copy(local).applyMatrix4(follow.matrixWorld);
    },
  });
  ud.anchorDir = (as) => {
    if (as !== 'muzzle') return null;
    follow.updateWorldMatrix(true, false);
    return dir.copy(localDir).transformDirection(follow.matrixWorld);
  };
  return group;
}
