#!/usr/bin/env python3
"""Sticker art that looks like the girl (owner, Oct 31): NovelAI img2img from her in-game chibi render (render.mjs)
with her own portrait (public/art/portraits/<id>-full.webp) as the character reference. Only the game's own art goes
in; never a third-party image. No Authorization header (the proxy injects the key); never print a key.

usage: STICKER_OUT=/path/outside/repo python3 -I tools/stickers/like.py [--only id,id] [--samples 4] [--strength 0.6]
                                                                     [--tag t] [--seed id=n] [--force]
Reads $STICKER_OUT/pose/<id>.png, writes $STICKER_OUT/like/<id>[.<tag>].s<k>.png, logs every request (no images) to
docs/specs/stickers/novelai-requests.jsonl with the Anlas balance before and after.
"""
import base64, io, json, os, subprocess, sys, time, zipfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from prompts import STYLE, NEGATIVE, STICKERS  # noqa: E402

REPO = os.path.dirname(os.path.dirname(HERE))
OUT = os.environ.get("STICKER_OUT") or sys.exit("set STICKER_OUT to a folder outside the repo")
LOG = os.path.join(REPO, "docs", "specs", "stickers", "novelai-requests.jsonl")
URL = "https://image.novelai.net/ai/generate-image"
SUB = "https://image.novelai.net/user/subscription"

# sticker id (prompts.py) → girl (her model and portrait)
GIRLS = {
    "hikari_go": "hikari", "aoi_nice": "aoi", "kage_onit": "kage", "momo_yay": "momo", "akane_wow": "akane",
    "yuki_help": "yuki", "miko_thanks": "miko", "ena_luck": "ena", "iroha_ready": "iroha", "tenka_charge": "tenka",
    "chigusa_bravo": "chigusa", "hotaru_boo": "hotaru",
}


def anlas():
    r = subprocess.run(["curl", "-sS", "--max-time", "30", SUB], capture_output=True, text=True)
    try:
        t = json.loads(r.stdout)["trainingStepsLeft"]
        return t["fixedTrainingStepsLeft"] + t["purchasedTrainingSteps"]
    except Exception:
        return None


def b64png(im):
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode()


def pose_base(girl):
    """Her render on white, 1024 x 1024 (the img2img base)."""
    im = Image.open(os.path.join(OUT, "pose", f"{girl}.png")).convert("RGBA")
    white = Image.new("RGBA", im.size, (255, 255, 255, 255))
    white.alpha_composite(im)
    return white.convert("RGB").resize((1024, 1024), Image.LANCZOS)


def portrait_ref(girl):
    """Her portrait (3:4) on a 1024 x 1536 white sheet (a size the character reference takes)."""
    im = Image.open(os.path.join(REPO, "public", "art", "portraits", f"{girl}-full.webp")).convert("RGB")
    im = im.resize((1024, int(im.height * 1024 / im.width)), Image.LANCZOS)
    sheet = Image.new("RGB", (1024, 1536), (255, 255, 255))
    sheet.paste(im, (0, (1536 - im.height) // 2))
    return sheet


def body(prompt, seed, girl, samples, strength):
    return {
        "input": prompt, "model": "nai-diffusion-4-5-full", "action": "img2img",
        "parameters": {
            "params_version": 3, "width": 1024, "height": 1024, "scale": 5.5,
            "sampler": "k_euler_ancestral", "steps": 28, "n_samples": samples,
            "ucPreset": 0, "qualityToggle": True, "seed": seed, "noise_schedule": "karras",
            "image": b64png(pose_base(girl)), "strength": strength, "noise": 0, "extra_noise_seed": seed,
            "negative_prompt": NEGATIVE,
            "v4_prompt": {"caption": {"base_caption": prompt, "char_captions": []}, "use_coords": False, "use_order": True},
            "v4_negative_prompt": {"caption": {"base_caption": NEGATIVE, "char_captions": []}, "legacy_uc": False},
            "director_reference_images": [b64png(portrait_ref(girl))],
            "director_reference_descriptions": [{"caption": {"base_caption": "character", "char_captions": []}, "legacy_uc": False}],
            "director_reference_information_extracted": [1],
            "director_reference_strength_values": [1],
            "director_reference_secondary_strength_values": [0],
        },
    }


def generate(name, payload, samples):
    os.makedirs(os.path.join(OUT, "like", "_raw"), exist_ok=True)
    req = os.path.join(OUT, "like", "_raw", f"{name}.req.json")
    z = os.path.join(OUT, "like", "_raw", f"{name}.zip")
    with open(req, "w") as f:
        json.dump(payload, f)
    for attempt in range(5):
        r = subprocess.run(["curl", "-sS", "--max-time", "300", "-X", "POST", URL, "-H", "Content-Type: application/json",
                            "--data-binary", f"@{req}", "-o", z, "-w", "%{http_code}"], capture_output=True, text=True)
        code = r.stdout.strip()
        if code == "200":
            break
        msg = open(z, "rb").read(400).decode("utf8", "replace") if os.path.exists(z) else ""
        print(f"  {name}: HTTP {code} {msg[:300]}", flush=True)
        if code in ("429", "500", "502", "503", "504", "000"):
            time.sleep(15 * (attempt + 1))
            continue
        return []
    else:
        return []
    outs = []
    with zipfile.ZipFile(io.BytesIO(open(z, "rb").read())) as zf:
        for k in range(samples):
            png = zf.read(f"image_{k}.png")
            out = os.path.join(OUT, "like", f"{name}.s{k}.png")
            with open(out, "wb") as f:
                f.write(png)
            outs.append(out)
    os.remove(z)
    os.remove(req)  # (it holds our own art as base64: no need to keep it)
    return outs


def main(argv):
    only, seeds, force, tag, samples, strength = None, {}, False, "", 4, 0.6
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--only":
            only = set(argv[i + 1].split(",")); i += 2
        elif a == "--seed":
            k, v = argv[i + 1].split("="); seeds[k] = int(v); i += 2
        elif a == "--tag":
            tag = argv[i + 1]; i += 2
        elif a == "--samples":
            samples = int(argv[i + 1]); i += 2
        elif a == "--strength":
            strength = float(argv[i + 1]); i += 2
        elif a == "--force":
            force = True; i += 1
        else:
            raise SystemExit(f"unknown arg {a}")
    start = anlas()
    print(f"Anlas before: {start}", flush=True)
    with open(LOG, "a") as log:
        for id_, subject, pose, seed in STICKERS:
            girl = GIRLS.get(id_)
            if not girl or (only and id_ not in only):
                continue
            name = f"{id_}.{tag}" if tag else id_
            if os.path.exists(os.path.join(OUT, "like", f"{name}.s0.png")) and not force:
                continue
            seed = seeds.get(id_, seed + 500)
            prompt = ", ".join([subject, pose, STYLE])
            before = anlas()
            outs = generate(name, body(prompt, seed, girl, samples, strength), samples)
            rec = {"id": id_, "try": f"likeness{('-' + tag) if tag else ''}", "seed": seed, "size": "1024x1024", "steps": 28,
                   "samples": samples, "model": "nai-diffusion-4-5-full", "action": "img2img", "strength": strength,
                   "base": f"render of public/models/characters/{girl}.glb (tools/stickers/render.mjs)",
                   "reference": f"public/art/portraits/{girl}-full.webp (character reference)",
                   "prompt": prompt, "negative": NEGATIVE, "ok": bool(outs), "anlas_before": before, "anlas_after": anlas(),
                   "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
            log.write(json.dumps(rec) + "\n"); log.flush()
            print(f"{name}: {'ok' if outs else 'FAILED'} {rec['anlas_before']} -> {rec['anlas_after']}", flush=True)
            time.sleep(2)
    end = anlas()
    print(f"Anlas after: {end} (spent {None if start is None or end is None else start - end})", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:])
