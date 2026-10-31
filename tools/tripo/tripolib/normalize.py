"""Shared Blender steps for Tripo downloads: import, face the game's front, floor pivot, height.

Tripo's text-to-model GLBs come in at a 1 m bounding box (Y up in glTF); its biped auto-rig
(animate_rig, spec 'tripo') faces +X in Blender with the bind-pose skeleton matching the mesh.
Everything here ends with the figure facing -Y in Blender (glTF +Z, the game's front), Z up,
the pivot on the floor between the feet (or under the centre for props), transforms applied."""
import math

import bpy
from mathutils import Matrix, Vector


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    bpy.ops.import_scene.gltf(filepath=path)
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and o.name.startswith('Icosphere'):  # importer's bone display shape
            bpy.data.objects.remove(o)
    arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    return (arms[0] if arms else None), meshes


def _apply(ob, M):
    """Bakes the world matrix M into ob's data (mesh vertices or armature rest bones)."""
    if ob.type == 'MESH':
        ob.data.transform(M)
    elif ob.type == 'ARMATURE':
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.mode_set(mode='EDIT')
        for eb in ob.data.edit_bones:
            eb.transform(M)
        bpy.ops.object.mode_set(mode='OBJECT')


def bake_world(arm, meshes, M=Matrix()):
    """Applies every object's world matrix (times M) to its data so all objects sit at identity,
    keeping the mesh's armature binding (both the rest bones and the vertices move together)."""
    bpy.context.view_layer.update()
    mw = {o.name: o.matrix_world.copy() for o in ([arm] if arm else []) + meshes}
    for o in meshes:
        o.parent = None
    if arm:
        arm.matrix_world = Matrix()
        _apply(arm, M @ mw[arm.name])
    for o in meshes:
        o.matrix_world = Matrix()
        _apply(o, M @ mw[o.name])
        if arm:
            o.parent = arm
            o.matrix_parent_inverse = Matrix()
    bpy.context.view_layer.update()


def bounds(meshes):
    pts = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def face_front(arm, meshes, yaw_deg, pivot=None):
    """Turns the figure by yaw_deg about Z (so it faces -Y), puts `pivot` (x, y in the turned frame;
    default the bounds centre) at the origin and the lowest vertex on z = 0."""
    R = Matrix.Rotation(math.radians(yaw_deg), 4, 'Z')
    bake_world(arm, meshes, R)
    lo, hi = bounds(meshes)
    cx, cy = pivot if pivot is not None else ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2)
    bake_world(arm, meshes, Matrix.Translation((-cx, -cy, -lo.z)))
    return bounds(meshes)


def scale_to(arm, meshes, height):
    lo, hi = bounds(meshes)
    s = height / (hi.z - lo.z)
    bake_world(arm, meshes, Matrix.Scale(s, 4))
    return s


def join(meshes):
    """Joins mesh objects into the first (world transforms applied); returns it."""
    if len(meshes) == 1:
        return meshes[0]
    for o in bpy.data.objects:
        o.select_set(o in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    return bpy.context.view_layer.objects.active


def weld(ob, dist=1e-5):
    """Merges the seam-split vertices (Tripo splits the mesh at every UV seam)."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bm.to_mesh(ob.data)
    bm.free()


def decimate(ob, target_tris):
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if tris <= target_tris:
        return tris
    bpy.context.view_layer.objects.active = ob
    m = ob.modifiers.new('dec', 'DECIMATE')
    m.decimate_type = 'COLLAPSE'
    m.ratio = target_tris / tris
    m.use_collapse_triangulate = True
    while ob.modifiers[0] != m:
        bpy.ops.object.modifier_move_up(modifier=m.name)
    bpy.ops.object.modifier_apply(modifier=m.name)
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def name_base_image(meshes, name='base'):
    """Names the base colour image 'base' (the pack step resizes that one) and unlinks every other texture
    (website downloads carry normal and metal/roughness maps too: the game's figurine shading uses base colour)."""
    found = None
    for o in meshes:
        for slot in o.material_slots:
            mat = slot.material
            if not mat or not mat.use_nodes:
                continue
            nt = mat.node_tree
            bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            base = None
            if bsdf and bsdf.inputs['Base Color'].is_linked:
                n = bsdf.inputs['Base Color'].links[0].from_node
                while n and n.type != 'TEX_IMAGE' and n.inputs and any(i.is_linked for i in n.inputs):
                    n = next(i for i in n.inputs if i.is_linked).links[0].from_node
                base = n if n and n.type == 'TEX_IMAGE' else None
            if base is None:
                base = next((n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image), None)
            keep = base.name if base else None  # (bpy hands out a new wrapper per access: compare names, not `is`)
            for n in list(nt.nodes):
                if n.type == 'TEX_IMAGE' and n.name != keep:
                    nt.nodes.remove(n)
            base = nt.nodes.get(keep) if keep else None
            if bsdf:
                for k in ('Normal', 'Metallic', 'Roughness'):
                    for l in list(bsdf.inputs[k].links):
                        nt.links.remove(l)
                bsdf.inputs['Metallic'].default_value = 0.0
                bsdf.inputs['Roughness'].default_value = 1.0
            for n in list(nt.nodes):
                if n.type == 'NORMAL_MAP' or n.type == 'SEPARATE_COLOR':
                    nt.nodes.remove(n)
            if base and base.image and found is None:
                base.image.name = name
                found = base.image
    return found


def export_glb(path, objects, animations=True):
    for o in bpy.data.objects:
        o.select_set(o in objects)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_animations=animations,
        export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=1,
        export_optimize_animation_size=True, export_anim_single_armature=True, export_reset_pose_bones=True,
        export_skins=True, export_all_influences=False, export_morph=False, export_normals=True,
        export_tangents=False, export_texcoords=True, export_image_format='AUTO', export_yup=True,
        export_apply=False, export_extras=False, export_def_bones=False, export_current_frame=False)
