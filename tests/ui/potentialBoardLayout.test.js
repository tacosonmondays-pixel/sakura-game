// The Potential Board's layout (src/ui/potentialBoard/layout.js; docs/specs/POTENTIAL_BOARD.md): every girl resolves a
// board, every point sits in the 100 x 64 box, the route follows the level rule, and at the phone box (844 x 390: the
// board drawn 372 x 238) every node centre is 44 px or more from every other one, every hit target is a whole 44 px
// circle, and labels and her token keep 2 px clear of everything. Display only.
import { describe, test, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOX, FAMILIES, VARIANTS, PHONE_BOX, DESKTOP_BOX, UPRIGHT_BOX, MIN_SCALE, HIT_R, CLEAR_PX, ROUTE, LR_BAND, SELS,
  bandOfLevel, boardHash, boardPick, boardFor, routeAt, boardLights, fitBox, boardPixels, hitTargets, hitAt, labelsAll,
  placeLabels, placeToken, boardIssues, gateSel,
} from '../../src/ui/potentialBoard/layout.js';
import { POTENTIAL_BOARDS, CLASS_FAMILY, FALLBACK_BOARD } from '../../src/data/potentialBoards.js';
import { POTENTIAL_TEXT } from '../../src/data/potentialText.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { GATE_CAPS, MAX_LEVEL, MAX_BREAKTHROUGH, gatePotential } from '../../src/systems/progression.js';

const BOXES = { phone: PHONE_BOX, desktop: DESKTOP_BOX, upright: UPRIGHT_BOX };
/** A girl with an LR step (none ships yet; the first duo will). */
const LR_GIRL = { id: 'lr-test', role: 'duelist', kind: 'tower', rarity: 'LR' };
/** Every layout the game can draw: family x variant x mirror, with and without the LR crest point. */
const LAYOUTS = FAMILIES.flatMap((family) => Array.from({ length: VARIANTS }, (_, variant) => [false, true].flatMap((mirror) => [false, true]
  .map((lr) => ({ family, variant, mirror, lr, name: `${family} ${variant}${mirror ? ' mirrored' : ''}${lr ? ' LR' : ''}` })))));
const layoutBoard = (l) => boardFor({ id: `layout-${l.family}` }, l);

const rectDist = (c, r) => Math.hypot(Math.max(r.x - c.x, 0, c.x - (r.x + r.w)), Math.max(r.y - c.y, 0, c.y - (r.y + r.h)));
const rectsGap = (a, b) => Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), a.y - (b.y + b.h), b.y - (a.y + a.h));
/** Every circle a label or the token keeps clear of (px). */
const solids = (b, box) => {
  const px = boardPixels(b, box);
  return [...px.nodes, ...px.gates, px.end, ...(px.crest ? [px.crest] : []), ...(px.socket ? [px.socket] : [])];
};

describe('Potential Board layout', () => {
  test('every girl, a new girl of any class and an unknown id resolve a board: six nodes, the ring, ten gates', () => {
    for (const u of UNITS) {
      const b = boardFor(u);
      const row = POTENTIAL_BOARDS[u.id];
      expect([b.family, b.variant, b.mirror, b.hue, b.emblem], u.id).toEqual([row.family, row.variant, row.mirror, row.hue, row.emblem]);
      expect(b.nodes.map((n) => n.sel), u.id).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
      expect(b.end.sel).toBe('end');
      expect(b.end.level).toBe(MAX_LEVEL);
      expect(b.crest, u.id).toBe(null);
      expect(b.gates.map((g) => g.gate), u.id).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(b.bands.map((x) => x.band)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(b.problems, u.id).toEqual([]);
    }
    const pick = boardPick('zz-new-girl');
    const fresh = boardFor({ id: 'zz-new-girl', role: 'sniper', kind: 'tower' });
    expect([fresh.family, fresh.variant, fresh.mirror]).toEqual([CLASS_FAMILY.sniper, pick.variant, pick.mirror]);
    const unknown = boardFor({ id: 'zz-unknown' });
    expect(unknown.family).toBe(FALLBACK_BOARD.family);
    expect(unknown.nodes).toHaveLength(6);
    for (const def of [null, undefined, {}]) expect(boardFor(def).nodes).toHaveLength(6);
  });

  test('LR units end in the crest point after the ring (band 7: no gates, no levels)', () => {
    const b = boardFor(LR_GIRL);
    expect(b.lr).toBe(true);
    expect(b.crest).toMatchObject({ sel: 'lr' });
    const last = b.bands[b.bands.length - 1];
    expect([last.band, last.from, last.to, last.gates]).toEqual([LR_BAND.band, 'end', 'lr', []]);
    for (const u of UNITS) expect(boardFor(u, { lr: true }).crest, u.id).toMatchObject({ sel: 'lr' });
  });

  test('every point is inside the 100 x 64 box: nodes, the ring, the crest, the socket, gates, dots, paths, structure', () => {
    const inside = (x, y) => x >= 0 && x <= BOX.w && y >= 0 && y <= BOX.h;
    for (const l of LAYOUTS) {
      const b = layoutBoard(l);
      const pts = [...b.nodes, b.end, b.socket, ...(b.crest ? [b.crest] : []), ...b.gates, ...b.dots].map((o) => [o.x, o.y]);
      pts.push(...b.bands.flatMap((x) => x.pts));
      for (const d of b.deco) {
        if (d.pts) pts.push(...d.pts);
        if (d.kind === 'ellipse') pts.push([d.cx - d.rx, d.cy - d.ry], [d.cx + d.rx, d.cy + d.ry]);
        if (d.kind === 'rect') pts.push([d.x, d.y], [d.x + d.w, d.y + d.h]);
      }
      for (const [x, y] of pts) expect(inside(x, y), `${l.name}: (${x}, ${y})`).toBe(true);
    }
  });

  test('the phone box is the documented 844 x 390 board: 372 wide at 3.72 px a unit (the board 372 x 238), where 44 px is 11.83 units', () => {
    expect(PHONE_BOX).toEqual({ w: 372, h: 240 });
    expect(fitBox(PHONE_BOX).scale).toBeCloseTo(MIN_SCALE, 5);
    for (const box of Object.values(BOXES)) expect(fitBox(box).scale).toBeGreaterThanOrEqual(MIN_SCALE);
    expect(HIT_R * 2).toBe(44);
  });

  test('at 844 x 390 every node centre is at least 44 px from every other node (the ring and the crest too)', () => {
    for (const l of LAYOUTS) {
      const px = boardPixels(layoutBoard(l), PHONE_BOX);
      const stations = [...px.nodes, px.end, ...(px.crest ? [px.crest] : [])];
      for (let i = 0; i < stations.length; i++) {
        for (let j = i + 1; j < stations.length; j++) {
          const d = Math.hypot(stations[i].x - stations[j].x, stations[i].y - stations[j].y);
          expect(d, `${l.name}: ${stations[i].sel} - ${stations[j].sel}`).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });

  test('every hit target is a whole 44 px circle: never overlapping another item, inside the box, at every checked size', () => {
    for (const l of LAYOUTS) {
      const b = layoutBoard(l);
      for (const [size, box] of Object.entries(BOXES)) {
        const hits = hitTargets(b, box);
        expect(hits.length).toBe(6 + 10 + 1 + (l.lr ? 1 : 0));
        for (const t of hits) {
          expect(t.r * 2, `${l.name} ${size} ${t.sel}`).toBeGreaterThanOrEqual(44);
          expect(SELS).toContain(t.sel);
        }
        for (let i = 0; i < hits.length; i++) {
          for (let j = i + 1; j < hits.length; j++) {
            if (hits[i].sel === hits[j].sel) continue;
            const d = Math.hypot(hits[i].x - hits[j].x, hits[i].y - hits[j].y);
            expect(d, `${l.name} ${size}: ${hits[i].sel} / ${hits[j].sel}`).toBeGreaterThanOrEqual(hits[i].r + hits[j].r);
          }
        }
        expect(boardIssues(b, box), `${l.name} ${size}`).toEqual([]);
      }
    }
  });

  test('a tap finds the item under it: each node, each gate (gates 1-5 answer g15), the ring; empty plate is null', () => {
    const b = boardFor(UNIT_MAP.aoi);
    const px = boardPixels(b, PHONE_BOX);
    for (const n of px.nodes) expect(hitAt(b, PHONE_BOX, n.x + 5, n.y - 5)).toBe(n.sel);
    for (const g of px.gates) expect(hitAt(b, PHONE_BOX, g.x, g.y)).toBe(gateSel(g.gate));
    expect(hitAt(b, PHONE_BOX, px.end.x, px.end.y)).toBe('end');
    expect(hitAt(b, PHONE_BOX, -50, -50)).toBe(null);
  });

  test('phones label only the next node; a roomy box labels all six', () => {
    expect(labelsAll(PHONE_BOX)).toBe(false);
    expect(labelsAll(UPRIGHT_BOX)).toBe(false);
    expect(labelsAll(DESKTOP_BOX)).toBe(true);
    for (const u of UNITS) {
      const b = boardFor(u);
      for (const next of [2, 3, 4, 5, 6]) expect(placeLabels(b, PHONE_BOX, { next }).labels.map((l) => l.sel), u.id).toEqual([`p${next}`]);
      expect(placeLabels(b, PHONE_BOX, { next: null }).labels).toEqual([]);
      expect(placeLabels(b, DESKTOP_BOX, { next: 5 }).labels.map((l) => l.sel), u.id).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
    }
  });

  test('labels and her token keep 2 px clear of nodes, gates, the ring, the crest, the socket and each other', () => {
    const levels = [1, 5, 10, 11, 20, 33, 48, 50, 51, 60, 61, 63, 64, 67, 68, 72, 73, 78, 79, 84, 85];
    const girls = [...UNITS, LR_GIRL];
    for (const def of girls) {
      const b = boardFor(def);
      for (const [size, box] of Object.entries(BOXES)) {
        const all = labelsAll(box);
        const sol = solids(b, box);
        for (const next of all ? [2] : [2, 3, 4, 5, 6, null]) {
          const text = (k) => POTENTIAL_TEXT[def.id]?.[k - 2]?.node || 'MIDSUMMER';
          const { labels, dropped } = placeLabels(b, box, { next, text });
          const where = `${def.id} ${size} next P${next}`;
          expect(dropped, where).toEqual([]);
          for (const l of labels) {
            expect(l.x >= 0 && l.y >= 0 && l.x + l.w <= box.w && l.y + l.h <= box.h, `${where} ${l.sel} inside`).toBe(true);
            for (const c of sol) expect(rectDist(c, l), `${where}: label ${l.sel} vs ${c.sel}`).toBeGreaterThanOrEqual(c.r + CLEAR_PX);
          }
          for (let i = 0; i < labels.length; i++) {
            for (let j = i + 1; j < labels.length; j++) expect(rectsGap(labels[i], labels[j]), `${where}: labels`).toBeGreaterThanOrEqual(CLEAR_PX);
          }
          for (const level of levels) {
            const t = placeToken(b, box, { level, labels });
            const w2 = `${where} LV ${level}`;
            expect(t.crowded, w2).toBeUndefined();
            expect(t.x - t.r >= 0 && t.y - t.r >= 0 && t.x + t.r <= box.w && t.y + t.r <= box.h, `${w2} inside`).toBe(true);
            for (const c of sol) expect(Math.hypot(c.x - t.x, c.y - t.y), `${w2}: token vs ${c.sel}`).toBeGreaterThanOrEqual(c.r + t.r + CLEAR_PX);
            for (const l of labels) expect(rectDist(t, l), `${w2}: token vs label`).toBeGreaterThanOrEqual(t.r + CLEAR_PX);
          }
        }
      }
    }
  });

  test("any node's label fits, even the longest step name (9 characters), at every checked size", () => {
    for (const l of LAYOUTS.filter((x) => x.lr)) {
      const b = layoutBoard(l);
      for (const [size, box] of Object.entries(BOXES)) {
        for (const next of [2, 3, 4, 5, 6]) {
          expect(placeLabels(b, box, { next, text: () => 'MIDSUMMER' }).dropped, `${l.name} ${size} P${next}`).toEqual([]);
        }
      }
    }
  });

  test('the route follows the level rule: bands cover LV 1-85 with no gap; gate k from 6 sits after P(k - 4)', () => {
    expect(ROUTE.map((b) => [b.lo, b.hi])).toEqual([[1, 60], [61, 63], [64, 67], [68, 72], [73, 78], [79, 85]]);
    for (let i = 1; i < ROUTE.length; i++) expect(ROUTE[i].lo).toBe(ROUTE[i - 1].hi + 1);
    expect(ROUTE[0].lo).toBe(1);
    expect(ROUTE[ROUTE.length - 1].hi).toBe(MAX_LEVEL);
    expect(ROUTE[0].gates).toEqual([1, 2, 3, 4, 5]);
    for (const b of ROUTE.slice(1)) {
      expect(b.gates).toHaveLength(1);
      expect(b.from).toBe(`p${gatePotential(b.gates[0])}`); // gate k needs P(k - 4): it comes right after that node
      expect(b.hi).toBe(GATE_CAPS[b.gates[0]]);
    }
    for (let lv = 1; lv <= MAX_LEVEL; lv++) expect(ROUTE.filter((b) => lv >= b.lo && lv <= b.hi).map((b) => b.band)).toEqual([bandOfLevel(lv)]);
    for (const l of LAYOUTS) {
      const b = layoutBoard(l);
      // each level is told by exactly one mark: a ten-level dot (1-60), a level dot (61-84) or the ring (85)
      const covered = new Map();
      for (const d of b.dots) for (let lv = d.lo; lv <= d.hi; lv++) covered.set(lv, (covered.get(lv) || 0) + 1);
      covered.set(MAX_LEVEL, (covered.get(MAX_LEVEL) || 0) + 1);
      for (let lv = 1; lv <= MAX_LEVEL; lv++) expect(covered.get(lv), `${l.name} LV ${lv}`).toBe(1);
      for (const g of b.gates) {
        expect([g.sel, g.cap, g.needP]).toEqual([gateSel(g.gate), GATE_CAPS[g.gate], gatePotential(g.gate)]);
        expect(b.bands.find((x) => x.band === g.band).gates).toContain(g.gate);
      }
    }
  });

  test('her route point walks forward with her level and ends on the ring at LV 85', () => {
    for (const l of LAYOUTS.filter((x) => !x.lr)) {
      const b = layoutBoard(l);
      let last = { band: 0, s: -1 };
      for (let lv = 1; lv <= MAX_LEVEL; lv++) {
        const p = routeAt(b, lv);
        expect(p.band).toBe(bandOfLevel(lv));
        if (p.band === last.band) expect(p.s, `${l.name} LV ${lv}`).toBeGreaterThan(last.s);
        else expect(p.band).toBe(last.band + 1);
        last = p;
      }
      expect(routeAt(b, MAX_LEVEL)).toMatchObject({ x: b.end.x, y: b.end.y });
      expect(routeAt(b, 999)).toEqual(routeAt(b, MAX_LEVEL));
      expect(routeAt(b, -3)).toEqual(routeAt(b, 1));
    }
  });

  test('what is lit: nodes from her Potential, gates from her breakthroughs, dots from her level', () => {
    const b = boardFor(UNIT_MAP.aoi);
    // Aoi at P4, LV 48, 4 gates: "P4 but behind on gates"
    const s = boardLights(b, { p: 4, gates: 4, level: 48 });
    expect(s.nodes).toEqual({ p1: true, p2: true, p3: true, p4: true, p5: false, p6: false });
    expect(Object.entries(s.gates).filter(([, on]) => on).map(([g]) => Number(g))).toEqual([1, 2, 3, 4]);
    expect(s.next).toBe('p5');
    expect(s.end).toBe(false);
    expect(s.bands).toMatchObject({ 1: true, 2: true, 3: true, 4: false, 5: false, 6: false });
    expect(b.dots.filter((d, i) => s.dots[i]).map((d) => d.level)).toEqual([10, 20, 30, 40]);
    const top = boardLights(b, { p: 6, gates: MAX_BREAKTHROUGH, level: MAX_LEVEL });
    expect(Object.values(top.nodes).every(Boolean) && Object.values(top.gates).every(Boolean) && top.dots.every(Boolean)).toBe(true);
    expect([top.end, top.next, top.lr]).toEqual([true, null, false]);
    const lr = boardFor(LR_GIRL);
    expect(boardLights(lr, { p: 6, gates: 10, level: 85, lrDone: true })).toMatchObject({ lr: true, bands: { 7: true } });
  });

  test('variant and mirror come from a stable hash of her id; the data table holds those picks', () => {
    expect(boardHash('aoi')).toBe(boardHash('aoi'));
    expect(boardHash('aoi')).not.toBe(boardHash('aoj'));
    expect(boardHash('aoi')).toBe(2813190276); // pinned: a change here would move every girl's Board
    for (const u of UNITS) {
      const row = POTENTIAL_BOARDS[u.id];
      expect(boardPick(u.id), u.id).toEqual({ variant: row.variant, mirror: row.mirror });
    }
    // the hash spreads: every family uses at least two of its layouts
    for (const f of FAMILIES) {
      const used = new Set(UNITS.filter((u) => POTENTIAL_BOARDS[u.id].family === f).map((u) => `${POTENTIAL_BOARDS[u.id].variant}${POTENTIAL_BOARDS[u.id].mirror}`));
      expect(used.size, f).toBeGreaterThanOrEqual(2);
    }
    // the review set's two spear girls get different boards
    expect([boardFor(UNIT_MAP.aoi).variant, boardFor(UNIT_MAP.aoi).mirror]).not.toEqual([boardFor(UNIT_MAP.kaede).variant, boardFor(UNIT_MAP.kaede).mirror]);
  });

  test('a mirrored board is the same board flipped left to right; boards are the same every time', () => {
    for (const family of FAMILIES) {
      for (let variant = 0; variant < VARIANTS; variant++) {
        const a = boardFor({ id: 'm' }, { family, variant, mirror: false, lr: true });
        const b = boardFor({ id: 'm' }, { family, variant, mirror: true, lr: true });
        a.nodes.forEach((n, i) => {
          expect(b.nodes[i].x).toBeCloseTo(BOX.w - n.x, 1);
          expect(b.nodes[i].y).toBeCloseTo(n.y, 1);
        });
        expect(b.crest.x).toBeCloseTo(BOX.w - a.crest.x, 1);
        expect(JSON.stringify(boardFor({ id: 'm' }, { family, variant, mirror: false, lr: true }))).toBe(JSON.stringify(a));
      }
    }
  });

  test("none of the Board's forbidden words in its files (code, comments, the spec, these tests)", () => {
    // sha-256 (first 16 hex) of the whole words, and two stems as char codes, so this file never spells them
    const BANNED = new Set(['d66a93cd9ae701f7', 'c34ce311989d8bf0', '5d72436256ada538', '5600ae99b14ef8e5', '8535e86c8118bbbb',
      'b1fabb5fd9d6c42c', '4f164a7a34ecc3d6', 'a57a07cb258093b2', '98ef876771dec922', 'a138f4357b3a2767', '3046f751cdc6f2eb',
      'ff8fff1691f9fd88', 'ef83ad02ddf4d480', 'ca76bed0d023b536', '17493275e0fb8194', '02f5f0a9b7e47af7', 'efb9150097e0e19e',
      '9a258f0a0a2c0191', '9492f440b2cd46fc', '0b6f395ca14ac202', 'e259202cf023eab7', '9ecf431bb9a48b0e', '000060f869832929']);
    const STEMS = [[115, 105, 103, 110], [99, 111, 110, 115, 116, 101, 108, 108, 97, 116, 105, 111, 110]].map((c) => String.fromCharCode(...c));
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const dir = join(root, 'src/ui/potentialBoard');
    const files = [
      ...readdirSync(dir).map((f) => join(dir, f)),
      join(root, 'src/data/potentialBoards.js'),
      join(root, 'docs/specs/POTENTIAL_BOARD.md'),
      join(root, 'tests/ui/potentialBoardLayout.test.js'),
      join(root, 'tests/ui/growth.test.js'),
      join(root, 'tests/data/potentialBoards.test.js'),
    ];
    const hits = [];
    for (const f of files) {
      expect(existsSync(f), f).toBe(true);
      const text = readFileSync(f, 'utf8').toLowerCase();
      for (const s of STEMS) if (text.includes(s)) hits.push(`${f}: a forbidden stem`);
      for (const w of text.match(/[a-z]+/g) || []) {
        if (BANNED.has(createHash('sha256').update(w).digest('hex').slice(0, 16))) hits.push(`${f}: a forbidden word`);
      }
    }
    expect(hits).toEqual([]);
  });
});
