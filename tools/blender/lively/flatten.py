"""Offline flatten of a painted Meshy girl's base colour (PLAN §5.2 TX2; rollout step 1 = Noa).

    python flatten.py <glb> <out_prefix> [--debug]
    (also imported by the Blender build: flatten(glb_path) -> dict)

numpy + Pillow only: no render engine, no Cycles, nothing generated. Steps:
 1. rasterise her triangles into UV space (which texel belongs to which triangle, barycentrics), so every
    texel knows its 3D bind-pose position and skin weights
 2. label every texel with the nearest colour of her house palette (OKLab, lightness counted at 0.6 so baked
    light and shade fall into one material), but only among the colours allowed where the texel sits
    (head / body / legs / feet): dark creases in her hair can never become loafer brown
 3. a 5x5 mode filter inside each UV island, then labels per triangle smoothed over the welded mesh
    adjacency: same-label patches smaller than a speck (on either side of a UV seam) join their neighbours,
    except small parts that are real (gold buttons, sakura pins); triangles that are mostly one label take it
 4. the skirt (found geometrically, as livelySkirt.js does, between the knee band and the blazer hem,
    outside the legs, minus the pouch) loses its plaid: one solid soft grey, with one mint line following
    the real (pleated) hem edge
 5. every label is drawn in its house value (caramel #D7A174, blazer #928CA5, mint #ADDDC2, skin #FCE6D3,
    ...): the region colours are fixed per girl (the LOD gets the very same colours)
 6. her face is protected: inside the eye boxes (asset extras.eyes) and the face around them, only skin and
    hair snap (softly, by how close the paint is to skin); lashes, irises, highlights, brows, mouth and
    blush keep their paint, shifted by the same skin change so the blush blends into the new skin
 7. islands dilated by 8 px (mip bleed). Writes <prefix>_base_flat.png and metrics."""
import io
import json
import os
import sys
import time

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import MESHY_TOOLS, NOA, GIRLS, MESHY_CLIPS  # noqa: E402,F401
sys.path.insert(0, MESHY_TOOLS)
import flatlib as F  # noqa: E402
import glbmesh as G  # noqa: E402

# ------------------------------------------------------------------ Noa's profile
# flat: the colour drawn; src: what that material looks like in the painted texture (lit and shaded);
# where: regions it may appear in (head = head-weighted, body = torso / arms / hips above the skirt,
# legs = below the skirt, feet = shoes)
NOA = dict(
    palette={
        'hair': dict(flat='#D7A174', src=['#9e673d', '#c0905e', '#a67345', '#b08358', '#d4a877', '#7a4a2a'], where={'head'}),
        'skin': dict(flat='#FCE6D3', src=['#fcd2c7', '#fbcfc6', '#fcd4c9', '#f7c3bc', '#ead2cf'], where={'head', 'body'}),
        'pink': dict(flat='#DE9DAC', src=['#e2a1aa', '#f0b4c0', '#d98a9c'], where={'head', 'body'}),
        'blazer': dict(flat='#928CA5', src=['#8c8d98', '#8a8a93', '#8e8e99', '#8d8c97', '#868c92', '#6e6f7a', '#a9a7b6'], where={'body', 'head_low'}),
        'mint': dict(flat='#ADDDC2', src=['#a0decb', '#c0e9de', '#b4e6d6'], where={'body'}),
        'mint_deep': dict(flat='#86D0B9', src=['#79c5b0', '#7cd0ba', '#5fb39c'], where={'body', 'head_low'}),
        'shield_light': dict(flat='#C6F4EA', src=['#a7f5e6', '#bdf8f3', '#d5f5ee', '#94e6d8'], where={'body'}),
        'white': dict(flat='#FAFAF8', src=['#f4fbfb', '#faf9f9', '#ebeaec', '#f4f4f6', '#e0e2e6'], where={'body', 'head_low'}),
        'armband': dict(flat='#E8B4CB', src=['#e5b0c9', '#d99fbb'], where={'body'}),
        'gold': dict(flat='#E2BA6A', src=['#c9a45a', '#e0c070', '#b08840'], where={'body'}),
        'tights': dict(flat='#A99FB8', src=['#a194ae', '#a398b0', '#8c7581', '#725a64'], where={'legs', 'body'}),
        'loafer': dict(flat='#5E372A', src=['#562e24', '#351e13', '#280e09', '#582f23', '#31170d'], where={'legs', 'feet'}),
    },
    small_ok={'gold', 'pink', 'white', 'mint_deep', 'armband'},  # real small parts: never merged away as specks
    skirt=dict(flat='#C4C3CB', hem='#8FD3BC', top_y=0.290, hem_band=(0.0075, 0.0165), pouch=([-0.235, 0.235, -0.075], [-0.115, 0.330, 0.085])),
    feet_y=0.062,
    head_low_y=0.53,
    skin_flat='#FCE6D3', skin_low='#FCE6D3',  # one lid colour: the flat skin has no lower shade (a darker lower lid showed as a box round a closed eye)
    l_weight=0.6,
)


def load_base(m, name='base'):
    js, b = m['js'], m['bin']
    for im in js['images']:
        if im.get('name') == name:
            bv = js['bufferViews'][im['bufferView']]
            raw = b[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
            return np.asarray(Image.open(io.BytesIO(raw)).convert('RGB')).astype(np.float64) / 255.0
    raise KeyError(name)


def seg_dist(p, a, b):
    ab = b - a
    t = np.clip(((p - a) @ ab) / max(1e-12, ab @ ab), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)


def flatten(glb, profile=NOA, debug_prefix=None, log=print):
    t0 = time.time()
    m = G.load(glb)
    img = load_base(m)
    H, W = img.shape[:2]
    tri, pos = m['tri'], m['pos']
    fid, bary = F.raster(m['uv'], tri, W, H)
    cov = fid >= 0
    iy, ix = np.nonzero(cov)
    f_t = fid[cov]
    p3 = F.texel_attr(fid, bary, tri, pos)
    Wt = F.texel_attr(fid, bary, tri, m['W'])
    names = m['names']

    def wsum(*bs):
        return Wt[:, [names.index(b) for b in bs if b in names]].sum(1)
    col = img[cov]
    lab0 = F.lin_to_oklab(F.srgb_to_lin(col))
    N = len(col)
    bind = m['bind']
    eyes = m['extras'].get('eyes')

    # ---- regions
    head = wsum('head', 'head_end', 'head_front') >= 0.5
    y = p3[:, 1]
    feet = (y < profile['feet_y']) & ~head
    sk = profile['skirt']
    hips, thL, thR, knL, knR, ftL, ftR = (bind[n] for n in ('hips', 'thigh_L', 'thigh_R', 'shin_L', 'shin_R', 'foot_L', 'foot_R'))
    kneeY = (knL[1] + knR[1]) / 2
    legL = hips[1] - kneeY
    # leg radius from the calves (as livelySkirt.js): shin-weighted vertices just below the knee
    Wv = m['W']
    shinv = Wv[:, [names.index('shin_L'), names.index('shin_R')]].sum(1)
    vy = pos[:, 1]
    calf = (vy < kneeY - 0.05 * legL) & (vy > kneeY - 0.4 * legL) & (shinv > 0.6)
    cd = np.minimum(seg_dist(pos[calf], knL, ftL), seg_dist(pos[calf], knR, ftR))
    legR = np.sort(cd)[int(len(cd) * 0.6)] * 1.35
    dleg = np.minimum.reduce([seg_dist(p3, thL, knL), seg_dist(p3, thR, knR), seg_dist(p3, knL, ftL), seg_dist(p3, knR, ftR)])
    armw = wsum('upper_arm_L', 'upper_arm_R', 'forearm_L', 'forearm_R', 'hand_L', 'hand_R')
    bodyw = wsum('hips', 'root', 'spine', 'spine1', 'thigh_L', 'thigh_R')
    pb0, pb1 = np.array(sk['pouch'][0]), np.array(sk['pouch'][1])
    pouch = np.all((p3 >= pb0) & (p3 <= pb1), axis=1)
    skirt_c = ((y <= sk['top_y'] + 0.01) & (y >= kneeY - 0.3 * legL) & (dleg >= legR * 1.15 + 0.02 * legL)
               & (bodyw >= 0.85) & (armw < 0.3) & ~head & ~pouch)
    # whole UV islands decide near the blazer hem (the hem is a crease: islands rarely cross it)
    tisl = F.islands(tri, len(pos))
    isl_t = tisl[f_t]
    sc = np.bincount(isl_t, weights=skirt_c.astype(float), minlength=tisl.max() + 1)
    tot = np.bincount(isl_t, minlength=tisl.max() + 1)
    isl_share = sc[isl_t] / np.maximum(tot[isl_t], 1)
    skirt = skirt_c & ((y <= sk['top_y'] - 0.004) | (isl_share >= 0.5))
    # legs: below the skirt top, near the leg axes (tights + the loafers' tops)
    legs = (y < sk['top_y']) & (dleg < legR * 1.6 + 0.02 * legL) & ~skirt & ~head & ~feet & (armw < 0.3) & ~pouch
    body = ~head & ~feet & ~legs
    region = {'head': head, 'body': body, 'legs': legs, 'feet': feet, 'head_low': head & (y < profile['head_low_y'])}

    # ---- labels: nearest allowed palette source colour (lightness counted at l_weight)
    P = profile['palette']
    keys = list(P)
    lw = np.array([profile['l_weight'], 1, 1])
    best = np.full(N, np.inf)
    lbl = np.full(N, -1, np.int32)
    for k, key in enumerate(keys):
        allowed = np.zeros(N, bool)
        for r in P[key]['where']:
            allowed |= region[r]
        S = np.array([F.hex_to_lab(h) for h in P[key]['src']])
        d = np.sqrt((((lab0[:, None, :] - S[None]) * lw) ** 2).sum(-1)).min(1)
        d = np.where(allowed, d, np.inf)
        upd = d < best
        best[upd] = d[upd]
        lbl[upd] = k
    # texels with no allowed colour (should not happen): nearest of all
    if (lbl < 0).any():
        log('[flatten] unlabelled texels', int((lbl < 0).sum()))
        lbl[lbl < 0] = 0

    # ---- 5x5 mode filter inside UV islands (2 passes)
    L2 = np.full((H, W), -1, np.int32)
    L2[cov] = lbl
    I2 = np.full((H, W), -2, np.int64)
    I2[cov] = isl_t
    L2 = F.mode_filter(L2, cov, I2, r=2, nlab=len(keys), passes=2)
    lbl_m = L2[cov]

    # ---- per-triangle labels, smoothed over the welded mesh adjacency
    T = len(tri)
    hist = np.zeros((T, len(keys)))
    np.add.at(hist, (f_t, lbl_m), 1)
    has = hist.sum(1) > 0
    flab = hist.argmax(1)
    purity = np.where(has, hist.max(1) / np.maximum(hist.sum(1), 1), 0)
    area = 0.5 * np.linalg.norm(np.cross(pos[tri[:, 1]] - pos[tri[:, 0]], pos[tri[:, 2]] - pos[tri[:, 0]]), axis=1)
    nb = F.face_adjacency(pos, tri)
    # triangles with no texels (degenerate in UV) take their neighbours' label
    small_ok = {keys.index(k) for k in profile['small_ok'] if k in keys}
    relab = np.zeros(T, bool)
    A_MIN = 2.5e-5  # stored units^2 (~5 mm square at stored scale; ~0.35 % of her height on a side)
    for it in range(3):
        # connected same-label components
        comp = -np.ones(T, np.int64)
        cid = 0
        for s in range(T):
            if comp[s] >= 0:
                continue
            stack = [s]
            comp[s] = cid
            while stack:
                u = stack.pop()
                for v in nb[u]:
                    if comp[v] < 0 and flab[v] == flab[s]:
                        comp[v] = cid
                        stack.append(v)
            cid += 1
        carea = np.bincount(comp, weights=area, minlength=cid)
        changed = 0
        for c in np.nonzero(carea < A_MIN)[0]:
            faces = np.nonzero(comp == c)[0]
            l0 = flab[faces[0]]
            if l0 in small_ok:
                continue
            votes = np.zeros(len(keys))
            for u in faces:
                for v in nb[u]:
                    if comp[v] != c:
                        votes[flab[v]] += area[v]
            if votes.max() <= 0:
                continue
            nl = int(votes.argmax())
            if nl != l0:
                flab[faces] = nl
                relab[faces] = True
                changed += 1
        log(f'[flatten] speck pass {it}: {changed} patches merged ({cid} patches)')
        if not changed:
            break
    face_take = relab | (purity >= 0.75)
    lbl_f = np.where(face_take[f_t], flab[f_t], lbl_m)

    # ---- colours
    flat_lab = np.array([F.hex_to_lab(P[k]['flat']) for k in keys])
    out_lab = flat_lab[lbl_f].copy()
    # skirt: solid soft grey + one mint line along the real hem edge
    sk_lab = F.hex_to_lab(sk['flat'])
    hem_lab = F.hex_to_lab(sk['hem'])
    out_lab[skirt] = sk_lab
    # hem edge: boundary edges of the welded mesh among skirt triangles near the bottom
    key = np.round(pos / 1e-5).astype(np.int64)
    _, weld = np.unique(key, axis=0, return_inverse=True)
    weld = weld.ravel()
    skirt_tri = np.zeros(T, bool)
    skirt_tri[np.unique(f_t[skirt])] = True
    ecount = {}
    for t in np.nonzero(skirt_tri)[0]:
        a, b, c = weld[tri[t]]
        for e in ((a, b), (b, c), (c, a)):
            k2 = (min(e), max(e))
            ecount[k2] = ecount.get(k2, 0) + 1
    # all triangles' edge counts (a boundary of the skirt patch that is an open mesh edge)
    allc = {}
    for t in range(T):
        a, b, c = weld[tri[t]]
        for e in ((a, b), (b, c), (c, a)):
            k2 = (min(e), max(e))
            allc[k2] = allc.get(k2, 0) + 1
    wpos = np.zeros((weld.max() + 1, 3))
    wpos[weld] = pos
    sy = p3[skirt, 1]
    hem_guess = np.percentile(sy, 2)
    bverts = sorted({v for e, n in ecount.items() if allc.get(e, 0) == 1 for v in e})
    bverts = [v for v in bverts if wpos[v][1] < hem_guess + 0.035]
    hem_info = dict(boundary_verts=len(bverts), hem_guess=round(float(hem_guess), 4))
    if len(bverts) >= 12:
        bp = wpos[bverts]
        th = np.arctan2(bp[:, 0] - hips[0], bp[:, 2] - hips[2])
        o = np.argsort(th)
        th_s, y_s = th[o], bp[o, 1]
        thx = np.concatenate([th_s - 2 * np.pi, th_s, th_s + 2 * np.pi])
        yx = np.concatenate([y_s, y_s, y_s])
        tt = np.arctan2(p3[skirt, 0] - hips[0], p3[skirt, 2] - hips[2])
        yh = np.interp(tt, thx, yx)
    else:
        # a closed (watertight) skirt: the hem edge is the lowest skirt height per 2 deg of azimuth
        # (fine enough to follow the pleats), interpolated between bin centres
        tt = np.arctan2(p3[skirt, 0] - hips[0], p3[skirt, 2] - hips[2])
        nbins = 180
        bins = ((tt + np.pi) / (2 * np.pi) * nbins).astype(int) % nbins
        mins = np.array([np.percentile(sy[bins == i], 0.5) if (bins == i).sum() > 3 else np.nan for i in range(nbins)])
        ok = ~np.isnan(mins)
        ctr = (np.arange(nbins) + 0.5) / nbins * 2 * np.pi - np.pi
        cx = np.concatenate([ctr[ok] - 2 * np.pi, ctr[ok], ctr[ok] + 2 * np.pi])
        mx = np.concatenate([mins[ok]] * 3)
        yh = np.interp(tt, cx, mx)
        hem_info['mode'] = 'lowest per 2 deg'
    dh = sy - yh
    hb0, hb1 = sk['hem_band']
    on = (dh >= hb0) & (dh <= hb1)
    sidx = np.nonzero(skirt)[0]
    out_lab[sidx[on]] = hem_lab
    hem_info['line_texels'] = int(on.sum())

    # ---- face protection: eye boxes + the face around them
    skin_k = keys.index('skin')
    hair_k = keys.index('hair')
    skin_src = np.array([F.hex_to_lab(h) for h in P['skin']['src']])
    d_skin = np.sqrt((((lab0[:, None, :] - skin_src[None]) * lw) ** 2).sum(-1)).min(1)
    skin_orig = F.hex_to_lab(P['skin']['src'][0])
    dskin_vec = F.hex_to_lab(profile['skin_flat']) - skin_orig
    face_m = np.zeros(N, bool)
    eye_m = np.zeros(N, bool)
    if eyes:
        C = np.array(eyes['centers'])
        R = np.array(eyes['radii'])
        dep = eyes.get('depth', 0.03)
        for i in range(2):
            d = p3 - C[i]
            a = np.abs(d[:, :2] / R[i])
            sq = (a[:, 0] ** 4 + a[:, 1] ** 4) ** 0.25
            eye_m |= (sq < 1.35) & (d[:, 2] > -dep)
        c = C.mean(0)
        span = max(abs(C[0, 0] - C[1, 0]), 1e-4)
        dd = (p3[:, :2] - c[:2] - np.array([0, -0.35 * span])) / span
        front = p3[:, 2] > c[2] - span * 0.9
        chin = bind['head'][1] + 0.004
        face_m = (np.linalg.norm(dd * np.array([1, 0.95]), axis=1) < 1.45) & front & head & (p3[:, 1] > chin)
    hair_src = np.array([F.hex_to_lab(h) for h in P['hair']['src']])
    d_hair = np.sqrt((((lab0[:, None, :] - hair_src[None]) * lw) ** 2).sum(-1)).min(1)
    # bangs crossing the face flatten like the rest of her hair; everything else in the face is protected
    hair_like = (d_hair < 0.045) & (d_hair < d_skin) & (lbl_f == hair_k)
    prot = (eye_m | face_m) & ~hair_like
    # skin-ish texels snap softly to the flat skin; the rest keeps its paint, shifted by the skin change
    # only where it is nearly skin (blush edges), so the blush blends in; irises, lashes, eye whites and
    # highlights keep their exact paint (rose eyes stay rose)
    def smooth(x0, x1, v):
        t = np.clip((v - x0) / (x1 - x0), 0, 1)
        return t * t * (3 - 2 * t)
    # blush is skin plus red (OKLab a): weigh a strongly and lightness weakly, so baked shade on the
    # skin snaps while the blush keeps its paint
    d_blush = np.sqrt((((lab0[:, None, :] - skin_src[None]) * np.array([0.35, 1.8, 1.2])) ** 2).sum(-1)).min(1)
    w_snap = 1 - smooth(0.008, 0.05, d_blush)  # a wide ramp: the blush keeps its soft round falloff
    s_shift = 1 - smooth(0.05, 0.10, d_blush)
    s_shift = np.where(eye_m & (lab0[:, 0] < 0.86), 0.0, s_shift)
    w_snap = np.where(eye_m & (lab0[:, 0] < 0.86), np.minimum(w_snap, 1 - smooth(0.012, 0.03, d_skin)), w_snap)
    kept = lab0 + s_shift[:, None] * dskin_vec[None]
    prot_lab = kept * (1 - w_snap[:, None]) + F.hex_to_lab(profile['skin_flat'])[None] * w_snap[:, None]
    out_lab[prot] = prot_lab[prot]

    # ---- write
    out_rgb = F.lin_to_srgb(F.oklab_to_lin(out_lab))
    full = np.zeros((H, W, 3))
    full[cov] = out_rgb
    full, v8 = F.dilate(full, cov, 8)
    # far from every island: one neutral colour (compresses to nothing)
    full[~v8] = F.hex_to_rgb(P['blazer']['flat'])
    res = dict(image=(np.clip(full, 0, 1) * 255 + 0.5).astype(np.uint8), keys=keys, legR=float(legR), hem=hem_info,
               counts={k: int((lbl_f == i).sum()) for i, k in enumerate(keys)}, skirt_texels=int(skirt.sum()),
               protected_texels=int(prot.sum()), eye_texels=int(eye_m.sum()), seconds=round(time.time() - t0, 1))
    # metrics: whole map (as the rig test measured them) and covered texels only
    res['metrics'] = dict(before=metrics(img, cov), after=metrics(full, cov))
    res['flat_eyes'] = flat_eyes(eyes, profile, P) if eyes else None
    if debug_prefix:
        pal = np.array([F.hex_to_rgb(P[k]['flat']) for k in keys])
        lm = np.zeros((H, W, 3))
        lm[cov] = pal[lbl_f]
        lm[cov][skirt] = 0
        tmp = lm[cov]
        tmp[skirt] = [0.2, 0.2, 1.0]
        tmp[prot] = [1.0, 0.1, 0.1]
        lm[cov] = tmp
        Image.fromarray((lm * 255).astype(np.uint8)).save(debug_prefix + '_labels.png')
        Image.fromarray(res['image']).save(debug_prefix + '_base_flat.png')
        res['_debug'] = dict(m=m, img=img, flat=full, labels=lm)
    log(f'[flatten] {glb}: {res["seconds"]} s, counts {res["counts"]}, skirt {res["skirt_texels"]}, hem {hem_info}, '
        f'protected {res["protected_texels"]}, metrics {res["metrics"]}')
    return res


def box(a, r):
    k = 2 * r + 1
    p = np.pad(a, r, mode='edge')
    c = p.cumsum(0).cumsum(1)
    c = np.pad(c, ((1, 0), (1, 0)))
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


def metrics(img, cov):
    L = F.luminance(img)
    s3 = np.sqrt(np.maximum(box(L * L, 1) - box(L, 1) ** 2, 0))
    s5 = np.sqrt(np.maximum(box(L * L, 2) - box(L, 2) ** 2, 0))
    return dict(brightness_map=round(float(L.mean()), 3), brightness=round(float(L[cov].mean()), 3),
                dark2=round(float(np.percentile(L[cov], 2)), 3), noise3=round(float(s3[cov].mean()), 4),
                flat_share=round(float((s5[cov] < 0.02).mean()), 3))


def flat_eyes(eyes, profile, P):
    """extras.eyes for the flat texture: the same boxes; the lid colours are the flat skin; the hair guard
    is checked against the flat hair (linear-RGB HSV, as figurine.js reads it)."""
    e = dict(eyes)
    e['skin'] = profile['skin_flat'].lower()
    e['skinLow'] = profile['skin_low'].lower()
    hair = F.srgb_to_lin(F.hex_to_rgb(P['hair']['flat']))
    skin = F.srgb_to_lin(F.hex_to_rgb(profile['skin_flat']))

    def hsv(c):
        mx, mn = c.max(), c.min()
        d = mx - mn
        if d < 1e-6:
            h = 0
        elif mx == c[0]:
            h = ((c[1] - c[2]) / d) % 6
        elif mx == c[1]:
            h = (c[2] - c[0]) / d + 2
        else:
            h = (c[0] - c[1]) / d + 4
        return h * 60, d / mx, mx
    g = eyes.get('hairGuard')
    if g:
        hh, hs, hv = hsv(hair)
        sh, ss, sv = hsv(skin)
        guard_hair = g['hue'][0] <= hh <= g['hue'][1] and hs >= g['sat'] and hv >= g.get('val', 0)
        guard_skin = g['hue'][0] <= sh <= g['hue'][1] and ss >= g['sat'] and sv >= g.get('val', 0)
        e['_check'] = dict(hair_hsv=[round(hh, 1), round(hs, 3), round(hv, 3)], skin_hsv=[round(sh, 1), round(ss, 3), round(sv, 3)],
                           hair_guarded=bool(guard_hair), skin_guarded=bool(guard_skin))
    return e


if __name__ == '__main__':
    glb = sys.argv[1]
    prefix = sys.argv[2]
    r = flatten(glb, debug_prefix=prefix if '--debug' in sys.argv else None)
    Image.fromarray(r['image']).save(prefix + '_base_flat.png')
    js = {k: v for k, v in r.items() if k not in ('image', '_debug')}
    json.dump(js, open(prefix + '_flatten.json', 'w'), indent=1)
    if '--debug' in sys.argv:
        import splat
        d = r['_debug']
        m = d['m']

        def vcol(im):
            H, W = im.shape[:2]
            return im[np.clip((m['uv'][:, 1] * H).astype(int), 0, H - 1), np.clip((m['uv'][:, 0] * W).astype(int), 0, W - 1)] * 255
        rows = []
        for im in (d['img'], d['flat'], d['labels']):
            vc = None
            tx = im * 255
            row = [splat.render(m['pos'], m['tri'], vc, v, 500, tex=tx, uv=m['uv']) for v in ('front', 'back', 'right')]
            row.append(splat.render(m['pos'], m['tri'], vc, 'front', 500, box=([-0.2, 0.47, -0.2], [0.2, 0.8, 0.2]), tex=tx, uv=m['uv']))
            rows.append(row)
        sheet = Image.new('RGB', (2000, 1500))
        for j, row in enumerate(rows):
            for i, t in enumerate(row):
                sheet.paste(t, (500 * i, 500 * j))
        sheet.save(prefix + '_views.png')



