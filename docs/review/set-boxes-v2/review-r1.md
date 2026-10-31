# Set Boxes v2 + LR Awakening: review r1

Reviewed: `feature/set-boxes-v2` @ `fbe3b3b2` (off `main` `fc978aba`, with `feature/item-icons-3d` `9a66575e` merged in).
I worked from a fresh clone. Specs: `docs/specs/SET_BOXES_V2.md` and `docs/specs/LR_AWAKEN.md`.
Live main at review time: `eb0b1ab9` (v0.1.67).

## Verdict: OK to merge, after the one Medium fix

Nothing loses or duplicates items, and nothing is a nerf. Every owner ask is met except one display gap (L1).
**M1 must be fixed when main is merged in.** Without that fix, the merged tree's `npm test` fails.

## Findings

| # | Sev | Where | What | Fix |
|---|---|---|---|---|
| M1 | **Medium** | `tests/systems/lrAwaken.test.js:137` | The test hard-codes the sim id `b2ff5e0e884b`. Main is now `0fe7c5c04aec`, so after `git merge origin/main` this test fails. I confirmed it: the merged tree's `npm test` fails here with "expected '0fe7c5c04aec' to be 'b2ff5e0e884b'". | In the merge commit, change the expected id to `0fe7c5c04aec` (main's). Better: assert that the id equals the one main's own test pins, so it can't drift again. Also update `SET_BOXES_V2.md` §7 / §7.1 and `LR_AWAKEN.md` D5c, which name `b2ff5e0e884b`. |
| L1 | Low | `src/data/items.js:184` (`supplyOnly` only when `kind === 'preset'`), `src/ui/online/supplyBot.js:43` | UR Set Boxes are Supply Bot only (owner decision, Oct 31). But the **random UR** boxes (`setbox_<set>_ur_random`, `setbox_pick_ur_random`) show no "Supply Bot only" tag in the Supply Bot. Only preset boxes get it. Screenshot `10-supplybot-ur-random-*.jpg`: "Selected: Geometry Set Box (UR) · you have 0", with no tag. The Tie Pin and Collar Pin have no tag either. | Set `supplyOnly: true` when `r === 'ur'` too: `...(preset \|\| ur ? { supplyOnly: true } : {})`. When a UR player source ships, drop it from the random UR ids. If the owner wants the pins tagged, add `supplyOnly` to them as well. Then extend the "every box: … supplyOnly" test (`tests/systems/setBoxesV2.test.js:36`). |
| L2 | Low | `tests/art/itemArtRuntime.test.js:39` | The pending-art exception here is static: `new Set(SET_BOX_V2_IDS)` covers all 28 ids, baked or not, and carries no "RELEASE BLOCKER" marker. The guard does both: `itemArtGuard.test.js:19-23` filters by `!baked(id)` and is marked. So once the 28 icons are baked, the runtime test still skips them (srcset/plate/unique-src checks) until someone edits it by hand. It can't hide any id outside the 28, so it's still narrow. | `const ART_PENDING = new Set(SET_BOX_V2_IDS.filter((id) => !hasItemArt(id)));` and add the same `RELEASE BLOCKER (v0.1.68) … Remove before release.` comment. |
| I1 | Info | `src/ui/screens/backpack.js:318` | On a preset or random-pick row, the label is `Open ×${Math.min(10, n, fits)}`. When the bag has room for only one box, it reads "Open ×1". The count it passes in (`Math.min(10, n)`) also differs from the label, though the modal clamps it, so this is harmless. | Hide the button when `Math.min(10, n, fits) < 2`, and pass the same number the label shows. |
| I2 | Info | `src/ui/screens/backpack.js:306-308` | A random set box's own Open / ×10 / Open 20 buttons have no double-tap guard. A fast double tap opens two batches. That matches regular gear boxes (`openBoxes`), and the boxes are the player's own, so nothing is lost. | Optional: reuse the 600 ms `busy` guard used in `setBoxModal`. |
| I3 | Info | `src/data/patchNotes.js` | There's no v0.1.68 patch note yet. CLAUDE.md requires one for every push to main. | Add it in the release merge, with the icons. |
| I4 | Info | `repairSetBoxLetters` (`src/systems/gearSets.js:280`) | One unrecoverable case remains. Suppose v0.1.66 claimed an emptied letter and then pruned it (MAIL_LIMIT 60: more than 60 newer letters arrive) before this build loads the save. That letter's boxes are then gone. It needs 60+ letters in an old tab, so I'd accept it. | None needed. Note it in the spec's §6. |

There are no High or Blocker findings.

## What I checked

### 1. Box contents ✔
- I read `openSetBox` / `rollSetPiece` / `addBoxUr`. A set's own box always uses `item.set`; a pick box uses the chosen set for the whole batch. `rollGear` rolls a random main with `rng.pick(MAIN_STATS_BY_SLOT[slot])` (uniform). A preset box uses the chosen main, or the slot's first main if none is given.
- The branch's own D4 test covers all 42 ids (7 boxes × random/preset × mythic/legendary/ur), each pick box against all six sets, ×3 boxes. Every box gives 5 pieces, one per slot, of the right set, rarity and lock state, with the right box mark.
- My adversarial tests (`docs/review/set-boxes-v2/scripts/adv.review.mjs`, 12/12 pass):
  - **Uniformity:** 400 boxes per slot, χ² under 30 for every slot, and every main seen.
  - **Batch edges:** count `0 / -3 / NaN` opens 1, `'5'` opens 5, `2.9` opens 2, `Infinity / 1e9` opens 20. Each time, items spent = boxes opened and pieces = 5 × boxes.
  - **Full bag mid-batch:** with room for 14 pieces, 10 boxes asked opens exactly 2, spends 2, and leaves 4 free places. The next tap returns `bagFull` and spends nothing. Nothing can be lost: `n` is clamped to `floor(room / 5)` before anything is consumed, and `addGear` never refuses a piece.
  - **UR = Rainbow Gear Box:** for every slot, a UR Set Box piece has the same keys, `ur`, `locked`, `box`, rarity, level, set, substat count and salvage ids as `openRainbowBox` with the same set. A `gbx:` mark is present exactly on Charm / Ribbon / Shoes.

### 2. Sources ✔
- `grantSetBoxGifts` pays `setbox_pick_mythic_random` and `setbox_<titan set>_legendary_random` under the unchanged `su:welcome` / `su:titanbox:<titan>` marks. `boxMark` maps both kinds to the same mark, so nothing is paid twice. The branch tests plus my round trips confirm this.
- Owned preset boxes keep their ids and stay openable. The Backpack opens them in preset mode (screens 06–08).
- I grepped all of `src/` and `supabase/` for `setbox`, `tie_pin` and `collar_pin`. The only place that pays set boxes is `grantSetBoxGifts`, which pays only random Mythic/Legendary boxes. `itemSources()` is empty for all 42 box ids and both pins (my test). Stage drops, the shop, freeplay caches (they exclude `gearbox`), missions, achievements and events have no set box, no UR box and no pin.

### 3. Save safety with v0.1.66 ✔
- All 28 new ids (and the 14 live ones, plus the pins and the Lens) are in `MIRRORED_ITEMS`.
- `su:paid:<letter>` is set by `claimMail`, so `claimAllMail` sets it too. v0.1.66 keeps it, because `cleanNumberMap` keeps any numeric counter. No counter reset touches the `su:` prefix.
- My round trips through the vendored v0.1.66 code all end with exactly one copy:
  - Claimed here (Claim all), then v0.1.66 ×3, then here: 1 of each box, not 2.
  - Emptied by v0.1.66 and restored here; then v0.1.66 empties it again and claims it empty; then here: paid once, and still once after one more v0.1.66 trip.
  - Claimed empty in v0.1.66 and repaid here; both boxes opened here; then v0.1.66, then here: inventory 0, exactly 5 Party Popper pieces, no re-pay.
  - Batch opened mid-mirror: 10 held, then v0.1.66, here open 4, then v0.1.66 → 6, here open 6, then v0.1.66 → 0, with 50 pieces.
  - Unbind ≡ Blank LR: limit-breaking a set piece straight to Blank LR, and awakening then unbinding it, give the same piece, the same Lens/coin totals and the same salvage. That holds in this build and when v0.1.66 reads both saves.
- v0.1.66's own `repairSetBoxLetters` ignores v2 ids (`getItem` is undefined there), so it can't pay them.

### 4. LR Awakening (D5) ✔
- `canAwakenLrGear` / `awakenLrGear` wrap `limitBreakGear` with kind `set` for a set piece (`lr: 1`) or `blank` for a no-set piece (`lr: 2`). Same checks (UR, +12, Lens + 150,000), same cost, same marks (`ach:lrEver`, LR Set Form via `noteUrWorn`) and the same `track('gearLimitBreak')`.
- `unbindLrGear` is free. It only accepts `lr: 1` pieces with a set, and keeps level, ▲, ✦, pins, lock and club. The UI asks first through `confirmDialog` and says "for good" (e2e checks the wording, and that the Lens count drops by 1 in all and coins don't change).
- Existing `lr: 1` / `lr: 2` pieces are unchanged; the branch has a v0.1.66 round-trip test for them. Achievement ids and marks are unchanged; only the copy says "Awaken".
- Copy: I grepped `src/` for `Limit Break`, `Set LR` and `Limit Broken`. What's left is the girls' own Limit Break (student.js, rarity badges), code comments and old patch notes. The Build Coach reads "LR: Awaken to LR (keep her set)" / "Awaken, then unbind to Blank LR …".
- `e2e/awaken-lr.mjs` keeps every check from `limit-break.mjs`: slot sheet, four pieces, LR tag, no Pin button, `a_lr_first`, Backpack piece, LR Set Form plus battle stats, Blank LR through its confirm, the Lens Use picker, the Build Coach line, no page errors. It adds the no-choice modal, the reveal title, the no-set → Blank LR path and the free unbind.

### 5. No nerfs, determinism ✔
- Sim id: branch `b2ff5e0e884b`; merged with `origin/main` `0fe7c5c04aec`, which equals main's. `COOP_PROTOCOL` after the merge is 15 (main's).
- `noNerfGate` (`--support um --tiers 5 --seeds 9 --profiles maxed --no-lr-off`): **live main vs merged branch: 279 cells, 0 under, the JSONL byte-identical.** Branch vs live main: 279 cells, 0 under.
- `lrBar.mjs` (default bench), the same on branch, merged and live: K&T p0t5/p1t5/p2t5 crowd ×1.33/1.32/1.31, boss ×3.16/3.56/2.18; Tenka crowd ×1.32/1.32/1.32, boss ×4.37/3.31/4.20. All are ≥ ×1.25. The `--gear urset` bar is out of scope (fix/duo-p2t5-lr-bar).

### 6. Icons ✔ (see L2)
- The `itemArtGuard` exception is exactly `SET_BOX_V2_IDS.filter(!baked)`. It can't hide any other id, and each id is enforced as soon as it's baked. The runtime test's copy is static (L2).
- Until the bake lands, the drawn fallbacks are the gear box of the box's rarity, and the Rainbow Gear Box for a UR box (screens 01).

### 7. UI ✔ (screens in `shots/`, JPEG, all < 50 KB, 390x844 and 844x390)
- `01-supplies`: random own box has Open / Open ×10 / Open 20 (25 held). The UR random box has Open / Open ×2. Preset and pick boxes go through the modal.
- `02-results-openall`: "Party Popper Box (Legendary) ×20", "20 boxes · 100 pieces · all Party Popper", a main-stat tally per slot, then the counted summary (100 Legendary, 20 per slot). 5 boxes stay in the Backpack.
- `03-results-one`: one box shows the card grid. `04-results-ur`: UR cards, locked, "of the Rainbow Sakura".
- `05-modal-random-pick`: set row, no main-stat rows, count row "1 / All 3". I opened 3 Spirit Squad boxes this way: 3 boxes, all Spirit.
- `06/06b-modal-preset`: main stat per slot, Fill for Aoi, count "1 / All 4", "4 boxes · 20 pieces, all with these main stats."
- `07-preset-confirm`: "Open 4 boxes with these main stats? 20 pieces of the Party Popper set." with the OK button "Open 4". `08-results-preset`.
- `09-supplybot-preset`: "Supply Bot only" tag present. `10-supplybot-ur-random`: tag missing (L1). I mounted the Supply Bot directly; its developer-clan gate is unchanged.
- No page errors on either size.

### 8. Test runs
- `npm test` on the branch: **425 files passed, 2 skipped; 6724 tests passed, 11 skipped.**
- `npm test` on the branch merged with `origin/main` (merges cleanly; only CONTRACTS.md, achievements.js and itemArtRuntime.test.js auto-merge): 427 files passed, 4 failed; 6799 tests passed, 4 failed, 11 skipped.
  - One failure is real: **M1** (`lrAwaken.test.js` sim id).
  - The other three were timeouts or wall-clock budgets while e2e, noNerf and lrBar ran on the same 4 cores (`perf.mirror`, `rules` 4-1 calm point, `sim/smoke` sweep). Re-run alone in the merged tree, they pass: 3 files, 30/30.
- e2e on the branch:

  | e2e | result |
  |---|---|
  | gear-slots | 52 ok |
  | awaken-lr | 52 ok |
  | ur-gear | 72 ok |
  | ur-awaken | 87 ok |
  | teams | 128 ok |
  | smoke | 2 FAIL, both "drag (touch): releasing places aoi where the pointer let go" |

  The branch doesn't touch drag or placement code. Live main `eb0b1ab9` fails the same 2 checks at the same coordinates ([9.8, 4.8] → [10.31, 4.8] and [7.3, 5.3] → [7.3, 4.88]), with 676 ok on both. These failures already exist on main, so they're **not from this branch**. They are worth their own ticket.
- My adversarial unit tests: 12/12 (`scripts/adv.review.mjs`; to run them, copy the file to `tests/` as `*.test.js`).
