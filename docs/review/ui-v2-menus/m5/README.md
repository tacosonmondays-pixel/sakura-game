# UI v2 menus M5: hubs and hosts (V4)

Boards (844x390, before on the left, after on the right):
- `m5-board-1.jpg`: Missions, Commissions Daily and Login, Achievements, Bounty
- `m5-board-2.jpg`: Titan Trials, Mailroom, Happening Now, Multiplayer

## What changed
- **Kit:** `hubTile()` in `src/ui/kit.js` (the kit's `.ui-hubtile`: painted art over an ink caption band, kicker, title,
  one line, a top-right corner for a countdown chip or badge, a sticker, a designed locked state). Its extra parts
  (drawn art, the line, the lock) are styled in `src/ui/styles/v2-hubs.css` for now.
- **Missions:** every mode is a hub tile; Quick start is the one yellow over the Mission art; no "…" (the Bounty line
  picks its short words when the long ones do not fit, and wraps).
- **Commissions:** Daily and Weekly as kit rows on a chamfered panel (one ink Claim each, Claim all the one yellow);
  the login week as day cards with 50 px reward tiles (the whole week in view on a phone); the code in a kit input.
- **Achievements:** one yellow (Claim all): the yellow accent bars, the brush underline and the yellow tier dots went;
  rows are kit rows; the chip, Ribbons, the case filters, the category and ladder sheets and the claim modal are square,
  46 px controls. Whole list on the ink save: 6 screens (Done collapsed).
- **Bounty:** the arenas and tiers as kit cards (46 px tiers, the picked one ringed in pink); the arena's story line
  went from the cards (it was cut with "…").
- **Total Assault / Titan Trials:** the boss and titan cards as V4 cards (art over an ink caption, picked = pink ring);
  Titan Trials has one yellow (the ★ of the week is an ink sticker), 46 px target and tier chips.
- **Tactical Challenge:** the colosseum as a V4 card (Prepare the one yellow, the best wave on the caption's right).
- **Sandbox:** the header on the ink plate (difficulty as kit options at 46 px), the maps as kit tiles.
- **Happening Now, Mailroom:** kit cards and rows, 46 px Go and Claim.
- **Multiplayer:** Friends and Clan Boss as hub tiles, PvP and Titan Co-op (the kit's locked tile) drawn the same;
  invites as kit rows; the room code in a kit input; Messages' bar button has the bar's 46 px hit square.
- **Lists at rest never cut a tap across its middle** (`hubHost.js keepWholeTaps`: Bounty, the Mailroom, Happening Now,
  the Achievements list and its sheets settle to the nearest clean place after a scroll, like a soft snap).

## Gates (e2e/menus.mjs --milestone m5)
27 shots (6 new: achievements-cats, -ladder, -claim, bounty-tiers, titans-more, mail-letter). At 844x390 all 27 pass:
yellow 5 → 1 (Achievements), 2 → 1 (Titan Trials); radius 0 everywhere (was up to 18); taps under 44: 0 everywhere
(was up to 17); Missions and Challenge ellipsis 1 → 0; Sandbox text 11.2 → 12, Challenge 11.52 → 12.
`tools/cssFloor.mjs` 333 → 327 (sandbox.css and two Challenge labels in meta-a.css).

## For the owner
- The Bounty arena cards no longer show the arena's one-line story (it never fit a phone). Say if you want it back in
  a Details sheet.
- Total Assault on a phone hides the two counter chips (they are in the boss's Details sheet).
