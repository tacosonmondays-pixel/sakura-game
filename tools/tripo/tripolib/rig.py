"""Tripo biped rig (animate_rig, spec 'tripo') -> the game's readable bone names."""

TRIPO_RENAME = {
    'Root': 'root', 'Hip': 'hips', 'Pelvis': 'pelvis', 'Waist': 'spine', 'Spine01': 'spine1', 'Spine02': 'chest',
    'NeckTwist01': 'neck', 'NeckTwist02': 'neck2', 'Head': 'head',
    'L_Clavicle': 'shoulder_L', 'L_Upperarm': 'upper_arm_L', 'L_Forearm': 'forearm_L', 'L_Hand': 'hand_L',
    'R_Clavicle': 'shoulder_R', 'R_Upperarm': 'upper_arm_R', 'R_Forearm': 'forearm_R', 'R_Hand': 'hand_R',
    'L_Thigh': 'thigh_L', 'L_Calf': 'shin_L', 'L_Foot': 'foot_L', 'L_ToeBase': 'toe_L',
    'R_Thigh': 'thigh_R', 'R_Calf': 'shin_R', 'R_Foot': 'foot_R', 'R_ToeBase': 'toe_R',
}

_PART = {'Upperarm': 'upper_arm', 'Forearm': 'forearm', 'Thigh': 'thigh', 'Calf': 'shin'}


def twist_name(n):
    """L_UpperarmTwist01 -> upper_arm_twist1_L (twist bones only follow their limb)."""
    side = n[0]
    part = n[2:].split('Twist')[0]
    return f'{_PART.get(part, part.lower())}_twist{int(n[-2:])}_{side}'


def rename(arm):
    for b in arm.data.bones:
        if b.name in TRIPO_RENAME:
            b.name = TRIPO_RENAME[b.name]
        elif 'Twist' in b.name and b.name[:2] in ('L_', 'R_'):
            b.name = twist_name(b.name)


def face_front_biped(arm, meshes, normalize):
    """Tripo's biped faces +X in Blender: turn it to -Y, pivot between the feet, feet on z = 0, 1 m tall."""
    normalize.bake_world(arm, meshes, normalize.Matrix.Rotation(-1.5707963267948966, 4, 'Z'))
    fl, fr = (arm.matrix_world @ arm.data.bones[b].head_local for b in ('L_Foot', 'R_Foot'))
    lo, _ = normalize.bounds(meshes)
    normalize.bake_world(arm, meshes, normalize.Matrix.Translation((-(fl.x + fr.x) / 2, -(fl.y + fr.y) / 2, -lo.z)))
    normalize.scale_to(arm, meshes, 1.0)
