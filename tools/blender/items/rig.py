"""Item rig: scene, camera, the fixed light, the shared toon and ink materials, ink hulls, auto-fit, render.

Every item is lit and drawn by the same two materials. A part carries its colours and effect
amounts as object custom properties (`toon_*`, `ink_col`), which the materials read through
Attribute (Object) nodes, so EEVEE compiles two shaders for the whole set.

World axes while rendering: the orthographic camera looks along +Y, so screen x = world X and
screen up = world Z; -Y points at the viewer. The key light comes from the upper left and a
little toward the viewer (ITEM_STYLE 2.3), fixed in camera space for every item.
"""
import math

import bmesh
import bpy
from mathutils import Vector, Matrix

from lib.colors import linear

SIZE = 256                       # render size in px (square)
CENTER_PX = (119.0, 117.5)       # opaque bounding-box centre of the approved set (PLAN 2.1)
MAX_H_PX = 226.0                 # silhouette (without ink) fits this box; ink adds about 2.5 px a side
MAX_W_PX = 228.0
LIGHT = Vector((-0.50, -0.57, 0.65)).normalized()
VIEW = Vector((0.0, -1.0, 0.0))
HALF = (LIGHT + VIEW).normalized()
CAM_DIST = 50.0

ENGINES = ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT')


def _engine():
    items = bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items.keys()
    for e in ENGINES:
        if e in items:
            return e
    raise RuntimeError('no EEVEE engine in this Blender build: %s' % list(items))


# ---------------------------------------------------------------------------
# Scene
# ---------------------------------------------------------------------------

def setup_scene(samples=32):
    """Empties the factory scene and sets the render recipe (EEVEE, 256 px, transparent, Standard)."""
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    sc = bpy.context.scene
    r = sc.render
    r.engine = _engine()
    r.resolution_x = r.resolution_y = SIZE
    r.resolution_percentage = 100
    r.film_transparent = True
    r.filter_size = 1.2
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    r.image_settings.color_depth = '8'
    try:
        sc.eevee.taa_render_samples = samples
    except AttributeError:
        pass
    for attr, val in (('use_bloom', False), ('use_gtao', False), ('use_ssr', False), ('use_shadows', False),
                      ('use_raytracing', False), ('use_volumetric_shadows', False)):
        if hasattr(sc.eevee, attr):
            try:
                setattr(sc.eevee, attr, val)
            except (AttributeError, TypeError):
                pass
    vs = sc.view_settings
    vs.view_transform = 'Standard'
    vs.look = 'None'
    vs.exposure = 0.0
    vs.gamma = 1.0
    sc.display_settings.display_device = 'sRGB'
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs['Strength'].default_value = 0.0
    cam_data = bpy.data.cameras.new('ItemCam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 2.0
    cam_data.clip_start = 0.1
    cam_data.clip_end = 200.0
    cam = bpy.data.objects.new('ItemCam', cam_data)
    sc.collection.objects.link(cam)
    cam.rotation_euler = (math.radians(90), 0.0, 0.0)
    cam.location = (0.0, -CAM_DIST, 0.0)
    sc.camera = cam
    toon_material()
    ink_material()
    return cam


def clear_item():
    """Removes every object except the camera, and the orphaned meshes and curves."""
    for o in list(bpy.data.objects):
        if o.type != 'CAMERA':
            bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.curves):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)


# ---------------------------------------------------------------------------
# Node helpers
# ---------------------------------------------------------------------------

class _NB:
    """Tiny expression builder for shader node trees (floats and vectors)."""

    def __init__(self, tree):
        self.nodes = tree.nodes
        self.links = tree.links

    def _set(self, sock, val):
        if isinstance(val, bpy.types.NodeSocket):
            self.links.new(val, sock)
        elif val is not None:
            sock.default_value = val

    def attr(self, name, out='Vector'):
        n = self.nodes.new('ShaderNodeAttribute')
        n.attribute_type = 'OBJECT'
        n.attribute_name = name
        return n.outputs[out]

    def fattr(self, name):
        return self.attr(name, 'Fac')

    def const3(self, v):
        n = self.nodes.new('ShaderNodeCombineXYZ')
        for i, c in enumerate(v):
            n.inputs[i].default_value = c
        return n.outputs[0]

    def sep(self, v):
        n = self.nodes.new('ShaderNodeSeparateXYZ')
        self.links.new(v, n.inputs[0])
        return n.outputs[0], n.outputs[1], n.outputs[2]

    def m(self, op, a, b=None, c=None, clamp=False):
        n = self.nodes.new('ShaderNodeMath')
        n.operation = op
        n.use_clamp = clamp
        self._set(n.inputs[0], a)
        if b is not None:
            self._set(n.inputs[1], b)
        if c is not None:
            self._set(n.inputs[2], c)
        return n.outputs[0]

    def v(self, op, a, b=None, scale=None):
        n = self.nodes.new('ShaderNodeVectorMath')
        n.operation = op
        self._set(n.inputs[0], a)
        if b is not None:
            self._set(n.inputs[1], b)
        if scale is not None:
            self._set(n.inputs['Scale'], scale)
        return n.outputs['Value'] if op in ('DOT_PRODUCT', 'LENGTH', 'DISTANCE') else n.outputs['Vector']

    def dot(self, a, b):
        return self.v('DOT_PRODUCT', a, b)

    def smooth(self, x, lo, hi):
        n = self.nodes.new('ShaderNodeMapRange')
        n.interpolation_type = 'SMOOTHSTEP'
        n.clamp = True
        self._set(n.inputs['Value'], x)
        self._set(n.inputs['From Min'], lo)
        self._set(n.inputs['From Max'], hi)
        n.inputs['To Min'].default_value = 0.0
        n.inputs['To Max'].default_value = 1.0
        return n.outputs['Result']

    def mix(self, a, b, t):
        """a + (b - a) * t for vectors/colours."""
        d = self.v('SUBTRACT', b, a)
        return self.v('ADD', a, self.v('SCALE', d, scale=t))

    def band(self, x, c, w, soft):
        lo = self.smooth(x, self.m('SUBTRACT', c, w + soft), self.m('SUBTRACT', c, w))
        hi = self.smooth(x, self.m('ADD', c, w), self.m('ADD', c, w + soft))
        return self.m('MULTIPLY', lo, self.m('SUBTRACT', 1.0, hi))


RAINBOW = ['#ffc4e6', '#ffe7a8', '#c4f5df', '#bfe3ff', '#e3ccff', '#ffc4e6']


def toon_material():
    """The one shared toon material (emission only). See the module docstring for the inputs."""
    mat = bpy.data.materials.get('ItemToon')
    if mat:
        return mat
    mat = bpy.data.materials.new('ItemToon')
    mat.use_nodes = True
    tree = mat.node_tree
    for n in list(tree.nodes):
        tree.nodes.remove(n)
    b = _NB(tree)
    geo = tree.nodes.new('ShaderNodeNewGeometry')
    tc = tree.nodes.new('ShaderNodeTexCoord')
    N = geo.outputs['Normal']
    ndl = b.dot(N, b.const3(tuple(LIGHT)))
    ndv = b.dot(N, b.const3(tuple(VIEW)))
    ndh = b.dot(N, b.const3(tuple(HALF)))
    wx, wy, _ = b.sep(tc.outputs['Window'])

    base = b.attr('toon_base')
    light = b.attr('toon_light')
    shadow = b.attr('toon_shadow')
    deep = b.attr('toon_deep')
    ts, tl, fe = b.sep(b.attr('toon_steps'))       # shadow step, light step, feather
    spec, sheen, rim = b.sep(b.attr('toon_fx'))     # amounts
    glow, iri, drift = b.sep(b.attr('toon_fx2'))
    td, soff, sthr = b.sep(b.attr('toon_fx3'))      # deep step, sheen offset, specular threshold
    stamt, stfreq, stsharp = b.sep(b.attr('toon_stripe'))
    sdir = b.attr('toon_sdir')

    # iridescence: a pastel ramp driven by screen position and the normal
    ramp = tree.nodes.new('ShaderNodeValToRGB')
    els = ramp.color_ramp.elements
    els[0].position = 0.0
    els[1].position = 1.0
    for i, hx in enumerate(RAINBOW):
        e = els[0] if i == 0 else (els[1] if i == len(RAINBOW) - 1 else els.new(i / (len(RAINBOW) - 1)))
        c = linear(hx)
        e.color = (c[0], c[1], c[2], 1.0)
    nx, _, nz = b.sep(N)
    it = b.m('ADD', b.m('MULTIPLY', wx, 0.9), b.m('MULTIPLY', wy, 0.5))
    it = b.m('ADD', it, b.m('MULTIPLY', nx, 0.35))
    it = b.m('ADD', it, b.m('MULTIPLY', nz, 0.2))
    it = b.m('FRACT', it)
    tree.links.new(it, ramp.inputs['Fac'])
    rc = ramp.outputs['Color']
    white = b.const3((1.0, 1.0, 1.0))
    base = b.mix(base, rc, iri)
    light = b.mix(light, b.mix(rc, white, 0.55), iri)
    shadow = b.mix(shadow, b.v('MULTIPLY', rc, b.const3((0.62, 0.55, 0.86))), iri)
    deep = b.mix(deep, b.v('MULTIPLY', rc, b.const3((0.45, 0.38, 0.75))), iri)

    s0 = b.smooth(ndl, b.m('SUBTRACT', td, fe), b.m('ADD', td, fe))
    s1 = b.smooth(ndl, b.m('SUBTRACT', ts, fe), b.m('ADD', ts, fe))
    s2 = b.smooth(ndl, b.m('SUBTRACT', tl, b.m('MULTIPLY', fe, 0.6)), b.m('ADD', tl, b.m('MULTIPLY', fe, 0.6)))
    col = b.mix(deep, shadow, s0)
    col = b.mix(col, base, s1)
    col = b.mix(col, light, s2)

    # printed stripes (page edges): thin lines in the shadow tone along a local direction
    ob = tc.outputs['Object']
    sv = b.m('MULTIPLY', b.dot(ob, sdir), stfreq)
    sw = b.m('ADD', 0.5, b.m('MULTIPLY', 0.5, b.m('SINE', b.m('MULTIPLY', sv, 2 * math.pi))))
    sl = b.smooth(sw, b.m('SUBTRACT', 1.0, stsharp), 1.0)
    col = b.mix(col, shadow, b.m('MULTIPLY', sl, stamt))

    # inner glow (emissive core): faces turned to the viewer lift toward the light tone
    g = b.m('MULTIPLY', b.smooth(ndv, 0.55, 0.98), glow)
    col = b.mix(col, b.mix(light, white, 0.35), g)

    # rim / bounce: a thin light line along grazing edges on the shadow side
    graze = b.smooth(b.m('SUBTRACT', 1.0, ndv), 0.80, 0.93)
    r = b.m('MULTIPLY', b.m('MULTIPLY', graze, b.m('SUBTRACT', 1.0, s1)), rim)
    col = b.mix(col, light, b.m('MULTIPLY', r, 0.55))

    # specular: a small crisp highlight (gloss and metal)
    sp = b.m('MULTIPLY', b.smooth(ndh, b.m('SUBTRACT', sthr, 0.006), b.m('ADD', sthr, 0.006)), spec)
    col = b.mix(col, b.const3(linear('#fffdf5')), sp)

    # sheen: one broad and one thin diagonal band on faces turned to the viewer
    d = b.m('SUBTRACT', wx, wy)
    bands = b.m('ADD', b.band(d, soff, 0.045, 0.012), b.m('MULTIPLY', b.band(d, b.m('ADD', soff, 0.10), 0.014, 0.008), 0.85))
    sh = b.m('MULTIPLY', b.m('MULTIPLY', bands, b.smooth(ndv, 0.55, 0.8)), sheen)
    col = b.mix(col, white, sh)

    # in-face drift along the light: a few percent brighter toward the upper left
    dr = b.m('ADD', b.m('MULTIPLY', b.m('SUBTRACT', wx, 0.465), -0.7), b.m('MULTIPLY', b.m('SUBTRACT', wy, 0.54), 0.7))
    col = b.v('SCALE', col, scale=b.m('ADD', 1.0, b.m('MULTIPLY', dr, drift)))

    em = tree.nodes.new('ShaderNodeEmission')
    tree.links.new(col, em.inputs['Color'])
    em.inputs['Strength'].default_value = 1.0
    out = tree.nodes.new('ShaderNodeOutputMaterial')
    tree.links.new(em.outputs[0], out.inputs['Surface'])
    return mat


def ink_material():
    mat = bpy.data.materials.get('ItemInk')
    if mat:
        return mat
    mat = bpy.data.materials.new('ItemInk')
    mat.use_nodes = True
    mat.use_backface_culling = True
    tree = mat.node_tree
    for n in list(tree.nodes):
        tree.nodes.remove(n)
    b = _NB(tree)
    em = tree.nodes.new('ShaderNodeEmission')
    tree.links.new(b.attr('ink_col'), em.inputs['Color'])
    em.inputs['Strength'].default_value = 1.0
    out = tree.nodes.new('ShaderNodeOutputMaterial')
    tree.links.new(em.outputs[0], out.inputs['Surface'])
    return mat


# ---------------------------------------------------------------------------
# Styling parts
# ---------------------------------------------------------------------------

def _lin(c):
    return list(linear(c))


POSE_STEPS = dict(standing=(0.12, 0.75, 0.05), flat=(0.12, 0.935, 0.04))


def pose_steps(objs, kind, pose=None):
    """Parts styled without explicit steps get the pose's cel thresholds. A flat item's face is turned
    toward the light, so its light step sits just above the face's own N.L: the face reads as the base
    tone and only the bevels and rims that turn further toward the light pick up the light tone."""
    steps = list(POSE_STEPS[kind])
    spec_floor = 0.0
    if kind == 'flat' and pose is not None:
        face = (pose.to_3x3() @ Vector((0.0, -1.0, 0.0))).normalized()
        steps[1] = min(0.985, face.dot(LIGHT) + 0.035)
        spec_floor = face.dot(HALF) + 0.008          # a flat metal face must not flash white as a whole
    for o in objs:
        if o.get('steps_auto'):
            o['toon_steps'] = list(steps)
        fx3 = list(o['toon_fx3'])
        if fx3[2] < spec_floor:
            fx3[2] = min(0.996, spec_floor)
            o['toon_fx3'] = fx3


def style(obj, base, light, shadow, ink, deep=None, steps=None, spec=0.0, sheen=0.0, rim=0.6,
          glow=0.0, iri=0.0, drift=0.10, deep_at=-2.0, sheen_at=-0.40, spec_at=0.975, stripe=(0.0, 1.0, 0.25),
          stripe_dir=(0.0, 0.0, 1.0), line=2.5, lift=0.0, ink_on=True, smooth=None):
    """Assigns the toon material and its per-part inputs. `line` is the ink width in output px
    (0 = no hull); `lift` moves the hull toward the viewer (outlines around thin raised details)."""
    obj['toon_base'] = _lin(base)
    obj['toon_light'] = _lin(light)
    obj['toon_shadow'] = _lin(shadow)
    obj['toon_deep'] = _lin(deep or shadow)
    obj['steps_auto'] = 1 if steps is None else 0
    obj['toon_steps'] = list(steps or POSE_STEPS['standing'])
    obj['toon_fx'] = [spec, sheen, rim]
    obj['toon_fx2'] = [glow, iri, drift]
    obj['toon_fx3'] = [deep_at, sheen_at, spec_at]
    obj['toon_stripe'] = list(stripe)
    obj['toon_sdir'] = list(stripe_dir)
    obj['ink_col'] = _lin(ink)
    obj['ink_px'] = float(line if ink_on else 0.0)
    obj['ink_lift'] = float(lift)
    me = obj.data
    me.materials.clear()
    me.materials.append(toon_material())
    if smooth is not None:
        for p in me.polygons:
            p.use_smooth = smooth
    return obj


# ---------------------------------------------------------------------------
# Pose, fit, hulls
# ---------------------------------------------------------------------------

def pose_matrix(kind, roll=0.0, turn=None, tip=None, yaw=30.0, elev=30.0):
    """Display pose (one per archetype). Parts are modelled Z up, front facing -Y.
    'standing': seen from above-front-right (yaw, elev).
    'flat': the face (modelled in the XZ plane, facing -Y) turns a little left and leans back so its
            thickness shows on the right and bottom edges, then rolls clockwise by `roll` degrees."""
    if kind == 'standing':
        return Matrix.Rotation(math.radians(elev), 4, 'X') @ Matrix.Rotation(math.radians(-yaw), 4, 'Z') @ \
            Matrix.Rotation(math.radians(-roll), 4, 'Y')
    turn = 22.0 if turn is None else turn
    tip = 16.0 if tip is None else tip
    return Matrix.Rotation(math.radians(-tip), 4, 'X') @ Matrix.Rotation(math.radians(-turn), 4, 'Z') @ \
        Matrix.Rotation(math.radians(roll), 4, 'Y')


def apply_pose(objs, mat):
    """Bakes the pose into every part (and turns the stripe direction with it)."""
    rot = mat.to_3x3()
    for o in objs:
        o.data.transform(mat @ o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
        o.data.update()
        if 'toon_sdir' in o:
            o['toon_sdir'] = list(rot @ Vector(o['toon_sdir']))


def screen_bbox(objs):
    xs, zs = [], []
    for o in objs:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            xs.append(w.x)
            zs.append(w.z)
    return min(xs), max(xs), min(zs), max(zs)


def fit_camera(cam, objs, scale=1.0, max_w=MAX_W_PX, max_h=MAX_H_PX):
    """Sets ortho_scale and position so the silhouette lands centred on CENTER_PX inside max_w x max_h."""
    x0, x1, z0, z1 = screen_bbox(objs)
    w, h = max(1e-6, x1 - x0), max(1e-6, z1 - z0)
    ppu = min(max_w / w, max_h / h) * scale            # pixels per world unit
    s = SIZE / ppu
    cam.data.ortho_scale = s
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    dx = (SIZE / 2 - CENTER_PX[0]) / ppu
    dz = (SIZE / 2 - CENTER_PX[1]) / ppu
    cam.location = (cx + dx, -CAM_DIST, cz - dz)
    return ppu


def to_px(cam, p):
    s = cam.data.ortho_scale
    x = (p.x - cam.location.x) / s * SIZE + SIZE / 2
    y = SIZE / 2 - (p.z - cam.location.z) / s * SIZE
    return x, y


def add_hulls(objs, ppu, mult=1.0):
    """One inverted hull per part: vertices pushed out along their normals by the ink width in px,
    heavier toward the bottom right (2 px lit side, about 3 px shadow side at 2.5 px), normals flipped,
    drawn with the back-face-culled ink material."""
    ink = ink_material()
    hulls = []
    for o in objs:
        px = o.get('ink_px', 0.0) * mult
        if px <= 0:
            continue
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)   # split (hard) edges must not crack the hull
        bm.normal_update()
        lift = o.get('ink_lift', 0.0)
        moves = []
        for v in bm.verts:
            n = v.normal
            k = 1.0 + 0.32 * (n.x - n.z) / 1.4142
            moves.append(v.co + n * (px * k / ppu) + Vector((0.0, -lift, 0.0)))
        for v, c in zip(bm.verts, moves):
            v.co = c
        for f in bm.faces:
            f.normal_flip()
        me = bpy.data.meshes.new(o.data.name + '_ink')
        bm.to_mesh(me)
        bm.free()
        me.materials.clear()
        me.materials.append(ink)
        me.update()
        h = bpy.data.objects.new(o.name + '_ink', me)
        bpy.context.scene.collection.objects.link(h)
        h.matrix_world = o.matrix_world.copy()
        h['ink_col'] = list(o['ink_col'])
        for p in me.polygons:
            p.use_smooth = True
        hulls.append(h)
    return hulls


def render(path):
    sc = bpy.context.scene
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path
