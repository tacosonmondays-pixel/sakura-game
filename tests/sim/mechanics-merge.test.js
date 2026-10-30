// Roster B3 mechanics (docs/merge/ROSTER_SPEC.md §6, docs/specs/UNIT_GAPS.md §4.1 / §7): aim points,
// mortar shells, relay origins (familiar, mirror, two firing points), grounding + the flyer bonus +
// Air targeting, the push lock and gather, curse spread with the per-step burst budget, hex, beam
// ramp, the strike / aimed nova / runner ults and the team damage buff, the co-op `aim` command, and
// determinism. Fixture units only (tests/sim/fixtures.js), never the real girls.
import { describe, test, expect } from 'vitest';
import { makeSim, startEmptyWave, run, MECH_TOWER_IDS, TOWER_IDS } from './fixtures.js';
import { activateUlt } from '../../src/sim/hero.js';
import { CURSE_BURSTS_PER_TICK, CURSE_SPREAD_STEPS, CURSE_SPREAD_RADIUS, CURSE_SPREAD_DECAY, CURSE_SPREAD_MAX_DEPTH, CURSE_SPREADS_PER_TICK, CURSE_ROT_BOSS_MUL, PUSH_LOCK, PUSH_LOCK_KITS, HEX_BOSS_CAP, MORTAR_DELAY, STEP } from '../../src/sim/constants.js';
import { aimMode, relayOrigin } from '../../src/sim/towers.js';
import { runnerSegment } from '../../src/sim/runners.js';

const ALL = [...TOWER_IDS, ...MECH_TOWER_IDS];

/** A sim with every fixture tower (and an optional hero), a wave running and no spawns. */
function sim(opts = {}) {
  const s = makeSim({ towers: ALL, cash: 1e9, ...opts });
  startEmptyWave(s);
  return s;
}

/** Places a girl on the first legal spot scanning from (x0, y0). */
function place(s, id, x0 = 2, y0 = 2.5) {
  for (let y = y0; y < s.map.height; y += 0.25) {
    for (let x = x0; x < s.map.width; x += 0.25) {
      if (s.canPlace(id, x, y).ok) return s.placeTower(id, x, y);
    }
  }
  throw new Error(`no spot for ${id}`);
}

const spawn = (s, id, dist, over = {}) => Object.assign(s.spawnEnemy(id, { dist }), over);
const near = (e, x, y) => Math.hypot(e.x - x, e.y - y);

describe('aim points', () => {
  test('only girls with an aim mode accept one; quantised, clamped, cleared, event', () => {
    const s = sim();
    const plain = place(s, TOWER_IDS[0]);
    const m = place(s, 'mortarer', 6);
    expect(aimMode(plain)).toBe(null);
    expect(aimMode(m)).toBe('mortar');
    expect(s.setAim(plain.uid, 3, 3)).toBe(false);
    expect(s.setAim(m.uid, 3.12345, 4.98765)).toBe(true);
    expect(m.aim.x * 1024).toBe(Math.round(m.aim.x * 1024));
    expect(s.setAim(m.uid, 999, -5)).toBe(true);
    expect(m.aim).toEqual({ x: s.map.width, y: 0 });
    expect(s.setAim(m.uid, NaN, 1)).toBe(false);
    s.events.length = 0;
    expect(s.clearAim(m.uid)).toBe(true);
    expect(m.aim).toBe(null);
    expect(s.events.some((e) => e.type === 'aim' && e.x === null)).toBe(true);
  });

  test('a mirror aim is clamped to her reach and moves her origin', () => {
    const s = sim();
    const t = place(s, 'mirrorer');
    expect(s.setAim(t.uid, t.x + 20, t.y)).toBe(true);
    expect(Math.hypot(t.aim.x - t.x, t.aim.y - t.y)).toBeCloseTo(3.7, 2);
    expect(t.ox).toBe(t.aim.x);
    expect(t.oy).toBe(t.aim.y);
  });
});

describe('mortar', () => {
  test('no damage before the delay, damage after; the shell carries a fire-time spec', () => {
    const s = sim();
    const t = place(s, 'mortarer');
    const e = spawn(s, 'tank', 6, { speed: 0 });
    e.speed = 0;
    s.setAim(t.uid, e.x, e.y);
    const hp0 = e.hp;
    run(s, STEP * 2);
    expect(s.shells.length).toBeGreaterThan(0);
    expect(e.hp).toBe(hp0);
    run(s, MORTAR_DELAY + 0.1);
    expect(e.hp).toBeLessThan(hp0);
  });

  test('an aimed mortar idles with nothing near the aim; selling drops pending shells; shells end at the wave clear', () => {
    const s = sim();
    const t = place(s, 'mortarer');
    spawn(s, 'tank', 2);
    s.setAim(t.uid, s.map.width - 0.5, 0.5);
    run(s, 1);
    expect(s.shells.length).toBe(0);
    s.clearAim(t.uid);
    run(s, STEP * 3);
    expect(s.shells.length).toBeGreaterThan(0);
    s.sellTower(t.uid);
    expect(s.shells.length).toBe(0);
  });
});

describe('relay origins', () => {
  test('a familiar stands short of the nearest lane sample, never past her reach', () => {
    const s = sim();
    const t = place(s, 'familiar', 2, 0.5);
    const d = Math.hypot(t.ox - t.x, t.oy - t.y);
    expect(d).toBeLessThanOrEqual(2 + 1e-9);
    expect(t.origin).not.toBe(null);
    // the pure helper agrees (the placement ghost uses it)
    expect(relayOrigin(s._relaySamples, t.x, t.y, t.stats.relay)).toEqual(t.origin);
  });

  test('two firing points: she volleys from the mirror and from where she stands', () => {
    const s = sim();
    const a = spawn(s, 'tank', 3, { speed: 0 });
    const b = spawn(s, 'tank', 12, { speed: 0 });
    a.speed = 0;
    b.speed = 0;
    const t = place(s, 'twinmirror', a.x - 0.5, a.y - 1.6);
    expect(Math.hypot(a.x - t.x, a.y - t.y)).toBeLessThan(2.3);
    s.setAim(t.uid, t.x + 3.6, a.y);
    expect(Math.hypot(t.ox - t.x, t.oy - t.y)).toBeGreaterThan(3);
    const hits = { a: a.hp, b: b.hp };
    run(s, 2);
    expect(a.hp).toBeLessThan(hits.a); // from her own spot
    // the mirror's targets: whatever is in its range (b only when the panel reaches it)
    const viaMirror = Math.hypot(b.x - t.ox, b.y - t.oy) <= t.eff.range;
    if (viaMirror) expect(b.hp).toBeLessThan(hits.b);
    // without "both", only the panel fires: the enemy beside her but out of the panel's range is safe
    const s2 = sim();
    const a2 = spawn(s2, 'tank', 3, { speed: 0 });
    a2.speed = 0;
    const m = place(s2, 'mirrorer', a2.x - 0.5, a2.y - 1.6);
    s2.setAim(m.uid, m.x + 3.6, a2.y);
    const a20 = a2.hp;
    run(s2, 2);
    if (Math.hypot(a2.x - m.ox, a2.y - m.oy) > m.eff.range) expect(a2.hp).toBe(a20);
  });
});

describe('grounding, flyer bonus, Air targeting', () => {
  test('a ground-only girl hits a flyer only while it is grounded; alt drops to 0', () => {
    const s = sim();
    const bat = spawn(s, 'bat', 5);
    expect(s.data.unit('mortarer').base.canHitAir).toBe(false);
    s._applyStatusEvent(bat, { type: 'ground', duration: 1 }, s._statusCtx);
    s._step(STEP);
    expect(bat.grounded).toBe(true);
    expect(bat.alt).toBe(0);
    run(s, 1.2);
    expect(bat.grounded).toBe(false);
  });

  test('bosses stay grounded a quarter as long; non-flyers are never grounded', () => {
    const s = sim();
    const big = spawn(s, 'bigbat', 5);
    s._applyStatusEvent(big, { type: 'ground', duration: 4 }, s._statusCtx);
    expect(big.statuses.ground.left).toBeCloseTo(1, 6);
    const brute = spawn(s, 'brute', 4);
    s._applyStatusEvent(brute, { type: 'ground', duration: 4 }, s._statusCtx);
    expect(brute.statuses.ground).toBeUndefined();
  });

  test('the falconer defaults to Air targeting', () => {
    const s = sim();
    expect(place(s, 'falcon').targetMode).toBe('air');
  });
});

describe('push lock and gather', () => {
  test('a second push within the lock does nothing; it works again after; bosses never move', () => {
    const s = sim();
    const e = spawn(s, 'tank', 8);
    const spec = { knockback: 1, attackType: 'mystic', pushLock: true };
    s._onHitEffects(e, null, spec);
    const d1 = e.dist;
    s._onHitEffects(e, null, spec);
    expect(e.dist).toBe(d1);
    run(s, PUSH_LOCK.normal + 0.05);
    const d2 = e.dist;
    s._onHitEffects(e, null, spec);
    expect(e.dist).toBeLessThan(d2);
    const boss = spawn(s, 'bigboss', 8);
    s._onHitEffects(boss, null, spec);
    expect(boss.dist).toBe(8);
  });

  test('only a kit that opts in locks: the live girls push every hit, as on live', () => {
    const s = sim();
    const e = spawn(s, 'tank', 8);
    s._onHitEffects(e, null, { knockback: 1, attackType: 'blast' });
    const k = 8 - e.dist;
    expect(k).toBeGreaterThan(0);
    s._onHitEffects(e, { unitId: 'aoi' }, { knockback: 1, attackType: 'blast' });
    expect(e.dist).toBeCloseTo(8 - 2 * k, 9);
    expect(e.pushLock).toBe(0);
    s._onHitEffects(e, { unitId: 'fuu' }, { knockback: 1, attackType: 'blast' });
    s._onHitEffects(e, { unitId: 'fuu' }, { knockback: 1, attackType: 'blast' });
    expect(e.dist).toBeCloseTo(8 - 3 * k, 9);
    expect(PUSH_LOCK_KITS).toEqual(['fuu']);
  });

  test('gather pulls only enemies ahead on the same path, never past the target, never minibosses', () => {
    const s = sim();
    const target = spawn(s, 'tank', 5, { speed: 0 });
    const ahead = spawn(s, 'tank', 6, { speed: 0 });
    const behind = spawn(s, 'tank', 4.2, { speed: 0 });
    const mini = spawn(s, 'brute', 5.8, { speed: 0 });
    s.grid.rebuild(s.enemies);
    s._gather(target, 0.5);
    expect(ahead.dist).toBeLessThan(6);
    expect(ahead.dist).toBeGreaterThan(5);
    expect(behind.dist).toBe(4.2);
    expect(mini.dist).toBe(5.8);
  });
});

describe('curse spread and the burst budget', () => {
  test('a cursed kill bursts for burstMul × the cursing hit and passes a weaker curse', () => {
    const s = sim();
    const a = spawn(s, 'tank', 5, { speed: 0 });
    const b = spawn(s, 'tank', 5.3, { speed: 0 });
    s.grid.rebuild(s.enemies);
    const ctx = { ...s._statusCtx, hitDamage: 50, curseDepth: 0 };
    s._applyStatusEvent(a, { type: 'curse', burstMul: 0.8, radius: 1.1, duration: 4 }, ctx);
    expect(a.statuses.curse.burst).toBe(40);
    const hpB = b.hp;
    s._hit(a, null, { damage: 1e9, attackType: 'mystic', critChance: 0, critMul: 1, armorPen: 0, eliteMul: 1, bossMul: 1, barrierMul: 1, detection: true, canHitAir: true, status: [] }, 1);
    expect(b.hp).toBeLessThan(hpB);
    expect(b.statuses.curse.depth).toBe(1);
    expect(b.statuses.curse.burst).toBeCloseTo(40 * 0.6, 9);
  });

  test(`at most ${CURSE_BURSTS_PER_TICK} bursts per step; the rest spill over in FIFO order and the wave still ends`, () => {
    const s = sim();
    const list = [];
    // bursts with a tiny radius, so no burst kills another cursed enemy: exactly 100 queued bursts
    for (let i = 0; i < 100; i++) list.push(spawn(s, 'tank', 0.5 + i * 0.12, { speed: 0 }));
    s.grid.rebuild(s.enemies);
    s._curseBudget = CURSE_BURSTS_PER_TICK;
    for (const e of list) s._applyStatusEvent(e, { type: 'curse', burst: 1, radius: 0.01, duration: 4 }, { ...s._statusCtx, curseDepth: 2 });
    const keeper = spawn(s, 'tank', 15, { speed: 0 }); // the wave goes on (a wave clear drops the queue)
    keeper.speed = 0;
    for (const e of list) s._killEnemy(e, null);
    expect(s._curseQueue.length).toBe(100 - CURSE_BURSTS_PER_TICK);
    s._step(STEP);
    expect(s._curseQueue.length).toBe(Math.max(0, 100 - 2 * CURSE_BURSTS_PER_TICK));
    run(s, 0.2);
    expect(s._curseQueue.length).toBe(0);
    // and a wave clear drops whatever is still queued
    s._curseQueue.push({ x: 0, y: 0, burst: 1, radius: 0.1, duration: 1, depth: 2, sourceUid: null });
    keeper.dead = true;
    s._removeDead();
    s._checkWaveEnd();
    expect(s._curseQueue.length).toBe(0);
  });
});

describe('the spreading hex (a curse that rots spreads while its enemy lives)', () => {
  const steps = (s, n) => {
    for (let i = 0; i < n; i++) s._step(STEP);
  };
  /** Still enemies along the road at these distances (fixture tanks: 1e5 HP, no armor). */
  const row = (s, dists, id = 'tank') => {
    const list = dists.map((d) => spawn(s, id, d, { speed: 0 }));
    s.grid.rebuild(s.enemies);
    return list;
  };
  const hexOn = (s, e, { rot = 0.5, hit = 100, duration = 30, sourceUid = null } = {}) =>
    s._applyStatusEvent(e, { type: 'curse', burstMul: 1, radius: 1, duration, rot }, { ...s._statusCtx, hitDamage: hit, curseDepth: 0, sourceUid });

  test('rot: rot × the cursing hit a second, credited to the curser; bosses take CURSE_ROT_BOSS_MUL of it', () => {
    const s = sim();
    const t = place(s, 'curser', 2, 6.5);
    t.disabled = 1e9; // she does not shoot: only the rot lands
    const [a] = row(s, [3]);
    hexOn(s, a, { rot: 0.5, hit: 100, sourceUid: t.uid });
    expect(a.statuses.curse.rotDps).toBe(50);
    const hp0 = a.hp;
    const d0 = t.damageDealt;
    steps(s, 60);
    expect(hp0 - a.hp).toBeCloseTo(50, 6);
    expect(t.damageDealt - d0).toBeCloseTo(50, 6);
    const s2 = sim();
    const [b] = row(s2, [3], 'bigboss');
    hexOn(s2, b, { rot: 0.5, hit: 100 });
    const b0 = b.hp;
    steps(s2, 60);
    expect(b0 - b.hp).toBeCloseTo(50 * CURSE_ROT_BOSS_MUL, 6);
  });

  test(`every ${CURSE_SPREAD_STEPS} steps it passes a weaker hex to the nearest uncursed enemy within ${CURSE_SPREAD_RADIUS} tiles`, () => {
    const s = sim();
    const [a, b, c, far] = row(s, [3, 3.5, 3.9, 9]);
    expect(near(a, b.x, b.y)).toBeLessThan(near(a, c.x, c.y));
    expect(near(a, c.x, c.y)).toBeLessThan(CURSE_SPREAD_RADIUS);
    hexOn(s, a, { rot: 0.5, hit: 100 });
    steps(s, CURSE_SPREAD_STEPS - 1);
    expect(b.statuses.curse).toBeUndefined();
    steps(s, 1);
    // the nearest first, one at a time: b now, a and b again a full interval later
    expect(b.statuses.curse).toMatchObject({ depth: 1 });
    expect(b.statuses.curse.burst).toBeCloseTo(100 * CURSE_SPREAD_DECAY, 9);
    expect(b.statuses.curse.rotDps).toBeCloseTo(50 * CURSE_SPREAD_DECAY, 9);
    expect(c.statuses.curse).toBeUndefined();
    steps(s, CURSE_SPREAD_STEPS);
    expect(c.statuses.curse).toBeDefined();
    expect(far.statuses.curse).toBeUndefined();
  });

  test(`a living chain stops at generation ${CURSE_SPREAD_MAX_DEPTH}`, () => {
    const s = sim();
    // 0.7 tiles apart: each enemy only reaches its neighbours
    const list = row(s, Array.from({ length: CURSE_SPREAD_MAX_DEPTH + 3 }, (_, i) => 2 + i * 0.7));
    expect(near(list[0], list[2].x, list[2].y)).toBeGreaterThan(CURSE_SPREAD_RADIUS);
    hexOn(s, list[0], { rot: 0.1, hit: 10 });
    steps(s, CURSE_SPREAD_STEPS * (CURSE_SPREAD_MAX_DEPTH + 3));
    const depths = list.map((e) => e.statuses.curse?.depth ?? null);
    expect(depths).toEqual([...Array.from({ length: CURSE_SPREAD_MAX_DEPTH + 1 }, (_, i) => i), null, null]);
  });

  test('two cursers: the rot is credited to the girl whose rot it is, the burst to the girl whose burst it is', () => {
    const s = sim();
    const big = place(s, 'curser', 2, 6.5);
    const rotter = place(s, 'curser', 6, 6.5);
    big.disabled = 1e9;
    rotter.disabled = 1e9;
    const [a, b] = row(s, [3, 3.4]);
    // a big hit with little rot (her burst wins), then a small hit with much rot (her rot wins)
    s._applyStatusEvent(a, { type: 'curse', burstMul: 1, radius: 1, duration: 30, rot: 0.01 }, { ...s._statusCtx, hitDamage: 1000, curseDepth: 0, sourceUid: big.uid });
    s._applyStatusEvent(a, { type: 'curse', burstMul: 1, radius: 1, duration: 30, rot: 1 }, { ...s._statusCtx, hitDamage: 100, curseDepth: 0, sourceUid: rotter.uid });
    expect(a.statuses.curse).toMatchObject({ sourceUid: big.uid, burst: 1000, rotUid: rotter.uid, rotDps: 100 });
    const d0 = [big.damageDealt, rotter.damageDealt];
    steps(s, CURSE_SPREAD_STEPS - 1);
    expect(big.damageDealt - d0[0]).toBe(0);
    expect(rotter.damageDealt - d0[1]).toBeCloseTo(100 * (CURSE_SPREAD_STEPS - 1) / 60, 6);
    steps(s, 1);
    // the passed curse keeps both: its rot is still hers
    expect(b.statuses.curse).toMatchObject({ sourceUid: big.uid, rotUid: rotter.uid });
  });

  test('a cursed enemy inside a tunnel (hidden) keeps rotting but passes nothing on until it comes out', () => {
    const s = sim();
    const [a, b] = row(s, [3, 3.4]);
    hexOn(s, a, { rot: 0.5, hit: 100 });
    const hp0 = a.hp;
    for (let i = 0; i < CURSE_SPREAD_STEPS * 2; i++) {
      a.hidden = true;
      s._step(STEP);
    }
    expect(b.statuses.curse).toBeUndefined();
    expect(hp0 - a.hp).toBeCloseTo(100, 6);
    expect(a.statuses.curse.spreadIn).toBe(0);
    a.hidden = false;
    s._step(STEP);
    if (a.hidden) return; // (the fixture road has no tunnel: placement never hides it)
    expect(b.statuses.curse).toMatchObject({ depth: 1 });
  });

  test('a curse without rot (the fixture curser\'s) never spreads while its enemy lives', () => {
    const s = sim();
    const [a, b] = row(s, [3, 3.4]);
    s._applyStatusEvent(a, { type: 'curse', burstMul: 1, radius: 1, duration: 30 }, { ...s._statusCtx, hitDamage: 100, curseDepth: 0 });
    steps(s, CURSE_SPREAD_STEPS * 3);
    expect(b.statuses.curse).toBeUndefined();
    expect(a.statuses.curse.rotDps).toBe(0);
  });

  test('a cursed boss catches and passes the hex like anyone else', () => {
    const s = sim();
    const [boss] = row(s, [3], 'bigboss');
    const [b] = row(s, [3.5]);
    hexOn(s, boss, { rot: 0.5, hit: 100 });
    steps(s, CURSE_SPREAD_STEPS);
    expect(b.statuses.curse).toMatchObject({ depth: 1 });
    // and an on-death burst carries the rot on, CURSE_DECAY weaker
    const s2 = sim();
    const [x, y] = row(s2, [3, 3.3]);
    hexOn(s2, x, { rot: 0.5, hit: 100 });
    s2._killEnemy(x, null);
    expect(y.statuses.curse.rotDps).toBeCloseTo(50 * 0.6, 9);
  });

  test(`at most ${CURSE_SPREADS_PER_TICK} passes a step; the rest pass on the next step`, () => {
    const s = sim();
    // 100 cursed enemies in one spot and 100 uncursed ones 0.3 tiles on: all 100 are due in the same step
    const cursed = row(s, Array.from({ length: 100 }, () => 2));
    const fresh = row(s, Array.from({ length: 100 }, () => 2.3));
    for (const a of cursed) hexOn(s, a, { rot: 0.01, hit: 1 });
    const caught = () => fresh.filter((b) => b.statuses.curse).length;
    steps(s, CURSE_SPREAD_STEPS - 1);
    expect(caught()).toBe(0);
    steps(s, 1);
    expect(caught()).toBe(CURSE_SPREADS_PER_TICK);
    steps(s, 1);
    expect(caught()).toBe(100);
  });

  test('the same contagion script twice gives the same state, with Math.random and Date.now unusable', () => {
    const script = () => {
      const s = sim();
      const t = place(s, 'curser', 2, 6.5);
      for (let i = 0; i < 40; i++) spawn(s, i % 7 === 0 ? 'bigboss' : 'tank', 0.5 + i * 0.35);
      s.grid.rebuild(s.enemies);
      for (let i = 0; i < 40; i += 9) hexOn(s, s.enemies[i], { rot: 0.4, hit: 300, sourceUid: t.uid });
      const out = [];
      for (let k = 0; k < 600; k++) {
        s.update(STEP);
        if (k % 60 === 0) out.push(JSON.stringify(s.enemies.map((e) => [e.uid, e.hp, e.statuses.curse?.depth ?? -1, e.statuses.curse?.spreadIn ?? -1]).concat([t.damageDealt])));
      }
      return { text: out.join('\n'), maxDepth: Math.max(...s.enemies.map((e) => e.statuses.curse?.depth ?? -1)), cursed: s.enemies.filter((e) => e.statuses.curse).length };
    };
    const r = Math.random;
    const d = Date.now;
    Math.random = () => { throw new Error('Math.random in the sim'); };
    Date.now = () => { throw new Error('Date.now in the sim'); };
    try {
      const a = script();
      expect(a).toEqual(script());
      // the five cards spread to the whole row, generations deep
      expect(a.cursed).toBe(40);
      expect(a.maxDepth).toBeGreaterThanOrEqual(2);
    } finally {
      Math.random = r;
      Date.now = d;
    }
  });
});

describe('hex', () => {
  test('a share of max HP per second, no regen, a miniboss third off and capped per application', () => {
    const s = sim();
    const e = spawn(s, 'tank', 3, { speed: 0 });
    e.speed = 0;
    s._applyStatusEvent(e, { type: 'hex', pct: 0.05, duration: 2 }, s._statusCtx);
    const hp0 = e.hp;
    run(s, 1);
    expect(hp0 - e.hp).toBeCloseTo(0.05 * e.maxHp, 0);
    const boss = spawn(s, 'bigboss', 3, { speed: 0 });
    boss.speed = 0;
    s._applyStatusEvent(boss, { type: 'hex', pct: 0.5, duration: 10 }, s._statusCtx);
    const b0 = boss.hp;
    run(s, 5);
    expect(b0 - boss.hp).toBeLessThanOrEqual(HEX_BOSS_CAP * boss.maxHp + 1e-6);
    expect(b0 - boss.hp).toBeGreaterThan(0);
  });
});

describe('beam ramp', () => {
  test('builds on the same lead target and resets when it switches', () => {
    const s = sim();
    const t = place(s, 'prismer', 2, 0.5);
    const e = spawn(s, 'bigboss', 1, { speed: 0 });
    e.speed = 0;
    run(s, 3);
    expect(t.rampStacks).toBeGreaterThan(1);
    e.dead = true;
    s._removeDead();
    spawn(s, 'bigboss', 1.5, { speed: 0 });
    run(s, 1.1);
    expect(t.rampStacks).toBeLessThanOrEqual(2);
  });
});

describe('hero ults', () => {
  const ready = (s, id) => {
    const h = place(s, id);
    h.ultUnlocked = true;
    h.ultCooldown = 0;
    return h;
  };

  test('strike hits the strongest enemy with armor ignored, splashes 30%, and needs a target', () => {
    const s = sim({ hero: 'striker' });
    const h = ready(s, 'striker');
    expect(activateUlt(s)).toBe(false);
    expect(h.ultCooldown).toBe(0);
    const weak = spawn(s, 'tank', 3, { speed: 0 });
    const strong = spawn(s, 'bigboss', 3.4, { speed: 0 });
    const w0 = weak.hp;
    const s0 = strong.hp;
    expect(activateUlt(s)).toBe(true);
    expect(strong.hp).toBeLessThan(s0);
    expect(weak.hp).toBeLessThan(w0);
    expect(s0 - strong.hp).toBeGreaterThan(w0 - weak.hp);
  });

  test('an aimed nova centres on her aim; a team damage buff raises damage and expires', () => {
    const s = sim({ hero: 'stormer' });
    const h = ready(s, 'stormer');
    expect(aimMode(h)).toBe('ult');
    const far = spawn(s, 'tank', 14, { speed: 0 });
    s.setAim(h.uid, far.x, far.y);
    const f0 = far.hp;
    expect(activateUlt(s)).toBe(true);
    expect(far.hp).toBeLessThan(f0);
    const g = place(s, TOWER_IDS[0], 6);
    const d0 = g.eff.damage;
    s.addGlobalDamageBuff(1.5, 1);
    s._step(STEP);
    expect(g.eff.damage).toBeCloseTo(d0 * 1.5, 9);
    run(s, 1.2);
    expect(g.eff.damage).toBeCloseTo(d0, 9);
  });

  test('the sky dragon runs back along the road from her aim and hits each enemy once', () => {
    const s = sim({ hero: 'dragoner' });
    const h = ready(s, 'dragoner');
    const enemies = [3, 5, 7].map((d) => spawn(s, 'tank', d, { speed: 0 }));
    for (const e of enemies) e.speed = 0;
    const end = s.pathData[0];
    const p = runnerSegment(s, { pathIndex: 0, dist: 9, gap: 0, segments: 1 }, 0);
    s.setAim(h.uid, p.x, p.y);
    const hp0 = enemies.map((e) => e.hp);
    expect(activateUlt(s)).toBe(true);
    expect(s.runners.length).toBe(1);
    expect(end).toBeTruthy();
    run(s, 2.2);
    expect(s.runners.length).toBe(0);
    enemies.forEach((e, i) => {
      expect(e.hp).toBeLessThan(hp0[i]);
      expect(hp0[i] - e.hp).toBeLessThan(250); // one hit of 100 (+ the mark), never twice
      expect(e.statuses.mark).toBeTruthy();
    });
  });

  test('a hexing tide pushes back and hexes', () => {
    const s = sim({ hero: 'hexer' });
    ready(s, 'hexer');
    const e = spawn(s, 'tank', 8, { speed: 0 });
    expect(activateUlt(s)).toBe(true);
    expect(e.dist).toBeLessThan(8);
    expect(e.statuses.hex).toBeTruthy();
  });
});

describe('determinism', () => {
  const script = () => {
    const s = sim({ hero: 'dragoner', seed: 99 });
    const out = [];
    const m = place(s, 'mortarer');
    const f = place(s, 'familiar', 4, 0.5);
    place(s, 'curser', 8, 0.5);
    place(s, 'gatherer', 10, 0.5);
    place(s, 'falcon', 12, 0.5);
    const h = place(s, 'dragoner', 6, 6.5);
    h.ultUnlocked = true;
    for (let i = 0; i < 30; i++) spawn(s, i % 5 === 0 ? 'bat' : 'tank', 1 + i * 0.4);
    s.setAim(m.uid, 8, 4.5);
    for (let k = 0; k < 600; k++) {
      if (k === 120) activateUlt(s);
      if (k === 200) s.upgradeTower(f.uid, 0);
      s.update(STEP);
      if (k % 60 === 0) out.push(JSON.stringify(s.enemies.map((e) => [e.uid, e.x, e.y, e.hp]).concat(s.towers.map((t) => [t.uid, t.ox, t.oy, t.damageDealt]))));
    }
    return out.join('\n');
  };

  test('the same script twice gives the same state, with Math.random and Date.now unusable', () => {
    const r = Math.random;
    const d = Date.now;
    Math.random = () => { throw new Error('Math.random in the sim'); };
    Date.now = () => { throw new Error('Date.now in the sim'); };
    try {
      expect(script()).toBe(script());
    } finally {
      Math.random = r;
      Date.now = d;
    }
  });
});
