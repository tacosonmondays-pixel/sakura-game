# The Potential Board (spec)

The per-girl Potential map of the UI v2 menus (plan: `docs/specs/UI_V2_MENUS.md` section 6, milestone M4; owner
decisions 80, 107, 109, 110). Display only: it reads her Potential, breakthroughs and level, and its one action, Raise,
is the existing `essence.raisePotential`. Nothing here is game logic, nothing is saved, and nothing under `src/sim/**`
imports it.

It replaces today's Potential surfaces: the six bloom pips in the Info tab's Potential row (`potentialSection` in
`src/ui/potential.js`) and the Potential sheet (`openPotential` in `student.js`: 41 numbers, paragraphs, a six-cell
track). The `potPill` stays on cards and in battle.

**Built (M4a, the pure half):** `src/ui/potentialBoard/layout.js`, `growth.js`, `card.js`, `src/data/potentialBoards.js`,
the `card` and `chips` lines in `src/data/potentialText.js`, and their tests. **Next (M4b):** `draw.js` (SVG, full and
thumbnail), `earn.js`, `index.js` (`openBoard(host, def, unitState, { sel, onRaise, onClose })`),
`src/ui/styles/potential-board.css`, the hooks in `student.js`, `students.js` and the Info tab's panel, and
`e2e/potential-board.mjs`. Contact sheet of every layout: `docs/review/ui-v2-menus/m4/families.jpg`.

## 1. Look

- **The plate.** A night ink plate (the `.ui-night-zone` surface inside the day page, `--plate` #0e1930, never black)
  with faint star dust and a fine academy grid: a star-chart feel.
- **Nodes.** Her six Potential steps are academy-tech sockets: hexagons with one chamfered corner (the kit's cut, S1),
  the step number inside, P6 a little larger. A lit node fills with her hue; the next node wears a hue outline.
- **Light paths** in her hue join them: 2.4 px with a soft glow (Low graphics: a second, wide, faint stroke instead of a
  blur); an unlit path is a 1.4 px dashed `--on-plate-dim` line.
- **Gates** sit on the paths as small diamonds: gates 1-5 together on the first path, gates 6-10 one on each later path.
- **Level dots** run along the paths: one for each ten-level stretch up to 60, then one a level; a ring marks LV 85.
- **Her token**, her thumb portrait, sits beside the spot her level has reached, with a hairline to it.
- **The emblem.** Her class's line glyph sits in the centre socket (a node of its own, or P1 / P6 where the family puts
  the socket on a node).
- **LR units** get the Nightglass twin-star crest point after the ring (exclusive to LR, `UI_DIRECTION.md` 5.6).
- **Labels.** Phones label only the next node (its step label, at most 9 characters); a roomy box labels all six.
- **Never:** animal silhouettes or pictures drawn with stars, named star figures or their names, the word for such
  figures, or anything laid out like another game's six-star duplicate screen. The reviewer checks by eye; the layout
  test checks the words.

## 2. Families

Five families, each drawn as a node graph in a 100 x 64 box. Each has three layouts; a girl's layout and whether it is
mirrored left to right come from a stable hash of her id (`boardPick`), and `src/data/potentialBoards.js` writes the
picks in, so her Board never moves when a family gains a layout. A builder may move a girl to another family.

| Family | Shape | Layouts | Default classes |
|---|---|---|---|
| Spear | nodes climb a forward-leaning spine to a tip; P6 at the tip | a hooked start into a sawtooth; down the edge into a sawtooth; nodes on a straight spine with the path weaving to the gates | marksman, sniper, duelist, skirmisher, cleaver, falconer, prism |
| Burst | P1 in the centre, nodes on a spiral arm across faint rays; P6 on the outer crown | the arm leaves right; leaves up and right on a tighter turn; straight chords between the rays | bombardment, artillery, chain, alchemist, trapper, spiker, bowler, mirror, mortar |
| Ring | nodes on an orbit around a centre socket; P6 in the centre | open at the top left; open at the bottom; nodes over the top with both spokes from below | support, enchanter, exorcist, controller, displacement, purifier, hexer, ring, council |
| Circuit | nodes on a right-angled trace with chamfered corners; P6 on the chip | three rows back and forth; a square spiral in to a central chip; up and down in columns | economy, engineer, manager, builder, summoner, botanist |
| Crest | a symmetric crest of three tiers; P6 at the top | chevrons; arches; flat-topped gables | every hero (vanguard, mystic, tideguard, champion, puppeteer, stormrider) |

A class with no row gets the Ring and the sparkle glyph (`FALLBACK_BOARD`), so no Board is ever blank.

## 3. Route and gates

The route is the real level rule (`src/systems/progression.js`: gate k from 6 needs P(k - 4)), so the Board teaches it
without text:

| Band | Path | Gates on it | Levels on it |
|---|---|---|---|
| 1 | P1 to P2 | 1-5 (one card, `g15`) | LV 1-60 (six ten-level dots) |
| 2 | P2 to P3 | 6 | 61-63 |
| 3 | P3 to P4 | 7 | 64-67 |
| 4 | P4 to P5 | 8 | 68-72 |
| 5 | P5 to P6 | 9 | 73-78 |
| 6 | P6 to the ring | 10 | 79-84, the ring is 85 |
| 7 (LR only) | the ring to the crest point | none | none |

Nodes light from her Potential, gates from her breakthroughs, dots from her level (`boardLights`), and a path once the
node it leads to is hers. "P4 but behind on gates" reads at a glance: four lit nodes with dark gates 6 and 7 on lit paths.
`ROUTE` in `layout.js` is built from `GATE_CAPS`, so a change to the level rule moves the Board with it.

## 4. Sizes and taps

- **844 x 390 (the phone):** the Board opens as a sheet over the tabs and the content window (about x 244-836, y 44-390);
  the art band and nameplate stay. Less padding, a 196 px card column and a 36 px header, the board box is 372 x 240
  (`PHONE_BOX`); the 100 x 64 board fills it at 3.72 px a unit (372 x 238).
- **1280 x 720:** 570 x 365 (`DESKTOP_BOX`, a 300 px card column). **390 x 844:** 374 x 239 (`UPRIGHT_BOX`, the board
  across the sheet, the card below it).
- **Never under 3.72 px a unit** (`MIN_SCALE`): there a 44 px target no longer fits between neighbours. A narrower
  screen (667 x 375) gives the board more room instead: the card overlays the board's right side.
- **Taps:** every node, gate (gates 1-5 all answer `g15`), the ring and the crest point is a whole 44 px circle that
  never overlaps another item's, so every node centre is at least 44 px from every other. Labels and her token keep
  2 px clear of nodes, gates, the ring, the crest, the socket and each other. `boardIssues(board, box)` checks every
  rule; `tests/ui/potentialBoardLayout.test.js` runs it for every girl and every layout at all three sizes.

## 5. Cards

Tap a node, a gate or the ring and the right column becomes the card:

- **A node:** the P sticker and step name; its state (✓ Hers / Next / Locked · after P4); the stat chip
  (`potentialStatLabel`, "+4% SPD") and at most two kit chips (`chips`, each naming its stat: "CRIT +6%"); one sentence
  (`card`: at most 60 characters and one number); an FX preview loop; "Opens LV cap 78"; Details ▸ for the full `long`
  text; and Raise on the next node only. Until a step's lines are written, the card shows its `node` label and the first
  sentence of its `long` text (`card.js` `stepCardText`). P1 is her base (`BASE_CARD`).
- **Gates 1-5** share one card ("4/5 broken", Level tab ▸); **gates 6-10** show their state, the cap change and up to
  three material chips, Level tab ▸.
- **Nothing tapped:** the column shows what her steps give (three bars to MAX by role) and the next step with **Raise**,
  the screen's one yellow ("Raise · ◆ 1 · 10,000" with the home kit's icons); when she cannot afford it, the disabled
  style and one line saying what is missing.
- **Route params:** `#/student/<id>?tab=info&board=1&sel=p5` (`p1`-`p6`, `g15`, `g6`-`g10`, `end`, `lr`: `SELS`).
  Escape closes a card, then the Board.
- **Where it opens:** the Info tab's Potential panel becomes a Board thumbnail (nodes and lit paths only), "Next ✦
  <step>" and "Board ▸"; the plate gets a Growth ring with its percent (tap opens the Board; hidden while it is open);
  the P sticker opens it too.

## 6. Earning a node

Raise calls `essence.raisePotential` (as today's sheet does), saves, then plays one skippable timeline: the Essence arcs
to the node, the path draws with a light at its head, the node ignites (scale 0.15 to 1.35 to 1, a ring flash, eight
sparks), the card turns to that node with the one NEW sticker, the plate's P bumps, Growth counts up, and the gate it
opens pulses once. **P6** adds every path turning sakura, the nodes bumping in turn, the five-petal crown over P6 and a
**"Full Potential!"** banner for at most 1.2 s, never over the board's centre for long. Transform, opacity and
stroke-dashoffset only, through the home kit's motion layer; reduced motion is 120-150 ms fades; Low graphics has no
blur filters. A tap during the show skips to its end.

## 7. Growth

Computed every time it is shown, never saved, never rewarded, never badged (`growth.js`):

    growth = floor(100 × (0.5 × (P − 1) / 5 + 0.3 × gates / 10 + 0.2 × (level − 1) / 84))
    a unit with an LR step: floor(0.9 × growth (before the floor) + 10 × (LR done))

Worked in whole numbers: × 210, the parts are 2100 per step, 630 per gate and 50 per level. Aoi at P4, LV 48 with 4
gates is 53 %; P6, LV 85 with 10 gates is 100 %; an LR unit there is 90 % without her LR step and 100 % with it. Shown
on the plate's ring and the Board header, and as a Growth sort in Students.

## 8. Data

- **`src/data/potentialBoards.js`** (UI-only): per girl `family`, `variant`, `mirror`, `hue` and `emblem`. Her hue is
  the dominant saturated hue of her card art (`public/art/portraits/<id>-card.webp`), sampled once with Pillow
  (weighted to her figure; skin, greys and dark browns left out), then lifted to a light that reads on the plate at
  4.6:1 or more. Her emblem is her class's line glyph (`src/ui/lineGlyphs.js`). Class defaults (`CLASS_FAMILY`,
  `CLASS_EMBLEM`, `FAMILY_HUE`) cover a new girl; `LR_UNITS` lists girls with an LR step (none yet).
- **`src/data/potentialText.js`:** `card` and `chips` for every girl's five steps, every number from that step's `long`
  text (the text test checks it).
- **Read, unchanged:** `src/systems/potential.js` (`potentialLevel`, `potentialView`, `potentialNext`,
  `potentialStepInfo`, `potentialStatLabel`, `isKitStep`, `hasPotentialNew` / `clearPotentialNew`, `MAX_POTENTIAL`),
  `src/systems/essence.js` (`essenceBalance`, `essenceCap`, `raiseCost`, `canRaisePotential`, `raisePotential`,
  `boughtP`), `src/systems/progression.js` (`GATE_CAPS`, `BASE_GATES`, `MAX_BREAKTHROUGH`, `MAX_LEVEL`,
  `gatePotential`, `levelCapAt`, `levelCapInfo`, `breakthroughCost`, `canBreakthrough`).

## 9. The pure modules

- **`layout.js`:** `boardFor(def, { lr, family, variant, mirror })` (the board in units: `nodes`, `end`, `crest`,
  `socket`, `bands` with `pts` and an SVG `d`, `gates`, `dots`, `deco`), `boardPick(id)`, `boardHash(id)`, `ROUTE`,
  `LR_BAND`, `SELS`, `gateSel(gate)`, `bandOfLevel(level)`, `routeAt(board, level)`, `boardLights(board, { p, gates,
  level, lrDone })`, `fitBox(box)`, `metrics(scale)`, `boardPixels(board, box)`, `hitTargets(board, box)`,
  `hitAt(board, box, x, y)`, `labelsAll(box)`, `placeLabels(board, box, { next, text, all, token })`,
  `placeToken(board, box, { level, labels })`, `boardIssues(board, box)`; constants `BOX`, `FAMILIES`, `VARIANTS`,
  `PHONE_BOX`, `DESKTOP_BOX`, `UPRIGHT_BOX`, `MIN_SCALE`, `HIT_R`, `CLEAR_PX`, `SIZE`.
- **`growth.js`:** `growthPct({ p, gates, level, lr, lrDone })`, `growthOf(unitState, { lr, lrDone })`,
  `growthParts({ p, gates, level })`.
- **`card.js`:** `stepCardText(def, step)`, `cardFromText(txt)`, `firstSentence(text)`, `BASE_CARD`.

## 10. Budgets (844 x 390 unless named)

- Info tab at most 10 numbers with the panel; the Board open at most 12 (today's sheet: 41); a card open at most 12.
- Text at least 12 px (13 px at 1280 x 720); contrast at least 4.5:1 on the plate (her hue is 4.6:1 or more by data).
- One yellow (Raise); taps at least 44 px; nothing over her face; no sideways scroll.
- E2E (`e2e/potential-board.mjs`, M4b): open from the panel, the P sticker and the ring; P5 → Next card → Raise → after
  the show the card says ✓ Hers + NEW, the plate says P5, coins went down by `raiseCost`, Growth went up; a tap during
  the show skips to the end; gate 9 and the gates 1-5 card open; Escape closes the card, then the Board; reduced motion
  fades only; the Growth sort puts the highest first.
