"""Song model: Python DSL and Kai-style JSON note data, deterministic generators, motifs, MIDI (docs/AUDIO.md §2.3)."""
import sys
import tempfile
import unittest
from fractions import Fraction as Fr
from pathlib import Path

import mido

import _path  # noqa: F401
from sakura_audio.midi import snap_tempo, write_preview
from sakura_audio.notation import NotationError
from sakura_audio.palette import load_palette
from sakura_audio.paths import SONGS
from sakura_audio.song import Song, discover

sys.path.insert(0, str(SONGS))
from motifs import BELL, VICTORY_STING  # noqa: E402

JSON_SONG = {
    'id': 'json_demo', 'title': 'JSON demo', 'bpm': 120, 'key': 'F', 'form': ['intro', '|:', 'A', ':|'],
    'sections': [{'name': 'intro', 'bars': 1, 'chords': 'Fmaj7'}, {'name': 'A', 'bars': 2, 'chords': 'Dm9 | C7'}],
    'parts': [
        {'name': 'lead', 'role': 'lead', 'stem': 'base', 'notes': {'A': 'c5/8 f5/8 d5/4 e5/4. r/8 | f5/1'}},
        {'name': 'box', 'role': 'music_box', 'stem': 'melody', 'octave': 1, 'double': [{'part': 'lead'}]},
        {'name': 'bass', 'role': 'finger_bass', 'stem': 'base', 'gen': [{'section': ['intro', 'A'], 'kind': 'bass:sync'}]},
        {'name': 'kit', 'role': 'drums', 'stem': 'base', 'pattern': {'A': 'k/8 h s/8 h k h s h |'}},
    ],
}


class SongTest(unittest.TestCase):
    def test_json_song(self):
        s = Song.from_dict(JSON_SONG)
        s.palette_hint = load_palette('cleared')
        tl = s.timeline()
        self.assertEqual((tl.intro_beats, tl.loop_beats, tl.render_beats), (Fr(4), Fr(8), Fr(20)))
        lead = next(p for p in tl.parts if p.name == 'lead')
        box = next(p for p in tl.parts if p.name == 'box')
        self.assertEqual([n.pitches[0] + 12 for n in lead.notes], [n.pitches[0] for n in box.notes])
        self.assertEqual(lead.notes[0].start, Fr(4))                      # A starts after the 1-bar intro
        self.assertEqual(len(lead.notes), 10)                             # two passes of the loop body
        self.assertEqual(set(s.stems()), {'base', 'melody'})

    def test_bars_are_validated_against_sections(self):
        s = Song(id='x', bpm=100, key='C', form=['A'])
        s.section('A', 2, 'C | G7')
        with self.assertRaises(NotationError):
            s.part('p', 'lead').notes('A', 'c5/1')                        # one bar for a 2-bar section

    def test_generators_are_deterministic(self):
        a = discover(SONGS)['demo_battle']
        b = discover(SONGS)['demo_battle']
        pal = load_palette('cleared')
        a.palette_hint = b.palette_hint = pal
        ta, tb = a.timeline(), b.timeline()
        self.assertEqual([(p.name, [(n.start, n.pitches, n.vel) for n in p.notes]) for p in ta.parts],
                         [(p.name, [(n.start, n.pitches, n.vel) for n in p.notes]) for p in tb.parts])

    def test_motifs(self):
        self.assertEqual(BELL.question('F', 6), 'c6/8 f6/8 d6/4 e6/4.')
        self.assertEqual(BELL.answer('F', 6), 'f6/2')
        self.assertEqual(BELL.intervals(), [5, -3, 2])
        self.assertEqual(BELL.question('Am', 5), 'e5/8 a5/8 f5/4 g#5/4.')
        self.assertEqual(VICTORY_STING.question('F', 5), 'c5/16 f5/16 d5/8 f5/4')

    def test_preview_midi_has_motif_markers_and_tempo(self):
        s = discover(SONGS)['demo']
        pal = load_palette('cleared')
        s.palette_hint = pal
        tl = s.timeline()
        tempo = snap_tempo(s.bpm, tl.loop_beats, tl.intro_beats)
        with tempfile.TemporaryDirectory() as td:
            p = write_preview(Path(td) / 'demo.mid', tl, pal, tempo)
            mid = mido.MidiFile(str(p))
            metas = [m for t in mid.tracks for m in t if m.is_meta]
            self.assertTrue(any(m.type == 'marker' and m.text.startswith('motif:BELL') for m in metas))
            self.assertTrue(any(m.type == 'set_tempo' and m.tempo == tempo.tempo_us for m in metas))


if __name__ == '__main__':
    unittest.main()
