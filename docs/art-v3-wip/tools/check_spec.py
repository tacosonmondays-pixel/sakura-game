#!/usr/bin/env python3
"""Self-check for an art v3 roster spec.json (nai_gen.py refuses a spec that fails). usage: check_spec.py <spec.json>
Checks: no roster name or banned word in any prompt text; the required negative terms; nothing unsafe asked for in the
positive prompt; the {POSE} slot; at least 4 poses; the reference is our own art; the prompt fits the token budget."""
import json, os, re, sys

NAMES = ["hikari", "luna", "nami", "aoi", "hotaru", "sango", "umeko", "kaede", "suzu", "chika", "rei", "yuki", "akane",
         "shiro", "kage", "raika", "miko", "midori", "momo", "ena", "fuu", "hana", "iroha", "kanna", "noa", "ruri", "seiran",
         "yoriko", "azami", "kinu", "wakaba", "yuzuha", "ouka", "chigusa", "marumi", "tenka", "kohaku", "tsubaki", "kogane",
         "norika", "big yellow", "sakura sentinels"]
BANNED = ["archive", "novelai", "by artist", "artist:", "in the style of", "style of", "franchise", "fanart", "cosplay", "official art"]
NEG_REQUIRED = ["nsfw", "nude", "cleavage", "upskirt", "panties", "swimsuit", "bikini", "lingerie", "see-through", "from below",
                "low angle", "blood", "gore", "extra fingers", "bad hands", "text", "watermark", "signature", "logo", "chibi",
                "3d", "realistic"]
NEG_STUDENT = ["child", "aged down", "downblouse"]
POS_FORBIDDEN = ["nsfw", "from below", "low angle", "swimsuit", "bikini", "lingerie", "cleavage", "midriff", "navel", "bare shoulders",
                 "large breasts", "breast", "thigh", "panties", "ass", "wet", "see-through", "upskirt", "sexy", "seductive",
                 "bedroom", "bath", "nude", "gun pointed at viewer", "aiming at viewer", "blood", "gore", "kiss", "romantic", "couple"]
OWN_PREFIXES = ["/home/user/sakura-game/public/art/", "/tmp/claude-0/-home-user/bc8e90b4-5af0-5aad-ab54-4a98bb73399f/scratchpad/kogane/kogane-test-1",
                "/tmp/claude-0/-home-user/bc8e90b4-5af0-5aad-ab54-4a98bb73399f/scratchpad/art-v3/pilot/recipe/ref-",
                "/home/user/work/roster/"]
MAX_CHARS = 2600  # about 500 tokens at the pilot's measured ~5 characters per token


def words(text):
    return " " + re.sub(r"[^a-z0-9:]+", " ", text.lower()) + " "


def has(w, term):
    """term (normalised the same way) appears as whole words in the normalised text w"""
    return words(term) in w


def main(path):
    s = json.load(open(path))
    errs = []
    for key in ("id", "adult", "prompt", "negative", "poses", "identity", "scene"):
        if key not in s:
            errs.append(f"missing key {key}")
    if errs:
        return errs
    two = bool(s.get("char_captions"))
    texts = [("prompt", s["prompt"])] + [(f"pose {i}", p) for i, p in enumerate(s["poses"])] + \
            [(f"char_caption {i}", c.get("caption", "")) for i, c in enumerate(s.get("char_captions") or [])]
    for where, t in texts:
        w = words(t)
        for n in NAMES + BANNED:
            if has(w, n) or (":" in n and n in t.lower()):
                errs.append(f"{where}: names or banned word '{n}'")
        for bad in POS_FORBIDDEN:
            if has(w, bad) or has(w, bad + "s"):
                errs.append(f"{where}: forbidden positive term '{bad}'")
    neg = words(s["negative"])
    need = NEG_REQUIRED + ([] if s["adult"] else NEG_STUDENT)
    for t in need:
        if not has(neg, t):
            errs.append(f"negative misses '{t}'")
    if two:
        for t in ("multiple girls", "2girls"):
            if has(neg, t):
                errs.append(f"two-girl art must not carry '{t}' in its negative")
    else:
        if not s["prompt"].lower().startswith("1girl, solo"):
            errs.append("prompt must start with '1girl, solo'")
    if s["prompt"].count("{POSE}") != 1:
        errs.append("prompt needs exactly one {POSE} slot")
    if len(s["poses"]) < 4:
        errs.append("at least 4 poses")
    longest = max(len(s["prompt"].replace("{POSE}", p)) for p in s["poses"])
    if longest > MAX_CHARS:
        errs.append(f"prompt too long: {longest} chars > {MAX_CHARS} (drop the last style phrases)")
    ref = s.get("charref")
    if ref:
        if not any(ref.startswith(p) for p in OWN_PREFIXES):
            errs.append(f"charref is not our own art: {ref}")
        elif not os.path.exists(ref):
            errs.append(f"charref missing: {ref}")
    return errs


if __name__ == "__main__":
    e = main(sys.argv[1])
    if e:
        print("FAIL")
        for x in e:
            print("  -", x)
        sys.exit(1)
    print("OK")
