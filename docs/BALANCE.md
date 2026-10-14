# Balance notes

## Hero rework (2026-10-14, `feature/hero-rework`; spec `docs/specs/HERO_REWORK.md`)

Heroes deploy for free and level 1–25 inside each battle. Measured on this branch against the live
code (`ca97c1e`), same bot, same seed, same script on both checkouts.

**Method.** Headroom = the largest multiplier on a stage's enemy HP that the balance bot still wins:
Normal, the free-to-play roster at `EXPECTED_LEVEL` with `autoPlan` (no level buying, no ult), seed 1,
bracket search 0.25–16 on a log scale, 7 steps (`tools/balance/headroom.js`; `BALANCE=hero` runs it on
ten stages with the pace / power guards). "✗" = the bot loses at ×1. Default hero: Hikari on chapter 1,
Nami after 1-5.

### Summary

| | Live (today) | Reworked, no HP pass | **Reworked + stage-HP pass (ships)** |
|---|---|---|---|
| Normal headroom, geomean of 40 stages | 2.71 | 5.38 (**×1.98** of live) | **3.13 (×1.15 of live)** — target 1.1–1.3 |
| Easy / Normal wins (`BALANCE=full`) | 40 / 39 (8-5 lost) | — | **40 / 39** (8-5 lost) |
| Hard / Nightmare wins | 30 / 0 | — | **26 / 3** |
| Hero end level, chapter 1 / 8-5 (no buying) | 5–10 / 10 | 14–19 / 18 | 14–19 / 19 |

**Stage-HP pass** (`HERO_HP_PASS` in `src/data/stages.js`, data only): per chapter, the chapter's
headroom gain ÷ 1.05, capped per stage so no stage ends harder than today for the bot, floor 1,
step 0.05. Enemy HP only: `cashScale` is computed from the pre-pass `hpScale`, so coins per kill and
per wave do not move. It also applies to co-op (×1.6 on top) and co-op freeplay, which use the stage's
`hpScale`. Re-measured after applying it (not just computed): ×1.154 (prediction ×1.147).

### Per stage (Normal headroom)

| Stage | Hero | Live (today) | Reworked, no HP pass | **Reworked + HP pass** | HP pass × | Reworked ÷ live | **+ pass ÷ live** | Hero end level live / reworked / + pass |
|---|---|---|---|---|---|---|---|---|
| 1-1 | Hikari | 6.73 | 11.81 | **6.73** | 1.75 | ×1.75 | **×1.00** | 6 / 15 / 15 |
| 1-2 | Hikari | 3.51 | 6.58 | **3.75** | 1.75 | ×1.87 | **×1.07** | 8 / 14 / 15 |
| 1-3 | Hikari | 5.66 | 8.92 | **5.91** | 1.55 | ×1.58 | **×1.04** | 5 / 14 / 14 |
| 1-4 | Hikari | 2.65 | 4.46 | **2.59** | 1.65 | ×1.68 | **×0.98** | 8 / 15 / 16 |
| 1-5 | Hikari | 3.36 | 8.18 | **4.65** | 1.75 | ×2.43 | **×1.38** | 10 / 19 / 19 |
| 2-1 | Nami | 2.23 | 3.44 | **2.28** | 1.5 | ×1.54 | **×1.02** | 7 / 14 / 15 |
| 2-2 | Nami | 1.92 | 3.91 | **2.00** | 1.95 | ×2.04 | **×1.04** | 8 / 15 / 17 |
| 2-3 | Nami | 1.96 | 3.91 | **1.96** | 1.95 | ×1.99 | **×1.00** | 10 / 20 / 20 |
| 2-4 | Nami | 2.13 | 3.22 | **2.13** | 1.5 | ×1.51 | **×1.00** | 9 / 14 / 14 |
| 2-5 | Nami | 2.13 | 8.92 | **4.36** | 1.95 | ×4.19 | **×2.05** | 8 / 17 / 19 |
| 3-1 | Nami | 3.75 | 7.34 | **4.97** | 1.45 | ×1.96 | **×1.33** | 8 / 15 / 15 |
| 3-2 | Nami | 2.00 | 3.15 | **2.18** | 1.45 | ×1.57 | **×1.09** | 6 / 13 / 14 |
| 3-3 | Nami | 2.95 | 3.83 | **3.08** | 1.25 | ×1.30 | **×1.04** | 9 / 20 / 20 |
| 3-4 | Nami | 1.58 | 2.23 | **1.54** | 1.4 | ×1.41 | **×0.97** | 10 / 19 / 20 |
| 3-5 | Nami | 1.45 | 2.23 | **1.54** | 1.45 | ×1.54 | **×1.06** | 10 / 17 / 18 |
| 4-1 | Nami | 2.13 | 6.44 | **2.77** | 2.3 | ×3.02 | **×1.30** | 10 / 18 / 21 |
| 4-2 | Nami | 1.83 | 4.65 | **2.09** | 2.3 | ×2.54 | **×1.14** | 10 / 21 / 23 |
| 4-3 | Nami | 2.95 | 9.11 | **3.83** | 2.3 | ×3.09 | **×1.30** | 10 / 20 / 23 |
| 4-4 | Nami | 1.54 | 2.89 | **1.51** | 1.85 | ×1.88 | **×0.98** | 10 / 19 / 20 |
| 4-5 | Nami | 2.23 | 4.46 | **2.23** | 2 | ×2.00 | **×1.00** | 10 / 17 / 18 |
| 5-1 | Nami | 3.59 | 11.56 | **5.66** | 2.1 | ×3.22 | **×1.58** | 10 / 19 / 20 |
| 5-2 | Nami | 2.00 | 3.36 | **2.09** | 1.65 | ×1.68 | **×1.04** | 10 / 16 / 17 |
| 5-3 | Nami | 1.45 | 2.71 | **1.54** | 1.85 | ×1.87 | **×1.06** | 10 / 18 / 19 |
| 5-4 | Nami | 4.09 | 12.34 | **5.91** | 2.1 | ×3.02 | **×1.44** | 10 / 21 / 22 |
| 5-5 | Nami | 8.35 | ≥16 | **10.83** | 1.9 | ×1.92 | **×1.30** | 10 / 24 / 24 |
| 6-1 | Nami | 3.44 | 4.76 | **3.51** | 1.35 | ×1.38 | **×1.02** | 10 / 21 / 21 |
| 6-2 | Nami | 2.65 | 7.66 | **4.00** | 1.95 | ×2.89 | **×1.51** | 8 / 19 / 20 |
| 6-3 | Nami | 3.08 | 5.19 | **3.02** | 1.65 | ×1.69 | **×0.98** | 10 / 17 / 17 |
| 6-4 | Nami | 3.59 | 8.00 | **4.00** | 1.95 | ×2.23 | **×1.11** | 10 / 20 / 21 |
| 6-5 | Nami | 4.56 | 12.34 | **6.30** | 1.95 | ×2.71 | **×1.38** | 8 / 19 / 21 |
| 7-1 | Nami | 2.48 | 3.91 | **2.54** | 1.55 | ×1.58 | **×1.02** | 10 / 18 / 18 |
| 7-2 | Nami | 5.19 | 14.05 | **6.17** | 2.4 | ×2.71 | **×1.19** | 10 / 21 / 23 |
| 7-3 | Nami | 1.87 | 4.18 | **1.87** | 2.2 | ×2.24 | **×1.00** | 10 / 24 / 25 |
| 7-4 | Nami | 3.75 | 13.75 | **5.66** | 2.4 | ×3.67 | **×1.51** | 10 / 20 / 21 |
| 7-5 | Nami | 3.22 | 9.72 | **4.18** | 2.4 | ×3.02 | **×1.30** | 9 / 18 / 21 |
| 8-1 | Nami | 4.46 | 7.34 | **5.66** | 1.3 | ×1.65 | **×1.27** | 10 / 20 / 20 |
| 8-2 | Nami | 2.33 | 3.02 | **2.43** | 1.25 | ×1.30 | **×1.04** | 10 / 22 / 22 |
| 8-3 | Nami | 2.95 | 4.27 | **3.22** | 1.3 | ×1.45 | **×1.09** | 8 / 19 / 20 |
| 8-4 | Nami | 2.77 | 4.00 | **3.08** | 1.3 | ×1.44 | **×1.11** | 10 / 19 / 19 |
| 8-5 | Nami | 0.60 ✗ | 0.66 ✗ | **0.64 ✗** | 1.1 | ×1.10 | **×1.07** | 10 / 18 / 19 |

The pass makes the late campaign's enemies tougher in absolute HP (7-x: ×2.4) but, with the hero
growing through the battle, the bot's margin there ends at ×1.0–1.5 of today. 8-5 stays lost for the
bot (as today; it is won when the bot buys hero levels, spec §6.1).

### Medal difficulties (`BALANCE=full`, all 40 stages, no buying, no ult) — owner question Q2

| Difficulty | Live wins | **Reworked + HP pass** | Newly won | Newly lost |
|---|---|---|---|---|
| Easy | 40/40 | **40/40** | — | — |
| Normal | 39/40 | **39/40** | — | — |
| Hard | 30/40 | **26/40** | — | 2-3, 2-4, 7-3, 7-5 |
| Nightmare | 0/40 | **3/40** | 1-1, 1-2, 1-3 | — |

**First-clear gems reachable earlier for a free player (Q2, shipped as measured, the default):**
Nightmare +3 stages × 100 = **+300 gems** reachable earlier (and sweeping of those stages); Hard 4 stages
× 60 = 240 gems now need more levels or gear than before. Once per account; the medal budget
(220 gems × 40 stages) is unchanged. The spec measured the rework **without** the HP pass at +760
(6 Hard + 4 Nightmare); the HP pass that ships removes most of that. If the owner says no:
`DIFFICULTIES.hard/nightmare.heroCost` (data) puts a deploy price back on medal difficulties only.

### Power: in-sim crowd / single-target bench (`tools/balance/bench.js`, `BALANCE=hero` power guard)

Stage 4-5's map, a column of 10 ground enemies along 2 tiles of road (1e9 HP, no armor), the unit on
the nearest valid spot, 20 s; damage ÷ 20. Default stats, no gear; towers at their best main/cross split.

| Unit | Lv 1 | Lv 5 | Lv 10 | Lv 15 | Lv 20 | Lv 25 crowd | Lv 25 single target |
|---|---|---|---|---|---|---|---|
| Hikari | 18 | 33 | 74 | 167 | 876 | **3,960** (1.14× best 5/2) | 389 (0.33×) |
| Luna | 29 | 48 | 91 | 210 | 983 | **4,587** (1.32×) | 127 (0.11×) |
| Nami | 20 | 31 | 74 | 154 | 378 | **1,198** (0.34×; 1.28× median) | 106 (0.09×) |

Towers, crowd: tier 3/2 median 81 · 4/2 median 219 · 5/2 median 934, best **Kage 5/2 3,473**; single
target at 5/2: best **Kage 1,189**. Guards (all pass): Lv 25 crowd ≤ 1.4× and single ≤ 1.0× the best
5/2 tower; Lv 25 crowd ≥ the 5/2 median; Lv 20 ≥ the 4/2 median; Lv 10 ≥ half the 3/2 median.
Luna's Lv 22 "Lunatic Lance" is +8 damage (spec +10) to stay under the 1.4× guard on this bench.

### Deliberate side effects (said in the tips)

- Cost-cut auras (Umeko, Miko, Nami's Lv 24 Harbor aura) discount tower upgrades, **not hero levels**.
  Gear Cost Reduction on a hero now discounts her level prices ("Level prices −X %").
- Codex Half Income (#169) halves coins, not level prices: buying levels is relatively dearer there.

### Still to do (train C combined pass, landing plan §9.2)

The HP pass above is calibrated on the hero rework alone. Chika, Potential and codex modes add power
on the same train; the combined pass re-runs this script on `train/battle-2` and re-fits
`HERO_HP_PASS` once. Co-op balance (`COOP.hpMul` 1.6) and freeplay `hpBands` were not re-measured here.
