# Tenka UI pass: show who joins her lab team before the buy

From the ultimates release review (finding G1, medium, design). For Tenka's UI and FX milestone (T4); not built yet.

## The problem

Joint Research (Tenka's lab path, tier 3) and Unified Theory (tier 5) take the player's own girls in her range off the
field for the rest of the battle (they join her lab team and lend her a weapon; no refund, they are back after the
battle). In the tactical drawer, tap 1 on the price shows only her open row ("SELF · Lab team joins" and the tier
sentence) and her range ring. Nothing on the board says *which* girls will leave, so the second tap can surprise a
player who has an expensive girl standing nearby.

## What to build

1. **On tap 1 of the lab path's Joint Research or Unified Theory price** (the row armed, `arm.armedPath(uid)` is the
   lab path and the next tier has `lab.rounds`): every own non-hero girl the sim would take is marked on the board.
   - The list comes from the sim's own rule (`absorbInto` in the lab code, run once at purchase: own girls, not heroes,
     never another Tenka or any girl with a lab of her own, in her range at that moment), exposed as a read-only query
     (e.g. `sim.labCandidates(uid)`) that copies `absorbInto`'s filter exactly, so the preview can never disagree with
     the buy. It is not part of the co-op hash: a read, no state.
   - The mark: a dashed ring in Tenka's violet under each girl's base plus a small "lab" icon over her head (the buff
     icon layer, `src/render/buffIcons.js`, already draws per-girl icons for the selected girl's buff targets: reuse it).
   - Reduce motion: no pulse; the ring and icon still show.
2. **In the open row**, one line under the tier sentence: "Joins her lab team: Aoi, Akane, Yuki" (names, up to three,
   then "+N"), or "No girl in her range: this round takes nobody" (the girls join only at the purchase itself; with
   nobody in range the round is spent and a girl placed later never joins).
   On a phone it replaces the effect chips for that moment (the open row stays one line high plus this line).
3. **Disarm** (2.6 s, another tap, Sell, closing the drawer): the marks go.
4. **Co-op:** only the owner's girls are taken today; the preview shows only the owner's girls (an ally's girls in
   range are never marked, matching the sim).

## Done when

- The marks and the line match the girls actually absorbed, in a unit test on the query and an e2e that arms the price,
  reads the marked uids, buys, and compares with the absorbed list (the TENKA_START engines battle is a good base).
- 844x390, 667x375, 1024x768 and 1280x720 stills: the line fits on one line beside the price, no text under 12 px.
- No sim id change (a read-only query).
