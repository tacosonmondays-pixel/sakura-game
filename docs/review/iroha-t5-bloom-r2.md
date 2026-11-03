# Review r2: Iroha T5 bloom fix, the r1 fixes (fix/iroha-t5-bloom @ 02dfc09f)

Independent reviewer, look and logic. Review only: nothing on the reviewed branch was changed.

## Verdict: OK

r1's F1 (her lopsided mirror landing) is fixed: it now lands as a balanced lilac cross. F2 and F3 are in as asked. The
bloom stays fixed, tests pass, and the sim id is unchanged. One reminder for whoever merges (R1, below).

## F1: the mirror landing (fixed)

- **Logic.**
  - `rayPick(i, n, total, counted)` returns `floor(i * total / n)` only when the preset has its own `lines.count` and
    `n < total`. Otherwise it returns `i`.
  - For the mirror (count 4 of 8 rays) that gives rays 0, 2, 4 and 6: about 0°, 90°, 180° and 270°, with jitter.
  - On each tier:
    - **High (8) and medium (6):** `raysOf` caps n at 4, so the mirror draws a cross on both.
    - **Low:** 0 lines, so nothing changes.
  - **Every other preset:** `L.count` is unset (`IMPACT.lines` carries none for laser, moon, holy and storm), so they
    still draw their first n rays. Their look is byte-identical to before.
  - The older medium-tier half fan on other presets is left as it was. That is a fair choice, kept out of this fix.
  - The new test checks that the four directions cancel out (sum under 0.5), the picks are [0, 2, 4, 6], and presets
    without their own count keep the first n.
- **On screen.**
  - **Method:** r1's harness. I fired mirror, moon, holy and the ally blue (#bfe6ff, plain `beams.fire`) side by side
    through `renderer.beamDemo` / `renderer.beams.fire`, froze at t = 35, 60 and 100 ms, and cropped at 3x. I did
    this at 844x390 and 1280x720, high quality, with swiftshader.
  - **Mirror:** four short lilac arms, up, down, left and right round a small lilac hub, with the dark ink edge. It
    reads as a balanced glass burst at both sizes, not a claw. It stays smaller and quieter than the others, which
    suits a beam that fires on every glint. Compare r1's `beam-row-1280x720.jpg`, where the arms fanned to one side.
  - **Moon, holy and the ally blue:** each keeps a full, even 8-line burst in its own colours, matching r1's captures.
    There is no regression, and the ally copy stays blue.
- **Answer:** the mirror landing reads as a balanced lilac burst. Moon, holy and the ally blue are unchanged.

## F2: the land ring (fixed)

`LAND_RING` is 16 in `src/render/mirrorPanel.js`. The ring is still fixed typed arrays sized once, so nothing is
allocated per call.

## F3: the spec clause (fixed)

`docs/specs/IROHA_MIRRORS.md` now says three things:

- An ally's reflected copy (blue, no preset) shares the landing gate.
- A copy that lands where her own leg just landed draws without its own burst.
- Her four lines take every other ray (`rayPick`), so they spread as a cross.

The wording matches the code.

## The bloom is still fixed

I ran `node e2e/iroha-t5-bloom.mjs --frames 6` at 844x390, high quality, with Iroha at 2-0-5 and a clump of 6 slimes.

| frame | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| explodes | 3 | 2 | 1 | 2 | 1 | 3 |
| near-white | 449 | 443 | 507 | 160 | 203 | 347 |

- **Summary:** min 160, median 443, max 507, mean 352.
- **Frames at or above 1000:** 0. That is in line with r1's run (172 to 640, mean 347). Before the fix, the disc
  frames counted 1889 to 2224.

## Tests and sim

- `npx vitest run --maxWorkers=2 tests/render`: **63 files, 714 tests, all pass.**
- `simId()` = **e4001588f40b**, as required.
  - There is no diff under `src/sim` or `src/online`, so no `COOP_PROTOCOL` bump is needed.
  - `rayPick` is pure and display-only. vfx-beams' "no `sim.` / `Math.random`" check still passes.

## Remaining

- **R1 (Low, process): no patch note yet.** The branch has no change to `src/data/patchNotes.js` against main.
  - Every push to `main` deploys, and each deploy needs a patch note at the top.
  - Add one when this merges. Mention the lilac glass landing, that bursts are one per spot, and the balanced cross.

## Evidence (docs/review/iroha-t5-bloom-r2/)

- `beam-landings-mirror-moon-holy-ally-3x.jpg`: 3x crops of the landings for mirror, moon, holy and the ally blue. The
  rows are 844x390 at 35 and 60 ms, then 1280x720 at 35 and 60 ms.
- `beam-row-844-and-1280.jpg`: the same four beams in the full frame at t = 60 ms. The 844x390 frame is on top, and the
  1280x720 frame is scaled below it.
