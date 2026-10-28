# Convert backgrounds/<id>.png -> backgrounds/webp/<id>.webp at 1280 px wide (<= 180 KB, quality search)
# and a 320 px archive thumb. Prints a JSON size table.
import os, sys, json, io
from PIL import Image
BG = os.environ.get('STORY_BG_OUT', os.path.join(os.getcwd(), 'story-bg-out'))  # same folder gen.py writes to, outside the repo
OUT = os.path.join(BG, 'webp'); os.makedirs(os.path.join(OUT, 'thumbs'), exist_ok=True)
LIMIT = 180 * 1024
rows = []
ids = sys.argv[1:] or sorted(f[:-4] for f in os.listdir(BG) if f.endswith('.png'))
for id_ in ids:
    im = Image.open(os.path.join(BG, id_ + '.png')).convert('RGB')
    w, h = im.size
    big = im.resize((1280, round(h * 1280 / w)), Image.LANCZOS)
    chosen = None
    for q in (82, 78, 74, 70, 66, 62, 58):
        buf = io.BytesIO(); big.save(buf, 'WEBP', quality=q, method=6)
        if buf.tell() <= LIMIT or q == 58:
            chosen = (q, buf.getvalue()); break
    open(os.path.join(OUT, id_ + '.webp'), 'wb').write(chosen[1])
    th = im.resize((320, round(h * 320 / w)), Image.LANCZOS)
    tb = io.BytesIO(); th.save(tb, 'WEBP', quality=72, method=6)
    open(os.path.join(OUT, 'thumbs', id_ + '.webp'), 'wb').write(tb.getvalue())
    rows.append({'id': id_, 'png_kb': round(os.path.getsize(os.path.join(BG, id_ + '.png')) / 1024), 'webp_kb': round(len(chosen[1]) / 1024), 'q': chosen[0], 'size': f'1280x{big.size[1]}', 'thumb_kb': round(tb.tell() / 1024)})
print(json.dumps(rows, indent=0))
