"""Head, ears, neck, torso, limbs, mitten hands, big shoes — the cages every girl shares.

Head: a 26-vertex rounded-cube cage (jaeysart step 1/2) shaped before subdivision: the face
plane is pulled slightly flat, the cheeks pushed out and the chin narrowed, the cranium kept
round. After subdivision the front of the head gets planar UVs so the painted face atlas
lands exactly on the face.
"""
import math
import bpy
from mathutils import Vector

from . import mesh as M
from .colors import mix, darken

SKIN_SHADE_T = 0.10


def head(P, skin):
    """Returns the head object (vertex group 'head') with face UVs in [0,1] of one atlas cell."""
    hc = P['head_center']
    R = P['head_radii']
    verts, faces = M.sphere((0, 0, 0), (1, 1, 1), inflate=1.0)
    shaped = []
    for v in verts:
        x, y, z = v
        p = Vector((x, y, z))
        front = max(0.0, -y)            # 1 at the face centre
        lower = max(0.0, -z)            # 1 at the chin
        # flatten the face plane, keep a soft bulge
        p.y += 0.16 * front * (1.0 - 0.5 * abs(x)) * (1.0 - 0.6 * abs(z))
        # cheeks: lower-front corners push out and down a touch
        cheek = front * lower * abs(x)
        p.x *= 1.0 + 0.09 * cheek
        p.z -= 0.05 * cheek
        # chin: narrow the bottom at the front
        if z < 0:
            p.x *= 1.0 - 0.10 * lower * (0.4 + 0.6 * front)
            p.y *= 1.0 - 0.06 * lower
        # cranium: a little taller at the back/top
        if z > 0:
            p.z *= 1.0 + 0.05 * z * (0.5 + 0.5 * max(0.0, y))
            p.y *= 1.0 + 0.04 * z * max(0.0, y)
        shaped.append((hc.x + p.x * R.x * M.INFLATE_SPHERE, hc.y + p.y * R.y * M.INFLATE_SPHERE, hc.z + p.z * R.z * M.INFLATE_SPHERE))
    obj = M.new_object('head', shaped, faces, color=skin, bone='head')
    M.finish(obj, levels=3, min_levels=2)
    face_uvs(obj, P)
    obj['material'] = 'head'
    return obj


def face_uvs(obj, P):
    """Planar front projection: u across the head width, v from chin to top. Back-facing
    polygons collapse to a skin-only texel so the painted face never wraps around."""
    me = obj.data
    uv = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    lo, hi = M.bounds(obj)
    cx = (lo.x + hi.x) / 2
    w = (hi.x - lo.x)
    h = (hi.z - lo.z)
    for poly in me.polygons:
        n = poly.normal
        back = n.y > 0.25
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            if back:
                uv.data[li].uv = (0.03, 0.03)
            else:
                u = 0.5 + (v.x - cx) / w
                vv = (v.z - lo.z) / h
                uv.data[li].uv = (u, vv)
    me.update()


def ears(P, skin):
    hc = P['head_center']
    R = P['head_radii']
    out = []
    for s in (1, -1):
        c = (hc.x + s * R.x * 0.95, hc.y + 0.02, hc.z - R.z * 0.08)
        v, f = M.box(c, (0.06, 0.044, 0.072))
        o = M.new_object('ear', v, f, color=skin, bone='head')
        M.finish(o, levels=2)
        out.append(o)
    return out


def neck(P, skin):
    z0, z1 = P['neck_z']
    v, f, rings = M.tube([Vector((0, 0.01, z0)), Vector((0, 0.01, z1))], P['neck_r'], sides=8)
    o = M.new_object('neck', v, f, color=darken(skin, 0.12), bone='neck')
    M.finish(o, levels=1)
    return o


def torso(P, color, shade=None, dress=False):
    """Soft tapered torso: three loops (hips, waist, shoulders) + a rounded top."""
    w0, w1, w2 = P['torso_w'][2], P['torso_w'][1], P['torso_w'][0]
    d0, d1, d2 = P['torso_d'][2], P['torso_d'][1], P['torso_d'][0]
    zb, zw, zt = P['torso_bottom'], P['waist_z'], P['torso_top']
    path = [Vector((0, 0, zb - 0.015)), Vector((0, 0, zb + 0.02)), Vector((0, 0, zw)), Vector((0, -0.004, zt - 0.035)), Vector((0, -0.006, zt))]
    radii = [(w0 * 0.42, d0 * 0.42), (w0 * 0.5, d0 * 0.5), (w1 * 0.5, d1 * 0.5), (w2 * 0.5, d2 * 0.5), (w2 * 0.36, d2 * 0.36)]
    v, f, rings = M.tube(path, radii, sides=8, inflate=M.INFLATE_TUBE)
    o = M.new_object('torso', v, f, color=color)
    # weights by height: hips / spine / chest
    hips_top = zb + 0.06
    mid = (zb + zt) / 2
    bones = [('hips', Vector((0, 0, zb)), Vector((0, 0, hips_top))), ('spine', Vector((0, 0, hips_top)), Vector((0, 0, mid))), ('chest', Vector((0, 0, mid)), Vector((0, 0, zt)))]
    M.weight_by_bones(o, bones, blend=0.05)
    M.finish(o, levels=2)
    return o


def arms(P, skin, sleeve=None, sleeve_len=0.0, glove=None):
    """Upper arm + forearm as one soft tube per side, mitten hands. `sleeve` colours the top
    part of the tube down to `sleeve_len` (0..1 of the arm)."""
    out = []
    for side, s in (('L', 1), ('R', -1)):
        sh = Vector((P['shoulder'].x * s, P['shoulder'].y, P['shoulder'].z))
        el = Vector((P['elbow'].x * s, P['elbow'].y, P['elbow'].z))
        wr = Vector((P['wrist'].x * s, P['wrist'].y, P['wrist'].z))
        start = sh + Vector((-s * 0.02, 0, 0.012))
        path = [start, sh + (el - sh) * 0.5, el, el + (wr - el) * 0.5, wr]
        r0, r1 = P['upper_arm_r'], P['forearm_r']
        radii = [r0 * 1.05, r0, (r0 + r1) / 2, r1, r1 * 0.95]
        v, f, rings = M.tube(path, radii, sides=8)
        def col(co, _sh=sh, _wr=wr):
            t = (co.z - _wr.z) / max(1e-6, (_sh.z - _wr.z))
            t = max(0.0, min(1.0, t))
            if sleeve and t > 1.0 - sleeve_len:
                return sleeve
            return skin
        o = M.new_object(f'arm_{side}', v, f, color=skin)
        M.set_color(o, skin, col)
        bones = [(f'upper_arm_{side}', sh, el), (f'forearm_{side}', el, wr)]
        M.weight_by_bones(o, bones, blend=0.03)
        M.finish(o, levels=1)
        out.append(o)
        # mitten hand
        hd = Vector((P['hand'].x * s, P['hand'].y, P['hand'].z))
        hr = P['hand_r']
        v, f = M.box(hd, (hr.x * 2, hr.y * 2, hr.z * 2))
        h = M.new_object(f'hand_{side}', v, f, color=glove or skin, bone=f'hand_{side}')
        M.finish(h, levels=2)
        out.append(h)
        # thumb bump
        v, f = M.box(hd + Vector((-s * hr.x * 0.55, -hr.y * 0.5, hr.z * 0.25)), (hr.x * 0.7, hr.y * 0.8, hr.z * 0.8))
        t = M.new_object(f'thumb_{side}', v, f, color=glove or skin, bone=f'hand_{side}')
        M.finish(t, levels=2)
        out.append(t)
    return out


def legs(P, skin, sock=None, sock_len=0.0, tights=None):
    out = []
    for side, s in (('L', 1), ('R', -1)):
        hip = Vector((P['hip'].x * s, P['hip'].y, P['hip'].z))
        knee = Vector((P['knee'].x * s, P['knee'].y, P['knee'].z))
        ankle = Vector((P['ankle'].x * s, P['ankle'].y, P['ankle'].z))
        start = hip + Vector((0, 0, 0.035))
        path = [start, hip + (knee - hip) * 0.5, knee, knee + (ankle - knee) * 0.5, ankle - Vector((0, 0, 0.01))]
        r0, r1 = P['thigh_r'], P['shin_r']
        radii = [r0 * 0.9, r0, (r0 + r1) / 2, r1, r1 * 0.92]
        v, f, rings = M.tube(path, radii, sides=8)
        def col(co, _hip=hip, _ankle=ankle):
            t = (co.z - _ankle.z) / max(1e-6, (_hip.z - _ankle.z))
            if tights:
                return tights
            if sock and t < sock_len:
                return sock
            return skin
        o = M.new_object(f'leg_{side}', v, f, color=skin)
        M.set_color(o, skin, col)
        bones = [(f'thigh_{side}', hip, knee), (f'shin_{side}', knee, ankle)]
        M.weight_by_bones(o, bones, blend=0.03)
        M.finish(o, levels=1)
        out.append(o)
    return out


def shoes(P, color, sole=None, accent=None):
    out = []
    fs = P['foot_size']
    for side, s in (('L', 1), ('R', -1)):
        c = Vector((P['foot'].x * s, P['foot'].y, P['foot'].z))
        # rounded shoe: a box cage with a raised heel and a slightly wider toe
        v, f = M.box(c, (fs.x, fs.y, fs.z))
        v = [(x, y, z + (0.012 if y < c.y else 0.0)) for x, y, z in v]
        v = [(c.x + (x - c.x) * (1.08 if y < c.y else 0.96), y, z) for x, y, z in v]
        o = M.new_object(f'shoe_{side}', v, f, color=color, bone=f'foot_{side}')
        M.crease(o, [(0, 1), (1, 2), (2, 3), (3, 0)], 0.6)  # crisp sole edge
        M.finish(o, levels=2)
        out.append(o)
        if sole:
            v, f = M.box(c - Vector((0, 0, fs.z * 0.36)), (fs.x * 1.02, fs.y * 1.02, fs.z * 0.26))
            so = M.new_object(f'sole_{side}', v, f, color=sole, bone=f'foot_{side}')
            M.crease(so, [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4)], 0.8)
            M.finish(so, levels=2)
            out.append(so)
    return out
