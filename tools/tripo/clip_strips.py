"""Clip strips for the render-and-look loop: every clip of a shipped figure GLB as a row of frames.

    blender -b --python-use-system-env --python tools/tripo/clip_strips.py -- --glb public/models/characters/luna.glb \
        --out /tmp/strips/luna.png [--frames 10] [--view battle|front|side|face] [--size 220] [--margin 1.12] [--yaw 25]
        [--shading texture|color]
    blender -b --python-use-system-env --python tools/tripo/clip_strips.py -- --glb a.glb b.glb --out /tmp/strips/

Imports the GLB exactly as the game ships it (rig, weights, clips), then renders each clip at --frames evenly spaced
times (workbench, textured) from the battle camera's angle (48 degrees down, a quarter turn to the side: --yaw) or from
the front / side, one row per clip with its name and frame times, so the poses can be judged by eye: does the pose
read, are the feet planted, is any frame a T-pose, do wrists or shoulders candy-wrap, does anything clip through
the skirt or hair, does a weapon swing the right way, is the face turned away from the camera. --margin frames more
than the rest pose (an enemy's raised club or its fall). --view face: the battle camera's angle on the head only (the
close-up). --shading color: Cycles (CPU, few samples, denoised) with the file's own materials, so the Blender-built
girls' vertex colours show next to their painted face (workbench 'texture' shows only textures: they read grey).
Several --glb: one sheet each, <out>/<name>.png. Needs Pillow for the sheet (PYTHONPATH with Pillow, see
docs/art/tripo/model-quality.md)."""
import argparse
import math
import os
import sys
import tempfile

import bpy
from mathutils import Vector


def face_cell(cell=0, grid=3):
    """Shows one cell of a Blender girl's painted face atlas (material 'head'), the way the game does with the
    texture's repeat 1/grid and its offset (glbChibi.js updateFace): cell 0 is the resting face. The importer flips v,
    so the cell's top-left in the image is (col/grid, 1 - row/grid) in Blender's UVs."""
    for mat in bpy.data.materials:
        if not mat.name.startswith('head') or not mat.use_nodes:
            continue
        nt = mat.node_tree
        tex = next((n for n in nt.nodes if n.type == 'TEX_IMAGE'), None)
        if tex is None:
            continue
        uv = nt.nodes.new('ShaderNodeUVMap')
        mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (1 / grid, 1 / grid, 1)
        mp.inputs['Location'].default_value = ((cell % grid) / grid, 1 - (cell // grid + 1) / grid, 0)
        nt.links.new(uv.outputs['UV'], mp.inputs['Vector'])
        nt.links.new(mp.outputs['Vector'], tex.inputs['Vector'])
        tex.extension = 'EXTEND'


def strips(path, out, args):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and o.name.startswith('Icosphere'):
            bpy.data.objects.remove(o)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    bpy.context.view_layer.update()
    pts = [m.matrix_world @ v.co for m in meshes for v in m.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    H = hi.z - lo.z
    ctr = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z + H * 0.5))
    sc = bpy.context.scene
    sc.view_settings.view_transform = 'Standard'
    sc.render.resolution_x = sc.render.resolution_y = args.size
    sc.render.fps = 30
    sc.world = bpy.data.worlds.new('w')
    if args.shading == 'color':
        face_cell(args.cell)
        sc.render.engine = 'CYCLES'
        sc.cycles.device = 'CPU'
        sc.cycles.samples = 12
        sc.cycles.use_denoising = True  # flat toon-like colours (and boards that compress)
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
        sc.world.use_nodes = True
        bg = sc.world.node_tree.nodes['Background']
        bg.inputs['Color'].default_value = (0.16, 0.16, 0.19, 1)
        bg.inputs['Strength'].default_value = 2.2
        sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
        sun.data.energy = 2.6
        sun.data.angle = 0.3
        sc.collection.objects.link(sun)
        sun.rotation_euler = (math.radians(40), math.radians(-12), math.radians(25))
    else:
        sc.render.engine = 'BLENDER_WORKBENCH'
        sc.display.shading.light = 'STUDIO'
        sc.display.shading.color_type = 'TEXTURE'
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = max(H, hi.x - lo.x, hi.y - lo.y) * args.margin
    if args.view == 'face':
        # the head only: the head bone's mesh (rest pose) framed from the battle camera's angle
        hb = arm.data.bones.get('head')
        hz = (arm.matrix_world @ hb.head_local).z if hb else lo.z + H * 0.7
        ctr = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (hz + hi.z) / 2))
        cam.data.ortho_scale = (hi.z - hz) * 1.5 * args.margin
    if args.view in ('battle', 'face'):
        # the battle camera looks down 48 degrees; a girl faces the road, so seen a little from the side
        pitch, yaw = math.radians(48), math.radians(args.yaw)
        d = Vector((math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch)))
    elif args.view == 'front':
        d = Vector((0, -1, 0.08)).normalized()
    else:
        d = Vector((1, 0, 0.05)).normalized()
    cam.location = ctr + d * 10
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    acts = sorted(bpy.data.actions, key=lambda a: a.name)
    if args.clips:
        want = args.clips.split(',')
        acts = [a for a in acts if any(a.name.startswith(w) for w in want)]
    tmp = tempfile.mkdtemp(prefix='strips_')
    rows = []
    for act in acts:
        arm.animation_data.action = act
        f0, f1 = act.frame_range
        row = []
        for k in range(args.frames):
            f = f0 + (f1 - f0) * k / max(1, args.frames - 1)
            sc.frame_set(int(math.floor(f)), subframe=f - math.floor(f))
            p = os.path.join(tmp, f'{act.name}_{k}.png')
            sc.render.filepath = p
            bpy.ops.render.render(write_still=True)
            row.append((p, (f - f0) / sc.render.fps))
        rows.append((act.name.split('_' + arm.name)[0], row))
    from PIL import Image, ImageDraw
    S = args.size
    sheet = Image.new('RGB', (args.frames * S, len(rows) * (S + 18)), (40, 40, 46))
    dr = ImageDraw.Draw(sheet)
    for r, (name, row) in enumerate(rows):
        y = r * (S + 18)
        dr.text((4, y + 3), name, fill=(255, 230, 120))
        for c, (p, t) in enumerate(row):
            im = Image.open(p).convert('RGB')
            sheet.paste(im, (c * S, y + 18))
            dr.text((c * S + 4, y + 20), f'{t:.2f}s', fill=(255, 255, 255))
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    sheet.save(out)
    print(f'[strips] {out} {sheet.size}')


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--glb', required=True, nargs='+')
    ap.add_argument('--out', required=True, help='a .png for one GLB, or a folder (one <name>.png per GLB)')
    ap.add_argument('--frames', type=int, default=10)
    ap.add_argument('--view', default='battle', choices=['battle', 'front', 'side', 'face'])
    ap.add_argument('--shading', default='texture', choices=['texture', 'color'])
    ap.add_argument('--cell', type=int, default=0, help='color shading: the face atlas cell shown (0 = resting face)')
    ap.add_argument('--yaw', type=float, default=25.0, help='battle view: degrees to the side of the figure')
    ap.add_argument('--size', type=int, default=220)
    ap.add_argument('--margin', type=float, default=1.12, help='frame size over the rest pose bounds')
    ap.add_argument('--clips', default=None, help='comma list (default: every clip)')
    args = ap.parse_args(argv)
    for path in args.glb:
        out = args.out if args.out.endswith('.png') and len(args.glb) == 1 else \
            os.path.join(args.out, os.path.basename(path).replace('.glb', '.png'))
        strips(path, out, args)


if __name__ == '__main__':
    main()
    sys.stdout.flush()
    os._exit(0)
