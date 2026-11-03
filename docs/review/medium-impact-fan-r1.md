# Review r1: medium-tier impact lines spread round the landing (ef151138)

**Verdict: OK.** I found no blocking issues. There are two small notes and no required changes.

- **Reviewed:** commit ef151138 on `fix/medium-impact-fan`. Its base is 02dfc09f, the reviewed Iroha mirror-cross fix.
- **Change:** `rayPick(i, n, total)` in `src/render/vfx/beams.js` now takes an even stride whenever `n < total`. The
  `counted` flag is gone. The commit also rewrites the matching test and adds one line to the spec.

## 1. Logic

| Check | Result |
|---|---|
| High (8 of 8) | `n < total` is false, so it returns `i`, the same as before. The picks are 0–7 in order. For n = 8, both the old and new code return `i` for every caller, so high is identical by construction. |
| Medium (6 of 8) | `floor(i*8/6)` gives 0, 1, 2, 4, 5, 6 (0°, 45°, 90°, 180°, 225°, 270°). The unit vectors sum to exactly 0. The two gaps, 135° and 315°, sit opposite each other. Before, it drew 0–5 (0°–225°), whose vectors sum to about 2.4, a one-sided fan. |
| Mirror (count 4) | `raysOf` = min(tier.lines, 4, 8) = 4 on both high and medium. It draws 0, 2, 4, 6, the same cross as at 02dfc09f. |
| Low | `BEAM_TIERS.low.lines` is 0, so `raysOf` returns 0 and nothing draws. `rayPick` is never reached. |
| Other callers | `rayPick` has one caller, `impactLines` in beams.js. `rec.rays` is filled once per fire in the same loop of 8 `rnd()` pairs, so the visual random stream is consumed exactly as before and later effects see the same draws. No other module reads `rec.rays`. (The `rays` in `src/ui/recruit/*` is an unrelated recruit-screen field.) The only presets with a line count are the shared IMPACT (8) and mirror (4). |
| Sim | The commit touches no files under `src/sim`, `src/online` or `src/data`. `simId()` = **e4001588f40b**, as expected, so no `COOP_PROTOCOL` bump is needed. |
| VFX rules | The commit adds no `Math.random`; every hit under `src/render` is a "never Math.random" comment. `tests/render/vfx-random.test.js` passes. |

Edge note (not a defect): a future preset with a line count that does not divide 8 still spreads evenly. For example,
3 lines would give 0, 2, 5. A count above 8 is clamped to 8 by `raysOf`.

## 2. On screen (844x390, swiftshader)

**Method:** a scratch harness (not committed) loads battle 1-1 normal at medium or high quality. It wraps
`renderer.update` so it advances only in fixed 10 ms steps that the harness queues, and otherwise renders at dt 0, which
freezes the frame. It then fires four beams side by side onto open grass between the road's bends:

- moon and holy through `renderer.beamDemo`;
- the ally blue through `renderer.beams.fire` with `color: '#bfe6ff'` and no preset;
- storm through `renderer.beamDemo`.

I took screenshots 60 and 90 ms after firing (about 20–55 ms after the landing). I ran the same harness at 02dfc09f
(before, in a separate `git worktree`) and at ef151138 (after).

**Image:** `medium-impact-fan-r1/beam-landings-medium-before-after-3x.jpg` (190 KB). The left half is before and the
right half is after. Each half has the columns moon | holy | ally | storm, and the rows are MEDIUM 60 ms, MEDIUM 90 ms
and HIGH 60 ms. All crops are 3x.

- **Medium, before:** every landing has a clear lopsided fan. It has rays to the right, up and left. Nothing points down
  or down-right, so the burst looks like it trails off to one side.
- **Medium, after:** all four presets read as an even burst. The lines point right, up, left, down-left and down. The
  only open diagonals are up-left and down-right. Here the beams come in from the upper left, so the up-left gap sits
  under the beam body and the burst looks full. Seen from another angle, the burst would read as an even six-point star
  with two opposite gaps, which is still balanced. This holds at both 60 and 90 ms and for every preset, including the
  plain ally laser.
- **High:** the line count, angles and lengths match before and after (8 lines, in the same places).
  - The overall brightness of a landing differs slightly between the two runs, on every preset. This is harness noise,
    not the change. The flash guard (`flashGate` → `flashGuard.world(…, clock.realT)`) runs on the real-time clock.
  - My stepped frames come one per browser frame, so the wall-clock gap between landings varies from run to run, and
    with it the gate's `hitK`.
  - The code path for n = 8 is unchanged, so high is byte-identical in code.

## 3. Tests

`npx vitest run --maxWorkers=2 tests/render`: **63 files, 714 tests, all pass**. This includes the new
`impact lines spread round the landing on every tier` and `vfx-random.test.js`.

The new test pins high to 0–7, medium to 0, 1, 2, 4, 5, 6 and the mirror to 0, 2, 4, 6. It also checks that each pick
is balanced and that the old medium subset was one-sided. That covers the change well.

## Notes (non-blocking)

- **N1.** The doc comment on `rayPick` and the test describe the high case as "in order". The commit message says
  "byte-identical", which is accurate for the code path. On screen, high differs only by the real-time flash-gate noise
  described above.
- **N2.** When the diff reaches `main`, it needs a patch note at the top of `src/data/patchNotes.js` per the repo rules.
  No commit on the branch adds one (origin/main..ef151138 is 4e7a51cd, 02dfc09f and ef151138, and none touches
  patchNotes.js). Add one at merge time that covers the Iroha bloom and this fix.
