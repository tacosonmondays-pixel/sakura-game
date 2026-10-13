"""'Ironclock Overdrive' — battle family 4 (mountain + foundry maps). ORIGINAL composition (docs/AUDIO.md §4.1 rules).

G minor (Dorian, with a Mixolydian B♮ in the bass riff), 152 bpm, straight. Mechanical, stomping: gears and armour.
Stems: base (build phase) + intensity (wave active).
    intro  2 bars  the gear riff alone on slap bass + chip square, anvil cowbell, power-kit stomp
    A      8 bars  the clockwork hook on a VRC6-style chip saw: a staccato D, a 16th double-tick, a step down
                   to a tied A (♪' ♬ ♪ ♪~♪ ♪ ♪ ♪) over the Dorian i–IV7 vamp (Gm7 – C7)
    A2     8 bars  the hook doubled by organ, chip counter-line a third under (intensity), new ending on D7
    B      8 bars  BELL as a syncopated riff in G minor (D–G–E♭–F♯ … G), then in C minor and E♭: chip saw +
                   organ in the base, the full brass section in the intensity stem
    C      8 bars  clockwork breakdown: half-time stomp, celesta gears, a long falling saw line; the overdrive
                   guitar calls SENTINEL CALL three times (intensity)
    D      8 bars  the hook lifted a minor third to B♭ minor (the gears shift up), F7 drops back into G minor
Form: intro |: A A2 B C D :|  — 2 + 40 bars.

Leitmotifs: BELL (B, syncopated riff, minor), SENTINEL CALL (C, guitar, intensity).
review: originality — hook, riffs, bass lines and counter-lines are new (a first draft of the hook, G G G B♭ C … B♭ G,
was rewritten because its contour echoed a famous rock riff); BELL and SENTINEL are the project's own
motifs. Checked by ear-memory against well-known factory/robot/clock stage themes (Mega Man, Metal Man, Sonic
Metropolis, Mario airship, Undertale CORE/Hotland, Deltarune Cyber World, EarthBound/Mother): no shared hook,
riff or contour. Composer B, 2026-10-08.
Round 3 (owner favourite, polish only): no note changes; phone-speaker balance (4th-order HP 380 Hz model) —
sq_bass +1.5 dB (the bass double that carries the riff on phones), anvil_reply +1 dB and the organ stab bed +1 dB
(the "melody BAM" answers and pushes read in the build phase).
"""
from sakura_audio.song import Song
from motifs import BELL, SENTINEL
from _battle_kit import bars, roll, walk, tr

CH_INTRO = 'Gm7 | Gm7'
CH_A = 'Gm7 | C7 | Gm7 | C7 | Ebmaj7 | F | Gm7 C7 | D7sus4 D7'
CH_A2 = 'Gm7 | C7 | Gm7 | C7 | Ebmaj7 | F7 | Gm7 C7 | D7'
CH_B = 'Gm D7 | Gm | Gm D7 | Gm | Cm G7 | Cm | Ebmaj7 F | D7sus4 D7'
CH_C = 'Gm | Gm | Ebmaj7 | Ebmaj7 | Cm7 | Cm7 | D7sus4 | D7'
CH_D = 'Bbm7 | Eb7 | Bbm7 | Eb7 | Gbmaj7 | Ab | Bbm7 Eb7 | F7sus4 F7'

HOOK = [
    "d6/8' d6/16 d6/16 c6/8 a5/8~ a5/8 bb5/8 c6/8 a5/8",     # 1 Gm7   tick, double-tick, step down, hold
    'g5/8 e5/8 g5/8 bb5/8~ bb5/4 r/4',                        # 2 C7    (E = the Dorian 6th)  … anvil answers
    "d6/8' d6/16 d6/16 c6/8 a5/8~ a5/8 c6/8 f6/8 d6/8",       # 3 Gm7
    'e6/8 c6/8 bb5/8 g5/8~ g5/4 r/4',                         # 4 C7
]
A_END = [
    'bb5/8 g5/8 bb5/8 d6/8~ d6/4 c6/8 bb5/8',                 # 5 E♭maj7
    'c6/8 a5/8 f5/8 c6/8~ c6/4 a5/8 c6/8',                    # 6 F
    'd6/4 bb5/8 g5/8 e5/4 g5/4',                              # 7 Gm7 C7
    'a5/4. g5/8 f#5/2',                                       # 8 D7sus4 D7
]
A2_END = [
    'bb5/8 g5/8 bb5/8 eb6/8~ eb6/4 d6/8 bb5/8',               # 5 E♭maj7
    'c6/8 a5/8 f5/8 a5/8~ a5/4 c6/8 eb6/8',                   # 6 F7
    'd6/8 c6/8 bb5/8 g5/8 e5/8 f5/8 g5/8 bb5/8',              # 7 Gm7 C7
    'a5/2 f#5/4 d5/4',                                        # 8 D7
]
BELL_RIFF = [
    'd5/8 g5/8 r/8 eb5/8~ eb5/8 f#5/8~ f#5/4',                # 1 Gm D7   BELL, syncopated (question)
    'g5/4 r/8 g5/16 f5/16 d5/8 bb4/8 c5/8 d5/8',              # 2 Gm      … answered, gear tail
    'd5/8 g5/8 r/8 eb5/8~ eb5/8 f#5/8~ f#5/4',                # 3 Gm D7
    'g5/4 r/8 bb5/16 c6/16 d6/8 f6/8 d6/8 c6/8',              # 4 Gm
    'g5/8 c6/8 r/8 ab5/8~ ab5/8 b5/8~ b5/4',                  # 5 Cm G7   BELL in C minor
    'c6/4 r/8 c6/16 bb5/16 g5/8 eb5/8 f5/8 g5/8',             # 6 Cm
    'bb5/8 eb6/8 r/8 c6/8~ c6/8 d6/8~ d6/4',                  # 7 E♭maj7 F (the shape in E♭)
    'd6/4. c6/8 a5/8 f#5/8 d5/8 c5/8',                        # 8 D7sus4 D7
]
C_SAW = ['bb5/1', 'a5/2 g5/2', 'g5/1', 'f5/2 eb5/2', 'g5/2 eb5/2', 'd5/2 c5/2', 'd5/1', 'f#5/2 a5/2']
D_HOOK = [tr(b, 3) for b in HOOK + A_END[:3]] + ['c6/4. bb5/8 a5/2']
COUNTER = [   # chip pulse 25 % a third under the hook (A2) — two NES channels in parallel
    "bb5/8' bb5/16 bb5/16 a5/8 f5/8~ f5/8 g5/8 a5/8 f5/8",
    'e5/8 c5/8 e5/8 g5/8~ g5/4 r/4',
    "bb5/8' bb5/16 bb5/16 a5/8 f5/8~ f5/8 a5/8 d6/8 bb5/8",
    'c6/8 a5/8 g5/8 e5/8~ e5/4 r/4',
    'g5/8 eb5/8 g5/8 bb5/8~ bb5/4 bb5/8 g5/8',
    'a5/8 f5/8 c5/8 f5/8~ f5/4 a5/8 c6/8',
    'bb5/8 a5/8 g5/8 d5/8 c5/8 d5/8 e5/8 g5/8',
    'f#5/2 d5/4 a4/4',
]

GEAR = 'R/8 R/16 8/16 7/8 R/8 r/8 R/8 3/8 ap/8'
GEAR_H = 'R/8 R/16 8/16 7/8 ap/8'
ROCK = 'k+h/8 h/8 s+h/8 k+h/8 k+h/8 h/8 s+h/8 h/16 s?/16 |'
ROCK_C = 'k+c/8 h/8 s+h/8 k+h/8 k+h/8 h/8 s+h/8 h/16 s?/16 |'
ROCK_F4 = 'k+h/8 h/8 s+h/8 k+h/8 s/16 s s s t1/8 t3/8 |'
ROCK_F8 = 'k+h/8 s/16 s s/8 s/16 s t1/16 t1 t2/8 t3/16 t3 t3/8 |'
STOMP = 'k+c/4 r/4 s/4 r/8 k/8 |'
STOMP_N = 'k/4 r/4 s/4 r/8 k/8 |'
ANVIL = 'cb/8 r/8 r/8 cb/8 r/8 cb/8 ag/8 agl/8 |'


def build() -> Song:
    s = Song(id='battle_ironclock', title='Ironclock Overdrive', bpm=152, meter=(4, 4), key='G dorian',
             form=['intro', '|:', 'A', 'A2', 'B', 'C', 'D', ':|'], mix={'highpass_hz': 40},
             description='Battle (mountain, foundry): clockwork chip-saw hook in G Dorian, BELL as a brass riff, B♭ lift.')
    s.section('intro', 2, CH_INTRO)
    s.section('A', 8, CH_A)
    s.section('A2', 8, CH_A2)
    s.section('B', 8, CH_B)
    s.section('C', 8, CH_C)
    s.section('D', 8, CH_D)

    # ================================================================ base
    s.part('saw', 'chip_saw', 'base', vel=6, gain=1) \
        .notes('A', bars(*HOOK, *A_END)).notes('A2', bars(*HOOK, *A2_END)) \
        .notes('B', bars(*BELL_RIFF), motifs={1: BELL, 3: BELL, 5: BELL}) \
        .notes('C', bars(*C_SAW)).notes('D', bars(*D_HOOK))
    s.part('organ_mel', 'organ', 'base', vel=-10).double('saw', ['A2', 'B', 'D'])
    s.part('organ', 'organ', 'base', vel=-14, gain=1).gen(['A', 'A2', 'B', 'D'], 'comp:stabs', voicing='rootless', low=55, high=72) \
        .gen('C', 'pad:sustain', voicing='triad', low=55, high=70, vel=56)
    s.part('celesta', 'celesta', 'base', vel=-14).gen('C', 'arp:up16', voicing='triad', low=67, high=86)
    s.part('anvil_reply', 'xylophone', 'base', vel=-8, gain=1).at(['A', 'A2', 'D'], 2, "r/2 g6/16' g6/16' r/8 c6/8' r/8") \
        .at(['A', 'A2', 'D'], 4, "r/2 g6/16' g6/16' r/8 bb6/8' r/8")
    s.part('bass', 'slap_bass', 'base', vel=4) \
        .notes('intro', walk(CH_INTRO, GEAR, low=43, nxt='Gm7')) \
        .notes('A', walk(CH_A, GEAR, GEAR_H, low=36, nxt='Gm7')) \
        .notes('A2', walk(CH_A2, GEAR, GEAR_H, low=36, nxt='Gm')) \
        .notes('B', walk(CH_B, GEAR, GEAR_H, low=36, nxt='Gm')) \
        .notes('C', walk(CH_C, 'R/4 r/8 R/8 8/4 r/8 5/8', 'R/4 r/4', low=36, nxt='Bbm7')) \
        .notes('D', walk(CH_D, GEAR, GEAR_H, low=36, nxt='Gm7'))
    s.part('sq_bass', 'chip_pulse50', 'base', octave=1, vel=-22, gain=1.5).double('bass', ['intro', 'A', 'A2', 'B', 'D'])
    s.part('kit', 'drums_power', 'base') \
        .pattern('intro', STOMP_N) \
        .pattern(['A', 'A2', 'B', 'D'], ROCK, fills={1: ROCK_C, 4: ROCK_F4, 5: ROCK_C, 8: ROCK_F8}) \
        .pattern('C', STOMP_N, fills={1: STOMP, 8: 'k/8 k/8 s/8 k/8 ' + roll('s', '16', 8, 60, 116) + ' |'})
    s.part('anvil', 'drums', 'base', vel=-12).pattern(['intro', 'A', 'A2', 'B', 'C', 'D'], ANVIL)

    # ================================================================ intensity
    s.part('counter', 'chip_pulse25', 'intensity', vel=10, gain=-4.5).notes('A2', bars(*COUNTER)) \
        .notes('D', bars(*[tr(b, 3) for b in COUNTER[:7]], 'eb5/2 c5/4 a4/4'))
    s.part('tpt', 'trumpet', 'intensity', vel=10).double('saw', ['B', 'D'])
    s.part('bone', 'trombone', 'intensity', octave=-1, vel=2).double('saw', 'B')
    s.part('brass', 'brass', 'intensity', vel=12).gen(['A', 'A2'], 'comp:stabs', voicing='close', low=55, high=72)
    s.part('gtr', 'overdrive_gtr', 'intensity', vel=14) \
        .notes(['A', 'A2'], walk(CH_A, "R/8 R/8 r/8 R/8 R/8 R/8 r/8 R/8", "R/8 R/8 r/8 R/8", low=43, nxt='Gm7')) \
        .notes('D', walk(CH_D, "R/8 R/8 r/8 R/8 R/8 R/8 r/8 R/8", "R/8 R/8 r/8 R/8", low=43, nxt='Gm7')) \
        .at('C', 1, SENTINEL.question('Gm', 5), motif=SENTINEL) \
        .at('C', 3, SENTINEL.question('Gm', 5), motif=SENTINEL) \
        .at('C', 5, SENTINEL.question('Gm', 5), motif=SENTINEL) \
        .at('C', 7, 'd5/2 c5/4 a4/4 | f#4/2 a4/4 c5/4')
    s.part('gtr5', 'overdrive_gtr', 'intensity', vel=10) \
        .notes(['A', 'A2'], walk(CH_A, "5/8 5/8 r/8 5/8 5/8 5/8 r/8 5/8", "5/8 5/8 r/8 5/8", low=43, nxt='Gm7')) \
        .notes('D', walk(CH_D, "5/8 5/8 r/8 5/8 5/8 5/8 r/8 5/8", "5/8 5/8 r/8 5/8", low=43, nxt='Gm7'))
    s.part('hits', 'orch_hit', 'intensity', vel=8) \
        .at(['A', 'A2'], 8, 'r/2 [d4 f#4 a4 c5]/4 r/4').at('B', 2, '[g3 bb3 d4 g4]/4 r/2.').at('B', 6, '[c4 eb4 g4 c5]/4 r/2.') \
        .at('D', 1, '[bb3 db4 f4 bb4]/4 r/2.').at('D', 8, 'r/2 [f4 a4 c5 eb5]/4 r/4')
    s.part('toms', 'drums', 'intensity', vel=0) \
        .pattern(['A', 'A2', 'B', 'D'], 'r/4 cl/4 r/4 cl/4 |', fills={4: 'r/4 cl/4 t1/16 t1 t2 t2 t3/8 t3/8 |', 8: 'r/4 cl/4 t1/16 t1 t2 t2 t3/16 t3 t3 t3 |'}) \
        .pattern('C', 'r/2 cl/4 r/4 |', fills={7: 't1/8 t1 t2 t2 t3 t3 t3/16 t3 t3 t3 |', 8: 'k/8 k k k cl/8 cl cl cl |'})
    s.part('noise', 'chip_kit', 'intensity', vel=-26).pattern(['A', 'A2', 'B', 'D'], '(h/16 h? h h?)x4 |')
    return s


songs = [build()]
