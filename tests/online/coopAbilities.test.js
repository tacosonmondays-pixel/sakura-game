// Abilities in co-op (ABILITIES_SPEC §7, BUILD_PLAN §4): the `abil` and `acast` commands (owner only,
// the girl-target rule, late commands refused safely), owner-credited coins flushed into the right
// wallet after every command and step, a manual cast's kill coins pooled and split like an auto-cast's
// (spec §7.1), the start message's `autoAbil`, the hash folding ability state
// only once an ability was cast or switched to Auto, and both views computing the same battle.
import { describe, it, expect } from 'vitest';
import { createCoopSim, isValidCmd, KINDS, quantize, abilArgs } from '../../src/online/coop/commands.js';
import { hashSim, createHasher } from '../../src/online/coop/simHash.js';
import { withDetMath } from '../../src/online/coop/detMath.js';
import { rederiveStats } from '../../src/online/coop/lockstep.js';
import { abilityPathOf, abilityReach, abilityDef } from '../../src/sim/abilities.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { abilityCommandArgs } from '../../src/ui/battle/abilityBar.js';

const start = ({ p0 = {}, p1 = {}, seed = 2025, stageId = '2-5' } = {}) => ({
  seed,
  stageId,
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'aoi' }, { unitId: 'hotaru' }, { unitId: 'akane' }], hero: { unitId: 'luna' }, ...p0 },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'momo' }, { unitId: 'aoi' }, { unitId: 'miko' }], hero: null, ...p1 },
  ],
});

let seq = 0;
const cmd = (p, k, a = [], t = 0) => ({ t, p, s: seq++, k, a });

/** The hash before abilities were folded (A1), for battles that never cast. */
function oldHash(sim, { tick = 0, wallets = [] } = {}) {
  const h = createHasher();
  h.int(tick).int(sim.wave).int(sim.lives).str(sim.state).int(sim._uid);
  for (const w of wallets) h.int(w);
  h.int(sim.enemies.length);
  for (const e of sim.enemies) {
    h.int(e.uid).int(e.x * 256).int(e.y * 256).int(e.hp * 16);
    if (e.hp >= 134217728) h.int(Math.floor(e.hp / 268435456));
  }
  h.int(sim.towers.length);
  for (const t of sim.towers) {
    h.int(t.uid).int(t.tiers[0]).int(t.tiers[1]).int(t.tiers[2]).int(t.x * 1024).int(t.y * 1024).str(t.targetMode);
    if (t.isHero) h.int(t.level).int(t.xp * 16);
    if (t.turrets.length) {
      h.int(t.turrets.length);
      for (const d of t.turrets) h.int(d.uid).int(d.x * 256).int(d.y * 256);
      if (t.flight) h.str(t.flight.mode).int(t.flight.cx * 256).int(t.flight.cy * 256);
    }
  }
  return h.value;
}

/** Both players' coins made plenty (through a checkpoint, as a rejoin would). */
function rich(c, coins = 1e6) {
  const snap = c.snapshot();
  snap.wallets = snap.wallets.map(() => coins);
  return c.restore(snap);
}

/** One client of each slot from the same start (rich unless told otherwise). */
function views(st = start(), { coins = 1e6, units = null } = {}) {
  return [0, 1].map((mySlot) => {
    const c = createCoopSim(st, { mySlot, units });
    return coins == null ? c : rich(c, coins);
  });
}

/** The same command on every client; the results, which must agree. */
function all(cs, c) {
  const rs = cs.map((x) => x.apply({ ...c }));
  const strip = ({ tower, ...r }) => ({ ...r, tower: tower?.uid ?? null });
  for (const r of rs) expect(strip(r)).toEqual(strip(rs[0]));
  return rs[0];
}
function step(cs, n = 1) {
  for (let i = 0; i < n; i++) for (const c of cs) c.step();
}

/** Legal spots for a girl, nearest the road first (quantized; checked with the det math). */
function candidates(c, unitId) {
  return withDetMath(() => {
    const sim = c.sim;
    const out = [];
    for (let y = 0.55; y < sim.map.height; y += 0.35) {
      for (let x = 0.55; x < sim.map.width; x += 0.35) {
        const q = quantize(x, y);
        if (sim.placementReason(unitId, q[0] / 1024, q[1] / 1024)) continue;
        out.push([sim.placement.pathDistance(q[0] / 1024, q[1] / 1024), q]);
      }
    }
    return out.sort((a, b) => a[0] - b[0] || a[1][1] - b[1][1] || a[1][0] - b[1][0]).map((r) => r[1]);
  });
}
/** Places a girl for `slot` on every client; her uid. */
function place(cs, slot, unitId, skip = 0) {
  let n = 0;
  for (const q of candidates(cs[0], unitId)) {
    if (n++ < skip) continue;
    const r = all(cs, cmd(slot, 'place', [unitId, ...q]));
    if (r.ok) return r.tower.uid;
  }
  throw new Error(`no spot for ${unitId}`);
}
/** Places a girl for `slot` at the legal spot nearest girl `near` (so the two cover the same road). */
function placeNear(cs, slot, unitId, near) {
  const o = cs[0].sim.getTower(near);
  const d2 = (q) => (q[0] / 1024 - o.x) * (q[0] / 1024 - o.x) + (q[1] / 1024 - o.y) * (q[1] / 1024 - o.y);
  for (const q of candidates(cs[0], unitId).sort((p, r) => d2(p) - d2(r))) {
    const r = all(cs, cmd(slot, 'place', [unitId, ...q]));
    if (r.ok) return r.tower.uid;
  }
  throw new Error(`no spot for ${unitId}`);
}
/** Buys `n` tiers of her ⚡ path. */
function upAbil(cs, slot, uid, n = 3) {
  const path = abilityPathOf(cs[0].sim.getTower(uid).def);
  for (let i = 0; i < n; i++) expect(all(cs, cmd(slot, 'upg', [uid, path])).ok).toBe(true);
  return uid;
}
/** Buys her hero levels up to `level` (the hero's own player's view). */
function heroTo(cs, slot, level) {
  const c = cs[slot];
  for (let i = 0; i < 40 && c.sim.heroes[slot].level < level; i++) {
    const st = c.sim.heroLevelStatus();
    expect(all(cs, cmd(slot, 'hlv', [st.level + 1, st.price])).ok).toBe(true);
  }
  expect(cs[0].sim.heroes[slot].level).toBe(level);
}
const tower = (c, uid) => c.sim.getTower(uid);
/** Steps until `pred(client 0)` (every client steps), at most `max` ticks. */
function stepUntil(cs, pred, max = 20000) {
  for (let i = 0; i < max; i++) {
    if (pred(cs[0])) return i;
    step(cs);
  }
  throw new Error('stepUntil: never');
}
/** Sends `abil[args]` from `slot` every 10 ticks while it is refused for a reason in `wait`; the first other result. */
function fire(cs, slot, args, { wait = ['noTarget'], max = 20000 } = {}) {
  for (let i = 0; i < max; i += 10) {
    const r = all(cs, cmd(slot, 'abil', args));
    if (r.ok || !wait.includes(r.reason)) return r;
    step(cs, 10);
  }
  throw new Error('fire: never');
}
/** Waits for her ability (it charges in waves; auto-start keeps them coming) and fires it from `slot`. */
const castWhenReady = (cs, slot, uid, args = abilArgs(uid)) => fire(cs, slot, args, { wait: ['noTarget', 'cooldown', 'notWave', 'active'] });

describe('the abil and acast commands', () => {
  it('are command kinds of up to four arguments; abilArgs builds abil', () => {
    expect(KINDS).toContain('abil');
    expect(KINDS).toContain('acast');
    expect(isValidCmd(cmd(0, 'abil', [7, 1, 2048, 3072]))).toBe(true);
    expect(isValidCmd(cmd(0, 'abil', [7, 1, 2048, 3072, 9]))).toBe(false);
    expect(isValidCmd(cmd(1, 'acast', [0, 1]))).toBe(true);
    expect(abilArgs(7)).toEqual([7, 0, -1, -1]);
    expect(abilArgs(7, { group: true })).toEqual([7, 1, -1, -1]);
    expect(abilArgs(7, { aim: [1.5, 2.25] })).toEqual([7, 0, 1536, 2304]);
  });

  it('abil: only her owner fires her; bad arguments are invalid; a refusal spends nothing', () => {
    const cs = views();
    const aoi = upAbil(cs, 0, place(cs, 0, 'aoi'));
    const t = tower(cs[0], aoi);
    expect(all(cs, cmd(0, 'abil', abilArgs(aoi)))).toEqual({ ok: false, reason: 'notWave', casterUid: aoi });
    all(cs, cmd(0, 'wave'));
    expect(all(cs, cmd(1, 'abil', abilArgs(aoi)))).toEqual({ ok: false, reason: 'notYours' });
    expect(all(cs, cmd(1, 'abil', abilArgs(9999)))).toEqual({ ok: false, reason: 'notYours' });
    for (const bad of [[aoi, 2, -1, -1], [aoi, 0, -1], [aoi, 0, 5, -1], [aoi, 0, -1, 5], [aoi, 0, 1.5, 2], [aoi, 0, -2, -2], ['aoi', 0, -1, -1], [aoi, true, -1, -1], [aoi]]) {
      expect(all(cs, cmd(0, 'abil', bad)), JSON.stringify(bad)).toEqual({ ok: false, reason: 'invalid' });
    }
    expect(t.abil.n).toBe(0);
    const r = castWhenReady(cs, 0, aoi);
    expect(r).toEqual({ ok: true, casterUid: aoi });
    for (const c of cs) expect(tower(c, aoi).abil).toMatchObject({ n: 1, cd: t.abil.cdMax });
    // at once again: still recharging, nothing spent
    expect(all(cs, cmd(0, 'abil', abilArgs(aoi)))).toEqual({ ok: false, reason: 'cooldown', casterUid: aoi });
    expect(t.abil.n).toBe(1);
    expect(cs[0].hash()).toBe(cs[1].hash());
  });

  it('a late abil behind an auto-cast is refused cooldown and spends nothing; one after the clear is notWave', () => {
    const cs = views();
    const aoi = upAbil(cs, 0, place(cs, 0, 'aoi'));
    expect(all(cs, cmd(0, 'acast', [aoi, 1]))).toEqual({ ok: true });
    all(cs, cmd(0, 'auto', [true]));
    all(cs, cmd(0, 'wave'));
    // the tap was sent while she was ready; the auto-cast fires first (inside the step)
    stepUntil(cs, (c) => tower(c, aoi).abil.n === 1);
    const before = { ...tower(cs[0], aoi).abil };
    expect(all(cs, cmd(0, 'abil', abilArgs(aoi)))).toEqual({ ok: false, reason: 'cooldown', casterUid: aoi });
    expect(tower(cs[0], aoi).abil).toEqual(before);
    stepUntil(cs, (c) => c.sim.state === 'between');
    expect(all(cs, cmd(0, 'abil', abilArgs(aoi)))).toEqual({ ok: false, reason: 'notWave', casterUid: aoi });
    expect(cs[0].hash()).toBe(cs[1].hash());
  });

  it('a group tap falls back to her ready copy, never to her partner\'s', () => {
    const cs = views();
    const a1 = upAbil(cs, 0, place(cs, 0, 'aoi'));
    const a2 = upAbil(cs, 0, placeNear(cs, 0, 'aoi', a1));
    const theirs = upAbil(cs, 1, placeNear(cs, 1, 'aoi', a1));
    all(cs, cmd(0, 'auto', [true]));
    all(cs, cmd(0, 'wave'));
    const first = castWhenReady(cs, 0, a1);
    expect(first.casterUid).toBe(a1);
    // her second copy charged the same way: a group tap on the spent one fires it
    expect(cs[0].sim.abilityStatus(a2).ready && cs[0].sim.abilityStatus(theirs).ready).toBe(true);
    expect(all(cs, cmd(0, 'abil', abilArgs(a1)))).toMatchObject({ ok: false, reason: 'cooldown' });
    // (her volley may have cleared the road: the tap waits for the next enemies, well inside a1's 35 s)
    const r = fire(cs, 0, abilArgs(a1, { group: true }), { wait: ['noTarget', 'notWave'] });
    expect(r).toEqual({ ok: true, casterUid: a2 });
    // both of hers spent: the group tap is refused, her partner's ready Aoi is never used
    expect(cs[0].sim.abilityStatus(theirs).ready).toBe(true);
    expect(all(cs, cmd(0, 'abil', abilArgs(a1, { group: true })))).toMatchObject({ ok: false, reason: 'cooldown' });
    expect(tower(cs[0], theirs).abil.n).toBe(0);
    expect(cs[0].hash()).toBe(cs[1].hash());
  });

  it('acast[0, on]: every girl she owns and her default for later unlocks; acast[uid, on]: one of her own', () => {
    const cs = views();
    const mine = upAbil(cs, 0, place(cs, 0, 'aoi'));
    const theirs = upAbil(cs, 1, place(cs, 1, 'aoi'));
    const later = place(cs, 0, 'akane');
    expect(all(cs, cmd(0, 'acast', [0, 1]))).toEqual({ ok: true });
    for (const c of cs) {
      expect(tower(c, mine).abil.auto).toBe(true);
      expect(tower(c, theirs).abil.auto).toBe(false);
      expect(c.sim.abilityAutoDefault).toEqual([true, false]);
    }
    upAbil(cs, 0, later);
    expect(tower(cs[1], later).abil.auto).toBe(true);
    expect(all(cs, cmd(0, 'acast', [theirs, 1]))).toEqual({ ok: false, reason: 'notYours' });
    expect(all(cs, cmd(1, 'acast', [theirs, 1]))).toEqual({ ok: true });
    expect(tower(cs[0], theirs).abil.auto).toBe(true);
    const locked = place(cs, 1, 'miko');
    expect(all(cs, cmd(1, 'acast', [locked, 1]))).toEqual({ ok: false, reason: 'locked' });
    for (const bad of [[mine, 2], [mine, true], ['0', 1], [mine], [-1, 0]]) expect(all(cs, cmd(0, 'acast', bad)), JSON.stringify(bad)).toEqual({ ok: false, reason: 'invalid' });
    expect(all(cs, cmd(0, 'acast', [0, 0]))).toEqual({ ok: true });
    expect([tower(cs[0], mine).abil.auto, tower(cs[0], later).abil.auto, tower(cs[0], theirs).abil.auto]).toEqual([false, false, true]);
    expect(cs[0].sim.abilityAutoDefault).toEqual([false, false]);
    expect(cs[0].hash()).toBe(cs[1].hash());
  });

  it('a hero\'s skill through abil[her uid, …]; never her partner\'s', () => {
    const cs = views();
    const luna = place(cs, 0, 'luna');
    expect(tower(cs[0], luna).owner).toBe(0);
    heroTo(cs, 0, 7);
    expect(tower(cs[1], luna).abil).toMatchObject({ id: 'luna.moonbrand', auto: false });
    all(cs, cmd(0, 'auto', [true]));
    all(cs, cmd(0, 'wave'));
    expect(all(cs, cmd(1, 'abil', abilArgs(luna)))).toEqual({ ok: false, reason: 'notYours' });
    expect(castWhenReady(cs, 0, luna)).toEqual({ ok: true, casterUid: luna });
    expect(cs[0].hash()).toBe(cs[1].hash());
  });

  it('start autoAbil: a player\'s Auto-cast setting from the first unlock (absent or not true: Off)', () => {
    const cs = views(start({ p1: { autoAbil: true }, p0: { autoAbil: 'yes' } }));
    for (const c of cs) expect(c.sim.abilityAutoDefault).toEqual([false, true]);
    const hers = upAbil(cs, 1, place(cs, 1, 'aoi'));
    const his = upAbil(cs, 0, place(cs, 0, 'aoi'));
    expect([tower(cs[0], hers).abil.auto, tower(cs[0], his).abil.auto]).toEqual([true, false]);
    expect(createCoopSim(start()).sim.abilityAutoDefault).toEqual([false, false]);
  });
});

describe('the girl-target rule in co-op (an ability on one girl: spec §7.2)', () => {
  // a fixture girl: Miko with a rally on one girl (Time Out!'s shape) on her ⚡ path
  const miko = UNIT_MAP.miko;
  const COACH = {
    ...miko, id: 'coach', name: 'Coach',
    paths: miko.paths.map((p) => (p.ability ? { ...p, ability: { ...p.ability, id: 'coach.timeout', duration: 12, effect: { target: 'girl', rateMul: 1.8, rangeMul: 1.2 }, t5: undefined } } : p)),
  };
  const st = start({ p0: { loadout: [{ unitId: 'coach' }, { unitId: 'aoi' }] }, p1: { loadout: [{ unitId: 'rei' }, { unitId: 'yuki' }] } });

  it('both views give the rally to the same girl: the aimed one (her partner\'s too), else the top damage dealer in range', () => {
    const cs = views(st, { units: { coach: COACH } });
    const coach = upAbil(cs, 0, place(cs, 0, 'coach'));
    const aoi = placeNear(cs, 0, 'aoi', coach);
    const rei = placeNear(cs, 1, 'rei', coach);
    all(cs, cmd(0, 'auto', [true]));
    all(cs, cmd(0, 'wave'));
    const r = tower(cs[0], rei);
    const aim = [r.x + 0.2, r.y - 0.3];
    expect(castWhenReady(cs, 0, coach, abilArgs(coach, { aim }))).toEqual({ ok: true, casterUid: coach });
    for (const c of cs) {
      expect(c.sim._rallies.map((x) => x.to)).toEqual([rei]);
      // ×1.8 on top of the coach's own aura; the girl beside her gets the aura only
      expect(tower(c, rei).buffBy.rally).toBe(coach);
      expect(tower(c, aoi).buffBy.rally).toBe(-1);
      expect(tower(c, rei).buff.rateMul).toBeGreaterThanOrEqual(1.8);
    }
    expect(tower(cs[0], rei).buff).toEqual(tower(cs[1], rei).buff);
    expect(cs[0].hash()).toBe(cs[1].hash());
    // no aim: her own pick, the girl in her range who dealt the most damage (the same girl on both views)
    const res = castWhenReady(cs, 0, coach);
    expect(res).toEqual({ ok: true, casterUid: coach });
    const inRange = [aoi, rei].filter((u) => {
      const o = tower(cs[0], u);
      const t = tower(cs[0], coach);
      return (o.x - t.x) ** 2 + (o.y - t.y) ** 2 <= t.eff.range ** 2;
    });
    const top = inRange.map((u) => tower(cs[0], u)).sort((p, q) => q.damageDealt - p.damageDealt || p.uid - q.uid)[0];
    for (const c of cs) expect(c.sim._rallies.map((x) => x.to)).toEqual(top ? [top.uid] : []);
    expect(cs[0].hash()).toBe(cs[1].hash());
  });
});

describe('the ability bar\'s commands (abilityCommandArgs) on two views', () => {
  it('Aoi\'s Skyfall (a group tap), Wakaba\'s Time Out! aimed at the partner\'s girl, Yuzuha\'s sentries at a point: equal hashes', () => {
    const st = start({ p0: { loadout: [{ unitId: 'aoi' }, { unitId: 'wakaba' }, { unitId: 'yuzuha' }] }, p1: { loadout: [{ unitId: 'rei' }, { unitId: 'aoi' }] } });
    const cs = views(st);
    const aoi = upAbil(cs, 0, place(cs, 0, 'aoi'));
    const wak = upAbil(cs, 0, placeNear(cs, 0, 'wakaba', aoi));
    const rei = placeNear(cs, 1, 'rei', wak);
    const yuz = upAbil(cs, 0, place(cs, 0, 'yuzuha', 4));
    all(cs, cmd(0, 'auto', [true]));
    all(cs, cmd(0, 'wave'));
    expect(castWhenReady(cs, 0, aoi, abilityCommandArgs(aoi, { group: true }))).toEqual({ ok: true, casterUid: aoi });
    expect(cs[0].hash()).toBe(cs[1].hash());
    // the UI aims Time Out! by the tapped girl's spot: the partner's Rei gets it on both views
    const r = tower(cs[0], rei);
    expect(castWhenReady(cs, 0, wak, abilityCommandArgs(wak, { aim: [r.x, r.y] }))).toEqual({ ok: true, casterUid: wak });
    for (const c of cs) expect(c.sim._rallies.filter((x) => x.src === wak).map((x) => x.to)).toEqual([rei]);
    expect(cs[0].hash()).toBe(cs[1].hash());
    // Emergency Deploy at a tapped point beside her
    const y = tower(cs[0], yuz);
    expect(castWhenReady(cs, 0, yuz, abilityCommandArgs(yuz, { aim: [y.x + 0.6, y.y + 0.3] }))).toEqual({ ok: true, casterUid: yuz });
    expect(cs[0].hash()).toBe(cs[1].hash());
    for (let i = 0; i < 900; i++) {
      step(cs);
      if (i % 90 === 0) expect(cs[0].hash(), `tick +${i}`).toBe(cs[1].hash());
    }
    expect(cs[0].hash()).toBe(cs[1].hash());
    expect(cs[0].wallets).toEqual(cs[1].wallets);
  }, 120000);
});

describe('owner-credited coins (spec §7.1, §7.4)', () => {
  /** Wallet changes per step, beside the Market Day coins the step paid (`cash` events, reason ability). */
  function track(cs, ticks) {
    const rows = [];
    for (let i = 0; i < ticks; i++) {
      const w0 = cs[0].wallets;
      for (const c of cs) c.sim.events.length = 0;
      step(cs);
      const w1 = cs[0].wallets;
      expect(cs[1].wallets).toEqual(w1);
      for (const c of cs) expect(c.sim.ownerCash).toEqual([0, 0]);
      const paid = [0, 0];
      for (const e of cs[0].sim.events) if (e.type === 'cash' && e.reason === 'ability') paid[e.owner] += e.amount;
      rows.push({ d: [w1[0] - w0[0], w1[1] - w0[1]], paid });
    }
    return rows;
  }

  it('every Market Day, auto or manual, lands in her owner\'s wallet only; both views agree; still so with the other player gone', () => {
    const cs = views(start(), { coins: 20000 });
    const momo = upAbil(cs, 1, place(cs, 1, 'momo'));
    upAbil(cs, 0, place(cs, 0, 'aoi')); // abilities of his own, never cast (no Auto)
    upAbil(cs, 0, place(cs, 0, 'akane'));
    expect(all(cs, cmd(1, 'acast', [momo, 1]))).toEqual({ ok: true });
    all(cs, cmd(0, 'auto', [true]));
    all(cs, cmd(0, 'wave'));
    const rows = [];
    while (cs[0].sim.wavesCleared < 3) rows.push(...track(cs, 120));
    const paid = rows.reduce((a, r) => [a[0] + r.paid[0], a[1] + r.paid[1]], [0, 0]);
    expect(paid[0]).toBe(0);
    expect(paid[1]).toBeGreaterThanOrEqual(200); // at least two Market Days (100 coins each on Normal)
    // a step splits its pooled coins evenly (an odd coin alternating); the Market Day coins come on top, for her only
    for (const r of rows) expect(Math.abs(r.d[1] - r.paid[1] - r.d[0])).toBeLessThanOrEqual(1);
    const drift = rows.reduce((a, r) => a + r.d[1] - r.paid[1] - r.d[0], 0);
    expect(Math.abs(drift)).toBeLessThanOrEqual(1);
    expect(cs[0].hash()).toBe(cs[1].hash());

    // a manual Market Day from her: the command pays her wallet, not his
    expect(all(cs, cmd(1, 'acast', [momo, 0]))).toEqual({ ok: true });
    stepUntil(cs, (c) => c.sim.state === 'wave' && c.sim.abilityStatus(momo).ready);
    const before = cs[0].wallets;
    expect(all(cs, cmd(1, 'abil', abilArgs(momo)))).toEqual({ ok: true, casterUid: momo });
    expect(cs[0].wallets).toEqual([before[0], before[1] + 100]);
    expect(cs[1].wallets).toEqual(cs[0].wallets);
    for (const c of cs) expect(c.sim.ownerCash).toEqual([0, 0]);

    // he is gone: the pooled coins go to her alone, his wallet stays, her own Market Days stay hers
    expect(all(cs, cmd(1, 'acast', [momo, 1]))).toEqual({ ok: true });
    all(cs, { t: 0, p: 0, s: seq++, k: 'gone', a: [] });
    const frozen = cs[0].wallets[0];
    const gone = [];
    const target = cs[0].sim.wavesCleared + 2;
    while (cs[0].sim.wavesCleared < target && cs[0].sim.state !== 'lost') gone.push(...track(cs, 120));
    expect(gone.some((r) => r.paid[1] > 0)).toBe(true);
    expect(cs[0].wallets[0]).toBe(frozen);
    for (const r of gone) expect(r.d[0]).toBe(0);
    expect(cs[0].hash()).toBe(cs[1].hash());
  }, 120000);

  it('a manual cast\'s kill coins are pooled and split evenly, as an auto-cast\'s are; with the other player gone, the caster\'s', () => {
    const cs = views(start(), { coins: 20000 });
    const aoi = [upAbil(cs, 0, place(cs, 0, 'aoi')), upAbil(cs, 1, place(cs, 1, 'aoi'))];
    all(cs, cmd(0, 'auto', [true]));
    all(cs, cmd(0, 'wave'));
    /** One manual Skyfall from `slot` on a road at 1 HP: `d` the wallet changes, `bounty` what its kills paid. */
    const cast = (slot) => {
      const uid = aoi[slot];
      const near = (c) => {
        const t = tower(c, uid);
        const r = abilityReach(t, abilityDef(t));
        return c.sim.enemies.filter((e) => !e.dead && !e.hidden && (e.x - t.x) ** 2 + (e.y - t.y) ** 2 <= r * r).length;
      };
      stepUntil(cs, (c) => c.sim.abilityStatus(uid).ready && near(c) >= 2);
      // the same edit on both views: her volley kills inside the abil command
      for (const c of cs) {
        for (const e of c.sim.enemies) e.hp = 1;
        c.sim.events.length = 0;
      }
      const w0 = cs[0].wallets;
      expect(all(cs, cmd(slot, 'abil', abilArgs(uid)))).toEqual({ ok: true, casterUid: uid });
      const w1 = cs[0].wallets;
      expect(cs[1].wallets).toEqual(w1);
      for (const c of cs) {
        expect(c.sim.ownerCash).toEqual([0, 0]);
        expect(c.sim.cash).toBe(w1[c.mySlot]); // each view shows its own wallet again
        expect(c.sim.events.some((e) => e.type === 'cash' && e.reason === 'ability')).toBe(false);
      }
      expect(cs[0].hash()).toBe(cs[1].hash());
      const bounty = cs[0].sim.events.filter((e) => e.type === 'death').reduce((a, e) => a + e.bounty, 0);
      expect(bounty).toBeGreaterThan(0);
      return { d: [w1[0] - w0[0], w1[1] - w0[1]], bounty };
    };
    for (const slot of [0, 0, 1, 1]) {
      const { d, bounty } = cast(slot);
      // every coin of the cast is paid out, half each (an odd coin takes its turn), whoever tapped
      expect(d[0] + d[1]).toBe(bounty);
      expect(Math.abs(d[0] - d[1]), `slot ${slot}: ${d}`).toBeLessThanOrEqual(1);
    }
    // the guest is gone: the host's own cast pays the host alone, the guest's wallet stays
    all(cs, { t: 0, p: 1, s: seq++, k: 'gone', a: [] });
    const { d, bounty } = cast(0);
    expect(d).toEqual([bounty, 0]);
  }, 120000);

  it('his own Market Day while he is gone stays his (owner-credited, kept for his rejoin)', () => {
    const cs = views(start({ p0: { loadout: [{ unitId: 'momo' }, { unitId: 'aoi' }] } }), { coins: 20000 });
    const his = upAbil(cs, 0, place(cs, 0, 'momo'));
    place(cs, 1, 'aoi');
    place(cs, 1, 'miko');
    all(cs, cmd(0, 'acast', [his, 1]));
    all(cs, { t: 0, p: 0, s: seq++, k: 'gone', a: [] });
    all(cs, cmd(1, 'auto', [true]));
    all(cs, cmd(1, 'wave'));
    const rows = [];
    while (cs[0].sim.wavesCleared < 2) rows.push(...track(cs, 120));
    expect(rows.some((r) => r.paid[0] > 0)).toBe(true);
    for (const r of rows) expect(r.d[0]).toBe(r.paid[0]);
  }, 120000);
});

describe('the hash and both views', () => {
  it('folds ability state only once cast or on Auto: a battle with unlocked abilities but no cast keeps the A1 hash', () => {
    const cs = views();
    const aoi = upAbil(cs, 0, place(cs, 0, 'aoi'));
    upAbil(cs, 1, place(cs, 1, 'aoi'));
    all(cs, cmd(0, 'wave'));
    step(cs, 900);
    const c = cs[0];
    expect(tower(c, aoi).abil.cd).toBeLessThan(tower(c, aoi).abil.cdMax); // charging, unhashed
    expect(c.hash()).toBe(oldHash(c.sim, { tick: c.tick, wallets: c.wallets }));
    // Auto on: her cooldown is folded from now on
    all(cs, cmd(0, 'acast', [aoi, 1]));
    expect(c.hash()).not.toBe(oldHash(c.sim, { tick: c.tick, wallets: c.wallets }));
    expect(c.hash()).toBe(cs[1].hash());
    expect(hashSim(c.sim, { tick: c.tick, wallets: c.wallets })).toBe(c.hash());
  });

  it('two views of a whole battle with casts (manual, group, auto, map scope, a hero skill, econ) agree every 120 ticks for 10 waves', () => {
    const cs = views(start(), { coins: 30000 });
    const p0 = [upAbil(cs, 0, place(cs, 0, 'aoi')), upAbil(cs, 0, place(cs, 0, 'hotaru')), upAbil(cs, 0, place(cs, 0, 'akane')), place(cs, 0, 'luna')];
    const p1 = [upAbil(cs, 1, place(cs, 1, 'momo')), upAbil(cs, 1, place(cs, 1, 'aoi')), upAbil(cs, 1, place(cs, 1, 'miko'))];
    heroTo(cs, 0, 7);
    expect(all(cs, cmd(1, 'acast', [0, 1]))).toEqual({ ok: true });
    all(cs, cmd(0, 'auto', [true]));
    all(cs, cmd(0, 'wave'));
    let checks = 0;
    let tick = 0;
    const refused = new Set();
    while (cs[0].sim.wavesCleared < 10 && !['won', 'lost'].includes(cs[0].sim.state)) {
      // player 1 taps a girl every 7 s, round robin (some taps land on a recharging one)
      if (tick % 420 === 0) {
        const uid = p0[(tick / 420) % p0.length];
        const r = all(cs, cmd(0, 'abil', abilArgs(uid, { group: tick % 840 === 0 })));
        if (!r.ok) refused.add(r.reason);
      }
      step(cs);
      tick++;
      if (tick % 120 === 0) {
        expect(cs[0].hash(), `tick ${tick}`).toBe(cs[1].hash());
        expect(cs[0].wallets).toEqual(cs[1].wallets);
        checks++;
      }
    }
    expect(checks).toBeGreaterThan(50);
    expect(cs[0].sim.wavesCleared).toBeGreaterThanOrEqual(10);
    const used = cs[0].sim.result().stats.abilityByTower;
    for (const uid of [...p0, ...p1]) expect(used[uid], `casts of ${uid}`).toBeGreaterThan(0);
    for (const r of refused) expect(['cooldown', 'noTarget', 'notWave', 'active']).toContain(r);
  }, 240000);

  it('a wave-end checkpoint restored on a fresh client replays to the same battle (no girl re-derived)', () => {
    const st = start();
    const cs = views(st, { coins: 30000 });
    const hot = upAbil(cs, 0, place(cs, 0, 'hotaru'));
    upAbil(cs, 0, place(cs, 0, 'aoi'));
    upAbil(cs, 1, place(cs, 1, 'miko'));
    upAbil(cs, 1, place(cs, 1, 'momo'));
    all(cs, cmd(1, 'acast', [0, 1]));
    all(cs, cmd(0, 'auto', [true]));
    all(cs, cmd(0, 'wave'));
    // to a wave clear while Hotaru's map cooldown still runs (her group entry is in the checkpoint):
    // she fires whenever she can
    for (let i = 0; i < 60000; i++) {
      const c = cs[0];
      if (c.sim.state === 'between' && c.sim.wavesCleared >= 2 && c.sim.abilGroups.size > 0) break;
      if (i % 10 === 0 && c.sim.abilityStatus(hot).ready) all(cs, cmd(0, 'abil', abilArgs(hot)));
      step(cs);
    }
    expect(cs[0].sim.state).toBe('between');
    expect(tower(cs[0], hot).abil.n).toBeGreaterThan(0);
    const snap = JSON.parse(JSON.stringify(cs[0].snapshot()));
    expect(snap.sim).toBeTruthy();
    const fresh = createCoopSim(st, { mySlot: 1 }).restore(snap);
    expect(rederiveStats(fresh.sim)).toBe(0);
    expect(fresh.hash()).toBe(cs[0].hash());
    expect(fresh.sim.abilGroups.size).toBe(cs[0].sim.abilGroups.size);
    const trio = [cs[0], cs[1], fresh];
    for (let i = 0; i < 3000; i++) {
      step(trio);
      if (i % 120 === 0) expect(fresh.hash(), `tick +${i}`).toBe(cs[0].hash());
    }
    expect(fresh.hash()).toBe(cs[0].hash());
    expect(fresh.wallets).toEqual(cs[0].wallets);
  }, 120000);
});

describe('the M2 sim fixes in co-op: strip and sentry crits, First Bell, Ouka\'s recharge (A3 plan M2)', () => {
  it('two views (and a checkpoint restored on a fresh client) compute the same battle: the same crit rolls, bells and office charge', () => {
    const CRIT = { critChance: 0.5, critMul: 1.4, damageMul: 1.3 };
    const BELL = { club: 'bell', clubN: 3, ultHaste: 0.2 };
    // (no shooter that would clear the road before it reaches the strips and sentries: Momo's Market Day is the
    // hasted ability under the bell and the office; the map-scope bell is covered in tests/sim/abilities.test.js)
    const st = start({
      p0: { loadout: [{ unitId: 'azami', stats: CRIT }, { unitId: 'ouka' }, { unitId: 'momo', stats: BELL }], hero: null },
      p1: { loadout: [{ unitId: 'yuzuha', stats: CRIT }, { unitId: 'momo', stats: BELL }], hero: null },
    });
    const cs = views(st);
    const az = place(cs, 0, 'azami');
    for (let i = 0; i < 4; i++) expect(all(cs, cmd(0, 'upg', [az, 0])).ok).toBe(true); // Charged Strips
    const yz = place(cs, 1, 'yuzuha', 2);
    for (let i = 0; i < 4; i++) expect(all(cs, cmd(1, 'upg', [yz, 0])).ok).toBe(true); // Burst Cells
    const ouka = place(cs, 0, 'ouka', 4);
    for (let i = 0; i < 3; i++) expect(all(cs, cmd(0, 'upg', [ouka, 1])).ok).toBe(true); // Club Mentors
    const m0 = upAbil(cs, 0, placeNear(cs, 0, 'momo', ouka));
    const m1 = upAbil(cs, 1, place(cs, 1, 'momo', 6));
    expect(tower(cs[0], m0).rules?.cdCut).toBe(0.15);
    expect(tower(cs[0], az).trapSpec.critChance).toBe(0.5);
    expect(tower(cs[0], yz).sentrySpecs.plain.critChance).toBe(0.5);
    // crits from her strips and the sentries, counted on one view (a read-only wrap)
    const sim0 = cs[0].sim;
    const hit = sim0._hit.bind(sim0);
    const emit = sim0._emit.bind(sim0);
    let deploy = false;
    let crits = 0;
    sim0._emit = (type, p) => {
      if (deploy && type === 'hit' && p.crit) crits++;
      return emit(type, p);
    };
    sim0._hit = (e, t, spec, ...rest) => {
      const prev = deploy;
      deploy = (t?.uid === az && (spec === t.trapSpec || spec === t.stripBoomSpec)) || (t?.uid === yz && (Object.values(t.sentrySpecs || {}).includes(spec) || spec === t.sentryBurstSpec));
      try {
        return hit(e, t, spec, ...rest);
      } finally {
        deploy = prev;
      }
    };
    all(cs, cmd(0, 'acast', [0, 1]));
    all(cs, cmd(1, 'acast', [0, 1]));
    all(cs, cmd(0, 'auto', [true]));
    all(cs, cmd(0, 'wave'));
    let snap = null;
    let snapHash = null;
    for (let i = 0; i < 60000 && cs[0].sim.wavesCleared < 4; i++) {
      step(cs);
      if (i % 300 === 0) {
        expect(cs[1].hash(), `tick ${i}`).toBe(cs[0].hash());
        expect(cs[1].sim.rng.getState()).toBe(cs[0].sim.rng.getState());
      }
      if (!snap && cs[1].sim.state === 'between' && cs[1].sim.wavesCleared >= 2) {
        // (from the unwrapped view: view 0 carries the counting wraps, which a snapshot cannot store)
        snap = JSON.parse(JSON.stringify(cs[1].snapshot()));
        snapHash = cs[1].hash();
      }
    }
    expect(cs[0].sim.wavesCleared).toBeGreaterThanOrEqual(4);
    expect(tower(cs[0], az).damageDealt).toBeGreaterThan(0);
    expect(tower(cs[0], yz).damageDealt).toBeGreaterThan(0);
    expect(crits).toBeGreaterThan(0);
    expect(tower(cs[0], m0).abil.n + tower(cs[0], m1).abil.n).toBeGreaterThan(0);
    expect(cs[1].hash()).toBe(cs[0].hash());
    expect(cs[1].wallets).toEqual(cs[0].wallets);
    // the checkpoint: a fresh client re-derives nothing (the crit specs are rebuilt the same) and replays the same
    expect(snap).toBeTruthy();
    const fresh = createCoopSim(st, { mySlot: 1 }).restore(snap);
    expect(rederiveStats(fresh.sim)).toBe(0);
    expect(fresh.hash()).toBe(snapHash);
    expect(fresh.sim.getTower(az).trapSpec.critChance).toBe(0.5);
  }, 240000);

  it('map-wide abilities in Ouka\'s office (M2 review): both players\' shared recharges take the office alike on both views and after a checkpoint', () => {
    const st = start({
      p0: { loadout: [{ unitId: 'ouka' }, { unitId: 'shiro' }, { unitId: 'aoi' }], hero: null },
      p1: { loadout: [{ unitId: 'hotaru' }, { unitId: 'momo' }], hero: null },
    });
    const cs = views(st);
    const ouka = place(cs, 0, 'ouka', 4);
    for (let i = 0; i < 3; i++) expect(all(cs, cmd(0, 'upg', [ouka, 1])).ok).toBe(true); // Club Mentors
    const sh = upAbil(cs, 0, placeNear(cs, 0, 'shiro', ouka));
    const ho = upAbil(cs, 1, placeNear(cs, 1, 'hotaru', ouka)); // the ally's girl in player 0's office
    upAbil(cs, 0, place(cs, 0, 'aoi', 2));
    for (const uid of [sh, ho]) expect(tower(cs[0], uid).rules?.cdCut, `uid ${uid}`).toBe(0.15);
    all(cs, cmd(0, 'auto', [true])); // (waves follow on by themselves)
    all(cs, cmd(0, 'wave'));
    const charged = new Map([['0|shiro.verdict', 0], ['1|hotaru.hush', 0]]);
    /** One tick: each map girl casts when ready (her own player's command); every shared entry still charging lost 115. */
    const tick = (list, i) => {
      if (i % 10 === 0) {
        if (list[0].sim.abilityStatus(sh).ready) all(list, cmd(0, 'abil', abilArgs(sh)));
        if (list[0].sim.abilityStatus(ho).ready) all(list, cmd(1, 'abil', abilArgs(ho)));
      }
      const before = [...list[0].sim.abilGroups].map(([k, g]) => [k, g.cd]);
      step(list);
      for (const [k, cd] of before) {
        const g = list[0].sim.abilGroups.get(k);
        if (!g || g.cd >= cd) continue;
        expect(cd - g.cd, k).toBe(115);
        charged.set(k, charged.get(k) + 1);
      }
      if (i % 300 === 0) for (const c of list.slice(1)) expect(c.hash(), `tick ${i}`).toBe(list[0].hash());
    };
    // to a wave clear after wave 2 while a shared entry still charges (it rides in the checkpoint)
    let i = 0;
    for (; i < 60000; i++) {
      const s = cs[0].sim;
      if (s.state === 'between' && s.wavesCleared >= 2 && s.abilGroups.size > 0) break;
      tick(cs, i);
    }
    expect(cs[0].sim.state).toBe('between');
    const snap = JSON.parse(JSON.stringify(cs[1].snapshot()));
    const fresh = createCoopSim(st, { mySlot: 1 }).restore(snap);
    expect(rederiveStats(fresh.sim)).toBe(0);
    expect(fresh.hash()).toBe(cs[0].hash());
    expect([...fresh.sim.abilGroups.keys()]).toEqual([...cs[0].sim.abilGroups.keys()]);
    const trio = [cs[0], cs[1], fresh];
    for (let k = 0; k < 4000 && !['won', 'lost'].includes(cs[0].sim.state); k++) tick(trio, i + 1 + k);
    expect(fresh.hash()).toBe(cs[0].hash());
    expect(cs[1].hash()).toBe(cs[0].hash());
    expect(fresh.wallets).toEqual(cs[0].wallets);
    for (const [k, n] of charged) expect(n, `${k}: ticks charged at 115`).toBeGreaterThan(1000);
    expect(tower(cs[0], sh).abil.n).toBeGreaterThan(1);
    expect(tower(cs[0], ho).abil.n).toBeGreaterThan(1);
  }, 240000);
});
