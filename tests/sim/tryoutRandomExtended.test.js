// Random Class with Extended Day (docs/specs/TRYOUT_DAY.md §20.1, §20.4, §20.6): the auto-pick keeps landing past P12 on
// the grid's picks (a Tryout pick every 6th from 13 while the squad has room, the LR cap rising per pick), a pick with
// nothing allowed is handed in (and, with no last pick in Extended Day, banks its credit), and the pick-row trim keeps
// every row the run and the rewards read (girls, LRs, the newest) while the rest become counts.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { buildTryoutPlan, buildTryoutStage, lengthOf, lrCapAt, tryoutPickAt } from '../../src/sim/tryout/plan.js';
import { squadRoom } from '../../src/sim/tryout/offers.js';
import { extendDay } from '../../src/sim/tryout/extended.js';
import { TRYOUT, TRYOUT_STUDENTS } from '../../src/data/tryout.js';
import { runSolo, poolFor } from '../../tools/tryoutBot.mjs';

const AFTER = lengthOf('after');
const REVEAL = TRYOUT.random.revealTicks;

function makeSim(seed = 4242) {
  const plan = buildTryoutPlan({ seed, grade: 1, length: 'after' });
  const stage = buildTryoutStage(plan);
  return new Sim({
    stageId: stage.id, hero: { unitId: 'hikari', stats: {} }, seed: 99, data: { stage },
    options: { tryout: { seed, grade: 1, length: 'after', mapId: plan.mapId, players: [{ squad: [] }], pools: [{}], random: true } },
  });
}

describe('Random Class + Extended Day', () => {
  it('auto-picks land past P12: Tryout picks by squad room, the LR cap per pick, every pick resolved', () => {
    const offers = new Map();
    const { sim } = runSolo({
      seed: 77, grade: 1, length: 'after', random: true, pool: poolFor('maxed'), maxWaves: 80,
      onCalm: (s) => { s.lives = Math.max(s.lives, 40); },
      onStep: (s) => {
        const p = s.tryout.players[0];
        const o = p.offer;
        if (p.win === 'pick' && o && !o.follow && !offers.has(o.pick)) offers.set(o.pick, { kind: o.kind, rarity: o.rarity, lr: p.lr, room: squadRoom(s, 0) });
        s.update(1 / 60);
      },
    });
    const ty = sim.tryout;
    const p = ty.players[0];
    expect(ty.random).toBe(true);
    expect(sim.wave).toBeGreaterThanOrEqual(80);
    for (let k = 12; k <= 19; k++) expect(offers.has(k), `pick ${k}`).toBe(true);
    for (const [k, o] of offers) {
      // a Tryout pick shows girls exactly when the squad has room; an LR comes only under that pick's cap
      if (k >= 12) expect(o.kind === 'girls', `pick ${k}`).toBe(tryoutPickAt(AFTER, k) && o.room > 0);
      if (o.rarity === 4) expect(o.lr).toBeLessThan(lrCapAt(AFTER, k));
    }
    // every pick that opened was resolved by the Sim (no player command carries a pick)
    const resolved = new Set(p.picks.map((r) => r.pick));
    for (const k of offers.keys()) if (k < ty.pickNo || p.win !== 'pick') expect(resolved.has(k), `pick ${k}`).toBe(true);
    expect(p.picks.every((r) => !r.hand)).toBe(true);
  }, 180000);

  it('a pick with nothing allowed is handed in, and banks its credit (Extended Day has no last pick)', () => {
    const sim = makeSim(5);
    const ty = sim.tryout;
    const p = ty.players[0];
    sim.state = 'between';
    sim.wave = 64;
    ty.period = 16;
    ty.started = 16;
    // a full squad offered only girls: nothing the Sim may take
    while (squadRoom(sim, 0) > 0) p.squadAdd--;
    const out = TRYOUT_STUDENTS.filter((id) => !p.squad.includes(id)).slice(0, 3);
    p.seq++;
    p.offer = { seq: p.seq, pick: 16, rarity: 1, credits: 0, floor: 0, kind: 'girls', cards: out.map((girl) => ({ girl })), erasers: 0 };
    p.win = 'pick';
    p.winTicks = 0;
    const cash = sim.cash;
    for (let i = 0; i <= REVEAL + 1 && p.win === 'pick'; i++) sim.update(1 / 60);
    expect(p.win).not.toBe('pick');
    expect(p.picks.at(-1)).toMatchObject({ pick: 16, hand: true });
    expect(p.bank).toBe(1);
    expect(sim.cash).toBeGreaterThan(cash);
  });

  it('the pick-row trim keeps the first rows, the newest, every girl and every LR; the rest become counts by rarity', () => {
    const sim = makeSim(9);
    const p = sim.tryout.players[0];
    const rows = [];
    for (let k = 1; k <= 50; k++) {
      if (k % 7 === 0) rows.push({ pick: k, rarity: 1, girl: TRYOUT_STUDENTS[k % TRYOUT_STUDENTS.length] });
      else if (k % 11 === 0) rows.push({ pick: k, rarity: 4, card: 'X01', unit: null });
      else if (k % 5 === 0) rows.push({ pick: k, rarity: 2, hand: true });
      else rows.push({ pick: k, rarity: k % 4, card: 'E01', unit: null });
    }
    p.picks = rows.map((r) => ({ ...r }));
    extendDay(sim, 12);
    const X = TRYOUT.afterSchool;
    const kept = new Set(p.picks.map((r) => r.pick));
    rows.forEach((r, i) => {
      const keep = i < X.keepPicks || i >= rows.length - X.keepPicksNew || !!r.girl || r.rarity === 4;
      expect(kept.has(r.pick), `pick ${r.pick}`).toBe(keep);
    });
    const counts = [0, 0, 0, 0, 0];
    for (const r of rows) if (!kept.has(r.pick)) counts[r.rarity]++;
    expect(p.pickCounts).toEqual(counts);
    expect(p.picks.length + counts.reduce((a, b) => a + b, 0)).toBe(rows.length);
    expect(p.picks.map((r) => r.pick)).toEqual([...p.picks.map((r) => r.pick)].sort((a, b) => a - b));
  });
});
