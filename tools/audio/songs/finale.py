"""'Ashwing Matriarch' — the final boss (8-5 boss-ashwing, challenge wave 70). ORIGINAL composition (§4.1 rules).

E minor ↔ G major, 176 bpm, straight. Epic, desperate, then everyone together. Starts at the end of the
boss_warning sting like boss.py. Stems: base (phase 1) + intensity (phase 2+: choir, tremolo strings, timpani,
orchestra hits, horn counter, a second drum layer). All three leitmotifs:
    intro  4 bars  the dragon: SHADOW (E–F–E–B♭–G) in trombone + tuba + organ, then on C; orchestra hits, chip
                   arpeggios spin up over B7♭9
    A      8 bars  the Ashwing hook (new): a "dragon call" down a fourth and back (E6 ↓ B5 ↑ E6), then a run up the
                   E minor scale to B6; chip lead + koto 16th runs, slap-bass pump, double-kick power kit
    A2     8 bars  the hook again, the second half climbs to E7 and falls to the B7; the horn sings long notes under
                   it (intensity)
    B      8 bars  the lopsided bridge: a 7-eighth ostinato (3+2+2) on koto + pizzicato + kick accents cycles
                   against the 4/4 bar (the design's "7/8 bridge", kept on the 4/4 grid so the engine's bar-quantised
                   transitions still work); SHADOW (the dragon, low brass) and the SENTINEL CALL (the girls, trumpets)
                   trade bars
    C      8 bars  everyone together: the main theme bars 1-4 in G major (chip lead, trumpet, glock; choir in the
                   intensity stem), then the Sakura Bell rings out ANSWERED (D–G–E–F♯ → G, held a whole bar) —
                   before Cmaj7 → B7♭9 drags the fight back to E minor
    D      8 bars  the push: the dragon call in rising sequence (E, G, C, A) with chip 16th arpeggios, SHADOW
                   answering each call in the low brass, timpani + string climb into the hook
Form: intro |: A A2 B C D :|  — 4 + 40 bars (54.5 s loop).

Leitmotifs: SHADOW (intro, B, D), SENTINEL CALL (B), main theme + BELL answered (C).
review: originality — the Ashwing hook, the ostinato, bass lines and arrangement are new; the main theme, BELL,
SENTINEL and SHADOW are the project's own. No opening built from a repeated root + octave leap + chromatic
run. Checked by ear-memory against well-known final-boss themes of console and indie RPGs and action games: no
shared hook or contour. `studio.py originality`: no blocklist match.
Composer C (round 2), 2026-10-08.
Round 3 (keep-polish): the slap-bass pump in A, A2, C and D now walks through the chord (3rd on beat 3, 7th on 4,
then the chromatic approach) instead of root–octave only: 3.9 → ≥ 4.5 pitches a bar. No other note changes.
"""
from sakura_audio.song import Song
from motifs import BELL, SENTINEL, SHADOW
from _battle_kit import bars, roll, walk, tr, MAIN_A

CH_INTRO = 'Em | Em | C | B7b9'
CH_A = 'Em | Cmaj7 | Am7 | B7 | Em | Cmaj7 | F#m7b5 | B7b9'
CH_A2 = 'Em | Cmaj7 | Am7 | B7 | Em | Cmaj7 | Am7 | B7'
CH_B = 'Em | Em | F/E | Em | C | C | B7sus4 | B7'
CH_C = 'Gmaj7 | Em9 | Cmaj7 | D7sus4 D7 | Gmaj7/D | G | Cmaj7 | B7b9'
CH_D = 'Em | Em | C | C | Am | Am | B7sus4 | B7'

HOOK = [
    'e6/4 b5/8 e6/8~ e6/8 f#6/8 g6/8 a6/8',   # 1 Em      the dragon call, then up the scale
    'b6/4. g6/8 e6/4 r/8 b5/8',               # 2 Cmaj7
    'c6/8 b5/8 a5/8 c6/8~ c6/8 e6/8 d6/8 c6/8',  # 3 Am7
    'd#6/4. b5/8 f#6/4 r/4',                  # 4 B7      (koto run in the gap)
    'e6/4 b5/8 e6/8~ e6/8 f#6/8 g6/8 b6/8',   # 5 Em
    'c7/4. b6/8 g6/4 e6/4',                   # 6 Cmaj7
    'a6/8 g6/8 f#6/8 e6/8 c6/4 a5/4',         # 7 F♯m7♭5
    'b5/4 c6/8 b5/8 a#5/4 b5/4',              # 8 B7♭9    the chromatic neighbour (koto run)
]
HOOK2_END = [
    'e6/4 b5/8 e6/8~ e6/8 g6/8 b6/8 e7/8',    # 5 Em      higher …
    'd7/4. c7/8 b6/4 g6/4',                   # 6 Cmaj7
    'a6/8 b6/8 c7/8 b6/8 a6/4 e6/4',          # 7 Am7
    'f#6/4 d#6/4 b5/2',                       # 8 B7      → the bridge
]
# C: the main theme bars 1-4 (§4.3) a tone up in G major, chip-lead octave 6; then the Bell answered and held
FINALE = [tr(b, 14) for b in MAIN_A[:4]] + [
    'd6/8 g6/8 e6/4 f#6/4. g6/8~',            # 5 G/D     BELL … answered on G (tied)
    'g6/1',                                   # 6 G       held: everyone together
    'e6/4 d6/8 c6/8 b5/4 a5/4',               # 7 Cmaj7   … but the dragon is not done
    'b5/4 c6/4 b5/4 d#6/4',                   # 8 B7♭9
]
D_LEAD = [
    'e6/4 b5/8 e6/8~ e6/2',                   # 1 Em      the call, in rising sequence
    'r/1',                                    # 2         (SHADOW answers)
    'g6/4 d6/8 g6/8~ g6/2',                   # 3 C
    'b6/4 g6/8 e6/8 c6/4 e6/4',               # 4 C
    'a6/4 e6/8 a6/8~ a6/2',                   # 5 Am
    'c7/4 a6/8 e6/8 d6/4 c6/4',               # 6 Am
    'b5/8 e6/8 f#6/8 a6/8 b6/4 a6/4',         # 7 B7sus4
    'f#6/4 d#6/4 b5/4 a5/4',                  # 8 B7      → the hook
]
KOTO_RUN_4 = 'r/2. f#5/16 a5/16 b5/16 d#6/16'
KOTO_RUN_8 = 'r/2 b4/16 d#5/16 f#5/16 a5/16 b5/16 d#6/16 f#6/16 a6/16'

PUMP = 'R/8 8/8 R/8 5/8 R/8 8/8 7/8 ap/8'          # driving eighths (no "root, root, octave" opening)
PUMP_H = 'R/8 8/8 R/8 ap/8'
# round 3: the pump walks through the chord — the 3rd on beat 3 and the 7th on 4 (the bass grids below spell the
# 7ths the comping leaves implicit: Em → Em7 = D, C → Cmaj7 = B), then the chromatic approach
PUMP7 = 'R/8 8/8 R/8 5/8 3/8 8/8 7/8 ap/8'
LIFT7 = 'R/8 8/8 r/8 3/8 5/8 8/8 7/8 ap/8'          # C: the hop on 2& now climbs through the 3rd
BASS_A = 'Em7 | Cmaj7 | Am7 | B7 | Em7 | Cmaj7 | F#m7b5 | B7b9'
BASS_A2 = 'Em7 | Cmaj7 | Am7 | B7 | Em7 | Cmaj7 | Am7 | B7'
BASS_D = 'Em7 | Em7 | C | C | Am7 | Am7 | B7sus4 | B7'   # C bars: no B under the pads' C; bar 4 keeps the plain pump (SHADOW sings E♭)
DRIVE = 'k+h/8 k/16 k/16 s+h/8 h/8 k+h/8 k/16 k/16 s+h/8 h/8 |'
DRIVE_C = 'k+c/8 k/16 k/16 s+h/8 h/8 k+h/8 k/16 k/16 s+h/8 h/8 |'
DRIVE_F4 = 'k+h/8 k/16 k/16 s+h/8 h/8 s/16 s s s t1/16 t1 t3/16 t3 |'
DRIVE_F8 = 'k+h/8 s/16 s s/16 s t1/16 t1 t2/16 t2 t3/16 t3 s/16 s s s |'


def seven(chords_pitches: list, nbars: int = 8, dur: str = '8', accent: bool = True) -> str:
    """The 3+2+2 ostinato: a 7-eighth cell that runs across 4/4 bars (64 eighths = 9 cells + 1).
    `chords_pitches[bar]` = the 7 pitches of the cell during that bar (the cell follows the harmony)."""
    out, bar = [], []
    for i in range(nbars * 8):
        cell = chords_pitches[i // 8]
        g = i % 7
        mark = '!' if (accent and g == 0) else ('' if g in (3, 5) else '?')
        bar.append(f'{cell[g]}/{dur}{mark}')
        if len(bar) == 8:
            out.append(' '.join(bar))
            bar = []
    return ' | '.join(out)


def seven_drums(nbars: int = 8) -> str:
    """Kick on every cell start, snare on the two 2-eighth groups, closed hats on every eighth."""
    out, bar = [], []
    for i in range(nbars * 8):
        g = i % 7
        hit = 'k+h' if g == 0 else ('s+h' if g in (3, 5) else 'h')
        bar.append(f'{hit}/8')
        if len(bar) == 8:
            out.append(' '.join(bar))
            bar = []
    return ' | '.join(out) + ' |'


E_CELL = ['e4', 'b4', 'e5', 'd5', 'b4', 'g4', 'b4']
F_CELL = ['e4', 'c5', 'f5', 'e5', 'c5', 'a4', 'c5']
C_CELL = ['c4', 'g4', 'c5', 'b4', 'g4', 'e4', 'g4']
B_CELL = ['b3', 'f#4', 'b4', 'a4', 'f#4', 'd#4', 'f#4']
B_CELLS = [E_CELL, E_CELL, F_CELL, E_CELL, C_CELL, C_CELL, B_CELL, B_CELL]


def build() -> Song:
    s = Song(id='final', title='Ashwing Matriarch', bpm=176, meter=(4, 4), key='Em',
             form=['intro', '|:', 'A', 'A2', 'B', 'C', 'D', ':|'],
             mix={'echo': {'delay_ms': 176, 'feedback': 0.38, 'volume': 0.26, 'fir': 'soft'}, 'highpass_hz': 40},
             description='Final boss: the Ashwing hook in E minor, a lopsided 3+2+2 bridge where SHADOW and the '
                         'SENTINEL CALL trade bars, the main theme in G with the Bell answered, a rising push.')
    s.section('intro', 4, CH_INTRO)
    s.section('A', 8, CH_A)
    s.section('A2', 8, CH_A2)
    s.section('B', 8, CH_B)
    s.section('C', 8, CH_C)
    s.section('D', 8, CH_D)

    shadow_e = SHADOW.question('Em', 3) + ' r/8'                     # e3 f3 e3 b♭3 g3
    shadow_c = tr(SHADOW.question('Em', 3), -4) + ' r/8'             # c3 d♭3 c3 g♭3 e♭3
    shadow_b = tr(SHADOW.question('Em', 3), -5) + ' r/8'             # b2 c3 b2 f3 d3
    call = SENTINEL.question('Em', 5)                                # b4 e5 a5 b5 a5 (one bar)

    # ================================================================ base (phase 1)
    s.part('lead', 'chip_pulse25', 'base', vel=12, gain=1) \
        .at('intro', 4, "r/2 b5/16 c6/16 d#6/16 e6/16 f#6/8' r/8") \
        .notes('A', bars(*HOOK)).notes('A2', bars(*HOOK[:4], *HOOK2_END)) \
        .notes('C', bars(*FINALE), motifs={1: BELL, 3: BELL, 5: BELL}).notes('D', bars(*D_LEAD))
    s.part('glock', 'glock', 'base', octave=1, vel=-22).double('lead', 'C')
    s.part('tpt', 'trumpet', 'base', vel=6) \
        .at('B', 2, call, motif=SENTINEL).at('B', 4, call, motif=SENTINEL).at('B', 6, tr(call, -4), motif=SENTINEL) \
        .at('B', 8, 'b4/8 c#5/8 d#5/8 e5/8 f#5/8 a5/8 b5/4') \
        .double('lead', 'C', octave=-1)
    s.part('koto', 'koto', 'base', vel=4, gain=2) \
        .at('A', 4, KOTO_RUN_4).at('A', 8, KOTO_RUN_8).at('A2', 4, KOTO_RUN_4) \
        .gen('A2', 'arp:up16', voicing='triad', bars=(5, 8), low=64, high=86, vel=66) \
        .notes('B', seven(B_CELLS))
    s.part('pizz', 'pizz', 'base', vel=-6).notes('B', seven(B_CELLS, accent=False))
    s.part('arps', 'chip_pulse12', 'base', vel=-14) \
        .gen('intro', 'arp:up16', voicing='triad', bars=(3, 4), low=62, high=83) \
        .gen('D', 'arp:up16', voicing='triad', low=64, high=86)
    s.part('organ', 'organ_drawbar', 'base', vel=-8) \
        .notes('intro', bars(shadow_e, 'e3/1', shadow_c, '[b2 f#3]/2. r/4'), motifs={1: SHADOW, 3: SHADOW}) \
        .gen(['A', 'A2'], 'comp:stabs', voicing='triad', low=55, high=71) \
        .gen(['B', 'D'], 'pad:sustain', voicing='triad', low=52, high=67, vel=62) \
        .gen('C', 'comp:charleston', voicing='triad', low=55, high=72)
    s.part('bone', 'trombone', 'base', vel=6) \
        .notes('intro', bars(shadow_e, 'r/1', shadow_c, "[b2 f#3]/4 r/8 [b2 f#3]/8' r/4 [b2 d#3]/4")) \
        .at('B', 1, shadow_e, motif=SHADOW).at('B', 3, shadow_e, motif=SHADOW) \
        .at('B', 5, shadow_c, motif=SHADOW).at('B', 7, shadow_b, motif=SHADOW) \
        .at('D', 2, shadow_e, motif=SHADOW).at('D', 4, shadow_c, motif=SHADOW).at('D', 6, tr(shadow_e, 5), motif=SHADOW)
    s.part('tuba', 'tuba', 'base', octave=-1, vel=-2).double('bone', ['intro', 'B', 'D'])
    s.part('strings', 'strings', 'base', vel=-6).gen(['A', 'A2'], 'pad:sustain', voicing='triad', low=52, high=67, vel=58) \
        .gen('C', 'pad:sustain', voicing='triad', low=55, high=72, vel=66)
    s.part('bass', 'slap_bass', 'base', vel=6) \
        .notes('intro', bars('e2/8 e3/8 r/8 e2/8 r/2', 'e2/8 e3/8 r/8 e2/8 f2/8 g2/8 a2/8 bb2/8',
                             'c2/8 c3/8 r/8 c2/8 r/2', "b1/4 r/8 b1/8' r/4 d#2/4")) \
        .notes('A', walk(BASS_A, PUMP7, PUMP_H, low=40, nxt='Em')) \
        .notes('A2', walk(BASS_A2, PUMP7, PUMP_H, low=40, nxt='Em')) \
        .notes('B', bars(*['e2/4. e2/8 r/8 e2/4 e2/8'] * 2, 'e2/4. f2/8 r/8 f2/4 f2/8', 'e2/4. e2/8 r/8 e2/4 g2/8',
                         *['c2/4. c2/8 r/8 c2/4 c2/8'] * 2, 'b1/4. b1/8 r/8 b1/4 b1/8', 'b1/8 c#2/8 d#2/8 e2/8 f#2/8 a2/8 b2/4')) \
        .notes('C', walk(CH_C, LIFT7, 'R/8 8/8 5/8 ap/8', low=38, nxt='Em')) \
        .notes('D', bars(*[(walk(BASS_D, PUMP, PUMP_H, low=40, nxt='Em') if i == 3 else walk(BASS_D, PUMP7, PUMP_H, low=40, nxt='Em'))
                           .split(' | ')[i] for i in range(8)]))
    s.part('kit', 'drums_power', 'base', vel=-2) \
        .notes('intro', bars('k+c/4 r/2.', 'k/8 k/8 s/8 k/8 k/8 k/8 s/8 s/8', 'k+c/4 r/2.',
                             "k+c/4 r/8 k/8 r/4 " + roll('s', '16', 4, 80, 116))) \
        .pattern(['A', 'A2', 'C'], DRIVE, fills={1: DRIVE_C, 4: DRIVE_F4, 5: DRIVE_C, 8: DRIVE_F8}) \
        .notes('B', seven_drums()) \
        .pattern('D', DRIVE, fills={1: DRIVE_C, 5: DRIVE_C, 8: roll('s', '16', 16, 64, 120) + ' |'})
    s.part('chip_hats', 'chip_kit', 'base', vel=-30).pattern(['A', 'A2', 'C', 'D'], '(h/16 h? h h?)x4 |')

    # ================================================================ intensity (phase 2+)
    s.part('horn', 'horn', 'intensity', vel=14, gain=-2) \
        .at('A2', 1, bars('b4/1', 'g4/1', 'a4/1', 'f#4/2 a4/2', 'b4/1', 'g4/2 e4/2', 'e4/1', 'd#4/1')) \
        .at('B', 2, call).at('B', 4, call)
    s.part('choir', 'choir_ahh', 'intensity', vel=16) \
        .gen(['A', 'A2', 'B', 'D'], 'pad:sustain', voicing='triad', low=52, high=67, vel=66) \
        .double('lead', 'C', octave=-1)
    s.part('trem', 'tremolo', 'intensity', vel=16).gen(['intro', 'B', 'D'], 'pad:sustain', voicing='triad', low=50, high=69, vel=74)
    s.part('brass', 'brass', 'intensity', vel=10).gen(['A', 'A2', 'D'], 'comp:stabs', voicing='close', low=55, high=72) \
        .gen('C', 'pad:sustain', voicing='close', low=55, high=72, vel=72)
    s.part('timp', 'timpani', 'intensity', vel=10) \
        .pattern(['A', 'A2'], 'e2/4 r/4 b1/4 r/4 |', fills={4: 'e2/8 e2/8 b1/8 b1/8 e2/16 e2 e2 e2 b1/8 b1/8 |',
                                                         8: roll('b1', '16', 16, 50, 116) + ' |'}) \
        .at('B', 8, roll('b1', '16', 16, 50, 116)) \
        .at('C', 1, 'g2/4 r/2.').at('C', 5, 'd2/4 r/4 d2/4 r/4').at('C', 6, 'g2/4 r/2.') \
        .at('D', 7, roll('b1', '16', 16, 40, 100)).at('D', 8, roll('b1', '16', 16, 70, 120))
    s.part('hits', 'orch_hit', 'intensity', vel=12) \
        .at('A', 1, '[e3 g3 b3 e4]/4 r/2.').at('A', 8, 'r/2 [b3 d#4 f#4 a4]/4 r/4') \
        .at('B', 1, '[e3 g3 b3 e4]/4 r/2.').at('C', 1, '[g3 b3 d4 g4]/4 r/2.').at('C', 6, '[g3 b3 d4 g4]/4 r/2.') \
        .at('D', 8, 'r/2 [b3 d#4 f#4 a4]/4 r/4')
    s.part('str_oct', 'strings', 'intensity', octave=-1, vel=10).double('lead', ['A', 'A2', 'D'])
    s.part('kit2', 'drums', 'intensity', vel=-4) \
        .pattern(['A', 'A2', 'C', 'D'], 'h/16 h? o/16 h? cl+h h? o/16 h? h h? o/16 h? cl+h h? o/16 h? |')
    return s


songs = [build()]
