"""'Moonlit Ripples' — battle family 2 (lake: Ch 2 Moonlit Lakeshore, Market Canal; snow: Ch 8 8-1, 8-2). ORIGINAL
composition (docs/AUDIO.md §4.1 rules), batch B3, audio r3.

Lane: CELTIC JIG-ROCK. 126 bpm, the beat is a dotted quarter: 4/4 written in 8th-triplets = the 12/8 jig lilt
(long-short ♩♪ pairs and ♪♪♪ runs), a rock backbeat under it, then a reel in straight 16ths for the lift.
A minor with the dorian F♯ (the D and D/F♯ chords), C major for the reel. Stems: base (build phase) + intensity.
    intro  2 bars  bodhrán roll, harp ripples, the jig pump starts; the tin whistle runs up into A
    A      8 bars  the jig tune on tin whistle + chip pulse (2-bar cells: a long-short call that climbs, then a
                   held note) — every held note is answered: glock double-tick on beat 3, then the BAM on beat 4
                   (accordion stab + fiddle double-stop); accordion stab bed on 1, 2-a, 4-a (the jig 1 / 2& / 4&)
    A2     8 bars  the tune again, a higher second half; the fiddle plays a counter-line that runs in every hole
    Br     8 bars  breakdown: the kit drops out, harp ripples, the music box rings BELL in A minor (E–A–F–G♯) twice
                   and leaves it hanging; bars 5-6 the bass solos in triplets with the bodhrán alone, bars 7-8 the
                   whistle answers it; snare roll into …
    R      8 bars  … the lift: a REEL in C major, straight 16ths (chip arp + fiddle). The whistle answers BELL in C
                   (G–C–A–B → C, celesta on top), then whistle and fiddle trade bars; E7 drops back to the jig
Form: intro |: A A2 Br R :|  — 2 + 32 bars (61 s loop).

Bass (`pick_bass`): the jig pump — root long, octave short (R♩ 8va♪ R♩ 8va♪) with a fifth / seventh / third and a
semitone approach on the last triplet into every chord change (`ax` = from the nearer side); straight 8ths with
octave pops and 16th pickups in the reel; a triplet solo in Br 5-6. Kit (`drums_room`): kick 1, the jig pickup on
the last triplet of 2, kick 3; snare 2 and 4 with triplet ghosts; tambourine triplets; bodhrán (`melodic_tom`)
'diddly-dum' ostinato with accents on 1, 2-a and 4-a. Intensity: open-hat skips + tom fills + crashes, brass stabs
doubling the accordion, the fiddle + trumpet SENTINEL CALL rally (Br 1/3 in triplets, R 5 straight), mandolin chops,
string rips into every bar 8, orchestra hits, chip-noise triplets, a chip-square bass double for phones.

Leitmotifs: BELL minor (Br, unanswered) answered in C (R 1-2); SENTINEL CALL (intensity rally).
review: originality — jig tune, reel lines, counter-lines and bass lines are new; only the project's BELL / SENTINEL
motifs are reused. Checked by ear-memory and by interval fingerprints (scratch blocklist) against traditional jigs and
reels (Irish Washerwoman, Kesh, Morrison's, Banish Misfortune, Swallowtail, Out on the Ocean, Drowsy Maggie,
Cooley's, The Silver Spear, Merry Blacksmith, Rakes of Mallow, The Butterfly) and film/game Celtic themes (Concerning
Hobbits, My Heart Will Go On, Riverdance, Zelda/Xenoblade Celtic tracks): no shared hook or contour.
Composer B3, 2026-10-09 (round 2's flute version had the same title; nothing of it is kept).
"""
from sakura_audio.song import Song
from motifs import BELL, SENTINEL
from _battle_kit import roll
from _band import bars, rest, line, hits, ripple

CH_INTRO = 'Am | E7sus4 E7'
CH_A = 'Am | G D/F# | Am | Em7 | Am | G D/F# | F G | E7sus4 E7'
CH_A2 = 'Am | G D/F# | Am | Em7 | C G/B | Am D | F G | E7sus4 E7'
CH_BR = 'Am | E7 | Dm | E7 | Am | Am | F G | G7sus4 G7'
CH_R = 'C | Am7 | F G | C E7/G# | Am | F | Dm7 G | E7sus4 E7'

T3 = "8t"   # (documentation) a triplet 8th = 1/3 beat; '4t' = 2/3 beat (the jig's long note)
JIG = [   # the whistle tune, 2-bar cells: a climbing long-short call, then a held note for the BAM
    'a5/4t e5/8t a5/8t b5/8t c6/8t d6/4t c6/8t b5/8t g5/8t e5/8t',      # 1 Am
    'g5/4t d5/8t g5/8t a5/8t b5/8t a5/2',                               # 2 G D/F#  (A held: tick-tick … BAM)
    'a5/4t e5/8t a5/8t b5/8t c6/8t e6/4t d6/8t c6/8t b5/8t a5/8t',      # 3 Am
    'b5/4t g5/8t e5/8t f#5/8t g5/8t e5/2',                              # 4 Em7
]
JIG_A = [
    'e6/4t c6/8t a5/8t c6/8t e6/8t g6/4t f#6/8t e6/8t d6/8t c6/8t',     # 5 Am      the dorian F♯ on top
    'd6/4t b5/8t g5/8t a5/8t b5/8t d6/2',                               # 6 G D/F#
    'c6/4t a5/8t f5/8t a5/8t c6/8t d6/4t b5/8t g5/8t a5/8t b5/8t',      # 7 F G
    'a5/4t b5/8t c6/8t b5/8t a5/8t g#5/4 r/4',                          # 8 E7sus4 E7  (hit + fill)
]
JIG_A2 = [
    'e6/4t g6/8t e6/8t d6/8t c6/8t d6/4t b5/8t g5/8t a5/8t b5/8t',      # 5 C G/B
    'c6/4t a5/8t e5/8t a5/8t c6/8t f#6/2',                              # 6 Am D
    'a6/4t g6/8t f6/8t e6/8t c6/8t d6/4t e6/8t f6/8t e6/8t d6/8t',      # 7 F G
    'e6/4t d6/8t c6/8t b5/8t a5/8t e6/2',                               # 8 E7sus4 E7  (into the breakdown)
]
FIDDLE_A2 = [   # counter-line: long notes under the busy bars, triplet runs in the whistle's holes
    'e5/2 c5/2',
    'b4/2 r/4t d5/8t e5/8t f#5/8t a5/8t',
    'c5/2 e5/2',
    'g4/2 r/4t b4/8t c5/8t d5/8t e5/8t',
    'g5/2 d5/2',
    'e5/2 r/4t f#5/8t a5/8t c6/8t a5/8t',
    'c5/2 b4/2',
    'a4/2 g#4/8t b4/8t d5/8t f5/8t e5/8t g#5/8t',
]
BR_W = [   # Br 7-8: the whistle answers the bass solo
    'c6/4t a5/8t f5/8t a5/8t c6/8t d6/4t b5/8t g5/8t f5/8t d5/8t',      # 7 F G
    'c5/4t d5/8t f5/8t g5/8t b5/8t d6/2',                               # 8 G7sus4 G7
]
BASS_SOLO = (   # Br 5-6: the bass alone with the bodhrán (triplets, octave pops, chromatic climb)
    'a2/8t a3/8t e3/8t g3/8t e3/8t d3/8t c3/8t d3/8t d#3/8t e3/4t a2/8t | '
    'c3/8t b2/8t a2/8t a3/8t g3/8t e3/8t c4/4t b3/8t g3/8t f#3/8t e3/8t | '
    'f3/4t f2/8t c3/8t f3/8t f#2/8t g2/4t g3/8t d3/8t g3/8t g#3/8t | '
    'g3/4t g2/8t c3/8t d3/8t f3/8t g3/4t g2/8t b2/8t d3/8t b2/8t')
R_WHISTLE = [   # the reel: BELL answered, then the whistle's bars of the dialogue
    BELL.question('C', 6) + ' r/8',                                    # 1 C      g5 c6 a5 b5 …
    BELL.answer('C', 6) + ' r/2',                                      # 2 Am7    … c6 (the answer)
    'r/1',                                                             # 3 F G    (fiddle)
    'e6/8 g6/8 e6/8 c6/8 b5/4 r/4',                                    # 4 C E7/G♯
    'r/1',                                                             # 5 Am     (fiddle)
    'a6/4 g6/8 f6/8 c6/4 r/4',                                         # 6 F
    'r/1',                                                             # 7 Dm7 G  (fiddle)
    'e6/8 d6/8 c6/8 b5/8 g#5/4 r/4',                                   # 8 E7sus4 E7 (with the fiddle)
]
R_FIDDLE = [
    'r/1',
    'r/2 e6/16 d6/16 c6/16 b5/16 a5/16 g5/16 e5/16 g5/16',
    'a5/16 c6/16 f6/16 c6/16 a5/16 c6/16 f6/16 a6/16 g6/16 d6/16 b5/16 d6/16 g6/16 f6/16 e6/16 d6/16',
    'r/1',
    'a5/16 b5/16 c6/16 a5/16 e6/16 c6/16 a5/16 c6/16 e6/16 f6/16 e6/16 d6/16 c6/16 b5/16 a5/16 g5/16',
    'r/1',
    'f5/16 a5/16 d6/16 a5/16 f6/16 d6/16 a5/16 d6/16 g5/16 b5/16 d6/16 g6/16 f6/16 d6/16 b5/16 g5/16',
    'e5/8 d5/8 c5/8 b4/8 g#4/4 r/4',
]

# bass patterns (degree tokens, see _band.line); ax = a semitone into the next chord from the nearer side
J1 = 'R/4t 8/8t R/4t 8/8t 5/4t 7/8t 3/8t 5/8t ax/8t'
J2 = 'R/4t 8/8t 5/4t 8/8t R/4t 8/8t 7/8t 5/8t ax/8t'
J3 = 'R/4t 8/8t b7/4t 8/8t 5/4t 8/8t 3/8t 4/8t ax/8t'
JH = 'R/4t 8/8t R/8t 5/8t ax/8t'
JB = 'R/4 r/4t 8/8t 5/4t 7/8t 8/4t ax/8t'                    # breakdown: sparser, still moving
RL1 = 'R/8 8/8 R/8 5/8 7/8 8/8 3/16 5/16 ax/8'                # reel: straight 8ths, octave pops, 16th pickup
RL2 = 'R/8 8/8 5/8 8/8 R/8 8/8 7/16 5/16 ax/8'
RH = 'R/8 8/8 5/16 3/16 ax/8'

# kit (drums_room): kick 1, jig pickup (last triplet of 2), kick 3; snare 2/4 with triplet ghosts
JIG_K = 'k+h/4t h/8t s+h/4t k+h?/8t k+h/4t h/8t s+h/4t s?/8t |'
JIG_C = 'k+c/4t h/8t s+h/4t k+h?/8t k+h/4t h/8t s+h/4t s?/8t |'
JIG_F4 = 'k+h/4t h/8t s+h/4t k+h?/8t k+h/8t s/8t s/8t s/8t t1/8t t2/8t |'
JIG_F8 = 'k+h/4t h/8t s+h/4t k/8t s/8t s/8t t1/8t t2/8t t2/8t t3/8t |'
REEL = 'k+h/8 h/8 s+h/8 k+h/8 k+h/8 h/8 s+h/8 h/8 |'
REEL_C = 'k+c/8 h/8 s+h/8 k+h/8 k+h/8 h/8 s+h/8 h/8 |'
REEL_F4 = 'k+h/8 h/8 s+h/8 k+h/8 k/8 s/16 s/16 t1/8 t2/8 |'
REEL_F8 = 'k+h/8 h/8 s+h/8 k/8 s/16 s/16 s/16 s/16 t1/16 t1/16 t2/16 t2/16 |'
TAMB = '(tb/8t tb?/8t tb/8t)x4 |'
TAMB_R = '(tb/16 tb?/16 tb/16 tb?/16)x4 |'
BOD = 'a2/8t! e3?/8t e3?/8t a2/8t e3?/8t a2/8t! e3/8t e3?/8t a2/8t e3/8t a2/8t! e3?/8t |'      # 1, 2-a, 4-a
BOD_R = 'a2/8! e3?/16 e3?/16 a2/8 e3/8 a2/8! e3?/16 e3?/16 a2/16 e3/16 a2/16 e3/16 |'
BOD_BR = 'a2/4t e3?/8t r/4t e3?/8t a2/4t e3?/8t r/4t e3?/8t |'

# accordion stab bed: jig 1 / 2-a / 4-a (= 1, 2&, 4& of a straight bar); BAM bars add the beat-3-a + beat-4 punch
BED = [(0, '1/3', '!'), ('5/3', '1/3', ''), ('11/3', '1/3', '')]
BAM = BED + [('8/3', '1/3', '!'), (3, '1/3', '!')]
HIT8 = [(0, '1/3', '!'), ('5/3', '1/3', ''), (2, '2/3', '!')]
BED_S = [(0, '1/4', '!'), ('3/2', '1/4', ''), ('7/2', '1/4', '')]
BAM_S = BED_S + [(3, '1/4', '!'), ('13/4', '1/4', '')]
HIT8_S = [(0, '1/4', '!'), ('3/2', '1/4', ''), (2, '1/2', '!')]
CHOP = [(1, '1/3', '!'), (3, '1/3', '!')]                                  # mandolin chop on 2 and 4
CHOP_R = [('1/2', '1/4', ''), ('3/2', '1/4', '!'), ('5/2', '1/4', ''), ('7/2', '1/4', '!')]

BUSY = {   # hint for the r3 busy tool (study/tools): the tune and the bass
    'melody': {'whistle': None, 'chip': None, 'celesta': None, 'fiddle': ['R']},
    'bass': ['bass', 'sq_bass'], 'primary_bass': 'bass',
    'cat': {'acc': 'stab', 'brass': 'stab', 'hits': 'stab', 'mando': 'stab', 'glock': 'answer', 'fid_bam': 'answer',
            'box': 'answer', 'fiddle': 'counter', 'rally': 'counter', 'tpt': 'counter', 'runs': 'answer',
            'harp': 'arp', 'chip_arp': 'arp', 'bodhran': 'perc', 'timp': 'answer'},
}


def build() -> Song:
    s = Song(id='battle_moonlit', title='Moonlit Ripples', bpm=126, meter=(4, 4), key='Am',
             form=['intro', '|:', 'A', 'A2', 'Br', 'R', ':|'],
             mix={'echo': {'delay_ms': 224, 'feedback': 0.40, 'volume': 0.28, 'fir': 'soft'}, 'highpass_hz': 38},
             description='Battle (lake, snow): Celtic jig-rock — tin whistle jig over a jig-pump bass, accordion BAM, '
                         'bodhrán, BELL breakdown, a C-major reel lift.')
    s.busy = BUSY
    s.section('intro', 2, CH_INTRO)
    s.section('A', 8, CH_A)
    s.section('A2', 8, CH_A2)
    s.section('Br', 8, CH_BR)
    s.section('R', 8, CH_R)

    # ================================================================ base
    # --- the tune: tin whistle, the chip pulse under it (one game: the chip voice is always there)
    s.part('whistle', 'tin_whistle', 'base', vel=8, gain=1) \
        .at('intro', 2, 'r/2 e5/8t f#5/8t g#5/8t a5/8t b5/8t d6/8t') \
        .notes('A', bars(*JIG, *JIG_A)).notes('A2', bars(*JIG, *JIG_A2)) \
        .notes('Br', bars(rest(6), *BR_W)) \
        .notes('R', bars(*R_WHISTLE), motifs={1: BELL})
    s.part('chip', 'chip_pulse12', 'base', vel=-22, gain=-2).double('whistle')
    s.part('celesta', 'celesta', 'base', octave=1, vel=-20).double('whistle', 'R')
    # --- the fiddle: counter-line in A2, the reel dialogue in R; double-stop BAMs in A
    s.part('fiddle', 'fiddle', 'base', vel=-2) \
        .notes('A2', bars(*FIDDLE_A2)).notes('R', bars(*R_FIDDLE))
    s.part('fid_bam', 'fiddle', 'base', vel=4) \
        .at('A', 2, "r/2 r/4 [d4 a4]/4t' r/8t").at('A', 4, "r/2 r/4 [e4 b4]/4t' r/8t") \
        .at('A', 6, "r/2 r/4 [f#4 d5]/4t' r/8t").at('A', 8, "r/2 [e4 d5]/4t' r/8t r/4")
    # --- answers above: glock double-tick on beat 3, a reply note on beat 4
    s.part('glock', 'glock', 'base', vel=-4) \
        .at(['A', 'A2'], 2, "r/2 a6/8t' a6/8t' r/8t f#6/8t' r/4t") \
        .at(['A', 'A2'], 4, "r/2 g6/8t' g6/8t' r/8t e6/8t' r/4t") \
        .at(['A', 'A2'], 6, "r/2 a6/8t' a6/8t' r/8t d7/8t' r/4t") \
        .at(['A', 'A2'], 8, "r/2 g#6/8t' g#6/8t' r/8t b6/8t' r/4t") \
        .at('R', 4, "r/2 r/4 g#6/16' g#6/16' b6/8'").at('R', 6, "r/2 r/4 c7/16' c7/16' a6/8'") \
        .at('R', 8, "r/2 r/4 e7/16' e7/16' g#6/8'")
    # --- accordion: the stab bed (and the BAM)
    s.part('acc', 'accordion', 'base', vel=-4, gain=1) \
        .notes('intro', bars('[a3 c4 e4]/1', hits('E7sus4 E7', [(0, '1/3', '!'), ('5/3', '1/3', ''), (2, '1/3', '!'),
                                                               ('11/3', '1/3', '')], 55, 69))) \
        .notes('A', hits(CH_A, BED, 55, 69, per_bar={2: BAM, 4: BAM, 6: BAM, 8: HIT8})) \
        .notes('A2', hits(CH_A2, BED, 55, 69, per_bar={2: BAM, 4: BAM, 6: BAM, 8: HIT8})) \
        .notes('Br', hits(CH_BR, [], 55, 69, per_bar={
            1: [(0, 4, '')], 3: [(0, 4, '')], 7: BED,
            8: [(2, '1/3', ''), ('7/3', '1/3', ''), ('8/3', '1/3', ''), (3, '1/3', '!'), ('10/3', '1/3', '!'),
                ('11/3', '1/3', '!')]})) \
        .notes('R', hits(CH_R, BED_S, 55, 69, per_bar={4: BAM_S, 6: BAM_S, 8: HIT8_S}))
    # --- harp ripples (triplets) and the reel's chip arp (16ths)
    s.part('harp', 'harp', 'base', vel=-14) \
        .notes('intro', ripple(CH_INTRO, 57, 81)).notes('A', ripple(CH_A, 57, 81)).notes('A2', ripple(CH_A2, 57, 81)) \
        .notes('Br', ripple(CH_BR, 57, 84, mute_bars=(5, 6)))
    s.part('chip_arp', 'chip_pulse25', 'base', vel=-26, gain=-3).notes('R', ripple(CH_R, 64, 88, per_beat=4, vel=(70, 52)))
    # --- breakdown: the music box rings BELL in A minor over E7 and leaves it hanging
    bell_j = BELL.question('Am', 5, rhythm=('4t', '8t', '4', '4.')) + ' r/8'
    s.part('box', 'music_box', 'base', vel=-2) \
        .notes('Br', bars('r/1', bell_j, 'r/1', BELL.question('Am', 6, rhythm=('4t', '8t', '4', '4.')) + ' r/8',
                          rest(4)), motifs={2: BELL, 4: BELL})
    # --- bass: the jig pump
    s.part('bass', 'pick_bass', 'base', vel=6) \
        .notes('intro', line(CH_INTRO, J1, JH, low=38, nxt='Am', flats=False)) \
        .notes('A', line(CH_A, [J1, J2, J3, J2, J1, J2, J1, J2], JH, low=38, nxt='Am', flats=False)) \
        .notes('A2', line(CH_A2, [J1, J2, J3, J2, J1, J2, J1, J2], JH, low=38, nxt='Am', flats=False)) \
        .notes('Br', bars(line('Am | E7 | Dm | E7', JB, low=38, nxt='Am', flats=False), BASS_SOLO)) \
        .notes('R', line(CH_R, [RL1, RL2], RH, low=38, nxt='Am', flats=False))
    # --- drums: kit, tambourine, bodhrán
    s.part('kit', 'drums_room', 'base', vel=-2) \
        .notes('intro', bars('r/1', 'r/2 ' + roll('s', '8t', 6, 50, 104))) \
        .pattern(['A', 'A2'], JIG_K, fills={1: JIG_C, 4: JIG_F4, 5: JIG_C, 8: JIG_F8}) \
        .notes('Br', bars(rest(6), 'k/4t h?/8t h?/4t h?/8t k/4t h?/8t h?/4t h?/8t',
                          roll('s', '16', 8, 40, 80) + ' ' + roll('s', '16', 8, 84, 118))) \
        .pattern('R', REEL, fills={1: REEL_C, 4: REEL_F4, 5: REEL_C, 8: REEL_F8})
    s.part('tamb', 'drums_room', 'base', vel=-16) \
        .pattern(['intro', 'A', 'A2'], TAMB).notes('Br', bars(rest(6), TAMB[:-2], TAMB_R[:-2])).pattern('R', TAMB_R)
    s.part('bodhran', 'melodic_tom', 'base', vel=-8) \
        .notes('intro', bars(roll('e3', '8t', 12, 36, 96), BOD[:-2])) \
        .pattern(['A', 'A2'], BOD) \
        .notes('Br', bars(BOD_BR[:-2], BOD_BR[:-2], BOD_BR[:-2], BOD_BR[:-2], BOD[:-2], BOD[:-2], BOD[:-2], BOD_R[:-2])) \
        .pattern('R', BOD_R)

    # ================================================================ intensity
    s.part('kit2', 'drums', 'intensity', vel=-6) \
        .pattern(['A', 'A2'], 'r/4t o/8t r/4t o/8t r/4t o/8t r/4t o/8t |',
                 fills={1: 'c/4t o/8t r/4t o/8t r/4t o/8t r/4t o/8t |',
                        4: 'r/4t o/8t r/4t o/8t r/4t o/8t t1/8t t1/8t t2/8t |',
                        5: 'c/4t o/8t r/4t o/8t r/4t o/8t r/4t o/8t |',
                        8: 'r/4t o/8t r/4t o/8t t1/8t t1/8t t1/8t t2/8t t2/8t t3/8t |'}) \
        .notes('Br', bars('c/1', rest(5), 'r/1', 'r/2 r/4 c/4')) \
        .pattern('R', '(r/8 rd/8)x4 |', fills={1: 'c/8 rd/8 r/8 rd/8 r/8 rd/8 r/8 rd/8 |',
                                              5: 'c/8 rd/8 r/8 rd/8 r/8 rd/8 r/8 rd/8 |',
                                              8: 'r/8 rd/8 r/8 rd/8 t1/16 t1/16 t2/16 t2/16 t3/16 t3/16 t3/16 t3/16 |'})
    s.part('brass', 'brass_stab', 'intensity', vel=-4).double('acc', ['A', 'A2', 'R'])
    sent_j = ('4t', '8t', '4', '4t', '4')
    s.part('rally', 'fiddle', 'intensity', vel=6) \
        .at('Br', 1, SENTINEL.question('Am', 5, rhythm=sent_j) + ' r/8t', motif=SENTINEL) \
        .at('Br', 3, SENTINEL.question('Dm', 5, rhythm=sent_j) + ' r/8t', motif=SENTINEL) \
        .at('R', 5, SENTINEL.question('Am', 5), motif=SENTINEL)
    s.part('tpt', 'trumpet', 'intensity', octave=-1, vel=-2).double('rally')
    s.part('mando', 'mandolin', 'intensity', vel=-6) \
        .notes('A', hits(CH_A, CHOP, 57, 74, 'close')).notes('A2', hits(CH_A2, CHOP, 57, 74, 'close')) \
        .notes('R', hits(CH_R, CHOP_R, 57, 74, 'close'))
    s.part('runs', 'strings', 'intensity', vel=4) \
        .at('A', 8, 'r/2 e4/16t f#4/16t g#4/16t a4/16t b4/16t c5/16t d5/16t e5/16t f#5/16t g#5/16t a5/16t b5/16t') \
        .at('A2', 8, 'r/2 e6/16t d6/16t c6/16t b5/16t a5/16t g#5/16t f5/16t e5/16t d5/16t c5/16t b4/16t a4/16t') \
        .at('Br', 8, 'r/2 g4/16 a4/16 b4/16 c5/16 d5/16 e5/16 f5/16 g5/16') \
        .at('R', 8, 'r/2 e4/16 f#4/16 g#4/16 a4/16 b4/16 c5/16 d5/16 e5/16')
    s.part('hits', 'orch_hit', 'intensity', vel=-2) \
        .at(['A', 'A2'], 8, 'r/2 [e3 g#3 d4]/4 r/4').at('Br', 8, 'r/2 r/4 [g3 b3 f4]/4') \
        .at('R', 1, '[c3 e3 g3 c4]/4 r/2.').at('R', 8, 'r/2 [e3 g#3 d4]/4 r/4')
    s.part('timp', 'timpani', 'intensity', vel=-4) \
        .at('Br', 8, roll('g1', '16', 8, 40, 100) + ' g1/4 r/4').at('R', 1, 'c2/4 r/2.')
    s.part('noise', 'chip_kit', 'intensity', vel=-26).pattern(['A', 'A2'], '(h/8t h?/8t o/8t)x4 |') \
        .pattern('R', '(h/16 h?/16 o/16 h?/16)x4 |')
    s.part('sq_bass', 'chip_pulse50', 'intensity', octave=1, vel=-24, gain=-3).double('bass', ['A', 'A2', 'R'])
    return s


songs = [build()]
