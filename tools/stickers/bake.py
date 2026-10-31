#!/usr/bin/env python3
"""Turn the chosen NovelAI pictures into stickers: cut-out (rembg, isnet-anime), a thick white die-cut border,
a crisp caption drawn here (never generated, so never garbled), then 256 and 128 px WebP in public/art/stickers/.

usage (rembg lives in a venv outside the repo):  STICKER_OUT=/path/outside/repo  venv/bin/python -I tools/stickers/bake.py [id,id]
Also writes docs/review/stickers/board.png (every sticker at 128 px and at 64 px).
"""
import os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
RAW = os.environ.get("STICKER_OUT") or sys.exit("set STICKER_OUT (the gen.py output folder)")
CUT = os.path.join(RAW, "_cut")
OUT = os.path.join(REPO, "public", "art", "stickers")
BOARD = os.path.join(REPO, "docs", "review", "stickers", "board.png")
FONT = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
if not os.path.exists(FONT):
    FONT = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"

# id → (raw picture chosen after the eye check, caption, caption stroke colour); keep in step with src/data/stickers.js
STICKERS = {
    "mochi_hi": ("mochi_hi", "Hi!", "#2f9c62"),
    "mochi_thanks": ("mochi_thanks", "Thanks!", "#2f9c62"),
    "mochi_oops": ("mochi_oops", "Oops!", "#2f9c62"),
    "mochi_gg": ("mochi_gg", "GG!", "#c94a7d"),
    "hikari_go": ("hikari_go.try2", "Let's go!", "#c4567d"),
    "aoi_nice": ("aoi_nice", "Nice!", "#367a4c"),
    "kage_onit": ("kage_onit.try2", "On it!", "#5a3f78"),
    "momo_yay": ("momo_yay.try2", "Yay!", "#b84a8a"),
    "akane_wow": ("akane_wow", "Wow!", "#b8432f"),
    "yuki_help": ("yuki_help", "Help!", "#3f7fa8"),
    "miko_thanks": ("miko_thanks", "Thank you!", "#b8323a"),
    "ena_luck": ("ena_luck", "Good luck!", "#9a4a6c"),
    "iroha_ready": ("iroha_ready", "Ready?", "#5a4470"),
    "tenka_charge": ("tenka_charge", "Charge!", "#2c4fc4"),
    "chigusa_bravo": ("chigusa_bravo", "Bravo!", "#5f8040"),
    "hotaru_boo": ("hotaru_boo", "Boo!", "#c46a1f"),
}

W = 512  # working size (square)
BORDER = 16  # die-cut white border, px at 512
PAD = BORDER + 16  # the art stays this far from the canvas edge (border, hairline and shadow fit)
INK = (29, 54, 96, 255)  # the game's navy, for the hairline round the die-cut


def flood(name):
    """The plain light background, flood-filled from the edges (rembg drops the pale jelly slimes)."""
    im = Image.open(os.path.join(RAW, f"{name}.png")).convert("RGB")
    w, h = im.size
    px = im.load()
    bg = bytearray(w * h)
    light = lambda c: min(c) >= 228 and max(c) - min(c) <= 14
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        i = y * w + x
        if bg[i] or not light(px[x, y]):
            continue
        bg[i] = 1
        if x > 0: stack.append((x - 1, y))
        if x < w - 1: stack.append((x + 1, y))
        if y > 0: stack.append((x, y - 1))
        if y < h - 1: stack.append((x, y + 1))
    a = Image.frombytes("L", (w, h), bytes(0 if v else 255 for v in bg)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert("RGBA")
    out.putalpha(a)
    return out


def cutout(name):
    os.makedirs(CUT, exist_ok=True)
    path = os.path.join(CUT, f"{name}.png")
    if name.startswith("mochi_") and not os.path.exists(path):
        flood(name).save(path)
    if not os.path.exists(path):
        from rembg import new_session, remove
        global _session
        try:
            _session
        except NameError:
            _session = new_session("isnet-anime")
        remove(Image.open(os.path.join(RAW, f"{name}.png")).convert("RGB"), session=_session).save(path)
    im = Image.open(path).convert("RGBA")
    a = im.getchannel("A").point(lambda v: 0 if v < 24 else v)  # drop the faint haze round the figure
    im.putalpha(a)
    return im.crop(a.getbbox())


def caption_layer(text, colour):
    """The caption on its own transparent layer (W x W), centred low; white letters, a thick coloured stroke."""
    layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    size = 104
    while True:
        font = ImageFont.truetype(FONT, size)
        stroke = max(8, size // 9)
        box = d.textbbox((0, 0), text, font=font, stroke_width=stroke)
        if box[2] - box[0] <= W - 2 * PAD or size <= 60:
            break
        size -= 4
    tw, th = box[2] - box[0], box[3] - box[1]
    x = (W - tw) // 2 - box[0]
    y = W - PAD - 6 - th - box[1]
    d.text((x, y), text, font=font, fill="white", stroke_width=stroke, stroke_fill=colour)
    return layer, y + box[1]


def bake(sid):
    raw, text, colour = STICKERS[sid]
    fig = cutout(raw)
    cap, cap_top = caption_layer(text, colour)
    # the figure fills the square; the caption sits over its lower part (sticker style). A tall figure loses its
    # feet under the caption so the face stays big at 64 px.
    room_w = W - 2 * PAD
    room_h = int(cap_top + (W - cap_top) * 0.55) - PAD
    if fig.height > fig.width * 1.12:
        fig = fig.crop((0, 0, fig.width, int(fig.width * 1.12)))
    s = min(room_w / fig.width, room_h / fig.height)
    fig = fig.resize((max(1, int(fig.width * s)), max(1, int(fig.height * s))), Image.LANCZOS)
    art = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    art.alpha_composite(fig, ((W - fig.width) // 2, PAD + (room_h - fig.height)))
    art.alpha_composite(cap)
    # die-cut: the union grown by BORDER, smoothed, white, with a thin navy hairline and a soft shadow under it
    a = art.getchannel("A").point(lambda v: 255 if v > 40 else 0)
    grown = a.filter(ImageFilter.MaxFilter(2 * BORDER + 1)).filter(ImageFilter.GaussianBlur(3)).point(lambda v: 255 if v > 110 else 0)
    line = grown.filter(ImageFilter.MaxFilter(5))
    shadow = line.filter(ImageFilter.GaussianBlur(6)).point(lambda v: v * 0.35)
    out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    sh = Image.new("RGBA", (W, W), (20, 30, 60, 255))
    sh.putalpha(shadow)
    out.alpha_composite(sh, (0, 5))
    ink = Image.new("RGBA", (W, W), INK)
    ink.putalpha(line.point(lambda v: int(v * 0.55)))
    out.alpha_composite(ink)
    white = Image.new("RGBA", (W, W), (255, 255, 255, 255))
    white.putalpha(grown)
    out.alpha_composite(white)
    out.alpha_composite(art)
    os.makedirs(OUT, exist_ok=True)
    for px in (256, 128):
        out.resize((px, px), Image.LANCZOS).save(os.path.join(OUT, f"{sid}-{px}.webp"), "WEBP", quality=88, method=6)
    return out


def board(ids):
    cols = 8
    rows = (len(ids) + cols - 1) // cols
    cell = 150
    b = Image.new("RGB", (cols * cell + 40, rows * (cell + 84) + 60), (236, 241, 250))
    d = ImageDraw.Draw(b)
    small = ImageFont.truetype(FONT, 16)
    d.text((20, 16), "Stickers v1 — 16 (128 px, and 64 px below each)", font=ImageFont.truetype(FONT, 22), fill=INK)
    for i, sid in enumerate(ids):
        x, y = 20 + (i % cols) * cell, 54 + (i // cols) * (cell + 84)
        im = Image.open(os.path.join(OUT, f"{sid}-128.webp")).convert("RGBA")
        b.paste(im, (x + 11, y), im)
        sm = im.resize((64, 64), Image.LANCZOS)
        b.paste(sm, (x + 43, y + 130), sm)
        d.text((x + 75, y + 200), sid, font=small, fill=INK, anchor="ma")
    os.makedirs(os.path.dirname(BOARD), exist_ok=True)
    b.save(BOARD, optimize=True)


if __name__ == "__main__":
    ids = sys.argv[1].split(",") if len(sys.argv) > 1 else list(STICKERS)
    for sid in ids:
        bake(sid)
        print("baked", sid, flush=True)
    board(list(STICKERS))
    print("board", BOARD)
