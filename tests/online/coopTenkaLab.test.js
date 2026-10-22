// Tenka in co-op (GAPS 5.10 co-op; T2 built it, T3 landed it): only her own player's girls join her lab team,
// the `upg` command reports who joined (the new tail of her lab record) and the co-op layer forgets them as
// owners (they are off the field, like a sale), the partner's girls stay theirs, and both views compute the
// same battle. Her economy weapon (every joiner's income and interest, owner decision #146) pays her owner's
// wallet only, with either player gone too. The hash folds her lab and open zones; a checkpoint taken while
// Zero Point's boost tail runs restores it.
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
