# Owner's Meshy SmartRig bone ids -> readable names (no dots; three.js keeps them verbatim).
# Character faces +Z (glTF) / -Y (Blender); her left is +X.
RENAME = {
    'Bone_000': 'root', 'Bone_001': 'hips', 'Bone_004': 'spine', 'Bone_003': 'spine1', 'Bone_002': 'chest',
    'Bone_036': 'neck', 'Bone_035': 'head',
    'Bone_029': 'shoulder_L', 'Bone_028': 'upper_arm_L', 'Bone_027': 'forearm_L', 'Bone_026': 'wrist_L', 'Bone_025': 'hand_L',
    'Bone_038': 'finger1_L', 'Bone_037': 'finger2_L', 'Bone_041': 'thumb1_L', 'Bone_040': 'thumb2_L', 'Bone_039': 'thumb3_L',
    'Bone_034': 'shoulder_R', 'Bone_033': 'upper_arm_R', 'Bone_032': 'forearm_R', 'Bone_031': 'wrist_R', 'Bone_030': 'hand_R',
    'Bone_043': 'finger1_R', 'Bone_042': 'finger2_R', 'Bone_046': 'thumb1_R', 'Bone_045': 'thumb2_R', 'Bone_044': 'thumb3_R',
    'Bone_022': 'thigh_L', 'Bone_021': 'shin_L', 'Bone_020': 'foot_L', 'Bone_019': 'toe_L', 'Bone_018': 'toe_end_L',
    'Bone_017': 'thigh_R', 'Bone_016': 'shin_R', 'Bone_015': 'foot_R', 'Bone_014': 'toe_R', 'Bone_013': 'toe_end_R',
    'Bone_012': 'coat_L1', 'Bone_011': 'coat_L2', 'Bone_010': 'coat_L3', 'Bone_009': 'coat_L4',
    'Bone_008': 'coat_R1', 'Bone_007': 'coat_R2', 'Bone_006': 'coat_R3', 'Bone_005': 'coat_R4',
    'Bone_024': 'coat_back1', 'Bone_023': 'coat_back2',
    'Bone_048': 'bangs1', 'Bone_047': 'bangs2',
    'Bone_051': 'hair_back1', 'Bone_050': 'hair_back2', 'Bone_049': 'hair_back3',
    'Bone_057': 'hair_L1', 'Bone_056': 'hair_L2', 'Bone_055': 'hair_L3',
    'Bone_054': 'hair_R1', 'Bone_053': 'hair_R2', 'Bone_052': 'hair_R3',
}
# v1 Meshy humanoid (animation library skeleton) -> owner rig
RETARGET = {
    'Hips': 'root', 'Spine02': 'spine', 'Spine01': 'spine1', 'Spine': 'chest', 'neck': 'neck', 'Head': 'head',
    'LeftShoulder': 'shoulder_L', 'LeftArm': 'upper_arm_L', 'LeftForeArm': 'forearm_L', 'LeftHand': 'wrist_L',
    'RightShoulder': 'shoulder_R', 'RightArm': 'upper_arm_R', 'RightForeArm': 'forearm_R', 'RightHand': 'wrist_R',
    'LeftUpLeg': 'thigh_L', 'LeftLeg': 'shin_L', 'LeftFoot': 'foot_L', 'LeftToeBase': 'toe_L',
    'RightUpLeg': 'thigh_R', 'RightLeg': 'shin_R', 'RightFoot': 'foot_R', 'RightToeBase': 'toe_R',
}
