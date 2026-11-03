# Held attacks: Akane's flame stream and Umeko's searchlight sweep

Stage 1-1 (normal), branch `feature/attack-held`. Akane (left, red hat) and Umeko (right, pale hair) stand on the road, about six tiles apart.

## What the clip shows

- **Akane (Wildfire T5, Inferno Queen).** She holds a widening cone of fire on her target and burns everything inside it. On screen this is the warm orange wedge fanning out from her along the road, with a bright line down its middle toward her target. The cone is soft, so it is easiest to see in the 2x crop.
- **Umeko (Lighthouse T5, Sea of Lanterns).** Her pulse is a beam of light that swings back and forth across the road, striking and revealing whatever it passes over. In the clip the beam points down across the road at about 3 s and has swung to the right by about 6 s.

Enemies are slow, very tanky ironhide orcs (hp x5000, 15% speed) spread along the whole road, so both attacks keep running for the full clip.

## Files

- `attack-held.mp4`: 9 s, 844x390, the whole battle view.
- `attack-held.jpg`: one frame (at 3 s).
- `attack-held-akane-2x.mp4`, `attack-held-umeko-2x.mp4`: 2x crops around each girl (844x390 output from a 422x195 region).

## How it was made

A throwaway script (not committed) started vite on this worktree and seeded a save with Akane and Umeko at level 40, breakthrough 3. It opened `#/battle?stage=1-1&difficulty=normal` and placed each girl near the road with `window.__battle.ui.act.place`. It then called `sim.upgradeTower(uid, pathIndex)` five times each, with normal upgrade rules: Akane path 1 (Wildfire), Umeko path 0 (Lighthouse), one T5 per girl. The slow tanky column was spawned with `sim.spawnEnemy`. Playwright `recordVideo` captured about 12 s, and ffmpeg cut the last 9 s to H.264. The crops were made with ffmpeg `crop` and `scale`. No game files were changed.
