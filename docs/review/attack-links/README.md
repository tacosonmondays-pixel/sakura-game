# Link attacks: Fuu's Homecoming Throw and Ena's Spirit Tether

Stage 1-1 (normal), branch `feature/attack-links`, after the S4 review fixes. Fuu (green hair) stands left of centre on the upper road; Ena (pink hair) stands right of centre. Both are built to tier 5 on the path that holds the attack:

- Fuu: Returning Gale (path index 0). T4 Typhoon Fans teaches Homecoming Throw; T5 adds two fans.
- Ena: Shared Fate (path index 2). T4 Red Threads teaches Spirit Tether; T5 is Threads of Destiny.

## What the clip shows

- **Ena.** Her threads are bright pink lines on the ground, running from one tied orc to the next. Each tied orc stands in a thick pink ring. They show on the orcs where the road turns right of her: the tether group is alive on every frame. The 2x crop `attack-links-ena-2x.mp4` shows them best. In the full 844x390 frame they read as pink marks between the orcs.
- **Fuu.** Eight small white-green fans fly out of her at the orcs. On frames 5-8, 18-22 and 32-34 they are on their way home, coming back toward her hand from the left. `attack-links.jpg` is frame 19, with fans in the air on the way home. They are drawn with her own gust sprite, which is small and pale. A spinning fan sprite and a trail are left for the effects track.

## Files

- `attack-links.mp4`: 40 frames, 844x390. Each frame is 4 sim steps, played at 7.5 frames a second, so 4 s of battle runs as about 5.3 s (0.75x).
- `attack-links.jpg`: frame 19.
- `attack-links-fuu-2x.mp4` and `attack-links-ena-2x.mp4`: 2x crops of the same frames (422x195 regions scaled to 844x390).

## How it was made

A throwaway script (not committed) started vite on this worktree and seeded a save with Fuu and Ena at level 40, breakthrough 3. It then:

1. Opened `#/battle?stage=1-1&difficulty=normal` and placed both girls with `window.__battle.ui.act.place`.
2. Bought the tiers with `sim.upgradeTower`.
3. Spawned slow ironhide orcs (hp x5000, 15% speed) every tile along the road.
4. Set the battle's speed to 0 and stepped the sim from the page, 150 steps first and then 4 steps per frame. Each frame is a screenshot taken after two animation frames, and ffmpeg joined them.

Stepping by hand, instead of recording at 0.1x, means every frame is a real render: under software rendering the page draws only about one frame every few seconds. The fan's flight home and the threads therefore land on frames. No game files were changed.
