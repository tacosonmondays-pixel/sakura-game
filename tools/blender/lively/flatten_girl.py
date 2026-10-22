"""Offline flatten of a painted Meshy girl's base colour (PLAN §5.2 TX2), rollout steps 2-3: Hikari, Hana, Ruri.
Generalised from noa/build/flatten.py (step 1): numpy + Pillow only, no render engine, nothing generated.

    python flatten_girl.py <girl> <full|lod> [--debug]      -> girls/flat/<girl>_<detail>_base_flat.png + json

Same steps as Noa's: texels rasterised to their 3D bind position and skin weights; each texel labelled with the
nearest colour of her house palette (OKLab, lightness counted at 0.6) among the colours allowed where it sits
(head / hair chains / body / legs / feet / named zones); a 5x5 mode filter in each UV island; specks merged over
the welded mesh; the skirt (Hana, Ruri) found geometrically and made one solid colour with one hem line; her
face protected (eye boxes + the face around them: only skin and hair snap). Per girl:
  hikari  white pinned to #FAFAF8 (her coat must not go cream: cream-ish paint snaps to white, the gold trim and
          filigree stay gold, real small parts); pink hair #F7A3BF and teal from her turnaround; no skirt
  hana    plaid skirt -> solid olive-brown + one mustard hem line (her neckerchief's accent)
  ruri    plaid skirt -> solid navy + one sky hem line (her ribbon's accent); her book at the left hip is its own
          zone (never skirt); hair snapped to a royal blue that still passes her hairGuard"""
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
import gmesh as G  # noqa: E402
from flatten import metrics, flat_eyes, seg_dist  # noqa: E402  (Noa's, read-only)

ROOT = GIRLS

HIKARI = dict(
    palette={
        'hair': dict(flat='#F7A3BF', src=['#fa9cb1', '#fb9bb1', '#fc9bb1', '#f997ad', '#fb9db2', '#f48da3', '#dfa1a4', '#da9d9a', '#bf979e'], where={'head', 'hairr', 'body'}),
        'skin': dict(flat='#FCE6D3', src=['#fde7d8', '#fcebdb', '#f7cdbf', '#fde9d6'], where={'head', 'body'}),
        'white': dict(flat='#FAFAF8', src=['#f5f7f6', '#f6f6f6', '#f6f5f7', '#f7f6f6', '#fbfcfa', '#ece9e4'], where={'body', 'legs', 'feet', 'head_low', 'head'}),
        'gold': dict(flat='#E2BA6A', src=['#c7a66a', '#c6a668', '#bca571', '#cbb280', '#c4af83', '#bba06b', '#b9a26e', '#a5926b', '#ae9970', '#9f8c66', '#a28358', '#c3a66d'],
                     where={'body', 'legs', 'feet', 'head', 'hairr'}),
        'teal': dict(flat='#2FAFA7', src=['#2ca39e', '#249f9a', '#1f9f9c', '#1f9595', '#299c9a', '#249795', '#2fbaaf', '#405e63', '#194649', '#2c4542'],
                     where={'body', 'head', 'head_low', 'hairr', 'legs'}),
        'teal_light': dict(flat='#8FDCD2', src=['#7dc6be', '#83ddd0', '#bfdfd8'], where={'body', 'legs', 'head_low'}),
        'navy': dict(flat='#24325C', src=['#132443', '#112647', '#2c3541', '#475757', '#1c2b4e'], where={'body', 'legs'}),
        'grey_green': dict(flat='#9DB5A6', src=['#91a583', '#6c8074', '#799b9a'], where={'body'}),
    },
    small_ok={'gold', 'teal_light', 'teal', 'navy'},
    head_bones=('head', 'neck', 'bangs1', 'bangs2'), head_min_y=0.49, hair_bones=('hair_', 'bangs'),
    skirt=None, feet_y=0.03, head_low_y=0.52, legs_top=None, mode_r=1, tri_fill=False,
    skin_flat='#FCE6D3', skin_low='#FCE6D3', l_weight=0.6,
)

HANA = dict(
    palette={
        'hair': dict(flat='#7A4334', src=['#6a3c30', '#60352b', '#582f25', '#754237', '#593027', '#5f332a', '#62362c', '#512d23', '#714136', '#673b30', '#4a2816', '#36180c'],
                     where={'head', 'hairr'}),
        'skin': dict(flat='#FCE6D3', src=['#fbddd1', '#f9d7cb', '#f7d3c7', '#fcdace', '#f9e0cb', '#fddbcf'], where={'head', 'body'}),
        'olive': dict(flat='#687050', src=['#585d42', '#626548', '#585c41', '#606245', '#5a5d44', '#595b41', '#646246', '#737152', '#5e6140', '#808b74', '#67755d', '#757f6b'],
                      where={'body', 'head_low', 'hairr'}),
        'olive_light': dict(flat='#A9AA82', src=['#95956d', '#959471', '#908e66', '#a0a182', '#8d9173', '#838662'], where={'body', 'head_low'}),
        'cream': dict(flat='#EEE7CF', src=['#e0d8b8', '#ded6b9', '#ded6b9', '#c2c5ab', '#bbb18c'], where={'body', 'head_low'}),
        'mustard': dict(flat='#D4A24C', src=['#b88f47', '#bf9c7d', '#a58e71'], where={'body', 'head_low'}),
        'glove': dict(flat='#B08454', src=['#997449', '#a48157', '#97734a', '#a48157'], where={'body'}),
        'cyan': dict(flat='#BFF2EA', src=['#c8f8f1', '#cefbf4', '#c0e7db', '#9ec4b6', '#84a290'], where={'body'}),
        'feather': dict(flat='#ECE8EA', src=['#c5b5ac', '#d8d4d6', '#b0aaa8'], where={'head'}),
        'brown_dark': dict(flat='#5C3E2A', src=['#5e382e', '#4f3424', '#796d50', '#70634a', '#4c432a'], where={'body', 'head'}),
        'tights': dict(flat='#4C2E28', src=['#3b211c', '#43251d', '#371a13', '#513127', '#211511', '#2b1a14'], where={'legs', 'body'}),
        'boots': dict(flat='#7C4E3B', src=['#674332', '#613f31', '#6b4636', '#684232', '#6d4535', '#613c31', '#563227'], where={'legs', 'feet'}),
        'sole': dict(flat='#3C2820', src=['#221511', '#180b09', '#1e100e', '#1c0d09', '#170907', '#371b13', '#40221a'], where={'feet'}),
    },
    small_ok={'cyan', 'mustard', 'cream', 'feather', 'brown_dark', 'olive_light'},
    head_bones=('head', 'head_end', 'head_front'), head_min_y=0.0, hair_bones=('braid',),
    skirt=dict(flat='#625538', hem='#D4A24C', top_y=0.235, top_hi=0.262, hem_band=(0.0065, 0.0145), exclude=[], body_bones=('hips', 'root', 'spine', 'spine1', 'thigh_L', 'thigh_R'),
               **{'not': ('olive', 'cream', 'mustard', 'glove', 'skin')}),
    feet_y=0.05, head_low_y=0.50, legs_top=0.235,
    skin_flat='#FCE6D3', skin_low='#FCE6D3', l_weight=0.6,
)

RURI = dict(
    palette={
        'hair': dict(flat='#3F5DB4', src=['#203e84', '#1a357b', '#25448a', '#2c4c8e', '#325494', '#3a5b9a', '#4364a0', '#294a8d', '#152f68', '#19357a', '#4f70a9', '#5c7cb3', '#1f3d83'],
                     where={'head', 'hairr'}),
        'skin': dict(flat='#FCE6D3', src=['#fae7dd', '#f9d4c4', '#fdd8c4', '#fad3c2', '#fde3d4', '#f9cebc', '#faddd0', '#f7ddcf', '#f8d9c8', '#fbe9e0', '#fee2d3'],
                     where={'head', 'body', 'legs'}),
        'white': dict(flat='#F5F6FA', src=['#f3f1ef', '#f8f5f2', '#ece7e4', '#f5f5f6', '#f9fafb', '#eaebee', '#e4e4e5', '#d7dbdf', '#f4efeb', '#cbd4db'],
                      where={'body', 'head_low'}),
        'navy': dict(flat='#27396B', src=['#1d335e', '#293f69', '#11244c', '#1f3a5f', '#163073', '#173051', '#112541', '#394f72', '#324670', '#35496c', '#394d74'],
                     where={'body', 'head_low', 'legs', 'hairr'}),
        'sky': dict(flat='#76BBE4', src=['#4d9fb6', '#68abbe', '#5299af', '#3c859b', '#547e93', '#366b81', '#6e91ab'], where={'body', 'head_low', 'head'}),
        'vest': dict(flat='#8C9CB4', src=['#6d7e92', '#687687', '#879aa8', '#abb7be', '#9ba9b2', '#abc5d0', '#bbc6cd', '#798aa8', '#607395'], where={'body', 'head_low'}),
        'gold': dict(flat='#E2BA6A', src=['#d9a93a', '#c9a45a', '#e0c070', '#b08840', '#a58b4f'], where={'body', 'head', 'book'}),
        'loafer': dict(flat='#4B3631', src=['#3e312c', '#433836', '#3a2f2d', '#413634', '#352b2a', '#29201e', '#302625', '#3c3232', '#3e3433'], where={'legs', 'feet'}),
        # the book's cover: one navy a little bluer than the skirt, so it still reads as its own block
        'book': dict(flat='#33518C', src=['#1d335e', '#293f69', '#11244c', '#1f3a5f', '#394f72', '#607395', '#a8b2c5', '#f4efeb', '#6d7e92'], where={'book'}),
    },
    small_ok={'gold', 'sky', 'white', 'navy'},
    head_bones=('head', 'head_end', 'head_front'), head_min_y=0.0, hair_bones=('hair_',),
    # her book: a slab at the left hip, between the skirt and her left hand (probe_book.py)
    zones={'book': dict(lo=[0.098, 0.228, 0.012], hi=[0.162, 0.318, 0.158], max_hair=0.3, max_arm=0.3, island=0.6)},
    skirt=dict(flat='#2B3D6E', hem='#76BBE4', top_y=0.275, top_hi=0.285, hem_band=(0.0065, 0.0145), exclude=['book'],
               body_bones=('hips', 'root', 'spine', 'spine1', 'thigh_L', 'thigh_R'), **{'not': ('white', 'vest', 'sky', 'skin', 'loafer')}),
    feet_y=0.035, head_low_y=0.52, legs_top=0.275,
    skin_flat='#FCE6D3', skin_low='#FCE6D3', l_weight=0.6,
)
PROFILES = {'hikari': HIKARI, 'hana': HANA, 'ruri': RURI}


def flatten(glb, profile, debug_prefix=None, log=print):
    t0 = time.time()
    m = G.load(glb)
    img = G.image(m)
    H, W = img.shape[:2]
    tri, pos = m['tri'], m['pos']
    fid, bary = F.raster(m['uv'], tri, W, H)
    cov = fid >= 0
    f_t = fid[cov]
    p3 = F.texel_attr(fid, bary, tri, pos)
    Wt = F.texel_attr(fid, bary, tri, m['W'])
    names = m['names']

    def wsum(*bs):
        idx = [names.index(b) for b in bs if b in names]
        return Wt[:, idx].sum(1) if idx else np.zeros(len(Wt))

    def wpre(*prefixes):
        idx = [i for i, n in enumerate(names) if n.startswith(prefixes)]
        return Wt[:, idx].sum(1) if idx else np.zeros(len(Wt))
    col = img[cov]
    lab0 = F.lin_to_oklab(F.srgb_to_lin(col))
    N = len(col)
    bind = m['bind']
    eyes = m['extras'].get('eyes')
    y = p3[:, 1]

    # ---- regions
    head = (wsum(*profile['head_bones']) >= 0.5) & (y > profile['head_min_y'])
    hairr = (wpre(*profile['hair_bones']) >= 0.3) & ~head
    armw = wpre('upper_arm', 'forearm', 'hand', 'wrist', 'finger', 'thumb')
    tisl = F.islands(tri, len(pos))
    isl_t = tisl[f_t]
    tot = np.bincount(isl_t, minlength=tisl.max() + 1)
    zones = {}
    for zn, z in profile.get('zones', {}).items():
        inb = (np.all((p3 >= np.array(z['lo'])) & (p3 <= np.array(z['hi'])), axis=1) & (wpre(*profile['hair_bones']) < z['max_hair'])
               & (armw < z['max_arm']) & ~head)
        # whole UV islands that lie mostly in the box (the book's own charts; the skirt's charts run past it)
        share = np.bincount(isl_t, weights=inb.astype(float), minlength=tisl.max() + 1) / np.maximum(tot, 1)
        zones[zn] = inb & (share[isl_t] >= z.get('island', 0.6))
    inzone = np.zeros(N, bool)
    for zm in zones.values():
        inzone |= zm
    feet = (y < profile['feet_y']) & ~head & ~inzone
    hips, thL, thR, knL, knR, ftL, ftR = (bind[n] for n in ('hips', 'thigh_L', 'thigh_R', 'shin_L', 'shin_R', 'foot_L', 'foot_R'))
    kneeY = (knL[1] + knR[1]) / 2
    legL = hips[1] - kneeY
    Wv = m['W']
    shinv = Wv[:, [names.index('shin_L'), names.index('shin_R')]].sum(1)
    vy = pos[:, 1]
    calf = (vy < kneeY - 0.05 * legL) & (vy > kneeY - 0.4 * legL) & (shinv > 0.6)
    cd = np.minimum(seg_dist(pos[calf], knL, ftL), seg_dist(pos[calf], knR, ftR))
    legR = np.sort(cd)[int(len(cd) * 0.6)] * 1.35
    dleg = np.minimum.reduce([seg_dist(p3, thL, knL), seg_dist(p3, thR, knR), seg_dist(p3, knL, ftL), seg_dist(p3, knR, ftR)])
    skirt = np.zeros(N, bool)
    sk = profile['skirt']
    if sk:
        bodyw = wsum(*sk['body_bones'])
        excl = np.zeros(N, bool)
        for zn in sk.get('exclude', []):
            excl |= zones[zn]
        # 1. the geometric skirt (as livelySkirt.js / Noa's): outside the legs, below the top -> its hem height per
        #    2 deg of azimuth (the front, close to the thighs, is filled in between the bins it finds)
        skirt_c = ((y <= sk['top_y'] + 0.01) & (y >= kneeY - 0.3 * legL) & (dleg >= legR * 1.15 + 0.02 * legL)
                   & (bodyw >= 0.85) & (armw < 0.3) & ~head & ~excl & ~hairr)
        sy0 = p3[skirt_c, 1]
        tt0 = np.arctan2(p3[skirt_c, 0] - hips[0], p3[skirt_c, 2] - hips[2])
        nbins = 180
        b0 = ((tt0 + np.pi) / (2 * np.pi) * nbins).astype(int) % nbins
        mins = np.array([np.percentile(sy0[b0 == i], 0.5) if (b0 == i).sum() > 3 else np.nan for i in range(nbins)])
        okb = ~np.isnan(mins)
        ctr = (np.arange(nbins) + 0.5) / nbins * 2 * np.pi - np.pi
        cxx = np.concatenate([ctr[okb] - 2 * np.pi, ctr[okb], ctr[okb] + 2 * np.pi])
        mxx = np.concatenate([mins[okb]] * 3)
        # where the bins only saw the upper skirt (the front, close to the thighs) the typical hem height wins
        hem_at = np.minimum(np.interp(np.arctan2(p3[:, 0] - hips[0], p3[:, 2] - hips[2]), cxx, mxx), np.median(mins[okb]))
        # 2. everything body-weighted between that hem and the waistband, except whole UV islands that belong to
        #    another garment (mostly labelled jacket / blazer / tights colours: decided after labelling)
        bandw = bodyw + wsum('shin_L', 'shin_R')  # (a pleat close to the knee may carry a little shin weight)
        skirt_band = ((y >= hem_at - 0.004) & (y <= sk['top_hi']) & (bandw >= 0.85) & (armw < 0.3) & ~head & ~excl & ~hairr & ~feet)
    if profile.get('legs_top'):
        legs = ((y < profile['legs_top']) & (dleg < legR * 1.6 + 0.02 * legL) & ~(skirt_band if sk else skirt) & ~head & ~feet & (armw < 0.3)
                & ~inzone & ~hairr)
    else:
        legs = (dleg < legR * 1.6 + 0.02 * legL) & (y < kneeY + 0.2 * legL) & ~head & ~feet & (armw < 0.3) & ~hairr
    body = ~head & ~feet & ~legs & ~inzone & ~hairr
    region = {'head': head, 'body': body, 'legs': legs, 'feet': feet, 'hairr': hairr, 'head_low': head & (y < profile['head_low_y'])}
    region.update(zones)

    # ---- labels: nearest allowed palette source colour (lightness counted at l_weight)
    P = profile['palette']
    keys = list(P)
    lw = np.array([profile['l_weight'], 1, 1])
    best = np.full(N, np.inf)
    lbl = np.full(N, -1, np.int32)
    for k, key in enumerate(keys):
        allowed = np.zeros(N, bool)
        for r in P[key]['where']:
            allowed |= region.get(r, np.zeros(N, bool))
        S = np.array([F.hex_to_lab(h) for h in P[key]['src']])
        d = np.sqrt((((lab0[:, None, :] - S[None]) * lw) ** 2).sum(-1)).min(1)
        d = np.where(allowed, d, np.inf)
        upd = d < best
        best[upd] = d[upd]
        lbl[upd] = k
    if (lbl < 0).any():
        log('[flatten] unlabelled texels', int((lbl < 0).sum()))
        lbl[lbl < 0] = 0

    # ---- 5x5 mode filter inside UV islands (2 passes)
    L2 = np.full((H, W), -1, np.int32)
    L2[cov] = lbl
    I2 = np.full((H, W), -2, np.int64)
    I2[cov] = isl_t
    L2 = F.mode_filter(L2, cov, I2, r=profile.get('mode_r', 2), nlab=len(keys), passes=2)
    lbl_m = L2[cov]
    if sk:
        notk = [keys.index(k) for k in sk['not'] if k in keys]
        is_not = np.isin(lbl_m, notk) & skirt_band
        inband = np.bincount(isl_t, weights=skirt_band.astype(float), minlength=tisl.max() + 1)
        share_not = np.bincount(isl_t, weights=is_not.astype(float), minlength=tisl.max() + 1) / np.maximum(inband, 1)
        skirt = skirt_band & (share_not[isl_t] < sk.get('not_share', 0.5))

    # ---- per-triangle labels, smoothed over the welded mesh adjacency
    T = len(tri)
    hist = np.zeros((T, len(keys)))
    np.add.at(hist, (f_t, lbl_m), 1)
    has = hist.sum(1) > 0
    flab = hist.argmax(1)
    purity = np.where(has, hist.max(1) / np.maximum(hist.sum(1), 1), 0)
    area = 0.5 * np.linalg.norm(np.cross(pos[tri[:, 1]] - pos[tri[:, 0]], pos[tri[:, 2]] - pos[tri[:, 0]]), axis=1)
    nb = F.face_adjacency(pos, tri)
    small_ok = {keys.index(k) for k in profile['small_ok'] if k in keys}
    relab = np.zeros(T, bool)
    A_MIN = 2.5e-5
    for it in range(3):
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
    # (Hikari's paint is already clean: her gold filigree keeps its texel shape instead of whole triangles)
    face_take = relab | ((purity >= 0.75) if profile.get('tri_fill', True) else False)
    lbl_f = np.where(face_take[f_t], flab[f_t], lbl_m)

    # ---- colours
    flat_lab = np.array([F.hex_to_lab(P[k]['flat']) for k in keys])
    out_lab = flat_lab[lbl_f].copy()
    hem_info = {}
    if sk:
        out_lab[skirt] = F.hex_to_lab(sk['flat'])
        if sk.get('hem'):
            sy = p3[skirt, 1]
            tt = np.arctan2(p3[skirt, 0] - hips[0], p3[skirt, 2] - hips[2])
            nbins = 180
            bins = ((tt + np.pi) / (2 * np.pi) * nbins).astype(int) % nbins
            mins = np.array([np.percentile(sy[bins == i], 0.5) if (bins == i).sum() > 3 else np.nan for i in range(nbins)])
            ok = ~np.isnan(mins)
            ctr = (np.arange(nbins) + 0.5) / nbins * 2 * np.pi - np.pi
            cx = np.concatenate([ctr[ok] - 2 * np.pi, ctr[ok], ctr[ok] + 2 * np.pi])
            mx = np.concatenate([mins[ok]] * 3)
            yh = np.interp(tt, cx, mx)
            dh = sy - yh
            hb0, hb1 = sk['hem_band']
            on = (dh >= hb0) & (dh <= hb1)
            sidx = np.nonzero(skirt)[0]
            out_lab[sidx[on]] = F.hex_to_lab(sk['hem'])
            hem_info = dict(mode='lowest per 2 deg', line_texels=int(on.sum()), bins_ok=int(ok.sum()))

    # ---- face protection: eye boxes + the face around them (as Noa's)
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
        chin = c[1] - 0.6 * span  # (Noa's: her head joint; Hikari's head joint sits above her eyes)
        face_m = (np.linalg.norm(dd * np.array([1, 0.95]), axis=1) < 1.45) & front & head & (p3[:, 1] > chin)
    hair_src = np.array([F.hex_to_lab(h) for h in P['hair']['src']])
    d_hair = np.sqrt((((lab0[:, None, :] - hair_src[None]) * lw) ** 2).sum(-1)).min(1)
    hair_like = (d_hair < 0.045) & (d_hair < d_skin) & (lbl_f == hair_k)
    # inside the eye boxes a texel may only become flat hair if the closed-eye shader already kept it as hair
    # in her paint (figurine.js figCloseEyes: extras.eyes.hairGuard in linear-RGB HSV, else the pink rule);
    # otherwise a dark iris / lash texel near her hair colour (Hana's brown, Ruri's blue) would turn into
    # guarded hair and stay visible on a closed eye (first in-game check)
    lin = F.srgb_to_lin(col)
    mx, mn = lin.max(1), lin.min(1)
    dd_ = mx - mn
    hh = np.zeros(N)
    nz = dd_ > 1e-5
    r_, g_, b_ = lin[:, 0], lin[:, 1], lin[:, 2]
    hh = np.where(nz & (mx == r_), np.mod((g_ - b_) / np.maximum(dd_, 1e-9), 6.0), hh)
    hh = np.where(nz & (mx != r_) & (mx == g_), (b_ - r_) / np.maximum(dd_, 1e-9) + 2.0, hh)
    hh = np.where(nz & (mx != r_) & (mx != g_), (r_ - g_) / np.maximum(dd_, 1e-9) + 4.0, hh)
    hue = hh * 60.0
    sat = np.where(mx > 1e-5, dd_ / np.maximum(mx, 1e-9), 0.0)
    gd = (eyes or {}).get('hairGuard')
    if gd:
        guarded = (hue >= gd['hue'][0]) & (hue <= gd['hue'][1]) & (sat >= gd['sat']) & (mx >= gd.get('val', 0))
    else:
        guarded = (r_ - g_ > 0.35) & (b_ > g_)
    hair_like &= ~eye_m | guarded
    prot = (eye_m | face_m) & ~hair_like

    def smooth(x0, x1, v):
        t = np.clip((v - x0) / (x1 - x0), 0, 1)
        return t * t * (3 - 2 * t)
    d_blush = np.sqrt((((lab0[:, None, :] - skin_src[None]) * np.array([0.35, 1.8, 1.2])) ** 2).sum(-1)).min(1)
    w_snap = 1 - smooth(0.008, 0.05, d_blush)
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
    full[~v8] = F.hex_to_rgb(P[keys[0]]['flat'])
    res = dict(image=(np.clip(full, 0, 1) * 255 + 0.5).astype(np.uint8), keys=keys, legR=float(legR), hem=hem_info,
               counts={k: int((lbl_f == i).sum()) for i, k in enumerate(keys)}, skirt_texels=int(skirt.sum()),
               zone_texels={zn: int(zm.sum()) for zn, zm in zones.items()},
               protected_texels=int(prot.sum()), eye_texels=int(eye_m.sum()), seconds=round(time.time() - t0, 1))
    res['metrics'] = dict(before=metrics(img, cov), after=metrics(full, cov))
    res['flat_eyes'] = flat_eyes(eyes, profile, P) if eyes else None
    if debug_prefix:
        pal = np.array([F.hex_to_rgb(P[k]['flat']) for k in keys])
        lm = np.zeros((H, W, 3))
        tmp = pal[lbl_f].copy()
        tmp[skirt] = [0.2, 0.2, 1.0]
        tmp[prot] = [1.0, 0.1, 0.1]
        for zm in zones.values():
            tmp[zm] = tmp[zm] * 0.5 + np.array([1.0, 0.6, 0.0]) * 0.5
        lm[cov] = tmp
        res['_debug'] = dict(m=m, img=img, flat=full, labels=lm)
    log(f'[flatten] {glb}: {res["seconds"]} s, counts {res["counts"]}, skirt {res["skirt_texels"]}, zones {res["zone_texels"]}, hem {hem_info}, '
        f'protected {res["protected_texels"]}, metrics {res["metrics"]}')
    return res


def palette_list(profile):
    out = [v['flat'].lower() for v in profile['palette'].values()]
    if profile['skirt']:
        out += [profile['skirt']['flat'].lower()] + ([profile['skirt']['hem'].lower()] if profile['skirt'].get('hem') else [])
    return list(dict.fromkeys(out))


if __name__ == '__main__':
    girl, detail = sys.argv[1], sys.argv[2]
    prof = PROFILES[girl]
    glb = ROOT + f'src/{girl}.ship{".lod" if detail == "lod" else ""}.glb'
    prefix = ROOT + f'flat/{girl}_{detail}'
    import os
    os.makedirs(ROOT + 'flat', exist_ok=True)
    r = flatten(glb, prof, debug_prefix=prefix if '--debug' in sys.argv else None)
    Image.fromarray(r['image']).save(prefix + '_base_flat.png')
    js = {k: v for k, v in r.items() if k not in ('image', '_debug')}
    js['palette'] = palette_list(prof)
    json.dump(js, open(prefix + '_flatten.json', 'w'), indent=1)
    if '--debug' in sys.argv:
        import splat
        d = r['_debug']
        m = d['m']
        lo, hi = m['pos'].min(0), m['pos'].max(0)
        hb = ([lo[0] * 0.7, hi[1] * 0.55, lo[2]], [hi[0] * 0.7, hi[1], hi[2]])
        rows = []
        for im in (d['img'], d['flat'], d['labels']):
            tx = im * 255
            row = [splat.render(m['pos'], m['tri'], None, v, 500, tex=tx, uv=m['uv']) for v in ('front', 'back', 'right')]
            row.append(splat.render(m['pos'], m['tri'], None, 'front', 500, box=hb, tex=tx, uv=m['uv']))
            rows.append(row)
        sheet = Image.new('RGB', (2000, 1500))
        for j, row in enumerate(rows):
            for i, t in enumerate(row):
                sheet.paste(t, (500 * i, 500 * j))
        sheet.save(prefix + '_views.png')
