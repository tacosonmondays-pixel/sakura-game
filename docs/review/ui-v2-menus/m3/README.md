# M3: the roster and the girl page (UI v2 "Ink & Paper", V3)

Boards (844x390, before on the left, after on the right; before = the base build f9a2f7a on the same `ink` save):
- `m3-board-1.jpg`: Students, the hold sheet (Info, and Ruri's Build tab), her page on Info, Level.
- `m3-board-2.jpg`: Gear, the slot sheet (the piece she wears beside its picker), the Backpack's piece sheet (spare
  mode; before: the old gear dialog), Tree, Formation.

## What changed
- **Girl tiles wherever a girl is picked** (`girlTile()` in `components.js`: Students, Formation's squad and pick grid,
  the Sandbox squad picker, the outfit sheet): her art framed so every eye line sits at one height, the 5.6 frame
  ladder (R flat, SR tinted, SSR glow, UR the turning rainbow with its glints), her name and LV on the ink caption, the
  P pill top left (P2 and up), her role family's line glyph top right, a locked girl grey with how she joins. Two
  numbers at most a tile, square corners.
- **Students:** one 44 px row: All · Owned · Locked, the sort (a native select, so a phone opens its own picker), its
  direction, Filter (a red dot while on). The inline filter panel became a kit sheet (Role, Attack, Rarity and Water;
  a tap applies at once). "Recruited 21/35" is the one count; "Shown N" joins it only while a filter hides girls.
- **The girl page:** folder tabs on the content panel (S4, a full tap tall), her name on the night nameplate over her
  art (`.ui-np`: name, title, Power, LV, stars, the P sticker), ink-glass circles for prev / next, Outfit and 3D. The
  tabs' sections lie flat in the one folder panel (a kicker heads each, a hairline parts them).
  - **Info:** the role row, then a fixed slot for `feature/abilities`' ⚡ ability line (pre-styled, `.gp-abil`), the
    ink strip, Matchup | Potential (the Potential row as it is, for M4), capabilities, her quote.
  - **Level:** on a landscape phone LV, the EXP line and the cap share a row; the bar; Manual · Auto select · Level up.
    Manual's steppers are 46 px and its book tiles a full tap. The gate card puts its title beside the pips and its
    requirement chips beside Break through, so the tab fits its window without a scroll.
  - **Awaken:** the star row, the next star, her passive, then the cost and Awaken.
  - **Gear:** three slot columns drawn with M2's gear tile (square, the 5.6 ladder), the totals strip. A slot opens the
    **slot sheet**, now the kit's day sheet with the bleed ink head (the piece she wears, its strip and actions, and the
    picker = M2's gear grid). Gear totals, a piece's Details, base stats and the profile are Details sheets of flat kit
    rows.
  - **Tree:** every cell's hit at 46 px by padding only (the grid's own look is shared with the battle tree and waits
    for the ultimates merge, as planned); a hero's track band as flat rows.
  - **Outfits:** a kit sheet; each outfit a girl tile (the one she wears selected, a 3D chip on the 3D ones), Try on
    and an ink Wear (the page keeps its one yellow).
- **The Backpack's piece sheet** (M2 left it "the M3 sheet; the Backpack only opens it"): the slot sheet's piece pane
  as a kit sheet: tile and tags, the strip (the main stat and the two best substats; Details › for every line and the
  next growth), the actions (Enhance the one yellow, ✦ Awaken, rerolls, Stitch, Club, Lock) with Salvage (a second tap)
  or "Open <her>" at the end of the primary's row. **Hold the strip to compare** with the squad's piece of that slot
  (a worn piece: the best spare): ▲ / ▼ ride under its numbers while it is held; a hint line says so.
- **The hold sheet** (hold any girl): the kit's day sheet, her art under the night nameplate, folder tabs (Build ·
  Info · Tree) on an ink strip that also holds Full page ▸ and ✕, every hit 46 px. The Build tab in the kit (flat
  sections, square cells, the stats on one ink plate, rarity on ink pills). Over a battle ("Her info") the sheet keeps
  its old frame, as every battle surface does for now.
- **Formation:** the squad as a row of girl tiles (the hero, then eight), Clear · Add counters · Go to 4-4 (the one
  yellow), the stage's counter needs as kit rows, the pick grid of girl tiles (the squad's own are the selected tiles,
  a girl who covers a missing need carries its icon).
- **An upright phone:** Info and Tree in one column, only the open tab keeps its word (the others their glyph), the
  slot tiles fit three across, the hold sheet's strip never wraps.

## Gate numbers
| Shot (844x390) | smallest text px | numbers (top bar counted) | taps under 44 (smallest) | rounded corners | yellow fills |
|---|---|---|---|---|---|
| Students | 11 → 12 | 2 → 1 | 6 → 0 (40.5 → 45.75) | 24 → 0 | 0 |
| Students, end of the list | 12 | 0 | 6 → 0 (40.5 → 45.75) | 24 → 0 | 0 |
| Hold sheet (Info) | 11 → 12 | 8 → 7 | 3 → 0 (40.5 → 44.5) | 30 → 0 | 0 |
| Hold sheet (Build, Ruri) | 12 | 14 | 0 (45) | 0 | 0 |
| Filter sheet | 12 | 1 | 0 (45.75) | 0 | 0 |
| Girl page · Info (Aoi) | 12 | 10 | 7 → 0 (21.75 → 44.5) | 3 → 0 | 0 |
| Info (Ruri) | 12 | 10 | 7 → 0 (21.75 → 44.5) | 3 → 0 | 0 |
| Info (Aoi, NEW outfit) | 12 | 10 | 7 → 0 (21.75 → 44.5) | 3 → 0 | 0 |
| Info, scrolled to the end | 12 | 10 | 6 → 0 (21.75 → 44.5) | 4 → 0 | 0 |
| Level | 12 | 12 | 8 → 0 (21.75 → 44.5) | 16 → 0 | 0 |
| Level, Manual open | 12 | 17 → 18 | 15 → 0 (21.75 → 44.5) | 18 → 0 | 0 |
| Awaken | 12 | 13 → 12 | 8 → 0 (21.75 → 44.5) | 7 → 0 | 0 |
| Gear | 12 | 8 | 6 → 0 (21.75 → 44.5) | 9 → 0 | 0 |
| Gear, nothing worn | 12 | 5 | 6 → 0 (21.75 → 44.5) | 9 → 0 | 0 |
| Gear slot sheet | 12 | 13 → 12 | 8 → 0 (23.75 → 44.5) | 14 → 0 | 1 |
| Slot sheet, the picker | 12 | 13 → 12 | 8 → 0 (23.75 → 44.5) | 14 → 0 | 1 |
| Gear totals (Details) | 12 | 19 | 1 → 0 (43.25 → 48.5) | 15 → 0 | 0 |
| Base stats (Details) | 12 | 24 | 0 (48.5) | 0 | 0 |
| Profile (Details) | 12 | 10 | 0 (48.5) | 0 | 0 |
| Tree | 12 | 6 | 21 → 0 (21.75 → 44.5) | 3 → 0 | 0 |
| Tree, a hero (track band) | 12 | 10 | 6 → 0 (21.75 → 44.5) | 7 → 0 | 0 |
| Outfit sheet | 12 | 11 → 10 | 2 → 0 (34.75 → 46.75) | 5 → 0 | 0 |
| Formation | 12 | 4 | 4 → 0 (30 → 45.75) | 12 → 0 | 1 |
| Formation, the pick grid | 11 → 12 | 2 | 2 → 0 (40.5 → 45.75) | 17 → 0 | 1 → 0 |
| Backpack piece sheet (spare) | 12 | 7 | 0 (44.5) | 0 | 1 |
| Info, Detailed look | 12 | 14 | 0 (44.5) | 0 | 0 |
| Level, Detailed look | 12 | 18 | 0 (44.5) | 0 | 0 |
| Awaken, Detailed look | 12 | 16 | 0 (44.5) | 0 | 0 |
| Gear, Detailed look | 12 | 15 | 0 (44.5) | 0 | 0 |
| Tree, Detailed look | 12 | 6 | 0 (44.5) | 0 | 0 |

At 1280x720 and 390x844 the same shots pass the same checks (desktop floor 13 px; every tap 45.75 px and up; no
rounded corners; one yellow at most). Before → after there: Students 12 → 13 px text and 35 → 0 rounded corners
(1280x720), 11 → 13 px and 22 → 0 (390x844); the hold sheet 41 → 0 and 28 → 0 rounded corners; the girl page's
smallest tap 22.75 → 48.5 px (1280x720) and 22.75 → 45.75 px (390x844).

`node e2e/menus.mjs --milestone m3` (30 shots: M0's list of 20 and 10 new: the hold sheet's Build tab, the Filter
sheet, Base stats, Profile, the Backpack's piece sheet, and the Detailed look on all five tabs): every shot passes at
844x390, 1280x720 and 390x844. Extra looks at 667x375, 915x412 and 1024x768 (`e2e/ui-shots.mjs --screens
m3`) were read by eye.

## For the owner to decide
1. **A girl tile shows her rarity by its frame alone** (the 5.6 ladder; UR is the turning rainbow ring with its
   glints): the old cards also wrote "SR" / "SSR" / "UR" in a corner. The tile keeps two numbers (LV, P) and the role
   glyph. If the letters should come back, the kit's ink rarity pill fits the caption.
2. **The Backpack's piece sheet shows the main stat and the two best substats**; the rest of its lines and the next
   growth moved behind Details › (P7). Holding the strip compares the piece with the squad's piece of that slot: a new
   gesture, said once by the hint line under the strip.
3. **Level with Manual open has its own budget, 22** (the plan budgets Level with Manual closed, 12, and that holds):
   open, every book shows its EXP and the count picked (18 numbers at 844x390, where all five books now fit; 22 at
   1280x720 with the gate card in view; 17 and 23 before).
4. **Outfits: Wear is an ink button**, so the girl page keeps its one yellow (Level up, Awaken or Enhance).
5. **The hold sheet over a battle** ("Her info") keeps its old frame, like every battle surface for now; its Build
   tab's content wears the kit there too (one stylesheet).
6. **An upright phone keeps only the open tab's word** in the folder tabs (the others their glyph and an aria-label),
   as M2's Backpack rail does.
7. **Wording:** the gate note now reads "Reach her level cap first — you can gather materials now." (the cap is in
   the title just above), the Awaken cost panel's kicker is "Cost" (the star is in "Next ★N" above), the outfit note
   says "her chibi model" (was "her 3D chibi"): each drops a figure said twice.

## Not in M3
- The tree grid's own look (`tree-grid.css`, `treeGrid.js`, shared with the battle tree) waits for the ultimates
  merge, as planned; M3 only pads its cells to 46 px hits and lays out the page around it.
- The ⚡ ability line: `.gp-abil` is styled for `feature/abilities`' `abilityInfoView` (a kit row under the role
  sentence); the element comes with that merge.
- The Potential row and sheet stay as they are for M4 (the Board); the Students sort has a slot for M4's Growth sort.
- Stage prep (M1) still draws its own square cards; the Profile showcase (M7a) its own slots. The Sandbox squad
  picker takes the girl tile through `unitCard()`.
