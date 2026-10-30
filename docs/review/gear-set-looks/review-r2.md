# Gear set looks: independent review, round 2

Reviewed: `feature/gear-set-looks` at `fd3c2b2a` (fix commit `4acd2267`, then a text-only commit for the hero and lore
lines), Oct 30, 2026.
Reviewer: a fresh agent that built none of it and did not do round 1 (art judge and code reviewer, HANDOFF §6 review
gate).

**Verdict: OK.** All four r1 MEDIUMs are fixed, in the code and on the board. Every requested LOW is fixed too: L3, L4,
L5, L6, L7, L9, L10, L11, L12 and L13. L1, L2 and L8 stay with the owner.

There are 7 new LOWs (N1 to N7) and no BLOCKER, HIGH or MEDIUM. None of the LOWs changes a pixel of the art. N1 and N2
are small gaps in the guard, and N5 is a skip that could hide the check on a runner without python3.

## What I checked

- **The board** `/tmp/gear-icons/gear-set-looks-r2.png` (1860×1604).
  - The layout is the same as in r1:
    - The header is y 0–92.
    - The rows are 252 px tall: Spirit Squad y 92–344, Freeze Tag 344–596, Geometry 596–848, Party Popper 848–1100,
      Treasurer 1100–1352, Power Bank 1352–1604.
    - The slot columns are 202 px wide from x=250, in the order Charm, Ribbon, Shoes, Hair Clip, Necklace.
    - In each cell, the 190 px view is at (+6, 0), the 32 px tile at (+40, +204) and the 64 px tile at (+90, +184).
  - Crops:
    - all 30 tiles at 32 px (×5, nearest);
    - the changed pieces at 64 px (×4);
    - the 256 px renders on Nightglass navy and on a checker, with edge and corner zooms at ×3: the token stripe, the
      bank cable and plug, the battery terminal and jump ring, the set-square tip and LED, the pom-pom glint, the glow
      sole and the bangle.
  - Every piece as a 22 px and a 32 px tile on the Super Rare, Mythic, Legendary and UR plates (`post.tile`).
- **The board matches the commit.**
  - All 30 renders in `/tmp/gear-icons/sets3/png` were baked from 07:43:38 to 07:48:21. `4acd2267` is 07:43:25.
    `fd3c2b2a` changes only `hero`/`lore` text and the spec. Both are story fields that are never drawn.
  - The board's 190 px views were rebuilt from `sets3/png` with the board script's own resize and background. All 30
    match: 0 pixels differ in the art area. The only difference is in two cells, Geometry and Party Popper charms,
    at x 0–21: the fifth palette swatch on the left overlaps the view (N6).
  - I baked 8 keys again from my detached checkout of `fd3c2b2a`: one Blender process, `nice -n 19`, `--no-manifest`,
    output to my scratch folder. The keys were the spirit charm and shoes, the freezetag charm, the geometry hair,
    the popper ribbon, the treasurer charm, and the powerbank charm and necklace. All 8 are **pixel-identical** to
    `sets3/png` (0 pixels differ), and the repo stayed clean.
- **Machine checks on all 30 renders:**
  - The alpha is one connected shape in every render, so nothing floats.
  - No opaque pixel touches the canvas edge. Only the soft shadow reaches x=0 (alpha ≤ 11), the same as the approved
    default shoes and ribbon.
  - No bright halo on navy. The few bright semi-transparent pixels (≤ 15 per icon) are the anti-aliased edges of
    white stripes and silver beads.
- **Colours:** I measured CIEDE2000 between the six set bodies and against the default rarity bodies.
- **Code:**
  - I read the full diff `51c6d6da..fd3c2b2a`.
  - I probed `gear_design` with 24 bad and edge-case rows on copies of `GEAR_SETS`.
  - I checked `gear_rows` routing with and without `preview`.
- **Tests and sim:**
  - `python3 tools/blender/items/gear_sets.py --check` prints `[gear_sets] ok: 7 sets, 11 probes` and exits 0. The
    seven sets are the six launch sets plus the old `sample` row.
  - `nice -n 19 npx vitest run tests/art`: 4 files, **36 tests pass**. That is r1's 34 plus the two new ones, and the
    python check ran rather than being skipped.
  - The sim id is **`be940ecb2087`**, unchanged. Nothing in `src/` changed, so `COOP_PROTOCOL` stays.
- **Names:** I listed every capitalised word in the added lines and in both commit messages. There are no other games'
  or anime names.

## The r1 findings

### M1 (fixed) Power Bank charm vs necklace

- **Where:** board row 6, Charm (x 250–452) vs Necklace (x 1058–1260); `models/gearset.py:166-179` and `:554-564`.
- **The charm** is still the upright bank with four stacked bars. It now has a short white cable and a steel plug
  coming out of its foot.
- **The necklace** is now a wide, horizontal battery cell with a side terminal, three upright gauge cells and a lime
  bolt. It hangs from the large steel loop.
- **At 22, 32 and 64 px** they are two different objects: tall and narrow on a small keyring vs wide and flat under a
  big loop. The cable reads at 32 px.
- **At ×3,** the cable runs into the plug cleanly, and the jump ring overlaps the cell's top edge, so the cell is
  attached.

### M2 (fixed) Set-Square Clip read as an arrowhead

- **Where:** board row 3, Hair Clip (x 856–1058, y 596–848); `models/gearset.py:445-457`.
- **The new shape:** the triangle lies along the bar. Its ruler leg sits on the bar and its right angle is at the bar
  end. The acute 22° corner points back along the bar toward the clip and merges into it, so no free point aims
  outward. The free corner is the blunt 68° corner, which carries the cyan LED.
- **At 32 and 64 px** it reads as a slate drafting triangle or ruler on the clip. It does not read as an arrow or a
  weapon.
- The ruler ticks and the finger hole only show from 64 px. That is fine under spec §2 ("small parts are for the
  64–256 px views").

### M3 (fixed) Tag Token read as a "no entry" sign

- **Where:** board row 2, Charm (x 250–452, y 344–596); `models/gearset.py:112-121`.
- **The new layout:**
  - The coral stripe is level, low on the token's foot (z −0.5), and on the rim, below the chalk ring.
  - Nothing crosses the ring's centre.
  - The LED dot sits top right.
- **At 22–64 px** it reads as a round tag token. There is no prohibition read, and it no longer echoes the Compass
  Keyring's diagonal needle.

### M4 (fixed) `gear_design` accepted unknown option names

- **Where:** `tools/blender/items/catalog.py:345-375`, `GEAR_REQUIRED` at `:320`.
- **These are now refused with a `ValueError`:**
  - all of r1's cases: `knto=`, `soel=`, `fob=` on a bow, `toe='nonsense'`, `body='not-a-colour'`, and a row
    missing `fob`, `ornament` or `locket`;
  - from my own probes: `trim='plastic'`, `light='#fff'`, `glass='#zzzzzz'`, `stripes='2'`, and `silhouette`,
    `shape` or `motif` on a set-base slot row.
- **Also fixed:** `toe` is declared (`white`, `body`), and `buckle='none'` now draws no buckle
  (`models/gearset.py:383-384`).
- **Defaults are left alone, as they should be:** a missing `style`, `knot` or `cord` falls back to its default in
  `gearset.py`, and the inherited `GEAR_SLOT_ART` keys are not checked.
- **`gear_sets.py --check`** probes 11 bad rows, checks that every row validates, holds the six launch sets at
  `preview=True`, and compares the spec's §3 with the rows. `tests/art/itemArtRuntime.test.js:164-170` runs it.
- Two small gaps remain: N1 and N2.

### The requested LOWs

- **L3 (fixed):** the coin tag and its jump ring are gone (`gearset.py:188-207`). At 22–32 px the Abacus Bracelet
  reads as a bead bangle, not a ring with a stone.
- **L4 (fixed, the owner question stays):** the glow sole is `#f0284a` at glow 0.3, down from 0.55. At ×3 and at 32 px
  the sole reads red, not pink. Owner question 1 ("white with red trim") stays open.
- **L5 (fixed):** the white tufts are gone, and the glint now sits on the red ball. At 32–64 px there are no spots and
  no eyes.
- **L6 (fixed):** Geometry is now teal slate `#4a7c92`. It is ΔE 19.3 from Power Bank indigo, and every pair of sets
  is now ≥ 19.3 apart. On navy the Protractor Ribbon and the Ruler-Step Loafers stay readable. The spec keeps the
  "check again on the LR tile" note.
- **L7 (fixed):** Party Popper is now magenta-violet `#c23dbf`, ΔE 15.6 from the default Super Rare violet (it was
  5.5). Spec §2 now says plainly that Spirit Squad and Party Popper read by their pair, not their main colour.
- **L9 (fixed):** the role is `crowd`, which matches GEAR_UPDATE §3.2 (`origin/spec/gear-update`, line 78).
- **L10 (fixed):** `gear_sets.py --write-doc` generates spec §3 between the `sets:start` and `sets:end` markers, and
  `--check` fails when the two drift apart.
- **L11 (fixed):** a test pins all six sets to `preview=True` (a regex on the `GEAR_SETS` block) and checks that no
  `gear_<set>_*` key is in `ITEM_ART`. `gear_rows` without `preview` returns no set keys; with `preview`, every set row
  is `kind='calibration'`.
- **L12 (fixed as a plan):** spec §5 adds up the budget and names the two ways out: trim the 256 px cuts, or raise
  the cap with the owner's yes. I measured the 30 icons at 0.452 MB, and `public/art/items` at 1.608 MB. The arithmetic
  holds.
- **L13 (fixed):**
  - The dead `* 0` term and the always-true branch are gone.
  - The docstring now lists `heel`, `laces`, `toe` and `buckle: none, plain, coin`.
- **L1, L2 and L8 are for the owner.** Nothing changed there, as asked.

## New findings

### N1 (LOW) Typos at the set level are not refused

- **Where:** `tools/blender/items/catalog.py:350`.
- **What happens:** only the slot row's keys are checked. On the set row, a typo such as `acent='#000000'` passes,
  and the set silently draws the derived default accent. A misspelt `glass` or `light` behaves the same way.
- **Why it is only LOW:**
  - The set row has a small, fixed set of keys.
  - A wrong colour shows on the first board.
- **Fix:** refuse set-row keys outside `GEAR_SET_FIELDS`, plus `name`, `role`, `motif`, `material`, `note`,
  `silhouette`, `preview` and `slots`. Add one probe for it.

### N2 (LOW) `stripe` and `strap` pass on every set base, and an unknown `base` raises `KeyError`

- **Where:** `catalog.py:362` and `:376`.
- **What happens:**
  - `strap='accent'` on a keyring, or `stripe=` on a locket, is accepted and ignored. Only `setbow` draws `stripe`,
    and only the `setshoe` loafer draws `strap`.
  - `base='bogus'` raises a `KeyError` from `GEAR_SHAPES[base]`, not a `ValueError`. `--check` would then stop with a
    traceback, not its own message, but it still fails.
- **Fix:** allow `stripe` only for `setbow` and `strap` only for `setshoe`, and refuse an unknown base by name.

### N3 (LOW) The Geometry silhouette line says the set-square "stands on its clip"

- **Where:** `catalog.py:224` (generated into `GEAR_SET_LOOKS.md:81`).
- **What happens:** the hero line (`catalog.py:240`), the code comment (`gearset.py:445`) and the art all say the
  set-square is "lying along the clip". "Standing" is the r1 shape.
- **Fix:** change it to "lying along its clip" and run `--write-doc`.

### N4 (LOW) Small stale numbers and comments

- `gearset.py:166`: the comment still says "a port". The piece now has a cable and a plug.
- `GEAR_SET_LOOKS.md:8`: says "about 0.46 MB", but §5 says 0.45 MB. My measurement is 0.452 MB.
- `GEAR_SET_LOOKS.md:29`: says Party Popper vs Super Rare is "ΔE 16". It measures 15.6. That rounds to 16, so it
  is fine, but it is the closest value to the 15 line.

### N5 (LOW) The python guard test skips without a word when python3 is missing

- **Where:** `tests/art/itemArtRuntime.test.js:164-165` (`it.skipIf(...)`).
- **What happens:**
  - The deploy CI (ubuntu-latest) has python3, so the test runs there.
  - The desktop workflow runs `npm test` on windows-latest, where `python3` may be missing, so it would skip.
  - A local run without python3 also skips.
- **Why it is only LOW:** deploy is the gate that matters.
- **Fix:** make the skip fail when `process.env.CI` is set on Linux, or log a visible warning when it skips.

### N6 (LOW, board only) Two layout glitches on the review board

- **The swatch overlap:** in the Geometry and Party Popper rows, the fifth palette swatch (brass, gold) runs from
  x 236 to 276. That overlaps the charm view, which starts at x 256 (y 652–684 and 904–936). The art pixels are
  unaffected.
- **The clipped text:** the Set-Square Clip hero line runs off the right edge of the board (row 3, lore column).
- These are in the board script (`/tmp/gear-icons/board_sets.py`), not the repo. Fix them before the board goes to
  the owner.

### N7 (LOW) The set-square's identity details only show from 64 px

- **Where:** board row 3, Hair Clip.
- **What happens:** at 22–32 px the Set-Square Clip reads as a slate wedge or ruler on the clip. The right angle,
  the finger hole and the ticks only show from 64 px.
- **Why it is only LOW:** this is allowed by spec §2, and it is the same class as the owner's L1 (hair-clip
  ornaments carry the read). I note it so that L1's decision covers this piece too. No change is needed for this
  round.

## What passes

- **Coherence.** Each set is still one motif, one palette and one material:
  - Spirit Squad: red, white and gold.
  - Freeze Tag: ice blue, chalk white and one coral mark per piece.
  - Geometry: teal slate, brass and a cyan dot.
  - Party Popper: magenta-violet, gold and confetti.
  - Treasurer: mint, silver and a green LCD.
  - Power Bank: indigo, lime and steel.

  The new colours sit inside their kits.
- **Sets apart at 22–32 px.** All six read as different sets on the Super Rare, Mythic, Legendary and UR plates. The
  closest pair is now 19.3, up from 14.2.
- **Slots.** Every piece reads as its slot. The open questions are the owner's L1 (hair-clip ornaments) and question
  4 (the bracelet charm). M1, M2, M3 and L3 are resolved.
- **Artifacts.** One connected shape per render, no clipping, no halos on navy, an even ink outline, and clean joins
  on the new parts: the cable and plug, the terminal, the jump ring on the cell, and the stripe on the rim.
- **Style.** The same camera, cel shading, ink weight, glints and framing as the approved gear.
- **Rules.**
  - No other games' or anime names.
  - No images added.
  - Nothing in `public/` or the manifest.
  - The hair pieces are rigid clips, with no bow, star or snowflake clip.
  - The lore is wholesome. "She" in the lore refers to the heroes, not to players.
- **Code.**
  - The guard does what spec §4 says, apart from N1 and N2.
  - `--check` and `--write-doc` work without Blender.
  - The tests run the check.
  - The sim id is `be940ecb2087`, and `tests/art` passes 36 of 36.

## Verdict

**OK.** There is no BLOCKER, HIGH or MEDIUM. M1–M4 are fixed, and so are all the requested LOWs (L3, L4, L5, L6, L7,
L9, L10, L11, L12, L13). L1, L2 and L8 stay with the owner.

N1–N7 are optional. N1 to N3 are a few minutes' work and worth folding into the next commit on this branch. N6 should
be fixed on the board before it goes to the owner.
