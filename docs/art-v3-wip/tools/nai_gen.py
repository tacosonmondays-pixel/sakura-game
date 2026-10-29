#!/usr/bin/env python3
"""Art v3 roster portraits (Look B, the clean academy look) with NovelAI V4.5 full.

No Authorization header anywhere: the agent proxy injects it. Never print, log or write a key.
Every request goes through one file lock (NovelAI runs one generation per account at a time) and checks the
Anlas balance first: below FLOOR it refuses (the roster run's hard cap).

usage:
  python3 -I nai_gen.py status
  python3 -I nai_gen.py gen <id> <round> <k> [--seed N] [--pose I] [--fid 0.6] [--no-charref] [--vibe azami:0.2]
                            [--scale 5] [--extra "words, ..."] [--extra-neg "words, ..."]
     reads   ROSTER/<id>/spec.json      (see SPEC below; check_spec.py must pass first)
     writes  ROSTER/<id>/r<round>-<k>.png and one line in ROSTER/<id>/_manifest.jsonl and ROSTER/_ledger.jsonl
     --pose I   index into spec.poses (default k % len(poses))
     --seed N   default: a stable hash of id/round/k

SPEC (ROSTER/<id>/spec.json):
  {"id", "adult": bool, "prompt": "... {POSE} ...", "negative": "...", "poses": ["...", ...],
   "charref": "<our own image path>", "charref_box": [x0, y0, x1, y1] (optional crop in px of that image),
   "char_captions": [{"caption": "...", "x": 0.3, "y": 0.5}, ...] (optional, two-girl art only),
   "identity": ["must-match item", ...], "scene": "...", "notes": "..."}
"""
import base64, fcntl, hashlib, io, json, os, subprocess, sys, time, zipfile
from PIL import Image

ROSTER = "/tmp/claude-0/-home-user/bc8e90b4-5af0-5aad-ab54-4a98bb73399f/scratchpad/art-v3/roster"
LOCK = os.path.join(ROSTER, "_nai.lock")
LEDGER = os.path.join(ROSTER, "_ledger.jsonl")
FLOOR = 6680  # 8480 at the start of the roster run minus the 1,800 Anlas cap
GEN = "https://image.novelai.net/ai/generate-image"
SUB = "https://image.novelai.net/user/subscription"
MODEL = "nai-diffusion-4-5-full"
VIBES = {"azami": "/tmp/claude-0/-home-user/bc8e90b4-5af0-5aad-ab54-4a98bb73399f/scratchpad/art-v3/pilot/kogane/_cache/vibe-azami-ie0.5.bin"}


def anlas():
    r = subprocess.run(["curl", "-sS", "--max-time", "30", SUB], capture_output=True, text=True)
    try:
        t = json.loads(r.stdout)["trainingStepsLeft"]
        return t["fixedTrainingStepsLeft"] + t["purchasedTrainingSteps"]
    except Exception:
        return None


def png_b64(img):
    b = io.BytesIO()
    img.save(b, "PNG")
    return base64.b64encode(b.getvalue()).decode()


def charref_b64(path, box=None, size=(1024, 1536)):
    img = Image.open(path).convert("RGB")
    if box:
        img = img.crop(tuple(int(v) for v in box))
    W, H = size
    s = min(W / img.width, H / img.height)
    im = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    canvas = Image.new("RGB", size, (0, 0, 0))
    canvas.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
    return png_b64(canvas)


def post(body, out):
    req = out + ".req.json"
    with open(req, "w") as f:
        json.dump(body, f)
    code, msg = "000", ""
    for attempt in range(5):
        r = subprocess.run(["curl", "-sS", "--max-time", "300", "-X", "POST", GEN, "-H", "Content-Type: application/json",
                            "--data-binary", f"@{req}", "-o", out, "-w", "%{http_code}"], capture_output=True, text=True)
        code = r.stdout.strip()
        if code == "200":
            break
        try:
            msg = open(out, "rb").read(400).decode("utf8", "replace")
        except Exception:
            msg = ""
        print(f"  HTTP {code} {msg[:300]} {r.stderr[:160]}", flush=True)
        if code in ("429", "500", "502", "503", "504", "000"):
            time.sleep(20 * (attempt + 1))
            continue
        break
    os.remove(req)
    return code, (None if code == "200" else msg[:400])


def stable_seed(*parts):
    return int(hashlib.sha256("/".join(map(str, parts)).encode()).hexdigest()[:8], 16) % 4294967295


def gen(gid, rnd, k, seed=None, pose=None, fid=0.6, charref=True, vibe=None, scale=5.0, extra="", extra_neg=""):
    d = os.path.join(ROSTER, gid)
    spec = json.load(open(os.path.join(d, "spec.json")))
    chk = subprocess.run([sys.executable, "-I", os.path.join(os.path.dirname(__file__), "check_spec.py"), os.path.join(d, "spec.json")],
                         capture_output=True, text=True)
    if chk.returncode != 0:
        raise SystemExit("spec check failed:\n" + chk.stdout + chk.stderr)
    poses = spec["poses"]
    pi = (k % len(poses)) if pose is None else pose
    prompt = spec["prompt"].replace("{POSE}", poses[pi])
    if extra:
        prompt = prompt + ", " + extra
    neg = spec["negative"] + ((", " + extra_neg) if extra_neg else "")
    seed = stable_seed(gid, rnd, k) if seed is None else seed
    chars = spec.get("char_captions") or []
    p = {
        "params_version": 3, "width": 768, "height": 1024, "scale": scale, "sampler": "k_euler_ancestral", "steps": 28,
        "n_samples": 1, "ucPreset": 0, "qualityToggle": True, "seed": seed, "noise_schedule": "karras",
        "negative_prompt": neg,
        "v4_prompt": {"caption": {"base_caption": prompt, "char_captions": [
            {"char_caption": c["caption"], "centers": [{"x": c["x"], "y": c["y"]}]} for c in chars]},
            "use_coords": bool(chars), "use_order": True},
        "v4_negative_prompt": {"caption": {"base_caption": neg, "char_captions": [
            {"char_caption": "", "centers": [{"x": c["x"], "y": c["y"]}]} for c in chars]}, "legacy_uc": False},
    }
    refs = []
    if charref and spec.get("charref"):
        p["director_reference_images"] = [charref_b64(spec["charref"], spec.get("charref_box"))]
        p["director_reference_descriptions"] = [{"caption": {"base_caption": "character", "char_captions": []}, "legacy_uc": False}]
        p["director_reference_information_extracted"] = [1]
        p["director_reference_strength_values"] = [1]
        p["director_reference_secondary_strength_values"] = [round(1 - fid, 3)]
        refs.append({"file": spec["charref"], "box": spec.get("charref_box"), "kind": "character-reference", "style_aware": False, "fidelity": fid})
    if vibe:
        name, strength = vibe.split(":")
        p["reference_image_multiple"] = [base64.b64encode(open(VIBES[name], "rb").read()).decode()]
        p["reference_strength_multiple"] = [float(strength)]
        p["normalize_reference_strength_multiple"] = True
        refs.append({"file": VIBES[name], "kind": "vibe (cached encoding of our own portrait)", "strength": float(strength)})
    body = {"input": prompt, "model": MODEL, "action": "generate", "parameters": p}
    name = f"r{rnd}-{k}"
    z = os.path.join(d, "_raw", name + ".zip")
    os.makedirs(os.path.dirname(z), exist_ok=True)
    with open(LOCK, "w") as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        before = anlas()
        if before is None or before < FLOOR:
            rec = {"time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "id": gid, "name": name, "ok": False,
                   "error": f"REFUSED: balance {before} below the roster floor {FLOOR}"}
            open(LEDGER, "a").write(json.dumps(rec) + "\n")
            raise SystemExit(rec["error"])
        t0 = time.time()
        code, err = post(body, z)
        after = anlas()
    out = None
    if code == "200":
        try:
            with zipfile.ZipFile(z) as zf:
                png = zf.read(zf.namelist()[0])
            if png.startswith(b"\x89PNG\r\n\x1a\n"):
                out = os.path.join(d, name + ".png")
                open(out, "wb").write(png)
            else:
                err = "not a png"
        except Exception as e:
            err = f"bad zip: {e}"
    if os.path.exists(z):
        os.remove(z)
    rec = {"time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "id": gid, "round": rnd, "k": k, "name": name,
           "file": out, "seed": seed, "pose": pi, "pose_text": poses[pi], "prompt": prompt, "negative": neg, "refs": refs,
           "scale": scale, "ok": bool(out), "http": code, "error": err, "secs": round(time.time() - t0, 1),
           "anlas_before": before, "anlas_after": after}
    open(os.path.join(d, "_manifest.jsonl"), "a").write(json.dumps(rec) + "\n")
    open(LEDGER, "a").write(json.dumps({k2: rec[k2] for k2 in ("time", "id", "name", "ok", "http", "anlas_before", "anlas_after")}) + "\n")
    print(json.dumps({k2: rec[k2] for k2 in ("id", "name", "file", "seed", "pose", "ok", "http", "error", "anlas_before", "anlas_after")}), flush=True)
    return out


def status():
    n = ok = 0
    first = None
    if os.path.exists(LEDGER):
        for line in open(LEDGER):
            r = json.loads(line)
            n += 1
            ok += bool(r.get("ok"))
            if first is None and r.get("anlas_before") is not None:
                first = r["anlas_before"]
    now = anlas()
    print(json.dumps({"anlas": now, "floor": FLOOR, "requests": n, "images": ok, "spent_since_first": (first - now) if first and now else None}))


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] == "status":
        status()
    elif a[0] == "gen":
        gid, rnd, k = a[1], int(a[2]), int(a[3])
        kw = {}
        i = 4
        while i < len(a):
            f = a[i]
            if f == "--seed": kw["seed"] = int(a[i + 1]); i += 2
            elif f == "--pose": kw["pose"] = int(a[i + 1]); i += 2
            elif f == "--fid": kw["fid"] = float(a[i + 1]); i += 2
            elif f == "--no-charref": kw["charref"] = False; i += 1
            elif f == "--vibe": kw["vibe"] = a[i + 1]; i += 2
            elif f == "--scale": kw["scale"] = float(a[i + 1]); i += 2
            elif f == "--extra": kw["extra"] = a[i + 1]; i += 2
            elif f == "--extra-neg": kw["extra_neg"] = a[i + 1]; i += 2
            else: raise SystemExit(f"unknown arg {f}")
        gen(gid, rnd, k, **kw)
    else:
        raise SystemExit(__doc__)
