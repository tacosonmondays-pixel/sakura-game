"""Cage primitives, subdivision, creases, vertex colours and bone weights.

A *cage* is a tiny quad mesh (a handful of vertices). `finish()` applies a Catmull-Clark
subdivision (default 2 levels), which turns boxes into spheres and tubes into soft clumps.
Creased edges stay sharp (pointed hair tips, blade edges). Every part remembers which bone
it belongs to through its vertex groups, so weights survive joining the parts into one mesh.
"""
import math
import bpy
import bmesh
from mathutils import Vector, Matrix, Quaternion

from .colors import linear

COLOR_ATTR = 'Col'
_counter = [0]


def _name(prefix):
    _counter[0] += 1
    return f'{prefix}_{_counter[0]:03d}'


def V(x, y=None, z=None):
    if y is None:
        return Vector(x)
    return Vector((x, y, z))


# ---------------------------------------------------------------------------
# Object creation
# ---------------------------------------------------------------------------

def new_object(name, verts, faces, color='#ffffff', bone=None, smooth=True, collection=None):
    """Creates a mesh object from vertex/face lists with a flat vertex colour and bone group."""
    me = bpy.data.meshes.new(_name(name))
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.validate(verbose=False)
    me.update()
    for p in me.polygons:
        p.use_smooth = smooth
    obj = bpy.data.objects.new(me.name, me)
    (collection or bpy.context.scene.collection).objects.link(obj)
    set_color(obj, color)
    obj['part'] = name
    if bone:
        set_bone(obj, bone)
    return obj


def set_color(obj, color, fn=None):
    """Flat colour (hex) or per-vertex callback fn(co) -> hex / (r,g,b)."""
    me = obj.data
    attr = me.color_attributes.get(COLOR_ATTR) or me.color_attributes.new(COLOR_ATTR, 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = me.color_attributes.find(COLOR_ATTR)
    base = linear(color)
    for i, v in enumerate(me.vertices):
        c = base if fn is None else linear(fn(v.co))
        attr.data[i].color = (c[0], c[1], c[2], 1.0)


def set_bone(obj, bone, weight=1.0, verts=None):
    """Assigns vertices (all by default) to a bone's vertex group."""
    vg = obj.vertex_groups.get(bone) or obj.vertex_groups.new(name=bone)
    ids = list(range(len(obj.data.vertices))) if verts is None else list(verts)
    vg.add(ids, weight, 'REPLACE')
    return vg


def weight_by_bones(obj, bones, blend=0.03):
    """Smooth weights from bone segments: bones = [(name, head(Vector), tail(Vector))].
    Each vertex is weighted by its closest two bone segments with a soft blend band so
    joints bend without creasing. Replaces any existing groups on the object."""
    for vg in list(obj.vertex_groups):
        obj.vertex_groups.remove(vg)
    groups = {b[0]: obj.vertex_groups.new(name=b[0]) for b in bones}
    for v in obj.data.vertices:
        co = obj.matrix_world @ v.co
        dists = []
        for name, head, tail in bones:
            d = _seg_dist(co, Vector(head), Vector(tail))
            dists.append((d, name))
        dists.sort()
        d0, n0 = dists[0]
        if len(dists) > 1:
            d1, n1 = dists[1]
            t = (d1 - d0) / max(blend, 1e-6)
            t = max(0.0, min(1.0, t))
            w0 = 0.5 + 0.5 * t
            groups[n0].add([v.index], w0, 'REPLACE')
            if w0 < 0.999:
                groups[n1].add([v.index], 1.0 - w0, 'REPLACE')
        else:
            groups[n0].add([v.index], 1.0, 'REPLACE')


def _seg_dist(p, a, b):
    ab = b - a
    l2 = ab.length_squared
    if l2 < 1e-12:
        return (p - a).length
    t = max(0.0, min(1.0, (p - a).dot(ab) / l2))
    return (p - (a + ab * t)).length


# ---------------------------------------------------------------------------
# Modifiers
# ---------------------------------------------------------------------------

def crease(obj, pairs, weight=1.0):
    """Marks edges (by vertex index pairs) as creased so subsurf keeps them sharp."""
    me = obj.data
    attr = me.attributes.get('crease_edge') or me.attributes.new('crease_edge', 'FLOAT', 'EDGE')
    lookup = {}
    for e in me.edges:
        a, b = e.vertices
        lookup[(a, b)] = e.index
        lookup[(b, a)] = e.index
    for a, b in pairs:
        idx = lookup.get((a, b))
        if idx is not None:
            attr.data[idx].value = weight


def crease_ring(obj, ring, weight=1.0):
    """Creases the loop of edges connecting consecutive vertices of `ring` (closed)."""
    pairs = [(ring[i], ring[(i + 1) % len(ring)]) for i in range(len(ring))]
    crease(obj, pairs, weight)


LEVEL_DROP = [0]  # LOD builds subtract this from every requested subdivision level


def finish(obj, levels=2, solidify=0.0, mirror=False, shrink=0.0, min_levels=0):
    """Applies subsurf (+ optional mirror / solidify) and bakes the result into the mesh."""
    levels = max(min_levels, levels - LEVEL_DROP[0])
    if mirror:
        m = obj.modifiers.new('mirror', 'MIRROR')
        m.use_axis[0] = True
        m.use_clip = True
        m.merge_threshold = 0.0005
    if levels > 0:
        s = obj.modifiers.new('subsurf', 'SUBSURF')
        s.levels = levels
        s.render_levels = levels
        s.use_creases = True
        s.boundary_smooth = 'ALL'
        s.uv_smooth = 'PRESERVE_BOUNDARIES'
    if solidify:
        so = obj.modifiers.new('solidify', 'SOLIDIFY')
        so.thickness = solidify
        so.offset = -1.0
        so.use_rim = True
        so.use_even_offset = True
    if shrink:
        d = obj.modifiers.new('displace', 'DISPLACE')
        d.strength = -shrink
        d.mid_level = 0.0
    apply_modifiers(obj)
    return obj


def apply_modifiers(obj):
    """Replaces the object's mesh by its evaluated (modifier-applied) copy."""
    if not obj.modifiers:
        return obj
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    old = obj.data
    obj.modifiers.clear()
    obj.data = me
    me.name = old.name
    bpy.data.meshes.remove(old)
    for p in me.polygons:
        p.use_smooth = True
    return obj


def transform(obj, loc=None, rot=None, scale=None, matrix=None):
    """Bakes a transform into the mesh data (so joins are trivial)."""
    m = Matrix.Identity(4)
    if matrix is not None:
        m = matrix @ m
    if scale is not None:
        s = scale if isinstance(scale, (tuple, list, Vector)) else (scale, scale, scale)
        m = m @ Matrix.Diagonal((s[0], s[1], s[2], 1.0))
    if rot is not None:
        m = Matrix.Translation((0, 0, 0)) @ rot.to_matrix().to_4x4() @ m if isinstance(rot, Quaternion) else rot.to_4x4() @ m
    if loc is not None:
        m = Matrix.Translation(Vector(loc)) @ m
    obj.data.transform(m)
    obj.data.update()
    return obj


def join(objects, name='joined'):
    """Joins objects into one (keeps vertex groups + colours). Returns the joined object."""
    objects = [o for o in objects if o is not None]
    if not objects:
        return None
    target = objects[0]
    if len(objects) == 1:
        return target
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = target
    with bpy.context.temp_override(active_object=target, selected_editable_objects=objects, selected_objects=objects):
        bpy.ops.object.join()
    for o in bpy.context.selected_objects:
        o.select_set(False)
    target.name = name
    return target


def bounds(obj):
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    zs = [v.co.z for v in obj.data.vertices]
    return (Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs))))


# ---------------------------------------------------------------------------
# Cage primitives (all return (verts, faces); build with new_object)
# ---------------------------------------------------------------------------

# Catmull-Clark pulls the limit surface inside its cage; these factors pre-inflate cages so
# that the subdivided result has the requested size (measured for 2 levels).
INFLATE_BOX = 1.0 / 0.84
INFLATE_TUBE = 1.0 / 0.90
INFLATE_SPHERE = 1.0 / 0.823


def box(center, size, inflate=True):
    """8-vertex box cage. Subsurf turns it into a rounded blob/sphere of ~`size`."""
    cx, cy, cz = center
    sx, sy, sz = [s * 0.5 * (INFLATE_BOX if inflate else 1.0) for s in size]
    verts = [(cx - sx, cy - sy, cz - sz), (cx + sx, cy - sy, cz - sz), (cx + sx, cy + sy, cz - sz), (cx - sx, cy + sy, cz - sz),
             (cx - sx, cy - sy, cz + sz), (cx + sx, cy - sy, cz + sz), (cx + sx, cy + sy, cz + sz), (cx - sx, cy + sy, cz + sz)]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return verts, faces


def sphere(center, radii, inflate=INFLATE_SPHERE):
    """26-vertex rounded-cube cage projected onto an ellipsoid: subdivides to a very round
    ellipsoid of the given radii (rx, ry, rz)."""
    cx, cy, cz = center
    r = [x * inflate for x in radii] if isinstance(radii, (tuple, list, Vector)) else [radii * inflate] * 3
    grid = {}
    verts = []
    for ix in (-1, 0, 1):
        for iy in (-1, 0, 1):
            for iz in (-1, 0, 1):
                if ix == 0 and iy == 0 and iz == 0:
                    continue
                v = Vector((ix, iy, iz)).normalized()
                grid[(ix, iy, iz)] = len(verts)
                verts.append((cx + v.x * r[0], cy + v.y * r[1], cz + v.z * r[2]))
    faces = []
    # each cube face is a 2x2 grid of quads
    for axis in range(3):
        for sign in (-1, 1):
            quads = []
            for a in (-1, 0):
                for b in (-1, 0):
                    cell = []
                    for da, db in ((0, 0), (1, 0), (1, 1), (0, 1)):
                        p = [0, 0, 0]
                        p[axis] = sign
                        p[(axis + 1) % 3] = a + da
                        p[(axis + 2) % 3] = b + db
                        cell.append(grid[tuple(p)])
                    quads.append(cell)
            for q in quads:
                # orient outward
                n = (Vector(verts[q[1]]) - Vector(verts[q[0]])).cross(Vector(verts[q[2]]) - Vector(verts[q[0]]))
                c = sum((Vector(verts[i]) for i in q), Vector()) / 4 - Vector(center)
                faces.append(tuple(q) if n.dot(c) > 0 else tuple(reversed(q)))
    return verts, faces


def tube(path, radii, sides=8, cap_start=True, cap_end=True, tip_end=False, tip_start=False,
         roll=0.0, up=None, squash=None, inflate=INFLATE_TUBE):
    """Tube cage along `path` (list of Vector). `radii` per point: number or (rx, ry) where
    rx is across (binormal) and ry along the frame normal. `tip_end` collapses the last ring
    into a pointed tip (and its edges get creased by the caller via `tip_edges`).
    Returns (verts, faces, rings, tips) where rings[i] = vertex indices of ring i."""
    pts = [Vector(p) for p in path]
    n = len(pts)
    tangents = []
    for i in range(n):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == n - 1:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        tangents.append(t.normalized() if t.length > 1e-9 else Vector((0, 0, 1)))
    # parallel-transport frame
    ref = Vector(up) if up is not None else (Vector((0, 0, 1)) if abs(tangents[0].z) < 0.9 else Vector((0, -1, 0)))
    nrm = (ref - tangents[0] * ref.dot(tangents[0])).normalized()
    frames = []
    for i in range(n):
        t = tangents[i]
        nrm = (nrm - t * nrm.dot(t))
        if nrm.length < 1e-6:
            nrm = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
            nrm = (nrm - t * nrm.dot(t))
        nrm.normalize()
        bn = t.cross(nrm).normalized()
        frames.append((nrm, bn))
    verts = []
    rings = []
    faces = []
    for i in range(n):
        # a list = per-point radii; a tuple (rx, ry) or a number = the same radius everywhere
        r = radii[i] if isinstance(radii, list) else radii
        rx, ry = (r, r) if not isinstance(r, (tuple, list)) else r
        rx *= inflate
        ry *= inflate
        nrm, bn = frames[i]
        ring = []
        is_tip = (tip_end and i == n - 1) or (tip_start and i == 0)
        if is_tip:
            ring = [len(verts)]
            verts.append(tuple(pts[i]))
        else:
            for k in range(sides):
                a = 2 * math.pi * k / sides + roll
                off = bn * (math.cos(a) * rx) + nrm * (math.sin(a) * ry)
                if squash:
                    off += nrm * (squash * ry * math.cos(a) ** 2)
                ring.append(len(verts))
                verts.append(tuple(pts[i] + off))
        rings.append(ring)
    for i in range(n - 1):
        a, b = rings[i], rings[i + 1]
        if len(a) == 1:
            for k in range(sides):
                faces.append((a[0], b[(k + 1) % sides], b[k]))
        elif len(b) == 1:
            for k in range(sides):
                faces.append((a[k], a[(k + 1) % sides], b[0]))
        else:
            for k in range(sides):
                faces.append((a[k], a[(k + 1) % sides], b[(k + 1) % sides], b[k]))
    if cap_start and len(rings[0]) > 1:
        faces.append(tuple(reversed(rings[0])))
    if cap_end and len(rings[-1]) > 1:
        faces.append(tuple(rings[-1]))
    # fix orientation: outward normals
    faces = _orient(verts, faces)
    return verts, faces, rings


def tip_edges(rings, end=True):
    """Edge pairs from the last (or first) ring to its tip vertex, for creasing."""
    ring, tip = (rings[-2], rings[-1][0]) if end else (rings[1], rings[0][0])
    return [(v, tip) for v in ring]


def lathe(profile, segments=12, close_top=True, close_bottom=True, center=(0, 0, 0), arc=2 * math.pi,
          start=0.0, scale_xy=(1.0, 1.0), inflate=1.0):
    """Revolves profile [(r, z)...] around the Z axis. Returns (verts, faces, rings)."""
    cx, cy, cz = center
    verts = []
    rings = []
    closed = abs(arc - 2 * math.pi) < 1e-6
    count = segments if closed else segments + 1
    for r, z in profile:
        ring = []
        for k in range(count):
            a = start + arc * k / segments
            ring.append(len(verts))
            verts.append((cx + math.cos(a) * r * inflate * scale_xy[0], cy + math.sin(a) * r * inflate * scale_xy[1], cz + z))
        rings.append(ring)
    faces = []
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for k in range(segments):
            k2 = (k + 1) % count
            faces.append((a[k], a[k2], b[k2], b[k]))
    if close_bottom and closed:
        faces.append(tuple(reversed(rings[0])))
    if close_top and closed:
        faces.append(tuple(rings[-1]))
    faces = _orient(verts, faces, center=Vector(center) + Vector((0, 0, (profile[0][1] + profile[-1][1]) / 2)))
    return verts, faces, rings


def plate(points2d, thickness, center=(0, 0, 0), plane='xz', bevel=0.0):
    """Extrudes a 2D polygon (list of (a, b)) into a thin slab. plane 'xz': a->x, b->z,
    thickness along y; 'xy': thickness along z."""
    cx, cy, cz = center
    n = len(points2d)
    verts = []
    for sign in (-1, 1):
        for a, b in points2d:
            if plane == 'xz':
                verts.append((cx + a, cy + sign * thickness / 2, cz + b))
            elif plane == 'xy':
                verts.append((cx + a, cy + b, cz + sign * thickness / 2))
            else:  # 'yz'
                verts.append((cx + sign * thickness / 2, cy + a, cz + b))
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
    faces = _orient(verts, faces)
    return verts, faces


def _orient(verts, faces, center=None):
    """Flips faces whose normal points towards the centroid (keeps cages outward-facing)."""
    vs = [Vector(v) for v in verts]
    c = center if center is not None else sum(vs, Vector()) / max(1, len(vs))
    out = []
    for f in faces:
        if len(f) < 3:
            continue
        p0, p1, p2 = vs[f[0]], vs[f[1]], vs[f[2]]
        n = (p1 - p0).cross(p2 - p0)
        fc = sum((vs[i] for i in f), Vector()) / len(f)
        out.append(tuple(f) if n.dot(fc - c) >= 0 else tuple(reversed(f)))
    return out


def bezier(p0, p1, p2, p3, count=6):
    """Points along a cubic bezier (inclusive)."""
    pts = []
    for i in range(count):
        t = i / (count - 1)
        u = 1 - t
        pts.append(Vector(p0) * (u ** 3) + Vector(p1) * (3 * u * u * t) + Vector(p2) * (3 * u * t * t) + Vector(p3) * (t ** 3))
    return pts


def smooth_path(ctrl, count=8):
    """Catmull-Rom spline through control points."""
    ctrl = [Vector(c) for c in ctrl]
    if len(ctrl) < 3:
        return ctrl
    pts = []
    segs = len(ctrl) - 1
    for i in range(count):
        t = i / (count - 1) * segs
        k = min(int(t), segs - 1)
        f = t - k
        p0 = ctrl[max(0, k - 1)]
        p1 = ctrl[k]
        p2 = ctrl[k + 1]
        p3 = ctrl[min(len(ctrl) - 1, k + 2)]
        pts.append(0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f))
    return pts


def mirror_x(obj):
    """Mirrored copy across X (new object with the same groups/colours)."""
    me = obj.data.copy()
    me.transform(Matrix.Diagonal((-1, 1, 1, 1)))
    me.flip_normals()
    me.update()
    o = bpy.data.objects.new(obj.name + '_m', me)
    bpy.context.scene.collection.objects.link(o)
    for vg in obj.vertex_groups:
        nv = o.vertex_groups.new(name=vg.name.replace('_L', '_TMP').replace('_R', '_L').replace('_TMP', '_R'))
        for v in me.vertices:
            try:
                w = vg.weight(v.index)
            except RuntimeError:
                continue
            nv.add([v.index], w, 'REPLACE')
    o['part'] = obj.get('part', 'part')
    return o


def remove(obj):
    me = obj.data
    bpy.data.objects.remove(obj)
    if me.users == 0:
        bpy.data.meshes.remove(me)
