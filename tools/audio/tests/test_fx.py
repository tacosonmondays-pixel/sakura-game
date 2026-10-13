"""Part effects (sakura_audio/fx.py, docs/AUDIO.md §2.4): SVF filter, drive, sidechain pump, their timeline curves,
and the pipeline contract (effects run per job before the stem sum, the loop seam stays exact)."""
import tempfile
import unittest
from fractions import Fraction as Fr
from pathlib import Path

import numpy as np

import _path  # noqa: F401
from sakura_audio.fx import (svf, svf_reference, drive, pump_gain, merge_fx, validate_fx, FxError, FxContext,
                             automation_points, cutoff_curve, key_onsets, part_fx, fx_key, needs_own_job)
from sakura_audio.midi import snap_tempo
from sakura_audio.palette import load_palette
from sakura_audio.song import Song

RATE = 32000


def loop_song(fx_pad=None, fx_bass=None):
    s = Song(id='fxloop', bpm=130, key='C', form=['I', '|:', 'A', 'B', ':|'], swing_triplets='keep')
    s.section('I', 1)
    s.section('A', 2)
    s.section('B', 2)
    s.part('kit', 'chip_kit', 'base').notes('I', 'k/4 h/4 k/4 h/4').notes(['A', 'B'], 'k/4 h/4 k/4 h/4 | k/4 h/4 k/8 k/8 h/4')
    s.part('pad', 'chip_saw', 'base', fx=fx_pad).notes(['A', 'B'], '[c4 e4 g4]/1 | [a3 d4 f4]/1')
    s.part('bass', 'chip_triangle', 'intensity', fx=fx_bass).notes(
        ['A', 'B'], 'c2/16! c3/16 c2/16 g2/16 c2/8 c2/8! eb2/4 f2/4 | g2/8 g2/8! b2/4 d3/16 c3/16 b2/16 g2/16! f2/4')
    return s


def ctx_for(song, part_names=None, n_extra=8000):
    pal = load_palette('cleared')
    song.palette_hint = pal
    tl = song.timeline()
    tempo = snap_tempo(song.bpm, tl.loop_beats, tl.intro_beats, RATE)
    n = tempo.samples(tl.render_beats) + n_extra
    notes = [nt for p in tl.parts if part_names is None or p.name in part_names for nt in p.notes]
    loop = (tempo.samples(tl.intro_beats), tempo.samples(tl.loop_beats))
    return FxContext(RATE, tempo, song, tl, notes, n, loop), tempo, tl


class SvfTest(unittest.TestCase):
    def test_block_filter_equals_per_sample_filter(self):
        rng = np.random.default_rng(3)
        x = rng.standard_normal((3000, 2))
        nb = -(-3000 // 32)
        fc = 2 ** np.linspace(np.log2(80), np.log2(12000), nb) * (1 + 0.4 * np.sin(np.arange(nb)))   # fast wobble
        for kind in ('lp', 'bp', 'hp'):
            a = svf(x, RATE, fc, 5.0, kind, 32)
            b = svf_reference(x, RATE, np.repeat(fc, 32)[:3000], 5.0, kind)
            self.assertLess(np.abs(a - b).max(), 1e-9, kind)

    def test_static_lowpass_response(self):
        t = np.arange(RATE) / RATE
        dc = svf(np.ones((RATE, 1)), RATE, np.full(RATE // 32 + 1, 1000.0), 0.707, 'lp')
        self.assertAlmostEqual(float(dc[-1, 0]), 1.0, places=6)
        hi = svf(np.sin(2 * np.pi * 8000 * t)[:, None], RATE, np.full(RATE // 32 + 1, 1000.0), 0.707, 'lp')
        self.assertLess(20 * np.log10(np.abs(hi[RATE // 2:]).max()), -30)     # 3 octaves above: ≈ −36 dB
        bp = svf(np.sin(2 * np.pi * 1000 * t)[:, None], RATE, np.full(RATE // 32 + 1, 1000.0), 4.0, 'bp')
        self.assertAlmostEqual(float(np.abs(bp[RATE // 2:]).max()), 1.0, delta=0.02)   # unity at the centre


class DriveTest(unittest.TestCase):
    def setUp(self):
        t = np.arange(RATE // 2) / RATE
        env = np.exp(-t * 6)
        self.x = np.stack([0.3 * env * np.sin(2 * np.pi * 110 * t)] * 2, axis=1)

    def test_deterministic_and_scale_invariant(self):
        a = drive(self.x, RATE, 14, 35, 6000)
        b = drive(self.x, RATE, 14, 35, 6000)
        self.assertTrue(np.array_equal(a, b))
        c = drive(self.x * 0.25, RATE, 14, 35, 6000)              # ref='peak': part gain only scales the output
        self.assertLess(np.abs(c - 0.25 * a).max(), 1e-12)

    def test_saturates_and_lifts_the_tail(self):
        y = drive(self.x, RATE, 14, 35, 0, os=1)
        n = len(y)
        spec = np.abs(np.fft.rfft(y[:n // 4, 0] * np.hanning(n // 4)))
        f = np.fft.rfftfreq(n // 4, 1 / RATE)
        h1 = spec[np.argmin(np.abs(f - 110))]
        h3 = spec[np.argmin(np.abs(f - 330))]
        self.assertGreater(h3 / h1, 0.1)                          # odd harmonics from the tanh
        tail_in = np.abs(self.x[-2000:, 0]).max()
        tail_out = np.abs(y[-2000:, 0]).max()
        self.assertGreater(tail_out / tail_in, 3.0)               # the quiet tail comes up (≈ +14 dB small-signal)
        self.assertLess(np.abs(y).max(), np.abs(self.x).max() * 1.1)    # the peak stays (± the high-pass overshoot)

    def test_mix_zero_is_dry(self):
        self.assertTrue(np.allclose(drive(self.x, RATE, 14, mix=0.0), self.x))


class PumpTest(unittest.TestCase):
    def test_envelope_shape_and_overlap(self):
        kw = dict(beat_samples=16000, depth_db=6, attack_ms=3, release_beats=0.5)
        g = pump_gain(np.array([1000, 1200]), 20000, RATE, **kw)
        g1 = pump_gain(np.array([1000]), 20000, RATE, **kw)
        g2 = pump_gain(np.array([1200]), 20000, RATE, **kw)
        self.assertAlmostEqual(g[999], 1.0)
        self.assertAlmostEqual(20 * np.log10(g1[1000 + 96]), -6, places=3)      # fully down after the attack (3 ms)
        self.assertTrue(np.array_equal(g, np.minimum(g1, g2)))                  # overlaps keep the deepest dip
        self.assertAlmostEqual(g[1200 + 96 + 8000 + 5], 1.0, places=9)          # back to unity after the release
        self.assertTrue(np.all(np.diff(g[1300:9400]) >= -1e-12))                # recovery is monotonic

    def test_key_onsets_follow_the_kick(self):
        s = loop_song()
        ctx, tempo, tl = ctx_for(s)
        on = key_onsets({'key': 'kit', 'notes': ['k']}, ctx)
        kit = next(p for p in tl.parts if p.name == 'kit')
        kicks = [n.start for n in kit.notes if 'k' in n.drum_names]
        c2 = tl.intro_beats + tl.loop_beats              # cycle 2 repeats once more past the loop end (virtual pass)
        want = sorted({tempo.samples(b) for b in kicks} | {tempo.samples(b + tl.loop_beats) for b in kicks if b >= c2})
        self.assertEqual([int(v) for v in on], want)
        self.assertFalse(any(tempo.samples(n.start) in set(on.tolist()) for n in kit.notes if n.drum_names == ('h',)))
        beats = key_onsets({'key': 'beat', 'every': 0.5}, ctx)
        self.assertEqual(int(beats[1] - beats[0]), tempo.samples(Fr(1, 2)))
        with self.assertRaises(FxError):
            key_onsets({'key': 'nope'}, ctx)

    def test_pump_is_periodic_over_the_loop(self):
        s = loop_song()
        ctx, tempo, tl = ctx_for(s)
        on = key_onsets({'key': 'kit', 'notes': ['k']}, ctx)
        g = pump_gain(on, ctx.n, RATE, float(tempo.beats_to_samples(1)), 8, 3, 0.5)
        L0, P = tempo.samples(tl.intro_beats), tempo.samples(tl.loop_beats)
        self.assertTrue(np.array_equal(g[L0 + 2000:L0 + P], g[L0 + P + 2000:L0 + 2 * P]))


class FilterCurveTest(unittest.TestCase):
    def test_automation_points_cover_every_pass(self):
        s = loop_song()
        pts = automation_points(s, [['A', 1, 200], ['B', 3, 4000]])
        # A starts at beats 4, 20 and (virtual third pass) 36; B ends at 20, 36, 52; on a shared beat the end of
        # the earlier pass comes first, so each pass sweeps 200 → 4000 and steps back at the wrap
        self.assertEqual([(float(b), hz) for b, hz in pts],
                         [(4, 200), (20, 4000), (20, 200), (36, 4000), (36, 200), (52, 4000)])
        with self.assertRaises(FxError):
            automation_points(s, [['Z', 1, 200]])
        with self.assertRaises(FxError):
            automation_points(s, [['A', 9, 200]])

    def test_cutoff_curve_is_periodic_and_follows_accents(self):
        s = loop_song()
        ctx, tempo, tl = ctx_for(s, ['bass'])
        cfg = {'type': 'lp', 'q': 4, 'auto': [['A', 1, 200], ['B', 3, 4000]], 'accent': {'depth_oct': 2, 'decay_ms': 150}}
        fc = cutoff_curve(cfg, ctx, 32)
        L0, P = tempo.samples(tl.intro_beats), tempo.samples(tl.loop_beats)
        a, b = (L0 + 31) // 32, (L0 + P + 31) // 32
        k = P // 32
        np.testing.assert_allclose(fc[a + 64:a + k], fc[b + 64:b + k], rtol=1e-9)
        static = cutoff_curve({'hz': 500, 'accent': {'depth_oct': 2, 'decay_ms': 150}}, ctx, 32)
        self.assertGreater(static.max(), 500 * 2 ** 1.0)       # accented notes open the filter by > 1 octave
        self.assertAlmostEqual(float(static.min()), 500, delta=5)

    def test_filtered_render_is_periodic(self):
        s = loop_song()
        ctx, tempo, tl = ctx_for(s, ['bass'])
        L0, P = tempo.samples(tl.intro_beats), tempo.samples(tl.loop_beats)
        rng = np.random.default_rng(7)
        cyc = rng.standard_normal((P, 2)) * 0.1
        x = np.concatenate([rng.standard_normal((L0, 2)) * 0.1, cyc, cyc, np.zeros((ctx.n - L0 - 2 * P, 2))])
        y = part_fx(x, {'filter': {'type': 'lp', 'q': 6, 'auto': [['A', 1, 300], ['B', 3, 5000]],
                                   'accent': {'depth_oct': 2.5, 'decay_ms': 170}},
                        'drive': {'pre_db': 10}, 'pump': {'key': 'kit', 'notes': ['k'], 'depth_db': 6}}, ctx)
        T = 8000                 # after the filter / pump transients of the section change
        d = y[L0 + T:L0 + P] - y[L0 + P + T:L0 + 2 * P]
        self.assertLess(20 * np.log10(np.sqrt(np.mean(d ** 2)) / np.sqrt(np.mean(y[L0 + T:L0 + P] ** 2))), -150)
        self.assertLess(np.abs(d[-64:]).max(), 1e-9)            # including the last samples before the wrap


class FxDictTest(unittest.TestCase):
    def test_merge_and_validate(self):
        role = {'filter': {'type': 'lp', 'hz': 500, 'q': 5}, 'drive': {'pre_db': 6}}
        m = merge_fx(role, {'filter': {'auto': [['A', 1, 300]]}, 'drive': None, 'pump': {'key': 'beat'}})
        self.assertEqual(m['filter'], {'type': 'lp', 'hz': 500, 'q': 5, 'auto': [['A', 1, 300]]})
        self.assertNotIn('drive', m)
        self.assertEqual(role['drive'], {'pre_db': 6})             # the role's dict is not modified
        self.assertEqual(fx_key({}), '')
        self.assertEqual(fx_key({'b': 1, 'a': 2}), fx_key({'a': 2, 'b': 1}))
        self.assertFalse(needs_own_job({'filter': {'hz': 1}, 'pump': {'key': 'beat'}}))
        self.assertTrue(needs_own_job({'filter': {'hz': 1, 'accent': {'depth_oct': 1}}}))
        for bad in ({'reverb': {}}, {'drive': {'gain': 3}}, {'filter': {'type': 'notch', 'hz': 3}}, {'filter': {'q': 2}},
                    {'pump': {'depth_db': 3}}, {'filter': {'hz': 1, 'auto': [['A', 1]]}}):
            with self.assertRaises(FxError, msg=str(bad)):
                validate_fx(bad)
        with self.assertRaises(FxError):
            Song(id='x').part('p', 'chip_saw', fx={'drive': {'amount': 1}})


class PipelineFxTest(unittest.TestCase):
    """Render a tiny loop with all three effects through the real chain (FluidSynth + the CC0 chip font only)."""

    def test_render_with_fx_keeps_seams_and_stem_sum(self):
        from sakura_audio.pipeline import render_song
        from sakura_audio.mix import read_wav
        s = loop_song(fx_pad={'pump': {'key': 'kit', 'notes': ['k'], 'depth_db': 8, 'release_beats': 0.5},
                              'drive': {'pre_db': 9, 'mix': 0.5}},
                      fx_bass={'filter': {'type': 'lp', 'q': 6, 'auto': [['A', 1, 300], ['B', 3, 4000]],
                                          'accent': {'depth_oct': 2, 'decay_ms': 160}}})
        s.seam_beats = 4
        with tempfile.TemporaryDirectory() as td:
            res = render_song(s, load_palette('cleared'), build_root=Path(td), encode_formats=(), log=lambda *a: None)
            e = res['entry']
            self.assertTrue(e['ok'], e['checks'])
            self.assertLess(e['checks']['loopIdentity']['rmsDiffDb'], -60)
            labels = [j.label for j in res['jobs']]
            self.assertTrue(any('fx:drive+pump' in x for x in labels), labels)
            self.assertTrue(any('fx:filter' in x for x in labels), labels)
            _, base = read_wav(res['files']['base'])
            _, inten = read_wav(res['files']['intensity'])
            _, full = read_wav(res['mix_dir'] / 'full.wav')
            self.assertLess(np.abs(base + inten - full).max(), 1e-6)


if __name__ == '__main__':
    unittest.main()
