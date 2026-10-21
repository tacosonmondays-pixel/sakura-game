"""Weapons per look.weapon, built in the right hand's frame and weighted to hand_R
(two-handed/left-hand items to hand_L). Also maps weapons to attack-animation kinds."""
import math
from mathutils import Vector, Matrix, Euler

from . import mesh as M
from .colors import mix, darken, lighten

KIND = dict(bow='bow', katana='slash', sword='slash', rapier='thrust', staff='cast', tome='cast', bell='cast', gohei='cast', lantern='cast',
            cannon='cannon', rifle='rifle', shuriken='throw', flask='throw', coinPurse='throw', trident='thrust', wrench='smash', fan='sweep',
            parasol='sweep', turbineFan='sweep', mic='cast', shield='smash', mirror='cast', spear='thrust', mallet='smash', bachi='smash', puppet='cast',
            cards='throw', roseCards='throw', marionette='cast', stormSpear='thrust',
            # the new girls (UNIT_GAPS §5)
            strip='throw', needle='cast', tablet='cast', banner='cast', wateringCan='cast', ball='throw')


def kind_of(weapon):
    return KIND.get(weapon, 'cast')


def build(ctx):
    w = ctx['look'].get('weapon', 'staff')
    fn = WEAPONS.get(w, staff)
    parts = fn(ctx)
    ctx['parts'] += parts
    return parts


def hand_frame(ctx, side='R'):
    """Origin at the hand centre; returns (origin, down, forward, out) unit vectors where
    `down` runs from wrist to fingertips, `forward` is -Y, `out` points away from the body."""
    P = ctx['P']
    s = 1 if side == 'L' else -1
    hd = Vector((P['hand'].x * s, P['hand'].y, P['hand'].z))
    wr = Vector((P['wrist'].x * s, P['wrist'].y, P['wrist'].z))
    down = (hd - wr).normalized()
    forward = Vector((0, -1, 0))
    out = Vector((s, 0, 0))
    return hd, down, forward, out


def _rod(ctx, pts, radii, color, bone, sides=6, levels=1, tip=False):
    v, f, r = M.tube(pts, radii, sides=sides, tip_end=tip)
    o = M.new_object('wpn', v, f, color=color, bone=bone)
    if tip:
        M.crease(o, M.tip_edges(r), 1.0)
    M.finish(o, levels=levels)
    return o


def _blade(ctx, origin, axis, length, width, thick, color, bone, curve=0.0, tip_len=0.2):
    """Flat blade with creased edges along `axis` from origin."""
    fwd = Vector((0, -1, 0))
    side = axis.cross(fwd).normalized()
    pts = []
    for i, t in enumerate((0.0, 0.3, 0.6, 1.0 - tip_len, 1.0)):
        bend = side * (curve * t * t)
        pts.append(origin + axis * (length * t) + bend)
    radii = [(width, thick), (width, thick), (width, thick), (width * 0.9, thick * 0.9), (0.001, 0.001)]
    v, f, r = M.tube(pts, radii, sides=4, tip_end=True, up=fwd, inflate=1.0)
    o = M.new_object('blade', v, f, color=color, bone=bone)
    # crease the long edges (the 4 corners) and the tip edges
    pairs = []
    for i in range(len(r) - 2):
        for k in range(4):
            pairs.append((r[i][k], r[i + 1][k]))
    M.crease(o, pairs + M.tip_edges(r), 1.0)
    M.finish(o, levels=2)
    return o


def sword(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    axis = (down * 0.92 + fwd * 0.25 + out * 0.3).normalized()
    grip = hd + axis * 0.0
    parts = [_rod(ctx, [grip - axis * 0.05, grip + axis * 0.035], 0.012, darken(pal['accent'], 0.3), 'hand_R')]
    v, f = M.box(grip + axis * 0.04, (0.07, 0.022, 0.016))
    g = M.new_object('guard', v, f, color=pal['accent'], bone='hand_R')
    M.finish(g, levels=1)
    parts.append(g)
    parts.append(_blade(ctx, grip + axis * 0.045, axis, 0.24, 0.02, 0.006, pal['weapon'], 'hand_R'))
    v, f = M.sphere(grip - axis * 0.052, (0.014, 0.014, 0.014))
    p = M.new_object('pommel', v, f, color=pal['accent'], bone='hand_R')
    M.finish(p, levels=1)
    parts.append(p)
    return parts


def katana(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    axis = (down * 0.9 + fwd * 0.3 + out * 0.25).normalized()
    grip = hd
    parts = [_rod(ctx, [grip - axis * 0.07, grip + axis * 0.03], 0.011, darken(pal['accent'], 0.4), 'hand_R')]
    v, f, r = M.tube([grip + axis * 0.03, grip + axis * 0.04], 0.022, sides=8)
    g = M.new_object('tsuba', v, f, color=pal['accent'], bone='hand_R')
    M.finish(g, levels=1)
    parts.append(g)
    parts.append(_blade(ctx, grip + axis * 0.04, axis, 0.30, 0.016, 0.005, pal['weapon'], 'hand_R', curve=0.03, tip_len=0.12))
    return parts


def rapier(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    axis = (down * 0.9 + fwd * 0.35 + out * 0.2).normalized()
    grip = hd
    parts = [_rod(ctx, [grip - axis * 0.05, grip + axis * 0.03], 0.009, darken(pal['accent'], 0.3), 'hand_R')]
    v, f = M.sphere(grip + axis * 0.035, (0.03, 0.03, 0.022))
    g = M.new_object('cup', v, f, color=pal['accent'], bone='hand_R')
    M.finish(g, levels=1)
    parts.append(g)
    parts.append(_blade(ctx, grip + axis * 0.04, axis, 0.3, 0.008, 0.005, pal['weapon'], 'hand_R', tip_len=0.15))
    return parts


def bow(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx, 'L')
    # a chunky recurve bow held in the left hand: limbs up/down, bowed towards the front,
    # the whole thing turned ~35 deg so the arc reads from the front as well
    up = Vector((0, 0, 1))
    side = (fwd * math.cos(math.radians(35)) + out * math.sin(math.radians(35))).normalized()
    c = hd + side * 0.025
    pts = []
    for i in range(9):
        t = i / 8 - 0.5
        pts.append(c + up * (t * 0.5) + side * (0.08 * (1 - (t * 2) ** 2)))
    radii = [(0.001, 0.001)] + [(0.012 + 0.009 * (1 - abs(i / 8 - 0.5) * 2), 0.02 + 0.012 * (1 - abs(i / 8 - 0.5) * 2)) for i in range(1, 8)] + [(0.001, 0.001)]
    v, f, r = M.tube(pts, radii, sides=6, tip_end=True, tip_start=True, up=side)
    b = M.new_object('bow', v, f, color=pal['weapon'], bone='hand_L')
    M.crease(b, M.tip_edges(r) + M.tip_edges(r, end=False), 1.0)
    M.finish(b, levels=1)
    parts = [b]
    s = _rod(ctx, [pts[0] + side * 0.006, pts[-1] + side * 0.006], 0.003, '#f4f0e8', 'hand_L', sides=4, levels=0)
    parts.append(s)
    v, f, r = M.tube([c + side * 0.075 - up * 0.035, c + side * 0.075 + up * 0.035], 0.016, sides=6)
    g = M.new_object('bowgrip', v, f, color=pal['accent'], bone='hand_L')
    M.finish(g, levels=1)
    parts.append(g)
    return parts


def staff(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    axis = Vector((0, 0, 1))
    base = hd - axis * 0.2 + out * 0.03
    parts = [_rod(ctx, [base, hd, hd + axis * 0.26], 0.01, darken(pal['weapon'], 0.35), 'hand_R')]
    top = hd + axis * 0.27 + out * 0.0
    v, f = M.sphere(top + axis * 0.03, (0.03, 0.03, 0.03))
    orb = M.new_object('orb', v, f, color=pal['weapon'], bone='hand_R')
    M.finish(orb, levels=2)
    orb['material'] = 'halo'
    parts.append(orb)
    # crescent holder
    v, f, r = M.tube([top - out * 0.025, top - out * 0.01 + axis * 0.02, top + axis * 0.0, top + out * 0.01 + axis * 0.02, top + out * 0.025], [0.001, 0.008, 0.01, 0.008, 0.001], sides=6, tip_end=True, tip_start=True)
    h = M.new_object('holder', v, f, color=pal['accent'], bone='hand_R')
    M.finish(h, levels=1)
    parts.append(h)
    return parts


def trident(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    # leaned out a little so the prongs clear the head and long hair
    axis = (Vector((0, 0, 1)) + out * 0.24).normalized()
    base = hd - axis * 0.2 + out * 0.03
    parts = [_rod(ctx, [base, hd, hd + axis * 0.3], 0.009, darken(pal['weapon'], 0.3), 'hand_R')]
    top = hd + axis * 0.3
    for k in (-1, 0, 1):
        p0 = top + out * 0.0
        pts = [p0 + fwd * k * 0.025 - axis * 0.01, p0 + fwd * k * 0.03 + axis * 0.03, p0 + fwd * k * 0.028 + axis * 0.075]
        v, f, r = M.tube(pts, [0.008, 0.007, 0.001], sides=5, tip_end=True)
        pr = M.new_object(f'prong{k}', v, f, color=pal['weapon'], bone='hand_R')
        M.crease(pr, M.tip_edges(r), 1.0)
        M.finish(pr, levels=1)
        parts.append(pr)
    v, f = M.box(top - axis * 0.01, (0.016, 0.07, 0.016))
    bar = M.new_object('tbar', v, f, color=pal['weapon'], bone='hand_R')
    M.finish(bar, levels=1)
    parts.append(bar)
    return parts


def cannon(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    # held under the right arm, barrel pointing forward
    c = hd + Vector((0, 0, 0.03)) - fwd * 0.03
    pts = [c - fwd * 0.08, c, c + fwd * 0.12, c + fwd * 0.17]
    v, f, r = M.tube(pts, [0.038, 0.036, 0.034, 0.038], sides=10)
    b = M.new_object('barrel', v, f, color=pal['weapon'], bone='hand_R')
    M.crease_ring(b, r[-1], 0.9)
    M.finish(b, levels=2)
    parts = [b]
    v, f, r = M.tube([c + fwd * 0.165, c + fwd * 0.172], 0.03, sides=10)
    m = M.new_object('muzzle', v, f, color='#2b2733', bone='hand_R')
    M.finish(m, levels=1)
    parts.append(m)
    v, f, r = M.tube([c - fwd * 0.01, c + fwd * 0.02], 0.045, sides=10)
    band = M.new_object('band', v, f, color=pal['accent'], bone='hand_R')
    M.finish(band, levels=1)
    parts.append(band)
    return parts


def rifle(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    c = hd + Vector((0, 0, 0.02))
    v, f = M.box(c + fwd * 0.03, (0.025, 0.20, 0.03))
    body = M.new_object('rbody', v, f, color=darken(pal['weapon'], 0.2), bone='hand_R')
    M.crease(body, [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4), (0, 4), (1, 5), (2, 6), (3, 7)], 0.8)
    M.finish(body, levels=2)
    parts = [body]
    parts.append(_rod(ctx, [c + fwd * 0.10, c + fwd * 0.30], 0.009, pal['weapon'], 'hand_R', sides=8, levels=1))
    v, f = M.box(c - fwd * 0.10 - Vector((0, 0, 0.02)), (0.022, 0.07, 0.045))
    stock = M.new_object('stock', v, f, color=darken(pal['accent'], 0.3), bone='hand_R')
    M.crease(stock, [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4)], 0.7)
    M.finish(stock, levels=2)
    parts.append(stock)
    v, f = M.box(c + fwd * 0.04 + Vector((0, 0, 0.03)), (0.016, 0.06, 0.018))
    scope = M.new_object('scope', v, f, color=pal['accent'], bone='hand_R')
    M.finish(scope, levels=1)
    parts.append(scope)
    return parts


def shuriken(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    c = hd + fwd * 0.035 + out * 0.01
    pts = []
    for i in range(8):
        a = i / 8 * math.pi * 2
        rr = 0.045 if i % 2 == 0 else 0.016
        pts.append((math.cos(a) * rr, math.sin(a) * rr))
    v, f = M.plate(pts, 0.006, center=(c.x, c.y, c.z), plane='xz')
    o = M.new_object('shuriken', v, f, color=pal['weapon'], bone='hand_R')
    M.crease(o, [(i, (i + 1) % 8) for i in range(8)] + [(8 + i, 8 + (i + 1) % 8) for i in range(8)], 1.0)
    M.finish(o, levels=1)
    v, f, r = M.tube([c + fwd * 0.004, c - fwd * 0.004], 0.01, sides=8)
    h = M.new_object('shu_center', v, f, color=pal['accent'], bone='hand_R')
    M.finish(h, levels=1)
    return [o, h]


def tome(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx, 'L')
    c = hd + fwd * 0.04 + Vector((0, 0, 0.02))
    v, f = M.box(c, (0.075, 0.03, 0.095))
    b = M.new_object('tome', v, f, color=pal['weapon'], bone='hand_L')
    M.crease(b, [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4), (0, 4), (1, 5), (2, 6), (3, 7)], 0.9)
    M.finish(b, levels=2)
    v, f = M.box(c + fwd * 0.0, (0.07, 0.022, 0.088))
    p = M.new_object('pages', v, f, color='#f6f0e0', bone='hand_L')
    M.crease(p, [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4), (0, 4), (1, 5), (2, 6), (3, 7)], 0.9)
    M.finish(p, levels=1)
    v, f = M.sphere(c + fwd * 0.018, (0.014, 0.006, 0.014))
    g = M.new_object('tome_gem', v, f, color=pal['accent'], bone='hand_L')
    M.finish(g, levels=1)
    g['material'] = 'halo'
    return [b, p, g]


def bell(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    axis = Vector((0, 0, 1))
    top = hd + axis * 0.1
    parts = [_rod(ctx, [hd - axis * 0.03, top + axis * 0.02], 0.008, darken(pal['accent'], 0.3), 'hand_R')]
    # a hand bell big enough to read at battle zoom (the portraits show a large shrine bell)
    k = 1.6
    v, f, r = M.lathe([(0.012 * k, 0.0), (0.03 * k, -0.03 * k), (0.036 * k, -0.05 * k), (0.03 * k, -0.052 * k)], segments=12, close_top=True, close_bottom=True, center=(top.x, top.y, top.z + 0.025 * k))
    b = M.new_object('bell', v, f, color=pal['weapon'], bone='hand_R')
    M.finish(b, levels=2)
    parts.append(b)
    v, f = M.sphere(top - axis * 0.025 * k, (0.013, 0.013, 0.013))
    c = M.new_object('clapper', v, f, color=darken(pal['weapon'], 0.4), bone='hand_R')
    M.finish(c, levels=1)
    parts.append(c)
    parts += __import__('tools.blender.lib.outfit' if False else 'lib.outfit', fromlist=['bow']).bow((top.x, top.y - 0.012, top.z + 0.04), pal['accent'], size=0.02, bone='hand_R', tails=True)
    return parts


def wrench(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    axis = (down * 0.8 + fwd * 0.3 + out * 0.4).normalized()
    parts = [_rod(ctx, [hd - axis * 0.06, hd + axis * 0.14], (0.012, 0.007), pal['weapon'], 'hand_R', sides=4, levels=2)]
    head = hd + axis * 0.17
    v, f = M.box(head, (0.06, 0.016, 0.05))
    hv = M.new_object('wrench_head', v, f, color=pal['weapon'], bone='hand_R')
    M.crease(hv, [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4)], 0.8)
    M.finish(hv, levels=2)
    parts.append(hv)
    v, f = M.box(head + axis * 0.03, (0.024, 0.02, 0.03))
    gap = M.new_object('wrench_gap', v, f, color=darken(pal['accent'], 0.2), bone='hand_R')
    M.finish(gap, levels=1)
    parts.append(gap)
    return parts


def lantern(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    c = hd + fwd * 0.03 - Vector((0, 0, 0.05))
    v, f = M.box(c, (0.05, 0.05, 0.07))
    body = M.new_object('lantern', v, f, color=darken(pal['weapon'], 0.25), bone='hand_R')
    M.crease(body, [(0, 4), (1, 5), (2, 6), (3, 7)], 0.8)
    M.finish(body, levels=2)
    parts = [body]
    v, f = M.sphere(c, (0.03, 0.03, 0.035))
    glow = M.new_object('lantern_glow', v, f, color=lighten(pal['weapon'], 0.3), bone='hand_R')
    M.finish(glow, levels=1)
    glow['material'] = 'halo'
    parts.append(glow)
    v, f, r = M.tube([c + Vector((-0.025, 0, 0.04)), c + Vector((0, 0, 0.065)), c + Vector((0.025, 0, 0.04))], 0.004, sides=6)
    h = M.new_object('handle', v, f, color=pal['accent'], bone='hand_R')
    M.finish(h, levels=1)
    parts.append(h)
    return parts


def flask(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    c = hd + fwd * 0.03 + out * 0.01
    v, f, r = M.lathe([(0.012, 0.03), (0.012, 0.0), (0.03, -0.03), (0.034, -0.05), (0.028, -0.062)], segments=10, close_top=True, close_bottom=True, center=(c.x, c.y, c.z))
    o = M.new_object('flask', v, f, color=lighten(pal['weapon'], 0.25), bone='hand_R')
    M.finish(o, levels=2)
    v, f, r = M.tube([c + Vector((0, 0, 0.03)), c + Vector((0, 0, 0.045))], 0.01, sides=8)
    cork = M.new_object('cork', v, f, color='#b98a5a', bone='hand_R')
    M.finish(cork, levels=1)
    return [o, cork]


def parasol(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    axis = Vector((0, 0, 1))
    top = hd + axis * 0.3 + out * 0.08
    parts = [_rod(ctx, [hd - axis * 0.03, top + axis * 0.03], 0.006, darken(pal['accent'], 0.4), 'hand_R')]
    v, f, r = M.lathe([(0.0, 0.03), (0.09, 0.0), (0.13, -0.03)], segments=12, close_top=True, close_bottom=False, center=(top.x, top.y, top.z))
    can = M.new_object('canopy', v, f, color=pal['weapon'], bone='hand_R')
    M.crease_ring(can, r[-1], 0.6)
    M.finish(can, levels=2, solidify=0.008)
    parts.append(can)
    v, f = M.sphere(top + axis * 0.04, (0.012, 0.012, 0.012))
    k = M.new_object('ptop', v, f, color=pal['accent'], bone='hand_R')
    M.finish(k, levels=1)
    parts.append(k)
    return parts


def fan(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    c = hd + fwd * 0.02 + out * 0.01
    pts = [(0, 0)]
    for i in range(9):
        a = math.radians(20 + 140 * i / 8)
        pts.append((math.cos(a) * 0.09, math.sin(a) * 0.09))
    v, f = M.plate(pts, 0.006, center=(c.x, c.y, c.z - 0.01), plane='xz')
    o = M.new_object('fan', v, f, color=pal['weapon'], bone='hand_R')
    M.crease(o, [(i, i + 1) for i in range(1, 9)] + [(10 + i, 11 + i) for i in range(1, 9)], 0.9)
    M.finish(o, levels=1)
    v, f, r = M.tube([c - Vector((0, 0, 0.03)), c + Vector((0, 0, 0.0))], 0.008, sides=6)
    h = M.new_object('fanhandle', v, f, color=darken(pal['accent'], 0.3), bone='hand_R')
    M.finish(h, levels=1)
    return [o, h]


def _slab(name, corners, normal, thick, color, bone, levels=1):
    """Thin slab from a 3D outline (roughly planar) extruded along `normal`, perimeter creased."""
    n = len(corners)
    h = normal.normalized() * (thick / 2)
    verts = [tuple(c - h) for c in corners] + [tuple(c + h) for c in corners]
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    faces = M._orient(verts, faces)
    o = M.new_object(name, verts, faces, color=color, bone=bone)
    M.crease(o, [(i, (i + 1) % n) for i in range(n)] + [(n + i, n + (i + 1) % n) for i in range(n)], 1.0)
    M.finish(o, levels=levels)
    return o


def turbine_fan(ctx):
    """Big folding fan held open beside the right hip (Fuu's Turbine Fan): twelve pleated paper panels
    alternating white and mint on gold ribs, gold guard sticks and rivet, and three glowing mint micro-turbines
    (halo material, like the mirror glass) with gold hubs. The fan opens outwards and a little downwards, clear
    of the body, and its face is tilted up towards the battle camera."""
    from mathutils import Matrix
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    gold = pal.get('trim', '#e2b552')
    paper_a = pal['weapon']
    paper_b = mix(pal['accent'], pal['weapon'], 0.2)
    up = Vector((0, 0, 1))
    tilt = math.radians(24)
    nrm = (fwd * math.cos(tilt) + up * math.sin(tilt)).normalized()      # the side she shows (front, a bit up)
    w_ax = (up * math.cos(tilt) - fwd * math.sin(tilt)).normalized()     # in-plane "up"
    u_ax = out
    pivot = hd + fwd * 0.034 + out * 0.01 + Vector((0, 0, -0.01))
    R_out, R_in, N = 0.19, 0.075, 12
    a0, a1 = math.radians(-60), math.radians(58)

    def at(a, r, depth=0.0):
        return pivot + (u_ax * math.cos(a) + w_ax * math.sin(a)) * r + nrm * depth

    angles = [a0 + (a1 - a0) * k / N for k in range(N + 1)]
    depth = [0.0022 if k % 2 == 0 else -0.0022 for k in range(N + 1)]
    lap = (a1 - a0) / N * 0.06  # panels overlap a hair so the paper reads as one sheet, not petals
    parts = []
    for k in range(N):
        am = (angles[k] + angles[k + 1]) / 2
        ka, kb = angles[k] - (lap if k else 0.0), angles[k + 1] + (lap if k < N - 1 else 0.0)
        corners = [at(ka, R_in, depth[k]), at(ka, R_out, depth[k]), at(am, R_out, 0.0),
                   at(kb, R_out, depth[k + 1]), at(kb, R_in, depth[k + 1])]
        parts.append(_slab(f'fanpaper{k}', corners, nrm, 0.004, paper_a if k % 2 == 0 else paper_b, 'hand_R'))
    # gold ribs from the rivet to under the paper's inner edge; the two guard sticks run full length
    for k, a in enumerate(angles):
        guard = k in (0, N)
        end = at(a, (R_out + 0.006) if guard else (R_in + 0.012), depth[k] + (0.004 if guard else -0.002))
        v, f, r = M.tube([pivot + nrm * 0.002, end], 0.0055 if guard else 0.0036, sides=3 if not guard else 6)
        o = M.new_object(f'fanrib{k}', v, f, color=gold if guard or k % 2 else darken(gold, 0.12), bone='hand_R')
        M.finish(o, levels=0 if not guard else 1)
        parts.append(o)
    v, f = M.sphere(tuple(pivot + nrm * 0.004), (0.012, 0.012, 0.012))
    rv = M.new_object('fanrivet', v, f, color=gold, bone='hand_R')
    M.finish(rv, levels=0)
    parts.append(rv)
    # glowing turbines on the paper face, each with a gold hub
    face_rot = Matrix.Rotation(-tilt, 4, 'X')
    for i, t in enumerate((0.2, 0.5, 0.8)):
        a = a0 + (a1 - a0) * t
        c = at(a, (R_in + R_out) / 2, 0.0) + nrm * 0.008
        v, f = M.sphere((0, 0, 0), (0.025, 0.004, 0.025))
        disc = M.new_object(f'turbine{i}', v, f, color=pal['halo'], bone='hand_R')
        M.finish(disc, levels=1)
        disc.data.transform(Matrix.Translation(c) @ face_rot)
        disc.data.update()
        disc['material'] = 'halo'
        parts.append(disc)
        v, f = M.sphere(tuple(c + nrm * 0.005), (0.0085, 0.0085, 0.0085))
        hub = M.new_object(f'turbinehub{i}', v, f, color=gold, bone='hand_R')
        M.finish(hub, levels=0)
        parts.append(hub)
    return parts


def gohei(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    axis = Vector((0, 0, 1))
    top = hd + axis * 0.2
    parts = [_rod(ctx, [hd - axis * 0.05, top], 0.007, '#e8d9b8', 'hand_R')]
    for s in (1, -1):
        pts = [(0, 0), (s * 0.03, -0.02), (s * 0.015, -0.05), (s * 0.045, -0.075), (s * 0.03, -0.11), (s * 0.006, -0.09)]
        v, f = M.plate(pts, 0.004, center=(top.x, top.y, top.z + 0.01), plane='xz')
        p = M.new_object(f'shide{s}', v, f, color='#fbfbff', bone='hand_R')
        M.crease(p, [(i, (i + 1) % 6) for i in range(6)] + [(6 + i, 6 + (i + 1) % 6) for i in range(6)], 1.0)
        M.finish(p, levels=1)
        parts.append(p)
    return parts


def coin_purse(ctx):
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    c = hd + fwd * 0.035 - Vector((0, 0, 0.02))
    v, f = M.sphere(c, (0.04, 0.035, 0.042))
    v = [(x, y, z) for x, y, z in v]
    o = M.new_object('purse', v, f, color=pal['weapon'], bone='hand_R')
    M.finish(o, levels=2)
    v, f, r = M.tube([c + Vector((0, 0, 0.035)), c + Vector((0, 0, 0.05))], (0.016, 0.014), sides=8)
    n = M.new_object('purse_neck', v, f, color=pal['accent'], bone='hand_R')
    M.finish(n, levels=1)
    v, f = M.sphere(c + Vector((0.012, -0.03, 0.01)), (0.012, 0.004, 0.012))
    coin = M.new_object('coin', v, f, color='#ffd45e', bone='hand_R')
    M.finish(coin, levels=1)
    return [o, n, coin]


def _star_plate(center, r_out, r_in, thick, plane='xz'):
    pts = []
    for i in range(10):
        a = math.pi / 2 + i / 10 * math.pi * 2
        rr = r_out if i % 2 == 0 else r_in
        pts.append((math.cos(a) * rr, math.sin(a) * rr))
    return M.plate(pts, thick, center=tuple(center), plane=plane)


def _align(verts, origin, nrm):
    """Rotates verts built around +Z at the origin so +Z points along `nrm`, then moves them."""
    R = Vector((0, 0, 1)).rotation_difference(nrm.normalized()).to_matrix()
    return [tuple(origin + R @ Vector(v)) for v in verts]


def mic(ctx):
    """Idol microphone: a slim handle, a silver mesh ball head, an accent band and a little star."""
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    axis = (Vector((0, 0, 1)) * 0.9 + fwd * 0.32 + out * 0.12).normalized()
    parts = [_rod(ctx, [hd - axis * 0.035, hd + axis * 0.05, hd + axis * 0.085], [0.009, 0.011, 0.014], darken(pal['weapon'], 0.45), 'hand_R')]
    head = hd + axis * 0.11
    v, f = M.sphere(head, (0.027, 0.027, 0.027))
    b = M.new_object('mic_head', v, f, color=pal['weapon'], bone='hand_R')
    M.finish(b, levels=2)
    parts.append(b)
    v, f, r = M.tube([head - axis * 0.026, head - axis * 0.015], 0.02, sides=10)
    parts.append(M.finish(M.new_object('mic_band', v, f, color=pal['accent'], bone='hand_R'), levels=1))
    v, f = _star_plate(Vector((0, 0, 0)), 0.024, 0.01, 0.006)
    v = [tuple(Vector(p) + hd + axis * 0.045 + fwd * 0.016) for p in v]
    st = M.new_object('mic_star', v, f, color='#ffd45e', bone='hand_R')
    M.finish(st, levels=0)
    parts.append(st)
    return parts


def shield(ctx):
    """Round buckler on the left arm: a domed disc, a raised rim and a five-petal sakura emblem."""
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx, 'L')
    nrm = (out * 0.55 + fwd * 0.8).normalized()
    c = hd + nrm * 0.02 + Vector((0, 0, 0.03))
    v, f, r = M.lathe([(0.0, 0.018), (0.05, 0.013), (0.082, 0.0), (0.082, -0.008), (0.0, -0.008)], segments=14, close_top=False, close_bottom=False)
    disc = M.new_object('shield', _align(v, c, nrm), f, color=pal['weapon'], bone='hand_L')
    M.finish(disc, levels=1)
    parts = [disc]
    ring = [Vector((math.cos(a) * 0.084, math.sin(a) * 0.084, 0.002)) for a in (i / 16 * math.pi * 2 for i in range(17))]
    v, f, r = M.tube(ring, (0.008, 0.008), sides=5, cap_start=False, cap_end=False)
    rim = M.new_object('shield_rim', _align(v, c, nrm), f, color=lighten(pal['weapon'], 0.35), bone='hand_L')
    M.finish(rim, levels=1)
    parts.append(rim)
    for i in range(5):
        a = math.pi / 2 + i / 5 * math.pi * 2
        v, f = M.sphere((math.cos(a) * 0.026, math.sin(a) * 0.026, 0.019), (0.019, 0.019, 0.006))
        pe = M.new_object('shield_petal', _align(v, c, nrm), f, color=pal['accent'], bone='hand_L')
        M.finish(pe, levels=1)
        parts.append(pe)
    v, f = M.sphere((0, 0, 0.024), (0.011, 0.011, 0.006))
    k = M.new_object('shield_boss', _align(v, c, nrm), f, color='#ffd45e', bone='hand_L')
    M.finish(k, levels=1)
    parts.append(k)
    return parts


def mirror(ctx):
    """Oval hand mirror: a short handle, a silver frame ring and a softly glowing glass."""
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    axis = (Vector((0, 0, 1)) * 0.92 + out * 0.2 + fwd * 0.12).normalized()
    parts = [_rod(ctx, [hd - axis * 0.03, hd + axis * 0.05], [0.009, 0.011], darken(pal['weapon'], 0.3), 'hand_R')]
    c = hd + axis * 0.115
    side = axis.cross(fwd).normalized()
    ring = [c + side * (math.cos(a) * 0.046) + axis * (math.sin(a) * 0.058) for a in (i / 16 * math.pi * 2 for i in range(17))]
    v, f, r = M.tube(ring, (0.009, 0.007), sides=5, cap_start=False, cap_end=False)
    fr = M.new_object('mirror_frame', v, f, color=pal['weapon'], bone='hand_R')
    M.finish(fr, levels=1)
    parts.append(fr)
    v, f = M.sphere((0, 0, 0), (0.044, 0.004, 0.056))
    R = Matrix((side, -fwd, axis)).transposed()
    v = [tuple(c + R @ Vector(p)) for p in v]
    gl = M.new_object('mirror_glass', v, f, color='#dde6ff', bone='hand_R')
    M.finish(gl, levels=1)
    gl['material'] = 'halo'
    parts.append(gl)
    v, f = M.sphere(c + axis * 0.064, (0.011, 0.008, 0.011))
    parts.append(M.finish(M.new_object('mirror_gem', v, f, color=pal['accent'], bone='hand_R'), levels=1))
    return parts


def spear(ctx):
    """Long storm spear (1.4x a staff): shaft, gold collar and a leaf-shaped blade."""
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    # leaned out from the body so the blade clears the head and hair
    axis = (Vector((0, 0, 1)) + out * 0.3 + fwd * 0.1).normalized()
    base = hd - axis * 0.25 + out * 0.03
    top = hd + axis * 0.4
    parts = [_rod(ctx, [base, hd, top], 0.009, darken(pal['weapon'], 0.45), 'hand_R')]
    v, f, r = M.tube([top - axis * 0.01, top + axis * 0.02], 0.016, sides=8)
    parts.append(M.finish(M.new_object('spear_collar', v, f, color=pal['accent'], bone='hand_R'), levels=1))
    parts.append(_blade(ctx, top + axis * 0.02, axis, 0.13, 0.026, 0.006, pal['weapon'], 'hand_R', tip_len=0.35))
    v, f, r = M.tube([top - axis * 0.012, top - axis * 0.05, top - axis * 0.08], [(0.012, 0.004), (0.016, 0.004), (0.001, 0.001)], sides=4, tip_end=True, up=fwd)
    parts.append(M.finish(M.new_object('spear_tassel', v, f, color=pal['halo'], bone='hand_R'), levels=1))
    return parts


def storm_spear(ctx):
    """Telescoping storm lance (Seiran): a long white shaft with outfit-shade grip bands and gold collar rings at
    the joints, two small swept-back gold fins and a leaf blade of glowing ice-cyan crystal (halo material, so it
    takes the halo colour), plus a short crystal spike at the butt. Colours: weapon = shaft, trim = gold."""
    pal = ctx['pal']
    gold = pal.get('trim', '#e2b552')
    band = pal['outfitShade']
    hd, down, fwd, out = hand_frame(ctx)
    axis = (Vector((0, 0, 1)) + out * 0.3 + fwd * 0.1).normalized()
    # the lower shaft bends out a little at the hand so the butt clears her boot when the arm hangs straight;
    # everything below the hand follows that lower direction
    base = hd - axis * 0.23 + out * 0.08
    low = (hd - base).normalized()
    top = hd + axis * 0.47
    parts = [_rod(ctx, [base, hd, top], 0.0095, pal['weapon'], 'hand_R')]
    # grip band around the hand and a band near the butt, in the outfit shade
    for c, d, ln in ((hd, axis, 0.05), (base + low * 0.06, low, 0.04)):
        v, f, r = M.tube([c - d * ln / 2, c + d * ln / 2], 0.0115, sides=6)
        parts.append(M.finish(M.new_object('sspear_band', v, f, color=band, bone='hand_R'), levels=0))
    # gold collar rings at the telescoping joints and under the head
    for c, d in ((hd + axis * 0.2, axis), (hd - low * 0.13, low), (top - axis * 0.004, axis)):
        v, f, r = M.tube([c - d * 0.008, c + d * 0.008], 0.0145, sides=8)
        parts.append(M.finish(M.new_object('sspear_ring', v, f, color=gold, bone='hand_R'), levels=1))
    side = axis.cross(fwd).normalized()
    # two small fins swept back and down from the head collar
    for s in (1, -1):
        p0 = top + side * s * 0.012
        v, f, r = M.tube([p0 + axis * 0.012, p0 + side * s * 0.022 - axis * 0.004, p0 + side * s * 0.03 - axis * 0.03],
                         [(0.007, 0.003), (0.006, 0.003), (0.001, 0.001)], sides=4, tip_end=True, up=fwd)
        fin = M.new_object('sspear_fin', v, f, color=gold, bone='hand_R')
        M.crease(fin, M.tip_edges(r), 1.0)
        M.finish(fin, levels=1)
        parts.append(fin)
    blade = _blade(ctx, top + axis * 0.008, axis, 0.17, 0.03, 0.007, '#dff6ff', 'hand_R', tip_len=0.4)
    blade['material'] = 'halo'
    parts.append(blade)
    # short crystal spike at the butt (a plain 4-sided tip, one subdivision level)
    v, f, r = M.tube([base + low * 0.004, base - low * 0.03, base - low * 0.06], [(0.016, 0.006), (0.014, 0.005), (0.001, 0.001)],
                     sides=4, tip_end=True, up=fwd, inflate=1.0)
    spike = M.new_object('sspear_spike', v, f, color='#dff6ff', bone='hand_R')
    M.crease(spike, M.tip_edges(r), 1.0)
    M.finish(spike, levels=1)
    spike['material'] = 'halo'
    parts.append(spike)
    return parts


def mallet(ctx):
    """Taiko bachi: a short thick drumstick with a rounded tip in each hand."""
    pal = ctx['pal']
    parts = []
    for side, bone in (('R', 'hand_R'), ('L', 'hand_L')):
        hd, down, fwd, out = hand_frame(ctx, side)
        axis = (Vector((0, 0, 1)) * 0.75 + fwd * 0.45 + out * 0.25).normalized()
        parts.append(_rod(ctx, [hd - axis * 0.04, hd + axis * 0.08, hd + axis * 0.15], [0.012, 0.014, 0.016], pal['weapon'], bone))
        v, f = M.sphere(hd + axis * 0.16, (0.019, 0.019, 0.019))
        parts.append(M.finish(M.new_object('bachi_tip', v, f, color=lighten(pal['weapon'], 0.15), bone=bone), levels=1))
        v, f, r = M.tube([hd - axis * 0.045, hd - axis * 0.03], 0.015, sides=8)
        parts.append(M.finish(M.new_object('bachi_wrap', v, f, color=pal['accent'], bone=bone), levels=1))
    return parts


def bachi(ctx):
    """Carbon taiko bachi (Kanna): a long slim black drumstick in each hand with two gold bands (palette
    'trim') and a glowing tip on the halo material, like the amber tips in her portrait. Held like the mallet."""
    pal = ctx['pal']
    gold = pal.get('trim', '#e2b552')
    parts = []
    for side, bone in (('R', 'hand_R'), ('L', 'hand_L')):
        hd, down, fwd, out = hand_frame(ctx, side)
        axis = (Vector((0, 0, 1)) * 0.75 + fwd * 0.45 + out * 0.25).normalized()
        parts.append(_rod(ctx, [hd - axis * 0.05, hd + axis * 0.1, hd + axis * 0.2], [0.0105, 0.011, 0.0115], pal['weapon'], bone))
        for t in ((0.062,) if M.LEVEL_DROP[0] else (-0.038, 0.062)):  # the LOD keeps only the upper band
            v, f, r = M.tube([hd + axis * (t - 0.007), hd + axis * (t + 0.007)], 0.0135, sides=6)
            parts.append(M.finish(M.new_object('bachi_band', v, f, color=gold, bone=bone), levels=0))
        v, f = M.sphere(hd + axis * 0.206, (0.0155, 0.0155, 0.0155))
        tip = M.finish(M.new_object('bachi_glow', v, f, color=pal['halo'], bone=bone), levels=1)
        tip['material'] = 'halo'
        parts.append(tip)
    return parts


def puppet(ctx):
    """Marionette control: a cross bar held above the hand, three thin strings and a tiny doll."""
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    c = hd + Vector((0, 0, 0.045)) + fwd * 0.03
    wood = '#b98a5a'
    parts = [_rod(ctx, [c - out * 0.055, c + out * 0.055], 0.008, wood, 'hand_R', sides=6)]
    parts.append(_rod(ctx, [c - fwd * 0.04, c + fwd * 0.04], 0.008, wood, 'hand_R', sides=6))
    doll = c + fwd * 0.05 - Vector((0, 0, 0.15))
    head = doll + Vector((0, 0, 0.05))
    for a in (c - out * 0.05, c + out * 0.05, c + fwd * 0.04):
        end = head + (a - c) * 0.3
        parts.append(_rod(ctx, [a, end], 0.0016, '#f4f0e8', 'hand_R', sides=3, levels=0))
    v, f = M.sphere(head, (0.017, 0.016, 0.017))
    parts.append(M.finish(M.new_object('doll_head', v, f, color='#ffe6dc', bone='hand_R'), levels=1))
    v, f, r = M.lathe([(0.008, 0.03), (0.016, 0.012), (0.028, -0.012), (0.024, -0.016)], segments=8, close_top=True, close_bottom=True, center=(doll.x, doll.y, doll.z))
    parts.append(M.finish(M.new_object('doll_dress', v, f, color=pal['accent'], bone='hand_R'), levels=1))
    v, f = M.sphere(head + Vector((0, 0, 0.016)), (0.016, 0.015, 0.008))
    parts.append(M.finish(M.new_object('doll_hair', v, f, color=pal['outfit'], bone='hand_R'), levels=1))
    return parts


def cards(ctx):
    """A fan of four fortune cards held between the fingers (dark faces with a red edge)."""
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    c = hd + fwd * 0.035 + Vector((0, 0, 0.03))
    face = '#2b1c2a'
    edge = pal['accent']
    parts = []
    for i in range(4):
        ang = math.radians(-36 + i * 24)
        R = Matrix.Rotation(ang, 3, 'Y')
        off = R @ Vector((0, 0, 0.03))
        for col, w, hgt, t, dy in ((edge, 0.04, 0.056, 0.003, 0.002), (face, 0.034, 0.05, 0.003, -0.0005)):
            pts = [(-w / 2, -hgt / 2), (w / 2, -hgt / 2), (w / 2, hgt / 2), (-w / 2, hgt / 2)]
            v, f = M.plate(pts, t, center=(0, 0, 0), plane='xz')
            v = [tuple(c + off + Vector((0, dy - i * 0.004, 0)) + R @ Vector(p)) for p in v]
            o = M.new_object('card', v, f, color=col, bone='hand_R')
            M.finish(o, levels=0)
            parts.append(o)
    return parts


def _card(center, R, w, h, face, frame, mark, bone, name='card'):
    """One holo card: a gold frame slab, a pearl face slab just in front, and a small rose mark in the middle.
    R rotates the card's local frame (x across, y toward the viewer is -Y, z up) into place."""
    parts = []
    for col, cw, ch, t, dy in ((frame, w, h, 0.003, 0.0), (face, w * 0.8, h * 0.84, 0.002, -0.0022)):
        pts = [(-cw / 2, -ch / 2), (cw / 2, -ch / 2), (cw / 2, ch / 2), (-cw / 2, ch / 2)]
        v, f = M.plate(pts, t, center=(0, 0, 0), plane='xz')
        v = [tuple(center + R @ Vector((x, y + dy, z))) for x, y, z in v]
        o = M.new_object(name, v, f, color=col, bone=bone)
        M.finish(o, levels=0)
        parts.append(o)
    v, f = M.sphere((0, 0, 0), (w * 0.19, 0.002, w * 0.19))
    v = [tuple(center + R @ Vector((x, y - 0.0042, z))) for x, y, z in v]
    o = M.new_object(name + '_mark', v, f, color=mark, bone=bone)
    M.finish(o, levels=0)
    parts.append(o)
    return parts


def _hold_rotation(ctx, side='R'):
    """World rotation of the hand in the resting hold (look.holdPose, the same {bone: (rx, ry, rz)} degrees the clips
    use: world axes, applied Z, X, Y, parent first). Identity without a hold pose."""
    hold = ctx['look'].get('holdPose') or {}
    R = Matrix.Identity(3)
    for b in (f'upper_arm_{side}', f'forearm_{side}', f'hand_{side}'):
        if b in hold:
            rx, ry, rz = hold[b]
            R = R @ Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'ZXY').to_matrix()
    return R


def rose_cards(ctx):
    """Ena's curse cards: a fan of five pearl holo cards with gold borders and a crimson rose mark in her right hand,
    rising above the hand and leaning back toward the battle camera, plus one 'revealed fortune' card in her left hand.
    The fan is laid out for the resting hold (look.holdPose) and mapped back into the bind pose, so it stands upright
    when she holds it up."""
    pal = ctx['pal']
    face = pal['weapon']
    frame = '#d9b25e'
    mark = pal['accent']
    w, h = 0.06, 0.086
    parts = []
    hd, down, fwd, out = hand_frame(ctx, 'R')
    Hi = _hold_rotation(ctx, 'R').inverted()
    lean = Matrix.Rotation(math.radians(-ctx['look'].get('cardLean', 28)), 3, 'X')  # faces look up at the camera
    splay = Matrix.Rotation(math.radians(ctx['look'].get('cardSplay', 0)), 3, 'Y')   # + leans the fan out, away from the face
    base = fwd * 0.03 + Vector((0, 0, 0.012)) + out * 0.004
    for i in range(5):
        ang = math.radians(-48 + i * 24)
        R = splay @ lean @ Matrix.Rotation(-ang, 3, 'Y')
        c = base + R @ Vector((0, -i * 0.0034, h * 0.42))
        parts += _card(hd + Hi @ c, Hi @ R, w, h, face, frame, mark, 'hand_R')
    hd, down, fwd, out = hand_frame(ctx, 'L')
    R = Matrix.Rotation(math.radians(-20), 3, 'X') @ Matrix.Rotation(math.radians(-18), 3, 'Y')
    parts += _card(hd + fwd * 0.03 + Vector((0, 0, 0.036)) + out * 0.006, R, w, h, face, frame, mark, 'hand_L', name='card_left')
    return parts


def _held(ctx, side):
    """Maps points between the rest pose and the pose look.pin holds an arm in (anim.Poser.pin), so a prop on
    hand_<side> can be modelled where it hangs while the arm is raised and stored in rest space. Without a pin both
    maps are the identity. Returns (to_rest, to_held)."""
    P = ctx['P']
    pin = ctx['look'].get('pin') or {}
    s = 1 if side == 'L' else -1
    heads = [(f'shoulder_{side}', Vector((0, 0, P['shoulder_z']))),
             (f'upper_arm_{side}', Vector((P['shoulder'].x * s, P['shoulder'].y, P['shoulder'].z))),
             (f'forearm_{side}', Vector((P['elbow'].x * s, P['elbow'].y, P['elbow'].z))),
             (f'hand_{side}', Vector((P['wrist'].x * s, P['wrist'].y, P['wrist'].z)))]
    chain = [(head, Euler([math.radians(a) for a in pin[name]], 'ZXY').to_matrix()) for name, head in heads if pin.get(name)]

    def to_held(p):
        p = Vector(p)
        for head, R in reversed(chain):  # innermost bone first, like the pose evaluation
            p = head + R @ (p - head)
        return p

    def to_rest(p):
        p = Vector(p)
        for head, R in chain:
            p = head + R.inverted() @ (p - head)
        return p
    return to_rest, to_held


def marionette(ctx):
    """Marionette control bar (Yoriko): a dark cross-shaped control bar with four glowing end nodes held up in the left
    hand, plus a glowing thread node at the right glove's fingertips. With look.pin holding the left arm up, the bar is
    modelled in that held pose and stored in rest space, rigid on hand_L. Palette: 'bar' (bar colour); the glow is the
    halo material. Her little drone marionette (the doll in a tiny school uniform) and its glowing threads are no
    longer part of her figure: the doll is its own figure now, and ctx['marionette']['doll'] keeps its waist point
    under the bar in the held pose (its home)."""
    pal = ctx['pal']
    P = ctx['P']
    to_rest, to_held = _held(ctx, 'L')
    hand = to_held(Vector((P['hand'].x, P['hand'].y, P['hand'].z)))
    bar_col = pal.get('bar', '#3a3170')
    glow = pal['halo']
    parts = []

    def dot(c, r):
        # tiny glowing / end beads: a sphere cage, a plain box in the LOD (sub-pixel there)
        return M.sphere(tuple(c), (r, r, r)) if not M.LEVEL_DROP[0] else M.box(tuple(c), (r * 1.8, r * 1.8, r * 1.8))

    def obj(name, vf, color, levels=1, halo=False, bone='hand_L', rest=True):
        v, f = vf[0], vf[1]
        if rest:
            v = [tuple(to_rest(p)) for p in v]
        o = M.new_object(name, v, f, color=color, bone=bone)
        if halo:
            o['material'] = 'halo'
        M.finish(o, levels=levels)
        parts.append(o)
        return o

    # control bar: an X in plan view (reads as a cross from the battle camera), tilted a little towards it
    c = hand + Vector((0, -0.004, 0.014))
    tilt = Matrix.Rotation(math.radians(-16), 3, 'X')
    up = tilt @ Vector((0, 0, 1))
    ends = []
    for i, (a, half) in enumerate(((32, 0.088), (-58, 0.066))):
        ax = tilt @ Vector((math.cos(math.radians(a)), math.sin(math.radians(a)), 0))
        v, f, r = M.tube([c - ax * half, c + ax * half], (0.0095, 0.0055), sides=6, up=up)
        obj(f'mbar{i}', (v, f), bar_col)
        ends += [c - ax * half, c + ax * half]
    for i, e in enumerate(ends):
        obj(f'mnode{i}', dot(e, 0.0115), glow, levels=0, halo=True)
    # her doll's home: its waist, dancing below the bar (the doll and its threads are a separate figure now)
    D = Vector((c.x + 0.012, c.y + 0.004, c.z - 0.37))
    # thread-emitter node at the right glove's fingertips (the casting hand)
    hd, down, fwd, out = hand_frame(ctx, 'R')
    obj('glove_node', dot(hd + down * 0.042 + fwd * 0.012, 0.011), glow, levels=0, halo=True, bone='hand_R', rest=False)
    ctx['marionette'] = dict(hand=hand, bar=c, doll=D)
    print(f'[marionette] held hand {tuple(round(x, 3) for x in hand)} bar {tuple(round(x, 3) for x in c)} doll home (waist) {tuple(round(x, 3) for x in D)}')
    return parts


# ---------------------------------------------------------------------------------------------
# the new girls (UNIT_GAPS §5)

def strip(ctx):
    """Azami: a reel of folding spike strips at her hip-height hand, a short length unrolled with barbs."""
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    c = hd + fwd * 0.02 + Vector((0, 0, -0.01))
    v, f, r = M.tube([c - out * 0.022, c + out * 0.022], 0.05, sides=14)
    reel = M.new_object('strip_reel', v, f, color=pal['accent'], bone='hand_R')
    M.finish(reel, levels=1)
    v, f = M.sphere(c + out * 0.024, (0.016, 0.016, 0.016))
    hub = M.new_object('strip_hub', v, f, color=darken(pal['outfitShade'], 0.2), bone='hand_R')
    M.finish(hub, levels=1)
    base = c + Vector((0, 0, -0.05))
    v, f = M.box(base + fwd * 0.05, (0.018, 0.07, 0.006))
    band = M.new_object('strip_band', v, f, color=pal['weapon'], bone='hand_R')
    M.finish(band, levels=1)
    parts = [reel, hub, band]
    for k in range(4):
        tip = base + fwd * (0.0 + k * 0.032) + Vector((0, 0, 0.022))
        v, f, r = M.tube([tip - Vector((0, 0, 0.018)), tip], [0.006, 0.001], sides=4, tip_end=True)
        b = M.new_object('barb', v, f, color=lighten(pal['weapon'], 0.35), bone='hand_R')
        M.finish(b, levels=0)
        parts.append(b)
    return parts


def needle(ctx):
    """Kinu: an oversized sewing needle twirled like a baton, a loop of thread through its eye."""
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    axis = (Vector((0, 0, 1)) * 0.85 + out * 0.3 + fwd * 0.2).normalized()
    a = hd - axis * 0.06
    b = hd + axis * 0.26
    parts = [_rod(ctx, [a, hd, b], [0.006, 0.009, 0.0035], pal['weapon'], 'hand_R', sides=6, levels=1, tip=False)]
    v, f, r = M.tube([a, a - axis * 0.03], [0.006, 0.0008], sides=6, tip_end=True)
    tip = M.new_object('needle_tip', v, f, color=pal['weapon'], bone='hand_R')
    M.finish(tip, levels=0)
    parts.append(tip)
    eye = b + axis * 0.012
    loop = [eye + out * 0.012, eye + axis * 0.02, eye - out * 0.012, eye - axis * 0.005]
    v, f, r = M.tube(M.smooth_path(loop + [loop[0]], 12), 0.0035, sides=5)
    ring = M.new_object('needle_eye', v, f, color=pal['weapon'], bone='hand_R')
    M.finish(ring, levels=0)
    parts.append(ring)
    thread = M.smooth_path([eye, eye - out * 0.04 - axis * 0.03, eye - out * 0.06 - axis * 0.1, eye - out * 0.03 - axis * 0.17], 10)
    v, f, r = M.tube(thread, 0.0025, sides=4)
    th = M.new_object('thread', v, f, color=pal['accent'], bone='hand_R')
    M.finish(th, levels=0)
    parts.append(th)
    return parts


def tablet(ctx):
    """Yuzuha: a rugged tablet controller with a safety-orange bumper, a lit screen and an antenna."""
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx, 'L')
    c = hd + fwd * 0.05 + Vector((0, 0, 0.03))
    v, f = M.box(c, (0.075, 0.012, 0.055))
    body = M.new_object('tablet', v, f, color=pal['accent'], bone='hand_L')
    M.crease(body, [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4)], 0.9)
    M.finish(body, levels=2)
    v, f = M.box(c + fwd * 0.008, (0.062, 0.006, 0.043))
    screen = M.new_object('tablet_screen', v, f, color='#7fe0ff', bone='hand_L')
    M.finish(screen, levels=1)
    screen['material'] = 'halo'
    ant = c + Vector((0.06, 0, 0.05))
    parts = [body, screen, _rod(ctx, [ant - Vector((0, 0, 0.02)), ant + Vector((0, 0, 0.05))], 0.003, darken(pal['weapon'], 0.2), 'hand_L', sides=5, levels=0)]
    v, f = M.sphere(ant + Vector((0, 0, 0.055)), (0.008, 0.008, 0.008))
    led = M.new_object('tablet_led', v, f, color='#ff5d5d', bone='hand_L')
    M.finish(led, levels=0)
    parts.append(led)
    return parts


def banner(ctx):
    """Ouka: a folding "COUNCIL HQ" banner stand: a pole with a gold finial, a white flag, a gold
    top bar and a pink sakura crest."""
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    axis = Vector((0, 0, 1))
    base = hd - axis * 0.2 + out * 0.03
    top = hd + axis * 0.34
    parts = [_rod(ctx, [base, hd, top], 0.008, darken(pal['outfitShade'], 0.1), 'hand_R')]
    v, f = M.sphere(top + axis * 0.012, (0.016, 0.016, 0.016))
    fin = M.new_object('finial', v, f, color=pal['weapon'], bone='hand_R')
    M.finish(fin, levels=1)
    parts.append(fin)
    c = top - axis * 0.08 + out * 0.1
    v, f = M.box(c, (0.1, 0.005, 0.07))
    flag = M.new_object('flag', v, f, color='#f6f3ec', bone='hand_R')
    M.finish(flag, levels=1)
    parts.append(flag)
    v, f = M.box(c + axis * 0.072, (0.102, 0.007, 0.007))
    bar = M.new_object('flag_bar', v, f, color=pal['weapon'], bone='hand_R')
    M.finish(bar, levels=0)
    parts.append(bar)
    v, f = M.sphere(c + fwd * 0.007, (0.026, 0.007, 0.026))
    crest = M.new_object('crest', v, f, color='#f29bb8', bone='hand_R')
    M.finish(crest, levels=1)
    parts.append(crest)
    return parts


def ball(ctx):
    """Marumi: a polished bowling-ball bomb held low in one hand, three finger holes and a fuse."""
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    c = hd + down * 0.035 + fwd * 0.01
    v, f = M.sphere(c, (0.045, 0.045, 0.045))
    body = M.new_object('ball', v, f, color=pal['weapon'], bone='hand_R')
    M.finish(body, levels=1)
    parts = [body]
    for k, (a, b) in enumerate(((-0.012, 0.018), (0.012, 0.02), (0.0, 0.0))):
        p = c + fwd * 0.042 + out * a + Vector((0, 0, b))
        v, f = M.sphere(p, (0.007, 0.004, 0.007))
        hole = M.new_object(f'ball_hole{k}', v, f, color='#1c1e2c', bone='hand_R')
        M.finish(hole, levels=0)
        parts.append(hole)
    top = c + Vector((0, 0, 0.045))
    parts.append(_rod(ctx, [top, top + Vector((0.008, 0, 0.022))], 0.004, '#f6efe0', 'hand_R', sides=5, levels=0))
    v, f = M.sphere(top + Vector((0.01, 0, 0.026)), (0.007, 0.007, 0.007))
    spark = M.new_object('ball_spark', v, f, color='#ffc46b', bone='hand_R')
    M.finish(spark, levels=0)
    spark['material'] = 'halo'
    parts.append(spark)
    return parts


def watering_can(ctx):
    """Chigusa: a watering can held at the side, with a long spout and a rose on the end."""
    pal = ctx['pal']
    hd, down, fwd, out = hand_frame(ctx)
    c = hd + down * 0.05 + out * 0.01
    v, f, r = M.tube([c + down * 0.035, c - down * 0.035], [0.042, 0.038], sides=12)
    body = M.new_object('can', v, f, color=pal['weapon'], bone='hand_R')
    M.finish(body, levels=1)
    parts = [body]
    handle = [c - down * 0.035 - fwd * 0.03, c - down * 0.07, c - down * 0.035 + fwd * 0.03]
    parts.append(_rod(ctx, handle, 0.005, darken(pal['weapon'], 0.3), 'hand_R', sides=5, levels=0))
    s0 = c + fwd * 0.035 + down * 0.01
    s1 = s0 + fwd * 0.07 - down * 0.05
    parts.append(_rod(ctx, [s0, s1], [0.008, 0.006], pal['weapon'], 'hand_R', sides=6, levels=0))
    v, f = M.sphere(s1 + fwd * 0.006 - down * 0.004, (0.012, 0.012, 0.012))
    rose = M.new_object('rose', v, f, color='#d9e6f2', bone='hand_R')
    M.finish(rose, levels=0)
    parts.append(rose)
    return parts


WEAPONS = dict(turbineFan=turbine_fan, bow=bow, katana=katana, staff=staff, cannon=cannon, rifle=rifle, shuriken=shuriken, tome=tome, bell=bell, wrench=wrench,
               lantern=lantern, flask=flask, parasol=parasol, trident=trident, fan=fan, rapier=rapier, gohei=gohei, coinPurse=coin_purse, sword=sword,
               mic=mic, shield=shield, mirror=mirror, spear=spear, mallet=mallet, bachi=bachi, puppet=puppet, cards=cards, roseCards=rose_cards,
               marionette=marionette, stormSpear=storm_spear,
               strip=strip, needle=needle, tablet=tablet, banner=banner, wateringCan=watering_can, ball=ball)
