#!/usr/bin/env python3
"""Generate sticker art with NovelAI (no auth header: the proxy injects the key; never print a key).

usage: python3 -I tools/stickers/gen.py [--only id,id] [--seed id=n] [--force] [--tag try2]
Free tier only: 1024x1024, 28 steps, 1 sample, no reference images = 0 Anlas (the balance is read before and after).
Writes $STICKER_OUT/<id>.png (outside the repo) and appends every request to docs/specs/stickers/novelai-requests.jsonl.
"""
import io, json, os, subprocess, sys, time, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from prompts import STYLE, NEGATIVE, STICKERS  # noqa: E402

REPO = os.path.dirname(os.path.dirname(HERE))
OUT = os.environ.get("STICKER_OUT") or sys.exit("set STICKER_OUT to a folder outside the repo")
LOG = os.path.join(REPO, "docs", "specs", "stickers", "novelai-requests.jsonl")
URL = "https://image.novelai.net/ai/generate-image"
SUB = "https://image.novelai.net/user/subscription"


def anlas():
    r = subprocess.run(["curl", "-sS", "--max-time", "30", SUB], capture_output=True, text=True)
    try:
        t = json.loads(r.stdout)["trainingStepsLeft"]
        return t["fixedTrainingStepsLeft"] + t["purchasedTrainingSteps"]
    except Exception:
        return None


def body(prompt, seed):
    return {
        "input": prompt, "model": "nai-diffusion-4-5-full", "action": "generate",
        "parameters": {
            "params_version": 3, "width": 1024, "height": 1024, "scale": 5.5,
            "sampler": "k_euler_ancestral", "steps": 28, "n_samples": 1,
            "ucPreset": 0, "qualityToggle": True, "seed": seed, "noise_schedule": "karras",
            "negative_prompt": NEGATIVE,
            "v4_prompt": {"caption": {"base_caption": prompt, "char_captions": []}, "use_coords": False, "use_order": True},
            "v4_negative_prompt": {"caption": {"base_caption": NEGATIVE, "char_captions": []}, "legacy_uc": False},
        },
    }


def generate(name, prompt, seed):
    os.makedirs(os.path.join(OUT, "_raw"), exist_ok=True)
    req = os.path.join(OUT, "_raw", f"{name}.req.json")
    z = os.path.join(OUT, "_raw", f"{name}.zip")
    with open(req, "w") as f:
        json.dump(body(prompt, seed), f)
    for attempt in range(5):
        r = subprocess.run(["curl", "-sS", "--max-time", "240", "-X", "POST", URL, "-H", "Content-Type: application/json",
                            "--data-binary", f"@{req}", "-o", z, "-w", "%{http_code}"], capture_output=True, text=True)
        code = r.stdout.strip()
        if code == "200":
            break
        print(f"  {name}: HTTP {code}", flush=True)
        if code in ("429", "500", "502", "503", "504", "000"):
            time.sleep(15 * (attempt + 1))
            continue
        return None
    else:
        return None
    with zipfile.ZipFile(io.BytesIO(open(z, "rb").read())) as zf:
        png = zf.read("image_0.png")
    os.remove(z)
    if not png.startswith(b"\x89PNG"):
        return None
    out = os.path.join(OUT, f"{name}.png")
    with open(out, "wb") as f:
        f.write(png)
    return out


def main(argv):
    only, seeds, force, tag = None, {}, False, ""
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--only":
            only = set(argv[i + 1].split(",")); i += 2
        elif a == "--seed":
            k, v = argv[i + 1].split("="); seeds[k] = int(v); i += 2
        elif a == "--tag":
            tag = argv[i + 1]; i += 2
        elif a == "--force":
            force = True; i += 1
        else:
            raise SystemExit(f"unknown arg {a}")
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    before = anlas()
    print(f"Anlas before: {before}", flush=True)
    with open(LOG, "a") as log:
        for id_, subject, pose, seed in STICKERS:
            if only and id_ not in only:
                continue
            name = f"{id_}.{tag}" if tag else id_
            if os.path.exists(os.path.join(OUT, f"{name}.png")) and not force:
                continue
            seed = seeds.get(id_, seed)
            prompt = ", ".join([subject, pose, STYLE])
            t0 = time.time()
            path = generate(name, prompt, seed)
            rec = {"id": id_, "try": tag or "1", "seed": seed, "size": "1024x1024", "steps": 28, "model": "nai-diffusion-4-5-full",
                   "prompt": prompt, "negative": NEGATIVE, "ok": bool(path), "anlas_after": anlas(),
                   "secs": round(time.time() - t0, 1), "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
            log.write(json.dumps(rec) + "\n"); log.flush()
            print(f"{name}: {'ok' if path else 'FAILED'} anlas={rec['anlas_after']}", flush=True)
            time.sleep(2)
    after = anlas()
    print(f"Anlas after: {after} (spent {None if before is None or after is None else before - after})", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:])
