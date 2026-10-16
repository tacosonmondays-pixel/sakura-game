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
| Pause menu | **Resume · Restart · Save & quit**; endless runs also get **End run** (cash out: exactly what a defeat right now pays). Colours follow the risk: Save & quit keeps the battle (plain button), Restart throws it away (red). Practice, tutorial, clan boss and co-op keep a red Quit / Leave co-op. (This departs from spec §2.1, which kept Save & quit red: owner may want to confirm.) |
| Save & quit confirm | Nothing done yet: "nothing to save". Between waves: "Continue from wave N of M". During a wave: "saved at the start of wave N; anything you build, upgrade or sell during this wave will be undone". |
| Stage prep with a save | "Saved battle · Hard · wave 12 of 25 · ♥ 63 · 12 min ago", the frozen team, then **New game · Hard** and **Continue · Wave 12/25** (yellow) on one row (New game asks, naming both difficulties; "Keep it" cancels). Start is not shown. The picker is titled "New game difficulty", starts on the save's difficulty, marks it "Saved" and only changes New game. On a landscape phone the bar is one line plus one row (~92 px); in one column (portrait) the block leads the page, Continue above New game. |
| Map screens | "Saved · W12" on campaign nodes (top-right, under NEXT), Bounty tiers, Total Assault cards (under the boss's HP) and the Colosseum. (Tactical Challenge's map cards are Freeplay now, which never saves: no badge there.) |
| Lobby | "▶ Grave Lych / Continue · Total Assault · Wave 4" (the battle's name first) for the most recent save; opens prep, never the battle. Shown in portrait too. |
| Continue | Loading card "Resuming wave N…", toast "Welcome back! Wave N is next. Tap Start when you're ready." A girl who can't return after an update is refunded (toast). Both toasts are sticky and the scouting warnings wait ~4.6 s for them. A save this build can't restore is removed (sheet). |
| Links | A battle URL carries `&resume=<run id>` once the run has a save, so a reload continues it. A finished / replaced run's link shows "already finished or was replaced", plus **Continue saved battle · Wave N** when a newer run holds the slot. A battle link without `resume` for a slot with a save goes to prep (toast) and never overwrites it. |
| Leaving mid-wave | The Save & quit sheet says the wave restarts. The back arrow / gesture says it on the way out (toast: "Battle saved at the start of wave N…"). |
| Saved battles full | Start on a stage without a save, with 5 kept, opens **Saved battles full**: the 5 saves, least play first (a finite stage by the share of waves cleared, endless runs last), the first one picked; **Delete & start** (red) or Cancel. The pick travels as `&evict=<run id>` and is only deleted when the new battle first saves (backing out keeps it). A battle reached without that choice (a deep link) is not saved and says so; its pause menu offers a plain Quit. |

Saves: campaign, Bounty, solo Total Assault, the Colosseum and endless runs (`isSavableRun`). Never:
practice (a locked stage), the tutorial, the clan boss, co-op, solo freeplay, Sandbox. One save per slot (a
stage; the Colosseum is `challenge`), at most 5 (`MAX_BATTLE_SAVES`, spec §14 default; a 6th asks
which one to replace). The old endless runs on campaign maps (their own slot `<id>:endless`) are
Freeplay now; a save of one from an earlier build is dropped with the update notice.

**Solo freeplay is never saved** (docs/FREEPLAY.md). Its clear is banked as a normal win the moment
the goal wave is cleared, and its freeplay part is paid when the run ends, when it is left after the
goal, or at the next app start (`progress.freeplayPending`); that ledger lives in memory, so a
continued copy would bank the clear again and pay the same freeplay waves twice. So a
`freeplay=<tier>` run (and `endless=1` on a campaign map, which is one) has no saver: its pause menu
offers a plain Quit, which returns to its prep with the tier picked. A normal run that may Keep going
is saved as usual until it wins; the win deletes its save, and the freeplay run it continues into is
not saved. Stage prep with a save and a Freeplay tier picked shows **Freeplay · Tier** beside
Continue (a freeplay start that leaves the save alone) instead of New game. Continue always plays the
save as it was saved: `parseBattleParams` never turns freeplay on next to `resume`.

## Economy and integrity

- **Paid exactly once.** Rewards, medals, first clears, unlocks, missions, bestiary and stats are only
  applied by `results.apply()` on a real end. Order: `applyBattleResult` → `saver.finish()` (deletes
  this run's save, even when the apply throws) → `store.commit` → `store.saveNow()`: one synchronous
  write holds the payout and no save. A save is never written again after that (`saver.close()` in
  `endBattle`, the run-id check in every write). A Sim that is over but whose won / lost event never
  reached the controller (a render error) is ended at the next frame or on leave, never saved.
- **Other tabs.** `store.saveNow()` compares the stored save with what this tab last read or wrote:
  when another tab finished, restarted or replaced a saved battle this tab still holds, this tab stops
  writing (it would bring that run back and erase the other tab's payout) and asks for a reload
  (the 'stale' event's reason is `'battle-save'`: a modal in main.js). Since v0.1.29 every save also
  carries a revision (`saveRev`, src/core/store.js): any save by another tab stops an older tab's
  writes too, with the "Open in another tab" pill instead of the modal (reason `'another-tab'`). The
  run check still covers a write without a revision (a tab on an older build). During an update such
  a tab writes its whole older profile when it is hidden or closed: a tab on this build that saved with
  revisions puts its own save back at once (storage event), and a tab that loaded that older save and
  saved revision 1, 2, … below another tab's revision turns that other tab stale instead of being
  overwritten by it.
- **No rerolls.** Each wave of a saved run plays on its own random stream `hash(run seed, wave)`
  (`useWaveStream`), so continuing at a wave start replays the same luck; drops come from
  `battleDropSeed(stage, difficulty, run seed)`, so finishing the same run twice (an older copy of the
  profile, another tab) rolls the same drops. Wave composition was never random per battle.
- **Frozen at New game:** the team's battle stats (`unitBattleStats` at mount), difficulty and seed.
  Formation, level and gear changes since do not apply to Continue ("Continues with the team you
  started with."). That includes gear: moving or salvaging it later does not change a saved run
  (as in the reference game, which locks the loadout when the save is made; up to 5 runs can carry
  the same gear's stats). Accepted for v1; locking gear used by a save is a possible later rule.
- **Event bonus** is judged by when the run started (`applyBattleResult(…, { eventAt })`, `battleEventMul`),
  so nearly finished saves cannot be stockpiled for a 2× week, and a run started during an event only
  gets it while it finishes within 48 h of that week's end (`EVENT_GRACE_MS`). A record without a start
  time counts from its last play.
- **Retrying a wave from its start is allowed** (same enemies, same luck); a mid-wave kill can only
  lose that wave's progress, never gain anything (nothing is written during a wave). Every wave end is
  written once (`persistCalm`), so a crash on the between-wave shop keeps the wave just won.
- **Energy** (when spec #134 lands): charged only on a win inside the same `apply()` write; Continue
  re-plans it and a blocked plan disables Continue but keeps the save. Not built yet: there is no
  energy system in the game.

## How it works

| File | Role |
|---|---|
| `src/systems/battleSave.js` | Pure: record helpers, `slotKey`, `isSavableRun`, the cap (`savesByWorth`, `saveToEvict`), `saveSummary`, `saveTitle`, `cleanBattleSaves` (migrate sanitiser; drops a save past the end of a shortened stage), `droppedBattleSaveNames` (the notice). |
| `src/ui/battle/snapshot.js` | `snapshotSim` / `restoreSim` through the public Sim API, `useWaveStream`, and the `KNOWN_SIM_KEYS` / `KNOWN_TOWER_KEYS` classification tables. |
| `src/ui/battle/battleSaver.js` | When to write: first progress (only with room, or the save the player chose to replace: `evict`), every wave start (instance wrapper on `sim.startNextWave`, which also sees auto-starts inside `Sim._step`), every wave end once (`persistCalm`), commands between waves (one 150 ms debounce), hidden / pagehide / freeze / leave; `discard`, `close`, `finish`; write failures report why (storage full, saving paused; another tab closes it). |
| `src/ui/battle/controller.js` | New game / Continue / gone (with Continue to the newer run) / broken / redirect at mount, the saver, `ctx.restart` (fresh), `ctx.endRun`, settling a finished Sim, the welcome and refund toasts, the save warnings and the mid-wave leave toast. |
| `src/ui/battle/results.js` | `apply()` ordering, run-seeded drops, `eventAt`, the RUN OVER ribbon, a note when the payout could not be written. |
| `src/ui/screens/stage.js` | The prep actions block, `pickSaveToReplace` (Saved battles full), `savedBadge`, `savedStageLabel`, `savedDetail`. |
| `src/systems/save.js`, `src/core/store.js` | `profile.battleSaves` (additive, no `SAVE_VERSION` bump; dropped records give a one-time notice naming them, never a backup prompt); `commit(reason, { quiet })`, boolean `saveNow()` with `lastSaveError` ('quota' / 'held' / 'stale'), the other-tab check and its 'stale' event (main.js: Reload sheet), a `pagehide` flush. |

The calm point (prep, or between waves) is clean by construction: a wave only ends when the field is
empty, so there are no enemies, statuses, shots or aura fields to carry; ult cooldowns only tick
during waves. The snapshot (0.7–6 KB; 5 KB at wave 122 of a Colosseum run with ~1000 leaks) carries the girls (uid, unit, spot, tiers, target mode, spent,
kills, damage, cooldown, disable, facing, build timer; hero XP / ult, levels bought and their coins, Move timers), drones, armed traps, coins
(+ fractional carry), lives, wave counters, time, active ult rate buffs, kills, encountered enemies
and battle stats; the leak log is kept as (wave, enemy, lives, count) groups (`packLeaks`, the newest
160), which keeps everything the defeat debrief reads. Restoring places and upgrades each girl through the normal Sim calls with the same
uids, then assigns the plain fields and drains the events.

**Snapshot format 2 (`SNAP_V` 2, the hero rework).** A hero has no tiers and is never sold: she is
placed (free), then given her saved XP (her level and Mastery follow), ult state, `levelSpent`
(`ls`), `levelsBought` (`lb`) and Move timers (`mc`, `ml`). A hero who cannot return is dropped
like any girl, and the coins of her bought levels are refunded. A **format-1** snapshot (written
before the rework) holds an old-scale hero (10 levels, path tiers bought with coins): she is
restored on her spot at her old level on the new track (`xpToReach(level)`, bar empty), her tiers
are ignored, and everything she cost (`spent`) is refunded; the battle shows "Heroes changed: Hikari
keeps Lv 7 and her upgrades came back as 1,240 coins." The next write is format 2. Later Train C
fields (Chika's roaming drones, Codex modes, path-cap buffs) are added to format 2 before it ships:
it is bumped once for the whole train.

**Chika's roaming drones (format 2, additive; Chika rework M6).** A drone row is
`[uid, x, y, facing, cooldown, n, slot, dmg, kills, shots, born, jam]` (its number, home slot,
counters, the wave it was built in and a jam still running); the girl adds `ds: [droneDmg,
droneKills, droneShots, droneSerial]` and, when her wing is not plain Hover, `fl: [mode, ax, ay,
bx, by, cx, cy, leg]` (the flight mode, its Hold / Patrol points and the patrol position). Restore
goes through `restoreDrone()` (`src/sim/towers.js`), sets the flight mode before the first step and
raises `droneSerial` to at least the highest drone number, so no number is handed out twice. An
older 5-field row restores with zero counters, numbered by position, and the wing as Hover (its past
drone damage then counts as hers until the battle ends). `KNOWN_DRONE_KEYS` classifies every drone
field (`hx`, `hy` derived from the slot; `tgt`, `targetUid`, `moving`, `px`, `py` reset at a calm
point); a girl's drone target pool is scratch (a pool of dead enemies is never reused).

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

Co-op freeplay (`src/sim/freeplay.js`) added `freeplay` and `lastWave` (config: the constructor's
flag and last playable wave), `_fp` (calm: the current freeplay wave's pressure, set at every wave
start before its first spawn) and `finished` (calm: only `finish()` sets it, and that ends the
battle). Solo freeplay uses the same fields (`freeplay=<tier>`, Keep going), but freeplay runs are
never saved (above), so none of it is saved:
`snapshotSim` throws on a freeplay Sim and `restoreSim` never passes `options.freeplay` (an edited
record asking for it still restores a plain solo run). Enemy-level freeplay fields (flat armor,
Resolve budgets, per-spawn HP and affixes) never reach a save: there are no enemies at a calm point.
The co-op wave-end checkpoints are a different, generic serializer (`src/sim/snapshot.js`).

## Tests

- `tests/battle-ui/snapshot.test.js`: round trip at every wave start (3-5, 8-5 Hard with drones, 4-5
  with traps, the Colosseum to wave 30), identical re-snapshots under 8 KB, "same future" splits with
  and without the same commands (digest + `hashSim`), refunds and stale saves, the hero, Chika's
  drones and flight modes (the driver flies her wing through Hover / Hold / Patrol / Pursuit), and
  the guards (Sim, girl and drone fields).
- `tests/systems/battleSave.test.js`: profile field, migrate allowlist, each sanitiser rule (including
  a save past the end and a missing start time), the cap and its order, titles, slots and modes,
  run-scoped clears, drop seed, event bonus by start time and its 48 h window.
- `tests/battle-ui/battle.test.js`: the saver's write rules (wave end written once, one write per
  command batch, saves full without and with the player's choice, failure reasons) and
  `results.apply()` (one write with the payout and no save; a second apply changes nothing; a throwing
  apply still deletes the save).
- `tests/core/store.test.js`: two copies of the game over one storage: a tab still playing a run
  another tab paid out never brings it back nor erases the payout (also when an older build's tab
  wrote it, without a revision); a tab that only shares a save stops saving without the modal.
- `tests/battle-ui/snapshot.test.js` also checks a 120-wave run with ~1000 leaks stays under 8 KB and
  keeps the debrief.
- `e2e/battle-save.mjs`: the whole flow in a browser at 844×390 and 1280×720, including an app kill
  emulated by copying the storage into a fresh browser context.
