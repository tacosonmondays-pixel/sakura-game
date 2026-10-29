#!/usr/bin/env python3
"""Measuring aid: writes <image>.grid.jpg, the image with a labelled 64 px grid (and 32 px ticks), so a point
can be read off in master pixels. usage: python3 -I grid.py <image.png> [--zoom X0 Y0 X1 Y1]
--zoom also writes <image>.zoom.jpg: that box enlarged 2x with a 16 px grid labelled in master pixels."""
import sys
from PIL import Image, ImageDraw


def grid(im, step, off=(0, 0), scale=1.0):
    im = im.convert("RGB")
    d = ImageDraw.Draw(im)
    W, H = im.size
    for x in range(0, W, step):
        d.line([(x, 0), (x, H)], fill=(255, 0, 80) if (x // step) % 2 == 0 else (0, 160, 255), width=1)
        d.text((x + 2, 2), str(int(off[0] + x / scale)), fill=(255, 255, 0))
    for y in range(0, H, step):
        d.line([(0, y), (W, y)], fill=(255, 0, 80) if (y // step) % 2 == 0 else (0, 160, 255), width=1)
        d.text((2, y + 2), str(int(off[1] + y / scale)), fill=(255, 255, 0))
    return im


if __name__ == "__main__":
    p = sys.argv[1]
    im = Image.open(p)
    grid(im, 64).save(p.rsplit(".", 1)[0] + ".grid.jpg", quality=85)
    if "--zoom" in sys.argv:
        i = sys.argv.index("--zoom")
        x0, y0, x1, y1 = map(int, sys.argv[i + 1:i + 5])
        z = im.crop((x0, y0, x1, y1)).resize(((x1 - x0) * 2, (y1 - y0) * 2), Image.LANCZOS)
        grid(z, 32, (x0, y0), 2.0).save(p.rsplit(".", 1)[0] + ".zoom.jpg", quality=88)
