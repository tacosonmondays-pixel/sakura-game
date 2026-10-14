"""Our CC0 chip soundfont: the SF2 writer round-trips through FluidSynth with the right pitches (docs/AUDIO.md §2.2)."""
import shutil
import subprocess
import tempfile
import unittest
import warnings
from pathlib import Path

import mido
import numpy as np
from scipy.io import wavfile

import _path  # noqa: F401
from sakura_audio.chipfont import build_chip_sf2
from sakura_audio.sf2 import read_presets


def render_note(sf2: Path, td: Path, bank: int, program: int, note: int, seconds=0.6, rate=32000) -> np.ndarray:
    mid = mido.MidiFile(type=0, ticks_per_beat=480)
    tr = mido.MidiTrack()
    mid.tracks.append(tr)
    ch = 9 if bank == 128 else 0
    tr.append(mido.MetaMessage('set_tempo', tempo=500000, time=0))
    if ch != 9:
        tr.append(mido.Message('control_change', channel=ch, control=0, value=bank, time=0))
    tr.append(mido.Message('program_change', channel=ch, program=program, time=0))
    tr.append(mido.Message('note_on', channel=ch, note=note, velocity=100, time=0))
    tr.append(mido.Message('note_off', channel=ch, note=note, velocity=0, time=int(480 * seconds * 2)))
    tr.append(mido.MetaMessage('end_of_track', time=240))
    mp, wp = td / f'n{bank}_{program}_{note}.mid', td / f'n{bank}_{program}_{note}.wav'
    mid.save(str(mp))
    subprocess.run(['fluidsynth', '-ni', '-q', '-R', '0', '-C', '0', '-r', str(rate), '-O', 'float', '-T', 'wav',
                    '-F', str(wp), str(sf2), str(mp)], check=True, capture_output=True, timeout=60)
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        _, x = wavfile.read(str(wp))
    x = np.asarray(x, dtype=np.float64)
    return x.mean(axis=1) if x.ndim > 1 else x


def f0(x: np.ndarray, rate=32000) -> float:
    seg = x[int(rate * 0.05):int(rate * 0.45)]
    seg = seg * np.hanning(len(seg))
    spec = np.abs(np.fft.rfft(seg, 1 << 18))
    freqs = np.fft.rfftfreq(1 << 18, 1 / rate)
    lo = np.searchsorted(freqs, 50)
    # the strongest peak can be a harmonic: take the lowest peak within 12 dB of it
    s = spec[lo:]
    top = s.max()
    cand = np.nonzero(s > top * 10 ** (-12 / 20))[0]
    k = cand[0]
    while k + 1 < len(s) and s[k + 1] > s[k]:
        k += 1
    return float(freqs[lo + k])


@unittest.skipUnless(shutil.which('fluidsynth'), 'fluidsynth not installed')
class ChipFontTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.td = Path(tempfile.mkdtemp())
        cls.sf2 = build_chip_sf2().write(cls.td / 'sakura-chip.sf2')

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.td, ignore_errors=True)

    def test_presets(self):
        p = read_presets(self.sf2)
        self.assertEqual([(b, n) for b, n, _ in p], [(0, i) for i in range(7)] + [(128, 0)])
        self.assertIn('NES Kit', [x[2] for x in p])

    def test_deterministic(self):
        self.assertEqual(build_chip_sf2().to_bytes(), self.sf2.read_bytes())

    def test_pitch_per_program(self):
        for program in range(6):              # 6 = chip bell (pitch blip at the attack, then steady)
            for note in (57, 69, 81):
                x = render_note(self.sf2, self.td, 0, program, note)
                self.assertGreater(np.abs(x).max(), 0.01, f'program {program} note {note} is silent')
                want = 440.0 * 2 ** ((note - 69) / 12)
                got = f0(x)
                cents = 1200 * np.log2(got / want)
                self.assertLess(abs(cents), 15, f'program {program} note {note}: {got:.1f} Hz vs {want:.1f} Hz')

    def test_high_notes_are_band_limited(self):
        # a pulse at C8 rendered at 32 kHz: almost no energy far below the fundamental (no aliasing mush)
        x = render_note(self.sf2, self.td, 0, 2, 108)
        spec = np.abs(np.fft.rfft(x[3200:12800] * np.hanning(9600)))
        freqs = np.fft.rfftfreq(9600, 1 / 32000)
        below = spec[(freqs > 100) & (freqs < 3000)].max()
        self.assertLess(below, spec.max() * 10 ** (-40 / 20))

    def test_drum_kit(self):
        for note in (36, 38, 42, 46, 49):
            x = render_note(self.sf2, self.td, 128, 0, note, seconds=0.3)
            self.assertGreater(np.abs(x).max(), 0.01, f'drum {note} is silent')


if __name__ == '__main__':
    unittest.main()
