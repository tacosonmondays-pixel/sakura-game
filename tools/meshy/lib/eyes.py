"""Find the painted eyes of a Meshy figure so the game can close them (blink, happy ^ ^, hurt > <).

Her face is painted into the base colour, so there are no eye meshes or face cells to swap. The
runtime (src/models/figurine.js) instead paints over each eye in the shader while it is closed:
inside a rounded box round the eye, in the mesh's bind-pose position space, the texture becomes
eyelid skin with a dark lid line. This module measures those boxes from the baked texture:

* every texel of the face triangles (lowpoly.FACE_BOX) is mapped back to its 3D position
* the teal iris texels on each side of the face give the two eyes; the eye itself is the iris
  plus the dark lashes, the eye white and other dark non-skin, non-hair texels round it
* eyelid colours: the skin just above (lid) and just below (cheek) the eye; the lid line uses
  the dark lash colour; roughness of the skin from the metal/roughness map

Returns asset.extras.eyes in the GLB's stored position space (glTF axes, `scale` applied)."""
import numpy as np

from .lowpoly import in_face


def _pixels(img):
    w, h = img.size
    px = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(px)
    return (px.reshape(h, w, 4)[..., :3] * 255 + 0.5).astype(np.uint8)  # byte images: stored values


def face_texels(lo, base, mr=None):
    """(positions (N, 3), colours (N, 3) uint8, roughness (N,) or None) of every face texel."""
    h, w = base.shape[:2]
    me = lo.data
    uvl = me.uv_layers.active.data
    co = np.array([v.co[:] for v in me.vertices])
    pts, cols, idx = [], [], []
    for p in me.polygons:
        vi = list(p.vertices)
        p3 = co[vi]
        if not in_face(p3.mean(0)):
            continue
        uv = np.array([uvl[p.loop_start + c].uv[:] for c in range(3)]) * [w, h]
        x0, y0 = np.floor(uv.min(0)).astype(int)
        x1, y1 = np.ceil(uv.max(0)).astype(int)
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        q = np.stack([xs.ravel(), ys.ravel()], 1)
        a, b, c = uv
        v0, v1 = b - a, c - a
        den = v0[0] * v1[1] - v1[0] * v0[1]
        if abs(den) < 1e-9:
            continue
        w1 = ((q[:, 0] - a[0]) * v1[1] - v1[0] * (q[:, 1] - a[1])) / den
        w2 = (v0[0] * (q[:, 1] - a[1]) - (q[:, 0] - a[0]) * v0[1]) / den
        w0 = 1 - w1 - w2
        ok = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not ok.any():
            continue
        pts.append(w0[ok, None] * p3[0] + w1[ok, None] * p3[1] + w2[ok, None] * p3[2])
        px = np.clip(q[ok].astype(int), 0, [w - 1, h - 1])
        idx.append(px)
        cols.append(base[px[:, 1], px[:, 0]])
    pts = np.concatenate(pts)
    cols = np.concatenate(cols).astype(np.int16)
    rough = None
    if mr is not None:
        idx = np.concatenate(idx)
        mh, mw = mr.shape[:2]
        rough = mr[(idx[:, 1] * mh // h), (idx[:, 0] * mw // w), 1] / 255.0
    return pts, cols, rough


def _hex(c):
    return '#' + ''.join(f'{int(round(v)):02x}' for v in c)


def find_eyes(lo, base_img, mr_img=None, scale=1.0, grow=(1.12, 1.15)):
    base = _pixels(base_img)
    mr = _pixels(mr_img) if mr_img is not None else None
    pts, cols, rough = face_texels(lo, base, mr)
    r, g, b = cols.T
    teal = (g - r > 60) & (b - r > 50)
    dark = (r + g + b) < 200
    white = (cols.min(1) > 200) & (cols.max(1) - cols.min(1) < 25)
    hair = (r > 185) & (r - g > 45) & (b > g)
    skin = (r > 200) & (g > 160) & (b > 135) & (r - g >= 10) & (r - b >= 25) & (g - b >= 0) & (g - b < 36)
    front = pts[:, 1] < -0.2
    eyes = []
    for sgn in (-1, 1):  # her right eye (-X) first
        iris = teal & front & (np.sign(pts[:, 0]) == sgn)
        if iris.sum() < 50:
            return None
        c = np.median(pts[iris], 0)
        win = front & (np.abs(pts[:, 0] - c[0]) < 0.14) & (pts[:, 2] > c[2] - 0.10) & (pts[:, 2] < c[2] + 0.14)
        eye = win & (dark | teal | white | ((r + g + b < 330) & ~hair & ~skin))
        e = pts[eye]
        lo_, hi_ = np.percentile(e, 0.5, 0), np.percentile(e, 99.5, 0)
        ctr = (lo_ + hi_) / 2
        ctr[1] = np.median(e[:, 1])
        half = (hi_ - lo_) / 2
        col = (np.abs(pts[:, 0] - ctr[0]) < half[0]) & skin
        above = col & (pts[:, 2] > hi_[2]) & (pts[:, 2] < hi_[2] + 0.03)
        below = col & (pts[:, 2] < lo_[2]) & (pts[:, 2] > lo_[2] - 0.03)
        lash = win & dark & ~(g - r > 25)
        eyes.append(dict(
            center=[ctr[0] * scale, ctr[2] * scale, -ctr[1] * scale],  # Blender (x, -y fwd, z up) -> glTF
            radii=[half[0] * grow[0] * scale, half[2] * grow[1] * scale],
            skin=np.median(cols[above], 0) if above.sum() > 20 else np.array([253, 234, 215]),
            skin_low=np.median(cols[below], 0) if below.sum() > 20 else None,
            lash=np.median(cols[lash], 0) if lash.sum() > 20 else np.array([43, 29, 36]),
            rough=float(np.median(rough[above | below])) if rough is not None and (above | below).sum() > 20 else None,
            texels=int(eye.sum())))
    skin_hi = np.mean([e['skin'] for e in eyes], 0)
    lows = [e['skin_low'] for e in eyes if e['skin_low'] is not None]
    rough_v = [e['rough'] for e in eyes if e['rough'] is not None]
    out = dict(
        centers=[[round(float(v), 5) for v in e['center']] for e in eyes],
        radii=[[round(float(v), 5) for v in e['radii']] for e in eyes],
        depth=round(0.05 * scale, 5),
        skin=_hex(skin_hi), skinLow=_hex(np.mean(lows, 0) if lows else skin_hi),
        lash=_hex(np.mean([e['lash'] for e in eyes], 0) * 0.8),
    )
    if rough_v:
        out['roughness'] = round(float(np.mean(rough_v)), 3)
    print(f'[meshy] eyes: {out} (texels {[e["texels"] for e in eyes]})')
    return out
