// Cross-engine determinism check for co-op lockstep. Two players' clients only stay in sync if
// every JS engine computes the battle to the same bit, so this runs ONE scripted co-op battle
// (e2e/engines/scriptedBattle.js: two Lockstep clients, both players' commands, to the end) in
// every engine it can find and compares the results:
//   V8              Node (this process) and Chromium (Android, desktop Chrome / Edge)
//   JavaScriptCore  Bun and WebKit (iPhone / iPad Safari)
//   SpiderMonkey    Firefox
// It also compares the deterministic math ports (src/online/coop/detMath.js) bit for bit, and
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
writeFileSync(join(out, 'run.mjs'), "import { runScriptedBattle } from './battle.js';\nconsole.log(JSON.stringify(runScriptedBattle()));\n");

const results = [];
const skipped = [];

// 2. Node (V8)
{
  const { runScriptedBattle } = await import(pathToFileURL(bundle).href);
  results.push({ name: `Node ${process.version} (V8)`, r: runScriptedBattle() });
}

// 3. Bun (JavaScriptCore)
{
  const candidates = [process.env.BUN, 'bun', join(homedir(), '.bun/bin/bun')].filter(Boolean);
  let ran = false;
  for (const bin of candidates) {
    if (bin.includes('/') && !existsSync(bin)) continue;
    const p = spawnSync(bin, [join(out, 'run.mjs')], { encoding: 'utf8', timeout: 300000 });
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
  const code = `${readFileSync(bundle, 'utf8')}\nwindow.__result = runScriptedBattle();\n`;
  for (const [type, engine, args] of [['chromium', 'V8', GL_ARGS], ['firefox', 'SpiderMonkey', []], ['webkit', 'JavaScriptCore', []]]) {
    if (!pw?.[type]) continue;
    let browser = null;
    try {
      browser = await pw[type].launch({ args });
      const page = await browser.newPage();
      await page.setContent('<!doctype html><title>engines</title>');
      await page.addScriptTag({ type: 'module', content: code });
      await page.waitForFunction(() => window.__result, null, { timeout: 300000, polling: 500 });
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
const KEYS = ['ticks', 'state', 'wave', 'towers', 'wallets', 'ults', 'final', 'hashes', 'checkpoints', 'lobby'];
log('\nScripted co-op battle (stage 1-3, both players, to the end):');
for (const { name, r } of results) {
  log(`  ${name.padEnd(46)} ticks ${r.ticks} · ${r.state} · wave ${r.wave} · towers ${r.towers} · ults ${r.ults} · coins ${r.wallets} · final ${r.final} · ${r.checkpoints} hash checkpoints → ${r.hashes} · lobby data ${r.lobby} · ${r.ms} ms`);
  if (!r.agree) failures.push(`${name}: its own two clients disagreed`);
  if (r.failed) failures.push(`${name}: ${r.failed} scripted command(s) refused: ${r.refused}`);
  for (const k of KEYS) if (r[k] !== ref[k]) failures.push(`${name}: ${k} ${r[k]} ≠ ${ref[k]} (${results[0].name})`);
  for (const [fn, h] of Object.entries(r.math.det)) if (h !== ref.math.det[fn]) failures.push(`${name}: deterministic ${fn} differs`);
}
if (ref.state !== 'won' && ref.state !== 'lost') failures.push(`the scripted battle did not finish (state ${ref.state})`);
if (ref.checkpoints < 20) failures.push(`only ${ref.checkpoints} hash checkpoints`);
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
log(`\nOK: ${results.length} runs on ${engines.size} engines (${[...engines].join(', ')}) computed the identical battle.`);
