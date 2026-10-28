// Limited events: the headless balance gate (EVENT_SPEC §7 EB-1, EB-2) with the autoPlan bot and
// ONLY the girls a free player owns at that point (starters + free recruits before the given
// campaign stage), at the campaign's expected account level (EXPECTED_LEVEL in balance.test.js:
// chapter 2 → 8, 3 → 14, 4 → 20, 8 → 40). Helpers are local copies of balance.test.js's.
//   EB-1 each operation is won on Normal by the free roster of its tuneLike stage.
//   EB-2 the Gourdlight Golem: Normal is won by a mid free-player team (the roster at the end of
//        chapter 3, level 20) on every seed; Hard is a challenge (that team loses; a late free
//        team at level 50 wins).
//   EB-3 the Golem's Nightmare ("Lantern Night Never Ends", src/data/events/wire.js eventBattleStage) is
//        really hard: a mid team (level 40, no gear) and a level-60 team with maxed gear at P1 lose; the
//        late free-player profile (level 85, late gear, R/SR at P6: tools/potentialProfiles.mjs f2p-late)
//        wins. Same build as the design bench (docs/specs/HALLOWEEN_2026.md "Nightmare").
//   EB-4 an operation's Nightmare is the campaign's: Op 4 (the farm) is won by a smart level-40 team
//        and lost by the free roster of its tuneLike stage at that chapter's level.
// The Oct 27 power pass (src/data/balance.js; PROPOSAL) ships after Halloween 2026's battles close (Nov 1, 7 PM
// Central), so EB-2 and EB-3 check the Golem as players fight it: every girl and hero without the pass
// (unitStats.powerOff; bit-identical to the tree before the pass). EB-5 pins what the pass does to the same battles:
// the Golem gets easier, so re-tune it before the event returns.
import { describe, test, expect } from 'vitest';
import '../../src/data/events/wire.js';
import { eventBattleStage } from '../../src/data/events/wire.js';
import { hasRealData, defaultData } from '../../src/sim/data.js';
import { runHeadless, autoPlan } from '../../src/sim/headless.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { withDetMath } from '../../src/core/detMath.js';
import { profileStats, PROFILES } from '../../tools/potentialProfiles.mjs';

const EXPECTED_LEVEL = { 1: 1, 2: 8, 3: 14, 4: 20, 5: 25, 6: 30, 7: 35, 8: 40 };

function freeUnitsBefore(d, stageId) {
  const campaign = Object.values(d.stages).filter((s) => s.kind === 'campaign');
  const order = new Map(campaign.map((s, i) => [s.id, i]));
  const idx = order.get(stageId);
  const avail = Object.values(d.units).filter((u) => {
    const a = u.acquisition || {};
    if (a.type === 'starter') return true;
    return a.type === 'free' && order.has(a.afterStage) && order.get(a.afterStage) < idx;
  });
  const recency = (u) => (u.acquisition?.type === 'free' ? order.get(u.acquisition.afterStage) : -1);
  const towers = avail.filter((u) => u.kind === 'tower').sort((a, b) => recency(b) - recency(a)).slice(0, 8);
  const hero = avail.filter((u) => u.kind === 'hero').sort((a, b) => recency(b) - recency(a))[0] || null;
  return { towers: towers.map((u) => u.id), hero: hero?.id || null };
}

const statsAt = (id, level) => unitBattleStats({ units: { [id]: { level, breakthrough: Math.max(0, Math.ceil((level - 10) / 10)), awaken: 0, gear: {} } }, gear: {} }, id);

/** `asPlayed`: without the Oct 27 power pass, as the event is fought until it closes (see the header). */
const played = (stats, asPlayed) => (asPlayed ? { ...stats, powerOff: true } : stats);

function run(stageId, difficulty, rosterAt, level, seed, { asPlayed = false } = {}) {
  const d = defaultData();
  const f = freeUnitsBefore(d, rosterAt);
  const r = runHeadless({
    stageId, difficulty, seed, maxTime: 7200,
    plan: autoPlan(stageId, [...f.towers, f.hero]),
    loadout: f.towers.map((id) => ({ unitId: id, stats: played(statsAt(id, level), asPlayed) })),
    hero: { unitId: f.hero, stats: played(statsAt(f.hero, level), asPlayed) },
  });
  return { won: r.won, text: `${stageId} ${difficulty} roster<${rosterAt} L${level} seed ${seed}: ${r.won ? 'won' : 'lost'} w${r.wave} lives ${r.lives}` };
}

const SEEDS = [1, 2, 3];

/** A smart mixed team (veil sight, holy / mystic, splash, armor pierce, slow): the design bench's "build A". */
const BUILD_A = { towers: ['shiro', 'kage', 'aoi', 'akane', 'sango', 'miko', 'midori', 'momo'], hero: 'hikari' };

/** One battle with BUILD_A on the stage a difficulty plays (the variant when it has one, as createBattleSim passes it). */
function runBuild(stageId, difficulty, statsOf, seed, { asPlayed = false } = {}) {
  const stage = eventBattleStage(stageId, difficulty);
  const data = stage ? { stage } : undefined;
  const ids = [...BUILD_A.towers, BUILD_A.hero];
  const r = withDetMath(() => runHeadless({
    stageId, difficulty, seed, maxTime: 9000, data,
    plan: autoPlan(stageId, ids, { data }),
    loadout: BUILD_A.towers.map((id) => ({ unitId: id, stats: played(statsOf(id), asPlayed) })),
    hero: { unitId: BUILD_A.hero, stats: played(statsOf(BUILD_A.hero), asPlayed) },
  }));
  return { won: r.won, wave: r.wave, text: `${stageId} ${difficulty} seed ${seed}: ${r.won ? 'won' : 'lost'} w${r.wave}/${stage?.waves ?? r.sim?.totalWaves}` };
}
const atProfile = (name) => (id) => profileStats(id, { name, ...PROFILES[name] });

describe.skipIf(!hasRealData())('event balance (autoPlan, free units only)', () => {
  test('EB-1 every Halloween operation is won on Normal at its tuneLike roster and level', () => {
    const d = defaultData();
    const lost = [];
    for (const id of ['ev-halloween-1', 'ev-halloween-2', 'ev-halloween-3', 'ev-halloween-4']) {
      const like = d.stages[d.stages[id].tuneLike];
      for (const seed of SEEDS) {
        const r = run(id, 'normal', like.id, EXPECTED_LEVEL[like.chapter], seed);
        if (!r.won) lost.push(r.text);
      }
    }
    expect(lost).toEqual([]);
  }, 600000);

  test('EB-2 the Gourdlight Golem: Normal for a mid free team, Hard a challenge', () => {
    const asPlayed = { asPlayed: true };
    for (const seed of SEEDS) expect(run('ev-halloween-boss', 'normal', '4-1', 20, seed, asPlayed).won).toBe(true);
    expect(run('ev-halloween-boss', 'hard', '4-1', 20, 1, asPlayed).won).toBe(false);
    expect(run('ev-halloween-boss', 'hard', '8-1', 50, 1, asPlayed).won).toBe(true);
  }, 600000);

  test('EB-3 the Golem\'s Nightmare is really hard: mid and level-60 P1 teams lose, the late free-player profile wins', () => {
    const results = [];
    for (const seed of SEEDS) {
      const asPlayed = { asPlayed: true };
      const mid = runBuild('ev-halloween-boss', 'nightmare', (id) => statsAt(id, 40), seed, asPlayed);
      const p1 = runBuild('ev-halloween-boss', 'nightmare', atProfile('p1'), seed, asPlayed);
      const late = runBuild('ev-halloween-boss', 'nightmare', atProfile('f2p-late'), seed, asPlayed);
      results.push(mid.text, p1.text, late.text);
      expect(mid.won, mid.text).toBe(false);
      expect(mid.wave, mid.text).toBeLessThanOrEqual(10);
      expect(p1.won, p1.text).toBe(false);
      expect(late.won, late.text).toBe(true);
    }
    // eslint-disable-next-line no-console
    if (process.env.BALANCE) console.log(results.join('\n'));
  }, 600000);

  test('EB-4 Op 4 on Nightmare: a smart level-40 team wins, the chapter\'s free roster at its level loses', () => {
    for (const seed of SEEDS) {
      const smart = runBuild('ev-halloween-4', 'nightmare', (id) => statsAt(id, 40), seed);
      expect(smart.won, smart.text).toBe(true);
    }
    const like = defaultData().stages['ev-halloween-4'].tuneLike;
    expect(run('ev-halloween-4', 'nightmare', like, EXPECTED_LEVEL[defaultData().stages[like].chapter], 1).won).toBe(false);
  }, 600000);

  test('EB-5 with the Oct 27 power pass the Golem is easier (pinned: re-tune it before the event returns)', () => {
    // EB-2's and EB-3's battles with every girl's power row and the heroes' level curve on
    const got = [];
    for (const seed of SEEDS) got.push(run('ev-halloween-boss', 'normal', '4-1', 20, seed).won);
    got.push(run('ev-halloween-boss', 'hard', '4-1', 20, 1).won, run('ev-halloween-boss', 'hard', '8-1', 50, 1).won);
    for (const seed of SEEDS) {
      got.push(runBuild('ev-halloween-boss', 'nightmare', (id) => statsAt(id, 40), seed).won);
      got.push(runBuild('ev-halloween-boss', 'nightmare', atProfile('p1'), seed).won);
      got.push(runBuild('ev-halloween-boss', 'nightmare', atProfile('f2p-late'), seed).won);
    }
    // Normal: won on every seed. Hard: the mid free team now WINS (as played it loses), the late team wins.
    // Nightmare: the level-40 team still falls on wave 1, the level-60 P1 team now wins on seed 3 (it loses on seeds
    // 1 and 2, and on every seed as played), the late profile wins.
    expect(got).toEqual([true, true, true, true, true, false, false, true, false, false, true, false, true, true]);
  }, 600000);
});
