// Lively figures: runtime skirt bones (prototype proto/rig-motion; see figureOptions.js).
//
// No shipped girl has skirt bones (Hikari's coat chains aside), and a Meshy rig never brings any.
// Once per asset, before any instance is cloned, this finds the skirt geometrically and gives it four
// bones of its own (front / left / back / right, children of the hips, at the hips' bind pose):
//  - the leg radius is measured from the calves (shin-weighted vertices just below the knee)
//  - a skirt vertex sits between the knee band and the waist, is weighted to the hips / spine /
//    thighs only (never hands, arms or the head), and lies clearly outside both thigh axes
//  - its weight moves onto the skirt bones in a gradient: 0 at the waist, full at the hem (all of
//    the hips' / spine's share, half of the thighs', so the skirt still follows a stepping leg),
//    split between the two nearest of the four bones by the vertex's direction around the hips
// At rest the new bones sit exactly where the hips are, so a figure that is not lively deforms
// exactly as before. livelyRig.js swings them with one spring (hem outward ≤ 12°, inward ≤ 3° so it
// never cuts into the thighs). Girls without a skirt (too few such vertices) get no bones.
import * as THREE from 'three';

export const SKIRT_BONES = ['lv_skirt_F', 'lv_skirt_L', 'lv_skirt_B', 'lv_skirt_R'];
/** Outward direction of each skirt bone in the figure's frame (she faces +Z, her left is +X). */
export const SKIRT_DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const HIPS_SET = ['hips', 'spine', 'spine1'];

const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();

function segDist(p, a, b) {
  const ab = _v.copy(b).sub(a);
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / Math.max(1e-9, ab.lengthSq())));
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

/**
 * Adds the skirt bones to an asset's template scene (once). Returns the bone names added, or [] when
 * the figure has no skirt (or already has skirt / coat bones of its own).
 */
export function addSkirtBones(scene) {
  if (scene.userData.livelySkirt) return scene.userData.livelySkirt;
  scene.userData.livelySkirt = [];
  scene.updateMatrixWorld(true);
  const meshes = [];
  scene.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton) meshes.push(o);
  });
  if (!meshes.length) return [];
  const skel = meshes[0].skeleton;
  const users = meshes.filter((m) => m.skeleton === skel);
  const bones = skel.bones;
  if (bones.some((b) => /^(skirt|coat|cape)/i.test(b.name) || SKIRT_BONES.includes(b.name))) return [];
  const idx = (n) => bones.findIndex((b) => b.name === n);
  const iH = idx('hips');
  const iTL = idx('thigh_L');
  const iTR = idx('thigh_R');
  const iSL = idx('shin_L');
  const iSR = idx('shin_R');
  const iFL = idx('foot_L');
  const iFR = idx('foot_R');
  if ([iH, iTL, iTR, iSL, iSR, iFL, iFR].some((i) => i < 0)) return [];
  const bindPos = (i) => new THREE.Vector3().setFromMatrixPosition(_m.copy(skel.boneInverses[i]).invert());
  const hips = bindPos(iH);
  const thL = bindPos(iTL);
  const thR = bindPos(iTR);
  const knL = bindPos(iSL);
  const knR = bindPos(iSR);
  const ftL = bindPos(iFL);
  const ftR = bindPos(iFR);
  const waistY = hips.y;
  const kneeY = (knL.y + knR.y) / 2;
  const legL = waistY - kneeY;
  if (!(legL > 1e-4)) return [];
  const hipSet = new Set(HIPS_SET.map(idx).filter((i) => i >= 0));
  const thighSet = new Set([iTL, iTR]);
  // pass 1: calf radius
  const calf = [];
  const each = (fn) => {
    for (const m of users) {
      const g = m.geometry;
      const pos = g.attributes.position;
      const si = g.attributes.skinIndex;
      const sw = g.attributes.skinWeight;
      if (!pos || !si || !sw) continue;
      for (let i = 0; i < pos.count; i++) {
        const p = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m.bindMatrix);
        fn(m, g, i, p, si, sw);
      }
    }
  };
  each((m, g, i, p, si, sw) => {
    if (p.y > kneeY - 0.05 * legL || p.y < kneeY - 0.4 * legL) return;
    let shin = 0;
    for (let k = 0; k < 4; k++) {
      const b = si.getComponent(i, k);
      if (b === iSL || b === iSR) shin += sw.getComponent(i, k);
    }
    if (shin < 0.6) return;
    calf.push(Math.min(segDist(p, knL, ftL), segDist(p, knR, ftR)));
  });
  if (calf.length < 8) return [];
  calf.sort((a, b) => a - b);
  const legR = calf[Math.floor(calf.length * 0.6)] * 1.35;
  // pass 2: the skirt vertices
  const picked = [];
  each((m, g, i, p, si, sw) => {
    if (p.y > waistY + 0.04 * legL || p.y < kneeY - 0.5 * legL) return;
    let body = 0;
    for (let k = 0; k < 4; k++) {
      const b = si.getComponent(i, k);
      if (hipSet.has(b) || thighSet.has(b)) body += sw.getComponent(i, k);
    }
    if (body < 0.85) return;
    const d = Math.min(segDist(p, thL, knL), segDist(p, thR, knR));
    if (d < legR * 1.15 + 0.02 * legL) return;
    picked.push({ g, i, p, si, sw });
  });
  let count = 0;
  for (const m of users) count += m.geometry.attributes.position?.count || 0;
  if (picked.length < Math.max(24, count * 0.01)) return [];
  const ys = picked.map((e) => e.p.y).sort((a, b) => a - b);
  const hemY = ys[Math.floor(ys.length * 0.05)];
  const topY = waistY + 0.04 * legL;
  // the bones: children of the hips at the hips' own bind pose
  const hipsBone = bones[iH];
  const newBones = SKIRT_BONES.map((name) => {
    const b = new THREE.Bone();
    b.name = name;
    hipsBone.add(b);
    return b;
  });
  const base = bones.length;
  const inv = skel.boneInverses[iH];
  const skel2 = new THREE.Skeleton([...bones, ...newBones], [...skel.boneInverses, ...newBones.map(() => inv.clone())]);
  for (const m of users) m.bind(skel2, m.bindMatrix);
  const angles = SKIRT_DIRS.map(([x, z]) => Math.atan2(x, z));
  for (const { g, i, p, si, sw } of picked) {
    let k = Math.max(0, Math.min(1, (topY - p.y) / Math.max(1e-6, topY - hemY)));
    k = k ** 1.3;
    const inf = [];
    let take = 0;
    for (let s = 0; s < 4; s++) {
      const b = si.getComponent(i, s);
      let w = sw.getComponent(i, s);
      if (w <= 0) continue;
      let t = 0;
      if (hipSet.has(b)) t = w * k;
      else if (thighSet.has(b)) t = w * k * 0.5;
      w -= t;
      take += t;
      if (w > 1e-4) inf.push([b, w]);
    }
    const th = Math.atan2(p.x - hips.x, p.z - hips.z);
    const lobes = angles.map((a, j) => [base + j, Math.max(0, Math.cos(th - a)) ** 2]).sort((a, b) => b[1] - a[1]).slice(0, 2);
    const ls = lobes[0][1] + lobes[1][1] || 1;
    for (const [b, l] of lobes) if (l > 0) inf.push([b, (take * l) / ls]);
    inf.sort((a, b) => b[1] - a[1]);
    const keep = inf.slice(0, 4);
    const sum = keep.reduce((s2, e) => s2 + e[1], 0) || 1;
    for (let s = 0; s < 4; s++) {
      si.setComponent(i, s, keep[s] ? keep[s][0] : 0);
      sw.setComponent(i, s, keep[s] ? keep[s][1] / sum : 0);
    }
  }
  for (const m of users) {
    m.geometry.attributes.skinIndex.needsUpdate = true;
    m.geometry.attributes.skinWeight.needsUpdate = true;
  }
  scene.userData.livelySkirt = SKIRT_BONES.slice();
  scene.userData.livelySkirtStats = { vertices: picked.length, hemY, waistY, legR };
  return scene.userData.livelySkirt;
}
