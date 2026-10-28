// Free placement: continuous positions, circular footprints, path band,
// obstacles, terrain under the centre, overlap, legacy tile wrappers and autoPlan.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { autoPlan, runHeadless } from '../../src/sim/headless.js';
import { buildPaths } from '../../src/sim/path.js';
import {
  createPlacementRules, footprintRadius, footprintAt, isTileCall, TOWER_RADIUS, HERO_RADIUS, PATH_HALF_WIDTH, TREE_RADIUS,
} from '../../src/sim/placement.js';
import { makeSim, testData, MAP, UNITS, STAGE } from './fixtures.js';

// Fixture map (16 × 9): path along row 4 (centre line y = 4.5), water at x 4-7 / y 1-2,
// trees at (11,2) (12,2), rocks at (5,6) (6,6), flowers row 7, void row 8.
const PATH_Y = 4.5;
const TOWER_BAND = PATH_HALF_WIDTH + TOWER_RADIUS; // 0.97
const HERO_BAND = PATH_HALF_WIDTH + HERO_RADIUS; // 1.05

describe('geometry constants', () => {
  test('radii and band', () => {
    expect(TOWER_RADIUS).toBe(0.42);
    expect(HERO_RADIUS).toBe(0.5);
    expect(PATH_HALF_WIDTH).toBe(0.55);
    expect(footprintRadius(UNITS.archer)).toBe(0.42);
    expect(footprintRadius(UNITS.heroine)).toBe(0.5);
    expect(footprintRadius({ kind: 'tower', footprint: 0.6 })).toBe(0.6);
    expect(footprintRadius(null)).toBe(0.42);
    expect(isTileCall(3, 4)).toBe(true);
    expect(isTileCall(3.5, 4)).toBe(false);
    expect(isTileCall(3, 4.5)).toBe(false);
  });
});

describe('placement rules (pure geometry)', () => {
  const rules = createPlacementRules(MAP, buildPaths(MAP));

  test('path distance is the distance to the polyline through tile centres', () => {
    expect(rules.pathDistance(3, 4.5)).toBeCloseTo(0, 9);
    expect(rules.pathDistance(3, 2.5)).toBeCloseTo(2, 9);
    expect(rules.pathDistance(7.25, 6.1)).toBeCloseTo(1.6, 9);
    // the path extends off-map to the spawn / exit waypoints
    expect(rules.pathDistance(-0.5, 5.5)).toBeCloseTo(1, 9);
  });

  test('path band: footprint edge must clear PATH_HALF_WIDTH', () => {
    // towers: centre at exactly 0.97 from the centre line is legal, a hair closer is not
    expect(rules.check(UNITS.archer, 3, PATH_Y - TOWER_BAND, [])).toBe(null);
    expect(rules.check(UNITS.archer, 3, PATH_Y - TOWER_BAND + 0.01, [])).toBe('path');
    expect(rules.check(UNITS.archer, 3, PATH_Y + TOWER_BAND, [])).toBe(null);
    expect(rules.check(UNITS.archer, 3, PATH_Y + TOWER_BAND - 0.01, [])).toBe('path');
    // heroes are wider → the adjacent tile centre (1.0 away) is too close
    expect(rules.check(UNITS.heroine, 3, PATH_Y - 1.0, [])).toBe('path');
    expect(rules.check(UNITS.heroine, 3, PATH_Y - HERO_BAND, [])).toBe(null);
    // on the path itself
    expect(rules.check(UNITS.archer, 3.3, 4.6, [])).toBe('path');
  });

  test('obstacles: trees are discs, rocks and void are tile squares', () => {
    // tree at (11,2): centre (11.5, 2.5), radius 0.45 → footprint 0.42 needs 0.87 of clearance
    expect(rules.obstacleDistance(11.5, 2.5)).toBe(0);
    expect(rules.obstacleDistance(11.5, 1.2)).toBeCloseTo(1.3 - TREE_RADIUS, 9);
    expect(rules.check(UNITS.archer, 11.5, 2.5 - 0.87 + 0.01, [])).toBe('blocked');
    expect(rules.check(UNITS.archer, 11.5, 2.5 - 0.87 - 0.001, [])).toBe(null);
    // tree tile corners are inside the disc + footprint too
    expect(rules.check(UNITS.archer, 11.05, 2.05, [])).toBe('blocked');
    // rock at (5,6): square [5,6]×[6,7]
    expect(rules.obstacleDistance(4.5, 6.5)).toBeCloseTo(0.5, 9);
    expect(rules.obstacleDistance(5.5, 5.5)).toBeCloseTo(0.5, 9);
    expect(rules.obstacleDistance(4.5, 5.5)).toBeCloseTo(Math.SQRT1_2, 9); // nearest point is the corner (5,6)
    expect(rules.obstacleDistance(4.4, 5.6)).toBeCloseTo(Math.hypot(0.6, 0.4), 9);
    expect(rules.check(UNITS.archer, 4.7, 6.5, [])).toBe('blocked'); // 0.3 clear < 0.42
    expect(rules.check(UNITS.archer, 4.5, 6.5, [])).toBe(null); // 0.5 clear ≥ 0.42: hugging a rock is fine
    // void row 8: square tiles
    expect(rules.check(UNITS.archer, 2.5, 7.7, [])).toBe('blocked');
    expect(rules.check(UNITS.archer, 2.5, 7.5, [])).toBe(null);
  });

  test('terrain under the CENTRE decides water vs land; flowers are land', () => {
    expect(rules.check(UNITS.archer, 5.5, 1.5, [])).toBe('needsLand'); // water
    expect(rules.check(UNITS.boat, 5.5, 1.5, [])).toBe(null);
    expect(rules.check(UNITS.boat, 2.5, 1.5, [])).toBe('needsWater');
    expect(rules.check({ ...UNITS.archer, placement: 'amphibious' }, 5.5, 1.5, [])).toBe(null);
    expect(rules.check({ ...UNITS.archer, placement: 'amphibious' }, 2.5, 1.5, [])).toBe(null);
    expect(rules.check(UNITS.archer, 2.5, 7.5, [])).toBe(null); // ',' flowers
    // a land girl may overhang the shore: centre on land, footprint touching water
    expect(rules.check(UNITS.archer, 3.9, 1.5, [])).toBe(null);
    expect(rules.terrainAt(3.9, 1.5)).toBe('.');
    expect(rules.terrainAt(4.1, 1.5)).toBe('~');
  });

  test('out of bounds: the centre must be inside the map rectangle', () => {
    expect(rules.check(UNITS.archer, -0.01, 2, [])).toBe('outOfBounds');
    expect(rules.check(UNITS.archer, 16, 2, [])).toBe('outOfBounds');
    expect(rules.check(UNITS.archer, 2, 9, [])).toBe('outOfBounds');
    expect(rules.check(UNITS.archer, NaN, 2, [])).toBe('outOfBounds');
    expect(rules.check(UNITS.archer, 0.05, 0.05, [])).toBe(null); // edge-hugging is fine
  });

  test('overlap: footprints may touch but not intersect', () => {
    const a = { x: 2.5, y: 1.5, radius: 0.42 };
    expect(rules.check(UNITS.archer, 2.5 + 0.84, 1.5, [a])).toBe(null);
    expect(rules.check(UNITS.archer, 2.5 + 0.83, 1.5, [a])).toBe('occupied');
    expect(rules.check(UNITS.heroine, 2.5 + 0.92, 1.5, [a])).toBe(null);
    expect(rules.check(UNITS.heroine, 2.5 + 0.9, 1.5, [a])).toBe('occupied');
    // diagonal
    const d = 0.84 / Math.SQRT2;
    expect(rules.check(UNITS.archer, 2.5 + d + 0.001, 1.5 + d + 0.001, [a])).toBe(null);
    expect(rules.check(UNITS.archer, 2.5 + d - 0.01, 1.5 + d - 0.01, [a])).toBe('occupied');
  });

  test('footprintAt finds the nearest girl containing the point', () => {
    const list = [{ uid: 1, x: 2, y: 2, radius: 0.42 }, { uid: 2, x: 2.8, y: 2, radius: 0.42 }];
    expect(footprintAt(list, 2.1, 2).uid).toBe(1);
    expect(footprintAt(list, 2.5, 2).uid).toBe(2); // 0.5 from #1 (outside), 0.3 from #2
    expect(footprintAt(list, 2.37, 2).uid).toBe(1); // inside both (0.37 / 0.43 → only #1 really), nearer #1
    expect(footprintAt(list, 2.42, 2).uid).toBe(2); // inside both, nearer #2
    expect(footprintAt(list, 5, 5)).toBe(null);
  });
});

describe('Sim.canPlace / placeTower / towerAt (continuous)', () => {
  test('every reason, in order', () => {
    const sim = makeSim({ hero: 'heroine', cash: 1000 });
    expect(sim.canPlace('archer', -0.5, 2.5).reason).toBe('outOfBounds');
    expect(sim.canPlace('archer', 16.2, 2.5).reason).toBe('outOfBounds');
    expect(sim.canPlace('archer', NaN, 2.5).reason).toBe('outOfBounds');
    expect(sim.canPlace('warper', 1.5, 1.5).reason).toBe('notInLoadout');
    expect(sim.canPlace('nobody', 1.5, 1.5).reason).toBe('notInLoadout');
    expect(sim.canPlace('archer', 3.2, 3.8).reason).toBe('path');
    expect(sim.canPlace('archer', 11.3, 2.2).reason).toBe('blocked'); // tree
    expect(sim.canPlace('archer', 5.2, 6.4).reason).toBe('blocked'); // rock
    expect(sim.canPlace('archer', 1.5, 8.4).reason).toBe('blocked'); // void
    expect(sim.canPlace('archer', 5.5, 1.5).reason).toBe('needsLand');
    expect(sim.canPlace('boat', 1.5, 1.5).reason).toBe('needsWater');
    expect(sim.canPlace('boat', 5.2, 1.7)).toMatchObject({ ok: true, reason: null, cost: 200, x: 5.2, y: 1.7 });
    expect(sim.canPlace('archer', 2.3, 7.4).ok).toBe(true); // flowers
    const a = sim.placeTower('archer', 1.3, 1.6);
    expect(a).toMatchObject({ x: 1.3, y: 1.6, tx: 1, ty: 1, radius: 0.42 });
    expect(sim.canPlace('cleaver', 1.9, 1.6).reason).toBe('occupied');
    expect(sim.canPlace('cleaver', 2.2, 1.6).ok).toBe(true);
    expect(sim.towerAt(1.6, 1.8)).toBe(a);
    expect(sim.towerAt(2.0, 1.6)).toBe(null);
    const h = sim.placeTower('heroine', 2.6, 1.6);
    expect(h).toMatchObject({ isHero: true, radius: 0.5, tx: 2, ty: 1 });
    expect(sim.canPlace('heroine', 8.5, 1.5).reason).toBe('heroPlaced');
    sim.cash = 10;
    expect(sim.canPlace('archer', 8.5, 1.5)).toMatchObject({ ok: false, reason: 'cash', cost: 200 });
    expect(sim.placeTower('archer', 8.5, 1.5)).toBe(null);
  });

  test('placing spends cash, emits place with x/y and tx/ty, selling frees the spot', () => {
    const sim = makeSim({ cash: 500 });
    const t = sim.placeTower('archer', 2.3, 2.6);
    expect(sim.cash).toBe(300);
    expect(sim.drainEvents()).toContainEqual(expect.objectContaining({ type: 'place', towerUid: t.uid, unitId: 'archer', x: 2.3, y: 2.6, tx: 2, ty: 2 }));
    expect(sim.canPlace('archer', 2.5, 2.5).reason).toBe('occupied');
    sim.sellTower(t.uid);
    expect(sim.towerAt(2.3, 2.6)).toBe(null);
    sim.cash = 500;
    expect(sim.canPlace('archer', 2.5, 2.5).ok).toBe(true);
  });

  test('placementReason ignores cash, loadout and the hero rule (for the forbidden-zone overlay)', () => {
    const sim = makeSim({ hero: 'heroine', cash: 0 });
    expect(sim.placementReason('archer', 2.5, 1.5)).toBe(null);
    expect(sim.placementReason('archer', 3.2, 4.2)).toBe('path');
    expect(sim.placementReason('boat', 2.5, 1.5)).toBe('needsWater');
    sim.cash = 1000;
    sim.placeTower('heroine', 2.5, 1.5);
    expect(sim.placementReason('heroine', 8.5, 1.5)).toBe(null);
    expect(sim.placementReason('heroine', 2.9, 1.5)).toBe('occupied');
    expect(sim.placementReason('archer', 2, 1)).toBe('occupied'); // integers → tile centre (2.5, 1.5)
    expect(sim.footprintRadius('heroine')).toBe(0.5);
    expect(sim.footprintRadius('archer')).toBe(0.42);
  });

  test('cost-cut auras apply at the continuous spot', () => {
    const sim = makeSim({ cash: 10000 });
    sim.placeTower('chime', 2.5, 2.5); // aura range 3, costCut 0.1
    expect(sim.placeCost('archer', 4.9, 2.5)).toBe(180);
    expect(sim.placeCost('archer', 5.6, 2.5)).toBe(200);
    expect(sim.placeCost('archer')).toBe(200);
  });

  test('towers may stand right beside the path and next to each other', () => {
    const sim = makeSim({ cash: 100000 });
    const row = PATH_Y - TOWER_BAND; // 3.53
    const placed = [];
    for (let x = 1; x < 15; x += 0.85) {
      const t = sim.placeTower('archer', x, row);
      if (t) placed.push(t);
    }
    expect(placed.length).toBeGreaterThanOrEqual(14);
    for (const t of placed) expect(sim.towerAt(t.x, t.y)).toBe(t);
    // and they shoot
    sim.state = 'wave';
    sim.wave = 1;
    sim._spawnQueue = [];
    const e = sim.spawnEnemy('tank', { dist: 8 });
    e.baseSpeed = 0;
    for (let i = 0; i < 60; i++) sim.update(1 / 60);
    expect(e.hp).toBeLessThan(e.maxHp);
  });
});

describe('legacy tile wrappers', () => {
  test('two integers mean a tile: its centre is used', () => {
    const sim = makeSim({ hero: 'heroine', cash: 1000 });
    expect(sim.canPlace('archer', 3, 4).reason).toBe('path');
    expect(sim.canPlace('archer', 11, 2).reason).toBe('blocked');
    expect(sim.canPlace('archer', 4, 1).reason).toBe('needsLand');
    expect(sim.canPlace('boat', 4, 1)).toMatchObject({ ok: true, x: 4.5, y: 1.5 });
    expect(sim.canPlace('archer', 16, 0).reason).toBe('outOfBounds');
    const t = sim.placeTower('archer', 2, 2);
    expect(t).toMatchObject({ x: 2.5, y: 2.5, tx: 2, ty: 2 });
    expect(sim.towerAt(2, 2)).toBe(t);
    expect(sim.towerAt(2.5, 2.5)).toBe(t);
    expect(sim.towerAt(3, 2)).toBe(null);
    expect(sim.canPlace('cleaver', 2, 2).reason).toBe('occupied');
    expect(sim.canPlaceTile('cleaver', 2, 2).reason).toBe('occupied');
    expect(sim.canPlaceTile('cleaver', 2.9, 2.9).reason).toBe('occupied');
    const c = sim.placeTowerTile('cleaver', 2, 0);
    expect(c).toMatchObject({ x: 2.5, y: 0.5 });
    expect(sim.placeCost('archer', 2, 3)).toBe(200);
  });

  test('towerAt(tile) also finds a girl standing off-centre on that tile', () => {
    const sim = makeSim({ cash: 1000 });
    const t = sim.placeTower('archer', 2.08, 2.08); // tile (2,2); centre (2.5,2.5) is 0.59 away
    expect(sim.towerAt(2, 2)).toBe(t);
    expect(sim.towerAt(2.5, 2.5)).toBe(null); // continuous: footprint does not contain the centre
  });

  test('heroes are wider: the old adjacent-tile placement next to the path is now too close', () => {
    const sim = makeSim({ hero: 'heroine', cash: 1000 });
    expect(sim.canPlace('heroine', 6, 5).reason).toBe('path'); // tile centre 1.0 from the line
    expect(sim.canPlace('heroine', 8.5, 5.6).ok).toBe(true); // 1.1 ≥ 1.05 (and clear of the rocks at 5-6,6)
  });
});

describe('autoPlan on the continuous lattice', () => {
  const data = testData();

  test('plan actions carry continuous x/y plus tx/ty and are all legal in order', () => {
    const plan = autoPlan('test-1', ['archer', 'bomber', 'cleaver', 'banker', 'heroine'], { data });
    const places = plan.filter((a) => a.action === 'place');
    expect(places.length).toBeGreaterThanOrEqual(5);
    const sim = new Sim({ stageId: 'test-1', data, loadout: ['archer', 'bomber', 'cleaver', 'banker'].map((unitId) => ({ unitId })), hero: { unitId: 'heroine' } });
    sim.cash = 1e9;
    for (const p of places) {
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(false);
      expect(p.tx).toBe(Math.floor(p.x));
      expect(p.ty).toBe(Math.floor(p.y));
      expect(sim.canPlace(p.unitId, p.x, p.y).ok, `${p.unitId} at ${p.x},${p.y}`).toBe(true);
      expect(sim.placeTower(p.unitId, p.x, p.y)).toBeTruthy();
    }
    // upgrades find their girl by position
    for (const u of plan.filter((a) => a.action === 'upgrade')) expect(sim.towerAt(u.x, u.y)?.unitId).toBe(u.unitId);
    // dps girls hug the path band (coverage), the hero too
    const archer = places.find((p) => p.unitId === 'archer');
    expect(Math.abs(archer.y - PATH_Y)).toBeLessThan(1.6);
    const hero = places.find((p) => p.unitId === 'heroine');
    expect(Math.abs(hero.y - PATH_Y)).toBeGreaterThanOrEqual(HERO_BAND - 1e-6);
    expect(Math.abs(hero.y - PATH_Y)).toBeLessThan(1.8);
  });

  test('is deterministic and wins the fixture stage', () => {
    const a = autoPlan('test-1', ['archer', 'bomber'], { data });
    const b = autoPlan('test-1', ['archer', 'bomber'], { data });
    expect(a).toEqual(b);
    const r = runHeadless({ stageId: 'test-1', plan: a, seed: 2, data });
    expect(r.won).toBe(true);
    expect(r.failed).toEqual([]);
  });

  test('old tile-based plans still execute', () => {
    const plan = [
      { at: 1, action: 'place', unitId: 'archer', tx: 3, ty: 3 },
      { at: 1, action: 'upgrade', unitId: 'archer', tx: 3, ty: 3, path: 0 },
      { at: 1, action: 'place', unitId: 'bomber', tx: 7, ty: 5 },
    ];
    const r = runHeadless({ stageId: 'test-1', plan, seed: 3, data, maxTime: 5 });
    expect(r.failed).toEqual([]);
    expect(r.sim.towers.map((t) => [t.x, t.y])).toEqual([[3.5, 3.5], [7.5, 5.5]]);
    expect(r.sim.towers[0].tiers[0]).toBe(1);
    void STAGE;
  });
});

// ---------------------------------------------------------------------------
// Rooftops ('U', Gate Arc): a flat roof is land; a girl centred on one keeps her whole footprint
// on roof tiles; for a girl on the ground a roof is a wall; water girls cannot stand there.
// ---------------------------------------------------------------------------
// 16 × 9, path along row 4 (y = 4.5): a 2×2 roof at x 1-2 / y 1-2, a one-tile roof at (9, 2), a
// 3×2 roof at x 12-14 / y 6-7, a roof on the board's west edge at (0, 7), water at x 5-6 / y 1.
const ROOF_MAP = {
  id: 'test-roofs',
  name: 'Roof Test',
  theme: 'sakura',
  tier: 'beginner',
  width: 16,
  height: 9,
  rows: [
    '................',
    '.UU..~~.........',
    '.UU......U......',
    '................',
    '................',
    '................',
    '............UUU.',
    'U...........UUU.',
    '................',
  ],
  paths: [[[-1, 4], [16, 4]]],
};
const WIDE = { ...UNITS.archer, id: 'wide', footprint: 0.6 };
const AMPHI = { ...UNITS.archer, id: 'amphi', placement: 'amphibious' };

describe('rooftops (U)', () => {
  const rules = createPlacementRules(ROOF_MAP, buildPaths(ROOF_MAP));

  test('a girl centred on a roof fits; one straddling its edge is blocked', () => {
    expect(rules.isRoof(2, 2)).toBe(true);
    expect(rules.isRoof(3.2, 2)).toBe(false);
    expect(rules.isRoof(-0.5, 2)).toBe(false);
    // the 2×2 roof covers [1, 3] × [1, 3]: from its middle the edge is 1 tile away
    expect(rules.obstacleDistance(2, 2)).toBeCloseTo(1, 9);
    expect(rules.check(UNITS.archer, 2, 2, [])).toBe(null);
    expect(rules.check(UNITS.archer, 1.42, 1.42, [])).toBe(null); // exactly her radius from both edges
    expect(rules.check(UNITS.archer, 1.41, 2, [])).toBe('blocked'); // a hair over the west edge
    expect(rules.check(UNITS.archer, 2, 2.75, [])).toBe('blocked'); // half her footprint off the roof
    // inside a roof region the tile seams are no edge
    expect(rules.obstacleDistance(2, 1.5)).toBeCloseTo(0.5, 9);
    expect(rules.check(UNITS.archer, 2.0, 1.6, [])).toBe(null);
  });

  test('the board edge is a roof edge: a girl may not hang off the board from a roof', () => {
    expect(rules.isRoof(0.5, 7.5)).toBe(true);
    // on the ground a girl may hug the board edge (only map tiles count) ...
    expect(rules.check(UNITS.archer, 0.45, 4.5 - 0.97 - 1.5, [])).toBe(null);
    // ... but from a roof the outside counts as off the roof
    expect(rules.obstacleDistance(0.3, 7.5)).toBeCloseTo(0.3, 9);
    expect(rules.check(UNITS.archer, 0.3, 7.5, [])).toBe('blocked');
    expect(rules.check(UNITS.archer, 0.5, 7.5, [])).toBe(null);
  });

  test('a girl on the ground cannot overlap a roof: it blocks like a building', () => {
    // (3.2, 2) is ground, 0.2 east of the 2×2 roof
    expect(rules.obstacleDistance(3.2, 2)).toBeCloseTo(0.2, 9);
    expect(rules.check(UNITS.archer, 3.2, 2, [])).toBe('blocked');
    expect(rules.check(UNITS.archer, 3.42, 2, [])).toBe(null);
    // the same for the one-tile roof, from every side
    expect(rules.check(UNITS.archer, 8.7, 2.5, [])).toBe('blocked');
    expect(rules.check(UNITS.archer, 9.5, 3.3, [])).toBe('blocked');
    expect(rules.check(UNITS.archer, 9.5, 3.42, [])).toBe(null);
  });

  test('water girls cannot stand on a roof; amphibious girls can', () => {
    expect(rules.check(UNITS.boat, 2, 2, [])).toBe('needsWater');
    expect(rules.check(UNITS.boat, 5.5, 1.5, [])).toBe(null);
    expect(rules.check(AMPHI, 2, 2, [])).toBe(null);
    expect(rules.check(UNITS.stormer, 13.5, 7, [])).toBe(null);
  });

  test('size matters: a footprint fits only on a roof big enough for it', () => {
    // the one-tile roof: an ordinary girl with a little room, a hero (radius 0.5) only dead centre
    expect(rules.check(UNITS.archer, 9.45, 2.5, [])).toBe(null);
    expect(rules.check(UNITS.heroine, 9.5, 2.5, [])).toBe(null);
    expect(rules.check(UNITS.heroine, 9.45, 2.5, [])).toBe('blocked');
    // a wider footprint (0.6) never fits a one-tile roof, but fits the 2×2 and the 3×2 roofs
    expect(rules.check(WIDE, 9.5, 2.5, [])).toBe('blocked');
    expect(rules.check(WIDE, 2, 2, [])).toBe(null);
    expect(rules.check(WIDE, 13.5, 7, [])).toBe(null);
    expect(rules.check(WIDE, 12.5, 7, [])).toBe('blocked'); // 0.5 from the west edge
  });

  test('overlap and the path band still apply on a roof', () => {
    const others = [{ x: 2, y: 2, radius: TOWER_RADIUS }];
    expect(rules.check(UNITS.archer, 2, 1.7, others)).toBe('occupied');
    // a roof right beside the road: the band wins over the roof
    const near = { ...ROOF_MAP, id: 'test-roofs-near', rows: ROOF_MAP.rows.map((r, y) => (y === 3 ? '....UU..........' : r)) };
    const nr = createPlacementRules(near, buildPaths(near));
    // (row 3's roof covers [4, 6] × [3, 4]; the road's centreline is y = 4.5, its band reaches 3.95)
    expect(nr.check(UNITS.archer, 4.6, 3.6, [])).toBe('path');
    expect(nr.check(UNITS.archer, 5.0, 3.5, [])).toBe(null); // 1.0 from the centreline, 0.5 from every roof edge
  });

  test('Sim: place, find and sell a girl on a roof; the same reasons as the pure check', () => {
    const sim = makeSim({ map: ROOF_MAP, cash: 100000, hero: 'heroine' });
    // (two integers would be a legacy tile call: the tile's centre)
    expect(sim.canPlace('archer', 1.95, 1.95)).toMatchObject({ ok: true, x: 1.95, y: 1.95 });
    expect(sim.canPlace('archer', 1.95, 2.75).reason).toBe('blocked');
    expect(sim.canPlace('archer', 3.2, 1.95).reason).toBe('blocked');
    expect(sim.canPlace('boat', 1.95, 1.95).reason).toBe('needsWater');
    expect(sim.canPlace('archer', 9, 2)).toMatchObject({ ok: true, x: 9.5, y: 2.5 }); // tile (9, 2): its centre, on the roof
    const t = sim.placeTower('archer', 1.95, 1.95);
    expect(t).toMatchObject({ x: 1.95, y: 1.95, tx: 1, ty: 1 });
    expect(sim.towerAt(2.1, 2.1)).toBe(t);
    expect(sim.placement.isRoof(t.x, t.y)).toBe(true);
    expect(sim.placeTower('heroine', 9.5, 2.5)).toBeTruthy();
    expect(sim.sellTower(t.uid)).toBeTruthy();
    expect(sim.canPlace('archer', 1.95, 1.95).ok).toBe(true);
  });
});

describe('autoPlan on rooftops', () => {
  // every ground tile beside the road is a building; the only free spots near it are the roofs
  const ROOFTOWN = {
    id: 'test-rooftown',
    name: 'Rooftown',
    theme: 'sakura',
    tier: 'beginner',
    width: 16,
    height: 9,
    rows: [
      'HHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHH',
      'HUUUHHHUUUHHUUUH',
      'HUUUHHHUUUHHUUUH',
      '................',
      'HUUUHHHHHUUUHHHH',
      'HUUUHHHHHUUUHHHH',
      'HHHHHHHHHHHHHHHH',
      '...............~',
    ],
    paths: [[[-1, 4], [16, 4]]],
  };
  const stage = { ...STAGE, id: 'test-rooftown', mapId: 'test-rooftown' };
  const opts = { data: testData({ stage, map: ROOFTOWN }) };
  const units = ['archer', 'bomber', 'cleaver', 'chainer'];

  test('places girls on the roofs, every action legal in order', () => {
    const plan = autoPlan('test-rooftown', units, opts);
    const places = plan.filter((a) => a.action === 'place');
    expect(places.length).toBeGreaterThanOrEqual(4);
    expect(places.filter((a) => a.roof).length).toBeGreaterThanOrEqual(3);
    const rules = createPlacementRules(ROOFTOWN, buildPaths(ROOFTOWN));
    const placed = [];
    for (const a of places) {
      expect(rules.check(UNITS[a.unitId], a.x, a.y, placed), `${a.unitId} at ${a.x}, ${a.y}`).toBe(null);
      expect(!!a.roof, `${a.unitId} roof flag`).toBe(rules.isRoof(a.x, a.y));
      placed.push({ x: a.x, y: a.y, radius: footprintRadius(UNITS[a.unitId]) });
    }
  });

  test('is deterministic: the same plan and the same battle every time', () => {
    const a = autoPlan('test-rooftown', units, opts);
    const b = autoPlan('test-rooftown', units, opts);
    expect(b).toEqual(a);
    const run = () => runHeadless({ stageId: 'test-rooftown', plan: a, seed: 11, data: opts.data, maxTime: 600 });
    const r1 = run();
    const r2 = run();
    expect(r2.result).toEqual(r1.result);
    expect(r2.cash).toBe(r1.cash);
    expect(r1.won).toBe(true);
  });
});
