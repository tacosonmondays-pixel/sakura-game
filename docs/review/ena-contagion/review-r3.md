# Review r3: Ena's spreading curse (`feature/ena-contagion`)

- Reviewed `e36f551e`. The fixes are in `5776bb7b..2cd465a9`. The merge `2cd465a9..e36f551e` brings in `origin/feature/balance-r5` up to `e6acc87c`.
- I am a fresh re-reviewer. I did not build this change.

## Verdict

**OK.** M1 and L-a to L-d are fixed. The merge is clean. There are three NIT findings below; none of them blocks.

## What I ran (4 cores, nothing else running)

| Run | Result |
|---|---|
| Full `npx vitest run` at `e36f551e` | **399 files passed, 2 skipped; 6283 tests passed, 11 skipped**, 0 failed (862 s, default workers, no re-runs needed) |
| `node e2e/smoke.mjs` (all three viewports) | ALL SMOKE CHECKS PASSED |
| `tests/sim/perf` curse case, run alone | 600 enemies, 600 rotting, 122 passes (at most 10 a step, depth 4), 12 Omen Cards: **0.859 ms/step; the baseline without rot 1.132 ms** |
| `simId()` | `0064823aad8c`, equal to `PENDING_BUMP {13}` (`tests/art/itemArtRuntime.test.js:210`). `COOP_PROTOCOL` is 13, the same on `origin/main`. Correct for an unshipped change. |
| `tools/balance/r5Bench.mjs ena --builds all --seeds 9,1,2`, branch vs live `origin/main` (bench copied in) | Every t5 path is ≥ live on every target. boss: p0 567k vs 87k, p1 565k vs 86k, p2 1.89M vs 296k. bossw: 208k vs 32k, 226k vs 35k, 1.45M vs 227k. crowd: 1.87M vs 244k, 472k vs 60k, 2.00M vs 291k. |

## The fixes

- **M1, fixed.** In `src/data/types.js:123`, `hexer` is now named "Curse Caster", with new goodAgainst, limitation and desc text. The role id `hexer` is unchanged (`unitsExpansion.js:512`). Every place that shows it reads `ROLES`: `src/ui/screens/student.js:661-662`, `src/data/wiki.js:288-289`, and `src/ui/battle/towerPanel.js:254-258` and `:792`. `docs/ROSTER.md:53` matches the new text. No test pins the old name. The text is accurate: rot every second (half on bosses), passes ×0.8 up to 4 times, at most 64 passes a step, none out of a tunnel. Because `types.js` is part of the sim hash, the sim id moved, as expected.
- **L-a, fixed.** `src/data/wiki.js:774` now reads "a living curse never passes out of a tunnel".
- **L-b, sound.** In `coopAbilities.test.js:740-791`, the per-call count (≤ `lifeMax`) is reliable because Noa's calls never overlap (50 s cooldown, 10 s duration). The test also asserts one life rally per cast, each `given ≤ max`, and that the events total equals Σ`given`.
  - What it catches: an extra `lifeRestored` emitted without `given++` fails the total check. A life given past the cap fails ≤ max.
  - It cannot fail by accident: every First Aid cast pushes exactly one `life` rally (`abilities.js:619-629`), the rally lasts longer than a step, and rallies are collected after every step.
  - The old check "never the same life twice" could fail by accident when a life was lost and then restored, so dropping it is right.
- **L-c, sound and not weakened.** `curseBoard()` runs the same board for both cases (seed, map, 12 Garden of Calamity Enas, Auto Omen Card, 600 walkers). The only difference is that `withoutRot()` strips every `rot` key from Ena's data, and the only `rot` in her data is `hex()`'s (`unitsExpansion.js:503`). `expect(base.passes).toBe(0)` proves the spread really is off in the baseline. The local budget is `max(2, 2×base)`, so an idle machine keeps the old flat 2 ms, and CI keeps 6 ms.
- **L-d, sound.** `rosterFx.js:697-705` builds one reused `Map`, cleared and rebuilt at most once a frame (`time` changes every `update`), and only when a `curseSpread` event arrives. There is no per-frame allocation, and the map holds only uid → number, so nothing leaks. The new test covers both the 2.12 height and the flat 0.12 height.

## Merge `2cd465a9..e36f551e`

It touches 15 files, the same set as balance-r5's own `f1fd0681..e6acc87c`. 13 of them carry identical +/- lines. The only two that differ are the expected conflict resolutions:
- `itemArtRuntime.test.js`: the PENDING_BUMP comment and the id.
- `engines.test.js`: the Tenka co-op case is re-pinned to `ckDigest 9436008b` / `finalDigest 61d0c02a`. Its ticks (51073), wallets, final and hashes are unchanged. The other re-pins match balance-r5's exactly.

The full suite passes with these pins.

## NIT

1. `docs/merge/ROSTER_SPEC.md:936` still says "Hex Caster / Curses need kills to spread". This is a historical spec, so updating it is optional.
2. `src/render/rosterFx.js:365`: if the target of a pass dies in the same frame, `_elevOf` returns 0, so the thread is drawn at ground level for an enemy on a deck. This is cosmetic only.
3. `tests/sim/perf.test.js:405`: the baseline runs first, while the JIT is cold. Here it measured slower than the curse case (1.13 vs 0.86 ms), so the 2× allowance is a little generous above the 2 ms floor. Running the baseline second, or warming up once, would tighten it. Optional.
