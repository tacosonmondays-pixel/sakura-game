"""Faces built as geometry (docs/art/tripo/slime-goblin-faces.md): eyes, highlights, mouths and blush as small
vertex-coloured meshes in a material named 'face', drawn by src/models/glbEnemy.js faceMaterial (the body's toon
ramp, no texture, never outlined).

Why geometry: a face painted into the body texture stretches with every squash of the body, blurs when the texture is
small or seen at a slant, and an inverted-hull outline drawn around painted eyes in creased skin reads as dark rims,
hollow sockets. A face part here is a flat-shaded shape (its normals are its anchor's, so a toon step never splits an
eye), shrink-wrapped onto the body surface a few millimetres out, weighted wholly to one bone: it can only move and
turn with that bone, never stretch.

    parts = FaceParts(surface_obj)                    # the body (world space); rays project the parts onto it
    fr = parts.frame(anchor, normal)                  # centre, right, up, out
    parts.ellipse(fr, rx, ry, colour, lift=0.005, group='eye_L', segs=40, rings=(0.4, 0.7, 1.0), bulge=0.004)
    rim = parts.ellipse(..., bridge=True)             # laid over its socket (rim()); highlights pass bridge=rim
    parts.use_texture(img); parts.band(fr, ...)       # a skin patch over a painted band (the goblin's old grin)
    ob = parts.to_object('face')                      # vertex colours 'face_col', material 'face', vertex groups

Also: find_painted_eyes() (the dark eye texels of a textured figure, as 3D ellipses on its surface), rigid_fit() (how
a rigid part follows the squashed patch of body under it), glossy_eye(), face_material(), strip_colors() (only the
face primitive keeps COLOR_0 in the exported GLB)."""
import json
import math
import struct

import bpy
import bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def linear(hexstr):
    """'#rrggbb' -> linear RGB (the colour attribute and glTF COLOR_0 are linear)."""
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def glossy_eye(top='#1a1530', mid='#241c3e', low='#3a64a8', glint=0.9):
    """A dark glossy eye's colour over its unit disc: deep navy, a little lighter in the middle, a blue glint low in
    the eye (the game's own slime art). Returns fn(x, y) -> linear RGB."""
    T, M, L = linear(top), linear(mid), linear(low)

    def colour(ex, ey):
        c = mix(T, M, smooth(1 - math.hypot(ex, ey)))
        return mix(c, L, smooth((-ey - 0.25) / 0.65) * glint)
    return colour


def face_material():
    """The 'face' material: base colour from the 'face_col' colour attribute (so the exporter writes COLOR_0)."""
    mat = bpy.data.materials.get('face') or bpy.data.materials.new('face')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    va = nt.nodes.new('ShaderNodeVertexColor')
    va.layer_name = 'face_col'
    nt.links.new(va.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 1.0
    bsdf.inputs['Metallic'].default_value = 0.0
    return mat


class FaceParts:
    """Collects face parts (one bmesh), each a 2D shape in a local frame shrink-wrapped onto a surface."""

    def __init__(self, surface=None):
        self.bm = bmesh.new()
        self.col = []          # per vertex: linear RGB
        self.nrm = []          # per vertex: the part's flat normal
        self.grp = []          # per vertex: vertex group name
        self.base = []         # per vertex: the surface point under it (before the lift)
        self._last_base = None
        self.bvh = None
        self.texture = None
        if surface is not None:
            deps = bpy.context.evaluated_depsgraph_get()
            ev = surface.evaluated_get(deps)
            me = ev.to_mesh()
            M = surface.matrix_world
            Mn = M.to_3x3().inverted().transposed()
            verts = [M @ v.co for v in me.vertices]
            polys = [tuple(p.vertices) for p in me.polygons]
            self.bvh = BVHTree.FromPolygons(verts, polys)
            # for skin patches (band): the surface's smooth normals and texture coordinates under a point
            self.verts = verts
            self.polys = polys
            self.vnormals = [(Mn @ v.normal).normalized() for v in me.vertices]
            uvl = me.uv_layers.active.data if me.uv_layers.active else None
            self.puv = [[Vector((uvl[li].uv.x, uvl[li].uv.y, 0.0)) for li in p.loop_indices] for p in me.polygons] if uvl else None
            ev.to_mesh_clear()

    def use_texture(self, image):
        """The body's base-colour image (for band() colours sampled off the skin)."""
        W, H = image.size
        self.texture = (np.array(image.pixels[:], dtype=np.float32).reshape(H, W, 4), W, H)

    def surface(self, fr, x, y):
        """Under local (x, y): (depth behind the frame's plane, smooth normal, linear RGB of the texture there or
        None), or None off the surface."""
        c, r, u, n = fr
        o = c + r * x + u * y + n * 0.25
        hit, _, pi, dist = self.bvh.ray_cast(o, -n, 0.6)
        if hit is None:
            return None
        from mathutils.geometry import barycentric_transform
        ids = self.polys[pi]
        a, b, cc = (self.verts[i] for i in ids[:3])
        w = barycentric_transform(hit, a, b, cc, Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
        nrm = (self.vnormals[ids[0]] * w.x + self.vnormals[ids[1]] * w.y + self.vnormals[ids[2]] * w.z).normalized()
        rgb = None
        if self.texture is not None and self.puv is not None:
            px, W, H = self.texture
            uv = self.puv[pi][0] * w.x + self.puv[pi][1] * w.y + self.puv[pi][2] * w.z
            s = px[min(H - 1, max(0, int(uv.y * H))), min(W - 1, max(0, int(uv.x * W))), :3]
            rgb = tuple(float(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in s)
        return dist - 0.25, nrm, rgb

    def band(self, fr, half, lower, upper, lift=0.001, group='face', cols=24, rows=4, margin=0.012, sample=0.006):
        """A skin patch over a painted band (a wide grin): from x = -half to half, between lower(x) - margin and
        upper(x) + margin (local coordinates), laid on a smooth surface bridged over the band's crease (rim()), its
        colours the texture's just outside it (top and bottom, blended between), its normals the skin's own at its
        edges blending to the bridge's in the middle, so its toon shading and colour meet the body's. Returns the
        bridge (for what is drawn on it)."""
        c, r, u, n = fr
        xs = [-half + 2 * half * i / cols for i in range(cols + 1)]
        lo = [lower(x) - margin for x in xs]
        hi = [upper(x) + margin for x in xs]
        rim_pts = [(x, y - 0.02) for x, y in zip(xs, lo)] + [(x, y + 0.02) for x, y in zip(xs, hi)]
        rim_pts += [(x, (a + b) / 2) for x, a, b in ((-half - 0.02, lo[0], hi[0]), (half + 0.02, lo[-1], hi[-1]))]
        bridge = self.rim(fr, rim_pts, ks=(1.0,), inside=[(x, (a + b) / 2 + (b - a) * f) for x, a, b in zip(xs, lo, hi)
                                                       for f in (-0.5, -0.25, 0.0, 0.25, 0.5)])

        def skin(x, y):
            s = self.surface(fr, x, y)
            return s[2] if s and s[2] else (0.5, 0.5, 0.5)

        grid = []
        for i, x in enumerate(xs):
            cb, ct = skin(x, lo[i] - sample), skin(x, hi[i] + sample)
            col = []
            for j in range(rows + 1):
                t = j / rows
                y = lo[i] + (hi[i] - lo[i]) * t
                edge = max(abs(2 * t - 1), abs(2 * i / cols - 1)) ** 3       # 1 at the patch's edge, 0 in the middle
                s = self.surface(fr, x, y)
                d = bridge(x, y)
                dx = (bridge(x + 1e-3, y) - bridge(x - 1e-3, y)) / 2e-3
                dy = (bridge(x, y + 1e-3) - bridge(x, y - 1e-3)) / 2e-3
                nb = (n + r * dx + u * dy).normalized()
                nrm = nb.lerp(s[1], edge).normalized() if s else nb
                if s:
                    self._last_base = c + r * x + u * y - n * s[0]
                    d = min(d, s[0])
                else:
                    self._last_base = c + r * x + u * y - n * d
                pos = c + r * x + u * y - n * d + n * lift
                col.append(self._add(pos, mix(cb, ct, t), nrm, group))
            grid.append(col)
        for i in range(cols):
            for j in range(rows):
                self.bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
        return bridge

    @staticmethod
    def frame(anchor, normal, up_hint=(0.0, 0.0, 1.0)):
        """(centre, right, up, out): out = the surface normal, up = the world up laid on the surface, right = up x out."""
        n = Vector(normal).normalized()
        u = Vector(up_hint)
        u = (u - n * u.dot(n)).normalized()
        r = u.cross(n).normalized()
        return Vector(anchor), r, u, n

    def depth(self, fr, x, y):
        """How far behind the frame's plane the surface is under local (x, y) (along -out), or None."""
        c, r, u, n = fr
        if self.bvh is None:
            return 0.0
        hit, _, _, dist = self.bvh.ray_cast(c + r * x + u * y + n * 0.25, -n, 0.6)
        return None if hit is None else dist - 0.25

    def rim(self, fr, outline, at=(0.0, 0.0), ks=(1.12, 1.25, 1.4), inside=None):
        """A smooth surface over a part's socket, as fn(x, y) -> depth: a quadric fitted to the surface depth on rings
        just outside its outline (local 2D points, scaled about `at` by each of `ks`), moved out until every real
        surface point inside the outline (or the given `inside` points) is behind it. A part laid on it (and the
        highlights on an eye, on the same one) bridges a crease or socket: from above, the socket's rim no longer hides
        an edge, and no bump inside pokes through a highlight."""
        rows, ds = [], []
        for k in ks:
            for x, y in outline:
                px, py = at[0] + x * k, at[1] + y * k
                d = self.depth(fr, px, py)
                if d is not None:
                    rows.append([1.0, px, py, px * px, py * py, px * py])
                    ds.append(d)
        coef = np.linalg.lstsq(np.array(rows), np.array(ds), rcond=None)[0]
        fit = lambda x, y: float(coef @ np.array([1.0, x, y, x * x, y * y, x * y]))  # noqa: E731
        if inside is None:
            inside = [(at[0] + x * k, at[1] + y * k) for k in np.linspace(0.0, 1.05, 8) for x, y in outline]
        over = 0.0
        for px, py in inside:
            d = self.depth(fr, px, py)
            if d is not None:
                over = max(over, fit(px, py) - d)
        return lambda x, y: fit(x, y) - over

    def project(self, fr, x, y, lift, bridge=None):
        """The surface point under local (x, y) of a frame, `lift` further out along the frame's normal (not the
        surface's: in a crease the surface normals swing sideways and would bend the part's outline; along the frame
        normal the outline seen from the front is exactly the shape drawn). bridge: a rim() surface to lie on instead
        of the real one."""
        c, r, u, n = fr
        q = c + r * x + u * y
        d = self.depth(fr, x, y) if self.bvh is not None else None
        if d is not None:
            self._last_base = q - n * d
            if bridge is not None:
                d = min(d, bridge(x, y))
            return q - n * d + n * lift
        self._last_base = q.copy()
        return q + n * lift

    def _add(self, co, colour, normal, group):
        v = self.bm.verts.new(co)
        self.col.append(colour)
        self.nrm.append(tuple(normal))
        self.grp.append(group)
        self.base.append(self._last_base.copy() if self._last_base is not None else Vector(co))
        return v

    def bases(self, group):
        """The surface points under a part's vertices (its patch of the body: what a rigid fit follows)."""
        return [b for b, g in zip(self.base, self.grp) if g == group]

    def ellipse(self, fr, rx, ry, colour, lift=0.004, group='face', segs=32, rings=(0.5, 1.0), bulge=0.0, at=(0.0, 0.0),
                rot=0.0, bridge=None):
        """A filled ellipse (centre + rings) at local `at` of frame `fr`, radii rx, ry, turned `rot` radians.
        colour: an RGB tuple, or fn(x, y) of the unit-disc position (x, y in -1..1) -> RGB. bulge: extra lift at the
        centre (a soft dome: a glossy eye). bridge: True = lay it over its socket (rim()), or a rim() surface to share
        (the highlights on an eye). The part's normal is the frame's `out` everywhere (flat toon shading). Returns
        the bridge surface used (or None)."""
        c, r, u, n = fr
        cr, sr = math.cos(rot), math.sin(rot)
        col = colour if callable(colour) else (lambda x, y, k=colour: k)

        def local(ex, ey):
            lx, ly = ex * rx, ey * ry
            return at[0] + lx * cr - ly * sr, at[1] + lx * sr + ly * cr

        if bridge is True:
            bridge = self.rim(fr, [(local(math.cos(a), math.sin(a))[0] - at[0], local(math.cos(a), math.sin(a))[1] - at[1])
                                   for a in np.linspace(0, 2 * math.pi, 24, endpoint=False)], at)
        centre = self._add(self.project(fr, *local(0, 0), lift + bulge, bridge), col(0.0, 0.0), n, group)
        prev = None
        for rho in rings:
            ring = []
            for k in range(segs):
                a = 2 * math.pi * k / segs
                ex, ey = rho * math.cos(a), rho * math.sin(a)
                ring.append(self._add(self.project(fr, *local(ex, ey), lift + bulge * (1 - rho * rho), bridge), col(ex, ey), n, group))
            for k in range(segs):
                k1 = (k + 1) % segs
                if prev is None:
                    self.bm.faces.new((centre, ring[k], ring[k1]))
                else:
                    self.bm.faces.new((prev[k], ring[k], ring[k1], prev[k1]))
            prev = ring
        return bridge

    def polygon(self, fr, pts, colour, lift=0.004, group='face', at=(0.0, 0.0), inner=0.55, bridge=None):
        """A filled star-shaped outline (local 2D points around `at`, counter-clockwise seen from outside), as a fan
        with one inner ring (so a colour function gets a gradient). colour: RGB or fn(x, y) of the local position.
        bridge: a rim() surface to lie on (a mouth drawn on a skin patch)."""
        col = colour if callable(colour) else (lambda x, y, k=colour: k)
        c, r, u, n = fr
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        centre = self._add(self.project(fr, at[0] + cx, at[1] + cy, lift, bridge), col(cx, cy), n, group)
        mid = [self._add(self.project(fr, at[0] + cx + (x - cx) * inner, at[1] + cy + (y - cy) * inner, lift, bridge),
                         col(cx + (x - cx) * inner, cy + (y - cy) * inner), n, group) for x, y in pts]
        ring = [self._add(self.project(fr, at[0] + x, at[1] + y, lift, bridge), col(x, y), n, group) for x, y in pts]
        m = len(pts)
        for k in range(m):
            k1 = (k + 1) % m
            self.bm.faces.new((centre, mid[k], mid[k1]))
            self.bm.faces.new((mid[k], ring[k], ring[k1], mid[k1]))
        return self

    def to_object(self, name='face'):
        """The parts as one object: colour attribute 'face_col', flat per-part normals, the 'face' material, vertex
        groups by part. Faces point out of the surface."""
        bm = self.bm
        bm.verts.index_update()
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        # every part faces out along its own normal
        for p in me.polygons:
            nsum = Vector((0, 0, 0))
            for vi in p.vertices:
                nsum += Vector(self.nrm[vi])
            if p.normal.dot(nsum) < 0:
                p.flip()
        me.update()
        ca = me.color_attributes.new('face_col', 'FLOAT_COLOR', 'POINT')
        for i, d in enumerate(ca.data):
            d.color = (*self.col[i], 1.0)
        for p in me.polygons:
            p.use_smooth = True
        me.normals_split_custom_set_from_vertices([Vector(v).normalized() for v in self.nrm])
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        groups = {}
        for i, g in enumerate(self.grp):
            if g not in groups:
                groups[g] = ob.vertex_groups.new(name=g)
            groups[g].add([i], 1.0, 'REPLACE')
        me.materials.append(face_material())
        return ob


def rigid_fit(P, Q):
    """The rotation R (3x3) and translation t that best map points P onto Q (least squares, Kabsch; no scale, no
    reflection): how a rigid face part follows the squashed patch of body under it."""
    P = np.asarray(P, float)
    Q = np.asarray(Q, float)
    cp, cq = P.mean(0), Q.mean(0)
    Hm = (P - cp).T @ (Q - cq)
    U, _, Vt = np.linalg.svd(Hm)
    d = np.sign(np.linalg.det(Vt.T @ U.T)) or 1.0
    R = Vt.T @ np.diag([1.0, 1.0, d]) @ U.T
    return R, cq - R @ cp


def find_painted_eyes(obj, image, zmin, zmax, max_x=0.25, dark=0.1, samples=7):
    """The painted eyes of a textured figure (`obj`, world space, front -Y): its dark texels (luminance under `dark`)
    on front-facing triangles between heights zmin and zmax, sampled on a barycentric grid, split into left (+x) and
    right (-x). Returns [{'side', 'centre', 'normal', 'pts'}] (world space), left first."""
    W, H = image.size
    px = np.array(image.pixels[:], dtype=np.float32).reshape(H, W, 4)
    me = obj.data
    uvl = me.uv_layers.active.data
    M = obj.matrix_world
    Mn = M.to_3x3().inverted().transposed()
    found = []
    tri = [(p, [me.loops[li].vertex_index for li in p.loop_indices], list(p.loop_indices)) for p in me.polygons]
    for p, vids, lids in tri:
        cw = M @ p.center
        nw = (Mn @ p.normal).normalized()
        if not (zmin <= cw.z <= zmax) or abs(cw.x) > max_x or nw.y > -0.2:
            continue
        P = [M @ me.vertices[v].co for v in vids]
        U = [uvl[li].uv for li in lids]
        for t in range(1, len(vids) - 1):     # fan-triangulate
            a, b, c = 0, t, t + 1
            for i in range(samples):
                for j in range(samples - i):
                    w1 = (i + 0.5) / samples
                    w2 = (j + 0.5) / samples
                    w0 = 1 - w1 - w2
                    if w0 < 0:
                        continue
                    uv = U[a] * w0 + U[b] * w1 + U[c] * w2
                    x = min(W - 1, max(0, int(uv.x * W)))
                    y = min(H - 1, max(0, int(uv.y * H)))
                    r_, g_, b_ = px[y, x, :3]
                    if 0.2126 * r_ + 0.7152 * g_ + 0.0722 * b_ < dark:
                        found.append((P[a] * w0 + P[b] * w1 + P[c] * w2, nw))
    eyes = []
    for side in ('L', 'R'):
        pts = [(q, n) for q, n in found if (q.x > 0) == (side == 'L')]
        if len(pts) < 8:
            continue
        P = np.array([tuple(q) for q, _ in pts])
        N = np.array([tuple(n) for _, n in pts])
        # trim stragglers: keep the points near the cluster's median
        med = np.median(P, 0)
        d = np.linalg.norm(P - med, axis=1)
        keep = d <= np.percentile(d, 95) * 1.2
        P, N = P[keep], N[keep]
        n = N.mean(0)
        n /= np.linalg.norm(n)
        eyes.append({'side': side, 'centre': Vector(P.mean(0)), 'normal': Vector(n), 'pts': [Vector(q) for q in P]})
    return eyes


def ellipse_of(eye, frame, q=0.5):
    """Semi-axes (in the frame's right / up) and centre offset of an eye's points, between their q-th and
    (100 - q)-th percentiles."""
    c, r, u, n = frame
    xs = np.array([(p - c).dot(r) for p in eye['pts']])
    ys = np.array([(p - c).dot(u) for p in eye['pts']])
    x0, x1 = np.percentile(xs, q), np.percentile(xs, 100 - q)
    y0, y1 = np.percentile(ys, q), np.percentile(ys, 100 - q)
    return (x1 - x0) / 2, (y1 - y0) / 2, ((x0 + x1) / 2, (y0 + y1) / 2)


def strip_colors(glb_path, keep=('face',)):
    """Removes COLOR_0 from every primitive whose material is not in `keep` (Blender exports the mesh's colour
    attribute on every primitive; on a textured body it would switch on the enemy outline's tint roles)."""
    data = open(glb_path, 'rb').read()
    jl = struct.unpack_from('<I', data, 12)[0]
    js = json.loads(data[20:20 + jl])
    rest = data[20 + jl:]
    mats = js.get('materials', [])
    changed = False
    for m in js.get('meshes', []):
        for p in m['primitives']:
            name = mats[p['material']]['name'] if 'material' in p else ''
            if name not in keep and 'COLOR_0' in p['attributes']:
                del p['attributes']['COLOR_0']
                changed = True
    if not changed:
        return
    jb = json.dumps(js, separators=(',', ':')).encode()
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    out = bytearray(data[:12])
    out += struct.pack('<II', len(jb), 0x4E4F534A) + jb + rest
    struct.pack_into('<I', out, 8, len(out))
    with open(glb_path, 'wb') as fh:
        fh.write(out)
