"""Read a packed character GLB's painted body into numpy (stored position space, glTF axes: +Y up, +Z her front,
+X her left): positions, normals, UVs, triangles, dense skin weights per joint name, joints' bind positions.
Like noa/build/glbmesh.py, but it picks the textured body primitive (Hana's bow mesh comes first)."""
import io
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import MESHY_TOOLS, NOA, GIRLS, MESHY_CLIPS  # noqa: E402,F401
sys.path.insert(0, MESHY_TOOLS)
from lib import pack as P  # noqa: E402


def body_prim(js):
    for mi, m in enumerate(js['meshes']):
        for p in m['primitives']:
            if 'TEXCOORD_0' in p['attributes'] and 'JOINTS_0' in p['attributes']:
                return mi, p
    raise KeyError('no textured skinned primitive')


def load(path):
    js, binc = P.read_glb(path)
    mi, prim = body_prim(js)
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
    W = np.zeros((len(pos), len(names)))
    for k in range(4):
        np.add.at(W, (np.arange(len(pos)), jn[:, k]), wt[:, k])
    return dict(js=js, bin=binc, pos=pos, uv=uv, nrm=nrm, tri=tri, names=names, bind=bind, W=W, mesh=mi,
                extras=js['asset'].get('extras', {}))


def wsum(m, *bones):
    idx = [m['names'].index(b) for b in bones if b in m['names']]
    return m['W'][:, idx].sum(1) if idx else np.zeros(len(m['pos']))


def image(m, name='base'):
    js, b = m['js'], m['bin']
    for im in js['images']:
        if im.get('name') == name:
            bv = js['bufferViews'][im['bufferView']]
            raw = b[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
            return np.asarray(Image.open(io.BytesIO(raw)).convert('RGB')).astype(np.float64) / 255.0
    raise KeyError(name)
