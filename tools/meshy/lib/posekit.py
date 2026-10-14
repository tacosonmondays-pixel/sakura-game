# Pose kit for the owner's Meshy rig: world-space (armature-space) authoring on top of rest.
# A pose is {bone: L} where L is a quaternion in *world axes* applied on top of the parent's
# delta (FK: D_bone = D_parent @ L_bone), plus 'root_t' (Vector offset) and IK overrides.
# solve() turns a pose into armature-space matrices; key() writes Blender pose-bone keys.
import math
from mathutils import Matrix, Quaternion, Vector

def Q(axis, deg):
    return Quaternion(Vector(axis).normalized(), math.radians(deg))

def E(x=0.0, y=0.0, z=0.0):
    """World-axis rotation: x = pitch about +X, y = roll about +Y, z = yaw about +Z (degrees)."""
    return Q((0, 0, 1), z) @ Q((0, 1, 0), y) @ Q((1, 0, 0), x)

def rotq(M):
    m = M.to_3x3(); m.normalize(); return m.to_quaternion()

def smooth(t):
    t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)

def lerp(a, b, t):
    return a + (b - a) * t

class Rig:
    def __init__(self, arm):
        self.arm = arm
        self.R = {b.name: b.matrix_local.copy() for b in arm.data.bones}
        self.Rq = {n: rotq(m) for n, m in self.R.items()}
        self.parent = {b.name: (b.parent.name if b.parent else None) for b in arm.data.bones}
        self.order = []
        def walk(b):
            self.order.append(b.name)
            for c in b.children: walk(c)
        for b in arm.data.bones:
            if b.parent is None: walk(b)
        self.head = {n: self.R[n].translation.copy() for n in self.order}

    def solve(self, L, root_t=Vector(), override=None):
        """L: {bone: Quaternion world-axis local delta}; override: {bone: Quaternion absolute world delta}.
        Returns ({bone: M armature-space}, {bone: D world delta})."""
        override = override or {}
        M, D = {}, {}
        for n in self.order:
            p = self.parent[n]
            if p is None:
                d = L.get(n, Quaternion())
                pos = self.head[n] + root_t
            else:
                d = override[n] if n in override else D[p] @ L.get(n, Quaternion())
                pos = (M[p] @ (self.R[p].inverted() @ self.R[n])).translation
            D[n] = d
            m = (d @ self.Rq[n]).to_matrix().to_4x4(); m.translation = pos
            M[n] = m
        return M, D

    def key(self, M, frame):
        pbs = self.arm.pose.bones
        for n in self.order:
            p = self.parent[n]
            if p is None: basis = self.R[n].inverted() @ M[n]
            else: basis = (self.R[p].inverted() @ self.R[n]).inverted() @ M[p].inverted() @ M[n]
            pb = pbs[n]; pb.rotation_mode = 'QUATERNION'
            q = basis.to_quaternion()
            pb.rotation_quaternion = q
            pb.keyframe_insert('rotation_quaternion', frame=frame, group=n)
            if p is None:
                pb.location = basis.translation
                pb.keyframe_insert('location', frame=frame, group=n)

def two_bone(S, L1, L2, T, pole):
    """Elbow/knee position for a chain rooted at S reaching T, bending toward pole point."""
    d = T - S; dist = d.length
    dist = min(max(dist, abs(L1 - L2) + 1e-4), (L1 + L2) * 0.9995)
    dirn = d.normalized()
    a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(0.0, L1 * L1 - a * a))
    pv = pole - S; pv = pv - dirn * pv.dot(dirn)
    if pv.length < 1e-6: pv = Vector((0, 1, 0)) - dirn * dirn.y
    pv.normalize()
    return S + dirn * a + pv * h, S + dirn * dist

def signed_angle(a, b, axis):
    a = a - axis * a.dot(axis); b = b - axis * b.dot(axis)
    if a.length < 1e-8 or b.length < 1e-8: return 0.0
    a.normalize(); b.normalize()
    return math.atan2(axis.dot(a.cross(b)), max(-1, min(1, a.dot(b))))
