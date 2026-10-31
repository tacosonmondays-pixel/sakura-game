"""A Tripo enemy as its own GLB (public/models/enemies/tripo/<id>.glb), drawn by src/models/glbEnemy.js
in place of its family's shared mesh (the family GLB stays the fallback).

    python3.11 tools/tripo/build_tripo_enemy.py --source <file.glb> --id brigade_trooper --kind humanoid
    python3.11 tools/tripo/build_tripo_enemy.py --source <file.glb> --id brigade_gnat --kind hover

--kind humanoid takes a Tripo animate_rig GLB (biped) or an unrigged website download (rigged from its shape by
tripolib/autorig.py); hover / vehicle / blob take an unrigged GLB and get a rigid two-bone rig. Steps: face the game's front, floor pivot, 1 m reference size, decimate to --tris,
move / idle / hit / death / special (tripolib/clips_enemy.py), export, Meshy phone packing (half-scale
storage, extras.unitScale 2, WebP base colour at --tex). extras: { id, source: 'tripo', style: 'textured',
height, unitScale, kind }. `height` is the size the game scales to 0.6 x EnemyDef.size: the figure's height
for a trooper, and for a drone (vehicle) the larger of its height and 0.7 (0.95) x its length or width."""
import argparse
import json
import os
import sys
import tempfile

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from tripolib import normalize, rig, clips_enemy, autorig  # noqa: E402
from tripolib.meshy import pack  # noqa: E402

STORE_SCALE = 0.5


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', required=True)
    ap.add_argument('--id', required=True)
    ap.add_argument('--kind', required=True, choices=['humanoid', 'hover', 'vehicle', 'blob'])
    ap.add_argument('--arm-z', type=float, default=None, help='unrigged humanoid: the arm line, if the measured one is wrong')
    ap.add_argument('--shield', action='store_true', help='humanoid: the left arm holds a shield up in front')
    ap.add_argument('--tris', type=int, default=5000)
    ap.add_argument('--tex', type=int, default=512)
    ap.add_argument('--webp-quality', type=int, default=88)
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'models', 'enemies', 'tripo'))
    args = ap.parse_args(argv)
    normalize.reset()
    arm, meshes = normalize.import_glb(args.source)
    assert len(meshes) == 1
    body = meshes[0]
    bpy.context.scene.render.fps = 30
    if args.kind == 'humanoid' and arm:
        # a Tripo animate_rig GLB (batch 1)
        assert len(meshes) == 1
        rig.face_front_biped(arm, meshes, normalize)
        rig.rename(arm)
        lo, hi = normalize.bounds(meshes)
        ref = hi.z - lo.z
    elif args.kind == 'humanoid':
        # an unrigged website download (batch 2): joined, decimated first, then rigged from its shape
        body = normalize.join(meshes)
        meshes = [body]
        normalize.face_front(None, meshes, -90.0)
        normalize.scale_to(None, meshes, 1.0)
        normalize.weld(body)
        normalize.decimate(body, args.tris)
        arm, marks = autorig.rig(body, arm_z=args.arm_z)
        print(f'[tripo] {args.id}: autorig {marks}')
        ref = 1.0
    else:
        body = normalize.join(meshes)
        meshes = [body]
        normalize.weld(body)
        lo, hi = normalize.face_front(None, meshes, -90.0)
        # a vehicle is sized by its length (one road tile wide at most), a drone by its span
        size = max(hi.z - lo.z, (0.95 if args.kind == 'vehicle' else 0.7) * max(hi.x - lo.x, hi.y - lo.y))
        normalize.bake_world(None, meshes, normalize.Matrix.Scale(1.0 / size, 4))
        lo, hi = normalize.bounds(meshes)
        ref = 1.0
    tris = normalize.decimate(body, args.tris)
    normalize.name_base_image(meshes)
    body.name = body.data.name = args.id
    if args.kind == 'humanoid':
        arm.name = f'{args.id}_rig'
        arm.data.name = f'{args.id}_rig'
        clips_enemy.HumanoidClips(arm, shield=args.shield).build()
    else:
        arm = clips_enemy.rigid_rig(meshes, hi.z - lo.z)
        arm.name = f'{args.id}_rig'
        clips_enemy.rigid_clips(arm, args.kind, hi.z - lo.z)
    tmp = tempfile.mkdtemp(prefix='tripo_enemy_')
    raw = os.path.join(tmp, 'raw.glb')
    normalize.export_glb(raw, [arm, body])
    os.makedirs(args.out, exist_ok=True)
    out = os.path.join(args.out, f'{args.id}.glb')
    extras = dict(id=args.id, source='tripo', style='textured', kind=args.kind, height=round(ref, 4),
                  unitScale=round(1 / STORE_SCALE, 5), generator='tools/tripo/build_tripo_enemy.py')
    stats = pack.pack(raw, out, STORE_SCALE, extras, webp_quality=args.webp_quality, tex_size=args.tex)
    js, _ = pack.read_glb(out)
    tri = sum(js['accessors'][p['indices']]['count'] // 3 for m in js['meshes'] for p in m['primitives'])
    verts = sum(js['accessors'][p['attributes']['POSITION']]['count'] for m in js['meshes'] for p in m['primitives'])
    clips = sorted(a['name'] for a in js['animations'])
    print(f'[tripo] {args.id}: {os.path.getsize(out) // 1024} KB, {tri} tris, clips {clips}, {stats}')
    mpath = os.path.join(args.out, 'manifest.json')
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {}
    manifest[args.id] = dict(file=f'{args.id}.glb', size=os.path.getsize(out), triangles=tri, vertices=verts,
                             animations=clips, height=extras['height'], unitScale=extras['unitScale'], kind=args.kind,
                             source='tripo')
    with open(mpath, 'w') as f:
        json.dump(dict(sorted(manifest.items())), f, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
    sys.stdout.flush()
    os._exit(0)
