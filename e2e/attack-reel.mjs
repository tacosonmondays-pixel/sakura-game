// Attack FX reels for the owner: short clips of every girl's attack, contact sheets and a
// before/after of Chika's drones. Outputs are NOT committed (default: a temp folder).
//
//   node e2e/attack-reel.mjs [--units all|chika,aoi] [--builds base,max] [--quality medium]
//        [--viewport 960x540] [--seconds 1.6] [--fps 15] [--out <dir>] [--before] [--zoom 2.4]
//
// For each unit × build: the focus preview (previews/attacks.html, manual frames) swaps the girl
// in place, warms up 1 s of game time, steps on to her next attack so every clip opens on one,
// then captures seconds·fps frames (2.5 s for the slow girls). "max" is each girl's showcase
// build (her most distinctive capstone look). ffmpeg (if installed)
// turns them into <unit>-<build>.mp4 / .gif; ImageMagick `montage` (if installed) into
// <unit>-<build>-sheet.jpg and all-girls.jpg. --before also records Chika with fx=off and
// stacks it next to fx=on (chika-before-after.mp4). Writes reel.json (manifest).
import { createServer } from 'vite';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const ORDER = ['chika', 'hikari', 'luna', 'nami', 'aoi', 'rei', 'yuki', 'momo', 'akane', 'sango', 'kage', 'umeko', 'shiro', 'midori', 'suzu', 'raika', 'miko', 'hotaru', 'kaede'];
const units = opt('units', 'all') === 'all' ? ORDER : opt('units').split(',');
const builds = opt('builds', 'base,max').split(',');
const quality = opt('quality', 'medium');
const [vw, vh] = opt('viewport', '960x540').split('x').map(Number);
const seconds = Number(opt('seconds', '1.6'));
const fps = Number(opt('fps', '15'));
const zoom = opt('zoom', '2.4');
const out = opt('out', join(tmpdir(), 'attack-reel'));
const before = args.includes('--before');
mkdirSync(out, { recursive: true });

const has = (bin) => spawnSync('which', [bin]).status === 0;
const FFMPEG = has('ffmpeg');
const MONTAGE = has('montage');
const run = (bin, a) => {
  const r = spawnSync(bin, a, { stdio: 'pipe' });
  if (r.status !== 0) console.log(`  ${bin} failed: ${String(r.stderr).slice(-300)}`);
  return r.status === 0;
};

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1', hmr: false }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const { browser, label } = await launchChromium();
console.log(`browser: ${label} · out: ${out}`);

/** Showcase builds where the rotation below would miss a girl's most distinctive capstone. */
const SHOWCASE = { kage: '5-2-0', midori: '2-0-5', momo: '2-0-5' };
/** Slow attackers: a longer clip so it holds more than one attack. */
const SLOW = { shiro: 2.5, kaede: 2.5 };

/** The "max" build of a girl: her showcase, else T5 on path i%3 + T2 on the next (crosspath legal). */
const maxBuild = (u) => {
  if (SHOWCASE[u]) return SHOWCASE[u];
  const i = ORDER.indexOf(u);
  const t = [0, 0, 0];
  t[i % 3] = 5;
  t[(i + 1) % 3] = 2;
  return t.join('-');
};

async function openFocus(fx, first) {
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/previews/attacks.html?mode=focus&unit=${first}&quality=${quality}&manual=1&clean=1&zoom=${zoom}&fx=${fx}&preroll=5`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 180000 });
  return { page, errors };
}

async function capture(page, dir, n) {
  mkdirSync(dir, { recursive: true });
  for (let k = 0; k < n; k++) {
    // one rendered frame per captured frame (1/fps of game time; drones step at 1/60 inside)
    await page.evaluate((dt) => window.__advance(1, dt), 1 / fps);
    await page.screenshot({ path: join(dir, `f${String(k).padStart(3, '0')}.jpg`), type: 'jpeg', quality: 88, timeout: 240000 });
  }
}

function encode(dir, name) {
  const res = { mp4: null, gif: null, sheet: null };
  if (FFMPEG) {
    const mp4 = join(out, `${name}.mp4`);
    if (run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%03d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', mp4])) res.mp4 = mp4;
    const gif = join(out, `${name}.gif`);
    if (run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%03d.jpg'), '-vf', 'scale=480:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse', gif])) res.gif = gif;
  }
  if (MONTAGE) {
    const sheet = join(out, `${name}-sheet.jpg`);
    const frames = [];
    for (let k = 0; k < 24; k += 2) {
      const f = join(dir, `f${String(k).padStart(3, '0')}.jpg`);
      if (existsSync(f)) frames.push(f);
    }
    if (run('montage', [...frames, '-tile', '6x2', '-geometry', '320x180+2+2', '-background', '#10182c', sheet])) res.sheet = sheet;
  }
  return res;
}

const manifest = [];
const keyFrames = [];
const { page, errors } = await openFocus('on', units[0]);
for (const u of units) {
  const frames = Math.round(Math.max(seconds, SLOW[u] || 0) * fps);
  for (const b0 of builds) {
    const b = b0 === 'max' ? maxBuild(u) : b0 === 'base' ? '0-0-0' : b0;
    const name = `${u}-${b}`;
    const dir = join(out, 'frames', name);
    if (existsSync(dir)) rmSync(dir, { recursive: true });
    const ok = await page.evaluate(([id, build]) => window.__setup(id, build, 30), [u, b]);
    if (!ok) {
      console.log(`  skip ${name}: could not place`);
      continue;
    }
    await page.evaluate(() => window.__advance(10, 0.1));
    // open on an attack (frame-by-frame at 60 Hz until her next one, at most 10 s)
    await page.evaluate(() => window.__untilAttack(1, 600, 1 / 60));
    await capture(page, dir, frames);
    const res = encode(dir, name);
    manifest.push({ unit: u, build: b, frames, quality, ...res });
    if (b0 === builds[builds.length - 1]) keyFrames.push(join(dir, `f${String(Math.floor(frames / 2)).padStart(3, '0')}.jpg`));
    console.log(`  ${name}: ${frames} frames${res.mp4 ? ' · mp4' : ''}${res.sheet ? ' · sheet' : ''}`);
  }
}
await page.close();

if (MONTAGE && keyFrames.length > 1) {
  const all = join(out, 'all-girls.jpg');
  if (run('montage', [...keyFrames, '-tile', '5x4', '-geometry', '384x216+3+3', '-background', '#10182c', all])) console.log(`  all-girls.jpg (${keyFrames.length} girls)`);
}

if (before && FFMPEG) {
  // Chika 5-2-0 with the old look (fx=off) next to the new one, same seed and frames
  for (const fx of ['off', 'on']) {
    const p = await openFocus(fx, 'chika');
    await p.page.evaluate(() => window.__setup('chika', '5-2-0', 30));
    await p.page.evaluate(() => window.__advance(10, 0.1));
    await capture(p.page, join(out, 'frames', `chika-ba-${fx}`), Math.round(4 * fps));
    errors.push(...p.errors);
    await p.page.close();
  }
  const ba = join(out, 'chika-before-after.mp4');
  if (run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(out, 'frames', 'chika-ba-off', 'f%03d.jpg'), '-framerate', String(fps), '-i', join(out, 'frames', 'chika-ba-on', 'f%03d.jpg'),
    '-filter_complex', '[0:v]drawtext=text=BEFORE:x=16:y=14:fontsize=28:fontcolor=white:box=1:boxcolor=0x1d2b4fcc:boxborderw=8[a];[1:v]drawtext=text=AFTER:x=16:y=14:fontsize=28:fontcolor=white:box=1:boxcolor=0x1d2b4fcc:boxborderw=8[b];[a][b]hstack=inputs=2,scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', ba])) console.log('  chika-before-after.mp4');
}

writeFileSync(join(out, 'reel.json'), JSON.stringify(manifest, null, 1));
if (errors.length) console.log(`page errors:\n  ${errors.slice(0, 10).join('\n  ')}`);
await browser.close();
await server.close();
process.exit(errors.length ? 1 : 0);
