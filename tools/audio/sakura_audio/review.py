"""Review tooling (docs/AUDIO.md §6.1): analysis, gates, piano rolls, spectrograms, seam plots, HTML index.

    studio.py review demo|all      → tools/audio/build/<palette>/review/<song>/
                                       pianoroll.png  waveform.png  seams.png  spectrum.png  report.md  report.json
    studio.py review sfx           → tools/audio/build/<palette>/review/sfx/  contact.png  report.json
    every review also rewrites      tools/audio/build/<palette>/review/index.html  (opens from file://)

Pictures are drawn with numpy into an RGB raster and turned into PNG by ffmpeg (rawvideo → png, labels with
drawtext and the DejaVu font), so the toolkit needs no imaging packages. The piano roll shows time (bars,
sections, chord symbols), pitch, one colour per part (legend with role and stem), velocity as brightness, the
loop region shaded, and leitmotif boxes: solid = tagged in the song file (motif:NAME markers), thin = an
untagged interval match of a motif from songs/motifs.py (reuse you might not have meant).
"""
from __future__ import annotations

import colorsys
import html
import importlib.util
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

from . import checks as C
from .encode import decode
from .mix import read_wav, loudness
from .paths import BUILD, FFMPEG, FONT, SONGS, PUBLIC_SFX
from .notation import DRUM_NAMES

BG = (20, 21, 30)
GRID_BEAT = (34, 36, 48)
GRID_BAR = (62, 66, 88)
GRID_SECTION = (140, 146, 190)
LOOP_SHADE = (28, 34, 44)
TEXT = (226, 228, 240)
DIM = (150, 154, 175)
MOTIF_COLORS = {'BELL': (255, 214, 64), 'SENTINEL': (90, 170, 255), 'SHADOW': (190, 110, 255)}
MARK_COLORS = {'introEnd': (90, 220, 255), 'head': (255, 214, 64), 'loopStart': (120, 230, 120), 'entry': (255, 160, 60),
               'loopEnd': (255, 80, 90)}
BUDGET = {'opus': 11_000_000, 'aac': 13_000_000, 'total': 25_000_000, 'sprite': 300_000}


# ------------------------------------------------------------------------------------------------ raster
class Canvas:
    """Tiny RGB raster with rectangles, lines and text labels (drawn by ffmpeg drawtext on save)."""

    def __init__(self, w: int, h: int, bg=BG):
        self.w, self.h = int(w), int(h)
        self.px = np.zeros((self.h, self.w, 3), dtype=np.float32)
        self.px[:] = bg
        self.labels = []

    def rect(self, x0, y0, x1, y1, color, alpha=1.0):
        x0, x1 = sorted((int(round(x0)), int(round(x1))))
        y0, y1 = sorted((int(round(y0)), int(round(y1))))
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(self.w, max(x1, x0 + 1)), min(self.h, max(y1, y0 + 1))
        if x0 >= self.w or y0 >= self.h or x1 <= 0 or y1 <= 0:
            return
        reg = self.px[y0:y1, x0:x1]
        reg[:] = reg * (1 - alpha) + np.asarray(color, dtype=np.float32) * alpha

    def box(self, x0, y0, x1, y1, color, width=1):
        self.rect(x0, y0, x1, y0 + width, color)
        self.rect(x0, y1 - width, x1, y1, color)
        self.rect(x0, y0, x0 + width, y1, color)
        self.rect(x1 - width, y0, x1, y1, color)

    def vline(self, x, y0, y1, color, alpha=1.0, width=1):
        self.rect(x, y0, x + width, y1, color, alpha)

    def hline(self, y, x0, x1, color, alpha=1.0, width=1):
        self.rect(x0, y, x1, y + width, color, alpha)

    def text(self, x, y, s, color=TEXT, size=12):
        if s:
            self.labels.append((int(x), int(y), str(s), color, size))

    def wave(self, x0, y0, w, h, y: np.ndarray, color, scale=1.0, mid_color=(60, 64, 80)):
        """Min/max waveform of y (mono) into the box, one column per pixel."""
        self.hline(y0 + h // 2, x0, x0 + w, mid_color)
        if not len(y):
            return
        n = len(y)
        edges = np.linspace(0, n, w + 1).astype(int)
        for i in range(w):
            a, b = edges[i], max(edges[i + 1], edges[i] + 1)
            seg = y[a:min(b, n)]
            if not len(seg):
                continue
            lo, hi = float(seg.min()) * scale, float(seg.max()) * scale
            ya = y0 + h / 2 - max(-1.0, min(1.0, hi)) * (h / 2 - 1)
            yb = y0 + h / 2 - max(-1.0, min(1.0, lo)) * (h / 2 - 1)
            self.rect(x0 + i, ya, x0 + i + 1, yb + 1, color)

    def save(self, path: Path) -> Path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        rgb = np.clip(self.px, 0, 255).astype(np.uint8)
        with tempfile.TemporaryDirectory() as td:
            raw = Path(td) / 'img.rgb'
            raw.write_bytes(rgb.tobytes())
            filters = []
            for i, (x, y, s, col, size) in enumerate(self.labels):
                tf = Path(td) / f't{i:05d}.txt'
                tf.write_text(s)
                filters.append(f"drawtext=fontfile={FONT}:textfile={tf}:expansion=none:x={x}:y={y}:fontsize={size}:"
                               f"fontcolor=0x{col[0]:02x}{col[1]:02x}{col[2]:02x}")
            cmd = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                   '-s', f'{self.w}x{self.h}', '-i', str(raw)]
            if filters:
                fs = Path(td) / 'filters.txt'
                fs.write_text(','.join(filters))
                cmd += ['-filter_script:v', str(fs)]
            cmd += ['-frames:v', '1', '-update', '1', str(path)]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if res.returncode != 0:
                raise RuntimeError(f'ffmpeg png failed: {res.stderr[-600:]}')
        return path


def part_color(i: int, n: int):
    h = (i * 0.61803398875) % 1.0
    r, g, b = colorsys.hsv_to_rgb(h, 0.62, 1.0)
    return (int(r * 255), int(g * 255), int(b * 255))


# ------------------------------------------------------------------------------------------------ motifs
def load_motifs(songs_dir: Path = SONGS) -> dict:
    """name → list of interval patterns (major, minor and modal forms) from songs/motifs.py."""
    path = songs_dir / 'motifs.py'
    if not path.exists():
        return {}
    for p in (str(songs_dir.parent), str(songs_dir)):
        if p not in sys.path:
            sys.path.insert(0, p)
    spec = importlib.util.spec_from_file_location('songs_motifs_review', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    out: dict = {}
    for v in vars(mod).values():
        if type(v).__name__ != 'Motif':
            continue
        forms = [tuple(v.major), tuple(v.minor)] + [tuple(m[0]) for m in getattr(v, 'modes', {}).values()]
        pats = {tuple(b - a for a, b in zip(f, f[1:])) for f in forms if len(f) >= 3}
        out.setdefault(v.name, set()).update(pats)
    return {k: sorted(v) for k, v in out.items()}


def melodic_line(notes) -> list:
    """Monophonic reading of a part: the top pitch of each onset → [(start, end, pitch)]."""
    by_start: dict = {}
    for n in notes:
        if not n.pitches:
            continue
        s = float(n.start)
        top = max(n.pitches)
        if s not in by_start or top > by_start[s][1]:
            by_start[s] = (float(n.start + n.dur), top)
    return [(s, e, p) for s, (e, p) in sorted(by_start.items())]


def find_motif_matches(line, patterns, max_gap=1.0) -> list:
    """Occurrences of any interval pattern in a melodic line (consecutive notes, gaps ≤ max_gap beats)."""
    hits = []
    pitches = [p for _, _, p in line]
    for pat in patterns:
        k = len(pat)
        for i in range(len(line) - k):
            if any(line[i + j + 1][0] - line[i + j][1] > max_gap for j in range(k)):
                continue
            if all(pitches[i + j + 1] - pitches[i + j] == pat[j] for j in range(k)):
                hits.append((i, i + k))
    return hits


# ------------------------------------------------------------------------------------------------ piano roll
def piano_roll(song, out: Path, palette=None) -> Path:
    """Piano roll of one pass (intro + loop body) with chords, sections, motifs and a legend."""
    if palette is not None:
        song.palette_hint = palette
    tl = song.timeline(passes=1)
    beats = float(tl.render_beats)
    bpb = float(song.bpb)
    is_drum = {name: p.drums for name, p in song.parts.items()}
    mel = [tp for tp in tl.parts if tp.notes and not is_drum.get(tp.name)]
    kit = [tp for tp in tl.parts if tp.notes and is_drum.get(tp.name)]
    pitches = [p for tp in mel for n in tp.notes for p in n.pitches]
    pmin, pmax = (min(pitches) - 2, max(pitches) + 2) if pitches else (48, 84)
    drum_notes = sorted({p for tp in kit for n in tp.notes for p in n.pitches})
    ppb = max(10, min(48, int(2800 / max(beats, 1))))
    rh = 5 if pmax - pmin <= 60 else 4
    dh = 9
    ML, MR, TOP = 64, 12, 70
    roll_h = (pmax - pmin + 1) * rh
    drum_h = len(drum_notes) * dh + (14 if drum_notes else 0)
    parts_sorted = sorted([tp for tp in tl.parts if tp.notes], key=lambda t: (t.stem, t.name))
    col_w, row_h = 300, 15
    W = int(ML + beats * ppb + MR)
    cols = max(1, (W - 20) // col_w)
    legend_rows = math.ceil(len(parts_sorted) / cols) + 2
    H = TOP + roll_h + drum_h + 24 + legend_rows * row_h + 20
    cv = Canvas(W, H)
    xb = lambda b: ML + b * ppb
    yp = lambda p: TOP + (pmax - p) * rh
    y_drum0 = TOP + roll_h + 14

    # loop shading + grid
    if song.kind == 'loop':
        cv.rect(xb(float(tl.intro_beats)), TOP, xb(beats), TOP + roll_h + drum_h, LOOP_SHADE)
        cv.text(xb(float(tl.intro_beats)) + 4, TOP + roll_h + drum_h + 4, 'loop body', DIM, 11)
    for p in range(pmin, pmax + 1):
        if p % 12 == 0:
            cv.hline(yp(p) + rh - 1, ML, xb(beats), (44, 46, 62))
            cv.text(6, yp(p) - 4, f'C{p // 12 - 1}', DIM, 11)
    nb = int(round(beats))
    for b in range(nb + 1):
        bar_line = abs(b / bpb - round(b / bpb)) < 1e-6
        cv.vline(xb(b), TOP, TOP + roll_h + drum_h, GRID_BAR if bar_line else GRID_BEAT)
        if bar_line and b < nb:
            bar_no = int(round(b / bpb)) + 1
            if ppb * bpb >= 28 or bar_no % 2 == 1:
                cv.text(xb(b) + 3, 4, str(bar_no), DIM, 11)
    for beat, name in tl.sections:
        x = xb(float(beat))
        cv.vline(x, 18, TOP + roll_h + drum_h, GRID_SECTION, width=2)
        cv.text(x + 4, 20, name, TEXT, 13)
    for beat, length, sym in tl.chords:
        cv.text(xb(float(beat)) + 3, 42, sym, (255, 230, 170), 12)
    if drum_notes:
        cv.hline(y_drum0 - 7, ML, xb(beats), GRID_SECTION)
        rev = {}
        for k, v in DRUM_NAMES.items():
            rev.setdefault(v, k)
        for i, dn in enumerate(drum_notes):
            cv.text(6 + (i % 2) * 26, y_drum0 + i * dh - 2, rev.get(dn, str(dn)), DIM, 9)

    # notes
    colors = {tp.name: part_color(i, len(parts_sorted)) for i, tp in enumerate(parts_sorted)}
    for tp in mel + kit:
        col = np.asarray(colors[tp.name], dtype=np.float32)
        for n in tp.notes:
            bright = 0.35 + 0.65 * min(1.0, n.vel / 127)
            c = tuple(col * bright)
            x0 = xb(float(n.start))
            x1 = max(x0 + 2, xb(float(n.start + n.dur)) - 1)
            for p in n.pitches:
                if is_drum.get(tp.name):
                    if p in drum_notes:
                        y = y_drum0 + drum_notes.index(p) * dh
                        cv.rect(x0, y, x0 + max(3, ppb // 6), y + dh - 1, c)
                else:
                    cv.rect(x0, yp(p), x1, yp(p) + rh - 1, c)

    # motif boxes: tagged (solid) and heuristic (thin)
    motifs = load_motifs()
    tagged = []
    by_name = {tp.name: tp for tp in tl.parts}
    for beat, text in tl.markers:
        if not text.startswith('motif:'):
            continue
        mname, _, pname = text[6:].partition('@')
        tp = by_name.get(pname)
        if tp is None or is_drum.get(pname):
            continue
        line = [x for x in melodic_line(tp.notes) if x[0] >= float(beat) - 1e-6]
        k = (len(motifs[mname][0]) + 1) if motifs.get(mname) else 4
        seg = line[:k]
        if not seg:
            continue
        tagged.append((pname, round(seg[0][0], 4)))
        col = MOTIF_COLORS.get(mname, (255, 255, 255))
        x0, x1 = xb(seg[0][0]) - 2, xb(max(e for _, e, _ in seg)) + 2
        y0, y1 = yp(max(p for *_, p in seg)) - 3, yp(min(p for *_, p in seg)) + rh + 3
        cv.box(x0, y0, x1, y1, col, 2)
        cv.text(x0 + 2, y0 - 14, mname, col, 11)
    for tp in mel:
        line = melodic_line(tp.notes)
        for mname, pats in motifs.items():
            for i, j in find_motif_matches(line, pats):
                if (tp.name, round(line[i][0], 4)) in tagged:
                    continue
                seg = line[i:j + 1]
                col = tuple(int(c * 0.75) for c in MOTIF_COLORS.get(mname, (200, 200, 200)))
                x0, x1 = xb(seg[0][0]) - 1, xb(max(e for _, e, _ in seg)) + 1
                y0, y1 = yp(max(p for *_, p in seg)) - 2, yp(min(p for *_, p in seg)) + rh + 2
                cv.box(x0, y0, x1, y1, col, 1)

    # legend
    ly = TOP + roll_h + drum_h + 24
    cv.text(10, ly, f'{song.title} — {song.id}  ·  {song.bpm:g} bpm  ·  {song.key}  ·  {song.meter[0]}/{song.meter[1]}  ·  '
            f'{len(parts_sorted)} parts  ·  stems {", ".join(song.stems())}  ·  boxes: BELL yellow, SENTINEL blue, '
            f'SHADOW purple (thick = tagged, thin = interval match)', TEXT, 12)
    for i, tp in enumerate(parts_sorted):
        c, r = i % cols, i // cols
        x, y = 10 + c * col_w, ly + (r + 1) * row_h + 6
        cv.rect(x, y + 2, x + 10, y + 11, colors[tp.name])
        cv.text(x + 15, y, f'{tp.name}: {tp.role} [{tp.stem}]', DIM, 11)
    return cv.save(out)


# ------------------------------------------------------------------------------------------------ pictures
def waveform_png(F: np.ndarray, rate: int, entry: dict, out: Path) -> Path:
    W, H = 1600, 260
    cv = Canvas(W, H)
    mono = F.mean(axis=1) if F.ndim > 1 else F
    cv.wave(0, 30, W, H - 60, mono, (120, 200, 255))
    n = len(mono)
    for k, col in MARK_COLORS.items():
        if k in entry and entry[k] is not None:
            x = entry[k] / n * W
            cv.vline(x, 24, H - 26, col, width=2)
    x_lab = 6
    for k, col in MARK_COLORS.items():
        if k in entry:
            cv.text(x_lab, 6, f'{k} {entry[k] / rate:.3f}s', col, 12)
            x_lab += 200
    cv.text(6, H - 20, f'file {n / rate:.3f} s @ {rate} Hz — the head plays once, then the loop body repeats from loopStart '
            f'(entered at entry)', DIM, 11)
    return cv.save(out)


def seam_rows(F, R, Fd: dict, entry: dict, rate: int):
    """[(label, spliced, reference)] for the WAV and every decoded format, wrap and entry seams."""
    L0, T = entry['introEnd'], entry['seam']
    ls, le, head, en = entry['loopStart'], entry['loopEnd'], entry['head'], entry['entry']
    P = le - ls
    n = int(rate * 0.05)
    rows = [('WAV  loop wrap  (loopEnd → loopStart)', np.concatenate([F[le - n:le], F[ls:ls + n]]), R[L0 + P - n:L0 + P + n]),
            ('WAV  entry  (head → entry)', np.concatenate([F[head - n:head], F[en:en + n]]), R[L0 + T - n:L0 + T + n])]
    for fmt, d in Fd.items():
        rows.append((f'{fmt}  loop wrap (decoded)', np.concatenate([d[le - n:le], d[ls:ls + n]]), d[ls - n:ls + n]))
        rows.append((f'{fmt}  entry (decoded)', np.concatenate([d[head - n:head], d[en:en + n]]), d[head - n:head + n]))
    return rows, n


def seams_png(rows, n, out: Path) -> Path:
    W, ph = 1600, 64
    H = 10 + len(rows) * (3 * ph + 34)
    cv = Canvas(W, H)
    y = 8
    for label, spliced, ref in rows:
        a = spliced.mean(axis=1) if spliced.ndim > 1 else spliced
        b = ref.mean(axis=1) if ref.ndim > 1 else ref
        m = min(len(a), len(b))
        diff = a[:m] - b[:m]
        r_db = C.db(C.rms(diff))
        click = C.click_ratio(spliced[:m], n) / max(1.0, C.click_ratio(ref[:m], n))
        cv.text(8, y, f'{label}:  rms diff {r_db:.1f} dB,  click ratio {click:.2f}   (top: as played, middle: continuous '
                f'reference, bottom: difference x10)', TEXT, 12)
        y += 18
        peak = max(1e-6, float(np.abs(b).max()), float(np.abs(a).max()))
        cv.wave(0, y, W, ph, a / peak, (120, 220, 140))
        cv.wave(0, y + ph, W, ph, b / peak, (120, 180, 255))
        cv.wave(0, y + 2 * ph, W, ph, diff * 10 / peak, (255, 110, 110))
        cv.vline(W // 2, y, y + 3 * ph, (255, 214, 64))
        y += 3 * ph + 16
    return cv.save(out)


def spectrum_png(wav: Path, out: Path) -> Path:
    out.parent.mkdir(parents=True, exist_ok=True)
    res = subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav), '-lavfi',
                          'showspectrumpic=s=1600x600:legend=1:scale=log:fscale=log:mode=combined', '-frames:v', '1',
                          '-update', '1', str(out)], capture_output=True, text=True, timeout=300)
    if res.returncode != 0:
        raise RuntimeError(f'spectrum failed: {res.stderr[-400:]}')
    return out


# ------------------------------------------------------------------------------------------------ song review
def _gate(name, ok, value, limit):
    return {'gate': name, 'ok': bool(ok), 'value': value, 'limit': limit}


def review_song(song, palette, build_root: Path = BUILD) -> Path:
    """Analysis + pictures + report for a song rendered with `studio.py render` (reads build/<palette>/)."""
    song.palette_hint = palette
    pal_dir = build_root / palette.id
    man = json.loads((pal_dir / 'manifest.json').read_text()) if (pal_dir / 'manifest.json').exists() else {'tracks': {}}
    entry = man['tracks'].get(song.id)
    out = pal_dir / 'review' / song.id
    out.mkdir(parents=True, exist_ok=True)
    piano_roll(song, out / 'pianoroll.png', palette)
    if entry is None:
        (out / 'report.md').write_text(f'# {song.title} ({song.id})\n\nNot rendered yet: `studio.py render {song.id} '
                                       f'--palette {palette.id}`.\n')
        return out
    mix_dir = pal_dir / 'mix' / song.id
    rate, F = read_wav(mix_dir / 'full.wav')
    _, R = read_wav(mix_dir / 'full.R.wav')
    loop = entry['kind'] == 'loop'
    stems = {}
    for name in entry['stems']:
        _, x = read_wav(mix_dir / f'{name}.wav')
        stems[name] = x
    # decoded full mixes (sum of decoded stems), as the browser would play them
    Fd = {}
    for fmt, ext in (('opus', 'webm'), ('aac', 'm4a')):
        acc = None
        for name, st in entry['stems'].items():
            p = pal_dir / 'enc' / f'{st["file"]}.{ext}'
            if not p.exists():
                acc = None
                break
            d = decode(p, rate)[:len(F)]
            if len(d) < len(F):
                d = np.concatenate([d, np.zeros((len(F) - len(d), 2))])
            acc = d if acc is None else acc + d
        if acc is not None:
            Fd[fmt] = acc

    rep = {'id': song.id, 'title': song.title, 'kind': entry['kind'], 'palette': palette.id, 'bpm': entry['bpm'],
           'key': entry['key'], 'seconds': round(len(F) / rate, 3), 'stems': {}, 'gates': []}
    body = (slice(entry['loopStart'], entry['loopEnd']) if loop else slice(0, len(F)))
    full_meas = loudness(F[body], rate)
    rep['full'] = {k: round(v, 2) for k, v in full_meas.items()}
    for name, x in stems.items():
        m = loudness(x[body], rate)
        rep['stems'][name] = {'lufs': round(m['lufs'], 1), 'lra': round(m['lra'], 1), 'truePeak': round(m['truePeak'], 1),
                              'samplePeak': round(m['samplePeak'], 1), 'samples': len(x),
                              'bytes': entry['stems'][name].get('bytes', {})}
    target = entry['checks']['loudness']['target']
    g = rep['gates']
    g.append(_gate('loudness (full mix)', abs(full_meas['lufs'] - target) <= 0.5 or entry.get('peakLimited'),
                   f'{full_meas["lufs"]:.1f} LUFS', f'{target:g} ± 0.5 LUFS'))
    g.append(_gate('true peak', full_meas['truePeak'] <= -0.95, f'{full_meas["truePeak"]:.1f} dBTP', '≤ −1.0 dBTP'))
    lv = C.basic_levels(F)
    g.append(_gate('sample peak / DC', lv['ok'], f'{lv["samplePeakDb"]} dBFS / {lv["dc"]}', '≤ −0.5 dBFS / < 0.001'))
    lengths = {len(x) for x in stems.values()}
    g.append(_gate('stems equal length', len(lengths) == 1, ', '.join(f'{k} {len(x)}' for k, x in stems.items()), 'all equal'))
    resid = C.db(C.rms(sum(stems.values()) - F)) if stems else -200
    g.append(_gate('Σ stems = full mix', resid < -50, f'{resid:.1f} dB', '< −50 dB'))
    if loop:
        li = C.loop_identity(R, entry['introEnd'], entry['loopEnd'] - entry['loopStart'], entry['seam'])
        g.append(_gate('loop identity (cycle 1 vs 2)', li['ok'], f'{li["rmsDiffDb"]} dB', '< −60 dB'))
        ws = C.wav_seams(F, R, entry)
        for k in ('wrap', 'entry'):
            g.append(_gate(f'WAV {k} seam', ws[k]['ok'], f'{ws[k]["rmsDiffDb"]} dB, click {ws[k]["click"]}', '< −60 dB, click < 3'))
    for fmt, d in Fd.items():
        al = C.alignment(d, F)
        g.append(_gate(f'{fmt} alignment', al['ok'], f'lag {al["lag"]}', 'lag 0'))
        if loop:
            es = C.encoded_seams(d, entry, F)
            for k in ('wrap', 'entry'):
                g.append(_gate(f'{fmt} {k} seam (decoded)', es[k]['ok'],
                               f'{es[k]["rmsDiffDb"]} dB, click {es[k]["click"]}', f'< {es[k]["limitDb"]:.1f} dB (codec noise '
                               f'{es["codecNoiseDb"]} dB + 6), click < 3'))
    rep['ok'] = all(x['ok'] for x in g)
    rep['bytes'] = {f: sum(st['bytes'].get(f, 0) for st in entry['stems'].values()) for f in ('opus', 'aac')}
    rep['markers'] = entry.get('markers', {})
    rep['positions'] = {k: entry[k] for k in ('introEnd', 'seam', 'guard', 'head', 'loopStart', 'loopEnd', 'entry', 'length')
                        if k in entry}

    waveform_png(F, rate, entry, out / 'waveform.png')
    if loop:
        rows, n = seam_rows(F, R, Fd, entry, rate)
        seams_png(rows, n, out / 'seams.png')
    spectrum_png(mix_dir / 'full.wav', out / 'spectrum.png')
    (out / 'report.json').write_text(json.dumps(rep, indent=1, ensure_ascii=False) + '\n')
    lines = [f'# {song.title} (`{song.id}`)', '',
             f'{entry["kind"]}, {entry["bpm"]} bpm (written {entry.get("bpmWritten")}), key {entry["key"]}, palette `{palette.id}`, '
             f'{rep["seconds"]} s file; Opus {rep["bytes"]["opus"]:,} B, AAC {rep["bytes"]["aac"]:,} B.', '',
             '| Gate | Result | Value | Limit |', '|---|---|---|---|']
    lines += [f'| {x["gate"]} | {"PASS" if x["ok"] else "FAIL"} | {x["value"]} | {x["limit"]} |' for x in g]
    lines += ['', '| Stem | LUFS | LRA | True peak | Samples | Opus B | AAC B |', '|---|---|---|---|---|---|---|']
    lines += [f'| {k} | {v["lufs"]} | {v["lra"]} | {v["truePeak"]} | {v["samples"]} | {v["bytes"].get("opus", 0):,} | '
              f'{v["bytes"].get("aac", 0):,} |' for k, v in rep['stems'].items()]
    lines += ['', '![piano roll](pianoroll.png)', '', '![waveform](waveform.png)', '']
    if loop:
        lines += ['![seams](seams.png)', '']
    lines += ['![spectrum](spectrum.png)', '']
    (out / 'report.md').write_text('\n'.join(lines))
    return out


# ------------------------------------------------------------------------------------------------ SFX review
def momentary_max(x: np.ndarray, rate: int) -> float:
    """Max momentary loudness (LUFS, 400 ms window) of a short mono sound (padded with silence)."""
    pad = np.concatenate([np.zeros(int(rate * 0.1)), x, np.zeros(int(rate * 0.5))])
    with tempfile.TemporaryDirectory() as td:
        from .mix import write_wav
        p = write_wav(Path(td) / 's.wav', pad[:, None], rate)
        res = subprocess.run([FFMPEG, '-hide_banner', '-nostats', '-v', 'verbose', '-i', str(p), '-af', 'ebur128=framelog=verbose', '-f', 'null', '-'],
                             capture_output=True, text=True, timeout=60)
    vals = []
    for line in res.stderr.splitlines():
        if ' M:' in line:
            try:
                vals.append(float(line.split(' M:')[1].split()[0]))
            except (ValueError, IndexError):
                pass
    return max(vals) if vals else float('-inf')


def spectro_tile(cv: Canvas, x0, y0, w, h, x: np.ndarray, rate: int):
    from scipy import signal
    if len(x) < 64:
        return
    nper = 256 if len(x) >= 256 else 64
    f, t, Z = signal.stft(x, fs=rate, nperseg=nper, noverlap=nper * 3 // 4)
    mag = 20 * np.log10(np.abs(Z) + 1e-9)
    mag = np.clip((mag - mag.max() + 72) / 72, 0, 1)
    fl = np.geomspace(60, rate / 2, h + 1)
    stops = np.array([(0, 0, 4), (80, 18, 123), (182, 54, 121), (251, 136, 97), (252, 253, 191)], dtype=np.float32)
    cols = np.linspace(0, mag.shape[1], w + 1).astype(int)
    for i in range(h):
        rows = (f >= fl[i]) & (f < fl[i + 1])
        if not rows.any():
            rows = np.zeros(len(f), bool)
            rows[min(len(f) - 1, np.searchsorted(f, fl[i]))] = True
        band = mag[rows].max(axis=0)
        for j in range(w):
            a, b = cols[j], max(cols[j + 1], cols[j] + 1)
            v = float(band[a:min(b, len(band))].max()) if a < len(band) else 0.0
            k = v * (len(stops) - 1)
            lo = int(min(len(stops) - 2, k))
            c = stops[lo] + (stops[lo + 1] - stops[lo]) * (k - lo)
            cv.px[y0 + h - 1 - i, x0 + j] = c


def review_sfx(palette, build_root: Path = BUILD) -> Path:
    """Contact sheet (waveform + spectrogram per SFX) and a loudness table from tools/audio/build/sfx/."""
    src = build_root / 'sfx'
    sprite_path = src / 'sprite.json' if (src / 'sprite.json').exists() else PUBLIC_SFX / 'sprite.json'
    sprite = json.loads(sprite_path.read_text())
    out = build_root / palette.id / 'review' / 'sfx'
    out.mkdir(parents=True, exist_ok=True)
    ids = sorted(sprite['sounds'])
    rate = sprite['rate']
    tile_w, tile_h, cols = 260, 120, 6
    rows = math.ceil(len(ids) / cols)
    cv = Canvas(cols * tile_w + 10, rows * tile_h + 40)
    cv.text(8, 8, f'SFX contact sheet — {len(ids)} sounds, palette {sprite.get("palette")}; per tile: id, duration, gain, '
            f'event loudness (momentary max over the sound\'s own length + gain_db); waveform; log-frequency spectrogram (60 Hz … 16 kHz)', TEXT, 12)
    table = {}
    for i, sid in enumerate(ids):
        s = sprite['sounds'][sid]
        wav = src / 'wav' / f'{sid}.wav'
        if wav.exists():
            _, x = read_wav(wav)
            x = x[:, 0] if x.ndim > 1 else x
        else:
            continue
        mm = momentary_max(x, rate)
        eff = mm + s['gain_db']
        # a 400 ms momentary window dilutes short blips: compensate to the sound's own length (≥ 50 ms)
        event = eff + 10 * math.log10(0.4 / max(0.05, len(x) / rate))
        table[sid] = {'ms': round(len(x) / rate * 1000), 'peakDb': round(C.db(np.abs(x).max()), 1), 'momentaryMax': round(mm, 1),
                      'effective': round(eff, 1), 'event': round(min(eff, event) if len(x) / rate > 0.4 else event, 1),
                      'gain_db': s['gain_db'], 'bus': s['bus'], 'voices': s['voices'],
                      'gap_ms': s['gap_ms'], 'priority': s['priority']}
        cx, cy = 5 + (i % cols) * tile_w, 30 + (i // cols) * tile_h
        cv.rect(cx, cy, cx + tile_w - 6, cy + tile_h - 6, (28, 30, 42))
        cv.text(cx + 4, cy + 2, sid, (255, 230, 170) if s['bus'] == 'ui' else (150, 210, 255), 12)
        cv.text(cx + 4, cy + 16, f'{table[sid]["ms"]} ms  {s["gain_db"]:+g} dB  event {table[sid]["event"]:.1f} LUFS', DIM, 10)
        cv.wave(cx + 4, cy + 30, tile_w - 14, 34, x / max(1e-6, np.abs(x).max()), (120, 220, 140))
        spectro_tile(cv, cx + 4, cy + 66, tile_w - 14, 46, x, rate)
    cv.save(out / 'contact.png')
    ui = [v['event'] for k, v in table.items() if k.split('.')[0] == 'ui' and k not in ('ui.start',)]
    hits = [v['event'] for k, v in table.items() if k.startswith('hit.')]
    ui = [v for v in ui if math.isfinite(v)]
    hits = [v for v in hits if math.isfinite(v)]
    gap = float(np.median(hits) - np.median(ui)) if ui and hits else None
    rep = {'count': len(table), 'sounds': table,
           'uiVsHitsLU': None if gap is None else round(gap, 1),
           'note': 'event = momentary-max loudness compensated to the sound length, plus gain_db. uiVsHitsLU = median(hit.*) − '
                   'median(ui.*) event loudness; the design aims at about +6 (UI blips quieter than battle hits). Ears decide.',
           'bytes': {k: (PUBLIC_SFX / v).stat().st_size for k, v in sprite['files'].items() if (PUBLIC_SFX / v).exists()}}
    (out / 'report.json').write_text(json.dumps(rep, indent=1) + '\n')
    return out


# ------------------------------------------------------------------------------------------------ index
def write_index(palette, build_root: Path = BUILD) -> Path:
    pal_dir = build_root / palette.id
    rv = pal_dir / 'review'
    rv.mkdir(parents=True, exist_ok=True)
    man = json.loads((pal_dir / 'manifest.json').read_text()) if (pal_dir / 'manifest.json').exists() else {'tracks': {}}
    tracks = man['tracks']
    tot = {f: sum(st['bytes'].get(f, 0) for t in tracks.values() for st in t['stems'].values()) for f in ('opus', 'aac')}
    e = html.escape
    h = ['<!doctype html><meta charset="utf-8"><title>Audio review — ' + e(palette.id) + '</title>',
         '<style>body{font:14px system-ui,sans-serif;background:#14151e;color:#e2e4f0;margin:24px;max-width:1700px}'
         'img{max-width:100%;border:1px solid #333;margin:6px 0}table{border-collapse:collapse;margin:8px 0}'
         'td,th{border:1px solid #3a3d52;padding:3px 8px;text-align:left}.ok{color:#7be07b}.bad{color:#ff6b6b}'
         'audio{height:32px;vertical-align:middle}h2{margin-top:40px}a{color:#9cc8ff}code{color:#ffd88a}</style>',
         f'<h1>Audio review — palette <code>{e(palette.id)}</code></h1>',
         f'<p>Music total: Opus {tot["opus"]:,} B (budget {BUDGET["opus"]:,}), AAC {tot["aac"]:,} B (budget {BUDGET["aac"]:,}). '
         'Regenerate with <code>python tools/audio/studio.py review all</code>.</p>',
         '<table><tr><th>Track</th><th>Kind</th><th>bpm</th><th>Key</th><th>LUFS</th><th>TP</th><th>Stems</th><th>Gates</th></tr>']
    reports = {}
    for tid, t in tracks.items():
        rp = rv / tid / 'report.json'
        reports[tid] = json.loads(rp.read_text()) if rp.exists() else None
        r = reports[tid]
        gates = '—' if r is None else (f'<span class="{"ok" if r["ok"] else "bad"}">'
                                       f'{sum(x["ok"] for x in r["gates"])}/{len(r["gates"])} pass</span>')
        h.append(f'<tr><td><a href="#{e(tid)}">{e(t["title"])}</a> <code>{e(tid)}</code></td><td>{e(t["kind"])}</td>'
                 f'<td>{t["bpm"]}</td><td>{e(str(t["key"]))}</td><td>{t["lufs"]}</td><td>{t["truePeak"]}</td>'
                 f'<td>{e(", ".join(t["stems"]))}</td><td>{gates}</td></tr>')
    h.append('</table>')
    for tid, t in tracks.items():
        r = reports[tid]
        h.append(f'<h2 id="{e(tid)}">{e(t["title"])} <code>{e(tid)}</code></h2>')
        h.append(f'<p>full mix (WAV, loop file): <audio controls preload="none" src="../mix/{e(tid)}/full.wav"></audio> '
                 f'continuous render: <audio controls preload="none" src="../mix/{e(tid)}/full.R.wav"></audio></p><p>')
        for name, st in t['stems'].items():
            h.append(f'{e(name)}: <audio controls preload="none" src="../enc/{e(st["file"])}.webm"></audio> '
                     f'<a href="../enc/{e(st["file"])}.m4a">m4a</a> &nbsp; ')
        h.append('</p>')
        if r:
            h.append('<table><tr><th>Gate</th><th>Result</th><th>Value</th><th>Limit</th></tr>')
            for x in r['gates']:
                h.append(f'<tr><td>{e(x["gate"])}</td><td class="{"ok" if x["ok"] else "bad"}">{"PASS" if x["ok"] else "FAIL"}</td>'
                         f'<td>{e(str(x["value"]))}</td><td>{e(str(x["limit"]))}</td></tr>')
            h.append('</table>')
        for img in ('pianoroll', 'waveform', 'seams', 'spectrum'):
            if (rv / tid / f'{img}.png').exists():
                h.append(f'<div><img src="{e(tid)}/{img}.png" alt="{img}"></div>')
    if (rv / 'sfx' / 'report.json').exists():
        sr = json.loads((rv / 'sfx' / 'report.json').read_text())
        h.append(f'<h2 id="sfx">SFX ({sr["count"]})</h2><p>UI blips vs battle hits: UI {sr["uiVsHitsLU"]} LU quieter (design aim ≈ 6; ears decide). '
                 f'Sprite bytes: {sr.get("bytes")}</p><img src="sfx/contact.png" alt="sfx contact sheet">')
        h.append('<table><tr><th>id</th><th>bus</th><th>ms</th><th>gain</th><th>effective LUFS</th><th>voices</th><th>gap ms</th>'
                 '<th>priority</th><th>listen</th></tr>')
        for sid, v in sr['sounds'].items():
            h.append(f'<tr><td>{e(sid)}</td><td>{v["bus"]}</td><td>{v["ms"]}</td><td>{v["gain_db"]:+g}</td><td>{v["effective"]}</td>'
                     f'<td>{v["voices"]}</td><td>{v["gap_ms"]}</td><td>{v["priority"]}</td><td>{v["event"]}</td>'
                     f'<td><audio controls preload="none" src="../../sfx/wav/{e(sid)}.wav"></audio></td></tr>')
        h.append('</table>')
    out = rv / 'index.html'
    out.write_text('\n'.join(h) + '\n')
    return out
