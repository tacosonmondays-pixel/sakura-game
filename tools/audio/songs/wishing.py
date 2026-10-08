"""'Wishing Envelope' — the recruit (gacha) screen; the `riser` stem swells in while the envelope is on screen.
ORIGINAL composition (docs/AUDIO.md §4.1 rules, §4.4 track list).

E major, 84 bpm, 4/4. Dreamy, sparkling, held breath. Stems: `base` (harp, celesta, music box, koto glissandi, halo pad,
fretless, a soft heartbeat kick) and `riser` (tremolo strings swelling every two bars, a timpani heartbeat,
a reverse cymbal peaking on every second bar line, choir "ooh").
The celesta rings the Sakura Bell as a QUESTION (B5–E6–C♯6–D♯6) at the end of bars 4, 8 and 16 and it is
never answered here: the gacha fanfares (gacha_r / gacha_sr / gacha_ssr) give the answer.
    intro  2 bars  harp alone on Emaj9 → B7sus4 (the curtain)
    A      8 bars  "the wish": a rising arpeggio to the major 7th, a gentle fall, rising higher, then the Bell
                   question; again with the chromatic minor-iv heart-tug (Amaj9 → Am6)
    B      8 bars  music box takes the tune: a yearning three-step rising sequence to the A6 peak, falls back
                   through F♯m9 – G♯m7 – A → Am6, and the Bell asks once more (celesta + music box together)
Form: intro |: A B :|  — 2 + 16 bars.

review: originality — new melody; the BELL motif is the project's own. Checked against well-known gacha /
summon / "wish" themes (Genshin, Blue Archive, Fate/GO, Arknights, Granblue) and dreamy game pieces
(Undertale/Deltarune, EarthBound/Mother, Kingdom Hearts, Final Fantasy prelude arpeggios): the harp arpeggio
bed is a generic idiom, the melody shares no hook or contour. Composer A, 2026-10-08.
"""
from fractions import Fraction as Fr

from sakura_audio.song import Song
from sakura_audio.theory import parse_grid, voice, name_of
from motifs import BELL
from _home import bars

CH_INTRO = 'Emaj9 | B7sus4'
CH_A = 'Emaj9 | C#m9 | Amaj9 | B7sus4 B7 | Emaj9 | G#m7 | Amaj9 Am6 | B7sus4 B7'
CH_B = 'C#m9 | B/D# | Emaj9 | Amaj9 | F#m9 | G#m7 | Amaj9 Am6 | B7sus4 B7'

Q = BELL.question('E', 6) + ' r/8'            # b5/8 e6/8 c#6/4 d#6/4. r/8 — never answered on this screen
TUNE_A = [
    'b4/8 e5/8 g#5/8 b5/8 d#6/2',             # 1 the wish rises to the major 7th
    'c#6/4. b5/8 g#5/2',                      # 2 and settles
    'a5/8 c#6/8 e6/8 g#6/8 f#6/2',            # 3 rises higher
    Q,                                        # 4 ⟨BELL⟩ question
    'b4/8 e5/8 g#5/8 b5/8 c#6/4. b5/8',       # 5
    'd#6/4. c#6/8 b5/2',                      # 6
    'a5/8 c#6/8 e6/4 c6/8 a5/8 f#5/4',        # 7 heart-tug: C♮ over Am6
    Q,                                        # 8 ⟨BELL⟩ question
]
TUNE_B = [
    'e6/4. d#6/8 c#6/4 g#5/4',                # 9  a three-step rising sequence …
    'f#6/4. e6/8 d#6/4 b5/4',                 # 10
    'g#6/4. f#6/8 e6/4 b5/4',                 # 11
    'a6/2 g#6/4 e6/4',                        # 12 … to the peak
    'f#6/4 c#6/8 e6/8~ e6/4 c#6/4',           # 13
    'd#6/4 b5/8 d#6/8~ d#6/4 b5/4',           # 14
    'c#6/4 a5/8 c#6/8 c6/4 a5/4',             # 15 heart-tug again
    Q,                                        # 16 ⟨BELL⟩ question, celesta + music box
]


def swell(chords: str, nbars: int, low: int, high: int, v0: int, v1: int, group: int = 2) -> str:
    """Tremolo-string swell: two half-note chords per bar, velocity ramping v0 → v1 over each `group` bars."""
    grid = parse_grid(chords, nbars, 4)
    out, prev = [], None
    steps = 2 * group
    for b, row in enumerate(grid):
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


def build() -> Song:
    s = Song(id='wishing', title='Wishing Envelope', bpm=84, meter=(4, 4), key='E',
             form=['intro', '|:', 'A', 'B', ':|'],
             mix={'echo': {'delay_ms': 256, 'feedback': 0.45, 'volume': 0.32, 'fir': 'soft'}},
             description='Recruit screen (base); the gacha envelope adds the riser stem. The Bell is asked, never answered.')
    s.section('intro', 2, CH_INTRO)
    s.section('A', 8, CH_A)
    s.section('B', 8, CH_B)

    # ================================================================ base
    s.part('harp', 'harp', 'base', vel=-10).gen(['intro', 'A', 'B'], 'arp:up16', low=52, high=76, vel=62)
    s.part('celesta', 'celesta', 'base').notes('A', bars(*TUNE_A), motifs={4: BELL, 8: BELL}).at('B', 8, Q, motif=BELL)
    s.part('box', 'music_box', 'base', vel=-4).notes('B', bars(*TUNE_B))
    s.part('bell_chip', 'chip_bell', 'base', vel=-34).at('A', 4, Q).at('A', 8, Q).at('B', 8, Q)
    s.part('koto', 'koto', 'base', vel=-16).at('B', 1, 'c#4/32 e4 f#4 g#4 b4 c#5 e5 f#5 g#5/4 r/2') \
        .at('intro', 2, 'r/2 b3/32 e4 f#4 g#4 b4 c#5 e5 f#5 b5/4')
    s.part('halo', 'pad_halo', 'base').gen(['A', 'B'], 'pad:sustain', low=56, high=74, vel=60)
    s.part('bass', 'fretless', 'base', vel=-26).notes('intro', 'e2/1 | b1/1') \
        .gen(['A', 'B'], 'bass:root', low=33, high=47)
    s.part('kit', 'drums', 'base', vel=-26).pattern(['A', 'B'], 'k/4 r/4 k?/4 r/4 | k/4 r/4 k?/4 r/8 k?/8 |') \
        .pattern(['A', 'B'], 'tri/2 r/2 | r/1 |')

    # ================================================================ riser (held breath)
    s.part('trem', 'tremolo', 'riser').notes('A', swell(CH_A, 8, 52, 71, 34, 96)).notes('B', swell(CH_B, 8, 52, 71, 40, 104))
    s.part('choir', 'choir_ooh', 'riser').gen(['A', 'B'], 'pad:sustain', low=57, high=72, vel=58)
    s.part('timp', 'timpani', 'riser', vel=-8).pattern(['A', 'B'], 'e2/16 e2?/8. r/4 e2?/16 e2?/8. r/4 |')
    # reverse cymbal: starts 1.875 beats before every second bar line and peaks on it (measured: 1.35 s at C4)
    s.part('revcym', 'rev_cymbal', 'riser', vel=-10).pattern(['A', 'B'], 'r/1 | r/2 r/32 c4/4.._~ c4/32 |')
    return s


songs = [build()]
