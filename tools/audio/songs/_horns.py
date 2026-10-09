"""Helpers for the round-3 horn-genre songs (B1: homeroom jazz, march ska, mall city pop). Composer B1.

The file name starts with '_' so `song.discover()` does not treat it as a song. Nothing here is shared with other
batches; the round-2 helpers (_home.py, _battle_kit.py) are untouched.

    line(chords, pats, halves, low=33, nxt=None)   bass line text from chord symbols and degree patterns
    comp(chords, rhythm, low, high, …)            → Note list: chord stabs on a rhythm, with anticipations
    harmonize(lead_notes, grid, voices=3, …)      → lists of Notes: a horn section voiced under a lead line
    put(part, section, notes, vel=0)              add generated Notes to a part (applies the part's velocity offset)
    notes_of(text, bpb=4)                          parse a note string → Note list (velocity 96 + accents)
"""
from __future__ import annotations

import re
from dataclasses import replace
from fractions import Fraction as Fr

from sakura_audio.notation import parse
from sakura_audio.theory import parse_grid, parse_chord, name_of, voice

_DEG = re.compile(r'^(ap|au|a2|n5|R|2|3|4|5|6|7|8|9|b3|b5|b6|b7|10|-5|-4|-2|-1|r)(.*)$')


def notes_of(text: str, bpb=4, vel: int = 96):
    return parse(text, bpb, base_vel=vel)[0]


def put(part, section: str, notes, vel: int = 0):
    """Append generated Notes to `part` in `section` (velocity offset of the part + `vel`)."""
    part.bodies.setdefault(section, []).extend(
        replace(n, vel=max(1, min(127, n.vel + part.vel + vel))) for n in notes)
    return part


def grid(chords: str):
    cells = [c.strip() for c in chords.strip().strip('|').split('|')]
    return parse_grid(chords, len(cells), 4)


def chord_at(g, t):
    """Chord sounding at beat `t` (section-relative) of grid `g` (4/4)."""
    b = int(t // 4)
    b = min(max(b, 0), len(g) - 1)
    off = t - 4 * b
    cur = g[b][0][2]
    for st, ln, ch in g[b]:
        if st <= off:
            cur = ch
    return cur


# --------------------------------------------------------------------------------------------- bass lines
def line(chords: str, pats, halves=None, low: int = 33, nxt: str | None = None, flats: bool = True) -> str:
    """Bass line text for a chord grid. `pats` = pattern(s) for one-chord bars, `halves` = pattern(s) for each chord
    of a two-chord bar; a list cycles by bar (or by half-bar), a dict maps 1-based bar → pattern.

    Degrees (from the chord root; the slash bass replaces R): R 2 3 4 5 6 7 8 9 10 (8 + third) b3 b5 b6 b7, -1 -2 -4 -5
    (a semitone / tone / fourth / fifth under the root), ap / au (a semitone below / above the NEXT chord's bass),
    a2 (a tone below it), n5 (the next chord's fifth, under its root), r (rest). Roots sit in [low, low + 11]."""
    g = grid(chords)
    flat = [c for row in g for (_, _, c) in row]
    after = parse_chord(nxt) if nxt else flat[0]

    def pick(src, i, bar):
        if isinstance(src, dict):
            return src.get(bar, src.get(0))
        if isinstance(src, (list, tuple)):
            return src[i % len(src)]
        return src

    def root_of(pc):
        n = low
        while n % 12 != pc:
            n += 1
        return n

    out, k, hk = [], 0, 0
    for bi, row in enumerate(g):
        toks = []
        for _, _, ch in row:
            if len(row) == 1:
                pat = pick(pats, bi, bi + 1)
            else:
                pat = pick(halves if halves is not None else pats, hk, bi + 1)
                hk += 1
            r = root_of(ch.bass)
            nx = flat[k + 1] if k + 1 < len(flat) else after
            k += 1
            nr = root_of(nx.bass)
            third = next((i for i in ch.intervals if i in (3, 4)), 4)
            fifth = next((i for i in ch.intervals if i in (6, 7, 8)), 7)
            sev = next((i for i in ch.intervals if i in (10, 11)), next((i for i in ch.intervals if i == 9), 10))
            six = 9 if 9 in ch.intervals or 21 in ch.intervals else (8 if 8 in ch.intervals else 9)
            base = r - ((ch.bass - ch.root) % 12) if ch.bass != ch.root else r
            nfifth = next((i for i in nx.intervals if i in (6, 7, 8)), 7)
            table = {'R': r, '2': base + 2, '3': base + third, '4': base + 5, '5': base + fifth, '6': base + six,
                     '7': base + sev, '8': r + 12, '9': base + 14, '10': base + 12 + third, 'b3': base + 3, 'b5': base + 6,
                     'b6': base + 8, 'b7': base + 10, '-1': r - 1, '-2': r - 2, '-4': r - 5, '-5': r - 7,
                     'ap': nr - 1, 'au': nr + 1, 'a2': nr - 2, 'n5': nr - 12 + nfifth}
            for tok in pat.split():
                m = _DEG.match(tok)
                if not m:
                    raise ValueError(f'line(): bad token {tok!r}')
                d, rest = m.groups()
                toks.append(('r' if d == 'r' else name_of(table[d], flats)) + rest)
        out.append(' '.join(toks))
    return ' | '.join(out)


# --------------------------------------------------------------------------------------------- comping
def comp(chords: str, rhythm, low=53, high=67, style='rootless', vel=80, gate=None, skip=(), nxt: str | None = None):
    """Chord stabs on a rhythm. `rhythm` = per-bar list (cycled; or dict bar → list) of (offset, dur, dv[, 'next'])
    with offsets in beats; 'next' (or an offset ≥ 4) voices the chord that sounds half a beat later / at the next
    bar line (anticipation; past the section's end it voices `nxt`, default the section's first chord). `skip` =
    1-based bars left empty. → Note list (section-relative)."""
    from sakura_audio.notation import Note
    g = grid(chords)
    nb = len(g)
    out, prev = [], None
    for b in range(nb):
        if (b + 1) in skip:
            continue
        rh = rhythm.get(b + 1, rhythm.get(0, [])) if isinstance(rhythm, dict) else rhythm[b % len(rhythm)]
        for item in rh:
            off, dur, dv = Fr(item[0]), Fr(item[1]), item[2]
            ant = len(item) > 3 and item[3] == 'next'
            t = 4 * b + off
            look = t + Fr(1, 2) if ant else t
            ch = chord_at(g, look) if look < 4 * nb else (parse_chord(nxt) if nxt else chord_at(g, 0))
            vs = voice(ch, low, high, style, prev)
            prev = vs
            out.append(Note(t, dur, tuple(vs), int(max(1, min(127, vel + dv))), gate))
    return out


# --------------------------------------------------------------------------------------------- horn section
def harmonize(lead, g, voices: int = 3, floor: int = 52, rootless: bool = True, spread: int = 0):
    """Voice `voices` horns under each note of a lead line (close position, chord tones of the chord sounding at the
    note's start, never a semitone under the lead, root left to the bass on rich chords). → list of Note lists, top
    to bottom. `spread` = 1 drops the second voice an octave (drop-2)."""
    outs = [[] for _ in range(voices)]
    for n in lead:
        if not n.pitches:
            continue
        top = max(n.pitches)
        ch = chord_at(g, n.start)
        pcs = list(dict.fromkeys(ch.tones))
        if rootless and len(pcs) >= 4:
            pcs = [p for p in pcs if p != ch.root] or pcs
        picked, p = [], top - 1
        while len(picked) < voices and p > floor - 12:
            pc = p % 12
            if pc in pcs and pc != top % 12 and top - p != 1:
                picked.append(p)
            p -= 1
        while len(picked) < voices:
            picked.append(picked[-1] - 12 if picked else top - 12)
        if spread == 1 and voices >= 3:
            picked[0] -= 12
            picked.sort(reverse=True)
        for i, q in enumerate(picked):
            outs[i].append(replace(n, pitches=(q,)))
    return outs
