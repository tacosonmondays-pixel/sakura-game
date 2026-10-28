// The menus gate of docs/specs/UI_V2_MENUS.md (M0): every audited menu shot, judged against the plan's standard gates.
// It runs e2e/ui-shots.mjs on the `ink` save (the mock-ups' mid-game save, its clock and seeded Math.random) for one
// milestone's shot list (e2e/shots/m*.mjs), reads the probe of every shot and judges it:
//   text ≥ 12 px (≥ 13 px from 481 px tall) · no sideways overflow · no ellipsis on a stat, price or rule ·
//   taps ≥ 44 px (40 px in the rows a shot names as dense) · at most one yellow fill · no stray pink ·
//   nothing painted over a control · bar and head faults 0 · children cut by their panel 0 ·
//   numbers ≤ 10 with the top bar counted (or the shot's own limit) · host ≤ 35% on hubs, ≤ 28% on detail screens ·
//   content window ≥ 300 px · no rounded corner off a circle (only on shots marked `rebuilt`)
// and prints each shot's numbers beside the "before" file (e2e/shots/before/<milestone>.json, recorded at M0 from
// the audited build), so a milestone shows what it moved.
//
//   node e2e/menus.mjs --milestone m1                       # judge M1's shots at 844x390, 1280x720 and 390x844
//   node e2e/menus.mjs --milestone m1,m2 --viewport 844x390  # several lists, one size
//   node e2e/menus.mjs --milestone all --report             # every list; print, never fail (an audit)
//   node e2e/menus.mjs --milestone m1 --record              # write the before file from this build (M0 only)
//   node e2e/menus.mjs --milestone m1 --out <dir>           # keep the PNGs and probe JSON there (default: the OS temp dir)
//   node e2e/menus.mjs --milestone m3 --screens girl-level   # just these shots of the list
// Exit 1 when a judged check fails (or a shot fails to open), unless --report or --record.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { judge, LIMITS } from './probe.mjs';
import { MILESTONES, GATE } from './shots/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);
const want = (opt('milestone', 'all') || 'all').split(',').map((s) => s.trim()).filter(Boolean);
const ids = want.includes('all') ? Object.keys(MILESTONES) : want;
const unknown = ids.filter((m) => !MILESTONES[m]);
if (unknown.length) {
  console.error(`unknown milestone(s): ${unknown.join(', ')}; known: ${Object.keys(MILESTONES).join(', ')}`);
  process.exit(2);
}
const viewports = (opt('viewport', '844x390,1280x720,390x844')).split(',').map((s) => s.trim()).filter(Boolean);
const record = flag('record');
const report = flag('report') || record;
const only = opt('screens', null)?.split(',').map((s) => s.trim()).filter(Boolean) || null;
const out = opt('out', join(tmpdir(), `menus-${ids.join('-')}`));
mkdirSync(out, { recursive: true });

/** The default number budget with the top bar counted (UI v2 rule 8). */
const NUMBERS = 10;
/** The v2 checks every menu shot is judged on (probe.mjs judge names); radius only on rebuilt shots. */
const CHECKS = ['text', 'overflow', 'ellipsis', 'content', 'host', 'v2yellow', 'pink', 'covered', 'heads', 'clipped'];

const names = [...new Set(ids.flatMap((m) => MILESTONES[m]))].filter((n) => !only || only.includes(n));
if (!names.length) {
  console.error('no shots to take');
  process.exit(2);
}

// 1. the shots and their probes (ui-shots does the driving)
const run = spawnSync(process.execPath, [join(here, 'ui-shots.mjs'), '--seed', 'ink', '--screens', names.join(','), '--viewport', viewports.join(','),
  '--probe', '--out', out, ...(opt('port', null) ? ['--port', opt('port')] : [])], { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', maxBuffer: 64 << 20 });
const shotLog = run.stdout || '';
const failedShots = [...shotLog.matchAll(/^\s+FAILED (\S+?):? (.*)$/gm)].map((m) => `${m[1]}: ${m[2]}`);

// 2. the judging
/** The numbers a before/after line compares. */
const metrics = (r) => ({
  text: r.minText,
  numbers: r.v2?.numbersAll ?? null,
  tapMin: r.v2?.tapMin ?? null,
  under44: r.v2?.tapsUnder44StrictCount ?? r.v2?.tapsUnder44Count ?? null,
  yellow: r.v2?.yellowFills.length ?? null,
  pinkStray: r.v2?.pinkStrayCount ?? null,
  radius: r.v2?.radiusCount ?? null,
  covered: r.v2?.coveredCount ?? null,
  overflow: !!(r.overflowX || r.scrollers.length),
  ellipsis: r.ellipsis.length,
  heads: r.v2?.headsCount ?? null,
  clipped: r.v2?.clippedCount ?? null,
  content: r.content,
  host: r.hostShare != null ? Math.round(r.hostShare * 100) : null,
});
/** Every failed check of one shot (strings). */
function fails(name, r) {
  const g = GATE[name] || {};
  const f = judge(r, { only: [...CHECKS, ...(g.rebuilt ? ['radius'] : [])], v2: true });
  const lim = g.limit ?? NUMBERS;
  if (r.v2 && r.v2.numbersAll > lim) f.push(`numbers ${r.v2.numbersAll} > ${lim} (top bar counted)`);
  if (r.v2) {
    const strict = r.v2.tapsUnder44Strict || r.v2.tapsUnder44;
    if (strict.length) f.push(`${r.v2.tapsUnder44StrictCount ?? strict.length} taps under 44 px (${strict.slice(0, 3).join('; ')})`);
    if (r.v2.tapsDenseUnder40?.length) f.push(`${r.v2.tapsDenseUnder40.length} dense taps under 40 px (${r.v2.tapsDenseUnder40.slice(0, 3).join('; ')})`);
  }
  return f;
}
const beforeFile = (m) => join(here, 'shots', 'before', `${m}.json`);
const before = {};
for (const m of ids) if (existsSync(beforeFile(m))) Object.assign(before, JSON.parse(readFileSync(beforeFile(m), 'utf8')));
const fmtM = (x) => (x == null ? '–' : x === true ? 'yes' : x === false ? 'no' : typeof x === 'number' ? String(Math.round(x * 100) / 100) : String(x));
const KEYS = ['text', 'numbers', 'tapMin', 'under44', 'yellow', 'pinkStray', 'covered', 'radius', 'overflow', 'ellipsis', 'heads', 'clipped', 'content', 'host'];

const results = {};
let failing = 0;
for (const vp of viewports) {
  const file = join(out, `probe-${vp}.json`);
  if (!existsSync(file)) {
    console.log(`\n${vp}: no probe file (every shot failed?)`);
    failing++;
    continue;
  }
  const probes = JSON.parse(readFileSync(file, 'utf8'));
  console.log(`\n=== ${vp} ===`);
  for (const name of names) {
    const r = probes[name];
    if (!r) {
      console.log(`  FAIL ${name}: not shot (it did not open, or its screen is missing)`);
      failing++;
      continue;
    }
    const m = metrics(r);
    (results[name] ||= {})[vp] = m;
    const b = before[name]?.[vp];
    const f = fails(name, r);
    if (f.length) failing++;
    const line = KEYS.map((k) => (b && fmtM(b[k]) !== fmtM(m[k]) ? `${k} ${fmtM(b[k])}→${fmtM(m[k])}` : `${k} ${fmtM(m[k])}`)).join(' · ');
    console.log(`  ${f.length ? 'FAIL' : 'ok  '} ${name}: ${line}`);
    for (const x of f) console.log(`         - ${x}`);
  }
}
for (const s of failedShots) console.log(`  FAILED shot ${s}`);

if (record) {
  for (const m of ids) {
    // (the sizes and shots taken join what the file already holds)
    const mine = existsSync(beforeFile(m)) ? JSON.parse(readFileSync(beforeFile(m), 'utf8')) : {};
    for (const n of MILESTONES[m]) if (results[n]) mine[n] = { ...mine[n], ...results[n] };
    mkdirSync(dirname(beforeFile(m)), { recursive: true });
    writeFileSync(beforeFile(m), `${JSON.stringify(mine, null, 1)}\n`);
    console.log(`recorded ${beforeFile(m)}`);
  }
}
console.log(`\n${names.length} shots × ${viewports.length} sizes: ${failing} shot-size(s) failing, ${failedShots.length} shot(s) failed to open; PNGs and probes in ${out}`);
console.log(`(limits: numbers ${NUMBERS} unless a shot says, content ≥ ${LIMITS.content} px, host ≤ ${Math.round(LIMITS.host.hub * 100)}% hub / ${Math.round(LIMITS.host.detail * 100)}% detail)`);
process.exit(!report && (failing || failedShots.length) ? 1 : 0);
