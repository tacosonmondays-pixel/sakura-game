"""Optional re-proportion step for an imported Meshy figure, in its bind (rest) pose: a bigger head, a little more
volume in the arms, legs, waist and skirt. Pure numpy, on the unpacked Blender export (raw.glb), between the
export and lib/pack.py, so it composes with every other per-figure step (eye fixes, hair tune, clips) and is
picked per figure with one settings entry (PRESETS below; --proportions <name> on build_meshy_chibi.py, or
reproportion.py on the exports a build kept with --raw-dir).

Only vertex positions and normals change. The skeleton, skin weights, inverse binds, clips, UVs and textures are
untouched, so every clip plays exactly as before: the head geometry is simply bigger around the same head bone,
the limbs a little thicker around the same limb bones. The figure comes out taller, so the build's
extras.unitScale brings the whole figure back to its battle height (GAME_HEIGHT) and the body is a little smaller
on screen; extras.eyes (the painted-eye boxes, in the position space) gets the same head transform.

How each part is driven by the skin weights (moves are computed per welded point, so split UV seams stay closed):
  head   v' = p + (v - p) * (1 + (s - 1) * w),  w = (head-chain weight) * smoothstep(neck_lo, neck_hi, y).
         p sits on the head bone's vertical axis at the chin height. Everything above neck_hi (face, hair, buns,
         hair clips, painted eyes) gets one uniform scale, so its shape, custom normals and eye boxes stay exact;
         the neck between neck_lo and neck_hi is the falloff, and the collar below it does not move.
  limbs  radial thickening about the limb's own centre line, measured ring by ring from its vertices (these rigs
         do not run a bone through the middle of a limb), weighted by the limb chain's skin weights (sharpened
         with 'member' where the rig shares weights between an arm and the blazer side), with a smooth profile
         along the bone (or along the height, for legs coming out of a skirt) and a smooth cut-off with the
         distance from the centre line, so props on a limb (a shield plate) and clothes hanging away from it (a
         skirt) stay put.
  torso  horizontal widening about the spine with a smooth height profile, on every vertex except the arms and
         the legs (chain weight near the bone), so a skirt widens but the legs under it are not pushed apart.
Normals are moved with the inverse transpose of the local Jacobian (unchanged where the move is a uniform scale).
All coordinates are the export's: glTF axes (y up, +z the figure's front, +x her left) at the tool's working
size (1.7 tall)."""
import json

import numpy as np

from . import pack

# ---- per-figure settings ---------------------------------------------------------------------------------
# Noa (art-wave import, build_noa.py): chin at y 1.0186, neck and collar-ribbon knot between 0.92 and 0.98, buns
# and nape hair from 0.981 up, skirt hem 0.369, loafers below 0.12; limbs about 0.06 in radius.
_NOA_HEAD = dict(scale=1.17, pivot_y=1.0186, neck=(0.925, 0.978))


def _noa_arm(side, upper=1.40):
    # the upper arm only: her forearms are already as wide as Hikari's, and the left one carries the shield plate.
    # Meshy weights the blazer's sides to the arms by about half, so a vertex counts as arm when the arm chain holds
    # 60..90 % of it ('member'), or when it has some upper-arm weight and sits close to the arm's centre line.
    # Nominal 1.40 with the taper and the shared weights comes out at about +20 % across the sleeve (measured).
    return dict(chain=[f'shoulder_{side}', f'upper_arm_{side}', f'forearm_{side}', f'hand_{side}'], member=(0.6, 0.9), reach=0.085,
                segs=[dict(bones=[f'shoulder_{side}', f'upper_arm_{side}'], seg=(f'upper_arm_{side}', f'forearm_{side}'),
                           scale=upper, along=[(0.0, 0), (0.3, 1), (0.8, 1), (1.15, 0)])])


def _noa_leg(side, scale=1.08):
    # below the skirt hem (0.369) and above the loafers only (nominal 1.08: about +6 % across the calf)
    return dict(chain=[f'thigh_{side}', f'shin_{side}', f'foot_{side}', f'toe_{side}'], member=None, reach=0.09,
                segs=[dict(bones=[f'thigh_{side}', f'shin_{side}'], seg=(f'thigh_{side}', f'foot_{side}'),
                           scale=scale, height=[(0.12, 0), (0.17, 1), (0.30, 1), (0.37, 0)])])


PRESETS = {
    # A: the head only, to the chibi family's head share (Hikari 44.7 % of her height); her slim body is kept
    'noa-A': dict(head=_NOA_HEAD),
    # B: A + upper arms about halfway to Hikari's sleeve width (her sleeves are the thinnest part of her outline),
    # legs below the skirt +6 %, and a touch wider blazer waist and skirt (+4 %); still clearly slimmer than Hikari
    'noa-B': dict(
        head=_NOA_HEAD,
        limbs=[_noa_arm('L'), _noa_arm('R'), _noa_leg('L'), _noa_leg('R')],
        # horizontal widening of the blazer waist and the skirt: 1.00 under the arms, 1.06 at the waist, 1.045
        # over the skirt down to its hem, 1.00 again below it (legs and loafers are never pushed apart)
        torso=dict(x=[(0.30, 1.0), (0.345, 1.045), (0.62, 1.045), (0.80, 1.06), (0.875, 1.0)]),
    ),
}
HEAD_CHAIN = ('head', 'head_front', 'head_end')


def smoothstep(e0, e1, x):
    t = np.clip((np.asarray(x, np.float64) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def profile(knots, x):
    """Piecewise smoothstep through (x, value) knots, flat outside them: smooth (C1) everywhere."""
    x = np.asarray(x, np.float64)
    out = np.full(x.shape, float(knots[0][1]))
    for (x0, v0), (x1, v1) in zip(knots[:-1], knots[1:]):
        out = np.where(x >= x0, v0 + (v1 - v0) * smoothstep(x0, x1, x), out)
    return out


class Rig:
    """Bind-pose joints of the export's single skin (from its inverse binds) and dense per-vertex weights."""

    def __init__(self, js, binc, prim):
        skin = js['skins'][0]
        ibm = pack.read_accessor(js, binc, skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
        self.names = [js['nodes'][j].get('name', str(j)) for j in skin['joints']]
        self.J = {n: np.linalg.inv(m.astype(np.float64))[:3, 3] for n, m in zip(self.names, ibm)}
        at = prim['attributes']
        jt = pack.read_accessor(js, binc, at['JOINTS_0']).astype(np.int64)
        wt = pack.read_accessor(js, binc, at['WEIGHTS_0']).astype(np.float64)
        W = np.zeros((len(jt), len(self.names)))
        np.add.at(W, (np.repeat(np.arange(len(jt)), jt.shape[1]), jt.ravel()), wt.ravel())
        self.W = W / np.maximum(W.sum(1, keepdims=True), 1e-9)

    def weight(self, bones, W):
        idx = [self.names.index(b) for b in bones if b in self.names]
        return W[:, idx].sum(1) if idx else np.zeros(len(W))


class Limb:
    """One limb segment (joint a -> joint b) with its own centre line: rigs do not run bones through the middle
    of a limb, so the centre is measured from the limb's vertices, ring by ring along the bone (midpoint of the
    10..90 % extent, in 0.1-long slices, of the vertices with some chain weight near the bone; smoothed, and
    filled in where a slice is empty)."""

    def __init__(self, rig, a, b, member, reach, fit_y=None):
        self.A, B = rig.J[a], rig.J[b]
        self.L = np.linalg.norm(B - self.A)
        self.d = (B - self.A) / self.L
        e1 = np.cross(self.d, [0.0, 0.0, 1.0])
        if np.linalg.norm(e1) < 1e-6:
            e1 = np.cross(self.d, [1.0, 0.0, 0.0])
        self.e1 = e1 / np.linalg.norm(e1)
        self.e2 = np.cross(self.d, self.e1)
        u, perp = self.coords(rig.P0)
        c1, c2 = perp @ self.e1, perp @ self.e2
        uc = np.clip(u, 0.0, 1.0)
        rb = np.linalg.norm(rig.P0 - self.A - np.outer(uc * self.L, self.d), axis=1)  # distance to the bone
        m = (member > 0.3) & (rb < 1.4 * reach)
        if fit_y:  # a leg under a skirt: measure only where the leg shows, hold the centre above and below
            m &= (rig.P0[:, 1] > fit_y[0]) & (rig.P0[:, 1] < fit_y[1])
        self.uk = np.arange(-0.1, 1.11, 0.1)
        off = np.full((len(self.uk), 2), np.nan)
        for k, uk in enumerate(self.uk):
            s = m & (np.abs(u - uk) < 0.12)
            if s.sum() >= 4:
                off[k] = [(np.percentile(c1[s], 10) + np.percentile(c1[s], 90)) / 2,
                          (np.percentile(c2[s], 10) + np.percentile(c2[s], 90)) / 2]
        ok = ~np.isnan(off[:, 0])
        if ok.any():
            for j in range(2):
                off[:, j] = np.interp(self.uk, self.uk[ok], off[ok, j])
            off = np.vstack([off[:1], off, off[-1:]])
            off = (off[:-2] + 2 * off[1:-1] + off[2:]) / 4
        else:
            off[:] = 0.0
        self.off = off

    def coords(self, P):
        rel = P - self.A
        t = rel @ self.d
        return t / self.L, rel - np.outer(t, self.d)

    def radial(self, P):
        """Position along the bone and the vector from the limb's centre line, across the limb."""
        u, perp = self.coords(P)
        o1 = np.interp(u, self.uk, self.off[:, 0])
        o2 = np.interp(u, self.uk, self.off[:, 1])
        return u, perp - np.outer(o1, self.e1) - np.outer(o2, self.e2)


def build_map(rig, preset):
    """The move as a function of (positions, weights), for the move itself and for its Jacobian."""
    head, limbs, torso = preset.get('head'), preset.get('limbs', []), preset.get('torso')
    segs = []
    for lb in limbs:
        Wc = rig.weight(lb['chain'], rig.W)
        Mc = smoothstep(*lb['member'], Wc) if lb.get('member') else np.ones(len(Wc))
        for sg in lb['segs']:
            Ws = rig.weight(sg['bones'], rig.W)
            share = Ws / np.maximum(Wc, 1e-9) if lb.get('member') else Ws
            fit = (sg['height'][1][0], sg['height'][-2][0]) if sg.get('height') else None
            cand = Wc * share if lb.get('member') else Ws
            segs.append((lb, sg, Limb(rig, sg['seg'][0], sg['seg'][1], cand, lb['reach'], fit)))
    spine = [rig.J[n] for n in ('hips', 'spine', 'spine1', 'chest', 'neck') if n in rig.J]
    sy, sx = np.array([p[1] for p in spine]), np.array([p[0] for p in spine])
    hp = None
    if head:
        hj = rig.J['head']
        hp = np.array([hj[0], head['pivot_y'], hj[2]])

    def f(P, W):
        D = np.zeros_like(P)
        limbness = np.zeros(len(P))  # how much a vertex is arm or leg rather than torso / skirt
        for lb, sg, lm in segs:
            Wc = rig.weight(lb['chain'], W)
            Ws = rig.weight(sg['bones'], W)
            if lb.get('member'):
                Mc, share = smoothstep(*lb['member'], Wc), Ws / np.maximum(Wc, 1e-9)
            else:
                Mc, share = np.minimum(Wc, 1.0), Ws
            u, q = lm.radial(P)
            near = 1.0 - smoothstep(lb['reach'], 1.5 * lb['reach'], np.linalg.norm(q, axis=1))
            if lb.get('member'):  # Meshy shares an arm's inner side with the torso: near the centre line it is arm
                limbness = np.maximum(limbness, Mc)  # the whole arm chain (hands too) is never torso
                Mc = np.maximum(Mc * np.minimum(share, 1.0), near * smoothstep(0.15, 0.4, Ws))
                share = 1.0
            prof = profile(sg['along'], u) if sg.get('along') else profile(sg['height'], P[:, 1])
            D += q * ((sg['scale'] - 1.0) * Mc * share * near * prof)[:, None]
            limbness = np.maximum(limbness, Mc * near)
        if torso:
            keep = 1.0 - np.clip(limbness, 0.0, 1.0)
            cx = np.interp(P[:, 1], sy, sx)
            D[:, 0] += (P[:, 0] - cx) * (profile(torso['x'], P[:, 1]) - 1.0) * keep
        Q = P + D
        if head:
            w = rig.weight(HEAD_CHAIN, W) * smoothstep(head['neck'][0], head['neck'][1], P[:, 1])
            Q = hp + (Q - hp) * (1.0 + (head['scale'] - 1.0) * w)[:, None]
        return Q
    return f, hp


def _jacobian(f, P, W, eps=1e-4):
    J = np.empty((len(P), 3, 3))
    for k in range(3):
        e = np.zeros(3)
        e[k] = eps
        J[:, :, k] = (f(P + e, W) - f(P - e, W)) / (2 * eps)
    return J


def _move_normals(Jinv, N):
    Nn = np.einsum('nji,nj->ni', Jinv, N)  # n' ~ J^-T n
    return Nn / np.maximum(np.linalg.norm(Nn, axis=1, keepdims=True), 1e-12)


def _write_vec3(js, binc, acc_i, arr):
    acc = js['accessors'][acc_i]
    assert acc['componentType'] == 5126 and not acc.get('normalized'), 'expects the unpacked float export'
    bv = js['bufferViews'][acc['bufferView']]
    start = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
    st = bv.get('byteStride', 12)
    a32 = np.ascontiguousarray(arr, np.float32)
    if st == 12:
        binc[start:start + a32.nbytes] = a32.tobytes()
    else:
        for i in range(len(a32)):
            binc[start + i * st:start + i * st + 12] = a32[i].tobytes()


def apply_glb(js, binc, preset, eyes=None, store_scale=1.0):
    """Move the skinned mesh of an unpacked export in place. Returns (js, binc, info, eyes): info['growth'] is new
    height / old height (the crown sits in the uniformly scaled head, so this is exact and the same for every
    detail level of one build); eyes is the transformed extras.eyes (centres in the stored space = working space
    x store_scale)."""
    if isinstance(preset, str):
        preset = PRESETS[preset]
    binc = bytearray(binc)
    info = dict(meshes=[])
    hp = None
    for mesh in js['meshes']:
        for prim in mesh['primitives']:
            at = prim['attributes']
            if 'JOINTS_0' not in at:
                continue
            rig = Rig(js, binc, prim)
            P = pack.read_accessor(js, binc, at['POSITION']).astype(np.float64)
            N = pack.read_accessor(js, binc, at['NORMAL']).astype(np.float64)
            # weld split vertices (UV / normal seams) by position: one move per point, so seams stay closed
            key = np.round(P / 1e-6).astype(np.int64)
            _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
            inv = inv.ravel()
            Wu = np.zeros((len(first), rig.W.shape[1]))
            np.add.at(Wu, inv, rig.W)
            Wu /= np.bincount(inv)[:, None]
            Pu = P[first]
            rig.P0, rig.W = Pu, Wu
            f, hp = build_map(rig, preset)
            Q = f(Pu, Wu)[inv]
            J = _jacobian(f, P, Wu[inv])
            Jinv = np.linalg.inv(J)
            Nn = _move_normals(Jinv, N)
            moved = np.linalg.norm(Q - P, axis=1)
            _write_vec3(js, binc, at['POSITION'], Q)
            _write_vec3(js, binc, at['NORMAL'], Nn)
            # morph targets (e.g. a closed-eye shape added before packing): deltas follow the local move
            for tg in prim.get('targets', []):
                if 'POSITION' in tg:
                    assert 'sparse' not in js['accessors'][tg['POSITION']], 'sparse morph targets: apply this step first'
                    dP = pack.read_accessor(js, binc, tg['POSITION']).astype(np.float64)
                    dQ = np.einsum('nij,nj->ni', J, dP)
                    _write_vec3(js, binc, tg['POSITION'], dQ)
                    ta = js['accessors'][tg['POSITION']]
                    ta['min'] = [float(x) for x in dQ.min(0).astype(np.float32)]
                    ta['max'] = [float(x) for x in dQ.max(0).astype(np.float32)]
                if 'NORMAL' in tg:
                    dN = pack.read_accessor(js, binc, tg['NORMAL']).astype(np.float64)
                    _write_vec3(js, binc, tg['NORMAL'], _move_normals(Jinv, N + dN) - Nn)
            pa = js['accessors'][at['POSITION']]
            pa['min'] = [float(x) for x in Q.min(0).astype(np.float32)]
            pa['max'] = [float(x) for x in Q.max(0).astype(np.float32)]
            info['meshes'].append(dict(name=mesh.get('name'), verts=len(P), moved=int((moved > 1e-7).sum()),
                                       max_move=float(moved.max()), crown=float(P[:, 1].max()), crown_new=float(Q[:, 1].max())))
    head = preset.get('head')
    crown = max(m['crown'] for m in info['meshes'])
    info['growth'] = (hp[1] + head['scale'] * (crown - hp[1])) / crown if head else 1.0
    if eyes and head:
        eyes = json.loads(json.dumps(eyes))
        s = head['scale']
        c = hp + (np.array(eyes['centers'], np.float64) / store_scale - hp) * s
        eyes['centers'] = [[round(float(x), 5) for x in row] for row in c * store_scale]
        eyes['radii'] = [[round(float(x) * s, 5) for x in row] for row in eyes['radii']]
        eyes['depth'] = round(float(eyes.get('depth', 0.02)) * s, 5)
    info['pivot'] = None if hp is None else [round(float(x), 5) for x in hp]
    return js, bytes(binc), info, eyes


def apply_file(src, dst, preset, eyes=None, store_scale=1.0):
    js, binc = pack.read_glb(src)
    js, binc, info, eyes = apply_glb(js, binc, preset, eyes, store_scale)
    pack.write_glb(dst, js, binc)
    return info, eyes
