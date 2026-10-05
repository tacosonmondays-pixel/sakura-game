# Free placement (V2) — how girls are deployed

Owner's directive: **no tiles** — units must be freely placeable anywhere on the board, like
Bloons TD6. This document is the reference for the sim rules, the renderer overlays and the
battle-UI interaction. Code: `src/sim/placement.js` (geometry), `src/sim/Sim.js` (API),
`src/sim/headless.js` (`autoPlan`), `src/render/overlays.js` + `BattleRenderer.pick/setGhost/
showTileHints/shakeGhost` (visuals), `src/ui/battle/placement.js` (interaction).
Tests: `tests/sim/placement.test.js`. Dev preview: `previews/placement-v2.html`.

## 1. Rules (sim)

A girl stands at a **continuous** world position `(x, y)` (world unit = 1 tile, y down) and
owns a circular **footprint**:

| who | footprint radius |
|---|---|
| towers (academy girls) | `TOWER_RADIUS = 0.42` |
| heroes (Hikari, Luna, Nami) | `HERO_RADIUS = 0.5` |

(`footprintRadius(def)`; a UnitDef may override it with `footprint`.) `sim.canPlace(unitId, x, y)`
checks, in this order, and returns the first failing `reason`:

| reason | rule |
|---|---|
| `outOfBounds` | the centre must be inside `[0, width) × [0, height)` (a footprint may overhang the edge) |
| `notInLoadout` | unit not in the formation (or unknown) |
| `heroPlaced` | only one hero per battle |
| `occupied` | overlaps another girl: `dist < r1 + r2` (footprints may touch) |
| `path` | footprint inside the path band: `dist(centre, any path centre line) < PATH_HALF_WIDTH (0.55) + r` |
| `blocked` | footprint hits a map obstacle: `T` trees = disc `TREE_RADIUS 0.45` at the tile centre, `R` rocks / `H` buildings & set pieces / `X` void = the tile square (`[tx,tx+1)×[ty,ty+1)`) |
| `needsWater` / `needsLand` | terrain under the **centre**: `~` = water, `.` and `,` = land; `amphibious` takes both. Bridges (`B`) are path tiles and are caught by the band |
| `cash` | `placeCost(unitId, x, y)` (cost-cut auras apply at the spot) |

Consequences worth knowing:

* Towers may stand **0.97** from a path centre line, i.e. their footprint edge sits 0.05 outside
  the 1-tile-wide path slab. A tower at an adjacent tile centre (1.0 away) is legal, so the old
  tile-based placements still work. Heroes need **1.05**: the adjacent tile centre is too close
  for them (tests that parked a hero there were moved to a continuous spot).
* A land girl may overhang water (centre on land); a water girl may overhang the bank.
* Trees block their whole tile plus a 0.45 + r margin — you cannot squeeze between two trees.
* Nothing snaps. There is no grid in the sim any more; `pathTiles` / `tileAt` remain as helpers.

### API (CONTRACTS.md §6)

```js
sim.canPlace(unitId, x, y)          // -> { ok, reason, cost?, x, y }
sim.placeTower(unitId, x, y)        // -> TowerRT | null   (TowerRT: x, y, radius, tx, ty = tile under the centre)
sim.towerAt(x, y)                   // -> nearest girl whose footprint contains the point | null
sim.placementReason(unitId, x, y)   // geometry-only reason (no cash / loadout / hero) | null
sim.footprintRadius(unitId)
sim.placeCost(unitId, x?, y?)
sim.canPlaceTile(unitId, tx, ty) / sim.placeTowerTile(unitId, tx, ty)   // explicit tile wrappers
```

**Legacy rule:** two *integer* arguments to `canPlace` / `placeTower` / `towerAt` / `placeCost`
are read as a tile `(tx, ty)` and resolve to its centre `(tx + 0.5, ty + 0.5)`, so modules that
still loop over tiles keep working (`towerAt(tile)` also accepts a girl standing off-centre on
that tile). New code passes real coordinates; a continuous point that happens to be an exact
integer must be nudged (the renderer's `pick` does this).

Events: `place` carries `{ towerUid, unitId, x, y, tx, ty }`.

### autoPlan (headless)

`autoPlan(stageId, unitIds)` searches a **0.25-tile lattice with a small deterministic jitter**
(never `Math.random`), scoring each candidate by path length covered within the unit's range
(econ girls prefer no coverage, support girls prefer spots inside aura range of placed DPS),
skipping anything inside the path band / obstacles / another footprint. Plan actions carry
continuous `x`, `y` plus the tile `tx`, `ty` under them; old `{ tx, ty }` plans still execute.
The balance sweep (`tests/integration/balance.test.js`) wins every campaign stage on Easy
with it.

## 2. Visuals (renderer)

* `r.pick(clientX, clientY)` → `{ x, y, tx, ty, towerUid, inBounds }`: `x, y` is the continuous
  board point under the pointer; `towerUid` is the girl whose footprint contains it (or whose
  body projects there — she stands up, so her head is on the "tile behind").
* `r.setGhost(unitId, x, y, valid)`: translucent chibi standing exactly at `(x, y)`, a footprint
  disc of her radius, her range circle; green when valid, **red** when not. `r.shakeGhost()`
  wobbles her sideways for ~0.4 s (rejected drop).
* `r.showTileHints(unitId)` — the Bloons look: while a card is held, the **forbidden** zones for
  that girl (path band, obstacles, wrong terrain, other girls' footprints and 1 tile outside the
  board) are shaded with a soft red overlay with a light rim and faint drifting stripes; allowed
  ground stays completely clear. It is a `DataTexture` mask (8 texels per tile) rasterised from
  `sim.placementReason`, drawn on a plane just above the path with bilinear filtering for soft
  edges, and refreshed on `place` / `sell`. Holding a water girl therefore shades every bit of
  land; holding a land girl shades the ponds.

## 3. Interaction (battle UI)

* **Drag**: press a card in the tower bar and drag onto the board (touch: the ghost floats 46 px
  above the finger so the thumb never hides her). Release **anywhere**: if the spot is valid she
  is deployed right there; if not, the ghost turns red, shakes, a one-line reason toast appears
  ("Too close to the path — give the enemies room.", "She can only stand on water.", …) and the
  card returns to the bar after half a second. Releasing over the bar or outside the board cancels.
* **Tap-then-tap**: tap a card (it lifts, the hint bar says *Tap anywhere on open ground to deploy
  Aoi · 200*), then tap the board. A valid tap deploys; an invalid tap shows the red shaking ghost +
  toast and keeps placing mode so you can try again; tapping another girl cancels and selects her;
  tapping outside the board or **Cancel** / Esc cancels. With a mouse the ghost follows the cursor.
* Keyboard: `1-9` picks a card, Esc cancels. Snapping is **off** everywhere.

## 4. Preview

`node e2e/shot.mjs "/previews/placement-v2.html?stage=2-1&hold=sango&auto=1" out.png` —
`hold` picks the girl (forbidden zones shaded, ghost follows the mouse, click places), `ghost=rei,7.3,4.1`
parks a ghost, `place=aoi:6.3:1.7,...` places girls at continuous points, `auto=1` runs `autoPlan`.
The small canvas in the corner rasterises `sim.placementReason` in 2D (red band, grey obstacles, blue
water, orange girls) so the geometry can be judged independently of the 3D overlay.
