# v0.1.68 "Set Boxes and Awakening" — live check

**Verdict: PASS (LIVE_OK).** No high or medium problems. One low display problem (toasts cover the Set Box results) and three test-harness notes are listed under Problems.

- Live: https://tacosonmondays-pixel.github.io/sakura-game/
- Checked on 2026-10-31, 13:46–15:05 UTC, by an agent that did not ship this release.
- Browser: headless Chromium 153 with SwiftShader WebGL. Every page ran with `?online=local` (plus `onboarding=0` where the script used it), so no test player signed in to live Supabase. The direct-load request logs show no Supabase host at all.

## Deploy

| | |
|---|---|
| Pages run | #68, `a3d97a38…` on `main`, started 13:45:44 |
| `version.json` | `{"version":"0.1.68","build":"a3d97a387a4b","sim":"e3c222f3ad44","time":"2026-10-31T13:56:03.947Z"}` |
| First seen live | 13:56:28 UTC (polled every 30 s with a cache-buster from 13:46:50) |
| Before | 0.1.67 / `eb0b1ab9c2a5` / sim `0fe7c5c04aec` |
| Sim id | `node tools/simId.mjs` at `a3d97a38` gives `e3c222f3ad44`, the same as live. `COOP_PROTOCOL` is 16 in `src/online/coop/version.js`. |

## Results

| Area | Result | How |
|---|---|---|
| Errors and requests | PASS | Live loaded directly at 390x844, 844x390 and 1280x720. No page or console errors. Every response was 200, with no failed requests (counts below). No horizontal overflow. |
| Patch note | PASS | At all three sizes, Notice › Patch notes lists 66 versions with v0.1.68 "Set Boxes and Awakening" (Oct 31, 2026) on top. Claim took gems +100 (2,400 → 2,500) and the button turned into "Claimed ✓". After a reload the gems were still 2,500, the entry still read Claimed ✓ with no Claim button, and `profile.patchGifts['v0.1.68']` was stored. |
| Set Boxes: random Party Popper box | PASS | Driven by hand through the live UI (Backpack › Equipment › Supplies) at all three sizes, on the late-veteran fixture with 4 random Party Popper (Legendary) boxes and 1 Freeze Tag preset box. The row reads "Opens 5 Party Popper pieces · main stats rolled" with Open and Open ×4. One Open gave exactly 5 pieces, all `popper`, one per slot (charm, ribbon, shoes, hair, necklace). |
| Set Boxes: Open ×N | PASS | Same run. "Open ×3" gave one results summary (`data-opened` 3), 15 new pieces, all Party Popper, and 0 boxes left. The repo `gear-slots` e2e against the live files also passed its batch checks at 844x390 and 1280x720: Open ×5 gave 25 Party Popper Legendary pieces, 5 per slot, with rolled mains that were not all the same; a preset batch of 2 read "2 boxes · 10 pieces" and gave 10 Popper pieces, all with the chosen mains (charm ATK, shoes Cost Reduction). |
| Set Boxes: preset modal | PASS | Same hand run. The Freeze Tag box opens a `data-kind="preset"` modal. Its header shows the box icon, "Freeze Tag" and "Preset · Legendary", then "You get these 5 Freeze Tag pieces": Tag Token, Chalk-Line Ribbon, Hopscotch Sneakers, Pause-Button Clip and Tag Timer. Below that come the set bonus and a main-stat picker for each slot (screenshot 02). |
| Set Boxes: icons are 3D art | PASS | Every icon in the modal (the box and the 5 pieces) is a raster image from the live `art/items/` folder, such as `gear_freezetag_charm-128.webp`, not a vector drawing. Screenshots 02 and 03 show the rendered 3D-style icons. |
| LR Awakening | PASS | Repo `e2e/awaken-lr.mjs` against the live files: **52/52 ok**. A UR +12 piece shows ✦ Awaken with no Limit Break button, and "Awakened to LR!" keeps the piece in its set. Five LR pieces of one set wake the LR Set Form (battle stats `setLr: true`). Unbind to Blank LR asks first ("for good") and leaves the set. Blank LR stays an option on an LR set piece. Every action is a tap in the live UI; the script imports local `/src` modules only to build fixture gear and to read battle stats. |
| More page | PASS | Repo `e2e/more-page.mjs` against the live files: **90/90 ok** (and 90/90 on a second run with screenshots). Luna (hero, Lv 25) has her stat grid, DPS live 8,598 / avg 7,137, her aura row, the Moonbeam row ("2 beams · ±45° sweep · 35% of her hit") and the damage split "Attack 100% · Moonbeam <1%". Chika's own panel shows DPS (212 live / 161 avg) and her Drone Surge row. No drawer overflows and nothing reads NaN or undefined (screenshot 04). |
| Sandbox | PASS | Repo `e2e/sandbox-catchup.mjs` against the live files: **87/87 ok** (twice). The run line reads "Normal · Freeplay Blossom · from wave 200". Tenka is at max build (L85 · P6 · ★5 · 10 gates · LR · Geometry ×5 Set LR) and the duo is Lv 60 Blank LR ×5. The battle starts on 4-5 with wave 199 cleared; Send next wave runs wave 200 with the Ashwing Matriarch, and the HUD shows wave 200. Afterwards: "nothing saved: currencies, items, progress, bestiary, stats, missions, achievements, units, gear and formation unchanged". Repo `e2e/sandbox.mjs` against the live files: **79/79 ok**, including that the stored save did not change size (screenshot 05). |
| Stickers | PASS | Repo `e2e/stickers.mjs` against the live files (local adapter, two pages): **31/31 ok** (twice). The clan chat sticker renders at 150×150 from `kage_onit-256.webp`, and a DM sticker renders at 150×150 from `slime_thanks-256.webp`. The co-op bar picker also works (screenshot 06; the names are local test fixtures). |
| Tripo batch 2 | PASS | Repo `e2e/tripo-batch2.mjs` against the live files: all game checks pass. Luna, Yoriko, Nami and Kanna draw as their GLB figures. On 1-6 all 12 family enemies wear their Tripo models (missing: none) and 2 story landmarks are drawn as Tripo models (the clock tower and ticket gates). On 1-10 all 6 bosses and titans wear theirs and the dry fountain landmark is drawn. On 1-9 there is 1 landmark. Norika's Hold the Line barriers and Seiran's dragon head are the Tripo models. **At medium quality the busy 1-6 wave (60 family enemies) loaded all 12 `.lod` files.** There were no errors, and 1,424 live requests all returned 200 (screenshot 07). The two script misses are a harness artifact (Problems, T3). |
| Co-op (COOP 16) | PASS (58/58) | Repo `e2e/coop-freeplay.mjs`, two clients on the local adapter, against the live files. The room pairs and the guest's Ready gates Start. Both Sims run Freeplay Blossom with goal 12, the 12/12 clear card shows on both, and GO BEYOND shows the glitch banner on both screens. **The lockstep state hashes match** past the goal (128 checkpoints) and after wave 20 (128). The Finish lands on the same tick with the same hash on both (tick 29176, hash 1595395393), and `desynced` is false on both. The banner race seen in the v0.1.67 live check did not happen this time. |
| Old save | PASS | At 13:47, before the deploy, the late-veteran fixture was loaded into **live v0.1.67**, and that build wrote it back (91,122 bytes, `saveRev 2`, 24 girls). That localStorage was then loaded into live v0.1.68. A deep compare of every value in the old save against the save v0.1.68 wrote found only `saveRev` 2 → 3 and `saveBy` changed (bookkeeping): all 24 girls, currencies, items, gear, progress, formation, sensei, bonds, story, events and skins were kept. There was no restore, backup or corrupt notice and no errors, and all 194 requests returned 200. The home shows the fixture's own unclaimed beta-tester gift card, as it did on v0.1.67 (screenshot 08). |

## Request counts

Loaded directly from the live host, one fresh browser context each:

| Run | Requests | github.io | fonts | blob | Non-200 | Failed |
|---|---|---|---|---|---|---|
| 390x844 (load, Notice, claim, reload, Notice) | 362 | 330 | 22 | 10 | 0 | 0 |
| 844x390 (same) | 372 | 340 | 22 | 10 | 0 | 0 |
| 1280x720 (same) | 362 | 330 | 22 | 10 | 0 | 0 |
| Set Boxes by hand, 390x844 | 223 | | | | 0 | 0 |
| Set Boxes by hand, 844x390 | 229 | | | | 0 | 0 |
| Set Boxes by hand, 1280x720 | 229 | | | | 0 | 0 |
| Old v0.1.67 save written by live v0.1.67 | 194 | | | | 0 | 0 |
| Old v0.1.67 save loaded on live v0.1.68 | 194 | | | | 0 | 0 |

The repo e2e scripts ran against the live files through a localhost relay, the same method as earlier live checks. The relay served the live build and served only `/src/…` (and Vite's own) fixture imports from a local checkout at the same commit `a3d97a38`. Each script was a copy whose only change was the base URL plus `?online=local`. Live requests through the relay:

| Script | Checks | Live requests | Non-200 |
|---|---|---|---|
| set-box | 57 ok / 6 fail (harness, T1) | 707 | 0 |
| gear-slots | 50 ok / 2 fail (harness, T2) | 404 | 0 |
| awaken-lr | 52 / 52 | 378 | 0 |
| more-page | 90 / 90 (rerun 90 / 90) | 614 (614) | 0 |
| sandbox-catchup | 87 / 87 (rerun 87 / 87) | 500 (498) | 0 |
| sandbox | 79 / 79 | 470 | 0 |
| stickers | 31 / 31 (rerun 31 / 31) | 217 (217) | 0 |
| tripo-batch2 | 32 ok / 2 fail (harness, T3) | 1,424 | 0 |
| coop-freeplay | 58 / 58 | 212 | 0 |

## Problems

No high or medium problems found.

**L1 (low, display): toasts cover the top of the Set Box results card on a returning save.**
- Repro: load a returning veteran save (for example `tests/fixtures/veterans.js` `veteran('late')` plus a random set box), go to Backpack › Equipment › Supplies, and open a box within a few seconds of arriving. At 390x844 the "Hikari's Captain's Journal is here…" toast and the "…joined your… Mailbox" toast sit over the results card's title and summary line. At 844x390 the journal toast covers the "3 boxes · 15 pieces · all …" line (screenshot 03).
- This is the same kind of low as "transient toasts over UI" in earlier live checks, not new in this release. The results stay readable once the toasts fade.

**Test-harness notes (not game defects).** These scripts drive part of the game through a local `import('/src/…')`. Against the live files that import is a second copy of the module with its own store, so live never sees it:
- **T1:** `set-box.mjs` opens the box modal with the local `setBoxModal()`. The open goes into the local store, so "opening the Freeze Tag box gave 5 Freeze Tag pieces" sees none (×3 viewports). Its "no page errors" check also caught Vite's HMR WebSocket trying to reach the relay (×3). Every modal-content check in it passed. The live UI path for the same things passed by hand (the Set Boxes rows above).
- **T2:** `gear-slots.mjs` "Set Box picker: Spirit Squad's idle note for Momo" moves Momo first in the live formation, then opens the picker with the local module, which still has Aoi first ("For Aoi: …").
- **T3:** `tripo-batch2.mjs` "busy wave wears the full files" calls the local `setEnemyDetail('full')`, so live kept its medium choice (the LODs) in both passes. The "LODs cut triangles by 40 %" comparison therefore compared LOD with LOD. The LOD half, the one that matters live, passed.
- Suggestion (test only): reach these through `window.__sakura` / `window.__battle` hooks or the UI, so the scripts also work in live checks.

## Notes on method

- In the 844x390 direct run, the first-run cleanup tapped "Claim gifts" on the beta-tester card instead of "Later", so gems started at 5,400 rather than 2,400. The patch claim was still exactly +100 and stayed claimed after the reload.
- Screenshot 03 was retaken after the results card settled. The `gear-slots` run captured it mid-fade, with the Supplies sheet showing through.

## Screenshots

`docs/review/v0.1.68/live-check/`. All JPEG, the largest is 99 KB.

1. `01-notice-patch-note-390x844.jpg`: Notice › Patch notes with v0.1.68 on top, before the claim
2. `02-preset-set-box-390x844.jpg`: the Freeze Tag preset box with its set header, 5 pieces as 3D icons, the bonus and the main-stat pickers
3. `03-random-box-open-x3-844x390.jpg`: "Open ×3" results for random Party Popper boxes: 15 pieces, mains rolled (a toast over it, L1)
4. `04-more-luna-grid-moonbeam-844x390.jpg`: Luna's More page with her grid, live and average DPS and the "Attack · Moonbeam" split
5. `05-sandbox-wave-200-844x390.jpg`: Sandbox freeplay on 4-5 at wave 200/26, ∞ lives
6. `06-chat-sticker-150px-390x844.jpg`: clan chat with 150 px stickers (the names are local test fixtures)
7. `07-tripo-1-6-family-enemies-landmark-844x390.jpg`: 1-6 with Luna's GLB figure, family enemies on the road, and the landmarks
8. `08-old-v0167-save-home-1280x720.jpg`: the save written by live v0.1.67, loaded on v0.1.68 (the fixture's own unclaimed beta-tester gift card on top)
