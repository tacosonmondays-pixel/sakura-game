# v0.1.73 "Path Looks and Inked Attack Effects": live check

**Verdict: LIVE_OK.** The deploy is live and the commit's own smoke passes at all three sizes. Every new piece renders on the live files, with no page errors, no console errors and no failed requests. A second agent re-read the logs and opened every screenshot to try to refute the verdict, and agreed.

- Live: https://tacosonmondays-pixel.github.io/sakura-game/
- Checked 2026-11-03, 04:24–05:00 UTC, by agents that did not ship this release.
- Browser: headless Chromium with SwiftShader WebGL. It opened the live files through a localhost relay (Node fetches each file through the network proxy), with `?online=local`, so no test player signed in to live Supabase.

## Deploy

| | |
|---|---|
| `version.json` | `{"version":"0.1.73","build":"f341de675a2d","sim":"e4001588f40b","time":"2026-11-03T04:14:33.032Z"}` |
| `main` | `f341de67` = the GO'd `e4215055` plus one change: the patch note date is 2026-11-02, the Central deploy day (`docs/review/v0.1.73/go-no-go.md` on `review/v0.1.73-go`) |
| Run | #73, success |
| Sim id | Unchanged (`e4001588f40b`, `COOP_PROTOCOL` 17); display-only release |

## Results

| Area | Result | How |
|---|---|---|
| Smoke (`e2e/smoke.mjs` at `f341de67`) | 1280x720 227/0, 844x390 227/0, 390x844 227/0 (681/681, "ALL SMOKE CHECKS PASSED") | Against the live files through the relay. The two known machine flakes (touch-drag, mall timing) did not fail this time. |
| Live requests | Every file 200 (1,219 relay lines in the smoke, 709 + 368 in the own check) | Two socket blips, retried and then 200: `hotaru-bust.webp`, `memento-small.webp` |
| Path looks (1280x720 and 844x390, high) | Piece counts from `renderer.pathLooksProbe` match the catalog | Girls placed with `sim.placeTower` and upgraded with the real `sim.upgradeTower` (no override). Aoi 5-2-0: comet quiver plus path-0 aura. Akane 3-0-2: pinwheel. Rei 2-0-5: wakizashi and blade fan plus path-2 aura. Kage 2-5-0: scarf glow and crescent plus path-1 aura. Yuki 0-3-1: shards. Kage 0-0-0: nothing. Raika 3-0-2 (not in the catalog): weapon glow only. Luna hero Lv 25 (5-5-5): crescent, horizon, crown and crown stars, with all three auras. Pips under each girl in the path colours. |
| Inked chain (Raika) | 7 bolts live at 1280, 9 at 844 (frozen frame); strokesRefused 0; vfxOff false | Gold zig-zag with ink outlines, forks and stars; no whiteout |
| Beams (Luna) | 4 moon beams live, 4 sim beam events, at both sizes | Violet-white lances from her staff; no whiteout |
| Path colours | Drawer rows `#ff6b8b` / `#4cc9f0` / `#ffd43b`; CSS `--path-1..3` match | Aoi's drawer at both sizes, nothing clipped |
| Notice | v0.1.73 "Path Looks and Inked Attack Effects", Nov 2, 2026, on top, v0.1.72 next | 1280x720 and 390x844; the date no longer wraps at 390 |
| Errors | 0 page errors, 0 console errors in every context | |

Screenshots (our own game, taken on the live files): `live-check/01`–`06`.

## Notes on method

- The first run of the own check failed its beam step at both sizes, "none caught in 120 s". The six girls cleared wave 1 before the sturdy enemies reached Luna. A second run started the wave first and placed Luna beside the leading enemy; it went 10/10. This was harness staging, not a game problem.
- The canvas brightness read returns 0 under WebGL without `preserveDrawingBuffer`, so the logged "no whiteout" checks are not evidence on their own. Whiteout was judged from the screenshots.
- The 1280x720 board shows the "Tap anywhere on open ground to deploy Luna" banner after she was placed. That is because the script placed her through the sim right as her free card armed, which a player cannot do.
- The 7–9 bolts on the frozen chain frame come from stepping the sim synchronously. Normal play draws fewer at a time.

## Follow-ups (low)

1. **Kage 2-5-0's crescent may sit over her face** from the battle camera: a blue-violet vertical shape down the middle of her face in `02-path-looks-zoom.jpg`, panel 3. The catalog puts `p1_crescent` on the head bone at `[0, 0.36, 0.12]` (meant for her headband), and the forward offset may project onto her face at the 48° camera. At about 25 px per head this could also be JPEG blur. Check it with a close render in the next path-looks review (batch 2 r5) and pull the offset back if needed.
2. **Coverage gaps (not refutations).** Not checked live: Momo, Nami and Hikari's pieces; Chika's chain and Storm Lance colours; Miko's ray and Raika's Overcharge lance; slashes, shockwave rings and shot streaks; the low-graphics and Reduce Motion fallbacks. The go/no-go covered these on the release build.
