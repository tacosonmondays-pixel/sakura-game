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
  the battle goes on in place as a freeplay run on that tier.
- **In battle**: exactly the co-op presentation — the FREEPLAY · TIER chip, the clear card (STAGE CLEAR ✓
  / GO BEYOND ▶ 16/15 / Finish here), the overflow pill (BEYOND, OVERTIME after 200), the glitch
  banner "16/15 — BEYOND THE LAST WAVE", milestones, visitor toasts, HP surges, boss ribbons, the
  Matriarch countdown, the pressure chip. **Finish run** is in the pause menu (solo: it ends the run at
  once); Quit pays the freeplay bonus for the waves cleared.
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
