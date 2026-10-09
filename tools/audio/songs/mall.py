"""'Sakura Mall' — the mall / shop. ORIGINAL composition (docs/AUDIO.md §4.1 rules; round-3 genre lane: CITY POP /
FUNK — a disco four-on-the-floor shopping-arcade groove).

G major, 116 bpm, straight 16ths, 4/4. One `full` stem: disco kit (kick on every beat, open hats on the "ands",
snare + clap on 2 and 4), 16th shaker, conga ostinato, slap bass in disco octaves, funk-guitar 16th scratch, Rhodes
+ clavinet stabs on 2& and 4&, a brass section (trumpet, alto, synth-brass stab), square-lead hook with the alto an
octave under and a chip double, vibes in the bridge, strings, steel drum (the mall's colour since round 1).
    intro  1 bar   ii–V pickup: drum fill, slap walk-up, the steel drum asks the Sakura Bell in G
    A      8 bars  the hook on IV–V/IV–iii–VI (the city-pop "royal road"): a 16th-anticipated climb that stops on
                   beat 3 of every second bar, where the brass answers "ta-DAT ta-DAT"; strings rip into bar 8, an
                   orchestra hit lands, the steel drum rings the Bell question (D–G–E–F♯) as the fill
    B      8 bars  bridge in B♭: the vibes sing a new tune for 4 bars, then a 2-bar slap-bass solo (kit + shaker
                   only) answered by a 2-bar synth-brass + trumpet line, D7 back to G
    A2     8 bars  the hook again with a string counter-line; the steel drum answers the cells; bars 5-7 LIFT a
                   semitone to A♭ (F7♭9 pivots), Am7 D7 slides home and the steel drum's Bell is answered by the
                   loop's first downbeat (G under the hook)
Form: intro |: A B A2 :|  — 1 + 24 bars (50 s loop).

Taste rules (r3 study/taste.md): slap bass 10 notes a bar (octave pops on every "and", ghost 16ths, a chromatic
approach into every bar line); every second bar ends in a brass BAM or a steel reply; kick + bass + guitar + keys +
hats push the "ands" together; a counter-line in A2; fills in bars 4 and 8; breakdown = the bass solo, lift = A♭.

review: originality — the hook, the bridge tune, the bass lines, the brass writing and the counter-line are new;
BELL is the project's own motif. The IV–V/IV–iii–VI progression is a generic J-pop/city-pop idiom (not a song);
famous city-pop / funk / disco hooks and basslines were kept in mind and not used; checked by ear-memory against
well-known city pop, J-funk, disco and shop/mall game themes (Animal Crossing, Wii Shop, Pokémon Mart, Undertale /
Deltarune shops, EarthBound, Persona): no shared hook or contour. Composer B1, 2026-10-09 (round 3).
"""
from sakura_audio.song import Song
from motifs import BELL
from _home import bars, tr
from _horns import line, comp, harmonize, put, notes_of, grid

CH_INTRO = 'Am7 D7'
CH_A = 'Cmaj9 | D/C | Bm7 | E7b9 | Am9 | D9sus4 D7 | Gmaj9 Em9 | Am7 D7'
CH_B = 'Ebmaj9 | Gm9 | Cm9 | F13 | Dm9 | Gm9 C9 | Ebmaj9 | Am7 D7b9'
CH_A2 = 'Cmaj9 | D/C | Bm7 | F7b9 | Bbm9 | Eb9sus4 Eb7 | Abmaj9 Fm9 | Am7 D7'

HOOK = [
    'b4/16 d5/8 e5/16~ e5/8 g5/8 a5/8 b5/8~ b5/8 a5/8',        # 1 Cmaj9
    'g5/8 f#5/16 e5/16~ e5/4 r/2',                             # 2 D/C     … brass BAM
    'a4/16 d5/8 e5/16~ e5/8 f#5/8 a5/8 b5/8~ b5/8 d6/8',       # 3 Bm7     the climb again, higher
    'c6/8 b5/16 g#5/16~ g#5/4 r/2',                            # 4 E7♭9    … brass BAM
    'g5/16 e5/8 g5/16~ g5/8 b5/8 c6/8 e6/8~ e6/8 d6/8',        # 5 Am9     up to E6
    'c6/8 b5/8 a5/8 e5/8~ e5/2',                               # 6 D9sus4 D7 … brass BAM (E = the 9th of both)
    'b5/8. a5/16 b5/8 d6/8~ d6/8 b5/8 g5/8 e5/8',              # 7 Gmaj9 Em9
    'g5/8 a5/8 r/4 r/2',                                       # 8 Am7 D7  … orchestra hit, steel-drum Bell
]
HOOK_A2 = HOOK[:3] + [tr(b, 1) for b in HOOK[3:7]] + [HOOK[7]]     # bars 4-7 lifted to A♭ (F7♭9 pivots)
BRIDGE = [
    'g5/8. f5/16 g5/8 bb5/8~ bb5/4 d6/8 c6/8',                 # 1 E♭maj9
    'bb5/4 a5/16 g5/16 f5/8~ f5/2',                            # 2 Gm9      … brass
    'g5/8. f5/16 g5/8 c6/8~ c6/4 eb6/8 d6/8',                  # 3 Cm9
    'c6/4 bb5/16 a5/16 f5/8~ f5/2',                            # 4 F13      … brass
    'r/1', 'r/1',                                              # 5-6 slap-bass solo
    'r/1', 'r/1',                                              # 7-8 the brass answers
]
BRASS_LINE_B = ['r/1', 'r/1', 'r/1', 'r/1', 'r/1', 'r/1',
                'bb4/8 d5/8 f5/8 g5/8~ g5/4 f5/16 g5/16 bb5/8', "a5/8 g5/8 e5/8 c5/8~ c5/4 a4/8' r/8"]
SLAP_SOLO = ['d2/16 d3/16 r/16 d2/16 f2/16 g2/16 g#2/16 a2/16 c3/16 d3/16 r/16 c3/16 a2/16 g2/16 f2/16 e2/16',
             'g1/16 g2/16 r/16 g1/16 bb1/16 d2/16 f2/16 g2/16 c2/16 c3/16 r/16 bb2/16 g2/16 e2/16 c2/16 d2/16']
# brass BAM top lines (trumpet; alto voiced under it, synth-brass stab chord with it)
BAM_A = ['r/1', "r/2 r/16 a4/16 d5/8! r/16 a4/16 f#5/8!", 'r/1', "r/2 r/16 g#4/16 b4/8! r/16 g#4/16 d5/8!",
         'r/1', "r/2 r/16 f#4/16 a4/8! r/16 a4/16 c5/8!", 'r/1', 'r/1']
BAM_B = ['r/1', "r/2 r/16 f4/16 bb4/8! r/16 bb4/16 d5/8!", 'r/1', "r/2 r/16 f4/16 a4/8! r/16 c5/16 eb5/8!",
         'r/1', 'r/1', 'r/1', 'r/1']
BAM_A2 = ['r/1', 'r/1', 'r/1', "r/2 r/16 a4/16 c5/8! r/16 a4/16 eb5/8!", 'r/1', 'r/1', 'r/1', 'r/1']
STEEL_A2 = ['g6/4 r/2.', "r/2 r/16 a6/16' f#6/16' d6/16' r/16 f#6/16' a6/8'", 'r/1', 'r/1',
            'r/1', "r/2 r/16 bb6/16' g6/16' eb6/16' r/16 g6/16' bb6/8'", 'r/1', 'r/1']
COUNTER_A2 = ['g4/2 b4/2', 'a4/2 f#4/2', 'f#4/2 a4/2', 'a4/2 gb4/2', 'f4/2 db5/2', 'db5/2 g4/2', 'c5/2 ab4/2', 'g4/2 f#4/2']
BELL_FILL = 'r/4 ' + BELL.question('G', 6, rhythm=('8', '8', '4', '4'))      # bar 8: d6 g6 e6 f♯6 (question)
CHACHING = "r/2. c7/32 e7/32 g7/32 c8/32 r/8"                                   # chip "cha-ching" after the bridge BAMs

# ---- grooves
SLAP = ['R/8 8/8 R/16 R?/16 8/8 5/8 8/8 7/16 8?/16 ap/8', 'R/8 8/8 R/8 8/16 7?/16 5/8 8/8 R/16 3/16 ap/8']
SLAP_H = ['R/8 8/8 R/16 8?/16 5/8', 'R/8 8/8 R/16 8?/16 ap/8']
KIT = 'k+h/8 o/8 k+s+cl/8 o/8 k+h/8 o/8 k+s+cl/8 o/8 |'
KIT_C = 'k+c/8 o/8 k+s+cl/8 o/8 k+h/8 o/8 k+s+cl/8 o/8 |'
KIT_F4 = 'k+h/8 o/8 k+s+cl/8 o/8 k/16 s/16 s?/16 s/16 t1/16 t1 t2 t2 |'
KIT_F8 = 'k+h/8 o/8 k+s+cl/8 o/8 s/16 s s s t1/16 t1 t2 t3 |'
KIT_SOLO = 'k/8 h/8 k+cl/8 h/8 k/8 h/8 k+cl/8 h/8 |'
SHAKER = '(sh/16 sh?/16 sh/16 sh?/16)x4 |'
CONGA = 'r/8 cg/16 cg?/16 bg/8 cg/8 r/8 cgl/16 cg/16 bg/8 cg/8 |'
SCRATCH = [[(0.25, 0.2, -18), (0.75, 0.2, -10), (1.25, 0.2, -18), (1.5, 0.25, 4), (1.75, 0.2, -12), (2.25, 0.2, -18),
            (2.75, 0.2, -10), (3.25, 0.2, -18), (3.5, 0.25, 4), (3.75, 0.2, -12)]]
KEYS = [[(1.5, 0.4, 0), (3.5, 0.4, 2, 'next')]]
CLAV = [[(0.75, 0.2, -8), (1.5, 0.25, 2), (2.75, 0.2, -8), (3.5, 0.25, 4, 'next')]]


def build() -> Song:
    s = Song(id='mall', title='Sakura Mall', bpm=116, meter=(4, 4), key='G',
             form=['intro', '|:', 'A', 'B', 'A2', ':|'],
             mix={'echo': {'delay_ms': 192, 'feedback': 0.34, 'volume': 0.24, 'fir': 'soft'}},
             description='Mall / shop. City pop / funk: disco four-on-the-floor, slap octaves, brass BAMs, square-lead '
                         'hook, steel-drum Bell fill, lift to A♭.',
             extra={'lane': 'citypop',
                    'busy': {'melody': {'lead': None, 'alto_mel': None, 'chip': None, 'vibes': ['B']},
                             'bass': ['slap'], 'primary_bass': 'slap',
                             'cat': {'tpt': 'answer', 'alto': 'answer', 'bstab': 'stab', 'steel': 'answer',
                                     'bline': 'answer', 'bline_tpt': 'answer', 'hit': 'stab', 'rip': 'answer',
                                     'chaching': 'answer', 'strings': 'counter', 'gtr': 'comp', 'rhodes': 'comp',
                                     'clav': 'comp'}}})
    s.section('intro', 1, CH_INTRO)
    s.section('A', 8, CH_A)
    s.section('B', 8, CH_B)
    s.section('A2', 8, CH_A2)

    # ---- melody: square-lead hook, alto an octave under, a soft chip double; vibes in the bridge
    lead = s.part('lead', 'square_lead', 'full', vel=0)
    lead.notes('A', bars(*HOOK)).notes('A2', bars(*HOOK_A2))
    s.part('alto_mel', 'alto_sax', 'full', octave=-1, vel=-8).double('lead')
    s.part('chip', 'chip_pulse25', 'full', vel=-24).double('lead')
    s.part('vibes', 'vibes', 'full', vel=0).notes('B', bars(*BRIDGE))

    # ---- the steel drum: Bell question at the end of A / A2 (answered by the next downbeat), replies in A2
    steel = s.part('steel', 'steel_drum', 'full', vel=-2)
    steel.notes('intro', 'r/4 ' + BELL.question('G', 5, rhythm=('8', '8', '4', '4'))) \
        .at('A', 8, BELL_FILL, motif=BELL).notes('A2', bars(*STEEL_A2[:7], BELL_FILL), motifs={8: BELL}) \
        .at('A', 1, 'g6/4 r/2.')
    s.part('chaching', 'chip_pulse25', 'full', vel=-14).at('B', 2, CHACHING).at('B', 4, CHACHING)

    # ---- brass: BAMs in the hook's stops, the answer to the bass solo in B
    tpt = s.part('tpt', 'trumpet', 'full', vel=2)
    alto = s.part('alto', 'alto_sax', 'full', vel=-6)
    bstab = s.part('bstab', 'brass_stab', 'full', vel=0)
    for sec, sh, ch in (('A', BAM_A, CH_A), ('B', BAM_B, CH_B), ('A2', BAM_A2, CH_A2)):
        tpt.notes(sec, bars(*sh))
        lo = harmonize(notes_of(bars(*sh)), grid(ch), voices=2, floor=55)
        put(alto, sec, lo[0])
        put(bstab, sec, [n for v in lo for n in v] + [n for n in notes_of(bars(*sh))], vel=-6)
    bl = s.part('bline', 'synth_brass', 'full', vel=4)
    bl.notes('B', bars(*BRASS_LINE_B))
    s.part('bline_tpt', 'trumpet', 'full', vel=-10).double('bline', 'B')
    put(s.part('bline_lo', 'alto_sax', 'full', vel=-10), 'B',
        harmonize(notes_of(bars(*BRASS_LINE_B)), grid(CH_B), voices=1, floor=55)[0])
    s.part('rip', 'strings', 'full', vel=6).at('A', 7, "r/2. d5/32 e5 f#5 g5 a5 b5 c6 d6") \
        .at('A2', 7, "r/2. c5/32 db5 eb5 f5 g5 ab5 bb5 c6") \
        .at('B', 4, "r/2. c5/32 d5 e5 f5 g5 a5 bb5 c6")
    s.part('hit', 'orch_hit', 'full', vel=0).at(['A', 'A2'], 8, '[a3 c4 e4 g4]/4 r/2.').at('B', 5, '[d4 f4 a4 c5]/4 r/2.')
    s.part('strings', 'strings', 'full', vel=-10).notes('A2', bars(*COUNTER_A2))
    s.part('pad', 'strings', 'full', vel=-10).gen('B', 'pad:sustain', voicing='rootless', low=55, high=70, vel=56)

    # ---- rhythm section
    slap = s.part('slap', 'slap_bass', 'full', vel=0)
    slap.notes('intro', 'a1/8 a2/8 r/16 a1/16 c2/16 c#2/16 d2/8 d3/8 r/16 c3/16 a2/16 b1/16') \
        .notes('A', line(CH_A, SLAP, SLAP_H, low=36, nxt='Ebmaj9')) \
        .notes('B', ' | '.join(line(CH_B, SLAP, SLAP_H, low=36, nxt='Cmaj9').split(' | ')[:4] + SLAP_SOLO
                               + line('Ebmaj9 | Am7 D7b9', SLAP, SLAP_H, low=36, nxt='Cmaj9').split(' | '))) \
        .notes('A2', line(CH_A2, SLAP[1:] + SLAP[:1], SLAP_H, low=36, nxt='Cmaj9'))
    gtr = s.part('gtr', 'funk_gtr', 'full', vel=-2)
    rh = s.part('rhodes', 'rhodes', 'full', vel=-6)
    clav = s.part('clav', 'clavinet', 'full', vel=-8)
    for sec, ch, nx, skip in (('A', CH_A, 'Ebmaj9', ()), ('B', CH_B, 'Cmaj9', (5, 6)), ('A2', CH_A2, 'Cmaj9', ())):
        put(gtr, sec, comp(ch, SCRATCH, low=62, high=74, style='shell', vel=88, skip=skip, nxt=nx))
        put(rh, sec, comp(ch, KEYS, low=53, high=67, style='rootless', vel=82, skip=skip, nxt=nx))
        put(clav, sec, comp(ch, CLAV, low=60, high=72, style='close', vel=84, skip=skip, nxt=nx))

    kit = s.part('kit', 'drums', 'full', vel=-6)
    kit.notes('intro', 'k+h/8 o/8 k+s+cl/8 s/16 s/16 s/16 s t1 t1 t2 t2 t3 t3') \
        .pattern(['A', 'A2'], KIT, fills={1: KIT_C, 4: KIT_F4, 5: KIT_C, 8: KIT_F8}) \
        .pattern('B', KIT, fills={1: KIT_C, 4: KIT_F4, 5: KIT_SOLO, 6: KIT_SOLO, 7: KIT_C, 8: KIT_F8})
    s.part('shaker', 'drums', 'full', vel=-30).pattern(['A', 'B', 'A2'], SHAKER)
    s.part('conga', 'drums', 'full', vel=-22).pattern(['A', 'A2'], CONGA).pattern('B', CONGA)
    return s


songs = [build()]
