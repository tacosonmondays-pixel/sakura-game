"""ffmpeg encoders for the web: Opus in WebM (primary) and AAC-LC in MP4 (iOS fallback), plus probe files.

Measured on this machine (docs/AUDIO.md §2.8): ffmpeg writes an MP4 edit list for AAC priming (1024) and an
OpusHead pre-skip (312); decoders that honour them return the audio sample-aligned. The game still measures
the decoder's offset at runtime with the probe files (a click at sample 3200), because Safari cannot be
checked here. Output is bit-exact (no encoder/version tags), so re-renders give stable git diffs.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np

from .mix import write_wav
from .paths import FFMPEG

FORMATS = {
    'opus': {'ext': 'webm', 'mime': 'audio/webm; codecs=opus'},
    'aac': {'ext': 'm4a', 'mime': 'audio/mp4; codecs=mp4a.40.2'},
}
PROBE_CLICK = 3200


def _run(cmd):
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if res.returncode != 0:
        raise RuntimeError(f'ffmpeg failed: {" ".join(map(str, cmd))}\n{res.stderr[-1200:]}')


def encode(wav: Path, out_base: Path, fmt: str, kbps: int, rate: int = 32000, mono: bool = False) -> Path:
    out = out_base.with_name(out_base.name + '.' + FORMATS[fmt]['ext'])
    out.parent.mkdir(parents=True, exist_ok=True)
    common = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav), '-map_metadata', '-1', '-fflags', '+bitexact',
              '-flags:a', '+bitexact']
    if mono:
        common += ['-ac', '1']
    if fmt == 'opus':
        cmd = common + ['-c:a', 'libopus', '-b:a', f'{kbps}k', '-vbr', 'on', '-application', 'audio', '-f', 'webm', str(out)]
    else:
        cmd = common + ['-c:a', 'aac', '-b:a', f'{kbps}k', '-ar', str(rate), '-movflags', '+faststart', '-f', 'mp4', str(out)]
    _run(cmd)
    return out


def decode(path: Path, rate: int = 32000, channels: int = 2) -> np.ndarray:
    """ffmpeg decode → float64 (n, channels) at `rate` (honours edit lists / pre-skip like browsers should)."""
    res = subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-i', str(path), '-f', 'f32le', '-ac', str(channels),
                          '-ar', str(rate), '-'], capture_output=True, timeout=600)
    if res.returncode != 0:
        raise RuntimeError(f'decode failed for {path}: {res.stderr[-400:]!r}')
    return np.frombuffer(res.stdout, dtype='<f4').astype(np.float64).reshape(-1, channels)


def make_probe(out_dir: Path, rate: int = 32000) -> dict:
    """probe.webm / probe.m4a: 0.25 s mono silence with one click at sample 3200 (32 kHz)."""
    x = np.zeros((int(rate * 0.25), 1))
    x[PROBE_CLICK, 0] = 0.9
    x[PROBE_CLICK + 1, 0] = -0.45
    wav = write_wav(out_dir / 'probe.wav', x, rate)
    out = {}
    for fmt, kb in (('opus', 24), ('aac', 32)):
        p = encode(wav, out_dir / 'probe', fmt, kb, rate, mono=True)
        dec = decode(p, rate, 1)[:, 0]
        out[fmt] = {'file': p.name, 'bytes': p.stat().st_size, 'clickAt': int(np.argmax(np.abs(dec))), 'expected': PROBE_CLICK}
    wav.unlink()
    return out
