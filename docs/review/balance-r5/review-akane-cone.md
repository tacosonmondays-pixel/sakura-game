# Review: Akane's Inferno Queen cone and the LR-bar follow-ups (feature/balance-r5 96c3547b, diff from 04bcc258)

**Verdict: OK.** The corner miss is real, and the wider cone fixes it. Raising `half` only raises numbers in every
cell measured. Only Akane's 2-5-0 crowd cells moved. The LR bar re-pin reproduces exactly. Two findings below, neither
blocking.

## What changed in the sim
Only `src/data/units.js:573` changes: Inferno Queen `stream.half` 45 → 55. The `src/data/balance.js` change is comments
only. Every other girl's cell is therefore identical to 04bcc258 by construction.

## Reproduced
- **Corner cell** (4-5, Akane 2-5-0 at the placeable point nearest (1.56, 1.56), which is (1.55, 1.55); Iroha 5-0-2 on
  her r5Bench spot; crowd; seeds 1–16; a scratch copy of `r5Bench.measure`):

  | Tree | With Iroha | Without Iroha | ÷ live |
  |---|---:|---:|---:|
  | Live (origin/main c6d06118) | 416,636 | 416,531 | n/a |
  | 04bcc258 (half 45) | 383,456 | n/a | ×0.920 |
  | 96c3547b (half 55) | 424,570 | 424,615 | ×1.019 |

  My seeds differ from the author's, but the result matches the claim (×0.919 → ×1.013).
- **Other spots, 04bcc258 → 96c3547b**, Akane 2-5-0 alone, seeds 1–4. The results run from ×1.000 to ×1.438, and
  none is lower:

  | Cell | Ratio |
  |---|---:|
  | 4-5 (3,3) crowd | ×1.438 |
  | 4-5 (6,3) crowd | ×1.024 |
  | 1-3 (2,2) crowd | ×1.000 |
  | 1-3 (5.8,5) crowd | ×1.106 |
  | 2-4 (4.6,2.2) crowd | ×1.051 |
  | 3-2 (2.3,5.75) crowd | ×1.050 |
  | 5-2 (3.05,5.05) crowd | ×1.060 |
  | 6-1 (5,3) crowd | ×1.225 |
  | 2-1 (7,5) crowd | ×1.064 |
  | Held boss at 4-5 and at 3-2 | ×1.000 |

- **No-nerf gate**, Akane, `--support um` and `--support none`, all three profiles, live vs branch: 270 cells, 0 missing,
  **0 under**. No other girl's cell can move (see "What changed in the sim"), so the six explained supported cells from
  the approved state stand unchanged.
- **Moved vs 04bcc258** (Akane gate, both supports): 3 of 135 cells per support moved, all p1t5 crowd, all up:

  | Profile | Supported (um) | Alone (none) |
  |---|---|---|
  | Maxed | 686,497 → 1,016,751 (×1.48) | 345,489 → 503,382 (×1.46) |
  | L1 | ×1.49 | ×1.11 |
  | L40 | ×1.48 | ×1.11 |

- **`lrBar.mjs`**: exit 0. Every LR crowd is ×1.31–1.33 of the bar and every LR boss ×2.29–4.61.
- **`lrBar.mjs --bar`**: exit 0. It prints `BAR` crowd 17,397,696 (Akane p0t5, Umeko + Chika) and boss 6,130,000
  (Iroha KNOWN), exactly the pinned values. The worst LR ÷ the best non-LR under the same supports is ×1.149, above ×1.0.
  Akane 2-5-0 is nowhere near either top list, so the cone does not move the bar.
- **HELD_START**: the `engines.test.js` pin keeps the same ticks (28654), outcome (lost), wave (16), wallets (615/669)
  and rejoin tick (5568). Only the final, hashes and held change, as the comment says. The test passes.
- **Tests**:

  | Run | Result |
  |---|---|
  | `npm test` | 6274 passed, 11 skipped (400 files passed, 2 skipped) |
  | `node e2e/smoke.mjs` | ALL SMOKE CHECKS PASSED (678 ok) |
  | `node e2e/engines.mjs` | OK: 3 runs on 2 engines identical, including S2 HELD (Firefox and WebKit are not installed here, so they were skipped) |

## Findings (non-blocking)
1. **The units are wrong: `half` counts table steps of 1.5°, not degrees.** `src/sim/dirs.js:23` and
   `src/sim/constants.js:363` define it: COS2_MAX = 60 is 90°. The cone really goes from 67.5° to **82.5°** on each
   side, which makes the whole cone 165°, close to a half-plane. "54°" in the docs is 54 steps, or 81°. The "45° → 55°"
   wording is in:
   - `docs/BALANCE.md:424,426`
   - `tests/sim/held.test.js:158`
   - `tests/online/engines.test.js:350`
   - `tests/sim/mods.test.js:253`

   `docs/specs/ATTACK_SHAPES.md:532,551` still says "67.5° at T5". The renderer reads the same table
   (`src/render/attackFx/patterns/held.js:40`), so the look matches the sim. Fix: write "half 45 → 55 table steps
   (67.5° → 82.5° each side)" and update ATTACK_SHAPES §532/§551 to 82.5°. The owner should know the T5 stream now
   covers nearly half a circle.
2. **The size of the buff is not disclosed.** BALANCE.md says "×1.013 … only wider elsewhere". On the fixed bench, though,
   Akane 2-5-0 on a crowd goes ×1.48 (0.69M → 1.02M), ×1.46 alone, and ×1.44 at 4-5 (3,3). This is allowed: the gate
   forbids only cuts, and she stays far below the bar. Fix: add the bench before → after numbers for her 2-5-0 crowd to
   BALANCE.md near line 427, and to the owner board if it lists that build.

Minor: the `--bar` "top crowd" list prints the TEAMS rows (38.6M), which are not part of the bar. Labelling them
"(team, not in bar)" in `tools/balance/lrBar.mjs` would avoid confusion.
