"""'Sentinel March' — campaign map, missions hub, bounty, assault, challenge; stage prep adds the `prep` stem.
ORIGINAL composition (docs/AUDIO.md §4.1 rules, §4.2 SENTINEL CALL, §4.4 track list).

B♭ major, 120 bpm, 4/4. Adventurous overworld march, determined but bouncy. Stems: `base` (the march) and
`prep` (stage prep: snare-march ostinato, oom-pah tuba + trombone afterbeats, timpani — never new harmony).
    intro  2 bars  lydian shimmer B♭ → C/B♭ (pizz + glock), a snare cadence brings the band in
    A      8 bars  the march tune: three SENTINEL CALLs rising F → G → A (on F7sus4, C7sus4, D7sus4), each
                   answered by the band in a "da-da DAH da-da DAH" response (B♭, the lydian C7, Gm), cadence on B♭
    A2     8 bars  the tune again, glock doubling; the cadence turns to A♭7 and slips into …
    Br     8 bars  … the bridge in D♭: the flute sings the Sakura Bell (A♭5–D♭6–B♭5–C6 → D♭6), half-time drums,
                   then the question again, left open; G♭maj7 slides down to F7
    C      8 bars  the tune a last time with a high glock/chip descant; the last bar flashes the lydian C/B♭ and
                   an E♮ pickup that resolves to the F of the next call (loop top)
Form: intro |: A A2 Br C :|  — 2 + 32 bars.

review: originality — new melody built on the project's SENTINEL CALL and BELL motifs. Deliberately avoids the
B♭ overworld idiom of classic adventure games (no ♭VII/♭VI fanfare progression in the march strains; the
colour comes from the lydian II and the rising sus4 calls). Checked against Zelda, Mario, Dragon Quest,
Final Fantasy, Pokémon, EarthBound/Mother, Undertale/Deltarune, Kirby and Blue Archive themes: no shared hook
or contour. Composer A, 2026-10-08.
"""
from sakura_audio.song import Song
from motifs import BELL, SENTINEL
from _home import bars, afterbeats, oompah, crescendo

CH_INTRO = 'Bb | C/Bb'
CH_A = 'F7sus4 | Bb | C7sus4 | C7 | D7sus4 D7 | Gm7 Gm7/F | Ebmaj7 F7 | Bb'
CH_A2 = 'F7sus4 | Bb | C7sus4 | C7 | D7sus4 D7 | Gm7 Gm7/F | Ebmaj7 F7 | Bb Ab7'
CH_BR = 'Dbmaj7 | Bbm9 | Gbmaj7 | Ab7sus4 Ab7 | Dbmaj7 | Fm7 Bbm7 | Gbmaj7 | F7sus4 F7'
CH_C = 'F7sus4 | Bb | C7sus4 | C7 | D7sus4 D7 | Gm7 Gm7/F | Cm7 F7 | Bb C/Bb'

TUNE = [
    'f4/8. bb4/16 eb5/4 d5/8 eb5/4.',        # 1 SENTINEL CALL from F (on F7sus4)
    'd5/8 f5/8 bb5/4 a5/8 f5/8 d5/4',        # 2 response: the sus resolves, up the B♭ chord
    'g4/8. c5/16 f5/4 e5/8 f5/4.',           # 3 the call a step higher, from G (C7sus4)
    'e5/8 g5/8 c6/4 bb5/8 g5/8 e5/4',        # 4 response on the lydian C7 (E♮)
    'a4/8. d5/16 g5/4 f#5/8 g5/4.',          # 5 the call from A (D7sus4 → D7)
    'bb5/8 a5/8 g5/4 d5/8 f5/8 g5/4',        # 6 response falls home to G minor
    'eb5/8 g5/8 bb5/4 c6/8 bb5/8 a5/4',      # 7 E♭maj7 → F7
    'bb5/2. r/4',                            # 8 B♭
]
TUNE_A2_END = ['eb5/8 g5/8 bb5/4 c6/8 bb5/8 a5/4', 'bb5/4 f5/8 d5/8 eb5/4 c5/4']        # → A♭7 → D♭
TUNE_C_END = ['eb5/8 g5/8 c6/4 bb5/8 a5/8 f5/4', 'bb5/4 r/8 g5/8 e5/8 c5/8 g4/8 e4/8']  # E♮ → F (loop top)
FLUTE_BR = [
    'ab5/8 db6/8 bb5/4 c6/4. r/8',           # 1 ⟨BELL⟩ question in D♭
    'db6/2 c6/8 bb5/8 ab5/8 f5/8',           # 2 answered, and flowing on
    'gb5/4. f5/8 eb5/4 db5/4',               # 3 G♭maj7
    'eb5/4 ab5/4 gb5/4. ab5/8',              # 4 A♭7sus4 → A♭7
    'ab5/8 db6/8 bb5/4 c6/4. r/8',           # 5 ⟨BELL⟩ question again …
    'ab5/8 c6/8 eb6/4 db6/8 bb5/8 f5/4',     # 6 … left open
    'gb5/4 bb5/4 db6/4 eb6/4',               # 7 G♭maj7 climbing
    'f6/4. eb6/8 c6/8 a5/8 f5/4',            # 8 F7sus4 → F7, down to the call
]
DESCANT_C = ['eb6/2 f6/2', 'f6/2 d6/2', 'f6/2 g6/2', 'g6/2 e6/2', 'g6/2 a6/2', 'bb6/2 g6/2', 'g6/2 a6/2', 'bb6/2 g6/2']

BASS_A = [
    'f2/4 c3/8 f2/8 r/8 f2/8 g2/8 a2/8',
    'bb2/4 f2/8 bb2/8 r/8 bb1/8 a1/8 b1/8',
    'c2/4 g2/8 c3/8 r/8 c3/8 bb2/8 g2/8',
    'e2/4 g2/8 c3/8 r/8 bb2/8 g2/8 c#2/8',
    'd2/4 a2/8 d3/8 r/8 d3/8 c3/8 a2/8',
    'g2/4 d3/8 bb2/8 f2/4 a2/8 f2/8',
    'eb2/4 bb2/8 eb2/8 f2/4 c3/8 a2/8',
    'bb2/4 f2/8 d2/8 bb1/4 f2/8 e2/8',
]
BASS_A2_END = 'bb2/4 f2/8 d2/8 ab2/4 eb2/8 c2/8'
BASS_BR = ['db2/2 ab2/2', 'bb1/2 f2/2', 'gb2/2 db2/2', 'ab1/2 eb2/2', 'db2/2 ab2/2', 'f2/2 bb1/2', 'gb2/2 db2/2', 'f2/2 c2/4 e2/4']
BASS_C_END = ['c2/4 g2/8 c3/8 f2/4 c3/8 a2/8', 'bb1/4 f2/8 bb2/8 bb1/4 bb2/8 e2/8']

KIT = 'k+h/8 h/8 s+h/8 h/8 k+h/8 k+h/8 s+h/8 h/8 |'
KIT_CRASH = 'k+c/8 h/8 s+h/8 h/8 k+h/8 k+h/8 s+h/8 h/8 |'
KIT_FILL4 = 'k+h/8 h/8 s+h/8 h/8 k+h/8 s/16 s?/16 s/8 t2/8 |'
KIT_FILL8 = 'k+h/8 h/8 s+h/8 s?/16 s?/16 s/16 s s s t1/16 t1 t2 t3 |'
KIT_HALF = 'k+rd/8 rd/8 rd/8 k/8 s+rd/8 rd/8 rd/8 rd/8 |'
SNARE_MARCH = 's!/8 s?/16 s?/16 s/8 s?/8 s/8 s?/16 s?/16 s!/8 s?/8 |'
SNARE_ROLL = 's!/8 s?/16 s?/16 s/8 s?/8 ' + crescendo('s', '16', 8, 50, 112) + ' |'


def build() -> Song:
    s = Song(id='march', title='Sentinel March', bpm=120, meter=(4, 4), key='Bb',
             form=['intro', '|:', 'A', 'A2', 'Br', 'C', ':|'],
             mix={'echo': {'delay_ms': 208, 'feedback': 0.38, 'volume': 0.26, 'fir': 'soft'}},
             description='Campaign map / missions / bounty / assault / challenge (base); stage prep adds the prep stem.')
    s.section('intro', 2, CH_INTRO)
    s.section('A', 8, CH_A)
    s.section('A2', 8, CH_A2)
    s.section('Br', 8, CH_BR)
    s.section('C', 8, CH_C)

    tune_a2 = TUNE[:6] + TUNE_A2_END
    tune_c = TUNE[:6] + TUNE_C_END
    calls = {1: SENTINEL, 3: SENTINEL, 5: SENTINEL}

    # ================================================================ base
    # the tune: trumpet + 12.5 % chip pulse in unison (brass bite + NES edge)
    s.part('tpt', 'trumpet', 'base').notes('A', bars(*TUNE), motifs=calls).notes('A2', bars(*tune_a2), motifs=calls) \
        .notes('C', bars(*tune_c), motifs=calls)
    s.part('chip', 'chip_pulse12', 'base', vel=-20).double('tpt')
    s.part('glock', 'glock', 'base', octave=1, vel=-22).double('tpt', 'A2')
    s.part('flute', 'flute', 'base', vel=-26).notes('Br', bars(*FLUTE_BR), motifs={1: BELL, 5: BELL})
    s.part('flute_glock', 'glock', 'base', octave=1, vel=-24).at('Br', 5, FLUTE_BR[4])
    s.part('descant', 'glock', 'base', vel=2).notes('C', bars(*DESCANT_C))
    s.part('descant_chip', 'chip_pulse25', 'base', vel=-30).double('descant')

    s.part('bass', 'finger_bass', 'base', vel=-24).notes('intro', 'bb1/4 r/4 bb1/4 r/8 f1/8 | bb1/4 r/4 bb1/4 r/8 e2/8') \
        .notes('A', bars(*BASS_A)).notes('A2', bars(*BASS_A[:7], BASS_A2_END)).notes('Br', bars(*BASS_BR)) \
        .notes('C', bars(*BASS_A[:6], *BASS_C_END))
    s.part('pizz', 'pizz', 'base', vel=4).gen('intro', 'arp:updown8', low=58, high=79, vel=74) \
        .gen(['A', 'A2', 'C'], 'arp:updown8', low=55, high=74, vel=62).gen('Br', 'comp:offbeat', low=55, high=72, vel=60)
    s.part('strings', 'strings', 'base').gen(['A2', 'C'], 'pad:sustain', low=55, high=72, vel=50) \
        .gen('Br', 'pad:sustain', low=53, high=72, vel=56)
    s.part('glock_intro', 'glock', 'base', vel=-12).notes('intro', 'd6/8 f6/8 bb6/8 f6/8 d6/8 f6/8 bb6/8 c7/8 | '
                                                                  'e6/8 g6/8 c7/8 g6/8 e6/8 g6/8 c7/8 r/8')
    s.part('kit', 'drums', 'base', vel=-6).notes('intro', 'k/4 r/4 k/4 r/4 | k/4 r/4 ' + crescendo('s', '16', 8, 44, 104)) \
        .pattern('A', KIT, fills={1: KIT_CRASH, 4: KIT_FILL4, 8: KIT_FILL8}) \
        .pattern('A2', KIT, fills={1: KIT_CRASH, 4: KIT_FILL4, 8: KIT_FILL8}) \
        .pattern('Br', KIT_HALF, fills={8: KIT_FILL8}) \
        .pattern('C', KIT, fills={1: KIT_CRASH, 4: KIT_FILL4, 5: KIT_CRASH, 8: KIT_FILL8})
    s.part('tamb', 'drums', 'base', vel=-34).pattern(['A2', 'C'], 'r/8 tb/8 r/8 tb/8 r/8 tb/8 r/8 tb/8 |')

    # ================================================================ prep ("get ready": band in parade order)
    s.part('snare', 'drums_orch', 'prep', vel=-8).pattern(['A', 'A2', 'C'], SNARE_MARCH, fills={8: SNARE_ROLL}) \
        .pattern('Br', 's/8 s?/16 s?/16 s?/8 s?/8 s/8 s?/16 s?/16 s?/8 s?/8 |', fills={8: SNARE_ROLL}) \
        .at('intro', 2, 'r/2 ' + crescendo('s', '16', 8, 40, 100))
    s.part('tuba', 'tuba', 'prep', vel=-6).notes('A', oompah(CH_A, 8)).notes('A2', oompah(CH_A2, 8)) \
        .notes('Br', oompah(CH_BR, 8)).notes('C', oompah(CH_C, 8))
    s.part('bones', 'trombone', 'prep', vel=-30).notes('A', afterbeats(CH_A, 8, 50, 64)).notes('A2', afterbeats(CH_A2, 8, 50, 64)) \
        .notes('C', afterbeats(CH_C, 8, 50, 64))
    s.part('horn', 'horn', 'prep', vel=-32).gen('Br', 'pad:sustain', low=53, high=67, vel=70)
    s.part('timp', 'timpani', 'prep', vel=-4).notes('intro', 'bb2/4 r/2. | bb2/4 r/2 f2/4') \
        .gen(['A', 'A2', 'Br', 'C'], 'bass:root', low=41, high=53, vel=80) \
        .at('Br', 8, 'r/2 ' + crescendo('f2', '16', 8, 40, 100))
    return s


songs = [build()]
