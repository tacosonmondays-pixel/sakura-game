# S5b build review, round 1

Target: `origin/feature/attack-shapes-s5` at 3f2bda5b. That is Midori's Spore Mist (Field Kit T4–5, its own `spore` status, aimed at the densest cone), Raika's Static Web (Storm Rhythm T4–5) and Luna's Moonbeam Sweep (Lv 22 / 25), plus the S5a review r1 LOW fixes. Base: S5a as approved at 7b6d0c9c (`review/attack-shapes-s5a-r1`, ec18813). Live: `origin/feature/balance-r5` 96c3547b, which the branch merges at 4d0889e1. Reviewed: `git diff 7b6d0c9c 3f2bda5b`, minus what the merge brought (`git diff 04bcc258 96c3547b`). The merge's own resolution was checked too: the PENDING_BUMP, the stats hash and the engines pins. The reviewer made every run below, on clean worktrees of both shas.

**Verdict: OK.** No HIGH and no MEDIUM. There are six LOWs, all documentation, tests or looks, plus the standing release gate.

## Runs (reviewer's own, at 3f2bda5b)

| Check | Result |
|---|---|
| `npm test` (full) | 401 files passed, 2 skipped. **6,328 tests passed**, 11 skipped. Exit 0 |
| `node e2e/smoke.mjs` | ALL SMOKE CHECKS PASSED (678 ok, 0 FAIL) |
| `node e2e/engines.mjs` | OK: 3 runs on 2 engines (Node V8, Bun JavaScriptCore, Chromium V8), S5a and S5b included. **S5b:** ticks 20410, won w22, mist/zap/moon/web 9767/893/14/64, Luna Lv 25, final 1874512872, 64 checkpoints → 8f5eaf93, and the mid-wave rejoin from w3 at tick 6054 lands on the run. **S5a:** final 2356239460 (unchanged), checkpoints 1a9cae93, charms 158 (see LOW 1). Firefox and WebKit are not installed here |
| Perf, `tests/sim/perf.test.js` (best of 3) | **S5b 0.343 ms a step** (0.343 / 0.423 / 0.416, limit 2 ms; at most 6 mists, 10 webs, 49 zaps a step). The S5a toll-cap stress reaches **128 rings** (30 for one girl) in 0.073 ms. S5a 0.187 ms. S1–S4 cases 0.25–0.29 ms |
| `lrBar.mjs` (default) | All six LR builds pass: crowd ×1.31–1.33, boss ×2.29–4.61 of the bar (≥ 1.25) |
| `lrBar.mjs --bar --top 10` | BAR = crowd 17.40M (Akane p0t5 beside Umeko + Chika), boss 6.13M (Iroha), as pinned. Worst LR ÷ same-pair best non-LR is ×1.149 (≥ 1 under every pair and the team). No S5 girl is in either top-10 list. The nearest is Luna Lv 25 at 6.61M crowd (0.38 of the bar); the S5 girls are at most 2.07M (Rei T5, 0.12) |

### No-nerf gate (`noNerfGate.mjs`, live = 96c3547b, tools byte-identical in both trees, seeds 9/1/2, three profiles + LR-off)

| Pass | cells | missing | under ×0.995 | identical | changed (all on S5 shape tiers, all ≥ ×1.103) |
|---|---:|---:|---:|---:|---:|
| Umeko + Midori | 4,455 | 0 | **0** | 4,404 | 51: Midori 18, Suzu 15, Rei 6, Miko 6, Raika 6 |
| alone | 4,455 | 0 | **0** | 4,402 | 53: Midori 17, Suzu 18, Rei 6, Miko 6, Raika 6 |

Every cell off the ten shape tiers is identical, 4,365 of 4,365 in each pass. Raika's boss and walking-boss cells are identical. The maxed live → branch rows match §16 exactly. Midori T4 crowd is 97,429 → 115,677 supported and 60,078 → 72,951 alone. Midori T5 is 1,075,366 → 1,186,346 and 329,001 → 406,035. Raika T4 is 148,464 → 168,457 and 11,133 → 12,643. Raika T5 is 1,301,597 → 1,453,649 and 139,387 → 181,502. The lowest ratios are Midori T5 crowd supported and Suzu T5 crowd alone, both ×1.103.

### Ability bench (`abilityBench.mjs`, strong preset, 120 s, Auto off/on, both trees)

| Build | Live crowd (off/on) | S5b crowd (off/on) | Boss |
|---|---|---|---|
| Midori 5-0-2 (Catalyst, no mist) | 3.00G / 10.18G, 5 casts | identical | identical |
| Midori 2-0-4 / 2-0-5 / 0-2-5 (no ⚡) | 29.3k / 671k / 731k | 34.8k / 784k / 870k | +17 % (her mist on the held boss) |
| Raika 2-0-4 / 2-0-5 / 0-2-4 / 0-2-5 (Drumstorm, 4 casts) | 121k/135k, 1.18M/1.45M, 169k/198k, 1.54M/1.89M | 140k/155k, 1.53M/1.88M, 195k/226k, 2.01M/2.46M | identical |
| Luna Lv 22 / 25 (Moonbrand, 5 casts) | 2.19M/2.36M, 4.25M/4.53M | 2.24M/2.41M, 4.27M/4.55M | identical |

Nothing is under live, and the cast counts are live's.

## Spec rules in code

- **`spore` is never `poison`.** It is its own key. It ticks through `sim._dot(e, 'poison', …)` (`src/sim/enemies.js:496`) for poison's damage rules, and `_dot` adds it to `shapeDealt` (`src/sim/Sim.js:767`). `applyStatus` merges it only with `spore` (`status.js:48`, `STATUS_ELEMENT.spore = 'poison'`). Every poison reader checks the key `poison` and nothing else: Catalyst (`abilities.js:596-607`), its Auto count (`:799`, `:1392`), `spreadDot` (`Sim.js:813`, `potential.js:134`), the siphon block (`enemies.js:369`), the regen block (`:504`) and the anti-heal report (`report.js:32`). No sim code iterates `e.statuses` generically except `tickStatusDurations`. The spore icon is the poison icon in `STATUS_ORDER`, and only one shows when both are present (`src/render/actors.js:43`, `:950`, `:988`).
- **Raika's web.** It uses its own list `sim.statics` (`s5shapes.js:520-606`). There is no `_hit` hook, and zaps are `shapeSpec`, so they are `noShare`. `chain.length < 2` means no web (`:522`). Members come from her first bolt's `cur` walk (`towers.js:1214-1216`).
- **Luna's moonbeams.** Each beam's list starts as a copy of `t._struck`, which holds her beam victims (`s5shapes.js:449-451`), so a lone boss reads exact. The gate has no hero rows, and the bench above shows her bosses identical.
- **shapeDealt.** Mist, moon and zap hits are `shapeSpec` (`shape: true`), and spore ticks are counted by type. `projectedDps` and the allocators are untouched since S5a.
- **`shapeRoom`** keeps `overPlayer` and `overAll` apart. Pass 2 frees only sim room, and the return value is `n − max(overMine, overPlayer, overAll)` (`src/sim/rings.js:80-99`). The new test is `s5shapes.test.js`, "another player's shape shots…".
- **Midori's mist on a held boss.** This is intended. §3.1 "Parity" says the lone-enemy rule cannot apply to a held stream, so her boss cells gain ×1.17–1.24. It is not a partner nerf, for three reasons:
  - The gate's support Midori is 5-0-2 (Toxicology), which has no mist.
  - `spore` is invisible to every other girl's code.
  - A probe beside the LR bar's two Field-Kit-T5 support pairs (`umeko:p1t5+midori:p2t5`, `midori:p2t5+chika:p1t5`) covered Hotaru, Akane, Kage, Aoi and Tenka at T5, crowd and boss. All 20 cells are bit-identical to live.

## Determinism

There is no rng, `Math.random`, trig, hypot, `**`, `Map` or `Set` in `s5shapes.js`. The only roots are `streamFalloff`, which divides, and `inCone` / `nearSegment`, which square. The integer state is `mist {uid,k,tick,grace}`, `moon {c,side,arc,i,P,n,hits}` (offset `floor(2·side·arc·i/P)`), and web `left` / `zapCd`. Every list is ordered by (d², uid) or by the chain walk. `hashSim` folds `mist`, `moon` and `statics` only while present (`simHash.js:131-140`, `:189-196`). Each of them ends at the wave clear (`endS5Wave`), and battle saves class them as calm or scratch. The co-op checkpoint test and the engines rejoin continue bit-identically.

## The six §16 deviations

I re-ran each girl at the spec's starting values on the bench:

| Deviation | Verdict |
|---|---|
| 1. Densest cone | Sound (the crescent rule). |
| 2. Midori knobs | **T5 justified:** at the starting values her supported crowd is ×1.002 and alone ×1.056. **T4 was not needed for the floor:** at the starting values it already clears +10 % on every crowd row (maxed ×1.14 / ×1.16, L1 ×1.15 / ×1.25, L40 ×1.12 / ×1.18). See LOW 2. |
| 3. Raika T5 0.3 | Justified: at 0.2 her supported crowd is ×1.078. |
| 4. Luna | Not re-measured (hero harness), but gain-only, and her bosses are identical. |
| 5. No panel line | Sound, as in S5a. |
| 6. Luna fixture | Sound. |

## Renderers (Chromium at 390×844, `shots/` not committed)

I ran a real battle on 1-3 with Midori 2-0-5, Raika 2-0-5 and Luna at Lv 25, with walkers parked on the road. Each shape showed on screen:

- **Mist:** soft green puffs in an alpha cone from her flask.
- **Moonbeams:** two lavender bands with a thin additive core under 0.3 tiles.
- **Web:** yellow ground lines between the members. The zap is a colour pulse on the alpha batch, never additive, so it stays inside the flash guard.

The spore ticks show the poison icon. With Reduce Motion on, the mist widths stop flickering, and nothing raised a page error. Rei's open crescent arc showed on screen. The bell wobble was checked in code only (`actors.js:752-757`; render-only `Math.sin`).

## Findings

**HIGH:** none. **MEDIUM:** none.

**LOW**

1. **§16 says "The S5a rows read as §15", but Miko T5 moved** (gain-only). `towers.js:1159` makes attackBeam's lead her first target. That changes Miko's T5 mirror-beam wheel aim: her crowd row goes from 445,445 to 447,151 supported (×1.161) and from 41,457 to 41,635 alone. The L1 and L40 rows move too, and the engines charms go from 159 to 158. **Fix:** update §15's Miko T5 row and §16's sentence, and list this as an S5b change to an S5a girl.
2. **Deviation 2 overstates the T4 need.** **Fix:** say that T4 was raised to give T5 its `len` 1 and for consistency, or keep T4 at the spec values and put `len: 1` on T5. Note that T4 alone L1 is ×1.31, just past Q9's +30 %. That is the coordinator's call.
3. **Spec drift not listed in §16.** CONTRACTS describes what was built.
   - The moonbeam's centre is fixed at the volley's lead direction. §3.4 says it follows at `turnToward` 1.
   - Each beam has its own list and pierce cap, so at Lv 25 one enemy can take both beams in a pass. §3.4 says "at most once a pass".
   - The mist and moon are `t.mist` / `t.moon`, not S2's `t.ch`.

   **Fix:** add these three to §16's deviations.
4. **Test gaps.**
   - The `projectedDps` parity case (`tests/sim/s5shapes.test.js:403-411`) and the brewer case (`:414`) cover only the S5a girls. Add Field Kit Midori, Raika and Luna.
   - No test shows that `spore` leaves the siphon and regen blocks alone (`enemies.js:369`, `:504`).
   - Nothing reaches STATIC_PER_GIRL eviction, STATIC_PER_SIM or the zap deferral (`s5shapes.js:543-551`, `:589-592`).
5. **Web look.** The lines are straight, where §6 asks for a zig-zag sag. They are drawn at ground level under the walkers, so on a packed road (0.35-tile spacing) they hide under the slimes; at 1.1 spacing they show. This is cosmetic and can go to the effects track.
6. **§16's ability-bench line calls Midori 2-0-4 / 2-0-5 / 0-2-4 / 0-2-5 "(Catalyst)".** Catalyst is Toxicology T3, so those builds have no ⚡, and "Auto ×1 as live" means no cast. The Catalyst-beside-mist check is the unit test plus the reviewer's 5-0-2 row above. **Fix:** reword.

**Release gate (standing):** there is no `COOP_PROTOCOL` bump on the branch (PENDING_BUMP `{13: '53662b519844'}`, `tests/art/itemArtRuntime.test.js:214`). Bump once at S5's release, and run `engines.mjs --require-all` where SpiderMonkey and WebKit exist.
