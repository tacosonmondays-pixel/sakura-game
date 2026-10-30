# Gear update M1 (teams and gear loadouts): independent review, round 2

- Branch `feature/gear-loadouts` at `d4ad186c`. Reviewed `git diff da23fa99 d4ad186c` (r1 reviewed `94b7d3f8`; `da23fa99` adds only M0 changes). The r1 fixes are `82713cec` and `d4ad186c`.
- Spec: `docs/specs/GEAR_UPDATE.md` r3 (`origin/spec/gear-update` `44ba55dc`), §7, §11.1 and §13. H1 is judged against the coordinator's ruling: a piece another loadout borrows carries a "lent" mark and goes home to its owner on a team switch when the new team does not wear it.
- Reviewer: a fresh independent agent that did not build this and did not write r1. Review date: Oct 30.

## What was run

| Check | Result |
|---|---|
| Full `npm test` (vitest) | 389 files pass, 2 skipped (391). 6201 tests pass, 11 skipped. Exit 0. r1's inherited `rosterSave` failure is fixed |
| `node e2e/smoke.mjs` (3 sizes) | ALL SMOKE CHECKS PASSED (678 ok lines) |
| `node e2e/teams.mjs --shots` | 92 ok, 0 FAIL, no page errors at 844×390, 1280×720 and 390×844. The co-op hub chip is now checked at every size, and the e2e fails instead of skipping |
| Sim id | `be940ecb2087`, unchanged. No hashed or sim file is in the diff. `COOP_PROTOCOL` is still 13 and needs no bump. Battle and co-op still read only `profile.formation` and `unit.gear`, and a lent piece is in exactly one girl's `gear` |
| Reviewer probes (temporary, not committed) | Six vitest scenarios on the lent mark (below), plus one Playwright pass at all 3 sizes with toasts hidden. That pass measured Formation, the girl page, Stage Prep and the switch confirm |
| Mutation: Undo's two consistency loops (r1 L7) | now caught by "L7: Undo puts a piece back…" |

## r1 findings

| r1 | Status |
|---|---|
| H1 shared piece lost | **Partly fixed.** The round trip r1 described now works: a team swap through two girls, after a reload, and after an older-build hop through `gp:`. Undo of a return also works. It still fails when the borrower lets the piece go (see r2-H1), and it ping-pongs (see r2-M1) |
| M1 clash note never shows | Fixed. Both squad tiles carry the clash badge, the bar says "1 shared piece", and the switch confirm lists the clashes |
| M2 co-op chip hidden at 844×390 | Fixed. "Team: Bosses" now sits in the Host panel's foot beside Create room at all sizes |
| M3 36 px targets | Mostly fixed. The team chips are 44 px on phones and 48 px on desktop, the loadout chips the same, the Stage chip is 44/48 px, and Undo has a 44 px minimum. Rename and Copy still measure 40 px at 844×390 (r2-L1) |
| L1 copyPreset into worn | Fixed (refused, with a test) |
| L2 stacked Undo toasts | Fixed (`liveUndo` retires the older toast) |
| L3 "to this team" for a loadout | Fixed ("to her Loadout B") |
| L4 bare team name | Fixed ("Team: Bosses") |
| L5 Backpack Salvage | Fixed (the profile is passed in) |
| L6 ragged bar at 390 | Fixed. At 390 px, Rename and Copy are icons on one row beside the chips |
| L7 Undo loops untested | Fixed (the mutation is caught) |
| L8 spec gaps | Recorded in `CONTRACTS.md` |
| L9 `roomTeam` between imports | Fixed |
| L10 patch note and CONTRACTS | CONTRACTS is done. **There is still no patch note** (r2-L2) |

## Findings

### HIGH

**r2-H1. A lent piece is still lost for good when the girl who borrowed it lets it go, including on a team switch.** The cause is in three places:
- `src/systems/teamsSave.js:121` (`wornLoadout`) keeps the mark only while another girl wears the piece. Once the piece is spare, the mark is dropped at the next fold.
- `src/systems/teams.js:351-352`: `selectTeam` calls `syncTeams` (the fold) before `returnLent`, and `returnLent` skips spare pieces anyway (`!g.equippedBy`).
- `usePreset` (teams.js:313) never returns anything.

Reproduced as follows:
1. Team 1 has Aoi on loadout A wearing charm c2. Team 2 has Kage on loadout A, which names c2. Team 3 has Kage on loadout B, which wears charm c3, plus Yuki.
2. Switching to Team 2 takes c2 from Aoi, which is correct. Aoi's loadout marks it lent.
3. Switching to Team 3 puts c3 on Kage, so c2 becomes spare. `returns` is `[]`, and Aoi's mark is gone.
4. Switching to Team 1: `takes` is `[]`, and Aoi has no charm.

The same happens when Kage switches loadout on her girl page, or when the player unequips c2 from Kage by hand. Afterwards c2 is a spare that no loadout names, so multi-salvage takes it without a warning.

This is the r1 H1 failure (a girl's loadout forgets a piece, and it never comes back) on a common path: one girl on different loadouts in different teams is what loadouts are for. The ruling says the piece goes home "on a team switch when the new team doesn't wear it". In step 3 the new team does not wear it, yet it does not go home. The fuzz test does not catch this, because it only checks consistency and never checks that a lent piece comes back.

Fix:
- When a switch or an unequip makes a lent piece spare, put it back on the lender in the same operation, or at least keep the mark while the piece is spare.
- Collect the lenders before `applyStep` and the fold, not after.
- Add the four-step test above, plus the usePreset and unequip variants.

### MEDIUM

**r2-M1. A lent piece ping-pongs between two girls on every unrelated team switch.** `src/systems/teams.js:363-381` (`returnLent`). The mark is symmetric. After c2 goes home to Aoi, Kage's worn loadout marks it as lent to Aoi. Then each switch between Team 3 (Yuki) and Team 4 (Momo) moves c2: Aoi, then Kage, then Aoi, then Kage. Each switch shows the toast "… went back to Kage" or "… went back to Aoi", even though neither girl is on either team. The `moved` set only stops a trade within one switch, so the doc comment's "never trade it back and forth" is false across switches. Nothing is lost or duplicated, but the toast misleads the player, and what an off-team girl wears changes at random.

A related case: after an older build moved c2 to Yuki, both Aoi and Kage carry a mark. Which of them gets c2 back then depends on `Object.entries` order.

Fix: make the mark one-way. Record the owner (the girl a switch took it from) explicitly on the piece or the loadout, and clear the borrower's claim when the piece goes home. This fix also solves r2-H1.

### LOW

- **r2-L1. Rename and Copy are 40 px tall at 844×390** (`[data-testid=team-rename]` and `team-copy`: 124×40 and 104×40). `.tb-btn { min-height: var(--tap) }` (`src/ui/styles/teams.css:16`) loses to the kit's `.btn` sizing on a short landscape screen. Everything else in M1 now measures at least 44 px.
- **r2-L2. There is still no M1 patch note** (r1 L10). It is needed before this reaches `main`.
- **r2-L3. Taking a lent piece back is hidden.** To take it back, the player taps the loadout chip that is already selected (`src/ui/teamBar.js:208`). The note "Ruthless Charm Bracelet lent to Kage" does not say so. Add "tap A to take it back", or make the note a button.
- **r2-L4. On Stage Prep, the switch confirm opens on top of the Team picker**, whose "Switch team" title shows behind it. It is cosmetic, but the picker could close first.

## Look

- **Formation:** the clash badge sits in the tile's top-right and the "B" letter in its top-left, with no overlap. At 390×844 the bar is chips, then the name, then the icon buttons on one row. There is no horizontal overflow at any size.
- **Girl page:** the lent note fits on one line at 844×390. Aoi's charm slot then shows as empty ("+ Equip"), which is honest.
- **Co-op hub at 844×390:** "Team: Bosses", Change stage and Create room share the foot.

## Verdict

**NOT OK.** These must be fixed:
- r2-H1: a lent piece is still lost from the lender's loadout when the borrower lets it go, including on the team switch the ruling covers.
- r2-M1: lent pieces ping-pong between off-team girls on unrelated switches.

Every other r1 finding is fixed, apart from the patch note and 40 px at 844×390. No duplicate pieces and no double wearers were found. Old saves and older-build hops keep the mark. Undo of a return works. The sim id and `COOP_PROTOCOL` are unchanged. Nothing live gets weaker.
