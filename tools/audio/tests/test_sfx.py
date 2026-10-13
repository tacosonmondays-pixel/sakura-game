"""SFX recipes (docs/AUDIO.md §2.11, §5): every design id has a recipe with sane runtime parameters, and the
spammy battle sounds render short, deterministic and clean (band-limited, no DC, peak-normalised). Recipes that
play a palette phrase (`r.sampled`) need FluidSynth and a soundfont, so only the pure-numpy ones render here."""
import unittest

import numpy as np

import _path  # noqa: F401
from sakura_audio.sfx.recipes import REGISTRY
from sakura_audio.sfx.sprite import render_one, high_pass_for
from sakura_audio.sfx.synth import RATE

DESIGN_IDS = """
ui.click ui.select ui.confirm ui.back ui.tab ui.toggle ui.tick ui.deny ui.toast ui.modalOpen ui.modalClose ui.start ui.slot ui.chirp
eco.coins eco.gems eco.item eco.claim eco.purchase eco.sweep eco.breakthrough gear.equip gear.enhance gear.reroll
bt.pick bt.place bt.placeHero bt.deny bt.upgrade bt.upgradeBig bt.upgradeMax bt.sell
fire.arrow fire.bullet fire.shell fire.shuriken fire.magic fire.holy fire.zap atk.slash atk.pulse atk.beam atk.chain
trap.set trap.trigger turret.build
hit.pierce hit.slash hit.mystic hit.holy hit.crit hit.resist boom.small boom.big boom.volatile break.barrier break.crystal
st.freeze st.burn st.poison st.shock st.debuff en.death en.deathBig en.bossDeath en.split en.blinkWarn en.blink en.phase
en.sabotage en.bossPhase en.new bt.leak bt.leakBig bt.lowLives bt.waveClear hero.level hero.ult
gacha.envelope gacha.open gacha.flipR gacha.flipSR gacha.flipSSR gacha.results
""".split()

# everything a full board repeats many times a second (boom.volatile is one enemy's warning: rare, priority 2)
SPAMMY = [i for i in sorted(REGISTRY)
          if (i.split('.')[0] in ('fire', 'atk', 'hit', 'st', 'boom') or i in ('en.death', 'en.deathBig')) and i != 'boom.volatile']


class RegistryTest(unittest.TestCase):
    def test_every_design_id_has_a_recipe(self):
        self.assertEqual(sorted(set(DESIGN_IDS) - set(REGISTRY)), [])
        self.assertEqual(len(DESIGN_IDS), 84)

    def test_runtime_parameters(self):
        for sid, s in REGISTRY.items():
            with self.subTest(sid):
                self.assertIn(s['bus'], ('ui', 'battle'))
                self.assertGreaterEqual(s['voices'], 1)
                self.assertGreaterEqual(s['gap_ms'], 0)
                self.assertIn(s['priority'], (0, 1, 2, 3))
                self.assertIsNotNone(s['level'])
                self.assertTrue(-40 <= s['level'] <= -18, s['level'])
                self.assertTrue(0 <= s['jitter'] <= 0.1)
        # spammy sounds are quiet, low priority and rate-limited; the big moments are loud and never stolen
        for sid in SPAMMY:
            self.assertLessEqual(REGISTRY[sid]['level'], -28, sid)
            self.assertLessEqual(REGISTRY[sid]['priority'], 1, sid)
            self.assertGreaterEqual(REGISTRY[sid]['gap_ms'], 40, sid)
            self.assertEqual(high_pass_for(REGISTRY[sid]), 100.0, sid)
        for sid in ('en.bossPhase', 'en.bossDeath', 'gacha.flipSSR', 'hero.ult', 'ui.start', 'bt.leak', 'bt.waveClear'):
            self.assertEqual(REGISTRY[sid]['priority'], 3, sid)


class SpammyRenderTest(unittest.TestCase):
    def test_short_clean_deterministic(self):
        for sid in SPAMMY:
            with self.subTest(sid):
                x = render_one(sid, None)
                self.assertTrue(np.isfinite(x).all())
                self.assertTrue(np.array_equal(x, render_one(sid, None)), 'deterministic')
                self.assertLessEqual(len(x) / RATE, 0.75)
                # normalised to −3 dBFS before the 2 ms edge fades, which may soften a transient in the first 2 ms
                pk = float(np.abs(x).max())
                self.assertLessEqual(pk, 10 ** (-3 / 20) + 1e-9)
                self.assertGreater(pk, 10 ** (-10 / 20))
                self.assertLess(abs(float(x.mean())), 0.003)
                X = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2
                f = np.fft.rfftfreq(len(x), 1 / RATE)
                hf = 10 * np.log10(X[f > 9000].sum() / X.sum() + 1e-15)
                self.assertLess(hf, -18, f'{sid}: energy above 9 kHz {hf:.1f} dB')
                self.assertLess(abs(x[0]) + abs(x[-1]), 0.01, 'soft edges')


if __name__ == '__main__':
    unittest.main()
