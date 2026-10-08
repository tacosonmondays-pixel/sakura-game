"""Bring a Meshy-made chibi into the game: the owner's own Meshy model of Hikari (big round head,
painted face, white/gold/navy knight coat, teal bow, braid crown with gold stars).

    python3 tools/meshy/build_meshy_chibi.py --source <Meshy Character_output.glb> \
        --clips <Meshy-library animated GLB (Idle_9, Walking_Woman ...)>

Steps (one bpy session per detail level):
  1. import + weld, decimate a copy (face protected) to --tris, fresh xatlas UVs   (lib/lowpoly.py)
  2. bake the 4k Meshy base colour onto the new UVs at --tex                       (lib/bake.py)
  3. readable bone names, retarget the Meshy-library idle + walk                    (lib/retarget.py)
  4. sword on hand_R + idle / walk / attack_slash / cheer / hurt                    (lib/clips_hikari.py)
  5. GLB export, then phone packing: int16/int8 attributes, WebP texture,
     pruned int16 animation, half-scale storage + extras.unitScale                  (lib/pack.py)
Writes public/models/characters/<id>.glb + <id>.lod.glb and their manifest entries
(source: 'meshy', so tools/blender/build_characters.py leaves them alone).

The source GLBs are not in the repo (43 MB + 5 MB). Needs bpy 4.2, numpy, Pillow and xatlas
(pip install xatlas)."""
import argparse
import json
import os
import sys
import tempfile
import time

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from lib import lowpoly, bake, retarget, clips_hikari, pack  # noqa: E402
from lib.rig_names import RENAME, RETARGET  # noqa: E402

# Battle size the owner approved for the Meshy Hikari tests: ~1.5x the old chibi (0.98 -> 1.53
# world units before the hero scale, about 83 px tall at 1280x720 default zoom).
GAME_HEIGHT = 1.53
STORE_SCALE = 0.5  # stored at half size so positions fit normalised int16


def build(args, detail):
    t0 = time.time()
    full = detail == 'full'
    tris = args.tris if full else args.lod_tris
    tex = args.tex if full else args.lod_tex
    tmp = tempfile.mkdtemp(prefix='meshy_')
    arm, hi = lowpoly.import_source(args.source)
    src_height = max((hi.matrix_world @ v.co).z for v in hi.data.vertices)
    lo = lowpoly.make_lowpoly(hi, tris)
    uvinfo = lowpoly.unwrap_xatlas(lo, face_scale=2.0, resolution=tex)
    png = os.path.join(tmp, 'base.png')
    bake.bake_base(hi, lo, tex, png)
    bpy.data.objects.remove(hi)
    arm.name = f'{args.id}_rig'
    lo.name = lo.data.name = args.id
    for b in arm.data.bones:
        if b.name in RENAME:
            b.name = RENAME[b.name]
    bpy.context.scene.render.fps = 24  # the library clips are imported on a 24 fps timeline
    made, k_leg = retarget.retarget(arm, args.clips, RETARGET, {'Idle_9': 'raw_idle', 'Walking_Woman': 'raw_walk'})
    sw = clips_hikari.build(arm, raw_fps=24, fps=30)
    if args.blend and full:
        bpy.ops.wm.save_as_mainfile(filepath=args.blend)
    # export
    for o in bpy.data.objects:
        o.select_set(o in (arm, lo, sw))
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    raw = os.path.join(tmp, 'raw.glb')
    bpy.ops.export_scene.gltf(
        filepath=raw, export_format='GLB', use_selection=True, export_animations=True,
        export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=1,
        export_optimize_animation_size=True, export_anim_single_armature=True, export_reset_pose_bones=True,
        export_skins=True, export_all_influences=False, export_morph=False, export_normals=True,
        export_tangents=False, export_texcoords=True, export_image_format='AUTO', export_yup=True,
        export_apply=False, export_extras=False, export_def_bones=False, export_current_frame=False)
    out = os.path.join(args.out, f'{args.id}{"" if full else ".lod"}.glb')
    stored_height = src_height * STORE_SCALE
    extras = dict(
        unit=args.id, source='meshy', style='textured', height=GAME_HEIGHT,
        unitScale=round(GAME_HEIGHT / stored_height, 5), weaponKind='slash', lod=not full,
        generator='tools/meshy/build_meshy_chibi.py')
    stats = pack.pack(raw, out, STORE_SCALE, extras, webp_quality=args.webp_quality)
    js, _ = pack.read_glb(out)
    verts = sum(js['accessors'][p['attributes']['POSITION']]['count'] for m in js['meshes'] for p in m['primitives'])
    tri = sum(js['accessors'][p['indices']]['count'] // 3 for m in js['meshes'] for p in m['primitives'])
    info = dict(size=os.path.getsize(out), vertices=verts, triangles=tri, animations=sorted(a['name'] for a in js['animations']),
                charts=uvinfo['charts'], anim=stats, seconds=round(time.time() - t0, 1))
    print(f'[meshy] {args.id} {detail}: {info["size"] // 1024} KB, {tri} tris, {verts} verts, tex {tex}, '
          f'{uvinfo["charts"]} charts, clips {info["animations"]}, {stats["channels"]} channels / {stats["keys"]} keys, {info["seconds"]}s')
    return info


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', required=True, help="the owner's Meshy character GLB")
    ap.add_argument('--clips', required=True, help='Meshy animation-library GLB with Idle_9 + Walking_Woman')
    ap.add_argument('--id', default='hikari')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'models', 'characters'))
    ap.add_argument('--tris', type=int, default=20000)
    ap.add_argument('--tex', type=int, default=2048)
    ap.add_argument('--lod-tris', type=int, default=9000)
    ap.add_argument('--lod-tex', type=int, default=1024)
    ap.add_argument('--webp-quality', type=int, default=90)
    ap.add_argument('--no-lod', action='store_true')
    ap.add_argument('--blend', default=None, help='also save the full-detail scene as a .blend')
    args = ap.parse_args(argv)
    full = build(args, 'full')
    lod = None if args.no_lod else build(args, 'lod')
    mpath = os.path.join(args.out, 'manifest.json')
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {}
    entry = dict(file=f'{args.id}.glb', size=full['size'], animations=full['animations'], vertices=full['vertices'],
                 triangles=full['triangles'], source='meshy')
    if lod:
        entry.update(lod=f'{args.id}.lod.glb', lodSize=lod['size'], lodVertices=lod['vertices'], lodTriangles=lod['triangles'])
    manifest[args.id] = entry
    with open(mpath, 'w') as f:
        json.dump(dict(sorted(manifest.items())), f, indent=1)
    print(f'[meshy] manifest updated: {args.id}')


if __name__ == '__main__':
    main()
    sys.stdout.flush()
    os._exit(0)  # skip bpy's teardown (it can segfault after a bake in background mode)
