// Pure loop/scheduling math for manifest tracks (docs/AUDIO.md §2.9, §3.5). No WebAudio here.
//
// File layout (samples at manifest rate): F = head [0, head) played once, then the loop body
// [loopStart, loopEnd) repeats forever, entered at `entry` = loopStart + seam. A guard of `guard`
// samples of continuous audio surrounds every point that is played (encoder smear stays outside).
// Musical position m (seconds since song start) → file position:
//   m < head  ⇒  file = m
//   m ≥ head  ⇒  file = loopStart + ((m − introEnd) mod P)

/**
 * Track timing in seconds.
 * @param {object} t manifest track entry
 * @param {number} rate manifest sample rate
 * @param {number} [delta] decoder offset (s) measured by the probe, added to every file position
 */
export function trackTimes(t, rate, delta = 0) {
  const s = (x) => x / rate;
  const beat = (t.beat || (60 / (t.bpm || 120)) * rate) / rate;
  const meter = t.meter || [4, 4];
  const bar = beat * meter[0] * (4 / meter[1]);
  if (t.kind !== 'loop') {
    return { kind: 'oneshot', length: s(t.length || 0), beat, bar, delta, head: s(t.length || 0), P: 0 };
  }
  const introEnd = s(t.introEnd);
  const loopStart = s(t.loopStart);
  const loopEnd = s(t.loopEnd);
  return {
    kind: 'loop',
    introEnd,
    head: s(t.head),
    loopStart,
    loopEnd,
    entry: s(t.entry),
    P: loopEnd - loopStart,
    length: s(t.length),
    beat,
    bar,
    delta,
  };
}

/** File position (seconds, Δ applied) that plays at musical position m. */
export function filePos(m, tt) {
  if (tt.kind !== 'loop') return Math.min(m, tt.length) + tt.delta;
  if (m < tt.head) return m + tt.delta;
  const u = mod(m - tt.introEnd, tt.P);
  return tt.loopStart + u + tt.delta;
}

/** Positive modulo for floats. */
export function mod(a, n) {
  const r = a % n;
  return r < 0 ? r + n : r;
}

/**
 * How to start playback at musical position m: a list of source starts, times relative to the
 * moment musical position m plays.
 *   { at, offset, duration?, loop?: { start, end } }
 */
export function startPlan(m, tt) {
  if (tt.kind !== 'loop') {
    if (m >= tt.length) return [];
    return [{ at: 0, offset: m + tt.delta, duration: tt.length - m }];
  }
  const loop = { start: tt.loopStart + tt.delta, end: tt.loopEnd + tt.delta };
  if (m < tt.head) {
    return [
      { at: 0, offset: m + tt.delta, duration: tt.head - m },
      { at: tt.head - m, offset: tt.entry + tt.delta, loop },
    ];
  }
  return [{ at: 0, offset: filePos(m, tt), loop }];
}

/** Grid step in seconds: 'beat', 'half' (half a bar in even meters, else the bar) or 'bar'. */
export function gridStep(tt, unit = 'bar') {
  if (unit === 'beat') return tt.beat;
  if (unit === 'half') {
    const beats = Math.round(tt.bar / tt.beat);
    return beats % 2 === 0 ? tt.bar / 2 : tt.bar;
  }
  return tt.bar;
}

/** Musical time of the next beat/half-bar/bar boundary at or after m + minAhead. */
export function nextGrid(m, tt, unit = 'bar', minAhead = 0.05) {
  const step = gridStep(tt, unit);
  if (!(step > 0)) return m + minAhead;
  const target = m + minAhead;
  return Math.ceil(target / step - 1e-9) * step;
}

/**
 * Where to start a one-shot so that its accent (seconds into the file) lands on the next strong beat
 * ('half' bar by default) of the playing loop: → musical start time (m of the loop), ≥ m + minAhead.
 */
export function accentStart(m, tt, accent = 0, unit = 'half', minAhead = 0.05) {
  return nextGrid(m + accent, tt, unit, minAhead) - accent;
}

/** Bars → seconds for a track. */
export function bars(tt, n) {
  return tt.bar * n;
}

/**
 * Stem levels for a play request: requested stems that exist get their level; when no requested
 * stem exists in the track (e.g. a stand-in), every stem plays at 1.
 */
export function stemLevels(trackStems, requested = {}) {
  const names = Object.keys(trackStems || {});
  const hit = names.some((n) => n in requested);
  const out = {};
  for (const n of names) out[n] = hit ? Number(requested[n] ?? 0) : 1;
  return out;
}

/** Real track id for a requested id: the track itself, else a stand-in (exact, then '*' globs). */
export function resolveTrack(id, manifest) {
  if (!id || !manifest) return null;
  const tracks = manifest.tracks || {};
  if (tracks[id]) return id;
  const si = manifest.standIns || {};
  if (si[id] && tracks[si[id]]) return si[id];
  for (const [pat, target] of Object.entries(si)) {
    if (!pat.includes('*')) continue;
    const re = new RegExp(`^${pat.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
    if (re.test(id) && tracks[target]) return target;
  }
  return null;
}
