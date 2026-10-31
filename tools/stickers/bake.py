#!/usr/bin/env python3
"""Turn the chosen NovelAI pictures into stickers: cut-out (rembg, isnet-anime), a thick white die-cut border,
a crisp caption drawn here (never generated, so never garbled), then 256 and 128 px WebP in public/art/stickers/.

usage (rembg lives in a venv outside the repo):  STICKER_OUT=/path/outside/repo  venv/bin/python -I tools/stickers/bake.py [id,id]
Also writes docs/review/stickers/board.jpg (every sticker at 128 px and at 64 px); with STICKER_BEFORE=<folder of the
previous 128 px files> a before / after board (STICKER_BEFORE_BOARD names it); with STICKER_POSES=<render.mjs's pose
folder> the likeness board docs/review/stickers/board-likeness.jpg. Boards are JPEG, 300 KB or less.
The art is generated pastel (prompts.py); the lettering is pastel here.
"""
import os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # (python -I leaves the script's folder out)
REPO = os.path.dirname(os.path.dirname(HERE))
RAW = os.environ.get("STICKER_OUT") or sys.exit("set STICKER_OUT (the gen.py output folder)")
CUT = os.path.join(RAW, "_cut")
OUT = os.path.join(REPO, "public", "art", "stickers")
BOARD = os.path.join(REPO, "docs", "review", "stickers", "board.jpg")  # boards: JPEG, 300 KB or less
FONT = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
if not os.path.exists(FONT):
    FONT = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"

# id → (raw picture picked by eye, likeness first: the girls from like.py (<id>.s<k>: img2img 0.6, <id>.b.s<k>: 0.78),
# the slimes from the pastel set (generated as mochi_*); caption, caption pastel);
# keep in step with src/data/stickers.js
STICKERS = {
    "slime_hi": ("mochi_hi.s2", "Hi!", "mint"),
    "slime_thanks": ("mochi_thanks.s0", "Thanks!", "mint"),
    "slime_oops": ("mochi_oops.s1", "Oops!", "sky"),
    "slime_gg": ("mochi_gg.s2", "GG!", "pink"),
    "hikari_go": ("hikari_go.s1", "Let's go!", "pink"),
    "aoi_nice": ("aoi_nice.b.s0", "Nice!", "mint"),
    "kage_onit": ("kage_onit.b.s3", "On it!", "lavender"),
    "momo_yay": ("momo_yay.b.s1", "Yay!", "pink"),
    "akane_wow": ("akane_wow.b.s1", "Wow!", "peach"),
    "yuki_help": ("yuki_help.b.s0", "Help!", "sky"),
    "miko_thanks": ("miko_thanks.b.s2", "Thank you!", "pink"),
    "ena_luck": ("ena_luck.b.s0", "Good luck!", "lavender"),
    "iroha_ready": ("iroha_ready.b.s3", "Ready?", "lavender"),
    "tenka_charge": ("tenka_charge.s1", "Charge!", "sky"),
    "chigusa_bravo": ("chigusa_bravo.b.s2", "Bravo!", "butter"),
    "hotaru_boo": ("hotaru_boo.b.s2", "Boo!", "peach"),
}

# the lettering: a soft pastel fill and a deeper pastel outline (deep enough that the word reads at 64 px)
PASTELS = {
    "pink": ("#ffc2d9", "#ab4274"),
    "mint": ("#bdf0d8", "#2b7c5b"),
    "lavender": ("#ddd0fb", "#5f449e"),
    "peach": ("#ffd4b8", "#a9582b"),
    "sky": ("#c4e6fb", "#326fa3"),
    "butter": ("#fff0b0", "#8f7118"),
}

# the fallback tone pass (the first pastel try, Oct 31), for a sticker whose pastel regeneration came out worse: name
# its first-set picture as "first/<name>" in STICKERS (from $STICKER_FIRST) and it is cut out and put through pastel().
# Not used by any sticker today. The pass: saturation down by this much, light tones lifted toward a milky white; the dark
# lineart (value under ~0.3) is left alone so the drawing stays crisp
PASTEL_SAT = 0.68
PASTEL_LIFT = 0.24


def pastel(im):
    """A soft, milky pastel version of an RGBA picture: same hues, softer saturation, lighter mid and light tones."""
    import numpy as np
    a = np.asarray(im.convert("RGBA")).astype(np.float32) / 255.0
    rgb, alpha = a[..., :3], a[..., 3:]
    v = rgb.max(-1)
    # hue-preserving: move each channel toward the pixel's own value (less saturation), then toward white (lift)
    grey = v[..., None]
    rgb = grey + (rgb - grey) * PASTEL_SAT
    w = np.clip((v - 0.28) / 0.3, 0.0, 1.0)[..., None]  # 0 on the ink lines, 1 on mid and light tones
    rgb = rgb + (1.0 - rgb) * PASTEL_LIFT * w
    out = np.concatenate([np.clip(rgb, 0, 1), alpha], -1)
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA")


# a figure taller than this (height / width) loses its lower part under the caption; a sticker whose prop sits low
# (Hotaru's lantern) keeps more of it
KEEP_TALLER = {"hotaru_boo": 1.45}

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
    if name.startswith("first/"):  # the fallback: a first-set picture through the tone pass
        global RAW, CUT
        keep = RAW, CUT
        RAW = os.environ.get("STICKER_FIRST") or sys.exit("set STICKER_FIRST (the first set's gen.py output folder)")
        CUT = os.path.join(RAW, "_cut")
        try:
            return pastel(cutout(name[len("first/"):]))
        finally:
            RAW, CUT = keep
    os.makedirs(CUT, exist_ok=True)
    path = os.path.join(CUT, f"{name}.png")
    if name.startswith(("mochi_", "slime_")) and not os.path.exists(path):
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


def caption_layer(text, tone):
    """The caption on its own transparent layer (W x W), centred low; pastel letters with a deeper pastel stroke."""
    fill, colour = PASTELS[tone]
    layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    size = 104
    while True:
        font = ImageFont.truetype(FONT, size)
        stroke = max(10, size // 8)  # (long words get a smaller size: the stroke keeps them readable at 64 px)
        box = d.textbbox((0, 0), text, font=font, stroke_width=stroke)
        if box[2] - box[0] <= W - 2 * PAD or size <= 60:
            break
        size -= 4
    tw, th = box[2] - box[0], box[3] - box[1]
    x = (W - tw) // 2 - box[0]
    y = W - PAD - 6 - th - box[1]
    d.text((x, y), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=colour)
    return layer, y + box[1]


def bake(sid):
    raw, text, tone = STICKERS[sid]
    fig = cutout(raw)
    cap, cap_top = caption_layer(text, tone)
    # the figure fills the square; the caption sits over its lower part (sticker style). A tall figure loses its
    # feet under the caption so the face stays big at 64 px.
    room_w = W - 2 * PAD
    room_h = int(cap_top + (W - cap_top) * 0.55) - PAD
    tall = KEEP_TALLER.get(sid, 1.12)
    if fig.height > fig.width * tall:
        fig = fig.crop((0, 0, fig.width, int(fig.width * tall)))
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
    save_board(b, BOARD)


def board_compare(ids, before_dir):
    """Before / after: each row of 8 twice, the old stickers above the new, at 128 px with 64 px under each."""
    cols, cell, rowh = 8, 150, 214
    groups = [ids[i:i + cols] for i in range(0, len(ids), cols)]
    b = Image.new("RGB", (cols * cell + 120, len(groups) * 2 * rowh + 70), (236, 241, 250))
    d = ImageDraw.Draw(b)
    small = ImageFont.truetype(FONT, 16)
    old_label = os.environ.get("STICKER_BEFORE_LABEL", "before")
    d.text((20, 16), f"Stickers — {old_label} (above) and now (below), 128 px and 64 px", font=ImageFont.truetype(FONT, 22), fill=INK)
    for g, group in enumerate(groups):
        for k, (label, folder) in enumerate(((old_label.split(" ")[0], before_dir), ("now", OUT))):
            y = 54 + (2 * g + k) * rowh
            d.text((20, y + 56), label, font=small, fill=INK)
            for i, sid in enumerate(group):
                x = 110 + i * cell
                im = Image.open(os.path.join(folder, f"{sid}-128.webp")).convert("RGBA")
                b.paste(im, (x + 11, y), im)
                sm = im.resize((64, 64), Image.LANCZOS)
                b.paste(sm, (x + 43, y + 130), sm)
                if k:
                    d.text((x + 75, y + 196), sid, font=small, fill=INK, anchor="ma")
    path = os.path.join(os.path.dirname(BOARD), os.environ.get("STICKER_BEFORE_BOARD", "board-before-after.jpg"))
    save_board(b, path)
    return path


def save_board(img, path, limit=300_000):
    """A board as JPEG, at the best quality that stays within `limit` bytes (the boards rule, Oct 31)."""
    for q in (88, 82, 76, 70, 64, 58, 50):
        img.convert("RGB").save(path, "JPEG", quality=q, optimize=True, progressive=True)
        if os.path.getsize(path) <= limit:
            return path
    return path


def board_likeness(sids, pose_dir):
    """Likeness: each girl's portrait, her in-game chibi render, then her sticker at 128 and 64 px; two girls a row."""
    from like import GIRLS
    cell_w, row_h, per_row = 560, 190, 2
    rows = (len(sids) + per_row - 1) // per_row
    b = Image.new("RGB", (per_row * cell_w + 20, rows * row_h + 60), (236, 241, 250))
    d = ImageDraw.Draw(b)
    small = ImageFont.truetype(FONT, 15)
    d.text((20, 16), "Likeness — portrait · in-game chibi · sticker 128 px · 64 px", font=ImageFont.truetype(FONT, 22), fill=INK)
    for i, sid in enumerate(sids):
        girl = GIRLS[sid]
        x, y = 20 + (i % per_row) * cell_w, 54 + (i // per_row) * row_h
        por = Image.open(os.path.join(REPO, "public", "art", "portraits", f"{girl}-full.webp")).convert("RGB")
        b.paste(por.resize((120, 160), Image.LANCZOS), (x, y))
        pose = Image.open(os.path.join(pose_dir, f"{girl}.png")).convert("RGBA")
        pose = pose.crop(pose.getchannel("A").getbbox())
        pose.thumbnail((140, 160), Image.LANCZOS)
        tile = Image.new("RGBA", (140, 160), (255, 255, 255, 255))
        tile.alpha_composite(pose, ((140 - pose.width) // 2, 160 - pose.height))
        b.paste(tile.convert("RGB"), (x + 128, y))
        st = Image.open(os.path.join(OUT, f"{sid}-128.webp")).convert("RGBA")
        b.paste(st, (x + 276, y + 16), st)
        sm = st.resize((64, 64), Image.LANCZOS)
        b.paste(sm, (x + 412, y + 48), sm)
        d.text((x, y + 164), f"{GIRLS[sid].capitalize()} · {sid}", font=small, fill=INK)
    path = os.path.join(os.path.dirname(BOARD), "board-likeness.jpg")
    save_board(b, path)
    return path


if __name__ == "__main__":
    ids = sys.argv[1].split(",") if len(sys.argv) > 1 else list(STICKERS)
    for sid in ids:
        bake(sid)
        print("baked", sid, flush=True)
    board(list(STICKERS))
    print("board", BOARD)
    if os.environ.get("STICKER_BEFORE"):  # a folder with the previous <id>-128.webp files
        print("before/after", board_compare(list(STICKERS), os.environ["STICKER_BEFORE"]))
    if os.environ.get("STICKER_POSES"):  # the folder of render.mjs's <girl>.png
        from like import GIRLS
        print("likeness", board_likeness([s for s in STICKERS if s in GIRLS], os.environ["STICKER_POSES"]))
