// AudioContext, unlock, buses, visibility, format probe and volumes (docs/AUDIO.md §3.2, §3.3).
// Safe to import anywhere: nothing touches WebAudio until createEngine() runs in a browser.
//
//   tracks ─ stemGain ─ trackGain ─┐
//                                  musicDuck ─┐
//   stingers / jingles ───────────────────────┴ pauseLPF ─ musicBus ─┐
//                                                                    ├─ master ─ safety compressor ─ out
//   sfx voices ─ gain ─ panner ─ { uiBus, battleBus } ─ sfxBus ──────┘

export const PROBE_CLICK = 3200;
const PROBE_KEY = 'sakura-audio-probe';
const RATE_KEY = 'sakura-audio-rate';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null && v !== undefined ? Number(v) : d);

/** Settings → bus gains. Old saves stored music/sfx as numbers: they still work. */
export function volumesFrom(settings) {
  const s = settings || {};
  const musicOn = typeof s.music === 'number' ? s.music > 0 : s.music !== false;
  const sfxOn = typeof s.sfx === 'number' ? s.sfx > 0 : s.sfx !== false;
  const musicVol = clamp01(num(s.musicVolume, typeof s.music === 'number' ? s.music : 0.7));
  const sfxVol = clamp01(num(s.sfxVolume, typeof s.sfx === 'number' ? s.sfx : 0.8));
  return { master: clamp01(num(s.volume, 0.8)), music: musicOn ? musicVol : 0, sfx: sfxOn ? sfxVol : 0, musicOn, sfxOn };
}

function safeGet(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
}

/** Decode with the promise API, falling back to the callback form (old Safari). */
export function decodeAudio(ctx, bytes) {
  return new Promise((resolve, reject) => {
    let done = false;
    const ok = (b) => {
      if (!done) (done = true), resolve(b);
    };
    const bad = (e) => {
      if (!done) (done = true), reject(e || new Error('decode failed'));
    };
    try {
      const p = ctx.decodeAudioData(bytes, ok, bad);
      if (p && typeof p.then === 'function') p.then(ok, bad);
    } catch (e) {
      bad(e);
    }
  });
}

export function createEngine({ base = './audio/' } = {}) {
  const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
  let ctx = null;
  let buses = null;
  let unlocked = false;
  let armed = false;
  const unlockListeners = new Set();
  const state = { format: null, delta: 0, probe: null, error: null, rate: null, gestureUnlock: false };
  let vols = { master: 0.8, music: 0.7, sfx: 0.8, musicOn: true, sfxOn: true };
  let battleSpeedDb = 0;
  let battleMuted = false;
  let battleDuckDb = 0;

  function create() {
    if (ctx || !AC) return ctx;
    const want = Number(safeGet(RATE_KEY)) || 32000;
    try {
      ctx = new AC({ sampleRate: want, latencyHint: 'interactive' });
    } catch {
      try {
        ctx = new AC();
      } catch (e) {
        state.error = String(e?.message || e);
        return null;
      }
    }
    state.rate = ctx.sampleRate;
    const g = (v = 1) => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };
    const master = g(vols.master);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -3;
    comp.knee.value = 3;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    master.connect(comp).connect(ctx.destination);
    const musicBus = g(vols.music);
    musicBus.connect(master);
    const pauseLPF = ctx.createBiquadFilter();
    pauseLPF.type = 'lowpass';
    pauseLPF.frequency.value = Math.min(20000, ctx.sampleRate / 2 - 100);
    pauseLPF.Q.value = 0.5;
    pauseLPF.connect(musicBus);
    const musicDuck = g(1);
    musicDuck.connect(pauseLPF);
    const stingers = g(1);
    stingers.connect(pauseLPF);
    const sfxBus = g(vols.sfx);
    sfxBus.connect(master);
    const ui = g(1);
    ui.connect(sfxBus);
    const battle = g(1);
    battle.connect(sfxBus);
    const meter = (src) => {
      const a = ctx.createAnalyser();
      a.fftSize = 2048;
      src.connect(a);
      return a;
    };
    buses = { master, comp, musicBus, pauseLPF, musicDuck, stingers, sfxBus, ui, battle, musicMeter: meter(musicBus), sfxMeter: meter(sfxBus) };
    ctx.onstatechange = () => {
      if (ctx.state === 'running') return;
      // iOS 'interrupted' (calls, Siri) or an unexpected suspend while visible: re-arm the gesture unlock
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && ctx.state !== 'closed') armGestures();
    };
    return ctx;
  }

  function ramp(param, value, tc = 0.05) {
    if (!ctx || !param) return;
    const t = ctx.currentTime;
    try {
      param.cancelScheduledValues(t);
      param.setValueAtTime(param.value, t);
      param.setTargetAtTime(value, t, tc);
    } catch {
      param.value = value;
    }
  }

  function applyBattleGain() {
    if (!buses) return;
    const db = battleMuted ? -120 : battleSpeedDb + battleDuckDb;
    ramp(buses.battle.gain, battleMuted ? 0 : 10 ** (db / 20), 0.06);
  }

  function setAudioSession() {
    // Safari 16.4+: 'playback' plays through the ringer switch while Music is on (owner's wish);
    // 'ambient' mixes with the player's own music when Music is off.
    try {
      if (navigator.audioSession) navigator.audioSession.type = vols.musicOn ? 'playback' : 'ambient';
    } catch {
      /* not supported */
    }
  }

  async function unlock(fromGesture = false) {
    if (!create()) return false;
    setAudioSession();
    if (fromGesture) {
      // iOS needs a sound started inside the gesture
      try {
        const b = ctx.createBuffer(1, 1, ctx.sampleRate);
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(ctx.destination);
        s.start(0);
      } catch {
        /* ignore */
      }
    }
    try {
      await ctx.resume();
    } catch {
      /* stays suspended */
    }
    if (ctx.state === 'running' && !unlocked) {
      unlocked = true;
      state.gestureUnlock = fromGesture;
      disarmGestures();
      for (const fn of [...unlockListeners]) {
        try {
          fn();
        } catch (e) {
          console.warn('[audio] unlock listener failed', e);
        }
      }
    } else if (ctx.state === 'running') {
      disarmGestures();
    }
    return ctx.state === 'running';
  }

  const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'];
  const onGesture = () => {
    unlock(true);
  };
  function armGestures() {
    if (armed || typeof window === 'undefined') return;
    armed = true;
    for (const ev of GESTURES) window.addEventListener(ev, onGesture, { capture: true, passive: true });
  }
  function disarmGestures() {
    if (!armed) return;
    armed = false;
    for (const ev of GESTURES) window.removeEventListener(ev, onGesture, { capture: true });
  }

  function onVisibility() {
    if (!ctx) return;
    if (document.visibilityState === 'hidden') ctx.suspend().catch(() => {});
    else if (unlocked) ctx.resume().catch(() => armGestures());
  }

  /** Decode the probe click for each format and measure the decoder offset Δ (seconds). */
  async function probe(formats) {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    try {
      const cached = JSON.parse(safeGet(PROBE_KEY) || 'null');
      if (cached && cached.ua === ua && cached.rate === ctx.sampleRate && formats.some((f) => f.id === cached.format)) {
        state.format = formats.find((f) => f.id === cached.format);
        state.delta = cached.delta;
        state.probe = { ...cached, cached: true };
        return state.format;
      }
    } catch {
      /* ignore */
    }
    const tried = [];
    for (const f of formats) {
      try {
        const res = await fetch(`${base}probe.${f.ext}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await decodeAudio(ctx, await res.arrayBuffer());
        const ch = buf.getChannelData(0);
        let mi = 0;
        for (let i = 1; i < ch.length; i++) if (Math.abs(ch[i]) > Math.abs(ch[mi])) mi = i;
        const expected = PROBE_CLICK / 32000;
        let delta = mi / buf.sampleRate - expected;
        if (Math.abs(ch[mi]) < 0.1 || Math.abs(delta) * 32000 > 4096) throw new Error(`click not found (peak ${ch[mi].toFixed(3)} at ${mi})`);
        if (Math.abs(delta) * 32000 <= 16) delta = 0;      // codec smear, not an offset
        state.format = f;
        state.delta = delta;
        state.probe = { format: f.id, delta, clickAt: mi, rate: buf.sampleRate, tried };
        safeSet(PROBE_KEY, JSON.stringify({ ua, rate: ctx.sampleRate, format: f.id, delta }));
        return f;
      } catch (e) {
        tried.push(`${f.id}: ${e.message || e}`);
      }
    }
    state.error = `no decodable audio format (${tried.join('; ')})`;
    state.probe = { tried };
    return null;
  }

  /**
   * The format the probe will most likely pick, known before any AudioContext exists: this browser's cached probe
   * result, else the first format it says it 'probably' plays. Only used to fetch the first track's bytes before
   * the unlocking tap; decoding still waits for the real probe.
   */
  function guessFormat(formats) {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    try {
      const cached = JSON.parse(safeGet(PROBE_KEY) || 'null');
      const f = cached && cached.ua === ua && formats.find((x) => x.id === cached.format);
      if (f) return f;
    } catch {
      /* ignore */
    }
    try {
      const a = typeof document !== 'undefined' ? document.createElement('audio') : null;
      return (a && formats.find((f) => f.mime && a.canPlayType(f.mime) === 'probably')) || null;
    } catch {
      return null;
    }
  }

  function setVolumes(v) {
    vols = { ...vols, ...v };
    if (!buses) return;
    ramp(buses.master.gain, vols.master);
    ramp(buses.musicBus.gain, vols.music);
    ramp(buses.sfxBus.gain, vols.sfx);
    setAudioSession();
  }

  /** RMS level (dBFS) of a bus right now, from its analyser (debug / e2e). */
  function level(which = 'music') {
    const a = buses?.[which === 'music' ? 'musicMeter' : 'sfxMeter'];
    if (!a) return -Infinity;
    const d = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(d);
    let s = 0;
    for (let i = 0; i < d.length; i++) s += d[i] * d[i];
    return 10 * Math.log10(s / d.length + 1e-20);
  }

  return {
    get ctx() {
      return ctx;
    },
    get buses() {
      return buses;
    },
    get unlocked() {
      return unlocked;
    },
    get format() {
      return state.format;
    },
    get delta() {
      return state.delta;
    },
    get volumes() {
      return vols;
    },
    state,
    base,
    available: !!AC,
    /** Boot: create the context early when the page already had a gesture, try to resume, else arm. */
    boot() {
      if (!AC) return;
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
      // Create the context early only where it can start without a new gesture (a gesture already
      // happened, an installed PWA, or a browser that says autoplay is allowed); otherwise creating it
      // would just log an autoplay warning. Everyone else unlocks on the first tap / key.
      let early = false;
      try {
        early = !!navigator.userActivation?.hasBeenActive
          || !!window.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)').matches
          || navigator.getAutoplayPolicy?.('audiocontext') === 'allowed';
      } catch {
        early = false;
      }
      if (early) unlock(false);
      armGestures();
    },
    unlock,
    onUnlock(fn) {
      unlockListeners.add(fn);
      if (unlocked) fn();
      return () => unlockListeners.delete(fn);
    },
    probe,
    guessFormat,
    setVolumes,
    level,
    setBattleSpeed(speed) {
      battleSpeedDb = speed >= 3 ? -4 : speed >= 2 ? -2 : 0;
      applyBattleGain();
    },
    setBattlePaused(p) {
      battleMuted = !!p;
      applyBattleGain();
    },
    setBattleDuck(db) {
      battleDuckDb = db;
      applyBattleGain();
    },
    destroy() {
      disarmGestures();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
      try {
        ctx?.close();
      } catch {
        /* ignore */
      }
    },
  };
}
