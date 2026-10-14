"""Objective gates for rendered music: loop seams (WAV and encoded), encoder alignment, clicks, loudness.

Every check returns a dict with 'ok' plus the measured numbers, so reports can show *why* something failed.
"""
from __future__ import annotations

import numpy as np

SEAM_N = 32000            # 1 s of context either side of a WAV seam
CLICK_WIN = 160           # 5 ms at 32 kHz


def db(x: float) -> float:
    return float(20 * np.log10(max(float(x), 1e-12)))


def rms(x) -> float:
    return float(np.sqrt(np.mean(np.square(x)))) if len(x) else 0.0


def click_ratio(y: np.ndarray, at: int, win: int = CLICK_WIN) -> float:
    """2nd-difference energy in the window around `at` versus the median window of `y` (≈1 = no click)."""
    mono = y.mean(axis=1) if y.ndim > 1 else y
    d2 = np.diff(mono, 2) ** 2
    nwin = len(d2) // win
    if nwin < 3:
        return 0.0
    e = d2[:nwin * win].reshape(nwin, win).sum(axis=1)
    k = min(max(0, (at - 1) // win), nwin - 1)
    local = e[max(0, k - 1):k + 2].max()
    med = np.median(e) + 1e-15
    return float(local / med)


def splice_check(splice: np.ndarray, ref: np.ndarray, at: int, max_rms_db: float, max_click: float = 3.0) -> dict:
    n = min(len(splice), len(ref))
    diff = splice[:n] - ref[:n]
    r = db(rms(diff))
    ref_clicks = click_ratio(ref[:n], at)
    c = click_ratio(splice[:n], at)
    # a click is relative to what the continuous music already does at that spot
    rel = c / max(ref_clicks, 1.0)
    return {'ok': bool(r < max_rms_db and rel < max_click), 'rmsDiffDb': round(r, 1), 'maxDiff': round(float(np.abs(diff).max()), 6),
            'click': round(rel, 2), 'limitDb': max_rms_db}


def wav_seams(F: np.ndarray, R: np.ndarray, pos: dict, n: int = SEAM_N) -> dict:
    """Loop wrap and entry splices of the loop file F against the continuous render R."""
    L0, P, T = pos['introEnd'], pos['loopEnd'] - pos['loopStart'], pos['seam']
    ls, le, head, entry = pos['loopStart'], pos['loopEnd'], pos['head'], pos['entry']
    n = min(n, P // 2, head if head else n)
    wrap = np.concatenate([F[le - n:le], F[ls:ls + n]])
    wrap_ref = R[L0 + P - n:L0 + P + n]
    ent = np.concatenate([F[head - n:head], F[entry:entry + n]])
    ent_ref = R[L0 + T - n:L0 + T + n]
    return {'wrap': splice_check(wrap, wrap_ref, n, -60.0), 'entry': splice_check(ent, ent_ref, n, -60.0)}


def encoded_seams(Fd: np.ndarray, pos: dict, F: np.ndarray) -> dict:
    """Same splices inside a decoded file Fd, against Fd's own continuous guard regions (codec noise only)."""
    G = pos['guard']
    ls, le, head, entry = pos['loopStart'], pos['loopEnd'], pos['head'], pos['entry']
    n = G
    wrap = np.concatenate([Fd[le - n:le], Fd[ls:ls + n]])
    wrap_ref = Fd[ls - n:ls + n]
    ent = np.concatenate([Fd[head - n:head], Fd[entry:entry + n]])
    ent_ref = Fd[head - n:head + n]
    m = min(len(Fd), len(F))
    noise = db(rms(Fd[:m] - F[:m]))
    # two encodes of the same music differ by ≈ √2 × the codec noise: allow noise + 6 dB, never more than −25 dB
    lim = min(noise + 6.0, -25.0)
    return {'wrap': splice_check(wrap, wrap_ref, n, lim), 'entry': splice_check(ent, ent_ref, n, lim),
            'codecNoiseDb': round(noise, 1), 'decodedLength': int(len(Fd)), 'expectedLength': int(len(F))}


def alignment(dec: np.ndarray, src: np.ndarray, search: int = 4096) -> dict:
    """Lag (samples) of the decoded file versus its source by cross-correlation (0 = edit list/pre-skip honoured)."""
    a = dec.mean(axis=1) if dec.ndim > 1 else dec
    b = src.mean(axis=1) if src.ndim > 1 else src
    m = min(len(a), len(b), 32000 * 6)
    a, b = a[:m], b[:m]
    n = 1 << int(np.ceil(np.log2(2 * m)))
    xc = np.fft.irfft(np.fft.rfft(a, n) * np.conj(np.fft.rfft(b, n)), n)
    lags = np.concatenate([np.arange(0, search + 1), np.arange(-search, 0)])
    vals = np.concatenate([xc[:search + 1], xc[-search:]])
    lag = int(lags[np.argmax(vals)])
    return {'ok': lag == 0, 'lag': lag}


def loop_identity(R: np.ndarray, L0: int, P: int, T: int) -> dict:
    """Cycle 1 vs cycle 2 after the seam. The tempo snap removes timing drift; what is left (≈ −65…−70 dB)
    is FluidSynth's voice-pool state (reused voices start with slightly different filter history)."""
    a = R[L0 + T:L0 + P]
    b = R[L0 + P + T:L0 + 2 * P]
    d = db(rms(a - b))
    return {'ok': d < -60, 'rmsDiffDb': round(d, 1)}


def basic_levels(x: np.ndarray) -> dict:
    peak = db(np.abs(x).max())
    dc = float(np.abs(x.mean(axis=0)).max())
    return {'ok': bool(peak <= -0.5 and dc < 0.001), 'samplePeakDb': round(peak, 2), 'dc': round(dc, 6)}
