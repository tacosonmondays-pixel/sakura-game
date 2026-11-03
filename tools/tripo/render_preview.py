"""Preview sheet for a processed (game) GLB: four views (front, three-quarter, side, back) and, when
the file has clips, one frame from each clip (front three-quarter). Blender workbench, flat light,
texture colours, a light-grey floor grid line at the feet.

    python3.11 tools/tripo/render_preview.py --glb public/models/characters/kogane.glb --out sheet.png
"""
import argparse
import math
import os
import sys
import tempfile

import bpy
from mathutils import Vector


def setup(size):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'FLAT'
    sc.display.shading.color_type = 'TEXTURE'
    sc.display.shading.show_object_outline = True
    sc.display.shading.object_outline_color = (0.1, 0.1, 0.15)
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.render.film_transparent = True
    sc.world = bpy.data.worlds.new('w') if not sc.world else sc.world
    sc.display.shading.background_type = 'VIEWPORT'
    sc.display.shading.background_color = (0.93, 0.92, 0.95)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    return sc, cam


def bounds():
    pts = []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        e = o.evaluated_get(dg)
        m = e.to_mesh()
        pts += [o.matrix_world @ v.co for v in m.vertices]
        e.to_mesh_clear()
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def shoot(sc, cam, yaw, path, lo, hi, elev=8.0):
    c = (lo + hi) / 2
    r = max((hi - lo).length * 0.62, 1e-3)
    cam.data.ortho_scale = r * 1.65
    y, e = math.radians(yaw), math.radians(elev)
    # yaw 0 = in front of the figure (it faces -Y)
    cam.location = c + Vector((math.sin(y) * math.cos(e), -math.cos(y) * math.cos(e), math.sin(e))) * r * 4
    d = (c - cam.location).normalized()
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--glb', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--size', type=int, default=360)
    ap.add_argument('--label', default=None)
    ap.add_argument('--frames', default=None, help='clip:fraction list, e.g. walk:0.25,attack_wrench:0.4')
    args = ap.parse_args(argv)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=args.glb)
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and o.name.startswith('Icosphere'):
            bpy.data.objects.remove(o)
    sc, cam = setup(args.size)
    arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    if arm and arm.animation_data:
        arm.animation_data.action = None
    if arm:
        for pb in arm.pose.bones:
            pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    lo, hi = bounds()
    tmp = tempfile.mkdtemp()
    shots = []
    for i, yaw in enumerate((0, 35, 90, 180)):
        p = os.path.join(tmp, f'v{i}.png'); shoot(sc, cam, yaw, p, lo, hi); shots.append(p)
    clips = []
    if arm:
        acts = sorted(bpy.data.actions, key=lambda a: a.name)
        want = dict(x.split(':') for x in args.frames.split(',')) if args.frames else {}
        for a in acts:
            name = a.name.replace(f'_{arm.name}', '')  # the importer suffixes '<clip>_<armature>'
            frac = float(want.get(name, {'idle': 0.25, 'walk': 0.25, 'cheer': 0.4, 'hurt': 0.5}.get(name, 0.4)))
            arm.animation_data.action = a
            f0, f1 = a.frame_range
            sc.frame_set(int(round(f0 + (f1 - f0) * frac)))
            bpy.context.view_layer.update()
            p = os.path.join(tmp, f'c_{name}.png'); shoot(sc, cam, 30, p, lo - Vector((0.1, 0.1, 0)) * (hi.z - lo.z), hi + Vector((0.1, 0.1, 0.15)) * (hi.z - lo.z)); clips.append((name, p))
    from PIL import Image, ImageDraw
    n = max(4, len(clips))
    S = args.size
    W = Image.new('RGB', (S * n, S * (2 if clips else 1) + 26), (255, 255, 255))
    d = ImageDraw.Draw(W)
    d.text((6, 6), args.label or os.path.basename(args.glb), fill=(20, 20, 30))
    def put(p, xy):
        im = Image.open(p).convert('RGBA')
        bg = Image.new('RGBA', im.size, (236, 233, 242, 255))
        W.paste(Image.alpha_composite(bg, im).convert('RGB'), xy)
    for i, p in enumerate(shots):
        put(p, (i * S, 26))
    for i, (name, p) in enumerate(clips):
        put(p, (i * S, 26 + S))
        d.text((i * S + 6, 26 + S + 4), name, fill=(20, 20, 30))
    W.save(args.out)
    print('[preview]', args.out)


if __name__ == '__main__':
    main()
    sys.stdout.flush()
    os._exit(0)
