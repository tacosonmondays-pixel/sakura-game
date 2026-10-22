#!/usr/bin/env python3
"""Bakes the 3D-flat item icons with Blender (EEVEE, 256 px, emission-only toon + ink hulls).

    blender --background --factory-startup --python-use-system-env --python tools/blender/items/build_items.py -- \
        [keys ...] [--family books] [--out public/art/items] [--scratch DIR] [--compare DIR] [--sheet PNG] \
        [--blend debug.blend] [--items items.json] [--pylibs DIR] [--no-manifest] [--list] [--table]
    python3 tools/blender/items/build_items.py [same arguments]     # bpy module (tools/blender/requirements.txt)
    python3 tools/blender/items/build_items.py --table              # rewrite the README data table (no Blender)

Reads every key from src/data (node + dump_items.mjs): the 81 item ids, gear_<slot>_<rarity|ur> and
recruitPoints. For each key it builds the model (models/<family>.py), poses it, fits the orthographic
camera so the silhouette lands centred at (119, 117.5) px, adds the ink hulls, renders a 256 px PNG,
then post.py adds the glints and the contact shadow and writes <key>-256.webp and <key>-128.webp
(plus <key>-small.webp, a heavier-line cut downscaled to 96 px, for the keys in models.SMALL_CUT).
Finally it rewrites src/art/itemArt.js from the files in --out and draws one contact sheet per family
into --scratch (outside the repo). Keep one Blender process at a time, at below-normal priority.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(1, os.path.dirname(HERE))      # tools/blender (lib/colors.py)


def _args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser(description='Bake the 3D-flat item icons.')
    ap.add_argument('keys', nargs='*', help='item keys (default: all, or the --family)')
    ap.add_argument('--family', action='append', default=[], help='books, currency, tickets, materials, mat_rime, boxes, '
                    'crowns, fragments, tools, gear (repeatable)')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'art', 'items'))
    ap.add_argument('--manifest', default=os.path.join(ROOT, 'src', 'art', 'itemArt.js'))
    ap.add_argument('--no-manifest', action='store_true')
    ap.add_argument('--scratch', default=os.environ.get('ITEMS_SCRATCH') or os.path.join(tempfile.gettempdir(), 'item-art'),
                    help='renders, PNG copies and sheets (keep it outside the repo)')
    ap.add_argument('--compare', default=None, help='folder of approved <key>_256.webp files for a side-by-side sheet')
    ap.add_argument('--sheet', default=None, help='one contact sheet for everything built (default: one per family)')
    ap.add_argument('--blend', default=None, help='save the last built item as a .blend to inspect')
    ap.add_argument('--items', default=None, help='items.json from dump_items.mjs (default: run node)')
    ap.add_argument('--node', default=os.environ.get('NODE', 'node'))
    ap.add_argument('--pylibs', default=os.environ.get('ITEMS_PYLIBS'), help='extra site folder (Pillow for Blender)')
    ap.add_argument('--samples', type=int, default=32)
    ap.add_argument('--list', action='store_true', help='print the keys and families and exit')
    ap.add_argument('--table', action='store_true', help='rewrite the data table in README.md from catalog.py and exit '
                    '(no Blender needed)')
    return ap.parse_args(argv)


def _catalogue(a):
    if a.items:
        with open(a.items, encoding='utf-8') as f:
            return json.load(f)
    fd, tmp = tempfile.mkstemp(suffix='.json')
    os.close(fd)
    try:
        subprocess.run([a.node, os.path.join(HERE, 'dump_items.mjs'), tmp], check=True, cwd=ROOT, capture_output=True)
        with open(tmp, encoding='utf-8') as f:
            return json.load(f)
    finally:
        os.remove(tmp)


def main():
    a = _args()
    if a.pylibs:
        sys.path.append(a.pylibs)
    import models  # noqa: E402
    rows = _catalogue(a)
    if a.keys:
        want = set(a.keys)
        rows += [dict(c) for c in models.CALIBRATION if c['key'] in want]
        unknown = want - {r['key'] for r in rows}
        if unknown:
            raise SystemExit('unknown keys: %s' % ', '.join(sorted(unknown)))
        rows = [r for r in rows if r['key'] in want]
    if a.family:
        fams = set(a.family)
        rows = [r for r in rows if models.family(r['key']) in fams or models.subfamily(r['key']) in fams]
    if a.list:
        for r in rows:
            print(r['key'], models.family(r['key']), r['rarity'], r['name'])
        return
    if a.table:
        import catalog  # noqa: E402
        missing = [r['key'] for r in rows if not catalog.note(r['key'])]
        md = catalog.table(rows, models.family, models.SMALL_CUT)
        readme = os.path.join(HERE, 'README.md')
        with open(readme, encoding='utf-8') as f:
            text = f.read()
        head, rest = text.split('<!-- table:start -->', 1)
        _, tail = rest.split('<!-- table:end -->', 1)
        with open(readme, 'w', encoding='utf-8', newline='\n') as f:
            f.write(head + '<!-- table:start -->\n' + md + '\n<!-- table:end -->' + tail)
        print('[items] README table: %d keys' % len(rows))
        if missing:
            print('[items] no catalog note: ' + ', '.join(missing))
        return

    import bpy  # noqa: E402
    import rig  # noqa: E402
    import parts  # noqa: E402
    import post  # noqa: E402

    raw_dir = os.path.join(a.scratch, 'raw')
    png_dir = os.path.join(a.scratch, 'png')
    os.makedirs(raw_dir, exist_ok=True)
    cam = rig.setup_scene(a.samples)
    reports = []
    t0 = time.time()
    for row in rows:
        key = row['key']
        t1 = time.time()
        parts.reset()
        rig.clear_item()
        spec = models.build(row)
        objs = parts.ITEM['parts']
        kind = spec.get('kind', 'standing')
        pose = rig.pose_matrix(kind, **{k: spec[k] for k in ('roll', 'turn', 'tip', 'yaw', 'elev') if k in spec})
        rig.apply_pose(objs, pose)
        rig.pose_steps(objs, kind, pose)
        ppu = rig.fit_camera(cam, objs, scale=spec.get('fit', 1.0))
        glints = []
        for p, size in parts.ITEM['glints']:
            x, y = rig.to_px(cam, pose @ p)
            glints.append((x, y, size, (253, 254, 254)))
        hulls = rig.add_hulls(objs, ppu)
        raw = rig.render(os.path.join(raw_dir, f'{key}.png'))
        small_raw = None
        if key in models.SMALL_CUT:
            for h in hulls:
                bpy.data.objects.remove(h, do_unlink=True)
            hulls = rig.add_hulls(objs, ppu, mult=1.8)
            small_raw = rig.render(os.path.join(raw_dir, f'{key}-small.png'))
        out_dir = os.path.join(a.scratch, 'calibration') if row.get('kind') == 'calibration' else a.out
        rep = post.finish(raw, glints, key, out_dir, png_dir, small_raw=small_raw,
                          small_glints=[(x, y, s * 1.15, c) for x, y, s, c in glints])
        rep['family'] = models.family(key)
        rep['seconds'] = round(time.time() - t1, 2)
        reports.append(rep)
        print('[items] %-24s %s %5.1f KB %4.1f KB%s  %.1fs' % (
            key, 'ok ' if rep['ok'] else 'FIT', rep['bytes256'] / 1024, rep['bytes128'] / 1024,
            ('  small %.1f KB' % (rep['bytesSmall'] / 1024)) if 'bytesSmall' in rep else '', rep['seconds']), flush=True)
        if rep['overCap']:
            print('[items]   over the size cap: %s' % rep['overCap'], flush=True)
    if a.blend:
        bpy.ops.wm.save_as_mainfile(filepath=a.blend, copy=True)
    if not a.no_manifest:
        m = post.write_manifest(a.out, a.manifest)
        print('[items] manifest: %d keys, %d small cuts, %.1f KB of WebP in %s' % (m['keys'], m['small'], m['totalBytes'] / 1024, a.out))
    post.write_report(reports, os.path.join(a.scratch, 'report.json'))
    compare = None
    if a.compare:
        compare = {r['key']: os.path.join(a.compare, f"{r['key']}_256.webp") for r in rows}
        compare = {k: v for k, v in compare.items() if os.path.exists(v)}
        if compare:
            path = os.path.join(a.scratch, 'compare.png')
            post.compare_grid(rows, png_dir, compare, path)
            print('[items] compare: ' + path)
    if a.sheet:
        post.contact_sheet(rows, png_dir, a.sheet, title='items', compare=compare)
        print('[items] sheet: ' + a.sheet)
    else:
        groups = {}
        for r in rows:
            groups.setdefault(models.subfamily(r['key']) if models.family(r['key']) == 'materials' else models.family(r['key']), []).append(r)
        for fam, rs in groups.items():
            path = os.path.join(a.scratch, f'sheet-{fam}.png')
            post.contact_sheet(rs, png_dir, path, title=fam, compare=compare)
            print('[items] sheet: ' + path)
    print('[items] %d keys in %.1fs' % (len(rows), time.time() - t0))


if __name__ == '__main__':
    main()
