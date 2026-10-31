// Co-op sharing (docs/specs/COOP_SHARING.md): coin gifts, lent girls, taking them back, and a leaver's girls and
// coins handed out after the grace. Every case runs the same commands on both players' CoopSims (both views) and
// checks the two agree, as two lockstep clients would.
import { describe, it, expect } from 'vitest';
import { createCoopSim, isValidCmd, KINDS, quantize, abilArgs } from '../../src/online/coop/commands.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { withDetMath } from '../../src/online/coop/detMath.js';
import { abilityPathOf } from '../../src/sim/abilities.js';
import { finalTierOf } from '../../src/sim/finalTier.js';
import { applyCoopResult } from '../../src/online/coop/rewards.js';
import { createRng } from '../../src/core/rng.js';
import { COOP } from '../../src/data/coop.js';
import { CASH_MAX } from '../../src/sim/constants.js';
import { createProfile } from '../../src/systems/save.js';

const start = ({ p0 = {}, p1 = {}, seed = 2025, stageId = '2-5' } = {}) => ({
  seed,
  stageId,
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'aoi', stats: { damageMul: 1.4 } }, { unitId: 'momo' }, { unitId: 'tenka' }, { unitId: 'akane' }], hero: { unitId: 'luna' }, ...p0 },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'rei' }, { unitId: 'miko' }, { unitId: 'aoi' }], hero: null, ...p1 },
  ],
});

let seq = 0;
const cmd = (p, k, a = [], t = 0) => ({ t, p, s: seq++, k, a });
const marker = (p, k) => ({ t: 0, p, s: -1000000 + seq++, k, a: [] });

/** Sets every wallet (through a checkpoint, as a rejoin would). */
function wallets(c, coins) {
  const snap = c.snapshot();
  snap.wallets = snap.wallets.map((_, i) => (Array.isArray(coins) ? coins[i] : coins));
  return c.restore(snap);
}
/** One client of each slot from the same start. */
function views(st = start(), coins = 100000) {
  return [0, 1].map((mySlot) => wallets(createCoopSim(st, { mySlot }), coins));
}
/** The same command on every client; the results, which must agree (and so must the hashes). */
function all(cs, c) {
  const rs = cs.map((x) => x.apply({ ...c }));
  const strip = ({ tower, ...r }) => ({ ...r, tower: tower?.uid ?? null });
  for (const r of rs) expect(strip(r)).toEqual(strip(rs[0]));
  expect(cs[1].hash()).toBe(cs[0].hash());
  return rs[0];
}
function step(cs, n = 1) {
  for (let i = 0; i < n; i++) for (const c of cs) c.step();
  expect(cs[1].hash()).toBe(cs[0].hash());
}
function stepUntil(cs, pred, max = 30000) {
  for (let i = 0; i < max; i++) {
    if (pred(cs[0])) return i;
    for (const c of cs) c.step();
  }
  throw new Error('stepUntil: never');
}
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
function place(cs, slot, unitId, skip = 0) {
  let n = 0;
  for (const q of candidates(cs[0], unitId)) {
    if (n++ < skip) continue;
    const r = all(cs, cmd(slot, 'place', [unitId, ...q]));
    if (r.ok) return r.tower.uid;
  }
  throw new Error(`no spot for ${unitId}`);
}
const tower = (c, uid) => c.sim.getTower(uid);

describe('the commands are on the wire', () => {
  it('gift, lend, back and give are command kinds the network accepts', () => {
    for (const k of ['gift', 'lend', 'back', 'give']) {
      expect(KINDS).toContain(k);
      expect(isValidCmd({ t: 5, p: 1, s: 3, k, a: [1, 2] })).toBe(true);
    }
  });
});

describe('coin gifts', () => {
  it('moves whole coins from my wallet to theirs on both views; no coins earned, no income', () => {
    const cs = views(start(), [5000, 1200]);
    const earned = cs[0].sim.stats.cashEarned;
    const r = all(cs, cmd(0, 'gift', [1, 700]));
    expect(r).toEqual({ ok: true, sent: 700, kept: 0 });
    for (const c of cs) expect(c.wallets).toEqual([4300, 1900]);
    // a wallet move, never _gainCashFor: nobody earned those coins (missions, achievements, the results sheet)
    expect(cs[0].sim.stats.cashEarned).toBe(earned);
    // each view shows its own wallet
    expect(cs[0].sim.cash).toBe(4300);
    expect(cs[1].sim.cash).toBe(1900);
  });

  it('refuses a gift to myself, to a player who is gone, under the minimum, beyond my wallet, too soon, or after the end', () => {
    const cs = views(start(), [500, 500]);
    expect(all(cs, cmd(0, 'gift', [0, 100]))).toEqual({ ok: false, reason: 'self' });
    expect(all(cs, cmd(0, 'gift', [1, COOP.giftMin - 1]))).toEqual({ ok: false, reason: 'amount' });
    expect(all(cs, cmd(0, 'gift', [1, 501]))).toEqual({ ok: false, reason: 'cash' });
    expect(all(cs, cmd(0, 'gift', [1, 'x']))).toEqual({ ok: false, reason: 'invalid' });
    expect(all(cs, cmd(0, 'gift', [3, 50]))).toEqual({ ok: false, reason: 'gone' });
    expect(all(cs, cmd(0, 'gift', [1, 100])).ok).toBe(true);
    // one gift every giftEveryTicks (2 s at 1×)
    expect(all(cs, cmd(0, 'gift', [1, 100]))).toEqual({ ok: false, reason: 'cooldown' });
    step(cs, COOP.giftEveryTicks - 1);
    expect(all(cs, cmd(0, 'gift', [1, 100]))).toEqual({ ok: false, reason: 'cooldown' });
    step(cs, 1);
    expect(all(cs, cmd(0, 'gift', [1, 100])).ok).toBe(true);
    // (the other player's own limit is theirs)
    expect(all(cs, cmd(1, 'gift', [0, 50])).ok).toBe(true);
    for (const c of cs) expect(c.wallets).toEqual([350, 650]);
    all(cs, marker(1, 'gone'));
    step(cs, COOP.giftEveryTicks);
    expect(all(cs, cmd(0, 'gift', [1, 50]))).toEqual({ ok: false, reason: 'gone' });
    // (nobody defends: one life, and the first enemy through ends it)
    expect(all(cs, cmd(0, 'wave')).ok).toBe(true);
    for (const c of cs) c.sim.lives = 1;
    stepUntil(cs, (c) => c.sim.state === 'lost');
    step(cs, 1);
    expect(all(cs, cmd(0, 'gift', [1, 50]))).toEqual({ ok: false, reason: 'ended' });
  });

  it('what the receiver\'s purse cannot take stays with the sender (CASH_MAX)', () => {
    const cs = views(start(), [5000, CASH_MAX - 300]);
    expect(all(cs, cmd(0, 'gift', [1, 1000]))).toEqual({ ok: true, sent: 300, kept: 700 });
    for (const c of cs) expect(c.wallets).toEqual([4700, CASH_MAX]);
  });
});

describe('lending a girl', () => {
  it('her controller commands and pays for her; her stats, colour and owner stay her owner\'s', () => {
    const cs = views(start(), [50000, 50000]);
    const aoi = place(cs, 0, 'aoi');
    const ownStats = tower(cs[0], aoi).unitStats;
    expect(ownStats.damageMul).toBe(1.4);
    expect(all(cs, cmd(0, 'lend', [aoi, 1]))).toEqual({ ok: true, to: 1 });
    for (const c of cs) {
      expect(c.ownerOf(aoi)).toBe(0);
      expect(c.ctrlOf(aoi)).toBe(1);
      expect(c.lentInfo(aoi)).toEqual({ kind: 'lend', from: 0 });
      expect(tower(c, aoi).ctrl).toBe(1);
      expect(tower(c, aoi).unitStats.damageMul).toBe(1.4);
    }
    expect(cs[0].isMine(aoi)).toBe(false);
    expect(cs[1].isMine(aoi)).toBe(true);
    // her owner may not command her now; her controller may, from their own wallet
    expect(all(cs, cmd(0, 'upg', [aoi, 0]))).toMatchObject({ ok: false, reason: 'notYours' });
    expect(all(cs, cmd(0, 'tgt', [aoi, 'strong']))).toEqual({ ok: false, reason: 'notYours' });
    const before = cs[0].wallets;
    const cost = cs[1].sim.upgradeStatus(aoi, 0).cost;
    expect(all(cs, cmd(1, 'upg', [aoi, 0])).ok).toBe(true);
    for (const c of cs) expect(c.wallets).toEqual([before[0], before[1] - cost]);
    expect(all(cs, cmd(1, 'tgt', [aoi, 'strong'])).ok).toBe(true);
    // her price is her own (her owner's costMul), whoever pays it
    expect(tower(cs[0], aoi).unitStats).toEqual(ownStats);
  });

  it('refuses a girl that is not mine, a hero, a girl with a lab, a re-lend, myself or a player who is gone', () => {
    const cs = views(start(), [100000, 100000]);
    const aoi = place(cs, 0, 'aoi');
    const rei = place(cs, 1, 'rei');
    const luna = place(cs, 0, 'luna');
    const tenka = place(cs, 0, 'tenka');
    expect(all(cs, cmd(0, 'lend', [rei, 1]))).toEqual({ ok: false, reason: 'notYours' });
    expect(all(cs, cmd(0, 'lend', [luna, 1]))).toEqual({ ok: false, reason: 'hero' });
    expect(all(cs, cmd(0, 'lend', [tenka, 1]))).toEqual({ ok: false, reason: 'lab' });
    expect(all(cs, cmd(0, 'lend', [aoi, 0]))).toEqual({ ok: false, reason: 'self' });
    expect(all(cs, cmd(0, 'lend', [aoi, 'x']))).toEqual({ ok: false, reason: 'invalid' });
    expect(all(cs, cmd(0, 'lend', [aoi, 1])).ok).toBe(true);
    // control never chains: the girl lent to me is not mine to lend, and not mine any more for her owner
    expect(all(cs, cmd(1, 'lend', [aoi, 0]))).toEqual({ ok: false, reason: 'notYours' });
    expect(all(cs, cmd(0, 'lend', [aoi, 1]))).toEqual({ ok: false, reason: 'notYours' });
    all(cs, marker(1, 'gone'));
    const akane = place(cs, 0, 'akane');
    expect(all(cs, cmd(0, 'lend', [akane, 1]))).toEqual({ ok: false, reason: 'gone' });
  });

  it('take back: her owner only, between waves (or at once when her controller is gone); give back: her controller, any time', () => {
    const cs = views(start(), [100000, 100000]);
    const aoi = place(cs, 0, 'aoi');
    expect(all(cs, cmd(0, 'back', [aoi]))).toEqual({ ok: false, reason: 'already' });
    expect(all(cs, cmd(0, 'lend', [aoi, 1])).ok).toBe(true);
    expect(all(cs, cmd(1, 'back', [aoi]))).toEqual({ ok: false, reason: 'notYours' });
    // during a wave: no snatching her back
    expect(all(cs, cmd(0, 'wave')).ok).toBe(true);
    expect(cs[0].sim.state).toBe('wave');
    expect(all(cs, cmd(0, 'back', [aoi]))).toEqual({ ok: false, reason: 'wave' });
    // …but her controller can hand her back any time
    expect(all(cs, cmd(1, 'give', [aoi]))).toEqual({ ok: true });
    for (const c of cs) {
      expect(c.ctrlOf(aoi)).toBe(0);
      expect(tower(c, aoi).ctrl).toBeUndefined();
      expect(c.lentInfo(aoi)).toBeNull();
    }
    expect(all(cs, cmd(0, 'give', [aoi]))).toEqual({ ok: false, reason: 'notYours' });
    // lent again; between waves the owner takes her back
    expect(all(cs, cmd(0, 'lend', [aoi, 1])).ok).toBe(true);
    stepUntil(cs, (c) => c.sim.state === 'between');
    expect(all(cs, cmd(0, 'back', [aoi]))).toEqual({ ok: true });
    for (const c of cs) expect(c.ctrlOf(aoi)).toBe(0);
    // mid-wave with her controller gone: at once
    expect(all(cs, cmd(0, 'lend', [aoi, 1])).ok).toBe(true);
    expect(all(cs, cmd(0, 'wave')).ok).toBe(true);
    all(cs, marker(1, 'gone'));
    expect(all(cs, cmd(0, 'back', [aoi]))).toEqual({ ok: true });
    // give back to an owner who is gone: refused (she would be nobody's to command)
    const cs2 = views(start(), [100000, 100000]);
    const a2 = place(cs2, 0, 'aoi');
    expect(all(cs2, cmd(0, 'lend', [a2, 1])).ok).toBe(true);
    all(cs2, marker(0, 'gone'));
    expect(all(cs2, cmd(1, 'give', [a2]))).toEqual({ ok: false, reason: 'gone' });
  });

  it('her controller sells her: the refund is the controller\'s', () => {
    const cs = views(start(), [50000, 50000]);
    const aoi = place(cs, 0, 'aoi');
    expect(all(cs, cmd(0, 'lend', [aoi, 1])).ok).toBe(true);
    expect(all(cs, cmd(1, 'upg', [aoi, 1])).ok).toBe(true);
    const w = cs[0].wallets;
    const v = cs[0].sim.sellValue(aoi);
    expect(all(cs, cmd(1, 'sell', [aoi]))).toEqual({ ok: true, refund: v });
    for (const c of cs) {
      expect(c.wallets).toEqual([w[0], w[1] + v]);
      expect(c.lentInfo(aoi)).toBeNull();
      expect(c.ownerOf(aoi)).toBeUndefined();
    }
  });

  it('one final tier per path stays her owner\'s rule: a lent copy cannot take a path her owner\'s other copy holds', () => {
    const cs = views(start(), [CASH_MAX, CASH_MAX]);
    const a = place(cs, 0, 'aoi');
    const b = place(cs, 0, 'aoi', 30);
    const def = tower(cs[0], a).def;
    const fin = finalTierOf(def, 0);
    for (let i = 0; i < fin; i++) expect(all(cs, cmd(0, 'upg', [a, 0])).ok).toBe(true);
    expect(all(cs, cmd(0, 'lend', [b, 1])).ok).toBe(true);
    for (let i = 0; i < fin - 1; i++) expect(all(cs, cmd(1, 'upg', [b, 0])).ok).toBe(true);
    expect(all(cs, cmd(1, 'upg', [b, 0]))).toMatchObject({ ok: false, reason: 'onePerPath', holder: a });
  });

  it('a lent Market Day pays her controller, and her controller\'s Auto-for-all and group casts take her in', () => {
    const cs = views(start(), [100000, 100000]);
    const momo = place(cs, 0, 'momo');
    const path = abilityPathOf(tower(cs[0], momo).def);
    for (let i = 0; i < 3; i++) expect(all(cs, cmd(0, 'upg', [momo, path])).ok).toBe(true);
    expect(all(cs, cmd(0, 'lend', [momo, 1])).ok).toBe(true);
    // the controller's Auto for every girl they command (uid 0) switches hers on; the owner's leaves her be
    expect(all(cs, cmd(0, 'acast', [0, 0])).ok).toBe(true);
    expect(tower(cs[0], momo).abil.auto).toBe(false);
    expect(all(cs, cmd(1, 'acast', [0, 1])).ok).toBe(true);
    for (const c of cs) expect(tower(c, momo).abil.auto).toBe(true);
    // her owner may not fire her any more; her controller may
    expect(all(cs, cmd(0, 'abil', abilArgs(momo)))).toMatchObject({ ok: false, reason: 'notYours' });
    expect(all(cs, cmd(1, 'acast', [momo, 0])).ok).toBe(true);
    expect(all(cs, cmd(0, 'wave')).ok).toBe(true);
    stepUntil(cs, (c) => c.sim.state === 'wave' && c.sim.abilityStatus(momo).ready);
    const w = cs[0].wallets;
    for (const c of cs) c.sim.drainEvents();
    expect(all(cs, cmd(1, 'abil', abilArgs(momo)))).toEqual({ ok: true, casterUid: momo });
    const ev = cs[0].sim.drainEvents().find((e) => e.type === 'cash' && e.reason === 'ability');
    expect(ev.owner).toBe(1);
    for (const c of cs) expect(c.wallets).toEqual([w[0], w[1] + ev.amount]);
  });

  it('a Tenka handed out to another player cannot buy the tiers that absorb her owner\'s girls; her other tiers buy', () => {
    const cs = views(start(), [CASH_MAX, CASH_MAX]);
    const tenka = place(cs, 0, 'tenka');
    all(cs, marker(0, 'gone'));
    step(cs, COOP.graceTicks + 1);
    for (const c of cs) expect(c.ctrlOf(tenka)).toBe(1);
    const def = tower(cs[0], tenka).def;
    const absorbs = def.paths.findIndex((p) => p.tiers.some((t) => t.mods?.lab?.rounds > 0));
    const other = [0, 1, 2].find((p) => p !== absorbs);
    expect(all(cs, cmd(1, 'upg', [tenka, other])).ok).toBe(true);
    let r = null;
    for (let i = 0; i < 5; i++) {
      r = all(cs, cmd(1, 'upg', [tenka, absorbs]));
      if (!r.ok) break;
    }
    expect(r).toEqual({ ok: false, reason: 'lab' });
    expect(tower(cs[0], tenka).lab?.rounds || 0).toBe(0);
  });
});

describe('a leaver\'s girls and coins (the grace, the hand-out, the rejoin)', () => {
  it('keeps everything for the grace, then splits the wallet and hands every girl but the hero to the one still here', () => {
    const cs = views(start(), [3001, 1000]);
    const aoi = place(cs, 0, 'aoi');
    const momo = place(cs, 0, 'momo', 20);
    const luna = place(cs, 0, 'luna');
    const rei = place(cs, 1, 'rei');
    for (const c of cs) c.drainShareEvents();
    all(cs, marker(0, 'gone'));
    const at = cs[0].pendingDeals()[0].at;
    expect(at).toBe(cs[0].tick + COOP.graceTicks);
    const w = cs[0].wallets;
    step(cs, COOP.graceTicks);
    // the grace: nothing moved
    for (const c of cs) {
      expect(c.wallets).toEqual(w);
      expect(c.ctrlOf(aoi)).toBe(0);
      expect(c.drainShareEvents()).toEqual([]);
    }
    step(cs, 1);
    for (const c of cs) {
      expect(c.wallets).toEqual([0, w[0] + w[1]]);
      expect(c.ctrlOf(aoi)).toBe(1);
      expect(c.ctrlOf(momo)).toBe(1);
      expect(c.lentInfo(aoi)).toEqual({ kind: 'deal', from: 0 });
      expect(c.ctrlOf(luna)).toBe(0); // the hero stays theirs
      expect(c.ctrlOf(rei)).toBe(1);
      expect(c.pendingDeals()).toEqual([]);
      expect(c.drainShareEvents()).toEqual([{ k: 'dealt', tick: at, from: 0, coins: w[0], given: [{ to: 1, uids: [aoi, momo] }] }]);
    }
    expect(cs[1].isMine(aoi)).toBe(true);
    // the receiver plays them: an upgrade from their wallet
    expect(all(cs, cmd(1, 'upg', [aoi, 0])).ok).toBe(true);
    // the leaver is back: their girls come back (with the upgrade), the coins do not
    const w2 = cs[0].wallets;
    all(cs, marker(0, 'join'));
    for (const c of cs) {
      expect(c.ctrlOf(aoi)).toBe(0);
      expect(c.ctrlOf(momo)).toBe(0);
      expect(c.lentInfo(aoi)).toBeNull();
      expect(tower(c, aoi).tiers[0]).toBe(1);
      expect(c.wallets).toEqual(w2);
      expect(c.drainShareEvents()).toEqual([{ k: 'back', tick: c.tick, to: 0, uids: [aoi, momo] }]);
    }
  });

  it('a rejoin inside the grace cancels the hand-out; the grace counts at the game speed (about 20 s of real time)', () => {
    const cs = views(start(), [2000, 2000]);
    const aoi = place(cs, 0, 'aoi');
    const w = cs[0].wallets;
    all(cs, marker(0, 'gone'));
    step(cs, 600);
    all(cs, marker(0, 'join'));
    step(cs, COOP.graceTicks);
    for (const c of cs) {
      expect(c.ctrlOf(aoi)).toBe(0);
      expect(c.wallets).toEqual(w);
      expect(c.pendingDeals()).toEqual([]);
    }
    expect(all(cs, cmd(1, 'speed', [3])).ok).toBe(true);
    all(cs, marker(0, 'gone'));
    expect(cs[0].pendingDeals()[0].at).toBe(cs[0].tick + COOP.graceTicks * 3);
  });

  it('girls lent to the leaver go home first; the leaver\'s own lends stay where they are', () => {
    const cs = views(start(), [50000, 50000]);
    const aoi = place(cs, 0, 'aoi');
    const akane = place(cs, 0, 'akane');
    const rei = place(cs, 1, 'rei');
    const miko = place(cs, 1, 'miko');
    expect(all(cs, cmd(0, 'lend', [aoi, 1])).ok).toBe(true); // host's Aoi with the guest
    expect(all(cs, cmd(1, 'lend', [miko, 0])).ok).toBe(true); // guest's Miko with the host
    all(cs, marker(1, 'gone'));
    step(cs, COOP.graceTicks + 1);
    for (const c of cs) {
      expect(c.ctrlOf(aoi)).toBe(0); // home
      expect(c.lentInfo(aoi)).toBeNull();
      expect(c.ctrlOf(rei)).toBe(0); // handed out
      expect(c.lentInfo(rei)).toEqual({ kind: 'deal', from: 1 });
      expect(c.ctrlOf(miko)).toBe(0); // was already with the host
      expect(c.lentInfo(miko)).toEqual({ kind: 'lend', from: 1 });
      expect(c.ctrlOf(akane)).toBe(0);
    }
    // the guest returns: their handed-out Rei comes back; the Miko they lent stays lent (theirs to take back)
    all(cs, marker(1, 'join'));
    for (const c of cs) {
      expect(c.ctrlOf(rei)).toBe(1);
      expect(c.ctrlOf(miko)).toBe(0);
    }
  });

  it('three players: girls go one by one to whoever commands the least spent value (ties: the lower slot)', () => {
    const st = start();
    st.players.push({ slot: 2, uid: 'third', name: 'Third', loadout: [{ unitId: 'aoi' }], hero: null });
    const cs = [0, 1, 2].map((mySlot) => wallets(createCoopSim(st, { mySlot }), 100000));
    const a = place(cs, 0, 'aoi');
    const b = place(cs, 0, 'akane', 10);
    const c0 = place(cs, 0, 'momo', 20);
    place(cs, 1, 'rei', 30); // the guest already commands some value; the third player none
    all(cs, marker(0, 'gone'));
    for (let i = 0; i <= COOP.graceTicks; i++) for (const c of cs) c.step();
    const spent = (uid) => tower(cs[0], uid).spent;
    // a goes to the third player (0 spent); then the least: the third has a's value, the guest Rei's
    expect(cs[0].ctrlOf(a)).toBe(2);
    const third = spent(a);
    const guest = cs[0].sim.towers.filter((t) => cs[0].ownerOf(t.uid) === 1).reduce((n, t) => n + t.spent, 0);
    const toB = guest < third ? 1 : 2;
    expect(cs[0].ctrlOf(b)).toBe(toB);
    for (const c of cs) expect([c.ctrlOf(a), c.ctrlOf(b), c.ctrlOf(c0)]).toEqual([cs[0].ctrlOf(a), cs[0].ctrlOf(b), cs[0].ctrlOf(c0)]);
    // the wallet split three ways would be two ways here (the leaver gets none)
    expect(cs[0].wallets[0]).toBe(0);
  });
});

describe('checkpoints, hashes, and battles without sharing', () => {
  it('a checkpoint mid-lend and mid-grace restores into a fresh client that plays on identically (snapshot v 2)', () => {
    const cs = views(start(), [50000, 50000]);
    const aoi = place(cs, 0, 'aoi');
    place(cs, 1, 'rei');
    expect(all(cs, cmd(0, 'lend', [aoi, 1])).ok).toBe(true);
    expect(all(cs, cmd(1, 'gift', [0, 300])).ok).toBe(true);
    all(cs, cmd(0, 'wave'));
    step(cs, 200);
    all(cs, marker(1, 'gone'));
    step(cs, 100);
    const snap = JSON.parse(JSON.stringify(cs[0].snapshot()));
    expect(snap.v).toBe(2);
    const fresh = createCoopSim(start(), { mySlot: 0 }).restore(snap);
    expect(fresh.hash()).toBe(cs[0].hash());
    expect(fresh.ctrlOf(aoi)).toBe(1); // (lent to the guest, who is gone: home again at the hand-out, not yet)
    expect(fresh.pendingDeals()).toEqual(cs[0].pendingDeals());
    for (let i = 0; i < COOP.graceTicks + 300; i++) {
      fresh.step();
      cs[0].step();
    }
    expect(fresh.hash()).toBe(cs[0].hash());
    expect(fresh.ctrlOf(aoi)).toBe(0);
    expect(fresh.wallets).toEqual(cs[0].wallets);
  });

  it('a v 1 checkpoint (before sharing) still restores: nothing lent, nothing pending', () => {
    const cs = views(start(), [9000, 9000]);
    place(cs, 0, 'aoi');
    step(cs, 50);
    const snap = JSON.parse(JSON.stringify(cs[0].snapshot()));
    snap.v = 1;
    delete snap.giftAt;
    delete snap.pendingDeal;
    delete snap.lentBy;
    const fresh = createCoopSim(start(), { mySlot: 1 }).restore(snap);
    expect(fresh.hash()).toBe(cs[0].hash());
    expect(fresh.giftTicks()).toEqual([-1, -1]);
  });

  it('a battle without sharing hashes exactly as before (the share fold and t.ctrl add nothing)', () => {
    const cs = views(start(), [9000, 9000]);
    place(cs, 0, 'aoi');
    place(cs, 1, 'rei');
    all(cs, cmd(0, 'wave'));
    step(cs, 900);
    const c = cs[0];
    expect(c.hash()).toBe(hashSim(c.sim, { tick: c.tick, wallets: c.wallets }));
    // a lend and its return leave no trace either
    const aoi = c.sim.towers.find((t) => c.ownerOf(t.uid) === 0).uid;
    expect(all(cs, cmd(0, 'lend', [aoi, 1])).ok).toBe(true);
    expect(c.hash()).not.toBe(hashSim(c.sim, { tick: c.tick, wallets: c.wallets }));
    expect(all(cs, cmd(1, 'give', [aoi])).ok).toBe(true);
    expect(c.hash()).toBe(hashSim(c.sim, { tick: c.tick, wallets: c.wallets }));
  });
});

// review r1 S4: mission and achievement counters credit nobody for coins or work that are not theirs. The same battle
// twice, the same girls bought and sold at the same ticks; in the second one the host lends Aoi to the guest, the guest
// buys her tiers, the host takes her back and sells her, and coins go both ways. What each player is paid and counted
// (applyCoopResult: drops, coins, kills tracked; the battle's result counters) is the same.
describe('the counters ignore gifts and lends (review r1 S4)', () => {
  function battle(share) {
    seq = 0;
    const cs = views(start(), [20000, 20000]);
    const aoi = place(cs, 0, 'aoi');
    place(cs, 1, 'rei');
    if (share) expect(all(cs, cmd(0, 'lend', [aoi, 1])).ok).toBe(true);
    for (let i = 0; i < 2; i++) expect(all(cs, cmd(share ? 1 : 0, 'upg', [aoi, 0])).ok).toBe(true);
    if (share) {
      expect(all(cs, cmd(0, 'gift', [1, 500])).ok).toBe(true);
      expect(all(cs, cmd(1, 'gift', [0, 500])).ok).toBe(true);
    }
    expect(all(cs, cmd(0, 'auto', [true])).ok).toBe(true);
    all(cs, cmd(0, 'wave'));
    stepUntil(cs, (c) => c.sim.wavesCleared >= 2);
    stepUntil(cs, (c) => c.sim.state === 'between');
    if (share) expect(all(cs, cmd(0, 'back', [aoi])).ok).toBe(true);
    expect(all(cs, cmd(0, 'sell', [aoi])).ok).toBe(true);
    stepUntil(cs, (c) => c.sim.wavesCleared >= 4 || c.sim.state === 'lost');
    const res = cs[0].sim.result();
    const paid = [0, 1].map(() => {
      const profile = createProfile();
      const out = applyCoopResult(profile, res, createRng(7));
      // (pot:at is the fresh profile's creation clock, not a battle counter)
      const counters = (JSON.stringify(profile.missions ?? null) + JSON.stringify(profile.achievements ?? null) + JSON.stringify(profile.stats ?? null)).replace(/"pot:at":\d+,?/, '');
      return { out, counters };
    });
    return { res, paid };
  }

  it('kills, waves, upgrades bought, coins earned and every payout are the same with and without the sharing', () => {
    const plain = battle(false);
    const shared = battle(true);
    const pick = (r) => ({ kills: r.kills, waves: r.wavesCleared, upgrades: r.stats.upgrades, earned: r.stats.cashEarned, leaks: r.stats.leaks, encountered: r.encountered });
    expect(pick(shared.res)).toEqual(pick(plain.res));
    expect(plain.res.wavesCleared).toBeGreaterThanOrEqual(4);
    expect(plain.paid[0].out.rewards.length).toBeGreaterThan(0);
    expect(shared.paid).toEqual(plain.paid);
  });
});
