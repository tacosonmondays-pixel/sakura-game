"""Armature: root, hips, spine, chest, neck, head, shoulder/upper_arm/forearm/hand L/R,
thigh/shin/foot L/R, halo, optional hair bones (hair_back, tail_L, tail_R). Bone names have
no dots so three.js keeps them verbatim in animation track names."""
import bpy
from mathutils import Vector, Matrix, Quaternion


def bone_table(P, hair_bones=()):
    """[(name, head, tail, parent)] in armature space (Blender Z-up)."""
    hc = P['head_center']
    sh = P['shoulder']
    el, wr, hd = P['elbow'], P['wrist'], P['hand']
    hip, knee, ankle = P['hip'], P['knee'], P['ankle']
    tz = P['torso_bottom']
    top = P['torso_top']
    mid = (tz + top) / 2
    B = [
        ('root', Vector((0, 0, 0)), Vector((0, 0, 0.08)), None),
        ('hips', Vector((0, 0, tz)), Vector((0, 0, tz + 0.06)), 'root'),
        ('spine', Vector((0, 0, tz + 0.06)), Vector((0, 0, mid)), 'hips'),
        ('chest', Vector((0, 0, mid)), Vector((0, 0, top)), 'spine'),
        ('neck', Vector((0, 0, top)), Vector((0, 0, P['chin_z'] + 0.03)), 'chest'),
        ('head', Vector((0, 0, P['chin_z'] + 0.03)), Vector((0, 0, hc.z + P['head_radii'].z)), 'neck'),
        ('halo', Vector((0, 0, P['halo_z'])), Vector((0, 0, P['halo_z'] + 0.05)), 'head'),
    ]
    for side, s in (('L', 1), ('R', -1)):
        m = Vector((s, 1, 1))
        B += [
            (f'shoulder_{side}', Vector((0, 0, sh.z)) * 1, Vector((sh.x * s, sh.y, sh.z)), 'chest'),
            (f'upper_arm_{side}', Vector((sh.x * s, sh.y, sh.z)), Vector((el.x * s, el.y, el.z)), f'shoulder_{side}'),
            (f'forearm_{side}', Vector((el.x * s, el.y, el.z)), Vector((wr.x * s, wr.y, wr.z)), f'upper_arm_{side}'),
            (f'hand_{side}', Vector((wr.x * s, wr.y, wr.z)), Vector((hd.x * s, hd.y, hd.z - 0.04)), f'forearm_{side}'),
            (f'thigh_{side}', Vector((hip.x * s, hip.y, hip.z)), Vector((knee.x * s, knee.y, knee.z)), 'hips'),
            (f'shin_{side}', Vector((knee.x * s, knee.y, knee.z)), Vector((ankle.x * s, ankle.y, ankle.z)), f'thigh_{side}'),
            (f'foot_{side}', Vector((ankle.x * s, ankle.y, ankle.z)), Vector((ankle.x * s, ankle.y - 0.09, 0.02)), f'shin_{side}'),
        ]
    for name, head, tail, parent in hair_bones:
        B.append((name, Vector(head), Vector(tail), parent))
    return B


def build_armature(bones, name='Armature'):
    arm = bpy.data.armatures.new(name)
    obj = bpy.data.objects.new(name, arm)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    ebs = {}
    for bname, head, tail, parent in bones:
        eb = arm.edit_bones.new(bname)
        eb.head = head
        eb.tail = tail
        eb.use_deform = True
        eb.use_connect = False
        ebs[bname] = eb
    for bname, head, tail, parent in bones:
        if parent:
            ebs[bname].parent = ebs[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)
    for pb in obj.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    return obj


def bind(mesh_obj, arm_obj):
    """Parents the mesh to the armature with an Armature modifier (weights come from the
    vertex groups the parts were built with)."""
    mesh_obj.parent = arm_obj
    mod = mesh_obj.modifiers.new('armature', 'ARMATURE')
    mod.object = arm_obj
    mod.use_vertex_groups = True
    # make sure every bone has a (possibly empty) group so the exporter keeps joints stable
    for b in arm_obj.data.bones:
        if not mesh_obj.vertex_groups.get(b.name):
            mesh_obj.vertex_groups.new(name=b.name)
    return mod


def normalize_weights(mesh_obj, limit=4):
    """Normalises vertex-group weights per vertex and keeps at most `limit` influences."""
    me = mesh_obj.data
    for v in me.vertices:
        gs = sorted(((g.weight, g.group) for g in v.groups), reverse=True)
        keep = gs[:limit]
        total = sum(w for w, _ in keep) or 1.0
        for w, g in gs:
            vg = mesh_obj.vertex_groups[g]
            if (w, g) in keep:
                vg.add([v.index], w / total, 'REPLACE')
            else:
                vg.remove([v.index])


def world_rot_to_local(arm_obj, bone_name, q_world):
    """Converts a rotation given in armature space into the pose bone's local space."""
    bone = arm_obj.data.bones[bone_name]
    M = bone.matrix_local.to_3x3()
    Mi = M.inverted()
    R = Mi @ q_world.to_matrix() @ M
    return R.to_quaternion()
