# v0.1.72 "New Staff Models and a Fire Tornado": live check

**Verdict: PASS (LIVE_OK).** All five areas pass at 390x844 and 1280x720. No high, medium or low game problems were found. Two checks failed on a first run and passed when run again. Both were harness timing under SwiftShader, not game problems (see the notes on method).

- Live: https://tacosonmondays-pixel.github.io/sakura-game/
- Checked on 2026-11-01, 20:00–20:35 UTC, by an agent that did not ship this release.
- Browser: headless Chromium 153 with SwiftShader WebGL. Every page ran with `?online=local` (plus `onboarding=0`), so no test player signed in to live Supabase, and the direct-load request logs show no Supabase host.

## Deploy

| | |
|---|---|
| `version.json` | `{"version":"0.1.72","build":"b207fe9a36af","sim":"e4001588f40b","time":"2026-11-01T19:57:21.396Z"}` |
| Before | 0.1.71 / `2dba8b4a2ee7` / sim `e4001588f40b` |
| Sim id | Unchanged (`e4001588f40b`). `2dba8b4a..b207fe9a` touches nothing in `src/sim` or `src/online`. The tornado is display-only and only reads the sim's `abilityWarn` / `abilityShell` events, so no `COOP_PROTOCOL` bump is needed. The co-op hashes below agree. |

## Results

| Area | Result | How |
|---|---|---|
| 1. Load, errors and requests | PASS | Live loaded directly at 390x844 and 1280x720 (`tools/direct72.mjs`). There were no page or console errors and no horizontal overflow. 390x844 made 360 requests (328 github.io, 22 fonts, 10 blob) and 1280x720 made 352. All returned 200 and none failed. |
| 1. Patch note and gift | PASS | At both sizes, Notice › Patch notes lists 70 versions with v0.1.72 "New Staff Models and a Fire Tornado" (Nov 1, 2026) on top. Claim took gems +100 (2,400 → 2,500) and the button turned into "Claimed ✓". `profile.patchGifts['v0.1.72']` was stored. After a reload the gems were still 2,500 and the entry still read Claimed ✓ with no Claim button, so the gift can be claimed only once (screenshot 01). |
| 2a. Staff GLBs on live | PASS (5/5) | `tools/glbs72.mjs` fetched `norika.glb`, `norika.lod.glb`, `kogane.glb`, `kogane.lod.glb` and `characters/manifest.json` from live. All returned 200 and are byte-identical (sha-256) to `public/` at `b207fe9a`. Each GLB parses with one skin and `asset.extras.build = 'staff'`. Norika's clips: `attack_sign, cheer, hurt, idle, pickup, victory, walk`. Kogane's: the same, with `attack_wrench`. |
| 2b. Faces clear, clips animate (high + medium) | PASS (177/177) | `tools/staff-live.mjs` is the repo's `e2e/staff-models.mjs` run against live through the relay. It covered Norika and Kogane on 1-1 (day) and 2-1 (night) at 1280x720 and 390x844 (DPR 3), high (full file) and medium (`.lod`): 16 battles. Each hero was drawn from her GLB at the expected detail and played the staff build's clips. **Clips:** idle, walk, attack, cheer and hurt each move her. Idle moved at least 0.3% of her height per step and hurt at least 0.8%. Walk, attack and cheer moved 7–16%. **Faces:** with the game's own camera, the hard hat never came nearer than **0.19** head radii to the sight line of an eye facing the camera (limit 0.12), in idle and at the attack's strike, in all 16 battles. The close-ups show both faces clear under the hats, by day and at night (screenshots 02–04). No console errors. *Change from the repo script:* the build check reads the GLB file the page drew (from live, through the relay), because the live bundle's own loader cache can't be reached from a local module. |
| 2c. Paddle and wrench stay in hand | PASS (37/37 at each size) | `tools/props-live.mjs` (new, built on the staff script) ran on live battles on 1-1 at 1280x720 and 390x844, high and medium. It finds the prop as the body vertices bound ≥ 0.98 to `hand_R` beyond her hand: Norika's STOP paddle (524 vertices full, 183 LOD) and Kogane's wrench (404 full, 109 LOD). It steps every clip by hand: idle, walk, attack, cheer, hurt. In every clip the prop's grip stays within 6.0–6.5% of her height of the hand bone. The prop's centroid moves at most **0.39%** of her height against the hand (limit 1%), so it stays in her hand. |
| 2d. Big Yellow and the barricades | PASS (4/4 runs) | `tools/batch1-live.mjs` is the repo's `e2e/tripo-batch1.mjs` against live, with the quality and phone touch as options, plus checks that the hero does her work. It ran at 1280x720 and 390x844, high and medium, with Kogane and with Norika as hero on 1-1 Normal. **Kogane:** Big Yellow is drawn as the Tripo walker beside her and is still drawn after 20 s of the wave. She dealt 172–194 damage. **Norika:** her barricade is the Tripo barricade. Enemies broke it during the wave and it was rebuilt; at 1280x720 its budget fell from 7,200 to 3,860 / 2,520. It is still drawn afterwards, and she dealt 182–272 damage. The Brigade enemies and Suzu's bells checked by the same script pass too. No console errors (screenshots 02, 03, 05, 06). |
| 2e. Norika's shot leaves her paddle | PASS | `tools/weapon-tips-live.mjs` (the v0.1.71 live copy of `e2e/weapon-muzzles.mjs`, unchanged since) was run with `--girls norika` at both sizes. She is drawn from her GLB with a weapon-tip anchor on the paddle face. Her shell starts **0.000 tiles** from the anchor on the frozen frame and **hits its target** (enemy 3: 25 → 17 hp, projectile ended). No console errors (screenshot 07). |
| 3. Fire tornado (high, medium, low; Reduce Motion) | PASS (8/8 runs) | `tools/tornado-live.mjs` (new) ran on 1-1 Normal with Akane at Big Bang tier 3 beside the road and 14 tough enemies on the road near her. The cast went through the live sim's `castAbility`, with every sim event recorded and the live renderer's `tornado` layer sampled every frame. At 1280x720 and 390x844, on high, medium and low, plus high with Reduce Motion, every run gave **one warning and 6 shells** and **one `fire` tornado**. The tornado stands exactly on the warning spot (0.000 tiles away). The mean shell landing spot is 0.11 tiles away and the farthest shell 0.62 (shell radius 1.2). **Where the shells land: yes.** It is drawn while the shells fall, with the tier's ring count: high 26 (22 + 4 core), medium 13, low 8. **Lifts away:** after the barrage it rises and fades for 1.35–1.40 s on the visual clock (3.0 s with Reduce Motion, which stretches the rise ×2.2 by design). Then nothing is drawn: no live tornado, no rings, mesh hidden. **Reduce Motion:** every drawn ring carries spin 0, twist 0 and sway 0. Without it they carry spin 3.20 rad/s and twist 3.60. No console errors (screenshots 08–12). |
| 4. Co-op (sim e4001588f40b) | PASS (40/40) | `tools/coop-sharing-live.mjs` (the v0.1.71 live copy of `e2e/coop-sharing.mjs`, unchanged since) uses two pages on the local adapter through the relay, on 1-1 Easy. The room paired and both pages played three waves at 3×. The guest's gift of 88 coins landed in the host's wallet on both screens. Then: lend, the guest's tier purchase, Take back between waves, a second lend, and the guest leaving. After the 20 s grace the guest's girls and coins became the host's. **Hashes agree** after the gift (4 compared after tick 6052), after lend, upgrade and take-back (4, tick 7689), and before the guest left (4, tick 7959). No page errors (screenshots 13–14; "Aiko" and "Bea" are the script's fixture names). See the notes for the first run. |
| 5. Old v0.1.71 save | PASS | The `tests/fixtures/veterans.js` `veteran('late')` save was loaded into a production build of `2dba8b4a` (build `2dba8b4a2ee7`, run number 71), served locally. That build wrote it back as 91,156 bytes with `saveRev 3` and 24 girls. The same localStorage was then loaded into live v0.1.72 at 390x844 and 1280x720. A deep compare of every value in the old save against the save v0.1.72 wrote found only bookkeeping changes: `saveRev` 3 → 5 at 390x844 and 3 → 4 at 1280x720, and `saveBy`. There were no new top-level keys and nothing was lost: 24 girls, coins 20,000, gems 2,400, and all items, gear, progress and formation kept. There was no restore, backup or corrupt notice and no errors. All 197 and 190 requests returned 200 (screenshot 15: the fixture's own unclaimed beta-tester gift card on top). |

## Request counts

| Run | Requests | Non-200 | Failed |
|---|---|---|---|
| Direct live 390x844 (load, Notice, claim, reload, Notice) | 360 | 0 | 0 |
| Direct live 1280x720 (same) | 352 | 0 | 0 |
| GLB fetch (`glbs72.mjs`) | 5 | 0 | 0 |
| Old save on direct live, 390x844 | 197 | 0 | 0 |
| Old save on direct live, 1280x720 | 190 | 0 | 0 |
| v0.1.71 prod build, local (writes the old save) | 193 | 0 | 0 |
| Relay: every run in items 2–4 (live fetches) | 7,838 | 0 | 0 (no relay errors) |

## Notes on method

- Items 2–4 ran through a localhost relay (`tools/relay.mjs`), the same method as earlier live checks. It serves the live build for every path, models included, and serves only `/src/…` and Vite's own paths from a local checkout at the deployed commit `b207fe9a`. The local `src` was used only for `createProfile` to seed a save (on the node side), and for the co-op harness's local `createCoopSim`, which plans placement spots with the same sim id as live. Every battle, model, effect, tornado, command and hash came from the live build's own `window.__battle`.
- **First tornado run:** at 1280x720 high with Reduce Motion, the "lifts away and is gone" check failed. The column had already vanished: the frames sampled after it show nothing drawn. The script's 60 s wall-clock wait for "gone" timed out. The staff battles were running on the same machine at the time, SwiftShader drew a few frames a second, and the Reduce Motion tail is 2.2× longer by design. With the wait raised to 180 s, the same config passed in full (`gone` true, tail 3.07 s on the visual clock, then 7 empty frames). This is recorded as a harness timing problem.
- **First co-op run:** 39/40. "The host's drawer offers 'Lend to Bea'" missed its 10 s wait. The next check read the button's text "Lend to Bea", the lend went through on both screens, and every hash comparison agreed. That run started right after the other battle runs and while the v0.1.71 preview server was up. It was repeated with only the relay running and passed 40/40. This is recorded as a load problem in the harness, not a game problem, the same as v0.1.71's note.
- In `batch1-live.mjs` the per-type event tallies in the log (`heroEv`) count the sim's undrained event list again on every hand-stepped tick, so their sizes are inflated. The checks use only the hero's `damageDealt`, the barricade budget, and whether a `barricadeBreak` was seen at all.
- At 390x844 the staff script's phone close-ups use DPR 3. They were scaled down to 390x844 for the JPEGs here.

## Screenshots

`docs/review/v0.1.72/live-check/`. All JPEG, the largest is 125 KB. No player names appear. "Sensei" is the default name, and "Aiko" and "Bea" are test fixture names.

1. `01-patch-note-v0172-390x844.jpg`: Notice › Patch notes with v0.1.72 on top, before the claim
2. `02-kogane-attack-wrench-big-yellow-1280x720-high.jpg`: Kogane at her wrench strike, face clear under the hard hat, Big Yellow behind her
3. `03-norika-night-face-paddle-barricade-1280x720-high.jpg`: Norika on 2-1 at night, face clear, STOP paddle in hand, her barricade on the road
4. `04-kogane-night-390x844-high.jpg`: Kogane and Big Yellow on 2-1 at night, phone size
5. `05-norika-barricade-wave-390x844-medium.jpg`: Norika (LOD) in a wave with her barricade on the road, phone size
6. `06-kogane-big-yellow-wave-1280x720-medium.jpg`: Kogane (LOD) with Big Yellow during a wave
7. `07-norika-shot-from-paddle-1280x720.jpg`: Norika on the frame of her first shot, from the paddle
8. `08-tornado-high-shells-1280x720.jpg`: the fire tornado on high as the shells fall on the crowd
9. `09-tornado-medium-390x844.jpg`: the same on medium, phone size, at the last shell
10. `10-tornado-low-390x844.jpg`: the same on low, phone size
11. `11-tornado-lifted-away-1280x720.jpg`: after the barrage: the tornado gone
12. `12-tornado-reduce-motion-390x844.jpg`: with Reduce Motion on (rings not spinning)
13. `13-coop-gift-sheet-844x390.jpg`: the co-op "Send coins" sheet
14. `14-coop-handed-over-1280x720.jpg`: the guest's girls handed over to the host
15. `15-old-v0171-save-home-1280x720.jpg`: the save written by the v0.1.71 build, loaded on live v0.1.72

`live-check/tools/` holds the scripts used: `relay.mjs`, `direct72.mjs`, `glbs72.mjs`, `staff-live.mjs`, `props-live.mjs`, `batch1-live.mjs`, `weapon-tips-live.mjs`, `tornado-live.mjs`, `coop-sharing-live.mjs` and `oldsave72.mjs`. Several are copies of the repo's e2e scripts, pointed at the relay.
