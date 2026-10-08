"""'Roll Call' — the toolkit demo song. ORIGINAL composition (docs/AUDIO.md §4.1: no quotes, no paraphrases).

One short tune that exercises every palette role and both stem layouts, so a palette can be auditioned in a
single listen (`studio.py render demo_battle --palette toby` = every role through the Toby fonts):

  demo          cosy lobby arrangement, F major, 112 bpm swing — stems base + melody (menu layout)
  demo_battle   the same tune up a tone in G, 144 bpm straight — stems base + intensity (battle layout);
                uses every role in the palette (the melody relay sits in base, the battle layer in intensity)
  demo_sting    1-bar wave-start stinger in G (one-shot, stinger bus)
  demo_victory  the 4-note victory sting + a bVI–bVII–I brass cadence in F (one-shot, jingle)

The melody is passed around the band one bar at a time (a lead + an octave double per bar), the bass and
comping instruments change every two bars, so every role gets a moment in the spotlight.
Until the real soundtrack lands, the game uses these as stand-ins (songs/standins.json).

review: originality — new melody; only the shared BELL / victory-sting motifs are reused. Toolkit author, 2026-10-08.
"""
from sakura_audio.song import Song
from motifs import BELL, VICTORY_STING

INTRO_CHORDS = 'Fmaj7 | C7sus4'
A_CHORDS = 'Fmaj9 | D7b9 | Gm9 | C13sus4 C7 | Am7 | Abdim7 | Gm7 C7 | F6 C7'
B_CHORDS = 'Dbmaj7 | Ebsus4 Eb7 | Cm7 | Fm9 | Dbmaj7 | Bbm7 Eb7 | Abmaj7 | C7sus4 C7'

TUNE_A = [
    'c5/8 f5/8 d5/4 e5/4. r/8',             # BELL question
    'f#5/8 a5/8 c6/8 eb6/8 d6/4 c6/4',
    'bb5/4 a5/8 g5/8 f5/8 g5/8 a5/4',
    'g5/4. f5/8 e5/2',
    'c5/8 f5/8 d5/4 e5/4 g5/4',             # BELL again, then a lift
    'ab5/8 b5/8 d6/8 f6/8 e6/4 d6/4',
    'c6/4 bb5/8 a5/8 g5/8 e5/8 c5/4',
    'f5/2. r/4',                            # answered
]
TUNE_B = [                                  # playful lift to the flat side (F → Ab)
    'ab5/8 c6/8 f6/4 eb6/8 c6/8 ab5/4',
    'bb5/4. ab5/8 g5/4 eb5/4',
    'g5/8 bb5/8 eb6/4 d6/8 c6/8 bb5/4',
    'ab5/2 g5/4 f5/4',
    'eb5/8 ab5/8 f5/4 g5/4. r/8',           # BELL in Ab, unanswered
    'f5/8 ab5/8 db6/8 c6/8 bb5/4 g5/4',
    'ab5/2. c6/8 bb5/8',
    'f5/4 g5/4 bb5/4 e5/4',                 # pivot back to F
]
# bar → (lead role, lead octave, double role, double octave)
RELAY_A = [('lead', 0, 'glock', 1), ('flute', 0, 'chip_pulse12', 0), ('vibes', 0, 'celesta', 1), ('trumpet', 0, 'muted_trumpet', -1),
           ('music_box', 1, 'chip_bell', 0), ('alto_sax', 0, 'xylophone', 1), ('ocarina', 0, 'kalimba', 0), ('steel_drum', 0, 'marimba', -1)]
RELAY_B = [('koto_pluck', 0, 'shamisen', -1), ('shakuhachi', 0, 'pan_flute', 0), ('recorder', 0, 'piccolo', 1), ('whistle', 0, 'harp', -1),
           ('chip_pulse50', 0, 'tubular_bells', 0), ('chip_saw', 0, 'accordion', -1), ('harpsichord', 0, 'chip_pluck', 1), ('counter', 0, 'synth_voice', 0)]
BASS = [('upright_bass', 'A', (1, 2)), ('finger_bass', 'A', (3, 4)), ('pick_bass', 'A', (5, 6)), ('fretless', 'A', (7, 8)),
        ('slap_bass', 'B', (1, 2)), ('synth_bass', 'B', (3, 4)), ('chip_triangle', 'B', (5, 6)), ('bass', 'B', (7, 8))]
COMP = [('piano', 'A', (1, 2), 'comp:charleston'), ('epiano', 'A', (3, 4), 'comp:charleston'), ('keys', 'A', (5, 6), 'comp:offbeat'),
        ('organ', 'A', (7, 8), 'comp:stabs'), ('organ_drawbar', 'B', (1, 2), 'pad:sustain'), ('nylon_gtr', 'B', (3, 4), 'comp:bossa'),
        ('clean_gtr', 'B', (5, 6), 'comp:offbeat'), ('epiano_fm', 'B', (7, 8), 'comp:charleston')]


def build(variant: str) -> Song:
    battle = variant == 'battle'
    s = Song(id='demo_battle' if battle else 'demo',
             title='Roll Call (battle)' if battle else 'Roll Call',
             bpm=144 if battle else 112, meter=(4, 4), key='G' if battle else 'F', transpose=2 if battle else 0,
             swing=0 if battle else 0.6, form=['intro', '|:', 'A', 'B', ':|'],
             description='Toolkit demo: every palette role, menu (base+melody) and battle (base+intensity) stem layouts.')
    s.section('intro', 2, INTRO_CHORDS)
    s.section('A', 8, A_CHORDS)
    s.section('B', 8, B_CHORDS)
    mel = 'base' if battle else 'melody'

    # ---- intro: music box BELL (question → answer), koto arpeggio, string bed, brushes + chip hats
    s.part('intro_box', 'music_box', mel).notes('intro', BELL.question('F', 6) + ' r/8 | ' + BELL.answer('F', 6) + ' r/2', motifs={1: BELL})
    s.part('intro_koto', 'koto', 'base', vel=-10).gen('intro', 'arp:updown8', low=60, high=77)
    s.part('intro_strings', 'strings_slow', 'base').gen('intro', 'pad:sustain', low=53, high=69, vel=60)
    s.part('intro_bass', 'chip_bass', 'base').notes('intro', 'f2/2. c3/4 | c2/1')
    s.part('intro_brush', 'drums_brush', 'base').pattern('intro', 'h/8 h/8 s?/4 h/8 h/8 s?/4 |')

    # ---- the tune, passed around the band
    for section, tune, relay in (('A', TUNE_A, RELAY_A), ('B', TUNE_B, RELAY_B)):
        for bar, (text, (lead, lo, dbl, do)) in enumerate(zip(tune, relay), start=1):
            motif = BELL if (section, bar) in (('A', 1), ('A', 5), ('B', 5)) else None
            s.part(f'mel_{lead}', lead, mel, octave=lo).at(section, bar, text, motif=motif)
            s.part(f'dbl_{dbl}', dbl, mel, octave=do, vel=-14).at(section, bar, text)

    # ---- bass and comping change hands every two bars
    for role, section, bars in BASS:
        style = 'bass:sync' if (battle or role == 'slap_bass') else 'bass:walking'
        s.part(f'bass_{role}', role, 'base').gen(section, style, bars=bars)
    for role, section, bars, kind in COMP:
        s.part(f'comp_{role}', role, 'base', vel=-6).gen(section, kind, bars=bars, voicing='rootless', low=52, high=72)
    s.part('pad_warm', 'pad_warm', 'base').gen('A', 'pad:sustain', bars=(1, 4), low=55, high=72, vel=56)
    s.part('pad_alias', 'pad', 'base').gen('A', 'pad:sustain', bars=(5, 8), low=55, high=72, vel=56)
    s.part('pad_choir', 'pad_choir', 'base').gen('B', 'pad:sustain', bars=(1, 4), low=55, high=72, vel=56)
    s.part('pad_halo', 'pad_halo', 'base').gen('B', 'pad:sustain', bars=(5, 8), low=55, high=72, vel=56)
    s.part('choir_ooh', 'choir_ooh', 'base').gen('B', 'pad:sustain', low=60, high=76, vel=46)

    # ---- drums: a real kit + chip-noise hats layered on top (the NES/EarthBound signature)
    if battle:
        s.part('kit', 'drums', 'base').gen('A', 'drums:straight')
        s.part('kit_room', 'drums_room', 'base').gen('B', 'drums:four')
    else:
        s.part('kit', 'drums', 'base', vel=-14).gen('A', 'drums:shuffle')
        s.part('kit_room', 'drums_room', 'base', vel=-14).gen('B', 'drums:bossa')
    s.part('chip_hats', 'chip_kit', 'base', vel=-30).pattern(['A', 'B'], 'h/16 h? h h? h h? h h? h h? h h? h h? o/16 h?/16 |')

    if battle:
        # ---- the battle layer: never changes harmony, only adds drive and colour
        s.part('stabs', 'brass_stab', 'intensity').gen(['A', 'B'], 'comp:stabs', low=58, high=76, voicing='close')
        s.part('brass_pad', 'brass', 'intensity').gen('B', 'pad:sustain', low=55, high=70, vel=60)
        s.part('bone', 'trombone', 'intensity').gen('A', 'bass:root5', low=40, high=55, vel=84)
        s.part('tuba', 'tuba', 'intensity').gen('B', 'bass:root', low=28, high=43, vel=88)
        s.part('horn', 'horn', 'intensity').notes('A', 'a3/1 | a3/2 c4/2 | bb3/1 | bb3/2 e4/2 | c4/1 | b3/1 | bb3/2 bb3/2 | a3/1')
        s.part('hits', 'orch_hit', 'intensity').at('A', 8, 'r/2 [c4 e4 g4]/4 r/4').at('B', 1, '[db4 f4 ab4]/4 r/2.').at('B', 8, 'r/2 [c4 e4 bb4]/4 r/4')
        s.part('timp', 'timpani', 'intensity').notes('A', 'f2/4 r/2. | d2/4 r/2. | g2/4 r/2. | c2/4 r/4 c2/8 c2/8 c2/4 | a2/4 r/2. | ab2/4 r/2. | g2/4 r/4 c2/4 c2/4 | f2/4 r/4 c2/8 c2/8 c2/4')
        s.part('trem', 'tremolo', 'intensity').gen('B', 'pad:sustain', low=48, high=64, vel=64)
        s.part('pizz', 'pizz', 'intensity').gen('A', 'arp:updown8', low=55, high=72, vel=70)
        s.part('strings_hi', 'strings', 'intensity').gen('A', 'pad:sustain', low=67, high=84, vel=58)
        s.part('choir_b', 'choir_ahh', 'intensity').gen('B', 'pad:sustain', low=60, high=76, vel=60)
        s.part('choir_a', 'choir', 'intensity').gen('A', 'pad:sustain', bars=(5, 8), low=60, high=76, vel=54)
        s.part('od_gtr', 'overdrive_gtr', 'intensity').gen('B', 'comp:quarters', low=50, high=64, voicing='triad', vel=74)
        s.part('dist_gtr', 'dist_gtr', 'intensity').at('A', 7, 'g3/8 g3/8 bb3/8 c4/8 r/8 c4/8 bb3/8 g3/8 | f3/4 r/4 c4/8 c4/8 r/4')
        s.part('taiko', 'taiko', 'intensity').pattern('B', 'c3/4 r/8 c3/8 c3/4 c3/8 c3/8 |')
        s.part('toms', 'melodic_tom', 'intensity').at('A', 8, 'r/2 g3/16 e3/16 d3/16 c3/16 r/4').at('B', 8, 'r/2 g3/16 e3/16 d3/16 c3/16 r/4')
        s.part('block', 'woodblock', 'intensity').pattern('A', 'r/8 c5/8 r/4 r/8 c5/8 c5/8 c5/8 |')
        s.part('swell', 'rev_cymbal', 'intensity').at('A', 8, 'r/2 c4/2').at('B', 8, 'r/2 c4/2')
        s.part('power_kit', 'drums_power', 'intensity', vel=-12).pattern('A', 'cl/8 h/16 h h/8 h/16 h cl/8 h/16 h h/8 h/16 h |')
        s.part('orch_kit', 'drums_orch', 'intensity', vel=-6).pattern('B', 'k/4 r/4 k/8 k/8 s/4 |', fills={1: 'k+c/2 r/2 |', 5: 'k+c/2 r/2 |'})
        s.part('arp_counter', 'chip_pulse25', 'intensity', vel=-20).gen('B', 'chip:arp32', low=72, high=88)
    return s


def sting() -> Song:
    s = Song(id='demo_sting', title='Roll Call — wave sting', bpm=144, key='G', form=['S'], bus='stinger', tail=2.0)
    s.section('S', 1)
    s.part('roll', 'drums', 'full').notes('S', 's?/16 s s? s s? s s! s! r/4 k+c/4')
    s.part('arp', 'chip_pulse25', 'full').notes('S', 'r/2 g5/16 b5/16 d6/16 g6/16 r/4')
    s.part('stab', 'brass_stab', 'full').notes('S', 'r/2. [g4 b4 d5 g5]/4')
    s.part('hit', 'orch_hit', 'full', vel=-10).notes('S', 'r/2. [g3 d4 g4]/4')
    return s


def victory() -> Song:
    s = Song(id='demo_victory', title='Roll Call — victory', bpm=132, key='F', form=['V'], bus='jingle', tail=2.5)
    s.section('V', 3)
    sting = VICTORY_STING.question('F', 5)          # c5/16 f5/16 d5/8 f5/4 — the motif already answered
    s.part('lead', 'chip_pulse25', 'full').notes('V', f'{sting} f5/4 g5/4 | a5/1 | r/1', motifs={1: VICTORY_STING})
    s.part('tpt', 'trumpet', 'full', vel=-8).notes('V', f'{sting} f5/4 g5/4 | a5/1 | r/1')
    s.part('brass', 'brass', 'full').notes('V', 'r/2 [db4 f4 ab4]/4 [eb4 g4 bb4]/4 | [f4 a4 c5 g5]/1 | r/1')
    s.part('timp', 'timpani', 'full').notes('V', 'r/2 db2/4 eb2/4 | f2/1 | r/1')
    s.part('kit', 'drums', 'full').notes('V', 'r/2 s/8 s/8 s/8 s/8 | k+c/1 | r/1')
    s.part('sparkle', 'chip_pulse12', 'full', vel=-24).notes('V', 'r/1 | (f6/16 a6/16 c7/16 g6/16)x4 | r/1')
    s.part('box', 'music_box', 'full', vel=-10).notes('V', 'r/1 | r/2 c6/4 f6/4 | r/1')
    return s


songs = [build('lobby'), build('battle'), sting(), victory()]
