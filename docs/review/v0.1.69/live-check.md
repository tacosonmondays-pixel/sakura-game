# v0.1.69 "Co-op Sharing, Boss Traps and Fresh Portraits": live check

**Verdict: PASS (LIVE_OK).** All five areas pass at 390x844 and 1280x720. No high, medium or low game problems were found. There are two notes on method below.

- Live: https://tacosonmondays-pixel.github.io/sakura-game/
- Checked on 2026-10-31, 22:00–22:20 UTC, by an agent that did not ship this release.
- Browser: headless Chromium 153 with SwiftShader WebGL. Every page ran with `?online=local` (plus `onboarding=0`), so no test player signed in to live Supabase, and the direct-load request logs show no Supabase host.

## Deploy

| | |
|---|---|
| `version.json` | `{"version":"0.1.69","build":"63ba0100bd2b","sim":"e4001588f40b","time":"2026-10-31T21:58:12.558Z"}` |
| Before | 0.1.68 / `a3d97a387a4b` / sim `e3c222f3ad44` |
| Sim id | `simId()` from `tools/simId.mjs` at `63ba0100` gives `e4001588f40b`, the same as live. `COOP_PROTOCOL` is 17 in `src/online/coop/version.js`, up from 16, as the sim change requires. |

## Results

| Area | Result | How |
|---|---|---|
| 1. Load, errors and requests | PASS | Live loaded directly at 390x844 and 1280x720 (`tools/direct.mjs`). No page or console errors, no horizontal overflow. 360 requests at each size: 328 github.io, 22 fonts and 10 blob. All returned 200 and none failed. |
| 1. Patch note and gift | PASS | At both sizes, Notice › Patch notes lists 67 versions with v0.1.69 "Co-op Sharing, Boss Traps and Fresh Portraits" (Oct 31, 2026) on top. Claim took gems +100 (2,400 → 2,500) and the button turned into "Claimed ✓". `profile.patchGifts['v0.1.69']` was stored. After a reload the gems were still 2,500 and the entry still read Claimed ✓ with no Claim button, so the gift can be claimed only once (screenshot 01). |
| 2. v3 portraits | PASS | `tools/portraits-boss.mjs` uses a save that owns all 39 girls, at both sizes. **Girls list:** 39 portraits, every one of the 24 v3 girls shown with `?v=<her manifest hash>`, none broken. **Girl pages** (Suzu, Norika, Hikari): 2 portraits each, v3 with `?v=`. **Squad:** 45 portraits, 32 v3 with `?v=`. **Battle tower bar:** 8 portraits, the 7 v3 girls with `?v=` (Azami is not a v3 girl, so her portrait carries no `?v=`). **More page header** (Suzu's panel): her v3 thumb with `?v=`. No v3 portrait was missing its `?v=`. Every `/art/portraits/` response returned 200: 52 at 1280x720 (35 with `?v=`) and 58 at 390x844 (40 with `?v=`). Separately, the sha-256 prefix of each v3 girl's live full, card, bust and thumb files matches `src/art/portraitsV3.js` for **all 24 girls**, so live is serving the new files (screenshots 02–04). |
| 3. Boss traps (Suzu and Azami) | PASS | At both sizes, on 1-5 Normal, Suzu and Azami were placed by the road and given tier 2 on each path. The battle was then staged to wave 18, the Slime Prince wave. The Prince's HP was topped up so he stayed on the road. **Suzu set bells under him:** up to 5 at once, 4 of them riding on him. **Azami laid a strip under him.** In the More page, Suzu's panel shows **"Boss bells: 2 set under a boss in range · ride on it, ring every 1s · flying or not · up to 6"** and Azami's shows **"Boss strips: 2 laid under a boss in range · a boss on one: struck every 0.1s · until its hits run out"** (screenshots 05–08). |
| 4. Co-op sharing (COOP 17) | PASS (40/40) | Repo `e2e/coop-sharing.mjs` against the live files: two pages, local adapter, 1-1 Easy. The room pairs and the battle starts on both pages. **Coin gift:** the guest sent 104 coins with "Send coins" and they landed in the host's wallet on both screens ([436,416] → [540,312]), with both feeds saying so. **Lend:** "Lend to Bea" made Aoi the guest's to command on both screens, and the guest bought her a tier for 90 coins from the guest's own wallet. The host's "Take back" was disabled during the wave and enabled between waves. **Take back:** Aoi came back to the host with the tier the guest bought. **Hashes agree** after the gift, after the lend, upgrade and take-back, and before the guest left. **Leave:** the host's co-op line counted down 20 s and nothing moved during it. After that, the guest's girls, the lent Aoi and the guest's 289 coins became the host's, and the host upgraded a handed-over girl. No page errors (screenshots 09–12; "Aiko" and "Bea" are the script's fixture names). |
| 5. Old v0.1.68 save | PASS | The `tests/fixtures/veterans.js` `veteran('late')` save was loaded into a production build of `a3d97a38` (build `a3d97a387a4b`, sim `e3c222f3ad44`), served locally. That build wrote it back as 91,176 bytes with `saveRev 2` and 24 girls. The same localStorage was then loaded into live v0.1.69 at 390x844 and 1280x720. A deep compare of every value in the old save against the save v0.1.69 wrote found only `saveRev` 2 → 3 and `saveBy` changed (bookkeeping). Nothing was lost: 24 girls, coins 20,000, gems 2,400, and all items, gear, progress and formation kept. There was no restore, backup or corrupt notice and no errors, and all 190 requests returned 200 (screenshot 13: the fixture's own unclaimed beta-tester gift card on top). |

## Request counts

| Run | Requests | Non-200 | Failed |
|---|---|---|---|
| Direct live 390x844 (load, Notice, claim, reload, Notice) | 360 | 0 | 0 |
| Direct live 1280x720 (same) | 360 | 0 | 0 |
| Old save on direct live, 390x844 | 190 | 0 | 0 |
| Old save on direct live, 1280x720 | 190 | 0 | 0 |
| Relay: portraits and boss traps, both sizes (live fetches) | 484 | 0 | 0 |
| Relay: coop-sharing (live fetches) | 202 | 0 | 0 |

## Notes on method

- Items 2–4 ran through a localhost relay (`live-check/tools/relay.mjs`), the same method as earlier live checks. It serves the live build for every path and serves only `/src/…` and Vite's own paths from a local checkout at the deployed commit `63ba0100`. The relay ran `src` helpers only to grant girls to the live store's profile object and, in coop-sharing, to plan placement spots with a local `createCoopSim`, which uses the same sim id as live. Every UI action, command, hash and check went through the live build's own `window.__sakura` / `window.__battle`.
- The co-op harness takes its screenshots at 844x390 and 1280x720, its built-in sizes, not at 390x844. The co-op battle is a landscape view.
- To stage item 3, the script set `sim.wave = 17` before starting the wave, kept the boss's HP topped up and placed the girls with `sim.placeTower`. In the 1280x720 still (05), the Slime Prince's "PHASE SHIFT" banner partly covers the middle of the board. The bells on the boss are visible at the top right. The hero card's "Tap anywhere… deploy Hikari" prompt was left armed by the script. Neither is a game problem.

## Screenshots

`docs/review/v0.1.69/live-check/`. All JPEG, the largest is 145 KB. No player names appear. "Sensei" is the default name, and "Aiko" and "Bea" are test fixture names.

1. `01-patch-note-v0169-390x844.jpg`: Notice › Patch notes with v0.1.69 on top, before the claim
2. `02-girls-list-v3-390x844.jpg`: the girls list with v3 cards (Suzu, Akane)
3. `03-girl-page-suzu-v3-1280x720.jpg`: Suzu's page with her v3 portrait
4. `04-squad-v3-1280x720.jpg`: the squad screen
5. `05-boss-bells-strips-1-5-1280x720.jpg`: 1-5 wave 18, the Slime Prince with Suzu's bells on him and Azami's strip
6. `06-boss-bells-strips-1-5-390x844.jpg`: the same at phone size
7. `07-more-boss-bells-suzu-1280x720.jpg`: Suzu's More page with the "Boss bells" row and her v3 header thumb
8. `08-more-boss-strips-azami-390x844.jpg`: Azami's More page with the "Boss strips" row
9. `09-coop-gift-sheet-844x390.jpg`: the co-op "Send coins" sheet
10. `10-coop-lent-in-guest-1280x720.jpg`: the guest's drawer, "Lent by Aiko · Give back"
11. `11-coop-grace-countdown-844x390.jpg`: the host's grace countdown after the guest left
12. `12-coop-handed-over-1280x720.jpg`: the guest's girls handed over to the host
13. `13-old-v0168-save-home-1280x720.jpg`: the save written by the v0.1.68 build, loaded on live v0.1.69

`live-check/tools/` holds the scripts used: `relay.mjs`, `direct.mjs`, `portraits-boss.mjs` and `oldsave.mjs`.
