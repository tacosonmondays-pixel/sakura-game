#!/usr/bin/env python3
"""The item-icons-3d owner board (docs/review/item-icons-3d/board.jpg, JPEG <= 300 KB), from the committed WebPs:
the 30 gear set looks (6 sets x 5 slots), the 14 Set Boxes, the 3 tools, the Hair Clip and Necklace rarity ladders,
and the Set Box modal before / after at 390x844 (e2e/set-box.mjs screenshots).

    node e2e/set-box.mjs --viewport 390x844 --before   # on the old modal (git stash the UI first)
    node e2e/set-box.mjs --viewport 390x844
    python3 tools/art/itemIconsBoard.py [--shots e2e/out/set-box]
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART = os.path.join(ROOT, 'public', 'art', 'items')
OUT = os.path.join(ROOT, 'docs', 'review', 'item-icons-3d', 'board.jpg')
SETS = [('spirit', 'Spirit Squad'), ('freezetag', 'Freeze Tag'), ('geometry', 'Geometry Set'), ('popper', 'Party Popper'),
        ('treasurer', 'Treasurer'), ('powerbank', 'Power Bank')]
SLOTS = [('charm', 'Charm'), ('ribbon', 'Ribbon'), ('shoes', 'Shoes'), ('hair', 'Hair Clip'), ('necklace', 'Necklace')]
TIERS = ['common', 'rare', 'superRare', 'mythic', 'legendary', 'ur']
BG, INK, SOFT = (243, 245, 251), (30, 34, 70), (100, 106, 140)


def font(px):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, px)
    return ImageFont.load_default()


def icon(key, px):
    p = os.path.join(ART, '%s-128.webp' % key)
    a = Image.open(p).convert('RGBA')
    return a if px == 128 else a.resize((px, px), Image.LANCZOS)


def main():
    shots = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else os.path.join(ROOT, 'e2e', 'out', 'set-box')
    W = 1500
    S = 112                                  # icon cell
    im = Image.new('RGB', (W, 2100), BG)
    d = ImageDraw.Draw(im)
    f1, f2, f3 = font(24), font(15), font(12)
    y = 14
    d.text((16, y), 'Item icons 3D: gear set looks, Set Boxes, tools, Hair Clip and Necklace ladders, the Set Box modal', fill=INK, font=f1)
    y += 40

    # 1. the 30 set looks
    d.text((16, y), '1. Gear set looks: one motif per set across its five pieces (6 sets x 5 slots, 112 px)', fill=INK, font=f2)
    y += 26
    x0 = 150
    for j, (_, lab) in enumerate(SLOTS):
        d.text((x0 + j * (S + 8) + 24, y), lab, fill=SOFT, font=f3)
    y += 18
    for sid, lab in SETS:
        d.text((16, y + S // 2 - 8), lab, fill=INK, font=f2)
        for j, (slot, _) in enumerate(SLOTS):
            a = icon('gear_%s_%s' % (sid, slot), S)
            im.paste(a, (x0 + j * (S + 8), y), a)
        y += S + 4
    grid_bottom = y

    # 5 (right column). the modal before / after at 390x844, scaled
    mx = x0 + 5 * (S + 8) + 40
    my = 80
    d.text((mx, my - 26), '5. Set Box modal at 390x844 (Freeze Tag, Legendary): before | after', fill=INK, font=f2)
    sc = 0.86
    for k, name in enumerate(('before', 'after')):
        p = os.path.join(shots, '%s-freezetag-390x844.png' % name)
        if os.path.exists(p):
            a = Image.open(p).convert('RGB')
            a = a.resize((int(a.width * sc), int(a.height * sc)), Image.LANCZOS)
            im.paste(a, (mx + k * (a.width + 18), my))
            d.text((mx + k * (a.width + 18), my + a.height + 4), name.upper(), fill=SOFT, font=f2)
    y = max(grid_bottom, my + int(844 * sc) + 30) + 10

    # 2. the 14 boxes
    d.text((16, y), '2. Set Boxes: each set\'s box with its crest on the lid and front (top: Mythic, bottom: Legendary; first: pick box)', fill=INK, font=f2)
    y += 24
    for r, rar in enumerate(('mythic', 'legendary')):
        for k, (sid, _) in enumerate([('pick', 'Pick')] + SETS):
            a = icon('setbox_%s_%s' % (sid, rar), S)
            im.paste(a, (16 + k * (S + 14), y), a)
        y += S + 4
    for k, (sid, lab) in enumerate([('pick', 'Pick a set')] + SETS):
        d.text((16 + k * (S + 14) + 4, y), lab, fill=SOFT, font=f3)
    y += 24

    # 3. tools + 4. ladders
    d.text((16, y), '3. Tools: Tie Pin, Collar Pin, Nightglass Lens', fill=INK, font=f2)
    d.text((16 + 3 * (S + 14) + 30, y), '4. Hair Clip and Necklace: common, rare, super rare, mythic, legendary, UR', fill=INK, font=f2)
    y += 24
    for k, key in enumerate(('tie_pin', 'collar_pin', 'lens_nightglass')):
        a = icon(key, S)
        im.paste(a, (16 + k * (S + 14), y + S // 2), a)
    lx = 16 + 3 * (S + 14) + 30
    for r, slot in enumerate(('hair', 'necklace')):
        for k, t in enumerate(TIERS):
            a = icon('gear_%s_%s' % (slot, t), S)
            im.paste(a, (lx + k * (S + 8), y + r * (S + 4)), a)
    y += 2 * (S + 4) + 14
    im = im.crop((0, 0, W, y))
    q = 86
    while True:
        im.save(OUT, 'JPEG', quality=q, optimize=True, progressive=True)
        if os.path.getsize(OUT) <= 300 * 1024 or q <= 40:
            break
        q -= 4
    print('[board] %s (%dx%d, %.0f KB, q%d)' % (OUT, im.width, im.height, os.path.getsize(OUT) / 1024, q))


if __name__ == '__main__':
    main()
