"""Landmark views for fitting a rig by hand: front, side, top and back of a shipped figure GLB in the 1 m frame
(feet on z = 0, facing -Y, its left +X) in its rest pose, with a 0.05 grid and labelled axes, and the same views
coloured by the bone that dominates each vertex (a fixed colour per bone name, so a wrong fit shows at a glance: an
arm in the head's colour, a hand bone with no vertices at all).

    blender -b --python-use-system-env --python tools/tripo/landmark_views.py -- \
        --glb public/models/enemies/tripo/orc_grunt.glb [more.glb ...] --out /tmp/views [--size 560]

One sheet per GLB: <out>/<name>.png. The landmarks of tools/tripo/rerig_tripo_enemy.py (ENEMIES: shoulder,
elbow, wrist and fingertip points, hips, neck, props) and tools/tripo/rerig_tripo_chibi.py (FIGURES) are read off
these sheets. Needs Pillow for the sheet (see docs/art/tripo/model-quality.md)."""
import argparse
import colorsys
import os
import sys
import tempfile

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from tripolib import normalize  # noqa: E402

VIEWS = {
    # name: (direction from the centre to the camera, horizontal axis, vertical axis)
    'front': (Vector((0, -1, 0)), 'x', 'z'),   # its left on the right of the picture
    'side': (Vector((1, 0, 0)), 'y', 'z'),     # seen from its left: its front (-Y) on the left of the picture
    'top': (Vector((0, 0, 1)), 'x', 'y'),      # its front (-Y) down
    'back': (Vector((0, 1, 0)), 'x', 'z'),
}
SPAN = 1.1
# a fixed colour per bone (left and right differ), others by hash
PALETTE = {
    'head': (0.95, 0.55, 0.5), 'neck': (0.9, 0.9, 0.9), 'chest': (0.95, 0.85, 0.35), 'spine': (0.7, 0.45, 0.95),
    'hips': (0.35, 0.8, 0.95), 'shoulder_L': (0.2, 0.5, 0.25), 'shoulder_R': (0.45, 0.25, 0.15),
    'upper_arm_L': (0.25, 0.85, 0.35), 'forearm_L': (0.1, 0.6, 0.9), 'hand_L': (0.1, 0.25, 0.85),
    'upper_arm_R': (0.95, 0.5, 0.15), 'forearm_R': (0.9, 0.2, 0.5), 'hand_R': (0.65, 0.1, 0.15),
    'thigh_L': (0.55, 0.9, 0.7), 'shin_L': (0.3, 0.7, 0.6), 'foot_L': (0.15, 0.45, 0.45), 'toe_L': (0.1, 0.3, 0.3),
    'thigh_R': (0.95, 0.7, 0.85), 'shin_R': (0.8, 0.5, 0.7), 'foot_R': (0.6, 0.3, 0.5), 'toe_R': (0.4, 0.2, 0.35),
}


def colour(name):
    if name in PALETTE:
        return PALETTE[name]
    h = sum(ord(c) * (i + 7) for i, c in enumerate(name or '-'))
    return colorsys.hsv_to_rgb((h * 0.618) % 1.0, 0.6, 0.9)


def render_one(path, out, size, weights):
    normalize.reset()
    arm, meshes = normalize.import_glb(path)
    if arm:
        arm.animation_data_create()
        arm.animation_data.action = None
        for pb in arm.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
            pb.scale = (1, 1, 1)
    normalize.bake_world(arm, meshes)
    lo, hi = normalize.bounds(meshes)
    s = 1.0 / (hi.z - lo.z)
    normalize.bake_world(arm, meshes, Matrix.Scale(s, 4) @ Matrix.Translation((0, 0, -lo.z)))
    lo, hi = normalize.bounds(meshes)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'FLAT'
    sc.view_settings.view_transform = 'Standard'
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.world = bpy.data.worlds.new('w')
    sc.render.film_transparent = True
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = SPAN
    tmp = tempfile.mkdtemp(prefix='views_')
    shots = []
    legend = paint_weights(meshes) if weights else None
    for mode in ['TEXTURE'] + (['VERTEX'] if weights else []):
        sc.display.shading.color_type = mode
        for name, (d, ha, va) in VIEWS.items():
            c = Vector((0, 0, 0.5)) if name != 'top' else Vector((0, 0, 0))
            cam.location = c + d * 5
            # looking down: picture up = +Y (its back), right = +X; otherwise picture up = +Z
            cam.rotation_euler = (0, 0, 0) if name == 'top' else (-d).to_track_quat('-Z', 'Y').to_euler()
            p = os.path.join(tmp, f'{mode}_{name}.png')
            sc.render.filepath = p
            bpy.ops.render.render(write_still=True)
            shots.append((mode, name, p, c, ha, va))
    sheet(shots, path, out, size, legend, lo, hi)


def paint_weights(meshes):
    """Vertex colours by dominant bone; returns [(bone, colour, count)]."""
    counts = {}
    for ob in meshes:
        col = ob.data.color_attributes.new('bone', 'BYTE_COLOR', 'POINT')
        gname = {g.index: g.name for g in ob.vertex_groups}
        for v in ob.data.vertices:
            best, bw = '(none)', -1
            for g in v.groups:
                if g.weight > bw:
                    bw, best = g.weight, gname[g.group]
            counts[best] = counts.get(best, 0) + 1
            col.data[v.index].color = colour(best) + (1,)
        ob.data.color_attributes.active_color = col
    return [(b, colour(b), n) for b, n in sorted(counts.items())]


def sheet(shots, path, out, S, legend, lo, hi):
    from PIL import Image, ImageDraw
    cols = 4
    rows = (len(shots) + cols - 1) // cols
    leg_h = 0 if not legend else 18 * ((len(legend) + 5) // 6) + 8
    img = Image.new('RGB', (cols * S, rows * S + 24 + leg_h), (30, 30, 34))
    dr = ImageDraw.Draw(img)
    dr.text((6, 5), f'{os.path.basename(path)}  1 m frame: x {lo.x:.3f}..{hi.x:.3f}  y {lo.y:.3f}..{hi.y:.3f}  '
            'grid 0.05 (labels every 0.1); front: its left on the right; side: its front on the left; top: its front down',
            fill=(255, 230, 140))
    for i, (mode, name, p, c, ha, va) in enumerate(shots):
        fig = Image.open(p).convert('RGBA')
        im = Image.new('RGB', (S, S), (30, 30, 36))
        d = ImageDraw.Draw(im)
        ch = {'x': c.x, 'y': c.y, 'z': c.z}
        flip_h = name == 'back'   # picture-right is -x seen from the back
        for k in range(-12, 13):
            hv = round(ch[ha] / 0.05) * 0.05 + k * 0.05
            X = (hv - ch[ha]) / SPAN * S + S / 2
            if flip_h:
                X = S - X
            bright = round(hv / 0.05) % 2 == 0
            d.line([(X, 0), (X, S)], fill=(110, 110, 130) if bright else (62, 62, 74), width=1)
            if bright:
                d.text((X + 2, S - 12), f'{hv:+.1f}', fill=(170, 170, 190))
            vv = round(ch[va] / 0.05) * 0.05 + k * 0.05
            Y = S / 2 - (vv - ch[va]) / SPAN * S
            bright = round(vv / 0.05) % 2 == 0
            d.line([(0, Y), (S, Y)], fill=(110, 110, 130) if bright else (62, 62, 74), width=1)
            if bright:
                d.text((2, Y - 11), f'{vv:.1f}', fill=(170, 170, 190))
        im.paste(fig, (0, 0), fig)
        d = ImageDraw.Draw(im)
        d.text((4, 4), f'{name} ({"texture" if mode == "TEXTURE" else "dominant bone"})', fill=(255, 255, 0))
        img.paste(im, ((i % cols) * S, 24 + (i // cols) * S))
    if legend:
        y0 = 24 + rows * S + 4
        w = cols * S // 6
        for k, (b, col, n) in enumerate(legend):
            x = (k % 6) * w + 6
            y = y0 + (k // 6) * 18
            dr.rectangle([x, y + 2, x + 12, y + 14], fill=tuple(int(v * 255) for v in col))
            dr.text((x + 18, y + 2), f'{b} {n}', fill=(230, 230, 230))
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    img.save(out)
    print(f'[views] {out} {img.size}')


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--glb', required=True, nargs='+')
    ap.add_argument('--out', required=True, help='a folder (one <name>.png per GLB), or a .png for one GLB')
    ap.add_argument('--size', type=int, default=560)
    ap.add_argument('--no-weights', action='store_true', help='textured views only')
    args = ap.parse_args(argv)
    for path in args.glb:
        out = args.out if args.out.endswith('.png') and len(args.glb) == 1 else \
            os.path.join(args.out, os.path.basename(path).replace('.glb', '.png'))
        render_one(path, out, args.size, not args.no_weights)


if __name__ == '__main__':
    main()
    sys.stdout.flush()
    os._exit(0)
