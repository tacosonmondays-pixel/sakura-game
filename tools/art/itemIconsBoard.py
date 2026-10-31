#!/usr/bin/env python3
"""The item-icons-3d owner board (docs/review/item-icons-3d/board.jpg): every icon baked on feature/item-icons-3d beside
its nearest live neighbour, at 128 and 64 px, from the committed WebPs. python3 tools/art/itemIconsBoard.py [keys.txt]"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART = os.path.join(ROOT, 'public', 'art', 'items')
OUT = os.path.join(ROOT, 'docs', 'review', 'item-icons-3d', 'board.jpg')
SETS = ('spirit', 'freezetag', 'geometry', 'popper', 'treasurer', 'powerbank')


def neighbour(k):
    if k.startswith('setbox_'):
        return 'gearbox_' + k.split('_')[2]
    if k in ('tie_pin', 'collar_pin'):
        return 'lock_pin'
    if k == 'lens_nightglass':
        return 'dice_prism'
    p = k.split('_')
    if p[1] in ('hair', 'necklace'):
        return 'gear_charm_' + p[2]
    if p[1] in SETS:
        return 'gear_%s_superRare' % ('ribbon' if p[2] == 'hair' else 'charm')
    return None


def font(px):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, px)
    return ImageFont.load_default()


def main():
    keys = open(sys.argv[1]).read().split() if len(sys.argv) > 1 else sorted(
        f[:-9] for f in os.listdir(ART) if f.endswith('-128.webp') and (f.startswith(('setbox_', 'tie_pin', 'collar_pin', 'lens_'))
                                                                    or any(f.startswith('gear_%s' % s) for s in ('hair', 'necklace') + SETS)))
    cols, cw, ch = 4, 428, 166
    rows = (len(keys) + cols - 1) // cols
    im = Image.new('RGB', (cols * cw + 20, rows * ch + 70), (243, 245, 251))
    d = ImageDraw.Draw(im)
    d.text((14, 12), 'Item icons 3D: each new icon (bold label) beside its nearest live neighbour, at 128 and 64 px', fill=(30, 34, 70), font=font(20))
    d.text((14, 40), 'order per cell: neighbour 128 | NEW 128 | NEW 64 | neighbour 64', fill=(90, 96, 130), font=font(14))
    f1, f2 = font(13), font(11)
    for i, k in enumerate(keys):
        x, y = 10 + (i % cols) * cw, 66 + (i // cols) * ch
        d.rounded_rectangle((x, y, x + cw - 10, y + ch - 8), 12, fill=(255, 255, 255), outline=(220, 226, 238))
        n = neighbour(k)
        cells = [(n, 128), (k, 128), (k, 64), (n, 64)]
        cx = x + 8
        for key, px in cells:
            p = os.path.join(ART, '%s-128.webp' % key) if key else None
            if p and os.path.exists(p):
                a = Image.open(p).convert('RGBA')
                if px != 128:
                    a = a.resize((px, px), Image.LANCZOS)
                im.paste(a, (cx, y + 8 + (128 - px)), a)
            cx += px + 10
        d.text((x + 10, y + ch - 30), k, fill=(30, 34, 70), font=f1)
        d.text((x + 10 + d.textlength(k, font=f1) + 10, y + ch - 28), 'vs ' + (n or '-'), fill=(120, 126, 160), font=f2)
    q = 82
    while True:
        im.save(OUT, 'JPEG', quality=q, optimize=True, progressive=True)
        if os.path.getsize(OUT) <= 300 * 1024 or q <= 42:
            break
        q -= 4
    print('[board] %s (%d icons, %.0f KB, q%d)' % (OUT, len(keys), os.path.getsize(OUT) / 1024, q))


if __name__ == '__main__':
    main()
