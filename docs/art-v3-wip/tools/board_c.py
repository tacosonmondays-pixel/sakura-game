#!/usr/bin/env python3
"""Art v3c owner boards: old | new side by side with the owner's checklist under each pair, JPEG <= 300 KB each.
usage: board_c.py <judge_dir> <before_dir> <after_dir> <out_prefix> <id>...   (writes <out_prefix>-1.jpg, -2.jpg, ...)"""
import io, json, sys
from PIL import Image, ImageDraw
jd, bdir, adir, pre, ids = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5:]
W, H, PER_ROW, PER_BOARD, LIMIT = 180, 240, 4, 12, 300 * 1024
cw, ch = 2 * W + 18, H + 92
def board(chunk, n, total):
    rows = (len(chunk) + PER_ROW - 1) // PER_ROW
    s = Image.new("RGB", (PER_ROW * cw + 12, rows * ch + 34), (22, 24, 32))
    d = ImageDraw.Draw(s)
    d.text((10, 10), f"Art v3c (option C), board {n}/{total}: OLD (left) | NEW (right). No halos, signature props, richer backgrounds.", fill=(235, 235, 245))
    for i, gid in enumerate(chunk):
        x, y = 10 + (i % PER_ROW) * cw, 32 + (i // PER_ROW) * ch
        j = json.load(open(f"{jd}/{gid}.json"))
        for k, p in enumerate([f"{bdir}/{gid}-full.webp", f"{adir}/{gid}-full.webp"]):
            s.paste(Image.open(p).convert("RGB").resize((W, H), Image.LANCZOS), (x + k * (W + 4), y + 16))
        d.text((x, y + 2), f"{gid}  {j['pick']}  {j['pick_total']}", fill=(240, 220, 120))
        c = j.get("checklist", {})
        yes = lambda v: str(v).split(":")[0].split(" ")[0][:14] if v else "?"
        lines = [f"likeness: {yes(c.get('likeness'))}   prop: {yes(c.get('prop'))}",
                 f"halo-free: {yes(c.get('halo_free'))}   background: {yes(c.get('background'))}",
                 f"adult reads adult: {yes(c.get('adult'))}"]
        for li, t in enumerate(lines):
            d.text((x, y + H + 22 + li * 14), t, fill=(200, 210, 225))
    for q in range(88, 30, -4):
        b = io.BytesIO(); s.save(b, "JPEG", quality=q, optimize=True)
        if b.tell() <= LIMIT:
            break
    out = f"{pre}-{n}.jpg"; open(out, "wb").write(b.getvalue()); print(out, s.size, b.tell() // 1024, "KB q", q)
chunks = [ids[i:i + PER_BOARD] for i in range(0, len(ids), PER_BOARD)]
for n, c in enumerate(chunks, 1):
    board(c, n, len(chunks))
