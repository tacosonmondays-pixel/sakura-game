// Tryout Day inside the Sim (docs/specs/TRYOUT_DAY.md §15): the run loop, determinism and the restore contract,
// offers, caps and the band, the score, Hall Passes and seats, vouchers.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { snapshotDigest, simConfig } from '../../src/sim/snapshot.js';
import { buildTryoutPlan, buildTryoutStage, bandStats, runLevelOf } from '../../src/sim/tryout/index.js';
import { runModsFor, cappedSums } from '../../src/sim/tryout/pep.js';
import { killPoints, pointsOf } from '../../src/sim/tryout/assign.js';
import { TRYOUT } from '../../src/data/tryout.js';
import { runSolo, spotsFor } from '../../tools/tryoutBot.mjs';

function makeSim({ seed = 4242, squad = ['aoi', 'kage', 'yuki'], pool = {}, hero = 'hikari', squads, period, autoStart = false } = {}) {
  const plan = buildTryoutPlan({ seed, grade: 1, length: 'half' });
  const stage = buildTryoutStage(plan);
  return new Sim({
    stageId: stage.id, hero: hero ? { unitId: hero, stats: {} } : null, seed: 99, data: { stage },
    options: { autoStart, tryout: { seed, grade: 1, length: 'half', mapId: plan.mapId, players: [{ squad }], pools: [pool], ...(squads ? { squads, period } : null) } },
  });
}

/** Plays waves (no placements) until the run's window opens or `n` waves pass. */
function playUntilWindow(sim, maxWaves = 40) {
  let guard = 0;
  while (!sim.tryoutWindowOpen() && sim.state !== 'won' && sim.state !== 'lost' && guard++ < 200000) {
    if (sim.state !== 'wave') {
      if (sim.wave >= maxWaves) break;
      sim.startNextWave();
    }
    sim.update(1 / 6);
  }
}

describe('tryout: the run loop', () => {
  it('plays a Half Day: 7 periods, 6 picks, a Tryout pick first', () => {
    const { result } = runSolo({ seed: 7, policy: 'first' });
    expect(result.won).toBe(true);
    expect(result.wavesCleared).toBe(28);
    expect(result.tryout.periods).toHaveLength(7);
    const picks = result.tryout.players[0].picks;
    expect(picks).toHaveLength(6);
    expect(picks[0].girl).toBeTruthy();
    for (const p of result.tryout.periods) expect(p.team[0][0]).toBe('a_hearts');
  }, 60000);

  it('is deterministic: the same seed gives the same battle', () => {
    const a = runSolo({ seed: 11, policy: 'random', maxWaves: 14 });
    const b = runSolo({ seed: 11, policy: 'random', maxWaves: 14 });
    expect(snapshotDigest(a.sim.snapshot())).toBe(snapshotDigest(b.sim.snapshot()));
  }, 60000);

  it('holds the next wave while a pick or break is open, and Auto waits too', () => {
    const sim = makeSim({ autoStart: true });
    playUntilWindow(sim);
    expect(sim.tryout.players[0].win).toBe('pick');
    expect(sim.state).toBe('between');
    expect(sim.startNextWave()).toBe(false);
    sim.update(5);
    expect(sim.wave).toBe(4);
    const o = sim.tryout.players[0].offer;
    expect(o.kind).toBe('girls');
    expect(sim.tryoutCommand(0, 'take', [o.seq + 1, 0]).reason).toBe('stale');
    expect(sim.tryoutCommand(0, 'take', [o.seq, 0]).ok).toBe(true);
    sim.update(2);
    expect(sim.wave).toBe(5); // Auto started the next period once the pick closed
  });

  it('hands a pick in for coins and +1 credit next pick', () => {
    const sim = makeSim();
    playUntilWindow(sim);
    const cash = sim.cash;
    const o = sim.tryout.players[0].offer;
    expect(sim.tryoutCommand(0, 'hand', [o.seq]).ok).toBe(true);
    expect(sim.cash - cash).toBe(Math.floor((TRYOUT.handIn.base + TRYOUT.handIn.perPeriod) * sim.cashScale));
    expect(sim.tryout.players[0].bank).toBe(1);
  });

  it('a handed-in LR pick still counts toward the LR cap', () => {
    const sim = makeSim();
    playUntilWindow(sim);
    const p = sim.tryout.players[0];
    p.offer.rarity = 4;
    sim.tryoutCommand(0, 'hand', [p.offer.seq]);
    expect(p.lr).toBe(1);
  });

  it('an Eraser keeps the rarity and changes the cards', () => {
    const sim = makeSim({ seed: 31 });
    playUntilWindow(sim);
    const p = sim.tryout.players[0];
    sim.tryoutCommand(0, 'take', [p.offer.seq, 0]);
    playUntilWindow(sim);
    const before = JSON.stringify(p.offer.cards);
    const rarity = p.offer.rarity;
    const r = sim.tryoutCommand(0, 'erase', [p.offer.seq]);
    expect(r.ok).toBe(true);
    expect(p.offer.rarity).toBe(rarity);
    expect(JSON.stringify(p.offer.cards)).not.toBe(before);
    expect(p.erasers).toBe(TRYOUT.grades[1].erasers - 1);
  });

  it('a boss leak costs the Grade\'s hearts, not every heart', () => {
    const sim = makeSim();
    sim.wave = 28;
    const e = sim.spawnEnemy(sim.tryout ? buildTryoutPlan({ seed: 4242 }).boss : 'grave_lych', {});
    expect(e.leak).toBe(40);
  });
});

describe('tryout: restore contract (§12.2)', () => {
  it('a snapshot after a mid-run join restores into a Sim built with the squads and period', () => {
    const { sim } = runSolo({ seed: 21, policy: 'first', maxWaves: 9 });
    expect(sim.tryout.players[0].squad.length).toBeGreaterThan(3);
    const snap = JSON.parse(JSON.stringify(sim.snapshot()));
    const copy = makeSim({ seed: 21, squads: [sim.tryout.players[0].squad], period: sim.tryout.started });
    copy.restore(snap, simConfig(copy));
    expect(snapshotDigest(copy.snapshot())).toBe(snapshotDigest(sim.snapshot()));
    for (let i = 0; i < 4 && sim.state !== 'won'; i++) {
      for (const s of [sim, copy]) {
        if (s.tryoutWindowOpen()) {
          const p = s.tryout.players[0];
          if (p.win === 'pick') s.tryoutCommand(0, 'take', [p.offer.seq, 0]);
          else s.tryoutCommand(0, 'ready');
        }
        s.startNextWave();
        for (let k = 0; k < 3600 && s.state === 'wave'; k++) s.update(1 / 60);
      }
      expect(snapshotDigest(copy.snapshot())).toBe(snapshotDigest(sim.snapshot()));
    }
  }, 60000);
});

describe('tryout: band, caps and score', () => {
  it('bands account stats between the floor and the cap', () => {
    const L = runLevelOf('half', 1);
    expect(L).toBe(50);
    expect(runLevelOf('half', 7)).toBe(74);
    const loaner = bandStats(null, L);
    expect(loaner.damageMul).toBeCloseTo(1 + 0.018 * 49, 10);
    const whale = bandStats({ damageMul: 7, rateMul: 3, critChance: 0.5, costMul: 0.7, potential: 6 }, L);
    expect(whale.damageMul).toBe(3);
    expect(whale.rateMul).toBe(1.5);
    expect(whale.critChance).toBe(0.15);
    expect(whale.costMul).toBe(0.9);
    expect(whale.potential).toBe(3);
    expect(bandStats({ costMul: 1 }, L).costMul).toBe(1); // the band never gives a cut she lacks
  });

  it('caps a family per girl, and keeps damage × vs inside ×2.5', () => {
    const sim = makeSim();
    const p = sim.tryout.players[0];
    for (let i = 0; i < 6; i++) p.cards.push({ id: 'E01', r: 4 });
    expect(cappedSums(sim, 0, 'aoi', false).damageMul).toBe(1);
    for (let i = 0; i < 3; i++) p.cards.push({ id: 'E06', r: 4 });
    const m = runModsFor(sim, 0, 'aoi', false);
    // damage at its cap (×2) leaves ×1.25 for vs: the vs card gives way, never the damage
    expect(m.damageMul).toBe(2);
    expect(m.eliteMul).toBeCloseTo(1.25, 10);
    expect(m.damageMul * m.eliteMul * (m.bossMul ?? 1)).toBeLessThanOrEqual(2.5 + 1e-9);
  });

  it('scores kills from 2× at the gate to 1× at the exit; children score 0', () => {
    const sim = makeSim();
    const e = sim.spawnEnemy('slime_green', {});
    expect(killPoints(sim, e)).toBe(20);
    e.dist = sim.pathData[0].length;
    expect(killPoints(sim, e)).toBe(10);
    e.parentUid = 1;
    expect(pointsOf(e)).toBe(0);
  });
});

describe('tryout: Hall Passes, seats and vouchers', () => {
  function breakSim() {
    const sim = makeSim({ seed: 5 });
    const spots = spotsFor(sim);
    sim.placeTower('kage', spots[0].x, spots[0].y);
    sim.placeTower('aoi', spots[6].x, spots[6].y);
    // straight to Recess: three picks taken
    for (let i = 0; i < 3; i++) {
      playUntilWindow(sim);
      const p = sim.tryout.players[0];
      sim.tryoutCommand(0, 'take', [p.offer.seq, 0]);
    }
    return { sim, spots };
  }

  it('moves a girl for a pass, refuses illegal spots, Undo and moving back refund', () => {
    const { sim, spots } = breakSim();
    const p = sim.tryout.players[0];
    expect(p.win).toBe('break');
    expect(p.passes).toBe(3);
    const kage = sim.towers.find((t) => t.unitId === 'kage');
    const home = [kage.x, kage.y];
    expect(sim.tryoutMove(0, kage.uid, -5, -5).ok).toBe(false);
    const far = spots.find((s) => (s.x - home[0]) ** 2 + (s.y - home[1]) ** 2 > 9 && !sim.placementReason('kage', s.x, s.y));
    expect(sim.tryoutMove(0, kage.uid, far.x, far.y).ok).toBe(true);
    expect(p.passes).toBe(2);
    expect([kage.x, kage.y]).toEqual([far.x, far.y]);
    expect(sim.tryoutCommand(0, 'undo').ok).toBe(true);
    expect(p.passes).toBe(3);
    expect([kage.x, kage.y]).toEqual(home);
    sim.tryoutMove(0, kage.uid, far.x, far.y);
    expect(sim.tryoutMove(0, kage.uid, home[0], home[1]).ok).toBe(true);
    expect(p.passes).toBe(3);
    const hero = sim.towers.find((t) => t.isHero);
    if (hero) expect(sim.tryoutMove(0, hero.uid, far.x, far.y).reason).toBe('hero');
    expect(sim.tryoutCommand(0, 'ready').ok).toBe(true);
    expect(sim.tryoutMove(0, kage.uid, far.x, far.y).reason).toBe('notBreak');
  }, 60000);

  it('a seat keeps its first holder', () => {
    const sim = makeSim({ seed: 8 });
    const seat = sim.rule.pads[0];
    const near = (dx) => [seat.x + dx, seat.y];
    let a = null;
    for (const dx of [0, 0.3, -0.3, 0.5, -0.5]) if (!a && !sim.placementReason('kage', ...near(dx))) a = sim.placeTower('kage', ...near(dx));
    if (!a) return; // a seat with no room for a girl at its centre on this seed
    expect(sim.tryout.seats.holder[0]).toBe(a.uid);
    expect(a.padMul).toBeGreaterThan(1);
  });

  it('a Tryout girl arrives with a voucher: free to place, nothing back on a sale', () => {
    const sim = makeSim({ seed: 3 });
    playUntilWindow(sim);
    const p = sim.tryout.players[0];
    const girl = p.offer.cards[0].girl;
    sim.tryoutCommand(0, 'take', [p.offer.seq, 0]);
    expect(sim.placeCost(girl)).toBe(0);
    const s = spotsFor(sim).find((o) => !sim.placementReason(girl, o.x, o.y));
    const cash = sim.cash;
    const t = sim.placeTower(girl, s.x, s.y);
    expect(sim.cash).toBe(cash);
    expect(t.gift).toBe(1);
    expect(sim.placeCost(girl)).toBeGreaterThan(0);
    expect(sim.sellTower(t.uid)).toBe(0);
  });
});
