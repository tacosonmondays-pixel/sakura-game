#!/usr/bin/env node
// Sakura Sentinels balance probe. Plays campaign stages headlessly with the free-to-play roster
// at the expected account level (tools/balance/f2p.mjs, shared with
// tests/integration/balance.test.js) and measures, per stage × difficulty:
//   1. result (win/lose, lives, wave reached) for the autoPlan bot and a human-like planner;
//   2. HEADROOM — the largest enemy-HP multiplier the planner still beats (log bisection);
//   3. economy — coins per wave (start cash, kill bounty, wave bonus, income), when a player who
//      pours everything into one girl could afford her tiers 1-5, placement costs vs start cash,
//      and how much cash the bot leaves unspent;
//   4. bosses / minibosses — seconds from spawn to death or leak and % of the path walked, next
//      to ordinary enemies' time alive;
// plus an out-of-battle economy audit (levels, breakthroughs, awakening vs what a player earns).
// Writes JSON + a markdown report.
//
//   node tools/balance/measure.mjs                          # default sample: all of ch1-2, x-1 + x-5 of ch3-8, Total Assault, book Bounty
//   node tools/balance/measure.mjs --stages ch1 --diffs normal,hard --planners bot --no-headroom
//   node tools/balance/measure.mjs --stages 1-1,1-2,4-5 --seeds 1,2,3 --out /tmp/probe   # -> /tmp/probe.json + /tmp/probe.md
//   node tools/balance/measure.mjs --help
//
// Deterministic: same data + options -> same numbers (seeded sim, no Math.random).

import './register.mjs';
import { fork, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DIFFS = ['easy', 'normal', 'hard', 'nightmare'];

const HELP = `Balance probe — node tools/balance/measure.mjs [options]

  --stages LIST     comma list of stage ids and groups (default: "default")
                    groups: default (all of ch1-2, x-1 and x-5 of ch3-8, Total Assault, res-books-1..3)
                            | campaign | chN (e.g. ch1) | finales | assault | bounty
                    ranges: 1-1..2-5
  --diffs LIST      difficulties (default easy,normal,hard,nightmare)
  --planners LIST   bot (autoPlan, as in the balance test) and/or human (few girls, then upgrades,
                    uses the hero ult)  (default bot,human)
  --carry ID        focus unit of the human-like planner (default: the bot's own carry)
  --seeds LIST      battle seeds for the win/lose result (default 1); headroom uses the first seed
  --no-headroom     skip the HP-multiplier search
  --hr-lo X --hr-hi Y --hr-steps N   headroom search range and bisection steps (default 0.5 8 5)
  --focus LIST      units for the "afford tiers" economy table (default aoi,rei,yuki,sango,kage,shiro,hikari)
  --jobs N          worker processes (default min(3, cpus-1))
  --out PREFIX      write PREFIX.json and PREFIX.md (default tools/balance/out/balance-probe, git-ignored)
  --json FILE / --md FILE   explicit output files
  --mail FILE       a src/systems/mail.js exporting BETA_GIFT (e.g. from another worktree) for the audit
  --no-meta         skip the out-of-battle economy audit
  --from FILES      comma list of JSON files written by earlier runs: merge their results (later
                    files win; a later --no-headroom result keeps the earlier headroom) and rebuild
                    the report without simulating — lets a long sweep run as short foreground chunks
  --quiet           no progress lines
`;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const o = {
    stages: 'default', diffs: DIFFS.join(','), planners: 'bot,human', seeds: '1', headroom: true,
    hrLo: 0.5, hrHi: 8, hrSteps: 5, focus: 'aoi,rei,yuki,sango,kage,shiro,hikari',
    jobs: Math.max(1, Math.min(3, os.cpus().length - 1)), out: path.join(HERE, 'out', 'balance-probe'), json: null, md: null,
    mail: null, meta: true, quiet: false, worker: false, carry: null, from: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = () => argv[++i];
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--worker') o.worker = true;
    else if (a === '--stages') o.stages = v();
    else if (a === '--diffs') o.diffs = v();
    else if (a === '--planners') o.planners = v();
    else if (a === '--carry') o.carry = v();
    else if (a === '--seeds') o.seeds = v();
    else if (a === '--no-headroom') o.headroom = false;
    else if (a === '--hr-lo') o.hrLo = Number(v());
    else if (a === '--hr-hi') o.hrHi = Number(v());
    else if (a === '--hr-steps') o.hrSteps = Number(v());
    else if (a === '--focus') o.focus = v();
    else if (a === '--jobs') o.jobs = Math.max(1, Number(v()) || 1);
    else if (a === '--out') o.out = v();
    else if (a === '--json') o.json = v();
    else if (a === '--md') o.md = v();
    else if (a === '--mail') o.mail = v();
    else if (a === '--no-meta') o.meta = false;
    else if (a === '--from') o.from = v();
    else if (a === '--quiet') o.quiet = true;
    else throw new Error(`unknown option ${a} (see --help)`);
  }
  return o;
}

const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

function selectStages(spec, stages) {
  const campaign = Object.values(stages).filter((s) => s.kind === 'campaign').map((s) => s.id);
  const out = [];
  const push = (id) => {
    if (!stages[id]) throw new Error(`unknown stage ${id}`);
    if (!out.includes(id)) out.push(id);
  };
  for (const tok of list(spec)) {
    if (tok === 'default') {
      for (const id of campaign) {
        const [c, n] = id.split('-').map(Number);
        if (c <= 2 || n === 1 || n === 5) push(id);
      }
      for (const id of ['boss-lych', 'boss-colossus', 'boss-ashwing', 'res-books-1', 'res-books-2', 'res-books-3']) if (stages[id]) push(id);
    } else if (tok === 'campaign') campaign.forEach(push);
    else if (/^ch\d$/.test(tok)) campaign.filter((id) => id.startsWith(`${tok.slice(2)}-`)).forEach(push);
    else if (tok === 'finales') campaign.filter((id) => id.endsWith('-5')).forEach(push);
    else if (tok === 'assault') Object.values(stages).filter((s) => s.kind === 'boss').forEach((s) => push(s.id));
    else if (tok === 'bounty') Object.values(stages).filter((s) => s.kind === 'resource').forEach((s) => push(s.id));
    else if (tok.includes('..')) {
      const [a, b] = tok.split('..');
      const ia = campaign.indexOf(a);
      const ib = campaign.indexOf(b);
      if (ia < 0 || ib < 0) throw new Error(`bad range ${tok}`);
      campaign.slice(Math.min(ia, ib), Math.max(ia, ib) + 1).forEach(push);
    } else push(tok);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Worker: one job = one stage × difficulty × planner
// ---------------------------------------------------------------------------

async function runJob(P, job) {
  const t0 = Date.now();
  const seeds = job.seeds.length ? job.seeds : [1];
  const base = P.runProbe({ stageId: job.stageId, difficulty: job.difficulty, seed: seeds[0], planner: job.planner, carry: job.carry });
  const seedRuns = [{ seed: seeds[0], won: base.won, wave: base.wave, lives: base.lives }];
  for (const s of seeds.slice(1)) {
    const r = P.runProbe({ stageId: job.stageId, difficulty: job.difficulty, seed: s, planner: job.planner, carry: job.carry, detail: false });
    seedRuns.push({ seed: s, won: r.won, wave: r.wave, lives: r.lives });
  }
  const hr = job.headroom
    ? P.headroom({ stageId: job.stageId, difficulty: job.difficulty, seed: seeds[0], planner: job.planner, carry: job.carry, lo: job.hrLo, hi: job.hrHi, steps: job.hrSteps, baseWon: base.won })
    : null;
  return { ...job, baseline: base, seedRuns, headroom: hr, ms: Date.now() - t0 };
}

async function workerMain() {
  const P = await import('./probe.mjs');
  process.on('message', async (msg) => {
    if (msg?.type !== 'job') return;
    try {
      process.send({ type: 'result', id: msg.id, result: await runJob(P, msg.job) });
    } catch (err) {
      process.send({ type: 'error', id: msg.id, error: String(err?.stack || err) });
    }
  });
  process.send({ type: 'ready' });
}

/** Runs jobs on N forked workers (or inline when N = 1). */
async function runPool(jobs, n, log) {
  const results = new Array(jobs.length);
  let done = 0;
  const report = (i, r) => {
    results[i] = r;
    done++;
    if (log) {
      const b = r.baseline;
      const h = r.headroom ? ` headroom ${r.headroom.bound === '=' ? '' : r.headroom.bound}x${r.headroom.headroom}` : '';
      log(`[${String(done).padStart(3)}/${jobs.length}] ${r.stageId.padEnd(13)} ${r.difficulty.padEnd(9)} ${r.planner.padEnd(5)} ${b.won ? 'WON ' : 'LOST'} w${b.wave}/${b.totalWaves} lives ${b.lives}/${b.maxLives}${h} (${(r.ms / 1000).toFixed(1)}s)`);
    }
  };
  if (n <= 1) {
    const P = await import('./probe.mjs');
    for (let i = 0; i < jobs.length; i++) report(i, await runJob(P, jobs[i]));
    return results;
  }
  let next = 0;
  await new Promise((resolve, reject) => {
    let alive = 0;
    const self = fileURLToPath(import.meta.url);
    for (let w = 0; w < Math.min(n, jobs.length); w++) {
      const child = fork(self, ['--worker'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      alive++;
      let current = -1;
      const feed = () => {
        if (next >= jobs.length) {
          child.kill();
          return;
        }
        current = next++;
        child.send({ type: 'job', id: current, job: jobs[current] });
      };
      child.on('message', (msg) => {
        if (msg.type === 'ready') feed();
        else if (msg.type === 'result') {
          report(msg.id, msg.result);
          feed();
        } else if (msg.type === 'error') reject(new Error(`job ${JSON.stringify(jobs[msg.id])} failed:\n${msg.error}`));
      });
      child.on('exit', (code) => {
        alive--;
        if (code && current >= 0 && !results[current]) reject(new Error(`worker exited with ${code}`));
        if (!alive) resolve();
      });
    }
  });
  return results;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const fmtN = (v) => (v == null || !Number.isFinite(v) ? '—' : Math.round(v).toLocaleString('en-US'));
const fmtHr = (h) => (!h ? '—' : `${h.bound === '>' ? '>' : h.bound === '<' ? '<' : ''}×${h.headroom.toFixed(2)}`);
const median = (a) => {
  const v = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y);
  if (!v.length) return null;
  const m = (v.length - 1) / 2;
  return (v[Math.floor(m)] + v[Math.ceil(m)]) / 2;
};

function resultCell(r) {
  if (!r) return '—';
  const b = r.baseline;
  const seeds = r.seedRuns.length > 1 ? ` (${r.seedRuns.filter((s) => s.won).length}/${r.seedRuns.length})` : '';
  return `${b.won ? `W ${b.lives}/${b.maxLives}` : `L w${b.wave}/${b.totalWaves}`}${seeds} ${fmtHr(r.headroom)}`;
}

function buildMarkdown(ctx) {
  const { opts, stages, results, econ, afford, placement, meta, P, startedAt, seconds, git } = ctx;
  const get = (s, d, p) => results.find((r) => r.stageId === s && r.difficulty === d && r.planner === p);
  const diffs = list(opts.diffs);
  const planners = list(opts.planners);
  const L = [];
  const D = P.DATA;
  L.push('# Sakura Sentinels — balance probe');
  L.push('');
  L.push(`Generated ${startedAt} on \`${git}\` in ${(seconds / 60).toFixed(1)} min. Stages: ${stages.join(', ')}. Difficulties: ${diffs.join(', ')}. Planners: ${planners.join(', ')}${opts.carry ? ` (human carry: ${opts.carry})` : ''}. Seeds: ${opts.seeds}.`);
  L.push('');
  L.push('Command: `node tools/balance/measure.mjs` (see `--help`). Free-to-play roster and levels: `tools/balance/f2p.mjs` (the same assumptions as `tests/integration/balance.test.js`: starters + free recruits granted by earlier stages, all at `EXPECTED_LEVEL` of the chapter, no gear, no awakening).');
  L.push('');
  L.push('**How to read.** `W 99/100` = won with 99 of 100 lives; `L w5/12` = lost on wave 5 of 12. **Headroom** `×1.8` = the planner still wins when every enemy has 1.8× its shipped HP on that difficulty (`>×8` = still wins at the top of the search, `<×0.5` = loses even at half HP). Around ×1.0–1.3 a stage is tight for that planner; ×3+ means it plays itself. The **bot** is `autoPlan` exactly as the balance test runs it; **human** is the same girls on the same spots, but only two (+ hero/detector) early, then coins poured into one carry (tier 3 → 4 → 5) and the hero ult fired when ready.');
  L.push('');

  // ---- headlines
  L.push('## Headlines (computed)');
  L.push('');
  const camp = stages.filter((s) => D.stages[s].kind === 'campaign');
  for (const p of planners) {
    const parts = diffs.map((d) => {
      const rs = camp.map((s) => get(s, d, p)).filter(Boolean);
      const wins = rs.filter((r) => r.baseline.won).length;
      const hr = median(rs.map((r) => r.headroom?.headroom));
      return `${d} ${wins}/${rs.length} won, median headroom ×${hr == null ? '—' : hr.toFixed(2)}`;
    });
    L.push(`* **${p}** on the sampled campaign stages: ${parts.join(' · ')}.`);
  }
  const ch1 = camp.filter((s) => s.startsWith('1-'));
  if (ch1.length && diffs.includes('normal')) {
    L.push(`* Chapter 1 ramp on Normal (bot headroom): ${ch1.map((s) => `${s} ${fmtHr(get(s, 'normal', planners[0])?.headroom)}`).join(' → ')}.`);
  }
  if (afford.length && diffs.includes('normal')) {
    const aoi = afford.filter((a) => a.unitId === 'aoi' && a.difficulty === 'normal');
    const t4 = aoi.filter((a) => a.best[4]?.wave != null).length;
    const t5 = aoi.filter((a) => a.best[5]?.wave != null).length;
    L.push(`* Aoi on Normal, every coin into her (full-kill economy): tier 4 reachable before the last wave on ${t4}/${aoi.length} sampled stages, tier 5 on ${t5}/${aoi.length}.`);
  }
  const bossStages = stages.filter((s) => results.some((r) => r.stageId === s && r.difficulty === 'normal' && r.baseline.bosses?.length));
  for (const s of bossStages) {
    const parts = planners.map((p) => {
      const r = get(s, 'normal', p);
      if (!r?.baseline.bosses?.length) return null;
      return r.baseline.bosses.map((b) => `${p}: ${b.alive}s, ${Math.round((b.pathPct ?? 0) * 100)}% of the path, ${b.fate}${b.fate === 'leaked' ? ` (−${b.leakCost ?? 'all'} lives)` : ''}`).join('; ');
    }).filter(Boolean);
    const b0 = results.find((r) => r.stageId === s && r.difficulty === 'normal' && r.baseline.bosses?.length).baseline.bosses[0];
    L.push(`* ${s} Normal — ${b0.id} (${fmtN(b0.maxHp)} HP): ${parts.join(' · ')}.`);
  }
  L.push('');

  // ---- 1 overview
  L.push('## 1. Results and headroom per stage');
  L.push('');
  for (const p of planners) {
    L.push(`### ${p === 'bot' ? 'Bot (autoPlan)' : 'Human-like planner'}`);
    L.push('');
    L.push(`| Stage | Lv | Roster | ${diffs.map((d) => d[0].toUpperCase() + d.slice(1)).join(' | ')} | Unspent cash (Normal) | Max tier (Normal) |`);
    L.push(`|---|---|---|${diffs.map(() => '---').join('|')}|---:|---:|`);
    for (const s of stages) {
      const any = results.find((r) => r.stageId === s && r.planner === p);
      if (!any) continue;
      const n = get(s, 'normal', p);
      L.push(`| ${s} | ${any.baseline.level} | ${any.baseline.units.join(', ')} | ${diffs.map((d) => resultCell(get(s, d, p))).join(' | ')} | ${n ? `${Math.round(n.baseline.unspentPct * 100)}% (${fmtN(n.baseline.cashEnd)})` : '—'} | ${n ? `T${n.baseline.maxTier}` : '—'} |`);
    }
    L.push('');
  }

  // ---- 2 difficulty gap
  L.push('## 2. Difficulty gap ("normal be very easy, nightmare be hell")');
  L.push('');
  L.push('| Difficulty | HP | Speed | Coins | Costs | Lives | Income towers |');
  L.push('|---|---:|---:|---:|---:|---:|---|');
  for (const d of DIFFS) {
    const x = P.DIFFICULTIES[d];
    L.push(`| ${x.name} | ×${x.hpMul} | ×${x.speedMul} | ×${x.cashMul} | ×${x.costMul} | ${x.lives} | ${x.noIncome ? 'off' : 'on'} |`);
  }
  L.push('');
  L.push('Median headroom by chapter (sampled stages):');
  L.push('');
  L.push(`| Chapter | Planner | ${diffs.join(' | ')} |`);
  L.push(`|---|---|${diffs.map(() => '---:').join('|')}|`);
  const chapters = [...new Set(camp.map((s) => D.stages[s].chapter))].sort((a, b) => a - b);
  for (const c of chapters) {
    for (const p of planners) {
      const cells = diffs.map((d) => {
        const rs = camp.filter((s) => D.stages[s].chapter === c).map((s) => get(s, d, p)).filter(Boolean);
        const hr = median(rs.map((r) => r.headroom?.headroom));
        return `${hr == null ? '—' : `×${hr.toFixed(2)}`} (${rs.filter((r) => r.baseline.won).length}/${rs.length} won)`;
      });
      L.push(`| ${c} | ${p} | ${cells.join(' | ')} |`);
    }
  }
  L.push('');
  if (diffs.includes('nightmare')) {
    const nm = results.filter((r) => r.difficulty === 'nightmare' && r.planner === planners[0] && !r.baseline.won);
    const w1 = nm.filter((r) => r.baseline.wave <= 1).length;
    L.push(`Nightmare (${planners[0]}): lost ${nm.length} of ${results.filter((r) => r.difficulty === 'nightmare' && r.planner === planners[0]).length}; ${w1} of those on wave 1 (one leak = defeat: 1 life). First leaks: ${nm.slice(0, 12).map((r) => `${r.stageId} ${Object.keys(r.baseline.leaksByEnemy).join('/') || '?'} w${r.baseline.wave}`).join(', ')}.`);
    L.push('');
  }

  // ---- 3 chapter 1 ramp
  if (ch1.length) {
    L.push('## 3. Chapter 1 ramp ("1.1 was balanced, 1.2 is too easy")');
    L.push('');
    L.push('The campaign screen labels stages `1-1` … `1-5` (stage cards, `src/ui/screens/campaign.js`); there is no `1-0`. Full-kill totals come from the wave generator (every enemy killed, split children included).');
    L.push('');
    L.push('| Stage | Diff | Map (path tiles) | hpScale | Waves | Enemies | Enemy HP total | Coins total (start + full kill) | HP per coin | Bot headroom | Human headroom | Bot lives | Normals alive (median / p90 s) | Waves 1-3 alive (median / p90 s), path walked p90 |');
    L.push('|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|');
    for (const d of diffs.filter((x) => x === 'normal' || x === 'hard')) {
      for (const s of ch1) {
        const e = econ[`${s}|${d}`];
        const b = get(s, d, 'bot');
        const h = get(s, d, 'human');
        const n = e.waves.reduce((a, w) => a + w.enemies, 0);
        const ea = b?.baseline.normalsEarly;
        L.push(`| ${s} | ${d} | ${e.mapId} (${e.pathLengths.join(' + ')}) | ${D.stages[s].hpScale} | ${D.stages[s].waves} | ${fmtN(n)} | ${fmtN(e.totalHp)} | ${fmtN(e.totalCoins)} | ${(e.totalHp / e.totalCoins).toFixed(2)} | ${fmtHr(b?.headroom)} | ${fmtHr(h?.headroom)} | ${b ? `${b.baseline.lives}/${b.baseline.maxLives}` : '—'} | ${b?.baseline.normals ? `${b.baseline.normals.aliveMed} / ${b.baseline.normals.aliveP90}` : '—'} | ${ea ? `${ea.aliveMed} / ${ea.aliveP90}, ${Math.round(ea.pathP90 * 100)}%` : '—'} |`);
      }
    }
    L.push('');
  }

  // ---- 4 economy
  L.push('## 4. In-battle economy ("units be a bit spendy", "to level 4 you need 2400 gold")');
  L.push('');
  L.push('Coins available by the start of a wave = start cash + every coin earned in earlier waves if every enemy dies (kill bounty incl. split children + wave-clear bonus; no Momo income). "Ready by wave N" = a player who put EVERY coin into this one girl could buy that tier before wave N (`—` = not within the stage; the % is the share of the whole stage\'s coins that tier needs).');
  L.push('');
  if (diffs.includes('normal')) {
    L.push('### Start cash, placement prices and income per stage (Normal)');
    L.push('');
    L.push('| Stage | Start cash | Roster placement prices | Coins by wave 5 / 10 / last (full kill) | Bot earned (realised) | Bot unspent at end | Bot waiting on |');
    L.push('|---|---:|---|---|---:|---:|---|');
    for (const s of stages) {
      const e = econ[`${s}|normal`];
      const b = get(s, 'normal', 'bot');
      if (!e) continue;
      const at = (w) => (e.waves[w - 2] ? e.waves[w - 2].cumulative : e.startCash);
      const pl = placement[`${s}|normal`];
      L.push(`| ${s} | ${fmtN(e.startCash)} | ${pl.map((u) => `${u.unitId} ${u.cost}`).join(', ')} | ${fmtN(at(5))} / ${fmtN(at(10))} / ${fmtN(e.totalCoins)} | ${b ? fmtN(b.baseline.startCash + b.baseline.earned) : '—'} | ${b ? `${fmtN(b.baseline.cashEnd)} (${Math.round(b.baseline.unspentPct * 100)}%)` : '—'} | ${b?.baseline.waitingOn || '—'} |`);
    }
    L.push('');
    for (const unitId of list(opts.focus)) {
      const rows = afford.filter((a) => a.unitId === unitId && a.difficulty === 'normal');
      if (!rows.length) continue;
      const def = D.units[unitId];
      L.push(`### ${def.name}: when could a focused player afford each tier? (Normal)`);
      L.push('');
      L.push(`Costs on Normal (placement ${rows[0].paths[0].tiers[0].cost}): ${rows[0].paths.map((p) => `**${p.name}** ${p.tiers.slice(1).map((t) => t.cost).join(' / ')}`).join(' · ')}.`);
      L.push('');
      L.push(`| Stage | Waves | Owned? | ${rows[0].paths.map((p) => `${p.name} T3 / T4 / T5`).join(' | ')} |`);
      L.push(`|---|---:|---|${rows[0].paths.map(() => '---').join('|')}|`);
      for (const a of rows) {
        const cell = (p) => [3, 4, 5].map((k) => {
          const t = p.tiers[k];
          return t.wave != null ? `w${t.wave}` : `— (${Math.round(t.pctOfStage * 100)}%)`;
        }).join(' / ');
        L.push(`| ${a.stageId} | ${a.waves} | ${a.owned ? 'yes' : 'no'} | ${a.paths.map(cell).join(' | ')} |`);
      }
      L.push('');
    }
  }

  // ---- 5 bosses
  L.push('## 5. Bosses and minibosses ("bosses live .8 secs longer than everything")');
  L.push('');
  L.push('Time alive = seconds from spawn to death/leak under the planner\'s defense (1× game speed). Path = share of the trail walked when it died. Normals = ordinary enemies of the same run (median / p90 seconds alive). Minibosses cost 25 lives when they leak; bosses take every life.');
  L.push('');
  L.push('| Stage | Diff | Planner | Enemy | HP | Alive (s) | Path | Fate | Phases reached (s after spawn) | Normals alive (s) | Elites alive (median s) | Damage share (top 3) |');
  L.push('|---|---|---|---|---:|---:|---:|---|---|---|---:|---|');
  for (const r of results.filter((x) => x.baseline.bosses?.length)) {
    const share = Object.entries(r.baseline.damageShare || {}).slice(0, 3).map(([u, v]) => `${u} ${Math.round(v * 100)}%`).join(', ') || '—';
    for (const b of r.baseline.bosses) {
      L.push(`| ${r.stageId} | ${r.difficulty} | ${r.planner} | ${b.id} | ${fmtN(b.maxHp)} | ${b.alive} | ${b.pathPct == null ? '—' : `${Math.round(b.pathPct * 100)}%`} | ${b.fate}${b.fate === 'leaked' ? ` (−${b.leakCost ?? 'all'})` : ''} | ${b.phases.map((ph) => ph.at).join(', ') || 'none'} | ${r.baseline.normals ? `${r.baseline.normals.aliveMed} / ${r.baseline.normals.aliveP90}` : '—'} | ${r.baseline.elites ? r.baseline.elites.aliveMed : '—'} | ${share} |`);
    }
  }
  L.push('');
  L.push('Elite "finale" enemies (stages without a scripted miniboss), Normal:');
  L.push('');
  L.push('| Stage | Planner | Elites (n, leaked) | Elite alive median / max (s) | Elite path median / p90 |');
  L.push('|---|---|---|---|---|');
  for (const r of results.filter((x) => x.difficulty === 'normal' && x.baseline.elites && !x.baseline.bosses?.length)) {
    const e = r.baseline.elites;
    L.push(`| ${r.stageId} | ${r.planner} | ${e.n}, ${e.leaked} | ${e.aliveMed} / ${e.aliveMax} | ${Math.round(e.pathMed * 100)}% / ${Math.round(e.pathP90 * 100)}% |`);
  }
  L.push('');

  // ---- 6 early enemies
  L.push('## 6. Ordinary enemies ("poor slimes lol")');
  L.push('');
  L.push('| Stage | Diff | Planner | Normals: n, alive median / p90 (s), path median | Waves 1-3: alive median / p90 (s), path median | Per enemy (alive median s, HP) |');
  L.push('|---|---|---|---|---|---|');
  for (const r of results.filter((x) => (x.difficulty === 'normal' || x.difficulty === 'easy') && D.stages[x.stageId].kind === 'campaign' && Number(x.stageId[0]) <= 2)) {
    const n = r.baseline.normals;
    const e = r.baseline.normalsEarly;
    const per = Object.entries(r.baseline.byEnemy || {}).filter(([, v]) => v.tier === 'normal').map(([id, v]) => `${id} ${v.aliveMed}s/${v.hp}hp`).join(', ');
    L.push(`| ${r.stageId} | ${r.difficulty} | ${r.planner} | ${n ? `${n.n}, ${n.aliveMed} / ${n.aliveP90}, ${Math.round(n.pathMed * 100)}%` : '—'} | ${e ? `${e.aliveMed} / ${e.aliveP90}, ${Math.round(e.pathMed * 100)}%` : '—'} | ${per} |`);
  }
  L.push('');

  // ---- 7 bot vs human
  if (planners.includes('bot') && planners.includes('human')) {
    L.push('## 7. Bot vs human-like planner');
    L.push('');
    L.push('| Stage | Diff | Bot: max tier, first T3/T4 wave, unspent, headroom | Human: max tier, first T3/T4 wave, unspent, headroom |');
    L.push('|---|---|---|---|');
    const cell = (r) => (r ? `T${r.baseline.maxTier}, ${r.baseline.firstTierWave[3] ?? '—'}/${r.baseline.firstTierWave[4] ?? '—'}, ${Math.round(r.baseline.unspentPct * 100)}%, ${fmtHr(r.headroom)}` : '—');
    for (const s of stages) for (const d of diffs.filter((x) => x === 'normal' || x === 'hard')) L.push(`| ${s} | ${d} | ${cell(get(s, d, 'bot'))} | ${cell(get(s, d, 'human'))} |`);
    L.push('');
  }

  // ---- 8 meta
  if (meta) {
    L.push('## 8. Out-of-battle economy (Level Up tab, breakthrough, awakening)');
    L.push('');
    L.push(ctx.metaMd);
    L.push('');
  }
  L.push('## Caveats');
  L.push('');
  L.push('* Headroom scales enemy HP only (economy and speed unchanged). The search assumes wins are monotonic in HP; it is coarse by design (log bisection, ~3% resolution).');
  L.push('* "Afford" tables use the full-kill economy (an upper bound: leaks pay nothing, summons/decoys and Momo income are ignored) and assume EVERY coin goes into one girl — a real defense needs other girls too.');
  L.push('* Both planners never sell, never retarget and place on autoPlan\'s spots. The human-like planner is a re-ordering of the bot plan, not an optimal player.');
  L.push('* Total Assault and Bounty stages use the roster/level of a player who just cleared their `requires` stage (`f2pSetup` in f2p.mjs).');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(HELP);
    return;
  }
  if (opts.worker) {
    await workerMain();
    return;
  }
  const P = await import('./probe.mjs');
  const { DIFFICULTIES } = P;
  let merged = null;
  if (opts.from) {
    // Merge earlier runs: union of stages/difficulties/planners, later files win per job.
    const { readFileSync } = await import('node:fs');
    const byKey = new Map();
    const st = [];
    const df = new Set();
    const pl = new Set();
    let seedsFrom = null;
    let secs = 0;
    for (const f of list(opts.from)) {
      const j = JSON.parse(readFileSync(f, 'utf8'));
      secs += j.seconds || 0;
      for (const id of j.stages) if (!st.includes(id)) st.push(id);
      for (const r of j.results) {
        const key = `${r.stageId}|${r.difficulty}|${r.planner}`;
        // a later run without the HP search (--no-headroom) keeps the earlier run's headroom
        if (!r.headroom && byKey.get(key)?.headroom) r.headroom = byKey.get(key).headroom;
        byKey.set(key, r);
        df.add(r.difficulty);
        pl.add(r.planner);
      }
      seedsFrom ||= j.options?.seeds;
      opts.carry ||= j.options?.carry || null;
    }
    const campaignIdx = (id) => Object.keys(P.DATA.stages).indexOf(id);
    merged = { results: [...byKey.values()], stages: st.sort((a, b) => campaignIdx(a) - campaignIdx(b)), seconds: secs };
    opts.stages = merged.stages.join(',');
    opts.diffs = DIFFS.filter((d) => df.has(d)).join(',');
    opts.planners = ['bot', 'human'].filter((p) => pl.has(p)).join(',');
    if (seedsFrom) opts.seeds = seedsFrom;
  }
  const stages = merged ? merged.stages : selectStages(opts.stages, P.DATA.stages);
  const diffs = list(opts.diffs);
  for (const d of diffs) if (!DIFFS.includes(d)) throw new Error(`unknown difficulty ${d}`);
  const planners = list(opts.planners);
  for (const p of planners) if (p !== 'bot' && p !== 'human') throw new Error(`unknown planner ${p}`);
  const seeds = list(opts.seeds).map(Number);
  const log = opts.quiet ? null : (s) => process.stderr.write(`${s}\n`);
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  let git = 'unknown';
  try {
    git = execSync('git rev-parse --short HEAD && git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').reverse().join('@');
    if (execSync('git status --porcelain -- src', { cwd: ROOT, encoding: 'utf8' }).trim()) git += ' (+ uncommitted src changes)';
  } catch { /* not a git checkout */ }

  // Heaviest stages first so the pool drains evenly.
  const order = (id) => {
    const s = P.DATA.stages[id];
    return s.kind === 'campaign' ? s.chapter * 10 + Number(id.split('-')[1]) : 100;
  };
  const jobs = [];
  if (!merged) for (const s of [...stages].sort((a, b) => order(b) - order(a))) {
    for (const d of diffs) {
      for (const p of planners) {
        jobs.push({ stageId: s, difficulty: d, planner: p, seeds, carry: opts.carry, headroom: opts.headroom, hrLo: opts.hrLo, hrHi: opts.hrHi, hrSteps: opts.hrSteps });
      }
    }
  }
  let unsorted;
  if (merged) {
    unsorted = merged.results;
    log?.(`balance probe: merged ${unsorted.length} results from ${opts.from}`);
  } else {
    log?.(`balance probe: ${stages.length} stages × ${diffs.length} difficulties × ${planners.length} planners = ${jobs.length} jobs on ${Math.min(opts.jobs, jobs.length)} worker(s)`);
    unsorted = await runPool(jobs, opts.jobs, log);
  }
  const rank = (r) => stages.indexOf(r.stageId) * 100 + DIFFS.indexOf(r.difficulty) * 10 + planners.indexOf(r.planner);
  const results = unsorted.sort((a, b) => rank(a) - rank(b));

  // Derived: full-kill economy, placement prices, focus-unit affordability.
  const econ = {};
  const placement = {};
  const afford = [];
  for (const s of stages) {
    const setup = P.f2pSetup(P.DATA, s);
    const roster = [...setup.towers, ...(setup.hero ? [setup.hero] : [])];
    for (const d of diffs) {
      const e = P.stageEconomy(s, d);
      econ[`${s}|${d}`] = e;
      placement[`${s}|${d}`] = roster.map((u) => ({ unitId: u, cost: P.tierCosts(u, 0, d)[0].cost })).sort((a, b) => a.cost - b.cost);
      for (const u of list(opts.focus)) {
        if (!P.DATA.units[u]) continue;
        const paths = P.affordTimeline(u, e.waves, d, e.startCash);
        const best = {};
        for (const k of [1, 2, 3, 4, 5]) {
          const ws = paths.map((p) => p.tiers[k]).filter(Boolean);
          const reach = ws.filter((t) => t.wave != null).sort((a, b) => a.wave - b.wave)[0];
          best[k] = reach ? { wave: reach.wave, cum: reach.cum } : { wave: null, cum: Math.min(...ws.map((t) => t.cum)) };
        }
        afford.push({ stageId: s, difficulty: d, unitId: u, owned: roster.includes(u), waves: e.waves.length, paths, best });
      }
    }
  }

  let meta = null;
  let metaMd = '';
  if (opts.meta) {
    const M = await import('./meta.mjs');
    const durations = {};
    for (const r of results) if (r.planner === planners[0] && r.difficulty === 'normal' && r.baseline.won) durations[r.stageId] = r.baseline.time;
    meta = await M.metaAudit({ durations, mailModule: opts.mail });
    metaMd = M.metaMarkdown(meta);
  }

  const seconds = (Date.now() - t0) / 1000 + (merged ? merged.seconds : 0);
  const jsonFile = opts.json || `${opts.out}.json`;
  const mdFile = opts.md || `${opts.out}.md`;
  mkdirSync(path.dirname(path.resolve(jsonFile)), { recursive: true });
  mkdirSync(path.dirname(path.resolve(mdFile)), { recursive: true });
  const payload = {
    generatedAt: startedAt, git, seconds, options: { ...opts, worker: undefined }, stages,
    difficulties: Object.fromEntries(diffs.map((d) => [d, DIFFICULTIES[d]])),
    results, economy: econ, placement, afford, meta,
  };
  writeFileSync(jsonFile, JSON.stringify(payload, null, 1));
  writeFileSync(mdFile, `${buildMarkdown({ opts, stages, results, econ, afford, placement, meta, metaMd, P, startedAt, seconds, git })}\n`);
  log?.(`wrote ${jsonFile} and ${mdFile} (${seconds.toFixed(0)} s)`);
}

main().catch((err) => {
  process.stderr.write(`${err?.stack || err}\n`);
  process.exit(1);
});
