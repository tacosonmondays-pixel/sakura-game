"""The academy staff heroes on the shared chibi pipeline: Norika (Traffic Safety Officer) and Kogane (Facilities Crew
Chief). docs/art/tripo/staff-models.md.

They are adults, built to the owner's proportion references (about three heads tall, legs about a third of the
height, shoulders clearly narrower than the head, fingertips at mid-thigh) and a little taller than the girls, from
the same parts as the cast. The head, its painted face atlas, the hair library and the hat are built in "head space"
(the adult cast head, a touch narrower for a grown-up oval) and then scaled down onto the longer body (HEAD_K), so
the eyes, the hair locks and the hat keep the family's shapes and thicknesses. Their uniforms are fully covered work
clothes. Each prop is rigid on hand_R (weight 1.0, so the weapon-tip anchor finds it) and is modelled where it sits in
the idle hold, then mapped back into the rest pose (HeldChain), so it is upright and clear of the face in idle.

Build space as in build_characters.py: Blender Z up, the figure faces -Y, +X is her left, game units (the GLB stores
half size and extras.unitScale 2 scales it back).
"""
import math

from mathutils import Euler, Matrix, Vector

from . import anim, body, hair, halo, mesh as M, outfit
from .colors import darken, mix
from .hair import HAIR_TOP, Head
from .proportions import proportions

D = math.radians

# head space: the adult cast head (0.190, 0.182, 0.192), a touch narrower (a grown-up oval, not a round child's face)
HEAD_RADII = Vector((0.176, 0.178, 0.192))
HEAD_K = 0.86    # head space -> body: crown-to-chin is ~0.35 of her height (the girls' is 0.46): about 2.8 heads tall
CHIN = 0.66      # chin height; the hair crown is ~1.02 and the hat top ~1.05 (the girls' crown is 0.94-0.96)

WHITE = '#f6f6f2'
SHIRT = '#f7f7fb'
GLOVE = '#f4f2ea'
TAPE = '#d7dbe2'      # reflective tape (light silver)
STEEL = '#a3abb7'
STEEL_DARK = '#5d6470'


def proportions_staff():
    """(P, Ph, xf): the body proportions, the head-space proportions the head and hair are built in, and the head-space
    -> body transform (a uniform scale about the head centre, then a lift onto the longer neck)."""
    Ph = proportions(adult=True)
    Ph['head_radii'] = HEAD_RADII.copy()
    Ph['chin_z'] = Ph['head_center'].z - HEAD_RADII.z
    C = Ph['head_center'].copy()
    k = HEAD_K
    C2 = Vector((0.0, C.y * k, CHIN + HEAD_RADII.z * k))
    xf = Matrix.Translation(C2) @ Matrix.Scale(k, 4) @ Matrix.Translation(-C)
    P = dict(
        height=0.98,  # nominal, like every adult build (extras.height)
        head_center=C2, head_radii=HEAD_RADII * k,
        chin_z=CHIN, neck_r=0.034, neck_z=(0.61, 0.70),
        shoulder_z=0.607, shoulder_x=0.088, torso_top=0.645, torso_bottom=0.335,
        torso_w=(0.2, 0.164, 0.188), torso_d=(0.134, 0.12, 0.138),  # shoulders / waist / hips (full widths)
        waist_z=0.465,
        elbow=Vector((0.111, -0.010, 0.462)), wrist=Vector((0.121, -0.024, 0.345)), hand=Vector((0.125, -0.034, 0.304)),
        upper_arm_r=0.0325, forearm_r=0.028, hand_r=Vector((0.032, 0.027, 0.042)),
        hip=Vector((0.05, 0.0, 0.345)), knee=Vector((0.052, 0.004, 0.195)), ankle=Vector((0.052, 0.0, 0.066)),
        thigh_r=0.052, shin_r=0.039,
        foot=Vector((0.052, -0.016, 0.032)), foot_size=Vector((0.072, 0.13, 0.064)),
        halo_z=1.13, eye_v=Ph['eye_v'], adult=True,
    )
    P['shoulder'] = Vector((P['shoulder_x'], 0.0, P['shoulder_z']))
    return P, Ph, xf


# ---------------------------------------------------------------------------
# Head space: head, ears, hair and hat, then scaled onto the body
# ---------------------------------------------------------------------------

def build_head(ctx, Ph, xf, skin, hat_fn):
    """Builds the head, ears, hair and hat in head space and moves them (and the hair bones) onto the body."""
    P = ctx['P']
    ctx['P'] = Ph
    ctx['H'] = Head(Ph)
    n0 = len(ctx['parts'])
    hb0 = len(ctx['hair_bones'])
    head_obj = body.head(Ph, skin)
    ctx['head_obj'] = head_obj
    ctx['parts'] += [head_obj] + body.ears(Ph, skin)
    hair.build(ctx)
    hat_parts = hat_fn(ctx)
    ctx['parts'] += hat_parts
    for o in ctx['parts'][n0:]:
        o.data.transform(xf)
        o.data.update()
    for i in range(hb0, len(ctx['hair_bones'])):
        name, h, t, parent = ctx['hair_bones'][i]
        ctx['hair_bones'][i] = (name, xf @ Vector(h), xf @ Vector(t), parent)
    ctx['hat_top'] = max((v.co.z for o in hat_parts for v in o.data.vertices), default=P['head_center'].z + P['head_radii'].z)
    ctx['P'] = P
    ctx['H'] = Head(P)
    ctx.pop('halo_lift', None)


def _hat_base_el(az):
    """Elevation (deg) of the hard hat's lower edge: front 35, sides 19, back 3. It sits back on the head, its brim
    above the bangs (the eyes are at about -5..+5)."""
    return 19.0 + 16.0 * math.cos(math.radians(az))


class _OnHair:
    """Points just outside the hair (head space): cast from outside toward the head centre onto the hair cap's outer
    surface, then `off` out along the head's normal. Below the hairline (no cap) the head ellipsoid at HAIR_TOP."""

    def __init__(self, H, cap):
        from mathutils.bvhtree import BVHTree
        self.H = H
        self.bvh = None
        if cap is not None:
            me = cap.data
            self.bvh = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])

    def point(self, az, el, off):
        H = self.H
        base = H.surf(az, el, HAIR_TOP)
        if self.bvh is not None:
            o = H.surf(az, el, 2.0)
            hit, _n, _i, _d = self.bvh.ray_cast(o, (H.c - o).normalized())
            if hit is not None and (hit - H.c).length > (base - H.c).length * 0.9:
                base = hit
        return base + H.normal(az, el) * off

    def normal(self, az, el):
        return self.H.normal(az, el)


DOME_OFF = 0.03  # the hat shell's outer surface above the hair (head space; the shell is 0.012 thick inward)


def hard_hat(ctx, color, ridge=None, sticker=None, goggles=None):
    """A safety helmet sized like the cast's other hats: a dome hugging the hair (a snug shell a fixed gap over the
    hair cap, so nothing pokes through), a short brim all round with a small front peak, a raised centre ridge;
    optional sakura sticker on her left side and goggles strapped round the dome above the brim. Head space."""
    H = ctx['H']
    R = H.R
    S = _OnHair(H, _part(ctx, 'hair_cap'))
    longs = 12 if M.LEVEL_DROP[0] else 16  # the LOD keeps a lighter cage
    parts = []
    # dome: pole + rings from the top down to the tilted base line
    verts = [tuple(S.point(0, 90, DOME_OFF))]
    rings = []
    for frac in (0.8, 0.6, 0.4, 0.22, 0.08, 0.0):
        ring = []
        for k in range(longs):
            az = 360 * k / longs
            b = _hat_base_el(az)
            el = b + (90 - b) * frac
            ring.append(len(verts))
            verts.append(tuple(S.point(az, el, DOME_OFF)))
        rings.append(ring)
    faces = [(0, rings[0][(k + 1) % longs], rings[0][k]) for k in range(longs)]
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for k in range(longs):
            faces.append((a[k], b[k], b[(k + 1) % longs], a[(k + 1) % longs]))
    # a helmet is smoother than the hair under it: even out each vertex's distance from the head centre with its
    # neighbours (two passes), never letting it sink below where it was cast (so the hair never pokes through)
    c = Vector(H.c)
    dist = [(Vector(p) - c).length for p in verts]
    nbr = {i: set() for i in range(len(verts))}
    for fc in faces:
        for j in range(len(fc)):
            nbr[fc[j]].add(fc[j - 1])
            nbr[fc[j - 1]].add(fc[j])
    sm = dist[:]
    for _ in range(2):
        sm = [max(dist[i], 0.5 * sm[i] + 0.5 * sum(sm[j] for j in nbr[i]) / len(nbr[i])) for i in range(len(verts))]
    verts = [tuple(c + (Vector(p) - c).normalized() * sm[i]) for i, p in enumerate(verts)]
    faces = M._orient(verts, faces, center=Vector(H.c))
    dome = M.new_object('hat_dome', verts, faces, color=color, bone='head')
    M.crease_ring(dome, rings[-1], 0.8)
    M.finish(dome, levels=1, solidify=0.012)
    parts.append(dome)
    # brim: a strip out from the base line, a little wider at the front (the peak), dipping slightly
    brim_v = []
    brim_rings = []
    for step, (out, drop) in enumerate(((-0.02, 0.0), (0.45, 0.004), (1.0, 0.012))):
        ring = []
        for k in range(longs):
            az = 360 * k / longs
            b = _hat_base_el(az)
            p = S.point(az, b, DOME_OFF - 0.016)
            n = H.normal(az, b)
            n.z = 0
            n.normalize()
            front = max(0.0, math.cos(math.radians(az))) ** 3
            w = R.x * (0.075 + 0.19 * front)
            q = p + n * (w * out) + Vector((0, 0, -drop - 0.01 * front * out))
            ring.append(len(brim_v))
            brim_v.append(tuple(q))
        brim_rings.append(ring)
    bf = []
    for i in range(len(brim_rings) - 1):
        a, b = brim_rings[i], brim_rings[i + 1]
        for k in range(longs):
            bf.append((a[k], a[(k + 1) % longs], b[(k + 1) % longs], b[k]))
    brim = M.new_object('hat_brim', brim_v, bf, color=darken(color, 0.06), bone='head')
    M.crease_ring(brim, brim_rings[-1], 0.6)
    M.finish(brim, levels=1, solidify=0.011)
    parts.append(brim)
    # centre ridge, front to back over the crown
    rcol = ridge or darken(color, 0.12)
    pts = [S.point(0, el, DOME_OFF + 0.004) for el in (_hat_base_el(0) + 6, 52, 68, 82)] + \
          [S.point(180, el, DOME_OFF + 0.004) for el in (82, 66, 48, 30, _hat_base_el(180) + 8)]
    v, f, r = M.tube(pts, (R.x * 0.075, R.x * 0.045), sides=4, up=Vector((0, 0, 1)), roll=math.pi / 4)
    rg = M.new_object('hat_ridge', v, f, color=rcol, bone='head')
    M.finish(rg, levels=1, min_levels=1)
    parts.append(rg)
    if sticker:
        parts += _sakura_sticker(S, 74, 47, DOME_OFF + 0.002, sticker)
    if goggles:
        parts += _hat_goggles(S, DOME_OFF, goggles)
    return parts


def _sakura_sticker(S, az, el, off, col):
    """A five-petal sakura flower lying on the helmet's surface (the bio's sticker)."""
    H = S.H
    c = S.point(az, el, off)
    n = S.normal(az, el)
    t1 = n.cross(Vector((0, 0, 1))).normalized()
    t2 = n.cross(t1).normalized()
    parts = []
    r = H.R.x * 0.085
    for i in range(5):
        a = i / 5 * math.pi * 2 + math.pi / 2
        d = t1 * math.cos(a) + t2 * math.sin(a)
        pc = c + d * r * 1.05
        rot = Matrix((d, n.cross(d).normalized(), n)).transposed()  # right-handed (a mirror would turn the petals inside out)
        petal = [(r * 0.95 * math.cos(a2), r * 0.62 * math.sin(a2), 0.0) for a2 in [2 * math.pi * j / 7 for j in range(7)]]
        v, f = M.plate([(x, y) for x, y, _z in petal], r * 0.22, plane='xy')
        v = [tuple(pc + rot @ Vector(p)) for p in v]
        o = M.new_object(f'sakura{i}', v, f, color=col, bone='head')
        M.finish(o, levels=0)
        parts.append(o)
    v, f = M.sphere(c + n * r * 0.12, (r * 0.42, r * 0.42, r * 0.16))
    k = M.new_object('sakura_center', v, f, color='#fff1a8', bone='head')
    M.finish(k, levels=0)
    parts.append(k)
    return parts


def _hat_goggles(S, off, spec):
    """Safety goggles strapped round the dome just above the brim, the lenses on the front (never over the face)."""
    H = S.H
    frame, lens, strap = spec
    parts = []
    pts = []
    n_pts = 16 if M.LEVEL_DROP[0] else 28  # the LOD keeps a lighter strap
    for k in range(n_pts + 1):
        az = 360 * k / n_pts + 180  # the seam at the back
        el = _hat_base_el(az) + 7
        pts.append(S.point(az, el, off + 0.004))
    v, f, r = M.tube(pts, (H.R.x * 0.1, H.R.x * 0.035), sides=4, cap_start=False, cap_end=False, roll=math.pi / 4)
    s = M.new_object('goggle_strap', v, f, color=strap, bone='head')
    M.finish(s, levels=0)
    parts.append(s)
    for sgn in (1, -1):
        az = sgn * 23
        el = _hat_base_el(az) + 12
        c = S.point(az, el, off + 0.002)
        n = S.normal(az, el)
        v, f, r = M.tube([c - n * 0.008, c + n * 0.022], (H.R.x * 0.2, H.R.x * 0.165), sides=8)
        g = M.new_object(f'goggle{sgn}', v, f, color=frame, bone='head')
        M.finish(g, levels=1)
        parts.append(g)
        if M.LEVEL_DROP[0]:
            continue  # the LOD (medium / low quality): the frames read as goggles at that size, the lenses do not
        v, f, r = M.tube([c + n * 0.014, c + n * 0.026], (H.R.x * 0.155, H.R.x * 0.125), sides=8)
        le = M.new_object(f'goggle_lens{sgn}', v, f, color=lens, bone='head')
        M.finish(le, levels=1)
        parts.append(le)
    return parts


# ---------------------------------------------------------------------------
# Body helpers
# ---------------------------------------------------------------------------

def _part(ctx, name):
    for o in ctx['parts']:
        if o.get('part') == name:
            return o
    return None


def _ring(name, z0, z1, rx, ry, color, bones, sides=12, open_deg=0.0):
    """A band round the body between z0 and z1; open_deg leaves a gap that wide at the front (an open jacket)."""
    if open_deg <= 0:
        return outfit._ring_band(name, z0, z1, rx, ry, color, bones, sides=sides)
    g = math.radians(open_deg) / 2
    v, f, r = M.lathe([(1.0, 0.0), (1.0, z1 - z0)], segments=sides, close_top=False, close_bottom=False,
                      center=(0, 0, z0), arc=2 * math.pi - 2 * g, start=-math.pi / 2 + g, scale_xy=(rx, ry))
    o = M.new_object(name, v, f, color=color)
    M.weight_by_bones(o, bones, blend=0.05)
    M.finish(o, levels=0, solidify=0.006)
    return o


def _arm_ring(P, side, where, r, color, half=0.011, name='armring'):
    s = 1 if side == 'L' else -1
    sh = Vector((P['shoulder'].x * s, P['shoulder'].y, P['shoulder'].z))
    el = Vector((P['elbow'].x * s, P['elbow'].y, P['elbow'].z))
    wr = Vector((P['wrist'].x * s, P['wrist'].y, P['wrist'].z))
    a, b = (sh, el) if where < 0.5 else (el, wr)
    t = where * 2 if where < 0.5 else (where - 0.5) * 2
    p = a.lerp(b, t)
    d = (b - a).normalized()
    # a flat 12-sided band (no subdivision): crisp edges, and a sixth of the vertices a smoothed ring needs
    v, f, rr = M.tube([p - d * half, p + d * half], r, sides=8 if M.LEVEL_DROP[0] else 12)
    o = M.new_object(f'{name}_{side}', v, f, color=color)
    M.weight_by_bones(o, [(f'upper_arm_{side}', sh, el), (f'forearm_{side}', el, wr)])
    M.finish(o, levels=0)
    return o


def _trousers(P, slacks, boot, boot_top=0.05, hem=True):
    """Full-length trouser hems over boot shafts (the shoes are the feet)."""
    parts = []
    for side, s in (('L', 1), ('R', -1)):
        ankle = Vector((P['ankle'].x * s, P['ankle'].y, P['ankle'].z))
        r1 = P['shin_r']
        if hem:
            v, f, r = M.tube([ankle + Vector((0, 0, 0.075)), ankle + Vector((0, 0, 0.05)), ankle + Vector((0, 0, boot_top - 0.006))],
                             [r1 * 1.02, r1 * 1.12, r1 * 1.18], sides=8)
            o = M.new_object(f'trouserhem_{side}', v, f, color=slacks, bone=f'shin_{side}')
            M.finish(o, levels=1)
            parts.append(o)
        v, f, r = M.tube([ankle - Vector((0, 0, 0.03)), ankle + Vector((0, 0, 0.004)), ankle + Vector((0, 0, boot_top))],
                         [r1 * 1.16, r1 * 1.14, r1 * 1.16], sides=8)
        o = M.new_object(f'bootshaft_{side}', v, f, color=boot, bone=f'shin_{side}')
        M.finish(o, levels=1)
        parts.append(o)
    return parts


def _boots(P, upper, toe=None, sole='#2a2428'):
    """Work / rain boots: the shared rounded shoe with an optional toe cap colour and a crisp sole."""
    parts = body.shoes(P, upper, sole=sole)
    if toe:
        fs = P['foot_size']
        for o in parts:
            if o.get('part', '').startswith('shoe_'):
                s = 1 if o['part'].endswith('L') else -1
                c = Vector((P['foot'].x * s, P['foot'].y, P['foot'].z))
                M.set_color(o, upper, lambda co, _c=c: toe if co.y < _c.y - fs.y * 0.22 and co.z > _c.z - fs.z * 0.3 else upper)
    return parts


# ---------------------------------------------------------------------------
# Norika: navy staff blazer, white shirt, lime safety sash, lanyard whistle, white gloves, navy slacks, rain boots
# ---------------------------------------------------------------------------

def outfit_norika(ctx, P, pal):
    navy = pal['outfit']
    slacks = mix(navy, '#101830', 0.25)
    boot = pal.get('boot', '#2c3350')
    torso = _part(ctx, 'torso')
    zb, wz, zt = P['torso_bottom'], P['waist_z'], P['torso_top']
    hem_z = zb + 0.052
    v_bot = zt - 0.1
    tb = outfit._torso_bones(P)

    def col(co):
        return slacks if co.z < hem_z - 0.004 else navy
    M.set_color(torso, navy, col)
    bvh = outfit._torso_bvh(torso)
    parts = []
    # the white shirt in the blazer's V (a crisp panel), its collar points and two dark lapel edges
    parts.append(outfit._front_sheet('shirt_v', bvh, lambda u, t: ((u - 0.5) * 2 * (0.004 + 0.034 * (1 - t)), zt - 0.002 - t * (zt - 0.002 - v_bot)),
                                     SHIRT, tb, lift=0.0025, cols=4, rows=5))
    parts += outfit.shirt_collar(P, SHIRT)
    lapel = darken(navy, 0.3)

    def v_half(z):  # half width of the V at height z (the shirt panel's edge)
        return 0.004 + 0.034 * max(0.0, min(1.0, (z - v_bot) / (zt - 0.002 - v_bot)))
    for s in (1, -1):
        zs = [zt - 0.006 - (zt - 0.006 - v_bot) * k / 5 for k in range(6)]
        pts = [outfit._front_point(bvh, s * (v_half(z) + 0.005), z, 0.003) for z in zs]
        v, f, r = M.tube(pts, (0.007, 0.0028), sides=4, roll=math.pi / 4)
        o = M.new_object(f'lapel{s}', v, f, color=lapel)
        M.weight_by_bones(o, tb, blend=0.05)
        M.finish(o, levels=0)
        parts.append(o)
    # two buttons below the V
    for k, z in enumerate(() if M.LEVEL_DROP[0] else (v_bot - 0.03, v_bot - 0.07)):  # sub-pixel on the LOD
        p = outfit._front_point(bvh, 0.0, z, 0.003)
        v, f = M.sphere(p, (0.008, 0.004, 0.008))
        o = M.new_object(f'button{k}', v, f, color=darken(navy, 0.45), bone='spine' if z < (zb + zt) / 2 else 'chest')
        M.finish(o, levels=0)
        parts.append(o)
    # blazer hem: a short flared band over the slacks
    hx, hy = outfit._girth(torso, hem_z)
    parts.append(_ring('blazer_hem', hem_z - 0.012, hem_z + 0.012, hx * 1.07, hy * 1.1, mix(navy, '#0e1428', 0.12), tb, sides=14))
    # navy cuffs, white gloves (spec glove)
    for side in ('L', 'R'):
        parts.append(_arm_ring(P, side, 0.9, P['forearm_r'] * 1.22, darken(navy, 0.25), name='cuff'))
    parts += sash(P, torso, pal['accent'], pal.get('sashEdge', '#a8ecd2'), tb)
    parts += lanyard(P, torso, pal.get('lanyard', '#6b5aa6'), tb)
    parts += _trousers(P, slacks, boot, boot_top=0.06)
    return parts


def sash(P, torso, color, edge, bones, width=0.056, lift=0.0045, tilt=57.0):
    """The reflective safety sash over her right shoulder to her left hip (her v3 portrait): a band that hugs the torso
    in a plane tipped `tilt` degrees, lime with crisp mint edges."""
    bvh = outfit._torso_bvh(torso)
    a = math.radians(tilt)
    u = Vector((math.cos(a), 0, -math.sin(a)))       # along the band in the front view: her right shoulder -> left hip
    nrm = Vector((math.sin(a), 0, math.cos(a)))      # the band's plane normal (across the band)
    zt, zb = P['torso_top'], P['torso_bottom']
    c0 = Vector((0.006, 0.0, (zt + zb) / 2 + 0.035))
    n_pts = 24 if M.LEVEL_DROP[0] else 40
    rows = (-0.5, -0.33, 0.33, 0.5) if M.LEVEL_DROP[0] else (-0.5, -0.36, -0.33, 0.33, 0.36, 0.5)
    verts, grid = [], []
    for i in range(n_pts):
        t = 2 * math.pi * i / n_pts
        d = u * math.cos(t) + Vector((0, 1, 0)) * math.sin(t)
        hit, m, _i, _d = bvh.ray_cast(c0 + d * 0.6, -d)
        if hit is None:
            hit, m = c0 + d * 0.08, d
        m = m.normalized()
        w = (nrm - m * nrm.dot(m)).normalized()
        row = []
        for f in rows:
            row.append(len(verts))
            verts.append(tuple(hit + m * lift + w * (width * f)))
        grid.append(row)
    faces = []
    for i in range(n_pts):
        a_, b_ = grid[i], grid[(i + 1) % n_pts]
        for j in range(len(rows) - 1):
            faces.append((a_[j], a_[j + 1], b_[j + 1], b_[j]))
    faces = M._orient(verts, faces, center=c0)
    o = M.new_object('sash', verts, faces, color=color)

    def col(co):
        d = (Vector(co) - c0).dot(nrm)
        return edge if abs(d) > width * 0.345 else color
    M.set_color(o, color, col)
    M.weight_by_bones(o, bones, blend=0.05)
    M.finish(o, levels=0, solidify=0.004)
    return [o]


def lanyard(P, torso, color, bones):
    """A lanyard cord round the neck to a silver whistle on her chest."""
    bvh = outfit._torso_bvh(torso)
    zt = P['torso_top']
    tip = outfit._front_point(bvh, 0.016, zt - 0.115, 0.012)
    parts = []
    for s in (1, -1):
        top = Vector((s * 0.03, 0.006, zt + 0.004))
        mid = outfit._front_point(bvh, s * 0.03, zt - 0.04, 0.006)
        pts = M.smooth_path([top, mid, tip + Vector((0, 0, 0.012))], count=6)
        v, f, r = M.tube(pts, 0.0032, sides=4)
        o = M.new_object(f'lanyard{s}', v, f, color=color)
        M.weight_by_bones(o, bones, blend=0.05)
        M.finish(o, levels=0)
        parts.append(o)
    v, f = M.sphere(tip, (0.011, 0.009, 0.014))
    w = M.new_object('whistle', v, f, color='#cfd6df', bone='chest')
    M.finish(w, levels=1)
    parts.append(w)
    v, f = M.box(tip + Vector((0.011, -0.002, 0.004)), (0.012, 0.009, 0.007))
    w2 = M.new_object('whistle_mouth', v, f, color='#b9c1cc', bone='chest')
    M.finish(w2, levels=1)
    parts.append(w2)
    return parts


# ---------------------------------------------------------------------------
# Kogane: safety-yellow work jacket (reflective tape) open over a navy polo, navy cargo trousers, tool belt, work boots
# ---------------------------------------------------------------------------

def outfit_kogane(ctx, P, pal):
    jacket = pal['outfit']
    navy = pal['outfitShade']
    trousers = mix(navy, '#141b30', 0.2)
    torso = _part(ctx, 'torso')
    zb, wz, zt = P['torso_bottom'], P['waist_z'], P['torso_top']
    hem_z = zb + 0.066
    tb = outfit._torso_bones(P)

    def col(co):
        return trousers if co.z < hem_z - 0.004 else jacket
    M.set_color(torso, jacket, col)
    bvh = outfit._torso_bvh(torso)
    parts = []

    def gap(t):  # half width of the open front at fraction t from the collar to the hem
        return 0.032 + 0.01 * t
    # the navy polo in the open front, its collar, two buttons
    # (tucked in: it runs on below the jacket hem, under the tool belt, so the open front never shows a seam)
    tuck = hem_z - 0.034
    parts.append(outfit._front_sheet('polo', bvh, lambda u, t: ((u - 0.5) * 2 * gap(min(1.0, t * (zt - tuck) / (zt - hem_z))),
                                                                zt - 0.004 - t * (zt - 0.004 - tuck)),
                                     navy, tb, lift=0.0025, cols=2, rows=7))
    parts += outfit.shirt_collar(P, navy)
    for k, z in enumerate(() if M.LEVEL_DROP[0] else (zt - 0.04, zt - 0.068)):  # sub-pixel on the LOD
        p = outfit._front_point(bvh, 0.0, z, 0.005)
        v, f = M.sphere(p, (0.0055, 0.003, 0.0055))
        o = M.new_object(f'polo_button{k}', v, f, color='#e8ecf2', bone='chest')
        M.finish(o, levels=0)
        parts.append(o)
    # the jacket's front edges (a deeper yellow piping) and reflective tape bands round the body, open at the front
    edge = darken(jacket, 0.18)
    for s in (1, -1):
        zs = [zt - 0.004 - (zt - 0.004 - hem_z) * k / 6 for k in range(7)]
        pts = [outfit._front_point(bvh, s * (gap((zt - 0.004 - z) / (zt - 0.004 - hem_z)) + 0.003), z, 0.003) for z in zs]
        v, f, r = M.tube(pts, (0.0045, 0.003), sides=4, roll=math.pi / 4)
        o = M.new_object(f'jacket_edge{s}', v, f, color=edge)
        M.weight_by_bones(o, tb, blend=0.05)
        M.finish(o, levels=0)
        parts.append(o)
    for name, z in (('tape_chest', zt - 0.105), ('tape_waist', wz - 0.012)):
        gx, gy = outfit._girth(torso, z)
        parts.append(_ring(name, z - 0.011, z + 0.011, gx * 1.045, gy * 1.07, TAPE, tb, sides=14 if M.LEVEL_DROP[0] else 22, open_deg=34))
    hx, hy = outfit._girth(torso, hem_z)
    parts.append(_ring('jacket_hem', hem_z - 0.012, hem_z + 0.01, hx * 1.07, hy * 1.1, darken(jacket, 0.12), tb, sides=14 if M.LEVEL_DROP[0] else 22, open_deg=30))
    # sleeves: tape rings on the upper arm and the forearm, navy cuffs
    for side in ('L', 'R'):
        parts.append(_arm_ring(P, side, 0.3, P['upper_arm_r'] * 1.13, TAPE, half=0.0105, name='tape_arm'))
        parts.append(_arm_ring(P, side, 0.74, P['forearm_r'] * 1.15, TAPE, half=0.0105, name='tape_fore'))
        parts.append(_arm_ring(P, side, 0.92, P['forearm_r'] * 1.22, navy, name='cuff'))
    parts += tool_belt(P, torso, tb)
    # cargo pockets on the outer thighs
    for side, s in (('L', 1), ('R', -1)):
        hip = Vector((P['hip'].x * s, P['hip'].y, P['hip'].z))
        knee = Vector((P['knee'].x * s, P['knee'].y, P['knee'].z))
        c = hip.lerp(knee, 0.5) + Vector((s * P['thigh_r'] * 0.92, -0.004, 0))
        v, f = M.box(c, (0.02, 0.052, 0.062))
        o = M.new_object(f'cargo_{side}', v, f, color=darken(trousers, 0.18), bone=f'thigh_{side}')
        M.finish(o, levels=1)
        parts.append(o)
    parts += _trousers(P, trousers, pal.get('boot', '#5b4536'), boot_top=0.055)
    return parts


def tool_belt(P, torso, bones):
    """A brown leather tool belt on the hips under the jacket hem: a steel buckle and a pouch on each side."""
    zb = P['torso_bottom']
    z = zb + 0.034
    gx, gy = outfit._girth(torso, z)
    leather = '#8a5a34'
    parts = [outfit._ring_band('toolbelt', z - 0.013, z + 0.011, gx * 1.09, gy * 1.12, leather, bones, sides=14)]
    v, f = M.box((0, -gy * 1.12 - 0.004, z - 0.001), (0.03, 0.01, 0.024))
    b = M.new_object('belt_buckle', v, f, color=STEEL, bone='hips')
    M.finish(b, levels=1)
    parts.append(b)
    for s in (1, -1):
        c = Vector((s * (gx * 1.06 + 0.012), -0.012, z - 0.03))
        v, f = M.box(c, (0.034, 0.052, 0.058))
        p = M.new_object(f'pouch{s}', v, f, color='#b07a45', bone='hips')
        M.finish(p, levels=1)
        parts.append(p)
        v, f = M.box(c + Vector((s * 0.004, -0.002, 0.026)), (0.036, 0.055, 0.014))
        fl = M.new_object(f'pouch_flap{s}', v, f, color=leather, bone='hips')
        M.finish(fl, levels=1)
        parts.append(fl)
    # a screwdriver handle peeking out of her left pouch
    c = Vector((gx * 1.06 + 0.012, -0.022, z + 0.012))
    v, f, r = M.tube([c, c + Vector((0.004, -0.004, 0.04))], 0.0075, sides=6)
    sd = M.new_object('screwdriver', v, f, color='#e2533f', bone='hips')
    M.finish(sd, levels=1)
    parts.append(sd)
    return parts


# ---------------------------------------------------------------------------
# Props, modelled in the idle hold and mapped back to the rest pose
# ---------------------------------------------------------------------------

def _R(e):
    return Euler((D(e[0]), D(e[1]), D(e[2])), 'ZXY').to_matrix()


class HeldChain:
    """Maps points between the rest pose and a pose of one arm (with the spine and chest), the way anim.Poser keys
    them: world-axis rotations, a bone's world rotation = its parents' then its own, each about its rest head."""

    def __init__(self, P, pose, side='R'):
        s = 1 if side == 'L' else -1
        zb, zt = P['torso_bottom'], P['torso_top']
        heads = [('spine', Vector((0, 0, zb + 0.06))), ('chest', Vector((0, 0, (zb + zt) / 2))),
                 (f'shoulder_{side}', Vector((0, 0, P['shoulder_z']))),
                 (f'upper_arm_{side}', Vector((P['shoulder'].x * s, P['shoulder'].y, P['shoulder'].z))),
                 (f'forearm_{side}', Vector((P['elbow'].x * s, P['elbow'].y, P['elbow'].z))),
                 (f'hand_{side}', Vector((P['wrist'].x * s, P['wrist'].y, P['wrist'].z)))]
        self.chain = [(head, _R(pose[name])) for name, head in heads if name in pose]
        self.hand = Vector((P['hand'].x * s, P['hand'].y, P['hand'].z))
        self.R = Matrix.Identity(3)
        for _h, R in self.chain:
            self.R = self.R @ R

    def to_held(self, p):
        p = Vector(p)
        for head, R in reversed(self.chain):
            p = head + R @ (p - head)
        return p

    def to_rest(self, p):
        p = Vector(p)
        for head, R in self.chain:
            p = head + R.inverted() @ (p - head)
        return p

    def place(self, objs):
        """Moves objects modelled in the held pose into the rest pose (and onto hand_R / hand_L, rigid)."""
        for o in objs:
            for v in o.data.vertices:
                v.co = self.to_rest(v.co)
            o.data.update()
        return objs


PADDLE_TILT = 30.0  # degrees the paddle leans back from upright (its face toward the camera and the light)


def stop_paddle(ctx, chain, bone='hand_R'):
    """Norika's STOP / SLOW paddle: a round red face with a white rim (her portrait), a lime back (SLOW), on a white
    handle in her right hand. Modelled in the idle hold, its face to the front and the whole paddle tipped back 30
    degrees, so the face looks up toward the battle camera and catches the game's overhead light (held upright, the
    red read dark maroon in a battle)."""
    pal = ctx['pal']
    grip = chain.to_held(chain.hand)
    # (leaned out to her right as well, so the leaned-back face stays clear of her hat and hair)
    up = Vector((-0.36, math.sin(D(PADDLE_TILT)), math.cos(D(PADDLE_TILT)))).normalized()
    face_n = Vector((0.0, -math.cos(D(PADDLE_TILT)), math.sin(D(PADDLE_TILT))))
    face_n = (face_n - up * face_n.dot(up)).normalized()
    side = up.cross(face_n).normalized()
    L, r = 0.12, 0.07
    parts = []
    v, f, rr = M.tube([grip - up * 0.034, grip + up * (L + 0.01)], 0.0085, sides=8)
    h = M.new_object('paddle_handle', v, f, color=WHITE, bone=bone)
    M.finish(h, levels=1)
    parts.append(h)
    c = grip + up * (L + r)
    th = 0.011
    v, f, rr = M.lathe([(r * 0.97, -th / 2), (r, -th / 4), (r, th / 4), (r * 0.97, th / 2)], segments=20)
    # right-handed (side x up = face): a mirrored basis turns the disc inside out, and the game then draws its dark
    # outline hull over the red face (Cycles shades both sides, so a render does not show it)
    basis = Matrix((side, up, face_n)).transposed()  # local x across, y up the handle, z out of the face
    # lathe is about local Z: map local (x, y, z) -> c + side*x + up*y + face_n*z
    v = [tuple(c + basis @ Vector(p)) for p in v]
    disc = M.new_object('paddle_face', v, f, color=pal['weapon'], bone=bone)
    M.set_color(disc, pal['weapon'], lambda co, _c=c, _n=face_n: pal['weapon'] if (Vector(co) - _c).dot(_n) > 0 else pal.get('slow', '#d8ef3a'))
    M.finish(disc, levels=1)
    parts.append(disc)
    ring = []
    n_rim = 20 if M.LEVEL_DROP[0] else 28
    for i in range(n_rim + 1):
        a = 2 * math.pi * i / n_rim
        ring.append(c + side * math.cos(a) * r * 0.97 + up * math.sin(a) * r * 0.97)
    v, f, rr = M.tube(ring, (0.0075, 0.0075), sides=4 if M.LEVEL_DROP[0] else 6, cap_start=False, cap_end=False, roll=math.pi / 4)
    rim = M.new_object('paddle_rim', v, f, color=WHITE, bone=bone)
    M.finish(rim, levels=0)
    parts.append(rim)
    ctx['prop_axes'] = (up, face_n)
    return chain.place(parts)


def big_wrench(ctx, chain, bone='hand_R'):
    """Kogane's big open-end wrench (about 0.3 of her height), resting on her right shoulder in idle: a steel handle
    with an open jaw at the far end and a ring at the near end."""
    grip = chain.to_held(chain.hand)
    ax = Vector(ctx['look'].get('wrenchAxis', (-0.42, 0.62, 0.66))).normalized()
    flat = ax.cross(Vector((1, 0, 0))).normalized()   # the jaw's flat faces are across this
    across = flat.cross(ax).normalized()
    parts = []
    near, far = 0.075, 0.235
    v, f, rr = M.tube([grip - ax * near, grip - ax * 0.02, grip + ax * 0.1, grip + ax * far],
                      [(0.018, 0.0095), (0.019, 0.01), (0.019, 0.01), (0.023, 0.0105)], sides=4, up=flat, roll=math.pi / 4)
    hnd = M.new_object('wrench_handle', v, f, color=STEEL, bone=bone)
    M.finish(hnd, levels=1)
    parts.append(hnd)
    # open jaw: a thick C at the far end (a bent bar), the opening pointing along the handle
    jc = grip + ax * (far + 0.036)
    gap = D(76)
    arc = [jc + (ax * math.sin(a) + across * math.cos(a)) * 0.037
           for a in [math.pi / 2 + gap / 2 + (2 * math.pi - gap) * k / 10 for k in range(11)]]
    v, f, rr = M.tube(arc, (0.017, 0.012), sides=4, up=flat, roll=math.pi / 4)
    jaw = M.new_object('wrench_jaw', v, f, color=STEEL, bone=bone)
    M.finish(jaw, levels=1)
    parts.append(jaw)
    # box ring at the near end
    rc = grip - ax * (near + 0.02)
    ring = [rc + (ax * math.sin(a) + across * math.cos(a)) * 0.023 for a in [2 * math.pi * k / 10 for k in range(11)]]
    v, f, rr = M.tube(ring, (0.011, 0.0095), sides=4, up=flat, roll=math.pi / 4, cap_start=False, cap_end=False)
    rg = M.new_object('wrench_ring', v, f, color=STEEL, bone=bone)
    M.finish(rg, levels=1)
    parts.append(rg)
    # a darker grip band where her hand is
    v, f, rr = M.tube([grip - ax * 0.026, grip + ax * 0.03], (0.019, 0.011), sides=4, up=flat, roll=math.pi / 4)
    gb = M.new_object('wrench_grip', v, f, color=STEEL_DARK, bone=bone)
    M.finish(gb, levels=0)
    parts.append(gb)
    ctx['prop_axes'] = (ax, flat)
    return chain.place(parts)


# ---------------------------------------------------------------------------
# Clips (24 fps keys, world-axis degrees as in anim.py; the prop arm keeps its grip)
# ---------------------------------------------------------------------------

def hand_keep(R_total, pose, side='R'):
    """The hand_<side> rotation (degrees, ZXY) that keeps the hand's world orientation at R_total under `pose`."""
    R = Matrix.Identity(3)
    for b in ('spine', 'chest', f'shoulder_{side}', f'upper_arm_{side}', f'forearm_{side}'):
        if b in pose:
            R = R @ _R(pose[b])
    e = (R.inverted() @ R_total).to_euler('ZXY')
    return (math.degrees(e.x), math.degrees(e.y), math.degrees(e.z))


REST_DIRS = {}  # bone -> rest direction (head to tail), filled by arm_dirs_from(P)


def arm_dirs_from(P):
    for side, s in (('L', 1), ('R', -1)):
        sh = Vector((P['shoulder'].x * s, P['shoulder'].y, P['shoulder'].z))
        el = Vector((P['elbow'].x * s, P['elbow'].y, P['elbow'].z))
        wr = Vector((P['wrist'].x * s, P['wrist'].y, P['wrist'].z))
        REST_DIRS[f'upper_arm_{side}'] = (el - sh).normalized()
        REST_DIRS[f'forearm_{side}'] = (wr - el).normalized()


def _deg(R):
    e = R.to_euler('ZXY')
    return (math.degrees(e.x), math.degrees(e.y), math.degrees(e.z))


def arm_to(pose, side, upper, fore, roll_u=0.0, roll_f=0.0):
    """The upper arm and forearm keys (anim.Poser degrees) that point them along the world directions `upper` and
    `fore` (a swing from the rest pose under the pose's spine / chest, then `roll_u` / `roll_f` degrees about each
    bone's own axis). Raising an arm with Euler angles alone is a trap here: Poser applies Z, X then Y, so a Y turn on
    a raised arm swings it across the face. For the prop arm the clip key picks the rolls (StaffClips.key)."""
    Rp = Matrix.Identity(3)
    for b in ('spine', 'chest', f'shoulder_{side}'):
        if b in pose:
            Rp = Rp @ _R(pose[b])
    du, df = REST_DIRS[f'upper_arm_{side}'], REST_DIRS[f'forearm_{side}']
    u = Rp.inverted() @ Vector(upper).normalized()
    Ru = Matrix.Rotation(D(roll_u), 3, u) @ du.rotation_difference(u).to_matrix()
    fl = (Rp @ Ru).inverted() @ Vector(fore).normalized()
    Rf = Matrix.Rotation(D(roll_f), 3, fl) @ df.rotation_difference(fl).to_matrix()
    out = dict(pose)
    out[f'upper_arm_{side}'] = _deg(Ru)
    out[f'forearm_{side}'] = _deg(Rf)
    if side == 'R':
        out['_reach_R'] = (tuple(upper), tuple(fore))
    return out


def _frame(axis, sec):
    """An orthonormal frame (columns) from a prop's long axis and a second direction (its face or flat normal)."""
    x = Vector(axis).normalized()
    z = x.cross(Vector(sec)).normalized()
    y = z.cross(x)
    return Matrix((x, y, z)).transposed()


def _with_grip(pose, R_total, turn=None, side='R'):
    """pose + the hand rotation that keeps the prop's idle orientation; `turn` (a world rotation matrix) turns it."""
    p = dict(pose)
    R = R_total if turn is None else turn @ R_total
    p[f'hand_{side}'] = hand_keep(R, p, side)
    return p


def _merge(*poses):
    """anim.merge that carries the prop arm's reach marker ('_reach_R') through."""
    reach = None
    plain = []
    for p in poses:
        p = dict(p)
        reach = p.pop('_reach_R', reach)
        plain.append(p)
    out = anim.merge(*plain)
    if reach is not None:
        out['_reach_R'] = reach
    return out


class StaffClips:
    """The staff's clips. Every key passes the prop arm's pose; the hand then turns so the prop points where the key
    asks (`aim`: its long axis and second direction in world space; default: as in the idle hold), and the build
    reports any wrist turn past 100 degrees (it would read as a broken wrist)."""

    def __init__(self, arm_obj, ctx, loc_scale, hold, kind):
        self.poser = anim.Poser(arm_obj, loc_scale=loc_scale)
        self.poser.chin = float(ctx['look'].get('chinUp', 0) or 0)
        self.hold = hold
        self.R_hold = HeldChain(ctx['P'], hold, 'R').R
        self.F_hold = _frame(*ctx['prop_axes'])
        arm_dirs_from(ctx['P'])
        self.kind = kind
        names = {b.name for b in arm_obj.data.bones}
        self.tails = [b for b in ('tail_L', 'tail_R', 'hair_back') if b in names]
        self.expr = ctx['look'].get('expression', 'smile')
        self.max_twist = 0.0
        # how far a raised prop leans back in cheer / victory: the paddle keeps its face toward the camera (as in idle)
        self.lean = math.sin(D(PADDLE_TILT)) if kind == 'sign' else 0.1

    def key(self, f, pose, loc=None, scale=None, aim=None):
        """aim: None keeps the idle orientation; (axis, second) points the prop; ('wrist', deg) leaves the grip as
        in the hold and flexes the wrist `deg` about the world X axis (a hammer blow: + tips the head down / forward)."""
        pose = dict(pose)
        reach = pose.pop('_reach_R', None)
        p = _merge(pose)
        if reach is not None:
            # the prop arm was posed by direction: roll the upper arm and forearm about their own axes so the hand needs
            # the least turn to hold the prop as asked (a natural grip, never a wrung wrist)
            best = None
            for ru in range(-180, 180, 10):
                for rf in range(-90, 91, 15):
                    q = arm_to(p, 'R', reach[0], reach[1], ru, rf)
                    q.pop('_reach_R')
                    q = self._grip(q, aim)
                    t = _R(q['hand_R']).to_quaternion().angle
                    if best is None or t < best[0]:
                        best = (t, q)
            p = best[1]
        else:
            p = self._grip(p, aim)
        twist = math.degrees(_R(p['hand_R']).to_quaternion().angle)
        self.max_twist = max(self.max_twist, twist)
        if twist > 100:
            print(f'[staff] {self.poser.action.name} frame {f}: wrist turn {twist:.0f} deg')
        self.poser.key(f, p, loc=loc, scale=scale)

    def _grip(self, p, aim):
        if aim is not None and aim[0] == 'wrist':
            R_arm = Matrix.Identity(3)
            for b in ('spine', 'chest', 'shoulder_R', 'upper_arm_R', 'forearm_R'):
                if b in p:
                    R_arm = R_arm @ _R(p[b])
            return _with_grip(p, R_arm, _R((aim[1], 0, 0)))
        turn = None if aim is None else _frame(*aim) @ self.F_hold.transposed()
        return _with_grip(p, self.R_hold, turn)

    def build(self):
        self.idle()
        self.walk()
        getattr(self, f'attack_{self.kind}')()
        self.cheer()
        self.victory()
        self.hurt()
        self.pickup()
        print(f'[staff] largest wrist turn {self.max_twist:.0f} deg')

    # the free (left) arm hangs a little out from the body, elbow soft
    FREE = {'upper_arm_L': (-4, -7, 0), 'forearm_L': (-12, 0, 0)}

    def idle(self):
        P = self.poser
        P.begin('idle', loop=True)
        L = 72
        cheerful = self.expr == 'cheerful'
        for i, f in enumerate((0, L // 4, L // 2, 3 * L // 4, L)):
            ph = i / 4 * math.pi * 2
            s = math.sin(ph)
            pose = _merge(self.hold, self.FREE, {
                'chest': (1.2 * s, 0, 0), 'spine': (0, 0, (3 if cheerful else 2) * s),
                'head': (1.5 * math.sin(ph + 1), 0, (4 if cheerful else 2.5) * math.sin(ph * 0.5)),
                'upper_arm_L': (2 * s, -1.5 * s, 0), 'forearm_L': (-3 * s, 0, 0),
                'upper_arm_R': (1.5 * math.sin(ph + 0.6), 0, 0),
            }, anim._tail_sway(self.tails, 3, ph))
            loc = {'hips': (0, 0, (0.006 if cheerful else 0.004) * s), 'halo': (0, 0, 0.012 * math.sin(ph + 0.8))}
            self.key(f, pose, loc=loc, scale={'chest': 1.0 + 0.012 * s})
        P.end(L)

    def walk(self):
        P = self.poser
        P.begin('walk', loop=True)
        L = 20
        for i, f in enumerate((0, 5, 10, 15, 20)):
            ph = i / 4 * math.pi * 2
            s, c = math.sin(ph), math.cos(ph)
            pose = _merge(self.hold, {
                'thigh_L': (-30 * s, 0, 0), 'thigh_R': (30 * s, 0, 0),
                'shin_L': (max(0, 36 * -c), 0, 0), 'shin_R': (max(0, 36 * c), 0, 0),
                'upper_arm_L': (24 * s, -6, 0), 'forearm_L': (-14 - 8 * max(0, -s), 0, 0),
                'upper_arm_R': (-4 * s, 0, 0),
                'chest': (2, 0, -3 * s), 'head': (-2, 0, 2 * s), 'spine': (0, 0, 3 * s),
            }, anim._tail_sway(self.tails, 5, ph + 1))
            loc = {'hips': (0, 0, 0.01 * abs(c)), 'halo': (0, 0, 0.006 * abs(c))}
            self.key(f, pose, loc=loc)
        P.end(L)

    def attack_sign(self):
        """Norika: the paddle drawn in to her shoulder, then pushed out ahead and to her right, face first, her left
        palm out: STOP. The paddle stays upright and facing the road; her face stays up for the battle camera."""
        P = self.poser
        P.begin('attack_sign', loop=False)
        t = D(PADDLE_TILT)
        up_face = ((0, math.sin(t), math.cos(t)), (0, -math.cos(t), math.sin(t)))  # leaned back like the idle hold
        frames = [0, 6, 10, 15, 22]
        poses = [
            _merge(self.hold, self.FREE),
            {'upper_arm_R': (-22, 26, 18), 'forearm_R': (-132, -26, 0), 'chest': (-3, 0, -12), 'spine': (0, 0, -5),
             'head': (-3, 0, -5), 'upper_arm_L': (-25, -18, 0), 'forearm_L': (-60, 0, 0), 'thigh_R': (6, 0, 0)},
            arm_to(arm_to({'chest': (2, 0, 8), 'spine': (0, 0, 4), 'head': (-2, 0, 4), 'thigh_L': (-16, 0, 0), 'shin_L': (12, 0, 0),
                           'thigh_R': (8, 0, 0)}, 'R', (-0.5, -0.83, 0.24), (-0.42, -0.76, 0.5)),
                   'L', (0.38, -0.88, 0.0), (0.22, -0.62, 0.75)),
            arm_to(arm_to({'chest': (2, 0, 7), 'spine': (0, 0, 3), 'head': (-2, 0, 4), 'thigh_L': (-12, 0, 0), 'shin_L': (9, 0, 0),
                           'thigh_R': (6, 0, 0)}, 'R', (-0.52, -0.8, 0.2), (-0.44, -0.74, 0.5)),
                   'L', (0.38, -0.86, -0.04), (0.22, -0.62, 0.74)),
            _merge(self.hold, self.FREE),
        ]
        aims = [None, up_face, up_face, up_face, None]
        locs = [{'hips': (0, 0, 0)}, {'hips': (0, 0.012, 0)}, {'hips': (0, -0.035, -0.006)}, {'hips': (0, -0.03, -0.005)}, {'hips': (0, 0, 0)}]
        for f, p, a, l in zip(frames, poses, aims, locs):
            self.key(f, _merge(p, anim._tail_sway(self.tails, 3)), loc=l, aim=a)
        P.end(frames[-1])

    def attack_wrench(self):
        """Kogane: the wrench swung up behind her head, then brought down at the road ahead of her (a smash), head up."""
        P = self.poser
        P.begin('attack_wrench', loop=False)
        frames = [0, 8, 11, 15, 24]
        poses = [
            _merge(self.hold, self.FREE),
            arm_to({'upper_arm_L': (-50, -24, 0), 'forearm_L': (-40, 0, 0), 'chest': (-6, 0, -12), 'head': (-4, 0, -4),
                    'spine': (-3, 0, -5)}, 'R', (-0.55, 0.12, 0.83), (-0.32, 0.42, 0.85)),
            {'upper_arm_R': (-30, 8, 0), 'forearm_R': (-6, 0, 0), 'upper_arm_L': (-24, -16, 0), 'forearm_L': (-24, 0, 0),
             'chest': (2, 0, 8), 'head': (-7, 0, 2), 'spine': (1, 0, 4), 'thigh_L': (-22, 0, 0), 'shin_L': (22, 0, 0),
             'thigh_R': (-6, 0, 0), 'shin_R': (12, 0, 0)},
            {'upper_arm_R': (-26, 8, 0), 'forearm_R': (-6, 0, 0), 'upper_arm_L': (-22, -16, 0), 'forearm_L': (-24, 0, 0),
             'chest': (2, 0, 6), 'head': (-7, 0, 2), 'spine': (1, 0, 3), 'thigh_L': (-16, 0, 0), 'shin_L': (16, 0, 0),
             'thigh_R': (-4, 0, 0), 'shin_R': (9, 0, 0)},
            _merge(self.hold, self.FREE),
        ]
        # wound up: the grip as held, the wrench cocked up behind her head; the blow: the wrist flexes the head down
        aims = [None, ((-0.15, 0.7, 0.7), (-1, 0, 0)), ('wrist', 55), ('wrist', 60), None]
        locs = [{'hips': (0, 0, 0)}, {'hips': (0, 0.012, 0.008)}, {'hips': (0, -0.026, -0.016)}, {'hips': (0, -0.022, -0.013)}, {'hips': (0, 0, 0)}]
        for f, p, a, l in zip(frames, poses, aims, locs):
            self.key(f, _merge(p, anim._tail_sway(self.tails, 3)), loc=l, aim=a)
        P.end(frames[-1])

    def cheer(self):
        """The prop held high out to her right (clear of her face) and waved, her free arm up, a little hop."""
        P = self.poser
        P.begin('cheer', loop=True)
        L = 20
        sec = self.F_hold.col[1]
        for i, f in enumerate((0, 5, 10, 15, 20)):
            ph = i / 4 * math.pi * 2
            s = math.sin(ph)
            hop = max(0.0, s)
            pose = _merge({
                'head': (-4, 0, 6 * s), 'chest': (-3, 0, 0),
                'thigh_L': (-22 * hop, 0, 0), 'thigh_R': (-12 * hop, 0, 0), 'shin_L': (30 * hop, 0, 0), 'shin_R': (20 * hop, 0, 0),
            }, anim._tail_sway(self.tails, 7, ph))
            pose = arm_to(pose, 'R', (-0.62, -0.12 - 0.08 * s, 0.77), (-0.4, -0.1, 0.91))
            pose = arm_to(pose, 'L', (0.6, -0.14, 0.79 + 0.08 * s), (0.42, -0.16, 0.89))
            loc = {'root': (0, 0, 0.05 * hop), 'halo': (0, 0, 0.02 * hop)}
            wave = _R((0, 18 * s, 0))
            self.key(f, pose, loc=loc, aim=(wave @ Vector((-0.25, self.lean, 0.96)), wave @ sec))
        P.end(L)

    def victory(self):
        P = self.poser
        P.begin('victory', loop=True)
        L = 48
        sec = self.F_hold.col[1]
        # keys at quarter phases (at 0, pi and 2 pi every sine is 0: the pose would hold still): a proud bob and sway
        for i, f in enumerate((0, L // 4, L // 2, 3 * L // 4, L)):
            ph = i / 4 * math.pi * 2
            pose = _merge({
                'head': (-6, 0, 8 + 4 * math.sin(ph)), 'chest': (-5 + 1.5 * math.sin(ph), 0, 5), 'spine': (0, 3, 2 * math.sin(ph)),
                'thigh_L': (-8, 0, 8), 'shin_L': (12, 0, 0),
            }, anim._tail_sway(self.tails, 4, ph))
            pose = arm_to(pose, 'R', (-0.6, -0.12 + 0.08 * math.sin(ph), 0.79), (-0.36, -0.1, 0.93))
            pose = arm_to(pose, 'L', (0.32, -0.3, -0.9), (-0.1, -0.86, 0.5))
            loc = {'hips': (0, 0, 0.008 * math.sin(ph)), 'halo': (0, 0, 0.02 + 0.01 * math.sin(ph))}
            self.key(f, pose, loc=loc, aim=((-0.3, self.lean - 0.05, 0.95), sec))
        P.end(L)

    def hurt(self):
        """A dizzy flinch that keeps the face up for the battle camera (a small bow, knees giving, arms in, the head
        and body swaying side to side: keys at quarter phases, so the sines move)."""
        P = self.poser
        P.begin('hurt', loop=True)
        L = 36
        for i, f in enumerate((0, L // 4, L // 2, 3 * L // 4, L)):
            ph = i / 4 * math.pi * 2
            pose = _merge(self.hold, {
                'head': (-8, 7 * math.sin(ph), 6 * math.sin(ph)), 'chest': (2, 2 * math.sin(ph), 0), 'spine': (1, 0, 4 * math.sin(ph)),
                'upper_arm_L': (-18, -4, 0), 'forearm_L': (-30, 0, 0), 'upper_arm_R': (10, 0, 0),
                'thigh_L': (-8, 0, 0), 'thigh_R': (-8, 0, 0), 'shin_L': (12, 0, 0), 'shin_R': (12, 0, 0),
            }, anim._tail_sway(self.tails, 2, ph))
            loc = {'hips': (0, 0, -0.016), 'halo': (0, 0, -0.03)}
            self.key(f, pose, loc=loc)
        P.end(L)

    def pickup(self):
        P = self.poser
        P.begin('pickup', loop=True)
        L = 16
        for i, f in enumerate((0, 4, 8, 12, 16)):
            ph = i / 4 * math.pi * 2
            s = math.sin(ph)
            pose = _merge(self.hold, {
                'thigh_L': (-24 + 26 * s, 0, 0), 'thigh_R': (-24 - 26 * s, 0, 0), 'shin_L': (34 + 8 * s, 0, 0), 'shin_R': (34 - 8 * s, 0, 0),
                'upper_arm_L': (-60 + 25 * s, -30, 0), 'forearm_L': (-40, 0, 0),
                'head': (-4, 0, 8 * s), 'chest': (-5, 0, 0), 'spine': (0, 8 * s, 5 * s),
            }, anim._tail_sway(self.tails, 8, ph))
            loc = {'root': (0.008 * s, 0, 0.0), 'halo': (0.008 * s, 0, 0.01)}
            self.key(f, pose, loc=loc)
        P.end(L)


def continuous_quaternions(action):
    """Makes every bone's rotation keys sign-continuous (q and -q are the same turn, but the GLB's cubic-spline
    interpolation runs component by component: between a key and its neighbour's opposite sign it swings through a
    near-zero quaternion, a one-frame flip of the limb). anim.Poser converts each key on its own, so neighbours can
    come out with opposite signs; here each key takes the sign closer to the key before it."""
    groups = {}
    for fc in action.fcurves:
        if fc.data_path.endswith('rotation_quaternion'):
            groups.setdefault(fc.data_path, [None] * 4)[fc.array_index] = fc
    flips = 0
    for fcs in groups.values():
        if None in fcs or len({len(fc.keyframe_points) for fc in fcs}) != 1:
            continue
        prev = None
        for k in range(len(fcs[0].keyframe_points)):
            q = [fc.keyframe_points[k].co[1] for fc in fcs]
            if prev is not None and sum(a * b for a, b in zip(q, prev)) < 0:
                q = [-x for x in q]
                for fc, x in zip(fcs, q):
                    fc.keyframe_points[k].co[1] = x
                flips += 1
            prev = q
        for fc in fcs:
            fc.update()
    return flips


def fix_glb_quaternion_signs(path):
    """The same continuity on the exported file: the glTF exporter writes each key as the bone's rest rotation times its
    pose, and near a 180-degree rest (the legs, the tails) neighbouring keys come out with opposite signs. three.js
    interpolates cubic-spline rotations component by component, so between such keys the bone swings through a
    near-zero quaternion: a one-frame flip of the limb (up to 150 degrees in the walk). Each rotation key whose value
    points away from the key before it is negated with both its tangents (the same turn, the same curve).
    Returns the number of keys flipped."""
    import struct
    from .export import read_glb, write_glb
    js, bin_chunk = read_glb(path)
    data = bytearray(bin_chunk)
    flips = 0
    for anim_ in js.get('animations', []):
        for ch in anim_['channels']:
            if ch['target'].get('path') != 'rotation':
                continue
            s = anim_['samplers'][ch['sampler']]
            if s.get('interpolation') != 'CUBICSPLINE':
                continue
            acc = js['accessors'][s['output']]
            if acc['componentType'] != 5126 or acc['type'] != 'VEC4':
                continue
            bv = js['bufferViews'][acc['bufferView']]
            off = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
            stride = bv.get('byteStride', 16)
            vals = [list(struct.unpack_from('<4f', data, off + i * stride)) for i in range(acc['count'])]
            keys = acc['count'] // 3
            for k in range(1, keys):
                cur, prev = vals[3 * k + 1], vals[3 * k - 2]
                if sum(a * b for a, b in zip(cur, prev)) < 0:
                    for j in range(3 * k, 3 * k + 3):
                        vals[j] = [-x for x in vals[j]]
                    flips += 1
            # the exporter's tangents do not always follow the sign it gave the value (a 48/s tangent on a key whose
            # neighbours barely differ): every rotation key gets Catmull-Rom tangents from the sign-continuous values,
            # wrapping round for the looping clips (all but the one-shot attacks), flat at a one-shot's ends
            tin = js['accessors'][s['input']]
            tbv = js['bufferViews'][tin['bufferView']]
            times = list(struct.unpack_from(f'<{keys}f', data, tbv.get('byteOffset', 0) + tin.get('byteOffset', 0)))
            p = [vals[3 * k + 1] for k in range(keys)]
            loop = not anim_.get('name', '').startswith('attack') and keys > 2

            def aligned(q, ref):
                return q if sum(a * b for a, b in zip(q, ref)) >= 0 else [-x for x in q]
            for k in range(keys):
                if 0 < k < keys - 1:
                    a, b, dt = p[k - 1], p[k + 1], times[k + 1] - times[k - 1]
                elif loop:
                    # the first and the last key are the same pose: their neighbours across the loop
                    a = aligned(p[keys - 2], p[k])
                    b = aligned(p[1], p[k])
                    dt = (times[1] - times[0]) + (times[keys - 1] - times[keys - 2])
                else:
                    a = b = p[k]
                    dt = 1.0
                m = [(b[c] - a[c]) / dt if dt > 1e-9 else 0.0 for c in range(4)]
                vals[3 * k] = m
                vals[3 * k + 2] = list(m)
            for i, v in enumerate(vals):
                struct.pack_into('<4f', data, off + i * stride, *v)
            if 'min' in acc:
                acc['min'] = [min(v[c] for v in vals) for c in range(4)]
                acc['max'] = [max(v[c] for v in vals) for c in range(4)]
    write_glb(path, js, bytes(data))
    return flips


def build_clips(arm_obj, ctx, loc_scale, hold, kind):
    import bpy
    from mathutils import Quaternion
    StaffClips(arm_obj, ctx, loc_scale, hold, kind).build()
    flips = sum(continuous_quaternions(a) for a in bpy.data.actions)
    print(f'[staff] quaternion keys made sign-continuous: {flips}')
    bpy.context.scene.frame_set(0)
    for pb in arm_obj.pose.bones:
        pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
        pb.location = Vector((0, 0, 0))
        pb.scale = Vector((1, 1, 1))
    return [a.name for a in bpy.data.actions]


# ---------------------------------------------------------------------------
# The two figures
# ---------------------------------------------------------------------------

# idle holds of the prop arm (world degrees, anim.Poser convention)
NORIKA_HOLD = {'upper_arm_R': (-14, 30, 0), 'forearm_R': (-150, -32, 0)}
KOGANE_HOLD = {'upper_arm_R': (-22, 22, 0), 'forearm_R': (-128, -18, 0)}

STAFF = dict(
    norika=dict(
        kind='sign',
        hold=NORIKA_HOLD,
        # weapon: the paddle's red, a touch brighter than her unit palette's so it stays red under battle light
        palette=dict(sashEdge='#a8ecd2', lanyard='#6b5aa6', boot='#2c3350', slow='#d8ef3a', hat='#f6c62c', weapon='#f4473a'),
        look=dict(hairStyle='twintails', bangs='blunt', eyeStyle='round', expression='calm', chinUp=14,
                  tailAz=118, tailEl=-14, tailLen=0.72, tailR=0.03, tailOut=0.03, tailCurl=0.012, tailDroop=0.4, tieT=0.5,
                  bangRaise=4, brows='none', attackBrows='none', lidDip=0.0, lidLift=-0.08, lidShade=0.3, browWidth=0.05, eyeTilt=9),
        glove=GLOVE,
    ),
    kogane=dict(
        kind='wrench',
        hold=KOGANE_HOLD,
        palette=dict(boot='#5b4536', hat='#ffd84a', toe='#a7adb6'),
        look=dict(hairStyle='short', bangs='messy', eyeStyle='round', expression='cheerful', chinUp=14, bangRaise=4,
                  brows='none', attackBrows='none', lidDip=0.0, lidLift=-0.08, lidShade=0.3, browWidth=0.05, eyeTilt=9),
        glove=None,
    ),
)


def build(ctx):
    """Builds every part of a staff figure into ctx['parts'] (body space). ctx: unit, pal, look (merged with STAFF[id]
    by the caller), P (= proportions_staff()[0]), Ph, xf, hair_bones."""
    uid = ctx['unit']['id']
    pal, look, P = ctx['pal'], ctx['look'], ctx['P']
    cfg = STAFF[uid]
    skin = pal['skin']
    hat_col = pal.get('hat', '#f6c62c')
    if uid == 'kogane':
        hat_fn = lambda c: hard_hat(c, hat_col, sticker=pal['accent'], goggles=(STEEL_DARK, '#bfe6f5', '#3b3f4a'))
    else:
        hat_fn = lambda c: hard_hat(c, hat_col)
    build_head(ctx, ctx['Ph'], ctx['xf'], skin, hat_fn)
    main = pal['outfit']
    glove = cfg['glove']
    parts = [body.neck(P, skin), body.torso(P, main)]
    parts += body.arms(P, skin, sleeve=main, sleeve_len=1.0, glove=glove)
    parts += body.legs(P, skin, tights=mix(main, '#101830', 0.25) if uid == 'norika' else mix(pal['outfitShade'], '#141b30', 0.2))
    if uid == 'norika':
        parts += _boots(P, pal.get('boot', '#2c3350'), sole='#d9d6cf')
    else:
        parts += _boots(P, pal.get('boot', '#5b4536'), toe=pal.get('toe', '#a7adb6'), sole='#2a2326')
    ctx['parts'] += parts
    ctx['parts'] += outfit_norika(ctx, P, pal) if uid == 'norika' else outfit_kogane(ctx, P, pal)
    chain = HeldChain(P, cfg['hold'], 'R')
    ctx['parts'] += stop_paddle(ctx, chain) if uid == 'norika' else big_wrench(ctx, chain)
    # the proportions as built (docs/art/tripo/staff-models.md): the hair crown (under the hat), the chin, the crotch
    cap = _part(ctx, 'hair_cap')
    crown = max(v.co.z for v in cap.data.vertices)
    crotch = P['torso_bottom'] - 0.015
    print(f'[staff] {uid}: hair crown {crown:.3f}, hat top {ctx["hat_top"]:.3f}, chin {P["chin_z"]:.3f}, crotch {crotch:.3f}: '
          f'{crown / (crown - P["chin_z"]):.2f} heads tall, head {(crown - P["chin_z"]) / crown:.3f}, '
          f'torso {(P["chin_z"] - crotch) / crown:.3f}, legs {crotch / crown:.3f} of the height')
    # the halo floats over the hat, a little smaller than a girl's (her head is smaller)
    P['halo_z'] = ctx['hat_top'] + 0.07
    n0 = len(ctx['parts'])
    halo.build(ctx)
    sc = 0.86
    cz = P['halo_z']
    for o in ctx['parts'][n0:]:
        o.data.transform(Matrix.Translation((0, 0.01, cz)) @ Matrix.Scale(sc, 4) @ Matrix.Translation((0, -0.01, -cz)))
        o.data.update()
    return ctx['parts']
