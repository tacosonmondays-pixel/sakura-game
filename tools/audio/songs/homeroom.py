"""'Homeroom' — the lobby, and (melody stem off) 'Study Hall' for every menu. ORIGINAL composition
(docs/AUDIO.md §4.1 rules; round-3 genre lane: JAZZ — an after-school combo with a horn section).

F major, 126 bpm, medium swing (triplet swing, 8th-triplet skips kept), 4/4. Stems: `base` (= Study Hall, complete
music on its own: jazz kit, walking upright bass, Rhodes comping, jazz guitar four-to-the-bar, the 4-horn section's
shouts and backgrounds, the shout chorus) and `melody` (vibes head + soft chip double, clarinet counter-line, muted
trumpet fills, music box). The menus fade the melody stem out without restarting.
    intro  2 bars  brushes, Rhodes, the music box rings the Sakura Bell (question → answer)
    H      8 bars  the vibes head: a 2-bar cell (a swung climb, then a chromatic bebop turn that stops on beat 3);
                   every stop is answered by the horn section's "doo-ba DAH-dah" shout, the Sakura Bell in
                   diminution sung from the chord's fifth (5–8–6–7), with the drummer kicking it
    H2     8 bars  the head again, climbing higher in bars 5-8; clarinet guide-tone counter-line, muted-trumpet
                   fills and trombone backgrounds; the last shout turns the tune to B♭
    Br     8 bars  bossa-nova bridge in B♭ (straight 8ths, brushes, congas + shaker, guitar bossa comping, the bass
                   in a bossa two-feel with octave pops); a new lyrical vibes tune; the music box asks the Bell in G
                   in bar 8 and …
    S      8 bars  … the shout chorus answers it: the full horn section plays the main theme bars 1-4 LIFTED to G
                   (G6/9, Em9 A13, C6/9 Cm6 — the chromatic minor iv — Am7 A♭7♯11), A♭7 slides home to F;
                   then trading twos: 2 bars of walking-bass solo (kit + Rhodes stabs only), the horns answer with
                   the Bell in F and a chromatic walk-up (C7♭9) back to the head
Form: intro |: H H2 Br S :|  — 2 + 32 bars (61 s loop).

Taste rules (r3 study/taste.md): bass walks ~7 notes a bar (8th-triplet skips, octave pops on 1& / 3&, strong beats
on chord tones, a chromatic enclosure into every bar line; a chip triangle doubles it an octave up for phones); the
band pushes the and-of-2 and the and-of-4 together (ride, Rhodes anticipation, bass skip, snare/kick comping); every
melody stop is answered; a counter-line in H2; fills in bars 4 and 8; breakdown = the bass solo, lift = the G shout
chorus, feature = trading twos. Comping is voiced against the tune (`_horns.comp(against=…)`): no minor 2nds / 9ths
under the melody, keys stay below it, and the Rhodes hits the horns' pushes instead of anticipating past them.

review: originality — the head, the bridge tune, the bass solo, the counter-line, the shout writing and the
re-harmonisation are new; the main theme (§4.3) and the BELL motif are the project's own. Written to the jazz idiom
(swing ride, walking bass, ii–V–I, tritone subs, shout chorus, bossa bridge) without any standard's head, riff or
changes: checked by ear-memory against well-known swing/bebop/bossa standards and game and anime jazz (shop,
town and lobby themes): no shared hook or contour. Composer B1, 2026-10-09 (round 3).
"""
from sakura_audio.song import Song
from motifs import BELL
from _home import bars
from _horns import line, comp, harmonize, put, notes_of, grid, pattern

CH_INTRO = 'Bbmaj9 | C13sus4 C7b9'
CH_H = 'Fmaj9 | D7b9 | Gm9 | C13 C7b9 | Am7 D7b9 | Gm9 C13 | F69 Bb13 | Gm9 C7b9'
CH_H2 = 'Fmaj9 | D7b9 | Gm9 | C13 C7b9 | Am7 D7b9 | Gm9 C13 | Fmaj9 Eb9 | Cm9 F13'
CH_BR = 'Bbmaj9 | Gm9 | Cm9 | F13 | Dm7 Db7 | Cm9 F7b9 | Bbmaj9 Ebmaj7#11 | Am7 D9'
CH_S = 'G69 | Em9 A13 | C69 Cm6 | Am7 Ab7#11 | Gm9 | C13 Gb7#11 | F69 | Gm9 C7b9'

# ---- the vibes head: 2-bar cells, the second bar stops on beat 3 for the horns
HEAD = [
    'c5/8 e5/8 g5/4 a5/8 c6/4 a5/8',             # 1 Fmaj9    da-da DAH da DAH da
    'a5/8 g5/8 f#5/8 eb5/8~ eb5/8 r/8 r/4',      # 2 D7♭9     bebop fall onto the ♭9, handed to the shout
    'd5/8 f5/8 a5/4 bb5/8 d6/4 bb5/8',           # 3 Gm9      the cell a step up
    'a5/8 g5/8 bb5/8 e5/8~ e5/2',                # 4 C13 C7♭9 … shout
    'e5/8 g5/8 c6/4 eb6/8 d6/4 c6/8',            # 5 Am7 D7♭9
    'a5/8 bb5/8 d6/8 g5/8~ g5/2',                # 6 Gm9 C13  … shout
    'c6/4 a5/8 c6/8~ c6/8 ab5/8 f5/8 d5/8',      # 7 F6/9 B♭13 (the blue ♭7 of B♭)
    'f5/8 e5/8~ e5/4 r/2',                       # 8 Gm9 C7♭9 … big shout + fill
]
HEAD2_END = [
    'e5/8 g5/8 c6/4 eb6/8 f#6/4 d6/8',           # 5 Am7 D7♭9  climbs higher
    'f6/8 d6/8 a5/8 bb5/8~ bb5/2',               # 6 Gm9 C13
    'a5/8 c6/8 e6/4 g6/8 f6/4 db6/8',            # 7 Fmaj9 E♭9
    'c6/8 bb5/8~ bb5/4 r/2',                     # 8 Cm9 F13 → B♭
]
BOSSA = [                                        # the bridge tune (straight 8ths, bossa syncopation)
    'd5/4 c5/8 d5/8~ d5/8 f5/8 a5/4',            # 1 B♭maj9
    'g5/8 f5/8 g5/8 a5/8~ a5/2',                 # 2 Gm9      … muted trumpet answers
    'eb5/4 d5/8 eb5/8~ eb5/8 g5/8 bb5/4',        # 3 Cm9      the cell a step up
    'a5/8 g5/8 a5/8 d6/8~ d6/2',                 # 4 F13      … horns answer
    'c6/4 a5/8 f5/8~ f5/8 ab5/8 b5/4',           # 5 Dm7 D♭7
    'bb5/8 g5/8 eb5/8 d5/8~ d5/2',               # 6 Cm9 F7♭9 … muted trumpet answers
    'd5/8 f5/8 a5/8 c6/8~ c6/4 a5/8 g5/8',       # 7 B♭maj9 E♭maj7♯11
    'e5/4 c5/8 a4/8~ a4/2',                      # 8 Am7 D9   … the music box asks the Bell in G
]
# shout chorus lead (trumpet): main theme bars 1-4 lifted to G, then the answer to the bass solo
SHOUT = [
    "d5/8 g5/8! e5/4 f#5/4. g5/8",               # 1 G6/9      ⟨BELL⟩
    "b5/4! a5/8 g5/8 f#5/4 e5/4",                # 2 Em9 A13
    "d5/8 g5/8! e5/4 f#5/8 g5/8 a5/4",           # 3 C6/9 Cm6  ⟨BELL⟩
    "b5/4.! a5/8 d5/2",                          # 4 Am7 A♭7♯11
    'r/1', 'r/1',                                # 5-6 bass solo
    "c5/8 f5/8! d5/4 e5/4. f5/8~",               # 7 F6/9      ⟨BELL⟩ the horns answer the bass
    "f5/4 r/8 a4/8 bb4/8 b4/8 c5/4!",            # 8 Gm9 C7♭9  chromatic walk-up home
]
# horn-section shouts in the melody stops ("doo-ba DAH-dah" = BELL from the chord's fifth: 5–8–6–7)
SH_H = ['r/1', "r/2 a4/8 d5/8 b4/8! c5/8'", 'r/1', "r/2 g4/8 c5/8 a4/8! bb4/8'",
        'r/1', "r/2 bb4/8 a4/8 g4/8! e4/8'", 'r/1', 'r/2 g4/8 c5/8 r/8 bb4/8!']
SH_H2 = ['r/1', 'r/1', 'r/1', "r/2 g4/8 c5/8 a4/8! bb4/8'", 'r/1', 'r/1', 'r/1', 'r/2 c5/8 f5/8 r/8 eb5/8!']
SH_BR = ['r/1', 'r/1', 'r/1', "r/2 c5/8 f5/8 d5/8 eb5/8'", 'r/1', 'r/1', 'r/1', "r/2 a4/8 d5/8 b4/8 c5/8'"]
# melody-stem fills and the counter-line
MUTE_H2 = ['r/1', 'r/2 f#4/8 a4/8 c5/8 eb5/8', 'r/1', 'r/1', 'r/1', 'r/2 e5/8 d5/8 bb4/8 a4/8', 'r/1', 'r/1']
MUTE_BR = ['r/1', 'r/2 d5/8 bb4/8 g4/8 a4/8', 'r/1', 'r/1', 'r/1', 'r/2 a4/8 c5/8 f5/8 gb5/8', 'r/1', 'r/1']
CLAR_H2 = ['a4/2 g4/4 e4/4', 'f#4/2. eb4/4', 'f4/2 d4/4 g4/4', 'bb4/2 r/2',
           'g4/2 f#4/2', 'f4/2 e4/4. g4/8', 'e4/2 g4/2', 'eb4/2 a4/2']
# bass solo (trading twos, S bars 5-6): a swung bebop line, then the horns answer
BASS_SOLO = ['g2/8 a2/8 bb2/8 d3/8 f3/8t g3/8t f3/8t d3/8 bb2/8',
             'e3/8 c3/8 a2/8 bb2/8~ bb2/8 ab2/8 gb2/8 e2/8']

# ---- bass patterns (degrees, see _horns.line): skip on 2&, chromatic enclosure on 4 / 4&
WALK = ['R/4 3/8 4?/8 5/8 8/8 au/8 ap/8',           # octave pop on 3&, enclosure into the bar line
        'R/4 5/8t 6?/8t 7/8t 8/4 au/8 ap/8',         # 8th-triplet skip up to the octave
        'R/8 8?/8 7/8 6?/8 5/8 8/8 au/8 ap/8',       # ghosted pop on 1&, down 7-6-5, pop on 3&
        'R/4 3/8 5?/8 8/8t 7/8t 5/8t au/8 ap/8']     # triplet fall from the octave
WALK_H = ['R/4 5/8 ap/8', 'R/8 8/8 au/8 ap/8', 'R/8t 3/8t 5/8t au/8 ap/8', 'R/4 au/8 ap/8']
BOSSA_B = ['R/4. 5/8 8/4 5/8 ap/8', 'R/4. 5/8 5/4 8/8 ap/8']
BOSSA_H = ['R/4. 5/8', 'R/4 au/8 ap/8']

# ---- kit
RIDE = 'rd/4 rd+ph!/8 rd?/8 rd/4 rd+ph!/8 rd?/8 |'
RIDE_C = 'rd+c/4 rd+ph!/8 rd?/8 rd/4 rd+ph!/8 rd?/8 |'
COMP = 'k?/4 r/8 s?/8 k?/4 r/8 k/8 | k?/4 r/8 s?/8 s/8 s?/8 k!/8 k/8 |'      # bar 2 kicks the shout
FILL2 = 'k?/4 r/8 s?/8 k?/4 s/8t s?/8t t1?/8t |'                       # H2: a ghosted triplet under the mute's fill
FILL4 = 'k?/4 r/8 s?/8 s/8t s?/8t s/8t t1/8 t2/8 |'
FILL8 = 'k?/4 s/8t s?/8t s/8t t1/8t t1?/8t t2/8t t2/8t t3/8t t3/8t |'
FILL6S = 'k?/4 r/8 s?/8 s/8t s/8t s/8t s/8t t1/8t t3/8t |'
BRUSH = 'k+rs/8 h?/8 h/8 k+rs/8 k+h/8 h?/8 rs/8 k+h/8 | k+h/8 h?/8 rs/8 k+h/8 k+rs/8 h?/8 h/8 k+h/8 |'
BRUSH_C = 'k+c/8 h?/8 h/8 k+rs/8 k+h/8 h?/8 rs/8 k+h/8 |'
BRUSH_F2 = 'k+h/8 h?/8 rs/8 k+h/8 k+rs/8 h?/8 s/16 s?/16 t1?/8 |'
BRUSH_F4 = 'k+rs/8 h?/8 h/8 k+rs/8 s/16 s? s s? t1/8 t2/8 |'
BRUSH_F8 = 'k+h/8 h?/8 s/16 s? s s t1/16 t1 t2 t2 t3/16 t3 t3 t3 |'
CONGA = 'cg+sh/8 sh?/16 cg+sh?/16 sh/16 sh?/16 cgl+sh/16 sh?/16 bg+sh/16 sh?/16 bg+sh?/16 sh?/16 cg+sh/16 sh?/16 cgl+sh?/16 sh?/16 |'

# ---- Rhodes comping: anticipations on the and-of-2 and the and-of-4 ('next' = the chord half a beat later)
RH = {0: [(1.5, 0.5, -4), (3.5, 0.5, 0)], 3: [(2, 0.5, -4), (3.5, 0.5, 0)]}   # S: the Rhodes hits with the soli (no
#   anticipations: the horns voice every note on the chord it starts on)
BOSSA_GTR = [[(0, 0.75, 0), (1.5, 0.5, -8), (2.5, 0.5, -4), (3.5, 0.5, -10)],
             [(0.5, 0.5, -6), (1.5, 0.5, -2), (3, 0.5, -4), (3.5, 0.5, -8, 'next')]]
_RO, _RE = [(0, 0.5, -10), (1.5, 0.5, -4, 'next'), (3.5, 0.75, 0, 'next')], [(1.5, 0.5, -2, 'next'), (3.5, 0.75, 2, 'next')]
RH_ODD = {1: _RO, 2: _RE, 3: _RO, 4: _RE, 5: _RO, 6: _RE, 7: _RO, 8: [(1.5, 0.5, -2, 'next'), (3.5, 0.5, 4)]}   # bar 8: hit
#   the shout's last push with the horns (no anticipation of the next section)
GTR4 = [[(0, 0.6, 0), (1, 0.6, -10), (2, 0.6, -4), (3, 0.6, -10)]]
PAD_BR = {0: [(0, 4, 0)], 5: [(0, 2, 0), (2, 2, -4)], 6: [(0, 2, 0), (2, 2, -4)], 7: [(0, 2, 0), (2, 2, -4)],
          8: [(0, 2, 0), (2, 2, -4)]}
STAB_S = {1: [(2.5, 0.5, 0)], 4: [(1, 0.5, 0)], 5: [(0, 0.5, 6), (1.5, 0.5, 0), (3.5, 0.5, 2)],
          6: [(0, 0.5, 6), (1.5, 0.5, 0), (3, 0.5, 2)], 7: [(3, 0.5, 0)], 8: [(0.5, 0.5, 2)]}


def build() -> Song:
    s = Song(id='homeroom', title='Homeroom', bpm=126, meter=(4, 4), key='F', swing=2 / 3, swing_triplets='keep',
             form=['intro', '|:', 'H', 'H2', 'Br', 'S', ':|'],
             mix={'echo': {'delay_ms': 224, 'feedback': 0.36, 'volume': 0.24, 'fir': 'soft'}},
             description='Lobby (base + melody) and every menu ("Study Hall": base only). Jazz: swing combo + horn '
                         'section, bossa bridge, shout chorus with the main theme lifted to G.',
             extra={'lane': 'jazz',
                    'busy': {'melody': {'vibes': None, 'chip': None, 'tpt': None},
                             'bass': ['bass'], 'primary_bass': 'bass',
                             'cat': {'sec_tpt': 'answer', 'alto': 'answer', 'tenor': 'answer', 'bone': 'answer',
                                     'mute': 'answer', 'box_q': 'answer', 'clar': 'counter', 'rh_stab': 'stab',
                                     'rhodes': 'comp', 'gtr': 'comp', 'bg': 'pad'}}})
    s.section('intro', 2, CH_INTRO)
    s.section('H', 8, CH_H)
    s.section('H2', 8, CH_H2)
    s.section('Br', 8, CH_BR, swing=0)
    s.section('S', 8, CH_S)
    # the melody each section's comping must stay clear of (minor 2nds / 9ths, register)
    M_H, M_H2 = notes_of(bars(*HEAD)), notes_of(bars(*HEAD[:4], *HEAD2_END))
    M_BR, M_S = notes_of(bars(*BOSSA)), notes_of(bars(*SHOUT))
    X_H2 = [notes_of(bars(*CLAR_H2)), notes_of(bars(*MUTE_H2)), notes_of(bars(*SH_H2))]
    X_BR = [notes_of(bars(*MUTE_BR)), notes_of(bars(*SH_BR))]

    # ================================================================ base (= Study Hall)
    s.part('box', 'music_box', 'base', vel=4).notes('intro', bars(
        BELL.question('F', 6) + ' r/8', BELL.answer('F', 6) + ' r/2'), motifs={1: BELL})

    # rhythm section
    ride = s.part('ride', 'drums_jazz', 'base', vel=-12, gain=7)
    ride.pattern(['H', 'H2'], RIDE, fills={1: RIDE_C, 5: RIDE_C}).pattern('S', RIDE, fills={1: RIDE_C, 5: RIDE_C, 7: RIDE_C})
    kit = s.part('kit', 'drums_jazz', 'base', vel=-10)
    pattern(kit, 'H', COMP, fills={4: FILL4, 8: FILL8})              # _horns.pattern: 2-bar comping, fills on 4 / 8
    pattern(kit, 'H2', COMP, fills={2: FILL2, 4: FILL4, 6: FILL2, 8: FILL8})
    pattern(kit, 'S', COMP, fills={4: FILL4, 6: FILL6S, 8: FILL8})
    brush = s.part('brush', 'drums_brush', 'base', vel=-6) \
        .notes('intro', 'k?/4 s?/8 s?/8 k?/4 s?/8 s/8 | k?/4 s?/8 s?/8 s/8t s?/8t s/8t t1/8 t2/8')
    pattern(brush, 'Br', BRUSH, fills={1: BRUSH_C, 2: BRUSH_F2, 4: BRUSH_F4, 5: BRUSH_C, 6: BRUSH_F2, 8: BRUSH_F8})
    s.part('perc', 'drums', 'base', vel=-34, gain=3).pattern('Br', CONGA)

    bass = s.part('bass', 'upright_bass', 'base', vel=0, gain=-2.5)
    bass.notes('intro', 'bb1/4 d2/4 f2/4 a2/8 ab2/8 | c2/4 bb1/4 db2/4 f2/8 e2/8') \
        .notes(['H'], line(CH_H, WALK, WALK_H, low=33, nxt='Fmaj9')) \
        .notes('H2', line(CH_H2, WALK[1:] + WALK[:1], WALK_H, low=33, nxt='Bbmaj9')) \
        .notes('Br', line(CH_BR, BOSSA_B, BOSSA_H, low=33, nxt='G69')) \
        .notes('S', ' | '.join(line(CH_S, WALK, WALK_H, low=33, nxt='Gm9').split(' | ')[:4]
                               + [x for x in BASS_SOLO]
                               + line('F69 | Gm9 C7b9', WALK[3:], WALK_H, low=33, nxt='Fmaj9').split(' | ')))

    # NES triangle an octave over the walking bass (phone speakers hear the line; the 16-bit RPG chip + real doubling)
    s.part('tri', 'chip_triangle', 'base', octave=1, vel=-30, gain=-3).double('bass', ['H', 'H2', 'S'])

    rh = s.part('rhodes', 'rhodes', 'base', vel=-12, gain=4)
    rh.gen('intro', 'pad:sustain', voicing='rootless', low=55, high=72, vel=60)
    put(rh, 'H', comp(CH_H, RH_ODD, low=53, high=69, vel=78, against=M_H))
    put(rh, 'H2', comp(CH_H2, RH_ODD, low=53, high=69, vel=78, nxt='Bbmaj9', against=M_H2, also=X_H2))
    put(rh, 'Br', comp(CH_BR, PAD_BR, low=55, high=70, vel=54, gate=1.0, against=M_BR, also=X_BR))
    put(rh, 'S', comp(CH_S, RH, low=53, high=69, vel=80, skip=(5, 6), nxt='Fmaj9', against=M_S))
    put(s.part('rh_stab', 'rhodes', 'base', vel=-12), 'S',
        comp(CH_S, STAB_S, low=55, high=72, vel=86, skip=(2, 3), against=M_S))

    gtr = s.part('gtr', 'jazz_gtr', 'base', vel=-6, gain=1)
    put(gtr, 'H', comp(CH_H, GTR4, low=55, high=66, style='shell', vel=70, against=M_H, also=[rh.bodies['H']]))
    put(gtr, 'H2', comp(CH_H2, GTR4, low=55, high=66, style='shell', vel=70, against=M_H2, also=X_H2 + [rh.bodies['H2']]))
    put(gtr, 'Br', comp(CH_BR, BOSSA_GTR, low=55, high=67, vel=66, gate=0.6, against=M_BR, also=X_BR + [rh.bodies['Br']]))
    put(gtr, 'S', comp(CH_S, GTR4, low=55, high=66, style='shell', vel=74, skip=(5, 6), against=M_S, also=[rh.bodies['S']]))

    # the horn section: shouts in the melody stops (H, H2, Br) and the shout chorus (S)
    sec = s.part('sec_tpt', 'muted_trumpet', 'base', vel=2, gain=4)
    tpt = s.part('tpt', 'trumpet', 'base', vel=0, gain=-1.5)
    alto = s.part('alto', 'alto_sax', 'base', vel=-6, gain=-2)
    tenor = s.part('tenor', 'tenor_sax', 'base', vel=-6, gain=-2.5)
    bone = s.part('bone', 'trombone', 'base', vel=-4, gain=-1.5)
    for name, sh, ch in (('H', SH_H, CH_H), ('H2', SH_H2, CH_H2), ('Br', SH_BR, CH_BR)):
        sec.notes(name, bars(*sh), motifs={2: BELL} if name == 'H' else None)
        lo = harmonize(notes_of(bars(*sh), vel=96 + sec.vel), grid(ch), voices=3, floor=53)
        for p, v in zip((alto, tenor, bone), lo):
            put(p, name, v, vel=-sec.vel)
    tpt.notes('S', bars(*SHOUT), motifs={1: BELL, 3: BELL, 7: BELL})
    lo = harmonize(notes_of(bars(*SHOUT)), grid(CH_S), voices=3, floor=50)
    for p, v in zip((alto, tenor, bone), lo):
        put(p, 'S', v)
    # trombone backgrounds under H2 (soft guide-tone pads)
    put(s.part('bg', 'trombone', 'base', vel=-30, gain=4), 'H2', comp(CH_H2, [[(0, 2, 0), (2, 2, -6)]], low=50, high=62,
                                                              style='shell', vel=60, against=M_H2,
                                                              also=X_H2 + [rh.bodies['H2']]))

    # ================================================================ melody (the lobby's tune on top)
    vib = s.part('vibes', 'vibes_dry', 'melody', vel=6, gain=2.5)
    vib.notes('H', bars(*HEAD)).notes('H2', bars(*HEAD[:4], *HEAD2_END)).notes('Br', bars(*BOSSA)) \
        .notes('S', bars(*SHOUT), motifs={1: BELL, 3: BELL, 7: BELL})
    s.part('chip', 'chip_pulse12', 'melody', vel=-22, gain=-3.5).double('vibes')
    s.part('clar', 'clarinet', 'melody', vel=-8, gain=-2).notes('H2', bars(*CLAR_H2))
    s.part('mute', 'muted_trumpet', 'melody', vel=-6, gain=4).notes('H2', bars(*MUTE_H2)).notes('Br', bars(*MUTE_BR))
    s.part('box_q', 'music_box', 'melody', vel=0).at('Br', 8, 'r/2 ' + BELL.question('G', 6, rhythm=('16', '16', '8', '4')),
                                                       motif=BELL)
    return s


songs = [build()]
