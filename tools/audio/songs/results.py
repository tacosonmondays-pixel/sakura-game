"""Results-screen loops: results_win, results_lose. ORIGINAL compositions (docs/AUDIO.md §4.1 rules, §4.4; round-3
genre lane: SWEET — results_win a bossa lilt, results_lose a lullaby).

Both are short full-mix loops with no intro (they start exactly where the victory / defeat jingle ends) and both let
the Sakura Bell be ANSWERED, softly — the payoff of a battle.
    results_win   'After School'        100 bpm straight bossa, F major, 8 bars (19.2 s). The music box and the vibes
                                         ring the Bell question (C–F–D–E) over Fmaj9 and the vibes answer with a little
                                         syncopated after-school tune; nylon-guitar bossa comping (its accented chord
                                         on beat 3 of every even bar is the low "BAM"), an upright bass in a bossa
                                         two-feel (root, fifth, octave pop, chromatic approach into every chord), brush
                                         kick + cross-stick clave + 16th shaker, a soft harp 8th arpeggio, a flute
                                         guide-tone counter-line (B♭maj9 → B♭m6 in bar 6: the chromatic minor iv), and
                                         glock / celesta chime ticks answering every second bar. Bar 8: the Bell is
                                         answered, F6, and a brush fill turns the loop.
    results_lose  'Petals on the Path'  84 bpm, D minor → F major, 8 bars (22.9 s), a lullaby rocking in 8th-note
                                         triplets. The Bell in D minor (A4–D5–B♭4–C♯5) is left hanging twice on the
                                         music box over harp triplet arpeggios and a stepwise pizzicato bass; a celesta
                                         counter-line climbs in every pause, Christmas bells / glock answer every second
                                         bar, soft brush swish + triplet shaker; bar 6 darkens B♭maj7 → B♭m6, bar 7
                                         turns the Bell to F major (C6–F6–D6–E6, a flute a third under it) and bar 8
                                         answers it, F6, over a rising harp glissando: hope, not a game over.

Taste rules (r3 study/taste.md, sweet lane): bass never whole notes (win 6 notes a bar with an octave pop and a
chromatic approach into every chord change; lose 4 notes a bar, stepwise, a triplet pickup into every chord); melody in 2-bar cells whose
second bar leaves beats 3-4 open, every pause answered by a chime (and in results_win by the guitar's beat-3 hit);
a counter-line in all 8 bars; fills in bars 4 and 8, a cymbal on bars 1 and 5; a chip voice in each (chip bell).

review: originality — new melodies on the project's BELL motif; harmony and arrangement are new. The bossa comping,
clave and bass two-feel and the lullaby triplet arpeggio are generic idioms; no bossa-nova standard's head, riff or
changes are used. Checked against results / game-over / save-room music of Undertale/Deltarune, EarthBound/Mother,
Animal Crossing, Pokémon, Kirby, Final Fantasy and Blue Archive, and against lullaby classics: no shared hook or
contour. `studio.py originality`: no blocklist match. Composer C (round 2) 2026-10-08; Composer B4 (round 3,
densified and re-laned) 2026-10-13.
"""
from sakura_audio.song import Song
from motifs import BELL
from _home import bars
from _sweet import line, chordify, arp, gliss, tick

# ======================================================================================================== results_win
WIN_CH = 'Fmaj9 | Am7 D7b9 | Gm9 | C13sus4 C7b9 | Fmaj9 | Bbmaj9 Bbm6 | Gm9 C7b9 | Fmaj9'
Q_F6 = BELL.question('F', 6) + ' r/8'                  # c6/8 f6/8 d6/4 e6/4. r/8
WIN_TUNE = [
    Q_F6,                                              # 1 Fmaj9        ⟨BELL⟩ the question
    'r/8 g5/8 a5/8 c6/8~ c6/2',                        # 2 Am7 D7♭9     a lilting reply … chime
    'r/8 bb5/8 a5/8 g5/8 f5/8 g5/8 a5/8 d6/8~',        # 3 Gm9          a bossa run, anticipating bar 4
    'd6/4 c6/8 bb5/8~ bb5/2',                          # 4 C13sus4 C7♭9 … chime
    Q_F6,                                              # 5 Fmaj9        ⟨BELL⟩ the question again
    'r/8 d6/8 c6/8 f5/8~ f5/2',                        # 6 B♭maj9 B♭m6  falls under the heart-tug … chime
    'bb5/8 a5/8 g5/8 bb5/8 db6/8 c6/8 e6/4',           # 7 Gm9 C7♭9     climbing to the leading tone
    BELL.answer('F', 6) + ' r/2',                      # 8 Fmaj9        ⟨BELL⟩ answered: F6
]
WIN_COUNTER = [                                        # flute guide tones (3rds and 7ths), half notes under the tune
    'a4/2. g4/4', 'g4/2 f#4/2', 'f4/2. a4/4', 'bb4/2 e4/2',
    'a4/2. c5/4', 'd5/2 db5/2', 'f4/2 e4/2', 'e4/4 f4/4 a4/2',
]
BOSSA_A = "x/8! r/8 x/8 r/8 r/8 x/8 r/8 x/8"           # nylon guitar, odd bars:  1, 2, 3&, 4&
BOSSA_B = "r/8 x/8 r/8 r/8 x/8! r/8 x/8 r/8"           # even bars: 1&, 3 (accented: the BAM in the tune's pause), 4
KIT_A = 'k+rs/8 r/8 r/8 k+rs/8 k/8 r/8 rs/8 k/8'     # bossa kick 1, 2&, 3, 4& + cross-stick clave (3-2)
KIT_B = 'k/8 r/8 rs/8 k/8 k/8 rs/8 r/8 k/8'


def results_win() -> Song:
    s = Song(id='results_win', title='After School', bpm=100, meter=(4, 4), key='F',
             form=['|:', 'W', ':|'],
             mix={'echo': {'delay_ms': 224, 'feedback': 0.38, 'volume': 0.26, 'fir': 'soft'}},
             description='Results after a victory: a sweet bossa lilt; the Bell asked twice, answered at bar 8.',
             extra={'lane': 'sweet',
                    'busy': {'melody': {'vibes': None, 'box': None}, 'bass': ['bass'], 'primary_bass': 'bass',
                             'cat': {'flute': 'counter', 'gtr': 'stab', 'harp': 'arp', 'glock': 'answer',
                                     'celesta': 'answer', 'chip': 'answer', 'gliss': 'answer'}}})
    s.section('W', 8, WIN_CH)
    # ---- the tune: vibes all the way, the music box rings the Bell with it (bars 1, 5, 8)
    s.part('vibes', 'vibes', 'full', vel=2, gain=4).notes('W', bars(*WIN_TUNE), motifs={1: BELL, 5: BELL, 8: BELL})
    s.part('box', 'music_box', 'full', vel=-4).notes('W', bars(Q_F6, 'r/1', 'r/1', 'r/1', Q_F6, 'r/1', 'r/1',
                                                             BELL.answer('F', 6) + ' r/2'))
    s.part('flute', 'flute', 'full', vel=-18).notes('W', bars(*WIN_COUNTER))
    # ---- chimes answering every pause (bars 2, 4, 6, 8, beat 3): glock / celesta + a chip-bell double
    glock = s.part('glock', 'glock', 'full', vel=-10, gain=3)
    cel = s.part('celesta', 'celesta', 'full', vel=-6)
    chip = s.part('chip', 'chip_bell', 'full', vel=-30)
    for b, who in ((2, glock), (4, cel), (6, glock), (8, cel)):
        t = tick(WIN_CH, b, lo=86, hi=100, flats=True)
        who.at('W', b, t)
        chip.at('W', b, t)
    s.part('gliss', 'harp', 'full', vel=-20, gain=-6).at('W', 8, 'r/2 ' + gliss('Fmaj9', 55, 91, 16, '32', flats=True))
    # ---- the band
    s.part('gtr', 'nylon_gtr', 'full', vel=-2, gain=-3).notes(
        'W', chordify(WIN_CH, {1: BOSSA_A, 3: BOSSA_A, 5: BOSSA_A, 7: BOSSA_A, 0: BOSSA_B}, 52, 67, style='rootless',
                      flats=True))
    s.part('harp', 'harp', 'full', vel=-26, gain=-2).notes('W', arp(WIN_CH, '0213', 60, 79, step='8', flats=True))
    s.part('bass', 'upright_bass', 'full', vel=-4, gain=-1.5).notes(
        'W', line(WIN_CH, 'R/4. 5/8 R/8 8/8 5/8 ap/8', ['R/4. 5/8', 'R/8 8/8 5/8 ap/8'], flats=True))
    kit = s.part('kit', 'drums_brush', 'full', vel=-10)
    kit.notes('W', bars('k+rs+sp?/8 r/8 r/8 k+rs/8 k/8 r/8 rs/8 k/8', KIT_B, KIT_A,                 # splash on 1
                        'k/8 r/8 rs/8 k/8 k/8 rs/8 s?/16 s/16 t1?/16 t2/16',                       # small fill
                        'k+rs+c?/8 r/8 r/8 k+rs/8 k/8 r/8 rs/8 k/8', KIT_B, KIT_A,                # crash on 5
                        'k/8 r/8 rs/8 k/8 s?/16 s/16 t1?/16 t1/16 t2?/16 t2/16 t3/16 t3/16'))     # big fill
    s.part('shaker', 'drums_brush', 'full', vel=-30, gain=6).pattern('W', '(sh/16 sh?/16 sh/16 sh?/16)x4 |')
    return s


# ======================================================================================================= results_lose
LOSE_CH = 'Dm | Bbmaj7 | Gm9 | A7sus4 A7 | Dm | Bbmaj7 Bbm6 | Gm7 C7 | Fmaj7'
Q_DM = BELL.question('Dm', 5) + ' r/8'                  # a5/8 d6/8 bb5/4 c#6/4. r/8 — left hanging
LOSE_BOX = [
    Q_DM,                                    # 1 Dm         ⟨BELL⟩ in D minor, hanging on the leading tone
    'r/4 f5/8 g5/8 a5/2',                    # 2 B♭maj7     … chime
    'bb5/4. a5/8 g5/4 f5/4',                 # 3 Gm9
    'e5/4. d5/8 c#5/2',                      # 4 A7sus4 A7  … chime
    Q_DM,                                    # 5 Dm         ⟨BELL⟩ hanging again …
    'r/4 f5/8 d5/8 c5/2',                    # 6 B♭maj7 B♭m6 … chime
    BELL.question('F', 6) + ' r/8',          # 7 Gm7 C7     ⟨BELL⟩ … turned to F major: C6 F6 D6 E6
    BELL.answer('F', 6) + '. r/4',           # 8 Fmaj7      ⟨BELL⟩ answered: F6, hope
]
LOSE_COUNTER = [                             # celesta, under the music box: it climbs in every pause
    'f4/2 e4/4 d4/4',                        # 1 Dm
    'd4/2 r/8 a4/8 c5/8 d5/8',               # 2 B♭maj7
    'bb4/2 a4/2',                            # 3 Gm9
    'd4/2 c#4/8 e4/8 g4/8 bb4/8',            # 4 A7sus4 A7
    'd4/2 e4/4 f4/4',                        # 5 Dm         (under the Bell's B♭4)
    'f4/2 r/8 db4/8 f4/8 g4/8',              # 6 B♭maj7 B♭m6
    'f4/2 e4/2',                             # 7 Gm7 C7
    'f4/4 a4/4 c5/4 e5/4',                   # 8 Fmaj7      rising under the answer
]


def results_lose() -> Song:
    s = Song(id='results_lose', title='Petals on the Path', bpm=84, meter=(4, 4), key='Dm',
             form=['|:', 'L', ':|'],
             mix={'echo': {'delay_ms': 256, 'feedback': 0.42, 'volume': 0.30, 'fir': 'soft'}},
             description='Results after a defeat: a sweet lullaby; the Bell in D minor hangs, then turned to F and '
                         'answered.',
             extra={'lane': 'sweet',
                    'busy': {'melody': {'box': None, 'chip': None}, 'bass': ['bass'], 'primary_bass': 'bass',
                             'cat': {'celesta': 'counter', 'flute': 'counter', 'harp': 'arp', 'strings': 'pad',
                                     'xmas': 'answer', 'glock': 'answer', 'gliss': 'answer'}}})
    s.section('L', 8, LOSE_CH)
    s.part('box', 'music_box', 'full', vel=6, gain=4).notes('L', bars(*LOSE_BOX), motifs={1: BELL, 5: BELL, 7: BELL})
    s.part('chip', 'chip_bell', 'full', vel=-30).double('box', 'L')
    s.part('celesta', 'celesta', 'full', vel=-10, gain=-2).notes('L', bars(*LOSE_COUNTER))
    s.part('flute', 'flute', 'full', vel=-24, gain=-6).at('L', 7, 'r/2 e5/4 g5/4 | a5/2. r/4')
    # ---- chimes in every second pause; the bar-8 harp glissando rises through the answer
    xmas = s.part('xmas', 'xmas_bells', 'full', vel=-12)
    glock = s.part('glock', 'glock', 'full', vel=-16, gain=3)
    for b, who in ((2, xmas), (4, glock), (6, xmas), (8, glock)):
        who.at('L', b, tick(LOSE_CH, b, lo=86, hi=100, flats=True))
    s.part('gliss', 'harp', 'full', vel=-22, gain=-6).at('L', 8, 'r/2 r/8 ' + gliss('Fmaj7', 53, 88, 12, '32', flats=True))
    # ---- the cradle
    s.part('harp', 'harp', 'full', vel=-20, gain=-5).notes('L', arp(LOSE_CH, '012321', 50, 72, step='8t', flats=True))
    s.part('strings', 'strings_slow', 'full', vel=-22).gen('L', 'pad:sustain', voicing='triad', low=53, high=69, vel=56)
    s.part('bass', 'pizz', 'full', vel=-2, gain=1).notes('L', line(LOSE_CH, 'R/4 2/4 3/4 r/4t ap/8t', 'R/4 r/4t ap/8t', low=38, flats=True))
    kit = s.part('kit', 'drums_brush', 'full', vel=-16)
    kit.pattern('L', 'k?/4 sr/4 r/4 sr/4 |', fills={
        1: 'k+sp?/4 sr/4 r/4 sr/4 |',
        4: 'k?/4 sr/4 r/4 s?/16 s?/16 t2?/16 t3/16 |',
        5: 'k+sp?/4 sr/4 r/4 sr/4 |',
        8: 'k?/4 sr/4 t1?/8t t1?/8t t2?/8t t2/8t t3?/8t t3/8t |'})
    s.part('shaker', 'drums_brush', 'full', vel=-32, gain=6).pattern('L', '(sh/8t sh?/8t sh?/8t)x4 |')
    return s


songs = [results_win(), results_lose()]
