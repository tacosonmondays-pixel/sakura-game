"""Leitmotifs shared by the whole soundtrack (docs/AUDIO.md §4.2). ORIGINAL material.

Offsets are semitones from the tonic of the requested octave; `question()` / `answer()` return DSL note
strings, e.g. BELL.question('F', 6) → 'c6/8 f6/8 d6/4 e6/4.' and BELL.answer('F', 6) → 'f6/2'.
"""
from sakura_audio.theory import Motif

# "Sakura Bell", the music-box motif: +5, −3, +2 (question ends on the leading tone), answer = the tonic.
BELL = Motif('BELL', major=(-5, 0, -3, -1), minor=(-5, 0, -4, -1), rhythm=('8', '8', '4', '4.'),
             answer_major=(0,), answer_minor=(0,), answer_rhythm=('2',),
             modes={'phrygian': ((-5, 0, -4, -2), (0,))})

# SENTINEL CALL: +5, +5, +2, −2 brass call to action (dotted-8th, 16th, quarter, 8th, dotted quarter): two rising
# fourths, a flick up a tone and back onto the held sus4. (Round 2: the third interval was −1 — two stacked fourths
# then a semitone dip is the gesture of a famous TV fanfare, so the flick now goes up.)
SENTINEL = Motif('SENTINEL', major=(-5, 0, 5, 7, 5), minor=(-5, 0, 5, 7, 5), rhythm=('8.', '16', '4', '8', '4.'))

# SHADOW (the monsters): +1, −1, +6, −3 — chromatic neighbour, then the tritone.
SHADOW = Motif('SHADOW', major=(0, 1, 0, 6, 3), minor=(0, 1, 0, 6, 3), rhythm=('16', '16', '8', '4', '4.'))

# The 4-note victory sting: BELL with its question already answered.
VICTORY_STING = Motif('BELL', major=(-5, 0, -3, 0), minor=(-5, 0, -4, 0), rhythm=('16', '16', '8', '4'))
