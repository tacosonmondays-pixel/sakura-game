# Energy + the 7 PM Central reset — build spec

Owner decisions D2 (energy) and D3 (every reset at 7 PM Central), 2026-10-13
(`(design scratch, not in the repo)`). The owner's words win over anything below.

Grounded in the live game `claude/sakura-sentinels` @ `d6f0226` (`/home/user/wt-spec-base`), plus `feature/online`
@ `13d0140`, `feature/story` @ `5978e6f`, `feature/roster` @ `2933096`, `feature/balance-playtest` @ `5ea7227`,
`feature/audio` @ `0203a1e`, and the old Codex source (`(design scratch, not in the repo)`, `app.js`,
`feature-progress.js`, `summer-content.js`). Every file and function named here was opened. Anything not checked is
marked **UNVERIFIED**.

---

## 1. Summary (what the owner gets)

* **One clock.** Every daily thing — Commissions, the Login gift, Mall daily stock, energy — resets at **7 PM
  Central** (America/Chicago, so 7 PM CDT in summer and 7 PM CST in winter; it follows daylight saving by itself).
  Every weekly thing — weekly Commissions, weekly Mall stock, the double-drop Bounty event, the clan boss — resets
  on **Sunday at 7 PM Central**. Today these use each player's own device midnight.
* **Energy ⚡ (120 a day).** Bounty, Total Assault, Mission replays and sweeps cost energy. It refills to 120 at
  every 7 PM Central reset. Energy is only taken when you **win**: losing or quitting costs nothing.
* **First clears are always free.** A run that can earn a new medal (first clear, or a difficulty you have not
  cleared yet) never costs energy and always pays its full rewards, even at 0 energy.
* **Out of energy?** Mission (campaign) stages stay playable, but replays give no resources until the next reset.
  The first time this happens each day, a popup says so. Bounty and Total Assault need energy to start.
* **Countdowns everywhere** ("Resets in 3h 12m") on Commissions, the Mall, the Events page, the lobby event card,
  the Notice board, the energy pill, the clan boss and (when the roster branch ships them) the recruit banners.
* **A clean switch-over.** Existing saves finish their current day on the old clock, then move to 7 PM Central.
  Nobody gets two claims in one day, nobody has a day with no claim, and no weekly event is skipped.
* **Hikari teaches it.** The Captain's Journal "Bounty" lesson (after 1-5) gains one line about energy.

---

## 2. Decisions and assumptions

| # | Topic | Decision (owner) / reading | Status |
|---|---|---|---|
| D2 | Energy for resource stages | Bounty arenas (`kind: 'resource'`) cost energy; refill at the daily reset; campaign replays stay playable after energy runs out but give no resources; one popup per day | Owner |
| D3 | Reset time | Every reset at 19:00 America/Chicago, DST-aware | Owner |
| A1 | **Do Mission replays cost energy while you have energy?** | **Yes: 5–10 energy per won replay** (§3.4). Without it, a player who keeps energy above 0 (or simply never plays Bounty) farms campaign replays forever, and energy limits nothing: campaign stages drop coins, books and all seven material families (`campaignDrops` in `src/data/stages.js`). Paid only when the replay is won. | **ASSUMPTION — Q3** |
| A2 | Daily refill vs the earlier "+1 per 6 min" ask (P-03/S14f) | **Daily only: top up to 120 at each 7 PM Central reset, no time regen.** Today's words ("for the day until you refresh") describe a daily budget, and the popup's promise ("no more resources today") is only true without regen. Regen is built in but switched off (`ENERGY.regenMinutes = 0`); turning it on is one constant plus one popup line. | **ASSUMPTION — Q1** |
| A3 | Weekly boundary | **Sunday 19:00 Central** (§3.1, "why Sunday") | **ASSUMPTION — Q2** |
| A4 | Which stage kinds cost energy | `resource` (Bounty) and `boss` (Total Assault) and `campaign` replays cost energy; `challenge` (Tactical Challenge) and endless map runs are free. `src/data/stages.js` has exactly four kinds: `campaign`, `resource`, `boss`, `challenge` (`STAGES = [...CAMPAIGN, ...BOUNTY, ...BOSSES, CHALLENGE]`). "Assault" is the screen name of `boss`; "Commissions" are missions, not stages. | Ours |
| A5 | When energy is taken | **On a win, at the results screen** (not on entry like the old game). Loss, quit, restart and a crash cost nothing. Affordability is checked when the battle starts. | Ours |
| A6 | Paid items / gems → energy | **None at launch.** No gem refill, no shop item. A `grantEnergy()` hook exists for future event rewards. | Ours |
| A7 | Co-op | Each player pays for their own rewards; nobody is blocked; energy never crosses the network | Ours |
| A8 | Clan boss | Clan boss battles cost no energy (the server already caps them at 3 a day) and keep their stage drops. Their 3 attempts move from "rolling 24 h" to "per 7 PM Central day". | Ours — owner may prefer "no stage drops in clan boss runs" |
| A9 | Energy before Bounty unlocks | Energy is on from the first minute (pill always visible); the Journal explains it at 1-5. Early replays of 1-1…1-4 cost 5. | Ours |
| A10 | Clock source | The device clock (as today). No server time. Rolling the clock back now gives nothing (resets fire only when the day key moves **forward**, §3.1). | Ours |

---

## 3. Design

### 3.1 One reset clock — new `src/core/reset.js` (pure, no imports, Node-safe)

**The trick.** Take the Chicago wall-clock time and add 5 hours. 7 PM becomes midnight, so the *game date* is the
date of that shifted clock, and the *game week* is the ISO week of that shifted date. 19:00 Sunday Chicago
becomes 00:00 Monday, so ISO weeks (Monday first) start exactly at Sunday 7 PM Central. Because the shift is applied
to the **wall clock** (not to UTC), daylight saving needs no special case: DST changes happen at 02:00 local,
far from 19:00.

```js
export const RESET = Object.freeze({ timeZone: 'America/Chicago', hour: 19, shiftHours: 5, label: '7 PM Central', weeklyLabel: 'Sunday 7 PM Central' });
export const RESET_SCHEME = 'chi19-v1';          // profile.resets.scheme of a save on this clock

export function chicagoParts(t)                  // {year, month, day, hour, minute, second} Chicago wall clock (Intl, cached formatter)
export function gameDay(t = Date.now())          // 'YYYY-MM-DD': the date of (Chicago wall time + 5 h)
export function gameDayNumber(t = Date.now())    // whole days since 1970-01-01 of gameDay (rotation index for banners/events)
export function gameWeek(t = Date.now())         // 'YYYY-Www': ISO week of the same shifted date
export function nextDailyReset(t = Date.now())   // ms of the first instant > t whose Chicago wall time is 19:00:00.000
export function nextWeeklyReset(t = Date.now())  // ms of the first Sunday 19:00:00 Chicago > t
export function gameDayStart(key) / gameDayEnd(key) // ms bounds of a game day ('2026-11-01' → Oct 31 19:00 CDT … Nov 1 19:00 CST)
export function isNewPeriod(stored, current)     // !stored || current > stored   (string order; never resets backwards)
export function formatCountdown(ms)              // '2d 4h' | '3h 07m' | '12m' (min '1m'); ms <= 0 → 'now'
export function localResetHint(t = Date.now())   // '' on Central time, else e.g. '9:00 AM your time' (toLocaleTimeString of nextDailyReset)

// switch-over helpers (§3.3)
export const LOCAL                               // device-clock adapter: { dayKey(t), weekKey(t), dayEnd(t), weekEnd(t) }
export function fixedOffsetLocal(minutes)        // same adapter for a fixed UTC offset (tests)
export function legacyDayKey(t, local = LOCAL)   // the old util.dayKey: device-local 'YYYY-MM-DD'
export function legacyWeekKey(t, local = LOCAL)  // the old util.weekKey: device-local ISO week
export function newResets() / cleanResets(raw)   // profile.resets block + sanitizer (§6)
export function periodKeys(resets, t, local = LOCAL)       // { day, week } for one save (legacy keys inside its switch-over window)
export function nextPeriodChange(resets, t, kind, local = LOCAL) // ms when periodKeys(...)[kind] next moves forward
```

* `gameDay`: `chicagoParts(t)` → `wall = Date.UTC(y, m−1, d, h, min, s)`; `s = new Date(wall + 5 h)`; key from
  `s.getUTCFullYear/Month/Date`. Use `hourCycle: 'h23'` and `hour % 24` (some engines print "24").
* `nextDailyReset`: target wall time = next shifted midnight − 5 h; guess `u = target − (wallOf(t) − t)`, then
  correct `u -= wallOf(u) − target` up to 3 times (the old `bannerRotation` in `oldgame/live-ops.js` does the same).
* `nextWeeklyReset`: step `nextDailyReset` until `gameWeek` changes (at most 7 steps).
* **Fallback when `Intl` lacks America/Chicago** (very old WebViews; `new Intl.DateTimeFormat(…, { timeZone })`
  throws `RangeError`): compute the offset from the US rule — UTC−5 from the second Sunday of March 02:00 local
  to the first Sunday of November 02:00 local, else UTC−6. Tests check the fallback against `Intl` every hour of
  2026–2028.
* `src/core/util.js`: `dayKey` / `weekKey` become one-line deprecated aliases
  `export { gameDay as dayKey, gameWeek as weekKey } from './reset.js';` so any branch still importing them keeps
  compiling. All call sites below move to `reset.js` / `periodKeys`.

**Prototype check** (scratch implementation of the functions above, Node 22, full ICU):

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

**Why Sunday 7 PM Central for the weekly reset**

1. With the +5 h shift it is exactly the start of an ISO week, so week keys keep today's `'YYYY-Www'` format and
   `currentEvent()`'s `hashString(week)` rotation keeps working; the SQL mirror is one expression (§3.8).
2. During daylight time it is the **same instant** as the clan boss's current reset (Monday 00:00 UTC in
   `src/online/clanRules.js` `msToWeekReset` and SQL `current_week()`); in winter it moves by one hour. The online
   weekly boss does not visibly change.
3. The reset lands at the end of the weekend, so weekend players get the whole weekend for weeklies, and the
   "new week" is waiting on Monday morning — the same mental model as today's "rotates every Monday".
4. One rule for players: "everything resets at 7 PM Central; weekly things on Sunday".

### 3.2 Every call site (wt-spec-base, plus what the in-flight branches add)

| File · function (line) | Today | Change |
|---|---|---|
| `src/core/util.js` `dayKey` (24), `weekKey` (32) | device-local date / ISO week | deprecated aliases of `gameDay` / `gameWeek`; old code moves to `reset.js` as `legacyDayKey` / `legacyWeekKey` |
| `src/systems/missions.js` `onAppStart` (37–57) | `m.day !== dayKey(now)`, `m.week !== weekKey(now)` | `const { day, week } = periodKeys(profile.resets, now)`; reset when `isNewPeriod(m.day, day)` / `isNewPeriod(m.week, week)` |
| `src/systems/missions.js` `loginState` (150–160) | `today = dayKey(now)`, `claimedToday = lastDay === today` | `today = periodKeys(profile.resets, now).day`; `claimedToday = !!login.lastDay && login.lastDay >= today` |
| `src/systems/missions.js` `currentEvent` (291–305) | `weekKey(now)` | `gameWeek(now)` (global, not per save) |
| `src/systems/shop.js` `refreshShop` (12–26) | `shop.day !== dayKey(now)` … | `periodKeys` + `isNewPeriod` (daily and weekly offers) |
| `src/main.js` (35) | `onAppStart(store.profile)` | `applyResets(store.profile)` (§3.3) + `startResetClock(store)` + re-run on `'replace'` |
| `src/ui/screens/commissions.js` `msUntil` (35–44), `formatDuration` (46–52), `missionsView` header (120), `loginView` hint (206), `render` (58–59) | local midnight / local Monday; "(local midnight, 2026-10-05)" | delete `msUntil`/`formatDuration`; use `nextPeriodChange` + `formatCountdown`; copy in §3.6; `render` calls `applyResets`; redraw on store reason `'reset'` |
| `src/ui/screens/mall.js` `render` hint (64) | "Daily stock restocks at midnight; weekly stock on Monday." | live countdown copy (§3.6); redraw on `'reset'` |
| `src/ui/screens/rewards.js` `msToWeekEnd` (18–24), `eventSection` (52–78, next/after at +7/+14 days, hint at 75) | local Monday midnight; "Events rotate every Monday." | `nextWeeklyReset(now) − now`; next/after = `currentEvent(nextWeeklyReset(now))` and one week after that; hint "Events rotate every Sunday at 7 PM Central." |
| `src/ui/lobby/notice.js` `eventDaysLeft` (37–40), `articles` event body (80–81), `NOTICE_VERSION` (16) | `now.getDay()`; "rotates every Monday" | new `eventTimeLeft(now)` → `formatCountdown(nextWeeklyReset(now) − now)` ("4d 2h", "3h 07m"); copy; new "reset" article; bump version |
| `src/ui/screens/lobby.js` `buildEventCard` (475–488), `buildCarousel` (399, unused `days`), `buildShortcuts` login toast (374) | "`2× drops · 3d left`" | `eventTimeLeft()`; delete the unused `days`; toast note "Next gift at 7 PM Central — see you then, Sensei!" |
| `src/ui/screens/lobby.js` `greeting` (283), clock (197) | device hour / device clock | **unchanged** (a greeting follows the player's own time of day) |
| `src/data/missions.js` comment (93) | "chosen by weekKey" | "chosen by gameWeek (Sunday 7 PM Central)" |
| `src/data/wiki.js` "Daily routine" (127–131), Mall line (300) | no reset time | copy in §3.6 |
| `src/systems/mail.js` `BETA_DEADLINE` (24) | absolute instant (Nov 8 06:00 UTC) | **unchanged** — a deadline, not a reset |
| `tests/systems/missions.test.js` `MON`, `day()` (13–14) | `new Date(2026, 9, 5, 10)` (device time) | Chicago instants (`Date.UTC(2026, 9, 5, 15)` = 10:00 CDT) so the suite passes in any TZ |
| `tests/systems/rewards.test.js` `NOT_EVENT` (13) | searches weeks with device dates | unchanged (it searches until it finds a non-event week) |
| `CONTRACTS.md` §5 (440–441, 567, 572), `docs/ECONOMY.md` §4 (61–64, 70–71) | "local midnight", "ISO week" | document the new clock + energy |
| **feature/online** `src/online/clanRules.js` `weekKey` (119), `prevWeekKey` (130), `msToWeekReset` (136) | UTC ISO week, Monday 00:00 UTC | delegate: `weekKey = gameWeek`, `prevWeekKey(t) = gameWeek(t − 7 d)`, `msToWeekReset(t) = nextWeeklyReset(t) − t` |
| **feature/online** `src/online/adapters/localDb.js` `bossRow` (155), `bossState` `myHitsToday` (191–197), boss checks (477, 499) | `weekKey`; hits in the last 24 h | `myHitsToday` = hits with `at >= gameDayStart(gameDay(now))` |
| **feature/online** `src/online/limits.js` `RULES.boss_hit` (20) | 3 per rolling day | replaced by the game-day count (keep `boss_start` 20/hour as the abuse guard) |
| **feature/online** `src/ui/screens/clan.js` `bossTab` (355–413) | "Resets in Xd Yh"; "Attempts recharge within 24 h"; "resets every Monday (UTC)" | copy in §3.6 |
| **feature/online** `supabase/migrations/20261008000000_online.sql` `current_week()` (583), `boss_state` `v_prev` (626) and `myHitsToday` (644), `start_boss_attempt` (667), `submit_boss_damage` (701) | UTC week; rolling 24 h | §3.8 |
| **feature/roster** `src/systems/banners.js` (`ROSTER_SPEC.md` §7.2, not built yet) | own Intl code, "cycle = Chicago date − 1 before 19:00" | `bannerRotation(now)` uses `gameDayNumber(now)` and `nextDailyReset(now)` from `reset.js` (§5) |
| **feature/story** `src/data/story/lessons.js` `bounty` (96–105), `commissions` (120–129) | no reset/energy text | §3.7 |
| feature/balance-playtest, feature/audio | no reset or date code (grepped `dayKey`, `weekKey`, `getHours`, `America/Chicago`) | none |

There are **no** Bounty attempt limits, Total Assault limits or banner rotations in the live game today; sweeps
are unlimited (`sweep` in `src/systems/rewards.js`, `MAX_SWEEPS = 10` per call).

### 3.3 The switch-over (one-time, per save)

**Rule: the save finishes its current day and week on the old clock, then follows 7 PM Central.**

* New saves (`createProfile`) start with `resets = newResets()` = `{ scheme: 'chi19-v1', legacyDayUntil: 0,
  legacyWeekUntil: 0, migratedAt: null }` and use game keys from the start.
* An existing save has no `resets` block (`cleanResets(undefined)` → `scheme: null`). The first `applyResets`
  call runs `migrateResetScheme(profile, now)`:
  `profile.resets = { scheme: RESET_SCHEME, legacyDayUntil: LOCAL.dayEnd(now), legacyWeekUntil: LOCAL.weekEnd(now), migratedAt: now }`
  (the next device midnight and the next device Monday 00:00). Nothing else is rewritten: no stored key, no
  progress, no stock, no claim.
* `periodKeys(resets, t)` returns the **legacy** keys while `t < legacyDayUntil` (day) / `t < legacyWeekUntil`
  (week), and the game keys after. Every reset fires only when the key moves forward (`isNewPeriod`).

Why this satisfies the three requirements without per-claim timestamps (old saves have none):

* **No double grant.** The player's current old day is never reopened: it ends at its own midnight, as it always
  did. After that, a reset needs a strictly later key. If 7 PM Central falls less than a day after the player's
  midnight (Europe, Asia, Pacific), `gameDay(midnight)` equals the old key, so the old day simply runs on until
  that 7 PM — one longer day, one claim.
* **No lost daily.** Every day still has exactly one reset. The switch-over day is between 12 h and 38 h long;
  no day is ever skipped.
* **No skipped event or banner.** The weekly event, the clan boss and banners are global functions of time
  (`gameWeek`, `gameDayNumber`), not of the save. The time → key mapping is monotone and every week still lasts
  7 days ± 1 h, so no event is ever skipped; it just changes a few hours earlier or later once.

Simulated with the prototype ("claim whenever claimable", 15-minute steps, fixed device offsets):

| Device | Last claim (local) | Update loaded (local) | Next claims (local) | Switch-over day |
|---|---|---|---|---|
| Chicago | 10:00 | 15:00 same day | 00:00, then 19:00, then daily 19:00 | 19 h (midnight → 7 PM) |
| Chicago | 10:00 | 20:00 same day | 00:00, 19:00, … | 19 h |
| Chicago | 21:00 yesterday | 09:00 | at load (old day already ended), 00:00, 19:00 | 19 h |
| Los Angeles | 10:00 | 18:00 | 00:00, 17:00, … | 17 h |
| Tokyo | 00:30 | 05:00 | 09:00 next day, then daily 09:00 | 33 h |
| Auckland (+13) | 08:00 | 12:00 | 13:00 next day, … | 37 h |

Weekly (same rule): Chicago gets one 163 h week (Mon 00:00 → Sun 19:00), Los Angeles 161 h, London/Tokyo/Auckland
one week 1–13 h longer; then 167/168/169 h weeks (DST).

`applyResets(profile, now)` (new, `src/systems/resets.js`) is the single entry point:
`migrateResetScheme` → `onAppStart` (missions) → `refreshShop` → `refillEnergy`, returning
`{ migrated, dailyReset, weeklyReset, energyRefilled }`. It is idempotent.

A **Notice article** (§3.6) announces the change; there is no compensation mail (it would itself be a double grant
for everyone the switch did not affect).

### 3.4 Energy

**Save** — `profile.energy = { value, day, noticeDay, at }`:
`value` (int, 0…`ENERGY.hardCap`), `day` (gameDay of the last refill), `noticeDay` (gameDay the out-of-energy
popup last showed), `at` (ms of the last regen tick; unused while regen is off). Energy is **not** an inventory item:
`addItems`, mail, codes and the Mall cannot grant it by accident.

**Numbers** — new `src/data/energy.js` (kept out of `src/data/stages.js`, so the co-op data hash and the balance
branch's stage edits are untouched):

```js
export const ENERGY = Object.freeze({
  daily: 120,        // each 7 PM Central reset tops energy up to this (never lowers a higher value)
  cap: 120,          // regen stops here
  hardCap: 999,      // grants (future event rewards) may exceed cap up to this
  regenMinutes: 0,   // 0 = off (recommended). 6 = the earlier owner ask, "+1 per 6 min"
});
export const ENERGY_COST = Object.freeze({
  resource: { 1: 10, 2: 15, 3: 20 },                              // Bounty tiers I / II / III (old game: 10 / 15 / 20)
  boss: 30,                                                        // Total Assault
  campaign: { 1: 5, 2: 5, 3: 6, 4: 6, 5: 8, 6: 8, 7: 10, 8: 10 },  // Mission replay, by chapter
  challenge: 0,                                                    // Tactical Challenge and endless map runs
});
```

What 120 buys per day: 12 / 8 / 6 Bounty runs (tier I / II / III), or 4 Total Assault runs, or 12–24 Mission
replays — or any mix, including sweeps. Check against the balance branch: `docs/BALANCE.md` (wt-balance, line 133)
says the chapter-4 tuning level needs "95k EXP … or 31 Library II clears"; 8 Library II runs a day reach it in
about 4 days, so the tuned F2P curve stays reachable.

**`energyCost(stage)`** (`src/systems/energy.js`): `stage.energy` when it is a finite number (event stages from the
summer-event spec can declare their own, like the old `summer-content.js` 8–20); else by kind: `resource` →
`ENERGY_COST.resource[tier]` with `tier = Number(id.slice(id.lastIndexOf('-') + 1))` (the same parse
`src/data/stages.js` uses at line 876); `boss` → 30; `campaign` → `ENERGY_COST.campaign[stage.chapter]`; anything
else → 0.

**`planRun(profile, stageId, { difficulty, mode, now })`** (new export in `src/systems/rewards.js`, which already
imports `stageMedals` / `isPracticeRun` from `unlocks.js`). `mode`: `'solo' | 'endless' | 'practice' | 'coop' |
'clanBoss'`. Returns `{ kind, cost, have, reason }`, decided in this order:

| kind | When | Rewards | Energy |
|---|---|---|---|
| `free` | practice run (`isPracticeRun`), endless, clan boss, or `energyCost === 0` (challenge) | as today | none |
| `progress` | solo and `!stageMedals(p, id)[difficulty]` (first clear or a new medal) | full (medal gems, first clear, unlocks, drops) | **none, even at 0** |
| `paid` | otherwise, `have >= cost` | full | `cost`, taken on a win |
| `unpaid` | `have < cost` on a `campaign` stage (solo replay or any co-op run) | **none** (no drops, no coins, no loss consolation, no event bonus) | none |
| `blocked` | `have < cost` on any other kind (Bounty, Total Assault, event stages) | Start is disabled | none |

A battle reached past the gate by a direct link (`#/battle?stage=res-books-3`) with a `blocked` plan plays as
`unpaid`, like today's practice runs. Partial payment is never allowed: a replay is paid only when
`have >= cost`. (Allowing "spend whatever is left" would make 1 leftover energy pay for unlimited replays.)

**Charging (A5).** The battle controller computes the plan when the battle mounts and passes it to the result:
`applyBattleResult(profile, result, rng, { now, plan })`. On a **win** with `plan.kind === 'paid'`, it calls
`chargeEnergy(profile, plan.cost, now)`, which takes `min(cost, value)` (the run was affordable at start, so it
always pays). A loss, quitting (pause menu "Quit"), "Restart", leaving the tab or a crash never calls it, so there
is nothing to refund. Why not charge on entry like the old game (`app.js`: "defeated or abandoned operations keep
their entry cost"): our battles are 12–30 waves instead of 5, and losing 20 minutes *and* the energy feels unfair;
charging on a win also needs no "pending run" recovery. Drops are rolled at the same moment energy is taken, so
nobody can look at drops before paying.

**Sweeps.** `sweep(profile, stageId, difficulty, times, rng, { now })` runs
`n = min(times, MAX_SWEEPS, floor(value / cost))` sweeps. `n < 1` → `{ ok: false, error: 'energy', need: cost,
have: value }`. It spends `n × cost` once and returns `energySpent` and `energyLeft`. New
`sweepPlan(profile, stageId, times, now)` → `{ n, cost, each }` for button labels. Sweeps are always paid (they
are never first clears).

**Refill** (`refillEnergy` / `energyState` in `src/systems/energy.js`, run lazily by every read and by
`applyResets`): when `isNewPeriod(energy.day, gameDay(now))` → `value = max(value, ENERGY.daily)`,
`day = gameDay(now)`. With `regenMinutes > 0` it also adds `floor((now − at) / interval)` up to `cap` (the old
`syncEnergy` in `oldgame/live-ops.js`). Energy uses the global game day even during a save's switch-over window
(it has no legacy state).

**Co-op (feature/online).** Co-op offers campaign stages only (`coopStages` in `src/data/coop.js`) and never awards
medals or first clears (`applyCoopResult` in `src/online/coop/rewards.js`). So for each player a co-op run is a
campaign replay: `planRun(…, { mode: 'coop' })` → `paid` or `unpaid`, never `progress` or `blocked`.
`applyCoopResult(profile, result, rng, { plan, now })`: a won `paid` run charges that player's own energy and gives
their drops and coins; an `unpaid` run gives that player nothing; the ally is unaffected either way. Nobody is
blocked from creating, joining or starting a room. Energy is never sent over the network and is not part of the
loadout, the hello/version check or the sim, so lockstep is untouched (§6).

**Clan boss (feature/online).** `mode: 'clanBoss'` → `free`. The server already limits attempts (§3.8), and these
runs keep the normal Total Assault drops they give today (the controller only sets `ctx.extraActions` for clan
boss battles, so `results.js` calls `applyBattleResult`).

**Story tutorial replay.** The Story archive's "Replay battle tutorial" opens 1-1 Easy with `tutorial=1`, and
`STORY_SPEC.md` §1.5 says its "rewards follow the normal stage rules", so it is a normal 1-1 replay (5 energy on a
win, or unpaid). The first tutorial is a first clear, so it is free.

**Out-of-energy notice.** `outOfEnergyNoticeDue(profile, now)` = `energy.noticeDay !== gameDay(now)`;
`markOutOfEnergyNotice` sets it. One popup per game day, whichever button the player presses.

**Exploits this closes:** (1) keeping 1 energy and replaying forever (A1 + no partial payment); (2) farming
Total Assault instead of Bounty (both cost); (3) unlimited sweeps (they cost per run); (4) co-op as a free farm
(each player pays); (5) clock rollback (resets only move forward); (6) deep links past the gate (they play unpaid).

### 3.5 The once-a-day popup (academy style, existing components)

Shown when the player taps **Start** in stage prep (or **Ready** in a co-op room) on an `unpaid` run and the notice
is due. Built with `ask()` from `src/ui/screens/stage.js` (the shared `confirmDialog` with a yellow OK) plus the
energy icon and a live countdown. `testid`s: `energy-out-modal`, `confirm-ok`, `confirm-cancel`.

> **Out of energy**
>
> You've used all of today's energy, Sensei.
>
> You can keep replaying Mission stages, but you won't receive any more resources today. Energy refills at the
> 7 PM Central reset — in 3h 12m *(9:00 AM your time)*.
>
> *First clears and new medals always give their full rewards.*
>
> [ Not now ] [ Replay anyway ]

The italic local-time part appears only when `localResetHint()` is not empty. If regen is switched on (Q1), the
second paragraph becomes: "You can keep replaying Mission stages, but they won't give resources until you have
5 energy again (+1 every 6 minutes, full at 7 PM Central)." "Mission" is the in-game name of campaign stages
(`stageLabel` → "Mission 1-3").

### 3.6 UI

**Energy pill.**
* Lobby (`buildTop`, `src/ui/screens/lobby.js` 321–343): a new `pill()` first in `.lb-pills`: energy icon,
  "87/120", `testid: 'energy'`, title "Energy", tap → `showEnergyInfo()`. The pill turns amber below 20.
* All other screens (`currencyPills` in `src/ui/components.js` 185–201, used by `topBar`/`screen`): an energy pill
  before coins with the same data, auto-refreshed on store change. `components.js` must not import
  `src/ui/energy.js` (that file imports `components.js`): build the pill inline from `systems/energy.js` and open
  the info modal with `import('./energy.js').then((m) => m.showEnergyInfo())` (the pattern of `showItemInfo`'s
  select-ticket import, line 418).
* At 844×390 the "/120" part hides (`.cur-cap`); the e2e checks that `.lb-pills` and `.lb-tr` do not overlap and
  that the top bar has no horizontal overflow.
* Icon: new `energyBody()` in `src/art/icons/items.js` (an original yellow lightning bolt in a rounded white
  capsule with a sakura-pink rim), registered as `SPECIAL_ITEMS.energy` in `src/art/icons.js`, so
  `currencyIcon('energy')` works.

**Energy info modal** (`showEnergyInfo`, `testid: 'energy-info'`):
> **Energy** — ⚡ 87 / 120
> Energy pays for Bounty, Total Assault, Mission replays and sweeps — only when you win.
> It refills to 120 every day at 7 PM Central — in 3h 12m.
> First clears and new medals are always free. Tactical Challenge and endless runs are free.
> Bounty I / II / III: 10 / 15 / 20 · Total Assault: 30 · Mission replay: 5–10 · Sweeps: the same per run.

**Stage prep** (`buildPrep` actions, `src/ui/screens/stage.js` 466–490): a cost line above Start
(`testid: 'energy-cost'`), from the plan for the selected difficulty (recomputed by the existing `redraw`):

| Plan | Cost line | Start button |
|---|---|---|
| `progress` (first clear) | ⚡ Free · first clear | as today |
| `progress` (new medal) | ⚡ Free · new medal | as today |
| `paid` | ⚡ 15 when you win · you have 87 | as today |
| `unpaid` | ⚡ Out of energy — this replay gives no rewards · refills in 3h 12m | "Replay (no rewards)"; tap → popup if due |
| `blocked` | ⚡ 20 needed · you have 12 · refills at 7 PM Central (in 3h 12m) | disabled, "Not enough energy" |
| `free` | ⚡ Free | as today |

**Sweeps** (`sweepControls` 622–655 in `stage.js`, `buildDetail` in `bounty.js` 129–141, `drawDetail` in
`assault.js` 122–137, `openSweep` rows in `missions.js` 139–155): labels "Sweep ×1 · ⚡15" and "Sweep ×N · ⚡150",
where N is from `sweepPlan` (≤ 10). With N = 0 the button is disabled and the lock line reads "Not enough energy —
⚡15 per sweep". The sweep rewards modal note adds "−150 energy". The toast for `error: 'energy'` is "Not enough
energy". Bounty tier buttons add "⚡10" to their meta line (`ma-tier-meta`), the Total Assault "Challenge"
button area adds "⚡30".

**Battle** (`src/ui/battle/controller.js` `mountBattle`): `ctx.energyPlan = planRun(profile, req.stageId,
{ difficulty: req.difficulty, mode })` with `mode = req.practice ? 'practice' : req.endless ? 'endless' :
params.coop ? 'coop' : params.clanBoss ? 'clanBoss' : 'solo'`. Next to the practice feed line (453):
`unpaid` → "Out of energy: this replay gives no rewards. Energy refills at 7 PM Central." (`info`, 4.2 s).
`ctx.restart` recomputes the plan; when it is `blocked`, or `unpaid` with the notice due, it goes to stage prep
(`navigate('stage', { id })`) with the toast "Not enough energy" instead of restarting in place.

**Results** (`src/ui/battle/results.js`): `apply()` passes `{ now: new Date(), plan: ctx.energyPlan }`. A
paid win shows a chip in the rewards medal row: "−15 ⚡ · 72 left" (`testid: 'energy-spent'`). An unpaid run shows
`unpaidNote()` (styled like `practiceNote`, `testid: 'unpaid-note'`): "Out of energy — this replay gave no rewards.
Energy refills at 7 PM Central (in 3h 12m)."

**Countdowns** — one helper `liveCountdown(el, getTarget)` exported from `components.js` (updates every 30 s,
cleans up with the existing `autoCleanup`). Copy:

| Where | Text |
|---|---|
| Commissions · Daily header | "4/6 claimed · 120 gems in total · resets in 3h 12m (7 PM Central)" |
| Commissions · Weekly header | "… · resets in 4d 2h (Sunday 7 PM Central)" |
| Commissions · Login hint | "Next login gift in 3h 12m — the day resets at 7 PM Central." |
| Commissions during a save's switch-over day | "… resets in 2h 10m (tonight at midnight, then every day at 7 PM Central)" |
| Mall hint | "Daily stock restocks at 7 PM Central (in 3h 12m) · weekly stock on Sunday at 7 PM Central (in 4d 2h)." |
| Events page | badge "THIS WEEK" + "4d 2h left"; hint "Events rotate every Sunday at 7 PM Central." |
| Lobby event card | "2× drops · 4d 2h left" |
| Notice · event article | date "4d 2h left"; body "…drops ×2 this week. The event rotates every Sunday at 7 PM Central." |
| Energy pill title | "Energy · refills at 7 PM Central (in 3h 12m)" |
| Recruit banners (roster) | "New spotlight in 3h 12m" (ROSTER_SPEC §7.4 copy, from `nextDailyReset`) |
| Clan boss (online) | "Resets in 4d 2h"; fight button when out "Attempts refill at 7 PM Central"; body "…Three attempts a day (they refill at 7 PM Central)… the boss resets every Sunday at 7 PM Central." |

Each label also shows `localResetHint()` as a `title` tooltip.

**Reset clock** (new `src/ui/resetClock.js` `startResetClock(store)`, started from `main.js`): a timeout at
`min(nextPeriodChange(day), nextPeriodChange(week), nextWeeklyReset)` + 1 s (and the next regen tick if regen is
on), re-armed after every fire and on `visibilitychange` → visible. On fire: `applyResets`; when anything changed,
`store.commit('reset')`. Screens that redraw on `'reset'`: lobby (already redraws on any change), commissions,
mall, stage prep, bounty, assault, missions hub, events page.

**Notice article** (`articles()` in `src/ui/lobby/notice.js`, first in the list; `NOTICE_VERSION =
'energy-reset-1'` so the red dot shows once):
> tag **Update** · icon `calendar` · title "New: Energy and the 7 PM reset" · date "New"
> 1. "Every daily reset — Commissions, the Login gift, Mall stock and the new Energy — now happens at 7 PM Central
>    time, which is 9:00 AM for you." (the last clause only when `localResetHint()` is not empty)
> 2. "Weekly Commissions, weekly Mall stock and the double-drop event change every Sunday at 7 PM Central."
> 3. "Energy (120 a day) pays for Bounty, Total Assault, Mission replays and sweeps — only when you win. First clears
>    and new medals are always free."
> 4. "Out of energy? Mission stages stay open for practice; they just won't give rewards until the next reset."
> CTA "Go to Bounty" → `navigate('bounty')`.

**Wiki** (`src/data/wiki.js` "Daily routine", 127–131): first item "Claim the login calendar and daily commissions
(120 gems a day). Every day starts at 7 PM Central; weekly things reset on Sunday at 7 PM Central."; new item
"Energy (120 a day) pays for Bounty, Total Assault, Mission replays and sweeps when you win. First clears and new
medals are free."; Mall line (300): "…each day (7 PM Central); the Gem Shop sells super rares weekly (Sunday)."

### 3.7 Captain's Journal (feature/story §3) — the unlock moment

Recommended: **yes**, energy is introduced by the existing `bounty` lesson, which unlocks on 1-5 — the moment
Bounty opens and energy starts to matter. No new lesson, no new gate. `src/data/story/lessons.js`:

* `bounty.body` gains a third paragraph (103 characters; `tests/story/journal-data.test.js` allows ≤ 3 paragraphs
  of ≤ 120): **"Bounty, Total Assault and replays use energy. It refills at 7 PM Central; first clears are always free!"**
* `commissions.body[0]` becomes (100 characters): **"Commissions are small daily and weekly goals, with gems as
  thanks. A new day starts at 7 PM Central."**
* The `home` lesson is unchanged (its "Missing a day never resets it" line stays true).

### 3.8 Server side (Supabase, owner-run SQL; publishable key only, no secrets)

In `supabase/migrations/20261008000000_online.sql`:

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

* `boss_state`: `v_prev := prev_week()`; `myHitsToday` counts `created_at >= game_day_start()`.
* `start_boss_attempt`: replace `rate_retry_ms('boss_hit', 0, 3, interval '1 day')` with "if 3 hits since
  `game_day_start()` → `raise exception 'rate_limited:%'` with the ms until the next 7 PM Central".
* `submit_boss_damage`: replace `enforce_rate('boss_hit', 0, 3, interval '1 day')` with the same count check.
  Keep `enforce_rate('boss_start', 0, 20, interval '1 hour')`.
* Add `current_week()`'s three new siblings to the `grant execute … to authenticated` list (lines 827–835; only
  `prev_week()` needs it if `game_clock()`/`game_day_start()` stay internal, like `rate_retry_ms`).

During daylight time the new `current_week()` returns the same key as the old one at every instant (Sunday 19:00
CDT = Monday 00:00 UTC), so changing it mid-week cannot strand a boss row; in winter the boundary moves one hour.
**How to apply:** `docs/ONLINE.md` (online @ 13d0140) says the migration has not been run yet and that the file is
idempotent — so edit this file in place, and the owner pastes it once, as already planned (D9). If the owner has
already run it before this lands, the builder adds `supabase/migrations/20261015000000_reset_7pm_central.sql`
with the same `create or replace` statements (including full copies of the three changed functions) and
`ONLINE.md` tells the owner to paste it. **UNVERIFIED:** which assertions in `tests/online/schema.test.js` read
these function bodies; the builder updates them.

---

## 4. Files to touch

### Branch `feature/energy-reset` (cut from main **after** feature/online has merged)

**New**
| File | Contents |
|---|---|
| `src/core/reset.js` | everything in §3.1 (incl. `newResets`, `cleanResets`, `periodKeys`, `nextPeriodChange`, the US-rule fallback) |
| `src/data/energy.js` | `ENERGY`, `ENERGY_COST` |
| `src/systems/energy.js` | `newEnergy()`, `cleanEnergy(raw)`, `energyState(profile, now)` (refill + regen, returns `{ value, cap, daily, day, nextRefillAt, nextRegenAt }`), `refillEnergy(profile, now)`, `energyCost(stage)`, `spendEnergy(profile, n, now)` (atomic, false when short), `chargeEnergy(profile, n, now)` (takes min), `grantEnergy(profile, n, { overCap })`, `outOfEnergyNoticeDue`, `markOutOfEnergyNotice`. Imports only `core/reset.js` and `data/energy.js` (so `save.js` can import it without a cycle through `unlocks.js` → `save.js`). |
| `src/systems/resets.js` | `migrateResetScheme(profile, now, local)`, `applyResets(profile, now)`, `resetLabel(profile, kind, now)` → `{ ms, text }` for the copy in §3.6 |
| `src/ui/energy.js` | `showEnergyInfo()`, `confirmUnpaidReplay(profile)` (popup §3.5, resolves boolean, marks the notice), `energyCostLine(plan)`, `sweepLabel(stage, plan)` |
| `src/ui/resetClock.js` | `startResetClock(store)` |
| `tests/core/reset.test.js`, `tests/systems/resets.test.js`, `tests/systems/energy.test.js`, `e2e/energy.mjs` | §7 |

**Edited**
| File | Functions |
|---|---|
| `src/core/util.js` | `dayKey`, `weekKey` → aliases |
| `src/systems/missions.js` | `onAppStart`, `loginState`, `currentEvent`, imports |
| `src/systems/shop.js` | `refreshShop` |
| `src/systems/save.js` | `createProfile` (+`energy: newEnergy()`, `resets: newResets()`), `migrateProfile` (+`p.energy = cleanEnergy(raw.energy)`, `p.resets = cleanResets(raw.resets)`); `SAVE_VERSION` unchanged |
| `src/systems/rewards.js` | new `planRun`, `sweepPlan`; `applyBattleResult` (opts `plan`; plan computed before medals change; unpaid path; charge on a paid win; `out.unpaid`, `out.energy = { kind, spent, left }`); `sweep` (energy cap, error `'energy'`, `energySpent`, `energyLeft`) |
| `src/main.js` | `applyResets` instead of `onAppStart`; `startResetClock(store)`; `store.on('change', (e) => e?.reason === 'replace' && …applyResets + commit('reset'))` |
| `src/ui/components.js` | `currencyPills` (energy pill), new `liveCountdown` |
| `src/ui/screens/lobby.js` | `buildTop` (pill), `buildEventCard`, `buildCarousel`, `buildShortcuts` (toast copy) |
| `src/ui/screens/stage.js` | `buildPrep` (cost line, Start states, popup), `sweepControls`, `render` listener (`'reset'`, `'energy'`) |
| `src/ui/screens/bounty.js` | `buildDetail` (inner), `render` listener |
| `src/ui/screens/assault.js` | `drawDetail` (inner) |
| `src/ui/screens/missions.js` | `openSweep` rows, `render` listener |
| `src/ui/screens/commissions.js` | delete `msUntil`, `formatDuration`; `missionsView`, `loginView`, `render` |
| `src/ui/screens/mall.js` | `render` hint + listener |
| `src/ui/screens/rewards.js` | `msToWeekEnd` → `nextWeeklyReset`; `eventSection`; listener for `'reset'` |
| `src/ui/lobby/notice.js` | `eventDaysLeft` → `eventTimeLeft`, `articles`, `NOTICE_VERSION` |
| `src/ui/battle/controller.js` | `mountBattle` (`ctx.energyPlan`, feed line, `ctx.restart` guard) |
| `src/ui/battle/results.js` | `apply`, `showVictory`, `showDefeat`, `showRewards` (note + chip), new `unpaidNote` |
| `src/art/icons.js`, `src/art/icons/items.js` | `SPECIAL_ITEMS.energy`, `energyBody()` |
| `src/ui/styles/base.css`, `src/ui/styles/meta-a.css` | `.cur-pill.energy`, `.lb-pill.energy`, `.ma-energy-cost`, `.ma-energy-out`, `.bt-energy-chip` (append at the end of each file) |
| `src/data/wiki.js`, `src/data/missions.js` (comment) | §3.6 |
| `tests/systems/missions.test.js` | Chicago-instant date helpers |
| `CONTRACTS.md` §5, `docs/ECONOMY.md` (§4 + new "Energy" section), `docs/INTEGRATION_NOTES.md` | docs |

**Online follow-up in the same branch (Builder 3)**: `src/online/clanRules.js` (`weekKey`, `prevWeekKey`,
`msToWeekReset`), `src/online/adapters/localDb.js` (`bossRow` callers, `myHitsToday`, boss-hit check),
`src/online/limits.js` (`RULES.boss_hit`), `src/online/coop/rewards.js` (`applyCoopResult` with `{ plan, now }`),
`src/ui/battle/controller.js` (co-op `ctx.applyResult` passes `ctx.energyPlan`), `src/ui/screens/coop.js` (room:
a line under your own card "Out of energy — no rewards for you this run" and `confirmUnpaidReplay` before Ready /
Start), `src/ui/screens/clan.js` (`bossTab` copy + countdown), the SQL (§3.8), `docs/ONLINE.md`,
`tests/online/*`.

**Story follow-up (Builder 3, after feature/story merges)**: `src/data/story/lessons.js` (§3.7).

**Roster (spec note for its Builder 5, no edit by us)**: `src/systems/banners.js` `bannerRotation(now)` uses
`gameDayNumber(now)` for the rotation index and `nextDailyReset(now)` for `nextReset`, and its `cycle` is
`gameDay(now)`; no second Intl implementation.

---

## 5. Interactions with in-flight branches and merge order

1. **feature/online → main** (in progress) and **feature/audio → main** (D8). Wait for both; then cut
   `feature/energy-reset` from main. Reason: Builder 2 edits `controller.js` and `results.js`, which online rewrote
   (+222 / +14 lines; `ctx.applyResult`, `ctx.extraActions`); starting after it avoids the only heavy conflict.
2. **Builder 1 (reset clock) → main as soon as it is green.** It is small and touches only systems/screens that no
   other branch changes heavily. It must land **before roster Builder 5** (banners) and before the summer-event
   build (D7), which both consume `reset.js`. If roster Builder 5 already wrote its own rotation, Builder 1 makes it
   delegate, keeping the rotation index unchanged for the current cycle (test in §7).
3. **feature/balance-playtest** (round 3 running) touches `stage.js` (`DIFF_SUMMARY`, `difficultyPicker` panel,
   new `overLevelNote`/`squadLevel`), `src/data/stages.js` (hpScale, first-clear books, `CHAPTER_TUNED_LEVEL`),
   `meta-a.css` (append). Energy edits other hunks of `stage.js` (actions, `sweepControls`) and never touches
   `stages.js`. Expected: clean or one trivial CSS-append conflict. Either order works; if balance lands first,
   Builder 2 rebases.
4. **feature/story** touches `save.js` (`story:` in `createProfile`, `p.story = cleanStory(...)` in
   `migrateProfile`), `main.js` (story install after the `onAppStart` try-block), `lobby.js` (`buildTop` Menu
   entry, beta-gift timer), `commissions.js` (`codesView` reset flow), `missions.js` hub (Story tile). Energy adds
   lines at the same spots in `save.js`/`main.js` and edits `buildTop` pills — adjacent-line conflicts only; keep
   both sides. Lesson text (§3.7) goes in after story merges (or story's Builder 3 includes it if it lands later).
5. **feature/roster** bumped `SAVE_VERSION` to 3 and edits `save.js` (skins), `main.js`, `icons.js`
   (`UI_ICON_NAMES` + `'hanger'`). Energy adds no version bump; conflicts are adjacent lines in `save.js`/`main.js`.
   `src/data/units.js` and the sim are untouched by energy.
6. **Summer / Halloween event spec (D7)** consumes `gameDayStart/End` and `stage.energy`. Pointer for it:
   `gameDayEnd('2026-10-31')` = Oct 31 19:00 CDT, `gameDayEnd('2026-11-01')` = Nov 1 19:00 CST — "until
   November 1st" must pick one of these.

---

## 6. Save/migration, determinism and co-op impact

* **Save**: two additive blocks, `profile.energy` and `profile.resets`. **No `SAVE_VERSION` bump.** An older build
  that loads a newer save drops both blocks (`migrateProfile` rebuilds from `createProfile`); coming back, the save
  gets full energy and runs the switch-over again from its (old-format) keys, which is correct. Sanitizers:
  `cleanEnergy` → `value` int clamped 0…999 (default 120), `day`/`noticeDay` string or null, `at` number or null;
  `cleanResets` → `scheme` string or null, `legacyDayUntil`/`legacyWeekUntil` numbers ≥ 0, `migratedAt` number or
  null. Export/import carries both. RESET67 makes a fresh save (already on the new clock).
* **Order inside `applyBattleResult`**: the practice check stays first, so a practice run still leaves the profile
  untouched (existing test "a practice run of a locked stage (deep link) records nothing" keeps passing); the plan
  is computed before `entry[difficulty]` is set.
* **Determinism**: energy never enters `src/sim/**`. The plan is computed in the UI layer and applied after
  `sim.result()`; result rngs stay per-player (`createRng(hashString(…Date.now()))` in `results.js`). `src/data/energy.js`
  is not in the co-op data hash (`coopVersion` hashes `UNITS, ENEMIES, STAGES, MAPS, BATTLE, DIFFICULTIES,
  TYPE_CHART, COOP`), `stages.js` is unchanged, `COOP_PROTOCOL` stays 2, and `coopLoadout` is unchanged.
* **Co-op**: per-player rewards only (§3.4). A player at 0 energy plays normally and sees the unpaid note; the ally
  is unaffected. No new message, no handshake field.
* **Server**: §3.8; client `clanRules.js` and `localDb.js` mirror it so local mode behaves the same.

---

## 7. Tests

**Unit (vitest)**
* `tests/core/reset.test.js`
  * R-1 the table in §3.1 (gameDay, gameWeek, nextDailyReset), including the 25 h day on Sun 2026-11-01, the 23 h
    days on Sun 2026-03-08 and Sun 2027-03-14, and 2026-W53 → 2027-W01.
  * R-2 `nextWeeklyReset` is always a Sunday 19:00:00 Chicago; consecutive weeks are 168 h, 169 h across
    fall-back, 167 h across spring-forward.
  * R-3 the US-rule fallback equals `Intl` at every hour from 2026-01-01 to 2028-12-31 (force the fallback with an
    injected formatter).
  * R-4 `formatCountdown`: 0 → 'now', 59 s → '1m', 3 h 7 m → '3h 07m', 2 d 4 h 30 m → '2d 4h'.
  * R-5 `isNewPeriod`: null → true, equal → false, later → true, earlier (clock rolled back) → false; weeks across
    a year boundary.
  * R-6 `gameDayStart('2026-11-01')` = 2026-11-01T00:00Z, `gameDayEnd('2026-11-01')` = 2026-11-02T01:00Z.
  * R-7 `periodKeys` and `nextPeriodChange` inside and after a switch-over window, with `fixedOffsetLocal`
    (−300, −420, 0, +60, +540, +780).
* `tests/systems/resets.test.js`
  * M-1 `migrateResetScheme` runs once (marker), never for `createProfile()`; `deserializeProfile` of a v2 save
    without `resets` migrates on the next `applyResets`.
  * M-2 the six rows of the §3.3 table: simulate 96 h in 15-minute steps, "claim the login gift whenever
    claimable". Assert: never two claims with the same period key; no gap above 38 h; after the window every claim
    is at 19:00 Chicago.
  * M-3 weekly: no two weekly resets within 6 days; `currentEvent` keys are monotone over 60 days of hourly steps
    across both DST changes (no event skipped or repeated).
  * M-4 login, daily missions and Mall daily stock reset together at the same instant; weekly stock with weekly
    missions.
  * M-5 a save whose keys are ahead of the clock (clock rolled back) gets no reset until the clock passes them.
* `tests/systems/energy.test.js`
  * E-1 refill tops up to 120 at 7 PM Central, not at device midnight; 150 stays 150; the DST days refill once.
  * E-2 every `resource`, `boss` and `campaign` stage costs > 0; `challenge` costs 0; `stage.energy` overrides.
  * E-3 `planRun` matrix: first clear and new medal → `progress` at 0 energy; paid/unpaid/blocked by kind; endless,
    practice, clanBoss → `free`; coop → never `progress`/`blocked`.
  * E-4 `applyBattleResult`: paid win charges once; paid loss charges nothing and keeps the loss coins; unpaid win
    gives no rewards but still records clears, bestiary, stats and mission progress; a `blocked` deep link
    behaves as unpaid; the existing practice test still passes.
  * E-5 exploit: with 4 energy and a cost-5 replay, 50 won replays add no items or currencies; with 120 energy,
    at most 24 paid ch1 replays per game day.
  * E-6 `sweep`: ×10 with 35 energy and cost 10 runs 3, spends 30; 0 energy → `error: 'energy'`; the event 2×
    still doubles.
  * E-7 the out-of-energy notice is due once per game day.
  * E-8 `cleanEnergy` clamps negative/NaN/huge values; old saves load with 120; `SAVE_VERSION` is unchanged.
  * E-9 with `regenMinutes: 6` (injected config), +1 per 6 min up to 120; default config adds nothing over 24 h.
* `tests/systems/missions.test.js` (edited): helpers use Chicago instants; the existing expectations stay.
* `tests/online/coopEnergy.test.js` (Builder 3): `applyCoopResult` paid and unpaid per player;
  `coopVersion().data` is identical before and after importing `src/data/energy.js`; clan-boss
  `myHitsToday` resets at 7 PM Central in `localDb`.
* `tests/story/journal-data.test.js` (unchanged) must pass with the new lesson lines.

**E2E**
* `e2e/energy.mjs` (new, Playwright like `e2e/smoke.mjs`; `--viewport 844x390` and `1280x720`). Time is faked
  with `page.addInitScript` overriding `Date`/`Date.now` (not `page.clock`, whose availability in the installed
  Playwright is **UNVERIFIED**), and the context uses `timezoneId: 'America/Chicago'`. Steps:
  1. Fresh save at Tue 2026-10-13 18:50 CDT: lobby shows `[data-testid=energy]` "120/120"; `.lb-pills` and
     `.lb-tr` bounding boxes do not overlap; no horizontal page overflow.
  2. Set 1-1 cleared on Normal + Hard via `window.__sakura.store`; stage prep 1-1 Normal shows "⚡ 5 when you win";
     Hard sweep label "Sweep ×10 · ⚡50".
  3. Set energy 0: Bounty tier I shows "Not enough energy" and a disabled Start; 1-1 Normal shows "Replay (no
     rewards)"; tapping it shows `energy-out-modal` once; "Replay anyway" opens the battle; returning and tapping
     again goes straight in (no second popup).
  4. Advance the fake clock to 19:00:30 CDT: the pill shows 120/120 without a reload (reset clock) and the
     Commissions daily header countdown reads about "23h 59m".
  5. Notice shows the "New: Energy and the 7 PM reset" article.
* `node e2e/smoke.mjs` (unchanged): a fresh save's 1-1 Easy win is a first clear, so it is free and its reward
  checks still pass.

---

## 8. Build order (3 sequential builders)

Every builder ends green on: `npx vitest run` · `npx vite build` · `node e2e/smoke.mjs --viewport 844x390` ·
`node e2e/smoke.mjs --viewport 1280x720`, then commits.

**Builder 1 — the reset clock (no energy yet)**
* `src/core/reset.js`; `util.js` aliases; `systems/resets.js` (`migrateResetScheme`, `applyResets` without
  energy, `resetLabel`); `missions.js`, `shop.js`, `save.js` (`resets` only); `main.js`; `resetClock.js`;
  commissions/mall/events/notice/lobby copy and countdowns (§3.6 table), Notice article (without the energy
  paragraphs 3–4), wiki line 1, docs.
* Tests R-1…R-7, M-1…M-5, edited `missions.test.js`.
* Accept: all §3.1 vectors pass in `TZ=UTC` **and** `TZ=Asia/Tokyo npx vitest run tests/core tests/systems`;
  Commissions at 844×390 shows "resets in …(7 PM Central)"; merge to main right away.

**Builder 2 — energy**
* `data/energy.js`, `systems/energy.js`, `save.js` (`energy`), `rewards.js` (`planRun`, `sweepPlan`,
  `applyBattleResult`, `sweep`), `applyResets` refill, icon, pills, `ui/energy.js`, stage prep, sweeps in
  stage/bounty/assault/missions hub, controller + results, Notice paragraphs 3–4, wiki energy line, CSS,
  `CONTRACTS.md` §5 and `ECONOMY.md` "Energy".
* Tests E-1…E-9; `e2e/energy.mjs`.
* Accept: `node e2e/energy.mjs --viewport 844x390` and `--viewport 1280x720` pass; screenshots of lobby, stage
  prep (paid / unpaid / blocked), the popup, Bounty sweep and the results note at both sizes, reviewed for
  clipping.

**Builder 3 — online + story follow-ups**
* Co-op (`applyCoopResult`, controller `ctx.applyResult`, room line + popup), clan boss (`clanRules.js`,
  `localDb.js`, `limits.js`, `clan.js`), SQL (§3.8) + `ONLINE.md`; lesson lines (§3.7) once feature/story is on
  main; `tests/online/coopEnergy.test.js` and the schema-test updates.
* Accept: the four standard checks + `node e2e/online.mjs` (feature/online's e2e) + `node e2e/story.mjs` if story
  has merged; in local mode the clan boss shows "Attempts refill at 7 PM Central" after 3 hits.

---

## 9. Open questions for the owner (with our default)

1. **Energy refill: daily only, or also +1 every 6 minutes?** Your earlier ask was "cap 120, +1 per 6 min"; today
   you said energy lasts "for the day until you refresh". **Default: daily only — 120 at every 7 PM Central reset.**
   It keeps the popup's "no more resources today" true and needs no checking back every hour. Switching regen on
   later is one setting.
2. **Weekly reset day: Sunday 7 PM Central?** **Default: yes, Sunday 7 PM Central** — the new week is ready on
   Monday morning, the weekend stays whole, and it matches the clan boss's current weekly reset.
3. **Do Mission replays cost energy while you still have some?** **Default: yes, 5–10 per won replay** (first
   clears and new medals stay free). Otherwise anyone who keeps 1 energy could replay stages for resources forever,
   and energy would not limit anything.
