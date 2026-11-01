"""The Green Slime's own model: a glossy mint jelly drop (public/models/enemies/tripo/slime_green.glb + .lod.glb).

    blender -b --python-use-system-env --python tools/blender/enemies/build_slime_green.py
    (or python3.11 with the bpy 4.2 module; needs numpy and Pillow for the packing step)

Replaces the batch-2 website download (docs/art/tripo/batch-2.md row 29), which was a lumpy dark-green ball cut by
a flat ring and a slab through its middle, with the face painted on the front and again on the back, and a single
rigid bone, so its squash hardly showed. This one is built here from scratch, after the game's own slime art (the
"Hi!" sticker, public/art/stickers/slime_hi-256.webp): a soft gumdrop dome, wider at the base, mint green with a
paler glowing hem, big glossy eyes with two highlights each, pink blush, a small open smile and a sakura petal on
its crown. The glossy jelly look is finished in the game (glbEnemy.js 'jelly' look: rim light and a crisp toon
highlight on top of the painted texture).

Rig: root (floor) -> body (lower half, squashes from the floor up) -> top (upper half, lags and wobbles). Weights
blend smoothly from body to top up the dome; the petal rides the top. 'top' is the blob families' head slot, so
event hats sit on its crown like on the other slimes (glbEnemy.js SLOT_BONES).

Clips (30 fps, the family lengths): move 1.0 s (anticipation squash, stretch launch, hop, landing splat, jiggle
settle), idle 1.5 s (breathing squash and a lazy wobble), hit 0.3 s, death 0.8 s (melts flat; the battle then
shrinks it into the ground), special 0.6 s (a happy jump spin).

Output: two files (full: 64 x 36 dome, 512 px texture; LOD: 32 x 18, 256 px), Meshy phone packing (int16
positions, WebP, half-scale storage, extras.unitScale 2), manifest entry in enemies/tripo/manifest.json
(source 'blender', kind 'blob'). extras.height 0.82: the game scales the model to 0.6 x EnemyDef.size per
`height`, which keeps it about as wide on the road as the model it replaces."""
import json
import math
import os
import sys
import tempfile

import bpy
import bmesh
import numpy as np
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'tripo'))

from tripolib import normalize, compat  # noqa: E402
from tripolib.meshy import pack  # noqa: E402

OUT = os.path.join(ROOT, 'public', 'models', 'enemies', 'tripo')
ID = 'slime_green'
W, H = 1.0, 0.8           # model width and height (Blender units, before the half-scale storage)
GAME_HEIGHT = 0.82        # extras.height
STORE_SCALE = 0.5
FPS = 30

MINT = np.array([0x8f, 0xe6, 0xbc]) / 255
MINT_TOP = np.array([0xa9, 0xef, 0xcf]) / 255
MINT_HEM = np.array([0xd2, 0xf8, 0xe6]) / 255
MINT_BACK = np.array([0x78, 0xd6, 0xab]) / 255
EYE = np.array([0x2b, 0x24, 0x3f]) / 255
EYE_LOW = np.array([0x3d, 0x5c, 0x8f]) / 255     # a blue glint at the bottom of the eye, like the sticker's
WHITE = np.array([1.0, 1.0, 1.0])
BLUSH = np.array([0xff, 0x9a, 0xb4]) / 255
MOUTH = np.array([0x6a, 0x2c, 0x3e]) / 255
TONGUE = np.array([0xff, 0x8f, 0xa6]) / 255
PETAL = np.array([0xff, 0xb7, 0xcb]) / 255
PETAL_TIP = np.array([0xff, 0xe3, 0xec]) / 255
BODY_V = (0.06, 0.98)     # texture rows of the dome (bottom .. top); below: the petal swatch


def dome_point(theta, phi):
    """Unit-sphere angles -> mochi dome surface (z up, front -Y). phi 0 = bottom pole, pi = top pole. Two
    superellipse halves that meet with a vertical tangent at the widest ring (a quarter of the way up): a full,
    round crown above, a flat bottom with a soft rounded hem below."""
    a = phi - math.pi / 2                              # -pi/2 bottom .. pi/2 top
    R, hc, hu, nu, nl = 0.5, 0.2, 0.6, 2.3, 3.2
    c, s = max(0.0, math.cos(a)), math.sin(a)
    if a >= 0:
        r, z = R * c ** (2 / nu), hc + hu * s ** (2 / nu)
    else:
        r, z = R * c ** (2 / nl), hc - hc * (-s) ** (2 / nl)
    return Vector((r * math.sin(theta), -r * math.cos(theta), z))


def build_mesh(segs, rings):
    bm = bmesh.new()
    rows = []
    top = bm.verts.new(dome_point(0, math.pi))
    bot = bm.verts.new(dome_point(0, 0))
    for i in range(1, rings):
        phi = math.pi * i / rings
        rows.append([bm.verts.new(dome_point(2 * math.pi * j / segs, phi)) for j in range(segs)])
    for i in range(len(rows) - 1):
        a, b = rows[i], rows[i + 1]
        for j in range(segs):
            bm.faces.new((a[j], a[(j + 1) % segs], b[(j + 1) % segs], b[j]))
    for j in range(segs):
        bm.faces.new((bot, rows[0][(j + 1) % segs], rows[0][j]))
        bm.faces.new((top, rows[-1][j], rows[-1][(j + 1) % segs]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(ID)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(ID, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def build_petal():
    """A small sakura petal lying on the crown, tipped forward (two lobes with a notch at the tip)."""
    bm = bmesh.new()
    n = 24
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        x = 0.1 * math.sin(a)
        y = 0.14 * math.cos(a)
        if math.cos(a) > 0:                           # the tip end: notch in the middle
            y -= 0.045 * math.exp(-(math.sin(a) / 0.18) ** 2) * math.cos(a)
        else:
            y *= 0.8                                  # the stem end is rounder and shorter
        pts.append((x, y))
    top = [bm.verts.new((x, y, 0.016 * (1 - (x / 0.1) ** 2))) for x, y in pts]
    bot = [bm.verts.new((x, y, -0.008)) for x, y in pts]
    c1 = bm.verts.new((0, 0, 0.02))
    c2 = bm.verts.new((0, 0, -0.008))
    for k in range(n):
        bm.faces.new((c1, top[k], top[(k + 1) % n]))
        bm.faces.new((c2, bot[(k + 1) % n], bot[k]))
        bm.faces.new((top[k], bot[k], bot[(k + 1) % n], top[(k + 1) % n]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # curl it a little, lay it on the crown tipped toward the front-left like the sticker's
    for v in bm.verts:
        v.co.z += 1.2 * (v.co.x ** 2) + 0.6 * (v.co.y ** 2)
    M = Matrix.Translation((-0.05, 0.02, H - 0.01)) @ Euler((math.radians(-18), math.radians(-14), math.radians(28))).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    me = bpy.data.meshes.new('petal')
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new('petal', me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


# ---- texture -----------------------------------------------------------------------------------------------------
def uv_of(p):
    u = 0.5 + math.atan2(p.x, -p.y) / (2 * math.pi)
    v = BODY_V[0] + (BODY_V[1] - BODY_V[0]) * max(0.0, min(1.0, p.z / H))
    return u, v


def set_uvs(ob, petal=False):
    me = ob.data
    uv = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        coords = [uv_of(me.vertices[me.loops[li].vertex_index].co) for li in poly.loop_indices]
        if petal:
            coords = [(0.04 + 0.3 * (me.vertices[me.loops[li].vertex_index].co.y + 0.05), 0.022) for li in poly.loop_indices]
        else:
            us = [c[0] for c in coords]
            if max(us) - min(us) > 0.5:               # a face across the back seam: unwrap it past 1
                coords = [(c[0] + 1.0 if c[0] < 0.5 else c[0], c[1]) for c in coords]
            # the poles: u of the pole vertex is meaningless, take the face's mean
            zs = [me.vertices[me.loops[li].vertex_index].co for li in poly.loop_indices]
            for k, p in enumerate(zs):
                if abs(p.x) < 1e-6 and abs(p.y) < 1e-6:
                    others = [coords[m][0] for m in range(len(coords)) if m != k]
                    coords[k] = (sum(others) / len(others), coords[k][1])
        for li, c in zip(poly.loop_indices, coords):
            uv.data[li].uv = c


def radius_at(h):
    """Dome radius at height h (numerically from dome_point)."""
    best = None
    for i in range(1, 400):
        phi = math.pi * i / 400
        p = dome_point(0, phi)
        if best is None or abs(p.z - h) < abs(best.z - h):
            best = p
    return max(0.05, math.hypot(best.x, best.y))


def paint(size):
    """The painted skin: mint gradient, face on the front (u = 0.5), a soft highlight, the petal swatch."""
    S = size * 2                                       # 2x supersampling
    v = (np.arange(S) + 0.5) / S
    u = (np.arange(S) + 0.5) / S
    U, V = np.meshgrid(u, v)                           # image row 0 = v 0 here; flipped at the end
    h = np.clip((V - BODY_V[0]) / (BODY_V[1] - BODY_V[0]), 0, 1) * H
    img = np.zeros((S, S, 3))
    t = h / H
    base = MINT[None, None] * np.ones((S, S, 1))
    base = base + (MINT_TOP - MINT)[None, None] * np.clip((t - 0.55) / 0.45, 0, 1)[..., None]
    base = base + (MINT_HEM - base) * np.clip(1 - t / 0.2, 0, 1)[..., None] ** 1.5
    back = np.clip(np.abs(U - 0.5) * 2, 0, 1)          # 0 front .. 1 back
    base = base + (MINT_BACK - base) * (np.clip((back - 0.45) / 0.55, 0, 1) ** 2 * (1 - np.clip(1 - t / 0.2, 0, 1)))[..., None] * 0.6
    img[:] = base
    # physical coordinates around the front: X along the surface (her left +), Y = height
    rad = np.array([radius_at(hh) for hh in np.linspace(0, H, 81)])
    R = np.interp(h, np.linspace(0, H, 81), rad)
    X = (U - 0.5) * 2 * math.pi * R
    Y = h

    def blend(mask, col, alpha=1.0):
        a = np.clip(mask, 0, 1)[..., None] * alpha
        img[:] = img * (1 - a) + col[None, None] * a

    def ellipse(cx, cy, rx, ry, rot=0.0, soft=0.004):
        c, s = math.cos(rot), math.sin(rot)
        dx, dy = X - cx, Y - cy
        xr, yr = dx * c + dy * s, -dx * s + dy * c
        d = np.sqrt((xr / rx) ** 2 + (yr / ry) ** 2)
        return np.clip((1 - d) * min(rx, ry) / soft, 0, 1)

    front = np.abs(U - 0.5) < 0.3
    ey, ex = 0.43, 0.175
    for k in (-1, 1):
        cx = k * ex
        blend(ellipse(cx + k * 0.035, ey - 0.095, 0.065, 0.03, soft=0.022) * front, BLUSH, 0.8)   # blush
        blend(ellipse(cx, ey, 0.07, 0.094) * front, EYE)                                          # eye
        blend(ellipse(cx, ey - 0.045, 0.05, 0.036, soft=0.014) * front, EYE_LOW, 0.85)           # blue glint low
        blend(ellipse(cx - 0.022, ey + 0.032, 0.028, 0.032) * front, WHITE)                       # big highlight
        blend(ellipse(cx + 0.026, ey - 0.036, 0.013, 0.013) * front, WHITE)                       # small highlight
    # open smile: lower half of an ellipse, a pink tongue in its bottom
    my = ey - 0.065
    mouth = ellipse(0.0, my, 0.045, 0.04) * (Y < my) * front
    blend(mouth, MOUTH)
    blend(ellipse(0.0, my - 0.03, 0.028, 0.016) * mouth, TONGUE)
    # the painted gloss on the crown (the game adds a moving highlight and a rim light on top)
    blend(ellipse(-0.2, 0.66, 0.085, 0.04, rot=0.45, soft=0.03), WHITE, 0.6)
    blend(ellipse(-0.3, 0.58, 0.018, 0.018, soft=0.01), WHITE, 0.75)
    # petal swatch (rows below the dome): pink, paler at one end
    sw = (V < BODY_V[0] * 0.8)
    img[sw] = (PETAL[None] + (PETAL_TIP - PETAL)[None] * np.clip((U[sw] - 0.02) / 0.09, 0, 1)[..., None])
    # 2x -> 1x, rows flipped so v = 0 is the image's bottom
    img = img.reshape(size, 2, size, 2, 3).mean((1, 3))[::-1]
    im = bpy.data.images.new('base', size, size, alpha=False)
    rgba = np.concatenate([img, np.ones((size, size, 1))], 2)[::-1]   # bpy pixels start at the bottom row
    im.pixels.foreach_set(rgba.astype(np.float32).ravel())
    im.pack()
    return im


def material(img):
    mat = bpy.data.materials.new('slime')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 1.0
    bsdf.inputs['Metallic'].default_value = 0.0
    return mat


# ---- rig and clips -----------------------------------------------------------------------------------------------
def rig(body):
    data = bpy.data.armatures.new(f'{ID}_rig')
    arm = bpy.data.objects.new(f'{ID}_rig', data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = data.edit_bones
    r = eb.new('root'); r.head, r.tail = (0, 0, 0), (0, 0, 0.1); r.use_deform = False
    b = eb.new('body'); b.head, b.tail = (0, 0, 0), (0, 0, 0.45 * H); b.parent = r
    t = eb.new('top'); t.head, t.tail = (0, 0, 0.45 * H), (0, 0, H); t.parent = b; t.use_connect = True
    bpy.ops.object.mode_set(mode='OBJECT')
    gb, gt = body.vertex_groups.new(name='body'), body.vertex_groups.new(name='top')
    for v in body.data.vertices:
        k = max(0.0, min(1.0, (v.co.z - 0.22 * H) / (0.58 * H)))
        k = k * k * (3 - 2 * k)
        if k < 0.999:
            gb.add([v.index], 1 - k, 'REPLACE')
        if k > 0.001:
            gt.add([v.index], k, 'REPLACE')
    body.parent = arm
    mod = body.modifiers.new('arm', 'ARMATURE')
    mod.object = arm
    return arm


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def track(keys, t):
    """Smooth piecewise interpolation through (t, value...) keys."""
    for (t0, *a), (t1, *b) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            k = smooth((t - t0) / max(t1 - t0, 1e-9))
            return [x + (y - x) * k for x, y in zip(a, b)]
    return list(keys[-1][1:])


def clips(arm):
    pbs = arm.pose.bones
    for pb in pbs:
        pb.rotation_mode = 'XYZ'

    def make(name, frames, fn):
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        if not arm.animation_data:
            arm.animation_data_create()
        arm.animation_data.action = act
        for f in range(frames + 1):
            st = fn(f / frames)
            for bn in ('body', 'top'):
                pb = pbs[bn]
                loc, rot, scl = st[bn]
                pb.location = Vector(loc)
                pb.rotation_euler = Euler([math.radians(a) for a in rot], 'XYZ')
                pb.scale = Vector(scl)
                for path in ('location', 'rotation_euler', 'scale'):
                    pb.keyframe_insert(path, frame=f, group=bn)
        compat.linear(act)
        return act

    def squash(sy):
        s = 1 / math.sqrt(max(sy, 0.05))
        return (s, sy, s)                              # bone axes: Y up the dome

    def move(t):
        # t, lift (share of H), stretch
        lift, sy = track([(0, 0, 1.0), (0.12, 0, 0.8), (0.2, 0.03, 1.2), (0.4, 0.24, 1.05), (0.56, 0.08, 1.12),
                          (0.64, 0, 0.76), (0.74, 0, 1.1), (0.84, 0, 0.94), (0.93, 0, 1.03), (1.0, 0, 1.0)], t)
        lean, wob = track([(0, 0, 0), (0.12, -6, 0), (0.22, 10, 0), (0.45, 0, 0), (0.6, -8, 0), (0.7, 6, 1),
                           (0.82, -4, -1), (0.92, 2, 0.5), (1.0, 0, 0)], t)
        tsy = track([(0, 1.0), (0.14, 0.94), (0.24, 1.08), (0.5, 1.0), (0.68, 0.88), (0.78, 1.08), (0.9, 0.97), (1.0, 1.0)], t)[0]
        return {'body': ((0, lift * H, 0), (lean * 0.4, 0, 0), squash(sy)),
                'top': ((0, 0, 0), (lean, 0, 4 * wob), squash(tsy))}

    def idle(t):
        p = 2 * math.pi * t
        sy = 1 + 0.05 * math.sin(p)
        return {'body': ((0, 0, 0), (0, 0, 0), squash(sy)),
                'top': ((0, 0, 0), (3 * math.sin(p + 0.8), 0, 4 * math.sin(p + 1.6)), squash(1 + 0.03 * math.sin(p + 0.9)))}

    def hit(t):
        k = math.sin(math.pi * t)
        return {'body': ((0, 0, 0), (-6 * k, 0, 0), squash(1 - 0.26 * k)),
                'top': ((0, 0, 0), (-14 * k, 0, 0), squash(1 - 0.1 * k))}

    def death(t):
        k = smooth(t / 0.7)
        return {'body': ((0, 0, 0), (0, 0, 0), (1 + 0.75 * k, max(0.07, 1 - 0.93 * k), 1 + 0.75 * k)),
                'top': ((0, 0, 0), (0, 0, 0), (1 + 0.2 * k, max(0.3, 1 - 0.7 * k), 1 + 0.2 * k))}

    def special(t):
        lift = 0.32 * max(0.0, math.sin(math.pi * min(1.0, max(0.0, (t - 0.12) / 0.72))))
        sy = track([(0, 1.0), (0.12, 0.8), (0.22, 1.18), (0.5, 1.04), (0.8, 1.08), (0.9, 0.82), (1.0, 1.0)], t)[0]
        return {'body': ((0, lift * H, 0), (0, 360 * smooth((t - 0.15) / 0.7), 0), squash(sy)),
                'top': ((0, 0, 0), (0, 0, 0), squash(1.0))}

    acts = [make('move', 30, move), make('idle', 45, idle), make('hit', 9, hit), make('death', 24, death),
            make('special', 18, special)]
    arm.animation_data.action = None
    for pb in pbs:
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
    return acts


# ---- build -------------------------------------------------------------------------------------------------------
def build(lod):
    normalize.reset()
    bpy.context.scene.render.fps = FPS
    segs, rings, tex = (32, 18, 256) if lod else (64, 36, 512)
    body = build_mesh(segs, rings)
    petal = build_petal()
    set_uvs(body)
    set_uvs(petal, petal=True)
    img = paint(tex)
    mat = material(img)
    for o in (body, petal):
        o.data.materials.append(mat)
    for o in bpy.data.objects:
        o.select_set(o in (body, petal))
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = body.data.name = ID
    arm = rig(body)
    clips(arm)
    tmp = tempfile.mkdtemp(prefix='slime_')
    raw = os.path.join(tmp, 'raw.glb')
    normalize.export_glb(raw, [arm, body])
    out = os.path.join(OUT, f'{ID}{".lod" if lod else ""}.glb')
    extras = dict(id=ID, source='blender', style='textured', kind='blob', look='jelly', height=GAME_HEIGHT, lod=lod,
                  unitScale=round(1 / STORE_SCALE, 5), generator='tools/blender/enemies/build_slime_green.py')
    stats = pack.pack(raw, out, STORE_SCALE, extras, webp_quality=92, tex_size=tex)
    js, _ = pack.read_glb(out)
    tri = sum(js['accessors'][p['indices']]['count'] // 3 for m in js['meshes'] for p in m['primitives'])
    verts = sum(js['accessors'][p['attributes']['POSITION']]['count'] for m in js['meshes'] for p in m['primitives'])
    clipnames = sorted(a['name'] for a in js['animations'])
    print(f'[slime] {out}: {os.path.getsize(out)} B, {tri} tris, {verts} verts, clips {clipnames}, {stats}')
    return dict(size=os.path.getsize(out), triangles=tri, vertices=verts, animations=clipnames)


def main():
    full = build(False)
    lod = build(True)
    mpath = os.path.join(OUT, 'manifest.json')
    manifest = json.load(open(mpath))
    manifest[ID] = dict(file=f'{ID}.glb', size=full['size'], triangles=full['triangles'], vertices=full['vertices'],
                        animations=full['animations'], height=GAME_HEIGHT, unitScale=round(1 / STORE_SCALE, 5),
                        kind='blob', source='blender', look='jelly', lod=f'{ID}.lod.glb', lodSize=lod['size'],
                        lodTriangles=lod['triangles'], lodVertices=lod['vertices'])
    with open(mpath, 'w') as f:
        json.dump(dict(sorted(manifest.items())), f, indent=1)
        f.write('\n')
    print('[slime] manifest updated')


if __name__ == '__main__':
    main()
    sys.stdout.flush()
    os._exit(0)
