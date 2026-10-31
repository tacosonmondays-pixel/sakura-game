// MORE › Details for every girl (v0.1.68, docs/review/more-page-audit.md): every unit that can deal damage, at every
// path's tier-5 build (heroes at Lv 25), gets the DPS cells (dealsDamage); a pure support gets none; every kit piece in
// her effective stats has a row (kitRows) or an older row of the drawer; her damage split by source reads the sim's own
// credits; and all of it is a read (the sim is never written).
import { describe, test, expect } from 'vitest';
import { defaultData } from '../../src/sim/data.js';
import { Sim } from '../../src/sim/Sim.js';
import { MAP, STAGE, ENEMIES } from '../sim/fixtures.js';
import { kitRows, dealsDamage, damageSplit, SHAPE_NAMES, paintKitCells, LIVE_KIT_KEYS } from '../../src/ui/battle/kitRows.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { readFileSync } from 'node:fs';

const units = defaultData().units;
const ids = Object.keys(units);

/** Kit pieces the drawer already had a row for before kitRows (towerPanel.js detailGrid), or that are not a kit. */
const OLD_ROWS = new Set(['aura', 'hub', 'trap', 'turret', 'mark', 'ramp', 'income', 'crit', 'buff', 'status', 'proc', 'tempo']);
/** Kit key → the kitRows key(s) that say it. */
const ROW_OF = { relay: ['mirrors', 'relay'], duo: ['duoBeam'], link: ['link'] };

/** One unit at one build, fighting a crowd for 6 s. */
function fight(id, tiers) {
  const def = units[id];
  const isHero = def.kind === 'hero';
  const sim = new Sim({ stageId: STAGE.id, loadout: isHero ? [] : [{ unitId: id }], hero: isHero ? { unitId: id } : null, seed: 3, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
  sim.cash = 1e8;
  const big = isHero || def.footprint >= 0.5;
  const t = def.placement === 'water' ? sim.placeTower(id, 5.5, 2.5) : sim.placeTower(id, big ? 8.5 : 6.5, big ? 5.6 : 5.5);
  expect(t, `${id} placed`).toBeTruthy();
  if (isHero) {
    sim._credit(t, 1e9); // Lv 25
    // (the levelling credit is not a fight: she starts at 0 dealt, so "a damage source before the first hit" is real)
    t.damageDealt = 0;
    sim.stats.damageByTower[t.uid] = 0;
  }
  else for (let p = 0; p < 3; p++) for (let k = 0; k < tiers[p]; k++) sim.upgradeTower(t.uid, p);
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [];
  for (let k = 0; k < 10; k++) {
    const e = sim.spawnEnemy(k % 2 ? 'orc' : 'tank', { dist: 3 + k * 0.5 });
    if (def.base.behavior !== 'strip') e.baseSpeed = 0;
  }
  return { sim, t, def };
}

const builds = (id) => (units[id].kind === 'hero' ? [[0, 0, 0]] : [[5, 0, 0], [0, 5, 0], [0, 0, 5], [2, 0, 5]]);

describe.skipIf(ids.length === 0)('the DPS cells and kit rows for every unit', () => {
  test.each(ids)('%s: DPS cells whenever she has a damage source; every kit piece has a row', (id) => {
    for (const tiers of builds(id)) {
      const { sim, t, def } = fight(id, tiers);
      const before = dealsDamage(t, sim.towerStats(t.uid));
      for (let k = 0; k < 6 * 60; k++) sim.update(1 / 60);
      const st = sim.towerStats(t.uid);
      const label = `${id} ${t.tiers.join('-')}`;
      // dealt damage: the cells show, even where the paper DPS (st.dps) is 0
      if (t.damageDealt > 0) expect(dealsDamage(t, st), label).toBe(true);
      // a damage source before the first hit already shows them (the drawer is built before she fights)
      if (st.dps > 0 || def.kind === 'hero') expect(before, `${label} before the fight`).toBe(true);
      // every kit piece in her effective stats: a kitRows row or an older drawer row
      const rows = kitRows(t, st);
      const keys = new Set(rows.map((r) => r.key));
      for (const [k, v] of Object.entries(t.eff)) {
        if (!v || typeof v !== 'object' || Array.isArray(v) || OLD_ROWS.has(k)) continue;
        if (k === 'link' && t.turretSpec?.leash > 0) continue; // (Chika's link: her own tab, chikaPanel.js)
        const want = ROW_OF[k] || [k];
        expect(want.some((w) => keys.has(w)), `${label}: no row for ${k}`).toBe(true);
      }
      for (const r of rows) {
        expect(r.value, `${label} ${r.key}`).toMatch(/\S/);
        expect(r.value, `${label} ${r.key}`).not.toMatch(/NaN|undefined|Infinity|null/);
      }
    }
  });
});

describe('a pure support has no DPS cells', () => {
  test('Ouka at every tier-5 build, and Wakaba without her towel', () => {
    for (const tiers of builds('ouka')) {
      const { sim, t } = fight('ouka', tiers);
      for (let k = 0; k < 3 * 60; k++) sim.update(1 / 60);
      expect(dealsDamage(t, sim.towerStats(t.uid)), `ouka ${tiers}`).toBe(false);
    }
    const w = fight('wakaba', [5, 0, 0]);
    expect(dealsDamage(w.t, w.sim.towerStats(w.t.uid))).toBe(false);
    const towel = fight('wakaba', [0, 0, 5]);
    expect(dealsDamage(towel.t, towel.sim.towerStats(towel.t.uid)), 'Towel Snap deals damage').toBe(true);
  });
});

describe('the S5 shapes and Luna', () => {
  test("Luna (hero, Lv 25): her aura and her Moonbeam row, with its tier numbers", () => {
    const { sim, t } = fight('luna', [0, 0, 0]);
    const rows = kitRows(t, sim.towerStats(t.uid));
    const moon = rows.find((r) => r.key === 'moon');
    expect(moon.label).toBe('Moonbeam');
    expect(moon.value).toContain(`${Math.round(t.eff.moon.beams)} beam`);
    expect(moon.value).toContain(`±${Math.round(t.eff.moon.arc * 1.5)}°`);
    expect(moon.value).toContain(`${Math.round(t.eff.moon.mul * 100)}% of her hit`);
  });

  test.each([['miko', 'charms'], ['rei', 'cres'], ['suzu', 'toll'], ['midori', 'mist'], ['raika', 'web']])('%s: her %s row, and her damage split by source once it lands', (id, key) => {
    const def = units[id];
    for (let p = 0; p < 3; p++) {
      const tiers = [0, 0, 0];
      tiers[p] = 5;
      const { sim, t } = fight(id, tiers);
      if (!t.eff[key]) continue;
      for (let k = 0; k < 8 * 60; k++) sim.update(1 / 60);
      const rows = kitRows(t, sim.towerStats(t.uid));
      expect(rows.some((r) => r.key === key), `${id} ${key}`).toBe(true);
      const sp = damageSplit(t);
      expect(sp, `${def.name} split`).toBeTruthy();
      if (t.damageDealt > 0) {
        const shape = sp.parts.find((x) => x.key === 'shape');
        expect(shape.label).toBe(SHAPE_NAMES[key]);
        expect(shape.dealt).toBe(Math.max(0, t.shapeDealt || 0));
        expect(sp.parts.reduce((a, x) => a + x.dealt, 0)).toBeCloseTo(t.damageDealt, 6);
      }
      return;
    }
    throw new Error(`${id} has no ${key} at any tier-5 build`);
  });

  test('a girl without a separately credited source has no split', () => {
    const { t } = fight('aoi', [5, 0, 0]);
    expect(damageSplit(t)).toBe(null);
  });
});

describe('display only', () => {
  test('kitRows, dealsDamage and damageSplit never write the tower', () => {
    for (const id of ['iroha', 'luna', 'midori', 'kohaku_tsubaki', 'norika', 'tenka', 'yuzuha', 'chigusa']) {
      for (const tiers of builds(id)) {
        const { sim, t } = fight(id, tiers);
        for (let k = 0; k < 2 * 60; k++) sim.update(1 / 60);
        const st = sim.towerStats(t.uid);
        const snap = JSON.stringify({ eff: t.eff, dealt: t.damageDealt, shape: t.shapeDealt, mirrors: t.mirrors, lab: t.lab, bars: t.bars });
        const hash = hashSim(sim);
        kitRows(t, st);
        dealsDamage(t, st);
        damageSplit(t);
        expect(JSON.stringify({ eff: t.eff, dealt: t.damageDealt, shape: t.shapeDealt, mirrors: t.mirrors, lab: t.lab, bars: t.bars })).toBe(snap);
        expect(hashSim(sim), `${id} ${tiers} co-op hash`).toBe(hash);
      }
    }
  });
});

describe('live counts repaint while More stays open (paintKitCells)', () => {
  /** Her live kit cells as the drawer builds them: key -> a value node. */
  const cellsOf = (t, st) => new Map(kitRows(t, st).map((r) => [r.key, { textContent: r.value }]));

  test.each([['yuzuha', [5, 0, 0], 'sentry'], ['chigusa', [0, 5, 0], 'vine'], ['norika', [0, 0, 0], 'barricade']])('%s: her %s cell follows the count without a redraw', (id, tiers, key) => {
    const { sim, t } = fight(id, tiers);
    const cells = cellsOf(t, sim.towerStats(t.uid));
    expect(cells.has(key), `${id} has a ${key} row`).toBe(true);
    const first = cells.get(key).textContent;
    const other = [...cells].filter(([k]) => !LIVE_KIT_KEYS.includes(k)).map(([k, c]) => [k, c.textContent]);
    let changed = 0;
    // the drawer's frames: paint each step, until the count moves (sentries deploy, a vine roots, a barricade breaks)
    for (let k = 0; k < 20 * 60 && cells.get(key).textContent === first; k++) {
      if (key === 'barricade' && k === 60) for (const b of t.bars || []) b.down = 1; // (staging: a broken barricade)
      sim.update(1 / 60);
      changed += paintKitCells(cells, t, sim.towerStats(t.uid));
    }
    const now = kitRows(t, sim.towerStats(t.uid)).find((r) => r.key === key).value;
    expect(cells.get(key).textContent, `${id} ${key}: "${first}" → "${now}"`).not.toBe(first);
    expect(cells.get(key).textContent).toBe(now);
    expect(changed).toBeGreaterThan(0);
    // a row that is not a live count is never rewritten
    for (const [k, v] of other) expect(cells.get(k).textContent, k).toBe(v);
  });

  test('nothing to paint: no live cell, no work', () => {
    const { sim, t } = fight('aoi', [5, 0, 0]);
    expect(paintKitCells(cellsOf(t, sim.towerStats(t.uid)), t, sim.towerStats(t.uid))).toBe(0);
    expect(paintKitCells(new Map(), t, sim.towerStats(t.uid))).toBe(0);
  });

  test('the drawer wires it: its kit cells register the live keys and updateLive paints them', () => {
    const src = readFileSync(new URL('../../src/ui/battle/towerPanel.js', import.meta.url), 'utf8');
    expect(src).toMatch(/LIVE_KIT_KEYS\.includes\(r\.key\) && live\) \(live\.kits \|\|= new Map\(\)\)\.set\(r\.key, value\)/);
    expect(src).toMatch(/if \(live\.kits\) paintKitCells\(live\.kits, t, /);
  });
});

describe('wording', () => {
  test('a small share reads "<1%", a locked ability says when it unlocks, Iroha\'s locked ⚡ says "once her ⚡ unlocks"', () => {
    const sp = damageSplit({ damageDealt: 1000, shapeDealt: 2, droneDmg: 0, eff: { moon: { beams: 2, arc: 30, mul: 0.35 } } });
    expect(sp.text).toBe('Attack 100% · Moonbeam <1%');
    expect(damageSplit({ damageDealt: 1000, shapeDealt: 0, eff: { moon: {} } }).text).toBe('Attack 100% · Moonbeam 0%');
    const duo = fight('kohaku_tsubaki', [5, 0, 0]);
    const ab = kitRows(duo.t, duo.sim.towerStats(duo.t.uid)).find((r) => r.key === 'ability');
    expect(ab.value).toBe('Prismfall · unlocks at Refraction tier 3');
    const ir = fight('iroha', [0, 0, 5]);
    const st = ir.sim.towerStats(ir.t.uid);
    expect(st.ability.unlocked).toBe(false);
    expect(kitRows(ir.t, st).find((r) => r.key === 'allyBounces').value).toMatch(/once her ⚡ unlocks$/);
  });
});
