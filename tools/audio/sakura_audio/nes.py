"""NES-style waveform primitives shared by the chip soundfont and the SFX synth (numpy only)."""
from __future__ import annotations

import numpy as np

NES_CPU = 1789773.0
NOISE_PERIODS = [4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068]
TRI_STEPS = np.array(list(range(15, -1, -1)) + list(range(0, 16)), dtype=np.float64)   # 32-step NES triangle


def ideal_cycle(kind: str, n: int = 4096, duty: float = 0.5) -> np.ndarray:
    """One cycle of an ideal (aliasing) waveform at `n` points, DC removed, roughly ±1."""
    t = np.arange(n) / n
    if kind == 'pulse':
        w = np.where(t < duty, 1.0, -1.0)
    elif kind == 'triangle':
        idx = np.floor(t * 32).astype(int)
        w = TRI_STEPS[idx] / 7.5 - 1.0
    elif kind == 'saw':
        w = np.floor((1.0 - t) * 16) / 7.5 - 1.0            # 16-step VRC6-flavoured saw
    elif kind == 'sine':
        w = np.sin(2 * np.pi * t)
    else:
        raise ValueError(kind)
    return w - w.mean()


def bandlimited_cycle(kind: str, length: int, max_harmonic: int, duty: float = 0.5) -> np.ndarray:
    """Single cycle with `length` samples containing harmonics 1..max_harmonic of the ideal waveform."""
    spec = np.fft.rfft(ideal_cycle(kind, 4096, duty))
    k = max(1, min(max_harmonic, length // 2 - 1, len(spec) - 1))
    out = np.zeros(length // 2 + 1, dtype=complex)
    out[1:k + 1] = spec[1:k + 1]
    return np.fft.irfft(out, n=length) * (length / 4096)


def lfsr_noise(n: int, rate: int, period_index: int = 8, short: bool = False, seed: int = 1) -> np.ndarray:
    """NES APU noise: 15-bit LFSR clocked at CPU/period, sampled at `rate` (sample-and-hold, authentic aliasing).
    short=True is the 93-step 'metallic' mode."""
    clock = NES_CPU / NOISE_PERIODS[period_index]
    step = clock / rate
    reg = seed & 0x7FFF or 1
    tap = 6 if short else 1
    out = np.empty(n)
    acc = 0.0
    # vectorising an LFSR is awkward; n is small (≤ a few seconds)
    for i in range(n):
        acc += step
        while acc >= 1.0:
            fb = (reg & 1) ^ ((reg >> tap) & 1)
            reg = (reg >> 1) | (fb << 14)
            acc -= 1.0
        out[i] = 1.0 if (reg & 1) == 0 else -1.0
    return out


def lfsr_noise_fast(n: int, rate: int, period_index: int = 8, short: bool = False, seed: int = 1) -> np.ndarray:
    """Same as lfsr_noise but precomputes the LFSR sequence once (much faster for long sounds)."""
    seq_len = 93 if short else 32767
    reg = seed & 0x7FFF or 1
    tap = 6 if short else 1
    seq = np.empty(seq_len * 2)
    for i in range(len(seq)):
        fb = (reg & 1) ^ ((reg >> tap) & 1)
        reg = (reg >> 1) | (fb << 14)
        seq[i] = 1.0 if (reg & 1) == 0 else -1.0
    clock = NES_CPU / NOISE_PERIODS[period_index]
    idx = np.floor(np.arange(1, n + 1) * (clock / rate)).astype(np.int64)
    return seq[idx % len(seq)]


def tri_sweep(n: int, rate: int, f0: float, f1: float, curve: float = 3.0) -> np.ndarray:
    """Stepped NES triangle with an exponential pitch sweep f0 → f1 (Hz) over n samples."""
    t = np.arange(n) / n
    f = f1 + (f0 - f1) * np.exp(-curve * t * 4)
    ph = np.cumsum(f / rate)
    idx = np.floor((ph % 1.0) * 32).astype(int)
    return TRI_STEPS[idx] / 7.5 - 1.0
