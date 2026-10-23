"""Item palettes: the tone rule (ITEM_STYLE 2.4), the tier trim ladder and shared material recipes.

A *paint* is a dict of toon inputs for rig.style(): base / light / shadow / ink (sRGB hex) plus
effect amounts. `paint(base)` derives the missing tones with `tone()`; any key can be overridden.
Values marked (appr.) were measured on the approved icons (PLAN 2-3).
"""
import colorsys

from lib.colors import srgb, hexs


def _hls(hx):
    r, g, b = srgb(hx)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return h * 360.0, l, s


def _hex(h, l, s):
    r, g, b = colorsys.hls_to_rgb((h % 360.0) / 360.0, max(0.0, min(1.0, l)), max(0.0, min(1.0, s)))
    return hexs((r, g, b))


def _toward(h, target, deg):
    """Moves hue h by up to `deg` degrees toward `target`, the short way round."""
    d = (target - h + 540.0) % 360.0 - 180.0
    step = max(-deg, min(deg, d))
    return h + step


def tone(base, light_dl=0.12, shadow_dl=0.15, ink_l=0.25):
    """Light: +L, hue toward yellow. Shadow: -L, +sat, hue toward magenta the short way
    (gold to orange, blue to indigo, pink to rose). Ink: L about 25% in the shadow hue, never black."""
    h, l, s = _hls(base)
    grey = s < 0.08
    hl = h if grey else _toward(h, 60.0, 6.0)
    light = _hex(hl, min(0.97, l + light_dl), min(1.0, s * 1.02))
    hs = h if grey else _toward(h, 300.0, 9.0)
    shadow = _hex(hs, max(0.05, l - shadow_dl), min(1.0, s + 0.05))
    hi = h if grey else _toward(h, 300.0, 12.0)
    ink = _hex(hi, ink_l, max(0.35 if grey else 0.55, min(1.0, s * 1.1)))
    return dict(base=base, light=light, shadow=shadow, ink=ink)


def paint(base, light=None, shadow=None, ink=None, deep=None, **fx):
    t = tone(base)
    p = dict(base=base, light=light or t['light'], shadow=shadow or t['shadow'], ink=ink or t['ink'])
    if deep:
        p['deep'] = deep
    p.update(fx)
    return p


def over(p, **kw):
    """Copy of a paint with some keys replaced."""
    q = dict(p)
    q.update(kw)
    return q


# ---------------------------------------------------------------------------
# Shared materials
# ---------------------------------------------------------------------------

# Metals: four hard stops (glint / light, base, dark band, ink) and a crisp specular.
GOLD = dict(base='#f7b633', light='#fcdb78', shadow='#d88919', ink='#7d4705', spec=1.0, rim=0.7, spec_at=0.985)   # (appr., coins)
GOLD_TRIM = dict(base='#f8c040', light='#fde08a', shadow='#d98f1c', ink='#7d4705', spec=0.8, rim=0.6, spec_at=0.985)
SILVER = dict(base='#c9d5e6', light='#f2f6fb', shadow='#8495b3', ink='#33435c', spec=1.0, rim=0.6, spec_at=0.985)
ROSE_GOLD = dict(base='#d38574', light='#f0b4a2', shadow='#b0645a', ink='#6a2a2a', spec=0.9, rim=0.6, spec_at=0.985)   # (appr., box straps)
STEEL = dict(base='#aebbd0', light='#dfe7f3', shadow='#7889a6', ink='#394a66', spec=1.0, rim=0.6, spec_at=0.98)   # (appr. ink, needle)
BRASS = dict(base='#e3b77a', light='#f6d9a6', shadow='#b98648', ink='#5a3a14', spec=0.7, rim=0.5, spec_at=0.985)
IRI = dict(base='#f1e2ff', light='#ffffff', shadow='#b9a3e8', ink='#2c1854', iri=1.0, spec=0.7, rim=0.6, spec_at=0.985)   # (appr. ink, crown)
PEARL = dict(base='#f7f3ff', light='#ffffff', shadow='#c9bde8', ink='#4c3d8f', spec=0.8, rim=0.6, spec_at=0.985, iri=0.25)

PAPER = dict(base='#fbf1dc', light='#fffaf0', shadow='#e8d5b0', ink='#6b4a2a', rim=0.0, drift=0.05)
CREAM = dict(base='#fef6cb', light='#fffbe8', shadow='#f1d98a', ink='#7d4705', rim=0.3)    # embossed motifs on gold
WHITE_LABEL = dict(base='#f6f9fe', light='#ffffff', shadow='#d3dcef', ink='#0d336f', rim=0.0)
PAGES = dict(base='#f3e2bd', light='#fdf4dc', shadow='#d2b27c', ink='#6f4717', rim=0.0, stripe=(0.45, 34.0, 0.22),
             steps=(-0.75, 0.97, 0.05))     # page edges stay cream on the shadow sides; the lines carry them
SNOW = dict(base='#eef4fb', light='#ffffff', shadow='#bfcde3', ink='#1b4574', rim=0.3)
PINK_GEM = dict(base='#fbc7db', light='#fef4f9', shadow='#fb89b7', ink='#781948', deep='#ef6fa3', spec=0.6, spec_at=0.99)   # (appr., gems)

def anchored(p, shadow='#a183e4', deep='#8262d4', anchor=0.8, ink=None, **kw):
    """UR / zenith parts: keep the pastel iridescence but anchor it with one saturated lilac shadow plane
    (about a third of the object) so the premium tier holds the same value range as the others."""
    q = dict(p)
    q.update(shadow=shadow, deep=deep, anchor=anchor)
    if ink:
        q['ink'] = ink
    q.update(kw)
    return q


IRI_DEEP = anchored(IRI, shadow='#9f80e2', deep='#7e5ed0', ink='#3a1f66')                 # trims, straps, frames
PEARL_DEEP = anchored(PEARL, shadow='#ad92e8', deep='#8a6ada', ink='#3f2a78', iri=0.35)    # bodies

# ---------------------------------------------------------------------------
# Tier ladder (one material step per tier, PLAN 3.1)
# ---------------------------------------------------------------------------

RARITIES = ('common', 'rare', 'superRare', 'mythic', 'legendary')

TRIM = dict(common=None, rare=SILVER, superRare=SILVER, mythic=ROSE_GOLD, legendary=GOLD_TRIM)

TIER_GEM = dict(
    common=None,
    rare=paint('#9fd0ff', light='#e4f3ff', shadow='#5f9ae8', ink='#1d3a6b', spec=0.8, spec_at=0.99),
    superRare=paint('#c9b6ff', light='#efe8ff', shadow='#9b6bff', ink='#34206e', deep='#6a45d8', spec=0.8, spec_at=0.99),
    mythic=paint('#ff9fc0', light='#ffe1ec', shadow='#e0567a', ink='#6e1a3c', deep='#c63c66', glow=0.55, spec=0.8, spec_at=0.99),
    legendary=paint('#c4e8fc', light='#f4fcff', shadow='#88c4f0', ink='#1b4574', deep='#5f9fe0', glow=0.25, spec=0.8, spec_at=0.99),
)

# Body tints for gear pieces and generic tier bodies (ITEM_STYLE 3)
TIER_BODY = dict(common='#8e9cb0', rare='#4b8fea', superRare='#9b6bff', mythic='#ff5a7a', legendary='#ffb627', ur='#c78cff')

# Tile tops (for the contact-sheet plates; the game tile lives in CSS)
TILE_TOP = dict(common='#D6E0E8', rare='#B2CDF8', superRare='#DAC2FD', mythic='#EC9FB8', legendary='#FDDA99', ur='#e3ccff')
