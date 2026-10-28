# UI v2 menus M1: Campaign and Stage prep

Boards: `m1-board-1.jpg` (Campaign, stage prep new and cleared, the Counters sheet, an event stage, a saved battle's
Continue) and `m1-board-2.jpg` (Campaign chapter 1, Nightmare on 2-3, the Mode, Drops and "i" sheets). All 844x390, the
`ink` save. "Before" is the base build (cb8f395); the sheets' "before" is the inline panel they replace.

## What changed

- **Stage prep** (UI_DIRECTION 6.3): one screen, no scroll at 844x390. Left: the map with its name plate and tier
  sticker, the stage ink strip WAVES · ♥ LIVES · START, one mission sentence and "i". Right: the 2 x 2 difficulty grid
  (medal, name, the gems still to earn), the selected difficulty's one rule sentence beside the Mode chip, one
  Counters row ("3/3 ✓"), one Drops row (up to 5 icons, FIRST on the first-clear reward), and the footer: Sweep x1 / x10
  as secondary (or one line "Sweep: clear on Hard") and Start · <Difficulty>, the one yellow, with room for a cost.
- **Four sheets** (kit sheets): Counters (each need, the girls who cover it, Add, the formation), Drops (chances,
  quantity ranges, the first clear, medal gems), Mode (the six battle modes with explainers and ribbon state, then
  Freeplay Off · Blossom · Tempest · Crimson Moon with its explainer and best waves) and "i" (the full mission text, the
  chapter mechanic, map name and clears, the map rule, the enemies with scouting).
- **Event stages** keep their events line (event, countdown, candy per win) under the strip; a locked difficulty shows
  its lock line under its name. **A saved battle**: its line takes the mission line's place; New game (secondary) and
  Continue · Wave N/M (yellow).
- **Campaign**: a chapter rail that fits the width (number + lock / best medal / progress pips, under the tier
  plates), the chapter panel (tier, name, mechanic, cleared count with the medals on an ink plate over the painting),
  and stage cards as kit tiles (id plate, NEXT or the lock chip or a saved battle's badge, name, tier plate, medals).
  No yellow: the card is the action.
- Dead stage prep and campaign rules left `meta-a.css` (shared bits for Bounty / Assault / Challenge stay) and
  `modes.css`; the new rules are in `src/ui/styles/v2-stage.css` (classes `.stp-*` and `.cp-*`).

## Gate numbers at 844x390 (before -> after)

| Shot | text px | numbers | yellow | cut rules | radius | sideways scroll |
|---|---|---|---|---|---|---|
| campaign-ch4 | 12 -> 12 | 7 -> 2 | 4 -> 0 | 0 -> 0 | 26 -> 0 | yes -> no |
| stage-prep-new (4-4) | 9.92 -> 12 | 15 -> 9 | 2 -> 1 | 3 -> 0 | 14 -> 0 | no -> no |
| stage-prep-cleared (2-3) | 9.92 -> 12 | 13 -> 8 | 2 -> 1 | 3 -> 0 | 21 -> 0 | no -> no |

`node e2e/menus.mjs --milestone m1`: 12 shots x 3 sizes (844x390, 1280x720, 390x844), 0 failing.

## For the owner to decide

- Battle modes and Freeplay now sit behind the Mode chip ("Standard ▾"). Picking one updates the sheet in place; the
  chip and Start name the choice.
- The enemy scouting chips moved into the "i" sheet with the mission and the map rule (6.3 names no place for them).
- With a saved battle, the footer keeps Sweep x10 only (x1 makes room for New game and Continue).
