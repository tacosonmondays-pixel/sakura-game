#!/usr/bin/env python3
"""Round 2 style fix (judges, round 1: every candidate came out as flat colouring-book line art).
Replaces the style tail of ROSTER/<id>/spec.json (from 'clean cel-shaded anime illustration' to the end) and adjusts the
negative. Keeps the round-1 spec as spec.r1.json. usage: restyle.py <id>... """
import json, os, shutil, sys
ROSTER = os.environ.get("ROSTER", "/home/user/work/roster")
TAIL = ("anime screencap, anime coloring, cel shading, two-tone shading with soft-edged shadow shapes, thin colored lineart, "
        "clean lines, bright high-key lighting, soft pastel palette, pale skin with peach shadows, large eyes with one highlight, "
        "light blush, detailed background, blurry background, bokeh, depth of field, soft daylight, "
        "matte flat cel shading, simple hard-edged shadows, muted highlights, anime key visual")
NEG_DROP = ["painted gradients", "brush texture", "dark shadows", "few colors"]
NEG_ADD = ["monochrome", "greyscale", "coloring book", "sketch", "unfinished", "simple background", "white background",
           "flat background", "border", "frame", "framed", "flat color", "no shading", "thick lineart", "manga", "glossy", "shiny skin", "gradient shading", "ornate"]
for gid in sys.argv[1:]:
    p = os.path.join(ROSTER, gid, "spec.json")
    if not os.path.exists(p.replace("spec.json", "spec.r1.json")):
        shutil.copy(p, p.replace("spec.json", "spec.r1.json"))
    s = json.load(open(p.replace("spec.json", "spec.r1.json")))
    i = s["prompt"].find("clean cel-shaded anime illustration")
    assert i > 0, gid
    s["prompt"] = s["prompt"][:i] + TAIL
    neg = [t.strip() for t in s["negative"].split(",") if t.strip() and t.strip() not in NEG_DROP]
    neg += [t for t in NEG_ADD if t not in neg]
    s["negative"] = ", ".join(neg)
    json.dump(s, open(p, "w"), indent=1)
    print(gid, len(s["prompt"]))
