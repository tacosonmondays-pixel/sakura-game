# M4a: the Potential Board's layouts (review)

`families.jpg` (under 400 KB) shows every layout the pure half of M4 can draw, from `src/ui/potentialBoard/layout.js`, at the
844x390 board box (372 x 240 px) on the night plate:

- **Rows 1-5:** the five families, three layouts each (Spear, Burst, Ring, Circuit, Crest), each at P3, LV 63 with 6
  gates, in the family's default colour, with the next node labelled (a 9-character worst case) and the token marking
  LV 63.
- **Rows 6-7:** the six review girls in their own colours and emblems, each in a different state: Aoi (P4, LV 48,
  4 gates: "P4 but behind on gates", Growth 53 %), Kaede (P2 at the LV 60 cap), Chika (P6, LV 85, 10 gates: everything
  lit, 100 %), Umeko (P3), Akane (P5), Hikari (P1). Their tokens are their thumb portraits.
- **Row 8:** an LR unit after her LR step: the twin-star crest point lit after the LV 85 ring.

The drawing is a throwaway preview made for this sheet (the real drawer is `draw.js`, M4b): hex sockets with one cut
corner, light paths in her hue, diamonds for gates, dots for levels, the 85 ring, her class's glyph in the socket.

**What to check:** the five families read as different academy-tech node maps; nothing reads as a picture drawn with
stars or as another game's six-star duplicate screen; nodes, gates and labels never touch. The numbers behind it
(every hit target a whole 44 px circle, node centres 44 px or more apart, labels and token 2 px clear) are checked
for every girl and every layout by `tests/ui/potentialBoardLayout.test.js`.
