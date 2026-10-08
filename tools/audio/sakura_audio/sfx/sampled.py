"""Tiny MIDI phrases rendered through the current palette (orchestra hit, choir, harp gliss, taiko …), so
`--palette toby` changes those SFX too. Cached through the render job cache."""
from __future__ import annotations

import hashlib
from fractions import Fraction as Fr

import numpy as np

from ..midi import snap_tempo
from ..notation import bars_of
from ..paths import BUILD
from ..render import plan_jobs, render_jobs, read_wav
from ..song import Song


def sampled(palette, role: str, text: str, bpm: float = 120, tail: float = 1.2, vel: int = 0) -> np.ndarray:
    key = hashlib.sha1(f'{role}|{text}|{bpm}|{vel}'.encode()).hexdigest()[:12]
    s = Song(id=f'sfx_{key}', bpm=bpm, form=['S'], kind='oneshot', tail=tail)
    s.palette_hint = palette
    s.section('S', bars_of(text))
    s.part('p', role, 'full', vel=vel).notes('S', text)
    tl = s.timeline()
    tempo = snap_tempo(bpm, 0, 0, int(palette.render['rate']))
    end = tl.render_beats + Fr(int(np.ceil(tail * bpm / 60)))
    n = tempo.samples(end)
    out_dir = BUILD / palette.id / 'sfx_raw' / key
    jobs = plan_jobs(tl, palette, out_dir)
    render_jobs(jobs, tempo, end, palette.render, out_dir, workers=1, log=lambda *a: None)
    x = sum(read_wav(j.wav, n) for j in jobs)
    return x.mean(axis=1)
