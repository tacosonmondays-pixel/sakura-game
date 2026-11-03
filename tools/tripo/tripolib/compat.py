"""Small bpy version shims: the tools run on the bpy 4.2 module and on Blender 5.x (`blender -b --python`).

Blender 4.4+ stores keys in layered (slotted) actions and 5.0 dropped the old `Action.fcurves`; these helpers
read the F-curves either way, and copy pose-bone keys between actions, so the clip code stays version-free."""
import io
import json
import struct


def fcurves(act):
    """Every F-curve of an action (legacy `act.fcurves`, or the channel bags of a layered action)."""
    legacy = getattr(act, 'fcurves', None)
    if legacy is not None:
        return list(legacy)
    out = []
    for layer in getattr(act, 'layers', []):
        for strip in layer.strips:
            for bag in getattr(strip, 'channelbags', []):
                out.extend(bag.fcurves)
    return out


def linear(act):
    """Linear interpolation on every key (the packer drops the keys a straight line would give again)."""
    for fc in fcurves(act):
        for k in fc.keyframe_points:
            k.interpolation = 'LINEAR'


def transplant_image(src_glb, dst_glb):
    """Puts the base-colour image bytes of `src_glb` (the shipped file) into `dst_glb` in place of its own (both
    have one image of the same size): a rebuild keeps the original WebP instead of re-encoding it. Returns the new
    file size, or None when the two files do not match (then nothing is written)."""
    def read(path):
        data = open(path, 'rb').read()
        off, js, binc = 12, None, b''
        while off < len(data):
            clen, ctype = struct.unpack_from('<II', data, off)
            chunk = data[off + 8:off + 8 + clen]
            off += 8 + clen
            if ctype == 0x4E4F534A:
                js = json.loads(chunk)
            elif ctype == 0x004E4942:
                binc = chunk
        return js, binc

    sj, sb = read(src_glb)
    dj, db = read(dst_glb)
    if len(sj.get('images', [])) != 1 or len(dj.get('images', [])) != 1:
        return None
    sv = sj['bufferViews'][sj['images'][0]['bufferView']]
    src_bytes = sb[sv.get('byteOffset', 0):sv.get('byteOffset', 0) + sv['byteLength']]
    img_view = dj['images'][0]['bufferView']
    buf = bytearray()
    for i, bv in enumerate(dj['bufferViews']):
        raw = src_bytes if i == img_view else db[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        buf += b'\0' * ((4 - len(buf) % 4) % 4)
        bv['byteOffset'] = len(buf)
        bv['byteLength'] = len(raw)
        buf += raw
    dj['buffers'] = [{'byteLength': len(buf)}]
    dj['images'][0]['mimeType'] = sj['images'][0].get('mimeType', 'image/webp')
    jb = json.dumps(dj, separators=(',', ':')).encode()
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    buf += b'\0' * ((4 - len(buf) % 4) % 4)
    with open(dst_glb, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(buf)))
        f.write(struct.pack('<II', len(jb), 0x4E4F534A))
        f.write(jb)
        f.write(struct.pack('<II', len(buf), 0x004E4942))
        f.write(bytes(buf))
    return 12 + 8 + len(jb) + 8 + len(buf)
