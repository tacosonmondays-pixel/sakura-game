"""Pitches, keys, chord symbols, voicings and leitmotif transforms.

Conventions: MIDI note numbers, C4 = 60 (middle C). Keys are written 'F', 'Bb', 'C#m', 'Am', 'E phrygian'.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

LETTER = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}
SHARP_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
FLAT_NAMES = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b']
PITCH_RE = re.compile(r'^([a-gA-G])(##|bb|#|b)?(-?\d)$')

MODES = {
    'major': [0, 2, 4, 5, 7, 9, 11], 'ionian': [0, 2, 4, 5, 7, 9, 11],
    'minor': [0, 2, 3, 5, 7, 8, 10], 'aeolian': [0, 2, 3, 5, 7, 8, 10],
    'harmonic': [0, 2, 3, 5, 7, 8, 11], 'dorian': [0, 2, 3, 5, 7, 9, 10],
    'phrygian': [0, 1, 3, 5, 7, 8, 10], 'lydian': [0, 2, 4, 6, 7, 9, 11],
    'mixolydian': [0, 2, 4, 5, 7, 9, 10],
}
FLAT_KEYS = {'f', 'bb', 'eb', 'ab', 'db', 'gb', 'cb', 'dm', 'gm', 'cm', 'fm', 'bbm', 'ebm', 'abm'}


def pitch(name: str) -> int:
    """'c5' → 72, 'bb4' → 70, 'f#3' → 54."""
    m = PITCH_RE.match(name.strip())
    if not m:
        raise ValueError(f'bad pitch {name!r} (expected e.g. c5, f#4, bb3)')
    letter, acc, octave = m.groups()
    semis = LETTER[letter.lower()] + {'#': 1, '##': 2, 'b': -1, 'bb': -2}.get(acc or '', 0)
    return 12 * (int(octave) + 1) + semis


def pc(name: str) -> int:
    """Pitch class of a note letter with accidentals ('Bb' → 10)."""
    name = name.strip()
    semis = LETTER[name[0].lower()]
    for ch in name[1:]:
        semis += 1 if ch == '#' else -1 if ch == 'b' else 0
    return semis % 12


def name_of(midi: int, flats: bool = False) -> str:
    """60 → 'c4'."""
    names = FLAT_NAMES if flats else SHARP_NAMES
    return f'{names[midi % 12]}{midi // 12 - 1}'


@dataclass(frozen=True)
class Key:
    tonic: int          # pitch class
    mode: str           # 'major', 'minor', 'dorian', …
    flats: bool

    @property
    def scale(self):
        return MODES[self.mode]


def parse_key(text: str) -> Key:
    """'F' / 'Bb' / 'Am' / 'C#m' / 'E phrygian'."""
    t = text.strip()
    parts = t.split()
    root = parts[0]
    mode = parts[1].lower() if len(parts) > 1 else 'major'
    if len(parts) == 1 and root.endswith('m') and len(root) > 1:
        root, mode = root[:-1], 'minor'
    flats = ('b' in root[1:]) or ((root.lower() + ('m' if mode == 'minor' else '')) in FLAT_KEYS) or root.lower() == 'f'
    return Key(pc(root), mode, flats)


# --------------------------------------------------------------------------------------------
# Chord symbols
# --------------------------------------------------------------------------------------------
CHORD_RE = re.compile(r'^([A-G](?:#|b)?)([^/]*)(?:/([A-G](?:#|b)?))?$')
# quality → intervals above the root (the root itself is 0)
QUALITIES = {
    '': [0, 4, 7], 'maj': [0, 4, 7], 'M': [0, 4, 7], 'm': [0, 3, 7], 'min': [0, 3, 7],
    '5': [0, 7], 'sus4': [0, 5, 7], 'sus2': [0, 2, 7], 'sus': [0, 5, 7],
    'dim': [0, 3, 6], '°': [0, 3, 6], 'aug': [0, 4, 8], '+': [0, 4, 8],
    '6': [0, 4, 7, 9], 'm6': [0, 3, 7, 9], '69': [0, 4, 7, 9, 14], 'add9': [0, 4, 7, 14], 'madd9': [0, 3, 7, 14],
    '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'M7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'mmaj7': [0, 3, 7, 11],
    'm7b5': [0, 3, 6, 10], 'ø': [0, 3, 6, 10], 'ø7': [0, 3, 6, 10], 'dim7': [0, 3, 6, 9], '°7': [0, 3, 6, 9],
    '7sus4': [0, 5, 7, 10], '7sus': [0, 5, 7, 10], '9sus4': [0, 5, 7, 10, 14], '13sus4': [0, 5, 7, 10, 14, 21],
    '9': [0, 4, 7, 10, 14], 'maj9': [0, 4, 7, 11, 14], 'm9': [0, 3, 7, 10, 14], 'm11': [0, 3, 7, 10, 14, 17],
    '11': [0, 5, 7, 10, 14], '13': [0, 4, 7, 10, 14, 21], 'm13': [0, 3, 7, 10, 14, 21], 'maj13': [0, 4, 7, 11, 14, 21],
    '7b9': [0, 4, 7, 10, 13], '7#9': [0, 4, 7, 10, 15], '7#11': [0, 4, 7, 10, 18], '7b13': [0, 4, 7, 10, 20],
    'maj7#11': [0, 4, 7, 11, 18], '7alt': [0, 4, 10, 13, 15, 20], 'aug7': [0, 4, 8, 10], '7#5': [0, 4, 8, 10],
}


@dataclass(frozen=True)
class Chord:
    symbol: str
    root: int            # pitch class
    intervals: tuple     # semitones above root
    bass: int            # pitch class of the bass note (slash chords)

    @property
    def tones(self):
        return [(self.root + i) % 12 for i in self.intervals]

    @property
    def third(self):
        for i in self.intervals:
            if i in (3, 4):
                return (self.root + i) % 12
        return (self.root + self.intervals[1]) % 12 if len(self.intervals) > 1 else self.root

    @property
    def fifth(self):
        for i in self.intervals:
            if i in (6, 7, 8):
                return (self.root + i) % 12
        return (self.root + 7) % 12


def parse_chord(sym: str) -> Chord:
    m = CHORD_RE.match(sym.strip())
    if not m:
        raise ValueError(f'bad chord symbol {sym!r}')
    root, qual, bass = m.groups()
    qual = qual.replace('(', '').replace(')', '')
    if qual not in QUALITIES:
        raise ValueError(f'unknown chord quality {qual!r} in {sym!r} (known: {", ".join(sorted(QUALITIES))})')
    r = pc(root)
    return Chord(sym, r, tuple(QUALITIES[qual]), pc(bass) if bass else r)


def parse_grid(text: str, bars: int, beats_per_bar) -> list:
    """'Fmaj7 | Dm9 | C7sus4 C7 | %' → per bar list of (start_beat_in_bar, length_beats, Chord).
    Chords inside one bar share it evenly; '%' repeats the previous bar; '-' holds the previous chord."""
    from fractions import Fraction
    cells = [c.strip() for c in text.strip().strip('|').split('|')]
    if len(cells) != bars:
        raise ValueError(f'chord grid has {len(cells)} bars, the section has {bars}: {text!r}')
    out, prev = [], None
    last_chord = None
    for cell in cells:
        if cell == '%':
            out.append(list(prev))
            continue
        syms = cell.split()
        n = len(syms)
        span = Fraction(beats_per_bar) / n
        row = []
        for i, s in enumerate(syms):
            ch = last_chord if s == '-' else parse_chord(s)
            last_chord = ch
            row.append((span * i, span, ch))
        out.append(row)
        prev = row
    return out


def voice(chord: Chord, low: int = 52, high: int = 72, style: str = 'close', prev=None) -> list:
    """MIDI pitches for a chord inside [low, high].
    close    all chord tones stacked closely above `low` (no doubled root when ≥ 4 tones)
    rootless jazz voicing: drop the root, keep 3rd/7th/extensions
    shell    root (in the bass register) + 3rd + 7th
    triad    root position triad
    spread   root low, the rest an octave+ above
    Voice leading: when `prev` is given, the inversion closest to it is chosen."""
    tones = [(chord.root + i) % 12 for i in chord.intervals]
    if style == 'triad':
        tones = [chord.root, chord.third, chord.fifth]
    elif style == 'rootless' and len(tones) >= 4:
        tones = [t for t in tones if t != chord.root]
        if len(tones) > 4:   # drop the 5th first
            tones = [t for t in tones if t != chord.fifth] or tones
    elif style == 'shell':
        sev = [(chord.root + i) % 12 for i in chord.intervals if i in (9, 10, 11)]
        tones = [chord.third] + sev[:1]
    seen, uniq = set(), []
    for t in tones:
        if t not in seen:
            seen.add(t)
            uniq.append(t)
    tones = uniq[:5]
    best, best_cost = None, None
    for rot in range(len(tones)):
        order = tones[rot:] + tones[:rot]
        notes, cur = [], low - 1
        for t in order:
            n = cur + 1
            while n % 12 != t:
                n += 1
            notes.append(n)
            cur = n
        for shift in (0, 12, -12):
            cand = [n + shift for n in notes]
            if cand[0] < low or cand[-1] > high + 2:
                continue
            if prev:
                cost = sum(min(abs(a - b) for b in prev) for a in cand)
            else:
                cost = abs((cand[0] + cand[-1]) / 2 - (low + high) / 2)
            if best_cost is None or cost < best_cost:
                best, best_cost = cand, cost
    if best is None:
        n = low
        best = []
        for t in tones:
            while n % 12 != t:
                n += 1
            best.append(n)
    if style == 'spread':
        root = low - 12
        while root % 12 != chord.bass:
            root += 1
        best = [root] + [n + 12 if n < low + 7 else n for n in best if n % 12 != chord.bass]
    return sorted(best)


def bass_note(pclass: int, low: int = 33, high: int = 52) -> int:
    """Lowest MIDI note of pitch class `pclass` at or above `low` (wrapping under `high`)."""
    n = low
    while n % 12 != pclass:
        n += 1
    return n if n <= high else n - 12


# --------------------------------------------------------------------------------------------
# Leitmotifs
# --------------------------------------------------------------------------------------------
@dataclass(frozen=True)
class Motif:
    """A leitmotif as semitone offsets from the tonic of the target octave, per mode family.

    `major`/`minor` hold the question (the incomplete phrase); `answer_*` the resolution that
    follows it. `rhythm` is a list of durations in DSL syntax ('8', '4.', …), `answer_rhythm` the
    durations of the answer notes. `name` is written into the MIDI as a marker (motif:NAME)."""
    name: str
    major: tuple
    minor: tuple
    rhythm: tuple
    answer_major: tuple = (0,)
    answer_minor: tuple = (0,)
    answer_rhythm: tuple = ('2',)
    modes: dict = field(default_factory=dict)   # optional explicit offsets for other modes

    def _offsets(self, key: Key, answer=False):
        if key.mode in self.modes:
            base = self.modes[key.mode]
            return base[1] if answer else base[0]
        fam = 'minor' if key.mode in ('minor', 'aeolian', 'harmonic', 'dorian', 'phrygian') else 'major'
        if answer:
            return self.answer_minor if fam == 'minor' else self.answer_major
        return self.minor if fam == 'minor' else self.major

    def notes(self, key: str | Key, octave: int, rhythm=None, answer=False, transpose=0, invert=False) -> list:
        k = parse_key(key) if isinstance(key, str) else key
        tonic = 12 * (octave + 1) + k.tonic + transpose
        offs = list(self._offsets(k, answer))
        if invert:
            offs = [offs[0] - (o - offs[0]) for o in offs]
        return [tonic + o for o in offs]

    def question(self, key, octave, rhythm=None, transpose=0, invert=False, augment=1) -> str:
        k = parse_key(key) if isinstance(key, str) else key
        ps = self.notes(k, octave, transpose=transpose, invert=invert)
        rh = scale_rhythm(list(rhythm or self.rhythm), augment)
        return ' '.join(f'{name_of(p, k.flats)}/{d}' for p, d in zip(ps, rh))

    def answer(self, key, octave, rhythm=None, transpose=0, augment=1) -> str:
        k = parse_key(key) if isinstance(key, str) else key
        ps = self.notes(k, octave, answer=True, transpose=transpose)
        rh = scale_rhythm(list(rhythm or self.answer_rhythm), augment)
        return ' '.join(f'{name_of(p, k.flats)}/{d}' for p, d in zip(ps, rh))

    def intervals(self, key_mode='major'):
        offs = self.minor if key_mode == 'minor' else self.major
        return [b - a for a, b in zip(offs, offs[1:])]


def scale_rhythm(rh: list, factor) -> list:
    """Augment (factor 2) or diminish (factor 0.5) DSL durations: '8' → '4' (×2) / '16' (×0.5)."""
    if factor == 1:
        return rh
    out = []
    for d in rh:
        dots = d.count('.')
        base = int(d.rstrip('.t'))
        trip = 't' if d.endswith('t') else ''
        nb = int(base / factor)
        if nb < 1 or nb > 64:
            raise ValueError(f'cannot scale duration {d} by {factor}')
        out.append(f'{nb}{"." * dots}{trip}')
    return out
