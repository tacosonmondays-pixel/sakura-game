"""One recipe per SFX id (docs/AUDIO.md §5). Short, clean, Deltarune/EarthBound-flavoured: NES pulses,
triangle bonks, LFSR noise, FM bells, plucks and the SNES echo. Deterministic (seeded per id).

    @sfx('ui.confirm', bus='ui', gain_db=-10, voices=2, gap_ms=40, priority=2)
    def confirm(r):
        return echo(seq([(0, blip(c6, .045)), (.045, blip(g6, .09))]))

Gains are runtime trims in sprite.json (every recipe is peak-normalised to −3 dBFS first), so balancing never
needs a re-encode. Priorities: 0 spammy (fire/hit) … 3 critical (leaks, boss, wave flow).
"""
from __future__ import annotations

import numpy as np

from .synth import (RATE, n_of, hz, pulse, tri, saw, sine, noise, white, env_exp, env_adsr, env_nes, shape, sweep, steps,
                    vibrato, fm, pluck, bandpass, lowpass, highpass, sweep_filter, crush, echo, seq, cat, gain, silence)

REGISTRY: dict = {}


def sfx(sid, bus='ui', gain_db=-10.0, voices=2, gap_ms=40, jitter=0.0, priority=1):
    def deco(fn):
        REGISTRY[sid] = {'fn': fn, 'bus': bus, 'gain_db': gain_db, 'voices': voices, 'gap_ms': gap_ms, 'jitter': jitter,
                         'priority': priority}
        return fn
    return deco


# ------------------------------------------------------------------------------------------- helpers
def blip(note, dur, duty=0.25, tau=None, amp=0.5):
    f = hz(note) if isinstance(note, str) else note
    return shape(pulse(f, dur, duty, amp), env_exp(dur, tau or dur * 0.45, 0.001))


def bell(note, dur, ratio=3.5, index=1.6, amp=0.5):
    f = hz(note) if isinstance(note, str) else note
    return fm(f, dur, ratio, index, dur * 0.35, amp)


def arp(notes, step, last=None, duty=0.25, amp=0.45, tau=None):
    items = []
    for i, n in enumerate(notes):
        d = last if (last and i == len(notes) - 1) else step * 1.6
        items.append((i * step, blip(n, d, duty, tau or d * 0.5, amp)))
    return seq(items)


def whoosh(dur, f0, f1, r, amp=0.6, q=1.2):
    x = white(dur, r.rng, amp)
    y = sweep_filter(x, f0, f1, 'bandpass', q)
    return shape(y, env_adsr(dur, dur * 0.35, dur * 0.3, 0.6, dur * 0.35))


def thump(f0=120, f1=50, dur=0.12, amp=0.9):
    return shape(sine(sweep(f0, f1, dur, 'fast'), dur, amp), env_exp(dur, dur * 0.35, 0.001))


def poof(dur, r, cutoff=3000, amp=0.6, period=6):
    x = noise(dur, period, amp=amp)
    return shape(sweep_filter(x, cutoff, 300, 'lowpass', 0.8), env_exp(dur, dur * 0.3, 0.002))


def click(dur=0.006, amp=0.6, period=1):
    return shape(noise(dur, period, amp=amp), env_exp(dur, dur * 0.4, 0.0005))


def sparkle(r, notes=('e7', 'b7', 'g#7', 'e8'), step=0.035, amp=0.25):
    return seq([(i * step, bell(n, 0.12, 2.0, 1.0, amp)) for i, n in enumerate(notes)])


def crackle(dur, r, density=60, amp=0.5):
    out = np.zeros(n_of(dur))
    k = int(dur * density)
    for t in r.rng.uniform(0, dur * 0.9, k):
        c = click(0.004, amp * r.rng.uniform(0.3, 1.0), int(r.rng.integers(0, 3)))
        i = n_of(t)
        out[i:i + len(c)] += c[:len(out) - i]
    return highpass(out, 1500)


# =========================================================================================== UI
@sfx('ui.click', gain_db=-14, voices=3, gap_ms=25, priority=1)
def ui_click(r):
    return blip(1568, 0.03, 0.25, 0.01)


@sfx('ui.select', gain_db=-13, voices=2, gap_ms=30, priority=1)
def ui_select(r):
    return seq([(0, blip('c6', 0.035, 0.25)), (0.035, blip('g6', 0.05, 0.25))])


@sfx('ui.confirm', gain_db=-12, voices=2, gap_ms=40, priority=2)
def ui_confirm(r):
    return echo(seq([(0, blip('c6', 0.045)), (0.045, blip('g6', 0.1, 0.25, 0.05))]), 96, 0.3, 0.28, tail=0.25)


@sfx('ui.back', gain_db=-13, voices=2, gap_ms=40, priority=2)
def ui_back(r):
    return seq([(0, blip('g5', 0.04, 0.5, amp=0.4)), (0.04, blip('c5', 0.06, 0.5, amp=0.4))])


@sfx('ui.tab', gain_db=-13, voices=2, gap_ms=30, priority=1)
def ui_tab(r):
    return shape(tri(880, 0.045), env_exp(0.045, 0.016, 0.001))


@sfx('ui.toggle', gain_db=-13, voices=2, gap_ms=40, priority=1)
def ui_toggle(r):
    return seq([(0, click(0.004, 0.4)), (0, shape(pulse(sweep(1700, 1200, 0.05), 0.05, 0.5, 0.4), env_exp(0.05, 0.02)))])


@sfx('ui.tick', gain_db=-18, voices=1, gap_ms=60, priority=0)
def ui_tick(r):
    return blip(2000, 0.014, 0.125, 0.005, 0.4)


@sfx('ui.deny', gain_db=-12, voices=1, gap_ms=150, priority=2)
def ui_deny(r):
    x = pulse(110, 0.13, 0.5, 0.4, bl=False) + pulse(117, 0.13, 0.5, 0.4, bl=False)
    return lowpass(shape(x, env_nes(0.13)), 3200)


@sfx('ui.toast', gain_db=-15, voices=1, gap_ms=200, priority=1)
def ui_toast(r):
    return shape(tri(sweep(700, 1150, 0.06), 0.07), env_exp(0.07, 0.03, 0.002))


@sfx('ui.modalOpen', gain_db=-14, voices=1, gap_ms=80, priority=1)
def ui_modal_open(r):
    return seq([(0, whoosh(0.14, 600, 3200, r, 0.5)), (0.1, bell('c7', 0.12, 2.0, 1.0, 0.25))])


@sfx('ui.modalClose', gain_db=-15, voices=1, gap_ms=80, priority=1)
def ui_modal_close(r):
    return whoosh(0.11, 3000, 600, r, 0.5)


@sfx('ui.start', gain_db=-6, voices=1, gap_ms=500, priority=3)
def ui_start(r):
    box = r.sampled('music_box', 'c6/8 f6/8 d6/4 e6/4. r/8', bpm=240, tail=0.8)     # BELL question, double speed
    return seq([(0, sparkle(r, ('c7', 'g7', 'e7', 'c8'), 0.03, 0.3)), (0.05, box * 1.4)])


@sfx('ui.slot', gain_db=-12, voices=2, gap_ms=40, priority=1)
def ui_slot(r):
    return seq([(0, lowpass(pluck(196, 0.09, r.rng, 0.97, 0.6), 2500)), (0, click(0.005, 0.5))])


@sfx('ui.chirp', gain_db=-12, voices=1, gap_ms=300, priority=1)
def ui_chirp(r):
    return seq([(0, fm(sweep(900, 1400, 0.05), 0.05, 2.0, 1.2, 0.03, 0.5)), (0.065, fm(sweep(1100, 1750, 0.06), 0.06, 2.0, 1.2, 0.035, 0.5))])


# =========================================================================================== economy
@sfx('eco.coins', gain_db=-11, voices=2, gap_ms=60, priority=1)
def eco_coins(r):
    return echo(seq([(i * 0.06, seq([(0, blip(n, 0.08, 0.25, 0.03, 0.4)), (0, bell(n, 0.1, 3.0, 0.8, 0.15))])) for i, n in enumerate(('e6', 'b6', 'e7'))]),
                80, 0.25, 0.2, tail=0.15)


@sfx('eco.gems', gain_db=-11, voices=1, gap_ms=120, priority=1)
def eco_gems(r):
    return echo(seq([(i * 0.045, bell(n, 0.35, 2.76, 1.4, 0.3)) for i, n in enumerate(('e7', 'g#7', 'b7', 'e8'))]), 96, 0.3, 0.25, tail=0.25)


@sfx('eco.item', gain_db=-10, voices=1, gap_ms=150, priority=2)
def eco_item(r):
    a = arp(('g5', 'c6', 'e6', 'd6'), 0.075, last=0.26, amp=0.4)
    g = seq([(i * 0.075, bell(n, 0.2, 3.5, 1.0, 0.2)) for i, n in enumerate(('g6', 'c7', 'e7', 'd7'))])
    return echo(seq([(0, a), (0, g)]), 112, 0.3, 0.25, tail=0.3)


@sfx('eco.claim', gain_db=-10, voices=1, gap_ms=150, priority=2)
def eco_claim(r):
    return seq([(0, thump(160, 60, 0.1)), (0, click(0.008, 0.6, 2)), (0.07, sparkle(r, ('g7', 'b7', 'd8'), 0.04, 0.25))])


@sfx('eco.purchase', gain_db=-10, voices=1, gap_ms=150, priority=2)
def eco_purchase(r):
    return seq([(0, click(0.01, 0.6, 1)), (0.02, arp(('c6', 'e6', 'g6', 'c7'), 0.03, last=0.12, amp=0.35)), (0.14, bell('c7', 0.25, 3.0, 1.5, 0.35))])


@sfx('eco.sweep', gain_db=-10, voices=1, gap_ms=300, priority=1)
def eco_sweep(r):
    w = [(i * 0.1, whoosh(0.09, 500, 4000, r, 0.45)) for i in range(3)]
    return seq(w + [(0.32, eco_coins(r) * 0.8)])


@sfx('eco.breakthrough', gain_db=-8, voices=1, gap_ms=500, priority=2)
def eco_breakthrough(r):
    a = arp(('c5', 'e5', 'g5', 'c6', 'e6', 'g6', 'c7'), 0.04, last=0.15, amp=0.35)
    bloom = sum(bell(n, 0.7, 2.0, 1.2, 0.15) for n in ('c6', 'e6', 'g6', 'b6'))
    return echo(seq([(0, a), (0.28, bloom)]), 128, 0.32, 0.25, tail=0.3)


@sfx('gear.equip', gain_db=-12, voices=2, gap_ms=60, priority=1)
def gear_equip(r):
    return seq([(0, click(0.01, 0.6, 1)), (0.005, fm(1250, 0.08, 3.7, 2.0, 0.03, 0.4))])


@sfx('gear.enhance', gain_db=-10, voices=1, gap_ms=100, priority=2)
def gear_enhance(r):
    return echo(seq([(0, fm(1760, 0.3, 2.76, 3.0, 0.12, 0.5)), (0.06, sparkle(r, ('e7', 'a7', 'c#8'), 0.035, 0.2))]), 96, 0.3, 0.2, tail=0.2)


@sfx('gear.reroll', gain_db=-11, voices=1, gap_ms=200, priority=1)
def gear_reroll(r):
    clicks = [(t, fm(r.rng.uniform(900, 1600), 0.03, 1.4, 2.0, 0.01, 0.35)) for t in np.sort(r.rng.uniform(0, 0.3, 9))]
    return seq(clicks + [(0.34, bell('g6', 0.2, 3.0, 1.0, 0.3)), (0.34, bell('d7', 0.2, 3.0, 1.0, 0.2))])


# =========================================================================================== battle: player
@sfx('bt.pick', bus='battle', gain_db=-13, voices=2, gap_ms=40, priority=2)
def bt_pick(r):
    return seq([(0, blip(1318, 0.03, 0.25, 0.012)), (0, highpass(shape(white(0.03, r.rng, 0.4), env_exp(0.03, 0.01)), 3000))])


@sfx('bt.place', bus='battle', gain_db=-9, voices=2, gap_ms=60, priority=2)
def bt_place(r):
    return seq([(0, poof(0.2, r, 4000, 0.5)), (0.03, thump(110, 55, 0.08, 0.8))])


@sfx('bt.placeHero', bus='battle', gain_db=-6, voices=1, gap_ms=500, priority=3)
def bt_place_hero(r):
    stab = r.sampled('brass_stab', '[c5 e5 g5]/8 [d5 f#5 a5]/8 [e5 g#5 b5]/4 r/2', bpm=150, tail=0.6)
    return seq([(0, poof(0.25, r, 4000, 0.5)), (0.03, thump(110, 55, 0.1)), (0.05, stab * 1.2), (0.3, sparkle(r))])


@sfx('bt.deny', bus='battle', gain_db=-10, voices=1, gap_ms=200, priority=2)
def bt_deny(r):
    b = shape(tri(sweep(300, 120, 0.12, 'fast'), 0.13, 0.7), env_exp(0.13, 0.06, 0.001))
    z = lowpass(shape(pulse(92, 0.12, 0.5, 0.25, bl=False), env_nes(0.12)), 1800)
    return seq([(0, b), (0, z)])


@sfx('bt.upgrade', bus='battle', gain_db=-9, voices=2, gap_ms=80, priority=2)
def bt_upgrade(r):
    return echo(arp(('e5', 'g#5', 'b5', 'e6'), 0.055, last=0.14, amp=0.4), 96, 0.25, 0.2, tail=0.15)


@sfx('bt.upgradeBig', bus='battle', gain_db=-8, voices=1, gap_ms=150, priority=2)
def bt_upgrade_big(r):
    a = arp(('c5', 'e5', 'g5', 'c6', 'e6'), 0.05, last=0.2, amp=0.4)
    return echo(seq([(0, thump(90, 45, 0.15)), (0, a), (0.22, sparkle(r, ('c7', 'e7', 'g7', 'c8'), 0.03, 0.25))]), 112, 0.3, 0.22, tail=0.25)


@sfx('bt.upgradeMax', bus='battle', gain_db=-6, voices=1, gap_ms=500, priority=3)
def bt_upgrade_max(r):
    brass = r.sampled('trumpet', 'c5/16 f5/16 d5/8 e5/8. f5/16 f5/2 | r/1', bpm=132, tail=0.5)   # BELL question + answer
    lead = seq([(t, blip(n, d, 0.25, d * 0.7, 0.25)) for t, n, d in
                ((0, 'c6', 0.11), (0.114, 'f6', 0.11), (0.227, 'd6', 0.22), (0.455, 'e6', 0.34), (0.796, 'f6', 0.5))])
    return seq([(0, brass * 1.3), (0, lead), (0.8, sparkle(r))])


@sfx('bt.sell', bus='battle', gain_db=-10, voices=1, gap_ms=100, priority=2)
def bt_sell(r):
    coins = seq([(i * 0.05, blip(n, 0.07, 0.25, 0.025, 0.35)) for i, n in enumerate(('e7', 'b6', 'g6', 'e6'))])
    return seq([(0, coins), (0.18, poof(0.18, r, 3000, 0.4))])


# =========================================================================================== battle: attacks
@sfx('fire.arrow', bus='battle', gain_db=-16, voices=3, gap_ms=45, jitter=0.06, priority=0)
def fire_arrow(r):
    tw = lowpass(pluck(196, 0.08, r.rng, 0.95, 0.5, 0.6), 3500)
    return seq([(0, tw), (0.01, whoosh(0.06, 2000, 7000, r, 0.4, 2.0))])


@sfx('fire.bullet', bus='battle', gain_db=-16, voices=3, gap_ms=45, jitter=0.05, priority=0)
def fire_bullet(r):
    return seq([(0, click(0.004, 0.5)), (0, shape(pulse(sweep(1800, 320, 0.08), 0.08, 0.25, 0.4), env_exp(0.08, 0.035)))])


@sfx('fire.shell', bus='battle', gain_db=-14, voices=2, gap_ms=70, jitter=0.05, priority=0)
def fire_shell(r):
    return seq([(0, thump(150, 50, 0.13)), (0, lowpass(shape(noise(0.15, 9, amp=0.5), env_exp(0.15, 0.05)), 900))])


@sfx('fire.shuriken', bus='battle', gain_db=-16, voices=3, gap_ms=45, jitter=0.06, priority=0)
def fire_shuriken(r):
    return seq([(0, whoosh(0.08, 1500, 5500, r, 0.45, 1.5)), (0.02, fm(3200, 0.1, 1.41, 2.0, 0.05, 0.3))])


@sfx('fire.magic', bus='battle', gain_db=-16, voices=3, gap_ms=50, jitter=0.05, priority=0)
def fire_magic(r):
    return seq([(0, fm(sweep(400, 950, 0.1), 0.12, 2.0, 3.0, 0.06, 0.5)), (0.06, bell('e7', 0.1, 2.0, 0.8, 0.15))])


@sfx('fire.holy', bus='battle', gain_db=-16, voices=3, gap_ms=50, jitter=0.03, priority=0)
def fire_holy(r):
    return fm(1975, 0.15, 3.5, 1.5, 0.06, 0.5)


@sfx('fire.zap', bus='battle', gain_db=-17, voices=3, gap_ms=45, jitter=0.05, priority=0)
def fire_zap(r):
    return seq([(0, shape(noise(0.06, 2, True, 0.4), env_exp(0.06, 0.02))), (0, shape(pulse(sweep(2400, 800, 0.08), 0.08, 0.125, 0.35), env_exp(0.08, 0.03)))])


@sfx('atk.slash', bus='battle', gain_db=-15, voices=2, gap_ms=60, jitter=0.04, priority=0)
def atk_slash(r):
    return whoosh(0.13, 800, 5500, r, 0.7, 2.0)


@sfx('atk.pulse', bus='battle', gain_db=-15, voices=2, gap_ms=120, jitter=0.02, priority=0)
def atk_pulse(r):
    x = sine(220, 0.3, 0.5) + sine(223.5, 0.3, 0.4) + sine(440, 0.3, 0.1)
    return echo(shape(x, env_exp(0.3, 0.1, 0.005)), 80, 0.3, 0.25, tail=0.2)


@sfx('atk.beam', bus='battle', gain_db=-16, voices=2, gap_ms=90, priority=0)
def atk_beam(r):
    x = saw(vibrato(330, 0.24, 18, 40), 0.24, 0.4)
    return shape(sweep_filter(x, 1200, 5000, 'lowpass', 1.5), env_adsr(0.24, 0.01, 0.05, 0.7, 0.08))


@sfx('atk.chain', bus='battle', gain_db=-16, voices=2, gap_ms=90, priority=0)
def atk_chain(r):
    return seq([(t, shape(noise(0.016, 1, True, 0.5, seed=7 + i), env_exp(0.016, 0.006))) for i, t in enumerate((0, 0.025, 0.05))])


@sfx('trap.set', bus='battle', gain_db=-14, voices=2, gap_ms=100, priority=1)
def trap_set(r):
    return seq([(0, click(0.006, 0.5)), (0.01, bell('e6', 0.12, 3.0, 1.0, 0.35))])


@sfx('trap.trigger', bus='battle', gain_db=-12, voices=2, gap_ms=80, priority=1)
def trap_trigger(r):
    return seq([(0, click(0.012, 0.7, 0)), (0.01, poof(0.22, r, 2500, 0.6, 10)), (0.01, thump(100, 45, 0.12, 0.7))])


@sfx('turret.build', bus='battle', gain_db=-13, voices=1, gap_ms=200, priority=1)
def turret_build(r):
    return seq([(0, fm(980, 0.08, 2.4, 3.0, 0.03, 0.5)), (0.09, fm(1240, 0.1, 1.6, 3.0, 0.035, 0.5))])


# =========================================================================================== battle: impacts, status, enemies
@sfx('hit.pierce', bus='battle', gain_db=-17, voices=3, gap_ms=40, jitter=0.08, priority=0)
def hit_pierce(r):
    return seq([(0, bandpass(shape(noise(0.02, 3, amp=0.6), env_exp(0.02, 0.006)), 1000, 3500)), (0, shape(sine(1200, 0.015, 0.4), env_exp(0.015, 0.005)))])


@sfx('hit.slash', bus='battle', gain_db=-17, voices=3, gap_ms=40, jitter=0.08, priority=0)
def hit_slash(r):
    return highpass(shape(white(0.04, r.rng, 0.6), env_exp(0.04, 0.012)), 3500)


@sfx('hit.mystic', bus='battle', gain_db=-17, voices=3, gap_ms=40, jitter=0.06, priority=0)
def hit_mystic(r):
    return fm(sweep(600, 1250, 0.06), 0.07, 2.0, 2.0, 0.03, 0.5)


@sfx('hit.holy', bus='battle', gain_db=-17, voices=3, gap_ms=40, jitter=0.04, priority=0)
def hit_holy(r):
    return fm(2349, 0.08, 2.0, 1.2, 0.03, 0.5)


@sfx('hit.crit', bus='battle', gain_db=-13, voices=2, gap_ms=60, jitter=0.03, priority=1)
def hit_crit(r):
    return seq([(0, shape(pulse(sweep(1500, 4000, 0.04), 0.04, 0.125, 0.35), env_exp(0.04, 0.02))), (0.02, bell('a7', 0.1, 2.0, 1.0, 0.3))])


@sfx('hit.resist', bus='battle', gain_db=-17, voices=2, gap_ms=60, jitter=0.05, priority=0)
def hit_resist(r):
    return lowpass(shape(tri(220, 0.07, 0.7), env_exp(0.07, 0.025)), 700)


@sfx('boom.small', bus='battle', gain_db=-13, voices=2, gap_ms=60, jitter=0.06, priority=1)
def boom_small(r):
    return seq([(0, lowpass(shape(noise(0.3, 10, amp=0.7), env_exp(0.3, 0.07, 0.001)), 2500)), (0, thump(95, 42, 0.14, 0.7))])


@sfx('boom.big', bus='battle', gain_db=-10, voices=2, gap_ms=100, jitter=0.04, priority=2)
def boom_big(r):
    n = shape(sweep_filter(noise(0.6, 12, amp=0.8), 3200, 250, 'lowpass', 0.7), env_exp(0.6, 0.16, 0.001))
    return echo(seq([(0, n), (0, thump(75, 32, 0.32, 1.0))]), 128, 0.3, 0.22, tail=0.3)


@sfx('boom.volatile', bus='battle', gain_db=-11, voices=1, gap_ms=100, priority=2)
def boom_volatile(r):
    stab = lowpass(shape(pulse(311, 0.13, 0.5, 0.3) + pulse(330, 0.13, 0.5, 0.3), env_nes(0.13)), 3000)
    return seq([(0, boom_small(r)), (0.01, stab)])


@sfx('break.barrier', bus='battle', gain_db=-11, voices=1, gap_ms=100, priority=2)
def break_barrier(r):
    grains = [(t, fm(r.rng.uniform(2500, 6000), 0.06, 1.41, 2.0, 0.02, 0.25)) for t in np.sort(r.rng.uniform(0, 0.25, 14))]
    return seq(grains + [(0, highpass(shape(white(0.35, r.rng, 0.5), env_exp(0.35, 0.08)), 4000))])


@sfx('break.crystal', bus='battle', gain_db=-11, voices=1, gap_ms=100, priority=2)
def break_crystal(r):
    return seq([(0, click(0.01, 0.6, 0))] + [(i * 0.02, bell(n, 0.3, 2.76, 2.0, 0.3)) for i, n in enumerate(('c7', 'e7', 'g7'))])


@sfx('st.freeze', bus='battle', gain_db=-14, voices=1, gap_ms=120, priority=1)
def st_freeze(r):
    return seq([(0, crackle(0.22, r, 70, 0.4)), (0.03, bell('c8', 0.2, 3.0, 1.0, 0.25))])


@sfx('st.burn', bus='battle', gain_db=-14, voices=1, gap_ms=120, priority=1)
def st_burn(r):
    return seq([(0, whoosh(0.2, 300, 2200, r, 0.6)), (0.04, crackle(0.2, r, 50, 0.35))])


@sfx('st.poison', bus='battle', gain_db=-15, voices=1, gap_ms=150, priority=0)
def st_poison(r):
    return seq([(t, shape(sine(sweep(f, f * 2.2, 0.05), 0.05, 0.4), env_exp(0.05, 0.02))) for t, f in
                zip(np.sort(r.rng.uniform(0, 0.24, 5)), r.rng.uniform(280, 520, 5))])


@sfx('st.shock', bus='battle', gain_db=-15, voices=1, gap_ms=120, priority=1)
def st_shock(r):
    x = pulse(80, 0.18, 0.125, 0.4, bl=False) * (0.6 + 0.4 * noise(0.18, 4, True, 1.0))
    return bandpass(shape(x, env_nes(0.18)), 200, 5000)


@sfx('st.debuff', bus='battle', gain_db=-15, voices=1, gap_ms=120, priority=0)
def st_debuff(r):
    return shape(sweep_filter(pulse(sweep(600, 300, 0.2), 0.2, 0.25, 0.45), 2600, 450, 'lowpass', 2.0), env_adsr(0.2, 0.01, 0.05, 0.8, 0.06))


@sfx('en.death', bus='battle', gain_db=-14, voices=2, gap_ms=50, jitter=0.07, priority=0)
def en_death(r):
    return seq([(0, poof(0.16, r, 3500, 0.5)), (0, shape(pulse(sweep(900, 280, 0.1), 0.1, 0.25, 0.35), env_exp(0.1, 0.04)))])


@sfx('en.deathBig', bus='battle', gain_db=-12, voices=2, gap_ms=80, jitter=0.05, priority=1)
def en_death_big(r):
    return seq([(0, poof(0.3, r, 3000, 0.6, 8)), (0, shape(pulse(sweep(700, 180, 0.16), 0.16, 0.25, 0.35), env_exp(0.16, 0.06))),
                (0.02, thump(90, 40, 0.18, 0.8))])


@sfx('en.bossDeath', bus='battle', gain_db=-5, voices=1, gap_ms=1000, priority=3)
def en_boss_death(r):
    hit = r.sampled('orch_hit', '[c4 g4 c5]/4 r/4 r/2', bpm=120, tail=1.2)
    rumble = lowpass(shape(noise(1.2, 13, amp=0.8), env_exp(1.2, 0.4, 0.01)), 900)
    return echo(seq([(0, rumble), (0, hit * 1.4), (0.05, thump(70, 30, 0.4, 1.0))]), 192, 0.4, 0.3, tail=0.5)


@sfx('en.split', bus='battle', gain_db=-15, voices=2, gap_ms=80, priority=0)
def en_split(r):
    f = np.concatenate([sweep(400, 950, 0.07), sweep(950, 300, 0.09)])
    return shape(sweep_filter(noise(0.16, 5, amp=0.6), 400, 1200, 'bandpass', 3.0) + sine(f, 0.16, 0.25), env_exp(0.16, 0.07, 0.003))


@sfx('en.blinkWarn', bus='battle', gain_db=-14, voices=1, gap_ms=300, priority=2)
def en_blink_warn(r):
    x = fm(sweep(800, 2400, 0.4), 0.4, 2.0, 1.5, 1.0, 0.4)
    t = np.arange(len(x)) / RATE
    return x * (0.6 + 0.4 * np.sin(2 * np.pi * 14 * t)) * np.linspace(0.3, 1, len(x))


@sfx('en.blink', bus='battle', gain_db=-14, voices=1, gap_ms=150, priority=1)
def en_blink(r):
    return seq([(0, shape(sine(sweep(400, 2200, 0.08), 0.08, 0.5), env_exp(0.08, 0.04))), (0.06, whoosh(0.12, 3000, 800, r, 0.35))])


@sfx('en.phase', bus='battle', gain_db=-15, voices=1, gap_ms=200, priority=0)
def en_phase(r):
    x = tri(vibrato(330, 0.28, 7, 40), 0.28, 0.5, nes=False)
    return lowpass(x * np.linspace(0, 1, len(x)) ** 2, 2500)


@sfx('en.sabotage', bus='battle', gain_db=-12, voices=1, gap_ms=300, priority=2)
def en_sabotage(r):
    buzz = lowpass(shape(pulse(55, 0.4, 0.5, 0.5, bl=False), env_adsr(0.4, 0.01, 0.1, 0.7, 0.15)), 900)
    return seq([(0, crackle(0.3, r, 60, 0.5)), (0, buzz)])


@sfx('en.bossPhase', bus='battle', gain_db=-6, voices=1, gap_ms=1000, priority=3)
def en_boss_phase(r):
    roar = sum(saw(sweep(f, f * 0.7, 0.9), 0.9, 0.25) for f in (82, 86.5, 123))
    roar = shape(lowpass(roar, 1600) + lowpass(noise(0.9, 11, amp=0.3), 2000), env_adsr(0.9, 0.05, 0.2, 0.7, 0.4))
    gong = shape(bandpass(noise(1.2, 1, amp=0.6), 2000, 9000), env_exp(1.2, 0.4, 0.005))
    return echo(seq([(0, roar), (0.05, gong)]), 160, 0.35, 0.25, tail=0.4)


@sfx('en.new', bus='battle', gain_db=-12, voices=1, gap_ms=400, priority=2)
def en_new(r):
    return seq([(0, shape(pulse(sweep(880, 1320, 0.07), 0.08, 0.25, 0.4), env_exp(0.08, 0.04))),
                (0.12, shape(pulse(sweep(1320, 1760, 0.05), 0.1, 0.25, 0.4), env_exp(0.1, 0.05)))])


# =========================================================================================== battle: flow
@sfx('bt.leak', bus='battle', gain_db=-9, voices=2, gap_ms=120, priority=3)
def bt_leak(r):
    b = shape(pulse(sweep(440, 110, 0.25), 0.3, 0.5, 0.45), env_exp(0.3, 0.12, 0.002))
    return seq([(0, lowpass(b, 3000)), (0.02, highpass(shape(noise(0.08, 1, amp=0.4), env_exp(0.08, 0.02)), 2500))])


@sfx('bt.leakBig', bus='battle', gain_db=-7, voices=1, gap_ms=200, priority=3)
def bt_leak_big(r):
    return seq([(0, bt_leak(r)), (0, thump(80, 35, 0.3, 1.0)), (0.12, lowpass(shape(pulse(sweep(220, 70, 0.3), 0.3, 0.5, 0.35), env_exp(0.3, 0.12)), 2000))])


@sfx('bt.lowLives', bus='battle', gain_db=-9, voices=1, gap_ms=2000, priority=3)
def bt_low_lives(r):
    return seq([(t, blip(n, 0.1, 0.25, 0.08, 0.4)) for t, n in ((0, 'a5'), (0.11, 'e5'), (0.26, 'a5'), (0.37, 'e5'))])


@sfx('bt.waveClear', bus='battle', gain_db=-8, voices=1, gap_ms=500, priority=3)
def bt_wave_clear(r):
    a = arp(('c6', 'e6', 'g6', 'c7'), 0.06, last=0.3, amp=0.4)
    return echo(seq([(0, a), (0.18, sparkle(r, ('e7', 'g7', 'c8'), 0.04, 0.2))]), 112, 0.3, 0.25, tail=0.3)


@sfx('hero.level', bus='battle', gain_db=-8, voices=1, gap_ms=400, priority=3)
def hero_level(r):
    a = arp(('d#6', 'g#6', 'f6', 'g6', 'g#6'), 0.045, last=0.3, duty=0.125, amp=0.4)
    g = seq([(i * 0.045, bell(n, 0.15, 3.5, 1.0, 0.15)) for i, n in enumerate(('d#7', 'g#7', 'f7', 'g7', 'g#7'))])
    return echo(seq([(0, a), (0, g)]), 96, 0.3, 0.22, tail=0.2)


@sfx('hero.ult', bus='battle', gain_db=-5, voices=1, gap_ms=1000, priority=3)
def hero_ult(r):
    choir = r.sampled('choir_ahh', '[c5 e5 g5 c6]/4 r/4 r/2', bpm=120, tail=0.8)
    box = r.sampled('music_box', 'c6/16 f6/16 d6/8 e6/8. f6/16 f6/2 | r/1', bpm=120, tail=0.6)
    return seq([(0, whoosh(0.5, 200, 4500, r, 0.6)), (0.25, choir * 1.3), (0.35, box * 1.2)])


# =========================================================================================== gacha
@sfx('gacha.envelope', gain_db=-10, voices=1, gap_ms=500, priority=2)
def gacha_envelope(r):
    rustle = bandpass(white(0.35, r.rng, 0.5) * np.abs(r.rng.normal(0, 1, n_of(0.35))).clip(0, 2) / 2, 1500, 6000)
    beat = seq([(0.4, thump(70, 50, 0.12, 0.8)), (0.62, thump(65, 45, 0.12, 0.6))])
    return seq([(0, shape(rustle, env_adsr(0.35, 0.05, 0.1, 0.6, 0.15))), (0, beat)])


@sfx('gacha.open', gain_db=-9, voices=1, gap_ms=500, priority=2)
def gacha_open(r):
    tear = highpass(shape(white(0.12, r.rng, 0.6) * (0.5 + 0.5 * np.sign(r.rng.uniform(-1, 1, n_of(0.12)))), env_exp(0.12, 0.05)), 2000)
    return seq([(0, tear), (0.08, whoosh(0.45, 300, 5000, r, 0.55))])


@sfx('gacha.flipR', gain_db=-12, voices=2, gap_ms=60, priority=1)
def gacha_flip_r(r):
    return seq([(0, highpass(shape(white(0.04, r.rng, 0.5), env_exp(0.04, 0.012)), 2500)), (0.02, bell('e6', 0.25, 3.0, 1.0, 0.3))])


@sfx('gacha.flipSR', gain_db=-10, voices=2, gap_ms=80, priority=2)
def gacha_flip_sr(r):
    return echo(seq([(0, gacha_flip_r(r) * 0.8)] + [(0.03 + i * 0.05, bell(n, 0.25, 2.0, 1.2, 0.3)) for i, n in enumerate(('e6', 'g#6', 'b6', 'e7'))]),
                112, 0.3, 0.22, tail=0.25)


@sfx('gacha.flipSSR', gain_db=-7, voices=1, gap_ms=200, priority=3)
def gacha_flip_ssr(r):
    shimmer = sum(bell(n, 0.8, 2.0, 1.5, 0.12) for n in ('e6', 'b6', 'e7', 'g#7', 'b7'))
    return echo(seq([(0, gacha_flip_r(r) * 0.8), (0.02, thump(70, 40, 0.3, 1.0)), (0.05, shimmer)]), 144, 0.35, 0.25, tail=0.3)


@sfx('gacha.results', gain_db=-10, voices=1, gap_ms=500, priority=2)
def gacha_results(r):
    chord = sum(bell(n, 0.5, 2.0, 1.0, 0.15) for n in ('c6', 'e6', 'g6', 'c7'))
    return echo(seq([(0, arp(('c6', 'g6'), 0.08, last=0.12, amp=0.4)), (0.16, chord)]), 112, 0.3, 0.22, tail=0.25)
