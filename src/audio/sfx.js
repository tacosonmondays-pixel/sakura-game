// SFX sprite player (docs/AUDIO.md §3.8): one mono AudioBuffer for every sound, a pool of reusable
// { GainNode, StereoPannerNode } voices, and the pure limiter for caps, gaps and voice stealing.
import { createLimiter } from './limiter.js';

/**
 * One buffer from the main sprite and its part sprites: each part's samples are copied in at its `start`
 * (sprite samples, converted to the decoded rate). A context that cannot make buffers keeps the main one.
 * @param {BaseAudioContext} ctx @param {AudioBuffer} main @param {[object, AudioBuffer][]} parts @param {number} rate sprite rate
 */
export function stitch(ctx, main, parts, rate) {
  if (!ctx?.createBuffer) return main;
  const sr = main.sampleRate;
  let len = main.length;
  for (const [p, b] of parts) len = Math.max(len, Math.round((p.start / rate) * sr) + b.length);
  const out = ctx.createBuffer(main.numberOfChannels, len, sr);
  for (let c = 0; c < main.numberOfChannels; c++) {
    const dst = out.getChannelData(c);
    dst.set(main.getChannelData(c), 0);
    for (const [p, b] of parts) {
      const at = Math.round((p.start / rate) * sr);
      dst.set(b.getChannelData(Math.min(c, b.numberOfChannels - 1)).subarray(0, Math.max(0, len - at)), at);
    }
  }
  return out;
}

export class SfxPlayer {
  constructor(engine, loader) {
    this.e = engine;
    this.loader = loader;
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    this.cap = coarse ? 14 : 28;
    this.uiCap = 6;
    this.limiter = createLimiter({ cap: this.cap, uiCap: this.uiCap });
    this.sprite = null;
    this.buffer = null;
    this.loading = null;
    this.enabled = true;
    this.pool = [];
    this.missing = new Set();
    this.played = 0;
    this.dropped = 0;
    this.rngState = 0x9e3779b9;
  }

  get ctx() {
    return this.e.ctx;
  }

  /** Own jitter RNG (xorshift): never touches the sim's seeded RNG. */
  rand() {
    let x = this.rngState;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rngState = x >>> 0;
    return this.rngState / 4294967296;
  }

  async load() {
    if (this.buffer || this.loading || !this.enabled) return this.loading;
    this.loading = (async () => {
      const res = await fetch(`${this.e.base}sfx/sprite.json`);
      if (!res.ok) throw new Error(`sprite.json HTTP ${res.status}`);
      this.sprite = await res.json();
      const f = this.e.format;
      if (!f) throw new Error('no audio format');
      const main = await this.loader.decode(`${this.e.base}sfx/${this.sprite.files[f.id]}`);
      // part sprites (sprite.json `parts`: a few sounds added after the main file, e.g. 'attacks') are laid
      // into one buffer at their start, so play() stays one buffer and one offset for every sound
      const parts = Array.isArray(this.sprite.parts) ? this.sprite.parts : [];
      const decoded = [];
      for (const p of parts) {
        try {
          decoded.push([p, await this.loader.decode(`${this.e.base}sfx/${p.files[f.id]}`)]);
        } catch (e) {
          console.warn(`[audio] SFX part ${p.id} unavailable`, e);
        }
      }
      this.buffer = decoded.length ? stitch(this.ctx, main, decoded, this.sprite.rate) : main;
      this._buildPool();
    })().catch((e) => {
      console.warn('[audio] SFX unavailable', e);
      this.loading = null;
    });
    return this.loading;
  }

  _buildPool() {
    const ctx = this.ctx;
    if (!ctx || this.pool.length) return;
    for (let i = 0; i < this.cap + this.uiCap; i++) {
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) gain.connect(pan);
      this.pool.push({ gain, pan, out: pan || gain, busy: false, src: null, bus: null });
    }
  }

  _voice() {
    return this.pool.find((v) => !v.busy) || null;
  }

  _release(v, fast = false) {
    if (!v || !v.busy) return;
    const ctx = this.ctx;
    if (fast && v.src) {
      const t = ctx.currentTime;
      try {
        v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setValueAtTime(v.gain.gain.value, t);
        v.gain.gain.linearRampToValueAtTime(0, t + 0.03);
        v.src.stop(t + 0.035);
      } catch {
        /* already ended */
      }
    }
    const src = v.src;
    const finish = () => {
      try {
        src?.disconnect();
        v.out.disconnect();
      } catch {
        /* ignore */
      }
      v.busy = false;
      v.src = null;
    };
    if (fast) setTimeout(finish, 50);
    else finish();
  }

  /**
   * Play a sprite sound.
   * @param {string} id
   * @param {{ pan?: number, rate?: number, gain?: number, when?: number }} [o] gain in dB on top of sprite.json
   */
  play(id, o = {}) {
    if (!this.enabled || !this.buffer || !this.sprite || !this.ctx || !this.e.unlocked) return null;
    const s = this.sprite.sounds[id];
    if (!s) {
      if (!this.missing.has(id)) {
        this.missing.add(id);
        console.warn(`[audio] unknown sfx ${id}`);
      }
      return null;
    }
    const ctx = this.ctx;
    const rate = (o.rate || 1) * (s.jitter ? 1 + (this.rand() * 2 - 1) * s.jitter : 1);
    const t = ctx.currentTime + (o.when || 0);
    const dur = s.length / this.sprite.rate / rate;
    const verdict = this.limiter.admit(id, s, t, dur);
    if (!verdict.ok) {
      this.dropped++;
      return null;
    }
    if (verdict.steal?.handle) this._release(verdict.steal.handle, true);
    const v = this._voice();
    if (!v) {
      this.limiter.release(verdict.voice);
      this.dropped++;
      return null;
    }
    v.busy = true;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = rate;
    v.gain.gain.cancelScheduledValues(0);
    v.gain.gain.value = 10 ** (((s.gain_db || 0) + (o.gain || 0)) / 20);
    if (v.pan) v.pan.pan.value = Math.max(-1, Math.min(1, o.pan || 0));
    const bus = s.bus === 'ui' ? this.e.buses.ui : this.e.buses.battle;
    v.out.connect(bus);
    src.connect(v.gain);
    const delta = this.e.delta || 0;
    src.start(t, s.start / this.sprite.rate + delta, s.length / this.sprite.rate);
    v.src = src;
    verdict.voice.handle = v;
    src.onended = () => {
      if (v.src === src) {
        this.limiter.release(verdict.voice);
        this._release(v);
      }
    };
    this.played++;
    return v;
  }

  /** With SFX off the sprite is not even downloaded; index.js calls load() once a format is known. */
  setEnabled(on) {
    this.enabled = !!on;
  }

  setSpeed(speed) {
    this.limiter.setSpeed(speed);
  }

  stats() {
    return { voices: this.limiter.voices.length, played: this.played, dropped: this.dropped, loaded: !!this.buffer, sounds: this.sprite ? Object.keys(this.sprite.sounds).length : 0 };
  }
}
