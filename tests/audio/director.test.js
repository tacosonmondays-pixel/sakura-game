// Music director (src/audio/music.js) on a fake WebAudio graph: sample-locked stems, head + loop scheduling,
// bar-quantised transitions, stem fades, late stingers, jingle chaining, boss takeover, ducking, Music off.
// Plus the battle adapter's preloads (mount + boss two waves ahead).
import { describe, test, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MusicDirector } from '../../src/audio/music.js';
import { trackTimes, gridStep } from '../../src/audio/loopMath.js';
import { attachBattleAudio } from '../../src/audio/battle.js';

const manifest = JSON.parse(readFileSync(new URL('../../public/audio/music/manifest.json', import.meta.url), 'utf8'));

class Param {
  constructor(v = 1) {
    this.value = v;
    this.events = [];
  }
  setValueAtTime(v, t) { this.events.push(['set', v, t]); this.value = v; }
  linearRampToValueAtTime(v, t) { this.events.push(['ramp', v, t]); this.target = v; }
  exponentialRampToValueAtTime(v, t) { this.events.push(['exp', v, t]); this.target = v; }
  setTargetAtTime(v, t) { this.events.push(['target', v, t]); this.target = v; }
  cancelScheduledValues(t) { this.events.push(['cancel', t]); }
}
class Node {
  connect(n) { this.dest = n; return n; }
  disconnect() { this.dest = null; }
}
class FakeCtx {
  constructor() {
    this.currentTime = 10;
    this.sampleRate = 32000;
    this.state = 'running';
    this.sources = [];
  }
  createGain() { const n = new Node(); n.gain = new Param(1); return n; }
  createBufferSource() {
    const s = new Node();
    s.playbackRate = new Param(1);
    s.starts = [];
    s.start = (when, offset, dur) => s.starts.push({ when, offset, dur });
    s.stop = (t) => { s.stoppedAt = t; };
    this.sources.push(s);
    return s;
  }
}

function setup({ gate = null } = {}) {
  const ctx = new FakeCtx();
  const g = () => ctx.createGain();
  const lpf = new Node();
  lpf.frequency = new Param(15900);
  const engine = { ctx, unlocked: true, format: { id: 'opus', ext: 'webm' }, delta: 0, buses: { musicDuck: g(), stingers: g(), pauseLPF: lpf } };
  const loads = [];
  const loader = {
    async loadTrack(man, id) {
      loads.push(id);
      if (gate) await gate.promise;
      return Object.fromEntries(Object.keys(man.tracks[id].stems).map((n) => [n, { id, stem: n }]));
    },
    stemUrls: (man, id) => Object.fromEntries(Object.entries(man.tracks[id]?.stems || {}).map(([n, s]) => [n, `${s.file}.webm`])),
    setPinned() {},
    preload() {},
  };
  const music = new MusicDirector(engine, loader);
  music.setManifest(manifest);
  return { ctx, engine, loader, music, loads };
}
const srcsOf = (ctx, id) => ctx.sources.filter((s) => s.buffer?.id === id);

describe('MusicDirector', () => {
  test('a loop track starts every stem with the same `when`: head once, then the loop body from `entry`', async () => {
    const { ctx, music } = setup();
    await music.play('homeroom', { stems: { base: 1, melody: 1 } });
    expect(music.cur.id).toBe('homeroom');
    const tt = trackTimes(manifest.tracks.homeroom, manifest.rate);
    const srcs = srcsOf(ctx, 'homeroom');
    expect(srcs).toHaveLength(4);                                                 // 2 stems × (head + loop)
    const whens = new Set(srcs.map((s) => s.starts[0].when));
    expect(whens.size).toBe(2);                                                   // head start, loop start
    const [head, loop] = [srcs.find((s) => !s.loop), srcs.find((s) => s.loop)];
    expect(head.starts[0]).toMatchObject({ offset: 0, dur: tt.head });
    expect(loop.starts[0].when - head.starts[0].when).toBeCloseTo(tt.head, 9);
    expect(loop.starts[0].offset).toBeCloseTo(tt.entry, 9);
    expect(loop.loopStart).toBeCloseTo(tt.loopStart, 9);
    expect(loop.loopEnd).toBeCloseTo(tt.loopEnd, 9);
  });

  test('requested stems that the track has get their level; same track = stem fade, no restart', async () => {
    const { ctx, music } = setup();
    await music.play('homeroom', { stems: { base: 1, melody: 1 } });
    const n = ctx.sources.length;
    await music.play('students-like', {});                                        // unknown id: nothing resolves → stop
    expect(music.cur).toBe(null);
    await music.play('homeroom', { stems: { base: 1, melody: 1 } });
    const t0 = music.cur.t0;
    ctx.currentTime += 3.3;
    await music.play('homeroom', { stems: { base: 1, melody: 0 } });              // the Study Hall variant
    expect(music.cur.t0).toBe(t0);
    expect(ctx.sources.length).toBe(n * 2);                                       // no new sources for the stem change
    expect(music.cur.stems.melody.model.to).toBe(0);
    const beat = music.cur.tt.beat;
    const at = music.cur.stems.melody.model.t0;
    const m = at - music.cur.t0;
    expect(Math.abs(m / beat - Math.round(m / beat))).toBeLessThan(1e-6);         // quantised to a beat
  });

  test('different track: the old one fades from its next bar, the new one starts at that instant', async () => {
    const { ctx, music } = setup();
    await music.play('lobby-music', {});
    await music.play('homeroom', { stems: { base: 1, melody: 1 } });
    const old = music.cur;
    ctx.currentTime += 5.1;
    await music.play('battle_blossom', { stems: { base: 1, intensity: 0 }, transition: 'bar' });
    expect(music.cur.id).toBe('battle_blossom');
    expect(old.stopping).toBe(true);
    const m = music.cur.t0 - old.t0;
    expect(Math.abs(m / old.tt.bar - Math.round(m / old.tt.bar))).toBeLessThan(1e-6);
    expect(old.outModel.t0).toBeCloseTo(music.cur.t0, 9);
    expect(music.cur.stems.intensity.gain.gain.value).toBe(0);
    expect(music.cur.stems.base.gain.gain.value).toBe(1);
  });

  test('setStems brings the intensity stem in on the next beat over one bar', async () => {
    const { ctx, music } = setup();
    await music.play('battle_blossom', { stems: { base: 1, intensity: 0 } });
    ctx.currentTime += 2.0;
    music.setStems({ intensity: 1 }, { quantize: 'beat', fadeBars: 1 });
    const st = music.cur.stems.intensity.model;
    expect(st.to).toBe(1);
    expect(st.t0).toBeGreaterThan(ctx.currentTime);
    expect(st.t0 - ctx.currentTime).toBeLessThanOrEqual(music.cur.tt.beat + 0.05 + 1e-9);
    expect(st.t1 - st.t0).toBeCloseTo(music.cur.tt.bar, 6);
  });

  test('a stinger that is still decoding when its moment passed is skipped; a ready one plays now', async () => {
    let release;
    const gate = { promise: new Promise((r) => (release = r)) };
    const { ctx, music } = setup({ gate });
    const late = music.stinger('wave_blossom', { duck: -4, maxLate: 0.75 });
    ctx.currentTime += 2;
    release();
    expect(await late).toBe(null);
    expect(music.log.some((l) => l.includes('skipped'))).toBe(true);
    const ok = await music.stinger('wave_blossom', { duck: -4, maxLate: 0.75 });
    expect(ok).toBeCloseTo(ctx.currentTime + 0.05 + manifest.tracks.wave_blossom.length / manifest.rate, 6);
  });

  test('victory jingle stops the music and chains into the results loop exactly at its end', async () => {
    const { ctx, music } = setup();
    await music.play('battle_blossom', { stems: { base: 1, intensity: 1 } });
    const battle = music.cur;
    const end = await music.jingle('victory', { stopMusic: true, then: 'results_win' });
    expect(battle.stopping).toBe(true);
    expect(end).toBeCloseTo(ctx.currentTime + 0.3 + manifest.tracks.victory.length / manifest.rate, 6);
    expect(music.cur.id).toBe('results_win');
    expect(music.cur.t0).toBeCloseTo(end, 9);
  });

  test('a level-up jingle over the menu music does not cancel a track that is still loading', async () => {
    let release;
    const gate = { promise: new Promise((r) => (release = r)) };
    const { music } = setup({ gate });
    const loading = music.play('homeroom', { stems: { base: 1, melody: 1 } });
    const jingle = music.jingle('levelup', { stopMusic: false, duck: -10 });
    release();
    await Promise.all([loading, jingle]);
    expect(music.cur?.id).toBe('homeroom');
    expect([...music.ducks.values()].map((d) => d.db)).toEqual([-10]);
  });

  test('boss takeover: music stops, the warning sting plays, the boss track starts at the sting end', async () => {
    const { ctx, music } = setup();
    await music.play('battle_blossom', { stems: { base: 1, intensity: 1 } });
    const battle = music.cur;
    await music.bossTakeover('boss');
    expect(battle.stopping).toBe(true);
    const sting = ctx.sources.filter((s) => s.buffer?.id === 'boss_warning').at(-1);
    const stingEnd = sting.starts[0].when + sting.starts[0].dur;
    expect(music.cur).not.toBe(battle);
    expect(music.cur.t0).toBeCloseTo(stingEnd, 9);
    expect(music.cur.stems.intensity.gain.gain.value).toBe(0);
    music.setStems({ intensity: 1 }, { quantize: 'bar', fadeBars: 1 });           // bossPhase
    expect(music.cur.stems.intensity.model.to).toBe(1);
  });

  test('a wave sting in accent mode lands its stab on the playing loop\'s next strong beat', async () => {
    const { ctx, music } = setup();
    await music.play('battle_blossom', { stems: { base: 1, intensity: 1 } });
    const acc = manifest.tracks.wave_blossom.accent / manifest.rate;
    expect(acc).toBeGreaterThan(0);
    for (const dt of [1.234, 2.71, 0.05]) {
      ctx.currentTime += dt;
      await music.stinger('wave_blossom', { duck: 0, quantize: 'accent' });
      const src = ctx.sources.filter((s) => s.buffer?.id === 'wave_blossom').at(-1);
      const m = src.starts[0].when + acc - music.cur.t0;                          // musical time of the stab
      const step = gridStep(music.cur.tt, 'half');
      expect(Math.abs(m / step - Math.round(m / step))).toBeLessThan(1e-6);
      expect(src.starts[0].when).toBeGreaterThanOrEqual(ctx.currentTime + 0.05 - 1e-9);
      expect(src.starts[0].when - ctx.currentTime).toBeLessThanOrEqual(step + 0.05 + 1e-9);
    }
  });

  test('boss takeover with the boss track still decoding: the warning\'s hold loop plays on, the boss enters on its bar line', async () => {
    vi.useFakeTimers();
    try {
      let release;
      const gate = new Promise((r) => (release = r));
      const { ctx, music, loader } = setup();
      const plain = loader.loadTrack;
      loader.loadTrack = async (man, id) => {
        if (id === 'boss') await gate;
        return plain(man, id);
      };
      await music.play('battle_blossom', { stems: { base: 1, intensity: 1 } });
      const holdId = manifest.tracks.boss_warning.hold;
      expect(manifest.tracks[holdId]?.kind).toBe('loop');
      const done = music.bossTakeover('boss');
      await vi.advanceTimersByTimeAsync(6000);                                    // the warning ends, boss not decoded
      const warn = ctx.sources.filter((s) => s.buffer?.id === 'boss_warning').at(-1);
      const warnEnd = warn.starts[0].when + warn.starts[0].dur;
      expect(music.cur.id).toBe(holdId);
      expect(music.cur.t0).toBeCloseTo(warnEnd, 9);                               // no gap after the warning
      const hold = music.cur;
      ctx.currentTime = warnEnd + 1.0;
      release();
      await vi.advanceTimersByTimeAsync(10);
      await done;
      expect(music.cur.id).toBe('boss');
      expect(hold.stopping).toBe(true);
      const m = music.cur.t0 - hold.t0;
      expect(Math.abs(m / hold.tt.bar - Math.round(m / hold.tt.bar))).toBeLessThan(1e-6);   // on the hold's bar line
      expect(music.cur.stems.intensity.gain.gain.value).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  test('progressive start: from silence a track starts on its first stem, the others join sample-locked when decoded', async () => {
    const { ctx, music, loader } = setup();
    let release;
    const gate = new Promise((r) => (release = r));
    loader.loadStems = (man, id) => {
      const names = Object.keys(man.tracks[id].stems);
      return Object.fromEntries(names.map((n, i) => [n, i === 0 ? Promise.resolve({ id, stem: n }) : gate.then(() => ({ id, stem: n }))]));
    };
    await music.play('homeroom', { stems: { base: 1, melody: 1 } });
    const track = music.cur;
    expect(track.id).toBe('homeroom');
    expect(track.stems.base.srcs.length).toBeGreaterThan(0);
    expect(track.stems.melody.srcs).toHaveLength(0);                                // still decoding
    ctx.currentTime += 3.7;
    release();
    await gate;
    await new Promise((r) => setTimeout(r, 0));
    const mel = track.stems.melody.srcs;
    expect(mel.length).toBeGreaterThan(0);
    const tt = track.tt;
    const first = mel[0].starts[0];
    const m = first.when - track.t0;                                                // musical position it joins at
    expect(first.when).toBeGreaterThanOrEqual(ctx.currentTime);
    expect(first.offset).toBeCloseTo(m < tt.head ? m : tt.loopStart + ((m - tt.introEnd) % tt.P), 9);
    expect(mel[0].dest).toBe(track.stems.melody.gain);

    // under a playing track, an audible stem is awaited (no crossfade without its tune); a silent one is lazy
    let release2;
    const gate2 = new Promise((r) => (release2 = r));
    loader.loadStems = (man, id) => {
      const names = Object.keys(man.tracks[id].stems);
      return Object.fromEntries(names.map((n, i) => [n, i === 0 ? Promise.resolve({ id, stem: n }) : gate2.then(() => ({ id, stem: n }))]));
    };
    const p = music.play('battle_blossom', { stems: { base: 1, intensity: 0 }, transition: 'bar' });
    await new Promise((r) => setTimeout(r, 0));
    expect(music.cur.id).toBe('battle_blossom');                                    // intensity (0) did not hold it up
    expect(music.cur.stems.intensity.srcs).toHaveLength(0);
    release2();
    await p;
    await new Promise((r) => setTimeout(r, 0));
    expect(music.cur.stems.intensity.srcs.length).toBeGreaterThan(0);
  });

  test('ducks stack (deepest wins) and the pause lowpass follows', () => {
    const { engine, music } = setup();
    music.duck('modal', -4);
    music.duck('pause', -8, { lpf: 1200 });
    expect(music.duckModel.to).toBeCloseTo(10 ** (-8 / 20), 9);
    expect(engine.buses.pauseLPF.frequency.target).toBe(1200);
    music.unduck('pause');
    expect(music.duckModel.to).toBeCloseTo(10 ** (-4 / 20), 9);
    expect(engine.buses.pauseLPF.frequency.target).toBeGreaterThan(10000);
    music.unduck('modal');
    expect(music.duckModel.to).toBe(1);
  });

  test('Music off stops and loads nothing; on again resumes the last request', async () => {
    const { music, loads } = setup();
    await music.play('homeroom', { stems: { base: 1, melody: 1 } });
    music.setEnabled(false);
    expect(music.cur).toBe(null);
    const n = loads.length;
    await music.play('battle_blossom', { stems: { base: 1, intensity: 0 } });
    expect(loads.length).toBe(n);
    expect(music.wanted.id).toBe('battle_blossom');
    music.setEnabled(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(music.cur.id).toBe('battle_blossom');
  });
});

describe('battle adapter preloads', () => {
  afterEach(() => {
    delete globalThis.window;
  });
  test('mount preloads the battle track + jingles (no wave stings); a boss two waves ahead preloads its track and the warning', async () => {
    const asked = [];
    const audio = { preloadTracks: (list) => (asked.push(...list), list.length), battleAction() {}, setBattleSpeed() {}, setBattlePaused() {}, sfx() {} };
    globalThis.window = { __sakura: { audio } };
    const sim = { map: { theme: 'volcano', width: 20 }, data: { enemy: () => null }, wave: 0, lives: 20, maxLives: 20,
      waveInfo: (n) => (n === 3 ? [{ enemyId: 'dragon_ashwing', tier: 'boss' }] : [{ enemyId: 'slime', tier: 'normal' }]) };
    const a = attachBattleAudio({ sim, speed: 1, feed: { push() {} } });
    const tracks = asked.map((x) => x.track);
    expect(tracks).toEqual(expect.arrayContaining(['battle_matsuri', 'victory', 'defeat', 'results_win']));
    expect(tracks).not.toContain('wave_matsuri');                                  // no wave-start sting any more (owner, Oct 13)
    expect(tracks).not.toContain('final');
    sim.wave = 1;                                                                 // wave 3 is now two waves ahead
    await new Promise((r) => setTimeout(r, 300));
    expect(asked.map((x) => x.track)).toEqual(expect.arrayContaining(['final', 'boss_warning']));
    expect(asked.find((x) => x.track === 'final').decode).toBe(true);
    a.destroy();
  });
});
