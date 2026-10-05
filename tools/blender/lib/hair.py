"""Hair library: a smooth cap over the cranium plus broad, deliberately curved locks with
creased pointed tips (never thin jagged strands). Styles per look.hairStyle, bangs per
look.bangs. Long/tail parts get their own bones so they can swing.
"""
import math
from mathutils import Vector

from . import mesh as M
from .colors import mix, darken, lighten

D = math.radians


class Head:
    """Spherical helper around the head ellipsoid. az: 0 = front (-Y), +90 = character's
    left (+X), 180 = back. el: elevation from the equator."""

    def __init__(self, P):
        self.c = P['head_center']
        self.R = P['head_radii']

    def dir(self, az, el):
        return Vector((math.sin(D(az)) * math.cos(D(el)), -math.cos(D(az)) * math.cos(D(el)), math.sin(D(el))))

    def surf(self, az, el, lift=0.0):
        d = self.dir(az, el)
        return Vector((self.c.x + d.x * self.R.x * (1 + lift), self.c.y + d.y * self.R.y * (1 + lift), self.c.z + d.z * self.R.z * (1 + lift)))

    def normal(self, az, el):
        d = self.dir(az, el)
        n = Vector((d.x / self.R.x, d.y / self.R.y, d.z / self.R.z))
        return n.normalized()


def build(ctx):
    """Adds hair parts to ctx['parts'] and hair bones to ctx['hair_bones']."""
    P = ctx['P']
    look = ctx['look']
    pal = ctx['pal']
    H = Head(P)
    hair = pal['hair']
    shade = pal['hairShade']
    style = look.get('hairStyle', 'bob')
    bangs = look.get('bangs', 'straight')
    parts = []
    parts.append(cap(H, hair, shade, style, head_obj=ctx.get('head_obj')))
    parts += BANGS.get(bangs, bangs_straight)(H, hair, shade, ctx)
    parts += STYLES.get(style, style_bob)(H, hair, shade, ctx)
    ctx['parts'] += parts
    return parts


# ---------------------------------------------------------------------------
# Cap
# ---------------------------------------------------------------------------

def hairline(az, style):
    """Elevation (deg) of the cap's lower edge at azimuth az (deg, 0 = front)."""
    a = abs(((az + 180) % 360) - 180)  # 0..180
    if a < 35:
        return 30.0
    if a < 75:
        return 30.0 - (a - 35) / 40 * 36.0
    if a < 110:
        return -6.0 - (a - 75) / 35 * 20.0
    return -26.0 - (a - 110) / 70 * 10.0


CAP_GAP = 0.011       # world units between the scalp and the cap's inner surface
CAP_THICK = 0.022     # cap shell thickness (outer surface = scalp + CAP_GAP + CAP_THICK)
HAIR_TOP = 0.20       # lift (fraction of head radius) where accessories sit on top of the hair


def cap(H, hair, shade, style, head_obj=None):
    """Shell over the cranium: 16 longitudes x 6 latitude rings + pole, subdivided once and
    shrink-wrapped onto the real head mesh (a fixed gap above the scalp everywhere), then
    thickened outwards. Catmull-Clark shrinks cages, so the fit is measured, not guessed."""
    longs = 16
    lift = 0.16
    verts = []
    rings = []
    pole = len(verts)
    verts.append(tuple(H.surf(0, 90, lift)))
    for ri, frac in enumerate((0.82, 0.64, 0.46, 0.3, 0.14, 0.0)):
        ring = []
        for k in range(longs):
            az = 360 * k / longs
            bottom = hairline(az, style)
            el = bottom + (90 - bottom) * frac
            ring.append(len(verts))
            verts.append(tuple(H.surf(az, el, lift)))
        rings.append(ring)
    faces = []
    for k in range(longs):
        faces.append((pole, rings[0][(k + 1) % longs], rings[0][k]))
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for k in range(longs):
            faces.append((a[k], b[k], b[(k + 1) % longs], a[(k + 1) % longs]))
    faces = M._orient(verts, faces, center=Vector(H.c))
    o = M.new_object('hair_cap', verts, faces, color=hair, bone='head')
    M.crease_ring(o, rings[-1], 0.6)
    M.finish(o, levels=1, min_levels=1)
    if head_obj is not None:
        sw = o.modifiers.new('wrap', 'SHRINKWRAP')
        sw.target = head_obj
        sw.wrap_method = 'NEAREST_SURFACEPOINT'
        sw.wrap_mode = 'OUTSIDE_SURFACE'
        sw.offset = CAP_GAP
        M.apply_modifiers(o)
    else:
        fit_to_head(o, H, 0.075)
    # thickness outwards after the fit so the shell is uniform
    so = o.modifiers.new('solidify', 'SOLIDIFY')
    so.thickness = CAP_THICK
    so.offset = 1.0
    so.use_rim = True
    so.use_even_offset = True
    M.apply_modifiers(o)
    c = H.c
    R = H.R
    inner = 1 + (CAP_GAP + CAP_THICK * 0.5) / R.z
    def col(co):
        d = Vector(((co.x - c.x) / R.x, (co.y - c.y) / R.y, (co.z - c.z) / R.z)).length
        return shade if d < inner else hair
    M.set_color(o, hair, col)
    return o


def fit_to_head(obj, H, lift):
    """Scales a finished shell about the head centre so its outermost point sits at `lift`."""
    c, R = H.c, H.R
    dmax = 0.0
    for v in obj.data.vertices:
        d = Vector(((v.co.x - c.x) / R.x, (v.co.y - c.y) / R.y, (v.co.z - c.z) / R.z)).length
        dmax = max(dmax, d)
    if dmax <= 0:
        return
    s = (1 + lift) / dmax
    for v in obj.data.vertices:
        v.co = c + (v.co - c) * s
    obj.data.update()


# ---------------------------------------------------------------------------
# Locks
# ---------------------------------------------------------------------------

def lock(name, path, widths, thicks, color, bone='head', sides=6, tip=True, up=None, squash=0.35, levels=1, bones=None, blend=0.05, start_cap=True):
    """Broad tapered tube with a creased pointed tip."""
    radii = [(w / 2, t / 2) for w, t in zip(widths, thicks)]
    if tip:
        radii = radii[:-1] + [(0.001, 0.001)]
    v, f, rings = M.tube(path, radii, sides=sides, tip_end=tip, up=up, squash=squash, cap_start=start_cap)
    o = M.new_object(name, v, f, color=color, bone=bone if bones is None else None)
    if tip:
        M.crease(o, M.tip_edges(rings), 1.0)
    if bones is not None:
        M.weight_by_bones(o, bones, blend=blend)
    M.finish(o, levels=levels)
    return o


BANG_END = 9.0  # elevation (deg) where bang tips end: between the brows and the top of the eyes


def bang(H, az, el_end, sweep, width, hair, lift=0.105, el_start=50, thick=0.034, name='bang', curl=0.0):
    """One bang lock from the hairline down over the forehead. el_end is relative to BANG_END."""
    el_end = BANG_END + el_end
    pts = []
    for i, (fe, fl) in enumerate(((0.0, 0.8), (0.3, 1.0), (0.65, 1.0), (1.0, 0.9))):
        a = az + sweep * fe
        e = el_start + (el_end - el_start) * fe
        pts.append(H.surf(a, e, lift * fl))
    # tip slightly off the surface and curled
    tip_pt = H.surf(az + sweep * 1.08 + curl, el_end - 5, lift * 0.7)
    pts.append(tip_pt)
    widths = [width * 0.75, width, width * 0.95, width * 0.6, 0]
    thicks = [thick * 0.8, thick, thick * 0.95, thick * 0.6, 0]
    return lock(name, pts, widths, thicks, hair, up=H.normal(az, el_start))


def side_lock(H, s, length, width, hair, az=62, el_start=0, flare=0.0, curl_in=0.0, wave=0.0, lift=0.085, name='side', bone='head', blunt=False, thick=0.046):
    """Lock in front of the ear hanging down beside the face (s = +1 left, -1 right)."""
    start = H.surf(s * az, el_start, lift)
    n = H.normal(s * az, el_start)
    n.z = 0
    n.normalize()
    pts = [H.surf(s * az, el_start + 18, lift * 0.95), start]
    steps = 4
    for i in range(1, steps + 1):
        t = i / steps
        p = start + Vector((n.x * (0.02 + flare * t) * (1 - curl_in * t * t), n.y * 0.015 + math.sin(t * math.pi * 2) * wave, -length * t))
        pts.append(p)
    widths = [width * 0.75, width * 0.95, width, width, width * 0.9, width * 0.6, 0]
    thicks = [thick * 0.8, thick, thick, thick * 0.95, thick * 0.85, thick * 0.6, 0]
    if blunt:
        pts = pts[:-1]
        widths = widths[:-2] + [width * 0.9]
        thicks = thicks[:-2] + [thick * 0.8]
        return lock(name, pts, widths, thicks, hair, up=n, tip=False, bone=bone)
    return lock(name, pts, widths, thicks, hair, up=n, bone=bone)


def back_locks(H, ctx, count, length, width, hair, shade, az_span=(95, 265), el_start=-16, flare=0.012, curl_in=0.0, wave=0.0, bone='hair_back', thick=0.055, name='back', lift=0.085):
    """A curtain of broad overlapping locks hanging from under the back of the cap."""
    out = []
    a0, a1 = az_span
    P = ctx['P']
    for i in range(count):
        az = a0 + (a1 - a0) * (i + 0.5) / count
        start = H.surf(az, el_start, lift)
        n = H.normal(az, el_start)
        n.z = 0
        n.normalize()
        pts = [H.surf(az, el_start + 16, lift * 0.95), start]
        steps = 4
        for k in range(1, steps + 1):
            t = k / steps
            sway = math.sin(t * math.pi * 1.5) * wave
            p = start + Vector((n.x * (0.012 + flare * t - curl_in * t * t) + sway * n.y, n.y * (0.012 + flare * t - curl_in * t * t) - sway * n.x, -length * t))
            out_floor = max(p.z, 0.05)
            p.z = out_floor
            pts.append(p)
        widths = [width * 0.75, width * 0.95, width, width, width * 0.9, width * 0.6, 0]
        thicks = [thick * 0.7, thick, thick, thick * 0.95, thick * 0.85, thick * 0.6, 0]
        col = mix(hair, shade, 0.08)
        bones = None
        if bone == 'hair_back' and length > 0.12:
            nape = Vector((0, H.c.y + H.R.y * 0.6, H.c.z - H.R.z * 0.4))
            bones = [('head', Vector((0, 0, H.c.z - H.R.z)), Vector((0, 0, H.c.z + H.R.z))), ('hair_back', nape, nape + Vector((0, 0, -length)))]
        out.append(lock(f'{name}{i}', pts, widths, thicks, col, up=n, bones=bones, blend=0.06, sides=6))
    return out


def tail(H, ctx, s, az, el, length, radius, hair, shade, bone, curl=0.03, out=0.07, tie=None, name='tail', droop=1.0):
    """Ponytail / twintail: a thick tapered tube from a tie point, swinging out then down."""
    start = H.surf(s * az, el, 0.05)
    n = H.normal(s * az, el)
    pts = [start,
           start + n * out * 0.6 + Vector((0, 0, 0.02 * droop)),
           start + n * out + Vector((0, 0, -length * 0.25)),
           start + n * out * 0.85 + Vector((0, 0, -length * 0.55)),
           start + n * out * 0.6 + Vector((s * curl, curl * 0.5, -length * 0.82)),
           start + n * out * 0.5 + Vector((s * curl * 1.6, curl, -length))]
    for p in pts:
        p.z = max(p.z, 0.04)
    widths = [radius * 1.3, radius * 2.0, radius * 2.1, radius * 1.9, radius * 1.3, 0]
    thicks = [radius * 1.2, radius * 1.7, radius * 1.8, radius * 1.6, radius * 1.1, 0]
    tie_pt = pts[1]
    bones = [('head', Vector((0, 0, H.c.z - H.R.z)), Vector((0, 0, H.c.z + H.R.z))), (bone, tie_pt, pts[-1])]
    ctx['hair_bones'].append((bone, tie_pt, pts[-1], 'head'))
    o = lock(name, pts, widths, thicks, hair, sides=8, up=Vector((0, 0, 1)), squash=0.0, bones=bones, blend=0.05)
    parts = [o]
    if tie:
        v, f, r = M.tube([pts[1] - n * 0.012, pts[1] + n * 0.012], radius * 1.25, sides=8)
        t = M.new_object('tie', v, f, color=tie, bone='head')
        M.finish(t, levels=1)
        parts.append(t)
    return parts


# ---------------------------------------------------------------------------
# Bangs
# ---------------------------------------------------------------------------

def bangs_straight(H, hair, shade, ctx):
    out = []
    for i, az in enumerate((-26, -9, 9, 26)):
        out.append(bang(H, az, abs(az) * 0.08, 0.0, 0.078, hair, name=f'bang{i}'))
    return out


def bangs_swept(H, hair, shade, ctx):
    out = []
    # one big sweep across the forehead to the character's left, short fringe on the right
    out.append(bang(H, -22, 2, 22, 0.085, hair, name='bang0', curl=3))
    out.append(bang(H, -6, -2, 18, 0.080, hair, name='bang1', curl=2))
    out.append(bang(H, 14, 4, 14, 0.075, hair, name='bang2'))
    out.append(bang(H, -34, 10, -4, 0.06, hair, name='bang3', el_start=42))
    return out


def bangs_split(H, hair, shade, ctx):
    out = []
    out.append(bang(H, -10, 6, -14, 0.075, hair, name='bang0'))
    out.append(bang(H, 10, 6, 14, 0.075, hair, name='bang1'))
    out.append(bang(H, -26, 0, -8, 0.07, hair, name='bang2'))
    out.append(bang(H, 26, 0, 8, 0.07, hair, name='bang3'))
    return out


def bangs_hime(H, hair, shade, ctx):
    out = []
    for i, az in enumerate((-27, -9, 9, 27)):
        out.append(bang(H, az, 0, 0.0, 0.078, hair, name=f'bang{i}', el_start=52))
    return out


def bangs_messy(H, hair, shade, ctx):
    out = []
    spec = [(-30, 6, -6, 0.06), (-14, -2, 4, 0.07), (0, 3, -8, 0.065), (12, -3, 10, 0.07), (28, 5, 6, 0.06)]
    for i, (az, el, sw, w) in enumerate(spec):
        out.append(bang(H, az, el, sw, w, hair, name=f'bang{i}', el_start=48 + (i % 2) * 4))
    return out


BANGS = dict(straight=bangs_straight, swept=bangs_swept, split=bangs_split, hime=bangs_hime, messy=bangs_messy)


# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------

def style_long(H, hair, shade, ctx):
    P = ctx['P']
    L = (H.c.z - P['torso_bottom']) * 0.95
    out = back_locks(H, ctx, 7, L, 0.11, hair, shade, flare=0.02)
    for s in (1, -1):
        out.append(side_lock(H, s, (H.c.z - P['torso_bottom']) * 0.5, 0.072, hair, flare=0.02, name=f'side{s}'))
    ctx['hair_bones'].append(('hair_back', Vector((0, H.c.y + H.R.y * 0.6, H.c.z - H.R.z * 0.4)), Vector((0, H.c.y + H.R.y * 0.6, H.c.z - H.R.z * 0.4 - L)), 'head'))
    return out


def style_hime(H, hair, shade, ctx):
    P = ctx['P']
    L = (H.c.z - P['torso_bottom']) * 0.98
    out = back_locks(H, ctx, 6, L, 0.085, hair, shade, flare=0.02)
    for s in (1, -1):
        out.append(side_lock(H, s, H.R.z * 1.1, 0.07, hair, flare=0.0, name=f'side{s}', blunt=True, thick=0.045))
    ctx['hair_bones'].append(('hair_back', Vector((0, H.c.y + H.R.y * 0.6, H.c.z - H.R.z * 0.4)), Vector((0, H.c.y + H.R.y * 0.6, H.c.z - H.R.z * 0.4 - L)), 'head'))
    return out


def style_wavy(H, hair, shade, ctx):
    P = ctx['P']
    L = (H.c.z - P['torso_bottom']) * 0.9
    out = back_locks(H, ctx, 6, L, 0.085, hair, shade, flare=0.04, wave=0.02)
    for s in (1, -1):
        out.append(side_lock(H, s, (H.c.z - P['torso_bottom']) * 0.55, 0.06, hair, flare=0.015, wave=0.012, name=f'side{s}'))
    ctx['hair_bones'].append(('hair_back', Vector((0, H.c.y + H.R.y * 0.6, H.c.z - H.R.z * 0.4)), Vector((0, H.c.y + H.R.y * 0.6, H.c.z - H.R.z * 0.4 - L)), 'head'))
    return out


def style_bob(H, hair, shade, ctx):
    L = H.R.z * 1.05
    out = back_locks(H, ctx, 7, L, 0.075, hair, shade, az_span=(80, 280), el_start=-18, flare=0.025, curl_in=0.035, bone='head')
    for s in (1, -1):
        out.append(side_lock(H, s, H.R.z * 0.95, 0.06, hair, flare=0.01, curl_in=0.5, name=f'side{s}'))
    return out


def style_short(H, hair, shade, ctx):
    L = H.R.z * 0.7
    out = back_locks(H, ctx, 7, L, 0.07, hair, shade, az_span=(80, 280), el_start=-20, flare=0.05, bone='head', thick=0.04)
    for s in (1, -1):
        out.append(side_lock(H, s, H.R.z * 0.6, 0.055, hair, flare=0.02, name=f'side{s}'))
    return out


def style_twintails(H, hair, shade, ctx):
    P = ctx['P']
    L = (H.c.z - P['torso_bottom']) * 0.85
    out = back_locks(H, ctx, 5, H.R.z * 0.75, 0.07, hair, shade, az_span=(110, 250), el_start=-20, flare=0.03, bone='head', thick=0.04)
    for s, bone in ((1, 'tail_L'), (-1, 'tail_R')):
        out += tail(H, ctx, s, 92, 22, L, 0.034, hair, shade, bone, tie=ctx['pal'].get('accent'), name=f'tail{s}', out=0.08, curl=0.025)
        out.append(side_lock(H, s, H.R.z * 0.7, 0.05, hair, az=58, flare=0.01, name=f'side{s}'))
    return out


def style_ponytail(H, hair, shade, ctx):
    P = ctx['P']
    L = (H.c.z - P['torso_bottom']) * 0.95
    out = back_locks(H, ctx, 5, H.R.z * 0.6, 0.07, hair, shade, az_span=(110, 250), el_start=-22, flare=0.02, bone='head', thick=0.04)
    out += tail(H, ctx, 1, 180, 38, L, 0.040, hair, shade, 'hair_back', tie=ctx['pal'].get('accent'), name='pony', out=0.10, curl=0.0, droop=1.5)
    for s in (1, -1):
        out.append(side_lock(H, s, H.R.z * 0.8, 0.055, hair, flare=0.01, name=f'side{s}'))
    return out


def style_side(H, hair, shade, ctx):
    P = ctx['P']
    L = (H.c.z - P['torso_bottom']) * 0.9
    out = back_locks(H, ctx, 6, H.R.z * 0.75, 0.07, hair, shade, az_span=(90, 270), el_start=-20, flare=0.03, bone='head', thick=0.04)
    out += tail(H, ctx, 1, 118, 10, L, 0.038, hair, shade, 'tail_L', tie=ctx['pal'].get('accent'), name='sidetail', out=0.07, curl=0.03)
    out.append(side_lock(H, -1, H.R.z * 0.8, 0.055, hair, flare=0.01, name='side-1'))
    out.append(side_lock(H, 1, H.R.z * 0.5, 0.05, hair, flare=0.01, name='side1'))
    return out


def style_braid(H, hair, shade, ctx):
    P = ctx['P']
    L = (H.c.z - P['torso_bottom']) * 1.0
    out = back_locks(H, ctx, 5, H.R.z * 0.6, 0.07, hair, shade, az_span=(110, 250), el_start=-22, flare=0.02, bone='head', thick=0.04)
    # braid: a tube with alternating bulges
    start = H.surf(180, -28, 0.07)
    n = Vector((0, 1, 0))
    pts = [start + Vector((0, 0.0, 0.02))]
    seg = 7
    radii = []
    for i in range(seg + 1):
        t = i / seg
        pts.append(start + Vector((math.sin(t * math.pi * 3) * 0.012, 0.02, -L * t)))
        r = 0.028 * (1 - 0.5 * t)
        radii.append((r * (1.35 if i % 2 else 0.95), r * (0.95 if i % 2 else 1.35)))
    radii = [(0.03, 0.03)] + radii
    radii[-1] = (0.001, 0.001)
    v, f, rings = M.tube(pts, radii, sides=8, tip_end=True, up=n)
    nape = Vector((0, H.c.y + H.R.y * 0.6, H.c.z - H.R.z * 0.4))
    o = M.new_object('braid', v, f, color=hair)
    M.crease(o, M.tip_edges(rings), 1.0)
    M.weight_by_bones(o, [('head', Vector((0, 0, H.c.z - H.R.z)), Vector((0, 0, H.c.z + H.R.z))), ('hair_back', nape, nape + Vector((0, 0, -L)))], blend=0.06)
    M.finish(o, levels=1)
    out.append(o)
    ctx['hair_bones'].append(('hair_back', nape, nape + Vector((0, 0, -L)), 'head'))
    acc = ctx['pal'].get('accent')
    v, f, r = M.tube([pts[-2] - Vector((0, 0.012, 0)), pts[-2] + Vector((0, 0.012, 0))], 0.02, sides=8)
    t = M.new_object('braid_tie', v, f, color=acc)
    M.weight_by_bones(t, [('hair_back', nape, nape + Vector((0, 0, -L)))])
    M.finish(t, levels=1)
    out.append(t)
    for s in (1, -1):
        out.append(side_lock(H, s, H.R.z * 0.8, 0.055, hair, flare=0.01, name=f'side{s}'))
    return out


def style_buns(H, hair, shade, ctx):
    out = back_locks(H, ctx, 5, H.R.z * 0.55, 0.07, hair, shade, az_span=(110, 250), el_start=-22, flare=0.03, bone='head', thick=0.04)
    for s in (1, -1):
        c = H.surf(s * 68, 48, 0.16)
        v, f = M.sphere(c, (0.058, 0.055, 0.052))
        b = M.new_object(f'bun{s}', v, f, color=hair, bone='head')
        M.finish(b, levels=1)
        out.append(b)
        # ribbon tie under the bun
        acc = ctx['pal'].get('accent')
        v, f = M.sphere(c + Vector((s * 0.01, -0.03, -0.04)), (0.022, 0.014, 0.018))
        t = M.new_object(f'buntie{s}', v, f, color=acc, bone='head')
        M.finish(t, levels=1)
        out.append(t)
        out.append(side_lock(H, s, H.R.z * 0.7, 0.05, hair, az=60, flare=0.01, name=f'side{s}'))
    return out


STYLES = dict(long=style_long, hime=style_hime, wavy=style_wavy, bob=style_bob, short=style_short, twintails=style_twintails,
              ponytail=style_ponytail, side=style_side, braid=style_braid, buns=style_buns)
