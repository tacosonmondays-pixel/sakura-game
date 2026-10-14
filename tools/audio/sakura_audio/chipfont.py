"""sakura-chip.sf2: our own CC0 NES-style soundfont (in the spirit of Kai's KAI-Chip).

Bank 0:   0 Pulse 12.5   1 Pulse 25   2 Pulse 50   3 NES Triangle   4 Chip Saw   5 Pulse Pluck   6 Chip Bell
Bank 128: 0 NES Kit (kick, snare, hats, toms, crash… on the GM drum notes)

Melodic waves are looped single cycles, band-limited per octave zone (9 zones), so high notes do not alias
into mush while low notes keep the full square bite. Everything is deterministic: same bytes every build.
"""
from __future__ import annotations

import numpy as np

from .nes import bandlimited_cycle, lfsr_noise_fast, tri_sweep, TRI_STEPS
from .sf2 import SF2Writer, Zone, timecents

RATE = 32000
ZONES = [(0, 23), (24, 35), (36, 47), (48, 59), (60, 71), (72, 83), (84, 95), (96, 107), (108, 127)]
NYQ_LIMIT = 15000.0       # keep harmonics under this at the 32 kHz render rate


def midi_hz(n):
    return 440.0 * 2 ** ((n - 69) / 12)


PROGRAMS = [
    # program, name, wave, duty, env, extra generators
    (0, 'Pulse 12.5', 'pulse', 0.125, dict(a=0.002, d=2.5, s=60, r=0.07), {}),
    (1, 'Pulse 25', 'pulse', 0.25, dict(a=0.002, d=2.5, s=60, r=0.07), {}),
    (2, 'Pulse 50', 'pulse', 0.5, dict(a=0.002, d=2.5, s=60, r=0.07), {}),
    (3, 'NES Triangle', 'triangle', 0.5, dict(a=0.001, d=0, s=0, r=0.04), {}),
    (4, 'Chip Saw', 'saw', 0.5, dict(a=0.002, d=2.0, s=50, r=0.08), {}),
    (5, 'Pulse Pluck', 'pulse', 0.25, dict(a=0.001, d=0.32, s=700, r=0.05), {}),
    (6, 'Chip Bell', 'pulse', 0.5, dict(a=0.001, d=1.1, s=320, r=0.35),
     {'modEnvToPitch': 1200, 'attackModEnv': timecents(0.001), 'decayModEnv': timecents(0.035), 'sustainModEnv': 1000}),
]

RMS_TARGET = {'pulse': 0.20, 'triangle': 0.24, 'saw': 0.20}


def _zone_sample(wave, duty, lo, hi):
    root = (lo + hi) // 2
    f_root = midi_hz(root)
    length = max(16, int(round(44100 / f_root)))
    rate = length * f_root
    srate = int(round(rate))
    # pitch correction for the rounded sample rate, in cents
    corr = int(round(-1200 * np.log2(srate / rate)))
    kmax = int(NYQ_LIMIT // midi_hz(hi + 1))
    cyc = bandlimited_cycle(wave, length, max(1, kmax), duty)
    rms = np.sqrt(np.mean(cyc ** 2)) or 1.0
    cyc = cyc * (RMS_TARGET[wave] / rms)
    peak = np.abs(cyc).max()
    if peak > 0.9:
        cyc *= 0.9 / peak
    data = np.tile(cyc, 3)   # 3 cycles: loop over the middle one, valid data around both loop points
    return data, srate, root, corr, (length, 2 * length)


def _env(e):
    g = {'attackVolEnv': timecents(e['a']), 'releaseVolEnv': timecents(e['r'])}
    if e['d']:
        g['decayVolEnv'] = timecents(e['d'])
        g['sustainVolEnv'] = int(e['s'])
    return g


# ------------------------------------------------------------------------------------------- drums
def _fade(x, ms=2):
    n = min(len(x), int(RATE * ms / 1000))
    x = x.copy()
    x[-n:] *= np.linspace(1, 0, n)
    return x


def _decay(n, seconds):
    return np.exp(-np.arange(n) / (RATE * seconds))


def drum_samples() -> dict:
    """GM note → (name, float array, exclusive class)."""
    S = {}

    def kick(f0=170.0, f1=46.0, length=0.32):
        n = int(RATE * length)
        x = tri_sweep(n, RATE, f0, f1, 3.5) * _decay(n, 0.11) * 0.95
        x[:48] += lfsr_noise_fast(48, RATE, 2) * np.linspace(0.5, 0, 48)
        return x

    def snare(body=210.0, length=0.26, noise_period=3):
        n = int(RATE * length)
        nz = lfsr_noise_fast(n, RATE, noise_period) * _decay(n, 0.075) * 0.6
        bd = tri_sweep(n, RATE, body * 1.4, body, 6) * _decay(n, 0.04) * 0.7
        return nz + bd

    def hat(length, decay, short=True, period=1, amp=0.42):
        n = int(RATE * length)
        return lfsr_noise_fast(n, RATE, period, short=short) * _decay(n, decay) * amp

    def tom(f0, f1, length=0.36):
        n = int(RATE * length)
        return tri_sweep(n, RATE, f0, f1, 2.2) * _decay(n, 0.13) * 0.9

    def tone(f, length, duty=0.5, decay=0.08, amp=0.35):
        n = int(RATE * length)
        t = np.arange(n) / RATE
        ph = (t * f) % 1.0
        return np.where(ph < duty, 1.0, -1.0) * _decay(n, decay) * amp

    S[35] = ('Kick 2', kick(140, 40, 0.36), 0)
    S[36] = ('Kick', kick(), 0)
    S[37] = ('Rim', np.concatenate([hat(0.012, 0.004, False, 1, 0.5), tone(820, 0.05, 0.5, 0.012, 0.3)]), 0)
    S[38] = ('Snare', snare(), 0)
    S[40] = ('Snare 2', snare(240, 0.22, 2), 0)
    clap = np.zeros(int(RATE * 0.22))
    for k, off in enumerate((0, 0.011, 0.022)):
        b = hat(0.2 - off, 0.006 if k < 2 else 0.06, False, 2, 0.55)
        i = int(RATE * off)
        clap[i:i + len(b)] += b
    S[39] = ('Clap', clap, 0)
    S[42] = ('Hat Closed', hat(0.06, 0.016, True, 0), 1)
    S[44] = ('Hat Pedal', hat(0.05, 0.012, True, 1, 0.32), 1)
    S[46] = ('Hat Open', hat(0.42, 0.11, False, 0, 0.36), 1)
    S[49] = ('Crash', hat(1.4, 0.42, False, 1, 0.42), 0)
    S[57] = ('Crash 2', hat(1.4, 0.38, False, 2, 0.42), 0)
    S[55] = ('Splash', hat(0.6, 0.14, False, 0, 0.4), 0)
    S[52] = ('China', hat(1.0, 0.25, True, 3, 0.38), 0)
    S[51] = ('Ride', hat(0.8, 0.22, True, 2, 0.22) + tone(2650, 0.8, 0.5, 0.18, 0.08), 0)
    S[53] = ('Ride Bell', tone(1320, 0.7, 0.5, 0.2, 0.3) + tone(1980, 0.7, 0.25, 0.12, 0.12), 0)
    for note, (f0, f1) in {41: (130, 70), 43: (150, 82), 45: (175, 96), 47: (200, 112), 48: (235, 130), 50: (270, 150)}.items():
        S[note] = (f'Tom {note}', tom(f0, f1), 0)
    S[54] = ('Tambourine', hat(0.18, 0.05, True, 0, 0.36), 0)
    S[56] = ('Cowbell', tone(540, 0.22, 0.5, 0.07, 0.22) + tone(800, 0.22, 0.5, 0.07, 0.22), 0)
    S[58] = ('Vibraslap', hat(0.5, 0.2, True, 6, 0.3), 0)
    S[60] = ('Bongo Hi', tom(520, 400, 0.15), 0)
    S[61] = ('Bongo Lo', tom(380, 300, 0.18), 0)
    S[63] = ('Conga Hi', tom(330, 280, 0.2), 0)
    S[64] = ('Conga Lo', tom(250, 210, 0.24), 0)
    S[67] = ('Agogo Hi', tone(1100, 0.2, 0.5, 0.06, 0.28), 0)
    S[68] = ('Agogo Lo', tone(820, 0.2, 0.5, 0.06, 0.28), 0)
    S[69] = ('Cabasa', hat(0.12, 0.035, False, 0, 0.3), 0)
    S[70] = ('Shaker', hat(0.1, 0.03, False, 0, 0.3), 0)
    S[75] = ('Claves', tone(2400, 0.08, 0.5, 0.02, 0.32), 0)
    S[76] = ('Block Hi', tom(1300, 1150, 0.08), 0)
    S[77] = ('Block Lo', tom(980, 880, 0.09), 0)
    S[80] = ('Triangle Mute', tone(4200, 0.1, 0.5, 0.03, 0.18), 0)
    S[81] = ('Triangle', tone(4200, 0.9, 0.5, 0.3, 0.16), 0)
    return {k: (name, _fade(np.clip(x, -0.98, 0.98)), ex) for k, (name, x, ex) in S.items()}


def build_chip_sf2():
    w = SF2Writer('Sakura Chip', copyright='CC0 1.0 Universal (public domain dedication)',
                  comment='Generated by tools/audio/make_chip_sf2.py for Sakura Sentinels. NES-style pulse/triangle/saw + noise kit.',
                  engineer='Sakura Sentinels audio toolkit')
    for prog, name, wave, duty, env, extra in PROGRAMS:
        zones = []
        for lo, hi in ZONES:
            data, srate, root, corr, loop = _zone_sample(wave, duty, lo, hi)
            si = w.add_sample(f'{name[:12]} {lo}', data, srate, root, corr, loop)
            zones.append(Zone({'keyRange': (lo, hi), 'sampleModes': 1, 'overridingRootKey': root}, sample=si))
        gens = _env(env)
        gens.update(extra)
        inst = w.add_instrument(name, zones, global_gens=gens)
        w.add_preset(name, 0, prog, inst)
    zones = []
    for note, (name, x, ex) in sorted(drum_samples().items()):
        si = w.add_sample(name[:19], x, RATE, note)
        # long release: a drum hit plays out its own decay whatever the note length (hats choke via
        # their exclusive class instead)
        g = {'keyRange': (note, note), 'sampleModes': 0, 'overridingRootKey': note,
             'releaseVolEnv': timecents(1.5)}
        if ex:
            g['exclusiveClass'] = ex
        zones.append(Zone(g, sample=si))
    inst = w.add_instrument('NES Kit', zones, global_gens={'attackVolEnv': timecents(0.001)})
    w.add_preset('NES Kit', 128, 0, inst)
    return w
