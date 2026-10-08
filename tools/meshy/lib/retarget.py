"""Retarget Meshy animation-library clips (standard Meshy humanoid: Hips, Spine02, ..., RightHand)
onto another rig by world-space rotation deltas from each rest pose:
    target_world(t) = source_world(t) * source_rest^-1 * target_rest
Both rigs come from Meshy in a similar A-pose, so the deltas carry over; the hips translation is
scaled by the leg-length ratio. Result: one 'raw_<name>' action per clip, a key on every frame."""
import bpy

from .posekit import rotq


def retarget(tgt, clips_glb, bone_map, clip_names):
    before = set(bpy.data.objects)
    actions_before = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=clips_glb)
    new = [o for o in bpy.data.objects if o not in before]
    src = [o for o in new if o.type == 'ARMATURE'][0]
    for o in new:
        if o.type == 'MESH':
            bpy.data.objects.remove(o)
    src_actions = [a for a in bpy.data.actions if a not in actions_before]
    sc = bpy.context.scene

    def rest_w(arm, n):
        return arm.matrix_world @ arm.data.bones[n].matrix_local

    order = []

    def walk(b):
        order.append(b.name)
        for c in b.children:
            walk(c)
    for b in tgt.data.bones:
        if b.parent is None:
            walk(b)
    R = {n: tgt.data.bones[n].matrix_local.copy() for n in order}
    inv = {v: k for k, v in bone_map.items()}
    root = [n for n in order if tgt.data.bones[n].parent is None][0]
    src_root = inv[root]
    k_leg = ((rest_w(tgt, 'thigh_L').translation.z - rest_w(tgt, 'foot_L').translation.z)
             / (rest_w(src, 'LeftUpLeg').translation.z - rest_w(src, 'LeftFoot').translation.z))
    src_root_rest = rest_w(src, src_root).translation.copy()
    tgt.animation_data_create()
    src.animation_data_create()
    made = {}
    for prefix, out_name in clip_names.items():
        act = [a for a in src_actions if a.name.startswith(prefix)][0]
        src.animation_data.action = act
        f0, f1 = int(round(act.frame_range[0])), int(round(act.frame_range[1]))
        out = bpy.data.actions.new(out_name)
        out.use_fake_user = True
        tgt.animation_data.action = out
        for pb in tgt.pose.bones:
            pb.rotation_mode = 'QUATERNION'
        for f in range(f0, f1 + 1):
            sc.frame_set(f)
            M = {}
            for n in order:
                p = tgt.data.bones[n].parent
                base = R[n].copy() if p is None else M[p.name] @ (R[p.name].inverted() @ R[n])
                Mt = base
                if n in inv:
                    s = inv[n]
                    D = rotq(src.matrix_world @ src.pose.bones[s].matrix) @ rotq(rest_w(src, s)).inverted()
                    Mt = (D @ rotq(R[n])).to_matrix().to_4x4()
                    Mt.translation = base.translation
                    if n == root:
                        dp = (src.matrix_world @ src.pose.bones[s].matrix).translation - src_root_rest
                        Mt.translation = base.translation + dp * k_leg
                M[n] = Mt
                basis = R[n].inverted() @ Mt if p is None else (R[p.name].inverted() @ R[n]).inverted() @ M[p.name].inverted() @ Mt
                if n in inv:
                    pb = tgt.pose.bones[n]
                    pb.rotation_quaternion = basis.to_quaternion()
                    pb.keyframe_insert('rotation_quaternion', frame=f - f0, group=n)
                    if n == root:
                        pb.location = basis.translation
                        pb.keyframe_insert('location', frame=f - f0, group=n)
        made[out_name] = (f1 - f0) / sc.render.fps
    tgt.animation_data.action = None
    for pb in tgt.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    bpy.data.objects.remove(src)
    for a in src_actions:
        bpy.data.actions.remove(a)
    return made, k_leg
