"""Sakura Sentinels offline audio toolkit: song DSL → MIDI → FluidSynth stems → SNES-style mix → web audio.

See docs/AUDIO.md §2 for the design. Modules:
  notation  note-string parser + bar validator
  theory    pitches, keys, chord symbols, voicings, motifs
  song      Song / Section / Part model (Python DSL or JSON)
  gen       accompaniment generators from chord symbols
  midi      timeline → MIDI (preview + per-render subsets), tempo snap
  palette   role → (soundfont, bank, program, gain, pan, echo) with inheritance
  sf2       minimal SoundFont 2 writer/reader
  render    FluidSynth jobs per (stem, soundfont, echo send)
  mix       SNES echo, lowpass, crush, loudness, loop construction
  encode    ffmpeg Opus/AAC + probe files
  manifest  public/audio/music/manifest.json
  review    analysis, seam checks, spectrogram, piano roll, HTML index
  sfx/      offline SFX synth + recipes + sprite packer
"""
