# v0.1.66 audit D: what players see, and phones

Target `release/v0.1.66` @ 94cb548b vs live `main` @ c34f7bd3. Auditor D (independent; did not build it). Machine: 4 cores, SwiftShader WebGL.

## Verdict: NO-GO (one blocker, one patch-note fix)

## Findings

**B1 (blocker): players cannot Limit Break. The patch note's headline LR feature has no button anywhere.**
- The `Limit Break` and `Pin` buttons were added only to `gearActions()` (`src/ui/gearUr.js:232-233`). Nothing calls `gearActions()`: it is imported in `src/ui/screens/backpack.js:50` but never used, and it was already unused on main.
- The piece sheet players actually see is `pieceActions()` in `src/ui/girlGear.js:307-331`. Both the Backpack's piece sheet and a girl's slot sheet use it. It offers Enhance (MAX +12), Reroll subs, Change main, Stitch ✦, Club and Lock, but no Limit Break.
- The Nightglass Lens has no `usable` (`src/data/items.js:245`), so the Backpack has no "Use" path either.
- Verified in the browser at all three viewports: a UR +12 set piece with 3 Lenses and 50M coins shows these buttons: `DETAILS › | MAX +12 | REROLL SUBS | CHANGE MAIN | STITCH ✦ | JOIN A CLUB | UNLOCK` (shots `gear-piece-ur-*`).
- Knock-on effects:
  - The Build Coach's `coach-lr` row (`src/ui/buildCoach.js:122`; `features().lr` is always true, `src/systems/buildCoach.js:67`) advises a Limit Break the player can't do.
  - The achievements `a_lr_first` and `a_lr_form` can't be earned.
  - The `w_nightglass` weekly mission pays out a Lens that has no use.
- **Fix:** in `pieceActions`, add `isUrGear(g) && !isLrGear(g) && g.level >= UR_MAX_LEVEL ? sec('Limit Break', { testid: 'gear-limit-break', onClick: () => limitBreakModal(g.uid, { onDone: onChange }) }) : null`. Add an e2e that taps it from the slot sheet.
- When reached directly, the modal itself works:
  - The Blank LR confirm appears, and Cancel leaves the piece untouched (`lr 0`).
  - Set LR gives `lr 1` and keeps the set.
  - The Nightglass ✦ slot shows in Stitch.
  - Five Blank LR pieces double the caps in Gear totals: crit 150, Crit DMG 400, Range 100, Armor Pierce 80, Cost 50, Skill Haste 100.
  - No sideways overflow at 390, 844 or 1280.

**P1 (must fix): the patch note promises pins.** `src/data/patchNotes.js:25` says "LR gear with Limit Break, Set Boxes and pins".
- `itemSources('tie_pin')` and `itemSources('collar_pin')` are both empty. No shop, drop, mission or mail gives pins (the coach hides its pins row for exactly this reason).
- **Fix:** drop "and pins". Keep "LR gear with Limit Break" only once B1 is fixed.
- Set Boxes are fine to promise: they arrive by mail as the welcome box and Titan-clear boxes (`src/systems/gearSets.js:235-256`), although "Where to get" shows nothing for them.

**L1 (low): other UI still promises pins.**
- The Limit Break modal text says "…and a second Collar Pin" (`src/ui/gearUr.js:647`).
- The `Pin` button lives in the dead `gearActions`, so players never see it.
- The pin modal shows "Need pin + coins" on every row, but players can only reach it with a pin in hand.
- Suggest cutting "and a second Collar Pin" until pins ship.

**L2 (low): copy reads "Keeps the Geometry Set set" / "leaves the Geometry Set set"** (`src/ui/gearUr.js:640-641`, `:657`). Set names already end in "Set" for Geometry. Fix: use `${name}` without the trailing "set" when the name ends with "Set".

**L3 (low): LR pieces are tagged "UR".** `src/ui/gearTile.js:84` (and the sheet's tag) uses the UR rule, so a Blank LR piece reads `UR` (shot `gear-piece-ur-1280x720`). Optional fix: an LR tag/look.

**Patch note otherwise:**
- 5 bullets, friendly, no player names, no other games' names.
- The 16 girls' shapes, Ena's spreading rot, Iroha's mirrors (3 per Iroha, Auto on) and the duo's map-wide laser are all visible in play.
- Date `2026-10-30` is correct now: it was 19:32 CDT on Oct 30 when checked. **If it deploys after midnight Central (05:00 UTC Oct 31), change the date to 2026-10-31.**

## Play-through (my probe, 0 page/console errors in all 15 runs)

- Campaign 3-2 at all three viewports: Kanna (hero), Momo, Kage, Hotaru, Akane, Umeko, Chigusa, Yuki.
- Freeplay Blossom wave 180: Luna (hero), Fuu, Ena, Midori, Raika, Rei, Miko, Suzu.
- Freeplay wave 120: Iroha ×2 (3 mirrors each, Auto), Kohaku & Tsubaki, and others.
- Effects render. The flash guard's load peaked at 0.055 of 3 screens, with no refusals needed.
- With Reduce motion on, and with Flashes & shake off, there were no shakes, impacts or hit-stops (`renderer.vfx`). Caveat: these boards produced no shake at all even with the setting on, so this shows nothing leaks through when off, not that the toggle actively cuts something.
- No overlaps between battle boxes at 844 or 1280. At 390 the girl panel covers the tower bar (portrait bottom-sheet design; the bar shows faintly through the panel's foot), as on main.

## Perf

- **Branch vs main, alone on a quiet machine:** `solo-freeplay-perf --waves 200,250 --seconds 20 --warmup 60`.

  | Wave 200 | Branch | Main |
  |---|---|---|
  | Sim per frame, median | 5.9 ms | 4.8 ms |
  | Sim per frame, p95 | 13.1 ms | 10.1 ms |
  | Frame median (SwiftShader) | 454 ms | 550 ms |

  That is a modest sim growth of about 20%.
- Both branch and main sometimes fail the "no hang" check on a multi-second SwiftShader shader compile. This is pre-existing.
- Wave 250 measures 0 enemies on both (the jump probe is broken there, pre-existing).
- In the chained run under load the script exited 0 but measured empty boards, so its numbers are invalid.
- Late Freeplay with 8 reworked girls in my probe: frame median 133–183 ms on phones (software GL; compare only with each other).
- **Bundle:**
  - JS 5.22 → 5.42 MB raw (+203 KB, +3.9%).
  - The `mods` chunk grew from 20 KB to 231 KB (6 KB → 75 KB gzip).
  - The entry `index` chunk grew from 61 KB to 70 KB.
  - No new public assets.
  - About 10.6 MB of review media was added under `docs/review/` (not shipped, none over 2 MB).

## Gates

| Run | Result |
|---|---|
| Full `npm test` (under heavy parallel load) | 6631 passed, 5 failed, 11 skipped (422 files) |
| The 5 failures re-run alone (`perf.test`, `perf.mirror.test`, `rules.test` 4-1/4-2) | **37/37 pass**: timing flakes under load (budgets and a 5 s timeout) |
| `e2e/smoke.mjs` (3 viewports) | pass |
| `iroha-mirrors` | pass |
| `recruit-cinematic --viewport 390x844` | pass |
| `item-art --expect-art` | pass |
| `tryout --viewports 844x390,1280x720` | pass (the Weekly flake did not occur this run; nothing new) |
| `attack-shapes-board` | pass |
| `gear-slots`, `buildCoach`, `teams` (loadouts bar) | pass |
| `vite build` | OK |
| Secret scan | only the known false positive `dist-*.js` (`sb_secret_` prefix check in the Supabase library; same file on main) |

## Shots (`docs/review/v0.1.66/shots/`)

- `play-campaign-A-*`, `play-freeplay-B-*`, `play-freeplay-C-*` (mirrors and laser), `play-rm-on-844x390`, `play-fx-off-844x390`
- `gear-piece-ur-*` (B1: no Limit Break), `gear-limit-break-modal-*`, `gear-blank-confirm-*`, `gear-stitch-lr-844x390`, `gear-pin-modal-1280x720`, `gear-aoi-gear-blank5-390x844`, `gear-aoi-totals-caps-*`
- `coach-*`, `teams-loadouts-*`, `gear-slots-*`
