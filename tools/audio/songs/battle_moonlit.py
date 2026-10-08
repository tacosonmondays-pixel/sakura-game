"""'Moonlit Ripples' — battle family 2 (lake, snow, night maps). ORIGINAL composition (docs/AUDIO.md §4.1 rules).

A minor → C major chorus, 126 bpm shuffle. Stems: base (build phase) + intensity (wave active).
    intro  2 bars  kalimba ripple + harp over Am9 – E7, the triangle bass walks in
    A      8 bars  the flute hook: a gliding rise to C (♪ ♪ ♪ ♩ ♪ ♪) that falls and floats on the major 7th of F;
                   second phrase floats on F lydian (B over F) — "moonlight on water"
    A2     8 bars  the hook again, the second half climbs to F♯ (lydian) and turns toward C
    Br     8 bars  break: the music box rings BELL in A minor (E–A–F–G♯), never answered here; vibes
                   ripple back; SENTINEL CALL on the chip in the gaps (intensity); G7 pickup …
    B      8 bars  … the chorus in C answers it: BELL G–C–A–B → C (tied over the bar), flute + celesta,
                   chip counter-melody in the intensity stem; E7 turns back to A minor
Form: intro |: A A2 Br B :|  — 2 + 32 bars.

Leitmotifs: BELL minor (Br, unanswered) and answered in C (B bar 1); SENTINEL CALL (Br, intensity).
review: originality — flute hook, chorus, counter-lines and bass lines are new; only the project's own BELL /
SENTINEL motifs are reused. Checked by ear-memory against well-known water/ice/night stage themes (Mario, Zelda,
Kirby, Pokémon, Undertale/Deltarune, EarthBound/Mother): no shared hook or contour. Composer B, 2026-10-08.
"""
from sakura_audio.song import Song
from motifs import BELL, SENTINEL
from _battle_kit import bars, roll, walk

CH_INTRO = 'Am7 | E7sus4 E7'
CH_A = 'Am7 | Fmaj7 | Dm7 | E7sus4 E7 | Am7 | Fmaj7#11 | Bm7b5 E7b9 | Am7 E7'
CH_A2 = 'Am7 | Fmaj7 | Dm7 | E7sus4 E7 | Am7 | Fmaj7#11 | Dm7 G7 | Cmaj7 E7'
CH_BR = 'Am | Fmaj7 | Dm6 | E7 | Am | Fmaj7 | E7b9 | G7sus4 G7'
CH_B = 'Cmaj7 | Am7 | Fmaj7 | G7sus4 G7 | Em7 | A7 | Dm7 G7 | Cmaj7 E7'

HOOK = [
    'r/8 e5/8 a5/8 b5/8 c6/4 b5/8 a5/8',          # 1 Am9      the gliding rise
    'g5/8 e5/8~ e5/2 r/4',                        # 2 Fmaj7    … floats on the major 7th
    'r/8 f5/8 a5/8 c6/8 e6/4 d6/8 c6/8',          # 3 Dm9      the rise again, a third higher
    'b5/4. a5/8 g#5/2',                           # 4 E7sus4 E7
]
A_END = [
    'r/8 e5/8 a5/8 b5/8 c6/4 e6/8 d6/8',          # 5 Am9
    'c6/8 b5/8~ b5/2 r/4',                        # 6 Fmaj7♯11 B over F: lydian shimmer
    'a5/8 b5/8 c6/8 d6/8 f6/8 e6/8 d6/8 b5/8',    # 7 Bm7♭5 E7♭9
    'c6/8 b5/8 a5/4 r/4 b5/8 g#5/8',              # 8 Am9 E7
]
A2_END = [
    'r/8 e5/8 a5/8 b5/8 c6/4 e6/8 g6/8',          # 5 Am9      reaching higher
    'a6/8 g6/8~ g6/4 e6/4 b5/4',                  # 6 Fmaj7♯11 (B = the ♯11)
    'd6/8 e6/8 f6/8 e6/8 d6/8 c6/8 b5/8 g5/8',    # 7 Dm9 G7   toward C …
    'c6/2 b5/4 g#5/4',                            # 8 Cmaj7 E7 … but back to A minor
]
CHORUS = [
    'g5/8 c6/8 a5/4 b5/4. c6/8~',                 # 1 Cmaj7    BELL in C, answered by the tied C
    'c6/2 e6/8 d6/8 c6/8 a5/8',                   # 2 Am7
    'a5/8 c6/8 f6/4 e6/4. c6/8',                  # 3 Fmaj7
    'd6/4 c6/8 d6/8 f6/4 b5/4',                   # 4 G7sus4 G7
    'g5/8 b5/8 e6/4 d6/4. b5/8',                  # 5 Em7
    'c#6/2 e6/8 d6/8 c#6/8 a5/8',                 # 6 A7
    'f6/4. e6/8 d6/8 b5/8 g5/8 f5/8',             # 7 Dm9 G7
    'e5/2 r/8 g#5/8 b5/8 d6/8',                   # 8 Cmaj7 E7 → A minor
]
COUNTER_B = [   # chip pulse 25 % under the chorus (thirds and sixths)
    'e5/8 g5/8 e5/4 g5/4. a5/8~',
    'a5/2 c6/8 b5/8 a5/8 e5/8',
    'f5/8 a5/8 c6/4 c6/4. a5/8',
    'g5/4 a5/8 g5/8 d6/4 g5/4',
    'e5/8 g5/8 b5/4 b5/4. g5/8',
    'a5/2 c#6/8 b5/8 a5/8 e5/8',
    'd6/4. c6/8 a5/8 g5/8 d5/8 b4/8',
    'c5/2 r/8 e5/8 g#5/8 b5/8',
]
WALK = 'R/4. 5/8 8/4 7/8 ap/8'          # shuffle walk: root, fifth, octave, seventh, approach
WALK_B = 'R/4 5/8 R/8 8/4 7/8 ap/8'
HALF = 'R/4. 5/8'

BRUSH = 'k+h/8 h?/8 s+h?/8 h?/8 k+h/8 h?/8 s+h/8 h?/8 |'
BRUSH_F = 'k+h/8 h?/8 s+h?/8 h?/8 s/8 s?/8 s/8 s/8 |'
SHUF = 'k+rd/8 rd?/8 s+rd/8 rd?/8 k+rd/8 k+rd?/8 s+rd/8 rd/8 |'
SHUF_C = 'k+c/8 rd?/8 s+rd/8 rd?/8 k+rd/8 k+rd?/8 s+rd/8 rd/8 |'
SHUF_F4 = 'k+rd/8 rd?/8 s+rd/8 rd?/8 k/8 s/8 t1/8 t2/8 |'
SHUF_F8 = 'k+rd/8 rd?/8 s/8 s?/8 s/8 t1/8 t2/8 t3/8 |'


def build() -> Song:
    s = Song(id='battle_moonlit', title='Moonlit Ripples', bpm=126, meter=(4, 4), key='Am', swing=0.64,
             form=['intro', '|:', 'A', 'A2', 'Br', 'B', ':|'],
             mix={'echo': {'delay_ms': 224, 'feedback': 0.45, 'volume': 0.32, 'fir': 'soft'}, 'highpass_hz': 40},
             description='Battle (lake, snow, night): gliding A-minor flute hook, music-box break, C-major chorus.')
    s.section('intro', 2, CH_INTRO)
    s.section('A', 8, CH_A)
    s.section('A2', 8, CH_A2)
    s.section('Br', 8, CH_BR)
    s.section('B', 8, CH_B)

    # ================================================================ base
    s.part('flute', 'flute', 'base', vel=8) \
        .notes('A', bars(*HOOK, *A_END)).notes('A2', bars(*HOOK, *A2_END)) \
        .at('Br', 8, 'r/2 d5/8 e5/8 f5/8 f#5/8') \
        .notes('B', bars(*CHORUS), motifs={1: BELL})
    s.part('celesta', 'celesta', 'base', octave=1, vel=-24).double('flute', ['A2', 'B'])
    s.part('box', 'music_box', 'base').notes('Br', bars(
        BELL.question('Am', 5) + ' r/8', 'r/1', 'r/1', 'r/1',
        BELL.question('Am', 5) + ' r/8', 'r/1', BELL.question('Am', 6) + ' r/8', 'r/1'), motifs={1: BELL, 5: BELL, 7: BELL})
    s.part('vib_reply', 'vibes', 'base').at('Br', 2, 'r/4 a5/8 c6/8 e6/8 c6/8 a5/4') \
        .at('Br', 3, 'r/4 f5/8 a5/8 b5/8 a5/8 f5/4').at('Br', 4, 'r/4 g#5/8 b5/8 d6/8 b5/8 g#5/4') \
        .at('Br', 6, 'r/4 a5/8 c6/8 e6/8 g6/8 e6/4')
    s.part('vibes', 'vibes', 'base', vel=-16).gen(['A', 'A2', 'B'], 'comp:charleston', voicing='rootless', low=57, high=74)
    s.part('harp', 'harp', 'base', vel=-18).gen(['intro', 'A', 'A2', 'Br', 'B'], 'arp:updown8', voicing='triad', low=57, high=81)
    s.part('halo', 'pad_halo', 'base').gen('Br', 'pad:sustain', voicing='triad', low=55, high=72, vel=56)
    s.part('str', 'strings_slow', 'base').gen('B', 'pad:sustain', voicing='triad', low=55, high=72, vel=50)
    s.part('kal_in', 'kalimba', 'base', vel=-10).gen('intro', 'arp:up16', low=69, high=88)
    s.part('tri', 'chip_triangle', 'base') \
        .notes('intro', 'a2/2. e2/4 | e2/2 b2/4 g#2/4') \
        .notes('A', walk(CH_A, WALK, HALF, low=40, nxt='Am7')) \
        .notes('A2', walk(CH_A2, WALK, HALF, low=40, nxt='Am')) \
        .notes('Br', walk(CH_BR, 'R/2. 5/4', 'R/4 5/4', low=40, nxt='Cmaj7')) \
        .notes('B', walk(CH_B, WALK_B, HALF, low=40, nxt='Am7'))
    s.part('brush', 'drums_brush', 'base', vel=-4) \
        .notes('intro', bars('h?/8 h?/8 s?/8 h?/8 h?/8 h?/8 s?/8 h?/8', 'h/8 h?/8 s?/8 h?/8 s/8 s?/8 s/8 s/8')) \
        .pattern(['A', 'A2', 'B'], BRUSH, fills={4: BRUSH_F, 8: BRUSH_F}) \
        .pattern('Br', 'k/4 h?/8 h?/8 s?/4 h?/8 h?/8 |', fills={8: 'k/4 h?/8 h?/8 s/8 s?/8 s/8 s/8 |'})

    # ================================================================ intensity
    s.part('kit', 'drums', 'intensity', vel=14) \
        .pattern(['A', 'A2', 'B'], SHUF, fills={1: SHUF_C, 4: SHUF_F4, 5: SHUF_C, 8: SHUF_F8}) \
        .pattern('Br', 'k+rd/8 rd?/8 rs+rd/8 rd?/8 k+rd/8 rd?/8 rs+rd/8 rd?/8 |', fills={1: 'k+c/8 rd?/8 rs+rd/8 rd?/8 k+rd/8 rd?/8 rs+rd/8 rd?/8 |', 8: SHUF_F8})
    s.part('fbass', 'finger_bass', 'intensity', vel=12).double('tri', ['A', 'A2', 'Br', 'B'])
    s.part('pizz', 'pizz', 'intensity', vel=12).gen(['A', 'A2'], 'arp:updown8', voicing='triad', low=55, high=74)
    s.part('kalimba', 'kalimba', 'intensity', vel=10).gen(['Br', 'B'], 'arp:up16', low=69, high=88)
    s.part('counter', 'chip_pulse25', 'intensity', vel=12).notes('B', bars(*COUNTER_B)) \
        .at('Br', 2, SENTINEL.question('Am', 5), motif=SENTINEL).at('Br', 6, SENTINEL.question('Am', 5), motif=SENTINEL) \
        .at('A2', 5, bars('a4/2. c5/4', 'b4/1', 'a4/2 g4/2', 'e4/2 g#4/2'))
    s.part('str_hi', 'strings', 'intensity', vel=8).gen(['A', 'A2'], 'pad:sustain', voicing='triad', low=64, high=81, vel=56)
    s.part('timp', 'timpani', 'intensity').at('Br', 8, roll('g1', '16', 8, 40, 100) + ' g1/4 r/4') \
        .at('B', 1, 'c2/4 r/2.')
    s.part('swell', 'rev_cymbal', 'intensity', vel=-12).at('Br', 8, 'c4/1')
    return s


songs = [build()]
