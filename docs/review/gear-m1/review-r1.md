# Gear update M1 (teams and gear loadouts): independent review, round 1

- Branch `feature/gear-loadouts` at `94b7d3f8`. Only the M1 part was reviewed: `git diff 0de56c76 94b7d3f8`. `0de56c76` is M0 (`feature/gear-m0`), which is reviewed separately.
- Spec: milestone M1 of `docs/specs/GEAR_UPDATE.md` (r2, `origin/spec/gear-update`), §7, §11.1 and §13.
- Reviewer: an independent agent that did not build this. Review date: Oct 30.

## What was run

| Check | Result |
|---|---|
| `vitest` teams, salvage and missionCounters | 29/29 pass |
| `vitest` gearUpdateSave, save and rosterSave | 62/63. The one failure, `rosterSave` "a mark reads back as level…", also fails on `0de56c76`, so M1 inherited it from M0 |
| Sim id | `be940ecb2087`, unchanged. No hashed or sim file is in the diff. `COOP_PROTOCOL` is still 13 and needs no bump |
| Reviewer fuzz (temporary and not committed) | 80 seeds × 60 random steps. The steps were usePreset, selectTeam, Undo, copyPreset, copyTeam, clearTeam, equip, unequip, single salvage, multi-salvage, formation edits, a reload every 15 steps, and an older-build hop every 20 steps (it drops `teams`/`presets`, salvages a spare and equips a piece, then the new build loads the save). Across all of it, no piece was worn by two girls, no `equippedBy` was left dangling, no piece was lost or duplicated outside a salvage, `formation` always matched the active team, and `gear` always matched `presets[preset]` |
| Mutation: the clash claim in `planLoadouts` (teams.js:197) | caught by "two members naming one piece" |
| Mutation: equipGear's take from the previous wearer (gear.js:421) | caught by "pieces move, never copy" |
| Mutation: Undo's two consistency loops (teams.js:276-277) | **survives** the suite, and the fuzz as well (see L7) |
| `e2e/teams.mjs` | 844×390: all ok, plus the co-op skip (see M2). 390×844: all ok, including the co-op hub. 1280×720: every check passes, but with `--shots` the Stage Prep screenshot timed out twice at 30 s on this loaded machine (a capture problem, not a product one) |
| Extra screenshots | Formation, the girl page Gear tab, Stage Prep, its Counters sheet, and the team picker at all 3 sizes, with transient toasts hidden. Edges and corners were checked zoomed in |
| Names | the added lines contain no other game's or anime's name |

## Findings

### HIGH

**H1. A piece shared by two teams through two different girls never comes back. The girl it was taken from loses it from her loadout for good.** `src/systems/teams.js:89` (`foldGear`: `u.presets[u.preset] = { ...u.gear }`), together with `equipGear` emptying the previous wearer's slot (`src/systems/gear.js:421`, called from `applyStep` at teams.js:294). M0's `restoreTeams` applies the same rule at `src/systems/teamsSave.js:162`.

Reproduced as follows:
- Team 1 has Aoi on loadout A wearing Keen Charm. Team 2 has Kage, whose loadout A names the same charm.
- Switching to Team 2 says "Takes Keen Charm from Aoi". Aoi's worn loadout A is then folded to an empty charm slot.
- Switching back to Team 1 gives Aoi nothing, and the charm stays on Kage.
- If the player puts the charm back on Aoi by hand, the reverse happens: Kage's loadout A loses it, and the next switch to Team 2 has `takes: []` and leaves Kage with no charm.

So "a piece named by two loadouts moves when one is put on" (§7.2) only holds while the girl losing the piece is on an inactive loadout. With teams, the members of other teams are almost always wearing their active loadout (A by default), so moving a piece back and forth between teams fails in the most common case. "A team remembers each member's loadout" is the headline of M1, and sharing your best pieces between teams is the main reason to have loadouts. Nothing is duplicated or lost; the failure is in the remembering.

The tests only cover the same girl across two teams ("switching teams swaps…"), which works.

Fix direction (this needs a short spec decision, because §7.2/§7.4 state `unit.gear === presets[preset]`):
- Let a worn loadout keep naming a piece that a switch took from her, for example as a "lent" mark or by relaxing the invariant to "or null while another girl wears it". Then `selectTeam`/`usePreset` reclaim it the next time that loadout or team is put on, with the same "Takes … from Kage" list.
- `restoreTeams` (M0) must keep the mark too.
- Add a test for exactly the round trip above, and include two-girl sharing in the e2e.

### MEDIUM

**M1. Formation's clash note can never appear.** `src/ui/teamBar.js:114` calls `teamClashes(profile, t)` with the active team, at `src/systems/teams.js:230-241`. For the active team, `syncTeams` makes each member's `use` equal the loadout she wears (teams.js:101-104), and worn loadouts are disjoint, so the map is always empty. §7.3 says "the editor marks both" two members who name the same piece. In practice a clash only surfaces in the toast after a switch. By then the losing girl's loadout has been folded and no longer names the piece (the same root cause as H1), so even that information is gone. The unit test only checks `teamClashes` on an inactive team. Fix: show the clashes of the team the player is about to switch to (for example on the chip, or in the switch confirm, even when nothing is taken). Also mark both members' tiles, as the spec says.

**M2. At 844×390, the first target size, the co-op hub has no "You bring Team N" line and no team chip.** `bringLine()` (`src/ui/screens/coop.js:282`, placed at `:472`) sits inside `.ol-coop-intro`, which `src/ui/styles/online.css:526` hides under `@media (max-height: 480px)` (`:499`). The e2e treats this as "skip 844x390 co-op hub (offline in this run)" (`e2e/teams.mjs:95`). In fact the hub is online. `waitForSelector` waits for a visible element and times out on the hidden intro. The builder's soft skip therefore hides a real gap: on a landscape phone the player cannot see or switch the team they bring before they open a room. The room's own line at `coop.js:1117` does show. Fix: move the bring line and its chip out of the intro (for example into the Host panel's foot, beside Create room). Make the e2e fail rather than skip when `[data-testid="coop-bring"]` is attached but hidden.

**M3. The new tap targets are 36 px, under the kit's `--tap` (44 px on phones, 48 px otherwise; `src/ui/styles/base.css:85,196`) and under this review's 44 px bar.** `src/ui/styles/teams.css:8` (`.ui-opt.tb-chip { --h: 36px }`) overrides `.ui-opt`'s `--h: var(--tap)`. Lines `:16` (Rename and Copy), `:20` (the "Copy A → B" ghost), `:27` (the Team chip beside Start) and `:43` (Undo inside a 4.2 s toast) do the same. All of them measure 36 px at 844×390, 390×844 and 1280×720. The spec's "rows ≥ 36 px" is about rows; these are primary touch controls. Undo matters most, because it has a short life and sits on a moving toast. Fix: use `var(--tap)` (or at least `var(--tap-dense)`, 40 px) on touch layouts. The Stage Prep row still fits: Start is about 56 px tall.

### LOW

- **L1. `copyPreset` into the worn loadout returns `ok` and changes nothing.** `src/systems/teams.js:383-401`. `planPreset` calls `syncTeams` first, so `foldGear` (:89) overwrites the copy with what she wears. The UI cannot reach this today, because "Copy" always goes to the next loadout, never the worn one (`teamBar.js:204`). Either guard it with `to !== u.preset`, or apply the copy before the fold.
- **L2. Undo toasts stack, each with its own stale snapshot.** `src/ui/teamBar.js:43-60`. At 390×844, "Team 1 is on" and "Loadout B added" were both on screen with live Undo buttons. Tapping the older one also reverts the newer change. The invariants hold (fuzz), but the result surprises the player. A new Undo toast should retire the older ones.
- **L3. The takes list says "These pieces move to this team:" for a single girl's loadout switch too.** `src/ui/teamBar.js:31`. Say "to her Loadout B" in that case.
- **L4. The Stage Prep chip shows only the team's name.** `src/ui/teamBar.js:160-166`. A renamed team reads "BOSSES" next to Start, which looks like a bosses button (seen at 844×390 and 1280×720). Add a "Team" kicker, or keep "Team 1 · Bosses".
- **L5. The Backpack's Salvage button ignores the loadout block.** `src/ui/screens/backpack.js:436`: `salvageBlock(g)` is called without the profile, so the button shows when the only spare pieces are ones a loadout names. Every tile is then blocked.
- **L6. At 390×844 the Formation team bar wraps into three ragged rows**, with the name and Rename on one row and Copy alone on the next (`src/ui/styles/teams.css:4`). Put Rename and Copy on one row, or use icon buttons, on narrow widths.
- **L7. Undo's consistency loops are untested.** `src/systems/teams.js:276-277`: commenting them out keeps all tests green, and the fuzz too, so they look unreachable today because snapshots are consistent. Either add a test (for example, a girl recruited and equipped inside the Undo window) or drop the loops.
- **L8. Spec gaps to record.** The in-room team switch "until Ready" (§7.3) is deferred to M2's protocol bump (`coop.js:277-281`). Clear works on the active team only (`clearTeam` has no UI). Stage Prep with a saved battle shows no Team chip beside New game and Continue (`src/ui/screens/stage.js:938-974`). Note all three in the spec or HANDOFF, so the owner sees them.
- **L9. `let roomTeam = null;` is declared between import statements** (`src/ui/screens/coop.js:47-49`). It is legal but untidy; move it below the imports.
- **L10. M1 has no patch note yet** (the spec's line: "Save up to 5 teams and up to 3 gear loadouts per girl"), and `CONTRACTS.md` has no teams/presets entry. Both are needed before this ships.

## Look (Ink & Paper)

- **Formation:** the slanted team chips with the pink underline, and Rename and Copy, match the kit at all 3 sizes. There is no horizontal overflow, and the "B" badge sits cleanly in the squad tile's top-left corner.
- **Girl page Gear tab:** "Loadout A · B · +C · Copy A → B" fits on one line at 390, 844 and 1280.
- **Stage Prep:** Start stays on screen without scrolling at all three sizes. The Counters sheet's Team row fits.
- **Modals:** the takes modal and the team picker modal are clean, with no cut-off text.
- **Toasts:** transient toasts (the lesson pill, achievements, Undo) cover the team bar or the difficulty buttons for a few seconds. This is the project's known toast issue, and M1 adds more of these toasts (L2).

## Verdict

**NOT OK.** These must be fixed:
- H1: a piece shared across teams by two girls is lost from the losing girl's loadout and never comes back.
- M1: the clash note never shows, and the editor does not mark both members.
- M2: the co-op hub team line and chip are hidden at 844×390, and the e2e calls that "offline".
- M3: the new tap targets are 36 px, under 44.

The no-duplicate, no-loss and single-wearer guarantees hold under fuzzing, salvage, Undo and older-build round trips. Co-op sends the active team. Tryout Day and Sandbox only read the formation as a default and keep their own squads. The sim id is unchanged.
