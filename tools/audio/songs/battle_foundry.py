"""'Neon Conveyor' — battle family 6 (foundry + night maps: Ch 6 Clockwork Foundry, Workshop Yard, Colossus Forge,
Rune Garden, Lych Crypt) and its wave sting. ORIGINAL composition (docs/AUDIO.md §4.1 rules), batch B2, audio r3.

Lane: TECHNO. 130 bpm straight, F minor (aeolian, with the ♭2 G♭ in the bass), four-on-the-floor 909, a 16th
sequencer bass that rolls between the kicks and pumps against them, a filter that opens over the first section, a
kick-drop breakdown with a filtered riser and a drop that lifts a whole tone to G minor.
Stems: base (build phase) + intensity (wave active).
    intro  2 bars  kick, rolling bass and the conveyor arp spin up; 909 snare roll into A
    A      8 bars  the hook on square lead + chip pulse (2-bar cells: a 16th double-tick, a leap, a falling 16th
                   tail, then a held note); saw-stab bed on 1, 2&, 4& with a low-pass opening 700 Hz → 6.5 kHz over the
                   8 bars; a chip-bell double-tick answers in every hook hole
    B      8 bars  dialogue: the lead calls one bar, the synth chime answers the next (its conveyor 16ths turn into
                   melody), ending on the true BELL question C–F–D♭–E over C7♭9, answered by A's downbeat
    BR     8 bars  breakdown: the kick drops out, a beat-pumped supersaw pad, the music box rings BELL at half speed
                   and leaves it hanging (twice), the conveyor goes behind a closed filter and opens again; 909 snare
                   roll 16ths → 32nds + sweep pad + reverse cymbal into the drop
    D      8 bars  the drop, a tone up in G minor: 2 bars of acid-bass solo (filter sweep + 303 accents) over kit and
                   stabs, the lead answers with BELL in G minor — answered on G this time — then the hook in G minor;
                   E♭6 → C7 drops back into F minor
Form: intro |: A B BR D :|  — 2 + 32 bars (59.1 s loop).

Bass (the star): `techno_bass` 16ths on e-&-a (the kick has every downbeat to itself), octave pops, ♭7 dips, the ♭2 G♭
on the tonic and a semitone approach into every bar line; pumped by the kick. Stab bed: `saw_stab` 1 / 2& / 4&
(BAM accents on 3& and 4& under every held hook note). Machine ostinato: 808 rim + cowbell on a 3-3-2 grid.
Intensity: brass stabs doubling the saw stabs, a synth-brass counter-line (A) and SENTINEL rally (D), a chip-saw 3-3-2
'gear' counter (B, D), a chip-triangle bass double (phones), ride, clap rolls, chip-noise 16ths, orchestra hits, acid squelch.

Leitmotifs: BELL is the conveyor itself (5-1-♭6-♭7 every beat, the true 5-1-♭6-7 on every dominant), the B-section
question, the BR half-speed question (unanswered) and the D answer in G minor; SENTINEL CALL in the synth brass (D)
and in the hook's opening gesture (two 16ths, then a fourth up).
review: originality — hook, calls/replies, bass sequences, acid line and counter-lines are new; checked by ear-memory
against well-known techno/trance riffs (Sandstorm, Children, Energy Flash, Spastik, Strings of Life, Café del Mar)
and game factory/cyber stages (Mega Man, Sonic Metropolis/Chemical Plant, Deltarune Cyber World/Queen,
Undertale CORE): no shared hook, riff or bass line. `studio.py originality` clean. Composer B2, 2026-10-09.
"""
from sakura_audio.song import Song
from motifs import BELL, SENTINEL
from _battle_kit import roll
from _tek import bars, rest, line, hits, conveyor, hold

F, G = 5, 7                                     # tonic pitch classes (F minor, G minor)

CH_INTRO = 'Fm9 | Fm9 C7'
CH_A = 'Fm9 | Dbmaj7 | Eb6 | Cm7 Db6 | Fm9 | Dbmaj7 | Eb6 Eb/G | C7sus4 C7'
CH_B = 'Dbmaj9 | Eb6 | Cm7 | Fm9 Eb/G | Dbmaj9 | Eb6 | Gbmaj7 | C7b9'
CH_BR = 'Fm9 Dbmaj7 | C7 | Bbm9 | Gbmaj7 | Fm9 Dbmaj7 | C7 | Ebmaj7 | D7sus4 D7'
CH_D = 'Gm9 | Gm9 | Cm9 D7 | Gm9 | Gm9 | Ebmaj7 | F6 F/A | Eb6 C7'
DOMS = ('C7', 'C7b9', 'D7')

HOOK = [
    'c5/16 c5/16 f5/8 r/16 ab5/16 g5/16 f5/16 c6/8. bb5/16 ab5/8 g5/8',      # 1 Fm9      tick-tick, up a fourth
    'ab5/8 f5/8 r/16 eb5/16 f5/8~ f5/2',                                     # 2 D♭maj7   … held: the stabs answer
    'c5/16 c5/16 f5/8 r/16 ab5/16 g5/16 f5/16 eb6/8. db6/16 c6/8 bb5/8',     # 3 E♭6
    'c6/8 bb5/8 r/16 g5/16 ab5/8~ ab5/2',                                    # 4 Cm7 D♭6
]
HOOK_END = [
    'ab5/8 f5/8 r/16 eb5/16 db5/8~ db5/2',                                   # 6 D♭maj7
    'bb5/16 bb5/16 eb6/8 r/16 g6/16 f6/16 eb6/16 db6/8. c6/16 bb5/8 g5/8',   # 7 E♭6 E♭/G
    'ab5/8 g5/8 r/16 f5/16 e5/8~ e5/2',                                      # 8 C7sus4 C7  (the leading tone hangs)
]
B_CALL = {
    1: 'f5/8. ab5/16 r/8 c6/8 eb6/8 c6/16 ab5/16 r/8 f5/8',                  # D♭maj9
    3: 'g5/8. bb5/16 r/8 eb6/8 g6/8 f6/16 eb6/16 r/8 c6/8',                  # Cm7
    5: 'f5/8. ab5/16 r/8 c6/8 f6/8 eb6/16 c6/16 r/8 ab5/8',                  # D♭maj9
    7: 'bb5/8. db6/16 r/8 f6/8 ab6/8 gb6/16 f6/16 r/8 db6/8',                # G♭maj7
}
B_REPLY = {   # the conveyor chime answers in melody (16ths, an octave up)
    2: 'r/16 bb6/16 g6/16 eb6/16 c7/16 bb6/16 g6/16 eb6/16 f6/8 g6/16 bb6/16 r/4',
    4: 'r/16 c7/16 ab6/16 f6/16 eb7/16 c7/16 ab6/16 f6/16 g6/8 bb6/16 eb7/16 r/4',
    6: 'r/16 bb6/16 g6/16 eb6/16 c7/16 bb6/16 g6/16 eb6/16 db7/8 c7/16 bb6/16 r/4',
    8: 'c6/16 f6/16 db6/16 e6/16 c6/16 f6/16 db6/16 e6/16 c7/8 r/8 r/4',    # C7♭9: the true BELL question
}
D_LEAD = [
    'r/1', 'r/1',                                                            # 1-2 the acid bass solos
    BELL.question('Gm', 6) + ' r/8',                                         # 3 Cm9 D7   d6 g6 e♭6 f♯6 …
    BELL.answer('Gm', 6) + ' r/2',                                           # 4 Gm9      … answered: g6
    'd5/16 d5/16 g5/8 r/16 bb5/16 a5/16 g5/16 d6/8. c6/16 bb5/8 a5/8',       # 5 Gm9      the hook, a tone up
    'bb5/8 g5/8 r/16 f5/16 g5/8~ g5/2',                                      # 6 E♭maj7
    'c6/16 c6/16 f6/8 r/16 a6/16 g6/16 f6/16 eb6/8. d6/16 c6/8 a5/8',        # 7 F6 F/A
    'g5/8 f5/8 r/16 eb5/16 e5/8~ e5/2',                                      # 8 E♭6 C7   E♮ pulls back to F minor
]
ACID_SOLO = (   # D 1-2, G minor/phrygian, 303 accents ('!') open the filter for a moment
    "g2/16! g2/16 g3/16 g2/16 bb2/16 g2/16 ab2/16! g2/16 d3/16 g2/16 f3/16! g2/16 db3/16 c3/16 bb2/16! g2/16 | "
    "g2/16! g2/16 g3/16 g2/16 eb3/16 d3/16 g2/16! bb2/16 c3/16 db3/16 d3/16! g3/16 f3/16 d3/16 c3/16! a2/16")
ACID_HI = (     # D 5-8 (intensity): the squelch keeps talking under the hook, an octave up, sparser
    "r/8 g3/16! g3/16 r/8 bb3/16 g3/16 r/8 d4/16! c4/16 r/8 bb3/16 a3/16 | "
    "r/8 g3/16! g3/16 r/8 bb3/16 eb4/16 r/8 d4/16! bb3/16 r/8 g3/16 f3/16 | "
    "r/8 f3/16! f3/16 r/8 a3/16 c4/16 r/8 f4/16! eb4/16 r/8 c4/16 a3/16 | "
    "r/8 eb3/16! eb3/16 r/8 g3/16 bb3/16 r/8 e3/16! g3/16 bb3/16 c4/16 db4/16 e4/16")

# bass sequences (16ths; every beat starts with a rest = the kick's slot)
P1 = 'r/16 R/16 8/16 R/16 r/16 R/16 7/16 8/16 r/16 R/16 8/16 R/16 r/16 3/16 5/16 ap/16'
P2 = 'r/16 R/16 8/16 R/16 r/16 5/16 8/16 7/16 r/16 R/16 8/16 5/16 r/16 7v/16 5v/16 ap/16'
P3 = 'r/16 R/16 8/16 R/16 r/16 b2/16 R/16 8/16 r/16 R/16 b7/16 8/16 r/16 5/16 b3^/16 ap/16'      # tonic: the ♭2 rub
PH = 'r/16 R/16 8/16 R/16 r/16 5/16 8/16 ap/16'
P_HALF = 'R/8. R/16 r/4 8/8 r/8 R/16 5/16 7/16 ap/16'                                         # BR 3-4, half-time
# chip-saw counter (intensity): 3-3-2 dotted-8th 'gear' figure in octave 4, against the 16th conveyor above it
GEAR = '8/8. 5/8. 3/8 R/8. 5/8. 7/8'
GEAR_H = '8/8. 5/8. 3/8'

# kit (drums_909: k 909 kick, s 909 snare, cl clap, h/o 808 hats, rs rim, cb cowbell, t1-t3 808 toms, c cymbal)
KICK = 'k/4 k/4 k/4 k/4 |'
HATS = '(h?/16 h/16 o/16 h/16)x4 |'
HATS_C = 'c/16 h/16 o/16 h/16 (h?/16 h/16 o/16 h/16)x3 |'
CLAP = 'r/4 cl/4 r/4 cl/4 |'
CLAP_F4 = 'r/4 cl/4 s/16 s/16 s/16 s/16 cl/16 t2/16 t3/8 |'
CLAP_F8 = 'r/4 cl/4 t1/16 t1/16 t2/16 t2/16 t3/16 t3/16 s/16 s/16 |'
MACHINE = 'rs/16 r/16 r/16 rs/16 r/16 r/16 cb/16 r/16 rs/16 r/16 r/16 rs/16 r/16 r/16 cb/16 r/16 |'
MACHINE_B = 'rs/16 r/16 r/16 rs/16 r/16 r/16 cb/16 r/16 rs/16 r/16 cb/16 rs/16 r/16 cb/16 cb/16 r/16 |'

BED = [(0, 2, '!'), (6, 2, ''), (14, 2, '')]                   # 1, 2&, 4&
BAM = [(0, 2, '!'), (6, 2, ''), (10, 1, '!'), (11, 1, ''), (14, 2, '!')]   # … + 3& 3a under the held note
HIT8 = [(0, 2, '!'), (6, 2, ''), (8, 4, '!'), (14, 2, '')]     # bar 8: a held hit on 3

BUSY = {   # hint for the r3 busy tool (study/tools): which parts are the tune, which the bass
    'melody': {'lead': None, 'lead_chip': None},
    'bass': ['bass', 'acid', 'tri_bass'], 'primary_bass': 'bass',
    'cat': {'zap': 'answer', 'reply': 'answer', 'stab': 'stab', 'brass': 'stab', 'hits': 'stab', 'conveyor': 'arp',
            'syn_brass': 'counter', 'saw_arp': 'arp', 'acid_hi': 'riff', 'box': 'answer', 'pad': 'pad',
            'pad_br': 'pad', 'riser': 'pad', 'rev': 'perc'},
}


def build() -> Song:
    s = Song(id='battle_foundry', title='Neon Conveyor', bpm=130, meter=(4, 4), key='Fm',
             form=['intro', '|:', 'A', 'B', 'BR', 'D', ':|'],
             mix={'echo': {'delay_ms': 224, 'feedback': 0.38, 'volume': 0.26, 'fir': 'soft'}, 'highpass_hz': 32},
             seam_beats=8,   # a few gated saw-stab / chip-bell notes in A bars 1-2 render ≈ −57 dB apart in FluidSynth
                             # cycles 1 and 2 (same MIDI); a 2-bar seam puts the entry splice past them (WAV −91 dB)
             description='Battle (foundry, night): techno — 909 four-on-the-floor, rolling 16th bass, BELL conveyor arp, '
                         'filter build, kick-drop breakdown, G-minor drop with an acid solo.')
    s.busy = BUSY
    s.section('intro', 2, CH_INTRO)
    s.section('A', 8, CH_A)
    s.section('B', 8, CH_B)
    s.section('BR', 8, CH_BR)
    s.section('D', 8, CH_D)

    # ================================================================ base
    # --- kit, split into layers (kick = the pump key)
    s.part('kick', 'drums_909', 'base', vel=4, gain=2) \
        .pattern(['intro', 'A', 'B', 'D'], KICK) \
        .notes('BR', bars('r/1', 'r/1', 'r/1', 'r/1', 'r/1', 'r/1', 'r/1', 'r/2 r/4 k/16 k/16 k/16 k/16'))
    s.part('hats', 'drums_909', 'base', vel=-10) \
        .notes('intro', bars('r/1', '(h?/16 h/16 o/16 h/16)x4')) \
        .pattern(['A', 'B', 'D'], HATS, fills={1: HATS_C, 5: HATS_C}) \
        .notes('BR', bars('r/1', 'r/1', '(h?/16 h?/16 h/16 h?/16)x4', '(h?/16 h?/16 h/16 h?/16)x4',
                          HATS[:-2], HATS[:-2], HATS[:-2], '(h/16 h/16 o/16 h/16)x3 o/4'))
    s.part('clap', 'drums_909', 'base', vel=-4) \
        .notes('intro', bars('r/1', 'r/4 cl/4 ' + roll('s', '16', 8, 50, 100))) \
        .pattern(['A', 'B'], CLAP, fills={4: CLAP_F4, 8: CLAP_F8}) \
        .pattern('D', CLAP, fills={2: 'r/4 cl/4 r/4 cl/8 cl/16 cl/16 |', 4: CLAP_F4, 8: CLAP_F8}) \
        .notes('BR', bars('r/1', 'r/1', 'r/1', 'r/2 r/4 cl/16 cl/16 cl/16 cl/16', 'r/4 cl/4 r/4 cl/4',
                          'r/4 cl/4 r/4 cl/4', roll('s', '16', 16, 40, 92), roll('s', '32', 32, 70, 124)))
    s.part('machine', 'drums_909', 'base', vel=-14, gain=3) \
        .pattern(['intro', 'A', 'BR', 'D'], MACHINE).pattern('B', MACHINE_B)

    # --- bass (the star) + its phone-speaker octave pops live in the line itself (F3/E♭3 every beat)
    pump = {'pump': {'key': 'kick', 'notes': ['k'], 'depth_db': 6, 'release_beats': 0.4}}
    s.part('bass', 'techno_bass', 'base', vel=2, gain=-2.5, fx=pump) \
        .notes('intro', line(CH_INTRO, [P1, P3], PH, low=36, nxt='Fm9')) \
        .notes('A', line(CH_A, [P3, P2, P1, P1, P3, P2, P1, P1], PH, low=36, nxt='Dbmaj9')) \
        .notes('B', line(CH_B, [P2, P1, P2, P1, P2, P1, P2, P1], PH, low=36, nxt='Fm9')) \
        .notes('BR', bars('r/1', 'r/1', line('Bbm9 | Gbmaj7', P_HALF, low=36, nxt='Fm9'),
                          line('Fm9 Dbmaj7 | C7 | Ebmaj7 | D7sus4 D7', [P1, P1, P2, P1], PH, low=36, nxt='Gm9'))) \
        .notes('D', bars('r/1', 'r/1', line('Cm9 D7 | Gm9 | Gm9 | Ebmaj7 | F6 F/A | Eb6 C7', [P1, P3, P3, P2, P1, P1],
                                            PH, low=36, nxt='Fm9')))
    s.part('acid', 'acid_bass', 'base', vel=4, gain=3,
           fx={'filter': {'auto': hold(['D', 1, 320], ['D', 2.5, 2600], ['D', 3, 900])}}) \
        .notes('D', bars(ACID_SOLO, rest(6)))

    # --- the conveyor: BELL as a 16th sequencer arp (filter: open, then behind a wall in BR, opening into the drop)
    s.part('conveyor', 'synth_chime', 'base', vel=-6, gain=3.5,
           fx={'filter': {'type': 'lp', 'q': 1.4, 'auto': hold(['BR', 1, 9000], ['BR', 2.5, 800], ['BR', 6, 800],
                                                                 ['BR', 9, 9000])}}) \
        .notes('intro', conveyor(CH_INTRO, F, 5, DOMS, v_hi=78, v_lo=58)) \
        .notes('A', conveyor(CH_A, F, 5, DOMS)) \
        .notes('B', conveyor(CH_B, F, 5, DOMS, v_hi=78, v_lo=58, mute_bars=(2, 4, 6, 8))) \
        .notes('BR', bars(conveyor('Fm9 Dbmaj7 | C7 | Bbm9 | Gbmaj7 | Fm9 Dbmaj7 | C7', F, 5, DOMS, v_hi=86, v_lo=64),
                          conveyor('Ebmaj7 | D7sus4 D7', G, 5, DOMS, v_hi=90, v_lo=70))) \
        .notes('D', bars(conveyor('Gm9 | Gm9 | Cm9 D7 | Gm9 | Gm9 | Ebmaj7 | F6 F/A', G, 5, DOMS, mute_bars=(1, 2)),
                         conveyor('Eb6 C7', F, 5, DOMS)))
    s.part('reply', 'synth_chime', 'base', vel=4, gain=5).notes('B', bars(*[B_REPLY.get(b, 'r/1') for b in range(1, 9)]))

    # --- stab bed + BAM (filter opens across A)
    s.part('stab', 'saw_stab', 'base', vel=-8, gain=0.5,
           fx={'filter': {'type': 'lp', 'q': 1.6, 'auto': hold(['A', 1, 700], ['A', 9, 6500], ['D', 9, 6500])}}) \
        .notes('A', hits(CH_A, BED, 55, 72, per_bar={2: BAM, 4: BAM, 6: BAM, 8: HIT8})) \
        .notes('B', hits(CH_B, BED, 55, 72, per_bar={4: BAM, 8: HIT8})) \
        .notes('D', hits(CH_D, BED, 55, 72, per_bar={1: BED + [(10, 2, '!')], 4: BAM, 6: BAM, 8: HIT8}))
    s.part('zap', 'chip_bell', 'base', vel=-10) \
        .at('A', 2, "r/2 r/8 ab6/16' ab6/16' r/8 c7/8'").at('A', 4, "r/2 r/8 bb6/16' bb6/16' r/8 f6/8'") \
        .at('A', 6, "r/2 r/8 ab6/16' ab6/16' r/8 eb7/8'").at('A', 8, "r/2 r/8 g6/16' g6/16' r/8 bb6/8'") \
        .at('D', 4, "r/2 r/8 d7/16' d7/16' r/8 bb6/8'").at('D', 6, "r/2 r/8 bb6/16' bb6/16' r/8 d7/8'") \
        .at('D', 8, "r/2 r/8 c7/16' c7/16' r/8 e7/8'")

    # --- lead: square lead + chip pulse a step under it (one game: the chip voice is always there)
    s.part('lead', 'square_lead', 'base', vel=8, gain=3.5) \
        .notes('A', bars(*HOOK, HOOK[0], *HOOK_END)) \
        .notes('B', bars(*[B_CALL.get(b, 'r/1') for b in range(1, 9)])) \
        .notes('BR', bars('r/1', 'r/1', 'f5/4. eb5/8 db5/4 c5/4', 'db5/1', 'r/1', 'r/1', 'r/1', 'r/1'), vel=-14) \
        .notes('D', bars(*D_LEAD), motifs={3: BELL})
    s.part('lead_chip', 'chip_pulse25', 'base', vel=-12, gain=-1.5).double('lead', ['A', 'B', 'D'])

    # --- breakdown colour
    s.part('box', 'music_box', 'base', vel=6, gain=1.5) \
        .notes('BR', bars(BELL.question('Fm', 5, augment=2).rsplit(' ', 1)[0], 'e5/2. r/4', 'r/1', 'r/1',
                          BELL.question('Fm', 6, augment=2).rsplit(' ', 1)[0], 'e6/2. r/4', 'r/1', 'r/1'),
               motifs={1: BELL, 5: BELL})
    s.part('pad_br', 'supersaw', 'base', vel=-10, gain=-3,
           fx={'pump': {'key': 'beat', 'depth_db': 7, 'release_beats': 0.5}}) \
        .notes('BR', hits(CH_BR, [(0, 8, ''), (8, 8, '')], 53, 74, style='close'))
    s.part('pad', 'supersaw', 'base', vel=-18, gain=-5, fx={'pump': {'key': 'kick', 'notes': ['k'], 'depth_db': 9,
                                                                      'release_beats': 0.6}}) \
        .notes('B', hits(CH_B, [(0, 8, ''), (8, 8, '')], 53, 74, style='close'))
    s.part('riser', 'sweep_pad', 'base', vel=0) \
        .notes('intro', bars('[f3 c4 ab4]/1', '[e3 bb3 g4]/2 r/2')) \
        .notes('BR', bars(rest(6), '[eb3 bb3 g4]/1', '[d3 a3 f#4]/1'))
    s.part('rev', 'rev_cymbal', 'base', vel=-6).notes('BR', bars(rest(7), 'r/2 c4/2'))

    # ================================================================ intensity
    s.part('brass', 'brass_stab', 'intensity', vel=-2, gain=1.5).double('stab', ['B', 'D'])
    s.part('syn_brass', 'synth_brass', 'intensity', vel=4, gain=3.5) \
        .notes('A', bars('ab4/2 g4/2', 'f4/2. eb4/4', 'g4/2 bb4/2', 'c5/2 db5/4 c5/4',
                         'ab4/2 c5/2', 'db5/2. c5/4', 'bb4/2 g4/2', 'f4/2 e4/2')) \
        .notes('D', bars(SENTINEL.question('Gm', 4), 'bb4/2 a4/2', 'g4/2 f#4/2', 'g4/1',
                         SENTINEL.question('Gm', 4), 'bb4/2. g4/4', 'a4/2 c5/2', 'bb4/2 g4/2'),
               motifs={1: SENTINEL, 5: SENTINEL})
    s.part('saw_arp', 'chip_saw', 'intensity', vel=-12, gain=1) \
        .notes('B', line(CH_B, GEAR, GEAR_H, low=53, nxt='Fm9')) \
        .notes('D', bars(rest(2), line('Cm9 D7 | Gm9 | Gm9 | Ebmaj7 | F6 F/A | Eb6 C7', GEAR, GEAR_H, low=53, nxt='Fm9')))
    s.part('tri_bass', 'chip_triangle', 'intensity', octave=1, vel=-20, gain=-2.5).double('bass', ['A', 'B', 'D'])
    s.part('acid_hi', 'acid_bass', 'intensity', vel=-4, gain=0,
           fx={'filter': {'auto': hold(['D', 5, 500], ['D', 9, 3600])}}) \
        .notes('D', bars(rest(4), ACID_HI))
    s.part('ride', 'drums_909', 'intensity', vel=-16, gain=3).pattern(['B', 'D'], '(r/8 rd/8)x4 |')
    s.part('clap_roll', 'drums_909', 'intensity', vel=-10, gain=2) \
        .pattern(['A', 'B', 'D'], 'r/2. r/8 r/16 cl/16 |',
                 fills={4: 'r/2 cl/16 cl/16 cl/16 cl/16 cl/16 cl/16 cl/16 cl/16 |',
                        8: 'r/2 ' + roll('cl', '16', 8, 60, 110) + ' |'})
    s.part('noise', 'chip_kit', 'intensity', vel=-26, gain=4).pattern(['A', 'B', 'D'], '(h/16 h?/16 h/16 h?/16)x4 |')
    s.part('hits', 'orch_hit', 'intensity', vel=-3) \
        .at('A', 8, 'r/2 [c4 e4 g4 bb4]/4 r/4').at('B', 8, 'r/2 [c4 e4 g4 bb4 db5]/4 r/4') \
        .at('D', 1, '[g3 bb3 d4 g4]/4 r/2.').at('D', 4, 'r/2 [g3 bb3 d4 g4]/4 r/4') \
        .at('D', 8, 'r/2 [c4 e4 g4 bb4]/4 r/4').at('BR', 8, 'r/2. [d4 f#4 a4 c5]/4')
    return s


def wave() -> Song:
    """Wave-start sting: a 909 snare build under a saw chord whose filter opens, then the stab on beat 3 (accentBeat 2,
    the engine lands it on the battle loop's next strong beat), with the conveyor arp spinning up into it."""
    s = Song(id='wave_foundry', title='Neon Conveyor — wave', bpm=130, meter=(3, 4), key='Fm', form=['S'], bus='stinger',
             tail=0.8, extra={'accentBeat': 2},
             mix={'echo': {'delay_ms': 224, 'feedback': 0.34, 'volume': 0.24, 'fir': 'soft'}},
             description='Wave-start stinger (Neon Conveyor): 909 build, filter-opening saw chord, stab.')
    s.section('S', 1)
    s.part('roll', 'drums_909', 'full', vel=0).notes('S', roll('s', '16', 4, 54, 92) + ' ' + roll('s', '32', 8, 80, 120)
                                                      + ' k+c/4')
    s.part('swell', 'supersaw', 'full', vel=-4, fx={'filter': {'type': 'lp', 'q': 2.5,
                                                              'auto': [['S', 1, 300], ['S', 1.66, 5200]]}}) \
        .notes('S', '[f3 c4 ab4]/2 r/4')
    s.part('arp', 'synth_chime', 'full', vel=-4).notes('S', 'c5/16 f5/16 db5/16 eb5/16 c6/16 f6/16 db6/16 e6/16 f6/4')
    s.part('stab', 'saw_stab', 'full', vel=8).notes('S', "r/2 [f3 c4 eb4 ab4]/4!")
    s.part('brass', 'brass_stab', 'full', vel=0).notes('S', "r/2 [ab3 c4 f4]/4")
    s.part('zap', 'chip_bell', 'full', vel=-6).notes('S', "r/2 c7/16' f7/16' r/8")
    s.part('bass', 'techno_bass', 'full', vel=4).notes('S', "r/2 f2/16 f3/16 f2/16 f3/16'")
    return s


songs = [build(), wave()]
