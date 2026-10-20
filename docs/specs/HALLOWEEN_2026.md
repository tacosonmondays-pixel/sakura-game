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
