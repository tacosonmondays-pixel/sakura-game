// Hero rework, battle UI logic (src/ui/battle/heroLevels.js): level buys send what the button
// showed, Move routes through the sim / lockstep, hero events are attributed by towerUid (co-op:
// the ally's hero gets a chip, not your toast), the scout price text.
import { describe, it, expect } from 'vitest';
import {
  createHeroLevels, trackLevel, sourceText, rankAt, isCapstone, priceToLevel, heroWarnText,
} from '../../src/ui/battle/heroLevels.js';
import { createBattleSim } from '../../src/ui/battle/setup.js';
import { createProfile } from '../../src/systems/save.js';
import { createCoopSim } from '../../src/online/coop/commands.js';
import { getUnit } from '../../src/data/units.js';

function fakeFeed() {
  const toasts = [];
  const banners = [];
  return { toasts, banners, push: (text, kind) => toasts.push({ text: String(text), kind }), announce: (title, sub) => banners.push(`${title} | ${sub}`) };
}

function soloBattle() {
  const { sim } = createBattleSim(createProfile(), { stageId: '1-2', difficulty: 'normal', seed: 3 });
  let spot = null;
  for (let y = 0.5; y < sim.map.height && !spot; y += 0.5) for (let x = 0.5; x < sim.map.width; x += 0.5) if (sim.canPlace('hikari', x, y).ok) { spot = [x, y]; break; }
  const hero = sim.placeTower('hikari', ...spot);
  const ctx = { sim, feed: fakeFeed(), ended: false };
  return { sim, hero, ctx, hl: createHeroLevels(ctx, null) };
}

describe('track text helpers', () => {
  const hikari = getUnit('hikari');
  it('reads the track: rows, sources, ranks, capstones', () => {
    expect(trackLevel(hikari, 9).desc).toMatch(/cleanses sabotage/);
    expect(sourceText(hikari, 'sanctuary.2')).toBe('Was Sanctuary T2');
    expect(sourceText(hikari, 'L5')).toBe('Was the Lv 5 milestone');
    expect(rankAt(hikari, 10)).toBe(2);
    expect(rankAt(hikari, 20)).toBe(3);
    expect(rankAt(hikari, 11)).toBe(0);
    expect(isCapstone(hikari, 22)).toBe(true);
    expect(isCapstone(hikari, 21)).toBe(false);
  });
});

describe('solo actions', () => {
  it('Level up buys exactly the level and price the button showed', () => {
    const { sim, hero, hl } = soloBattle();
    sim.cash = 1000;
    const shown = sim.heroLevelStatus();
    expect(hl.levelUp(shown)).toBe(true);
    expect(hero.level).toBe(2);
    expect(sim.cash).toBe(1000 - shown.price);
  });

  it('a stale tap (she levelled first) buys nothing and says so', () => {
    const { sim, hero, hl, ctx } = soloBattle();
    sim.cash = 5000;
    const shown = sim.heroLevelStatus();
    sim._credit(hero, 1000); // she levels on her own before the tap
    expect(hero.level).toBeGreaterThan(1);
    const cash = sim.cash;
    expect(hl.levelUp(shown)).toBe(false);
    expect(sim.cash).toBe(cash);
    expect(ctx.feed.toasts.at(-1).text).toMatch(/She levelled up first — tap again for Lv \d+/);
  });

  it('short of coins: "Need N more coins."', () => {
    const { sim, hl, ctx } = soloBattle();
    sim.cash = 10;
    expect(hl.levelUp()).toBe(false);
    expect(ctx.feed.toasts.at(-1).text).toMatch(/^Need \d+ more coins\.$/);
  });

  it('Move labels: free before a wave, pauses in a wave, then recharges', () => {
    const { sim, hero, hl } = soloBattle();
    expect(hl.moveState(hero)).toMatchObject({ label: 'Move', disabled: false });
    sim.state = 'wave';
    expect(hl.moveState(hero).label).toBe('Move · pauses 3s');
    hero.moveCd = 11.2;
    expect(hl.moveState(hero)).toMatchObject({ label: 'Move · 12s', disabled: true });
  });

  it('hero events: one toast for the highest of several level-ups; capstones and ranks get banners', () => {
    const { sim, hero, hl, ctx } = soloBattle();
    sim.drainEvents();
    sim._credit(hero, (xpTo(hero, 10) - hero.xp) / 0.4 + 1); // Lv 1 → 10 in one frame
    hl.handle(sim.drainEvents());
    expect(ctx.feed.toasts.filter((t) => /Lv \d+/.test(t.text))).toHaveLength(1);
    expect(ctx.feed.toasts.at(-1).text).toMatch(/^Hikari Lv 10 · Skyward Radiance/);
    expect(ctx.feed.banners.some((b) => /Celestial Bloom rank 2!/.test(b))).toBe(true);
    sim._credit(hero, (xpTo(hero, 22) - hero.xp) / 0.4 + 1);
    hl.handle(sim.drainEvents());
    expect(ctx.feed.banners.some((b) => /^LV 22 · NOON ABSOLUTE/.test(b))).toBe(true);
  });

  it('scout text: "Hikari at Lv 9" gets the price to buy up to it', () => {
    const { sim, hero } = soloBattle();
    sim.cash = 0;
    const price = priceToLevel(sim, hero, 9);
    expect(price).toBe(150 + 195 + 240 + 300 + 360 + 420 + 480 + 540);
    expect(heroWarnText(sim, 'Sabotage incoming — Hikari at Lv 9')).toBe(`Sabotage incoming — Hikari at Lv 9 · Level up now 🪙 ${price.toLocaleString('en-US')}`);
    expect(heroWarnText(sim, 'place Kage')).toBe('place Kage');
  });
});

function xpTo(hero, level) {
  let t = 0;
  const steps = [200, 260, 320, 400, 480, 560, 640, 720, 800, 860, 900, 940, 980, 1020, 1060, 1100, 1140, 1180, 1220, 1500, 1700, 1900, 2100, 2300];
  for (let l = 2; l <= level; l++) t += steps[l - 2];
  return t;
}

describe('co-op', () => {
  const START = {
    seed: 4, stageId: '2-5', difficulty: 'normal',
    players: [
      { slot: 0, uid: 'a', name: 'Aiko', loadout: [{ unitId: 'aoi' }], hero: { unitId: 'hikari' } },
      { slot: 1, uid: 'b', name: 'Bea', loadout: [{ unitId: 'rei' }], hero: { unitId: 'luna' } },
    ],
  };
  function coopCtx(mySlot) {
    const c = createCoopSim(START, { mySlot });
    const queued = [];
    const ls = { mySlot, job: null, queue: (k, a) => queued.push([k, a]) };
    const ctx = {
      sim: c.sim, feed: fakeFeed(), ended: false,
      coop: { isMine: (uid) => c.ownerOf(uid) === mySlot, ownerName: (uid) => START.players[c.ownerOf(uid)].name },
    };
    return { c, ls, queued, ctx, hl: createHeroLevels(ctx, ls) };
  }
  function placeBoth(c) {
    const spots = [];
    for (let y = 0.6; y < c.sim.map.height && spots.length < 2; y += 0.4) {
      for (let x = 0.6; x < c.sim.map.width && spots.length < 2; x += 0.4) {
        const q = [Math.round(x * 1024) + 1, Math.round(y * 1024)];
        if (!c.sim.placementReason('hikari', q[0] / 1024, q[1] / 1024) && !spots.some(([a, b]) => Math.hypot(a / 1024 - x, b / 1024 - y) < 1.5)) spots.push(q);
      }
    }
    c.apply({ t: 0, p: 0, s: 0, k: 'place', a: ['hikari', ...spots[0]] });
    c.apply({ t: 0, p: 1, s: 1, k: 'place', a: ['luna', ...spots[1]] });
  }

  it('Level up queues hlv with the shown level and price; Move queues hmv', () => {
    const { c, queued, hl } = coopCtx(1);
    placeBoth(c);
    const shown = c.sim.heroLevelStatus();
    expect(c.sim.hero.unitId).toBe('luna');
    expect(hl.levelUp(shown)).toBe(true);
    expect(queued.at(-1)).toEqual(['hlv', [shown.level + 1, shown.price]]);
  });

  it("the ally's hero levelling shows a chip with the ally's name, never your toast", () => {
    const { c, hl, ctx } = coopCtx(0);
    placeBoth(c);
    c.sim.drainEvents();
    const luna = c.sim.heroes[1];
    c.sim._credit(luna, 2000);
    hl.handle(c.sim.drainEvents());
    expect(ctx.feed.toasts).toHaveLength(1);
    expect(ctx.feed.toasts[0].text).toMatch(/^Bea's Luna Lv \d+$/);
    expect(ctx.feed.banners).toEqual([]);
    c.sim._credit(luna, 2000);
    hl.handle(c.sim.drainEvents());
    expect(ctx.feed.toasts).toHaveLength(1); // at most one chip every 3 s
  });

  it('a refused hlv explains a stale buy; a refused hmv a recharge', () => {
    const { hl, ctx } = coopCtx(0);
    hl.onApplied({ p: 0, k: 'hlv', a: [3, 100] }, { ok: false, reason: 'stale' });
    expect(ctx.feed.toasts.at(-1).text).toMatch(/She levelled up first/);
    hl.onApplied({ p: 0, k: 'hmv', a: [1, 1] }, { ok: false, reason: 'cooldown' });
    expect(ctx.feed.toasts.at(-1).text).toMatch(/^Move recharging · \d+s$/);
    const n = ctx.feed.toasts.length;
    hl.onApplied({ p: 1, k: 'hlv', a: [3, 100] }, { ok: false, reason: 'stale' }); // the ally's: silent
    expect(ctx.feed.toasts).toHaveLength(n);
  });
});
