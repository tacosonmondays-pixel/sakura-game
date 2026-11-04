# Mock vs live review (Nov 3)

I've built the boards for all 11 battle screens and the 4 meta screens scored 7 or lower: a summary sheet plus 15 per-screen boards. I opened every JPEG with Read and fixed the callout boxes that were in the wrong place; each file is under 300 KB. Only three screens are far from the mocks: the hold sheet, the upgrade tree and the boss warning band. Most of the remaining gaps are approved parts of the battle mocks that nobody built, not things that broke.

The summary is at about q50 to stay under 300 KB, and the battle-heavy boards are at q46–68. They stay readable at full size but are a bit soft. Each board has the mock on the left and the live screen on the right at 844x390, with numbered callouts (red = drift, grey = intentional, amber = unsure) and a list explaining each number and its fix. Where the critique and the reviewers disagreed, I went with the critique. Nothing in /home/user/wt-ship or any repo was touched.

**Files**
- board/summary.jpg (1600 px wide, 17 screens, battle first)
- Battle boards in board/: hud-mid-wave.jpg, placing-ghost-card-rail.jpg, girl-drawer.jpg, hero-drawer.jpg, hold-sheet.jpg, upgrade-tree.jpg, ability-bar-cast.jpg, boss-warning-band.jpg, wave-banner.jpg, pause-menu.jpg, victory-results-rewards.jpg
- Meta boards in the same folder: girl-info.jpg, girl-gear.jpg, girl-tree.jpg, stage-prep.jpg
- The scripts that build them: ./work/data.py and ./work/render.py

**What the critique found:** of the battle part of the owner's Oct 20 pick (M2), only the girl and hero drawers were built (v0.1.57). The HUD strip, the card rail band, the cost strip, the upgrade tree, the hold sheet, the boss band, the results sheet and the pause menu were handed to the abilities lane and nobody picked them up. No later owner decision replaced them, so they are unbuilt work, not regressions.

## Verdicts
| Screen | Verdict | Score | Drift / unsure / intentional |
|---|---|---|---|
| HUD mid-wave | drifted | 5 | 10 / 1 / 0 |
| Placing (ghost + card rail) | close | 6 | 5 / 0 / 0 |
| Girl drawer | close | 8 | 2 / 2 / 4 |
| Hero drawer | close | 7 | 3 / 1 / 1 |
| Hold sheet | far | 2 | 8 / 0 / 0 |
| Upgrade tree | far | 2 | 6 / 0 / 0 |
| Ability bar + cast | close | 7 | 2 / 2 / 2 |
| Boss warning band | far | 2 | 3 / 1 / 0 |
| Wave banner | far | 3 | 2 / 0 / 1 |
| Pause menu (no mock) | close | 6 | 4 / 1 / 0 |
| Victory, results, rewards | drifted | 4 | 7 / 0 / 0 |
| Girl page: Info | drifted | 6 | 3 / 1 / 2 |
| Girl page: Gear | drifted | 6 | 3 / 0 / 2 |
| Girl page: Tree | close | 7 | 3 / 0 / 1 |
| Stage prep | close | 7 | 2 / 1 / 3 |

Backpack gear and Achievements scored 8, so they are in the summary only, with no board.

The wave banner score of 3 is the reviewer's. With its redesign marked intentional, only two small drifts are left.

## Drifts and fixes
**HUD mid-wave**
1. The top strip is a full-width white glass bar. Remove the `.bt-hud` background, shadow and `::after`. Make `.bt-stat`/`.bt-wave` ink plates (`--plate-glass`, wave number in `--plate-accent`) and add the segmented WAVE bar (battle.css:30-69).
2. The HUD shows 7 numbers against a budget of 4 (P3). Drop the wave number after NEXT and hide ×7 until tapped (scout.js:205, 112-113).
3. The '1-2 NORMAL' chip should move to pause (§6.6), and the pill is 10.9 px. Hide `.bt-stage-label` on campaign stages (hud.js:37-50).
4. A navy band sits behind the card rail. Remove its background, blur and clip-path, give each card a soft shadow, and left-align the cards (battle.css:143-151).
5. The cost strip is too small. Make `.bt-card-cost` 22 px tall at `--fs-num-s` in `--plate-accent`, and add 4 px to the card (battle.css:162).
6. The HERO tag, New! sticker and WAVE label are under 12 px. Use `--fs-label` and drop the 0.56rem override (battle.css:71, 102-105, 170, 979).
7. Hero card: keep FREE (intentional, HERO_REWORK). Make the HERO tag 12 px, add a rarity tag top-left, and hide the tag when she is Deployed.
8. At 390x844 the hero widget row covers the road bend above the goal. Extend the v0.1.58 lift check to that part of the path.
9. Before wave 1 the HUD reads 'WAVE 0/12'. Show 1/12 or hide the number.
10. In the battle-hud capture the hero was never placed. Re-stage the capture before this goes to the owner.

**Placing**
1. The selected card has a yellow ring. Use a 2 px white border and a 3 px pink selected ring (P8; battle.css:153-157, 184).
2. The cost strip is too small (same fix as the HUD).
3. A placed girl's card has no marker. Add an 'ON FIELD' caps strip (towerBar.js:120-150).
4. HERO tag at 12 px; keep FREE.
5. Remove the rail band (battle.css:143-149).

**Girl drawer**
1. At 390x844 the sheet covers 54–64% of the screen (P1 allows 50%), and the card rail shows through the footer. Make `.bt-panel-foot` solid `var(--plate)`, hide `.bt-bar` while a portrait sheet is open (ABILITIES §8.1), and fold the ability stat line into the first tap (battle.css:589-591, 985-990).
2. The armed row's effect chips look 10–11 px. Measure them and raise to `--fs-label` if they are under 12 px.

**Hero drawer**
1. Add the UR tag to the header (§6.6; towerPanel.js:670).
2. The XP bar reads as a divider at LV 1. Give it a 1 px `--plate-line` outline and a minimum fill (battle.css:618-620).
3. Tint the hero range ring pink (P8; renderer selection ring).
4. Low drift: at 1280, hide START while a drawer is open (P2).

**Hold sheet**
1. It is still the old pre-6.1 grid with a card column. Rebuild to §6.1: drop `cardPanel()`, render nodes only (state rings, prices on next cells), and put `tierDetail()` in a 236 px right column (upgradeTree.js:258-283, 378-411; upgradeGrid.js).
2. About 35 numbers against 8 in the mock; this follows from the rebuild.
3. Three header status chips become one `--plate` chip, 'Not placed · stage prices'.
4. Use one tag per path row instead of tags in every cell.
5. Text is 9–10 px with ellipsis and mid-word breaks. Raise to `--fs-label`/`--fs-body` and remove the ellipsis (unit-info.css:25, 102, 292, 298, 368).
6. The rule paragraph sits on the main view (seen at 390 and 1280). Move it behind the 'i' (upgradeTree.js:279, 405).
7. The ability hold card clips off the top edge and covers the HUD. Subtract `--herow-lift` in max-height too and cap top at `--bt-hud-h` + 6 px (battle.css:1651-1653).
8. The hold card footer looks under 12 px. Measure it.

**Upgrade tree**
1. Same §6.1 rebuild as the hold sheet.
2. The tree has no Buy button, which the owner asked for on Oct 20 ('The full tree keeps its own Buy button'). Add a cost button in the detail panel that sends the drawer's upgrade command (co-op safe).
3. The locked path is at opacity 0.5 and its text is cut off. Remove `.ut-cell.s-blocked > * {opacity:.5}`, use a lock-tinted ring with muted text at 4.5:1 or better, and one lock line with an 'i' (unit-info.css:119-123).
4. About 35 numbers against 7 in the mock (follows from the rebuild).
5. Drop the 'Yours' chip and use a `--plate` header.
6. At 390, names break mid-word. Show 5 nodes per row with names under the icons at `--fs-label`, and use `hyphens: manual`.

**Ability bar + cast**
1. At 390x844 every slot folds into '+3'. Keep 3 slots visible before +N (ABILITIES §8.1).
2. The slots sit flush on the rail and the ×2 sticker overlaps the band. Lift the bar or drop the band.

**Boss warning band**
1. It uses a generic 'BOSS INCOMING' ribbon instead of the owner's M2 pick. Add an announce kind `bossband`: hazard stripes, a 'BOSS · PHASE n/N' kicker, the name in `--fs-display`, and one traits line (controller.js:1101-1104, feed.js:179-196, battle.css:316-334).
2. It holds for 1.4 s on phones and 2.6 s on desktop. Clamp to 1.2 s everywhere (feed.js:184).
3. At 390, the boss bar's peek state drops to 0.62 opacity. Keep the name and HP on a full-opacity `--plate-glass` pill.

**Wave banner**
1. 'of 14' repeats the HUD (P7). Use the sub-line for a threat summary or drop it.
2. At 1280 it holds 1300 ms. Make it 1200 ms (controller.js:1119).

**Pause menu**
1. No `--plate` header or 44 px close, and the settings are cut off at 844. Fold Settings so the actions fit (pauseMenu.js:79-93).
2. The difficulty is printed twice. Print the mode name only when it isn't 'standard' (modes.js:280-284).
3. `.bt-seg` has no CSS, so its controls render as grey browser buttons about 26 px tall. Reuse `.ma-seg` or add rules at `--tap-dense`.
4. The HUD stage chip still shows (see HUD fix 3).

**Victory, results, rewards**
1. The stat tiles are light and Leaks was dropped. Move the tiles onto an ink strip (3 cells plus MORE).
2. The Victory view has no drops and no Next Stage. Add a drops row and a Next Stage primary, turn Rewards into a secondary Details, and move Time into MORE (M4; results.js:233-305).
3. The freeplay block is on light paper. Move it onto a plate and put its rule sentence behind 'i'.
4. 'Bestiary updated' is cut by the sticky footer. Collapse it to one chip row (results.js:371-373).
5. Coins print as 'x2817'. Format as '×2,817'.
6. Hide zero damage rows ('Momo 47 dmg · 0%').
7. A stale FINAL WAVE ribbon stays up after a win. Hide it once the battle is won or lost (scout.js:195-205).

**Girl page: Info**
1. The ability line (intentional) pushes Matchup and Potential below the fold. At max-height 480px make it a 32 px chip on the sentence line (student.js:502; v2-roster.css:156-160).
2. The rarity 'R' is nearly invisible. Give it a ring, padding, and 4.5:1 colour (ink.css:1145).
3. At 390, the trait chips lose their +N count. Keep the more-chip.

**Girl page: Gear**
1. The main stat chip lost its value. Always show the main value in compact mode (§6.2; girlGear.js:131-135).
2. The From Gear strip is below the fold (the five slots are intentional). Use a container query for 5 columns at 520 px or wider (girl.css:318-320).
3. Gear tiles are flat. Add the §5.7 sheen.

**Girl page: Tree**
1. The empty side pane squeezes the grid at 844. At max-height 480px use one column and show the detail in a sheet after a tap (girl.css:177-178).
2. The first row mixes two node icon styles. Give the line-glyph tiers the fill disc.
3. At 1280 the pane is empty until a tap. Show the next tier there by default.

**Stage prep**
1. The stage title shrank to a label of about 15 px. Use `clamp(20px, 2.6vw, 30px)` with the id in `--plate-accent` (v2-stage.css:56-60).
2. At 1280 the layout doesn't grow. Widen the map column and drop the `.stp-foot` `margin-top: 4px` override so Start sits bottom-right (v2-stage.css:37-38, 235-237).

## Intentional (no change needed)
- **Path look:** the drawer's pink/cyan/gold paths with pips, and the girl tree's path colours, follow the one shared path colour set (v0.1.73). The gold capstone ring is a low follow-up.
- **Drawer:** the tier line shows only on the armed row (the owner's two-tap buy). The reviewer's 'show every description at 701 px and up' fix is dropped. The MORE ink chip and the hidden TARGET label at 844 also stay.
- **Hero drawer:** the yellow Level up price button stays (owner default Q7).
- **Ability bar:** 8 slots at 844 is allowed (§8.1 allows 11). The reviewer misread the ×2 copy sticker as '+2', so the 'cap at 3' fix is dropped. Slot anatomy follows the M0 tokens.
- **Wave banner:** the small ribbon stays. The owner picked the tactical draft only for the drawer and the boss band.
- **Hero card:** the FREE strip stays (HERO_REWORK).
- **Victory:** the medal instead of an S rank, damage behind a tap, and the 'Wave 15/14' label (FREEPLAY.md) all stay.
- **Girl page:** the Ink & Paper surface (owner Oct 27) and no yellow MORE (Q5) stay. The Info ability line stays (only the fold is drift), and so do Gear's five slots and its loadout row (the row's placement is a low drift).
- **Stage prep:** no currencies in the top bar (wallets per route), the mode chip in the difficulty panel, and the mission line on bare paper all stay.
- **Backpack:** no main-stat value at 1280 (owner Oct 20: Salvage mode only).

## Questions for the owner
1. With the drawer open, the HUD and drawer show 23 numbers, or about 20 after the HUD fix. Is that enough, or should more go? (M2 note, still open.)
2. Should the hero ult ring be fill only (§6.6), or also show seconds (P3, ABILITIES §8.2)?
3. Should the hero drawer hug its content, as in the mock, or run full height (§5.4)? This also covers the empty plate under the girl drawer's paths at 1280.
4. Can the girl page keep 6 tabs (COACH), or should COACH move to a '⋯' tab (§5.3 allows 5)?
5. Should the stage prep difficulty buttons get their tier colour bars back?
6. Should the boss bar's 'HP / HP' (2 always-on numbers) count in the HUD budget, or show only on tap or a phase change?
7. Cast effects are hard to pick out among the girls. Send this to the VFX track (feature/vfx-blasts B6)?
8. At 1280, the pause settings rows print helper sentences. Send this to the Nov 3 'cut helper text' track?

## Top 8 fixes
1. Rebuild the upgrade tree and hold sheet to §6.1 (node rows, prices only on next cells, a right detail panel), give the tree its own Buy, remove the 0.5 lock, ellipsis, per-cell tags, card column and repeated rule, and clamp the ability hold card under the HUD. Files: upgradeTree.js, upgradeGrid.js, unit-info.css, battle.css:1651-1653.
2. Build the boss warning band (hazard stripes, 'BOSS · PHASE n/N', display name, traits line) and clamp it to 1.2 s. Files: controller.js:1101-1104, feed.js:184, battle.css:316-334.
3. Restyle the HUD top strip as floating ink plates with a segmented WAVE bar, drop the NEXT number, ×N counts and stage chip, and get to 4 numbers plus speed. Files: battle.css:30-76, scout.js:205, hud.js:37-50.
4. Card rail: remove the band, left-align the cards, use the 22 px cost strip, a white border with a pink selected ring, 12 px labels and an ON FIELD strip, and hide the HERO tag when deployed (keep FREE). Files: battle.css:143-185, 979; towerBar.js.
5. 390 portrait: show 3 ability slots before +N, a solid drawer footer with the rail hidden, coverage of 50% or less, and the hero widget clear of the road bend. Files: abilityBar.js, battle.css:589-591, 985-990.
6. Pause menu: style `.bt-seg`, add a `--plate` header with close, print the difficulty once, and fold Settings. Files: pauseMenu.js, modes.js:280-284, battle.css.
7. Victory and Rewards (M4): drops and Next Stage on the Victory view, an ink stat strip, the freeplay block on a plate with its rule behind 'i', clear the FINAL WAVE ribbon, format ×2,817 and hide 0% rows. Files: results.js:126-150, 233-305, 371-373; scout.js:195-205.
8. Hero drawer and widget: UR tag, pink range ring, legible XP bar, plus the two owner questions (height, ult ring seconds). Files: towerPanel.js:670-683, battle.css:618-620, 1013, heroWidget.js:114, the renderer's selection ring.
