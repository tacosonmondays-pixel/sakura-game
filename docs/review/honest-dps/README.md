# Honest DPS: before / after

The girl drawer (MORE › Details) on stage 1-3. Before is live main (v0.1.57); after is fix/honest-dps. The stills come
from `node e2e/dps-readout.mjs --shots <dir>` (and `--root <main checkout>` for the before set). Packs are plain
~3000 HP bears whose HP is refilled each game step, so a %-of-max-HP poison stays honest.

- `dps-board-844x390.jpg`, `dps-board-1280x720.jpg`: Midori 5-0-2 against a pack of 8 and against a lone boss, Kage
  (crits, multi-target), Chika (drones), Suzu (traps), Shiro (pierce), Miko (aura support) and the hero.
- The same e2e checks every girl in the roster and the hero during a wave: a non-zero measured DPS for every damage
  dealer, and no NaN or undefined in any drawer.
