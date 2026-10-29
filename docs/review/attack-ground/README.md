# Ground attacks: Chigusa's vines, Yuki's Rising Spikes, Kanna's Ripple Quake

Stage 1-1 (normal), branch `feature/attack-ground`. Chigusa stands at the far left of the clip, Yuki (pale hair) in the middle top, Kanna (red hair, the hero) at the right.

## What the clip shows

- **Chigusa (Greenhouse T4, Thorn Hedge).** A vine roots on the road in front of her and grows upstream toward the walkers. In the clip it is a pale green strip on the cobbles that slows and holds the orcs standing on it. It is the faintest of the three, so use the 2x crop.
- **Yuki (Frostbite T5, Diamond Dust, which includes Rising Spikes).** Small white ice spikes pop up in a row along the road, starting under her enemy and running on into the walkers behind it. They are small and brief, so use the 2x crop.
- **Kanna (hero level 24, Hundred Demons' Parade).** Each strike sends pink-orange rings rolling out across the ground from the orc she hits. These are the easiest of the three to see.

Enemies are slow, very tanky ironhide orcs (hp x5000, 15% speed), spaced along the whole road so all three attacks keep working for the full clip. One orc reached the exit in the run (lives 99), which does not matter here.

## Files

- `attack-ground.mp4`: 9 s, 844x390, the whole battle view. `attack-ground.jpg`: one frame (at 4 s).
- `attack-ground-chigusa-2x.mp4`, `attack-ground-yuki-2x.mp4`, `attack-ground-kanna-2x.mp4`: 2x crops (a 422x195 region scaled to 844x390).

## How it was made

A throwaway script (not committed, deleted afterwards) started vite on this worktree and seeded a save with Chigusa, Yuki and Kanna at level 40, breakthrough 3, and Kanna as the formation hero. It opened `#/battle?stage=1-1&difficulty=normal` and placed each through `window.__battle.ui.act.place`; Kanna is deployed as the hero. Chigusa got four `sim.upgradeTower(uid, 1)` calls (Greenhouse to Thorn Hedge) and Yuki five (Frostbite to Diamond Dust). Kanna was bought up to hero level 24 with `sim.buyHeroLevel`. The slow tanky column was spawned with `sim.spawnEnemy`. The software-rendered page runs the sim slowly, so the script stepped the sim 6 s forward and set the game speed to 3x before recording, so the vines and spikes are already out when the clip starts. Playwright `recordVideo` captured about 15 s and ffmpeg cut the last 9 s to H.264; the crops are ffmpeg `crop` and `scale`. No game files were changed.
