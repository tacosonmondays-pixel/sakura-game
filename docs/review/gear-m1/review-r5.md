# Gear update M1 (teams and gear loadouts): independent review, round 5

- Branch `feature/gear-loadouts` at `450e2641`. Reviewed `git diff 16c6c67f 450e2641` (`teams.js`, `teamsSave.js`, `teams.test.js`, `CONTRACTS.md`) against r4 (`origin/review/gear-loadouts-r4`, `03daa660`).
- Reviewer: a fresh independent agent that did not build this and did not write r1–r4. Review date: Oct 30.

## What was run

| Check | Result |
|---|---|
| Full `npm test` | **EXIT 0.** 389 files pass, 2 skipped (391). 6210 tests pass, 11 skipped (6221). 481 s |
| `node e2e/smoke.mjs` | ALL SMOKE CHECKS PASSED (678 ok lines), exit 0 |
| `node e2e/teams.mjs` (844×390, 1280×720, 390×844) | 110 ok (36 / 37 / 37), 0 FAIL, no page errors, "all ok", exit 0 |
| Sim id | `be940ecb2087`, unchanged; no hashed file in the diff; `COOP_PROTOCOL` stays 13 |
| Reviewer fuzz (`review-r5-fuzz.mjs`) | 1,500 seeds × 60 = 90,000 ops plus 600 × 80 = 48,000: **138,000 ops, 0 failures** on `450e2641` |
| Same fuzz on `16c6c67f` | 24,000 ops: **40 failures** (lender ends while she does not wear it, a flip, a copy carrying `lent`). So the fuzz does see r4-M1 |
| Live-build hop (`review-r5-livehop.mjs`) | 4 variants, all ok. Details below |

### The fuzz

It is r4's fuzz (9 girls, 9 shared pieces; team, loadout, copy, equip, unequip, formation, salvage, multi-salvage, Limit Break, Undo, reload, older-build hop, build), plus these:

- **G: without a hand action, a piece's lender stays the same girl, or her claim ends with the piece back on her.** A hand action is one of: equip or unequip, salvage, a hop that moves the piece, editing or copying over her loadout. Any other change fails, and so does any flip to a new lender. Results: kept 18,715, ended back on her 3,387, changed by a hand action 344. **Flips: 0, even counting hand actions.**
- **H: the claims across all loadouts.** One lender girl per piece. No claim names a missing piece or one she wears. No loadout she took off carries a `wish`. 3,742 claims on taken-off loadouts were checked.
- **copyhop:** she copies a loadout into a fresh slot. The copy must carry no `lent` or `wish` flags. Then the save goes through the older build's shape (`teams` and `presets` dropped) and G and H are checked again. 3,568 copies.
- r4's checks still hold: one wearer per piece; nothing vanishes except by salvage; no ping-pong (2,145 off-team moves, all returns to the lender); no unwarned salvage (9,732 single attempts plus multi).

### The `gpf:<id>:<n>` mirror in the live build

I set up the r4 repro state on the feature build: Kage wears c2, and Aoi is on loadout B with A keeping the claim. I loaded that save into `origin/main`'s `migrateProfile`. It did not crash. All 3 pieces were kept, c2 stayed on Kage, the formation was unchanged and the counter `gpf:aoi:0` was kept word for word. `main` reads no `gpf:` key.

Then I let the live build act and saved again. Back on the feature build:

| What the live build did | Result back on the feature build |
|---|---|
| Nothing | Aoi is still the lender. Team 1 returns c2 to her, and Team 4 leaves it on her |
| Kage unequips c2 | c2 is spare. `salvageBlock` says `'loadout'`, and Team 1 brings it back |
| c2 equipped on Yuki | Aoi is the lender. Team 4 lets Yuki borrow it from Aoi (Yuki is on Team 4), and Team 1 gives it back to her |
| c2 equipped on Aoi | For a moment Aoi is lender of a piece she wears. The first `syncTeams` ends that (`foldGear`), and every load and read runs it (`store.js:72`, `getTeams`) |

## The r4 findings

| r4 | Status |
|---|---|
| H1: the fuzz test timed out | **Fixed.** `{ timeout: 60_000 }`, and the full suite is green |
| M1: the lending flipped direction | **Fixed.** `applyStep` keeps `lent` and drops only `wish` (`teams.js:403`). `lenderOf` reads every loadout (`:147-151`), and `foldGear` ends a taken-off claim (`:90-93`). New and copied loadouts carry no flags (`:427-428`, `:503-504`). The repro and its mirror are tests, and both pass |
| L2: the patch note | **Still open** |

## Findings

No HIGH or MEDIUM findings.

### LOW
- **r5-L1. The patch note is still missing** (carried over from r2, r3 and r4). One must go at the top of `src/data/patchNotes.js` before `main`.
- **r5-L2. A claim on a taken-off loadout does not show.** `lentPieces` reads only the worn loadout (`teams.js:196-200`). While Aoi wears B, nothing says "lent to Kage", and she has no Take back for c2. Putting on A still brings it back. Fix (optional, owner's call): list the taken-off claims too, e.g. "Loadout A: lent to Kage".
- **r5-L3 (note).** Copying over a loadout that holds a claim (`copyPreset`, `teams.js:494`) ends the claim without a word, and the borrower keeps the piece. This is her own hand action, so it is allowed under the invariant. A confirm line would make it clear.

## Verdict

**OK.** r4-H1 and r4-M1 are fixed and verified. Over 138,000 fuzz ops there was no loss, duplicate, piece worn twice, unwarned salvage, ping-pong or flip in direction. The lender changed only by a hand action. The new mirror is harmless on the live build. The suite, the smoke test and the teams e2e are green, and the sim and protocol are unchanged. The patch note (r5-L1) must land before `main`.
