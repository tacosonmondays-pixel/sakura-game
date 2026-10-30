# Gear update M0 (the reader): independent review, round 2

Branch `feature/gear-m0` at `7f7a9fcf`, the r1 fixes on top of r1 (`66ae0e63`). Spec: M0 of
`docs/specs/GEAR_UPDATE.md` on `origin/spec/gear-update` (r3, with review r3 `2829739a`). Line numbers are on
`7f7a9fcf`.

**Verdict: NOT OK.** Every r1 finding is fixed. The fixes are faithful and checked against the vendored real old build.
But the L3 fix introduced one MEDIUM regression (M1 below): a save that `main` loads now fails to load. The fix is one
line.

## How I checked

- Read `git diff 66ae0e63 7f7a9fcf`, the r1 review, GU §6, §9 and §13.
- Diffed every vendored file under `tests/fixtures/main-60ce9cad/` against `git show 60ce9cad:<file>`. Only the header
  comment and the import paths differ.
- Checked that the files the fixture imports from the live tree are unchanged between `60ce9cad` and `7f7a9fcf`. The one
  exception is `store.js`, and the test's `oldSaveText` copies main's `saveText` (gear marks, then roster marks), so it
  is faithful.
- Probed the real old `migrateProfile` against the branch's with malformed gear (M1).
- Measured the largest substat base over 12,000 Legendary rolls (for L28).
- **Full `npm test`: 389 files passed, 2 skipped (391). 6,182 tests passed, 11 skipped (6,193). Exit 0, 494 s.** The
  6 suite failures r1's run hit no longer occur.
- **`node e2e/smoke.mjs`: 678 ok, 0 failed, "ALL SMOKE CHECKS PASSED"** (all three viewports).
- Sim id `be940ecb2087`, checked by `tests/art/itemArtRuntime.test.js`. `COOP_PROTOCOL` is 13. Nothing under
  `src/sim`, `src/online/coop` or `tools` changed.

## r1 findings

| # | Status | Evidence |
|---|---|---|
| H1 | **Fixed** | The `inv:` restore now runs before `restoreUpdateMarks` (`gearMarks.js:315-324`). Main's `writeGearMarks` neither rewrites nor deletes `inv:` keys for items it does not know, so the dropped stock comes back first and the refund adds to it. The test (`gearUpdateSave.test.js:178-212`) starts with 1 Lens, 2 Tie Pins and 4 Collar Pins and runs the real old `salvageGear`. Results: 2 / 3 / 5, old coins plus refund equal the branch's own salvage, and a second load and a second old trip pay nothing. |
| M1 | **Fixed** | `withSuffix` strips every trailing LR, UR or Legendary suffix in a loop (`gear.js:254-268`). Tested through two real old trips with main's `urName` (`gearUpdateSave.test.js:235-249`). Today's UR names are unchanged: main's `urName` and the branch's give the same result on any name that has at most one suffix. |
| M2 | **Fixed** | The real old `migrateProfile`, `writeGearMarks`, `writeRosterMarks`, `salvageGear` and `rerollSubstats` are vendored and used. The salvage test holds stock, and the pin test uses a real old Fortune Dice. |
| L1 | **Fixed** | `glr:` now carries the ▲ per line (`gearMarks.js:209`). They are restored only when the digits add up to `floor(level / 3)` (`:252-262`), so a hostile or stale mark cannot add ▲. The total is always the same as step 6's. |
| L2 | **Fixed** | The header comment (`gearMarks.js:22-26`) and CONTRACTS now allow `gbl:` on new-slot pieces. |
| L3 | **Fixed, but introduces M1 below** | Classic slots use main's rule again (`!!GEAR_STATS[stat]`); only the Hair Clip and Necklace check their pool. |
| L4 | **Fixed per GU §6** | A reroll that would keep every line is refused before it charges (`gear.js:517`). The Lock Pin still needs 2 or more lines left to reroll (`canLockPin`, `:474-481`). This matches GU §6 (row `:602`). No live piece can hit `allKept`, because ✦ allows at most one gold and one rainbow line, so live behaviour is unchanged. |
| L28 | **Fixed** | The `gps:` base cap is 9,999,999 (`gearMarks.js:117`), and the decoder reads `n % 1e7` (`:140`). The largest substat base is Armor Pierce 3.8. The test is at `gearUpdateSave.test.js:138-148`. |
| L29 | **Fixed** | `su:welcome` and `su:titanbox:` exist, `su:vet` is used nowhere, and no `su:` key existed on main. `cleanUnit` keeps `accItem` (`save.js:269-271`). The Treasurer colour has a ΔE test. |

## Findings

### M1 MEDIUM: one malformed gear line makes the whole save "corrupt" (a regression from the L3 fix)

`src/systems/save.js:282` reads `raw.stat` **before** the `isObj(raw)` guard on `:283`. Main checked `isObj` first
(`main:src/systems/save.js:262`).

Reproduced with the real vendored old build:

| Gear piece in the stored save | Main | Branch |
|---|---|---|
| `main: null` | loads (piece dropped) | **TypeError** |
| `main` missing | loads (piece dropped) | **TypeError** |
| `null` in `subs` | loads (line dropped) | **TypeError** |

`loadSaveText` (`save.js:771-775`) catches the throw and returns `createProfile()` with `backup: 'corrupt'`. The player
is told "Your saved progress could not be read, so a new profile was started." A backup is kept, so the data is not lost
outright. But a save that loads today stops loading after the update. One bad line, from a cloud merge, a hand edit or
an import, is enough. `deserializeProfile` imports take the same path. This breaks the "hostile counters / malformed
input" robustness that GU §13 asks for.

*Fix:* `if (!isObj(raw)) return null;` as the first line of `cleanStat`, then compute `mainOk`. Add a test with
`main: null`, a missing `main` and `subs: [null, …]`, where the piece or line is dropped and the rest of the save loads.

### L1 LOW: the spec still says `glr:` = kind × 100 + level

GU §9.2's table (`GEAR_UPDATE.md:819` on `spec/gear-update`) does not mention the new ▲ digits (`+ 1000 × ▲ per line`,
line 0 lowest). CONTRACTS does. *Fix:* update the spec row in its next revision.

### L2 LOW: Vite warns about the fixture import

`gearUpdateSave.test.js:23` builds its import path at runtime (`` import(`../fixtures/main-60ce9cad/src/${f}`) ``).
Every run prints the vite `dynamic-import-vars` warning ("A file extension must be included…"). It works, but the
warning is noise. *Fix:* four static `import * as … from '../fixtures/main-60ce9cad/src/systems/save.js'` lines.

### L3 LOW: `accItem` has no round-trip test

`cleanUnit` keeps `unit.accItem` (`save.js:269-271`), but no test covers keeping a valid id or dropping a bad one.
*Fix:* add both cases to `save.test.js`.

## Other checks (clean)

- **Economy:** I found no duplication or double pay.
  - `glr:` ▲ digits never add ▲: the total must match the level.
  - `kind % 10` only widens which hostile values parse, and a hostile mark on a gone piece could already pay a Lens in
    r1. That is the player editing their own save.
  - The refunds stay idempotent through a second old trip.
- **No nerfs:**
  - Today's pieces keep their names, ▲ and values.
  - `allKept` cannot trigger on a live piece.
  - Classic main stats are accepted as on main.
- **No other games' or anime names** appear in the diff.

## Summary

| # | Severity | Finding |
|---|---|---|
| M1 | MEDIUM | `cleanStat` reads `raw.stat` before `isObj(raw)` (`save.js:282`): a null main or sub makes the whole save "corrupt" (new profile started); main dropped only the piece or line |
| L1 | LOW | GU §9.2 (`:819`) still gives the old `glr:` layout |
| L2 | LOW | The template-string fixture import triggers a vite warning (`gearUpdateSave.test.js:23`) |
| L3 | LOW | No test for `unit.accItem` |

**Verdict: NOT OK** until M1 is fixed and tested. Everything r1 asked for is done. The LOW findings can follow.
