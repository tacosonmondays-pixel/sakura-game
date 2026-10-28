// Tenka in co-op (GAPS 5.10 co-op; T2 built it, T3 landed it): only her own player's girls join her lab team,
// the `upg` command reports who joined (the new tail of her lab record) and the co-op layer forgets them as
// owners (they are off the field, like a sale), the partner's girls stay theirs, and both views compute the
// same battle. Her economy weapon (every joiner's income and interest, owner decision #146) pays her owner's
// wallet only, with either player gone too. Either player's Tenka can have a lab, and both can at once. The
// hash folds her lab and open zones; a checkpoint taken while Zero Point's boost tail runs restores it.
import { describe, it, expect } from 'vitest';
import { createCoopSim, quantize, abilArgs } from '../../src/online/coop/commands.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { withDetMath } from '../../src/online/coop/detMath.js';
import { rederiveStats } from '../../src/online/coop/lockstep.js';
import { snapshotDigest } from '../../src/sim/snapshot.js';
import { LAB_ECON_SHARE, INCOME_INTEREST_MAX } from '../../src/sim/constants.js';

const start = () => ({
  seed: 2026,
  stageId: '2-5',
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'tenka' }, { unitId: 'aoi' }, { unitId: 'momo' }], hero: { unitId: 'luna' } },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'aoi' }, { unitId: 'rei' }], hero: null },
  ],
});

let seq = 0;
const cmd = (p, k, a = []) => ({ t: 0, p, s: seq++, k, a });

function views() {
  return [0, 1].map((mySlot) => {
    const c = createCoopSim(start(), { mySlot });
    const snap = c.snapshot();
    snap.wallets = snap.wallets.map(() => 1e6);
    return c.restore(snap);
  });
}
function all(cs, c) {
  const rs = cs.map((x) => x.apply({ ...c }));
  const strip = ({ tower, ...r }) => ({ ...r, tower: tower?.uid ?? null });
  for (const r of rs) expect(strip(r)).toEqual(strip(rs[0]));
  return rs[0];
}
/** Legal spots for a girl, nearest girl `near` first (quantized; the det math). */
function spotsNear(c, unitId, near) {
  return withDetMath(() => {
    const sim = c.sim;
    const out = [];
    for (let y = 0.55; y < sim.map.height; y += 0.35) {
      for (let x = 0.55; x < sim.map.width; x += 0.35) {
        const q = quantize(x, y);
        if (sim.placementReason(unitId, q[0] / 1024, q[1] / 1024)) continue;
        const d2 = near ? (q[0] / 1024 - near.x) ** 2 + (q[1] / 1024 - near.y) ** 2 : sim.placement.pathDistance(q[0] / 1024, q[1] / 1024);
        out.push([d2, q]);
      }
    }
    return out.sort((a, b) => a[0] - b[0] || a[1][1] - b[1][1] || a[1][0] - b[1][0]).map((r) => r[1]);
  });
}
function place(cs, slot, unitId, nearUid = null) {
  const near = nearUid != null ? cs[0].sim.getTower(nearUid) : null;
  for (const q of spotsNear(cs[0], unitId, near)) {
    const r = all(cs, cmd(slot, 'place', [unitId, ...q]));
    if (r.ok) return r.tower.uid;
  }
  throw new Error(`no spot for ${unitId}`);
}

describe('Joint Research in co-op', () => {
  it('her own girls join, the partner\'s stay; upg reports them and the owner list forgets them; both views agree', () => {
    const cs = views();
    const tk = place(cs, 0, 'tenka');
    const mine = place(cs, 0, 'aoi', tk);
    const theirs = place(cs, 1, 'aoi', tk);
    const s0 = cs[0].sim;
    const t = s0.getTower(tk);
    const d = (uid) => {
      const o = s0.getTower(uid);
      return Math.sqrt((o.x - t.x) ** 2 + (o.y - t.y) ** 2);
    };
    expect(d(mine)).toBeLessThan(3.4);
    expect(d(theirs)).toBeLessThan(3.4);
    for (let i = 0; i < 2; i++) expect(all(cs, cmd(0, 'upg', [tk, 0])).ok).toBe(true);
    const r = all(cs, cmd(0, 'upg', [tk, 0]));
    expect(r).toMatchObject({ ok: true, absorbed: [mine] });
    for (const c of cs) {
      expect(c.sim.getTower(mine)).toBe(null);
      expect(c.sim.getTower(theirs)).toBeTruthy();
      expect(c.ownerOf(mine)).toBeUndefined();
      expect(c.ownerOf(theirs)).toBe(1);
      expect(c.sim.getTower(tk).lab.uids).toEqual([mine]);
    }
    // a command on the girl who joined is refused (she is nobody's now)
    expect(all(cs, cmd(0, 'sell', [mine]))).toMatchObject({ ok: false, reason: 'notYours' });
    // a plain upgrade reports nobody
    expect('absorbed' in all(cs, cmd(0, 'upg', [tk, 0]))).toBe(false);
    for (let i = 0; i < 300; i++) for (const c of cs) c.step();
    expect(hashSim(cs[1].sim)).toBe(hashSim(cs[0].sim));
    // a checkpoint of either view restores into the other's start and re-derives nobody
    const fresh = createCoopSim(start(), { mySlot: 1 }).restore(cs[0].snapshot());
    expect(rederiveStats(fresh.sim)).toBe(0);
    expect(fresh.ownerOf(mine)).toBeUndefined();
    expect(hashSim(fresh.sim)).toBe(hashSim(cs[0].sim));
  });

  // T2 review determinism-2 (the review's probe notes/t2-review/zz-det-coopLabCheckpoint.test.js, folded in):
  // a checkpoint is not only equal when restored, it plays on equal through a second absorb and a sale
  it('a wave-end checkpoint restored into both slots plays on with the live views: Unified Theory mid-wave, more waves, a mid-wave sale', () => {
    const big = () => ({
      ...start(),
      players: [
        { slot: 0, uid: 'host', name: 'Host', loadout: ['tenka', 'aoi', 'yuki', 'momo', 'akane', 'miko', 'chika'].map((unitId) => ({ unitId })), hero: { unitId: 'luna' } },
        { slot: 1, uid: 'guest', name: 'Guest', loadout: ['aoi', 'rei', 'umeko'].map((unitId) => ({ unitId })), hero: null },
      ],
    });
    const live = [0, 1].map((mySlot) => {
      const c = createCoopSim(big(), { mySlot });
      const snap = c.snapshot();
      snap.wallets = snap.wallets.map(() => 1e6);
      return c.restore(snap);
    });
    const tk = place(live, 0, 'tenka');
    for (const u of ['aoi', 'yuki', 'momo', 'akane', 'miko']) place(live, 0, u, tk);
    const theirs = place(live, 1, 'aoi', tk);
    place(live, 0, 'chika', tk);
    for (let i = 0; i < 3; i++) expect(all(live, cmd(0, 'upg', [tk, 0])).ok).toBe(true);
    // every class joined at Joint Research
    expect(Object.values(live[0].sim.getTower(tk).lab.members).every((n) => n > 0)).toBe(true);
    expect(all(live, cmd(0, 'upg', [tk, 0])).ok).toBe(true); // Grand Lab
    expect(all(live, cmd(0, 'wave')).ok).toBe(true);
    const run = (cs, label, n, every = 30) => {
      for (let i = 0; i < n && cs[0].sim.state === 'wave'; i++) {
        for (const c of cs) c.step();
        for (const c of cs) c.sim.drainEvents();
        const h = cs.map((c) => c.hash());
        expect(h, `${label} ${i}`).toEqual(h.map(() => h[0]));
        if (i % every === 0 && cs.length === 4) {
          expect(snapshotDigest(JSON.stringify(cs[2].snapshot())), `${label} ${i} slot 0`).toBe(snapshotDigest(JSON.stringify(cs[0].snapshot())));
          expect(snapshotDigest(JSON.stringify(cs[3].snapshot())), `${label} ${i} slot 1`).toBe(snapshotDigest(JSON.stringify(cs[1].snapshot())));
        }
      }
    };
    run(live, 'wave 1', 20000);
    expect(live[0].sim.state).toBe('between');
    // the host's wave-end checkpoint over the wire, restored into both slots
    const ck = JSON.parse(JSON.stringify(live[0].snapshot()));
    const restored = [0, 1].map((mySlot) => createCoopSim(big(), { mySlot }).restore(ck));
    for (const r of restored) expect(rederiveStats(r.sim)).toBe(0);
    const cs = [...live, ...restored];
    // two more of her player's girls near her, a wave, then Unified Theory bought mid-wave (the second absorb)
    const late = [place(cs, 0, 'akane', tk), place(cs, 0, 'yuki', tk)];
    expect(all(cs, cmd(0, 'wave')).ok).toBe(true);
    run(cs, 'wave 2', 200);
    expect(cs[0].sim.state).toBe('wave');
    const r5 = all(cs, cmd(0, 'upg', [tk, 0]));
    expect(r5).toMatchObject({ ok: true, absorbed: late });
    for (const c of cs) {
      expect(c.sim.getTower(tk).lab.rounds).toBe(2);
      for (const uid of late) expect(c.ownerOf(uid)).toBeUndefined();
      expect(c.ownerOf(theirs)).toBe(1);
    }
    run(cs, 'wave 2 rest', 20000);
    expect(all(cs, cmd(0, 'wave')).ok).toBe(true);
    run(cs, 'wave 3', 300);
    expect(cs[0].sim.state).toBe('wave');
    // selling her mid-wave: 70% of her own coins on every view, and her lab is gone
    const sold = all(cs, cmd(0, 'sell', [tk]));
    expect(sold.ok).toBe(true);
    expect(sold.refund).toBeGreaterThan(0);
    for (const c of cs) expect(c.sim._labOn).toBe(0);
    run(cs, 'wave 3 rest', 20000);
    expect(snapshotDigest(JSON.stringify(cs[2].snapshot()))).toBe(snapshotDigest(JSON.stringify(cs[0].snapshot())));
    expect(snapshotDigest(JSON.stringify(cs[3].snapshot()))).toBe(snapshotDigest(JSON.stringify(cs[1].snapshot())));
  }, 120000);
});

/** One client per slot from `st`, both wallets at `coins` (through a checkpoint, as a rejoin would). */
function viewsOf(st, coins) {
  return [0, 1].map((mySlot) => {
    const c = createCoopSim(st, { mySlot });
    const snap = c.snapshot();
    snap.wallets = snap.wallets.map(() => coins);
    return c.restore(snap);
  });
}
const marker = (p, k) => ({ t: 0, p, s: seq++, k, a: [] });

describe('her economy weapon in co-op (owner decision #146) and the gone player', () => {
  /** Steps until the wave clears: per step, the wallet changes and the lab coins paid (by owner). */
  function wave(cs) {
    const rows = [];
    for (let i = 0; i < 20000 && cs[0].sim.state === 'wave'; i++) {
      const w0 = cs[0].wallets;
      for (const c of cs) c.step();
      const w1 = cs[0].wallets;
      expect(cs[1].wallets).toEqual(w1);
      const lab = [0, 0];
      for (const ev of cs[0].sim.drainEvents()) if (ev.type === 'cash' && ev.reason === 'lab') lab[cs[0].sim.getTower(ev.towerUid).owner] += ev.amount;
      cs[1].sim.drainEvents();
      for (const c of cs) expect(c.sim.ownerCash).toEqual([0, 0]);
      rows.push({ d: [w1[0] - w0[0], w1[1] - w0[1]], lab });
    }
    expect(cs[0].sim.state).toBe('between');
    expect(cs[1].hash()).toBe(cs[0].hash());
    return rows;
  }
  const sum = (rows, k, i) => rows.reduce((a, r) => a + r[k][i], 0);

  it('every joiner\'s income and Momo\'s interest pay her owner\'s wallet only, with the partner gone and then with her owner gone', () => {
    const st = {
      ...start(),
      players: [
        { slot: 0, uid: 'host', name: 'Host', loadout: ['tenka', 'momo', 'chigusa'].map((unitId) => ({ unitId })), hero: null },
        { slot: 1, uid: 'guest', name: 'Guest', loadout: ['aoi', 'momo'].map((unitId) => ({ unitId })), hero: null },
      ],
    };
    const cs = viewsOf(st, 50000);
    const tk = place(cs, 0, 'tenka');
    const momo = place(cs, 0, 'momo', tk);
    for (let i = 0; i < 2; i++) expect(all(cs, cmd(0, 'upg', [momo, 1])).ok).toBe(true); // Merch Table: 4% interest
    const chigusa = place(cs, 0, 'chigusa', tk);
    for (let i = 0; i < 2; i++) expect(all(cs, cmd(0, 'upg', [chigusa, 2])).ok).toBe(true); // Harvest: +25 a wave
    const theirs = place(cs, 1, 'momo', tk); // the partner's Momo, beside her: never joins
    const s0 = cs[0].sim;
    const income = s0.getTower(momo).stats.income.perWave + s0.getTower(chigusa).stats.income.perWave;
    const rate = s0.getTower(momo).stats.income.interest;
    // the partner is gone when she buys Joint Research
    all(cs, marker(1, 'gone'));
    for (let i = 0; i < 2; i++) expect(all(cs, cmd(0, 'upg', [tk, 0])).ok).toBe(true);
    const r = all(cs, cmd(0, 'upg', [tk, 0]));
    expect(r).toMatchObject({ ok: true, absorbed: [momo, chigusa] });
    for (const c of cs) {
      expect(c.sim.getTower(tk).lab).toMatchObject({ income, interest: [rate], members: { economy: 1, control: 1 } });
      expect(c.ownerOf(theirs)).toBe(1);
      expect(c.sim.getTower(theirs)).toBeTruthy();
    }
    const cashMul = s0.diff.cashMul ?? 1;
    // (both wallets hold far more than 150 / 4%: her interest is at its cap)
    const want = Math.floor(LAB_ECON_SHARE * 1 * (income * cashMul + INCOME_INTEREST_MAX) * s0.incomeMul + 1e-9);
    expect(all(cs, cmd(0, 'wave')).ok).toBe(true);
    let rows = wave(cs);
    expect(sum(rows, 'lab', 0)).toBe(want);
    expect(sum(rows, 'lab', 1)).toBe(0);
    // the partner gone: everything is the host's (pooled and lab); the partner's wallet stays
    for (const x of rows) expect(x.d[1]).toBe(0);
    // the partner is back and the host is gone: her lab coins still land in her wallet (kept for her rejoin),
    // and only those; the pooled coins (the partner's Momo's income included) are the partner's
    all(cs, marker(1, 'join'));
    all(cs, marker(0, 'gone'));
    expect(all(cs, cmd(1, 'wave')).ok).toBe(true);
    rows = wave(cs);
    expect(sum(rows, 'lab', 0)).toBe(want);
    for (const x of rows) expect(x.d[0]).toBe(x.lab[0]);
    expect(sum(rows, 'd', 1)).toBeGreaterThan(0);
    // both back: the pooled coins split again, her lab coins on top for her alone
    all(cs, marker(0, 'join'));
    expect(all(cs, cmd(1, 'wave')).ok).toBe(true);
    rows = wave(cs);
    expect(sum(rows, 'lab', 0)).toBe(want);
    for (const x of rows) expect(Math.abs(x.d[0] - x.lab[0] - x.d[1])).toBeLessThanOrEqual(1);
  }, 120000);
});

// T3 review coop-1 (the review's probe notes/t3-review/coop-lockstep.test.js part A, folded in): every lab
// above is the host's. Here the GUEST owns one too and both labs stand in one battle: each player's girls stand
// in the other Tenka's range (and stay that player's), the host is gone at the guest's Joint Research, both
// Momos' interest feeds the labs (the pooled-coins base), and the host's wave-end checkpoint restored into
// both slots plays a wave with Grand Lab bought and the guest's Tenka sold mid-wave.
describe('two labs in one battle: the guest\'s and the host\'s', () => {
  const cheap = (ids) => ids.map((unitId) => ({ unitId, stats: { costMul: unitId === 'tenka' ? 0.01 : 0.05 } }));
  const dist = (sim, a, b) => {
    const p = sim.getTower(a);
    const q = sim.getTower(b);
    return Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
  };
  /**
   * Steps every view until the wave clears: the hashes agree every step and, with four views, each restored
   * view's digest equals its live slot's every 60 steps. Per step with lab coins: who got them and the pooled
   * coins they read (both wallets after the step, less the lab coins, which are owner-credited).
   */
  function playWave(cs, label, onStep = null) {
    const pays = [];
    for (let i = 0; i < 20000 && cs[0].sim.state === 'wave'; i++) {
      for (const c of cs) c.step();
      const h = cs.map((c) => c.hash());
      expect(h, `${label} ${i}`).toEqual(h.map(() => h[0]));
      const lab = [0, 0];
      for (const ev of cs[0].sim.drainEvents()) if (ev.type === 'cash' && ev.reason === 'lab') lab[cs[0].sim.getTower(ev.towerUid).owner] += ev.amount;
      for (const c of cs.slice(1)) c.sim.drainEvents();
      if (lab[0] || lab[1]) {
        const w = cs[0].wallets;
        pays.push({ lab, base: w[0] + w[1] - lab[0] - lab[1] });
      }
      if (cs.length === 4 && i % 60 === 0) {
        expect(snapshotDigest(JSON.stringify(cs[2].snapshot())), `${label} ${i} slot 0`).toBe(snapshotDigest(JSON.stringify(cs[0].snapshot())));
        expect(snapshotDigest(JSON.stringify(cs[3].snapshot())), `${label} ${i} slot 1`).toBe(snapshotDigest(JSON.stringify(cs[1].snapshot())));
      }
      onStep?.(i);
    }
    expect(cs[0].sim.state).toBe('between');
    return pays;
  }
  /** What her lab pays at a clear whose pooled coins are `base` (labIncome's formula). */
  const labPay = (sim, tk, base) => {
    const t = sim.getTower(tk);
    const interest = t.lab.interest.reduce((a, rate) => a + Math.min(INCOME_INTEREST_MAX, rate * base), 0);
    return Math.floor(LAB_ECON_SHARE * (t.stats.lab.power ?? 1) * (t.lab.income * (sim.diff.cashMul ?? 1) + interest) * sim.incomeMul + 1e-9);
  };

  it('each lab takes only her own player\'s girls (the host gone or not), pays only her owner, and both labs restore and play on in four views', () => {
    const st = {
      seed: 4242,
      stageId: '2-5',
      difficulty: 'normal',
      players: [
        { slot: 0, uid: 'host', name: 'Host', loadout: cheap(['tenka', 'momo', 'aoi', 'rei']), hero: null },
        { slot: 1, uid: 'guest', name: 'Guest', loadout: cheap(['tenka', 'momo', 'akane', 'chigusa']), hero: null },
      ],
    };
    const cs = viewsOf(st, 1500);
    // the guest's Tenka first, the host's beside her, and everyone else around the guest's
    const gt = place(cs, 1, 'tenka');
    const ht = place(cs, 0, 'tenka', gt);
    const hm = place(cs, 0, 'momo', gt);
    const ha = place(cs, 0, 'aoi', gt);
    const gm = place(cs, 1, 'momo', gt);
    const gk = place(cs, 1, 'akane', gt);
    const gc = place(cs, 1, 'chigusa', gt);
    for (let i = 0; i < 2; i++) {
      expect(all(cs, cmd(0, 'upg', [hm, 1])).ok).toBe(true); // Merch Table: interest
      expect(all(cs, cmd(1, 'upg', [gm, 1])).ok).toBe(true);
      expect(all(cs, cmd(1, 'upg', [gc, 2])).ok).toBe(true); // Harvest: income
    }
    const s0 = cs[0].sim;
    const perWave = (u) => s0.getTower(u).stats.income?.perWave ?? 0;
    const rate = (u) => s0.getTower(u).stats.income?.interest ?? 0;
    // (Momo is the only one of them with interest; every joiner's income counts, owner decision #146)
    const want = { guest: { income: perWave(gm) + perWave(gk), interest: [rate(gm)] }, host: { income: perWave(hm) + perWave(ha), interest: [rate(hm)] } };
    for (const u of [gk, ha]) expect(rate(u)).toBe(0);
    expect(want.guest.interest[0]).toBeGreaterThan(0);
    expect(want.host.interest[0]).toBeGreaterThan(0);
    // the host is gone when the guest buys Joint Research
    all(cs, marker(0, 'gone'));
    for (let i = 0; i < 2; i++) expect(all(cs, cmd(1, 'upg', [gt, 0])).ok).toBe(true);
    const gRange = s0.getTower(gt).eff.range;
    // (the host's Momo and Aoi stand in her range; her own Chigusa does not)
    for (const u of [hm, ha, gm, gk]) expect(dist(s0, u, gt)).toBeLessThanOrEqual(gRange);
    expect(dist(s0, gc, gt)).toBeGreaterThan(gRange);
    const rG = all(cs, cmd(1, 'upg', [gt, 0]));
    expect(rG).toMatchObject({ ok: true, absorbed: [gm, gk] });
    all(cs, marker(0, 'join'));
    // the host's Joint Research: the guest's Tenka and Chigusa stand in her range and stay the guest's
    for (let i = 0; i < 2; i++) expect(all(cs, cmd(0, 'upg', [ht, 0])).ok).toBe(true);
    const hRange = s0.getTower(ht).eff.range;
    for (const u of [gt, gc, hm, ha]) expect(dist(s0, u, ht)).toBeLessThanOrEqual(hRange);
    const rH = all(cs, cmd(0, 'upg', [ht, 0]));
    expect(rH).toMatchObject({ ok: true, absorbed: [hm, ha] });
    const rei = place(cs, 0, 'rei', ht); // after her Joint Research: stays
    for (const c of cs) {
      for (const u of [gm, gk, hm, ha]) expect(c.ownerOf(u)).toBeUndefined();
      expect([c.ownerOf(gt), c.ownerOf(gc), c.ownerOf(ht), c.ownerOf(rei)]).toEqual([1, 1, 0, 0]);
      expect(c.sim.getTower(gt).lab).toMatchObject({ rounds: 1, members: { frag: 1, economy: 1, dps: 0 }, uids: [gm, gk], ...want.guest });
      expect(c.sim.getTower(ht).lab).toMatchObject({ rounds: 1, members: { dps: 1, economy: 1, frag: 0 }, uids: [hm, ha], ...want.host });
      expect(c.sim._labOn).toBe(2);
    }
    // wave 1: each lab pays her own owner, on the pooled coins of the clearing step
    expect(all(cs, cmd(0, 'wave')).ok).toBe(true);
    const w1 = playWave(cs, 'wave 1');
    expect(w1).toHaveLength(1);
    const [p1] = w1;
    expect(p1.lab).toEqual([labPay(s0, ht, p1.base), labPay(s0, gt, p1.base)]);
    expect(p1.lab[0]).toBeGreaterThan(0);
    expect(p1.lab[1]).toBeGreaterThan(0);
    for (const c of cs) expect(c.sim.ownerCash).toEqual([0, 0]);
    // the host's wave-end checkpoint, restored into both slots: both labs come back as they were
    const ck = JSON.parse(JSON.stringify(cs[0].snapshot()));
    const restored = [0, 1].map((mySlot) => createCoopSim(st, { mySlot }).restore(ck));
    for (const r of restored) {
      expect(rederiveStats(r.sim)).toBe(0);
      for (const tk of [gt, ht]) expect(r.sim.getTower(tk).lab).toEqual(s0.getTower(tk).lab);
      expect([r.ownerOf(gm), r.ownerOf(hm), r.ownerOf(gt), r.ownerOf(gc)]).toEqual([undefined, undefined, 1, 1]);
    }
    const four = [...cs, ...restored];
    // wave 2: Grand Lab mid-wave; the guest leaves and her Tenka is sold by her order already on its way
    expect(all(four, cmd(0, 'wave')).ok).toBe(true);
    let grand = null;
    let sold = null;
    const w2 = playWave(four, 'wave 2', (i) => {
      if (i === 240) grand = all(four, cmd(0, 'upg', [ht, 0]));
      if (i === 480) all(four, marker(1, 'gone'));
      if (i === 481) sold = all(four, cmd(1, 'sell', [gt]));
    });
    expect(grand.ok).toBe(true);
    expect(sold.ok).toBe(true);
    expect(sold.refund).toBeGreaterThan(0);
    for (const c of four) {
      expect(c.sim.getTower(gt)).toBe(null);
      expect(c.sim._labOn).toBe(1); // one of two labs sold: the other still runs
      expect(c.sim.getTower(ht).stats.lab.power).toBe(1.5);
    }
    // only the host's lab is left to pay: at Grand Lab's power, to her alone
    expect(w2).toHaveLength(1);
    expect(w2[0].lab).toEqual([labPay(s0, ht, w2[0].base), 0]);
    expect(w2[0].lab[0]).toBeGreaterThan(p1.lab[0]);
    for (const c of four) expect(c.hash()).toBe(four[0].hash());
    expect(snapshotDigest(JSON.stringify(four[2].snapshot()))).toBe(snapshotDigest(JSON.stringify(four[0].snapshot())));
    expect(snapshotDigest(JSON.stringify(four[3].snapshot()))).toBe(snapshotDigest(JSON.stringify(four[1].snapshot())));
  }, 120000);
});

describe('the hash and a checkpoint mid-tail', () => {
  it('folds her lab and open zones only when there are some (other battles keep their digest)', () => {
    const cs = views();
    const tk = place(cs, 0, 'tenka');
    const s = cs[0].sim;
    const h0 = hashSim(s);
    // an empty zone list (a well girl placed once, then sold) hashes like none
    s.zones = [];
    expect(hashSim(s)).toBe(h0);
    delete s.zones;
    place(cs, 0, 'aoi', tk);
    for (let i = 0; i < 3; i++) all(cs, cmd(0, 'upg', [tk, 0]));
    const t = s.getTower(tk);
    expect(t.lab.uids).toHaveLength(1);
    const h1 = hashSim(s);
    for (const edit of [(l) => { l.coins.dps += 1; }, (l) => { l.members.frag = 1; }, (l) => { l.income = 7; }, (l) => { l.interest = [0.02]; }, (l) => { l.uids = [99]; }]) {
      const keep = JSON.parse(JSON.stringify(t.lab));
      edit(t.lab);
      expect(hashSim(s)).not.toBe(h1);
      t.lab = keep;
      expect(hashSim(s)).toBe(h1);
    }
    t.labAtk.fragCd = 5;
    expect(hashSim(s)).not.toBe(h1);
    t.labAtk.fragCd = 0;
    // an open zone and the well / Last Line timers fold in
    s.zones = [{ uid: 900, src: tk, owner: 0, kind: 'well', x: 3, y: 4, r: 1.5, r2: 2.25, left: 30, anchors: [], pull: 1, slow: 0.3, vuln: 0, max: 0, eaten: 0, next: 0 }];
    const h2 = hashSim(s);
    expect(h2).not.toBe(h1);
    s.zones[0].left = 29;
    expect(hashSim(s)).not.toBe(h2);
    s.zones = [];
    expect(hashSim(s)).toBe(h1);
    t.wellCd = 10;
    expect(hashSim(s)).not.toBe(h1);
  });

  it('a checkpoint taken while Zero Point\'s boost tail runs restores the tail and plays on with the live views', () => {
    const st = {
      seed: 3316,
      stageId: '3-3',
      difficulty: 'normal',
      players: [
        { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'tenka', stats: { damageMul: 0.05 } }], hero: null },
        { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'aoi', stats: { damageMul: 0.05 } }], hero: null },
      ],
    };
    const live = viewsOf(st, 1e6);
    const tk = place(live, 0, 'tenka');
    for (let i = 0; i < 5; i++) expect(all(live, cmd(0, 'upg', [tk, 1])).ok).toBe(true); // Zero Point
    place(live, 1, 'aoi', tk);
    const t0 = live[0].sim.getTower(tk);
    // waves until a crowd of 5 stands in her reach and her Critical Mass is ready: the host taps it
    let cast = null;
    for (let w = 0; w < 6 && !cast; w++) {
      expect(all(live, cmd(0, 'wave')).ok).toBe(true);
      for (let i = 0; i < 20000 && live[0].sim.state === 'wave'; i++) {
        for (const c of live) c.step();
        for (const c of live) c.sim.drainEvents();
        if (!cast && live[0].sim.enemies.length >= 5 && live[0].sim.abilityStatus(tk).ready) {
          const res = all(live, cmd(0, 'abil', abilArgs(tk)));
          if (!res.ok) {
            expect(res.reason).toBe('noTarget'); // the crowd is not in her reach yet
            continue;
          }
          cast = res;
          expect(cast).toEqual({ ok: true, casterUid: tk });
          for (let k = 0; k < 60; k++) for (const c of live) c.step();
          break;
        }
      }
    }
    expect(cast).toBeTruthy();
    // mid-tail, mid-wave
    expect(live[0].sim.state).toBe('wave');
    expect(t0.abilMods).toEqual({ rateMul: 2 });
    expect(t0.abil.active).toBeGreaterThan(0);
    const ck = JSON.parse(JSON.stringify(live[0].snapshot()));
    const restored = [0, 1].map((mySlot) => createCoopSim(st, { mySlot }).restore(ck));
    for (const r of restored) {
      expect(rederiveStats(r.sim)).toBe(0);
      const t = r.sim.getTower(tk);
      expect(t.abilMods).toEqual(t0.abilMods);
      expect(t.abil).toEqual(t0.abil);
      expect(JSON.stringify(t.stats)).toBe(JSON.stringify(t0.stats));
    }
    const cs = [...live, ...restored];
    let ended = false;
    for (let i = 0; i < 20000 && cs[0].sim.state === 'wave'; i++) {
      for (const c of cs) c.step();
      const h = cs.map((c) => c.hash());
      expect(h, `tick ${i}`).toEqual(h.map(() => h[0]));
      for (const c of cs) for (const ev of c.sim.drainEvents()) if (ev.type === 'abilityEnd' && c === cs[0]) ended = true;
      if (i % 60 === 0) {
        expect(snapshotDigest(JSON.stringify(cs[2].snapshot())), `tick ${i}`).toBe(snapshotDigest(JSON.stringify(cs[0].snapshot())));
        expect(snapshotDigest(JSON.stringify(cs[3].snapshot())), `tick ${i}`).toBe(snapshotDigest(JSON.stringify(cs[1].snapshot())));
      }
    }
    expect(ended).toBe(true);
    for (const c of cs) expect(c.sim.getTower(tk).abilMods).toBe(null);
  }, 120000);
});
