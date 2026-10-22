"""'Sakura Sentinels' — the title theme. ORIGINAL composition (docs/AUDIO.md §4.1 rules, §4.3 main theme).

Lane: ANIME OPENING (orchestral pop + chip), round 3 "densify". The full statement of the main theme (§4.3), with
the band talking back to it ("melody — BAM"):
    intro  4 bars  music box rings the Sakura Bell (question → answer), then the question again, unanswered;
                   harp, a koto pentatonic flourish, strings, a timpani/snare build and a harp glissando
                   hand over to the band
    A      8 bars  main theme bars 1-8 (A + A′): chip pulse lead doubled by glock over a slap-bass line (16th
                   pickups, octave pops, a rest on beat 3 where the kick lands alone, chromatic approach into every
                   bar) and an organ + brass stab bed on 1, 2& and 4&. The lead breathes on its held notes and the
                   band answers: xylophone 16th double-ticks above the held E (bar 1), a brass-stab BAM + ticks in
                   bar 4; chip counter-line in A′
    B      8 bars  main theme bars 9-16, the playful lift to the flat side: trumpet doubles the lead an octave
                   down, a pizzicato strings 16th ostinato, e-piano charleston, choir; koto runs answer the held
                   notes of bars 12 and 14, xylophone + brass BAM in bar 16; disco hats; the last pickup leads up into …
    A_ab   8 bars  … the A section a minor third up in A♭ (the lift): orchestra hits, the stab bed doubled by brass,
                   a horn counter-melody, chip arpeggio pad; bars 7-8 are a call-and-response — the chip lead sings
                   half a bar, the brass section (trumpet, horn, trombone) answers the other half — and the E♭7 turns
                   back home to F (backdoor cadence)
Form: intro |: A B A_ab :|  — 4 + 24 bars at 132 bpm.

Leitmotifs: BELL (intro music box; A/A_ab bars 1, 3, 5 inside the theme), main theme (complete).
review: originality — the melody is the project's own main theme (§4.3) and BELL motif; bass lines, counter-
lines, answers, ostinato and fills are new. Compared by ear-memory against well-known game/anime title themes
(console, indie and gacha games): no shared hook
or contour. Composer A, 2026-10-08. Round 3 densify (holes + answers, stab bed, slap bass, strings ostinato, horn
counter, brass call-and-response): composer B5, 2026-10-13; `studio.py originality` clean.
"""
from sakura_audio.song import Song
from motifs import BELL
from _home import tr, bars, crescendo

# ---------------------------------------------------------------------------------------------------------------
# the main theme (docs/AUDIO.md §4.3), F major. Round 3: the lead breathes on the half notes of bars 4 and 16
# (a quarter + a quarter rest instead of a half) so the band's answer lands in the open beats.
THEME_A = [
    'c5/8 f5/8 d5/4 e5/4. f5/8',             # 1  Fmaj7      ⟨BELL⟩   (xylophone ticks over the held E)
    'a5/4 g5/8 f5/8 e5/4 d5/4',              # 2  Dm9
    'c5/8 f5/8 d5/4 e5/8 f5/8 g5/4',         # 3  B♭maj7     ⟨BELL⟩ (E over B♭ = ♯11)
    'a5/4. g5/8 c5/4 r/4',                   # 4  C7sus4 C7  (the C breathes: beats 3-4 open for the BAM)
    'c5/8 f5/8 d5/4 e5/4 c6/4',              # 5  Am7        ⟨BELL⟩, leap = lift
    'a5/8 bb5/8 a5/8 f#5/8 eb5/4 d5/4',      # 6  D7♭9
    'g5/4 bb5/8 a5/8 g5/8 f5/8 db5/4',       # 7  Gm9 B♭m6   (chromatic minor iv)
    'c5/4. d5/8 e5/4 g5/4',                  # 8  F/C C7
]
THEME_B = [
    'ab5/8 f5/8 c6/4 bb5/8 ab5/8 f5/4',      # 9  D♭maj7
    'bb5/8 g5/8 d6/4 c6/8 bb5/8 g5/4',       # 10 E♭maj9     (sequence a tone up)
    'a5/4 c6/4 eb6/4 d6/8 c6/8',             # 11 Fmaj7 F7/A
    'd6/4. c6/8 f5/8 ab5/8 b5/4',            # 12 B♭maj7 B°7 (koto answers the held D)
    'c6/4 a5/8 g5/8 f#5/8 a5/8 c6/4',        # 13 F/C D7
    'bb5/4. a5/8 g5/8 e5/8 c5/4',            # 14 Gm7 C7     (koto answers the held B♭)
    'e5/4 c5/8 a4/8 b4/8 d5/8 f5/4',         # 15 Am7 A♭°7
    'e5/4 r/4 d5/8 db5/8 c5/8 bb4/8',        # 16 Gm13 C7♭9  (the E breathes; pickup B♭4 → E♭5 into A♭)
]
# A in A♭: bars 1-6 a minor third up. Bars 7-8 are split between the chip lead (call) and the brass (answer)
THEME_A_AB = [tr(b, 3) for b in THEME_A[:6]] + ['bb5/4 db6/8 c6/8 r/2', 'eb5/4. f5/8 r/2']
BRASS_ANSWER = {   # the other half of A_ab bars 7-8 — the theme's own notes, harmonised, an octave down
    'tpt':  "r/2 bb4/8 ab4/8 e4/4 | r/2 g4/8 f4/8 eb4/8 db4/8",
    'horn': "r/2 db4/8 c4/8 ab3/4 | r/2 eb4/8 db4/8 bb3/8 g3/8",
    'bone': "r/2 e3/8 eb3/8 db3/4 | r/2 bb2/8 ab2/8 g2/8 e2/8",
}

CH_INTRO = 'Fmaj7 | Bbmaj7/F | Gm9 | C7sus4'
CH_A = 'Fmaj7 | Dm9 | Bbmaj7 | C7sus4 C7 | Am7 | D7b9 | Gm9 Bbm6 | F/C C7'
CH_B = 'Dbmaj7 | Ebmaj9 | Fmaj7 F7/A | Bbmaj7 Bdim7 | F/C D7 | Gm7 C7 | Am7 Abdim7 | Gm13 C7b9'
CH_AB = 'Abmaj7 | Fm9 | Dbmaj7 | Eb7sus4 Eb7 | Cm7 | F7b9 | Bbm9 Dbm6 | Ab/Eb Eb7'

# Slap bass (round 3): root, 16th pickup, octave pop on 2, a rest on beat 3 where the kick lands alone, then a
# 16th flick and the chromatic approach into the next bar. Bar 4 (the answer bar) runs up the C7 in 16ths.
BASS_A = [
    'f2/8. f2/16 f3/8 f2/8 r/8 c3/8 a2/16 f2/16 c#2/8',            # Fmaj7 → D
    'd2/8. d2/16 d3/8 d2/8 r/8 a2/8 c3/16 a2/16 b1/8',             # Dm9   → B♭
    'bb1/8. bb1/16 bb2/8 bb1/8 r/8 f2/8 a2/16 bb2/16 b1/8',        # B♭maj7 → C
    'c2/8. c2/16 c3/8 c2/8 bb1/8 c2/16 e2/16 g2/16 bb2/16 g#1/8',  # C7sus4 C7: the run (→ A)
    'a1/8. a1/16 a2/8 a1/8 r/8 e2/8 g2/16 a2/16 c#2/8',            # Am7   → D
    'd2/8. d2/16 d3/8 d2/8 r/8 a2/8 c3/16 eb3/16 f#2/8',           # D7♭9  → G
    'g2/8. g2/16 g3/8 bb2/8 bb1/8. bb1/16 bb2/8 db2/8',            # Gm9 B♭m6 → C
    'c2/8. c2/16 c3/8 c2/8 r/8 g2/8 e2/16 c3/16 d2/8',             # F/C C7 → D♭ (from above)
]
BASS_B = [                                    # disco octaves; the chromatic lines of 12 and 15 kept exactly
    'db2/8 db3/8 db2/8 db3/8 ab1/8 ab2/8 c2/16 db2/16 d2/8',
    'eb2/8 eb3/8 eb2/8 eb3/8 bb1/8 bb2/8 d2/16 eb2/16 e2/8',
    'f2/8 f3/8 f2/8 f3/8 a1/8 a2/8 a1/16 c2/16 b1/8',
    'bb1/8 bb2/8 f2/8 bb2/8 b1/8 b2/8 d2/16 f2/16 b1/8',          # B♭ → B → C
    'c2/8 c3/8 c2/8 c3/8 d2/8 d3/8 f#2/16 a2/16 f#2/8',
    'g1/8 g2/8 g1/8 g2/8 c2/8 c3/8 bb1/16 c2/16 g#1/8',
    'a1/8 a2/8 e2/8 a2/8 ab1/8 ab2/8 b1/16 d2/16 ab1/8',          # A → A♭ → G
    'g1/8 g2/8 g1/8 g2/8 c2/8 c3/8 e2/16 f2/16 g2/8',             # … climbs into A♭
]
BASS_AB = [tr(b, 3) for b in BASS_A[:7]] + ['eb2/8. eb2/16 eb3/8 eb2/8 r/8 bb1/8 db2/16 eb2/16 e2/8']   # E♮ → F

GROOVE = 'k+h/8 h/8 s+h/8 h/16 s?/16 k+h/8 k+h/8 s+h/8 h/8 |'
GROOVE_CRASH = 'k+c/8 h/8 s+h/8 h/16 s?/16 k+h/8 k+h/8 s+h/8 h/8 |'
GROOVE16 = 'k+h/16 h? h h? s+h/16 h? h s? k+h/16 h? k+h h? s+h/16 h? h h? |'
GROOVE16_CRASH = 'k+c/16 h? h h? s+h/16 h? h s? k+h/16 h? k+h h? s+h/16 h? h h? |'
FILL4 = 'k+h/8 h/8 s+h/8 h/8 k+h/8 s/16 s?/16 t1/8 t2/8 |'
FILL8 = 'k+h/8 h/8 s+h/8 h/8 s/16 s? s s t1/16 t1 t2 t3 |'
DISCO = 'k+h/8 o/8 k+s+h/8 o/8 k+h/8 o/8 k+s+h/8 o/8 |'
DISCO_CRASH = 'k+c/8 o/8 k+s+h/8 o/8 k+h/8 o/8 k+s+h/8 o/8 |'
DISCO_FILL4 = 'k+h/8 o/8 k+s+h/8 o/8 k+h/8 s/16 s? t2/8 t3/8 |'
CALL_FILL = 'k+h/16 h? h h? s+h/16 h? h s? k+c/8 h/16 h? s+h/8 k/16 k |'   # crash under the brass answer (A_ab 7)


def ostinato(chords: str, nbars: int, low: int = 60, high: int = 74, vel: int = 70) -> str:
    """Pizzicato strings 16ths: per beat low–top–middle–top of a close voicing of the chord sounding there
    (accent on the beat), voice-led from chord to chord."""
    from fractions import Fraction as Fr
    from sakura_audio.theory import parse_grid, voice, name_of
    grid = parse_grid(chords, nbars, 4)
    out, prev = [], None
    for row in grid:
        toks = []
        for beat in range(4):
            ch = [c for st, ln, c in row if st <= beat][-1]
            vs = voice(ch, low, high, 'close', prev)[:3]
            prev = vs
            lo, mid, top = vs[0], vs[len(vs) // 2], vs[-1]
            for i, p in enumerate((lo, top, mid, top)):
                v = vel + (10 if i == 0 else (-6 if i % 2 else 0))
                toks.append(f'{name_of(p)}/16@v{v}')
        out.append(' '.join(toks))
    return ' | '.join(out)


def build() -> Song:
    s = Song(id='title', title='Sakura Sentinels', bpm=132, meter=(4, 4), key='F',
             form=['intro', '|:', 'A', 'B', 'A_ab', ':|'],
             mix={'echo': {'delay_ms': 192, 'feedback': 0.40, 'volume': 0.28, 'fir': 'soft'}},
             description='Title screen: the full main theme (A A′ B), then A again lifted to A♭, backdoor E♭7 → F; '
                         'anime-opening band with answers in every breath of the tune.',
             extra={'lane': 'anime opening',
                    'busy': {'melody': {'lead': None, 'glock': None, 'tpt': ['B'], 'tpt_ab': None, 'str_mel': None,
                                        'box': None, 'box_bell': None},
                             'bass': ['bass', 'bass_intro'], 'primary_bass': 'bass',
                             'cat': {'xylo': 'answer', 'koto_ans': 'answer', 'bam': 'stab', 'hit': 'stab',
                                     'counter': 'counter', 'horn': 'counter', 'organ': 'stab', 'stabs': 'stab',
                                     'call_tpt': 'answer', 'call_horn': 'answer', 'call_bone': 'answer',
                                     'koto': 'arp', 'arp_pad': 'arp', 'str16': 'arp', 'timp': 'answer', 'ep': 'stab',
                                     'strings': 'pad', 'choir': 'pad'}}})
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

    # ---- the main theme: chip pulse lead + glock an octave up (the 16-bit RPG chip-plus-real doubling)
    s.part('lead', 'chip_pulse25', 'full').notes('A', bars(*THEME_A), motifs={1: BELL, 3: BELL, 5: BELL}) \
        .notes('B', bars(*THEME_B)).notes('A_ab', bars(*THEME_A_AB), motifs={1: BELL, 3: BELL, 5: BELL})
    s.part('glock', 'glock', 'full', octave=1, vel=-20).double('lead', ['A', 'A_ab'])
    s.part('tpt', 'trumpet', 'full', octave=-1, vel=-14).double('lead', 'B')
    s.part('tpt_ab', 'trumpet', 'full', vel=-22).double('lead', 'A_ab')
    s.part('str_mel', 'strings', 'full', octave=-1, vel=-8).double('lead', 'A_ab')

    # ---- answers ("melody — BAM"): above = xylophone 16th double-ticks, below = a brass-stab chord (A3-G4)
    s.part('xylo', 'xylophone', 'full', vel=-10) \
        .at('A', 1, "r/2 r/8 a6/16' c7/16' e7/8' r/8") \
        .at('A', 4, "r/2. e6/16' g6/16' c7/8'") \
        .at('A_ab', 1, "r/2 r/8 ab6/16' c7/16' eb7/8' r/8") \
        .at('A_ab', 4, "r/2. g6/16' bb6/16' eb7/8'") \
        .at('B', 8, "r/4 bb6/16' g6/16' e6/8' r/2")
    s.part('bam', 'brass_stab', 'full', vel=10) \
        .at('A', 4, "r/2. [bb3 c4 e4 g4]/8! r/8").at('A', 8, "r/2 [bb3 c4 e4 g4]/8! r/8 r/4") \
        .at('A_ab', 4, "r/2. [db4 eb4 g4 bb4]/8! r/8") \
        .at('B', 8, "r/4 [bb3 d4 f4 a4]/8! r/8 r/4. [e4 g4 bb4 db5]/8")
    s.part('koto_ans', 'koto', 'full', vel=-4) \
        .at('B', 4, "r/8 bb4/16 d5/16 f5/8 a5/8 r/2") \
        .at('B', 6, "r/8 g4/16 bb4/16 d5/8 f5/8 r/2")
    s.part('counter', 'counter', 'full', vel=-24).at('A', 5, bars(
        'g4/4. g4/8~ g4/2', 'f#4/4. f#4/8~ f#4/2', 'f4/4. f4/8~ f4/2', 'e4/4. e4/8 g4/4 bb4/4'))
    # horn counter-melody under the lifted A: guide tones in long values, contrary to the tune
    s.part('horn', 'horn', 'full', vel=-6, gain=-3).at('A_ab', 1, bars(
        'c4/2. eb4/4', 'eb4/2 c4/4 ab3/4', 'f4/2. eb4/8 db4/8', 'ab3/2 g3/2', 'g3/4. bb3/8 eb4/2', 'eb4/2 a3/2'))
    # A_ab 7-8: the brass section answers the chip lead half a bar at a time
    s.part('call_tpt', 'trumpet', 'full', vel=4).at('A_ab', 7, BRASS_ANSWER['tpt'])
    s.part('call_horn', 'horn', 'full', vel=0).at('A_ab', 7, BRASS_ANSWER['horn'])
    s.part('call_bone', 'trombone', 'full', vel=0).at('A_ab', 7, BRASS_ANSWER['bone'])

    # ---- harmony: stab bed (organ; brass doubles it in the lift), ostinato, pads
    s.part('bass', 'slap_bass', 'full', vel=-4, gain=-1.5).notes('A', bars(*BASS_A)).notes('B', bars(*BASS_B)) \
        .notes('A_ab', bars(*BASS_AB))
    s.part('organ', 'organ', 'full', vel=-12).gen(['A', 'A_ab'], 'comp:stabs', voicing='rootless', low=55, high=69)
    s.part('stabs', 'brass_stab', 'full', vel=-2).gen('A', 'comp:stabs', voicing='close', low=57, high=69, vel=66) \
        .gen('A_ab', 'comp:stabs', voicing='close', low=57, high=69)
    s.part('ep', 'epiano', 'full', gain=3).gen('B', 'comp:charleston', voicing='rootless', low=48, high=63, vel=66)
    # (GM 'strings' never speaks at 16th length: its attack is longer than the note, so the ostinato is pizzicato)
    s.part('str16', 'pizz', 'full', gate=0.6, gain=-1).notes('B', ostinato(CH_B, 8, low=60, high=74, vel=72))
    s.part('strings', 'strings', 'full').gen('A', 'pad:sustain', low=55, high=72, vel=42)
    s.part('choir', 'choir_ahh', 'full').gen('B', 'pad:sustain', low=60, high=76, vel=58) \
        .gen('A_ab', 'pad:sustain', low=60, high=76, vel=62)
    s.part('koto', 'koto', 'full', vel=0, gain=0).at('intro', 2, 'r/2 c5/16 d5/16 f5/16 g5/16 a5/8 c6/8')
    s.part('arp_pad', 'chip_pulse12', 'full', vel=-18, gain=-2).gen('A_ab', 'chip:arp32', low=72, high=86)
    s.part('hit', 'orch_hit', 'full').at('A_ab', 1, '[ab3 c4 eb4 ab4]/4 r/2.').at('A_ab', 5, '[g3 c4 eb4 g4]/4@v80 r/2.') \
        .at('B', 1, '[ab3 c4 f4 ab4]/4@v70 r/2.').at('A_ab', 8, 'r/2 [g3 bb3 db4 eb4]/8@v84 r/8 r/4')

    # ---- drums: tight, dry; chip-noise hats layered over the real kit from A′ on
    s.part('kit', 'drums', 'full').at('intro', 3, 'r/2. k?/4').at('intro', 4, 'k/4 r/4 ' + crescendo('s', '16', 8, 40, 108)) \
        .pattern('A', GROOVE, fills={1: GROOVE_CRASH, 4: FILL4, 5: GROOVE_CRASH, 8: FILL8}, vel=-8) \
        .pattern('B', DISCO, fills={1: DISCO_CRASH, 4: DISCO_FILL4, 5: DISCO_CRASH,
                                    8: 'k+h/8 h/8 s+h/8 h/8 ' + crescendo('s', '16', 8, 56, 112) + ' |'}) \
        .pattern('A_ab', GROOVE16, fills={1: GROOVE16_CRASH, 4: FILL4, 5: GROOVE16_CRASH, 7: CALL_FILL, 8: FILL8}, vel=4)
    s.part('chip_hats', 'chip_kit', 'full', vel=-34).at('A', 5, '((h/16 h? h h?)x4 |)x4') \
        .pattern(['B', 'A_ab'], '(h/16 h? h h?)x4 |')
    s.part('tamb', 'drums', 'full', vel=-26).pattern('B', 'r/8 tb/8 r/8 tb/8 r/8 tb/8 r/8 tb/16 tb/16 |')
    return s


songs = [build()]
