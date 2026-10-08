// Music director (docs/AUDIO.md §3.5): sample-locked stems, gapless head+loop scheduling, bar-quantised
// transitions, stem fades, stingers, jingles that chain into the next track, boss takeover and ducking.
// Every stem of a track starts with the same `when` and musical position, so stems stay sample-locked;
// silent stems keep playing at gain 0, so bringing one in is a pure gain ramp.
import { trackTimes, startPlan, nextGrid, stemLevels, resolveTrack } from './loopMath.js';

const LOOKAHEAD = 0.05;

/** JS-side model of a linear gain ramp, so a new ramp can start from the exact current value. */
function rampTo(param, model, target, at, dur, now) {
  const valueAt = (t) => {
    if (t <= model.t0) return model.from;
    if (t >= model.t1) return model.to;
    return model.from + (model.to - model.from) * ((t - model.t0) / (model.t1 - model.t0));
  };
  const start = Math.max(at, now);
  const vNow = valueAt(now);
  const vStart = valueAt(start);
  try {
    param.cancelScheduledValues(now);
    param.setValueAtTime(vNow, now);
    if (start > now) param.linearRampToValueAtTime(vStart, start);
    param.setValueAtTime(vStart, start);
    param.linearRampToValueAtTime(target, start + Math.max(0.005, dur));
  } catch {
    param.value = target;
  }
  model.from = vStart;
  model.to = target;
  model.t0 = start;
  model.t1 = start + Math.max(0.005, dur);
}

export class MusicDirector {
  /**
   * @param {ReturnType<import('./engine.js').createEngine>} engine
   * @param {ReturnType<import('./loader.js').createLoader>} loader
   */
  constructor(engine, loader) {
    this.e = engine;
    this.loader = loader;
    this.manifest = null;
    this.cur = null;            // { id, def, tt, t0, out, outModel, stems: { name: { gain, model, srcs } }, stopping }
    this.token = 0;
    this.ducks = new Map();
    this.enabled = true;
    this.wanted = null;         // last play request: { id, opts }
    this.pending = null;
    this.duckModel = { from: 1, to: 1, t0: 0, t1: 0 };
    this.stingerSeq = 0;
    this.log = [];
  }

  get ctx() {
    return this.e.ctx;
  }

  setManifest(m) {
    this.manifest = m;
  }

  times(id) {
    return trackTimes(this.manifest.tracks[id], this.manifest.rate || 32000, this.e.delta || 0);
  }

  resolve(id) {
    return resolveTrack(id, this.manifest);
  }

  ready() {
    return !!(this.ctx && this.e.unlocked && this.e.format && this.manifest);
  }

  _note(msg) {
    this.log.push(`${this.ctx ? this.ctx.currentTime.toFixed(3) : '-'} ${msg}`);
    if (this.log.length > 60) this.log.shift();
  }

  /** Context time of the next beat/bar of a playing track. */
  gridTime(track, unit = 'bar') {
    const now = this.ctx.currentTime;
    if (!track || track.tt.kind !== 'loop' || unit === 'now') return now + LOOKAHEAD;
    const m = now - track.t0;
    return track.t0 + nextGrid(m, track.tt, unit, LOOKAHEAD);
  }

  _schedule(buf, tt, m, when, dest) {
    const srcs = [];
    for (const p of startPlan(m, tt)) {
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      if (p.loop) {
        s.loop = true;
        s.loopStart = p.loop.start;
        s.loopEnd = p.loop.end;
      }
      s.connect(dest);
      if (p.duration != null) s.start(when + p.at, Math.max(0, p.offset), p.duration);
      else s.start(when + p.at, Math.max(0, p.offset));
      srcs.push(s);
    }
    return srcs;
  }

  _start(id, def, bufs, levels, at, fadeIn, from = 0) {
    const ctx = this.ctx;
    const tt = this.times(id);
    const out = ctx.createGain();
    const outModel = { from: fadeIn > 0 ? 0 : 1, to: 1, t0: at, t1: at };
    out.gain.value = outModel.from;
    if (fadeIn > 0) rampTo(out.gain, outModel, 1, at, fadeIn, ctx.currentTime);
    out.connect(this.e.buses.musicDuck);
    const stems = {};
    for (const name of Object.keys(def.stems)) {
      const g = ctx.createGain();
      const v = levels[name] ?? 0;
      g.gain.value = v;
      g.connect(out);
      stems[name] = { gain: g, model: { from: v, to: v, t0: 0, t1: 0 }, srcs: bufs[name] ? this._schedule(bufs[name], tt, from, at, g) : [] };
    }
    this._note(`start ${id} at ${at.toFixed(3)}${from ? ` from m=${from.toFixed(3)}` : ''} ${JSON.stringify(levels)}`);
    return { id, def, tt, t0: at - from, out, outModel, stems, stopping: false };
  }

  _fadeOut(track, at, fade) {
    if (!track || track.stopping) return;
    track.stopping = true;
    const now = this.ctx.currentTime;
    rampTo(track.out.gain, track.outModel, 0, at, fade, now);
    const end = Math.max(at, now) + fade + 0.05;
    for (const st of Object.values(track.stems)) {
      for (const s of st.srcs) {
        try {
          s.stop(end);
        } catch {
          /* already stopped */
        }
      }
    }
    setTimeout(() => {
      try {
        track.out.disconnect();
      } catch {
        /* ignore */
      }
    }, (end - now) * 1000 + 200);
    this._note(`fade out ${track.id} at ${at.toFixed(3)} over ${fade}`);
  }

  /**
   * Play a track (design id; stand-ins resolve through the manifest).
   * @param {string} reqId
   * @param {{ stems?: object, transition?: 'bar'|'beat'|'now'|'cut', fade?: number, at?: number, restart?: boolean,
   *           from?: number }} [opts] from = musical position (s) to start at (Sound Test seam jumps)
   */
  async play(reqId, opts = {}) {
    this.wanted = { id: reqId, opts: { ...opts, at: undefined, from: undefined } };
    if (!this.enabled || !this.ready()) return null;
    const id = this.resolve(reqId);
    if (!id) {
      this._note(`no track for ${reqId}`);
      this.stop({ fade: 0.8 });
      return null;
    }
    const def = this.manifest.tracks[id];
    const levels = stemLevels(def.stems, opts.stems || {});
    if (this.cur && this.cur.id === id && !this.cur.stopping && !opts.restart && opts.at == null && opts.from == null) {
      this.setStems(levels, { quantize: opts.transition === 'now' ? 'now' : 'beat', fadeBars: 1 });
      return id;
    }
    const token = ++this.token;
    this.pending = id;
    let bufs;
    try {
      bufs = await this.loader.loadTrack(this.manifest, id);
    } catch (e) {
      console.warn(`[audio] could not load ${id}`, e);
      if (token === this.token) this.pending = null;
      return null;
    }
    if (token !== this.token || !this.enabled) return null;
    this.pending = null;
    // stem changes requested while this track was loading (e.g. a wave started) apply from the start
    const latest = this.wanted && this.resolve(this.wanted.id) === id ? this.wanted.opts.stems : null;
    if (latest) Object.assign(levels, stemLevels(def.stems, latest));
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const old = this.cur && !this.cur.stopping ? this.cur : null;
    const transition = opts.transition || 'bar';
    const fade = opts.fade ?? (transition === 'now' ? 0.6 : transition === 'cut' ? 0.3 : 1.2);
    let at = opts.at != null ? Math.max(opts.at, now + 0.02) : null;
    if (at == null) {
      if (!old) at = now + LOOKAHEAD;
      else if (transition === 'bar' || transition === 'beat') at = this.gridTime(old, transition);
      else if (transition === 'cut') at = now + fade;
      else at = now + 0.03;
    }
    if (old) this._fadeOut(old, transition === 'cut' ? now : transition === 'now' ? now + 0.02 : at, fade);
    this.cur = this._start(id, def, bufs, levels, at, transition === 'now' && old ? fade : 0, Math.max(0, Number(opts.from) || 0));
    this.loader.setPinned(Object.values(this.loader.stemUrls(this.manifest, id)));
    return id;
  }

  /** Re-issue the last request (after unlock, or when Music is switched back on). */
  playWanted(transition = 'now') {
    if (this.wanted) return this.play(this.wanted.id, { ...this.wanted.opts, transition });
    return null;
  }

  /**
   * Change stem levels of the playing track, quantised to the next beat/bar.
   * @param {object} levels { stem: 0..1 }
   * @param {{ quantize?: 'beat'|'bar'|'now', fade?: number, fadeBars?: number }} [o]
   */
  setStems(levels, { quantize = 'beat', fade, fadeBars = 1 } = {}) {
    // remember the levels with the last request, so a track that is still loading starts with them
    if (this.wanted?.id) this.wanted.opts = { ...this.wanted.opts, stems: { ...(this.wanted.opts.stems || {}), ...levels } };
    const c = this.cur;
    if (!c || c.stopping || !this.ctx) return;
    if (this.pending && this.pending !== c.id) return;          // the playing track is on its way out
    if (this.wanted?.id && this.resolve(this.wanted.id) !== c.id) return;
    const now = this.ctx.currentTime;
    const at = this.gridTime(c, quantize);
    const dur = fade ?? Math.max(0.05, fadeBars * (c.tt.bar || 2));
    for (const [name, v] of Object.entries(levels)) {
      const st = c.stems[name];
      if (!st) continue;
      rampTo(st.gain.gain, st.model, Math.max(0, Math.min(1.5, Number(v) || 0)), at, dur, now);
    }
    this._note(`stems ${JSON.stringify(levels)} at ${at.toFixed(3)} over ${dur.toFixed(2)}`);
  }

  _oneshot(id, bufs, at, dest) {
    const tt = this.times(id);
    const out = this.ctx.createGain();
    out.connect(dest);
    for (const buf of Object.values(bufs)) {
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      s.connect(out);
      s.start(at, Math.max(0, tt.delta), tt.length);
    }
    setTimeout(() => {
      try {
        out.disconnect();
      } catch {
        /* ignore */
      }
    }, (at - this.ctx.currentTime + tt.length) * 1000 + 300);
    return at + tt.length;
  }

  /**
   * One-shot on the music bus over the playing track (wave/miniboss stings, fanfares).
   * @returns {Promise<number|null>} context time when it ends
   */
  async stinger(reqId, { duck = -4, quantize = 'now', at = null, maxLate = null } = {}) {
    if (!this.enabled || !this.ready()) return null;
    const id = this.resolve(reqId);
    if (!id) return null;
    const asked = this.ctx.currentTime;
    let bufs;
    try {
      bufs = await this.loader.loadTrack(this.manifest, id, { pin: false });
    } catch (e) {
      console.warn(`[audio] stinger ${id} failed`, e);
      return null;
    }
    if (!this.enabled) return null;
    if (maxLate != null && at == null && this.ctx.currentTime - asked > maxLate) {
      // still decoding when its moment passed (a wave sting 3 s after the wave started is worse than none)
      this._note(`stinger ${reqId}→${id} skipped: ready ${(this.ctx.currentTime - asked).toFixed(2)} s late`);
      return null;
    }
    const when = at != null ? Math.max(at, this.ctx.currentTime + 0.02) : this.gridTime(this.cur, quantize === 'beat' && this.cur ? 'beat' : 'now');
    const end = this._oneshot(id, bufs, when, this.e.buses.stingers);
    if (duck) {
      const tag = `stinger${++this.stingerSeq}`;
      setTimeout(() => this.duck(tag, duck, { attack: 0.08 }), Math.max(0, (when - this.ctx.currentTime) * 1000));
      setTimeout(() => this.unduck(tag, { release: 0.5 }), Math.max(0, (end - this.ctx.currentTime) * 1000 - 300));
    }
    this._note(`stinger ${reqId}→${id} at ${when.toFixed(3)} until ${end.toFixed(3)}`);
    return end;
  }

  /**
   * Victory / defeat / level-up …: stop (or duck) the music, play the jingle, then chain into `then`
   * exactly at the jingle's end.
   */
  async jingle(reqId, { stopMusic = true, then = null, thenStems = null, duck = -10 } = {}) {
    if (!this.enabled || !this.ready()) {
      if (then) this.wanted = { id: then, opts: { stems: thenStems || {} } };
      return null;
    }
    // A jingle that stops the music supersedes pending track loads; one played over the music (level-up in a
    // menu) must not cancel a track that is still loading, so it only checks that Music stayed on.
    const token = stopMusic ? ++this.token : this.token;
    const now = this.ctx.currentTime;
    if (stopMusic && this.cur) {
      this._fadeOut(this.cur, now, 0.3);
      this.cur = null;
    }
    const id = this.resolve(reqId);
    if (!id) {
      if (then) return this.play(then, { transition: 'cut', stems: thenStems || {} });
      return null;
    }
    let bufs;
    try {
      bufs = await this.loader.loadTrack(this.manifest, id, { pin: false });
    } catch {
      return null;
    }
    if ((stopMusic && token !== this.token) || !this.enabled) return null;
    const at = Math.max(this.ctx.currentTime + 0.02, now + (stopMusic ? 0.3 : 0.02));
    const end = this._oneshot(id, bufs, at, this.e.buses.stingers);
    if (!stopMusic && duck) {
      const tag = `jingle${++this.stingerSeq}`;
      this.duck(tag, duck, { attack: 0.15 });
      setTimeout(() => this.unduck(tag, { release: 0.8 }), Math.max(0, (end - this.ctx.currentTime) * 1000 - 200));
    }
    this._note(`jingle ${reqId}→${id} until ${end.toFixed(3)}${then ? ` then ${then}` : ''}`);
    if (then) {
      this.wanted = { id: then, opts: { stems: thenStems || {} } };
      const thenId = this.resolve(then);
      if (thenId) this.loader.preload(this.manifest, thenId, { decode: true });
      await this.play(then, { transition: 'cut', at: end, stems: thenStems || {} });
    }
    return end;
  }

  /** Boss takeover: music stops (0.35 s), the warning sting plays, the boss track starts at its end. */
  async bossTakeover(trackId, warning = 'boss_warning') {
    if (!this.enabled || !this.ready()) {
      this.wanted = { id: trackId, opts: { stems: { base: 1, intensity: 0 } } };
      return;
    }
    const id = this.resolve(trackId);
    if (id) this.loader.preload(this.manifest, id, { decode: true });
    this.stop({ fade: 0.35 });
    const end = await this.stinger(warning, { duck: 0, at: this.ctx.currentTime + 0.35 });
    await this.play(trackId, { transition: 'cut', at: end ?? this.ctx.currentTime + 0.4, stems: { base: 1, intensity: 0 } });
  }

  /** Fade the current track out and cancel pending loads (the last request is kept for re-enabling). */
  stop({ fade = 0.6 } = {}) {
    this.token++;
    this.pending = null;
    if (this.cur && this.ctx) this._fadeOut(this.cur, this.ctx.currentTime, fade);
    this.cur = null;
  }

  _applyDucks(time = 0.2) {
    if (!this.ctx || !this.e.buses) return;
    let db = 0;
    let lpf = Infinity;
    for (const d of this.ducks.values()) {
      db = Math.min(db, d.db);
      if (d.lpf) lpf = Math.min(lpf, d.lpf);
    }
    const now = this.ctx.currentTime;
    rampTo(this.e.buses.musicDuck.gain, this.duckModel, 10 ** (db / 20), now, time, now);
    const f = this.e.buses.pauseLPF.frequency;
    const top = Math.min(20000, this.ctx.sampleRate / 2 - 100);
    try {
      f.cancelScheduledValues(now);
      f.setValueAtTime(f.value, now);
      f.exponentialRampToValueAtTime(Number.isFinite(lpf) ? lpf : top, now + time);
    } catch {
      f.value = Number.isFinite(lpf) ? lpf : top;
    }
  }

  duck(tag, db, { lpf = null, attack = 0.2 } = {}) {
    this.ducks.set(tag, { db, lpf });
    this._applyDucks(attack);
  }

  unduck(tag, { release = 0.4 } = {}) {
    if (!this.ducks.delete(tag)) return;
    this._applyDucks(release);
  }

  setEnabled(on) {
    if (on === this.enabled) return;
    this.enabled = on;
    if (!on) this.stop({ fade: 0.4 });
    else this.playWanted('now');
  }

  state() {
    const now = this.ctx?.currentTime ?? 0;
    const c = this.cur;
    const stems = {};
    if (c) for (const [n, st] of Object.entries(c.stems)) stems[n] = { target: +st.model.to.toFixed(3), value: +st.gain.gain.value.toFixed(3) };
    return {
      track: c?.id || null,
      requested: this.wanted?.id || null,
      m: c ? +(now - c.t0).toFixed(3) : null,
      stems,
      ducks: Object.fromEntries([...this.ducks].map(([k, v]) => [k, v.db])),
      pending: this.pending,
      enabled: this.enabled,
    };
  }
}
