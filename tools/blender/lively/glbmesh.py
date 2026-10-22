"""Read a packed character GLB into numpy (positions in the stored position space, glTF axes: +Y up,
+Z her front, +X her left), plus skin joints/weights, UVs, triangles and the joints' bind positions.
Pure numpy (imports tools/meshy/lib/pack.py's helpers)."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import MESHY_TOOLS, NOA, GIRLS, MESHY_CLIPS  # noqa: E402,F401
sys.path.insert(0, MESHY_TOOLS)
from lib import pack as P  # noqa: E402


def load(path):
    js, binc = P.read_glb(path)
    prim = js['meshes'][0]['primitives'][0]
    at = prim['attributes']
    pos = P.read_accessor(js, binc, at['POSITION']).astype(np.float64)
    uv = P.read_accessor(js, binc, at['TEXCOORD_0']).astype(np.float64)
    jn = P.read_accessor(js, binc, at['JOINTS_0']).astype(np.int32)
    wt = P.read_accessor(js, binc, at['WEIGHTS_0']).astype(np.float64)
    nrm = P.read_accessor(js, binc, at['NORMAL']).astype(np.float64) if 'NORMAL' in at else None
    tri = P.read_accessor(js, binc, prim['indices']).astype(np.int64).reshape(-1, 3)
    skin = js['skins'][0]
    names = [js['nodes'][j]['name'] for j in skin['joints']]
    ibm = P.read_accessor(js, binc, skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    bind = {n: np.linalg.inv(m)[:3, 3] for n, m in zip(names, ibm)}
    # dense per-vertex weight per joint name
    W = np.zeros((len(pos), len(names)))
    for k in range(4):
        np.add.at(W, (np.arange(len(pos)), jn[:, k]), wt[:, k])
    return dict(js=js, bin=binc, pos=pos, uv=uv, nrm=nrm, tri=tri, names=names, bind=bind, W=W,
                extras=js['asset'].get('extras', {}))


def wsum(m, *bones):
    idx = [m['names'].index(b) for b in bones if b in m['names']]
    return m['W'][:, idx].sum(1)
