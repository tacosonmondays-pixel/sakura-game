#!/usr/bin/env python3
"""Ship files for one art v3 portrait (the game's portrait set, src/art/portraits.js).

usage: python3 -I make_crops.py <master.png> <id> <outdir> --eyes X Y --head H [--card-dx PX] [--bust-dx PX] [--thumb-dx PX]
  --eyes X Y   the point between her eyes in the 768x1024 master (px)
  --head H     her head height in px, crown (not the halo) to chin
  --*-dx       shift one crop sideways (px in the master) when a prop or the reaching hand needs room
writes <outdir>/<id>-full.webp (768x1024, the master), <id>-card.webp (300x500), <id>-bust.webp (512x512),
<id>-thumb.webp (160x160), all .webp q90 method 6, plus <outdir>/<id>-crops.jpg (a contact sheet to look at) and
prints her PORTRAIT_DATA face point [x%, y%] (between the eyes, % of the master).

Framing (the shipped rules): card = head top about 8 % down, the card runs down toward her hips (3:5);
bust = head and shoulders, eyes in the upper third; thumb = a tighter bust. Never upscales past 1.22x."""
import argparse, os
from PIL import Image, ImageDraw

MAXUP = 1.22


def crop_box(cx, top, w, h, W, H):
    x0 = max(0, min(W - w, cx - w / 2))
    y0 = max(0, min(H - h, top))
    return (round(x0), round(y0), round(x0 + w), round(y0 + h))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("master"); ap.add_argument("id"); ap.add_argument("outdir")
    ap.add_argument("--eyes", nargs=2, type=float, required=True)
    ap.add_argument("--head", type=float, required=True)
    ap.add_argument("--card-dx", type=float, default=0); ap.add_argument("--bust-dx", type=float, default=0)
    ap.add_argument("--thumb-dx", type=float, default=0)
    a = ap.parse_args()
    im = Image.open(a.master).convert("RGB")
    if im.size != (768, 1024):
        raise SystemExit(f"master must be 768x1024, got {im.size}")
    W, H = im.size
    ex, ey = a.eyes
    head = a.head
    crown = ey - head * 0.55  # eyes sit a little above the middle of an anime head
    os.makedirs(a.outdir, exist_ok=True)
    out = {}
    # card 3:5: crown 8 % down; height = about 5.2 heads (crown to hips), at least 1/1.22 of the 300x500 target
    ch = max(head * 5.2, 500 / MAXUP)
    ch = min(ch, H)
    cw = ch * 0.6
    if cw > W:
        cw, ch = W, W / 0.6
    out["card"] = (crop_box(ex + a.card_dx, crown - ch * 0.08, cw, ch, W, H), (300, 500))
    # bust 1:1: eyes at 34 % down, about 2.6 heads tall
    bs = max(head * 2.6, 512 / MAXUP)
    bs = min(bs, W)
    out["bust"] = (crop_box(ex + a.bust_dx, ey - bs * 0.34, bs, bs, W, H), (512, 512))
    # thumb 1:1: eyes at 40 % down, about 1.9 heads tall
    ts = max(head * 1.9, 160 / MAXUP)
    ts = min(ts, W)
    out["thumb"] = (crop_box(ex + a.thumb_dx, ey - ts * 0.40, ts, ts, W, H), (160, 160))
    im.save(os.path.join(a.outdir, f"{a.id}-full.webp"), "WEBP", quality=90, method=6)
    tiles = [im.resize((300, 400), Image.LANCZOS)]
    for kind, (box, size) in out.items():
        c = im.crop(box).resize(size, Image.LANCZOS)
        c.save(os.path.join(a.outdir, f"{a.id}-{kind}.webp"), "WEBP", quality=90, method=6)
        tiles.append(c if c.height <= 400 else c.resize((round(c.width * 400 / c.height), 400), Image.LANCZOS))
        print(f"{kind:5s} box {box} -> {size}  scale {size[0] / (box[2] - box[0]):.2f}x")
    sheet = Image.new("RGB", (sum(t.width for t in tiles) + 10 * (len(tiles) + 1), 420), (24, 26, 34))
    x = 10
    for t in tiles:
        sheet.paste(t, (x, 10))
        x += t.width + 10
    d = ImageDraw.Draw(sheet)
    d.text((14, 404), f"{a.id}: full / card / bust / thumb", fill=(220, 220, 230))
    sheet.save(os.path.join(a.outdir, f"{a.id}-crops.jpg"), quality=88)
    face = [round(ex / W * 100), round(ey / H * 100)]
    print(f"PORTRAIT_DATA face: {face}")


if __name__ == "__main__":
    main()
