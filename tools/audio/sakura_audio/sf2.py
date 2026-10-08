"""Minimal SoundFont 2.01 writer and preset reader (no dependencies besides numpy).

RIFF 'sfbk' → LIST INFO (ifil, isng, INAM, ICOP, ICMT) → LIST sdta (smpl, 16-bit mono) →
LIST pdta (phdr pbag pmod pgen inst ibag imod igen shdr, each with its terminal record).
"""
from __future__ import annotations

import struct
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

# generator operators (SF2.01 §8.1.2)
GEN = {
    'startAddrsOffset': 0, 'endAddrsOffset': 1, 'startloopAddrsOffset': 2, 'endloopAddrsOffset': 3,
    'modLfoToPitch': 5, 'vibLfoToPitch': 6, 'modEnvToPitch': 7, 'initialFilterFc': 8, 'initialFilterQ': 9,
    'modLfoToFilterFc': 10, 'modEnvToFilterFc': 11, 'modLfoToVolume': 13, 'chorusEffectsSend': 15,
    'reverbEffectsSend': 16, 'pan': 17, 'delayModLFO': 21, 'freqModLFO': 22, 'delayVibLFO': 23, 'freqVibLFO': 24,
    'delayModEnv': 25, 'attackModEnv': 26, 'holdModEnv': 27, 'decayModEnv': 28, 'sustainModEnv': 29,
    'releaseModEnv': 30, 'delayVolEnv': 33, 'attackVolEnv': 34, 'holdVolEnv': 35, 'decayVolEnv': 36,
    'sustainVolEnv': 37, 'releaseVolEnv': 38, 'instrument': 41, 'keyRange': 43, 'velRange': 44,
    'keynum': 46, 'velocity': 47, 'initialAttenuation': 48, 'coarseTune': 51, 'fineTune': 52, 'sampleID': 53,
    'sampleModes': 54, 'scaleTuning': 56, 'exclusiveClass': 57, 'overridingRootKey': 58,
}
RANGE_GENS = {GEN['keyRange'], GEN['velRange']}


def timecents(seconds: float) -> int:
    """Seconds → SF2 timecents (1200·log2 s), clamped to the legal range."""
    if seconds <= 0.001:
        return -12000
    return int(round(1200 * np.log2(seconds)))


def _name(s: str, n: int = 20) -> bytes:
    b = s.encode('ascii', 'replace')[:n - 1]
    return b + b'\0' * (n - len(b))


def _chunk(cid: bytes, data: bytes) -> bytes:
    pad = b'\0' if len(data) % 2 else b''
    return cid + struct.pack('<I', len(data)) + data + pad


def _list(kind: bytes, chunks: bytes) -> bytes:
    return b'LIST' + struct.pack('<I', len(chunks) + 4) + kind + chunks


def _zstr(s: str) -> bytes:
    b = s.encode('ascii', 'replace') + b'\0'
    return b + (b'\0' if len(b) % 2 else b'')


@dataclass
class Sample:
    name: str
    data: np.ndarray          # int16
    rate: int
    root: int
    correction: int = 0       # cents, signed
    loop: tuple | None = None  # (start, end) relative to the sample start
    start: int = 0            # absolute offset in smpl (set when written)


@dataclass
class Zone:
    gens: dict = field(default_factory=dict)   # name → amount (keyRange/velRange as (lo, hi))
    sample: int | None = None                  # instrument zones
    instrument: int | None = None              # preset zones


class SF2Writer:
    def __init__(self, name: str, copyright: str = '', comment: str = '', engineer: str = ''):
        self.name, self.copyright, self.comment, self.engineer = name, copyright, comment, engineer
        self.samples: list[Sample] = []
        self.instruments: list[tuple[str, list[Zone]]] = []
        self.presets: list[tuple[str, int, int, list[Zone]]] = []

    def add_sample(self, name, data, rate, root, correction=0, loop=None) -> int:
        arr = np.asarray(data)
        if arr.dtype != np.int16:
            arr = np.clip(np.round(arr * 32767), -32768, 32767).astype(np.int16)
        self.samples.append(Sample(name, arr, int(rate), int(root), int(correction), loop))
        return len(self.samples) - 1

    def add_instrument(self, name, zones: list[Zone], global_gens: dict | None = None) -> int:
        zs = ([Zone(dict(global_gens))] if global_gens else []) + zones
        self.instruments.append((name, zs))
        return len(self.instruments) - 1

    def add_preset(self, name, bank, program, instrument: int, gens: dict | None = None) -> int:
        self.presets.append((name, bank, program, [Zone(dict(gens or {}), instrument=instrument)]))
        return len(self.presets) - 1

    @staticmethod
    def _gen_records(z: Zone, last_key: str, last_val: int) -> list:
        recs = []
        g = dict(z.gens)
        for k in ('keyRange', 'velRange'):
            if k in g:
                lo, hi = g.pop(k)
                recs.append(struct.pack('<HBB', GEN[k], lo, hi))
        for k, v in g.items():
            recs.append(struct.pack('<Hh', GEN[k], int(v)))
        if last_val is not None:
            recs.append(struct.pack('<HH', GEN[last_key], last_val))
        return recs

    def to_bytes(self) -> bytes:
        info = (_chunk(b'ifil', struct.pack('<HH', 2, 1)) + _chunk(b'isng', _zstr('EMU8000')) + _chunk(b'INAM', _zstr(self.name))
                + (_chunk(b'ICOP', _zstr(self.copyright)) if self.copyright else b'')
                + (_chunk(b'IENG', _zstr(self.engineer)) if self.engineer else b'')
                + (_chunk(b'ICMT', _zstr(self.comment)) if self.comment else b'')
                + _chunk(b'ISFT', _zstr('sakura_audio sf2.py')))
        # sample data: each sample followed by 46 zero points (spec)
        parts, pos = [], 0
        for s in self.samples:
            s.start = pos
            parts.append(s.data)
            parts.append(np.zeros(46, np.int16))
            pos += len(s.data) + 46
        smpl = np.concatenate(parts).astype('<i2').tobytes() if parts else b''
        sdta = _chunk(b'smpl', smpl)

        # presets
        phdr, pbag, pgen = b'', b'', []
        for name, bank, prog, zones in self.presets:
            phdr += _name(name) + struct.pack('<HHHIII', prog, bank, len(pbag) // 4, 0, 0, 0)
            for z in zones:
                pbag += struct.pack('<HH', len(pgen), 0)
                pgen += self._gen_records(z, 'instrument', z.instrument)
        phdr += _name('EOP') + struct.pack('<HHHIII', 0, 0, len(pbag) // 4, 0, 0, 0)
        pbag += struct.pack('<HH', len(pgen), 0)
        pgen_b = b''.join(pgen) + struct.pack('<HH', 0, 0)
        pmod = b'\0' * 10

        inst, ibag, igen = b'', b'', []
        for name, zones in self.instruments:
            inst += _name(name) + struct.pack('<H', len(ibag) // 4)
            for z in zones:
                ibag += struct.pack('<HH', len(igen), 0)
                igen += self._gen_records(z, 'sampleID', z.sample)
        inst += _name('EOI') + struct.pack('<H', len(ibag) // 4)
        ibag += struct.pack('<HH', len(igen), 0)
        igen_b = b''.join(igen) + struct.pack('<HH', 0, 0)
        imod = b'\0' * 10

        shdr = b''
        for s in self.samples:
            ls, le = (s.loop if s.loop else (0, len(s.data)))
            shdr += _name(s.name) + struct.pack('<IIIIIBbHH', s.start, s.start + len(s.data), s.start + ls, s.start + le,
                                                s.rate, s.root, s.correction, 0, 1)
        shdr += _name('EOS') + struct.pack('<IIIIIBbHH', 0, 0, 0, 0, 0, 0, 0, 0, 0)

        pdta = (_chunk(b'phdr', phdr) + _chunk(b'pbag', pbag) + _chunk(b'pmod', pmod) + _chunk(b'pgen', pgen_b)
                + _chunk(b'inst', inst) + _chunk(b'ibag', ibag) + _chunk(b'imod', imod) + _chunk(b'igen', igen_b)
                + _chunk(b'shdr', shdr))
        body = b'sfbk' + _list(b'INFO', info) + _list(b'sdta', sdta) + _list(b'pdta', pdta)
        return b'RIFF' + struct.pack('<I', len(body)) + body

    def write(self, path: Path):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(self.to_bytes())
        return path


def read_presets(path: Path) -> list:
    """[(bank, program, name)] of a .sf2 file (reads only the phdr chunk)."""
    data = Path(path).read_bytes()
    if data[:4] != b'RIFF' or data[8:12] != b'sfbk':
        raise ValueError(f'{path} is not a SoundFont 2 file')
    pos = 12
    while pos < len(data):
        cid, size = data[pos:pos + 4], struct.unpack('<I', data[pos + 4:pos + 8])[0]
        if cid == b'LIST' and data[pos + 8:pos + 12] == b'pdta':
            sub = pos + 12
            end = pos + 8 + size
            while sub < end:
                scid, ssize = data[sub:sub + 4], struct.unpack('<I', data[sub + 4:sub + 8])[0]
                if scid == b'phdr':
                    out = []
                    for i in range(ssize // 38 - 1):
                        rec = data[sub + 8 + 38 * i: sub + 8 + 38 * (i + 1)]
                        name = rec[:20].split(b'\0')[0].decode('ascii', 'replace')
                        prog, bank = struct.unpack('<HH', rec[20:24])
                        out.append((bank, prog, name))
                    return sorted(out)
                sub += 8 + ssize + (ssize & 1)
        pos += 8 + size + (size & 1)
    raise ValueError(f'{path}: no phdr chunk')
