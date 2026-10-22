"""Palettes: role resolution, aliases, inheritance and fallbacks; songs only name roles (docs/AUDIO.md §2.4)."""
import json
import os
import tempfile
import unittest
from pathlib import Path

import _path  # noqa: F401
from sakura_audio.palette import load_palette, Palette, PaletteError
from sakura_audio.paths import PALETTES, SONGS
from sakura_audio.song import discover

DESIGN_ROLES = {
    'chip_pulse12', 'chip_pulse25', 'chip_pulse50', 'chip_triangle', 'chip_saw', 'chip_pluck', 'chip_bell', 'chip_kit',
    'lead', 'counter', 'chip_bass', 'piano', 'epiano', 'epiano_fm', 'harpsichord', 'celesta', 'glock', 'music_box', 'vibes',
    'marimba', 'xylophone', 'tubular_bells', 'organ', 'organ_drawbar', 'accordion', 'nylon_gtr', 'clean_gtr',
    'overdrive_gtr', 'dist_gtr', 'upright_bass', 'finger_bass', 'pick_bass', 'fretless', 'slap_bass', 'synth_bass',
    'strings', 'strings_slow', 'tremolo', 'pizz', 'harp', 'timpani', 'choir_ahh', 'choir_ooh', 'synth_voice', 'orch_hit',
    'trumpet', 'trombone', 'tuba', 'muted_trumpet', 'horn', 'brass', 'brass_stab', 'alto_sax', 'piccolo', 'flute',
    'recorder', 'pan_flute', 'shakuhachi', 'whistle', 'ocarina', 'pad_warm', 'pad_choir', 'pad_halo', 'shamisen', 'koto',
    'kalimba', 'steel_drum', 'woodblock', 'taiko', 'melodic_tom', 'rev_cymbal', 'drums', 'drums_room', 'drums_power',
    'drums_brush', 'drums_orch', 'koto_pluck', 'choir',
    # round 3 (genre lanes: jazz, ska, city pop, techno, hardtek, Celtic, surf, sweet)
    'tenor_sax', 'bari_sax', 'clarinet', 'harmonica', 'jazz_gtr', 'muted_gtr', 'funk_gtr', 'surf_gtr', 'ukulele',
    'mandolin', 'clavinet', 'rhodes', 'vibes_dry', 'combo_organ', 'bell_piano', 'fiddle', 'tin_whistle', 'tinkle_bells',
    'xmas_bells', 'synth_chime', 'techno_bass', 'acid_bass', 'saw_bass', 'square_lead', 'saw_lead', 'saw_stab',
    'supersaw', 'sweep_pad', 'synth_brass', 'synth_strings', 'vox_chop', 'drums_jazz', 'drums_909', 'drums_electro',
    'kick_hard',
}


class PaletteTest(unittest.TestCase):
    def test_cleared_has_every_design_role(self):
        pal = load_palette('cleared')
        missing = DESIGN_ROLES - set(pal.role_names())
        self.assertFalse(missing, f'cleared lacks {sorted(missing)}')
        for r in pal.role_names():
            x = pal.resolve(r)
            self.assertTrue(Path(x['sf_path']).exists(), r)
            self.assertTrue(0 <= x['bank'] <= 128)        # GS variation banks (8, 11, 12, 16, 24) since round 3
            self.assertTrue(0 <= x['program'] <= 127)

    def test_aliases(self):
        pal = load_palette('cleared')
        lead, p25 = pal.resolve('lead'), pal.resolve('chip_pulse25')
        self.assertEqual((lead['sf_path'], lead['bank'], lead['program']), (p25['sf_path'], p25['bank'], p25['program']))
        self.assertEqual(lead['role'], 'lead')
        self.assertEqual(pal.resolve('counter')['program'], pal.resolve('chip_pulse12')['program'])

    def test_every_palette_resolves_every_role(self):
        for f in sorted(PALETTES.glob('*.json')):
            pal = load_palette(f.stem)
            for r in pal.role_names():
                pal.resolve(r)

    def test_toby_falls_back_without_private_fonts(self):
        old = os.environ.get('SAKURA_PRIVATE_SF2')
        os.environ['SAKURA_PRIVATE_SF2'] = tempfile.mkdtemp()          # empty: no private eb / SGM fonts here
        try:
            pal = load_palette('toby')
            cleared = load_palette('cleared')
            for r in ('music_box', 'slap_bass', 'drums', 'chip_pulse25'):
                self.assertEqual(pal.resolve(r)['program'], cleared.resolve(r)['program'])
            self.assertTrue(any('falling back' in w for w in pal.unique_warnings()))
            # toby's own mix still applies, relative to each song's echo (round 2: songs set their own echo)
            from sakura_audio.pipeline import song_mix
            from sakura_audio.song import Song
            song = Song(id='t', mix={'echo': {'delay_ms': 200, 'feedback': 0.4, 'volume': 0.3, 'fir': 'soft'}})
            mt, mc = song_mix(pal, song)['echo'], song_mix(cleared, song)['echo']
            self.assertEqual((mc['delay_ms'], mc['fir']), (200, 'soft'))
            self.assertAlmostEqual(mt['delay_ms'], 160)
            self.assertEqual(mt['fir'], 'dark')
            self.assertGreater(mt['feedback'], mc['feedback'])
        finally:
            if old is None:
                os.environ.pop('SAKURA_PRIVATE_SF2', None)
            else:
                os.environ['SAKURA_PRIVATE_SF2'] = old

    def test_toby_uses_private_fonts_when_present(self):
        d = Path(tempfile.mkdtemp())
        cleared = load_palette('cleared')
        chip = cleared.soundfont('chip')
        for name in ('eb.sf2', 'sgm.sf2'):
            (d / name).symlink_to(chip)                                  # any valid font stands in for the test
        old = os.environ.get('SAKURA_PRIVATE_SF2')
        os.environ['SAKURA_PRIVATE_SF2'] = str(d)
        try:
            pal = load_palette('toby')
            roles = json.loads((PALETTES / 'toby.json').read_text())['roles']
            r = next(iter(roles))
            self.assertEqual(Path(pal.resolve(r)['sf_path']).name, Path(roles[r]['sf'] == 'eb' and 'eb.sf2' or 'sgm.sf2').name)
        finally:
            if old is None:
                os.environ.pop('SAKURA_PRIVATE_SF2', None)
            else:
                os.environ['SAKURA_PRIVATE_SF2'] = old

    def test_strict_swaps_the_gm_font(self):
        pal = load_palette('strict')
        self.assertEqual(Path(pal.resolve('piano')['sf_path']).name, 'FluidR3_GM.sf2')
        self.assertEqual(Path(pal.resolve('chip_pulse25')['sf_path']).name, 'sakura-chip.sf2')

    def test_unknown_role_and_field(self):
        pal = load_palette('cleared')
        with self.assertRaises(PaletteError):
            pal.resolve('kazoo')
        with self.assertRaises(PaletteError):
            Palette({'id': 'x', 'roles': {'a': {'sf': 'gm', 'program': 1, 'volume': 3}}})

    def test_demo_song_exercises_every_role(self):
        pal = load_palette('cleared')
        songs = discover(SONGS)
        used = set()
        for s in songs.values():
            s.palette_hint = pal
            used |= s.roles()
            for r in s.roles():
                pal.resolve(r)                                           # songs only use known roles
        self.assertFalse(set(pal.role_names()) - used, f'roles no song plays: {sorted(set(pal.role_names()) - used)}')
        self.assertEqual(set(songs['demo'].stems()), {'base', 'melody'})
        self.assertEqual(set(songs['demo_battle'].stems()), {'base', 'intensity'})


if __name__ == '__main__':
    unittest.main()
