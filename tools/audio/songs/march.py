"""'Sentinel March' — campaign map, missions hub, bounty, assault, challenge, co-op room; stage prep adds the `prep`
stem. ORIGINAL composition (docs/AUDIO.md §4.1 rules, §4.2 SENTINEL CALL; round-3 genre lane: SKA — a 2-tone brass
march with a dub breakdown).

B♭ major, 144 bpm, straight 8ths, 4/4. Stems: `base` (the ska band: kit with the kick push on 2& and a rimshot
crack on 2 and 4, muted-guitar skank + organ bubble on every "and", walking 8th bass, trumpet head with the tenor an
octave under, low-brass blats, combo-organ stabs, xylophone ticks) and `prep` (stage prep, "get ready": field-snare
ostinato, tuba on the beats between the skanks, timpani, horn swells — never new harmony).
    intro  2 bars  drum pickup, skank and bass, a horn hit on F7
    A      8 bars  the head: SENTINEL CALL (F–B♭–E♭–F–E♭) in trumpet + tenor (octaves), chip double, three
                   times rising (F, G, A — the third overshoots to C6); every call gets a 1½-beat reply and then the
                   BAM: trombone + bari-sax blats on 3 and 4&, a combo-organ stab and a xylophone double-tick
    A2     8 bars  dialogue: the horns call, the chip pulse answers each call with a bar of its own; B♭ → A♭7
    Dub    8 bars  dub breakdown in D♭, half-time one-drop: 2 bars of bass solo with the kit alone, the horns answer
                   with an echoing line, then the harmonica sings the Sakura Bell (A♭–D♭–B♭–C → D♭), A♭7 slides
                   down a semitone into …
    C      8 bars  … the head lifted a tone to C major (SENTINEL from G), glock + chip descant above; C7 turns back
                   to B♭ for the loop
Form: intro |: A A2 Dub C :|  — 2 + 32 bars (53 s loop).

Taste rules (r3 study/taste.md): bass walks 8ths with octave pops on 1& and 3& and a chromatic approach into every
bar line; kit + skank + organ bubble + bass hit every offbeat together (4 offbeat tutti pushes a bar); every melody
stop is answered by a low-brass BAM with a high tick; A2 is the 1-bar dialogue, Dub the breakdown + bass feature,
C the lift; fills in bars 4 and 8. Skank, bubble, stabs and the prep horns are voiced against the tune and each
other (`_horns.comp(against=…, also=…)`): no minor 2nds / 9ths with the head, the tenor or the descant.

review: originality — the head (built on the project's SENTINEL CALL), the replies, the chip answers, the dub bass
solo, the descant and all grooves are new; BELL is the project's own motif. Ska / 2-tone / rocksteady standards and
famous ska horn lines (and their basslines) were kept in mind and not used; checked by ear-memory against well-known
ska, reggae and game overworld marches from console, indie and gacha games: no shared
hook or contour. Composer B1, 2026-10-09 (round 3).
"""
from dataclasses import replace

from sakura_audio.song import Song
from motifs import BELL, SENTINEL
from _home import bars, crescendo
from _horns import line, comp, put, grid, notes_of, pad_rhythm

CH_INTRO = 'Bb | F7'
CH_A = 'F7sus4 | Bb | C7sus4 | C7 | D7sus4 | Gm7 Gm7/F | Ebmaj7 F7 | Bb'
CH_A2 = 'F7sus4 | Bb | C7sus4 | C7 | D7sus4 | Gm7 Gm7/F | Ebmaj7 F7 | Bb Ab7'
CH_DUB = 'Dbmaj7 | Dbmaj7 | Gbmaj7 | Ab7sus4 | Dbmaj7 | Bbm9 | Gbmaj7 | Ab7'
CH_C = 'G7sus4 | C | D7sus4 | D7 | E7sus4 | Am7 Am7/G | Fmaj7 G7 | C C7'

# the head: SENTINEL CALL (bar 1 of each cell), a short reply, then the BAM in beats 3-4
HEAD = [
    'f4/8. bb4/16 eb5/4 f5/8 eb5/4.',         # 1 F7sus4   ⟨SENTINEL⟩
    "d5/8 f5/8 r/8 bb5/8' r/2",               # 2 B♭       reply … BAM
    'g4/8. c5/16 f5/4 g5/8 f5/4.',            # 3 C7sus4   ⟨SENTINEL⟩ a step higher
    "e5/8 g5/8 r/8 c6/8' r/2",                # 4 C7       (the lydian E♮) … BAM
    'a4/8. d5/16 g5/4 a5/8 c6/4.',            # 5 D7sus4   ⟨SENTINEL⟩ overshoots to C6
    "bb5/8 a5/8 r/8 g5/8' r/2",               # 6 Gm7 Gm7/F … BAM
    'eb5/8 g5/8 bb5/4 a5/8 c6/8 a5/4',        # 7 E♭maj7 F7
    "bb5/8 f5/8 bb5/4' r/2",                  # 8 B♭       … big BAM + fill
]
HEAD_A2 = [HEAD[0], 'r/1', HEAD[2], 'r/1', HEAD[4], 'r/1', HEAD[6], "bb5/8 f5/8 bb5/4' r/2"]
CHIP_A2 = [                                   # the chip pulse answers every call with a bar of its own
    'r/1', 'd6/8 f6/8 bb6/8 f6/8 d6/16 eb6/16 f6/8 r/4',
    'r/1', 'e6/8 g6/8 c7/8 g6/8 e6/16 f6/16 g6/8 r/4',
    'r/1', 'bb6/8 a6/8 g6/8 d6/8 f6/16 e6/16 d6/8 r/4',
    'r/1', 'r/2 ab6/16 g6/16 f6/16 eb6/16 c6/8 r/8',
]
HEAD_C = [
    'g4/8. c5/16 f5/4 g5/8 f5/4.',            # 1 G7sus4   ⟨SENTINEL⟩ in C (the lift)
    "e5/8 g5/8 r/8 c6/8' r/2",                # 2 C
    'a4/8. d5/16 g5/4 a5/8 g5/4.',            # 3 D7sus4   ⟨SENTINEL⟩
    "f#5/8 a5/8 r/8 d6/8' r/2",               # 4 D7
    'b4/8. e5/16 a5/4 b5/8 d6/4.',            # 5 E7sus4   ⟨SENTINEL⟩ overshoots to D6
    "c6/8 b5/8 r/8 a5/8' r/2",                # 6 Am7 Am7/G
    'f5/8 a5/8 c6/4 b5/8 d6/8 b5/4',          # 7 Fmaj7 G7
    "c6/8 g5/8 c6/4' r/2",                    # 8 C C7     … big BAM, back to B♭
]
DESCANT_C = ['e6/2 f6/4 g6/4', 'g6/2. e6/4', 'f#6/2 g6/4 a6/4', 'a6/2. f#6/4', 'g#6/2 a6/4 b6/4', 'a6/2 c7/4 b6/4',
             'a6/2 b6/4 d7/4', 'e7/2 c7/4 bb6/4']
# Dub: bass solo (bars 1-2), the horns answer (3-4), the harmonica rings the Bell in D♭ (5-8)
DUB_BASS_SOLO = ['db2/4. ab1/8 r/8 db2/8 f2/8 ab2/8', 'c3/8 bb2/8 r/8 ab2/8~ ab2/8 f2/8 eb2/8 f2/8']
DUB_HORNS = ['r/1', 'r/1', 'r/8 bb4/8 db5/8 f5/8~ f5/4 eb5/4', "db5/4. eb5/8 r/8 ab4/8' r/4", 'r/1', 'r/1', 'r/1', 'r/1']
DUB_HARP = ['r/1', 'r/1', 'r/1', 'r/1', 'ab4/4 db5/4 bb4/2', 'c5/2. r/4', 'db5/2 f5/4 ab5/4', 'gb5/4 f5/8 eb5/8~ eb5/4 r/4']

# ---- grooves
WALK8 = ['R/8 8/8 5/8 3/8 R/8 8/8 7/8 ap/8', 'R/8 8/8 3/8 5/8 6/8 8/8 5/8 ap/8', 'R/8 8/8 5/8 8/8 R/8 8/8 b3/8 ap/8',
         'R/8 8/8 2/8 3/8 5/8 8/8 6/8 ap/8']
WALK8_H = ['R/8 8/8 5/8 3/8', 'R/8 8/8 5/8 ap/8']
TUBA = ['R/4 5/4 R/4 5/4']
TUBA_H = ['R/4 5/4']
KIT = 'k+h/8 o/8 s+rs+h/8 k+o/8 k+h/8 o/8 s+rs+h/8 o/8 |'                 # 2-tone: rimshot crack on 2 and 4
KIT_C = 'k+c/8 o/8 s+rs+h/8 k+o/8 k+h/8 o/8 s+rs+h/8 o/8 |'
KIT_F4 = 'k+h/8 o/8 s+rs+h/8 k+o/8 k+h/8 s/16 s?/16 s/8 t2/8 |'
KIT_F8 = 'k+h/8 o/8 s+rs+h/8 s?/16 s/16 s/16 s s s t1/16 t1 t2 t3 |'
KIT_BAM = 'k+h/8 o/8 s+rs+h/8 k+o/8 k+h/8 o/8 s+rs+h/8 k+o/8 |'          # bars with a BAM: the kick kicks 4& with the blat
ONEDROP = 'h/8 h/8 h/8 h/8 k+rs/8 h/8 h/8 h/8 |'
ONEDROP_F = 'h/8 h/8 h/8 h/8 k+rs/8 s/16 s?/16 s/16 s t1/16 t3 |'
SNARE_MARCH = 's!/8 s?/16 s?/16 s/8 s?/8 s/8 s?/16 s?/16 s!/8 s?/8 |'
SNARE_ROLL = 's!/8 s?/16 s?/16 s/8 s?/8 ' + crescendo('s', '16', 8, 50, 112) + ' |'

SKANK = [[(0.5, 0.25, 0), (1.5, 0.25, 4), (2.5, 0.25, 0), (3.5, 0.25, 4)]]
BUBBLE = [[(0.5, 0.25, -2), (1.5, 0.25, 2), (2.5, 0.25, -2), (3.5, 0.25, 2)]]
SKANK_DUB = [[(1, 0.3, 0), (3, 0.3, 4)]]

# BAM = blat on 3 and 4& (bone + bari a 5th/octave apart), combo-organ stab with it, xylophone double-tick on 4
BAM_RH = {2: [(2, 0.5, 6), (3.5, 0.5, 10)], 4: [(2, 0.5, 6), (3.5, 0.5, 10)], 6: [(2, 0.5, 6), (3.5, 0.5, 10)],
          8: [(2, 0.5, 8), (2.5, 0.5, 0), (3.5, 0.5, 12)]}


def build() -> Song:
    s = Song(id='march', title='Sentinel March', bpm=144, meter=(4, 4), key='Bb',
             form=['intro', '|:', 'A', 'A2', 'Dub', 'C', ':|'],
             mix={'echo': {'delay_ms': 208, 'feedback': 0.40, 'volume': 0.28, 'fir': 'soft'}},
             description='Campaign map / missions / bounty / assault / challenge / co-op (base); stage prep adds the '
                         'prep stem. Ska: SENTINEL horn head, skank + organ bubble, dub breakdown, lift to C.',
             extra={'lane': 'ska',
                    'busy': {'melody': {'tpt': None, 'tenor': None, 'chip': None, 'harp': None},
                             'bass': ['bass', 'tuba'], 'primary_bass': 'bass',
                             'cat': {'bone': 'answer', 'bari': 'answer', 'stab': 'stab', 'xylo': 'answer',
                                     'chip_ans': 'counter', 'descant': 'counter', 'descant_chip': 'counter',
                                     'stab_A': 'stab', 'stab_A2': 'stab', 'stab_C': 'stab', 'stab_Dub': 'stab',
                                     'skank': 'comp', 'bubble': 'comp', 'horn': 'pad', 'timp': 'perc'}}})
    s.section('intro', 2, CH_INTRO)
    s.section('A', 8, CH_A)
    s.section('A2', 8, CH_A2)
    s.section('Dub', 8, CH_DUB)
    s.section('C', 8, CH_C)
    calls = {1: SENTINEL, 3: SENTINEL, 5: SENTINEL}
    # what the chords must keep clear of (melody: stay under + no minor 2nds / 9ths; others: no rubs)
    MEL = {'A': notes_of(bars(*HEAD)), 'A2': notes_of(bars(*HEAD_A2)), 'C': notes_of(bars(*HEAD_C)),
           'Dub': notes_of(bars(*DUB_HARP))}
    lo = lambda ns: [replace(n, pitches=tuple(p - 12 for p in n.pitches)) for n in ns]     # the tenor, an octave down
    OTH = {'A': [lo(MEL['A'])], 'A2': [lo(MEL['A2']), notes_of(bars(*CHIP_A2))],
           'C': [lo(MEL['C']), notes_of(bars(*DESCANT_C))],
           'Dub': [notes_of(bars(*DUB_HORNS)), lo(notes_of(bars(*DUB_HORNS)))]}

    # ================================================================ base
    tpt = s.part('tpt', 'trumpet', 'base', vel=4, gain=1)
    tpt.notes('intro', "r/1 | r/2 r/8 [f4]/8! r/8 f4/8!").notes('A', bars(*HEAD), motifs=calls) \
        .notes('A2', bars(*HEAD_A2), motifs=calls).notes('Dub', bars(*DUB_HORNS)).notes('C', bars(*HEAD_C), motifs=calls)
    s.part('tenor', 'tenor_sax', 'base', octave=-1, vel=0, gain=-1).double('tpt')      # ska horns: tenor an octave under
    s.part('chip', 'chip_pulse12', 'base', vel=-18, gain=-4).double('tpt', ['A', 'C'])
    s.part('chip_ans', 'chip_pulse12', 'base', vel=-10).notes('A2', bars(*CHIP_A2))
    s.part('harp', 'harmonica', 'base', vel=-4, gain=3).notes('Dub', bars(*DUB_HARP), motifs={5: BELL})
    s.part('descant', 'glock', 'base', vel=0, gain=6).notes('C', bars(*DESCANT_C))
    s.part('descant_chip', 'chip_pulse25', 'base', vel=-34, gain=-2).double('descant')

    # the skank (stab bed on every 'and'): muted guitar + organ bubble
    skank = s.part('skank', 'muted_gtr', 'base', vel=-4)
    bubble = s.part('bubble', 'organ', 'base', vel=-10, gain=2)
    put(skank, 'intro', comp(CH_INTRO, SKANK, low=55, high=67, style='close', vel=88, nxt='F7sus4'))
    put(bubble, 'intro', comp(CH_INTRO, BUBBLE, low=60, high=72, style='close', vel=80, nxt='F7sus4'))
    for sec, ch, nx in (('A', CH_A, 'F7sus4'), ('A2', CH_A2, 'Dbmaj7'), ('C', CH_C, 'F7sus4')):
        put(skank, sec, comp(ch, SKANK, low=55, high=67, style='close', vel=88, nxt=nx, against=MEL[sec], also=OTH[sec]))
        put(bubble, sec, comp(ch, BUBBLE, low=60, high=72, style='close', vel=80, nxt=nx, against=MEL[sec], also=OTH[sec]))
    put(skank, 'Dub', comp(CH_DUB, SKANK_DUB, low=55, high=67, style='close', vel=84, skip=(1, 2), against=MEL['Dub'],
                           also=OTH['Dub']))
    put(bubble, 'Dub', comp(CH_DUB, [[(1.5, 0.25, -6), (3.5, 0.25, -2)]], low=60, high=72, style='close', vel=72,
                            skip=(1, 2), against=MEL['Dub'], also=OTH['Dub']))

    # the BAM: low-brass blats + combo-organ stab + xylophone tick in every melody stop
    bone = s.part('bone', 'trombone', 'base', vel=4)
    bari = s.part('bari', 'bari_sax', 'base', vel=4)
    for sec, ch, nx, bb in (('A', CH_A, 'F7sus4', (2, 4, 6, 8)), ('A2', CH_A2, 'Dbmaj7', (8,)), ('C', CH_C, 'F7sus4', (2, 4, 6, 8))):
        bone.notes(sec, _bam(ch, bb, low=46, nxt=nx))
        bari.notes(sec, _bam(ch, bb, low=34, nxt=nx))
        put(s.part(f'stab_{sec}', 'combo_organ', 'base', vel=-2), sec,
            comp(ch, {b: BAM_RH[b] for b in bb} | {0: []}, low=58, high=70, style='close', vel=92, against=MEL[sec],
                 also=OTH[sec] + [skank.bodies[sec], bubble.bodies[sec]]))
    # dub chord throws (combo organ through the echo) in the harmonica's long notes
    put(s.part('stab_Dub', 'combo_organ', 'base', vel=-8), 'Dub',
        comp(CH_DUB, {3: [(2.5, 0.5, 0)], 4: [(2, 0.5, 0), (3.5, 0.5, 4)], 5: [(3, 0.5, 0)], 6: [(1.5, 0.5, 0), (3.5, 0.5, 4)],
                      7: [(3, 0.5, 0)], 8: [(2, 0.5, 4), (3.5, 0.5, 8)], 0: []}, low=58, high=70, style='close', vel=88,
             against=MEL['Dub'], also=OTH['Dub'] + [skank.bodies['Dub'], bubble.bodies['Dub']]))
    s.part('xylo', 'xylophone', 'base', vel=-6) \
        .at('A', 2, "r/2 r/4 f6/16' f6/16' bb6/8'").at('C', 2, "r/2 r/4 g6/16' g6/16' c7/8'") \
        .at('A', 4, "r/2 r/4 g6/16' g6/16' c7/8'").at('C', 4, "r/2 r/4 a6/16' a6/16' d7/8'") \
        .at('A', 6, "r/2 r/4 d6/16' d6/16' g6/8'").at('C', 6, "r/2 r/4 e6/16' e6/16' a6/8'") \
        .at(['A', 'A2'], 8, "r/2 r/4 f6/16' f6/16' bb6/8'").at('C', 8, "r/2 r/4 g6/16' g6/16' c7/8'") \
        .at('Dub', 2, "r/2. r/8 ab6/8'").at('Dub', 4, "r/2. eb6/16' eb6/16' ab6/8'")

    # rhythm section
    bass = s.part('bass', 'finger_bass', 'base', vel=2, gain=-2.5)
    bass.notes('intro', line(CH_INTRO, WALK8[:1], WALK8_H, low=34, nxt='F7sus4')) \
        .notes('A', line(CH_A, WALK8, WALK8_H, low=34, nxt='F7sus4')) \
        .notes('A2', line(CH_A2, WALK8[1:] + WALK8[:1], WALK8_H, low=34, nxt='Dbmaj7')) \
        .notes('Dub', bars(*DUB_BASS_SOLO) + ' | ' + ' | '.join(
            line(CH_DUB, 'R/4. 5/8 r/8 8/8 7/8 ap/8', 'R/4. 5/8', low=34, nxt='G7sus4').split(' | ')[2:])) \
        .notes('C', line(CH_C, WALK8, WALK8_H, low=34, nxt='F7sus4'))
    kit = s.part('kit', 'drums', 'base', vel=-4)
    kit.notes('intro', 'k/4 s/8 k/8 k/4 s/16 s s s | k+c/8 o/8 s+h/8 k+o/8 ' + crescendo('s', '16', 8, 50, 110)) \
        .pattern('A', KIT, fills={1: KIT_C, 2: KIT_BAM, 4: KIT_F4, 5: KIT_C, 6: KIT_BAM, 8: KIT_F8}) \
        .pattern('A2', KIT, fills={1: KIT_C, 4: KIT_F4, 5: KIT_C, 8: KIT_F8}) \
        .pattern('Dub', ONEDROP, fills={2: ONEDROP_F, 5: 'c/8 h/8 h/8 h/8 k+rs/8 h/8 h/8 h/8 |', 8: KIT_F8}) \
        .pattern('C', KIT, fills={1: KIT_C, 2: KIT_BAM, 4: KIT_F4, 5: KIT_C, 6: KIT_BAM, 8: KIT_F8})
    s.part('tamb', 'drums', 'base', vel=-30).pattern(['A2', 'C'], '(r/16 tb/16 tb?/16 tb/16)x4 |')

    # ================================================================ prep ("get ready": the band in parade order)
    s.part('snare', 'drums_orch', 'prep', vel=-10).pattern(['A', 'A2', 'C'], SNARE_MARCH, fills={8: SNARE_ROLL}) \
        .pattern('Dub', 's/8 s?/16 s?/16 s?/8 s?/8 s/8 s?/16 s?/16 s?/8 s?/8 |', fills={8: SNARE_ROLL}) \
        .at('intro', 2, 'r/2 ' + crescendo('s', '16', 8, 40, 100))
    tuba = s.part('tuba', 'tuba', 'prep', vel=-6)
    for sec, ch, nx in (('A', CH_A, 'F7sus4'), ('A2', CH_A2, 'Dbmaj7'), ('C', CH_C, 'F7sus4')):
        tuba.notes(sec, line(ch, TUBA, TUBA_H, low=34, nxt=nx))
    tuba.notes('Dub', ' | '.join(['r/1', 'r/1'] + line(CH_DUB, 'R/2 5/2', 'R/2', low=34, nxt='G7sus4').split(' | ')[2:]))
    horn = s.part('horn', 'horn', 'prep', vel=-28)
    for sec, ch in (('A2', CH_A2), ('Dub', CH_DUB), ('C', CH_C)):
        rh = pad_rhythm(ch) | ({1: [], 2: []} if sec == 'Dub' else {})        # Dub 1-2: the bass solo stays alone
        put(horn, sec, comp(ch, rh, low=53, high=67, style='rootless', vel=70, gate=1.0, against=MEL[sec],
                            also=OTH[sec] + [p.bodies.get(sec, []) for p in s.parts.values()
                                             if p.name in ('skank', 'bubble', f'stab_{sec}')]))
    s.part('timp', 'timpani', 'prep', vel=-4).notes('intro', 'bb2/4 r/2. | f2/4 r/2 f2/4') \
        .gen(['A', 'A2', 'C'], 'bass:root', low=41, high=53, vel=80) \
        .gen('Dub', 'bass:root', low=41, high=53, vel=80, bars=(3, 8)) \
        .at('Dub', 8, 'r/2 ' + crescendo('ab2', '16', 8, 40, 100)) \
        .at('C', 8, 'r/2 ' + crescendo('c3', '16', 8, 40, 100))
    return s


def _bam(chords, bam_bars, low, nxt):
    """Blat line for one horn: degree 5 on beat 3 and the root (octave up) on 4& of each BAM bar; in two-chord bars
    the blat takes the second chord."""
    pats = {b: ('r/2 5!/8 r/4 8!/8' if b in bam_bars else 'r/1') for b in range(1, 9)}
    halves = []
    g = grid(chords)
    hp = {}
    for b, row in enumerate(g, start=1):
        if len(row) == 2:
            hp[b] = ('r/2', '5!/8 r/4 8!/8' if b in bam_bars else 'r/2')
    # line() cycles `halves` by half-bar index: build that list in order
    for b, row in enumerate(g, start=1):
        if len(row) == 2:
            halves += list(hp[b])
    return line(chords, pats, halves or None, low=low, nxt=nxt)


songs = [build()]
