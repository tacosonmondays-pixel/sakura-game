
---

## Addendum (Oct 28-29, 2026): the owner board, proposed defaults, S1 "Wheels" as built, the plan for S2-S4
| Status | Design spec. **S1 "Wheels" is built on `feature/attack-shapes`** (not shipped: it waits for the owner's yes on the board); defaults, parity and the S2-S4 plan in the Addendum at the end. Folded into the VFX update plan as its own track |
Written on `feature/attack-shapes`. The owner answered "defaults!" to §8, so A2 states the defaults this branch builds on; each one is still the owner's to change on the board.

### A1. The owner board (§7.1)

- Page: `previews/attack-shapes.html` (`npm run dev`, then `/previews/attack-shapes.html`; `?speed=0.5` for slow motion). Ten loops on one sample road (a U round the girl), stepped at 60 Hz with the sim's own direction table (`src/sim/dirs.js`: the 240 directions, `nearestDir`, `turnToward`), integer step timers and the tick rules of §5. Display-only tooling, not in the game build.
- Phone files: `docs/review/attack-shapes/attack-shapes-board-1.png` (shapes 1-5) and `-2.png` (6-10), one column, each card caught mid-action with its two lines (what it does, which girls could get it); `docs/review/attack-shapes/attack-shapes-reel.mp4` (12 s, all ten loops at real speed). Rebuild them with `node e2e/attack-shapes-board.mjs <dir>`.
- The board's S1 cards show the spec's first ideas (Noa for the halo, a sprinkler on a 0.1 s clock). What S1 became is A3; the board's S2-S4 cards are unchanged.

### A2. Proposed defaults for §8

| # | Question | Default |
|---|---|---|
| 1 | Which shapes first? | **S1 "Wheels"**: Blossom Wheel, Pinwheel Stream, Petal Halo (the cheapest: mostly reuse of Kinu's ring code). Then S2, S3, S4 in that order (A6). |
| 2 | Reworks or new girls? | **Reworks** of girls players already own. New girls can take shapes later, from their own design. |
| 3 | Whole kit or one path? | **One path each**; her other two paths keep today's attack. The shape arrives at **tier 4** for a behaviour change (the roster's standing rule: transformations only at tiers 4-5, `tests/data/units.test.js`) and at tier 3 for an added kit (Hotaru's halo beside her pulse). |
| 4 | Which girl gets which shape? | S1: **Momo** (Encore Toss → Coin Wheel), **Kage** (Storm of Steel → Blade Cyclone), **Hotaru** (Lantern Light → Firefly Halo). S2-S4 as in A6. |
| 5 | How many per update? | **One batch (2-3 shapes) per release**, one `COOP_PROTOCOL` bump each, sharing the number with whatever else ships in that release. |
| 6 | Same power or a buff? | **Same power**: each touched tier lands within ±5 % of today's DPS on the bench (crowd and boss rows; method and numbers in A4), the rule set for Kohaku's beam. |
| 7 | Kinu? | **Leave her kit as it is.** She already has true 360° rings, a spiral and scissors; her look improves with the effects update (§7.4, render only). |
| 8 | Vines: hold or slow? | **Slow.** Bramble Road slows every walker on the vine; only the first walker it reaches is held, briefly, never bosses or flyers, minibosses resist (the hold Chigusa has today). A long hold on narrow roads is too strong. |
| 9 | Ship plain, polish later? | **Yes.** Each batch ships with plain effects (straight shots drawn as the girl's own shots, simple glows and rings) and gets its polished look in a later display update (§7.3). |
| 10 | The owner's reference video | Nothing beyond the spec's shapes is copied. If the owner wants a speed, size or colour matched, they say so on the board. |

### A3. S1 "Wheels" as built

| Girl, path | Tiers | Shape | What the player sees |
|---|---|---|---|
| Momo, Encore Toss | T4 Jackpot, T5 Fortune's Favourite | Blossom Wheel (`behavior: 'wheel'`) | Each toss throws 12 gold coins (16 at T5) out in a perfect wheel. The **lead coin** flies at her target and hits only it (×1.91; ×4.42 at T5); the rest pierce whatever stands round her (×0.39; ×0.57). T3 keeps her toss. |
| Kage, Storm of Steel | T4 Blade Rain, T5 Thousand Shadows | Pinwheel Stream (`behavior: 'spin'`) | Shuriken pour out of three turning arms (four at T5), one shuriken per arm per throw; an arm that finds an enemy slows to a crawl on it; against a lone enemy the arms fold into one stream that turns to follow it. T3 "Shuriken Cyclone" keeps its 5-target throw (tier 3 cannot transform). |
| Hotaru, Lantern Light | T3 Spirit Bane, T4, T5 | Petal Halo (kit `halo`) | Four fireflies (six, eight) circle her and cut what they touch; her pulses keep going beside them, 30 % lighter, ×1.4 vs elites and bosses. |

Changes from the spec, and why:

1. **Hotaru, not Noa, has the halo.** Noa's chimes hit for about 1 after armor, and every hit deals at least 1 (`computeHit`). Her halo's cuts alone reached her whole tier-3 DPS, so no halo strength could keep her at parity. Hotaru's hits are big enough for the floor not to matter.
2. **Pinwheel Stream is an attack, not a 0.1 s kit clock.** Kage's Potential (more shuriken, Shadow Tempo, the Shuriken Storm echo), gear tricks and drinks all count attacks. A clock that bypassed her attack loop would quietly drop all of them. One shot per arm per throw keeps them, and her throws are fast enough to read as a stream.
3. **The lone-enemy fold** replaces the spec's "lock tier". A sprinkler that only lingers gives a lone boss about half her damage (−45 % measured). Folding into one stream keeps single-target parity without a hidden boss multiplier.
4. **Halo cuts carry no statuses** (`t.haloSpec`). Hotaru's (or anyone's) on-hit stuns and slows on a ring of fast cuts would stun-lock a crowd. Measured with Noa: her chime DPS went ×10 while the crowd stood frozen.
5. **The wheel's lead spoke hits its target only** (pierce 1). With pierce it carried the whole crowd row by itself and left nothing for the wheel.
6. **The shape's own knobs are stated per tier, not multiplied** (`wheel.lead/mul`, `spin.mul/fold`, `halo.mul`), so the data reads as the bench fitted it.

### A4. DPS parity (§7.2 step 6)

Method: `tools/bench.mjs` (STRONG preset, partner Aoi), crowd and boss rows, each touched path at T3-T5, against `origin/main` aa0281de. A wheel, stream or halo depends on how the road passes her. The one default stage (4-5 seed 9) puts her spot beside a straight road, so fitting to it alone overfits. Each tier's knobs are fitted to the **mean ratio over four configurations**: 4-5 seed 9, 4-5 seed 3, 2-4, 6-3. Untouched paths and girls are bit-identical (the 456-resolution stats hash with the three girls left out: `8cb286a4` before and after).

| Girl, tier, row | Mean of 4 | 4-5 s9 | 4-5 s3 | 2-4 | 6-3 | 4-5 L25 (early preset) |
|---|---|---|---|---|---|---|
| Momo T4 crowd / boss | 0.98 / 1.00 | 0.83 / 0.96 | 0.91 / 0.89 | 1.04 / 1.15 | 1.12 / 1.00 | 0.88 / 0.74 |
| Momo T5 crowd / boss | 0.99 / 1.00 | 0.89 / 1.05 | 0.89 / 0.97 | 1.08 / 0.95 | 1.08 / 1.03 | 0.85 / 1.11 |
| Kage T4 crowd / boss | 1.00 / 1.00 | 0.88 / 1.00 | 0.86 / 0.95 | 1.14 / 0.98 | 1.10 / 1.05 | 0.85 / 0.90 |
| Kage T5 crowd / boss | 1.00 / 1.00 | 0.86 / 0.99 | 0.86 / 0.98 | 1.15 / 1.00 | 1.13 / 1.01 | 0.86 / 0.95 |
| Hotaru T3 crowd / boss | 0.96 / 1.00 | 0.81 / 1.00 | 0.81 / 0.99 | 1.10 / 1.01 | 1.09 / 1.01 | 0.86 / 1.01 |
| Hotaru T4 crowd / boss | 0.98 / 1.01 | 0.84 / 0.98 | 0.84 / 0.99 | 1.12 / 1.03 | 1.13 / 1.03 | 0.89 / 0.99 |
| Hotaru T5 crowd / boss | 1.00 / 1.00 | 0.86 / 0.93 | 0.86 / 0.92 | 1.14 / 1.05 | 1.16 / 1.10 | 0.90 / 1.12 |

(Momo and Kage at T3 are unchanged: 1.00 everywhere.) Every mean is within ±5 %. A single stage swings about ±15 % on the crowd row: the shapes gain where the road wraps round her and lose beside a straight road, which is the trade the spec describes (§5.1). The early preset reads lower on crowds and Momo's T4 boss row (0.74) is the widest single miss. That row's "boss" is an elite Royal Guard Slime that splits, so a wheel's lead coin sees fewer clean hits. Balance round 5 can re-measure all of this on its own bench (the S1 girls and paths are listed for it).

### A5. Determinism (§7.2 step 5)

- (a) `tests/sim/wheels.test.js`: each S1 girl alone and all three together on 4-5, plain `Math` against `withDetMath`, `hashSim` every 60 ticks equal; twice the same battle identical.
- (b) `e2e/engines/scriptedBattle.js` `runShapesBattle` (SHAPES_START, 2-4 Hard): Momo's wheel and Kage's stream (host), Hotaru's halo and a second Kage (guest), two Lockstep clients to the end. A third client rebuilds the battle from the wave-3 checkpoint and the log to the first tick 5 s into a wave with a spin index and a halo memory live (a mid-wave rejoin), and must land on the run's hash and snapshot. It is compared across engines by `e2e/engines.mjs` and pinned in `tests/online/engines.test.js`.
- (c) The new sim files (`wheels.js`, `dirs.js`, `shapes.js`) are checked by a test: no `Math.random`, no runtime `sin`/`cos`/`atan2`/`hypot`/…, no `**`. The table is built once with `DET_MATH`. Aiming is `nearestDir` and `turnToward`. Facing is k × 2π / 240.
- (d) The renderer reads only sim state: straight shots as projectiles, halo pieces from `haloPos` at the sim's step. It uses no rng.
- State: `t.spinK` (integer) and `t.haloHits` (integer pairs) end at the wave clear; `hashSim` folds them only while present.
- Sim id: `PENDING_BUMP` in `tests/art/itemArtRuntime.test.js`. **No `COOP_PROTOCOL` bump on the branch**; the release that ships S1 takes the next free number.
- Perf: `tests/sim/perf.test.js` "attack shapes": 6 copies of each S1 girl at her shape tiers and 200 enemies, 0.15 ms a step locally (limit 2), at most 108 straight shots (cap 400).

### A6. Plan for S2-S4

The estimates are working time for one session, including tests, the bench fit, the engines battle, an independent review and an owner board with screenshots.

| Batch | Shapes, girls (default) | Builds | Depends on | Estimate |
|---|---|---|---|---|
| **S2 "Held"** | Hearth Stream on **Akane's Wildfire** T4-5 (fire; frost / poison / water variants left as data for later), Searchlight Sweep on **Umeko's Lighthouse** T4-5 | `channel.js` extracted from Kohaku's constant beam (v0.1.59) with Kohaku moved onto it, unchanged in hash (her beam is the template: lock, integer ticks, ramp by time on target, grace, on-lock effects); `inCone` + `COS2`; `nearSegment`; a held-beam / cone plain drawing | Kohaku's constant beam on `main` (v0.1.59) | 1.5 days: 0.5 for the extraction with Kohaku's hash pinned, 0.5 per shape, 0.5 for parity, engines and review |
| **S3 "Ground"** | Bramble Road as **Chigusa's** vine kit rework (slow, not hold: A2 #8), Rising Spikes on **Yuki's** Icicle Lance path T4-5, Ripple Quake on **Kanna** (hero: one rank of her level track) | the road-object record + `onRoad` (Marumi's shared-stretch rule), queued ring starts, a ribbon-free plain vine (a green road band) | S1 (dirs, shapes) | 2 days: Chigusa's kit rework is the largest single change (her vines, beds and Potential stay compatible) |
| **S4 "Links"** | Homecoming Throw on **Fuu's** Returning Gale T4-5, Spirit Tether on **Ena's** Red Threads T4-5 | leg flip on straight shots; the `_hit` share hook behind `sim._tetherOn` with a re-entrancy flag and a per-step budget | S1 | 1.5-2 days: the share hook touches every hit, so it gets its own perf and determinism pass |

Each batch: a sim id change behind `PENDING_BUMP`, one `COOP_PROTOCOL` bump at its release, the parity method of A4, a scripted engines battle with a mid-wave rejoin, and the VFX polish afterwards on the effects track (flipbooks M2, mesh shapes M4).
