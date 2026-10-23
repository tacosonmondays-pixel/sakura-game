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

    # ---- drums: a real kit + chip-noise hats layered on top (the NES / 16-bit RPG signature)
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


def genres() -> Song:
    """'Roll Call: genre bus' (round 3): two bars per lane, so every round-3 role and effect is heard once in one listen.

    J jazz (section swing 0.64, triplet skips kept) · K ska · C city pop · T techno (909, pumped bass and
    supersaw keyed to the kick) · H hardtek (driven kick, pumped saw bass, acid line with a filter sweep) ·
    E Celtic jig (8th-triplets) · S surf · W sweet. ORIGINAL two-bar sketches, no leitmotifs, no quotes."""
    s = Song(id='demo_genres', title='Roll Call (genres)', bpm=128, meter=(4, 4), key='C', swing_triplets='keep',
             form=['I', '|:', 'J', 'K', 'C', 'T', 'H', 'E', 'S', 'W', ':|'],
             description='Toolkit demo: every round-3 role, the part effects (filter, drive, pump) and section swing.')
    s.section('I', 1, 'C')
    s.section('J', 2, 'Dm9 G13 | Cmaj9 A7#9', swing=0.64)
    s.section('K', 2, 'C | G7')
    s.section('C', 2, 'Am7 | G6 A7')
    s.section('T', 2, 'Fm | Dbmaj7')
    s.section('H', 2, 'Bm | G A')
    s.section('E', 2, 'Am | G')
    s.section('S', 2, 'Em | C B7')
    s.section('W', 2, 'Cmaj7 | Fmaj7 G7')

    s.part('intro_sweep', 'sweep_pad', 'base').notes('I', '[c4 g4 c5]/1')
    # J — jazz: ride spang-a-lang, walking bass with a triplet skip, Rhodes + guitar comping, vibes head, horn shout
    s.part('jazz_kit', 'drums_jazz', 'base').notes('J', 'rd/4 rd+ph/8 rd/8 rd/4 rd+ph/8 rd/8 | rd/4 rd+ph/8 rd/8 st/8 st/8 k+sr/8 fs/8')
    s.part('jazz_bass', 'upright_bass', 'base').notes('J', 'd2/4 f2/4 g2/4 b1/8t c2/8t c#2/8t | c2/4 e2/4 a1/4 bb1/4')
    s.part('jazz_rhodes', 'rhodes', 'base').notes('J', 'r/8 [f3 a3 c4 e4]/8 r/4 r/8 [f3 b3 e4]/8 r/4 | [e3 g3 b3 d4]/4. [e3 g3 c#4 g4]/8 r/2')
    s.part('jazz_gtr', 'jazz_gtr', 'base').notes('J', '[d3 c4 f4]/4 [d3 c4 f4]/4 [g2 f3 b3]/4 [g2 f3 b3]/4 | '
                                                       '[c3 b3 e4]/4 [c3 b3 e4]/4 [a2 g3 c#4]/4 [a2 g3 c#4]/4')
    s.part('jazz_vibes', 'vibes_dry', 'base').notes('J', 'a4/8 c5/8 e5/8 d5/8 r/8 c5/8 a4/4 | b4/4 r/8 g4/8 e4/4 r/4')
    for name, role, p in (('shout_tpt', 'muted_trumpet', 'a4'), ('shout_alto', 'alto_sax', 'e4'),
                          ('shout_tenor', 'tenor_sax', 'c#4'), ('shout_bone', 'trombone', 'g3')):
        s.part(name, role, 'base').notes('J', f'r/1 | r/2 {p}/8. {p}/16 r/4')
    s.part('jazz_clar', 'clarinet', 'intensity').notes('J', 'f4/2 e4/4. d4/8 | e4/2. r/4')
    # K — ska: skank on every 'and', walking 8ths, harmonica head, bari + trombone blat in the hole
    s.part('ska_kit', 'drums', 'base').notes('K', 'k/8 h/8 rs/8 o/8 k/8 h/8 rs/8 o/8 | k/8 h/8 rs/8 o/8 k/8 k/8 rs/8 c/8')
    s.part('ska_bass', 'finger_bass', 'base').notes('K', 'c2/8 c3/8 e2/8 g2/8 a2/8 g2/8 e2/8 eb2/8 | d2/8 d3/8 f2/8 g2/8 b1/8 d2/8 g1/8 b1/8')
    s.part('ska_skank', 'muted_gtr', 'base').notes('K', '(r/8 [e4 g4 c5]/8)x4 | (r/8 [d4 f4 b4]/8)x4')
    s.part('ska_harp', 'harmonica', 'base').notes('K', 'e5/4 g5/8 a5/8 g5/4 e5/4 | d5/4. f5/8 g5/4 r/4')
    s.part('ska_bari', 'bari_sax', 'intensity').notes('K', 'r/1 | r/2. g2/8 r/8')
    s.part('ska_bone', 'trombone', 'intensity').notes('K', 'r/1 | r/2. b2/8 r/8')
    # C — city pop: four-on-the-floor, slap octaves, 16th scratch, clav stabs, square hook, synth-brass answer
    s.part('pop_kit', 'drums_electro', 'base').notes('C', '(k/8 o/8 k+cl/8 o/8)x2 | (k/8 o/8 k+cl/8 o/8)x2')
    s.part('pop_bass', 'slap_bass', 'base').notes('C', 'a1/16 a2/16 r/16 a1/16 a2/8 e2/8 a1/16 a2/16 r/8 g2/8 g#2/8 | '
                                                       'g1/16 g2/16 r/16 g1/16 g2/8 d2/8 a1/16 a2/16 r/8 c#3/8 e2/8')
    s.part('pop_funk', 'funk_gtr', 'base').notes('C', '(r/16 [a3 c4 e4]/16 r/16 [a3 c4 e4]/16)x4 | (r/16 [g3 b3 e4]/16 r/16 [g3 c#4 e4]/16)x4')
    s.part('pop_clav', 'clavinet', 'base').notes('C', 'r/4 r/8 [a3 c4 e4]/8 r/4 r/8 [a3 c4 e4]/8 | r/4 r/8 [g3 b3 e4]/8 r/4 r/8 [g3 c#4 e4]/8')
    s.part('pop_lead', 'square_lead', 'base').notes('C', 'c5/8 a4/8 c5/8 e5/8 r/8 d5/8 c5/4 | b4/8 a4/8 g4/8 a4/8 r/2')
    s.part('pop_brass', 'synth_brass', 'intensity').notes('C', 'r/1 | r/2 [e4 g4 c5]/8 r/8 [e4 g4 c#5]/8 r/8')
    # T — techno: 909 grid, 16th bass rolling between the kicks and a pumped supersaw (sidechain keyed to the kick)
    s.part('tek_kit', 'drums_909', 'base').notes('T', '(k/16 h/16 o/16 h/16 k+cl/16 h/16 o/16 h/16)x2 | '
                                                      'k/16 h/16 o/16 h/16 k+cl/16 h/16 o/16 h/16 k/16 h/16 o/16 h/16 k+s/16 s/16 s/16 s/16')
    s.part('tek_bass', 'techno_bass', 'base', fx={'pump': {'key': 'tek_kit', 'notes': ['k'], 'depth_db': 6,
                                                           'release_beats': 0.4}}).notes(
        'T', '(r/16 f2/16 f2/16 ab2/16)x4 | (r/16 db2/16 db2/16 f2/16)x4')
    s.part('tek_chime', 'synth_chime', 'base').notes('T', '(f5/16 c6/16 ab5/16 c6/16)x4 | (f5/16 db6/16 ab5/16 db6/16)x4')
    s.part('tek_stab', 'saw_stab', 'intensity').notes('T', 'r/4 r/8 [f4 ab4 c5]/8 r/4 r/8 [f4 ab4 c5]/8 | '
                                                           'r/4 r/8 [f4 ab4 db5]/8 r/4 r/8 [f4 ab4 db5]/8')
    s.part('tek_pad', 'supersaw', 'intensity', fx={'pump': {'key': 'tek_kit', 'notes': ['k'], 'depth_db': 8,
                                                            'release_beats': 0.5}}).notes('T', '[f3 c4 ab4]/1 | [db3 f4 ab4 c5]/1')
    # H — hardtek: driven kick (role fx), rolling saw bass pumped by it, acid line opening over the two bars, 'hey' chops
    s.part('hard_kick', 'kick_hard', 'base').notes('H', 'k/4 k/4 k/4 k/4 | k/4 k/4 k/4 k/16 k/16 k/16 k/16')
    s.part('hard_hats', 'drums_909', 'intensity').notes('H', '(r/8 o/8)x4 | (r/8 o/8)x3 h/16 h/16 h/16 h/16')
    s.part('hard_bass', 'saw_bass', 'base', fx={'pump': {'key': 'hard_kick', 'depth_db': 7, 'release_beats': 0.35}}).notes(
        'H', '(r/16 b1/16 b2/16 b1/16)x4 | (r/16 g1/16 g2/16 g1/16)x2 (r/16 a1/16 a2/16 a1/16)x2')
    s.part('hard_acid', 'acid_bass', 'intensity', octave=1, fx={'filter': {'auto': [['H', 1, 260], ['H', 3, 3200]]}}).notes(
        'H', 'b2/16! b2/16 d3/16 b2/16 f#3/16! b2/16 a2/16 b2/16 c#3/16 b2/16 e3/16! b2/16 d3/16 b2/16 c#3/16 a2/16 | '
             'g2/16! g2/16 b2/16 g2/16 d3/16! g2/16 f#2/16 g2/16 a2/16! a2/16 c#3/16 a2/16 e3/16! a2/16 c#3/16 a2/16')
    s.part('hard_lead', 'saw_lead', 'base').notes('H', 'f#5/8 f#5/16 a5/16 b5/8 a5/8 f#5/8 e5/8 d5/4 | '
                                                       'e5/8 e5/16 f#5/16 g5/8 f#5/8 e5/8 c#5/8 a4/4')
    s.part('hard_hey', 'vox_chop', 'intensity').notes('H', "r/2 f#4/8' r/8 r/4 | r/2 f#4/8' r/8 a4/8' r/8")
    s.part('hard_rise', 'sweep_pad', 'intensity').notes('H', 'r/1 | [b3 f#4 b4]/1')
    # E — Celtic jig in 8th-triplets: bodhran-ish kit, jig pump bass, fiddle tune, whistle answer, mandolin chops
    s.part('jig_kit', 'drums_room', 'base').notes('E', '(k/4 s?/8t s?/8t k/8t s/4 s?/8t s?/8t k/8t |)x2')
    s.part('jig_bass', 'pick_bass', 'base').notes('E', 'a1/8t r/8t a2/8t e2/8t r/8t e2/8t a1/8t r/8t a2/8t c2/8t d2/8t e2/8t | '
                                                       'g1/8t r/8t g2/8t d2/8t r/8t d2/8t g1/8t r/8t g2/8t b1/8t a1/8t g1/8t')
    s.part('jig_fiddle', 'fiddle', 'base').notes('E', '(a4/8t b4/8t c5/8t e5/8t d5/8t c5/8t)x2 | b4/8t g4/8t b4/8t d5/8t b4/8t g4/8t a4/4 r/4')
    s.part('jig_whistle', 'tin_whistle', 'base').notes('E', 'r/1 | r/2 e6/8t d6/8t b5/8t a5/4')
    s.part('jig_mando', 'mandolin', 'intensity').notes('E', '(r/8t [a3 e4 a4]/8t r/8t)x4 | (r/8t [g3 d4 g4]/8t r/8t)x4')
    # S — surf: tom-heavy beat, tremolo-picked lead through a big echo send, combo organ, tenor honk, synth-string bed
    s.part('surf_kit', 'drums', 'base').notes('S', 'k/8 t3/16 t3/16 s/8 t3/8 k/8 k/8 s/8 t3/16 t3/16 | '
                                                   'k/8 t3/16 t3/16 s/8 t3/8 k/8 k/8 s/16 t2/16 t2/16 t3/16')
    s.part('surf_bass', 'pick_bass', 'base').notes('S', 'e2/8 e2/8 e3/8 e2/8 g2/8 e2/8 b2/8 e2/8 | c2/8 c2/8 c3/8 c2/8 b1/8 b1/8 b2/8 b1/8')
    s.part('surf_gtr', 'surf_gtr', 'base').notes('S', '(e5/16)x8 (g5/16)x4 (f#5/16)x4 | (e5/16)x4 (c5/16)x4 (b4/16)x8')
    s.part('surf_organ', 'combo_organ', 'base').notes('S', '[e4 g4 b4]/8 r/8 r/8 [e4 g4 b4]/8 r/4 r/8 [e4 g4 b4]/8 | '
                                                           '[c4 e4 g4]/8 r/8 r/8 [c4 e4 g4]/8 r/4 r/8 [d#4 f#4 b4]/8')
    s.part('surf_honk', 'tenor_sax', 'intensity').notes('S', 'r/2. e3/8 r/8 | r/2. b2/8 r/8')
    s.part('surf_pad', 'synth_strings', 'intensity').notes('S', '[e3 b3 g4]/1 | [c3 g3 e4]/2 [b2 f#3 d#4]/2')
    # W — sweet: brushes + finger snaps + shaker, ukulele strum, bell-piano tune, tinkle / Christmas bell answers
    s.part('sweet_kit', 'drums_brush', 'base').notes('W', 'k/8 sh/16 sh/16 fs/8 sh/16 sh/16 k/8 sh/16 sh/16 fs/8 tri/8 | '
                                                          'k/8 sh/16 sh/16 fs/8 sh/16 sh/16 k/8 sh/16 sh/16 fs/8 sh/16 sh/16')
    s.part('sweet_bass', 'fretless', 'base').notes('W', 'c3/4 e3/8 g3/8 b2/4 g2/4 | f2/4 a2/8 c3/8 g2/4 b2/4')
    s.part('sweet_uke', 'ukulele', 'base').notes('W', '[c4 e4 g4 c5]/8 [c4 e4 g4 c5]/16 [c4 e4 g4 c5]/16 r/8 [c4 e4 g4 b4]/8 '
                                                      '[c4 e4 g4 b4]/4 [c4 e4 g4 b4]/4 | [c4 f4 a4 c5]/8 [c4 f4 a4 c5]/16 '
                                                      '[c4 f4 a4 c5]/16 r/8 [c4 f4 a4]/8 [b3 d4 f4 g4]/4 [b3 d4 f4 g4]/4')
    s.part('sweet_tune', 'bell_piano', 'base').notes('W', 'e5/4 g5/8 c6/8 b5/4 g5/4 | a5/8 g5/8 f5/8 a5/8 g5/2')
    s.part('sweet_tinkle', 'tinkle_bells', 'intensity').notes('W', 'r/2. g6/16 e6/16 c6/8 | r/1')
    s.part('sweet_xmas', 'xmas_bells', 'intensity').notes('W', 'r/1 | r/2. f6/16 d6/16 b5/8')
    return s


songs = [build('lobby'), build('battle'), sting(), victory(), genres()]
