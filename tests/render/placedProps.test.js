// The academy girls' placed props (src/render/placedProps.js) in node, with the real GLBs parsed by GLTFLoader:
// each kind draws its parts from the sim's own objects, fades out when they go, keeps the flat drawing while a
// file is missing or on Low graphics, never writes the sim, and disposes what it made.
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  PlacedProps, PROP_FILES, FILE_PARTS, setPropFile, partsFromScene, roadFacing, stripPlates, propPhase, dropHeight, easeOutBack,
  shellVolumes, fixInsideOutShells, INSIDE_OUT_PARTS,
} from '../../src/render/placedProps.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', '..', 'public', 'models', 'props');

const parseGlb = (file) => new Promise((resolve, reject) => {
  const buf = readFileSync(path.join(dir, `${file}.glb`));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  new GLTFLoader().parse(ab, '', resolve, reject);
});

const loadedParts = {};
beforeAll(async () => {
  for (const f of Object.keys(PROP_FILES)) loadedParts[f] = partsFromScene(f, (await parseGlb(f)).scene);
});

/** A small board with one of everything the layer draws. */
function makeSim() {
  const road = { index: 0, points: [[0, 5], [10, 5], [10, 0]] };
  const enemy = { uid: 90, x: 4, y: 5, dead: false, def: { size: 1 }, statuses: { hold: { left: 1, sourceUid: 3 } } };
  const towers = [
    { uid: 1, unitId: 'azami', x: 2, y: 4, stats: {} },
    { uid: 2, unitId: 'yuzuha', x: 6, y: 4, stats: { sentry: { range: 2 } }, sentries: [{ uid: 20, x: 6, y: 4.3, ttl: 10, type: 'flak' }], nets: [{ x: 7, y: 5, left: 100 }] },
    { uid: 3, unitId: 'chigusa', x: 4, y: 6, stats: {}, beds: [{ uid: 30, x: 3, y: 5, ttl: 5, hits: 4 }] },
    { uid: 4, unitId: 'ouka', x: 8, y: 6, stats: { hub: { radius: 2.6, bannerRange: 1.6 } }, banners: [{ x: 9, y: 5 }] },
    { uid: 5, unitId: 'wakaba', x: 2, y: 6, stats: {} },
    { uid: 6, unitId: 'kinu', x: 8, y: 3, stats: { ring: { scissors: 3, travel: 1.8 } }, eff: { projectiles: 10 }, rings: [{ x: 8, y: 3, r: 1, max: 2.6, hit: [] }] },
  ];
  towers[0].hydrated = { src: 5, shots: 4 };
  return {
    time: 1, towers, enemies: [enemy], pathData: [road],
    traps: [{ uid: 10, x: 3, y: 5, strip: true, extra: false, armed: true, hits: 6 }, { uid: 11, x: 5, y: 5, strip: true, extra: true, armed: true, hits: 3 }],
  };
}

const install = (files = Object.keys(PROP_FILES)) => { for (const f of files) setPropFile(f, loadedParts[f]); };

describe('placed props: pure helpers', () => {
  it('strips lie across the road: the facing of the nearest segment', () => {
    const p = [{ points: [[0, 5], [10, 5], [10, 0]] }];
    expect(roadFacing(p, 3, 5.2)).toBeCloseTo(Math.PI / 2); // road along +x
    expect(roadFacing(p, 10.1, 2)).toBeCloseTo(Math.PI); // road along -y
    expect(roadFacing([], 1, 1)).toBe(0);
  });

  it('spent hits flatten plates, one plate at least while the strip lives', () => {
    expect(stripPlates(6, 6)).toBe(6);
    expect(stripPlates(3, 6)).toBe(3);
    expect(stripPlates(1, 30)).toBe(1);
    expect(stripPlates(0, 6)).toBe(1);
    expect(stripPlates(5, 0)).toBe(6);
  });

  it('Reduce motion: no deploy animation, a short fade in; every prop fades out in 0.35 s', () => {
    expect(propPhase(0, null, 0.5, true).deploy).toBe(1);
    expect(propPhase(0, null, 0.5, true).fade).toBe(0);
    expect(propPhase(1, null, 0.5, true).fade).toBe(1);
    expect(propPhase(0.25, null, 0.5, false)).toEqual({ deploy: 0.5, fade: 1 });
    expect(propPhase(9, 0.175, 0.5, false).fade).toBeCloseTo(0.5);
    expect(propPhase(9, 0.4, 0.5, false).fade).toBe(0);
  });

  it('easings land at rest', () => {
    expect(dropHeight(0)).toBe(1);
    expect(dropHeight(1)).toBeCloseTo(0);
    expect(easeOutBack(1)).toBeCloseTo(1);
    expect(easeOutBack(0)).toBeCloseTo(0);
  });
});

describe('placed props: the layer', () => {
  it('parses every shipped GLB into the parts it draws', () => {
    for (const f of Object.keys(PROP_FILES)) {
      expect([...loadedParts[f].keys()].sort(), f).toEqual([...FILE_PARTS[f]].sort());
      for (const p of loadedParts[f].values()) expect(p.geometry.attributes.position.count, p.name).toBeGreaterThan(8);
    }
    expect(loadedParts.yuzuha_sentry.get('sentry_light_tint').glow).toBe(true);
    expect(loadedParts.yuzuha_sentry.get('sentry_head').glow).toBe(false);
    // a part's rest pose is its pivot inside the prop (the banner pennant hangs at the pole top)
    expect(new THREE.Vector3().setFromMatrixPosition(loadedParts.ouka_banners.get('banner_flag').rest).y).toBeCloseTo(0.83, 2);
  });

  it('draws one of everything from the sim, without writing it', () => {
    install();
    const sim = makeSim();
    const before = JSON.stringify(sim);
    const scene = new THREE.Scene();
    const enemies = new Map([[90, { x: 4, z: 5, ground: 0, size: 1, hidden: false }]]);
    const p = new PlacedProps({ sim, scene, actors: { enemies, towers: new Map() }, quality: 'high' });
    for (const k of ['strip', 'sentry', 'net', 'vine', 'bed', 'office', 'banner', 'bottle', 'heatRing', 'scissor']) expect(p.covers(k), k).toBe(true);
    for (let i = 0; i < 90; i++) p.update(1 / 30);
    const s = p.stats();
    expect(s.strip_seg).toBe(12);
    expect(s.strip_cap).toBe(4);
    expect(s.sentry_leg).toBe(3);
    expect([s.sentry_body, s.sentry_head, s.sentry_band_tint, s.sentry_light_tint]).toEqual([1, 1, 1, 1]);
    expect([s.net_mesh, s.net_weight]).toEqual([1, 4]);
    expect(s.vine_tendril).toBe(3);
    expect(s.bed_base).toBe(1);
    expect([s.office_stand, s.office_flag, s.banner_pole, s.banner_flag]).toEqual([1, 1, 1, 1]);
    expect(s.bottle_body).toBe(1);
    expect(s.heatRing_band).toBe(1);
    expect(s.pin_pin).toBe(10); // her pin count rides the ring
    expect(s.scissor_half).toBe(6);
    expect(JSON.stringify(sim)).toBe(before);
    // the Specialist Kit colour reaches the band (flak: violet)
    const band = p.batches.get('sentry_band_tint').mesh;
    const c = new THREE.Color();
    band.getColorAt(0, c);
    expect(c.b).toBeGreaterThan(c.g);
    // outlines on the toon parts, none on the unlit ones
    expect(p.batches.get('sentry_head').outline).toBeTruthy();
    expect(p.batches.get('heatRing_band').outline).toBeNull();
    p.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('objects already out when a file arrives are simply there; later ones deploy', () => {
    install();
    const sim = makeSim();
    const p = new PlacedProps({ sim, scene: new THREE.Scene(), quality: 'high' });
    p.update(0.02);
    expect(p.recs.get('y20').born).toBeLessThan(p.time - 5);
    sim.towers[1].sentries.push({ uid: 21, x: 6.5, y: 4.3, ttl: 10, type: 'plain' });
    p.update(0.02);
    expect(p.recs.get('y21').born).toBeCloseTo(p.time);
    p.dispose();
  });

  it('a gone object fades out over 0.35 s, then its instances are gone', () => {
    install();
    const sim = makeSim();
    const p = new PlacedProps({ sim, scene: new THREE.Scene(), actors: { enemies: new Map(), towers: new Map() }, quality: 'medium' });
    for (let i = 0; i < 30; i++) p.update(1 / 30);
    expect(p.stats().bed_base).toBe(1);
    sim.towers[2].beds = [];
    p.update(0.1); // the frame it goes: still whole
    p.update(0.1);
    const b = p.batches.get('bed_base');
    expect(b.n).toBe(1);
    expect(b.fade.getX(0)).toBeGreaterThan(0.5);
    expect(b.fade.getX(0)).toBeLessThan(1);
    for (let i = 0; i < 12; i++) p.update(0.05);
    expect(p.stats().bed_base).toBeUndefined();
    p.dispose();
  });

  it('Low graphics and a missing file keep the flat drawing', () => {
    install();
    const low = new PlacedProps({ sim: makeSim(), scene: new THREE.Scene(), quality: 'low' });
    expect(low.covers('strip')).toBe(false);
    low.update(0.1);
    expect(low.batches.size).toBe(0);
    low.setQuality('high');
    expect(low.covers('strip')).toBe(true);
    low.dispose();
    expect(low.covers('strip')).toBe(false);
    setPropFile('kinu_pins', null); // failed to load
    const p = new PlacedProps({ sim: makeSim(), scene: new THREE.Scene(), quality: 'high' });
    expect(p.covers('heatRing')).toBe(false);
    expect(p.covers('scissor')).toBe(false);
    expect(p.covers('bottle')).toBe(true);
    p.update(0.1);
    expect(p.stats().heatRing_band).toBeUndefined();
    p.dispose();
  });

  it('Reduce motion: props are fully out at once (only the fade)', () => {
    install();
    const sim = makeSim();
    const p = new PlacedProps({ sim, scene: new THREE.Scene(), quality: 'high', reduceMotion: true });
    expect(p.covers('sentry')).toBe(true); // the file is in before the sentry appears
    p.update(0.05);
    const legs = p.batches.get('sentry_leg');
    const m = new THREE.Matrix4();
    legs.mesh.getMatrixAt(0, m);
    const foot = new THREE.Vector3(0, -0.2, 0).applyMatrix4(m);
    expect(foot.y).toBeLessThan(0.1); // splayed down to the ground, not folded up
    expect(legs.fade.getX(0)).toBeLessThan(1); // fading in
    p.dispose();
  });
});

describe('placed props: inside-out shells', () => {
  it('turns an inside-out box right way out (winding and normals), leaves a right one alone', () => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    expect(shellVolumes(g).vols[0]).toBeCloseTo(1);
    expect(fixInsideOutShells(g)).toBe(0);
    const inv = new THREE.BoxGeometry(1, 1, 1);
    const a = inv.index.array;
    for (let t = 0; t < a.length; t += 3) [a[t + 1], a[t + 2]] = [a[t + 2], a[t + 1]];
    const n = inv.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    expect(shellVolumes(inv).vols[0]).toBeCloseTo(-1);
    expect(fixInsideOutShells(inv)).toBe(12);
    expect(shellVolumes(inv).vols[0]).toBeCloseTo(1);
    // normals point out again: the +x face's normal is +x
    const P = inv.attributes.position;
    for (let i = 0; i < P.count; i++) if (P.getX(i) > 0.49 && Math.abs(n.getX(i)) > 0.5) expect(n.getX(i)).toBeGreaterThan(0);
  });

  it("Ouka's pennant loads right way out (it was dark: inside-out cloth under its own outline)", () => {
    expect(INSIDE_OUT_PARTS.has('banner_flag')).toBe(true);
    const flag = loadedParts.ouka_banners.get('banner_flag');
    const { vols } = shellVolumes(flag.geometry);
    expect(vols.length).toBeGreaterThan(3);
    for (const v of vols) expect(v).toBeGreaterThanOrEqual(-1e-9);
    // stored normals agree with the winding on every triangle
    const P = flag.geometry.attributes.position;
    const N = flag.geometry.attributes.normal;
    const I = flag.geometry.index;
    const va = new THREE.Vector3();
    const vb = new THREE.Vector3();
    const vc = new THREE.Vector3();
    const vn = new THREE.Vector3();
    let bad = 0;
    for (let t = 0; t < I.count; t += 3) {
      va.fromBufferAttribute(P, I.getX(t));
      vb.fromBufferAttribute(P, I.getX(t + 1)).sub(va);
      vc.fromBufferAttribute(P, I.getX(t + 2)).sub(va);
      vn.fromBufferAttribute(N, I.getX(t));
      if (vb.cross(vc).dot(vn) < 0) bad++;
    }
    expect(bad).toBe(0);
  });
});
