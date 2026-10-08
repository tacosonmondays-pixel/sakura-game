"""Note strings → notes, and the bar validator (docs/AUDIO.md §2.3)."""
import unittest
from fractions import Fraction as Fr

import _path  # noqa: F401
from sakura_audio.notation import parse, NotationError


class NotationTest(unittest.TestCase):
    def test_pitches_and_durations(self):
        notes, total = parse('c5/8 f5/8 d5/4 e5/4. f5/8 |')
        self.assertEqual([n.pitches[0] for n in notes], [72, 77, 74, 76, 77])
        self.assertEqual([n.dur for n in notes], [Fr(1, 2), Fr(1, 2), Fr(1), Fr(3, 2), Fr(1, 2)])
        self.assertEqual(total, 4)

    def test_duration_carries_over_and_rests_vanish(self):
        notes, total = parse('c4/8 d4 r e4 f4/2')
        self.assertEqual(len(notes), 4)
        self.assertEqual(notes[1].dur, Fr(1, 2))
        self.assertEqual(notes[2].start, Fr(3, 2))
        self.assertEqual(total, 4)

    def test_bar_validator(self):
        with self.assertRaises(NotationError):
            parse('c5/4 d5/4 | e5/1')
        with self.assertRaises(NotationError):
            parse('c5/4 d5/4 e5/4 | f5/1', beats_per_bar=Fr(3))

    def test_ties_merge_across_bars(self):
        notes, _ = parse('c5/2. c5/4~ | c5/2 r/2')
        self.assertEqual(len(notes), 2)
        self.assertEqual(notes[1].dur, Fr(3))

    def test_chord_accent_ghost_and_groups(self):
        notes, total = parse('[f4 a4 c5]/2 (g4/8! g4/8?)x2')
        self.assertEqual(notes[0].pitches, (65, 69, 72))
        self.assertEqual(notes[1].vel, 116)
        self.assertEqual(notes[2].vel, 66)
        self.assertEqual(len(notes), 5)
        self.assertEqual(total, 4)

    def test_triplets_and_repeat_bar(self):
        notes, total = parse('c5/8t d5 e5 f5/4 g5/2 | %')
        self.assertEqual(notes[3].start, Fr(1))
        self.assertEqual(total, 8)
        self.assertEqual(len(notes), 10)

    def test_drums(self):
        notes, _ = parse('k+c/4 h/8 h s/4 h/8 o', drums=True)
        self.assertEqual(notes[0].pitches, (36, 49))
        self.assertEqual(notes[0].drum_names, ('k', 'c'))
        self.assertEqual(notes[-1].pitches, (46,))


if __name__ == '__main__':
    unittest.main()
