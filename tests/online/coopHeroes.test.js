// Co-op with the hero rework: each player brings her own hero; 'hlv' buys her next level (stale-safe),
// 'hmv' moves her, a hero 'sell' is refused. Both views (slot 0 and slot 1) must compute the same battle.
import { describe, it, expect } from 'vitest';
import { createCoopSim, quantize } from '../../src/online/coop/commands.js';
import { withDetMath } from '../../src/online/coop/detMath.js';

const START = Object.freeze({
  seed: 5150,
  stageId: '2-5',
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'a', name: 'Aiko', loadout: [{ unitId: 'aoi' }, { unitId: 'kage' }], hero: { unitId: 'hikari' } },
    { slot: 1, uid: 'b', name: 'Bea', loadout: [{ unitId: 'rei' }, { unitId: 'yuki' }], hero: { unitId: 'hikari' } },
  ],
});

/** Legal hero spots (quantized), ≥ 1.5 tiles apart. */
function heroSpots(n = 4) {
  return withDetMath(() => {
    const c = createCoopSim(START);
    const out = [];
    for (let y = 0.6; y < c.sim.map.height && out.length < n; y += 0.4) {
      for (let x = 0.6; x < c.sim.map.width && out.length < n; x += 0.4) {
        const q = quantize(x, y);
        if (c.sim.placementReason('hikari', q[0] / 1024, q[1] / 1024)) continue;
        if (c.sim.placement.pathDistance(x, y) > 2.2) continue;
        if (out.some(([qx, qy]) => Math.hypot(qx / 1024 - x, qy / 1024 - y) < 1.5)) continue;
        out.push(q);
      }
    }
    return out;
  });
}
const SPOTS = heroSpots(5);

/** Runs the same command log on a client of each slot; returns both. */
function both(script, ticks) {
  const cs = [createCoopSim(START, { mySlot: 0 }), createCoopSim(START, { mySlot: 1 })];
  const results = [[], []];
  for (let t = 0; t < ticks; t++) {
    const cmds = script(t, cs[0]) || [];
    cs.forEach((c, i) => {
      for (const cmd of cmds) results[i].push([cmd.k, c.apply({ t, s: 0, ...cmd })]);
      c.step();
    });
  }
  return { cs, results };
}

describe('co-op heroes', () => {
  it('both players field their own hero (two Hikaris allowed); each view sees its own as sim.hero', () => {
    const { cs } = both((t) => (t === 0 ? [{ p: 0, k: 'place', a: ['hikari', ...SPOTS[0]] }, { p: 1, k: 'place', a: ['hikari', ...SPOTS[1]] }] : null), 2);
    for (const c of cs) {
      expect(c.sim.heroes.every((h) => h && h.unitId === 'hikari')).toBe(true);
      expect(c.sim.heroes[0]).not.toBe(c.sim.heroes[1]);
      expect(c.ownerOf(c.sim.heroes[0].uid)).toBe(0);
      expect(c.ownerOf(c.sim.heroes[1].uid)).toBe(1);
    }
    expect(cs[0].sim.hero).toBe(cs[0].sim.heroes[0]);
    expect(cs[1].sim.hero).toBe(cs[1].sim.heroes[1]);
    expect(cs[0].hash()).toBe(cs[1].hash());
  });

  it('hlv, hmv (between and during waves), ult and auto-start: both views stay identical', () => {
    let wavesSeen = 0;
    const script = (t, c) => {
      if (t === 0) return [{ p: 0, k: 'place', a: ['hikari', ...SPOTS[0]] }, { p: 1, k: 'place', a: ['hikari', ...SPOTS[1]] }, { p: 0, k: 'place', a: ['kage', ...SPOTS[2]] }];
      if (t === 2) return [{ p: 1, k: 'hmv', a: SPOTS[3] }, { p: 0, k: 'auto', a: [true] }, { p: 0, k: 'wave', a: [] }];
      const out = [];
      if (t % 300 === 150) {
        for (const p of [0, 1]) {
          const h = c.sim.heroes[p];
          // what player p's button shows (computed on that hero directly: the same as her own view)
          c.sim.heroConfig = c.sim.heroConfigs[p];
          const st = c.sim.heroLevelStatus();
          c.sim.heroConfig = c.sim.heroConfigs[0];
          if (h && !st.reason) out.push({ p, k: 'hlv', a: [st.level + 1, st.price] });
        }
      }
      if (t % 600 === 300) out.push({ p: 0, k: 'ult', a: [] }, { p: 1, k: 'ult', a: [] });
      if (t === 1500) out.push({ p: 0, k: 'hmv', a: SPOTS[4] }, { p: 1, k: 'hmv', a: SPOTS[1] }); // in a wave
      if (c.sim.state === 'between') wavesSeen++;
      return out;
    };
    const { cs, results } = both(script, 60 * 120);
    expect(cs[0].hash()).toBe(cs[1].hash());
    expect(results[0].map(([k, r]) => `${k}:${r.ok}:${r.reason ?? ''}`)).toEqual(results[1].map(([k, r]) => `${k}:${r.ok}:${r.reason ?? ''}`));
    expect(results[0].filter(([k, r]) => k === 'hlv' && r.ok).length).toBeGreaterThan(0);
    expect(results[0].filter(([k, r]) => k === 'hmv' && r.ok)).toHaveLength(3);
    expect(cs[0].sim.heroes.map((h) => h.level)).toEqual(cs[1].sim.heroes.map((h) => h.level));
    expect(cs[0].sim.heroes.every((h) => h.level > 3)).toBe(true);
    expect(wavesSeen).toBeGreaterThan(0);
  });

  it('a wave clear lands between queue and apply → hlv refused stale, wallet unchanged', () => {
    const c = createCoopSim(START, { mySlot: 1 });
    c.apply({ t: 0, p: 1, s: 0, k: 'place', a: ['hikari', ...SPOTS[1]] });
    const seen = c.sim.heroLevelStatus(); // Lv 2 for its price, on the guest's own view
    expect(seen).toMatchObject({ level: 1, reason: null });
    c.apply({ t: 0, p: 0, s: 1, k: 'wave', a: [] });
    for (let i = 0; i < 60 * 60 && c.sim.heroes[1].level < 2; i++) c.step(); // she levels before the command lands
    expect(c.sim.heroes[1].level).toBe(2);
    const wallet = c.wallets[1];
    expect(c.apply({ t: c.tick, p: 1, s: 2, k: 'hlv', a: [seen.level + 1, seen.price] })).toEqual({ ok: false, reason: 'stale' });
    expect(c.wallets[1]).toBe(wallet);
  });

  it('reasons pass through: noHero, cash, max; the guest ult fires the guest hero', () => {
    const c = createCoopSim(START, { mySlot: 0 });
    expect(c.apply({ t: 0, p: 1, s: 0, k: 'hlv', a: [2, 999] })).toEqual({ ok: false, reason: 'noHero' });
    expect(c.apply({ t: 0, p: 1, s: 1, k: 'hmv', a: SPOTS[1] })).toEqual({ ok: false, reason: 'noHero' });
    c.apply({ t: 0, p: 0, s: 2, k: 'place', a: ['hikari', ...SPOTS[0]] });
    c.apply({ t: 0, p: 1, s: 3, k: 'place', a: ['hikari', ...SPOTS[1]] });
    const [w0, w1] = c.wallets;
    expect(w0).toBeGreaterThan(0); // placing a hero is free
    expect(c.apply({ t: 0, p: 1, s: 4, k: 'hlv', a: [2, 1e6] })).toMatchObject({ ok: true });
    expect(c.wallets[0]).toBe(w0); // paid from the guest's own wallet
    expect(c.wallets[1]).toBeLessThan(w1);
    c.sim.heroes[0].xp = 0;
    while (c.wallets[1] > 0 && c.apply({ t: 0, p: 1, s: 5, k: 'hlv', a: [c.sim.heroes[1].level + 1, 1e6] }).ok);
    expect(c.apply({ t: 0, p: 1, s: 6, k: 'hlv', a: [c.sim.heroes[1].level + 1, 1e6] })).toEqual({ ok: false, reason: 'cash' });
    const g = c.sim.heroes[1];
    g.ultUnlocked = true;
    g.ultCooldown = 0;
    c.sim.heroes[0].ultUnlocked = true;
    c.sim.heroes[0].ultCooldown = 50;
    expect(c.apply({ t: 0, p: 1, s: 7, k: 'ult', a: [] })).toEqual({ ok: true });
    expect(g.ultCooldown).toBeGreaterThan(0);
    expect(c.sim.heroes[0].ultCooldown).toBe(50);
    c.sim._credit(g, 1e9); // to Lv 25
    expect(c.apply({ t: 0, p: 1, s: 8, k: 'hlv', a: [26, 1e6] })).toEqual({ ok: false, reason: 'max' });
    expect(c.apply({ t: 0, p: 1, s: 9, k: 'hlv', a: ['x', 1] })).toEqual({ ok: false, reason: 'invalid' });
  });

  it('selling a hero is refused and she stays hers', () => {
    const c = createCoopSim(START);
    c.apply({ t: 0, p: 0, s: 0, k: 'place', a: ['hikari', ...SPOTS[0]] });
    const h = c.sim.heroes[0];
    expect(c.apply({ t: 0, p: 0, s: 1, k: 'sell', a: [h.uid] })).toEqual({ ok: false, reason: 'hero' });
    expect(c.ownerOf(h.uid)).toBe(0);
    expect(c.sim.getTower(h.uid)).toBe(h);
    expect(c.apply({ t: 0, p: 1, s: 2, k: 'sell', a: [h.uid] })).toEqual({ ok: false, reason: 'notYours' });
  });

  it('a checkpoint built by the host restores on the guest with the guest view kept', () => {
    const host = createCoopSim(START, { mySlot: 0 });
    const guest = createCoopSim(START, { mySlot: 1 });
    for (const c of [host, guest]) {
      c.apply({ t: 0, p: 0, s: 0, k: 'place', a: ['hikari', ...SPOTS[0]] });
      c.apply({ t: 0, p: 1, s: 1, k: 'place', a: ['hikari', ...SPOTS[1]] });
      c.apply({ t: 0, p: 0, s: 2, k: 'wave', a: [] });
      for (let i = 0; i < 600; i++) c.step();
    }
    const fresh = createCoopSim(START, { mySlot: 1 });
    fresh.restore(JSON.parse(JSON.stringify(host.snapshot())));
    expect(fresh.hash()).toBe(guest.hash());
    expect(fresh.sim.hero).toBe(fresh.sim.heroes[1]);
    expect(fresh.sim.heroConfig).toBe(fresh.sim.heroConfigs[1]);
    for (let i = 0; i < 600; i++) {
      fresh.step();
      guest.step();
    }
    expect(fresh.hash()).toBe(guest.hash());
  });
});
