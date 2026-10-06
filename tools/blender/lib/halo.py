"""Floating halos per look.halo (emissive 'halo' material, bone 'halo')."""
import math
from mathutils import Vector

from . import mesh as M


HALO_SCALE = 1.35


def build(ctx):
    kind = ctx['look'].get('halo', 'ring')
    P = ctx['P']
    c = Vector((0, 0.0, 0.0))
    col = ctx['pal']['halo']
    fn = HALOS.get(kind, ring)
    parts = fn(c, col, ctx)
    from mathutils import Matrix
    # scale up around the origin, tilt slightly towards the viewer, then lift over the head
    xf = Matrix.Translation((0, 0.01, P['halo_z'] + ctx.get('halo_lift', 0.0))) @ Matrix.Rotation(math.radians(-14), 4, 'X') @ Matrix.Diagonal((HALO_SCALE, HALO_SCALE, HALO_SCALE, 1))
    for p in parts:
        p['material'] = 'halo'
        p.data.transform(xf)
        p.data.update()
    ctx['parts'] += parts
    return parts


def _ring(c, r, tube_r, col, segments=16, squash=0.5):
    pts = []
    for i in range(segments + 1):
        a = i / segments * math.pi * 2
        pts.append(c + Vector((math.cos(a) * r, math.sin(a) * r * 0.75, 0)))
    v, f, rr = M.tube(pts, (tube_r, tube_r * squash), sides=6, cap_start=False, cap_end=False, up=Vector((0, 0, 1)))
    # weld the ring closed: merge first and last rings by replacing indices
    o = M.new_object('halo_ring', v, f, color=col, bone='halo')
    _weld(o, rr[0], rr[-1])
    M.finish(o, levels=1)
    return o


def _weld(obj, ring_a, ring_b):
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    pairs = []
    for a, b in zip(ring_a, ring_b):
        pairs.append((bm.verts[a], bm.verts[b]))
    bmesh.ops.weld_verts(bm, targetmap={b: a for a, b in pairs})
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def _plate(c, pts, thick, col, name='halo_plate'):
    v, f = M.plate(pts, thick, center=(c.x, c.y, c.z), plane='xy')
    o = M.new_object(name, v, f, color=col, bone='halo')
    n = len(pts)
    M.crease(o, [(i, (i + 1) % n) for i in range(n)] + [(n + i, n + (i + 1) % n) for i in range(n)], 1.0)
    M.finish(o, levels=1)
    return o


def _star_pts(n, r_out, r_in, rot=math.pi / 2):
    pts = []
    for i in range(n * 2):
        a = i / (n * 2) * math.pi * 2 + rot
        rr = r_out if i % 2 == 0 else r_in
        pts.append((math.cos(a) * rr, math.sin(a) * rr))
    return pts


def ring(c, col, ctx):
    return [_ring(c, 0.085, 0.011, col)]


def star(c, col, ctx):
    return [_plate(c, _star_pts(5, 0.07, 0.034), 0.014, col), _ring(c, 0.1, 0.006, col)]


def petal(c, col, ctx):
    parts = [_ring(c, 0.075, 0.008, col)]
    for i in range(5):
        a = i / 5 * math.pi * 2
        p = c + Vector((math.cos(a) * 0.085, math.sin(a) * 0.065, 0))
        v, f = M.sphere(p, (0.022, 0.016, 0.009))
        o = M.new_object('petal', v, f, color=col, bone='halo')
        M.finish(o, levels=1)
        parts.append(o)
    return parts


def gear(c, col, ctx):
    pts = []
    n = 8
    for i in range(n * 4):
        a = i / (n * 4) * math.pi * 2
        k = i % 4
        rr = 0.08 if k in (0, 1) else 0.062
        pts.append((math.cos(a) * rr, math.sin(a) * rr * 0.85))
    o = _plate(c, pts, 0.014, col, name='gear')
    hole = _ring(c, 0.03, 0.006, col)
    return [o, hole]


def moon(c, col, ctx):
    pts = []
    n = 14
    for i in range(n + 1):
        a = -math.pi * 0.3 + i / n * math.pi * 1.6
        pts.append((math.cos(a) * 0.085, math.sin(a) * 0.085))
    for i in range(n, -1, -1):
        a = -math.pi * 0.3 + i / n * math.pi * 1.6
        pts.append((math.cos(a) * 0.055 + 0.028, math.sin(a) * 0.058))
    return [_plate(c, pts, 0.014, col, name='moon')]


def flame(c, col, ctx):
    parts = [_ring(c, 0.075, 0.009, col)]
    for i in range(6):
        a = i / 6 * math.pi * 2
        p = c + Vector((math.cos(a) * 0.075, math.sin(a) * 0.058, 0))
        pts = [p - Vector((0, 0, 0.005)), p + Vector((math.cos(a) * 0.01, math.sin(a) * 0.01, 0.022)), p + Vector((math.cos(a) * 0.025, math.sin(a) * 0.02, 0.05))]
        v, f, r = M.tube(pts, [0.012, 0.009, 0.001], sides=5, tip_end=True)
        o = M.new_object('flame', v, f, color=col, bone='halo')
        M.crease(o, M.tip_edges(r), 1.0)
        M.finish(o, levels=1)
        parts.append(o)
    return parts


def wave(c, col, ctx):
    pts = []
    segments = 24
    for i in range(segments + 1):
        a = i / segments * math.pi * 2
        pts.append(c + Vector((math.cos(a) * 0.085, math.sin(a) * 0.065, math.sin(a * 3) * 0.012)))
    v, f, rr = M.tube(pts, (0.012, 0.007), sides=6, cap_start=False, cap_end=False, up=Vector((0, 0, 1)))
    o = M.new_object('wave', v, f, color=col, bone='halo')
    _weld(o, rr[0], rr[-1])
    M.finish(o, levels=1)
    return [o]


def crown(c, col, ctx):
    parts = [_ring(c, 0.08, 0.012, col)]
    for i in range(6):
        a = i / 6 * math.pi * 2
        p = c + Vector((math.cos(a) * 0.08, math.sin(a) * 0.06, 0.005))
        v, f, r = M.tube([p, p + Vector((0, 0, 0.02)), p + Vector((0, 0, 0.04))], [0.011, 0.008, 0.001], sides=5, tip_end=True)
        o = M.new_object('crownpt', v, f, color=col, bone='halo')
        M.crease(o, M.tip_edges(r), 1.0)
        M.finish(o, levels=1)
        parts.append(o)
    return parts


def snow(c, col, ctx):
    parts = [_ring(c, 0.035, 0.007, col)]
    for i in range(6):
        a = i / 6 * math.pi * 2
        d = Vector((math.cos(a), math.sin(a) * 0.8, 0))
        v, f, r = M.tube([c + d * 0.02, c + d * 0.1], (0.009, 0.006), sides=4)
        o = M.new_object('snowarm', v, f, color=col, bone='halo')
        M.finish(o, levels=1)
        parts.append(o)
        for s in (1, -1):
            p = c + d * 0.07
            q = p + Vector((math.cos(a + s * 1.0) * 0.03, math.sin(a + s * 1.0) * 0.025, 0))
            v, f, r = M.tube([p, q], (0.006, 0.004), sides=4)
            b = M.new_object('snowbranch', v, f, color=col, bone='halo')
            M.finish(b, levels=1)
            parts.append(b)
    return parts


def bolt(c, col, ctx):
    pts = [(-0.02, 0.09), (0.03, 0.09), (0.0, 0.03), (0.04, 0.03), (-0.03, -0.09), (-0.005, -0.015), (-0.045, -0.015)]
    pts = [(x * 0.9, y * 0.8) for x, y in pts]
    return [_plate(c, pts, 0.014, col, name='bolt'), _ring(c, 0.1, 0.006, col)]


def leaf(c, col, ctx):
    parts = [_ring(c, 0.07, 0.009, col)]
    for i in range(6):
        a = i / 6 * math.pi * 2
        p = c + Vector((math.cos(a) * 0.08, math.sin(a) * 0.062, 0))
        d = Vector((math.cos(a), math.sin(a) * 0.8, 0))
        pts = [p - d * 0.02, p, p + d * 0.03, p + d * 0.055]
        v, f, r = M.tube(pts, [(0.004, 0.003), (0.02, 0.006), (0.016, 0.005), (0.001, 0.001)], sides=6, tip_end=True, up=Vector((0, 0, 1)))
        o = M.new_object('leaf', v, f, color=col, bone='halo')
        M.crease(o, M.tip_edges(r), 1.0)
        M.finish(o, levels=1)
        parts.append(o)
    return parts


def eye(c, col, ctx):
    pts = []
    n = 12
    for i in range(n):
        a = i / n * math.pi * 2
        pts.append((math.cos(a) * 0.09, math.sin(a) * 0.045))
    o = _plate(c, pts, 0.012, col, name='eye')
    v, f = M.sphere(c, (0.028, 0.028, 0.02))
    iris = M.new_object('eyeiris', v, f, color=col, bone='halo')
    M.finish(iris, levels=1)
    return [o, iris]


HALOS = dict(ring=ring, star=star, petal=petal, gear=gear, moon=moon, flame=flame, wave=wave, crown=crown, snow=snow, bolt=bolt, leaf=leaf, eye=eye)
