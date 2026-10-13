"""Per-part effects (docs/AUDIO.md §2.4 "fx"): resonant filter sweeps, drive and sidechain pump.

An `fx` dict can sit on a palette role (sound design, e.g. the hardtek kick's drive) and on a song part
(`song.part(..., fx={...})`, musical automation). The part's dict updates the role's dict effect by effect
(`merge_fx`); `{'drive': None}` on a part removes the role's drive.

    fx = {'filter': {'type': 'lp', 'hz': 900, 'q': 4.0,                      # TPT state-variable filter
                     'auto': [['A', 1, 300], ['A', 9, 4000]],             # [section, bar (1-based, may be 8.5), hz]
                     'accent': {'depth_oct': 2.5, 'decay_ms': 160}},       # note velocity → cutoff blip (acid)
          'drive':  {'pre_db': 14, 'hp_hz': 35, 'tone_hz': 6000, 'mix': 1.0, 'out_db': 0},
          'pump':   {'key': 'kit', 'notes': ['k'], 'depth_db': 7, 'attack_ms': 3, 'release_beats': 0.45}}

The pipeline runs `part_fx` on each FluidSynth job's continuous render, after the palette's SNES voice
treatment and before the echo send and the stem sum (order: filter → drive → pump). So stems still add up
to the full mix, and the loop seam stays exact: every effect is either time-invariant or modulated by a
curve built from the song timeline that repeats with the loop (automation points and key onsets are laid
out over every pass of the loop, plus one more pass so the last bars of cycle 2 interpolate toward the
next cycle exactly like cycle 1 does).

Parts that carry `fx` render in FluidSynth jobs grouped by their fx; a filter with `accent` gets a job of
its own (the blips follow that part's notes).
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass
from fractions import Fraction as Fr

import numpy as np
from scipy import signal

FX_ORDER = ('filter', 'drive', 'pump')
FX_FIELDS = {
    'filter': {'type', 'hz', 'q', 'auto', 'accent', 'mix', 'block'},
    'drive': {'pre_db', 'hp_hz', 'tone_hz', 'mix', 'out_db', 'ref', 'os'},
    'pump': {'key', 'notes', 'depth_db', 'attack_ms', 'release_beats', 'every', 'offset', 'hold_ms'},
}
ACCENT_FIELDS = {'depth_oct', 'decay_ms', 'vel_floor'}


class FxError(ValueError):
    pass


# ------------------------------------------------------------------------------------------------ dict helpers
def validate_fx(fx, where: str = '') -> dict:
    """Raise FxError on unknown effects or fields; returns the dict (None → {})."""
    if not fx:
        return {}
    if not isinstance(fx, dict):
        raise FxError(f'{where}fx must be a dict, got {type(fx).__name__}')
    for name, cfg in fx.items():
        if name not in FX_FIELDS:
            raise FxError(f'{where}unknown effect {name!r} (known: {", ".join(FX_ORDER)})')
        if cfg is None or cfg is False:
            continue
        if not isinstance(cfg, dict):
            raise FxError(f'{where}fx.{name} must be a dict (or None to remove it)')
        bad = set(cfg) - FX_FIELDS[name]
        if bad:
            raise FxError(f'{where}fx.{name} has unknown fields {sorted(bad)} (known: {sorted(FX_FIELDS[name])})')
        if name == 'filter':
            if cfg.get('type', 'lp') not in ('lp', 'bp', 'hp'):
                raise FxError(f'{where}fx.filter.type must be lp, bp or hp')
            if 'hz' not in cfg and not cfg.get('auto'):
                raise FxError(f'{where}fx.filter needs hz or auto')
            for p in cfg.get('auto') or []:
                if len(p) != 3 or not isinstance(p[0], str):
                    raise FxError(f'{where}fx.filter.auto points are [section, bar, hz], got {p!r}')
            if cfg.get('accent'):
                bad = set(cfg['accent']) - ACCENT_FIELDS
                if bad:
                    raise FxError(f'{where}fx.filter.accent has unknown fields {sorted(bad)}')
        if name == 'pump' and 'key' not in cfg:
            raise FxError(f"{where}fx.pump needs a key ('beat' or a part name)")
    return fx


def merge_fx(role_fx, part_fx) -> dict:
    """Role fx updated by part fx, effect by effect (a part value of None/False removes the effect)."""
    out = json.loads(json.dumps(role_fx or {}))
    for k, v in (part_fx or {}).items():
        if v is None or v is False:
            out.pop(k, None)
        elif isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = {**out[k], **v}
        else:
            out[k] = json.loads(json.dumps(v))
    return {k: v for k, v in out.items() if v}


def fx_key(fx: dict) -> str:
    """Canonical text of an fx dict (job grouping and cache keys)."""
    return json.dumps(fx, sort_keys=True, separators=(',', ':')) if fx else ''


def needs_own_job(fx: dict) -> bool:
    """A filter whose cutoff follows the part's own notes (accent) must not share a job with other parts."""
    return bool(fx and (fx.get('filter') or {}).get('accent'))


# ------------------------------------------------------------------------------------------------ drive
def drive(x: np.ndarray, rate: int, pre_db: float = 12.0, hp_hz: float = 35.0, tone_hz: float = 6000.0,
          mix: float = 1.0, out_db: float = 0.0, ref='peak', os: int = 2) -> np.ndarray:
    """tanh waveshaper with a pre high-pass and a post low-pass ('tone'), blended in parallel.

        h = HP(x, hp_hz)
        y = ref · tanh(g · h / ref) / tanh(g)         g = 10^(pre_db / 20)
        out = 10^(out_db / 20) · ((1 − mix) · x + mix · LP(y, tone_hz))

    ref = 'peak' (default) uses the part's own peak after the high-pass, so the loudest hit maps to the same
    peak and everything `pre_db` below it starts to saturate: the character does not depend on the role or
    part gain (the effect is scale-invariant), only on pre_db. A number uses a fixed reference level instead.
    The shaper runs at `os`× the rate (polyphase resampling) to keep aliasing down. Memoryless apart from
    the LTI filters: deterministic, periodic input → periodic output."""
    x = np.asarray(x, dtype=np.float64)
    h = x
    if hp_hz:
        h = signal.sosfilt(signal.butter(2, hp_hz, btype='highpass', fs=rate, output='sos'), h, axis=0)
    r = float(np.abs(h).max()) if ref == 'peak' else float(ref)
    if r <= 1e-12:
        return x * 10 ** (out_db / 20)
    g = 10 ** (pre_db / 20)
    if os and os > 1:
        up = signal.resample_poly(h, os, 1, axis=0)
        y = r * np.tanh(g * up / r) / math.tanh(g)
        y = signal.resample_poly(y, 1, os, axis=0)[:len(h)]
    else:
        y = r * np.tanh(g * h / r) / math.tanh(g)
    if tone_hz and tone_hz < rate / 2 * 0.98:
        y = signal.sosfilt(signal.butter(2, tone_hz, fs=rate, output='sos'), y, axis=0)
    return ((1 - mix) * x + mix * y) * 10 ** (out_db / 20)


# ------------------------------------------------------------------------------------------------ SVF filter
def _svf_coeffs(fc: np.ndarray, rate: int, q: float):
    fc = np.clip(np.asarray(fc, dtype=np.float64), 10.0, rate * 0.45)
    g = np.tan(np.pi * fc / rate)
    k = 1.0 / max(1e-3, q)
    a1 = 1.0 / (1.0 + g * (g + k))
    a2 = g * a1
    a3 = g * a2
    return k, a1, a2, a3


def _svf_out(kind, k, v0, v1, v2):
    if kind == 'lp':
        return v2
    if kind == 'bp':
        return k * v1                          # unity gain at the centre frequency
    return v0 - k * v1 - v2


def svf_reference(x: np.ndarray, rate: int, fc_per_sample: np.ndarray, q: float = 0.707, kind: str = 'lp') -> np.ndarray:
    """Plain per-sample TPT state-variable filter (Zavalishin / Simper), for tests: slow but obvious."""
    x = np.asarray(x, dtype=np.float64)
    x2 = x if x.ndim == 2 else x[:, None]
    k, a1, a2, a3 = _svf_coeffs(fc_per_sample, rate, q)
    out = np.zeros_like(x2)
    s1 = np.zeros(x2.shape[1])
    s2 = np.zeros(x2.shape[1])
    for n in range(len(x2)):
        v0 = x2[n]
        v3 = v0 - s2
        v1 = a1[n] * s1 + a2[n] * v3
        v2 = s2 + a2[n] * s1 + a3[n] * v3
        out[n] = _svf_out(kind, k, v0, v1, v2)
        s1 = 2 * v1 - s1
        s2 = 2 * v2 - s2
    return out if x.ndim == 2 else out[:, 0]


def svf(x: np.ndarray, rate: int, fc_blocks: np.ndarray, q: float = 0.707, kind: str = 'lp', block: int = 32) -> np.ndarray:
    """TPT state-variable filter whose cutoff is constant within blocks of `block` samples.

    Exactly the per-sample filter (svf_reference with the cutoff held per block), computed fast: the filter
    is linear in (state, input), so each block's output = its zero-state response (all blocks at once,
    vectorised) + its zero-input response from the state at the block start, and those start states follow
    from one cheap 2×2 recurrence over the blocks. The TPT form keeps the state meaningful when the cutoff
    moves (no zipper or blow-up under fast modulation)."""
    x = np.asarray(x, dtype=np.float64)
    x2 = x if x.ndim == 2 else x[:, None]
    n, C = x2.shape
    nb = -(-n // block)
    fc_blocks = np.asarray(fc_blocks, dtype=np.float64)
    if len(fc_blocks) < nb:
        fc_blocks = np.concatenate([fc_blocks, np.full(nb - len(fc_blocks), fc_blocks[-1] if len(fc_blocks) else 1000.0)])
    fc_blocks = fc_blocks[:nb]
    k, a1, a2, a3 = _svf_coeffs(fc_blocks, rate, q)
    X = np.zeros((nb * block, C))
    X[:n] = x2
    X = X.reshape(nb, block, C)
    A1, A2, A3 = a1[:, None], a2[:, None], a3[:, None]
    # zero-state response of every block (state 0 at each block start)
    s1 = np.zeros((nb, C))
    s2 = np.zeros((nb, C))
    Y = np.empty((nb, block, C))
    for i in range(block):
        v0 = X[:, i, :]
        v3 = v0 - s2
        v1 = A1 * s1 + A2 * v3
        v2 = s2 + A2 * s1 + A3 * v3
        Y[:, i, :] = _svf_out(kind, k, v0, v1, v2)
        s1 = 2 * v1 - s1
        s2 = 2 * v2 - s2
    zs1, zs2 = s1, s2
    # zero-input responses of each block from unit start states e1 = (1, 0) and e2 = (0, 1)
    resp, final = [], []
    for e in ((1.0, 0.0), (0.0, 1.0)):
        u1 = np.full(nb, e[0])
        u2 = np.full(nb, e[1])
        R = np.empty((nb, block))
        zero = np.zeros(nb)
        for i in range(block):
            v3 = -u2
            v1 = a1 * u1 + a2 * v3
            v2 = u2 + a2 * u1 + a3 * v3
            R[:, i] = _svf_out(kind, k, zero, v1, v2)
            u1 = 2 * v1 - u1
            u2 = 2 * v2 - u2
        resp.append(R)
        final.append((u1, u2))
    # start state of every block: S[b+1] = M_b · S[b] + zero-state end state of block b
    m11, m21 = final[0][0].tolist(), final[0][1].tolist()
    m12, m22 = final[1][0].tolist(), final[1][1].tolist()
    S1 = np.zeros((nb, C))
    S2 = np.zeros((nb, C))
    for c in range(C):
        z1, z2 = zs1[:, c].tolist(), zs2[:, c].tolist()
        p1 = p2 = 0.0
        col1 = [0.0] * nb
        col2 = [0.0] * nb
        for b in range(nb - 1):
            p1, p2 = m11[b] * p1 + m12[b] * p2 + z1[b], m21[b] * p1 + m22[b] * p2 + z2[b]
            col1[b + 1] = p1
            col2[b + 1] = p2
        S1[:, c] = col1
        S2[:, c] = col2
    Y += resp[0][:, :, None] * S1[:, None, :] + resp[1][:, :, None] * S2[:, None, :]
    out = Y.reshape(nb * block, C)[:n]
    return out if x.ndim == 2 else out[:, 0]


# ------------------------------------------------------------------------------------------------ timeline curves
@dataclass
class FxContext:
    """What part_fx needs from the song: tempo (beats → samples), the timeline (key onsets), the render order of
    sections (automation), and the notes of the parts in this job (accent)."""
    rate: int
    tempo: object                 # midi.Tempo
    song: object                  # song.Song
    timeline: object              # song.Timeline
    notes: list                   # Note objects of the job's parts (absolute beats)
    n: int                        # samples in the render
    loop: tuple | None = None     # (intro samples L0, loop samples P) for loop songs


def section_starts(song, extra_loop_pass: bool = True) -> list:
    """[(start_beat, section name)] in render order: intro, loop × 2 (+1 virtual pass for periodic curves),
    or the whole form for one-shots."""
    intro, loop, outro = song.structure()
    if song.kind == 'loop':
        order = intro + loop * (3 if extra_loop_pass else 2)
    else:
        order = intro + loop + outro
    out, t = [], Fr(0)
    for s in order:
        out.append((t, s))
        t += song.bpb * song.sections[s].bars
    return out


def automation_points(song, auto) -> list:
    """[(beat, hz)] for every occurrence of every [section, bar, hz] point, in time order. Two points on the same
    beat keep the order of their sections in the render (the end of one pass, bar `bars + 1`, before the start of
    the next pass), so a sweep that ends on the loop's last bar line steps back down exactly at the wrap."""
    starts = section_starts(song)
    pts = []
    for i, (sec, bar, hz) in enumerate(auto):
        if sec not in song.sections:
            raise FxError(f'{song.id}: fx automation names unknown section {sec!r}')
        if not (1 <= float(bar) <= song.sections[sec].bars + 1):
            raise FxError(f'{song.id}: fx automation bar {bar} outside section {sec} (1…{song.sections[sec].bars + 1})')
        off = song.bpb * (Fr(bar).limit_denominator(64) - 1)
        for occ, (st, name) in enumerate(starts):
            if name == sec:
                pts.append((st + off, occ, i, float(hz)))
    pts.sort()
    return [(b, hz) for b, _, _, hz in pts]


def _with_next_pass(notes, ctx: FxContext) -> list:
    """Loop songs: the notes plus cycle 2's notes moved one loop later (the virtual third pass), so curves built
    from note onsets continue past the loop end exactly as the music does."""
    tl = ctx.timeline
    if ctx.song.kind != 'loop' or not tl.loop_beats:
        return list(notes)
    first2 = tl.intro_beats + tl.loop_beats
    return list(notes) + [n.shifted(tl.loop_beats) for n in notes if n.start >= first2]


def cutoff_curve(cfg: dict, ctx: FxContext, block: int) -> np.ndarray:
    """Cutoff (Hz) at the start of every block: static `hz` or log-interpolated `auto` points, times the
    velocity accent blips (303-style: every note restarts the envelope)."""
    nb = -(-ctx.n // block)
    t = np.arange(nb) * block
    if cfg.get('auto'):
        pts = automation_points(ctx.song, cfg['auto'])
        xs = np.array([float(ctx.tempo.beats_to_samples(b)) for b, _ in pts])
        ys = np.log2(np.array([hz for _, hz in pts]))
        fc = 2 ** np.interp(t, xs, ys)
    else:
        fc = np.full(nb, float(cfg['hz']))
    acc = cfg.get('accent')
    if acc and ctx.notes:
        depth = float(acc.get('depth_oct', 2.0))
        decay = max(1.0, float(acc.get('decay_ms', 180))) * ctx.rate / 1000
        floor = float(acc.get('vel_floor', 48))
        on = sorted({(int(ctx.tempo.samples(nt.start)), nt.vel) for nt in _with_next_pass(ctx.notes, ctx) if nt.pitches})
        if on:
            ot = np.array([o for o, _ in on], dtype=np.float64)
            amt = depth * np.clip((np.array([v for _, v in on], dtype=np.float64) - floor) / (127 - floor), 0, 1)
            idx = np.searchsorted(ot, t, side='right') - 1
            ok = idx >= 0
            env = np.zeros(nb)
            env[ok] = amt[idx[ok]] * np.exp(-(t[ok] - ot[idx[ok]]) / decay)
            fc = fc * 2 ** env
    return fc


def key_onsets(cfg: dict, ctx: FxContext) -> np.ndarray:
    """Sample positions of the pump's key: every `every` beats ('beat'), or the onsets of the named part(s),
    optionally only notes whose drum names / MIDI pitches are listed in `notes`."""
    key = cfg['key']
    if key == 'beat':
        every = Fr(cfg.get('every', 1)).limit_denominator(64)
        off = Fr(cfg.get('offset', 0)).limit_denominator(64)
        end = ctx.timeline.render_beats + ctx.song.bpb * 2
        beats, b = [], off
        while b < end:
            beats.append(b)
            b += every
        return np.array(sorted({ctx.tempo.samples(b) for b in beats}), dtype=np.int64)
    names = [key] if isinstance(key, str) else list(key)
    parts = {p.name: p for p in ctx.timeline.parts}
    want = cfg.get('notes')
    out = set()
    for nm in names:
        if nm not in parts:
            raise FxError(f'{ctx.song.id}: fx.pump key {nm!r} is not a part (parts: {", ".join(parts)})')
        for nt in _with_next_pass(parts[nm].notes, ctx):
            if not nt.pitches:
                continue
            if want:
                labels = set(nt.drum_names) | set(nt.pitches)
                if not labels & set(want):
                    continue
            out.add(int(ctx.tempo.samples(nt.start)))
    return np.array(sorted(out), dtype=np.int64)


def pump_gain(onsets: np.ndarray, n: int, rate: int, beat_samples: float, depth_db: float = 6.0, attack_ms: float = 3.0,
              release_beats: float = 0.4, hold_ms: float = 0.0) -> np.ndarray:
    """Sidechain gain curve (linear, length n): at each onset the gain falls by depth_db over attack_ms, holds,
    then rises back to 0 dB along a raised cosine over release_beats. Overlaps take the deepest dip."""
    g_db = np.zeros(n)
    a = max(1, int(round(attack_ms * rate / 1000)))
    h = max(0, int(round(hold_ms * rate / 1000)))
    r = max(1, int(round(release_beats * beat_samples)))
    shape = np.concatenate([np.linspace(0, 1, a, endpoint=False), np.ones(h),
                            0.5 * (1 + np.cos(np.pi * np.arange(r) / r))])
    dip = -float(depth_db) * shape
    for o in onsets:
        if o >= n:
            break
        lo = max(0, int(o))
        hi = min(n, lo + len(dip))
        seg = dip[lo - int(o):hi - int(o)]
        np.minimum(g_db[lo:hi], seg, out=g_db[lo:hi])
    return 10 ** (g_db / 20)


# ------------------------------------------------------------------------------------------------ chain
def part_fx(x: np.ndarray, fx: dict, ctx: FxContext) -> np.ndarray:
    """Apply a part's effects (filter → drive → pump) to its continuous render x (n, 2)."""
    if not fx:
        return x
    rate = ctx.rate
    y = np.asarray(x, dtype=np.float64)
    if ctx.loop:
        # Only R[0 : L0 + 2P] reaches the loop file. Past the end of cycle 2 the render holds release tails, but the
        # music really continues with cycle 2 again: put that continuation there (it already carries cycle 1's
        # tails) so the non-causal step (the drive's oversampling filter, ±10 samples) sees what follows the loop
        # end at the wrap, and the seam stays exact.
        L0, P = ctx.loop
        e = L0 + 2 * P
        k = min(len(y) - e, P, 4096)
        if k > 0:
            y = y.copy()
            y[e:e + k] = y[L0 + P:L0 + P + k]
    f = fx.get('filter')
    if f:
        block = int(f.get('block', 32))
        fc = cutoff_curve(f, ctx, block)
        w = svf(y, rate, fc, float(f.get('q', 0.707)), f.get('type', 'lp'), block)
        mix = float(f.get('mix', 1.0))
        y = w if mix >= 1 else (1 - mix) * y + mix * w
    d = fx.get('drive')
    if d:
        y = drive(y, rate, **{k: d[k] for k in ('pre_db', 'hp_hz', 'tone_hz', 'mix', 'out_db', 'ref', 'os') if k in d})
    p = fx.get('pump')
    if p:
        on = key_onsets(p, ctx)
        g = pump_gain(on, len(y), rate, float(ctx.tempo.beats_to_samples(1)), float(p.get('depth_db', 6.0)),
                      float(p.get('attack_ms', 3.0)), float(p.get('release_beats', 0.4)), float(p.get('hold_ms', 0.0)))
        y = y * g[:, None]
    return y
