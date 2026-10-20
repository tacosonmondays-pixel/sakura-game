#!/usr/bin/env python3
"""Coming-soon portraits for girls whose painted art is still in progress.

Each girl gets a little "construction site" card: a white enamel signboard (rounded corners, a blue
border, four screws) held by a painter's easel (its mast and top holder show above the plate)
behind two sakura-pink traffic cones and a striped cone bar. On the plate: a die-cut sakura sticker
on the top-left corner, a chibi mascot that is HER OWN silhouette in her own colours (hair shape:
twin-tails, buns, braid, ponytail, waves, horns, cat ears; her uniform in her outfit colour, a
sailor collar on a sailor uniform, her accent on the bow) wearing a little yellow hard hat and
painting her own portrait with a brush and a palette (a wet heart she has just painted beside her
brush), a blue "ART IN PROGRESS" band and "COMING SOON". Behind the sign: a gradient in her
colour, a faint sketchbook grid, bokeh and drifting petals.

Draws, for each listed girl, the six portrait files src/art/portraits.js expects in
public/art/portraits/ (all .webp):

  <id>-full.webp   768x1024  the whole site: sign, easel, cones, cone bar, background
  <id>-card.webp   300x500   the sign centred (plate top ~11 %, cones under the name band); no
                             baked name, rarity or level (every list card draws those on top)
  <id>-bust.webp   512x512   the mascot on the plate, her face in the upper third
  <id>-thumb.webp  160x160   just her hard-hat head on her colour (kept < 20 KB)
  <id>-cut.webp    transparent signboard on its easel with the cones, 1000 px tall
  <id>-cut-s.webp  the same, 360 px tall

Everything is vector-drawn with Pillow at 4x and downsampled (no generators, no network, no
third-party images). Fonts: Barlow Condensed 700 / 600 from src/ui/styles/fonts (the UI's caps
label face, OFL); if they are missing, DejaVu Sans Bold from the system, with a warning.

Names, titles, palettes and looks are read from the roster (src/data/units.js) through node, so
the colours are never written twice. Prints the PORTRAIT_DATA lines (face + cut aspect) to paste
into src/art/portraits.js.

It never overwrites art: a girl who already has portrait files in public/art/portraits (every
painted girl, the nine returning girls included) is skipped by default and refused by id unless
--force is given (or --out points somewhere else, e.g. a review folder).

Usage (from the repo root):
  python3 -I tools/art/placeholder_portraits.py            # every roster girl with no portrait files yet
  python3 -I tools/art/placeholder_portraits.py <id> ...   # just these (new girls without art)
Options: --root DIR (repo to read data and fonts from), --out DIR (default public/art/portraits),
--sheets DIR (also write sheet-cards.png and sheet-sizes.png there for review), --ss N (supersampling),
--force (replace existing portrait files in public/art/portraits with the sign).
"""

import argparse
import colorsys
import json
import math
import os
import random
import subprocess
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
FALLBACK_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
SS = 4  # supersampling factor for every drawing (set by --ss)

# ---------------------------------------------------------------------------------------------
# colours: the UI tokens (src/ui/styles/base.css + the UI direction)

WHITE = (255, 255, 255)
INK = (31, 42, 68)            # --ink: every outline
NAVY = (34, 56, 92)           # --navy
SIGN_BLUE = (29, 92, 196)     # the plate border and the band (between --blue and --blue-text)
SKY = (159, 208, 255)         # --sky-3
SKY_1 = (234, 246, 255)       # --sky-1
YELLOW = (255, 221, 74)       # --yellow
YELLOW_DEEP = (242, 183, 5)   # --yellow-deep
PINK = (255, 122, 168)        # --pink
PINK_SOFT = (255, 224, 236)   # --pink-soft
PINK_DEEP = (226, 72, 128)
STEEL = (226, 233, 242)
WOOD = (241, 205, 150)
WOOD_DEEP = (214, 166, 104)

# Per-girl choice of the background hue when her hair colour is not the best one (key into her
# palette). Everyone else uses her hair colour, or her accent when her hair is near black.
THEME_KEY = {'hana': 'outfit'}


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def lum(c):
    return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255


def sat(c):
    mx, mn = max(c), min(c)
    return 0 if mx == 0 else (mx - mn) / mx


def apart(a, b):
    """True when two colours read as different: hues 35+ degrees apart (both coloured) or lightness
    0.16+ apart."""
    ha = colorsys.rgb_to_hsv(*[v / 255 for v in a])[0] * 360
    hb = colorsys.rgb_to_hsv(*[v / 255 for v in b])[0] * 360
    dh = min(abs(ha - hb), 360 - abs(ha - hb))
    return (dh >= 35 and sat(a) > 0.2 and sat(b) > 0.2) or abs(lum(a) - lum(b)) >= 0.16


def rgba(c, a=255):
    return (c[0], c[1], c[2], a)


def colours(u):
    """Her colours for the card: sig (mascot silhouette), theme (background), light (hair light)."""
    pal = {k: rgb(v) for k, v in u['palette'].items()}
    sig = None
    for t in (0, 0.25, 0.5, 0.75, 1):
        c = mix(pal['hair'], pal['hairShade'], t)
        if lum(c) <= 0.5:
            sig = c
            break
    if sig is None:
        sig = pal['hairShade']
        while lum(sig) > 0.5:
            sig = mix(sig, INK, 0.12)
    key = THEME_KEY.get(u['id'])
    if key:
        theme = pal[key]
    elif lum(pal['hair']) < 0.3 or sat(pal['hair']) < 0.25:
        theme = pal['accent'] if sat(pal['accent']) >= 0.25 else pal['hairShade']
    else:
        theme = pal['hair']
    # her accent for the bow, the brush tip and one splat (Hana's gold, Noa's mint, Ena's red...), pink
    # when it is too pale or too grey to show
    paint = pal['accent'] if sat(pal['accent']) > 0.38 and 0.25 < lum(pal['accent']) < 0.8 else PINK
    # her uniform in her own outfit colour (a near-white outfit takes half of its shade so it still
    # reads on the white plate; one too close to her hair is pushed away from it in lightness, so
    # a light coat under mid hair gets lighter and a dark one darker)
    body = pal['outfit']
    if lum(body) > 0.78:
        body = mix(body, pal['outfitShade'], 0.5)
    if u['look'].get('hairStyle') in ('wavy', 'twintails', 'braid', 'ponytail'):  # hair falls over the body
        away = mix(body, WHITE, 0.5) if lum(body) >= lum(sig) else mix(pal['outfitShade'], INK, 0.3)
        for _ in range(4):
            if apart(body, sig):
                break
            body = mix(body, away, 0.35)
    return {
        'pal': pal, 'sig': sig, 'theme': theme, 'paint': paint,
        'sig_light': mix(sig, WHITE, 0.42),
        'body': body,
        'legs': mix(pal['outfitShade'], INK, 0.45),
        'skin': pal['skin'],
    }


# ---------------------------------------------------------------------------------------------
# data

KINDS = ('full', 'card', 'bust', 'thumb', 'cut', 'cut-s')


def has_portrait_files(art_dir, uid):
    """True when any of her six portrait files already exists (painted art or an earlier sign)."""
    return any(os.path.exists(os.path.join(art_dir, f'{uid}-{k}.webp')) for k in KINDS)


def load_units(ids):
    code = (
        "import { UNITS } from './src/data/units.js';"
        "console.log(JSON.stringify(UNITS.map((u) => ({ id: u.id, name: u.name, title: u.title,"
        " adult: !!u.adult, palette: u.palette, look: u.look }))));"
    )
    raw = subprocess.run(['node', '--input-type=module', '-e', code], cwd=ROOT, check=True,
                         capture_output=True, text=True).stdout
    units = json.loads(raw)
    if ids:
        units = [u for u in units if u['id'] in ids]
        missing = set(ids) - {u['id'] for u in units}
        if missing:
            sys.exit(f'unknown ids: {", ".join(sorted(missing))}')
    return units


# ---------------------------------------------------------------------------------------------
# fonts

_FONTS = {}
_warned = []


def font(weight, px):
    """Barlow Condensed (repo, src/ui/styles/fonts) at px pixels; DejaVu Sans Bold as a fallback."""
    px = max(4, int(round(px)))
    key = (weight, px)
    if key in _FONTS:
        return _FONTS[key]
    name = {'bold': 'BarlowCondensed-700', 'semi': 'BarlowCondensed-600'}[weight]
    path = None
    for ext in ('.woff2', '.ttf', '.otf'):
        p = os.path.join(ROOT, 'src', 'ui', 'styles', 'fonts', name + ext)
        if os.path.exists(p):
            path = p
            break
    if path is None:
        if not _warned:
            print(f'warning: {name} not found under {ROOT}/src/ui/styles/fonts; using DejaVu Sans Bold',
                  file=sys.stderr)
            _warned.append(1)
        path = FALLBACK_FONT
    f = ImageFont.truetype(path, px)
    _FONTS[key] = f
    return f


# ---------------------------------------------------------------------------------------------
# geometry (all shapes are polygons in "units"; Ctx maps units to supersampled pixels)

def ellipse_pts(cx, cy, rx, ry, n=72, rot=0.0, a0=0.0, a1=360.0):
    pts = []
    cr, sr = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    full = abs(a1 - a0) >= 360
    steps = n if full else max(2, int(n * abs(a1 - a0) / 360))
    for i in range(steps if full else steps + 1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        x, y = rx * math.cos(a), ry * math.sin(a)
        pts.append((cx + x * cr - y * sr, cy + x * sr + y * cr))
    return pts


def circle_pts(cx, cy, r, n=64):
    return ellipse_pts(cx, cy, r, r, n)


def rrect_pts(x0, y0, x1, y1, r, n=10):
    r = min(r, (x1 - x0) / 2, (y1 - y0) / 2)
    pts = []
    for cx, cy, a in ((x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)):
        for i in range(n + 1):
            t = math.radians(a + 90 * i / n)
            pts.append((cx + r * math.cos(t), cy + r * math.sin(t)))
    return pts


def bez(p0, p1, p2, p3, n=20, first=True):
    pts = []
    for i in range(0 if first else 1, n + 1):
        t = i / n
        mt = 1 - t
        x = mt ** 3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t ** 3 * p3[0]
        y = mt ** 3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t ** 3 * p3[1]
        pts.append((x, y))
    return pts


def path(start, *curves, n=20):
    """start point, then (c1, c2, end) cubic segments."""
    pts = [start]
    cur = start
    for c1, c2, end in curves:
        pts += bez(cur, c1, c2, end, n, first=False)
        cur = end
    return pts


def xform(pts, s=1.0, dx=0.0, dy=0.0, rot=0.0, flip=False):
    """Scale, (mirror), rotate (degrees, clockwise on screen) and move unit points."""
    cr, sr = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    out = []
    for x, y in pts:
        if flip:
            x = -x
        x, y = x * s, y * s
        out.append((dx + x * cr - y * sr, dy + x * sr + y * cr))
    return out


def teardrop(x0, y0, x1, y1, w0, w1, bend=0.0, n=28):
    """A tapered lock from (x0, y0) (half-width w0) to (x1, y1) (half-width w1), bowed sideways."""
    left, right = [], []
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy) or 1
    nx, ny = -dy / ln, dx / ln
    for i in range(n + 1):
        t = i / n
        b = bend * math.sin(math.pi * t)
        x = x0 + dx * t + nx * b
        y = y0 + dy * t + ny * b
        w = (w0 + (w1 - w0) * t) * (0.62 + 0.38 * math.sin(math.pi * min(1.0, t * 1.1 + 0.15)))
        left.append((x - nx * w, y - ny * w))
        right.append((x + nx * w, y + ny * w))
    return left + right[::-1]


def petal_pts(L, wide=1.0):
    """One sakura petal, base at the origin, pointing up, length L (notched tip)."""
    pts = path((0, 0),
                ((-0.3 * L, -0.1 * L), (-0.56 * L, -0.42 * L), (-0.44 * L, -0.8 * L)),
                ((-0.37 * L, -1.0 * L), (-0.12 * L, -1.04 * L), (0, -0.84 * L)),
                ((0.12 * L, -1.04 * L), (0.37 * L, -1.0 * L), (0.44 * L, -0.8 * L)),
                ((0.56 * L, -0.42 * L), (0.3 * L, -0.1 * L), (0, 0)), n=16)
    return [(x * wide, y) for x, y in pts]


def blossom_polys(cx, cy, r, rot=0.0, gap=0.06):
    """Five petals of a blossom of radius r centred at (cx, cy)."""
    polys = []
    L = r * (1 - gap)
    for k in range(5):
        a = rot + 72 * k
        base = (cx + r * gap * math.sin(math.radians(a)), cy - r * gap * math.cos(math.radians(a)))
        polys.append(xform(petal_pts(L), 1, base[0], base[1], a))
    return polys


def lock_edge(depths, x0=0.84, top=-0.34, n=10):
    """Bangs edge (right to left, head units) made of hair locks: pointed tips with concave sides and
    soft rounded roots, one lock per depth (how far its tip hangs below the root line)."""
    k = len(depths)
    span = 2 * x0 / k
    pts = [(x0, -0.12)]
    for i, dep in enumerate(depths):
        xa = x0 - i * span
        for j in range(1, n + 1):
            f = j / n
            g = (1 - abs(2 * f - 1)) ** 1.7       # 0 at the roots, 1 at the tip; concave sides
            pts.append((xa - f * span, top + dep * g + 0.03 * (1 - g)))
    pts.append((-x0, -0.12))
    return pts


def ribbon(pts, widths):
    """A tapered stroke polygon along pts with a half-width per point (paint swashes)."""
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy) or 1
        nx, ny = -dy / ln, dx / ln
        w = widths[i]
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    return left + right[::-1]


def star_pts(cx, cy, r, inner=0.48, rot=0.0, points=5):
    pts = []
    for i in range(points * 2):
        a = math.radians(rot - 90 + 180 * i / points)
        rr = r if i % 2 == 0 else r * inner
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


def splat_pts(cx, cy, r, seed, lobes=7):
    rnd = random.Random(seed)
    amps = [rnd.uniform(0.0, 0.28) for _ in range(lobes)]
    phase = rnd.uniform(0, math.tau)
    pts = []
    n = 90
    for i in range(n):
        a = math.tau * i / n
        k = (a + phase) * lobes / math.tau
        j = int(k) % lobes
        f = k - int(k)
        bump = amps[j] * math.sin(math.pi * f) ** 2
        rr = r * (0.86 + bump)
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


# ---------------------------------------------------------------------------------------------
# drawing context

class Ctx:
    """Unit coordinates -> supersampled pixels: px = (ox + x * s), (oy + y * s)."""

    def __init__(self, img, ox, oy, s, ink_px):
        self.img = img
        self.d = ImageDraw.Draw(img)
        self.ox, self.oy, self.s = ox, oy, s
        self.W = ink_px          # outline width (visible, outside the shape) in supersampled px
        self.w = ink_px * 0.62   # detail lines

    def P(self, pts):
        return [(self.ox + x * self.s, self.oy + y * self.s) for x, y in pts]

    def fill(self, pts, col):
        self.d.polygon(self.P(pts), fill=col if len(col) == 4 else rgba(col))

    def line(self, pts, col, width, closed=False, caps=True):
        px = self.P(pts)
        wi = max(1, int(round(width)))
        col = col if len(col) == 4 else rgba(col)
        if closed:
            px = px + px[:2]
        self.d.line(px, fill=col, width=wi, joint='curve')
        if caps and not closed and wi > 2:
            r = wi / 2
            for x, y in (px[0], px[-1]):
                self.d.ellipse([x - r, y - r, x + r, y + r], fill=col)

    def shape(self, pts, col, ink=INK, width=None):
        """Filled shape with an outline of width W outside its edge."""
        self.group([(pts, col)], ink, width)

    def group(self, items, ink=INK, width=None):
        """Several fills sharing one outline (strokes first, then fills)."""
        wi = (self.W if width is None else width) * 2
        if ink is not None:
            for pts, _ in items:
                self.line(pts, ink, wi, closed=True)
        for pts, col in items:
            self.fill(pts, col)

    def stroke(self, pts, col, width_units, ink=INK, closed=False):
        """A thick round-capped stroke (width in units) with an outline."""
        wpx = width_units * self.s
        if ink is not None:
            self.line(pts, ink, wpx + 2 * self.W, closed)
        self.line(pts, col, wpx, closed)

    def text(self, cx, cy, s, weight, cap_units, col, track=0.0, max_w=None):
        """Centred caps text whose cap height is cap_units (track in em), shrunk to fit max_w units."""
        size = cap_units * self.s / 0.7
        f = font(weight, size)
        adv = [f.getlength(ch) for ch in s]
        tr = track * size
        total = sum(adv) + tr * (len(s) - 1)
        if max_w and total > max_w * self.s:  # e.g. the wide fallback font
            size *= max_w * self.s / total
            f = font(weight, size)
            adv = [f.getlength(ch) for ch in s]
            tr = track * size
            total = sum(adv) + tr * (len(s) - 1)
        cap = f.getbbox('H', anchor='ls')
        cap_h = -cap[1]
        x = self.ox + cx * self.s - total / 2
        y = self.oy + cy * self.s + cap_h / 2
        col = col if len(col) == 4 else rgba(col)
        for ch, a in zip(s, adv):
            self.d.text((x, y), ch, font=f, fill=col, anchor='ls')
            x += a + tr
        return total / self.s


# ---------------------------------------------------------------------------------------------
# the mascot: her own chibi silhouette in a hard hat, painting (head units: radius 1, centre 0,0)

def draw_mascot(c, u, col, hx, hy, R, props=True):
    """Mascot with head centre (hx, hy) and head radius R in the ctx's units."""
    look = u['look']
    style = look.get('hairStyle', 'bob')
    acc = look.get('accessory', 'none')
    bangs = look.get('bangs', 'straight')
    S, Sl = col['sig'], col['sig_light']
    B = col['body']      # uniform: her outfit colour (kept apart from her hair, see colours())
    Bd = mix(B, INK, 0.35)
    legs = col['legs']
    pal = col['pal']
    skin = col['skin']
    tie = pal['halo'] if sat(pal['halo']) > 0.3 else (pal['accent'] if sat(pal['accent']) > 0.3 else PINK)

    def T(pts):
        return [(hx + x * R, hy + y * R) for x, y in pts]

    def shape(pts, fill, ink=INK, width=None):
        c.shape(T(pts), fill, ink, width)

    def group(items, ink=INK):
        c.group([(T(p), f) for p, f in items], ink)

    def line(pts, colr, wpx):
        c.line(T(pts), colr, wpx)

    # --- back hair ------------------------------------------------------------------------
    if style == 'wavy':
        for sg in (-1, 1):
            outer = [(sg * (1.0 + 0.2 * t + 0.13 * math.sin(t * math.pi * 3.2)), -0.25 + 1.75 * t)
                     for t in [i / 24 for i in range(25)]]
            inner = [(sg * (0.62 + 0.16 * t + 0.1 * math.sin(t * math.pi * 3.2 + 0.6)), -0.1 + 1.45 * t)
                     for t in [i / 24 for i in range(25)]]
            tip = [(sg * 1.06, 1.62), (sg * 0.92, 1.56)]
            shape(outer + tip + inner[::-1], S)
    if style == 'ponytail':
        shape(teardrop(0.55, -0.82, 1.32, 1.45, 0.36, 0.1, bend=-0.5), S)
    if style == 'twintails':
        for sg in (-1, 1):
            shape(teardrop(sg * 1.0, -0.32, sg * 1.42, 1.7, 0.34, 0.08, bend=-sg * 0.32), S)

    # --- body -----------------------------------------------------------------------------
    # legs + shoes
    for sg in (-1, 1):
        shape(rrect_pts(sg * 0.22 - 0.12, 1.75, sg * 0.22 + 0.12, 2.36, 0.08), legs)
    for sg in (-1, 1):
        shape(ellipse_pts(sg * 0.26, 2.36, 0.2, 0.11), INK)
    # palette arm (her right, our left) reaching out to the palette
    arm_l = [(-0.42, 0.98), (-0.68, 1.22), (-0.9, 1.36)]
    # brush arm (our right) raised
    arm_r = [(0.44, 1.0), (0.86, 1.08), (1.16, 0.74)]
    for arm in (arm_l, arm_r):
        c.stroke(T(arm), B, 0.27 * R)
    # torso: an A-line uniform
    torso = path((-0.42, 0.8),
                 ((-0.18, 0.74), (0.18, 0.74), (0.42, 0.8)),
                 ((0.56, 1.1), (0.76, 1.6), (0.8, 1.86)),
                 ((0.3, 1.96), (-0.3, 1.96), (-0.8, 1.86)),
                 ((-0.76, 1.6), (-0.56, 1.1), (-0.42, 0.8)), n=14)
    shape(torso, B)
    # skirt pleats / hem hint
    for x in (-0.36, 0, 0.36):
        line([(x * 0.7, 1.52), (x, 1.9)], Bd, c.w)
    # collar + ribbon (a sailor uniform gets the broad white sailor collar with a stripe in her accent)
    if look.get('outfit') == 'sailor':
        sailor = path((-0.47, 0.8), ((-0.56, 0.9), (-0.62, 1.0), (-0.6, 1.06)),
                      ((-0.4, 1.16), (-0.16, 1.28), (0.0, 1.34)),
                      ((0.16, 1.28), (0.4, 1.16), (0.6, 1.06)),
                      ((0.62, 1.0), (0.56, 0.9), (0.47, 0.8)), n=10)
        shape(sailor + [(0.22, 0.8), (0.0, 1.1), (-0.22, 0.8)], WHITE, INK, c.w)
        stripe = path((-0.48, 0.9), ((-0.5, 0.96), (-0.5, 1.0), (-0.48, 1.03)),
                      ((-0.3, 1.12), (-0.14, 1.2), (0.0, 1.24)),
                      ((0.14, 1.2), (0.3, 1.12), (0.48, 1.03)),
                      ((0.5, 1.0), (0.5, 0.96), (0.48, 0.9)), n=10)
        line(stripe, col['paint'], c.W * 1.1)
    else:
        shape([(-0.3, 0.8), (0.3, 0.8), (0.0, 1.2)], WHITE, INK, c.w)
    bow = col['paint']
    for sg in (-1, 1):
        shape([(0, 1.13), (sg * 0.2, 1.04), (sg * 0.2, 1.3)], bow, INK, c.w)
    shape(circle_pts(0, 1.16, 0.065, 20), bow, INK, c.w)

    # --- palette (behind her hand) ----------------------------------------------------------
    if props is True:
        pal_pts = ellipse_pts(-1.3, 1.5, 0.5, 0.32, rot=-18)
        shape(pal_pts, WOOD)
        dabs = [(-1.56, 1.52, PINK), (-1.42, 1.32, SKY), (-1.18, 1.3, YELLOW), (-1.5, 1.72, Sl)]
        for x, y, dc in dabs:
            shape(circle_pts(x, y, 0.085, 24), dc, INK, c.w)
    for x, y in ((-0.98, 1.42), (1.18, 0.7)):
        shape(circle_pts(x, y, 0.14, 28), skin)

    # --- brush in the raised hand (props True or 'brush') ----------------------------------------
    if props:
        a, b = (1.04, 1.02), (1.44, 0.04)
        c.stroke(T([a, b]), (90, 169, 255), 0.11 * R)
        fer0, fer1 = b, (1.51, -0.12)
        c.stroke(T([fer0, fer1]), STEEL, 0.15 * R)
        tip = teardrop(1.51, -0.11, 1.66, -0.5, 0.1, 0.02, bend=0.0, n=16)
        shape(tip, col['paint'])
        # her hand over the handle
        shape(circle_pts(1.18, 0.7, 0.14, 28), skin)

    # --- head ---------------------------------------------------------------------------------
    # hair mass: the crown (upper part of a circle) and two side strands; the face sits on top
    crown = [(1.07 * math.cos(math.radians(a)), -0.02 - 1.07 * math.sin(math.radians(a)))
             for a in [200 - 220 * i / 60 for i in range(61)]]
    hair_items = [(crown, S)]
    for sg in (-1, 1):
        hair_items.append((teardrop(sg * 0.9, -0.1, sg * 0.84, 0.86, 0.2, 0.07, bend=-sg * 0.08, n=20), S))
    if style == 'buns':
        for sg in (-1, 1):
            hair_items.append((circle_pts(sg * 0.86, -0.86, 0.34, 40), S))
    if acc == 'catEars':
        for sg in (-1, 1):
            hair_items.append(([(sg * 0.38, -0.92), (sg * 0.92, -0.62), (sg * 0.84, -1.42)], S))
    group(hair_items)
    if style == 'buns':
        for sg in (-1, 1):
            line(ellipse_pts(sg * 0.86, -0.86, 0.2, 0.2, 30, a0=200 if sg < 0 else 250, a1=290 if sg < 0 else 340),
                 Sl, c.w)
    if acc == 'catEars':
        for sg in (-1, 1):
            c.fill(T([(sg * 0.5, -0.9), (sg * 0.82, -0.7), (sg * 0.78, -1.22)]), PINK_SOFT)
    if acc == 'horns':
        horn_col = mix(pal['accent'], WHITE, 0.2) if lum(pal['accent']) > 0.6 else mix(S, WHITE, 0.55)
        if u['id'] == 'seiran':
            horn_col = rgb(u['palette']['weapon'])
        for sg in (-1, 1):
            horn = path((sg * 0.5, -0.84), ((sg * 0.72, -1.0), (sg * 0.94, -1.14), (sg * 1.1, -1.44)),
                        ((sg * 1.14, -1.12), (sg * 1.02, -0.86), (sg * 0.84, -0.7)), n=14)
            shape(horn + [(sg * 0.5, -0.84)], horn_col)
            for t in (0.42, 0.66):
                ax, ay = sg * (0.5 + (0.94 - 0.5) * t), -0.84 - 0.3 * t
                bx, by = sg * (0.84 + (1.1 - 0.84) * t), -0.7 - 0.42 * t
                line([(ax + sg * 0.03, ay), (bx - sg * 0.02, by)], mix(horn_col, INK, 0.35), c.w * 0.8)

    # face window under the bangs
    edge = {
        'hime': [(0.84, -0.12), (0.62, -0.12), (0.62, -0.24), (-0.62, -0.24), (-0.62, -0.12), (-0.84, -0.12)],
        'straight': [(0.84, -0.2), (0.5, -0.26), (-0.5, -0.26), (-0.84, -0.2)],
        'split': [(0.84, -0.1), (0.42, -0.2), (0.06, -0.5), (-0.06, -0.5), (-0.42, -0.2), (-0.84, -0.1)],
        'swept': [(0.84, -0.14), (0.5, -0.18), (0.1, -0.3), (-0.3, -0.44), (-0.62, -0.5), (-0.84, -0.34)],
        'messy': lock_edge([0.15, 0.22, 0.19, 0.24, 0.14]),
    }.get(bangs, lock_edge([0.16, 0.2, 0.16]))
    # chin arc from the left end of the bangs around the bottom to the right end
    yl, yr = edge[-1][1], edge[0][1]
    face = []
    for i in range(41):
        t = i / 40  # left -> chin -> right
        face.append((-0.84 * math.cos(math.radians(180 * t)), 0.12 + 0.74 * math.sin(math.radians(180 * t))))
    face = [(-0.84, yl)] + face + [(0.84, yr)] + edge
    shape(face, skin, INK, c.w)
    # side locks over the cheeks
    for sg in (-1, 1):
        lock = path((sg * 0.66, -0.2), ((sg * 0.8, -0.24), (sg * 0.92, -0.24), (sg * 0.96, -0.2)),
                    ((sg * 1.0, 0.2), (sg * 0.9, 0.52), (sg * 0.68, 0.74)),
                    ((sg * 0.74, 0.42), (sg * 0.72, 0.08), (sg * 0.66, -0.2)), n=14)
        shape(lock, S, INK, c.w)

    # features from her look: eyes (eyeStyle), mouth (expression), blush
    draw_face(c, T, look, pal, R)

    # braid over her shoulder (our left), in front of the arm
    if style == 'braid':
        segs = []
        for k in range(6):
            t = k / 5
            segs.append((-0.74 - 0.08 * math.sin(t * 2.2), 0.5 + 0.24 * k, 0.17 - 0.012 * k))
        for x, y, r in segs:
            shape(ellipse_pts(x, y, r, r * 1.05, 30), S, INK, c.w)
        x, y, r = segs[-1]
        shape(teardrop(x, y + 0.12, x - 0.02, y + 0.42, 0.12, 0.03, n=14), S, INK, c.w)
        shape(ellipse_pts(x, y + 0.14, 0.1, 0.06, 20), tie, INK, c.w)
    if style == 'twintails':
        for sg in (-1, 1):
            shape(circle_pts(sg * 1.0, -0.34, 0.11, 24), tie, INK, c.w)
    if style == 'ponytail':
        shape(circle_pts(0.7, -0.84, 0.1, 24), tie, INK, c.w)

    # accessories on the hair
    if acc == 'hairpin':
        shape(star_pts(-0.86, -0.42, 0.17, rot=-12), mix(tie, WHITE, 0.25) if lum(tie) < 0.85 else YELLOW, INK, c.w)
    elif acc == 'flower':
        petal = rgb(u['palette']['weapon']) if u['id'] == 'noa' else pal['accent']
        for poly in blossom_polys(-0.88, -0.46, 0.2, rot=8, gap=0.1):
            shape(poly, petal, INK, c.w)
        shape(circle_pts(-0.88, -0.46, 0.06, 16), YELLOW, None)

    # --- the hard hat (perched, a little tilted) ---------------------------------------------
    hat_rot = -7
    hc = (0.06, -0.78)

    def H(pts):
        return xform(pts, 1, hc[0], hc[1], hat_rot)

    dome = ellipse_pts(0, 0.0, 0.74, 0.7, 48, a0=180, a1=360) + [(0.74, 0.04), (-0.74, 0.04)]
    shape(H(dome), YELLOW)
    ridge = rrect_pts(-0.12, -0.66, 0.12, 0.02, 0.1)
    shape(H(ridge), (255, 236, 140), INK, c.w)
    brim = path((-0.98, 0.0), ((-0.6, -0.08), (0.6, -0.08), (0.98, 0.0)),
                ((1.02, 0.08), (1.0, 0.16), (0.94, 0.16)),
                ((0.5, 0.1), (-0.5, 0.1), (-0.94, 0.16)),
                ((-1.0, 0.16), (-1.02, 0.08), (-0.98, 0.0)), n=14)
    shape(H(brim), YELLOW_DEEP)
    # shine + sakura sticker
    c.line(T(H(ellipse_pts(0, 0, 0.56, 0.52, 30, a0=205, a1=245))), rgba(WHITE, 230), c.W * 1.1)
    for poly in blossom_polys(0.42, -0.34, 0.16, rot=-10, gap=0.08):
        c.shape(T(H(poly)), PINK, INK, c.w * 0.8)
    c.fill(T(H(circle_pts(0.42, -0.34, 0.045, 12))), WHITE)

    return {'face': (hx, hy + 0.2 * R), 'hat_top': (hx, hy - 1.5 * R)}


def draw_face(c, T, look, pal, R):
    """Her chibi face: open eyes (round / sparkle / sharp), happy closed eyes (sleepy) or a wink (smug),
    and a mouth for her expression."""
    es = look.get('eyeStyle', 'round')
    ex_ = look.get('expression', 'smile')
    iris = mix(pal['eyes'], INK, 0.55 if lum(pal['eyes']) < 0.75 else 0.62)

    def closed(sg):
        c.line(T(ellipse_pts(sg * 0.34, 0.27, 0.15, 0.13, 30, a0=200, a1=340)), INK, c.W * 1.15)

    def open_eye(sg):
        x, y = sg * 0.34, 0.25
        c.shape(T(ellipse_pts(x, y, 0.12, 0.155, 32)), iris, INK, c.w * 0.8)
        c.fill(T(ellipse_pts(x, y + 0.07, 0.085, 0.06, 24)), rgba(mix(iris, pal['eyes'], 0.55)))
        c.fill(T(circle_pts(x - 0.035, y - 0.055, 0.048, 20)), WHITE)
        c.fill(T(circle_pts(x + 0.045, y + 0.06, 0.022, 14)), WHITE)
        if es == 'sharp':  # a little lash flick at the outer corner
            c.line(T([(x - sg * 0.02, y - 0.16), (x + sg * 0.1, y - 0.15), (x + sg * 0.17, y - 0.2)]), INK, c.W * 1.0)
        if es == 'sparkle':
            c.fill(T(star_pts(x + sg * 0.2, y - 0.2, 0.07, inner=0.35, points=4)), rgba(YELLOW_DEEP))

    wink = ex_ == 'smug'
    for sg in (-1, 1):
        if es == 'sleepy' or (wink and sg > 0):
            closed(sg)
        else:
            open_eye(sg)
    blush_a = 190 if ex_ == 'shy' else 150
    for sg in (-1, 1):
        c.fill(T(ellipse_pts(sg * 0.6, 0.47, 0.15 if ex_ != 'shy' else 0.17, 0.08, 30)), rgba(PINK, blush_a))
    if ex_ in ('cheerful', 'smile', 'determined'):
        rx, ry = {'cheerful': (0.14, 0.13), 'smile': (0.11, 0.1), 'determined': (0.1, 0.07)}[ex_]
        c.shape(T(ellipse_pts(0, 0.45, rx, ry, 30, a0=0, a1=180)), PINK_DEEP, INK, c.w * 0.9)
    elif ex_ == 'smug':  # a little cat mouth
        for sg in (-1, 1):
            c.line(T(ellipse_pts(sg * 0.055, 0.46, 0.055, 0.05, 16, a0=20, a1=160)), INK, c.w * 1.1)
    else:  # calm / shy: a soft closed smile
        c.line(T(ellipse_pts(0, 0.42, 0.08 if ex_ == 'shy' else 0.1, 0.06, 18, a0=20, a1=160)), INK, c.w * 1.1)


# ---------------------------------------------------------------------------------------------
# the signboard (plate units: 1000 x 1300, centre 0,0)

PW, PH = 1000, 1240
INK_U = 8.5          # outline width in plate units
TILT = 3.0           # degrees, counter-clockwise (the UI's stickers lean the same way)
BASE = PH / 2        # plate bottom edge
GROUND = BASE + 410  # ground line below the plate centre
HEAD = (0, -208, 196)  # mascot head centre (x, y) and radius on the plate
# paint splats on the plate: (x, y, radius, colour key, seed); kept inside the field and the bust crop
SPLATS = [(-318, -150, 36, 'sky', 5), (322, 66, 26, 'yellow', 7), (-334, 212, 22, 'sig_light', 11)]
# the little heart she has just painted on the plate, up and right of her brush tip (a small gap, so
# it reads as paint on the plate and not as part of the brush): centre, size, lean (plate units)
HEART = (350, -406, 2.8, 14)


def draw_plate(u, col, s_px, min_ink=1.6, printed=True):
    """The plate with everything printed on it, on its own transparent layer (supersampled).
    printed=False leaves out the corner sticker and the lettering (the bust crop would cut them)."""
    margin = 40
    w = int((PW + 2 * margin) * s_px)
    h = int((PH + 2 * margin) * s_px)
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ink = max(min_ink * SS, INK_U * s_px)
    c = Ctx(img, w / 2, h / 2, s_px, ink)
    x0, y0, x1, y1 = -PW / 2, -PH / 2, PW / 2, PH / 2
    # plate + enamel
    c.shape(rrect_pts(x0, y0, x1, y1, 58), WHITE)
    # soft enamel shading towards the bottom
    shade = Image.new('L', (1, 64))
    for i in range(64):
        shade.putpixel((0, i), int(26 * (i / 63) ** 1.6))
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).polygon(c.P(rrect_pts(x0, y0, x1, y1, 58)), fill=255)
    grad = shade.resize(img.size, Image.BILINEAR)
    tint = Image.new('RGBA', img.size, rgba(SIGN_BLUE))
    tint.putalpha(Image.composite(grad, Image.new('L', img.size, 0), mask))
    img.alpha_composite(tint)
    # blue border band
    bi = 24
    bw = 30
    c.fill(rrect_pts(x0 + bi, y0 + bi, x1 - bi, y1 - bi, 40), SIGN_BLUE)
    c.fill(rrect_pts(x0 + bi + bw, y0 + bi + bw, x1 - bi - bw, y1 - bi - bw, 22), WHITE)
    # re-apply the enamel tint on the inner field
    inner = Image.new('L', img.size, 0)
    ImageDraw.Draw(inner).polygon(c.P(rrect_pts(x0 + bi + bw, y0 + bi + bw, x1 - bi - bw, y1 - bi - bw, 22)), fill=255)
    tint2 = Image.new('RGBA', img.size, rgba(SIGN_BLUE))
    tint2.putalpha(Image.composite(grad, Image.new('L', img.size, 0), inner))
    img.alpha_composite(tint2)
    # screws on the border corners
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * (PW / 2 - bi - bw / 2 - 6), sy * (PH / 2 - bi - bw / 2 - 6)
            c.shape(circle_pts(cx, cy, 14, 28), STEEL, INK, c.w * 0.9)
            c.line([(cx - 8, cy + 5 * sx * sy), (cx + 8, cy - 5 * sx * sy)], rgba(mix(INK, STEEL, 0.35)), c.w * 0.9)

    # the easel's top holder: a wooden bar gripping the plate's top edge
    c.shape(rrect_pts(-92, y0 - 22, 92, y0 + 16, 14), WOOD)
    c.line([(-76, y0 - 9), (76, y0 - 9)], rgba(WHITE, 150), c.w * 0.8)

    # our sakura as a die-cut sticker slapped on the top-left of the field (tilted like the UI's stickers)
    if printed:
        draw_sticker(c, -350, -468, 58, -12)

    # paint splats on the plate (behind the mascot)
    hx, hy, R = HEAD
    named = {'paint': col['paint'], 'sky': SKY, 'yellow': YELLOW, 'sig_light': col['sig_light']}
    for x, y, r, key, seed in SPLATS:
        scol = named[key]
        c.shape(splat_pts(x, y, r, u['id'] + str(seed)), scol, INK, c.w)
        rnd = random.Random(u['id'] + 'd' + str(seed))
        for _ in range(3):
            a = rnd.uniform(0, math.tau)
            d = r * rnd.uniform(1.35, 1.6)
            c.shape(circle_pts(x + d * math.cos(a), y + d * math.sin(a), r * rnd.uniform(0.12, 0.22), 18), scol, INK,
                    c.w * 0.8)

    draw_swash(c, u, col['paint'])
    # the mascot
    m = draw_mascot(c, u, col, hx, hy, R)
    if not printed:
        return img, m

    # banner band
    by0, by1 = 318, 438
    c.shape(rrect_pts(-418, by0, 418, by1, 60), SIGN_BLUE)
    c.line(rrect_pts(-404, by0 + 13, 404, by1 - 13, 47), rgba(WHITE, 200), c.w * 0.7, closed=True)
    c.text(0, (by0 + by1) / 2, 'ART IN PROGRESS', 'bold', 72, WHITE, track=0.03, max_w=760)
    # sub line with two little blossoms
    sy = 500
    tw = c.text(0, sy, 'COMING SOON', 'bold', 50, SIGN_BLUE, track=0.16, max_w=620)
    for sg in (-1, 1):
        bx = sg * (tw / 2 + 46)
        for p in blossom_polys(bx, sy, 24, rot=sg * 10, gap=0.08):
            c.shape(p, PINK, INK, c.w * 0.7)
        c.fill(circle_pts(bx, sy, 6.5, 12), YELLOW)
    return img, m


def draw_swash(c, u, paint):
    """The heart she has just painted: one wet brush stroke in her paint colour from the heart's top
    dip round both lobes, running dry just before it closes, with a drip and a drop of wet paint."""
    hx, hy, k, lean = HEART
    n = 64
    t0, t1 = 0.12, 2 * math.pi - 0.5
    pts = []
    for i in range(n + 1):
        t = t0 + (t1 - t0) * i / n
        x = 16 * math.sin(t) ** 3
        y = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        pts.append((x * k, (y - 3) * k))
    pts = xform(pts, 1, hx, hy, lean)
    # pressed at the start, a full body round the lobes, running dry to a point at the end
    wid = [2.0 + 6.0 * min(1.0, 0.55 + 3.0 * i / n) * (1 - i / n) ** 0.3 for i in range(n + 1)]
    c.shape(ribbon(pts, wid), paint)
    # a drip running down from the heart's point, and a drop under it
    bx, by = xform([(0, 14 * k)], 1, hx, hy, lean)[0]
    c.shape(teardrop(bx - 1, by - 4, bx - 2, by + 22, 5.5, 4.5, n=12), paint, INK, c.w * 0.8)
    rnd = random.Random(u['id'] + 'swash')
    c.shape(circle_pts(bx + 18 + rnd.uniform(-3, 3), by + 40 + rnd.uniform(-3, 3), 5.5, 18), paint, INK,
            c.w * 0.8)


def draw_emblem(c, ex, ey, er, rot=0.0):
    """Our five-petal sakura emblem."""
    petals = blossom_polys(ex, ey, er, rot=rot, gap=0.05)
    c.group([(p, PINK) for p in petals])
    for p in blossom_polys(ex, ey, er * 0.62, rot=rot, gap=0.08):
        c.fill(p, rgba(mix(PINK, WHITE, 0.35)))
    for k in range(5):
        a = math.radians(72 * k - 90 + rot)
        c.line([(ex + er * 0.23 * math.cos(a), ey + er * 0.23 * math.sin(a)),
                (ex + er * 0.66 * math.cos(a), ey + er * 0.66 * math.sin(a))],
               rgba(PINK_DEEP), c.w * 0.8)
    c.shape(circle_pts(ex, ey, er * 0.24, 28), YELLOW, INK, c.w * 0.9)


def draw_sticker(c, x, y, r, rot):
    """A round die-cut vinyl sticker: soft shadow, white rim, pale pink disc and the sakura emblem."""
    c.fill(circle_pts(x + 5, y + 8, r + 16, 48), rgba(INK, 34))
    c.shape(circle_pts(x, y, r + 14, 48), WHITE)
    c.fill(circle_pts(x, y, r, 48), PINK_SOFT)
    draw_emblem(c, x, y, r * 0.8, rot)


def rot_pt(x, y, deg):
    """Rotate a plate-unit point about the plate centre, counter-clockwise on screen."""
    a = math.radians(deg)
    return (x * math.cos(a) + y * math.sin(a), -x * math.sin(a) + y * math.cos(a))


EASEL_TOP = -706  # the top of the easel's mast, above the plate (the plate top is at -PH / 2)


def draw_site_back(c):
    """The A-frame easel behind the plate: two legs meeting above it and the centre mast, whose top
    pokes out over the plate (the painter's-easel silhouette)."""
    ax = rot_pt(0, -PH / 2, TILT)[0]  # the tilted plate's top centre
    for sg in (-1, 1):
        c.stroke([(ax + sg * 30, EASEL_TOP + 30), (sg * 356, GROUND - 44)], WOOD, 32)  # feet behind the cones
    c.stroke([(ax, EASEL_TOP + 15), (ax, BASE)], WOOD, 30)  # round-capped mast top


def draw_site_front(c, u):
    """Easel ledge, cones and the striped cone bar in front of the plate."""
    # ledge the plate rests on
    c.shape(rrect_pts(-470, BASE - 4, 470, BASE + 40, 14), WOOD)
    c.line([(-452, BASE + 12), (452, BASE + 12)], rgba(WHITE, 140), c.w * 0.8)
    # cones
    cx = 436  # cones and their bases stay inside the 300 px card
    for sg in (-1, 1):
        x = sg * cx
        top, bot = BASE + 140, BASE + 368
        body = [(x - 26, top), (x + 26, top), (x + 84, bot), (x - 84, bot)]
        c.shape(body, PINK)
        for t0, t1 in ((0.3, 0.44), (0.62, 0.76)):
            ya, yb = top + (bot - top) * t0, top + (bot - top) * t1
            wa, wb = 26 + 58 * t0, 26 + 58 * t1
            c.fill([(x - wa, ya), (x + wa, ya), (x + wb, yb), (x - wb, yb)], WHITE)
        c.shape(ellipse_pts(x, top, 26, 9, 24), mix(PINK, INK, 0.25), INK, c.w)
        c.shape(rrect_pts(x - 102, bot - 4, x + 102, GROUND, 12), NAVY)
    # cone bar (yellow / navy stripes, the only hazard stripes on the card)
    y0, y1 = BASE + 156, BASE + 196
    bar = rrect_pts(-cx - 6, y0, cx + 6, y1, 20)
    c.line(bar, INK, c.W * 2, closed=True)
    c.fill(bar, YELLOW)
    layer = Image.new('L', c.img.size, 0)
    ld = ImageDraw.Draw(layer)
    step = 64
    for k in range(-20, 20):
        x = k * step
        ld.polygon(c.P([(x, y0), (x + step / 2, y0), (x + step / 2 - 40, y1), (x - 40, y1)]), fill=255)
    clip = Image.new('L', c.img.size, 0)
    ImageDraw.Draw(clip).polygon(c.P(bar), fill=255)
    stripes = ImageChops.multiply(layer, clip)
    navy = Image.new('RGBA', c.img.size, rgba(NAVY))
    navy.putalpha(stripes)
    c.img.alpha_composite(navy)
    # bar ends sit in the cone tops
    for sg in (-1, 1):
        c.shape(circle_pts(sg * cx, (y0 + y1) / 2, 24, 24), mix(PINK, INK, 0.2), INK, c.w)


# ---------------------------------------------------------------------------------------------
# background

def background(u, col, w, h, petals=True, grid=True, seed_extra='', depth=1.0, glow_a=150):
    """Her colour field at supersampled size w x h (depth 1: strong enough to hold its own among the
    painted cards; lower is paler) with a white glow behind the sign (glow_a: its strength)."""
    theme = col['theme']
    top = mix(theme, WHITE, 0.74 - 0.26 * depth)
    bot = mix(mix(theme, WHITE, 0.36 - 0.3 * depth), INK, 0.12 * depth)
    g = Image.new('RGB', (1, 256))
    for i in range(256):
        t = i / 255
        g.putpixel((0, i), mix(top, bot, t ** 1.1))
    img = g.resize((w, h), Image.BILINEAR).convert('RGBA')
    unit = min(w, h)
    # glow behind the sign
    glow = Image.new('L', (w, h), 0)
    ImageDraw.Draw(glow).ellipse([w * 0.08, h * 0.12, w * 0.92, h * 0.12 + w * 0.84], fill=glow_a)
    glow = glow.filter(ImageFilter.GaussianBlur(unit * 0.09))
    white = Image.new('RGBA', (w, h), rgba(WHITE))
    white.putalpha(glow)
    img.alpha_composite(white)
    d = ImageDraw.Draw(img)
    if grid:
        lay = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        ld = ImageDraw.Draw(lay)
        step = unit / 9.5
        lw = max(1, round(unit / 400))
        gc = rgba(WHITE, 92)
        x = (w / 2) % step
        while x < w:
            ld.line([(x, 0), (x, h)], fill=gc, width=lw)
            x += step
        y = (h * 0.4) % step
        while y < h:
            ld.line([(0, y), (w, y)], fill=gc, width=lw)
            y += step
        img.alpha_composite(lay)
    rnd = random.Random(u['id'] + seed_extra)
    # bokeh
    bm = Image.new('L', (w, h), 0)
    bd = ImageDraw.Draw(bm)
    for _ in range(8):
        r = rnd.uniform(0.03, 0.08) * unit
        x, y = rnd.uniform(0, w), rnd.uniform(0, h * 0.85)
        bd.ellipse([x - r, y - r, x + r, y + r], fill=rnd.randint(60, 100))
    bok = Image.new('RGBA', (w, h), rgba(WHITE))
    bok.putalpha(bm.filter(ImageFilter.GaussianBlur(unit * 0.012)))
    img.alpha_composite(bok)
    if petals:
        lay = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        c = Ctx(lay, 0, 0, 1, 0)
        pc = mix(PINK, WHITE, 0.45)
        for i in range(16):
            L = rnd.uniform(0.022, 0.042) * unit
            x, y = rnd.uniform(0.02, 0.98) * w, rnd.uniform(0.02, 0.95) * h
            colp = rgba(pc if i % 3 else WHITE, rnd.randint(170, 235))
            pts = xform(petal_pts(L, 0.66), 1, x, y, rnd.uniform(0, 360))
            c.fill(pts, colp)
        img.alpha_composite(lay)
    return img


def ground_shadow(img, cx, cy, rx, ry, col):
    sh = Image.new('L', img.size, 0)
    ImageDraw.Draw(sh).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=90)
    sh = sh.filter(ImageFilter.GaussianBlur(ry * 0.6))
    layer = Image.new('RGBA', img.size, rgba(mix(col['theme'], INK, 0.55)))
    layer.putalpha(sh)
    img.alpha_composite(layer)


# ---------------------------------------------------------------------------------------------
# compositions

def site(u, col, w, h, scale, cx, cy, bg=True, min_ink=1.6, printed=True):
    """The whole site at output size w x h: plate centre at (cx, cy) output px, scale px per unit.
    Returns (RGBA image at output size, anchors in output px)."""
    W, Hh = w * SS, h * SS
    s = scale * SS
    img = background(u, col, W, Hh) if bg else Image.new('RGBA', (W, Hh), (0, 0, 0, 0))
    ox, oy = cx * SS, cy * SS
    ink = max(min_ink * SS, INK_U * s)
    c = Ctx(img, ox, oy, s, ink)
    if bg:
        ground_shadow(img, ox, oy + GROUND * s, 640 * s, 46 * s, col)
    draw_site_back(c)
    plate, m = draw_plate(u, col, s, min_ink, printed)
    plate = plate.rotate(TILT, resample=Image.BICUBIC, center=(plate.width / 2, plate.height / 2))
    # drop shadow of the plate
    a = plate.getchannel('A').point(lambda v: v * 0.3)
    a = a.filter(ImageFilter.GaussianBlur(max(1, 8 * s)))
    sh = Image.new('RGBA', plate.size, rgba(mix(col['theme'], INK, 0.65)))
    sh.putalpha(a)
    px, py = round(ox - plate.width / 2), round(oy - plate.height / 2)
    img.alpha_composite(sh, (px + round(10 * s), py + round(16 * s)))
    img.alpha_composite(plate, (px, py))
    draw_site_front(c, u)
    out = img.resize((w, h), Image.LANCZOS)
    fx, fy = rot_pt(m['face'][0], m['face'][1], TILT)
    face = (cx + fx * scale, cy + fy * scale)
    return out, {'face': face}


def thumb_image(u, col, size=160):
    """Just her hard-hat head on her colour."""
    W = size * SS
    # her colour at the card's depth with a softer glow, so the avatar circles hold their own next to
    # the painted ones
    img = background(u, col, W, W, petals=True, grid=True, seed_extra='t', depth=1.0, glow_a=50)
    R = 0.31 * W
    s = 1.0
    ink = max(1.6 * SS, INK_U * (R / HEAD[2]))
    c = Ctx(img, 0, 0, s, ink)
    draw_mascot(c, u, col, W * 0.485, W * 0.6, R, props='brush')
    return img.resize((size, size), Image.LANCZOS)


def save_webp(img, path, quality, max_bytes=None):
    q = quality
    while True:
        img.save(path, 'WEBP', quality=q, method=6)
        if not max_bytes or os.path.getsize(path) < max_bytes or q <= 40:
            return
        q -= 6


def build(u, out_dir):
    col = colours(u)
    p = lambda kind: os.path.join(out_dir, f"{u['id']}-{kind}.webp")
    results = {}
    # full 768 x 1024: the whole site
    full_scale = 0.54
    full, a = site(u, col, 768, 1024, full_scale, 384, 58 + (PH / 2 + 30) * full_scale)
    save_webp(full.convert('RGB'), p('full'), 88)
    results['full'] = full
    face = (100 * a['face'][0] / 768, 100 * a['face'][1] / 1024)
    # card 300 x 500: plate top ~11 %, the cones under the UI's name band
    card_scale = 0.26
    card, _ = site(u, col, 300, 500, card_scale, 150, 56 + (PH / 2 + 30) * card_scale)
    save_webp(card.convert('RGB'), p('card'), 86, 78_000)
    results['card'] = card
    # bust 512: the mascot on the plate, her face in the upper third
    bs = 0.62
    hx, hy = rot_pt(HEAD[0] - 8, HEAD[1] + 0.2 * HEAD[2], TILT)
    bust, _ = site(u, col, 512, 512, bs, 256 - hx * bs, 512 * 0.437 - hy * bs, printed=False)
    save_webp(bust.convert('RGB'), p('bust'), 86)
    results['bust'] = bust
    # thumb 160: her hard-hat head
    thumb = thumb_image(u, col, 160)
    save_webp(thumb.convert('RGB'), p('thumb'), 84, 19_000)
    results['thumb'] = thumb
    # transparent stands: the signboard on its easel with the cones
    cuts = {}
    for kind, H in (('cut', 1000), ('cut-s', 360)):
        span_top, span_bot = -EASEL_TOP + 12, GROUND + INK_U + 6  # the cone bases' outline stays whole
        scale = (H - 8) / (span_top + span_bot)
        w = int((PW + 300) * scale)
        img, _ = site(u, col, w, H, scale, w / 2, 4 + span_top * scale, bg=False, min_ink=1.4)
        bbox = img.getchannel('A').getbbox()
        img = img.crop((bbox[0], 0, bbox[2], H))
        img.save(p(kind), 'WEBP', quality=90, method=6)
        cuts[kind] = img
    results.update(cuts)
    return {'face': [round(face[0]), round(face[1])], 'cut': round(cuts['cut'].width / cuts['cut'].height, 3)}, results


# ---------------------------------------------------------------------------------------------
# review sheets

def checker(w, h, n=16):
    img = Image.new('RGB', (w, h), (236, 240, 246))
    d = ImageDraw.Draw(img)
    for y in range(0, h, n):
        for x in range(0, w, n):
            if (x // n + y // n) % 2:
                d.rectangle([x, y, x + n - 1, y + n - 1], fill=(222, 228, 238))
    return img


def label(d, x, y, s, size=18, fill=INK):
    d.text((x, y), s, font=font('semi', size), fill=rgba(fill))


def write_sheets(sheet_dir, built):
    os.makedirs(sheet_dir, exist_ok=True)
    ids = list(built)
    # all cards side by side (1x), then the same cards at the roster's real size with its overlays
    gap = 16
    cw, ch = 300, 500
    sw = len(ids) * (cw + gap) + gap
    small_w, small_h = 120, 200
    sh = gap + ch + 34 + small_h * 2 + 60
    sheet = Image.new('RGB', (sw, sh), (238, 242, 248))
    d = ImageDraw.Draw(sheet)
    for i, uid in enumerate(ids):
        card = built[uid]['img']['card'].convert('RGB')
        x = gap + i * (cw + gap)
        sheet.paste(card, (x, gap))
        label(d, x, gap + ch + 6, uid)
        # roster tile at 2x device pixels (240 x 400) with the UI's overlays mocked
        tile = card.resize((small_w * 2, small_h * 2), Image.LANCZOS).convert('RGBA')
        ov = Image.new('RGBA', tile.size, (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        for yy in range(int(tile.height * 0.8), tile.height):
            t = (yy - tile.height * 0.8) / (tile.height * 0.2)
            od.line([(0, yy), (tile.width, yy)], fill=(10, 20, 40, int(216 * t)))
        tile.alpha_composite(ov)
        td = ImageDraw.Draw(tile)
        td.text((12, 8), 'SSR', font=font('bold', 30), fill=(255, 122, 217, 255))
        td.text((tile.width - 70, 8), 'Lv 1', font=font('bold', 28), fill=(255, 255, 255, 255))
        td.text((12, tile.height - 40), built[uid]['name'], font=font('bold', 30), fill=(255, 255, 255, 255))
        sheet.paste(tile.convert('RGB'), (x + (cw - tile.width) // 2, gap + ch + 34))
    label(d, gap, sh - 26, 'top: card.webp at 1x  ·  bottom: the roster tile (120 x 200 css px at 2x) with mocked rarity, level and name')
    sheet.save(os.path.join(sheet_dir, 'sheet-cards.png'))

    # one girl at every size
    uid = ids[0]
    imgs = built[uid]['img']
    order = [('full', 768, 1024), ('card', 300, 500), ('bust', 512, 512), ('thumb', 160, 160)]
    cut, cut_s = imgs['cut'], imgs['cut-s']
    tw = gap + sum(w + gap for _, w, _ in order) + cut.width + gap + cut_s.width + gap
    th = gap + 1024 + 40
    sheet = Image.new('RGB', (tw, th), (238, 242, 248))
    d = ImageDraw.Draw(sheet)
    x = gap
    for kind, w, h in order:
        sheet.paste(imgs[kind].convert('RGB'), (x, gap))
        label(d, x, gap + h + 6, f'{uid}-{kind}  {w}x{h}')
        x += w + gap
    for kind, im in (('cut', cut), ('cut-s', cut_s)):
        bgc = checker(im.width, im.height)
        bgc = bgc.convert('RGBA')
        bgc.alpha_composite(im)
        sheet.paste(bgc.convert('RGB'), (x, gap))
        label(d, x, gap + im.height + 6, f'{uid}-{kind}  {im.width}x{im.height}')
        x += im.width + gap
    sheet.save(os.path.join(sheet_dir, 'sheet-sizes.png'))


def main():
    global ROOT, SS
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('ids', nargs='*', help='girl ids (default: every roster girl with no portrait files)')
    ap.add_argument('--root', default=ROOT, help='repo root to read src/data and the fonts from')
    ap.add_argument('--out', default=None, help='output folder (default <root>/public/art/portraits)')
    ap.add_argument('--sheets', default=None, help='also write sheet-cards.png and sheet-sizes.png here')
    ap.add_argument('--ss', type=int, default=SS, help='supersampling factor (default 4)')
    ap.add_argument('--force', action='store_true',
                    help='replace existing portrait files in public/art/portraits with the sign')
    args = ap.parse_args()
    ROOT = os.path.abspath(args.root)
    SS = max(1, args.ss)
    art_dir = os.path.join(ROOT, 'public', 'art', 'portraits')
    out_dir = os.path.abspath(args.out or art_dir)
    units = load_units(args.ids)
    # never draw over a girl's art: painted girls (and earlier signs) keep their files
    guarded = os.path.realpath(out_dir) == os.path.realpath(art_dir) and not args.force
    if not args.ids:
        units = [u for u in units if not has_portrait_files(art_dir, u['id'])]
        if not units:
            print('every roster girl already has portrait files; nothing to draw '
                  '(pass ids with --out DIR to review a sign, or --force to replace files)')
            return
    elif guarded:
        taken = [u['id'] for u in units if has_portrait_files(art_dir, u['id'])]
        if taken:
            sys.exit(f'refusing to overwrite the portrait files of {", ".join(taken)} in {art_dir} '
                     '(painted art?): use --out DIR to draw them elsewhere, or --force to replace them')
    os.makedirs(out_dir, exist_ok=True)
    built = {}
    for u in units:
        data, imgs = build(u, out_dir)
        built[u['id']] = {'img': imgs, 'name': u['name']}
        print(f"  {u['id']}: {{ face: [{data['face'][0]}, {data['face'][1]}], cut: {data['cut']} }},")
    if args.sheets:
        write_sheets(args.sheets, built)


if __name__ == '__main__':
    main()
