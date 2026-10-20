"""Weapons per look.weapon, built in the right hand's frame and weighted to hand_R
(two-handed/left-hand items to hand_L). Also maps weapons to attack-animation kinds."""
import math
from mathutils import Vector, Matrix

from . import mesh as M
from .colors import mix, darken, lighten

KIND = dict(bow='bow', katana='slash', sword='slash', rapier='thrust', staff='cast', tome='cast', bell='cast', gohei='cast', lantern='cast',
            cannon='cannon', rifle='rifle', shuriken='throw', flask='throw', coinPurse='throw', trident='thrust', wrench='smash', fan='sweep',
            parasol='sweep', mic='cast', shield='smash', mirror='cast', spear='thrust', mallet='smash', puppet='cast', cards='throw',
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


WEAPONS = dict(bow=bow, katana=katana, staff=staff, cannon=cannon, rifle=rifle, shuriken=shuriken, tome=tome, bell=bell, wrench=wrench,
               lantern=lantern, flask=flask, parasol=parasol, trident=trident, fan=fan, rapier=rapier, gohei=gohei, coinPurse=coin_purse, sword=sword,
               mic=mic, shield=shield, mirror=mirror, spear=spear, mallet=mallet, puppet=puppet, cards=cards,
               strip=strip, needle=needle, tablet=tablet, banner=banner, wateringCan=watering_can, ball=ball)
