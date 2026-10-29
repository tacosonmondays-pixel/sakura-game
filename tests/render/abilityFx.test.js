// Generic ability FX (src/render/abilityFx.js; ABILITIES_SPEC §8.5): every ability event draws on a stub FX layer,
// per-frame caps hold, unknown events pass through, and Reduce motion keeps everything to opacity fades (no ring
// changes size, nothing flies or rises, no shake).
import { describe, it, expect } from 'vitest';
import { createAbilityFx, ABILITY_FX_CAPS, ABILITY_FX_EVENTS, SWOOP_COLORS, STRIKE_DROP, HORIZON_COLORS } from '../../src/render/abilityFx.js';

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
    chain: rec('chain'),
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
  // A3 M3: a chain strike, a companion's strike, a life brought back
  { type: 'ability', towerUid: 1, id: 'seiran.stormLance', kind: 'strike', scope: 'local', x: 4, y: 5, radius: 4, targets: [102, 100, 101] },
  { type: 'ability', towerUid: 1, id: 'hana.swoop', kind: 'strike', scope: 'map', x: 4, y: 5, radius: 0, targets: [100, 101] },
  { type: 'lifeRestored', towerUid: 2, lives: 18, n: 1, id: 'noa.firstAid' },
  // Tenka's LR Event Horizon: the pull over the blast's area, then its second detonation
  { type: 'abilityHorizon', towerUid: 1, id: 'tenka.criticalMass', x: 3, y: 3, radius: 2, time: 1.5 },
  { type: 'abilityShell', towerUid: 1, id: 'tenka.criticalMass', x: 3, y: 3, radius: 2, hits: 3, horizon: true },
  // A5: a move (Backdraft Fan's gust; the last event, which its own test replays)
  { type: 'ability', towerUid: 1, id: 'fuu.backdraft', kind: 'move', scope: 'local', x: 4, y: 5, radius: 4.5, targets: [100, 101, 102], moved: 3 },
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

  it('a move: her reach\'s edge, a fan of five wind glows sweeping toward the crowd, a puff on each enemy it reached', () => {
    const fx = stubFx();
    const a = createAbilityFx({ sim: stubSim(), fx, colorOf: () => '#4f9e88' });
    a.frame();
    a.handle(EVENTS[EVENTS.length - 1]);
    expect(fx.calls.some((c) => c.name === 'ring' && c.args[0] === 4 && c.args[1] === 5 && c.args[3] === 4.5)).toBe(true);
    const fan = fx.calls.filter((c) => c.name === 'spawn' && c.args[0].life === 0.5 && c.args[0].vx != null);
    expect(fan).toHaveLength(5);
    // (the targets lie to the west and north of her: the fan sweeps that way)
    for (const c of fan) expect(c.args[0].vx).toBeLessThan(0);
    // one puff on each enemy it reached, where it stands
    expect(fx.calls.filter((c) => c.name === 'puff').map((c) => c.args[0])).toEqual([0, 1, 2].map((i) => 1 + i * 0.3));
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
    expect(a.used).toEqual({ events: 0, lines: 0, rings: 0, puffs: 0, strikes: 0 });
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

  it('Storm Lance: a line per link from her through its targets in strike order, crackling lightning on top; Reduce motion: the lines alone', () => {
    const fx = stubFx();
    const a = createAbilityFx({ sim: stubSim(), fx });
    a.frame();
    a.handle(EVENTS.find((e) => e.id === 'seiran.stormLance'));
    const chain = fx.calls.filter((c) => c.name === 'chain');
    expect(chain).toHaveLength(1);
    // from her (4, 5) to 102 (x 1.6), 100 (x 1), 101 (x 1.3), all at y 3 (stubSim: the sim's spots without views)
    expect(chain[0].args[0].map(([x, z]) => [Math.round(x * 10) / 10, z])).toEqual([[4, 5], [1.6, 3], [1, 3], [1.3, 3]]);
    expect(fx.segments.map((s) => [Math.round(s.ax * 10) / 10, Math.round(s.bx * 10) / 10])).toEqual([[4, 1.6], [1.6, 1], [1, 1.3]]);
    expect(fx.segments[0].life).toBeGreaterThan(0.4); // (it outlasts the 0.2 s crackle)
    const rm = stubFx();
    const b = createAbilityFx({ sim: stubSim(), fx: rm, reduceMotion: true });
    b.frame();
    b.handle(EVENTS.find((e) => e.id === 'seiran.stormLance'));
    expect(rm.calls.filter((c) => c.name === 'chain')).toHaveLength(0);
    expect(rm.segments.map((s) => [Math.round(s.bx * 10) / 10, s.bz])).toEqual([[1.6, 3], [1, 3], [1.3, 3]]);
    expect(rm.segments[1]).toMatchObject({ ax: 1.6 }); // link by link, not all from her
  });

  it('Moon Pounce: Kon draws it (a mark on the target only); without him, the generic line from his spot', () => {
    const pounce = { type: 'ability', towerUid: 1, id: 'ruri.moonPounce', kind: 'strike', scope: 'local', x: 3.2, y: 4.1, radius: 4.4, targets: [100] };
    const fx = stubFx();
    const a = createAbilityFx({ sim: stubSim(), fx, companionOn: (uid) => uid === 1 });
    a.frame();
    a.handle(pounce);
    expect(fx.segments).toHaveLength(0);
    expect(fx.calls.filter((c) => c.name === 'ring').map((c) => [c.args[0], c.args[1]])).toEqual(expect.arrayContaining([[1, 3]]));
    const fb = stubFx();
    const b = createAbilityFx({ sim: stubSim(), fx: fb });
    b.frame();
    b.handle(pounce);
    // Moon Pounce's line starts where Kon stood (the event's point), not at Ruri
    expect(fb.segments).toHaveLength(1);
    expect(fb.segments[0]).toMatchObject({ ax: 3.2, az: 4.1 });
  });

  // M3 review round 2: a far Swoop target showed only a thin plain ring in the element's pale blue
  describe('Kaze\'s Swoop: Hana\'s call, then a feather strike from the sky on every target Kaze\'s figure does not dive on', () => {
    const swoop = EVENTS.find((e) => e.id === 'hana.swoop'); // Hana = tower 1 at (4, 5); targets 100 (x 1), 101 (x 1.3) at y 3
    const fxWithSprites = () => {
      const fx = stubFx();
      fx.R.hawk = 'hawk';
      fx.R.feather = 'feather';
      return fx;
    };
    const spawns = (fx, uv) => fx.calls.filter((c) => c.name === 'spawn' && c.args[0].uv === uv).map((c) => c.args[0]);
    /** The streaks that drop onto (x, z) from above. */
    const drops = (fx, x, z) => fx.segments.filter((s) => s.bx === x && s.bz === z && s.ay - s.by >= STRIKE_DROP - 1e-9);
    const hex = (c) => `#${c.getHexString()}`;

    it('Kaze drawn and diving on the near one (100): the far one (101) takes the strike, the near one the gold burst only; no plain ring on either', () => {
      const fx = fxWithSprites();
      const a = createAbilityFx({ sim: stubSim(), fx, colorOf: () => '#a8d8ff', companionOn: (uid) => uid === 1, companionDives: () => [100] });
      a.frame();
      a.handle(swoop);
      // her call: a gold streak rising from her
      const call = fx.segments.find((s) => s.ax === 4 && s.az === 5);
      expect(call.by).toBeGreaterThan(call.ay + STRIKE_DROP);
      expect(hex(call.color)).toBe(SWOOP_COLORS.gold);
      // the far target: a gold streak dropping from the sky, Kaze's silhouette diving down it, his feathers bursting
      expect(drops(fx, 1.3, 3)).toHaveLength(1);
      expect(drops(fx, 1.3, 3)[0].w).toBeGreaterThan(0.3);
      expect(drops(fx, 1, 3)).toHaveLength(0); // the near one is his figure's
      const hawks = spawns(fx, 'hawk');
      expect(hawks).toHaveLength(1);
      expect(hawks[0].color).toBe(SWOOP_COLORS.kaze);
      expect(hawks[0].y).toBeCloseTo(0.45 + STRIKE_DROP, 6); // from the sky over the target (the stub's enemy height 0.45)
      expect(hawks[0].x + hawks[0].vx * hawks[0].life).toBeCloseTo(1.3, 6); // it lands on the target
      expect(hawks[0].y + hawks[0].vy * hawks[0].life).toBeCloseTo(0.45, 6);
      expect(hawks[0].vy).toBeLessThan(0);
      expect(hawks[0].s0).toBeGreaterThanOrEqual(0.7); // big enough to read at 844
      const feathers = spawns(fx, 'feather');
      expect(feathers.length).toBeGreaterThanOrEqual(5);
      expect(feathers.every((f) => f.x === 1.3 && f.fadeIn > 0)).toBe(true);
      // the gold bursts: one on each target, peaking as the dive lands
      const bursts = spawns(fx, 'glow').filter((g) => g.color === SWOOP_COLORS.gold && g.z === 3);
      expect(bursts.map((g) => g.x).sort()).toEqual([1, 1.3]);
      expect(bursts.every((g) => g.fadeIn > 0 && g.s0 >= 1.3)).toBe(true);
      // no thin ring in the element colour on the targets (the plain-circle Don't), and nothing in it on them
      expect(fx.calls.filter((c) => c.name === 'ring' && c.args[1] === 3)).toEqual([]);
      expect(fx.calls.filter((c) => c.name === 'spawn' && c.args[0].z === 3 && c.args[0].color === '#a8d8ff')).toEqual([]);
    });

    it('every target beyond his dives (all far, or no figure drawn): a strike each; a T5 crowd stops at the strike budget', () => {
      for (const o of [{ companionOn: () => true, companionDives: () => [] }, {}]) {
        const fx = fxWithSprites();
        const a = createAbilityFx({ sim: stubSim(), fx, ...o });
        a.frame();
        a.handle(swoop);
        expect(drops(fx, 1, 3)).toHaveLength(1);
        expect(drops(fx, 1.3, 3)).toHaveLength(1);
        expect(spawns(fx, 'hawk')).toHaveLength(2);
        // not the generic lines from her to them
        expect(fx.segments.filter((s) => s.ax === 4 && s.az === 5 && s.bz === 3)).toEqual([]);
      }
      const fx = fxWithSprites();
      const a = createAbilityFx({ sim: stubSim(), fx });
      a.frame();
      a.handle({ ...swoop, targets: Array.from({ length: 30 }, (_, i) => 100 + i) });
      expect(spawns(fx, 'hawk')).toHaveLength(ABILITY_FX_CAPS.strikes);
      expect(a.used.strikes).toBe(ABILITY_FX_CAPS.strikes);
      expect(a.used.lines).toBeLessThanOrEqual(ABILITY_FX_CAPS.lines);
    });

    it('Reduce motion: the same strike as still fades — Kaze\'s silhouette over the target, three feathers, the burst, the streak; nothing moves or grows', () => {
      const fx = fxWithSprites();
      const a = createAbilityFx({ sim: stubSim(), fx, reduceMotion: true, companionOn: () => true, companionDives: () => [] });
      a.frame();
      a.handle(swoop);
      expect(drops(fx, 1, 3)).toHaveLength(1);
      const hawks = spawns(fx, 'hawk');
      expect(hawks).toHaveLength(2);
      expect(spawns(fx, 'feather')).toHaveLength(6);
      for (const c of fx.calls) {
        expect(c.name).not.toMatch(/^(puff|sparkle|flash|text)$/);
        if (c.name !== 'spawn') continue;
        const o = c.args[0];
        expect([o.s0 === o.s1, o.vx || 0, o.vy || 0, o.vz || 0, o.vrot || 0, o.a1 < o.a0], o.uv).toEqual([true, 0, 0, 0, 0, true]);
      }
    });
  });

  it('a life brought back: a heart rising over the girl with "+1"; Reduce motion: a still heart that fades, no text', () => {
    const life = EVENTS.find((e) => e.type === 'lifeRestored');
    const fx = stubFx();
    fx.R.heart = 'heart';
    const a = createAbilityFx({ sim: stubSim(), fx });
    a.frame();
    expect(a.handle(life)).toBe(true);
    const hs = fx.calls.filter((c) => c.name === 'spawn' && c.args[0].uv === 'heart');
    expect(hs).toHaveLength(1);
    expect(hs[0].args[0]).toMatchObject({ x: 6, z: 5 }); // over Noa (tower 2)
    expect(hs[0].args[0].vy).toBeGreaterThan(0);
    expect(fx.calls.find((c) => c.name === 'text').args[0]).toBe('+1');
    const rm = stubFx();
    rm.R.heart = 'heart';
    const b = createAbilityFx({ sim: stubSim(), fx: rm, reduceMotion: true });
    b.frame();
    b.handle(life);
    const h = rm.calls.find((c) => c.name === 'spawn').args[0];
    expect([h.uv, h.s0 === h.s1, h.vy || 0, h.a1 < h.a0]).toEqual(['heart', true, 0, true]);
    expect(rm.calls.some((c) => c.name === 'text')).toBe(false);
  });

  it('Event Horizon: thin rings collapse onto the centre for the whole pull, the second detonation adds a white ring; Reduce motion: a still ring that fades', () => {
    const [pull, blast] = EVENTS.filter((e) => e.id === 'tenka.criticalMass' && (e.type === 'abilityHorizon' || e.horizon));
    const fx = stubFx();
    let shakes = 0;
    const a = createAbilityFx({ sim: stubSim(), fx, shake: () => shakes++ });
    a.frame();
    a.handle(pull);
    const rings = fx.calls.filter((c) => c.name === 'ring');
    expect(rings.length).toBe(2);
    // (x, z, r0, r1, life, colour): from the edge (2 tiles) and inside it toward the centre, over the 1.5 s pull
    expect(rings[0].args.slice(0, 6)).toEqual([3, 3, 2, 0.15, 1.5, HORIZON_COLORS.ring]);
    expect(rings.every((c) => c.args[2] > c.args[3] && c.args[6].a0 <= 0.55 && c.args[6].additive === false)).toBe(true);
    expect(shakes).toBe(0); // gentle: the pull never shakes
    fx.calls.length = 0;
    a.handle(blast);
    expect(fx.calls.filter((c) => c.name === 'ring').map((c) => c.args[5])).toEqual(expect.arrayContaining([HORIZON_COLORS.ring, HORIZON_COLORS.core]));
    expect(shakes).toBe(1);
    const rm = stubFx();
    const b = createAbilityFx({ sim: stubSim(), fx: rm, reduceMotion: true });
    b.frame();
    b.handle(pull);
    expect(rm.calls.filter((c) => c.name === 'ring').map((c) => c.args.slice(2, 5))).toEqual([[2, 2, 1.5]]);
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
