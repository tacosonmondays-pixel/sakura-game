"""Home-side jingles: victory, defeat, level-up. ORIGINAL compositions (docs/AUDIO.md §4.1 rules, §4.3, §4.4).

victory  132 bpm, F   The 4-note victory sting (C5 F5 D5 F5 — the Sakura Bell with its question already answered),
                      then a ♭VI–♭VII–I brass cadence D♭ → E♭ (pushed an eighth early) → F(add9), top line
                      F5 → G5 → A5, over a reverse-cymbal swell that peaks on the F; chip arpeggio sparkle, and the
                      music box rings the whole Bell, question AND answer, as the chord rings out.
defeat   108 bpm, Fm  The Bell's question collapses in F minor on the music box (C5–F5–D♭5–C5), slowing down in
                      written-out note values over Fm(add9) → D♭ → B♭m6 → Fm; strings and harp underneath; a soft low
                      piano "pa-dum" closes it. Gentle, not crushing: the results screen encourages.
levelup  150 bpm, A♭  The Bell in 16ths on the 12.5 % chip pulse, E♭6–A♭6–F6–G6 → A♭6 (answered — a little
                      triumph), a glock shimmer and a triangle ping. Plays over the menus (ducked), a playful lift.

review: originality — every line is built from the project's BELL motif; the ♭VI–♭VII–I cadence is a generic
idiom, written here with its own rhythm (no triplet pickups, pushed ♭VII). Checked against Final Fantasy,
Dragon Quest, Mario, Zelda, Pokémon, EarthBound/Mother, Undertale/Deltarune victory / level-up / game-over
jingles: no shared hook. Composer A, 2026-10-08.
"""
from sakura_audio.song import Song
from motifs import BELL, VICTORY_STING
from _home import crescendo


def victory() -> Song:
    s = Song(id='victory', title='Victory!', bpm=132, meter=(4, 4), key='F', form=['V'], bus='jingle', tail=2.5,
             mix={'echo': {'delay_ms': 192, 'feedback': 0.38, 'volume': 0.26}},
             description='Battle won: victory sting → ♭VI–♭VII–I brass cadence → the Bell answered on the music box.')
    s.section('V', 3)
    sting = VICTORY_STING.question('F', 5)                       # c5/16 f5/16 d5/8 f5/4
    lead = f'{sting} f5/4. g5/8 | a5/1 | r/1'
    s.part('lead', 'chip_pulse25', 'full').notes('V', lead, motifs={1: VICTORY_STING})
    s.part('tpt', 'trumpet', 'full', vel=4).notes('V', lead)
    s.part('glock', 'glock', 'full', octave=1, vel=-20).notes('V', lead)
    s.part('brass', 'brass', 'full', vel=4).notes('V', 'r/2 [db4 ab4 db5]/4. [eb4 bb4 eb5]/8 | [f4 c5 g5]/1 | r/1')
    s.part('bones', 'trombone', 'full', vel=-18).notes('V', 'r/2 [f3 ab3]/4. [g3 bb3]/8 | [a3 c4]/1 | r/1')
    s.part('tuba', 'tuba', 'full').notes('V', 'r/2 db2/4. eb2/8 | f2/1 | r/1')
    s.part('timp', 'timpani', 'full').notes('V', 'r/2 db2/4. eb2/8 | f2/4 r/2. | r/1')
    s.part('kit', 'drums', 'full', vel=-6).notes('V', 'k/8 r/8 s/16 s? s s? ' + crescendo('s', '16', 8, 50, 104) + ' | k+c/1 | r/1')
    s.part('swell', 'rev_cymbal', 'full', vel=-12).notes('V', 'r/4 c4/2._ | r/1 | r/1')      # peaks on the F downbeat
    s.part('sparkle', 'chip_pulse12', 'full', vel=-26).notes('V', 'r/1 | (f6/16 a6/16 c7/16 g6/16)x4 | r/1')
    s.part('strings', 'strings', 'full', vel=-20).notes('V', 'r/2 [ab4 db5 f5]/4. [bb4 eb5 g5]/8 | [a4 c5 f5 g5]/1 | r/1')
    s.part('box', 'music_box', 'full', vel=2).notes('V', 'r/1 | r/2 c6/8 f6/8 d6/8 e6/8 | f6/2 r/2', motifs={2: BELL})
    return s


def defeat() -> Song:
    s = Song(id='defeat', title='Petals Fall', bpm=108, meter=(4, 4), key='Fm', form=['D'], bus='jingle', tail=3.0,
             mix={'echo': {'delay_ms': 240, 'feedback': 0.42, 'volume': 0.30}},
             description='Battle lost: the Bell question collapses in F minor, slowing down; a soft piano pa-dum.')
    s.section('D', 3)
    s.part('box', 'music_box', 'full', vel=4).notes('D', 'c5/8 f5/8 db5/4 c5/2 | bb4/4. ab4/8 g4/4 bb4/4 | c5/2 r/2',
                                                     motifs={1: BELL})
    s.part('celesta', 'celesta', 'full', octave=-1, vel=-24).notes('D', 'c5/8 f5/8 db5/4 c5/2 | bb4/4. ab4/8 g4/4 bb4/4 | c5/2 r/2')
    s.part('strings', 'strings_slow', 'full', vel=-20).notes('D', '[f4 g4 ab4 c5]/1 | [f4 ab4 db5]/2 [f4 g4 bb4 db5]/2 | [f4 ab4 c5]/2 r/2')
    s.part('harp', 'harp', 'full', vel=-26).notes('D', 'f3/8 c4/8 g4/8 ab4/8 c5/8 ab4/8 g4/8 c4/8 | '
                                                       'db3/8 ab3/8 db4/8 f4/8 bb2/8 f3/8 db4/8 g4/8 | f3/2 r/2')
    s.part('bass', 'fretless', 'full', vel=-18).notes('D', 'f2/1 | db2/2 bb1/2 | f1/2 r/2')
    s.part('piano', 'piano', 'full', vel=-4).notes('D', 'r/1 | r/1 | r/2 c2/8 r/8 f1/4')        # "pa-dum"
    return s


def levelup() -> Song:
    s = Song(id='levelup', title='Level Up!', bpm=150, meter=(4, 4), key='Ab', form=['L'], bus='jingle', tail=1.2,
             mix={'echo': {'delay_ms': 160, 'feedback': 0.32, 'volume': 0.24}},
             description='Student level-up in the menus: the Bell in 16ths on the chip pulse, answered.')
    s.section('L', 1)
    bell16 = BELL.question('Ab', 6, rhythm=('16', '16', '16', '16'))       # eb6 ab6 f6 g6
    s.part('lead', 'chip_pulse12', 'full').notes('L', f'{bell16} ab6/4 r/2', motifs={1: BELL})
    s.part('glock', 'glock', 'full', vel=-6).notes('L', 'r/4 ab6/32 c7/32 ab6/32 c7/32 ab6/32 c7/32 ab6/32 c7/32 r/2')
    s.part('chord', 'harp', 'full', vel=-28).notes('L', 'r/4 [ab4 c5 eb5 ab5]/4 r/2')
    s.part('bass', 'chip_triangle', 'full', vel=-20).notes('L', 'r/4 ab3/4 r/2')
    s.part('kit', 'drums', 'full', vel=-20).notes('L', 'r/4 tri/4 r/2')
    return s


songs = [victory(), defeat(), levelup()]
