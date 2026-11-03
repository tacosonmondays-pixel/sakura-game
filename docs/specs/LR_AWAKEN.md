# LR Awakening: UR → LR is an awakening, like Legendary → UR (SET_BOXES_V2.md D5)

Status: **decided defaults, building** on `feature/set-boxes-v2` (off `main` = v0.1.66 `fc978aba`); ships in v0.1.68.
The owner may override any default; open questions in §6. Builds on `GEAR_UPDATE.md` §4 (LR gear).

> Owner: "instead of set LR it should awaken into an LR, like you awaken from legend to UR."

## 1. Today (live v0.1.66)

- **Limit Break** (`src/systems/gear.js` `canLimitBreakGear` / `limitBreakGear`, `src/ui/gearUr.js` `limitBreakModal`):
  a UR +12 piece + 1 Nightglass Lens + 150,000 coins → Nightglass LR, +18. The player picks **Set LR** (`lr: 1`, keeps
  its set, ×4.0 / 2.8) or **Blank LR** (`lr: 2`, gives its set up for good, ×5.0 / 2.8; five of them double every cap).
- **Legendary → UR** is an *awakening*: the piece sheet's primary button turns into **✦ Awaken** at +10, the Rainbow
  Bloom modal (before → after cards, the gains, the rules, power preview, cost) and the "Awakened to UR!" reveal.

## 2. Decided defaults

- **D5a. UR → LR is an Awakening.** It mirrors Legendary → UR: at UR +12 the piece sheet's primary button (where
  "Max +12" sits today) becomes **✦ Awaken**, opening the **Nightglass Bloom** modal (the same layout as Rainbow Bloom:
  UR +12 → LR cards, the gains, the rules, power preview, cost 1 Nightglass Lens + 150,000 coins) and then the
  **"Awakened to LR!"** reveal. A set piece awakens into an **LR** piece of its set: today's Set LR (`lr: 1`, ×4.0 /
  2.8, +18, its LR Set Form at five). No "Set LR vs Blank LR" choice in this flow; player-facing text says "LR", never
  "Set LR".
- **D5b. Blank LR stays** (removing a live option would be a nerf). It moves to a separate, clearly secondary action on
  an LR set piece: **"Unbind to Blank LR…"** (a quiet button in the piece's actions), with today's numbers and today's
  "for good" confirm ("Blank LR takes this piece out of the Party Popper set for good."). It costs **nothing more**: the
  Lens and coins were paid by the awakening, so a set piece's road to Blank LR costs exactly what it does today (1 Lens
  + 150,000), never twice. Unbinding keeps the level, ▲, ✦, pins and lock. A **No-set** UR piece awakens straight into
  Blank LR, as today (the modal says so).
- **D5c. Gameplay is unchanged**: identical numbers, caps, costs and requirements (UR +12 + a Lens). Only the flow and
  the names change. The sim id is unchanged from main (the id pinned for the current `COOP_PROTOCOL`,
  `tests/fixtures/simIds.js`).
- **D5d. Save safety**: `lr: 1` and `lr: 2` pieces keep working unchanged; no new field, no migration. An unbound piece
  is an ordinary Blank LR piece (`lr: 2`, no set) that v0.1.66 already reads; its `glr:` mirror is rewritten with the
  new kind by `writeGearMarks`. Proven by a v0.1.66 round trip (awaken here → v0.1.66 → here; unbind here → v0.1.66 →
  here).
- **D5e. Copy**: the Nightglass Lens's text, the piece picker for "Use Lens" ("A rainbow UR piece at +12 can awaken to
  LR."), the Build Coach's line ("LR: Awaken to LR (keep her set)" / "Awaken, then unbind to Blank LR (her best lines are
  capped stats)"), toasts, the item tooltips and every "Limit Break" a player sees about **gear** say Awaken / LR. The
  girls' own Limit Break (LR units, `src/systems/limitBreak.js`) is a different thing and keeps its name. Achievements
  and marks stay (`MARK.lrEver` "First Nightglass", `MARK.lrForm`, `track('gearLimitBreak')`).

## 3. API

- `canAwakenLrGear(profile, uid)` / `awakenLrGear(profile, uid)`: the awakening; kind = Set LR for a set piece, Blank LR
  for a No-set one (the old `canLimitBreakGear` / `limitBreakGear` stay, unchanged, for tools and tests).
- `lrAwakenReady(g)`: UR, not LR, +12 (the ✦ hint, as `awakenReady`).
- `canUnbindLrGear(profile, uid)` / `unbindLrGear(profile, uid)`: `lr: 1` with a set → `lr: 2`, set removed, the name
  by rarity and slot (as Blank LR from a set piece today); no cost.

## 4. UI

- `girlGear.js` `pieceActions`: primary ✦ Awaken for `lrAwakenReady`; the quiet "Limit Break" button goes; a quiet
  "Unbind to Blank LR…" (`gear-unbind-lr`) on an LR set piece.
- `gearUr.js`: `lrAwakenModal(uid)` (`data-testid="gear-lr-awaken-modal"`, go `gear-lr-awaken-go`), `showLrAscension`
  (`gear-lr-ascend`), `unbindLrModal` through `confirmDialog`; `limitBreakModal` becomes an alias of `lrAwakenModal`
  (the Lens's "Use" picker opens the awakening).

## 5. Tests

- Unit: the awakening makes Set LR from a set piece and Blank LR from a No-set one with today's costs and checks; unbind
  makes Blank LR at no cost, only from LR set pieces, keeps level / ▲ / ✦ / pins; the total cost of a set piece's road
  to Blank LR equals today's; v0.1.66 round trips.
- e2e `e2e/awaken-lr.mjs` (was `e2e/limit-break.mjs`, same coverage): four pieces awaken from her slot sheet, the fifth
  from the Backpack (the LR Set Form wakes), a spare unbinds to Blank LR through its confirm, the No-set spare awakens
  straight to Blank LR, the Lens "Use" picker, achievements, the Build Coach line.

## 6. Open questions (defaults in bold)

1. **Unbind price.** **Free** (already paid by the awakening; today's total). Alternative: a second Lens — rejected by
   default, it would double-charge.
2. **Where "Unbind" lives.** **A quiet button on the LR piece's actions**, never in the awakening.
