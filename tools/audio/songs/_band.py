"""Helpers for the band battle families: battle_moonlit (Celtic jig-rock), battle_lantern (spooky eleki surf) and
battle_matsuri (J-rock). Batch B3, audio r3.

The file name starts with '_' so `song.discover()` does not treat it as a song. Everything returns plain DSL note
strings, so the song files stay readable and the busy / originality tools see ordinary parts. Unlike _tek.py (straight
16ths) these work on any grid, triplets included: positions and lengths are beats (Fractions, ints or 'a/b' strings).

    line(chords, full, half, low=38)     bass / riff line from a chord grid; tokens are a degree + a DSL duration:
                                         R 3 5 7 (chord-aware) · b2 2 b3 4 b5 b6 6 b7 8 9 (from the root)
                                         · ap / au (a semitone under / over the NEXT chord's bass), ax (the
                                         one of the two nearer to the previous note) · r (rest)
                                         · '^' / 'v' after the degree = up / down an octave,
                                         e.g. jig pump 'R/4t 8/8t R/4t 8/8t 5/4t 7/8t 3/8t 5/8t ap/8t'
    hits(chords, slots, low, high)       chord stabs at beat positions of every bar (the chord sounding there,
                                         voice-led): slots = [(start, length, mods)], e.g. 1, 2-a, 4-a in a jig =
                                         [(0, '1/3', '!'), ('5/3', '1/3', ''), ('11/3', '1/3', '')]
    power(chords, slots, low=40)         guitar power chords (root, fifth, octave) on the same kind of slots
    ripple(chords, low, high, per_beat)  harp 'ripples': per beat `per_beat` chord tones up (odd beats) and down
    trem(text)                           surf tremolo picking: every note of a skeleton line becomes repeated 16ths;
                                         a note marked '=' (e.g. 'e5/4=') is picked once and left to ring
    bars(…) / rest(n)                    small string helpers
"""
from __future__ import annotations

import re
from fractions import Fraction as Fr

from sakura_audio.theory import parse_grid, parse_chord, voice, name_of
from sakura_audio.notation import parse_duration

_TOK = re.compile(r'^(ap|au|ax|r|R|b2|2|b3|3|4|b5|5|b6|6|b7|7|8|9)([\^v]*)(/.*)$')
_FIXED = {'b2': 1, '2': 2, 'b3': 3, '4': 5, 'b5': 6, 'b6': 8, '6': 9, 'b7': 10, '8': 12, '9': 14}
# beat lengths → DSL durations (largest first, used to spell rests)
_DUR = [(Fr(4), '1'), (Fr(3), '2.'), (Fr(2), '2'), (Fr(3, 2), '4.'), (Fr(4, 3), '2t'), (Fr(1), '4'), (Fr(3, 4), '8.'),
        (Fr(2, 3), '4t'), (Fr(1, 2), '8'), (Fr(3, 8), '16.'), (Fr(1, 3), '8t'), (Fr(1, 4), '16'), (Fr(1, 6), '16t'),
        (Fr(1, 8), '32'), (Fr(1, 12), '32t')]
_NAME = {d: s for d, s in _DUR}


def bars(*items: str) -> str:
    return ' | '.join(x.strip().strip('|').strip() for x in items)


def rest(n: int = 1) -> str:
    return ' | '.join(['r/1'] * n)


def _fr(x) -> Fr:
    if isinstance(x, Fr):
        return x
    if isinstance(x, str):
        return Fr(x)
    return Fr(x).limit_denominator(48)


def _grid(chords: str, bpb=4):
    cells = [c.strip() for c in chords.strip().strip('|').split('|')]
    return parse_grid(chords, len(cells), bpb)


def _root_in(pc_: int, low: int) -> int:
    n = low
    while n % 12 != pc_:
        n += 1
    return n


def line(chords: str, full, half: str | None = None, low: int = 38, nxt: str | None = None, flats: bool = True) -> str:
    """A bass / riff line over a chord grid. `full` = the pattern of a one-chord bar (or a list, used bar by bar in
    turn), `half` = the pattern for each chord of a two-chord bar. Roots sit in [low, low+11]."""
    grid = _grid(chords)
    flat = [c for row in grid for (_, _, c) in row]
    after = parse_chord(nxt) if nxt else flat[0]
    fulls = full if isinstance(full, list) else [full]
    out, k, last = [], 0, None
    for b, row in enumerate(grid):
        toks = []
        for _, _, ch in row:
            pat = fulls[b % len(fulls)] if len(row) == 1 else (half or fulls[0])
            nx = flat[k + 1] if k + 1 < len(flat) else after
            k += 1
            r = _root_in(ch.bass, low)
            base = r - ((ch.bass - ch.root) % 12)            # slash chord: degrees from the written root
            nr = _root_in(nx.bass, low)
            third = next((i for i in ch.intervals if i in (3, 4)), 5 if 5 in ch.intervals else 4)
            fifth = next((i for i in ch.intervals if i in (6, 7, 8)), 7)
            sev = next((i for i in ch.intervals if i in (10, 11)), 10)
            for tok in pat.split():
                m = _TOK.match(tok)
                if not m:
                    raise ValueError(f'line(): bad token {tok!r}')
                d, octs, rest_ = m.groups()
                if d == 'r':
                    toks.append('r' + rest_)
                    continue
                p = {'R': r, '3': base + third, '5': base + fifth, '7': base + sev, 'ap': nr - 1,
                     'au': nr + 1}.get(d)
                if d == 'ax':
                    p = nr - 1 if last is None or abs(last - (nr - 1)) <= abs(last - (nr + 1)) else nr + 1
                if p is None:
                    p = base + _FIXED[d]
                p += 12 * (octs.count('^') - octs.count('v'))
                toks.append(name_of(p, flats) + rest_)
                last = p
        out.append(' '.join(toks))
    return ' | '.join(out)


def _spell(gap: Fr) -> list:
    out = []
    while gap > 0:
        d, s = next((d, s) for d, s in _DUR if d <= gap)
        out.append(f'r/{s}')
        gap -= d
    return out


def fill(events: list, total=4) -> str:
    """events = [(start, length, 'pitch text', 'mods')] inside one bar (beats) → DSL with the rests spelled out."""
    out, t = [], Fr(0)
    for st, ln, txt, mods in sorted(events, key=lambda e: _fr(e[0])):
        st, ln = _fr(st), _fr(ln)
        if st < t:
            raise ValueError(f'fill(): overlapping events at beat {st}')
        out += _spell(st - t)
        if ln not in _NAME:
            raise ValueError(f'fill(): length {ln} beats has no single DSL duration')
        out.append(f'{txt}/{_NAME[ln]}{mods}')
        t = st + ln
    out += _spell(_fr(total) - t)
    return ' '.join(out)


def _chord_at(row, t):
    return next(c for st, l, c in reversed(row) if st <= t)


def hits(chords: str, slots, low: int = 55, high: int = 69, style: str = 'rootless', per_bar: dict | None = None,
         flats: bool = True) -> str:
    """Chord stabs at beat positions: `slots` = [(start, length, mods)] every bar unless `per_bar` = {bar (1-based):
    slots} overrides a bar ([] = an empty bar). Voices are led from chord to chord."""
    grid = _grid(chords)
    prev, out = None, []
    for b, row in enumerate(grid):
        cell = (per_bar or {}).get(b + 1, slots)
        ev = []
        for st, ln, mods in cell:
            ch = _chord_at(row, _fr(st))
            vs = voice(ch, low, high, style, prev)
            prev = vs
            ev.append((st, ln, '[' + ' '.join(name_of(p, flats) for p in vs) + ']', mods))
        out.append(fill(ev) if ev else 'r/1')
    return ' | '.join(out)


def power(chords: str, slots, low: int = 40, per_bar: dict | None = None, octave: bool = True,
          flats: bool = True) -> str:
    """Guitar power chords (root + fifth [+ octave]) on beat slots, root in [low, low+11]."""
    grid = _grid(chords)
    out = []
    for b, row in enumerate(grid):
        cell = (per_bar or {}).get(b + 1, slots)
        ev = []
        for st, ln, mods in cell:
            ch = _chord_at(row, _fr(st))
            r = _root_in(ch.bass if ch.bass == ch.root else ch.root, low)
            ps = [r, r + 7] + ([r + 12] if octave else [])
            ev.append((st, ln, '[' + ' '.join(name_of(p, flats) for p in ps) + ']', mods))
        out.append(fill(ev) if ev else 'r/1')
    return ' | '.join(out)


def ripple(chords: str, low: int = 57, high: int = 79, per_beat: int = 3, vel=(78, 58), mute_bars=(),
           start: int = 0, flats: bool = True) -> str:
    """Harp 'ripples': `per_beat` notes a beat (3 = triplet 8ths, 4 = 16ths) running up and down a wave through every
    chord tone in [low, high] (the wave restarts from `start` each bar and keeps its place across a chord change),
    the first note of each beat accented (velocities `vel` = (accent, other))."""
    grid = _grid(chords)
    step = Fr(1, per_beat)
    dur = _NAME[step]
    out = []
    for b, row in enumerate(grid):
        if (b + 1) in mute_bars:
            out.append('r/1')
            continue
        toks, idx, d = [], start, 1
        for k in range(4 * per_beat):
            ch = _chord_at(row, step * k)
            pool = [p for p in range(low, high + 1) if p % 12 in ch.tones]
            idx = max(0, min(idx, len(pool) - 1))
            toks.append(f'{name_of(pool[idx], flats)}/{dur}@v{vel[0] if k % per_beat == 0 else vel[1]}')
            if not 0 <= idx + d < len(pool):
                d = -d
            idx += d
        out.append(' '.join(toks))
    return ' | '.join(out)


_NOTE = re.compile(r"^([a-g](?:#|b)?-?\d|\[[^\]]*\])(/\d+\.{0,2}t?)?([~!?'_^*@v\d]*)(=?)$")


def trem(text: str, unit: str = '16') -> str:
    """Surf tremolo: every note of a skeleton line (explicit durations) becomes repeated `unit` notes; '=' after a
    note keeps it as one pick. Rests, bar lines and notes shorter than two picks pass through."""
    u = parse_duration('/' + unit)[0]
    out = []
    for tok in text.split():
        if tok == '|' or tok.startswith('r/') or tok == 'r':
            out.append(tok)
            continue
        m = _NOTE.match(tok)
        if not m:
            raise ValueError(f'trem(): cannot read {tok!r}')
        head, dur, mods, keep = m.groups()
        if not dur:
            raise ValueError(f'trem(): {tok!r} needs an explicit duration')
        d = parse_duration(dur)[0]
        n = d / u
        if keep or n.denominator != 1 or n < 2:
            out.append(head + dur + mods)
            continue
        out.append(f'{head}/{unit}{mods.replace("~", "")}')
        out += [f'{head}/{unit}'] * (int(n) - 1)
    return ' '.join(out)
