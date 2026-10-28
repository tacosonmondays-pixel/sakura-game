// Companion actors and Tenka's lab team (sync with v0.1.44): a Ruri or Hana who joins Tenka's lab at Joint
// Research leaves the board through the same door as a sale (Sim._removeTower), so her Kon / Kaze goes the
// same way a sold girl's does. src/render/companions.js never waits for a 'sell' event: every frame it
// reconciles its actors with sim.towers and drops the ones whose girl is gone, and a lab join emits
// 'labJoin', not 'sell'. Yoriko is a hero, and heroes never join, so her doll stays; so do a co-op partner's
// Ruri standing next to Tenka and her own Ruri out of range.
//
// This drives the real Companions class over a real Sim. Only what needs a browser is stubbed: the GLB
// figure (a plain THREE.Group stands in for it) and the girls' views (a uid -> view map kept in step with
// sim.towers, the way actors.sync keeps it before companions.update in BattleRenderer).
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Sim } from '../../src/sim/Sim.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { UNITS as FX, ENEMIES, STAGE, testData } from '../sim/fixtures.js';
import { Companions } from '../../src/render/companions.js';
import { loadCompanionManifest, setCompanionManifest, companionEntry, HomeAnchor } from '../../src/models/companions.js';
import { konState, sortieState } from '../../src/render/companionLogic.js';

const manifest = JSON.parse(readFileSync(new URL('../../public/models/companions/manifest.json', import.meta.url), 'utf8'));

const LAB = 0;
const XU = { ...FX, tenka: UNIT_MAP.tenka, ruri: UNIT_MAP.ruri, hana: UNIT_MAP.hana, yoriko: UNIT_MAP.yoriko };
const QUIET = { ...STAGE, waves: 5, waveGen: { pool: [], budget: { start: 1, growth: 1 } } };
// the test map's road runs along y = 4.5; Tenka stands at AT (range 4 with Long Rails)
const AT = [8.5, 3.4];

function mk() {
  const sim = new Sim({
    stageId: QUIET.id, difficulty: 'normal', seed: 5, hero: { unitId: 'yoriko' },
    loadout: ['tenka', 'ruri', 'hana', 'archer'].map((unitId) => ({ unitId })),
    data: testData({ stage: QUIET, units: XU, enemies: ENEMIES }),
  });
  sim.cash = 1e9;
  return sim;
}
const place = (sim, id, x, y, o) => {
  const t = sim.placeTower(id, x, y, o);
  expect(t, `${id} at ${x}, ${y}`).toBeTruthy();
  return t;
};

/** The renderer's side of a battle: the girls' views, the Companions actors, one frame at a time. */
async function board(sim) {
  const views = new Map(); // tower uid -> { model, facing } (what actors.towers holds)
  const actors = { towers: views, enemies: new Map(), enemyPos: () => null };
  const scene = new THREE.Scene();
  const c = new Companions({ sim, scene, actors, terrain: null, quality: 'high' });
  // node has no manifest fetch (it resolves null and switches companions off): install the real manifest
  await loadCompanionManifest();
  setCompanionManifest(manifest);
  c.ready = true;
  // the figure: a plain group in place of the GLB (everything else is the class's own code)
  c._create = (t, cid) => {
    if (!views.get(t.uid)) return null;
    const entry = companionEntry(cid);
    const a = {
      uid: t.uid, unitId: t.unitId, cid, entry, group: new THREE.Group(), detail: 'lod', anchor: new HomeAnchor(entry),
      home: new THREE.Vector3(), facing: 0, face: 0, faceT: 0, state: 'idle', barRest: null, battleScale: 1, height: 0.2,
      kon: cid === 'kon' ? { s: konState(), view: { x: 0, z: 0, h: 0.2, away: false } } : null,
      sortie: cid === 'kon' ? null : sortieState(),
    };
    a.group.name = `companion:${cid}:${t.uid}`;
    c.root.add(a.group);
    return a;
  };
  const dropped = [];
  const dispose0 = c._dispose.bind(c);
  c._dispose = (a) => {
    dropped.push(a.uid);
    dispose0(a);
  };
  const seen = [];
  const frame = () => {
    // the sim's events go through handle() (observes only), then actors.sync, then companions.update
    for (const ev of sim.drainEvents()) {
      seen.push(ev);
      c.handle(ev);
    }
    for (const uid of [...views.keys()]) if (!sim.getTower(uid)) views.delete(uid);
    for (const t of sim.towers) if (!views.has(t.uid)) views.set(t.uid, { model: new THREE.Group(), facing: 0 });
    c.update(1 / 60);
  };
  const drawn = () => c.root.children.map((g) => g.name).sort();
  return { c, frame, drawn, dropped, seen };
}

describe('Tenka\'s lab team: a joining girl\'s companion goes like a sold girl\'s', () => {
  test('Joint Research takes Ruri and Hana: Kon and Kaze leave the board; Yoriko\'s doll, a partner\'s Kon and an out-of-range Kon stay; a sale then drops a Kon the same way', async () => {
    const sim = mk();
    const tenka = place(sim, 'tenka', ...AT);
    for (let i = 0; i < 2; i++) expect(sim.upgradeTower(tenka.uid, LAB)).toBe(true);
    expect(tenka.eff.range).toBeCloseTo(4, 9);
    const ruri = place(sim, 'ruri', 9.5, 3.4); // in range: joins
    const hana = place(sim, 'hana', 8.5, 2.4); // in range: joins
    const yoriko = place(sim, 'yoriko', 9.5, 2.4); // in range, but a hero: stays
    const partner = place(sim, 'ruri', 7.5, 3.4, { owner: 1 }); // in range, a co-op partner's: stays
    const far = place(sim, 'ruri', 13.5, 3.4); // 5 tiles: out of her 4, stays
    const { c, frame, drawn, dropped, seen } = await board(sim);
    frame();
    const name = (cid, t) => `companion:${cid}:${t.uid}`;
    expect(drawn()).toEqual([name('kon', ruri), name('kaze', hana), name('doll', yoriko), name('kon', partner), name('kon', far)].sort());
    expect(c.has(ruri.uid) && c.has(hana.uid) && c.has(yoriko.uid)).toBe(true);

    // Joint Research: Ruri and Hana join her lab team
    expect(sim.upgradeTower(tenka.uid, LAB)).toBe(true);
    expect(tenka.lab.uids.slice().sort()).toEqual([ruri.uid, hana.uid].sort());
    frame();
    // no sale happened (the join is not a 'sell'), yet both companions are gone: dropped, off the scene
    const types = seen.map((ev) => ev.type);
    expect(types).toContain('labJoin');
    expect(types).not.toContain('sell');
    expect(dropped.slice().sort()).toEqual([ruri.uid, hana.uid].sort());
    expect(drawn()).toEqual([name('doll', yoriko), name('kon', partner), name('kon', far)].sort());
    expect(c.has(ruri.uid) || c.has(hana.uid)).toBe(false);
    expect(c.konAt(ruri.uid)).toBe(null);
    expect(c.probe().actors.map((r) => r.uid).sort((a, b) => a - b)).toEqual([yoriko.uid, partner.uid, far.uid].sort((a, b) => a - b));
    // a late event about a girl who joined (an attack drained in the same batch) brings nothing back
    c.handle({ type: 'attack', towerUid: ruri.uid, targetUid: -1 });
    c.handle({ type: 'attack', towerUid: hana.uid, targetUid: -1 });
    frame();
    expect(drawn()).toEqual([name('doll', yoriko), name('kon', partner), name('kon', far)].sort());

    // a sale takes the same road out
    dropped.length = 0;
    expect(sim.sellTower(far.uid)).toBeGreaterThan(0);
    frame();
    expect(seen.map((ev) => ev.type)).toContain('sell');
    expect(dropped).toEqual([far.uid]);
    expect(drawn()).toEqual([name('doll', yoriko), name('kon', partner)].sort());

    // the companions who stay are still drawn a few frames on
    for (let i = 0; i < 5; i++) frame();
    expect(drawn()).toEqual([name('doll', yoriko), name('kon', partner)].sort());
    expect(c.probe().actors.every((r) => r.visible)).toBe(true);
  });

  test('a joined girl\'s actor goes in the very frame she leaves, whatever the event order (the renderer reads sim.towers)', async () => {
    const sim = mk();
    const tenka = place(sim, 'tenka', ...AT);
    for (let i = 0; i < 2; i++) expect(sim.upgradeTower(tenka.uid, LAB)).toBe(true);
    const ruri = place(sim, 'ruri', 9.5, 3.4);
    const { c, frame, drawn } = await board(sim);
    frame();
    expect(c.has(ruri.uid)).toBe(true);
    // the join happens between two frames; nothing is drained or handled before the next update
    expect(sim.upgradeTower(tenka.uid, LAB)).toBe(true);
    c.update(1 / 60);
    expect(c.has(ruri.uid)).toBe(false);
    expect(drawn()).toEqual([]);
    frame();
    expect(drawn()).toEqual([]);
  });
});
