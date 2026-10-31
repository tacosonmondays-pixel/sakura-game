# Art v3c judging brief (owner option C) — Sakura Sentinels roster portraits

You are an independent judge; you did not write the prompts. A pick ships to players and the owner sees a board.

## Inputs
- Candidates: /home/user/work/v3c/<id>/r<N>-<k>.png (768x1024); spec /home/user/work/v3c/<id>/spec.json (`identity`,
  `adult`, `notes`); request log _manifest.jsonl.
- Sheets: /home/user/work/sheets/c-<id>-r<N>.jpg — leftmost tile is her CURRENT portrait (the likeness reference;
  Norika has none: her reference is /home/user/work/roster/norika/r2-0.png, judge her against the spec and that).
  Open every candidate that could be picked at full size (hands, faces, text, halo, safety).
- Measuring: `python3 -I /home/user/work/tools/grid.py <copy>` (copy the image into /home/user/work/judge-c/tmp/ first).

## Owner's rules (hard checks: any fail rejects the candidate)
1. NO HALO: no ring, disc, arc or glowing circle floating over or behind her head (a hat, hair ornament or the sun is
   fine). Any halo-like ring = reject.
2. SIGNATURE PROP present and right (as in her current portrait / spec identity "SIGNATURE PROP"), held plausibly or
   clearly beside her. A wrong or missing prop = reject. Weapons never aimed at the viewer.
3. Safety (project law): fully dressed; no swimsuit/underwear; camera at eye level or above; students (adult:false)
   never sexualised (no chest/hip/thigh focus, no bare thighs or midriff); adults (adult:true) read clearly as ADULT
   women (mature face, adult proportions, professional clothes) and are never framed around their body; no gore.
   Borderline = reject, say why.
4. Hands: five fingers per visible hand, no fused/extra fingers or extra limbs.
5. No text, letters, logos, watermarks, signatures, numbers on props.
6. Crops: face centre 30–70 % across, eyes 15–36 % down, whole head inside the frame.
7. One girl only. No frame/border inside the image.

## Scores (0–10), total = (4*likeness + 1.5*prop + 1.5*background + 1*camera + 2*quality) / 10
- likeness: does she read as the SAME girl as her current portrait (face, hair colour/cut, eye colour, outfit pieces,
  accessories)? This dominates; the owner picks by likeness first.
- prop: her signature prop, correct and well drawn, held naturally.
- background: richly detailed real place, at least as detailed as her current portrait's (not a blurred blank).
- camera: dynamic (dutch angle, a hand/prop toward the viewer, motion).
- quality: clean anatomy, clean Look B rendering (thin tinted lines, two-tone cel, high-key), appeal.

## Decision per girl
PICK the passing candidate with the highest total if its total >= 7.5 AND likeness >= 7.5; otherwise FAIL with concrete
spec fixes (exact prompt words, negatives, fid up/down, which pose to keep). For the pick measure on its PNG: the point
between the eyes [x, y] and head height h in px (crown, not hat, to chin). Also fill the owner checklist for the pick:
likeness (yes/no + note), prop (yes/no), halo-free (yes/no), background (rich/plain), adult reads adult (yes/no/n.a.).

## Output
/home/user/work/judge-c/<id>.json: {"id", "round": N, "candidates": {"rN-k": {"hard": {...}, "scores": {...},
"total": x, "notes": "..."}}, "decision": "PICK"|"FAIL", "pick", "pick_total", "eyes", "head",
"checklist": {"likeness": "...", "prop": "...", "halo_free": "...", "background": "...", "adult": "..."},
"fixes", "safety_flags"}. Reply with a compact table (id, decision, pick, total, likeness, eyes, head, reason).
Do not edit specs or images; no generator, no network.
