# Iroha's mirror network: review round 4 (owner-approved extra round)

Target: `feature/iroha-mirrors` at 7d1cc0bf (merges `feature/balance-r5` b2f4345c; sim id f75317571b4e in PENDING_BUMP,
`tools/simId.mjs` matches it; COOP untouched, which is correct while unshipped). Compared with live `main` and r5 (b2f4345c).
The r5 bench files were copied unchanged into a `main` worktree. Every bench uses the r5 measure (`tools/balance/r5Bench.mjs`:
fully maxed, stage 4-5, targets that never die), with the mean of seeds 9, 1 and 2 unless noted. I ran my own harness on top
of it (held-boss offset, placed layouts, allies), and it reproduces §10 to the digit.

**Verdict: OK.** Every round-3 HIGH and MEDIUM finding is fixed and holds up when measured independently. Four LOW notes follow, and none of them blocks.

## Round-3 findings: status

| r3 | claim | verified |
|---|---|---|
| HIGH-1 off the sweet spot | slot 0 = r5's panel spot, a glint on every real bounce, the final pick near each mirror | **Fixed.** All 18 builds, with Umeko + Midori and alone, boss held −4…+4 tiles in 0.5 steps: no cell below r5 or main. Lowest is ×1.07 r5 (5-0-2 alone at +1), ×4.17 main. At −4, 4-0-2 and 5-0-2 now reach where r5 does 0. |
| HIGH-2 layouts ×1.5 over the spec | `splashed` set on each bolt, a real search | **Fixed.** See the search below: best ≤ ×1.03 of §10's best column. |
| HIGH-3 Kage beside her | r5 cause | r3 setup: main 418.6k, r5 526.8k, branch **1.05M** (with Umeko + Midori 3.94M / 5.39M / 10.77M). |
| MEDIUM-1 restore moves mirrors | clamp, then quantise; restore writes `mr` as saved | **Fixed.** My probe: 300 random layouts (reach ±1/3/8, random slot order, all three paths, stages 1-1 / 4-5 / 6-1, with Umeko). Each was played through a wave and saved at the calm point, then restored and both copies played one more wave on the same stream: 0 mirrors moved, 0 hash differences. |
| MEDIUM-2 Laser Web gate | T3 0.8 | **Fixed.** abilityBench crowd: 3-0-0 ×1.25, 3-0-1 ×1.22, 3-0-2 ×1.21, 3-1-0 ×1.25, 3-2-0 ×1.19, 4-0-2 ×1.07, 5-0-2 ×1.13, 5-2-0 ×1.17 (all ≤ 1.35). |
| MEDIUM-3 abilityBench boss | | Covered by HIGH-1's fix. |
| LOW aim event | stored spot | Fixed (`Sim.js:1507-1512`). |

## (1) Auto, r5Bench: every build × boss / walking boss / crowd × with Umeko + Midori and alone, at or above main and r5
The lowest cell is 2-0-5 crowd with supports, at ×1.18 r5 and ×1.28 main. Selected rows (main / r5 / branch, with supports):

| build | boss | walking boss | crowd |
|---|---|---|---|
| 0-0-2 | 10.6k / 45.4k / 130.0k | 1.0k / 4.5k / 6.3k | 32.0k / 34.3k / 85.6k |
| 3-0-2 | 19.9k / 85.1k / 276.9k | 1.9k / 8.3k / 21.7k | 60.5k / 65.1k / 249.0k |
| 5-0-2 | 255.3k / 1.09M / 2.77M | 25.5k / 108.0k / 576.4k | 772.1k / 835.9k / 5.13M |
| 2-1-0 | 17.9k / 76.1k / 142.7k | 1.7k / 7.6k / 14.6k | 46.3k / 50.5k / 112.7k |
| 2-5-0 | 129.3k / 548.9k / 2.10M | 27.8k / 119.6k / 412.6k | 247.7k / 270.2k / 1.16M |
| 2-0-1 | 19.9k / 85.1k / 159.1k | 1.9k / 8.3k / 16.4k | 52.3k / 55.8k / 126.3k |
| 2-0-5 | 120.2k / 508.7k / 1.86M | 37.8k / 170.9k / 1.63M | 5.45M / 5.88M / 6.96M |

## (2) Boss held along the road, −4…+4 (step 0.5, with supports; −3, −1.5, +1, +2 alone): lowest ratio per build
×r5 / ×main: 0-0-2 1.13 / 4.78 · 1-0-2 1.13 / 4.77 · 2-0-2 1.13 / 4.42 · 3-0-2 1.51 / 5.89 · 4-0-2 1.20 / 4.68 · 5-0-2 **1.07** / 4.17 ·
2-0-0 / 2-1-0 1.13 / 4.39 · 2-2-0 1.47 · 2-3-0 1.81 · 2-4-0 2.27 · 2-5-0 2.32 · 2-0-1 / 2-0-3 1.13 · 2-0-4 2.57 · 2-0-5 2.21.
No cell is 0 where r5 or main reaches.

## (3) Adversarial placement search (seed 9: 519 layouts per case, then 240 perturbations of the top 8, top 4 re-run on 3 seeds)
The layouts were stars of radius 0.35–2.2 (3 to 5 points, step 1 or 2, 4 rotations), lines along the road (spacing 0.6–2.5, on the road and to either side), zigzags across the road, and 160 random layouts within ±1.5 / 2.5 / 3.7 tiles.

| case | Auto | spec best | found (3 seeds) | × spec | best / Auto | alone (no supports) |
|---|--:|--:|--:|--:|--:|--:|
| 5-0-2 boss | 2.77M | 5.96M | **6.13M** | ×1.03 | ×2.21 | 0.60M (Auto 0.27M) |
| 2-0-5 crowd | 6.96M | 8.70M | **8.90M** | ×1.02 | ×1.28 | 0.62M (Auto 0.46M) |
| 2-5-0 boss | 2.10M | 4.79M | **4.91M** | ×1.03 | ×2.34 | 0.49M (Auto 0.21M) |

Nothing reaches ×1.2 of the spec's best column. The best layouts are 5-point stars of radius about 0.6–0.75 around the held boss, and road lines 1.25 tiles apart for the crowd case.

**LR check:** on this bench the LR boss rows are Tenka 13.54M and the duo 17.43M with supports, and 1.39M / 1.64M alone. I could not
reproduce the "5.8–6.7M" range with this measure. Compared like for like, every Iroha cell is under every LR row, so the owner's rule
holds. **Note for the balance session** (no change asked of Iroha): her best placed 5-0-2 boss (6.13M) is ×2.3 Kage (2.70M) and
×1.9 Shiro (3.24M), the top non-LRs on this bench.

## (4) Allies (Kage, Aoi, Akane, Tenka × 5-0-2 / 2-5-0 / 2-0-5 × boss / crowd × near / across / far × with supports / alone, 3 seeds; 432 cells × 3 trees)
Near and across: every cell is ≥ ×0.98 of r5 and main. I re-ran the lowest five on 8 seeds: akane 2-0-5 boss near with supports ×1.001, akane
2-5-0 boss across alone ×1.005, akane 5-0-2 boss near alone ×1.001, tenka 2-5-0 boss near alone ×0.999, **tenka 2-0-5 boss near alone
×0.994** (LOW-1). Examples (main / r5 / branch): kage 5-0-2 boss near alone 418.5k / 527.9k / 790.3k; kage 2-0-5 crowd near with supports
2.12M / 2.30M / 2.71M; aoi 2-0-5 boss near alone 138.0k / 389.3k / 579.6k; aoi 2-0-5 crowd near alone 37.8k / 106.6k / 168.6k (8 seeds).
For the far rows the ally spot was pinned to the branch's spot on all three trees: see LOW-2.

## (5) The glint (`src/sim/mirrors.js:467`, `:531`)
The glint is well defined. It uses `bestTarget` → `gatherTargets` → `isEligible`, the same rule as her own shot, so enemies in a tunnel (`hidden`) are skipped,
flyers follow `canHitAir`, veiled enemies need detection and phasing enemies need holy or mystic damage. Shields and armor go through `_hit`. It fires once per
full bounce of her own bolt. Ally copies and legs shorter than `MIN_LEG` never glint, so a bolt glints at most `BOUNCE_CAP` (6) times. It has no
per-step budget of its own, but it is bounded by bounces (perf below), and its FX shares the beam cap (`rosterFx.js:345`). A glint
can strike the enemy the leg just hit (that is by design, ×0.8). See LOW-3.

## (6) Determinism, performance, tests
- `npm test`: **399 files passed, 2 skipped; 6293 tests passed, 11 skipped** (521 s).
- `node e2e/smoke.mjs`: **ALL SMOKE CHECKS PASSED** (678 ok, 0 fail).
- `node e2e/iroha-mirrors.mjs`: **all ok** (81 ok).
- `node e2e/engines.mjs`: **OK, 3 runs on 2 engines (V8, JavaScriptCore)**, including mid-wave rejoins and Iroha's counters. Firefox and WebKit are not installed here.
- `node e2e/coop-rejoin.mjs`: **all checks ok** (19 ok).
- `perf.mirror.test.js` run alone: tier 5 is 0.82–0.96 ms a step (×1.54 of tier 4), with p99 2.55 ms and worst 3.10 ms. Kaleidoscope is 0.67 ms, with p99 2.28 ms. In the full suite it passed.

## LOW
1. Tenka 2-0-5 next to her (near, no supports, 8 seeds) is at ×0.994 of r5 (1.36M vs 1.37M). In r3 this was ×0.99 and it has since shrunk. It is above main ×418. It could be noise in her timing. Accept it, or re-check it in the balance session.
2. Far allies on a crowd wobble ±2.6% between trees even with the same spot (akane 5-0-2 crowd far, alone: ×0.98 over 8 seeds, per-seed
   ×0.95–1.06). The cause is the bench, not her mirrors: Iroha's one-step kills on the 2e6-HP stream change which enemies reach a girl more than 6 tiles from
   any mirror. Akane 2-5-0 crowd across, alone, is ×0.92 of main but equal to r5, so r5 causes that one (balance session).
3. No unit test pins the glint: its 0.8 share, that it skips tunnel, veiled and air (`canHitAir: false`) enemies, and that it never fires on an ally copy or a short leg. Add one to
   `tests/sim/irohaMirrors.test.js`.
4. `mirrorGlint` reports `towerUid: p.ownerUid` (`mirrors.js:536`), while `mirrorBounce` reports `p.mirrorOf`. These are the same value for her own bolts, which are the only bolts that glint. Use
   `p.mirrorOf` so the two events are consistent.
