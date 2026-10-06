"""Weapons per look.weapon, built in the right hand's frame and weighted to hand_R
(two-handed/left-hand items to hand_L). Also maps weapons to attack-animation kinds."""
import math
from mathutils import Vector, Matrix

from . import mesh as M
from .colors import mix, darken, lighten

KIND = dict(bow='bow', katana='slash', sword='slash', rapier='thrust', staff='cast', tome='cast', bell='cast', gohei='cast', lantern='cast',
            cannon='cannon', rifle='rifle', shuriken='throw', flask='throw', coinPurse='throw', trident='thrust', wrench='smash', fan='sweep',
            parasol='sweep')


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
    axis = Vector((0, 0, 1))
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
    top = hd + axis * 0.08
    parts = [_rod(ctx, [hd - axis * 0.03, top + axis * 0.02], 0.007, darken(pal['accent'], 0.3), 'hand_R')]
    v, f, r = M.lathe([(0.012, 0.0), (0.03, -0.03), (0.036, -0.05), (0.03, -0.052)], segments=10, close_top=True, close_bottom=True, center=(top.x, top.y, top.z + 0.025))
    b = M.new_object('bell', v, f, color=pal['weapon'], bone='hand_R')
    M.finish(b, levels=2)
    parts.append(b)
    v, f = M.sphere(top - axis * 0.025, (0.009, 0.009, 0.009))
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


WEAPONS = dict(bow=bow, katana=katana, staff=staff, cannon=cannon, rifle=rifle, shuriken=shuriken, tome=tome, bell=bell, wrench=wrench,
               lantern=lantern, flask=flask, parasol=parasol, trident=trident, fan=fan, rapier=rapier, gohei=gohei, coinPurse=coin_purse, sword=sword)
