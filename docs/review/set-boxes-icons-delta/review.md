# Delta review: Set Boxes v2 r1 fixes + Item icons r1 polish

**Verdict: OK.** No blockers, no Medium. Two Low and two Info findings, all optional.

- A) `feature/set-boxes-v2` fbe3b3b2 → **6d2e5716** (merges 77ae365d and main eb0b1ab9, then the M1/L1/I1/I2/I4 fixes)
- B) `feature/item-icons-3d` 77ae365d → **1b0e2603** (the UR/preset re-bake, the `.ur` ring, the compact landscape header, the kind line)
- Merged tree: 1b0e2603 into 6d2e5716 merged **clean** (no conflicts in gearUr.js or backpack.js). Tested at local merge
  de3de7d0, which is the base of this branch.

## Results

| Check | Result |
|---|---|
| `vitest run --no-file-parallelism` (serial) | **432 files passed, 2 skipped; 6806 tests passed, 11 skipped** (1453 s) |
| `e2e/set-box.mjs` (390x844, 844x390, 1280x720) | 63 ok, all passed |
| `e2e/item-art.mjs --expect-art` | 289 ok, all passed |
| `e2e/gear-slots.mjs` | 52 ok, all passed |
| `e2e/awaken-lr.mjs` | 52 ok, all passed |
| Sim id (merged tree / origin/main) | `0fe7c5c04aec` / `0fe7c5c04aec`; `git diff origin/main -- src/sim src/online/coop/version.js` is empty |
| Item art total `public/art/items` | 3,061,584 B (2.92 MiB) out of 3.2 MiB (3,355,443 B); ~294 KB headroom |

## Each r1 finding

- **M1, fixed.** `tests/systems/lrAwaken.test.js:137` asserts `simId().id === KNOWN_SIM_IDS[COOP_PROTOCOL]` and that the
  entry exists; the map lives in `tests/fixtures/simIds.js`, and `itemArtRuntime.test.js` uses the same map.
- **L1, fixed.** The script enumerates all 42 Set Box items: `supplyOnly` is set on exactly 28 of them (21 preset plus 7
  UR random), with 0 mismatches against `kind === 'preset' || setRarity === 'ur'`, and on 0 random non-UR boxes. `tie_pin` and
  `collar_pin` are both `supplyOnly: true`. `itemSources()` returns no source for any `supplyOnly` item.
- **I1, fixed.** I probed it in the browser (Supplies sheet, 390x844, touch):
  - With n = 1 (Freeze Tag random), no ×N button appears.
  - With room for 12 pieces (2 boxes) and 15 boxes, the button reads "Open ×2". Tapping it opens exactly 2 (15 → 13,
    gear 988 → 998), and the button then hides.
  - With a full bag (room 4), ×N is hidden on random and preset boxes alike. "Open all" shows the bag-full toast and
    consumes nothing.
  - With room for 1000 and 15 boxes, it reads "Open ×10" and opens 10.
- **I2, fixed.** Two DOM taps on "Open ×10", 128 ms apart (the second lands on the redrawn button), opened **one** batch
  (15 → 5). A tap on a different button 656 ms later opened one box, which is correct because it is outside the window.
  Ten taps over about 300 ms opened **one** box. The guard is module-level, so all of a random box's buttons share it. There
  were no page errors.
- **I4, fixed.** `SET_BOXES_V2.md` §6 has the known-limit note.

## Visuals

- `boxes48_x2.jpg` shows all 42 boxes at 48 px, upscaled 2× with nearest-neighbour so each pixel is honest. The **preset
  tag** (white, navy pencil) reads clearly on all seven colours, the gold straps included. Every random box is
  tagless, so preset against random is unambiguous.
- **UR against Legendary at 48 px:** the UR box is distinguishable on every colour (multi-colour straps, a white crest,
  a lid glow) against Legendary's single gold strap. In the Backpack and Supplies, the UR tile's rainbow frame makes the
  rank obvious (`supplies-ur.jpg`). See L1 for the two weakest colours.
- **844x390 landscape** (`ur-844x390.jpg`, `freezetag-844x390.jpg`): the compact header (a 40 px box, "Preset · UR",
  five pieces on the rainbow ring) leaves the first main-stat row fully visible above the actions. The sticky fade
  signals that more is below. There is no horizontal overflow (an e2e check).

## Findings

- **L1 (Low, visual): on two box colours the UR straps lose punch.**
  - `tools/blender/items/models/boxes.py:63` gives every UR box the same four bands (pink, gold, mint, sky). On the
    teal **Treasurer** box the mint and sky bands melt into the body. On the lavender **pick** box the bands read pastel
    and lighter than Legendary's gold.
  - The UR rank is still readable there, but it leans on the tile frame.
  - **Fix (optional):** give the UR bands a thin dark or gold edge (`ink`/`rim` up), or per set swap out the band nearest
    the box hue (Treasurer: pink | gold | violet | sky). Then re-bake the 4 affected icons.
- **L2 (Low, UX, pre-existing; I1's sibling): "Open all" ignores bag room.**
  - `src/ui/screens/backpack.js:329` shows "Open all" or "Open 20" whenever n > 10, even when the bag fits fewer (or no)
    boxes. The probe saw "Open all" with room for 0 boxes, and with room for 2 it opens 2.
  - `openSetBoxesNow`'s toast explains the shortfall, so nothing is lost.
  - **Fix:** apply I1's rule here. Show it only when `setBoxOpenable(profile, b.id, SET_OPEN_BATCH_MAX) > many`, and
    label it with that count.
- **I1 (Info, landscape polish): the bonus line sits flush under the piece labels.**
  - `src/ui/styles/gear-ur.css:166` sets the gap to 4 px, and `.gu-sb-bonus` has no top margin, so under 480 px "Big
    Cheer. 4 pieces…" touches the piece names.
  - The 18 px fade (`gear-ur.css:173`) sits across the second picker row's label at rest.
  - **Fix (optional):** `.gu-sb-bonus { margin-top: 4px }` inside the media query.
- **I2 (Info): a cancelled preset batch confirm keeps the 600 ms lock.**
  - In `src/ui/gearUr.js`, the `setBoxModal` Open handler sets `busy` before `confirmDialog`. If the player cancels and
    re-taps within 600 ms, nothing happens.
  - This is harmless. No change is needed.

## Rules check

The diffs add no third-party names and no reference images. No keys are added. Nothing changes under `src/sim`, and
`COOP_PROTOCOL` is unchanged. A patch note is still owed when this ships to `main`; it is not part of this review.
