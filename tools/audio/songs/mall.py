"""'Sakura Mall' — the mall / shop. ORIGINAL composition (docs/AUDIO.md §4.1 rules, §4.4 track list).

G major, 108 bpm, 4/4 bossa-funk. Cheeky window-shopping fun: steel drum lead, slap bass, e-piano bossa
comping, vibes, organ stabs, chip "cha-ching" answers, bossa kit + shaker (+ congas in the bridge).
    intro  1 bar   a ii–V pickup: drum fill, slap bass walk-up, steel drum run
    A      8 bars  the hook: a staccato "b–a–b–d … b–a–g" figure on Gmaj9 answered by a bluesy B♭ on C9, the
                   chip pulse answers with a "cha-ching" arpeggio; then a falling three-step sequence and the
                   steel drum's Sakura Bell question (D5–G5–E5–F♯5) as the fill in bar 8
    B      8 bars  bridge in B♭: the vibes sing a smooth new tune over B♭maj7 – Gm7 – Cm7 – F7, congas join;
                   a ii–V in G brings the hook back
    A2     8 bars  the hook again with the chip pulse doubling and organ stabs; bar 8 rings the Bell question
                   once more and the loop's first downbeat answers it (G5 under the steel drum's B5)
Form: intro |: A B A2 :|  — 1 + 24 bars.

review: originality — new hook, bridge tune and bass lines; the BELL motif is the project's own. Checked
against well-known shop / mall themes (Animal Crossing Nook's Cranny, Wii Shop Channel, Undertale/Deltarune
shops, EarthBound department store, Pokémon Mart, Persona velvet/shop tracks): no shared hook or contour.
Composer A, 2026-10-08.
"""
from sakura_audio.song import Song
from motifs import BELL
from _home import bars

CH_INTRO = 'Am7 D7'
CH_A = 'Gmaj9 | C9 | Gmaj9 | C9 | Bm7 E7b9 | Am7 D7 | Gmaj7 Bbdim7 | Am7 D7'
CH_B = 'Bbmaj7 | Gm7 | Cm7 | F7 | Dm7 G7b9 | Cm7 F7 | Bbmaj7 Ebmaj7 | Am7 D7'

Q = BELL.question('G', 5) + ' r/8'            # d5/8 g5/8 e5/4 f#5/4. r/8
HOOK = [
    '[g5 b5]/8 r/16 a5/16 b5/8 d6/8 r/8 b5/8 a5/8 g5/8',    # G5 under B5 on the downbeat = the Bell's answer
    'bb5/8 r/16 a5/16 g5/8 e5/8~ e5/4 r/4',
    'b5/8 r/16 a5/16 b5/8 d6/8 r/8 e6/8 d6/8 b5/8',
    'c6/8 r/16 bb5/16 a5/8 g5/8~ g5/4 r/4',
]
FALL = [                                       # falling three-step sequence
    'f#5/8 a5/8 d6/8 c#6/8 r/8 b5/8 g#5/8 f5/8',
    'e5/8 a5/8 c6/8 b5/8 r/8 a5/8 f#5/8 c5/8',
    'd5/8 g5/8 b5/8 a5/8 r/8 g5/8 e5/8 db5/8',
]
FALL2 = [
    'f#5/16 g5/16 a5/8 d6/8 c#6/8 r/8 b5/8 g#5/8 f5/8',
    'e5/16 g5/16 a5/8 c6/8 b5/8 r/8 a5/8 f#5/8 c5/8',
    'd5/16 f#5/16 g5/8 b5/8 a5/8 r/8 g5/8 e5/8 db5/8',
]
BRIDGE = [
    'd5/4. f5/8 a5/4 g5/4',
    'f5/4. d5/8 bb4/2',
    'eb5/4. g5/8 bb5/4 a5/4',
    'g5/4. eb5/8 c5/2',
    'f5/8 a5/8 c6/8 a5/8 ab5/8 f5/8 d5/8 b4/8',
    'c5/8 eb5/8 g5/8 bb5/8 a5/8 f5/8 eb5/8 c5/8',
    'd5/4 f5/4 g5/4 bb5/4',
    'a5/4. g5/8 f#5/4 c6/4',
]
CHACHING = 'r/2 c6/16 r/16 g6/32 c7/32 e7/32 g7/32 r/4'      # chip "cha-ching" answer over C9

SLAP_A = [
    'g1/8. g2/16 r/8 d2/8 g1/8 r/16 g2/16 a2/8 b2/8',
    'c2/8. c3/16 r/8 g2/8 c2/8 r/16 c3/16 a2/8 f#2/8',
    'g1/8. g2/16 r/8 d2/8 g1/8 r/16 g2/16 a2/8 b2/8',
    'c2/8. c3/16 r/8 g2/8 c2/8 r/16 c3/16 a2/8 f#2/8',
    'b1/8. b2/16 r/8 f#2/8 e2/8. e3/16 r/8 g#2/8',
    'a1/8. a2/16 r/8 e2/8 d2/8. d3/16 r/8 f#2/8',
    'g1/8. g2/16 r/8 d2/8 bb1/8. bb2/16 r/8 db2/8',
]
SLAP_A_TO_B = 'a1/8. a2/16 r/8 e2/8 d2/8 d3/16 c3/16 b2/8 a2/8'      # → B♭
SLAP_A_TO_A = 'a1/8. a2/16 r/8 e2/8 d2/8 d3/16 c3/16 a2/8 f#2/8'     # → G

BOSSA = 'k+h/8 h?/8 h/8 k+h/8 k+h/8 h?/8 h/8 k+h/8 |'
CLAVE = 'rs/8 r/8 r/8 rs/8 r/8 r/8 rs/8 r/8 | r/8 r/8 rs/8 r/8 r/8 rs/8 r/8 r/8 |'    # bossa 3-2 clave on the rim
FILL = 'k+h/8 h/8 rs+h/8 k+h/8 s/16 s? s s? t1/16 t1 t2 t3 |'


def build() -> Song:
    s = Song(id='mall', title='Sakura Mall', bpm=108, meter=(4, 4), key='G',
             form=['intro', '|:', 'A', 'B', 'A2', ':|'],
             mix={'echo': {'delay_ms': 176, 'feedback': 0.34, 'volume': 0.24, 'fir': 'soft'}},
             description='Mall / shop: cheeky bossa-funk with a steel drum lead; the Bell is the bar-8 fill.')
    s.section('intro', 1, CH_INTRO)
    s.section('A', 8, CH_A)
    s.section('B', 8, CH_B)
    s.section('A2', 8, CH_A)

    tune_a = HOOK + FALL + [Q]
    tune_a2 = HOOK + FALL2 + [Q]
    s.part('steel', 'steel_drum', 'full', vel=-2, gain=2).notes('intro', 'r/2 d5/16 e5/16 f#5/8 a5/8 c6/8') \
        .notes('A', bars(*tune_a), motifs={8: BELL}).notes('A2', bars(*tune_a2), motifs={8: BELL})
    s.part('chip', 'chip_pulse50', 'full', vel=-26).double('steel', 'A2')
    s.part('chip_a', 'chip_pulse50', 'full', vel=-36).double('steel', 'A')
    s.part('chaching', 'chip_pulse25', 'full', vel=-18).at('A', 2, CHACHING).at('A', 4, CHACHING) \
        .at('A2', 2, CHACHING).at('A2', 4, CHACHING)
    s.part('vibes', 'vibes', 'full', vel=-14).notes('B', bars(*BRIDGE))
    s.part('vibes_box', 'music_box', 'full', octave=1, vel=-20).double('vibes', 'B')

    s.part('slap', 'slap_bass', 'full', vel=-24, octave=1, gain=2.5).notes('intro', SLAP_A_TO_A) \
        .notes('A', bars(*SLAP_A, SLAP_A_TO_B)).notes('A2', bars(*SLAP_A, SLAP_A_TO_A)) \
        .gen('B', 'bass:walking', low=29, high=43)
    s.part('ep', 'epiano', 'full', vel=-6, gain=-2.5).gen(['A', 'B', 'A2'], 'comp:bossa', voicing='rootless', low=55, high=72, vel=80)
    s.part('organ', 'organ', 'full', vel=-10).gen('A2', 'comp:stabs', voicing='rootless', low=60, high=76, vel=70)
    s.part('pad', 'strings_slow', 'full').gen(['A', 'B', 'A2'], 'pad:sustain', low=55, high=70, vel=54)

    s.part('kit', 'drums', 'full', vel=-18).notes('intro', 'k+rs/8 rs/8 r/8 k/8 s/16 s? s s? t1/16 t1 t2 t3') \
        .pattern('A', BOSSA, fills={1: 'k+c/8 h?/8 h/8 k+h/8 k+h/8 h?/8 h/8 k+h/8 |', 8: FILL}) \
        .pattern('B', BOSSA, fills={8: FILL}) \
        .pattern('A2', BOSSA, fills={1: 'k+c/8 h?/8 h/8 k+h/8 k+h/8 h?/8 h/8 k+h/8 |', 4: FILL, 8: FILL})
    s.part('clave', 'drums', 'full', vel=-36).pattern(['A', 'B', 'A2'], CLAVE)
    s.part('perc', 'drums', 'full', vel=-30).pattern(['A', 'A2'], '(sh/16 sh? sh sh?)x4 |') \
        .pattern('B', 'cg/8 cg?/16 cg?/16 r/8 cg/8 bg/8 bg?/8 cg/8 cg?/8 |')
    return s


songs = [build()]
