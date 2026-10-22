# Energy, Bounty Passes and the 7 PM reset: build spec (v2)

**Replaces** the Oct 13 version of this file. The Oct 13 reset-clock design (one clock at 7 PM Central, the switch-over,
the optional clan-boss SQL) is still right; it is kept in §8 and Appendices A and B, updated to what is built now. The
build plan is `docs/specs/M4_ENERGY_PLAN.md`. The UI layout is `docs/specs/UI_DIRECTION.md` §5, §6.3 and §7 M4, and
`docs/specs/ui-mock/stage-prep.html`.

**Owner rules this follows** (the owner's words win over anything below):
- **Energy rules (owner decision #116, Oct 20):** energy gates **rewards**, not play. Any stage can always be played.
  First clears and new medals are free. Energy is taken on a **win**. Bounty uses its own daily allowance instead of
  energy (proposed: 6 a day, saved up to 12). Energy can be bought with gems at a price that rises with each refill in a
  game day (for example 50 → 100 → 150) and goes back down at the 7 PM Central reset. Max energy grows by 1 per account
  level past a threshold (cap to be decided). A Rewards on/off switch in stage prep (proposed). Refill: daily only by
  default (regen not answered yet).
- **Event sweeps (#115):** at most 10 event sweeps a day, all event stages together, on the 7 PM Central game day. Real
  battles are never capped.
- **UI (#123, #154):** UI M4 (stage prep and results) ships in the energy update. The build starts once the M5 hubs step
  (M5b) is done.
- **Elective Path (#52):** every battle mode opens after one clear of a stage. **UI direction (#55):** two-tap buying
  (its Q3), which the Refill and Sweep ×N buttons follow.
- **Coins, materials and gear stay on the device (#35).** No server tables unless truly needed.
- **Ask with defaults (#145):** every open question goes to the owner with a default; the default stands until answered.
  Money, the live database, player-data deletion and downloads still need a real yes; shipping follows the auto-ship
  rule below. **No dates (#147).**
- **Auto ship (#152):** a release ships once every gate passes, never between 6 and 8 PM Central.
- **One reset time (Oct 13, D3):** every reset at 7 PM Central (America/Chicago, daylight saving included).

**Grounded in** `origin/feature/ui-m5` @ `9af220e` (UI M5b done; based on the v0.1.45 code), sim id `92e2e22527cf`,
`COOP_PROTOCOL` 8, `SAVE_VERSION` 2. Every file and function named here was opened on that ref. Where M5b changed a
file (`bounty.js`, `assault.js`, `titans.js`, `commissions.js`, `campaign.js`, `meta-a.css`, the new `hubStates.js` and
`hubHost.js`) this spec names the M5b version. The energy update changes neither the sim id nor `COOP_PROTOCOL`: both
stay whatever they are when the build branch is cut (the Tenka update on `feature/abilities` changes the sim and bumps
`COOP_PROTOCOL` when it ships).

---

## 0. What changed since the Oct 13 spec

| Oct 13 spec | This spec | Why |
|---|---|---|
| Bounty arenas cost energy (10 / 15 / 20) | Bounty costs **Bounty Passes**: 6 a day, saved up to 12 | #116 |
| `blocked` runs: Bounty and Total Assault need energy to start | **Gone.** Every stage starts. Short on energy = a run without rewards | #116 "any stage always playable" |
| Once-a-day "Out of energy" popup | **Gone.** Stage prep shows a designed "not enough" state (UI_DIRECTION 5.4) | fewer interruptions |
| No gem refills | **Gem refills:** 50 → 100 → 150 → 200 → 250 → 300, then 300, up to 10 a game day | #116 |
| Max 120 for everyone | 120, **+1 per account level from Lv 21 to Lv 60 (160)** | #116 (threshold and cap proposed) |
| (none) | **Rewards switch** in stage prep, the co-op room and saved battles | #116 |
| `profile.energy` / `profile.resets` blocks | Numbers in **`missions.counters`** (`en:*`, `bt:*`, `rs:*`) | every build keeps counters word for word, so an older build can't refill energy by dropping a block |
| Event stages cost `stage.energy` | Costs live in `src/data/energy.js`; **Halloween 2026 stays free** | stage defs are in the co-op data hash; Halloween was tuned without energy |
| Titan Trials: no energy | Same, and **a solo first-clear Victory uses no Trial Key, even at 0 keys** | #116 "first clears free" |
| Device clock, forward-only resets | Device clock, plus the **server's time** from the update check when the device is more than 2 h off, and a **re-base** of stored days that sit in the future | a phone that once showed a wrong future date must not be locked out |
| Account level is UI code | `accountLevel` moves to `src/systems/accountLevel.js` (re-exported) | max energy needs it in systems code |

---

## 1. Summary (what players see)

- **Energy ⚡** pays for **rewards from replays:** Mission (campaign) replays, Total Assault, future event stages, and
  sweeps of those. **120 a day**, refilled at **7 PM Central**. The max grows by 1 per Sensei level after level 20, up
  to **160** at level 60.
- **Every stage can always be played.** With the Rewards switch off, or without enough energy, a run plays as normal
  and gives no drops or coins. Nothing is ever locked behind energy.
- **Always free:** first clears, new medals, new battle-mode ribbons, the first Titan Trials Victory at each step,
  Tactical Challenge, Sandbox, practice runs and the first tutorial.
- **Only wins cost anything.** A loss, Quit, Restart, a crash or a co-op disconnect costs nothing.
- **Bounty Passes 🎫:** the Bounty arenas (Library, Market, Workshop, Meadow, Rune Garden) use Passes instead of energy:
  **6 a day, saved up to 12**, one per win or sweep.
- **Need more?** Refill +120 energy for gems: **50, 100, 150, 200, 250, 300, then 300**, up to 10 times a game day. The
  price goes back to 50 at 7 PM Central.
- **One clock.** Commissions, the login gift and Mall stock move from device midnight to 7 PM Central too. Weekly
  things reset on Sunday at 7 PM Central.

(⚡, 🎫 and 💎 in this file stand for the game's own SVG icons: `energy`, `bounty_pass` and gems.)

---

## 2. Decisions

| # | Topic | Decision | Source |
|---|---|---|---|
| N1 | What energy gates | Rewards only. Every run is playable; a run without energy pays nothing | Owner #116 |
| N2 | When energy is taken | At the **win**, as the **last** step of the payout, after the items are added (§3.9). A sweep charges after all its runs are rolled. Never before. Nothing to refund | Owner #116 |
| N3 | First clears, new medals | Free, full rewards, at 0 energy too | Owner #116 |
| N4 | New battle-mode ribbons | Free like new medals (ribbons are the modes' medals) | **Default · Q9** |
| N5 | Bounty | Bounty Passes: 6 a game day, up to 12 saved, 1 per win or sweep (any arena, tier or difficulty); first clears and new medals free | Owner #116 (numbers proposed) · **Q6, Q18** |
| N6 | Gem refills | +120 energy each; price 50 / 100 / 150 / 200 / 250 / 300, then 300; 10 a game day | Owner #116 (ladder extended) · **Q3** |
| N7 | Max energy | 120; +1 per account level above 20, up to level 60 (max 160) | Owner #116 (threshold, cap proposed) · **Q2** |
| N8 | Refill | Daily top-up to max at 7 PM Central; no time regen (built in, off) | Owner default · **Q1** |
| N9 | Rewards switch | In stage prep, the co-op room and saved battles; **On** every time stage prep opens, except that a saved battle keeps its own setting | Owner #116 (proposed) · **Q7** |
| N10 | Costs | Missions 5–10 by chapter (any difficulty, any mode); Total Assault 30; future events per event; Bounty 1 Pass | **Default · Q4, Q5** |
| N11 | Runs without rewards | Still count for commissions, achievements, the bestiary, account level and clears. They do **not** count for event missions that pay event currency, and never move the hidden reward counters (§3.5) | **Default · Q8** |
| N12 | Losses | A lost replay costs nothing and pays nothing. The 40-coins-a-wave consolation stays on losses of first-clear and new-medal attempts | **Default · Q15** |
| N13 | Freeplay | One charge covers the whole run (the clear at the goal wave, then every freeplay wave) | **Default · Q11** |
| N14 | Co-op | Campaign stages only. Each player pays their own energy and has their own switch; a player with no energy joins and plays without rewards. A stage or difficulty change takes back the guest's Ready | Owner (task) · §3.7 |
| N15 | Events | Halloween 2026 stays energy-free with its 10 sweeps a day. Future events cost energy; the separate sweep cap is off unless an event sets one | **Default · Q12** |
| N16 | Titan Trials | Trial Keys, no energy. A solo Victory at a step without a first-clear mark pays in full and uses no key, even at 0 keys | **Default · Q10** |
| N17 | Reset clock | Commissions, login and Mall move to 7 PM Central in this update | D3 · **Q13** |
| N18 | Analytics | On the device only (no server table); "Copy play stats" for testers | #35 · **Q14** |
| N19 | Clock source | The device clock, corrected by the server time from the update check while online when the device is more than 2 h off; stored days in the future are moved back without a grant (§5.4) | Oct 13 A10, revised |
| N20 | Old saves | Start full: max energy and 12 Passes | Task |
| N21 | Tactical Challenge, clan boss | Free (no energy): Tactical Challenge pays slowly and time is its limit; the server allows 3 clan boss hits a day | **Default · Q16** |
| N22 | Starfall Trial, Daily Drill, Rival Run | No energy (each has its own limit) | #51, #52, #108 |
| N23 | Clan boss week | Left on its server clock (it flips at 6 PM Central in winter, an hour before everything else). The SQL that moves it is the only server change in this work and needs the owner's yes | **Default · Q17** |

---

## 3. The model

### 3.1 Energy

- **Max** = `120 + clamp(level − 20, 0, 40)`. `level` is the higher of `accountLevel(profile).level` (max 99) and the
  **highest level ever seen** (`en:lv`), so a later change to the XP formula never lowers anyone's max. Level 1–20: 120.
  Level 40: 140. Level 60 and up: 160.
- **Daily refill.** At the first look after a 7 PM Central reset: `value = max(value, max)`. It tops up; it never takes
  away energy above max (from gem refills). Missed days don't stack.
- **A higher max** (a level-up during the day) shows at once on the pill ("87/121") and fills at the next refill. No
  instant grant. A toast says so (§9.1).
- **Above max:** gem refills and grants may go above max, up to the hard cap **999**. While above max, the daily refill
  adds nothing.
- **Regen** is built in and off: `ENERGY.regenMinutes = 0`. Setting it (for example 6 = +1 every 6 minutes, up to max)
  turns it on with no other change (Q1). It uses the stamp `en:t`, written only while regen is on.
- **Gem refill.** +120 energy (a flat amount; it doesn't grow with level, so the price per energy is clear). The n-th
  refill of a game day costs `prices[min(n − 1, 5)]` = 50, 100, 150, 200, 250, 300, 300, 300, 300, 300. At most 10 a game
  day. The count resets at 7 PM Central. A refill that would pass 999 fails with `'full'` (never clamped silently).
  Gems go first and energy is added in the same synchronous write. A refill is never refunded.
- Energy is **not an item**: mail, codes, the Mall and `addItems` reject the ids `energy` and `bounty_pass`.
  `grantEnergy()` and `grantPasses()` exist for future event or achievement rewards.

### 3.2 What costs what

The cost is paid **once per won reward run or per sweep**. Sweeps always pay (they are never first clears).

| Content | Pays with | Cost per win or sweep | Notes |
|---|---|---|---|
| **Mission** replay (campaign, `kind: 'campaign'`) | Energy | Ch 1–2: **5** · Ch 3–4: **6** · Ch 5–6: **8** · Ch 7–8: **10** · later chapters (Act II, x-6…x-10): the chapter 8 cost until set | Same cost on Easy, Normal, Hard and **Nightmare**: a harder difficulty already pays more (coins ×1.25 / ×1.5, extra drop rows) for a harder fight; a higher price would punish skill |
| Mission in a **battle mode** (Reverse, Rush, Ironclad, Frugal, Last Petal) | Energy | Same as Standard on that stage | Pays at most your best Standard medal (CODEX_MODES §7.1, unchanged). A **new ribbon** is free (Q9) |
| **Freeplay** (Blossom, Tempest, Crimson Moon; solo or co-op) | Energy | The stage's Mission cost, **once** for the whole run | Charged at the bank (goal wave cleared). The freeplay waves, caches and tokens after it are covered. A run without rewards keeps best waves and one-time milestones only (Q11) |
| **Bounty** (`kind: 'resource'`, 5 arenas × I / II / III) | Bounty Passes | **1** | Any tier, any difficulty. First clears and new medals: free |
| **Total Assault** (`kind: 'boss'`) | Energy | **30** | Any difficulty (Q5: or its own passes) |
| **Event** operations and bosses (future events) | Energy | Per event in `src/data/energy.js`; fallback: the Mission cost of the stage's `tuneLike` chapter, boss ×2 | Halloween 2026: **0** (exempt, keeps its 10 sweeps a day) |
| **Titan Trials** (weekly bosses) | Trial Keys | 1 key per counted fight or sweep (12 a week + 6 carry, unchanged) | No energy. A solo first-clear Victory uses no key, even at 0 keys (§3.10) |
| **Co-op** Missions | Energy | Each player pays their own Mission cost at their own win | Co-op never gives medals or first clears, so it is never free (§3.7) |
| Co-op on a non-campaign stage (a hand-edited link) | – | – | `never`: pays nothing, charges nothing (§3.7) |
| Co-op Titan Trials | Trial Keys | as today | Together Chests 3 a week (unchanged) |
| **Tactical Challenge** (the colosseum, endless) | – | **Free** | Pays slowly (40 coins a wave); time is the limit (Q16) |
| **Sandbox** | – | **Free** | Never pays anything (`sandboxOutcome`) |
| Practice (a deep link to a locked stage) | – | Free | Pays nothing (unchanged) |
| Tutorial replay (Story archive) | Energy | A normal 1-1 replay (5), or no rewards | STORY_SPEC §1.5: "rewards follow the normal stage rules"; the first tutorial is a first clear, so free |
| Clan boss | – | Free | The server already allows 3 a day (Q16) |
| Starfall Trial (LR) | – | Free | Free retries, no energy (#51) |

### 3.3 What is free (always full rewards, at 0 energy too)

- The **first clear** of a stage (any difficulty) and every **new medal** (a difficulty not yet cleared there).
- A **new ribbon** of a battle mode on a stage (Q9).
- The **first Victory at each Titan Trials step** (solo; no key, even at 0 keys, §3.10).
- Bounty first clears and new medals cost **no Pass**.
- A freeplay run whose bank is a first clear or a new medal is rewarded with no charge (bounded: once per medal).
- Runs that never pay: Sandbox and practice runs. Free and rewardless.
- Tactical Challenge and the clan boss: free, normal payouts (Q16).

### 3.4 Bounty Passes

- **Name:** "Bounty Pass" (plural "Bounty Passes", short "Passes"), icon key `bounty_pass`. Not "tickets": the game
  already has Bounty Tokens (`token_bounty`), recruit tickets in the backpack's Tickets category, and `ticket_*` item
  icons (Q18). The counters keep the short prefix `bt:`.
- **6 a game day, saved up to 12.** At each 7 PM Central reset:
  `passes = max(passes, min(12, passes + 6 × daysPassed))`. The outer `max` keeps a grant above 12 (a future reward)
  from being taken away by a reset.
- **1 Pass per won Bounty run or per Bounty sweep**, on any arena, tier and difficulty. Taken at the win, like energy.
- First clears and new medals: no Pass.
- **0 Passes:** Bounty stays playable without rewards, exactly like Missions without energy.
- **Not buyable at launch** (Q6). `grantPasses()` exists for future rewards.
- Shown on the Bounty screens only: a Pass pill replaces the energy pill in the top bar of the Bounty hub and Bounty
  stage prep.
- **Data-only options** in `src/data/energy.js` (off by default, Q6): `PASSES.freeTiers: [1]` (tier I runs use no Pass)
  and `PASSES.perDay: 8, cap: 16`.

### 3.5 The Rewards switch

- **Where:** stage prep (Missions, Bounty, Total Assault, event stages), the Continue footer of a saved battle, and your
  own card in the co-op room. Its label is **"Battle rewards"**: it is about the battle; sweeps carry their own cost
  (§3.6).
- **Shown only on a run that would cost something** (a paid replay). Hidden on free runs (first clear, new medal, new
  ribbon) and on runs that never pay (Tactical Challenge, Sandbox).
- **On** (default): the run pays its rewards and costs energy or a Pass on a win.
- **Off:** the win costs nothing and pays no drops, coins or event currency. What still counts and what doesn't:

  | Still counts on an `off` or `short` run | Never moves on an `off` or `short` run |
  |---|---|
  | clears and best waves (a replay earns no new medal anyway), the bestiary, `stats`, account level, commissions (`battleWin`, `battleWinHard`, `kill`, `bossKill`), achievements (`countSoloBattle`), one-time freeplay milestones | drops and coins, the loss consolation, the Celestial pity (`pity:cel`, `celestialRun`), the freeplay weekly Needle (`freeplayWeekNeedle`), the freeplay Tome week count (`fpTome:`, `freeplayCacheTomes`), event missions that pay currency (`trackEvent` for `eventClear`, `eventBoss`, `eventKill`), the weekly double-drop multiplier |

  Event first clears are progress runs (free), so `eventStage` missions keep counting. Halloween costs nothing, so its
  runs are never `off` because of energy.
- **Forced off** when you can't pay: locked, with one line ("Not enough energy · ⚡ 10 a win") and a Refill button
  (Passes: the time until 7 PM Central). After a refill makes the run payable, a **forced-off** switch unlocks and turns
  On by itself; a switch the player turned off stays off.
- **Resets to On** every time stage prep opens (Q7), so a forgotten switch never eats a good run. Retry and Restart keep
  the run's setting. **A saved battle keeps its own setting** (§3.8). It travels as the battle route param `rewards=0`,
  which can only turn rewards off.
- Use: practising a stage, trying a team, playing for fun, or saving energy for something else.

### 3.6 Sweeps, energy and the event sweep cap

| Stage | Sweep unlocks (unchanged) | Each sweep costs | Most per tap |
|---|---|---|---|
| Mission | Hard or Nightmare medal | the Mission cost | `min(10, floor(energy / cost))` |
| Total Assault | Hard or Nightmare medal | 30 energy | `min(10, floor(energy / 30))` |
| Bounty | Hard or Nightmare medal | 1 Pass | `min(10, passes)` |
| Titan Trials | a solo Victory | 1 Trial Key | 1 (unchanged) |
| Halloween 2026 operation | first clear, while open | **nothing** | `min(10, event sweeps left today)` (10 a day, #115) |
| Future event operation | first clear, while open | its energy cost | `min(10, floor(energy / cost))`, and the event's own daily cap if it sets one |

- **Every sweep button carries its own cost:** "Sweep · ⚡ 10", "Sweep ×3 · ⚡ 30", "Sweep ×6 · 🎫 6". The cost is what
  the tap spends, whatever the Rewards switch says.
- **Sweep ×N (N ≥ 2) takes two taps**, the same rule as the Refill button (#55): the first tap arms it and shows the
  before → after line ("Tap again · ⚡ 120 → 90"); the second spends. An armed button disarms after 4 s or on any other
  tap. "Sweep" (one run) is one tap.
- The **sweep rewards sheet** shows what was spent ("⚡ −30", "🎫 −3"). Its **"Sweep again"** button carries its cost
  ("Sweep again ×3 · ⚡ 30") and is hidden when nothing more is affordable; Refill (energy) or the Pass countdown takes
  its place.
- A sweep with nothing affordable is disabled with its reason ("Not enough energy · ⚡ 10 a sweep"). Partial payment is
  never allowed: 7 energy can't pay a 10-cost sweep. (Otherwise one leftover point would pay for unlimited runs.)
- Sweeps still count for commissions (`sweep`, `assaultClear`), clears and the Celestial pity, as today.
- **The event cap and energy are independent.** For an event without energy (Halloween) the cap is the limit; for an
  event with energy, energy is the limit and a cap applies only if its data sets `sweepsPerDay` (Q12). The cap stays in
  `missions.counters` (`evsw:` / `evswd:`), unchanged.

### 3.7 Co-op

- **Campaign stages only.** `planRun(…, { run: 'coop' })` returns `never` for any stage not in `CAMPAIGN_IDS`, and
  `coop.js` uses `defaultStage(profile)` for a host's `stage` route param outside `coopStages()` (today it accepts any
  non-event stage, so a hand-edited link such as `stage=res-books-3&difficulty=nightmare` would pay Library III
  Nightmare drops with no Pass or medal check). Neither file is hashed.
- **Each player pays their own** energy at their own win, from their own save. The ally is never affected. Energy never
  crosses the network: no new message, no new field, no change to the loadout, the sim or the co-op ids.
- **No energy? Join anyway.** A player who can't pay can create, join, Ready and play. Their own run gives no rewards; the
  ally's run is normal.
- **Your own Rewards switch** sits under your own card in the room, with your cost ("⚡ 10 on win", "No rewards"). It is
  not shown to the ally (that would need a protocol field).
- **Ready is consent, so a stage or difficulty change takes it back.** Today `session.js` clears the guest's Ready only
  when the freeplay setting or the mode changes (`adoptFreeplay`); `setStage` changes the stage and difficulty without
  touching Ready, so a host could move a Ready guest from 1-1 (⚡ 5) to 8-5 Hard (⚡ 10) and start. The fix, with no
  message change:
  - **Guest:** when the room's `stageId` or `difficulty` changes (from a `room` message or a host hello) and `me.ready`
    is set, set `me.ready = false` and send the existing `ready` message. Toast: "The host picked 8-5 Hard (⚡ 10 on win).
    Tap Ready again".
  - **Host:** `setStage` marks the peer not ready (`s.peer.ready = false`) when the stage or difficulty changes, and
    `canStart` also waits `LOBBY.stageSettleMs` (1.5 s) after the change, so a `ready` or keepalive hello already in
    flight from before the change can't count.
  - `stageId` is **not** added to the `ready` message (that would be a protocol change).
- Co-op never awards medals or first clears (`applyCoopResult`), so a co-op run is always a paid replay or a run without
  rewards.
- **Disconnects:** a player who leaves or drops before the win is charged nothing. The one who stays is charged at their
  win.
- **Charged once.** The charge is part of the same once-only payout as the drops. Freeplay already has a session-level
  ledger (`freeplayLedger(session, ls.start.seed)`). A normal co-op win only has `applied` inside one results instance,
  and a resync rebuilds the battle screen (`hooks.restart`). Whether a resync can arrive after `ctx.ended` is not proven
  either way (a guest's `resync?` sent just before its battle finished is answered after it), so the normal co-op win's
  payout and charge also go through a session ledger, `coopResultLedger(session, ls.start.seed)`, the same way as
  `countCoopWin`'s once-per-battle key. A replayed result returns the first outcome and charges nothing.
- **Co-op freeplay:** charged at the bank (`applyCoopClear`), once per player.
- Co-op Titan Trials: keys and Together Chests as today.

### 3.8 Battle saves, Restart, Retry, Keep going

- **Battle save (Save & quit → Continue).** The switch **travels with the save**; costs are re-planned. The record gets
  an optional field `rewards: false`, written only when the run was started with the switch off. It is additive:
  `cleanBattleSaves` keeps unknown fields (`...rest`), and an older build ignores it (it charges nothing anyway). The
  Continue footer shows the saved switch with the plan at Continue time (the cost in the Continue label) and lets the
  player change it; the change is written to the record. Deleting a save costs nothing.
- **Restart** (pause) re-plans with the same switch. **Retry** on the results screen does too; if the next run would now
  go without rewards because energy ran out, Retry opens stage prep instead (so the Refill button is in view) with the
  toast "Out of energy: replays now give no rewards".
- **Keep going** (solo freeplay after a win): covered by the win's charge. After a win without rewards the Keep going
  block reads "Freeplay waves give no rewards this run".
- **The plan is re-made at the win** (before medals change), with the run's switch. In one tab it always matches the
  start plan: nothing can spend energy during a battle. It only differs when another tab spent the energy meanwhile;
  then the run pays as `short` with the note "Your energy was used elsewhere during this battle".
- **A saved event battle after its event.** At the win, an event stage whose event is settled (the `evs:` mark) or whose
  exchange has closed plans as `never` (no charge, no rewards). Continue on such a save shows "Event over: no rewards".
  The days between the stage close and the exchange close still pay by the start time (EVENT_SPEC §3.2, unchanged).

### 3.9 The run plan and the order of the payout

`planRun(profile, stageId, { difficulty, mode, run, rewards, now })` in `src/systems/rewards.js`. `run` is one of
`'solo' | 'coop' | 'freeplay' | 'challenge' | 'sandbox' | 'practice' | 'titan' | 'clanBoss'` (a tutorial replay is
`'solo'`). Decided in this order:

| `kind` | When | Pays | Costs |
|---|---|---|---|
| `never` | sandbox; practice (`isPracticeRun`) and the existing event gates; co-op on a stage outside `CAMPAIGN_IDS`; an event stage whose event is settled or whose exchange has closed | nothing | nothing |
| `free` | challenge, clan boss, titan (keys are handled by `titans.js`), a cost of 0 (Halloween 2026) | as today | nothing |
| `progress` | solo or freeplay, and a first clear, a new medal or a new ribbon (`reason`: `firstClear` · `newMedal` · `newRibbon`) | full | **nothing, even at 0** |
| `off` | rewards off | §3.5 | nothing |
| `paid` | rewards on and `have ≥ cost` | full | `cost` energy or Passes, at the win |
| `short` | rewards on and `have < cost` | like `off` | nothing |

Returns `{ kind, reason, currency: 'energy' | 'pass' | null, cost, have, max }`. The UI reads it for the Start label
and the switch; `applyBattleResult`, `applyCoopResult`, `applyCoopClear` and `sweep` re-make it and act on it.

**Order inside `applyBattleResult`** (results.js `apply()` catches an exception and still saves, so the charge must
never come before something that can throw):
1. The sandbox, practice and event gates, unchanged and first.
2. `planRun` at the win, **before the medals change**.
3. Bestiary and `stats` (always).
4. On a win: the medal, clears, ribbon and best-wave records (always; a replay earns no new medal anyway).
5. If the plan pays (`progress` or `paid`): medal gems, first-clear items, unit unlocks, `rollStageDrops` →
   `splitDrops` (gear is added here), `celestialRun`, the event missions, then `addItems`. If it is `off` or `short`:
   none of these (§3.5).
6. Missions and achievements tracking (always).
7. **Last:** on a `paid` plan, `chargeEnergy` / `chargePasses`. Nothing between step 2 and step 7 touches `en:*` or
   `bt:*`, so the charge planned in step 2 always succeeds (a dev-build assert). A throw anywhere before step 7 means no
   charge; gear already added in step 5 stays (the failure favours the player).

`sweep()` works the same way: validate, work out `n` from energy, Passes and the event cap, roll every run, `addItems`,
then charge `n × cost` once. A thrown error means no charge. The freeplay end, `applyCoopResult` and `applyCoopClear`
also charge last.

### 3.10 Titan Trials

Today `applyTitanResult` returns `practice` when `keysLeft < 1` before it knows whether the run was a Victory, so a
first-clear Victory at 0 keys pays nothing. The rule now:
- A **solo Victory at a step with no `tfc:<titan>:<step>` mark** pays in full (the damage table, the Victory Chest and
  the first-clear rewards) and **spends no key, even at 0 keys**. `tatt` still counts the attempt (it seeds the drops).
- Bronze, Silver and Gold at that step still spend a key, or count as practice at 0 keys.
- A repeat Victory spends a key. A co-op Victory works as today (one key; Together Chest).
- The titans screen at 0 keys on an open step not yet won: the fight button reads **"Fight · first clear free"**.

---

## 4. Numbers and why

### 4.1 Reward runs per day for a free player

Today every stage pays without limit (the only caps are the Halloween event's 10 sweeps a day and Titan Trials' 12 keys
a week). There is no play telemetry, so the comparison is against today's design limits; §11 measures real use from day
one.

| A day's reward runs | Today | Energy update, Lv ≤ 20 (120 ⚡) | Lv 60+ (160 ⚡) | + one 50-gem refill |
|---|---|---|---|---|
| Chapter 7–8 Mission sweeps (⚡ 10) | unlimited | **12** | 16 | +12 |
| Chapter 1–2 Mission sweeps (⚡ 5) | unlimited | 24 | 32 | +24 |
| Total Assault (⚡ 30), instead of Missions | unlimited | 4 | 5 | +4 |
| Bounty (Passes) | unlimited | **6** (12 after a day away) | 6 | – |
| Halloween sweeps | 10 | 10 (no energy) | 10 | – |
| Titan Trials | 12 keys a week | same (first Victories free) | same | – |
| First clears, new medals, new ribbons | free | free | free | – |
| Tactical Challenge, Sandbox | free | free | free | – |

So an active free player gets about **18–30 reward runs a day** (6 Bounty + 12–24 Missions or a Total Assault mix) on
top of first clears and Titan keys. A 50-gem refill adds 12–24 more.

### 4.2 Akashic Tomes and coins: where the 6 Passes go

The 6 Passes are shared by 5 arenas that each feed a different need (books and Tomes, coins, gear and the Celestial
pity, and two material families): 1.2 runs per arena per day. The late game farms tier III, so the real choice is
**Library Courtyard III Nightmare** (Akashic Tome 20%) against **Market Canal III Nightmare** (≈ 39k coins a run:
18k–28k, +8k–12k at 30%, ×1.5 on Nightmare). A Tome pays one level above 60; a level above 60 also costs 12k coins.

| Weekly Tome source | All 6 Passes to Library III | 3 Library / 3 Market |
|---|---|---|
| Library Courtyard III Nightmare (20% a run) | 6 × 0.2 × 7 = **8.4** | 4.2 |
| Freeplay caches (cap, solo and co-op together) | 2 | 2 |
| Bounty Exchange `bty_book_tome` (40 Bounty Tokens each; 6 tier III runs a day give ≈ 147 tokens a week) | 2 | 2 |
| Boss Exchange Titan shelf `ts_tome` (30 Assault Tokens each) | 2 | 2 |
| Memento Exchange `mem_tome` (20 Mementos each, from spare duplicates) | 2 | 2 |
| **Total without Titan Trials** | **≈ 16–17** | **≈ 12** |
| Titan Trials, 12 keys (Nightmare 20%, Mayhem 30% a counted fight, scaled by the share below Victory) | up to +2.4 (Nightmare) / +3.6 (Mayhem) | same |

| Coins a day (not counting Titan Trials, which pay 60k a Nightmare fight) | All 6 to Library III | 3 / 3 |
|---|---|---|
| 12 chapter-8 Nightmare sweeps (≈ 3.6k each) | ≈ 43k | ≈ 43k |
| Market Canal III Nightmare | – | 3 × 39k ≈ 117k |
| Commissions and the rest | ≈ 5–10k | ≈ 5–10k |
| **Total** | **≈ 55k** | **≈ 170k** |

- **The trade-off for the owner (Q6):** all-Library gives about 16–17 Tomes a week and 55k coins a day; a 3 / 3 split
  gives about 12 Tomes and 170k coins. Tomes bind in both: 55k coins a day already pays more than 4 levels above 60,
  and the Tome supply pays about 2. The Ascension pace model (`tools/ascensionPace.mjs`, ASCENSION §E.1) assumes a base
  of 395k coins a week, about the all-Library number, and "Tomes never bind"; the build re-runs it with the split as an
  input (M4_ENERGY_PLAN E4). If the free player's level-85 dates slip by more than two weeks, the fix is a data edit
  (the Library III Nightmare Tome chance, Passes a day, or `PASSES.freeTiers`), raised with the owner.
- **Early and mid players feel Passes most.** A tier I or II player gets fewer Bounty runs than today (unlimited) and
  than the Oct 13 spec (12 tier I runs a day), and every "where to earn coins" link points at Bounty (`mall.js`
  `CURRENCY_ROUTE.coins`). The default stays the owner's 6 a day, saved up to 12; the data-only options in §3.4 are
  there if the log (§11) shows players short.
- **Weekly fixed income stays reachable under energy.** The F2P income model (`f2pIncomeSummary`) counts the General
  ticket (40,000 coins a week) and the Boss Exchange ticket (60 Assault Tokens a week). Coins: 55k a day covers it.
  Assault Tokens: Titan Trials alone pay 10–25 a fight (120+ a week from 12 keys), and Total Assault drops 4–9 a run.
- **Commissions fit easily.** Daily: Patrol Duty (win 3) + Elite Training (one Hard win or sweep) = 3 sweeps, ≤ 30
  energy or 3 Passes. Weekly: 20 wins and Club Day's 10 wins come from the same daily sweeps; Rainbow Hunt (3 Total
  Assault or Titan wins) comes from Titan keys.

### 4.3 Gem refills

Free gem income is ≈ 6,800 per 28 days ≈ **243 a day** (`docs/ECONOMY.md` §3). The first refill (50) is about 20% of a
day's gems (0.4 of a recruit at 120); three refills (300 gems) cost more than a day's income. That makes a daily refill
a real choice against recruiting, not a must-buy. Ten refills in a day cost 2,250 gems (≈ 9 days of income), a ceiling
for big savers.

### 4.4 Max growth

Account XP to go up from a level is `60 + 30 × level` (`accountXpForLevel`), so the totals are Lv 20 = 6,840 XP, Lv 40 =
25,740 and Lv 60 = 56,640. A new player reaches 20 around chapters 3–4; a player who has finished the campaign is roughly
Lv 35–45 (estimate: medals, clears, wins, pulls, girl levels and awakenings). Lv 60 is months of play. +40 at the cap is
a 33% bonus: noticeable, never needed.

Runs without rewards still add account XP (wins ×8, battles ×2, clears ×2 up to a stage's cap), about 10 XP a win, so a
player at 0 energy could grind rewardless wins toward a higher max. That is accepted: it is capped at +40 and takes about
5,000 wins (§6). Excluding those wins would need a separate counter.

### 4.5 Costs

- **Mission costs by chapter** (5 → 10) roughly follow the coin drop (chapter 1 ≈ 1,000 → chapter 8 ≈ 2,400 a win).
- **Total Assault at 30** (4 a day): its tables carry crowns, Mythic and Legendary boxes and Star Fragments, and solo
  Hard or Nightmare runs feed the Celestial pity (40 runs → 10 days at 4 a day).
- **Free ribbons (Q9):** Elective Path (#52) opens every mode after one clear, so each campaign stage has 19 ribbons
  (5 modes × 4 difficulties, less Nightmare × Last Petal, which comes with the medal): about **760 free runs** over the
  40 stages, each paying at most the best Standard medal. For existing players that is weeks of energy's worth, once.
  Data-only option: a free ribbon run pays drops at most at Normal.
- **Freeplay (Q11):** one charge (⚡ 5–10) covers an unlimited run: solo freeplay coins per wave are capped at the
  stage's own normal coins per wave (up to about 80% of normal coins per minute), plus a drop cache every 25 freeplay
  waves (materials uncapped; Tomes 2 a week). Under energy that makes freeplay the best use of one charge. Data-only
  option: caches after the first 2 in a run each cost the stage's cost when it is affordable (otherwise the cache pays
  coins only). The log records freeplay waves and caches a day.

All of these are constants in `src/data/energy.js`, outside the co-op data hash, so a balance change is one data edit
with no co-op split.

---

## 5. Save, migration, old builds and the clock

### 5.1 Where it lives

All state is numbers in `profile.missions.counters`, which `cleanMissions` → `cleanNumberMap` keeps word for word in
every build (the pattern Titan keys, the event sweep cap and the gear marks already use). No `SAVE_VERSION` bump.

| Key | Meaning |
|---|---|
| `en:v` | energy now (integer, 0…999) |
| `en:d` | `gameDayNumber` of the last daily refill |
| `en:lv` | highest account level seen (for the max) |
| `en:bn`, `en:bd` | gem refills bought, and the game day they count for |
| `en:t` | ms of the last regen tick (only while regen is on) |
| `bt:v`, `bt:d` | Bounty Passes now (0…12, more only from grants), and the game day of the last grant |
| `rs:v`, `rs:du`, `rs:wu` | the reset-clock switch-over (§8.2): scheme 1, legacy day until (ms), legacy week until (ms) |

Battle saves get the optional `rewards: false` (§3.8). The analytics log (§11) is a separate block,
`profile.energyLog`: non-critical, so an older build dropping it loses only stats.

### 5.2 Migration ("start full")

- **New saves** (`createProfile`) and **existing saves** (no `en:d`) get, on their first `syncEnergy`: `en:v = max` for
  their level, `bt:v = 12`, `en:d = bt:d = gameDayNumber(now)`, `en:lv = level`, `en:bn = 0`.
- `RESET67` makes a fresh save, so it starts full too.
- Export and import carry the counters.
- `cleanEnergyCounters(c)` (called from `migrateProfile` after `cleanMissions`) clamps: `en:v` to 0…999, `bt:v` to 0…99,
  integer day numbers, `en:bn` to 0…10; a missing key stays missing (so it reads as "start full").

### 5.3 Older builds and rollback

- **An open tab from before the update** keeps the counters and ignores them: it plays and sweeps without energy until it
  reloads. That is accepted, as with the event sweep cap. It can't refill energy, because it never writes the `en:*`
  keys. Cache-busted deploys and the update check (`e2e/update-check.mjs`) move players on.
- **Rollback.** A revert ships as a new commit (never a history rewrite). Reverting the clock milestone (E1) after it
  ships changes what `missions.day` means again (game day back to device day), so a player can get **one extra daily
  claim** on the day of the revert; that is accepted. The alternative is a forward fix. Reverting energy leaves the
  counters in saves; the reverted build ignores them, and a later re-ship refills once (the stored day is older).

### 5.4 Clock

- **Device clock, corrected by the server.** The update check already fetches `version.json` with a cache-busting query
  every few minutes (`src/core/updates.js`). It now also reads the response's `Date` header and hands it to a new
  `src/core/trustedTime.js` (`noteServerTime(ms)`, `trustedNow()`, `resetNow()`). `resetNow()` returns the device clock,
  unless a server time is known this session and the device differs from it by **more than 2 h**; then it returns the
  server time (moved on by `performance.now()`). Every reset decision (`applyResets`, `syncEnergy`, `buyRefill`, the event
  sweep cap, Titan keys) reads `resetNow()`. Offline, or in dev and test builds (they have no `version.json`), the
  device clock is used as today.
- **The first reset pass of a session waits for the first update check** (at most 3 s; offline or failed → the device
  clock), so a wrong device clock never grants first and gets corrected after.
- **Re-base.** If a stored period stamp is **later than the trusted period** (the device once showed a future date: a
  wrong year, a manual date), `rebaseStamps(profile, now)` (in `src/systems/resets.js`) moves it back to the trusted
  period **without a grant**. Today such a phone gets no energy, Passes or gem-ladder reset until that future date comes,
  and E1 would move commissions, the login gift and Mall stock onto the same forward-only rule (today `onAppStart` uses
  `!==` and recovers on its own). The stamps: `en:d`, `en:bd`, `bt:d`, `evswd:*`, `tk:week`, `tk:togwk`, `shopwk:asc`,
  the Workbench week, the event daily mission day and, after E1, `missions.day` / `missions.week`, `login.lastDay` and the
  Mall's day and week. A unit test checks every stamp in the list.
- Refills, Pass grants and the refill price reset fire only when the stored game day is **behind** the current one
  (forward only).
- **Clock set back:** online, the server time takes over and resets fire on time. Offline: nothing refills until real
  time passes the stored day.
- **Clock set forward to borrow tomorrow's cheap refills:** online, closed (the server time is used). Offline it still
  works once per trick, and the re-base then removes the wait instead of making the player sit it out. That is accepted:
  offline the device is trusted, like the save itself (#35).
- The local-time hint ("9:00 AM your time", `localResetHint`) shows next to every 7 PM label.

---

## 6. Anti-exploit edges

| Edge | Rule |
|---|---|
| Lose, Quit, Restart, close the tab, crash | Nothing is taken before the win, so there is nothing to refund |
| A payout step throws | The charge is the last step (§3.9); a throw means no charge |
| Co-op disconnect or leave before the win | Nothing charged; the player who stays is charged at their own win |
| Co-op resync or rejoin replays the result | The payout and charge sit in a session ledger keyed by the start seed (§3.7), never twice |
| Host changes the stage after the guest's Ready | The guest's Ready is taken back on both sides (§3.7) |
| Hand-edited co-op link to a Bounty, Total Assault or event stage | `never`, and `coop.js` falls back to `defaultStage` (§3.7) |
| Keep 1 energy and replay forever | No partial payment: `have ≥ cost` or no rewards |
| Sweep with less than a full cost | Same: sweeps take `floor(have / cost)` runs, at least 1 or the button is off |
| One tap spends a whole day | Sweep ×N takes two taps and shows "⚡ 120 → 90" first (§3.6) |
| Many saved battles started while rich, finished while poor | Continue and the win re-plan; the win only pays if it can charge |
| Rewards Off, Save & quit, Continue | The switch travels with the save (§3.8) |
| Two tabs | Each tab re-plans at the win from its own profile; the store's stale-tab check ("The game was played in another tab, so these rewards were not saved here") still guards the write |
| Device clock in the future, then corrected | Re-base without a grant (§5.4) |
| Clock moved forward to borrow cheap refills | Online: the server time is used. Offline: accepted (#35) |
| Double tap on Refill | Two-tap cost button (#55), then one synchronous buy; the price is read inside the buy |
| Refill at 900 energy | Fails with `'full'` (900 + 120 > 999) |
| Deep link to a locked stage | Practice, pays nothing (unchanged) |
| Deep link with `rewards=1` | The param can only turn rewards **off**; on still needs energy |
| `addItems`, mail or a code with `energy` or `bounty_pass` | Rejected: neither is an item |
| A change to the account XP formula | Max uses the highest level seen (`en:lv`); energy above max is kept |
| Rewardless wins raise the max (≈ 10 account XP each) | Accepted: capped at +40, about 5,000 wins; not a bug |
| Older build tab | §5.3: it can't refill; it plays free until it reloads (accepted) |
| Editing the save on the device | Out of scope: energy has the same trust as coins (#35) |
| Freeplay as a free farm without energy | A rewardless freeplay run pays no waves, caches, Tomes, Needle or tokens (Q11) |
| Rewardless runs advance the Celestial pity | Never: `off` and `short` runs don't call `celestialRun` (§3.5). 41 rewardless Total Assault Hard wins leave `pity:cel` unchanged |
| Rewardless runs pay event currency through event missions | Never: no `eventClear`, `eventBoss` or `eventKill` on `off` and `short` runs (§3.5) |
| Deliberate losses for the consolation | Losses of replays pay nothing (Q15) |
| Mode ribbons as free farming | One free run per ribbon (19 per stage), paid at most at the best medal; then paid like Standard (Q9) |

---

## 7. Interactions with other content

- **Halloween 2026** (stages open until Nov 1, exchange until Nov 8): energy cost 0; its 10 sweeps a day stay. If energy
  ships while it runs, nothing about it changes.
- **Future events** (the beach event and later): each event's stage costs go in `ENERGY_COST.events[eventId]` in
  `src/data/energy.js`, never on the stage defs (they are in the co-op data hash). The beach event takes EVENT_SPEC E7's
  numbers (operations 10 / 10 / 12 / 12 / 15, boss 20) into that table when it is built, and its mission and exchange
  math uses "currency per energy" (EVENT_SPEC §3.13 already sizes it that way); rewardless runs paying no event currency
  (§3.5) keeps that sizing true. The `tuneLike` fallback is only a safety net for an event that forgets its row.
- **Titan Trials** (`src/systems/titans.js`): no energy; first Victories free (§3.10).
- **Battle modes** (CODEX_MODES): same cost as Standard; a new ribbon is free (Q9).
- **Ascension, Potential, gear:** untouched; their pacing changes only through how many reward runs a day there are
  (§4.2).
- **The gate arc's Act II stages** (x-6…x-10), when they land: Mission costs by chapter apply as they are; chapters past
  8 use the chapter 8 cost until set.
- **Clan boss, Starfall Trial, Daily Drill, Rival Run:** no energy.

---

## 8. The reset clock

### 8.1 What is built

`src/core/reset.js` has the clock: `RESET`, `chicagoParts` (with the US-rule fallback `chicagoOffsetFallback`),
`gameDay`, `gameDayNumber`, `gameWeek`, `gameWeekNumber`, `nextDailyReset`, `nextWeeklyReset`, `gameDayStart` /
`gameDayEnd`, `isNewPeriod`, `formatCountdown`, `localResetHint`. Already on 7 PM Central: limited events
(`systems/events.js`, including the event sweep cap), Titan keys and Together Chests (`systems/titans.js`), the
Workbench (`systems/craft.js`), the Ascension Mall shelf (`shop.js` `shopwk:asc`), clan invites and donations, and the
social SQL (`game_day_key`, `next_game_reset`). The vectors are in Appendix A.

### 8.2 What is left (milestone E1)

Still on **device midnight / device Monday** (`src/core/util.js` `dayKey` / `weekKey`) on `9af220e`:
- `src/systems/missions.js` `onAppStart` (daily and weekly commissions, the login event; it uses `!==`, so a clock set
  back also resets), `loginState` / `claimLogin`, `currentEvent` (the weekly double-drop arena);
- `src/systems/shop.js` `refreshShop` (daily and weekly Mall stock);
- `src/online/coop/rewards.js` `freeplayCacheTomes` / `freeplayTomeLine` (`fpTome:` + `weekKey`);
- `src/ui/countdown.js` `msToLocalMidnight` / `msToLocalWeekEnd`, which the M5 countdown chips call from
  `commissions.js`, `mall.js`, `rewards.js`, `lobby.js`, `missions.js`, `bounty.js` and `hubStates.js` (`bountyState`);
- `src/online/clanRules.js` `weekKey` (UTC week; matches Sunday 7 PM CDT, one hour off in winter: Q17).

**The switch-over** rule from the Oct 13 spec stands: a save finishes its current day and week on the old clock, then
follows 7 PM Central. No double claim, no lost day (the switch day is 12–38 h long), no skipped weekly event (Appendix
A.2). The state lives in the counters `rs:v` / `rs:du` / `rs:wu` (not a `profile.resets` block). `reset.js` gains
`LOCAL`, `fixedOffsetLocal`, `legacyDayKey`, `legacyWeekKey`, `periodKeys(rs, t)` and `nextPeriodChange(rs, t, kind)`;
`util.js` `dayKey` / `weekKey` become deprecated aliases of `gameDay` / `gameWeek`. Every reset goes through
`isNewPeriod` (forward only), with the re-base of §5.4.

**The countdown chips without touching their callers.** E1 changes only the bodies of `countdown.js`:
- `msToLocalMidnight(now)` returns the time to the save's next daily reset: `nextPeriodChange(source(), now, 'day')`,
  where `source` is set once by `startResetClock` through a new `setPeriodSource(fn)` (no source: `nextDailyReset`).
- `msToLocalWeekEnd(now)` returns `nextWeeklyReset(now) − now` (the global game week: the event rotation, Titan Trials,
  the shelves).
- New names `msToDailyReset` / `msToWeeklyReset` are added; the old names stay as wrappers until the M5 sweep renames the
  callers. `commissions.js` (free since M5b) passes the save's switch-over week for the weekly commissions chip; the
  Mall's weekly chip may read up to a day early during a save's one switch-over week (accepted).

`applyResets(profile, now)` (new `src/systems/resets.js`) runs the switch-over, the re-base, `onAppStart`,
`refreshShop`, `syncEnergy` and `settleEvents`, and is idempotent. `startResetClock(store)` (new
`src/ui/resetClock.js`) fires it at the next reset (and on `visibilitychange`), so pills and chips change at 7 PM without
a reload.

**The clan boss SQL** (Appendix B) moves the clan boss week and its 3 hits a day onto the game clock. It is a live
database change, so it needs the owner's yes, and it is **not** part of this update by default (Q17). Since this update
ships after Nov 1, the clan week will flip at Sunday 6 PM CST while every other weekly reset flips at 7 PM; in summer the
two match.

---

## 9. UI touchpoints

All of this uses the M0 tokens and the M5a kit (`src/ui/kit.js`: `chip`, `sticker`, `statStrip`, `countdownChip`,
`iconBtn`, `ghostBtn`, `inkBtn`; `src/ui/badges.js`). One yellow primary per screen; nothing under 12 px; numbers in the
shared `fmtNum`; every timer is a `countdownChip` with `urgent: false` (a daily reset is a recurring cycle, M5a review).

**Number budget (stated once for this update):** at most **12 visible numbers per screen, not counting the shared top
bar** (currencies, the energy or Pass pill), and **counting** the cost in the Start label and the sweep costs. The probe
(`e2e/probe.mjs`) runs with that rule at 844×390, 1280×720 and 390×844 portrait.

### 9.1 Top bar energy pill

- `currencyPills()` in `src/ui/components.js` gets an energy pill **first**: the bolt icon, "87/120", and a "+" that
  opens the energy sheet. Tapping the pill opens the same sheet. `data-testid="energy"`, "+" = `energy-plus`.
- Under 900 px wide the "/120" hides (the number alone). At 1280 a `countdownChip` "3h 12m" follows the pill while energy
  is below max.
- The number turns `--bad-on-plate` below the cheapest cost you can pay (< 5).
- **Above max** ("240"): the number takes the accent colour and there is no countdown chip.
- **A level-up raises the max:** toast "Max energy 121 (+1 · fills at 7 PM)".
- **Lobby** (`buildTop` in `src/ui/screens/lobby.js`): the same pill, plus the countdown chip whenever below max. It
  lands after M5d's lobby layout (M4_ENERGY_PLAN §2.1).
- **Bounty hub and Bounty stage prep:** the Pass pill replaces the energy pill ("🎫 6/12"; tap: the Pass sheet).
- The e2e checks that the pills never overlap the title or the right-hand buttons and that the top bar never scrolls
  sideways, at 844×390 and 390×844.

### 9.2 The energy sheet (one sheet for info and refills)

A bottom sheet (UI_DIRECTION 5.4), `data-testid="energy-sheet"`:
- Plate header "Energy" and a 44 px close.
- The big balance "87 / 120" and a `countdownChip` "Refills in 3h 12m" (with the local-time hint as its title).
- One line: "Pays for rewards from replays and sweeps, only when you win." An "i" opens the rules (what's free, the costs
  in short, the max: "Max +1 per Sensei level after 20 · yours 132 · up to 160").
- **The price ladder:** 10 pips for today's refills, bought ones filled, the next one marked with its price.
- **The cost button** (5.5: ink plate, yellow number): "Refill +120 · 💎 100". Two taps: the first arms it ("Tap again ·
  💎 100"), the second buys. `data-testid="energy-refill"`.
- **States:**
  - not enough gems: "Need 💎 100" and a ghost "Get gems" that goes to **Commissions** (the Mall's own earn route for gems,
    `CURRENCY_ROUTE.gems`), not the Mall's gem tab;
  - 10 bought: "10/10 today · back to 💎 50 at 7 PM Central" + countdown;
  - would pass 999: "Energy is nearly full" (the buy fails with `'full'`);
  - **above max:** "Above max: the 7 PM refill adds nothing until you're under 120";
  - **the free refill is under 1 h away:** the first tap warns "Free refill in 20m · tap again to buy";
  - **a max raised today:** "Max 121 today (+1) · fills at 7 PM";
  - **the refill could not be saved** (storage full, saving paused or another tab): the same save-failed line as the
    results screen.
- After a buy: the pill counts up, a toast "+120 energy". In stage prep a forced-off switch unlocks and turns On.

The **Pass sheet** (`data-testid="pass-sheet"`): "Bounty Passes 6/12", countdown chip "+6 in 3h 12m", "One per Bounty
win or sweep. First clears are free. Up to 12 are saved."

### 9.3 Stage prep (with M4, `src/ui/screens/stage.js`)

There is **no separate energy row.** The M4 footer (M4_ENERGY_PLAN M4a) has two rows:
- **Upper row (secondary):** the Mode chip, then "Sweep · ⚡ 10" and "Sweep ×3 · ⚡ 30" when sweep is unlocked (else one
  line, "Sweep: clear on Hard"). In the `short` state one line "Not enough energy · ⚡ 10 a win" and a ghost "Refill" take
  the sweeps' place (the balance is already on the pill, so it is not repeated).
- **Lower row (primary):** the **Rewards toggle** (44 px, slanted, white glass Off / ink On, keyboard operable, never
  yellow; `rewards-switch`) and **Start** with the cost in its label (`stage-start`).

| Plan | Start label | Rewards toggle |
|---|---|---|
| `progress` · firstClear | "Start · Normal · Free" | hidden |
| `progress` · newMedal | "Start · Hard · Free" | hidden |
| `progress` · newRibbon | "Start · Hard · Rush · Free" | hidden |
| `paid` energy | "Start · Hard · ⚡ 10" (title "10 energy, only if you win") | On |
| `paid` Pass | "Start · Hard · 🎫 1" | On |
| `off` | "Start · No rewards" + pink sticker "Rewards off" | Off |
| `short` energy | "Start · No rewards" | Off, locked (lock icon; the reason is the upper row's line) |
| `short` Pass | "Start · No rewards" | Off, locked; the upper row reads "No Passes left" + countdown chip "+6 in 3h" |
| `free` / `never` | as today | hidden |

- M4a reserves the toggle's slot (44 × 44, empty) in the lower row, so the "no scroll at 844×390" check is measured with
  the final footer.
- **Sweeps:** §3.6 (costs on the buttons, two taps for ×N, the before → after line). `testid`s `sweep-1` / `sweep-10`
  stay. Halloween: "Sweep ×4 · 4 left today" as today.
- **Continue** (saved battle): "Continue · Wave 7/25 · ⚡ 10" with the saved switch next to it (§3.8).
- **Budget check** (UI_DIRECTION §6.3's cases, top bar not counted):
  - 4-3 fresh, Normal selected (a first clear, so free): the title (1), the strip (3), 4 unearned rewards, "3/3" (1) =
    **9**.
  - 2-3 with Easy to Hard cleared, Nightmare selected (a new medal, free): the title, the strip, 1 unearned reward, the
    rule line (1), "3/3", "Sweep · ⚡ 5" (1), "Sweep ×10 · ⚡ 50" (2) = **10**.
  - 2-3 with every medal, Nightmare selected (paid): the title, the strip, the rule line, "3/3", the two sweeps (3) and
    Start's "⚡ 5" (1) = **10**.

### 9.4 Bounty and Total Assault hubs (`bounty.js`, `assault.js`, as M5b left them)

Today each hub has one button, "Sweep ×10 · Nightmare" (`bounty.js` ~156, `assault.js` ~158), which under this spec
could spend 12 Passes or 120 energy in one tap. Now:
- **Bounty:** the Pass pill in the top bar; "Sweep · 🎫 1" and "Sweep ×6 · 🎫 6" (N ≤ Passes, two taps), or a disabled
  "No Passes left" with the countdown. The host line can say "6 Passes ready" (a new `bountyState` field in
  `hubStates.js` and a line appended to the Bounty table in `hostLines.js`).
- **Total Assault:** "Sweep · ⚡ 30" and "Sweep ×4 · ⚡ 120" (N ≤ energy ÷ 30, two taps); disabled "Not enough energy". The
  sweep button gets a `testid` (`assault-sweep`; today it has none).

### 9.5 Battle (`src/ui/battle/controller.js`)

- `ctx.energyPlan` is computed when the battle mounts (for display only). An `off` or `short` run shows one feed toast
  at the start: "Rewards off: no rewards this run" / "Out of energy: this run gives no rewards". A paid run shows nothing.
- No energy UI in the HUD (M2 owns the HUD; the budget stays 4 numbers).
- The battle-folder logic sits in a new `src/ui/battle/energy.js` (plan, start toast, restart re-plan, the `rewards=0`
  param), wired with one line each in `controller.js`, `setup.js` and `results.js` (M4_ENERGY_PLAN §4).

### 9.6 Results (with M4b, `src/ui/battle/results.js`)

- **Victory**, next to the medal: "⚡ −10" (`energy-spent`), or "Free · first clear", or "No rewards · Rewards off", or
  "No rewards · out of energy" + a countdown chip "Refills in 3h". A Pass run shows "🎫 −1".
- **Defeat** of a paid run: a calm line "No energy used". (Every loss proves that losing costs nothing.)
- **Freeplay** results: the energy line once, on the clear. The Keep going block after a rewardless win: "Freeplay waves
  give no rewards this run".
- Retry opens stage prep instead when the next run would go without rewards (§3.8).

### 9.7 Co-op room (`src/ui/screens/coop.js`)

Under **your own** card only: the cost and your Rewards switch ("⚡ 10 on win" · "No rewards"). With no energy: "Out of
energy: no rewards for you this run" and the switch locked. Ready and Start are never blocked by energy. When the host
changes the stage or difficulty, the guest's Ready clears with the toast of §3.7.

### 9.8 Words elsewhere

- **Patch note** (`src/data/patchNotes.js`): "Energy is here", "Bounty Passes", "The Rewards switch", "Every daily
  reset at 7 PM Central", "First clears are always free", plus the new stage prep and results.
- **Wiki** (`src/data/wiki.js`): a new "Energy & Bounty Passes" page; the "Daily routine" lines get the 7 PM time.
- **Captain's Journal** (`src/data/story/lessons.js`, `bounty` lesson, a third paragraph of ≤ 120 characters):
  "Replays use energy and Bounty uses Bounty Passes, both only on a win. First clears are always free!"
- `commissions` lesson, first paragraph: "… A new day starts at 7 PM Central."
- Copy that still says Monday: `rewards.js` "Events rotate every Monday" (after M5c), `lobby/notice.js` "The event
  rotates every Monday" → "every Sunday at 7 PM Central".
- `docs/ECONOMY.md` (Energy and Bounty Pass rows in the currency table; an Energy section), `CONTRACTS.md` §5.

---

## 10. Code

### 10.1 New files

| File | Contents |
|---|---|
| `src/data/energy.js` | `ENERGY` (`base` 120, `levelFrom` 20, `levelTo` 60, `hardCap` 999, `regenMinutes` 0, `refill: { amount: 120, prices: [50, 100, 150, 200, 250, 300], perDay: 10 }`), `PASSES` (`perDay` 6, `cap` 12, `cost` 1, `freeTiers` []), `ENERGY_COST` (`campaign` by chapter, `boss` 30, `events: { halloween: 0 }`, `eventBossMul` 2), the data-only options of §4.5 (off) |
| `src/systems/energy.js` | Imports only `core/reset.js`, `core/trustedTime.js`, `data/energy.js` and `systems/accountLevel.js` (so `save.js` can import it without a cycle). `energyMax(profile)`, `syncEnergy(profile, now)` → `{ refilled, passesAdded, started, maxRaised }`, `energyState(profile, now)` → `{ value, max, refillAt, bought, nextPrice, canBuy, passes, passCap, passesAt }`, `energyCost(stage, { difficulty, mode })` → `{ currency, cost }`, `chargeEnergy(profile, n)` / `chargePasses(profile, n)` (false when short; never partial), `buyRefill(profile, now)` → `{ ok, price, added, value } \| { ok: false, error: 'gems' \| 'limit' \| 'full' }`, `grantEnergy`, `grantPasses`, `cleanEnergyCounters` |
| `src/systems/accountLevel.js` | `accountLevel`, `accountXpForLevel`, `ACCOUNT_MAX_LEVEL`, moved from `src/ui/components.js` (which re-exports them, so `identity.js`, `profile.js`, `editProfile.js` and `tests/ui/ui-v2.test.js` keep working) |
| `src/systems/energyLog.js` | the analytics log (§11): `logRun`, `logSweep`, `logRefill`, `logReset`, `cleanEnergyLog`, `playStats(profile)` |
| `src/systems/resets.js` | `migrateResetScheme`, `rebaseStamps`, `applyResets`, `resetLabel` (§5.4, §8.2) |
| `src/core/trustedTime.js` | `noteServerTime`, `trustedNow`, `resetNow`, `clockReady` (§5.4) |
| `src/ui/energy.js` | `showEnergySheet()`, `showPassSheet()`, `energyPill()`, `passPill()`, `startLabel(plan, base)`, `rewardsSwitch(plan, onChange)`, `sweepButtons(stage, plan, opts)` (costs, two taps, before → after) |
| `src/ui/battle/energy.js` | the battle side: `battlePlan(ctx)`, the start toast, the restart re-plan, `rewardsParam(params)` |
| `src/ui/resetClock.js` | `startResetClock(store)` |

### 10.2 Edited

| File | Change |
|---|---|
| `src/systems/rewards.js` | new `planRun`, `sweepPlan(profile, stageId, difficulty, times, now)` → `{ n, each, currency, limitBy }`; `applyBattleResult(…, { now, eventAt, startedAt, rewards = true, run = 'solo' })` with the order of §3.9; returns `out.energy = { kind, reason, currency, cost, spent, left }`; `sweep` limits `n` by energy, Passes and the event cap, rolls first, charges last, returns `spent` |
| `src/systems/freeplayRewards.js` | the bank records `rewarded` (`progress` or `paid`); the end pays waves, caches, Tomes, the Needle and tokens only when `rewarded` (records and one-time milestones always) |
| `src/online/coop/rewards.js` | `applyCoopResult(profile, result, rng, { rewards = true, now })` and `applyCoopClear` re-plan (`run: 'coop'`), `never` off the campaign, charge last; `coopResultLedger(holder, seed)`; `rememberFreeplayRun` / `payPendingFreeplayRuns` carry `rewarded`; `fpTome:` moves to `gameWeek` (E1) |
| `src/online/coop/session.js` | the Ready rule of §3.7 (guest clears on a stage or difficulty change; host marks the peer not ready; `LOBBY.stageSettleMs`) |
| `src/systems/titans.js` | `applyTitanResult`: §3.10 |
| `src/systems/events.js` | `eventSweepsLeft` reads the event's `sweepsPerDay` (default: `EVENT_SWEEPS_PER_DAY` for an event without energy, none for one with energy); stamps through `resetNow()` |
| `src/systems/battleSave.js` | the optional `rewards: false` field (written by the saver, read by Continue) |
| `src/systems/inventory.js`, `src/systems/mail.js`, `src/systems/missions.js` (codes) | reject `energy` and `bounty_pass` |
| `src/systems/missions.js`, `src/systems/shop.js`, `src/core/util.js`, `src/core/reset.js`, `src/ui/countdown.js` | the reset clock (§8.2) |
| `src/core/updates.js` | read the `Date` header into `trustedTime.js` |
| `src/systems/save.js` | `migrateProfile`: `cleanEnergyCounters(p.missions.counters)`, `p.energyLog = cleanEnergyLog(raw.energyLog)`; `createProfile`: `energyLog` |
| `src/main.js` | `applyResets` instead of `onAppStart` + `settleEvents` (after the first update check, §5.4); `startResetClock(store)`; re-run on `'replace'` |
| `src/ui/components.js` | `currencyPills` (energy pill; a `currency: 'passes'` option), re-exports from `accountLevel.js` |
| `src/ui/screens/lobby.js` | `buildTop` pill + chip (after M5d) |
| `src/ui/screens/stage.js` | footer rows, Start states, sweep labels (after M4a) |
| `src/ui/screens/bounty.js`, `assault.js`, `src/ui/hubStates.js`, `src/ui/hostLines.js` | sweep limits, costs and two taps; the Pass pill and host line on Bounty |
| `src/ui/screens/titans.js` | "Fight · first clear free" at 0 keys |
| `src/ui/battle/setup.js`, `controller.js`, `results.js` | one wiring line each into `src/ui/battle/energy.js`; results energy lines and the Retry rule (after M4b) |
| `src/ui/screens/coop.js` | own-card line and switch; `defaultStage` for a stage param outside `coopStages()` |
| `src/ui/screens/settings.js` | About → "Copy play stats" (after M5c's Settings rail) |
| `src/art/icons.js`, `src/art/icons/items.js` | `SPECIAL_ITEMS.energy` (an original bolt in a rounded capsule with a sakura-pink rim) and `SPECIAL_ITEMS.bounty_pass` (an original pink pass with a star punch), in the 3D-flat item look, so `currencyIcon('energy')` / `('bounty_pass')` work |
| `src/data/wiki.js`, `src/data/story/lessons.js`, `src/data/patchNotes.js`, `src/ui/lobby/notice.js`, `docs/ECONOMY.md`, `CONTRACTS.md` | §9.8 |

---

## 11. Analytics (on the device)

There is no analytics system and no server stats table today, and #35 keeps the economy on the device. So:
- **`profile.energyLog`**: the last 28 game days, one row each: `d` (game day number), `max`, `leftAtReset` (energy still
  unspent when the day ended), `spent` and `spentSweeps`, `runs` by plan kind (`paid`, `progress`, `off`, `short`),
  `sweeps`, `passes` used and `passesLost` (a grant that hit the cap of 12), **the Pass split by arena and tier**,
  `refills` and `refillGems`, `firstShortAt` (minutes after the reset when energy first fell below the cheapest cost),
  `assault` runs, **freeplay waves and caches**, `rebased` (a clock re-base happened).
- **Settings → About → "Copy play stats"** copies `playStats(profile)` (that log plus level and max) as JSON, for testers
  to paste into chat.
- **What it answers:** do players run out (and when)? how much energy goes unused at reset? how many refills, at which
  price step? how often is the switch off? which arenas take the Passes? how much freeplay runs on one charge? how many
  Tomes a week really come in?
- **A server table** (aggregate stats from every player) would need new SQL on the live database and the owner's yes. It
  is **not** proposed (Q14).

---

## 12. Determinism, co-op and server

- Energy never enters `src/sim/**`. Plans are made in systems and UI code after `sim.result()`. Result rngs stay per
  player.
- `src/data/energy.js` is not imported by the co-op data hash (`version.js` hashes `UNITS, ENEMIES, STAGES, MAPS, BATTLE,
  DIFFICULTIES, TYPE_CHART, COOP, FREEPLAY, POTENTIAL_*, BATTLE_MODES`) nor by `tools/simId.mjs`'s entries. **No stage def
  changes.** The sim id and `COOP_PROTOCOL` stay what they are at branch time; a test asserts both.
- No network message, handshake field or loadout change (the Ready fix of §3.7 changes behaviour, not messages).
- **No server tables and no live-database SQL.** The only server change anywhere in this work is the optional clan-boss
  SQL (Appendix B), which needs the owner's yes and is left out by default (Q17). The trusted time reads a header of a
  file the game already fetches.

---

## 13. Tests

**Unit (vitest)**
- `tests/systems/energy.test.js`
  - EN-1 max: 120 at Lv 1–20, 140 at Lv 40, 160 at Lv 60 and 99; uses `en:lv` when the derived level is lower.
  - EN-2 the refill tops up at 7 PM Central (not device midnight), keeps 150 when max is 120, fires once on the 25 h
    (2026-11-01) and 23 h (2027-03-14) days.
  - EN-3 clock: set back → no refill until the stored day passes (offline); forward then back offline → one early
    refill; a 5-day jump → one refill.
  - **EN-3b** a stored `en:d` in 2027, then a correct trusted time: one re-base, no refill now, the next refill at
    7 PM, no lockout. A device 3 h off with a trusted time known: resets follow the trusted time.
  - EN-4 gem refill: prices 50…300 then 300; the 11th in a day fails `limit`; not enough gems fails `gems` and changes
    nothing; the count resets at 7 PM; +120 can pass max; **900 + 120 fails `full`** and changes nothing.
  - EN-5 Passes: +6 a day to 12; 3 days away → 12; set back → nothing.
  - **EN-5b** a grant to 15, then a reset: still 15 (`max(passes, min(12, passes + 6 × days))`).
  - EN-6 costs: every campaign stage > 0 by chapter; every `resource` stage costs 1 Pass; `boss` 30; `challenge` 0;
    Halloween stages 0; an unknown event stage = its `tuneLike` chapter cost (boss ×2); `PASSES.freeTiers: [1]` makes
    tier I cost 0.
  - EN-7 `cleanEnergyCounters`: negative, NaN and huge values clamp; a save without `en:d` starts full; `SAVE_VERSION`
    is still 2.
  - EN-8 regen config (injected `regenMinutes: 6`): +1 per 6 minutes up to max; the default adds nothing over 24 h.
  - EN-9 `addItems`, mail and codes reject `energy` and `bounty_pass`.
  - EN-10 a save written by this build, run through the shipped release's `cleanMissions` (copied into the test as a
    fixture from `main` at branch time), keeps every `en:*`, `bt:*` and `rs:*` key.
- `tests/systems/planRun.test.js`
  - PR-1 the matrix of §3.9 for every `run` value and both switch states, at 0 and at plenty.
  - PR-2 a new medal and a new ribbon are `progress` at 0 energy; a mode run on an earned ribbon is `paid`.
  - PR-3 `rewards: false` is `off` even on a paid stage; never `off` on a `progress` run.
  - PR-4 co-op on a `resource`, `boss` or event stage is `never`; a settled event's stage at the win is `never`.
- `tests/systems/energyRewards.test.js`
  - ER-1 a paid win charges once and pays full; a paid loss charges nothing and pays nothing (Q15); a first-clear
    attempt's loss keeps the 40-a-wave consolation.
  - ER-2 `off` and `short` wins pay no items, coins or event currency, but add clears, bestiary, stats, commission
    progress and achievement counters.
  - ER-3 with 9 energy and cost 10, 50 won replays add no items; with 120, at most 12 paid chapter 8 replays per game day.
  - ER-4 a plan made rich, then energy spent elsewhere: the win pays as `short` with the note.
  - ER-5 the existing practice, sandbox and event-gate tests still pass unchanged.
  - ER-6 sweep: ×10 with 35 energy and cost 10 → 3 runs, 30 spent; 0 → error `'energy'`; Bounty ×10 with 4 Passes → 4;
    Halloween sweeps spend no energy and still stop at 10 a day; the weekly 2× event still doubles.
  - **ER-7 charge last:** a stubbed drop table that throws leaves `en:v` and `bt:v` unchanged (battle and sweep).
  - **ER-8 hidden counters:** 41 `short` Total Assault Hard wins leave `pity:cel` unchanged; `off` freeplay leaves the
    Needle and `fpTome:` unchanged.
  - **ER-9 event missions:** `off` and `short` event runs add no `eventClear`, `eventBoss` or `eventKill` progress;
    event first clears still add `eventStage`.
  - **ER-10 battle save:** Off, Save & quit, Continue, win → 0 charged; Continue with the switch changed to On → charged.
  - ER-11 a saved event battle finished after the exchange closed: `never`, no charge.
- `tests/systems/freeplayEnergy.test.js`: a paid freeplay run charges once at the bank and pays the waves; a rewardless
  run pays no waves, caches, Tomes, Needle or tokens but keeps best waves and milestones; a pending run paid at app start
  keeps its flag; **a run whose bank is a new medal pays its waves with no charge**.
- `tests/online/coopEnergy.test.js`: per-player charge; the ally unchanged; a player at 0 plays and gets nothing; **a
  replayed result (resync after the win) charges once**; **a `resource` or `boss` stage in co-op pays nothing and
  charges nothing**; **the guest's Ready clears when the host changes the stage or difficulty, and `canStart` stays false
  for 1.5 s after**; `coopVersion().data` is identical before and after importing `src/data/energy.js`.
- `tests/systems/titans.test.js` (edited): **a 0-key first-clear Victory pays and `keysLeft` stays 0**; Gold at a new step
  spends one key; a repeat Victory and a co-op Victory use one.
- `tests/systems/accountLevel.test.js`: the moved function returns what `components.js` did (the `ui-v2` cases).
- `tests/systems/missions.test.js` F2P income: rerun with energy on; the 40,000-coin and 60-Assault-Token weekly tickets
  stay reachable under the §4.2 income; the assumptions are written in the test.
- `tests/systems/energyDay.test.js`: a scripted day, 12 chapter-8 sweeps, 6 Bounty sweeps (split 6 / 0 and 3 / 3), one
  refill, a reset; the run counts match §4.1 and the split matches §4.2.
- `tests/ui/energyUi.test.js`: `startLabel` / `rewardsSwitch` / `sweepButtons` for every plan state; sweep costs and the
  before → after line; the energy sheet states of §9.2 (above max, refill under 1 h before the free one, max raised,
  save failed, `'full'`); a forced-off switch turning On after a refill.
- Reset clock (E1): `tests/core/reset.test.js` R-1…R-7 (Appendix A) and **R-8** (`rebaseStamps` on every listed stamp:
  a 2027 stamp and a correct clock → one recovery, no grant, no lockout); `tests/systems/resets.test.js` M-1…M-5 with the
  switch-over state in counters; `tests/systems/missions.test.js` and `tests/ui/countdown.test.js` move to Chicago
  instants so they pass in any time zone (`TZ=UTC` and `TZ=Asia/Tokyo`).
- `node tools/simId.mjs` prints the same id before and after.

**E2E** (Playwright like `e2e/smoke.mjs`, at **844×390, 1280×720 and 390×844**; fake time with `page.addInitScript`
overriding `Date`, context `timezoneId: 'America/Chicago'`, the probe from `e2e/probe.mjs`)
- `e2e/energy.mjs` (new): a fresh save shows "120/120"; a cleared stage shows "Start · Hard · ⚡ 10" and the sweeps with
  their costs; Sweep ×N needs two taps and shows "⚡ 120 → 90" on the first; "Sweep again" is hidden at 0; the switch Off
  makes Start "Start · No rewards" and the win pays nothing; 0 energy locks the switch and shows Refill; after a refill
  the forced-off switch turns On (`short` → `paid`); the refill sheet buys with two taps at 50 then 100; the pill above
  max (no chip, accent); a mid-day level-up raises the max with its toast; Bounty spends a Pass and the pill shows 5/12;
  at 19:00:30 the pill refills without a reload; no overlap or sideways scroll in the top bar.
- `e2e/battle-save.mjs` (edited): Off → Save & quit → Continue shows the saved switch → the win charges 0.
- `e2e/codex-modes-coop.mjs` (edited, local mode): the host changes the stage after the guest's Ready; Start stays locked
  until the guest taps Ready again.
- `node e2e/smoke.mjs` (unchanged): a fresh 1-1 win is a first clear, so free, and its reward checks pass.
- `e2e/solo-freeplay.mjs`, `e2e/coop-freeplay.mjs`, `e2e/codex-modes.mjs`, `e2e/halloween.mjs`, `e2e/ascension.mjs`,
  `e2e/hubs.mjs`, `e2e/online.mjs` (local mode) pass.

---

## 14. Open questions (each default is in force until answered, #145)

1. **Regen:** daily only, or also +1 energy every few minutes? **Default: daily only**, a top-up to max at 7 PM Central;
   unused energy isn't added on top. (Regen is one constant if you want it.)
2. **Max energy:** 120, +1 per Sensei level from 21 to 60 (max 160)? Wins without rewards still give account XP, so they
   count toward it (about 5,000 wins for the full +40). **Default: yes.** The extra fills at the next refill.
3. **Gem refills:** +120 each at 50, 100, 150, 200, 250, 300, then 300, up to 10 a day? **Default: yes.**
4. **Costs:** Missions 5 / 5 / 6 / 6 / 8 / 8 / 10 / 10 by chapter, the same on every difficulty including Nightmare;
   Total Assault 30? **Default: yes.**
5. **Total Assault:** energy, or its own daily passes like Bounty (for example 3 a day)? **Default: energy (30).**
6. **Bounty Passes:** 6 a day, saved up to 12, one per win or sweep on any tier, not buyable with gems? That is 1.2 runs
   per arena a day: all 6 on Library III Nightmare gives about 16–17 Akashic Tomes a week and 55k coins a day; a 3 / 3
   split with Market Canal III gives about 12 Tomes and 170k coins (§4.2). Early players get fewer Bounty runs than
   today. Data-only options: tier I costs no Pass, or 8 a day saved up to 16. **Default: 6 a day, saved up to 12, every
   tier costs a Pass.**
7. **Rewards switch:** back to On every time stage prep opens, or remembered? A saved battle always keeps its own
   setting. **Default: back to On.**
8. **Runs without rewards** still count for commissions, achievements, the bestiary, your level and clears, but **not**
   for event missions that pay event currency (event first clears still count)? **Default: yes.**
9. **New battle-mode ribbons** free like new medals? That is 19 per stage, about 760 free runs over the campaign, each
   paid at most at your best Standard medal. Option: a free ribbon run pays drops at most at Normal. **Default: free, as
   described.**
10. **Titan Trials:** a solo first-clear Victory at each step pays in full and uses no Trial Key, even at 0 keys
    (Bronze, Silver and Gold still use one)? **Default: yes.**
11. **Freeplay:** one charge covers the whole run (the waves pay up to about 80% of normal coins per minute, plus a cache
    every 25 waves)? Option: caches after the first 2 in a run each cost the stage's cost. **Default: one charge.**
12. **Events:** Halloween stays energy-free with its 10 sweeps a day; later events cost energy and drop the separate
    sweep cap unless that event sets one? **Default: yes.**
13. **Reset clock:** Commissions, the login gift and Mall stock move to 7 PM Central in this same update?
    **Default: yes.**
14. **Analytics:** on the device only, with a "Copy play stats" button for testers (no new server table)?
    **Default: yes.**
15. **Losses:** a lost replay costs nothing and pays nothing, and the small coin consolation stays only on first-clear
    and new-medal attempts? Or pay the consolation on every loss, whatever the energy or the switch (it is the free
    Tactical Challenge rate)? **Default: none on replays.**
16. **Tactical Challenge and the clan boss** stay free of energy (Tactical Challenge pays slowly; the clan boss has 3
    hits a day)? **Default: yes.**
17. **Clan boss week:** leave it on its server clock (from Nov 1 it flips at Sunday 6 PM Central, an hour before
    everything else), or run the SQL that moves it to 7 PM (a live-database change: it needs your yes)?
    **Default: leave as is (1 h winter offset).**
18. **Name:** "Bounty Passes" instead of "Bounty tickets" (the game already has Bounty Tokens and recruit tickets)?
    **Default: Bounty Passes.**

---

## Appendix A. Clock vectors and the switch-over (from the Oct 13 spec)

### A.1 Vectors (`tests/core/reset.test.js` R-1)

The game day is the date of the Chicago wall clock + 5 hours (7 PM becomes midnight); the game week is the ISO week of
that shifted date (Sunday 7 PM Central starts it).

| Instant (UTC) | Chicago wall | gameDay | gameWeek | nextDailyReset (UTC) |
|---|---|---|---|---|
| 2026-10-13 23:59:59.999 | Tue Oct 13 18:59:59 CDT | 2026-10-13 | 2026-W42 | 2026-10-14 00:00 |
| 2026-10-14 00:00 | Tue Oct 13 19:00 CDT | 2026-10-14 | 2026-W42 | 2026-10-15 00:00 |
| 2026-10-19 00:00 | Sun Oct 18 19:00 CDT | 2026-10-19 | **2026-W43** | 2026-10-20 00:00 |
| 2026-11-01 00:00 | Sat Oct 31 19:00 CDT | 2026-11-01 | 2026-W44 | **2026-11-02 01:00** (25 h day) |
| 2026-11-01 07:30 | Sun Nov 1 01:30 CST (after fall-back) | 2026-11-01 | 2026-W44 | 2026-11-02 01:00 |
| 2026-11-02 01:00 | Sun Nov 1 19:00 CST | 2026-11-02 | 2026-W45 | 2026-11-03 01:00 |
| 2027-03-14 01:00 | Sat Mar 13 19:00 CST | 2027-03-14 | 2027-W10 | **2027-03-15 00:00** (23 h day) |
| 2027-03-14 09:00 | Sun Mar 14 04:00 CDT (after spring-forward) | 2027-03-14 | 2027-W10 | 2027-03-15 00:00 |
| 2027-03-15 00:00 | Sun Mar 14 19:00 CDT | 2027-03-15 | 2027-W11 | 2027-03-16 00:00 |
| 2026-03-08 01:00 | Sat Mar 7 19:00 CST | 2026-03-08 | 2026-W10 | 2026-03-09 00:00 (23 h day) |
| 2027-01-03 12:00 | Sun Jan 3 06:00 CST | 2027-01-03 | **2026-W53** | 2027-01-04 01:00 |
| 2027-01-04 01:00 | Sun Jan 3 19:00 CST | 2027-01-04 | 2027-W01 | 2027-01-05 01:00 |

The other clock tests: R-2 `nextWeeklyReset` is always a Sunday 19:00:00 Chicago (weeks of 168 h, 169 h across
fall-back, 167 h across spring-forward); R-3 the US-rule fallback equals `Intl` at every hour of 2026–2028; R-4
`formatCountdown`; R-5 `isNewPeriod` (null → true, equal → false, later → true, earlier → false, across a year); R-6
`gameDayStart('2026-11-01')` = 2026-11-01T00:00Z and `gameDayEnd('2026-11-01')` = 2026-11-02T01:00Z; R-7 `periodKeys` and
`nextPeriodChange` inside and after a switch-over window with `fixedOffsetLocal` (−300, −420, 0, +60, +540, +780); R-8
the re-base (§13).

### A.2 The switch-over

**Rule: the save finishes its current day and week on the old clock, then follows 7 PM Central.** New saves start on the
game clock (`rs:v = 1`, `rs:du = rs:wu = 0`). An existing save has no `rs:v`; the first `applyResets` sets `rs:v = 1`,
`rs:du` = the next device midnight and `rs:wu` = the next device Monday 00:00. Nothing else is rewritten. `periodKeys`
returns the legacy keys while `t < rs:du` (day) / `t < rs:wu` (week), and the game keys after; every reset fires only
when its key moves forward.

- **No double grant.** The player's current old day is never reopened: it ends at its own midnight, as it always did.
  After that, a reset needs a strictly later key. If 7 PM Central falls less than a day after the player's midnight
  (Europe, Asia, Pacific), the game day at midnight equals the old key, so the old day runs on until that 7 PM: one longer
  day, one claim.
- **No lost daily.** Every day still has exactly one reset. The switch-over day is between 12 h and 38 h long.
- **No skipped event or banner.** The weekly event, the clan boss and banners are global functions of time (`gameWeek`,
  `gameDayNumber`), not of the save. The mapping is monotone and every week still lasts 7 days ± 1 h.

Simulated ("claim whenever claimable", 15-minute steps, fixed device offsets):

| Device | Last claim (local) | Update loaded (local) | Next claims (local) | Switch-over day |
|---|---|---|---|---|
| Chicago | 10:00 | 15:00 same day | 00:00, then 19:00, then daily 19:00 | 19 h (midnight → 7 PM) |
| Chicago | 10:00 | 20:00 same day | 00:00, 19:00, … | 19 h |
| Chicago | 21:00 yesterday | 09:00 | at load (old day already ended), 00:00, 19:00 | 19 h |
| Los Angeles | 10:00 | 18:00 | 00:00, 17:00, … | 17 h |
| Tokyo | 00:30 | 05:00 | 09:00 next day, then daily 09:00 | 33 h |
| Auckland (+13) | 08:00 | 12:00 | 13:00 next day, … | 37 h |

Weekly (same rule): Chicago gets one 163 h week (Mon 00:00 → Sun 19:00), Los Angeles 161 h, London, Tokyo and Auckland
one week 1–13 h longer; then 167 / 168 / 169 h weeks (daylight saving). The `tests/systems/resets.test.js` cases: M-1
migrate once, never for `createProfile()`; M-2 the six rows above, 96 h in 15-minute steps, never two claims with the same
key and no gap above 38 h; M-3 weekly keys monotone over 60 days of hourly steps across both daylight-saving changes; M-4
login, daily commissions and the Mall's daily stock reset at the same instant; M-5 a save whose keys are ahead of the
clock gets no reset until the clock passes them (offline), or one re-base (online, §5.4).

There is no compensation mail for the switch (it would itself be a double grant for everyone the switch did not affect).

## Appendix B. Optional clan-boss SQL (only with the owner's yes)

Moves the clan boss week and its 3 hits a day onto the game clock. In summer the new `current_week()` returns the same key
as the old one at every instant (Sunday 19:00 CDT = Monday 00:00 UTC); in winter the boundary moves one hour. The owner
pastes it in the Supabase SQL editor; nothing in the energy update depends on it.

```sql
-- the game clock: Chicago wall time + 5 h (7 PM Central = midnight); mirrors src/core/reset.js
create or replace function public.game_clock() returns timestamp
language sql stable as $$ select (now() at time zone 'America/Chicago') + interval '5 hours' $$;
create or replace function public.current_week() returns text
language sql stable as $$ select to_char(public.game_clock(), 'IYYY-"W"IW') $$;
create or replace function public.prev_week() returns text
language sql stable as $$ select to_char(public.game_clock() - interval '7 days', 'IYYY-"W"IW') $$;
-- start of the current game day (the last 7 PM Central) as timestamptz
create or replace function public.game_day_start() returns timestamptz
language sql stable as $$ select (date_trunc('day', public.game_clock()) - interval '5 hours') at time zone 'America/Chicago' $$;
```

With it: `boss_state` uses `prev_week()` and counts today's hits from `game_day_start()`; `start_boss_attempt` and
`submit_boss_damage` replace the rolling 24 h limit with "3 hits since `game_day_start()`" (keeping the 20-an-hour start
guard); `src/online/clanRules.js` and the local adapter mirror it. The builder writes it as a new dated file in
`supabase/migrations/` with full copies of the changed functions.

## Appendix C. Review fixes folded into this version

| Finding | Where |
|---|---|
| Start gate is M5b, re-checked on `9af220e`; file owners for M5c / M5d | header; M4_ENERGY_PLAN §0–§2 |
| Tome math counted Passes twice; missing Titan and Memento shelves | §4.2, Q6, E4 pace check |
| Future device date locks a player out | §5.4, §6, EN-3b, R-8 |
| Stage change after Ready keeps consent | §3.7, §9.7, coop tests |
| Battle save forgets the Rewards switch | §3.5, §3.8, ER-10 |
| Titan first clear at 0 keys | §3.10, titans tests |
| Rewardless runs pay event currency through event missions | §3.5, Q8, ER-9 |
| Charge not tied to the payout | N2, §3.9, ER-7 |
| Rewardless runs move hidden counters | §3.5, §6, ER-8 |
| One tap spends a day | §3.6, §9.3, §9.4 |
| Missing energy UI states | §9.1, §9.2, energyUi tests |
| Co-op links bypass Passes and medals | §3.7, PR-4, coop tests |
| Merge conflicts with other branches | §9.5; M4_ENERGY_PLAN §2.1, §4 |
| M4 checks measured without the energy controls; number budget | §9 budget, §9.3 |
| Deploy window, questions to the owner, rollback, clan SQL | §5.3, Q17; M4_ENERGY_PLAN E0, E4, §7 |
| Passes stingy for early and mid players | §3.4, §4.2, Q6, §11 |
| Rewardless wins raise the max | §4.4, §6, Q2 |
| Loss consolation threshold | N12, Q15, Q16 |
| Ribbon and freeplay defaults larger than they look | §4.5, Q9, Q11, §11 |
| Saved event battle after the event | §3.8, ER-11 |
| Names and links | §3.4, §9.2, Q18 |
| Co-op double payment after a resync | §3.7, coop tests |
| Missing tests | §13 |
