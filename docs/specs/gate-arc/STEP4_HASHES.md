# Gate Arc Step 4 · sim id / co-op data hash log

| When | Commit | Sim id | Data hash | COOP | Note |
|---|---|---|---|---|---|
| Plan (Oct 28) | 14c3b39 (feature/gate-arc) | dd3e7ae71fb7 | 63d2b906 | 9 | Step 3's last row: the starting point |
| S4b (Oct 28) | the S4b/S4c worktree commits (based on 14c3b39) | e59795860ebe | d8319cb8 | 9 | Five maps: Toll Plaza (a three-booth lens, booth roofs 'U'), Azami's Checkpoint (a straight gate lane and a hook west), Tunnel Mouth (two bores, two exits), The Frozen Villages (`snow`: a climb and a horseshoe), The Snow Bridge (`snow`: two columns, one 8-tile deck). `MapDef.district: 'highway'` on the three city maps (S4a draws it). Decor uses shipped prop types only. PENDING_BUMP followed |
| S4c (Oct 28) | the S4b/S4c worktree commits | fbbdf003b126 → 6fb950042e09 | 32b8ec1f → c9f7473c | 9 | Non-vacuous `familiesFound` (own commit, before the family); the `brigade` family (the Gnat moves in; `brigade_trooper`, `brigade_shieldline`, `brigade_tortoise`, `brigade_badger` on construct GLBs via `model.base`); `orc_frost_vanguard` (3,950 HP); stages 4-6…4-10, rules + skins; Azami joins after 4-7 (2-2 counts only for a clear from before this build). Tunnel Mouth re-cut to 22×13 (nested steps; the first cut gave each lane ≈ 11 visible tiles and the bot lost it at hp × 0.7). Engines wave digest 4095:81f77bb0 (+ 132 waves + 150 endless); Act I tables unchanged (campaignGolden). PENDING_BUMP { 9: '6fb950042e09' } |

### S4c balance (autoPlan bot, F2P roster before the stage, expected level L25 = chapter 5's, map rules on, seed 1)

| Stage | Easy (lives / 150) | Normal (lives / 100) | Hard (lives / 50) | Neighbours for comparison |
|---|---|---|---|---|
| 4-6 Toll Plaza | won 135 | won 52 | lost at wave 17/25 | 3-6 149 / 95 / won 40 · 5-1 150 / 100 / won 42 |
| 4-7 Azami's Checkpoint | won 131 | won 65 | lost at wave 16/26 | 3-7 149 / 91 / won 16 · 5-2 136 / 76 / lost w19 |
| 4-8 Tunnel Mouth | won 128 | won 51 | lost at wave 16/26 | 3-8 120 / 72 / lost w14 · 5-3 117 / 58 / lost w17 |
| 4-9 The Frozen Villages | won 143 | won 90 | won 13 | 3-9 128 / 43 / lost w12 · 5-4 142 / 91 / won 33 |
| 4-10 The Frost Vanguard | won 133 | won 51 | lost at wave 15/28 | 3-10 120 / 57 / lost w26 · 5-5 150 / 78 / won 27 |

Easy gate (tests/integration/balance.test.js): 60/60. Neither 4-8's even-wave Brigade groups nor 4-9's Brigade pool put
the stage above 4-10 (4-8 ties it on Normal, loses one wave later on Hard; 4-9 is the act's easiest). Tuning: 4-6
budget 315 → 210 (fewer berserkers, a smaller wolf pack); 4-8 budget 172 → 36 from 4.5 (the rear ambush on two
independent lanes splits the bot's coverage four ways) with lighter Brigade groups (troopers 2 + ⌊w/10⌋ on every even
wave, a Shieldline every 4th, Gnats on 8/16/24, a Tortoise on 14 and 22); 4-10 budget 115 → 290 (the finale was the
act's easiest on Normal).

Azami's move, Act I Normal/Hard with and without her in the bot's roster (stages after 2-2): Normal holds everywhere
(within ± 9 lives; 8-5 Normal was already lost before); two Hard rows that were narrow wins flip: 2-3 (won 5/50 →
lost at wave 15) and 4-5 (won 3/50 → lost at wave 26); 4-4 Hard loses at wave 17 instead of 22.

Checks at this row: `tools/simId.mjs` → 6fb950042e09, `coopVersion().data` → c9f7473c, COOP_PROTOCOL 9.
