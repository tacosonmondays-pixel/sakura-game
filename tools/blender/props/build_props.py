#!/usr/bin/env python3
"""Builds the academy girls' placed battle props with Blender (bpy 4.2): low-poly, toon-coloured, GLB.

    tools/blender/.venv/bin/python tools/blender/props/build_props.py [files ...] [--out public/models/props]
                                                                    [--blend out.blend]

  azami_strip     Azami's folding spike strip (six hinged steel plates + two thistle end caps)
  yuzuha_sentry   Yuzuha's fold-out tripod sentry (legs, column, type band, turret head, type light)
                  and her Capture Net (rope lattice + four corner weights)
  chigusa_vines   Chigusa's thorn vine tendril (three wrap a held walker) and her thorn bed
  ouka_banners    Ouka's office marker (a folding banner stand) and her council banner (pole + pennant)
  wakaba_bottle   Wakaba's sports-drink squeeze bottle (stands by a girl her drink hydrates)
  kinu_pins       Kinu's heat ring band, one sewing pin (they ride the ring) and a scissor half
                  (two make her orbit scissors)

The contract the runtime reads (src/render/placedProps.js, docs: tools/blender/props/README.md):
  file    public/models/props/<file>.glb, all at game scale (1 unit = 1 tile), ground at y = 0, +Z = front
  nodes   one root empty per prop (strip, sentry, net, vine, bed, office, banner, bottle, heatRing, pin, scissor)
          whose children are its parts (`<prop>_<part>`), each a mesh whose node origin is the part's pivot
          (hinge, hip, yaw axis, pole) and whose node transform is its rest pose inside the prop
  mats    `body` (vertex colours, drawn with the game's toon ramp + inverted-hull outline) and `glow`
          (vertex colours, unlit; no outline). A part whose name ends in `_tint` is white in the file and
          takes a colour from the runtime (Yuzuha's sentry type).
  packing KHR_mesh_quantization (lib/optimize.py), so every part's local positions stay inside [-1, 1].

No textures, no armatures, no clips: the runtime animates the parts (fold-out, unroll, grow, fade) itself,
so one file serves every instance through InstancedMesh.
"""
import argparse
import math
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.abspath(os.path.join(HERE, '..'))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, TOOLS)

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from lib import export, optimize  # noqa: E402
from lib.colors import linear, mix, darken, lighten  # noqa: E402

GENERATOR = 'tools/blender/props/build_props.py'
TAU = math.pi * 2

# The girls' palettes (src/data/unitsNewGirls.js), plus a few neutral steels / soils.
AZAMI = dict(outfit='#25262f', shade='#15161c', accent='#a57cc4', eyes='#c2414f', steel='#b7bfcb')
YUZUHA = dict(outfit='#2a3c66', shade='#182440', accent='#ff8a2a', halo='#ffd29a', weapon='#3a4256')
CHIGUSA = dict(hair='#7da35a', shade='#557a3a', soil='#6b4a32', accent='#f2c94c', leaf='#9cc96b')
OUKA = dict(hair='#f29bb8', shade='#c96d8f', white='#f6f3ec', navy='#26315a', gold='#d9a93c')
WAKABA = dict(hair='#6fcf5e', sky='#7ec3ec', blue='#59c1e8', water='#bff0ff', navy='#2d3d6e')
KINU = dict(hair='#e3a57e', red='#e8475f', steel='#cbd0da', cream='#f2e4c4', ember='#ffb347', star='#ffe08a')


# ---------------------------------------------------------------------------
# Low-poly part builder: primitives with their own colour and shading, merged into one mesh
# ---------------------------------------------------------------------------

def _rot(rx=0.0, ry=0.0, rz=0.0):
    return (Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X'))


def _frame(d):
    """Two unit vectors perpendicular to direction d."""
    d = d.normalized()
    a = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    u = d.cross(a).normalized()
    v = d.cross(u).normalized()
    return u, v


class Part:
    """Collects primitives (verts, faces, colour, smooth) for one exported mesh."""

    def __init__(self):
        self.verts = []
        self.faces = []  # (indices, colour hex, smooth)

    def add(self, verts, faces, color, smooth=False, m=None):
        base = len(self.verts)
        for v in verts:
            p = Vector(v)
            if m is not None:
                p = m @ p
            self.verts.append(p)
        for f in faces:
            self.faces.append((tuple(base + i for i in f), color, smooth))
        return self

    def box(self, center, size, color, m=None, taper=1.0):
        """A flat-shaded box (taper < 1 narrows the top face)."""
        sx, sy, sz = (s / 2 for s in size)
        t = taper
        v = [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz),
             (-sx * t, -sy * t, sz), (sx * t, -sy * t, sz), (sx * t, sy * t, sz), (-sx * t, sy * t, sz)]
        f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        mm = Matrix.Translation(Vector(center))
        if m is not None:
            mm = m @ mm
        # unshared corners per face: crisp toon facets
        for face in f:
            self.add([v[i] for i in face], [(0, 1, 2, 3)], color, False, mm)
        return self

    def cyl(self, p0, p1, r0, r1, sides, color, smooth=True, caps=True, cap_color=None, m=None):
        """A cylinder / cone from p0 to p1 (r1 = 0: a cone). Caps are flat and separate."""
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        u, w = _frame(d)
        ring0, ring1 = [], []
        for i in range(sides):
            a = TAU * i / sides
            o = u * math.cos(a) + w * math.sin(a)
            ring0.append(p0 + o * r0)
            ring1.append(p1 + o * r1)
        side_faces = []
        verts = ring0 + ring1
        for i in range(sides):
            j = (i + 1) % sides
            side_faces.append((i, j, sides + j, sides + i))
        self.add(verts, side_faces, color, smooth, m)
        cc = cap_color or color
        if caps and r0 > 1e-6:
            self.add(ring0, [tuple(reversed(range(sides)))], cc, False, m)
        if caps and r1 > 1e-6:
            self.add(ring1, [tuple(range(sides))], cc, False, m)
        return self

    def sphere(self, center, radii, color, seg=8, rings=5, smooth=True, m=None):
        c = Vector(center)
        rx, ry, rz = radii if isinstance(radii, (tuple, list)) else (radii, radii, radii)
        verts = [c + Vector((0, 0, -rz))]
        for r in range(1, rings):
            phi = math.pi * r / rings - math.pi / 2
            for s in range(seg):
                a = TAU * s / seg
                verts.append(c + Vector((math.cos(phi) * math.cos(a) * rx, math.cos(phi) * math.sin(a) * ry, math.sin(phi) * rz)))
        verts.append(c + Vector((0, 0, rz)))
        faces = []
        top = len(verts) - 1
        for s in range(seg):
            faces.append((0, 1 + (s + 1) % seg, 1 + s))
        for r in range(rings - 2):
            b0 = 1 + r * seg
            b1 = b0 + seg
            for s in range(seg):
                t = (s + 1) % seg
                faces.append((b0 + s, b0 + t, b1 + t, b1 + s))
        last = 1 + (rings - 2) * seg
        for s in range(seg):
            faces.append((last + s, last + (s + 1) % seg, top))
        return self.add(verts, faces, color, smooth, m)

    def torus(self, center, R, r, seg, sides, color, smooth=True, m=None, arc=TAU, colors=None):
        """A torus around +Z (colors: optional per-segment colour list, cycled)."""
        c = Vector(center)
        full = abs(arc - TAU) < 1e-6
        n = seg if full else seg + 1
        rings = []
        for i in range(n):
            a = arc * i / seg
            ca, sa = math.cos(a), math.sin(a)
            ring = []
            for j in range(sides):
                b = TAU * j / sides
                rr = R + r * math.cos(b)
                ring.append(c + Vector((rr * ca, rr * sa, r * math.sin(b))))
            rings.append(ring)
        for i in range(seg):
            i2 = (i + 1) % n if full else i + 1
            col = colors[i % len(colors)] if colors else color
            verts = rings[i] + rings[i2]
            faces = [(j, (j + 1) % sides, sides + (j + 1) % sides, sides + j) for j in range(sides)]
            self.add(verts, faces, col, smooth, m)
        return self

    def tube(self, path, radii, sides, color, smooth=True, m=None, colors=None):
        """A tube along a polyline (radii per point; colors: per-segment list)."""
        pts = [Vector(p) for p in path]
        n = len(pts)
        rings = []
        prev_u = None
        for i in range(n):
            if i == 0:
                t = pts[1] - pts[0]
            elif i == n - 1:
                t = pts[-1] - pts[-2]
            else:
                t = pts[i + 1] - pts[i - 1]
            t.normalize()
            if prev_u is None:
                u, _ = _frame(t)
            else:
                u = (prev_u - t * prev_u.dot(t)).normalized()
            w = t.cross(u).normalized()
            prev_u = u
            r = radii[i] if isinstance(radii, (list, tuple)) else radii
            rings.append([pts[i] + (u * math.cos(TAU * j / sides) + w * math.sin(TAU * j / sides)) * r for j in range(sides)])
        for i in range(n - 1):
            col = colors[i] if colors else color
            verts = rings[i] + rings[i + 1]
            faces = [(j, (j + 1) % sides, sides + (j + 1) % sides, sides + j) for j in range(sides)]
            self.add(verts, faces, col, smooth, m)
        r0 = radii[0] if isinstance(radii, (list, tuple)) else radii
        if r0 > 1e-6:
            self.add(rings[0], [tuple(reversed(range(sides)))], colors[0] if colors else color, False, m)
        return self

    def prism(self, pts2d, z0, z1, color, side_color=None, m=None):
        """A flat-shaded extruded polygon (convex, or star-shaped around its first point's centroid)."""
        cx = sum(p[0] for p in pts2d) / len(pts2d)
        cy = sum(p[1] for p in pts2d) / len(pts2d)
        n = len(pts2d)
        bot = [Vector((x, y, z0)) for x, y in pts2d]
        top = [Vector((x, y, z1)) for x, y in pts2d]
        cb, ct = Vector((cx, cy, z0)), Vector((cx, cy, z1))
        for i in range(n):
            j = (i + 1) % n
            self.add([ct, top[i], top[j]], [(0, 1, 2)], color, False, m)
            self.add([cb, bot[j], bot[i]], [(0, 1, 2)], side_color or color, False, m)
            self.add([bot[i], bot[j], top[j], top[i]], [(0, 1, 2, 3)], side_color or color, False, m)
        return self

    def build(self, name, material):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata([tuple(v) for v in self.verts], [], [f[0] for f in self.faces])
        mesh.validate(verbose=False)
        mesh.update()
        attr = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        mesh.color_attributes.active_color = attr
        mesh.color_attributes.render_color_index = mesh.color_attributes.find('Col')
        cache = {}
        for poly, (_, col, smooth) in zip(mesh.polygons, self.faces):
            poly.use_smooth = smooth
            c = cache.get(col) or cache.setdefault(col, linear(col))
            for li in poly.loop_indices:
                attr.data[li].color = (c[0], c[1], c[2], 1.0)
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj['material'] = material
        return obj


class Prop:
    """One root empty with its parts (each part's origin is its pivot)."""

    def __init__(self, name):
        self.name = name
        self.root = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(self.root)
        self.parts = []

    def part(self, pname, part, material='body', pivot=(0, 0, 0), rot=None):
        obj = part.build(f'{self.name}_{pname}', material)
        obj.parent = self.root
        obj.location = Vector(pivot)
        if rot is not None:
            obj.rotation_euler = rot
        self.parts.append(obj)
        return obj

    def objects(self):
        return [self.root] + self.parts


# ---------------------------------------------------------------------------
# Azami: the folding spike strip (UNIT_GAPS §5.3): 0.76 across the road, 0.2 deep, 6 hinged plates
# ---------------------------------------------------------------------------

STRIP_SEGS = 6
SEG_W = 0.11


def build_strip():
    p = Prop('strip')
    steel = '#d9dee7'
    dark = mix(AZAMI['outfit'], '#3a3d4c', 0.4)
    # one plate, hinge (pivot) on its left edge at x = 0: plate, a purple side stripe, three spikes, a knuckle
    seg = Part()
    seg.box((SEG_W / 2, 0, 0.014), (SEG_W - 0.008, 0.2, 0.028), dark)
    seg.box((SEG_W / 2, 0, 0.029), (SEG_W - 0.022, 0.17, 0.004), mix(dark, AZAMI['steel'], 0.35))
    seg.box((SEG_W / 2, -0.101, 0.012), (SEG_W - 0.01, 0.006, 0.014), AZAMI['accent'])
    seg.box((SEG_W / 2, 0.101, 0.012), (SEG_W - 0.01, 0.006, 0.014), AZAMI['accent'])
    for (sx, sy) in ((0.03, -0.058), (0.08, 0.0), (0.03, 0.058)):
        seg.cyl((sx, sy, 0.03), (sx, sy, 0.098), 0.02, 0.0, 4, steel, smooth=False)
    for (sx, sy) in ((0.08, -0.058), (0.03, 0.0), (0.08, 0.058)):
        seg.cyl((sx, sy, 0.03), (sx, sy, 0.072), 0.014, 0.0, 4, darken(steel, 0.12), smooth=False)
    seg.cyl((0.0, -0.09, 0.016), (0.0, 0.09, 0.016), 0.012, 0.012, 6, AZAMI['steel'])
    p.part('seg', seg, pivot=(-STRIP_SEGS * SEG_W / 2, 0, 0))
    # an end cap (the reel handle): pivot at the strip end, the cap reaching outward along -X
    cap = Part()
    cap.box((-0.026, 0, 0.026), (0.052, 0.22, 0.052), AZAMI['accent'], taper=0.86)
    cap.box((-0.026, 0, 0.0525), (0.034, 0.18, 0.004), AZAMI['eyes'])
    cap.box((-0.0535, 0, 0.022), (0.004, 0.16, 0.02), lighten(AZAMI['accent'], 0.35))
    cap.torus((-0.04, 0, 0.055), 0.04, 0.008, 8, 4, AZAMI['shade'], m=Matrix.Translation((-0.04, 0, 0.055)) @ _rot(rx=math.pi / 2) @ Matrix.Translation((0.04, 0, -0.055)), arc=math.pi)
    p.part('cap', cap, pivot=(-STRIP_SEGS * SEG_W / 2, 0, 0))
    return p


# ---------------------------------------------------------------------------
# Yuzuha: the fold-out tripod sentry (~0.48 tall) and the Capture Net (0.9 square)
# ---------------------------------------------------------------------------

SENTRY_HIP = 0.2
SENTRY_TOP = 0.34


def build_sentry():
    p = Prop('sentry')
    navy, shade, orange, grey = YUZUHA['outfit'], YUZUHA['shade'], YUZUHA['accent'], YUZUHA['weapon']
    # a leg hanging straight down from the hip pivot (the runtime splays / folds it about its local X)
    leg = Part()
    leg.box((0, 0, -0.1), (0.032, 0.032, 0.2), '#8e9ab0', taper=0.8)
    leg.box((0, -0.0155, -0.11), (0.024, 0.002, 0.05), orange)
    leg.box((0, 0, -0.205), (0.05, 0.06, 0.016), shade)
    leg.cyl((-0.02, 0, 0), (0.02, 0, 0), 0.02, 0.02, 6, grey)
    p.part('leg', leg, pivot=(0, 0, SENTRY_HIP))
    # the column with its hub and battery pack
    body = Part()
    body.cyl((0, 0, SENTRY_HIP - 0.035), (0, 0, SENTRY_HIP + 0.025), 0.055, 0.055, 8, grey, cap_color=orange)
    body.cyl((0, 0, SENTRY_HIP + 0.02), (0, 0, SENTRY_TOP), 0.03, 0.026, 8, navy)
    body.box((0, 0.045, SENTRY_HIP + 0.07), (0.06, 0.03, 0.07), shade)
    body.box((0, 0.061, SENTRY_HIP + 0.08), (0.04, 0.003, 0.012), orange)
    p.part('body', body)
    # the band that shows her Specialist Kit type (white here, coloured by the runtime)
    band = Part()
    band.cyl((0, 0, SENTRY_HIP + 0.075), (0, 0, SENTRY_HIP + 0.105), 0.034, 0.034, 8, '#ffffff')
    p.part('band_tint', band)
    # the turret head (pivot on its yaw axis at the column top), barrel to the front (-Y = glTF +Z). The camera looks
    # nearly straight down, so the top carries the read: a safety-orange lid with a white chevron and a navy rim
    shell = '#d5dce8'
    head = Part()
    head.box((0, 0.01, 0.045), (0.17, 0.18, 0.08), shell, taper=0.9)
    head.box((0, 0.01, 0.0905), (0.15, 0.16, 0.012), orange)
    head.box((0, 0.045, 0.0975), (0.11, 0.03, 0.004), '#ffffff')
    head.box((0, -0.005, 0.0975), (0.06, 0.03, 0.004), '#ffffff')
    head.box((0, -0.081, 0.05), (0.15, 0.004, 0.026), navy)
    head.box((0.087, 0.01, 0.045), (0.004, 0.15, 0.03), navy)
    head.box((-0.087, 0.01, 0.045), (0.004, 0.15, 0.03), navy)
    head.cyl((0.035, -0.07, 0.04), (0.035, -0.17, 0.04), 0.018, 0.016, 6, shade, cap_color='#11151f')
    head.cyl((-0.035, -0.07, 0.04), (-0.035, -0.17, 0.04), 0.018, 0.016, 6, shade, cap_color='#11151f')
    head.cyl((0.035, -0.12, 0.04), (0.035, -0.135, 0.04), 0.021, 0.021, 6, orange)
    head.cyl((-0.035, -0.12, 0.04), (-0.035, -0.135, 0.04), 0.021, 0.021, 6, orange)
    head.cyl((-0.065, 0.06, 0.1), (-0.075, 0.08, 0.2), 0.004, 0.003, 4, shade)
    head.sphere((-0.075, 0.08, 0.2), 0.012, orange, seg=6, rings=4)
    head.cyl((0, 0, -0.012), (0, 0, 0.01), 0.045, 0.045, 8, shade)
    p.part('head', head, pivot=(0, 0, SENTRY_TOP))
    # the status light on the head (unlit, white: the runtime colours it with the band)
    light = Part()
    light.sphere((0.045, 0.05, 0.1), (0.024, 0.024, 0.02), '#ffffff', seg=8, rings=4)
    light.box((0, -0.084, 0.072), (0.05, 0.006, 0.014), '#ffffff')
    p.part('light_tint', light, material='glow', pivot=(0, 0, SENTRY_TOP))
    return p


def build_net():
    p = Prop('net')
    rope = '#e3eef8'
    edge = YUZUHA['outfit']
    mesh = Part()
    half = 0.42
    n = 6
    for i in range(n + 1):
        t = -half + 2 * half * i / n
        col = edge if i in (0, n) else rope
        w = 0.026 if i in (0, n) else 0.014
        # gentle dome: the middle lines sit a little higher (a net over a caught walker)
        h = 0.012 + (0.0 if i in (0, n) else 0.008 * (1 - abs(t) / half))
        mesh.box((t, 0, h), (w, 2 * half + w, 0.012), col)
        mesh.box((0, t, h + 0.002), (2 * half + w, w, 0.012), col)
    for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        mesh.box((sx * half, sy * half, 0.016), (0.05, 0.05, 0.03), YUZUHA['accent'])
    mesh.cyl((0, 0, 0.004), (0, 0, 0.03), 0.06, 0.05, 8, YUZUHA['accent'], cap_color=lighten(YUZUHA['accent'], 0.3))
    mesh.cyl((0, 0, 0.03), (0, 0, 0.036), 0.03, 0.03, 8, edge)
    p.part('mesh', mesh)
    # a corner weight (the runtime throws four out from the middle as the net unfurls)
    w = Part()
    w.sphere((0, 0, 0.042), 0.042, YUZUHA['accent'], seg=8, rings=5)
    w.cyl((0, 0, 0.03), (0, 0, 0.054), 0.044, 0.044, 8, edge, smooth=True)
    w.sphere((0, 0, 0.086), 0.012, lighten(YUZUHA['accent'], 0.4), seg=6, rings=3)
    p.part('weight', w, pivot=(half, half, 0))
    return p


# ---------------------------------------------------------------------------
# Chigusa: a thorn vine tendril (three wrap a held walker) and a thorn bed (0.8 across)
# ---------------------------------------------------------------------------

def _thorns(part, path, every, length, color, phase=0.0):
    """Little cones sticking out of a polyline, alternating sides."""
    for i in range(1, len(path) - 1, every):
        a = Vector(path[i - 1])
        b = Vector(path[i + 1])
        d = (b - a).normalized()
        u, w = _frame(d)
        ang = phase + i * 2.1
        o = (u * math.cos(ang) + w * math.sin(ang)).normalized()
        base = Vector(path[i])
        part.cyl(base + o * 0.006, base + o * (0.006 + length) + d * 0.01, 0.009, 0.0, 4, color, smooth=False)


def _leaf(part, base, direction, length, width, color, vein=None):
    """A flat diamond leaf with a little thickness."""
    d = Vector(direction).normalized()
    side = d.cross(Vector((0, 0, 1)))
    if side.length < 1e-6:
        side = Vector((1, 0, 0))
    side.normalize()
    up = side.cross(d).normalized()
    b = Vector(base)
    tip = b + d * length
    mid = b + d * length * 0.45
    l = mid + side * width
    r = mid - side * width
    th = up * 0.004
    verts = [b + th, l + th, tip + th, r + th, b - th, l - th, tip - th, r - th]
    part.add(verts, [(0, 3, 2, 1), (4, 5, 6, 7)], color, False)
    part.add(verts, [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], darken(color, 0.15), False)
    if vein:
        part.add([b + th * 1.5, tip + th * 1.5, mid + th * 1.5 + side * 0.004], [(0, 2, 1)], vein, False)


def _flower(part, center, r, color, heart):
    c = Vector(center)
    for k in range(5):
        a = TAU * k / 5
        part.sphere(c + Vector((math.cos(a) * r, math.sin(a) * r, 0)), (r * 0.75, r * 0.75, r * 0.35), color, seg=6, rings=3)
    part.sphere(c + Vector((0, 0, r * 0.3)), r * 0.45, heart, seg=6, rings=3)


def build_vine():
    p = Prop('vine')
    stem0, stem1 = CHIGUSA['shade'], CHIGUSA['hair']
    # base at the origin, rising and arching inward (toward -X, where the held walker stands), tip curling
    pts = []
    n = 11
    for i in range(n):
        t = i / (n - 1)
        x = -0.2 * math.sin(t * math.pi * 0.62) - 0.05 * t * t
        z = 0.5 * math.sin(t * math.pi * 0.5)
        y = 0.06 * math.sin(t * math.pi * 1.4)
        pts.append((x, y, z))
    # the tip curls into a little loop
    cx, cy, cz = pts[-1]
    for k in range(1, 5):
        a = k * 0.85
        pts.append((cx - 0.05 * math.sin(a), cy + 0.012 * k, cz - 0.05 * (1 - math.cos(a))))
    radii = [0.036 * (1 - i / len(pts)) + 0.006 for i in range(len(pts))]
    cols = [mix(stem0, stem1, i / (len(pts) - 1)) for i in range(len(pts) - 1)]
    v = Part()
    v.tube(pts, radii, 6, stem0, colors=cols)
    _thorns(v, pts, 2, 0.045, '#efe3b4')
    _leaf(v, pts[3], (0.6, -0.5, 0.4), 0.13, 0.045, CHIGUSA['leaf'], vein=CHIGUSA['shade'])
    _leaf(v, pts[7], (0.3, 0.7, 0.3), 0.11, 0.04, CHIGUSA['leaf'], vein=CHIGUSA['shade'])
    _flower(v, (0.02, -0.04, 0.03), 0.022, CHIGUSA['accent'], '#fff4c8')
    # a root clump where it bursts out of the ground
    v.sphere((0, 0, 0.0), (0.06, 0.06, 0.03), darken(CHIGUSA['soil'], 0.05), seg=7, rings=4, smooth=False)
    p.part('tendril', v)
    return p


def build_bed():
    p = Prop('bed')
    soil, dark = CHIGUSA['soil'], darken(CHIGUSA['soil'], 0.25)
    b = Part()
    # a low lumpy soil mound (an irregular heptagon)
    rim = []
    for k in range(9):
        a = TAU * k / 9
        r = 0.36 + 0.035 * math.sin(k * 2.7)
        rim.append((math.cos(a) * r, math.sin(a) * r))
    b.prism(rim, 0.0, 0.022, soil, side_color=dark)
    b.prism([(x * 0.7, y * 0.7) for x, y in rim], 0.022, 0.034, mix(soil, '#8a6a48', 0.4), side_color=soil)
    # bramble loops: arcs of thorny stem, each a half torus standing on the soil
    loops = [(0.0, 0.0, 0.0, 0.19), (0.16, 0.1, 1.3, 0.13), (-0.17, 0.08, 2.4, 0.14), (0.05, -0.18, 0.6, 0.12), (-0.1, -0.13, 1.9, 0.11)]
    for (lx, ly, ang, rad) in loops:
        m = Matrix.Translation((lx, ly, 0.02)) @ _rot(rz=ang) @ _rot(rx=math.pi / 2)
        seg = 8
        arc = []
        for i in range(seg + 1):
            a = math.pi * i / seg
            arc.append(m @ Vector((math.cos(a) * rad, math.sin(a) * rad * 0.8, 0)))
        cols = [mix(CHIGUSA['shade'], CHIGUSA['hair'], abs(math.sin(math.pi * i / seg))) for i in range(seg)]
        b.tube([tuple(q) for q in arc], 0.016, 5, CHIGUSA['shade'], colors=cols)
        _thorns(b, [tuple(q) for q in arc], 1, 0.035, '#efe3b4', phase=ang)
    for (lx, ly, dx, dy) in ((0.22, -0.05, 1, -0.4), (-0.24, -0.02, -1, 0.2), (0.0, 0.24, 0.2, 1), (-0.05, -0.26, -0.3, -1)):
        _leaf(b, (lx, ly, 0.035), (dx, dy, 0.35), 0.11, 0.04, CHIGUSA['leaf'], vein=CHIGUSA['shade'])
    _flower(b, (0.12, -0.02, 0.05), 0.018, CHIGUSA['accent'], '#fff4c8')
    _flower(b, (-0.08, 0.17, 0.05), 0.016, '#f6f1e4', CHIGUSA['accent'])
    p.part('base', b)
    return p


# ---------------------------------------------------------------------------
# Ouka: the office marker (folding banner stand, ~0.6 tall) and the council banner (pole ~0.86 + pennant)
# ---------------------------------------------------------------------------

def _crest(part, center, r, petal, heart, normal_axis='y', sign=-1):
    """A five-petal sakura crest lying in a vertical plane (facing -Y by default)."""
    c = Vector(center)
    for k in range(5):
        a = TAU * k / 5 + math.pi / 2
        o = Vector((math.cos(a) * r, 0, math.sin(a) * r))
        part.sphere(c + o, (r * 0.7, 0.006, r * 0.7), petal, seg=6, rings=3, smooth=False)
    part.sphere(c + Vector((0, sign * 0.004, 0)), (r * 0.42, 0.008, r * 0.42), heart, seg=6, rings=3, smooth=False)


def build_office():
    p = Prop('office')
    gold, white, navy, pink = OUKA['gold'], OUKA['white'], OUKA['navy'], OUKA['hair']
    stand = Part()
    stand.box((0, 0, 0.012), (0.24, 0.07, 0.024), navy)
    stand.box((0, 0, 0.026), (0.2, 0.05, 0.006), gold)
    stand.cyl((-0.1, 0, 0.02), (-0.1, 0, 0.6), 0.012, 0.01, 6, gold)
    stand.cyl((0.1, 0, 0.02), (0.1, 0, 0.6), 0.012, 0.01, 6, gold)
    stand.cyl((-0.125, 0, 0.58), (0.125, 0, 0.58), 0.011, 0.011, 6, gold)
    stand.sphere((-0.13, 0, 0.58), 0.018, gold, seg=6, rings=4)
    stand.sphere((0.13, 0, 0.58), 0.018, gold, seg=6, rings=4)
    stand.sphere((0, 0, 0.615), 0.022, pink, seg=6, rings=4)
    p.part('stand', stand)
    # the hanging banner (pivot on the crossbar: it sways)
    flag = Part()
    flag.box((0, 0, -0.17), (0.19, 0.012, 0.32), white)
    flag.box((0, 0, -0.335), (0.19, 0.014, 0.03), navy)
    flag.box((0, 0, -0.012), (0.2, 0.016, 0.022), pink)
    flag.box((-0.091, 0, -0.17), (0.008, 0.016, 0.3), gold)
    flag.box((0.091, 0, -0.17), (0.008, 0.016, 0.3), gold)
    _crest(flag, (0, -0.008, -0.15), 0.04, pink, gold)
    flag.box((0, -0.008, -0.255), (0.12, 0.006, 0.018), navy)
    flag.box((0, -0.008, -0.285), (0.08, 0.006, 0.012), navy)
    for sx in (-0.08, 0.08):
        flag.cyl((sx, 0, -0.35), (sx, 0, -0.39), 0.012, 0.004, 5, gold)
    p.part('flag', flag, pivot=(0, 0, 0.58))
    return p


def build_banner():
    p = Prop('banner')
    gold, white, navy, pink = OUKA['gold'], OUKA['white'], OUKA['navy'], OUKA['hair']
    pole = Part()
    pole.cyl((0, 0, 0), (0, 0, 0.035), 0.1, 0.085, 10, navy, cap_color=mix(navy, '#3a4a80', 0.4))
    pole.torus((0, 0, 0.035), 0.075, 0.01, 12, 4, gold)
    pole.cyl((0, 0, 0.03), (0, 0, 0.86), 0.014, 0.012, 6, gold)
    # crown finial with a pink gem
    pole.cyl((0, 0, 0.86), (0, 0, 0.885), 0.03, 0.036, 6, gold)
    for k in range(5):
        a = TAU * k / 5
        pole.cyl((math.cos(a) * 0.03, math.sin(a) * 0.03, 0.885), (math.cos(a) * 0.036, math.sin(a) * 0.036, 0.93), 0.012, 0.0, 4, gold, smooth=False)
    pole.sphere((0, 0, 0.905), 0.02, pink, seg=6, rings=4, smooth=False)
    p.part('pole', pole)
    # the swallowtail pennant, hanging off the pole toward +X (pivot on the pole axis: it waves)
    flag = Part()
    W, H = 0.36, 0.26
    outline = [(0.0, 0.0), (W, 0.0), (W * 0.78, -H / 2), (W, -H), (0.0, -H)]
    m = _rot(rx=math.pi / 2)  # the 2D outline (x, y) stands up in the XZ plane

    def flat(pts, y0, y1, col, side=None):
        flag.prism([(x, z) for x, z in pts], y0, y1, col, side_color=side, m=m)

    flat(outline, -0.007, 0.007, white, side=mix(white, pink, 0.3))
    flat([(0.0, -0.03), (W * 0.985, -0.03), (W * 0.93, -0.06), (0.0, -0.06)], -0.0095, 0.0095, pink)
    flat([(0.0, -H + 0.06), (W * 0.93, -H + 0.06), (W * 0.985, -H + 0.03), (0.0, -H + 0.03)], -0.0095, 0.0095, pink)
    _crest(flag, (0.14, -0.012, -0.13), 0.034, gold, pink)
    _crest(flag, (0.14, 0.012, -0.13), 0.034, gold, pink, sign=1)
    flag.cyl((0, 0, 0.012), (0, 0, -H - 0.012), 0.02, 0.02, 6, gold)
    p.part('flag', flag, pivot=(0, 0, 0.83))
    return p


# ---------------------------------------------------------------------------
# Wakaba: the sports-drink squeeze bottle (~0.27 tall)
# ---------------------------------------------------------------------------

def build_bottle():
    p = Prop('bottle')
    b = Part()
    blue, sky, water, green, navy = WAKABA['blue'], WAKABA['sky'], WAKABA['water'], WAKABA['hair'], WAKABA['navy']
    b.cyl((0, 0, 0.0), (0, 0, 0.012), 0.05, 0.058, 10, darken(blue, 0.15), cap_color=darken(blue, 0.25))
    b.cyl((0, 0, 0.012), (0, 0, 0.07), 0.058, 0.058, 10, blue)
    b.cyl((0, 0, 0.07), (0, 0, 0.1), 0.059, 0.059, 10, '#ffffff', caps=False)
    b.cyl((0, 0, 0.1), (0, 0, 0.13), 0.058, 0.058, 10, green, caps=False)
    b.cyl((0, 0, 0.13), (0, 0, 0.165), 0.058, 0.05, 10, blue, caps=False)
    # the liquid window: a pale stripe of water down the front
    b.box((0, -0.058, 0.06), (0.03, 0.006, 0.09), water)
    b.box((0, -0.06, 0.085), (0.03, 0.004, 0.006), '#ffffff')
    # cap, nozzle and a little clip loop
    b.cyl((0, 0, 0.165), (0, 0, 0.2), 0.044, 0.04, 10, '#ffffff', cap_color='#eef6fb')
    b.cyl((0, 0, 0.2), (0, 0, 0.24), 0.016, 0.01, 6, '#ffffff', cap_color=green)
    b.box((0.045, 0, 0.183), (0.02, 0.012, 0.02), green)
    b.box((0, 0.059, 0.115), (0.022, 0.004, 0.02), navy)
    p.part('body', b)
    return p


# ---------------------------------------------------------------------------
# Kinu: the heat ring band (radius 0.9, scaled by the runtime), a sewing pin, a scissor half
# ---------------------------------------------------------------------------

HEAT_R = 0.9


def build_heat_ring():
    p = Prop('heatRing')
    ring = Part()
    # a glowing seam: ember band with red thread stitches (unlit), a pale inner edge
    ring.torus((0, 0, 0.03), HEAT_R, 0.028, 48, 5, KINU['ember'], colors=[KINU['ember'], KINU['ember'], KINU['red'], '#ffd9a0'])
    ring.torus((0, 0, 0.012), HEAT_R - 0.035, 0.01, 48, 4, KINU['star'])
    p.part('band', ring, material='glow')
    return p


def build_pin():
    p = Prop('pin')
    pin = Part()
    # pointing outward along +X, pivot on the shaft's middle; a red bead head and a tiny cream collar
    pin.cyl((-0.09, 0, 0), (0.07, 0, 0), 0.0075, 0.0075, 5, KINU['steel'], cap_color=KINU['steel'])
    pin.cyl((0.07, 0, 0), (0.11, 0, 0), 0.0075, 0.0, 5, lighten(KINU['steel'], 0.4), smooth=False)
    pin.sphere((-0.1, 0, 0), 0.026, KINU['red'], seg=8, rings=5)
    pin.sphere((-0.108, -0.008, 0.012), 0.008, '#ffd6dc', seg=5, rings=3)
    pin.cyl((-0.078, 0, 0), (-0.07, 0, 0), 0.011, 0.011, 6, KINU['star'])
    p.part('pin', pin)
    return p


def build_scissor():
    p = Prop('scissor')
    s = Part()
    # one half: blade toward +X, handle loop toward -X, the screw (pivot) at the origin; the runtime draws
    # a second one flipped over to make the pair
    blade = [(0.0, 0.012), (0.17, 0.004), (0.2, -0.006), (0.0, -0.016)]
    s.prism(blade, 0.0, 0.008, KINU['steel'], side_color=darken(KINU['steel'], 0.25))
    s.prism([(0.0, 0.012), (0.17, 0.004), (0.165, 0.0), (0.0, 0.006)], 0.008, 0.0095, lighten(KINU['steel'], 0.5))
    s.box((-0.04, -0.008, 0.005), (0.06, 0.016, 0.01), KINU['red'])
    s.torus((-0.1, -0.02, 0.005), 0.036, 0.009, 10, 5, KINU['red'])
    s.cyl((0, 0, -0.004), (0, 0, 0.016), 0.012, 0.012, 6, KINU['star'])
    p.part('half', s)
    return p


# ---------------------------------------------------------------------------
# Files
# ---------------------------------------------------------------------------

FILES = {
    'azami_strip': [build_strip],
    'yuzuha_sentry': [build_sentry, build_net],
    'chigusa_vines': [build_vine, build_bed],
    'ouka_banners': [build_office, build_banner],
    'wakaba_bottle': [build_bottle],
    'kinu_pins': [build_heat_ring, build_pin, build_scissor],
}


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_materials():
    body = bpy.data.materials.new('body')
    body.use_nodes = True
    nt = body.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.8
    col = nt.nodes.new('ShaderNodeVertexColor')
    col.layer_name = 'Col'
    nt.links.new(col.outputs['Color'], bsdf.inputs['Base Color'])
    glow = bpy.data.materials.new('glow')
    glow.use_nodes = True
    nt = glow.node_tree
    bsdf = nt.nodes['Principled BSDF']
    col = nt.nodes.new('ShaderNodeVertexColor')
    col.layer_name = 'Col'
    nt.links.new(col.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(col.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = 1.0
    return {'body': body, 'glow': glow}


def build_file(key, out_dir, blend=None):
    reset_scene()
    mats = make_materials()
    props = [fn() for fn in FILES[key]]
    objs = []
    for pr in props:
        for o in pr.parts:
            export.assign_material(o, mats[o['material']])
        objs += pr.objects()
    tmp = os.path.join(tempfile.gettempdir(), f'props_{key}_raw.glb')
    export.export_glb(tmp, objs, animations=False)
    out = os.path.join(out_dir, f'{key}.glb')
    optimize.optimize_glb(tmp, out)
    js, bin_chunk = export.read_glb(out)
    js.setdefault('asset', {})['generator'] = GENERATOR
    js['asset'].setdefault('extras', {}).update({'props': [pr.name for pr in props], 'unitScale': 1, 'source': 'blender'})
    export.write_glb(out, js, bin_chunk)
    os.remove(tmp)
    if blend:
        bpy.ops.wm.save_as_mainfile(filepath=blend.replace('.blend', f'_{key}.blend'))
    d = export.describe(out)
    print(f'[props] {key}: {d["size"]} bytes, {d["primitives"]} parts, {d["vertices"]} vertices, props {[pr.name for pr in props]}')
    return out, d


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='*', help=f'subset of {sorted(FILES)}')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'models', 'props'))
    ap.add_argument('--blend', default=None, help='also save a .blend per file (path prefix)')
    a = ap.parse_args(argv)
    keys = a.files or list(FILES)
    for k in keys:
        if k not in FILES:
            raise SystemExit(f'unknown file {k}; choose from {sorted(FILES)}')
    os.makedirs(a.out, exist_ok=True)
    total = 0
    for k in keys:
        _, d = build_file(k, a.out, a.blend)
        total += d['size']
    print(f'[props] total {total} bytes')


if __name__ == '__main__':
    args = sys.argv[1:]
    if '--' in args:
        args = args[args.index('--') + 1:]
    main(args)
