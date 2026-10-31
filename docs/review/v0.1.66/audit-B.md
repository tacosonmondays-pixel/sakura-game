# Release v0.1.66: audit B (balance on the merged tree)

Target `release/v0.1.66` @ 94cb548b against live `origin/main` c34f7bd3 (v0.1.65). Read-only audit: no product code changed.
The scratch benches named below were run but not committed.

**Verdict: GO for area B.** Two findings are left for the owner to classify (F1, F2) and one design flag (F3). None of them
is a regression on the fixed bench.

## 1. No-nerf gate (`tools/balance/noNerfGate.mjs`, default: tiers 1–5, maxed / l1 / l40, LR-off pass, seeds 9/1/2)

| support | cells | missing | under live ×0.995 |
|---|---:|---:|---|
| none | 4,455 | 0 | **0** |
| um (Umeko + Midori) | 4,455 | 0 | 5, exactly the documented cells: Sango p2t4 crowd l1 ×0.986, Shiro p2t1 crowd l1 ×0.992, Shiro p0t4 / p0t5 held boss l1 ×0.992, Midori p2t3 walking boss l1 4 → 3 |

**Stat level (a scratch harness that compares live and release `unitBattleStats` on the same pieces):** 200 random classic-gear profiles
(Rare to UR, +0–10, random mains/subs/clubs, L1–85, ★0–5, gates 0–10, P0–6) × 39 units × LR on/off. That is 15,600
comparisons of damageMul, rate, range, crit, armor pen, haste, pierce, aura, cost, trap hit (× avgCrit) and DoT
(× dotMul × avgCrit). **0 under.** The same pieces carrying each of the six sets (their 2-piece stat): 6 × 11,700 comparisons,
**0 under**. The new Armor Pierce cap (40) and the per-piece DoT table never cut a live value.

**Gear sets in battle** (the r5Bench measure fed a set profile, um, seed 9, all 31 non-hero girls × 3 paths × T4 and T5 × 3 targets =
558 cells per profile). Each profile is compared with maxed, i.e. the same three UR Taiko pieces with no set:

| profile | under | min | mean |
|---|---:|---:|---:|
| same 3 pieces as Geometry pieces | 0 | 1.000 | ×1.03 |
| 5-piece Geometry (+ UR hair ATK, necklace Crit DMG) | 0 | 1.000 | ×2.82 |
| 5-piece Party Popper | 0 | 1.000 | ×1.99 |
| 5-piece Freeze Tag | 0 | 1.000 | ×1.98 |
| 5 Blank LR +18 | 2* | – | ×7.59 |

\*Both are bench artifacts. Suzu p1t5 held boss 1,664 → 0 on seed 9 only (mean of 3 seeds 1,816 → 9,390). Kohaku&Tsubaki p2t5
crowd 22.9M → 13.6M because her hits one-shot the 2M crowd and kills cap credited damage; at 2e8 crowd HP it is 22.9M → 193.7M.
The shape rows (decision A) gain from Right Angle / Confetti Burst, and no set wearer loses anything.

Wakaba / Ouka / Suzu `damageMul` equals live exactly on maxed, l1 and l40 (5.8494 / 5.8541 / 5.8393). `avgCritTrade.test.js` passes.

## 2. LR bar

- `lrBar.mjs` default: every LR build is OK: crowd ×1.31–1.33 of the bar, boss ×2.29–4.61.
- `lrBar.mjs --bar`: BAR crowd 17,399,281 (Akane p0t5, Umeko + Chika) and boss 6.13M (Iroha KNOWN), **identical to the pinned
  LR_BAR**. Worst LR ÷ same-pair best non-LR is ×1.149 (Tenka p1t5, Umeko + Midori 2-0-5), matching BALANCE.md.
- **LR gear** (fixed bench, seeds 9/1/2, crowd = mean, boss = max of held and walking; "hi" = crowd 2e8 / boss 3e9 HP, so
  LR-gear hits are not kill-capped):

| comparison | crowd | boss |
|---|---|---|
| LR (UR gear), worst … best | 22.84 … 23.09M | 14.06 … 28.25M (hi 32.63M) |
| LR in 5 Blank LR, worst (hi) | 192.39M (Tenka p2t5) | 119.82M (Kohaku p2t5) |
| best non-LR in 5 Blank LR (hi) | 150.04M (Akane p0t5) → LR ×1.28 | 65.12M (Shiro p0t5) → LR ×1.84 |
| LR in 5-piece Geometry, worst | 54.05M (hi 66.80M) | 28.78M |
| non-LR in 5-piece Geometry, best | 53.24M (Akane) → LR ×1.015 (hi ×1.25) | 13.27M (Aoi) |

## 3. Freeplay (`capBot --build A2 --profile full`, seed 7, Normal)

| stage / tier | reached | docs/FREEPLAY.md |
|---|---|---|
| 4-5 Blossom | **250**: falls at the Wyrm (95 % lost to boss) | 250 ✔ |
| 1-5 Blossom | 262+ (Wyrm killed) | 260+ ✔ |
| 4-5 Tempest | 210 | 210 ✔ |
| 4-5 Crimson Moon | 204 | 205 (1 wave earlier, harder ✔) |

`freeplayWyrmReach.test.js` passes. Rewards: coins per wave unchanged (40 × rewardMul). There is one new one-time milestone, w225:
150 gems per tier, once per account. Coins earned to 250 ≈ 1.35M. Sane.

## 4. Interaction pairs (not covered by the gate; 180 cells, live vs release, seeds 9/1/2)

Ena × Midori's spore, Iroha × the S5 shape girls (Miko 0-5-0, Rei 5-0-0, Raika 0-0-5 / 5-0-0, Suzu 5-0-0), each in both directions.
Ena's own numbers rise ×4–12 and Iroha's allies ×1.1–7.9 (Iroha + Suzu boss 5.2k → 41k). Eight cells come in under live:

- **F1 (credit, MEDIUM, owner to classify): Midori beside Ena 2-5-0.** Midori 0-0-5 held boss 7,570 → 6,598 (×0.872), walking
  ×0.969; at 0-0-3, 3,030 → 323. The team total *rises* (0-0-3: 18.2k → 98.6k). Cause: `src/sim/status.js:120` merges poison
  per key. Ena's T5 poison (Unwritten Name, now stronger) wins on `dps` and takes `sourceUid`, so Midori's kept `pct` ticks are
  credited to Ena (`src/sim/Sim.js:786` `_dot`). The rule is live's, and only Ena's new strength triggers it. Fix (a sim change →
  sim id + COOP_PROTOCOL): keep a `pctUid` beside `pct`, or credit each component to its own source. Not a release blocker
  unless credited per-girl numbers in pairs count.
- **F2 (MEDIUM): Iroha 2-0-5 beside Raika 2-0-5, crowd.** Iroha's own 716k → 623k (×0.871), team total 827k → 801k (**×0.970**, the
  only real team-total loss found). Beside Raika 5-0-0: Iroha ×0.951, but the team total is ×1.04. Beside Raika 0-0-3 / 0-0-4,
  Iroha's own holds. Most of it is mirror splits now credited to the ally (Raika ×1.6). Fix: the owner classifies it as an
  explained supported cell, or `irohaLayouts.mjs` is re-run with Raika.
- Noise-level (×0.98, under 1.1k DPS): Iroha + Miko walking boss, Miko + Iroha walking boss.

## 5. Design flag for the owner

**F3: LR gear outranks LR units.** A non-LR girl in 5 Blank LR beats every LR unit in UR gear: Akane crowd 150M against the best
LR's 23.1M (×6.5), and Shiro boss 65M against 32.6M. A 5-piece *UR* Geometry Akane (53M crowd) also beats an LR unit in plain
UR gear. Like-for-like (same gear on both), LR stays on top: ×1.28 / ×1.84 in Blank LR, and ×1.015 (crowd, kill-capped bench)
to ×1.25 in Geometry. The 1.25× margin is proven only for equal 3-piece gear. `lrBar.mjs` and its test measure that bench only.
The owner should decide whether "LR on top" means equal gear (true today) or any gear (false by design of the ×8 gear multiplier).

## 6. Tests

`npm test` (full): **420 files passed, 2 skipped; 6,636 tests passed, 11 skipped, 0 failed** (623 s).
