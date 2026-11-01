"""Stock humanoid clips onto the game's rigs: Quaternius' Universal Animation Library (CC0 1.0, its License.txt;
https://quaternius.itch.io/universal-animation-library, the free Standard pack, `UAL1_Standard.glb`).

Animation data only: the library's mannequin mesh is deleted the moment the file is imported and never rendered,
exported or committed (CLAUDE.md: no third-party meshes). The pack itself is not in git; pass its path.

Method (world-axis deltas, tools/meshy/lib/posekit.py): for each mapped source bone, its world rotation in a frame
times the inverse of its world rotation in the library's T-pose ('A_TPose', frame 0) is the motion relative to a
T-pose; the game's re-rigged heroes rest in a T-pose, so the same world delta is applied to the mapped target bone
as an absolute override. The pelvis' vertical travel is scaled by the hip-height ratio (adult hips at half the
height, a chibi's at a quarter). Bones the library does not have (tails, twin tails, twist bones) follow their
parents; the arm that holds a prop keeps its IK grip (tripolib/clips_hero.py)."""
import bpy
from mathutils import Matrix, Quaternion, Vector

# game bone -> library bone (UE-style names in UAL v2+)
MAP = {
    'hips': 'pelvis', 'spine': 'spine_01', 'chest': 'spine_03', 'neck': 'neck_01', 'head': 'Head',
    'shoulder_L': 'clavicle_l', 'upper_arm_L': 'upperarm_l', 'forearm_L': 'lowerarm_l', 'hand_L': 'hand_l',
    'shoulder_R': 'clavicle_r', 'upper_arm_R': 'upperarm_r', 'forearm_R': 'lowerarm_r', 'hand_R': 'hand_r',
    'thigh_L': 'thigh_l', 'shin_L': 'calf_l', 'foot_L': 'foot_l', 'toe_L': 'ball_l',
    'thigh_R': 'thigh_r', 'shin_R': 'calf_r', 'foot_R': 'foot_r', 'toe_R': 'ball_r',
}
REF = 'A_TPose'


def _rot(M):
    m = M.to_3x3()
    m.normalize()
    return m.to_quaternion()


def sample(path, clips, fps=30):
    """{clip: [frame: ({game bone: world delta Quaternion}, pelvis offset Vector)]}, the source hip height and the
    facing correction applied. The library objects are removed before returning."""
    before = set(bpy.data.objects)
    acts_before = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.type == 'MESH':
            bpy.data.objects.remove(o)  # the mannequin: never kept
    src = next(o for o in bpy.data.objects if o not in before and o.type == 'ARMATURE')
    acts = {a.name: a for a in bpy.data.actions if a not in acts_before}

    def find(name):
        for k, a in acts.items():
            if k == name or k.startswith(name + '_') or k.startswith(name + '|'):
                return a
        raise KeyError(f'{name} not in {sorted(acts)}')

    def frame_world(act, f):
        src.animation_data.action = act
        bpy.context.scene.frame_set(int(f))
        bpy.context.view_layer.update()
        mw = src.matrix_world
        return {g: (mw @ src.pose.bones[s].matrix) for g, s in MAP.items() if s in src.pose.bones}

    ref = frame_world(find(REF), find(REF).frame_range[0])
    ref_rot = {g: _rot(M) for g, M in ref.items()}
    hip0 = ref['hips'].translation.copy()
    # facing: the library's toes point along `fwd`; the game's figures face -Y
    fwd = (ref['toe_L'].translation - ref['foot_L'].translation)
    fwd.z = 0
    fwd.normalize()
    C = fwd.rotation_difference(Vector((0, -1, 0)))
    out = {}
    for clip in clips:
        act = find(clip)
        f0, f1 = (int(round(x)) for x in act.frame_range)
        frames = []
        for f in range(f0, f1 + 1):
            W = frame_world(act, f)
            d = {g: C @ (_rot(M) @ ref_rot[g].inverted()) @ C.inverted() for g, M in W.items()}
            off = C @ (W['hips'].translation - hip0)
            frames.append((d, off))
        out[clip] = frames
    src_scale = hip0.z
    for o in [o for o in bpy.data.objects if o not in before]:
        bpy.data.objects.remove(o)
    for a in [a for a in bpy.data.actions if a not in acts_before]:
        bpy.data.actions.remove(a)
    return out, src_scale
