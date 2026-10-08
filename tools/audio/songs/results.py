"""Results-screen loops: results_win, results_lose. ORIGINAL compositions (docs/AUDIO.md §4.1 rules, §4.4).

Both are short full-mix loops with no intro (they start exactly where the victory / defeat jingle ends) and
both let the Sakura Bell be ANSWERED, softly — the payoff of a battle.
    results_win   'After School'        96 bpm swing, F major, 8 bars (20 s). Music box rings the Bell question
                                         (C–F–D–E) over Fmaj9, the e-piano and walking bass stroll under a
                                         little after-school tune, and at bar 8 the Bell is answered: F6.
    results_lose  'Petals on the Path'  84 bpm, D minor → F major, 8 bars (23 s). The Bell in D minor (A4–D5–B♭4–C♯5)
                                         left hanging twice over harp and slow strings; bar 7 lifts it an octave
                                         into F major (C6–F6–D6–E6) and bar 8 answers it: hope, not a game over.
review: originality — new melodies on the project's BELL motif; harmony and arrangement are new. Checked against
results / game-over / save-room music of Undertale/Deltarune, EarthBound/Mother, Animal Crossing, Pokémon,
Final Fantasy and Blue Archive: no shared hook or contour. `studio.py originality`: no blocklist match.
Composer C (round 2), 2026-10-08.
"""
from sakura_audio.song import Song
from motifs import BELL
from _home import bars

WIN_CH = 'Fmaj9 | Am7 | Bbmaj9 | C13sus4 | Fmaj9 | Dm9 | Gm9 C7 | Fmaj7'
WIN_BOX = [
    BELL.question('F', 6) + ' r/8',          # 1 Fmaj9    the question (C6 F6 D6 E6)
    'r/4 c6/8 e6/8 g6/4 e6/4',               # 2 Am7
    'd6/4. c6/8 a5/4 f5/4',                  # 3 B♭maj9
    'g5/2. r/4',                             # 4 C13sus4
    BELL.question('F', 6) + ' r/8',          # 5 Fmaj9    the question again …
    'r/4 a5/8 c6/8 e6/4 d6/4',               # 6 Dm9
    'bb5/4 c6/8 d6/8 e6/4 r/4',              # 7 Gm9 C7   … climbing to the leading tone
    BELL.answer('F', 6) + '. r/4',           # 8 Fmaj7    … and answered: F6
]
WIN_COUNTER = ['a4/2. g4/4', 'g4/2 e4/2', 'f4/2. a4/4', 'bb4/2 g4/2',
               'a4/2. c5/4', 'c5/2 a4/2', 'bb4/2 bb4/2', 'a4/1']

LOSE_CH = 'Dm | Bbmaj7 | Gm9 | A7sus4 A7 | Dm | Bbmaj7 | Gm7 C7 | Fmaj7'
LOSE_BOX = [
    BELL.question('Dm', 5) + ' r/8',         # 1 Dm       A5 D6 B♭5 C♯6 — left hanging
    'r/4 f5/8 g5/8 a5/2',                    # 2 B♭maj7
    'bb5/4. a5/8 g5/4 f5/4',                 # 3 Gm9
    'e5/2 c#5/4 e5/4',                       # 4 A7sus4 A7
    BELL.question('Dm', 5) + ' r/8',         # 5 Dm       hanging again …
    'r/4 f5/8 d5/8 c5/2',                    # 6 B♭maj7
    BELL.question('F', 6) + ' r/8',          # 7 Gm7 C7   … turned to F major: C6 F6 D6 E6
    BELL.answer('F', 6) + '. r/4',           # 8 Fmaj7    answered: F6, hope
]


def results_win() -> Song:
    s = Song(id='results_win', title='After School', bpm=96, meter=(4, 4), key='F', swing=0.6,
             form=['|:', 'W', ':|'],
             mix={'echo': {'delay_ms': 224, 'feedback': 0.38, 'volume': 0.26, 'fir': 'soft'}},
             description='Results after a victory: the Bell asked twice over a cosy stroll, answered at bar 8.')
    s.section('W', 8, WIN_CH)
    s.part('box', 'music_box', 'full', vel=6, gain=1).notes('W', bars(*WIN_BOX), motifs={1: BELL, 5: BELL, 8: BELL})
    s.part('vibes', 'vibes', 'full', octave=-1, vel=-22).double('box', 'W')
    s.part('tri', 'chip_triangle', 'full', vel=-46).notes('W', bars(*WIN_COUNTER))
    s.part('ep', 'epiano', 'full', vel=-4, gain=-1).gen('W', 'comp:charleston', voicing='rootless', low=53, high=70, vel=66)
    s.part('bass', 'finger_bass', 'full', vel=-26).gen('W', 'bass:walking')
    s.part('pad', 'pad_warm', 'full').gen('W', 'pad:sustain', low=55, high=70, vel=48)
    s.part('brush', 'drums_brush', 'full', vel=8).pattern('W', 'k+rd?/4 rd+ph/8 rd?/8 k+rd?/4 rd+ph+s/8 rd?/8 |',
                                                          fills={8: 'k+rd?/4 rd+ph/8 rd?/8 s?/8 s/8 s?/8 s/8 |'})
    return s


def results_lose() -> Song:
    s = Song(id='results_lose', title='Petals on the Path', bpm=84, meter=(4, 4), key='Dm',
             form=['|:', 'L', ':|'],
             mix={'echo': {'delay_ms': 256, 'feedback': 0.42, 'volume': 0.30, 'fir': 'soft'}},
             description='Results after a defeat: the Bell in D minor, unanswered, then turned to F and answered.')
    s.section('L', 8, LOSE_CH)
    s.part('box', 'music_box', 'full', vel=6, gain=1).notes('L', bars(*LOSE_BOX), motifs={1: BELL, 5: BELL, 7: BELL})
    s.part('celesta', 'celesta', 'full', octave=-1, vel=-26).double('box', 'L')
    s.part('harp', 'harp', 'full', vel=-14).gen('L', 'arp:updown8', voicing='triad', low=50, high=74, vel=60)
    s.part('strings', 'strings_slow', 'full', vel=-10).gen('L', 'pad:sustain', voicing='triad', low=53, high=69, vel=56)
    s.part('bass', 'fretless', 'full', vel=-20).gen('L', 'bass:root')
    s.part('flute', 'flute', 'full', vel=-24).at('L', 7, 'r/2 e5/4 g5/4 | a5/2. r/4')
    return s


songs = [results_win(), results_lose()]
