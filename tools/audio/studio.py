#!/usr/bin/env python3
"""Sakura Sentinels audio studio — the offline music/SFX toolkit CLI (docs/AUDIO.md §2.6).

    python tools/audio/studio.py fetch                        # GeneralUser GS (pinned) + build sakura-chip.sf2
    python tools/audio/studio.py list                         # songs, sections, stems, durations
    python tools/audio/studio.py roles [--palette toby]       # every role → soundfont/bank/program (+ fallbacks)
    python tools/audio/studio.py presets <sf-key|file.sf2>    # presets inside a soundfont (to fill a palette)
    python tools/audio/studio.py midi demo                    # MIDI only (build/<palette>/midi/demo.mid)
    python tools/audio/studio.py render demo                  # MIDI → stems → mix → loop file → encode → checks
    python tools/audio/studio.py render all --palette toby    # same songs, another palette (build/toby/, not shipped)
    python tools/audio/studio.py render demo_battle --stems intensity --no-encode
    python tools/audio/studio.py sfx                          # SFX recipes → sprite (build/sfx/)
    python tools/audio/studio.py sfx-part attacks             # one part sprite (sfx-attacks.*), merged into sprite.json
    python tools/audio/studio.py review demo|all|sfx          # spectrograms, piano rolls, seam plots, report + index.html
    python tools/audio/studio.py ship [--palette cleared]     # gates, then copy into public/audio/ (+ manifest)

Use the toolkit venv: AUDIO_VENV (default tools/audio/.venv) with tools/audio/requirements.txt installed.
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import shutil
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sakura_audio.paths import BUILD, SONGS, PUBLIC_AUDIO, PUBLIC_MUSIC, PUBLIC_SFX, SF2_CACHE  # noqa: E402
from sakura_audio.palette import load_palette  # noqa: E402
from sakura_audio.song import discover  # noqa: E402

BUDGET = {'opus': 11_000_000, 'aac': 13_000_000, 'total': 25_000_000, 'sprite': 300_000}
TEST_SONGS = ('demo*',)     # the 'Roll Call' palette audition: rendered for palette checks, never shipped by `ship all`


def pick_songs(all_songs: dict, names: list) -> list:
    if not names or names == ['all']:
        return list(all_songs.values())
    out = []
    for n in names:
        hits = [s for k, s in all_songs.items() if fnmatch.fnmatch(k, n)]
        if not hits:
            raise SystemExit(f'unknown song {n!r} (known: {", ".join(all_songs)})')
        out += [h for h in hits if h not in out]
    return out


def cmd_fetch(a):
    import fetch_soundfonts
    fetch_soundfonts.main(['--from', a.source] if a.source else [])


def cmd_list(a):
    pal = load_palette(a.palette)
    songs = discover(SONGS)
    from sakura_audio.midi import snap_tempo
    total = 0.0
    for s in songs.values():
        s.palette_hint = pal
        tl = s.timeline(passes=1)
        tempo = snap_tempo(s.bpm, tl.loop_beats, tl.intro_beats) if s.kind == 'loop' else snap_tempo(s.bpm, 0, 0)
        secs = float(tempo.beats_to_samples(tl.pass_beats)) / tempo.rate
        total += secs * len(s.stems())
        roles = s.roles()
        print(f'{s.id:16} {s.kind:7} {s.bpm:6g} bpm {s.key:4} {secs:6.1f} s  stems={",".join(s.stems()):24} '
              f'parts={len(s.parts):3} roles={len(roles):3}  {s.title}')
    print(f'\n{len(songs)} songs, {total / 60:.1f} min of stem audio (≈ {total * 6000 / 1e6:.1f} MB Opus 48k)')


def cmd_roles(a):
    pal = load_palette(a.palette)
    for r in pal.role_names():
        try:
            x = pal.resolve(r)
            print(f'{r:16} {x["sf_path"].name:24} bank {x["bank"]:3} prog {x["program"]:3}  gain {x["gain_db"]:+5.1f} dB  '
                  f'pan {x["pan"]:+.2f}  echo {x["echo"]:.2f}  ({x["palette"]})')
        except Exception as e:  # noqa: BLE001
            print(f'{r:16} ERROR {e}')
    for w in pal.unique_warnings():
        print('warning:', w)


def cmd_presets(a):
    from sakura_audio.sf2 import read_presets
    path = Path(a.font)
    if not path.exists():
        pal = load_palette(a.palette)
        path = pal.soundfont(a.font)
        if path is None:
            raise SystemExit(f'soundfont {a.font} not found ({"; ".join(pal.unique_warnings())})')
    for bank, prog, name in read_presets(path):
        print(f'bank {bank:3}  program {prog:3}  {name}')


def cmd_midi(a):
    pal = load_palette(a.palette)
    from sakura_audio.midi import snap_tempo, write_preview
    for s in pick_songs(discover(SONGS), a.songs):
        s.palette_hint = pal
        tl = s.timeline()
        tempo = snap_tempo(s.bpm, tl.loop_beats, tl.intro_beats) if s.kind == 'loop' else snap_tempo(s.bpm, 0, 0)
        p = write_preview(BUILD / pal.id / 'midi' / f'{s.id}.mid', tl, pal, tempo)
        print(f'wrote {p}')
        if a.roll:
            from sakura_audio.review import piano_roll
            print(f'wrote {piano_roll(s, BUILD / pal.id / "review" / s.id / "pianoroll.png")}')


def cmd_render(a):
    from sakura_audio.pipeline import render_song
    pal = load_palette(a.palette)
    songs = pick_songs(discover(SONGS), a.songs)
    print(f'palette {pal.id} ({pal.source.name}), {len(songs)} song(s)')
    bad = []
    for s in songs:
        t = time.time()
        res = render_song(s, pal, encode_formats=() if a.no_encode else ('opus', 'aac'), workers=a.workers,
                          stems_only=a.stems.split(',') if a.stems else None)
        e = res['entry']
        print(f'  {s.id}: {"OK" if e["ok"] else "CHECKS FAILED"} in {time.time() - t:.1f} s — {e["lufs"]} LUFS, TP {e["truePeak"]} dBTP, '
              f'gain {e["gainDb"]:+.1f} dB' + (' (peak-limited)' if e['peakLimited'] else ''))
        print_checks(e)
        for w in e.get('warnings', []):
            print(f'    warning: {w}')
        if not e['ok']:
            bad.append(s.id)
    if bad:
        print(f'checks failed: {", ".join(bad)}')
        return 1
    return 0


def print_checks(e):
    c = e.get('checks', {})
    if 'loopIdentity' in c:
        print(f'    loop identity (cycle 1 vs 2): {c["loopIdentity"]["rmsDiffDb"]} dB')
    if 'wav' in c:
        w = c['wav']
        print(f'    WAV seams: wrap {w["wrap"]["rmsDiffDb"]} dB (click {w["wrap"]["click"]}), entry {w["entry"]["rmsDiffDb"]} dB (click {w["entry"]["click"]})')
    for fmt in ('opus', 'aac'):
        if fmt in c:
            f = c[fmt]
            line = f'    {fmt}: lag {f["alignment"]["lag"]}'
            if 'wrap' in f:
                line += (f', wrap {f["wrap"]["rmsDiffDb"]} dB (click {f["wrap"]["click"]}), entry {f["entry"]["rmsDiffDb"]} dB '
                         f'(click {f["entry"]["click"]}), codec noise {f["codecNoiseDb"]} dB, length {f["decodedLength"]}/{f["expectedLength"]}')
            print(line)
    sizes = {k: sum(st['bytes'].get(k, 0) for st in e.get('stems', {}).values()) for k in ('opus', 'aac')}
    print(f'    sizes: opus {sizes["opus"]:,} B, aac {sizes["aac"]:,} B; stems {", ".join(e.get("stems", {}))}')


def cmd_sfx(a):
    from sakura_audio.sfx.sprite import build_sprite
    pal = load_palette(a.palette)
    res = build_sprite(pal, only=a.ids or None)
    print(f'encode check (worst relative error per sound): {res["checks"]}')
    print(f'{res["count"]} SFX, {res["seconds"]:.1f} s; sprite opus {res["bytes"]["opus"]:,} B, aac {res["bytes"]["aac"]:,} B → {res["dir"]}')


def cmd_sfx_part(a):
    """One part sprite (recipes registered with part=<name>), merged into public/audio/sfx/sprite.json."""
    from sakura_audio.sfx.sprite import build_part
    pal = load_palette(a.palette)
    res = build_part(pal, a.name)
    print(f'encode check (worst relative error per sound): {res["checks"]}')
    print(f'part {a.name}: {res["count"]} SFX, {res["seconds"]:.1f} s at sample {res["start"]:,} → {res["dir"]}')


def cmd_review(a):
    from sakura_audio import review
    pal = load_palette(a.palette)
    names = [n for n in a.songs if n != 'sfx']
    if 'sfx' in a.songs or a.songs == ['all']:
        print(f'wrote {review.review_sfx(pal)}')
    if names:
        for s in pick_songs(discover(SONGS), names):
            print(f'wrote {review.review_song(s, pal)}')
    print(f'index: {review.write_index(pal)}')


def cmd_originality(a):
    from sakura_audio.originality import check
    pal = load_palette(a.palette)
    songs = discover(SONGS)
    if a.songs and a.songs != ['all']:
        songs = {k: v for k, v in songs.items() if any(fnmatch.fnmatch(k, p) for p in a.songs)}
    res = check(songs, pal, n=a.n)
    out = BUILD / pal.id / 'review' / 'originality.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(res, indent=1))
    print(f'{len(songs)} song(s), n-grams of {a.n} intervals')
    for h in res['blocklistHits']:
        print(f'  FAIL {h["song"]}/{h["part"]} bar {h["bar"]}: {h["intervals"]} matches {h["hook"]}')
    if not res['blocklistHits']:
        print('  blocklist: no matches')
    print(f'  shared undeclared phrases between songs: {len(res["shared"])} '
          f'({sum(1 for x in res["shared"] if x["sameRhythm"])} with the same rhythm)')
    for x in res['shared'][:a.show]:
        where = ', '.join(f'{w["song"]}/{w["part"]}@{w["bar"]}' for w in x['where'])
        print(f'    {"SAME RHYTHM " if x["sameRhythm"] else ""}{x["intervals"]}: {where}')
    print(f'wrote {out}')
    return 0 if res['ok'] else 1


def cmd_ship(a):
    pal = load_palette(a.palette)
    src = BUILD / pal.id
    man_path = src / 'manifest.json'
    if not man_path.exists():
        raise SystemExit(f'nothing rendered for palette {pal.id} (run: studio.py render all --palette {pal.id})')
    built = json.loads(man_path.read_text())['tracks']
    ship_all = not a.songs or a.songs == ['all']
    shippable = [n for n in built if not any(fnmatch.fnmatch(n, p) for p in TEST_SONGS)]
    names = shippable if ship_all else [n for n in built if any(fnmatch.fnmatch(n, p) for p in a.songs)]
    failed = [n for n in names if not built[n].get('ok')]
    if failed and not a.force:
        raise SystemExit(f'refusing to ship, checks failed for: {", ".join(failed)} (see studio.py render output / review)')
    if pal.id != 'cleared' and not a.yes_private:
        raise SystemExit(f'palette {pal.id} is not the shipped default. public/audio is served publicly on GitHub Pages; '
                         f'rerun with --yes-private if the owner wants the {pal.id} renders shipped.')
    PUBLIC_MUSIC.mkdir(parents=True, exist_ok=True)
    pub_path = PUBLIC_MUSIC / 'manifest.json'
    pub = json.loads(pub_path.read_text()) if pub_path.exists() else {}
    from sakura_audio.encode import FORMATS, make_probe
    pub.update({'version': 1, 'rate': 32000, 'palette': pal.id, 'tool': 'studio 1',
                'formats': [{'id': k, **v} for k, v in FORMATS.items()],
                'probe': {'file': 'probe', 'clickSample': 3200}})
    pub.setdefault('tracks', {})
    if ship_all and not a.keep_stale:
        # drop tracks that are no longer part of the soundtrack (palette tests, renamed or deleted songs)
        for n in [k for k in pub['tracks'] if k not in shippable]:
            for stem in pub['tracks'][n].get('stems', {}).values():
                for ext in ('webm', 'm4a'):
                    (PUBLIC_MUSIC / f'{stem["file"]}.{ext}').unlink(missing_ok=True)
            del pub['tracks'][n]
            print(f'pruned {n} from {PUBLIC_MUSIC}')
    for n in names:
        e = dict(built[n])
        for stem in e['stems'].values():
            for fmt, ext in (('opus', 'webm'), ('aac', 'm4a')):
                shutil.copyfile(src / 'enc' / f'{stem["file"]}.{ext}', PUBLIC_MUSIC / f'{stem["file"]}.{ext}')
        e['checks'] = summarize_checks(e.get('checks', {}))
        for k in ('warnings', 'renderSeconds', 'ok'):
            e.pop(k, None)
        pub['tracks'][n] = e
    standins = SONGS / 'standins.json'
    if standins.exists():
        pub['standIns'] = {k: v for k, v in json.loads(standins.read_text()).items() if not k.startswith('_')}
    sizes = {'opus': 0, 'aac': 0}
    for t in pub['tracks'].values():
        for st in t['stems'].values():
            for k in sizes:
                sizes[k] += st['bytes'].get(k, 0)
    pub['bytes'] = sizes
    over = [k for k in sizes if sizes[k] > BUDGET[k]] + (['total'] if sum(sizes.values()) > BUDGET['total'] else [])
    if over:
        raise SystemExit(f'music budget exceeded: {sizes} (caps {BUDGET})')
    pub['built'] = time.strftime('%Y-%m-%d')
    pub_path.write_text(json.dumps(pub, indent=1) + '\n')
    probe = make_probe(PUBLIC_AUDIO)
    print(f'probe: {probe}')
    print(f'shipped {len(names)} track(s) → {PUBLIC_MUSIC} (opus {sizes["opus"]:,} B, aac {sizes["aac"]:,} B)')


def summarize_checks(c: dict) -> dict:
    out = {}
    if 'wav' in c:
        out['wavSeamDb'] = max(c['wav']['wrap']['rmsDiffDb'], c['wav']['entry']['rmsDiffDb'])
    if 'loopIdentity' in c:
        out['loopIdentityDb'] = c['loopIdentity']['rmsDiffDb']
    for fmt in ('opus', 'aac'):
        if fmt in c:
            f = c[fmt]
            out[fmt] = {'lag': f['alignment']['lag']}
            if 'wrap' in f:
                out[fmt].update({'seamDb': max(f['wrap']['rmsDiffDb'], f['entry']['rmsDiffDb']),
                                 'click': max(f['wrap']['click'], f['entry']['click']), 'codecNoiseDb': f['codecNoiseDb']})
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('fetch')
    p.add_argument('--from', dest='source', default=None)
    p.set_defaults(fn=cmd_fetch)
    for name, fn in (('list', cmd_list), ('roles', cmd_roles)):
        p = sub.add_parser(name)
        p.add_argument('--palette', default='cleared')
        p.set_defaults(fn=fn)
    p = sub.add_parser('presets')
    p.add_argument('font')
    p.add_argument('--palette', default='cleared')
    p.set_defaults(fn=cmd_presets)
    p = sub.add_parser('midi')
    p.add_argument('songs', nargs='*', default=['all'])
    p.add_argument('--palette', default='cleared')
    p.add_argument('--roll', action='store_true', help='also draw the piano roll')
    p.set_defaults(fn=cmd_midi)
    p = sub.add_parser('render')
    p.add_argument('songs', nargs='*', default=['all'])
    p.add_argument('--palette', default='cleared')
    p.add_argument('--stems', default=None)
    p.add_argument('--no-encode', action='store_true')
    p.add_argument('--workers', type=int, default=2)
    p.set_defaults(fn=cmd_render)
    p = sub.add_parser('sfx')
    p.add_argument('ids', nargs='*')
    p.add_argument('--palette', default='cleared')
    p.set_defaults(fn=cmd_sfx)
    p = sub.add_parser('sfx-part')
    p.add_argument('name')
    p.add_argument('--palette', default='cleared')
    p.set_defaults(fn=cmd_sfx_part)
    p = sub.add_parser('review')
    p.add_argument('songs', nargs='*', default=['all'])
    p.add_argument('--palette', default='cleared')
    p.set_defaults(fn=cmd_review)
    p = sub.add_parser('originality')
    p.add_argument('songs', nargs='*', default=['all'])
    p.add_argument('--palette', default='cleared')
    p.add_argument('-n', type=int, default=7, help='n-gram length in intervals (default 7)')
    p.add_argument('--show', type=int, default=40)
    p.set_defaults(fn=cmd_originality)
    p = sub.add_parser('ship')
    p.add_argument('songs', nargs='*', default=['all'])
    p.add_argument('--palette', default='cleared')
    p.add_argument('--force', action='store_true', help='ship even when checks failed (never for releases)')
    p.add_argument('--yes-private', action='store_true', help='allow shipping a non-default palette (e.g. toby)')
    p.add_argument('--keep-stale', action='store_true', help='with "all": keep public tracks that are not rendered songs')
    p.set_defaults(fn=cmd_ship)
    a = ap.parse_args(argv)
    return a.fn(a) or 0


if __name__ == '__main__':
    sys.exit(main())
