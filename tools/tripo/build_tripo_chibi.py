"""Bring a Tripo staff hero (Kogane, Norika) into the game from Tripo's rigged GLB.

    python3.11 tools/tripo/build_tripo_chibi.py --source <animate_rig model.glb> --id kogane
    (attack clip, style and chin-up per figure in PROFILES; --attack / --attack-style / --chin override)

Input: the GLB of a Tripo `animate_rig` task (biped, spec 'tripo') run on the text_to_model result
(prompts and task ids: docs/art/tripo/batch-1.md). Raw downloads live in tools/art/src/tripo/<batch>/
on the owner's machine and stay out of git.

Steps (one bpy session per detail level):
  1. import, turn to face the game's front (-Y in Blender), pivot between the feet, 1 m tall
  2. readable bone names (TRIPO_RENAME; twist bones keep a readable name and only follow)
  3. LOD only: decimate the skinned mesh (collapse) to --lod-tris; Tripo's own UVs and base colour
     are kept (its charts are large, unlike Meshy's, so no re-unwrap or bake is needed)
  4. idle / walk / attack_<kind> / cheer / hurt authored on the rig (tripolib/clips_staff.py)
  5. GLB export, then the Meshy phone packing (tools/meshy/lib/pack.py): int16/int8 attributes,
     WebP base colour at --tex (LOD --lod-tex), pruned animation, half-scale storage + extras.unitScale
Writes public/models/characters/<id>.glb + <id>.lod.glb and their manifest entries (source 'tripo';
tools/blender/build_characters.py leaves imported figures alone). Needs bpy 4.2, numpy and Pillow."""
import argparse
import json
import os
import sys
import tempfile

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from tripolib import normalize, clips_staff, rig  # noqa: E402
from tripolib.meshy import pack  # noqa: E402

# per-figure settings of the shipped files (batch 1): attack clip, its style, and the chin-up that keeps the eyes
# clear of the brim from the 48 deg battle camera (degrees, negative = chin up)
PROFILES = {
    'kogane': dict(attack='attack_wrench', attack_style='swing', chin=-14.0),
    'norika': dict(attack='attack_sign', attack_style='raise', chin=-20.0),
}

GAME_HEIGHT = 1.224  # like the imported Meshy figures (docs/MODELS.md)
STORE_SCALE = 0.5

def build(args, detail):
    full = detail == 'full'
    normalize.reset()
    arm, meshes = normalize.import_glb(args.source)
    assert arm and len(meshes) == 1, 'expected one skinned mesh'
    body = meshes[0]
    rig.face_front_biped(arm, meshes, normalize)
    rig.rename(arm)
    arm.name = f'{args.id}_rig'
    body.name = body.data.name = args.id
    img = normalize.name_base_image(meshes)
    tris = normalize.decimate(body, args.lod_tris) if not full else sum(len(p.vertices) - 2 for p in body.data.polygons)
    bpy.context.scene.render.fps = clips_staff.FPS
    clips_staff.Clips(arm, arms_down=args.arms_down, chin=args.chin, attack=args.attack_style).build(args.attack)
    tmp = tempfile.mkdtemp(prefix='tripo_')
    raw = os.path.join(tmp, 'raw.glb')
    normalize.export_glb(raw, [arm, body])
    if args.raw_dir:
        import shutil
        shutil.copy(raw, os.path.join(args.raw_dir, f'{args.id}{"" if full else ".lod"}.raw.glb'))
    out = os.path.join(args.out, f'{args.id}{"" if full else ".lod"}.glb')
    extras = dict(unit=args.id, source='tripo', style='textured', height=GAME_HEIGHT,
                  unitScale=round(GAME_HEIGHT / STORE_SCALE, 5), weaponKind=args.attack.split('_', 1)[1],
                  lod=not full, generator='tools/tripo/build_tripo_chibi.py')
    stats = pack.pack(raw, out, STORE_SCALE, extras, webp_quality=args.webp_quality, tex_size=args.tex if full else args.lod_tex)
    js, _ = pack.read_glb(out)
    verts = sum(js['accessors'][p['attributes']['POSITION']]['count'] for m in js['meshes'] for p in m['primitives'])
    tri = sum(js['accessors'][p['indices']]['count'] // 3 for m in js['meshes'] for p in m['primitives'])
    info = dict(size=os.path.getsize(out), vertices=verts, triangles=tri, animations=sorted(a['name'] for a in js['animations']))
    print(f'[tripo] {args.id} {detail}: {info["size"] // 1024} KB, {tri} tris, {verts} verts, image {img and img.size[:]}, '
          f'clips {info["animations"]}, {stats["channels"]} channels / {stats["keys"]} keys')
    return info


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', required=True, help="a Tripo animate_rig GLB")
    ap.add_argument('--id', required=True)
    ap.add_argument('--attack', default=None, help='attack clip name, e.g. attack_wrench (default: PROFILES)')
    ap.add_argument('--attack-style', default=None, choices=['swing', 'raise'])
    ap.add_argument('--arms-down', type=float, default=38.0, help='degrees from the rig rest arms to the idle arms')
    ap.add_argument('--chin', type=float, default=None, help='head pitch in every clip (negative = chin up, for the 48 deg camera)')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'models', 'characters'))
    ap.add_argument('--lod-tris', type=int, default=9000)
    ap.add_argument('--tex', type=int, default=1024)
    ap.add_argument('--lod-tex', type=int, default=512)
    ap.add_argument('--webp-quality', type=int, default=90)
    ap.add_argument('--raw-dir', default=None)
    ap.add_argument('--no-manifest', action='store_true')
    args = ap.parse_args(argv)
    prof = PROFILES.get(args.id, dict(attack=None, attack_style='swing', chin=-8.0))
    for k, v in prof.items():
        if getattr(args, k) is None:
            setattr(args, k, v)
    assert args.attack, '--attack is required for a figure without a profile'
    full = build(args, 'full')
    lod = build(args, 'lod')
    if args.no_manifest:
        return
    mpath = os.path.join(args.out, 'manifest.json')
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {}
    manifest[args.id] = dict(file=f'{args.id}.glb', size=full['size'], animations=full['animations'], vertices=full['vertices'],
                             triangles=full['triangles'], source='tripo', lod=f'{args.id}.lod.glb', lodSize=lod['size'],
                             lodVertices=lod['vertices'], lodTriangles=lod['triangles'])
    with open(mpath, 'w') as f:
        json.dump(dict(sorted(manifest.items())), f, indent=1)
        f.write('\n')
    print(f'[tripo] manifest updated: {args.id}')


if __name__ == '__main__':
    main()
    sys.stdout.flush()
    os._exit(0)
