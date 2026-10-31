"""A Tripo placed prop or companion as one static textured mesh (Norika's barricade, Suzu's bell,
Big Yellow) for the instanced layers that move them (src/render/staffFx.js, src/render/placedProps.js).

    python3.11 tools/tripo/build_tripo_prop.py --source <text_to_model model.glb> --id suzu_bell \
        --node bell --height 0.42 --tris 800 --tex 512

Steps: import, turn to the game's front (Tripo's objects face +X in Blender; --yaw), pivot under the
centre on the floor, scale to --height (or --width across X), decimate to --tris, one mesh node named
--node, then the Meshy phone packing (int16 positions, int8 normals, WebP base colour at --tex).
Writes public/models/props/<id>.glb. extras: { id, source: 'tripo', style: 'textured-prop', node, height,
width, depth } (game units, glTF: +Y up, +Z front)."""
import argparse
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from tripolib import normalize  # noqa: E402
from tripolib.meshy import pack  # noqa: E402


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', required=True)
    ap.add_argument('--id', required=True)
    ap.add_argument('--node', required=True)
    ap.add_argument('--height', type=float, default=None)
    ap.add_argument('--width', type=float, default=None, help='size across X instead of the height')
    ap.add_argument('--yaw', type=float, default=-90.0)
    ap.add_argument('--tris', type=int, default=800)
    ap.add_argument('--tex', type=int, default=512)
    ap.add_argument('--webp-quality', type=int, default=88)
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'models', 'props'))
    args = ap.parse_args(argv)
    normalize.reset()
    arm, meshes = normalize.import_glb(args.source)
    assert len(meshes) == 1 and not arm
    ob = meshes[0]
    lo, hi = normalize.face_front(None, meshes, args.yaw)
    s = (args.width / (hi.x - lo.x)) if args.width else (args.height / (hi.z - lo.z))
    normalize.bake_world(None, meshes, normalize.Matrix.Scale(s, 4))
    tris = normalize.decimate(ob, args.tris)
    ob.name = ob.data.name = args.node
    normalize.name_base_image(meshes)
    lo, hi = normalize.bounds(meshes)
    tmp = tempfile.mkdtemp(prefix='tripo_prop_')
    raw = os.path.join(tmp, 'raw.glb')
    normalize.export_glb(raw, [ob], animations=False)
    out = os.path.join(args.out, f'{args.id}.glb')
    r = lambda v: round(v, 4)  # noqa: E731
    extras = dict(id=args.id, source='tripo', style='textured-prop', node=args.node, height=r(hi.z - lo.z),
                  width=r(hi.x - lo.x), depth=r(hi.y - lo.y), generator='tools/tripo/build_tripo_prop.py')
    pack.pack(raw, out, 1.0, extras, webp_quality=args.webp_quality, tex_size=args.tex)
    print(f'[tripo] {args.id}: {os.path.getsize(out) // 1024} KB, {tris} tris, {extras}')


if __name__ == '__main__':
    main()
    sys.stdout.flush()
    os._exit(0)
