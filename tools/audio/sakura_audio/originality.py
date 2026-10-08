"""Originality check (docs/AUDIO.md §6.5): interval n-grams of every melodic line in our songs.

Two reports, both heuristics (the real gate is a human looking at the piano rolls and listening):

1. **Blocklist.** `tools/audio/originality/blocklist.json` holds short interval fingerprints of famous hooks we must not
   resemble. A line that contains `min` (default 6) consecutive intervals of an entry is a FAIL.
2. **Self-similarity.** A shared run of `n` intervals (default 7) between two different songs that is neither a
   declared leitmotif / main-theme quote (motifs.py, the main theme in _battle_kit.py) nor a generic figure
   (scales, arpeggios, repeated notes: any run with a period of ≤ 3 intervals) is listed, with its rhythm, so two
   tracks never share a phrase by accident.

Lines: every non-kit part above the bass register, reduced to its top voice (highest pitch per onset).
Intervals are transposition-free; rhythm (durations in beats) is reported alongside.
"""
from __future__ import annotations

import json
from collections import defaultdict
from fractions import Fraction as Fr
from pathlib import Path

from .paths import TOOLS

BLOCKLIST = TOOLS / 'originality' / 'blocklist.json'


def melody_lines(song, palette) -> list:
    """→ [(part name, [(start beat, dur, pitch)])] top voice of every non-kit part, one pass of the song."""
    song.palette_hint = palette
    tl = song.timeline(passes=1)
    out = []
    for tp in tl.parts:
        try:
            if palette.resolve(tp.role).get('bank') == 128:
                continue
        except Exception:
            continue
        by_start: dict = {}
        for n in tp.notes:
            if not n.pitches:
                continue
            top = max(n.pitches)
            k = Fr(n.start).limit_denominator(64)
            if k not in by_start or top > by_start[k][1]:
                by_start[k] = (Fr(n.dur).limit_denominator(64), top)
        seq = [(st, d, p) for st, (d, p) in sorted(by_start.items())]
        if len(seq) >= 6:
            ps = sorted(x[2] for x in seq)
            if ps[len(ps) // 2] < 48:          # bass register: root/octave/fifth idioms, not tunes
                continue
            out.append((tp.name, seq))
    return out


def intervals(seq) -> list:
    return [b[2] - a[2] for a, b in zip(seq, seq[1:])]


def is_generic(iv) -> bool:
    """Scales, arpeggios, trills, repeated notes: a run that repeats a cell of ≤ 3 intervals (up to ±1 slip),
    or a run that moves only by steps in one direction."""
    n = len(iv)
    for per in (1, 2, 3, 4):
        same = sum(1 for i in range(per, n) if iv[i] == iv[i - per])
        if same >= n - per - 1:
            return True
    if all(0 < x <= 2 for x in iv) or all(-2 <= x < 0 for x in iv):
        return True
    if sum(1 for x in iv if x == 0) >= n // 2:
        return True
    if sum(1 for x in iv if abs(x) >= 3) >= n - 1:          # broken chords: arpeggio figures, not tunes
        return True
    return False


def declared_sequences() -> list:
    """Interval lists of the material that is *meant* to recur: leitmotifs and the main theme."""
    import motifs as M
    from _battle_kit import MAIN_A, MAIN_B
    from sakura_audio.notation import parse
    seqs = []
    for mo in (M.BELL, M.SENTINEL, M.SHADOW, M.VICTORY_STING):
        for mode in ('major', 'minor'):
            offs = list(getattr(mo, mode))
            ans = list(getattr(mo, f'answer_{mode}', ()) or ())
            seqs.append([b - a for a, b in zip(offs + ans, (offs + ans)[1:])])
    theme = []
    for bar in MAIN_A + MAIN_B:
        notes, _ = parse(bar, 4)
        theme += [max(n.pitches) for n in notes if n.pitches]
    theme_iv = [b - a for a, b in zip(theme, theme[1:])]
    seqs.append(theme_iv + [theme[0] - theme[-1]] + theme_iv)          # the theme, looping
    return seqs


def _contains(hay: list, needle: list) -> bool:
    n = len(needle)
    return any(hay[i:i + n] == needle for i in range(len(hay) - n + 1))


def is_declared(w: list, declared: list, joins: int = 2) -> bool:
    """Declared material, also when motif statements are joined by free intervals (a call, then the call again)."""
    if len(w) < 2 or any(_contains(d, w) for d in declared):
        return True
    if joins <= 0:
        return False
    for k in range(len(w)):
        left, right = w[:k], w[k + 1:]
        if (len(left) < 2 or any(_contains(d, left) for d in declared)) and is_declared(right, declared, joins - 1) \
                and (len(left) >= 2 or len(right) >= 2):
            return True
    return False


def load_blocklist(path: Path = BLOCKLIST) -> list:
    if not path.exists():
        return []
    return json.loads(path.read_text()).get('hooks', [])


def check(songs: dict, palette, n: int = 7, blocklist: list | None = None) -> dict:
    blocklist = load_blocklist() if blocklist is None else blocklist
    declared = declared_sequences()
    index = defaultdict(list)          # tuple(intervals) → [(song, part, bar, rhythm)]
    hits = []
    for sid, song in sorted(songs.items()):
        if sid.startswith('demo'):            # the palette-test tune is not part of the soundtrack
            continue
        bpb = song.bpb
        for part, seq in melody_lines(song, palette):
            iv = intervals(seq)
            for hook in blocklist:
                m = int(hook.get('min', 6))
                h = list(hook['intervals'])
                starts = [0] if hook.get('anchor') else range(len(h) - m + 1)
                for i in starts:
                    w = h[i:i + m]
                    for j in range(len(iv) - m + 1):
                        if iv[j:j + m] == w:
                            hits.append({'song': sid, 'part': part, 'bar': int(seq[j][0] / bpb) + 1, 'hook': hook['name'],
                                         'intervals': w})
                            break
                    else:
                        continue
                    break
            for j in range(len(iv) - n + 1):
                w = tuple(iv[j:j + n])
                if is_generic(w):
                    continue
                rhythm = tuple(str(x[1]) for x in seq[j:j + n + 1])
                if len(set(rhythm)) == 1 and max(abs(x) for x in w) >= 7:
                    continue                   # even notes with a register jump: an accompaniment arpeggio
                index[w].append((sid, part, int(seq[j][0] / bpb) + 1, rhythm))
    shared = []
    for w, occ in index.items():
        sids = {o[0] for o in occ}
        if len(sids) < 2:
            continue
        if is_declared(list(w), declared):
            continue
        first = {}
        for o in occ:
            first.setdefault(o[0], o)
        rows = sorted(first.values())
        same_rhythm = len({r[3] for r in rows}) < len(rows)
        shared.append({'intervals': list(w), 'sameRhythm': same_rhythm,
                       'where': [{'song': r[0], 'part': r[1], 'bar': r[2]} for r in rows]})
    shared.sort(key=lambda x: (not x['sameRhythm'], x['where'][0]['song']))
    return {'n': n, 'blocklistHits': hits, 'shared': shared, 'ok': not hits}
