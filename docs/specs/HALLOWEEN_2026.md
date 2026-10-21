# Halloween 2026 (track 6): the owner said "This year" (Oct 20)

Build the limited-events framework from `EVENT_SPEC.md` (§1–§3, §5) and ship **Halloween as the first event on it**.
The summer port in EVENT_SPEC comes later; build only the framework parts Halloween needs, but keep them generic.

## Deadline

- **Open at ship (owner, Oct 20: "Open the event as soon it ships pls").** The window opens game day **2026-10-20**
  (Mon Oct 19, 7 PM Central), a day that is already past when v0.1.38 deploys (Oct 20–21 UTC), so the event is open
  the moment the build is live. Last game day **2026-11-01** (ends Sun Nov 1, 7 PM Central) and exchange until
  **2026-11-08** are unchanged. This replaces `EVENT_SPEC.md` E1 / §3.2's Halloween row (opens 2026-10-24, Fri Oct 23
  7 PM Central). The event now runs 13 game days instead of 9.
- It must be live **before Fri Oct 23, 7 PM Central** at the latest (the original opening).
  If the full content can't make it, ship the framework plus a smaller event on time rather than a late full one, and say
  what was cut.

## Content (defaults; every name must be our own and must not clash with an existing name in the game: grep first)

- **Theme:** the academy's autumn lantern festival night, when the monsters turn up in costumes. Wholesome and cute-spooky,
  never scary-gory. The girls are students: no costume outfits for them in this event (no new girl art); the monsters wear
  the costumes.
- **Story:** 3 short episodes in the existing story scene format/player (opening, midpoint, finale), 4–8 lines each, with
  girls the player already has (Hikari leads).
- **Stages:** 4 operations + 1 boss stage on existing maps, re-lit for night (lanterns, pumpkins, warm orange light) through
  render-side theme overrides. Event stages follow EVENT_SPEC E9 (not added to `STAGES`/`ENEMIES`). One fixed difficulty for
  operations; the boss has Normal and Hard. No energy (energy isn't built): stages are free.
- **Monster costumes:** render-only props on existing enemy families during the event (witch hats, pumpkin masks, little
  capes, ghost sheets on non-ghosts). They never cover armour/ward signs and never go on bosses (`SCREEN_IDEAS.md` D04).
- **Boss:** an original pumpkin-construct boss (our own name and look), with a simple 2-phase fight built from existing
  boss mechanics. Normal is beatable by a mid free-player team; Hard is a challenge.
- **Currency + exchange:** one event candy currency from operations and missions. The exchange sells: an event title, a
  profile frame, an avatar, gear boxes, materials, recruit tickets and a few gems, with stock limits. Leftover currency
  becomes coins by mail at the end (EVENT_SPEC E4).
- **Missions:** a short event mission list (daily and whole-event).
- **Login gift:** a small Halloween login bonus for each day of the event.
- **Lobby:** light decor while the event runs (lanterns/pumpkins overlay) and an event card in the lobby.
- **Music:** reuse the existing spooky track for event stages.
- **Co-op:** not in v1 (EVENT_SPEC E11).

## Boundaries with the other tracks

- `src/core/reset.js` game-day functions (`gameDay`, `gameDayStart`, `gameDayEnd`, `formatCountdown`, …) are defined in
  `ENERGY_RESET.md` §3.1. **Track 3 (Ascension) is implementing the same section.** Implement it exactly as written there
  (names, signatures, tests) so the two merge mechanically; list any deviation.
- Don't touch tower kits, `src/online/coop/commands.js`, gear or Ascension systems.
- Battle-side changes should be data + render only. If the sim id changes, say why.

## Build notes (track 6, `feature/halloween`)

**What shipped.** The framework (`src/data/events/{build,index,wire}.js`, `src/systems/events.js`,
`src/ui/screens/event.js`, `src/ui/events/*`) and **Pumpkin Lantern Night · Trick-or-Treat Patrol**
(`src/data/events/halloween.js`, `scenes/halloween.js`):
- Window, as `src/core/reset.js` computes it: start `2026-10-20T00:00Z` (Mon Oct 19 7 PM CDT, open at ship), end
  `2026-11-02T01:00Z` (Sun Nov 1 7 PM CST), exchange end `2026-11-09T01:00Z` (Sun Nov 8 7 PM CST). The 3 tease days
  (`2026-10-17T00:00Z` on) are before the ship, so no player sees the "upcoming" phase. Tested in
  `tests/core/resetBounds.test.js` and `tests/systems/events.test.js`. (Built for `2026-10-24`, Fri Oct 23 7 PM CDT.)
- 13 days, not 9: nothing counts "day N of the event". Episodes and operations unlock by the story chain, dailies roll
  on the game day, and login gifts are the nth gift on the nth day the player visits (nine in all; the ninth letter
  says it is the last, days 10–13 still count the daily Roll Call). Candy: 2,990 once (episodes 150, first clears
  1,040, one-time missions 1,250, login gifts 550) plus 120 a day from dailies; the limited stock costs 7,550 (15,800
  since the Oct 20 price rise, below). With no
  energy, operations sweep free (10 a tap, Op 4 = 900 candy a tap), so a farmer could empty the stock on the first day
  either way; since the Oct 20 sweep limit (10 event sweeps a game day, below) that takes about 5 days of sweeps. In v0.1.38 (7,550) a player who only did the three daily wins reached the stock around day 12 of 13 (it
  was out of reach in 9); at 15,800 that player ends the event with about half of it (Economy, below).
  The unlimited Doodle Notes offer is the sink.
- 3 episodes, 8 spoken lines each (the story lint's minimum; the brief said 4–8), Hikari leads with Aoi, Yuki,
  Sango; read = +50 candy (episode 3 also +50 gems). Unlock chain: Ep 1 → Op 1 → Op 2 → Ep 2 → Op 3 → Op 4 → boss → Ep 3.
- 4 operations (Normal only, free, sweepable once cleared; Nightmare added Oct 20, below) + the Gourdlight Golem (Normal / Hard; Nightmare added Oct 20) on existing maps
  (`shrine_gate`, `festival_street`, `shrine_steps`, `marsh_boardwalk`, boss on `shrine_sanctum`), tuned like
  2-1 / 2-3 / 3-1 / 3-3 / 3-5. Event stages are not in `STAGES`/`ENEMIES` (E9) and not in co-op (E11).
- The Golem: an original pumpkin-headed construct (render-only head), one phase change at 50 % (shell drops,
  candle wisps, it hurries). Balance (`tests/integration/event-balance.test.js`, autoPlan bot, free units only):
  every operation won on Normal at its tuneLike roster and level (3/3 seeds); boss Normal won by the end-of-chapter-3
  free team at level 20 (3/3); boss Hard lost at level 20, won at level 50.
- Pumpkin Candy (`evt_halloween_candy`), missions (3 daily, 15 one-time: 6 Nightmare added Oct 20), the Candy Exchange (title "Pumpkin
  Patroller", the Pumpkin Lantern profile frame, gear boxes, books, materials, 2 recruit tickets, 2 × 100 gems,
  coins, an unlimited Doodle Notes sink), 9 daily login gifts by mail, leftover candy → 50 coins each by mail at the
  exchange end. Settling is final (E12; shadowed in `missions.counters`).
- Lobby card + lantern/pumpkin decor, Events page list, stage-prep event line, results "New episode unlocked",
  the lantern (spooky) battle track on event stages, lantern-night lighting and monster costumes (render-only).
- Dev preview: `localStorage['sakura-dev-now'] = '<ISO instant>'` in dev builds only (`src/ui/events/clock.js`;
  not in the production bundle). `e2e/halloween.mjs` plays the whole event with it.

**Cut / later.** The event avatar (avatars are owned-girl portraits; an enemy avatar needs a new picture namespace
across profile, online card and chat), the one-time intro popup, the Notice article, Festival Friends / outfits
(none for this event by design), the bestiary event strip.

**Deviations from EVENT_SPEC.** Event stages join `STAGE_MAP`/`ENEMY_MAP` from `src/data/events/wire.js` at import
instead of edits to `stages.js`/`enemies.js` (both are hashed sim sources: the co-op id stays `37b5428d7657`).
No energy (not built): stages are free. Login gifts are "the nth gift on the nth day you visit" (never missed).
`reset.js`: the game-week block is byte-identical to `feature/ascension`; `gameDayStart`, `gameDayEnd`,
`isNewPeriod` are appended at the end of the file with ENERGY_RESET §3.1 names (`gameDayStart(key, opts)` /
`gameDayEnd(key, opts)` take the same optional `{ fallback }` as the other functions).

**Save keys (additive, no SAVE_VERSION bump).** `profile.events = { v, byId: { 'halloween-2026': { run, joinedAt,
read, daily: { day, progress, claimed }, total: { progress, claimed }, bought, owned, login: { days, last },
settled } } }`; `missions.counters` shadows `evs:<id>:<run>`, `evo:<kind>:<id>`, `evr:<episodeId>`; the item
`evt_halloween_candy`; mail ids `ev:halloween-2026:1:login:<n>|unclaimed|leftover`.

## Nightmare, the title fix and the raised prices (owner, Oct 20, 18:00 UTC)

> "pumpkin patroller title doesnt work, also can you add nightmare modes for the event stages with the final one
> being really hard, and increase how much it costs to buy items in the event shop to make grinding worth it!"

Built on `feature/event-nightmare` from v0.1.38 (`26c0de1`). Client only, no SQL, no SAVE_VERSION bump, sim id
unchanged (`37b5428d7657`), COOP_PROTOCOL untouched. This replaces the "one fixed difficulty for operations; the boss
has Normal and Hard" line of the brief above, and the 7,550-candy stock of the build notes.

### The title

**Cause.** `src/ui/profile/parts.js` `titlePlate()` passed `text: TITLES[id] ? null : '—'` to `src/ui/honorFx.js`
`titlePlate()`, which reads the name and the plate from `TITLE_MAP` (`src/data/honors.js`): achievement, freeplay and
tag titles only. The event titles live only in the profile's own table (`src/data/profileArt.js` `TITLES`), so a bought
and equipped Pumpkin Patroller read "✦ —" on the Standard plate in the picker, the editor preview, the plate under the
name, Preview and a visitor's view. Ownership, the save, the online card (`ttl`) and the server were fine; the frame
was fine everywhere.

**Fix.** `parts.titlePlate` passes the name and the tier's plate from the profile table (`honorFx.titlePlate` takes a
`plate` option): "★ Pumpkin Patroller" on the Gold plate everywhere. Nothing to buy again: a v0.1.38 purchase is
already owned (`evo:` mark) and equipped (`sensei.title`), and simply renders now. The picker's help line names the
event exchanges to an owner ("Titles come from achievements and limited-event exchanges (event candy, never real
money).") instead of "Nothing you buy gives a title". A new `evt:<titleId>` worn-title shadow (`src/systems/senseiSave.js`,
like `tagt:`) puts the title back on after a v0.1.37-or-older tab, which doesn't know the id, took it off. Tests:
`tests/ui/eventTitle.test.js`, `tests/systems/eventTitleSave.test.js`, `e2e/event-title.mjs` (buy → equip → profile,
Preview, reload, the online card, a second player's visit), and the equip steps in `e2e/halloween.mjs`.

### Nightmare

The campaign's Nightmare (`DIFFICULTIES.nightmare`: +75 % HP, ×1.15 speed, ×0.9 cash, ×1.2 upgrade cost, 1 life, no
girl income, the Sakura medal and its 100 gems once), with no new sim code (EVENT_SPEC E8 update, §3.6).

| Stage | Nightmare | Opens after | Candy per win / sweep (Normal → Nightmare) | Extra Nightmare drops |
|---|---|---|---|---|
| Op 1 Pumpkin Patch Path | its own waves | Normal medal | 60 → 120 | Super Rare book 25 % |
| Op 2 Candle Lane Costume Walk | its own waves | Normal medal | 70 → 140 | Super Rare book 25 % |
| Op 3 Ghost Lantern Steps | its own waves | Normal medal | 80 → 160 | Super Rare book 25 % |
| Op 4 Hayride Through the Fen | its own waves | Normal medal | 90 → 180 | Super Rare book 25 % |
| The Gourdlight Golem | **"Lantern Night Never Ends"** | Hard medal | 150 / 220 (Hard) → 500 | Mythic gear box 20 % |

**"Lantern Night Never Ends"** (`variants.nightmare` of the boss, `src/data/events/wire.js` `eventBattleStage`): 20 waves
instead of 15, budget 7 → 260 in 3 groups, chapter-8 coins (`tuneLike` 8-5: cash ×3.07, start 900), HP ×12 (Normal and
Hard ×2.84). Pool: ghost_wisp, goblin_dasher, slime_pearl, goblin_smoke (wave 4+), slime_violet (4+), ghoul_shambler
(5+), ghost_veilwraith (6+), ghost_phantom (8+), orc_ironhide (9+), ghost_hollowknight (12+), ghoul_gravepriest (14+).
Scripted: a lantern bearer at wave 8, two at 12, two hollow knights at 16, and **two Gourdlight Golems at wave 20**
(8 s apart, 6 s delay; their 50 % phase unchanged). A Golem has 32,382 HP there (4,124 on Normal, 5,567 on Hard).
Existing enemies, traits and difficulty rules only; no map rule. It wants Veil Sight, holy / mystic hits on the
ghosts, splash for the wisps and armor pierce for the shells. Stage prep shows its waves, enemies, HP, start cash and
name; its saved battles are record format 2 (v0.1.38 drops them with its notice instead of replaying the base waves).

**Bench** (autoPlan, the generic placement bot, over 3 seeds with the build-A team — Shiro, Kage, Aoi, Akane, Sango,
Miko, Midori, Momo + Hikari — on the shipped stages, `tests/integration/event-balance.test.js` EB-3 / EB-4; capBot's
smart mixed team (A2) and Kage army (B) from the design study, on identical stage data):

| Who | Golem Nightmare | Op 4 Nightmare | Op 2 Nightmare |
|---|---|---|---|
| Level 40, no gear | lost, wave 1 ×3 | **won ×3** | lost, wave 1 ×3 |
| Level 60, maxed gear, P1 | lost, wave 8 ×3 (capBot A2 / B at L60–70: lost by wave 8) | — | **won ×3** |
| Level 75, maxed gear, R/SR at P6 | lost, wave 8 ×3 (capBot A2: won 2 of 3; B: lost 3 of 3) | — | — |
| Level 85, late gear | **won ×3** (capBot: won 3 of 3 with every build) | — | — |

Operations (design study): Op 1 — smart builds win at L20, the generic bot needs L40; Op 2 is the hardest (two lanes of
runners from wave 1 on one heart: every L20–40 account without gear loses at wave 1; L60 with maxed gear wins); Op 3 —
smart builds win at L20–30, the free roster loses (no detection or holy / mystic damage); Op 4 — smart builds win at
L30, the generic bot at L40: the farm. HP ×15 on the boss was too hard (the L75 smart team lost); ×7–9 let L75 win with
the generic bot. Bots are pessimistic on one-life openings; a skilled mid player may do better on Ops 1, 3 and 4.

**Sweeps.** As before: up to your best medal on that stage, 10 per tap, operations only (never the boss), refused
once the operations close. Nightmare sweeps open after that operation's Nightmare medal.

**Daily sweep limit** (owner, Oct 20: "Sweep limit for now"; EVENT_SPEC §3.6 "Daily sweep limit"): **10 sweeps per
game day** across all event operations together, one Sweep ×10 tap's worth (`EVENT_SWEEPS_PER_DAY`). The day is the
7 PM Central game day and moves forward only, so setting the clock back never refills it. Battles actually played are
never limited (they pay and count as before); campaign, Bounty and Total Assault sweeps are unchanged.
- Stage prep: "Sweep ×10 · 10 left today"; with fewer left the tap sweeps what is left ("Sweep ×3 · 3 left today" pays
  3; the ×1 button shows only while it differs); at 0 the button is off and reads "Sweeps refill at 7 PM Central".
  The rewards after a sweep say how many are left (or the refill time, and no "Sweep again").
- Stored in `profile.missions.counters`: `evsw:halloween-2026` = sweeps used that game day, `evswd:halloween-2026` =
  its day number; never in the event block, which a v0.1.38 tab rewrites. This build removes them when it settles.
- **Stale tabs:** a v0.1.38 tab doesn't know the limit and sweeps as before until it is reloaded (accepted). It keeps
  the counters, so it can't reset the count for the new build, and each sweep pays once in either build: nothing pays
  twice.

**Missions** (one-time only; no new dailies, whose claims have no shadow mark):

| id | Name | Goal | Reward |
|---|---|---|---|
| hw_t_nm1 | Night Shift: Pumpkin Patch Path | clear Op 1 on Nightmare | 150 candy |
| hw_t_nm2 | Night Shift: Candle Lane | clear Op 2 on Nightmare | 200 candy |
| hw_t_nm3 | Night Shift: Ghost Lantern Steps | clear Op 3 on Nightmare | 250 candy |
| hw_t_nm4 | Night Shift: Hayride | clear Op 4 on Nightmare | 300 candy |
| hw_t_boss_nm | Lights Out (Nightmare) | the Golems on Nightmare | 1,000 candy + mythic gear box |
| hw_t_nm_clear15 | Sleepless Patrol | win or sweep 15 event stages on Nightmare (the Golem's count too) | 400 candy + mythic book |

**Gems.** EVENT_SPEC sets no cap (medal gems come from `DIFFICULTIES[d].firstClearGems`, §3.6; the summer tally of
550 is the reference). Halloween's free gems go from 610 (episode 3: 50, Hard boss mission 100, read mission 50,
login gifts 150, medals 260) to **1,110** with the five Sakura medals (+500); the new missions give none. Plus the
200 gems you can buy with candy. If that is too many, a per-stage medal-gem override is a small change.

### Exchange prices (stock limits unchanged)

| Offer | Limit | v0.1.38 | Now |
|---|---|---|---|
| Pumpkin Patroller (title) | 1 | 300 | **900** |
| Pumpkin Lantern (frame) | 1 | 600 | **1,500** |
| Recruit ticket | 2 | 500 | **1,100** |
| 100 gems | 2 | 300 | **700** |
| Mythic gear box | 1 | 450 | **1,000** |
| Super Rare gear box | 4 | 150 | **300** |
| Mythic book | 2 | 300 | **650** |
| Super Rare book | 8 | 80 | **160** |
| 5 rare books | 10 | 40 | **70** |
| 2 Super Rare charm mats | 4 | 120 | **240** |
| 2 Super Rare rune mats | 4 | 120 | **240** |
| 10 star fragments | 4 | 150 | **300** |
| 10,000 coins | 20 | 40 | **60** |
| 5 Doodle Notes (sink) | ∞ | 30 | **40** |
| **Limited stock** | | **7,550** | **15,800** |

### Economy (13 game days, Oct 20 – Nov 1; Nightmare live for about 10 of them)

No energy (stages are free); sweeps are free at 10 a tap and, since the Oct 20 sweep limit, 10 a game day (below).
Fixed candy:
episodes 150, first clears 1,040, one-time missions 1,250 (+2,300 Nightmare), login gifts 550, dailies 120 a day
(1,560 max). Per win or sweep: operations 60 / 70 / 80 / 90 (Nightmare 120 / 140 / 160 / 180); the boss 150 / 220 /
500 (never swept). Sweep ×10 = 900 candy on Op 4 Normal, 1,800 on Nightmare.

- **Before (7,550 stock):** a casual player (10 of 13 days, all dailies, one Op 4 battle and 3 sweeps a day, the boss
  on Normal) earns about 7,640: the whole stock. A grinder bought everything on day 1–2.
- **After (15,800 stock):** the same casual player (no Nightmare) affords the title + frame + both tickets + 200 gems +
  the mythic box (7,000) with 640 left: the cosmetics and a handful of picks, about 44 % of the stock (one Sweep ×10
  a day instead brings it to about 13,900). A grinder who clears Nightmare has 6,850 fixed (2,990 + 2,300 + 1,560)
  and needs about 50 Op 4 Nightmare sweeps (5 taps) or about 100 Normal sweeps for the rest; the boss's Nightmare adds
  500 a win. A mid grinder (Ops 1 / 3 / 4 Nightmare) has about 5,700 fixed and needs about 56 Op 4 Nightmare sweeps.
  Everything stays reachable before Nov 8.
- **Owner caveat (answered Oct 20: "Sweep limit for now", next bullet):** grinding here costs taps, not time. If
  "grinding" should mean playing, the lever is a daily sweep allowance (EVENT_SPEC E7 planned energy for event
  operations). For anyone who sweeps, Nightmare's doubled candy cancels the rise: the whole stock was 84 Op 4
  Normal sweeps (7,550 / 90) and is 88 Op 4 Nightmare sweeps now (15,800 / 180), about 9 taps either way (about 50
  sweeps after the fixed income), and a level-40 team without gear clears Op 4's Nightmare. So the higher prices
  mostly slow down players who don't sweep. Each Nightmare sweep also rolls the 25 % Super Rare book.
- **With the sweep limit (10 a game day), checked by `tests/systems/events-sweeps.test.js` SW-8:** counted from the
  data over the 12 game days Oct 21 – Nov 1 (the first full day this build can have; a later ship leaves unlimited
  days before it), with one win per medal and one Op 4 win a day (the 250-kill daily needs it), sweeping Op 4:
  a Nightmare grinder (every Nightmare, the Golem's too) has 10,660 without sweeps and **32,260** with them; a mid
  grinder (Op 4 Nightmare only, the Golem on Normal and Hard) 8,140 → **29,740**; a player with no Nightmare at all
  6,180 → **16,980**. All three reach the 15,800 stock before the operations close, so **the limit stays at 10**. The
  smallest daily limit that would still work: 3 (Nightmare grinder), 4 (mid grinder), 9 (no Nightmare). A Nightmare
  grinder needs about 5 days of 10 Op 4 Nightmare sweeps (1,800 candy a day) on top of the fixed income. Grinding
  faster now means playing: each Op 4 Nightmare battle pays 180, with no cap.

### Stale tabs (v0.1.38 open next to the new build)

Checked against the real v0.1.38 code (`26c0de1`) on a save the new build wrote, and back:
- The daily sweep limit (Sweeps, above): v0.1.38 doesn't know it and sweeps 10 a tap without a cap until reloaded
  (accepted). Its `cleanNumberMap` keeps the `evsw:` / `evswd:` counters word for word and it never writes them, so
  it can't refill the count here; every sweep pays once, in whichever build made it.
- v0.1.38 keeps every Nightmare medal (`progress.stages[id].nightmare`) and turns a Nightmare battle or sweep into
  practice (its `eventDifficultyOk`): it can neither earn nor erase one.
- It drops the new missions from its block but keeps their `evp:` / `evm:` marks; the new build restores progress and
  claims from them. Nothing pays twice.
- It still charges its own old prices until reloaded; stock limits and cosmetics hold across both builds (`bought` +
  `evb:` / `evo:` marks): nobody exceeds a limit, gets a cosmetic twice or pays twice. Earlier purchases are not refunded.
- A saved Golem Nightmare battle (record format 2) is dropped by v0.1.38 with its notice: that one in-progress run is
  lost if the old tab writes the save. An operation's Nightmare save stays format 1 (same waves); continued in v0.1.38
  it pays nothing (practice).
- A v0.1.37-or-older tab takes an equipped event title off; the `evt:` mark puts it back on.
- The end-of-event letter: if v0.1.38 is the first to load the save after Nov 1, 7 PM Central, its
  `ev:halloween-2026:1:unclaimed` letter holds only the missions it knows and claims only those. The new build then
  mails the finished but unclaimed Nightmare missions once in a follow-up letter, `ev:halloween-2026:1:unclaimed:2`
  (same rules: it expires with the exchange when it holds candy; first back after Nov 8, its candy joins the leftover
  coins and the rest has no expiry; claimed in the block and by `evm:` marks, so it is sent once). Tested in
  `tests/systems/events-nightmare.test.js` NM-7. (An already-open v0.1.38 tab can't get there: the store's revision
  guard stops it writing once the new build has saved. It takes a fresh v0.1.38 load: a rollback, a cached
  index.html or an imported save.)
- Not recoverable: if a v0.1.38 tab is the one that closes the run after the exchange (Nov 8, 7 PM Central: the
  leftover settle), any Nightmare mission still unclaimed then is lost. v0.1.38 drops those missions' progress from
  its block and removes the run's `evp:` / `evm:` marks when it settles, so no later build can tell what was earned or
  already paid, and the run is final (`evs:`).
- An in-progress Nightmare run: finish it on the updated build. A Golem Nightmare save (format 2) is dropped by
  v0.1.38; an operation's (format 1) can be continued there but pays nothing, and the record is then gone. The patch
  note can say "reload open tabs before you continue a Nightmare battle".
