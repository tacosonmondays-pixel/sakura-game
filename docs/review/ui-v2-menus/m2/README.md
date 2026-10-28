# M2: the Backpack and the gear grid (UI v2 "Ink & Paper")

Boards (844x390, before on the left, after on the right):
- `m2-board-1.jpg`: All tab, Equipment (the mock-up save), Equipment with 30 pieces, the item sheet, salvage mode.
- `m2-board-2.jpg`: the new Supplies and Filter sheets (before: what used to sit on the page), the SSR Select Ticket,
  the Craft Room, the end of the 30-piece list.

## What changed
- **Rail:** ALL · ENHANCE · AWAKEN · GEAR · TICKETS · TOKENS, one word and a line glyph each, red dots instead of counts
  (GEAR when a box can be opened, TICKETS when an SSR Select Ticket waits). It shares the width, so it never scrolls
  sideways (it did on every tab). On an upright phone only the open tab keeps its word.
- **Toolbar:** Filter and Sort (secondary buttons) on the item tabs; Supplies ▸ (red dot) · Filter · Sort ("Best first")
  and Salvage (danger) on GEAR. The bag capacity only shows from 90 % full.
- **GEAR opens on the gear:** a grid of 96 px gear tiles (104 px on desktop): +level bottom right, the main stat icon
  top right, the wearer's face bottom left, the rarity frame of the 5.6 ladder (UR rainbow ready), square corners.
  One number a tile. Tap a tile: the existing gear card (enhance, awaken, reroll, lock, salvage), as before.
- **Supplies sheet:** the gear boxes (Open, Open ×10, Open all; the Rainbow box through its slot picker) and the gear
  tools (Fortune Dice, Lock Pin, Prism Dice, Seed, Needle, Armband) with one line each and Use where it applies.
- **Filter sheet:** rarity and slot as kit options, then main stat, substat and show. **Sort sheet:** one choice.
- **Salvage mode:** the rail steps aside; Filter · Select all · Done; a tile shows its main stat value; picks wear the
  kit's selected-tile marks; protected pieces go grey (a lock on locked ones); an ink salvage bar under the grid.
- **Item sheet:** a kit bottom sheet: tile, rarity tag, owned, the text, who uses a material, "Where to get" rows with
  secondary Go buttons (was four yellow Teleports), Use / Craft Room. At most one yellow (Use on a ticket).
- **SSR Select Ticket:** kit girl tiles (SSR glow, UR rainbow, a check chip on girls you have) in the kit dialog.
- **Craft Room:** a kit sheet: one row per recipe (in → out, the price with the colour coin, one ink action),
  kit options for the quantity and the family.

## Gate numbers (844x390)
| | before (plan §3 audit) | after |
|---|---|---|
| Rail | scrolls sideways on every tab | fits, no sideways scroll |
| Smallest text | 10.08 px (tabs) / 11.2 px (Equipment) | 12 px |
| Taps under 44 px | 12-14 (tabs), 22 (Equipment), 23 (salvage) | 0 (the smallest 45.5 px) |
| Numbers on screen (top bar counted) | 7-9; item sheet 17 | 2 on every tab; item sheet 7 |
| Yellow fills | item sheet 4 | 0 on the item sheet (1 only on Use) |
| Equipment, 30 pieces: whole tab | 128 numbers over 6.36 screens, no gear in the first screen, up to 6 numbers a card | 27 numbers over 1.95 screens, 14 whole tiles in the first screen, 1 number a tile |
| At 1280x720 | 128 numbers, 2.3 screens | 27 numbers, the whole bag in one screen (10 a row) |

## For the owner to decide
- The gear card a tile opens is still the old card in a dialog. The girl page's new piece sheet (M3) takes it over;
  M2 only opens it.
- The Use buttons under usable items (SSR Select Ticket, Seed, Needle, Armband) stay on the grid as ink buttons, so
  the old one-tap path remains; the item sheet has Use too.
