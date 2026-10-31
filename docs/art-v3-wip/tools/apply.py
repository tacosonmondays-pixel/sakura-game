#!/usr/bin/env python3
"""Put picked art v3 portraits into the feature worktree.
usage: apply.py <picks.json> <worktree>     picks: [[id, cand, total, [ex, ey], head], ...]
For each girl: make_crops -> <wt>/public/art/portraits/<id>-{full,card,bust,thumb}.webp; PORTRAIT_DATA face in
src/art/portraits.js; FACE_ANCHORS card line in src/ui/faceAnchors.js (derived from the same card box:
brow = eyes - 0.1 head, chin = eyes + 0.45 head, the anime head proportions make_crops uses)."""
import json, os, re, subprocess, sys
picks, wt = json.load(open(sys.argv[1])), sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
ROSTER = os.environ.get("ROSTER", "/home/user/work/roster")
pjs = os.path.join(wt, "src/art/portraits.js"); fjs = os.path.join(wt, "src/ui/faceAnchors.js")
P, F = open(pjs).read(), open(fjs).read()
r3 = lambda v: round(v, 3)
for gid, cand, total, (ex, ey), head in picks:
    src = os.path.join(ROSTER, gid, cand + ".png")
    out = subprocess.run([sys.executable, "-I", os.path.join(HERE, "make_crops.py"), src, gid, os.path.join(wt, "public/art/portraits"),
                          "--eyes", str(ex), str(ey), "--head", str(head)], capture_output=True, text=True, check=True).stdout
    os.remove(os.path.join(wt, "public/art/portraits", f"{gid}-crops.jpg"))
    box = [int(v) for v in re.search(r"card  box \((\d+), (\d+), (\d+), (\d+)\)", out).groups()]
    face = re.search(r"face: \[(\d+), (\d+)\]", out).groups()
    P, n = re.subn(rf"(\n  {gid}: \{{ face: )\[\d+, \d+\]", rf"\g<1>[{face[0]}, {face[1]}]", P)
    assert n == 1, gid
    x0, y0, x1, y1 = box; w, h = x1 - x0, y1 - y0
    cx, eye = r3((ex - x0) / w), r3((ey - y0) / h)
    brow, chin = r3((ey - 0.1 * head - y0) / h), r3((ey + 0.45 * head - y0) / h)
    F, n = re.subn(rf"(\n  {gid}: \{{ cut: A\([^)]*\), card: )A\([^)]*\)", rf"\g<1>A({cx}, {brow}, {eye}, {chin})", F)
    assert n == 1, gid
    print(gid, cand, "face", face, "card", (cx, brow, eye, chin))
open(pjs, "w").write(P); open(fjs, "w").write(F)
