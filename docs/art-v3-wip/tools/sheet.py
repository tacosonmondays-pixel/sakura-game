#!/usr/bin/env python3
"""contact sheet: current portrait | candidates. usage: sheet.py <id> <out.jpg> <cand.webp/png>..."""
import sys, os
from PIL import Image, ImageDraw
gid, out, cands = sys.argv[1], sys.argv[2], sys.argv[3:]
ref = os.environ.get("SHEET_REF") or f"/home/user/sakura-game/public/art/portraits/{gid}-full.webp"
tiles = []
if os.path.exists(ref):
    tiles.append(("CURRENT (v2)", Image.open(ref).convert("RGB")))
for c in cands:
    tiles.append((os.path.basename(c).rsplit(".", 1)[0], Image.open(c).convert("RGB")))
W, H = 384, 512
sheet = Image.new("RGB", (len(tiles) * (W + 8) + 8, H + 36), (24, 26, 34))
d = ImageDraw.Draw(sheet)
for i, (lab, im) in enumerate(tiles):
    sheet.paste(im.resize((W, H), Image.LANCZOS), (8 + i * (W + 8), 28))
    d.text((12 + i * (W + 8), 8), f"{gid} {lab}", fill=(240, 240, 120))
sheet.save(out, quality=88)
