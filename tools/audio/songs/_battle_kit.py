"""Helpers for the battle-side song files (battle_*, boss, battle_stings). Composer B.

The file name starts with '_' so `song.discover()` does not treat it as a song.

    tr('c5/8 f5/8 [a4 c5]/4', 3)        → 'eb5/8 ab5/8 [c5 eb5]/4'   (melodic strings only)
    bars('c5/1', 'd5/1')                → 'c5/1 | d5/1'
    roll('s', '16', 8, 50, 110)         → 's/16@v50 s@v59 … s@v110'  (a written-out crescendo roll)
    MAIN_A / MAIN_B                     the main theme bars 1-8 / 9-16 in F (docs/AUDIO.md §4.3), one string per bar
"""
from __future__ import annotations

import re

from sakura_audio.theory import pitch, name_of

_PITCH = re.compile(r'(?<![a-z@])([a-g](?:#|b)?)(-?\d)(?!\d)')


def tr(text: str, semis: int, flats: bool = True) -> str:
    """Transpose every pitch in a melodic note string by `semis` semitones."""
    return _PITCH.sub(lambda m: name_of(pitch(m.group(1) + m.group(2)) + semis, flats), text)


def bars(*items: str) -> str:
    return ' | '.join(x.strip().strip('|').strip() for x in items)


def roll(note: str, dur: str, count: int, v0: int, v1: int) -> str:
    out = []
    for i in range(count):
        v = round(v0 + (v1 - v0) * i / max(1, count - 1))
        out.append(f'{note}/{dur}@v{v}' if i == 0 else f'{note}@v{v}')
    return ' '.join(out)


# The main theme (docs/AUDIO.md §4.3), F major, chip-lead octave. Same notes as songs/title.py.
MAIN_A = [
    'c5/8 f5/8 d5/4 e5/4. f5/8',             # 1  Fmaj7      ⟨BELL⟩
    'a5/4 g5/8 f5/8 e5/4 d5/4',              # 2  Dm9
    'c5/8 f5/8 d5/4 e5/8 f5/8 g5/4',         # 3  B♭maj7     ⟨BELL⟩
    'a5/4. g5/8 c5/2',                       # 4  C7sus4 C7
    'c5/8 f5/8 d5/4 e5/4 c6/4',              # 5  Am7        ⟨BELL⟩
    'a5/8 bb5/8 a5/8 f#5/8 eb5/4 d5/4',      # 6  D7♭9
    'g5/4 bb5/8 a5/8 g5/8 f5/8 db5/4',       # 7  Gm9 B♭m6
    'c5/4. d5/8 e5/4 g5/4',                  # 8  F/C C7
]
MAIN_B = [
    'ab5/8 f5/8 c6/4 bb5/8 ab5/8 f5/4',      # 9  D♭maj7
    'bb5/8 g5/8 d6/4 c6/8 bb5/8 g5/4',       # 10 E♭maj9
    'a5/4 c6/4 eb6/4 d6/8 c6/8',             # 11 Fmaj7 F7/A
    'd6/4. c6/8 f5/8 ab5/8 b5/4',            # 12 B♭maj7 B°7
    'c6/4 a5/8 g5/8 f#5/8 a5/8 c6/4',        # 13 F/C D7
    'bb5/4. a5/8 g5/8 e5/8 c5/4',            # 14 Gm7 C7
    'e5/4 c5/8 a4/8 b4/8 d5/8 f5/4',         # 15 Am7 A♭°7
    'e5/2 d5/8 db5/8 c5/8 g4/8',             # 16 Gm13 C7♭9
]
MAIN_A_CHORDS = 'Fmaj7 | Dm9 | Bbmaj7 | C7sus4 C7 | Am7 | D7b9 | Gm9 Bbm6 | F/C C7'
MAIN_B_CHORDS = 'Dbmaj7 | Ebmaj9 | Fmaj7 F7/A | Bbmaj7 Bdim7 | F/C D7 | Gm7 C7 | Am7 Abdim7 | Gm13 C7b9'


# ---------------------------------------------------------------------------------------------------------------
# Bass lines from chord symbols, with real movement (fifths, octave pops, sevenths, chromatic approach notes).
_DEG = re.compile(r'^(ap|au|R|3|5|7|8|9|r)(.*)$')


def walk(chords: str, full: str, half: str | None = None, low: int = 40, nxt: str | None = None,
         flats: bool = True) -> str:
    """Bass line for a chord grid ('Am9 | Fmaj7 | Dm9 G7 | …').

    `full` is the pattern for a bar with one chord, `half` the pattern for each chord of a two-chord bar.
    Pattern tokens are a degree + a DSL duration/modifiers: R (root, or the slash bass), 3, 5, 7 (the chord's
    seventh, else the octave), 8 (octave), 9, ap / au (a half step below / above the next chord's bass),
    r (rest) — e.g. 'R/4. 5/8 8/4 7/8 ap/8'. Roots sit in [low, low+11]. `nxt` = the chord after the grid
    (for the last approach note; default: the grid's first chord, i.e. a loop)."""
    from sakura_audio.theory import parse_grid, parse_chord
    cells = [c.strip() for c in chords.strip().strip('|').split('|')]
    grid = parse_grid(chords, len(cells), 4)
    flat = [c for row in grid for (_, _, c) in row]
    after = parse_chord(nxt) if nxt else flat[0]

    def root_of(ch):
        n = low
        while n % 12 != ch.bass:
            n += 1
        return n

    out, k = [], 0
    for row in grid:
        bar = []
        for _, _, ch in row:
            pat = full if len(row) == 1 else (half or full)
            r = root_of(ch)
            nx = flat[k + 1] if k + 1 < len(flat) else after
            k += 1
            nr = root_of(nx)          # approach notes lead into the next bar's actual root
            sev = next((i for i in ch.intervals if i in (9, 10, 11) and len(ch.intervals) > 3 or i in (10, 11)), 12)
            third = next((i for i in ch.intervals if i in (3, 4)), 5 if 5 in ch.intervals else 4)
            fifth = next((i for i in ch.intervals if i in (6, 7, 8)), 7)
            if ch.bass != ch.root:      # slash chord: degrees from the written root, root token = bass note
                base = r - ((ch.bass - ch.root) % 12)
            else:
                base = r
            for tok in pat.split():
                m = _DEG.match(tok)
                if not m:
                    raise ValueError(f'walk(): bad token {tok!r}')
                d, rest = m.groups()
                if d == 'r':
                    bar.append('r' + rest)
                    continue
                p = {'R': r, '3': base + third, '5': base + fifth, '7': base + sev, '8': r + 12, '9': base + 14,
                     'ap': nr - 1, 'au': nr + 1}[d]
                bar.append(name_of(p, flats) + rest)
        out.append(' '.join(bar))
    return ' | '.join(out)
