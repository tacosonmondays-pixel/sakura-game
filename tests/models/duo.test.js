// The duo's figure (src/models/duo.js): both girls on one base. In the game each member is her own GLB
// (tests/models/duo-members.test.js checks the files); here, with no WebGL, they are the procedural stand-ins in
// their drawn colours (the fallback), with idle, attack and hurt, the attack on the right girl (Kohaku's beam,
// Tsubaki's shells), the cheer for Prismfall, the DUO_READY layout and the FX anchors.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildChibi, disposeObject } from '../../src/models/index.js';
import { DUO_MEMBERS, DUO_CHIN_UP, DUO_SCALE, DUO_LAYOUT, DUO_TURN_OUT, modelIds } from '../../src/models/duo.js';
import { getUnit } from '../../src/data/units.js';

const DUO = getUnit('kohaku_tsubaki');

/** Every bone quaternion of a member, flattened (to see that she moved). */
function pose(fig) {
  return fig.userData.bones.flatMap((b) => [...b.quaternion.toArray(), ...b.position.toArray()]);
}
const moved = (a, b) => a.some((v, i) => Math.abs(v - b[i]) > 1e-4);

describe('duo figure', () => {
  it('both members are procedural stand-ins in their drawn looks, at every quality', () => {
    for (const quality of ['high', 'medium', 'low']) {
      const g = buildChibi(DUO, { quality });
      expect(g).toBeInstanceOf(THREE.Group);
      expect(g.userData.duo).toBe(true);
      expect(g.userData.memberIds).toEqual(['kohaku', 'tsubaki']);
      expect(g.userData.isStandIn()).toBe(true);
      expect(g.userData.isGlb()).toBe(false);
      const [k, t] = g.children;
      expect(k.userData.unitId).toBe('kohaku');
      expect(t.userData.unitId).toBe('tsubaki');
      for (const f of [k, t]) {
        expect(f.userData.standIn).toBe(true);
        expect(f.userData.chinUp).toBe(DUO_CHIN_UP);
      }
      disposeObject(g);
      expect(g.userData.disposed).toBe(true);
    }
  });

  it('wears the art\'s colours: Kohaku lilac with her council blazer, Tsubaki navy with her cadet cap', () => {
    expect(DUO_MEMBERS.kohaku.look).toMatchObject({ outfit: 'council', accessory: 'councilBand', weapon: 'staff' });
    expect(DUO_MEMBERS.tsubaki.look).toMatchObject({ outfit: 'cadet', accessory: 'cadetCap', weapon: 'cannon' });
    const hue = (hex) => new THREE.Color(hex).getHSL({}).h * 360;
    expect(hue(DUO_MEMBERS.kohaku.palette.hair)).toBeGreaterThan(250);
    expect(hue(DUO_MEMBERS.kohaku.palette.hair)).toBeLessThan(290);
    expect(new THREE.Color(DUO_MEMBERS.tsubaki.palette.hair).getHSL({}).l).toBeLessThan(0.3);
    expect(new THREE.Color(DUO_MEMBERS.tsubaki.palette.outfit).getHSL({}).l).toBeLessThan(0.3);
  });

  it('idles, attacks with the right girl and slumps when hurt', () => {
    const g = buildChibi(DUO, { quality: 'low' });
    const [k, t] = g.children;
    g.userData.animate(0, 0.016, 'idle');
    const k0 = pose(k);
    const t0 = pose(t);
    g.userData.animate(0.6, 0.016, 'idle');
    expect(moved(pose(k), k0), 'Kohaku idles').toBe(true);
    expect(moved(pose(t), t0), 'Tsubaki idles').toBe(true);

    // Tsubaki's shells: only she plays the launcher recoil
    const a = buildChibi(DUO, { quality: 'low' });
    const b = buildChibi(DUO, { quality: 'low' });
    for (const x of [a, b]) x.userData.animate(1, 0.016, 'idle');
    a.userData.playAttack('mortar');
    for (let i = 1; i <= 12; i++) for (const x of [a, b]) x.userData.animate(1 + i * 0.016, 0.016, 'idle');
    expect(moved(pose(a.children[1]), pose(b.children[1])), 'Tsubaki fires').toBe(true);
    expect(moved(pose(a.children[0]), pose(b.children[0])), 'Kohaku stays').toBe(false);
    // Kohaku's beam: only she casts
    a.userData.playAttack('beam');
    b.userData.playAttack('mortar');
    for (let i = 1; i <= 12; i++) for (const x of [a, b]) x.userData.animate(2 + i * 0.016, 0.016, 'idle');
    expect(moved(pose(a.children[0]), pose(b.children[0])), 'Kohaku casts').toBe(true);

    // hurt (the battle's disabled state): both slump, heads down
    const h = buildChibi(DUO, { quality: 'low' });
    for (let i = 0; i < 60; i++) h.userData.animate(3 + i * 0.016, 0.016, 'disabled');
    for (let i = 0; i < 60; i++) g.userData.animate(3 + i * 0.016, 0.016, 'idle');
    for (const i of [0, 1]) {
      const head = (x) => x.children[i].userData.bones[3].quaternion;
      expect(head(h).angleTo(head(g)), `member ${i} slumps`).toBeGreaterThan(0.15);
    }
    for (const x of [g, a, b, h]) disposeObject(x);
  });

  it('fetches her two members\' files, never one of her own', () => {
    expect(modelIds(DUO)).toEqual(['kohaku', 'tsubaki']);
    expect(modelIds(getUnit('aoi'))).toEqual(['aoi']);
  });

  it('stands Tsubaki on the left and Kohaku on the right, each at DUO_SCALE and turned 12° outward', () => {
    expect(DUO_TURN_OUT).toBeCloseTo((12 * Math.PI) / 180, 6);
    const g = buildChibi(DUO, { quality: 'low' });
    const [k, t] = g.children;
    for (const f of [k, t]) expect(f.scale.x).toBeCloseTo(DUO_SCALE, 6);
    expect(t.position.x).toBeLessThan(0);
    expect(k.position.x).toBeGreaterThan(0);
    expect(t.rotation.y).toBeCloseTo(-DUO_TURN_OUT, 6);
    expect(k.rotation.y).toBeCloseTo(DUO_TURN_OUT, 6);
    expect(DUO_LAYOUT.tsubaki.x).toBeCloseTo(-DUO_LAYOUT.kohaku.x, 6);
    // the battle turns the whole figure to her target: the pair keeps its spots across the screen
    for (const r of [0.6, -0.9, 2.4]) {
      g.rotation.y = r;
      g.userData.animate(0, 0.016, 'idle');
      g.updateMatrixWorld(true);
      const wk = k.getWorldPosition(new THREE.Vector3());
      const wt = t.getWorldPosition(new THREE.Vector3());
      expect(wk.x).toBeCloseTo(DUO_LAYOUT.kohaku.x, 5);
      expect(wk.z).toBeCloseTo(DUO_LAYOUT.kohaku.z, 5);
      expect(wt.x).toBeCloseTo(DUO_LAYOUT.tsubaki.x, 5);
      expect(wt.z).toBeCloseTo(DUO_LAYOUT.tsubaki.z, 5);
    }
    disposeObject(g);
  });

  it('both cheer for the Prismfall cast, and both attack when no kind is given (the girl page)', () => {
    const a = buildChibi(DUO, { quality: 'low' });
    const b = buildChibi(DUO, { quality: 'low' });
    for (const x of [a, b]) x.userData.animate(1, 0.016, 'idle');
    a.userData.playCheer();
    for (let i = 1; i <= 30; i++) for (const x of [a, b]) x.userData.animate(1 + i * 0.016, 0.016, 'idle');
    for (const i of [0, 1]) expect(moved(pose(a.children[i]), pose(b.children[i])), `member ${i} cheers`).toBe(true);
    const c = buildChibi(DUO, { quality: 'low' });
    const d = buildChibi(DUO, { quality: 'low' });
    for (const x of [c, d]) x.userData.animate(1, 0.016, 'idle');
    c.userData.playAttack();
    for (let i = 1; i <= 12; i++) for (const x of [c, d]) x.userData.animate(1 + i * 0.016, 0.016, 'idle');
    for (const i of [0, 1]) expect(moved(pose(c.children[i]), pose(d.children[i])), `member ${i} attacks`).toBe(true);
    for (const x of [a, b, c, d]) disposeObject(x);
  });

  it('gives the FX world-space anchors: Kohaku\'s lens and Tsubaki\'s muzzle, on their own sides', () => {
    const g = buildChibi(DUO, { quality: 'low' });
    g.position.set(5, 0, 3);
    g.scale.setScalar(1.5);
    g.updateMatrixWorld(true);
    const lens = g.userData.anchors.lens.clone();
    const muzzle = g.userData.anchors.muzzle.clone();
    for (const p of [lens, muzzle]) {
      expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
      expect(p.y).toBeGreaterThan(0.3);
    }
    expect(lens.x).toBeGreaterThan(5);
    expect(muzzle.x).toBeLessThan(5.3);
    expect(Math.abs(lens.z - 3)).toBeLessThan(1);
    // a stand-in has no stored direction
    expect(g.userData.anchorDir('lens')).toBeNull();
    disposeObject(g);
  });
});
