"""'Hold the Line!' — boss battle (Grave Lych, Iron Colossus, challenge bosses). ORIGINAL composition (§4.1 rules).

D minor → F major "hope", 168 bpm, straight. Frantic and driving, then defiant. Starts sample-accurately at the
end of the boss_warning sting (songs/battle_stings.py), so the intro hits from its first beat.
Stems: base (boss phase 1) + intensity (phase 2+: choir, tremolo strings, timpani, orchestra hits, horn BELL).
    intro  4 bars  SHADOW (D–E♭–D–A♭–F) in trombone, tuba and organ; chip arpeggios spin up; A7♭9 hits
    A      8 bars  the MAIN THEME turned into D minor (BELL minor A–D–B♭–C♯ → D …), chip lead over 16th chip
                   arpeggios, slap-bass eighth-note pump, double-kick power kit
    A2     8 bars  again, the second half breaks into falling eighth-note cascades; the horn sings BELL in long
                   notes underneath (intensity)
    B      8 bars  SHADOW vs BELL: the monsters' motif in the low brass, the bell answers on top; then both at
                   once — and the bell's answer gets infected by SHADOW's chromatic neighbour (D–E♭–D–C♯)
    C      8 bars  HOPE: the main theme bars 9-14 heroic in F (D♭ – E♭ – F lift, brass + choir), then BELL
                   rings out answered (C–F–D–E → F) — the girls hold the line …
    D      8 bars  … and push back: slap-bass breaks trade with chip 16th runs, a unison climb to A7
    T      4 bars  SHADOW returns under a falling line, A7♭9 drops into the frantic theme again
Form: intro |: A A2 B C D T :|  — 4 + 44 bars (62.9 s loop; intro + 2 render cycles stay under 134 s).

Leitmotifs: SHADOW (intro, B, T), main theme (A frantic minor, C heroic), BELL (A/A2 inside the theme, B, C
answered, horn in A2).
review: originality — the minor/heroic settings, counterpoint, bass lines, runs and arrangement are new; the
melodic material is the project's own main theme, BELL and SHADOW. No Megalovania-style opening (repeated root +
octave leap + descending chromatic run) anywhere; checked by ear-memory against Undertale/Deltarune boss themes,
EarthBound/Mother battle themes, Mega Man/Castlevania/FF boss themes: no shared hook or contour. Composer B, 2026-10-08.
"""
from sakura_audio.song import Song
from motifs import BELL, SHADOW
from _battle_kit import bars, roll, walk, MAIN_B

CH_INTRO = 'Dm | Dm | Bb | A7b9'
CH_A = 'Bb A7 | Dm A7b9 | Gm9 A7 | Bbmaj7 A7sus4 | Bb A7 | Bb A7 | Em7b5 Gm6 | A7sus4 A7b9'
CH_A2 = 'Bb A7b9 | Dm A7b9 | Gm9 A7 | Bbmaj7 A7sus4 | Bb A7b9 | Bb A7 | Gm A7 | Dm'
CH_B = 'Dm | Dm | Gm | A7b9 | Dm | Dm | Bb | A7b9'
CH_C = 'Dbmaj7 | Ebmaj9 | Fmaj7 F7/A | Bbmaj7 Bdim7 | F/C D7 | Gm7 C7 | F | Dm/F A7b9'
CH_D = 'Dm | Dm | Bb | A7b9 | Dm | Dm | Bb C7 | A7b9'
CH_T = 'Dm | Bb | Gm6 | A7b9'

FRANTIC = [   # the main theme (§4.3 bars 1-8) mapped onto D harmonic minor, chip-lead octave
    'a5/8 d6/8 bb5/4 c#6/4. d6/8',           # 1 ⟨BELL minor⟩
    'f6/4 e6/8 d6/8 c#6/4 bb5/4',            # 2
    'a5/8 d6/8 bb5/4 c#6/8 d6/8 e6/4',       # 3 ⟨BELL minor⟩
    'f6/4. e6/8 a5/2',                       # 4
    'a5/8 d6/8 bb5/4 c#6/4 a6/4',            # 5 ⟨BELL minor⟩, the leap
    'f6/8 g6/8 f6/8 d6/8 e6/4 c#6/4',        # 6
    'e6/4 g6/8 f6/8 e6/8 d6/8 bb5/4',        # 7
    'a5/4. bb5/8 c#6/4 e6/4',                # 8
]
FRANTIC2_END = [
    'a5/8 d6/8 bb5/4 c#6/4 a6/4',            # 5
    'bb6/8 a6/8 g6/8 f6/8 e6/8 d6/8 c#6/8 a5/8',   # 6 cascade
    'g6/8 f6/8 e6/8 d6/8 c#6/8 bb5/8 a5/8 g5/8',   # 7 cascade
    'f5/8 a5/8 d6/8 f6/8 a6/4 r/4',          # 8 Dm
]
B_LEAD = [
    'r/1',                                   # 1 Dm     (SHADOW below)
    BELL.question('Dm', 6) + ' r/8',         # 2 Dm     BELL answers on top
    'r/1',                                   # 3 Gm     (SHADOW on G)
    BELL.question('Dm', 6) + ' r/8',         # 4 A7♭9
    BELL.question('Dm', 6) + ' r/8',         # 5 Dm     both motifs at once
    'd6/4 eb6/4 d6/4 c#6/4',                 # 6 Dm     … the answer, infected by SHADOW
    BELL.question('Bb', 5) + ' r/8',         # 7 B♭
    'bb5/4 a5/4 g5/4 e5/4',                  # 8 A7
]
HOPE = MAIN_B[:6] + [
    'c6/8 f6/8 d6/4 e6/4. f6/8~',            # 7 F      BELL answered (tied over the bar)
    'f6/2 e6/4 c#6/4',                       # 8 Dm/F A7♭9 → back to the fight
]
D_LEAD = ['r/1', 'r/1',
          'f6/16 d6/16 bb5/16 f5/16 bb5/16 d6/16 f6/16 bb6/16 a6/16 f6/16 d6/16 bb5/16 d6/16 f6/16 a6/16 bb6/16',
          'a6/16 g6/16 e6/16 c#6/16 a5/16 c#6/16 e6/16 g6/16 bb6/4 a6/4',
          'r/1', 'r/1',
          'bb5/8 c6/8 d6/8 e6/8 f6/8 g6/8 a6/8 bb6/8',
          'a6/4. g6/8 f6/8 e6/8 c#6/8 a5/8']
D_BASS = ['d2/16 d3/16 r/16 d2/16 f2/16 g2/16 ab2/16 a2/16 c3/16 d3/16 r/16 c3/16 a2/16 g2/16 f2/16 d2/16',
          'd2/8 d3/8 r/16 d2/16 eb2/16 e2/16 f2/8 f#2/8 g2/8 ab2/8',
          'bb1/8 bb2/8 bb1/8 bb2/8 f2/8 bb2/8 a2/8 b1/8',
          'a1/8 a2/8 a1/8 a2/8 e2/8 g2/8 bb2/8 c#2/8',
          'd2/16 d3/16 r/16 d2/16 f2/16 g2/16 ab2/16 a2/16 c3/16 d3/16 r/16 c3/16 d3/16 f3/16 d3/16 c3/16',
          'd2/8 d3/8 r/16 d2/16 eb2/16 e2/16 f2/8 f#2/8 g2/8 ab2/8',
          'bb1/8 c2/8 d2/8 e2/8 f2/8 g2/8 a2/8 bb2/8',
          'a2/4. g2/8 f2/8 e2/8 c#2/8 a1/8']
T_LEAD = ['r/1', 'd6/2 c6/4 bb5/4', 'e5/2 g5/4 bb5/4', 'a5/4 bb5/4 c#6/4 e6/4']

HORN_BELL = 'a4/4 d5/4 bb4/2 | c#5/4 r/2.'             # BELL minor in augmentation
PUMP = 'R/8 R/8 8/8 R/8 5/8 R/8 8/8 ap/8'
PUMP_H = 'R/8 8/8 R/8 ap/8'
DRIVE = 'k+h/8 k/16 k/16 s+h/8 h/8 k+h/8 k/16 k/16 s+h/8 h/8 |'
DRIVE_C = 'k+c/8 k/16 k/16 s+h/8 h/8 k+h/8 k/16 k/16 s+h/8 h/8 |'
DRIVE_F4 = 'k+h/8 k/16 k/16 s+h/8 h/8 s/16 s s s t1/16 t1 t3/16 t3 |'
DRIVE_F8 = 'k+h/8 s/16 s s/16 s t1/16 t1 t2/16 t2 t3/16 t3 s/16 s s s |'


def build() -> Song:
    s = Song(id='boss', title='Hold the Line!', bpm=168, meter=(4, 4), key='Dm',
             form=['intro', '|:', 'A', 'A2', 'B', 'C', 'D', 'T', ':|'],
             mix={'echo': {'delay_ms': 176, 'feedback': 0.38, 'volume': 0.26, 'fir': 'soft'}, 'highpass_hz': 40},
             description='Boss: the main theme frantic in D minor, SHADOW vs BELL, a heroic F-major "hope", bass breaks.')
    s.section('intro', 4, CH_INTRO)
    s.section('A', 8, CH_A)
    s.section('A2', 8, CH_A2)
    s.section('B', 8, CH_B)
    s.section('C', 8, CH_C)
    s.section('D', 8, CH_D)
    s.section('T', 4, CH_T)

    shadow_d = SHADOW.question('Dm', 3) + ' r/8'                  # d3 e♭3 d3 a♭3 f3
    # ================================================================ base (phase 1)
    s.part('lead', 'chip_pulse25', 'base', vel=12, gain=1) \
        .at('intro', 4, "r/2 a5/16 bb5/16 c#6/16 d6/16 e6/8' r/8") \
        .notes('A', bars(*FRANTIC), motifs={1: BELL, 3: BELL, 5: BELL}) \
        .notes('A2', bars(*FRANTIC[:4], *FRANTIC2_END), motifs={1: BELL, 3: BELL, 5: BELL}) \
        .notes('B', bars(*B_LEAD), motifs={2: BELL, 4: BELL, 5: BELL, 7: BELL}) \
        .notes('C', bars(*HOPE), motifs={7: BELL}) \
        .notes('D', bars(*D_LEAD)).notes('T', bars(*T_LEAD))
    s.part('glock', 'glock', 'base', octave=1, vel=-20).double('lead', ['B', 'C'])
    s.part('arps', 'chip_pulse12', 'base', vel=-14).gen(['A', 'A2'], 'arp:up16', voicing='triad', low=62, high=81) \
        .gen('intro', 'arp:up16', voicing='triad', bars=(2, 4), low=62, high=81) \
        .gen('D', 'arp:up16', voicing='triad', bars=(3, 4), low=62, high=81)
    s.part('organ', 'organ_drawbar', 'base', vel=-6) \
        .notes('intro', bars(shadow_d, 'd3/1', tr_shadow(-4), 'a2/2. r/4'), motifs={1: SHADOW, 3: SHADOW}) \
        .gen(['A', 'A2', 'D'], 'comp:stabs', voicing='triad', low=55, high=70) \
        .gen(['B', 'T'], 'pad:sustain', voicing='triad', low=55, high=70, vel=64) \
        .gen('C', 'comp:charleston', voicing='triad', low=55, high=72)
    s.part('bone', 'trombone', 'base', vel=4) \
        .notes('intro', bars(shadow_d, 'r/1', tr_shadow(-4), "[a2 e3]/4 r/8 [a2 e3]/8' r/4 [a2 c#3]/4")) \
        .at('B', 1, shadow_d, motif=SHADOW).at('B', 3, tr_shadow(5), motif=SHADOW) \
        .at('B', 5, shadow_d, motif=SHADOW).at('T', 1, shadow_d, motif=SHADOW) \
        .gen(['A', 'A2'], 'pad:sustain', voicing='triad', low=43, high=57, vel=62)
    s.part('tuba', 'tuba', 'base', octave=-1, vel=-2).double('bone', ['intro', 'B', 'T'])
    s.part('bass', 'slap_bass', 'base', vel=8) \
        .notes('intro', bars('d2/8 d2/8 d3/8 d2/8 r/2', 'd2/8 d2/8 d3/8 d2/8 f2/8 g2/8 ab2/8 a2/8',
                             'bb1/8 bb1/8 bb2/8 bb1/8 r/2', "a1/4 r/8 a1/8' r/4 c#2/4")) \
        .notes('A', walk(CH_A, PUMP, PUMP_H, low=38, nxt='Bb')) \
        .notes('A2', walk(CH_A2, PUMP, PUMP_H, low=38, nxt='Dm')) \
        .notes('B', bars('d2/8 d2/8 d3/8 d2/8 d2/8 d2/8 d3/8 d2/8', 'd2/8 d2/8 d3/8 d2/8 f2/8 e2/8 eb2/8 d2/8',
                         'g1/8 g1/8 g2/8 g1/8 g1/8 g1/8 g2/8 g#1/8', 'a1/8 a1/8 a2/8 a1/8 g2/8 e2/8 c#2/8 a1/8',
                         SHADOW.question('Dm', 2) + ' r/8', 'd2/8 d2/8 d3/8 d2/8 f2/8 e2/8 eb2/8 d2/8',
                         'bb1/8 bb1/8 bb2/8 bb1/8 f2/8 bb2/8 a2/8 b1/8', 'a1/8 a1/8 a2/8 a1/8 g2/8 e2/8 c#2/8 a1/8'),
               motifs={5: SHADOW}) \
        .notes('C', walk(CH_C, 'R/8 8/8 r/8 R/8 5/8 8/8 7/8 ap/8', 'R/8 8/8 5/8 ap/8', low=38, nxt='Dm')) \
        .notes('D', bars(*D_BASS)) \
        .notes('T', walk(CH_T, PUMP, PUMP_H, low=38, nxt='Bb'))
    s.part('kit', 'drums_power', 'base', vel=-2) \
        .notes('intro', bars('k+c/4 r/2.', 'k/8 k/8 s/8 k/8 k/8 k/8 s/8 s/8', 'k+c/4 r/2.',
                             "k+c/4 r/8 k/8 r/4 " + roll('s', '16', 4, 80, 116))) \
        .pattern(['A', 'A2', 'C'], DRIVE, fills={1: DRIVE_C, 4: DRIVE_F4, 5: DRIVE_C, 8: DRIVE_F8}) \
        .pattern('B', 'k+h/8 h/8 h/8 k+h/8 s+h/8 h/8 h/8 h/8 |', fills={1: 'k+c/8 h/8 h/8 k+h/8 s+h/8 h/8 h/8 h/8 |',
                                                                        5: 'k+c/8 h/8 h/8 k+h/8 s+h/8 h/8 h/8 h/8 |', 8: DRIVE_F8}) \
        .pattern('D', DRIVE, fills={1: DRIVE_C, 5: DRIVE_C, 8: DRIVE_F8}) \
        .pattern('T', DRIVE, fills={1: DRIVE_C, 4: roll('s', '16', 16, 64, 120) + ' |'})
    s.part('chip_hats', 'chip_kit', 'base', vel=-30).pattern(['A', 'A2', 'C', 'D'], '(h/16 h? h h?)x4 |')

    # ================================================================ intensity (phase 2+)
    s.part('horn', 'horn', 'intensity', vel=20, gain=-2.5) \
        .at('A2', 1, HORN_BELL, motif=BELL) \
        .at('A2', 5, bars('f4/2 e4/2', 'd4/2 c#4/2', 'd5/2 c#5/2', 'd5/1')) \
        .double('lead', 'C', octave=-1)
    s.part('choir', 'choir_ahh', 'intensity', vel=20).gen(['A', 'A2'], 'pad:sustain', voicing='triad', low=50, high=65, vel=70) \
        .gen('C', 'pad:sustain', voicing='triad', low=53, high=68, vel=80)
    s.part('trem', 'tremolo', 'intensity', vel=20).gen(['B', 'D', 'T', 'intro'], 'pad:sustain', voicing='triad', low=50, high=69, vel=76)
    s.part('brass', 'brass', 'intensity', vel=12).double('lead', 'C', octave=-1) \
        .gen(['A', 'A2', 'D'], 'comp:stabs', voicing='close', low=55, high=72)
    s.part('timp', 'timpani', 'intensity', vel=10) \
        .pattern(['A', 'A2'], 'd2/4 r/4 a1/4 r/4 |', fills={4: 'd2/8 d2/8 a1/8 a1/8 d2/16 d2 d2 d2 a1/8 a1/8 |',
                                                         8: roll('a1', '16', 16, 50, 116) + ' |'}) \
        .at('B', 4, roll('a1', '16', 16, 50, 116)).at('B', 8, roll('a1', '16', 16, 50, 116)) \
        .at('C', 1, 'db2/4 r/2.').at('C', 2, 'eb2/4 r/2.').at('C', 3, 'f2/4 r/2.') \
        .at('T', 4, roll('a1', '16', 16, 50, 120))
    s.part('hits', 'orch_hit', 'intensity', vel=12) \
        .at('A', 4, 'r/2 [a3 c#4 e4 g4]/4 r/4').at('A', 8, 'r/2 [a3 c#4 e4 g4]/4 r/4') \
        .at('B', 1, '[d3 f3 a3 d4]/4 r/2.').at('C', 1, '[db3 f3 ab3 db4]/4 r/2.').at('C', 3, '[f3 a3 c4 f4]/4 r/2.') \
        .at('D', 4, 'r/2 [a3 c#4 e4 g4]/4 r/4').at('D', 8, 'r/2 [a3 c#4 e4 g4]/4 r/4')
    s.part('str_oct', 'strings', 'intensity', octave=-1, vel=12).double('lead', ['A', 'A2', 'D'])
    s.part('arp32', 'chip_pulse50', 'intensity', vel=-16).gen('C', 'chip:arp32', voicing='triad', low=72, high=88)
    s.part('kit2', 'drums', 'intensity', vel=-4) \
        .pattern(['A', 'A2', 'C', 'D'], 'h/16 h? o/16 h? cl+h h? o/16 h? h h? o/16 h? cl+h h? o/16 h? |')
    return s


def tr_shadow(semis: int) -> str:
    """SHADOW in D minor moved by `semis` semitones (octave 3)."""
    from _battle_kit import tr
    return tr(SHADOW.question('Dm', 3), semis) + ' r/8'


songs = [build()]
