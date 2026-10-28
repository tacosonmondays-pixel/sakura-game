# Usage, from the repo root: python3 tools/art/unbakeMarumiPlate.py   (Pillow and numpy; reads tools/art/src/marumi-plate-home.webp, writes plate.webp)
# Rebuild Marumi's ungraded living-scene plate: the full-colour scene where she is not, and the baked plate mapped back
# to full colour (a colour table fitted on the pixels both share, its correction smoothed) where she was painted out.
import sys, numpy as np
from PIL import Image, ImageFilter
plate = np.asarray(Image.open('tools/art/src/marumi-plate-home.webp').convert('RGB')).astype(np.float32)
scene = np.asarray(Image.open('public/art/scenes/marumi-scene.webp').convert('RGB')).astype(np.float32)
H, W = plate.shape[:2]
a = np.asarray(Image.open('public/art/live/marumi/girl.webp').split()[-1].crop((0, 0, W, H)))
hm = np.zeros((H, W), np.uint8); hb = np.asarray(Image.open('public/art/live/marumi/halo.png').split()[-1])
hm[12:12 + hb.shape[0], 941:941 + hb.shape[1]] = np.where(hb > 5, 255, 0)
m = Image.fromarray(np.maximum(np.where(a > 5, 255, 0).astype(np.uint8), hm)).filter(ImageFilter.MaxFilter(49))
out = np.asarray(m) < 128
B = 32
key = lambda px: (px[..., 0] / 256 * B).astype(int) * B * B + (px[..., 1] / 256 * B).astype(int) * B + (px[..., 2] / 256 * B).astype(int)
sums = np.zeros((B ** 3, 3)); cnt = np.zeros(B ** 3)
np.add.at(sums, key(plate[out]), scene[out]); np.add.at(cnt, key(plate[out]), 1)
coef, *_ = np.linalg.lstsq(np.c_[plate[out], np.ones(out.sum())], scene[out], rcond=None)
lin = (np.c_[plate.reshape(-1, 3), np.ones(H * W)] @ coef).reshape(H, W, 3)
lut = np.where(cnt[:, None] >= 8, sums / np.maximum(cnt[:, None], 1), np.nan)
mapped = lut[key(plate)]
mapped = np.where(np.isnan(mapped), lin, mapped)
delta = np.stack([np.asarray(Image.fromarray(np.clip(mapped[..., c] - plate[..., c] + 128, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))).astype(np.float32) - 128 for c in range(3)], -1)
fixed = plate + delta
print('mean abs err on shared px', round(float(np.abs(fixed[out] - scene[out]).mean()), 2))
feather = np.asarray(m.filter(ImageFilter.GaussianBlur(12))).astype(np.float32)[..., None] / 255
res = Image.fromarray(np.clip(scene * (1 - feather) + fixed * feather, 0, 255).astype(np.uint8))
res.save('public/art/live/marumi/plate.webp', quality=88, method=6)
