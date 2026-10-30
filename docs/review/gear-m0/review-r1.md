# Gear update M0 (the reader): independent review, round 1

Branch `feature/gear-m0` at `d15fba99` (two commits on `origin/main` `60ce9cad`). Spec: M0 of
`docs/specs/GEAR_UPDATE.md` on `origin/spec/gear-update` (GU), with the reviews `docs/review/gear-update/review-r1.md`
(F5) and `review-r2.md` (L19, L20). Line numbers are on `d15fba99` unless they say `main:`.

**Verdict: NOT OK.** One HIGH and two MEDIUM findings (H1, M1, M2). Everything else checks out; the list is at the end.

## How I checked

- Read the whole diff (32 files), GU §2, §4–§7, §9–§14, F5, L19 and L20.
- **I ran the real `origin/main` build, not a simulation of it.** I extracted `origin/main` into a scratch folder and
  imported both builds' `save.js`, `store.js` (`saveText`) and `gear.js` side by side in plain Node. The round trips
  run the real old `migrateProfile`, `restoreGearMarks`, `writeGearMarks` and `salvageGear`:
  - **E (today's save):** a save built with main's own code: UR, box-born UR at +4, ✦✦, clubs, Pierce / Aura lines
    and 30 drops. Loaded by main and by the branch.
  - **B (post-update save through an old tab):** Set LR +18 and Blank LR +15 Charms and Shoes, the Nightglass ✦, a
    Tie Pin and Collar Pins, a set Legendary, a Set LR Hair Clip +16 with a club and ✦✦, Necklaces, a spare SR Hair
    Clip, teams and loadouts. The route is new → old → new, done twice.
  - **C (salvage in the old tab):** the old build salvages the LR and pinned pieces. I compared the result with the
    branch's own salvage of the same pieces.
  - **D (exports):** export and import between the two builds.
  - **F:** ▲ placement on 40 Blank LR +18 pieces rerolled with Fortune Dice.
  - **rng:** 15,400 outputs compared: `rollGear` with and without a slot, rerolls and boxes.
- Ran the targeted tests with `nice` (gearSlots, gearUpdateSave, save, gear, gearAwaken, items, rosterSave, salvage,
  gearStats, clubTricks, ascensionSave): 163 of 163 pass. clubTricks hit vitest's 5-second timeout under the machine's
  load (17) and passed with `--testTimeout=60000`.
- Mutation-checked the refund-once guard (see M2).

## Findings

### H1 HIGH: a "piece gone" refund of a new item replaces the player's stock of that item

`src/systems/gearMarks.js:310` runs step 0 (`restoreUpdateMarks`, whose refunds are the Lens at `:259`, the Tie Pin at
`:277` and Collar Pins at `:278` and `:284`) **before** step 1, the `inv:` restore at `:312-315`. Step 1 only fills an
item that is empty: `if (v > 0 && !p.items[id]) p.items[id] = v` (`:314`).

How the loss happens:
1. An older build drops `lens_nightglass`, `tie_pin` and `collar_pin` from `items`, because it does not know them.
2. Step 0 then gives the refund into the empty slot.
3. Step 1 sees the item is no longer empty and does not restore the mirrored stock.

The refund replaces the stock instead of adding to it.

Reproduced with the real old build. The player held 2 Tie Pins, 4 Collar Pins and 1 Lens, plus a Legendary with a
pinned main and one pinned substat. The old tab salvaged that piece. Back in the branch:

| Item | Expected | Got |
|---|---:|---:|
| `tie_pin` | 3 | **1** |
| `collar_pin` | 5 | **1** |
| `lens_nightglass` | 1 | 1 |

With two LR pieces salvaged and 1 Lens held, the result is 2 Lenses instead of 3. This is exactly the F5 case the
"piece gone" rows exist for. Needles are not affected, because older builds know them.

No M0 source makes these items, so no player can hit this until pins and LR ship. It is still a loss in the reader
that every later build carries.

*Fix:* run the `inv:` restore (step 1) before `restoreUpdateMarks`. I tried exactly that move locally: the case above
gives 3 / 5 / 1, and my C1–C3 round trips (old salvage plus the "piece gone" rows equal a new salvage, paid once) pass.
Add a test where the save already holds Lenses and pins when the old build salvages.

### M1 MEDIUM: an LR piece's name grows by one suffix on every trip through an older build

- On main, step 6 calls `urName` on every UR piece (`main:src/systems/gearMarks.js:244`). Main's `urName` knows only
  the UR and Legendary suffixes (`main:src/systems/gear.js:219-224`). So "Keen Pendant of the Nightglass Sakura"
  becomes "… of the Nightglass Sakura of the Rainbow Sakura".
- The branch's `lrName` (`withSuffix`, `src/systems/gear.js:254-263`, called at `gearMarks.js:433`) swaps only the
  last suffix. The result is "Keen Pendant of the Nightglass Sakura of the Nightglass Sakura".
- Each further trip adds one more. The real round trip shows three suffixes after two trips.

This is a stored-data change that compounds and that players see. GU §9.4 counts the open old tab on the same device
as a supported case.

*Fix:* in `withSuffix`, strip every trailing known suffix in a loop, then add the new one. Test it with main's real
`urName` output.

### M2 MEDIUM: the test's "older build" is not the older build, so H1, M1 and L1 pass

`tests/systems/gearUpdateSave.test.js:21-36` (`oldBuild`) deletes fields by hand. It does not run anything main
actually does to such a save:
- step 6 of `restoreGearMarks` (`main:src/systems/gearMarks.js:232-244`): it trims ▲ to `floor(12 / 3)`, calls
  `urName` and recomputes values;
- `writeGearMarks`;
- the old salvage (the test deletes the piece and the marks by hand at `:173-174`).

The LR-salvage test (`:164-186`) also starts with no Lens or pins in stock. As a result:
- `expect(after.gear[uid]).toEqual(before.gear[uid])` (`:160`) passes only because nothing trims ▲ or touches the name;
- H1 cannot show.

GU §13 asks for the *vendored* old `cleanGear`, `cleanUnit` and `restoreGearMarks`. The "faithful to the real old
`save.js`" check in this review's brief fails here.

The refund-once guard is meaningful only through `writeGearMarks`:
- Removing `MARK.lr`, `MARK.night` and `MARK.top` from its prefix list (`gearMarks.js:192`), together with line `:288`,
  fails 2 tests. Good.
- Removing `:288` alone fails nothing. It is redundant, because `writeGearMarks` wipes those keys anyway.

*Fix:* vendor main's `save.js`, `gearMarks.js` and the `gear.js` functions they use. A `git show 60ce9cad:<file>` copy
under `tests/fixtures/` is enough. Then route the round-trip tests through the real old `migrateProfile`, `saveText`
and `salvageGear`, and add stock to the salvage test.

### L1 LOW: an LR piece's ▲ can move to another line after an older build

- Main clamps an LR piece to +12, and its step 6 removes the extra ▲ from the most-grown lines
  (`main:src/systems/gearMarks.js:232-243`).
- The branch's step 6 regrows them on the least-grown line (`gearMarks.js:421-427`).
- The total is kept. But on 39 of 40 Blank LR +18 pieces whose ▲ a Fortune Dice had re-dealt, a ▲ moved to another
  line. For example, `ratePct:3 critDmg:1` came back as `ratePct:2 critDmg:2`.

This follows GA §8.3's "missing ▲ goes to the least-upgraded line" and GU §9.2's "gives back missing ▲". But at +18
that means 2 ▲ per trip, and the M0 test claims the piece comes back equal.

*Fix (optional, recommended):* mirror an LR piece's ▲ per line, for example digits in TUNE_BITS order in `glr:` or in
a key of its own. Restore them before step 6.

### L2 LOW: `gbl:` can name a Hair Clip or Necklace, though the code says it never does

- `enhanceGear` writes `gbl:` for any UR piece below +10 (`src/systems/gear.js:636-639`), so also for a box-born UR
  Hair Clip.
- `gearMarks.js:22-24` and CONTRACTS say that no legacy mark (gbl included) ever names one. GU §9.4 lists `gbl:` too.

It is harmless: main reads `gbl:` only through a `gbx:` key, and that key is never written for these slots. It cannot
happen in M0, and it is what r2's L19 fix proposed. `awakenGear` also writes `gur:` straight away for any slot
(`gear.js:755`), but `writeGearMarks` removes it before any save (`gearMarks.js:192-204`). I confirmed that no legacy
key reaches stored text for a new-slot piece (round trip B).

*Fix:* say in the comments, CONTRACTS and GU §9.4 that `gbl:` is the chosen L19 fix, and add a test. Or keep the 10
paid bits in `gph:` instead.

### L3 LOW: `cleanGear`'s main-stat check is stricter than main's

- On the branch, a main stat must be in its slot's pool (`src/systems/save.js:278`).
- Main accepted any of the eight stats on any slot (`main:src/systems/save.js:260`).

So a classic piece with an off-pool main is now deleted whole. A UR one would even trigger the `gur:` "piece gone"
refund. No code path makes such a piece: `rerollMainStat` validates, and every drop rolls from the pool. The pools are
unchanged in the visible history, and today's-save round trip E finds no difference. But it is the one non-additive
reader change.

*Fix:* keep main's rule for the classic slots, and check the slot pool only for the Hair Clip and the Necklace.

### L4 LOW: a Fortune Dice can keep every line and still charge

`keptIndices` keeps ✦, Nightglass and pinned lines (`src/systems/gear.js:458-459`). `rerollSubstats` (`:510`) has no
floor on how many lines reroll. With LR and pins, all four lines can be kept, and the reroll then takes 3 dice and
coins for nothing. GA R9's "at least 2 lines always reroll" no longer holds once LR and pins exist. This cannot happen
in M0.

*Fix (before M2):* refuse a reroll when fewer than 2 lines would reroll, and offer the Lock Pin only then (GU §6).

## What checks out

1. **Today's save (E):**
   - The real main and the branch load it into identical gear, items, coins and worn pieces, and identical
     `missions.counters`.
   - old → new → old is unchanged.
   - `unitBattleStats` is equal for the three girls with gear, so the co-op loadout carries the same numbers.
2. **rng:**
   - The `rollGear` pin `7b620f9b2671` (`tests/systems/gearSlots.test.js:38`) gives the same hash when run on main.
   - 15,400 compared outputs are identical, except a `Date.now()` stamp: `rollGear` with no slot and with a classic
     slot, rerolls with and without a Lock Pin, Prism Dice, gear boxes and the Rainbow Gear Box.
   - No rng draw is added: the pin paths and `keptIndices` draw nothing on today's pieces, and `subPool` keeps its
     order.
3. **Sim and co-op:**
   - The sim id is `be940ecb2087` and `COOP_PROTOCOL` is 13.
   - No hashed file is touched (`src/sim`, `src/online/coop`, `tools` are unchanged).
   - `BATTLE_CAPS` is unchanged.
   - The profile card sends three pieces (`CARD_FIVE_PIECES` false, `src/online/profileCard.js:33-34`), and an LR
     piece goes out at UR +12 ceilings (`:65-74`).
4. **Exports:**
   - Main's real `deserializeProfile` throws "Newer save" on a branch export.
   - The stored save stays at version 2, and an imported profile is stored as version 2.
   - Main's version-2 export of a mixed save brings everything back in the branch.
5. **New-slot pieces through the real old build (B):**
   - No legacy key names one in stored text.
   - The old build mints nothing on load.
   - Hair Clips and Necklaces come back with exact values, ▲, ✦, the Nightglass ✦, pins, club, lock and wearer.
   - Teams and loadouts come back. Custom team names do not, by design (GU §7.4).
   - The spare SR +0 piece is left out, by design (GU §9.5).
   - A rebuilt piece gets the set's fixed name, by design.
   - `seq.gear` keeps uids from being reused, so a rebuilt piece never collides (`save.js:550-552`).
6. **Old salvage plus the "piece gone" rows (C):**
   - The coins equal the branch's own salvage exactly.
   - A second load pays nothing, and neither does a further trip through the old tab.
   - Only the item stock is wrong (H1).
7. **Salvage and prices:**
   - `salvageRewards` pays the Seed, the Lens, a Needle per ✦ (the Nightglass ✦ included) and every pin.
   - `enhanceInvested` prices +13 … +18 at tier 6 (39,200 … 53,200; 277,200 in all), +11 / +12 at tier 5, and box bits
     as before.
   - On non-LR pieces it is identical to main.
8. **Duplication through mirrors:** I found no path.
   - A present piece always wins over `gph:`.
   - Salvage drops every `gst/glr/gtx/gtp/gph/gpm/gps/gpc` key (`gear.js:708-715`).
   - `writeGearMarks` rewrites them on every save.
   - `tm:` and `gp:` carry no value.
   - `own:<id>:hair` and `own:<id>:necklace` survive main's `writeRosterMark`, which deletes only the classic slots'
     keys.
   - None of the new prefixes collides with an existing counter key (`gl:` promise keys included).
9. **No other games' or anime names** appear in the diff.

## Notes for M2 (not findings)

- `box` is not a field `cleanGear` keeps (`save.js:290-339`). A box-born UR Hair Clip below +10 keeps `ur` only
  through its `gph:` flag 32, which `restoreNewSlotPieces` puts back on every load (`gearMarks.js:170-173`). M2 must
  set `g.box = 1` when it makes one. Write that into CONTRACTS.
- Because L19's first half rides on `gbl:` (L2), salvage of such a piece is priced correctly. Keep it that way.

## Summary

| # | Severity | Finding |
|---|---|---|
| H1 | HIGH | "Piece gone" refunds of the Lens, Tie Pin and Collar Pin replace the stock an older build dropped (step 0 runs before the `inv:` restore; `gearMarks.js:310`, `:314`) |
| M1 | MEDIUM | An LR piece's name gains another "of the Nightglass Sakura" on every trip through an older build (`gear.js:254-263`, `gearMarks.js:433`) |
| M2 | MEDIUM | The test's `oldBuild` is not faithful to main (no step 6, no old salvage, no item stock), which is why H1, M1 and L1 pass (`gearUpdateSave.test.js:21-36`, `:160`, `:164-186`) |
| L1 | LOW | ▲ on a classic LR piece move to the least-grown line after an older build (`gearMarks.js:421-427`) |
| L2 | LOW | `gbl:` can name a new-slot piece (`gear.js:636-639`), against the comments, CONTRACTS and GU §9.4; harmless |
| L3 | LOW | `cleanGear` now deletes a classic piece whose main stat is off its slot's pool (`save.js:278`); main kept it |
| L4 | LOW | A Fortune Dice reroll can keep all lines and still charge once LR and pins exist (`gear.js:458-459`, `:510`) |

**Verdict: NOT OK.** Fix H1, M1 and M2. The LOW findings can follow, but L4 must be fixed before pins ship (M2).
