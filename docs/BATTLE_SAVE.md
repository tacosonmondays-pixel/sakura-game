# Battle save: Save & quit, then Continue or New game

Owner request (2026-10-14): "when you quit a match can you make it saves and you have two buttons
continue or new game? something like that!"

A solo battle that is left for any reason (Save & quit, the back arrow or gesture, Home, a closed tab,
a phone killing the app) can be continued later from its stage prep. Continue lands **between waves**
at the start of the wave that was in progress (or exactly where the player was, if no wave was
running), with Start waiting.

## Player-facing rules

| Where | What |
|---|---|
| Pause menu | **Resume · Restart · Save & quit**; endless runs also get **End run** (cash out: exactly what a defeat right now pays). Practice, tutorial, clan boss and co-op keep Quit / Leave co-op. |
| Save & quit confirm | Nothing done yet: "nothing to save". Between waves: "Continue from wave N of M". During a wave: "saved at the start of wave N; anything you build, upgrade or sell during this wave will be undone". |
| Stage prep with a save | "Saved battle · Hard · wave 12 of 25 · ♥ 63 · 12 min ago", the frozen team, **Continue · Wave 12/25** (yellow) and **New game · Hard** (asks, "Keep it" cancels). Start is not shown. The difficulty picker starts on the save's difficulty and only changes New game. |
| Map screens | "Saved · W12" on campaign nodes, Bounty tiers, Total Assault cards, the Colosseum and endless rows. |
| Lobby | "▶ Continue Mission 3-5 · Wave 12" for the most recent save; opens prep, never the battle. |
| Continue | Loading card "Resuming wave N…", toast "Welcome back! Wave N is next. Tap Start when you're ready." A girl who can't return after an update is refunded (toast). A save this build can't restore is removed (sheet). |
| Links | A battle URL carries `&resume=<run id>` once the run has a save, so a reload continues it. A finished / replaced run's link shows "already finished or was replaced". A battle link without `resume` for a slot with a save goes to prep (toast) and never overwrites it. |

Saves: campaign, Bounty, solo Total Assault, the Colosseum and endless runs (`isSavableRun`). Never:
practice (a locked stage), the tutorial, the clan boss, co-op. One save per slot (a stage; an endless
run on a campaign map has its own slot `<id>:endless`; the Colosseum is `challenge`), at most 5
(`MAX_BATTLE_SAVES`; a 6th asks before replacing the oldest).

## Economy and integrity

- **Paid exactly once.** Rewards, medals, first clears, unlocks, missions, bestiary and stats are only
  applied by `results.apply()` on a real end. Order: `applyBattleResult` → `saver.finish()` (deletes
  this run's save, even when the apply throws) → `store.commit` → `store.saveNow()`: one synchronous
  write holds the payout and no save. A save is never written again after that (`saver.close()` in
  `endBattle`, the run-id check in every write).
- **No rerolls.** Each wave of a saved run plays on its own random stream `hash(run seed, wave)`
  (`useWaveStream`), so continuing at a wave start replays the same luck; drops come from
  `battleDropSeed(stage, difficulty, run seed)`, so finishing the same run twice (an older copy of the
  profile, another tab) rolls the same drops. Wave composition was never random per battle.
- **Frozen at New game:** the team's battle stats (`unitBattleStats` at mount), difficulty and seed.
  Formation, level and gear changes since do not apply to Continue ("Continues with the team you
  started with.").
- **Event bonus** is judged by when the run started (`applyBattleResult(…, { eventAt })`), so nearly
  finished saves cannot be stockpiled for a 2× week.
- **Retrying a wave from its start is allowed** (same enemies, same luck); a mid-wave kill can only
  lose that wave's progress, never gain anything (nothing is written during a wave).
- **Energy** (when spec #134 lands): charged only on a win inside the same `apply()` write; Continue
  re-plans it and a blocked plan disables Continue but keeps the save. Not built yet: there is no
  energy system in the game.

## How it works

| File | Role |
|---|---|
| `src/systems/battleSave.js` | Pure: record helpers, `slotKey`, `isSavableRun`, the cap, `saveSummary`, `cleanBattleSaves` (migrate sanitiser). |
| `src/ui/battle/snapshot.js` | `snapshotSim` / `restoreSim` through the public Sim API, `useWaveStream`, and the `KNOWN_SIM_KEYS` / `KNOWN_TOWER_KEYS` classification tables. |
| `src/ui/battle/battleSaver.js` | When to write: first progress, every wave start (instance wrapper on `sim.startNextWave`, which also sees auto-starts inside `Sim._step`), commands between waves (quiet, 150 ms), hidden / pagehide / freeze / leave; `discard`, `close`, `finish`. |
| `src/ui/battle/controller.js` | New game / Continue / gone / broken / redirect at mount, the saver, `ctx.restart` (fresh), `ctx.endRun`, the welcome and refund toasts. |
| `src/ui/battle/results.js` | `apply()` ordering, run-seeded drops, `eventAt`, the RUN OVER ribbon. |
| `src/ui/screens/stage.js` | The prep actions block, `savedBadge`, `savedStageLabel`. |
| `src/systems/save.js`, `src/core/store.js` | `profile.battleSaves` (additive, no `SAVE_VERSION` bump; dropped records give a one-time notice, never a backup prompt); `commit(reason, { quiet })`, boolean `saveNow()`, a `pagehide` flush. |

The calm point (prep, or between waves) is clean by construction: a wave only ends when the field is
empty, so there are no enemies, statuses, shots or aura fields to carry; ult cooldowns only tick
during waves. The snapshot (0.7–6 KB) carries the girls (uid, unit, spot, tiers, target mode, spent,
kills, damage, cooldown, disable, facing, build timer; hero XP / ult), drones, armed traps, coins
(+ fractional carry), lives, wave counters, time, active ult rate buffs, kills, encountered enemies
and battle stats. Restoring places and upgrades each girl through the normal Sim calls with the same
uids, then assigns the plain fields and drains the events.

None of these files are in the co-op compatibility graph (`tools/simId.mjs`), so battle saves never
change which builds can play co-op together (`tests/core/updates.test.js` checks it).

## Adding Sim state

`tests/battle-ui/snapshot.test.js` fails when a new own field appears on the Sim or on a placed girl
that `KNOWN_SIM_KEYS` / `KNOWN_TOWER_KEYS` do not classify. Classify it:

- `calm`: empty or reset between waves (nothing to do);
- `derived` / `config` / `scratch`: rebuilt by the constructor, placement or the next step;
- `snap`: player-made state that lives across waves — add it to `snapshotSim` **and** `restoreSim`
  (prefer a public Sim call; assign plain fields), bump `SNAP_V` only if old snapshots can no longer be
  read, and extend the round-trip / same-future tests if it needs a new scenario.

New player commands must go through `ctx.act` (or call `saver.markProgress()`), so they count as
progress.

## Tests

- `tests/battle-ui/snapshot.test.js`: round trip at every wave start (3-5, 8-5 Hard with drones, 4-5
  with traps, the Colosseum to wave 30), identical re-snapshots under 8 KB, "same future" splits with
  and without the same commands (digest + `hashSim`), refunds and stale saves, the hero, and the guards.
- `tests/systems/battleSave.test.js`: profile field, migrate allowlist, each sanitiser rule, the cap,
  slots and modes, run-scoped clears, drop seed, event bonus by start time.
- `tests/battle-ui/battle.test.js`: the saver's write rules and `results.apply()` (one write with the
  payout and no save; a second apply changes nothing; a throwing apply still deletes the save).
- `e2e/battle-save.mjs`: the whole flow in a browser at 844×390 and 1280×720, including an app kill
  emulated by copying the storage into a fresh browser context.
