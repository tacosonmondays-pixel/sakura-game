// Dense-battle SFX check (docs/AUDIO.md §3.8, §6.4): a late wave at ×3 speed with a full board, driven by the
// real Sim at 60 Hz and the real battle audio hook (attachBattleAudio → limiter → sprite voices → buses →
// safety compressor), recorded from the final output with an AudioWorklet.
//
//   node e2e/audio-dense.mjs [--out <wav>] [--seconds 10] [--phone] [--loud]
//     --phone   emulate a phone (coarse pointer → 14 battle voices instead of 28)
//     --loud    all three volume sliders at 100 % (worst case) instead of the defaults
//
// Checks: output sample peak ≤ −1 dBFS and true peak ≤ −1 dBTP (ffmpeg ebur128), nothing clipped, little
// energy above 8 kHz (no fizz), the limiter keeps the battle voices under its cap, no console errors.
// Writes <out>.wav (the final output, stereo 16-bit), <out>.sfx.wav (the SFX bus before master / compressor),
// <out>.png (spectrogram of the output) and <out>.json (stats). Starts its own Vite server on a free port.
import { createServer } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const OUT = resolve(opt('out', `${tmpdir()}/dense-wave.wav`)).replace(/\.wav$/, '');
const SECONDS = Number(opt('seconds', '10'));
const PHONE = args.includes('--phone');
const LOUD = args.includes('--loud');
const IGNORE = [/GPU stall due to ReadPixels/i, /WebGL/i, /favicon\.ico/i, /net::ERR_/i];

const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}

/** 16-bit PCM WAV from interleaved stereo Float32. */
function wav16(path, inter, rate) {
  const n = inter.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(inter[i] * 32767))), 44 + i * 2);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  return path;
}

const db = (v) => 20 * Math.log10(Math.max(1e-12, v));
function ffmpeg(argv) {
  try {
    return execFileSync('ffmpeg', ['-hide_banner', '-nostats', ...argv], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
  } catch (e) {
    return String(e.stderr || '') + String(e.stdout || '');
  }
}
function ffmpegErr(argv) {
  const r = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats ${argv} 2>&1 || true`], { encoding: 'utf8', timeout: 120000 });
  return r;
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium({ args: ['--autoplay-policy=no-user-gesture-required'] });
log(`browser: ${label}${PHONE ? ' (phone emulation)' : ''}${LOUD ? ' (all volumes 100 %)' : ''}`);
const errors = [];
let stats = null;
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, ...(PHONE ? { isMobile: true, hasTouch: true } : {}) });
  const page = await context.newPage();
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  const A = (fn, arg) => page.evaluate(fn, arg);
  const waitFor = (fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);

  // a light screen (no 3D) so the machine's CPU goes to the sim and the audio thread
  await page.goto(base, { waitUntil: 'load' });
  await A(() => localStorage.clear());
  await page.goto(`${base}#/wiki`, { waitUntil: 'load' });
  await waitFor(() => window.__sakura?.audio && window.__sakura?.store, null, 60000);
  await A((loud) => {
    document.querySelectorAll('.modal-overlay').forEach((m) => m.remove());
    const s = window.__sakura.store.profile.settings;
    if (loud) Object.assign(s, { volume: 1, musicVolume: 1, sfxVolume: 1 });
    window.__sakura.store.commit('settings');
  }, LOUD);
  await page.mouse.click(4, 386);
  const ready = await waitFor(() => {
    const s = window.__sakura.audio.state();
    return s.unlocked && s.format && s.sfx.loaded;
  }, null, 60000);
  check(ready, 'audio unlocked, sprite decoded');
  const vol = await A(() => window.__sakura.audio.state().volumes);
  log(`  volumes: master ${vol.master}, music ${vol.music}, sfx ${vol.sfx}`);

  stats = await A(async ({ seconds }) => {
    const audio = window.__sakura.audio;
    const eng = audio.engine;
    const ac = eng.ctx;
    const [{ Sim }, { autoPlan }, stagesMod, unitsMod, { attachBattleAudio }] = await Promise.all([
      import('/src/sim/Sim.js'), import('/src/sim/headless.js'), import('/src/data/stages.js'), import('/src/data/units.js'), import('/src/audio/battle.js'),
    ]);
    // ---- a late stage, hard, with the whole tower roster on the board and upgraded --------------------------
    const ids = stagesMod.CAMPAIGN_IDS;
    const stageId = ids[ids.length - 1];
    const towerIds = unitsMod.towers().map((u) => u.id);
    const hero = unitsMod.heroes()[0]?.id;
    const plan = autoPlan(stageId, hero ? [...towerIds, hero] : towerIds, { maxCopies: 2 });
    const placeIds = [...new Set(plan.filter((p) => p.action === 'place').map((p) => p.unitId))];
    const sim = new Sim({
      stageId, difficulty: 'hard', seed: 7,
      loadout: placeIds.filter((id) => id !== hero).map((unitId) => ({ unitId })),
      hero: hero && placeIds.includes(hero) ? { unitId: hero } : null,
      options: { autoStart: false },
    });
    sim.cash = 1e9;
    let placed = 0;
    let upgraded = 0;
    for (const a of plan) {
      const x = a.x ?? a.tx;
      const y = a.y ?? a.ty;
      if (a.action === 'place') {
        if (sim.canPlace(a.unitId, x, y).ok && sim.placeTower(a.unitId, x, y)) placed++;
      } else if (a.action === 'upgrade') {
        const t = sim.towerAt(x, y);
        if (t && sim.upgradeTower(t.uid, a.path ?? 0)) upgraded++;
      }
    }
    sim.drainEvents();
    const kinds = [...new Set(sim.towers.map((t) => t.projKind || t.stats?.behavior))];
    // jump to a late wave (waves are generated from their number)
    sim.wave = Math.max(0, sim.totalWaves - 5);
    sim.startNextWave();
    sim.drainEvents();
    // A full board clears a wave in seconds; keep the path crowded the way a real late wave at ×3 is (≈ 60 enemies
    // spread along every path, a third of them tanky) so every girl fires all the time.
    const pool = [...new Set(sim.waveInfo(sim.wave).filter((w) => w.tier !== 'boss' && w.tier !== 'miniboss').map((w) => w.enemyId))];
    let topUps = 0;
    const crowd = (target) => {
      for (let k = 0; k < 6 && sim.enemies.length < target; k++) {
        const pi = topUps % sim.pathData.length;
        const len = sim.pathData[pi].length;
        const e = sim.spawnEnemy(pool[topUps % pool.length], { pathIndex: pi, dist: len * (0.08 + 0.6 * ((topUps * 0.618) % 1)) });
        if (e && topUps % 3 === 0) {
          e.maxHp *= 25;
          e.hp = e.maxHp;
        }
        topUps++;
      }
    };

    // ---- recorders: the final output (after the safety compressor) and the SFX bus alone -----------------------
    const code = `class R extends AudioWorkletProcessor {
      constructor() { super(); this.on = false; this.l = []; this.r = []; this.n = 0;
        this.port.onmessage = (e) => { if (e.data === 'start') this.on = true; else if (e.data === 'stop') { this.on = false; this.flush(); this.port.postMessage('done'); } }; }
      flush() { if (!this.n) return; const L = new Float32Array(this.n), Rr = new Float32Array(this.n); let o = 0;
        for (let i = 0; i < this.l.length; i++) { L.set(this.l[i], o); Rr.set(this.r[i], o); o += this.l[i].length; }
        this.port.postMessage({ l: L, r: Rr }, [L.buffer, Rr.buffer]); this.l = []; this.r = []; this.n = 0; }
      process(inputs) { const x = inputs[0]; if (this.on) { const n = (x && x[0]) ? x[0].length : 128;
        const l = x && x[0] ? x[0].slice(0) : new Float32Array(n); const r = x && x[1] ? x[1].slice(0) : l.slice(0);
        this.l.push(l); this.r.push(r); this.n += n; if (this.n >= 8192) this.flush(); } return true; } }
      registerProcessor('sakura-rec', R);`;
    await ac.audioWorklet.addModule(URL.createObjectURL(new Blob([code], { type: 'application/javascript' })));
    const mute = ac.createGain();
    mute.gain.value = 0;
    mute.connect(ac.destination);
    const rec = (src) => {
      const node = new AudioWorkletNode(ac, 'sakura-rec', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, channelCountMode: 'explicit' });
      const chunks = [];
      let done;
      const finished = new Promise((r) => (done = r));
      node.port.onmessage = (e) => (e.data === 'done' ? done() : chunks.push(e.data));
      src.connect(node);
      node.connect(mute);
      return { node, chunks, finished };
    };
    const recOut = rec(eng.buses.comp);
    const recSfx = rec(eng.buses.sfxBus);

    // ---- count what the hook asks for and what the limiter lets through ------------------------------------------
    const asked = {};
    const played = {};
    const origSfx = audio.sfx;
    audio.sfx = (id, o) => {
      asked[id] = (asked[id] || 0) + 1;
      const v = origSfx(id, o);
      if (v) played[id] = (played[id] || 0) + 1;
      return v;
    };
    const fake = {
      sim, speed: 3, paused: false, ended: false,
      feed: { push() {} }, openPause() {}, closePause() {}, cycleSpeed() {}, bump() {}, select() {},
    };
    const hook = attachBattleAudio(fake);
    const evCount = {};
    let frames = 0;
    let last = performance.now();
    let waves = 0;
    let ultAt = -1;
    let recording = false;
    const perSecond = [];
    let maxVoices = 0;
    const reduction = [];
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      if (sim.state === 'between' || sim.state === 'prep') {
        if (sim.startNextWave()) waves++;
      }
      crowd(60);
      sim.update(dt * fake.speed);
      const evts = sim.drainEvents();
      frames++;
      for (const e of evts) evCount[e.type] = (evCount[e.type] || 0) + 1;
      hook.events(evts);
      const v = audio.sfxPlayer.limiter.voices;
      maxVoices = Math.max(maxVoices, v.filter((x) => x.bus !== 'ui').length);
      if (recording) reduction.push(eng.buses.comp.reduction);
    };
    const timer = setInterval(tick, 1000 / 60);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await sleep(2500);                                   // warm-up: the wave is on screen, the battle music runs
    Object.keys(asked).forEach((k) => delete asked[k]);
    Object.keys(played).forEach((k) => delete played[k]);
    Object.keys(evCount).forEach((k) => delete evCount[k]);
    const d0 = audio.sfxPlayer.dropped;
    const p0 = audio.sfxPlayer.played;
    frames = 0;
    maxVoices = 0;
    recording = true;
    recOut.node.port.postMessage('start');
    recSfx.node.port.postMessage('start');
    const t0 = ac.currentTime;
    for (let s = 0; s < seconds; s++) {
      const before = { ...played };
      if (s === Math.floor(seconds * 0.4) && sim.hero) {
        // the hero's ultimate in the middle of it (a big layered moment on top of the spam)
        try {
          sim.hero.ultUnlocked = true;
          sim.hero.ultCooldown = 0;
          ultAt = sim.activateUlt() ? s : -1;
        } catch { /* no ult */ }
      }
      // the loudest one-off sounds on top of the spam: a boss phase roar at 60 %, a big leak at 75 %
      if (s === Math.floor(seconds * 0.6)) hook.events([{ type: 'bossPhase', uid: -1 }]);
      if (s === Math.floor(seconds * 0.75)) {
        const big = sim.waveInfo(sim.wave).find((w) => w.tier && w.tier !== 'normal')?.enemyId || pool[0];
        setTimeout(() => hook.events([{ type: 'leak', uid: -2, id: big, lives: 5 }]), 500);
      }
      await sleep(1000);
      const d = {};
      for (const [k, v] of Object.entries(played)) d[k] = v - (before[k] || 0);
      perSecond.push(Object.values(d).reduce((a, b) => a + b, 0));
    }
    recOut.node.port.postMessage('stop');
    recSfx.node.port.postMessage('stop');
    await Promise.all([recOut.finished, recSfx.finished]);
    const t1 = ac.currentTime;
    recording = false;
    clearInterval(timer);
    const musicTrack = audio.state().track;
    hook.destroy();
    audio.sfx = origSfx;
    audio.music.stop({ fade: 0.2 });

    const pack = (chunks) => {
      const n = chunks.reduce((a, c) => a + c.l.length, 0);
      const inter = new Float32Array(n * 2);
      let o = 0;
      for (const c of chunks) {
        for (let i = 0; i < c.l.length; i++) {
          inter[o++] = c.l[i];
          inter[o++] = c.r[i];
        }
      }
      const u8 = new Uint8Array(inter.buffer);
      let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    };
    const fireIds = Object.keys(played).filter((k) => /^(fire|atk|hit)\./.test(k));
    return {
      rate: ac.sampleRate, seconds: +(t1 - t0).toFixed(2), stageId, difficulty: 'hard', wave: sim.wave, totalWaves: sim.totalWaves, wavesStarted: waves,
      towers: sim.towers.length, placed, upgraded, kinds, enemiesNow: sim.enemies.length, frames, ultAt,
      cap: audio.sfxPlayer.cap, maxVoices, perSecond,
      asked, played, dropped: audio.sfxPlayer.dropped - d0, playedTotal: audio.sfxPlayer.played - p0,
      fireHitPerSecond: +(fireIds.reduce((a, k) => a + played[k], 0) / seconds).toFixed(1),
      events: evCount,
      eventsPerSecond: Object.fromEntries(Object.entries(evCount).map(([k, v]) => [k, +(v / seconds).toFixed(1)])),
      compMaxReductionDb: +Math.min(0, ...reduction).toFixed(2),
      compActiveShare: +(reduction.filter((r) => r < -0.5).length / Math.max(1, reduction.length)).toFixed(3),
      out: pack(recOut.chunks), sfx: pack(recSfx.chunks),
      volumes: audio.state().volumes, musicTrack, topUps,
    };
  }, { seconds: SECONDS });

  const toF32 = (b64) => new Float32Array(Buffer.from(b64, 'base64').buffer.slice(0));
  const out = toF32(stats.out);
  const sfx = toF32(stats.sfx);
  delete stats.out;
  delete stats.sfx;
  const wavPath = wav16(`${OUT}.wav`, out, stats.rate);
  const sfxPath = wav16(`${OUT}.sfx.wav`, sfx, stats.rate);
  let pk = 0;
  let clipped = 0;
  for (const v of out) {
    const a = Math.abs(v);
    if (a > pk) pk = a;
    if (a >= 0.999) clipped++;
  }
  let pkS = 0;
  for (const v of sfx) pkS = Math.max(pkS, Math.abs(v));
  // loudness + true peak (ffmpeg ebur128, 4× oversampled), energy above 8 kHz vs everything
  const loud = (p) => {
    const r = ffmpegErr(`-i '${p}' -af ebur128=peak=true -f null -`);
    const I = Number((r.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop()?.match(/-?[\d.]+/)?.[0]);
    const TP = Number((r.match(/Peak:\s+(-?[\d.]+) dBFS/g) || []).pop()?.match(/-?[\d.]+/)?.[0]);
    return { I, TP };
  };
  const rms = (p, af) => {
    const r = ffmpegErr(`-i '${p}' -af '${af ? `${af},` : ''}astats=metadata=0:measure_overall=RMS_level' -f null -`);
    const m = r.match(/Overall[\s\S]*?RMS level dB:\s*(-?[\d.]+|-inf)/);
    return m ? Number(m[1]) : NaN;
  };
  const lo = loud(wavPath);
  const loS = loud(sfxPath);
  const hf = rms(wavPath, 'highpass=f=8000:poles=2,highpass=f=8000:poles=2') - rms(wavPath);
  const hfS = rms(sfxPath, 'highpass=f=8000:poles=2,highpass=f=8000:poles=2') - rms(sfxPath);
  ffmpeg(['-loglevel', 'error', '-y', '-i', wavPath, '-lavfi', 'showspectrumpic=s=1400x520:legend=1:scale=log:fscale=lin:mode=combined:stop=12000', '-frames:v', '1', '-update', '1', `${OUT}.png`]);
  ffmpeg(['-loglevel', 'error', '-y', '-i', sfxPath, '-lavfi', 'showspectrumpic=s=1400x520:legend=1:scale=log:fscale=lin:mode=combined:stop=12000', '-frames:v', '1', '-update', '1', `${OUT}.sfx.png`]);
  Object.assign(stats, {
    samplePeakDb: +db(pk).toFixed(2), truePeakDb: lo.TP, integratedLufs: lo.I, clippedSamples: clipped, hfShareDb: +hf.toFixed(1),
    sfxBus: { samplePeakDb: +db(pkS).toFixed(2), truePeakDb: loS.TP, integratedLufs: loS.I, hfShareDb: +hfS.toFixed(1) },
    files: { wav: wavPath, sfxWav: sfxPath, spectrogram: `${OUT}.png`, sfxSpectrogram: `${OUT}.sfx.png` },
  });
  writeFileSync(`${OUT}.json`, `${JSON.stringify(stats, null, 1)}\n`);

  log(`  stage ${stats.stageId} (${stats.difficulty}) wave ${stats.wave}/${stats.totalWaves}, ${stats.towers} girls on the board (${stats.kinds.join(' ')}), ${stats.enemiesNow} enemies at the end, music ${stats.musicTrack}`);
  log(`  sim events/s: ${Object.entries(stats.eventsPerSecond).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  log(`  sounds asked ${Object.values(stats.asked).reduce((a, b) => a + b, 0)}, started ${stats.playedTotal}, dropped by the limiter ${stats.dropped}; per second ${stats.perSecond.join(' ')}; fire+hit ${stats.fireHitPerSecond}/s`);
  log(`  battle voices: max ${stats.maxVoices} of ${stats.cap}; safety compressor: max ${stats.compMaxReductionDb} dB, active ${(stats.compActiveShare * 100).toFixed(1)} % of the time`);
  check(stats.seconds >= SECONDS - 0.2, `recorded ${stats.seconds} s of the output at ${stats.rate} Hz → ${wavPath}`);
  check(stats.fireHitPerSecond >= 8, `dense: ${stats.fireHitPerSecond} attack/hit sounds per second reach the speakers`);
  check(stats.samplePeakDb <= -1 && clipped === 0, `output sample peak ${stats.samplePeakDb} dBFS (≤ −1), ${clipped} clipped samples`);
  check(Number.isFinite(stats.truePeakDb) && stats.truePeakDb <= -1, `output true peak ${stats.truePeakDb} dBTP (≤ −1), integrated ${stats.integratedLufs} LUFS`);
  check(stats.hfShareDb < -20, `no fizz: energy above 8 kHz ${stats.hfShareDb} dB below the whole mix (SFX bus ${stats.sfxBus.hfShareDb} dB)`);
  check(stats.maxVoices <= stats.cap, `limiter: ${stats.maxVoices} battle voices at most (cap ${stats.cap})`);
  log(`  SFX bus alone: peak ${stats.sfxBus.samplePeakDb} dBFS, true peak ${stats.sfxBus.truePeakDb} dBTP, ${stats.sfxBus.integratedLufs} LUFS`);
  log(`  spectrograms: ${stats.files.spectrogram}  ${stats.files.sfxSpectrogram}`);
  check(!errors.length, `no console errors${errors.length ? `:\n    ${errors.slice(0, 8).join('\n    ')}` : ''}`);
  await context.close();
} catch (e) {
  failures.push(`crashed: ${e.stack || e.message}`);
  log(`  FAIL crashed: ${e.stack || e.message}`);
} finally {
  await browser.close();
  await server.close();
}
log(failures.length ? `\n${failures.length} dense-wave check(s) failed` : '\nall dense-wave checks passed');
process.exit(failures.length ? 1 : 0);
