"""'Wishing Envelope' — the recruit (gacha) screen; the `riser` stem swells in while the envelope is on screen.
ORIGINAL composition (docs/AUDIO.md §4.1 rules; round-3 genre lane: SWEET — music-box pop with stuff going on).

E major, 104 bpm straight, 4/4. Stems: `base` (the recruit screen, complete on its own) and `riser` (the envelope:
held breath, never new harmony).
    base   celesta lead (a chip bell doubles it), harp 16th arpeggios, a pizzicato off-beat bounce, a skipping fretless
           bass (a chip triangle doubles it an octave up, for phone speakers), a light brush kit (soft kick on 1, 2&
           and 3, finger snaps on 2 and 4, triangle on 4&) over a 16th shaker; a music-box counter-line under the
           chorus; a ukulele strum in B. Every second bar the tune stops after beat 2 and the chimes answer it
           ("melody — BAM"): a tinkle-bell double tick above + a low harp-pluck chord on beat 3, a glock run up
           into bar 5, a harp glissando + Christmas bells + soft timpani + a brush tom fill in bar 8.
    riser  tremolo strings swelling every two bars, choir "ooh", a timpani heartbeat on the chord roots, a reverse
           cymbal peaking on every second bar line, a harp glissando rising into it.
The celesta rings the Sakura Bell as a QUESTION (B5–E6–C♯6–D♯6) at the end of A and of B, and it is never answered
here: the gacha fanfares (gacha_r / gacha_sr / gacha_ssr, new_student) give the answer.
    intro  2 bars  the curtain: C (the ♭VI) harp glissando and music-box twinkle, B7 with a glock run into …
    A      8 bars  "the wish": a skipping 2-bar hook (dotted 8th + 16th lift), answered by the chimes; the lydian
                   ♯11 over A in bar 3, the chromatic minor iv (F♯m9 → Am6) in bar 7, the Bell question in bar 8
    B      8 bars  the chorus, higher: a repeated-note push over C♯m9 – G♯m7 – A – E/G♯ – F♯m9 – C♯7, ukulele strum,
                   the bass walks stepwise, the music box sings a counter-line under it and joins the Bell question
    C      8 bars  sparkle break (no kick, no pizz, 8th harp): the bells ask and the fretless bass answers, one bar
                   each (music box, bass, celesta, bass running up), then the LIFT: the hook a minor third up in
                   G major with the whole band, the music box an octave above; B7sus4 → B7 takes it home
Form: intro |: A B C :|  — 2 + 24 bars (55.4 s loop).

Taste rules (r3 study/taste.md, sweet lane): bass 7 notes a bar in A and the lift (octave skip on the "a" of 1, a
held third where the kick plays alone on beat 3, a chromatic approach into every chord change), stepwise in B, two
bass solo bars in C; melody in 2-bar cells with beats 3-4 of the second bar open and answered from the base stem;
harp 16ths + shaker 16ths keep something moving on every 16th; music-box counter-line (8 bars) and the C dialogue;
fills in bars 4 and 8, crash/splash on 1 and 5; breakdown + dialogue + lift in C; 1.46 chords a bar.

review: originality — the hook, the chorus line, the counter-line, the dialogue and the bass lines are new; the BELL
motif is the project's own. Checked against well-known gacha / summon / "wish" themes, music-box and
lullaby classics, kawaii-pop and future-bass hooks and cosy console and indie game tunes: the harp arpeggio bed and ukulele strum are generic idioms,
the melodies share no hook or contour. `studio.py originality`: no blocklist match. Composer B4, 2026-10-13 (round 3).
"""
from fractions import Fraction as Fr

from sakura_audio.song import Song
from sakura_audio.theory import parse_grid, parse_chord, voice, name_of
from motifs import BELL
from _home import bars
from _sweet import line, chordify, arp, gliss, grid, chord_at

CH_INTRO = 'Cmaj9 | B7sus4 B7'
CH_A = 'Emaj9 | C#m7 | Amaj9 | B7sus4 B7 | Emaj9 G#m7 | C#m9 | F#m9 Am6 | B7sus4 B7'
CH_B = 'C#m9 | G#m7 | Amaj9 | E/G# | F#m9 | G#m7 C#7 | F#m9 Am6 | B7sus4 B7'
CH_C = 'Amaj9 | Cmaj9 | Amaj9 | Cmaj9 D9 | Gmaj9 | Em9 A9 | Cmaj9 D9 | B7sus4 B7'
SECTIONS = [('intro', CH_INTRO), ('A', CH_A), ('B', CH_B), ('C', CH_C)]

Q = BELL.question('E', 6, rhythm=('8', '8', '4', '4.')) + ' r/8'      # b5/8 e6/8 c#6/4 d#6/4. r/8 — never answered
TUNE_A = [
    'g#5/8. e6/16 d#6/8 b5/8 c#6/4 b5/8 g#5/8',     # 1 Emaj9     the skipping hook
    'b5/8 c#6/8 g#5/8 e5/8~ e5/2',                  # 2 C♯m7      … stops: chimes answer (no 9th under the held E)
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
    'd#6/4 f#6/8 e#6/8~ e#6/2',                     # 6 G♯m7 C♯7  E♯ = the third of C♯7 … chimes
    'f#6/8 a6/8 g#6/8 e6/8 c6/8 e6/8 a6/8 f#6/8',   # 7 F♯m9 Am6
    Q,                                              # 8 ⟨BELL⟩ question, celesta + music box
]
COUNTER_B = [                                       # music box under the chorus: moves where the tune holds
    'e5/2 d#5/4 c#5/4',                             # 1 C♯m9
    'b4/2 d#5/8 f#5/8 g#5/4',                       # 2 G♯m7      rising in the hole
    'c#5/2 b4/4 e5/4',                              # 3 Amaj9
    'g#4/2 b4/8 c#5/8 e5/4',                        # 4 E/G♯
    'f#5/2 e5/4 c#5/4',                             # 5 F♯m9
    'd#5/2 g#5/8 b5/8 c#6/4',                       # 6 G♯m7 C♯7
    'c#5/2 c5/2',                                   # 7 F♯m9 Am6  C♯ → C♮ under the heart-tug
    BELL.question('E', 5, rhythm=('8', '8', '4', '4.')) + ' r/8',   # 8 ⟨BELL⟩ an octave under the celesta
]
# C 1-4: the bells ask, the fretless bass answers (one bar each)
ASK_BOX = 'c#6/16 e6/16 a6/16 b6/16 c#7/8 b6/8 g#6/4 r/4'          # 1 Amaj9   music box
ASK_CEL = 'e6/16 g#6/16 b6/16 c#7/16 e7/8 c#7/8 b6/4 r/4'          # 3 Amaj9   celesta, higher
BASS_C = [
    'a1/4. e2/8 a2/4 r/8 b1/8',                                    # 1 Amaj9   (soft, under the box)
    'c2/8 g2/16 b2/16 d3/8 e3/8~ e3/8 d3/16 b2/16 g2/8 f#2/16 g#2/16',   # 2 Cmaj9  the bass answers
    'a2/4. e2/8 a1/4 r/8 b1/8',                                    # 3 Amaj9
    'c2/8 e2/16 g2/16 b2/8 c3/8 d2/8 f#2/16 a2/16 c3/16 b2/16 a2/16 f#2/16',   # 4 Cmaj9 D9 runs up into G
]
LIFT = [                                            # C 5-8: the hook a minor third up, in G
    'b5/8. g6/16 f#6/8 d6/8 e6/4 d6/8 b5/8',        # 5 Gmaj9
    'd6/8 e6/8 b5/8 g5/8~ g5/2',                    # 6 Em9 A9    … chimes
    'c6/8. a6/16 g6/8 e6/8 f#6/4 e6/8 c6/8',        # 7 Cmaj9 D9
    'b5/8 c#6/8 a5/8 f#5/8~ f#5/2',                 # 8 B7sus4 B7 … Christmas bells, gliss, fill → home
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


def tick(chords: str, bar: int) -> str:
    """One bar of chime answer in a melody hole: a double tick on beat 3 and a ring on beat 4, chord tones of the
    chord sounding on beat 3, in octave 6-7 (above the held tune note)."""
    c = chord_at(grid(chords), 4 * (bar - 1) + 2)
    tones = sorted(p for p in range(88, 101) if p % 12 in c.tones)          # E6 … E7
    a, b = name_of(tones[0]), name_of(tones[min(2, len(tones) - 1)])
    return f"r/2 {b}/16! {b}/16 r/8 {a}/8' r/8"


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
                                     'pizz': 'comp', 'uke': 'comp', 'harp': 'arp', 'box': 'counter',
                                     'gliss': 'answer', 'timp_fill': 'perc', 'timp': 'perc', 'trem': 'pad',
                                     'choir': 'pad', 'rise': 'arp'}}})
    for name, ch in SECTIONS:
        s.section(name, len(ch.split('|')), ch)

    # ================================================================ base: the tune
    cel = s.part('celesta', 'celesta', 'base', vel=4, gain=3)
    cel.notes('A', bars(*TUNE_A), motifs={8: BELL}).notes('B', bars(*TUNE_B), motifs={8: BELL})
    cel.notes('C', bars('r/1', 'r/1', ASK_CEL, 'r/1', *LIFT))
    s.part('lead_chip', 'chip_bell', 'base', vel=-24, gain=2).double('celesta', ['A', 'B', 'C'])
    box = s.part('box', 'music_box', 'base', vel=-6, gain=1)
    box.notes('intro', bars('r/4 g6/8 b6/8 d7/4 e7/8 d7/8', 'r/1'))
    box.notes('B', bars(*COUNTER_B), motifs={8: BELL})
    box.notes('C', bars(ASK_BOX, 'r/1', 'r/1', 'r/1', 'r/1', 'r/1', 'r/1', 'r/1'), vel=6)
    s.part('box_lift', 'music_box', 'base', octave=1, vel=-20).notes('C', bars('r/1', 'r/1', 'r/1', 'r/1', *LIFT))

    # ================================================================ base: answers ("melody — BAM")
    tink = s.part('tink', 'tinkle_bells', 'base', vel=-4, gain=2)
    for sec, ch, bars_ in (('A', CH_A, (2, 6)), ('B', CH_B, (2, 6)), ('C', CH_C, (6,))):
        for b in bars_:
            tink.at(sec, b, tick(ch, b))
    tink.at('C', 2, "r/2 g6/16! g6/16 r/8 e6/8' r/8")          # under the bass solo: a tick on the C chord
    glock = s.part('glock', 'glock', 'base', vel=-14, gain=3)
    glock.at('intro', 2, 'r/2 f#5/16 a5/16 b5/16 d#6/16 f#6/16 a6/16 b6/16 d#7/16')
    glock.at('A', 4, 'r/2 f#5/16 a5/16 b5/16 d#6/16 f#6/16 a6/16 b6/16 d#7/16')
    glock.at('B', 4, 'r/2 g#5/16 b5/16 c#6/16 e6/16 g#6/16 b6/16 c#7/16 e7/16')
    glock.at('C', 4, 'r/2 f#5/16 a5/16 c6/16 d6/16 f#6/16 a6/16 c7/16 d7/16')
    xmas = s.part('xmas', 'xmas_bells', 'base', vel=-8)
    for sec in ('A', 'B', 'C'):                      # bar 8: B7 tones only — the Bell stays unanswered
        xmas.at(sec, 8, "r/2 r/8 f#6/8' b6/8' a6/8")
    xmas.at('intro', 1, '[g6 d7]/2 r/2')
    xmas.at('C', 5, '[g6 d7]/4 r/2.')                # the lift's downbeat sparkle
    pluck = s.part('pluck', 'harp', 'base', vel=8, gain=-8)   # low harp-pluck chord on beat 3 of every answer bar
    hit = 'r/2 x/8! r/8 r/4'
    pluck.notes('A', chordify(CH_A, {2: hit, 4: hit, 6: hit, 8: hit, 0: 'r/1'}, 55, 69, style='rootless'))
    pluck.notes('B', chordify(CH_B, {2: hit, 4: hit, 6: hit, 8: hit, 0: 'r/1'}, 55, 69, style='rootless'))
    pluck.notes('C', chordify(CH_C, {2: hit, 6: hit, 8: hit, 0: 'r/1'}, 55, 69, style='rootless'))
    gl = s.part('gliss', 'harp', 'base', vel=-8, gain=-7)     # bar-8 harp gliss up the B7 (beats 3-4), soft timpani under it
    for sec in ('A', 'B', 'C'):
        gl.at(sec, 8, 'r/2 ' + gliss('B7', 54, 99, 16, '32'))
    gl.at('intro', 1, gliss('Cmaj9', 48, 84, 16, '32') + ' r/2')
    tf = s.part('timp_fill', 'timpani', 'base', vel=-26, gain=-6)
    for sec in ('A', 'B', 'C'):
        tf.at(sec, 8, 'r/2 b1/16 b1/16 b1/16 b1/16 f#2/8 r/8')

    # ================================================================ base: bed
    harp = s.part('harp', 'harp', 'base', vel=-18, gain=-4)
    harp.notes('intro', arp(CH_INTRO, '01234321', 57, 79, accent=1))
    harp.notes('A', arp(CH_A, '01234321', 57, 79, accent=1))
    harp.notes('B', arp(CH_B, '02132435', 57, 79, accent=1))
    harp.notes('C', bars(arp('Amaj9 | Cmaj9 | Amaj9 | Cmaj9 D9', '0123', 57, 79, step='8', accent=1),
                         arp('Gmaj9 | Em9 A9 | Cmaj9 D9 | B7sus4 B7', '01234321', 57, 79, accent=1)))
    bounce = "r/8 x2/8' r/8 x2/8' r/8 x2/8' r/8 x2/8'"
    pizz = s.part('pizz', 'pizz', 'base', vel=-12)
    pizz.notes('intro', chordify(CH_INTRO, {1: 'r/1', 2: bounce}, 55, 69, style='rootless'))
    pizz.notes('A', chordify(CH_A, bounce, 55, 69, style='rootless'))
    pizz.notes('B', chordify(CH_B, bounce, 55, 69, style='rootless'))
    pizz.notes('C', chordify(CH_C, {1: 'r/1', 2: 'r/1', 3: 'r/1', 4: 'r/1', 0: bounce}, 55, 69, style='rootless'))
    uke = s.part('uke', 'ukulele', 'base', vel=-8)
    strum = "x/8! r/8 x/8 x/8? r/8 x/8? x/8 x/8?"
    uke.notes('B', chordify(CH_B, strum, 60, 72, style='rootless'))
    uke.notes('C', chordify(CH_C, {1: 'r/1', 2: 'r/1', 3: 'r/1', 4: 'r/1', 0: strum}, 60, 72, style='rootless'))

    # bass: a skipping fretless (octave skip on the 'a' of 1, the third held over beat 3 where the kick plays alone,
    # a chromatic approach into every chord change); stepwise in B; two answering solo bars in C
    skip = {0: 'R/8. 8/16 5/8 3/8~ 3/8 5/8 6/8 ap/8', 2: 'R/8. 8/16 5/8 3/8~ 3/8 5/8 7/8 ap/8',
            6: 'R/8. 8/16 5/8 3/8~ 3/8 5/8 7/8 ap/8'}            # minor bars (C♯m9) take the ♭7, not the 6th
    skip_h = 'R/8. 8/16 5/8 ap/8'
    step = 'R/4 2/8 3/8 5/8 3/8 2/8 ap/8'
    step_h = 'R/8 5/8 3/8 ap/8'
    bass = s.part('bass', 'fretless', 'base', vel=-12, gain=-2)
    bass.notes('intro', 'c2/4. g2/8 c3/8 b2/8 g2/8 e2/8 | b1/8. b2/16 f#2/8 e2/8 b1/8 d#2/8 f#2/8 d#2/8')
    bass.notes('A', line(CH_A, skip, skip_h, nxt='C#m9'))
    bass.notes('B', line(CH_B, step, step_h, nxt='Amaj9'))
    bass.notes('C', bars(*BASS_C, line('Gmaj9 | Em9 A9 | Cmaj9 D9 | B7sus4 B7',
                                       {0: 'R/8. 8/16 5/8 3/8~ 3/8 5/8 6/8 ap/8'}, skip_h, nxt='Emaj9')))
    s.part('bass_chip', 'chip_triangle', 'base', octave=1, vel=-30).double('bass')

    # light kit: soft kick 1, 2&, 3; finger snaps 2 and 4; triangle on 4&; crash/splash on bars 1 and 5;
    # small fill in bar 4, a brush tom fill in bar 8; shaker 16ths throughout
    groove = 'k/8 r/8 fs/8 k/8 k/8 r/8 fs/8 tri/8 |'
    crash = 'k+c?/8 r/8 fs/8 k/8 k/8 r/8 fs/8 tri/8 |'
    splash = 'k+sp?/8 r/8 fs/8 k/8 k/8 r/8 fs/8 tri/8 |'
    small = 'k/8 r/8 fs/8 k/8 k/8 r/8 s?/16 s/16 t1?/16 t2/16 |'
    big = 'k/8 r/8 fs/8 k/8 s?/16 s/16 t1?/16 t1/16 t2?/16 t2/16 t3/16 t3/16 |'
    kit = s.part('kit', 'drums_brush', 'base', vel=-14, gain=1)
    kit.notes('intro', 'r/2 r/4 r/8 tri/8 | ' + small)
    kit.pattern(['A', 'B'], groove, fills={1: crash, 4: small, 5: splash, 8: big})
    brk = 'r/4 fs/4 r/4 fs/8 tri/8 |'
    kit.notes('C', bars('sp?/4 fs/4 r/4 fs/8 tri/8', brk, brk, 'r/4 fs/4 s?/16 s/16 t1?/16 t2/16 s/16 s/16 t2/16 t3/16',
                        crash, groove, groove, big))
    shaker = s.part('shaker', 'drums_brush', 'base', vel=-34, gain=9)
    shaker.pattern(['intro', 'A', 'B', 'C'], '(sh/16 sh?/16 sh/16 sh?/16)x4 |')

    # ================================================================ riser (held breath; never new harmony)
    trem = s.part('trem', 'tremolo', 'riser', gain=4)
    choir = s.part('choir', 'choir_ooh', 'riser', gain=4)
    timp = s.part('timp', 'timpani', 'riser', vel=-10, gain=2)
    rs = s.part('rise', 'harp', 'riser', vel=-12)
    for name, ch in SECTIONS:
        n = len(ch.split('|'))
        trem.notes(name, swell(ch, n, 52, 71, 34, 100))
        choir.gen(name, 'pad:sustain', low=57, high=72, vel=58)
        timp.notes(name, chordify(ch, 'R/16 R/8.? r/4 R/16 R/8.? r/4', 40, 60, root_low=40))
        rs.notes(name, rise(ch))
    # reverse cymbal: the sample peaks 1.35 s (2.34 beats at 104 bpm) after its start → peaks 20 ms before every 2nd bar line
    s.part('revcym', 'rev_cymbal', 'riser', vel=-10, gain=5).pattern(['intro', 'A', 'B', 'C'],
                                                             'r/1 | r/4. r/32 c4/2~ c4/16~ c4/32 |')
    return s


songs = [build()]
