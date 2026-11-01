#!/usr/bin/env python3
"""Builds the path-look pieces (docs/specs/path-looks.md): small toon props a girl wears when she commits to an upgrade
path (T3), that grow at T4 and turn into her capstone look at T5. One GLB per girl, every piece well under 60 KB.

    blender -b --python tools/blender/pathlooks/build_path_looks.py -- [girls ...] [--out public/models/pathlooks]

The contract the runtime reads (src/render/pathLooks/pieces.js):
  file    public/models/pathlooks/<unitId>_p<path>.glb (one per path: a girl fetches only the paths she takes)
  nodes   one root empty per piece, named `p<path>_<name>` (p0_quiver, p2_falcon…). Its children are meshes named
          `<piece>_body` (vertex colours, drawn with the game's toon ramp + an inverted-hull outline on medium/high)
          and `<piece>_glow` (vertex colours, unlit, additive-looking bright colours, no outline).
  units   FIGURE space: the girl's group space after her model's unitScale (feet at y = 0, about 0.9 tall for the
          Blender girls, 1.22 for Luna), +Y up, +Z toward her front. A piece's origin is its pivot: the runtime puts the
          pivot at `bone rest position + offset` (src/render/pathLooks/catalog.js) and lets the bone carry it.
  packing KHR_mesh_quantization (lib/optimize.py): every mesh's local positions stay inside [-1, 1].

Content rules (HANDOFF §6): props only. Nothing here touches or frames a body; students wear no swimwear; nothing sits
over a face from the battle camera (48° down): head pieces ride the top / side / back of the head, back pieces sit behind.
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
sys.path.insert(0, os.path.join(TOOLS, 'props'))

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from lib import export, optimize  # noqa: E402
from lib.colors import mix, darken, lighten  # noqa: E402
from build_props import Part, make_materials  # noqa: E402

GENERATOR = 'tools/blender/pathlooks/build_path_looks.py'
TAU = math.pi * 2

# path colours (src/render/actors.js PATH_COLORS): the trim that ties a piece to its pips
PINK, CYAN, GOLD = '#ff6b8b', '#4cc9f0', '#ffd43b'
STEEL, STEEL_D = '#dfe5ee', '#9aa3b2'
LEATHER, LEATHER_D = '#9a6440', '#6e4429'
CREAM, WHITE = '#f6ecd6', '#fbfbff'
GOLD_M = '#f1c24a'


def V(x, u, f):
    """glTF axes (x, up, front) -> Blender (x, -front, up)."""
    return Vector((x, -f, u))


def basis(o, u, v):
    """4x4 that maps local x -> u, y -> v, z -> u x v (all glTF-axis tuples) at origin o."""
    U = V(*u).normalized()
    W = V(*v)
    W = (W - U * W.dot(U)).normalized()
    N = U.cross(W).normalized()
    O = V(*o)
    return Matrix(((U.x, W.x, N.x, O.x), (U.y, W.y, N.y, O.y), (U.z, W.z, N.z, O.z), (0, 0, 0, 1)))


def rot_about_up(a):
    return Matrix.Rotation(a, 4, 'Z')


class Piece:
    """One piece: a body part and a glow part (either may stay empty)."""

    def __init__(self, name):
        self.name = name
        self.body = Part()
        self.glow = Part()

    # -- primitives in glTF axes ------------------------------------------------------------
    def cyl(self, a, b, r0, r1, sides, color, glow=False, smooth=True, caps=True, cap_color=None):
        (self.glow if glow else self.body).cyl(V(*a), V(*b), r0, r1, sides, color, smooth=smooth, caps=caps, cap_color=cap_color)

    def ball(self, c, r, color, glow=False, seg=8, rings=5):
        rr = r if isinstance(r, (tuple, list)) else (r, r, r)
        # radii in glTF order (x, up, front) -> Blender (x, front, up)
        (self.glow if glow else self.body).sphere(V(*c), (rr[0], rr[2], rr[1]), color, seg=seg, rings=rings)

    def flat(self, pts, o, u, v, thick, color, glow=False, side=None):
        (self.glow if glow else self.body).prism(pts, -thick / 2, thick / 2, color, side_color=side, m=basis(o, u, v))

    def ring(self, c, R, r, seg, sides, color, normal=(0, 1, 0), glow=False):
        n = V(*normal).normalized()
        q = Vector((0, 0, 1)).rotation_difference(n).to_matrix().to_4x4()
        m = Matrix.Translation(V(*c)) @ q
        (self.glow if glow else self.body).torus((0, 0, 0), R, r, seg, sides, color, m=m)


# ---------------------------------------------------------------------------------------------
# Shared shapes
# ---------------------------------------------------------------------------------------------

def feather_pts(L, W, t0=0.0, t1=1.0, n=3):
    """Outline of a feather between length fractions t0..t1 (convex: a lens tapered at both ends)."""
    def half(t):
        return W * 0.5 * math.sin(math.pi * min(1.0, max(0.0, t)) ** 0.8)
    top, bot = [], []
    for i in range(n + 1):
        t = t0 + (t1 - t0) * i / n
        top.append((t * L, half(t)))
        bot.append((t * L, -half(t)))
    pts = top + list(reversed(bot))
    # drop duplicate tips (half(0) = 0)
    out = []
    for p in pts:
        if not out or abs(out[-1][0] - p[0]) > 1e-6 or abs(out[-1][1] - p[1]) > 1e-6:
            out.append(p)
    return out


def feather(pc, o, d, side, L, W, base, tip, split=0.62, thick=0.012, glow_tip=False, quill=True, cheap=False):
    """A two-tone feather from o along d; `side` is a vector its blade spreads along (cheap: one colour, one blade)."""
    if cheap:
        pc.flat(feather_pts(L, W, 0.0, 1.0, n=2), o, d, side, thick, base)
        return
    pc.flat(feather_pts(L, W, 0.0, split), o, d, side, thick, base)
    dn = Vector(d).normalized()
    o2 = tuple(o[i] + dn[i] * L * split for i in range(3))
    pc.flat([(x - L * split, y) for x, y in feather_pts(L, W, split, 1.0)], o2, d, side, thick * 1.05, tip, glow=glow_tip)
    if quill:
        e = tuple(o[i] + dn[i] * L * 0.9 for i in range(3))
        pc.cyl(o, e, 0.006, 0.003, 3, darken(base, 0.25), smooth=False, caps=False)


def star_pts(r, inner=0.45, n=5, rot=math.pi / 2):
    pts = []
    for i in range(n * 2):
        a = rot + i * math.pi / n
        rr = r if i % 2 == 0 else r * inner
        pts.append((math.cos(a) * rr, math.sin(a) * rr))
    return pts


def star(pc, c, r, color, face=(0, 0, 1), up=(0, 1, 0), thick=0.02, glow=False, inner=0.45):
    # local x = right in the face plane, local y = up in the face plane; extruded along the face normal
    f = Vector(face).normalized()
    upv = Vector(up)
    right = upv.cross(f).normalized()
    pc.flat(star_pts(r, inner), c, tuple(right), tuple(f.cross(right)), thick, color, glow=glow)


def arrow(pc, base, d, L, head, fletch, shaft=LEATHER, r=0.008, head_glow=False, head_len=0.06):
    dn = Vector(d).normalized()
    end = tuple(base[i] + dn[i] * L for i in range(3))
    pc.cyl(base, end, r, r, 5, shaft, smooth=False)
    tip = tuple(end[i] + dn[i] * head_len for i in range(3))
    pc.cyl(end, tip, r * 2.6, 0.0, 5, head, glow=head_glow, smooth=False)
    # three fletching fins near the base
    up = (0, 0, 1) if abs(dn[2]) < 0.9 else (1, 0, 0)
    side = dn.cross(Vector(up)).normalized()
    side2 = dn.cross(side).normalized()
    for s in (side, side2, -side):
        pc.flat([(0, 0), (0.07, 0), (0.055, 0.022), (0.0, 0.026)], tuple(base[i] + dn[i] * 0.01 for i in range(3)), tuple(dn), tuple(s), 0.004, fletch)


# ---------------------------------------------------------------------------------------------
# Aoi (Wind Ranger): 0 Piercing Arrows (quiver), 1 Rapid Volley (hawk feathers -> wings), 2 Sky Hunter (falcon)
# ---------------------------------------------------------------------------------------------

def aoi_quiver(name, big=False):
    pc = Piece(name)
    h = 0.30 if big else 0.24
    r = 0.05 if big else 0.042
    body = '#eef2f8' if big else LEATHER
    band = GOLD_M if big else STEEL
    pc.cyl((0, -h / 2, 0), (0, h / 2, 0), r * 0.9, r, 10, body, cap_color=darken(body, 0.35))
    pc.cyl((0, h / 2 - 0.035, 0), (0, h / 2 - 0.01, 0), r * 1.08, r * 1.08, 10, band)
    pc.cyl((0, -h / 2 + 0.01, 0), (0, -h / 2 + 0.035, 0), r * 0.98, r * 0.98, 10, band)
    pc.cyl((0, -0.02, 0), (0, 0.015, 0), r * 1.06, r * 1.06, 10, PINK)  # path trim
    # strap buckle facing the front
    pc.cyl((0, 0.02, r * 0.9), (0, 0.02, r * 1.25), 0.016, 0.016, 6, band)
    n = 5 if big else 3
    for i in range(n):
        a = (i - (n - 1) / 2) * (0.16 if big else 0.2)
        d = (math.sin(a) * 0.6, 1, -0.15)
        x0 = (i - (n - 1) / 2) * r * 0.45
        L = 0.24 if big else 0.17
        arrow(pc, (x0, h / 2 - 0.06, 0), d, L, PINK if big else STEEL, PINK if not big else WHITE,
              head_glow=big, head_len=0.08 if big else 0.06)
    if big:
        # comet trails: soft glowing streaks behind the two outer arrowheads
        for i in (0, n - 1):
            a = (i - (n - 1) / 2) * 0.16
            d = Vector((math.sin(a) * 0.6, 1, -0.15)).normalized()
            x0 = (i - (n - 1) / 2) * r * 0.45
            tip = (x0 + d.x * 0.28, h / 2 - 0.06 + d.y * 0.28, d.z * 0.28)
            pc.cyl(tip, (tip[0] - d.x * 0.16, tip[1] - d.y * 0.16, tip[2] - d.z * 0.16), 0.016, 0.002, 6, lighten(PINK, 0.4), glow=True)
    return pc


def aoi_comet_arrow(name):
    """T4 add-on: one long comet arrow standing out of the quiver, its head glowing."""
    pc = Piece(name)
    arrow(pc, (0.0, 0.06, 0.0), (0.05, 1, -0.1), 0.26, lighten(PINK, 0.3), WHITE, head_glow=True, head_len=0.075)
    return pc


def aoi_feathers(name, n=3, wide=False):
    pc = Piece(name)
    spread = 0.95 if wide else 0.6
    for i in range(n):
        t = (i / (n - 1)) if n > 1 else 0.5
        a = -spread / 2 + spread * t
        # rising up and a little back, fanned around the head's side
        d = (math.sin(a) * 0.7 + 0.25, math.cos(a), -0.35)
        L = 0.2 - abs(t - 0.5) * 0.06
        feather(pc, (0, 0, 0), d, (0, 0.2, 1), L, 0.055, WHITE, CYAN)
    pc.ball((0, 0, 0), 0.022, CYAN)
    return pc


def wing(pc, side, root, span, base, tip, glow_tip=False, flame=False, n=5):
    """A fan of n feathers from `root`, spreading toward `side` (+1 her left / -1 her right) and up, swept back."""
    for i in range(n):
        t = i / (n - 1)
        ang = 0.15 + 1.15 * t  # 0 = straight out sideways, up toward the top
        d = (side * math.cos(ang), math.sin(ang) * 0.95 + 0.1, -0.35 - 0.1 * t)
        L = span * (1.0 - 0.32 * t)
        o = (root[0] + side * 0.02 * i, root[1] - 0.012 * i, root[2] - 0.01 * i)
        feather(pc, o, d, (0, 0.3, 1), L, 0.085 if not flame else 0.1, base, tip, split=0.55, thick=0.014, glow_tip=glow_tip, quill=False)


def aoi_wings(name):
    pc = Piece(name)
    for s in (1, -1):
        wing(pc, s, (s * 0.035, 0, 0), 0.3, WHITE, CYAN, n=5)
    pc.ball((0, 0, 0.0), (0.05, 0.035, 0.025), GOLD_M)
    return pc


def falcon(pc, scale=1.0, golden=False, spread=False):
    k = scale
    brown = '#c08a3e' if golden else '#8b5a34'
    dark = darken(brown, 0.3)
    belly = '#fff1c8' if golden else CREAM
    pc.ball((0, 0, 0), (0.05 * k, 0.05 * k, 0.065 * k), brown)
    pc.ball((0, -0.006 * k, 0.025 * k), (0.038 * k, 0.04 * k, 0.04 * k), belly, seg=6, rings=4)
    pc.ball((0, 0.052 * k, 0.03 * k), 0.04 * k, brown)  # head
    pc.ball((0, 0.045 * k, 0.05 * k), (0.03 * k, 0.025 * k, 0.025 * k), belly, seg=6, rings=4)  # face patch
    pc.cyl((0, 0.045 * k, 0.065 * k), (0, 0.035 * k, 0.095 * k), 0.012 * k, 0.0, 5, '#ffb627', smooth=False)  # beak
    for s in (1, -1):
        pc.ball((s * 0.017 * k, 0.058 * k, 0.062 * k), 0.008 * k, '#2a1f2e', seg=5, rings=3)
    # golden crest (path colour)
    for i, a in enumerate((-0.35, 0, 0.35)):
        pc.cyl((0, 0.085 * k, 0.02 * k), (math.sin(a) * 0.02 * k, 0.12 * k, -0.01 * k), 0.008 * k, 0.0, 4, GOLD, smooth=False)
    # tail fan
    for a in (-0.35, 0, 0.35):
        feather(pc, (0, -0.01 * k, -0.05 * k), (math.sin(a) * 0.5, -0.25, -1), (1, 0, 0), 0.08 * k, 0.04 * k, dark, belly if not golden else GOLD, thick=0.008, quill=False, cheap=True)
    # wings: raised in a V (hovering) or swept wide (capstone)
    for s in (1, -1):
        for i in range(4 if spread else 3):
            t = i / (3 if spread else 2)
            if spread:
                d = (s * (1.0 - 0.15 * t), 0.35 + 0.5 * t, -0.25)
                L = (0.17 - 0.03 * t) * k
            else:
                d = (s * 0.55, 0.85 - 0.2 * t, -0.35 - 0.2 * t)
                L = (0.11 - 0.02 * t) * k
            feather(pc, (s * 0.035 * k, 0.02 * k, -0.005 * k), d, (0, 0, 1), L, 0.05 * k, GOLD if golden and i == 0 else brown, GOLD, split=0.6, thick=0.01, quill=False, cheap=True)


def aoi_falcon(name, big=False):
    pc = Piece(name)
    falcon(pc, 1.55 if big else 1.0, golden=big, spread=big)
    if big:
        # the Falcon Mark: a small glowing diamond on its chest
        star(pc, (0, 0.0, 0.1), 0.028, lighten(GOLD, 0.5), face=(0, 0, 1), glow=True, inner=0.5)
    return pc


def aoi_falcon_band(name):
    """T4 add-on: a gold jess ring and a little glowing mark charm under the falcon."""
    pc = Piece(name)
    pc.ring((0, -0.06, 0.0), 0.028, 0.006, 12, 5, GOLD_M)
    star(pc, (0, -0.085, 0.01), 0.018, lighten(GOLD, 0.4), glow=True)
    return pc


# ---------------------------------------------------------------------------------------------
# Akane (Flame Witch): 0 Big Bang (firework pinwheel -> hanabi wheel), 1 Wildfire (phoenix plume -> flame wings),
# 2 Rocket Science (rocket pack -> skybreaker pack + goggles)
# ---------------------------------------------------------------------------------------------

def pinwheel(pc, c, r, petals=10, face=(0, 0, 1), glow_tips=False):
    f = Vector(face).normalized()
    up = Vector((0, 1, 0)) if abs(f.y) < 0.9 else Vector((0, 0, 1))
    right = up.cross(f).normalized()
    up = f.cross(right).normalized()
    cols = [PINK, '#ffb347', GOLD]
    for i in range(petals):
        a = TAU * i / petals
        d = right * math.cos(a) + up * math.sin(a)
        b = Vector(c) + d * r * 0.22
        e = Vector(c) + d * r
        pc.cyl(tuple(b), tuple(e), r * 0.16, r * 0.03, 5, cols[i % 3], smooth=False)
        if glow_tips:
            pc.ball(tuple(e + d * r * 0.08), r * 0.1, lighten(cols[i % 3], 0.45), glow=True, seg=6, rings=4)
    pc.ball(c, r * 0.24, GOLD_M)
    pc.ball(tuple(Vector(c) + f * r * 0.12), r * 0.12, lighten(PINK, 0.3))


def akane_pinwheel(name, two=False):
    pc = Piece(name)
    pinwheel(pc, (0, 0, 0), 0.085, face=(0.45, 0.25, 1))
    if two:
        pinwheel(pc, (-0.1, -0.035, 0.03), 0.055, petals=8, face=(0.2, 0.3, 1))
    return pc


def akane_hanabi(name):
    pc = Piece(name)
    cols = [PINK, '#ffb347', GOLD, '#ff8fb1']
    n = 12
    for i in range(n):
        a = TAU * i / n
        d = Vector((math.cos(a), math.sin(a), 0))
        L = 0.3 if i % 2 == 0 else 0.22
        b = d * 0.06
        e = d * L
        pc.cyl(tuple(b), tuple(e), 0.012, 0.005, 4, cols[i % 4], smooth=False)
        pc.ball(tuple(d * (L + 0.025)), 0.03 if i % 2 == 0 else 0.022, lighten(cols[i % 4], 0.5), glow=True, seg=5, rings=3)
    pc.ring((0, 0, 0), 0.075, 0.014, 14, 4, GOLD_M, normal=(0, 0, 1))
    pc.ball((0, 0, 0), 0.04, lighten(PINK, 0.2))
    pc.ring((0, 0, 0), 0.16, 0.006, 18, 3, lighten(GOLD, 0.4), normal=(0, 0, 1), glow=True)
    return pc


def akane_plume(name, flames=False):
    pc = Piece(name)
    # a tall phoenix plume: red base, orange body, gold tip, curving back
    pts = [(0, 0, 0), (0.01, 0.08, -0.01), (0.02, 0.16, -0.04), (0.02, 0.23, -0.09)]
    cols = ['#d8473f', '#ff7a3a', '#ffb347']
    for i in range(3):
        a, b = pts[i], pts[i + 1]
        d = Vector(b) - Vector(a)
        feather(pc, a, tuple(d), (1, 0, 0.2), d.length * 1.15, 0.075 - 0.012 * i, cols[i], lighten(cols[i], 0.25), split=0.7)
    pc.ball((0, 0, 0.005), 0.022, CYAN)  # path gem
    if flames:
        for (x, y, z, r) in ((0.02, 0.255, -0.1, 0.03), (0.035, 0.21, -0.075, 0.022), (0.0, 0.22, -0.11, 0.02)):
            pc.ball((x, y, z), (r, r * 1.6, r), '#ffd08a', glow=True, seg=6, rings=4)
    return pc


def akane_flame_wings(name):
    pc = Piece(name)
    for s in (1, -1):
        wing(pc, s, (s * 0.035, 0, 0), 0.32, '#e8473f', '#ffb347', glow_tip=True, flame=True, n=5)
        # inner flame glow along the wing's leading edge
        for i in range(4):
            t = i / 3
            pc.ball((s * (0.07 + 0.2 * t), 0.06 + 0.12 * t, -0.08 - 0.03 * t), (0.03, 0.045, 0.02), '#ffd08a', glow=True, seg=6, rings=4)
    pc.ball((0, 0, 0), (0.05, 0.04, 0.025), CYAN)
    return pc


def rocket(pc, base, h, r, body=WHITE, stripe='#d8473f', fins=GOLD, nose=GOLD_M, flame=False, lean=0.0):
    """A toy rocket standing on `base`, leaning `lean` radians toward +x (negative: toward -x)."""
    x, y, z = base
    ux, uy = math.sin(lean), math.cos(lean)

    def at(t):
        return (x + ux * t, y + uy * t, z)
    pc.cyl(at(0), at(h), r, r, 8, body, cap_color=darken(body, 0.4))
    pc.cyl(at(h * 0.55), at(h * 0.7), r * 1.03, r * 1.03, 8, stripe)
    pc.cyl(at(h), at(h + r * 2.2), r, 0.0, 8, nose, smooth=False)
    for a in (0, TAU / 3, 2 * TAU / 3):
        d = (math.cos(a) * uy, -math.cos(a) * ux, math.sin(a))
        pc.flat([(0, 0), (r * 1.6, -r * 0.6), (r * 1.6, r * 0.4), (0, r * 1.8)], (x + d[0] * r * 0.9, y + d[1] * r * 0.9, z + d[2] * r * 0.9), d, (ux, uy, 0), 0.006, fins)
    if flame:
        pc.cyl(at(-0.005), at(-h * 0.55), r * 0.85, 0.0, 8, '#ffd08a', glow=True)


def akane_rockets(name, big=False):
    pc = Piece(name)
    # a plum backpack with a crossbar; the boosters ride its ends, wide of her hair and hat brim so the camera sees them
    w = 0.12 if big else 0.1
    pc.body.box(tuple(V(0, 0.02, 0)), (w, 0.05, 0.12 if big else 0.1), '#4a1d36')
    pc.body.box(tuple(V(0, 0.02, 0.026)), (w * 0.8, 0.004, 0.022), GOLD)  # path strap
    X = 0.31 if big else 0.29
    pc.cyl((-X, 0.03, -0.01), (X, 0.03, -0.01), 0.012, 0.012, 6, '#7a3b2a')
    if big:
        for s in (1, -1):
            rocket(pc, (s * X, -0.07, -0.01), 0.22, 0.038, flame=True, lean=s * 0.3)
            rocket(pc, (s * (X - 0.08), -0.02, -0.03), 0.16, 0.028, body="#ffe9b0", stripe=PINK, flame=True, lean=s * 0.15)
    else:
        for s in (1, -1):
            rocket(pc, (s * X, -0.05, -0.01), 0.18, 0.034, lean=s * 0.3)
    return pc


def akane_goggles(name):
    pc = Piece(name)
    # a strap band round the hat crown with two round aviator lenses resting on it (well above her eyes)
    pc.ring((0, 0, 0), 0.115, 0.012, 20, 5, '#5a3a2a', normal=(0, 1, 0))
    for s in (1, -1):
        c = (s * 0.045, 0.012, 0.115)
        pc.ring(c, 0.028, 0.009, 12, 5, GOLD_M, normal=(0, 0.25, 1))
        pc.ball((c[0], c[1], c[2] - 0.002), (0.026, 0.026, 0.01), '#9fe3ff')
    return pc


# ---------------------------------------------------------------------------------------------
# Luna (Moonfox Oracle, hero): 0 lances (moon lances -> crescent of lances), 1 gravity (orbs -> event horizon),
# 2 court (star tiara -> crescent crown)
# ---------------------------------------------------------------------------------------------

LAV = '#e6dcff'
LAV_D = '#b9a6ff'
INDIGO = '#343c72'


def lance(pc, base, d, L, glow_tip=True, w=0.022):
    """A slim crystal lance: a four-sided spindle with a glowing pink tip."""
    dn = Vector(d).normalized()
    mid = tuple(base[i] + dn[i] * L * 0.3 for i in range(3))
    tip = tuple(base[i] + dn[i] * L for i in range(3))
    pc.cyl(base, mid, w * 0.25, w, 4, LAV_D, smooth=False)
    pc.cyl(mid, tip, w, 0.0, 4, LAV, smooth=False)
    if glow_tip:
        t0 = tuple(base[i] + dn[i] * L * 0.78 for i in range(3))
        pc.cyl(t0, tuple(tip[i] + dn[i] * 0.01 for i in range(3)), w * 0.55, 0.0, 4, lighten(PINK, 0.35), glow=True, smooth=False)


def luna_lances(name, n=3):
    pc = Piece(name)
    spread = 0.5 if n == 3 else 0.8
    for i in range(n):
        t = i / (n - 1)
        a = -spread / 2 + spread * t
        lance(pc, (math.sin(a) * 0.04, 0, 0), (math.sin(a), math.cos(a), -0.15), 0.3 - abs(t - 0.5) * 0.08)
    pc.ring((0, 0.0, 0), 0.03, 0.008, 12, 4, PINK, normal=(0, 0, 1))
    return pc


def luna_crescent_lances(name):
    pc = Piece(name)
    n = 7
    for i in range(n):
        a = -1.25 + 2.5 * i / (n - 1)
        d = (math.sin(a), math.cos(a), -0.1)
        b = (math.sin(a) * 0.14, math.cos(a) * 0.14, 0)
        lance(pc, b, d, 0.3 if i % 2 == 0 else 0.24, w=0.026)
    # the moon they rise from: a crescent (an open torus arc) facing the camera
    pc.ring((0, 0, 0), 0.11, 0.022, 18, 5, LAV, normal=(0, 0, 1))
    pc.ring((0, 0, 0), 0.145, 0.007, 24, 4, lighten(PINK, 0.4), normal=(0, 0, 1), glow=True)
    return pc


def orb(pc, c, r, ring_tilt=0.35):
    # a pale little moon (reads on her navy gown and on grass) with a crater and a cyan gravity ring
    pc.ball(c, r, '#d9d2ff', seg=8, rings=5)
    pc.ball((c[0] - r * 0.35, c[1] + r * 0.3, c[2] + r * 0.62), r * 0.3, '#a99be6', seg=5, rings=3)
    pc.ring(c, r * 1.6, r * 0.14, 12, 3, CYAN, normal=(math.sin(ring_tilt), 1, 0.3), glow=True)


def luna_orbs(name, n=2, planet=False):
    pc = Piece(name)
    R = 0.34
    for i in range(n):
        a = TAU * i / n
        orb(pc, (math.cos(a) * R, math.sin(a * 2) * 0.03, math.sin(a) * R), 0.055)
    if planet:
        a = TAU / (2 * n)
        c = (math.cos(a) * (R + 0.05), 0.12, math.sin(a) * (R + 0.05))
        pc.ball(c, 0.07, '#6c5fd0', seg=10, rings=6)
        pc.ring(c, 0.12, 0.014, 18, 3, CYAN, normal=(0.4, 1, 0.2), glow=True)
    return pc


def luna_tiara(name, sides=False):
    pc = Piece(name)
    # a gold band arcing over the front of her head, a star standing at its middle
    pc.ring((0, 0, 0), 0.1, 0.008, 18, 4, GOLD_M, normal=(0, 1, 0.25))
    star(pc, (0, 0.035, 0.1), 0.04, GOLD, face=(0, 0.25, 1), thick=0.016)
    pc.ball((0, 0.035, 0.112), 0.012, lighten(GOLD, 0.6), glow=True, seg=6, rings=4)
    if sides:
        for s in (1, -1):
            star(pc, (s * 0.075, 0.02, 0.07), 0.026, GOLD, face=(s * 0.6, 0.25, 1), thick=0.012)
    return pc


def luna_crown(name):
    pc = Piece(name)
    pc.ring((0, 0, 0), 0.1, 0.012, 20, 5, GOLD_M, normal=(0, 1, 0.2))
    # crown points standing up round the front half
    for i in range(5):
        a = math.pi * (0.15 + 0.7 * i / 4)
        x, z = math.cos(a) * 0.1, math.sin(a) * 0.1
        h = 0.09 if i == 2 else 0.06
        pc.cyl((x, 0.0, z), (x * 1.05, h, z * 1.05), 0.014, 0.0, 4, GOLD_M, smooth=False)
        pc.ball((x * 1.05, h + 0.008, z * 1.05), 0.01, lighten(GOLD, 0.6), glow=True, seg=6, rings=4)
    # the crescent moon rising from the front of the crown (a thick open arc, horns up)
    c = (0, 0.12, 0.08)
    pc.ring(c, 0.06, 0.018, 16, 5, '#fff3c4', normal=(0, 0.2, 1))
    star(pc, (0, 0.12, 0.09), 0.026, GOLD, face=(0, 0.2, 1), thick=0.012)
    return pc


def luna_crown_stars(name):
    """Three little stars that circle above the crown (the runtime spins this piece)."""
    pc = Piece(name)
    for i in range(3):
        a = TAU * i / 3
        star(pc, (math.cos(a) * 0.14, 0.0, math.sin(a) * 0.14), 0.03, lighten(GOLD, 0.35), face=(math.cos(a), 0.2, math.sin(a)), glow=True, thick=0.01)
    return pc


# ---------------------------------------------------------------------------------------------

FILES = {
    'aoi': [
        [lambda: aoi_quiver('p0_quiver'), lambda: aoi_comet_arrow('p0_comet'), lambda: aoi_quiver('p0_cometQuiver', big=True)],
        [lambda: aoi_feathers('p1_feathers', 3), lambda: aoi_feathers('p1_feathersWide', 5, wide=True), lambda: aoi_wings('p1_wings')],
        [lambda: aoi_falcon('p2_falcon'), lambda: aoi_falcon_band('p2_jess'), lambda: aoi_falcon('p2_apexFalcon', big=True)],
    ],
    'akane': [
        [lambda: akane_pinwheel('p0_pinwheel'), lambda: akane_pinwheel('p0_pinwheels', two=True), lambda: akane_hanabi('p0_hanabi')],
        [lambda: akane_plume('p1_plume'), lambda: akane_plume('p1_plumeFlame', flames=True), lambda: akane_flame_wings('p1_flameWings')],
        [lambda: akane_rockets('p2_rockets'), lambda: akane_goggles('p2_goggles'), lambda: akane_rockets('p2_skybreaker', big=True)],
    ],
    'luna': [
        [lambda: luna_lances('p0_lances', 3), lambda: luna_lances('p0_lances5', 5), lambda: luna_crescent_lances('p0_crescent')],
        [lambda: luna_orbs('p1_orbs', 2), lambda: luna_orbs('p1_orbs3', 3), lambda: luna_orbs('p1_horizon', 3, planet=True)],
        [lambda: luna_tiara('p2_tiara'), lambda: luna_tiara('p2_tiaraStars', sides=True), lambda: luna_crown('p2_crown'),
         lambda: luna_crown_stars('p2_crownStars')],
    ],
}
# one file per girl and path (<unit>_p<k>.glb): a girl only fetches the paths she is upgraded down
MAX_BYTES = 60 * 1024


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def build_piece(pc, mats):
    root = bpy.data.objects.new(pc.name, None)
    bpy.context.scene.collection.objects.link(root)
    objs = [root]
    for kind, part in (('body', pc.body), ('glow', pc.glow)):
        if not part.faces:
            continue
        o = part.build(f'{pc.name}_{kind}', kind)
        o.parent = root
        export.assign_material(o, mats[kind])
        objs.append(o)
    return objs


def build_file(key, k, out_dir):
    reset_scene()
    mats = make_materials()
    pieces = [fn() for fn in FILES[key][k]]
    objs = []
    stats = {}
    for pc in pieces:
        objs += build_piece(pc, mats)
        stats[pc.name] = sum(len(f[0]) - 2 for f in pc.body.faces) + sum(len(f[0]) - 2 for f in pc.glow.faces)
    name = f'{key}_p{k}'
    tmp = os.path.join(tempfile.gettempdir(), f'pathlooks_{name}_raw.glb')
    export.export_glb(tmp, objs, animations=False)
    out = os.path.join(out_dir, f'{name}.glb')
    optimize.optimize_glb(tmp, out)
    js, bin_chunk = export.read_glb(out)
    js.setdefault('asset', {})['generator'] = GENERATOR
    js['asset'].setdefault('extras', {}).update({'pieces': [pc.name for pc in pieces], 'triangles': stats, 'unit': key, 'path': k, 'source': 'blender'})
    export.write_glb(out, js, bin_chunk)
    os.remove(tmp)
    d = export.describe(out)
    flag = '' if d['size'] <= MAX_BYTES else '  OVER 60 KB'
    print(f'[pathlooks] {name}: {d["size"]} bytes, {d["primitives"]} meshes, {d["vertices"]} vertices{flag}')
    for p, v in stats.items():
        print(f'[pathlooks]   {p}: {v} triangles')
    return out, d


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument('girls', nargs='*', help=f'subset of {sorted(FILES)}')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'models', 'pathlooks'))
    a = ap.parse_args(argv)
    keys = a.girls or list(FILES)
    os.makedirs(a.out, exist_ok=True)
    for k in keys:
        if k not in FILES:
            raise SystemExit(f'unknown girl {k}; choose from {sorted(FILES)}')
        for p in range(len(FILES[k])):
            build_file(k, p, a.out)


if __name__ == '__main__':
    args = sys.argv[1:]
    if '--' in args:
        args = args[args.index('--') + 1:]
    main(args)
