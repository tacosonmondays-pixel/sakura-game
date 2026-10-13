"""'Wishing Envelope' — the recruit (gacha) screen; the `riser` stem swells in while the envelope is on screen.
ORIGINAL composition (docs/AUDIO.md §4.1 rules; round-3 genre lane: SWEET — music-box pop with stuff going on).

E major, 104 bpm straight, 4/4. Stems: `base` (the recruit screen, complete on its own) and `riser` (the envelope:
held breath, never new harmony).
    base   celesta lead (a chip bell doubles it), harp 16th arpeggios, pizzicato off-beat bounce, a skipping fretless
           bass (chip triangle an octave up, for phones), a light brush kit (soft kick on 1, 2& and 3, finger snaps on
           2 and 4, triangle on 4&) with a 16th shaker; the music box sings a descant in B and trades phrases with the
           celesta in C; ukulele strums in B. Every second bar the tune stops on beat 3 and the chimes answer it:
           a tinkle-bell double tick + a low harp-pluck chord ("melody — BAM"), a glock run in bar 4, a harp gliss +
           soft timpani + brush fill in bar 8.
    riser  tremolo strings swelling every two bars, choir "ooh", a timpani heartbeat on the chord roots, a reverse
           cymbal peaking on every second bar line, a harp glissando rising into it.
The celesta rings the Sakura Bell as a QUESTION (B5–E6–C♯6–D♯6) at the end of A and of B, and it is never answered
here: the gacha fanfares (gacha_r / gacha_sr / gacha_ssr, new_student) give the answer.
    intro  2 bars  the curtain: C (the ♭VI sparkle), harp, music box twinkle, glock run into …
    A      8 bars  "the wish": a skipping 2-bar hook (dotted 8th + 16th lift), answered by the chimes; A lydian ♯11 in
                   bar 3, the chromatic minor iv (F♯m9 → Am6) in bar 7, the Bell question in bar 8
    B      8 bars  the chorus: a singing syncopated line over C♯m9 – G♯m7 – A – E/G♯, ukulele strum, music-box descant
                   above it, C♯7 (V of ii), the Bell question again (celesta + music box)
    C      8 bars  sparkle break (no kick, no pizz, 8th harp): music box and celesta trade one-bar phrases over
                   A – C (the ♭VI) – A – C D, then the LIFT: the hook a minor third up in G major with the whole band,
                   D9 → B7sus4 → home
Form: intro |: A B C :|  — 2 + 24 bars (55.4 s loop).

Taste rules (r3 study/taste.md, sweet lane): bass 7 notes a bar (octave skip on the "a" of 1, chromatic approach into
every chord change, stepwise in B); melody in 2-bar cells with beats 3-4 of the second bar open and answered from the
base stem; harp 16ths + shaker 16ths keep something moving on every 16th; music-box descant (8 bars) and the C
dialogue; fills in bars 4 and 8, crash/splash on 1 and 5; breakdown + dialogue + lift in C; 1.46 chords a bar.

review: originality — the hook, the chorus line, the descant, the dialogue and the bass lines are new; the BELL motif
is the project's own. Checked against well-known gacha / summon / "wish" themes (Genshin, Blue Archive, Fate/GO,
Arknights, Granblue), music-box and lullaby classics, kawaii-pop and future-bass hooks, Animal Crossing and Kirby
tunes, Undertale/Deltarune and EarthBound/Mother: the harp arpeggio bed and ukulele strum are generic idioms, the
melodies share no hook or contour. `studio.py originality`: no blocklist match. Composer B4, 2026-10-09 (round 3).
"""
from fractions import Fraction as Fr

from sakura_audio.song import Song
from sakura_audio.theory import parse_grid, voice, name_of
from motifs import BELL
from _home import bars
from _sweet import line, chordify, arp, gliss, grid, chord_at

CH_INTRO = 'Cmaj9 | B7sus4 B7'
CH_A = 'Emaj9 | C#m9 | Amaj9 | B7sus4 B7 | Emaj9 G#m7 | C#m9 | F#m9 Am6 | B7sus4 B7'
CH_B = 'C#m9 | G#m7 | Amaj9 | E/G# | F#m9 | G#m7 C#7 | F#m9 Am6 | B7sus4 B7'
CH_C = 'Amaj9 | Cmaj9 | Amaj9 | Cmaj9 D9 | Gmaj9 | Em9 A9 | Cmaj9 D9 | B7sus4 B7'
SECTIONS = [('intro', CH_INTRO), ('A', CH_A), ('B', CH_B), ('C', CH_C)]

Q = BELL.question('E', 6, rhythm=('8', '8', '4', '4.')) + ' r/8'      # b5/8 e6/8 c#6/4 d#6/4. r/8 — never answered
TUNE_A = [
    'g#5/8. e6/16 d#6/8 b5/8 c#6/4 b5/8 g#5/8',     # 1 Emaj9     the skipping hook
    'b5/8 c#6/8 g#5/8 e5/8~ e5/2',                  # 2 C♯m9      … stops: chimes answer
    'a5/8. f#6/16 e6/8 c#6/8 d#6/4 c#6/8 a5/8',     # 3 Amaj9     a step up (D♯ = the lydian ♯11)
    'b5/8 c#6/8 a5/8 f#5/8~ f#5/2',                 # 4 B7sus4 B7 … glock run
    'b5/8 e6/8 g#6/4 f#6/8. e6/16 d#6/8 b5/8',      # 5 Emaj9 G♯m7
    'c#6/8 d#6/8 e6/8 b5/8~ b5/2',                  # 6 C♯m9      … chimes
    'a5/8 c#6/8 e6/8 g#6/8 e6/8 c6/8 a5/8 f#5/8',   # 7 F♯m9 Am6  the heart-tug (C♮)
    Q,                                              # 8 ⟨BELL⟩ question … harp gliss, timpani, fill
]
TUNE_B = [
    'g#6/4 g#6/8 f#6/8~ f#6/8 e6/8 d#6/8 e6/8',     # 1 C♯m9      the chorus: a repeated note and a push
    'b5/4 d#6/8 f#6/8~ f#6/2',                      # 2 G♯m7      … chimes
    'a6/4 a6/8 g#6/8~ g#6/8 f#6/8 e6/8 f#6/8',      # 3 Amaj9     a step up
    'c#6/4 e6/8 g#6/8~ g#6/2',                      # 4 E/G♯      … glock run
    'c#7/4 b6/8 a6/8~ a6/8 g#6/8 f#6/8 e6/8',       # 5 F♯m9      the peak, falling
    'd#6/4 f#6/8 f6/8~ f6/2',                       # 6 G♯m7 C♯7  E♯ = the third of C♯7 … chimes
    'f#6/8 a6/8 g#6/8 e6/8 c6/8 e6/8 a6/8 f#6/8',   # 7 F♯m9 Am6
    Q,                                              # 8 ⟨BELL⟩ question, celesta + music box
]
DESCANT_B = [                                       # music box above the chorus: moves where the tune holds
    'e7/2 d#7/4. c#7/8',
    'b6/4 r/4 d#7/8 c#7/8 b6/8 a#6/8',
    'c#7/2 b6/4. a6/8',
    'b6/2. r/4',
    'r/2 c#7/4 b6/4',
    'd#7/2 c#7/8 b6/8 g#6/4',
    'c#7/2 c7/2',
    BELL.question('E', 7, rhythm=('8', '8', '4', '4.')) + ' r/8',   # the Bell an octave above the celesta
]
DIALOGUE = [                                        # C 1-4: music box asks, celesta answers (one bar each)
    'c#6/16 e6/16 a6/16 b6/16 c#7/8 b6/8 g#6/4 r/4',   # box     Amaj9
    'b5/8 g5/8 e5/8 d5/16 e5/16 g5/4 r/4',             # celesta Cmaj9
    'e6/16 g#6/16 b6/16 c#7/16 e7/8 c#7/8 b6/4 r/4',   # box     Amaj9 (higher)
    'd6/8 b5/8 g5/8 e5/16 g5/16 f#5/8 a5/8 d6/4',      # celesta Cmaj9 D9 → the lift
]
LIFT = [                                            # C 5-8: the hook a minor third up, in G
    'b5/8. g6/16 f#6/8 d6/8 e6/4 d6/8 b5/8',        # 5 Gmaj9
    'd6/8 e6/8 b5/8 g5/8~ g5/2',                    # 6 Em9 A9    … chimes
    'c6/8. a6/16 g6/8 e6/8 f#6/4 e6/8 c6/8',        # 7 Cmaj9 D9
    'b5/8 c#6/8 a5/8 f#5/8~ f#5/2',                 # 8 B7sus4 B7 … xmas bells, gliss, fill → home
]


def swell(chords: str, nbars: int, low: int, high: int, v0: int, v1: int, group: int = 2) -> str:
    """Tremolo-string swell: two half-note chords per bar, velocity ramping v0 → v1 over each `group` bars."""
    g = parse_grid(chords, nbars, 4)
    out, prev = [], None
    steps = 2 * group
    for b, row in enumerate(g):
        toks = []
        for half in (0, 1):
            beat = Fr(2 * half)
            ch = next(c for st, ln, c in reversed(row) if st <= beat)
            vs = voice(ch, low, high, 'close', prev)
            prev = vs
            i = (b % group) * 2 + half
            v = round(v0 + (v1 - v0) * i / (steps - 1))
            toks.append('[' + ' '.join(name_of(p) for p in vs) + f']/2@v{v}')
        out.append(' '.join(toks))
    return ' | '.join(out)


def rise(chords: str, every: int = 2) -> str:
    """Harp glissando (8 × 32nd, chord tones) rising into every `every`-th bar line."""
    g = grid(chords)
    out = []
    for b in range(len(g)):
        if (b + 1) % every:
            out.append('r/1')
            continue
        ch = chord_at(g, 4 * b + 3)
        out.append('r/2. ' + gliss(ch.symbol, 64, 100, 8))
    return ' | '.join(out)


def answers(ch: str, kind: str) -> str:
    """One bar of chime answer in a melody hole (beats 3-4) on the chord sounding there."""
    from sakura_audio.theory import parse_chord
    c = parse_chord(ch)
    tones = sorted({p for p in range(79, 92) if p % 12 in c.tones})   # G5 … G6
    hi = [p for p in tones if p >= 83] or tones
    a, b = name_of(hi[0]), name_of(hi[min(2, len(hi) - 1)])
    if kind == 'tick':           # double tick on beat 3, a ring on beat 4
        return f'r/2 {b}/16! {b}/16 r/8 {a}/8 r/8'
    raise ValueError(kind)


def build() -> Song:
    s = Song(id='wishing', title='Wishing Envelope', bpm=104, meter=(4, 4), key='E',
             form=['intro', '|:', 'A', 'B', 'C', ':|'],
             mix={'echo': {'delay_ms': 240, 'feedback': 0.40, 'volume': 0.28, 'fir': 'soft'}},
             description='Recruit screen (base); the gacha envelope adds the riser stem. Sweet music-box pop; the '
                         'Bell is asked at the end of A and B, never answered.',
             extra={'lane': 'sweet',
                    'busy': {'melody': {'celesta': None, 'lead_chip': None, 'box': ['C']},
                             'bass': ['bass', 'bass_chip'], 'primary_bass': 'bass',
                             'cat': {'tink': 'answer', 'xmas': 'answer', 'glock': 'answer', 'pluck': 'stab',
                                     'pizz': 'stab', 'uke': 'comp', 'harp': 'arp', 'box': 'counter',
                                     'timp': 'perc', 'trem': 'pad', 'choir': 'pad', 'rise': 'arp',
                                     'timp_fill': 'perc'}}})
    for name, ch in SECTIONS:
        s.section(name, len(ch.split('|')), ch)

    # ================================================================ base: the tune
    cel = s.part('celesta', 'celesta', 'base', vel=4)
    cel.notes('A', bars(*TUNE_A), motifs={8: BELL}).notes('B', bars(*TUNE_B), motifs={8: BELL})
    cel.notes('C', bars('r/1', DIALOGUE[1], 'r/1', DIALOGUE[3], *LIFT))
    s.part('lead_chip', 'chip_bell', 'base', vel=-24).double('celesta', ['A', 'B']) \
        .notes('C', bars('r/1', 'r/1', 'r/1', 'r/1', *LIFT))
    box = s.part('box', 'music_box', 'base', vel=-10)
    box.notes('intro', bars('r/4 g6/8 b6/8 d7/4 e7/8 d7/8', 'r/1'))
    box.notes('B', bars(*DESCANT_B), motifs={8: BELL})
    box.notes('C', bars(DIALOGUE[0], 'r/1', DIALOGUE[2], 'r/1', *[x for x in LIFT]), vel=0)
    box.double('celesta', 'C', octave=1, vel=-14)   # (adds the lift an octave up; the dialogue bars are rests there)

    # ================================================================ base: answers ("melody — BAM")
    tink = s.part('tink', 'tinkle_bells', 'base', vel=-6)
    glock = s.part('glock', 'glock', 'base', vel=-14)
    xmas = s.part('xmas', 'xmas_bells', 'base', vel=-8)
    gA, gB, gC = grid(CH_A), grid(CH_B), grid(CH_C)
    for sec, g, bars_ in (('A', gA, (2, 6)), ('B', gB, (2, 6)), ('C', gC, (6,))):
        for b in bars_:
            tink.at(sec, b, answers(chord_at(g, 4 * (b - 1) + 2).symbol, 'tick'))
    glock.at('intro', 2, 'r/2 f#5/16 a5/16 b5/16 d#6/16 f#6/16 a6/16 b6/16 d#7/16')
    glock.at('A', 4, 'r/2 f#5/16 a5/16 b5/16 d#6/16 f#6/16 a6/16 b6/16 d#7/16')
    glock.at('B', 4, 'r/2 g#5/16 b5/16 c#6/16 e6/16 g#6/16 b6/16 c#7/16 e7/16')
    glock.at('C', 4, 'r/2 f#5/16 a5/16 c6/16 d6/16 f#6/16 a6/16 c7/16 d7/16')
    for sec in ('A', 'B', 'C'):                      # bar 8: B7 tones only — the Bell stays unanswered
        xmas.at(sec, 8, "r/2 r/8 f#6/8' b6/8' a6/8")
    xmas.at('intro', 1, '[g6 d7]/2 r/2')
    xmas.at('C', 5, '[g6 d7]/4 r/2.')                # the lift's downbeat sparkle
    pluck = s.part('pluck', 'harp', 'base', vel=6)   # low harp-pluck chord on beat 3 of every answer bar
    hit = 'r/2 x/8! r/8 r/4'
    pluck.notes('A', chordify(CH_A, {2: hit, 4: hit, 6: hit, 8: hit, 0: 'r/1'}, 55, 69))
    pluck.notes('B', chordify(CH_B, {2: hit, 4: hit, 6: hit, 8: hit, 0: 'r/1'}, 55, 69))
    pluck.notes('C', chordify(CH_C, {6: hit, 8: hit, 0: 'r/1'}, 55, 69))
    # bar-8 harp gliss up the B7 (beats 3-4, after the Bell / the turnaround), soft timpani under it
    gl = 'r/2 ' + gliss('B7', 59, 95, 16, '32')
    rise_b8 = s.part('gliss', 'harp', 'base', vel=-8)
    for sec in ('A', 'B', 'C'):
        rise_b8.at(sec, 8, gl)
    rise_b8.at('intro', 1, gliss('Cmaj9', 48, 84, 16, '32') + ' r/2')
    tf = s.part('timp_fill', 'timpani', 'base', vel=-26)
    for sec in ('A', 'B', 'C'):
        tf.at(sec, 8, 'r/2 b1/16 b1/16 b1/16 b1/16 f#2/8 r/8')

    # ================================================================ base: bed
    harp = s.part('harp', 'harp', 'base', vel=-18)
    harp.notes('intro', arp(CH_INTRO, '01234321', 52, 74, accent=1))
    harp.notes('A', arp(CH_A, '01234321', 52, 74, accent=1))
    harp.notes('B', arp(CH_B, '02132435', 52, 74, accent=1))
    harp.notes('C', bars(arp('Amaj9 | Cmaj9 | Amaj9 | Cmaj9 D9', '0123', 52, 74, step='8', accent=1),
                         arp('Gmaj9 | Em9 A9 | Cmaj9 D9 | B7sus4 B7', '01234321', 52, 74, accent=1)))
    bounce = "r/8 x2/8' r/8 x2/8' r/8 x2/8' r/8 x2/8'"
    pizz = s.part('pizz', 'pizz', 'base', vel=-12)
    pizz.notes('intro', chordify(CH_INTRO, {1: 'r/1', 2: bounce}, 55, 69))
    pizz.notes('A', chordify(CH_A, bounce, 55, 69)).notes('B', chordify(CH_B, bounce, 55, 69))
    pizz.notes('C', chordify(CH_C, {1: 'r/1', 2: 'r/1', 3: 'r/1', 4: 'r/1', 0: bounce}, 55, 69))
    uke = s.part('uke', 'ukulele', 'base', vel=-8)
    uke.notes('B', chordify(CH_B, "x/8! r/8 x/8 x/8? r/8 x/8? x/8 x/8?", 60, 72))

    # bass: a skipping fretless (octave skip on the 'a' of 1, chromatic approach into every chord); stepwise in B
    skip = 'R/8. 8/16 5/8 3/8~ 3/8 5/8 6/8 ap/8'
    skip_h = 'R/8. 8/16 5/8 ap/8'
    step = 'R/4 2/8 3/8 5/8 3/8 2/8 ap/8'
    step_h = 'R/8 5/8 3/8 ap/8'
    bass = s.part('bass', 'fretless', 'base', vel=-14)
    bass.notes('intro', 'c2/4. g2/8 c3/8 b2/8 g2/8 e2/8 | b1/8. b2/16 f#2/8 e2/8 b1/8 d#2/8 f#2/8 d#2/8')
    bass.notes('A', line(CH_A, skip, skip_h, nxt='C#m9'))
    bass.notes('B', line(CH_B, step, step_h, nxt='Amaj9'))
    bass.notes('C', bars(line('Amaj9 | Cmaj9 | Amaj9 | Cmaj9 D9', 'R/4. 5/8 8/4 5/8 ap/8', 'R/4. ap/8', nxt='G'),
                         line('Gmaj9 | Em9 A9 | Cmaj9 D9 | B7sus4 B7', skip, skip_h, nxt='E')))
    s.part('bass_chip', 'chip_triangle', 'base', octave=1, vel=-30).double('bass')

    # light kit: soft kick 1, 2&, 3; finger snaps 2 and 4; triangle on 4&; crash/splash on bars 1 and 5;
    # small fill in bar 4, a brush tom fill in bar 8; shaker 16ths throughout
    groove = 'k/8 r/8 fs/8 k/8 k/8 r/8 fs/8 tri/8 |'
    crash = 'k+c?/8 r/8 fs/8 k/8 k/8 r/8 fs/8 tri/8 |'
    small = 'k/8 r/8 fs/8 k/8 k/8 r/8 s?/16 s/16 t1?/16 t2/16 |'
    big = 'k/8 r/8 fs/8 k/8 s?/16 s/16 t1?/16 t1/16 t2?/16 t2/16 t3/16 t3/16 |'
    kit = s.part('kit', 'drums_brush', 'base', vel=-14)
    kit.notes('intro', 'r/2 r/4 r/8 tri/8 | ' + small)
    kit.pattern(['A', 'B'], groove, fills={1: crash, 4: small, 5: crash, 8: big})
    brk = 'r/4 fs/4 r/4 fs/8 tri/8 |'
    kit.notes('C', bars('sp?/4 fs/4 r/4 fs/8 tri/8', brk, brk, 'r/4 fs/4 s?/16 s/16 t1?/16 t2/16 s/16 s/16 t2/16 t3/16',
                        crash, groove, groove, big))
    shaker = s.part('shaker', 'drums_brush', 'base', vel=-34)
    shaker.pattern(['intro', 'A', 'B', 'C'], 'sh/16 sh?/16 sh/16 sh?/16 |')

    # ================================================================ riser (held breath; never new harmony)
    for name, ch in SECTIONS:
        n = len(ch.split('|'))
        s.part('trem', 'tremolo', 'riser').notes(name, swell(ch, n, 52, 71, 34, 100))
        s.part('choir', 'choir_ooh', 'riser').gen(name, 'pad:sustain', low=57, high=72, vel=58)
        s.part('timp', 'timpani', 'riser', vel=-10).notes(
            name, chordify(ch, 'R/16 R?/8. r/4 R/16 R?/8. r/4', 40, 60, root_low=40))
        s.part('rise', 'harp', 'riser', vel=-12).notes(name, rise(ch))
    # reverse cymbal: the sample peaks 1.35 s (2.34 beats at 104 bpm) after its start → peaks on every 2nd bar line
    s.part('revcym', 'rev_cymbal', 'riser', vel=-10).pattern(['intro', 'A', 'B', 'C'],
                                                             'r/1 | r/4. r/32 r/128 c4/2~ c4/16~ c4/64~ c4/128 |')
    return s


songs = [build()]
