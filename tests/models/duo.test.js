// The duo's figure (src/models/duo.js): both girls on one base as procedural stand-ins in their drawn colours
// (their test-build GLBs have no clips, so they would stand still), with idle, attack and hurt, and the attack
// on the right girl (Kohaku's beam, Tsubaki's shells). Nothing is fetched for her.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildChibi, disposeObject } from '../../src/models/index.js';
import { DUO_MEMBERS, DUO_CHIN_UP, modelIds } from '../../src/models/duo.js';
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

  it('fetches no model file (the members are drawn procedurally)', () => {
    expect(modelIds(DUO)).toEqual([]);
    expect(modelIds(getUnit('aoi'))).toEqual(['aoi']);
  });
});
