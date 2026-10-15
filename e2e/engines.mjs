// Cross-engine determinism check for co-op lockstep. Two players' clients only stay in sync if
// every JS engine computes the battle to the same bit, so this runs ONE scripted co-op battle
// (e2e/engines/scriptedBattle.js: two Lockstep clients, both players' commands, to the end) and
// ONE scripted co-op POTENTIAL battle (POTENTIAL_START: every kind of Potential step, the same girl
// at P1 and P6) and ONE scripted co-op FREEPLAY battle (Crimson Moon on 1-3, through the goal into the boss waves,
// ended by both players' Finish vote) and ONE deep freeplay battle (8-5 jumped to the Eclipse Wyrm
// at 250, every enemy's bits) in every engine it can find and compares the results:
//   V8              Node (this process) and Chromium (Android, desktop Chrome / Edge)
//   JavaScriptCore  Bun and WebKit (iPhone / iPad Safari)
//   SpiderMonkey    Firefox
// It also compares every stage's wave table (whole powers growth^wave: src/sim/waves.js powInt), the
// freeplay wave tables of every stage and tier (src/sim/freeplay.js) and
// the deterministic math ports (src/online/coop/detMath.js) bit for bit, and
// reports — for information — where the engines' own Math.sin / atan2 / hypot differ.
//
//   node e2e/engines.mjs                  # every engine available; at least two must run
//   node e2e/engines.mjs --require-all    # fail when Bun, Firefox or WebKit is missing
// Firefox / WebKit: `npx playwright install firefox webkit` (+ `--with-deps` on Linux). Bun: on
// PATH, or BUN=<path>. Exit code 1 on any mismatch.
import { build } from 'vite';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadPlaywright, GL_ARGS } from './browser.mjs';

const requireAll = process.argv.includes('--require-all');
const log = (...a) => console.log(...a);
const out = mkdtempSync(join(tmpdir(), 'ss-engines-'));

// 1. one bundle for every engine (src/sim resolves its data with Vite's import.meta.glob)
await build({
  configFile: false,
  root: process.cwd(),
  logLevel: 'error',
  build: {
    outDir: out,
    emptyOutDir: true,
    minify: false,
    target: 'es2022',
    lib: { entry: resolve('e2e/engines/scriptedBattle.js'), formats: ['es'], fileName: () => 'battle.js' },
  },
});
const bundle = join(out, 'battle.js');
writeFileSync(join(out, 'run.mjs'), "import { runEngineChecks } from './battle.js';\nconsole.log(JSON.stringify(runEngineChecks()));\n");

const results = [];
const skipped = [];

// 2. Node (V8)
{
  const { runEngineChecks } = await import(pathToFileURL(bundle).href);
  results.push({ name: `Node ${process.version} (V8)`, r: runEngineChecks() });
}

// 3. Bun (JavaScriptCore)
{
  const candidates = [process.env.BUN, 'bun', join(homedir(), '.bun/bin/bun')].filter(Boolean);
  let ran = false;
  for (const bin of candidates) {
    if (bin.includes('/') && !existsSync(bin)) continue;
    const p = spawnSync(bin, [join(out, 'run.mjs')], { encoding: 'utf8', timeout: 600000 });
    if (p.error || p.status !== 0) continue;
    const ver = spawnSync(bin, ['--version'], { encoding: 'utf8' }).stdout.trim();
    results.push({ name: `Bun ${ver} (JavaScriptCore)`, r: JSON.parse(p.stdout.trim().split('\n').pop()) });
    ran = true;
    break;
  }
  if (!ran) skipped.push('Bun (not found)');
}

// 4. browsers: the same bundle as an inline module script on a blank page
{
  let pw = null;
  try {
    pw = await loadPlaywright();
  } catch (e) {
    skipped.push(`browsers (${String(e.message).split('\n')[0]})`);
  }
  const code = `${readFileSync(bundle, 'utf8')}\nwindow.__result = runEngineChecks();\n`;
  for (const [type, engine, args] of [['chromium', 'V8', GL_ARGS], ['firefox', 'SpiderMonkey', []], ['webkit', 'JavaScriptCore', []]]) {
    if (!pw?.[type]) continue;
    let browser = null;
    try {
      browser = await pw[type].launch({ args });
      const page = await browser.newPage();
      await page.setContent('<!doctype html><title>engines</title>');
      await page.addScriptTag({ type: 'module', content: code });
      await page.waitForFunction(() => window.__result, null, { timeout: 600000, polling: 500 });
      const r = await page.evaluate(() => window.__result);
      results.push({ name: `${type} ${browser.version()} (${engine})`, r });
    } catch (e) {
      skipped.push(`${type} (${String(e.message).split('\n')[0].slice(0, 120)})`);
    } finally {
      await browser?.close().catch(() => {});
    }
  }
}
rmSync(out, { recursive: true, force: true });

// 5. compare
const failures = [];
const ref = results[0].r;
const KEYS = ['ticks', 'state', 'wave', 'towers', 'wallets', 'ults', 'final', 'hashes', 'checkpoints', 'lobby', 'waves'];
log('\nScripted co-op battle (stage 1-3, both players, to the end):');
for (const { name, r } of results) {
  log(`  ${name.padEnd(46)} ticks ${r.ticks} · ${r.state} · wave ${r.wave} · towers ${r.towers} · ults ${r.ults} · coins ${r.wallets} · final ${r.final} · ${r.checkpoints} hash checkpoints → ${r.hashes} · lobby data ${r.lobby} · wave tables ${r.waves} · ${r.ms} ms`);
  if (!r.agree) failures.push(`${name}: its own two clients disagreed`);
  if (r.failed) failures.push(`${name}: ${r.failed} scripted command(s) refused: ${r.refused}`);
  for (const k of KEYS) if (r[k] !== ref[k]) failures.push(`${name}: ${k} ${r[k]} ≠ ${ref[k]} (${results[0].name})`);
  for (const [fn, h] of Object.entries(r.math.det)) if (h !== ref.math.det[fn]) failures.push(`${name}: deterministic ${fn} differs`);
}
if (ref.state !== 'won' && ref.state !== 'lost') failures.push(`the scripted battle did not finish (state ${ref.state})`);
if (ref.checkpoints < 20) failures.push(`only ${ref.checkpoints} hash checkpoints`);

// Potential: every kind of step, and the same girl at P1 (host) and P6 (guest), in one battle
const POT_KEYS = ['ticks', 'state', 'wave', 'towers', 'wallets', 'ults', 'aoi', 'final', 'hashes', 'checkpoints'];
log('\nScripted co-op POTENTIAL battle (stage 1-3 Hard, POTENTIAL_START: drones, traps, aura, coins, silence, crit, elites, host Aoi P1 + guest Aoi P6):');
for (const { name, r } of results) {
  const p = r.potential;
  log(`  ${name.padEnd(46)} ticks ${p.ticks} · ${p.state} · wave ${p.wave} · ults ${p.ults} · coins ${p.wallets} · final ${p.final} · ${p.checkpoints} hash checkpoints → ${p.hashes} · ${p.ms} ms`);
  if (!p.agree) failures.push(`${name}: its own two Potential clients disagreed`);
  if (p.failed) failures.push(`${name}: ${p.failed} Potential command(s) refused: ${p.refused}`);
  for (const k of POT_KEYS) if (p[k] !== ref.potential[k]) failures.push(`${name}: potential ${k} ${p[k]} ≠ ${ref.potential[k]} (${results[0].name})`);
}
{
  const p = ref.potential;
  log(`  towers: ${p.towers}\n  Aoi damage/rate/range/crit (guest P6 | host P1): ${p.aoi}`);
  if (p.state !== 'won' && p.state !== 'lost') failures.push(`the Potential battle did not finish (state ${p.state})`);
  if (!p.aoi || p.aoi.split(' | ')[0] === p.aoi.split(' | ')[1]) failures.push('the Potential battle: the two Aois resolved to the same stats');
  if ((p.towers.match(/:P/g) || []).length < 10) failures.push(`the Potential battle placed only: ${p.towers}`);
}

// co-op freeplay: the same wave tables and the same whole freeplay battle everywhere
const FP_KEYS = ['ticks', 'state', 'wave', 'cleared', 'finished', 'goalTick', 'endTicks', 'towers', 'wallets', 'lives', 'bosses', 'final', 'hashes', 'checkpoints', 'ckWave', 'ckTick', 'ckDigest', 'ckReplay', 'finalDigest'];
log('\nScripted co-op FREEPLAY battle (Crimson Moon on 1-3, past the goal, ended by a Finish vote):');
for (const { name, r } of results) {
  const f = r.freeplay;
  const b = f.battle;
  log(`  ${name.padEnd(46)} ticks ${b.ticks} · ${b.state}${b.finished ? ' (Finish vote)' : ''} · wave ${b.wave}/${b.goal} · bosses ${b.bosses} · lives ${b.lives} · coins ${b.wallets} · final ${b.final} · ${b.checkpoints} hash checkpoints → ${b.hashes} · freeplay tables ${f.tables} · ${f.ms} ms`);
  log(`  ${''.padEnd(46)} wave-${b.ckWave} checkpoint (tick ${b.ckTick}, ${b.ckKb} KB) ${b.ckDigest} → restored + replayed ${b.ckReplay} ticks in ${b.ckReplayMs} ms → final state ${b.finalDigest} ${b.ckSame ? '= the run' : '≠ THE RUN'}`);
  if (!b.agree) failures.push(`${name}: its own two freeplay clients disagreed`);
  if (!b.ckSame) failures.push(`${name}: restoring the wave-${b.ckWave} checkpoint and replaying did not give the run's final state`);
  if (f.tables !== ref.freeplay.tables) failures.push(`${name}: freeplay tables ${f.tables} ≠ ${ref.freeplay.tables} (${results[0].name})`);
  for (const k of FP_KEYS) if (b[k] !== ref.freeplay.battle[k]) failures.push(`${name}: freeplay ${k} ${b[k]} ≠ ${ref.freeplay.battle[k]} (${results[0].name})`);
}
{
  const b = ref.freeplay.battle;
  if (!b.finished || b.state !== 'won' || b.stateB !== 'won') failures.push(`the freeplay battle did not end on the Finish vote (state ${b.state}/${b.stateB})`);
  if (!(b.cleared > b.goal + 30)) failures.push(`the freeplay battle cleared only ${b.cleared} waves (goal ${b.goal})`);
  if (b.bosses < 3) failures.push(`the freeplay battle met only ${b.bosses} boss waves`);
  if (b.checkpoints < 200) failures.push(`only ${b.checkpoints} freeplay hash checkpoints`);
  if (!(b.cleared >= b.ckWave + 10)) failures.push(`the checkpoint replay covers only ${b.cleared - b.ckWave} waves (want ≥ 10)`);
  const [ta, tb] = b.endTicks.split('/');
  if (ta !== tb) failures.push(`the Finish vote ended the run on different ticks (${b.endTicks})`);
}
// deep freeplay: a battle jumped to wave 250 on 8-5 (the Eclipse Wyrm wave), raw bits of every enemy
const DEEP_KEYS = ['towers', 'wave', 'cleared', 'lives', 'maxAlive', 'maxHp', 'bad', 'bosses', 'digest', 'final'];
log('\nDeep freeplay (8-5 Blossom jumped to wave 250: the Eclipse Wyrm + Gloom Regent, every enemy\'s bits every 60 ticks):');
for (const { name, r } of results) {
  const d = r.freeplay.deep;
  log(`  ${name.padEnd(46)} wave ${d.wave} · ${d.towers} towers · up to ${d.maxAlive} alive · max HP ${d.maxHp.toExponential(3)} · bosses ${d.bosses} · non-finite ${d.bad} · digest ${d.digest} · final ${d.final} · ${d.ms} ms`);
  for (const k of DEEP_KEYS) if (d[k] !== ref.freeplay.deep[k]) failures.push(`${name}: deep freeplay ${k} ${d[k]} ≠ ${ref.freeplay.deep[k]} (${results[0].name})`);
}
{
  const d = ref.freeplay.deep;
  if (d.bad) failures.push(`deep freeplay: ${d.bad} non-finite enemy values`);
  if (!(d.maxHp < 2 ** 53)) failures.push(`deep freeplay: an enemy HP of ${d.maxHp} is past 2^53`);
  if (!d.bosses.includes('fp_eclipse_wyrm')) failures.push(`deep freeplay: the Eclipse Wyrm never came (bosses ${d.bosses})`);
}
log('\nEngine-native Math (information only; co-op runs on the deterministic ports):');
for (const fn of Object.keys(ref.math.native)) {
  const groups = new Map();
  for (const { name, r } of results) groups.set(r.math.native[fn], [...(groups.get(r.math.native[fn]) || []), name.split(' (')[0]]);
  log(`  Math.${fn.padEnd(6)} ${groups.size === 1 ? 'same everywhere' : [...groups.values()].map((g) => g.join(' + ')).join('  vs  ')}`);
}
if (skipped.length) log(`\nSkipped: ${skipped.join('; ')}`);
const engines = new Set(results.map(({ name }) => name.match(/\((.+)\)$/)[1]));
if (engines.size < 2) failures.push(`only ${[...engines].join(', ')} ran: install Bun, Firefox or WebKit for a cross-engine check`);
if (requireAll && skipped.length) failures.push(`--require-all: ${skipped.length} engine(s) missing`);
if (failures.length) {
  log(`\nFAIL (${failures.length}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
log(`\nOK: ${results.length} runs on ${engines.size} engines (${[...engines].join(', ')}) computed the identical battle, the identical Potential battle and the identical freeplay run, wrote the identical wave-${ref.freeplay.battle.ckWave} checkpoint, and each restored it and replayed to the run's final state.`);
