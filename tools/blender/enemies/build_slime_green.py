"""The Green Slime's own model: a chibi mint jelly with a face that never stretches
(public/models/enemies/tripo/slime_green.glb + .lod.glb). Notes: docs/art/tripo/slime-goblin-faces.md.

    blender -b --python-use-system-env --python tools/blender/enemies/build_slime_green.py
    (or python3.11 with the bpy 4.2 module; needs numpy and Pillow for the packing step)

After the game's own slime art (the "Hi!" sticker, public/art/stickers/slime_hi-256.webp): a soft mochi dome, wider at
the base, mint with a paler hem and a gloss on its crown, a sakura petal on top, and a big friendly face: dark glossy
eyes with two white highlights each and a blue glint low in the eye, an open smile with a pink tongue, pink blush.

The owner (Nov 1): "make sure the faces dont get warped, stretched, get fuzzy!". The earlier jelly painted its face
into the body texture, so every squash flattened the eyes and its melt-away death smeared them to nothing; the
family slime's face is a painted atlas cell, soft when small. Here the face is geometry (tripolib/face.py):
  * eyes, highlights, mouth, tongue and blush are small flat-shaded vertex-coloured shapes in their own material
    ('face'), shrink-wrapped onto the dome a few millimetres out: no texture, so nothing blurs at any zoom or LOD;
  * each part is weighted wholly to its own bone (eye_L, eye_R, mouth, blush_L, blush_R) under the root, never under
    the squashing body: every frame of every clip poses those bones where the squashed surface has taken the part's
    anchor, turned with the surface there, at scale 1. A part moves, turns and bobs with the jelly but its shape is
    the same in every frame (tests/models/slimeGoblinFaces.test.js checks the world scale and the shape);
  * the face is on the front only; the game never outlines it (glbEnemy.js: no hull on the face material).

Rig: root (floor) -> jelly (the hop, lean and spin; no scale) -> body (lower half, squashes from the floor up) -> top
(upper half: the crown, lags and wobbles), and the five face bones under jelly. 'top' is the blob families' head slot, so event hats sit on its crown (glbEnemy.js SLOT_BONES).

Clips (30 fps, the family lengths): move 1.0 s (anticipation squash, stretch launch, hop, landing splat, jiggle
settle), idle 1.5 s (breathing squash and a lazy wobble), hit 0.3 s, death 0.8 s (a flinch, then it slumps into a
wide puddle-ish dome and sighs; the battle then shrinks it into the ground), special 0.6 s (a happy jump spin). The
squash stays within what the rigid face can ride (the build prints how far each part strays from the squashed
surface in every frame and fails past MIN_LIFT / MAX_FLOAT).

Output: two files (full: 56 x 30 dome, 512 px body texture; LOD: 32 x 20, 256 px, fewer face segments), Meshy phone
packing (int16 positions, WebP, half-scale storage, extras.unitScale 2), manifest entry in enemies/tripo/manifest.json
(source 'blender', kind 'blob', look 'jelly', face 'geometry'). extras.height 0.82: the game scales the model to
0.6 x EnemyDef.size per `height`."""
import json
import math
import os
import sys
import tempfile

import bpy
import bmesh
import numpy as np
from mathutils import Euler, Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'tripo'))

from tripolib import normalize, compat  # noqa: E402
from tripolib.face import FaceParts, linear, mix, rigid_fit, smooth, strip_colors  # noqa: E402
from tripolib.meshy import pack  # noqa: E402

OUT = os.path.join(ROOT, 'public', 'models', 'enemies', 'tripo')
ID = 'slime_green'
W, H = 1.0, 0.8           # model width and height (Blender units, before the half-scale storage)
GAME_HEIGHT = 0.82        # extras.height
STORE_SCALE = 0.5
FPS = 30
# in every frame of every clip each face vertex stays at least MIN_LIFT out of the squashed surface (never into the
# jelly) and at most MAX_FLOAT further out than at rest (never floating off it); model units (the slime is 0.8 tall)
MIN_LIFT = 0.0008
# where the body -> top blend starts and ends (shares of the height)
TOP_BLEND = (0.45, 0.95)
MAX_FLOAT = 0.005

MINT = np.array([0x8f, 0xe6, 0xbc]) / 255
MINT_TOP = np.array([0xaa, 0xf0, 0xd0]) / 255
MINT_HEM = np.array([0xd4, 0xf8, 0xe7]) / 255
MINT_BACK = np.array([0x76, 0xd4, 0xa9]) / 255
WHITE = np.array([1.0, 1.0, 1.0])
PETAL = np.array([0xff, 0xb7, 0xcb]) / 255
PETAL_TIP = np.array([0xff, 0xe3, 0xec]) / 255
BODY_V = (0.06, 0.98)     # texture rows of the dome (bottom .. top); below: the petal swatch

# the face (linear colours for the vertex colour attribute)
EYE_TOP = linear('#1a1530')
EYE_MID = linear('#241c3e')
EYE_LOW = linear('#3a64a8')       # the blue glint low in the eye, like the sticker's
HILITE = linear('#ffffff')
MOUTH = linear('#5c2036')
TONGUE = linear('#ff8aa5')
BLUSH = linear('#ff9fb8')
BLUSH_EDGE = linear('#ffbccb')

# face anchors: (arc along the surface from the front centre, + = its left = the viewer's right; height)
ANCHORS = {'eye_L': (0.172, 0.43), 'eye_R': (-0.172, 0.43), 'mouth': (0.0, 0.342), 'blush_L': (0.282, 0.348), 'blush_R': (-0.282, 0.348)}
FACE_BONES = tuple(ANCHORS)


def profile(a):
    """Dome profile at angle a (-pi/2 bottom .. pi/2 top): (radius, height). Two superellipse halves meeting with a
    vertical tangent at the widest ring (a quarter of the way up): a full, round crown, a flat bottom with a soft hem."""
    R, hc, hu, nu, nl = 0.5, 0.2, 0.6, 2.3, 3.2
    c, s = max(0.0, math.cos(a)), math.sin(a)
    if a >= 0:
        return R * c ** (2 / nu), hc + hu * s ** (2 / nu)
    return R * c ** (2 / nl), hc - hc * (-s) ** (2 / nl)


def dome_point(theta, phi):
    """Unit-sphere angles -> dome surface (z up, front -Y). phi 0 = bottom pole, pi = top pole."""
    r, z = profile(phi - math.pi / 2)
    return Vector((r * math.sin(theta), -r * math.cos(theta), z))


def surface_at(arc, z):
    """The dome point at height z, `arc` along the surface from the front centre, and its outward normal."""
    lo, hi = -math.pi / 2, math.pi / 2
    for _ in range(60):
        mid = (lo + hi) / 2
        if profile(mid)[1] < z:
            lo = mid
        else:
            hi = mid
    a = (lo + hi) / 2
    r, _ = profile(a)
    e = 1e-4
    (r0, z0), (r1, z1) = profile(a - e), profile(a + e)
    drdz = (r1 - r0) / (z1 - z0)
    th = arc / r
    p = Vector((r * math.sin(th), -r * math.cos(th), z))
    n = Vector((math.sin(th), -math.cos(th), -drdz)).normalized()
    return p, n


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


# ---- body texture (no face in it) -------------------------------------------------------------------------------
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
            zs = [me.vertices[me.loops[li].vertex_index].co for li in poly.loop_indices]
            for k, p in enumerate(zs):                # the poles: u of the pole vertex is meaningless
                if abs(p.x) < 1e-6 and abs(p.y) < 1e-6:
                    others = [coords[m][0] for m in range(len(coords)) if m != k]
                    coords[k] = (sum(others) / len(others), coords[k][1])
        for li, c in zip(poly.loop_indices, coords):
            uv.data[li].uv = c


def paint(size):
    """The jelly's skin: mint gradient, paler hem, a deeper back, a soft gloss on the crown, the petal swatch. No face:
    the face is geometry."""
    S = size * 2                                       # 2x supersampling
    v = (np.arange(S) + 0.5) / S
    u = (np.arange(S) + 0.5) / S
    U, V = np.meshgrid(u, v)                           # image row 0 = v 0 here; flipped at the end
    t = np.clip((V - BODY_V[0]) / (BODY_V[1] - BODY_V[0]), 0, 1)
    hem = np.clip(1 - t / 0.2, 0, 1)
    base = MINT[None, None] * np.ones((S, S, 1))
    base = base + (MINT_TOP - MINT)[None, None] * np.clip((t - 0.55) / 0.45, 0, 1)[..., None]
    base = base + (MINT_HEM - base) * hem[..., None] ** 1.5
    back = np.clip(np.abs(U - 0.5) * 2, 0, 1)          # 0 front .. 1 back
    base = base + (MINT_BACK - base) * (np.clip((back - 0.45) / 0.55, 0, 1) ** 2 * (1 - hem))[..., None] * 0.6
    img = base.copy()
    # physical coordinates around the front: X along the surface (its left +), Y = height
    hs = np.linspace(0, H, 81)
    rad = np.array([surface_at(0.0, max(1e-3, min(H - 1e-3, hh)))[0].length for hh in hs])
    Y = t * H
    X = (U - 0.5) * 2 * math.pi * np.interp(Y, hs, rad)

    def blend(mask, col, alpha=1.0):
        a = np.clip(mask, 0, 1)[..., None] * alpha
        img[:] = img * (1 - a) + col[None, None] * a

    def ellipse(cx, cy, rx, ry, rot=0.0, soft=0.004):
        c, s = math.cos(rot), math.sin(rot)
        dx, dy = X - cx, Y - cy
        xr, yr = dx * c + dy * s, -dx * s + dy * c
        d = np.sqrt((xr / rx) ** 2 + (yr / ry) ** 2)
        return np.clip((1 - d) * min(rx, ry) / soft, 0, 1)

    # the gloss on the crown, up and to its right (the viewer's left), and a sparkle beside it
    blend(ellipse(-0.2, 0.66, 0.07, 0.032, rot=0.45, soft=0.024), WHITE, 0.45)
    blend(ellipse(-0.3, 0.58, 0.016, 0.016, soft=0.007), WHITE, 0.75)
    blend(ellipse(0.27, 0.6, 0.012, 0.012, soft=0.006), WHITE, 0.55)
    sw = (V < BODY_V[0] * 0.8)
    img[sw] = (PETAL[None] + (PETAL_TIP - PETAL)[None] * np.clip((U[sw] - 0.02) / 0.09, 0, 1)[..., None])
    img = img.reshape(size, 2, size, 2, 3).mean((1, 3))[::-1]
    im = bpy.data.images.new('base', size, size, alpha=False)
    rgba = np.concatenate([img, np.ones((size, size, 1))], 2)[::-1]
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


# ---- the face ----------------------------------------------------------------------------------------------------
def top_weight(z):
    """The body -> top blend up the dome (the share of the 'top' bone): the face band (eyes, mouth, blush) rides
    mostly on the body, the crown above it wobbles on the top bone."""
    return smooth((z - TOP_BLEND[0] * H) / ((TOP_BLEND[1] - TOP_BLEND[0]) * H))


def eye_colour(ex, ey):
    """Dark glossy eye: deep navy, a little lighter in the middle, the blue glint low in the eye."""
    low = smooth((-ey - 0.25) / 0.65)
    c = mix(EYE_TOP, EYE_MID, smooth(1 - math.hypot(ex, ey)))
    return mix(c, EYE_LOW, low * 0.9)


def build_face(body, lod):
    """The face parts on the rest dome. Returns (object, anchors: name -> (point, normal, right, top weight))."""
    parts = FaceParts(body)
    segs = 24 if lod else 40
    anchors = {}
    for name, (arc, z) in ANCHORS.items():
        p, n = surface_at(arc, z)
        fr = FaceParts.frame(p, n)
        anchors[name] = (p, n, fr[1], top_weight(p.z))
        if name.startswith('eye'):
            rx, ry, bulge, lift = 0.07, 0.092, 0.0045, 0.0045
            rings = (0.45, 0.75, 1.0) if not lod else (0.55, 1.0)
            parts.ellipse(fr, rx, ry, eye_colour, lift=lift, group=name, segs=segs, rings=rings, bulge=bulge)
            # the highlights sit on the eye's dome: up-left big, down-right small (both eyes the same way)
            for (hx, hy, hr, hs) in ((-0.36, 0.34, 0.42, segs // 2), (0.4, -0.42, 0.17, max(10, segs // 3))):
                rho2 = hx * hx + hy * hy
                parts.ellipse(fr, rx * hr, rx * hr, HILITE, lift=lift + bulge * (1 - rho2) + 0.0022, group=name,
                              segs=hs, rings=(1.0,), at=(hx * rx, hy * ry))
        elif name == 'mouth':
            # an open smile: a flat-topped half moon, the tongue inside its bottom
            w, d = 0.04, 0.046
            n_arc = 14 if lod else 22
            # the bottom: a half ellipse from its right corner round to its left; the top edge back across, its middle
            # a little lower than the corners (a smile)
            pts = [(w * math.cos(math.pi * k / n_arc), -d * math.sin(math.pi * k / n_arc)) for k in range(n_arc + 1)]
            pts += [(-w + 2 * w * k / 6, -0.005 * math.sin(math.pi * k / 6)) for k in range(1, 6)]
            parts.polygon(fr, pts, MOUTH, lift=0.0038, group=name)
            parts.ellipse(fr, 0.022, 0.012, TONGUE, lift=0.0052, group=name, segs=segs // 2, rings=(1.0,), at=(0.0, -0.029))
        else:
            parts.ellipse(fr, 0.054, 0.027, lambda ex, ey: mix(BLUSH, BLUSH_EDGE, math.hypot(ex, ey) ** 2),
                          lift=0.003, group=name, segs=20 if lod else segs, rings=(1.0,) if lod else (0.6, 1.0))
    # each part follows the patch of body under it (its vertices' surface points, each with its body / top blend)
    for name in anchors:
        base = parts.bases(name)
        anchors[name] = (*anchors[name], np.array([tuple(b) for b in base]), np.array([top_weight(b.z) for b in base]))
    return parts.to_object('face'), anchors


# ---- rig and clips -----------------------------------------------------------------------------------------------
def rig(body, anchors):
    data = bpy.data.armatures.new(f'{ID}_rig')
    arm = bpy.data.objects.new(f'{ID}_rig', data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = data.edit_bones
    r = eb.new('root'); r.head, r.tail = (0, 0, 0), (0, 0, 0.1); r.use_deform = False
    # jelly: the rigid part of the motion (hop, lean, spin); body: the squash; the face bones ride jelly, so their own
    # keys only carry the small squash offsets (a spin baked into their translations would cut chords through the
    # dome between keys)
    j = eb.new('jelly'); j.head, j.tail = (0, 0, 0), (0, 0, 0.2 * H); j.parent = r; j.use_deform = False
    b = eb.new('body'); b.head, b.tail = (0, 0, 0), (0, 0, 0.45 * H); b.parent = j
    t = eb.new('top'); t.head, t.tail = (0, 0, 0.45 * H), (0, 0, H); t.parent = b; t.use_connect = True
    for name, (p, n, right, *_) in anchors.items():
        f = eb.new(name)
        f.head, f.tail = p, p + n * 0.05
        f.align_roll(-n.cross(right))                  # the bone's x along the part's right, y out of the surface
        f.parent = j
    bpy.ops.object.mode_set(mode='OBJECT')
    body.parent = arm
    mod = body.modifiers.new('arm', 'ARMATURE')
    mod.object = arm
    return arm


def weight_body(ob, petal_count):
    """body / top by height for the dome; the petal (the last `petal_count` vertices) wholly on top."""
    gb, gt = ob.vertex_groups.new(name='body'), ob.vertex_groups.new(name='top')
    nv = len(ob.data.vertices)
    for v in ob.data.vertices:
        k = 1.0 if v.index >= nv - petal_count else top_weight(v.co.z)
        if k < 0.999:
            gb.add([v.index], 1 - k, 'REPLACE')
        if k > 0.001:
            gt.add([v.index], k, 'REPLACE')


def track(keys, t):
    """Smooth piecewise interpolation through (t, value...) keys."""
    for (t0, *a), (t1, *b) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            k = smooth((t - t0) / max(t1 - t0, 1e-9))
            return [x + (y - x) * k for x, y in zip(a, b)]
    return list(keys[-1][1:])


def squash(sy):
    s = 1 / math.sqrt(max(sy, 0.05))
    return (s, sy, s)                                  # bone axes: Y up the dome


def move(t):
    # lift (share of H), stretch
    lift, sy = track([(0, 0, 1.0), (0.12, 0, 0.84), (0.2, 0.03, 1.16), (0.4, 0.24, 1.05), (0.56, 0.08, 1.1),
                      (0.64, 0, 0.82), (0.74, 0, 1.08), (0.84, 0, 0.95), (0.93, 0, 1.02), (1.0, 0, 1.0)], t)
    lean, wob = track([(0, 0, 0), (0.12, -6, 0), (0.22, 10, 0), (0.45, 0, 0), (0.6, -8, 0), (0.7, 6, 1),
                       (0.82, -4, -1), (0.92, 2, 0.5), (1.0, 0, 0)], t)
    tsy = track([(0, 1.0), (0.14, 0.95), (0.24, 1.07), (0.5, 1.0), (0.68, 0.9), (0.78, 1.07), (0.9, 0.97), (1.0, 1.0)], t)[0]
    return {'body': ((0, lift * H, 0), (lean * 0.4, 0, 0), squash(sy)),
            'top': ((0, 0, 0), (lean, 0, 4 * wob), squash(tsy))}


def idle(t):
    p = 2 * math.pi * t
    sy = 1 + 0.05 * math.sin(p)
    return {'body': ((0, 0, 0), (0, 0, 0), squash(sy)),
            'top': ((0, 0, 0), (3 * math.sin(p + 0.8), 0, 4 * math.sin(p + 1.6)), squash(1 + 0.03 * math.sin(p + 0.9)))}


def hit(t):
    k = math.sin(math.pi * t)
    return {'body': ((0, 0, 0), (-6 * k, 0, 0), squash(1 - 0.2 * k)),
            'top': ((0, 0, 0), (-12 * k, 0, 0), squash(1 - 0.08 * k))}


def death(t):
    # a flinch, a wobble, then it slumps into a wide low dome and leans back with a sigh
    sy, lean, wob = track([(0, 1.0, 0, 0), (0.12, 0.84, -8, 0), (0.26, 1.06, 4, 3), (0.42, 0.9, -2, -3),
                           (0.7, 0.8, -10, 1), (1.0, 0.8, -12, 0)], t)
    tsy = track([(0, 1.0), (0.14, 0.94), (0.3, 1.05), (0.55, 0.92), (1.0, 0.92)], t)[0]
    return {'body': ((0, 0, 0), (lean * 0.5, 0, wob), squash(sy)),
            'top': ((0, 0, 0), (lean, 0, 2 * wob), squash(tsy))}


def special(t):
    lift = 0.32 * max(0.0, math.sin(math.pi * min(1.0, max(0.0, (t - 0.12) / 0.72))))
    sy = track([(0, 1.0), (0.12, 0.84), (0.22, 1.15), (0.5, 1.04), (0.8, 1.07), (0.9, 0.84), (1.0, 1.0)], t)[0]
    return {'body': ((0, lift * H, 0), (0, 360 * smooth((t - 0.15) / 0.7), 0), squash(sy)),
            'top': ((0, 0, 0), (0, 0, 0), squash(1.0))}


CLIPS = (('move', 30, move), ('idle', 45, idle), ('hit', 9, hit), ('death', 24, death), ('special', 18, special))


def pose_face(arm, anchors):
    """Poses each face bone rigidly (scale 1) on the patch of squashed body under its part: the patch's surface points
    move as body vertices would (linear blend of the body and top deformations at their heights), and the part takes
    the rotation and translation that fit them best (tripolib.face.rigid_fit). It moves, turns and bobs with the
    jelly; its shape never changes."""
    bpy.context.view_layer.update()
    D = {}
    for bn in ('body', 'top'):
        pb = arm.pose.bones[bn]
        D[bn] = np.array(pb.matrix @ pb.bone.matrix_local.inverted())
    for name, (_, _, _, _, base, ks) in anchors.items():
        P = np.c_[base, np.ones(len(base))]
        Qb = P @ D['body'].T
        Qt = P @ D['top'].T
        Q = (Qb * (1 - ks)[:, None] + Qt * ks[:, None])[:, :3]
        R, t = rigid_fit(base, Q)
        T = Matrix(np.r_[np.c_[R, t], [[0, 0, 0, 1]]].tolist())
        pb = arm.pose.bones[name]
        pb.matrix = T @ pb.bone.matrix_local


def clips(arm, anchors):
    pbs = arm.pose.bones
    for pb in pbs:
        pb.rotation_mode = 'QUATERNION' if pb.name in FACE_BONES else 'XYZ'

    def make(name, frames, fn):
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        if not arm.animation_data:
            arm.animation_data_create()
        arm.animation_data.action = act
        for f in range(frames + 1):
            st = fn(f / frames)
            # the clips give the body's whole pose: its hop and turn go on jelly, its squash stays on body (both
            # bones stand at the floor pointing up, and a pose is location @ rotation @ scale: the same matrix)
            loc, rot, scl = st['body']
            st = dict(st, jelly=(loc, rot, (1, 1, 1)), body=((0, 0, 0), (0, 0, 0), scl))
            for bn in ('jelly', 'body', 'top'):
                pb = pbs[bn]
                loc, rot, scl = st[bn]
                pb.location = Vector(loc)
                pb.rotation_euler = Euler([math.radians(a) for a in rot], 'XYZ')
                pb.scale = Vector(scl)
                for path in ('location', 'rotation_euler', 'scale'):
                    pb.keyframe_insert(path, frame=f, group=bn)
            pose_face(arm, anchors)
            for bn in FACE_BONES:
                pb = pbs[bn]
                pb.scale = (1, 1, 1)
                for path in ('location', 'rotation_quaternion', 'scale'):
                    pb.keyframe_insert(path, frame=f, group=bn)
        compat.linear(act)
        return act

    acts = [make(n, fr, fn) for n, fr, fn in CLIPS]
    arm.animation_data.action = None
    for pb in pbs:
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)
    return acts


def check_face(arm, ob, acts, face_range):
    """For every frame and half frame of every clip: how far each face vertex is from the squashed body surface (signed, along the
    body normal: < 0 = under the jelly), against its own height at rest. Returns {clip: (closest to the surface,
    furthest out beyond its rest height)}."""
    deps = bpy.context.evaluated_depsgraph_get()
    f0, f1 = face_range

    def gaps():
        deps.update()
        ev = ob.evaluated_get(deps)
        me = ev.to_mesh()
        V = [v.co.copy() for v in me.vertices]
        bvh = BVHTree.FromPolygons(V, [tuple(p.vertices) for p in me.polygons if p.material_index == 0])
        d = []
        for i in range(f0, f1):
            loc, nrm, _, _ = bvh.find_nearest(V[i])
            d.append((V[i] - loc).dot(nrm))
        ev.to_mesh_clear()
        return np.array(d)

    arm.animation_data.action = None
    bpy.context.scene.frame_set(0)
    rest = gaps()
    out = {}
    for act in acts:
        arm.animation_data.action = act
        a, b = (int(x) for x in act.frame_range)
        lo, hi = 1e9, -1e9
        for f2 in range(2 * a, 2 * b + 1):
            # whole and half frames: the game interpolates between the keys
            bpy.context.scene.frame_set(f2 // 2, subframe=0.5 * (f2 % 2))
            d = gaps()
            lo, hi = min(lo, float(d.min())), max(hi, float((d - rest).max()))
        out[act.name] = (lo, hi)
    arm.animation_data.action = None
    bpy.context.scene.frame_set(0)
    return out


# ---- build -------------------------------------------------------------------------------------------------------
def build(lod):
    normalize.reset()
    bpy.context.scene.render.fps = FPS
    segs, rings, tex = (32, 20, 256) if lod else (56, 30, 512)
    body = build_mesh(segs, rings)
    petal = build_petal()
    set_uvs(body)
    set_uvs(petal, petal=True)
    img = paint(tex)
    mat = material(img)
    for o in (body, petal):
        o.data.materials.append(mat)
    petal_count = len(petal.data.vertices)
    for o in bpy.data.objects:
        o.select_set(o in (body, petal))
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = body.data.name = ID
    weight_body(body, petal_count)
    face, anchors = build_face(body, lod)
    n_body = len(body.data.vertices)
    n_face = len(face.data.vertices)
    for o in bpy.data.objects:
        o.select_set(o in (body, face))
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    arm = rig(body, anchors)
    acts = clips(arm, anchors)
    gaps = check_face(arm, body, acts, (n_body, n_body + n_face))
    for name, (lo, hi) in gaps.items():
        print(f'[slime] {"lod" if lod else "full"} {name}: face at least {lo * 1000:.1f} mm out of the surface, '
              f'at most {hi * 1000:+.1f} mm beyond its rest height')
        assert lo > MIN_LIFT and hi < MAX_FLOAT, f'{name}: a face part strays from the squashed surface ({lo:.4f}, {hi:.4f})'
    tmp = tempfile.mkdtemp(prefix='slime_')
    raw = os.path.join(tmp, 'raw.glb')
    normalize.export_glb(raw, [arm, body])
    strip_colors(raw)
    out = os.path.join(OUT, f'{ID}{".lod" if lod else ""}.glb')
    extras = dict(id=ID, source='blender', style='textured', kind='blob', look='jelly', face='geometry', height=GAME_HEIGHT,
                  lod=lod, unitScale=round(1 / STORE_SCALE, 5), generator='tools/blender/enemies/build_slime_green.py')
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
                        kind='blob', source='blender', look='jelly', face='geometry', lod=f'{ID}.lod.glb', lodSize=lod['size'],
                        lodTriangles=lod['triangles'], lodVertices=lod['vertices'])
    with open(mpath, 'w') as f:
        json.dump(dict(sorted(manifest.items())), f, indent=1)
        f.write('\n')
    print('[slime] manifest updated')


if __name__ == '__main__':
    main()
    sys.stdout.flush()
    os._exit(0)
