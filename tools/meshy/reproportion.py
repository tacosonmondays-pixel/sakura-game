"""Apply a lib/proportions.py preset to a figure that is already built, without a rebuild (no bpy, no source GLB):
from the unpacked exports a build kept with --raw-dir, re-pack both detail levels with the same packing as the
build. extras come from the shipped GLBs (--like): eyes get the head transform, unitScale shrinks the taller
figure back to its battle height. Same result as building with --proportions <preset>.

    python3 tools/meshy/reproportion.py --preset noa-A --raw-dir <dir with noa.raw.glb + noa.lod.raw.glb> \
        --like public/models/characters --id noa --out <dir>

Writes <out>/<id>.glb, <id>.lod.glb and <id>.manifest-entry.json (the models manifest entry, for the owner to
copy in if the variant is picked)."""
import argparse
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from lib import pack, proportions  # noqa: E402

STORE_SCALE = 0.5  # as build_meshy_chibi.py


def run(args, detail, growth=None):
    sfx = '' if detail == 'full' else '.lod'
    raw = os.path.join(args.raw_dir, f'{args.id}{sfx}.raw.glb')
    like = os.path.join(args.like, f'{args.id}{sfx}.glb')
    out = os.path.join(args.out, f'{args.id}{sfx}.glb')
    js, _ = pack.read_glb(like)
    extras = js['asset']['extras']
    tmp = os.path.join(tempfile.mkdtemp(prefix='reprop_'), 'raw.glb')
    info, eyes = proportions.apply_file(raw, tmp, args.preset, extras.get('eyes'), STORE_SCALE)
    g = growth or info['growth']  # the full model's growth for both levels: one battle size
    extras = dict(extras, unitScale=round(extras['unitScale'] / g, 5), proportions=args.preset)
    if eyes:
        extras['eyes'] = eyes
    stats = pack.pack(tmp, out, STORE_SCALE, extras, webp_quality=args.webp_quality, tex_size=args.ship_tex)
    os.remove(tmp)
    js, _ = pack.read_glb(out)
    verts = sum(js['accessors'][p['attributes']['POSITION']]['count'] for m in js['meshes'] for p in m['primitives'])
    tri = sum(js['accessors'][p['indices']]['count'] // 3 for m in js['meshes'] for p in m['primitives'])
    res = dict(size=os.path.getsize(out), vertices=verts, triangles=tri, animations=sorted(a['name'] for a in js['animations']),
               anim=stats, growth=g, unitScale=extras['unitScale'], step=info)
    print(f'[reproportion] {args.id} {detail} {args.preset}: growth {g:.4f}, unitScale {extras["unitScale"]}, '
          f'{res["size"]} bytes, moved {info["meshes"][0]["moved"]}/{info["meshes"][0]["verts"]} verts')
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preset', required=True, choices=sorted(proportions.PRESETS))
    ap.add_argument('--raw-dir', required=True)
    ap.add_argument('--like', required=True, help='folder with the shipped <id>.glb / <id>.lod.glb (extras)')
    ap.add_argument('--id', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--webp-quality', type=int, default=90)
    ap.add_argument('--ship-tex', type=int, default=1024)
    ap.add_argument('--no-lod', action='store_true')
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    full = run(args, 'full')
    lod = None if args.no_lod else run(args, 'lod', full['growth'])
    entry = dict(file=f'{args.id}.glb', size=full['size'], animations=full['animations'], vertices=full['vertices'],
                 triangles=full['triangles'], source='meshy')
    if lod:
        entry.update(lod=f'{args.id}.lod.glb', lodSize=lod['size'], lodVertices=lod['vertices'], lodTriangles=lod['triangles'])
    with open(os.path.join(args.out, f'{args.id}.manifest-entry.json'), 'w') as f:
        json.dump({args.id: dict(sorted(entry.items()))}, f, indent=1)
    with open(os.path.join(args.out, f'{args.id}.reproportion.json'), 'w') as f:
        json.dump(dict(preset=args.preset, settings=proportions.PRESETS[args.preset], full=full, lod=lod), f, indent=1, default=str)


if __name__ == '__main__':
    main()
