"""Tempo snap and the exact head + loop-body file layout (docs/AUDIO.md §2.7 step 4, §2.9)."""
import unittest
from fractions import Fraction as Fr

import numpy as np

import _path  # noqa: F401
from sakura_audio.midi import snap_tempo
from sakura_audio.mix import build_loop_file, GUARD


class LoopMathTest(unittest.TestCase):
    def test_tempo_snap(self):
        for bpm, loop_beats, intro_beats in ((144, 64, 8), (112, 64, 8), (132, 96, 16), (84, 64, 8)):
            t = snap_tempo(bpm, loop_beats, intro_beats, 32000)
            P = t.beats_to_samples(loop_beats)
            self.assertEqual(P.denominator, 1)
            self.assertEqual(P.numerator % 64, 0, 'loop body is a whole number of FluidSynth blocks')
            self.assertEqual(t.beats_to_samples(intro_beats).denominator, 1)
            self.assertLess(abs(t.bpm - bpm) / bpm, 3e-4)

    def test_loop_file_layout(self):
        L0, P, T = 5000, 40000, 12000
        R = np.arange(L0 + 2 * P + 1000, dtype=np.float64)[:, None]   # sample value = its index in R
        F, pos = build_loop_file(R, L0, P, T)
        self.assertEqual(pos['head'], L0 + T)
        self.assertEqual(pos['loopStart'], L0 + T + 2 * GUARD)
        self.assertEqual(pos['loopEnd'] - pos['loopStart'], P)
        self.assertEqual(pos['entry'], pos['loopStart'] + T)
        self.assertEqual(len(F), pos['length'])
        # the head is the continuous render up to the seam (+ a guard of real audio after it)
        self.assertEqual(F[pos['head'] - 1, 0], L0 + T - 1)
        self.assertEqual(F[pos['head'] + GUARD - 1, 0], L0 + T + GUARD - 1)
        # the loop body is cycle 2, which already holds cycle 1's echo and release tails
        self.assertEqual(F[pos['loopStart'], 0], L0 + P)
        self.assertEqual(F[pos['loopEnd'] - 1, 0], L0 + 2 * P - 1)
        # entering at `entry` continues the music exactly one period after the head's end
        self.assertEqual(F[pos['entry'], 0] - P, L0 + T)
        # guards: real audio on both sides of every played point
        self.assertEqual(F[pos['loopStart'] - 1, 0], L0 + P - 1)
        self.assertEqual(F[pos['loopEnd'], 0], L0 + P)

    def test_seam_must_fit(self):
        with self.assertRaises(ValueError):
            build_loop_file(np.zeros((100000, 2)), 1000, 8000, 6000)


if __name__ == '__main__':
    unittest.main()
