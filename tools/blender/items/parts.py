"""Parts library for item models: outlines (2D), solids built from them, and the paint step.

Modelling frame: Z up, the front of an item faces -Y (toward the camera before the pose turns it).
Flat outlines live in the XZ plane (x right, z up) and are extruded along Y, front face at -Y.
Every function bakes its transform into the mesh, so objects keep an identity matrix and the
pose step (rig.apply_pose) can transform all parts at once. Parts are collected in ITEM.
"""
import math

import bpy
import bmesh
from mathutils import Vector, Matrix, Euler

import rig

ITEM = dict(parts=[], glints=[])


def reset():
    ITEM['parts'] = []
    ITEM['glints'] = []


def glint(p, size=14.0):
    """A crisp white 4-point star drawn in post at model point p (size = radius in px at 256)."""
    ITEM['glints'].append((Vector(p), float(size)))


# ---------------------------------------------------------------------------
# Object plumbing
# ---------------------------------------------------------------------------

def _obj(bm, name, smooth=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth is not None:
        for p in me.polygons:
            p.use_smooth = smooth
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def xf(o, loc=None, rot=None, scale=None, order='XYZ'):
    """Bakes scale, then rotation (degrees, Euler), then translation into the mesh."""
    m = Matrix.Identity(4)
    if scale is not None:
        s = scale if isinstance(scale, (tuple, list)) else (scale, scale, scale)
        m = Matrix.Diagonal((s[0], s[1], s[2], 1.0)) @ m
    if rot is not None:
        m = Euler([math.radians(a) for a in rot], order).to_matrix().to_4x4() @ m
    if loc is not None:
        m = Matrix.Translation(Vector(loc)) @ m
    o.data.transform(m)
    if scale is not None and isinstance(scale, (tuple, list)) and (scale[0] * scale[1] * scale[2]) < 0:
        o.data.flip_normals()
    o.data.update()
    return o


def matx(o, m):
    o.data.transform(m)
    o.data.update()
    return o


def paint(o, p, **kw):
    """Styles a part with a palette dict (palette.paint / presets) and registers it in the item."""
    q = dict(p)
    q.update(kw)
    rig.style(o, **q)
    ITEM['parts'].append(o)
    return o


def dup(o, name=None):
    me = o.data.copy()
    c = bpy.data.objects.new(name or (o.name + '_d'), me)
    bpy.context.scene.collection.objects.link(c)
    for k in o.keys():
        c[k] = o[k]
    return c


def join(objs, name='joined'):
    objs = [o for o in objs if o is not None]
    bm = bmesh.new()
    for o in objs:
        tmp = bmesh.new()
        tmp.from_mesh(o.data)
        tmp.transform(o.matrix_world)
        me = bpy.data.meshes.new('tmp')
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        bpy.data.objects.remove(o, do_unlink=True)
    return _obj(bm, name)


# ---------------------------------------------------------------------------
# 2D outlines (lists of (x, z), counter-clockwise)
# ---------------------------------------------------------------------------

def circle2(r, n=48, cx=0.0, cz=0.0, a0=0.0, rz=None):
    rz = r if rz is None else rz
    return [(cx + r * math.cos(a0 + 2 * math.pi * i / n), cz + rz * math.sin(a0 + 2 * math.pi * i / n)) for i in range(n)]


def rrect2(w, h, r, n=6, cx=0.0, cz=0.0):
    """Rounded rectangle; r may be one radius or four (tr, tl, bl, br)."""
    rs = r if isinstance(r, (tuple, list)) else (r, r, r, r)
    pts = []
    corners = ((w / 2, h / 2, 0), (-w / 2, h / 2, 90), (-w / 2, -h / 2, 180), (w / 2, -h / 2, 270))
    for (x, z, a), rr in zip(corners, rs):
        rr = min(rr, w / 2, h / 2)
        if rr <= 1e-6:
            pts.append((x, z))
            continue
        ox = x - math.copysign(rr, x)
        oz = z - math.copysign(rr, z)
        for i in range(n + 1):
            t = math.radians(a + 90.0 * i / n)
            pts.append((ox + rr * math.cos(t), oz + rr * math.sin(t)))
    return [(cx + x, cz + z) for x, z in pts]


def blossom2(R, n=200, inner=0.42, notch=0.16, a0=90.0):
    """Five-petal sakura outline: rounded lobes with a small notch at each petal tip."""
    pts = []
    for i in range(n):
        th = 2 * math.pi * i / n
        rel = (math.degrees(th) - a0) % 72.0 - 36.0          # -36..36 around a petal centre
        lobe = math.cos(math.radians(rel) * 2.5)
        lobe = max(0.0, lobe) ** 0.55
        r = R * (inner + (1 - inner) * lobe)
        r -= R * notch * math.exp(-(rel / 5.5) ** 2)
        pts.append((r * math.cos(th), r * math.sin(th)))
    return pts


def star2(points, R, r, a0=90.0, round_tip=0.0, n_round=3):
    pts = []
    for i in range(points * 2):
        a = math.radians(a0 + 180.0 * i / points)
        rr = R if i % 2 == 0 else r
        pts.append((rr * math.cos(a), rr * math.sin(a)))
    return pts


def heart2(w, h, n=96):
    """Heart outline (classic parametric curve), width w, height h, centred."""
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = 16 * math.sin(t) ** 3
        z = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((x, z))
    xs = [p[0] for p in pts]
    zs = [p[1] for p in pts]
    sx = w / (max(xs) - min(xs))
    sz = h / (max(zs) - min(zs))
    cz = (max(zs) + min(zs)) / 2
    return [(x * sx, (z - cz) * sz) for x, z in pts]


def gear2(R, teeth=8, depth=0.18, n_per=10, tooth=0.45, round_=0.35):
    """Gear outline with rounded teeth. depth = tooth height as a fraction of R."""
    pts = []
    N = teeth * n_per
    for i in range(N):
        th = 2 * math.pi * i / N
        ph = (i % n_per) / n_per                  # 0..1 within one tooth period
        d = abs(ph - 0.5) * 2                     # 0 at tooth centre
        if d < tooth:
            k = 1.0
        elif d < tooth + round_ * (1 - tooth):
            k = 0.5 + 0.5 * math.cos(math.pi * (d - tooth) / (round_ * (1 - tooth)))
        else:
            k = 0.0
        r = R * (1 - depth) + R * depth * k
        pts.append((r * math.cos(th), r * math.sin(th)))
    return pts


def crescent2(R, cut=0.72, shift=0.42, n=96):
    """Crescent: a circle of radius R minus a circle of radius cut*R shifted right by shift*R (opening right)."""
    rc, sx = cut * R, shift * R
    xi = (R * R - rc * rc + sx * sx) / (2 * sx)
    zi = math.sqrt(max(1e-9, R * R - xi * xi))
    ti = math.atan2(zi, xi)
    fi = math.atan2(zi, xi - sx)
    m = n // 2
    outer = [(R * math.cos(ti + (2 * math.pi - 2 * ti) * i / m), R * math.sin(ti + (2 * math.pi - 2 * ti) * i / m))
             for i in range(m + 1)]
    inner = [(sx + rc * math.cos((2 * math.pi - fi) - (2 * math.pi - 2 * fi) * i / m),
              rc * math.sin((2 * math.pi - fi) - (2 * math.pi - 2 * fi) * i / m)) for i in range(1, m)]
    return outer + inner


def flame2(w, h, n=80, tips=3, wob=0.12):
    """Flame / teardrop outline: round bottom, wavy pointed top."""
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = math.sin(t)
        z = -math.cos(t)
        # pull the top into a point
        k = (z + 1) / 2
        x *= (1 - k ** 1.6) * (1 + wob * math.sin(tips * 2 * t) * k)
        pts.append((x * w / 2, (z * 0.5 + 0.5) * h - h * 0.35 + (h * 0.35 * k ** 3)))
    return pts


def leaf2(w, h, n=60, asym=0.0, tip_sharp=1.3):
    """Leaf / feather vane outline along +Z, from (0,0) to (0,h). asym widens the right side."""
    left, right = [], []
    for i in range(n + 1):
        u = i / n
        wid = math.sin(math.pi * u ** 0.85) ** (1 / tip_sharp) * w / 2
        right.append((wid * (1 + asym), u * h))
        left.append((-wid * (1 - asym), u * h))
    return right + list(reversed(left[1:-1]))


def helix(r, h, turns, n=120, z0=0.0):
    return [(r * math.cos(2 * math.pi * turns * i / n), r * math.sin(2 * math.pi * turns * i / n), z0 + h * i / n) for i in range(n + 1)]


def spiral2(r0, r1, turns, n=160):
    return [((r0 + (r1 - r0) * i / n) * math.cos(2 * math.pi * turns * i / n), 0.0,
             (r0 + (r1 - r0) * i / n) * math.sin(2 * math.pi * turns * i / n)) for i in range(n + 1)]


def lump(r, seed=1, amp=0.12, segs=24, rings=12, name='lump', scale=None):
    """A soft rounded rock: a UV sphere with smooth low-frequency bumps (deterministic)."""
    import random
    rnd = random.Random(seed)
    waves = [(Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))).normalized(), rnd.uniform(1.5, 3.0),
              rnd.uniform(0, 6.28)) for _ in range(5)]
    o = sphere(r, segs, rings, name)
    for v in o.data.vertices:
        d = v.co.normalized()
        k = 1.0 + sum(amp / len(waves) * 2 * math.sin(f * d.dot(w) * 3.0 + ph) for w, f, ph in waves)
        v.co = d * r * k
    o.data.update()
    if scale:
        xf(o, scale=scale)
    return o


def notch_outline(pts, centers, radius):
    """Pulls outline points inside the given circles onto their rims (ticket notches)."""
    out = []
    for x, z in pts:
        for cx, cz in centers:
            dx, dz = x - cx, z - cz
            d = math.hypot(dx, dz)
            if d < radius:
                if d < 1e-9:
                    dx, dz, d = 1.0, 0.0, 1.0
                x, z = cx + dx / d * radius, cz + dz / d * radius
        out.append((x, z))
    return out


def resample(pts, n):
    """Even resampling of a closed outline to n points."""
    segs = []
    tot = 0.0
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        l = math.hypot(b[0] - a[0], b[1] - a[1])
        segs.append((a, b, l))
        tot += l
    out = []
    step = tot / n
    acc = 0.0
    k = 0
    for i in range(n):
        target = i * step
        while k < len(segs) - 1 and acc + segs[k][2] < target:
            acc += segs[k][2]
            k += 1
        a, b, l = segs[k]
        t = 0.0 if l < 1e-12 else (target - acc) / l
        out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out


def poly_round(pts, r, n=4):
    """Rounds every corner of a polygon outline by radius r (fillet with n points)."""
    out = []
    m = len(pts)
    for i in range(m):
        p0 = Vector(pts[i - 1])
        p1 = Vector(pts[i])
        p2 = Vector(pts[(i + 1) % m])
        a = (p0 - p1)
        b = (p2 - p1)
        la, lb = a.length, b.length
        if la < 1e-9 or lb < 1e-9:
            out.append(tuple(p1))
            continue
        a /= la
        b /= lb
        cosang = max(-1.0, min(1.0, a.dot(b)))
        ang = math.acos(cosang)
        if ang > math.radians(175):
            out.append(tuple(p1))
            continue
        t = min(r / math.tan(ang / 2), la * 0.45, lb * 0.45)
        s = p1 + a * t
        e = p1 + b * t
        for k in range(n + 1):
            u = k / n
            q = (1 - u) ** 2 * s + 2 * u * (1 - u) * p1 + u ** 2 * e
            out.append((q.x, q.y))
    return out


# ---------------------------------------------------------------------------
# Solids
# ---------------------------------------------------------------------------

def slab(outline, depth, bevel=0.0, seg=3, name='slab', back_bevel=None, profile=0.5):
    """Extrudes an XZ outline along Y (front face at y = -depth/2), with rounded rim edges.
    Cap faces stay flat-shaded, the rim and the bevel are smooth."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, depth / 2, z)) for x, z in outline]
    f = bm.faces.new(vs)
    ret = bmesh.ops.extrude_face_region(bm, geom=[f])
    nv = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)]
    for v in nv:
        v.co.y -= depth
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    caps = [fc for fc in bm.faces if abs(fc.normal.y) > 0.9]
    for fc in bm.faces:
        fc.smooth = fc not in caps
    if bevel > 0:
        edges = []
        for e in bm.edges:
            lf = e.link_faces
            if len(lf) == 2 and ((lf[0] in caps) != (lf[1] in caps)):
                if back_bevel is None or back_bevel or e.verts[0].co.y < 0:
                    edges.append(e)
        res = bmesh.ops.bevel(bm, geom=edges, offset=bevel, offset_type='OFFSET', segments=seg, profile=profile,
                              affect='EDGES', clamp_overlap=True)
        for fc in res['faces']:
            fc.smooth = True
    return _obj(bm, name)


def rbox(sx, sy, sz, r=0.0, seg=3, name='box'):
    """Box (centred) with rounded edges; flat faces, smooth bevels."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    for fc in bm.faces:
        fc.smooth = False
    if r > 0:
        res = bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=r, offset_type='OFFSET', segments=seg,
                              profile=0.5, affect='EDGES', clamp_overlap=True)
        for fc in res['faces']:
            fc.smooth = True
    return _obj(bm, name)


def lathe(profile, segs=48, name='lathe', smooth=True, axis='Z', a0=0.0):
    """Revolves profile [(r, h)] or [(r, h, 'S')] around Z (or 'Y': h along -Y, toward the viewer).
    r = 0 collapses to a pole; 'S' makes a hard edge at that profile point (split ring)."""
    bm = bmesh.new()
    rings = []
    pairs = []
    for pt in profile:
        r, h = pt[0], pt[1]
        sharp = len(pt) > 2 and pt[2] == 'S'
        for rep in range(2 if sharp else 1):
            if r < 1e-7:
                ring = [bm.verts.new((0, 0, h))]
            else:
                ring = [bm.verts.new((r * math.cos(a0 + 2 * math.pi * k / segs), r * math.sin(a0 + 2 * math.pi * k / segs), h))
                        for k in range(segs)]
            rings.append(ring)
            if rep == 1:
                pairs.append(len(rings) - 2)
    skip = set(pairs)
    for i, (a, b) in enumerate(zip(rings, rings[1:])):
        if i in skip:
            continue
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            for k in range(segs):
                bm.faces.new((a[0], b[k], b[(k + 1) % segs]))
        elif len(b) == 1:
            for k in range(segs):
                bm.faces.new((a[k], a[(k + 1) % segs], b[0]))
        else:
            for k in range(segs):
                bm.faces.new((a[k], a[(k + 1) % segs], b[(k + 1) % segs], b[k]))
    if len(rings[0]) > 1:
        bm.faces.new(list(reversed(rings[0])))
    if len(rings[-1]) > 1:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for fc in bm.faces:
        fc.smooth = smooth
    if smooth:
        for fc in bm.faces:
            if len(fc.verts) > 4:
                fc.smooth = False
    o = _obj(bm, name)
    if axis == 'Y':
        xf(o, rot=(90, 0, 0))
    return o


def disc(r, depth, bevel=0.0, seg=3, n=64, name='disc'):
    return slab(circle2(r, n), depth, bevel, seg, name)


def sweep(path, profile, scales=None, closed=False, cap=True, up=(0, 0, 1), name='sweep', smooth=True):
    """Sweeps a 2D profile [(u, v)] along a 3D path. scales: per-point factor or (su, sv)."""
    pts = [Vector(p) for p in path]
    n = len(pts)
    tans = []
    for i in range(n):
        if closed:
            t = pts[(i + 1) % n] - pts[i - 1]
        elif i == 0:
            t = pts[1] - pts[0]
        elif i == n - 1:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        tans.append(t.normalized())
    ref = Vector(up)
    if abs(ref.dot(tans[0])) > 0.95:
        ref = Vector((1, 0, 0)) if abs(tans[0].x) < 0.9 else Vector((0, 1, 0))
    nrm = (ref - tans[0] * ref.dot(tans[0])).normalized()
    bm = bmesh.new()
    rings = []
    for i in range(n):
        t = tans[i]
        nrm = (nrm - t * nrm.dot(t))
        if nrm.length < 1e-6:
            nrm = Vector((0, 0, 1))
        nrm.normalize()
        bn = t.cross(nrm).normalized()
        sc = 1.0 if scales is None else scales[i]
        su, sv = (sc, sc) if not isinstance(sc, (tuple, list)) else sc
        rings.append([bm.verts.new(pts[i] + bn * (u * su) + nrm * (v * sv)) for u, v in profile])
    m = len(profile)
    links = list(zip(rings, rings[1:])) + ([(rings[-1], rings[0])] if closed else [])
    for a, b in links:
        for k in range(m):
            bm.faces.new((a[k], a[(k + 1) % m], b[(k + 1) % m], b[k]))
    if cap and not closed:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for fc in bm.faces:
        fc.smooth = smooth and len(fc.verts) == 4
    return _obj(bm, name)


def tube(path, r, n=12, **kw):
    return sweep(path, circle2(r, n), **kw)


def torus(R, r, n=48, m=12, name='torus'):
    path = [(R * math.cos(2 * math.pi * i / n), R * math.sin(2 * math.pi * i / n), 0) for i in range(n)]
    return sweep(path, circle2(r, m), closed=True, name=name)


def sphere(r, segs=32, rings=16, name='sphere', scale=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
    for fc in bm.faces:
        fc.smooth = True
    o = _obj(bm, name)
    if scale:
        xf(o, scale=scale)
    return o


def crystal(r, h, tip, sides=6, name='crystal', base=0.0, taper=1.0, a0=0.0):
    """Faceted prism with a pointed top: flat shading, facet values come from the toon steps."""
    prof = [(0.0, -base), (r * taper, 0.0), (r, h), (0.0, h + tip)] if base > 0 else [(r * taper, 0.0), (r, h), (0.0, h + tip)]
    return lathe(prof, segs=sides, name=name, smooth=False, a0=a0)


def gem(r, sides=8, crown=0.32, table=0.55, pavilion=0.75, name='gem'):
    """Brilliant-style cut gem, table facing +Z (rotate to face the viewer)."""
    prof = [(0.0, -pavilion * r), (r, 0.0), (r * 0.98, 0.06 * r), (r * table, crown * r), (0.0, crown * r)]
    return lathe(prof, segs=sides, name=name, smooth=False, a0=math.pi / sides)


def cabochon(r, h, n=40, name='cab'):
    prof = [(r, 0.0)] + [(r * math.cos(a), h * math.sin(a)) for a in [math.radians(x) for x in range(15, 90, 15)]] + [(0.0, h)]
    return lathe(prof, segs=n, name=name, smooth=True)


def fan_gem(outline, depth, rise, name='fangem', ridges=None, center=(0.0, 0.0), spine=None):
    """Faceted gem from an XZ outline: flat back at y = +depth, sides, and a front made of flat
    triangles fanning up to a raised point (y = -rise). ridges = [(x, z, rise)] adds raised ridge points
    (each outline edge fans to the nearest ridge point), for petal and star facets."""
    bm = bmesh.new()
    front = [bm.verts.new((x, 0.0, z)) for x, z in outline]
    back = [bm.verts.new((x, depth, z)) for x, z in outline]
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[i], front[j], back[j], back[i]))
    bm.faces.new(list(reversed(back)))
    if spine:
        # a raised ridge line: every outline edge fans to its nearest spine vertex, consecutive spine
        # vertices are bridged at the outline vertex where ownership moves on (no folds, no centre)
        sv = [bm.verts.new((x, -r, z)) for x, z, r in spine]

        def own(p):
            return min(range(len(spine)), key=lambda k: (p[0] - spine[k][0]) ** 2 + (p[1] - spine[k][1]) ** 2)
        owner = [own(((outline[i][0] + outline[(i + 1) % n][0]) / 2, (outline[i][1] + outline[(i + 1) % n][1]) / 2))
                 for i in range(n)]
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((sv[owner[i]], front[i], front[j]))
            a, b = owner[i], owner[j]
            step = 1 if b > a else -1
            while a != b:
                bm.faces.new((sv[a], front[j], sv[a + step]))
                a += step
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        for fc in bm.faces:
            fc.smooth = False
        return _obj(bm, name)
    c = bm.verts.new((center[0], -rise, center[1]))
    if not ridges:
        for i in range(n):
            bm.faces.new((c, front[i], front[(i + 1) % n]))
    else:
        rv = [bm.verts.new((x, -r, z)) for x, z, r in ridges]

        def nearest(p):
            best, bi = 1e9, 0
            for k, (x, z, _) in enumerate(ridges):
                d = (p[0] - x) ** 2 + (p[1] - z) ** 2
                if d < best:
                    best, bi = d, k
            return bi
        owner = []
        for i in range(n):
            j = (i + 1) % n
            mid = ((outline[i][0] + outline[j][0]) / 2, (outline[i][1] + outline[j][1]) / 2)
            owner.append(nearest(mid))
        for i in range(n):
            j = (i + 1) % n
            k = owner[i]
            bm.faces.new((rv[k], front[i], front[j]))
            if owner[j] != k:
                bm.faces.new((c, rv[k], front[j]))
                bm.faces.new((c, front[j], rv[owner[j]]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for fc in bm.faces:
        fc.smooth = False
    return _obj(bm, name)


def ring_along(outline, r, n=10, name='ring', scale_depth=1.0):
    """A round rod following a closed XZ outline (frames, rims)."""
    path = [(x, 0.0, z) for x, z in outline]
    o = sweep(path, circle2(r, n), closed=True, up=(0, -1, 0), name=name)
    if scale_depth != 1.0:
        xf(o, scale=(1, scale_depth, 1))
    return o


def offset_outline(pts, d):
    """Offsets a closed outline outward by d (miter-free: averaged edge normals)."""
    m = len(pts)
    area = sum(pts[i][0] * pts[(i + 1) % m][1] - pts[(i + 1) % m][0] * pts[i][1] for i in range(m))
    sgn = 1.0 if area > 0 else -1.0
    out = []
    for i in range(m):
        p0, p1, p2 = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % m])
        e1 = (p1 - p0).normalized()
        e2 = (p2 - p1).normalized()
        n1 = Vector((e1.y, -e1.x)) * sgn
        n2 = Vector((e2.y, -e2.x)) * sgn
        nn = (n1 + n2)
        nn = nn.normalized() if nn.length > 1e-9 else n1
        out.append((p1.x + nn.x * d, p1.y + nn.y * d))
    return out


def smooth_path(ctrl, count=24):
    """Catmull-Rom spline through 3D control points."""
    ctrl = [Vector(c) for c in ctrl]
    if len(ctrl) < 3:
        return ctrl
    segs = len(ctrl) - 1
    pts = []
    for i in range(count):
        t = i / (count - 1) * segs
        k = min(int(t), segs - 1)
        f = t - k
        p0, p1, p2, p3 = ctrl[max(0, k - 1)], ctrl[k], ctrl[k + 1], ctrl[min(segs, k + 2)]
        pts.append(0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f ** 3))
    return pts


def bend(o, axis_from='X', amount=0.0, along='Z'):
    """Bends a mesh: displaces `along` by amount * x^2 (a gentle curl for feathers and ribbons)."""
    for v in o.data.vertices:
        x = getattr(v.co, axis_from.lower())
        setattr(v.co, along.lower(), getattr(v.co, along.lower()) + amount * x * x)
    o.data.update()
    return o


def bounds(o):
    xs = [v.co.x for v in o.data.vertices]
    ys = [v.co.y for v in o.data.vertices]
    zs = [v.co.z for v in o.data.vertices]
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))
