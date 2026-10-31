#!/usr/bin/env python3
"""Owner board: before (main's full portrait) | after (art v3 full) for every girl in the picks file.
usage: board.py <picks.json> <before_dir> <after_dir> <out.jpg>"""
import json, sys
from PIL import Image, ImageDraw
picks, bdir, adir, out = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3], sys.argv[4]
W, H, PER = 240, 320, 4
cell_w, cell_h = 2 * W + 24, H + 34
rows = (len(picks) + PER - 1) // PER
s = Image.new("RGB", (PER * cell_w + 16, rows * cell_h + 60), (22, 24, 32))
d = ImageDraw.Draw(s)
d.text((16, 16), "Art v3 (Look B): before | after  -  stands (-cut) unchanged; Kogane and Norika had no drawn portrait before", fill=(235, 235, 245))
for i, (gid, cand, total, *_r) in enumerate(picks):
    x, y = 16 + (i % PER) * cell_w, 50 + (i // PER) * cell_h
    for j, p in enumerate([f"{bdir}/{gid}-full.webp", f"{adir}/{gid}-full.webp"]):
        s.paste(Image.open(p).convert("RGB").resize((W, H), Image.LANCZOS), (x + j * (W + 4), y + 22))
    d.text((x, y + 4), f"{gid}  (pick {cand}, score {total})", fill=(240, 220, 120))
s.save(out, quality=88)
print(out, s.size)
