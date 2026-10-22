"""'Blossom Brigade' — battle family 1 (sakura + arena maps). ORIGINAL composition (docs/AUDIO.md §4.1 rules).

D major, 150 bpm, straight. Stems: base (complete music: build phase) + intensity (wave active).
(40 bars at 150 keeps intro + 2 render cycles under 134 s: FluidSynth's millisecond timer wraps at 2^32/1000
samples and mistimes events there.)
    intro  2 bars  B♭ – C – D fanfare hits (♩. ♩. ♩), snare build, chip pickup run
    A      8 bars  the Blossom hook: "up a sixth, a little turn, back down" (♪ ♪~♪ ♬ ♪ ♪ ♩) and a
                   tied answer that leaves beats 3-4 free for a xylophone reply (call and response)
    A2     8 bars  the hook again, glock doubling; new ending through B7♭9 and the minor iv (Gm6) …
    B      8 bars  … which is ii in F: the MAIN THEME (§4.3 bars 1-8) up a minor third, heroic double-time
                   (slap-bass octaves, 16th hats, trumpet + strings doubling in the intensity stem)
    B2     8 bars  development: the Blossom hook's rhythm carried into F, climbing to a C7 that lands on D
                   (♭VII → I)
    BR     8 bars  breakdown in D: half-time, the music box rings BELL (question only), marimba replies,
                   SENTINEL CALL rallies in brass (intensity), snare crescendo back into A
Form: intro |: A A2 B B2 BR :|  — 2 + 40 bars.

Leitmotifs: BELL (B bars 1/3/5 inside the main theme, BR music box), main theme (B), SENTINEL CALL (BR, intensity).
review: originality — hook, bass lines, counter-lines and fills are new; the main theme / BELL / SENTINEL are the
project's own motifs. Checked by ear-memory against well-known console and indie game
battle themes and anthems: no shared hook or contour. Composer B, 2026-10-08.
"""
from sakura_audio.song import Song
from motifs import BELL, SENTINEL
from _battle_kit import bars, roll, MAIN_A, MAIN_A_CHORDS

CH_INTRO = 'Bbmaj7 C7 | D A7sus4'
CH_A = 'Dmaj9 | Bm7 | Gmaj7 | A7sus4 A7 | F#m7 | B7 | Em9 Gm6 | A7sus4 A7'
CH_A2 = 'Dmaj9 | Bm7 | Gmaj7 | A7sus4 A7 | F#m7 | B7b9 | Em9 | Gm6 C7'
CH_B2 = 'Dm9 | Bbmaj7 | Gm9 | C7sus4 C7 | Am7 | Dm9 | Bbmaj7 | C7'
CH_BR = 'Dmaj7 | F#m7 | Gmaj7 | A7sus4 A7 | Dmaj7 | F#m7 | Gmaj9 | A7sus4 A7'

HOOK = [
    'f#5/8 d6/8~ d6/8 c#6/16 b5/16 c#6/8 a5/8 f#5/4',     # 1 Dmaj9   up a sixth, the turn, back down
    'e5/8 f#5/8 d5/8 b4/8~ b4/4 r/4',                     # 2 Bm7     tied answer … (xylophone replies)
    'g5/8 e6/8~ e6/8 d6/16 c#6/16 d6/8 b5/8 g5/4',        # 3 Gmaj7   the call a step higher
    'a5/8 b5/8 g5/8 e5/8~ e5/4 r/4',                      # 4 A7sus4 A7
]
A_END = [
    'a5/8 f#6/8~ f#6/8 e6/16 d6/16 e6/8 c#6/8 a5/4',      # 5 F#m7    sequence up a third
    'b5/8 c#6/8 d#6/8 f#6/8~ f#6/4 r/4',                  # 6 B7
    'e6/8 d6/8 b5/8 g5/8~ g5/8 bb5/8 a5/8 g5/8',          # 7 Em9 Gm6 (minor iv tug)
    'a5/4. g5/8 e5/8 c#5/8 e5/8 g5/8',                    # 8 A7sus4 A7 → the 7th falls into the hook
]
A2_END = [
    'a5/8 f#6/8~ f#6/8 e6/16 d6/16 e6/8 c#6/8 a5/4',      # 5 F#m7
    'd#6/8 c6/8 b5/8 a5/8~ a5/4 f#5/4',                   # 6 B7♭9
    'g5/8 e6/8~ e6/8 d6/16 c6/16 d6/8 b5/8 g5/4',         # 7 Em9 (darker: C♮)
    'bb5/4 a5/8 g5/8 e5/4 g5/4',                          # 8 Gm6 C7  → F
]
B2_MEL = [
    'a5/8 f6/8~ f6/8 e6/16 d6/16 e6/8 c6/8 a5/4',         # 1 Dm9     the hook shape in F
    'd6/8 c6/8 a5/8 f5/8~ f5/4 r/4',                      # 2 B♭maj7
    'g5/8 e6/8~ e6/8 d6/16 c6/16 d6/8 bb5/8 g5/4',        # 3 Gm9
    'a5/8 bb5/8 g5/8 f5/8 e5/4 r/4',                      # 4 C7sus4 C7
    'c6/8 a5/8 e5/8 a5/8~ a5/4 c6/8 d6/8',                # 5 Am7     longer breath, climbing
    'e6/4. d6/8 c6/8 a5/8 f5/8 a5/8',                     # 6 Dm9
    'd6/4 c6/8 d6/8 f6/4 e6/8 d6/8',                      # 7 B♭maj7
    'e6/4. d6/8 c6/8 bb5/8 g5/8 e5/8',                    # 8 C7      → D
]
COUNTER_A2 = [   # chip_pulse12 a third (or sixth) under the hook: the 16-bit RPG "two pulse channels" sound
    'd5/8 b5/8~ b5/8 a5/16 g5/16 a5/8 f#5/8 d5/4',
    'c#5/8 d5/8 b4/8 f#4/8~ f#4/4 r/4',
    'e5/8 c#6/8~ c#6/8 b5/16 a5/16 b5/8 g5/8 d5/4',
    'e5/8 g5/8 e5/8 d5/8 c#5/4 r/4',
    'f#5/8 c#6/8~ c#6/8 b5/16 a5/16 b5/8 a5/8 f#5/4',
    'b5/8 a5/8 f#5/8 d#5/8~ d#5/4 d#5/4',
    'e5/8 b5/8~ b5/8 a5/16 g5/16 f#5/8 g5/8 e5/4',
    'g5/4 f5/8 e5/8 c5/4 e5/4',
]
BASS_A = [
    'd2/8. d2/16 d3/8 d2/8 a2/8 d3/8 a2/8 c3/8',      # slap: root, 16th pickup, octave pop, fifth,
    'b2/8. b2/16 b3/8 b2/8 f#2/8 a2/8 b2/16 b3/16 g#2/8',  # chromatic approach into every change;
    'g2/8. g2/16 g3/8 g2/8 d2/8 g2/8 f#2/8 g#2/8',
    'a2/8. a2/16 a3/8 a2/8 e2/8 g2/8 a2/16 a3/16 f2/8',    # round 3: a 16th octave flick before the approach
    'f#2/8. f#2/16 f#3/8 f#2/8 c#3/8 e3/8 c#3/8 c3/8',     # in every 2nd bar (the hook's answer bars)
    'b2/8. b2/16 b3/8 b2/8 d#3/8 f#3/16 f#2/16 a2/8 f2/8',
    'e2/8. e2/16 e3/8 b2/8 g2/8. g2/16 bb2/8 d3/8',
    'a2/8. a2/16 a3/8 a2/8 e2/8 a2/16 a3/16 g2/8 c#2/8',
]
BASS_A2 = BASS_A[:6] + ['e2/8. e2/16 e3/8 e2/8 b2/8 e3/8 d3/8 g#2/8',
                        'g2/8. g2/16 g3/8 bb2/8 c3/8. c3/16 c4/16 c3/16 e2/8']
BASS_B = [
    'f2/8 f3/8 f2/8 f3/8 a2/8 a3/8 e2/8 c#2/8',       # double-time octave pump with a walk into every change
    'd2/8 d3/8 d2/8 d3/8 a2/8 a3/8 c3/8 b2/8',
    'bb2/8 bb3/8 bb2/8 bb3/8 f2/8 f3/8 a2/8 b2/8',
    'c3/8 c4/8 c3/8 c4/8 c3/8 bb2/8 g2/8 g#2/8',
    'a2/8 a3/8 a2/8 a3/8 e2/8 e3/8 c2/8 c#2/8',
    'd2/8 d3/8 d2/8 d3/8 f#2/8 f#3/8 a2/8 g#2/8',
    'g2/8 g3/8 g2/8 g3/8 bb2/8 bb3/8 db3/8 db2/8',
    'c2/8 c3/8 c2/8 c3/8 c2/8 bb2/8 g2/8 e2/8',
]
BASS_B2 = [   # round 3: the A-section slap shape carried into F (was the generic bass:sync, 6 notes a bar); the rest
    'd2/8. d2/16 d3/8 d2/8 r/8 c3/8 a2/16 d3/16 b2/8',      # on beat 3 leaves the kick alone, then a 16th flick
    'bb2/8. bb2/16 bb3/8 bb2/8 r/8 a2/8 f2/16 bb2/16 f#2/8',  # and the chromatic approach
    'g2/8. g2/16 g3/8 g2/8 r/8 f2/8 d2/16 g2/16 b2/8',
    'c3/8. c3/16 c4/8 c3/8 r/8 bb2/8 g2/16 c3/16 g#2/8',
    'a2/8. a2/16 a3/8 a2/8 r/8 g2/8 e2/16 a2/16 c#2/8',
    'd2/8. d2/16 d3/8 d2/8 r/8 c3/8 a2/16 d3/16 a2/8',
    'bb2/8. bb2/16 bb3/8 bb2/8 r/8 a2/8 f2/16 a2/16 b2/8',
    'c3/8. c3/16 c4/8 c3/8 r/8 bb2/8 g2/16 e2/16 c#2/8',
]
BASS_BR = ['d2/2. a2/4', 'f#2/2. c#3/4', 'g2/2. d3/4', 'a2/2 e2/4 c#2/4',
           'd2/4. d2/8 a2/4 d3/4', 'f#2/4. f#2/8 c#3/4 f#3/4',
           'g2/8. g2/16 g3/8 g2/8 d3/8 g3/8 f#3/8 e3/8', 'a2/8 a2/8 a3/8 a2/8 e2/8 a2/8 g2/8 c#2/8']

GROOVE = 'k+h/8 h/8 s+h/8 h/8 k+h/8 k+h/16 k/16 s+h/8 h/8 |'
GROOVE_C = 'k+c/8 h/8 s+h/8 h/8 k+h/8 k+h/16 k/16 s+h/8 h/8 |'
FILL4 = 'k+h/8 h/8 s+h/8 k/16 k/16 s/16 s?/16 s/16 s/16 t1/8 t3/8 |'
FILL8 = 'k+h/8 h/8 s/16 s? s s s/8 t1/16 t1 t2/8 t3/16 t3 |'
DOUBLE = 'k+h/16 h? h k? s+h h? h k k+h h? k h? s+h h? h h? |'
DOUBLE_C = 'k+c/16 h? h k? s+h h? h k k+h h? k h? s+h h? h h? |'
DOUBLE_F4 = 'k+h/16 h? h k? s+h h? h k k+h h? k h? s/16 s s s |'
DOUBLE_F8 = 'k+h/16 h? h k? s+h h? h k s/16 s s s t1 t1 t2 t3 |'
HALF = 'k/8 h?/8 h?/8 h?/8 s/8 h?/8 h?/8 k?/8 |'


def build() -> Song:
    s = Song(id='battle_blossom', title='Blossom Brigade', bpm=150, meter=(4, 4), key='D',
             form=['intro', '|:', 'A', 'A2', 'B', 'B2', 'BR', ':|'],
             mix={'highpass_hz': 40},
             description='Battle (sakura, arena): bouncy D-major hook, the main theme heroic in F, music-box breakdown.',
             extra={'lane': 'anime chip-rock',
                    'busy': {'melody': {'lead': None, 'glock': None, 'tpt': ['B'], 'strings': None, 'box': None},
                             'bass': ['bass'], 'primary_bass': 'bass',
                             'cat': {'xylo': 'answer', 'mar_reply': 'answer', 'counter': 'counter', 'stabs': 'stab',
                                     'hits': 'stab', 'stab_in': 'stab', 'timp': 'answer', 'marimba': 'arp',
                                     'ep': 'comp', 'harp': 'arp', 'bam': 'stab', 'organ': 'stab'}}})
    s.section('intro', 2, CH_INTRO)
    s.section('A', 8, CH_A)
    s.section('A2', 8, CH_A2)
    s.section('B', 8, MAIN_A_CHORDS)
    s.section('B2', 8, CH_B2)
    s.section('BR', 8, CH_BR)

    # ================================================================ base: complete music on its own
    s.part('stab_in', 'brass_stab', 'base', vel=6).notes('intro', bars(
        '[bb4 d5 f5 a5]/4. [c5 e5 g5 bb5]/4. [d5 f#5 a5 d6]/4', 'r/1'))
    s.part('lead', 'chip_pulse25', 'base', vel=10) \
        .notes('intro', bars('[bb5 d6]/4. [c6 e6]/4. [d6 f#6]/4', 'r/2 a4/16 b4/16 c#5/16 d5/16 e5/8 e5/8')) \
        .notes('A', bars(*HOOK, *A_END)) \
        .notes('A2', bars(*HOOK, *A2_END)) \
        .notes('B', bars(*MAIN_A), motifs={1: BELL, 3: BELL, 5: BELL}) \
        .notes('B2', bars(*B2_MEL)) \
        .at('BR', 7, bars('g5/8 e6/8~ e6/8 d6/16 c#6/16 d6/8 b5/8 g5/4', 'a5/4 g5/8 a5/8 b5/8 a5/8 g5/8 e5/8'))
    s.part('glock', 'glock', 'base', octave=1, vel=-22).double('lead', ['A2', 'B2'])
    s.part('xylo', 'xylophone', 'base', vel=-10) \
        .at(['A', 'A2'], 2, 'r/2 f#5/16 a5/16 b5/8 d6/8 r/8').at(['A', 'A2'], 4, 'r/2 e5/16 g5/16 a5/8 c#6/8 r/8') \
        .at('B2', 2, 'r/2 d5/16 f5/16 a5/8 c6/8 r/8').at('B2', 4, 'r/2 e5/16 g5/16 bb5/8 c6/8 r/8') \
        .at('A', 6, "r/2 a6/16' a6/16' r/8 b6/8' r/8").at('A2', 6, "r/2 d#6/16' f#6/16' a6/8' r/4") \
        .at('B', 1, "r/2 r/8 a6/16' a6/16' c7/8' r/8").at('B', 4, "r/2. e6/16' g6/16' c7/8'") \
        .at('B2', 5, "r/2 e6/16' e6/16' g6/8' r/4")
    # round 3: the "BAM" under the answers — a short brass chord (A3-G4) where the hook holds or rests, and on the
    # phrase-end fills, so the build phase (base stem) talks back too
    s.part('bam', 'brass_stab', 'base', vel=4) \
        .at(['A', 'A2'], 2, "r/2 [a3 b3 d4 f#4]/8! r/8 r/4").at(['A', 'A2'], 4, "r/2 [a3 c#4 e4 g4]/8! r/8 r/4") \
        .at('A', 6, "r/2 [a3 b3 d#4 f#4]/8! r/8 r/4").at('A2', 6, "r/2 [a3 c4 d#4 f#4]/8! r/8 r/4") \
        .at('A', 8, "r/2 [a3 c#4 e4 g4]/8! r/8 r/4").at('A2', 8, "r/2 [bb3 c4 e4 g4]/8! r/8 r/4") \
        .at('B', 4, "r/2 [bb3 c4 e4 g4]/8! r/8 r/4").at('B', 8, "r/2. [bb3 c4 e4 g4]/8! r/8") \
        .at('B2', 2, "r/2 [a3 bb3 d4 f4]/8! r/8 r/4").at('B2', 4, "r/2 [bb3 c4 e4 g4]/8! r/8 r/4") \
        .at('B2', 5, "r/2 [g3 a3 c4 e4]/8! r/8 r/4").at('B2', 8, "r/2 [bb3 c4 e4 g4]/8! r/8 r/4")
    # round 3: a rootless organ stab bed on 1, 2& and 4& under the hook (the intensity brass stabs double it)
    s.part('organ', 'organ', 'base', vel=-16).gen(['A', 'A2', 'B', 'B2'], 'comp:stabs', voicing='rootless', low=55, high=69)
    s.part('box', 'music_box', 'base').notes('BR', bars(
        BELL.question('D', 6) + ' r/8', 'r/1', 'b5/8 e6/8 c#6/4 d6/4. r/8', 'r/1',
        BELL.question('D', 6) + ' r/8', 'r/1', 'r/1', 'r/1'), motifs={1: BELL, 5: BELL})
    s.part('mar_reply', 'marimba', 'base').at('BR', 2, 'r/4 c#6/8 a5/8 e5/8 f#5/8~ f#5/4') \
        .at('BR', 4, 'r/4 d6/8 b5/8 g5/8 a5/8~ a5/4').at('BR', 6, 'r/4 c#6/8 a5/8 e5/8 f#5/8 a5/8 c#6/8')
    s.part('marimba', 'marimba', 'base', vel=-18).gen(['A', 'A2', 'B2'], 'arp:updown8', low=62, high=79) \
        .gen('B', 'arp:up16', low=65, high=84, vel=62)
    s.part('ep', 'epiano', 'base', vel=-14).gen(['A', 'A2', 'B2'], 'comp:offbeat', voicing='rootless', low=55, high=72) \
        .gen('B', 'comp:charleston', voicing='rootless', low=55, high=72) \
        .gen('BR', 'pad:sustain', voicing='rootless', low=55, high=72, vel=54)
    s.part('str_pad', 'strings_slow', 'base').gen('B', 'pad:sustain', voicing='triad', low=55, high=72, vel=50)
    s.part('harp', 'harp', 'base', vel=-12).gen('BR', 'arp:updown8', low=55, high=79)
    s.part('bass', 'slap_bass', 'base') \
        .notes('intro', bars('bb2/4. c3/4. d3/4', 'd2/2 a2/4 c#3/4')) \
        .notes('A', bars(*BASS_A)).notes('A2', bars(*BASS_A2)) \
        .notes('B', bars(*BASS_B)) \
        .notes('B2', bars(*BASS_B2)) \
        .notes('BR', bars(*BASS_BR))
    s.part('kit', 'drums', 'base', vel=-6) \
        .notes('intro', bars('k+c/4. k+s/4. k+c/4', 'k/8 h/8 s/8 h/8 ' + roll('s', '16', 8, 60, 112))) \
        .pattern(['A', 'A2'], GROOVE, fills={1: GROOVE_C, 4: FILL4, 5: GROOVE_C, 8: FILL8}) \
        .pattern('B', DOUBLE, fills={1: DOUBLE_C, 4: DOUBLE_F4, 5: DOUBLE_C, 8: DOUBLE_F8}) \
        .pattern('B2', GROOVE, fills={1: GROOVE_C, 4: FILL4, 5: GROOVE_C, 8: FILL8}) \
        .pattern('BR', HALF, fills={1: 'k+c/8 h?/8 h?/8 h?/8 s/8 h?/8 h?/8 k?/8 |',
                                    8: roll('s', '16', 16, 54, 118) + ' |'})
    s.part('chip_hats', 'chip_kit', 'base', vel=-34).pattern(['A2', 'B', 'B2'], '(h/16 h? h h?)x4 |')

    # ================================================================ intensity: drive and colour, same harmony
    s.part('claps', 'drums_power', 'intensity', vel=8) \
        .pattern(['A', 'A2', 'B2'], 'h/16 h? h h? cl+h h? h h? h h? h h? cl+h h? h h? |') \
        .pattern('B', 'h/16 h? o h? cl+h h? o h? h h? o h? cl+h h? o h? |') \
        .at('BR', 5, bars('k/4 r/4 cl/4 r/4', 'k/4 r/4 cl/4 r/8 k/8', 'k/4 k/8 k/8 cl/4 k/8 k/8', 'k/8 k k k cl/8 cl cl cl'))
    s.part('stabs', 'brass_stab', 'intensity', vel=16).gen(['A', 'A2', 'B2'], 'comp:stabs', voicing='close', low=58, high=76)
    s.part('counter', 'chip_pulse12', 'intensity', vel=8, gain=-3).notes('A2', bars(*COUNTER_A2)) \
        .at('BR', 3, SENTINEL.question('D', 5), motif=SENTINEL).at('BR', 7, SENTINEL.question('D', 5), motif=SENTINEL)
    s.part('tpt', 'trumpet', 'intensity', vel=10).double('lead', 'B') \
        .at('BR', 3, SENTINEL.question('D', 5)).at('BR', 7, SENTINEL.question('D', 5))
    s.part('strings', 'strings', 'intensity', octave=-1, vel=6).double('lead', ['B', 'B2'])
    s.part('trem', 'tremolo', 'intensity').gen('BR', 'pad:sustain', bars=(5, 8), low=50, high=67, vel=60)
    s.part('hits', 'orch_hit', 'intensity', vel=10) \
        .at('A', 4, 'r/2 [a3 c#4 e4 a4]/4 r/4').at('A', 8, 'r/2 [a3 c#4 g4]/4 r/4') \
        .at('A2', 8, '[g3 bb3 d4 e4]/4 r/4 [c4 e4 bb4]/4 r/4').at('B', 1, '[f3 a3 c4 f4]/4 r/2.') \
        .at('B', 5, '[a3 c4 e4 a4]/4 r/2.').at('B2', 8, 'r/2 [c4 e4 bb4]/4 r/4')
    s.part('timp', 'timpani', 'intensity') \
        .at('B', 1, 'f2/4 r/2 c2/8 c2/8').at('B', 5, 'a2/4 r/2 c2/8 c2/8') \
        .at('BR', 8, roll('a1', '16', 16, 40, 110))
    s.part('swell', 'rev_cymbal', 'intensity', vel=-10).at('BR', 8, 'c4/1')
    # round 3: a 16th shaker layer when the wave is on (accent on the offbeat 8ths)
    s.part('shaker', 'drums', 'intensity', vel=0, gain=4).pattern(['A', 'A2', 'B', 'B2'], '(sh/16? sh? sh! sh?)x4 |')
    return s


songs = [build()]
