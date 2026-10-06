"""Painted enemy faces (PIL), one atlas per family — the jaeysart approach: the face is a
texture, not geometry. Big glossy eyes placed low on the head, a tiny mouth, blush for the
cute families, glowing ovals for the spooky ones, a visor for machines.

Atlas: 3 x 2 cells (idle, blink, hit, angry, dead, cast). Each cell maps onto the front of
the head (u across the face box, v chin -> top). The background is transparent so the
vertex-coloured (tinted) skin shows through; every cell keeps a transparent margin so
the body's "no face" UV corner stays clear after the runtime shifts the texture offset.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

CELLS = ['idle', 'blink', 'hit', 'angry', 'dead', 'cast']
COLS, ROWS = 3, 2
SS = 3

# Per-family face spec. eyes: round | sharp | angry | glow | visor | dot.
# eye_v is the eye line as a fraction of the face box height (0 = chin, 1 = top).
FACES = {
    'slime': dict(eyes='round', iris='#2f2a4a', sclera='#ffffff', lash='#2f2a4a', mouth='smile', blush=True, eye_w=0.25, eye_h=0.29, eye_dx=0.20, eye_v=0.50),
    'goblin': dict(eyes='sharp', iris='#f8b733', pupil='slit', sclera='#fff8e1', lash='#2b2416', mouth='fangs', blush=False, eye_w=0.22, eye_h=0.24, eye_dx=0.19, eye_v=0.52),
    'orc': dict(eyes='angry', iris='#ffd166', pupil='round', sclera='#f6f1e3', lash='#1f2316', mouth='grin', blush=False, eye_w=0.18, eye_h=0.19, eye_dx=0.17, eye_v=0.56, brows=True),
    'ghost': dict(eyes='glow', glow='#dde8ff', core='#ffffff', mouth='o', blush=True, eye_w=0.18, eye_h=0.24, eye_dx=0.19, eye_v=0.50, mouth_color='#5b6cc9'),
    'ghoul': dict(eyes='glow', glow='#8ef0ff', core='#ffffff', mouth='fangs', blush=False, eye_w=0.17, eye_h=0.20, eye_dx=0.18, eye_v=0.52, mouth_color='#2b1f3a'),
    'oni': dict(eyes='angry', iris='#ffd166', pupil='round', sclera='#ffffff', lash='#2b1a1a', mouth='fangs', blush=False, eye_w=0.21, eye_h=0.23, eye_dx=0.19, eye_v=0.52, brows=True),
    'lizard': dict(eyes='sharp', iris='#ffd34d', pupil='slit', sclera='#fff6d6', lash='#2f2a1c', mouth='flat', blush=False, eye_w=0.2, eye_h=0.22, eye_dx=0.22, eye_v=0.56),
    'construct': dict(eyes='visor', glow='#9be7ff', core='#ffffff', mouth='zigzag', blush=False, eye_w=0.2, eye_h=0.16, eye_dx=0.19, eye_v=0.54, mouth_color='#9be7ff'),
    'beast': dict(eyes='round', iris='#ffb347', pupil='round', sclera='#ffffff', lash='#2a2420', mouth='fangs', blush=False, eye_w=0.19, eye_h=0.21, eye_dx=0.19, eye_v=0.56),
    'fae': dict(eyes='round', iris='#8a4fd3', pupil='round', sclera='#ffffff', lash='#3b2d55', mouth='smile', blush=True, eye_w=0.25, eye_h=0.3, eye_dx=0.2, eye_v=0.48, sparkle=True),
    'plant': dict(eyes='dot', iris='#2b2a33', mouth='smile', blush=True, eye_w=0.16, eye_h=0.18, eye_dx=0.2, eye_v=0.52),
    'dragon': dict(eyes='sharp', iris='#ffd166', pupil='slit', sclera='#fff3d6', lash='#2e1a1a', mouth='fangs', blush=False, eye_w=0.2, eye_h=0.21, eye_dx=0.2, eye_v=0.56, brows=True),
}


def _rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _mix(a, b, t):
    ca, cb = _rgb(a), _rgb(b)
    return '#%02x%02x%02x' % tuple(int(ca[i] * (1 - t) + cb[i] * t) for i in range(3))


def _bez(p0, p1, p2, p3, n=18):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        pts.append((u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
                    u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]))
    return pts


def _stroke(d, pts, color, width, taper=False):
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
        w = width
        if taper:
            t = i / max(1, n - 1)
            w = width * (0.3 + 0.7 * math.sin(math.pi * min(1.0, 0.1 + t * 0.9)))
        left.append((p[0] + nx * w / 2, p[1] + ny * w / 2))
        right.append((p[0] - nx * w / 2, p[1] - ny * w / 2))
    d.polygon(left + list(reversed(right)), fill=_rgb(color) + (255,))
    if not taper:
        for p in (pts[0], pts[-1]):
            d.ellipse((p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2), fill=_rgb(color) + (255,))


def _ellipse_mask(S, cx, cy, rx, ry):
    m = Image.new('L', (S, S), 0)
    ImageDraw.Draw(m).ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    return m


def _vgrad(S, y0, y1, c0, c1):
    a = np.arange(S, dtype=np.float32)
    t = np.clip((a - y0) / max(1.0, (y1 - y0)), 0, 1)
    ca, cb = np.array(_rgb(c0), np.float32), np.array(_rgb(c1), np.float32)
    col = ca[None, :] * (1 - t[:, None]) + cb[None, :] * t[:, None]
    arr = np.repeat(col[:, None, :], S, axis=1).astype(np.uint8)
    return Image.fromarray(np.dstack([arr, np.full((S, S), 255, np.uint8)]), 'RGBA')


def _paste(img, color_img, mask):
    img.paste(color_img, (0, 0), mask)


def _solid(S, hexcol, a=255):
    return Image.new('RGBA', (S, S), _rgb(hexcol) + (a,))


# ---------------------------------------------------------------------------
# Eyes
# ---------------------------------------------------------------------------

def eye_glossy(img, cx, cy, w, h, side, spec, style='round', angry=False, bright=False, small=False):
    """Sclera + iris gradient + pupil + highlights + lid stroke (the cute anime eye)."""
    S = img.size[0]
    d = ImageDraw.Draw(img)
    o = side
    lash = spec.get('lash', '#2b2440')
    sharp = style in ('sharp', 'angry') or angry
    hh = h * (0.86 if sharp else 1.0)
    top = cy - hh * 0.5
    bot = cy + hh * 0.5
    lift = hh * (0.22 if angry else (0.12 if sharp else 0.0))
    # sclera: rounder bottom, flatter top; outer corner on the +o side
    outline = (_bez((cx - w * 0.5 * o, top + hh * 0.25), (cx - w * 0.25 * o, top + hh * 0.02), (cx + w * 0.25 * o, top + hh * 0.02 - lift), (cx + w * 0.5 * o, top + hh * 0.16 - lift))
               + _bez((cx + w * 0.5 * o, top + hh * 0.16 - lift), (cx + w * 0.62 * o, cy + hh * 0.3), (cx + w * 0.3 * o, bot + hh * 0.02), (cx, bot))
               + _bez((cx, bot), (cx - w * 0.36 * o, bot), (cx - w * 0.6 * o, cy + hh * 0.3), (cx - w * 0.5 * o, top + hh * 0.25)))
    white = Image.new('L', (S, S), 0)
    ImageDraw.Draw(white).polygon(outline, fill=255)
    # dark rim around the sclera (keeps the eye readable on any skin colour)
    rim = white.filter(ImageFilter.MaxFilter(int(w * 0.09) * 2 + 1))
    _paste(img, _solid(S, lash), rim)
    _paste(img, _solid(S, spec.get('sclera', '#ffffff')), white)
    iris = spec.get('iris', '#2f2a4a')
    cute = style == 'round' and not angry
    ir = w * (0.34 if small else (0.5 if cute else 0.44))
    irh = hh * (0.4 if small else (0.58 if cute else 0.52))
    icx = cx + w * 0.03 * o
    icy = cy + hh * (0.1 if not small else 0.05)
    im = _ellipse_mask(S, icx, icy, ir, irh)
    im = Image.fromarray(np.minimum(np.array(im), np.array(white)))
    if bright:
        grad = _vgrad(S, icy - irh, icy + irh, _mix(iris, '#ffffff', 0.1), _mix(iris, '#ffffff', 0.6))
    else:
        grad = _vgrad(S, icy - irh, icy + irh, _mix(iris, '#000000', 0.5), _mix(iris, '#ffffff', 0.35))
    _paste(img, grad, im)
    # pupil (a glowing core when casting)
    pupil = spec.get('pupil', 'round')
    if pupil == 'slit':
        pm = _ellipse_mask(S, icx, icy, ir * (0.3 if bright else 0.17), irh * 0.62)
    else:
        pm = _ellipse_mask(S, icx, icy - irh * 0.02, ir * 0.42, irh * 0.46)
    pm = Image.fromarray(np.minimum(np.array(pm), np.array(white)))
    _paste(img, _solid(S, '#ffffff' if bright else _mix(iris, '#000000', 0.78)), pm)
    # lid shadow band at the top of the sclera
    sh = Image.new('L', (S, S), 0)
    shd = ImageDraw.Draw(sh)
    steps = 30
    for i in range(steps):
        a = int(140 * (1 - i / steps) ** 1.6)
        shd.rectangle((cx - w, top + hh * 0.38 * i / steps, cx + w, top + hh * 0.38 * (i + 1) / steps + 1), fill=a)
    sh = Image.fromarray(np.minimum(np.array(sh), np.array(white)))
    _paste(img, _solid(S, '#2a2042'), sh)
    # highlights
    hl = _solid(S, '#ffffff')
    if spec.get('sparkle'):
        m = _star_mask(S, icx - ir * 0.3 * o, icy - irh * 0.35, ir * 0.5)
        m2 = _star_mask(S, icx + ir * 0.42 * o, icy + irh * 0.42, ir * 0.24)
    else:
        m = _ellipse_mask(S, icx - ir * 0.34 * o, icy - irh * 0.4, ir * 0.3, irh * 0.22)
        m2 = _ellipse_mask(S, icx + ir * 0.4 * o, icy + irh * 0.45, ir * 0.14, irh * 0.1)
    m = Image.fromarray(np.minimum(np.maximum(np.array(m), np.array(m2)), np.array(white)))
    _paste(img, hl, m)
    # upper lash line (thin and soft on cute eyes, thicker and more slanted when angry)
    lw = w * (0.2 if sharp else (0.12 if cute else 0.17))
    lid_y = top + hh * 0.05
    stroke = _bez((cx - w * 0.55 * o, lid_y + hh * 0.2), (cx - w * 0.2 * o, lid_y - hh * 0.04), (cx + w * 0.3 * o, lid_y - hh * 0.05 - lift), (cx + w * 0.6 * o, lid_y + hh * 0.06 - lift))
    _stroke(d, stroke, lash, lw, taper=True)
    if not cute:
        flick = _bez((cx + w * 0.42 * o, lid_y - hh * 0.04 - lift), (cx + w * 0.66 * o, lid_y - hh * 0.1 - lift), (cx + w * 0.76 * o, lid_y - hh * 0.12 - lift), (cx + w * 0.82 * o, lid_y - hh * 0.2 - lift))
        _stroke(d, flick, lash, lw * 0.55, taper=True)
    if angry:
        # heavy slanted lid cutting the top of the eye: inner corner low, outer corner high
        cut = [(cx - w * 0.7 * o, top + hh * 0.42), (cx + w * 0.75 * o, top - hh * 0.25), (cx + w * 0.75 * o, top - hh * 0.9), (cx - w * 0.7 * o, top - hh * 0.9)]
        cm = Image.new('L', (S, S), 0)
        ImageDraw.Draw(cm).polygon(cut, fill=255)
        cm = Image.fromarray(np.minimum(np.array(cm), np.array(rim)))
        _paste(img, _solid(S, lash), cm)


def eye_glow(img, cx, cy, w, h, side, spec, bright=False, narrow=False):
    S = img.size[0]
    glow = spec.get('glow', '#9be7ff')
    core = spec.get('core', '#ffffff')
    hh = h * (0.55 if narrow else 1.0)
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse((cx - w * 0.7, cy - hh * 0.8, cx + w * 0.7, cy + hh * 0.8), fill=_rgb(glow) + (150,))
    layer = layer.filter(ImageFilter.GaussianBlur(S * 0.03))
    img.alpha_composite(layer)
    d = ImageDraw.Draw(img)
    if narrow:
        pts = [(cx - w * 0.5, cy), (cx, cy - hh * 0.5), (cx + w * 0.5, cy), (cx, cy + hh * 0.5)]
        d.polygon(pts, fill=_rgb(glow) + (255,))
    else:
        d.ellipse((cx - w * 0.5, cy - hh * 0.5, cx + w * 0.5, cy + hh * 0.5), fill=_rgb(glow) + (255,))
    d.ellipse((cx - w * 0.26, cy - hh * (0.3 if not narrow else 0.22), cx + w * 0.26, cy + hh * (0.3 if not narrow else 0.22)), fill=_rgb(core if bright else _mix(glow, '#ffffff', 0.55)) + (255,))


def eye_visor(img, cx, cy, w, h, side, spec, bright=False, narrow=False, angry=False):
    S = img.size[0]
    glow = spec.get('glow', '#9be7ff')
    d = ImageDraw.Draw(img)
    hh = h * (0.35 if narrow else 1.0)
    # dark lens housing + glowing bar
    d.rounded_rectangle((cx - w * 0.62, cy - h * 0.62, cx + w * 0.62, cy + h * 0.62), radius=h * 0.3, fill=(30, 34, 46, 255))
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    if angry:
        pts = [(cx - w * 0.5 * side, cy + hh * 0.35), (cx + w * 0.5 * side, cy - hh * 0.25), (cx + w * 0.5 * side, cy + hh * 0.45), (cx - w * 0.5 * side, cy + hh * 0.5)]
        ld.polygon(pts, fill=_rgb(glow) + (255,))
    else:
        ld.rounded_rectangle((cx - w * 0.5, cy - hh * 0.5, cx + w * 0.5, cy + hh * 0.5), radius=hh * 0.4, fill=_rgb(glow) + (255,))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(S * 0.012)))
    img.alpha_composite(layer)
    if bright:
        d.rounded_rectangle((cx - w * 0.3, cy - hh * 0.25, cx + w * 0.3, cy + hh * 0.25), radius=hh * 0.2, fill=(255, 255, 255, 255))


def eye_dot(img, cx, cy, w, h, side, spec, bright=False):
    d = ImageDraw.Draw(img)
    col = spec.get('iris', '#2b2a33')
    r = min(w, h) * 0.46
    d.ellipse((cx - r, cy - r * 1.1, cx + r, cy + r * 1.1), fill=_rgb(col) + (255,))
    d.ellipse((cx - r * 0.55 * side - r * 0.25, cy - r * 0.7, cx - r * 0.55 * side + r * 0.25, cy - r * 0.2), fill=(255, 255, 255, 255))
    if bright:
        d.ellipse((cx - r * 0.5, cy - r * 0.5, cx + r * 0.5, cy + r * 0.5), fill=_rgb(_mix(col, '#ffffff', 0.6)) + (255,))


def _star_mask(S, x, y, r):
    pts = []
    for i in range(8):
        a = i / 8 * math.pi * 2 - math.pi / 2
        rr = r if i % 2 == 0 else r * 0.32
        pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
    m = Image.new('L', (S, S), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m


def arc_eye(d, cx, cy, w, color, direction='down'):
    k = -1 if direction == 'up' else 1
    pts = _bez((cx - w * 0.5, cy - k * w * 0.02), (cx - w * 0.25, cy + k * w * 0.3), (cx + w * 0.25, cy + k * w * 0.3), (cx + w * 0.5, cy - k * w * 0.02))
    _stroke(d, pts, color, w * 0.17, taper=True)


def cross_eye(d, cx, cy, w, color, side):
    inner = cx - side * w * 0.35
    outer = cx + side * w * 0.32
    _stroke(d, [(outer, cy - w * 0.24), (inner, cy)], color, w * 0.15)
    _stroke(d, [(inner, cy), (outer, cy + w * 0.24)], color, w * 0.15)


def x_eye(d, cx, cy, w, color):
    _stroke(d, [(cx - w * 0.32, cy - w * 0.32), (cx + w * 0.32, cy + w * 0.32)], color, w * 0.16)
    _stroke(d, [(cx + w * 0.32, cy - w * 0.32), (cx - w * 0.32, cy + w * 0.32)], color, w * 0.16)


# ---------------------------------------------------------------------------
# Brows, mouths, blush
# ---------------------------------------------------------------------------

def brows(d, S, by, dx, ew, color, kind):
    for side in (-1, 1):
        cx = (0.5 + side * dx) * S
        y = by * S
        if kind == 'angry':
            inner, outer = 0.07, -0.04
        elif kind == 'hurt':
            inner, outer = -0.06, 0.03
        elif kind == 'up':
            inner, outer = -0.03, -0.03
        else:
            inner, outer = 0.0, 0.0
        pts = _bez((cx - side * ew * 0.45, y + inner * S), (cx - side * ew * 0.1, y - ew * 0.1 + (inner + outer) * 0.5 * S), (cx + side * ew * 0.2, y - ew * 0.08 + outer * S), (cx + side * ew * 0.55, y + outer * S + ew * 0.05))
        _stroke(d, pts, color, ew * (0.13 if kind == 'angry' else 0.1), taper=True)


def mouth(d, S, cx_f, cy_f, kind, color, spec):
    cx, cy = cx_f * S, cy_f * S
    s = S
    w = max(1, int(0.02 * S))
    rgb = _rgb(color) + (255,)
    if kind == 'smile':
        _stroke(d, _bez((cx - 0.06 * s, cy - 0.012 * s), (cx - 0.03 * s, cy + 0.045 * s), (cx + 0.03 * s, cy + 0.045 * s), (cx + 0.06 * s, cy - 0.012 * s)), color, w, taper=True)
    elif kind == 'grin':
        # wide cheeky grin with a dark inside and two little fangs
        top = _bez((cx - 0.11 * s, cy - 0.01 * s), (cx - 0.05 * s, cy + 0.0 * s), (cx + 0.05 * s, cy + 0.0 * s), (cx + 0.11 * s, cy - 0.01 * s))
        bot = _bez((cx + 0.11 * s, cy - 0.01 * s), (cx + 0.06 * s, cy + 0.075 * s), (cx - 0.06 * s, cy + 0.075 * s), (cx - 0.11 * s, cy - 0.01 * s))
        d.polygon(top + bot, fill=_rgb('#3a1c2b') + (255,))
        d.line(top, fill=rgb, width=w)
        for k in (-1, 1):
            x = cx + k * 0.06 * s
            d.polygon([(x - 0.018 * s, cy - 0.005 * s), (x + 0.018 * s, cy - 0.005 * s), (x, cy + 0.045 * s)], fill=(255, 255, 255, 255))
    elif kind == 'fangs':
        # small open grin: dark mouth, two fangs pointing down from the top lip
        top = _bez((cx - 0.085 * s, cy - 0.01 * s), (cx - 0.04 * s, cy + 0.005 * s), (cx + 0.04 * s, cy + 0.005 * s), (cx + 0.085 * s, cy - 0.01 * s))
        bot = _bez((cx + 0.085 * s, cy - 0.01 * s), (cx + 0.05 * s, cy + 0.06 * s), (cx - 0.05 * s, cy + 0.06 * s), (cx - 0.085 * s, cy - 0.01 * s))
        d.polygon(top + bot, fill=_rgb(spec.get('mouth_color', '#3a1c2b')) + (255,))
        d.line(top, fill=rgb, width=w)
        for k in (-1, 1):
            x = cx + k * 0.045 * s
            d.polygon([(x - 0.014 * s, cy - 0.004 * s), (x + 0.014 * s, cy - 0.004 * s), (x, cy + 0.035 * s)], fill=(255, 255, 255, 255))
    elif kind == 'o':
        d.ellipse((cx - 0.028 * s, cy - 0.034 * s, cx + 0.028 * s, cy + 0.034 * s), fill=_rgb(spec.get('mouth_color', '#3a1c2b')) + (255,), outline=rgb, width=max(1, w // 2))
    elif kind == 'flat':
        _stroke(d, [(cx - 0.05 * s, cy), (cx + 0.05 * s, cy)], color, w)
    elif kind == 'zigzag':
        pts = [(cx - 0.07 * s + i * 0.028 * s, cy + (0.016 * s if i % 2 else -0.016 * s)) for i in range(6)]
        _stroke(d, pts, color, w)
    elif kind == 'wobble':
        _stroke(d, _bez((cx - 0.055 * s, cy + 0.004 * s), (cx - 0.03 * s, cy - 0.03 * s), (cx - 0.01 * s, cy + 0.025 * s), (cx, cy)), color, w)
        _stroke(d, _bez((cx, cy), (cx + 0.01 * s, cy - 0.025 * s), (cx + 0.03 * s, cy + 0.03 * s), (cx + 0.055 * s, cy - 0.004 * s)), color, w)
    elif kind == 'frown':
        _stroke(d, _bez((cx - 0.06 * s, cy + 0.02 * s), (cx - 0.03 * s, cy - 0.025 * s), (cx + 0.03 * s, cy - 0.025 * s), (cx + 0.06 * s, cy + 0.02 * s)), color, w, taper=True)


def blush(img, S, cy, dx, strong):
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for side in (-1, 1):
        cx = (0.5 + side * dx) * S
        y = cy * S
        rx, ry = 0.11 * S, 0.055 * S
        ld.ellipse((cx - rx, y - ry, cx + rx, y + ry), fill=_rgb('#ff6f94') + (int(255 * (0.62 if strong else 0.5)),))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(S * 0.022)))


# ---------------------------------------------------------------------------

def draw_cell(px, spec, cell):
    S = px * SS
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    eye_cy = (1.0 - spec['eye_v'])
    dx = spec['eye_dx']
    ew, eh = spec['eye_w'] * S, spec['eye_h'] * S
    lash = spec.get('lash', '#2b2440')
    style = spec['eyes']
    mcol = spec.get('lash', spec.get('mouth_color', '#3a1c2b'))
    if spec.get('blush') and cell in ('idle', 'blink', 'cast'):
        blush(img, S, eye_cy + 0.14, 0.32, cell == 'cast')
    for side in (-1, 1):
        cx = (0.5 + side * dx) * S
        cy = eye_cy * S
        if cell == 'blink':
            if style == 'visor':
                eye_visor(img, cx, cy, ew, eh, side, spec, narrow=True)
            elif style == 'glow':
                eye_glow(img, cx, cy, ew, eh, side, spec, narrow=True)
            else:
                arc_eye(d, cx, cy + eh * 0.1, ew, lash, 'down')
        elif cell == 'hit':
            if style == 'visor':
                eye_visor(img, cx, cy, ew, eh, side, spec, narrow=True, angry=True)
            else:
                cross_eye(d, cx, cy, ew, lash if style != 'glow' else spec.get('glow', '#9be7ff'), side)
        elif cell == 'dead':
            x_eye(d, cx, cy, ew, lash if style != 'glow' else spec.get('glow', '#9be7ff'))
        elif style == 'glow':
            eye_glow(img, cx, cy, ew, eh, side, spec, bright=cell == 'cast', narrow=cell == 'angry')
        elif style == 'visor':
            eye_visor(img, cx, cy, ew, eh, side, spec, bright=cell == 'cast', angry=cell == 'angry')
        elif style == 'dot':
            eye_dot(img, cx, cy, ew, eh, side, spec, bright=cell == 'cast')
        else:
            eye_glossy(img, cx, cy, ew, eh, side, spec, style=style, angry=(cell == 'angry' or style == 'angry'), bright=cell == 'cast', small=cell == 'angry' and style != 'angry')
    if spec.get('brows') and cell in ('idle', 'angry', 'cast'):
        brows(d, S, eye_cy - 0.19, dx, ew, lash, 'angry')
    elif cell == 'angry' and style not in ('glow', 'visor', 'dot'):
        brows(d, S, eye_cy - 0.19, dx, ew, lash, 'angry')
    elif cell == 'hit' and style not in ('glow', 'visor'):
        brows(d, S, eye_cy - 0.2, dx, ew, lash, 'hurt')
    mk = spec['mouth']
    if cell == 'hit':
        mk = 'wobble'
    elif cell == 'dead':
        mk = 'flat' if mk not in ('o',) else 'o'
    elif cell == 'cast':
        mk = 'o' if mk in ('smile', 'flat', 'o') else 'grin'
    elif cell == 'angry':
        mk = 'grin' if mk in ('smile', 'fangs', 'grin') else ('frown' if mk == 'flat' else mk)
    mouth(d, S, 0.5, eye_cy + 0.2, mk, mcol, spec)
    return img.resize((px, px), Image.LANCZOS)


def build_atlas(family, cell_px=128, spec=None):
    spec = spec or FACES.get(family, FACES['slime'])
    atlas = Image.new('RGBA', (cell_px * COLS, cell_px * ROWS), (0, 0, 0, 0))
    for i, name in enumerate(CELLS):
        atlas.paste(draw_cell(cell_px, spec, name), ((i % COLS) * cell_px, (i // COLS) * cell_px))
    return atlas


def write_atlas(family, path, cell_px=128, spec=None):
    img = build_atlas(family, cell_px, spec)
    img.save(path, optimize=True)
    return path


def write_atlas_small(src, dst):
    """Palette-quantised copy (keeps alpha) for the final GLB."""
    img = Image.open(src).convert('RGBA')
    q = img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(dst, optimize=True)
    return dst
