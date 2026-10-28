"""One song through the whole chain: timeline → MIDI → FluidSynth jobs → stems → mix → loop file → encode → checks.

Writes only under tools/audio/build/<palette>/ :
    midi/<song>.mid                 GM preview
    raw/<song>/<stem>.<n>.{mid,wav}  render jobs (cached)
    mix/<song>/<stem>.wav           final stem files (float32, 32 kHz) — what gets encoded
    mix/<song>/full.wav, full.R.wav  full mix as a loop file / as the continuous render (review)
    enc/<song>.<stem>.{webm,m4a}     encodes
    manifest.json                   entries for every rendered song (+ checks); `ship` copies from here
"""
from __future__ import annotations

import json
import math
import time
from fractions import Fraction as Fr
from pathlib import Path

import numpy as np

from . import checks as C
from .encode import encode, decode, FORMATS
from .fx import part_fx, FxContext
from .midi import snap_tempo, Tempo, write_preview
from .mix import (snes_echo, lowpass, highpass, crush, loudness, loudness_gain, build_loop_file, trim_oneshot, write_wav,
                  echo_decay_seconds, voice_fx, GUARD)
from .paths import BUILD
from .render import plan_jobs, render_jobs, read_wav

LUFS_TARGET = {'music': -16.0, 'jingle': -15.0, 'stinger': -18.0}
BITRATES = {'opus': (48, 40), 'aac': (64, 48)}       # (primary stem, secondary stems) kbps
PRIMARY_STEMS = ('full', 'base')


def _merge(a: dict, b: dict) -> dict:
    out = json.loads(json.dumps(a))
    for k, v in (b or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = {**out[k], **v}
        else:
            out[k] = v
    return out


def song_mix(palette, song) -> dict:
    """The mix settings for one song: palette defaults, then the song's own `mix`, then the palette's
    `echo_override` (keys that always win, e.g. toby's darker FIR) and `echo_scale` (factors applied to the
    song's echo, e.g. a shorter 16-bit-console delay). So `--palette toby` changes the echo of every song
    although each song sets its own echo for the shipped palette."""
    mixp = _merge(palette.mix, song.mix)
    echo = dict(mixp.get('echo') or {})
    echo.update(palette.mix.get('echo_override') or {})
    for k, f in (palette.mix.get('echo_scale') or {}).items():
        if isinstance(echo.get(k), (int, float)):
            echo[k] = echo[k] * f
    if 'feedback' in echo:
        echo['feedback'] = min(0.7, echo['feedback'])
    mixp['echo'] = echo
    return mixp


def song_markers(song, tl, tempo):
    """Section start bars (1-based, from the song start) for quantised jumps."""
    bpb = song.bpb
    return {name: int(beat / bpb) + 1 for beat, name in tl.sections}


def render_song(song, palette, build_root: Path = BUILD, encode_formats=('opus', 'aac'), workers: int = 2, log=print,
                stems_only=None) -> dict:
    t_start = time.time()
    song.palette_hint = palette
    tl = song.timeline()
    rate = int(palette.render['rate'])
    loop = song.kind == 'loop'
    tempo = snap_tempo(song.bpm, tl.loop_beats, tl.intro_beats, rate) if loop else snap_tempo(song.bpm, 0, 0, rate)
    beat_s = tempo.tempo_us / 1e6
    mixp = song_mix(palette, song)
    echo = mixp.get('echo', {})
    L0 = tempo.samples(tl.intro_beats)
    P = tempo.samples(tl.loop_beats) if loop else 0
    if song.seam_beats is not None:
        T = tempo.samples(song.seam_beats)
    else:
        need = max(2.5, echo_decay_seconds(echo.get('delay_ms', 208), echo.get('feedback', 0.42)) + 1.0)
        T = tempo.samples(math.ceil(need / beat_s))
    if loop and T + GUARD >= P:
        T = tempo.samples(max(1, int((P - GUARD) / rate / beat_s) - 1))
    tail_beats = Fr(math.ceil(song.tail / beat_s))
    render_end = tl.render_beats + tail_beats
    N = tempo.samples(render_end)

    pal_dir = build_root / palette.id
    raw_dir = pal_dir / 'raw' / song.id
    mix_dir = pal_dir / 'mix' / song.id
    enc_dir = pal_dir / 'enc'
    write_preview(pal_dir / 'midi' / f'{song.id}.mid', tl, palette, tempo)
    log(f'  {song.id}: {song.kind}, {tempo.bpm:.4f} bpm (written {song.bpm:g}), intro {L0} + loop {P} samples, seam {T}, '
        f'{len(tl.parts)} parts, stems {song.stems()}')
    jobs = plan_jobs(tl, palette, raw_dir)
    if stems_only:
        jobs = [j for j in jobs if j.stem in stems_only]
    render_jobs(jobs, tempo, render_end, palette.render, raw_dir, workers=workers, log=log)

    stems = {}
    for stem in song.stems():
        if stems_only and stem not in stems_only:
            continue
        dry = np.zeros((N, 2))
        wet = np.zeros((N, 2))
        voices = mixp.get('voices') or {}
        for j in (j for j in jobs if j.stem == stem):
            x = voice_fx(read_wav(j.wav, N), rate, voices.get('kit' if j.kit else j.sf_key))
            if j.fx:      # per-part effects (filter → drive → pump), on the continuous render, before the echo send
                x = part_fx(x, j.fx, FxContext(rate, tempo, song, tl, [n for a in j.assignments for n in a[0].notes], N,
                                               (L0, P) if loop else None))
            dry += x
            if j.send > 0:
                wet += x * j.send
        y = dry
        if np.any(wet) and echo.get('volume', 0) > 0:
            y = y + snes_echo(wet, rate, echo.get('delay_ms', 208), echo.get('feedback', 0.42), echo.get('volume', 0.3),
                              echo.get('fir', 'soft'), echo.get('invert_right', False))
        y = lowpass(y, rate, mixp.get('lowpass_hz', 14500))
        y = highpass(y, rate, mixp.get('highpass_hz', 20))
        cr = mixp.get('crush') or {}
        y = crush(y, cr.get('bits', 0), cr.get('mix', 0.0), cr.get('hold', 1))
        stems[stem] = y
    full = sum(stems.values())

    bus = song.bus if song.bus in LUFS_TARGET else 'music'
    target = song.lufs if song.lufs is not None else LUFS_TARGET[bus if not loop else 'music']
    body = full[L0 + P:L0 + 2 * P] if loop else full
    meas = loudness(body, rate)
    gain_db, limited = loudness_gain(meas, target)
    g = 10 ** (gain_db / 20)
    stems = {k: v * g for k, v in stems.items()}
    full = full * g

    entry = {'title': song.title, 'kind': song.kind, 'bus': bus, 'bpm': round(tempo.bpm, 4), 'bpmWritten': song.bpm,
             'beat': round(float(tempo.beats_to_samples(1)), 4), 'meter': list(song.meter), 'key': song.key,
             'palette': palette.id, 'rate': rate}
    files = {}
    if loop:
        F_full, pos = build_loop_file(full, L0, P, T)
        entry['bars'] = {'intro': int(tl.intro_beats / song.bpb), 'loop': int(tl.loop_beats / song.bpb)}
        entry.update(pos)
        for name, R in stems.items():
            F, _ = build_loop_file(R, L0, P, T)
            files[name] = write_wav(mix_dir / f'{name}.wav', F, rate)
        write_wav(mix_dir / 'full.R.wav', full[:L0 + 2 * P + int(rate * 0.5)], rate)
        write_wav(mix_dir / 'full.wav', F_full, rate)
    else:
        F_full = trim_oneshot(full, rate)
        n = len(F_full)
        entry['length'] = n
        for name, R in stems.items():
            y = R[:n].copy()
            nf = min(n, int(rate * 0.005))
            y[-nf:] *= np.linspace(1, 0, nf)[:, None]
            files[name] = write_wav(mix_dir / f'{name}.wav', y, rate)
        write_wav(mix_dir / 'full.wav', F_full, rate)
        write_wav(mix_dir / 'full.R.wav', F_full, rate)
    entry['lufs'] = round(meas['lufs'] + gain_db, 1)
    entry['truePeak'] = round(meas['truePeak'] + gain_db, 1)
    entry['gainDb'] = round(gain_db, 2)
    entry['peakLimited'] = limited
    entry['markers'] = song_markers(song, tl, tempo)
    if song.extra:
        entry.update(song.extra)
    if 'accentBeat' in entry:      # one-shots: where the accent (stab, crash) sits, so the engine lands it on a strong beat
        entry['accent'] = int(round(float(tempo.beats_to_samples(Fr(entry.pop('accentBeat')).limit_denominator(64)))))

    # ---- checks on the WAVs --------------------------------------------------------------------------------
    chk = {'levels': C.basic_levels(F_full)}
    lufs_ok = abs(entry['lufs'] - target) <= 0.5 or limited
    chk['loudness'] = {'ok': bool(lufs_ok and entry['truePeak'] <= -0.95), 'lufs': entry['lufs'], 'target': target,
                       'truePeak': entry['truePeak'], 'peakLimited': limited}
    if loop:
        chk['loopIdentity'] = C.loop_identity(full, L0, P, T)
        chk['wav'] = C.wav_seams(F_full, full, entry)
    # ---- encode + encoded checks ---------------------------------------------------------------------------
    entry['stems'] = {}
    dec_sum = {f: None for f in encode_formats}
    for name, wav in files.items():
        st = {'file': f'{song.id}.{name}', 'bytes': {}}
        for fmt in encode_formats:
            kb = BITRATES[fmt][0 if name in PRIMARY_STEMS else 1]
            out = encode(wav, enc_dir / f'{song.id}.{name}', fmt, kb, rate)
            st['bytes'][fmt] = out.stat().st_size
            d = decode(out, rate)
            dec_sum[fmt] = d if dec_sum[fmt] is None else _add(dec_sum[fmt], d)
        x = files[name]
        entry['stems'][name] = st
    for name in files:
        if loop:
            from .mix import read_wav as rw
            _, F = rw(files[name])
            entry['stems'][name]['lufs'] = round(loudness(F[entry['loopStart']:entry['loopEnd']], rate)['lufs'], 1)
    for fmt in encode_formats:
        d = dec_sum[fmt]
        c = {'alignment': C.alignment(d, F_full)}
        if loop:
            c.update(C.encoded_seams(d, entry, F_full))
            c['lengthOk'] = len(d) >= entry['length']
        chk[fmt] = c
    entry['checks'] = chk
    entry['ok'] = all_ok(chk)
    entry['renderSeconds'] = round(time.time() - t_start, 1)
    entry['warnings'] = palette.unique_warnings()
    save_build_entry(pal_dir, song.id, entry)
    return {'entry': entry, 'timeline': tl, 'tempo': tempo, 'jobs': jobs, 'files': files, 'mix_dir': mix_dir, 'enc_dir': enc_dir}


def _add(a, b):
    n = max(len(a), len(b))
    out = np.zeros((n, a.shape[1]))
    out[:len(a)] += a
    out[:len(b)] += b
    return out


def all_ok(chk) -> bool:
    ok = True

    def walk(v):
        nonlocal ok
        if isinstance(v, dict):
            if v.get('ok') is False or v.get('lengthOk') is False:
                ok = False
            for x in v.values():
                walk(x)
    walk(chk)
    return ok


def save_build_entry(pal_dir: Path, song_id: str, entry: dict):
    p = pal_dir / 'manifest.json'
    data = json.loads(p.read_text()) if p.exists() else {'tracks': {}}
    data['tracks'][song_id] = entry
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=1))
