"""Helpers for the round-3 SWEET lane (B4: wishing, results_win, results_lose, sweet jingles). Composer B4.

The file name starts with '_' so `song.discover()` does not treat it as a song. Nothing here is used by other
batches; the round-2 helpers (_home.py, _battle_kit.py, motifs.py) are untouched.

    line(chords, pats, halves=None, low=33)    bass line text from chord symbols and degree patterns
    chordify(chords, rhythm, low, high, ...)   a rhythm of 'x' tokens → chord hits voiced from the chord grid
    arp(chords, shape, low, high, step='16')   broken-chord arpeggio (any shape over the voicing, any step)
    gliss(chord, lo, hi, n, dur='32')          chord-tone glissando (harp) from lo up to hi (or down)

All of them return DSL note strings (bars joined by ' | '), so the song files stay readable and the bar validator
checks every bar.
"""
from __future__ import annotations

import re
from fractions import Fraction as Fr

from sakura_audio.theory import parse_grid, parse_chord, name_of, voice

_DEG = re.compile(r'^(ap|au|a2|R|2|3|4|5|6|7|8|9|10|b3|b5|b6|b7|-1|-2|-5|r)(.*)$')
_DUR = re.compile(r'/(\d+)(\.{0,2})(t?)')


def _len(tok: str) -> Fr:
    m = _DUR.search(tok)
    if not m:
        raise ValueError(f'_sweet: token {tok!r} needs an explicit duration')
    d = Fr(4, int(m.group(1)))
    if m.group(2) == '.':
        d *= Fr(3, 2)
    elif m.group(2) == '..':
        d *= Fr(7, 4)
    if m.group(3):
        d *= Fr(2, 3)
    return d


def grid(chords: str, bpb: int = 4):
    cells = [c.strip() for c in chords.strip().strip('|').split('|')]
    return parse_grid(chords, len(cells), bpb)


def chord_at(g, t, bpb: int = 4):
    """Chord sounding at beat `t` (section-relative) of grid `g`."""
    b = min(max(int(t // bpb), 0), len(g) - 1)
    off = t - bpb * b
    cur = g[b][0][2]
    for st, ln, ch in g[b]:
        if st <= off:
            cur = ch
    return cur


def _pick(src, i):
    if isinstance(src, dict):
        return src.get(i + 1, src.get(0))
    if isinstance(src, (list, tuple)):
        return src[i % len(src)]
    return src


# --------------------------------------------------------------------------------------------- bass lines
def line(chords: str, pats, halves=None, low: int = 33, nxt: str | None = None, flats: bool = False,
         bpb: int = 4) -> str:
    """Bass line text for a chord grid. `pats` is the pattern of one-chord bars, `halves` the pattern of each chord
    in a two-chord bar (str, list cycling per bar / per half, or dict 1-based bar → pattern, key 0 = default).

    Degrees from the chord's bass note: R 2 3 4 5 6 7 8 9 10 b3 b5 b6 b7 (3 / 7 follow the chord quality, 8 = octave,
    10 = octave + third), -1 -2 -5 (a semitone / tone / fifth under the root), ap / au / a2 (a semitone below /
    a semitone above / a tone below the NEXT chord's bass), r (rest). Roots sit in [low, low + 11]."""
    g = grid(chords, bpb)
    flat = [c for row in g for (_, _, c) in row]
    after = parse_chord(nxt) if nxt else flat[0]

    def root_of(p):
        n = low
        while n % 12 != p:
            n += 1
        return n

    out, k, hk = [], 0, 0
    for bi, row in enumerate(g):
        toks = []
        for _, _, ch in row:
            if len(row) == 1:
                pat = _pick(pats, bi)
            else:
                pat = _pick(halves if halves is not None else pats, hk)
                hk += 1
            r = root_of(ch.bass)
            nx = flat[k + 1] if k + 1 < len(flat) else after
            k += 1
            nr = root_of(nx.bass)
            base = r - ((ch.bass - ch.root) % 12)            # the chord root under a slash bass
            third = next((i for i in ch.intervals if i in (3, 4)), 4 if 5 not in ch.intervals else 5)
            fifth = next((i for i in ch.intervals if i in (6, 7, 8)), 7)
            sev = next((i for i in ch.intervals if i in (10, 11)), next((i for i in ch.intervals if i == 9), 10))
            six = 9 if 9 in ch.intervals or 21 in ch.intervals else (8 if 8 in ch.intervals else 9)
            sec = 2
            table = {'R': r, '2': base + sec, '3': base + third, '4': base + 5, '5': base + fifth, '6': base + six,
                     '7': base + sev, '8': r + 12, '9': base + 14, '10': base + 12 + third, 'b3': base + 3,
                     'b5': base + 6, 'b6': base + 8, 'b7': base + 10, '-1': r - 1, '-2': r - 2, '-5': r - 7,
                     'ap': nr - 1, 'au': nr + 1, 'a2': nr - 2}
            for tok in pat.split():
                m = _DEG.match(tok)
                if not m:
                    raise ValueError(f'line(): bad token {tok!r}')
                d, rest = m.groups()
                toks.append(('r' if d == 'r' else name_of(table[d], flats)) + rest)
        out.append(' '.join(toks))
    return ' | '.join(out)


# --------------------------------------------------------------------------------------------- chord hits
def chordify(chords: str, rhythm, low: int, high: int, style: str = 'close', flats: bool = False,
             bpb: int = 4, root_low: int = 33) -> str:
    """Chord hits on a rhythm. `rhythm` = one bar of tokens (str, list cycling per bar, dict 1-based bar → bar, key 0 =
    default). Tokens: x (the whole voicing), x1 / x2 / x3 (its top 1-3 notes), xl (its lowest note), R / F (the chord's
    bass / fifth in [root_low, root_low + 11]), r (rest); each with an explicit duration and any DSL modifiers, e.g.
    'x/8! r/8 x2/16? r/16'. Voicings come from theory.voice() inside [low, high] with voice leading."""
    g = grid(chords, bpb)
    prev, out = None, []
    tok_re = re.compile(r'^(x1|x2|x3|xl|x|R|F|r)(/.*)$')
    for bi in range(len(g)):
        bar = _pick(rhythm, bi)
        t, toks = Fr(0), []
        for tok in bar.split():
            m = tok_re.match(tok)
            if not m:
                raise ValueError(f'chordify(): bad token {tok!r}')
            kind, rest = m.groups()
            if kind == 'r':
                toks.append(tok)
            else:
                ch = chord_at(g, bpb * bi + t, bpb)
                if kind in ('R', 'F'):
                    p = ch.bass if kind == 'R' else ch.fifth
                    n = root_low
                    while n % 12 != p:
                        n += 1
                    toks.append(name_of(n, flats) + rest)
                else:
                    vs = voice(ch, low, high, style, prev)
                    prev = vs
                    sel = {'x': vs, 'x1': vs[-1:], 'x2': vs[-2:], 'x3': vs[-3:], 'xl': vs[:1]}[kind]
                    body = ' '.join(name_of(p, flats) for p in sel)
                    toks.append((f'[{body}]' if len(sel) > 1 else body) + rest)
            t += _len(tok)
        if t != bpb:
            raise ValueError(f'chordify(): bar {bi + 1} lasts {t} beats')
        out.append(' '.join(toks))
    return ' | '.join(out)


# --------------------------------------------------------------------------------------------- arpeggios
def arp(chords: str, shape, low: int, high: int, step: str = '16', style: str = 'close', flats: bool = False,
        accent: int = 0, ghost_every: int = 0, bpb: int = 4, top: int = 12, vels=None) -> str:
    """Broken-chord arpeggio. `shape` = indices into the chord's voicing plus its root `top` semitones up (index
    len(voicing)), cycled from every chord change (str of digits, list, or per-bar dict like `rhythm` in chordify).
    `step` is one DSL duration ('16', '8t', '8'). `vels` = list of velocities cycled per step (explicit @v), else
    the first note of every beat gets '!' when `accent`."""
    g = grid(chords, bpb)
    st = _len('x/' + step)
    prev, out = None, []
    for bi, row in enumerate(g):
        sh = _pick(shape, bi)
        sh = [int(c) for c in sh] if isinstance(sh, str) else list(sh)
        toks = []
        for cs, ln, ch in row:
            vs = voice(ch, low, high, style, prev)
            prev = vs
            pool = vs + [vs[0] + top]
            t, i = Fr(0), 0
            while t < ln:
                p = pool[sh[i % len(sh)] % len(pool)]
                mod = ''
                if vels:
                    mod = f'@v{vels[i % len(vels)]}'
                elif accent and (cs + t) % 1 == 0:
                    mod = '!'
                toks.append(f'{name_of(p, flats)}/{step}{mod}')
                t += st
                i += 1
        out.append(' '.join(toks))
    return ' | '.join(out)


def gliss(chord: str, lo: int, hi: int, n: int, dur: str = '32', flats: bool = False, down: bool = False) -> str:
    """`n` chord tones of `chord` from MIDI `lo` up to (at most) `hi` (or from `hi` down), each `dur` long."""
    ch = parse_chord(chord)
    tones = sorted({p for p in range(lo, hi + 1) if p % 12 in ch.tones})
    if len(tones) < n:
        raise ValueError(f'gliss(): only {len(tones)} tones of {chord} in [{lo}, {hi}]')
    sel = tones[:n] if not down else tones[::-1][:n]
    return ' '.join(f'{name_of(p, flats)}/{dur}' for p in sel)
