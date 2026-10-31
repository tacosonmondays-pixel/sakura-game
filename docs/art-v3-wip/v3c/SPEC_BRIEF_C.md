# Art v3c spec pass (owner option C, Oct 31) — Sakura Sentinels roster portraits

Specs: /home/user/work/v3c/<id>/spec.json (format: /home/user/work/tools/nai_gen.py docstring). spec.v3.json is the
v3 spec it was made from (keep it). A script already: removed every halo word from prompt/poses/identity and put halo
terms in the negative (the owner wants NO halo rings at all); replaced the style tail (from "anime screencap" to the end)
with one asking for a richly detailed background. Do not touch that tail or the halo negatives; remove any halo word left.

## Owner's fixes you apply per girl
1. **Signature prop, matching her CURRENT portrait and kit.** Look at her current portrait
   /home/user/sakura-game/public/art/portraits/<id>-full.webp (open it) and her unit data (grep her id in
   /home/user/sakura-game/src/data/units*.js and unitKit.js: weapon / role / ability names). Name her signature prop(s)
   exactly as drawn there (e.g. Kanna: her taiko drum and two drumsticks; Rei: her sword; Yuki: her ice-crystal staff,
   never a coffee cup). The prop must appear in EVERY pose, held plausibly (hand gripping it) or clearly beside her;
   weapons held upright or resting, never aimed at the viewer. Remove props the v3 spec invented that are not hers.
   Put the prop in `identity` too.
2. **Background as rich as the old portrait's.** Describe her current portrait's place in concrete detail (5–8 named
   objects: lanterns, shelves, stalls, trees, buildings...), a time of day and light. Bright, high-key is fine. It may
   be the same place as her current portrait or the v3 scene if that is equally her own; pick the richer one.
3. **Likeness first.** Identity words (hair colour/style, eye colour, outfit pieces, accessories) must match her current
   portrait; fix any v3 drift. Keep the charref (her current portrait) and its box. Set "fid": 0.7 (stronger likeness)
   unless the v3 notes give a reason for lower (e.g. a reference that pulls a bust-forward pose: then 0.55).
4. **Adults** (adult: true — hikari, kanna, nami, norika): read clearly as adults: "adult woman in her twenties/thirties,
   tall, mature face, adult proportions", professional clothes as in her portrait/kit; three-quarter view; never framed
   around the body (no chest/hip/leg focus; coats closed over the chest; `modest`). Norika has no drawn portrait: use
   "charref": "/home/user/work/roster/norika/r2-0.png" (her own v3 art; fid 0.5), drop "vibe" and "no_charref", and make
   her a woman in her thirties in a crossing-guard staff uniform (navy jacket and slacks, safety sash, red paddle sign,
   whistle on a lanyard, hard hat); describe a busy school-gate crossing.
5. **Students** never sexualised: knee-length or longer skirts or tights as in her portrait, no midriff/thighs/chest
   focus. No other games', anime, studio or artist names anywhere.
6. **Poses:** 5–7 poses, each with the dynamic camera (dutch angle, a hand or her prop toward the viewer, motion in hair
   and cloth, from eye level or slightly above, never from below), head in the upper third with room above her head, and
   her prop in it. Seven samples are drawn per girl, pose = k % len(poses).

Run `python3 -I /home/user/work/tools/check_spec.py /home/user/work/v3c/<id>/spec.json` (must print OK; the prompt
must fit its length limit — trim scene adjectives before identity words). Do not generate images, do not use the network.
Reply with a short list: id: prop(s) chosen, background, fid, anything doubtful.
