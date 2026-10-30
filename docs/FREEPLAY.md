# Solo Freeplay

Owner, Oct 14: "Right now free play HAS to come, standard play is super boring and short, and the
current 'freeplay' is not quite there". Co-op freeplay (docs/ONLINE.md, CONTRACTS §6) is now in solo
too, with the **same generator, the same three tiers and the same one table** (`src/data/freeplay.js`:
Blossom, Tempest, Crimson Moon). Past the stage's last wave the counter overflows (16/15), visitors
come from every chapter, HP and armor ramp, bosses come on a schedule, and the Ashwing Matriarch waits
at wave 200. Nothing caps the run.

## Playing it

- **Stage prep** (cleared campaign stages): a **Freeplay** panel under Difficulty: **Off · Blossom ·
  Tempest · Crimson Moon** (the co-op tier colours and pitches), what freeplay brings on this stage
  ("12 waves, then freeplay (Blossom): visitors from every chapter, a boss every 5 waves from wave 50 …"), the
  Nightmare warning, and the best wave per tier ("Best: wave 87 (Tempest)"). Start reads
  "Start · Hard · Blossom" and opens `#/battle?stage=…&difficulty=…&freeplay=<tier>`. A stage that is
  not cleared yet says how to unlock it (clear it once, or Keep going from its victory).
- **Keep going**: every normal campaign run that wins its last wave shows a **Keep going?** block on
  the victory sheet (and on the rewards sheet): the tier chips (the last tier picked first) and a
  violet → pink **KEEP GOING ▶ Wave 16/15**. The win is already saved (medal, first clear, drops);
  the battle goes on in place as a freeplay run on that tier. Not in the coached first battle
  (`tutorial=1`, docs/STORY_SPEC.md §2.3): a brand-new player's first win ends on a plain victory
  sheet (`parseBattleParams` gives it no freeplay and no Keep going).
- **In battle**: exactly the co-op presentation — the FREEPLAY · TIER chip, the clear card (STAGE CLEAR ✓
  / GO BEYOND ▶ 16/15 / Finish here), the overflow pill (BEYOND, OVERTIME after 200), the glitch
  banner "16/15 — BEYOND THE LAST WAVE", milestones, visitor toasts, HP surges, boss ribbons, the
  Matriarch countdown, the pressure chip. **Finish run** is in the pause menu (solo: it ends the run at
  once); Quit pays the freeplay bonus for the waves cleared.
- **Battle saves** (docs/BATTLE_SAVE.md): a freeplay run is never saved (its pause menu keeps a plain
  Quit, which returns to the prep with its tier picked); a normal run that may Keep going saves as
  usual until its win, which deletes the save. With a saved normal battle on the stage, prep shows
  **Freeplay · Tier** beside **Continue** (instead of New game) and leaves the save alone; Continue
  always resumes the save as a normal run.
- **Results**: FREEPLAY OVER (fell) / FREEPLAY COMPLETE (Finish), "Cleared wave 147 / 15", "Fell on
  wave 148 to the Grave Lych" / "Finished after wave 147", "New best on 1-3 (Tempest)!", the stage clear
  (saved at 15/15) and the freeplay bonus.

## Balance (calibration)

Co-op multiplies enemy HP by `COOP.hpMul` (1.6) because two defenders share the board. A solo run uses
the stage's own HP (`src/data/freeplaySolo.js`: the campaign stage plus the tier's table): there is
no solo factor, so every curve value stays in the one freeplay table, and the co-op compatibility id
is unchanged.

`tools/freeplayBot.mjs` plays a stage in solo freeplay headless until it falls, spending greedily
(cheapest useful buy: a new girl on the best-covered spot or the next upgrade on her path, up to 60
girls). Builds are "maxed" (★5, legendary +10 gear, average rolls; the build of
`tests/sim/perf.freeplay.test.js`):

- **team**: Kage, Shiro, Aoi, Akane, Miko, Momo, Sango, Yuki and Hikari;
- **kage**: Kage only (+ Hikari), the "one carry, all in" build.

```
node --import ./tools/simLoader.mjs tools/freeplayBot.mjs --stage 4-5 --tier tempest --build team [--coop]
```

Wave the run **falls on** (Normal difficulty; goal = the stage's last wave):

| Stage (goal) | Build | Blossom | Tempest | Crimson Moon |
|---|---|---|---|---|
| 1-5 (18) | strong team | 200 † | 171 | 114 |
| 4-5 (26) | strong team | 150 | 120 | 90 |
| 8-5 (30) | strong team | 160 | 140 | 90 |
| 1-5 (18) | max Kage | 121 | 98 | 79 |
| 4-5 (26) | max Kage | 99 | 90 | 50 |
| 8-5 (30) | max Kage | 30 * | 30 * | 30 * |
| 4-5 (26), co-op HP ×1.6 | strong team (one bot) | 130 | 100 | 80 |

\* Kage alone cannot clear 8-5 (fliers and veiled enemies): the run falls on the stage's own last wave.
† Falls to the Ashwing Matriarch at wave 200 itself.

(Re-run after merging feature/coop-freeplay 34d1c38: Blossom's HP bands back to the spec, titan
children summoning at the wave's pool HP. Only the two Blossom rows on 1-5 moved: 180 → 200 and
114 → 121.)

Every build falls on every tier; the tiers stay in order; a single strong player stops around wave
150–200 on Blossom (the best run reaches the Matriarch and falls to her), 120–170 on Tempest and
90–115 on Crimson Moon — the Matriarch (200) is a real goal, not a given. The same bot under co-op HP falls 20–30 waves earlier, which two players' builds
make up. No enemy ever had a NaN / Infinity HP in any run.

## A steadier curve, more bosses, armored elites (path-cap pass, Oct 15)

Owner, Oct 15: steadier ramp, bosses every 5 waves from about 40–50, stronger and more armored
elites, keep the 70M+ HP at 166+. All in `src/sim/freeplay.js` and `src/data/freeplay.js`; numbers by
`tools/freeplayCurve.mjs` (baselines of the tree before the pass in `tools/baselines/curve-*.json`).

- **Ramp smoothing** (`smooth`): after a regular wave's groups are picked, one factor `k` scales their
  HP so the wave's effective HP (a 30-damage hit at armor pen 10; barriers, affix armor, pressure
  armor, the elite band and modifiers counted; armor takes at most 75 % of a hit) equals the regular
  budget × 11 (swarm) / 15.5 (elite share, as a ramp of the shares table) × `refMul(depth)`, clamped
  to ×0.2–2. Stronger elites or a Fortified rotation shift HP from the swarm to the armored enemies
  instead of making the wave bigger. Bosses and escorts are never scaled.
- **Armor**: the pressure armor grows a little every wave (`depth / every`, no +1 steps; the chip
  shows it to 0.1); elites carry a band on top (Blossom +1 per 14 waves past depth 20 up to +10,
  Tempest per 12 up to +12, Crimson Moon per 10 up to +10) and ×1.25 HP from depth 40, ×1.5 from 120.
- **Elite modifiers** (from depth 40, 60 % of elite groups, an own seeded rng so the wave's picks never
  move): Ironclad +4 armor · Bulwark a 40 % barrier · Quickened ×1.25 speed · Vampiric 1.5 %/s regen
  (poison stops it) · Unyielding half the stun budget. The scout names them ("Ironclad Orc Warlord").
- **Bosses every 5 waves** from ladder level 50 (`fastFrom` 50 on every tier). The tens keep their
  content (the first big boss at level 100–149 ×0.6 instead of ×0.75); the fives are smaller: the next
  miniboss ×0.6 (level 50–99), a miniboss ×0.8 (100–149), the other big boss ×0.45 or a titan ×0.35
  (150–199), a boss ×0.75 (200+). Leaks: miniboss 15, boss 25, titan 40 (were 25 / 35 / 50). A boss
  wave keeps 90 % of its swarm with a miniboss, 75 % with a boss or titan, 50 % with the finale.
- **Telegraph**: the scout shows `BOSS IN 2` / `BOSS NEXT` with the boss, its HP and its counter.
- **Crimson Moon** bands 1040 / 1055 / 1060 / 1060 ‰ (were 1045 / 1060 / 1065 / 1065) and count slope
  0.05 (was 0.06): its own growth was too steep for any smoothing.

Curve check (non-boss waves 31–200, per-wave growth of effective HP over the previous non-boss wave):

| Run | waves over 8 % (before) | worst | mean effective HP vs before |
|---|---|---|---|
| 1-5 Blossom | 0 (60) | +6.5 % (+65 %) | ×1.05 |
| 4-5 Blossom | 0 (64) | +6.9 % (+49 %) | ×1.02 |
| 8-5 Blossom | 0 (64) | +6.9 % (+89 %) | ×1.04 |
| 4-5 Tempest | 0 (66) | +7.7 % (+76 %) | ×1.00 |
| 4-5 Crimson Moon | 6 (68) | +8.2 % (+76 %) | ×0.57 |
| 4-5 Blossom co-op | 0 (64) | +6.9 % (+49 %) | ×1.02 |

The big enemies at the tens from 166 are unchanged on Blossom and Tempest (8-5 Blossom: 34M / 59M / 75M
at 170 / 180 / 190, the Matriarch 372M). `tests/sim/freeplayCurve.test.js` keeps the bands.

## Balance after the path-cap pass (bots, Oct 15)

`tools/capBot.mjs` plays the spec's scripted builds with the one-final-tier rule: MAXED profile, Normal, hero
Hikari 5-0-2, run until it falls; every copy of a girl type has its own plan and a refused tier 5 finishes her
crosspath instead. Seeds only move the bot's timing (the Freeplay waves are seeded by the stage), so seeds 7 and 11
land on the same wave. Live (`fddf01c`) numbers are the research runs.

| Run | Fell on | Target | Live |
|---|---|---|---|
| A, smart mixed team (32 girls, 18 final tiers), 4-5 Blossom, seeds 7 / 11 | **178 / 178** | 180–220 | std team 150 |
| A, 1-5 / 8-5 Blossom | 195 / 170 | within ±20 of 4-5 | 200 / 160 |
| A, 4-5 Tempest / Crimson Moon | 154 / 140 | 140–180 / 110–140, Blossom > Tempest > Crimson | 120 / 90 |
| B, Kage army (28 Kages, the 3 final tiers + 25 at 4-0-2), 4-5 seeds 7 / 11 | **130 / 130** | 130–170, never 200 | 99 (Kage only) |
| B, 8-5 Blossom | 122 | < 200 | 170 (62 final tiers, no cap) |
| A2, Chika (tune-up 0-5-2) for Momo, 4-5 | 190 | ≤ 225 | — |
| C, the research's std team (cheapest step first, cap-aware), 4-5 | 160 | report | 150 |
| A on the co-op stage (HP ×1.6), one bot, one wallet | 172 | 20–30 below solo | 130 (std team) |
| A, two bots on a CoopSim (two wallets, per-player caps) | 178 | −10…+5 of solo | — |

- **Kage army** fell at 125–129 with live tier 4; Blade Rain (Storm of Steel tier 4) now ignores 5 armor (was 3):
  130 on both seeds. It falls to the boss at 120 and the minibosses after it: a pure Kage army has no boss damage
  past Thousand Shadows. (Blade Rain stays below Kunai Craft in autoPlan's path score, so the campaign plans are
  unchanged.)
- **Mixed team, 2 short of 180.** All 32 girls, 18 final tiers and ~290k coins unspent by wave 140; the run ends at
  175–178 on elites, not bosses: siphoning Grave Priests (they drain their crowd, so the swarm's HP walks out in
  one body; Quickened ones at 175–176) and Mirror Queens with their decoys at ~17 armor. It does not move with
  damage: every normal-class tier 5 at +0.1 `damageMul` (the spec's first knob) gave 178 on 4-5, 198 on 1-5 and
  pushed Crimson Moon to 145 (reverted); +25 % damage on the whole profile gave 180; elite HP ×1.35 instead of ×1.5
  from depth 120 and splitting the elite share's 35 → 45 % step at depth 150 into two steps both gave 178. The
  spec's other knobs (boss damage on area tier 5s, the level 100–149 boss factor) act on bosses, which this team
  does not lose to. The counters are poison (it stops the siphon) and Priority targeting, which the scripted bot
  does not play; a re-fit at train C (spec §6.5) should look at the siphon in dense late waves first.
- **Co-op:** one bot on the ×1.6 stage falls only 6 waves earlier than solo (its first leak is 10 earlier); the
  owner's ×1.6 stays. Two bots with two wallets reach the solo wave (P1's Shiro and Kage hold their own final
  tiers: 23 in total).

## Bosses past 150 (Oct 30)

Owner: "balance testing because certain bosses on nightmare past 100-200 are impossible to kill". **Which mode:** Freeplay
played on the campaign's **Nightmare** difficulty (stage prep: "Nightmare · 1 life: the first leak ends freeplay"; HP
×1.75), waves 100–200, on Tempest and Crimson Moon. Freeplay has no tier named Nightmare, the campaign's Nightmare
stages end at their last wave (12–30), and Tryout's Extended Day stops at 100; a Freeplay room or prep pairs a tier with
a difficulty, and on Nightmare the one life makes the first boss that walks off the end of the run.

**How it was measured** (all real coins, Build A2 of `tools/capBot.mjs` with `--profile full`: every girl fully maxed,
L85 ★5, 10 gates, P6, UR gear, UR Resonance). `tools/bossCap.mjs`: the board the bot built by a wave, then each boss
alone (its phases, shell, regen, summons and split; no escorts, no swarm) walking the longest lane, HP bisected to the
most the board kills. `capBot --lives 1000000`: where bosses, elites and the swarm first get through.

**Before.** The full 33-girl board's capacity stops growing at ~175: a lone Gloom Regent 0.40–0.54B, a Grave Lych
0.49–0.66B (both phase), a Hyakki Daimyo 0.84–0.98B, the Iron Colossus and Foundry Titan 0.77–1.25B, the Ashwing
Matriarch 1.15–1.53B, each in 55–100 s on the road (the board deals 5–20M a second to a boss). On Tempest and Crimson
Moon the boss HP from 151 kept the swarm's 6% a wave: on 4-5 / 8-5 Nightmare a Regent was 0.6–1.95B at 180–190, a Lych
0.7–1.3B at 175–195, the Matriarch 3.2–5.8B at 200 (×0.2–0.35 of what the board kills), and every boss past 200 2–24B.
Fully maxed runs fell at 180–190 to the Gloom Regent and the Daimyo, while the swarm first got through at 189–191 (Blossom:
bosses 210–220, the swarm 215–218).

**Both ways were measured.** Girls: the board's capacity scales with its boss damage, so killing the Crimson Moon
Matriarch and the 190 Regent on 8-5 Nightmare with a 1.3× margin needs about ×6 boss damage on every girl; that moves
every campaign and event boss, the Tryout ceiling gate and the round-5 band with it. Enemy HP: only freeplay's boss
waves move. **Chosen: enemy HP** (no girl lowered or raised for this).

**The change** (`src/data/freeplay.js`, `src/sim/freeplay.js` freeplayBossDamp):
- `bossBands`: every boss-wave enemy (minibosses to the Matriarch and the Eclipse Wyrm) grows by its own ‰ a wave
  instead of the tier's: Tempest 2.5% and Crimson Moon 2.2% from 151; every tier 5% from 201 (the swarm 10%). Blossom
  keeps its bosses to 200 (the owner's 70M+ at 166+; they were killable on Nightmare). Blossom < Tempest < Crimson Moon
  at every boss wave.
- `bossHpOf`: the Gloom Regent ×0.5 (it phases half the time and splits into two phasing Lychs: a board kills about half
  the HP it kills of any other boss). Not on a boss plan (Extended Day).

**After** (Nightmare; the boss's HP on its waves in the band ÷ what the board kills; ≥ 1 = killable alone):

| stage, tier | 175–199 before → after | 200 Matriarch | 200–224 before → after |
|---|---|---|---|
| 4-5 Tempest | Lych ×0.69 → 3.1, Regent ×0.73 → 4.0, Daimyo ×0.92 → 3.6 | ×0.35 → 2.1 | ×0.08–0.59 → 1.07–4.5 |
| 4-5 Crimson | Lych ×0.50 → 2.5, Regent ×0.51 → 2.7, Daimyo ×0.62 → 2.7 | ×0.25 → 1.6 | ×0.06–0.11 → 0.84–1.8 |
| 8-5 Tempest | Lych ×0.62 → 2.8, Regent ×0.33 → 2.5, Foundry ×1.05 → 2.9 | ×0.31 → 1.7 | ×0.03–0.45 → 0.80–3.1 |
| 8-5 Crimson | Lych ×0.43 → 2.2, Regent ×0.22 → 1.9, Foundry ×0.66 → 2.0 | ×0.21 → 1.3 | ×0.02–0.08 → 0.59–1.2 |
| 4-5 / 8-5 Blossom | unchanged (×4.2–19) | ×2.1–2.5 (unchanged) | Regent ×0.18–0.64 → 0.94–2.0, Lych ×0.73–0.83 → 1.5–1.7 |

Fully maxed real-coin runs (A2): every Nightmare run now ends to the swarm (elites), not to a boss: 4-5 Tempest 180 →
190, 4-5 Crimson 180 → 189, 8-5 Tempest 190 → 191, 8-5 Crimson 180 → 191, 1-5 Crimson 190 → 207, Blossom 210–220 → 212–225; on Normal the
bosses at 190–225 no longer end the runs either (4-5 Tempest 200 → 205, 8-5 Tempest 200 → 208, 8-5 Crimson 200 → 206).

With lives to spare (`capBot --lives 1000000`, Nightmare), where each kind first gets through: before, bosses first
(180–220) and the swarm 1–11 waves later; after, the swarm first (elites 189–225) and bosses 210–225, 5–25 waves later.

**The endgame gate:** the OVERTIME section below (Oct 30) retunes waves 201+ so the Eclipse Wyrm at 250 is reached on
Blossom.

## OVERTIME and the Eclipse Wyrm (Oct 30)

Owner: "Eclipse Wyrm doesn't show up" (a diagnosis on fix/wyrm-ribbon: it spawns fine; nobody reaches wave 250), and
the wave-250 boss should be "not too easy but not impossible". Before: every tier grew the swarm 10% a wave from 201, so a
fully maxed team fell at 205–235 and the first Wyrm's pool was ~246× the wave-200 Matriarch's on live (~24× with round 5's
boss bands). Enemies get easier; nobody is lowered.

- `hpBands` from 201: Blossom 3.5% a wave (was 10%), Tempest 6%, Crimson Moon 7%. `bossBands` from 201: Blossom 1.8%,
  Tempest 4%, Crimson Moon 4.5% (were 5%). The Wyrm stays at 250 (`calamity` unchanged).
- The Wyrm at 250 (Normal): 4-5 1.20B, 8-5 1.60B, 1-5 0.59B on Blossom (Tempest 3.9–5.1B, Crimson Moon 6.1–7.8B); a full
  board kills 1.41B (4-5, 8-5) to 2.39B (1-5) of a lone Wyrm: ×1.18 / ×0.89 / ×4.05. On Nightmare ×0.53 / ×0.37 / ×2.05.
- `tests/sim/freeplayWyrmReach.test.js` (from fix/wyrm-ribbon): its reproduction is a plain `it()` now: on Blossom the
  Wyrm with the Matriarch it releases is at most 5.5× the wave-200 Matriarch, Tempest and Crimson Moon above that.

Fully maxed Build A2 (`capBot --profile full`), where the run ends (before this → now):

| stage | Blossom Normal | Blossom Nightmare | Tempest Normal / Nightmare | Crimson Moon Normal / Nightmare |
|---|---|---|---|---|
| 1-5 | 235 → **260+** (the Wyrm killed) | 225 → **260+** | 214 → 224 / 210 → 214 | 214 → 215 / 207 → 210 |
| 4-5 | 224 → **250** (falls at the Wyrm's wave, to its escorts) | 212 → 238 | 205 → 210 / 190 → 190 | 204 → 205 / 189 → 189 |
| 8-5 | 225 → **250** (the Wyrm walks through) | 217 → 241 | 208 → 213 / 191 → 197 | 206 → 208 / 191 → 191 |

Today's best non-LR team reaches the Wyrm on Blossom and fights it: an easy stage kills it, the harder stages lose to it
by a little (the room LR gear and better play fill). Tempest and Crimson Moon end 10–60 waves earlier.

## Rewards (never above normal play per minute)

`src/systems/freeplayRewards.js`, the co-op rule (`src/online/coop/rewards.js`) applied to solo:

1. **The clear** is banked the moment the goal wave is cleared: exactly a normal solo win
   (`applyBattleResult`: medal, first-clear gems, unlocks, drops, missions), saved at once. Keep going
   banks the win the victory sheet already applied.
2. **The run**, when it ends (fell, Finish, or Quit after the goal): coins per freeplay wave, a freeplay
   cache every 25 freeplay waves (a drop roll without gear, crowns or tokens), one Assault Token per
   boss-rank kill (at most 10), the one-time milestones (wave 100, 150, the Matriarch, the Wyrm —
   shared with co-op), kills and sightings since the bank only (first kills become discovered).
   **Coins per freeplay wave** are the co-op rate (40 × the tier's `rewardMul`) capped at the stage's
   own normal coins per wave (its drop table's expected coins ÷ its waves × the difficulty's coin
   factor). A freeplay wave lasts 45–60 s against 22–30 s for an average stage wave (bot timings), so:

   | Stage | Normal coins / min | Crimson freeplay coins / min (before the cap) |
   |---|---|---|
   | 1-5 | 109 | 97 |
   | 4-5 | 237 | 120 |
   | 8-5 | 285 | 116 |

   and with the cap freeplay pays at most the same per wave, i.e. well under normal per minute on
   every stage, difficulty and tier (`tests/battle-ui/soloFreeplay.test.js` checks every
   combination). Drop rolls: a cache every 25 freeplay waves (~0.05 a minute) against a full roll per
   normal run (~0.11–0.15 a minute).
   The once-per-account milestones go through the co-op mirror (`missions.counters['fpm:<tier>:<id>']`),
   so solo and co-op share them and an older cached build cannot pay them twice. A solo run is kept in
   the save after every freeplay wave (`progress.freeplayPending`, with `bestKey: 'freeplayBest'` and
   its capped `waveCoins`): a reload, a closed tab or a discarded phone tab is paid at the next app
   start, at solo rates, into the solo best.
3. **Best wave per stage and tier**: `progress.stages[id].freeplayBest = { blossom, tempest, crimson }`
   (absolute waves, "87" of 87/15), shown in stage prep, on the Tactical Challenge map cards and on
   the results. The save keeps the field without a SAVE_VERSION bump (`save.js` cleans it like
   `coopBestWave`).

## The old endless runs

- **Campaign maps**: the Tactical Challenge "endless on campaign maps" runs (`endless=1`) are
  **replaced by Freeplay**. The cards now read "Freeplay on campaign maps" and open the freeplay prep
  (`#/stage/<id>?endless=1`, the tier picker without Off; the routes and the back / Map navigation are
  the same as before). A battle link with `endless=1` on a campaign map plays freeplay on the given
  tier, or Blossom. A best wave from an old endless run stays in the save (`bestWave`) and shows on
  the card ("Endless best · wave 34") until a freeplay best replaces it.
- **The Colosseum** (the Tactical Challenge stage, kind `challenge`, no last wave) is unchanged: it
  is endless by nature and keeps its own best wave and rewards.
- The Sim's `options.endless` is unchanged (the Colosseum and old tests use it).

## Cost of late waves

- **Sim (Node)**: the calibration runs (four at once on a 4-core box) never took more than 10 ms for a
  1/60 s step, deep runs included; `tests/sim/perf.freeplay.test.js` keeps the 900-enemy wave 250
  under its guard.
- **Chromium** (`node e2e/solo-freeplay-perf.mjs`, SwiftShader software GL, 1280×720, 31 upgraded
  girls on 8-5 Blossom, 3×): after 30 game seconds of each wave, in the page:

  | Wave | Enemies alive | Sim per 1/60 s step | Frame median | Frame p95 |
  |---|---|---|---|---|
  | 10 (baseline) | 0 | 0.10 ms | 717 ms | 1383 ms |
  | 150 | 132 | 0.23 ms | 1083 ms | 4367 ms |
  | 200 (Matriarch) | 66 | 0.19 ms | 1733 ms | 2917 ms |
  | 250 (Eclipse Wyrm) | 73 | 0.23 ms | 1633 ms | 3050 ms |

  Software GL draws this board at well under 2 fps even with no enemy on it, so only the ratios mean
  anything: late waves cost 1.5–2.4× the empty board's frame (mostly drawing the extra enemies and
  compiling the visitors' shaders), while the Sim stays a fraction of a millisecond per step. No
  hang, no page error, no NaN / Infinity HP.

## Files

`src/data/freeplaySolo.js` (solo stage), `src/systems/freeplayRewards.js` (bank, end, best, coin cap),
`src/ui/battle/soloFreeplay.js` (last tier, Keep going), `src/ui/battle/setup.js` (`freeplay=` /
`endless=` params), `src/ui/battle/controller.js` (solo wiring), `src/ui/battle/freeplay.js` (shared
banners; solo without a session), `src/ui/screens/stage.js` (the Freeplay panel),
`src/ui/screens/challenge.js` (map cards), `src/ui/freeplayText.js` (tier pitches and the summary,
shared with the co-op room). Tests: `tests/battle-ui/soloFreeplay.test.js`, `e2e/solo-freeplay.mjs`,
`e2e/solo-freeplay-perf.mjs`.
