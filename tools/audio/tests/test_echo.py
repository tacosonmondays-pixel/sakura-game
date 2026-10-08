"""SNES echo impulse response: delay on the 16 ms EDL grid, feedback decay, FIR presets (docs/AUDIO.md §2.7)."""
import unittest

import numpy as np

import _path  # noqa: F401
from sakura_audio.mix import snes_echo, echo_delay_samples, fir_taps, crush, loudness_gain


class EchoTest(unittest.TestCase):
    def test_delay_grid(self):
        self.assertEqual(echo_delay_samples(208, 32000), 6656)      # EDL 13 × 16 ms
        self.assertEqual(echo_delay_samples(205, 32000), 6656)      # rounds to the 16 ms grid
        self.assertEqual(echo_delay_samples(1000, 32000), 7680)     # EDL caps at 15

    def test_impulse_response_flat(self):
        rate, d = 32000, echo_delay_samples(160, 32000)
        x = np.zeros((d * 5, 2))
        x[0] = 1.0
        y = snes_echo(x, rate, 160, feedback=0.5, volume=0.4, fir='flat')
        self.assertAlmostEqual(y[:d].max(), 0.0)
        for k in range(1, 4):
            self.assertAlmostEqual(y[k * d, 0], 0.4 * 0.5 ** (k - 1), places=9)
        self.assertAlmostEqual(np.abs(y[:, 0]).sum(), 0.4 * (1 + 0.5 + 0.25 + 0.125), places=9)

    def test_fir_presets_are_lowpass_and_unity_dc(self):
        for name in ('soft', 'dark'):
            h = fir_taps(name)
            self.assertEqual(len(h), 8)
            self.assertAlmostEqual(h.sum(), 1.0)
            hf = abs(np.sum(h * (-1) ** np.arange(8)))                # gain at Nyquist
            self.assertLess(hf, 0.5)
        self.assertLess(abs(np.sum(fir_taps('dark') * (-1) ** np.arange(8))), abs(np.sum(fir_taps('soft') * (-1) ** np.arange(8))) + 1e-9)

    def test_invert_right_and_stability(self):
        x = np.random.default_rng(1).normal(size=(32000, 2)) * 0.1
        y = snes_echo(x, 32000, 128, feedback=0.6, volume=0.3, fir='soft', invert_right=True)
        self.assertTrue(np.isfinite(y).all())
        z = snes_echo(x, 32000, 128, feedback=0.6, volume=0.3, fir='soft', invert_right=False)
        np.testing.assert_allclose(y[:, 1], -z[:, 1])

    def test_crush_and_loudness_gain(self):
        x = np.linspace(-1, 1, 1001)[:, None]
        self.assertIs(crush(x, 0, 0.0), x)
        y = crush(x, bits=4, mix=1.0)
        self.assertLessEqual(len(np.unique(y)), 17)
        g, limited = loudness_gain({'lufs': -20.0, 'truePeak': -6.0}, -16.0)
        self.assertEqual((g, limited), (4.0, False))
        g, limited = loudness_gain({'lufs': -20.0, 'truePeak': -2.0}, -16.0)
        self.assertEqual((g, limited), (1.0, True))


if __name__ == '__main__':
    unittest.main()
