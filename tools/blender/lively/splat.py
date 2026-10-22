"""Tiny z-buffered splat renderer for mesh probes (orthographic, triangles filled by barycentric
sampling of vertex colours). render(pos, tri, col, view) -> PIL image."""
import numpy as np
from PIL import Image

VIEWS = {
    # (right axis vector, up axis vector, toward-viewer vector)
    'front': (np.array([1, 0, 0.]), np.array([0, 1, 0.]), np.array([0, 0, 1.])),
    'back': (np.array([-1, 0, 0.]), np.array([0, 1, 0.]), np.array([0, 0, -1.])),
    'left': (np.array([0, 0, -1.]), np.array([0, 1, 0.]), np.array([1, 0, 0.])),   # her left side, she faces right... (+Z to the left)
    'right': (np.array([0, 0, 1.]), np.array([0, 1, 0.]), np.array([-1, 0, 0.])),  # her right side: her front (+Z) to the right
    'top': (np.array([1, 0, 0.]), np.array([0, 0, -1.]), np.array([0, 1, 0.])),
}


def render(pos, tri, col, view='front', size=900, box=None, light=(0.3, 0.6, 0.75), samples=6, tex=None, uv=None):
    R, U, F = VIEWS[view] if isinstance(view, str) else view
    if box is None:
        lo, hi = pos.min(0), pos.max(0)
    else:
        lo, hi = np.array(box[0]), np.array(box[1])
    c = (lo + hi) / 2
    span = max(np.abs((hi - lo) @ np.abs(R)), np.abs((hi - lo) @ np.abs(U))) * 1.04
    x = ((pos - c) @ R / span + 0.5) * size
    y = (0.5 - (pos - c) @ U / span) * size
    z = (pos - c) @ F
    a, b, cc = tri[:, 0], tri[:, 1], tri[:, 2]
    n = np.cross(pos[b] - pos[a], pos[cc] - pos[a])
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    L = np.array(light, float)
    L /= np.linalg.norm(L)
    Lw = L[0] * R + L[1] * U + L[2] * F
    shade = 0.55 + 0.45 * np.abs(n @ Lw)
    img = np.full((size, size, 3), 32.0)
    zb = np.full((size, size), -1e9)
    # barycentric samples per triangle, scaled by its screen size
    ex = np.maximum.reduce([np.abs(x[a] - x[b]), np.abs(x[b] - x[cc]), np.abs(x[a] - x[cc]),
                            np.abs(y[a] - y[b]), np.abs(y[b] - y[cc]), np.abs(y[a] - y[cc])])
    k = np.clip(np.ceil(ex * 1.5), 2, 40).astype(int)
    for kk in np.unique(k):
        sel = np.where(k == kk)[0]
        g = np.array([(i / kk, j / kk) for i in range(kk + 1) for j in range(kk + 1 - i)])
        w1, w2 = g[:, 0][None], g[:, 1][None]
        w0 = 1 - w1 - w2
        A, B, C = a[sel][:, None], b[sel][:, None], cc[sel][:, None]
        px = w0 * x[A] + w1 * x[B] + w2 * x[C]
        py = w0 * y[A] + w1 * y[B] + w2 * y[C]
        pz = w0 * z[A] + w1 * z[B] + w2 * z[C]
        if tex is not None:
            th, tw = tex.shape[:2]
            pu = w0 * uv[A, 0] + w1 * uv[B, 0] + w2 * uv[C, 0]
            pv = w0 * uv[A, 1] + w1 * uv[B, 1] + w2 * uv[C, 1]
            pc = tex[np.clip((pv * th).astype(int), 0, th - 1), np.clip((pu * tw).astype(int), 0, tw - 1)] * shade[sel][:, None, None]
        else:
            pc = (w0[..., None] * col[A] + w1[..., None] * col[B] + w2[..., None] * col[C]) * shade[sel][:, None, None]
        ix = np.clip(px.astype(int), 0, size - 1).ravel()
        iy = np.clip(py.astype(int), 0, size - 1).ravel()
        pz = pz.ravel()
        pc = pc.reshape(-1, 3)
        order = np.argsort(pz)
        ix, iy, pz, pc = ix[order], iy[order], pz[order], pc[order]
        flat = iy * size + ix
        # last write wins = nearest (sorted ascending by depth toward viewer)
        zcur = zb.ravel()
        upd = pz > zcur[flat]
        f2 = flat[upd]
        zcur[f2] = pz[upd]
        img.reshape(-1, 3)[f2] = pc[upd]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))

