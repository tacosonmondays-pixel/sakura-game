"""Painted face atlas (PIL): big glossy eyes with a dark upper-lid stroke, iris gradient,
two highlights, lashes, thin brows in the hair colour, a tiny mouth and blush — the way the
jaeysart tutorial paints the face instead of modelling it.

Atlas: 3x3 cells, each cell maps to the front of the head (u: left->right across the head
width, v: chin->top). Cells (row-major): idle, blink, attack, happy, hurt, dizzy, wink,
shy, surprised. Runtime picks a cell with texture offset.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from .colors import srgb, mix, darken, lighten, hexs

CELLS = ['idle', 'blink', 'attack', 'happy', 'hurt', 'dizzy', 'wink', 'shy', 'surprised']
GRID = 3
SS = 3  # supersampling


def build_atlas(unit, cell_px=256, eye_v=0.40):
    """Returns a PIL RGBA image (opaque skin background) of GRID x GRID cells."""
    size = cell_px * GRID
    atlas = Image.new('RGBA', (size, size), (0, 0, 0, 255))
    look = unit.get('look', {})
    pal = unit.get('palette', {})
    adult = bool(unit.get('adult') or unit.get('kind') == 'hero')
    base_eyes = look.get('eyeStyle', 'round')
    expr = look.get('expression', 'smile')
    spec = dict(eyes=pal.get('eyes', '#4a7fd0'), skin=pal.get('skin', '#ffe4d6'), hair=pal.get('hair', '#8a6a5a'),
                hairShade=pal.get('hairShade', '#5a4038'), adult=adult, eye_v=eye_v)
    cells = {
        'idle': dict(eyes='closed' if base_eyes == 'closed' else base_eyes, mouth=expr, blush=expr, brows=expr),
        'blink': dict(eyes='blink', mouth=expr, blush=expr, brows=expr),
        'attack': dict(eyes='sharp' if base_eyes != 'closed' else 'closed', mouth='determined', blush='none', brows='determined', focus=True),
        'happy': dict(eyes='happy', mouth='cheer', blush='cheerful', brows='happy'),
        'hurt': dict(eyes='hurt', mouth='wobble', blush='shy', brows='shy'),
        'dizzy': dict(eyes='dizzy', mouth='wobble', blush='none', brows='shy'),
        'wink': dict(eyes='wink', mouth='smug', blush=expr, brows='smug', base=base_eyes),
        'shy': dict(eyes='sleepy' if base_eyes != 'closed' else 'closed', mouth='shy', blush='shy', brows='shy'),
        'surprised': dict(eyes='round', mouth='o', blush='none', brows='up', small_iris=True),
    }
    for i, name in enumerate(CELLS):
        img = draw_cell(cell_px, spec, cells[name])
        atlas.paste(img, ((i % GRID) * cell_px, (i // GRID) * cell_px))
    return atlas


def draw_cell(px, spec, cell):
    S = px * SS
    img = Image.new('RGBA', (S, S), tuple(int(c * 255) for c in srgb(spec['skin'])) + (255,))
    d = ImageDraw.Draw(img)
    adult = spec['adult']
    # layout in cell fractions (v measured from the top of the image)
    eye_cy = 1.0 - spec['eye_v']
    eye_dx = 0.205 if not adult else 0.195
    ew = (0.29 if not adult else 0.27) * S      # eye width
    eh = (0.27 if not adult else 0.28) * S      # eye height
    lash = mix(darken(spec['hairShade'], 0.5), '#2a2033', 0.55)
    if cell.get('blush', 'none') != 'none':
        blush(img, S, eye_cy + 0.12, 0.33, strong=cell['blush'] in ('shy', 'cheerful'), skin=spec['skin'])
    for side in (-1, 1):
        cx = (0.5 + side * eye_dx) * S
        cy = eye_cy * S
        kind = cell['eyes']
        if kind == 'wink':
            kind = cell.get('base', 'round') if side < 0 else 'happy'
            if kind == 'closed':
                kind = 'closed'
        if kind in ('round', 'sharp', 'sleepy', 'sparkle'):
            eye(img, cx, cy, ew, eh, side, spec['eyes'], lash, kind, adult, small=cell.get('small_iris', False), focus=cell.get('focus', False))
        elif kind == 'blink':
            arc_eye(d, cx, cy + eh * 0.1, ew, lash, 'down', S)
        elif kind == 'closed':
            arc_eye(d, cx, cy + eh * 0.05, ew, lash, 'down', S, lashes=True, side=side)
        elif kind == 'happy':
            arc_eye(d, cx, cy, ew, lash, 'up', S)
        elif kind == 'hurt':
            cross_eye(d, cx, cy, ew, lash, S, side)
        elif kind == 'dizzy':
            swirl(d, cx, cy, ew * 0.42, lash, S)
    brows(d, S, eye_cy - 0.20, eye_dx, ew, lash_color=mix(spec['hairShade'], lash, 0.45), kind=cell.get('brows', 'smile'))
    mouth(d, S, 0.5, eye_cy + 0.185, cell['mouth'], mix(lash, '#b03a4a', 0.5), adult)
    return img.resize((px, px), Image.LANCZOS)


# ---------------------------------------------------------------------------

def _bez(p0, p1, p2, p3, n=18):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        pts.append((u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
                    u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]))
    return pts


def _poly_mask(size, pts):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m


def _ellipse_mask(size, cx, cy, rx, ry):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    return m


def _vgrad(size, y0, y1, c0, c1):
    """Vertical gradient image between colours (hex) from y0 to y1."""
    a = np.linspace(0, 1, size)
    t = np.clip((a * size - y0) / max(1, (y1 - y0)), 0, 1)
    ca, cb = np.array(srgb(c0)), np.array(srgb(c1))
    col = (ca[None, :] * (1 - t[:, None]) + cb[None, :] * t[:, None]) * 255
    arr = np.repeat(col[:, None, :], size, axis=1).astype(np.uint8)
    return Image.fromarray(np.dstack([arr, np.full((size, size), 255, np.uint8)]), 'RGBA')


def eye(img, cx, cy, w, h, side, color, lash, style, adult, small=False, focus=False):
    S = img.size[0]
    o = side
    sharp = style == 'sharp' or focus
    sleepy = style == 'sleepy'
    hh = h * (0.88 if sharp else 1.0)
    top = cy - hh * 0.5
    bot = cy + hh * 0.5
    lift = hh * (0.14 if sharp else 0.0)
    # eye white shape (rounder bottom, flatter top), outer corner = +o side
    outline = (_bez((cx - w * 0.5 * o, top + hh * 0.22), (cx - w * 0.25 * o, top + hh * 0.04), (cx + w * 0.25 * o, top + hh * 0.02 - lift), (cx + w * 0.5 * o, top + hh * 0.14 - lift))
               + _bez((cx + w * 0.5 * o, top + hh * 0.12 - lift), (cx + w * 0.62 * o, cy + hh * 0.25), (cx + w * 0.3 * o, bot + hh * 0.02), (cx, bot))
               + _bez((cx, bot), (cx - w * 0.36 * o, bot + hh * 0.0), (cx - w * 0.6 * o, cy + hh * 0.25), (cx - w * 0.5 * o, top + hh * 0.18)))
    white = _poly_mask(S, outline)
    layer = Image.new('RGBA', (S, S), (251, 251, 255, 255))
    img.paste(layer, (0, 0), white)
    # iris: vertical gradient dark (top) -> colour -> light (bottom)
    ir = w * (0.36 if small else 0.46)
    irh = hh * (0.40 if small else 0.50)
    icx = cx + w * 0.02 * o
    icy = cy + hh * (0.08 if not small else 0.04)
    iris_mask = _ellipse_mask(S, icx, icy, ir, irh)
    iris_mask = Image.fromarray(np.minimum(np.array(iris_mask), np.array(white)))
    grad = _vgrad(S, icy - irh, icy + irh, darken(color, 0.55), lighten(color, 0.38))
    img.paste(grad, (0, 0), iris_mask)
    # iris rim
    d = ImageDraw.Draw(img)
    rim = _ring(S, icx, icy, ir, irh, ir * 0.08, darken(color, 0.62))
    img.paste(rim, (0, 0), Image.fromarray(np.minimum(np.array(rim.split()[3]), np.array(white))))
    # pupil
    pm = _ellipse_mask(S, icx, icy - irh * 0.04, ir * 0.40, irh * 0.46)
    pm = Image.fromarray(np.minimum(np.array(pm), np.array(white)))
    img.paste(Image.new('RGBA', (S, S), tuple(int(c * 255) for c in srgb(darken(color, 0.75))) + (255,)), (0, 0), pm)
    # lower glow crescent
    gm = _ellipse_mask(S, icx, icy + irh * 0.5, ir * 0.62, irh * 0.34)
    gm = Image.fromarray((np.minimum(np.array(gm), np.array(iris_mask)) * 0.55).astype(np.uint8))
    img.paste(Image.new('RGBA', (S, S), tuple(int(c * 255) for c in srgb(lighten(color, 0.7))) + (255,)), (0, 0), gm)
    # lid shadow on the top of the eye
    sh = Image.new('L', (S, S), 0)
    shd = ImageDraw.Draw(sh)
    steps = 48
    for i in range(steps):
        a = int(150 * (1 - i / steps) ** 1.5)
        shd.rectangle((cx - w, top + hh * 0.42 * i / steps, cx + w, top + hh * 0.42 * (i + 1) / steps + 1), fill=a)
    sh = Image.fromarray(np.minimum(np.array(sh), np.array(white)))
    img.paste(Image.new('RGBA', (S, S), (40, 24, 56, 255)), (0, 0), sh)
    # highlights
    hl = Image.new('RGBA', (S, S), (255, 255, 255, 255))
    if style == 'sparkle':
        m = _star_mask(S, icx - ir * 0.3 * o, icy - irh * 0.38, ir * 0.55)
        m2 = _star_mask(S, icx + ir * 0.42 * o, icy + irh * 0.42, ir * 0.26)
        m = Image.fromarray(np.maximum(np.array(m), np.array(m2)))
    else:
        m = _ellipse_mask(S, icx - ir * 0.32 * o, icy - irh * 0.42, ir * 0.34, irh * 0.24)
        m2 = _ellipse_mask(S, icx + ir * 0.4 * o, icy + irh * 0.46, ir * 0.15, irh * 0.1)
        m = Image.fromarray(np.maximum(np.array(m), np.array(m2)))
    m = Image.fromarray(np.minimum(np.array(m), np.array(white)))
    img.paste(hl, (0, 0), m)
    # sleepy lid: a skin band over the top third
    if sleepy:
        lid = _poly_mask(S, [(cx - w * 0.62, top - 4), (cx + w * 0.62, top - 4), (cx + w * 0.62, top + hh * 0.30), (cx, top + hh * 0.36), (cx - w * 0.62, top + hh * 0.30)])
        lid = Image.fromarray(np.minimum(np.array(lid), np.array(white)))
        skin_rgba = tuple(int(c * 255) for c in srgb(mix(_cur_skin[0], '#f0c8c0', 0.25))) + (255,)
        img.paste(Image.new('RGBA', (S, S), skin_rgba), (0, 0), lid)
    # upper lash line
    lid_y = top + hh * (0.30 if sleepy else 0.04)
    lw = w * (0.19 if not adult else 0.18)
    stroke = _bez((cx - w * 0.56 * o, lid_y + hh * 0.18), (cx - w * 0.2 * o, lid_y - hh * 0.04), (cx + w * 0.3 * o, lid_y - hh * 0.06 - lift), (cx + w * 0.62 * o, lid_y + hh * 0.06 - lift))
    _stroke(d, stroke, lash, lw, taper=True)
    # outer flick
    flick = _bez((cx + w * 0.42 * o, lid_y - hh * 0.05 - lift), (cx + w * 0.68 * o, lid_y - hh * 0.1 - lift), (cx + w * 0.78 * o, lid_y - hh * 0.12 - lift), (cx + w * (0.9 if adult else 0.8) * o, lid_y - hh * (0.24 if adult else 0.16) - lift))
    _stroke(d, flick, lash, lw * 0.55, taper=True)
    # lower lash hint
    low = _bez((cx + w * 0.1 * o, bot + hh * 0.02), (cx + w * 0.3 * o, bot - hh * 0.01), (cx + w * 0.45 * o, cy + hh * 0.35), (cx + w * 0.5 * o, cy + hh * 0.22))
    _stroke(d, low, mix(lash, '#ffffff', 0.25), lw * 0.28, taper=False)
    # tiny lower lashes (two ticks)
    for k, f in enumerate((0.3, 0.5)):
        x = cx + w * f * o
        y = bot - hh * (0.02 + 0.06 * k)
        d.line([(x, y), (x + w * 0.05 * o, y + hh * 0.11)], fill=_rgb(lash), width=max(1, int(lw * 0.22)))


_cur_skin = ['#ffe4d6']


def _ring(S, cx, cy, rx, ry, t, color):
    m = Image.new('L', (S, S), 0)
    dd = ImageDraw.Draw(m)
    dd.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    dd.ellipse((cx - rx + t, cy - ry + t, cx + rx - t, cy + ry - t), fill=0)
    out = Image.new('RGBA', (S, S), _rgb(color) + (0,))
    out.putalpha(m)
    return out


def _star_mask(S, x, y, r):
    pts = []
    for i in range(8):
        a = i / 8 * math.pi * 2 - math.pi / 2
        rr = r if i % 2 == 0 else r * 0.32
        pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
    return _poly_mask(S, pts)


def _rgb(h):
    return tuple(int(c * 255) for c in srgb(h))


def _stroke(d, pts, color, width, taper=False):
    """Smooth variable-width stroke drawn as one filled polygon (no beading)."""
    n = len(pts)
    if n < 2:
        return
    left, right = [], []
    for i in range(n):
        p = pts[i]
        if i == 0:
            tx, ty = pts[1][0] - p[0], pts[1][1] - p[1]
        elif i == n - 1:
            tx, ty = p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]
        else:
            tx, ty = pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1]
        l = math.hypot(tx, ty) or 1.0
        nx, ny = -ty / l, tx / l
        t = i / max(1, n - 1)
        w = width
        if taper:
            w = width * (0.25 + 0.75 * math.sin(math.pi * min(1.0, 0.12 + t * 0.88)))
        left.append((p[0] + nx * w / 2, p[1] + ny * w / 2))
        right.append((p[0] - nx * w / 2, p[1] - ny * w / 2))
    d.polygon(left + list(reversed(right)), fill=_rgb(color))
    if not taper:
        for p in (pts[0], pts[-1]):
            d.ellipse((p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2), fill=_rgb(color))


def arc_eye(d, cx, cy, w, lash, direction, S, lashes=False, side=1):
    k = -1 if direction == 'up' else 1
    pts = _bez((cx - w * 0.52, cy - k * w * 0.02), (cx - w * 0.25, cy + k * w * 0.30), (cx + w * 0.25, cy + k * w * 0.30), (cx + w * 0.52, cy - k * w * 0.02))
    _stroke(d, pts, lash, w * 0.15, taper=True)
    if lashes:
        for f in (0.3, 0.5):
            x = cx + side * w * f
            y = cy + w * 0.14
            d.line([(x, y), (x + side * w * 0.1, y + w * 0.14)], fill=_rgb(lash), width=max(1, int(w * 0.05)))


def cross_eye(d, cx, cy, w, lash, S, side):
    # ">_<" : two strokes meeting towards the nose
    inner = cx - side * w * 0.35
    outer = cx + side * w * 0.3
    _stroke(d, [(outer, cy - w * 0.22), (inner, cy)], lash, w * 0.13)
    _stroke(d, [(inner, cy), (outer, cy + w * 0.22)], lash, w * 0.13)


def swirl(d, cx, cy, r, lash, S):
    pts = []
    for i in range(70):
        a = i / 70 * math.pi * 5
        rr = r * (a / (math.pi * 5))
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * 1.1))
    _stroke(d, pts, lash, r * 0.16)


def brows(d, S, by, dx, ew, lash_color, kind):
    for side in (-1, 1):
        cx = (0.5 + side * dx) * S
        y = by * S
        inner, outer = 0.0, 0.0
        if kind == 'determined':
            inner, outer = 0.06, -0.03
        elif kind in ('shy', 'wobble'):
            inner, outer = -0.05, 0.03
        elif kind == 'smug':
            inner, outer = (0.02, -0.02) if side > 0 else (-0.03, 0.01)
        elif kind == 'up':
            inner, outer = -0.03, -0.03
        elif kind == 'happy':
            inner, outer = -0.02, 0.0
        pts = _bez((cx - side * ew * 0.42, y + inner * S), (cx - side * ew * 0.1, y - ew * 0.12 + (inner + outer) * 0.5 * S), (cx + side * ew * 0.2, y - ew * 0.10 + outer * S), (cx + side * ew * 0.5, y + outer * S + ew * 0.04))
        _stroke(d, pts, lash_color, ew * 0.085, taper=True)


def blush(img, S, cy, dx, strong, skin):
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for side in (-1, 1):
        cx = (0.5 + side * dx) * S
        y = cy * S
        rx, ry = 0.11 * S, 0.055 * S
        ld.ellipse((cx - rx, y - ry, cx + rx, y + ry), fill=_rgb(mix('#ff7d9a', skin, 0.1)) + (int(255 * (0.55 if strong else 0.38)),))
        if strong:
            for k in (-1, 0, 1):
                ld.line([(cx + k * 0.05 * S + 0.015 * S, y - 0.03 * S), (cx + k * 0.05 * S - 0.01 * S, y + 0.03 * S)], fill=_rgb('#ff5f86') + (170,), width=max(1, int(0.012 * S)))
    layer = layer.filter(ImageFilter.GaussianBlur(S * 0.02))
    img.alpha_composite(layer)


def mouth(d, S, cx_f, cy_f, kind, color, adult):
    cx, cy = cx_f * S, cy_f * S
    s = (0.9 if adult else 1.0) * S
    w = max(1, int(0.016 * S))
    rgb = _rgb(color)
    if kind in ('cheer', 'cheerful'):
        pts = [(cx - 0.075 * s, cy - 0.02 * s)] + _bez((cx - 0.075 * s, cy - 0.02 * s), (cx - 0.05 * s, cy + 0.09 * s), (cx + 0.05 * s, cy + 0.09 * s), (cx + 0.075 * s, cy - 0.02 * s))
        d.polygon(pts, fill=_rgb('#9b2b3e'))
        d.ellipse((cx - 0.045 * s, cy + 0.025 * s, cx + 0.045 * s, cy + 0.075 * s), fill=_rgb('#ff8fa3'))
        d.line(pts, fill=rgb, width=w)
    elif kind == 'smug':
        _stroke(d, _bez((cx - 0.065 * s, cy - 0.012 * s), (cx - 0.035 * s, cy + 0.03 * s), (cx - 0.01 * s, cy + 0.03 * s), (cx, cy - 0.004 * s)), color, w)
        _stroke(d, _bez((cx, cy - 0.004 * s), (cx + 0.01 * s, cy + 0.03 * s), (cx + 0.035 * s, cy + 0.03 * s), (cx + 0.065 * s, cy - 0.02 * s)), color, w)
    elif kind == 'calm':
        _stroke(d, _bez((cx - 0.035 * s, cy), (cx - 0.015 * s, cy + 0.014 * s), (cx + 0.015 * s, cy + 0.014 * s), (cx + 0.035 * s, cy)), color, w)
    elif kind == 'determined':
        _stroke(d, _bez((cx - 0.045 * s, cy + 0.01 * s), (cx - 0.02 * s, cy - 0.01 * s), (cx + 0.02 * s, cy - 0.01 * s), (cx + 0.045 * s, cy + 0.01 * s)), color, w)
    elif kind in ('shy', 'wobble'):
        _stroke(d, _bez((cx - 0.05 * s, cy + 0.004 * s), (cx - 0.03 * s, cy - 0.025 * s), (cx - 0.01 * s, cy + 0.02 * s), (cx, cy + 0.002 * s)), color, w)
        _stroke(d, _bez((cx, cy + 0.002 * s), (cx + 0.01 * s, cy - 0.02 * s), (cx + 0.03 * s, cy + 0.03 * s), (cx + 0.05 * s, cy)), color, w)
    elif kind == 'o':
        d.ellipse((cx - 0.022 * s, cy - 0.028 * s, cx + 0.022 * s, cy + 0.028 * s), fill=_rgb('#9b2b3e'), outline=rgb, width=max(1, w // 2))
    else:  # smile
        _stroke(d, _bez((cx - 0.055 * s, cy - 0.012 * s), (cx - 0.03 * s, cy + 0.04 * s), (cx + 0.03 * s, cy + 0.04 * s), (cx + 0.055 * s, cy - 0.012 * s)), color, w, taper=True)


def write_atlas(unit, path, cell_px=256, eye_v=0.40):
    _cur_skin[0] = unit.get('palette', {}).get('skin', '#ffe4d6')
    img = build_atlas(unit, cell_px, eye_v)
    img.save(path, optimize=True)
    return path
