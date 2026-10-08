# Balance — targets, probe and calibration

Owner: balance. This file holds the balance targets, the rules behind the in-battle numbers, how
they are measured, and the results of the latest round: the playtest round "frisk1636" (2026-10-08,
branch `feature/balance-playtest`). Data lives in `src/data/units.js` (prices), `src/data/stages.js`
(stage HP, coins, waves), `src/data/enemies.js` (boss HP), `DIFFICULTIES` / `BATTLE` in
`src/data/types.js`, `src/sim/waves.js` (crowd bonus) and `src/systems/progression.js` (levels).

## 1. What the playtest said, and what changed

| Playtester said | Root cause (probe, live build) | Change |
|---|---|---|
| "units be a bit spendy" | 650–740 start cash against a 460–520 hero; a whole stage paid 2.3–8.3k coins in ch1–2 | Placement ×0.75; cashScale floor 1.3; wave-clear bonus 80 + 6w → 100 + 7w |
| "lower upgrade prices", "to level 4 you need 2400 gold" | Aoi + tiers 1–4 cost 137–153 % of everything 1-1 paid; nobody reached tier 4 in ch1 | Tiers 1–3 ×0.75, **tier 4 ×0.5**, tier 5 ×0.9 — one rule for every unit |
| "more money per round based on how many enemies / types — just a little" | — | **Crowd bonus**: +1 per enemy in the wave (max 30) + 4 per enemy type, paid with the wave-clear bonus and shown in the toast |
| "normal be very easy" | Normal median headroom ×2.56 (bot) / ×3.02 (human-like), 95–100 lives kept in ch1–2 | Per-stage `hpScale` calibrated to the target curve below |
| "nightmare be hell" | 0 / 44 wins; wave-1 losses at any HP | Nightmare ×1.1 HP (was ×1.75), ×1.1 prices, ×1.5 start cash, income girls ×0.5 (was off) |
| "1.1 balanced, 1.2 too easy" | Headroom 1-1 ×4.76 · 1-2 ×3.44 · 1-3 ×5.42 · 1-4 ×2.65 · 1-5 ×3.22 — no ramp | Per-stage `hpScale`, 1-2 opening budget 6 → 10 |
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
| Nightmare | ×1.0–1.1 for HP and economy with a 50-life buffer; the real mode keeps 1 life | 1 | Hard but fair: the 1-life rule tests leak-free placement |

Other targets:

* **Ordinary enemies** on Normal live a median ≥ 6 s and walk ≥ 20 % of the path in chapter 1.
* **Bosses** on Normal live ≥ 10–15 s and walk ≥ 20 % of the path (minibosses ≥ 5 s), and each is
  killed by at least one planner.
* **Tier 4**: a focused player gets the first tier 4 by 65–80 % of the waves on the 15+ wave
  stages of chapters 1–2; earlier later on, when several are needed.
* **Tier 5**: a long-stage goal — never in chapters 1–3, at the very end in chapter 4, from about
  wave 20 of 25–30 in chapters 5–8, the last waves of Total Assault, and the endless Challenge.
* **Ramp**: headroom falls gently within each chapter; a breather right after a boss stage is fine.

## 3. Rules behind the numbers

* **Prices** (`units.js`, literals written by `tools/balance/reprice.mjs`): placement and tiers 1–3
  ×0.75, tier 4 ×0.5, tier 5 ×0.9 of the old prices, rounded to 5 / 10 / 50 / 250 below 100 / 1,000 /
  5,000 / above. Ties survive (Umeko = Suzu 290, Shiro = Miko 340, Akane = Raika 360); tier 4 ≥ 1.7 ×
  tier 3 and tier 5 ≥ 5 × tier 4 on every path. Tier 5 stays expensive on purpose so a tier-5
  Shiro cannot delete the chapter 6–8 bosses at spawn.
* **Wave-clear bonus** = (100 + 7 × wave + crowd) × cashMul × cashScale, crowd = min(30, enemies) +
  4 × kinds over the wave's scheduled spawns (`waveClearBonus` / `crowdBonus` in `src/sim/waves.js`,
  shared by the sim and the probe). Paid even when enemies leak; deterministic (lockstep-safe).
* **cashScale** (campaign) = max(1.3, curve^0.45) of the smooth index curve 6.5^(i/39) — coins never
  follow the calibrated HP, so retuning a stage's HP never changes its income. Bounty 1.2 / 1.64 /
  2.06, Total Assault 2.06 / 2.24 / 2.40, Challenge 1.
* **Hero XP** per point of damage 0.4 (`HERO_XP_PER_DAMAGE`), so the hero no longer out-levels the
  girls the player pays for.
* **hpScale** is explicit per campaign stage (1-1 2.75 … 8-5 8.45; chapter means 2.81 · 3.11 · 3.81 ·
  3.83 · 7.08 · 8.26 · 10.50 · 12.16). Bounty tiers 3.68 / 2.7 / 4.5, Total Assault 3 / 3 / 6,
  Challenge 3.75. Boss HP in `enemies.js` is "HP at hpScale 1": Slime Prince 250, Orc General 1,550,
  Goblin Machine 1,660, Oni Champion 2,100, Ashwing 8,000, Lych 4,000, Colossus 4,000 (crystal shell
  cap 60 / 25 hits). The Prince's sprint phase is 0.65 speed with hasty ×1.5 (was 0.7 / ×1.8).
* **Difficulties** (`DIFFICULTIES`): Easy ×0.6 HP; Hard ×1.0 HP, ×1.05 prices, 50 lives; Nightmare
  ×1.1 HP, ×1.05 speed, ×1.1 prices, 1 life, `startCashMul` 1.5, `incomeMul` 0.5. Normal itself got
  ≈ 40 % harder, so the old Hard pressure now lives in Normal and Hard's identity is half the lives.
* **Levels**: `expForLevel(L) = round((30·L^1.7 + 50)/10)·10`; campaign first clears give 4 Study
  Guides (ch1–2), 2 / 3 / 4 Academy Textbooks (ch3–4 / 5–6 / 7–8). `docs/ECONOMY.md` §5 and §9.

## 4. Results of the "frisk1636" round (probe, Normal unless noted)

Full tables: `tools/balance/measure.mjs` report (BEFORE = live build `a5ffdbf`, AFTER = this round).

| Target | Before | After |
|---|---|---|
| Normal median headroom, 22 sampled stages (bot / human-like) | ×2.56 / ×3.02 | **×1.58 / ×1.58** |
| Normal wins (bot / human-like, sample) | 21/22 · 22/22 | 21/22 · 22/22 (bot loses only 8-5, as before) |
| Easy wins (bot, all 40 — CI gate) | 40/40 | **40/40** |
| Hard median headroom (bot / human-like) | ×1.18 / ×1.18 | ×1.18 / ×1.07 |
| Nightmare wins at 1 life (bot / human-like, sample) | 0/22 · 0/22 | 3/22 · 2/22 |
| Chapter-1 ramp, bot | 4.76 · 3.44 · 5.42 · 2.65 · 3.22 | **1.92 ≥ 1.79 ≥ 1.79 ≥ 1.68 ≥ 1.58** |
| Chapter-1 ramp, human-like | 4.76 · 3.91 · 5.42 · 2.04 · 3.91 | **2.18 ≥ 2.04 ≥ 1.68 ≥ 1.48 ≥ 1.30** |
| 1-1 slimes: median alive / path walked | 4.9 s / 19 % | **18.6 s / 71 %** |
| 1-5 ordinary enemies | 5.3 s / 11 % | **21.9 s / 47 %** |
| Hikari's damage share 1-1 / 1-5 (bot) | 98 % / 82 % | 72 % / 51 % |
| Aoi place → tier 4 (any path) | 3,180–3,540 | **1,890–2,060** |
| Coins per stage 1-1 / 1-5 / 2-5 (all kills) | 2,319 / 5,191 / 8,306 | 3,570 / 7,255 / 9,992 |
| Crowd bonus share of a stage's coins | — | 3–12 % (9–22 % on top of the wave-clear bonus) |
| First tier 4, human-like, ch1 / ch2 | never / 2-5 at w22 | wave 12 of 14–18 / waves 15–17 of 18–22 |
| First tier 5, human-like | 5-5+ | 5-5+ (waves 22–28 of 26–30); never in ch1–4 |
| Slime Prince 1-5 (bot / human-like) | 132 s, leaked / 133 s, leaked | **117 s, 90 %, killed / 97 s, 76 %, killed** |
| Orc General 4-5 | 61 s, leaked / 47 s, killed | 41 s, killed / 45 s, killed |
| Goblin Machine 6-5 (human-like) | 18.8 s at 10 % of the path | 42.7 s at 21 % |
| Oni Champion 7-5 (human-like) | 16.1 s at 19 % | 27.7 s at 35 % |
| Total Assault Lych / Colossus | never killed | killed (bot) after 107 s / 102 s |
| Squad EXP to the tuning level, ch3 / ch4 | 96k (30 days) / 303k (103 days) | 28k (0 days) / 95k (25 days or 31 Library II clears) |

Tactical Challenge (hpScale 3.75): the bot reaches wave 30 and the human-like planner wave 40, as
before the price cut; the wave-10 Slime Prince (1,064 HP) lives 120 s.

## 5. How to measure

```
node tools/balance/measure.mjs --stages ch1 --diffs normal --planners bot,human    # one chapter, a few minutes
node tools/balance/measure.mjs --stages default --out /tmp/probe                  # the 28-stage sample, ~25 min idle
node tools/balance/measure.mjs --from a.json,b.json --out /tmp/merged             # merge foreground chunks
npx vitest run tests/integration/balance-targets.test.js                          # CI guards (~1 min)
npx vitest run tests/integration/balance.test.js                                  # Easy gate, all 40 stages
```

Run long sweeps as foreground chunks (`--stages 3-1,3-5,4-1,4-5 --jobs 3`) and merge with `--from`;
the machine is shared. Everything is deterministic: same data + options → same numbers.

`tests/integration/balance-targets.test.js` guards: the chapter-1 ramp (1-1 ≥ 1-2 ≥ 1-3 / 1.04, each
×1.4–2.6, 1-2 ≤ ×2.2); Normal 1-4 ×1.3–2.1 and 2-2 ×1.25–2.0; Hard 1-3 ×1.15–2.0; Easy 1-5 won with
≥ 130 lives; the Slime Prince and the Orc General killed after ≥ 15 s at ≥ 30 % of the path; 1-1
slimes ≥ 8 s / ≥ 30 % with Hikari ≤ 85 % of the damage; a focused tier 4 by 45–80 % of the waves on
1-3 … 2-1; all-in Aoi tier 5 never before the last 10 % of a chapter 1–3 stage; the analytic economy
uses the sim's own wave-clear bonus. `BALANCE=full` adds the Normal (×1.4–1.9) and Hard (×1.0–1.4)
medians and "every boss killed by a planner".

## 6. Calibration loop

For each campaign stage: `hpScale ← hpScale × (geo-mean headroom / target)`; apply it only where the
miss is > 8 %, clamp each step to ±45 %, re-probe once. One pass brought 27 of 29 recalibrated stages
within ±10 %. **Re-run it after any map path change** (tracks round 3 is reshaping paths; path length
moves headroom — 1-1's short track especially).

## 7. Open items

* **2-1 (×1.91 vs ×1.7) and 2-4 (×1.73 vs ×1.5)** are still 12–15 % easy: next pass hpScale 2.10 → 2.35
  and 3.16 → 3.6.
* **5-5** (elite finale, no scripted boss) splits the planners ×3.22 (bot) / ×1.14 (human-like).
* **8-5 bot loss** is pre-existing: autoPlan banks coins for a Shiro tier 5 it never buys and the
  Matriarch's leak takes every life (the human-like planner wins 100/100). Optional autoPlan fix:
  skip an upgrade that costs more than the rest of the stage can pay.
* **Nightmare** is still lost at 1 life on most stages by both planners: a single structural leak
  (veil past the detector, dasher burst) ends the run at any HP. Its HP and economy are tuned against
  a 50-life buffer; the remaining gap is zero-leak skill.
* **Hard, human-like** median ×1.07 sits just under the ×1.1 band (finales lose to one miniboss leak
  = 25 of 50 lives); the bot's ×1.18 is in band.
* The stage-prep enemy chips show non-monotone HP inside a chapter (x-3 can read lower than x-2).
* UI follow-ups (not balance numbers): label in-battle tier prices as **battle coins** on the Tree
  tab (the playtester read Arrow Storm's 2,400 as a Level Up cost); point the Level Up tab at Library
  Bounty sweeps when books run short.
