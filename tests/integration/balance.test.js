// Campaign balance check (integration): for every campaign stage, the sim's autoPlan bot
// using ONLY the units a free-to-play player owns at that point (starters + free recruits
// granted by earlier stages) must win on Easy at the expected account level for that
// chapter. Normal / Hard / Nightmare are reported as a table (set BALANCE=full) and
// loosely asserted (most Normal stages winnable, Nightmare rarely).
//
//   npx vitest run tests/integration/balance.test.js                  # Easy gate (fast-ish)
//   BALANCE=full npx vitest run tests/integration/balance.test.js     # full table, all difficulties
//   BALANCE=hero npx vitest run tests/integration/balance.test.js     # hero rework: headroom, pace, power, counters
//   BALANCE=modes npx vitest run tests/integration/balance.test.js    # battle modes × difficulty (rules on)
//   BALANCE=rules npx vitest run tests/integration/balance.test.js    # Standard, map rules off vs on
//   BALANCE=fpguard npx vitest run tests/integration/balance.test.js  # co-op freeplay death waves, rules on vs off
//   BALANCE_OUT=/tmp/table.md also writes the table to a file (vitest hides console of passing tests)
// The map rules (docs/specs/CODEX_MODES.md) are always on, as shipped: the Easy gate runs with them.
import { describe, test, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { hasRealData, defaultData } from '../../src/sim/data.js';
import { runHeadless, autoPlan } from '../../src/sim/headless.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { Sim } from '../../src/sim/Sim.js';
import { xpToReach } from '../../src/sim/hero.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { towers as towerDefs, heroes as heroDefs } from '../../src/data/units.js';
import { HERO_LEVEL_PRICES } from '../../src/data/heroTracks.js';
import { headroom, geoMean } from '../../tools/balance/headroom.js';
import { freeUnitsBefore } from '../sim/modesBot.js';
import { benchDps, towerBest, median } from '../../tools/balance/bench.js';

const ready = hasRealData();
const FULL = process.env.BALANCE === 'full';
const HERO = process.env.BALANCE === 'hero';
const MODES = process.env.BALANCE === 'modes';
const RULES = process.env.BALANCE === 'rules';
const FPGUARD = process.env.BALANCE === 'fpguard';

/** Expected F2P account level per chapter (books from first clears, bounty and commissions). */
export const EXPECTED_LEVEL = { 1: 1, 2: 8, 3: 14, 4: 20, 5: 25, 6: 30, 7: 35, 8: 40 };

/** The expected level for a stage: its chapter's, and Act II of chapter c plays at chapter c+1's (it opens with it). */
export function expectedLevel(s) {
  return EXPECTED_LEVEL[s.act === 2 ? Math.min(8, s.chapter + 1) : s.chapter] || 1;
}

// the F2P roster before a stage (unlock ancestors; Yuzuha from 1-7 or her legacy 4-2): tests/sim/modesBot.js

function statsAtLevel(unitId, level) {
  const breakthrough = Math.max(0, Math.ceil((level - 10) / 10));
  return unitBattleStats({ units: { [unitId]: { level, breakthrough, awaken: 0, gear: {} } }, gear: {} }, unitId);
}

/** Runs one stage with the F2P roster. */
export function runStage(stageId, difficulty, level, seed = 1, { hpMul = 1, heroId, ...options } = {}) {
  const d = defaultData();
  const free = freeUnitsBefore(d, stageId);
  const towers = free.towers;
  const hero = heroId === undefined ? free.hero : heroId;
  const plan = autoPlan(stageId, [...towers, ...(hero ? [hero] : [])]);
  const st = d.stages[stageId];
  const r = runHeadless({
    stageId, difficulty, plan, seed, maxTime: 7200, options,
    data: hpMul === 1 ? undefined : { stage: { ...st, hpScale: (st.hpScale ?? 1) * hpMul } },
    loadout: towers.map((id) => ({ unitId: id, stats: statsAtLevel(id, level) })),
    hero: hero ? { unitId: hero, stats: statsAtLevel(hero, level) } : null,
  });
  const h = r.sim.towers.find((t) => t.isHero);
  return { won: r.won, wave: r.wave, total: r.sim.totalWaves, lives: r.lives, maxLives: r.maxLives, units: [...towers, ...(hero ? [hero] : [])], heroLevel: h ? h.level : 0, sim: r.sim };
}

describe.skipIf(!ready)('campaign balance (autoPlan, free units only)', () => {
  test('every campaign stage is winnable on Easy at the expected level', () => {
    const d = defaultData();
    const campaign = Object.values(d.stages).filter((s) => s.kind === 'campaign');
    const lost = [];
    const rows = [];
    for (const s of campaign) {
      const r = runStage(s.id, 'easy', expectedLevel(s));
      rows.push(`${s.id.padEnd(4)} easy L${String(expectedLevel(s)).padEnd(2)} ${r.won ? 'WON ' : 'LOST'} wave ${r.wave}/${r.total} lives ${r.lives}/${r.maxLives}`);
      if (!r.won) lost.push(s.id);
    }
    console.log(`[balance] easy sweep:\n${rows.join('\n')}`);
    if (process.env.BALANCE_OUT && !FULL) writeFileSync(process.env.BALANCE_OUT, rows.join('\n') + '\n');
    expect(lost).toEqual([]);
  }, 600000);

  test.runIf(FULL)('full difficulty table', () => {
    const d = defaultData();
    const campaign = Object.values(d.stages).filter((s) => s.kind === 'campaign');
    const diffs = ['easy', 'normal', 'hard', 'nightmare'];
    const wins = Object.fromEntries(diffs.map((k) => [k, 0]));
    const rows = ['| Stage | Lv | Easy | Normal | Hard | Nightmare | Free units |', '|---|---|---|---|---|---|---|'];
    for (const s of campaign) {
      const lv = expectedLevel(s);
      const cells = [];
      let units = [];
      for (const k of diffs) {
        const r = runStage(s.id, k, lv);
        units = r.units;
        if (r.won) wins[k]++;
        cells.push(r.won ? `won (${r.lives}/${r.maxLives})` : `lost w${r.wave}/${r.total}`);
      }
      rows.push(`| ${s.id} | ${lv} | ${cells.join(' | ')} | ${units.join(', ')} |`);
    }
    rows.push(`| **wins** | | ${diffs.map((k) => `${wins[k]}/${campaign.length}`).join(' | ')} | |`);
    console.log(`[balance] full table:\n${rows.join('\n')}`);
    if (process.env.BALANCE_OUT) writeFileSync(process.env.BALANCE_OUT, rows.join('\n') + '\n');
    expect(wins.easy).toBe(campaign.length);
    expect(wins.normal).toBeGreaterThanOrEqual(Math.ceil(campaign.length * 0.6));
    expect(wins.nightmare).toBeLessThanOrEqual(Math.floor(campaign.length * 0.35));
  }, 3600000);

  test.runIf(MODES)('battle modes as shipped (mode + the stage rule), wins out of 40', () => {
    const d = defaultData();
    const campaign = Object.values(d.stages).filter((s) => s.kind === 'campaign');
    const modes = ['standard', 'reverse', 'rush', 'ironclad', 'frugal', 'laststand'];
    const diffs = (process.env.BALANCE_DIFFS || 'easy,normal,hard').split(',');
    const out = [];
    const wins = {};
    const hearts = {};
    for (const k of diffs) {
      wins[k] = Object.fromEntries(modes.map((m) => [m, 0]));
      hearts[k] = Object.fromEntries(modes.map((m) => [m, 0]));
      const rows = [`### ${k}`, '', '| Stage | Rule | Standard | Reverse | Rush | Ironclad | Half Income | Last Petal |', '|---|---|---|---|---|---|---|---|'];
      for (const s of campaign) {
        const lv = expectedLevel(s);
        const cells = modes.map((m) => {
          const r = runStage(s.id, k, lv, 1, { mode: m });
          if (r.won) {
            wins[k][m]++;
            hearts[k][m] += r.lives / r.maxLives;
          }
          return r.won ? `W${Math.round((100 * r.lives) / r.maxLives)}` : `L${r.wave}`;
        });
        rows.push(`| ${s.id} | ${s.rule?.id ?? '—'} | ${cells.join(' | ')} |`);
      }
      rows.push(`| **wins** | | ${modes.map((m) => `**${wins[k][m]}/${campaign.length}** (${wins[k][m] ? Math.round((100 * hearts[k][m]) / wins[k][m]) : 0} %)`).join(' | ')} |`, '');
      out.push(...rows);
    }
    console.log(`[balance] modes:\n${out.join('\n')}`);
    if (process.env.BALANCE_OUT) writeFileSync(process.env.BALANCE_OUT, out.join('\n') + '\n');
    // §10 thresholds (spec measurements in brackets in the comment)
    if (wins.easy) expect(wins.easy.standard).toBe(campaign.length);
    if (wins.normal) {
      const n = wins.normal;
      expect(n.standard).toBeGreaterThanOrEqual(38); // 39
      expect(n.reverse).toBeGreaterThanOrEqual(36); // 38
      expect(n.rush).toBeGreaterThanOrEqual(36); // 38
      expect(n.ironclad).toBeGreaterThanOrEqual(37); // 39
      expect(n.frugal).toBeGreaterThanOrEqual(35); // 37
      expect(n.laststand).toBeGreaterThanOrEqual(10); // 12
    }
    if (wins.hard) {
      const h = wins.hard;
      expect(h.standard).toBeGreaterThanOrEqual(29); // 31
      expect(h.reverse).toBeGreaterThanOrEqual(28); // 30
      expect(h.rush).toBeGreaterThanOrEqual(17); // 20
      expect(h.ironclad).toBeGreaterThanOrEqual(18); // 21
      expect(h.frugal).toBeGreaterThanOrEqual(11); // 13
      expect(h.laststand).toBeGreaterThanOrEqual(2); // 3
    }
    // no mode wins more stages than Standard
    for (const k of diffs) for (const m of modes) expect(wins[k][m], `${k} ${m}`).toBeLessThanOrEqual(wins[k].standard);
  }, 7200000);

  test.runIf(RULES)('map rules off vs on (Standard), every ruled stage', () => {
    const d = defaultData();
    const campaign = Object.values(d.stages).filter((s) => s.kind === 'campaign' && s.rule);
    const diffs = ['easy', 'normal', 'hard'];
    const rows = ['| Stage | Rule | Easy off → on | Normal off → on | Hard off → on |', '|---|---|---|---|---|'];
    const flips = [];
    for (const s of campaign) {
      const lv = expectedLevel(s);
      const cells = diffs.map((k) => {
        const off = runStage(s.id, k, lv, 1, { rule: null });
        const on = runStage(s.id, k, lv, 1);
        const c = (r) => (r.won ? `W${Math.round((100 * r.lives) / r.maxLives)}` : `L${r.wave}`);
        if (off.won !== on.won) flips.push(`${s.id} ${k} ${c(off)} → ${c(on)}`);
        return `${c(off)} → ${c(on)}${off.won !== on.won ? ' **flip**' : ''}`;
      });
      rows.push(`| ${s.id} | ${s.rule.id} | ${cells.join(' | ')} |`);
    }
    console.log(`[balance] rules:\n${rows.join('\n')}\nflips: ${flips.join('; ') || 'none'}`);
    if (process.env.BALANCE_OUT) writeFileSync(process.env.BALANCE_OUT, `${rows.join('\n')}\n\nflips: ${flips.join('; ') || 'none'}\n`);
    expect(flips.filter((f) => / (easy|normal) /.test(f))).toEqual([]);
  }, 3600000);

  // CODEX_MODES.md §9.11 step 4: past the goal a map rule keeps its combat effects; a strong team's
  // freeplay run (Blossom) must end within ±5 waves of the same run with the rule switched off.
  test.runIf(FPGUARD)('co-op freeplay with map rules: death wave within ±5 of rules off', async () => {
    const { coopStage } = await import('../../src/data/coop.js');
    const { Sim } = await import('../../src/sim/Sim.js');
    const team = ['kage', 'suzu', 'raika', 'chika', 'yuki', 'momo', 'kaede', 'umeko'];
    const level = Number(process.env.FP_LEVEL || 60);
    const stages = (process.env.FP_STAGES || '1-4,4-1,6-5,7-1,8-5').split(',');
    const rows = ['| Stage | Rule | Rule off: death wave | Rule on | Δ |', '|---|---|---|---|---|'];
    const bad = [];
    for (const id of stages) {
      const stage = coopStage(id, { freeplay: 'blossom' });
      const run = (rule) => {
        const plan = autoPlan(id, [...team, 'hikari'], { data: { stage } });
        const sim = new Sim({
          stageId: id, difficulty: 'normal', seed: 7, data: { stage },
          loadout: team.map((u) => ({ unitId: u, stats: statsAtLevel(u, level) })), hero: { unitId: 'hikari', stats: statsAtLevel('hikari', level) },
          options: { freeplay: true, autoStart: true, ...(rule ? {} : { rule: null }) },
        });
        let i = 0;
        let turn = 0;
        sim.startNextWave();
        for (let k = 0; k < 4 * 60 * 60 * 6 && sim.state !== 'lost' && sim.state !== 'won'; k++) {
          if (k % 4 === 0) {
            if (i < plan.length) {
              const a = plan[i];
              if (a.action === 'place') {
                if (sim.canPlace(a.unitId, a.x, a.y).ok) { sim.placeTower(a.unitId, a.x, a.y); i++; } else if (sim.placementReason(a.unitId, a.x, a.y)) i++;
              } else if (a.action === 'upgrade') {
                const t = sim.towerAt(a.x, a.y);
                const st = t && sim.upgradeStatus(t.uid, a.path);
                if (!t || (st.locked && st.reason !== 'cash')) i++;
                else if (!st.locked) { sim.upgradeTower(t.uid, a.path); i++; }
              } else i++;
            } else if (sim.towers.length) {
              const t = sim.towers[turn++ % sim.towers.length];
              for (const path of [0, 1, 2]) if (!sim.upgradeStatus(t.uid, path).locked) { sim.upgradeTower(t.uid, path); break; }
            }
            if (sim.hero && sim.heroUltStatus().ready) sim.activateUlt();
          }
          sim.update(0.25);
          sim.drainEvents();
        }
        return sim.wave;
      };
      const off = run(false);
      const on = run(true);
      const d = on - off;
      if (Math.abs(d) > 5) bad.push(`${id} ${d}`);
      rows.push(`| ${id} | ${stage.rule?.id ?? '—'} | ${off} | ${on} | ${d >= 0 ? '+' : ''}${d} |`);
      console.log(rows.at(-1));
    }
    console.log(`[balance] freeplay guard (Blossom, level ${level}):\n${rows.join('\n')}`);
    if (process.env.BALANCE_OUT) writeFileSync(process.env.BALANCE_OUT, `${rows.join('\n')}\n`);
    expect(bad).toEqual([]);
  }, 7200000);
});

// ---------------------------------------------------------------------------
// Hero rework (docs/specs/HERO_REWORK.md §6, §12; docs/BALANCE.md)
// ---------------------------------------------------------------------------
describe.runIf(ready && HERO)('hero rework balance (BALANCE=hero)', () => {
  const STAGES10 = ['1-1', '1-3', '1-5', '2-5', '3-5', '4-5', '5-5', '6-5', '7-5', '8-5'];
  const level = (id) => expectedLevel(defaultData().stages[id]);

  test('headroom (Normal, F2P bot, cap 16) and the pace guard (no buying)', () => {
    const rows = ['| Stage | Hero | Headroom | Won at ×1 | End level |', '|---|---|---|---|---|'];
    const ends = {};
    const values = [];
    for (const id of STAGES10) {
      const hr = headroom((m) => runStage(id, 'normal', level(id), 1, { hpMul: m }));
      ends[id] = hr.at1.heroLevel;
      values.push(hr.value);
      rows.push(`| ${id} | ${hr.at1.units.at(-1)} | ${hr.capped ? '≥16' : hr.value} | ${hr.wonAt1 ? '✓' : '✗'} | ${hr.at1.heroLevel} |`);
    }
    rows.push(`| **geomean** | | ${geoMean(values).toFixed(2)} | | |`);
    console.log(`[balance] hero headroom:\n${rows.join('\n')}`);
    if (process.env.BALANCE_OUT) writeFileSync(process.env.BALANCE_OUT, rows.join('\n') + '\n');
    // pace guard: with no coins spent, chapter 1 ends Lv 13–20, 8-5 Lv 17–21
    for (const id of ['1-1', '1-3', '1-5']) {
      expect(ends[id], id).toBeGreaterThanOrEqual(13);
      expect(ends[id], id).toBeLessThanOrEqual(20);
    }
    expect(ends['8-5']).toBeGreaterThanOrEqual(17);
    expect(ends['8-5']).toBeLessThanOrEqual(21);
  }, 3600000);

  test('power guard on the in-sim crowd / single-target bench', () => {
    const deps = { Sim, xpToReach, enemies: ENEMY_MAP };
    const t = towerDefs().map((u) => ({ id: u.id, t32: towerBest(deps, u.id, 3, 2), t42: towerBest(deps, u.id, 4, 2), t52: towerBest(deps, u.id, 5, 2), s52: towerBest(deps, u.id, 5, 2, { count: 1 }) }));
    const best52 = Math.max(...t.map((x) => x.t52));
    const bestS52 = Math.max(...t.map((x) => x.s52));
    const med = (k) => median(t.map((x) => x[k]));
    const lines = [];
    for (const u of heroDefs()) {
      const at = (L, count = 10) => benchDps(deps, { unitId: u.id, heroLevel: L, count });
      const c10 = at(10);
      const c20 = at(20);
      const c25 = at(25);
      const s25 = at(25, 1);
      lines.push(`${u.id}: Lv10 ${Math.round(c10)} · Lv20 ${Math.round(c20)} · Lv25 ${Math.round(c25)} (${(c25 / best52).toFixed(2)}× best 5/2) · single Lv25 ${Math.round(s25)} (${(s25 / bestS52).toFixed(2)}×)`);
      expect(c25 / best52, `${u.id} Lv 25 crowd ≤ 1.4× the best 5/2 tower`).toBeLessThanOrEqual(1.4);
      expect(s25 / bestS52, `${u.id} Lv 25 single ≤ the best 5/2 tower`).toBeLessThanOrEqual(1.0);
      expect(c25, `${u.id} Lv 25 crowd ≥ the 5/2 median`).toBeGreaterThanOrEqual(med('t52'));
      expect(c20, `${u.id} Lv 20 crowd ≥ the 4/2 median`).toBeGreaterThanOrEqual(med('t42'));
      expect(c10, `${u.id} Lv 10 crowd ≥ half the 3/2 median`).toBeGreaterThanOrEqual(0.5 * med('t32'));
    }
    console.log(`[balance] hero power (best 5/2 crowd ${Math.round(best52)}, single ${Math.round(bestS52)}; medians 3/2 ${Math.round(med('t32'))}, 4/2 ${Math.round(med('t42'))}, 5/2 ${Math.round(med('t52'))}):\n${lines.join('\n')}`);
  }, 600000);

  test('capability timing: the level a hero-only counter needs by its first wave (no buying), or the coins to buy it', () => {
    const lines = [];
    for (const id of ['6-3', '6-4', '6-5']) {
      const r = runStage(id, 'normal', level(id), 1, { heroId: 'hikari' });
      const cleanseAt = heroDefs().find((u) => u.id === 'hikari').hero.levels.find((l) => l.mods.aura?.cleanse).level;
      const coins = HERO_LEVEL_PRICES.slice(0, cleanseAt - 1).reduce((a, b) => a + b, 0);
      lines.push(`${id}: Hikari ends Lv ${r.heroLevel} (cleanse at Lv ${cleanseAt}; buying it from Lv 1 costs ${coins})`);
      expect(r.heroLevel).toBeGreaterThanOrEqual(cleanseAt);
    }
    console.log(`[balance] capability timing:\n${lines.join('\n')}`);
  }, 600000);
});
