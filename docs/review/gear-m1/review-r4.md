# Gear update M1 (teams and gear loadouts): independent review, round 4

- Branch `feature/gear-loadouts` at `16c6c67f` (fast-forward from `e610e761`). Reviewed `git diff e610e761 16c6c67f` (`teams.js`, `teamsSave.js`, `teams.test.js`) against r3 (`origin/review/gear-loadouts-r3`, `dc30459d`).
- Reviewer: a fresh independent agent that did not build this and did not write r1–r3. Review date: Oct 30.

## What was run

| Check | Result |
|---|---|
| Full `npm test` | **EXIT 1.** 388 files pass, 1 fails, 2 skipped (391). 6207 tests pass, **1 fails**, 11 skipped (6219). The failure is the M1 fuzz timing out (see r4-H1) |
| `teams.test.js` with `--testTimeout=60000` | 29/29 pass (the fuzz's assertions hold; it just takes ~6.1 s) |
| `node e2e/smoke.mjs` | ALL SMOKE CHECKS PASSED (678 ok lines), exit 0 |
| `node e2e/teams.mjs` (844×390, 1280×720, 390×844) | 110 ok, 0 FAIL, no page errors, "all ok" |
| Sim id | `be940ecb2087`, unchanged; no hashed file in the diff; `COOP_PROTOCOL` stays 13 |
| Reviewer fuzz (`review-r4-fuzz.mjs`, written independently) | 1,500 seeds × 60 = **90,000 ops**, plus 500 × 80 = 40,000: **0 failures** on `16c6c67f`. The same fuzz finds **2 losses** in 40,000 ops on `e610e761`, so it does see r3-H1 |

The fuzz has 9 girls (two heroes), 9 shared pieces and random teams and loadouts that name each other's pieces. Its ops are team switch, loadout switch, copy loadout, hand equip (half the time a lent piece onto any girl, a third girl too), unequip, formation edit, single salvage behind `salvageBlock`, multi-salvage, Limit Break, Undo, reload, and an older-build hop that sometimes moves or unequips a piece. After every op it checks:
- one wearer per piece, and no piece vanishes unless it was salvaged;
- every lent piece is worn by a girl other than its lender, and has one lender;
- on a team switch, a piece moved onto a girl outside the new team is a return to its lender (1,256 moves checked);
- no spare piece that is named or lent is salvageable, single or multi (6,306 + 3,559 attempts);
- a lent piece that the op did not touch by hand is still lent by the same girl, back on her, or named by one of her loadouts.

When only the last case holds (88 cases), the fuzz also checks that `salvageBlock` says `'loadout'` while the piece is spare. It then puts that loadout on in a clone and checks the piece comes back: 88/88 passed.

## r3 findings

| r3 | Status |
|---|---|
| H1 the lent bit is dropped mid-plan | **Fixed.** `wornLoadout` (`teamsSave.js:139`) keeps a `lent` slot while the piece exists and she does not wear it; only `settleLent` clears it. `syncTeams` settles before it folds. Both repros are tests and pass. The fuzz finds 0 losses |
| L1 dead guard | Fixed (deleted) |
| L2 patch note | **Still open.** It is needed before `main` |

## Findings

### HIGH

**r4-H1. `npm test` is red: the in-repo fuzz times out.** `tests/systems/teams.test.js:483` now runs 600 seeds (`:484`). That takes ~6.1 s even on its own, so it fails vitest's default 5,000 ms timeout every time, both in the full run and when the file runs alone. A red suite blocks the ship gate. Fix: give the test its own timeout, `it('fuzz: …', () => { … }, 60_000)`, or drop to ~300 seeds. Then rerun the full suite.

### MEDIUM

**r4-M1. The "named by one of her loadouts" relaxation does not carry the lender's claim. When she takes the piece back, the borrower becomes its lender.** No piece is lost or duplicated, but the lending turns around.

`applyStep` deletes the `lent` bit from the loadout she takes off (`teams.js:397-398`). When that loadout later takes the piece back, `lenderOf` finds no lender, so the borrower is marked as the lender (`teams.js:380`, `:388`). The test comment at `teams.test.js:539` says her claim "moves" to that loadout, but the code drops it. It is the same on `e610e761`, but the r4 invariant relies on it.

Repro (reviewer probe):
1. Aoi wears c2 on loadout A; her loadout B has no charm.
2. Team 2 is Kage on a loadout that names c2. Select Team 2: Kage borrows c2, and Aoi is the lender.
3. On Aoi's page, put on loadout B. Kage still wears c2, and nobody is its lender.
4. Select Team 1, which has Aoi on A: c2 is taken from Kage, and **Kage** is now its lender.
5. Select Team 4 (Yuki only): c2, Aoi's own charm, goes to Kage, who is not on Team 4.

The piece comes back each time A is put on, so it is never lost. It bounces, though, and an unrelated team switch moves Aoi's piece to a classmate. That breaks "one way, one lender".

Fix: keep the `lent` bit on a taken-off loadout while another girl wears its piece. That makes it a claim:
- `lenderOf` reads `lent` bits on all her loadouts.
- `settleLent` returns pieces only for the worn loadout.
- `foldGear` clears a non-worn `lent` bit when that slot no longer names the piece, when the piece is gone, or when she wears it.
- Then, in step 4, `lender === step.unitId` gives Kage a `wish`.

Add the repro as a test.

### LOW
- r3-L2 / r2-L2: the patch note is still missing.

## Verdict

**NOT OK.** r3-H1 is fixed and verified: 0 losses, 0 duplicates and 0 unwarned salvages in 130,000 fuzz ops. Nothing live gets weaker, and the sim and protocol are untouched. Two things still need fixing: r4-H1 (the test timeout, a one-line fix) and r4-M1 (carry the claim on a taken-off loadout). The patch note must land before `main`.
