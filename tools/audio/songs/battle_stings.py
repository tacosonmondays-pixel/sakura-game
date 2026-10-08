"""Battle stingers (one-shots on the music bus, docs/AUDIO.md §4.4 "Jingles and stingers"). ORIGINAL. Composer B.

    wave_blossom / wave_moonlit / wave_lantern / wave_ironclock / wave_matsuri
                   wave start, ≈ 1.5-2 s, in the family's key and tempo so it sits on top of the (ducked) family
                   track: a roll, a chip arpeggio up the tonic triad, a stab — each in its family's colours
    final_wave     final wave, ≈ 2.4 s, unpitched-ish so it is safe over any key: taiko + timpani roll, reverse
                   cymbal into a crash, a chromatic choir cluster swelling, a chip-noise whoosh
    miniboss       miniboss spawn, ≈ 2.8 s: SHADOW (D–E♭–D–A♭–F) on trumpets and trombones, taiko hits, crash
    boss_warning   boss spawn, exactly 9 beats at 168 bpm (3.21 s): a one-beat pickup, then two bars of a chip
                   siren (D–A♭ tritone), SHADOW in the low brass twice (the second time a semitone higher), a taiko
                   crescendo and an A7♭9 orchestra hit on beat 8. The boss track (boss.py, 168 bpm, D minor) starts
                   at the end of this file, i.e. exactly on the next downbeat, while the hit decays.

review: originality — all gestures are new; SHADOW is the project's own motif. Composer B, 2026-10-08.
"""
from sakura_audio.song import Song
from motifs import SHADOW
from _battle_kit import roll, tr


def _wave(id, title, bpm, key, parts, tail=0.7):
    # accentBeat 2: the engine starts the sting so its stab lands on the family track's next strong beat
    # (same tempo, so the roll and the arpeggio sit on the track's beats too)
    s = Song(id=id, title=title, bpm=bpm, meter=(3, 4), key=key, form=['S'], bus='stinger', tail=tail,
             extra={'accentBeat': 2},
             description=f'Wave-start stinger ({title.split("—")[0].strip()}): roll, chip arpeggio, stab.')
    s.section('S', 1)
    for name, role, text, vel in parts:
        s.part(name, role, 'full', vel=vel).notes('S', text)
    return s


def wave_blossom():
    return _wave('wave_blossom', 'Blossom Brigade — wave', 150, 'D', [
        ('roll', 'drums', roll('s', '16', 4, 70, 112) + ' r/4 k+c/4', 0),
        ('arp', 'chip_pulse25', 'r/4 d5/16 f#5/16 a5/16 d6/16 f#6/4', 6),
        ('glock', 'glock', 'r/4 d6/16 f#6/16 a6/16 d7/16 f#7/4', -12),
        ('stab', 'brass_stab', 'r/2 [d4 f#4 a4 d5]/4', 10),
        ('hit', 'orch_hit', 'r/2 [d3 a3 d4]/4', 0),
        ('bass', 'slap_bass', "r/2 d2/8 d3/8'", 6),
    ])


def wave_moonlit():
    return _wave('wave_moonlit', 'Moonlit Ripples — wave', 126, 'Am', [
        ('roll', 'drums_brush', roll('s', '16', 4, 50, 100) + ' r/4 k+c/4', 4),
        ('harp', 'harp', 'a3/32 c4/32 e4/32 a4/32 c5/32 e5/32 a5/32 c6/32 r/4 r/4', -4),
        ('arp', 'chip_pulse25', 'r/4 a5/16 c6/16 e6/16 a6/16 b6/4', 0),
        ('kalimba', 'kalimba', 'r/4 e6/16 a6/16 c7/16 e7/16 r/4', -10),
        ('vibes', 'vibes', 'r/2 [a4 c5 e5 b5]/4', 6),
        ('flute', 'flute', 'r/2 e6/4*', -2),
        ('tri', 'chip_triangle', 'r/2 a2/4', 4),
    ], tail=1.0)


def wave_lantern():
    return _wave('wave_lantern', 'Lantern Hush — wave', 112, 'E phrygian', [
        ('block', 'woodblock', "c5/8' g4/8' c5/16' g4/16' c5/16' g4/16' r/4", 0),
        ('koto', 'koto', 'r/4 e5/16 f5/16 a5/16 b5/16 e6/4', 8),
        ('box', 'music_box', 'r/2 b5/8* f5/8*', -6),
        ('taiko', 'taiko', 'r/2 c3/4', 4),
        ('choir', 'choir_ooh', 'r/4 [f4 a4]/8 r/8 [e4 g4 b4]/4', 0),
        ('bass', 'upright_bass', "r/4 f2/8' r/8 e2/4", 6),
    ], tail=1.0)


def wave_ironclock():
    return _wave('wave_ironclock', 'Ironclock Overdrive — wave', 152, 'G dorian', [
        ('anvil', 'drums', "cb/8 cb/8 cb/16 cb/16 cb/16 cb/16 r/4", -6),
        ('kit', 'drums_power', 's/16 s s s t1/16 t1 t3 t3 k+c/4', 0),
        ('saw', 'chip_saw', 'r/4 g5/16 bb5/16 d6/16 g6/16 g6/4', 4),
        ('stab', 'brass', 'r/2 [g3 bb3 d4 g4]/4', 12),
        ('gtr', 'overdrive_gtr', 'r/2 [g2 d3 g3]/4', 12),
        ('bass', 'slap_bass', "r/2 g1/8 g2/8'", 6),
    ])


def wave_matsuri():
    return _wave('wave_matsuri', 'Oni Matsuri — wave', 160, 'Cm', [
        ('taiko', 'taiko', roll('c3', '16', 4, 70, 118) + ' r/4 c3/4', 0),
        ('fue', 'flute', 'r/4 g5/16 c6/16 eb6/16 g6/16 c7/4*', -4),
        ('arp', 'chip_pulse25', 'r/4 c5/16 eb5/16 g5/16 c6/16 r/4', 0),
        ('choir', 'choir_ahh', 'r/2 [c4 g4 c5]/4', 10),
        ('stab', 'brass_stab', 'r/2 [c4 eb4 g4 c5]/4', 10),
        ('kit', 'drums', 'r/2 k+c/4', -4),
    ])


def final_wave():
    s = Song(id='final_wave', title='Final Wave', bpm=120, meter=(4, 4), key='C', form=['S'], bus='stinger', tail=1.4,
             extra={'accentBeat': 3},
             description='Final-wave stinger: taiko + timpani roll, reverse cymbal into a crash, choir cluster, chip whoosh.')
    s.section('S', 1)
    s.part('taiko', 'taiko', 'full', vel=4).notes('S', roll('c3', '16', 12, 40, 120) + ' c3/4')
    s.part('timp', 'timpani', 'full').notes('S', roll('d2', '32', 24, 30, 110) + ' d2/4')
    s.part('swell', 'rev_cymbal', 'full', vel=-4).notes('S', 'c4/2. r/4')
    s.part('kit', 'drums', 'full').notes('S', 'r/2. k+c/4')
    s.part('choir', 'choir_ahh', 'full', vel=-6).notes('S', 'r/4 [c4 db4 d4 eb4]/2 [c4 g4 c5]/4')
    s.part('whoosh', 'chip_kit', 'full', vel=-20).notes('S', 'r/4 ' + roll('o', '32', 16, 30, 100) + ' r/4')
    return s


def miniboss():
    s = Song(id='miniboss', title='Miniboss!', bpm=140, meter=(6, 4), key='Dm', form=['S'], bus='stinger', tail=1.2,
             extra={'accentBeat': 0},
             description='Miniboss stinger: SHADOW on trumpets and trombones over taiko hits, ending on a crash.')
    s.section('S', 1)
    shadow = SHADOW.question('Dm', 4)                                   # d4 e♭4 d4 a♭4 f4 (3.5 beats)
    s.part('tpt', 'trumpet', 'full', vel=10).notes('S', shadow + ' r/8 [d4 f4 ab4]/8 [d4 f4 ab4]/8 r/4', motifs={1: SHADOW})
    s.part('bone', 'trombone', 'full', vel=10).notes('S', 'd3/4 eb3/4 d3/4 ab2/4 [d3 ab3]/8 [d3 ab3]/8 r/4')
    s.part('taiko', 'taiko', 'full', vel=6).notes('S', 'c3/4 r/8 c3/8 c3/4 g2/8 g2/8 c3/8 c3/8 c3/4')
    s.part('timp', 'timpani', 'full').notes('S', 'd2/4 r/2 ' + roll('d2', '16', 4, 50, 110) + ' d2/4 r/4')
    s.part('kit', 'drums', 'full').notes('S', 'k+c/4 r/2 r/4 s/8 s/8 k+c/4')
    s.part('hit', 'orch_hit', 'full', vel=-2).notes('S', 'r/1 r/4 [d3 ab3 d4]/4')
    return s


def boss_warning():
    """9 beats exactly (meter 9/4, no tail): beat 0 is a pickup, the musical bars fall on beats 1 and 5, the A7♭9
    orchestra hit on beat 8, and boss.py starts at the end of the file = beat 9, the next downbeat."""
    s = Song(id='boss_warning', title='Boss Warning', bpm=168, meter=(9, 4), key='Dm', form=['S'], bus='stinger',
             tail=0.0, extra={'hold': 'boss_warning_hold'}, description='Boss warning: tritone chip siren, SHADOW twice in the low brass, taiko crescendo, '
                                   'A7b9 orchestra hit. Exactly 9 beats; boss.py starts on the next downbeat.')
    s.section('S', 1)
    shadow = SHADOW.question('Dm', 3)                                   # d3 e♭3 d3 a♭3 f3 (3.5 beats)
    s.part('siren', 'chip_pulse50', 'full', vel=-6).notes('S', ' '.join(
        f'{p}/8@v{v}' for p, v in zip(['d6', 'ab6'] * 9, range(46, 118, 4))))
    s.part('bone', 'trombone', 'full', vel=14).notes('S', 'r/4 ' + shadow + ' r/8 ' + tr(shadow, 1) + ' r/8',
                                                       motifs={1: SHADOW})
    s.part('tuba', 'tuba', 'full', vel=10).notes('S', 'r/4 d2/2. r/8 eb2/2. r/8 a1/4')
    s.part('organ', 'organ_drawbar', 'full', vel=-4).notes('S', 'r/4 [d3 a3]/2. r/8 [eb3 bb3]/2. r/8 [a3 c#4 g4]/4')
    s.part('taiko', 'taiko', 'full', vel=4).notes('S', 'r/4 c3/4 r/4 c3/4 r/4 ' + roll('c3', '16', 12, 40, 120) + ' c3/4')
    s.part('timp', 'timpani', 'full').notes('S', 'r/4 d2/4 r/2 r/4 d2/4 a1/8 a1/8 r/4 a1/4')
    s.part('swell', 'rev_cymbal', 'full', vel=-6).notes('S', 'r/1 r/4 c4/2. r/4')
    s.part('hit', 'orch_hit', 'full', vel=6).notes('S', 'r/1 r/1 [a3 c#4 g4 bb4]/4')
    s.part('kit', 'drums_power', 'full', vel=-2).notes('S', 'r/4 k/4 r/2 r/4 k/4 s/16 s s s r/4 k+c/4')
    return s


def boss_warning_hold():
    """The warning's hold bars: a 2-bar loop that keeps the alarm going (siren, taiko pulse, low D pedal) when the
    boss track is still decoding at the warning's end; the boss track then takes over at the next bar line."""
    s = Song(id='boss_warning_hold', title='Boss Warning (hold)', bpm=168, meter=(4, 4), key='Dm', form=['|:', 'H', ':|'],
             lufs=-18.0, description='Boss warning hold loop: siren + taiko pulse + low D pedal, loops until the boss '
                                     'track is decoded.')
    s.section('H', 2)
    s.part('siren', 'chip_pulse50', 'full', vel=-10).pattern('H', '(d6/8 ab6/8)x4 |')
    s.part('taiko', 'taiko', 'full', vel=0).pattern('H', 'c3/4 r/8 c3/8 c3/4 c3/8 c3/8 | c3/4 r/8 c3/8 ' +
                                                    roll('c3', '16', 8, 50, 104) + ' |')
    s.part('tuba', 'tuba', 'full', vel=4).notes('H', 'd2/2. a1/4 | d2/2. eb2/4')
    s.part('organ', 'organ_drawbar', 'full', vel=-10).notes('H', '[d3 a3]/1 | [d3 ab3]/2. [eb3 a3]/4')
    s.part('timp', 'timpani', 'full', vel=-4).notes('H', 'd2/4 r/2. | d2/4 r/4 a1/8 a1/8 a1/4')
    s.part('kit', 'drums_power', 'full', vel=-8).pattern('H', 'k/4 r/4 k/4 r/4 | k/4 r/4 k/4 s/16 s s s |')
    return s


songs = [wave_blossom(), wave_moonlit(), wave_lantern(), wave_ironclock(), wave_matsuri(), final_wave(), miniboss(),
         boss_warning(), boss_warning_hold()]
