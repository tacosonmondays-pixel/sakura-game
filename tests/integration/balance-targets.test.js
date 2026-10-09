// Balance targets from the "frisk1636" playtest round (docs/BALANCE.md): fast CI guards on the
// numbers the playtester complained about, measured with the balance probe
// (tools/balance/probe.mjs) — the same F2P roster, levels and autoPlan bot as balance.test.js.
//
//   npx vitest run tests/integration/balance-targets.test.js                 # fast set (~1 min idle)
//   BALANCE=full npx vitest run tests/integration/balance-targets.test.js    # + slow medians (many minutes)
//
// Headroom = the largest multiplier on every enemy's HP that the planner still beats (log
// bisection between 1.0 and 3.0, 4 steps → ~7 % resolution, reported as the lower bound).
// Values measured when the targets were set are in [brackets] in docs/BALANCE.md.
import { describe, test, expect } from 'vitest';
import { hasRealData, defaultData } from '../../src/sim/data.js';
import { generateWave, waveClearBonus } from '../../src/sim/waves.js';
import { buildPaths } from '../../src/sim/path.js';
import {
  runProbe, headroom, stageEconomy, affordTimeline, tierCosts, quantile,
} from '../../tools/balance/probe.mjs';
import { f2pSetup } from '../../tools/balance/f2p.mjs';
import { DIFFICULTIES } from '../../src/data/types.js';

const ready = hasRealData();
const FULL = process.env.BALANCE === 'full';

const cache = new Map();
/** Normal/Hard/Easy headroom of the bot (cached per stage × difficulty). */
function hr(stageId, difficulty = 'normal', planner = 'bot') {
  const key = `${stageId}|${difficulty}|${planner}`;
  if (!cache.has(key)) cache.set(key, headroom({ stageId, difficulty, planner, lo: 1, hi: 3, steps: 4 }));
  const r = cache.get(key);
  return r.bound === '<' ? 0 : r.headroom; // '<' = lost at ×1.0
}

describe.skipIf(!ready)('balance targets (docs/BALANCE.md)', () => {
  test('chapter 1 ramps: 1-1 ≥ 1-2 ≥ 1-3, and 1-2 is no walkover ("1.1 balanced, 1.2 too easy")', () => {
    const h11 = hr('1-1');
    const h12 = hr('1-2');
    const h13 = hr('1-3');
    for (const [id, h] of [['1-1', h11], ['1-2', h12], ['1-3', h13]]) {
      expect(h, `${id} headroom`).toBeGreaterThanOrEqual(1.4);
      expect(h, `${id} headroom`).toBeLessThanOrEqual(2.6);
    }
    expect(h11).toBeGreaterThanOrEqual(h12);
    expect(h12).toBeGreaterThanOrEqual(h13 / 1.04);
    expect(h12).toBeLessThanOrEqual(2.2);
    // The feel, not only the headroom (round 2): at shipped HP 1-2 costs lives where 1-1 costs none,
    // its opening walks enemies well down the lane, and Hikari alone no longer clears it untouched.
    const d = defaultData();
    const r11 = runProbe({ stageId: '1-1', difficulty: 'normal' });
    const r12 = runProbe({ stageId: '1-2', difficulty: 'normal' });
    expect(r12.won).toBe(true);
    expect(r12.lives, '1-2 lives vs 1-1').toBeLessThan(r11.lives);
    expect(r12.normalsEarly.pathP90, '1-2 waves 1-3 path walked (p90)').toBeGreaterThanOrEqual(0.5);
    const solo = runProbe({ stageId: '1-2', difficulty: 'normal', detail: false, setup: { ...f2pSetup(d, '1-2'), towers: [] } });
    expect(solo.lives, '1-2 Hikari alone').toBeLessThanOrEqual(95);
  }, 600000);

  test('Normal / Hard / Easy sit in their headroom bands', () => {
    // Normal ≈ ×1.3–1.6 median with a gentle ramp (casual players win but lose some lives).
    const h14 = hr('1-4');
    expect(h14).toBeGreaterThanOrEqual(1.3);
    expect(h14).toBeLessThanOrEqual(2.1);
    const h22 = hr('2-2');
    expect(h22).toBeGreaterThanOrEqual(1.25);
    expect(h22).toBeLessThanOrEqual(2.0);
    // Hard ≈ ×1.1–1.3: clearly harder than Normal, still winnable.
    const hh13 = hr('1-3', 'hard');
    expect(hh13).toBeGreaterThanOrEqual(1.15);
    expect(hh13).toBeLessThanOrEqual(2.0);
    expect(hh13).toBeLessThan(hr('1-3') * 1.04);
    // Easy stays cozy even on the chapter-1 boss stage.
    const easy = runProbe({ stageId: '1-5', difficulty: 'easy', detail: false });
    expect(easy.won).toBe(true);
    expect(easy.lives).toBeGreaterThanOrEqual(130);
  }, 600000);

  test('Nightmare is hard but winnable at the expected level (20 lives)', () => {
    expect(DIFFICULTIES.nightmare.lives).toBe(20);
    for (const [stageId, planner] of [['1-1', 'bot'], ['2-2', 'bot'], ['2-5', 'human']]) {
      const r = runProbe({ stageId, difficulty: 'nightmare', planner, detail: false });
      expect(r.won, `${stageId} Nightmare (${planner})`).toBe(true);
    }
  }, 600000);

  test('Bounty arenas: the Library I Hard medal (the key to sweeps) is reachable, Coins I is won', () => {
    const lib = runProbe({ stageId: 'res-books-1', difficulty: 'hard', detail: false });
    expect(lib.won, 'res-books-1 Hard (bot, Lv5)').toBe(true);
    const coins = runProbe({ stageId: 'res-coins-1', difficulty: 'normal', detail: false });
    expect(coins.won, 'res-coins-1 Normal (bot)').toBe(true);
  }, 600000);

  test('bosses are on screen long enough to be seen, and still die (Normal, bot)', () => {
    for (const [stageId, boss] of [['1-5', 'slime_prince'], ['4-5', 'orc_general']]) {
      const r = runProbe({ stageId, difficulty: 'normal' });
      const b = r.bosses.find((x) => x.id === boss);
      expect(b, `${stageId} ${boss} spawned`).toBeTruthy();
      expect(b.fate, `${stageId} ${boss} fate`).toBe('killed');
      expect(b.alive, `${stageId} ${boss} seconds alive`).toBeGreaterThanOrEqual(15);
      expect(b.pathPct, `${stageId} ${boss} share of the path`).toBeGreaterThanOrEqual(0.3);
      expect(r.won).toBe(true);
    }
  }, 600000);

  test('1-1 slimes walk before they melt, and the hired girls matter ("poor slimes lol")', () => {
    const r = runProbe({ stageId: '1-1', difficulty: 'normal' });
    expect(r.won).toBe(true);
    expect(r.normals.aliveMed).toBeGreaterThanOrEqual(8);
    expect(r.normals.pathMed).toBeGreaterThanOrEqual(0.3);
    expect(r.damageShare.hikari ?? 0).toBeLessThanOrEqual(0.85);
  }, 600000);

  test('economy: a focused tier 4 by ≤ 80 % of the waves in chapters 1–2, tier 5 only at the very end', () => {
    const d = defaultData();
    // Focused player: hero + Rei + Aoi (Piercing Arrows) to tier 4, every enemy killed.
    for (const stageId of ['1-3', '1-4', '1-5', '2-1']) {
      const econ = stageEconomy(stageId, 'normal');
      const su = f2pSetup(d, stageId);
      const cost = tierCosts(su.hero, 0, 'normal')[0].cost + tierCosts('rei', 0, 'normal')[0].cost + tierCosts('aoi', 0, 'normal')[4].cum;
      const first = econ.waves.find((w) => w.cumulative >= cost);
      expect(first, `${stageId}: focused tier 4 affordable at all`).toBeTruthy();
      const wave = cost <= econ.startCash ? 1 : first.wave + 1;
      const pct = wave / econ.waves.length;
      expect(pct, `${stageId} focused T4 at wave ${wave}/${econ.waves.length}`).toBeLessThanOrEqual(0.8);
      expect(pct, `${stageId} focused T4 not trivially early`).toBeGreaterThanOrEqual(0.45);
    }
    // Tier 5 is a long-stage goal. Even a player who pours EVERY coin into Aoi alone (full-kill
    // economy, no other girl — an upper bound no real defense reaches) cannot afford it before the
    // last 10 % of a chapter 1–3 stage; in chapters 1–2 her carry path (Piercing Arrows) never gets it.
    for (const s of Object.values(d.stages).filter((x) => x.kind === 'campaign' && x.chapter <= 3)) {
      const econ = stageEconomy(s.id, 'normal');
      for (const p of affordTimeline('aoi', econ.waves, 'normal', econ.startCash)) {
        const w = p.tiers[5].wave;
        if (w != null) expect(w / econ.waves.length, `${s.id} aoi ${p.name} T5 at wave ${w}/${econ.waves.length}`).toBeGreaterThanOrEqual(0.9);
        if (s.chapter <= 2 && p.path === 0) expect(w, `${s.id} aoi ${p.name} T5`).toBeNull();
      }
    }
  });

  test('the analytic economy pays the sim\'s own wave-clear + crowd bonus', () => {
    const d = defaultData();
    const stage = d.stages['1-2'];
    const paths = buildPaths(d.maps[stage.mapId]);
    const econ = stageEconomy('1-2', 'normal');
    let crowdTotal = 0;
    for (const w of econ.waves) {
      const wd = generateWave(stage, w.wave, (id) => d.enemies[id] || null, { pathCount: paths.length, pathLengths: paths.map((p) => p.length) });
      const wb = waveClearBonus(w.wave, wd.spawns);
      expect(w.bonus).toBe(Math.round(wb.total * stage.cashScale));
      expect(w.crowd).toBe(Math.round(wb.crowd * stage.cashScale));
      crowdTotal += w.crowd;
    }
    // "Not a huge amount more, just a little": 4–12 % of everything the stage pays.
    expect(crowdTotal / econ.totalCoins).toBeGreaterThanOrEqual(0.04);
    expect(crowdTotal / econ.totalCoins).toBeLessThanOrEqual(0.12);
  });

  test.runIf(FULL)('slow: Normal and Hard medians, every boss killed by a planner', () => {
    const d = defaultData();
    const campaign = Object.values(d.stages).filter((s) => s.kind === 'campaign');
    const normal = campaign.map((s) => hr(s.id));
    const medN = quantile(normal, 0.5);
    console.log(`[balance-targets] Normal bot headroom median ×${medN} over ${normal.length} stages`);
    expect(medN).toBeGreaterThanOrEqual(1.4);
    expect(medN).toBeLessThanOrEqual(1.9);
    const hardSample = ['1-1', '1-3', '1-5', '2-1', '2-5', '3-1', '3-5', '4-1', '4-5', '5-1', '5-5', '6-1', '6-5', '7-1', '7-5', '8-1', '8-5'];
    const medH = quantile(hardSample.map((id) => hr(id, 'hard')), 0.5);
    console.log(`[balance-targets] Hard bot headroom median ×${medH} over ${hardSample.length} stages`);
    expect(medH).toBeGreaterThanOrEqual(1.0);
    expect(medH).toBeLessThanOrEqual(1.4);
    for (const s of Object.values(d.stages).filter((x) => x.kind === 'campaign' || x.kind === 'boss')) {
      const scripted = s.waveGen.fixed.map((f) => d.enemies[f.enemy]).filter((e) => e && (e.tier === 'boss' || e.tier === 'miniboss'));
      if (!scripted.length) continue;
      const killed = ['bot', 'human'].some((planner) => {
        const r = runProbe({ stageId: s.id, difficulty: 'normal', planner });
        return scripted.every((e) => r.bosses.some((b) => b.id === e.id && b.fate === 'killed'));
      });
      expect(killed, `${s.id} boss killed by bot or human-like planner`).toBe(true);
    }
  }, 7200000);
});
