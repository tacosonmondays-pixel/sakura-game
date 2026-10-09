"""FluidSynth stem renderer: one job per (stem × soundfont × echo send), ≤ 15 melodic channels + 1 kit each.

    fluidsynth -ni -q -R 0 -C 0 -g <gain> -r 32000 -O float -T wav -o synth.polyphony=256
               -o synth.dynamic-sample-loading=1 -f interp.cfg -F out.wav font.sf2 job.mid

FluidSynth's own reverb and chorus are off: all space comes from our SNES echo, the same for every palette.
Jobs are cached by a hash of (MIDI bytes, soundfont identity, render settings), so re-rendering a song
after a mix tweak costs nothing. At most 2 FluidSynth processes run at a time (shared machine).
"""
from __future__ import annotations

import hashlib
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from scipy.io import wavfile

from .fx import merge_fx, fx_key, needs_own_job
from .midi import write_midi, MELODIC_CHANNELS, DRUM_CHANNEL, Tempo
from .paths import FLUIDSYNTH

FLUID_OFFSET = 64        # FluidSynth's first MIDI block lands at sample 64 (measured): trimmed so 0 = beat 0


@dataclass
class Job:
    song: str
    stem: str
    sf_path: Path
    send: float
    index: int
    sf_key: str = ''
    kit: bool = False                                    # a kit-only job (drums get their own voice treatment)
    fx: dict = field(default_factory=dict)              # part effects run on this job's render (sakura_audio/fx.py)
    assignments: list = field(default_factory=list)     # (TimelinePart, preset, channel)
    midi: Path | None = None
    wav: Path | None = None
    cached: bool = False

    @property
    def label(self):
        roles = ','.join(sorted({a[0].role for a in self.assignments}))
        fx = f' fx:{"+".join(k for k in ("filter", "drive", "pump") if k in self.fx)}' if self.fx else ''
        return f'{self.stem}/{self.sf_path.stem}/send{self.send:g}#{self.index} [{roles}]{fx}'


def plan_jobs(tl, palette, out_dir: Path) -> list:
    groups: dict = {}
    fx_of: dict = {}
    for tp in tl.parts:
        if not tp.notes:
            continue
        pre = palette.resolve(tp.role)
        send = round(float(pre.get('echo', 0.0)) * 4) / 4      # quarter steps keep the job count low
        kit = pre.get('bank') == 128
        # parts with effects render apart, grouped by their (merged role + part) fx; '' sorts first and keeps the
        # job layout of songs without fx unchanged
        fx = merge_fx(pre.get('fx'), getattr(tp, 'fx', None))
        fk = fx_key(fx) + (f'#{tp.name}' if needs_own_job(fx) else '')
        fx_of[fk] = fx
        groups.setdefault((tp.stem, str(pre['sf_path']), send, kit, pre.get('sf_key', ''), fk), []).append((tp, pre))
    jobs = []
    for (stem, sf, send, kit, sf_key, fk), items in sorted(groups.items()):
        # kits render in jobs of their own (one kit per job, channel 10), so the mix can treat drums apart
        # from the sampled melodic voices (palette mix.voices: 'kit' vs the soundfont key)
        if kit:
            chunks, kit_slots = [[] for _ in items], [[x] for x in items]
        else:
            chunks = [items[i:i + len(MELODIC_CHANNELS)] for i in range(0, len(items), len(MELODIC_CHANNELS))]
            kit_slots = [[] for _ in chunks]
        for i, (ch_items, kit_items) in enumerate(zip(chunks, kit_slots)):
            if not ch_items and not kit_items:
                continue
            j = Job(tl.song.id, stem, Path(sf), send, len([x for x in jobs if x.stem == stem]), sf_key=sf_key, kit=kit,
                    fx=fx_of[fk])
            for c, (tp, pre) in zip(MELODIC_CHANNELS, ch_items):
                j.assignments.append((tp, pre, c))
            for tp, pre in kit_items:
                j.assignments.append((tp, pre, DRUM_CHANNEL))
            j.midi = out_dir / f'{stem}.{j.index:02d}.mid'
            j.wav = out_dir / f'{stem}.{j.index:02d}.wav'
            jobs.append(j)
    return jobs


def _font_id(p: Path) -> str:
    st = p.stat()
    return f'{p.resolve()}:{st.st_size}:{int(st.st_mtime)}'


def run_job(job: Job, tempo: Tempo, render_beats, render_cfg: dict, interp_cfg: Path, markers=()) -> Job:
    write_midi(job.midi, tempo, job.assignments, render_beats, markers)
    key = hashlib.sha256(job.midi.read_bytes() + _font_id(job.sf_path).encode() + json.dumps(render_cfg, sort_keys=True).encode()).hexdigest()
    keyfile = job.wav.parent / (job.wav.stem + '.key')
    if job.wav.exists() and keyfile.exists() and keyfile.read_text() == key:
        job.cached = True
        return job
    cmd = [FLUIDSYNTH, '-ni', '-q', '-R', '0', '-C', '0', '-g', str(render_cfg['gain']), '-r', str(render_cfg['rate']),
           '-O', 'float', '-T', 'wav', '-o', f'synth.polyphony={render_cfg["polyphony"]}',
           '-o', 'synth.dynamic-sample-loading=1', '-f', str(interp_cfg), '-F', str(job.wav), str(job.sf_path), str(job.midi)]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if res.returncode != 0 or not job.wav.exists():
        raise RuntimeError(f'fluidsynth failed for {job.label}: {res.stderr[-800:]}')
    keyfile.write_text(key)
    return job


def render_jobs(jobs, tempo, render_beats, render_cfg, work_dir: Path, workers: int = 2, log=print):
    work_dir.mkdir(parents=True, exist_ok=True)
    interp = work_dir / 'interp.cfg'
    interp.write_text(f'interp {int(render_cfg.get("interp", 4))}\n')
    with ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
        done = list(ex.map(lambda j: run_job(j, tempo, render_beats, render_cfg, interp), jobs))
    for j in done:
        log(f'    {"cached " if j.cached else "rendered"} {j.label}')
    return done


def read_wav(path: Path, length: int) -> np.ndarray:
    """Float64 (length, 2), FluidSynth's block offset removed, zero-padded/trimmed to `length`."""
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        rate, x = wavfile.read(str(path))
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    x = x[FLUID_OFFSET:]
    if len(x) < length:
        x = np.concatenate([x, np.zeros((length - len(x), 2))])
    return x[:length]
