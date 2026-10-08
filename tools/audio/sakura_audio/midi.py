"""Timeline → MIDI: a GM preview file and one subset file per FluidSynth render job.

Tempo snap: FluidSynth applies MIDI events on 64-sample blocks (2 ms at 32 kHz) and the MIDI tempo is an
integer number of microseconds per beat. The tempo is nudged (< 0.03 %) so that the loop body P is a whole
number of blocks and the intro a whole number of samples. Cycle 1 and cycle 2 of the loop then render
bit-identically (apart from tails), which is what makes the loop construction exact.
"""
from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction as Fr
from pathlib import Path

import mido

TPB = 960
BLOCK = 64
MELODIC_CHANNELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15]
DRUM_CHANNEL = 9


@dataclass(frozen=True)
class Tempo:
    bpm_written: float
    tempo_us: int          # microseconds per beat (MIDI set_tempo)
    rate: int

    @property
    def bpm(self) -> float:
        return 60e6 / self.tempo_us

    def beats_to_samples(self, beats) -> Fr:
        return Fr(beats) * self.tempo_us * self.rate / 1_000_000

    def samples(self, beats) -> int:
        s = self.beats_to_samples(beats)
        return int(s) if s.denominator == 1 else round(float(s))


def snap_tempo(bpm: float, loop_beats, intro_beats, rate: int = 32000, block: int = BLOCK) -> Tempo:
    """Nearest integer tempo (µs/beat) with P = loop × tempo a multiple of `block` samples and the intro whole samples."""
    target = 60e6 / bpm
    lb, ib = Fr(loop_beats), Fr(intro_beats)
    base = int(round(target))
    for delta in range(0, 200000):
        for t in ((base + delta, base - delta) if delta else (base,)):
            if lb:
                p = lb * t * rate / 1_000_000
                if p.denominator != 1 or p.numerator % block:
                    continue
            if ib:
                i = ib * t * rate / 1_000_000
                if i.denominator != 1:
                    continue
            return Tempo(bpm, t, rate)
    raise ValueError(f'no snapped tempo near {bpm} bpm')


def ticks(beats) -> int:
    return int(round(Fr(beats) * TPB))


def cc7_for(gain_db: float) -> int:
    """FluidSynth's CC7 curve is 40·log10(v/127) dB (measured). 0 dB ↔ CC7 90, leaving +6 dB of headroom."""
    v = 127 * 10 ** ((gain_db - 6.0) / 40.0)
    return max(1, min(127, int(round(v))))


def _part_events(tp, preset, ch, render_end_tick, tempo: Tempo):
    """→ list of (tick, order, message) for one timeline part on channel `ch`."""
    ev = []
    kit = preset.get('bank') == 128
    if not kit:
        ev.append((0, 0, mido.Message('control_change', channel=ch, control=0, value=min(127, int(preset.get('bank', 0))))))
        ev.append((0, 0, mido.Message('control_change', channel=ch, control=32, value=0)))
    ev.append((0, 1, mido.Message('program_change', channel=ch, program=int(preset['program']))))
    pan = tp.pan if tp.pan is not None else preset.get('pan', 0.0)
    ev.append((0, 2, mido.Message('control_change', channel=ch, control=7, value=cc7_for(preset.get('gain_db', 0.0)))))
    ev.append((0, 2, mido.Message('control_change', channel=ch, control=10, value=max(0, min(127, int(round(64 + pan * 63)))))))
    ev.append((0, 2, mido.Message('control_change', channel=ch, control=11, value=127)))
    for c in (91, 93):   # no FluidSynth reverb/chorus sends: all space comes from our echo
        ev.append((0, 2, mido.Message('control_change', channel=ch, control=c, value=0)))
    transpose = 0 if kit else int(preset.get('transpose', 0))
    curve = float(preset.get('vel_curve', 1.0))
    kit_map = preset.get('kit_map') or {}
    ms = tempo.tempo_us / 1000 / TPB      # ms per tick
    spans: list[list] = []                # [start, end, pitch, vel]
    for n in tp.notes:
        st = ticks(n.start)
        gate = n.gate if n.gate is not None else (tp.gate if tp.gate is not None else 0.94)
        length = ticks(n.dur * Fr(gate).limit_denominator(1000))
        if gate < 1.0 and not kit:
            # always leave ≥ 12 ms between repeated notes so envelopes retrigger cleanly
            length = min(length, ticks(n.dur) - max(1, int(12 / ms)))
        length = max(1, length)
        vel = n.vel
        if curve != 1.0:
            vel = int(round(127 * (vel / 127) ** curve))
        vel = max(1, min(127, vel))
        pitches = n.pitches
        if kit and kit_map and n.drum_names:
            pitches = tuple(kit_map.get(x, p) for x, p in zip(n.drum_names, n.pitches))
        for p in pitches:
            p = max(0, min(127, p + transpose))
            spans.append([st, min(st + length, render_end_tick - 1), p, vel])
        if n.slide and not kit:
            steps = 6
            dur_t = max(steps, int(60 / ms))
            for i in range(steps + 1):
                val = int(-8191 * (1 - i / steps))
                ev.append((st + dur_t * i // steps, 4 if i == 0 else 6, mido.Message('pitchwheel', channel=ch, pitch=val)))
        if n.vibrato and not kit:
            ev.append((st + int(120 / ms), 6, mido.Message('control_change', channel=ch, control=1, value=56)))
            ev.append((st + ticks(n.dur), 3, mido.Message('control_change', channel=ch, control=1, value=0)))
    # a re-struck pitch ends the previous note of the same pitch on this channel
    last_by_pitch: dict[int, list] = {}
    for sp in sorted(spans, key=lambda s: (s[0], s[2])):
        prev = last_by_pitch.get(sp[2])
        if prev is not None and prev[1] > sp[0]:
            prev[1] = sp[0]
        last_by_pitch[sp[2]] = sp
    for st, end, p, vel in spans:
        if end <= st:
            continue
        ev.append((st, 5, mido.Message('note_on', channel=ch, note=p, velocity=vel)))
        ev.append((end, -1, mido.Message('note_off', channel=ch, note=p, velocity=0)))
    return ev


def write_midi(path: Path, tempo: Tempo, assignments, render_end_beats, markers=()):
    """assignments: [(TimelinePart, preset dict, channel)] → type-0 MIDI file at `path`."""
    end_tick = ticks(render_end_beats)
    events = [(0, -5, mido.MetaMessage('set_tempo', tempo=tempo.tempo_us))]
    for beat, text in markers:
        events.append((ticks(beat), -4, mido.MetaMessage('marker', text=text[:120])))
    for tp, preset, ch in assignments:
        events += _part_events(tp, preset, ch, end_tick, tempo)
    # keep the player running to the very end (release tails, echo room)
    events.append((end_tick, 9, mido.Message('control_change', channel=15, control=110, value=0)))
    events.sort(key=lambda e: (e[0], e[1]))
    mid = mido.MidiFile(type=0, ticks_per_beat=TPB)
    tr = mido.MidiTrack()
    mid.tracks.append(tr)
    last = 0
    for t, _, msg in events:
        tr.append(msg.copy(time=t - last))
        last = t
    tr.append(mido.MetaMessage('end_of_track', time=0))
    path.parent.mkdir(parents=True, exist_ok=True)
    mid.save(str(path))
    return path


def write_preview(path: Path, tl, palette, tempo: Tempo):
    """General-MIDI preview of a whole song (one pass + loop) for any MIDI player. Approximate when a song
    has more than 15 melodic parts (channels are then shared)."""
    assignments = []
    mel_i = 0
    for tp in tl.parts:
        pre = dict(palette.resolve(tp.role))
        if pre.get('sf_key') == 'chip' or 'chip' in str(pre.get('sf_path', '')):
            if pre.get('bank') == 128:
                pre = {**pre, 'program': 0}
            else:
                pre = {**pre, 'bank': 0, 'program': {0: 80, 1: 80, 2: 80, 3: 87, 4: 81, 5: 80, 6: 98}.get(pre['program'], 80)}
        if pre.get('bank') == 128:
            ch = DRUM_CHANNEL
        else:
            ch = MELODIC_CHANNELS[mel_i % len(MELODIC_CHANNELS)]
            mel_i += 1
        assignments.append((tp, pre, ch))
    return write_midi(path, tempo, assignments, tl.render_beats, tl.markers)
