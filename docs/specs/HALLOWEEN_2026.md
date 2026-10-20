# Halloween 2026 (track 6): the owner said "This year" (Oct 20)

Build the limited-events framework from `EVENT_SPEC.md` (§1–§3, §5) and ship **Halloween as the first event on it**.
The summer port in EVENT_SPEC comes later; build only the framework parts Halloween needs, but keep them generic.

## Deadline

- The window is `EVENT_SPEC.md` E1 / §3.2: opens game day **2026-10-24** (Fri Oct 23, 7 PM Central), last game day
  **2026-11-01** (ends Sun Nov 1, 7 PM Central), exchange until **2026-11-08**.
- It must be merged and live **before Fri Oct 23, 7 PM Central** (the spec's recommended merge date is Wed Oct 21).
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
- Window (EVENT_SPEC E1), as `src/core/reset.js` computes it: tease `2026-10-21T00:00Z` (Tue Oct 20 7 PM CDT),
  start `2026-10-24T00:00Z` (Fri Oct 23 7 PM CDT), end `2026-11-02T01:00Z` (Sun Nov 1 7 PM CST), exchange end
  `2026-11-09T01:00Z` (Sun Nov 8 7 PM CST). Tested in `tests/core/resetBounds.test.js` and `tests/systems/events.test.js`.
- 3 episodes, 8 spoken lines each (the story lint's minimum; the brief said 4–8), Hikari leads with Aoi, Yuki,
  Sango; read = +50 candy (episode 3 also +50 gems). Unlock chain: Ep 1 → Op 1 → Op 2 → Ep 2 → Op 3 → Op 4 → boss → Ep 3.
- 4 operations (Normal only, free, sweepable once cleared) + the Gourdlight Golem (Normal / Hard) on existing maps
  (`shrine_gate`, `festival_street`, `shrine_steps`, `marsh_boardwalk`, boss on `shrine_sanctum`), tuned like
  2-1 / 2-3 / 3-1 / 3-3 / 3-5. Event stages are not in `STAGES`/`ENEMIES` (E9) and not in co-op (E11).
- The Golem: an original pumpkin-headed construct (render-only head), one phase change at 50 % (shell drops,
  candle wisps, it hurries). Balance (`tests/integration/event-balance.test.js`, autoPlan bot, free units only):
  every operation won on Normal at its tuneLike roster and level (3/3 seeds); boss Normal won by the end-of-chapter-3
  free team at level 20 (3/3); boss Hard lost at level 20, won at level 50.
- Pumpkin Candy (`evt_halloween_candy`), missions (3 daily, 9 one-time), the Candy Exchange (title "Pumpkin
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
