# The energy update: build plan (UI M4 stage prep and results, energy, Bounty Passes, the 7 PM clock)

**Owner go-ahead (decision #154, Oct 22):** "Yes, start energy plus the M4 stage prep and results screens once M5 hubs
are done." The design is `docs/specs/ENERGY_RESET.md` (v2). The M4 layout is `docs/specs/UI_DIRECTION.md` §6.3 and §7 M4
and `docs/specs/ui-mock/stage-prep.html`.

**The build can start now.** "M5 hubs" is UI M5b, which is done and pushed at `origin/feature/ui-m5` @ `9af220e`. M5c
(list screens) and M5d (Multiplayer and the lobby) are not started; they run alongside this work under the file-owner
table in §2.1. Every file and function named here was checked on `9af220e`, after M5b rewrote `bounty.js`, `assault.js`,
`titans.js`, `commissions.js`, `campaign.js` and `meta-a.css` and added `hubStates.js` and `hubHost.js`.

**Branches.** These two docs sit on `feature/energy-m4` (docs only, cut from `main`). The build branch is
**`feature/energy`**, cut from `origin/feature/ui-m5` @ `9af220e` (or from `main` once M5b has shipped); its first commit
merges `feature/energy-m4`, unless `main` already carries these docs.

---

## 0. In one screen

| Milestone | What the player gets | Waits for | Size |
|---|---|---|---|
| **E0** Spec, plan and questions | `docs/specs/ENERGY_RESET.md` v2 and this plan in the repo; the owner gets the spec's 18 questions and this plan's 6, each with its default | – | done with these docs |
| **E1** One reset clock | Commissions, the login gift, Mall stock, the weekly double drops and the Freeplay Tome week reset at 7 PM Central; timers change without a reload; a wrong device clock is corrected by the server time and never locks anyone out | E0 | 4–5 h |
| **E2** Energy core (systems) | Nothing visible yet: energy, Passes, gem refills, run plans, charge-last payouts, sweeps, the co-op Ready rule, Titan first clears, battle saves, migration, the log | E1 | 7–9 h |
| **M4a** Stage prep | The one-screen stage prep from §6.3 and the mock: map band, ink strip, 2 × 2 difficulty, Counters, Drops, Mode chip, the two-row footer with Start next to the choice | E0 (alongside E2); `feature/items-3dflat` merged (the drop tile) | 7–9 h |
| **M4b** Results | Victory shows medal, drops and Next stage at a glance; details behind MORE; the freeplay strip on a plate | M4a; `feature/abilities` merged, or M4b keeps its `results.js` lines | 4–6 h |
| **E3** Energy UI | Energy pill, energy sheet with the refill ladder and all its states, Pass pill, the Rewards toggle and costs in stage prep, sweep costs with two taps, hub sweeps, results lines, the Continue switch, the co-op room line, words | E2, M4a, M4b; the lobby pill after M5d; the Settings row after M5c | 8–10 h |
| **E4** Integration and ship | Co-op, freeplay, battle saves, events, Titan first clears and the clock checked end to end; pace check with the Pass split; full gates; patch note; auto ship (#152) outside 6–8 PM Central | E3 | 3–5 h |
| M4c (later, optional) | Titan Trials' briefing adopts the stage prep layout | after the ship | 3–4 h |

Total ≈ 34–48 h of build. At most **two agents at once** on this track (E2 next to M4a; later M4b next to E2's tail),
counted together with whatever else runs on the machine. One release: **the energy update** (#123: M4 joins it).
`src/sim/**` is never touched: the sim id and `COOP_PROTOCOL` stay what they are at branch time (`92e2e22527cf` and 8 on
`9af220e`; the Tenka update on `feature/abilities` changes the sim and bumps `COOP_PROTOCOL` when it ships, and this
update adds no bump of its own). `SAVE_VERSION` stays 2.

---

## 1. Where things stand (`origin/feature/ui-m5` @ `9af220e`)

- **Clock:** `src/core/reset.js` has `gameDay`, `gameDayNumber`, `gameWeek`, `gameWeekNumber`, `nextDailyReset`,
  `nextWeeklyReset`, `gameDayStart/End`, `isNewPeriod`, `formatCountdown`, `localResetHint`. Events (and their sweep
  cap), Titan keys, the Workbench, the Ascension shelf and social code use it. **Still on device midnight:**
  `missions.js` `onAppStart` / `loginState` / `claimLogin` / `currentEvent`, `shop.js` `refreshShop`,
  `coop/rewards.js` `fpTome:` week, and `ui/countdown.js` `msToLocalMidnight` / `msToLocalWeekEnd`, which the M5 chips
  call from `commissions.js`, `mall.js`, `rewards.js`, `lobby.js`, `missions.js`, `bounty.js` and `hubStates.js`.
- **Energy:** nothing built. No Pass system. Sweeps are unlimited except the Halloween 10-a-day cap
  (`events.js` `EVENT_SWEEPS_PER_DAY`). Titan keys: 12 a week + 6 carry.
- **Stage prep** (`src/ui/screens/stage.js` `buildPrep` from line ~525, `sweepControls` from ~991 with its "Sweep again"
  action): two scrolling columns. M5b did not touch `stage.js` or `stageModes.js`. Styles in `meta-a.css` (`.ma-prep`,
  `.ma-diff`, `.ma-sweep`).
- **Hubs (M5b):** the Bounty and Total Assault footers each have one "Sweep ×10 · <difficulty>" button (`bounty.js`
  ~156, `assault.js` ~158; the Total Assault one has no `testid`). Host lines come from `hubStates.js` and `hostLines.js`.
- **Results** (`src/ui/battle/results.js` `createResults`): `apply()` pays once per results instance, catches an
  exception and still saves. Victory sheet → "Rewards" button → Rewards sheet; Defeat; Freeplay; Sandbox; Titan. Styles
  in `battle.css`, which the M2 battle work (`feature/abilities`) also edits.
- **Kit (M5a):** `src/ui/kit.js` (`chip`, `sticker`, `moreSticker`, `statStrip`, `rarityTag`, `rail`, `iconBtn`,
  `ghostBtn`, `inkBtn`, `countdownChip`), `src/ui/badges.js`, `src/ui/host.js`, `src/ui/keys.js`, `e2e/probe.mjs`,
  `tools/cssFloor.mjs`, `tools/contrast.mjs`, `e2e/ui-shots.mjs`, `e2e/hubs.mjs`.
- **Other open branches that meet this work:**
  - `feature/items-3dflat` (v0.1.46, ships first by the owner's focus order): `components.js` (+28), `stage.js` (+3),
    `lobby.js` (+2), `icons.js` (+122), `base.css`, `battle.css` (+3).
  - `feature/abilities` (the Tenka update with battle UI M2; changes the sim): `controller.js` (+202), `results.js`
    (+10), `setup.js` (+16), `session.js` (+14, `autoAbil` in the hello and start messages), `save.js` (+8), `coop.js`,
    `battle.css` (+236).
  - M5c and M5d (not started): see §2.1.
- **Live content to respect:** Halloween (stages until Nov 1, exchange until Nov 8), its Nightmare stages and its sweep
  cap.

---

## 2. Rules for every commit

1. **Branch:** `feature/energy` (above). One commit per milestone, plus review-fix commits. No force pushes or history
   rewrites: to pick up `main`, `feature/ui-m5` or another merged branch, **merge it in** (never rebase pushed commits).
   Ship by HANDOFF §7 (merge `--no-ff` into `release/next`, then `claude/sakura-sentinels`, push to `main`) with a patch
   note.
2. **No sim, no co-op ids:** nothing under `src/sim/**`, no change to stage, unit, enemy or map defs (they are hashed),
   no new network message or field. `node tools/simId.mjs` before and after must match.
3. **Stable hooks:** route names and existing `data-testid`s stay (`stage-start`, `stage-continue`, `stage-new`,
   `diff-<d>`, `diff-lock-<d>`, `diff-saved`, `sweep-1`, `sweep-10`, `prep-fp-*`, `event-prep`, `event-variant`,
   `stage-saved`, `saved-badge`, `add-<id>`, `stage-to-event`, `evict-*`, `bounty-sweep`, `bounty-prepare`,
   `assault-go`, `result`, `view-rewards`, `rewards`, `next-stage`, `retry`, `back-map`, `home`, `keep-going`,
   `freeplay-result`, `practice-note`, `result-note`, `victory-girl`, `titan-result`). New ones: `energy`, `energy-plus`,
   `energy-sheet`, `energy-refill`, `pass-sheet`, `rewards-switch`, `energy-spent`, `assault-sweep`. A control that moves
   into a sheet keeps its testid; e2e scripts get a helper `openPrepSheet(page, 'counters' | 'drops' | 'mode' | 'info')`.
4. **One owner per file** (§2.1).
5. **Gates** (§5) green before each commit. **Screenshots** before and after at 844×390, 1280×720 and 390×844 portrait,
   kept outside the repo (never committed).
6. **Words:** never another game's or anime's name, in code, docs, commits or patch notes. Students stay wholesome.
7. **Deploy window:** never deploy between 18:00 and 20:00 Central (the 7 PM switch-over, #152).

### 2.1 File owners while other steps run

| File | Owner now | What the energy work does |
|---|---|---|
| `src/ui/countdown.js` | free (M5a done) | E1 changes **only the bodies**: `msToLocalMidnight` / `msToLocalWeekEnd` stay as wrappers over the game clock (spec §8.2), so their callers are **not edited** |
| `mall.js`, `rewards.js` (Happening Now), `settings.js` | M5c | not edited until M5c merges. Then: the `rewards.js` line "Events rotate every Monday" (E1 follow-up) and Settings → About "Copy play stats" (E3, in M5c's Settings rail) |
| `lobby.js`, `screens/missions.js` (tile) | M5d | not edited until M5d merges. Then the lobby energy pill (E3), in M5d's lobby layout |
| `components.js` | M5d; `items-3dflat` (+28) | E3: one call line in `currencyPills` and an appended block, after M5d and `items-3dflat` merge (or merged in) |
| `hostLines.js` | M5c and M5d | E3 appends one line at the end of the Bounty table; the state comes from a new field in `hubStates.js` `bountyState` |
| `main.js` | M5c and M5d | E1: a 3-line change at the `onAppStart` call (applyResets, the reset clock). Different hunks from M5's route edits; whichever lands second merges the other in |
| `bounty.js`, `assault.js`, `titans.js`, `commissions.js`, `campaign.js`, `hubStates.js` | free (M5b done) | E1 (`commissions.js` weekly chip), E3 (hub sweeps, Pass pill, "Fight · first clear free") |
| `stage.js`, `stageModes.js`, `meta-a.css` prep rules | M4a (`items-3dflat`: 3 lines in `stage.js`) | M4a after `items-3dflat` merges; E3 after M4a. M5c / M5d only lower `meta-a.css` rules elsewhere |
| `battle.css` | M2 (`feature/abilities`) | never edited; M4b writes `src/ui/styles/results.css` |
| `controller.js`, `setup.js`, `results.js` | M2 (`feature/abilities`) | E3's battle logic goes in a **new `src/ui/battle/energy.js`**, wired with one line in each; M4b's `results.js` work and E3's hooks land after `feature/abilities` merges (or after merging it in) |
| `online/coop/session.js` | `feature/abilities` (+14) | E2's Ready rule (spec §3.7) touches other hunks (`room` handling, `setStage`, `canStart`); merge after abilities |
| `systems/save.js` | `feature/abilities` (+8, a setting) | E2 adds lines in `createProfile` / `migrateProfile`: adjacent-line conflicts only |
| `art/icons.js`, `art/icons/items.js` | `items-3dflat` (+122) | E3's two icons after `items-3dflat` merges |
| `e2e/smoke.mjs` | M5d (ROUTES) | M4a changes only the prep selectors |

---

## 3. Milestones

### E0. Spec, plan and questions
- **Scope:** `docs/specs/ENERGY_RESET.md` v2 (with the clock vectors and the switch-over simulation kept in its
  appendices) and this plan, on `feature/energy-m4`. Send the owner the spec's §14 questions (18) and §8 here (6), each
  with its default (#145); defaults stand until answered, and answers are folded into the spec before E2 ends.
- **Done when:** both docs are pushed, a grep for other games' names finds nothing, and the questions are sent.

### E1. One reset clock
- **Scope:** spec §8.2 and §5.4.
  - `reset.js` gains `LOCAL`, `fixedOffsetLocal`, `legacyDayKey`, `legacyWeekKey`, `periodKeys`, `nextPeriodChange`;
    the switch-over state in counters `rs:v` / `rs:du` / `rs:wu`; `util.js` `dayKey` / `weekKey` become aliases.
  - `missions.js` (`onAppStart` with `periodKeys` + `isNewPeriod`, `loginState`, `claimLogin`, `currentEvent` →
    `gameWeek`), `shop.js` `refreshShop`, `coop/rewards.js` `fpTome:` + `gameWeek`.
  - `countdown.js`: bodies only (`setPeriodSource`, the wrappers, the new names `msToDailyReset` / `msToWeeklyReset`);
    `commissions.js` passes the save's switch-over week to its weekly chip.
  - **Trusted time:** new `src/core/trustedTime.js`; `updates.js` reads the `Date` header of the `version.json` check;
    `resetNow()` uses it when the device is more than 2 h off; the first reset pass waits for the first check (≤ 3 s).
  - New `src/systems/resets.js` (`migrateResetScheme`, `rebaseStamps`, `applyResets`), new `src/ui/resetClock.js`
    (`startResetClock`); `main.js` calls `applyResets` (instead of `onAppStart` + `settleEvents`) and starts the clock;
    screens redraw on store reason `'reset'`.
  - Copy: `lobby/notice.js` ("rotates every Sunday at 7 PM Central"), the wiki "Daily routine", the `data/missions.js`
    comment. `rewards.js` copy waits for M5c (§2.1).
- **Files:** `src/core/reset.js`, `src/core/util.js`, `src/core/trustedTime.js` (new), `src/core/updates.js`,
  `src/systems/resets.js` (new), `src/systems/missions.js`, `src/systems/shop.js`, `src/systems/events.js` and
  `src/systems/titans.js` (`resetNow()` only), `src/online/coop/rewards.js`, `src/ui/countdown.js`,
  `src/ui/resetClock.js` (new), `src/main.js`, `src/ui/screens/commissions.js`, `src/ui/lobby/notice.js`,
  `src/data/wiki.js`, `src/data/missions.js` (comment).
- **Not edited:** `mall.js`, `rewards.js`, `lobby.js`, `screens/missions.js`, `bounty.js`, `hubStates.js` (the chips
  follow through `countdown.js`).
- **Tests:** `tests/core/reset.test.js`, `resetWeek.test.js`, `resetBounds.test.js` extended (R-1…R-8: the daylight-saving
  days, W53 → W01, the US-rule fallback every hour of 2026–2028, `periodKeys` inside and after the window for offsets
  −300, −420, 0, +60, +540, +780, the re-base of every listed stamp); `tests/systems/resets.test.js` (M-1…M-5);
  `tests/core/trustedTime.test.js` (2 h threshold, offline and dev fall back to the device clock, the server time moves
  on with `performance.now()`); `tests/systems/missions.test.js` and `tests/ui/countdown.test.js` on Chicago instants.
  Run the suite under `TZ=UTC` and `TZ=Asia/Tokyo`.
- **Screenshots:** Commissions (daily, weekly, login) and the Mall at the three sizes, showing the 7 PM chips.
- **Done when:** all of the above pass in both time zones; the chips count to 7 PM Central; an e2e step with a fake clock
  at 18:59 → 19:00:30 CDT sees the daily list reset without a reload; a save with a 2027 stamp and a correct trusted time
  recovers once, with no grant.

### E2. Energy core (systems)
- **Scope:** spec §3, §4, §5, §6, §10 and §11 in systems code:
  - `src/data/energy.js`, `src/systems/energy.js`, `src/systems/accountLevel.js` (moved, re-exported from
    `components.js`), `src/systems/energyLog.js`;
  - `planRun` and `sweepPlan` in `rewards.js`; `applyBattleResult` in the order of spec §3.9 (plan before the medals,
    **charge last**); `sweep` rolls every run, then charges `n × cost`;
  - what `off` / `short` runs never move: drops and coins, the loss consolation, `celestialRun`, `freeplayWeekNeedle`,
    `freeplayCacheTomes`, and `trackEvent` for `eventClear` / `eventBoss` / `eventKill` (spec §3.5);
  - the freeplay `rewarded` flag (`freeplayRewards.js`, `coop/rewards.js` ledger and pending runs);
  - co-op: `applyCoopResult` / `applyCoopClear` per player, `never` off the campaign, `coopResultLedger(session, seed)`;
    the Ready rule in `session.js` (`LOBBY.stageSettleMs`); the `defaultStage` fallback in `coop.js` (one line);
  - `titans.js` first-clear Victory at 0 keys (spec §3.10); `events.js` per-event sweep cap; `battleSave.js`
    `rewards: false`; `inventory.js`, `mail.js` and the code redeemer reject `energy` and `bounty_pass`;
  - `save.js` (`cleanEnergyCounters`, `energyLog`); `applyResets` runs `syncEnergy`.
- **Files:** new `src/data/energy.js`, `src/systems/energy.js`, `src/systems/accountLevel.js`, `src/systems/energyLog.js`;
  edited `src/systems/rewards.js`, `src/systems/freeplayRewards.js`, `src/online/coop/rewards.js`,
  `src/online/coop/session.js`, `src/ui/screens/coop.js` (the stage-param guard only), `src/systems/titans.js`,
  `src/systems/events.js`, `src/systems/battleSave.js`, `src/systems/inventory.js`, `src/systems/mail.js`,
  `src/systems/missions.js` (codes), `src/systems/save.js`, `src/systems/resets.js`, `src/ui/components.js` (re-export
  only).
- **Tests:** the spec's §13 unit list (EN-1…EN-10 with EN-3b and EN-5b, PR-1…PR-4, ER-1…ER-11, freeplay, co-op, Titan,
  accountLevel, energyDay, the F2P income rerun), plus `coopVersion().data` and `tools/simId.mjs` unchanged. Existing
  suites stay green: `tests/systems/rewards.test.js` (loss-consolation cases that use an already cleared stage are
  updated for Q15), `events-sweeps.test.js`, `events-nightmare.test.js`, `titans.test.js`, `missions.test.js`,
  `tests/online/coopRewards.test.js`, `coopFreeplay.test.js`.
- **Screenshots:** none (no UI).
- **Done when:** vitest and build green; `tests/systems/energyDay.test.js` (12 chapter-8 sweeps, 6 Bounty sweeps split
  6 / 0 and 3 / 3, one refill, a reset) matches spec §4.1 and §4.2.

### M4a. Stage prep (UI_DIRECTION §6.3 + the mock)
- **Starts after** `feature/items-3dflat` merges to `main` and `main` is merged into `feature/energy` (the drops row
  uses its item tile; it also edits `stage.js`).
- **Scope:** rebuild `buildPrep` as the one-screen layout, no scrolling at 844×390:

| Today | Goes to |
|---|---|
| Map thumb, tier badge, "2× drops", Endless, Freeplay badges, id + title, medal row | **Map band** (≈ 300 px): thumb with rule marks, tier sticker (ink letters on the tier colour), stage plate (id + name), stickers ("2×", the freeplay tier, "Endless", NEW mechanic). The medal row goes (the difficulty buttons show medals) |
| Info panel: description, facts (Waves, Lives, Start cash, Map, Best wave, Clears), chapter mechanic | **Ink strip** `statStrip`: WAVES · ♥ · START (WAVES ∞ on the colosseum, "25 + ∞" with freeplay), its MORE opens the **info sheet**; one **mission line** (≤ 60 characters) + "i" |
| Rule panel, Enemies panel, New mechanic badge | **Info sheet** (`sheet-info`): full description, event variant, the map rule, map name, clears / best wave, chapter mechanic, the enemy chips (tap → enemy info), new traits |
| Event panel | One **event plate line** above the difficulty grid: event chip, name, countdown chip, "+60 a win" |
| Difficulty picker | **2 × 2 grid** (`diff-<d>`): medal (earned or not), name, the gem reward only while unearned, lock + "Clear Hard first" on a locked event difficulty, "Saved" sticker, ribbon corner. Event stages with 2 or 3 difficulties use 1 × 2 or 2 + 1. Under it, **one rule sentence** for the selected difficulty, leaving out what the strip shows (Nightmare: "+75% HP, no income") |
| Mode panel + Freeplay panel | **Mode chip** ("Standard ▾", "Rush ▾", "Freeplay · Tempest ▾") → the **mode sheet** (`sheet-mode`): battle modes with their explainers and locks, the Freeplay tiers, best waves, the saved-battle note (`prep-fp-*` testids live here) |
| Counters panel + Formation panel | **Counters row** "Counters 3/3 ✓" with the need icons → the **counters sheet** (`sheet-counters`): each need, the girls who cover it, Add (`add-<id>`), then the formation strip and Edit formation. An empty formation turns the row into "Formation empty · Add girls" and disables Start |
| Drops panel + First clear panel | **Drops row** (≤ 5 icons in the item tile, the first-clear reward first with a FIRST sticker while unclaimed, "2×" sticker in an event week) → the **drops sheet** (`sheet-drops`): chances and counts (`dropGrid`), first-clear rewards, medal gems per difficulty, a girl who joins for free |
| Action bar | **Footer, two rows** (spec §9.3). Upper: Mode chip · "Sweep" + "Sweep ×10" when unlocked (else one line "Sweep: clear on Hard"). Lower: an **empty 44 × 44 slot** for the Rewards toggle (filled in E3) · **Start · Normal** (the one yellow). Saved battle: Continue · Wave N/M (yellow) + New game (secondary) + the saved line. Locked: lock line + "Go to 2-1" / "Back to the event" |

  - **The mission line** can't come from `stage.desc` (too long) and can't be a new field on the stage def (the co-op
    hash). It comes from a UI table `src/ui/text/stageLines.js` (every campaign, Bounty, Total Assault and event stage;
    ≤ 60 characters; default to the map rule text when a stage has one). A unit test enforces the length and
    completeness.
  - **A pure view model** `prepModel(profile, stage, state)` (in `src/ui/prep/model.js`) decides what shows: rewards per
    difficulty, the rule line, drop order, counters count, footer state. The DOM code only draws it, so the number budget
    is unit tested. E3 adds the plan to it.
  - **Number budget** (spec §9): ≤ 12 visible numbers, not counting the shared top bar, counting the Start cost and the
    sweep costs once E3 adds them.
  - **Variants:** Bounty (tier sticker, the arena's drops), Total Assault, Tactical Challenge (no grid; WAVES ∞; best wave
    sticker; "Start endless"), event stages (event line, own difficulties, Nightmare variant line), Tactical Challenge's
    freeplay prep (`endless=1`: the mode chip on its tier).
  - **One column** (portrait phones < 700 px wide): map band on top (shorter), the right column below, the footer pinned.
  - **Desktop keys** (M5a `keys.js`): "Space" chip under Start; Esc closes sheets.
- **Files:** `src/ui/screens/stage.js` (`buildPrep` and helpers; `countersPanel`, `formationPanel`, `firstClearPanel`,
  `freeplayPanel` become sheet bodies), `src/ui/screens/stageModes.js` (the mode sheet), new `src/ui/prep/model.js`,
  `src/ui/prep/sheets.js`, `src/ui/text/stageLines.js`, `src/ui/styles/meta-a.css` (prep rules), `e2e/stage-prep.mjs`
  (new), `e2e/ui-shots.mjs` (screens), the e2e scripts that click prep controls (`smoke.mjs`, `battle-save.mjs`,
  `codex-modes.mjs`, `solo-freeplay.mjs`, `halloween.mjs`, `tutorial.mjs`, `sandbox.mjs` if it passes through prep).
- **Tests:**
  - `tests/ui/prepModel.test.js`: unearned rewards only; the rule line never repeats the strip; drops order (FIRST
    first); counts per spec §9.3 (4-3 fresh Normal = 9; 2-3 Easy to Hard cleared, Nightmare = 10).
  - `tests/ui/stageLines.test.js`: every stage has a line ≤ 60 characters.
  - `e2e/stage-prep.mjs` at **844×390, 1280×720 and 390×844** for 1-1 fresh, 4-3 Normal, 2-3 all medals on Nightmare,
    `res-books-2`, `boss-lych`, `challenge`, `ev-halloween-boss` (Nightmare variant), a saved battle, a locked stage:
    the probe passes (numbers ≤ 12 outside the top bar, smallest text ≥ 12 / 13 px, no ellipsis, no sideways scroll,
    content ≥ 300 px, one yellow); Start sits in the right column under the grid with **no scroll**
    (`scrollHeight ≤ clientHeight`) **with the toggle slot in place**; each sheet opens and closes (outside tap, close,
    Esc); every listed testid exists.
  - The updated e2e scripts pass; the `tools/cssFloor.mjs` count for `meta-a.css` goes down (prep rules to zero under
    12 px); `tools/contrast.mjs` has the tier-sticker pairs (≥ 4.5:1).
- **Screenshots (before → after, three sizes):** 1-1 fresh, 4-3 Normal (the mock's case), 2-3 Nightmare cleared with
  sweeps, Library Courtyard II, Total Assault: Grave Lych, Tactical Challenge, Halloween boss Nightmare, a saved battle, a
  locked stage, the four sheets.
- **Done when (UI_DIRECTION §7 M4):** one screen at 844 with ≤ 12 visible numbers; Start next to the difficulty choice;
  no cut-off difficulty rules; every flow above still works.

### M4b. Results
- **Starts after** `feature/abilities` merges (merge it in), or M4b keeps that branch's two `results.js` additions (the
  ability summary line and the MVP casts) when it restructures the sheets.
- **Scope:**
  - **Victory (Glance):** the slanted VICTORY band (as built), the stage line ("4-3 Shield Wall · Normal"), the medal
    with NEW MEDAL / FIRST CLEAR stickers (or the ribbon row for a battle mode), an **energy line slot** (E3), the
    **drops row** (gems first, then items and gear tiles, ≤ 8; more → "+N" chip), a new girl card, a "New episode" line
    for events, the Keep going block on a plate, and the actions: **Next stage** (the one yellow; Retry when there is no
    next), Retry, Map, Home. A MORE sticker (`view-rewards`) opens the **details sheet** (`rewards`): every drop with
    counts and gear cards, Top damage, Waves / Lives / Defeated / Time, the hero line, the abilities line, bestiary
    updates, the achievements line, and the same actions.
  - **Defeat:** the DEFEAT band, stage line and wave, the energy line slot ("No energy used", E3), the debrief (≤ 3
    lines), leaks (≤ 4), trait chips, consolation tiles; Retry (yellow), Map, Home; the summary behind MORE.
  - **Freeplay:** the freeplay strip moves onto an ink plate (it is 1.46:1 today; target ≥ 4.5:1): the wave pill, best
    line, clear and freeplay tiles; bonus lines behind MORE.
  - Practice and no-reward notes on a plate line; co-op notes as today; Sandbox restyled; Titan results keep their
    layout (number style only).
- **Files:** `src/ui/battle/results.js`, `src/ui/battle/modes.js` (`resultRibbonRow`), new `src/ui/styles/results.css`
  (imported by `results.js`, loaded after `battle.css`, overrides `.bt-result*`, `.bt-free*`, `.bt-medal*`,
  `.bt-rewards*`); `e2e/results.mjs` (new), `e2e/ui-shots.mjs`.
- **Coordination:** no edits to `battle.css` while M2 owns it. After M2 merges, one cleanup commit deletes the overridden
  rules there (it also lowers the cssFloor count).
- **Tests:** `e2e/results.mjs` (scripted battles through `e2e/engines/scriptedBattle.js`): first-clear Victory, replay
  Victory with gear, a Rush ribbon Victory, the details sheet, Defeat with leaks, Freeplay over and complete
  (`solo-freeplay` engine), practice (locked deep link), Sandbox; co-op through `e2e/codex-modes-coop.mjs` in local
  mode. The probe passes on each at the three sizes (Glance ≤ 12 numbers outside tiles; tiles ≤ 2 each). Every listed
  testid stays. Contrast of the freeplay plate ≥ 4.5:1.
- **Screenshots (before → after, three sizes):** first clear, replay with gear, ribbon, details sheet, Defeat, Freeplay
  over, Freeplay complete, practice, co-op Victory, Sandbox.
- **Done when:** medal, drops and Next stage are visible without scrolling at 844; the damage breakdown and time are one
  tap away; the freeplay strip passes contrast; all result e2e scripts pass.

### E3. Energy UI
- **Scope:** spec §9 in full:
  - the energy pill in `currencyPills` (above-max accent, no chip; the level-up toast) and, after M5d, the lobby
    (`buildTop`), with the countdown chip;
  - the Pass pill on the Bounty hub and Bounty stage prep (`currencyPills({ currency: 'passes' })`);
  - the energy sheet (balance, countdown, "i" rules, the 10-pip price ladder, the two-tap Refill cost button and every
    state of spec §9.2, "Get gems" → Commissions) and the Pass sheet;
  - stage prep: the Rewards toggle in M4a's slot, the Start label states of spec §9.3, the forced-off switch turning On
    after a refill, `rewards=0` in the battle params, Continue with the saved switch;
  - sweeps everywhere (stage prep, Bounty and Total Assault hubs, the sweep rewards sheet): costs on every button, Sweep ×N
    in two taps with the before → after line, "Sweep again" with its cost and hidden at 0, hub "Sweep" ×1 added; the
    Bounty host line "6 Passes ready" (`hubStates.js` `bountyState` + one line appended in `hostLines.js`);
  - the battle side in new `src/ui/battle/energy.js` (the plan, the start toast, the restart re-plan, parsing
    `rewards=0`), one wiring line each in `controller.js`, `setup.js` and `results.js`;
  - results lines (Victory chip, rewardless line, Defeat "No energy used", the Pass chip, the Keep going line) and the
    Retry rule;
  - the co-op room's own-card line and switch (`coop.js`), the Ready toast, co-op `ctx.applyResult` passing
    `{ rewards }`;
  - the titans screen's "Fight · first clear free" at 0 keys;
  - icons (`SPECIAL_ITEMS.energy`, `SPECIAL_ITEMS.bounty_pass`, original art in the 3D-flat item look);
  - words: patch note, the wiki "Energy & Bounty Passes" page, the Journal lines, `docs/ECONOMY.md`, `CONTRACTS.md` §5,
    and the `rewards.js` Monday line (after M5c);
  - Settings → About → "Copy play stats" (after M5c's Settings rail).
- **Files:** new `src/ui/energy.js`, `src/ui/battle/energy.js`; edited `src/ui/components.js`, `src/ui/screens/lobby.js`,
  `src/ui/screens/stage.js`, `src/ui/prep/model.js`, `src/ui/screens/bounty.js`, `src/ui/screens/assault.js`,
  `src/ui/screens/titans.js`, `src/ui/hubStates.js`, `src/ui/hostLines.js`, `src/ui/battle/setup.js`,
  `src/ui/battle/controller.js`, `src/ui/battle/results.js`, `src/ui/screens/coop.js`, `src/ui/screens/settings.js`,
  `src/ui/screens/rewards.js` (one line), `src/art/icons.js`, `src/art/icons/items.js`, `src/ui/styles/components.css`
  (pill, toggle, cost labels; appended), `src/data/wiki.js`, `src/data/story/lessons.js`, `src/data/patchNotes.js`,
  `docs/ECONOMY.md`, `CONTRACTS.md`.
- **Tests:** `e2e/energy.mjs` (spec §13 E2E) at the three sizes; `e2e/battle-save.mjs` (Off → Save & quit → Continue →
  a win charges 0); `e2e/codex-modes-coop.mjs` (a stage change after Ready locks Start until Ready again);
  `tests/ui/energyUi.test.js` (every plan state, sweep costs, the sheet states); `tests/story/journal-data.test.js` with
  the new lines (≤ 3 paragraphs of ≤ 120); the probe on lobby, stage prep (each state), the sheets, Bounty and Total
  Assault hubs, results; top bar: no overlap, no sideways scroll at 844×390 and 390×844.
- **Screenshots (three sizes):** lobby with the pill full / part-used with the chip / at 0 / above max; a top bar on stage
  prep; the energy sheet fresh, after 3 refills, at 10/10, without enough gems, above max, with the free refill under
  1 h away, after a max raise, at 900; the Pass sheet; stage prep in each plan state of spec §9.3, including `short`
  becoming `paid` after a refill and Continue with the saved switch; Sweep ×N armed ("⚡ 120 → 90"); the sweep sheet with
  and without "Sweep again"; Bounty hub with Passes and at 0; Total Assault hub; results with "⚡ −10", "No rewards · out
  of energy", Defeat "No energy used", the rewardless Keep going block; the co-op room's own card and the Ready toast; the
  battle start toast; the titans screen at 0 keys.
- **Done when:** every spec §9 touchpoint exists with its testid; `e2e/energy.mjs` passes at the three sizes; the probe
  passes on every touched screen.

### E4. Integration, pace check and ship
- **Scope:** end-to-end checks across systems; the Ascension pace check; review; patch note; ship.
  - **Flows by hand and e2e:** a co-op room with one player at 0 energy (both finish; only the paying player is charged);
    the host changes the stage after the guest's Ready (Start locks until Ready again); a co-op disconnect before the win
    (nothing charged) and a rejoin (charged once); a resync near the win (charged once); solo and co-op freeplay (one
    charge at the bank, waves paid); Rewards Off → Save & quit → Continue → win (charged 0); Save & quit → spend energy
    elsewhere → Continue (the plan shows `short`, the win pays nothing); a hand-edited co-op link to a Bounty stage
    (pays nothing); Halloween sweeps (no energy, 10 a day); a Titan first-clear Victory at 0 keys; a 7 PM rollover with
    the app open; a device clock set to 2027 and then corrected (one re-base, no grant).
  - **Pace check:** `node --import ./tools/simLoader.mjs tools/ascensionPace.mjs` gains `--passes-library N` (how many of
    the 6 daily Passes go to Library Courtyard III Nightmare; the rest go to Market Canal III). Tomes a week = 8 (caches,
    Bounty Exchange, Titan shelf, Memento shelf) + 1.4 × N + the model's own Titan books; coins follow spec §4.2. Report
    N = 6, 3 and 0 against the current model. If the free player's level-85 weeks slip by more than two weeks, raise it
    with the owner with a data-only fix (spec §4.2).
  - **Review:** one reviewer on the whole diff (systems + UI), one fix round.
  - **Patch note** (`src/data/patchNotes.js`, id = the next deploy run number): energy, Bounty Passes, the Rewards
    switch, the 7 PM clock, first clears always free, the new stage prep and results.
  - **Ship:** auto ship once every gate passes (#152), **never between 18:00 and 20:00 Central**:
    `feature/energy` → `release/next` → `claude/sakura-sentinels` → `main` with `--no-ff` merges (HANDOFF §7). The ship
    report lists which of the spec's §14 questions and §8 here still run on their defaults, and links the rollback note
    (§7). Before/after pairs go to the owner for a real-phone check (UI_DIRECTION §7).
- **Done when:** §5 gates all green; `tools/simId.mjs` unchanged; the pace check reported; the patch note reads right.

### M4c (later, optional). Titan Trials briefing
- UI_DIRECTION §7 M4 coordination: weekly boss trials use the stage prep layout (stage strip, tier buttons, counters
  line, drops row, one Start). `src/ui/screens/titans.js` `detail` gets the map band, a strip (HP · KEYS · BEST), tier
  buttons, the target family as the "Counters" row, the Victory Chest as the drops row, and Fight / Practice / Sweep in
  the footer. Its own small release after the energy update; no energy involved.

---

## 4. Order and overlap

| Step | Track A | Track B | Needs from other branches |
|---|---|---|---|
| 1 | E0 → E1 | – | none (E1 stays out of M5c / M5d files, §2.1) |
| 2 | E2 (systems) | M4a (stage prep) | M4a: `items-3dflat` merged into `main`, `main` merged in |
| 3 | E2 tail / review fixes | M4b (results) | M4b: `feature/abilities` merged (or its `results.js` lines kept) |
| 4 | E3 (energy UI) | – | `feature/abilities` for the battle hooks and `session.js`; M5d for the lobby pill and `components.js`; M5c for Settings and `rewards.js` |
| 5 | E4 | – | – |

- E2 and M4a touch different files (systems vs `stage.js` / `meta-a.css`), so they run side by side. M4a leaves the
  toggle slot that E3 fills.
- M4b and E2 don't share files either (`results.js` only gets energy lines in E3).
- **`feature/items-3dflat`** (v0.1.46) ships first: M4a and E3 start their `stage.js`, `components.js`, `lobby.js` and
  `icons.js` work only after it has merged and `main` has been merged into `feature/energy`.
- **`feature/abilities`** changes `controller.js` (+202), `results.js`, `setup.js` and `session.js`: E3's battle code
  lives in `src/ui/battle/energy.js` with one-line hooks, and lands after abilities merges (or after merging it in);
  E2's `session.js` Ready rule touches other hunks. Abilities bumps `COOP_PROTOCOL` when it ships; energy does not.
- **M5c / M5d** keep their files (§2.1). If one of them is still open when E3 is otherwise done, E3 ships without the
  piece that waits for it only with the owner's say-so; the default is to wait (they are small).
- If Halloween is still open when the update ships, nothing about it changes (cost 0, cap 10).

---

## 5. Gates (every milestone)

1. `npx vitest run` (also `TZ=UTC` and `TZ=Asia/Tokyo` from E1 on).
2. `npx vite build`.
3. `node e2e/smoke.mjs --viewport 844x390` and `--viewport 1280x720`.
4. The milestone's own e2e scripts and every existing script it touches.
5. The probe (`e2e/probe.mjs`, via `e2e/ui-shots.mjs --probe`) on every touched screen at 844×390, 1280×720 and 390×844,
   with the spec §9 number rule.
6. `node tools/cssFloor.mjs`: the count only goes down per file.
7. `node tools/contrast.mjs`: new token pairs ≥ 4.5:1 (numbers ≥ 22 px: ≥ 3:1).
8. `node tools/simId.mjs`: unchanged.
9. Screenshots before → after saved and looked at for clipping, overlap and the one-yellow rule.
10. Deploys (E4) only outside 18:00–20:00 Central.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Passes slow Tome supply more than the Ascension model expects | E4 pace check with the Pass split; data-only fix (Tome chance, Passes a day, free tier I) with the owner |
| Passes feel stingy for early and mid players (1.2 runs per arena a day) | Q6 puts the trade-off to the owner; data-only options ready; the log records the split by arena and tier |
| Players feel energy as a cut ("unlimited → 12 sweeps") | Rewards-only rule, free first clears and ribbons, a cheap first refill, clear words in the patch note; the log measures it |
| A forgotten Rewards switch eats a good run | Switch hidden on free runs, back to On every visit, "Start · No rewards" + pink sticker, results say so; saved battles keep their own setting |
| One tap spends a day's energy | Costs on every sweep button; Sweep ×N in two taps with "⚡ 120 → 90" |
| A wrong device clock locks a player out | Server time from the update check; re-base without a grant |
| Stage prep e2e break when controls move into sheets | Testids stay; one `openPrepSheet` helper; M4a updates the scripts in the same commit |
| Conflicts with `feature/abilities`, `items-3dflat`, M5c, M5d | §2.1 owners; new files for energy code; one-line hooks; merge order in §4 |
| `battle.css` conflicts with M2 | `results.css` overrides; cleanup after M2 merges |
| Old tabs play without energy | Accepted (spec §5.3); deploys are cache-busted and the update check prompts a reload |
| Top bar crowding at 844 with a third pill | "/120" hides under 900 px; the Pass pill replaces the energy pill on Bounty screens; e2e checks overlap at 844×390 and 390×844 |
| The 7 PM switch-over during a deploy | No deploys 18:00–20:00 Central |

---

## 7. Rollback

A broken release is fixed by a new commit: a revert or a forward fix (HANDOFF §6: no history rewrites). Reverting E1
after it ships turns `missions.day` back into a device-day key, so a player can get one extra daily claim on the day of
the revert; that is accepted. Reverting energy leaves the `en:*`, `bt:*` and `rs:*` counters in saves, which the
reverted build ignores; a later re-ship refills once. No live-database change is involved (the clan-boss SQL stays out
unless the owner says yes, spec Q17).

---

## 8. Plan questions (defaults in force until answered, #145)

The design questions are the spec's §14 (18 questions: regen, max, refill ladder, costs, Total Assault, Passes and the
Tome / coin split, the switch, rewardless runs, ribbons, Titan first clears, freeplay, events, the reset clock, analytics,
losses, Tactical Challenge and the clan boss, the clan-boss week, the Pass name). For the build itself:

1. **One release or two?** Ship M4 (stage prep + results) together with energy as one update, as #123 says, or let M4
   ship first on its own if energy needs longer? **Default: one release.**
2. **Formation in stage prep:** §6.3 has no formation strip. Put it inside the Counters sheet (with Edit formation), and
   turn the Counters row into "Formation empty · Add girls" when it is empty? **Default: yes.**
3. **Victory and Rewards:** fold the Rewards sheet's essentials (medal, drops, Next stage) into the Victory sheet and keep
   the full list behind MORE? **Default: yes** (one tap fewer after every win).
4. **The stage mission line** (≤ 60 characters per stage) is written by us for every stage? **Default: yes**, from each
   stage's own description and map rule.
5. **Titan Trials briefing (M4c)** in the layout later as its own small update? **Default: yes, after the energy
   update.**
6. **Where the energy cost shows in stage prep:** in the Start label ("Start · Hard · ⚡ 10") with the Rewards switch as a
   44 px toggle next to Start, instead of a separate chip-and-switch row above the footer? **Default: yes** (no extra
   row, so the screen still fits at 844×390).
