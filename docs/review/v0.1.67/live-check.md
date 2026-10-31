# v0.1.67 "Ribbons, Frames and Stickers" — live check

**Verdict: PASS (LIVE_OK). One low remains: a race in the co-op e2e script itself, which existed before this release (see Problems).**

- Live: https://tacosonmondays-pixel.github.io/sakura-game/
- Checked on 2026-10-31, 07:26–08:00 UTC, by an agent that did not ship this release.
- Browser: headless Chromium 153 with SwiftShader WebGL. Every page ran with `?online=local&onboarding=0`, so no test player signed in to live Supabase. The request log shows no Supabase host at all.

## Deploy

| | |
|---|---|
| Pages run | #67, `eb0b1ab9c2a5…` on `main`, started 07:11:33 |
| `version.json` | `{"version":"0.1.67","build":"eb0b1ab9c2a5","sim":"0fe7c5c04aec","time":"2026-10-31T07:25:30.885Z"}` |
| First seen live | 07:26:00 UTC (polled every 30 s with a cache-buster from 07:12) |
| Before | 0.1.66 / `fc978aba885e` / sim `b2ff5e0e884b` |

## Results

| Area | Result | How |
|---|---|---|
| Errors and requests | PASS | Live loaded directly at 390x844, 844x390 and 1280x720. No page or console errors. Every response was 200, with no failed requests (counts below). No horizontal overflow. |
| Patch note | PASS | At all three sizes, v0.1.67 "Ribbons, Frames and Stickers" (Oct 31, 2026) is the top entry under Notice › Patch notes. Claim 100 took gems from 2,400 to 2,500 and the button turned into "Claimed ✓". After a reload the gems were still 2,500, the entry still read Claimed ✓ with no Claim button, and `profile.patchGifts['v0.1.67']` was stored. The repo's patch-notes e2e also passed against the live files (844 and 1280): 65 versions listed, a double claim refused, Claim all, and the red dot clears. |
| Frames and titles pickers | PASS | Repo cosmetics e2e against the live files: **75/75 ok** at all three viewports. Edit Profile shows Default plus 14 frames, and the unearned secret frame reads "???" and stays locked. In the title picker an unearned secret reads "✦ ??? Hint: Cutting it close is fine… once." |
| Secret titles on a fresh save | PASS | Same run. "titles: a save without the secrets shows neither secret title nor how it is earned." |
| Achievements tab leaks no secret names | PASS | Same run. The secrets sweep scanned the whole DOM, attributes included, across 17 views: the Achievements list, the Secret category, every secret row's sheet, its chips and the Titles sheet. A fresh save showed **no** secret reward name and no secret how-to line. With the secrets found, every name shows. |
| Profile banners | PASS | Repo profile-banners e2e against the live files: **48/48 ok** at three viewports. The picker shows 34 banners, 20 of them new. Locked tiles are exactly the unmet ones, and tapping one shows its rule ("Summit Nest: Achievement 'Two Hundred Strong': Reach wave 200 in any freeplay.") without picking it. Nightglass Sky draws on the profile and in Preview. The painted Pumpkin Lantern Night banner loads. |
| Chat sticker picker | PASS | Repo stickers e2e against the live files, local adapter, two pages: **24/24 ok**. The clan chat picker opens with 16 stickers (9 owned, 7 locked) and the other player sees the sticker. A DM sticker works and the inbox line reads "Sticker: Thanks!". The co-op bar picker, the rate limit, mute, the setting off and unknown ids are also covered. |
| 4 slime stickers render | PASS | `slime_hi/thanks/oops/gg` decode at 128 and 256 px from the live site, and all four show as owned tiles in the picker (screenshot 05). |
| Settings toggle | PASS | Settings › Account › Online has "Show stickers from other players" (on by default) at all three sizes. |
| 3D models | PASS | Sandbox, 4-6 Toll Plaza, 1280x720, with each of the five Brigade enemies spawned from the Sandbox panel. All five Brigade models fetched 200: `tripo/brigade_gnat`, `brigade_trooper`, `brigade_shieldline`, `brigade_tortoise` and `brigade_badger`. Kogane was placed (`characters/kogane.glb` 200) with Big Yellow (`props/big_yellow.glb` 200). Norika was placed (`characters/norika.glb` 200) with her barricade (`props/norika_barricade.glb` 200). Both render (screenshots 06 and 07). No console errors, and all 218 requests in each run returned 200. Suzu's bells were not loaded in this run. |
| Co-op (COOP 15) | PASS (57/58 e2e, the 1 miss is a script race) | Repo `e2e/coop-freeplay.mjs`, two clients on the local adapter, run against the live files through the relay. The room pairs, the guest's Ready gates Start, and both Sims run Freeplay Blossom with goal 12. The 12/12 clear card and the clear are banked once on each client. GO BEYOND puts both HUDs on 13/12. **The lockstep state hashes match on both clients** after the goal (126 checkpoints) and after wave 20 (127). The Finish lands on the same tick with the same hash on both (tick 28748, hash 3550052665), with FREEPLAY COMPLETE "20/12" on both. No desync, no page errors. The one failed check is a race in the script (Problems, L1). |
| Old save | PASS | At 07:13, before the deploy, the late-veteran fixture was loaded into **live v0.1.66** and that build wrote it back (91,134 bytes, `saveRev 4`). That localStorage was then loaded into live v0.1.67. All 24 girls and 29 achievements were kept, and no value was lost in units, currencies, progress, gear, inventory, formation, sensei, bonds or teams (deep compare). It was re-saved as `saveRev 5` (91,169 bytes). No restore, backup or corrupt notice, no errors, 190 requests all 200. |

## Request counts

Loaded directly from the live host, one fresh browser context each:

| Run | Requests | github.io | fonts | data/blob | Non-200 | Failed |
|---|---|---|---|---|---|---|
| 390x844 (load, Notice, claim, reload, Settings) | 359 | 326 | 23 | 10 | 0 | 0 |
| 844x390 (same) | 366 | 333 | 23 | 10 | 0 | 0 |
| 1280x720 (same + slime images) | 374 | 341 | 23 | 10 | 0 | 0 |
| Sandbox + Kogane | 218 | | | | 0 | 0 |
| Sandbox + Norika | 218 | | | | 0 | 0 |
| Old v0.1.66 save on v0.1.67 | 190 | | | | 0 | 0 |

The repo e2e scripts ran against the live files through a localhost relay. The relay served the live build, and served only `/src/…` fixture imports from a local checkout at the same commit `eb0b1ab9`. Live requests through the relay:

| Script | Live requests | Non-200 |
|---|---|---|
| patch-notes | 344 | 0 |
| cosmetics | 5,096 | 0 |
| profile-banners | 1,658 | 0 |
| stickers | 428 | 0 |
| coop-freeplay | 410 (rerun: 411) | 0 |

## Problems

No high or medium problems found.

**L1 (low, test only, not a regression): `coop-freeplay` "the crossing: the glitch banner shows on both screens" fails every time.**
- Repro: `node e2e/coop-freeplay.mjs` (dev server) at `eb0b1ab9`. It failed 3 of 3 times against the live files, once on the local dev server at `eb0b1ab9`, and **also once on the v0.1.66 commit `fc978aba`**. In each run it is the only failure out of 58.
- Cause: the banner does show on both screens. A MutationObserver on both pages, added in my live copy of the script, saw `.bt-banner-glitch` "13/12 BEYOND THE LAST WAVE · Blossom" on the guest about 2.3 s after the GO BEYOND tap and on the host about 9.6 s after. The check only starts polling for the banner after **both** clients have reached wave 13 (`await beyond`, then `waitFor(.bt-banner-glitch)`). The banner lives 1.8 s (`freeplay.js` → `feed.announce(…, 1800)`), so the first client's banner is gone by then.
- Fix suggestion (test only): arm the banner wait (or an observer) before tapping GO BEYOND and await it together with `beyond`, instead of after.
- Worth a look: the two clients entered wave 13 about 7 s apart in this two-pages-in-one-SwiftShader-browser harness, and the same happens on v0.1.66. The state hashes always match, so it is not a desync, only how far apart the two screens are at a wave start under this harness's pumped clock.

## Notes on method (not game defects)

- My first sandbox pass loaded no Brigade models. Sandbox mode runs its own endless waves, not the stage's Brigade waves, and the hero waits for a tap to deploy. The second pass spawned each Brigade enemy from the Sandbox panel and placed the hero, and all the models loaded.
- On live, the profile-banners e2e met the first-run "Achievements" intro and the beta-gift card over the profile before its Preview tap. The dev-server run reaches that step at a different moment. The live copy closed them with their own Later buttons, and all 48 checks then passed. The game itself is unchanged; this only affects the script's timing.

## Screenshots

`docs/review/v0.1.67/live-check/`. All JPEG, the largest is 121 KB.

1. `01-notice-390x844.jpg`: Notice › Patch notes with v0.1.67 on top, before the claim
2. `02-edit-profile-frames-1280x720.jpg`: frame picker, new frames, a secret frame as "???"
3. `03-banner-picker-locked-844x390.jpg`: banner picker; tapping a locked tile shows its rule
4. `04-banner-pumpkin-390x844.jpg`: the profile wearing the painted Pumpkin Lantern Night banner
5. `05-chat-sticker-picker-390x844.jpg`: clan chat sticker picker (four slime stickers first). The names are local test fixtures.
6. `06-sandbox-brigade-kogane-1280x720.jpg`: Kogane and Big Yellow; the Brigade convoy at the gate
7. `07-sandbox-brigade-norika-1280x720.jpg`: Norika and her barricade; the Brigade convoy at the gate
8. `08-settings-stickers-toggle-1280x720.jpg`: Settings › Account › "Show stickers from other players"
