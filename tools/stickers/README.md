# Sticker art (NovelAI + cut-out + caption)

The 16 v1 stickers in `public/art/stickers/` (`<id>-256.webp`, `<id>-128.webp`) and their board
`docs/review/stickers/board.jpg`. Spec: `docs/specs/STICKERS.md`; table: `src/data/stickers.js`.

- `prompts.py`: one prompt per sticker, written only from the game's own descriptions (the bios in `src/data/units*.js`,
  the loading slime in `src/ui/loading/mochi.js`). No reference images, no other games', anime or artists' names. The
  negative prompt keeps out anything revealing or suggestive, gore, and any text (the caption is drawn by `bake.py`).
- `gen.py`: NovelAI text to image (1024x1024, 28 steps; 1 sample is the free tier). The key is a proxy-injected
  network secret: the scripts send no Authorization header and never print one. Every request is logged to
  `docs/specs/stickers/novelai-requests.jsonl` (prompt, seed, the balance before and after; never an image).
- `render.mjs` + `render.html` / `render.js`: each girl's in-game chibi GLB drawn by the game's own loader and toon
  materials (cheer or idle clip, three-quarter view, flat light, no battle halo) as a 1024 px pose base.
- `like.py`: the girls' stickers (owner, Oct 31: "each sticker should clearly look like its character"): NovelAI
  img2img from her pose render with her own portrait (`public/art/portraits/<id>-full.webp`) as the character
  reference. Only the game's own art goes in.
- `bake.py`: rembg (isnet-anime; the pale slimes use a flood fill from the plain background instead), a thick white
  die-cut border with a navy hairline and a soft shadow, the caption in a heavy sans with a coloured stroke, and the
  256 / 128 px WebP; then the board.
- Pastel set (owner, Oct 31: "more pastel colours"): all 16 regenerated with a soft pastel palette written into the
  prompts (`STYLE` in `prompts.py`; hair and eye colours keep their families), 4 samples each (`--samples 4`, 28 steps,
  1024x1024), the best of each picked by eye (the `.s<k>` names in `bake.py`). The words are pastel too (pink, mint,
  lavender, peach, sky, butter) with a deeper pastel outline (two steps deeper than the first try, and a thicker
  stroke on long words, so "Thank you!", "Good luck!", "Let's go!" and "Charge!" read at 64 px); the white die-cut
  border stays. The first try's tone pass (`pastel()`) stays in `bake.py` as a fallback for any sticker whose
  regeneration is worse (`first/<name>` + `STICKER_FIRST`); none uses it today.
  Before / after: `docs/review/stickers/board-pastel.jpg`, the tone pass (4801442) above the regenerated set (set
  `STICKER_BEFORE` to a folder of the previous 128 px files, `STICKER_BEFORE_LABEL` to name it). Cost: 960 Anlas (16 requests x 60; the balance went 6,713 → 5,753), inside the owner's ~2,500 budget.

```
python3 -m venv /path/outside/repo/venv && /path/outside/repo/venv/bin/pip install "rembg[cpu]" pillow
export STICKER_OUT=/path/outside/the/repo
python3 -I tools/stickers/gen.py [--only id,id] [--seed id=n] [--tag try2]
$STICKER_OUT/../venv/bin/python -I tools/stickers/bake.py [id,id]
```

Every picture was checked by eye for the content rules (students and chibis in modest school or club clothes,
nothing suggestive, no gore) and for stray letters before it was kept. Three were re-rolled once (`--tag try2`):
Momo (a calmer standing pose), Kage (the first headband had letter-like marks) and Hikari (her raised sword made the
figure too thin to read at 64 px). Two ids were renamed after generation, before anything shipped: `chigusa_gg` →
`chigusa_bravo`, `tenka_letsgo` → `tenka_charge`, and the four slimes `mochi_*` → `slime_*` (players never see the
slime's name, and ids can show as text on older builds). The log and `prompts.py` keep the names they were generated
under; `bake.py` maps each sticker id to its raw picture.

Anlas, first set (Oct 31): free-tier settings only, and every request after the first left the balance unchanged (6,713).
The balance fell from 6,753 to 6,713 before that point, partly between two runs when this tool sent nothing, while
the first request was waiting out HTTP 429s ("too many requests at once"): another client was using the same account
then. So this work spent 0 Anlas by every reading we have; 40 went elsewhere on the account.

Likeness set (Oct 31): the 12 girls redone with `render.mjs` + `like.py` (the slimes keep the pastel set). Blender is
not installed in the cloud container, so the pose bases come from the game's own three.js renderer of the same GLBs.
4 samples at img2img strength 0.6 for every girl, then 4 more at 0.78 for the ten whose battle model is plainer than
her illustration (0.6 kept the plain outfit); picks by likeness first, with the checklist in
`docs/review/stickers/LIKENESS.md`. Boards: `docs/review/stickers/board-likeness.jpg` (portrait · chibi · sticker
128 · 64) and `board-likeness-before-after.jpg` (the pastel set of c8024b6 above). Cost: 1,247 Anlas (one 1-sample
test, 12 + 10 four-sample requests; the balance went 5,753 → 4,506), inside the owner's ~4,000. Boards are JPEG,
300 KB or less.
