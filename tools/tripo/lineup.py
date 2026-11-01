"""Lineup: several character GLBs side by side at their in-game size, in one pose, from the front and from the battle
camera, with an optional proportion overlay (docs/art/tripo/staff-models.md).

    blender -b --python-use-system-env --python tools/tripo/lineup.py -- \
        --glb public/models/characters/aoi.glb public/models/characters/akane.glb a.glb b.glb \
        --labels Aoi,Akane,Norika,Kogane --out /tmp/lineup.png [--view front|battle] [--clip idle] [--t 0]
        [--overlay] [--size 1400x700] [--json /tmp/lineup.json]

Each file is imported as the game shows it: its extras.unitScale applied (the Blender girls store half size, the
Tripo / Meshy figures their own scale), so heights compare. The pose is one clip at one time (default idle, 0 s).
Rendered with Cycles (CPU) and the files' own materials; a Blender girl's face atlas shows its resting cell (as
clip_strips.py --shading color). --overlay draws, from the front, the sole, the hair crown, the chin and the crotch of
each figure with its heads-tall and leg share (the crown is the head bone's mesh top: a hat counts, a halo does not).
--json writes the measured lines. Needs Pillow for the overlay (PYTHONPATH, see model-quality.md).
"""
import argparse
import json
import math
import os
import struct
import sys
import tempfile

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from clip_strips import face_cell  # noqa: E402


def glb_extras(path):
    with open(path, 'rb') as f:
        data = f.read(20)
        n = struct.unpack_from('<I', data, 12)[0]
        f.seek(20)
        js = json.loads(f.read(n).decode('utf-8'))
    return js.get('asset', {}).get('extras', {})


def import_one(path, x, clip, t):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in list(new):
        if o.type == 'MESH' and o.name.startswith('Icosphere'):
            bpy.data.objects.remove(o)
            new.remove(o)
    ex = glb_extras(path)
    scale = float(ex.get('unitScale', 1.0))
    roots = [o for o in new if o.parent is None]
    for r in roots:
        r.scale = (r.scale[0] * scale, r.scale[1] * scale, r.scale[2] * scale)
        r.location.x += x
    arm = next((o for o in new if o.type == 'ARMATURE'), None)
    if arm:
        if arm.animation_data is None:
            arm.animation_data_create()
        act = next((a for a in bpy.data.actions if a.name.split('_' + arm.name)[0] == clip and a not in IMPORTED), None)
        arm.animation_data.action = act
    IMPORTED.update(bpy.data.actions)
    return new, arm, t


IMPORTED = set()


def measure(objs, arm):
    """Front-view lines in world units: sole, crown (head-bone mesh top), chin, crotch, centre x, and the bounds."""
    dg = bpy.context.evaluated_depsgraph_get()
    pts, head = [], []
    for o in objs:
        if o.type != 'MESH':
            continue
        names = [g.name for g in o.vertex_groups]
        e = o.evaluated_get(dg)
        me = e.to_mesh()
        mats = [s.name for s in o.material_slots]
        vmat = {}
        for poly in me.polygons:
            for vi in poly.vertices:
                vmat.setdefault(vi, mats[poly.material_index] if mats else '')
        for i, v in enumerate(me.vertices):
            if 'halo' in vmat.get(i, ''):
                continue
            p = o.matrix_world @ v.co
            src = o.data.vertices[i] if i < len(o.data.vertices) else None
            best, bw = None, 0
            for g in (src.groups if src else []):
                if g.weight > bw:
                    bw, best = g.weight, names[g.group]
            if best == 'halo':
                continue
            pts.append(p)
            if best in ('head', 'neck2'):
                head.append(p)
        e.to_mesh_clear()
    sole = min(p.z for p in pts)
    crown = max(p.z for p in head)
    cx = sum(p.x for p in pts) / len(pts)
    front = [p for p in head if abs(p.x - cx) < 0.04 and p.y < sum(q.y for q in head) / len(head)]
    hb = arm.pose.bones.get('head')
    hz = (arm.matrix_world @ hb.head).z
    chin = min((p.z for p in front if p.z > hz - 0.1), default=hz)
    th = arm.pose.bones.get('thigh_L')
    crotch = (arm.matrix_world @ th.head).z - 0.02 * (crown - sole)
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), sole))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return dict(sole=sole, crown=crown, chin=chin, crotch=crotch, cx=cx, lo=lo, hi=hi)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--glb', required=True, nargs='+')
    ap.add_argument('--labels', default=None)
    ap.add_argument('--out', required=True)
    ap.add_argument('--view', default='front', choices=['front', 'battle'])
    ap.add_argument('--clip', default='idle')
    ap.add_argument('--t', type=float, default=0.0, help='seconds into the clip')
    ap.add_argument('--gap', type=float, default=0.62, help='spacing between figures (game units)')
    ap.add_argument('--size', default='1400x700')
    ap.add_argument('--overlay', action='store_true')
    ap.add_argument('--json', default=None)
    ap.add_argument('--yaw', type=float, default=20.0)
    ap.add_argument('--samples', type=int, default=16)
    args = ap.parse_args(argv)
    W, Hpx = (int(x) for x in args.size.split('x'))
    labels = args.labels.split(',') if args.labels else [os.path.basename(g).replace('.glb', '') for g in args.glb]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = 30
    figs = []
    for i, path in enumerate(args.glb):
        objs, arm, t = import_one(path, i * args.gap, args.clip, args.t)
        figs.append((objs, arm))
    face_cell(0)
    sc.frame_set(int(round(args.t * sc.render.fps)))
    bpy.context.view_layer.update()
    meas = [measure(o, a) for o, a in figs]
    lo = Vector((min(m['lo'].x for m in meas), min(m['lo'].y for m in meas), 0.0))
    hi = Vector((max(m['hi'].x for m in meas), max(m['hi'].y for m in meas), max(m['hi'].z for m in meas)))
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = args.samples
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.view_settings.view_transform = 'Standard'
    sc.render.resolution_x, sc.render.resolution_y = W, Hpx
    sc.world = bpy.data.worlds.new('w')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.2, 0.2, 0.24, 1)
    bg.inputs['Strength'].default_value = 2.0
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 2.6
    sun.data.angle = 0.3
    sc.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(40), math.radians(-12), math.radians(25))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    span_x = hi.x - lo.x
    ctr = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, hi.z / 2))
    aspect = W / Hpx
    scale = max(span_x * 1.08, hi.z * 1.12 * aspect)
    cam.data.ortho_scale = scale
    if args.view == 'front':
        d = Vector((0, -1, 0))
    else:
        pitch, yaw = math.radians(48), math.radians(args.yaw)
        d = Vector((math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch)))
    cam.location = ctr + d * 20
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    tmp = tempfile.mkdtemp(prefix='lineup_')
    raw = os.path.join(tmp, 'raw.png')
    sc.render.filepath = raw
    bpy.ops.render.render(write_still=True)
    from PIL import Image, ImageDraw
    im = Image.open(raw).convert('RGB')
    dr = ImageDraw.Draw(im)
    try:
        from PIL import ImageFont
        fnt = ImageFont.truetype('DejaVuSans.ttf', max(12, Hpx // 40))
        small = ImageFont.truetype('DejaVuSans.ttf', max(11, Hpx // 48))
    except OSError:
        fnt = small = None
    px = W / scale  # pixels per unit (ortho, width-limited)

    def to_px(x, z):
        return (W / 2 + (x - ctr.x) * px, Hpx / 2 - (z - ctr.z) * px)
    rows = []
    for (objs, arm), m, lab in zip(figs, meas, labels):
        H = m['crown'] - m['sole']
        head = m['crown'] - m['chin']
        r = dict(label=lab, height=round(H, 3), head=round(head, 3), heads_tall=round(H / head, 2),
                 head_share=round(head / H, 3), leg_share=round((m['crotch'] - m['sole']) / H, 3),
                 torso_share=round((m['chin'] - m['crotch']) / H, 3), top=round(m['hi'].z, 3))
        rows.append(r)
        x0 = to_px(m['cx'], 0)[0]
        if args.view == 'front':
            dr.text((x0 - 62, Hpx - 52), lab, fill=(255, 235, 140), font=fnt)
            if args.overlay:
                for key, colr in (('sole', (180, 180, 190)), ('crown', (255, 120, 120)), ('chin', (255, 200, 90)), ('crotch', (120, 200, 255))):
                    y = to_px(0, m[key])[1]
                    dr.line([(x0 - 0.26 * px, y), (x0 + 0.26 * px, y)], fill=colr, width=2)
                dr.text((x0 - 62, Hpx - 34), f"{r['heads_tall']:.2f} heads, legs {r['leg_share']:.2f}", fill=(255, 255, 255), font=small)
                dr.text((x0 - 62, Hpx - 18), f"top {r['height']:.2f}, head {r['head_share']:.2f}", fill=(220, 220, 230), font=small)
        else:
            dr.text((x0 - 50, Hpx - 26), lab, fill=(255, 235, 140), font=fnt)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    im.save(args.out)
    if args.json:
        with open(args.json, 'w') as f:
            json.dump(rows, f, indent=1)
    for r in rows:
        print('[lineup]', json.dumps(r))
    print('[lineup]', args.out)


if __name__ == '__main__':
    main()
    sys.stdout.flush()
    os._exit(0)
