"""Helpers for the electronic battle families: battle_foundry (techno) and battle_caldera (hardtek). Batch B2, audio r3.

The file name starts with '_' so `song.discover()` does not treat it as a song. Everything here returns plain DSL note
strings, so the song files stay readable and the busy/originality tools see ordinary parts.

    line(chords, full, half, low=36)     bass / riff line from a chord grid with extended degree tokens:
                                         R 3 5 7 (chord-aware) · b2 2 b3 4 b5 b6 6 b7 8 9 (from the root)
                                         · ap / au (a semitone under / over the NEXT chord's bass) · r (rest)
                                         · '^' / 'v' after the degree = up / down an octave,
                                         e.g. 'r/16 R/16 8/16 R/16 r/16 5/16 7^/16 ap/16'
    hits(chords, slots, low, high)       chord stabs on 16th slots of every bar (the chord sounding at that slot,
                                         voice-led), e.g. slots=[(0, 2, '!'), (6, 2, ''), (14, 2, '')] = 1, 2&, 4&
    conveyor(chords, key_tonic, octave)  the BELL cell as a 16th sequencer arp (5-1-♭6-♭7 of the key; on a
                                         dominant chord the true BELL 5-1-♭6-7), 3-3-2 velocity accents
    hold(points)                         filter automation with explicit holds ([section, bar, hz] … )
    bars(…) / rest(n)                    small string helpers
"""
from __future__ import annotations

import re

from sakura_audio.theory import parse_grid, parse_chord, voice, name_of

_TOK = re.compile(r'^(ap|au|r|R|b2|2|b3|3|4|b5|5|b6|6|b7|7|8|9)([\^v]*)(/.*)$')
_FIXED = {'b2': 1, '2': 2, 'b3': 3, '4': 5, 'b5': 6, 'b6': 8, '6': 9, 'b7': 10, '8': 12, '9': 14}
_LEN16 = {1: '16', 2: '8', 3: '8.', 4: '4', 6: '4.', 8: '2', 12: '2.', 16: '1'}


def bars(*items: str) -> str:
    return ' | '.join(x.strip().strip('|').strip() for x in items)


def rest(n: int = 1) -> str:
    return ' | '.join(['r/1'] * n)


def _grid(chords: str):
    cells = [c.strip() for c in chords.strip().strip('|').split('|')]
    return parse_grid(chords, len(cells), 4)


def _root_in(pc_: int, low: int) -> int:
    n = low
    while n % 12 != pc_:
        n += 1
    return n


def line(chords: str, full: str | list, half: str | None = None, low: int = 36, nxt: str | None = None,
         flats: bool = True) -> str:
    """A bass/riff line over a chord grid. `full` = the pattern of a one-chord bar (or a list of patterns, used bar by
    bar in turn), `half` = the pattern for each half of a two-chord bar. Roots sit in [low, low+11]."""
    grid = _grid(chords)
    flat = [c for row in grid for (_, _, c) in row]
    after = parse_chord(nxt) if nxt else flat[0]
    fulls = full if isinstance(full, list) else [full]
    out, k = [], 0
    for b, row in enumerate(grid):
        toks = []
        for _, _, ch in row:
            pat = fulls[b % len(fulls)] if len(row) == 1 else (half or fulls[0])
            nx = flat[k + 1] if k + 1 < len(flat) else after
            k += 1
            r = _root_in(ch.bass, low)
            base = r - ((ch.bass - ch.root) % 12)          # slash chord: degrees from the written root
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
                if d == 'R':
                    p = r
                elif d == '3':
                    p = base + third
                elif d == '5':
                    p = base + fifth
                elif d == '7':
                    p = base + sev
                elif d == 'ap':
                    p = nr - 1
                elif d == 'au':
                    p = nr + 1
                else:
                    p = base + _FIXED[d]
                p += 12 * (octs.count('^') - octs.count('v'))
                toks.append(name_of(p, flats) + rest_)
        out.append(' '.join(toks))
    return ' | '.join(out)


def _rests(t: int, gap: int) -> list:
    out = []
    while gap > 0:
        size = next(z for z in (16, 8, 4, 2, 1) if z <= gap and t % z == 0)
        out.append(f'r/{_LEN16[size]}')
        t += size
        gap -= size
    return out


def _fill(events: list, total: int = 16) -> str:
    """events = [(slot, length_in_16ths, 'pitchtext', 'mods')] in one bar → DSL with rests filled in."""
    out, t = [], 0
    for slot, ln, txt, mods in sorted(events):
        if slot < t:
            raise ValueError(f'overlapping events at slot {slot}')
        out += _rests(t, slot - t)
        if ln not in _LEN16:
            raise ValueError(f'length {ln} sixteenths has no single DSL duration')
        out.append(f'{txt}/{_LEN16[ln]}{mods}')
        t = slot + ln
    out += _rests(t, total - t)
    return ' '.join(out)


def hits(chords: str, slots, low: int = 55, high: int = 72, style: str = 'rootless', per_bar: dict | None = None,
         flats: bool = True) -> str:
    """Chord stabs on 16th slots: `slots` = [(slot 0-15, length in 16ths, mods)], the same every bar unless
    `per_bar` = {bar (1-based): slots} overrides a bar ([] = an empty bar). Voices are led from chord to chord."""
    grid = _grid(chords)
    prev, out = None, []
    for b, row in enumerate(grid):
        cell = (per_bar or {}).get(b + 1, slots)
        ev = []
        for slot, ln, mods in cell:
            t = slot / 4
            ch = next(c for st, l, c in reversed(row) if st <= t)
            vs = voice(ch, low, high, style, prev)
            prev = vs
            ev.append((slot, ln, '[' + ' '.join(name_of(p, flats) for p in vs) + ']', mods))
        out.append(_fill(ev) if ev else 'r/1')
    return ' | '.join(out)


def conveyor(chords: str, tonic_pc: int, octave: int, dominants=(), v_hi: int = 92, v_lo: int = 70,
             accents=(0, 3, 6, 8, 11, 14), mute_bars=(), order=(0, 1, 2, 3), flats: bool = True) -> str:
    """The BELL cell as a 16th sequencer arp, one cell per beat: 5 – 1 – ♭6 – ♭7 of the key (diatonic BELL, it sits
    on every chord of an aeolian loop), turned into the true BELL 5 – 1 – ♭6 – 7 (raised leading tone) while a chord
    whose symbol is in `dominants` sounds. Velocity accents on a 3-3-2 grid run across the 4-note cycle, so the
    belt 'clanks' against the beat. `mute_bars` (1-based) are left empty, `order` permutes the cell."""
    grid = _grid(chords)
    t5 = 12 * (octave + 1) + tonic_pc - 5
    nat = [t5, t5 + 5, t5 + 1, t5 + 3]           # e.g. F minor, octave 5: C5 F5 D♭5 E♭5
    dom = [t5, t5 + 5, t5 + 1, t5 + 4]           # … C5 F5 D♭5 E5
    out = []
    for b, row in enumerate(grid):
        if (b + 1) in mute_bars:
            out.append('r/1')
            continue
        toks = []
        for s in range(16):
            t = s / 4
            ch = next(c for st, l, c in reversed(row) if st <= t)
            cell = dom if ch.symbol in dominants else nat
            p = cell[order[s % 4]]
            v = v_hi if s in accents else v_lo
            toks.append(f'{name_of(p, flats)}/16@v{v}')
        out.append(' '.join(toks))
    return ' | '.join(out)


def hold(*points) -> list:
    """Filter automation points [section, bar, hz]; written as a list so every hold is explicit (between two points
    the cutoff glides in log-frequency, so a value that must stay put needs a point at both ends)."""
    return [list(p) for p in points]
