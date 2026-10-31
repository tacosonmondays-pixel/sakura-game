# Review r1: feature/item-icons-3d @ 77ae365d

Independent reviewer, fresh clone. Scope: what this branch adds on top of feature/set-boxes-v2 @ fbe3b3b2
(`git diff origin/feature/set-boxes-v2...origin/feature/item-icons-3d`), plus the icon commits 9a66575e, ce455021
and ed8ebf13. The set-boxes-v2 logic itself is covered by another reviewer.

## Verdict: **OK** to merge

Nothing blocks the merge. There are four Lows and two Nits, all polish. The owner's two asks are met:

- Every new item and gear key now has baked 3D-flat art: the pins, the Nightglass Lens, all 42 Set Boxes, and the
  Hair Clip and Necklace up to UR.
- Each set has its own look across all five slots, and each set box wears its set's colour and crest.

## Results

| Check | Result |
|---|---|
| `npm test` | **426 files passed, 2 skipped; 6727 tests passed, 11 skipped** |
| `e2e/set-box.mjs` (3 viewports) | all passed (54 checks) |
| `e2e/item-art.mjs --expect-art` | all passed (289 checks; broken, slow and loaded fallback states included) |
| `e2e/gear-slots.mjs` | all passed (52 checks) |
| `e2e/smoke.mjs` | 676 ok, **2 FAIL, both the known "drag (touch)" ones** |
| sim id | `b2ff5e0e884b`, the branch's base; no `src/sim` or `src/online` changes since the merge base with main (fc978aba) |
| Manifest | 187 `ITEM_ART` + 10 `ITEM_ART_SMALL` keys = 384 files; no orphans, none missing; hashes match (itemArt.test.js) |

## 1. Visual consistency

I checked docs/review/item-icons-3d/board.jpg and my own 64 px sheet, `r1/boxes-64px.jpg`. The rows are the 7 box
columns (pick, then the six sets). In each row: Mythic preset, Mythic random, Legendary preset, Legendary random,
UR preset, UR random. Below them are live icons for comparison: gear boxes, gear pieces, coins, book, crown, material,
then set pieces, ladders, the pins and the lens.

- **The same style as the live icons:** same outline weight, top-left key light, soft shadow and pastel palette.
  Side by side with gearbox_*, gear_charm_* and coins, nothing looks like it came from another pipeline.
- **Every set reads as one family:** one motif and colour across the five slots (pom-pom, pause button, set square,
  star/pennant, calculator, bolt).
- **No text in any icon, and nothing off-model.**
- **Preset and random:** distinguishable at 64 px, but only by the gold pencil tag, about 9 px (L2).
- **Rarity:** Mythic (rose-gold straps) and Legendary (gold straps) are clearly apart.
- **UR:** distinct, but weaker than claimed (L1).

## 2. Wiring

- **Set pieces:** `gearArtKey(slot, r, { set })` returns `gear_<set>_<slot>` for all 6 sets × 5 slots × every
  rarity and UR (guard test, plus a manual spot check).
- **Generic slot icons show no set.** The only `gearIcon` calls without a set are the slot filter chips
  (backpack.js:371) and the build-guide slot header (unitBuild.js:103), which is correct. Every piece render passes
  `set: g.set` (gearUr.js:97, unitBuild.js:108, battle/results.js:54, stage.js:246).
- **The SVG fallback only fires on a load error.** I blocked `**/art/items/**` in Playwright (124–127 requests aborted
  per viewport) and opened 7 Set Box modals at each of 390x844, 844x390 and 1280x720:
  - no page errors; the only console errors are Chromium's own "Failed to load resource: net::ERR_FAILED";
  - every `.ia` turned `bad` and showed its drawing. A box falls back to the gear box of its rarity, a UR box to the
    Rainbow Gear Box, a UR set piece to the rainbow piece, and the Hair Clip and Necklace to the charm drawing (as
    documented);
  - screenshot: `r1/fallback-blocked-390x844.jpg`.
- Unblocked, every icon in the modals was `ia ok` (the image), with the drawing hidden.

## 3. Guard test

I removed files and manifest entries locally (not committed, then restored; the tree was clean afterwards):

- deleting `setbox_geometry_ur_random-128.webp` failed itemArt.test.js ("expected false to be true" on that file);
- deleting `gear_treasurer_ribbon-128.webp` failed the same test;
- dropping `setbox_spirit_ur_random` from the manifest failed itemArtGuard.test.js, which listed `["setbox_spirit_ur_random"]`;
- dropping `gear_popper_shoes` from the manifest failed 3 tests: the size-cap and stray-file test, the guard's set-look
  test, and setBoxes.test.js.

The guard checks the manifest, and itemArt.test.js checks that the files exist and match the manifest hashes, so
together they catch a missing key either way. The "RELEASE BLOCKER" pending list is gone.

## 4. Size

`public/art/items` grows from 1570 KB on main (eb0b1ab9) to 2983 KB here, about 13 % under the 3.2 MB cap.

- **Lazy loading:** every icon is `<img loading="lazy">`. The only eager load is `preloadSmallItemArt` (the 10 small
  cuts, main.js:143). There is no service worker or precache.
- **First load is unchanged.** I served the production builds of main and of this branch with `vite preview` and
  measured at 390x844 with CDP:

| Load | main: item art | branch: item art | main: total | branch: total |
|---|---|---|---|---|
| fresh save, lobby | 94 KB / 19 req | 94 KB / 19 req | 5625 KB | 5654 KB |
| fresh save, Backpack Gear | 45 KB / 10 req | 45 KB / 10 req | 5096 KB | 5089 KB |
| veteran, lobby | 94 KB / 19 req | 94 KB / 19 req | 8053 KB | 8081 KB |
| veteran, Backpack Gear | 97 KB / 19 req | 97 KB / 19 req | 7553 KB | 7547 KB |

The ±30 KB in the totals is JS from the other merged branches, not art.

**The cap raise is justified.** The new bytes only load when a box or set piece is on screen, at about 6 KB per
128 px icon. The cap guards repo and deploy size, not what a player downloads.

## 5. UI (own screenshots, JPEG ≤ 100 KB, in `r1/`)

- **Set Box modal, at 390x844, 844x390 and 1280x720.** I opened 7 boxes at each size: pick UR random, Geometry
  preset UR, Spirit random Mythic, Treasurer random Legendary, pick preset Mythic, Power Bank random UR, Popper
  preset Legendary.
  - No page-level horizontal overflow, and no clipped labels.
  - The pick chooser shows 6 buttons with box icons in a 2-column grid at 390 px. Choosing Treasurer swaps the header
    box to `setbox_treasurer_<rarity>[_random]` and all five pieces to `gear_treasurer_*`.
  - Screenshots: `pick-ur-390x844.jpg`, `preset-ur-844x390.jpg`, `random-mythic-1280x720.jpg`.
- **Backpack Supplies sheet:** each of the 7 box rows shows `boxLine`, for example "Opens 5 Geometry Set pieces · you
  choose the main stats" and "Pick a set: opens its 5 pieces · main stats rolled". No overflow at any size.
  Screenshots: `supplies-390x844.jpg`, `supplies-844x390.jpg`.

## Findings

| # | Sev | Where | Finding | Fix |
|---|---|---|---|---|
| L1 | Low | tools/blender/items/models/boxes.py:71-72 (the UR `tier='rainbow'` straps) | At 64 px the UR boxes' "rainbow straps" read as pale pink/white pastel, not rainbow. A UR box looks *less* premium than the Legendary box with its gold straps, and is close to a plain box at a glance. It is distinct, but only by being paler. The live Rainbow Gear Box reads as rainbow at once. | Use saturated rainbow bands on the straps, or give the UR boxes the lid glow and sparkle of gearbox_rainbow. |
| L2 | Low | boxes.py:147-156 `_choose_tag` | Preset and random differ only by the gold tag, about 9 px at 64 px and about 5 px in the 40 px chooser and the 48 px Supplies tile. It is readable but easy to miss, and on the gold-strapped Legendary boxes the gold tag blends into the gold. | Make the tag about 1.3× bigger, or use a contrasting tag colour (white with the navy pencil) so it stands apart from the strap metal. |
| L3 | Low | src/ui/gearUr.js:538 | In a UR box's modal the five pieces are the plain set looks, identical to the Legendary box of that set, because the set looks have no UR variant (by design). Apart from the title and box icon, nothing in "You get these 5 … pieces" says UR. | Add a `.ur` class on `.gu-sb-piece` when `ur` is set, with the rainbow ring or plate the gear tiles use for UR. |
| L4 | Low | src/ui/gearUr.js:529-541, gear-ur.css | At 844x390 the new header (64 px box, pieces row, bonus) pushes the preset main-stat pickers below the fold. The body is 589 px high in a 270 px viewport and scrolls fine, but nothing hints that the choices continue. | Under `@media (max-height: 480px)`, shrink `.gu-sb-box` to 40 px, drop the duplicate small item name (see N1), and put the pieces' labels on one line. |
| N1 | Nit | src/ui/gearUr.js:534 | The header's small line repeats the modal title word for word ("Geometry Set Preset Box (UR)"). | Show the kind instead, such as "Preset · UR" or "Random · Mythic", or drop it. |
| N2 | Nit | src/ui/gearUr.js:527, :629 | UR is detected by a regex on the id; `getItem(id).setRarity === 'ur'` is the data's own field. The preset picker icons (:629) don't pass `ur`, so on a load error they draw the Legendary piece while the pieces row draws the rainbow one. | Use `it?.setRarity === 'ur'`, and pass `{ set, ur }` at :629. |

**Info (not this branch's to fix):**

- The branch sits on v0.1.66 (sim `b2ff5e0e884b`). Main is now at sim `0fe7c5c04aec` (COOP 15). The branch changes no
  sim files and merges clean with main (`git merge-tree`), so the merge takes main's id.
- There is no patch note on the branch. The release that ships it needs a player-facing line such as "Set Boxes and
  the new gear now have 3D icons; each set has its own look".
