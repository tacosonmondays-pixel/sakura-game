"""Mix chain: SNES echo per stem → lowpass → optional crush → one loudness gain → loop construction.

All processing is linear and time-invariant and runs on the continuous render R, so every stem keeps the
loop period and stems still add up to the full mix.

Loop file layout (samples, G = guard, T = seam):
    F = R[0 : L0+T+G]  ++  R[L0+P−G : L0+2P]  ++  R[L0+P : L0+P+G]
        └ head (+guard) ┘   └ guard + loop body ┘   └ guard after the loop end ┘
    introEnd = L0, head = L0+T, loopStart = L0+T+2G, loopEnd = loopStart+P, entry = loopStart+T, length = loopEnd+G
The player plays F[0:head] once, then loops F[loopStart:loopEnd] entering at `entry`. Both loop points and
the head end sit inside musically continuous audio, so encoder smear at the file's internal joins
(G = 4096 samples away) never reaches a sample that is played.
"""
from __future__ import annotations

import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

from .paths import FFMPEG

GUARD = 4096

FIR_PRESETS = {
    'flat': None,
    'soft': 0.62,
    'dark': 0.32,
}


def fir_taps(name: str) -> np.ndarray:
    cut = FIR_PRESETS.get(name, 0.62)
    if cut is None:
        h = np.zeros(8)
        h[0] = 1.0
        return h
    h = signal.firwin(8, cut)
    return h / h.sum()


def echo_delay_samples(delay_ms: float, rate: int) -> int:
    """SNES EDL: the delay is a multiple of 16 ms (1-15 steps)."""
    edl = max(1, min(15, int(round(delay_ms / 16.0))))
    return int(round(edl * 16 * rate / 1000))


def snes_echo(x: np.ndarray, rate: int, delay_ms=208, feedback=0.42, volume=0.30, fir='soft', invert_right=False) -> np.ndarray:
    """Echo-only output of an SNES-style echo unit (add it to the dry signal).

        s[n] = FIR8(b)[n − d]          echo output, filtered
        b[n] = x[n] + feedback · s[n]  written back into the echo buffer
        out  = volume · s              (right channel optionally inverted, the SNES 'wide' trick)

    Vectorised in blocks of d samples (valid because d ≥ 16 ms ≫ 8 taps)."""
    n = len(x)
    d = echo_delay_samples(delay_ms, rate)
    h = fir_taps(fir)
    taps = len(h)
    pad = d + taps
    b = np.zeros((n + pad, x.shape[1]))
    s = np.zeros_like(x)
    for k in range(0, n, d):
        hi = min(k + d, n)
        # s[m] for m in [k, hi) needs b[m-d-taps+1 .. m-d] → padded indices [k-d-taps+1+pad, hi-d+pad)
        seg = b[k - d - taps + 1 + pad: hi - d + pad]
        for c in range(x.shape[1]):
            s[k:hi, c] = np.convolve(seg[:, c], h, mode='valid')
        b[k + pad:hi + pad] = x[k:hi] + feedback * s[k:hi]
    out = volume * s
    if invert_right and out.shape[1] > 1:
        out[:, 1] *= -1
    return out


def echo_decay_seconds(delay_ms, feedback, floor_db=-60.0) -> float:
    if feedback <= 0:
        return delay_ms / 1000
    n = np.log(10 ** (floor_db / 20)) / np.log(feedback)
    return float(n * echo_delay_samples(delay_ms, 32000) / 32000)


def lowpass(x: np.ndarray, rate: int, hz: float) -> np.ndarray:
    if not hz or hz >= rate / 2 * 0.98:
        return x
    sos = signal.butter(2, hz, fs=rate, output='sos')
    return signal.sosfilt(sos, x, axis=0)


def highpass(x: np.ndarray, rate: int, hz: float = 20.0) -> np.ndarray:
    """DC blocker / subsonic filter (some soundfont samples carry DC; the SNES DAC was AC-coupled too)."""
    if not hz:
        return x
    sos = signal.butter(2, hz, btype='highpass', fs=rate, output='sos')
    return signal.sosfilt(sos, x, axis=0)


def crush(x: np.ndarray, bits=0, mix=0.0, hold=1) -> np.ndarray:
    """Parallel blend of a bit-crushed (and optionally sample-held) copy: SNES/BRR grit."""
    if not mix or (not bits and hold <= 1):
        return x
    y = x
    if hold and hold > 1:
        y = np.repeat(y[::hold], hold, axis=0)[:len(x)]
    if bits:
        q = 2 ** (bits - 1)
        y = np.round(y * q) / q
    return (1 - mix) * x + mix * y


def write_wav(path: Path, x: np.ndarray, rate: int):
    path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(path), rate, np.asarray(x, dtype=np.float32))
    return path


def read_wav(path: Path) -> tuple[int, np.ndarray]:
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        rate, x = wavfile.read(str(path))
    x = np.asarray(x, dtype=np.float64)
    if x.dtype.kind == 'i' or np.abs(x).max() > 2:
        x = x / 32768.0
    return rate, x


EBU_I = re.compile(r'I:\s+(-?[\d.]+|-inf) LUFS')
EBU_TP = re.compile(r'True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS', re.S)
EBU_LRA = re.compile(r'LRA:\s+(-?[\d.]+) LU')


def loudness(x: np.ndarray, rate: int) -> dict:
    """Integrated loudness (LUFS), LRA and true peak (dBTP) via ffmpeg's ebur128 filter."""
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / 'l.wav'
        write_wav(p, x, rate)
        res = subprocess.run([FFMPEG, '-hide_banner', '-nostats', '-i', str(p), '-af', 'ebur128=peak=true:framelog=quiet',
                              '-f', 'null', '-'], capture_output=True, text=True, timeout=300)
    txt = res.stderr
    summ = txt[txt.rfind('Summary:'):] if 'Summary:' in txt else txt
    i = EBU_I.search(summ)
    tp = EBU_TP.search(summ)
    lra = EBU_LRA.search(summ)
    f = lambda m: (float('-inf') if m.group(1) == '-inf' else float(m.group(1))) if m else float('nan')
    return {'lufs': f(i), 'truePeak': f(tp), 'lra': f(lra), 'samplePeak': float(20 * np.log10(np.abs(x).max() + 1e-12))}


def loudness_gain(meas: dict, target_lufs: float, max_tp: float = -1.0) -> tuple[float, bool]:
    """One gain (dB) for every stem: reach the target, but lower the gain instead of limiting when the
    true peak would pass `max_tp` (a limiter would break 'stems add up to the full mix')."""
    g = target_lufs - meas['lufs']
    limited = False
    if meas['truePeak'] + g > max_tp:
        g = max_tp - meas['truePeak']
        limited = True
    return g, limited


def build_loop_file(R: np.ndarray, L0: int, P: int, T: int, G: int = GUARD) -> tuple[np.ndarray, dict]:
    if T + G >= P:
        raise ValueError(f'seam {T} + guard {G} must be shorter than the loop {P}')
    need = L0 + 2 * P
    if len(R) < need:
        raise ValueError(f'render too short: {len(R)} < {need}')
    F = np.concatenate([R[0:L0 + T + G], R[L0 + P - G:L0 + 2 * P], R[L0 + P:L0 + P + G]])
    loop_start = L0 + T + 2 * G
    pos = {'introEnd': L0, 'seam': T, 'guard': G, 'head': L0 + T, 'loopStart': loop_start, 'loopEnd': loop_start + P,
           'entry': loop_start + T, 'length': loop_start + P + G}
    assert len(F) == pos['length']
    return F, pos


def trim_oneshot(R: np.ndarray, rate: int, floor_db: float = -70.0, fade_ms: float = 5.0, min_len: int = 0) -> np.ndarray:
    env = np.abs(R).max(axis=1)
    above = np.nonzero(env > 10 ** (floor_db / 20))[0]
    end = max(min_len, (above[-1] + 1) if len(above) else 1)
    y = R[:end].copy()
    nf = min(len(y), int(rate * fade_ms / 1000))
    if nf > 1:
        y[-nf:] *= np.linspace(1, 0, nf)[:, None]
    return y
