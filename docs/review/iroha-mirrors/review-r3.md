# Iroha's mirror network: review round 3 (the last before the owner decides)

Target: `feature/iroha-mirrors` at 98a18047 (merges `feature/balance-r5` 09aab59b; sim id e2179327cf97 in PENDING_BUMP,
COOP untouched: correct while unshipped). Compared with live `main` (a741aef7) and r5 (09aab59b). Spec:
`docs/specs/IROHA_MIRRORS.md`. All benches use the round-5 measure (`tools/balance/r5Bench.mjs`: fully maxed, stage 4-5,
targets that never die, mean of seeds 9 / 1 / 2 unless noted). For `main` the r5 bench files were copied in unchanged.

**Verdict: NOT OK.** The round-2 fixes are in and work where the spec measures them: every r5Bench cell on Auto is at or
above main and r5, stacked mirrors no longer multiply, and Laser Web beats live Mirror Shift. But the bench's held boss sits
on a sweet spot. Hold the boss one tile further along the road and Auto Iroha drops to about half of r5 on most builds,
and one cell drops below main. A placement search beats the spec's "best placement" column by ×1.4–1.7. And the ally
setup the earlier reviewer measured on main (Kage 418k) is ×0.56 on this branch.

## Round-2 findings: status

| r2 | claim | verified |
|---|---|---|
| H1 ally copies on a lone boss | new leg on a real reflection, fallback targets, catch radius 0.8 | **Fixed** for the bench layout (Kage 5-0-2 boss beside Iroha 235k vs r5 220k, 2-5-0 ×2.0). See HIGH-3 for the layout the r2 reviewer used. |
| H2 stacking ×4 | legs < 1 tile add nothing; placed mirrors pushed 1 tile apart | **Fixed.** Stacking gives nothing. The best adversarial layouts are 1-tile stars (MEDIUM-1), not stacks. |
| M1/M2 tiers below r5, Second Pane cut | fixed Auto slots, a bounce with every mirror | **Fixed on the bench spot** (every tier ≥ the one before it). **Not fixed off it** (HIGH-1). |
| M4 web ticks by uid, T3 0.9 | | Ticks: OK. Gate: 3-0-2 ×1.31 OK, but 3-0-0 ×1.42 and 3-0-1 ×1.38 (MEDIUM-2). |

## Findings

### HIGH-1: Auto is only at or above r5 on the bench's own boss spot. One tile away it is about ×0.5 of r5, and one cell is below main
`src/sim/mirrors.js:133-150` (`autoSpots`: slots at ¼, ¾, ½, ⅛, ⅞ of the road samples in reach).
I held the boss at offsets −4…+4 tiles along the road from her nearest road point (offset 0 is the r5Bench cell). Supports
were Umeko + Midori, seed 9:

| build | tree | 0 | +1 | +2 | +3 | −1 | −1.5 | −2.5 | −3 | −4 |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 5-0-2 | main | 255k | 255k | 256k | 213k | 255k | 255k | 255k | 171k | 0 |
| 5-0-2 | r5 | 1.08M | 1.08M | 1.08M | 904k | 1.08M | 1.07M | 1.08M | 730k | 0 |
| 5-0-2 | branch | 2.12M | **573k** | **569k** | 976k | 1.14M | **573k** | 2.20M | 977k | 73k |
| 2-5-0 | main / r5 | 129k / 548k | 130k / 550k | … | | | | | | 96k / 414k |
| 2-5-0 | branch | 2.07M | 730k | 725k | 1.37M | 725k | 730k | 736k | 741k | **0** |
| 2-0-5 | r5 | 506k | 505k | 503k | 413k | 503k | 505k | 503k | 340k | 0 |
| 2-0-5 | branch | 1.35M | 993k | 994k | 1.34M | 788k | 789k | **488k** | **328k** | 0 |
| 3-0-2 / 2-0-2 | r5 | 85k | 86k | 86k | 72k | 85k | 85k | 86k | 58k | 0 |
| 3-0-2 / 2-0-2 | branch | 229k / 172k | 62k / **46k** | 62k / 46k | | 94k | 47k | 47k | **31k** | 0 |
| 2-1-0 | r5 / branch | 76k / 112k | 76k / **41k** | 76k / 42k | | 77k / 42k | | 77k / 42k | 51k / 29k | |

Across all 18 builds, with supports and without, most off-spot cells fall to ×0.42–0.80 of r5 (5-0-2 ×0.53, 4-0-2 ×0.62,
2-1-0 ×0.54, 2-0-1 ×0.54). 2-5-0 and 2-4-0 at −4 do **0** where main does 96k / r5 414k. There the boss stands 3.18 from
her (range 2.70), and Silver Reflection's 5.1 reach puts every Auto mirror 3.7–6.4 tiles from it. r5's single panel
stood at the road point nearest her. The walking-boss column stays above r5 because the boss walks through the sweet
spot.
**Fix:** give Auto slot 0 r5's spot (the road sample nearest her, her old panel), and the other slots the fractions. Then
measure the boss **swept along the road**, not at one point. Add a test: Auto ≥ r5 at every held offset in her range.

### HIGH-2: placements beat the spec's "best placement" column by up to ×1.68 (4-0-2 boss) and ×1.58 (2-0-5 crowd)
I searched about 190 layouts per build (pentagram / triangle / square stars of radius 0.5–1.8 at step 1 or 2, plus random
5-point layouts within ±2.5–3.7 tiles), seed 9, then took the top 4 on 3 seeds:

| build | target | Auto | spec "best" | found | × spec best | layout |
|---|---|--:|--:|--:|--:|---|
| 5-0-2 | boss | 2.12M | 3.01M | **4.49M** | ×1.49 | 5 mirrors ~0.6–1 tile round the boss (star, step 2); every leg crosses it |
| 2-0-5 | crowd | 6.78M | 7.77M | **12.29M** | **×1.58** | mirrors on the road 1–2.5 tiles apart: overlapping 1.5-tile bounce splashes |
| 2-0-4 | crowd | 3.09M | 5.46M | 7.83M | ×1.43 | same |
| 2-0-5 | walking boss | 1.41M | – | 2.70M | (×1.91 Auto) | 5-point star r 0.5 |
| 4-0-2 / 2-0-4 | boss | 595k / 659k | 595k / 1.35M | 1.00M / 1.36M | ×1.68 / ×1.00 | stars |

No SSR row beats the LR boss rows (5.8–6.7M). But 5-0-2 at 4.49M is ×2 Kage and above Shiro (3.24M) on a boss, for a
crowd-ruler girl. 2-0-5 at 12.3M on a crowd is ×6.7 Kage.
**Fix:** splash each enemy at most once per bolt (a per-bolt `splashed` list next to `hits`, checked in
`splashAt` when it is called from `bounce`, `mirrors.js:417`). That removes the overlap stacking. Then re-measure §10's
"best" column with a real search, not six stars.

### HIGH-3 (by the brief's rule; the cause is r5, not this rework): Kage beside Iroha, ×0.56 of live main
The r2 reviewer's 418k reproduces exactly. Setup: Kage 5-0-2 on r5Bench's spot (3.81, 3.56), Iroha 5-0-2 at (3.31, 2.81),
no supports, boss held. Result: **main 418.6k, r5 235.8k, branch 233.9k**. With Umeko + Midori it is **3.94M / 2.38M / 2.38M**.
On main, Kage's shuriken split 42.8k times in 55 s; on r5 and on the branch, 3.1k times. r5's Blade Cyclone (Kage tier 5:
`behavior: 'spin'`, 4 arms) throws far fewer shuriken that cross the panel. The 2-5-0 and 2-0-5 Kage builds are equal on
all three trees. This rework doesn't cause the loss, but it doesn't win it back either. Shipping the branch takes Kage +
Iroha from ×2.0 to ×1.07 on live.
**Fix / owner call:** either accept it (main's ×2 came from a 13-shuriken spray that each split, likely an unintended combo),
or make the spin arms' shots reflect (a split copy per arm volley).

### MEDIUM-1: battle-save resume moves placed mirrors (up to 0.22 tiles; the battle hash differs)
`src/ui/battle/snapshot.js:616` replays `mr` through `setAim` in slot order. That re-runs the 1-tile push against the
slots already restored, so a layout placed in another order can come back different. Out of 300 random 5-mirror layouts
on 1-1, 13 restored with a mirror moved by more than 0.01 tiles (the largest move was 0.22), and `hashSim` differed. 151
came back with sub-grid differences: `mirrorPoint` (`mirrors.js:110`, and `Sim.js:1483`) quantises *before* the reach
clamp, so a clamped spot is off the 1/1024 grid, and `hashSim`'s `int(x*1024)` hides that. Co-op, host, guest and replay
are not affected: they run the same commands, and `Sim.snapshot` copies the state.
**Fix:** on restore, write `mirrorAim[k]` directly (clamped to reach and map, with no push), then `syncMirrors`. Also
quantise after the reach clamp.

### MEDIUM-2: the Laser Web 1.35× gate is breached at 3-0-0 (×1.42) and 3-0-1 (×1.38)
`tools/abilityBench.mjs --tiers`, crowd, seed 9. 3-0-2 is ×1.31, 4-0-2 ×1.09, 5-0-2 ×1.16. **Fix:** T3 `dmgMul` 0.9 → 0.8,
or gate on the lowest tier-3 build.

### MEDIUM-3: abilityBench's boss row is below r5 at tier 3
3-0-0: 56.2k vs r5 78.0k. 3-0-2: 63.4k vs 86.9k. 3-0-1: 63.4k vs 86.9k. Same cause as HIGH-1: the bench holds its boss
off the sweet spot. Above main (20.4k).

### LOW
- A few ally cells are 1% under r5. Tenka 5-0-2 / 2-5-0 / 2-0-5 with Iroha across the road and no supports: 8 seeds,
  ×0.99, consistent on every build (1.679M vs 1.694M). Akane 2-5-0 near + um: ×0.99, which is within noise.
- The `'aim'` event from `setAim` (`Sim.js`) reports the point before the 1-tile push, so the display can briefly show the
  tapped spot rather than the stored one.
- `hashSim` truncates `x*1024`, so it can't see sub-grid differences (see MEDIUM-1).

## Laser Web vs live Mirror Shift (abilityBench, own damage Off → On, crowd)

| build | live main | r5 | branch |
|---|---|---|---|
| 3-0-2 | 69.1k → 58.7k (×0.85, partner ×0.98) | 69.1k → 58.7k | 103.9k → 136.4k (×1.31, partner ×1.02) |
| 4-0-2 | – | 205.8k → 175.0k (×0.85) | 779.8k → 851.3k (×1.09) |
| 5-0-2 | 876.5k → 876.5k (×1.00) | ×1.00 | 3.80M → 4.39M (×1.16, partner ×1.03) |

At every tier the new web adds more than the live ability, which lowered or left her damage. On a lone boss it never
auto-casts on any tree (×1).

## Allies beside a 5-0-2 Iroha (my bench: (a) within 1.6 tiles, (b) across the road, (c) more than 6 tiles from any mirror; none and um supports)
The full table has 192 rows (4 allies × 3 builds × 2 targets × 4 placements × 2 support sets × 3 trees, 3 seeds); (c) equals the no-Iroha baseline exactly on every tree. Selected rows (main / r5 / branch):

| ally | target | Iroha | sup | main | r5 | branch |
|---|---|---|---|--:|--:|--:|
| kage 5-0-2 | boss | near | none | 209.5k | 219.7k | 235.4k |
| kage 5-0-2 | boss | near | um | **3.94M** | 2.38M | 2.38M |
| kage 5-0-2 | boss | (3.31,2.81) | none | **418.6k** | 235.8k | 233.9k |
| kage 2-5-0 | boss | across | um | 686k | 744k | 1.48M |
| kage 2-0-5 | crowd | near | um | 1.58M | 1.75M | 2.56M |
| aoi 2-0-5 | boss | near | none | 138.5k | 390.7k | 393.4k |
| akane 5-0-2 | boss | near | none | 29.5k | 103.1k | 203.6k |
| tenka 2-5-0 | boss | across | none | 187.0k | 635.8k | 629.9k |

Apart from HIGH-3 and the LOW rows, no ally cell is under main or r5.

## Auto, r5Bench (Iroha alone + Umeko 2-5-0 + Midori 5-0-2): all 18 builds × 3 targets at or above main and r5
(The table matches the spec's §10 to the digit.)

| build | boss main / r5 / branch | walking boss | crowd |
|---|---|---|---|
| 0-0-2 | 10.6k / 45.4k / **115.5k** | 1.0k / 4.5k / **6.5k** | 32.0k / 34.3k / **110.0k** |
| 1-0-2 | 13.3k / 56.7k / **144.4k** | 1.3k / 5.6k / **8.1k** | 40.0k / 42.9k / **137.5k** |
| 2-0-2 | 19.9k / 85.1k / **172.1k** | 1.9k / 8.3k / **14.2k** | 60.5k / 65.1k / **253.7k** |
| 3-0-2 | 19.9k / 85.1k / **229.4k** | 1.9k / 8.3k / **18.9k** | 60.5k / 65.1k / **359.7k** |
| 4-0-2 | 60.0k / 254.4k / **594.5k** | 6.1k / 25.3k / **44.1k** | 181.1k / 195.7k / **1.26M** |
| 5-0-2 | 255.3k / 1.09M / **2.12M** | 25.5k / 108.0k / **330.6k** | 772.1k / 835.9k / **5.83M** |
| 2-0-0 | 17.9k / 76.1k / **111.6k** | 1.7k / 7.6k / **9.8k** | 46.3k / 50.5k / **120.9k** |
| 2-1-0 | 17.9k / 76.1k / **111.9k** | 1.7k / 7.6k / **15.4k** | 46.3k / 50.5k / **122.3k** |
| 2-2-0 | 18.0k / 76.2k / **142.9k** | 2.0k / 8.8k / **22.7k** | 47.3k / 51.4k / **151.7k** |
| 2-3-0 | 18.0k / 76.2k / **174.7k** | 2.0k / 8.8k / **31.2k** | 47.3k / 51.4k / **186.5k** |
| 2-4-0 | 35.9k / 152.5k / **503.0k** | 7.7k / 33.2k / **85.6k** | 103.2k / 112.6k / **540.0k** |
| 2-5-0 | 129.3k / 548.9k / **2.06M** | 27.8k / 119.6k / **338.8k** | 247.7k / 270.2k / **1.49M** |
| 2-0-1 | 19.9k / 85.1k / **125.4k** | 1.9k / 8.3k / **11.3k** | 52.3k / 55.8k / **134.6k** |
| 2-0-3 | 19.9k / 85.1k / **172.1k** | 2.6k / 11.0k / **31.3k** | 116.5k / 125.4k / **416.5k** |
| 2-0-4 | 39.9k / 169.7k / **658.6k** | 10.4k / 46.2k / **707.4k** | 1.36M / 1.77M / **3.09M** |
| 2-0-5 | 120.2k / 508.7k / **1.35M** | 37.8k / 170.9k / **1.41M** | 5.45M / 5.88M / **6.78M** |

## Determinism, saves, perf, suites
- Lockstep: the push-apart is pure `+ − × ÷ sqrt` on synced state (`placeMirror` reads `mirrorAim`, plus `t.mirrors`
  for a slotless aim), runs inside the `aim` command, and is identical for host, guest and replay. `e2e/engines.mjs` is
  identical on V8 and JavaScriptCore. Mid-flight `Sim.snapshot` with routed bolts restores identically
  (`irohaMirrors.test.js`).
- Legacy `am`: I probed it at tiers 0, 2 and 5. `am` becomes `mirrorAim[0]` with the other slots on Auto and `t.aim`
  null, and re-saves as `mr` with no `am`. OK. (No test in the repo covers this; worth adding.)
- Battle save: MEDIUM-1.
- Perf (`perf.mirror` alone): tier 5 at 0.94–1.53 ms a step, ×1.92 of tier 4, p99 2.17 ms, worst 3.67 ms. Kaleidoscope
  1.19 ms, p99 3.17 ms. Passes on its own and in the suite.
- `npm test`: **398 files passed, 2 skipped; 6286 tests passed, 11 skipped** (569 s). `node e2e/smoke.mjs`: ALL SMOKE
  CHECKS PASSED (678 ok). `node e2e/iroha-mirrors.mjs`: all ok (81 ok). `node e2e/engines.mjs`: OK (V8 + JSC; Firefox and
  WebKit are not installed here).
