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
  ("12 waves, then freeplay (Blossom): visitors from every chapter, bosses every 10 waves …"), the
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
