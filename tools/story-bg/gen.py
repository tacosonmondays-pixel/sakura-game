#!/usr/bin/env python3
"""Generate story backgrounds with NovelAI (no auth header: the proxy injects the key).

usage: python3 -I gen.py [--only id,id] [--seed id=seed ...] [--extra id="tags"] [--force]
Writes backgrounds/<id>.png and appends to backgrounds/_manifest.jsonl. Sequential, one image at a time.
"""
import json, os, subprocess, sys, time, zipfile, io

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from locations import STYLE, TIME, NEGATIVE, LOCATIONS, ALT  # noqa: E402

OUT = os.environ.get("STORY_BG_OUT", os.path.join(os.getcwd(), "story-bg-out"))  # keep outputs out of the repo
RAW = os.path.join(OUT, "_raw")
os.makedirs(RAW, exist_ok=True)
URL = "https://image.novelai.net/ai/generate-image"
SUB = "https://image.novelai.net/user/subscription"


def anlas():
    r = subprocess.run(["curl", "-sS", "--max-time", "30", SUB], capture_output=True, text=True)
    try:
        d = json.loads(r.stdout)
        t = d["trainingStepsLeft"]
        return t["fixedTrainingStepsLeft"] + t["purchasedTrainingSteps"]
    except Exception:
        return None


def build(place, tod, extra=""):
    parts = ["no humans, scenery", place]
    if extra:
        parts.append(extra)
    style = STYLE.replace("bright soft colors", "soft glowing colors") if tod == "deep-night" else STYLE
    parts += [TIME[tod], style]
    return ", ".join(parts)


def body(prompt, seed, negative):
    return {
        "input": prompt,
        "model": "nai-diffusion-4-5-full",
        "action": "generate",
        "parameters": {
            "params_version": 3, "width": 1216, "height": 832, "scale": 5,
            "sampler": "k_euler_ancestral", "steps": 28, "n_samples": 1,
            "ucPreset": 0, "qualityToggle": True, "seed": seed, "noise_schedule": "karras",
            "negative_prompt": negative,
            "v4_prompt": {"caption": {"base_caption": prompt, "char_captions": []}, "use_coords": False, "use_order": True},
            "v4_negative_prompt": {"caption": {"base_caption": negative, "char_captions": []}, "legacy_uc": False},
        },
    }


def generate(id_, prompt, seed, negative):
    req = os.path.join(RAW, f"{id_}.req.json")
    z = os.path.join(RAW, f"{id_}.zip")
    with open(req, "w") as f:
        json.dump(body(prompt, seed, negative), f)
    for attempt in range(6):
        r = subprocess.run(["curl", "-sS", "--max-time", "240", "-X", "POST", URL,
                            "-H", "Content-Type: application/json", "--data-binary", f"@{req}",
                            "-o", z, "-w", "%{http_code}"], capture_output=True, text=True)
        code = r.stdout.strip()
        if code == "200":
            break
        msg = ""
        try:
            msg = open(z, "rb").read(300).decode("utf8", "replace")
        except Exception:
            pass
        print(f"  {id_}: HTTP {code} {msg[:200]} {r.stderr[:200]}", flush=True)
        if code in ("429", "500", "502", "503", "504", "000"):
            time.sleep(15 * (attempt + 1))
            continue
        return None
    else:
        return None
    with open(z, "rb") as f:
        data = f.read()
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        names = zf.namelist()
        if "image_0.png" not in names:
            print(f"  {id_}: unexpected zip entries {names}")
            return None
        png = zf.read("image_0.png")
    if not png.startswith(b"\x89PNG\r\n\x1a\n"):
        print(f"  {id_}: not a PNG")
        return None
    out = os.path.join(OUT, f"{id_}.png")
    with open(out, "wb") as f:
        f.write(png)
    os.remove(z)
    return out


def main(argv):
    only, seeds, extras, force, keep, times, alt = None, {}, {}, False, None, {}, False
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--only":
            only = set(argv[i + 1].split(",")); i += 2
        elif a == "--seed":
            k, v = argv[i + 1].split("="); seeds[k] = int(v); i += 2
        elif a == "--extra":
            k, v = argv[i + 1].split("=", 1); extras[k] = v; i += 2
        elif a == "--alt":
            alt = True; i += 1
        elif a == "--force":
            force = True; i += 1
        elif a == "--time":
            k, v = argv[i + 1].split("="); times[k] = v; i += 2
        elif a == "--keep-rejected":
            keep = argv[i + 1]; i += 2
        else:
            raise SystemExit(f"unknown arg {a}")
    base_place = {}
    start = anlas()
    print(f"Anlas before: {start}", flush=True)
    log = open(os.path.join(OUT, "_manifest.jsonl"), "a")
    first = True
    for id_, tod, place, seed in LOCATIONS:
        root = id_.rsplit("-", 1)[0] if place is None else id_
        if place is not None:
            base_place[id_] = place
        place = place if place is not None else base_place[root]
        if only and id_ not in only:
            continue
        out = os.path.join(OUT, f"{id_}.png")
        if os.path.exists(out) and not force:
            continue
        if os.path.exists(out) and keep:
            os.replace(out, os.path.join(OUT, "_rejected", f"{id_}.{keep}.png"))
        seed = seeds.get(id_, seed)
        if alt and id_ in ALT:
            tod, place = ALT[id_]
        tod = times.get(id_, tod)
        prompt = build(place, tod, extras.get(id_, ""))
        t0 = time.time()
        path = generate(id_, prompt, seed, NEGATIVE)
        dt = time.time() - t0
        rec = {"id": id_, "seed": seed, "time": tod, "prompt": prompt, "ok": bool(path), "secs": round(dt, 1),
               "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        if first:
            rec["anlas_after_first"] = anlas()
            first = False
        log.write(json.dumps(rec) + "\n"); log.flush()
        print(f"{id_}: {'ok' if path else 'FAILED'} {dt:.0f}s {rec.get('anlas_after_first', '')}", flush=True)
        time.sleep(2)
    end = anlas()
    print(f"Anlas after: {end} (spent {None if start is None or end is None else start - end})", flush=True)


if __name__ == "__main__":
    os.makedirs(os.path.join(OUT, "_rejected"), exist_ok=True)
    main(sys.argv[1:])
