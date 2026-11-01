# v0.1.71 "Lively Moves and Shots From the Weapon": live check

**Verdict: PASS (LIVE_OK).** All five areas pass at 390x844 and 1280x720. No high, medium or low game problems were found. There are three notes on method below. One is a first co-op run that failed at the lend step because this checker loaded the machine too heavily. It passed in full when run again.

- Live: https://tacosonmondays-pixel.github.io/sakura-game/
- Checked on 2026-11-01, 13:48–14:50 UTC, by an agent that did not ship this release.
- Browser: headless Chromium 153 with SwiftShader WebGL. Every page ran with `?online=local` (plus `onboarding=0`), so no test player signed in to live Supabase, and the direct-load request logs show no Supabase host.

## Deploy

| | |
|---|---|
| `version.json` | `{"version":"0.1.71","build":"2dba8b4a2ee7","sim":"e4001588f40b","time":"2026-11-01T13:46:31.871Z"}` |
| Before | 0.1.70 / `df9fae8d5bf7` / sim `e4001588f40b` |
| Sim id | Unchanged from v0.1.69 and v0.1.70 (`e4001588f40b`). v0.1.71 changes only models, faces, outlines and where shots are drawn from, so no `COOP_PROTOCOL` bump is needed. The co-op hashes below agree. |

## Results

| Area | Result | How |
|---|---|---|
| 1. Load, errors and requests | PASS | Live loaded directly at 390x844 and 1280x720 (`tools/direct71.mjs`). No page or console errors and no horizontal overflow. 352 requests at each size: 320 github.io, 22 fonts and 10 blob. All returned 200 and none failed. |
| 1. Patch note and gift | PASS | At both sizes, Notice › Patch notes lists 69 versions with v0.1.71 "Lively Moves and Shots From the Weapon" (Nov 1, 2026) on top. Claim took gems +100 (2,400 → 2,500) and the button turned into "Claimed ✓". `profile.patchGifts['v0.1.71']` was stored. After a reload the gems were still 2,500 and the entry still read Claimed ✓ with no Claim button, so the gift can be claimed only once (screenshot 01). |
| 2a. Changed GLBs on live | PASS (29/29) | `tools/glbs.mjs` fetched every changed file from live: luna, nami, kanna, yoriko, kogane, norika (full + LOD), slime_green, goblin_runner, orc_grunt, oni_brute, ghoul_bonewalker, lizard_skink (full + LOD), fp_hyakki_daimyo, iron_colossus, fp_foundry_titan (no LOD files: they are not in the repo) and both manifests. Every one returned 200, is byte-identical (sha-256) to `public/` at `2dba8b4a`, and parses as glTF with one skin. The girls carry idle, walk, cheer, hurt and their attack clip. The enemies carry idle, move, hit, death and special. |
| 2b. Girls load and are not T-posed | PASS (12/12) | `tools/model-audit-live.mjs` is the repo's `e2e/model-audit.mjs` running against the live GLBs through the relay. It ran on the six girls, full and LOD. No file was flagged. Every clip's tracks bind, and no clip is near-static. Luna's idle brings her arms to 0.86–0.93 of her bind width, which is not a T-pose. |
| 2c. Each one animates in a battle | PASS | `tools/models-battle.mjs` at both sizes ran 7 battles per size: 1-1 high and low (Luna), 2-1 high (Nami), 2-1 low (Kanna), 1-1 medium (Yoriko), 2-1 low (Kogane) and ev-halloween-1 high (Norika). All six are heroes, so each got her own battle. In every battle all nine changed enemies were spawned on the road and drew their own GLB (`.lod` at low and medium where a LOD exists). Bone rotations sampled 2 s apart changed for every enemy, with clip `move` playing. Each girl drew her GLB and animated, with `idle` plus her attack clip (`attack_cast`, `attack_thrust`, `attack_smash`, `attack_wrench`) seen. **Luna:** in no sample were both upper arms straight out. In idle her upper arms sat at about 15–23° and 72–74° from straight down, holding her staff, so there is no T-pose (screenshots 02–03). 103/103 checks at each size. No errors, no failed or non-200 requests. |
| 2d. Green Slime and Goblin Runner faces, day and night | PASS | In each battle above, both drew their `face` mesh, visible and not outlined, by day (1-1), at night (2-1) and on Halloween, at high, medium and low. The repo's `e2e/slime-goblin-faces.mjs --battle`, run against live through the relay (`tools/faces-live.mjs`), passed 96/96 checks on 1-1, 2-1 and ev-halloween-1, high and low, at both sizes. The close-ups show the new jelly slime with its eyes, blush and smile, and the goblin's bright eyes, by day and at night, full and LOD (screenshots 04–05). |
| 2e. Halloween goblin wears a pumpkin hat | PASS | On ev-halloween-1, at each size, 41 Goblin Runners were spawned. Their costumes were: pumpkin hat 13, witch hat 11, cape 9, none 8. **None wore the pumpkin head or the sheet.** (Other enemies on the board still wear pumpkin heads, as designed.) `tools/hat.mjs` took a close-up of a pumpkin-hat goblin with its face showing (screenshots 06–07). |
| 3. Weapon tips (Aoi, Raika, Nami, Tenka) | PASS | `tools/weapon-tips-live.mjs` is the repo's `e2e/weapon-muzzles.mjs` against live, plus a hit check, at both sizes. Each girl draws her GLB with a weapon-tip anchor (bow, staff, staff, gun). **Aoi** (arrow) and **Nami** (orb): the drawn shot starts **0.000 tiles** from the tip anchor on the frozen frame, and the projectile then **hits its target** (a `hit` on that enemy: Aoi's killed it, Nami's took it from 25 to 6 hp). **Raika** (chain) and **Tenka** (hitscan) fire no projectile, so the anchor was drawn as a red ring on the frozen frame. Tenka's bolt and flare start at the ring on the coilgun's mouth. Raika's chain runs straight into the ring at her staff head. From this high camera the staff head sits just behind her hair, so the bolt's first few pixels are hidden. Both shots land a `hit` on their target that step. No console errors (screenshots 08–09). |
| 4. Co-op (sim e4001588f40b) | PASS (40/40) | `tools/coop-sharing-live.mjs` is the repo's `e2e/coop-sharing.mjs` run against the live files through the relay: two pages, local adapter, 1-1 Easy. The room paired and both pages ran three waves at 3×. The guest's gift of 88 coins landed in the host's wallet on both screens ([373,353] → [461,265]). Lend, the guest's tier purchase (90 coins from the guest's wallet), Take back between waves, a second lend, then the guest leaving: a 20 s grace with nothing moving, after which the guest's girls and 238 coins became the host's and the host upgraded a handed-over girl. **Hashes agree** after the gift (6 compared), after lend, upgrade and take-back (4), and before the guest left (4). No page errors (screenshots 10–13; "Aiko" and "Bea" are the script's fixture names). See the notes for the first run. |
| 5. Old v0.1.70 save | PASS | The `tests/fixtures/veterans.js` `veteran('late')` save was loaded into a production build of `df9fae8d` (build `df9fae8d5bf7`, run number 70), served locally. That build wrote it back as 91,163 bytes with `saveRev 3` and 24 girls. The same localStorage was then loaded into live v0.1.71 at 390x844 and 1280x720. A deep compare of every value in the old save against the save v0.1.71 wrote found only `saveRev` 3 → 4 and `saveBy` changed (bookkeeping). There were no new top-level keys and nothing was lost: 24 girls, coins 20,000, gems 2,400, and all items, gear, progress and formation kept. There was no restore, backup or corrupt notice and no errors, and all 190 requests returned 200 at each size (screenshot 14: the fixture's own unclaimed beta-tester gift card on top). |

## Request counts

| Run | Requests | Non-200 | Failed |
|---|---|---|---|
| Direct live 390x844 (load, Notice, claim, reload, Notice) | 352 | 0 | 0 |
| Direct live 1280x720 (same) | 352 | 0 | 0 |
| GLB fetch (`glbs.mjs`) | 29 | 0 | 0 |
| Old save on direct live, 390x844 | 190 | 0 | 0 |
| Old save on direct live, 1280x720 | 190 | 0 | 0 |
| Relay: every run in items 2–4 (live fetches) | 8,249 | 0 | 0 |

## Notes on method

- Items 2–4 ran through a localhost relay (`tools/relay.mjs`), the same method as earlier live checks. It serves the live build for every path, models included, and serves only `/src/…` and Vite's own paths from a local checkout at the deployed commit `2dba8b4a`. The local `src` was used only for the GLB loader in the model audit, for `createProfile` to seed a save into localStorage, for `pointAt` in the faces script, and for a local `createCoopSim` that plans co-op placement spots with the same sim id as live. Every battle, model, effect, command and hash came from the live build's own `window.__battle`.
- **First co-op run:** the run that produced `coop.log` failed at "after two taps she is the guest's to command" and stopped at Take back. The gift and the first hash comparison had already passed. The host's screen showed "Waiting for ally…" at that moment. While it ran, this checker had a third browser loading the v0.1.70 build on the same machine, and SwiftShader was managing about 1–4 frames/s. The guest page most likely fell behind for more than the script's 20 s wait. The run was repeated with nothing else running and every check passed (40/40). This is recorded as a load problem in the harness, not a game problem.
- The 3 failed requests on the local v0.1.70 server (not live) were GLB downloads that `ERR_ABORTED` cut off when the script closed the page.
- The wheel zoom in `models-battle.mjs` leaves the camera close to its default view, so its own stills are wide. The face close-ups (04–05) are crops of the repo faces script's full-resolution frames, and 06 is a crop of `hat.mjs`'s frame. The co-op harness takes its screenshots at 844x390 and 1280x720, its built-in sizes. Each girl's hero card reads "Lv 1": that is the in-battle hero level, not her saved level.

## Screenshots

`docs/review/v0.1.71/live-check/`. All JPEG, the largest is 126 KB. No player names appear. "Sensei" is the default name, and "Aiko" and "Bea" are test fixture names.

1. `01-patch-note-v0171-390x844.jpg`: Notice › Patch notes with v0.1.71 on top, before the claim
2. `02-luna-battle-no-tpose-1280x720.jpg`: Luna on 1-1 with her staff, arms down, between two of the re-rigged titans
3. `03-luna-battle-390x844.jpg`: the same battle at phone size
4. `04-faces-day-night-1280x720.jpg`: Green Slime and Goblin Runner faces, 1-1 day and 2-1 night, high
5. `05-faces-lod-390x844-and-night.jpg`: the same with the LOD files, day at 390x844 and night at 1280x720
6. `06-halloween-goblin-pumpkin-hat-1280x720.jpg`: a Goblin Runner in its pumpkin hat on Pumpkin Patch Path, face visible
7. `07-halloween-goblin-pumpkin-hat-390x844.jpg`: the same at phone size
8. `08-weapon-tips-1280x720.jpg`: Aoi, Raika (red ring = tip anchor), Nami and Tenka (red ring) on the frame of their first shot
9. `09-weapon-tips-390x844.jpg`: the same four at phone size
10. `10-coop-gift-sheet-844x390.jpg`: the co-op "Send coins" sheet
11. `11-coop-lent-in-guest-1280x720.jpg`: the guest's drawer, "Lent by Aiko · Give back"
12. `12-coop-grace-countdown-844x390.jpg`: the host's grace countdown after the guest left
13. `13-coop-handed-over-1280x720.jpg`: the guest's girls handed over to the host
14. `14-old-v0170-save-home-1280x720.jpg`: the save written by the v0.1.70 build, loaded on live v0.1.71

`live-check/tools/` holds the scripts used: `relay.mjs`, `direct71.mjs`, `glbs.mjs`, `model-audit-live.mjs`, `models-battle.mjs`, `faces-live.mjs`, `hat.mjs`, `weapon-tips-live.mjs`, `coop-sharing-live.mjs` and `oldsave71.mjs`. Several copy the repo's e2e scripts, pointed at the relay.
