"""'Homeroom' — the lobby, and (melody stem off) 'Study Hall' for every menu. ORIGINAL composition
(docs/AUDIO.md §4.1 rules; §4.4 track list: the cosy variation of the main theme).

F major, 96 bpm swing, lo-fi after-school jazz. Stems: `base` (complete music on its own = Study Hall) and
`melody` (the tune on top = Homeroom). The menus fade the melody stem out without restarting.
    intro  2 bars  the music box rings the Sakura Bell (question over B♭maj9 → answer over C13sus4)
    H      8 bars  Homeroom's own hook (round 2: the most-heard track needed its own tune): a bouncy "E-G-A … C-A-G"
                   cell with a breath in the middle, answered by a chromatic sigh over D7♭9 (F♯ → E♭ → D); the cell
                   comes back a tone up over Gm9, then climbs to E♭6 and turns to F13 for the bridge. Vibes, with
                   the ocarina joining for bars 5-8; the e-piano rings the Bell in the gaps (base stem)
    Br     8 bars  bridge in B♭: an after-school tune (vibes) in 2-bar calls, the e-piano answers each call with
                   the Sakura Bell (so Study Hall keeps the motif too)
    A      8 bars  main theme bars 1-8, once per loop, laid back an eighth and re-harmonised (Fmaj9, Dm11, B♭maj9,
                   C13sus4 …) on music box + vibes, with a chip-triangle counter-line falling in pairs; back to H
Form: intro |: H Br A :|  — 2 + 24 bars (60 s loop; round 1 had the theme twice in a 32-bar loop).

review: originality — main theme (§4.3) and BELL motif are the project's own; the bridge melody, counter-lines,
re-harmonisation and grooves are new. Checked against well-known cosy game/anime pieces (Animal Crossing,
EarthBound/Mother town themes, Undertale/Deltarune shop and town themes, Persona, Blue Archive lobby themes,
Lo-fi standards): no shared hook or contour. Composer A, 2026-10-08.
"""
from sakura_audio.song import Song
from motifs import BELL
from _home import bars

CH_INTRO = 'Bbmaj9 | C13sus4'
CH_H = 'Fmaj9 | D7b9 | Gm9 | C13 C7b9 | Am7 | D7b9 | Bbmaj9 Bbm6 | Cm9 F13'
CH_A = 'Fmaj9 | Dm11 | Bbmaj9 | C13sus4 C7b9 | Am9 | D7b9 | Gm9 Bbm6 | Fmaj7/C C13'
CH_BR = 'Bbmaj9 | Gm9 | Cm9 | F13 | Dm7 G7b9 | Cm9 | Ebmaj7 Ebm6 | C7sus4 C7'

# main theme bars 1-8 (§4.3), laid back by an eighth with a few anticipations — the contour is untouched
THEME_COSY = [
    'r/8 c5/8 f5/8 d5/4 e5/4.',              # ⟨BELL⟩
    'f5/8 a5/4 g5/8 f5/8 e5/8 d5/4',
    'r/8 c5/8 f5/8 d5/4 e5/8 f5/8 g5/8',     # ⟨BELL⟩
    'a5/4 g5/8 c5/8~ c5/2',
    'r/8 c5/8 f5/8 d5/4 e5/8 c6/4',          # ⟨BELL⟩
    'a5/8 bb5/8 a5/8 f#5/8 eb5/8 d5/4.',
    'g5/8 bb5/8 a5/8 g5/8 f5/8 db5/4.',      # the chromatic minor iv
    'c5/4 r/8 d5/8 e5/8 g5/4.',
]
HOOK = [                                     # Homeroom's own tune (new in round 2)
    'e5/8 g5/8 a5/4 r/8 c6/8 a5/8 g5/8',     # 1 Fmaj9    the cell: up to A, a breath, C-A-G
    'f#5/4. eb5/8~ eb5/4 d5/4',              # 2 D7♭9     the sigh: F♯ → E♭ (♭9) → D
    'f5/8 a5/8 bb5/4 r/8 d6/8 bb5/8 a5/8',   # 3 Gm9      the cell a tone up
    'a5/4. g5/8~ g5/4 r/8 e5/8',             # 4 C13 C7♭9
    'e5/8 g5/8 a5/4 r/8 c6/8 a5/8 g5/8',     # 5 Am7      the cell again …
    'f#5/4 a5/8 c6/8~ c6/4 eb6/4',           # 6 D7♭9     … but it climbs this time, to the ♭9 on top
    'd6/4. c6/8 db6/4 bb5/8 g5/8',           # 7 B♭maj9 B♭m6 (the chromatic minor iv)
    'c6/4 r/8 eb5/8~ eb5/8 f5/8 g5/8 a5/8',  # 8 Cm9 F13   walks up into the B♭ bridge
]
# Study Hall keeps a voice of the hook: the e-piano rings the Bell in the hook's bar-4 and bar-8 gaps
EP_H = ['r/1', 'r/1', 'r/1', 'r/2 c5/16 f5/16 d5/8 e5/8. r/16', 'r/1', 'r/1', 'r/1', 'r/1']
BRIDGE = [                                   # new after-school tune: 2-bar calls, each answered by the e-piano bell
    'r/8 d5/8 f5/8 a5/8~ a5/4 g5/8 f5/8',
    'g5/4 d5/8 f5/8~ f5/2',
    'r/8 eb5/8 g5/8 bb5/8~ bb5/4 a5/8 g5/8',
    'a5/4 f5/8 g5/8~ g5/2',
    'f5/8 a5/8 c6/8 d6/8~ d6/4 c6/8 b5/8',
    'bb5/4 g5/8 eb5/8~ eb5/2',
    'g5/8 bb5/8 d6/8 c6/8~ c6/4 gb5/8 f5/8',
    'f5/4. g5/8 e5/4 bb5/4',
]
# A counter-line on the chip triangle: guide tones falling in pairs (3rd → 9th, 7th → 9th …)
COUNTER_A = ['a4/2. g4/4', 'f4/2. e4/4', 'd4/2. c4/4', 'bb3/2 db4/2',
             'c4/2. b3/4', 'c4/2 eb4/2', 'd4/2 bb3/2', 'a3/2 bb3/2']
# Study Hall keeps the motif: e-piano answers the bridge calls with the Sakura Bell (diminished rhythm)
EP_ANSWERS = ['r/1', 'r/2 f4/16 bb4/16 g4/8 a4/8. r/16', 'r/1', 'r/2 c5/16 f5/16 d5/8 eb5/8. r/16',
              'r/1', 'r/2 bb5/16 eb6/16 c6/8 d6/8. r/16', 'r/1', 'r/1']

BRUSH = 'k+rd?/4 rd+ph/8 rd?/8 k+rd?/4 rd+ph+s/8 rd?/8 |'
BRUSH_FILL = 'k+rd?/4 rd+ph/8 rd?/8 s?/8 s/8 s?/8 s/8 |'
BRUSH_UP = 'k+rd?/4 rd+ph/8 rd?/8 k+rd?/8 k?/8 rd+ph+s/8 rd?/8 |'


def build() -> Song:
    s = Song(id='homeroom', title='Homeroom', bpm=96, meter=(4, 4), key='F', swing=0.62,
             form=['intro', '|:', 'H', 'Br', 'A', ':|'],
             mix={'echo': {'delay_ms': 240, 'feedback': 0.38, 'volume': 0.26, 'fir': 'soft'}},
             description='Lobby (base + melody) and every menu ("Study Hall": base only). Cosy swing version of the main theme.')
    s.section('intro', 2, CH_INTRO)
    s.section('H', 8, CH_H)
    s.section('Br', 8, CH_BR)
    s.section('A', 8, CH_A)

    # ================================================================ base (Study Hall on its own)
    s.part('box', 'music_box', 'base', vel=6).notes('intro', bars(
        BELL.question('F', 6) + ' r/8', BELL.answer('F', 6) + ' r/2'), motifs={1: BELL})
    s.part('ep', 'epiano', 'base').gen('intro', 'pad:sustain', voicing='rootless', low=55, high=72, vel=62) \
        .gen('H', 'comp:charleston', voicing='rootless', low=53, high=70, vel=68) \
        .gen('Br', 'comp:bossa', voicing='rootless', low=53, high=70, vel=64) \
        .gen('A', 'comp:charleston', voicing='rootless', low=53, high=70, vel=70)
    s.part('ep_bell', 'epiano', 'base', vel=-4).notes('H', bars(*EP_H), motifs={4: BELL}) \
        .notes('Br', bars(*EP_ANSWERS), motifs={2: BELL, 4: BELL, 6: BELL})
    s.part('bass', 'finger_bass', 'base', vel=-28).notes('intro', 'bb1/2. r/4 | c2/2. e2/4') \
        .gen(['H', 'Br'], 'bass:walking').gen('A', 'bass:root5')
    s.part('marimba', 'marimba', 'base', vel=-6).gen('H', 'arp:updown8', bars=(5, 8), low=60, high=79, vel=54) \
        .at('A', 8, 'r/2 c5/8 e5/8 g5/8 bb5/8').at('Br', 8, 'r/2 e5/8 g5/8 bb5/8 c6/8')
    s.part('pad', 'pad_warm', 'base').gen(['H', 'Br', 'A'], 'pad:sustain', low=55, high=71, vel=54)
    s.part('brush', 'drums_brush', 'base', vel=12).at('intro', 2, 'r/2 s?/8 s?/8 s?/8 s/8') \
        .pattern('H', BRUSH, fills={4: BRUSH_UP, 8: BRUSH_FILL}) \
        .pattern('Br', BRUSH_UP, fills={8: BRUSH_FILL}) \
        .pattern('A', BRUSH, fills={4: BRUSH_UP, 8: BRUSH_FILL})

    # ================================================================ melody (the tune)
    s.part('vibes', 'vibes', 'melody', vel=-8).notes('H', bars(*HOOK)).notes('Br', bars(*BRIDGE)) \
        .notes('A', bars(*THEME_COSY), motifs={1: BELL, 3: BELL, 5: BELL})
    s.part('ocarina', 'ocarina', 'melody', vel=-26).at('H', 5, bars(*HOOK[4:]))
    s.part('mbox', 'music_box', 'melody', octave=1, vel=-12).double('vibes', 'A')
    s.part('tri', 'chip_triangle', 'melody', vel=-52).notes('A', bars(*COUNTER_A))
    return s


songs = [build()]
