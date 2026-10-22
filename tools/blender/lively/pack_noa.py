"""Pack Noa's rebuilt GLB (pure Python): tools/meshy/lib/pack.py (int16 / WebP / static channels dropped),
then the shipped images go back in byte for byte (no second WebP generation on look B's maps), the flattened
base colour is added as one more texture for the Clean cel look (asset.extras.flat), and slim.py trims the
maps that matter least at this detail level (full: look B's normal map at 512; LOD: both base colours at 512).

    python pack_noa.py full|lod          <work>/noa/out/noa_<detail>.raw.glb -> <work>/noa/out/noa[.lod].glb"""
import io
import json
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import MESHY_TOOLS, NOA as ROOT  # noqa: E402
sys.path.insert(0, MESHY_TOOLS)
from lib import pack as P  # noqa: E402
from flatten import NOA  # noqa: E402
from slim import slim_images, color_half, rebuild  # noqa: E402

DETAIL = sys.argv[1] if len(sys.argv) > 1 else 'full'
SRC = ROOT + f'src/noa.ship{".lod" if DETAIL == "lod" else ""}.glb'
RAW = ROOT + f'out/noa_{DETAIL}.raw.glb'
TMP = ROOT + f'out/noa_{DETAIL}.packed.glb'
DST = ROOT + f'out/noa{".lod" if DETAIL == "lod" else ""}.glb'
FLAT = ROOT + f'flat/{DETAIL}_base_flat.png'
FLATJ = ROOT + f'flat/{DETAIL}_flatten.json'
SPRING = ['bun_L', 'bun_R', 'ribbon']


def main():
    sjs, sbin = P.read_glb(SRC)
    extras = dict(sjs['asset']['extras'])
    fj = json.load(open(FLATJ))
    extras['generator'] = ('tools/blender/lively/build_noa.py + pack_noa.py (shipped noa.glb, library clips '
                           '338/415/298/178 from Meshy rig R1 with the chibi post-pass, bun/ribbon spring bones, offline flatten)')
    # the 338 idle looks around on its own: the lively layer's glances run at 0.4x on it
    extras['clipMarks'] = {'idle': {'glance': 0.4, 'source': 338}, 'happy': {'source': 415, 'mood': True},
                           'cheer': {'source': 298}, 'hurt': {'source': 178}}
    extras['springBones'] = SPRING
    stats = P.pack(RAW, TMP, 1.0, extras, webp_quality=90, tex_size=None)
    js, binc = P.read_glb(TMP)
    # shipped image bytes, by name (slimmed where this detail level can spare them)
    ship = {}
    for im in sjs['images']:
        bv = sjs['bufferViews'][im['bufferView']]
        ship[im.get('name')] = sbin[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
    ship = slim_images(ship, DETAIL)
    replace = {}
    for im in js['images']:
        nm = im.get('name')
        assert nm in ship, f'image {nm} not in the shipped GLB'
        replace[im['bufferView']] = ship[nm]
    # the flat base colour: full = lossless WebP when it is not much bigger than lossy q92; LOD = 512, q90 (slim.py)
    flat = Image.open(FLAT).convert('RGB')
    if DETAIL == 'lod':
        data, enc = color_half(flat), 'q90@512'
    else:
        b1 = io.BytesIO()
        flat.save(b1, 'WEBP', lossless=True, method=6, quality=100)
        b2 = io.BytesIO()
        flat.save(b2, 'WEBP', quality=92, method=6)
        enc = 'lossless' if len(b1.getvalue()) <= len(b2.getvalue()) * 1.15 else 'q92'
        data = b1.getvalue() if enc == 'lossless' else b2.getvalue()
    replace['append'] = [data]
    binc2, added = rebuild(js, binc, replace)
    js['images'].append({'name': 'flat', 'mimeType': 'image/webp', 'bufferView': added[0]})
    sampler = js['textures'][0].get('sampler', 0)
    js['textures'].append({'sampler': sampler, 'extensions': {'EXT_texture_webp': {'source': len(js['images']) - 1}}})
    fe = fj.get('flat_eyes') or {}
    js['asset']['extras']['flat'] = {
        'texture': len(js['textures']) - 1,
        'eyes': {'skin': fe.get('skin'), 'skinLow': fe.get('skinLow')},
        # the exact flat colours (the cel look's palette: no measuring, merging or lifting at runtime)
        'palette': [v['flat'].lower() for v in NOA['palette'].values()] + [NOA['skirt']['flat'].lower(), NOA['skirt']['hem'].lower()],
        'source': 'tools/blender/lively/flatten.py',
        'metrics': fj['metrics']['after'],
    }
    P.write_glb(DST, js, binc2)
    # report
    out = dict(detail=DETAIL, size=os.path.getsize(DST), shipped_size=os.path.getsize(SRC), pack=stats, flat_bytes=len(data), flat_encoding=enc)
    js3, _ = P.read_glb(DST)
    out['animations'] = {a['name']: round(max(js3['accessors'][s['input']]['max'][0] for s in a['samplers']), 3) for a in js3['animations']}
    out['joints'] = [js3['nodes'][j]['name'] for j in js3['skins'][0]['joints']]
    out['images'] = [(im.get('name'), js3['bufferViews'][im['bufferView']]['byteLength']) for im in js3['images']]
    json.dump(out, open(ROOT + f'out/pack_{DETAIL}.json', 'w'), indent=1)
    print(json.dumps(out, indent=1))


main()
