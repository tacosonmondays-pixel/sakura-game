# UI v2 menus M1: Campaign and Stage prep

Boards, all with the `ink` save:

- `m1-board-1.jpg` (844x390): Campaign, stage prep new and cleared, the Counters sheet, an event stage, a saved
  battle's Continue.
- `m1-board-2.jpg` (844x390): Campaign chapter 1, Nightmare on 2-3, the Mode & Freeplay, Drops and "i" sheets.
- `m1-board-3.jpg` (review 1): Sweep unlocked (2-3 with its Hard medal) at 844x390 and 667x375: alone, beside a
  saved battle, beside a saved battle with Freeplay Crimson Moon picked; Nightmare + Crimson Moon; an empty formation.

**Which "before"**: the shots that `e2e/menus.mjs` records for M1 (campaign-ch4, stage-prep-new, stage-prep-cleared)
are the M0 record, built from `f9a2f7a`. The other "before" shots (the inline Counters and Mode panels the sheets
replace, Nightmare on 2-3, the event stage, the saved battle, and the three Sweep states on board 3) are this
milestone's base build, `cb8f395` (the same old stage screen, shot with the same seeding as the "after").

## What changed

- **Stage prep** (UI_DIRECTION 6.3): one screen, no scroll on landscape screens. Left: the map with its plate
  ("4-4 Howl of the Alpha") and tier sticker, the stage ink strip WAVES · ♥ LIVES · START, one mission sentence and
  "i". Right: the 2 x 2 difficulty grid (medal, name, the gems still to earn), the selected difficulty's one rule
  sentence beside the Mode chip, one Counters row ("3/3 ✓"), one Drops row (FIRST beside the first-clear reward, then
  the stage's drops), and the footer: Sweep x1 / x10 as secondary (or one line "Sweep: clear on Hard") and
  Start · <Difficulty>, the one yellow, with room for a cost.
- **Four sheets** (kit sheets, the full height on landscape phones): Counters (each need, the girls who cover it, Add,
  the formation), Drops (chances, quantity ranges, the first clear, medal gems), Mode & Freeplay (Freeplay
  Off · Blossom · Tempest · Crimson Moon first, then the six battle modes with explainers and ribbon state) and "i"
  (the mission text, the chapter mechanic, the enemies with scouting, the map rule, map name and clears).
- **Event stages**: the top bar names the event; the events line (countdown, candy per win) sits under the strip; a
  locked difficulty shows its lock line under its name. **A saved battle**: two lines ("Saved · Hard" with three faces
  of the team / "Wave 12 of 20 · ♥ 33 · 2 h ago") take the mission line's place; New game (secondary) and
  Continue · Wave N/M (yellow); Sweep x10 alone (x1 makes room).
- **Campaign**: a chapter rail that fits the width (number + lock / best medal / progress pips, under the tier
  plates; on upright phones equal tabs that wrap a whole tier to the next row), the chapter panel (tier, name,
  mechanic, cleared count with the medals on an ink plate over the painting), and stage cards as kit tiles (id plate,
  NEXT or the lock chip or a saved battle's badge, the medals on the map's corner plate; name, tier plate, Boss, who
  joins). No yellow: the card is the action.
- Dead stage prep and campaign rules left `meta-a.css` (shared bits for Bounty / Assault / Challenge stay) and
  `modes.css`; the new rules are in `src/ui/styles/v2-stage.css` (classes `.stp-*` and `.cp-*`).

## Review 1: what each finding changed

1. **Footer overlap with Sweep unlocked**: the footer is a grid (the actions take their width, the left side what is
   left) and `fitFooter()` folds the sweeps until they fit: both with words; Sweep x10 alone; "x10" alone; then the
   sweeps (or the "Sweep: clear on Hard" line) move under the stage strip. It re-runs on resize and when the fonts
   load. Freeplay's secondary beside a saved battle is the tier name ("Crimson Moon"). Five new shots cover it (below).
2. **Saved line**: two fixed lines; at most three faces, beside the first line, never over words; the second line's
   parts wrap whole and the dots between them are drawn in CSS, so no line starts or ends with "·".
3. **FIRST**: an ink sticker beside the first-clear reward (the icon is whole), a hairline before the drops.
4. **Mode chip**: with Freeplay on it names the tier with the freeplay glyph ("✦ Crimson Moon ▾"); the chip is never
   clipped (the rule sentence wraps, or the chip takes its own line).
5. **Sheets**: under 480 px of height they take the screen's height less 16 px and the safe areas (with
   `--safe-bottom: 21px` at 844x390 the sheet's top is at 8 px, its X whole); the sheet is "Mode & Freeplay" with
   Freeplay first. The "i" sheet shows the enemies before the map rule.
6. **Empty formation**: the sweeps stay; "Add a girl to your formation to start" takes the rule sentence's place
   (a locked difficulty's note does the same).
7. **Title**: "Campaign" with "4-4 Howl of the Alpha" on the plate; an event stage's title is the event's name.
8. **Tall screens**: the footer sits right under the rows (Start beside the difficulty choice); upright campaign
   rail: equal tabs; the card medals moved onto the map, so every caption keeps one line at 1280.
9. This README and board 3. "Ribbons 0/20" stays inside the Mode & Freeplay sheet at 0: it is a Details layer, where
   the count is the ribbon progress and not a reward to chase (the prep screen itself shows no ribbon count).

## Gate numbers at 844x390 (before -> after)

| Shot | text px | numbers | yellow | cut rules | radius | sideways scroll |
|---|---|---|---|---|---|---|
| campaign-ch4 | 12 -> 12 | 7 -> 2 | 4 -> 0 | 0 -> 0 | 26 -> 0 | yes -> no |
| stage-prep-new (4-4) | 9.92 -> 12 | 15 -> 9 | 2 -> 1 | 3 -> 0 | 14 -> 0 | no -> no |
| stage-prep-cleared (2-3) | 9.92 -> 12 | 13 -> 8 | 2 -> 1 | 3 -> 0 | 21 -> 0 | no -> no |

`node e2e/menus.mjs --milestone m1`: 18 shots x 3 sizes (844x390, 1280x720, 390x844), 0 failing (campaign-ch4 at
1280x720 once hit a 30 s screenshot timeout on the loaded machine; re-run alone: ok). The same 18 at 667x375 and
1024x768 (looked at, not part of the gate): 0 failing (campaign-ch4 at 1024x768 from the run before the
last, the last one timed out on its screenshot; campaign.js did not change between them). New shots: stage-prep-sweep, -sweep-save, -sweep-fp (Nightmare +
Crimson Moon), -sweep-fp-save, -empty (empty formation) and -event-boss (FIRST on the event's candy).

## For the owner to decide

- Battle modes and Freeplay sit behind the Mode chip ("Standard ▾"). Picking one updates the sheet in place; the
  chip and Start name the choice.
- The enemy scouting chips live in the "i" sheet with the mission and the map rule (6.3 names no place for them).
- With a saved battle the footer keeps Sweep x10 only; on the smallest landscape phones the sweeps sit under the
  stage strip.
