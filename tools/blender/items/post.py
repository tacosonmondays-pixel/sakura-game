"""Post step: glints, contact shadow, framing check, downscale, WebP, manifest and contact sheets.

Runs inside Blender's Python (numpy is bundled; Pillow comes from requirements.txt or --pylibs).
"""
import hashlib
import json
import math
import os
import shutil

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SIZE = 256
SHADOW_COL = (0x26, 0x3a, 0x5c)
SHADOW_OFF = (1, 5)
SHADOW_SIGMA = 3.2
SHADOW_CORE = 0.32
CAPS = {'256': 20 * 1024, '128': 9 * 1024, 'small': 5 * 1024}
TOTAL_CAP = int(2.8 * 1024 * 1024)    # tests/art/itemArt.test.js (2.2 MB until the gear sets' 30 looks)
WEBP = dict(quality=88, alpha_quality=100, method=6)
SMALL_PX = 96


def _star(draw, cx, cy, r, col, k=4, sx=1.0):
    """4-point sparkle with concave sides (supersampled by the caller)."""
    pts = []
    n = 64
    for i in range(n):
        t = 2 * math.pi * i / n
        c, s = math.cos(t), math.sin(t)
        x = math.copysign(abs(c) ** 2.6, c) * r * sx
        y = math.copysign(abs(s) ** 2.6, s) * r
        pts.append((cx + x, cy + y))
    draw.polygon(pts, fill=col)


EDGE_GLINT_RIM = (0xc9, 0xcf, 0xdb)    # the approved sparkle's thin cool-grey rim (needle star tip, gear box lid)


def add_glints(im, glints):
    """glints: [(x_px, y_px, radius_px, (r, g, b)[, rimmed])] in 256 px space. A rimmed glint (a sparkle on a lit
    edge, half over the background) gets the approved thin cool-grey rim so it still reads on a white tile."""
    if not glints:
        return im
    ss = 4
    W = im.width * ss
    layer = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    glow = Image.new('L', (W, W), 0)
    rims = Image.new('L', (W, W), 0)
    d = ImageDraw.Draw(layer)
    g = ImageDraw.Draw(glow)
    m = ImageDraw.Draw(rims)
    for gl_ in glints:
        x, y, r, col = gl_[:4]
        X, Y, R = x * ss, y * ss, r * ss
        g.ellipse((X - R * 0.42, Y - R * 0.42, X + R * 0.42, Y + R * 0.42), fill=150)
        if len(gl_) > 4 and gl_[4]:
            _star(m, X, Y, R, 255, sx=0.82)
    if any(len(gl_) > 4 and gl_[4] for gl_ in glints):
        ring = Image.new('RGBA', (W, W), EDGE_GLINT_RIM + (0,))
        ring.putalpha(rims.filter(ImageFilter.MaxFilter(2 * ss + 1)).point(lambda v: int(v * 0.85)))
        layer = Image.alpha_composite(layer, ring)
        d = ImageDraw.Draw(layer)
    for gl_ in glints:
        x, y, r, col = gl_[:4]
        _star(d, x * ss, y * ss, r * ss, col + (255,), sx=0.82)
    glow = glow.filter(ImageFilter.GaussianBlur(R * 0.18 if glints else 4)).resize(im.size, Image.LANCZOS)
    layer = layer.resize(im.size, Image.LANCZOS)
    gl = Image.new('RGBA', im.size, (255, 255, 255, 0))
    gl.putalpha(glow.point(lambda v: int(v * 0.55)))
    out = Image.alpha_composite(im, gl)
    return Image.alpha_composite(out, layer)


def snap_edge(raw, glints, edge, inset=3.0):
    """Moves the flagged glints onto the silhouette of the raw render: from the glint toward the object's
    centre (or out from it, when the glint already sits inside) to the outer edge, then `inset` px in, so
    the sparkle sits on the lit edge (approved: the needle star's tip, the gear box lid) and never floats."""
    a = np.asarray(Image.open(raw).convert('RGBA').getchannel('A')).astype(np.float32)
    ys, xs = np.nonzero(a >= 200)
    if len(xs) == 0:
        return glints
    cx, cy = float(xs.mean()), float(ys.mean())

    def solid(x, y):
        xi, yi = int(round(x)), int(round(y))
        return 0 <= xi < a.shape[1] and 0 <= yi < a.shape[0] and a[yi, xi] >= 200
    out = []
    for (x, y, r, col), on in zip(glints, edge):
        if on:
            dx, dy = cx - x, cy - y
            d = math.hypot(dx, dy) or 1.0
            dx, dy = dx / d, dy / d
            if solid(x, y):                     # inside: walk out to the edge
                while solid(x - dx, y - dy):
                    x, y = x - dx, y - dy
            else:                               # outside: walk in to the edge
                for _ in range(400):
                    if solid(x, y):
                        break
                    x, y = x + dx * 0.5, y + dy * 0.5
            x, y = x + dx * inset, y + dy * inset
            out.append((x, y, r, col, True))
        else:
            out.append((x, y, r, col))
    return out


def add_shadow(im, strength=1.0):
    """Soft navy contact shadow: the silhouette offset (+1, +5) px, blurred, under the item."""
    a = im.getchannel('A')
    sh = Image.new('L', im.size, 0)
    sh.paste(a, SHADOW_OFF)
    sh = sh.filter(ImageFilter.GaussianBlur(SHADOW_SIGMA))
    sh = sh.point(lambda v: int(min(255, v * SHADOW_CORE * strength)))
    base = Image.new('RGBA', im.size, SHADOW_COL + (0,))
    base.putalpha(sh)
    return Image.alpha_composite(base, im)


def framing(im):
    a = np.asarray(im.getchannel('A'))
    ys, xs = np.nonzero(a >= 200)
    if len(xs) == 0:
        return dict(ok=False, why='empty')
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    w, h = x1 - x0 + 1, y1 - y0 + 1
    cover = float((a >= 200).mean())
    ok = abs(cx - 119) <= 3.5 and abs(cy - 117.5) <= 3.5 and h <= 233 and w <= 236 and max(w, h) >= 200
    return dict(ok=ok, bbox=[x0, y0, x1, y1], center=[round(cx, 1), round(cy, 1)], w=w, h=h, cover=round(cover, 3))


def _down(im, px):
    p = im.convert('RGBa').resize((px, px), Image.LANCZOS)
    return p.convert('RGBA')


def _webp(im, path):
    im.save(path, 'WEBP', **WEBP)
    return os.path.getsize(path)


def finish(raw, glints, key, out_dir, scratch_dir, small_raw=None, small_glints=None):
    """raw: rendered 256 px RGBA PNG path. Writes <key>-256.webp, <key>-128.webp (and -small.webp)
    into out_dir and a PNG copy into scratch_dir. Returns a report dict."""
    im = Image.open(raw).convert('RGBA')
    rep = framing(im)                  # the silhouette with its ink, before glints and shadow
    im = add_glints(im, glints)
    im = add_shadow(im)
    rep['key'] = key
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(scratch_dir, exist_ok=True)
    im.save(os.path.join(scratch_dir, f'{key}.png'))
    rep['bytes256'] = _webp(im, os.path.join(out_dir, f'{key}-256.webp'))
    rep['bytes128'] = _webp(_down(im, 128), os.path.join(out_dir, f'{key}-128.webp'))
    if small_raw:
        sm = Image.open(small_raw).convert('RGBA')
        sm = add_glints(sm, small_glints or [])
        sm = add_shadow(sm, strength=1.2)
        sm.save(os.path.join(scratch_dir, f'{key}-smallcut.png'))
        rep['bytesSmall'] = _webp(_down(sm, SMALL_PX), os.path.join(out_dir, f'{key}-small.webp'))
    over = [k for k, cap in (('bytes256', CAPS['256']), ('bytes128', CAPS['128']), ('bytesSmall', CAPS['small']))
            if rep.get(k, 0) > cap]
    rep['overCap'] = over
    return rep


def ship(key, out_dir, scratch_dir, approved=None, fallback_dirs=()):
    """PLAN C11: ship an approved icon (our art) as is. <key>-256.webp becomes the approved <key>_256.webp byte for
    byte (from `approved` when that folder has it, else the copy already in out_dir or one of fallback_dirs); the
    128 cut is downscaled from it like every other key. Returns a report dict, or None when no source exists."""
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(scratch_dir, exist_ok=True)
    p256 = os.path.join(out_dir, f'{key}-256.webp')
    srcs = [os.path.join(approved, f'{key}_256.webp')] if approved else []
    srcs += [p256] + [os.path.join(d, f'{key}-256.webp') for d in fallback_dirs]
    src = next((p for p in srcs if os.path.exists(p)), None)
    if not src:
        return None
    im = Image.open(src)
    if im.format != 'WEBP' or im.size != (SIZE, SIZE) or 'A' not in im.getbands():
        raise SystemExit('%s: the shipped file must be a %d px RGBA WebP (%s)' % (key, SIZE, src))
    im = im.convert('RGBA')
    if os.path.abspath(src) != os.path.abspath(p256):
        shutil.copyfile(src, p256)
    rep = framing(im)                  # it carries its own glints and contact shadow
    rep.update(key=key, shipped='kept' if os.path.abspath(src) == os.path.abspath(p256) else os.path.abspath(src))
    im.save(os.path.join(scratch_dir, f'{key}.png'))
    rep['bytes256'] = os.path.getsize(p256)
    rep['bytes128'] = _webp(_down(im, 128), os.path.join(out_dir, f'{key}-128.webp'))
    rep['overCap'] = [k for k, cap in (('bytes256', CAPS['256']), ('bytes128', CAPS['128'])) if rep[k] > cap]
    return rep


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------

MANIFEST_HEAD = """// Generated by tools/blender/items/build_items.py. Do not edit by hand.
// Baked 3D-flat item art in public/art/items/: <key>-256.webp and <key>-128.webp for every key
// below, plus <key>-small.webp (96 px, heavier line) for the keys in ITEM_ART_SMALL.
// Keys are item ids, gear_<slot>_<rarity> / gear_<slot>_ur, and recruitPoints. Values are content
// hashes for cache busting (?v=).
"""


def _hash(paths):
    h = hashlib.sha1()
    for p in paths:
        with open(p, 'rb') as f:
            h.update(f.read())
    return h.hexdigest()[:8]


def write_manifest(art_dir, js_path):
    files = sorted(os.listdir(art_dir)) if os.path.isdir(art_dir) else []
    keys = sorted({f[:-len('-256.webp')] for f in files if f.endswith('-256.webp')})
    full, small = {}, {}
    for k in keys:
        p256, p128 = os.path.join(art_dir, f'{k}-256.webp'), os.path.join(art_dir, f'{k}-128.webp')
        if os.path.exists(p128):
            full[k] = _hash([p256, p128])
        ps = os.path.join(art_dir, f'{k}-small.webp')
        if os.path.exists(ps):
            small[k] = _hash([ps])

    def obj(d):
        return '{\n' + ''.join(f"  {k}: '{v}',\n" for k, v in d.items()) + '}'
    js = MANIFEST_HEAD + f'export const ITEM_ART = Object.freeze({obj(full)});\n\n' + \
        f'export const ITEM_ART_SMALL = Object.freeze({obj(small)});\n'
    with open(js_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    total = sum(os.path.getsize(os.path.join(art_dir, f)) for f in files if f.endswith('.webp'))
    return dict(keys=len(full), small=len(small), totalBytes=total)


# ---------------------------------------------------------------------------
# Sheets (scratch only, never in the repo)
# ---------------------------------------------------------------------------

# The approved item tile (#108, item-method-compare): a landscape plate (1.09:1) slanted -8 deg, rounded
# corners, a 1 px tier border and a white inner rim, the tier tint fading to white by about 80 %, our sheen
# (faint sakura petals and one diagonal white band), a soft tile shadow, the art (not slanted) centred at
# 47 % / 46 % filling about 82 % of the height, and the count (heavy italic navy with a white outline,
# 13 px on the 62 px phone tile, shortened like x450K) overlapping the lower right. The game draws it in CSS.
TILE_ASPECT = 1.09
TILE_SKEW = 8.0
TILE_ART_H = 0.82            # object height / tile height
TILE_ART_C = (0.47, 0.46)    # object centre in the tile box
COUNT_PX = 13.0 / 62.0       # count font size / tile width
COUNT_COL = (0x2b, 0x44, 0x67)
TILE_TOP = dict(common=(0xd6, 0xe0, 0xe8), rare=(0xb2, 0xcd, 0xf8), superRare=(0xda, 0xc2, 0xfd),
                mythic=(0xec, 0x9f, 0xb8), legendary=(0xfd, 0xda, 0x99), ur=(0xe3, 0xcc, 0xff))
TILE_MID = dict(common=(0xee, 0xf3, 0xf8), rare=(0xe3, 0xf1, 0xff), superRare=(0xf3, 0xe9, 0xff),
                mythic=(0xff, 0xe8, 0xee), legendary=(0xff, 0xf2, 0xd6), ur=(0xff, 0xf4, 0xfb))
TILE_BORDER = dict(common=(0xb9, 0xc6, 0xd3), rare=(0x8f, 0xc1, 0xf3), superRare=(0xc6, 0xa6, 0xf2),
                   mythic=(0xf3, 0xa5, 0xb9), legendary=(0xef, 0xc3, 0x6a), ur=(0xe7, 0xb9, 0xf0))
RAINBOW = [(0xff, 0xc4, 0xe6), (0xff, 0xe7, 0xa8), (0xc4, 0xf5, 0xdf), (0xbf, 0xe3, 0xff), (0xe3, 0xcc, 0xff)]


def _font(px, italic_black=False):
    names = ('seguibli.ttf', 'ariblk.ttf', 'arialbi.ttf', 'arialbd.ttf') if italic_black else \
        ('arialbd.ttf', 'arial.ttf', 'DejaVuSans-Bold.ttf')
    for f in names:
        try:
            return ImageFont.truetype(f, px)
        except OSError:
            continue
    return ImageFont.load_default()


def tile_size(w):
    return w, int(round(w / TILE_ASPECT))


def _petal(cx, cy, L, ang):
    """A sakura petal outline (rounded, a notch at the tip), base at (cx, cy), pointing at `ang` degrees."""
    W = L * 0.66
    side = []
    for i in range(13):
        u = i / 12
        side.append((W / 2 * math.sin(math.pi * (0.06 + 0.8 * u)) ** 0.6, L * u))
    pts = side + [(0.0, L * 0.84)] + [(-x, y) for x, y in reversed(side)]
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    return [(cx + x * ca - y * sa, cy - (x * sa + y * ca)) for x, y in pts]


def _shear(im, s, h):
    """Slants an image so its top moves right by s px (CSS skewX(-deg) on a box of height h)."""
    return im.transform(im.size, Image.AFFINE, (1, s / h, -s, 0, 1, 0), resample=Image.BICUBIC)


def plate(w, tier, scale=4):
    """The approved plate at tile width w (DPR 1 px): returns an RGBA image (w, h + 3); the plate box is
    (0, 0)-(w, h), the rest is its soft shadow."""
    _, h = tile_size(w)
    return _plate_hi(w, tier, scale).resize((w, h + 3), Image.LANCZOS)


def _plate_hi(w, tier, scale):
    w, h = tile_size(w)
    W, H = w * scale, h * scale
    pad = 3 * scale
    s = H * math.tan(math.radians(TILE_SKEW))
    rw = W - s                                     # width of the box before the slant
    r = H * 0.1
    mask = Image.new('L', (W, H + pad), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, rw - 1, H - 1), radius=r, fill=255)
    mask = _shear(mask, s, H)
    # tier tint at the top, a pale mid tint at about 40 %, white by about 80 %
    grad = Image.new('RGBA', (W, H + pad))
    gd = ImageDraw.Draw(grad)
    mid = TILE_MID.get(tier, TILE_MID['common'])
    for y in range(H + pad):
        t = y / H
        if tier == 'ur':
            k = min(len(RAINBOW) - 1.001, (y / H) * 2.2 * (len(RAINBOW) - 1))
            i = int(k)
            a_, b_ = RAINBOW[i], RAINBOW[min(i + 1, len(RAINBOW) - 1)]
            top = tuple(int(a_[j] + (b_[j] - a_[j]) * (k - i)) for j in range(3))
        else:
            top = TILE_TOP.get(tier, TILE_TOP['common'])
        if t < 0.4:
            c = tuple(int(top[j] + (mid[j] - top[j]) * (t / 0.4)) for j in range(3))
        else:
            f = min(1.0, (t - 0.4) / 0.4)
            c = tuple(int(mid[j] + (255 - mid[j]) * f) for j in range(3))
        gd.line([(0, y), (W, y)], fill=c + (255,))
    # sheen: three faint petals in the top 60 % and one diagonal white band
    sheen = Image.new('L', (W, H + pad), 0)
    sd = ImageDraw.Draw(sheen)
    for cx, cy, L, ang, al in ((0.24, 0.62, 0.52, 18, 92), (0.6, 0.5, 0.62, -12, 80), (0.86, 0.36, 0.42, -38, 70)):
        sd.polygon(_petal(cx * W, cy * H, L * H, ang), fill=al)
    sd.polygon([(W * 0.30, H), (W * 0.42, H), (W * 0.92, 0), (W * 0.80, 0)], fill=58)
    sheen = Image.composite(sheen, Image.new('L', sheen.size, 0), mask)
    shadow = Image.new('L', (W, H + pad), 0)
    shadow.paste(mask.crop((0, 0, W, H + pad - int(1.5 * scale))), (0, int(1.5 * scale)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(1.25 * scale)).point(lambda v: int(v * 0.28))
    im = Image.new('RGBA', (W, H + pad), (36, 56, 90, 0))
    im.putalpha(shadow)
    body = Image.new('RGBA', (W, H + pad), (0, 0, 0, 0))
    body.paste(grad, (0, 0), mask)
    im = Image.alpha_composite(im, body)
    white = Image.new('RGBA', (W, H + pad), (255, 255, 255, 0))
    white.putalpha(sheen)
    im = Image.alpha_composite(im, white)
    # rims: a white inner rim at 85 % and the 1 px tier border outside it
    rim = Image.new('RGBA', (W, H + pad), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rim)
    bw = max(1, scale)
    rd.rounded_rectangle((bw, bw, rw - 1 - bw, H - 1 - bw), radius=r - bw, outline=(255, 255, 255, 217), width=int(1.5 * scale))
    rd.rounded_rectangle((0, 0, rw - 1, H - 1), radius=r, outline=TILE_BORDER.get(tier, TILE_BORDER['common']) + (255,), width=bw)
    return Image.alpha_composite(im, _shear(rim, s, H))


def _tier_of(row):
    if row.get('rainbow') or row.get('display') == 'ur' or row.get('tier') == 'zenith':
        return 'ur'
    return row.get('rarity', 'common')


def _count(im, w, h, text, scale):
    """The count badge: heavy italic navy, a crisp white outline, x at 0.82 em, bottom right (may overlap)."""
    fpx = COUNT_PX * w * scale
    big, small = _font(int(round(fpx)), True), _font(int(round(fpx * 0.82)), True)
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    stroke = max(1, int(round(0.11 * fpx)))
    digits = text[1:]
    wx = d.textlength('x', font=small)
    wd = d.textlength(digits, font=big)
    right = w * scale * 0.94
    base = h * scale * 0.965
    x0 = right - wd - wx
    asc = big.getmetrics()[0]
    asc_s = small.getmetrics()[0]
    d.text((x0, base - asc_s), 'x', font=small, fill=COUNT_COL + (255,), stroke_width=stroke, stroke_fill=(255, 255, 255, 255))
    d.text((x0 + wx, base - asc), digits, font=big, fill=COUNT_COL + (255,), stroke_width=stroke,
           stroke_fill=(255, 255, 255, 255))
    return Image.alpha_composite(im, layer)


def tile(art, w, tier, count='x450K', scale=4):
    """The approved tile at width w (DPR 1 px) with the art and, when given, the count."""
    _, h = tile_size(w)
    big = _plate_hi(w, tier, scale)
    S = int(round(SIZE * TILE_ART_H * h / 226.0 * scale))          # the 256 render's silhouette is 226 px tall
    a = art.convert('RGBa').resize((S, S), Image.LANCZOS).convert('RGBA')
    ox = int(round(TILE_ART_C[0] * w * scale - S * 119.0 / SIZE))
    oy = int(round(TILE_ART_C[1] * h * scale - S * 117.5 / SIZE))
    layer = Image.new('RGBA', big.size, (0, 0, 0, 0))
    layer.paste(a, (ox, oy), a)
    big = Image.alpha_composite(big, layer)
    if count:
        big = _count(big, w, h, count, scale)
    return big.resize((w, h + 3), Image.LANCZOS)


SHEET_TILES = ((80, True), (62, True), (48, True), (32, False), (22, False))


def contact_sheet(rows, png_dir, out_path, title='', compare=None):
    """One row per key: 256 view; the approved tile at 80 / 62 / 48 px with the x450K count and at 32 / 22 px
    without (chip sizes), all at DPR 1; then 62 px at DPR 2 (drawn at 124 px).
    compare: {key: approved RGBA PNG path} adds the approved icon next to ours."""
    cell_h = 268
    cols_w = [262, 262] if compare else [262]
    cols_w += [w + 12 for w, _ in SHEET_TILES] + [140]
    W = sum(cols_w) + 220
    H = 52 + cell_h * len(rows)
    sheet = Image.new('RGBA', (W, H), (240, 243, 248, 255))
    d = ImageDraw.Draw(sheet)
    f = _font(15)
    fs = _font(12)
    d.text((10, 10), title, fill=(30, 44, 70), font=f)
    hx = 220 + (cols_w[0] if compare else 0) + 262
    for w, _ in SHEET_TILES:
        d.text((hx, 30), f'{w} px', fill=(80, 96, 120), font=fs)
        hx += w + 12
    d.text((hx, 30), '62 px @2x', fill=(80, 96, 120), font=fs)
    for i, row in enumerate(rows):
        key = row['key']
        y = 52 + i * cell_h
        x = 10
        d.text((x, y + 4), key, fill=(30, 44, 70), font=f)
        d.text((x, y + 24), row.get('name', ''), fill=(80, 96, 120), font=fs)
        d.text((x, y + 40), _tier_of(row), fill=(80, 96, 120), font=fs)
        x = 220
        p = os.path.join(png_dir, f'{key}.png')
        art = Image.open(p).convert('RGBA') if os.path.exists(p) else Image.new('RGBA', (256, 256), (0, 0, 0, 0))
        if compare:
            ref = compare.get(key)
            bg = Image.new('RGBA', (256, 256), (255, 255, 255, 255))
            if ref and os.path.exists(ref):
                bg.alpha_composite(Image.open(ref).convert('RGBA').resize((256, 256), Image.LANCZOS))
                d.text((x + 4, y + 2), 'approved', fill=(120, 60, 90), font=fs)
            sheet.alpha_composite(bg, (x, y + 4))
            x += cols_w[0]
        bg = Image.new('RGBA', (256, 256), (255, 255, 255, 255))
        bg.alpha_composite(art)
        sheet.alpha_composite(bg, (x, y + 4))
        if compare:
            d.text((x + 4, y + 2), 'new', fill=(60, 90, 120), font=fs)
        x += 262
        tier = _tier_of(row)
        for w, with_count in SHEET_TILES:
            sheet.alpha_composite(tile(art, w, tier, 'x450K' if with_count else None), (x, y + 60))
            x += w + 12
        sheet.alpha_composite(tile(art, 124, tier), (x, y + 60))
    sheet.convert('RGB').save(out_path)
    return out_path


def grid_sheet(rows, png_dir, out_path, cols=6, title=''):
    """Compact overview: every key at 128 on white and on the approved tile at 62 px (with the count)."""
    cw, ch = 210, 170
    rws = (len(rows) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cw + 20, rws * ch + 40), (240, 243, 248, 255))
    d = ImageDraw.Draw(sheet)
    f = _font(12)
    d.text((10, 10), title, fill=(30, 44, 70), font=_font(15))
    for i, row in enumerate(rows):
        x = 10 + (i % cols) * cw
        y = 36 + (i // cols) * ch
        p = os.path.join(png_dir, f"{row['key']}.png")
        if not os.path.exists(p):
            continue
        art = Image.open(p).convert('RGBA')
        bg = Image.new('RGBA', (128, 128), (255, 255, 255, 255))
        bg.alpha_composite(_down(art, 128))
        sheet.alpha_composite(bg, (x, y))
        sheet.alpha_composite(tile(art, 62, _tier_of(row)), (x + 136, y + 30))
        d.text((x, y + 132), row['key'], fill=(30, 44, 70), font=f)
    sheet.convert('RGB').save(out_path)
    return out_path


def compare_grid(rows, png_dir, compare, out_path, cols=3, px=230, title='approved (left) vs new (right)'):
    """Approved vs new pairs on white at `px`, plus both at 62 px on the plate under each pair."""
    rows = [r for r in rows if r['key'] in compare]
    pw = px * 2 + 16
    ch = px + 110
    rws = max(1, (len(rows) + cols - 1) // cols)
    sheet = Image.new('RGBA', (cols * (pw + 24) + 16, rws * ch + 44), (236, 240, 246, 255))
    d = ImageDraw.Draw(sheet)
    d.text((14, 12), title, fill=(30, 44, 70), font=_font(16))
    f = _font(13)
    for i, row in enumerate(rows):
        key = row['key']
        x = 16 + (i % cols) * (pw + 24)
        y = 44 + (i // cols) * ch
        ref = Image.open(compare[key]).convert('RGBA').resize((256, 256), Image.LANCZOS)
        p = os.path.join(png_dir, f'{key}.png')
        new = Image.open(p).convert('RGBA') if os.path.exists(p) else Image.new('RGBA', (256, 256))
        for j, im in enumerate((ref, new)):
            bg = Image.new('RGBA', (px, px), (255, 255, 255, 255))
            bg.alpha_composite(_down(im, px))
            sheet.alpha_composite(bg, (x + j * (px + 16), y))
            sheet.alpha_composite(tile(im, 62, _tier_of(row)), (x + j * (px + 16) + px // 2 - 31, y + px + 6))
        d.text((x, y + px + 74), key, fill=(30, 44, 70), font=f)
    sheet.convert('RGB').save(out_path)
    return out_path


def write_report(reports, path):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(reports, f, indent=1)
