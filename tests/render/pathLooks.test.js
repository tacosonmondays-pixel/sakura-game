// Path looks (docs/specs/path-looks.md): the layer rules, the pip layout, the catalog against its GLB files, and the
// promise that the whole feature is display only (the sim id never sees it).
import { describe, it, expect } from 'vitest';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { pathLayers, stagePieces, pipAngles, pieceCalls, LOOK_TIERS } from '../../src/render/pathLooks/rules.js';
import { PATH_LOOKS, SKIN_LOOKS, pathLooksFor, pieceFile } from '../../src/render/pathLooks/catalog.js';
import { SKINS } from '../../src/data/skins.js';
import { heroLookTiers } from '../../src/sim/hero.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { simId } from '../../tools/simId.mjs';

/** Node names in a GLB's JSON chunk. */
function glbNodes(file) {
  const b = readFileSync(file);
  const len = b.readUInt32LE(12);
  const js = JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
  return { names: new Set((js.nodes || []).map((n) => n.name)), extras: js.asset?.extras || {} };
}

describe('path looks: layers', () => {
  it('0-0-0 shows pips only', () => {
    const L = pathLayers([0, 0, 0]);
    expect(L.tiers).toEqual([0, 0, 0]);
    expect(L.glows).toEqual([]);
    expect(L.pieces).toEqual([]);
    expect(L.aura).toEqual([]);
    expect(L.key).toBe('');
  });

  it('T1–T2: hand glows, the leading path at the weapon hand', () => {
    expect(pathLayers([1, 2, 0]).glows).toEqual([{ path: 1, tier: 2, hand: 'weapon' }, { path: 0, tier: 1, hand: 'off' }]);
    expect(pathLayers([2, 0, 2]).glows.map((g) => g.path)).toEqual([0, 2]); // a tie: the lower path leads
  });

  it('T3+: one piece for a girl, her committed path; the other path keeps its glow', () => {
    const L = pathLayers([3, 2, 0]);
    expect(L.pieces).toEqual([{ path: 0, tier: 3 }]);
    expect(L.glows).toEqual([{ path: 1, tier: 2, hand: 'weapon' }]);
    expect(pathLayers([2, 0, 5]).pieces).toEqual([{ path: 2, tier: 5 }]);
    expect(pathLayers([0, 4, 2]).pieces).toEqual([{ path: 1, tier: 4 }]);
  });

  it('T5: a capstone aura in that path', () => {
    expect(pathLayers([5, 2, 0]).aura).toEqual([0]);
    expect(pathLayers([4, 2, 0]).aura).toEqual([]);
  });

  it('heroes wear every path at T3+ at once (multi), with every capstone in the aura', () => {
    const luna = UNIT_MAP.luna;
    const lv25 = heroLookTiers(luna, 25);
    expect(lv25).toEqual([5, 5, 5]);
    const L = pathLayers(lv25, { multi: true });
    expect(L.pieces.map((p) => p.path)).toEqual([0, 1, 2]);
    expect(L.aura).toEqual([0, 1, 2]);
    // Lv 10: lances 2, gravity 2, court 3 → only the court piece
    const L10 = pathLayers(heroLookTiers(luna, 10), { multi: true });
    expect(L10.pieces).toEqual([{ path: 2, tier: 3 }]);
  });

  it('the rebuild key only changes with what models show', () => {
    expect(pathLayers([3, 1, 0]).key).toBe(pathLayers([3, 2, 0]).key);
    expect(pathLayers([3, 0, 0]).key).not.toBe(pathLayers([4, 0, 0]).key);
  });

  it('a stage the catalog leaves out falls back to the one below', () => {
    const row = { t3: [{ piece: 'a' }], t5: [{ piece: 'c' }] };
    expect(stagePieces(row, 2)).toBe(null);
    expect(stagePieces(row, 3)[0].piece).toBe('a');
    expect(stagePieces(row, 4)[0].piece).toBe('a');
    expect(stagePieces(row, 5)[0].piece).toBe('c');
    expect(LOOK_TIERS).toEqual({ glow: 1, piece: 3, escalate: 4, capstone: 5 });
  });
});

describe('path looks: pip gauge', () => {
  it('sits on the side facing the camera: path 0 on the left, path 1 in front, path 2 on the right', () => {
    for (const yaw of [0, Math.PI / 2, -2.1]) {
      const a = pipAngles(yaw);
      const front = Math.atan2(Math.cos(yaw), Math.sin(yaw));
      const toCam = [Math.cos(front), Math.sin(front)];
      expect(a).toHaveLength(3);
      for (const row of a) {
        expect(row).toHaveLength(5);
        // every pip on the camera's half of the ring
        for (const t of row) expect(Math.cos(t) * toCam[0] + Math.sin(t) * toCam[1]).toBeGreaterThan(0);
      }
      // screen right is (cos yaw, -sin yaw) on the ground: path 0's middle pip left of path 1's, path 2's right of it
      const right = (t) => Math.cos(t) * Math.cos(yaw) - Math.sin(t) * Math.sin(yaw);
      expect(right(a[0][2])).toBeLessThan(right(a[1][2]));
      expect(right(a[2][2])).toBeGreaterThan(right(a[1][2]));
      // tier 1 is each gauge's leftmost pip
      expect(right(a[1][0])).toBeLessThan(right(a[1][4]));
    }
  });
});

describe('path looks: catalog and pieces', () => {
  const units = Object.keys(PATH_LOOKS);

  it('covers the Phase 1 prototype girls and rollout batches 1–2, three paths each', () => {
    expect([...units].sort()).toEqual(['akane', 'aoi', 'hikari', 'kage', 'luna', 'midori', 'momo', 'nami', 'raika', 'rei', 'sango', 'shiro', 'suzu', 'umeko', 'yuki']);
    for (const id of units) {
      expect(UNIT_MAP[id]).toBeTruthy();
      expect(pathLooksFor(id).paths).toHaveLength(3);
      for (const p of pathLooksFor(id).paths) {
        expect(p.t3?.length).toBeGreaterThan(0);
        expect(p.t5?.length).toBeGreaterThan(0);
      }
    }
    expect(pathLooksFor('miko')).toBe(null);
  });

  it('every piece exists in its file, every file stays under 60 KB, every socket is a rig bone', () => {
    const BONES = new Set(['root', 'hips', 'spine', 'chest', 'neck', 'head', 'hand_L', 'hand_R']);
    for (const id of units) {
      if (pathLooksFor(id).weaponHand) expect(BONES.has(pathLooksFor(id).weaponHand)).toBe(true);
      pathLooksFor(id).paths.forEach((p, i) => {
        const file = `public/models/pathlooks/${pieceFile(id, i)}.glb`;
        expect(existsSync(file), file).toBe(true);
        expect(statSync(file).size, file).toBeLessThanOrEqual(60 * 1024);
        const { names, extras } = glbNodes(file);
        expect(extras.unit).toBe(id);
        for (const stage of ['t3', 't4', 't5']) {
          for (const e of p[stage] || []) {
            expect(names.has(e.piece), `${file} ${e.piece}`).toBe(true);
            expect(BONES.has(e.bone), e.bone).toBe(true);
            expect(e.at).toHaveLength(3);
            expect(e.rot).toHaveLength(3);
          }
        }
      });
    }
  });

  it('triangle budget: a T3 stage ≤ 650 triangles, a T5 stage ≤ 1,400 (before outlines)', () => {
    for (const id of units) {
      pathLooksFor(id).paths.forEach((p, i) => {
        const { extras } = glbNodes(`public/models/pathlooks/${pieceFile(id, i)}.glb`);
        const tris = (stage) => (p[stage] || []).reduce((n, e) => n + (extras.triangles?.[e.piece] || 0), 0);
        expect(tris('t3'), `${id} p${i} t3`).toBeLessThanOrEqual(650);
        expect(tris('t5'), `${id} p${i} t5`).toBeLessThanOrEqual(1400);
      });
    }
  });

  it('outfit rows: only real skins of that girl, and they fall back to her default row', () => {
    for (const [skinId, row] of Object.entries(SKIN_LOOKS)) {
      const skin = SKINS.find((k) => k.id === skinId);
      expect(skin, skinId).toBeTruthy();
      const base = pathLooksFor(skin.unitId);
      const r = pathLooksFor(skin.unitId, skinId);
      expect(r).not.toBe(base);
      for (let i = 0; i < 3; i++) {
        for (const st of ['t3', 't4', 't5']) expect(r.paths[i][st]).toBe(row.paths?.[i]?.[st] || base.paths[i][st]);
      }
    }
    // Sentinel Akane (no witch hat): her pinwheel moves off the hat band
    expect(pathLooksFor('akane', 'akane_sentinel').paths[0].t3[0].at).not.toEqual(pathLooksFor('akane').paths[0].t3[0].at);
    expect(pathLooksFor('akane', 'aoi_sentinel')).toBe(pathLooksFor('akane'));
  });

  it('draw calls (r1 MEDIUM-1, r2 LOW-2): per girl ≤ 2 on low (heroes ≤ 3), whatever she wears; boards ≤ 16', () => {
    const wears = (id, tiers) => {
      const row = pathLooksFor(id);
      const L = pathLayers(tiers, { multi: UNIT_MAP[id].kind === 'hero' });
      return L.pieces.flatMap((p) => stagePieces(row.paths[p.path], p.tier) || []);
    };
    const T5 = [[5, 2, 0], [2, 0, 5], [0, 5, 2]];
    for (const id of units) {
      const hero = UNIT_MAP[id].kind === 'hero';
      for (const t of hero ? [[5, 5, 5], [3, 3, 3], [4, 4, 4], [5, 3, 0]] : [...T5, [3, 0, 0], [0, 4, 0], [0, 0, 4]]) {
        const entries = wears(id, t);
        expect(entries.length, `${id} ${t.join('-')} wears something`).toBeGreaterThan(0);
        expect(pieceCalls(entries), `${id} ${t.join('-')}`).toBeLessThanOrEqual(hero ? 3 : 2);
        expect(pieceCalls(entries), `${id} ${t.join('-')}: one merged mesh`).toBe(1);
        expect(pieceCalls(entries, { hulls: true }), `${id} ${t.join('-')} with hulls`).toBeLessThanOrEqual(hero ? 6 : 4);
      }
    }
    // the boards of e2e/path-looks.mjs --only perf: six Aoi + six Akane at T5 (review r1), and the rollout girls at T5
    // (review r2: Rei, Yuki, Momo, Kage three each)
    const board = (ids) => ids.reduce((n, id, i) => n + pieceCalls(wears(id, T5[i % 3])), 0);
    expect(board(Array.from({ length: 12 }, (_, i) => (i % 2 ? 'akane' : 'aoi')))).toBeLessThanOrEqual(16);
    expect(board(Array.from({ length: 12 }, (_, i) => ['rei', 'yuki', 'momo', 'kage'][i % 4]))).toBeLessThanOrEqual(16);
  });

  it('is display only: no file of the sim id reads it', () => {
    const { files } = simId();
    expect(files.some((f) => f.includes('pathLooks') || f.includes('pathlooks'))).toBe(false);
  });
});
