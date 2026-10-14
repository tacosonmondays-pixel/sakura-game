# Jewelled sword from the approved sheet (white-blue crystal blade, gold star crossguard with a
# teal gem, magenta gem at the blade root, magenta grip, gold pommel with a teal gem).
# Built in a local frame: blade along +Y, guard plane = XY (flat side faces +Z), grip centre at 0.
import bpy, bmesh, math
from mathutils import Vector, Matrix

GOLD = (0.95, 0.74, 0.30); GOLD_D = (0.78, 0.55, 0.18)
TEAL = (0.16, 0.78, 0.74); TEAL_L = (0.55, 0.95, 0.90)
MAG = (0.86, 0.22, 0.58); GRIP = (0.62, 0.20, 0.45)
EDGE = (0.97, 0.99, 1.0); CORE = (0.62, 0.86, 0.98); CORE_D = (0.45, 0.75, 0.95)

class Builder:
    def __init__(self):
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.color.new('Col')
    def face(self, vs, cols):
        f = self.bm.faces.new(vs)
        for l, c in zip(f.loops, cols): l[self.col] = (*c, 1.0)  # byte colour layer: sRGB values
        return f
    def v(self, p): return self.bm.verts.new(p)
    def ellipsoid(self, c, r, color, seg=10, rings=6, xf=None, color2=None):
        """UV sphere with per-ring colour (color2 = top highlight)."""
        rows = []
        for i in range(rings + 1):
            th = math.pi * i / rings
            row = []
            for j in range(seg):
                ph = 2 * math.pi * j / seg
                p = Vector((r[0] * math.sin(th) * math.cos(ph), r[1] * math.cos(th), r[2] * math.sin(th) * math.sin(ph)))
                if xf: p = xf @ p
                row.append(self.v(c + p))
            rows.append(row)
        for i in range(rings):
            for j in range(seg):
                a, b = rows[i][j], rows[i][(j + 1) % seg]; d, e = rows[i + 1][j], rows[i + 1][(j + 1) % seg]
                cc = color2 if (color2 and i < rings // 2) else color
                self.face([a, d, e, b], [cc] * 4)
    def tube(self, pts, radii, colors, seg=8):
        rows = []
        for k, (p, r) in enumerate(zip(pts, radii)):
            d = (pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]).normalized()
            u = d.orthogonal().normalized(); w = d.cross(u)
            rows.append([self.v(p + (u * math.cos(2 * math.pi * j / seg) + w * math.sin(2 * math.pi * j / seg)) * r) for j in range(seg)])
        for k in range(len(rows) - 1):
            for j in range(seg):
                a, b = rows[k][j], rows[k][(j + 1) % seg]; c, d = rows[k + 1][j], rows[k + 1][(j + 1) % seg]
                self.face([a, b, d, c], [colors[k]] * 2 + [colors[k + 1]] * 2)
        # caps
        self.face(list(reversed(rows[0])), [colors[0]] * seg)
        self.face(rows[-1], [colors[-1]] * seg)

def build_sword(scale=1.0, name='sword', bw=1.35, bt=1.5):
    B = Builder()
    s = scale
    # --- blade: diamond cross-section (edge, core ridge), tapered, pointed tip
    y0, y1, tip = 0.070 * s, 0.470 * s, 0.545 * s
    sec = []  # (y, half width, half thickness)
    for k in range(7):
        t = k / 6
        y = y0 + (y1 - y0) * t
        hw = (0.030 - 0.006 * t) * s * bw
        sec.append((y, hw, 0.0085 * s * bt))
    rings = []
    for (y, hw, ht) in sec:
        # 6 points: left edge, front-left bevel, front ridge, right edge, back ridge (+ bevels)
        pts = [(-hw, 0), (-hw * 0.45, ht * 0.8), (0, ht), (hw * 0.45, ht * 0.8), (hw, 0), (hw * 0.45, -ht * 0.8), (0, -ht), (-hw * 0.45, -ht * 0.8)]
        rings.append([B.v((x, y, z)) for (x, z) in pts])
    cols = [EDGE, CORE, CORE_D, CORE, EDGE, CORE, CORE_D, CORE]
    for k in range(len(rings) - 1):
        for j in range(8):
            a, b = rings[k][j], rings[k][(j + 1) % 8]; c, d = rings[k + 1][j], rings[k + 1][(j + 1) % 8]
            B.face([a, c, d, b], [cols[j], cols[j], cols[(j + 1) % 8], cols[(j + 1) % 8]])
    tv = B.v((0, tip, 0))
    for j in range(8):
        a, b = rings[-1][j], rings[-1][(j + 1) % 8]
        B.face([a, tv, b], [cols[j], EDGE, cols[(j + 1) % 8]])
    B.face(list(rings[0]), [CORE] * 8)
    # --- crossguard: 4-point gold star (long arms sideways), with a teal gem front + back
    gy = 0.052 * s
    arms = [(1, 0, 0.095), (-1, 0, 0.095), (0, 1, 0.056), (0, -1, 0.044)]
    for (ax, ay, L) in arms:
        dirv = Vector((ax, ay, 0)); side = Vector((-ay, ax, 0))
        base_w = 0.024 * s; th = 0.016 * s
        p0 = Vector((0, gy, 0))
        # tapered diamond prism from centre to tip, curling slightly toward the blade (wing)
        tipp = p0 + dirv * L * s + Vector((0, 0.018 * s if ay == 0 else 0, 0))
        mid = p0 + dirv * L * s * 0.45 + Vector((0, 0.006 * s if ay == 0 else 0, 0))
        ring0 = [B.v(p0 + side * base_w + Vector((0, 0, 0))), B.v(p0 + Vector((0, 0, th))), B.v(p0 - side * base_w), B.v(p0 - Vector((0, 0, th)))]
        ring1 = [B.v(mid + side * base_w * 0.75), B.v(mid + Vector((0, 0, th * 0.8))), B.v(mid - side * base_w * 0.75), B.v(mid - Vector((0, 0, th * 0.8)))]
        t = B.v(tipp)
        gc = [GOLD, GOLD, GOLD_D, GOLD_D]
        for j in range(4):
            B.face([ring0[j], ring1[j], ring1[(j + 1) % 4], ring0[(j + 1) % 4]], [gc[j]] * 4)
            B.face([ring1[j], t, ring1[(j + 1) % 4]], [gc[j]] * 3)
    # centre boss + gems
    B.ellipsoid(Vector((0, gy, 0)), (0.028 * s, 0.028 * s, 0.019 * s), GOLD, seg=10, rings=6)
    for zs in (1, -1):
        B.ellipsoid(Vector((0, gy, zs * 0.017 * s)), (0.018 * s, 0.023 * s, 0.009 * s), TEAL, seg=10, rings=6, color2=TEAL_L)
    # magenta gem at the blade root (both faces)
    for zs in (1, -1):
        B.ellipsoid(Vector((0, 0.100 * s, zs * 0.0125 * s)), (0.011 * s, 0.019 * s, 0.005 * s), MAG, seg=8, rings=4)
    # --- grip + pommel
    gp = [Vector((0, y * s, 0)) for y in (0.040, 0.020, 0.0, -0.020, -0.040, -0.052)]
    B.tube(gp, [0.0150 * s, 0.0138 * s, 0.0144 * s, 0.0138 * s, 0.0150 * s, 0.019 * s], [GOLD, GRIP, GRIP, GRIP, GRIP, GOLD], seg=8)
    B.ellipsoid(Vector((0, -0.066 * s, 0)), (0.020 * s, 0.023 * s, 0.020 * s), TEAL, seg=10, rings=6, color2=TEAL_L)
    B.ellipsoid(Vector((0, -0.085 * s, 0)), (0.008 * s, 0.009 * s, 0.008 * s), GOLD, seg=8, rings=4)
    me = bpy.data.meshes.new(name)
    bmesh.ops.remove_doubles(B.bm, verts=B.bm.verts, dist=1e-7)
    bmesh.ops.dissolve_degenerate(B.bm, dist=1e-7, edges=B.bm.edges)
    bmesh.ops.triangulate(B.bm, faces=B.bm.faces)
    bmesh.ops.recalc_face_normals(B.bm, faces=B.bm.faces)
    B.bm.to_mesh(me); B.bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    mat = bpy.data.materials.new('sword'); mat.use_nodes = True
    nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
    ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'
    nt.links.new(ca.outputs['Color'], bsdf.inputs['Base Color'])
    me.materials.append(mat)
    return ob
