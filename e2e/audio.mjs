// Audio end-to-end check (docs/AUDIO.md §6.4) in Playwright Chromium (Opus path):
//   1. nothing plays before a gesture (but the lobby track's bytes are prefetched); the first tap unlocks
//      (context running, Opus chosen, probe Δ = 0)
//   2. lobby music (the real homeroom) starts soon after the tap (signal on the music bus); a menu keeps the
//      same track, melody stem fades out
//   3. gapless loop: the shipped Opus stems, decoded by Chromium and scheduled with the engine's own
//      head+loop math in an OfflineAudioContext (32 kHz and 48 kHz), are compared sample by sample with
//      the continuous audio around the entry seam and two loop wraps (no click, no gap)
//   4. battle switches track; starting a wave fades the intensity stem in (≤ 2 bars) and the wave sting's stab
//      lands on the battle loop's strong-beat grid
//   5. SFX play (sprite voices) and Music off (the real Settings toggle) silences the music bus
//   6. no console errors, no failed requests
//
//   node e2e/audio.mjs            (starts its own Vite server on a free port; foreground, ~1 min)
import { createServer } from 'vite';
import { launchChromium } from './browser.mjs';

const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i,
  /favicon\.ico/i, /Failed to load resource: net::ERR_(CERT_AUTHORITY_INVALID|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|PROXY_CONNECTION_FAILED|TUNNEL_CONNECTION_FAILED|CONNECTION_REFUSED)/i,
];
const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const errors = [];
const warnings = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  // Playwright's navigations count as a user activation in Chromium (navigator.userActivation.hasBeenActive
  // is already true), which would let the engine start without a tap. Simulate a fresh visit instead.
  await context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, 'userActivation', { configurable: true, get: () => ({ hasBeenActive: false, isActive: false }) });
    } catch { /* ignore */ }
  });
  const page = await context.newPage();
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
    if (m.type() === 'warning' && /audio/i.test(t)) warnings.push(t);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => {
    if (r.url().startsWith(base)) errors.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText || ''}`);
  });
  page.on('response', (r) => {
    if (r.url().startsWith(base) && r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url()}`);
  });
  const A = (fn, arg) => page.evaluate(fn, arg);
  const waitFor = (fn, arg, timeout = 20000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);

  // ---- 1. boot, nothing before a gesture, then unlock ------------------------------------------------------
  await page.goto(base, { waitUntil: 'load' });
  await A(() => localStorage.clear());
  await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await waitFor(() => window.__sakura?.audio && document.querySelector('#app')?.children.length > 0, null, 30000);
  await page.waitForTimeout(800);
  await waitFor(() => window.__sakura.audio.state().rawBytes > 300_000, null, 15000);
  const before = await A(() => window.__sakura.audio.state());
  check(!before.unlocked && before.track === null, `before any gesture: silent (ctx ${before.ctx}, unlocked ${before.unlocked}, wanted ${before.requested})`);
  check(before.rawBytes > 300_000, `before the tap: the lobby track's bytes are already fetched (${(before.rawBytes / 1e6).toFixed(2)} MB, format guessed without a context)`);
  await A(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  const tTap = Date.now();
  await page.mouse.click(5, 360);                                  // a neutral spot: no button
  const unlocked = await waitFor(() => window.__sakura.audio.state().unlocked && window.__sakura.audio.state().format);
  const s1 = await A(() => window.__sakura.audio.state());
  check(unlocked && s1.ctx === 'running', `first tap unlocks: ctx ${s1.ctx}, rate ${s1.rate}, format ${s1.format}, probe Δ ${s1.delta}`);
  check(s1.format === 'opus' && s1.delta === 0, 'Chromium decodes the Opus probe click sample-exact (Δ = 0)');

  // ---- 2. lobby music ---------------------------------------------------------------------------------
  const soundOk = await waitFor(() => window.__sakura.audio.state().track === 'homeroom' && window.__sakura.audio.state().m > 0, null, 30000);
  const tSound = Date.now() - tTap;
  const lobbyOk = soundOk && await waitFor(() => {
    const s = window.__sakura.audio.state();
    return s.track && s.m > 1.0 && s.stems.melody?.value > 0.9;
  });
  const s2 = await A(() => ({ ...window.__sakura.audio.state(), level: window.__sakura.audio.level('music') }));
  check(lobbyOk && s2.track === 'homeroom' && s2.requested === 'homeroom', `lobby: homeroom playing at m=${s2.m}s, stems ${JSON.stringify(s2.stems)}`);
  check(soundOk && tSound < 8000, `lobby music started ${tSound} ms after the tap (bytes prefetched, decode starts right after the probe)`);
  check(s2.level > -50, `lobby: signal on the music bus (${s2.level.toFixed(1)} dBFS RMS)`);
  await A(() => { location.hash = '#/students'; });
  const menuOk = await waitFor(() => window.__sakura.audio.state().stems.melody?.value < 0.05, null, 15000);
  const s3 = await A(() => window.__sakura.audio.state());
  check(menuOk && s3.track === s2.track && s3.m > s2.m, `students: same track, no restart (m ${s2.m} → ${s3.m}), melody stem faded to ${s3.stems.melody?.value}`);

  // ---- 3. gapless loop measured in Chromium ---------------------------------------------------------------
  const seams = await A(async () => {
    const lm = await import('/src/audio/loopMath.js');
    const man = await (await fetch('/audio/music/manifest.json')).json();
    const out = [];
    const rmsDb = (a) => {
      let s = 0;
      for (const v of a) s += v * v;
      return 10 * Math.log10(s / a.length + 1e-30);
    };
    // 2nd-difference energy in 5 ms windows: the window at the seam vs the median window around it
    const clickRatio = (y, at, rate) => {
      const w = Math.round(rate * 0.005);
      const e = [];
      for (let i = 2; i + w < y.length; i += w) {
        let s = 0;
        for (let j = i; j < i + w; j++) { const d = y[j] - 2 * y[j - 1] + y[j - 2]; s += d * d; }
        e.push(s);
      }
      const k = Math.floor((at - 2) / w);
      const local = Math.max(e[k - 1] || 0, e[k] || 0, e[k + 1] || 0);
      const sorted = [...e].sort((a, b) => a - b);
      return local / (sorted[sorted.length >> 1] + 1e-20);
    };
    for (const id of ['homeroom', 'battle_blossom', 'boss_warning_hold']) {
      const t = man.tracks[id];
      for (const [stem, st] of Object.entries(t.stems)) {
        const bytes = await (await fetch(`/audio/music/${st.file}.webm`)).arrayBuffer();
        for (const rate of [32000, 48000]) {
          const tt = lm.trackTimes(t, man.rate, 0);
          const dur = tt.introEnd + 2 * tt.P + 0.5;
          const ctx = new OfflineAudioContext(2, Math.ceil(dur * rate), rate);
          const buf = await ctx.decodeAudioData(bytes.slice(0));
          for (const p of lm.startPlan(0, tt)) {                 // the engine's own scheduling
            const s = ctx.createBufferSource();
            s.buffer = buf;
            if (p.loop) { s.loop = true; s.loopStart = p.loop.start; s.loopEnd = p.loop.end; }
            s.connect(ctx.destination);
            if (p.duration != null) s.start(p.at, p.offset, p.duration); else s.start(p.at, p.offset);
          }
          const y = (await ctx.startRendering()).getChannelData(0);
          const src = buf.getChannelData(0);
          const N = Math.round((t.guard / man.rate) * rate) - 64;
          const seam = (mSeam, refPos) => {
            const a = Math.round(mSeam * rate);
            const r = Math.round(refPos * rate);
            const got = y.subarray(a - N, a + N);
            const ref = src.subarray(r - N, r + N);
            const diff = got.map((v, i) => v - ref[i]);
            return { diffDb: +rmsDb(diff).toFixed(1), levelDb: +rmsDb(ref).toFixed(1), click: +clickRatio(got, N, rate).toFixed(2), refClick: +clickRatio(ref, N, rate).toFixed(2) };
          };
          out.push({
            id, stem, rate, decodedSeconds: +(buf.length / rate).toFixed(3), fileSeconds: +(t.length / man.rate).toFixed(3),
            entry: seam(tt.head, tt.head),                          // head → loop entry  vs  the head's own continuation
            wrap1: seam(tt.introEnd + tt.P, tt.loopStart),          // loop end → loop start  vs  the guard before loopStart
            wrap2: seam(tt.introEnd + 2 * tt.P, tt.loopStart),
          });
        }
      }
    }
    return out;
  });
  for (const r of seams) {
    const worst = Math.max(r.entry.diffDb, r.wrap1.diffDb, r.wrap2.diffDb);
    const click = Math.max(r.entry.click / Math.max(1, r.entry.refClick), r.wrap1.click / Math.max(1, r.wrap1.refClick), r.wrap2.click / Math.max(1, r.wrap2.refClick));
    check(worst < -30 && click < 3 && Math.abs(r.decodedSeconds - r.fileSeconds) < 0.002,
      `seams ${r.id}.${r.stem} @${r.rate}: entry ${r.entry.diffDb} dB, wrap ${r.wrap1.diffDb}/${r.wrap2.diffDb} dB (music ${r.wrap1.levelDb} dB), click ratio ≤ ${click.toFixed(2)}, decoded ${r.decodedSeconds}s = file ${r.fileSeconds}s`);
  }

  // ---- 4. battle: track switch + intensity on wave start ---------------------------------------------------
  await A(() => { location.hash = '#/battle?stage=1-1&difficulty=easy'; });
  await waitFor(() => window.__battle?.ui?.audio, null, 60000);
  const battleOk = await waitFor(() => window.__sakura.audio.state().track === 'battle_blossom' && window.__sakura.audio.state().m > 0.5, null, 30000);
  const b1 = await A(() => window.__sakura.audio.state());
  check(battleOk && b1.requested === 'battle_blossom', `battle: switched to ${b1.track}, intensity ${JSON.stringify(b1.stems.intensity)}`);
  check(b1.stems.intensity?.target === 0, 'battle: build phase = base stem only');
  const barSec = await A(() => {
    const t = window.__sakura.audio.music.cur.tt;
    return t.bar;
  });
  await A(() => window.__battle.ui.startWave());
  // SwiftShader on a busy machine can take seconds per early frame: wait until the sim's waveStart
  // event went through the hook, then time the fade in AudioContext seconds from that moment.
  const seen = await waitFor(() => {
    const a = window.__sakura.audio;
    if (window.__battle.ui.audio.state().phase !== 'wave') return false;
    window.__waveSeenAt ??= a.ctx.currentTime;
    return true;
  }, null, 120000);
  const intenseOk = seen && await waitFor(() => {
    const a = window.__sakura.audio;
    if (a.state().stems.intensity?.value < 0.9) return false;
    window.__intenseAt ??= a.ctx.currentTime;
    return true;
  }, null, 20000);
  const b2 = await A(() => window.__sakura.audio.state());
  const musicLog = await A(() => window.__sakura.audio.log());
  log(musicLog.slice(-14).map((l) => `      | ${l}`).join('\n'));
  // The director logs '<ctx time> stems {"intensity":1} at <start> over <fade>' when the waveStart event
  // reaches it, and '<ctx time> stinger wave_blossom→… at <when>' when the sting is scheduled. Timing from
  // the log is exact AudioContext time, independent of how slowly SwiftShader draws frames here.
  const fadeLine = musicLog.find((l) => /stems \{"intensity":1\} at/.test(l)) || '';
  const fm = fadeLine.match(/^([\d.]+) stems .* at ([\d.]+) over ([\d.]+)/);
  const took = fm ? Number(fm[2]) + Number(fm[3]) - Number(fm[1]) : NaN;
  const stingLine = musicLog.find((l) => l.includes('stinger wave_blossom')) || '';
  const sm = stingLine.match(/ at ([\d.]+) until/);
  const stingLate = sm && fm ? Number(sm[1]) - Number(fm[1]) : NaN;
  // round 2: the sting is quantised so its stab (manifest `accent`) lands on the battle loop's next strong beat
  const grid = sm ? await A(async (when) => {
    const lm = await import('/src/audio/loopMath.js');
    const a = window.__sakura.audio;
    const c = a.music.cur;
    const acc = a.music.manifest.tracks.wave_blossom.accent / a.music.manifest.rate;
    const step = lm.gridStep(c.tt, 'half');
    const k = (when + acc - c.t0) / step;
    return { off: Math.abs(k - Math.round(k)) * step, step };
  }, Number(sm[1])) : null;
  check(intenseOk && took <= 2 * barSec + 0.05, `wave start: intensity stem fully in ${took.toFixed(2)} s after the event (≤ 2 bars = ${(2 * barSec).toFixed(2)} s), now ${b2.stems.intensity?.value}`);
  check(stingLate >= 0 && grid && stingLate < grid.step + 0.1 && grid.off < 0.002,
    `wave start: sting ${stingLine ? `scheduled ${stingLate.toFixed(2)} s after the event, its stab ${(grid?.off * 1000).toFixed(1)} ms off the loop's ${grid?.step.toFixed(2)} s grid (preloaded at mount)` : 'missing'}`);
  // a girl placed through the sim emits 'place' → bt.place via the event hook; a coin bump → bt.deny via the wrapped action
  const placed = await A(() => {
    const { sim, ui } = window.__battle;
    const id = sim.towers.length ? null : (ui.req?.loadout?.[0]?.unitId || sim.loadout?.[0]?.unitId || Object.keys(sim.loadoutSet || {})[0]);
    const ids = id ? [id] : [];
    for (const t of window.__battle.ui.profile.formation?.towers || []) ids.push(t);
    for (const unitId of ids) {
      for (let y = 0.5; y < sim.map.height; y += 0.5) {
        for (let x = 0.5; x < sim.map.width; x += 0.5) {
          if (sim.canPlace(unitId, x, y).ok) return !!sim.placeTower(unitId, x, y) && unitId;
        }
      }
    }
    return false;
  });
  await A(() => window.__battle.ui.bump());
  await waitFor(() => window.__sakura.audio.state().sfx.played >= 2, null, 60000);
  const sfx = await A(() => window.__sakura.audio.state().sfx);
  log(`  (placed ${placed || 'nobody'} through the sim)`);
  check(sfx.loaded && sfx.sounds >= 84 && sfx.played >= 2, `SFX sprite: ${sfx.sounds} sounds loaded, ${sfx.played} played, ${sfx.dropped} dropped by the limiter`);
  await A(() => window.__battle.ui.openPause());
  await page.waitForTimeout(400);
  const p = await A(() => window.__sakura.audio.state());
  check(p.ducks.pause === -8, `pause: music ducked ${p.ducks.pause} dB with the lowpass`);
  await A(() => window.__battle.ui.closePause());

  // ---- 5. Music off via the real Settings toggle -------------------------------------------------------
  await A(() => { location.hash = '#/settings'; });
  await page.waitForSelector('[data-testid=set-music]', { timeout: 20000 });
  const keep = await A(() => window.__sakura.audio.state().track);
  check(keep === 'battle_blossom', `settings keeps the current track (${keep})`);
  await page.click('[data-testid=set-music]');
  const offOk = await waitFor(() => !window.__sakura.audio.state().enabled && window.__sakura.audio.state().track === null, null, 5000);
  await page.waitForTimeout(900);
  const off = await A(() => ({ level: window.__sakura.audio.level('music'), s: window.__sakura.audio.state(), saved: window.__sakura.store.profile.settings.music }));
  check(offOk && off.level < -90 && off.saved === false, `Music off: director stopped, music bus ${Number.isFinite(off.level) ? off.level.toFixed(1) : off.level} dBFS, setting saved`);
  await page.click('[data-testid=set-music]');
  const onOk = await waitFor(() => window.__sakura.audio.state().track && window.__sakura.audio.level('music') > -60, null, 15000);
  check(onOk, `Music on again: ${await A(() => window.__sakura.audio.state().track)} resumes`);
  const decoded = await A(() => window.__sakura.audio.state().decodedBytes);
  check(decoded < 96 * 1024 * 1024, `decoded audio in memory: ${(decoded / 1048576).toFixed(1)} MB (phone budget 96 MB)`);

  // ---- 6. errors -----------------------------------------------------------------------------------------
  check(!errors.length, `no console errors / failed requests${errors.length ? `:\n    ${errors.slice(0, 10).join('\n    ')}` : ''}`);
  if (warnings.length) log(`  (audio warnings: ${warnings.slice(0, 5).join(' | ')})`);
  await context.close();
} catch (e) {
  failures.push(`crashed: ${e.stack || e.message}`);
  log(`  FAIL crashed: ${e.stack || e.message}`);
} finally {
  await browser.close();
  await server.close();
}
log(failures.length ? `\n${failures.length} audio check(s) failed` : '\nall audio checks passed');
process.exit(failures.length ? 1 : 0);
