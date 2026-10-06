"""Cage helpers for enemies on top of tools/blender/lib/mesh.py.

Every part is tagged with
  vis      'base' | 'prop:<name>' | 'var:<variant>'   (runtime visibility)
  group    a part group ('main', 'legs', 'torso'...) that a variant may hide
  material 'body' (tinted vertex colours + face texture) | 'glow' (unlit)
and painted with a tint ROLE in the vertex-colour alpha:
  main   (a=0)   rgb is a multiplier of the enemy's def.color  (white = the colour itself)
  accent (a=0.5) rgb is a multiplier of def.accent
  fixed  (a=1)   rgb is the literal colour (teeth, metal, gold...)
"""
import math
import bpy
from mathutils import Vector, Matrix

from lib import mesh as M
from lib.colors import linear, mix, darken, lighten

ROLE = dict(fixed=1.0, main=0.0, accent=0.5)
# top-left corner of every atlas cell is transparent (Blender UV space, v up)
CORNER_UV = (0.01, 0.99)
FRONT = Vector((0, -1, 0))
UP = Vector((0, 0, 1))


def V(x, y=0.0, z=0.0):
    return Vector(x) if isinstance(x, (tuple, list, Vector)) else Vector((x, y, z))


# ---------------------------------------------------------------------------
# Painting + tagging
# ---------------------------------------------------------------------------

def paint(obj, color='#ffffff', role='fixed', fn=None):
    """Vertex colours with the tint role in alpha. fn(co) -> (color, role) overrides per vertex."""
    me = obj.data
    attr = me.color_attributes.get(M.COLOR_ATTR) or me.color_attributes.new(M.COLOR_ATTR, 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = me.color_attributes.find(M.COLOR_ATTR)
    base = linear(color) if isinstance(color, str) else tuple(color)
    a = ROLE[role]
    for i, v in enumerate(me.vertices):
        if fn is None:
            c, ra = base, a
        else:
            cc, rr = fn(v.co)
            c = linear(cc) if isinstance(cc, str) else tuple(cc)
            ra = ROLE[rr]
        attr.data[i].color = (c[0], c[1], c[2], ra)


def tag(obj, vis='base', group='main', material='body'):
    obj['vis'] = vis
    obj['group'] = group
    obj['material'] = material
    return obj


def part(name, verts, faces, color='#ffffff', role='fixed', bone=None, vis='base', group='main', material='body', fn=None):
    o = M.new_object(name, verts, faces, color='#ffffff', bone=bone)
    paint(o, color, role, fn)
    return tag(o, vis, group, material)


def blob(name, center, radii, color='#ffffff', role='main', bone=None, levels=2, shape=None, **t):
    """Rounded-cube cage -> ellipsoid. shape(p: unit Vector) -> Vector reshapes the cage."""
    if not isinstance(radii, (tuple, list, Vector)):
        radii = (radii, radii, radii)
    verts, faces = M.sphere((0, 0, 0), (1, 1, 1), inflate=1.0)
    out = []
    for v in verts:
        p = Vector(v)
        if shape:
            p = shape(p)
        out.append((center[0] + p.x * radii[0] * M.INFLATE_SPHERE, center[1] + p.y * radii[1] * M.INFLATE_SPHERE, center[2] + p.z * radii[2] * M.INFLATE_SPHERE))
    o = part(name, out, faces, color, role, bone, **t)
    M.finish(o, levels=levels)
    return o


def box(name, center, size, color='#ffffff', role='main', bone=None, levels=1, crease=0.0, **t):
    v, f = M.box(center, size)
    o = part(name, v, f, color, role, bone, **t)
    if crease:
        M.crease(o, [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4), (0, 4), (1, 5), (2, 6), (3, 7)], crease)
    M.finish(o, levels=levels)
    return o


def tube(name, path, radii, color='#ffffff', role='main', bone=None, sides=8, levels=1, tip_end=False, tip_start=False, up=None, squash=None, cap_start=True, cap_end=True, **t):
    v, f, r = M.tube([Vector(p) for p in path], radii, sides=sides, tip_end=tip_end, tip_start=tip_start, up=up, squash=squash, cap_start=cap_start, cap_end=cap_end)
    o = part(name, v, f, color, role, bone, **t)
    pairs = []
    if tip_end:
        pairs += M.tip_edges(r)
    if tip_start:
        pairs += M.tip_edges(r, end=False)
    if pairs:
        M.crease(o, pairs, 1.0)
    M.finish(o, levels=levels)
    return o


def cone(name, base, tip, r, color='#ffffff', role='fixed', bone=None, sides=6, levels=1, **t):
    """Pointed horn/spike/tooth from base to tip."""
    b, tp = Vector(base), Vector(tip)
    mid = b.lerp(tp, 0.5)
    return tube(name, [b, mid, tp], [r, r * 0.6, 0.001], color, role, bone, sides=sides, levels=levels, tip_end=True, **t)


def lathe(name, profile, color='#ffffff', role='main', bone=None, segments=12, center=(0, 0, 0), levels=1, close_top=True, close_bottom=True, scale_xy=(1, 1), crease_rings=(), **t):
    v, f, r = M.lathe(profile, segments=segments, close_top=close_top, close_bottom=close_bottom, center=center, scale_xy=scale_xy)
    o = part(name, v, f, color, role, bone, **t)
    for i in crease_rings:
        M.crease_ring(o, r[i], 1.0)
    M.finish(o, levels=levels)
    return o


def plate(name, points2d, thickness, center=(0, 0, 0), plane='xz', color='#ffffff', role='fixed', bone=None, levels=1, crease=1.0, **t):
    v, f = M.plate(points2d, thickness, center=center, plane=plane)
    o = part(name, v, f, color, role, bone, **t)
    n = len(points2d)
    if crease:
        M.crease(o, [(i, (i + 1) % n) for i in range(n)] + [(n + i, n + (i + 1) % n) for i in range(n)], crease)
    M.finish(o, levels=levels)
    return o


def xform(obj, loc=None, rot=None, scale=None):
    """Bakes a transform into the object's mesh (rot: Euler or Matrix)."""
    M.transform(obj, loc=loc, rot=rot, scale=scale)
    return obj


def rot_x(deg):
    return Matrix.Rotation(math.radians(deg), 4, 'X')


def rot_y(deg):
    return Matrix.Rotation(math.radians(deg), 4, 'Y')


def rot_z(deg):
    return Matrix.Rotation(math.radians(deg), 4, 'Z')


def mirror(obj):
    """Mirrored copy across X (vertex groups swap _L/_R)."""
    o = M.mirror_x(obj)
    for k in ('vis', 'group', 'material'):
        o[k] = obj[k]
    return o


# ---------------------------------------------------------------------------
# Heads and faces
# ---------------------------------------------------------------------------

def head_shape(p, flat=0.14, cheek=0.06, chin=0.08):
    """Reshapes a unit sphere cage into a chibi head: flatter face plane, soft cheeks, a
    slightly narrower chin and a round cranium (jaeysart step 1)."""
    x, y, z = p.x, p.y, p.z
    q = Vector((x, y, z))
    front = max(0.0, -y)
    lower = max(0.0, -z)
    q.y += flat * front * (1.0 - 0.5 * abs(x)) * (1.0 - 0.6 * abs(z))
    ch = front * lower * abs(x)
    q.x *= 1.0 + cheek * ch
    q.z -= 0.04 * ch
    if z < 0:
        q.x *= 1.0 - chin * lower * (0.4 + 0.6 * front)
        q.y *= 1.0 - 0.05 * lower
    if z > 0:
        q.z *= 1.0 + 0.04 * z * (0.5 + 0.5 * max(0.0, y))
    return q


def face_uvs(obj, center, radii, window=0.2, box=None, cols=3, rows=2):
    """Planar front projection of the face: u across the face box, v chin -> top, only on
    polygons that face the front (normal.y < -window). Every other loop goes to the
    transparent atlas corner so the painted face never wraps round the head.
    box = (half_width, z_bottom, z_top) in object space; defaults from the head radii."""
    me = obj.data
    uv = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    c = Vector(center)
    hw, z0, z1 = box if box else (radii[0] * 1.0, c.z - radii[2] * 0.95, c.z + radii[2] * 0.95)
    for poly in me.polygons:
        n = poly.normal
        front = n.y < -window
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            if not front:
                uv.data[li].uv = CORNER_UV
                continue
            u = 0.5 + (v.x - c.x) / (2 * hw)
            vv = (v.z - z0) / max(1e-6, (z1 - z0))
            uv.data[li].uv = (min(0.999, max(0.001, u)), min(0.999, max(0.001, vv)))
    me.update()


def corner_uvs(obj, cols=3, rows=2):
    """UVs at the transparent atlas corner for parts without a face."""
    me = obj.data
    uv = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    for li in range(len(me.loops)):
        uv.data[li].uv = CORNER_UV
    me.update()


def head(name, center, radii, color='#ffffff', role='main', bone='head', levels=2, shape=head_shape, face=True, face_box=None, window=0.2, **t):
    """A chibi head blob with the painted-face UV window on its front."""
    o = blob(name, center, radii, color, role, bone, levels=levels, shape=shape, **t)
    if face:
        face_uvs(o, center, radii, window=window, box=face_box)
    return o


# ---------------------------------------------------------------------------
# Small shared pieces
# ---------------------------------------------------------------------------

def gloss(name, center, radii, bone, rot=None, **t):
    """Unlit white highlight blob (jelly / crystal / metal gloss)."""
    o = blob(name, (0, 0, 0), radii, '#ffffff', 'fixed', bone, levels=1, material='glow', **t)
    if rot is not None:
        xform(o, rot=rot)
    xform(o, loc=center)
    return o


def surface(center, radii, az, el, shape=None):
    """Point + outward normal on a (possibly reshaped) ellipsoid blob. az 0 = front (-Y),
    +90 = the enemy's left (+X); el = elevation above the equator (degrees)."""
    d = Vector((math.sin(math.radians(az)) * math.cos(math.radians(el)), -math.cos(math.radians(az)) * math.cos(math.radians(el)), math.sin(math.radians(el))))
    q = shape(d) if shape else d
    p = Vector((center[0] + q.x * radii[0], center[1] + q.y * radii[1], center[2] + q.z * radii[2]))
    n = Vector((q.x / radii[0], q.y / radii[1], q.z / radii[2])).normalized()
    return p, n


def gloss_on(name, center, radii, az, el, size, bone, shape=None, sink=-0.15, stretch=1.6, **t):
    """A flat highlight lens lying on the blob surface at (az, el), half sunk into it."""
    p, n = surface(center, radii, az, el, shape)
    o = blob(name, (0, 0, 0), (size * stretch, size, size * 0.45), '#ffffff', 'fixed', bone, levels=1, material='glow', **t)
    rot = Vector((0, 0, 1)).rotation_difference(n).to_matrix().to_4x4()
    spin = Matrix.Rotation(math.radians(-30), 4, 'Z')
    xform(o, rot=rot @ spin, loc=p - n * size * sink)
    return o


def ring(name, center, r, thick, color, role='fixed', bone=None, segments=12, levels=0, axis='z', **t):
    """A torus-like ring (lathe of a small rounded profile)."""
    prof = [(r - thick, -thick * 0.6), (r + thick, -thick * 0.6), (r + thick, thick * 0.6), (r - thick, thick * 0.6)]
    o = lathe(name, prof, color, role, bone, segments=segments, center=(0, 0, 0), levels=levels, **t)
    if axis == 'y':
        xform(o, rot=rot_x(90))
    elif axis == 'x':
        xform(o, rot=rot_y(90))
    xform(o, loc=center)
    return o


def crease_box(o, w=1.0):
    M.crease(o, [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4), (0, 4), (1, 5), (2, 6), (3, 7)], w)


def weight_segments(obj, bones, blend=0.03):
    """Smooth weights by nearest bone segments: bones = [(name, head, tail)]."""
    M.weight_by_bones(obj, bones, blend=blend)
    return obj


def set_bone(obj, bone):
    for vg in list(obj.vertex_groups):
        obj.vertex_groups.remove(vg)
    M.set_bone(obj, bone)
    return obj
