"""Keeps a rebuilt painted girl near her shipped file size (pack_noa.py / pack_girl.py call it).

The rollout adds a flattened base colour (the Clean cel look) and longer clips to every painted girl. To pay for
them, the maps that matter least at each detail level get smaller:
 - full (<girl>.glb, High quality, close-ups): look B's normal map goes from 1024 to 512 (filtered as vectors and
   renormalised). The Glossy look is the Settings option now, and at figure size its normal detail barely shows.
 - LOD (<girl>.lod.glb, Medium / Low quality, battle distance where a girl is 60-90 px tall): look B's base colour
   and the flattened base colour go to 512. Close-up viewers always load the full model.
Everything else (meshes, skins, clips, the full model's base colours, the eye boxes) is untouched.

    python slim.py <in.glb> <out.glb> full|lod      (a separate run; the pack scripts call slim_images)"""
import io
import os
import sys

import numpy as np
from PIL import Image

SIZE = 512
QUALITY = 90


def _webp(img):
    b = io.BytesIO()
    img.save(b, 'WEBP', quality=QUALITY, method=6)
    return b.getvalue()


def color_half(data_or_img):
    """A colour map (WebP bytes or a PIL image) at SIZE, lossy WebP q90."""
    img = data_or_img if isinstance(data_or_img, Image.Image) else Image.open(io.BytesIO(data_or_img))
    img = img.convert('RGB')
    if img.width > SIZE:
        img = img.resize((SIZE, SIZE * img.height // img.width), Image.LANCZOS)
    return _webp(img)


def normal_half(data):
    """A tangent-space normal map at SIZE: each channel filtered as a vector component, renormalised, WebP q90."""
    img = np.asarray(Image.open(io.BytesIO(data)).convert('RGB'), dtype=np.float32)
    h, w = img.shape[:2]
    if w <= SIZE:
        return data
    size = (SIZE, SIZE * h // w)
    n = np.stack([np.asarray(Image.fromarray(img[:, :, k], 'F').resize(size, Image.LANCZOS)) for k in range(3)], -1)
    n = n / 255.0 * 2 - 1
    n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-6)
    out = np.clip(np.round((n + 1) / 2 * 255), 0, 255).astype(np.uint8)
    return _webp(Image.fromarray(out, 'RGB'))


def slim_images(image_bytes, detail):
    """{image name: WebP bytes} of a packed girl -> the same dict with the slimmed maps."""
    out = dict(image_bytes)
    if detail == 'full':
        if 'normal' in out:
            out['normal'] = normal_half(out['normal'])
    else:
        for nm in ('base', 'flat'):
            if nm in out:
                out[nm] = color_half(out[nm])
    return out


def rebuild(js, binc, replace):
    """New BIN chunk with some bufferViews replaced ({index: bytes}) and others appended ({'append': [bytes]})."""
    out = bytearray()
    views = []
    for i, bv in enumerate(js['bufferViews']):
        data = replace.get(i)
        if data is None:
            o = bv.get('byteOffset', 0)
            data = binc[o:o + bv['byteLength']]
        out += b'\0' * ((4 - len(out) % 4) % 4)
        nv = dict(bv)
        nv['byteOffset'] = len(out)
        nv['byteLength'] = len(data)
        out += data
        views.append(nv)
    added = []
    for data in replace.get('append', []):
        out += b'\0' * ((4 - len(out) % 4) % 4)
        views.append({'buffer': 0, 'byteOffset': len(out), 'byteLength': len(data)})
        out += data
        added.append(len(views) - 1)
    js['bufferViews'] = views
    js['buffers'] = [{'byteLength': len(out)}]
    return bytes(out), added


if __name__ == '__main__':
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from paths import MESHY_TOOLS  # noqa: E402
    sys.path.insert(0, MESHY_TOOLS)
    from lib import pack as P  # noqa: E402

    src, dst, detail = sys.argv[1], sys.argv[2], sys.argv[3]
    js, binc = P.read_glb(src)
    views = {}
    for im in js['images']:
        bv = js['bufferViews'][im['bufferView']]
        o = bv.get('byteOffset', 0)
        views[im.get('name')] = (im['bufferView'], binc[o:o + bv['byteLength']])
    slim = slim_images({k: v[1] for k, v in views.items()}, detail)
    binc2, _ = rebuild(js, binc, {views[k][0]: v for k, v in slim.items()})
    P.write_glb(dst, js, binc2)
