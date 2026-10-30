# Gear M0 (save base): re-review r3

- Branch: `origin/feature/gear-m0`, delta `7f7a9fcf..8e8aeae1` (also merged into M2 at `9d94b3c5`)
- r2 review: `origin/review/gear-m0-r2` (`ce19f135`, `docs/review/gear-m0/review-r2.md`)
- Reviewer: a fresh agent that built none of this

## Verdict: **OK**

The r2 MEDIUM (M1) is fixed and holds up under fuzzing. Two of the three LOWs are fixed. L1 (the spec text) is still
open, but it lives on the spec branch, not the code, so it does not block this.

## r2 findings

| # | Status | Evidence |
|---|---|---|
| M1 `cleanStat` read `raw.stat` before the `isObj` guard | **Fixed** | `src/systems/save.js:283` now returns `null` for a non-object before it reads `raw.stat` (`:285`). `cleanGear` drops the piece when its main is `null` (`:300-301`), and the subs loop skips a `null` sub. New tests: `tests/systems/save.test.js:633-674` (null main, missing main, null sub; coins kept, `backup` not `corrupt`). |
| L1 spec `glr:` layout lacks the ▲ digits | **Still open** | `GEAR_UPDATE.md:819` on `origin/spec/gear-update` (`2829739a`) still reads "`glr:<uid>` = LR kind × 100 + level". The code header (`gearMarks.js:18`) has the right layout (`+ 1000 × ▲ per line`). Fix: copy that wording into the §9.2 row. This is a docs-only change on the spec branch. |
| L2 template-string fixture import | **Fixed** | `tests/systems/gearUpdateSave.test.js:24-27` now uses four static `import * as …` lines. The old-build tests still pass. |
| L3 no `accItem` test | **Fixed** | `save.test.js:676-687`: `acc_star_pin` is kept. `star_pin`, `acc_`, `acc_BAD`, `42`, an object and a 44-character id are all dropped. This matches the rule at `save.js:272` (`/^acc_[a-z0-9_]{1,36}$/`). |

## Fuzz of the save loader (mine, not committed)

I wrote a vitest file and ran it from a scratch worktree on `9d94b3c5`. It built a save with 10 pieces (common and
Legendary in all five slots, Treasurer on Hair Clip and Necklace, a UR Charm with ✦ and pins) and equipped them. It also
added two teams, two loadouts on Aoi and an `accItem`. The save was written with `store.saveText`, so the `missions.counters`
marks are in it.

- I mutated 389 paths under `gear`, `units`, `teams`, `missions` (every mark), `inventory` and `currencies`.
- Every path got each of 13 values: `null`, deleted, `0`, `-1`, `1e12`, `'x'`, `''`, `true`, `[]`, `{}`, `[null]`,
  `{stat:null}` and `'NaN'`.
- Then I ran 20,000 random trials with 1–6 mutations each, for **25,057 loads** in total.
- Result: **0 throws and 0 `corrupt`**. Coins always survived when `currencies.coins` itself was not mutated.
- Control: I put the pre-fix guard order back into `save.js` (nothing else changed) and ran the same fuzz. It gives
  **1,003 `corrupt`** losses. Every sample I read had a `null`, missing or non-object main or sub. The live build's loader (`tests/fixtures/main-60ce9cad`)
  calls those same inputs `lossy`, not `corrupt`. So the fuzz does catch M1, and the fix closes it.

No input I found loses the whole save where main would not.

## Tests

The full `npm test` and `e2e/smoke.mjs` were run on `9d94b3c5`, which contains this delta. The counts are in
`docs/review/gear-m2/review-r3.md`.

## New findings

None.
