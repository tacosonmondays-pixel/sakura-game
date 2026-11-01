// Weapon-tip anchors (docs/specs/weapon-muzzles.md, src/models/weaponTip.js): every armed figure in the table
// resolves a tip from its GLB (full and LOD), on its prop (inside the prop's bounds, away from the hand, at the
// prop's far end), and the three.js runtime finds the same point on a real instance and follows its bone.
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { WEAPON_TIPS, pickTip, propPoints, attachWeaponTip, tipRule } from '../../src/models/weaponTip.js';
import { readGlbSkin, xf } from './glbSkin.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', '..', 'public', 'models', 'characters');
const file = (id, lod) => path.join(dir, `${id}${lod ? '.lod' : ''}.glb`);

/** The pure path on a parsed GLB: { tip, grip, H, pts } (H: her height in the file's space). */
function measure(g, rule) {
  const H = g.extras.height / (g.extras.unitScale || 1);
  const k = g.bones.indexOf(rule.bone);
  expect(k, `${rule.bone} in the skeleton`).toBeGreaterThanOrEqual(0);
  const R = g.boneRest(k);
  const grip = [R[12], R[13], R[14]];
  if (rule.pick === 'bone') return { tip: { pos: grip, min: grip, max: grip, n: 0 }, grip, H, pts: [] };
  const pts = [];
  for (const p of g.prims) {
    if (!p.skinned) continue;
    pts.push(...propPoints(p.pos.length / 3, (i, o) => {
      const q = xf(p.nodeWorld, p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]);
      o[0] = q[0];
      o[1] = q[1];
      o[2] = q[2];
      return o;
    }, (i, kk) => {
      let w = 0;
      for (let c = 0; c < 4; c++) if (p.joints[i * 4 + c] === kk) w += p.weights[i * 4 + c];
      return w;
    }, k, grip, (rule.hand ?? 0.12) * H));
  }
  return { tip: pickTip(pts, grip, rule, H), grip, H, pts };
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('weapon-tip table', () => {
  it('lists real figures with a known pick and look', () => {
    for (const [id, r] of Object.entries(WEAPON_TIPS)) {
      expect(existsSync(file(id)), `${id}.glb`).toBe(true);
      expect(existsSync(file(id, true)), `${id}.lod.glb`).toBe(true);
      expect(['far', 'up', 'fwd', 'center', 'bone']).toContain(r.pick);
      expect(['gun', 'bow', 'staff']).toContain(r.kind);
      expect(tipRule(id)).toBe(r);
    }
    expect(tipRule('kage')).toBeNull();
    expect(tipRule('kohaku')).toBeNull(); // the duo keeps its own anchors
  });
});

describe('every armed figure resolves a tip on her prop', () => {
  for (const [id, rule] of Object.entries(WEAPON_TIPS)) {
    if (rule.prop) continue; // the socketed prop: see the runtime test below
    for (const lod of [false, true]) {
      it(`${id}${lod ? ' (LOD)' : ''}: ${rule.pick} tip of the prop on ${rule.bone}`, () => {
        const g = readGlbSkin(file(id, lod));
        const { tip, grip, H, pts } = measure(g, rule);
        expect(tip, 'a tip').toBeTruthy();
        for (const v of tip.pos) expect(Number.isFinite(v)).toBe(true);
        if (rule.pick === 'bone') return;
        // a real prop: enough vertices, at least a tenth of her height long
        expect(pts.length).toBeGreaterThanOrEqual(12);
        const ext = Math.max(...tip.max.map((m, i) => m - tip.min[i]));
        expect(ext / H).toBeGreaterThan(0.05);
        // the tip sits on the prop: inside its bounds (2 % of her height of slack)
        const slack = 0.02 * H;
        for (let c = 0; c < 3; c++) {
          expect(tip.pos[c]).toBeGreaterThanOrEqual(tip.min[c] - slack);
          expect(tip.pos[c]).toBeLessThanOrEqual(tip.max[c] + slack);
        }
        // and a nearby prop vertex is really there (not the empty middle of a bow's bounds)
        const near = Math.min(...pts.map((p) => dist(p, tip.pos)));
        expect(near / H).toBeLessThan(0.06);
        // a head / muzzle is out at the prop's end, clear of the hand
        if (rule.pick !== 'center') expect(dist(tip.pos, grip) / H).toBeGreaterThan(0.06);
        if (rule.pick === 'fwd') expect(tip.pos[2]).toBeGreaterThan(grip[2]);
        if (rule.pick === 'up') expect(tip.pos[1]).toBeGreaterThan(grip[1]);
      });
    }
  }

  it('the full and LOD files agree on the tip (within 6 % of her height)', () => {
    for (const [id, rule] of Object.entries(WEAPON_TIPS)) {
      if (rule.prop) continue;
      const a = measure(readGlbSkin(file(id, false)), rule);
      const b = measure(readGlbSkin(file(id, true)), rule);
      expect(dist(a.tip.pos, b.tip.pos) / a.H, id).toBeLessThan(0.06);
    }
  });
});

/** A three.js stand-in of a GLB instance: its skinned body (real vertices and weights) on its rest skeleton. */
function instance(g) {
  const root = new THREE.Group();
  const bones = g.bones.map((name, k) => {
    const b = new THREE.Bone();
    b.name = name;
    b.matrixAutoUpdate = false;
    b.matrix.fromArray(Array.from(g.boneRest(k)));
    root.add(b);
    return b;
  });
  const inverses = g.bones.map((_, k) => new THREE.Matrix4().copy(new THREE.Matrix4().fromArray(Array.from(g.boneRest(k)))).invert());
  for (const p of g.prims) {
    if (!p.skinned) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(p.pos), 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(Uint16Array.from(p.joints), 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from(p.weights), 4));
    const m = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
    m.matrixAutoUpdate = false;
    m.matrix.fromArray(Array.from(p.nodeWorld));
    root.add(m);
    root.updateMatrixWorld(true);
    m.bind(new THREE.Skeleton(bones, inverses), m.matrixWorld);
  }
  root.updateMatrixWorld(true);
  return { root, bones };
}

describe('the runtime anchor (three.js) on real GLB data', () => {
  for (const id of ['aoi', 'shiro', 'luna', 'nami', 'yuki', 'hana']) {
    it(`${id}: userData.anchors.muzzle is the measured tip and follows her hand bone`, () => {
      const rule = WEAPON_TIPS[id];
      const g = readGlbSkin(file(id, false));
      const want = measure(g, rule).tip.pos;
      const { root, bones } = instance(g);
      const group = new THREE.Group();
      group.add(root);
      attachWeaponTip(group, { id, height: g.extras.height, unitScale: g.extras.unitScale }, root);
      const ud = group.userData;
      expect(ud.weaponKind).toBe(rule.kind);
      const p = ud.anchors.muzzle;
      expect(dist([p.x, p.y, p.z], want)).toBeLessThan(1e-4);
      expect(ud.anchorDir('muzzle').length()).toBeCloseTo(1, 5);
      // the bone moves (a clip): the tip moves with it, rigidly
      const bone = bones.find((b) => b.name === rule.bone);
      bone.matrix.premultiply(new THREE.Matrix4().makeTranslation(0.1, 0.2, -0.05));
      bone.matrixWorldNeedsUpdate = true;
      const q = ud.anchors.muzzle;
      expect(dist([q.x, q.y, q.z], [want[0] + 0.1, want[1] + 0.2, want[2] - 0.05])).toBeLessThan(1e-4);
    });
  }

  it('tenka: the socketed coilgun\'s tip is its barrel mouth (the -x end of the prop mesh)', () => {
    const g = readGlbSkin(file('tenka', false));
    const pg = readGlbSkin(path.join(dir, 'tenka-coilgun.glb'));
    const root = new THREE.Group();
    const socket = new THREE.Object3D();
    socket.name = 'prop_coilgun';
    socket.matrixAutoUpdate = false;
    socket.matrix.fromArray(Array.from(g.nodeWorld('prop_coilgun')));
    root.add(socket);
    const pos = [];
    for (const p of pg.prims) for (let i = 0; i < p.pos.length; i += 3) pos.push(...xf(p.nodeWorld, p.pos[i], p.pos[i + 1], p.pos[i + 2]));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pos), 3));
    const prop = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    prop.name = 'prop';
    socket.add(prop);
    const group = new THREE.Group();
    group.add(root);
    attachWeaponTip(group, { id: 'tenka', height: g.extras.height, unitScale: g.extras.unitScale }, root);
    expect(group.userData.weaponKind).toBe('gun');
    const a = group.userData.anchors.muzzle;
    const local = prop.worldToLocal(new THREE.Vector3(a.x, a.y, a.z));
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    // on the barrel's end (the mesh's -x end; e2e/display-polish-2.mjs measured it at (-0.5, 0.13, 0))
    expect(local.x).toBeLessThan(bb.min.x + 0.15 * (bb.max.x - bb.min.x));
    expect(local.distanceTo(new THREE.Vector3(-0.5, 0.13, 0))).toBeLessThan(0.15);
  });

  it('an unlisted or unmeasurable figure keeps the old hand point (no anchor)', () => {
    const g = new THREE.Group();
    attachWeaponTip(g, { id: 'kage', height: 0.9, unitScale: 2 }, new THREE.Group());
    expect(g.userData.anchors).toBeUndefined();
    const h = new THREE.Group();
    attachWeaponTip(h, { id: 'shiro', height: 0.9, unitScale: 2 }, new THREE.Group()); // no body mesh
    expect(h.userData.anchors).toBeUndefined();
    expect(h.userData.weaponKind).toBeUndefined();
  });
});
