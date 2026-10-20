# Balance notes

## New girls, wave 1 (2026-10-20, `feature/new-girls-w1`; UNIT_GAPS §5)

Azami (R, free after 2-2), Kinu (R, gacha), Wakaba (R, free after 6-5), Yuzuha (SR, free after 4-2).
Bench: a **walking stream** on 4-5 (one 3000-HP slime every 0.5 s along the road, 60 s, the girl on the
bot's own spot for her, best main/cross split) — the stationary bench cannot judge a strip layer.

| Girl | 3/2 | 4/2 | 5/2 | Band (same bench) |
|---|---|---|---|---|
| Azami | 46 | 139 | 998 | R: Aoi 56 / 173 / 1269, Rei 57 / 181 / 1072, Yuki 24 / 159 / 1273 |
| Kinu | 46 | 244 | 1125 | R (as above) |
| Yuzuha | 67 | 213 | 1672 | SR: Sango 79 / 236 / 2303, Midori 93 / 276 / 1150, Suzu 107 / 331 / 2805 |

Moves from the spec's first numbers: Azami strip damage 2 → 3 (Shredder +4, Detonation +16); Yuzuha's
sentries ×4 (base 12 dmg at 1.5/s, darts 4; tier 4-5 damage and bursts raised) — the spec's sentries
sat at a fifth of the SR band. Tier 5s are in the live 12,000-36,000 window (spec × ~1.6).

Bot (`src/sim/headless.js`, keys only the new girls carry, so base-roster plans are unchanged): a buff
thrower is a support placed where her drinks reach the planned carry; `pathScore` reads sentry and strip
tiers like turret tiers.

**Easy gate: 40 / 40** with the full roster; with the four new girls left out every row is bit-identical
to the merged base (the modes goldens pin the same as a "base roster" block). 8-5 Easy over seeds 1-9:
full roster 5 / 9 (seed 1 won), base 6 / 9 — the same near coin flip the roster wave measured.

**Ouka** (SR, gacha; Student Council President, campus hub). She never attacks, so the damage bench does
not apply; her value is coins. Six girls inside her office, each built to 4/2 (Aoi, Rei, Yuki, Kage, Shiro,
Sango: 27,820 coins of upgrades):

| Ouka | team upgrades | saved | Ouka cost | net |
|---|---|---|---|---|
| 0-0-0 (5% off) | 26,440 | 1,380 | 550 | +830 |
| 2-0-0 (14% off) | 23,925 | 3,895 | 1,050 | +2,845 |
| 3-0-0 (+ first tier free) | 22,705 | 5,115 | 2,250 | +2,865 |
| 4-0-0 (+ two free, +2 coins a kill) | 19,735 | 8,085 | 5,850 | +2,235 (before kill coins) |
| 5-0-0 Golden Charter | 18,360 | 9,460 | 25,050 | a prestige buy (+5 a kill, 90% sell) |

She is gacha, so the Easy gate (free roster) never fields her: the gate rows are unchanged (full roster
40 / 40, identical to wave 1; base roster bit-identical to the merged base). The balance bot fields her
poorly (it places her last, after the first upgrade round, where she covers two girls: 4-5 Normal over
seeds 1-2, 178 → 153 lives left; 6-5 184 → 181; 8-5 lost either way): a player places her first and
builds around her. Rules are "strongest wins" with the auras, so her discount never stacks with Momo's.
Bot goldens for the gacha girls (`modesGolden` GACHA_GOLDEN, the free team plus her, seed 1): Ouka 5-4
Hard 21 → 25 lives, 8-4 Hard 37 → 37; Kinu 5-4 Hard 21 → 13, 6-1 Hard 44 → 38. 4-2 Hard (a 4-life win
for the free team) is lost with any ninth girl the bot adds, either of them: its plan spends on her
before the second copies it relies on.


## Roster wave (2026-10-20, `feature/roster-wave`, track 5)

First pass for the nine returning girls; the owner's balance pass comes later. Method: the hero-rework
bench (`tools/balance/bench.js`: stage 4-5's map, a column of 10 stationary ground enemies, 20 s,
default stats, best main/cross split) plus a **stream** bench in `tools/balance/rosterWave.js`
(finite-HP enemies replaced as they fall, so kills and curse bursts count; and a flyer column).
Run: `BALANCE=roster BALANCE_OUT=/tmp/t.md npx vitest run tests/integration/rosterWave.balance.test.js`.
A girl is "in band" when at least one of her stream measures sits inside her rarity's live min × 0.85 …
max × 1.15. Supports (Noa, like Umeko and Miko) are not banded.

| Girl | Rarity | Crowd 3/2 | Crowd 5/2 | Single 5/2 | Stream 3/2 (400 HP) | Stream 5/2 (4,000 HP) | Flyers 3/2 | vs her rarity median: crowd 5/2 · stream 3/2 · stream 5/2 · flyers | In band? |
|---|---|---|---|---|---|---|---|---|---|
| Fuu | R | 54 | 834 | 131 | 54 | 834 | 54 | 0.42× · 0.59× · 0.42× · 0.88× | yes |
| Hana | R | 49 | 696 | 371 | 49 | 696 | 107 | 0.35× · 0.53× · 0.35× · 1.74×! | yes |
| Ruri | SR | 84 | 1191 | 157 | 84 | 1191 | 84 | 0.52× · 0.65× · 0.52× · 0.88× | yes |
| Noa | SR | 10 | 128 | 13 | 10 | 128 | 10 | 0.06×! · 0.07×! · 0.06×! · 0.10×! | support (aura; not banded) |
| Iroha | SSR | 156 | 1449 | 309 | 156 | 1449 | 156 | 1.56× · 3.12×! · 1.68× · 3.11×! | yes |
| Ena | SSR | 42 | 383 | 385 | 42 | 383 | 42 | 0.41×! · 0.85× · 0.44×! · 0.84× | yes |

Bands: the live girls of her rarity, damage dealers only (min … max; "!" = outside min × 0.85 … max × 1.15). Akane and Midori are left out of the 1e9-HP crowd band (their % of max HP burns read the bench's 1e9 HP).
- R: c52 791 · 1999 · 2009 | st32 32 · 91 · 131 | st52 791 · 1989 · 1993 | air32 32 · 62 · 91
- SR: c52 1287 · 2288 · 6877 | st32 61 · 130 · 210 | st52 854 · 2286 · 7006 | air32 42 · 95 · 210
- SSR: c52 864 · 929 · 1902 | st32 45 · 50 · 123 | st52 622 · 864 · 1902 | air32 42 · 50 · 123

Live girls (crowd 5/2 / stream 3/2 / stream 5/2 / flyers 3/2): Aoi 1999/91/1993/91 · Rei 2009/131/1989/0 · Yuki 791/32/791/32 · Momo 1515/53/1504/53 · Akane 29800770/162/3397/0 · Sango 2288/140/2286/0 · Kage 6877/210/7006/210 · Umeko 180/14/180/14 · Shiro 3420/61/3357/61 · Midori 24834025/89/854/42 · Suzu 1860/72/1860/0 · Raika 1287/130/1287/130 · Miko 861/4/861/4 · Hotaru 1902/123/1902/123 · Kaede 929/45/622/42 · Chika 864/50/864/50

| Hero | Lv 1 | Lv 5 | Lv 10 | Lv 15 | Lv 20 | Lv 25 crowd | Lv 25 single | Guards |
|---|---|---|---|---|---|---|---|---|
| Hikari | 18 | 33 | 74 | 167 | 876 | 3960 | 389 | crowd ≤ 1.4× best · single ≤ best · Lv25 ≥ 5/2 median · Lv20 ≥ 4/2 median · Lv10 ≥ ½ 3/2 median |
| Luna | 29 | 48 | 91 | 210 | 983 | 4587 | 127 | crowd ≤ 1.4× best · single ≤ best · Lv25 ≥ 5/2 median · Lv20 ≥ 4/2 median · Lv10 ≥ ½ 3/2 median |
| Nami | 20 | 31 | 74 | 154 | 378 | 1198 | 106 | crowd ≤ 1.4× best · single ≤ best · Lv25 < 5/2 median · Lv20 ≥ 4/2 median · Lv10 ≥ ½ 3/2 median |
| Kanna | 16 | 24 | 59 | 142 | 786 | 6531 | 1847 | crowd ≤ 1.4× best · single ≤ best · Lv25 ≥ 5/2 median · Lv20 ≥ 4/2 median · Lv10 ≥ ½ 3/2 median |
| Yoriko | 11 | 14 | 32 | 54 | 498 | 2775 | 992 | crowd ≤ 1.4× best · single ≤ best · Lv25 ≥ 5/2 median · Lv20 ≥ 4/2 median · Lv10 < ½ 3/2 median |
| Seiran | 16 | 29 | 52 | 87 | 631 | 4305 | 215 | crowd ≤ 1.4× best · single ≤ best · Lv25 ≥ 5/2 median · Lv20 ≥ 4/2 median · Lv10 ≥ ½ 3/2 median |

Tower references: 3/2 median 92 · 4/2 median 360 · 5/2 median 1902 · best 5/2 crowd 6877 · best 5/2 single 2354.

Tuning done to get here (data only): Iroha 5 → 4 damage and 0.8 → 0.7 rate (her two firing points made
her 3/2 the SSR top); Ena 5 → 12 damage, 1.0 rate and bigger tier 4-5 damage (her curses could not
burst when nothing died); Fuu, Hana and Ruri more tier 4-5 damage; Yoriko 4 → 6 and Seiran 4 → 5 base
damage (hero Lv 10 guard). Yoriko still misses the Lv 10 guard (32 < 46): a control hero, like Nami's
Lv 25 miss; left for the owner's pass.

**The campaign (Easy gate, `tests/integration/balance.test.js`): 40 / 40, strict.** The first push lost
8-5 Easy (the Ashwing Matriarch's final flight leaked) and listed it in `KNOWN_EASY_FLIPS`; that list is
gone and the test is identical to v0.1.37's again. Full analysis in `docs/merge/ROSTER_WAVE_NOTES.md` §5:

- **Old roster (the 19 live girls only).** It lost 8-5 on the head because B3's push lock applied to every
  girl's knockback (Shiro, Sango, Umeko, …). The lock now applies only to gathers and to `PUSH_LOCK_KITS`
  (Fuu). The bot also places an amphibious girl on water whenever a water spot is free, as it did when she
  was water-only. With the returning girls left out, every row below and every modes golden is
  bit-identical to v0.1.37.
- **Full pool.** From 7-5 on, Hana and Noa take the last two slots from Yuki and Aoi. 8-5 Easy is a near
  coin flip for this bot: over seeds 1-9 v0.1.37's team wins 2 / 9 (seed 1 is a win) and Hana + Noa 3 / 9.
  Hana's numbers barely matter there (Shiro deals ~90 % of the boss damage). **Noa's base aura +5 % → +8 %
  damage** (Miko's is +10 %) lifts it to 6 / 9, seed 1 included.

Bot fixes kept: a token-damage aura girl is a support (no more three Noas); amphibious girls water-first.
Modes goldens: 1-1 … 6-1 unchanged; 6-3 … 8-5 re-pinned (Noa and Hana in the bot's free team), plus a
"19 live girls" block pinned to v0.1.37's digests.

Easy gate, seed 1, lives left. "Before" = head `fdf741d`; "old roster" = free pool without the nine
returning girls; "full" = everyone free at that point (Noa after 6-2, Hana after 7-5).

| Stage | v0.1.37 (main) | before, old roster | before, full | after, old roster | after, full |
|---|---|---|---|---|---|
| 1-1 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 1-2 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 1-3 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 1-4 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 1-5 | won 121/150 | won 121/150 | won 121/150 | won 121/150 | won 121/150 |
| 2-1 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 2-2 | won 148/150 | won 148/150 | won 148/150 | won 148/150 | won 148/150 |
| 2-3 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 2-4 | won 149/150 | won 149/150 | won 149/150 | won 149/150 | won 149/150 |
| 2-5 | won 145/150 | won 145/150 | won 145/150 | won 145/150 | won 145/150 |
| 3-1 | won 102/150 | won 102/150 | won 102/150 | won 102/150 | won 102/150 |
| 3-2 | won 93/150 | won 128/150 | won 128/150 | won 93/150 | won 93/150 |
| 3-3 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 3-4 | won 136/150 | won 141/150 | won 141/150 | won 136/150 | won 136/150 |
| 3-5 | won 111/150 | won 140/150 | won 140/150 | won 111/150 | won 111/150 |
| 4-1 | won 148/150 | won 131/150 | won 131/150 | won 148/150 | won 148/150 |
| 4-2 | won 144/150 | won 143/150 | won 143/150 | won 144/150 | won 144/150 |
| 4-3 | won 148/150 | won 148/150 | won 148/150 | won 148/150 | won 148/150 |
| 4-4 | won 141/150 | won 141/150 | won 141/150 | won 141/150 | won 141/150 |
| 4-5 | won 140/150 | won 140/150 | won 140/150 | won 140/150 | won 140/150 |
| 5-1 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 5-2 | won 143/150 | won 143/150 | won 143/150 | won 143/150 | won 143/150 |
| 5-3 | won 116/150 | won 116/150 | won 116/150 | won 116/150 | won 116/150 |
| 5-4 | won 141/150 | won 143/150 | won 143/150 | won 141/150 | won 141/150 |
| 5-5 | won 150/150 | won 149/150 | won 149/150 | won 150/150 | won 150/150 |
| 6-1 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 6-2 | won 146/150 | won 146/150 | won 146/150 | won 146/150 | won 146/150 |
| 6-3 | won 147/150 | won 147/150 | won 148/150 | won 147/150 | won 148/150 |
| 6-4 | won 149/150 | won 150/150 | won 150/150 | won 149/150 | won 150/150 |
| 6-5 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 7-1 | won 146/150 | won 146/150 | won 145/150 | won 146/150 | won 145/150 |
| 7-2 | won 147/150 | won 147/150 | won 145/150 | won 147/150 | won 145/150 |
| 7-3 | won 139/150 | won 137/150 | won 139/150 | won 139/150 | won 143/150 |
| 7-4 | won 122/150 | won 138/150 | won 135/150 | won 122/150 | won 119/150 |
| 7-5 | won 117/150 | won 147/150 | won 144/150 | won 117/150 | won 113/150 |
| 8-1 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 8-2 | won 148/150 | won 150/150 | won 150/150 | won 148/150 | won 149/150 |
| 8-3 | won 149/150 | won 150/150 | won 150/150 | won 149/150 | won 150/150 |
| 8-4 | won 145/150 | won 145/150 | won 150/150 | won 145/150 | won 150/150 |
| 8-5 | won 144/150 | **lost** 0/150 | **lost** 0/150 | won 144/150 | won 145/150 |
| **wins** | 40/40 | 39/40 | 39/40 | 40/40 | 40/40 |

"Before, old roster" also differed from v0.1.37 on 13 more stages (lives only: the girls' push lock),
all back to v0.1.37's numbers now. Run: a scratch copy of the gate with the free pool filtered
(`freeUnitsBefore` minus `EXPANSION_IDS`), on both checkouts.

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

**Owner, 2026-10-15: approved ("Sure ship"); the Hard change (30 → 26 wins) accepted; one HP-pass re-fit at the train-C combined pass is fine.**

**First-clear gems reachable earlier for a free player (Q2, shipped as measured):**
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
