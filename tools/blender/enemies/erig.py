"""Enemy armatures. Families describe their bones as [(name, head, tail, parent)] in
enemy space (Blender Z-up, facing -Y, feet at z=0); this builds the armature, binds every
part and normalises the weights (tools/blender/lib/rig.py does the Blender work).

Archetype bone sets (families may add tail/wing/extra bones):
  blob   root, body, top
  biped  root, hips, chest, head, arm_L, arm_R, leg_L, leg_R
  quad   root, body, head, leg_FL, leg_FR, leg_BL, leg_BR, tail
"""
from mathutils import Vector

from lib import rig as R


def blob_bones(h, top=0.62):
    """Blob of height h: body (squash) + top (crown / fuse / hat wobble)."""
    return [
        ('root', Vector((0, 0, 0)), Vector((0, 0, 0.1)), None),
        ('body', Vector((0, 0, 0.02)), Vector((0, 0, h * top)), 'root'),
        ('top', Vector((0, 0, h * top)), Vector((0, 0, h)), 'body'),
    ]


def biped_bones(P):
    """P: dict with hips_z, chest_z, head_z, head_top, shoulder (Vector), hand (Vector),
    hip (Vector), foot (Vector)."""
    sh, hd, hp, ft = P['shoulder'], P['hand'], P['hip'], P['foot']
    B = [
        ('root', Vector((0, 0, 0)), Vector((0, 0, 0.1)), None),
        ('hips', Vector((0, 0, P['hips_z'])), Vector((0, 0, P['chest_z'])), 'root'),
        ('chest', Vector((0, 0, P['chest_z'])), Vector((0, 0, P['head_z'])), 'hips'),
        ('head', Vector((0, 0, P['head_z'])), Vector((0, 0, P['head_top'])), 'chest'),
    ]
    for side, s in (('L', 1), ('R', -1)):
        B.append((f'arm_{side}', Vector((sh.x * s, sh.y, sh.z)), Vector((hd.x * s, hd.y, hd.z)), 'chest'))
        B.append((f'leg_{side}', Vector((hp.x * s, hp.y, hp.z)), Vector((ft.x * s, ft.y, ft.z)), 'hips'))
    return B


def quad_bones(P):
    """P: body_z, body_len (y extent), head (Vector), head_top, leg_x, leg_y (front), leg_z, tail (list of Vectors)."""
    B = [
        ('root', Vector((0, 0, 0)), Vector((0, 0, 0.1)), None),
        ('body', Vector((0, P['body_len'] * 0.4, P['body_z'])), Vector((0, -P['body_len'] * 0.4, P['body_z'])), 'root'),
        ('head', Vector(P['head']), Vector(P['head_top']), 'body'),
    ]
    for side, s in (('L', 1), ('R', -1)):
        for fb, y in (('F', -P['leg_y']), ('B', P['leg_y'])):
            B.append((f'leg_{fb}{side}', Vector((P['leg_x'] * s, y, P['leg_z'])), Vector((P['leg_x'] * s, y, 0.0)), 'body'))
    tail = P.get('tail') or []
    prev = 'body'
    for i in range(len(tail) - 1):
        B.append((f'tail_{i + 1}', Vector(tail[i]), Vector(tail[i + 1]), prev))
        prev = f'tail_{i + 1}'
    return B


def wing_bones(root_z, span_x, root_y=0.0, parent='chest'):
    out = []
    for side, s in (('L', 1), ('R', -1)):
        out.append((f'wing_{side}', Vector((0.08 * s, root_y, root_z)), Vector((span_x * s, root_y, root_z + 0.15)), parent))
    return out


def build(ctx, scale=1.0):
    """Builds the armature from ctx['bones'] (scaled), binds ctx['parts'] and normalises."""
    bones = [(n, Vector(h) * scale, Vector(t) * scale, p) for n, h, t, p in ctx['bones']]
    arm = R.build_armature(bones, name=f"rig_{ctx['family']}")
    for o in ctx['parts']:
        R.bind(o, arm)
        R.normalize_weights(o)
    return arm
