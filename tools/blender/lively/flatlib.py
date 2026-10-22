"""Offline flatten of a painted Meshy figure's base colour (PLAN §5.2 TX2), numpy + Pillow only, no render
engine. Shared pieces: UV rasteriser (texel -> triangle + barycentrics), per-texel 3D position and skin
weights, OKLab conversion, k-means, mode filter, island ids, mesh adjacency. flatten.py drives it."""
import numpy as np

# ------------------------------------------------------------------ colour
def srgb_to_lin(c):
    c = np.asarray(c, np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(np.asarray(c, np.float64), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


_M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                [0.2119034982, 0.6806995451, 0.1073969566],
                [0.0883024619, 0.2817188376, 0.6299787005]])
_M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                [1.9779984951, -2.4285922050, 0.4505937099],
                [0.0259040371, 0.7827717662, -0.8086757660]])


def lin_to_oklab(c):
    lms = np.cbrt(np.maximum(np.asarray(c) @ _M1.T, 0))
    return lms @ _M2.T


def oklab_to_lin(L):
    lms = (np.asarray(L) @ np.linalg.inv(_M2).T) ** 3
    return np.clip(lms @ np.linalg.inv(_M1).T, 0, 1)


def hex_to_rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float64) / 255.0


def rgb_to_hex(c):
    c = np.clip(np.round(np.asarray(c) * 255), 0, 255).astype(int)
    return '#' + ''.join(f'{v:02x}' for v in c)


def hex_to_lab(h):
    return lin_to_oklab(srgb_to_lin(hex_to_rgb(h)))


def lab_to_hex(L):
    return rgb_to_hex(lin_to_srgb(oklab_to_lin(L)))


def luminance(srgb):
    """sRGB-encoded relative luminance (tex_metrics.py's 'brightness' scale)."""
    lin = srgb_to_lin(srgb)
    Y = lin @ np.array([0.2126, 0.7152, 0.0722])
    return np.where(Y <= 0.0031308, Y * 12.92, 1.055 * np.maximum(Y, 0) ** (1 / 2.4) - 0.055)


# ------------------------------------------------------------------ raster
def raster(uv, tri, W, H):
    """Texel centres -> (face id (H, W) int32, -1 = none; barycentrics (H, W, 3) float32).
    glTF UVs: (0, 0) is the image's top-left."""
    fid = np.full((H, W), -1, np.int32)
    bary = np.zeros((H, W, 3), np.float32)
    P = uv[tri] * np.array([W, H])  # (T, 3, 2)
    lo = np.floor(P.min(1) - 0.5).astype(int)
    hi = np.ceil(P.max(1) + 0.5).astype(int)
    for t in range(len(tri)):
        x0, y0 = max(lo[t, 0], 0), max(lo[t, 1], 0)
        x1, y1 = min(hi[t, 0], W - 1), min(hi[t, 1], H - 1)
        if x1 < x0 or y1 < y0:
            continue
        a, b, c = P[t]
        v0, v1 = b - a, c - a
        den = v0[0] * v1[1] - v1[0] * v0[1]
        if abs(den) < 1e-12:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        qx, qy = xs - a[0], ys - a[1]
        w1 = (qx * v1[1] - v1[0] * qy) / den
        w2 = (v0[0] * qy - qx * v0[1]) / den
        w0 = 1 - w1 - w2
        ok = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        if not ok.any():
            continue
        iy, ix = np.nonzero(ok)
        iy += y0
        ix += x0
        fid[iy, ix] = t
        bary[iy, ix, 0] = w0[ok]
        bary[iy, ix, 1] = w1[ok]
        bary[iy, ix, 2] = w2[ok]
    return fid, bary


def texel_attr(fid, bary, tri, attr):
    """Barycentric interpolation of a per-vertex attribute at every covered texel -> (N, C) for the
    texels where fid >= 0 (row-major order of np.nonzero(fid >= 0))."""
    m = fid >= 0
    f = fid[m]
    b = bary[m]
    A = attr[tri[f]]  # (N, 3, C)
    return (b[..., None] * A).sum(1)


# ------------------------------------------------------------------ clustering / filters
def kmeans(X, init, iters=15, w=None):
    C = np.array(init, np.float64)
    for _ in range(iters):
        d = ((X[:, None, :] - C[None]) ** 2).sum(-1)
        lab = d.argmin(1)
        for k in range(len(C)):
            s = lab == k
            if s.any():
                C[k] = X[s].mean(0) if w is None else (X[s] * w[s, None]).sum(0) / w[s].sum()
    d = ((X[:, None, :] - C[None]) ** 2).sum(-1)
    return C, d.argmin(1), np.sqrt(d.min(1))


def kmeanspp(X, k, seed=7):
    rng = np.random.default_rng(seed)
    C = [X[rng.integers(len(X))]]
    d2 = np.full(len(X), np.inf)
    for _ in range(k - 1):
        d2 = np.minimum(d2, ((X - C[-1]) ** 2).sum(1))
        C.append(X[rng.choice(len(X), p=d2 / d2.sum())])
    return np.array(C)


def mode_filter(lab, valid, island, r=2, nlab=None, passes=1):
    """Per-texel majority label in a (2r+1)^2 window, counting only valid texels of the same island."""
    H, W = lab.shape
    nlab = int(lab[valid].max()) + 1 if nlab is None else nlab
    out = lab.copy()
    for _ in range(passes):
        best = np.full((H, W), -1.0)
        arg = out.copy()
        cnt = {}
        pad = r
        L = np.pad(out, pad, constant_values=-1)
        I = np.pad(island, pad, constant_values=-2)
        V = np.pad(valid, pad, constant_values=False)
        for k in range(nlab):
            acc = np.zeros((H, W), np.float32)
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    sl = (slice(pad + dy, pad + dy + H), slice(pad + dx, pad + dx + W))
                    acc += ((L[sl] == k) & V[sl] & (I[sl] == island)).astype(np.float32)
            better = acc > best
            best = np.where(better, acc, best)
            arg = np.where(better, k, arg)
        out = np.where(valid, arg, out)
    return out


def islands(tri, nverts_uv_key):
    """UV islands: triangles connected through shared UV-vertex indices (the glTF vertices are
    already split at UV seams). Returns island id per triangle."""
    parent = np.arange(nverts_uv_key)

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    for t in tri:
        ra, rb, rc = find(t[0]), find(t[1]), find(t[2])
        parent[rb] = ra
        parent[find(rc)] = ra
    roots = np.array([find(v) for v in range(nverts_uv_key)])
    return roots[tri[:, 0]]


def face_adjacency(pos, tri, tol=1e-5):
    """Triangle neighbours across edges of the 3D surface (positions welded, so UV seams do not cut
    the adjacency). Returns list of neighbour arrays."""
    key = np.round(pos / tol).astype(np.int64)
    _, weld = np.unique(key, axis=0, return_inverse=True)
    weld = weld.ravel()
    T = weld[tri]
    edges = {}
    for t, (a, b, c) in enumerate(T):
        for e in ((a, b), (b, c), (c, a)):
            k = (min(e), max(e))
            edges.setdefault(k, []).append(t)
    nb = [[] for _ in range(len(tri))]
    for ts in edges.values():
        if len(ts) > 1:
            for i in ts:
                for j in ts:
                    if i != j:
                        nb[i].append(j)
    return [np.array(sorted(set(n)), np.int64) for n in nb]


def dilate(img, valid, px=8):
    """Grow covered texels outward by px (mip bleed): each empty texel takes the mean of its covered
    4/8-neighbours, ring by ring."""
    img = img.copy()
    v = valid.copy()
    H, W = v.shape
    for _ in range(px):
        acc = np.zeros(img.shape, np.float64)
        n = np.zeros((H, W), np.float64)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            sv = np.roll(np.roll(v, dy, 0), dx, 1)
            si = np.roll(np.roll(img, dy, 0), dx, 1)
            acc += si * sv[..., None]
            n += sv
        grow = (~v) & (n > 0)
        img[grow] = acc[grow] / n[grow, None]
        v = v | grow
    return img, v
