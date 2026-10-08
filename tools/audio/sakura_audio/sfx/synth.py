"""numpy SFX primitives (32 kHz mono float64): NES oscillators, LFSR noise, envelopes, sweeps, FM, plucks,
filters, the SNES echo, and `sampled()` phrases rendered through the current palette.

Every function returns a 1-D float array; `seq()` layers sounds at time offsets. Deterministic: randomness
only comes from the seeded generator a recipe receives.
"""
from __future__ import annotations

import numpy as np
from scipy import signal

from ..nes import lfsr_noise_fast, TRI_STEPS
from .. import mix as _mix

RATE = 32000


def n_of(dur: float) -> int:
    return max(1, int(round(dur * RATE)))


def hz(note) -> float:
    """MIDI note number or name ('c6') → Hz."""
    if isinstance(note, str):
        from ..theory import pitch
        note = pitch(note)
    return 440.0 * 2 ** ((note - 69) / 12)


def _freq_array(freq, n):
    if callable(freq):
        return np.asarray(freq(np.arange(n) / RATE), dtype=float)
    f = np.asarray(freq, dtype=float)
    if f.ndim == 0:
        return np.full(n, float(f))
    if len(f) < n:
        f = np.concatenate([f, np.full(n - len(f), f[-1])])
    return f[:n]


def _phase(freq, n, phase0=0.0):
    f = _freq_array(freq, n)
    return (phase0 + np.cumsum(f) / RATE) % 1.0, f


def _blep(t, dt):
    """polyBLEP residual for a unit step (t = phase relative to the discontinuity)."""
    y = np.zeros_like(t)
    m = t < dt
    x = t[m] / dt[m]
    y[m] = x + x - x * x - 1.0
    m2 = t > 1.0 - dt
    x = (t[m2] - 1.0) / dt[m2]
    y[m2] = x * x + x + x + 1.0
    return y


def pulse(freq, dur, duty=0.5, amp=0.5, bl=True) -> np.ndarray:
    """Pulse wave (12.5/25/50 % like the NES), polyBLEP band-limited unless bl=False (raw chip aliasing)."""
    n = n_of(dur)
    ph, f = _phase(freq, n)
    y = np.where(ph < duty, 1.0, -1.0)
    if bl:
        dt = np.clip(f / RATE, 1e-6, 0.5)
        y = y + _blep(ph, dt) - _blep((ph - duty) % 1.0, dt)
    return (y - (2 * duty - 1)) * amp


def tri(freq, dur, amp=0.6, nes=True) -> np.ndarray:
    n = n_of(dur)
    ph, _ = _phase(freq, n)
    if nes:
        return (TRI_STEPS[np.floor(ph * 32).astype(int) % 32] / 7.5 - 1.0) * amp
    return (1 - 4 * np.abs(ph - 0.5)) * amp


def saw(freq, dur, amp=0.5) -> np.ndarray:
    n = n_of(dur)
    ph, f = _phase(freq, n)
    dt = np.clip(f / RATE, 1e-6, 0.5)
    return (2 * ph - 1 - _blep(ph, dt)) * amp


def sine(freq, dur, amp=0.6, phase=0.0) -> np.ndarray:
    n = n_of(dur)
    ph, _ = _phase(freq, n, phase)
    return np.sin(2 * np.pi * ph) * amp


def noise(dur, period=8, short=False, amp=0.5, seed=1) -> np.ndarray:
    """NES LFSR noise; period index 0 (hiss) … 15 (rumble); short=True is the metallic 93-step mode."""
    return lfsr_noise_fast(n_of(dur), RATE, period, short, seed) * amp


def white(dur, rng, amp=0.5) -> np.ndarray:
    return rng.uniform(-1, 1, n_of(dur)) * amp


# ------------------------------------------------------------------------------------------- envelopes
def env_exp(dur, tau, attack=0.002) -> np.ndarray:
    n = n_of(dur)
    t = np.arange(n) / RATE
    e = np.exp(-t / max(tau, 1e-4))
    na = min(n, n_of(attack))
    if na > 1:
        e[:na] *= np.linspace(0, 1, na)
    return e


def env_adsr(dur, a=0.005, d=0.05, s=0.6, r=0.05) -> np.ndarray:
    n = n_of(dur)
    na, nd, nr = n_of(a), n_of(d), n_of(r)
    ns = max(0, n - na - nd - nr)
    e = np.concatenate([np.linspace(0, 1, na), np.linspace(1, s, nd), np.full(ns, s), np.linspace(s, 0, nr)])
    return e[:n] if len(e) >= n else np.concatenate([e, np.zeros(n - len(e))])


def env_nes(dur, steps=16, start=15) -> np.ndarray:
    """NES-style stepped linear decay (volume 15 → 0 in equal time steps)."""
    n = n_of(dur)
    k = np.floor(np.arange(n) / n * steps)
    return np.clip((start - k * start / steps) / 15.0, 0, 1)


def shape(x, env) -> np.ndarray:
    n = min(len(x), len(env))
    return x[:n] * env[:n]


# ------------------------------------------------------------------------------------------- pitch helpers
def sweep(f0, f1, dur, curve='exp'):
    """Frequency array from f0 to f1 (Hz) over dur; 'exp' = musical (equal semitones per second)."""
    n = n_of(dur)
    t = np.linspace(0, 1, n)
    if curve == 'exp':
        return f0 * (f1 / f0) ** t
    if curve == 'fast':
        return f1 + (f0 - f1) * np.exp(-6 * t)
    return f0 + (f1 - f0) * t


def steps(notes, step, dur=None):
    """FamiTracker-style arpeggio: a frequency array holding each note for `step` seconds."""
    hzs = [hz(x) for x in notes]
    per = n_of(step)
    arr = np.repeat(hzs, per)
    if dur is not None:
        n = n_of(dur)
        arr = np.resize(arr, n) if len(arr) < n else arr[:n]
    return arr


def vibrato(freq, dur, rate=6.0, cents=30):
    n = n_of(dur)
    t = np.arange(n) / RATE
    f = _freq_array(freq, n)
    return f * 2 ** (cents / 1200 * np.sin(2 * np.pi * rate * t))


# ------------------------------------------------------------------------------------------- synthesis
def fm(freq, dur, ratio=3.5, index=2.5, decay=0.25, amp=0.5, index_decay=None) -> np.ndarray:
    """2-operator FM bell/chime: carrier freq, modulator freq·ratio, index decaying with the note."""
    n = n_of(dur)
    t = np.arange(n) / RATE
    f = _freq_array(freq, n)
    ph_c = np.cumsum(f) / RATE
    ph_m = np.cumsum(f * ratio) / RATE
    idx = index * np.exp(-t / (index_decay or decay * 0.6))
    return np.sin(2 * np.pi * ph_c + idx * np.sin(2 * np.pi * ph_m)) * np.exp(-t / decay) * amp


def pluck(freq, dur, rng, decay=0.996, amp=0.6, bright=0.5) -> np.ndarray:
    """Karplus-Strong string (koto blips, bow twangs)."""
    n = n_of(dur)
    period = max(2, int(round(RATE / hz(freq) if isinstance(freq, str) else RATE / freq)))
    buf = rng.uniform(-1, 1, period)
    buf = signal.lfilter([bright, 1 - bright], [1], buf)
    out = np.empty(n)
    for i in range(n):
        j = i % period
        out[i] = buf[j]
        buf[j] = decay * 0.5 * (buf[j] + buf[(j + 1) % period])
    return out * amp


def bandpass(x, lo, hi, order=2) -> np.ndarray:
    sos = signal.butter(order, [lo, min(hi, RATE / 2 * 0.95)], btype='bandpass', fs=RATE, output='sos')
    return signal.sosfilt(sos, x)


def lowpass(x, f, order=2) -> np.ndarray:
    sos = signal.butter(order, min(f, RATE / 2 * 0.95), fs=RATE, output='sos')
    return signal.sosfilt(sos, x)


def highpass(x, f, order=2) -> np.ndarray:
    sos = signal.butter(order, f, btype='highpass', fs=RATE, output='sos')
    return signal.sosfilt(sos, x)


def sweep_filter(x, f0, f1, kind='lowpass', q=0.9) -> np.ndarray:
    """Time-varying 2-pole filter (state-variable), cutoff sweeping f0 → f1 (exp)."""
    n = len(x)
    fc = f0 * (f1 / f0) ** np.linspace(0, 1, n)
    g = np.tan(np.pi * np.clip(fc, 20, RATE * 0.45) / RATE)
    k = 1.0 / q
    a1 = 1 / (1 + g * (g + k))
    ic1 = ic2 = 0.0
    out = np.empty(n)
    for i in range(n):
        v3 = x[i] - ic2
        v1 = a1[i] * ic1 + g[i] * a1[i] * v3
        v2 = ic2 + g[i] * v1
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        out[i] = v2 if kind == 'lowpass' else (v1 if kind == 'bandpass' else x[i] - k * v1 - v2)
    return out


def crush(x, bits=6, hold=1) -> np.ndarray:
    y = x
    if hold > 1:
        y = np.repeat(y[::hold], hold)[:len(x)]
    q = 2 ** (bits - 1)
    return np.round(y * q) / q


def echo(x, delay_ms=112, feedback=0.35, volume=0.35, fir='soft', tail=0.6) -> np.ndarray:
    """The same SNES echo as the music, on a mono sound (adds a tail)."""
    y = np.concatenate([x, np.zeros(n_of(tail))])
    e = _mix.snes_echo(y[:, None], RATE, delay_ms, feedback, volume, fir)[:, 0]
    return y + e


# ------------------------------------------------------------------------------------------- clean-sound helpers
def oversampled(fn, k=4) -> np.ndarray:
    """Run `fn()` with every primitive at k × RATE, then decimate with an anti-alias FIR. For FM bells and
    sweeps up high, whose sidebands would otherwise fold back below 16 kHz as clangy inharmonic fizz."""
    global RATE
    old = RATE
    RATE = old * k
    try:
        y = np.asarray(fn(), dtype=float)
    finally:
        RATE = old
    return signal.resample_poly(y, 1, k)


def fmx(freq, dur, ratio=2.0, index=1.2, decay=0.25, amp=0.5, index_decay=None, attack=0.0015) -> np.ndarray:
    """Alias-free 2-op FM (rendered 4× oversampled) with a short attack ramp so bells never click."""
    if isinstance(freq, np.ndarray):            # a frequency array made at RATE → a function of time
        arr, base = freq, RATE
        freq = lambda t: np.interp(t, np.arange(len(arr)) / base, arr)   # noqa: E731
    y = oversampled(lambda: fm(freq, dur, ratio, index, decay, amp, index_decay))
    na = min(len(y), n_of(attack))
    if na > 1:
        y[:na] *= np.linspace(0, 1, na)
    return y


def softclip(x, drive=1.5) -> np.ndarray:
    return np.tanh(x * drive) / np.tanh(drive)


def fade(x, fin=0.0, fout=0.0) -> np.ndarray:
    """Raised-cosine fade in / out (seconds)."""
    y = np.array(x, dtype=float)
    a, b = min(len(y), n_of(fin)) if fin else 0, min(len(y), n_of(fout)) if fout else 0
    if a > 1:
        y[:a] *= 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, a))
    if b > 1:
        y[-b:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, b))
    return y


def tremolo(x, rate=12.0, depth=0.3, phase=0.0) -> np.ndarray:
    t = np.arange(len(x)) / RATE
    return x * (1 - depth * 0.5 * (1 - np.cos(2 * np.pi * rate * t + phase)))


def glide(f0, f1, dur, tau) -> np.ndarray:
    """Frequency array that starts at f0 and settles exponentially on f1 (time constant tau)."""
    t = np.arange(n_of(dur)) / RATE
    return f1 + (f0 - f1) * np.exp(-t / max(1e-4, tau))


def env_rc(dur, attack=0.004, release=0.04) -> np.ndarray:
    """Flat envelope with raised-cosine attack and release (for swells, buzzes, pads)."""
    return fade(np.ones(n_of(dur)), attack, release)


def filtered_noise(dur, rng, lo=None, hi=None, amp=0.5, order=2) -> np.ndarray:
    """Seeded white noise, band-limited (lo / hi in Hz; either may be None)."""
    x = rng.uniform(-1, 1, n_of(dur)) * amp
    if lo and hi:
        return bandpass(x, lo, hi, order)
    if hi:
        return lowpass(x, hi, order)
    if lo:
        return highpass(x, lo, order)
    return x


# vowel formants (Hz, relative gain, bandwidth Hz) for the roar and the cute chirps
VOWELS = {
    'a': ((730, 1.0, 90), (1090, 0.55, 110), (2440, 0.22, 160)),
    'o': ((570, 1.0, 80), (840, 0.5, 100), (2410, 0.15, 160)),
    'u': ((300, 1.0, 70), (870, 0.3, 100), (2240, 0.1, 160)),
    'e': ((530, 1.0, 80), (1840, 0.5, 120), (2480, 0.25, 160)),
    'i': ((270, 1.0, 60), (2290, 0.45, 120), (3010, 0.3, 180)),
}


def formant(x, vowel='a', shift=1.0) -> np.ndarray:
    """Parallel resonant band-passes at a vowel's formants (shift < 1 = a bigger creature)."""
    out = np.zeros(len(x))
    for f, g, bw in VOWELS[vowel]:
        fc = min(f * shift, RATE * 0.45)
        b, a = signal.iirpeak(fc, max(1.0, fc / (bw * shift)), fs=RATE)
        out += g * signal.lfilter(b, a, x)
    return out


def formant_morph(x, vowels=('a', 'o'), shift=1.0) -> np.ndarray:
    """Glide through a list of vowels over the length of x (crossfaded formant banks)."""
    n = len(x)
    banks = [formant(x, v, shift) for v in vowels]
    if len(banks) == 1:
        return banks[0]
    pos = np.linspace(0, len(banks) - 1, n)
    out = np.zeros(n)
    for i, y in enumerate(banks):
        w = np.clip(1 - np.abs(pos - i), 0, 1)
        out += w * y
    return out


# ------------------------------------------------------------------------------------------- assembly
def seq(items) -> np.ndarray:
    """Layer [(t_seconds, array), …] into one array."""
    end = max(n_of(t) + len(x) for t, x in items)
    out = np.zeros(end)
    for t, x in items:
        i = n_of(t) if t > 0 else 0
        out[i:i + len(x)] += x
    return out


def cat(*xs) -> np.ndarray:
    return np.concatenate(xs)


def gain(x, db) -> np.ndarray:
    return x * 10 ** (db / 20)


def silence(dur) -> np.ndarray:
    return np.zeros(n_of(dur))
