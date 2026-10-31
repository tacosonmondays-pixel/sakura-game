# Sticker art (NovelAI + cut-out + caption)

The 16 v1 stickers in `public/art/stickers/` (`<id>-256.webp`, `<id>-128.webp`) and their board
`docs/review/stickers/board.png`. Spec: `docs/specs/STICKERS.md`; table: `src/data/stickers.js`.

- `prompts.py`: one prompt per sticker, written only from the game's own descriptions (the bios in `src/data/units*.js`,
  the loading slime in `src/ui/loading/mochi.js`). No reference images, no other games', anime or artists' names. The
  negative prompt keeps out anything revealing or suggestive, gore, and any text (the caption is drawn by `bake.py`).
- `gen.py`: NovelAI, free tier only (1024x1024, 28 steps, 1 sample, no image references = 0 Anlas). The key is a
  proxy-injected network secret: the script sends no Authorization header and never prints one. Every request is
  logged to `docs/specs/stickers/novelai-requests.jsonl` (prompt, seed, the balance after it).
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
  Before / after: `docs/review/stickers/board-pastel.png`, the tone pass (4801442) above the regenerated set (set
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
