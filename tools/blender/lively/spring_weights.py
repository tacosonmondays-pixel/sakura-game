"""Noa's authored spring bones (PLAN §5.1 step 6): bun_L / bun_R (children of head) and ribbon (child of
chest), with smooth weights: 0 where the part attaches, 1 at its tip, taken out of the vertex's existing
weights (head for the buns). Positions are in the GLB's stored position space (glTF axes, +Y up, +Z front).

    python spring_weights.py <glb> <out.npz> [--debug prefix] [--ref ref.npz]

The full model measures the bun spheres and the ribbon box; the LOD (--ref) reuses the full model's bones
so both detail levels swing identically."""
import io
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import MESHY_TOOLS, NOA, GIRLS, MESHY_CLIPS  # noqa: E402,F401
sys.path.insert(0, MESHY_TOOLS)
import glbmesh as G  # noqa: E402

BUN_GUESS = [(0.14, 0.575, -0.125), (-0.14, 0.575, -0.125)]  # her left (+X), her right
RIBBON_BOX = ([-0.045, 0.43, 0.04], [0.045, 0.50, 0.15])


def smooth(x0, x1, v):
    t = np.clip((v - x0) / (x1 - x0), 0, 1)
    return t * t * (3 - 2 * t)


def fit_sphere(P):
    A = np.c_[2 * P, np.ones(len(P))]
    b = (P ** 2).sum(1)
    x, *_ = np.linalg.lstsq(A, b, rcond=None)
    c = x[:3]
    r = np.sqrt(x[3] + c @ c)
    return c, r


def base_colour(m):
    js, b = m['js'], m['bin']
    for im in js['images']:
        if im.get('name') == 'base':
            bv = js['bufferViews'][im['bufferView']]
            return np.asarray(Image.open(io.BytesIO(b[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])).convert('RGB')).astype(float) / 255


def compute(glb, ref=None, log=print):
    m = G.load(glb)
    pos, nrm = m['pos'], m['nrm']
    head_w = G.wsum(m, 'head', 'head_end', 'head_front')
    bind = m['bind']
    head_c = np.array([0.0, (bind['head'][1] + bind['head_end'][1]) / 2, bind['head'][2]])
    out = {'names': [], 'heads': [], 'tails': [], 'parents': [], 'weights': []}
    info = {}
    for side, guess in zip(('L', 'R'), BUN_GUESS):
        if ref is not None:
            c = ref[f'bun_{side}_c']
            r = float(ref[f'bun_{side}_r'])
        else:
            c = np.array(guess)
            for _ in range(4):
                d = pos - c
                dist = np.linalg.norm(d, axis=1)
                outward = (nrm * d).sum(1) / np.maximum(dist, 1e-9)
                sel = (dist < 0.075) & (head_w > 0.5) & (outward > 0.35)
                c, r = fit_sphere(pos[sel])
            info[f'bun_{side}_fit_verts'] = int(sel.sum())
        a = c - head_c
        a[1] *= 0.3  # mostly sideways / back, not up or down
        a /= np.linalg.norm(a)
        att = c - a * r
        tip = c + a * r * 0.9
        d = pos - att
        s = (d @ a) / (2 * r)
        dist = np.linalg.norm(pos - c, axis=1)
        w = smooth(0.12, 0.5, s) * (1 - smooth(1.08 * r, 1.32 * r, dist)) * np.clip(head_w, 0, 1)
        out['names'].append(f'bun_{side}')
        out['heads'].append(att)
        out['tails'].append(tip)
        out['parents'].append('head')
        out['weights'].append(w)
        info[f'bun_{side}'] = dict(centre=[round(float(x), 4) for x in c], radius=round(float(r), 4),
                                   verts=int((w > 0.01).sum()), full=int((w > 0.95).sum()))
        out[f'bun_{side}_c'] = c
        out[f'bun_{side}_r'] = r
    # ribbon: the mint bow at the collar (mint texels inside the collar box, in front of the chest)
    img = base_colour(m)
    H, W = img.shape[:2]
    # colour per triangle, sampled inside it (vertex UVs sit on island edges where the paint smears):
    # the bow is the DEEP mint (#79c5b0-ish); the cardigan below it is the light mint
    tri = m['tri']
    uvt = m['uv'][tri]
    samples = [uvt.mean(1)] + [(uvt[:, k] * 0.5 + uvt.mean(1) * 0.5) for k in range(3)]
    tc = np.mean([img[np.clip((s[:, 1] * H).astype(int), 0, H - 1), np.clip((s[:, 0] * W).astype(int), 0, W - 1)] for s in samples], 0)
    r_, g_, b_ = tc.T
    deep = (g_ - r_ > 0.15) & (b_ - r_ > 0.08) & (r_ < 0.585) & (g_ > 0.6)
    lo, hi = np.array(RIBBON_BOX[0]), np.array(RIBBON_BOX[1])
    tcen = pos[tri].mean(1)
    tin = np.all((tcen >= lo) & (tcen <= hi), axis=1) & deep
    rib = np.zeros(len(pos), bool)
    rib[np.unique(tri[tin])] = True
    rib &= head_w < 0.5
    inbox = np.all((pos >= lo) & (pos <= hi), axis=1)
    if ref is not None:
        knot, bottom = ref['ribbon_head'], ref['ribbon_tail']
    else:
        P = pos[rib]
        top = np.percentile(P[:, 1], 92)
        bot = np.percentile(P[:, 1], 3)
        knot = np.array([np.median(P[:, 0]), top, np.percentile(P[:, 2], 30)])
        bottom = np.array([knot[0], bot, knot[2] + 0.004])
    span = max(knot[1] - bottom[1], 1e-3)
    t = (knot[1] - pos[:, 1]) / span
    # grow the selection a little round the mint texels (verts of the same bow whose sample hit an edge)
    near = inbox & (np.abs(pos[:, 0] - knot[0]) < 0.035) & (pos[:, 2] > knot[2] - 0.02)
    wr = smooth(0.15, 0.85, t) * rib * 1.0
    out['names'].append('ribbon')
    out['heads'].append(knot)
    out['tails'].append(bottom)
    out['parents'].append('chest')
    out['weights'].append(wr)
    out['ribbon_head'] = knot
    out['ribbon_tail'] = bottom
    info['ribbon'] = dict(knot=[round(float(x), 4) for x in knot], bottom=[round(float(x), 4) for x in bottom],
                          mint_verts=int(rib.sum()), verts=int((wr > 0.01).sum()))
    log(f'[springs] {glb}: {json.dumps(info)}')
    return m, out, info


if __name__ == '__main__':
    glb, dst = sys.argv[1], sys.argv[2]
    ref = np.load(sys.argv[sys.argv.index('--ref') + 1]) if '--ref' in sys.argv else None
    m, out, info = compute(glb, ref)
    np.savez(dst, pos=m['pos'], names=np.array(out['names']), heads=np.array(out['heads']), tails=np.array(out['tails']),
             parents=np.array(out['parents']), weights=np.array(out['weights']),
             **{k: v for k, v in out.items() if k.startswith(('bun_', 'ribbon_'))})
    json.dump(info, open(dst.replace('.npz', '.json'), 'w'), indent=1)
    if '--debug' in sys.argv:
        import splat
        pre = sys.argv[sys.argv.index('--debug') + 1]
        Wsum = np.array(out['weights'])
        col = np.full((len(m['pos']), 3), 170.0)
        col[:, 0] += 85 * Wsum[0]
        col[:, 2] += 85 * Wsum[1]
        col[:, 1] += 85 * Wsum[2]
        col[:, 0] -= 120 * Wsum[1] + 120 * Wsum[2]
        col[:, 2] -= 120 * Wsum[0] + 120 * Wsum[2]
        col[:, 1] -= 120 * Wsum[0] + 120 * Wsum[1]
        box = ([-0.27, 0.40, -0.25], [0.27, 0.92, 0.25])
        tiles = [splat.render(m['pos'], m['tri'], np.clip(col, 0, 255), v, 500, box=box) for v in ('front', 'back', 'right')]
        sheet = Image.new('RGB', (1500, 500))
        for i, tl in enumerate(tiles):
            sheet.paste(tl, (500 * i, 0))
        sheet.save(pre + '_springs.png')

