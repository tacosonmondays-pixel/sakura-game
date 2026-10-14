// A rejoin deep into a co-op freeplay run, measured in every JS engine available (spec §12: "a
// rejoin at wave 150 takes under ~5 s; a resync keeps both pages responsive"). Runs
// e2e/engines/longRun.js — two lockstep clients play a strong scripted team to wave --wave
// (default 150), the link is cut for longer than the drop timeout, the guest rejoins through the
// host's wave-end checkpoint — in Node (V8), Bun (JavaScriptCore) and Chromium, and prints:
//   the checkpoint (size, cost), the rejoin message, the replay from the checkpoint (ticks, CPU,
//   slices, the longest slice, the wait at 60 frames a second), and the old way (the whole run
//   replayed from tick 0 in one go: how long the page used to freeze), then whether both clients
//   agree for 10 more waves.
//
//   node e2e/coop-longrun.mjs [--wave 150] [--tier blossom] [--stage 1-3] [--engines node,bun,chromium]
// Exit code 1 when a run fails (stopped early, no checkpoint restore, disagreement, slow rejoin).
import { build } from 'vite';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadPlaywright, GL_ARGS } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const params = { wave: Number(opt('wave', 150)), tier: opt('tier', 'blossom'), stageId: opt('stage', '1-3') };
const engines = opt('engines', 'node,bun,chromium').split(',');
const log = (...a) => console.log(...a);
const out = mkdtempSync(join(tmpdir(), 'ss-longrun-'));

await build({
  configFile: false,
  root: process.cwd(),
  logLevel: 'error',
  build: { outDir: out, emptyOutDir: true, minify: false, target: 'es2022', lib: { entry: resolve('e2e/engines/longRun.js'), formats: ['es'], fileName: () => 'longrun.js' } },
});
const bundle = join(out, 'longrun.js');
writeFileSync(join(out, 'run.mjs'), `import { runLongRun } from './longrun.js';\nconsole.log(JSON.stringify(runLongRun(${JSON.stringify(params)})));\n`);

const results = [];
if (engines.includes('node')) {
  const { runLongRun } = await import(pathToFileURL(bundle).href);
  results.push({ name: `Node ${process.version} (V8)`, r: runLongRun(params) });
  log(`${results.at(-1).name}: ${JSON.stringify(results.at(-1).r)}`);
}
if (engines.includes('bun')) {
  for (const bin of [process.env.BUN, 'bun', join(homedir(), '.bun/bin/bun')].filter(Boolean)) {
    if (bin.includes('/') && !existsSync(bin)) continue;
    const p = spawnSync(bin, [join(out, 'run.mjs')], { encoding: 'utf8', timeout: 3600000, maxBuffer: 1 << 26 });
    if (p.error || p.status !== 0) continue;
    const ver = spawnSync(bin, ['--version'], { encoding: 'utf8' }).stdout.trim();
    results.push({ name: `Bun ${ver} (JavaScriptCore)`, r: JSON.parse(p.stdout.trim().split('\n').pop()) });
    log(`${results.at(-1).name}: ${JSON.stringify(results.at(-1).r)}`);
    break;
  }
}
if (engines.includes('chromium')) {
  const pw = await loadPlaywright();
  const browser = await pw.chromium.launch({ args: GL_ARGS });
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><title>longrun</title>');
    await page.addScriptTag({ type: 'module', content: `${readFileSync(bundle, 'utf8')}\nwindow.__result = runLongRun(${JSON.stringify(params)});\n` });
    await page.waitForFunction(() => window.__result, null, { timeout: 3600000, polling: 1000 });
    results.push({ name: `chromium ${browser.version()} (V8)`, r: await page.evaluate(() => window.__result) });
    log(`${results.at(-1).name}: ${JSON.stringify(results.at(-1).r)}`);
  } finally {
    await browser.close().catch(() => {});
  }
}
rmSync(out, { recursive: true, force: true });

const failures = [];
log(`\nRejoin deep into co-op freeplay (${params.tier} on ${params.stageId}, wave ${params.wave}):`);
for (const { name, r } of results) {
  if (!r.ok) {
    failures.push(`${name}: ${r.why}`);
    continue;
  }
  const b = r.rebuild;
  log(`  ${name}`);
  log(`    played to wave ${r.reached} (${r.ticks} ticks, ${r.towers} girls, ${r.logCmds} orders) in ${Math.round(r.playMs / 1000)} s`);
  log(`    checkpoint ${r.ckKb} KB (taken in ${r.ckMs} ms) · rejoin offer ${r.offerKb} KB`);
  log(`    rejoin: restored the tick-${b.from} checkpoint in ${b.restoreMs} ms, replayed ${b.ticks} ticks in ${b.cpuMs} ms CPU over ${b.slices} slices (longest ${b.maxSliceMs} ms) → ${r.at60fpsMs} ms at 60 fps`);
  log(`    the old way: ${r.wholeTicks} ticks from tick 0 in one go = ${r.wholeMs} ms frozen (${r.wholeSame ? 'same battle' : 'DIFFERENT'})`);
  log(`    after: ${r.after} more waves together, ${r.pairs} hash pairs ${r.agree ? 'all equal' : 'DISAGREE'} · final ${r.finalDigest}`);
  if (!b.restored) failures.push(`${name}: the rejoin did not restore the checkpoint`);
  if (!r.agree || r.after < 10) failures.push(`${name}: after the rejoin the clients did not agree for 10 waves`);
  if (!r.wholeSame) failures.push(`${name}: the replay from tick 0 gave another battle`);
  if (r.at60fpsMs > 5000) failures.push(`${name}: the rejoin took ${r.at60fpsMs} ms at 60 fps (want < 5000)`);
}
const digests = new Set(results.filter((x) => x.r.ok).map((x) => x.r.finalDigest));
if (digests.size > 1) failures.push(`the engines ended in different states: ${[...digests].join(' ≠ ')}`);
if (failures.length) {
  log(`\nFAIL (${failures.length}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
log(`\nOK: ${results.length} engine(s); identical final state ${[...digests][0]}.`);
