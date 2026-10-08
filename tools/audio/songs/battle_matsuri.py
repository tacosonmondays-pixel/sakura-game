"""'Oni Matsuri' — battle family 5 (festival + volcano maps). ORIGINAL composition (docs/AUDIO.md §4.1 rules).

C minor → E♭ major chorus, 160 bpm, straight. Hot and festive: taiko, shamisen, the festival flute, fire.
Stems: base (build phase) + intensity (wave active).
    intro  2 bars  a fue call over a taiko roll, the chip lead skips in
    A      8 bars  the matsuri hook (minor pentatonic): a dotted skip G-F-G up to C, a breath, B♭-G
                   (♪. ♬ ♪ ♪ 𝄾 ♪ ♩), call and response with taiko "don-don" in the gaps
    A2     8 bars  the hook with the fue an octave up, climbing through Fm to B♭7 …
    B      8 bars  … the E♭ major chorus: BELL rings out broad and triumphant in long notes (B♭ E♭ C2 | D2. → E♭),
                   then the festival skip climbs (♪. ♬ ♪ ♪~) to G and lands on E♭; brass + choir in the intensity stem
                   (round 2: the old chorus opened like Moonlit's, BELL + answer in the same ♪ ♪ ♩ ♩. rhythm)
    C      8 bars  taiko break: the shamisen plays BELL in C minor (G–C–A♭–B), the fue answers it with C;
                   string runs and double taiko build
    B2     8 bars  the chorus again with a second chip voice a third below (and the fue an octave up),
                   full band; the last bar's G7 drops back into C minor
Form: intro |: A A2 B C B2 :|  — 2 + 40 bars.

Leitmotifs: BELL in C minor (C, shamisen) and in E♭ major, answered (B, B2).
review: originality — hook, chorus, bass lines and patterns are new; BELL is the project's own motif. Checked by
ear-memory against well-known festival/fire/ninja game themes (Okami, Ganbare Goemon, Kirby, Mario, Mega Man,
Undertale/Deltarune, EarthBound/Mother): no shared hook or contour. Composer B, 2026-10-08.
"""
from sakura_audio.song import Song
from motifs import BELL
from _battle_kit import bars, roll, walk

CH_INTRO = 'Cm | G7'
CH_A = 'Cm | Cm | Ab | Bb | Cm | Fm7 | Ab Bb | G7sus4 G7'
CH_A2 = 'Cm | Cm | Ab | Bb | Cm | Fm7 | Ab Bb | Bb7'
CH_B = 'Ebmaj7 | Cm7 | Abmaj7 | Bb7sus4 Bb7 | Gm7 | Cm7 | Fm7 Bb7 | Ebmaj7'
CH_C = 'Cm | Cm | Fm | G7 | Cm | Cm | Ab7 | G7'
CH_B2 = 'Ebmaj7 | Cm7 | Abmaj7 | Bb7sus4 Bb7 | Gm7 | Cm7 | Fm7 Bb7 | Ebmaj7 G7'

HOOK = [
    'g5/8. f5/16 g5/8 c6/8 r/8 bb5/8 g5/4',          # 1 Cm   the dotted festival skip
    'f5/8. eb5/16 f5/8 g5/8~ g5/4 eb5/8 c5/8',       # 2 Cm
    'g5/8. f5/16 g5/8 c6/8 r/8 eb6/8 c6/4',          # 3 A♭
    'd6/8. c6/16 bb5/8 g5/8~ g5/4 r/4',              # 4 B♭   (taiko answers)
]
A_END = [
    'c6/8. bb5/16 g5/8 c6/8~ c6/8 bb5/8 g5/8 f5/8',  # 5 Cm
    'ab5/8. g5/16 f5/8 ab5/8~ ab5/4 c6/4',           # 6 Fm7
    'eb6/4 c6/8 ab5/8 d6/4 bb5/8 f5/8',              # 7 A♭ B♭
    'g5/4. f5/8 b4/8 c5/8 d5/8 f5/8',                # 8 G7sus4 G7
]
A2_END = [
    'c6/8. bb5/16 g5/8 c6/8~ c6/8 eb6/8 f6/8 g6/8',  # 5 Cm   higher
    'f6/8. eb6/16 c6/8 ab5/8~ ab5/4 f5/4',           # 6 Fm7
    'eb5/8 f5/8 ab5/8 bb5/8 c6/8 bb5/8 ab5/8 f5/8',  # 7 A♭ B♭
    'g5/4 ab5/8 g5/8 f5/4 d5/4',                     # 8 B♭7  → E♭
]
CHORUS = [
    'bb5/4 eb6/4 c6/2',                              # 1 E♭maj7  BELL in long notes …
    'd6/2. eb6/8. f6/16',                            # 2 Cm7     … held on D, answered E♭ with the festival skip
    'g6/4. f6/8 eb6/8. f6/16 g6/8 c6/8',             # 3 A♭maj7
    'eb6/4 d6/8. c6/16 bb5/2',                       # 4 B♭7sus4 B♭7
    'bb5/8. c6/16 d6/8 f6/8~ f6/4 d6/8 bb5/8',       # 5 Gm7     the skip climbs …
    'eb6/8. d6/16 eb6/8 g6/8~ g6/2',                 # 6 Cm7     … to G
    'ab6/4 g6/8 f6/8 d6/4 f6/4',                     # 7 Fm7 B♭7
    'eb6/2. r/4',                                    # 8 E♭maj7  home
]
CHORUS2 = CHORUS[:7] + ['eb6/2 d6/4 b5/4']           # 8 E♭maj7 G7 → C minor
HARM_B2 = [   # second chip voice a third under the chorus reprise (the NES two-square sound)
    'g5/4 bb5/4 g5/2',
    'bb5/2. c6/8. d6/16',
    'eb6/4. c6/8 c6/8. d6/16 eb6/8 ab5/8',
    'c6/4 bb5/8. ab5/16 f5/2',
    'g5/8. a5/16 bb5/8 d6/8~ d6/4 bb5/8 g5/8',
    'c6/8. bb5/16 c6/8 eb6/8~ eb6/2',
    'f6/4 eb6/8 c6/8 bb5/4 d6/4',
    'g5/2 b5/4 g5/4',
]
FUE_ANSWER = 'c6/4~ c6/8 bb5/16 c6/16 eb6/8 c6/8 bb5/8 g5/8'
RUN_UP = 'r/2 bb4/16 c5/16 d5/16 eb5/16 f5/16 g5/16 ab5/16 bb5/16'

SKIP = 'R/8 8/8 r/8 R/8 5/8 8/8 7/8 ap/8'
SKIP_H = 'R/8 8/8 5/8 ap/8'
DON = 'c3/8 c3/16 c3/16 g2/8 c3/8 r/8 c3/8 g2/4 |'
KIT = 'k/8 cv/8 s/8 cv/8 k/8 k/8 s/8 cv/8 |'
KIT_C = 'k+c/8 cv/8 s/8 cv/8 k/8 k/8 s/8 cv/8 |'
KIT_F = 'k/8 cv/8 s/8 cv/8 s/16 s s s t1/16 t1 t3/8 |'


def build() -> Song:
    s = Song(id='battle_matsuri', title='Oni Matsuri', bpm=160, meter=(4, 4), key='Cm',
             form=['intro', '|:', 'A', 'A2', 'B', 'C', 'B2', ':|'], mix={'highpass_hz': 40},
             description='Battle (festival, volcano): taiko and shamisen in C minor, a triumphant E♭ chorus with BELL.')
    s.section('intro', 2, CH_INTRO)
    s.section('A', 8, CH_A)
    s.section('A2', 8, CH_A2)
    s.section('B', 8, CH_B)
    s.section('C', 8, CH_C)
    s.section('B2', 8, CH_B2)

    # ================================================================ base
    s.part('lead', 'chip_pulse25', 'base', vel=8, gain=3.5) \
        .at('intro', 2, 'r/2 g5/8 f5/8 eb5/8 f5/8') \
        .notes('A', bars(*HOOK, *A_END)).notes('A2', bars(*HOOK, *A2_END)) \
        .notes('B', bars(*CHORUS), motifs={1: BELL}).notes('B2', bars(*CHORUS2), motifs={1: BELL})
    s.part('fue', 'flute', 'base', vel=-2) \
        .at('intro', 1, 'c6/4 r/8 bb5/16 c6/16 eb6/8 c6/8 r/4') \
        .at('C', 2, FUE_ANSWER).at('C', 6, FUE_ANSWER) \
        .at('C', 4, 'r/2 b5/8 c6/8 d6/8 f6/8').at('C', 8, 'r/2 d6/8 b5/8 g5/8 f5/8')
    s.part('fue_hi', 'flute', 'base', octave=1, vel=-12, gain=-4).double('lead', ['A', 'A2'])          # the hook doubled in A too
    s.part('fue_ch', 'flute', 'base', vel=-16, gain=-3).double('lead', 'B2')
    s.part('harm', 'chip_pulse12', 'base', vel=-6).notes('B2', bars(*HARM_B2))
    s.part('shamisen', 'shamisen', 'base', vel=4) \
        .at('C', 1, BELL.question('Cm', 5) + ' r/8', motif=BELL).at('C', 5, BELL.question('Cm', 5) + ' r/8', motif=BELL) \
        .at('C', 3, "c5/8' c5/8' f5/8' ab5/8' c6/8' ab5/8' f5/8' c5/8'").at('C', 7, "eb5/8' eb5/8' ab5/8' c6/8' eb6/8' c6/8' gb5/8' eb5/8'")
    s.part('sham_comp', 'shamisen', 'base', vel=-16, gain=4).gen(['A', 'A2', 'B', 'B2'], 'comp:offbeat', voicing='triad', low=57, high=72)
    s.part('koto', 'koto', 'base', vel=-12, gain=5).gen(['B', 'B2'], 'arp:up16', voicing='triad', low=67, high=86)
    s.part('bass', 'finger_bass', 'base', vel=6, gain=-2) \
        .notes('intro', "c2/8 c3/8 r/8 c2/8 g2/8 c3/8 bb2/8 b2/8 | g2/8 g3/8 r/8 g2/8 d3/8 g3/8 f3/8 b2/8") \
        .notes('A', walk(CH_A, SKIP, SKIP_H, low=36, nxt='Cm')) \
        .notes('A2', walk(CH_A2, SKIP, SKIP_H, low=36, nxt='Ebmaj7')) \
        .notes('B', walk(CH_B, SKIP, SKIP_H, low=36, nxt='Cm')) \
        .notes('C', walk(CH_C, 'R/8 R/8 r/8 R/8 r/8 R/8 8/8 ap/8', SKIP_H, low=36, nxt='Ebmaj7')) \
        .notes('B2', walk(CH_B2, SKIP, SKIP_H, low=36, nxt='Cm'))
    s.part('taiko', 'taiko', 'base', vel=-8) \
        .notes('intro', roll('c3', '16', 16, 50, 110) + ' | c3/4 r/4 c3/8 c3/8 g2/8 g2/8') \
        .pattern(['A', 'A2', 'B', 'B2'], DON) \
        .pattern('C', 'c3/8 c3/8 g2/8 c3/8 c3/16 c3/16 g2/8 c3/8 g2/8 |', fills={8: roll('c3', '16', 16, 60, 120) + ' |'})
    s.part('kit', 'drums', 'base', vel=-10) \
        .pattern(['A', 'A2', 'B', 'B2'], KIT, fills={1: KIT_C, 4: KIT_F, 5: KIT_C, 8: KIT_F}) \
        .pattern('C', 'k/4 cv/8 cv/8 k/8 cv/8 cv/8 cv/8 |', fills={1: 'k+c/4 cv/8 cv/8 k/8 cv/8 cv/8 cv/8 |'})

    # ================================================================ intensity
    s.part('taiko2', 'taiko', 'intensity', vel=8, gain=-2.5) \
        .pattern(['A', 'A2', 'B', 'B2', 'C'], 'c3/4 r/8 c3/8 r/8 c3/8 c3/4 |')
    s.part('timp', 'timpani', 'intensity', vel=12) \
        .pattern(['A', 'A2'], 'c2/4 r/2. |', fills={4: 'bb1/4 r/2 bb1/8 bb1/8 |', 8: 'g1/4 r/2 g1/8 g1/8 |'}) \
        .pattern(['B', 'B2'], 'eb2/4 r/2. |') \
        .at('C', 8, roll('g1', '16', 16, 50, 116))
    s.part('choir', 'choir_ahh', 'intensity', vel=16).gen(['A', 'A2'], 'comp:stabs', voicing='triad', low=60, high=76) \
        .gen(['B', 'B2'], 'pad:sustain', voicing='triad', low=60, high=77, vel=74)
    s.part('brass', 'brass', 'intensity', vel=18).double('lead', ['B', 'B2'], octave=-1) \
        .gen(['A', 'A2'], 'comp:stabs', voicing='close', low=55, high=70)
    s.part('tpt', 'trumpet', 'intensity', vel=14).double('lead', 'B2')
    s.part('hits', 'orch_hit', 'intensity', vel=14) \
        .at(['A', 'A2'], 4, 'r/2 [bb3 d4 f4]/4 r/4').at('B', 1, '[eb3 g3 bb3 eb4]/4 r/2.').at('B2', 1, '[eb3 g3 bb3 eb4]/4 r/2.') \
        .at('C', 1, '[c3 eb3 g3 c4]/4 r/2.').at('B2', 8, 'r/2 [g3 b3 d4 f4]/4 r/4')
    s.part('runs', 'strings', 'intensity', vel=14) \
        .at('A', 8, 'r/2 g4/16 ab4/16 b4/16 c5/16 d5/16 eb5/16 f5/16 g5/16').at('A2', 8, RUN_UP).at('C', 4, 'r/2 g4/16 a4/16 b4/16 c5/16 d5/16 eb5/16 f5/16 g5/16') \
        .at('C', 8, 'r/2 g4/16 a4/16 b4/16 c5/16 d5/16 f5/16 g5/16 b5/16') \
        .gen('C', 'pad:sustain', voicing='triad', bars=(1, 7), low=55, high=72, vel=60)
    s.part('str_oct', 'strings', 'intensity', octave=-1, vel=12).double('lead', ['A', 'A2'])
    s.part('stabs', 'brass_stab', 'intensity', vel=14).gen(['B', 'B2'], 'comp:stabs', voicing='close', low=58, high=74)
    s.part('noise', 'chip_kit', 'intensity', vel=-26).pattern(['A', 'A2', 'B', 'B2'], '(h/16 h? o/16 h?)x4 |')
    return s


songs = [build()]
