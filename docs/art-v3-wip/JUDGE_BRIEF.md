# Art v3 round judging brief (Sakura Sentinels roster portraits)

You are an independent art judge. You did not write these prompts. Judge harshly and honestly; a pick ships to players.

## Inputs
- Work folder: /home/user/work/roster/<id>/ — candidates `rN-k.webp` or `rN-k.png` (768x1024), the prompt spec `spec.json`
  (read its `identity` list, `adult` flag and `notes`), the request log `_manifest.jsonl` (prompt/pose per candidate).
- Contact sheets: /home/user/work/sheets/<id>-r1.jpg — leftmost tile is her CURRENT shipped portrait (identity reference;
  for kogane and norika it is a coming-soon sign: judge identity from the spec only), then the candidates downscaled.
  Open individual candidate files at full size whenever hands, eyes, text or safety need a closer look (do it for every
  candidate that might be picked).
- Target style "Look B": /home/user/work/sheets/_lookB_reference.jpg (two shipped portraits): clean academy anime look,
  thin tinted lines (not heavy black ink), flat two-tone cel shading, high-key bright values, soft defocused painted
  background with a real place (not a blank/flat colour field, not a card frame/border), plus a DYNAMIC camera:
  diagonal/dutch composition, foreshortened hand or prop reaching toward the viewer, motion in hair/cloth.
- Measuring aid: `python3 -I /home/user/work/tools/grid.py <image> [--zoom X0 Y0 X1 Y1]` writes a gridded jpg beside the
  image (in master pixels). Only write grid files into /home/user/work/judge/tmp/ (copy the image there first).

## Hard checks (any fail = candidate rejected, whatever its score)
1. Identity: hair colour/style, eye colour, signature accessories and outfit from `identity` all present and right.
   Hikari: eyes must be TEAL.
2. Safety (strict, project rule): fully dressed; no swimsuit/underwear; camera at eye level or above (never from below);
   students (adult:false) never sexualised in any way, never chest/hip/thigh emphasis; adults never framed around their
   body (no chest-centred composition, no exaggerated bust, no leg/thigh focus); wholesome expression; no gore/blood;
   no weapon aimed at the viewer. If a candidate is borderline, reject it and say why.
3. Hands: five fingers each visible hand, no fused/extra fingers, no extra hands or arms; props held plausibly.
4. No text, letters, logos, watermarks, signatures, speech bubbles.
5. Crops survive: face centre 30–70% across the image width; eyes 15–36% down from the top; the whole head (and halo)
   inside the frame; nothing cut awkwardly at the head.
6. Count: one girl only (kohaku_tsubaki: exactly two girls, both correct, left = the first char caption, right = the second).
7. No frame/border/card edge/panel drawn inside the image; no blank white or flat single-colour background.

## Scores (0–10 each), weighted total = (3*identity + 2.5*camera + 2*lookB + 1.5*composition + 1*appeal) / 10
- identity: how faithfully she reads as the CURRENT portrait / spec (face, hair, eyes, outfit details, props).
- camera: dynamic camera as in Look B reference (diagonal, foreshortening, motion). Static front-on = low.
- lookB: thin tinted lines, flat 2-tone cel, high-key, soft painted background of a real place. Heavy black lineart,
  manga-ish inking, blank/flat backgrounds, glossy/painterly rendering = low.
- composition: readable silhouette, good use of the 3:4 frame, survives card (3:5 head-to-hips), bust and thumb crops.
- appeal: charm, expression, would a player be happy pulling her.

## Decision per girl
- PICK the best candidate that passes every hard check AND scores >= 7.5. Otherwise FAIL the girl.
- For a FAIL, write concrete fixes for round 2: exact prompt words to add/remove/re-weight, negative terms, which pose
  to keep or change, charref fidelity up/down (default 0.6), anything else. Be specific (they will be pasted into the spec).
- For a PICK, measure on the picked image (use grid.py): the point between her eyes (x, y px in the 768x1024 master)
  and her head height in px (crown, not halo, to chin).

## Output
For each girl write /home/user/work/judge/<id>.json:
{"id": "...", "round": N, "candidates": {"r1-0": {"hard": {"identity": "pass|fail: why", "safety": "...", "hands": "...",
 "text": "...", "crops": "...", "count": "...", "frame_bg": "..."}, "scores": {"identity": x, "camera": x, "lookB": x,
 "composition": x, "appeal": x}, "total": x, "notes": "..."}, ...},
 "decision": "PICK" | "FAIL", "pick": "r1-k" | null, "pick_total": x | null,
 "eyes": [x, y] | null, "head": h | null, "fixes": "..." | null, "safety_flags": "anything worth a human look, or empty"}
Then reply with a compact table: id, decision, pick, total, one-line reason. Do not edit spec.json or any image.
Do not call any image generator. Do not use the network.

## Round 2 addendum
Round 2 candidates are `r2-0.png .. r2-2.png` (PNG, 768x1024); contact sheet /home/user/work/sheets/<id>-r2.jpg (leftmost is
still her CURRENT shipped portrait). Round 1 all failed (verdicts in /home/user/work/judge/r1/<id>.json; you may read them for
what was wrong). The specs were rewritten for round 2 (spec.json; old one spec.r1.json). Judge ONLY the r2 candidates, with
the same hard checks and weights. Write /home/user/work/judge/<id>.json with "round": 2. A PICK needs eyes [x, y] and head h
measured with grid.py on the picked PNG. For Kogane and Norika (no shipped art), identity is judged against the spec only.

## Round 3 addendum
Round 3 candidates are `r3-0.png .. r3-2.png`; sheet /home/user/work/sheets/<id>-r3.jpg. Round 2 verdicts are in
/home/user/work/judge/r2/<id>.json. Judge the r3 candidates AND reconsider the girl's round-2 candidates r2-0..r2-2 (pick
the best passing one across both rounds). Write /home/user/work/judge/<id>.json with "round": 3 (pick may be "r2-k" or "r3-k").

## Round 4 addendum (final round)
Candidates `r4-0.png .. r4-2.png`; sheet /home/user/work/sheets/<id>-r4.jpg. Round 3 verdicts (covering r2 and r3):
/home/user/work/judge/r3/<id>.json. Lead decisions that change identity: Kage's metal headband plate and Sango's anchor
beret badge are her shipped design (accepted); Iroha's hovering mirror panel and Kogane's walker are dropped from the
portrait (not required); a missing required hand prop is still a hard fail. Judge r4 and reconsider r2/r3 under these
decisions; pick the best passing candidate of any round. Write judge/<id>.json with "round": 4. No more rounds follow, so
for a FAIL also name the best candidate and its score.

## Round 5 addendum (re-rolls, the budget is now spent)
Re-rolls of the best round-4 spec with one fix each: tenka r5-0..2, seiran r5-0..1, sango r5-0..1, kogane r5-0..1 (sheets
/home/user/work/sheets/<id>-r5.jpg). Judge them and compare with the girl's previous best (judge/<id>.json, round 4).
Update judge/<id>.json with "round": 5, keeping the best passing candidate of any round.
