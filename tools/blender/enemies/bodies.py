"""Shared enemy bodies: the chunky Nendoroid biped (head ≈ body, stubby limbs, mitten
hands, big feet) and the quadruped. Families call these, then add their own features
(ears, tusks, horns, tails...) and props. All in enemy space (Z up, facing -Y)."""
import math
from mathutils import Vector

from lib import mesh as M
import parts as P
import erig


def biped_props(height=1.0, head=0.27, bulk=1.0, hunch=0.0, legs=0.2, arms=1.0):
    """Proportions for a biped of the given height. head = head radius fraction of height."""
    hr = height * head
    head_c = Vector((0, hunch * 0.12, height - hr * 0.98))
    leg_len = height * legs
    torso_top = head_c.z - hr * 0.82
    torso_bottom = leg_len * 0.85
    tc = Vector((0, hunch * 0.06, (torso_top + torso_bottom) / 2))
    tr = Vector((hr * 0.78 * bulk, hr * 0.66 * bulk, (torso_top - torso_bottom) / 2 * 1.05))
    shoulder = Vector((tr.x * 0.9, -0.01, tc.z + tr.z * 0.55))
    hand = Vector((tr.x * 1.15 + hr * 0.25 * arms, -0.05 - hunch * 0.15, tc.z - tr.z * 0.65 * arms))
    hip = Vector((tr.x * 0.42, 0.0, torso_bottom + 0.02))
    foot = Vector((tr.x * 0.5, -0.03, 0.0))
    return dict(
        height=height, head_c=head_c, head_r=Vector((hr, hr * 0.94, hr)), torso_c=tc, torso_r=tr,
        hips_z=torso_bottom, chest_z=tc.z + tr.z * 0.2, head_z=torso_top + 0.02, head_top=height,
        shoulder=shoulder, hand=hand, hip=hip, foot=foot,
        arm_r=hr * 0.22 * bulk, leg_r=hr * 0.26 * bulk, foot_size=Vector((hr * 0.5, hr * 0.7, hr * 0.32)),
        belt_z=tc.z - tr.z * 0.15, hunch=hunch,
    )


def biped(ctx, P_, skin=(1, 1, 1), skin_role='main', cloth=None, cloth_role='accent', hands=True, feet=True, head_shape=P.head_shape,
          levels=2, head_levels=2, face_box=None, face_window=0.2, shoes=None, torso_shape=None, hand_color=None):
    """Builds the body parts into ctx and returns the prop anchors."""
    hc, hr = P_['head_c'], P_['head_r']
    parts = []
    head = P.head('head', hc, hr, skin, skin_role, 'head', levels=head_levels, shape=head_shape, face_box=face_box, window=face_window, group='head')
    parts.append(head)
    tc, tr = P_['torso_c'], P_['torso_r']
    torso = P.blob('torso', tc, tr, skin, skin_role, None, levels=levels, shape=torso_shape, group='torso')
    if cloth is not None:
        belt = P_['belt_z']
        P.paint(torso, skin, skin_role, fn=lambda co: ((cloth, cloth_role) if co.z < belt else (skin, skin_role)))
    P.weight_segments(torso, [('hips', Vector((0, 0, P_['hips_z'])), Vector((0, 0, P_['chest_z']))), ('chest', Vector((0, 0, P_['chest_z'])), Vector((0, 0, P_['head_z'])))], blend=0.12)
    parts.append(torso)
    sh, hd, hp, ft = P_['shoulder'], P_['hand'], P_['hip'], P_['foot']
    ar, lr = P_['arm_r'], P_['leg_r']
    for side, s in (('L', 1), ('R', -1)):
        a0 = Vector((sh.x * s, sh.y, sh.z))
        a1 = Vector((hd.x * s, hd.y, hd.z))
        arm = P.tube(f'arm_{side}', [a0 - (a1 - a0) * 0.1, a0 + (a1 - a0) * 0.5, a1], [ar * 1.05, ar, ar * 0.9], skin, skin_role, f'arm_{side}', sides=8, levels=1, group='arms')
        parts.append(arm)
        if hands:
            parts.append(P.blob(f'hand_{side}', a1 + Vector((s * ar * 0.5, 0, -ar * 0.3)), (ar * 1.35, ar * 1.2, ar * 1.5), hand_color or skin, 'fixed' if hand_color else skin_role, f'arm_{side}', levels=1, group='arms'))
        l0 = Vector((hp.x * s, hp.y, hp.z))
        l1 = Vector((ft.x * s, ft.y, ft.z + lr * 0.6))
        leg = P.tube(f'leg_{side}', [l0 + Vector((0, 0, 0.03)), l0.lerp(l1, 0.5), l1], [lr, lr, lr * 0.95], skin, skin_role, f'leg_{side}', sides=8, levels=1, group='legs')
        parts.append(leg)
        if feet:
            fs = P_['foot_size']
            foot = P.blob(f'foot_{side}', Vector((ft.x * s, ft.y - fs.y * 0.2, fs.z * 0.5)), (fs.x, fs.y, fs.z), shoes or skin, 'fixed' if shoes else skin_role, f'leg_{side}', levels=1, group='legs')
            parts.append(foot)
    ctx['parts'] += parts
    ctx['bones'] = erig.biped_bones(P_)
    ctx['height'] = P_['height']
    A = dict(head=(hc, hr), bone_head='head', top=Vector((hc.x, hc.y, hc.z + hr.z * 0.98)),
             back=Vector((0, tr.y * 0.92, tc.z + tr.z * 0.45)), bone_back='chest',
             hand_R=Vector((-hd.x, hd.y, hd.z)), bone_hand_R='arm_R', hand_L=Vector((hd.x, hd.y, hd.z)), bone_hand_L='arm_L',
             chest=Vector((0, -tr.y * 0.95, tc.z + tr.z * 0.15)), bone_chest='chest', chest_w=tr.x,
             neck=Vector((0, 0, hc.z - hr.z * 0.88)), neck_r=hr.x * 0.72, body_r=tr.x, s=P_['height'])
    ctx['anchors'] = A
    return A


def quad_props(height=0.85, length=0.9, head=0.22):
    hr = height * head
    body_z = height * 0.5
    return dict(
        height=height, body_c=Vector((0, 0.05, body_z)), body_r=Vector((length * 0.3, length * 0.5, height * 0.3)),
        head_c=Vector((0, -length * 0.55, body_z + height * 0.18)), head_r=Vector((hr, hr * 0.95, hr)),
        head=Vector((0, -length * 0.35, body_z + height * 0.08)), head_top=Vector((0, -length * 0.55, body_z + height * 0.18 + hr)),
        body_len=length, body_z=body_z, leg_x=length * 0.2, leg_y=length * 0.32, leg_z=body_z - height * 0.05, leg_r=height * 0.09,
        tail=[Vector((0, length * 0.48, body_z + height * 0.05)), Vector((0, length * 0.8, body_z + height * 0.22)), Vector((0.05, length * 1.05, body_z + height * 0.45))],
    )


def quad(ctx, P_, fur=(1, 1, 1), fur_role='main', belly=None, belly_role='accent', levels=2, head_levels=2, head_shape=P.head_shape, tail_r=0.07,
         tail=True, face_box=None, paws=None):
    hc, hr = P_['head_c'], P_['head_r']
    bc, br = P_['body_c'], P_['body_r']
    parts = []
    head = P.head('head', hc, hr, fur, fur_role, 'head', levels=head_levels, shape=head_shape, face_box=face_box, group='head')
    parts.append(head)
    body = P.blob('body', bc, br, fur, fur_role, 'body', levels=levels, group='torso')
    if belly is not None:
        P.paint(body, fur, fur_role, fn=lambda co: ((belly, belly_role) if co.z < bc.z - br.z * 0.3 else (fur, fur_role)))
    parts.append(body)
    lr = P_['leg_r']
    for side, s in (('L', 1), ('R', -1)):
        for fb, y in (('F', -P_['leg_y']), ('B', P_['leg_y'])):
            top = Vector((P_['leg_x'] * s, y, P_['leg_z']))
            bot = Vector((P_['leg_x'] * s, y, lr * 0.8))
            parts.append(P.tube(f'leg_{fb}{side}', [top + Vector((0, 0, 0.04)), top.lerp(bot, 0.5), bot], [lr * 1.1, lr, lr * 0.95], fur, fur_role, f'leg_{fb}{side}', sides=8, levels=1, group='legs'))
            parts.append(P.blob(f'paw_{fb}{side}', Vector((P_['leg_x'] * s, y - lr * 0.3, lr * 0.75)), (lr * 1.25, lr * 1.5, lr * 0.75), paws or fur, 'fixed' if paws else fur_role, f'leg_{fb}{side}', levels=1, group='legs'))
    if tail and P_.get('tail'):
        pts = M.smooth_path(P_['tail'], 8)
        t = P.tube('tail', pts, [tail_r * (1.0 - 0.75 * i / 7) + 0.008 for i in range(8)], fur, fur_role, None, sides=7, levels=1, tip_end=True, group='tail')
        bones = []
        tl = P_['tail']
        for i in range(len(tl) - 1):
            bones.append((f'tail_{i + 1}', tl[i], tl[i + 1]))
        P.weight_segments(t, bones + [('body', Vector((0, 0, bc.z)), Vector((0, br.y * 0.5, bc.z)))], blend=0.08)
        parts.append(t)
    ctx['parts'] += parts
    ctx['bones'] = erig.quad_bones(P_)
    ctx['height'] = P_['height']
    A = dict(head=(hc, hr), bone_head='head', top=Vector((hc.x, hc.y, hc.z + hr.z * 0.98)),
             back=Vector((0, 0.0, bc.z + br.z * 0.95)), bone_back='body',
             hand_R=Vector((-br.x * 1.1, -br.y * 0.3, bc.z)), bone_hand_R='body', hand_L=Vector((br.x * 1.1, -br.y * 0.3, bc.z)), bone_hand_L='body',
             chest=Vector((0, -br.y * 0.9, bc.z)), bone_chest='body', chest_w=br.x, neck=Vector((0, hc.y + hr.y * 0.9, hc.z - hr.z * 0.5)), neck_r=hr.x * 0.8,
             body_r=br.x, s=P_['height'])
    ctx['anchors'] = A
    return A


def ears(ctx, A, kind='pointy', color=(1, 1, 1), role='main', inner=None, size=1.0, az=72, el=28, bone='head', group='head'):
    """Pointy (goblin/elf), round (bear), tall (bunny/wolf) ears on the head surface."""
    c, r = A['head']
    out = []
    for s in (1, -1):
        base, n = P.surface(c, r, s * az, el, P.head_shape)
        if kind == 'pointy':
            tip = base + n * r.x * 1.1 * size + Vector((s * r.x * 0.2, 0, r.z * 0.25)) * size
            pts = [base - n * 0.02, base + n * r.x * 0.3 * size, base.lerp(tip, 0.6), tip]
            e = P.tube(f'ear_{s}', pts, [(r.x * 0.32 * size, r.x * 0.12), (r.x * 0.3 * size, r.x * 0.11), (r.x * 0.18 * size, r.x * 0.07), (0.001, 0.001)], color, role, bone, sides=6, levels=1, tip_end=True, up=Vector((0, -1, 0)), group=group)
            out.append(e)
            if inner:
                pts2 = [p - Vector((0, 0.012, 0)) for p in pts[1:]]
                i = P.tube(f'earin_{s}', pts2, [(r.x * 0.16 * size, r.x * 0.05), (r.x * 0.1 * size, r.x * 0.04), (0.001, 0.001)], inner, 'fixed', bone, sides=6, levels=1, tip_end=True, up=Vector((0, -1, 0)), group=group)
                out.append(i)
        elif kind == 'round':
            e = P.blob(f'ear_{s}', base + n * r.x * 0.25 * size, (r.x * 0.36 * size, r.x * 0.2 * size, r.x * 0.36 * size), color, role, bone, levels=1, group=group)
            out.append(e)
            if inner:
                out.append(P.blob(f'earin_{s}', base + n * r.x * 0.36 * size, (r.x * 0.2 * size, r.x * 0.12 * size, r.x * 0.2 * size), inner, 'fixed', bone, levels=1, group=group))
        elif kind == 'tall':
            tip = base + Vector((s * r.x * 0.25, -0.02, r.z * 0.9)) * size
            pts = [base - n * 0.02, base + n * r.x * 0.15, base.lerp(tip, 0.55), tip]
            e = P.tube(f'ear_{s}', pts, [(r.x * 0.28 * size, r.x * 0.14), (r.x * 0.3 * size, r.x * 0.14), (r.x * 0.2 * size, r.x * 0.1), (0.001, 0.001)], color, role, bone, sides=6, levels=1, tip_end=True, up=Vector((0, -1, 0)), group=group)
            out.append(e)
            if inner:
                pts2 = [p - Vector((0, 0.015, 0)) for p in pts[1:]]
                out.append(P.tube(f'earin_{s}', pts2, [(r.x * 0.15 * size, r.x * 0.05), (r.x * 0.1 * size, r.x * 0.04), (0.001, 0.001)], inner, 'fixed', bone, sides=6, levels=1, tip_end=True, up=Vector((0, -1, 0)), group=group))
    ctx['parts'] += out
    return out


def snout(ctx, A, color=(1, 1, 1), role='main', size=1.0, nose='#2a2224', bone='head', group='head', drop=0.2):
    """A muzzle blob on the lower face + a nose."""
    c, r = A['head']
    base, n = P.surface(c, r, 0, -drop * 60, P.head_shape)
    m = P.blob('snout', base + n * r.y * 0.15 * size, (r.x * 0.42 * size, r.y * 0.35 * size, r.z * 0.3 * size), color, role, bone, levels=1, group=group)
    out = [m]
    if nose:
        out.append(P.blob('nose', base + n * r.y * 0.48 * size + Vector((0, 0, r.z * 0.12 * size)), (r.x * 0.13 * size, r.y * 0.1 * size, r.z * 0.09 * size), nose, 'fixed', bone, levels=1, group=group))
    ctx['parts'] += out
    return out


def tusks(ctx, A, color='#fff6dc', size=1.0, bone='head', group='head', up=True, spread=0.3):
    c, r = A['head']
    out = []
    for s in (1, -1):
        base, n = P.surface(c, r, s * 22, -38, P.head_shape)
        d = (n * 0.4 + Vector((s * spread, -0.3, 0.9 if up else -0.6))).normalized()
        out.append(P.tube(f'tusk_{s}', [base - n * 0.01, base + d * r.x * 0.2 * size, base + d * r.x * 0.42 * size], [r.x * 0.1 * size, r.x * 0.08 * size, 0.001], color, 'fixed', bone, sides=6, levels=1, tip_end=True, group=group))
    ctx['parts'] += out
    return out


def hair_tuft(ctx, A, color='#2b2d42', n=5, size=1.0, bone='head', group='head'):
    """Wild hair: a few broad creased spikes on the crown, swept back."""
    c, r = A['head']
    out = []
    for i in range(n):
        az = 180 + (i - (n - 1) / 2) * 34
        base, nrm = P.surface(c, r, az, 55, P.head_shape)
        d = (nrm * 0.6 + Vector((0, 0.5, 0.7))).normalized()
        out.append(P.tube(f'tuft_{i}', [base - nrm * 0.03, base + d * r.z * 0.25 * size, base + d * r.z * 0.55 * size], [(r.x * 0.26, r.x * 0.16), (r.x * 0.2, r.x * 0.12), (0.001, 0.001)], color, 'fixed', bone, sides=6, levels=1, tip_end=True, up=Vector((0, 0, 1)), group=group))
    ctx['parts'] += out
    return out
