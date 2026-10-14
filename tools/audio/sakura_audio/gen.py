"""Deterministic accompaniment generators from a chord grid.

Every generator takes (grid, key, beats_per_bar, opts) and returns notation.Note objects relative to
the section start. `grid` is theory.parse_grid() output: per bar a list of (start, length, Chord).

    bass:root  bass:root5  bass:sync  bass:walking  bass:pedal  bass:octaves
    comp:offbeat  comp:charleston  comp:bossa  comp:stabs  comp:quarters  pad:sustain
    arp:up16  arp:updown8  chip:arp32
    drums:straight  drums:shuffle  drums:march  drums:taiko  drums:bossa  drums:halftime  drums:four
"""
from __future__ import annotations

from fractions import Fraction as Fr

from .notation import Note, DRUM_NAMES
from .theory import voice, bass_note

GENERATORS = {}


def generator(name):
    def deco(fn):
        GENERATORS[name] = fn
        return fn
    return deco


def generate(kind: str, grid, key, bpb, opts: dict) -> list:
    if kind not in GENERATORS:
        raise ValueError(f'unknown generator {kind!r} (known: {", ".join(sorted(GENERATORS))})')
    return GENERATORS[kind](grid, key, Fr(bpb), dict(opts))


def _chords(grid, bpb):
    """Flatten the grid → [(abs_start, length, chord)] in beats."""
    out = []
    for b, row in enumerate(grid):
        for s, ln, ch in row:
            out.append((bpb * b + s, ln, ch))
    return out


def _n(start, dur, pitches, vel, gate=None, names=()):
    return Note(Fr(start), Fr(dur), tuple(pitches), int(max(1, min(127, vel))), gate, False, False, False, tuple(names))


# --------------------------------------------------------------------------------------------- bass
def _bass_range(o):
    return o.get('low', 33), o.get('high', 52)


@generator('bass:root')
def bass_root(grid, key, bpb, o):
    lo, hi = _bass_range(o)
    v = o.get('vel', 100)
    return [_n(s, ln, [bass_note(c.bass, lo, hi)], v, 0.92) for s, ln, c in _chords(grid, bpb)]


@generator('bass:pedal')
def bass_pedal(grid, key, bpb, o):
    lo, hi = _bass_range(o)
    v = o.get('vel', 96)
    root = bass_note(key.tonic, lo, hi)
    total = bpb * len(grid)
    out, t = [], Fr(0)
    while t < total:
        out.append(_n(t, Fr(1, 2), [root], v - (0 if t % 1 == 0 else 14), 0.7))
        t += Fr(1, 2)
    return out


@generator('bass:root5')
def bass_root5(grid, key, bpb, o):
    lo, hi = _bass_range(o)
    v = o.get('vel', 100)
    out = []
    for s, ln, c in _chords(grid, bpb):
        r = bass_note(c.bass, lo, hi)
        if ln >= 2:
            half = ln / 2
            f = bass_note(c.fifth, lo, hi)
            out += [_n(s, half, [r], v, 0.85), _n(s + half, half, [f], v - 10, 0.85)]
        else:
            out.append(_n(s, ln, [r], v, 0.85))
    return out


@generator('bass:octaves')
def bass_octaves(grid, key, bpb, o):
    lo, hi = _bass_range(o)
    v = o.get('vel', 100)
    out = []
    for s, ln, c in _chords(grid, bpb):
        r = bass_note(c.bass, lo, hi)
        t, i = s, 0
        while t < s + ln:
            out.append(_n(t, Fr(1, 2), [r + (12 if i % 2 else 0)], v - (8 if i % 2 else 0), 0.6))
            t += Fr(1, 2)
            i += 1
    return out


@generator('bass:sync')
def bass_sync(grid, key, bpb, o):
    """Toby-ish syncopated bass: root, ghost, octave pop on 2&, fifth, root, chromatic approach."""
    lo, hi = _bass_range(o)
    v = o.get('vel', 104)
    chords = _chords(grid, bpb)
    out = []
    for i, (s, ln, c) in enumerate(chords):
        r = bass_note(c.bass, lo, hi)
        f = r + 7 if r + 7 <= hi + 5 else r - 5
        nxt = chords[(i + 1) % len(chords)][2]
        nr = bass_note(nxt.bass, lo, hi)
        appr = nr - 1 if (i % 2 == 0) else nr + 1
        if ln >= 4:
            pat = [(0, Fr(1, 2), r, 0, 0.8), (Fr(3, 4), Fr(1, 4), r, -28, 0.6), (Fr(3, 2), Fr(1, 2), r + 12, -6, 0.5),
                   (Fr(5, 2), Fr(1, 2), f, -10, 0.7), (3, Fr(1, 2), r, -4, 0.7), (Fr(7, 2), Fr(1, 2), appr, -12, 0.8)]
        elif ln >= 2:
            pat = [(0, Fr(1, 2), r, 0, 0.8), (Fr(3, 4), Fr(1, 4), r + 12, -10, 0.5), (Fr(3, 2), Fr(1, 2), appr, -12, 0.8)]
            if ln > 2:
                pat.append((2, ln - 2, f, -10, 0.7))
        else:
            pat = [(0, ln, r, 0, 0.8)]
        for off, d, p, dv, g in pat:
            if off < ln:
                out.append(_n(s + off, min(d, ln - off), [p], v + dv, g))
    return out


@generator('bass:walking')
def bass_walking(grid, key, bpb, o):
    lo, hi = _bass_range(o)
    v = o.get('vel', 98)
    chords = _chords(grid, bpb)
    out = []
    for i, (s, ln, c) in enumerate(chords):
        nxt = chords[(i + 1) % len(chords)][2]
        nr = bass_note(nxt.bass, lo, hi)
        r = bass_note(c.bass, lo, hi)
        tones = [r, bass_note(c.third, r, r + 12), bass_note(c.fifth, r, r + 12)]
        beats = int(ln)
        line = []
        for b in range(beats):
            if b == 0:
                line.append(r)
            elif b == beats - 1:
                line.append(nr - 1 if nr - 1 > lo else nr + 1)
            else:
                line.append(tones[b % 3] if b % 2 else tones[(b + 1) % 3])
        for b, p in enumerate(line):
            out.append(_n(s + b, 1, [p], v - (6 if b % 2 else 0), 0.9))
        if ln - beats:
            out.append(_n(s + beats, ln - beats, [r], v - 10, 0.8))
    return out


# --------------------------------------------------------------------------------------------- comping
def _voices(grid, bpb, o):
    lo, hi = o.get('low', 53), o.get('high', 74)
    style = o.get('voicing', 'close')
    prev, out = None, []
    for s, ln, c in _chords(grid, bpb):
        vs = voice(c, lo, hi, style, prev)
        prev = vs
        out.append((s, ln, c, vs))
    return out


@generator('pad:sustain')
def pad_sustain(grid, key, bpb, o):
    v = o.get('vel', 72)
    return [_n(s, ln, vs, v, 1.0) for s, ln, c, vs in _voices(grid, bpb, o)]


def _hits(grid, bpb, o, pattern, gate, accent=0):
    """pattern: [(offset_in_bar, length, vel_delta)] repeated per bar, using the chord sounding there."""
    v = o.get('vel', 80)
    vc = _voices(grid, bpb, o)
    out = []
    bars = len(grid)
    for b in range(bars):
        for off, d, dv in pattern:
            if off >= bpb:
                continue
            t = bpb * b + off
            cur = next((x for x in reversed(vc) if x[0] <= t), vc[0])
            out.append(_n(t, d, cur[3], v + dv, gate))
    return out


@generator('comp:offbeat')
def comp_offbeat(grid, key, bpb, o):
    pat = [(Fr(i) + Fr(1, 2), Fr(1, 2), -4 if i % 2 else 0) for i in range(int(bpb))]
    return _hits(grid, bpb, o, pat, 0.45)


@generator('comp:quarters')
def comp_quarters(grid, key, bpb, o):
    pat = [(Fr(i), Fr(1), -8 if i % 2 else 0) for i in range(int(bpb))]
    return _hits(grid, bpb, o, pat, 0.55)


@generator('comp:charleston')
def comp_charleston(grid, key, bpb, o):
    pat = [(0, Fr(3, 2), 0), (Fr(3, 2), Fr(1, 2), -6)]
    if bpb >= 4:
        pat += [(Fr(5, 2), Fr(1, 2), -14)]
    return _hits(grid, bpb, o, pat, 0.42)


@generator('comp:bossa')
def comp_bossa(grid, key, bpb, o):
    pat = [(0, Fr(3, 4), 0), (Fr(3, 2), Fr(1, 2), -8), (Fr(5, 2), Fr(1, 2), -4), (Fr(7, 2), Fr(1, 2), -10)]
    return _hits(grid, bpb, o, pat, 0.6)


@generator('comp:stabs')
def comp_stabs(grid, key, bpb, o):
    pat = [(0, Fr(1, 2), 8), (Fr(3, 2), Fr(1, 2), 0)]
    if bpb >= 4:
        pat.append((Fr(7, 2), Fr(1, 2), -2))
    return _hits(grid, bpb, o, pat, 0.32)


# --------------------------------------------------------------------------------------------- arps
def _arp(grid, bpb, o, step, order_fn, gate):
    v = o.get('vel', 76)
    out = []
    for s, ln, c, vs in _voices(grid, bpb, o):
        seq = order_fn(vs)
        t, i = s, 0
        while t < s + ln - Fr(1, 1000):
            out.append(_n(t, step, [seq[i % len(seq)]], v - (0 if i % 4 == 0 else 10), gate))
            t += step
            i += 1
    return out


@generator('arp:up16')
def arp_up16(grid, key, bpb, o):
    return _arp(grid, bpb, o, Fr(1, 4), lambda vs: vs + [vs[0] + 12], 0.8)


@generator('arp:updown8')
def arp_updown8(grid, key, bpb, o):
    return _arp(grid, bpb, o, Fr(1, 2), lambda vs: vs + vs[-2:0:-1] if len(vs) > 2 else vs, 0.85)


@generator('chip:arp32')
def chip_arp32(grid, key, bpb, o):
    """NES one-voice chord: cycle the triad tones every 32nd note (legato)."""
    return _arp(grid, bpb, o, Fr(1, 8), lambda vs: vs[:3], 1.0)


# --------------------------------------------------------------------------------------------- drums
D = DRUM_NAMES


def _dn(t, d, names, vel):
    return _n(t, d, [D[x] for x in names], vel, 0.5, names)


DRUM_STYLES = {
    # per 4/4 bar: list of (beat, names, vel)
    'straight': [(0, ('k', 'h'), 110), (0.5, ('h',), 70), (1, ('s', 'h'), 104), (1.5, ('h',), 70),
                 (2, ('k', 'h'), 104), (2.5, ('k', 'h'), 80), (3, ('s', 'h'), 106), (3.5, ('h',), 72)],
    'four': [(0, ('k', 'h'), 112), (0.5, ('o',), 70), (1, ('k', 's'), 104), (1.5, ('o',), 70),
             (2, ('k', 'h'), 108), (2.5, ('o',), 70), (3, ('k', 's'), 106), (3.5, ('o',), 72)],
    'shuffle': [(0, ('k', 'rd'), 108), (2 / 3, ('rd',), 64), (1, ('s', 'rd'), 96), (5 / 3, ('rd',), 64),
                (2, ('k', 'rd'), 100), (8 / 3, ('rd', 'k'), 70), (3, ('s', 'rd'), 100), (11 / 3, ('rd',), 66)],
    'halftime': [(0, ('k', 'h'), 110), (0.5, ('h',), 66), (1, ('h',), 76), (1.5, ('h', 'k'), 70),
                 (2, ('s', 'h'), 110), (2.5, ('h',), 66), (3, ('h',), 76), (3.5, ('h',), 64)],
    'march': [(0, ('k', 's'), 108), (0.5, ('s',), 60), (0.75, ('s',), 56), (1, ('s',), 92), (1.5, ('s',), 60),
              (2, ('k', 's'), 104), (2.5, ('s',), 60), (2.75, ('s',), 58), (3, ('s',), 96), (3.5, ('s',), 70), (3.75, ('s',), 64)],
    'taiko': [(0, ('tk',), 118), (0.75, ('tk',), 80), (1.5, ('t3',), 96), (2, ('tk',), 110),
              (2.5, ('t3',), 84), (3, ('tk', 'cl'), 100), (3.5, ('t2',), 90)],
    'bossa': [(0, ('k', 'rs', 'h'), 100), (0.5, ('h',), 64), (1, ('rs', 'h'), 76), (1.5, ('k', 'h'), 84),
              (2, ('k', 'h'), 96), (2.5, ('rs', 'h'), 74), (3, ('h',), 66), (3.5, ('k', 'rs', 'h'), 84)],
}
FILLS = {
    4: [(2, ('s',), 96), (2.5, ('s',), 84), (3, ('t1',), 100), (3.5, ('t2',), 104)],
    8: [(2, ('s',), 100), (2.25, ('s',), 80), (2.5, ('s',), 92), (2.75, ('s',), 96), (3, ('t1',), 104),
        (3.25, ('t1',), 96), (3.5, ('t2',), 106), (3.75, ('t3',), 110)],
}


@generator('drums:straight')
def drums_straight(grid, key, bpb, o):
    return _drums(grid, bpb, o, o.get('style', 'straight'))


for _style in DRUM_STYLES:
    GENERATORS[f'drums:{_style}'] = (lambda st: (lambda grid, key, bpb, o: _drums(grid, bpb, o, st)))(_style)


def _drums(grid, bpb, o, style):
    pat = DRUM_STYLES[style]
    vel = o.get('vel', 0)
    fills = o.get('fills', True)
    crash = o.get('crash', True)
    scale = Fr(bpb) / 4
    out = []
    bars = len(grid)
    for b in range(bars):
        t0 = bpb * b
        n = b + 1
        fill = None
        if fills and bpb == 4:
            if n % 8 == 0 or n == bars:
                fill = FILLS[8]
            elif n % 4 == 0:
                fill = FILLS[4]
        for beat, names, v in pat:
            bt = Fr(beat).limit_denominator(12) * scale
            if bt >= bpb or (fill and bt >= 2):
                continue
            nm = names
            if b == 0 and bt == 0 and crash:
                nm = tuple(x for x in names if x not in ('h', 'o', 'rd')) + ('c',)
            out.append(_dn(t0 + bt, Fr(1, 4), nm, v + vel))
        if fill:
            for beat, names, v in fill:
                out.append(_dn(t0 + Fr(beat).limit_denominator(12), Fr(1, 4), names, v + vel))
    return out
