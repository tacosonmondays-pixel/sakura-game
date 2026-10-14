#!/usr/bin/env python3
"""Writes tools/audio/cache/sf2/sakura-chip.sf2: our own CC0 NES-style soundfont (deterministic).

    python tools/audio/make_chip_sf2.py [--out path]

Programs (bank 0): 0 Pulse 12.5, 1 Pulse 25, 2 Pulse 50, 3 NES Triangle, 4 Chip Saw, 5 Pulse Pluck,
6 Chip Bell. Bank 128 program 0: NES Kit on the GM drum notes. See sakura_audio/chipfont.py.
"""
import argparse
import hashlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sakura_audio.chipfont import build_chip_sf2  # noqa: E402
from sakura_audio.paths import SF2_CACHE  # noqa: E402


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--out', default=str(SF2_CACHE / 'sakura-chip.sf2'))
    a = ap.parse_args(argv)
    path = build_chip_sf2().write(Path(a.out))
    data = path.read_bytes()
    print(f'wrote {path} ({len(data):,} bytes, sha256 {hashlib.sha256(data).hexdigest()[:16]}…)')
    return path


if __name__ == '__main__':
    main()
