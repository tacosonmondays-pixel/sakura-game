# EVENT_SPEC — limited events framework + "The Beach Day That Got Away" (summer port) + Halloween readiness

Owner decision **D7**, 2026-10-13 (`(design scratch)
> "Event do it now, we will also want a Halloween event that will run until November 1st! But we can discuss that
> after the important stuff goes live.."

The owner's words win over anything below. Standing rules from the same file apply everywhere: no swimwear or
fanservice on students or any chibi body, adults may be glamorous but never framed around their bodies, never ship the
old `marina`/`amane`/`*-beach` models, `roster.webp`, the old `hikari.webp` or any old swimwear art, original art and
music only, the sim stays deterministic, publishable Supabase key only, Meshy = one test first + report credits +
owner approval before any batch.

Branch to create: **`feature/events`**, cut from live `claude/sakura-sentinels` after ENERGY_RESET Builder 1
(the 7 PM Central clock, `src/core/reset.js`) has merged (§5).

**Grounding.** Every file and function named here was opened, except where marked **UNVERIFIED**.
* Live game: `/home/user/wt-spec-base` @ `d6f0226`. **Note:** live has since moved to `c064a2f` (online merged at
  `288a782`, audio merged at `c064a2f`). I read the changed files at `c064a2f` with `git show`: `src/main.js` (chat,
  clan, coop, soundtest routes), `src/ui/screens/lobby.js` (`chatButton`, Clan/Co-op/Chat menu entries),
  `src/ui/battle/results.js` (`ctx.applyResult`, `ctx.extraActions`, `out.note`, `out.coop`),
  `src/ui/battle/controller.js` (`mountBattle`, `ctx.goMap` → `mapRouteFor`), `src/ui/screens/missions.js` (Co-op
  tile), `src/systems/save.js` (audio volumes), `src/audio/routes.js` (`MENU_ROUTES`, `MAP_ROUTES`, `bossTrackFor`).
  Line numbers below are from `d6f0226` unless they say otherwise.
* `feature/story` @ `5978e6f` (scene player `db50f76`): `docs/STORY_SPEC.md`, `docs/story/BIBLE.md`,
  `src/data/story/{format,index,backgrounds,lessons}.js`, `src/ui/story/{player,play,scene}.js`,
  `src/systems/storyTriggers.js`.
* `feature/roster` @ `93d33d6` (Builder 3 running): `docs/merge/ROSTER_SPEC.md` (§1.1 D4, §1.2, §3.3, §5.3),
  `docs/merge/characters.md` (§6.1 rows 31–32, the Marina/Amane notes), `docs/merge/combat.md` §2.3–2.4,
  `src/data/skins.js`, `src/systems/skins.js`, `src/models/index.js` (`buildChibi`), `src/data/types.js`,
  `tests/data/units.test.js`.
* `feature/balance-playtest` @ `5ea7227`: `src/data/stages.js` (`CHAPTER_TUNED_LEVEL`), `src/ui/screens/stage.js`
  (`overLevelNote`, `squadLevel`), `tests/integration/balance.test.js` (`runStage`, `tools/balance/f2p.mjs` imports).
* Old Codex game (reference only): `(design scratch)
  (pretty-printed copies of `(design scratch)
* Sibling specs: `specs/ENERGY_RESET.md` (the clock and energy; this spec consumes its `reset.js` and
  `stage.energy`), `specs/KIT_STYLE_SPEC.md` (no overlap). The academy-direction spec is being written in parallel;
  its file name is **UNVERIFIED**.

---

## 1. Summary (what the owner gets)

* **A real event system.** Events are data files with a start, an end and an exchange deadline, all on the
  **7 PM Central** daily reset. Each event has its own currency, operations (stages), a boss, story episodes, daily
  and one-time missions, an exchange shop, a lobby banner, a Notice article, a one-time intro popup and mail. Two
  events can run at the same time. When an event ends, leftover currency turns into coins by mail, and the event
  stays readable as an archive. Everything you earned (girls, gear, outfits) is permanent.
* **The summer event, ported and cleaned up: "The Beach Day That Got Away — Seaglass Encore".** Summer slipped
  away, so the academy takes one last beach day at Seaglass Bay in October for the bay's end-of-season lantern
  festival. The water is too cold to swim, so nobody wears swimwear: it is sandcastles, ramune, yukata and lanterns.
  * **11 story episodes** (the 10 old ones, rewritten for the academy cast and our story rules, plus a short
    epilogue). Reading Episode 1 recruits **Marina** for free.
  * **5 seaside operations + the Seaglass Leviathan boss** on existing maps with existing enemies. The Leviathan is
    built from the existing dragon model, tinted sea-glass teal (no new 3D art). Beating it recruits **Amane**.
  * **Shell Tickets** (event currency) and the **Seaglass Exchange**: 3 Recruit Tickets, books, materials, gear and
    a "Festival Ribbon", plus an unlimited coin sink.
  * **Festival Friends** (the old "beach bonds"): gifts and short chats with Marina, Amane and Nami unlock three
    permanent festival outfits (yukata and a happi coat).
* **Marina and Amane, redesigned.** Marina becomes a **third-year student**, captain of the academy's Coast Watch
  (lifeguard) club, in a academy-anime summer sailor uniform with a lifeguard windbreaker. Amane stays an
  **adult** sea captain and guardian, in an elegant lavender captain's coat. Both ship on day one with the game's
  drawn-doll fallback and procedural chibis; their drawn portraits come from Meshy **after one paid test image
  (9 credits) and your approval**.
* **Dates (recommended):** Summer **Fri Oct 16, 7 PM CDT → Sun Nov 1, 7 PM CST**, exchange open until
  **Sun Nov 8, 7 PM CST**. Halloween **Fri Oct 23, 7 PM CDT → Sun Nov 1, 7 PM CST**, so both end together.
* **Halloween is mostly data on this framework.** §3.15 lists every field. Its content must be merged by
  **Wed Oct 21** for the recommended 9-day run; **Fri Oct 23 is the hard latest** for a full 7-day week
  (opening Sun Oct 25).

---

## 2. Decisions and assumptions

| # | Topic | Decision / reading | Status |
|---|---|---|---|
| D7 | Port the summer event now on a generic framework; Halloween follows as data and ends by Nov 1 | Owner | Owner |
| E1 | **Window** | Summer: opens game day `2026-10-17` (Fri Oct 16 19:00 CDT), last game day `2026-11-01` (ends Sun Nov 1 19:00 CST), exchange last day `2026-11-08` (Sun Nov 8 19:00 CST). Halloween: `2026-10-24` → `2026-11-01`, exchange `2026-11-08`. "Until November 1st" = **through** Sunday Nov 1, ending at that day's 7 PM CST reset (which is also the weekly reset). | **ASSUMPTION → Q1** |
| E2 | **Title** | Keep the old title "The Beach Day That Got Away"; banner line "Seaglass Encore · an end-of-summer festival". The story says why it is October and why nobody swims. | **ASSUMPTION → Q1** |
| E3 | **Marina's age** | The old Marina is **23**, the old Amane **26** (`summer-content.js` `SUMMER_UNITS`). Our roster rule is "only heroes are adults" (`tests/data/units.test.js` "only heroes are adults"; ROSTER_SPEC D3), and Marina is a tower. So **Marina becomes a third-year student** (age never stated) and is dressed modestly. Amane stays an adult hero. | **ASSUMPTION → Q2** |
| E4 | **Leftover currency** | At the exchange deadline, leftover event currency is removed and mailed back as **coins (1 → 50)**. Not "expire" like the old game (`season-ui.js` shop text: "Unspent tickets then expire"). | **ASSUMPTION → Q3** |
| E5 | Who can join | Clear **1-5** (end of chapter 1; Nami, who appears in the story, joins at 1-5). The old game asked for 6 chapters. | Ours |
| E6 | Event girls | Marina and Amane are **limited**: not in the gacha pool, not sparkable, not on featured banners, and not needed for "Full Roster". They are permanent once earned. | Ours |
| E7 | Event stages and energy | Operations cost energy through `stage.energy` (ENERGY_RESET §3.4 `energyCost` honours it): 10/10/12/12/15, boss 20. First clears stay free. Operations can be swept once cleared; the boss cannot. **Update (owner, Oct 20, Halloween 2026: "Sweep limit for now"):** no energy yet; event sweeps are capped at `EVENT_SWEEPS_PER_DAY` (10) per game day across all of an event's stages together; battles played are never limited (§3.6 "Sweeps"). | Ours → Owner |
| E8 | Difficulty | Operations have one fixed difficulty (**Normal**). The Leviathan has **Normal** (story) and **Hard** (challenge). **Update (owner, Oct 20, Halloween 2026: "add nightmare modes for the event stages with the final one being really hard"):** an event stage may add **Nightmare** (the campaign's `DIFFICULTIES.nightmare`, no new rules), gated by a medal on the same stage (`unlockAfter`: an operation's Nightmare after its Normal medal, the boss's after its Hard medal). A difficulty may play its own waves (`variants`, §3.6): Halloween's boss Nightmare does. | Ours → Owner |
| E9 | Where event data lives | Event stages and enemies are **not** added to `STAGES`/`ENEMIES` (59 and 74 stay; many tests count them). They are merged only into the lookup maps `STAGE_MAP`/`ENEMY_MAP`, which is all the sim and the battle UI read. | Ours |
| E10 | Story episodes | Event episodes use the story scene format and the story scene player (`playStoryScene`). If feature/story is not on main when Builder 2 starts, a small fallback reader ships instead (§3.9). | Ours |
| E11 | Co-op | Event stages are **not** offered in co-op v1 (`coopStages` stays campaign only). | Ours |
| E12 | Clock | Device clock, as everywhere else (ENERGY_RESET A10). Settling an event is final: rolling the clock back never reopens a settled event. | Ours |
| E13 | Overlap | Any number of events may overlap; the UI is designed and tested for two. Energy is shared; currencies, missions and shops are per event. | Ours |
| E14 | Halloween content | Only the framework, a disabled draft file and the checklist ship now. Names, story and rewards are discussed with the owner after the important work is live (D7). | Owner (D7) |

---

## 3. Design

### 3.1 Lifecycle

| Phase | When (`now` vs window) | What the player sees and can do |
|---|---|---|
| `hidden` | draft event (outside dev preview), or `now < teaseAt` | nothing |
| `upcoming` | `teaseAt ≤ now < startAt` (`teaseAt = startAt − 3 days`) | Events page teaser card "Opens in 2d 4h"; no lobby card; event page shows the countdown only |
| `active` | `startAt ≤ now < endAt` | everything: story, operations, missions, exchange, friends |
| `exchange` | `endAt ≤ now < exchangeEndAt` | exchange and story replays only. Operations and missions are closed. At `endAt` finished-but-unclaimed mission rewards are mailed once (§3.10) |
| `ended` | `now ≥ exchangeEndAt`, or the save's event is settled | archive: story replays, a summary card. Leftover currency → coins by mail, state pruned (§3.10) |

### 3.2 Time — on the 7 PM Central clock (no second clock)

Windows are written as **game days** (ENERGY_RESET §3.1: a game day `YYYY-MM-DD` runs from 7 PM Central the
evening before to 7 PM Central that day, DST-aware):

```js
window: { opens: '2026-10-17', lastDay: '2026-11-01', exchangeLastDay: '2026-11-08' }
// startAt       = gameDayStart(opens)          // the 7 PM Central reset that starts that game day
// endAt         = gameDayEnd(lastDay)           // the 7 PM Central reset that ends that game day
// exchangeEndAt = gameDayEnd(exchangeLastDay)
```

`src/systems/events.js` imports `gameDay`, `gameDayStart`, `gameDayEnd`, `isNewPeriod`, `formatCountdown` and
`localResetHint` from `src/core/reset.js` (ENERGY_RESET §3.1). It never builds an `Intl` formatter itself.
`reset.js` does not exist on live yet (**UNVERIFIED** until energy Builder 1 lands); see §5 if it slips.

The windows, as instants (a test checks `reset.js` produces exactly these):

| Event | Field | Game day | Chicago wall clock | UTC instant |
|---|---|---|---|---|
| Summer | startAt | 2026-10-17 | Fri Oct 16 19:00 CDT | 2026-10-17T00:00:00Z |
| Summer | endAt | 2026-11-01 | Sun Nov 1 19:00 CST | 2026-11-02T01:00:00Z |
| Summer | exchangeEndAt | 2026-11-08 | Sun Nov 8 19:00 CST | 2026-11-09T01:00:00Z |
| Halloween (recommended) | startAt | 2026-10-24 | Fri Oct 23 19:00 CDT | 2026-10-24T00:00:00Z |
| Halloween (latest full week) | startAt | 2026-10-26 | Sun Oct 25 19:00 CDT | 2026-10-26T00:00:00Z |
| Halloween | endAt | 2026-11-01 | Sun Nov 1 19:00 CST | 2026-11-02T01:00:00Z |
| Halloween | exchangeEndAt | 2026-11-08 | Sun Nov 8 19:00 CST | 2026-11-09T01:00:00Z |

Event dailies reset when `isNewPeriod(state.daily.day, gameDay(now))` is true, at the same instant as Commissions
and energy. Display copy never hard-codes a date: "Oct 16 – Nov 1 · ends 7 PM Central" is formatted from the window
(plus `localResetHint()` as a tooltip, e.g. "9:00 AM your time").

**A battle started before `endAt` still pays** if it finishes after it: the reward gate uses the battle's start time
(`ctx.startedAt`, §3.6), not the finish time.

### 3.3 Data model

**Files** (all plain data, no DOM; nothing here imports `stages.js`, `enemies.js`, `items.js` or `units.js`, so
those files can import the registry without an import cycle):

```
src/data/events/index.js        registry: ALL_EVENTS, EVENTS (no drafts), EVENT_MAP, EVENT_STAGES, EVENT_ENEMIES,
                                EVENT_CURRENCIES, eventById(id), eventOfStage(stageId), eventOfItem(itemId)
src/data/events/build.js        builders + validation: eventStage(), eventEnemy(), offer(), mission(), episode(),
                                P()/F()/D() (copies of the 1-line helpers in stages.js), EVENT_ICON_SHAPES
src/data/events/seaglass.js     the summer EventDef
src/data/events/halloween.js    the Halloween EventDef, draft: true (Builder 3; content after the owner's input)
src/data/events/scenes/seaglass.js   the episode scenes (lazy chunk; story scene format)
src/data/unitsEvent.js          EVENT_UNITS = [MARINA, AMANE] (UnitDefs; appended to UNITS by one line in units.js)
```

**EventDef** (`seaglass.js`, abridged; full tables in §3.13):

```js
export default {
  id: 'seaglass-2026',             // save key forever; never reused
  key: 'seaglass',                 // short slug for derived ids: ev-seaglass-1, evt_seaglass_shell, sg_*
  name: 'The Beach Day That Got Away',
  subtitle: 'Seaglass Encore',
  tagline: 'An end-of-summer festival',
  draft: false,                    // true: only tests and the dev preview see it
  window: { opens: '2026-10-17', lastDay: '2026-11-01', exchangeLastDay: '2026-11-08' },
  teaseDays: 3,
  unlock: { stage: '1-5' },        // first clear of a campaign stage
  theme: {
    color: '#2ec4b6', accent: '#ffd395',
    art: 'events/seaglass.webp',   // public/art/lobby/events/… (after the art lands)
    fallbackArt: 'thumbs/sango.webp', fallbackTint: 'sunset',   // what ships before the art exists
    hosts: ['marina', 'nami'],     // first one with drawn art (hasPortrait) stands on the event page
  },
  currency: {
    id: 'evt_seaglass_shell', name: 'Shell Ticket', plural: 'Shell Tickets',
    desc: 'Earned at the Seaglass Encore event. Spend it in the Seaglass Exchange before Nov 8, 7 PM Central.',
    icon: { shape: 'shell', color: '#ffb6a2', accent: '#5ec7cf' },
    leftover: { to: 'coins', rate: 50 },
  },
  stages: [/* eventStage(…) ×6, §3.13.4 */],
  enemies: [/* eventEnemy(dragon_leviathan), §3.13.5 */],
  episodes: [/* episode(…) ×11, §3.13.3 (meta only; text is in scenes/seaglass.js) */],
  missions: { daily: [/* 3 */], total: [/* 9 */] },
  shop: [/* 18 offers, §3.13.7 */],
  friends: {/* Festival Friends, §3.13.8 */},
  notice: { title, date, body: [/* 3 paragraphs */] },
  intro: { kicker, body },
  mail: { welcome: {…} | null, unclaimed: {…}, leftover: {…} },
};
```

**Id rules** (the registry test enforces them): stage ids `ev-<key>-<n>` and `ev-<key>-boss`; currency
`evt_<key>_<name>`; offers/missions `<prefix>_<name>` unique across all events; episode ids `ev.<key>.<nn>`; event
enemy ids use an existing family prefix (`dragon_leviathan`). Ids are never reused by a later event, because saves keep
progress (`profile.progress.stages`), bestiary entries and items under them.

**Builders.** `eventStage(event, o)` returns the full StageDef shape that `campaign()`/`bossStage()` return in
`src/data/stages.js` (id, kind, name, mapId, desc, waves, waveGen, hpScale, cashScale, startCash, lives, introduces,
recommended, unlocks, requires, drops, firstClear, scenery, tier) plus the event fields:

```js
{ kind: 'event', event: 'seaglass-2026', difficulties: ['normal'] | ['normal', 'hard'],
  energy: 10, tuneLike: '2-1', boss: false,
  gate: { episode: 'ev.seaglass.01' },          // + `requires` = the previous operation
  eventReward: { firstClearGear: { slot: 'charm', rarity: 'mythic', name: 'Seaglass Focus' } } }
```

Two optional fields (Halloween 2026, E8 update): `unlockAfter: { nightmare: 'hard' }` names the medal a difficulty
waits for on the same stage (`src/systems/events.js eventDifficultyStatus`), and `variants: { nightmare: eventVariant({…}) }`
gives one difficulty its own waves (`name`, `desc`, `sub`, `tuneLike`, optional `hpScale` / `cashScale` / `startCash` /
`tier`, `waves`, `budget`, `groups`, `pool`, `fixed`; built like the stage's own). `validateEvent` checks both against
`difficulties` and the ladder; `tests/data/events.test.js` EV-2b checks the variant's enemies and builds its Sim.

`hpScale`, `cashScale`, `startCash` and `budget` are **not written in the event file**. `src/data/stages.js` copies
them from the `tuneLike` campaign stage while it builds `STAGE_MAP` (new internal `resolveEventStage(def)`), so event
difficulty follows the balance branch's re-tuning automatically. A def may override any of them.
`eventEnemy(o)` returns exactly the EnemyDef shape of the internal `enemy()` builder in `src/data/enemies.js`
(a test compares the key sets).

### 3.4 How event data joins the existing tables

| Table | Change | Why |
|---|---|---|
| `src/data/stages.js` `STAGE_MAP` | built from `[...STAGES, ...EVENT_STAGES.map(resolveEventStage)]`; `STAGES` unchanged (59) | the sim (`src/sim/data.js` `defaultData()` reads `STAGE_MAP`), `getStage`, `controller.js`, `results.js`, stage prep all look up by id. `tests/data/world.test.js` asserts `STAGES.length === 59` and only four kinds |
| `src/data/enemies.js` `ENEMY_MAP` | built from `[...ENEMIES, ...EVENT_ENEMIES]`; `ENEMIES` unchanged | the sim uses `ENEMY_MAP`; world.test.js caps `ENEMIES.length ≤ 75` and requires every enemy in `ENEMIES` to appear in some `STAGES` stage |
| `src/data/items.js` | `ITEM_CATEGORIES.event = { name: 'Event Currency', tab: 'tokens', order: 7.5 }`; `'event'` added to the `tokens` entry of `BACKPACK_TABS.categories`; `buildItems()` adds one item per `EVENT_CURRENCIES` entry (rarity `rare`, `sort: 7100 + i`, plus `event: id`) for **every** event, drafts and past events included | saves keep the item (`migrateProfile` drops unknown items); mail and mission rewards can carry it (`cleanMail` `isRewardId` only rejects category `currency`). Pills use `itemIcon(id)` (`currencyIcon` only knows `SPECIAL_ITEMS`) |
| `src/art/icons.js` `itemBody` | `evt_*` → `eventCurrencyBody(shape, color, accent)` (new in `src/art/icons/items.js`, next to `tokenBody`) | `tests/integration/consistency.test.js` "every item has a dedicated icon" (`hasItemIcon`) |
| `src/data/units.js` | `UNITS.push(...EVENT_UNITS)` (one line, like roster's `unitsExpansion.js` line) | Marina/Amane are normal UnitDefs (sim, co-op loadout, Students, formation) |
| acquisition | `{ type: 'event', event: 'seaglass-2026', how: 'story' \| 'boss', note }` inside the existing `acquisition` key (UnitDef keys are fixed: `UNIT_KEYS` in units.test.js) | |
| `src/systems/gacha.js` `POOL` (lines 16–20) | `UNITS.filter((u) => u.rarity === r && u.acquisition.type !== 'event')` | limited girls |
| `src/data/shop.js` spark offers | `UNITS.filter((u) => u.rarity === 'SSR' && u.acquisition.type !== 'event')` | Amane is SSR |
| `src/data/missions.js` `a_units_all` | metric `permanentUnitsOwned`, goal = count of non-event units; `src/systems/missions.js` `metricValue` gains that case | "Full Roster" stays reachable after the event |
| `src/systems/missions.js` `discoverableEnemies` | unchanged — it walks `STAGES`, so event enemies never enter the bestiary % | 100 % stays reachable |
| `src/systems/inventory.js` | `KIND_LABEL.event = 'Event'`, `KIND_ROUTE.event = 'event'`; `buildSourceIndex` adds `{ kind: 'other', label: 'Event · <name>', route: 'event', params: { id }, note: 'Operations, missions and episodes · until <date>' }` per currency | "Where to get"; the consistency test checks the route is registered |
| roster banners (feature/roster Builder 5, `src/systems/banners.js`, not built — **UNVERIFIED**) | featured picks skip `acquisition.type === 'event'` | spec note for that builder |

### 3.5 Save layout — `profile.events` (additive, no `SAVE_VERSION` bump)

```js
profile.events = {
  v: 1,
  byId: {
    'seaglass-2026': {
      run: 1,                       // reruns later reuse the id with run 2 (currency, missions, shop reset)
      joinedAt: 1760659200000,      // first visit while active (null before)
      read: ['ev.seaglass.01'],     // episodes whose first-read reward was granted (kept after settle)
      daily: { day: '2026-10-18', progress: { sg_d_clear3: 2 }, claimed: ['sg_d_login'] },
      total: { progress: { sg_t_clears30: 12 }, claimed: ['sg_t_op1'] },
      bought: { sg_ticket: 1 },
      friends: { love: { marina: 40 }, chats: { 'marina:0': 1 }, gifts: { shell: 2, ramune: 0, charm: 1 }, outfits: ['marina_festival'] },
      mailed: { welcome: true, unclaimed: false },
      settled: null,                // { at, currency: 340, coins: 17000 } once settled — final
    },
  },
};
```

* `cleanEvents(raw)` (new, `src/systems/events.js`, called from `migrateProfile`): keeps known event ids only,
  numbers clamped ≥ 0, strings/lists typed, unknown mission/offer ids dropped. `createProfile` gets
  `events: newEvents()` = `{ v: 1, byId: {} }`.
* Event currency lives in `profile.items[currency.id]` (an ordinary item). Event girls live in `profile.units`,
  outfits in `profile.skins` (roster save v3), stage medals in `profile.progress.stages`, bestiary in
  `profile.bestiary`. Nothing event-specific is stored twice.
* After settle the state is pruned to `{ run, joinedAt, read, friends: { outfits }, settled }` (a few hundred bytes).
* The daily sweep count (§3.6 "Sweeps") is not in the block: `profile.missions.counters['evsw:<eventId>']` = sweeps
  used that game day and `['evswd:<eventId>']` = its `gameDayNumber` (counters hold numbers only). An older build's
  `cleanEvents` rewrites the block but keeps the counters word for word, so it can't refill the allowance. Settling
  removes both.

### 3.6 Battle flow

**Entry.** Every operation opens the existing stage prep (`#/stage/ev-seaglass-1`, `src/ui/screens/stage.js`
`render`). Changes there:
* `render`: `state.difficulty` is forced into `stage.difficulties` (default its first entry).
* `difficultyPicker`: shows only `stage.difficulties` (one button for operations, two for the boss).
* `buildPrep`: a new **event panel** above the drop grid: the event name, "Ends in 6d 4h · 7 PM Central", the
  requirement line when locked, and "Shell Tickets ×70 per win" from the drop table. A closed event shows "This event's
  operations have ended — your girls, gear and outfits are permanent." and disables Start.
* `requirementText`: for `kind === 'event'` returns `eventStageStatus(...).text` (e.g. "Read Episode 3 first",
  "Clear Lemonade Lagoon first", "Clear 1-5 to join the festival").
* `stageLabel`: `KIND_LABEL.event` → "Event".
* `firstClearPanel` works unchanged (the stage has `firstClear`); medal gems still come from
  `DIFFICULTIES[d].firstClearGems` in `applyBattleResult`.
* Energy (when ENERGY_RESET Builder 2 is in): the cost line and `blocked` state come from `planRun` for free; the
  energy spec already lists event stages under "any other kind → blocked when short".

**Battle.** `src/ui/battle/controller.js` `mountBattle` sets `ctx.startedAt = Date.now()` at mount.
`src/ui/battle/setup.js` `mapRouteFor` gains `case 'event': return { name: 'event', params: { id: stage.event, tab: 'stages' } }`;
`followingStage` stays campaign-only, so the results screen shows Retry / Map / Home and "Map" returns to the event page.

**Rewards.** `src/systems/rewards.js` `applyBattleResult(profile, result, rng, { now, startedAt })` gets two calls into
`src/systems/events.js` and nothing else:
1. Right after the existing practice check: `const gate = eventRunGate(profile, stage, startedAt ?? now)`. When
   `!gate.ok` the run records nothing (same shape as a practice run) and returns `{ ...out, practice: true, note: gate.text }`
   — e.g. "The Seaglass operations closed before this battle started — no rewards."
2. Just before `out.rewards = addItems(profile, rewards)`: `Object.assign(out, eventAfterBattle(profile, stage, { won,
   firstClear: out.firstClear, difficulty, totalKills, bossKills, rng, now }))`. It tracks event missions, rolls the
   boss's first-clear gear (`rollGear(rng, { slot, rarity })` + `addGear`, name set from the def), gives a Festival
   Friends gift on a win, and returns `{ event: { id, newEpisodes: ['ev.seaglass.03'], gear } }`.

Shell Tickets themselves are an ordinary drop (`D('evt_seaglass_shell', 1, 70, 70)`), so `rollStageDrops`, sweeps
and the results tiles need no change. Amane is granted by the boss's `unlocks: { units: ['amane'] }`, so the existing
`unlockCard` celebration plays. `src/ui/battle/results.js` `apply()` passes `{ now: new Date(), startedAt: ctx.startedAt }`
and the rewards view adds one line for `out.event.newEpisodes` ("New episode unlocked: The Great Watermelon Trial").

**Sweeps.** `canSweep`: an event operation (not the boss) is sweepable once cleared on its difficulty. `sweep`
returns `{ ok: false, error: 'event' }` when the phase is not `active` and calls `trackEvent(..., 'eventClear', n)`.
As everywhere, a difficulty sweeps only up to the best medal held there (an operation's Nightmare after its
Nightmare medal), 10 per tap (`MAX_SWEEPS`); `trackEvent` gets the difficulty.

**Daily sweep limit (owner, Oct 20: "Sweep limit for now").** Event sweeps are capped at `EVENT_SWEEPS_PER_DAY` = 10
per game day (one Sweep ×10 tap's worth), all of an event's stages together; campaign, Bounty and Total Assault sweeps
and every battle actually played are unchanged. `src/systems/events.js` `eventSweepsLeft(profile, eventId, now)` →
`{ limit, used, left, refillsAt }` and `useEventSweeps(profile, eventId, n, now)` keep the count in the
`evsw:` / `evswd:` counters (§3.5). The day is `gameDayNumber` on the 7 PM Central clock and moves forward only
(`isNewPeriod`): a clock set back keeps the later day's count, so it never refills early. `sweep` checks the limit
after its other refusals (`'event'`, `'difficulty'`), sweeps `min(times, left)` (a ×10 tap with 4 left sweeps 4 and
pays 4), counts them in the same call that pays them, and returns `sweepsLeft`; with none left it returns
`{ ok: false, error: 'limit' }` and changes nothing. Stage prep: the main button reads "Sweep ×10 · 10 left today"
("Sweep ×3 · 3 left today" with 3 left; the ×1 button only while it differs), and at 0 it is off and reads "Sweeps
refill at 7 PM Central" (its tooltip adds the local time outside Central); the rewards after a sweep say what is left
and drop "Sweep again" at 0. A stale v0.1.38 tab doesn't know the limit and sweeps as before until reloaded
(accepted): it can't reset the count (it keeps the counters) and every sweep pays once in either build.

**More difficulties on an event stage (E8 update; Halloween 2026).** `stage.difficulties` lists them all
(`['normal', 'nightmare']`, the boss `['normal', 'hard', 'nightmare']`); `unlockAfter` gates one behind a medal.
* `src/systems/events.js` `eventDifficultyStatus(profile, stageId, d)` → `{ ok, reason: null | 'difficulty' | 'medal',
  needs, text: 'Clear Hard first' }`.
* `applyBattleResult`: a locked difficulty (a hand-made link) is practice, like a difficulty the stage doesn't offer
  ("Nightmare opens here after a Hard clear — this run was practice, no rewards."). `sweep` refuses it
  (`error: 'difficulty'`). `parseBattleParams` marks such a run `practice` (never saved).
* Stage prep: the picker shows every difficulty of the stage; a locked one shows a lock and "Clear Hard first", can be
  picked to look at its waves and rewards, and Start / New game stay off with the lock note. The first-clear panel
  lists the medal gems of the stage's own difficulties only. Drop entries with a `difficulty` roll at that difficulty
  or harder (`rollStageDrops`), so a Nightmare drop row adds to the Normal one.
* **Variants.** `src/data/events/wire.js` `eventBattleStage(stageId, d)` returns the registered stage with the
  variant's waves, wave generator, HP and economy (frozen, cached, same id), or null. `createBattleSim` passes it as
  `data.stage` (like solo freeplay's stage) and `restoreSim` does the same on Continue, so the wave tables match.
  Rewards, medals, drops and the save slot stay the stage's own. Stage prep shows the variant's waves, enemy chips,
  HP and start cash, its name and description, and its `sub` line in the picker. The battle preloads the variant's
  enemy families. Nothing in `src/sim/**` changes (the co-op id stays; event stages never run in co-op, E11).
* **Battle saves.** A run on a variant is written as record format 2 (`RECORD_V` 2, `recordVersion`); every other run
  stays format 1. A build from before variants (v0.1.38: `RECORD_V` 1) drops a format-2 record on load with its
  dropped-save notice instead of replaying the base waves. `cleanRecord` and `saveSummary` measure a variant run by
  its own waves (Continue · Wave 17/20).

### 3.7 Missions

Mission def: `mission({ id, kind: 'daily'|'total', name, desc, on, goal, rewards })`. `on` is one of
`eventLogin` (counted once per game day on the first event-page visit or app start while active),
`eventClear` (wins and sweeps of this event's stages), `eventBoss` (boss wins; `difficulty` filter optional),
`eventKill` (kills in this event's stages), `eventRead` (episode first reads), `eventStage` (first clear of a named stage).
Only `src/systems/events.js` emits these; the global `track()` in `src/systems/missions.js` is untouched, so event
battles still count for normal Commissions through the existing `track(profile, 'battleWin', 1)` etc.

* Progress counts only while the event is `active`. Claims are allowed while `active`. At `endAt` every completed
  but unclaimed reward is mailed in one letter and the Missions tab shows "Missions are over — unclaimed rewards were
  sent to your Mail."
* "Claim all" (`claimAllEventMissions`) claims dailies first, then one-time missions.
* Daily progress resets on the 7 PM Central game day (§3.2).
* `eventStage` counts a stage's first clear **and each new medal** on it, with the difficulty, so a one-time mission
  can ask for one difficulty (`mission({ on: 'eventStage', stage, difficulty: 'nightmare' })`). `eventClear` (wins and
  sweeps) and `eventBoss` carry the difficulty too (`mission({ on: 'eventClear', difficulty: 'nightmare' })`).
* **Missions added while an event runs** (Halloween's Nightmare missions): one-time (`total`) only. Their progress and
  claims are shadowed by the `evp:` / `evm:` marks, so an older tab that drops the unknown ids from the block never
  makes them pay twice (`cleanEvents` restores the larger of block and mark). Never add **dailies** mid-event: daily
  claims have no shadow, so an older build's save would reopen them the same day.

### 3.8 Exchange (event shop)

Offer def: `offer({ id, item, count, price, limit | null, gear?: { slot, rarity, name }, requires?: { stage } })`.
`price` is in the event currency. `limit: null` = unlimited (the coin/book sink). `requires` hides an offer until a
campaign stage is cleared (the Festival Ribbon waits for 2-1, the Equipment lesson in STORY_SPEC §3.3).

**Changing prices while an event runs** (Halloween 2026, owner Oct 20): prices may change in a new build; stock limits
may not. Limits are shared with older tabs and earlier buyers through `bought` and the `evb:` marks, so a player never
exceeds a limit or gets a cosmetic twice across builds. An older tab keeps charging its own (old) prices until it
reloads; nothing bought earlier is refunded, and the patch note says the prices changed.

`buyEventOffer(profile, eventId, offerId, qty, rng, now)`: allowed in `active` and `exchange`; checks stock and funds
before changing anything (like `buyOffer` in `src/systems/shop.js`), pays with `consumeItems`, grants with `addItems`,
or rolls gear with `rollGear(rng, …)` + `addGear` (the UI passes `uiRng()` from `stage.js`). Returns
`{ ok, error?: 'unknown'|'closed'|'soldOut'|'funds'|'locked', rewards, gear }`.

### 3.9 Story episodes

**Format.** Each episode is a scene built with `scene()/say()/narrate()/cue()/choice()` from
`src/data/story/format.js` (STORY_SPEC §1.2), with `chapter: 0`, `kind: 'event'` (already in `SCENE_KINDS`) and
`trigger: null` (archive-only; the event decides when it unlocks). Scenes live in
`src/data/events/scenes/seaglass.js`, loaded lazily (`import()`) by the event screen, and are **not** added to the
story's `SCENE_LIST`. Everything the story lint enforces applies (a test runs the same checks): ≤ 110 characters per
line (`LIMITS.lineChars`), 8–18 spoken lines, ≤ 1 choice, ≤ 4 portraits, titles ≤ 32 characters, names as tokens
(`{name:marina}`), closed face list, Sensei never described, no romance, nobody hurt ("poofs home"). Backgrounds come
from the existing set: `stage:2-1`, `stage:2-3`, `stage:2-5`, `stage:7-1`, `stage:7-2` (stills of the maps the
operations reuse), `academy-sunset`, `academy-night`, `cg:sango-harbour`. The Leviathan speaks as
`say('dragon_leviathan', …)`: `plateFor` in `src/ui/story/player.js` reads `ENEMY_MAP`, which includes event enemies,
so it gets a name plate and no portrait.

**Playing.** The event screen calls `playStoryScene(scene, { host, scenes: eventEpisodes })` from
`src/ui/story/play.js`. That marks the scene seen in `profile.story.seen` and grants `STORY_REWARDS.event` (already
`[]`, so nothing). Then the event screen calls `readEpisode(profile, eventId, episodeId, now)`, which grants the event's
first-read reward (40 Shell Tickets), Marina on Episode 1, and counts `eventRead`. **Skipping counts as reading** (genre
convention, as in STORY_SPEC §1.3). Replays grant nothing. One small edit in the story player:
`titleCardText` returns `{ kicker: 'Event Story', title, sub: 'Episode n' }` for `scene.kind === 'event'` (today it
would say "Opening" because the chapter is 0).

**If feature/story is not on main when Builder 2 starts** (it is at `5978e6f`, Builder 2 WIP):
1. Write the scenes with `src/data/events/sceneFormat.js`, a copy of the four builders' **output shape** only
   (`{ t: 'say', who, text, at?, face?, fx? }` etc., STORY_SPEC §1.2 table), with no vocabulary of its own.
2. Ship `src/ui/events/reader.js`: a minimal reader (portrait from `portraitHTML(unit, 'cut')`, name plate, text box,
   tap/Space to continue, choice buttons, Skip). About 150 lines.
3. The event screen loads the real player when it exists:
   `const STORY = import.meta.glob('../story/play.js')` (the same "missing file yields nothing" pattern as
   `src/sim/data.js`); if the glob is empty it uses `reader.js`.
4. When story lands: switch the scene import to `format.js` (same output shape), delete `sceneFormat.js` and
   `reader.js`, and turn on the `event-scenes` test's `scene()` re-validation. Do **not** cherry-pick story commits.

**After the event.** The event page stays reachable from the Events page "Past events" list, with the Story tab in
read-only replay mode. (A later story change may add an "Events" tab to `#/story`; not needed now.)

### 3.10 Mail, leftover currency, settle and archive

`settleEvents(profile, now)` runs from `src/main.js` at app start (next to `onAppStart`/`applyResets`) and from
`startResetClock` (ENERGY_RESET §3.6) on every fire. It is idempotent:

| When | What (once per event per save) | Letter |
|---|---|---|
| `now ≥ startAt` and joined-eligible | optional welcome gift (`mail.welcome`) | "A postcard from Seaglass Bay" — 100 Shell Tickets + 3 Study Guides, `expiresAt: exchangeEndAt` |
| `now ≥ endAt` | completed, unclaimed mission rewards; daily + total | "You left these on the beach!" — `expiresAt: exchangeEndAt` when it holds event currency, else `null`. First settled at or after `exchangeEndAt` (an offline player): the currency is left out of the letter and counted in the leftover below, the rest has no expiry (`mail.unclaimed.lateBody`), so the letter is never born expired |
| `now ≥ exchangeEndAt` | `n = itemCount(currency)`; remove it; also leftover gifts (100 coins each); mark `settled`; prune state | "Thanks for visiting Seaglass Bay" — `coins: n × 50 + gifts × 100`; no expiry; skipped when 0 |

Letters use `deliverMail` (`src/systems/mail.js`), ids `ev:<eventId>:<run>:welcome|unclaimed|leftover`, so
`delivered` stops any double grant. One-time missions added mid-event (Halloween's Nightmare ones, Oct 20): when the
`unclaimed` letter was already sent by an older build that didn't know them, the ones still finished but unclaimed
come once in `ev:<eventId>:<run>:unclaimed:2`, with the same expiry and late rules and the same claims and `evm:`
marks. Letters that still hold event currency at `exchangeEndAt` are already expired
(`claimMail` refuses expired letters), so nothing is lost twice. Body copy in §3.13.9.

**Archive.** A finished event's **code stays**: its EventDef, stages (still in `STAGE_MAP`, so old progress and
bestiary entries resolve), enemies, currency item (still in `ITEMS`, at 0) and scenes. The UI hides past events
everywhere except the Events page "Past events" list and its read-only event page. A rerun is a new `window` entry with
`run: 2`; the code path exists (state keyed by `run`), but no rerun is planned.

### 3.11 Two overlapping events

* Everything is keyed by event id: currencies, missions, offers, stage ids, mail ids, intro-seen keys.
* `activeEvents(now)` returns events in `active` or `exchange` phase, sorted by the next deadline.
  `featuredEvent(now)` = the `active` event ending soonest, else the `exchange` event closing soonest.
* Lobby: the bottom-left EVENT card shows `featuredEvent`; the carousel gets one slide per active or exchange event
  (at most 2 shown; more go to the Events page). The weekly double-drop moves from the card into the carousel while a
  limited event is featured.
* Notice: one article per active event, newest first, before the weekly event article.
* Intro popup: at most one per lobby visit; a second new event shows on the next visit.
* Energy is shared (ENERGY_RESET). Each event's daily missions reset at the same 7 PM Central instant.
* Tests run a fixture pair whose windows overlap (§7).

### 3.12 UI

**Event screen** — new route `#/event/<id>?tab=story|stages|missions|exchange|friends` (`src/ui/screens/event.js`,
registered in `src/main.js`). the academy-anime style event-page layout, landscape first:
* Background: the event art (or `fallbackArt` with its CSS tint), dimmed; the host girl's drawn stand bottom-left
  (`portraitHTML(unit, 'cut')`; the first `theme.hosts` entry with `hasPortrait`).
* Top bar via `screen()` with the event currency pill (and energy, once energy is in `currencyPills`).
* Header card: kicker "LIMITED EVENT · SEAGLASS ENCORE", title, a phase chip ("Ends in 6d 4h" / "Exchange · 3d left" /
  "Ended"), the balance. `data-testid`: `event-screen`, `event-phase`, `event-balance`.
* Tabs (existing `tabs()` from `components.js`): **Story**, **Operations**, **Missions**, **Exchange**,
  **Festival Friends** (hidden when the event has no `friends`). At 844×390 the tab bar scrolls horizontally inside
  itself (no page overflow).
* Story: episode cards "EPISODE 03 · Beach House, Extremely Open", states NEW (chip "+40 Shell Tickets"), Read ✓,
  Locked ("Clear Ramune Boardwalk"). `data-testid="event-ep-<n>"`.
* Operations: cards with the map thumb (`stageThumbSVG(map)`), name, "⚡10", fixed difficulty badge, "×70 Shell
  Tickets", a ✓ when cleared, lock line. Tap → stage prep. The boss card is wider, red-trimmed, "EXPERT · OPTIONAL".
* Missions: Daily (header "Resets in 3h 12m (7 PM Central)") and Event missions, progress bars, Claim / Claim all.
* Exchange: offer cards in the Mall's look (`.ma-offer` classes from `meta-a.css`, item `tile()` from `stage.js`),
  stock "2/3", price with the currency icon, quantity sheet like `startBuy` in `mall.js`. Footer: "The Exchange closes
  Nov 8 at 7 PM Central. Leftover Shell Tickets become coins (50 each)."
* Locked (1-5 not cleared): a panel "Clear {stage:1-5} to join the festival — you're on 1-3." + [Go to Missions].
* Upcoming: countdown only. Exchange phase: Operations and Missions tabs show their closed notes. Ended: Story replay
  + summary ("You read 11/11 episodes · Marina and Amane joined · 17,000 coins from leftover tickets").

**Lobby** (`src/ui/screens/lobby.js`):
* `buildEventCard`: when `featuredEvent(now)` exists, the card shows its art, host girl, kicker "EVENT!", title and
  "Ends in 6d 4h" (exchange phase: "Exchange · 3d left"); tap → `#/event/<id>`; `data-testid="event-card"`. With no
  limited event it is today's weekly card (keep `data-testid="event-strip"` for that case).
* `buildCarousel` `build()`: prepend one slide per active/exchange event (`id: 'event-<id>'`, pill "Limited event",
  kicker "EVENT", sub = countdown) and, while the card shows a limited event, a slide for the weekly double-drop.
* `render`: after the beta-gift timer, `maybeShowEventIntro()` (new, `src/ui/events/intro.js`): shows once per event
  per save (`profile.seenIntro` key `event:<id>`), only when the event is unlocked, no `.modal-overlay` is open,
  `window.__sakura.storyBusy` is false and the opening is not pending. Otherwise it waits for the next lobby visit.

**Notice** (`src/ui/lobby/notice.js`): `articles()` prepends one article per active event (tag Event, icon
`calendar`, title, date "Ends Nov 1", the event art, `notice.body`, CTA "Go to the event"). `noticeUnread()`/`markSeen()`
compare against `NOTICE_VERSION + '|' + activeEventIds.join(',')`, so a new event lights the red dot once.

**Events page** (`src/ui/screens/rewards.js`, title "Events"): `render` adds `limitedSection()` above
`eventSection()`: a card per non-past event (active → [Go], upcoming → teaser), then a collapsed "Past events" list.

**Students / Student screen**: `acquisitionHint` (`stage.js`) gains `event` → "Event · Seaglass Encore" while the
event is visible, "Limited event girl" afterwards. **Backpack**: the currency shows in Tokens & Currency with its
"Where to get" row. **Bestiary**: event enemies are not in `ENEMIES`, so the family pages do not list them;
Builder 3 adds an "Event" strip at the end of the bestiary showing event enemies the player has seen (optional).

**Copy (exact strings).**

| Where | Text |
|---|---|
| Intro kicker | LIMITED EVENT · SEAGLASS ENCORE |
| Intro title | The Beach Day That Got Away |
| Intro body | Summer slipped away, so Seaglass Bay saved us one last beach day! Read the story to bring {name:marina} home for free, clear five seaside operations, calm the Seaglass Leviathan for {name:amane}, and trade Shell Tickets in the Exchange. |
| Intro dates | Oct 16 – Nov 1 · ends 7 PM Central · Exchange open until Nov 8 |
| Intro buttons | [Later] [Go to the beach] (`data-testid`: `event-intro`, `event-intro-go`, `event-intro-later`) |
| Locked (event screen) | Clear {stage:1-5} to join the festival — you're on {stage:<next>}. |
| Operations closed | The operations are over. The Exchange stays open until Nov 8, 7 PM Central. |
| Missions closed | Missions are over — unclaimed rewards were sent to your Mail. |
| Exchange footer | The Exchange closes Nov 8 at 7 PM Central. Leftover Shell Tickets become coins (50 each). |
| Result line | New episode unlocked: {title} |
| Gate note | The Seaglass operations closed before this battle started — no rewards. |
| Ended summary | You read {n}/11 episodes · {girls} joined · {coins} coins from leftover tickets |

### 3.13 The summer event — content

#### 3.13.1 Setting and tone

Seaglass Bay is a seaside town one ferry ride down the river from Moonpetal City's lake (the bible's world is a lake
city, `docs/story/BIBLE.md` §2.1, so the sea is a trip away). Every October the bay holds the **Last Light Festival**
before the boardwalk closes for winter. The academy never got its summer beach trip, so the Coast Watch Club invites the
Sentinels to the last weekend. **The water is too cold to swim** (said out loud in Episode 1), so the beach day is
sandcastles, ramune, watermelon, postcards, yukata and lanterns. It is a side story: no wardstones, no chapter-2 merge,
no spoilers, and it fits any point of the campaign. Tone follows the bible: Saturday-morning comedy, one quiet moment,
nobody is evil, monsters "poof" home, the Leviathan only wanted to see the lights.

"Captain" in the old text meant the player. Here the player is **Sensei**; **Hikari** is "Captain". Amane is also a
captain, which becomes a running joke ("Two captains on one beach. That's a jurisdiction problem.").

#### 3.13.2 Marina and Amane (old → new)

Old data (`summer-content.js` `SUMMER_UNITS`, `BEACH_SKINS`; `characters.md` §6.1 rows 31–32):

| | Old Marina | Old Amane |
|---|---|---|
| Age / role | **23**, "Seaglass Lifeguard", SR tower, area control, reveal aura, land + water | **26**, "Summer Sea Captain", SSR hero, Nami clone (2 frost targets, veil sight) |
| Kit | lantern → holy pulses, 11 dmg / 1.65 s / 4.4 range, upgrades Rescue Signal / Seaglass Watch / Safe Harbour | 15 dmg / 1.25 s / 4.2 range; ult **Seaglass Finale** (cd 70: 70 + 14/level frost to detected enemies, slow 3 s, squad +15 % damage 6 s) |
| Look | peach short hair, teal swim top + skirt, sandals, rescue buoy | lavender bob, pink swim top + skirt, sandals, gold trident |
| Got | free from story Episode 1 | first clear of the Leviathan |
| Skin | `marina-beach` "Coral Holiday" (swimsuit) | `amane-beach` "Moonlit Sail" (swimsuit); also `nami-beach` "Blue Horizon" |

**Never shipped or used as references:** `oldgame/assets/models/{marina,amane,marina-beach,amane-beach,nami-beach}.glb`,
`oldgame/assets/summer/*.webp`, `oldgame/assets/roster.webp`, `oldgame/assets/hikari.webp`, and the old
`assets/maps/summer_*.webp` thumbs (not needed: stage thumbs are drawn by `stageThumbSVG`).

**New Marina** (`src/data/unitsEvent.js`) — student (E3, Q2).
* Identity: `name: 'Marina'`, `title: 'Seaglass Lifeguard'`, third-year, captain of the academy's **Coast Watch Club**
  (lifeguards who patrol Seaglass Bay every summer). Cheerful, loud, very responsible underneath; her rescue buoy is
  named Donut.
* Outfit (non-swimwear, academy school style): a white short-sleeve **summer sailor uniform** with a teal collar and coral
  scarf, a knee-length navy pleated skirt over **teal sports tights**, a zipped **red-orange lifeguard windbreaker**
  tied open with a life-ring emblem (no medical cross), a whistle on a lanyard, white sneakers, a teal headband in peach
  short hair, a life-ring-shaped halo. Modest: high neckline, no bare midriff, no bare thighs.
* Data: `kind: 'tower'`, `rarity: 'SR'`, `adult: false`, `role: 'controller'`, `attackType: 'holy'`,
  `element: 'water'`, `placement: 'amphibious'`, `materialFamily: 'charm'`, `capabilities: ['water', 'slow', 'reveal']`,
  `pathCapabilities: ['detection', 'stun', 'buff']` (builder checks against `CAPABILITIES`),
  `acquisition: { type: 'event', event: 'seaglass-2026', how: 'story', note: 'Joins for free when you read Episode 1 of the Seaglass Encore event.' }`.
* Look: `{ hairStyle: 'short', bangs: 'messy', accessory: 'headband', outfit: 'hoodie', weapon: 'lantern', halo: 'ring', eyeStyle: 'round', expression: 'cheerful' }`
  (the "signal lantern" stands in for the buoy until a Blender buoy part exists), palette from the old colours
  (`hair: '#ed9b72'`, outfit teal `#5ec7cf`, eyes `#3eafa8`, accent `#ffb6a2`). Must pass "every girl is visually
  distinct" in `units.test.js` (hair colour, hairStyle|accessory, and the 4-part signature unique) after roster's
  11 new girls too; the builder adjusts the accessory if a roster girl took `short|headband`.
* Kit (draft; numbers converted with `combat.md` §2.3 — range ×0.72, rate 0.9/old interval, damage ×0.3, pulse lower —
  then tuned by the balance check in §7): `base` like Hotaru's pulse but weaker and wet: `behavior: 'pulse'`,
  `cost: 420`, `damage: 3`, `rate: 0.6`, `range: 2.4`, `maxTargets: 8`, `projectileSpeed: 0`, `reveal: 2`,
  `status: [slow(0.2, 1.2), soak(1.5)]`. Paths (5 tiers each, **existing ModSet vocabulary only**, as KIT_STYLE_SPEC A9):
  **Rescue Signal** (range → detection → a Veil Sight aura shaped like Umeko's → silence/reveal → a small damage aura),
  **Seaglass Watch** (damage and attack speed), **Safe Harbour** (stronger slow → push-back → freeze chance). The old
  upgrade names become the path names.
* Bio (≥ 80 chars): "Third-year captain of the academy's Coast Watch Club, who spends every summer on the Seaglass Bay lifeguard
  tower. She wears her sailor uniform under a bright lifeguard windbreaker and carries Donut, a rescue buoy with a
  glowing signal lamp. Her ripples slow whole crowds and reveal anything hiding in the spray."
  Personality: "Loud, sunny and bossy about safety — she counts heads twice and hands out snacks after every drill."
  Quote: "Whistle check, buddy check, snack check. Okay, Sentinels — into position!" Tips (2–3): "Amphibious: place
  her on water to cover both shores." / "Her ripples reveal veiled foes for everyone in range." / "Safe Harbour freezes
  crowds that bunch up on bridges."

**New Amane** — adult hero (glamorous allowed, never body-framed).
* Identity: `name: 'Amane'`, `title: 'Seaglass Captain'`, 26 in the old data (the text never needs a number), captain
  of the bay's rescue skiff and the harbour patrol's adult guardian. Unflappable, dry, secretly sentimental.
* Outfit: an elegant knee-length **lavender double-breasted captain's coat** with gold buttons and white piping over
  a white high-neck blouse, a long navy pleated skirt, white gloves, a captain's cap with a sea-glass badge, tall deck
  boots, a gold trident. Elegant and confident; no cleavage, no bare midriff.
* Data: `kind: 'hero'`, `rarity: 'SSR'`, `adult: true`, `role: 'tideguard'`, `attackType: 'mystic'`,
  `element: 'frost'`, `placement: 'amphibious'`, `materialFamily: 'rime'`, `capabilities: ['water', 'slow', 'detection']`,
  `acquisition: { type: 'event', event: 'seaglass-2026', how: 'boss', note: 'Joins when you first defeat the Seaglass Leviathan.' }`.
  Same UnitDef shape as `NAMI` in `src/data/units.js` (hero block + `base` + `paths`).
* Look: `{ hairStyle: 'braid', bangs: 'swept', accessory: 'cap', outfit: 'coat', weapon: 'trident', halo: 'star', … }`
  — `cap` exists only after feature/roster merges (roster `LOOK_ENUMS`); before that use `accessory: 'hairpin'`.
  Palette from the old colours (`hair: '#b8a4e0'`, outfit `#f3b3ba` → lavender coat `#b59ee9`, eyes `#7771bc`).
* Kit (draft): `base` `projectile`, `damage: 4`, `rate: 0.75`, `range: 3.0`, `projectiles: 2`, `detection: true`,
  `status: [slow(0.2, 1.2)]`. Ult **Seaglass Finale**: `{ type: 'nova', damage: 110, radius: 4.5, attackType: 'mystic',
  status: [slow(0.4, 3)], reveal: 6 }` (the `nova` effect exists: `src/sim/hero.js` line 153 and Hikari's ult). The
  old "+15 % squad damage" is added only if roster Builder 3's team damage buff has landed (**UNVERIFIED** name). She
  must be a sidegrade of Nami, not an upgrade: same-level DPS within ±10 % of Nami in the balance probe.

#### 3.13.3 Story episodes (11)

Unlock chain (old `BEACH_STORY` `clear` + `summerOperation` story gates, kept): Ep 1 → Op 1 → Ep 3 → Op 2 → Ep 5 →
Op 3 → Ep 7 → Op 4 → Ep 9 → Op 5 → Ep 10 → Leviathan → Ep 11. Even episodes are side episodes that unlock with the
odd one before them. Each episode also needs the previous episode read. First read: **+40 Shell Tickets** each.

| # | id | Title | Unlocks after | Cast (≤ 4 portraits) | Background | Beats (old → new) | Choice |
|---|---|---|---|---|---|---|---|
| 1 | ev.seaglass.01 | Operation: Absolutely No Work | event open | hikari, nami, marina | stage:2-1 | Ferry arrives; Hikari's "schedule for relaxing"; Marina introduces herself (third-year, Coast Watch captain), says the water is too cold to swim; joins. **Grants Marina.** | yes |
| 2 | ev.seaglass.02 | The Ramune Incident | Ep 1 | nami, marina, hikari | stage:2-1 | The ramune marble launches; a goblin declares a puddle an international waterway | yes |
| 3 | ev.seaglass.03 | Beach House, Extremely Open | Op 1 | amane, hikari, marina | stage:2-3 | Amane (skiff captain, adult guardian) booked a "beach house" with no walls ("excellent sea ventilation"); an orc wants all the shaved ice; two-captains joke | — |
| 4 | ev.seaglass.04 | A Very Serious Sandcastle | Op 1 | hikari, nami, marina | stage:2-3 | Hikari builds a sandcastle that is a tower-defense map; slimes give it five stars, then eat the stars | yes |
| 5 | ev.seaglass.05 | The Great Watermelon Trial | Op 2 | amane, marina, hikari, nami | stage:2-1 | Blindfold watermelon split; "your other left!"; an orc helmet; sportsmanship | — |
| 6 | ev.seaglass.06 | Postcards That Refuse to Dry | Op 2 | nami, marina, hikari, amane | academy-sunset | Postcards home "no emergencies we are putting in writing"; Hikari made shell charms for everyone | yes (ribbon colour) |
| 7 | ev.seaglass.07 | Festival Committee of One | Op 3 | marina, hikari, amane, nami | stage:7-1 | Marina volunteered everyone to run the Last Light Festival; the goldfish-scooping booth is tiny slimes | — |
| 8 | ev.seaglass.08 | A Ghost Wants Yakisoba | Op 3 | hikari, marina, nami, amane | stage:7-1 | A ghost queues for yakisoba with exact change; Marina's signal lamp reveals her; an oni orders sixteen | yes |
| 9 | ev.seaglass.09 | Three Wishes, One Sparkler | Op 4 | marina, nami, amane, hikari | stage:2-5 | Sparkler wishes; Hikari's goes out; Marina shares hers (the quiet moment) | — |
| 10 | ev.seaglass.10 | The Sea Is Applauding | Op 5 | amane, hikari, nami, marina (+ `dragon_leviathan`) | stage:2-5 | Lights at sea: a Seaglass Leviathan drawn by the festival lanterns; "the expert operation is optional — prepare your best free squad" | yes |
| 11 | ev.seaglass.11 | One Last Group Photo | Leviathan (any difficulty) | amane, marina, hikari, nami | academy-night | The Leviathan only wanted to see the lights and swims home happy; Amane joins "beside you, if it's free"; the photo; a goblin photobombs with both thumbs up | yes |

**Episode 1, canonical example** (Builder 2 ships it as written; 12 spoken lines, 3 portraits, every line ≤ 110):

```js
scene('ev.seaglass.01', { title: 'Operation: Absolutely No Work', chapter: 0, kind: 'event', trigger: null, bg: 'stage:2-1', music: 'home' }, [
  narrate('October. The ferry horn sounds twice, and Seaglass Bay opens its arms.'),
  say('hikari', 'I packed snacks, scarves and a detailed schedule for relaxing.', { at: 'left', face: 'determined' }),
  say('nami', 'A schedule for relaxing. Captain, that is a work plan wearing a sun hat.', { at: 'right', face: 'deadpan' }),
  say('marina', 'Ahoy! {name:marina}, third-year, captain of the Coast Watch Club!', { at: 'center', face: 'joy' }),
  say('marina', 'Professional advice? Throw the schedule into the sea.', { face: 'wink' }),
  say('nami', 'The tide just rejected it. It has standards.', { face: 'smile' }),
  say('hikari', 'Then… what does one do at a beach in October?', { face: 'question' }),
  say('marina', 'Sandcastles. Ramune. The Last Light Festival on Sunday. Nobody swims — the water bites!', { face: 'laugh' }),
  say('marina', 'And if anything wanders up the boardwalk, my club watches the shore. Want a hand, Sensei?', { face: 'determined' }),
  choice([
    { text: 'Welcome aboard, {name:marina}!', lines: [say('marina', 'Aye aye! Rescue signals and emergency snacks, at your service.', { face: 'joy' })] },
    { text: 'Is that buoy… named?', lines: [say('marina', 'This is Donut. She has rescued twelve swimmers and one sandwich.', { face: 'sparkle' })] },
  ]),
  say('hikari', 'Then it\'s decided. Operation: Absolutely No Work begins now!', { face: 'joy', fx: 'hop' }),
  narrate('A goblin waves from the boardwalk. It is holding six stolen ramune bottles.'),
  say('nami', '…Operation: A Little Bit of Work begins now.', { face: 'deadpan' }),
]),
```

Episodes 2–11 are written by Builder 2 from the beats above and the old lines in `summer-content.js` `BEACH_STORY`,
with every content change already listed (no ages, no "Captain" for the player, no swimwear, festival not beach-house
bedroom jokes). A critic pass checks them against BIBLE §9.

#### 3.13.4 Operations

All maps and enemies exist today. `tuneLike` copies hpScale/cashScale/startCash/budget from that campaign stage.
Drops on every operation also include coins (`D('coins', 1, 1500, 2500)`) and `D('book_rare', 0.4, 1, 1)`; the boss adds
`D('coins', 1, 4000, 6000)`, `D('book_superRare', 0.5, 1, 1)`, `D('gearbox_superRare', 0.25, 1, 1)`.

| # | id | Name (old) | Map (theme) | tuneLike | Waves | ⚡ | Shells/win | First clear | Needs | Scenery | Pool (existing ids) · fixed | Recommended |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ev-seaglass-1 | Ramune Boardwalk | `lake_shore` (lake), day | 2-1 | 12 | 10 | 70 | 100 shells + 3000 coins | Ep 1 | stalls, paperLanterns, boats, boardwalk | slime_green 3, slime_gold 2, slime_pearl 2 (w3), goblin_runner 3, lizard_skink 2 (w4) · F(12, slime_courtier) | slow |
| 2 | ev-seaglass-2 | Lemonade Lagoon | `lake_isles` (lake), day | 2-4 | 13 | 10 | 80 | 140 + 3000 | Op 1 + Ep 3 | boats, lilyPads, reeds, stalls | slime_pearl 3, slime_prism 2 (w3), lizard_skink 3, lizard_hunter 2 (w4), goblin_dasher 2, orc_grunt 1 (w6) · F(13, lizard_basilisk) | water, slow |
| 3 | ev-seaglass-3 | Seashell Bridges | `lake_reeds` (2 lanes), sunset | 3-2 | 14 | 12 | 100 | 180 + 4000 | Op 2 + Ep 5 | bridgeLanterns, reeds, boats | lizard_hunter 3, lizard_sunscale 2 (w4), slime_prism 2, goblin_dasher 2, orc_grunt 2 (w5), slime_violet 1 (w8) · F(14, lizard_basilisk) | multiHit, armorPen |
| 4 | ev-seaglass-4 | Firefly Strand | `lake_moonpier`, night | 3-5 | 14 | 12 | 110 | 220 + 4000 | Op 3 + Ep 7 | pier, paperLanterns, boats | ghost_wisp 3, ghost_veilwraith 3, slime_violet 2, goblin_smoke 2 (w3), ghost_phantom 2 (w6) · F(10, ghost_lanternbearer), F(14, ghost_hollowknight) | detection, reveal |
| 5 | ev-seaglass-5 | Last Light Marina | `festival_street` (2 lanes), night | 4-3 | 15 | 15 | 140 | 280 + 5000 | Op 4 + Ep 9 | stalls, fireworks, festivalBoats, paperLanterns | oni_haste 2, orc_ironhide 3, orc_shieldbearer 2 (w4), goblin_dasher 2, slime_iron 2, oni_brute 1 (w8) · F(15, orc_warlord) | armorPen, silence |
| B | ev-seaglass-boss | Seaglass Leviathan | `arena_market` (2 lanes), night | 5-1 | 15 | 20 | N 180 / H 240 | 600 + 8000 + Ticket ×1; **Amane**; mythic charm "Seaglass Focus" | Op 5 + Ep 10 | festivalBoats, paperLanterns, stalls | orc_shieldbearer 2, ghost_veilwraith 2, slime_pearl 3, lizard_hunter 2, oni_shield 1 (w6) · F(8, lizard_basilisk, 2), F(15, dragon_leviathan) | detection, armorShred, slow |

Hints (desc) from the old data: 1 "A long boardwalk brings each wave past your squad twice." 2 "Put {name:marina} on the
lagoon to cover both sandy shores." 3 "Two island lanes meet at the last bridge — cover each lane." 4 "Ghosts hide among
the lanterns. {name:marina} reveals them; {name:hikari} sees through veils." 5 "Speed fields join armored escorts — bring
armor break and holy hits." Boss: "Expert, optional. Two gates, armored escorts, hidden foes and the Leviathan. No paid
or random-only girl is required."

#### 3.13.5 The Seaglass Leviathan (reuses the dragon model and boss systems)

```js
eventEnemy({
  id: 'dragon_leviathan', name: 'Seaglass Leviathan', family: 'dragon', tier: 'boss',
  hp: 8000, speed: 0.4, armorClass: 'scaled', armor: 3, bounty: 2500, threat: 400, size: 3,
  color: '#1b6f7a', accent: '#9ff3e8', variant: 'matriarch', props: ['tail', 'horns', 'crown'],
  traits: { regen: { pct: 0.008, delay: 4 } },
  phases: [
    { atHp: 0.7, announce: 'The Leviathan dives under the pier — sea spray hides its escorts!',
      set: { traits: { veiled: true, summoner: { spawn: 'slime_pearl', count: 3, every: 7 } } } },
    { atHp: 0.4, announce: 'It surfaces in a crown of sea glass — its scales harden!',
      set: { armor: 6, traits: { veiled: null, summoner: { spawn: 'lizard_hunter', count: 2, every: 8 } } } },
    { atHp: 0.15, announce: 'Last light! The Leviathan rides the tide toward the exit!',
      set: { armor: 3, speed: 0.6, traits: { summoner: null, hasty: { mul: 1.6, every: 5, duration: 1.2 } } } },
  ],
  lore: 'A sea dragon with scales like polished sea glass. It follows festival lights up the coast every autumn.',
  counters: 'Veil Sight for its dive (Marina, Hotaru, Kage, Hikari), armor break for its crown, slows for its last run.',
  introducedIn: 'ev-seaglass-boss',
})
```

* Model: the dragon family GLB already has the `matriarch` variant and the `tail`, `horns`, `crown` props
  (`public/models/enemies/manifest.json`); `src/models/glbEnemy.js` assembles pieces from `model.variant`/`props` and
  tints by `color`/`accent`. **No new 3D art.**
* Trait shapes copied from existing enemies (`veiled: true` like `slime_violet`, `regen` like `grave_lych`,
  `hasty` like `slime_gold`, `summoner` and `null` removal like `dragon_ashwing`).
* Music: `bossTrackFor('dragon_leviathan')` in `src/audio/routes.js` already falls back to `'boss'` ("Hold the Line!").
* Numbers are a draft; the balance check (§7) decides.

#### 3.13.6 Currency, missions and the economy

**Shell Ticket** (`evt_seaglass_shell`), icon shape `shell` (peach shell on a teal coin). Income:

| Source | Shells |
|---|---|
| 11 episodes × 40 (first read) | 440 |
| First clears (Ops 1–5 + boss) | 1,520 |
| One-time missions (below) | 2,250 |
| Dailies 120/day × 16 days | 1,920 |
| Farming (shells per energy: Op 1 7.0 → Op 5 9.3; boss Normal 9.0, Hard 12.0) | 40 ⚡/day for 10 days ≈ 3,700 · 60 ⚡/day for 14 days ≈ 7,800 · 120 ⚡/day for 16 days ≈ 17,900 |

So a casual player ends near **9,100**, a regular one near **13,700** (enough for every limited offer), a whale-free
grinder near 24,000 (the rest goes to the unlimited sink).

Daily missions (reset 7 PM Central):

| id | Name | Goal | Reward |
|---|---|---|---|
| sg_d_login | Beach Roll Call | `eventLogin` 1 | 30 shells |
| sg_d_clear3 | Three Trips to the Shore | `eventClear` 3 (sweeps count) | 60 shells |
| sg_d_kill | Tidy Beach | `eventKill` 300 | 30 shells |

One-time missions:

| id | Name | Goal | Reward |
|---|---|---|---|
| sg_t_op1…op5 | Clear Ramune Boardwalk … Last Light Marina | `eventStage` (each) | 50 shells each |
| sg_t_boss_n | Calm the Leviathan | `eventBoss` normal 1 | 300 shells + `book_mythic` ×1 |
| sg_t_boss_h | Calm the Leviathan (Hard) | `eventBoss` hard 1 | 400 shells + 150 gems |
| sg_t_clear30 | Regular at the Bay | `eventClear` 30 | 300 shells + `ticket_recruit` ×1 |
| sg_t_clear80 | Honorary Lifeguard | `eventClear` 80 | 500 shells + `ticket_recruit` ×1 |
| sg_t_read | Every Postcard | `eventRead` 11 | 200 shells + 100 gems |
| sg_t_kill | Beach Patrol | `eventKill` 5000 | 300 shells |

Event gems total: 250 (+ medal gems 40 × 6 + 60 for boss Hard = 300), about 4.6 recruits with the 3 tickets below.

#### 3.13.7 Seaglass Exchange

| id | Item | Count | Price | Limit | Total |
|---|---|---|---|---|---|
| sg_ticket | ticket_recruit | 1 | 600 | 3 | 1,800 |
| sg_frag | star_fragment | 10 | 150 | 8 | 1,200 |
| sg_ribbon | gear: ribbon, mythic, "Festival Ribbon" (`requires: { stage: '2-1' }`) | 1 | 900 | 1 | 900 |
| sg_box_sr | gearbox_superRare | 1 | 150 | 4 | 600 |
| sg_box_my | gearbox_mythic | 1 | 450 | 1 | 450 |
| sg_book_my | book_mythic | 1 | 300 | 3 | 900 |
| sg_book_sr | book_superRare | 1 | 80 | 10 | 800 |
| sg_book_r | book_rare | 5 | 40 | 15 | 600 |
| sg_charm_sr / sg_rime_sr | mat_charm_superRare / mat_rime_superRare | 2 | 120 | 5 each | 1,200 |
| sg_charm_my / sg_rime_my | mat_charm_mythic / mat_rime_mythic | 1 | 250 | 2 each | 1,000 |
| sg_dice | dice_reroll | 1 | 80 | 8 | 640 |
| sg_pin | lock_pin | 1 | 150 | 2 | 300 |
| sg_crown | crown_iron | 1 | 300 | 1 | 300 |
| sg_coins | coins | 10,000 | 40 | 30 | 1,200 |
| sg_gift_shell / _ramune / _charm | Festival Friends gifts (event-local) | 1 | 50 | 15 each | 2,250 |
| sg_notes | book_common | 5 | 30 | unlimited | — |

Limited stock: 11,890 without gifts, 14,140 with gifts. Charm/rime are Marina's and Amane's material families.

#### 3.13.8 Festival Friends (the old "beach bonds") and outfits

Ported from `summer-event.js` `giveBeachGift`/`beachChat` and `season-ui.js` "bonds" tab, with outfits instead of
swimsuits:

* Girls: Marina, Amane, Nami (must be owned). Affection 0–100 per girl, event-local.
* Gifts: polished shell, cold ramune, summer charm. Earned 1 per operation win (rotating, like `rewardSummer`) and from the
  Exchange. Favourite gift +15, other +8 (Marina likes shells, Amane ramune, Nami charms).
* Two short chats per girl (the old `BOND_CHATS`, reworded: no ages, no "Captain" for the player, Marina's lines are
  friendly club-captain banter, not dates). Chat 2 unlocks at 40 affection. Each chat +10.
* **100 affection → a permanent outfit** (roster skins, `acquisition: { type: 'event', event: 'seaglass-2026' }`,
  granted with `grantSkin` from roster `src/systems/skins.js`), plus **+1 bond level** (`profile.bond`, capped at
  `BOND_MAX` in `src/data/lobbyArt.js`):

| Outfit id | Girl | Name (old name kept) | Design | Procedural look (until a GLB exists) |
|---|---|---|---|---|
| marina_festival | Marina | Coral Holiday | coral yukata with a white wave pattern, teal obi, paper fan, geta | `outfit: 'kimono', weapon: 'fan'` |
| amane_festival | Amane | Moonlit Sail | deep lavender yukata with moon-and-gull pattern, short navy haori, sea-glass hairpin | `outfit: 'kimono', weapon: 'fan'` |
| nami_festival | Nami | Blue Horizon | navy festival happi coat over a sea-blue yukata, flower in her hair | `outfit: 'kimono', weapon: 'trident'` |

* Skins are 3D-only (ROSTER_SPEC §1.2.3). `buildChibi` in roster `src/models/index.js` shows the procedural chibi in the
  skin's `palette`/`look` until `public/models/characters/<asset>.glb` exists, and keeps it when loading fails, so the
  outfits work before any model. Blender GLBs for them are optional polish (0 credits) — whether
  `tools/blender/build_characters.py` can build a skin row is **UNVERIFIED** (it builds `<id>.glb` from `UNITS`).
* If feature/roster has not merged when Builder 3 runs, the outfit is recorded in `friends.outfits` and
  `grantPendingOutfits(profile)` (app start) grants it once `SKIN_MAP` has it. The bond level is granted at once.

#### 3.13.9 Notice, intro and mail copy

* Notice article: tag **Event**, title "The Beach Day That Got Away", date "Ends Nov 1", body:
  1. "Summer got away from us — so Seaglass Bay saved one last beach day! Join the Last Light Festival from Oct 16 to
     Nov 1 (7 PM Central)."
  2. "Read the story to recruit {name:marina} for free, clear five seaside operations for Shell Tickets, and calm the
     Seaglass Leviathan to welcome {name:amane}."
  3. "Spend Shell Tickets in the Seaglass Exchange until Nov 8. Gifts and chats with {name:marina}, {name:amane} and
     {name:nami} unlock three permanent festival outfits. Nothing here costs real money."
  CTA "Go to the beach".
* Mail `welcome` (from "Coast Watch Club"): "A postcard from Seaglass Bay" — "Wish you were here! Oh wait — you can be.
  Here are a few Shell Tickets for the trip. — {name:marina}"
* Mail `unclaimed` (from "Coast Watch Club"): "You left these on the beach!" — "The operations are over, but some of your
  finished missions still had rewards waiting. Here they are. The Exchange stays open until Nov 8, 7 PM Central."
* Mail `leftover` (from "Seaglass Bay Festival Committee"): "Thanks for visiting Seaglass Bay" — "The Exchange has
  closed. Your {n} leftover Shell Tickets were swapped for {coins} coins. {girls}, and every outfit and piece of gear you
  earned, are yours to keep."

Tokens in mail and notice text resolve with the story's `resolveText` when story is merged; before that, names are
filled from `UNIT_MAP` by a tiny `fillNames()` in `src/ui/events/text.js` (same `{name:id}` syntax).

### 3.14 Art plan

| Asset | Before art exists (ships day one) | Final art | Cost |
|---|---|---|---|
| Marina portraits (`full`, `card`, `bust`, `thumb`, `cut`, `cut-s` in `public/art/portraits/`) | `portraitHTML` falls back to `cardArtSVG` (the drawn doll) — `src/art/portraits.js` | Meshy image-to-image, 3:4 full figure, cut and cropped with the first-impressions pipeline | **9 credits — the paid test** |
| Amane portraits | same fallback | same pipeline | 9 credits after approval |
| Event key art (`public/art/lobby/events/seaglass.webp` + thumb) | `thumbs/sango.webp` (the harbour painting) under a sunset tint | Meshy landscape 16:9: Seaglass Bay boardwalk at dusk with lanterns, no characters | 9 credits, optional |
| Marina / Amane chibis | procedural chibi from palette + look (`buildChibiProc`) | Blender stand-ins with `tools/blender/build_characters.py` from the UnitDef look (as roster Builder 2 did) | 0 credits |
| Festival outfits | procedural chibi in the skin's palette/look | optional Blender GLBs | 0 credits |
| Leviathan | the dragon GLB, tinted | — | 0 credits |
| Operation thumbs | `stageThumbSVG(map)` | — | 0 |

**Meshy procedure** (as ROSTER_SPEC §5.3; helper `(design scratch) or
`(design scratch) model `nano-banana-pro` at 9 credits a call, every call logged to
`(design scratch) keys never printed):
1. **One test only: Marina.** References: one existing stand **of a different girl** as a style and framing guide only
   (`sango-cut.webp`, the harbour cadet in a sailor uniform, composited on the flat grey-blue background), with
   "The reference is only a guide for art style, proportions and framing: do not copy its character, face, outfit or
   colours." Prompt = the §3.13.2 outfit text + the student clause from ROSTER_SPEC §5.3 ("Cute and wholesome school-age
   academy student: modest, fully clothed outfit with a high neckline, no cleavage, no bare midriff, no bare thighs
   (tights, stockings or long boots), not body-focused."). **Never** use any old Codex summer render, model or
   `roster.webp` as a reference. No the academy-anime style art.
2. Critic pass (design matches the text, modesty, hands, no text, proportions match our stands).
3. **Stop. Report the credits spent and the image to the owner. Wait for approval** before Amane and the key art.
4. After approval: Amane (adult clause: "An elegant adult guardian … not body-focused, no cleavage."), then the key art.
   At most 2 retries in total. **Cap: 45 credits** (balance ≈ 580).

### 3.15 Halloween readiness

**What a Halloween event needs, as data on this framework** (one new file `src/data/events/halloween.js`, its scenes
file, and nothing else unless marked "code"):

| # | Field | What to fill | Notes |
|---|---|---|---|
| 1 | `id`, `key`, `name`, `subtitle`, `tagline` | e.g. `trick-or-treat-2026`, `halloween`, "Trick-or-Treat Patrol!" | names to agree with the owner |
| 2 | `window` | `{ opens: '2026-10-24', lastDay: '2026-11-01', exchangeLastDay: '2026-11-08' }` | §3.2 table |
| 3 | `unlock` | `{ stage: '1-5' }` | |
| 4 | `theme` | colours, `fallbackArt: 'academy.webp'` + `fallbackTint: 'night'`, hosts e.g. `['hotaru', 'miko']` | art optional |
| 5 | `currency` | `evt_halloween_candy` "Pumpkin Candy", `icon: { shape: 'candy', … }`, `leftover` | the `candy` shape ships with the framework (Builder 1) |
| 6 | `stages` | 3–4 operations + 1 boss on existing night maps (`shrine_gate`, `marsh_mire`, `arena_runegarden`, `arena_crypt`), `tuneLike`, `energy`, pools of existing ghost/ghoul/fae/slime ids, scenery `spiritCandles`, `paperLanterns`, `graveStones`, `candles`, `bogLights`, night/fog | |
| 7 | `enemies` | one boss, e.g. `ghost_pumpkin_lord` built from ghost-family pieces (variant `samurai` or `bearer`, props `lantern`, `hood`, `candle`), orange/violet tint, 3 phases with existing traits | no new 3D |
| 8 | `episodes` + scenes | 4–6 episodes (8–18 lines each) with existing girls; costumes only described in text; modest | writer time ≈ half a builder session |
| 9 | `missions` | 3 dailies + 6–8 one-time | |
| 10 | `shop` | 10–14 offers + an unlimited sink | |
| 11 | `notice`, `intro`, `mail` | copy | |
| 12 | `friends` (optional) | costume outfits for 2–3 girls (e.g. a modest witch-apprentice look: `accessory: 'witchHat'`, `outfit: 'robe'`) | needs roster skins merged |
| 13 | music | none needed: the lantern track (`battle_lantern`, the spooky surf piece) already plays on shrine/marsh maps via `THEME_FAMILY` | |
| 14 | art (optional) | 1 key art (9 credits, after approval) | |
| (code, optional) | a `pumpkin` scenery prop in `src/render/props.js` + `SCENERY.pumpkins` in `src/render/terrain.js` | nice to have, not required |

**Deadline.** The event can ship dormant: data with a future `opens` is invisible until its tease date, so it only has
to be deployed before it opens.
* **Recommended:** open Fri Oct 23, 7 PM CDT (9 days, two weekends). Content merged and deployed by **Wed Oct 21**.
* **Hard latest for a meaningful run:** open Sun Oct 25, 7 PM CDT (one full week, aligned with the weekly reset).
  Content merged by **Fri Oct 23**, deployed by Sat Oct 24.
* Anything later gives under a week before it must end on Nov 1; not recommended.

Builder 3 ships `halloween.js` as a `draft: true` skeleton that passes the registry tests (one placeholder operation, no
episodes), so the Halloween content builder only fills data.

### 3.16 Audio

No new music (original music only; nothing new needed). Operations get their map family's battle track
(`THEME_FAMILY`: lake → moonlit, festival → matsuri). One-line edit in `src/audio/routes.js` (live since `c064a2f`):
add `'event'` to `MAP_ROUTES` so the event page plays the march like the other map screens. The story player's music
cues already route through `window.__sakura.audio` (STORY_SPEC §1.6).

---

## 4. Files to touch

All in branch **`feature/events`**. "B1/B2/B3" = the builder (§8).

### 4.1 New files

| File | Builder | Contents |
|---|---|---|
| `src/data/events/build.js` | B1 | `eventStage(event, o)`, `eventEnemy(o)`, `offer(o)`, `mission(o)`, `episode(o)`, `P/F/D` helpers, `EVENT_ICON_SHAPES = ['shell', 'candy', 'lantern', 'leaf', 'snow', 'star']`, `validateEvent(def)` (ids, references, windows ordered, shapes) |
| `src/data/events/index.js` | B1 | `ALL_EVENTS`, `EVENTS` (drafts only when `import.meta.env.DEV && localStorage['sakura-events-preview'] === '1'`, guarded with try/catch; always in Node tests via `ALL_EVENTS`), `EVENT_MAP`, `EVENT_STAGES`, `EVENT_ENEMIES`, `EVENT_CURRENCIES`, `eventById`, `eventOfStage`, `eventOfItem` |
| `src/data/events/seaglass.js` | B1 (stages, enemy, currency, missions, shop, notice, mail) · B2 (episodes meta, episode gates, intro) · B3 (friends) | the summer EventDef |
| `src/data/events/scenes/seaglass.js` | B2 | 11 scenes (§3.13.3) |
| `src/data/events/halloween.js` | B3 | `draft: true` skeleton |
| `src/data/unitsEvent.js` | B2 | `EVENT_UNITS = [MARINA, AMANE]` |
| `src/systems/events.js` | B1 (+B2 `readEpisode`, B3 friends) | pure, Node-safe: `newEvents()`, `cleanEvents(raw)`, `eventWindow(ev)`, `eventPhase(ev, now, profile?)`, `listEvents(profile, now)`, `activeEvents(now)`, `featuredEvent(now)`, `eventState(profile, id)`, `eventUnlocked(profile, ev)`, `eventStageStatus(profile, stageId, now)` → `{ ok, reason, text }`, `eventRunGate(profile, stage, startedAt)`, `eventAfterBattle(profile, stage, info)`, `trackEvent(profile, on, n, { eventId, stageId, difficulty, now })`, `markEventLogin(profile, now)`, `missionRows(profile, ev, now)`, `claimEventMission(profile, eventId, missionId, now)`, `claimAllEventMissions(profile, eventId, now)`, `shopRows(profile, ev, now)`, `buyEventOffer(profile, eventId, offerId, qty, rng, now)`, `episodeRows(profile, ev, now)`, `readEpisode(profile, eventId, episodeId, now)`, `settleEvents(profile, now)` → `{ letters, settled }`, `giveGift`, `friendChat`, `grantPendingOutfits` (B3). Imports only `core/reset.js`, `data/events/index.js`, `data/units.js`, `systems/inventory.js`, `systems/mail.js`, `systems/unlocks.js` (`grantUnit`, `isStageCleared`), `systems/gear.js` (`rollGear`, `addGear`) — never `rewards.js` (no cycle) |
| `src/ui/screens/event.js` | B1 | route `#/event/<id>`; tabs; locked/upcoming/closed/ended states |
| `src/ui/events/{cards,stagesTab,missionsTab,exchangeTab,storyTab,friendsTab,intro,text}.js` | B1 (cards, stages, missions, exchange, intro, text) · B2 (storyTab) · B3 (friendsTab) | UI pieces |
| `src/ui/events/reader.js`, `src/data/events/sceneFormat.js` | B2, **only if story is not on main** | §3.9 fallback |
| `src/ui/styles/events.css` | B1 | event page, cards, phase chips (landscape-first; 844×390 safe) |
| `tests/data/events.test.js`, `tests/systems/events.test.js`, `tests/systems/events-settle.test.js`, `tests/integration/event-balance.test.js`, `tests/data/event-scenes.test.js` (B2), `tests/data/event-units.test.js` (B2), `tests/systems/event-friends.test.js` (B3) | — | §7 |
| `e2e/event.mjs` | B1 (+B2, B3 steps) | §7 |
| `docs/EVENTS.md` | B3 | how to add an event, the Halloween checklist (§3.15), the economy table |

### 4.2 Edited files (exact functions)

| File | Builder | Change |
|---|---|---|
| `src/data/stages.js` | B1 | import `EVENT_STAGES`; new internal `resolveEventStage(def)` (copies `hpScale`, `cashScale`, `startCash`, `waveGen.budget` from `def.tuneLike` unless set); `STAGE_MAP` from `[...STAGES, ...EVENT_STAGES.map(resolveEventStage)]`; `getStage` JSDoc. `STAGES`, `stagesOfKind`, `CAMPAIGN_IDS` untouched |
| `src/data/enemies.js` | B1 | import `EVENT_ENEMIES`; `ENEMY_MAP` from `[...ENEMIES, ...EVENT_ENEMIES]`. `ENEMIES` untouched |
| `src/data/items.js` | B1 | `ITEM_CATEGORIES.event`; `buildItems()` adds currencies |
| `src/art/icons.js` · `src/art/icons/items.js` | B1 | `itemBody` handles `evt_*` via `eventOfItem`; new `eventCurrencyBody(shape, color, accent)` |
| `src/systems/rewards.js` | B1 | `applyBattleResult` (opts `startedAt`; gate after the practice check; `eventAfterBattle` before `addItems`), `canSweep` (event operations), `sweep` (phase check + `trackEvent`) |
| `src/systems/inventory.js` | B1 | `KIND_LABEL.event`, `KIND_ROUTE.event`, `buildSourceIndex` currency rows |
| `src/systems/save.js` | B1 | `createProfile` (`events: newEvents()`), `migrateProfile` (`p.events = cleanEvents(raw.events)`). No `SAVE_VERSION` change |
| `src/main.js` | B1 | `registerRoute('event', () => import('./ui/screens/event.js'))`; in the app-start `try` block after `onAppStart`/`applyResets`: `settleEvents(store.profile)`, `markEventLogin(store.profile)` (and B3: `grantPendingOutfits`) |
| `src/ui/resetClock.js` (energy B1, **UNVERIFIED** until it exists) | B1 | on fire also `settleEvents` + `markEventLogin`; commit reason `'event'` when anything changed |
| `src/ui/screens/lobby.js` | B1 | `buildEventCard`, `buildCarousel` (`build`), `render` (intro after the beta timer) |
| `src/ui/lobby/notice.js` | B1 | `articles()`, `noticeUnread()`, `markSeen()` |
| `src/ui/screens/rewards.js` | B1 | `render` + new `limitedSection()` |
| `src/ui/screens/stage.js` | B1 | `stageLabel`, `requirementText`, `render` (difficulty forced into `stage.difficulties`), `defaultDifficulty`, `difficultyPicker`, `buildPrep` (event panel), `acquisitionHint` (B2: `event`) |
| `src/ui/battle/setup.js` | B1 | `mapRouteFor` (`case 'event'`) |
| `src/ui/battle/controller.js` | B1 | `mountBattle`: `ctx.startedAt = Date.now()` |
| `src/ui/battle/results.js` | B1 | `apply()` passes `startedAt`; rewards view shows `out.event.newEpisodes`; gate note through the existing `out.note` |
| `src/audio/routes.js` | B1 | `'event'` in `MAP_ROUTES` |
| `src/data/units.js` | B2 | one line `UNITS.push(...EVENT_UNITS)` (next to roster's `unitsExpansion.js` line when it exists) |
| `src/systems/gacha.js` | B2 | `POOL` excludes `acquisition.type === 'event'` |
| `src/data/shop.js` | B2 | spark offers exclude event units |
| `src/data/missions.js` · `src/systems/missions.js` | B2 | `a_units_all` → metric `permanentUnitsOwned`; `metricValue` case |
| `src/data/wiki.js` | B2 | the acquisition lists (lines 444–459) get an "Event girls" row; an "Events" article (B3) |
| `src/ui/story/player.js` (only once story is on main) | B2 | `titleCardText`: `kind === 'event'` → kicker "Event Story" |
| `src/data/skins.js` (roster, once merged) | B3 | 3 event skin rows (`acquisition: { type: 'event', event: 'seaglass-2026' }`) |
| `src/ui/screens/bestiary.js` | B3 (optional) | "Event" strip for seen event enemies |
| `tests/integration/consistency.test.js` | B1/B2 | gacha test excludes event units; add "every event stage/enemy/currency lines up" (or keep it in `events.test.js`) |
| `tests/data/units.test.js` | B2 | the roster-count test counts non-event units; `ROSTER` rows for `marina` (tower SR, acq `event`) and `amane` (hero SSR, acq `event`); the acquisition `it.each` gains an `event` branch |
| `tests/systems/first-impressions.test.js` | B2 | `ART_PENDING = new Set(['marina', 'amane'])` skipped by the two "every roster girl has a portrait / full-figure stand" tests until the art lands (same allow-list idea as roster's `HALF_BODY_STANDS`) |
| `e2e/smoke.mjs` | B1 | `ROUTES` += `['event seaglass', '#/event/seaglass-2026']` (the Events page `#/rewards` is already listed) |
| `CONTRACTS.md` (new "Events" section), `docs/ECONOMY.md` (event income), `docs/INTEGRATION_NOTES.md` | B1–B3 | docs |

### 4.3 Other branches (no edit by us)

* **feature/roster Builder 5** (`src/systems/banners.js`, ROSTER_SPEC §7): featured picks skip `acquisition.type === 'event'`.
* **feature/roster tests**: if roster merges after us, its `units.test.js` rewrite must keep the two event rows and the
  non-event count (§5).
* **ENERGY_RESET Builder 2**: nothing new — `energyCost(stage)` already reads `stage.energy`; event kind falls
  under "blocked".

---

## 5. Interactions with in-flight branches and merge order

Current state (2026-10-13): live = `c064a2f` (**online and audio are merged**). In flight: energy/reset (spec only),
story (Builder 2 WIP), roster (Builder 3 running), balance r3 (running), kit styles (spec only).

**Order.**
1. ✅ online (`288a782`) and audio (`c064a2f`) — already live.
2. **ENERGY_RESET Builder 1 (the clock, `reset.js`) → main.** Hard prerequisite for events Builder 1. It is small
   and scheduled first. If it slips, events Builder 1 may start on the pure data (`src/data/events/*`, stage/enemy/item
   wiring, tests that use the §3.2 UTC instants directly) and wires `src/systems/events.js` to `reset.js` only once it
   lands. **Do not write a second Chicago clock.**
3. **events Builder 1 → main** (framework + summer operations, missions, exchange, lobby, notice, settle). It can merge
   dormant even before Builder 2 (the summer data would then hold no episodes; keep `draft: true` until Builder 2 is in
   so players never see a story-less event).
4. **feature/story → main** (preferred before events Builder 2). If story is not on main when Builder 2 starts, use the
   §3.9 fallback; never cherry-pick story commits.
5. **events Builder 2 → main** (Marina, Amane, episodes, Meshy test). Set `draft: false` and, if the real ship day is
   after Oct 16, set `window.opens` to the ship day's game day (never earlier than the deploy).
6. **events Builder 3** (friends/outfits, Halloween skeleton, docs) — merges while the event runs; outfits wait for
   roster (pending-grant fallback).
7. ENERGY_RESET Builder 2 (energy) may land before or after events B1; whichever lands second rebases.

**Expected conflicts and how to avoid them.**

| Branch | Shared file / function | Avoidance |
|---|---|---|
| energy B1/B2 | `src/systems/rewards.js` `applyBattleResult`, `sweep`; `src/ui/battle/results.js` `apply`; `controller.js` `mountBattle`; `stage.js` `buildPrep`, `sweepControls`; `lobby.js` `buildEventCard`, `buildCarousel`; `notice.js` `articles`; `rewards.js` screen `eventSection`; `main.js` app-start block; `save.js` `createProfile`/`migrateProfile` | Our edits are 1–3 lines per function (two calls in `applyBattleResult`, one opts field in `apply`), all event logic sits in `src/systems/events.js` and `src/ui/events/*`. The second branch keeps both sides. Our countdowns use energy's `formatCountdown`, so the copy matches. |
| story | `src/ui/story/player.js` `titleCardText` (one line, only after story merges); `src/main.js` | We never edit story data; event scenes are separate modules. |
| roster | `src/data/units.js` (one append line each), `tests/data/units.test.js` (roster rewrites it), `tests/systems/first-impressions.test.js`, `src/systems/gacha.js`, `src/data/shop.js`, `src/data/wiki.js`, `src/data/skins.js` | Event girls live in `unitsEvent.js`; the test edits are additive rows + one filter. Whoever merges second re-applies: "count non-event units; keep the marina/amane rows; event units skip gacha/spark/banners". Amane's look uses `cap` only after roster merges. |
| balance r3 | `src/data/stages.js` (hpScale, first clears, `CHAPTER_TUNED_LEVEL`), `stage.js` (`overLevelNote`), `tests/data/world.test.js` | We add an import and change the `STAGE_MAP` line only; `tuneLike` follows their numbers. Event prep shows `overLevelNote` using `CHAPTER_TUNED_LEVEL[STAGE_MAP[tuneLike].chapter]` once balance is in. |
| kit styles | none | — |
| academy direction (parallel) | Marina/Amane designs; event text | The event avoids the chapter-2 merge entirely; designs follow the school/academy direction. |

---

## 6. Save/migration, determinism and co-op impact

**Save.**
* Additive `profile.events` (§3.5) with `cleanEvents`; **no `SAVE_VERSION` bump** (the same rule as story and energy).
* Currency in `profile.items` (registered in `ITEMS` forever, so `migrateProfile` keeps it and `migrationDropsData`
  stays false). Event girls in `profile.units` (in `UNIT_MAP` forever). Outfits in `profile.skins` (roster v3).
* An older build that loads a newer save drops `events`, the girls and the currency; `migrationDropsData` then reports
  `'lossy'` and `loadSaveText` keeps the backup (existing safety net in `src/systems/save.js`).
* Export/import carries everything (plain JSON).
* Settling is final (`settled` set) — a clock rolled back never reopens a settled event or refunds tickets.

**Determinism.** Nothing event-specific enters `src/sim/**`. The sim reads event stages and the Leviathan through
`STAGE_MAP`/`ENEMY_MAP` exactly like any stage and enemy (`src/sim/data.js` `defaultData`), so a run is a pure function
of seed + plan + data. Event gating, missions and rewards run after `sim.result()`, in systems code. Marina's and
Amane's kits use existing behaviours, ModSets and the existing `nova` ult only.

A difficulty's own waves (§3.6 variants) reach the Sim as `data.stage`, built by `src/data/events/wire.js` (outside the
sim's source hash, `tools/simId.mjs`), the same way solo freeplay's stage does: the battle is still a pure function of
seed + plan + data.

**Co-op.** Event stages are not offered (`coopStages` in `src/data/coop.js` stays campaign-only), so no co-op battle can
run event data. `coopVersion` (`src/online/coop/version.js`) hashes `UNITS, ENEMIES, STAGES, MAPS, …`: Marina and Amane
change the hash (both peers run the same build, as for any update); `EVENT_STAGES`/`EVENT_ENEMIES` are not in it
(not needed while co-op cannot run them). `COOP_PROTOCOL` stays 2. Marina and Amane can be brought into ordinary co-op
battles like any owned girl (`coopLoadout`). If co-op event stages are added later, add `EVENT_STAGES` and
`EVENT_ENEMIES` to the hash in the same change. Event currency, missions and energy never cross the network.

---

## 7. Tests

**Unit (vitest)** — every time-based test uses fixed UTC instants (works in any `TZ`).

* `tests/data/events.test.js`
  * EV-1 every event in `ALL_EVENTS` (drafts too) passes `validateEvent`; ids follow §3.3; no id collides across events
    or with `STAGES`/`ENEMIES`/`ITEMS`/`SHOP_OFFERS`/mission ids.
  * EV-2 every event stage: real map (`MAP_MAP`), real pool/fixed enemies (`ENEMY_MAP`), drops/firstClear in `ITEMS`,
    `recommended` in `CAPABILITIES`, `requires` in `STAGE_MAP`, `tuneLike` is a campaign id, `difficulties ⊆ DIFFICULTY_ORDER`,
    `energy > 0`, every scenery keyword in `SCENERY` (`src/render/terrain.js`).
  * EV-3 `resolveEventStage` copies hpScale/cashScale/startCash from `tuneLike` (and keeps overrides).
  * EV-4 `STAGES.length === 59`, `ENEMIES.length === 74` (unchanged); `STAGE_MAP['ev-seaglass-1']` and
    `ENEMY_MAP.dragon_leviathan` exist; `stageEnemies('ev-seaglass-boss')` contains the Leviathan; its `introducedIn`
    is that stage.
  * EV-5 `eventEnemy` output has exactly the key set of `ENEMIES[0]`; the Leviathan's variant/props exist in
    `public/models/enemies/manifest.json` for the dragon family.
  * EV-6 every currency has an item, `hasItemIcon(id)` is true, and `itemSources(id)` has an `event` route row.
  * EV-7 every offer's item exists (or gear slot/rarity valid); every mission's `on` is in the closed list.
* `tests/systems/events.test.js`
  * ES-1 the §3.2 table: `eventWindow(seaglass)` = 2026-10-17T00:00Z / 2026-11-02T01:00Z / 2026-11-09T01:00Z;
    Halloween skeleton the same end.
  * ES-2 `eventPhase` at every boundary ±1 ms (hidden/upcoming/active/exchange/ended); drafts hidden in production mode.
  * ES-3 locked before 1-5; `eventStageStatus` reasons in chain order (episode, previous op, boss needs Op 5 + Ep 10).
  * ES-4 `applyBattleResult` on an event win: shells dropped, first-clear shells once, medal gems, `eventClear` +1,
    kills counted, `newEpisodes` reported; a loss gives the loss coins and no event progress.
  * ES-5 gate: a battle started 1 ms before `endAt` and applied after it pays; one started after `endAt` records
    nothing and returns the gate note; a deep link to a locked operation records nothing.
  * ES-6 boss first clear grants Amane (via `unlocks.units`) and exactly one mythic charm named "Seaglass Focus";
    a second clear grants neither.
  * ES-7 sweeps: operations sweepable once cleared, boss never; sweeping after `endAt` → `error: 'event'`; sweeps count
    for `eventClear`.
  * ES-8 dailies reset at 7 PM Central (not device midnight), not on a clock rolled back; `markEventLogin` once per day.
  * ES-9 `buyEventOffer`: stock limits, funds check before any change, `requires` stage, closed after
    `exchangeEndAt`, gear offer rolls a ribbon with the def's rarity and name using the passed rng.
  * ES-10 two overlapping fixture events: separate currencies/missions/shops; `featuredEvent` picks the earlier end;
    an op win in event A never counts for event B.
  * ES-11 `cleanEvents` drops unknown events/missions/offers, clamps numbers, keeps `settled`; an old save without
    `events` loads; `SAVE_VERSION` unchanged.
  * ES-12 gacha `POOL`, spark offers and `a_units_all` exclude event units (B2).
* `tests/systems/events-nightmare.test.js` (Halloween 2026, E8 update)
  * NM-1 data: difficulties, `unlockAfter`, candy per win (operations ×2 on Nightmare, the boss 150 / 220 / 500), the
    boss variant (20 waves, HP ×12, chapter-8 coins, two Golems; frozen, cached, rewards unchanged).
  * NM-2 the gate: operations after Normal, the boss after Hard (not Normal); a locked Nightmare is practice.
  * NM-3 a win: Sakura medal + 100 gems once, double candy, the mission; NM-4 sweeps: Nightmare after its medal,
    10 a tap, boss never, refused after the end; NM-5 the one-time missions (2,300 candy, no gems, no new dailies).
  * NM-6 a v0.1.38 tab: it drops the new missions from the block, the marks bring progress and claims back, nothing
    pays twice; its Nightmare runs and sweeps pay nothing; the medal map survives.
  * `tests/battle-ui/eventBattleSave.test.js` NM-7: createBattleSim / restoreSim use the variant; its save is format 2
    and kept past the base 15 waves; every other run stays format 1.
  * `tests/integration/event-balance.test.js` EB-3 (the boss Nightmare: mid and level-60 P1 teams lose, the late
    free-player profile wins) and EB-4 (Op 4 Nightmare: a smart level-40 team wins).
* `tests/systems/events-sweeps.test.js` (the daily sweep limit, Oct 20)
  * SW-1 the count (10 a game day, all stages together, in the counters, not the block); SW-2 a partial tap (×10 with
    4 left sweeps and pays 4; at 0 → `error: 'limit'`, nothing changes; the older refusals come first); SW-3 the 7 PM
    Central rollover (also the 25-hour Nov 1); SW-4 a clock set back never refills; SW-5 campaign and Bounty sweeps
    and played battles unlimited; SW-6 a reload or a dropped block keeps the count, garbage reads safely; SW-7 the
    settle drops the marks; SW-8 the economy (HALLOWEEN_2026.md "Economy"): the limited stock is reachable by Nov 1.
* `tests/systems/events-settle.test.js`
  * ST-1 at `endAt`: one "unclaimed" letter with exactly the completed unclaimed rewards, expiring at `exchangeEndAt`;
    claimed missions not repeated; running settle twice delivers nothing new.
  * ST-2 at `exchangeEndAt`: currency removed, coins = 50 × n (+ 100 × gifts), `settled` set, state pruned to
    `{ run, joinedAt, read, friends.outfits, settled }`; 0 tickets → no letter.
  * ST-3 settled is final: setting `now` back into the active window shows `ended` and allows no battle rewards or buys.
  * ST-4 a save first opened after `exchangeEndAt` with tickets left (offline player) settles correctly in one pass.
* `tests/integration/event-balance.test.js` (B1; uses `runHeadless`/`autoPlan` from `src/sim/headless.js` and
  `freeUnitsBefore`/`statsAtLevel` from `tools/balance/f2p.mjs` once balance r3 is merged — before that, a local copy
  of the two helpers from `tests/integration/balance.test.js`; passing an event stage id to `freeUnitsBefore` is
  **UNVERIFIED**, so pass its `tuneLike` id for the roster)
  * EB-1 each operation is won on Normal by the free roster available at its `tuneLike` stage, at that chapter's
    expected level, without Marina or Amane.
  * EB-2 the Leviathan is won on Normal by the free roster of 5-1 at the chapter-5 expected level, without Marina or
    Amane, in ≥ 2 of 3 seeds; Hard at the chapter-6 level in ≥ 1 of 3 seeds (report-only under `BALANCE=full`).
  * EB-3 (B2) Marina and Amane do not exceed Hotaru's / Nami's same-level damage share by more than 10 % in the probe.
* `tests/data/event-units.test.js` (B2): Marina student tower, Amane adult hero, acquisition `event`, distinct looks,
  bios ≥ 80 chars, not in `POOL`.
* `tests/data/event-scenes.test.js` (B2): every scene passes the story limits (`LIMITS` from `format.js`, or the
  local copy before story merges): line length, spoken count, ≤ 1 choice, ≤ 4 portraits, title length, tokens resolve,
  no bare roster names (current units + `marina`, `amane`), banned words list from the story lint, speakers exist in
  `UNIT_MAP` or `ENEMY_MAP` or the plain speakers; every `episodes[]` meta has a scene and vice versa.
* `tests/systems/event-friends.test.js` (B3): gift values (+15 favourite, +8 other), chat 2 at 40, 100 → outfit +
  bond +1 once; pending outfit granted when the skin appears.
* Existing suites that must stay green with the edits: `tests/integration/consistency.test.js`,
  `tests/data/world.test.js`, `tests/sim/smoke.test.js` (it now also builds a Sim for every event stage — good),
  `tests/systems/{rewards,missions,save,items}.test.js`, `tests/data/units.test.js`,
  `tests/systems/first-impressions.test.js`.

**E2E** — `e2e/event.mjs` (Playwright like `e2e/smoke.mjs`; `--viewport 844x390` and `1280x720`; time faked with
`page.addInitScript` overriding `Date`/`Date.now`, context `timezoneId: 'America/Chicago'`, as ENERGY_RESET §7):
1. Fresh save at Sat 2026-10-17 12:00 CDT, 1-5 cleared through `window.__sakura.store`: lobby shows
   `[data-testid=event-card]` with the event title and "Ends in"; the carousel has `banner-event-seaglass-2026`; no
   horizontal overflow; `.lb-pills` and `.lb-tr` do not overlap.
2. The intro popup `event-intro` shows once; "Go to the beach" opens `#/event/seaglass-2026`; a second lobby visit shows
   no popup.
3. (B2) Story tab: Episode 1 is NEW; play and Skip → `profile.units.marina` exists, balance +40, card shows Read;
   replaying grants nothing. (B1 without B2: the Story tab shows "Coming soon".)
4. Operations tab: Op 1 opens stage prep with a single "Normal" difficulty and the event panel; inject Op 1 cleared;
   Op 2 shows its lock text until Episode 3 is read (B2).
5. Missions: `sg_d_login` complete → Claim all → balance up.
6. Exchange: buy `sg_book_r` ×2 → balance −80, stock 13/15.
7. Fake time Mon 2026-11-02 12:00 CST: Operations closed note; stage prep Start disabled; one "You left these on the
   beach!" letter if a mission was left unclaimed; Exchange still works.
8. Fake time Mon 2026-11-09 12:00 CST, reload: currency gone, "Thanks for visiting Seaglass Bay" letter with
   coins = 50 × leftover; Events page lists the event under Past events; its page shows the summary and Story replay.
9. Overlap (dev preview flag on, B3): with the Halloween draft opened by a test-only window override, both events show
   in the carousel and on the Events page; the card shows the one ending first.
10. Screenshots of lobby, event page tabs, stage prep, intro popup and Events page at both sizes, reviewed for clipping.

`node e2e/smoke.mjs` additionally visits `#/event/seaglass-2026` on a fresh save (locked state renders, no errors, no
overflow).

---

## 8. Build order (3 sequential builders)

Every builder ends green on: `npx vitest run` · `npx vite build` · `node e2e/smoke.mjs --viewport 844x390` ·
`node e2e/smoke.mjs --viewport 1280x720` · `node e2e/event.mjs --viewport 844x390` · `node e2e/event.mjs --viewport 1280x720`,
then commits. Work only in `feature/events`; never touch other worktrees.

**Builder 1 — framework + summer battle content** (needs `reset.js` on main, §5)
* `src/data/events/{build,index,seaglass}.js` (stages, Leviathan, currency, missions, shop, notice, mail;
  `episodes: []`, `draft: true` until Builder 2), `src/systems/events.js` (all but `readEpisode`/friends), table
  wiring (`stages.js`, `enemies.js`, `items.js`, icons, `inventory.js`, `save.js`), battle hooks (`rewards.js`,
  `results.js`, `controller.js`, `setup.js`), stage prep changes, event screen (Operations, Missions, Exchange; Story
  "Coming soon"), lobby card + carousel + intro, Notice, Events page section, settle + mail, `audio/routes.js`, CSS.
* Tests EV-1…7, ES-1…11, ST-1…4, EB-1/EB-2; `e2e/event.mjs` steps 1, 2, 4–8, 10 (with the dev preview flag turning the
  draft on).
* Accept: all suites green in `TZ=UTC` and `TZ=Asia/Tokyo npx vitest run tests/systems/events*.test.js tests/data/events.test.js`;
  screenshots at both sizes; a real battle on Op 1 (1280×720, max-level squad via the store hook) shows the shells tile and
  returns to the event page from "Map".

**Builder 2 — Marina, Amane, the story** (preferably after feature/story is on main; else the §3.9 fallback)
* `src/data/unitsEvent.js` + `units.js` line, gacha/spark/achievement exclusions, `acquisitionHint`, wiki rows;
  test edits (`units.test.js`, `first-impressions.test.js`, consistency gacha test).
* Episodes meta + 11 scenes (Episode 1 as written in §3.13.3), episode gates on operations, `readEpisode`, Story tab,
  `titleCardText` line (if story is merged), intro copy; `draft: false`, `window.opens` = ship game day if later than
  Oct 17.
* Blender stand-ins for Marina and Amane with `tools/blender/build_characters.py` (0 credits) and their lineup render.
* **Meshy: the single Marina test image (9 credits). Log it, critic it, report credits + image, then STOP.** Do not
  generate Amane or key art in this builder.
* Tests ES-12, EB-3, `event-units`, `event-scenes`; `e2e/event.mjs` step 3.
* Accept: the standard checks; screenshots of Episode 1 in the player at both sizes, Marina and Amane on the Students
  screen (fallback art) and in battle (procedural or Blender chibi); `credits.log` shows exactly one 9-credit call.

**Builder 3 — Festival Friends, outfits, Halloween skeleton, docs** (outfits need roster merged; else pending grants)
* Friends tab + `giveGift`/`friendChat`/`grantPendingOutfits`, the gift drops in `eventAfterBattle`, gift offers, 3 skin
  rows (if roster is merged), bond +1; bestiary event strip (optional).
* `src/data/events/halloween.js` draft skeleton (`candy` currency icon, one placeholder operation on `shrine_gate`),
  `docs/EVENTS.md` with the §3.15 checklist, `CONTRACTS.md` Events section, `docs/ECONOMY.md`, integration notes.
* After the owner approves the Marina test: Amane portrait + key art (≤ 45 credits total including the test), crops into
  `public/art/portraits/`, `PORTRAIT_DATA` entries, `ART_PENDING` emptied.
* Tests `event-friends`; `e2e/event.mjs` step 9.
* Accept: the standard checks; screenshots of the Friends tab and an outfit on the 3D student viewer at both sizes.

---

## 9. Open questions for the owner (with our default)

1. **Dates and title.** Summer runs **Fri Oct 16 7 PM CDT → Sun Nov 1 7 PM CST** (exchange to Nov 8), Halloween
   **Fri Oct 23 → Sun Nov 1 7 PM CST**, both ending together, and summer keeps its old name "The Beach Day That Got
   Away" as an end-of-summer festival (no swimming in October). **Default: yes to all.** Alternatives: end summer on
   Sun Oct 25 so the two never overlap (summer gets only 9 days), or retitle summer "Autumn Tide Festival".
2. **Marina is a student now.** In the old game she was a 23-year-old lifeguard; our rule is "only heroes are adults"
   and she is a tower, so she becomes the third-year captain of the academy's lifeguard club, in a modest sailor
   uniform and windbreaker. Amane stays a 26-year-old adult captain (elegant coat). **Default: yes.** Alternative:
   keep Marina an adult staff member and allow one adult tower (a rule change for the roster).
3. **Leftover tickets.** When the exchange closes, leftover Shell Tickets turn into coins by mail (50 coins each), and
   there is an unlimited book offer to spend them on before that. **Default: convert to coins.** Alternative: they
   simply expire, as in the old game.
