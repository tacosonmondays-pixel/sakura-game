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
            pc.ball(tuple(e + d * r * 0.08), r * 0.1, lighten(cols[i % 3], 0.45), glow=True, seg=5, rings=3)
    pc.ball(c, r * 0.24, GOLD_M)
    pc.ball(tuple(Vector(c) + f * r * 0.12), r * 0.12, lighten(PINK, 0.3))


def akane_pinwheel(name, two=False):
    pc = Piece(name)
    pinwheel(pc, (0, 0, 0), 0.085, face=(0.45, 0.25, 1), glow_tips=True)
    if two:
        # the second, smaller one sits above the first, on the same (left) side: clear of her staff head on the right
        pinwheel(pc, (0.03, 0.1, -0.02), 0.055, petals=8, face=(0.35, 0.4, 1))
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
        pc.ball(tuple(d * (L + 0.025)), 0.03 if i % 2 == 0 else 0.022, lighten(cols[i % 4], 0.5), glow=True, seg=4, rings=3)
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
    # a glowing ember at the tip, so the plume reads against her own plum hat on a phone (review r1 LOW-2)
    pc.ball((0.02, 0.245, -0.095), (0.024, 0.036, 0.024), '#ffd08a', glow=True, seg=6, rings=4)
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

# ---------------------------------------------------------------------------------------------
# Rollout batch 1 (docs/specs/path-looks.md §5): Rei, Yuki, Momo, Kage (students), Nami and Hikari (adult heroes:
# props, crowns, companions and floaters only; each hero path owns its own socket so all three stack at Lv 25)
# ---------------------------------------------------------------------------------------------

SAKURA, SAKURA_D = '#ffa8c8', '#e86a9a'
STEEL_DK = '#5b6274'


def petal(pc, c, d, side, L, color, glow=False, thick=0.008):
    """A sakura petal: a short lens with a notch at its tip, lying along d."""
    pts = [(0, 0), (L * 0.35, L * 0.32), (L * 0.85, L * 0.3), (L, L * 0.1), (L * 0.9, 0), (L, -L * 0.1), (L * 0.85, -L * 0.3), (L * 0.35, -L * 0.32)]
    pc.flat(pts, c, d, side, thick, color, glow=glow)


def blade(pc, base, d, side, L, w, color, glow=False, thick=0.01):
    """A flat single-edged blade from base along d (a katana-ish lens with a point)."""
    pts = [(0, -w * 0.5), (L * 0.85, -w * 0.5), (L, 0), (L * 0.8, w * 0.5), (0, w * 0.5)]
    pc.flat(pts, base, d, side, thick, color, glow=glow)


# -- Rei: 0 Whirlwind (sakura sash bow -> orbiting petal ring), 1 Duelist (headband -> crescent crest headband),
#         2 Counter (a short sword on her back -> three spirit blades fanned behind) --------------------------------

def rei_bow(name):
    pc = Piece(name)
    for s in (1, -1):
        pc.ball((s * 0.065, 0.012, 0), (0.06, 0.04, 0.022), SAKURA)
        pc.ball((s * 0.068, 0.012, 0.004), (0.028, 0.018, 0.022), SAKURA_D)
        # tails hanging down and fluttering out
        pc.flat([(0, -0.016), (0.2, -0.022), (0.23, 0.0), (0.2, 0.024), (0, 0.016)], (s * 0.012, -0.01, -0.005),
                (s * 0.35, -1, -0.25), (1, 0, 0), 0.008, SAKURA)
        petal(pc, (s * 0.07, -0.19, -0.06), (s * 0.3, -1, -0.2), (1, 0, 0), 0.05, '#fff0f6')
    pc.ball((0, 0.01, 0.005), 0.026, PINK)
    return pc


def rei_petal_ring(name):
    pc = Piece(name)
    n = 9
    for i in range(n):
        a = TAU * i / n
        c = (math.cos(a) * 0.34, math.sin(a * 3) * 0.03, math.sin(a) * 0.34)
        tang = (-math.sin(a), 0.15, math.cos(a))
        petal(pc, c, tang, (0, 1, 0), 0.08 if i % 2 == 0 else 0.065, SAKURA if i % 3 else '#fff0f6', glow=(i % 3 == 0))
    pc.ring((0, 0, 0), 0.34, 0.006, 24, 3, lighten(PINK, 0.5), glow=True)
    return pc


def crescent(pc, c, R, r, color, face=(0, 0, 1), arc=math.pi * 1.1):
    """A crescent: an open torus arc facing `face`, its opening (horns) pointing up."""
    m = (Matrix.Translation(V(*c)) @ Vector((0, 0, 1)).rotation_difference(V(*face).normalized()).to_matrix().to_4x4()
         @ Matrix.Rotation(math.pi * 1.5 - arc / 2, 4, 'Z'))
    pc.body.torus((0, 0, 0), R, r, 14, 4, color, m=m, arc=arc)


def rei_headband(name, crest=False):
    pc = Piece(name)
    # a white band round the crown of her head (above the bangs, never over the eyes), knotted at the back with two
    # long cyan-edged tails
    pc.ring((0, 0, 0), 0.19, 0.011, 24, 4, WHITE, normal=(0, 1, -0.25))
    for s in (1, -1):
        pc.flat([(0, -0.02), (0.2, -0.026), (0.24, 0.0), (0.2, 0.026), (0, 0.02)], (s * 0.02, 0.02, -0.19),
                (s * 0.45, -0.55, -1), (0, 1, 0), 0.008, WHITE)
        pc.flat([(0.17, -0.026), (0.24, 0.0), (0.17, 0.026)], (s * 0.02, 0.02, -0.19), (s * 0.45, -0.55, -1), (0, 1, 0), 0.01, CYAN, glow=crest)
    pc.ball((0, 0.02, -0.2), 0.024, WHITE)
    if crest:
        # a gold crescent standing on the front of the band (an open arc, horns up)
        crescent(pc, (0, 0.075, 0.18), 0.05, 0.014, GOLD_M, face=(0, 0.3, 1))
        pc.ball((0, 0.06, 0.19), 0.014, lighten(CYAN, 0.5), glow=True, seg=6, rings=4)
    return pc


def rei_wakizashi(name):
    pc = Piece(name)
    # a short sword in a dark lacquer sheath, worn across her back (pivot at its middle, along local +y)
    pc.cyl((0, -0.16, 0), (0, 0.08, 0), 0.022, 0.02, 8, '#2e2440', cap_color='#1c1628')
    for y in (-0.1, 0.0):
        pc.cyl((0, y, 0), (0, y + 0.012, 0), 0.024, 0.024, 8, GOLD_M)
    pc.cyl((0, 0.08, 0), (0, 0.095, 0), 0.042, 0.042, 10, GOLD_M)  # guard
    pc.cyl((0, 0.095, 0), (0, 0.19, 0), 0.016, 0.016, 6, '#f2f2f6')  # wrapped hilt
    for y in (0.11, 0.14, 0.17):
        pc.cyl((0, y, 0), (0, y + 0.008, 0), 0.0175, 0.0175, 6, YELLOW_D)
    return pc


YELLOW_D = '#d9a400'


def rei_spirit_blades(name):
    pc = Piece(name)
    for a in (-0.55, 0.0, 0.55):
        d = (math.sin(a), math.cos(a), -0.12)
        b = (math.sin(a) * 0.05, math.cos(a) * 0.05, 0)
        blade(pc, b, d, (math.cos(a), -math.sin(a), 0), 0.34, 0.05, '#fff5c2', glow=True)
        pc.cyl((b[0] - d[0] * 0.07, b[1] - d[1] * 0.07, b[2]), b, 0.014, 0.014, 6, GOLD_M)
        pc.ring(b, 0.03, 0.008, 10, 3, GOLD_M, normal=d)
    pc.ring((0, 0.0, 0), 0.07, 0.01, 14, 3, GOLD, normal=(0, 0, 1), glow=True)
    return pc


# -- Yuki: 0 Deep Freeze (snowflake hair ornament -> great snowflake halo), 1 Frostbite (icicle shards -> diamond
#         dust ring), 2 Permafrost (frost capelet -> floating ice clock). Deep ice blues: she is all white already ---

ICE, ICE_D, ICE_G = '#6fc8ff', '#2f7fd0', '#c9f2ff'


def snowflake(pc, c, r, color, face=(0, 0, 1), glow_tips=False, w=None):
    f = Vector(face).normalized()
    up = Vector((0, 1, 0)) if abs(f.y) < 0.9 else Vector((0, 0, 1))
    right = up.cross(f).normalized()
    up = f.cross(right).normalized()
    C = Vector(c)
    w = w or r * 0.11
    for i in range(6):
        a = TAU * i / 6
        d = right * math.cos(a) + up * math.sin(a)
        pc.cyl(tuple(C), tuple(C + d * r), w, w * 0.6, 4, color, smooth=False)
        for t, L in ((0.45, 0.32), (0.72, 0.22)):
            for s in (1, -1):
                bd = (d * math.cos(0.9) + (f.cross(d)) * s * math.sin(0.9)).normalized()
                p0 = C + d * r * t
                pc.cyl(tuple(p0), tuple(p0 + bd * r * L), w * 0.7, w * 0.4, 4, color, smooth=False)
        if glow_tips:
            pc.ball(tuple(C + d * r * 1.05), r * 0.07, ICE_G, glow=True, seg=5, rings=3)
    pc.ball(tuple(C), r * 0.16, ICE_G, glow=glow_tips, seg=6, rings=4)


def yuki_flake(name, big=False):
    pc = Piece(name)
    if big:
        snowflake(pc, (0, 0, 0), 0.3, ICE, glow_tips=True, w=0.016)
        pc.ring((0, 0, 0), 0.22, 0.006, 24, 3, ICE_G, normal=(0, 0, 1), glow=True)
    else:
        snowflake(pc, (0, 0, 0), 0.085, ICE_D, face=(0.5, 0.3, 1), w=0.011)
        pc.ball((0, 0, 0.012), 0.016, PINK)  # path gem
    return pc


def icicle(pc, c, d, L, r, color, glow=False):
    dn = Vector(d).normalized()
    C = Vector(c)
    pc.cyl(tuple(C - dn * L * 0.35), tuple(C), 0.0, r, 5, color, glow=glow, smooth=False)
    pc.cyl(tuple(C), tuple(C + dn * L * 0.65), r, 0.0, 5, color, glow=glow, smooth=False)


def yuki_shards(name, n=2, big=False):
    pc = Piece(name)
    R = 0.34
    for i in range(n):
        a = TAU * i / n
        c = (math.cos(a) * R, (0.04 if i % 2 else -0.02) * (1 if big else 0), math.sin(a) * R)
        icicle(pc, c, (-math.sin(a) * 0.3, 1, math.cos(a) * 0.3), 0.2 if not big else 0.15, 0.036 if not big else 0.03, ICE if i % 2 else ICE_D)
        icicle(pc, (c[0], c[1] + 0.005, c[2]), (-math.sin(a) * 0.3, 1, math.cos(a) * 0.3), 0.12, 0.016, ICE_G, glow=True)
    if big:
        for i in range(n):
            a = TAU * (i + 0.5) / n
            pc.ball((math.cos(a) * R * 1.06, 0.07, math.sin(a) * R * 1.06), 0.022, ICE_G, glow=True, seg=5, rings=3)
    pc.ring((0, 0, 0), R, 0.005, 24, 3, CYAN, glow=True)
    return pc


def yuki_cape(name):
    pc = Piece(name)
    # a short frosty capelet hanging from her shoulders (pivot at the collar), a fluffy collar and a yellow clasp
    # (narrow and short, a shoulder capelet: a longer cape hid her staff head, held low behind her hip, from the camera)
    pts = [(-0.13, 0), (0.13, 0), (0.14, -0.1)]
    for i in range(6):
        x = 0.14 - 0.28 * i / 5
        pts.append((x, -0.13 if i % 2 else -0.1))
    pc.flat(pts, (0, 0, -0.01), (1, 0, 0), (0, 1, -0.22), 0.02, '#4f9fe8', side=ICE_D)
    for i in range(7):
        a = math.pi * (0.15 + 0.7 * i / 6)
        pc.ball((math.cos(a) * 0.12, 0.005, -math.sin(a) * 0.06), 0.028, WHITE, seg=6, rings=4)
    pc.ball((0, -0.005, -0.075), 0.022, GOLD)  # path clasp
    return pc


def yuki_frost(name):
    pc = Piece(name)
    for (a, L) in ((-0.3, 0.17), (0.05, 0.25), (0.4, 0.15)):
        crystal(pc, (math.sin(a) * 0.03, 0, 0), (math.sin(a), math.cos(a), -0.12), L, 0.032, ICE if a < 0.3 else ICE_D, glow=True)
    pc.ball((0, 0, 0.01), 0.022, GOLD)  # path gem
    return pc


def yuki_clock(name):
    pc = Piece(name)
    pc.ring((0, 0, 0), 0.17, 0.016, 20, 4, ICE, normal=(0, 0, 1))
    pc.ring((0, 0, 0), 0.2, 0.006, 20, 3, ICE_G, normal=(0, 0, 1), glow=True)
    pc.cyl((0, 0, -0.01), (0, 0, 0.004), 0.16, 0.16, 20, '#dff4ff', caps=True)
    for i in range(12):
        a = TAU * i / 12
        pc.ball((math.cos(a) * 0.135, math.sin(a) * 0.135, 0.01), 0.012 if i % 3 else 0.02, ICE_D if i % 3 else GOLD, seg=5, rings=3)
    pc.cyl((0, 0, 0.012), (0, 0.11, 0.012), 0.008, 0.004, 4, ICE_D, smooth=False)
    pc.cyl((0, 0, 0.012), (0.075, -0.03, 0.012), 0.008, 0.004, 4, ICE_D, smooth=False)
    pc.ball((0, 0, 0.018), 0.018, ICE_D, seg=6, rings=4)
    for s in (1, -1):
        icicle(pc, (s * 0.12, 0.17, 0), (s * 0.4, 1, 0), 0.12, 0.022, ICE)
    return pc


# -- Momo: 0 Fan Club (peach hair clip -> golden peach bank), 1 Merch (light-stick tote -> golden ledger),
#         2 Encore (star-coin clips -> a ring of coins and stars) ---------------------------------------------

PEACH, PEACH_D, LEAF = '#ffb38a', '#ff8a7a', '#6fcf5e'


def momo_peach(name):
    pc = Piece(name)
    for s in (1, -1):
        pc.ball((s * 0.022, 0, 0), (0.042, 0.05, 0.042), PEACH if s > 0 else PEACH_D)
    pc.ball((0, 0.048, -0.004), (0.03, 0.01, 0.016), LEAF)
    pc.ball((0.012, 0.0, 0.035), 0.012, PINK, seg=6, rings=4)  # path dot
    return pc


def momo_peach_bank(name):
    pc = Piece(name)
    for s in (1, -1):
        pc.ball((s * 0.03, 0, 0), (0.07, 0.085, 0.075), GOLD_M if s > 0 else '#e8b23a')
    pc.body.box(tuple(V(0, 0.083, 0)), (0.05, 0.01, 0.008), '#7a5a1a')  # coin slot
    for s in (1, -1):
        pc.ball((s * 0.03, 0.09, -0.01), (0.04, 0.012, 0.02), LEAF)
    pc.cyl((0, 0.13, 0), (0, 0.142, 0), 0.03, 0.03, 12, lighten(GOLD, 0.4), glow=True)  # a coin dropping in
    for s in (1, -1):
        pc.ball((s * 0.03, 0.02, 0.07), 0.009, '#3a2238', seg=5, rings=3)  # a smiley
    pc.ball((0, -0.01, 0.075), (0.012, 0.006, 0.006), '#3a2238', seg=5, rings=3)
    return pc


def momo_tote(name):
    pc = Piece(name)
    pc.body.box(tuple(V(0, 0, 0)), (0.16, 0.05, 0.14), '#ffd1e3')
    pc.body.box(tuple(V(0, 0.02, 0.026)), (0.12, 0.004, 0.05), '#ff9ec4')
    star(pc, (0, 0.02, 0.03), 0.026, CYAN, thick=0.008)  # path star
    pc.ring((0, 0.07, 0), 0.07, 0.008, 14, 3, '#ff9ec4', normal=(0, 0, 1))
    for x, col in ((-0.045, CYAN), (0.0, PINK), (0.045, '#ffe066')):
        top = (x * 5.0, 0.3, -0.05)
        pc.cyl((x, 0.05, -0.005), top, 0.016, 0.016, 6, lighten(col, 0.3), glow=True)
        pc.ball(top, 0.022, lighten(col, 0.55), glow=True, seg=5, rings=3)
        pc.cyl((x, 0.0, -0.005), (x, 0.05, -0.005), 0.016, 0.016, 6, '#3a3f52')
    return pc


def momo_ledger(name):
    pc = Piece(name)
    for s in (1, -1):
        m = basis((s * 0.065, 0, 0), (s * 1, 0.25, 0.0), (0, 0, 1))
        pc.body.box((0, 0, 0), (0.13, 0.17, 0.012), GOLD_M, m=m)
        pc.body.box((0, 0, 0.008), (0.115, 0.155, 0.006), '#fff8e6', m=m)
    pc.cyl((0, -0.085, 0), (0, 0.085, 0), 0.01, 0.01, 6, '#b8860b')
    star(pc, (0, 0.13, 0.02), 0.04, lighten(GOLD, 0.45), glow=True, thick=0.01)
    for x in (-0.08, 0.08):
        pc.ball((x, 0.1, 0.03), 0.012, lighten(CYAN, 0.4), glow=True, seg=5, rings=3)
    return pc


def momo_clips(name):
    pc = Piece(name)
    star(pc, (0, 0, 0), 0.05, GOLD_M, face=(0.4, 0.4, 1), thick=0.016)
    star(pc, (-0.07, -0.04, 0.0), 0.034, GOLD, face=(0.2, 0.4, 1), thick=0.012)
    pc.cyl((0.06, -0.035, 0.0), (0.06, -0.035, 0.012), 0.024, 0.024, 12, '#ffd36b')  # a coin
    pc.ball((0, 0, 0.02), 0.012, lighten(GOLD, 0.6), glow=True, seg=5, rings=3)
    return pc


def momo_coin_ring(name):
    pc = Piece(name)
    R = 0.34
    for i in range(10):
        a = TAU * i / 10
        c = (math.cos(a) * R, math.sin(a * 2) * 0.025, math.sin(a) * R)
        if i % 3 == 0:
            star(pc, c, 0.04, lighten(GOLD, 0.35), face=(math.cos(a), 0.3, math.sin(a)), glow=True, thick=0.01)
        else:
            d = Vector((math.cos(a), 0.2, math.sin(a))).normalized()
            pc.cyl(tuple(Vector(c) - d * 0.005), tuple(Vector(c) + d * 0.005), 0.03, 0.03, 10, GOLD_M)
    pc.ring((0, 0, 0), R, 0.005, 24, 3, lighten(GOLD, 0.4), glow=True)
    return pc


# -- Kage: 0 Steel (a big shuriken on her back -> six shuriken circling), 1 Shadow Mark (long scarf -> violet glowing
#         scarf + crescent headband plate), 2 Kunai (a kunai fan -> a black lotus of blades behind her) --------------

KAGE_V, KAGE_D = '#9b6bff', '#2e2540'


def shuriken(pc, c, r, face=(0, 0, 1), up=(0, 1, 0), glow=False):
    star(pc, c, r, '#c6ccd8' if not glow else '#e6e9f2', face=face, up=up, thick=0.016, inner=0.32)
    f = Vector(face).normalized()
    pc.cyl(tuple(Vector(c) - f * 0.012), tuple(Vector(c) + f * 0.012), r * 0.25, r * 0.25, 8, KAGE_V if not glow else lighten(KAGE_V, 0.4), glow=glow)


def kage_shuriken(name):
    pc = Piece(name)
    star(pc, (0, 0, 0), 0.13, '#c6ccd8', thick=0.02, inner=0.3, up=(0.4, 1, 0))
    pc.cyl((0, 0, -0.014), (0, 0, 0.014), 0.035, 0.035, 10, PINK)  # path hub
    pc.cyl((0, 0, -0.016), (0, 0, 0.016), 0.014, 0.014, 8, KAGE_D)
    return pc


def kage_shuriken_ring(name):
    pc = Piece(name)
    R = 0.35
    for i in range(6):
        a = TAU * i / 6
        shuriken(pc, (math.cos(a) * R, 0.0, math.sin(a) * R), 0.06, face=(0, 1, 0), up=(math.cos(a), 0, math.sin(a)), glow=(i % 2 == 0))
    pc.ring((0, 0, 0), R, 0.005, 24, 3, lighten(PINK, 0.4), glow=True)
    return pc


def kage_scarf(name, glow=False):
    pc = Piece(name)
    col = '#ff5a5a' if glow else '#d83a3a'
    # (no loop round the front of her neck: from the battle camera it would sit under her chin)
    pc.ball((0, -0.005, -0.075), (0.07, 0.03, 0.03), col)
    for k, L in ((0, 1.0), (1, 0.8)):
        dy = -0.035 * k
        path = [(0.03, -0.01 + dy, -0.07), (0.13 * L, -0.03 + dy, -0.13), (0.26 * L, -0.05 + dy, -0.16), (0.4 * L, -0.03 + dy, -0.17)]
        rad = [0.03, 0.028, 0.024, 0.012]
        pc.body.tube([V(*p) for p in path], rad, 6, col)
        if glow:
            # a violet glow along the tail's last stretch
            pc.glow.tube([V(*p) for p in path[2:]], [0.024, 0.016], 6, lighten(KAGE_V, 0.35))
    pc.ball((0.02, -0.02, -0.075), 0.022, CYAN)  # path knot
    return pc


def kage_crescent(name):
    pc = Piece(name)
    # a crescent moon plate riding the top of her own headband (well above the eyes): an open arc, horns up
    crescent(pc, (0, 0, 0), 0.05, 0.016, '#e3e6ef', face=(0, 0.35, 1))
    pc.ball((0.0, 0.0, 0.01), 0.014, lighten(KAGE_V, 0.4), glow=True, seg=6, rings=4)
    return pc


def kunai(pc, base, d, L, color='#c6ccd8', glow=False):
    dn = Vector(d).normalized()
    B = Vector(base)
    pc.ring(tuple(B - dn * 0.012), 0.012, 0.004, 8, 3, '#3a3150', normal=tuple(dn.cross(Vector((0, 0, 1))) if abs(dn.z) < 0.9 else (1, 0, 0)))
    pc.cyl(tuple(B), tuple(B + dn * L * 0.35), 0.008, 0.008, 5, '#3a3150')
    side = dn.cross(Vector((0, 0, 1))).normalized() if abs(dn.z) < 0.9 else Vector((1, 0, 0))
    pc.flat([(0, -0.016), (L * 0.45, -0.02), (L * 0.65, 0), (L * 0.45, 0.02), (0, 0.016)], tuple(B + dn * L * 0.35), tuple(dn), tuple(side), 0.008, color, glow=glow)


def kage_kunai_fan(name):
    pc = Piece(name)
    pc.body.box(tuple(V(0, -0.02, 0)), (0.13, 0.04, 0.06), KAGE_D)
    pc.body.box(tuple(V(0, -0.02, 0.021)), (0.11, 0.004, 0.02), GOLD)  # path band
    for i in range(5):
        a = -0.6 + 1.2 * i / 4
        kunai(pc, (math.sin(a) * 0.04, 0.0, 0), (math.sin(a), math.cos(a), -0.1), 0.24)
    return pc


def kage_lotus(name):
    pc = Piece(name)
    n = 8
    for i in range(n):
        a = TAU * i / n
        d = (math.cos(a), math.sin(a), 0.35)
        side = (-math.sin(a), math.cos(a), 0)
        pc.flat([(0, -0.03), (0.16, -0.05), (0.26, 0), (0.16, 0.05), (0, 0.03)], (math.cos(a) * 0.03, math.sin(a) * 0.03, 0), d, side, 0.012, KAGE_D, side='#14101f')
        pc.flat([(0.2, -0.02), (0.27, 0), (0.2, 0.02)], (math.cos(a) * 0.03, math.sin(a) * 0.03, 0.002), d, side, 0.016, lighten(KAGE_V, 0.35), glow=True)
    pc.ball((0, 0, 0.02), 0.05, KAGE_V)
    pc.ball((0, 0, 0.05), 0.022, lighten(GOLD, 0.4), glow=True, seg=6, rings=4)
    return pc


# -- Nami (hero): 0 Frostbrand (ice crystals behind her right shoulder -> a fan of ice spikes) [chest],
#                 1 Undertow (a water ring -> a friendly water serpent) [orbit], 2 Harbor (anchor badge on the cap ->
#                 a ship's wheel floating above her) [head] --------------------------------------------------------

WATER, WATER_D, FOAM = '#4fc3e8', '#1f78b8', '#e8fbff'


def crystal(pc, base, d, L, r, color, glow=False):
    dn = Vector(d).normalized()
    B = Vector(base)
    pc.cyl(tuple(B), tuple(B + dn * L * 0.75), r, r, 6, color, smooth=False)
    pc.cyl(tuple(B + dn * L * 0.75), tuple(B + dn * L), r, 0.0, 6, lighten(color, 0.3), glow=glow, smooth=False)


def nami_crystals(name, big=False):
    pc = Piece(name)
    if big:
        for i in range(7):
            a = -1.1 + 2.2 * i / 6
            crystal(pc, (math.sin(a) * 0.06, math.cos(a) * 0.06, 0), (math.sin(a), math.cos(a), -0.15), 0.3 if i % 2 == 0 else 0.22, 0.03, ICE, glow=True)
        pc.ring((0, 0, 0), 0.08, 0.012, 16, 3, ICE_G, normal=(0, 0, 1), glow=True)
    else:
        for (a, L) in ((-0.35, 0.18), (0.0, 0.24), (0.4, 0.16)):
            crystal(pc, (math.sin(a) * 0.03, 0, 0), (math.sin(a), math.cos(a), -0.1), L, 0.03, ICE, glow=True)
        pc.ball((0, 0, 0.01), 0.022, PINK)  # path gem
    return pc


def nami_water_ring(name):
    pc = Piece(name)
    R = 0.35
    pc.ring((0, 0, 0), R, 0.022, 24, 4, WATER)
    for i in range(8):
        a = TAU * i / 8
        pc.ball((math.cos(a) * R, 0.022, math.sin(a) * R), (0.032, 0.02, 0.032), FOAM, seg=5, rings=3)
    pc.ring((0, 0.0, 0), R + 0.035, 0.005, 24, 3, lighten(CYAN, 0.4), glow=True)
    return pc


def nami_serpent(name):
    pc = Piece(name)
    R = 0.36
    pts = []
    rad = []
    n = 14
    for i in range(n):
        a = 1.7 * math.pi * i / (n - 1)
        pts.append(V(math.cos(a) * R, -0.08 + 0.2 * i / (n - 1) + 0.03 * math.sin(a * 3), math.sin(a) * R))
        rad.append(0.012 + 0.02 * math.sin(math.pi * min(1.0, (i + 1) / n)))
    pc.body.tube(pts, rad, 7, WATER)
    # a cute round head at the end, two eyes and a little fin crest
    a = 1.7 * math.pi
    h = (math.cos(a) * R, 0.15, math.sin(a) * R)
    pc.ball(h, (0.05, 0.045, 0.05), WATER)
    fwd = Vector((-math.sin(a), 0, math.cos(a)))
    side = Vector((math.cos(a), 0, math.sin(a)))
    for s in (1, -1):
        e = Vector(h) + fwd * 0.03 + side * s * 0.025 + Vector((0, 0.015, 0))
        pc.ball(tuple(e), 0.011, '#183a5c', seg=5, rings=3)
    pc.cyl((h[0], h[1] + 0.03, h[2]), (h[0] - fwd.x * 0.04, h[1] + 0.07, h[2] - fwd.z * 0.04), 0.018, 0.0, 4, FOAM, smooth=False)
    pc.ring((0, 0.0, 0), R, 0.005, 32, 3, lighten(CYAN, 0.4), glow=True)
    return pc


def nami_anchor(name):
    pc = Piece(name)
    # a gold anchor badge standing on the cap's crown (above the brim, never over the eyes)
    pc.cyl((0, -0.05, 0), (0, 0.05, 0), 0.01, 0.01, 6, GOLD_M)
    pc.ring((0, 0.065, 0), 0.016, 0.006, 10, 3, GOLD_M, normal=(0, 0, 1))
    pc.cyl((-0.03, 0.03, 0), (0.03, 0.03, 0), 0.007, 0.007, 6, GOLD_M)
    for s in (1, -1):
        pc.cyl((0, -0.05, 0), (s * 0.04, -0.025, 0), 0.008, 0.008, 6, GOLD_M)
        pc.cyl((s * 0.04, -0.025, 0), (s * 0.048, -0.008, 0), 0.008, 0.0, 4, GOLD_M, smooth=False)
    pc.ball((0, 0.0, 0.012), 0.012, GOLD, glow=True, seg=5, rings=3)
    return pc


def nami_wheel(name):
    pc = Piece(name)
    WOOD = '#9a6440'
    pc.ring((0, 0, 0), 0.13, 0.014, 24, 4, WOOD, normal=(0, 0, 1))
    for i in range(8):
        a = TAU * i / 8
        d = Vector((math.cos(a), math.sin(a), 0))
        pc.cyl((0, 0, 0), tuple(d * 0.13), 0.008, 0.008, 5, WOOD)
        pc.cyl(tuple(d * 0.13), tuple(d * 0.18), 0.011, 0.007, 5, '#c8925f')
    pc.cyl((0, 0, -0.015), (0, 0, 0.015), 0.035, 0.035, 10, GOLD_M)
    pc.ring((0, 0, 0), 0.16, 0.005, 24, 3, lighten(GOLD, 0.4), normal=(0, 0, 1), glow=True)
    return pc


# -- Hikari (hero): 0 Radiant (a sun medallion behind her -> a great sun disc) [chest], 1 Sanctuary (a shield charm ->
#                   three dawn shields circling) [orbit], 2 Lightbringer (light-feather wings at her head -> a radiant
#                   sun crown) [head] ------------------------------------------------------------------------------

SUN, SUN_D, DAWN = '#ffd23f', '#e8a41a', '#fff3c4'


def sun(pc, r, rays=12, glow=False):
    pc.cyl((0, 0, -0.01), (0, 0, 0.01), r * 0.42, r * 0.42, 16, SUN)
    pc.ring((0, 0, 0), r * 0.46, r * 0.05, 20, 3, SUN_D, normal=(0, 0, 1))
    for i in range(rays):
        a = TAU * i / rays
        L = r if i % 2 == 0 else r * 0.78
        pc.flat([(r * 0.48, -r * 0.08), (L, 0), (r * 0.48, r * 0.08)], (0, 0, 0), (math.cos(a), math.sin(a), 0), (-math.sin(a), math.cos(a), 0), 0.01, SUN if i % 2 == 0 else SUN_D, glow=glow and i % 2 == 0)


def hikari_sun(name, big=False):
    pc = Piece(name)
    if big:
        sun(pc, 0.3, rays=16, glow=True)
        pc.ring((0, 0, 0), 0.33, 0.006, 32, 3, DAWN, normal=(0, 0, 1), glow=True)
    else:
        sun(pc, 0.11, rays=10)
    pc.ball((0, 0, 0.015), 0.02 if not big else 0.035, PINK)  # path gem
    return pc


def heater_shield(pc, c, d, s, glow=False):
    """A small white-and-gold heater shield at c facing d (s = size)."""
    side = Vector(d).cross(Vector((0, 1, 0))).normalized()
    pts = [(-s, s * 0.9), (s, s * 0.9), (s * 0.95, 0), (0, -s * 1.2), (-s * 0.95, 0)]
    pc.flat(pts, c, tuple(side), (0, 1, 0), 0.02, '#f6f3ec', side=GOLD_M)
    star(pc, tuple(Vector(c) + Vector(d).normalized() * 0.012), s * 0.45, CYAN, face=d, thick=0.008, glow=glow)


def hikari_shields(name, n=1):
    pc = Piece(name)
    R = 0.36
    for i in range(n):
        a = TAU * i / n
        c = (math.cos(a) * R, 0.0, math.sin(a) * R)
        heater_shield(pc, c, (math.cos(a), 0, math.sin(a)), 0.085 if n == 1 else 0.075, glow=(n > 1))
    pc.ring((0, 0, 0), R, 0.005, 24, 3, lighten(CYAN, 0.4), glow=True)
    return pc


def hikari_wings(name):
    pc = Piece(name)
    for s in (1, -1):
        for i in range(3):
            a = 0.25 + 0.38 * i
            feather(pc, (s * 0.2, 0, 0), (s * math.cos(a), math.sin(a), -0.35), (0, 0.3, 1), 0.13 - 0.02 * i, 0.05, WHITE, YELLOW_D, split=0.6, quill=False)
        pc.ball((s * 0.2, 0, 0), 0.02, GOLD)  # path studs at her temples' height, wide of her hair
    return pc


def hikari_suncrown(name):
    pc = Piece(name)
    pc.ring((0, 0, 0), 0.13, 0.014, 24, 4, GOLD_M, normal=(0, 1, 0))
    for i in range(9):
        a = math.pi * (0.05 + 0.9 * i / 8)
        x, z = math.cos(a) * 0.13, math.sin(a) * 0.13
        h = 0.12 if i == 4 else (0.09 if i % 2 == 0 else 0.065)
        pc.cyl((x, 0.0, z), (x * 1.18, h, z * 1.18), 0.016, 0.0, 4, SUN, smooth=False)
        pc.ball((x * 1.2, h + 0.01, z * 1.2), 0.012, DAWN, glow=True, seg=5, rings=3)
    for s in (1, -1):
        for i in range(2):
            a = 0.3 + 0.45 * i
            feather(pc, (s * 0.12, 0.02, -0.02), (s * math.cos(a), math.sin(a), -0.3), (0, 0.3, 1), 0.12 - 0.02 * i, 0.045, WHITE, SUN, split=0.6, quill=False, glow_tip=True)
    return pc


# ---------------------------------------------------------------------------------------------
# Rollout batch 2 (docs/specs/path-looks.md §5): Sango, Umeko, Shiro, Midori, Suzu, Raika (all students). Nothing on a
# weapon head (a weapon-tip muzzle sits there): guns and staves keep their own looks; pieces ride the head, the back,
# or float / circle beside them.
# ---------------------------------------------------------------------------------------------

CORAL, CORAL_D, NAVY = '#ff8a80', '#d8574f', '#1d4e89'


def shell(pc, c, d, L, r, body=STEEL, band=PINK, tip=None):
    """A pointed artillery shell lying along d (base at c)."""
    dn = Vector(d).normalized()
    C = Vector(c)
    pc.cyl(tuple(C), tuple(C + dn * L * 0.62), r, r, 8, body, cap_color=darken(body, 0.35))
    pc.cyl(tuple(C + dn * L * 0.18), tuple(C + dn * L * 0.3), r * 1.04, r * 1.04, 8, band)
    pc.cyl(tuple(C + dn * L * 0.62), tuple(C + dn * L), r, 0.0, 8, tip or lighten(body, 0.2), smooth=False)


def sango_shells(name):
    pc = Piece(name)
    pc.body.box(tuple(V(0, -0.02, 0)), (0.12, 0.05, 0.05), '#6e4429')
    for i, x in enumerate((-0.035, 0.0, 0.035)):
        shell(pc, (x, -0.02, 0), (x * 1.5, 1, -0.1), 0.2 if i == 1 else 0.17, 0.02, body=STEEL, band=PINK, tip='#c7cfda')
    return pc


def sango_anchor(name):
    pc = Piece(name)
    # a big coral-and-steel anchor slung across her back (pivot at its middle, shank along +y)
    pc.cyl((0, -0.2, 0), (0, 0.2, 0), 0.022, 0.022, 8, '#c7cfda')
    pc.ring((0, 0.24, 0), 0.04, 0.012, 14, 4, '#c7cfda', normal=(0, 0, 1))
    pc.cyl((-0.1, 0.12, 0), (0.1, 0.12, 0), 0.016, 0.016, 8, CORAL_D)
    crescent(pc, (0, -0.08, 0), 0.13, 0.02, '#c7cfda', face=(0, 0, 1), arc=math.pi)
    for s in (1, -1):
        pc.cyl((s * 0.13, -0.08, 0), (s * 0.17, -0.0, 0), 0.02, 0.0, 4, '#c7cfda', smooth=False)
    pc.ring((0, -0.02, 0), 0.05, 0.01, 14, 4, CORAL, normal=(0, 0, 1))
    pc.ball((0, 0.12, 0.02), 0.024, PINK)  # path stud
    pc.ring((0, 0, 0), 0.26, 0.005, 24, 3, lighten(PINK, 0.4), normal=(0, 0, 1), glow=True)
    return pc


def bomb(pc, c, r, color='#2f3a4e', glow=True):
    pc.ball(c, r, color, seg=8, rings=5)
    pc.ball((c[0] + r * 0.35, c[1] + r * 0.35, c[2] + r * 0.5), r * 0.25, lighten(color, 0.4), seg=5, rings=3)
    pc.cyl((c[0], c[1] + r * 0.85, c[2]), (c[0] + r * 0.2, c[1] + r * 1.4, c[2]), r * 0.15, r * 0.12, 5, '#c8a06a')
    pc.ball((c[0] + r * 0.22, c[1] + r * 1.5, c[2]), r * 0.22, '#ffd08a', glow=glow, seg=5, rings=3)


def sango_bombs(name):
    pc = Piece(name)
    for (x, y, r) in ((0, 0, 0.05), (0.07, -0.035, 0.038), (-0.06, -0.04, 0.034)):
        bomb(pc, (x, y, 0), r)
    pc.ball((0, -0.02, 0.05), 0.014, CYAN)  # path dot
    return pc


def mortar(pc, c, r=0.035):
    x, y, z = c
    pc.cyl((x, y - r, z), (x, y + r * 0.2, z), r * 1.3, r * 1.1, 8, '#6e4429')
    pc.cyl((x, y, z), (x, y + r * 2.0, z + r * 0.4), r * 0.75, r * 0.8, 8, '#4a5466')
    pc.ring((x, y + r * 2.0, z + r * 0.4), r * 0.8, r * 0.18, 10, 3, CYAN, normal=(0, 1, 0.2))


def sango_mortars(name):
    pc = Piece(name)
    R = 0.34
    for i in range(3):
        a = TAU * i / 3
        mortar(pc, (math.cos(a) * R, 0, math.sin(a) * R), 0.04)
    pc.ring((0, -0.03, 0), R, 0.005, 24, 3, lighten(CYAN, 0.4), glow=True)
    return pc


def sango_spyglass(name, big=False):
    pc = Piece(name)
    # a brass spyglass tucked in her beret band and a feather (big: a captain's plume and an anchor medallion)
    pc.cyl((-0.08, 0, 0), (0.06, 0.02, 0), 0.016, 0.02, 8, GOLD_M)
    pc.cyl((0.06, 0.02, 0), (0.1, 0.026, 0), 0.022, 0.022, 8, '#6e4429')
    pc.ball((0.1, 0.026, 0.0), 0.012, '#9fe3ff', seg=5, rings=3)
    n = 3 if big else 1
    for i in range(n):
        a = 0.35 * (i - (n - 1) / 2)
        feather(pc, (-0.02, 0.01, -0.02), (math.sin(a) - 0.2, 1, -0.45), (1, 0, 0), 0.2 if big else 0.15, 0.05, GOLD if i == 0 else WHITE, CORAL, split=0.6)
    if big:
        pc.ring((0, 0.0, 0.04), 0.035, 0.01, 12, 4, GOLD_M, normal=(0, 0.3, 1))
        pc.ball((0, 0.0, 0.05), 0.016, lighten(GOLD, 0.5), glow=True, seg=5, rings=3)
    return pc


# -- Umeko: 0 Lighthouse (a paper lantern by her head -> four lanterns circling), 1 Plum Rain (plum blossom crown ->
#           a plum-petal water wheel behind her), 2 Undertow (a pearl ring circling -> a great clam shell behind her) ---

PLUM, PLUM_D, PEARL = '#f7a6c8', '#d9708f', '#fbf6ff'


def lantern(pc, c, r, glow=True):
    x, y, z = c
    pc.ball(c, (r, r * 1.2, r), '#ffe8b0' if not glow else '#fff0c8', glow=glow, seg=8, rings=5)
    for dy in (-r * 1.15, r * 1.15):
        pc.cyl((x, y + dy - r * 0.08, z), (x, y + dy + r * 0.08, z), r * 0.55, r * 0.55, 8, '#c0392b')
    pc.cyl((x, y + r * 1.25, z), (x, y + r * 1.7, z), r * 0.08, r * 0.08, 4, '#5a3a2a')
    pc.cyl((x, y - r * 1.25, z), (x, y - r * 1.9, z), r * 0.12, r * 0.02, 4, PINK)  # path tassel


def umeko_lantern(name):
    pc = Piece(name)
    lantern(pc, (0, 0, 0), 0.05)
    return pc


def umeko_lanterns(name):
    pc = Piece(name)
    R = 0.36
    for i in range(4):
        a = TAU * i / 4
        lantern(pc, (math.cos(a) * R, 0.03 * (i % 2), math.sin(a) * R), 0.042)
    pc.ring((0, -0.07, 0), R, 0.005, 24, 3, lighten(PINK, 0.45), glow=True)
    return pc


def blossom(pc, c, r, color=PLUM, face=(0, 1, 0)):
    f = Vector(face).normalized()
    up = Vector((0, 0, 1)) if abs(f.z) < 0.9 else Vector((0, 1, 0))
    right = up.cross(f).normalized()
    up = f.cross(right).normalized()
    for i in range(5):
        a = TAU * i / 5
        d = right * math.cos(a) + up * math.sin(a)
        pc.ball(tuple(Vector(c) + d * r * 0.6), (r * 0.45, r * 0.45, r * 0.45), color, seg=4, rings=3)
    pc.ball(c, r * 0.3, '#ffe066', seg=4, rings=3)


def umeko_crown(name):
    pc = Piece(name)
    # blossoms round the back of her head and on her left only: her staff head rests by her right temple
    for i in range(5):
        a = math.pi * (-0.5 + 0.7 * i / 4)
        x, z = math.cos(a) * 0.16, math.sin(a) * 0.12
        blossom(pc, (x, 0.0, z), 0.045 if i % 2 else 0.055, PLUM if i % 2 else '#fff0f6', face=(x, 0.6, z))
    pc.ring((0, -0.01, 0.0), 0.15, 0.008, 14, 3, '#6fa86a', normal=(0, 1, 0.1))
    pc.ball((0, 0.0, 0.13), 0.016, CYAN)  # path bud
    return pc


def umeko_wheel(name):
    pc = Piece(name)
    pc.ring((0, 0, 0), 0.24, 0.016, 20, 4, '#7fd6e8', normal=(0, 0, 1))
    pc.ring((0, 0, 0), 0.27, 0.006, 20, 3, lighten(CYAN, 0.45), normal=(0, 0, 1), glow=True)
    for i in range(6):
        a = TAU * i / 6
        d = Vector((math.cos(a), math.sin(a), 0))
        pc.cyl((0, 0, 0), tuple(d * 0.24), 0.008, 0.008, 4, '#bfeaf2')
        blossom(pc, tuple(d * 0.24), 0.045, PLUM if i % 2 else '#fff0f6', face=(0, 0, 1))
    blossom(pc, (0, 0, 0.01), 0.06, PLUM_D, face=(0, 0, 1))
    return pc


def pearl_ring(pc, R, n, r):
    for i in range(n):
        a = TAU * i / n
        pc.ball((math.cos(a) * R, 0.0, math.sin(a) * R), r, PEARL if i % 3 else '#ffe6f2', seg=6, rings=4)
    pc.ring((0, 0, 0), R, 0.005, 24, 3, lighten(GOLD, 0.4), glow=True)


def umeko_pearls(name):
    pc = Piece(name)
    pearl_ring(pc, 0.34, 10, 0.024)
    return pc


def umeko_clam(name):
    pc = Piece(name)
    # a scalloped clam shell standing behind her (ribs fanned up), pearls along its rim
    n = 9
    for i in range(n):
        a = math.pi * (0.08 + 0.84 * i / (n - 1))
        d = (math.cos(a), math.sin(a), -0.12)
        side = (-math.sin(a), math.cos(a), 0)
        pc.flat([(0, -0.02), (0.3, -0.05), (0.33, 0), (0.3, 0.05), (0, 0.02)], (0, 0, 0), d, side, 0.014,
                '#ffe3ee' if i % 2 else '#f7c6d9', side=PLUM_D)
        pc.ball((math.cos(a) * 0.34, math.sin(a) * 0.34, -0.03), 0.022, PEARL, seg=6, rings=4)
    pc.ball((0, 0.02, 0.01), 0.04, PEARL)
    pc.ball((0, 0.02, 0.04), 0.016, GOLD, glow=True, seg=5, rings=3)  # path pearl
    return pc


# -- Shiro: 0 Execution (a crescent-moon badge on her beret -> a great silver moon behind her with a crosshair),
#           1 Spotter (a spotter drone -> three drones circling high), 2 Follow-up (a twin magazine pack -> a halo of
#           silver bullets behind her head) ----------------------------------------------------------------------

SILVER, SILVER_D, MOON = '#dfe5ee', '#8b95a8', '#f3f6ff'


def shiro_badge(name):
    pc = Piece(name)
    crescent(pc, (0, 0, 0), 0.045, 0.016, SILVER, face=(0, 0.4, 1))
    pc.ball((0.0, -0.008, 0.01), 0.014, PINK, seg=6, rings=4)  # path gem
    star(pc, (0.04, 0.035, 0.0), 0.016, lighten(GOLD, 0.5), face=(0, 0.4, 1), thick=0.006, glow=True)
    return pc


def shiro_moon(name):
    pc = Piece(name)
    crescent(pc, (0, 0, 0), 0.22, 0.05, MOON, face=(0, 0, 1), arc=math.pi * 1.25)
    pc.ring((0, 0, 0.0), 0.3, 0.006, 32, 3, lighten(PINK, 0.4), normal=(0, 0, 1), glow=True)
    for a in (0, math.pi / 2, math.pi, 1.5 * math.pi):
        d = Vector((math.cos(a), math.sin(a), 0))
        pc.cyl(tuple(d * 0.26), tuple(d * 0.34), 0.008, 0.008, 4, lighten(PINK, 0.3), glow=True)
    return pc


def drone(pc, c, r=0.045):
    x, y, z = c
    pc.ball(c, (r, r * 0.55, r), SILVER_D, seg=8, rings=5)
    pc.ball((x, y - r * 0.15, z + r * 0.7), r * 0.32, '#9fe3ff', glow=True, seg=5, rings=3)
    for s in (1, -1):
        pc.cyl((x + s * r * 0.9, y, z), (x + s * r * 1.5, y + r * 0.4, z), r * 0.12, r * 0.12, 4, SILVER_D)
        pc.cyl((x + s * r * 1.5, y + r * 0.4, z), (x + s * r * 1.5, y + r * 0.5, z), r * 0.55, r * 0.55, 8, CYAN)


def shiro_drone(name):
    pc = Piece(name)
    drone(pc, (0, 0, 0), 0.05)
    return pc


def shiro_drones(name):
    pc = Piece(name)
    R = 0.36
    for i in range(3):
        a = TAU * i / 3
        drone(pc, (math.cos(a) * R, 0.02 * i, math.sin(a) * R), 0.04)
    pc.ring((0, 0, 0), R, 0.005, 24, 3, lighten(CYAN, 0.4), glow=True)
    return pc


def bullet(pc, c, d, L, r, body=SILVER, glow=False):
    dn = Vector(d).normalized()
    C = Vector(c)
    pc.cyl(tuple(C), tuple(C + dn * L * 0.6), r, r, 6, GOLD_M)
    pc.cyl(tuple(C + dn * L * 0.6), tuple(C + dn * L), r, 0.0, 6, body, glow=glow, smooth=False)


def shiro_mags(name):
    pc = Piece(name)
    for s in (1, -1):
        pc.body.box(tuple(V(s * 0.035, 0.03, 0)), (0.05, 0.035, 0.2), '#2d3142', taper=0.92)
        pc.body.box(tuple(V(s * 0.035, 0.04, 0.018)), (0.04, 0.004, 0.04), GOLD)  # path label
        for k in range(2):
            bullet(pc, (s * 0.035 + (k - 0.5) * 0.02, 0.13, 0), (0, 1, 0), 0.07, 0.008)
    return pc


def shiro_halo(name):
    pc = Piece(name)
    n = 12
    for i in range(n):
        a = TAU * i / n
        d = (math.cos(a), math.sin(a), 0)
        bullet(pc, (math.cos(a) * 0.17, math.sin(a) * 0.17, 0), d, 0.08, 0.011, glow=(i % 3 == 0))
    pc.ring((0, 0, 0), 0.17, 0.008, 24, 3, lighten(GOLD, 0.45), normal=(0, 0, 1), glow=True)
    return pc


# -- Midori: 0 Toxicology (a glass alembic on her back -> a bubbling cauldron pack with vines), 1 Corrosion (three
#           bubbling test tubes in her hair -> a floating flask with fumes), 2 Field Kit (two potion bottles circling ->
#           five) ------------------------------------------------------------------------------------------------

POTION, POTION_D, GLASS = '#8ef06a', '#3fae4f', '#dff8f0'


def flask(pc, c, r, liquid=POTION, glow=True):
    x, y, z = c
    pc.ball(c, r, GLASS, seg=8, rings=5)
    pc.ball((x, y - r * 0.2, z), r * 0.8, liquid, glow=glow, seg=7, rings=4)
    pc.cyl((x, y + r * 0.8, z), (x, y + r * 1.6, z), r * 0.35, r * 0.35, 6, GLASS)
    pc.cyl((x, y + r * 1.6, z), (x, y + r * 1.85, z), r * 0.42, r * 0.42, 6, '#a0704a')


def midori_alembic(name, big=False):
    pc = Piece(name)
    if big:
        # a round cauldron pack (the bowl faces up, so the camera sees its green brew), vines round it
        pc.cyl((0, -0.06, 0), (0, 0.06, 0), 0.11, 0.13, 12, '#3a3f52', cap_color='#2a2e3c')
        pc.cyl((0, 0.055, 0), (0, 0.065, 0), 0.115, 0.115, 12, POTION, glow=True)
        for i in range(3):
            pc.ball((math.cos(i * 2.1) * 0.05, 0.08 + 0.02 * i, math.sin(i * 2.1) * 0.05), 0.02 + 0.006 * i, lighten(POTION, 0.4), glow=True, seg=5, rings=3)
        pc.ring((0, -0.0, 0), 0.135, 0.01, 16, 3, '#6fcf5e', normal=(0, 1, 0.3))
        flask(pc, (0.12, 0.14, -0.02), 0.045)
        flask(pc, (-0.12, 0.12, -0.02), 0.04, liquid='#c77dff')
    else:
        flask(pc, (0, 0.06, 0), 0.06)
        pc.cyl((0, 0.17, 0), (0.1, 0.22, 0), 0.01, 0.006, 5, GLASS)  # the alembic's arm
        pc.body.box(tuple(V(0, -0.02, 0)), (0.1, 0.05, 0.04), '#6e4429')
    pc.ball((0, -0.02 if not big else -0.06, 0.05), 0.016, PINK)  # path stud
    return pc


def midori_tubes(name):
    pc = Piece(name)
    for i, (x, col) in enumerate(((-0.03, POTION), (0.0, '#ffd166'), (0.03, '#c77dff'))):
        a = (i - 1) * 0.3
        b = (x, 0, 0)
        e = (x + math.sin(a) * 0.12, math.cos(a) * 0.12, -0.03)
        pc.cyl(b, e, 0.014, 0.014, 6, GLASS)
        mid = tuple((b[k] + e[k]) / 2 for k in range(3))
        pc.cyl(b, mid, 0.011, 0.011, 6, col, glow=True)
        pc.ball(tuple(e[k] + (e[k] - b[k]) * 0.1 for k in range(3)), 0.012, lighten(col, 0.4), glow=True, seg=5, rings=3)
    pc.body.box(tuple(V(0, -0.005, 0)), (0.09, 0.02, 0.02), CYAN)  # path clip
    return pc


def midori_fumes(name):
    pc = Piece(name)
    flask(pc, (0, 0, 0), 0.07)
    for i, (x, y, r) in enumerate(((0.0, 0.17, 0.03), (0.03, 0.22, 0.026), (-0.02, 0.26, 0.022))):
        pc.ball((x, y, 0), r, lighten(POTION, 0.45), glow=True, seg=6, rings=4)
    return pc


def midori_bottles(name, n=2):
    pc = Piece(name)
    R = 0.34
    cols = [POTION, '#ffd166', '#c77dff', '#4cc9f0', '#ff8fb1']
    for i in range(n):
        a = TAU * i / n
        flask(pc, (math.cos(a) * R, 0.02 * (i % 2), math.sin(a) * R), 0.04, liquid=cols[i % 5])
    pc.ring((0, -0.04, 0), R, 0.005, 24, 3, lighten(GOLD, 0.4), glow=True)
    return pc


# -- Suzu: 0 Mines (a big bell with a fuse ribbon on her back -> a great bell floating above her), 1 Binding (bell
#          ribbons in her hair -> a ring of little bells), 2 Seals (two paper seals floating by her -> a circle of seals
#          behind her) --------------------------------------------------------------------------------------------

BELL, BELL_D = '#f2c14e', '#b8860b'


def bell(pc, c, r, color=BELL, seg=10, small=False):
    x, y, z = c
    prof = [(r * 0.15, r * 1.0), (r * 0.6, r * 0.75), (r * 1.0, -r * 0.6), (r * 1.05, -r * 0.8)] if small else \
        [(r * 0.15, r * 1.0), (r * 0.55, r * 0.85), (r * 0.7, r * 0.2), (r * 1.0, -r * 0.6), (r * 1.05, -r * 0.8)]
    for i in range(len(prof) - 1):
        (a0, y0), (a1, y1) = prof[i], prof[i + 1]
        pc.cyl((x, y + y0, z), (x, y + y1, z), a0, a1, seg, color, caps=False)
    pc.ball((x, y - r * 0.8, z), (r, r * 0.12, r), darken(color, 0.25), seg=seg, rings=3)
    if not small:
        pc.ball((x, y - r * 0.95, z), r * 0.2, '#5a3a2a', seg=5, rings=3)
        pc.ring((x, y + r * 1.1, z), r * 0.25, r * 0.07, 8, 3, BELL_D, normal=(0, 0, 1))


def suzu_bell(name, big=False):
    pc = Piece(name)
    r = 0.1 if big else 0.07
    bell(pc, (0, 0, 0), r)
    # a red fuse ribbon (pink: path 1) tied round its crown, tails fluttering
    pc.ring((0, r * 0.7, 0), r * 0.62, r * 0.09, 12, 3, PINK, normal=(0, 1, 0))
    for s in (1, -1):
        pc.flat([(0, -0.01), (0.1, -0.014), (0.12, 0), (0.1, 0.014), (0, 0.01)], (s * r * 0.6, r * 0.7, 0), (s, -0.6, -0.3), (0, 0, 1), 0.006, PINK)
    if big:
        pc.ball((0, r * 1.45, 0), 0.02, '#ffd08a', glow=True, seg=5, rings=3)
        pc.ring((0, 0, 0), r * 1.6, 0.006, 24, 3, lighten(BELL, 0.45), normal=(0, 1, 0), glow=True)
    return pc


def suzu_ribbons(name):
    pc = Piece(name)
    for s in (1, -1):
        pc.ball((s * 0.05, 0, 0), (0.04, 0.028, 0.02), '#3f9a96')
        bell(pc, (s * 0.06, -0.06, 0.01), 0.022, seg=6, small=True)
    pc.ball((0, 0, 0.005), 0.018, CYAN)  # path knot
    return pc


def suzu_bell_ring(name):
    pc = Piece(name)
    R = 0.34
    for i in range(8):
        a = TAU * i / 8
        bell(pc, (math.cos(a) * R, 0.0, math.sin(a) * R), 0.032, BELL if i % 2 else lighten(BELL, 0.25), seg=7, small=True)
    pc.ring((0, 0.04, 0), R, 0.007, 24, 3, lighten(CYAN, 0.35), glow=True)
    return pc


def seal(pc, c, face, up=(0, 1, 0), s=1.0, glow=False):
    f = Vector(face).normalized()
    upv = Vector(up)
    right = upv.cross(f).normalized()
    pc.flat([(-0.03 * s, -0.06 * s), (0.03 * s, -0.06 * s), (0.03 * s, 0.06 * s), (-0.03 * s, 0.06 * s)], c, tuple(right), tuple(f.cross(right)), 0.004, '#fffaf0')
    C = Vector(c) + f * 0.004
    pc.flat([(-0.02 * s, -0.035 * s), (0.02 * s, -0.035 * s), (0.02 * s, 0.035 * s), (-0.02 * s, 0.035 * s)], tuple(C), tuple(right), tuple(f.cross(right)), 0.003, '#d0384a', glow=glow)


def suzu_seals(name, big=False):
    pc = Piece(name)
    if big:
        n = 8
        for i in range(n):
            a = TAU * i / n
            seal(pc, (math.cos(a) * 0.2, math.sin(a) * 0.2, 0), (0, 0, 1), up=(math.cos(a), math.sin(a), 0), s=1.2, glow=(i % 2 == 0))
        pc.ring((0, 0, 0), 0.2, 0.006, 24, 3, lighten(GOLD, 0.4), normal=(0, 0, 1), glow=True)
    else:
        seal(pc, (0, 0, 0), (0.3, 0.2, 1), up=(0.2, 1, 0), s=1.3)
        seal(pc, (0.07, -0.05, -0.02), (0.1, 0.2, 1), up=(-0.25, 1, 0), s=1.1)
        pc.ball((0.03, 0.09, 0), 0.014, GOLD, glow=True, seg=5, rings=3)  # path spark
    return pc


# -- Raika: 0 Forked (a lightning-bolt clip between her horns -> six thunder drums ringing high above her), 1 Overcharge
#           (sparks on her horn tips -> a storm drum under a little cloud floating by her), 2 Rhythm (twin drumsticks over
#           her left shoulder -> storm orbs circling). Her staff head rests behind her hair on the right: nothing there. -

STORM, STORM_D = '#ffe066', '#c29a2e'


def bolt(pc, c, h, color=STORM, glow=True, face=(0, 0.3, 1)):
    pts = [(-0.3, 1.0), (0.35, 1.0), (0.05, 0.25), (0.4, 0.25), (-0.35, -1.0), (-0.05, -0.05), (-0.4, -0.05)]
    f = Vector(face).normalized()
    up = Vector((0, 1, 0))
    right = up.cross(f).normalized()
    pc.flat([(x * h * 0.5, y * h * 0.5) for x, y in pts], c, tuple(right), tuple(f.cross(right)), 0.012, color, glow=glow)


def raika_bolt(name):
    pc = Piece(name)
    bolt(pc, (0, 0, 0), 0.12)
    pc.ball((0, -0.01, 0.012), 0.014, PINK, seg=5, rings=3)  # path stud
    return pc


def drum(pc, c, r, d=(0, 0, 1)):
    dn = Vector(d).normalized()
    C = Vector(c)
    pc.cyl(tuple(C - dn * r * 0.6), tuple(C + dn * r * 0.6), r, r, 10, '#c0392b', cap_color='#f6ecd6')
    pc.ring(tuple(C + dn * r * 0.55), r * 1.02, r * 0.08, 12, 3, GOLD_M, normal=tuple(dn))


def raika_drums(name):
    pc = Piece(name)
    n = 6
    for i in range(n):
        a = TAU * i / n
        drum(pc, (math.cos(a) * 0.2, math.sin(a) * 0.2, 0), 0.05, d=(0, 0, 1))
    pc.ring((0, 0, 0), 0.2, 0.01, 24, 3, STORM_D, normal=(0, 0, 1))
    pc.ring((0, 0, 0), 0.27, 0.006, 24, 3, lighten(PINK, 0.4), normal=(0, 0, 1), glow=True)
    bolt(pc, (0, 0, 0.01), 0.1)
    return pc


def raika_sparks(name):
    pc = Piece(name)
    # little sparks at both horn tips (pivot between the horns)
    for s in (1, -1):
        for k in range(3):
            a = k * 2.1
            pc.ball((s * 0.11 + math.cos(a) * 0.025, 0.05 + math.sin(a) * 0.025, 0), 0.024, lighten(STORM, 0.3), glow=True, seg=5, rings=3)
        bolt(pc, (s * 0.14, 0.09, 0), 0.085, face=(s * 0.4, 0.3, 1))
    pc.ball((0, 0, 0.02), 0.014, CYAN, seg=5, rings=3)  # path stud
    return pc


def raika_cloud(name):
    pc = Piece(name)
    for (x, y, r) in ((0, 0.09, 0.05), (0.05, 0.08, 0.04), (-0.05, 0.08, 0.04), (0.02, 0.12, 0.035)):
        pc.ball((x, y, 0), r, '#d6dbe8', seg=7, rings=4)
    drum(pc, (0, -0.02, 0), 0.055, d=(0, 1, 0.25))
    bolt(pc, (0.07, 0.0, 0.02), 0.07)
    return pc


def raika_sticks(name):
    pc = Piece(name)
    for s in (1, -1):
        pc.cyl((s * 0.02, -0.08, 0), (s * 0.06, 0.16, -0.02), 0.01, 0.008, 6, '#c8925f')
        pc.ball((s * 0.062, 0.17, -0.02), 0.018, GOLD, seg=6, rings=4)  # path tips
    pc.ring((0, 0.0, 0), 0.03, 0.008, 10, 3, '#454e7a', normal=(0, 1, 0))
    return pc


def raika_orbs(name):
    pc = Piece(name)
    R = 0.34
    for i in range(3):
        a = TAU * i / 3
        c = (math.cos(a) * R, 0.0, math.sin(a) * R)
        pc.ball(c, 0.04, '#6671a1', seg=8, rings=5)
        bolt(pc, (c[0], c[1], c[2]), 0.05, face=(math.cos(a), 0.3, math.sin(a)))
    pc.ring((0, 0, 0), R, 0.006, 24, 3, lighten(GOLD, 0.4), glow=True)
    return pc


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
    'rei': [
        [lambda: rei_bow('p0_bow'), lambda: rei_petal_ring('p0_petals')],
        [lambda: rei_headband('p1_band'), lambda: rei_headband('p1_bandCrest', crest=True)],
        [lambda: rei_wakizashi('p2_wakizashi'), lambda: rei_spirit_blades('p2_blades')],
    ],
    'yuki': [
        [lambda: yuki_flake('p0_flake'), lambda: yuki_flake('p0_halo', big=True)],
        [lambda: yuki_shards('p1_shards', 2), lambda: yuki_shards('p1_dust', 6, big=True)],
        [lambda: yuki_frost('p2_frost'), lambda: yuki_clock('p2_clock')],
    ],
    'momo': [
        [lambda: momo_peach('p0_peach'), lambda: momo_peach_bank('p0_bank')],
        [lambda: momo_tote('p1_tote'), lambda: momo_ledger('p1_ledger')],
        [lambda: momo_clips('p2_clips'), lambda: momo_coin_ring('p2_coins')],
    ],
    'kage': [
        [lambda: kage_shuriken('p0_shuriken'), lambda: kage_shuriken_ring('p0_ring')],
        [lambda: kage_scarf('p1_scarf'), lambda: kage_scarf('p1_scarfGlow', glow=True), lambda: kage_crescent('p1_crescent')],
        [lambda: kage_kunai_fan('p2_kunai'), lambda: kage_lotus('p2_lotus')],
    ],
    'nami': [
        [lambda: nami_crystals('p0_crystals'), lambda: nami_crystals('p0_spikes', big=True)],
        [lambda: nami_water_ring('p1_ring'), lambda: nami_serpent('p1_serpent')],
        [lambda: nami_anchor('p2_anchor'), lambda: nami_wheel('p2_wheel')],
    ],
    'hikari': [
        [lambda: hikari_sun('p0_medallion'), lambda: hikari_sun('p0_sun', big=True)],
        [lambda: hikari_shields('p1_shield', 1), lambda: hikari_shields('p1_shields', 3)],
        [lambda: hikari_wings('p2_wings'), lambda: hikari_suncrown('p2_crown')],
    ],
    'sango': [
        [lambda: sango_shells('p0_shells'), lambda: sango_anchor('p0_anchor')],
        [lambda: sango_bombs('p1_bombs'), lambda: sango_mortars('p1_mortars')],
        [lambda: sango_spyglass('p2_spyglass'), lambda: sango_spyglass('p2_captain', big=True)],
    ],
    'umeko': [
        [lambda: umeko_lantern('p0_lantern'), lambda: umeko_lanterns('p0_lanterns')],
        [lambda: umeko_crown('p1_crown'), lambda: umeko_wheel('p1_wheel')],
        [lambda: umeko_pearls('p2_pearls'), lambda: umeko_clam('p2_clam')],
    ],
    'shiro': [
        [lambda: shiro_badge('p0_badge'), lambda: shiro_moon('p0_moon')],
        [lambda: shiro_drone('p1_drone'), lambda: shiro_drones('p1_drones')],
        [lambda: shiro_mags('p2_mags'), lambda: shiro_halo('p2_halo')],
    ],
    'midori': [
        [lambda: midori_alembic('p0_alembic'), lambda: midori_alembic('p0_cauldron', big=True)],
        [lambda: midori_tubes('p1_tubes'), lambda: midori_fumes('p1_fumes')],
        [lambda: midori_bottles('p2_bottles', 2), lambda: midori_bottles('p2_bottles5', 5)],
    ],
    'suzu': [
        [lambda: suzu_bell('p0_bell'), lambda: suzu_bell('p0_greatBell', big=True)],
        [lambda: suzu_ribbons('p1_ribbons'), lambda: suzu_bell_ring('p1_bells')],
        [lambda: suzu_seals('p2_seals'), lambda: suzu_seals('p2_sealRing', big=True)],
    ],
    'raika': [
        [lambda: raika_bolt('p0_bolt'), lambda: raika_drums('p0_drums')],
        [lambda: raika_sparks('p1_sparks'), lambda: raika_cloud('p1_cloud')],
        [lambda: raika_sticks('p2_sticks'), lambda: raika_orbs('p2_orbs')],
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
