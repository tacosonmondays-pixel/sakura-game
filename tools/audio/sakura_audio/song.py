"""Song / Section / Part model and the timeline builder.

A song file (tools/audio/songs/<id>.py) builds one or more Song objects and exposes them as `song`
or `songs = [...]`. A JSON file with the same fields also loads (Song.from_dict), so plain Kai-style
note data works too. Songs only name *roles*; the palette decides which sound plays them.

    song = Song(id='title', title='Sakura Sentinels', bpm=132, meter=(4, 4), key='F',
                form=['intro', '|:', 'A', 'B', ':|'])           # |: … :| = loop body; no bars = one-shot
    song.section('A', bars=8, chords='Fmaj7 | Dm9 | …')
    song.part('lead', role='chip_pulse25', stem='base').notes('A', 'c5/8 f5/8 d5/4 e5/4. f5/8 | …', motifs={1: BELL})
    song.part('bass', role='finger_bass', stem='base').gen('A', 'bass:sync')
    song.part('drums', role='drums', stem='base').pattern('A', 'k/8 h s/8 h k h s h |', fills={8: '…'})
    song.part('glock', role='glock', stem='melody', octave=1, vel=-18).double('lead', 'A')

Round 3 additions (docs/AUDIO.md §2.4):
    song.part('bass', role='acid_bass', fx={'filter': {'type': 'lp', 'q': 5, 'auto': [['A', 1, 300], ['A', 9, 3000]]}})
    song.section('Br', bars=8, chords='…', swing=0)     # per-section swing (a straight bossa bridge in a swing tune)
    song.part('ride', role='drums_jazz', swing=0.66)    # per-part swing (wins over the section and the song)
    Song(..., swing=0.64, swing_triplets='keep')         # 8th-triplets stay triplets while duple 8ths swing
    Song(..., swing=0.56, swing_unit=0.5)                # swing the 16ths instead of the 8ths
"""
from __future__ import annotations

import importlib.util
import json
import sys
from dataclasses import dataclass, field, replace
from fractions import Fraction as Fr
from pathlib import Path

from . import gen as G
from .fx import validate_fx
from .notation import parse, Note, NotationError
from .theory import parse_key, parse_grid, Motif

KIT_ROLES_PREFIX = ('drums', 'chip_kit')
_DEFAULT_PALETTE = []


def is_kit_role(role: str, palette=None) -> bool:
    """Does `role` play a drum kit (drum names instead of pitches)? Songs are built before a palette is chosen, so
    without one the shipped palette decides (kit roles that do not start with 'drums', e.g. 'kick_hard')."""
    if palette is not None:
        r = palette.resolve(role)
        return r.get('bank') == 128
    if role.startswith(KIT_ROLES_PREFIX):
        return True
    if not _DEFAULT_PALETTE:
        from .palette import load_palette
        _DEFAULT_PALETTE.append(load_palette('cleared'))
    pal = _DEFAULT_PALETTE[0]
    return pal.has_role(role) and pal.resolve(role).get('bank') == 128


@dataclass
class Section:
    name: str
    bars: int
    chords: str | None = None
    grid: list | None = None
    swing: float | None = None                     # overrides the song's swing amount in this section


@dataclass
class Part:
    song: 'Song'
    name: str
    role: str
    stem: str
    octave: int = 0
    vel: int = 0
    gate: float | None = None
    pan: float | None = None
    swing: float | None = None                      # overrides the section's / song's swing amount for this part
    gain: float = 0.0                               # dB on top of the palette role's gain_db (mix balance per part)
    fx: dict | None = None                          # per-part effects, merged over the role's fx (sakura_audio/fx.py)
    bodies: dict = field(default_factory=dict)      # section → list[Note]
    doubles: list = field(default_factory=list)     # (other part, sections, octave, vel)
    markers: list = field(default_factory=list)     # (section, beat_in_section, text)

    @property
    def drums(self):
        return is_kit_role(self.role, self.song.palette_hint)

    def _secs(self, sections):
        return [sections] if isinstance(sections, str) else list(sections)

    def notes(self, sections, text: str, motifs: dict | None = None, vel: int = 0):
        for s in self._secs(sections):
            sec = self.song.sections[s]
            notes, total = parse(text, self.song.bpb, drums=self.drums, base_vel=96 + self.vel + vel,
                                 where=f'{self.song.id}/{self.name}/{s}: ')
            want = self.song.bpb * sec.bars
            if total != want:
                raise NotationError(f'{self.song.id}/{self.name}/{s}: notes last {float(total):g} beats, '
                                    f'the section has {sec.bars} bars ({float(want):g} beats)')
            self.bodies.setdefault(s, []).extend(notes)
            for bar, motif in (motifs or {}).items():
                name = motif.name if isinstance(motif, Motif) else str(motif)
                self.markers.append((s, self.song.bpb * (bar - 1), f'motif:{name}'))
        return self

    def at(self, sections, bar: int, text: str, vel: int = 0, motif=None):
        """Place a short phrase starting at `bar` (1-based) of a section; the phrase must be whole bars."""
        for s in self._secs(sections):
            notes, total = parse(text, self.song.bpb, drums=self.drums, base_vel=96 + self.vel + vel,
                                 where=f'{self.song.id}/{self.name}/{s}@{bar}: ')
            off = self.song.bpb * (bar - 1)
            if off + total > self.song.bpb * self.song.sections[s].bars:
                raise NotationError(f'{self.song.id}/{self.name}/{s}: phrase at bar {bar} runs past the section')
            self.bodies.setdefault(s, []).extend(n.shifted(off) for n in notes)
            if motif is not None:
                self.markers.append((s, off, f'motif:{motif.name if isinstance(motif, Motif) else motif}'))
        return self

    def pattern(self, sections, text: str, fills: dict | None = None, vel: int = 0):
        """Repeat a one-or-more-bar pattern over the whole section; `fills` = {bar: replacement bar text}."""
        for s in self._secs(sections):
            sec = self.song.sections[s]
            pat, plen = parse(text, self.song.bpb, drums=self.drums, base_vel=96 + self.vel + vel,
                              where=f'{self.song.id}/{self.name}/{s} pattern: ')
            nbars = int(plen / self.song.bpb)
            fl = {}
            for bar, ftxt in (fills or {}).items():
                fn, flen = parse(ftxt, self.song.bpb, drums=self.drums, base_vel=96 + self.vel + vel,
                                 where=f'{self.song.id}/{self.name}/{s} fill {bar}: ')
                fl[bar] = fn
            out = []
            b = 0
            while b < sec.bars:
                if (b + 1) in fl:
                    out += [n.shifted(self.song.bpb * b) for n in fl[b + 1]]
                    b += 1
                    continue
                for n in pat:
                    nb = b + int(n.start // self.song.bpb)
                    if nb < sec.bars and (nb + 1) not in fl:
                        out.append(n.shifted(self.song.bpb * b))
                b += nbars
            self.bodies.setdefault(s, []).extend(out)
        return self

    def gen(self, sections, kind: str, **opts):
        for s in self._secs(sections):
            sec = self.song.sections[s]
            if sec.grid is None:
                raise ValueError(f'{self.song.id}/{self.name}: section {s} has no chords for {kind}')
            o = dict(opts)
            key = parse_key(o.pop('key', None) or self.song.key)
            bars = o.pop('bars', None)          # (first, last) 1-based: keep only these bars of the output
            if 'vel' not in o:
                o['vel'] = {'bass': 100, 'comp': 80, 'pad': 70, 'arp': 76, 'chip': 74, 'drum': 0}.get(kind.split(':')[0][:4], 80) + self.vel
            else:
                o['vel'] += self.vel
            notes = G.generate(kind, sec.grid, key, self.song.bpb, o)
            if bars:
                lo, hi = self.song.bpb * (bars[0] - 1), self.song.bpb * bars[1]
                notes = [n for n in notes if lo <= n.start < hi]
            self.bodies.setdefault(s, []).extend(notes)
        return self

    def double(self, other: str, sections=None, octave: int = 0, vel: int = 0):
        self.doubles.append((other, None if sections is None else self._secs(sections), octave, vel))
        return self

    def mark(self, section: str, bar: int, text: str):
        self.markers.append((section, self.song.bpb * (bar - 1), text))
        return self


@dataclass
class TimelinePart:
    name: str
    role: str
    stem: str
    notes: list          # absolute Note objects (beats from render start), octave/vel applied
    gate: float | None
    pan: float | None
    gain: float = 0.0
    fx: dict | None = None


@dataclass
class Timeline:
    song: 'Song'
    intro_beats: Fr
    loop_beats: Fr            # 0 for one-shots
    pass_beats: Fr            # intro + loop (one pass) or the whole one-shot
    render_beats: Fr          # intro + 2 × loop (loops) or the whole one-shot
    parts: list
    markers: list             # (beat, text)
    sections: list            # (beat, name) for one pass
    chords: list              # (beat, length, symbol) for one pass


class Song:
    def __init__(self, id: str, title: str = '', bpm: float = 120, meter=(4, 4), key: str = 'C',
                 form=None, kind: str | None = None, swing: float = 0.0, mix: dict | None = None,
                 seam_beats: float | None = None, tail: float = 2.5, bus: str = 'music', lufs: float | None = None,
                 description: str = '', gate: float = 0.94, extra: dict | None = None, transpose: int = 0,
                 swing_unit: float = 1, swing_triplets: str = 'warp'):
        self.id = id
        self.title = title or id
        self.bpm = float(bpm)
        self.meter = tuple(meter)
        self.key = key
        self.form = list(form or [])
        self.swing = swing
        self.swing_unit = Fr(swing_unit).limit_denominator(64)   # swung cell in beats: 1 = 8th swing, 1/2 = 16th swing
        if swing_triplets not in ('warp', 'keep'):
            raise ValueError(f"{id}: swing_triplets must be 'warp' or 'keep'")
        self.swing_triplets = swing_triplets                     # 'keep': notes on a triplet grid are not moved
        self.mix = mix or {}
        self.seam_beats = seam_beats
        self.tail = tail
        self.bus = bus
        self.lufs = lufs
        self.description = description
        self.gate = gate
        self.extra = extra or {}
        self.transpose = transpose
        self.sections: dict[str, Section] = {}
        self.parts: dict[str, Part] = {}
        self.palette_hint = None
        has_loop = '|:' in self.form
        self.kind = kind or ('loop' if has_loop else 'oneshot')
        self.source = None

    # ---- building ------------------------------------------------------------------------------
    @property
    def bpb(self) -> Fr:
        num, den = self.meter
        return Fr(num * 4, den)

    def section(self, name: str, bars: int, chords: str | None = None, swing: float | None = None):
        grid = parse_grid(chords, bars, self.bpb) if chords else None
        self.sections[name] = Section(name, bars, chords, grid, swing)
        return self.sections[name]

    def part(self, name: str, role: str, stem: str = 'full', **kw) -> Part:
        if name in self.parts:
            raise ValueError(f'{self.id}: part {name!r} defined twice')
        validate_fx(kw.get('fx'), f'{self.id}/{name}: ')
        p = Part(self, name, role, stem, **kw)
        self.parts[name] = p
        return p

    # ---- structure -----------------------------------------------------------------------------
    def structure(self):
        """→ (intro sections, loop sections, outro sections) from the form."""
        if '|:' in self.form:
            i, j = self.form.index('|:'), self.form.index(':|')
            return self.form[:i], self.form[i + 1:j], self.form[j + 1:]
        return self.form, [], []

    def stems(self) -> list:
        seen = []
        for p in self.parts.values():
            if p.stem not in seen:
                seen.append(p.stem)
        return seen

    def roles(self) -> set:
        return {p.role for p in self.parts.values()}

    def _sec_beats(self, names):
        return sum((self.bpb * self.sections[n].bars for n in names), Fr(0))

    def _swing(self, t: Fr, amount=None) -> Fr:
        """Swing quantise (no audio stretching): inside each cell of `swing_unit` beats the first half is
        stretched to `amount` of the cell and the second half squeezed into the rest, so the offbeat 8th (or
        16th) lands at `amount` (0.5 = straight, 0.667 = triplet swing). Positions in between move
        proportionally ('warp'), except that with swing_triplets='keep' notes on a triplet grid stay put."""
        amount = self.swing if amount is None else amount
        if not amount:
            return t
        s = Fr(amount).limit_denominator(100)
        u = self.swing_unit
        q = t / u
        cell = q.numerator // q.denominator if q >= 0 else -((-q.numerator) // q.denominator) - 1
        f = q - cell
        if self.swing_triplets == 'keep' and f and f.denominator % 3 == 0:
            return t
        if f <= Fr(1, 2):
            return (cell + f * 2 * s) * u
        return (cell + s + (f - Fr(1, 2)) * 2 * (1 - s)) * u

    def timeline(self, passes: int | None = None) -> Timeline:
        intro, loop, outro = self.structure()
        for n in intro + loop + outro:
            if n not in self.sections:
                raise ValueError(f'{self.id}: form names unknown section {n!r}')
        if self.kind == 'loop' and not loop:
            raise ValueError(f'{self.id}: a loop needs |: … :| in the form')
        reps = passes if passes is not None else (2 if self.kind == 'loop' else 1)
        order = intro + loop * reps + (outro if self.kind != 'loop' else [])
        one_pass = intro + loop + (outro if self.kind != 'loop' else [])
        # resolve doubles once per section
        bodies = {name: {s: list(v) for s, v in p.bodies.items()} for name, p in self.parts.items()}
        for name, p in self.parts.items():
            for other, secs, octv, dv in p.doubles:
                if other not in self.parts:
                    raise ValueError(f'{self.id}/{name}: double() of unknown part {other!r}')
                for s, notes in self.parts[other].bodies.items():
                    if secs is not None and s not in secs:
                        continue
                    bodies[name].setdefault(s, []).extend(
                        replace(n, pitches=tuple(x + 12 * octv for x in n.pitches), vel=max(1, min(127, n.vel + dv + p.vel)))
                        for n in notes)
        parts = []
        for name, p in self.parts.items():
            out = []
            t = Fr(0)
            for s in order:
                sec = self.sections[s]
                amount = p.swing if p.swing is not None else (sec.swing if sec.swing is not None else self.swing)
                for n in bodies[name].get(s, []):
                    st = self._swing(t + n.start, amount)
                    en = self._swing(t + n.start + n.dur, amount)
                    ps = tuple(x + 12 * p.octave + self.transpose for x in n.pitches) if not p.drums else n.pitches
                    out.append(replace(n, start=st, dur=en - st, pitches=ps))
                t += self.bpb * sec.bars
            out.sort(key=lambda n: (n.start, n.pitches))
            parts.append(TimelinePart(name, p.role, p.stem, out, p.gate if p.gate is not None else self.gate, p.pan, p.gain,
                                      p.fx or None))
        markers, secs, chords = [], [], []
        t = Fr(0)
        for idx, s in enumerate(one_pass):
            secs.append((t, s))
            sec = self.sections[s]
            if sec.grid:
                for b, row in enumerate(sec.grid):
                    for st, ln, ch in row:
                        chords.append((t + self.bpb * b + st, ln, ch.symbol))
            for name, p in self.parts.items():
                for ms, beat, text in p.markers:
                    if ms == s:
                        markers.append((t + beat, f'{text}@{name}'))
            t += self.bpb * sec.bars
        return Timeline(self, self._sec_beats(intro), self._sec_beats(loop), self._sec_beats(one_pass),
                        self._sec_beats(order), parts, sorted(markers), secs, chords)

    # ---- serialisation -------------------------------------------------------------------------
    @classmethod
    def from_dict(cls, d: dict) -> 'Song':
        s = cls(**{k: d[k] for k in ('id', 'title', 'bpm', 'meter', 'key', 'form', 'kind', 'swing', 'mix',
                                     'seam_beats', 'tail', 'bus', 'lufs', 'description', 'gate', 'transpose',
                                     'swing_unit', 'swing_triplets') if k in d})
        for sec in d.get('sections', []):
            s.section(sec['name'], sec['bars'], sec.get('chords'), sec.get('swing'))
        for pd in d.get('parts', []):
            p = s.part(pd['name'], pd['role'], pd.get('stem', 'full'),
                       **{k: pd[k] for k in ('octave', 'vel', 'gate', 'pan', 'gain', 'swing', 'fx') if k in pd})
            for sec, text in (pd.get('notes') or {}).items():
                p.notes(sec, text)
            for sec, text in (pd.get('pattern') or {}).items():
                p.pattern(sec, text)
            for g in pd.get('gen') or []:
                g = dict(g)
                p.gen(g.pop('section'), g.pop('kind'), **g)
            for dbl in pd.get('double') or []:
                p.double(dbl['part'], dbl.get('sections'), dbl.get('octave', 0), dbl.get('vel', 0))
        return s


def load_songs(path: Path) -> list:
    """Load a song module (.py exposing `song` or `songs`) or a JSON song file."""
    path = Path(path)
    if path.suffix == '.json':
        data = json.loads(path.read_text())
        items = data if isinstance(data, list) else [data]
        out = [Song.from_dict(x) for x in items]
    else:
        songs_dir = str(path.parent)
        tools_dir = str(path.parent.parent)
        for p in (tools_dir, songs_dir):
            if p not in sys.path:
                sys.path.insert(0, p)
        spec = importlib.util.spec_from_file_location(f'songs.{path.stem}', path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        out = list(getattr(mod, 'songs', None) or [getattr(mod, 'song')])
    for s in out:
        s.source = path
    return out


def discover(songs_dir: Path) -> dict:
    """id → Song for every song file (skips motifs.py and files starting with '_')."""
    found = {}
    for f in sorted(Path(songs_dir).iterdir()):
        if f.name.startswith('_') or f.stem in ('motifs', '__init__') or f.suffix not in ('.py', '.json'):
            continue
        if f.suffix == '.json' and f.stem == 'standins':
            continue
        for s in load_songs(f):
            if s.id in found:
                raise ValueError(f'song id {s.id!r} defined in {found[s.id].source} and {f}')
            found[s.id] = s
    return found
