#!/usr/bin/env python3
"""Placeholder portraits for girls whose painted art is still waiting for the owner's approval.

Draws, for each listed girl, the six portrait files src/art/portraits.js expects in
public/art/portraits/ (all .webp):

  <id>-full.webp   768x1024  gradient + full chibi figure + name band
  <id>-card.webp   300x500   head top ~8%, bottom at the hips
  <id>-bust.webp   512x512   head and shoulders, face in the upper third
  <id>-thumb.webp  160x160   small bust (kept < 20 KB)
  <id>-cut.webp    transparent full-figure stand, 1000 px tall
  <id>-cut-s.webp  the same stand, 360 px tall

Everything is drawn with Pillow from simple shapes: a soft vertical gradient in her palette, a
neutral chibi figure (hair shape hint, school / staff outfit colours, halo), a small emblem of her
signature gear, her name, her title and an "Art coming soon" tag. No generators, no network.

Names, titles, palettes and looks are read from src/data/unitsExpansion.js (the returning girls)
and src/data/unitsNewGirls.js (the new girls) through node, so the colours are never written twice.
Prints the PORTRAIT_DATA lines (face + cut aspect) to paste into src/art/portraits.js.

Usage (from the repo root):
  python3 -I tools/art/placeholder_portraits.py            # the nine returning girls
  python3 -I tools/art/placeholder_portraits.py ruri noa   # just these (returning or new girls)
"""

import json
import math
import os
import random
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'art', 'portraits')
FONT_DIR = '/usr/share/fonts/opentype/inter'
FALLBACK_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

# Figure resolution: head radius in px for the master drawing (downscaled for every output).
R = 220


# ---------------------------------------------------------------------------------------------
# data

def load_units(ids):
    code = (
        "import { EXPANSION_UNITS } from './src/data/unitsExpansion.js';"
        "import { NEW_GIRLS } from './src/data/unitsNewGirls.js';"
        "const pick = (u, fresh) => ({ id: u.id, name: u.name, title: u.title, adult: !!u.adult, palette: u.palette, look: u.look, fresh });"
        "console.log(JSON.stringify([...EXPANSION_UNITS.map((u) => pick(u, false)), ...NEW_GIRLS.map((u) => pick(u, true))]));"
    )
    raw = subprocess.run(['node', '--input-type=module', '-e', code], cwd=ROOT, check=True,
                         capture_output=True, text=True).stdout
    units = json.loads(raw)
    if ids:
        units = [u for u in units if u['id'] in ids]
        missing = set(ids) - {u['id'] for u in units}
        if missing:
            sys.exit(f'unknown ids: {", ".join(sorted(missing))}')
    else:
        units = [u for u in units if not u['fresh']]  # (the default run stays the nine returning girls)
    return units


# ---------------------------------------------------------------------------------------------
# colour helpers

def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
INK = (34, 28, 40)


def lum(c):
    return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255


def font(weight, size):
    for name in (f'InterDisplay-{weight}.otf', f'Inter-{weight}.otf'):
        p = os.path.join(FONT_DIR, name)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.truetype(FALLBACK_FONT, size)


# ---------------------------------------------------------------------------------------------
# the chibi figure (unit coords: head radius 1, head centre (0, 0), y down)

class Pen:
    """Draws unit-coordinate shapes onto an RGBA canvas."""

    def __init__(self, img, ox, oy, s):
        self.d = ImageDraw.Draw(img)
        self.ox, self.oy, self.s = ox, oy, s

    def p(self, x, y):
        return (self.ox + x * self.s, self.oy + y * self.s)

    def poly(self, pts, fill):
        self.d.polygon([self.p(x, y) for x, y in pts], fill=fill)

    def ell(self, cx, cy, rx, ry, fill=None, outline=None, width=0):
        x0, y0 = self.p(cx - rx, cy - ry)
        x1, y1 = self.p(cx + rx, cy + ry)
        self.d.ellipse([x0, y0, x1, y1], fill=fill, outline=outline,
                       width=max(1, round(width * self.s)) if outline else 0)

    def line(self, pts, fill, width):
        self.d.line([self.p(x, y) for x, y in pts], fill=fill, width=max(1, round(width * self.s)), joint='curve')

    def arc(self, cx, cy, rx, ry, a0, a1, fill, width):
        x0, y0 = self.p(cx - rx, cy - ry)
        x1, y1 = self.p(cx + rx, cy + ry)
        self.d.arc([x0, y0, x1, y1], a0, a1, fill=fill, width=max(1, round(width * self.s)))


def blob(cx, cy, rx, ry, n=40, wob=0.0, phase=0.0, k=6):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        w = 1 + wob * math.sin(k * a + phase)
        pts.append((cx + rx * w * math.cos(a), cy + ry * w * math.sin(a)))
    return pts


def teardrop(x0, y0, x1, y1, w0, w1, bend=0.0, n=24):
    """A tapered lock of hair from (x0,y0) (width w0) to (x1,y1) (width w1), bowed sideways."""
    left, right = [], []
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t + bend * math.sin(math.pi * t)
        y = y0 + (y1 - y0) * t
        w = (w0 + (w1 - w0) * t) * (0.55 + 0.45 * math.sin(math.pi * min(1, t * 1.15 + 0.12)))
        left.append((x - w, y))
        right.append((x + w, y))
    return left + right[::-1]


def draw_figure(u):
    """Full-figure stand on a transparent canvas. Returns (image, head_centre_px, head_radius_px)."""
    pal = {k: rgb(v) for k, v in u['palette'].items()}
    look = u['look']
    adult = u['adult']
    hair, hair_s = pal['hair'], pal['hairShade']
    skin = pal['skin']
    outfit, outfit_s = pal['outfit'], pal['outfitShade']
    accent = pal['accent']
    halo = pal['halo']
    eyes = mix(pal['eyes'], INK, 0.45)
    style = look.get('hairStyle', 'bob')
    outfit_kind = look.get('outfit', 'blazer')

    W, H = int(R * 4.4), int(R * 6.9)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cx, cy = W / 2, R * 1.75
    pen = Pen(img, cx, cy, R)

    leg_top, leg_bot = (3.25, 4.75) if adult else (3.15, 4.35)
    # light outfits get a deeper skirt so the figure keeps its shape
    skirt = outfit_s if lum(outfit_s) < 0.75 else mix(outfit_s, INK, 0.25)
    legwear = mix(outfit_s, INK, 0.35) if (adult or lum(outfit) < 0.3) else skin

    # --- back hair -------------------------------------------------------------------------
    if style == 'wavy':
        pts = [(-1.12, -0.2)]
        for i in range(13):
            t = i / 12
            pts.append((-1.12 - 0.18 * t + 0.07 * math.sin(t * 9), -0.2 + 3.0 * t))
        for i in range(9):
            t = i / 8
            pts.append((-1.3 + 2.6 * t, 2.8 + 0.12 * math.sin(t * math.pi * 4)))
        for i in range(13):
            t = 1 - i / 12
            pts.append((1.12 + 0.18 * t - 0.07 * math.sin(t * 9), -0.2 + 3.0 * t))
        pen.poly(pts, hair_s)
    elif style == 'ponytail':
        pen.poly(teardrop(0.55, -0.95, 1.35, 2.9, 0.42, 0.08, bend=0.55), hair_s)
        pen.poly(blob(0, 0.15, 1.12, 1.05), hair_s)
    else:
        pen.poly(blob(0, 0.2, 1.13, 1.05), hair_s)
        pen.poly([(-1.1, 0.2), (1.1, 0.2), (1.02, 0.95), (-1.02, 0.95)], hair_s)

    if style == 'twintails':
        for sgn in (-1, 1):
            pen.ell(sgn * 1.07, -0.3, 0.3, 0.26, fill=hair)
            pen.poly(teardrop(sgn * 1.05, -0.35, sgn * 1.45, 3.0, 0.42, 0.1, bend=sgn * 0.3), hair)
            pen.poly(teardrop(sgn * 1.08, -0.2, sgn * 1.42, 2.7, 0.18, 0.04, bend=sgn * 0.32), hair_s)

    # --- legs, shoes ---------------------------------------------------------------------
    for sgn in (-1, 1):
        x = sgn * 0.3
        pen.poly([(x - 0.17, leg_top), (x + 0.17, leg_top), (x + 0.14, leg_bot), (x - 0.14, leg_bot)], legwear)
        pen.ell(x + sgn * 0.05, leg_bot + 0.06, 0.26, 0.15, fill=mix(outfit_s, INK, 0.55))

    # --- body ----------------------------------------------------------------------------
    # skirt / coat tail
    if outfit_kind == 'coat':
        hem = 3.45 if adult else 3.3
        pen.poly([(-0.78, 2.2), (0.78, 2.2), (1.02, hem), (-1.02, hem)], outfit)
        pen.poly([(-0.06, 2.3), (0.06, 2.3), (0.1, hem), (-0.1, hem)], outfit_s)
        if not adult or u['id'] == 'seiran':
            pen.poly([(-0.86, 2.55), (0.86, 2.55), (1.08, 3.25), (-1.08, 3.25)], skirt)
            pen.poly([(-0.78, 2.2), (-0.15, 2.2), (-0.3, hem), (-1.02, hem)], outfit)
            pen.poly([(0.15, 2.2), (0.78, 2.2), (1.02, hem), (0.3, hem)], outfit)
    else:
        pts = [(-0.74, 2.35), (0.74, 2.35)]
        for i in range(9):
            t = i / 8
            pts.append((1.08 - 2.16 * t, 3.25 + (0.06 if i % 2 else 0)))
        pen.poly(pts, skirt)
        for i in range(1, 6):
            t = i / 6
            pen.line([(-0.74 + 1.48 * t, 2.42), (-1.06 + 2.12 * t, 3.22)], mix(skirt, INK, 0.18), 0.025)

    # arms (behind torso edge)
    sleeve = outfit
    for sgn in (-1, 1):
        pen.poly([(sgn * 0.62, 1.2), (sgn * 0.98, 1.4), (sgn * 1.14, 2.45), (sgn * 0.84, 2.5), (sgn * 0.7, 1.7)], sleeve)
        pen.ell(sgn * 1.0, 2.58, 0.15, 0.15, fill=skin)
    # torso
    pen.poly([(-0.55, 1.08), (0.55, 1.08), (0.9, 1.36), (0.8, 2.55), (-0.8, 2.55), (-0.9, 1.36)], outfit)
    pen.poly([(0.55, 1.08), (0.9, 1.36), (0.8, 2.55), (0.55, 2.55), (0.62, 1.4)], mix(outfit, outfit_s, 0.35))

    # neck
    pen.poly([(-0.17, 0.8), (0.17, 0.8), (0.2, 1.2), (-0.2, 1.2)], mix(skin, hair_s, 0.12))

    # collar / tie per outfit
    if outfit_kind == 'sailor':
        pen.poly([(-0.6, 1.08), (0.6, 1.08), (0.82, 1.4), (0.0, 1.85), (-0.82, 1.4)], accent)
        pen.poly([(-0.42, 1.12), (0.42, 1.12), (0.0, 1.62)], skin)
        pen.line([(-0.72, 1.36), (0.0, 1.78), (0.72, 1.36)], WHITE, 0.035)
        pen.poly([(-0.16, 1.7), (0.16, 1.7), (0.0, 1.95)], accent)
    elif outfit_kind == 'hoodie':
        pen.poly([(-0.68, 1.02), (0.68, 1.02), (0.5, 1.32), (-0.5, 1.32)], outfit_s)
        pen.poly([(-0.3, 1.1), (0.3, 1.1), (0.0, 1.5)], WHITE)
        for sgn in (-1, 1):
            pen.line([(sgn * 0.18, 1.3), (sgn * 0.2, 1.85)], accent, 0.04)
            pen.ell(sgn * 0.2, 1.88, 0.05, 0.05, fill=accent)
        pen.line([(0.0, 1.5), (0.0, 2.5)], outfit_s, 0.03)
    else:  # blazer / coat: lapels and a tie
        shirt = WHITE if lum(outfit) < 0.85 else mix(WHITE, accent, 0.15)
        pen.poly([(-0.32, 1.08), (0.32, 1.08), (0.0, 1.75)], shirt)
        pen.poly([(-0.07, 1.16), (0.07, 1.16), (0.11, 1.62), (0.0, 1.74), (-0.11, 1.62)], accent)
        lap = mix(outfit_s, outfit, 0.25)
        for sgn in (-1, 1):
            pen.poly([(sgn * 0.32, 1.08), (sgn * 0.55, 1.08), (sgn * 0.28, 1.6), (sgn * 0.02, 1.85)], lap)
        if outfit_kind == 'coat':
            for k in range(3):
                pen.ell(-0.18, 1.95 + k * 0.22, 0.04, 0.04, fill=mix(accent, WHITE, 0.3))
        pen.ell(0.48, 1.5, 0.09, 0.09, fill=accent)  # emblem badge

    # --- head ----------------------------------------------------------------------------
    pen.ell(0, 0.05, 1.0, 0.95, fill=skin)
    # eyes + mouth (soft chibi face)
    es = look.get('eyeStyle', 'round')
    for sgn in (-1, 1):
        ex = sgn * 0.4
        if es == 'sleepy':
            pen.arc(ex, 0.3, 0.14, 0.09, 0, 180, eyes, 0.05)
        else:
            ry = 0.17 if es != 'sharp' else 0.14
            pen.ell(ex, 0.3, 0.12, ry, fill=eyes)
            pen.ell(ex - 0.035, 0.25, 0.04, 0.05, fill=WHITE)
            if es == 'sparkle':
                pen.ell(ex + 0.04, 0.36, 0.022, 0.022, fill=WHITE)
    pen.arc(0, 0.6, 0.12, 0.07, 20, 160, mix(skin, INK, 0.5), 0.035)
    pen.ell(-0.62, 0.52, 0.13, 0.07, fill=mix(skin, (255, 140, 150), 0.25))
    pen.ell(0.62, 0.52, 0.13, 0.07, fill=mix(skin, (255, 140, 150), 0.25))

    # --- front hair: crown + bangs ---------------------------------------------------------
    bangs = look.get('bangs', 'straight')
    arc_pts = []
    for i in range(25):
        a = math.radians(196 + (344 - 196) * i / 24)
        arc_pts.append((1.08 * math.cos(a), 0.05 + 1.02 * math.sin(a)))
    edge = {
        'hime': [(0.99, 0.0), (0.7, 0.0), (0.7, -0.08), (-0.7, -0.08), (-0.7, 0.0), (-0.99, 0.0)],
        'straight': [(0.99, -0.1), (0.6, -0.02), (-0.6, -0.02), (-0.99, -0.1)],
        'split': [(0.99, 0.0), (0.55, -0.02), (0.08, -0.5), (-0.08, -0.5), (-0.55, -0.02), (-0.99, 0.0)],
        'swept': [(0.99, -0.05), (0.55, 0.02), (0.2, -0.12), (-0.25, -0.38), (-0.7, -0.55), (-0.99, -0.3)],
        'messy': [(0.99, 0.05), (0.72, -0.18), (0.5, 0.06), (0.24, -0.2), (0.0, 0.08), (-0.26, -0.2),
                  (-0.5, 0.06), (-0.72, -0.18), (-0.99, 0.05)],
    }.get(bangs)
    if edge is None:
        edge = [(0.99, 0.0), (0.7, -0.12), (0.45, 0.05), (0.2, -0.15), (-0.05, 0.04), (-0.3, -0.15),
                (-0.55, 0.04), (-0.8, -0.1), (-0.99, 0.0)]
    # arc_pts runs left -> over the top -> right; edge runs right -> left
    pen.poly(arc_pts + edge, hair)
    # side locks
    for sgn in (-1, 1):
        pen.poly(teardrop(sgn * 0.93, -0.1, sgn * 0.98, 0.95, 0.12, 0.05), hair)
    # shine
    pen.arc(-0.1, -0.35, 0.62, 0.4, 200, 300, mix(hair, WHITE, 0.35), 0.06)

    # braid over the shoulder / buns / ties
    if style == 'braid':
        for k in range(8):
            y = 0.75 + k * 0.29
            pen.ell(-0.82 - 0.04 * math.sin(k), y, 0.19 - k * 0.008, 0.17, fill=hair if k % 2 == 0 else mix(hair, hair_s, 0.5))
        pen.ell(-0.82, 0.75 + 8 * 0.29 - 0.08, 0.1, 0.07, fill=accent)
        pen.poly(teardrop(-0.82, 2.95, -0.82, 3.35, 0.12, 0.02), hair)
    if style == 'buns':
        for sgn in (-1, 1):
            pen.ell(sgn * 0.72, -0.78, 0.36, 0.34, fill=hair)
            pen.arc(sgn * 0.72, -0.78, 0.24, 0.22, 200, 300, mix(hair, WHITE, 0.3), 0.04)
    if style == 'twintails':
        for sgn in (-1, 1):
            pen.ell(sgn * 1.0, -0.38, 0.13, 0.13, fill=accent)
    if style == 'ponytail':
        pen.ell(0.62, -0.9, 0.12, 0.12, fill=accent)

    # accessory
    acc = look.get('accessory', 'none')
    if acc == 'horns':
        ivory = mix(accent, WHITE, 0.5) if lum(accent) > 0.5 else (243, 233, 210)
        if u['palette'].get('halo') and u['id'] == 'seiran':
            ivory = rgb(u['palette']['weapon'])
        for sgn in (-1, 1):
            pen.poly([(sgn * 0.42, -0.86), (sgn * 0.7, -0.74), (sgn * 0.68, -1.32)], ivory)
    elif acc == 'catEars':
        for sgn in (-1, 1):
            pen.poly([(sgn * 0.3, -0.92), (sgn * 0.88, -0.6), (sgn * 0.78, -1.38)], mix(outfit_s, INK, 0.1))
            pen.poly([(sgn * 0.45, -0.88), (sgn * 0.78, -0.7), (sgn * 0.73, -1.18)], accent)
        pen.arc(0, -0.05, 1.12, 1.07, 200, 340, mix(outfit_s, INK, 0.1), 0.07)
    elif acc == 'hairpin':
        star(pen, 0.62, -0.5, 0.15, mix(halo, accent, 0.4))
    elif acc == 'flower':
        fx, fy = 0.7, -0.6
        petal = pal['weapon'] if u['id'] == 'noa' else accent
        for k in range(5):
            a = 2 * math.pi * k / 5 - math.pi / 2
            pen.ell(fx + 0.12 * math.cos(a), fy + 0.12 * math.sin(a), 0.1, 0.1, fill=petal)
        pen.ell(fx, fy, 0.07, 0.07, fill=mix(halo, (255, 220, 120), 0.5))

    # halo
    pen.ell(0, -1.62, 0.66, 0.16, outline=(*halo, 255), width=0.075)

    # dark contour around the whole silhouette + gentle drop shadow (crisp on any background)
    a = img.getchannel('A')
    grow = a.filter(ImageFilter.MaxFilter(9))
    contour = Image.new('RGBA', img.size, (*mix(outfit_s, INK, 0.6), 255))
    contour.putalpha(grow)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.alpha_composite(contour)
    out.alpha_composite(img)
    return out, (cx, cy), R


def star(pen, cx, cy, r, fill, points=5):
    pts = []
    for i in range(points * 2):
        a = -math.pi / 2 + math.pi * i / points
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    pen.poly(pts, fill)


# ---------------------------------------------------------------------------------------------
# emblem: a simple icon of her signature gear, in a round badge

def emblem(weapon, pal, size):
    s = size * 4
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ring = mix(rgb(pal['halo']), WHITE, 0.4)
    d.ellipse([4, 4, s - 4, s - 4], fill=(255, 255, 255, 215), outline=(*mix(rgb(pal['outfitShade']), INK, 0.3), 255), width=s // 22)
    pen = Pen(img, s / 2, s / 2, s * 0.3)
    ink = mix(rgb(pal['outfitShade']), INK, 0.35)
    acc = rgb(pal['accent']) if lum(rgb(pal['accent'])) < 0.8 else rgb(pal['hairShade'])
    w = 0.16
    if weapon == 'mallet':  # crossed drumsticks over a drum pad
        pen.ell(0, 0.25, 0.75, 0.38, fill=acc)
        pen.ell(0, 0.12, 0.75, 0.32, fill=mix(acc, WHITE, 0.5))
        pen.line([(-0.8, -0.9), (0.5, 0.3)], ink, w)
        pen.line([(0.8, -0.9), (-0.5, 0.3)], ink, w)
    elif weapon == 'puppet':  # control bar with strings and a small drone
        pen.line([(-0.8, -0.75), (0.8, -0.75)], ink, w)
        for x in (-0.6, 0, 0.6):
            pen.line([(x, -0.75), (x * 0.5, 0.15)], acc, 0.06)
        pen.ell(0, 0.4, 0.42, 0.28, fill=acc)
        pen.ell(0, 0.4, 0.16, 0.12, fill=WHITE)
    elif weapon == 'spear':  # lightning bolt
        pen.poly([(0.15, -0.95), (-0.5, 0.1), (-0.05, 0.1), (-0.25, 0.95), (0.5, -0.2), (0.05, -0.2), (0.3, -0.95)], acc)
    elif weapon == 'fan':  # folding fan
        pts = [(0, 0.7)]
        for i in range(13):
            a = math.radians(205 + 130 * i / 12)
            pts.append((1.0 * math.cos(a), 0.7 + 1.45 * math.sin(a)))
        pen.poly(pts, acc)
        for i in range(7):
            a = math.radians(205 + 130 * i / 6)
            pen.line([(0, 0.7), (0.95 * math.cos(a), 0.7 + 1.38 * math.sin(a))], mix(acc, WHITE, 0.55), 0.05)
        pen.ell(0, 0.7, 0.12, 0.12, fill=ink)
    elif weapon == 'bow':
        pen.arc(-0.35, 0, 0.85, 0.95, 270, 450, ink, w)
        pen.line([(-0.35, -0.95), (-0.35, 0.95)], acc, 0.05)
        pen.line([(-0.6, 0), (0.85, 0)], acc, 0.08)
        pen.poly([(0.95, 0), (0.7, -0.15), (0.7, 0.15)], acc)
    elif weapon == 'tome':  # tablet with a little fox-star hologram
        pen.poly([(-0.6, -0.15), (0.6, -0.15), (0.6, 0.85), (-0.6, 0.85)], ink)
        pen.poly([(-0.5, -0.05), (0.5, -0.05), (0.5, 0.75), (-0.5, 0.75)], mix(acc, WHITE, 0.3))
        star(pen, 0, -0.55, 0.35, acc)
    elif weapon == 'shield':
        pen.poly([(0, -0.9), (0.75, -0.6), (0.65, 0.25), (0, 0.9), (-0.65, 0.25), (-0.75, -0.6)], acc)
        for k in range(5):
            a = 2 * math.pi * k / 5 - math.pi / 2
            pen.ell(0.2 * math.cos(a), -0.05 + 0.2 * math.sin(a), 0.16, 0.16, fill=rgb(pal['weapon']))
        pen.ell(0, -0.05, 0.1, 0.1, fill=WHITE)
    elif weapon == 'mirror':
        pen.line([(0, 0.3), (0, 0.95)], ink, w)
        pen.ell(0, -0.25, 0.6, 0.6, fill=ink)
        pen.ell(0, -0.25, 0.48, 0.48, fill=mix(rgb(pal['weapon']), WHITE, 0.3))
        pen.line([(-0.2, -0.45), (0.05, -0.65)], WHITE, 0.08)
    elif weapon == 'cards':
        for k, (dx, ang) in enumerate(((-0.3, -15), (0.3, 15))):
            card = Image.new('RGBA', (s, s), (0, 0, 0, 0))
            cp = Pen(card, s / 2, s / 2, s * 0.3)
            cp.poly([(-0.42, -0.65), (0.42, -0.65), (0.42, 0.65), (-0.42, 0.65)], ink)
            cp.poly([(-0.34, -0.57), (0.34, -0.57), (0.34, 0.57), (-0.34, 0.57)], WHITE if k else mix(acc, WHITE, 0.6))
            star(cp, 0, 0, 0.22, acc)
            card = card.rotate(-ang, resample=Image.BICUBIC, center=(s / 2, s / 2), translate=(dx * s * 0.3, 0))
            img.alpha_composite(card)
    elif weapon == 'strip':  # a reel of folding spike strips
        pen.ell(-0.25, 0, 0.62, 0.62, fill=acc)
        pen.ell(-0.25, 0, 0.22, 0.22, fill=ink)
        pen.poly([(0.05, 0.42), (0.95, 0.42), (0.95, 0.62), (0.05, 0.62)], ink)
        for k in range(4):
            x = 0.15 + k * 0.22
            pen.poly([(x - 0.08, 0.42), (x + 0.08, 0.42), (x, 0.2)], mix(rgb(pal['weapon']), WHITE, 0.3))
    elif weapon == 'needle':  # a big needle with a loop of thread, over a pincushion
        pen.ell(-0.35, 0.45, 0.42, 0.34, fill=acc)
        pen.ell(-0.35, 0.3, 0.12, 0.08, fill=mix(acc, WHITE, 0.5))
        pen.line([(-0.6, 0.85), (0.75, -0.85)], ink, 0.1)
        pen.ell(0.68, -0.76, 0.12, 0.12, outline=(*ink, 255), width=0.05)
        pen.arc(0.35, -0.3, 0.45, 0.6, 300, 120, acc, 0.05)
    else:
        star(pen, 0, 0, 0.8, acc)
    return img.resize((size, size), Image.LANCZOS)


# ---------------------------------------------------------------------------------------------
# framed compositions

def gradient(w, h, stops):
    """Vertical gradient through [(t, colour), ...]."""
    col = Image.new('RGB', (1, h))
    px = col.load()
    for y in range(h):
        t = y / max(1, h - 1)
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                px[0, y] = mix(c0, c1, (t - t0) / max(1e-6, t1 - t0))
                break
    return col.resize((w, h), Image.BILINEAR).convert('RGBA')


def background(u, w, h, petals=True):
    pal = {k: rgb(v) for k, v in u['palette'].items()}
    top = mix(pal['halo'], WHITE, 0.55)
    mid = mix(pal['hair'], WHITE, 0.5)
    bot = mix(pal['outfit'], pal['outfitShade'], 0.4)
    if lum(bot) > 0.7:
        bot = mix(pal['accent'], pal['outfitShade'], 0.5)
    img = gradient(w, h, [(0, top), (0.55, mid), (1, bot)])
    # soft glow behind the figure
    glow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([w * 0.08, h * 0.08, w * 0.92, h * 0.08 + w * 0.84], fill=(255, 255, 255, 110))
    glow = glow.filter(ImageFilter.GaussianBlur(w * 0.08))
    img.alpha_composite(glow)
    if petals:
        rnd = random.Random(u['id'])
        layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        for _ in range(14):
            x, y = rnd.uniform(0, w), rnd.uniform(0, h * 0.8)
            r = rnd.uniform(0.012, 0.03) * w
            c = mix(pal['halo'], WHITE, 0.4)
            ld.ellipse([x - r, y - r * 0.6, x + r, y + r * 0.6], fill=(*c, rnd.randint(70, 140)))
        img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(1)))
    return img


def place(canvas, fig, scale, x, y):
    f = fig.resize((max(1, round(fig.width * scale)), max(1, round(fig.height * scale))), Image.LANCZOS)
    canvas.alpha_composite(f, (round(x), round(y)))


def text_center(d, cx, y, s, fnt, fill, shadow=None, spacing=0):
    widths = [d.textlength(ch, font=fnt) for ch in s]
    total = sum(widths) + spacing * (len(s) - 1)
    x = cx - total / 2
    for ch, wch in zip(s, widths):
        if shadow:
            d.text((x + shadow[0], y + shadow[1]), ch, font=fnt, fill=shadow[2])
        d.text((x, y), ch, font=fnt, fill=fill)
        x += wch + spacing


def fit_font(d, s, weight, size, max_w):
    while size > 8:
        f = font(weight, size)
        if d.textlength(s, font=f) <= max_w:
            return f
        size -= 1
    return font(weight, 8)


def name_band(img, u, band_top, name_px, title_px, tag=True):
    w, h = img.size
    pal = {k: rgb(v) for k, v in u['palette'].items()}
    dark = mix(pal['outfitShade'], INK, 0.55)
    band = gradient(w, h - band_top, [(0, dark), (1, dark)])
    mask = Image.linear_gradient('L').resize((w, h - band_top)).point(lambda v: min(220, int(v * 1.6)))
    band.putalpha(mask)
    img.alpha_composite(band, (0, band_top))
    d = ImageDraw.Draw(img)
    nf = fit_font(d, u['name'].upper(), 'Black', name_px, w * 0.86)
    sp = round(name_px * 0.06)
    name_y = h - (name_px + title_px * 1.5 + h * 0.035) if title_px else h - name_px * 1.35
    text_center(d, w / 2, name_y, u['name'].upper(), nf, WHITE, shadow=(0, max(1, name_px // 24), (*dark, 200)), spacing=sp)
    if title_px:
        tf = fit_font(d, u['title'], 'SemiBold', title_px, w * 0.88)
        text_center(d, w / 2, name_y + name_px * 1.12, u['title'], tf, (*mix(pal['halo'], WHITE, 0.6), 255))
    if tag:
        px = max(11, round(w * 0.03))
        tag_label(img, u, w / 2, name_y - px * 2.6, px, centered=True)


def tag_label(img, u, x, y, px, centered=False):
    d = ImageDraw.Draw(img)
    f = font('Bold', px)
    label = 'ART COMING SOON'
    tw = d.textlength(label, font=f) + px * 0.08 * len(label)
    pad_x, pad_y = px * 0.8, px * 0.45
    if centered:
        x -= tw / 2 + pad_x
    box = [x, y, x + tw + pad_x * 2, y + px + pad_y * 2]
    pal = {k: rgb(v) for k, v in u['palette'].items()}
    d.rounded_rectangle(box, radius=(px + pad_y * 2) / 2, fill=(255, 255, 255, 230),
                        outline=(*mix(pal['outfitShade'], INK, 0.3), 255), width=max(1, px // 10))
    text_center(d, (box[0] + box[2]) / 2, y + pad_y - px * 0.12, label, f, (*mix(pal['outfitShade'], INK, 0.5), 255),
                spacing=px * 0.08)


def frame(img, u):
    w, h = img.size
    pal = {k: rgb(v) for k, v in u['palette'].items()}
    d = ImageDraw.Draw(img)
    inset = max(3, round(w * 0.018))
    d.rounded_rectangle([inset, inset, w - inset - 1, h - inset - 1], radius=inset * 2,
                        outline=(*mix(pal['halo'], WHITE, 0.5), 160), width=max(1, w // 300))


def compose(u, fig, head, r, w, h, view_top, view_bot, head_x=0.5, name_px=0, title_px=0, tag=True, badge=0):
    """Scale the figure so the unit-span [view_top, view_bot] (head radii from head centre) fills h."""
    img = background(u, w, h)
    scale = h / ((view_bot - view_top) * r)
    hx, hy = head
    x = w * head_x - hx * scale
    y = -(hy + view_top * r) * scale
    place(img, fig, scale, x, y)
    face = (100 * (x + hx * scale) / w, 100 * (y + (hy + 0.25 * r) * scale) / h)
    if name_px:
        name_band(img, u, round(h * (0.64 if h > w else 0.6)), name_px, title_px, tag)
    elif tag:
        tag_label(img, u, round(w * 0.04), round(w * 0.04), max(11, round(w * 0.032)))
    if badge:
        e = emblem(u['look'].get('weapon'), u['palette'], badge)
        img.alpha_composite(e, (w - badge - round(w * 0.04), round(w * 0.04)))
    frame(img, u)
    return img.convert('RGB'), face


def save_webp(img, path, quality, max_bytes=None):
    q = quality
    while True:
        img.save(path, 'WEBP', quality=q, method=4)
        if not max_bytes or os.path.getsize(path) < max_bytes or q <= 40:
            return
        q -= 8


def build(u):
    fig, head, r = draw_figure(u)
    bbox = fig.getchannel('A').getbbox()
    pad = round(r * 0.06)
    bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(fig.width, bbox[2] + pad), min(fig.height, bbox[3] + pad))
    stand = fig.crop(bbox)
    head_c = (head[0] - bbox[0], head[1] - bbox[1])
    top_units = -head_c[1] / r
    bot_units = (stand.height - head_c[1]) / r
    p = lambda kind: os.path.join(OUT, f"{u['id']}-{kind}.webp")

    # full 768x1024: whole figure, name band at the bottom
    span = bot_units - top_units
    full, face = compose(u, stand, head_c, r, 768, 1024, top_units - span * 0.06, bot_units + span * 0.42,
                         name_px=92, title_px=30, badge=96)
    save_webp(full, p('full'), 86)
    # card 300x500: head top ~8%, bottom at the hips; no baked text or badge (every list card draws
    # her rarity, level, role and name on top of it)
    card, _ = compose(u, stand, head_c, r, 300, 500, -1.95, 3.45, tag=False)
    save_webp(card, p('card'), 82, 78_000)
    # bust 512: head and shoulders, face in the upper third
    bust, _ = compose(u, stand, head_c, r, 512, 512, -1.95, 2.6, tag=False)
    save_webp(bust, p('bust'), 84)
    # thumb 160: same framing, no text (too small to read), no tag
    thumb_src, _ = compose(u, stand, head_c, r, 320, 320, -1.95, 2.6, tag=False)
    thumb = thumb_src.resize((160, 160), Image.LANCZOS)
    save_webp(thumb, p('thumb'), 80, 19_000)
    # transparent stands
    cut = stand.resize((round(stand.width * 1000 / stand.height), 1000), Image.LANCZOS)
    cut.save(p('cut'), 'WEBP', quality=88, method=4)
    cut_s = stand.resize((round(stand.width * 360 / stand.height), 360), Image.LANCZOS)
    cut_s.save(p('cut-s'), 'WEBP', quality=88, method=4)
    return {'face': [round(face[0]), round(face[1])], 'cut': round(cut.width / cut.height, 3)}


def main():
    ids = sys.argv[1:]
    units = load_units(ids)
    os.makedirs(OUT, exist_ok=True)
    for u in units:
        data = build(u)
        print(f"  {u['id']}: {{ face: [{data['face'][0]}, {data['face'][1]}], cut: {data['cut']} }},")


if __name__ == '__main__':
    main()
