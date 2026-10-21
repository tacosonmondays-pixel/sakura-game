"""Take a companion that was modelled into a Meshy figure off its girl (Kon off Ruri, Kaze off Hana).

    python3 tools/meshy/split_companion.py --glb public/models/characters/ruri.glb --bone kon
    python3 tools/meshy/split_companion.py --glb public/models/characters/hana.glb --bone kaze --mesh hana

Works on the shipped (packed) GLB in place of a rebuild, so everything that is not the companion stays
byte for byte: the skeleton (the companion's bone stays, unweighted, so the clips and joint count do not
change), every other vertex's position / normal / UV / skin weights, the clips, the textures and the
materials, asset.extras (eyes, unitScale ...). Only the body primitive's vertex and index data change.

Steps (bpy 4.2's mathutils BVH trees for the surface queries):
  1. select the companion: every face touching a vertex skinned to --bone (the import rigged him 100 %
     to his own bone), his loose fragments (small welded islands in his box), and his paws / tail root
     fused into her: pale (white / holo cyan) faces next to him that stand off her mirrored other side;
     then the dangling faces left on the cut
  2. find the holes this leaves (welded boundary loops made mostly of new edges) and close each one with
     a disc: rings eased from the rim to its centre, the rim kept as her own vertices, the inner points
     relaxed and then eased onto the mirrored other side of her body (faded in from the rim), so a cap on
     a round sleeve is round too. The disc's winding follows her faces round the hole.
  3. cap attributes: rim corners keep her own normal and skin weights (no crack when she moves), inner
     points take the disc's normals and inverse-distance weights from the rim; texture: one even texel
     of the cloth or hair round the hole for the whole cap (Ruri: her armband's navy along its stretch of
     the arm, PROFILES), so a cap never reads a neighbouring chart or his leftover glow
  4. write the primitive back with the same quantisation (int16 positions, int8 normals, uint16 UVs,
     uint8 joints / weights); unused vertices are dropped, identical cap corners share one vertex

Prints the counts; writes --out (default: over --glb). Needs bpy 4.2 + numpy + Pillow."""
import argparse
import io
import json
import os
import struct
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from lib.pack import read_glb, CT, NCOMP  # noqa: E402


# ---------------------------------------------------------------- GLB helpers
def raw_accessor(js, binc, idx):
    acc = js['accessors'][idx]
    bv = js['bufferViews'][acc['bufferView']]
    dt = CT[acc['componentType']]
    n = NCOMP[acc['type']]
    start = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
    stride = bv.get('byteStride', 0)
    item = np.dtype(dt).itemsize * n
    if stride and stride != item:
        raw = np.frombuffer(binc, np.uint8, count=stride * acc['count'], offset=start).reshape(acc['count'], stride)
        return np.frombuffer(raw[:, :item].tobytes(), dt).reshape(acc['count'], n).copy()
    return np.frombuffer(binc, dt, count=acc['count'] * n, offset=start).reshape(acc['count'], n).copy()


def encode(js, idx, arr):
    acc = js['accessors'][idx]
    bv = js['bufferViews'][acc['bufferView']]
    dt = CT[acc['componentType']]
    n = NCOMP[acc['type']]
    arr = np.ascontiguousarray(arr.astype(dt).reshape(-1, n))
    stride = bv.get('byteStride', 0)
    item = arr.dtype.itemsize * n
    if stride and stride != item:
        out = np.zeros((len(arr), stride), np.uint8)
        out[:, :item] = arr.view(np.uint8).reshape(len(arr), item)
        return out.tobytes()
    return arr.tobytes()


def write_glb(path, js, binc):
    jb = json.dumps(js, separators=(',', ':')).encode()
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    binc = binc + b'\0' * ((4 - len(binc) % 4) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(binc)))
        f.write(struct.pack('<II', len(jb), 0x4E4F534A))
        f.write(jb)
        f.write(struct.pack('<II', len(binc), 0x004E4942))
        f.write(binc)


def replace_primitive(js, binc, mesh_index, attrs, indices):
    """New data for one primitive; every buffer view keeps its place and order, the others their bytes."""
    prim = js['meshes'][mesh_index]['primitives'][0]
    newbytes = {}
    for name, arr in attrs.items():
        ai = prim['attributes'][name]
        acc = js['accessors'][ai]
        newbytes[acc['bufferView']] = encode(js, ai, arr)
        acc['count'] = len(arr)
        if 'min' in acc or name == 'POSITION':
            acc['min'] = [int(v) for v in arr.min(0)]
            acc['max'] = [int(v) for v in arr.max(0)]
    ii = prim['indices']
    acc = js['accessors'][ii]
    if len(next(iter(attrs.values()))) > 65535 and acc['componentType'] == 5123:
        raise SystemExit('too many vertices for uint16 indices')
    newbytes[acc['bufferView']] = encode(js, ii, indices.reshape(-1, 1))
    acc['count'] = int(indices.size)
    if 'min' in acc:
        acc['min'], acc['max'] = [int(indices.min())], [int(indices.max())]
    out = bytearray()
    for vi, bv in enumerate(js['bufferViews']):
        data = newbytes.get(vi)
        if data is None:
            data = binc[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
        out += b'\0' * ((4 - len(out) % 4) % 4)
        bv['byteOffset'] = len(out)
        bv['byteLength'] = len(data)
        out += data
    js['buffers'][0]['byteLength'] = len(out)
    return js, bytes(out)


def base_colour(js, binc, prim):
    from PIL import Image
    mat = js['materials'][prim['material']]
    ti = mat['pbrMetallicRoughness']['baseColorTexture']['index']
    tex = js['textures'][ti]
    src = tex.get('extensions', {}).get('EXT_texture_webp', {}).get('source', tex.get('source'))
    bv = js['bufferViews'][js['images'][src]['bufferView']]
    data = binc[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
    return np.asarray(Image.open(io.BytesIO(data)).convert('RGB')).astype(int)


# ---------------------------------------------------------------- mesh helpers
def weld(P, q=20000):
    _, inv = np.unique(np.round(P * q).astype(np.int64), axis=0, return_inverse=True)
    return inv.ravel()


def components(F, n):
    par = np.arange(n)

    def find(x):
        r = x
        while par[r] != r:
            r = par[r]
        while par[x] != r:
            par[x], x = r, par[x]
        return r
    for a, b, c in F:
        for u, v in ((a, b), (b, c)):
            ru, rv = find(u), find(v)
            if ru != rv:
                par[ru] = rv
    return np.array([find(x) for x in range(n)])


def nearest(Q, R, chunk=2048):
    Q = np.asarray(Q, np.float64)
    R = np.asarray(R, np.float64)
    rr = (R * R).sum(1)
    idx = np.empty(len(Q), np.int64)
    dist = np.empty(len(Q))
    for s in range(0, len(Q), chunk):
        q = Q[s:s + chunk]
        d2 = (q * q).sum(1)[:, None] - 2 * q @ R.T + rr[None, :]
        k = d2.argmin(1)
        idx[s:s + chunk] = k
        dist[s:s + chunk] = np.sqrt(np.maximum(d2[np.arange(len(q)), k], 0))
    return idx, dist


# ---------------------------------------------------------------- the split
def boundary_loops(F):
    """directed boundary loops of a triangle list (vertex ids); a vertex met twice splits the walk."""
    from collections import defaultdict
    cnt = defaultdict(int)
    for a, b, c in F:
        for u, v in ((a, b), (b, c), (c, a)):
            cnt[(u, v)] += 1
    nxt = defaultdict(list)
    for (u, v), k in cnt.items():
        if (v, u) not in cnt:
            nxt[u].append(v)
    loops = []
    for s0 in list(nxt):
        while nxt[s0]:
            L = [s0]
            x = nxt[s0].pop()
            while x != s0 and nxt.get(x):
                L.append(x)
                x = nxt[x].pop()
            if x == s0 and len(L) >= 3:
                loops.append(L)
    return loops


def cap_loop(PL, rings):
    """a disc for one hole: rings eased from the rim to the centre, triangulated; the rim keeps its
    order (her faces run rim[k] -> rim[k+1], so the cap runs the other way). Returns (points, tris,
    is_rim index or -1)."""
    n = len(PL)
    cen = PL.mean(0)
    pts = [p for p in PL]
    rim = list(range(n))
    tris = []
    prev = list(range(n))
    for k in range(1, rings):
        t = k / rings
        cur = []
        for i in range(n):
            pts.append(PL[i] * (1 - t) + cen * t)
            cur.append(len(pts) - 1)
        for i in range(n):
            i2 = (i + 1) % n
            a, b, c, d = prev[i], prev[i2], cur[i2], cur[i]
            tris.append((b, a, d))
            tris.append((b, d, c))
        prev = cur
    pts.append(cen)
    ci = len(pts) - 1
    for i in range(n):
        tris.append((prev[(i + 1) % n], prev[i], ci))
    return np.array(pts), np.array(tris), rim


def split(path, out, bone, mesh_name=None, protrude=0.007, band=None, relax=40, log=print):
    import bpy  # noqa: F401  (mathutils comes with the bpy module)
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree

    js, binc = read_glb(path)
    mi = len(js['meshes']) - 1 if mesh_name is None else [m['name'] for m in js['meshes']].index(mesh_name)
    prim = js['meshes'][mi]['primitives'][0]
    raw = {k: raw_accessor(js, binc, v) for k, v in prim['attributes'].items()}
    I = raw_accessor(js, binc, prim['indices']).reshape(-1, 3).astype(np.int64)
    P = raw['POSITION'].astype(np.float64) / 32767.0
    N = raw['NORMAL'].astype(np.float64) / 127.0
    UV = raw['TEXCOORD_0'].astype(np.float64) / 65535.0
    J = raw['JOINTS_0'].astype(np.int64)
    W = raw['WEIGHTS_0'].astype(np.float64) / 255.0
    names = [js['nodes'][j]['name'] for j in js['skins'][0]['joints']]
    bi = names.index(bone)
    img = base_colour(js, binc, prim)
    h, w = img.shape[:2]
    FLIP = np.array([-1.0, 1, 1])

    def colour(uv):
        x = np.clip((uv[:, 0] * w).astype(int), 0, w - 1)
        y = np.clip((uv[:, 1] * h).astype(int), 0, h - 1)
        return img[y, x]

    def tree_of(pts, faces):
        return BVHTree.FromPolygons([Vector(p) for p in pts], [tuple(int(x) for x in t) for t in faces], all_triangles=True)

    def nearest_face(tree, q):
        hit = tree.find_nearest(Vector(q))
        return (None, 1e9, None) if hit[0] is None else (hit[2], hit[3], np.array(hit[0]))

    # ---- 1. what goes: him, his loose bits, and his paws / tail root fused into her
    on_bone = np.where(J == bi, W, 0).sum(1) > 0.5
    side = np.sign(P[on_bone, 0].mean())
    wid = weld(P)
    nw = wid.max() + 1
    C = P[I].mean(1)
    bone_f = on_bone[I].any(1)
    _, dk = nearest(C, P[on_bone])
    dom = J[I[:, 0], np.argmax(W[I[:, 0]], 1)]
    hairish = np.isin(dom, [k for k, n in enumerate(names) if n.startswith(('hair', 'head', 'braid', 'neck'))])
    this_side = C[:, 0] * side > 0.004
    other_f = np.flatnonzero((C[:, 0] * side < -0.004) & ~bone_f)
    mtree = tree_of(P * FLIP, I[other_f][:, ::-1])
    col = colour(UV[I].mean(1))
    r, g, b = col.T
    pale = (np.minimum(np.minimum(r, g), b) > 150) | ((b > r + 25) & (g > r + 10) & (r > 110))
    lo, hi = P[on_bone].min(0) - 0.03, P[on_bone].max(0) + 0.03
    near_box = ((C > lo) & (C < hi)).all(1)
    cand = np.flatnonzero(pale & near_box & ~bone_f & ~hairish & this_side & (dk < 0.04))
    gap = np.array([nearest_face(mtree, C[k])[1] for k in cand])
    trim = np.zeros(len(I), bool)
    trim[cand[gap > protrude]] = True
    kill = bone_f | trim
    comp = components(wid[I[~kill]], nw)
    cf = np.full(len(I), -1)
    cf[~kill] = comp[wid[I[~kill, 0]]]
    ids, cnt = np.unique(cf[~kill], return_counts=True)
    frag = np.zeros(len(I), bool)
    for c, k in zip(ids, cnt):
        m = cf == c
        if k < 300 and near_box[m].mean() > 0.5 and dk[m].min() < 0.03:
            frag |= m
    kill |= frag
    # dangling faces on the cut (two or three open edges): erode
    for _ in range(3):
        Fw = wid[I[~kill]]
        e = np.sort(np.stack([Fw[:, [0, 1]], Fw[:, [1, 2]], Fw[:, [2, 0]]], 1).reshape(-1, 2), 1)
        u, inv, ec = np.unique(e[:, 0] * nw + e[:, 1], return_inverse=True, return_counts=True)
        openc = (ec[inv] == 1).reshape(-1, 3).sum(1)
        idx = np.flatnonzero(~kill)
        dang = (openc >= 2) & near_box[idx] & (dk[idx] < 0.04)
        if not dang.any():
            break
        kill[idx[dang]] = True
    log(f'[split] {os.path.basename(path)}: {on_bone.sum()} verts on {bone}; faces removed {kill.sum()} '
        f'(him {bone_f.sum()}, fused paws / tail root {trim.sum()}, fragments {frag.sum()})')

    # ---- 2. the holes he leaves, each closed with a disc eased onto her mirrored other side
    keepF = I[~kill]
    WP = np.zeros((nw, 3))
    WP[wid] = P
    rep = np.zeros(nw, np.int64)
    rep[wid[keepF.ravel()]] = keepF.ravel()
    orig_open = {tuple(sorted(e)) for L in boundary_loops(wid[I]) for e in zip(L, L[1:] + L[:1])}
    loops = [L for L in boundary_loops(wid[keepF])
             if sum(tuple(sorted(e)) not in orig_open for e in zip(L, L[1:] + L[:1])) > len(L) // 2]
    log(f'[split] holes: {sorted((len(L) for L in loops), reverse=True)}')
    keep_idx = np.flatnonzero(~kill)
    khair = hairish[keep_idx]
    ktrees = {hv: (keep_idx[khair == hv], tree_of(P, I[keep_idx[khair == hv]])) for hv in (False, True)}
    ohair = hairish[other_f]
    mtrees = {hv: (other_f[ohair == hv], tree_of(P * FLIP, I[other_f[ohair == hv]][:, ::-1])) for hv in (False, True)}
    kcol = colour(UV[I].mean(1)).astype(float)
    alltree = tree_of(P, keepF)
    band_tex = None
    if band:
        ibm = raw_accessor(js, binc, js['skins'][0]['inverseBindMatrices']).astype(np.float64).reshape(-1, 4, 4)

        def joint_pos(nm):
            return np.linalg.inv(ibm[names.index(nm)].T)[:3, 3]
        a0, a1 = joint_pos(band['from']), joint_pos(band['to'])
        band_o, band_d = a0, (a1 - a0) / np.linalg.norm(a1 - a0)
        armw = np.isin(dom, [names.index(n) for n in band['joints']])
        navy = (b > r + 30) & (r < 110)
        band_tex = np.flatnonzero(navy & armw & ~kill & this_side & (dk < band['reach']))
        tpar = (C[band_tex] - band_o) @ band_d
        band_lo, band_hi = tpar.min(), tpar.max()
        log(f'[split] band: {len(band_tex)} faces of hers, {band_lo:.3f}..{band_hi:.3f} along the arm')

    newP, newN, newUV, newJ, newW, newT = [], [], [], [], [], []
    cap_tris = 0
    for L in loops:
        PL = WP[L]
        n = len(L)
        perim = np.linalg.norm(np.roll(PL, -1, 0) - PL, axis=1).sum()
        rings = int(np.clip(round(perim / 0.03), 1, 5)) if n > 4 else 1
        pts, tris, rim = cap_loop(PL, rings)
        # relax the inner points (rim fixed), then ease them onto the mirrored other side
        from collections import defaultdict
        adj = defaultdict(set)
        for a, b2, c in tris:
            adj[a] |= {b2, c}
            adj[b2] |= {a, c}
            adj[c] |= {a, b2}
        inner = [k for k in range(len(pts)) if k >= n]
        depth = {k: 0 for k in range(n)}
        front = list(range(n))
        while front:
            nxt = []
            for x in front:
                for y in adj[x]:
                    if y not in depth:
                        depth[y] = depth[x] + 1
                        nxt.append(y)
            front = nxt
        for _ in range(relax):
            for k in inner:
                pts[k] = pts[k] * 0.3 + np.mean([pts[y] for y in adj[k]], 0) * 0.7
        for k in inner:
            f, d, loc = nearest_face(mtree, pts[k])
            if f is not None and d < 0.02:
                t = min(1.0, depth[k] / 2.0) * 0.85
                pts[k] = pts[k] * (1 - t) + loc * t
        for _ in range(3):
            for k in inner:
                pts[k] = pts[k] * 0.6 + np.mean([pts[y] for y in adj[k]], 0) * 0.4
        # rim attributes (her own: no crack when she moves); inner: smooth normals, weights from the rim
        ro = [rep[x] for x in L]
        fn = np.cross(pts[tris[:, 1]] - pts[tris[:, 0]], pts[tris[:, 2]] - pts[tris[:, 0]])
        vn = np.zeros_like(pts)
        for t3, nrm in zip(tris, fn):
            vn[t3] += nrm
        Nn = vn / np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)
        # (the disc's winding follows her faces round the hole, so it is never turned round; its own
        # normals only light the inner points, and they face her side's way)
        if (Nn[:n] * N[ro]).sum() < 0:
            Nn = -Nn
        Nn[:n] = N[ro]
        Jn = np.zeros((len(pts), 4), np.int64)
        Wn = np.zeros((len(pts), 4))
        Jn[:n], Wn[:n] = J[ro], W[ro]
        for k in inner:
            d = np.linalg.norm(PL - pts[k], axis=1)
            acc = {}
            for ii in np.argsort(d)[:6]:
                for jj, ww in zip(J[ro[ii]], W[ro[ii]]):
                    if ww > 0:
                        acc[jj] = acc.get(jj, 0) + ww / max(d[ii], 1e-4)
            top = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
            s = sum(x for _, x in top)
            for q, (jj, ww) in enumerate(top):
                Jn[k, q], Wn[k, q] = jj, ww / s
        # texture: one clean texel per cap, the colour of the faces round it (a sleeve cap is plain sleeve,
        # a hair cap plain hair); on her armband's stretch of the arm, the armband's navy. A constant UV
        # never reads a neighbouring chart or his leftover glow, and the normal map stays flat there.
        rimf = [keep_idx[f] for f in (alltree.find_nearest(Vector(p))[2] for p in PL) if f is not None]
        hv = bool(hairish[rimf].mean() > 0.5)
        ring = np.array(sorted({f for f in rimf if hairish[f] == hv and not trim[f]})) if rimf else np.zeros(0, int)
        if len(ring) == 0:
            ring = np.array(rimf)

        def clean_uv(faces, dark=False):
            """the face centre whose 7x7 texels are the most even and nearest the faces' median colour
            (dark: the median of the darker half, for the armband's navy rather than its grey edging)"""
            cc = kcol[faces]
            med = np.median(cc[cc.sum(1) <= np.median(cc.sum(1))], 0) if dark else np.median(cc, 0)
            best, bs = None, 1e18
            for f in faces:
                u0 = UV[I[f]].mean(0)
                x, y = int(u0[0] * w), int(u0[1] * h)
                win = img[max(0, y - 3):y + 4, max(0, x - 3):x + 4].reshape(-1, 3)
                sc = win.std(0).sum() * 2 + np.abs(win.mean(0) - med).sum()
                if sc < bs:
                    best, bs = u0, sc
            return best
        uv_plain = clean_uv(ring)
        uv_band = None
        if band_tex is not None and not hv:
            uv_band = clean_uv(band_tex, dark=True)
        for t3 in tris:
            tp = pts[t3]
            cen = tp.mean(0)
            inb = uv_band is not None and band_lo <= (cen - band_o) @ band_d <= band_hi
            uv = np.repeat((uv_band if inb else uv_plain)[None], 3, 0)
            base = sum(len(x) for x in newP)
            newP.append(tp); newN.append(Nn[t3]); newUV.append(uv); newJ.append(Jn[t3]); newW.append(Wn[t3])
            newT.append(np.arange(base, base + 3))
            cap_tris += 1
        # the rim corners take her exact stored position (bit-identical to her vertices)
    log(f'[split] caps: {len(loops)} holes, {cap_tris} triangles')

    # ---- 3. assemble and write back
    used = np.unique(keepF)
    remap = -np.ones(len(P), np.int64)
    remap[used] = np.arange(len(used))
    n0 = len(used)
    attrs = {k: v[used] for k, v in raw.items()}
    if newP:
        allP = np.concatenate(newP, 0)
        allW = np.concatenate(newW, 0)
        wq = np.round(allW * 255).astype(np.int64)
        wq[np.arange(len(wq)), wq.argmax(1)] += 255 - wq.sum(1)
        allN = np.concatenate(newN, 0)
        add = {
            'POSITION': np.clip(np.round(allP * 32767), -32767, 32767),
            'NORMAL': np.clip(np.round(allN / np.maximum(np.linalg.norm(allN, axis=1, keepdims=True), 1e-9) * 127), -127, 127),
            'TEXCOORD_0': np.clip(np.round(np.concatenate(newUV, 0) * 65535), 0, 65535),
            'JOINTS_0': np.concatenate(newJ, 0),
            'WEIGHTS_0': wq,
        }
        # the caps' corners share a vertex wherever every stored attribute is the same
        add = {k: add[k].astype(attrs[k].dtype) for k in attrs}
        key = np.concatenate([add[k].reshape(len(allP), -1).astype(np.int64) for k in sorted(add)], 1)
        _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
        order = np.argsort(first)
        rank = np.empty_like(order)
        rank[order] = np.arange(len(order))
        add = {k: v[first[order]] for k, v in add.items()}
        attrs = {k: np.concatenate([v, add[k]], 0) for k, v in attrs.items()}
        ind = np.concatenate([remap[keepF], rank[inv.ravel()][np.array(newT)] + n0], 0)
    else:
        ind = remap[keepF]
    Pq = attrs['POSITION'].astype(np.float64) / 32767.0
    left = [L for L in boundary_loops(weld(Pq)[ind.reshape(-1, 3)]) if len(L) > 2]
    before = len([L for L in boundary_loops(wid[I]) if len(L) > 2])
    log(f'[split] open boundary loops: {before} in her before, {len(left)} after')
    js, newbin = replace_primitive(js, binc, mi, attrs, ind.ravel())
    write_glb(out, js, newbin)
    info = dict(vertices=sum(js['accessors'][p['attributes']['POSITION']]['count'] for m in js['meshes'] for p in m['primitives']),
                triangles=sum(js['accessors'][p['indices']]['count'] // 3 for m in js['meshes'] for p in m['primitives']),
                size=os.path.getsize(out))
    log(f'[split] wrote {out}: {info}')
    return info


# per companion: Ruri's committee armband (navy, gold book badge) sits on her left upper arm under Kon's
# paws, so the cap there runs the armband on round the arm instead of the plain mirrored sleeve
PROFILES = {
    'kon': dict(band=dict(**{'from': 'upper_arm_L', 'to': 'forearm_L'}, joints=('shoulder_L', 'upper_arm_L', 'forearm_L'), reach=0.03)),
    'kaze': dict(),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--glb', required=True)
    ap.add_argument('--bone', required=True, help="the companion's own bone (kon, kaze)")
    ap.add_argument('--mesh', default=None, help='mesh name of the body (default: the last mesh)')
    ap.add_argument('--out', default=None)
    a = ap.parse_args()
    split(a.glb, a.out or a.glb, a.bone, a.mesh, **PROFILES.get(a.bone, {}))


if __name__ == '__main__':
    main()
    sys.stdout.flush()
    os._exit(0)
