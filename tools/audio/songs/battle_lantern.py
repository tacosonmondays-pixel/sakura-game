"""'Lantern Hush' — battle family 3 (shrine + marsh maps). ORIGINAL composition (docs/AUDIO.md §4.1 rules).

E minor with Phrygian colour (the Japanese "in" scale E F A B C), 112 bpm. Spooky-cute: lantern light, ghosts, frogs.
Stems: base (build phase) + intensity (wave active).
    intro  2 bars  woodblock tick-tock, pizzicato bass tiptoes in, a ghostly choir breath
    A      8 bars  the koto tiptoe tune: staccato steps up the in-scale to a held B, a little 16th shiver, then a
                   sigh down to E; frog "ribbits" (chip pluck) answer in the gaps; F → Em Phrygian cadence
    B      8 bars  call and response: the koto rings BELL in its Phrygian form (B–E–C–D), a detuned music box
                   answers with BELL turned upside down (B–F–A–G: the tritone ghost); then a warmer climb in E
                   minor to B7
    A2     8 bars  the tiptoe tune again, a new rising second half (shakuhachi doubles it in the intensity stem)
    C      4 bars  hush: SHADOW creeps through the pizzicato bass (E–F–E–B♭–G), only the music box and
                   the choir remain, then the F → Em cadence opens the loop again
Form: intro |: A B A2 C :|  — 2 + 28 bars (60 s; intro + 2 render cycles stay under 134 s).

Leitmotifs: BELL (Phrygian, koto) and BELL inverted (music box), SHADOW hints (bass, C).
review: originality — every melody, bass line and pattern here is new; only the project's BELL / SHADOW motifs
are reused. Checked by ear-memory against well-known spooky/shrine game themes (Luigi's Mansion, Ghost House,
Okami, Undertale/Deltarune, EarthBound/Mother, Zelda shrine/temple themes): no shared hook or contour.
Composer B, 2026-10-08.
"""
from sakura_audio.song import Song
from motifs import BELL, SHADOW
from _battle_kit import bars, roll, walk

CH_INTRO = 'Em | Fmaj7'
CH_A = 'Em | Fmaj7 | Em | Dm7 | Am7 | Fmaj7 | Em7 Dm7 | Fmaj7 Em'
CH_B = 'Am7 | Em | Am7 | Em | Cmaj7 | Bm7 | Am7 | B7sus4 B7'
CH_C = 'Em | Fmaj7 | Em | Fmaj7'

TIPTOE = [
    "e5/8' f5/8' a5/8' b5/8~ b5/4 r/8 a5/16 b5/16",    # 1 Em     tiptoe up the in-scale, hold, shiver
    'c6/8 b5/8 a5/8 f5/8 e5/4 r/4',                    # 2 Fmaj7  sigh down (frog answers)
    "e5/8' f5/8' a5/8' b5/8~ b5/4 r/8 c6/16 b5/16",    # 3 Em
    'a5/8 f5/8 e5/8 d5/8 e5/4 r/4',                    # 4 Dm7
]
A_END = [
    'e6/8 d6/8 c6/8 a5/8 b5/4. a5/8',                  # 5 Am7
    'f5/8 a5/8 c6/8 e6/8~ e6/4 d6/8 c6/8',             # 6 Fmaj7
    'b5/8 a5/8 f5/8 e5/8 f5/4 a5/4',                   # 7 Em7 Dm7
    'f5/4. e5/8~ e5/2',                                # 8 Fmaj7 Em  (Phrygian cadence)
]
A2_END = [
    'e6/8 d6/8 c6/8 a5/8 b5/8 c6/8 e6/8 f6/8',         # 5 Am7    rising this time
    'e6/4 c6/8 a5/8 f5/4 e5/8 f5/8',                   # 6 Fmaj7
    'b5/8 a5/8 f5/8 e5/8 d5/4 f5/4',                   # 7 Em7 Dm7
    'e5/4 f5/8 e5/8~ e5/2',                            # 8 Fmaj7 Em
]
B_KOTO = [
    BELL.question('E phrygian', 5) + ' r/8',           # 1 Am7    BELL, Phrygian (B–E–C–D)
    'r/1',                                             # 2 Em     (music box answers)
    BELL.question('E phrygian', 5) + ' r/8',           # 3 Am7
    'r/1',                                             # 4 Em
    'e5/8 g5/8 b5/8 c6/8~ c6/4 b5/8 g5/8',             # 5 Cmaj7  the warmer climb
    'a5/8 f#5/8 d5/8 b4/8~ b4/4 r/4',                  # 6 Bm7
    'c6/8 b5/8 a5/8 e5/8 g5/4. a5/8',                  # 7 Am7
    'b5/4 a5/8 e5/8 d#5/2',                            # 8 B7sus4 B7
]
GHOST = "b5/8* f5/8* a5/4* g5/4.* r/8"                   # BELL inverted (diatonic): the tritone B–F, wobbling
RIBBIT = 'r/2 b5/32 e6/32 r/16 b5/32 e6/32 r/16 r/4'

TIPTOE_BASS = "R/8' r/8 5/8' r/8 R/8' r/8 7/8' ap/8'"
HALF_BASS = "R/8' r/8 5/8' r/8"
TICK = 'k/8 r/8 rs/8 r/8 k/8 k?/8 rs/8 r/8 |'
TICK_F = "k/8 r/8 rs/8 r/8 rs/16 rs?/16 rs/16 rs/16 t1/8 t3/8 |"


def build() -> Song:
    s = Song(id='battle_lantern', title='Lantern Hush', bpm=112, meter=(4, 4), key='E phrygian',
             form=['intro', '|:', 'A', 'B', 'A2', 'C', ':|'],
             mix={'echo': {'delay_ms': 240, 'feedback': 0.48, 'volume': 0.32, 'fir': 'soft'}, 'highpass_hz': 40},
             description='Battle (shrine, marsh): spooky-cute koto tiptoe in E Phrygian, BELL and its upside-down ghost.')
    s.section('intro', 2, CH_INTRO)
    s.section('A', 8, CH_A)
    s.section('B', 8, CH_B)
    s.section('A2', 8, CH_A)
    s.section('C', 4, CH_C)

    # ================================================================ base
    s.part('koto', 'koto', 'base', vel=16) \
        .notes('A', bars(*TIPTOE, *A_END)).notes('B', bars(*B_KOTO), motifs={1: BELL, 3: BELL}) \
        .notes('A2', bars(*TIPTOE, *A2_END))
    s.part('box', 'music_box', 'base', vel=-4) \
        .at('B', 2, GHOST, motif=BELL).at('B', 4, "b5/8* f5/8* a5/4* b5/4.* r/8") \
        .notes('C', bars(GHOST, 'r/1', BELL.question('E phrygian', 6) + ' r/8', 'r/1'))
    s.part('frog', 'chip_pluck', 'base', vel=-10).at(['A', 'A2'], 2, RIBBIT).at(['A', 'A2'], 4, RIBBIT)
    s.part('shamisen', 'shamisen', 'base', vel=-14).gen(['A', 'B', 'A2'], 'comp:offbeat', voicing='triad', low=57, high=72)
    s.part('choir', 'choir_ooh', 'base').gen(['intro', 'A', 'B', 'A2', 'C'], 'pad:sustain', voicing='triad', low=52, high=67, vel=50)
    s.part('bass', 'upright_bass', 'base', vel=12) \
        .notes('intro', "e2/8' r/8 b2/8' r/8 e2/8' r/8 b2/8' r/8 | f2/8' r/8 c3/8' r/8 f2/8' r/8 e2/8' d#2/8'") \
        .notes('A', walk(CH_A, TIPTOE_BASS, HALF_BASS, low=40, nxt='Am7')) \
        .notes('B', walk(CH_B, TIPTOE_BASS, HALF_BASS, low=40, nxt='Em')) \
        .notes('A2', walk(CH_A, TIPTOE_BASS, HALF_BASS, low=40, nxt='Em')) \
        .notes('C', bars(SHADOW.question('E', 2) + ' r/8', "f2/2 c3/4 r/4", SHADOW.question('E', 2) + ' r/8', "f2/2 c3/4 d#2/4"),
               motifs={1: SHADOW, 3: SHADOW})
    s.part('block', 'woodblock', 'base', vel=-6) \
        .pattern(['intro', 'A', 'B', 'A2'], "c5/8' r/8 g4/8' r/8 c5/8' r/8 g4/8' r/8 |") \
        .pattern('C', "c5/4' r/4 g4/4' r/4 |")
    s.part('kit', 'drums', 'base', vel=-10) \
        .pattern(['A', 'B', 'A2'], TICK, fills={4: TICK_F, 8: TICK_F})

    # ================================================================ intensity
    s.part('shaku', 'shakuhachi', 'intensity', vel=-12).double('koto', ['A2', 'B']) \
        .notes('A', bars('b4/1', 'c5/1', 'b4/1', 'a4/1', 'e5/1', 'c5/1', 'b4/2 a4/2', 'a4/2 b4/2'))
    s.part('taiko', 'taiko', 'intensity', vel=-12) \
        .pattern(['A', 'A2'], 'c3/4 r/8 c3/8 c3/4 g2/8 g2/8 |') \
        .pattern('B', 'c3/4 r/8 c3/8 c3/4 g2/8 g2/8 |', fills={8: 'c3/8 c3/8 g2/8 g2/8 ' + roll('c3', '16', 8, 60, 118) + ' |'}) \
        .at('C', 4, roll('g2', '16', 16, 30, 100))
    s.part('noise', 'chip_kit', 'intensity', vel=-24).pattern(['A', 'B', 'A2'], '(h/16 h? o/16 h?)x4 |')
    s.part('brass', 'trombone', 'intensity', vel=-14).gen(['A', 'A2'], 'pad:sustain', voicing='triad', low=48, high=62, vel=62) \
        .gen('B', 'pad:sustain', voicing='triad', bars=(5, 8), low=50, high=64, vel=66)
    s.part('horn', 'horn', 'intensity', vel=-4).at('B', 1, bars('e4/1', 'b3/1', 'e4/1', 'b3/2 g3/2'))
    s.part('sbass', 'synth_bass', 'intensity', vel=-14).double('bass', ['A', 'B', 'A2'])
    s.part('kitx', 'drums', 'intensity', vel=-10) \
        .pattern(['A', 'B', 'A2'], 'r/4 s/4 r/8 k/8 s/4 |', fills={8: 'r/4 s/4 s/16 s s s t1/8 t3/8 |'})
    return s


songs = [build()]
