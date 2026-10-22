// Generic ability FX (src/render/abilityFx.js; ABILITIES_SPEC §8.5): every ability event draws on a stub FX layer,
// per-frame caps hold, unknown events pass through, and Reduce motion keeps everything to opacity fades (no ring
// changes size, nothing flies or rises, no shake).
import { describe, it, expect } from 'vitest';
import { createAbilityFx, ABILITY_FX_CAPS, ABILITY_FX_EVENTS } from '../../src/render/abilityFx.js';

function stubFx() {
  const calls = [];
  const rec = (name) => (...args) => calls.push({ name, args });
  return {
    calls,
    R: { glow: 'glow', ringSoft: 'ringSoft', ringDashed: 'ringDashed', smoke: 'smoke', coin: 'coin' },
    segments: [],
    spawn: rec('spawn'),
    ring: rec('ring'),
    flash: rec('flash'),
    puff: rec('puff'),
    sparkle: rec('sparkle'),
    coin: rec('coin'),
    text: rec('text'),
    shards: rec('shards'),
    explosion: rec('explosion'),
  };
}
function stubSim() {
  const towers = new Map([[1, { uid: 1, x: 4, y: 5 }], [2, { uid: 2, x: 6, y: 5 }], [3, { uid: 3, x: 7, y: 2 }]]);
  const enemies = Array.from({ length: 30 }, (_, i) => ({ uid: 100 + i, x: 1 + i * 0.3, y: 3, dead: false }));
  return { getTower: (u) => towers.get(u) || null, enemies };
}
const EVENTS = [
  { type: 'ability', towerUid: 1, id: 'aoi.skyfall', kind: 'strike', scope: 'local', x: 4, y: 5, radius: 5.4, targets: [100, 101, 102] },
  { type: 'ability', towerUid: 1, id: 'akane.starmine', kind: 'burst', scope: 'local', x: 3, y: 3, radius: 1.2, targets: [100] },
  { type: 'ability', towerUid: 1, id: 'miko.chorus', kind: 'rally', scope: 'local', x: 4, y: 5, radius: 4, targets: [2, 3] },
  { type: 'ability', towerUid: 1, id: 'hotaru.hush', kind: 'debuff', scope: 'map', x: 4, y: 5, radius: 0, targets: [100, 101] },
  { type: 'ability', towerUid: 1, id: 'yuzuha.emergencyDeploy', kind: 'deploy', scope: 'local', x: 3, y: 4, radius: 3, targets: [], placed: 3 },
  { type: 'ability', towerUid: 1, id: 'momo.marketDay', kind: 'econ', scope: 'player', x: 4, y: 5, radius: 0, targets: [], coins: 100 },
  { type: 'ability', towerUid: 1, id: 'rei.hurricane', kind: 'boost', scope: 'local', x: 4, y: 5, radius: 3, targets: [] },
  { type: 'abilityWarn', towerUid: 1, id: 'akane.starmine', x: 3, y: 3, radius: 1.2, delay: 0.5, shells: 6 },
  { type: 'abilityWarn', towerUid: 1, id: 'shiro.verdict', x: 1, y: 3, radius: 0, delay: 1, targets: [100, 101] },
  { type: 'abilityShell', towerUid: 1, id: 'akane.starmine', x: 3, y: 3, radius: 1.2, hits: 2 },
  { type: 'abilityFizzle', towerUid: 1, id: 'shiro.verdict', uid: 104 },
  { type: 'abilityFizzle', towerUid: 1, id: 'akane.starmine', uid: -1 },
  { type: 'abilityUnlock', towerUid: 1, id: 'aoi.skyfall' },
  { type: 'abilityUpgrade', towerUid: 1, id: 'aoi.skyfall' },
];

describe('ability FX', () => {
  it('every ability event draws something on the FX layer; other events pass through', () => {
    for (const ev of EVENTS) {
      const fx = stubFx();
      const a = createAbilityFx({ sim: stubSim(), fx, colorOf: () => '#ff7aa8' });
      a.frame();
      expect(a.handle(ev), ev.type).toBe(true);
      expect(fx.calls.length + fx.segments.length, `${ev.type} ${ev.kind || ''}`).toBeGreaterThan(0);
    }
    const fx = stubFx();
    const a = createAbilityFx({ sim: stubSim(), fx });
    for (const type of ['hit', 'explode', 'abilityReady', 'abilityEnd', 'cash']) expect(a.handle({ type })).toBe(false);
    expect(fx.calls).toEqual([]);
    for (const ev of EVENTS) expect(ABILITY_FX_EVENTS.has(ev.type)).toBe(true);
  });

  it('a strike draws one line from her to each target; a rally lifts each buffed girl; econ pops coins', () => {
    const fx = stubFx();
    const a = createAbilityFx({ sim: stubSim(), fx });
    a.frame();
    a.handle(EVENTS[0]);
    expect(fx.segments.length).toBe(3);
    expect(fx.segments[0]).toMatchObject({ ax: 4, az: 5, bx: 1, bz: 3 });
    a.handle(EVENTS[2]);
    expect(fx.calls.filter((c) => c.name === 'sparkle').map((c) => [c.args[0], c.args[1]])).toEqual([[6, 5], [7, 2]]);
    a.handle(EVENTS[5]);
    expect(fx.calls.some((c) => c.name === 'coin' && c.args[3] === 100)).toBe(true);
  });

  it('per-frame caps: lines, rings, puffs and events stop at their budget and start again next frame', () => {
    const fx = stubFx();
    const a = createAbilityFx({ sim: stubSim(), fx });
    a.frame();
    const big = { type: 'ability', towerUid: 1, kind: 'strike', x: 4, y: 5, radius: 3, targets: Array.from({ length: 30 }, (_, i) => 100 + i) };
    a.handle(big);
    expect(fx.segments.length).toBe(ABILITY_FX_CAPS.lines);
    for (let i = 0; i < 40; i++) a.handle(EVENTS[2]);
    const u = a.used;
    for (const k of Object.keys(ABILITY_FX_CAPS)) expect(u[k], k).toBeLessThanOrEqual(ABILITY_FX_CAPS[k]);
    expect(u.events).toBe(ABILITY_FX_CAPS.events);
    const before = fx.calls.length;
    expect(a.handle(EVENTS[2])).toBe(true); // over budget: still this layer's, drawn no more
    expect(fx.calls.length).toBe(before);
    a.frame();
    expect(a.used).toEqual({ events: 0, lines: 0, rings: 0, puffs: 0 });
    a.handle(EVENTS[2]);
    expect(fx.calls.length).toBeGreaterThan(before);
  });

  it('Reduce motion: opacity fades only (no ring grows, nothing moves, no puffs that fly, no shake)', () => {
    const fx = stubFx();
    let shakes = 0;
    let flashes = 0;
    const a = createAbilityFx({ sim: stubSim(), fx, reduceMotion: true, shake: () => shakes++, flash: () => flashes++ });
    for (const ev of EVENTS) {
      a.frame();
      a.handle(ev);
    }
    expect(fx.calls.length).toBeGreaterThan(10);
    for (const c of fx.calls) {
      expect(['puff', 'sparkle', 'shards', 'explosion', 'flash', 'coin'], `${c.name} moves`).not.toContain(c.name);
      if (c.name === 'ring') expect(c.args[2], 'a ring keeps its size').toBe(c.args[3]);
      if (c.name === 'spawn') {
        const o = c.args[0];
        expect(o.s0, 'a sprite keeps its size').toBe(o.s1);
        expect(o.vx || 0).toBe(0);
        expect(o.vy || 0).toBe(0);
        expect(o.vz || 0).toBe(0);
        expect(o.a1 ?? 0).toBeLessThan(o.a0 ?? 1); // it fades
      }
      expect(c.name, 'no floating text (it pops in size)').not.toBe('text');
    }
    expect(shakes).toBe(0);
    // the map-wide flash still goes through the renderer's flash damping (strength is cut there under Reduce motion)
    expect(flashes).toBeLessThanOrEqual(1);
  });

  it('full motion: bursts shake a little, rings grow', () => {
    const fx = stubFx();
    let shakes = 0;
    const a = createAbilityFx({ sim: stubSim(), fx, shake: () => shakes++ });
    a.frame();
    a.handle(EVENTS[1]);
    expect(shakes).toBe(1);
    expect(fx.calls.filter((c) => c.name === 'ring').some((c) => c.args[2] < c.args[3])).toBe(true);
  });
});
