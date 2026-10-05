"""Colour helpers (hex sRGB <-> linear)."""


def srgb(hexstr):
    h = hexstr.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def to_srgb(c):
    c = max(0.0, min(1.0, c))
    return c * 12.92 if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def linear(color):
    """'#rrggbb' or (r,g,b) in sRGB floats -> linear floats."""
    if isinstance(color, str):
        color = srgb(color)
    return tuple(to_linear(c) for c in color[:3])


def hexs(rgb):
    return '#%02x%02x%02x' % tuple(int(round(max(0, min(1, c)) * 255)) for c in rgb[:3])


def mix(a, b, t):
    """Mixes two hex colours in sRGB space, returns hex."""
    ca, cb = srgb(a), srgb(b)
    return hexs(tuple(ca[i] * (1 - t) + cb[i] * t for i in range(3)))


def darken(a, t):
    return mix(a, '#000000', t)


def lighten(a, t):
    return mix(a, '#ffffff', t)


def saturate(a, t):
    """Pushes a colour away from its grey (t > 0 = more saturated)."""
    c = srgb(a)
    g = sum(c) / 3
    return hexs(tuple(g + (ci - g) * (1 + t) for ci in c))
