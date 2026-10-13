"""Small helpers for the "home side" song files (title, homeroom, march, wishing, mall, jingles, gacha).

The file name starts with '_' so `song.discover()` does not treat it as a song.

    tr('c5/8 f5/8 [a4 c5]/4', 3)  → 'eb5/8 ab5/8 [c5 eb5]/4'     (melodic strings only: drum names like c2 would move)
    bars('c5/1', 'd5/1')          → 'c5/1 | d5/1'
"""
from __future__ import annotations

import re

from sakura_audio.theory import pitch, name_of

_PITCH = re.compile(r'(?<![a-z@])([a-g](?:#|b)?)(-?\d)(?!\d)')


def tr(text: str, semis: int, flats: bool = True) -> str:
    """Transpose every pitch in a melodic note string by `semis` semitones (durations and modifiers untouched)."""
    def sub(m):
        return name_of(pitch(m.group(1) + m.group(2)) + semis, flats)
    return _PITCH.sub(sub, text)


def bars(*items: str) -> str:
    """Join bar strings with bar lines."""
    return ' | '.join(x.strip().strip('|').strip() for x in items)


def crescendo(note: str, dur: str, count: int, v0: int, v1: int) -> str:
    """A written-out roll: `count` repeats of `note` with velocity ramping v0 → v1 (e.g. a snare or timpani roll)."""
    out = []
    for i in range(count):
        v = round(v0 + (v1 - v0) * i / max(1, count - 1))
        out.append(f'{note}/{dur}@v{v}' if i == 0 else f'{note}@v{v}')
    return ' '.join(out)


def _grid(chords: str, nbars: int, bpb=4):
    from sakura_audio.theory import parse_grid
    return parse_grid(chords, nbars, bpb)


def _chord_at(grid, bar: int, beat):
    row = grid[bar]
    cur = row[0][2]
    for st, ln, ch in row:
        if st <= beat:
            cur = ch
    return cur


def afterbeats(chords: str, nbars: int, low=55, high=70, beats=(1, 3), dur='4', style='close', flats=True) -> str:
    """March 'pah' chords on the given beats (0-based) of every bar, voiced from the chord symbols."""
    from fractions import Fraction as Fr
    from sakura_audio.theory import voice, name_of
    grid = _grid(chords, nbars)
    out, prev = [], None
    step = Fr(4, int(dur))
    for b in range(nbars):
        toks, t = [], Fr(0)
        for beat in beats:
            beat = Fr(beat)
            if beat > t:
                toks.append(f'r/{_dur(beat - t)}')
            vs = voice(_chord_at(grid, b, beat), low, high, style, prev)
            prev = vs
            toks.append('[' + ' '.join(name_of(p, flats) for p in vs) + f']/{dur}')
            t = beat + step
        if t < 4:
            toks.append(f'r/{_dur(4 - t)}')
        out.append(' '.join(toks))
    return ' | '.join(out)


def _dur(beats) -> str:
    from fractions import Fraction as Fr
    table = {Fr(4): '1', Fr(3): '2.', Fr(2): '2', Fr(3, 2): '4.', Fr(1): '4', Fr(3, 4): '8.', Fr(1, 2): '8', Fr(1, 4): '16'}
    if Fr(beats) in table:
        return table[Fr(beats)]
    raise ValueError(f'no single duration for {beats} beats')


def oompah(chords: str, nbars: int, low=34, high=50, flats=True) -> str:
    """Tuba/bass 'oom': root on beat 1, fifth (or the second chord's root) on beat 3."""
    from sakura_audio.theory import bass_note, name_of
    grid = _grid(chords, nbars)
    out = []
    for b in range(nbars):
        c1 = _chord_at(grid, b, 0)
        c2 = _chord_at(grid, b, 2)
        n1 = bass_note(c1.bass, low, high)
        n2 = bass_note(c2.bass, low, high) if c2 is not c1 else bass_note(c1.fifth, low, high)
        out.append(f'{name_of(n1, flats)}/4 r/4 {name_of(n2, flats)}/4 r/4')
    return ' | '.join(out)
