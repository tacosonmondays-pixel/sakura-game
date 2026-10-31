#!/usr/bin/env python3
"""Writes <wt>/src/art/portraitsV3.js: the art v3 manifest (which girls are drawn in Look B and a hash of their four
files). usage: manifest.py <worktree> <id>..."""
import hashlib, os, sys
wt, ids = sys.argv[1], sorted(sys.argv[2:])
lines = []
for gid in ids:
    h = hashlib.sha256()
    for k in ("full", "card", "bust", "thumb"):
        h.update(open(os.path.join(wt, "public/art/portraits", f"{gid}-{k}.webp"), "rb").read())
    lines.append(f"  {gid}: '{h.hexdigest()[:8]}',")
src = """// Art v3 (Oct 2026): the roster portraits redrawn in Look B, the clean academy look with a dynamic camera (thin tinted
// lines, flat two-tone cel, high-key, a soft painted place behind her) that the seven academy girls' v2 scenes set.
// Each girl here has a new full (768x1024 master), card, bust and thumb, and her PORTRAIT_DATA face and FACE_ANCHORS
// card line measured on that master; her stands (-cut, -cut-s) are unchanged. The value is the first 8 hex digits of
// the sha-256 of her full, card, bust and thumb files in that order (tests/art/portraitsV3.test.js), so a file swapped
// without its line fails the test.
export const PORTRAIT_V3 = Object.freeze({
""" + "\n".join(lines) + "\n});\n"
open(os.path.join(wt, "src/art/portraitsV3.js"), "w").write(src)
print(len(ids), "girls")
