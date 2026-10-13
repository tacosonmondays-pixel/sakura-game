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
def _tones(ch, style):
    """Pitch classes a comping voicing uses (ordered by importance: 3rd, 7th/6th, colour tones, 5th, root)."""
    iv = list(dict.fromkeys(ch.intervals))
    pc = lambda i: (ch.root + i) % 12
    third = [i for i in iv if i in (3, 4)] or [i for i in iv if i in (2, 5)]       # sus chords: the 2nd / 4th
    sev = [i for i in iv if i in (9, 10, 11)] or [i for i in iv if i == 21]
    fifth = [i for i in iv if i in (6, 7, 8)]
    ext = [i for i in iv if i in (13, 14, 15, 17, 18, 20, 21) and i not in sev]
    if style == 'shell':
        out = third[:1] + sev[:1]
        return [pc(i) for i in (out or iv[:2])]
    if style == 'rootless':
        out = third[:1] + sev[:1] + ext[:2]
        if len(out) < 4:
            out += [i for i in fifth if i not in out][:4 - len(out)]
        if len(out) < 3:
            out += [0]
    else:                                            # close: root, 3rd, 7th/6th, 5th (a colour tone only if room)
        out = [0] + third[:1] + sev[:1] + fifth[:1]
        out += [i for i in ext + iv if i not in out]
        out = out[:4]
    seen, res = set(), []
    for i in out:
        if pc(i) not in seen:
            seen.add(pc(i))
            res.append(pc(i))
    return res


def voice2(ch, low: int, high: int, style: str = 'rootless', prev=None, avoid=(), also=()) -> list:
    """A comping voicing inside [low, high] (always): every tone placed in its own octave, compact (≤ a 9th + a
    tone), smooth against `prev`, and never a minor 2nd / minor 9th against the `avoid` pitches (the melody notes
    sounding at the same time) — a tone that would clash in every octave is left out, the 3rd excepted. `also` =
    more pitches to keep clear of (counter-lines, answers) without the stay-under-them rule."""
    import itertools
    tones = _tones(ch, style)
    rub = list(avoid) + list(also)

    def clash(p):
        return any(abs(p - m) % 12 == 1 and abs(p - m) <= 25 for m in rub)

    def cands(t, lo, hi):
        return [p for p in range(lo, hi + 1) if p % 12 == t]

    keep = []
    for t in tones:
        cs = cands(t, low, high) or cands(t, low - 12, high)
        if rub and t != ch.third and len(tones) > 2 and all(clash(p) for p in cs):
            continue
        keep.append(cs)
    top_mel = min(avoid) if avoid else None
    best, best_cost = None, None
    for limit in (14, 19, 40):
        for combo in itertools.product(*keep):
            if len(set(combo)) < len(combo):
                continue
            span = max(combo) - min(combo)
            if span > limit:
                continue
            srt = sorted(combo)
            cost = 0.25 * span
            if prev:
                cost += sum(min(abs(a - b) for b in prev) for a in srt) * 0.6
            else:
                cost += abs((srt[0] + srt[-1]) / 2 - (low + high) / 2) * 0.5
            cost += sum(9 for p in srt if clash(p))
            if top_mel is not None:
                cost += sum(2 + (p - top_mel) for p in srt if p >= top_mel)
            cost += sum(4 for a, b in itertools.combinations(srt, 2) if b - a == 13)
            if len(srt) > 1 and srt[-1] - srt[-2] == 1:
                cost += 2
            cost += sum(3 for x, y in zip(srt, srt[1:]) if y - x == 1)
            if best_cost is None or cost < best_cost:
                best, best_cost = srt, cost
        if best is not None:
            break
    return best


def _sounding(notes, t0, t1):
    out = []
    for n in notes or ():
        if n.pitches and n.start < t1 and n.start + n.dur > t0:
            out.extend(n.pitches)
    return out


def comp(chords: str, rhythm, low=53, high=67, style='rootless', vel=80, gate=None, skip=(), nxt: str | None = None,
         against=None, also=None):
    """Chord stabs on a rhythm. `rhythm` = per-bar list (cycled; or dict bar → list) of (offset, dur, dv[, 'next'])
    with offsets in beats; 'next' (or an offset ≥ 4) voices the chord that sounds half a beat later / at the next
    bar line (anticipation; past the section's end it voices `nxt`, default the section's first chord). `skip` =
    1-based bars left empty. `against` = the melody's Note list (section-relative): voicings avoid minor 2nds /
    9ths with it and stay under it; `also` = more Note lists to keep clear of (counter-lines, answers). → Note list
    (section-relative)."""
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
            vs = voice2(ch, low, high, style, prev, _sounding(against, t, t + dur),
                        [p for lst in (also or ()) for p in _sounding(lst, t, t + dur)])
            prev = vs
            out.append(Note(t, dur, tuple(vs), int(max(1, min(127, vel + dv))), gate))
    return out


def notes_at(text_bars, start_bar=1):
    """Note list of a melody given as bar strings (section-relative, bar 1 = `start_bar`)."""
    from _home import bars
    return [replace(n, start=n.start + 4 * (start_bar - 1)) for n in notes_of(bars(*text_bars))]


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
            if pc in pcs and pc != top % 12 and (top - p) % 12 != 1 and (not picked or picked[-1] - p != 1):
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


def pad_rhythm(chords: str, dv: int = 0) -> dict:
    """comp() rhythm that holds every chord of a grid for its whole length (a pad that follows the changes)."""
    g = grid(chords)
    return {b + 1: [(st, ln, dv) for st, ln, _ in row] for b, row in enumerate(g)} | {0: []}


def pattern(part, sections, text: str, fills: dict | None = None, vel: int = 0):
    """Like Part.pattern, but a multi-bar pattern keeps its phase and every fill lands where asked: bar b plays fill
    b if there is one, otherwise bar (b-1) % n of the n-bar pattern. (Part.pattern drops a fill that falls inside an
    n-bar block, e.g. bar 4 of a 2-bar pattern, and shifts the pattern's phase after a fill on a block start.)"""
    from sakura_audio.notation import parse
    secs = [sections] if isinstance(sections, str) else list(sections)
    bpb = part.song.bpb
    for s in secs:
        sec = part.song.sections[s]
        pat, plen = parse(text, bpb, drums=part.drums, base_vel=96 + part.vel + vel)
        nbars = int(plen / bpb)
        fl = {bar: parse(t, bpb, drums=part.drums, base_vel=96 + part.vel + vel)[0] for bar, t in (fills or {}).items()}
        out = []
        for b in range(sec.bars):
            if b + 1 in fl:
                out += [n.shifted(bpb * b) for n in fl[b + 1]]
                continue
            k = b % nbars
            out += [n.shifted(bpb * (b - k)) for n in pat if int(n.start // bpb) == k]
        part.bodies.setdefault(s, []).extend(out)
    return part
