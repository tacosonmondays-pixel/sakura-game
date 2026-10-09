"""Round-3 toolkit (docs/AUDIO.md §2.4): genre roles in every palette, kit names per kit, swing quantise options."""
import json
import os
import tempfile
import unittest
from fractions import Fraction as Fr
from pathlib import Path

import _path  # noqa: F401
from sakura_audio.notation import DRUM_NAMES
from sakura_audio.palette import load_palette
from sakura_audio.paths import PALETTES
from sakura_audio.sf2 import read_presets, preset_keys
from sakura_audio.song import Song, is_kit_role

R3_ROLES = {
    'tenor_sax', 'bari_sax', 'clarinet', 'harmonica', 'jazz_gtr', 'muted_gtr', 'funk_gtr', 'surf_gtr', 'ukulele',
    'mandolin', 'clavinet', 'rhodes', 'vibes_dry', 'combo_organ', 'bell_piano', 'fiddle', 'tin_whistle', 'tinkle_bells',
    'xmas_bells', 'synth_chime', 'techno_bass', 'acid_bass', 'saw_bass', 'square_lead', 'saw_lead', 'saw_stab',
    'supersaw', 'sweep_pad', 'synth_brass', 'synth_strings', 'vox_chop', 'drums_jazz', 'drums_909', 'drums_electro',
    'kick_hard',
}
FX_ROLES = {'kick_hard': 'drive', 'saw_bass': 'drive', 'acid_bass': 'filter', 'rhodes': 'drive'}
# drum names the round-3 briefs write; every kit role must land each of them on a sample (after its kit_map)
KIT_NAMES = ['k', 'tk', 's', 'sd2', 'rs', 'cl', 'h', 'ph', 'o', 'c', 'c2', 'rd', 'rb', 'sp', 'ch', 't1', 't2', 't3', 't4',
             'tb', 'cb', 'sh', 'wb', 'tri', 'cg', 'bg', 'cv', 'fs', 'sr', 'st']


class R3PaletteTest(unittest.TestCase):
    def test_every_palette_has_the_r3_roles_on_real_presets(self):
        keys_cache, presets_cache = {}, {}
        for name in ('cleared', 'strict', 'chip'):
            pal = load_palette(name)
            self.assertFalse(R3_ROLES - set(pal.role_names()), name)
            for r in pal.role_names():
                x = pal.resolve(r)
                f = str(x['sf_path'])
                if f not in presets_cache:
                    presets_cache[f] = {(b, p) for b, p, _ in read_presets(f)}
                self.assertIn((x['bank'], x['program']), presets_cache[f], f'{name}/{r} → {x["bank"]}/{x["program"]} in {f}')
                if x['bank'] == 128:                                   # kits: every drum name lands on a sample
                    if f not in keys_cache:
                        keys_cache[f] = preset_keys(f)
                    have = keys_cache[f][(128, x['program'])]
                    km = x.get('kit_map') or {}
                    missing = [n for n in KIT_NAMES if km.get(n, DRUM_NAMES[n]) not in have]
                    self.assertFalse(missing, f'{name}/{r} (kit {x["program"]}) has no sample for {missing}')
            self.assertFalse(pal.unique_warnings(), name)               # strict/chip inherit quietly

    def test_role_fx_survive_palette_swaps(self):
        cleared = load_palette('cleared')
        for r, eff in FX_ROLES.items():
            self.assertIn(eff, cleared.resolve(r).get('fx', {}), r)
            self.assertEqual(load_palette('strict').resolve(r).get('fx'), cleared.resolve(r).get('fx'), r)
        toby = json.loads((PALETTES / 'toby.json').read_text())['roles']
        for r in FX_ROLES:                                             # a child palette replaces whole role entries
            self.assertEqual(toby[r].get('fx'), json.loads((PALETTES / 'cleared.json').read_text())['roles'][r].get('fx'), r)

    def test_toby_maps_every_sampled_role(self):
        """--palette toby re-renders everything by editing toby.json only: every GM role has a toby entry."""
        cleared = json.loads((PALETTES / 'cleared.json').read_text())['roles']
        toby = json.loads((PALETTES / 'toby.json').read_text())['roles']
        gm = {r for r, v in cleared.items() if v.get('sf') == 'gm'}
        self.assertFalse(gm - set(toby), sorted(gm - set(toby)))
        old = os.environ.get('SAKURA_PRIVATE_SF2')
        os.environ['SAKURA_PRIVATE_SF2'] = tempfile.mkdtemp()           # no private fonts: everything falls back
        try:
            pal = load_palette('toby')
            for r in R3_ROLES:
                self.assertEqual(pal.resolve(r)['program'], load_palette('cleared').resolve(r)['program'], r)
        finally:
            if old is None:
                os.environ.pop('SAKURA_PRIVATE_SF2', None)
            else:
                os.environ['SAKURA_PRIVATE_SF2'] = old

    def test_kit_roles_without_a_palette(self):
        self.assertTrue(is_kit_role('kick_hard'))                        # does not start with 'drums'
        self.assertTrue(is_kit_role('drums_909'))
        self.assertFalse(is_kit_role('saw_bass'))
        s = Song(id='k', form=['A'])
        s.section('A', 1)
        s.part('kick', 'kick_hard').notes('A', 'k/4 k/4 k/4 fs/8 st/8')   # parses drum names, not pitches
        self.assertEqual(DRUM_NAMES['fs'], 26)
        self.assertEqual(DRUM_NAMES['sr'], 25)
        self.assertEqual(DRUM_NAMES['st'], 31)


class SwingTest(unittest.TestCase):
    def starts(self, song, part):
        tl = song.timeline(passes=1)
        return [n.start for n in next(p for p in tl.parts if p.name == part).notes]

    def test_song_section_and_part_swing(self):
        s = Song(id='sw', swing=0.6, form=['A', 'B'])
        s.section('A', 1)
        s.section('B', 1, swing=0.5)                                     # a straight bridge in a swing tune
        s.part('p', 'piano').notes(['A', 'B'], 'c4/8 c4/8 c4/8 c4/8 c4/2')
        s.part('q', 'piano', swing=Fr(2, 3)).notes(['A', 'B'], 'c4/8 c4/8 c4/2.')
        self.assertEqual(self.starts(s, 'p'), [0, Fr(3, 5), 1, Fr(8, 5), 2, 4, Fr(9, 2), 5, Fr(11, 2), 6])
        self.assertEqual(self.starts(s, 'q'), [0, Fr(2, 3), 1, 4, Fr(14, 3), 5])  # the part wins over both

    def test_swing_keeps_triplets_and_swings_16ths(self):
        s = Song(id='t', swing=0.64, swing_triplets='keep', form=['A'])
        s.section('A', 1)
        s.part('trip', 'piano').notes('A', 'c4/8t c4/8t c4/8t c4/8 c4/8 c4/2')
        st = self.starts(s, 'trip')
        self.assertEqual(st[:3], [0, Fr(1, 3), Fr(2, 3)])               # triplet skip untouched
        self.assertEqual(st[4], 1 + Fr(64, 100))                          # duple 8th swung
        w = Song(id='w', swing=0.64, form=['A'])
        w.section('A', 1)
        w.part('trip', 'piano').notes('A', 'c4/8t c4/8t c4/8t c4/2.')
        self.assertNotEqual(self.starts(w, 'trip')[1], Fr(1, 3))          # 'warp' (the default) moves them
        h = Song(id='h', swing=0.6, swing_unit=0.5, form=['A'])
        h.section('A', 1)
        h.part('s16', 'piano').notes('A', 'c4/16 c4/16 c4/16 c4/16 c4/2.')
        self.assertEqual(self.starts(h, 's16'), [0, Fr(3, 10), Fr(1, 2), Fr(1, 2) + Fr(3, 10), 1])

    def test_default_swing_is_unchanged(self):
        """The round-2 formula: 8th swing over each beat (songs written before round 3 render identically)."""
        s = Song(id='o', swing=0.62, form=['A'])
        s.section('A', 1)
        s.part('p', 'piano').notes('A', 'c4/16 c4/16 c4/8 c4/8t c4/8t c4/8t c4/2')
        sw = Fr(0.62).limit_denominator(100)

        def old(t):
            beat = t.numerator // t.denominator
            f = t - beat
            return beat + f * 2 * sw if f <= Fr(1, 2) else beat + sw + (f - Fr(1, 2)) * 2 * (1 - sw)
        written = [Fr(0), Fr(1, 4), Fr(1, 2), Fr(1), Fr(4, 3), Fr(5, 3)]
        self.assertEqual(self.starts(s, 'p')[:6], [old(t) for t in written])


if __name__ == '__main__':
    unittest.main()
