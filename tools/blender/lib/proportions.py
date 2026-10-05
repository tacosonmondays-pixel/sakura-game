"""Chibi proportions in world units (feet at z=0). Girls are 0.9 tall with the head ≈45% of
the height; heroes (adults) are 0.98 tall with a slightly smaller head (≈38%), a longer torso
and legs, but still clearly chibi."""
from mathutils import Vector


def proportions(adult=False):
    if not adult:
        P = dict(
            height=0.90,
            head_center=Vector((0, 0.005, 0.705)),
            head_radii=Vector((0.200, 0.190, 0.200)),   # x (width), y (depth), z (height)
            chin_z=0.505, neck_r=0.045, neck_z=(0.47, 0.56),
            shoulder_z=0.470, shoulder_x=0.090, torso_top=0.505, torso_bottom=0.245,
            torso_w=(0.200, 0.168, 0.190), torso_d=(0.145, 0.130, 0.150),  # shoulders / waist / hips (full widths)
            waist_z=0.36,
            elbow=Vector((0.118, -0.010, 0.372)), wrist=Vector((0.128, -0.026, 0.292)), hand=Vector((0.133, -0.038, 0.250)),
            upper_arm_r=0.036, forearm_r=0.031, hand_r=Vector((0.042, 0.036, 0.050)),
            hip=Vector((0.052, 0.0, 0.255)), knee=Vector((0.056, 0.004, 0.150)), ankle=Vector((0.056, 0.0, 0.062)),
            thigh_r=0.050, shin_r=0.043,
            foot=Vector((0.056, -0.018, 0.036)), foot_size=Vector((0.088, 0.145, 0.072)),
            halo_z=0.965,
            eye_v=0.40,
        )
    else:
        P = dict(
            height=0.98,
            head_center=Vector((0, 0.005, 0.790)),
            head_radii=Vector((0.190, 0.182, 0.192)),
            chin_z=0.598, neck_r=0.040, neck_z=(0.56, 0.66),
            shoulder_z=0.565, shoulder_x=0.098, torso_top=0.600, torso_bottom=0.300,
            torso_w=(0.210, 0.160, 0.195), torso_d=(0.140, 0.120, 0.150),
            waist_z=0.43,
            elbow=Vector((0.124, -0.012, 0.445)), wrist=Vector((0.135, -0.032, 0.345)), hand=Vector((0.141, -0.044, 0.300)),
            upper_arm_r=0.034, forearm_r=0.030, hand_r=Vector((0.040, 0.035, 0.050)),
            hip=Vector((0.052, 0.0, 0.305)), knee=Vector((0.058, 0.004, 0.175)), ankle=Vector((0.058, 0.0, 0.065)),
            thigh_r=0.048, shin_r=0.041,
            foot=Vector((0.058, -0.018, 0.036)), foot_size=Vector((0.086, 0.150, 0.072)),
            halo_z=1.04,
            eye_v=0.42,
        )
    P['adult'] = adult
    P['shoulder'] = Vector((P['shoulder_x'], 0.0, P['shoulder_z']))
    return P
