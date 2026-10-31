#!/usr/bin/env python3
"""Art v3c (owner option C, Oct 31): from each girl's v3 spec (spec.v3.json) write spec.json with the v3c style tail:
no halo anywhere (halo words removed from the prompt, poses and identity; halo terms in the negative), a richly detailed
background instead of the soft blurred one. Per-girl props / adult framing are edited afterwards. usage: restyle_c.py <dir> <id>..."""
import json, os, re, sys
TAIL = ("anime screencap, anime coloring, cel shading, two-tone shading with soft-edged shadow shapes, thin colored lineart, "
        "clean lines, bright high-key lighting, pale skin with peach shadows, large eyes with one highlight, light blush, "
        "highly detailed background, detailed scenery full of objects, intricate environment, depth of field, soft daylight, "
        "matte flat cel shading, simple hard-edged shadows, muted highlights, anime key visual")
NEG_ADD = ["1.4::halo::", "ring halo", "halo above head", "floating ring", "glowing ring above head", "ring of light",
           "circlet", "angel", "simple background", "blurry background", "empty background", "plain sky background"]
NEG_DROP = {"cropped halo", "halo cut off", "large halo", "halo touching the edge", "plain ring halo", "ring halo",
            "no halo", "missing halo", "circular halo", "halo on doll", "halo on animal"}
HALO_CLAUSE = re.compile(r"(?:\d(?:\.\d)?::)?[^,:]*\bhalos?\b[^,:]*(?:::)?\s*,\s*", re.I)
STARTS = ("anime screencap", "clean cel-shaded anime illustration")
d = sys.argv[1]
for gid in sys.argv[2:]:
    s = json.load(open(os.path.join(d, gid, "spec.v3.json")))
    p = s["prompt"]
    i = min([p.find(t) for t in STARTS if p.find(t) > 0] or [len(p)])
    body = HALO_CLAUSE.sub("", p[:i] + ", ")
    body = re.sub(r"\s*,\s*,+", ",", body).strip().rstrip(",")
    s["prompt"] = body + ", " + TAIL
    s["poses"] = [re.sub(r"\s*,\s*,+", ",", HALO_CLAUSE.sub("", x + ", ")).strip().rstrip(",") for x in s["poses"]]
    s["identity"] = [x for x in s["identity"] if "halo" not in x.lower()]
    neg = [t.strip() for t in s["negative"].split(",") if t.strip() and t.strip().lower() not in NEG_DROP and "halo" not in t.lower()]
    for t in ("bokeh",):
        neg = [n for n in neg if n != t]
    s["negative"] = ", ".join(neg + [t for t in NEG_ADD if t not in neg])
    json.dump(s, open(os.path.join(d, gid, "spec.json"), "w"), indent=1)
    left = [w for w in re.findall(r"[^,]*halo[^,]*", s["prompt"] + " | " + " | ".join(s["poses"]), re.I)]
    print(gid, len(s["prompt"]), "halo words left:", left[:3])
