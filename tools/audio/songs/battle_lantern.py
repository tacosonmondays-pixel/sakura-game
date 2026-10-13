"""'Lantern Hush' — battle family 3 (shrine: Ch 3 Moonveil Shrine; marsh: Ch 5 Gloomfen Marsh). ORIGINAL composition
(docs/AUDIO.md §4.1 rules), batch B3, audio r3.

Lane: SPOOKY ELEKI SURF ("eleki" = the Japanese surf-guitar boom, here played by yokai with paper lanterns).
156 bpm straight, E phrygian dominant (E F G♯ A B C D) mixed with E minor; the lift goes up a minor third to G.
A tremolo-picked surf guitar sings the tune through a long echo, a combo organ punches the stab bed, a tenor sax
honks and a koto plinks in every hole, a theremin wails, and the old shrine's music box still plays its ghost of BELL.
Stems: base (build phase) + intensity.
    intro  2 bars  floor-tom roll, organ swell, the guitar drips down an E chord, the theremin glides in
    A      8 bars  the hook in 2-bar cells: two single picks, a long tremolo note, a 16th turn, then a picked note
                   left to ring — every ringing note is answered: organ BAM on 3, koto tick-tick-ting, sax honk on 4
    B      8 bars  dialogue: the koto rings BELL phrygian (B–E–C–D) and the surf guitar answers it with E (→ the
                   answer), koto and guitar trade bars; the music box's ghost fragment answers the B7 at bar 8
    A2     8 bars  the hook again, a higher second half; the theremin's counter-line wails above, frogs ribbit
    C      4 bars  the hush + bass feature: the kit drops to toms, the surf bass plays SHADOW (E–F–E–B♭–G) alone and
                   runs it chromatically up, the detuned music box answers with BELL turned upside down
                   (B–F–A–G), then the guitar answers and a snare roll lifts into …
    D      8 bars  … the lift: the hook up a minor third in G phrygian dominant, full band; bars 7-8 turn around
                   Fm–G–F → E (the phrygian cadence) back into the loop
Form: intro |: A B A2 C D :|  — 2 + 36 bars (55.4 s loop).

Bass (`pick_bass`): surf 8ths with octave pops and a 16th pickup on the "a" of 2 (it lands with the kick's push),
then a HOLE on beat 3 where the kick hits alone, the root again on 3&, the third on 4 and a semitone approach into
the next chord (`ax`). Kit (`drums_room`): kick 1, 2a, 3, snare 2 and 4, hat 8ths (ride in B), floor-tom pickups in
bars 2/6, fills in 4/8, crashes on 1/5; tambourine 8ths. Intensity: overdrive power-chord chug (1, 1&, 2&, 4&),
brass stabs doubling the organ, open hats + tom fills, tambourine and chip-noise 16ths, a shakuhachi counter-line
(A, D), orchestra hits on the phrase ends, a chip-square bass double for phones.

Leitmotifs: BELL phrygian on koto (B), BELL inverted on the music box (C, B 8), SHADOW as the surf-bass break (C).
review: originality — hook, koto lines, counter-lines, bass riff and patterns are new; only the project's BELL /
SHADOW motifs are reused. The tune never runs the phrygian-dominant scale up or down in tremolo (the famous surf
riff), there is no chromatic spy vamp (E–F–F♯–F), no repeated-root walking ostinato of the TV-detective kind and no
famous surf drum break. Checked with the project originality check (also on the guitar line with the tremolo
repeats collapsed), a scratch blocklist of interval fingerprints (the Misirlou riff, the spy vamp, the Peter Gunn
and Batman TV basses) and by ear-memory against Pipeline, Apache, Walk Don't Run and Wipe Out: no shared hook.
Composer B3, 2026-10-13 (round 2's 112-bpm koto tiptoe had the same title; nothing of it is kept).
"""
from sakura_audio.song import Song
from motifs import BELL, SHADOW
from _battle_kit import roll, tr
from _band import bars, rest, line, hits, power, trem

CH_INTRO = 'E | Fmaj7 E'
CH_A = 'E | Fmaj7 | E7 | Dm E7 | Am | Fmaj7 | Dm E | Fmaj7 E'
CH_B = 'Cmaj7 | E | Am7 | E7 | Fmaj7 | E | Dm7 Am | B7sus4 B7'
CH_C = 'E7 | E7 | Fmaj7 | E7'
CH_D = 'G | Abmaj7 | G7 | Fm G7 | Cm | Abmaj7 | Fm G | Fmaj7'

# --- the surf guitar's skeleton: '=' = one pick left to ring, every other note ≥ an 8th is tremolo-picked in 16ths
HOOK = [
    'b4/8= e5/8= g#5/4. f5/16= g#5/16= b5/4',           # 1 E       two picks, tremolo G♯, a 16th turn, tremolo B
    'c6/4 a5/8= f5/8= e5/4= r/4',                       # 2 Fmaj7   … E rings (maj7), beat 4 empty: BAM
    'b4/8= e5/8= g#5/4. a5/16= g#5/16= d6/4',           # 3 E7
    'd6/8= c6/8= a5/4 f5/4= r/4',                       # 4 Dm E7   F rings over E7 (the ♭9): BAM
]
A_END = [
    'e6/4. d6/16= c6/16= b5/8= c6/8= a5/4=',            # 5 Am      (A picked once: no tremolo run-in to bar 6)
    'f5/8= a5/8= c6/8= e6/8~= e6/4= r/4',               # 6 Fmaj7   E rings: BAM
    'f5/8= a5/8= d6/4 c6/16= b5/16= g#5/8= e6/4',       # 7 Dm E
    'f5/2 e5/4= r/4',                                   # 8 Fmaj7 E (hit + fill)
]
A2_END = [
    'c6/8= e6/8= a5/4. b5/16= c6/16= e6/4',             # 5 Am      higher this time
    'f6/4 e6/8= c6/8= a5/4= r/4',                       # 6 Fmaj7
    'd6/8= f6/8= a5/4 b5/16= c6/16= d6/8= g#5/4',       # 7 Dm E
    'f5/8= a5/8= c6/8= b5/8= g#5/4= r/4',               # 8 Fmaj7 E  … into the hush
]
B_GTR = {   # the guitar's bars of the dialogue (the koto has 1, 3, 5, 7)
    2: 'e5/4 g#5/8= b5/8= e6/4 d6/8= b5/8=',            # E      starts on E: the BELL answer
    4: 'g#5/4. f5/16= e5/16= d5/8= e5/8= b4/4',         # E7
    6: 'e5/8= b4/8= e5/4. g#5/16= e5/16= b5/4',         # E
    8: 'e5/8= f#5/8= b5/4 a5/4= r/4',                   # B7sus4 B7 (hit + fill)
}
B_KOTO = {
    1: BELL.question('E phrygian', 5) + ' r/8',         # Cmaj7  BELL phrygian: B–E–C–D …
    3: 'a4/16 b4/16 c5/8 e5/8 f5/8 e5/4 c5/8 b4/8',     # Am7    the in-scale (E F A B C) koto run
    5: BELL.question('E phrygian', 5) + ' r/8',         # Fmaj7  BELL again (B = ♯11 over F)
    7: 'f5/8 a5/8 d6/8 f6/8 e6/16 c6/16 a5/8 b5/4',     # Dm7 Am
}
C_GTR = [
    'a5/8= c6/8= e6/4. c6/16= a5/16= f5/4',             # 3 Fmaj7  the guitar answers the bass
    'g#5/8= b5/8= d6/4 f5/2=',                          # 4 E7     F rings (♭9) … up a minor third
]
D_END = [
    'ab5/8= c6/8= f6/4 eb6/16= d6/16= b5/8= g5/4',      # 7 Fm G
    'f6/8= c6/8= a5/4 f5/4= r/4',                       # 8 Fmaj7  → E: the turnaround (hit + fill)
]

# --- answers in the holes (beats 3-4 of every 2nd bar): koto tick-tick-ting on 3, the sax honk scoops in on 4
KOTO_ANS = {2: 'r/2 a6/16 a6/16 e6/8 r/4', 4: 'r/2 b6/16 b6/16 g#6/8 r/4', 6: 'r/2 c7/16 c7/16 a6/8 r/4',
            8: 'r/2 b6/16 g#6/16 e6/16 b5/16 r/4'}
SAX_ANS = {2: "r/2. c4/8!^ a3/8'", 4: "r/2. d4/8!^ b3/8'", 6: "r/2. e4/8!^ c4/8'",
           8: 'r/2 e3/16! g#3/16 b3/8 d4/4!^'}
KOTO_D = {**{b: tr(KOTO_ANS[b], -9) for b in (2, 4, 6)}, 8: 'r/2 e6/16 c6/16 a5/16 f5/16 r/4'}   # D: below the lead
SAX_D = {**{b: tr(SAX_ANS[b], 3) for b in (2, 4, 6)}, 8: 'r/2 f3/16! a3/16 c4/8 e4/4!^'}           # bar 8 = Fmaj7 → E
RIBBIT = 'r/2 b5/32 e6/32 r/16 b5/32 e6/32 r/16 r/4'
GHOST = 'b5/8* f5/8* a5/4* g5/4.* r/8'                  # BELL turned upside down (diatonic): the tritone B–F

# --- bass (degree tokens, see _band.line): pops on 1& and 2a, the hole on 3, the approach on 4&
S1 = 'R/8 8/16 7/16 5/8 R/16 8/16 r/8 R/8 3/8 ax/8'
S2 = 'R/8 8/16 5/16 7/8 R/16 8/16 r/8 5/8 3/16 5/16 ax/8'
SH = 'R/8 8/16 5/16 R/16 8/16 ax/8'
SHADOW_BREAK = (SHADOW.question('E', 2) + ' e3/16 d3/16 | '                              # E2 F2 E2 B♭2 G2 …
                'e3/16 f3/16 e3/16 bb2/16 g2/8 g#2/16 a2/16 bb2/8 b2/8 d3/8 e3/8')       # … again, then climb

# --- kit (drums_room): kick 1, 2a, 3 · snare 2/4 · hat 8ths
SURF = 'k+h/8 h/8 s+h/8 h/16 k/16 k+h/8 h/8 s+h/8 h/8 |'
SURF_C = 'k+c/8 h/8 s+h/8 h/16 k/16 k+h/8 h/8 s+h/8 h/8 |'
SURF_T = 'k+h/8 h/8 s+h/8 h/16 k/16 k+h/8 h/8 s+h/8 t4/16 t4/16 |'
SURF_F4 = 'k+h/8 h/8 s+h/8 h/16 k/16 k+h/8 h/8 s/16 s/16 t3/16 t4/16 |'
SURF_F8 = 'k+h/8 h/8 s+h/8 h/16 k/16 s/16 s/16 t1/16 t1/16 t3/16 t3/16 t4/16 t4/16 |'
RIDE = 'k+rd/8 rd/8 s+rd/8 rd/16 k/16 k+rd/8 rd/8 s+rd/8 rd/8 |'
RIDE_C = 'k+c/8 rd/8 s+rd/8 rd/16 k/16 k+rd/8 rd/8 s+rd/8 rd/8 |'
RIDE_F4 = 'k+rd/8 rd/8 s+rd/8 rd/16 k/16 k+rd/8 rd/8 s/16 s/16 t3/16 t4/16 |'
FILLS = {1: SURF_C, 2: SURF_T, 4: SURF_F4, 5: SURF_C, 6: SURF_T, 8: SURF_F8}
TAMB = '(tb?/8 tb/8)x4 |'

# --- organ stab bed: 1, 2&, 4& · the BAM adds an accent on 3 · bar 8 hits 3, 3e and 4
BED = [(0, '1/4', '!'), ('3/2', '1/4', ''), ('7/2', '1/4', '')]
BAM = BED + [(2, '1/4', '!')]
HIT8 = [(0, '1/4', '!'), ('3/2', '1/4', ''), (2, '1/4', '!'), ('9/4', '1/4', '!'), (3, '1/2', '!')]
HOLES = {2: BAM, 4: BAM, 6: BAM, 8: HIT8}
CHUG = [(0, '1/4', '!'), ('1/2', '1/4', ''), ('3/2', '1/4', '!'), ('7/2', '1/4', '!')]
CHUG_BAM = CHUG + [(2, '1/4', '!')]
CHUG_HOLES = {2: CHUG_BAM, 4: CHUG_BAM, 6: CHUG_BAM, 8: CHUG_BAM}

THEREMIN_A2 = ['e6/1*^', 'r/4 f6/4* e6/2*^', 'd6/2.*^ e6/4*', 'f6/2* d6/2*^',
               'c6/1*^', 'r/4 a5/4* c6/2*^', 'd6/2* b5/2*^', 'c6/2*^ b5/4* r/4']
SHAKU_A = ['g#4/1*', 'a4/2* c5/2*', 'b4/1*', 'a4/2* g#4/2*', 'c5/2.* b4/4*', 'a4/1*', 'f4/2* g#4/2*',
           'a4/2* g#4/4* r/4']

BUSY = {   # hint for the r3 busy tool (study/tools): the tune and the bass
    'melody': {'gtr': None, 'chip': None, 'koto': None},
    'bass': ['bass', 'sq_bass'], 'primary_bass': 'bass',
    'cat': {'organ': 'stab', 'brass': 'stab', 'gtr2': 'riff', 'hits': 'stab', 'sax': 'answer', 'koto_ans': 'answer',
            'frog': 'answer', 'box': 'answer', 'theremin': 'counter', 'shaku': 'counter'},
}


def _ans(table, n_bars=8):
    """One 8-bar section of hole answers from {bar: phrase}; the other bars rest."""
    return bars(*[table.get(b, 'r/1') for b in range(1, n_bars + 1)])


def build() -> Song:
    s = Song(id='battle_lantern', title='Lantern Hush', bpm=156, meter=(4, 4), key='E phrygian',
             form=['intro', '|:', 'A', 'B', 'A2', 'C', 'D', ':|'],
             mix={'echo': {'delay_ms': 192, 'feedback': 0.44, 'volume': 0.30, 'fir': 'soft'}, 'highpass_hz': 40},
             description='Battle (shrine, marsh): spooky eleki surf — tremolo surf guitar over an octave-popping surf '
                         'bass, combo-organ BAM, sax honks, koto BELL, a SHADOW bass break, a lift to G.')
    s.busy = BUSY
    s.section('intro', 2, CH_INTRO)
    s.section('A', 8, CH_A)
    s.section('B', 8, CH_B)
    s.section('A2', 8, CH_A)
    s.section('C', 4, CH_C)
    s.section('D', 8, CH_D)

    # ================================================================ base
    # --- the surf guitar (tremolo through the long echo) and its chip twin (one game: the chip voice is always there)
    s.part('gtr', 'surf_gtr', 'base', vel=6) \
        .notes('intro', trem('r/2 e6/16= b5/16= g#5/16= e5/16= b4/4= | r/1')) \
        .notes('A', trem(bars(*HOOK, *A_END))) \
        .notes('B', trem(bars(*[B_GTR.get(b, 'r/1') for b in range(1, 9)]))) \
        .notes('A2', trem(bars(*HOOK, *A2_END))) \
        .notes('C', trem(bars('r/1', 'r/1', *C_GTR))) \
        .notes('D', trem(bars(*[tr(x, 3) for x in HOOK + A_END[:2]], *D_END)))
    s.part('chip', 'chip_pulse25', 'base', vel=-22, gain=-3).double('gtr', ['A', 'B', 'A2', 'C', 'D'])
    # --- koto: the B dialogue (BELL phrygian), tick-tick-ting answers everywhere else
    s.part('koto', 'koto', 'base', vel=4, gain=4) \
        .notes('B', bars(*[B_KOTO.get(b, 'r/1') for b in range(1, 9)]), motifs={1: BELL, 5: BELL})
    s.part('koto_ans', 'koto', 'base', vel=4, gain=4) \
        .notes('A', _ans(KOTO_ANS)).notes('A2', _ans({4: KOTO_ANS[4], 8: KOTO_ANS[8]})).notes('D', _ans(KOTO_D))
    # --- the BAM: organ stab bed, sax honks, frogs, the music box ghost
    s.part('organ', 'combo_organ', 'base', vel=2, gain=1) \
        .notes('intro', bars('[e3 g#3 b3 d4]/1', hits('Fmaj7 E', [(0, '1/4', '!'), ('3/2', '1/4', ''), (2, '1/4', '!'),
                                                               ('9/4', '1/4', '!'), (3, '1/2', '!')], 55, 69))) \
        .notes('A', hits(CH_A, BED, 55, 69, 'rootless', per_bar=HOLES)) \
        .notes('B', hits(CH_B, BED, 55, 69, 'rootless', per_bar={8: HIT8})) \
        .notes('A2', hits(CH_A, BED, 55, 69, 'rootless', per_bar=HOLES)) \
        .notes('C', hits(CH_C, [], 55, 69, 'rootless', per_bar={3: BED, 4: BED})) \
        .notes('D', hits(CH_D, BED, 55, 69, 'rootless', per_bar=HOLES))
    s.part('sax', 'tenor_sax', 'base', vel=4) \
        .at('intro', 2, "r/2 e3/16! g#3/16 b3/8 d4/4!^") \
        .notes('A', _ans(SAX_ANS)).notes('A2', _ans(SAX_ANS)).notes('D', _ans(SAX_D)) \
        .at('B', 8, "r/2. d#4/8!^ b3/8'")
    s.part('frog', 'chip_pluck', 'base', vel=-10).at('A2', 2, RIBBIT).at('A2', 6, RIBBIT)
    s.part('box', 'music_box', 'base', vel=-4) \
        .at('B', 8, 'r/2 b6/8* f6/8* a6/4*') \
        .at('C', 2, GHOST, motif=BELL)
    s.part('theremin', 'whistle', 'base', vel=-6, gain=-5) \
        .notes('intro', 'r/4 b5/2.*^ | c6/2*^ b5/4* r/4') \
        .notes('A2', bars(*THEREMIN_A2)) \
        .notes('C', 'r/2 b5/2*^ | bb5/2*^ g5/2* | a5/1*^ | g#5/2* r/2')
    # --- bass: surf 8ths with pops, the kick's hole on 3; the SHADOW break in C
    s.part('bass', 'pick_bass', 'base', vel=8) \
        .notes('intro', bars('e2/4 r/2.', line('Fmaj7 E', S1, SH, low=38, nxt='E', flats=False))) \
        .notes('A', line(CH_A, [S1, S2], SH, low=38, nxt='Cmaj7', flats=False)) \
        .notes('B', line(CH_B, [S1, S2], SH, low=38, nxt='E', flats=False)) \
        .notes('A2', line(CH_A, [S1, S2], SH, low=38, nxt='E7', flats=False)) \
        .notes('C', bars(SHADOW_BREAK, line('Fmaj7 | E7', [S1, S2], SH, low=38, nxt='G', flats=False)),
               motifs={1: SHADOW, 2: SHADOW}) \
        .notes('D', line(CH_D, [S1, S2], SH, low=38, nxt='E'))
    # --- drums: the surf kit, tambourine
    s.part('kit', 'drums_room', 'base', vel=-2) \
        .notes('intro', bars(roll('t4', '16', 16, 30, 96), SURF_F8[:-2])) \
        .pattern(['A', 'A2', 'D'], SURF, fills=FILLS) \
        .pattern('B', RIDE, fills={1: RIDE_C, 4: RIDE_F4, 5: RIDE_C, 8: SURF_F8}) \
        .notes('C', bars('k/8 r/8 rs?/8 r/8 k/8 t3/16 t3/16 t4/8 r/8',
                         'k/8 r/8 rs?/8 r/8 k/8 r/8 t1/16 t1/16 t3/16 t4/16',
                         'k/8 h?/8 rs/8 h?/8 k/8 h?/8 rs/8 h?/8', roll('s', '16', 16, 36, 110)))
    s.part('tamb', 'drums_room', 'base', vel=-14) \
        .at('intro', 2, TAMB[:-2]).pattern(['A', 'B', 'A2', 'D'], TAMB).at('C', 3, bars(TAMB[:-2], TAMB[:-2]))

    # ================================================================ intensity
    s.part('gtr2', 'overdrive_gtr', 'intensity', vel=-6, gain=2) \
        .notes('A', power(CH_A, CHUG, low=46, per_bar=CHUG_HOLES)) \
        .notes('B', power(CH_B, CHUG, low=46, per_bar={8: CHUG_BAM})) \
        .notes('A2', power(CH_A, CHUG, low=46, per_bar=CHUG_HOLES)) \
        .notes('D', power(CH_D, CHUG, low=46, per_bar=CHUG_HOLES))
    s.part('brass', 'brass_stab', 'intensity', vel=-6, gain=1).double('organ', ['A', 'B', 'A2', 'D'])
    s.part('kit2', 'drums', 'intensity', vel=-8, gain=1.5) \
        .pattern(['A', 'B', 'A2', 'D'], '(r/8 o/8)x4 |',
                 fills={1: 'c/8 o/8 r/8 o/8 r/8 o/8 r/8 o/8 |', 5: 'c/8 o/8 r/8 o/8 r/8 o/8 r/8 o/8 |',
                        4: 'r/8 o/8 r/8 o/8 t2/16 t2/16 t3/16 t3/16 t4/8 r/8 |',
                        8: 'r/8 o/8 r/8 o/8 t1/16 t2/16 t3/16 t4/16 t4/16 t4/16 r/8 |'}) \
        .notes('C', bars('c/1', 'r/1', 'r/1', 'r/2 t2/16 t2/16 t3/16 t3/16 t4/16 t4/16 t4/16 t4/16'))
    s.part('tamb16', 'drums_room', 'intensity', vel=-22).pattern(['A', 'B', 'A2', 'D'], '(tb?/16 tb?/16 tb/16 tb?/16)x4 |')
    s.part('noise', 'chip_kit', 'intensity', vel=-26).pattern(['A', 'B', 'A2', 'D'], '(h/16 h? o/16 h?)x4 |')
    s.part('shaku', 'shakuhachi', 'intensity', vel=-6) \
        .notes('A', bars(*SHAKU_A)).notes('D', bars(*[tr(x, 3) for x in SHAKU_A]))
    s.part('hits', 'orch_hit', 'intensity', vel=-4) \
        .at(['A', 'A2'], 8, 'r/2 [e3 g#3 d4]/4 r/4').at('B', 8, 'r/2 [b2 d#3 a3]/4 r/4') \
        .at('C', 1, '[e3 g#3 d4]/4 r/2.').at('D', 1, '[g3 b3 f4]/4 r/2.').at('D', 8, 'r/2 [f3 a3 e4]/4 r/4')
    s.part('sq_bass', 'chip_pulse50', 'intensity', octave=1, vel=-24, gain=-3).double('bass', ['A', 'B', 'A2', 'D'])
    return s


songs = [build()]
