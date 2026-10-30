# Gear update M1 (teams and gear loadouts): independent review, round 3

- Branch `feature/gear-loadouts` at `e610e761`. Reviewed `git diff d4ad186c e610e761`, against r2 (`origin/review/gear-loadouts-r2`, `b34f045b`) and the coordinator's ruling: lending is one way with one lender; whenever an operation leaves a lent piece unworn by its borrower, it goes back to the lender in that same operation; a lent orphan is never salvaged without the warning.
- Reviewer: a fresh independent agent that did not build this and did not write r1 or r2. Review date: Oct 30.

## What was run

| Check | Result |
|---|---|
| Full `npm test` | 389 files pass, 2 skipped (391). 6206 tests pass, 11 skipped. Exit 0 |
| `node e2e/smoke.mjs` | ALL SMOKE CHECKS PASSED (678 ok lines) |
| `node e2e/teams.mjs` (844×390, 1280×720, 390×844) | 110 ok, 0 FAIL, no page errors, "all ok" |
| Sim id | `be940ecb2087`, unchanged. No hashed file is in the diff, so `COOP_PROTOCOL` stays 13. `src/sim` and `src/online/coop` never read `presets`, `teams`, `lent` or `wish`. Battle and co-op still read only `profile.formation` and `unit.gear` |
| Reviewer probes (temporary, not committed) | Two scenario tests, plus a fuzz: 400 seeds × 80 ops = 32,000 ops. The ops are team switch, loadout switch, manual equip on any girl (a third girl too), unequip, single salvage behind the guard, multi-salvage, Undo, reload, and an older-build hop. The hop either keeps everything or has the older build move or unequip a piece. The fuzz checks these invariants: one wearer per piece; no lent piece left spare; a lent piece whose lender the op did not touch is still lent by her or worn by her; no spare, unnamed piece that was lent; no off-team move that is not a return home |

## r2 findings

| r2 | Status |
|---|---|
| H1 a lent piece is lost when the borrower lets it go | **Fixed for the single-piece paths.** The r2 repro passes: T2 → T3 → T1, and Aoi wears c2 again. A loadout switch on Kage's page sends it home. A manual unequip sends it home at the next sync or save write, and before that sync the salvage guard holds ('loadout'). Equipping it on a third girl keeps Aoi as the lender. Reload and an older-build hop keep the flag (`gpf:`), and Undo stays consistent. **A new path still loses it: see r3-H1** |
| M1 ping-pong | **Fixed.** The fuzz found 0 off-team moves that were not a return home in 9,494 switches. Lenders are walked in sorted unit-id order, so the result never depends on the save's key order |
| L1 Rename/Copy 40 px at 844×390 | Fixed: 44 px at 844×390, 48 px at 1280×720 |
| L2 patch note | **Still open.** No M1 note at the top of `src/data/patchNotes.js`. It is needed before `main` |
| L3 "lent to …" note | Fixed. The note has a "Take back" button (44 px) that works at all 3 sizes |
| L4 picker under the confirm | Fixed (`beforeSwitch` closes the picker first). If the player cancels the confirm, the picker stays closed; that is acceptable |

## Findings

### HIGH

**r3-H1. A lent piece is still lost when, in the same operation, the borrower lets it go and a later step takes a different piece from the lender.**

The cause: `applyStep` calls `ensurePresets` (`src/systems/teams.js:374`, `:382`). `ensurePresets` calls `foldGear`, which calls `wornLoadout` (`src/systems/teamsSave.js:136`). `wornLoadout` keeps a flagged slot only while `g.equippedBy` is set. Mid-plan, the borrower has already let the piece go, so it is spare, and the lender's `lent` bit is dropped. `settleLent` runs at the end and finds nothing to return.

Repro 1, the team switch:
1. T1: Aoi wears c2 and ribbon rA.
2. T2: Kage on loadout B, which names c2.
3. T3: Kage on loadout A (c3), then Yuki on a loadout that names rA.
4. Switch T2 → T3. `returns` is `[]`, c2 is spare, and Aoi's worn loadout is `{charm: null, ribbon: rA, lent: 2}`.
5. Switch to T1: Aoi has no charm.

Repro 2, the girl page: Kage borrows c2. Her loadout C names c3 and rA. `usePreset(kage, 2)` leaves c2 spare, Aoi's claim is gone, and `returns` is `[]`.

c2 then survives only as a name in Kage's non-worn loadout B. So it is "Kage's Loadout B", not Aoi's, and it is never given back to Aoi. In the fuzz this was 44 losses in 32,000 ops: 41 in team switches, 3 in loadout switches. This is the r2-H1 failure on a narrower but ordinary path (a lender's other pieces are often shared too). There were 0 unwarned orphans and 0 duplicates.

Fix (verified: the fuzz drops to 0 losses and both repros pass): in `wornLoadout`, keep a `lent` slot while the piece exists in that slot and she does not wear it, even when it is spare. Only `settleLent` clears a `lent` bit. `wish` still needs a wearer.
```js
else if (flagged && g && g.slot === s && g.equippedBy !== unitId && (g.equippedBy || ((prev?.lent | 0) & bit))) {
```
`syncTeams` settles before it folds, so a spare lent piece never outlives the operation. Add both repros as tests, and add the fuzz's "lent and untouched, so still lent or home" invariant to the existing fuzz. That fuzz checks consistency only, and it passes with this bug.

### LOW

- **r3-L1.** Dead duplicate line at `src/systems/teams.js:117`: an exact copy of line 116's guard, with a bare `return;` that can never be reached. Delete it.
- **r3-L2** (r2-L2): the patch note is still missing.

## Verdict

**NOT OK.** The fix needed is r3-H1, one condition in `teamsSave.js:136` plus two tests. Everything else from r2 is fixed: the ping-pong is gone, the 44 px targets, the Take back button and the picker order are in, and the sim and protocol are untouched. Nothing live gets weaker. The patch note must land before `main`.
