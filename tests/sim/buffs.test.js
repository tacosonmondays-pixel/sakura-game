// Buffs (src/sim/buffs.js): aura winners per key (the buff icons), aura armor pen and crit, Midori-style
// brews and Chika-style tune-up links (limited, strong, one of each per girl), the pick command, and the
// read-only sources/targets API.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { UNITS, testData, run, startEmptyWave } from './fixtures.js';
import { BREW_EVERY, BREW_TIME } from '../../src/sim/constants.js';

const base = UNITS.archer.base;
const mk = (id, extra) => ({ ...UNITS.archer, id, name: id, paths: UNITS.archer.paths, ...extra, base: { ...base, ...(extra.base || {}) } });
const XUNITS = {
  ...UNITS,
  // a brewer: brews 1 girl (+100% damage, +3 pen), her paths add targets / speed
  brewer: mk('brewer', {
    role: 'alchemist',
    base: { damage: 2, rate: 1, range: 4, brew: { targets: 1, dmgMul: 2, armorPen: 3 } },
    paths: [
      { id: 'a', name: 'A', focus: 'a', tiers: [1, 2, 3, 4, 5].map((k) => ({ name: `a${k}`, cost: 100, desc: 'a', mods: k === 3 ? { brew: { targets: 2, rateMul: 1.5 } } : { damage: 1 } })) },
      ...UNITS.archer.paths.slice(1),
    ],
  }),
  // a linker: aura 3 tiles (+5% speed) and a tune-up link to 1 girl (2 after tier 5) with overclock
  linker: mk('linker', {
    role: 'engineer',
    base: {
      behavior: 'none', damage: 0, range: 3, aura: { range: 3, rateMul: 1.05 },
      link: { targets: 1, rateMul: 1.6, dmgMul: 1.3, armorPen: 4, overclock: { every: 20, time: 6, rateMul: 1.25 } },
    },
  }),
  // an aura girl with armor pen and crit
  piercer: mk('piercer', { role: 'support', base: { behavior: 'none', damage: 0, aura: { range: 3, armorPen: 4, critChance: 0.1, dmgMul: 1.1 } } }),
};
const IDS = Object.keys(XUNITS).filter((id) => XUNITS[id].kind === 'tower');

function sim0() {
  const sim = new Sim({ stageId: 'test-1', loadout: IDS.map((unitId) => ({ unitId })), seed: 3, data: testData({ units: XUNITS }) });
  sim.cash = 1e9;
  return sim;
}

/** Spots next to the path (centre line y 4.5) on the 16 × 9 test map: a–b and c–d 2 apart, a–c 2.2, a–d 2.97. */
const AT = { a: [8.5, 3.4], b: [10.5, 3.4], c: [8.5, 5.6], d: [10.5, 5.6], e: [12.5, 5.6], far: [1.5, 7.5] };
const place = (sim, id, at) => {
  const t = sim.placeTower(id, ...AT[at]);
  expect(t, `${id} at ${at}`).toBeTruthy();
  return t;
};

describe('aura winners (buffBy) and aura pen / crit', () => {
  test('the strongest aura per key wins; ties go to the girl placed first', () => {
    const sim = sim0();
    const c1 = place(sim, 'chime', 'a');
    const c2 = place(sim, 'chime', 'b');
    const t = place(sim, 'archer', 'c');
    run(sim, 0.3);
    expect(t.buffBy).toMatchObject({ dmg: c1.uid, rate: c1.uid, det: c1.uid, cost: c1.uid, pen: -1 });
    expect(t.buff.dmgMul).toBe(1.5);
    // a stronger one replaces the winner
    c2.stats.aura.dmgMul = 1.7;
    sim._buffsDirty = true;
    run(sim, 0.1);
    expect(t.buffBy.dmg).toBe(c2.uid);
    expect(t.buffBy.rate).toBe(c1.uid);
    expect(sim.aurasCovering(t.uid).map((a) => [a.src, a.won.includes('dmg')])).toEqual([[c1.uid, false], [c2.uid, true]]);
  });

  test('aura armor pen and crit reach the effective stats (and only then change them)', () => {
    const sim = sim0();
    const t = place(sim, 'archer', 'c');
    run(sim, 0.3);
    expect(t.eff.armorPen).toBe(0);
    expect(t.eff.critChance).toBe(0);
    const p = place(sim, 'piercer', 'd');
    run(sim, 0.3);
    expect(t.buffBy.pen).toBe(p.uid);
    expect(t.eff.armorPen).toBe(4);
    expect(t.eff.critChance).toBeCloseTo(0.1, 12);
    expect(t.buffed).toBe(true);
  });
});

describe('brews (limited, strong)', () => {
  test('a brew multiplies on top of the auras and lasts while re-brewed', () => {
    const sim = sim0();
    place(sim, 'chime', 'a'); // aura ×1.5 damage
    const t = place(sim, 'archer', 'c');
    const m = place(sim, 'brewer', 'd');
    run(sim, 0.1);
    expect(t.limIn).toMatchObject({ brew: m.uid });
    expect(t.buff.dmgMul).toBeCloseTo(3, 12); // 1.5 × 2
    expect(t.eff.armorPen).toBe(3);
    expect(m.lim.targets).toEqual([t.uid]);
    run(sim, 3 * BREW_EVERY);
    expect(t.limIn.brew).toBe(m.uid);
    expect(t.limIn.brewLeft).toBeGreaterThan(0);
    expect(t.limIn.brewLeft).toBeLessThanOrEqual(BREW_TIME);
    // selling Midori ends it at once
    sim.sellTower(m.uid);
    run(sim, 0.05);
    expect(t.limIn.brew).toBe(-1);
    expect(t.buff.dmgMul).toBe(1.5);
  });

  test('one brew per girl: a second brewer brews someone else', () => {
    const sim = sim0();
    const x = place(sim, 'archer', 'c');
    const y = place(sim, 'archer', 'b');
    const m1 = place(sim, 'brewer', 'd');
    const m2 = place(sim, 'brewer', 'a');
    run(sim, 0.1);
    expect(x.limIn.brew).toBe(m1.uid); // ties: lower uid first
    expect(y.limIn.brew).toBe(m2.uid);
    run(sim, 2 * BREW_EVERY + 0.5);
    expect(x.limIn.brew).toBe(m1.uid);
    expect(y.limIn.brew).toBe(m2.uid);
    expect(x.buff.dmgMul).toBe(2); // never ×4
  });

  test('picks by recent DPS, then projected DPS, then uid; a pin goes first', () => {
    const sim = sim0();
    const x = place(sim, 'archer', 'c');
    const s = place(sim, 'sniper', 'b'); // projected DPS 50 × 0.5 = 25 > archer 10 × 2 = 20
    const m = place(sim, 'brewer', 'd');
    run(sim, 0.1);
    expect(m.lim.targets).toEqual([s.uid]);
    x.recentDps = 100;
    m.lim.repick = true;
    run(sim, 0.05);
    expect(m.lim.targets).toEqual([x.uid]);
    // the girl she no longer brews keeps it at most half a second
    run(sim, 0.6);
    expect(s.limIn.brew).toBe(-1);
    // pin
    expect(sim.setBuffPick(m.uid, s.uid)).toEqual({ ok: true, reason: null });
    run(sim, 0.05);
    expect(m.lim.targets).toEqual([s.uid]);
    expect(m.buffPick).toBe(s.uid);
    // refusals
    expect(sim.setBuffPick(m.uid, m.uid).reason).toBe('self');
    expect(sim.setBuffPick(m.uid, 9999).reason).toBe('gone');
    expect(sim.setBuffPick(x.uid, s.uid).reason).toBe('noBuff');
    const far = place(sim, 'archer', 'far');
    expect(sim.setBuffPick(m.uid, far.uid).reason).toBe('range');
    // selling the pinned girl clears the pin
    sim.sellTower(s.uid);
    run(sim, 0.05);
    expect(m.buffPick).toBe(-1);
    // back to auto
    expect(sim.setBuffPick(m.uid, -1).ok).toBe(true);
  });

  test('targets grow with her tiers; a brew reaches drones and traps', () => {
    const sim = sim0();
    const e = place(sim, 'engineer', 'c');
    const tr = place(sim, 'trapper', 'b');
    const m = place(sim, 'brewer', 'd');
    startEmptyWave(sim);
    run(sim, 2);
    const brewed = () => [e, tr].filter((g) => g.limIn?.brew === m.uid).length;
    expect(brewed()).toBe(1);
    for (let k = 0; k < 3; k++) expect(sim.upgradeTower(m.uid, 0)).toBe(true);
    expect(m.stats.brew.targets).toBe(2);
    expect(m.stats.brew.rateMul).toBe(1.5);
    m.lim.repick = true;
    run(sim, 0.1);
    expect(brewed()).toBe(2);
    expect(e.turretSpec.damage).toBe(6 * 2);
    expect(e.turretSpec.armorPen).toBe(3);
    expect(tr.trapSpec.damage).toBe(40 * 2);
  });
});

describe('tune-up links and overclock', () => {
  test('a link holds while the girl stays; selling her re-picks', () => {
    const sim = sim0();
    const x = place(sim, 'archer', 'c');
    const ch = place(sim, 'linker', 'd');
    const y = place(sim, 'archer', 'b');
    run(sim, 0.5);
    expect(ch.lim.targets).toEqual([x.uid]);
    expect(x.limIn.link).toBe(ch.uid);
    expect(x.buff.rateMul).toBeCloseTo(1.05 * 1.6, 12); // her aura (+5%) × the link (+60%)
    expect(x.buff.dmgMul).toBeCloseTo(1.3, 12);
    expect(x.eff.armorPen).toBe(4);
    // sticky: a girl dealing more damage does not steal the link
    y.recentDps = 1e6;
    run(sim, 2);
    expect(ch.lim.targets).toEqual([x.uid]);
    sim.sellTower(x.uid);
    run(sim, 0.5);
    expect(ch.lim.targets).toEqual([y.uid]);
    expect(y.limIn.link).toBe(ch.uid);
  });

  test('overclock: every 20 s from the first link, for 6 s, ×1.25 speed on top', () => {
    const sim = sim0();
    const x = place(sim, 'archer', 'c');
    const ch = place(sim, 'linker', 'd');
    run(sim, 0.1);
    const r0 = x.eff.rate;
    run(sim, 19.5);
    expect(x.limIn.oc).toBe(false);
    run(sim, 0.6);
    expect(x.limIn.oc).toBe(true);
    expect(ch.lim.ocLeft).toBeGreaterThan(5);
    expect(x.eff.rate).toBeCloseTo(r0 * 1.25, 9);
    expect(sim.buffSources(x.uid).find((r) => r.key === 'rate' && r.src === ch.uid).kind).toBe('overclock');
    expect(sim.drainEvents().filter((e) => e.type === 'overclock').map((e) => e.on)).toEqual([true]);
    run(sim, 6);
    expect(x.limIn.oc).toBe(false);
    expect(x.eff.rate).toBeCloseTo(r0, 9);
  });

  test('one link per girl: two linkers link different girls', () => {
    const sim = sim0();
    const x = place(sim, 'archer', 'c');
    const y = place(sim, 'archer', 'b');
    const c1 = place(sim, 'linker', 'd');
    const c2 = place(sim, 'linker', 'a');
    run(sim, 0.5);
    expect(x.limIn.link).toBe(c1.uid);
    expect(y.limIn.link).toBe(c2.uid);
    expect(x.buff.dmgMul).toBeCloseTo(1.3, 12);
  });
});

describe('sources and targets (read-only, for the buff icons)', () => {
  test('buffSources: limited first, then aura winners, then the ultimate; buffTargets both ways', () => {
    const sim = sim0();
    const c = place(sim, 'chime', 'a');
    const x = place(sim, 'archer', 'c');
    const m = place(sim, 'brewer', 'd');
    run(sim, 0.3);
    const rows = sim.buffSources(x.uid);
    expect(rows[0]).toMatchObject({ key: 'dmg', value: 1, kind: 'brew', src: m.uid, unitId: 'brewer' });
    expect(rows[0].left).toBeGreaterThan(5);
    expect(rows[1]).toMatchObject({ key: 'pen', value: 3, kind: 'brew', src: m.uid, left: rows[0].left });
    const aura = rows.filter((r) => r.kind === 'aura');
    expect(aura.map((r) => r.key)).toEqual(['dmg', 'rate', 'det', 'cost']);
    expect(aura[0]).toMatchObject({ src: c.uid, unitId: 'chime', left: null });
    expect(aura[0].value).toBeCloseTo(0.5, 12);
    sim.addGlobalRateBuff(1.5, 4, c.uid);
    run(sim, 0.1);
    expect(sim.buffSources(x.uid).at(-1)).toMatchObject({ key: 'rate', kind: 'ult', src: c.uid, unitId: 'chime' });
    expect(sim.buffTargets(m.uid)).toEqual([{ uid: x.uid, kinds: ['brew'], keys: [] }]);
    const ct = sim.buffTargets(c.uid);
    expect(ct.find((r) => r.uid === x.uid)).toMatchObject({ kinds: ['aura'], keys: ['dmg', 'rate', 'det', 'cost'] });
    expect(sim.buffSources(424242)).toEqual([]);
  });
});

describe('hero ultimate as a buff source', () => {
  test('a time-warp ultimate is tinted by the hero who cast it (her uid, not the view getter)', () => {
    const sim = new Sim({ stageId: 'test-1', loadout: [{ unitId: 'archer' }], hero: { unitId: 'warper' }, seed: 5, data: testData({ units: XUNITS }) });
    sim.cash = 1e9;
    const x = place(sim, 'archer', 'c');
    const h = place(sim, 'warper', 'a');
    expect(h.isHero).toBe(true);
    startEmptyWave(sim);
    h.ultCooldown = 0; // charged
    expect(sim.activateUlt()).toBe(true);
    expect(sim._globalBuffs.map((b) => b.src)).toEqual([h.uid]);
    run(sim, 0.1);
    expect(sim.buffSources(x.uid).at(-1)).toMatchObject({ key: 'rate', kind: 'ult', src: h.uid, unitId: 'warper' });
  });

  test('a global rate buff without a caster names nobody', () => {
    const sim = sim0();
    sim.addGlobalRateBuff(1.5, 4);
    expect(sim._globalBuffs.map((b) => b.src)).toEqual([-1]);
  });
});

describe('determinism', () => {
  test('snapshot round trip with brews, links and overclock: both copies stay identical', () => {
    const sim = sim0();
    place(sim, 'chime', 'a');
    place(sim, 'archer', 'c');
    place(sim, 'brewer', 'd');
    place(sim, 'linker', 'b');
    place(sim, 'sniper', 'e');
    sim.startNextWave();
    run(sim, 13);
    const snap = JSON.parse(JSON.stringify(sim.snapshot()));
    const copy = new Sim({ stageId: 'test-1', loadout: IDS.map((unitId) => ({ unitId })), seed: 3, data: testData({ units: XUNITS }) }).restore(snap);
    for (let i = 0; i < 3000; i++) {
      sim.update(1 / 60);
      copy.update(1 / 60);
    }
    const strip = (s) => JSON.stringify(s.snapshot());
    expect(strip(copy)).toBe(strip(sim));
  });
});
