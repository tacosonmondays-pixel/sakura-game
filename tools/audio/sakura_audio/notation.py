"""Compact note strings → note events, with bar validation.

    c5/8   d#4/4.   bb5/16   r/2   [f4 a4 c5]/2      C4 = middle C (MIDI 60)
    durations  /1 /2 /4 /8 /16 /32 /64, '.' dotted ('..' double), 't' triplet (/8t)
               a token without a duration keeps the previous one
    ~          tie into the next note of the same pitch (also across bar lines)
    !  ?       accent (+20 velocity) / ghost (−30)       @v96  explicit velocity
    '  _       staccato (50 % length) / legato (105 %, overlaps for chip glides)
    ^          slide in from −2 semitones (pitch bend)   *  vibrato (mod wheel)
    |          bar line: every bar must add up to the meter, or parsing fails
    %          repeat the previous bar        ( … )x2  repeat a group
    drums      k s rs cl h ph o c rd t1 t2 t3 tb cb sh wb tri tk cg bg ag cv c2 sp ch
               (kick, snare, rimshot, clap, closed/pedal/open hat, crash, ride, toms, tambourine,
               cowbell, shaker, woodblock, triangle, taiko, conga, bongo, agogo, claves, crash 2,
               splash, china); k+c/4 = simultaneous; r is a rest in drum parts too.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field, replace
from fractions import Fraction as Fr

from .theory import pitch

DRUM_NAMES = {
    'k': 36, 'tk': 35, 's': 38, 'rs': 37, 'cl': 39, 'h': 42, 'ph': 44, 'o': 46, 'c': 49, 'c2': 57,
    'rd': 51, 'rb': 53, 'sp': 55, 'ch': 52, 't1': 50, 't2': 47, 't3': 43, 't4': 41, 'tb': 54, 'cb': 56,
    'sh': 70, 'wb': 76, 'wl': 77, 'tri': 81, 'trm': 80, 'cg': 63, 'cgl': 64, 'bg': 60, 'bgl': 61,
    'ag': 67, 'agl': 68, 'cv': 75, 'cs': 69, 'ws': 72, 'vs': 58, 'sd2': 40, 'k2': 35,
}

TOKEN_RE = re.compile(r'\[[^\]]*\][^\s|()]*|\(|\)x\d+|\||[^\s|()]+')
DUR_RE = re.compile(r'^/(\d+)(\.{0,2})(t?)')
MOD_RE = re.compile(r"^(~|!|\?|'|_|\^|\*v?|@v\d+)")


class NotationError(ValueError):
    pass


@dataclass
class Note:
    start: Fr                 # beats from the start of the parsed string
    dur: Fr                   # written length in beats (ties merged)
    pitches: tuple            # MIDI pitches (or drum notes); empty = rest (never emitted)
    vel: int = 96
    gate: float | None = None  # None = default articulation of the part
    slide: bool = False
    vibrato: bool = False
    tie: bool = False
    drum_names: tuple = ()
    bar: int = 0              # 1-based bar index inside the string

    def shifted(self, beats) -> 'Note':
        return replace(self, start=self.start + beats)


def parse_duration(tok: str):
    m = DUR_RE.match(tok)
    if not m:
        return None, tok
    base, dots, trip = m.groups()
    b = int(base)
    if b not in (1, 2, 4, 8, 16, 32, 64):
        raise NotationError(f'bad duration /{base}')
    d = Fr(4, b)
    if dots == '.':
        d = d * Fr(3, 2)
    elif dots == '..':
        d = d * Fr(7, 4)
    if trip:
        d = d * Fr(2, 3)
    return d, tok[m.end():]


def _parse_head(head: str, drums: bool):
    """→ (pitches tuple, drum names tuple). Empty pitches for a rest."""
    if head in ('r', '-', ''):
        return (), ()
    if head.startswith('['):
        inner = head[1:-1].split()
        return tuple(pitch(p) for p in inner), ()
    if drums:
        names = tuple(head.split('+'))
        notes = []
        for n in names:
            if n not in DRUM_NAMES:
                raise NotationError(f'unknown drum {n!r} (known: {" ".join(sorted(DRUM_NAMES))})')
            notes.append(DRUM_NAMES[n])
        return tuple(notes), names
    if '+' in head:
        return tuple(pitch(p) for p in head.split('+')), ()
    return (pitch(head),), ()


def tokenize(text: str):
    return TOKEN_RE.findall(text)


def _expand_groups(tokens):
    """( … )xN → repeated tokens (nesting allowed)."""
    out, stack = [], [[]]
    for t in tokens:
        if t == '(':
            stack.append([])
        elif t.startswith(')x'):
            if len(stack) == 1:
                raise NotationError('")xN" without "("')
            grp = stack.pop()
            stack[-1].extend(grp * int(t[2:]))
        else:
            stack[-1].append(t)
    if len(stack) != 1:
        raise NotationError('unclosed "("')
    return stack[0]


def parse(text: str, beats_per_bar: Fr | int = 4, drums: bool = False, base_vel: int = 96,
          check_bars: bool = True, where: str = '') -> tuple[list, Fr]:
    """Parse a note string. Returns (notes, total_beats). Rests are dropped from the list.

    Every bar between '|' must add up to `beats_per_bar` (the last bar too, when it is not empty)."""
    bpb = Fr(beats_per_bar)
    tokens = _expand_groups(tokenize(text))
    notes: list[Note] = []
    bars: list[list[Note]] = []
    cur_bar: list[Note] = []
    pos = Fr(0)
    bar_start = Fr(0)
    bar_no = 1
    dur = Fr(1)
    pending_ties: dict[int, Note] = {}

    def close_bar(final=False):
        nonlocal bar_start, bar_no, cur_bar
        length = pos - bar_start
        if final and length == 0:
            return
        if check_bars and length != bpb:
            raise NotationError(f'{where}bar {bar_no} lasts {float(length):g} beats, the meter needs {float(bpb):g}: '
                                f'{" ".join(n.drum_names and "+".join(n.drum_names) or str(n.pitches) for n in cur_bar)[:120]}')
        bars.append(cur_bar)
        cur_bar = []
        bar_start = pos
        bar_no += 1

    for tok in tokens:
        if tok == '|':
            close_bar()
            continue
        if tok == '%':
            if not bars:
                raise NotationError(f'{where}"%" in the first bar')
            src = bars[-1]
            src_start = bar_start - bpb
            for n in src:
                c = replace(n, start=n.start - src_start + pos, bar=bar_no)
                notes.append(c)
                cur_bar.append(c)
            pos += bpb
            continue
        # split head / duration / modifiers
        if tok.startswith('['):
            j = tok.index(']') + 1
            head, rest = tok[:j], tok[j:]
        else:
            m = re.match(r"^([^/~!?'_^*@]*)(.*)$", tok)
            head, rest = m.group(1), m.group(2)
        vel, gate, slide, vib, tie = base_vel, None, False, False, False
        while rest:
            if rest.startswith('/'):          # duration (modifiers may come before or after it)
                d, rest2 = parse_duration(rest)
                if d is None:
                    raise NotationError(f'{where}bar {bar_no}: bad duration in {tok!r}')
                dur, rest = d, rest2
                continue
            m = MOD_RE.match(rest)
            if not m:
                raise NotationError(f'{where}bar {bar_no}: cannot read {tok!r} (left over {rest!r})')
            mod = m.group(1)
            rest = rest[m.end():]
            if mod == '~':
                tie = True
            elif mod == '!':
                vel += 20
            elif mod == '?':
                vel -= 30
            elif mod == "'":
                gate = 0.5
            elif mod == '_':
                gate = 1.05
            elif mod == '^':
                slide = True
            elif mod.startswith('*'):
                vib = True
            elif mod.startswith('@v'):
                vel = int(mod[2:])
        try:
            pitches, names = _parse_head(head, drums)
        except ValueError as e:
            raise NotationError(f'{where}bar {bar_no}: {e}') from None
        vel = max(1, min(127, vel))
        if pitches:
            single = len(pitches) == 1 and not drums
            prev = pending_ties.pop(pitches[0], None) if single else None
            if prev is not None:
                prev.dur = pos + dur - prev.start
                prev.tie = tie
                if tie:
                    pending_ties[pitches[0]] = prev
            else:
                n = Note(pos, dur, pitches, vel, gate, slide, vib, tie, names, bar_no)
                notes.append(n)
                cur_bar.append(n)
                if tie and single:
                    pending_ties[pitches[0]] = n
        pos += dur
    close_bar(final=True)
    if pending_ties and check_bars:
        raise NotationError(f'{where}tie "~" at the end with nothing to tie into')
    return notes, pos


def bars_of(text: str) -> int:
    return sum(1 for t in tokenize(text) if t == '|') + (0 if text.strip().endswith('|') else 1)
