# Balance — targets, probe and calibration

Owner: balance. This file holds the balance targets, the rules behind the in-battle numbers, how
they are measured, and the results of the latest rounds: the playtest round "frisk1636" (2026-10-08,
branch `feature/balance-playtest`; round 1 + round 2). Data lives in `src/data/units.js` (prices),
`src/data/stages.js` (stage HP, coins, waves), `src/data/enemies.js` (boss HP), `DIFFICULTIES` /
`BATTLE` in `src/data/types.js`, `src/sim/waves.js` (crowd bonus) and `src/systems/progression.js`
(levels).

## 1. What the playtest said, and what changed

| Playtester said | Root cause (probe, live build) | Change |
|---|---|---|
| "units be a bit spendy" | 650–740 start cash against a 460–520 hero; a whole stage paid 2.3–8.3k coins in ch1–2 | Placement ×0.75; cashScale floor 1.3; wave-clear bonus 80 + 6w → 100 + 7w |
| "lower upgrade prices", "to level 4 you need 2400 gold" | Aoi + tiers 1–4 cost 137–153 % of everything 1-1 paid; nobody reached tier 4 in ch1 | Tiers 1–3 ×0.75, **tier 4 ×0.5**, tier 5 ×0.9 — one rule for every unit |
| "more money per round based on how many enemies / types — just a little" | — | **Crowd bonus**: +1 per enemy in the wave (max 20) + 4 per enemy type, paid with the wave-clear bonus and shown in the toast |
| "normal be very easy" | Normal median headroom ×2.56 (bot) / ×3.02 (human-like), 95–100 lives kept in ch1–2 | Per-stage `hpScale` calibrated to the target curve below |
| "nightmare be hell" | 0 / 44 wins; wave-1 losses at any HP (1 life, ×1.75 HP, no income) | **20 lives** (was 1), enemy HP/speed as Normal, ×1.1 prices, ×1.5 start cash, income girls ×0.5 (was off) |
| "1.1 balanced, 1.2 too easy" | Headroom 1-1 ×4.76 · 1-2 ×3.44 · 1-3 ×5.42 · 1-4 ×2.65 · 1-5 ×3.22 — no ramp; 1-2's opening died 23 % down the lane | Per-stage `hpScale`; 1-2 gets a real opening (budget 18 from wave 1) and four goblin-runner rushes (waves 3 / 8 / 11 / 14) |
| "poor slimes lol" | Ordinary ch1 enemies lived ~5 s and died 10–21 % down the path; Hikari did 82–98 % of the damage | More enemy HP; hero XP per damage 1 → 0.4 |
| Bosses "live .8 s longer than everything" | The Slime Prince never reached a phase (leaked); a tier-5 Shiro deleted ch6–8 bosses in 16–19 s; Total Assault Lych/Colossus unkillable | Boss HP retuned, Prince's sprint softened, tier 5 kept expensive, Total Assault HP down |
| Level Up tab looks unaffordable | The tuning level needed 96k EXP for ch3 and 303k for ch4 (30 / 103 days of dailies) | EXP curve −30 to −38 %; `EXPECTED_LEVEL` 1/5/10/15/20/24/28/32; first-clear books ×2–5 |

## 2. Target curve

**Headroom** = the largest multiplier on every enemy's HP that a planner still beats, with the free
roster at `EXPECTED_LEVEL` (`tools/balance/f2p.mjs`). Two planners bracket real players: the **bot**
(`autoPlan`, the CI bot) spreads coins over every girl; the **human-like** planner places two girls
and the hero, pours coins into one carry and fires the hero ult. A stage is scored by the geometric
mean of the two.

| Difficulty | Target headroom | Lives | Feel |
|---|---|---:|---|
| Easy | ≥ ×2.2 on every stage; the bot wins all 40 (CI gate) | 150 | Cozy |
| Normal | ×1.3–1.6 median. 1-1 ×2.0, 1-2 ×1.85, 1-3 ×1.7, 1-4 ×1.6, 1-5 ×1.5; chapters 2–8: x-1 ×1.7 (post-boss breather), x-2 ×1.6, x-3 ×1.55, x-4 ×1.5, x-5 ×1.4 | 100 | A casual player wins but loses some lives |
| Hard | ×1.1–1.3 median | 50 | Clearly harder; finales are where it fails |
| Nightmare | ×1.0–1.1 median, one step past Hard on every stage | 20 | Hard but fair: a few stray leaks are survivable, one miniboss (25) or boss leak is not; the finales are the sakura-medal wall |

Other targets:

* **Ordinary enemies** on Normal live a median ≥ 6 s and walk ≥ 20 % of the path in chapter 1.
* **Bosses** on Normal live ≥ 10–15 s and walk ≥ 20 % of the path (minibosses ≥ 5 s), and each is
  killed by at least one planner.
* **Tier 4**: a focused player gets the first tier 4 by 65–80 % of the waves on the 15+ wave
  stages of chapters 1–2; earlier later on, when several are needed.
* **Tier 5**: a long-stage goal — never in chapters 1–3, at the very end in chapter 4, from about
  wave 20 of 25–30 in chapters 5–8, the last waves of Total Assault, and the endless Challenge.
* **Ramp**: headroom falls gently within each chapter; a breather right after a boss stage is fine.
  Lives lost should ramp too: 1-2 must not play easier than 1-1.

## 3. Rules behind the numbers

* **Prices** (`units.js`, literals written by `tools/balance/reprice.mjs`): placement and tiers 1–3
  ×0.75, tier 4 ×0.5, tier 5 ×0.9 of the old prices, rounded to 5 / 10 / 50 / 250 below 100 / 1,000 /
  5,000 / above. Ties survive (Umeko = Suzu 290, Shiro = Miko 340, Akane = Raika 360); tier 4 ≥ 1.7 ×
  tier 3 and tier 5 ≥ 5 × tier 4 on every path. Tier 5 stays expensive on purpose so a tier-5
  Shiro cannot delete the chapter 6–8 bosses at spawn.
* **Wave-clear bonus** = (100 + 7 × wave + crowd) × cashMul × cashScale, crowd = min(20, enemies) +
  4 × kinds over the wave's scheduled spawns (`waveClearBonus` / `crowdBonus` in `src/sim/waves.js`,
  shared by the sim and the probe). Paid even when enemies leak; deterministic (lockstep-safe). The
  enemy cap was 30 in round 1; on the runner-rush stage 1-2 that made the "little" bonus 13 % of the
  stage's coins, so round 2 capped it at 20 (3–11 % of a campaign stage's coins now).
* **cashScale** (campaign) = max(1.3, curve^0.45) of the smooth index curve 6.5^(i/39) — coins never
  follow the calibrated HP, so retuning a stage's HP never changes its income. Bounty 1.2 / 1.64 /
  2.06, Total Assault 2.06 / 2.24 / 2.40, Challenge 1.
* **Hero XP** per point of damage 0.4 (`HERO_XP_PER_DAMAGE`), so the hero no longer out-levels the
  girls the player pays for.
* **hpScale** is explicit per campaign stage (2.07 … 15.5; 1-1 3.4, 1-2 2.1, 8-5 11.5; chapter means
  3.05 · 3.34 · 3.81 · 4.05 · 7.08 · 8.42 · 10.44 · 12.34), calibrated on the integration maps
  (tracks round 3). **Bounty** HP is per arena and tier (`hpScale` in `BOUNTY_DEFS`; the five pools
  differ by up to ×8 at the same HP): Library 2.0 / 1.7 / 2.75, Market 1.15 / 0.85 / 0.8, Workshop
  6.25 / 5.4 / 5.2, Meadow 3.8 / 4.2 / 7.1, Rune Garden 0.97 / 0.8 / 1.38, so that the Library I Hard
  medal — the key to sweeps — is won at Lv 5. Total Assault 3 / 3 / 6, Challenge 3.75. Boss HP in
  `enemies.js` is "HP at hpScale 1": Slime Prince 250, Orc General 1,550, Goblin Machine 1,660, Oni
  Champion 3,600 (miniboss; was 2,100 — it lived only ~1.4× an ordinary 7-5 enemy), Ashwing 8,000,
  Lych 4,000, Colossus 4,000 (crystal shell cap 60 / 25 hits). The Prince's sprint phase is 0.65
  speed with hasty ×1.5 (was 0.7 / ×1.8).
* **Difficulties** (`DIFFICULTIES`): Easy ×0.6 HP; Hard ×1.0 HP, ×1.05 prices, 50 lives; Nightmare
  ×1.0 HP and speed, ×1.1 prices, **20 lives**, `startCashMul` 1.5, `incomeMul` 0.5. The ladder is
  mostly lives (150 / 100 / 50 / 20) plus prices. Nightmare had 1 life: one split droplet on 2-4's
  wave 1 ended the run at Lv 5, 10 and 15 alike, and even with 25–50 lives ch2 stayed lost at its
  round-1 ×1.1 HP / ×1.05 speed. A one-life challenge would belong in a separate mode.
* **Levels**: `expForLevel(L) = round((30·L^1.7 + 50)/10)·10`; campaign first clears give 4 Study
  Guides (ch1–2), 2 / 3 / 4 Academy Textbooks (ch3–4 / 5–6 / 7–8). `docs/ECONOMY.md` §5 and §9.

## 4. Results (probe, Normal unless noted)

BEFORE = live build `a5ffdbf`; r1 = round 1 (pre-tracks-r3 maps); r2 = round 2 on the integration
maps (`claude/sakura-sentinels@9ca3165`). Campaign sample = all of ch1–2 and x-1 / x-5 of ch3–8
(22 stages), each × 4 difficulties × 2 planners with headroom search; r2 adds 4-3 / 6-2 / 8-3 and
more Bounty arenas.

| Target | BEFORE | r1 | **r2** |
|---|---|---|---|
| Normal median headroom (bot / human-like) | ×2.57 / ×3.02 | ×1.58 / ×1.58 | **×1.58 / ×1.53** (geo-mean ×1.58) |
| Normal wins (bot / human-like) | 21/22 · 22/22 | 21/22 · 22/22 | **21/22 · 22/22** (bot loses only 8-5) |
| Easy wins (bot, all 40 — CI gate) | 40/40 | 40/40 | **40/40** |
| Hard median headroom (bot / human-like) | ×1.18 / ×1.18 | ×1.18 / ×1.07 | **×1.14 / ×1.11** |
| Nightmare wins (bot / human-like) | 0/22 · 0/22 (1 life) | 3/22 · 2/22 (1 life) | **12/22 · 9/22 (20 lives)**; 14/22 won by at least one |
| Nightmare median headroom (bot / human-like) | <×0.5 / <×0.5 | ×0.54 / <×0.5 | **×1.0 / ×0.9** |
| Chapter-1 ramp, geo-mean of both planners | 4.76 · 3.67 · 5.42 · 2.33 · 3.55 | 2.05 · 1.91 · 1.73 · 1.58 · 1.43 | **2.04 ≥ 1.63 ≥ 1.58 ≥ 1.58 ≥ 1.43** |
| Lives kept 1-1 / 1-2 / 1-3 (bot; human-like) | 99 / 100 / 100; 100 / 100 / 100 | 96 / 100 / 100; 98 / 100 / 97 | **100 / 94 / 100; 100 / 93 / 94** |
| 1-2 opening (waves 1–3): lives lost, p90 of path walked (bot) | 0, 23 % | 0, 25 % | **6, 41 %** |
| 1-2 with Hikari alone | — | 100/100 | **92/100** |
| 1-1 slimes: median alive / path walked | 4.9 s / 19 % | 18.6 s / 71 % | **17.0 s / 54 %** (longer track) |
| 1-5 ordinary enemies | 5.3 s / 11 % | 21.9 s / 47 % | **21.7 s / 47 %** |
| Hikari's damage share 1-1 / 1-5 (bot) | 98 % / 82 % | 72 % / 51 % | **50 % / 52 %** |
| Aoi place → tier 4 (any path) | 3,180–3,540 | 1,890–2,060 | **1,890–2,060** |
| Coins per stage 1-1 / 1-5 / 2-5 (all kills) | 2,319 / 5,191 / 8,306 | 3,570 / 7,255 / 9,992 | **3,523 / 7,139 / 9,889** |
| Crowd bonus share of a stage's coins (campaign) | — | 3–12 % (13 % on 1-2 once its rushes were added) | **3–11 %** (9–18 % on top of the wave-clear bonus) |
| First tier 4, human-like, ch1 / ch2 | never / 2-5 at w22 | w12 of 14–18 / w15–17 of 18–22 | **w12 of 14–18 / w15–17 of 18–22** |
| Slime Prince 1-5 (bot / human-like) | 132 s leaked / 133 s leaked | 117 s, 90 % / 97 s, 76 %, killed | **118 s, 89 % / 99 s, 80 %, killed** |
| Orc General 4-5 | 61 s leaked / 47 s killed | 41 s / 45 s, killed | **41 s / 45 s, killed** |
| Goblin Machine 6-5 (human-like) | 18.8 s at 10 % | 42.7 s at 21 % | **36.7 s at 21 %** |
| Oni Champion 7-5 (human-like; ordinary enemies ~20 s) | 16.1 s at 19 % | 27.7 s at 35 % | **42.0 s at 56 %** |
| Ashwing Matriarch 8-5 (human-like) | 39 s at 57 % | 45 s at 67 % (100/100 lives, ×2.18) | **56 s at 78 %** (100/100, ×1.58) |
| Total Assault Lych / Colossus (bot) | never killed | 107 s / 102 s | **112 s / 102 s** |
| Library I Hard medal at Lv 5 (bot / human-like) | won / lost | won / won (lost on the r3 maps) | **won 43/50 / won 11/50** |
| Squad EXP to the tuning level, ch3 / ch4 | 96k (30 days) / 303k (103 days) | 28k (0 days) / 95k (25 days) | **28k (0 days) / 95k (25 days or 31 Library II clears)** |

Nightmare, stage by stage at the expected level: won by at least one planner on 1-1 … 1-4, 2-1, 2-2,
2-3, 2-5, 4-1, 4-3, 5-1, 6-1, 6-2, 7-1, 8-1, 8-3, 8-5; lost on 1-5, 2-4, 3-1 (Veil Wraith leaks,
see §7) and the finales 3-5 … 7-5. Replayed with the next chapter's roster and level (a player
coming back for the sakura medal), 1-5 (human-like 20/20), 2-4 and 3-1 are won; the ch3–7 finales
stay the wall.

Tactical Challenge (hpScale 3.75, round-1 measurement): the bot reaches wave 30 and the human-like
planner wave 40, as before the price cut; the wave-10 Slime Prince (1,064 HP) lives 120 s.

## 5. How to measure

```
node tools/balance/measure.mjs --stages ch1 --diffs normal --planners bot,human    # one chapter, a few minutes
node tools/balance/measure.mjs --stages default --out /tmp/probe                  # the 28-stage sample, ~25 min idle
node tools/balance/measure.mjs --from a.json,b.json --out /tmp/merged             # merge foreground chunks
npx vitest run tests/integration/balance-targets.test.js                          # CI guards (~1 min)
npx vitest run tests/integration/balance.test.js                                  # Easy gate, all 40 stages
```

Run long sweeps as foreground chunks (`--stages 3-1,3-5 --jobs 2`) and merge with `--from`; the
machine is shared. Everything is deterministic: same data + options → same numbers.

`tests/integration/balance-targets.test.js` guards: the chapter-1 ramp (1-1 ≥ 1-2 ≥ 1-3 / 1.04, each
×1.4–2.6, 1-2 ≤ ×2.2) and 1-2's feel (fewer lives kept than on 1-1, ≥ 3 lives lost in waves 1–3,
opening p90 ≥ 35 % of the lane, Hikari alone ≤ 95 lives); Normal 1-4 ×1.3–2.1 and 2-2 ×1.25–2.0;
Hard 1-3 ×1.15–2.0; Easy 1-5 won with ≥ 130 lives; Nightmare (20 lives) won on 1-1 / 2-2 (bot) and
2-5 (human-like), and 1-4 Normal > Hard > Nightmare ≥ ×1.0; the Library I Hard medal won at Lv 5 and
Coins I won on Normal; the Slime Prince and the Orc General killed after ≥ 15 s at ≥ 30 % of the
path; 1-1 slimes ≥ 8 s / ≥ 30 % with Hikari ≤ 85 % of the damage; a focused tier 4 by 45–80 % of the
waves on 1-3 … 2-1; all-in Aoi tier 5 never before the last 10 % of a chapter 1–3 stage; the analytic
economy uses the sim's own wave-clear bonus, and the crowd bonus stays 2–12 % of every campaign
stage's coins and ≤ 20 % on top of its wave-clear bonus.
`BALANCE=full` adds the Normal (×1.4–1.9) and Hard (×1.0–1.4) medians and "every boss killed by a
planner". `tests/sim/economy.test.js` pins the crowd-bonus rule (cap 20, 4 per type) and the
`waveEnd` payload.

## 6. Calibration loop

For each campaign stage: `hpScale ← hpScale × (geo-mean headroom / target)`; apply it only where the
miss is > 8 %, clamp each step to ±45 %, re-probe once. **Re-run it after any map path change**:
path length moves headroom (1-1's track went 26 → 32 tiles in tracks round 3 and its headroom from
×1.92 / ×2.18 to ×2.18 / ×2.83 before 1-1 was raised 2.75 → 3.4).

Tracks round 4 (`feature/tracks-v3@e294c15`, not merged yet) changes four sim paths. Probed with its
`maps.js` on top of this branch (Normal, bot / human-like, 4-step search):

| Stage | Map | Path | Now (integration maps) | With round-4 maps | Suggested hpScale after that merge |
|---|---|---|---|---|---|
| 7-5 | festival_arena | 30 → 51 tiles | ×1.54 / ×1.30 | ×2.38 / ×1.83 | 9.8 → ≈ 14.5 |
| 4-3 | mountain_bastion | 57.7 → 60.8 | ×1.54 / ×1.68 | ×1.83 / ×1.68 | 4.8 → ≈ 5.2 |
| boss-ashwing | arena_summit | 50 → 56.2 | ×1.54 / ×1.41 | ×1.68 / ×1.54 | 6 → ≈ 6.5 |
| 8-2 | peaks_glacier | same length (ice cave) | ×1.54 / ×1.54 | ×1.68 / ×1.54 | none (+4 %) |

## 7. Open items

* **8-5 bot loss** is pre-existing: the Matriarch's airborne phases need anti-air, and autoPlan banks
  coins for a Shiro tier 5 (Cross-Map Execution) it never buys, so she leaks at any HP (the
  human-like planner buys it and wins 100/100 at ×1.58). Optional autoPlan fix: skip an upgrade
  that costs more than the rest of the stage can pay.
* **3-1 Veil Wraiths**: both planners leak every wraith (18–28 lives on Normal, all of them on
  Nightmare): Kage is the only girl who sees them, at tier 0 she deals ~30 of a wraith's 114 HP per
  pass, and neither planner buys her Shadow Mark (team-wide reveal). Halving their pool weight only
  cut the leaks 28 → 23, and their HP does not matter (24 → 12 changed nothing). A player who
  follows the stage hint does better; the bot would need a "reveal first" rule.
* **Planner splits**: 5-5 (bot ×3.22 / human-like ×1.07) and 6-1 (×2.48 / ×1.00, the human-like
  carry leaks dashers) — their geo-means are in band, so they were left alone.
* **Hard, human-like** median ×1.11 sits at the bottom of the ×1.1 band (finales lose to one
  miniboss leak = 25 of 50 lives); the bot's ×1.14 is in band.
* **Total Assault Lych**: the bot kills it (×1.22), the human-like planner leaks it (×0.77).
* The stage-prep enemy chips show non-monotone HP inside a chapter (x-3 can read lower than x-2).
* UI follow-ups (not balance numbers): label in-battle tier prices as **battle coins** on the Tree
  tab (the playtester read Arrow Storm's 2,400 as a Level Up cost); point the Level Up tab at Library
  Bounty sweeps when books run short.
