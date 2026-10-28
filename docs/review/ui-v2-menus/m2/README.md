# M2: the Backpack and the gear grid (UI v2 "Ink & Paper")

Boards (844x390 at full size, one pair per row: BEFORE above AFTER):
- `m2-board-1.jpg`: the All tab; Equipment (the mock-up save).
- `m2-board-2.jpg`: Equipment with 30 pieces; salvage mode with picks.
- `m2-board-3.jpg`: the item sheet (Study Guide); the item sheet of a material (Celestial Pinion).
- `m2-board-4.jpg`: the new Supplies sheet (before: the boxes and dice on the page); the new Filter sheet (before: the
  dropdowns on the page).
- `m2-board-5.jpg`: the SSR Select Ticket; the Craft Room.
- `m2-board-6.jpg`: an item whose places carry long notes (Akashic Tome); an item with many places (Fortune Dice).

## What changed
- **Rail:** ALL · ENHANCE · AWAKEN · GEAR · TICKETS · TOKENS, one word and a line glyph each, red dots instead of counts
  (GEAR when a box can be opened, TICKETS when an SSR Select Ticket waits). It shares the width, so it never scrolls
  sideways (it did on every tab). On an upright phone only the open tab keeps its word.
- **Toolbar:** Filter and Sort (secondary buttons) on the item tabs, only when the tab holds more than one item (an
  empty tab has no toolbar band at all);
  Supplies ▸ (red dot) · Filter · Sort ("Best first") and Salvage (danger) on GEAR. The bag capacity only shows from
  90 % full. On an upright phone Filter, Sort and Salvage keep their glyph only, so the toolbar is one row.
- **GEAR opens on the gear:** a grid of 96 px gear tiles (104 px on desktop): +level bottom right, the main stat icon
  top right, the wearer's face bottom left, the rarity frame of the 5.6 ladder (UR rainbow ready), square corners.
  One number a tile. Tap a tile: the existing gear card (enhance, awaken, reroll, lock, salvage), as before.
- **Supplies sheet:** the gear boxes (Open, Open ×10, Open all; the Rainbow box through its slot picker) and the gear
  tools (Fortune Dice, Lock Pin, Prism Dice, Seed, Needle, Armband) with one line each and Use where it applies.
- **Filter sheet:** rarity and slot as kit options, then main stat, substat and show. **Sort sheet:** one choice.
- **Salvage mode:** the rail steps aside; Filter · Select all · Done; a tile shows its main stat value; picks wear the
  kit's selected-tile marks; protected pieces go grey (a lock on locked ones); an ink salvage bar under the grid.
- **Item sheet:** a kit bottom sheet: tile, rarity tag, owned, who uses a material and the actions (Use / Craft Room)
  in one row, the text, then "Where to get · N": up to eight places as before, each with a secondary Go button and its
  drop chance (a short chance as a small grey suffix, a longer note on its own wrapping line under the place). The old
  dialog drew a yellow Teleport on every source row (two on this board's Study Guide, up to eight); now there is at most
  one yellow (Use on a ticket). When the sheet cannot show every place, the list scrolls on its own in whole rows, its
  last row fades a little and the heading says how many more ("5 more ▾").
- **The sheets** take the height they need: on a landscape phone up to the screen minus 16 px and the safe areas
  (a notched phone keeps the sheet's head in view), on taller screens up to 640 px (the kit's 60 % was too short).
- **SSR Select Ticket:** kit girl tiles (SSR glow, UR rainbow, a check chip on girls you have) in the kit dialog, with
  the ticket count; on a landscape phone (844x390 and 667x375) all ten in two whole rows.
- **Craft Room:** a kit sheet: one row per recipe (in → out, the price with the colour coin, one ink action),
  kit options for the quantity and the family.

## Gate numbers (844x390; before = the gate's own before file, e2e/shots/before/m2.json)
| | before | after |
|---|---|---|
| Rail | scrolls sideways on every tab | fits, no sideways scroll |
| Smallest text | 10.08 px (tabs) / 11.2 px (Equipment) | 12 px |
| Taps under 44 px | 13-14 (tabs), 22 (Equipment), 3 (salvage; the smallest 17 px) | 0 |
| Numbers on screen, top bar counted (`e2e/menus.mjs`) | 8-11 on the tabs (All and Enhance 11); item sheet 18 | 2 on every tab; item sheet 4 |
| Yellow fills on the item sheet | 3 (probe), a Teleport per row | 0 (1 only with Use) |

`node e2e/menus.mjs --milestone m2`: every shot passes at 844x390, 1280x720 and 390x844.

**The whole Equipment tab with 30 pieces** (the `seedGearMany` save). The menus gate counts numbers outside repeated
tiles only (P3 budgets a tile on its own), so it reads "2" (the top bar) on every gear shot. The whole-tab figure was
measured separately with a page script: every visible text node with a digit inside `#app`, the tiles' +level badges
included, and the scroll height of the screen body over its visible height:

| | before | after |
|---|---|---|
| 844x390 | 128 numbers over 6.36 screens, no gear in the first screen, up to 6 numbers a card | 27 numbers over 1.95 screens, 14 whole tiles in the first screen, 1 number a tile |
| 1280x720 | 128 numbers over 2.3 screens | 27 numbers in one screen (10 tiles a row) |

## For the owner to decide
- The gear card a tile opens is still the old card in a dialog. The girl page's new piece sheet (M3) takes it over;
  M2 only opens it.
- The Use buttons under usable items (SSR Select Ticket, Seed, Needle, Armband) stay on the grid as ink buttons, so
  the old one-tap path remains; the item sheet has Use too.
- The sheets reach nearly the screen's full height on a landscape phone and up to 640 px on taller screens (the kit's
  60 % was too short to show their actions). The kit lane may want this for every sheet.
- On the smallest landscape phones (667x375) the SSR Select Ticket keeps only its first sentence ("Choose any SSR
  student (tickets: N).") so both rows of girls stay whole; the Essence rule is said in the confirm step.
