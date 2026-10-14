"""Originality check (docs/AUDIO.md §6.5): a planted famous hook FAILS, the shipped soundtrack passes, and the
only phrases two songs share are declared leitmotifs or generic figures."""
import unittest

import _path  # noqa: F401
from sakura_audio.originality import check, load_blocklist, is_generic
from sakura_audio.palette import load_palette
from sakura_audio.paths import SONGS
from sakura_audio.song import Song, discover


class OriginalityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pal = load_palette('cleared')
        cls.songs = discover(SONGS)

    def test_a_planted_hook_fails(self):
        hook = next(h for h in load_blocklist() if not h.get('anchor'))
        notes, p = [], 72
        names = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
        pitch = lambda m: f'{names[m % 12]}{m // 12 - 1}'          # noqa: E731
        notes.append(pitch(p))
        for iv in hook['intervals']:
            p += iv
            notes.append(pitch(p))
        s = Song(id='planted', bpm=120, form=['A'], description='test')
        s.section('A', 4)
        notes += ['r'] * (-len(notes) % 8)                                  # whole bars of eighths
        bars_ = [' '.join(f'{n}/8' for n in notes[i:i + 8]) for i in range(0, len(notes), 8)]
        bars_ += ['r/1'] * (4 - len(bars_))
        s.part('lead', 'chip_pulse25', 'full').notes('A', ' | '.join(bars_))
        res = check({'planted': s}, self.pal)
        self.assertFalse(res['ok'])
        self.assertTrue(any(h['hook'] == hook['name'] for h in res['blocklistHits']))

    def test_the_soundtrack_passes_and_shares_no_tune_by_accident(self):
        res = check(self.songs, self.pal)
        self.assertEqual(res['blocklistHits'], [])
        self.assertTrue(res['ok'])
        # what two songs may share: harp / koto glissandi and arpeggio figures, never a hook with the same rhythm
        # in two melody parts (round 1: the Moonlit and Matsuri choruses opened alike)
        melodic = [x for x in res['shared'] if x['sameRhythm']
                   and not all(w['part'] in ('harp', 'koto', 'arps', 'arp_pad') for w in x['where'])]
        self.assertEqual(melodic, [])

    def test_generic_figures_are_not_tunes(self):
        self.assertTrue(is_generic([2, 2, 1, 2, 2, 2, 1]))          # a scale
        self.assertTrue(is_generic([4, 3, 5, 4, 3, 5, 4]))          # a broken chord
        self.assertFalse(is_generic([5, -3, 2, -2, 4, 1, -5]))


if __name__ == '__main__':
    unittest.main()
