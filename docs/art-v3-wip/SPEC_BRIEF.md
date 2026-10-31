# Round 2 spec fixes (art v3, Sakura Sentinels roster portraits)

Round 1 failed for all 32 girls. Judges' verdicts: /home/user/work/judge/<id>.json (`fixes`, `safety_flags`, per-candidate notes).
Specs: /home/user/work/roster/<id>/spec.json (format in /home/user/work/tools/nai_gen.py docstring). The round-1 spec is
kept as spec.r1.json; do not edit that.

## Already done for everyone (do NOT redo or undo)
The shared STYLE fix: spec.json's prompt now ends with a new style tail (from "anime screencap, anime coloring, ..." to
"... anime key visual") and the negative already gained monochrome/coloring book/sketch/simple background/white background/
border/frame/flat color/no shading/manga/glossy etc. and lost "painted gradients, brush texture, dark shadows, few colors".
Pilots with this tail render shaded art with real soft backgrounds. Leave the tail alone except: if the girl's prompt still
contains "background melted into soft shapes with no lines" or other "no lines/flat" wording BEFORE the tail, remove it.

## Your job, per girl
Apply the judges' GIRL-SPECIFIC fixes to spec.json: identity words (eye colour, halo shape, outfit details, props), re-weights
with NovelAI syntax `1.3::words::` (sparingly: halo shape, eye colour, a missing item), negative additions (e.g. `plain ring halo`,
`back view`, `midriff`, `bare thighs`, `short skirt`, `weapon pointed at viewer`), the poses (keep the ones judges liked,
rewrite or drop the bad ones; keep at least 4 poses; each pose keeps a dynamic camera: foreshortened hand/prop toward the
viewer, dutch angle, eye level or slightly from above, NEVER from below; weapons never aimed at the viewer), and
`"fid": 0.x` (character-reference fidelity, default 0.6) when the judges advise it.
Ensure the halo is drawn fully inside the frame: add "whole halo visible inside the frame, small gap above the halo".
For poses with the head near the top, prefer "upper body" or "cowboy shot" with headroom.

## Content rules (strict, project law)
- Students (adult:false) are never sexualised: knee-length skirts or longer / tights, no bare thighs, no midriff, no chest
  focus; wholesome expressions. Adults are never framed around their bodies (no bust/hip/leg focus; for a large-busted
  reference add `modest`, keep a coat/jacket closed over the chest, frame from a 3/4 angle with the reaching hand or prop as
  the focus). No swimsuits, underwear, gore, blood.
- Never write any girl's name, any game/anime/studio/artist name, or "in the style of" in prompts (check_spec enforces).
- Hikari: eyes TEAL (keep 1.4 weight and the pink/purple/lilac/red-eyes negative); her white greatcoat must show; fix the
  judges' bust-centred framing (lower fid 0.45, closed greatcoat, `modest`, 3/4 view, the hand toward the viewer as focus).
- Norika (no reference art, generated with a style vibe): make her clearly an ADULT woman (judges: reads as a child):
  "adult woman in her thirties, tall, mature face"; text-free sash; fix halo touching the edge.
- Kogane: her character reference is now her own round-1 candidate r1-2 (good identity, no cog halo): strengthen the
  cogwheel halo.
- Kohaku & Tsubaki: two girls via char_captions; keep each girl's items in her own caption; do not put "2girls" or
  "multiple girls" in the negative.

## Finish
Run `python3 -I /home/user/work/tools/check_spec.py /home/user/work/roster/<id>/spec.json` for every girl you touched;
it must print OK. Keep the prompt under check_spec's length limit (trim scene adjectives before identity words).
Do not generate images, do not use the network, do not touch images. Reply with a short list: id: what you changed.

## Round 3 addendum (only for girls that FAILED round 2)
Round 2 verdicts with fixes: /home/user/work/judge/<id>.json ("round": 2). The round-2 spec is saved as spec.r2.json; edit
spec.json. Apply the girl's round-2 fixes. Recurring causes across the roster:
- Halo clipped at the top edge or missing: put the halo words right after the hair words, weight `1.4::...::`, and frame
  with headroom: "her head in the upper third of the picture, clear space above the halo"; prefer "upper body" or
  "cowboy shot" over close-ups; add to the negative `cropped halo, halo cut off, head out of frame`.
- Skirt length ignored (students): `1.4::long skirt reaching below the knees::`, add the negative `miniskirt, short skirt,
  thighs, bare thighs, frilled garter`; if tights exist in the identity keep them.
- Prop aimed at the camera (cannons, guns, lances): say "barrel pointing up", "held upright"; never "toward the viewer".
- Static camera: the reaching hand or a small harmless prop goes toward the lens; dutch angle; slightly from above.
- Eyes too low: "from slightly above", "upper body".
Keep the shared style tail. Run check_spec.py on each. Reply with a short change list.

## Round 4 addendum (LAST round: budget allows 3 candidates per girl, no more)
Verdicts with fixes: /home/user/work/judge/<id>.json ("round": 3, covering r2 and r3). The round-3 spec is saved as
spec.r3.json; edit spec.json. Lead decisions:
- Identity follows the SHIPPED portrait: Kage's metal headband plate and Sango's anchor beret badge are accepted (remove
  the negatives fighting them and stop asking for a seashell badge / cloth headband). Kage must hold her shuriken
  upright on a raised fingertip (her shipped pose).
- The #1 failure is a halo clipped by the top edge or missing. Make the halo SMALL ("small thin halo"), centred just
  above her head, and frame "cowboy shot, her eyes about 30 % down the picture, wide empty sky above her head".
  If a halo shape keeps failing (snowflake, star), accept a simple thin ring in her colour rather than lose it.
- Base each girl on her best round-3/round-2 candidate (the judge names it); keep that pose first, fix only its faults.
  Read that candidate's prompt from the girl's _manifest.jsonl.
- Tenka: fid 0.5, remove coil-field / ring words around the gun, gun resting on her shoulder, barrel up.
- Yoriko: drop any crossed-plank control bar (it reads as a cross): the doll hangs from "a single short horizontal
  wooden bar with strings", or the doll sits on her shoulder with no bar at all.
- Kohaku & Tsubaki: if the dynamic camera keeps failing, prefer a clean medium shot of both leaning toward the viewer,
  one hand each reaching toward the lens.
- Kogane: drop the walker from prompt and poses (fails every round); she alone with wrench on shoulder.
Run check_spec.py on each. Reply with a short change list.
