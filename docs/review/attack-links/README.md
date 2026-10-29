# Link attacks: Fuu's Homecoming Throw and Ena's Spirit Tether

Stage 1-1 (normal), branch `feature/attack-links`. Fuu (green hair) stands left of centre on the upper road, Ena (pink hair) right of centre. Both are built to tier 5 on the path that holds the attack: Fuu's Returning Gale (path index 0, T4 Typhoon Fans teaches Homecoming Throw, T5 adds two fans) and Ena's Shared Fate (path index 2, T4 Red Threads teaches Spirit Tether, T5 Threads of Destiny).

## What the clip shows

- **Fuu.** A small, bright white-green gust flies out of her toward the orcs at the left edge of her reach. It is the one thing in the clip that is clearly a Homecoming Throw fan, but only the outbound flight shows. The turn at the edge and the way back to her hand are NOT visible: the page renders about one frame every two seconds, so the fan is caught mid-air on a few frames and the return leg never lands on one. The orcs near her are also pushed back by her gusts (the purple arrow on the road is the exit marker).
- **Ena.** Ena's hit ties four orcs (the target and the nearest three, one after another); the sim reports the group alive for the whole clip, and the orcs carry her Brittle tint plus the small purple damage numbers of the shared hits. The threads themselves (small pink beads between the tied orcs) are NOT visible in the clip or in a pixel check of the screenshot. The sim state says they exist; I could not see them drawn at this size. Treat this as unconfirmed for the reviewer: either the beads are too small and faint at 844x390 under software rendering, or they are not being drawn.

## Files

- `attack-links.mp4`: 9 s, 844x390, the whole battle view. `attack-links.jpg`: one frame (at 3 s).
- `attack-links-fuu-2x.mp4`, `attack-links-ena-2x.mp4`: 2x crops (a 422x195 region scaled to 844x390).

## How it was made

A throwaway script (not committed, deleted afterwards), based on the Grand Spectrum clip script, started vite on this worktree and seeded a save with Fuu and Ena at level 40, breakthrough 3. It opened `#/battle?stage=1-1&difficulty=normal`, placed both through `window.__battle.ui.act.place`, and bought tiers with `sim.upgradeTower` (five calls on path 0 for Fuu, five on path 2 for Ena). Slow ironhide orcs (hp x5000, 15% speed) were spawned with `sim.spawnEnemy`: spaced 1.2 tiles apart near Ena so the threads have several to tie, and about 2 tiles apart near Fuu so a fan has a clear lane. The script stepped the sim 6 s forward, then set the game speed to 0.1x (not 3x as in the ground clip: at 3x a fan crosses the screen between two rendered frames) and recorded with Playwright `recordVideo` for about 12 s; ffmpeg cut the last 9 s to H.264. Because the clip is at 0.1x it is effectively a slow slideshow of a few distinct frames, not smooth motion. No game files were changed.
