"""Well-known folders of the audio toolkit (all relative to this file, so it runs from any cwd)."""
from pathlib import Path
import os

TOOLS = Path(__file__).resolve().parents[1]          # tools/audio
REPO = TOOLS.parents[1]                              # repository root
CACHE = TOOLS / 'cache'                              # fetched / generated soundfonts (gitignored)
SF2_CACHE = CACHE / 'sf2'
BUILD = TOOLS / 'build'                              # renders, MIDI, review output (gitignored)
PRIVATE = Path(os.environ.get('SAKURA_PRIVATE_SF2') or (TOOLS / 'private'))   # owner's private fonts (gitignored)
SONGS = TOOLS / 'songs'
PALETTES = TOOLS / 'palettes'
PUBLIC_AUDIO = REPO / 'public' / 'audio'
PUBLIC_MUSIC = PUBLIC_AUDIO / 'music'
PUBLIC_SFX = PUBLIC_AUDIO / 'sfx'

FLUIDSYNTH = os.environ.get('FLUIDSYNTH', 'fluidsynth')
FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
