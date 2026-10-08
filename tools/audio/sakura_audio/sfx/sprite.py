"""SFX sprite: render every recipe → house EQ → trim → peak −3 dBFS → 2 ms edge fades → pack with 75 ms gaps into
one mono file (sfx.webm Opus 24k + sfx.m4a AAC 32k) + sprite.json with the per-sound runtime parameters.

Balancing: a recipe declares its target `level` (event loudness, LUFS: momentary max over 400 ms, compensated
to the sound's own length when it is shorter than that) and the builder derives the runtime `gain_db` from the
measured loudness, so every sound lands where its category belongs whatever the recipe's raw level.

Output goes to tools/audio/build/sfx/ (review) and, with ship=True, public/audio/sfx/.
"""
from __future__ import annotations

import hashlib
import json
import math
import shutil
from pathlib import Path

import numpy as np

from ..encode import encode, decode
from ..mix import write_wav
from ..paths import BUILD, PUBLIC_SFX
from .recipes import REGISTRY
from .sampled import sampled
from .synth import RATE, highpass, lowpass

GAP = 2400            # 75 ms of silence between sounds (more than any codec window: AAC 2048, Opus 20 ms + lookahead)
PEAK = 10 ** (-3 / 20)


class Ctx:
    def __init__(self, sid, palette):
        seed = int(hashlib.sha1(sid.encode()).hexdigest()[:8], 16)
        self.rng = np.random.default_rng(seed)
        self.palette = palette
        self.id = sid

    def sampled(self, role, text, bpm=120, tail=1.0, vel=0):
        return sampled(self.palette, role, text, bpm, tail, vel)


def high_pass_for(spec) -> float:
    """Spammy battle sounds lose everything under 100 Hz (phones cannot play it, and twenty overlapping thumps
    would only eat the mix's headroom); everything else keeps down to 40 Hz."""
    if spec.get('hp'):
        return spec['hp']
    return 100.0 if spec['bus'] == 'battle' and spec['priority'] <= 1 else 40.0


def event_loudness(x) -> float:
    """Event loudness (LUFS) of a peak-normalised sound before its runtime gain (see the module docstring)."""
    from ..review import momentary_max
    d = len(x) / RATE
    return momentary_max(x, RATE) + (10 * math.log10(0.4 / max(0.05, d)) if d <= 0.4 else 0.0)


def render_one(sid, palette) -> np.ndarray:
    spec = REGISTRY[sid]
    x = np.asarray(spec['fn'](Ctx(sid, palette)), dtype=np.float64)
    x = np.nan_to_num(x)
    # house EQ: no sub rumble phones cannot play (it only eats headroom when 20 sounds overlap), nothing above
    # 12 kHz (the codecs drop it anyway and it is where chip fizz lives)
    x = lowpass(highpass(x, high_pass_for(spec), 2), 12000, 4)
    # trim leading/trailing silence (−54 dB relative to the peak), keep at least 10 ms
    env = np.abs(x)
    thr = env.max() * 10 ** (-54 / 20)
    nz = np.nonzero(env > thr)[0]
    end = max(int(RATE * 0.01), (nz[-1] + 1) if len(nz) else 1)
    start = nz[0] if len(nz) else 0
    x = x[start:end]
    pk = np.abs(x).max()
    if pk > 0:
        x = x * (PEAK / pk)
    f = min(len(x) // 2, int(RATE * 0.002))
    if f > 1:
        x[:f] *= np.linspace(0, 1, f)
        x[-f:] *= np.linspace(1, 0, f)
    return x


def build_sprite(palette, only=None, ship: bool = True, out_dir: Path | None = None) -> dict:
    out_dir = out_dir or (BUILD / 'sfx')
    out_dir.mkdir(parents=True, exist_ok=True)
    ids = sorted(REGISTRY) if not only else [i for i in sorted(REGISTRY) if i in only]
    chunks, sounds, pos = [np.zeros(GAP)], {}, GAP
    for sid in ids:
        x = render_one(sid, palette)
        spec = REGISTRY[sid]
        g = spec['gain_db'] if spec.get('level') is None else round(spec['level'] - event_loudness(x), 1)
        sounds[sid] = {'start': pos, 'length': len(x), 'gain_db': g, 'bus': spec['bus'], 'voices': spec['voices'],
                       'gap_ms': spec['gap_ms'], 'jitter': spec['jitter'], 'priority': spec['priority']}
        if spec.get('level') is not None:
            sounds[sid]['level'] = spec['level']
        write_wav(out_dir / 'wav' / f'{sid}.wav', x[:, None], RATE)
        chunks += [x, np.zeros(GAP)]
        pos += len(x) + GAP
    sprite = np.concatenate(chunks)
    wav = write_wav(out_dir / 'sfx.wav', sprite[:, None], RATE)
    webm = encode(wav, out_dir / 'sfx', 'opus', 24, RATE, mono=True)
    m4a = encode(wav, out_dir / 'sfx', 'aac', 32, RATE, mono=True)
    # verify every sound survives encode/decode at its offset (alignment + level)
    checks = {}
    for fmt, p in (('opus', webm), ('aac', m4a)):
        d = decode(p, RATE, 1)[:, 0]
        worst = 0.0
        for sid, s in sounds.items():
            a = sprite[s['start']:s['start'] + s['length']]
            b = d[s['start']:s['start'] + s['length']]
            err = np.sqrt(np.mean((a - b) ** 2)) / (np.sqrt(np.mean(a ** 2)) + 1e-9)
            worst = max(worst, float(err))
        checks[fmt] = {'worstRelErr': round(worst, 3), 'bytes': p.stat().st_size}
    data = {'version': 1, 'rate': RATE, 'palette': palette.id, 'files': {'opus': 'sfx.webm', 'aac': 'sfx.m4a'},
            'length': len(sprite), 'sounds': sounds}
    (out_dir / 'sprite.json').write_text(json.dumps(data, indent=1) + '\n')
    if ship and not only:
        PUBLIC_SFX.mkdir(parents=True, exist_ok=True)
        for p in (webm, m4a, out_dir / 'sprite.json'):
            shutil.copyfile(p, PUBLIC_SFX / p.name)
    return {'count': len(sounds), 'seconds': len(sprite) / RATE, 'bytes': {k: v['bytes'] for k, v in checks.items()},
            'checks': checks, 'dir': PUBLIC_SFX if (ship and not only) else out_dir}
