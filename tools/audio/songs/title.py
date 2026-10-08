"""'Sakura Sentinels' — the title theme. ORIGINAL composition (docs/AUDIO.md §4.1 rules, §4.3 main theme).

The full statement of the main theme, exactly as written out in docs/AUDIO.md §4.3:
    intro  4 bars  music box rings the Sakura Bell (question → answer), then the question again, unanswered;
                   harp, a koto pentatonic flourish, strings, a timpani/snare build and a harp glissando
                   hand over to the band
    A      8 bars  main theme bars 1-8 (A + A′): chip pulse lead doubled by glock, finger bass, e-piano
                   charleston comping, Toby-style xylophone answer in bar 4, chip counter-line in A′
    B      8 bars  main theme bars 9-16 (the playful lift to the flat side): trumpet doubles the lead an octave
                   down, choir "ahh", koto arpeggios, disco open hats; the last pickup leads up into …
    A_ab   8 bars  … the A section a minor third up in A♭ (the lift): orchestra hit, brass stabs, strings
                   doubling, chip arpeggio pad; the last bar turns the E♭7 into a backdoor cadence back to F
Form: intro |: A B A_ab :|  — 4 + 24 bars at 132 bpm.

review: originality — the melody is the project's own main theme (§4.3) and BELL motif; bass lines, counter-
lines and fills are new. Compared by ear-memory against well-known game/anime title themes (Undertale,
Deltarune, EarthBound/Mother, Zelda, Mario, Final Fantasy, Pokémon, Blue Archive, Kirby): no shared hook or
contour. Composer A, 2026-10-08.
"""
from sakura_audio.song import Song
from motifs import BELL
from _home import tr, bars, crescendo

# ---------------------------------------------------------------------------------------------------------------
# the main theme (docs/AUDIO.md §4.3), F major
THEME_A = [
    'c5/8 f5/8 d5/4 e5/4. f5/8',             # 1  Fmaj7      ⟨BELL⟩
    'a5/4 g5/8 f5/8 e5/4 d5/4',              # 2  Dm9
    'c5/8 f5/8 d5/4 e5/8 f5/8 g5/4',         # 3  B♭maj7     ⟨BELL⟩ (E over B♭ = ♯11)
    'a5/4. g5/8 c5/2',                       # 4  C7sus4 C7
    'c5/8 f5/8 d5/4 e5/4 c6/4',              # 5  Am7        ⟨BELL⟩, leap = lift
    'a5/8 bb5/8 a5/8 f#5/8 eb5/4 d5/4',      # 6  D7♭9
    'g5/4 bb5/8 a5/8 g5/8 f5/8 db5/4',       # 7  Gm9 B♭m6   (chromatic minor iv)
    'c5/4. d5/8 e5/4 g5/4',                  # 8  F/C C7
]
THEME_B = [
    'ab5/8 f5/8 c6/4 bb5/8 ab5/8 f5/4',      # 9  D♭maj7
    'bb5/8 g5/8 d6/4 c6/8 bb5/8 g5/4',       # 10 E♭maj9     (sequence a tone up)
    'a5/4 c6/4 eb6/4 d6/8 c6/8',             # 11 Fmaj7 F7/A
    'd6/4. c6/8 f5/8 ab5/8 b5/4',            # 12 B♭maj7 B°7
    'c6/4 a5/8 g5/8 f#5/8 a5/8 c6/4',        # 13 F/C D7
    'bb5/4. a5/8 g5/8 e5/8 c5/4',            # 14 Gm7 C7
    'e5/4 c5/8 a4/8 b4/8 d5/8 f5/4',         # 15 Am7 A♭°7
    'e5/2 d5/8 db5/8 c5/8 bb4/8',            # 16 Gm13 C7♭9  (pickup B♭4 → E♭5: up into the A♭ lift)
]
# A in A♭: bars 1-7 a minor third up; bar 8 = backdoor: E♭7's 7th (D♭) falls to C, the 5th of F at the loop top
THEME_A_AB = [tr(b, 3) for b in THEME_A[:7]] + ['eb5/4. f5/8 g5/8 f5/8 eb5/8 db5/8']

CH_INTRO = 'Fmaj7 | Bbmaj7/F | Gm9 | C7sus4'
CH_A = 'Fmaj7 | Dm9 | Bbmaj7 | C7sus4 C7 | Am7 | D7b9 | Gm9 Bbm6 | F/C C7'
CH_B = 'Dbmaj7 | Ebmaj9 | Fmaj7 F7/A | Bbmaj7 Bdim7 | F/C D7 | Gm7 C7 | Am7 Abdim7 | Gm13 C7b9'
CH_AB = 'Abmaj7 | Fm9 | Dbmaj7 | Eb7sus4 Eb7 | Cm7 | F7b9 | Bbm9 Dbm6 | Ab/Eb Eb7'

# Toby-style finger bass: root, a hiccup rest on 2, octave pop on 2&, then a moving eighth line with
# chromatic approach notes into every chord change.
BASS_A = [
    'f2/4 r/8 f3/8 c3/8 a2/8 f2/8 e2/8',
    'd2/4 r/8 d3/8 c3/8 a2/8 f2/8 a1/8',
    'bb1/4 r/8 bb2/8 f2/8 d2/8 bb1/8 b1/8',
    'c2/4 r/8 c3/8 bb2/8 g2/8 e2/8 bb1/8',
    'a1/4 r/8 a2/8 g2/8 e2/8 c2/8 c#2/8',
    'd2/4 r/8 d3/8 c3/8 a2/8 f#2/8 ab2/8',
    'g2/4 r/8 g3/8 bb2/8 f2/8 g2/8 db2/8',
    'c2/4 r/8 c3/8 bb2/8 g2/8 e2/8 d2/8',
]
BASS_B = [                                    # broad dotted half-time feel; the chromatic lines of 12 and 15 exact
    'db2/4. db2/8 ab2/4 f2/4',
    'eb2/4. eb2/8 bb2/4 g2/4',
    'f2/4. f2/8 a2/2',
    'bb2/4. bb2/8 b2/2',
    'c3/4. c3/8 d3/4 f#2/4',
    'g2/4. g2/8 c2/4 e2/4',
    'a2/4. a2/8 ab2/2',
    'g2/4. g2/8 c2/4 g2/4',
]
BASS_AB = [tr(b, 3) for b in BASS_A[:7]] + ['eb2/4 r/8 eb3/8 db3/8 bb2/8 g2/8 e2/8']   # E♮ → F at the loop top

GROOVE = 'k+h/8 h/8 s+h/8 h/16 s?/16 k+h/8 k+h/8 s+h/8 h/8 |'
GROOVE_CRASH = 'k+c/8 h/8 s+h/8 h/16 s?/16 k+h/8 k+h/8 s+h/8 h/8 |'
GROOVE16 = 'k+h/16 h? h h? s+h/16 h? h s? k+h/16 h? k+h h? s+h/16 h? h h? |'
GROOVE16_CRASH = 'k+c/16 h? h h? s+h/16 h? h s? k+h/16 h? k+h h? s+h/16 h? h h? |'
FILL4 = 'k+h/8 h/8 s+h/8 h/8 k+h/8 s/16 s?/16 t1/8 t2/8 |'
FILL8 = 'k+h/8 h/8 s+h/8 h/8 s/16 s? s s t1/16 t1 t2 t3 |'
DISCO = 'k+h/8 o/8 k+s+h/8 o/8 k+h/8 o/8 k+s+h/8 o/8 |'
DISCO_CRASH = 'k+c/8 o/8 k+s+h/8 o/8 k+h/8 o/8 k+s+h/8 o/8 |'


def build() -> Song:
    s = Song(id='title', title='Sakura Sentinels', bpm=132, meter=(4, 4), key='F',
             form=['intro', '|:', 'A', 'B', 'A_ab', ':|'],
             mix={'echo': {'delay_ms': 192, 'feedback': 0.40, 'volume': 0.28, 'fir': 'soft'}},
             description='Title screen: the full main theme (A A′ B), then A again lifted to A♭, backdoor E♭7 → F.')
    s.section('intro', 4, CH_INTRO)
    s.section('A', 8, CH_A)
    s.section('B', 8, CH_B)
    s.section('A_ab', 8, CH_AB)

    # ---- intro: the Sakura Bell on its home timbre, the music box with SNES echo
    s.part('box', 'music_box', 'full', vel=8).notes('intro', bars(
        BELL.question('F', 6) + ' r/8',           # c6 f6 d6 e6.  (question)
        BELL.answer('F', 6) + ' r/2',             # f6            (answer)
        BELL.question('F', 6) + ' r/8',           # the question again …
        'r/1'), motifs={1: BELL, 3: BELL})        # … left hanging: the band answers with the theme
    s.part('box_bell', 'chip_bell', 'full', vel=-30).at('intro', 3, BELL.question('F', 5) + ' r/8')
    s.part('harp', 'harp', 'full', vel=-16).gen('intro', 'arp:updown8', bars=(1, 3), low=53, high=77)
    s.part('harp_gliss', 'harp', 'full', vel=-6).at('intro', 4, 'r/2 f3/32 ' + 'g3 bb3 c4 f4 g4 bb4 c5 f5 g5 bb5 c6 f6 g6 bb6 c7')
    s.part('str_intro', 'strings_slow', 'full').gen('intro', 'pad:sustain', low=53, high=72, vel=58)
    s.part('bass_intro', 'finger_bass', 'full', vel=-34).notes('intro', 'f2/1 | f2/1 | g2/1 | c2/2 r/4 c2/8 e2/8')
    s.part('timp', 'timpani', 'full').at('intro', 4, 'c2/4@v70 r/4 ' + crescendo('c2', '16', 8, 44, 100)) \
        .at('A_ab', 1, 'ab2/4@v110 r/2.').at('A_ab', 5, 'c3/4@v96 r/2.').at('B', 8, 'r/2 ' + crescendo('c2', '16', 8, 40, 96))

    # ---- the main theme: chip pulse lead + glock an octave up (the EarthBound/Toby chip-plus-real doubling)
    s.part('lead', 'chip_pulse25', 'full').notes('A', bars(*THEME_A), motifs={1: BELL, 3: BELL, 5: BELL}) \
        .notes('B', bars(*THEME_B)).notes('A_ab', bars(*THEME_A_AB), motifs={1: BELL, 3: BELL, 5: BELL})
    s.part('glock', 'glock', 'full', octave=1, vel=-20).double('lead', ['A', 'A_ab'])
    s.part('tpt', 'trumpet', 'full', octave=-1, vel=-14).double('lead', 'B')
    s.part('tpt_ab', 'trumpet', 'full', vel=-22).double('lead', 'A_ab')
    s.part('str_mel', 'strings', 'full', octave=-1, vel=-8).double('lead', 'A_ab')

    # call and response: a xylophone answer while the melody holds its C (bar 4), chip counter-line in A′
    s.part('xylo', 'xylophone', 'full', vel=-12).at('A', 4, 'r/2 c6/16 d6/16 f6/16 g6/16 bb6/8 g6/8') \
        .at('A_ab', 4, 'r/2 eb6/16 f6/16 ab6/16 bb6/16 db7/8 bb6/8')
    s.part('counter', 'counter', 'full', vel=-24).at('A', 5, bars(
        'g4/4. g4/8~ g4/2', 'f#4/4. f#4/8~ f#4/2', 'f4/4. f4/8~ f4/2', 'e4/4. e4/8 g4/4 bb4/4'))

    # ---- harmony
    s.part('bass', 'finger_bass', 'full', vel=-24).notes('A', bars(*BASS_A)).notes('B', bars(*BASS_B)).notes('A_ab', bars(*BASS_AB))
    s.part('ep', 'epiano', 'full').gen('A', 'comp:charleston', voicing='rootless', low=53, high=71, vel=68) \
        .gen('A_ab', 'comp:charleston', voicing='rootless', low=53, high=71, vel=74)
    s.part('strings', 'strings', 'full').gen('A', 'pad:sustain', low=55, high=72, vel=46) \
        .gen('B', 'pad:sustain', low=55, high=74, vel=52)
    s.part('choir', 'choir_ahh', 'full').gen('B', 'pad:sustain', low=60, high=76, vel=62) \
        .gen('A_ab', 'pad:sustain', low=60, high=76, vel=66)
    s.part('koto', 'koto', 'full', vel=-14).at('intro', 2, 'r/2 c5/16 d5/16 f5/16 g5/16 a5/8 c6/8') \
        .gen('B', 'arp:updown8', low=62, high=84, vel=64)
    s.part('stabs', 'brass_stab', 'full', vel=6).gen('A_ab', 'comp:stabs', voicing='close', low=58, high=74)
    s.part('arp_pad', 'chip_pulse12', 'full', vel=-34).gen('A_ab', 'chip:arp32', low=72, high=86)
    s.part('hit', 'orch_hit', 'full').at('A_ab', 1, '[ab3 c4 eb4 ab4]/4 r/2.').at('A_ab', 5, '[g3 c4 eb4 g4]/4@v80 r/2.').at('B', 1, '[db4 f4 ab4]/4@v70 r/2.')

    # ---- drums: tight, dry; chip-noise hats layered over the real kit from A′ on
    s.part('kit', 'drums', 'full').at('intro', 3, 'r/2. k?/4').at('intro', 4, 'k/4 r/4 ' + crescendo('s', '16', 8, 40, 108)) \
        .pattern('A', GROOVE, fills={1: GROOVE_CRASH, 4: FILL4, 8: FILL8}, vel=-8) \
        .pattern('B', DISCO, fills={1: DISCO_CRASH, 4: FILL4, 8: 'k+h/8 h/8 s+h/8 h/8 ' + crescendo('s', '16', 8, 56, 112) + ' |'}) \
        .pattern('A_ab', GROOVE16, fills={1: GROOVE16_CRASH, 4: FILL4, 5: GROOVE16_CRASH, 8: FILL8}, vel=4)
    s.part('chip_hats', 'chip_kit', 'full', vel=-34).at('A', 5, '((h/16 h? h h?)x4 |)x4') \
        .pattern(['B', 'A_ab'], '(h/16 h? h h?)x4 |')
    return s


songs = [build()]
