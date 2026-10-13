"""Gacha reveal fanfares: gacha_r, gacha_sr, gacha_ssr. ORIGINAL compositions (docs/AUDIO.md §4.1, §4.4, §5.7).

They play once, on the best rarity of a pull, over the 'Wishing Envelope' music (E major, ducked), and they
finally ANSWER the Sakura Bell that the recruit screen keeps asking (B5–E6–C♯6–D♯6 → E6).
    gacha_r    120 bpm, E   ~1 s   the soft answer: a celesta E6 with a chip-bell blip an octave up, and on the "and"
                                   of 2 a harp E(add9) chord + a glock double tick answering it (B6 B6 → E7)
                                   (round 3, B4: the harp chord and the glock answer added)
    gacha_sr   120 bpm, E   ~2.2 s harp glissando up E major, glock answers D♯6 → E6 over an E(add9) chord
    gacha_ssr  120 bpm, E→G ~5.5 s orchestra hit on E, a timpani roll on D lifts the key to G; the brass ring the
                                   Bell in G (D5–G5–E5–F♯5) and hold the answer G5 with choir "ahh", strings, a
                                   reverse cymbal into the crash, chip sparkle and the music box answering too

review: originality — built only from the project's BELL motif and generic fanfare gestures (gliss, hit, roll,
held chord). Checked against gacha / summon fanfares of Genshin, Blue Archive, Fate/GO, Arknights, Granblue,
Pokémon item-get and Zelda item-get jingles: no shared hook. Composer A, 2026-10-08; gacha_r layers B4, 2026-10-13.
"""
from sakura_audio.song import Song
from motifs import BELL
from _home import crescendo


def gacha_r() -> Song:
    s = Song(id='gacha_r', title='Gacha — R', bpm=120, meter=(4, 4), key='E', form=['R'], bus='jingle', lufs=-18.0,
             tail=1.0, mix={'echo': {'delay_ms': 224, 'feedback': 0.40, 'volume': 0.30}},
             description='Best pull is R: the Bell answered softly (celesta E6 + chip blip).')
    s.section('R', 1)
    s.part('celesta', 'celesta', 'full').notes('R', 'r/64 e6/2 r/4.. r/32 r/64', motifs={1: BELL})
    s.part('box', 'music_box', 'full', vel=-16).notes('R', 'r/64 e6/2 r/4.. r/32 r/64')
    s.part('blip', 'chip_bell', 'full', vel=-24).notes('R', "r/64 e7/16' r/16 b6/16' r/16 r/4 r/4.. r/32 r/64")
    s.part('pad', 'pad_halo', 'full', vel=-20).notes('R', 'r/64 [e4 g#4 b4]/2 r/4.. r/32 r/64')
    # round 3: on the "and" of 2 the harp rolls an E(add9) chord and the glock answers the answer (B6 B6 → E7)
    s.part('harp', 'harp', 'full', vel=-24).notes('R', 'r/64 r/4. [e3 b3 e4 f#4 g#4 b4]/4 r/4 r/16 r/32 r/64')
    s.part('glock', 'glock', 'full', vel=-14).notes('R', 'r/64 r/4. b6/16 b6/16? e7/4 r/8.. r/64')
    s.part('kit', 'drums', 'full', vel=-30).notes('R', 'r/64 tri+sp/4 r/2 r/8.. r/64')
    return s


def gacha_sr() -> Song:
    s = Song(id='gacha_sr', title='Gacha — SR', bpm=120, meter=(4, 4), key='E', form=['S'], bus='jingle', tail=2.0,
             mix={'echo': {'delay_ms': 224, 'feedback': 0.40, 'volume': 0.30}},
             description='Best pull is SR: harp glissando, glock answers D♯6 → E6, E(add9).')
    s.section('S', 2)
    gliss = 'e4/32 f#4 g#4 b4 c#5 e5 f#5 g#5 b5 c#6 e6 f#6 g#6 b6 c#7 e7'          # 16 × 1/32 = 2 beats
    s.part('harp', 'harp', 'full', vel=-26).notes('S', f'{gliss} [e3 b3 e4 g#4]/2 | r/1')
    s.part('glock', 'glock', 'full', vel=6).notes('S', 'r/4 r/8 d#6/8 e6/2 | r/1', motifs={1: BELL})
    s.part('celesta', 'celesta', 'full', vel=8).notes('S', 'r/4 r/8 d#6/8 e6/2 | r/1')
    s.part('box', 'music_box', 'full', vel=-6).notes('S', 'r/4 r/8 d#6/8 e6/2 | r/1')
    s.part('chord', 'strings_slow', 'full', vel=-4).notes('S', 'r/2 [e4 g#4 b4 f#5]/2_ | r/1')
    s.part('pad', 'pad_halo', 'full', vel=-12).notes('S', 'r/2 [e4 b4 f#5]/2_ | r/1')
    s.part('sparkle', 'chip_pulse12', 'full', vel=-30).notes('S', 'r/2 (e6/32 g#6/32 b6/32 f#6/32)x4 | r/1')
    s.part('kit', 'drums', 'full', vel=-24).notes('S', 'r/2 tri/2 | r/1')
    return s


def gacha_ssr() -> Song:
    s = Song(id='gacha_ssr', title='Gacha — SSR', bpm=120, meter=(4, 4), key='G', form=['X'], bus='jingle', tail=2.5,
             mix={'echo': {'delay_ms': 208, 'feedback': 0.40, 'volume': 0.28}},
             description='SSR showcase: orchestra hit on E, timpani lift to G, brass Bell in G answered and held.')
    s.section('X', 3)
    q = BELL.question('G', 5)                                     # d5/8 g5/8 e5/4 f#5/4.
    s.part('hit', 'orch_hit', 'full', vel=8).notes('X', '[e3 b3 e4 g#4]/4 r/2. | r/1 | [g3 d4 g4 b4]/4 r/2.')
    s.part('timp', 'timpani', 'full').notes('X', 'e2/4@v118 ' + crescendo('d2', '16', 12, 40, 108) + ' | d2/4 r/2. | g2/4@v118 r/2.')
    # reverse cymbal: the sample peaks 1.35 s (2.7 beats) after its start → starts at beat 1.3125, peaks on the G
    s.part('swell', 'rev_cymbal', 'full', vel=-6).notes('X', 'r/1 | r/4 r/16 r/64 c4/2_~ c4/8~ c4/32~ c4/64 | r/1')
    s.part('brass', 'brass', 'full', vel=18).notes('X', f'r/1 | {q} r/8 | g5/1', motifs={2: BELL})
    s.part('tpt', 'trumpet', 'full', vel=12).notes('X', f'r/1 | {q} r/8 | g5/1')
    s.part('horns', 'horn', 'full', vel=-20).notes('X', 'r/1 | r/1 | [d4 g4 b4]/1')
    s.part('choir', 'choir_ahh', 'full', vel=4).notes('X', 'r/1 | [e4 g4 c5]/2 [f#4 a4 d5]/2 | [g4 b4 d5 a5]/1')
    s.part('strings', 'strings', 'full', vel=-14).notes('X', '[e4 g#4 b4]/4 [d4 f#4 a4 c5]/2. | [c4 e4 g4]/2 [d4 f#4 a4 c5]/2 | [g3 d4 g4 b4]/1')
    s.part('bass', 'tuba', 'full', vel=-4).notes('X', 'e2/4 d2/2. | c2/2 d2/2 | g1/1')
    s.part('kit', 'drums', 'full', vel=-4).notes('X', 'k+c/4 r/2. | k/4 r/4 ' + crescendo('s', '16', 8, 46, 104) + ' | k+c/1')
    s.part('sparkle', 'chip_pulse12', 'full', vel=-28).notes('X', 'r/1 | r/1 | (g6/16 b6/16 d7/16 a6/16)x4')
    s.part('box', 'music_box', 'full', vel=-2).notes('X', 'r/1 | r/1 | r/4 d6/8 g6/8 e6/8 f#6/8 g6/4')
    return s


songs = [gacha_r(), gacha_sr(), gacha_ssr()]
