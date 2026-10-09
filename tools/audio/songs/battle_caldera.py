"""'Ashfall Rave' — battle family 7 (volcano maps: 8-3, 8-4, 8-5 before the dragon, Ashwing Summit; arena: the
Tactical Challenge endless colosseum) and its wave sting. ORIGINAL composition (docs/AUDIO.md §4.1 rules), batch B2,
audio r3.

Lane: HARDTEK. 174 bpm straight, B minor (the dominant of `final`'s E minor, so the Ashwing boss takes over well).
A driven 909 kick on every beat with a long tail, a saw bass rolling on the e-&-a between the kicks (pumped by the
kick), offbeat supersaw chords, 808 claves on a 3-3-2, snare-roll builds and a kick-drop breakdown. Cute but intense:
a bouncy chip + glockenspiel hook with octave-leap pickups, and every held hook note is answered by a chopped saw
stab with a "hey!" on beat 3 (an orchestra hit lands on the next downbeat in the intensity stem).
Stems: base (build phase) + intensity (wave active).
    intro  2 bars  kick + rolling bass + claves, a chip arp spin-up
    A      8 bars  the hook (2-bar cells: two 16ths, an octave leap, a 16th run, then a held note → STAB + HEY)
    B      8 bars  SHADOW (B–C–B–F–D, the monsters) as an acid riff with a 303 squelch, one bar each, answered by
                   the chip + glock in the next bar; the acid filter opens over the section; C major (♭II) colour
    BR     8 bars  breakdown: the kick drops out, beat-pumped supersaw, the music box rings BELL in B minor
                   (F♯–B–G–A♯) at half speed and leaves it hanging, twice; snare roll 16ths → 32nds → kick roll
    D      8 bars  the drop: the hook again with a VRC6 chip-saw counter-line, claps, more hey chops
    H      8 bars  HOPE, D major: 2 bars of kick + rolling bass alone with acid squelch replies (bass feature), the
                   lead answers with BELL — and this time it is answered (A–D–B–C♯ → D, chip + glock + supersaw) —
                   then the hook turned major (lydian G); F♯7 drops back into B minor
Form: intro |: A B BR D H :|  — 2 + 40 bars (55.2 s loop).

Bass: `saw_bass` (role drive) 12 notes a bar on e-&-a, octave pops, the ♭2 C on the tonic, a ♭7 dip and a semitone
approach into every bar line. Intensity: brass stabs doubling the chops, synth-brass SENTINEL rally (B minor in D,
D major in H), a chip-pulse 16th arp counter, the acid riff under the drop, ride, clap rolls, chip-noise 16ths,
reverse-cymbal sweeps and orchestra hits on the downbeats after every "hey".

Leitmotifs: SHADOW (B acid calls, the F♯ form in B8), BELL (BR unanswered in B minor, H answered in D major),
SENTINEL CALL (synth brass, intensity).
review: originality — hook, answers, acid lines, bass rolls and counter-lines are new; checked by ear-memory against
well-known hard dance / hardtek / rave / happy-hardcore riffs (Teknival-style tribe loops, Sandstorm, Children,
Dragostea-era eurodance, Toby Fox's and Camellia-style game rave tracks) and dragon/volcano stage themes: no shared
hook, riff or bass line. `studio.py originality` clean. Composer B2, 2026-10-09.
"""
from sakura_audio.song import Song
from motifs import BELL, SENTINEL, SHADOW
from _battle_kit import roll
from _tek import bars, rest, line, hits, hold

CH_INTRO = 'Bm | Bm F#7'
CH_A = 'Bm | Gmaj7 | Em7 | F#7sus4 F#7 | Bm | Gmaj7 | Em7 A | F#7sus4 F#7'
CH_B = 'Bm | Gmaj7 | Bm | Em7 F#7 | Bm | Gmaj7 | Cmaj7 | F#7sus4 F#7'
CH_BR = 'Bm Gmaj7 | F#7 | Em9 | Cmaj7 | Bm Gmaj7 | F#7 | Em9 | F#7sus4 F#7'
CH_D = 'Bm | Gmaj7 | Em7 | F#7sus4 F#7 | Bm | Gmaj7 | Em7 F#m7 | Gmaj7 A7'
CH_H = 'Dmaj7 | Dmaj7 | Bm7 A7 | Dmaj7 | Gmaj7 | F#m7 Bm7 | Em7 A7 | F#7sus4 F#7'

HOOK = [
    'b4/16 b4/16 b5/8 r/16 a5/16 b5/16 d6/16 f#6/8 e6/8 r/8 d6/8',          # 1 Bm      two 16ths, the octave leap
    'b5/16 d6/16 e6/8 d6/8 b5/8~ b5/4 r/4',                                  # 2 Gmaj7   held … STAB + HEY on 3
    'g4/16 g4/16 g5/8 r/16 f#5/16 g5/16 b5/16 e6/8 d6/8 r/8 b5/8',          # 3 Em7
    'c#6/16 d6/16 c#6/8 b5/8 a#5/8~ a#5/4 r/4',                              # 4 F♯7sus4 F♯7
    'b4/16 b4/16 b5/8 r/16 a5/16 b5/16 d6/16 f#6/8 e6/8 r/8 d6/8',          # 5 Bm
    'b5/16 d6/16 e6/8 f#6/8 g6/8~ g6/4 r/4',                                 # 6 Gmaj7
]
A_END = [
    'a6/16 g6/16 e6/8 b5/8 e6/8 c#6/16 d6/16 e6/8 a5/8 c#6/8',              # 7 Em7 A
    'b5/8 c#6/8 a#5/8~ a#5/8 r/2',                                           # 8 F♯7sus4 F♯7
]
D_END = [
    'a6/16 g6/16 e6/8 b5/8 e6/8 c#6/16 d6/16 f#6/8 a5/8 c#6/8',             # 7 Em7 F♯m7
    'b5/8 d6/8 g6/8 e6/8~ e6/4 r/4',                                         # 8 Gmaj7 A7  → D major
]
B_ANSWER = {   # chip + glock answer the acid SHADOW calls
    2: 'r/8 d6/16 e6/16 f#6/8 d6/8 b5/8 g5/8 a5/16 b5/16 d6/8',             # Gmaj7
    4: 'r/8 b5/16 c#6/16 d6/8 b5/8 a#5/8 f#5/8 e6/8 c#6/8',                 # Em7 F♯7
    6: 'r/8 d6/16 e6/16 f#6/8 a6/8 g6/8 f#6/8 e6/16 d6/16 b5/8',            # Gmaj7
    7: 'e5/8 g5/8 b5/8 g5/8 c6/4 b5/4',                                      # Cmaj7 (♭II) — the acid rests
}
ACID_B = {     # SHADOW in 16ths, the D held, then a squelching tail
    1: 'b2/16! c3/16 b2/16 f3/16! d3/4 r/16 b2/16! b2/16 b3/16 b2/16 a2/16 c3/16! b2/16',
    3: 'b2/16! c3/16 b2/16 f3/16! d3/4 r/16 d3/16! d3/16 d4/16 c#3/16 b2/16 a2/16! f#2/16',
    5: 'b3/16! c4/16 b3/16 f4/16! d4/4 r/16 b3/16! b3/16 b2/16 b3/16 a3/16 c4/16! b3/16',
    8: 'f#2/16! g2/16 f#2/16 c3/16! a2/4 r/2',                                # SHADOW on F♯ (♭9, ♭5, ♯9)
}
H_LEAD = [
    'r/1', 'r/1',                                                            # 1-2 the bass feature
    BELL.question('D', 6) + ' r/8',                                          # 3 Bm7 A7   a5 d6 b5 c♯6 …
    BELL.answer('D', 6) + ' r/2',                                            # 4 Dmaj7    … answered: d6
    'd5/16 d5/16 d6/8 r/16 c#6/16 d6/16 f#6/16 a6/8 g6/8 r/8 f#6/8',        # 5 Gmaj7    the hook, major + lydian
    'c#6/16 e6/16 f#6/8 e6/8 d6/8~ d6/4 r/4',                                # 6 F♯m7 Bm7
    'g6/16 f#6/16 e6/8 b5/8 e6/8 c#6/16 d6/16 e6/8 g6/8 e6/8',              # 7 Em7 A7
    'f#6/8 e6/8 a#5/8~ a#5/8 r/2',                                           # 8 F♯7sus4 F♯7 → B minor
]
H_BASS = ('r/16 d2/16 d3/16 d2/16 r/16 a2/16 d3/16 f#3/16 r/16 e3/16 d3/16 a2/16 r/16 f#2/16 a2/16 c#3/16 | '
          'r/16 d3/16 c#3/16 a2/16 r/16 b2/16 a2/16 f#2/16 r/16 g2/16 f#2/16 e2/16 r/16 d2/16 e2/16 a#2/16')
H_SQUELCH = "r/2 a3/16! a3/16 r/8 f#3/16! d3/16 r/8 | r/2 b3/16! a3/16 r/8 e4/16! c#4/16 r/8"
COUNTER_D = ['d5/2 f#5/2', 'g5/2. f#5/4', 'e5/2 g5/2', 'b4/2 a#4/2', 'd5/2 b4/2', 'd5/2 e5/4 f#5/4', 'g5/2 a5/2',
             'b5/2 c#5/2']

# rolling bass (16ths; each beat starts with a rest = the kick)
Q1 = 'r/16 R/16 R/16 8/16 r/16 R/16 R/16 b7/16 r/16 R/16 R/16 8/16 r/16 5/16 b3^/16 ap/16'     # minor chords
Q2 = 'r/16 R/16 R/16 8/16 r/16 R/16 b2/16 R/16 r/16 R/16 R/16 8/16 r/16 b7/16 5/16 ap/16'      # tonic: the ♭2 rub
Q3 = 'r/16 R/16 R/16 8/16 r/16 R/16 R/16 5/16 r/16 R/16 R/16 8/16 r/16 3/16 5/16 ap/16'        # major chords
QH = 'r/16 R/16 R/16 8/16 r/16 5/16 8/16 ap/16'
Q_HALF = 'R/8. R/16 r/4 8/8 r/8 R/16 5/16 7/16 ap/16'
ACID_P = 'R/16! R/16 8/16 R/16 5/16! R/16 7/16 3/16! R/16 R/16 8/16 R/16 3/16! R/16 5/16 ap/16'
ACID_PH = 'R/16! R/16 8/16 R/16 5/16! R/16 3/16 ap/16'

# kit (drums_909 for everything but the kick; kick_hard = the driven 909 kick)
KICK = 'k/4 k/4 k/4 k/4 |'
KICK_8 = 'k/4 k/4 k/4 k/8 k/8 |'
HATS = '(h?/16 h/16 o/16 h/16)x4 |'
HATS_C = 'c/16 h/16 o/16 h/16 (h?/16 h/16 o/16 h/16)x3 |'
CLAP = 'r/4 cl/4 r/4 cl/4 |'
CLAP_F4 = 'r/4 cl/4 s/16 s/16 s/16 s/16 cl/16 t2/16 t3/8 |'
CLAP_F8 = 'r/4 cl/4 t1/16 t1/16 t2/16 t2/16 t3/16 t3/16 s/16 s/16 |'
CLAVES = 'cv/16 r/16 r/16 rs/16 r/16 r/16 cv/16 r/16 rs/16 r/16 r/16 cv/16 r/16 r/16 rs/16 r/16 |'

OFF = [(2, 2, ''), (6, 2, ''), (10, 2, ''), (14, 2, '')]                 # supersaw on every 'and'
CHOP = [(8, 2, '!'), (11, 1, ''), (14, 2, '!')]                         # 3 (with the HEY), 3a, 4&
CHOP8 = [(8, 2, '!'), (10, 2, '!'), (12, 1, ''), (13, 1, ''), (14, 2, '!')]

BUSY = {
    'melody': {'lead': None, 'glock': None, 'saw_bell': None},
    'bass': ['bass'], 'primary_bass': 'bass',
    'cat': {'acid': 'riff', 'acid_d': 'riff', 'stab': 'stab', 'hey': 'answer', 'brass': 'stab', 'hits': 'stab',
            'off': 'comp', 'counter': 'counter', 'syn_brass': 'counter', 'chiparp': 'arp', 'box': 'answer',
            'pad_br': 'pad', 'riser': 'pad', 'rev': 'perc', 'sweep': 'perc'},
}


def build() -> Song:
    s = Song(id='battle_caldera', title='Ashfall Rave', bpm=174, meter=(4, 4), key='Bm',
             form=['intro', '|:', 'A', 'B', 'BR', 'D', 'H', ':|'],
             mix={'echo': {'delay_ms': 176, 'feedback': 0.34, 'volume': 0.22, 'fir': 'soft'}, 'highpass_hz': 35},
             description='Battle (volcano, arena/endless): hardtek — driven kick on every beat, rolling saw bass, '
                         'SHADOW acid riff, chopped saw stabs + "hey!", kick-drop breakdown, D-major hope lift.')
    s.busy = BUSY
    s.section('intro', 2, CH_INTRO)
    s.section('A', 8, CH_A)
    s.section('B', 8, CH_B)
    s.section('BR', 8, CH_BR)
    s.section('D', 8, CH_D)
    s.section('H', 8, CH_H)

    # ================================================================ base
    s.part('kick', 'kick_hard', 'base', vel=6) \
        .pattern(['intro', 'B'], KICK) \
        .pattern(['A', 'D'], KICK, fills={8: KICK_8}) \
        .pattern('H', KICK, fills={8: 'k/4 k/4 k/16 k/16 k/16 k/16 k/16 k/16 k/16 k/16 |'}) \
        .notes('BR', bars(rest(7), 'r/2 k/16 k/16 k/16 k/16 k/16 k/16 k/16 k/16'))
    s.part('hats', 'drums_909', 'base', vel=-12) \
        .notes('intro', bars('r/1', HATS[:-2])) \
        .pattern(['A', 'B', 'D'], HATS, fills={1: HATS_C, 5: HATS_C}) \
        .notes('BR', bars('r/1', 'r/1', '(h?/16 h?/16 h/16 h?/16)x4', '(h?/16 h?/16 h/16 h?/16)x4',
                          HATS[:-2], HATS[:-2], HATS[:-2], '(h/16 h/16 o/16 h/16)x3 o/4')) \
        .notes('H', bars('(h?/16 h/16 h?/16 h/16)x4', '(h?/16 h/16 h?/16 h/16)x4', HATS_C[:-2], HATS[:-2],
                         HATS_C[:-2], HATS[:-2], HATS[:-2], HATS[:-2]))
    s.part('clap', 'drums_909', 'base', vel=-4) \
        .notes('intro', bars('r/1', 'r/4 cl/4 ' + roll('s', '16', 8, 50, 104))) \
        .pattern(['A', 'B', 'D'], CLAP, fills={4: CLAP_F4, 8: CLAP_F8}) \
        .notes('BR', bars('r/1', 'r/1', 'r/1', 'r/2 r/4 cl/16 cl/16 cl/16 cl/16', 'r/4 cl/4 r/4 cl/4', 'r/4 cl/4 r/4 cl/4',
                          roll('s', '16', 16, 40, 96), roll('s', '32', 16, 70, 112) + ' r/2')) \
        .notes('H', bars('r/1', 'r/2 r/4 s/16 s/16 s/16 s/16', CLAP[:-2], CLAP_F4[:-2], CLAP[:-2], CLAP[:-2],
                         CLAP[:-2], CLAP_F8[:-2]))
    s.part('claves', 'drums_909', 'base', vel=-12).pattern(['intro', 'A', 'B', 'BR', 'D', 'H'], CLAVES)

    pump = {'pump': {'key': 'kick', 'notes': ['k'], 'depth_db': 7, 'release_beats': 0.35}}
    s.part('bass', 'saw_bass', 'base', vel=0, gain=-2, fx=pump) \
        .notes('intro', line(CH_INTRO, Q2, QH, low=38, nxt='Bm')) \
        .notes('A', line(CH_A, [Q2, Q3, Q1, Q1, Q2, Q3, Q1, Q1], QH, low=38, nxt='Bm')) \
        .notes('B', line(CH_B, [Q2, Q3, Q2, Q1, Q2, Q3, Q3, Q1], QH, low=38, nxt='Bm')) \
        .notes('BR', bars('r/1', 'r/1', line('Em9 | Cmaj7', Q_HALF, low=38, nxt='Bm'),
                          line('Bm Gmaj7 | F#7 | Em9 | F#7sus4 F#7', [Q1, Q1, Q1, Q1], QH, low=38, nxt='Bm'))) \
        .notes('D', line(CH_D, [Q2, Q3, Q1, Q1, Q2, Q3, Q1, Q1], QH, low=38, nxt='Dmaj7')) \
        .notes('H', bars(H_BASS, line('Bm7 A7 | Dmaj7 | Gmaj7 | F#m7 Bm7 | Em7 A7 | F#7sus4 F#7', [Q3, Q3, Q3, Q3, Q3, Q3],
                                      QH, low=38, nxt='Bm')))
    s.part('acid', 'acid_bass', 'base', vel=6, gain=1,
           fx={'filter': {'auto': hold(['B', 1, 380], ['B', 9, 2800], ['H', 1, 1400], ['H', 3, 1400])}}) \
        .notes('B', bars(*[ACID_B.get(b, 'r/1') for b in range(1, 9)]), motifs={1: SHADOW, 3: SHADOW, 5: SHADOW, 8: SHADOW}) \
        .notes('H', bars(H_SQUELCH, rest(6)))

    s.part('off', 'supersaw', 'base', vel=-12, gain=-3, fx={'pump': {'key': 'kick', 'notes': ['k'], 'depth_db': 6,
                                                                      'release_beats': 0.3}}) \
        .notes('A', hits(CH_A, OFF, 57, 74, style='close')) \
        .notes('D', hits(CH_D, OFF, 57, 74, style='close')) \
        .notes('B', hits(CH_B, OFF, 57, 74, style='close')) \
        .notes('H', bars('r/1', 'r/1', hits('Bm7 A7 | Dmaj7 | Gmaj7 | F#m7 Bm7 | Em7 A7 | F#7sus4 F#7', OFF, 57, 74,
                                            style='close')))
    s.part('stab', 'saw_stab', 'base', vel=-4, gain=0) \
        .notes('A', hits(CH_A, [], 55, 72, per_bar={2: CHOP, 4: CHOP, 6: CHOP, 8: CHOP8})) \
        .notes('D', hits(CH_D, [], 55, 72, per_bar={2: CHOP, 4: CHOP, 6: CHOP, 8: CHOP8})) \
        .notes('B', hits(CH_B, [], 55, 72, per_bar={8: CHOP8})) \
        .notes('H', hits(CH_H, [], 55, 72, per_bar={4: CHOP, 6: CHOP, 8: CHOP8}))
    s.part('hey', 'vox_chop', 'base', vel=4) \
        .at(['A', 'D'], 2, "r/2 b4/8' r/8 r/4").at(['A', 'D'], 4, "r/2 f#4/8' r/8 r/4") \
        .at(['A', 'D'], 6, "r/2 b4/8' r/8 r/4").at('A', 8, "r/2 f#4/8' f#4/8' r/4").at('D', 8, "r/2 a4/8' a4/8' r/4") \
        .at('B', 8, "r/2 f#4/8' f#4/8' r/4").at('H', 4, "r/2 a4/8' r/8 r/4").at('H', 8, "r/2 f#4/8' f#4/8' r/4")

    s.part('lead', 'chip_pulse25', 'base', vel=8, gain=1) \
        .notes('intro', bars('r/1', 'r/2 b4/16 d5/16 f#5/16 b5/16 d6/16 f#6/16 a#5/16 c#6/16'), vel=-10) \
        .notes('A', bars(*HOOK, *A_END)) \
        .notes('B', bars(*[B_ANSWER.get(b, 'r/1') for b in range(1, 9)])) \
        .notes('BR', bars('r/1', 'r/1', 'b5/4. a5/8 g5/4 f#5/4', 'e5/1', 'r/1', 'r/1', 'r/1', 'r/1'), vel=-16) \
        .notes('D', bars(*HOOK, *D_END)) \
        .notes('H', bars(*H_LEAD), motifs={3: BELL})
    s.part('glock', 'glock', 'base', octave=1, vel=-14, gain=-2).double('lead', ['A', 'B', 'D', 'H'])
    s.part('counter', 'chip_saw', 'base', vel=-6, gain=-5).notes('D', bars(*COUNTER_D))
    s.part('saw_bell', 'supersaw', 'base', vel=-6, gain=-4) \
        .at('H', 3, BELL.question('D', 5) + ' r/8 | ' + BELL.answer('D', 5) + ' r/2', motif=BELL)

    s.part('box', 'music_box', 'base', vel=6, gain=1.5) \
        .notes('BR', bars(BELL.question('Bm', 5, augment=2).rsplit(' ', 1)[0], 'a#5/2. r/4', 'r/1', 'r/1',
                          BELL.question('Bm', 6, augment=2).rsplit(' ', 1)[0], 'a#6/2. r/4', 'r/1', 'r/1'),
               motifs={1: BELL, 5: BELL})
    s.part('pad_br', 'supersaw', 'base', vel=-10, gain=-3, fx={'pump': {'key': 'beat', 'depth_db': 7,
                                                                         'release_beats': 0.45}}) \
        .notes('BR', hits(CH_BR, [(0, 8, ''), (8, 8, '')], 54, 74, style='close'))
    s.part('riser', 'sweep_pad', 'base', vel=0) \
        .notes('intro', bars('[b3 f#4 d5]/1', '[a#3 f#4 c#5]/1')) \
        .notes('BR', bars(rest(6), '[e3 b3 g4]/1', '[f#3 c#4 a#4]/1'))
    s.part('rev', 'rev_cymbal', 'base', vel=-6).notes('BR', bars(rest(7), 'r/2 c4/2'))

    # ================================================================ intensity
    s.part('brass', 'brass_stab', 'intensity', vel=0, gain=0).double('stab')
    s.part('syn_brass', 'synth_brass', 'intensity', vel=4, gain=2.5) \
        .notes('D', bars(SENTINEL.question('Bm', 4), 'd4/2 f#4/2', 'g4/2 e4/2', 'f#4/2 a#4/2',
                         SENTINEL.question('Bm', 4), 'd4/2 b3/2', 'e4/2 f#4/2', 'g4/2 a4/2'),
               motifs={1: SENTINEL, 5: SENTINEL}) \
        .notes('H', bars('r/1', 'r/1', 'f#4/2 e4/2', 'f#4/1', SENTINEL.question('D', 4), 'a4/2 f#4/2',
                         SENTINEL.question('D', 4), 'f#4/2 a#4/2'), motifs={5: SENTINEL, 7: SENTINEL})
    s.part('chiparp', 'chip_pulse12', 'intensity', vel=-14, gain=-1) \
        .gen(['A', 'D'], 'arp:up16', voicing='close', low=64, high=79) \
        .gen('H', 'arp:up16', voicing='close', low=64, high=79, bars=(3, 8))
    s.part('acid_d', 'acid_bass', 'intensity', vel=0, gain=-2,
           fx={'filter': {'auto': hold(['D', 1, 300], ['D', 9, 3000])}}) \
        .notes('D', line(CH_D, ACID_P, ACID_PH, low=47, nxt='Dmaj7'))
    s.part('ride', 'drums_909', 'intensity', vel=-16).pattern(['D', 'H'], '(rd/8 r/8)x4 |')
    s.part('clap_roll', 'drums_909', 'intensity', vel=-10) \
        .pattern(['A', 'B', 'D', 'H'], 'r/2. r/8 r/16 cl/16 |',
                 fills={4: 'r/2 cl/16 cl/16 cl/16 cl/16 cl/16 cl/16 cl/16 cl/16 |',
                        8: 'r/2 ' + roll('cl', '16', 8, 60, 110) + ' |'})
    s.part('noise', 'chip_kit', 'intensity', vel=-26).pattern(['A', 'B', 'D', 'H'], '(h/16 h?/16 h/16 h?/16)x4 |')
    s.part('sweep', 'rev_cymbal', 'intensity', vel=-10).at(['A', 'D', 'H'], 8, 'r/2 c4/2')
    s.part('hits', 'orch_hit', 'intensity', vel=2) \
        .at(['A', 'D'], 3, '[e4 g4 b4]/4 r/2.').at(['A', 'D'], 5, '[d4 f#4 b4]/4 r/2.') \
        .at(['A', 'D'], 7, '[e4 g4 b4]/4 r/2.').at(['A', 'D', 'B'], 1, '[d4 f#4 b4]/4 r/2.') \
        .at('H', 1, '[d4 f#4 a4]/4 r/2.').at('H', 5, '[d4 g4 b4]/4 r/2.').at('H', 7, '[e4 g4 b4]/4 r/2.')
    return s


def wave() -> Song:
    """Wave-start sting: a driven-kick roll (16ths → 32nds), then a saw-stab hit with a 'hey!' and a crash on beat 3
    (accentBeat 2: the engine lands it on the battle loop's next strong beat)."""
    s = Song(id='wave_caldera', title='Ashfall Rave — wave', bpm=174, meter=(3, 4), key='Bm', form=['S'], bus='stinger',
             tail=0.8, extra={'accentBeat': 2},
             mix={'echo': {'delay_ms': 176, 'feedback': 0.32, 'volume': 0.22, 'fir': 'soft'}},
             description='Wave-start stinger (Ashfall Rave): kick roll, saw stab + "hey!", crash.')
    s.section('S', 1)
    s.part('kick', 'kick_hard', 'full', vel=0).notes('S', roll('k', '16', 4, 70, 100) + ' ' + roll('k', '32', 8, 80, 116)
                                                      + ' k/4')
    s.part('crash', 'drums_909', 'full', vel=-4).notes('S', roll('s', '16', 4, 40, 70) + ' ' + roll('s', '32', 8, 60, 96)
                                                       + ' c/4')
    s.part('arp', 'chip_pulse25', 'full', vel=0).notes('S', 'r/4 b4/16 d5/16 f#5/16 b5/16 d6/16 f#6/16 b6/8')
    s.part('stab', 'saw_stab', 'full', vel=10).notes('S', 'r/2 [b3 d4 f#4 b4]/4!')
    s.part('brass', 'brass_stab', 'full', vel=0).notes('S', 'r/2 [d4 f#4 b4]/4')
    s.part('hey', 'vox_chop', 'full', vel=8).notes('S', "r/2 f#4/8' r/8")
    s.part('bass', 'saw_bass', 'full', vel=4).notes('S', "r/2 b2/16 b3/16 b2/16 b3/16'")
    return s


songs = [build(), wave()]
