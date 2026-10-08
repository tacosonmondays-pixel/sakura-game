"""One recipe per SFX id (docs/AUDIO.md §5). Deltarune / EarthBound / NES flavoured: short, clean, cute, never
harsh. Deterministic (every recipe gets its own seeded RNG through `r`).

    @sfx('ui.confirm', level=-29, voices=2, gap_ms=40, priority=2)
    def ui_confirm(r):
        return echo(seq([(0, blip('c6', .045)), (.042, chime('g6', .13))]), 80, .2, .18, tail=.08)

House rules (what "clean" means here):
- Phone speakers first: the body of every sound sits between ~200 Hz and 6 kHz. Thumps carry their 2nd harmonic
  so a phone can play them and never glide below ~100 Hz; the sprite builder high-passes everything (100 Hz for
  spammy battle sounds, 40 Hz for the rest) and low-passes at 12 kHz.
- No raw hiss: noise is always band-limited (`filtered_noise`, `swish`, `puff`), chip pulses are band-limited
  (polyBLEP) and then low-passed, FM bells are rendered 4× oversampled (`fmx`) so no sideband folds back.
- Soft edges: 1-3 ms attacks, raised-cosine fades, exponential decays. Clicks only where a click is the point.
- Pitch: UI and rewards live on C / F / G / E major notes so they sit on top of most of the soundtrack.
- Spammy battle sounds (fire.*, atk.*, hit.*, en.death) are tiny, mid-focused and quiet; the runtime adds jitter,
  per-sound voice caps and retrigger gaps (`voices`, `gap_ms`; the gaps stretch by √speed at 2× / 3×, §3.8).

Loudness: `level` is the target event loudness in LUFS (momentary max over 400 ms, compensated to the sound's
own length below 400 ms). The sprite builder measures each peak-normalised render and stores the runtime trim
`gain_db = level − measured` in sprite.json. Rough ladder: UI ticks −31, spammy hits −33, rewards −27,
player actions −27, flow −24, big moments −21 … −20 (the music sits at −16 LUFS before the volume sliders).
Priorities: 0 spammy (fire / hit) … 3 critical (leaks, boss, wave flow).
"""
from __future__ import annotations

import numpy as np

from .synth import (RATE, n_of, hz, pulse, tri, saw, sine, noise, env_exp, env_nes, shape, vibrato, pluck, bandpass,
                    lowpass, sweep_filter, crush, echo, seq, fmx, softclip, fade, tremolo, glide, env_rc,
                    filtered_noise, formant_morph)

REGISTRY: dict = {}


def sfx(sid, bus='ui', level=None, gain_db=-10.0, voices=2, gap_ms=40, jitter=0.0, priority=1, hp=None):
    """Register a recipe. `level` (LUFS) sets the runtime gain from a measurement; `gain_db` is only the
    fallback when no level is given. `hp` overrides the builder's high-pass (Hz)."""
    def deco(fn):
        REGISTRY[sid] = {'fn': fn, 'bus': bus, 'level': level, 'gain_db': gain_db, 'voices': voices, 'gap_ms': gap_ms,
                         'jitter': jitter, 'priority': priority, 'hp': hp}
        return fn
    return deco


# =========================================================================================== building blocks
def _f(note):
    if isinstance(note, np.ndarray) or callable(note):
        return note
    return hz(note) if isinstance(note, str) else float(note)


def blip(note, dur, duty=0.25, tau=None, amp=0.5, lp=6500, attack=0.0015):
    """NES pulse blip (band-limited, then low-passed so it chirps instead of fizzing; a 3 ms release so it never
    stops on a step)."""
    x = fade(shape(pulse(_f(note), dur, duty, amp), env_exp(dur, tau or dur * 0.45, attack)), 0, min(0.003, dur * 0.25))
    return lowpass(x, lp, 4) if lp else x


def tblip(note, dur, tau=None, amp=0.6):
    """NES triangle blip: the soft, round chip voice."""
    return fade(shape(tri(_f(note), dur, amp), env_exp(dur, tau or dur * 0.4, 0.0015)), 0, min(0.003, dur * 0.25))


def chime(note, dur=0.3, amp=0.4, index=1.0, ratio=2.0, decay=None):
    """Sweet FM bell (harmonic ratio), alias-free, with its top partials rounded off above 9 kHz."""
    y = fmx(_f(note), dur, ratio, index, decay or dur * 0.4, amp, index_decay=min(0.05, dur * 0.2))
    return lowpass(y, 9000, 4)


def clink(note, dur=0.14, amp=0.4):
    """Coin / metal clink: an inharmonic FM strike plus a soft fifth partial."""
    f = _f(note)
    y = seq([(0, fmx(f, dur, 2.76, 1.1, dur * 0.33, amp, index_decay=0.016)), (0, fmx(f * 1.5, dur * 0.7, 2.0, 0.5, dur * 0.22, amp * 0.3))])
    return lowpass(y, 8000, 4)


def tok(f, dur=0.05, amp=0.6):
    """Woody knock: a sine that drops into pitch plus a quick wood partial."""
    fr = glide(f * 1.25, f, dur, 0.006)
    body = sine(fr, dur, amp) + shape(sine(fr * 2.71, dur, amp * 0.3), env_exp(dur, 0.006, 0.0005))
    return shape(body, env_exp(dur, dur * 0.3, 0.0008))


def plonk(note='g4', dur=0.26, amp=0.7):
    """The placement 'plonk': a marimba-ish bar that lands a little sharp and settles, plus a chip triangle."""
    f = _f(note)
    fr = glide(f * 1.45, f, dur, 0.014)
    body = shape(sine(fr, dur, amp), env_exp(dur, 0.075, 0.001))
    p4 = shape(sine(fr * 3.98, dur, amp * 0.26), env_exp(dur, 0.016, 0.001))
    chip = shape(tri(fr, dur, amp * 0.3), env_exp(dur, 0.05, 0.001))
    return body + p4 + chip


def thump(f0=200, f1=110, dur=0.12, amp=0.8):
    """Low hit that phones can still play: a fundamental glide (never below ~100 Hz) + its 2nd harmonic."""
    fr = glide(f0, f1, dur, dur * 0.25)
    return shape(sine(fr, dur, amp) + sine(fr * 2, dur, amp * 0.35), env_exp(dur, dur * 0.3, 0.001))


def puff(dur, r, top=3200, bottom=400, amp=0.5, q=0.7):
    """Soft dust / smoke puff: noise through a closing low-pass."""
    x = filtered_noise(dur, r.rng, 120, 7000, amp)
    return shape(sweep_filter(x, top, bottom, 'lowpass', q), env_exp(dur, dur * 0.28, 0.003))


def swish(dur, f0, f1, r, amp=0.5, q=1.4):
    """Air swish: band-passed noise sweeping f0 → f1 with a smooth swell in and out (no hiss above ~6 kHz)."""
    x = filtered_noise(dur, r.rng, hi=7000, amp=amp)
    y = lowpass(sweep_filter(x, f0, f1, 'bandpass', q), 6000, 4)
    return y * np.sin(np.linspace(0, np.pi, len(y))) ** 1.5


def paper(r, dur=0.045, amp=0.5):
    """Paper / card flick: two quick band-passed grains."""
    g = lambda d, a: shape(filtered_noise(d, r.rng, 1400, 4800, a), env_exp(d, d * 0.3, 0.001))   # noqa: E731
    return seq([(0, g(dur * 0.5, amp)), (dur * 0.35, g(dur * 0.65, amp * 0.8))])


def twinkle(r, notes, step=0.035, amp=0.22, dur=0.16):
    return seq([(i * step, chime(n, dur, amp * (1 - 0.1 * i), 0.9, 2.0)) for i, n in enumerate(notes)])


def crackle(dur, r, density=50, amp=0.4, lo=1200, hi=5000):
    """Sparse soft grains (fire, ice, electricity) — never a wall of hiss."""
    out = np.zeros(n_of(dur) + n_of(0.01))
    for t in np.sort(r.rng.uniform(0, dur * 0.92, int(dur * density))):
        d = r.rng.uniform(0.002, 0.005)
        g = shape(filtered_noise(d, r.rng, lo, hi, amp * r.rng.uniform(0.35, 1.0)), env_exp(d, d * 0.35, 0.0004))
        i = n_of(t)
        out[i:i + len(g)] += g
    return out


def sweep_up(f0, oct_per_s):
    """Frequency as a function of time (for fmx): f0 rising `oct_per_s` octaves per second."""
    return lambda t: f0 * 2.0 ** (t * oct_per_s)


def chord_bloom(notes, dur, amp=0.12, trem=7.0):
    """A held, shimmering chord of soft bells (tremolo phases spread so it glitters instead of pumping)."""
    out = None
    for i, n in enumerate(notes):
        x = tremolo(chime(n, dur, amp, 0.7, 2.0, dur * 0.45), trem + i * 0.7, 0.35, i * 1.3)
        out = x if out is None else out + x
    return out


# =========================================================================================== UI (bus ui)
@sfx('ui.click', level=-31, voices=3, gap_ms=25, priority=1)
def ui_click(r):
    """Cursor tick: a tiny pulse chirp on a triangle body."""
    return seq([(0, blip('e6', 0.028, 0.25, 0.008, 0.45, lp=5000)), (0, tblip('e5', 0.03, 0.01, 0.4))])


@sfx('ui.select', level=-30, voices=2, gap_ms=30, priority=1)
def ui_select(r):
    return seq([(0, blip('c6', 0.036, 0.125, 0.012, 0.4, lp=5000)), (0, tblip('c5', 0.03, 0.01, 0.3)),
                (0.034, blip('g6', 0.06, 0.25, 0.02, 0.4, lp=5500))])


@sfx('ui.confirm', level=-29, voices=2, gap_ms=40, priority=2)
def ui_confirm(r):
    """The 'ding': chip pickup into a bell, a breath of SNES echo."""
    dry = seq([(0, blip('c6', 0.045, 0.25, 0.018, 0.4)), (0.042, blip('g6', 0.08, 0.25, 0.03, 0.3)),
               (0.042, chime('g6', 0.13, 0.35, 0.8))])
    return fade(echo(dry, 80, 0.2, 0.18, tail=0.08), fout=0.05)        # ≈ 0.26 s: a chirp, not a chime


@sfx('ui.back', level=-31, voices=2, gap_ms=40, priority=2)
def ui_back(r):
    a = seq([(0, blip('g5', 0.045, 0.5, 0.018, 0.3, lp=4500)), (0, tblip('g5', 0.045, 0.02, 0.4))])
    b = seq([(0, blip('c5', 0.07, 0.5, 0.025, 0.3, lp=4000)), (0, tblip('c5', 0.07, 0.03, 0.45))])
    return seq([(0, a), (0.042, b)])


@sfx('ui.tab', level=-31, voices=2, gap_ms=30, priority=1)
def ui_tab(r):
    return seq([(0, shape(tri(glide(820, 880, 0.045, 0.006), 0.045, 0.6), env_exp(0.045, 0.016, 0.001))),
                (0, blip(1760, 0.02, 0.125, 0.006, 0.15, lp=5000))])


@sfx('ui.toggle', level=-31, voices=2, gap_ms=40, priority=1)
def ui_toggle(r):
    """Switch click + blip (the engine plays it at rate 1.12 for on, 0.89 for off)."""
    return seq([(0, tok(1500, 0.022, 0.4)), (0.008, blip(glide(1560, 1180, 0.05, 0.012), 0.05, 0.5, 0.02, 0.35, lp=4500))])


@sfx('ui.tick', level=-36, voices=1, gap_ms=60, priority=0)
def ui_tick(r):
    return seq([(0, shape(sine(2350, 0.012, 0.5), env_exp(0.012, 0.003, 0.0005))), (0, tok(1200, 0.012, 0.3))])


@sfx('ui.deny', level=-30, voices=1, gap_ms=150, priority=2)
def ui_deny(r):
    """Soft error buzz: a low pulse pair a semitone apart (it wobbles 'nuh-uh'), rounded off by a low-pass."""
    f = glide(196, 185, 0.14, 0.04)
    x = pulse(f, 0.14, 0.5, 0.35) + pulse(f * 1.0595, 0.14, 0.25, 0.25)
    x = lowpass(shape(x, env_nes(0.14, 8)), 1800)
    return softclip(fade(x, 0.003, 0.03), 1.3)


@sfx('ui.toast', level=-31, voices=1, gap_ms=200, priority=1)
def ui_toast(r):
    pop = shape(tri(glide(700, 1046.5, 0.07, 0.015), 0.07, 0.6), env_exp(0.07, 0.03, 0.002))
    return seq([(0, pop), (0.03, chime('e7', 0.09, 0.12, 0.6))])


@sfx('ui.modalOpen', level=-31, voices=1, gap_ms=80, priority=1)
def ui_modal_open(r):
    return seq([(0, swish(0.16, 500, 2600, r, 0.45, 1.2)), (0.1, blip('g6', 0.04, 0.25, 0.015, 0.2)),
                (0.11, chime('c7', 0.14, 0.22, 0.7))])


@sfx('ui.modalClose', level=-32, voices=1, gap_ms=80, priority=1)
def ui_modal_close(r):
    return seq([(0, swish(0.12, 2600, 500, r, 0.45, 1.2)), (0.06, tblip('c5', 0.06, 0.025, 0.3))])


@sfx('ui.start', level=-21, voices=1, gap_ms=500, priority=3)
def ui_start(r):
    """TAP TO START: a sparkle, then the Sakura Bell question on the music box at double speed, a soft bloom."""
    box = r.sampled('music_box', 'c6/8 f6/8 d6/4 e6/4. r/8', bpm=240, tail=0.8)
    spark = twinkle(r, ('c7', 'g7', 'e7', 'c8'), 0.03, 0.25, 0.14)
    bloom = chord_bloom(('f5', 'a5', 'c6', 'e6'), 0.8, 0.07, 6.0)
    return fade(seq([(0, spark), (0.05, box * 1.4), (0.5, bloom)]), fout=0.25)


@sfx('ui.slot', level=-30, voices=2, gap_ms=40, priority=1)
def ui_slot(r):
    """Wooden snap into a slot: tik-tok."""
    return seq([(0, tok(1300, 0.03, 0.5)), (0.028, tok(880, 0.06, 0.6)), (0.028, paper(r, 0.02, 0.15))])


@sfx('ui.chirp', level=-28, voices=1, gap_ms=300, priority=1)
def ui_chirp(r):
    """Secretary tap: a cute two-note 'pyu-i!' (soft FM with a little vibrato)."""
    a = fmx(sweep_up(1100, 7.0), 0.06, 1.0, 0.8, 0.05, 0.5)
    b = fmx(lambda t: 1320 * 2 ** (t * 6.0) * 2 ** (0.02 * np.sin(2 * np.pi * 18 * t)), 0.08, 1.0, 0.8, 0.06, 0.5)
    return seq([(0, fade(a, 0.004, 0.01)), (0.072, fade(b, 0.004, 0.02))])


# =========================================================================================== economy (bus ui)
@sfx('eco.coins', level=-28, voices=2, gap_ms=60, priority=1)
def eco_coins(r):
    """Sparkly coins: three clinks climbing E6 B6 E7 with a twinkle on top."""
    hits = [(i * 0.055, seq([(0, blip(n, 0.05, 0.25, 0.015, 0.22)), (0, clink(n, 0.16, 0.4))])) for i, n in enumerate(('e6', 'b6', 'e7'))]
    dry = seq(hits + [(0.16, twinkle(r, ('b7', 'e8'), 0.03, 0.13, 0.12))])
    return fade(echo(dry, 80, 0.25, 0.18, tail=0.2), fout=0.08)


@sfx('eco.gems', level=-27, voices=1, gap_ms=120, priority=1)
def eco_gems(r):
    """Crystal shimmer: glassy bells E7 G#7 B7 E8 with a glittering tremolo and a low anchor bell."""
    bells = seq([(i * 0.04, tremolo(chime(n, 0.42, 0.26, 1.0, 2.0), 13 + i, 0.4, i)) for i, n in enumerate(('e7', 'g#7', 'b7', 'e8'))])
    return fade(echo(seq([(0, chime('e6', 0.3, 0.28, 0.6)), (0, bells)]), 96, 0.28, 0.2, tail=0.25), fout=0.1)


@sfx('eco.item', level=-26, voices=1, gap_ms=150, priority=2)
def eco_item(r):
    """'Item get!': G5 C6 E6 then a held G6, chip lead doubled by bells an octave up."""
    notes = (('g5', 0.0, 0.07), ('c6', 0.065, 0.07), ('e6', 0.13, 0.07), ('g6', 0.195, 0.3))
    lead = seq([(t, blip(n, d, 0.25, d * 0.6, 0.35)) for n, t, d in notes])
    bells = seq([(t, chime(hz(n) * 2, d + 0.08, 0.18, 0.8)) for n, t, d in notes])
    return fade(echo(seq([(0, lead), (0, bells)]), 112, 0.28, 0.22, tail=0.25), fout=0.1)


@sfx('eco.claim', level=-28, voices=1, gap_ms=150, priority=2)
def eco_claim(r):
    """Hanko stamp + sparkle."""
    slap = shape(filtered_noise(0.03, r.rng, 500, 2600, 0.5), env_exp(0.03, 0.008, 0.001))
    return seq([(0, thump(240, 130, 0.09, 0.8)), (0, slap), (0.06, twinkle(r, ('g7', 'b7', 'd8'), 0.04, 0.2, 0.15))])


@sfx('eco.purchase', level=-27, voices=1, gap_ms=150, priority=2)
def eco_purchase(r):
    """Chip 'ka-ching': a wooden 'ka', then two clinks and a shimmering bell."""
    ka = seq([(0, tok(1800, 0.025, 0.5)), (0, paper(r, 0.025, 0.2))])
    ching = seq([(0, clink('b6', 0.2, 0.35)), (0.012, clink('e7', 0.24, 0.35)), (0.012, tremolo(chime('e7', 0.32, 0.25, 0.8), 16, 0.4))])
    return fade(echo(seq([(0, ka), (0.05, ching)]), 88, 0.25, 0.18, tail=0.2), fout=0.08)


@sfx('eco.sweep', level=-28, voices=1, gap_ms=300, priority=1)
def eco_sweep(r):
    w = [(i * 0.09, swish(0.085, 600, 3600, r, 0.45, 1.5)) for i in range(3)]
    return seq(w + [(0.3, eco_coins(r) * 0.8)])


@sfx('eco.breakthrough', level=-24, voices=1, gap_ms=500, priority=2)
def eco_breakthrough(r):
    """Rising chip arpeggio into a major-9 bloom."""
    run = seq([(i * 0.035, blip(n, 0.07, 0.25, 0.03, 0.32)) for i, n in enumerate(('c5', 'e5', 'g5', 'c6', 'e6', 'g6', 'c7'))])
    bloom = chord_bloom(('c6', 'e6', 'g6', 'b6', 'd7'), 0.75, 0.12, 7.5)
    dry = seq([(0, run), (0.24, thump(260, 130, 0.12, 0.5)), (0.25, bloom), (0.3, twinkle(r, ('g7', 'c8', 'e8'), 0.04, 0.15, 0.14))])
    return fade(echo(dry, 128, 0.3, 0.22, tail=0.3), fout=0.2)


@sfx('gear.equip', level=-29, voices=2, gap_ms=60, priority=1)
def gear_equip(r):
    """Buckle click (the engine plays unequip at rate 0.85)."""
    return seq([(0, tok(2200, 0.018, 0.5)), (0.006, clink(1250, 0.09, 0.3)), (0.03, tok(1500, 0.02, 0.3))])


@sfx('gear.enhance', level=-27, voices=1, gap_ms=100, priority=2)
def gear_enhance(r):
    """Anvil 'ting' (rate rises with the enhancement level) + sparkle."""
    ting = lowpass(fmx(1760, 0.38, 1.41, 1.6, 0.13, 0.45, index_decay=0.03), 8000, 4)
    dry = seq([(0, tok(600, 0.04, 0.5)), (0.004, ting), (0.06, twinkle(r, ('e7', 'a7', 'c#8'), 0.035, 0.16, 0.14))])
    return fade(echo(dry, 96, 0.28, 0.18, tail=0.2), fout=0.08)


@sfx('gear.reroll', level=-28, voices=1, gap_ms=200, priority=1)
def gear_reroll(r):
    """Dice rattle in a cup, then the result chime."""
    rattle = [(t, tok(r.rng.uniform(700, 1500), 0.025, r.rng.uniform(0.25, 0.45))) for t in np.sort(r.rng.uniform(0, 0.28, 10))]
    return seq(rattle + [(0.32, chime('g6', 0.22, 0.3, 0.8)), (0.32, chime('d7', 0.22, 0.2, 0.8))])


# =========================================================================================== battle: player actions
@sfx('bt.pick', bus='battle', level=-31, voices=2, gap_ms=40, priority=2)
def bt_pick(r):
    """Card lift from the tower bar."""
    return seq([(0, blip('e6', 0.032, 0.25, 0.012, 0.35, lp=5000)), (0, tblip('e5', 0.03, 0.012, 0.3)), (0, paper(r, 0.035, 0.22))])


@sfx('bt.place', bus='battle', level=-26, voices=2, gap_ms=60, priority=2)
def bt_place(r):
    """The satisfying 'plonk': a bar that lands sharp and settles, a soft landing thud, a dust puff, a glint."""
    return seq([(0, plonk('g4', 0.26, 0.7)), (0, thump(200, 110, 0.1, 0.45)), (0.008, puff(0.17, r, 2600, 400, 0.22)),
                (0.05, chime('g6', 0.12, 0.1, 0.6))])


@sfx('bt.placeHero', bus='battle', level=-24, voices=1, gap_ms=500, priority=3)
def bt_place_hero(r):
    """Hero arrives: plonk + a little brass flourish + sparkle."""
    stab = lowpass(r.sampled('brass_stab', '[c5 e5 g5]/8 [d5 f#5 a5]/8 [e5 g#5 b5]/4 r/2', bpm=150, tail=0.5), 7000, 4)
    dry = seq([(0, plonk('c5', 0.26, 0.6)), (0, thump(200, 110, 0.1, 0.45)), (0.008, puff(0.22, r, 2600, 400, 0.22)),
               (0.05, stab * 1.1), (0.32, twinkle(r, ('e7', 'g#7', 'b7', 'e8'), 0.035, 0.18, 0.15))])
    return fade(dry, fout=0.2)


@sfx('bt.deny', bus='battle', level=-28, voices=1, gap_ms=200, priority=2)
def bt_deny(r):
    """'Bonk': a triangle that drops like a head-bump, a little buzz under it."""
    b = shape(tri(glide(392, 165, 0.13, 0.03), 0.13, 0.7), env_exp(0.13, 0.055, 0.001))
    z = lowpass(shape(pulse(147, 0.12, 0.5, 0.18), env_nes(0.12, 8)), 1400)
    return seq([(0, tok(520, 0.03, 0.4)), (0, b), (0, z)])


@sfx('bt.upgrade', bus='battle', level=-27, voices=2, gap_ms=80, priority=2)
def bt_upgrade(r):
    run = seq([(i * 0.05, blip(n, 0.08, 0.25, 0.035, 0.35)) for i, n in enumerate(('e5', 'g#5', 'b5'))])
    return fade(echo(seq([(0, run), (0.15, chime('e6', 0.18, 0.3, 0.8))]), 96, 0.25, 0.18, tail=0.15), fout=0.06)


@sfx('bt.upgradeBig', bus='battle', level=-25, voices=1, gap_ms=150, priority=2)
def bt_upgrade_big(r):
    run = seq([(i * 0.045, blip(n, 0.075, 0.25, 0.035, 0.35)) for i, n in enumerate(('c5', 'e5', 'g5', 'c6', 'e6'))])
    dry = seq([(0, thump(230, 120, 0.13, 0.5)), (0, run), (0.2, chord_bloom(('c6', 'e6', 'g6'), 0.4, 0.13, 8)),
               (0.22, twinkle(r, ('c7', 'e7', 'g7', 'c8'), 0.03, 0.18, 0.14))])
    return fade(echo(dry, 112, 0.28, 0.2, tail=0.22), fout=0.1)


@sfx('bt.upgradeMax', bus='battle', level=-22, voices=1, gap_ms=500, priority=3)
def bt_upgrade_max(r):
    """Mini-fanfare: the Sakura Bell question + answer on brass with a chip lead."""
    brass = lowpass(r.sampled('trumpet', 'c5/16 f5/16 d5/8 e5/8. f5/16 f5/2 | r/1', bpm=132, tail=0.5), 7000, 4)
    lead = seq([(t, blip(n, d, 0.25, d * 0.7, 0.22)) for t, n, d in
                ((0, 'c6', 0.11), (0.114, 'f6', 0.11), (0.227, 'd6', 0.22), (0.455, 'e6', 0.34), (0.796, 'f6', 0.4))])
    return fade(seq([(0, brass * 1.3), (0, lead), (0.8, twinkle(r, ('a7', 'c8', 'f8'), 0.035, 0.16, 0.15))]), fout=0.25)


@sfx('bt.sell', bus='battle', level=-27, voices=1, gap_ms=100, priority=2)
def bt_sell(r):
    """Coins tumble down + a poof."""
    coins = seq([(i * 0.045, clink(n, 0.12, 0.35)) for i, n in enumerate(('e7', 'b6', 'g#6', 'e6'))])
    return seq([(0, coins), (0.17, puff(0.18, r, 2400, 400, 0.3))])


# =========================================================================================== battle: attacks (spammy)
@sfx('fire.arrow', bus='battle', level=-33, voices=3, gap_ms=45, jitter=0.06, priority=0)
def fire_arrow(r):
    """Bow twang + a little air 'fwip'."""
    tw = lowpass(pluck(392, 0.07, r.rng, 0.95, 0.5, 0.55), 3500)
    return seq([(0, fade(tw, 0, 0.02)), (0.004, swish(0.06, 1200, 3800, r, 0.3, 2.0))])


@sfx('fire.bullet', bus='battle', level=-33, voices=3, gap_ms=45, jitter=0.05, priority=0)
def fire_bullet(r):
    """Chip 'pew'."""
    pew = blip(glide(1500, 420, 0.07, 0.025), 0.07, 0.25, 0.028, 0.4, lp=4500)
    return seq([(0, tok(2000, 0.008, 0.25)), (0, pew)])


@sfx('fire.shell', bus='battle', level=-32, voices=2, gap_ms=70, jitter=0.05, priority=0)
def fire_shell(r):
    """Mortar 'thoomp' (fireballs share it)."""
    return seq([(0, thump(270, 150, 0.13, 0.8)), (0, puff(0.12, r, 1600, 400, 0.4))])


@sfx('fire.shuriken', bus='battle', level=-33, voices=3, gap_ms=45, jitter=0.06, priority=0)
def fire_shuriken(r):
    """Whoosh + a small metallic 'shing'."""
    shing = lowpass(fmx(2637, 0.1, 1.41, 0.8, 0.04, 0.22), 7000, 4)
    return seq([(0, swish(0.08, 1500, 4200, r, 0.4, 1.6)), (0.015, shing)])


@sfx('fire.magic', bus='battle', level=-33, voices=3, gap_ms=50, jitter=0.05, priority=0)
def fire_magic(r):
    """Bubbly 'bloop' with a sparkle tail (orbs, flasks)."""
    bloop = fade(fmx(sweep_up(420, 12.0), 0.11, 1.0, 1.5, 0.05, 0.5), 0.003, 0.02)
    return seq([(0, bloop), (0.05, chime('e7', 0.09, 0.12, 0.7))])


@sfx('fire.holy', bus='battle', level=-33, voices=3, gap_ms=50, jitter=0.03, priority=0)
def fire_holy(r):
    """Bright bell ping."""
    return seq([(0, chime('b6', 0.15, 0.45, 1.0)), (0, chime('b7', 0.08, 0.1, 0.5))])


@sfx('fire.zap', bus='battle', level=-34, voices=3, gap_ms=45, jitter=0.05, priority=0)
def fire_zap(r):
    """Short zap: a 12.5 % pulse diving, with a fizz of band-passed crackle."""
    z = blip(glide(2200, 700, 0.07, 0.02), 0.07, 0.125, 0.025, 0.4, lp=4500)
    fizz = tremolo(shape(filtered_noise(0.05, r.rng, 1500, 4500, 0.25), env_exp(0.05, 0.015, 0.001)), 60, 0.8)
    return seq([(0, z), (0, fizz)])


@sfx('atk.slash', bus='battle', level=-33, voices=2, gap_ms=60, jitter=0.04, priority=0)
def atk_slash(r):
    """Sword swish (the engine raises the rate as a duelist ramps up)."""
    return seq([(0, swish(0.12, 700, 3200, r, 0.6, 1.8)), (0.04, fmx(2093, 0.06, 1.41, 0.6, 0.02, 0.08))])


@sfx('atk.pulse', bus='battle', level=-33, voices=2, gap_ms=200, jitter=0.02, priority=0)
def atk_pulse(r):
    """'Whum' ring: two beating sines and a fifth, swelling in (short tail: pulse towers fire all wave long)."""
    x = sine(220, 0.26, 0.5) + sine(223.5, 0.26, 0.4) + sine(330, 0.26, 0.15) + sine(440, 0.26, 0.1)
    x = lowpass(x * env_rc(0.26, 0.02, 0.01) * env_exp(0.26, 0.08, 0.0), 2000)
    return fade(echo(x, 80, 0.2, 0.18, tail=0.08), fout=0.05)


@sfx('atk.beam', bus='battle', level=-33, voices=2, gap_ms=90, priority=0)
def atk_beam(r):
    """Laser hum zip: a vibrato saw opening up, softened by a sine an octave up."""
    x = saw(vibrato(330, 0.22, 18, 40), 0.22, 0.35) + sine(vibrato(660, 0.22, 18, 40), 0.22, 0.2)
    return shape(sweep_filter(x, 900, 3200, 'lowpass', 1.2), env_rc(0.22, 0.008, 0.08))


@sfx('atk.chain', bus='battle', level=-33, voices=2, gap_ms=90, priority=0)
def atk_chain(r):
    """Chain lightning: three tiny crackles with pulse ticks."""
    parts = []
    for i, t in enumerate((0, 0.022, 0.046)):
        c = shape(filtered_noise(0.014, r.rng, 1200, 4000, 0.45), env_exp(0.014, 0.005, 0.0005))
        parts += [(t, c), (t, blip(1500 + 250 * i, 0.016, 0.25, 0.006, 0.3, lp=5000))]
    return seq(parts)


@sfx('trap.set', bus='battle', level=-30, voices=2, gap_ms=100, priority=1)
def trap_set(r):
    """Rune click + a soft chime."""
    return seq([(0, tok(1200, 0.025, 0.45)), (0.01, chime('e6', 0.14, 0.3, 0.6))])


@sfx('trap.trigger', bus='battle', level=-30, voices=2, gap_ms=80, priority=1)
def trap_trigger(r):
    """Snap + small boom."""
    return seq([(0, tok(1800, 0.02, 0.5)), (0, paper(r, 0.02, 0.3)), (0.01, puff(0.22, r, 2200, 400, 0.5)),
                (0.01, thump(250, 150, 0.12, 0.6))])


@sfx('turret.build', bus='battle', level=-30, voices=1, gap_ms=200, priority=1)
def turret_build(r):
    """Wrench clank ×2."""
    k = lambda f, d: lowpass(fmx(f, d, 1.41, 1.6, d * 0.35, 0.4), 7000, 4)   # noqa: E731
    return seq([(0, tok(900, 0.02, 0.3)), (0, k(980, 0.08)), (0.09, k(1240, 0.1))])


# =========================================================================================== battle: impacts, status, enemies
@sfx('hit.pierce', bus='battle', level=-34, voices=3, gap_ms=40, jitter=0.08, priority=0)
def hit_pierce(r):
    """'Thock'."""
    return seq([(0, tok(900, 0.035, 0.5)), (0, shape(filtered_noise(0.012, r.rng, 800, 3000, 0.35), env_exp(0.012, 0.004, 0.0005)))])


@sfx('hit.slash', bus='battle', level=-34, voices=3, gap_ms=40, jitter=0.08, priority=0)
def hit_slash(r):
    """Cut 'tsk'."""
    return seq([(0, shape(filtered_noise(0.03, r.rng, 1800, 4500, 0.5), env_exp(0.03, 0.008, 0.001))), (0, tok(2400, 0.015, 0.25))])


@sfx('hit.mystic', bus='battle', level=-34, voices=3, gap_ms=40, jitter=0.06, priority=0)
def hit_mystic(r):
    """Soft 'bwip'."""
    return fade(fmx(sweep_up(600, 14.0), 0.06, 1.0, 1.2, 0.03, 0.5), 0.002, 0.01)


@sfx('hit.holy', bus='battle', level=-34, voices=3, gap_ms=40, jitter=0.04, priority=0)
def hit_holy(r):
    """'Ting'."""
    return chime('d7', 0.08, 0.45, 0.7)


@sfx('hit.crit', bus='battle', level=-30, voices=2, gap_ms=100, jitter=0.03, priority=1)
def hit_crit(r):
    """'Kirin!': a rising chip zip into a high bell."""
    zip_ = blip(glide(1500, 3500, 0.035, 0.012), 0.035, 0.25, 0.02, 0.3, lp=6000)
    return seq([(0, tok(1400, 0.02, 0.4)), (0, zip_), (0.02, chime('a7', 0.11, 0.3, 0.8))])


@sfx('hit.resist', bus='battle', level=-35, voices=2, gap_ms=60, jitter=0.05, priority=0)
def hit_resist(r):
    """Dull 'tunk'."""
    return seq([(0, lowpass(shape(tri(240, 0.06, 0.7), env_exp(0.06, 0.022)), 900)), (0, tok(420, 0.03, 0.35))])


@sfx('boom.small', bus='battle', level=-31, voices=2, gap_ms=80, jitter=0.06, priority=1)
def boom_small(r):
    """Pop explosion."""
    pop = shape(sine(glide(700, 260, 0.03, 0.008), 0.03, 0.4), env_exp(0.03, 0.01, 0.0005))
    return seq([(0, puff(0.28, r, 2800, 400, 0.7)), (0, thump(250, 150, 0.12, 0.6)), (0, pop)])


@sfx('boom.big', bus='battle', level=-29, voices=2, gap_ms=220, jitter=0.04, priority=1)
def boom_big(r):
    """Boom + low thump + rubble + a short echo. Mortars and big splashes repeat several times a second in a late
    wave (it was half of a dense wave's SFX energy), so the tail stays short and the 100 Hz spam high-pass applies."""
    rubble = crackle(0.3, r, 40, 0.3, 300, 2000)
    dry = seq([(0, puff(0.45, r, 3000, 350, 0.8, 0.6)), (0, thump(220, 125, 0.24, 0.9)), (0.05, rubble)])
    return fade(echo(dry, 112, 0.22, 0.18, tail=0.18), fout=0.1)


@sfx('boom.volatile', bus='battle', level=-29, voices=1, gap_ms=100, priority=2)
def boom_volatile(r):
    """Boom + an alarm-ish detuned square stab (an enemy blowing itself up)."""
    stab = lowpass(shape(pulse(311, 0.13, 0.5, 0.25) + pulse(330, 0.13, 0.5, 0.25), env_nes(0.13, 8)), 2500)
    return seq([(0, boom_small(r)), (0.01, stab)])


@sfx('break.barrier', bus='battle', level=-28, voices=1, gap_ms=100, priority=2)
def break_barrier(r):
    """Glass shatter: tinkling grains over a soft burst."""
    grains = [(t, chime(r.rng.uniform(1800, 3600), 0.07, 0.22, 0.8, 1.41)) for t in np.sort(r.rng.uniform(0, 0.25, 14))]
    burst = shape(filtered_noise(0.3, r.rng, 1500, 5000, 0.35), env_exp(0.3, 0.06, 0.001))
    return seq(grains + [(0, tok(1600, 0.03, 0.4)), (0, burst)])


@sfx('break.crystal', bus='battle', level=-28, voices=1, gap_ms=100, priority=2)
def break_crystal(r):
    """Crystal crack: a bright inharmonic cluster."""
    cl = [(i * 0.02, lowpass(fmx(hz(n), 0.3, 2.76, 1.0, 0.1, 0.28, index_decay=0.02), 8000, 4)) for i, n in enumerate(('c7', 'e7', 'g7'))]
    return seq([(0, tok(2000, 0.02, 0.5))] + cl)


@sfx('st.freeze', bus='battle', level=-31, voices=1, gap_ms=200, priority=1)
def st_freeze(r):
    """Icy crackle + a high glassy bell."""
    return seq([(0, crackle(0.2, r, 60, 0.35, 2000, 5500)), (0.03, chime('c8', 0.2, 0.25, 0.6)),
                (0.03, shape(sine(glide(3000, 2200, 0.1, 0.03), 0.1, 0.12), env_exp(0.1, 0.04)))])


@sfx('st.burn', bus='battle', level=-31, voices=1, gap_ms=200, priority=1)
def st_burn(r):
    """Whoosh + crackle."""
    return seq([(0, swish(0.2, 300, 2000, r, 0.55, 1.0)), (0.04, crackle(0.18, r, 50, 0.35, 1000, 4000))])


@sfx('st.poison', bus='battle', level=-32, voices=1, gap_ms=220, priority=0)
def st_poison(r):
    """Little bubbles."""
    return seq([(t, fade(shape(sine(glide(f, f * 2.2, 0.045, 0.02), 0.045, 0.4), env_exp(0.045, 0.02)), 0.002, 0.008)) for t, f in
                zip(np.sort(r.rng.uniform(0, 0.24, 5)), r.rng.uniform(300, 600, 5))])


@sfx('st.shock', bus='battle', level=-32, voices=1, gap_ms=200, priority=1)
def st_shock(r):
    """Buzz zap: a thin pulse chopped by metallic noise, kept inside 300 Hz - 3.5 kHz."""
    x = pulse(147, 0.16, 0.25, 0.4) * (0.6 + 0.4 * noise(0.16, 4, True, 1.0))
    return seq([(0, bandpass(shape(x, env_nes(0.16, 8)), 300, 3500)), (0, blip(1800, 0.02, 0.25, 0.006, 0.2, lp=5000))])


@sfx('st.debuff', bus='battle', level=-32, voices=1, gap_ms=220, priority=0)
def st_debuff(r):
    """Soft descending 'wah' (rate per status: slow, reveal, silence, mark, shred, soak)."""
    x = pulse(glide(620, 300, 0.2, 0.08), 0.2, 0.25, 0.45)
    return shape(sweep_filter(x, 2400, 450, 'lowpass', 2.0), env_rc(0.2, 0.01, 0.06))


@sfx('en.death', bus='battle', level=-32, voices=2, gap_ms=50, jitter=0.07, priority=0)
def en_death(r):
    """Cute 'poof' + a falling 'pyu'."""
    pyu = blip(glide(1000, 320, 0.09, 0.03), 0.09, 0.25, 0.035, 0.3, lp=4500)
    return seq([(0, puff(0.15, r, 3000, 400, 0.5)), (0, pyu)])


@sfx('en.deathBig', bus='battle', level=-30, voices=2, gap_ms=80, jitter=0.05, priority=1)
def en_death_big(r):
    pyu = blip(glide(700, 196, 0.15, 0.05), 0.15, 0.25, 0.06, 0.3, lp=4000)
    return seq([(0, puff(0.28, r, 2600, 400, 0.6)), (0, pyu), (0.02, thump(240, 150, 0.16, 0.7))])


@sfx('en.bossDeath', bus='battle', level=-21, voices=1, gap_ms=1000, priority=3)
def en_boss_death(r):
    """The boss crumbles: orchestra hit (palette), rumble, a long chip fall, SNES echo."""
    hit = r.sampled('orch_hit', '[c4 g4 c5]/4 r/4 r/2', bpm=120, tail=1.0)
    rumble = shape(filtered_noise(1.1, r.rng, 150, 900, 0.7), env_exp(1.1, 0.35, 0.01))
    fall = blip(glide(880, 110, 0.75, 0.25), 0.75, 0.5, 0.3, 0.22, lp=3000)
    dry = seq([(0, rumble), (0, hit * 1.4), (0.03, thump(160, 75, 0.4, 0.9)), (0.15, fall), (0.1, crackle(0.6, r, 30, 0.3, 300, 2500))])
    return fade(echo(dry, 192, 0.38, 0.28, tail=0.45), fout=0.3)


@sfx('en.split', bus='battle', level=-31, voices=2, gap_ms=80, priority=0)
def en_split(r):
    """Slime squish."""
    f = np.concatenate([glide(380, 900, 0.07, 0.02), glide(900, 320, 0.09, 0.03)])
    wob = tremolo(sweep_filter(filtered_noise(0.16, r.rng, amp=0.5), 400, 1200, 'bandpass', 3.0), 25, 0.6)
    return shape(wob + sine(f, 0.16, 0.25), env_exp(0.16, 0.07, 0.003))


@sfx('en.blinkWarn', bus='battle', level=-28, voices=1, gap_ms=300, priority=2)
def en_blink_warn(r):
    """Rising shimmer: something is about to teleport."""
    x = fmx(sweep_up(800, 2.7), 0.4, 2.0, 1.0, 1.0, 0.4)
    return fade(tremolo(x, 14, 0.35) * np.linspace(0.35, 1, len(x)), 0.02, 0.04)


@sfx('en.blink', bus='battle', level=-30, voices=1, gap_ms=150, priority=1)
def en_blink(r):
    """'Vwip' teleport."""
    up = shape(sine(glide(400, 2200, 0.08, 0.03), 0.08, 0.45), env_exp(0.08, 0.04))
    return seq([(0, fade(up, 0.004, 0.01)), (0.05, swish(0.12, 3000, 800, r, 0.35))])


@sfx('en.phase', bus='battle', level=-31, voices=1, gap_ms=200, priority=0)
def en_phase(r):
    """Ghostly reverse swell."""
    x = tri(vibrato(330, 0.28, 7, 40), 0.28, 0.45, nes=False) + tri(vibrato(495, 0.28, 6, 30), 0.28, 0.2, nes=False)
    return fade(lowpass(x * np.linspace(0, 1, len(x)) ** 2, 2500), 0, 0.012)


@sfx('en.sabotage', bus='battle', level=-29, voices=1, gap_ms=300, priority=2)
def en_sabotage(r):
    """Spark-fizzle over a low, wobbly buzz."""
    buzz = lowpass(tremolo(pulse(147, 0.4, 0.5, 0.4), 9, 0.5), 1100) * env_rc(0.4, 0.01, 0.15)
    return seq([(0, crackle(0.3, r, 55, 0.45, 1200, 4500)), (0, buzz)])


@sfx('en.bossPhase', bus='battle', level=-20, voices=1, gap_ms=1000, priority=3)
def en_boss_phase(r):
    """Scary-but-cute boss roar: a growling voice that opens 'GRAAAOO' through vowel formants, a chip squeal
    riding two octaves up (the cartoon part), a soft gong behind it, a little SNES crunch and echo."""
    dur = 1.05
    t = np.arange(n_of(dur)) / RATE
    f0 = 92 + 58 * np.exp(-t / 0.18) + 8 * np.sin(2 * np.pi * 5.5 * t) * np.clip(t / 0.3, 0, 1)   # 150 Hz → ~92 Hz, wobbling
    f0 = f0 * (1 + 0.012 * r.rng.standard_normal(len(t)).cumsum() / np.sqrt(np.arange(1, len(t) + 1)))
    growl = 1 - 0.45 * (0.5 + 0.5 * np.sin(2 * np.pi * 31 * t))                                       # throat rattle
    src = saw(f0, dur, 0.5) + saw(f0 * 1.007, dur, 0.4) + 0.3 * pulse(f0 * 0.5, dur, 0.5, 0.5)
    breath = filtered_noise(dur, r.rng, 200, 4000, 0.25)
    voice = formant_morph((src + breath) * growl, ('a', 'a', 'o', 'u'), 0.82)
    voice = softclip(voice / (np.abs(voice).max() + 1e-9) * 1.6, 1.4) * env_rc(dur, 0.06, 0.45)
    squeal = blip(f0 * 4, dur, 0.25, 0.4, 0.12, lp=3500) * env_rc(dur, 0.12, 0.5)
    gong = lowpass(fmx(196, 1.3, 1.41, 1.6, 0.5, 0.35, index_decay=0.2), 5000)
    dry = seq([(0, thump(160, 70, 0.35, 0.6)), (0.02, voice), (0.05, squeal), (0.12, gong)])
    dry = lowpass(crush(dry / (np.abs(dry).max() + 1e-9) * 0.9, 9, 2), 7000)
    return fade(echo(dry, 160, 0.33, 0.24, tail=0.4), fout=0.3)


@sfx('en.new', bus='battle', level=-28, voices=1, gap_ms=400, priority=2)
def en_new(r):
    """A curious '?!' for a never-seen enemy."""
    q = blip(glide(880, 1320, 0.08, 0.03), 0.09, 0.25, 0.045, 0.4)
    x = blip(glide(1320, 1760, 0.03, 0.01), 0.1, 0.25, 0.05, 0.4)
    return seq([(0, q), (0.12, x)])


# =========================================================================================== battle: flow
@sfx('bt.leak', bus='battle', level=-25, voices=2, gap_ms=120, priority=3)
def bt_leak(r):
    """Life lost: a 'bwomp' that sinks, a tiny heart crack."""
    b = shape(pulse(glide(440, 130, 0.28, 0.09), 0.3, 0.5, 0.4), env_exp(0.3, 0.12, 0.002))
    o = shape(tri(glide(880, 260, 0.28, 0.09), 0.3, 0.3), env_exp(0.3, 0.1, 0.002))
    crack = seq([(0, tok(1500, 0.02, 0.35)), (0, shape(filtered_noise(0.03, r.rng, 1000, 4000, 0.3), env_exp(0.03, 0.008, 0.0005)))])
    return seq([(0, lowpass(b, 2200)), (0, o), (0.02, crack)])


@sfx('bt.leakBig', bus='battle', level=-23, voices=1, gap_ms=200, priority=3)
def bt_leak_big(r):
    low = lowpass(shape(pulse(glide(262, 98, 0.3, 0.1), 0.3, 0.5, 0.35), env_exp(0.3, 0.12)), 1600)
    return seq([(0, bt_leak(r)), (0, thump(190, 95, 0.3, 0.9)), (0.12, low)])


@sfx('bt.lowLives', bus='battle', level=-24, voices=1, gap_ms=2000, priority=3)
def bt_low_lives(r):
    """Two alarm chirps (A5-E5, twice)."""
    note = lambda n: blip(vibrato(hz(n), 0.1, 16, 25), 0.1, 0.25, 0.08, 0.4, lp=5000)   # noqa: E731
    return seq([(t, note(n)) for t, n in ((0, 'a5'), (0.11, 'e5'), (0.26, 'a5'), (0.37, 'e5'))])


@sfx('bt.waveClear', bus='battle', level=-23, voices=1, gap_ms=500, priority=3)
def bt_wave_clear(r):
    """'Clear!': C6 E6 G6 C7 on the pulse, bells and a coin glint."""
    run = seq([(i * 0.06, blip(n, 0.1 if i < 3 else 0.3, 0.25, 0.04 if i < 3 else 0.12, 0.35)) for i, n in enumerate(('c6', 'e6', 'g6', 'c7'))])
    bells = seq([(i * 0.06, chime(hz(n) * 2, 0.18 if i < 3 else 0.4, 0.15, 0.7)) for i, n in enumerate(('c6', 'e6', 'g6', 'c7'))])
    dry = seq([(0, run), (0, bells), (0.2, clink('g7', 0.15, 0.2)), (0.22, twinkle(r, ('e7', 'g7', 'c8'), 0.04, 0.15, 0.14))])
    return fade(echo(dry, 112, 0.28, 0.22, tail=0.3), fout=0.15)


@sfx('hero.level', bus='battle', level=-24, voices=1, gap_ms=400, priority=3)
def hero_level(r):
    """Level-up: E♭6 A♭6 F6 G6 → A♭6 at 32nds on the pulse, bells an octave up."""
    ns = ('d#6', 'g#6', 'f6', 'g6', 'g#6')
    lead = seq([(i * 0.045, blip(n, 0.3 if i == 4 else 0.07, 0.25, 0.12 if i == 4 else 0.03, 0.38, lp=5500)) for i, n in enumerate(ns)])
    bells = seq([(i * 0.045, chime(hz(n) * 2, 0.15 if i < 4 else 0.35, 0.12, 0.7)) for i, n in enumerate(ns)])
    return fade(echo(seq([(0, lead), (0, bells)]), 96, 0.28, 0.2, tail=0.2), fout=0.12)


@sfx('hero.ult', bus='battle', level=-21, voices=1, gap_ms=1000, priority=3)
def hero_ult(r):
    """Ultimate: big whoosh, a choir hit (palette), the Sakura Bell flourish on the music box."""
    choir = r.sampled('choir_ahh', '[c5 e5 g5 c6]/4 r/4 r/2', bpm=120, tail=0.6)
    box = r.sampled('music_box', 'c6/16 f6/16 d6/8 e6/8. f6/16 f6/2 | r/1', bpm=120, tail=0.5)
    dry = seq([(0, swish(0.5, 200, 4000, r, 0.6, 1.2)), (0.24, thump(220, 110, 0.2, 0.6)), (0.25, choir * 1.3), (0.35, box * 1.2)])
    return fade(dry, fout=0.35)


# =========================================================================================== gacha (bus ui)
@sfx('gacha.envelope', level=-28, voices=1, gap_ms=500, priority=2)
def gacha_envelope(r):
    """Paper rustle + a soft heartbeat (the riser stem takes over from here)."""
    n = n_of(0.35)
    grains = np.abs(r.rng.normal(0, 1, n)).clip(0, 2.5) / 2.5
    rustle = bandpass(r.rng.uniform(-1, 1, n) * grains, 1500, 5000) * env_rc(0.35, 0.05, 0.15)
    beat = seq([(0.42, thump(180, 115, 0.11, 0.8)), (0.62, thump(170, 110, 0.11, 0.6))])
    return seq([(0, rustle * 0.6), (0, beat)])


@sfx('gacha.open', level=-26, voices=1, gap_ms=500, priority=2)
def gacha_open(r):
    """Envelope tear + upward whoosh + a glint."""
    tear = tremolo(shape(filtered_noise(0.12, r.rng, 1800, 5000, 0.5), env_exp(0.12, 0.05, 0.002)), 45, 0.7)
    return seq([(0, tear), (0.08, swish(0.42, 300, 4200, r, 0.55, 1.2)), (0.46, chime('e7', 0.14, 0.2, 0.7))])


@sfx('gacha.flipR', level=-27, voices=2, gap_ms=60, priority=1)
def gacha_flip_r(r):
    """Card flip + a soft bell."""
    return seq([(0, paper(r, 0.045, 0.45)), (0.02, chime('e6', 0.25, 0.3, 0.8))])


@sfx('gacha.flipSR', level=-25, voices=2, gap_ms=80, priority=2)
def gacha_flip_sr(r):
    """Flip + a sparkle arpeggio."""
    arp_ = [(0.03 + i * 0.05, chime(n, 0.26, 0.28, 1.0)) for i, n in enumerate(('e6', 'g#6', 'b6', 'e7'))]
    return fade(echo(seq([(0, paper(r, 0.045, 0.4))] + arp_ + [(0.22, twinkle(r, ('b7', 'e8'), 0.035, 0.13, 0.12))]),
                     112, 0.28, 0.2, tail=0.25), fout=0.1)


@sfx('gacha.flipSSR', level=-20, voices=1, gap_ms=200, priority=3)
def gacha_flip_ssr(r):
    """The SSR moment: flip, an orchestra-hit landing, a harp sweep up an E major 9, a glittering chord and a
    cascade of sparkles hanging in the echo."""
    hit = r.sampled('orch_hit', '[e4 b4 e5]/4 r/4 r/2', bpm=120, tail=0.6)
    harp = r.sampled('harp', 'e5/32 f#5 g#5 b5 d#6 e6 f#6 g#6 b6 d#7 e7/8 r/16 r/2', bpm=120, tail=0.8, vel=-10)
    bloom = chord_bloom(('e6', 'g#6', 'b6', 'd#7', 'f#7'), 1.2, 0.09, 7.0)
    cascade = [(0.3 + 0.045 * i + r.rng.uniform(0, 0.01), chime(n, 0.18, 0.16 * (1 - i / 16), 0.9))
               for i, n in enumerate(('e8', 'b7', 'g#7', 'e7', 'f#7', 'd#7', 'b6', 'g#6', 'b6', 'e7', 'g#7', 'b7'))]
    dry = seq([(0, paper(r, 0.045, 0.4)), (0.02, thump(170, 90, 0.3, 0.9)), (0.02, hit * 1.1), (0.05, harp * 1.2), (0.12, bloom)] + cascade)
    return fade(echo(dry, 144, 0.34, 0.24, tail=0.4), fout=0.35)


@sfx('gacha.results', level=-25, voices=1, gap_ms=500, priority=2)
def gacha_results(r):
    """'Ta-da!'"""
    ta = seq([(0, blip('c6', 0.08, 0.25, 0.04, 0.4)), (0.09, blip('g6', 0.16, 0.25, 0.08, 0.4))])
    dry = seq([(0, ta), (0.16, chord_bloom(('c6', 'e6', 'g6', 'c7'), 0.5, 0.13, 8.0))])
    return fade(echo(dry, 112, 0.28, 0.2, tail=0.25), fout=0.12)
