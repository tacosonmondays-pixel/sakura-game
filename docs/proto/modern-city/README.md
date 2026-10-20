# City look test (prototype, branch `proto/modern-city`)

This is a look test only. It is display code: no sim, save, data or online changes, and the
co-op sim id is unchanged (`37b5428d7657`). The four maps are **not** in `MAPS` or `STAGES`.

## What was built

A city theme kit in the real battle renderer, built the same way as the existing themes. Each
variant is a theme in `src/render/themes.js` (plus the kit's `look.city`), and `terrain.js`
calls the kit when that key is set.

- **Streets** (`src/render/city/cityKit.js`):
  - roads are asphalt ribbons with white edge lines and a dashed centre line (`textures.js` path
    styles `asphalt` and `asphaltCracked`), with crisp edges;
  - raised sidewalks with white kerbs, and zebra crossings with stop lines next to the corners;
  - the flyover uses the usual track bridge, and the tunnel uses a new square `subway` style in
    `trackMesh.js`;
  - paving slabs on the ground, plus painted lawns, plaza rosettes, a running track and a court
    (`cityGround.js`).
- **Buildings** (`buildings.js`). All buildings share **one material**: the windows are drawn by
  a shader (`cityMaterials.js`), so a whole skyline costs one draw call. The kinds are:
  - glass towers, offices, flats, shops with striped awnings and a roof café;
  - a school with a clock, a gym and a free-standing clock tower;
  - burnt-out ruined towers;
  - for the modern era: houses with tile roofs, apartment blocks and a corner store.

  The map's H tiles become these buildings, and a skyline fills the margin. It is tall at the
  back and low at the front, so it never covers the board.
- **Street furniture** (`cityProps.js`): ordinary props, merged into the terrain's existing three
  prop meshes.
  - Streetlights, traffic lights, planters with young sakura trees, benches, bus stops,
    hologram plinths, vans, scooters, vending machines and bike racks.
  - Modern era: utility poles with wires, a level crossing and plain street lamps.
- **Elevated maglev** with a train gliding across. It runs along the front edge of the board,
  over a strip of blocked tiles, so it never hides a placement spot. After the surge it is broken,
  with one span fallen.
- **THE GATE** at the spawn. It is a large ring portal with a swirling animated disc, glowing
  rings, gems, soft light and fantasy crystals growing out of the paving. It stands one tile
  inside the board so the phone camera frames it.
- **Ambient life**: drones carrying parcels (one instanced mesh, with ground shadows), blinking
  hologram signs (one draw call), petals, and the existing birds and butterflies.

## The four variants (story eras as of Oct 20)

| Variant | Theme | Map | Era |
|---|---|---|---|
| (a) Downtown, day | `city` | Gateway Avenue | Future city before the fall (records / flashbacks) |
| (b) Academy campus | `campus` | Academy Grounds | Future academy: school gate, sports ground, clock tower, gym |
| (c) City after the gate surge | `citySurge` | Crystal Crossing | **Future city in ruins**: broken towers (hologram signs switched off), wrecks, small fires, smoke, a broken maglev, glowing crystals and cracks, a heavy dusk grade. No gore and no bodies. The road is kept the lightest band so the route reads. |
| (d) Sensei's home town | `town` | Blossom Hill Block | Modern era: houses, shops, a corner store and vending machines, a normal school with its sports ground, cherry trees, utility poles and wires, a railway with a level crossing |

Every route is a city grid of right-angle streets with rounded kerb corners. Each has one
flyover where the route crosses itself and one short subway tunnel. The maps live in
`src/proto/modernCityMaps.js`.

Screenshots (battle camera, quality high): `<variant>-844x390.webp`, `<variant>-1280x720.webp`
and `gate-closeup-1280x720.webp` in this folder.

## How to open the preview

```
npm run dev
# open /previews/modern-city.html?map=downtown   (or campus | surge | town)
#   &quality=high|medium|low  &cam=gate (gate close-up)  &clean=1 (no HUD)
#   &stage=5-3 (a real stage, for comparison)  &empty=1 (no girls or monsters)
node e2e/modern-city.mjs shots <dir>   # the screenshots in this folder (then converted to .webp)
node e2e/modern-city.mjs perf          # the numbers below
```

The preview runs the real Sim with an existing stage's waves (existing enemy families), places
six girls, and spreads monsters along the route.

## Performance

These are empty boards (terrain and ambient only), 1280x720, maximum over 20 frames. Draw calls
include shadow and bloom passes on high. The baseline row is the busiest of all 40 current
campaign stages.

| | Draw calls (high) | Triangles (high) | Draw calls (medium) | Triangles (medium) |
|---|---|---|---|---|
| (a) downtown | 34 | 192k | 17 | 100k |
| (b) campus | 34 | 204k | 17 | 106k |
| (c) ruins | 29 | 106k | 12 | 58k |
| (d) home town | 30 | 175k | 12 | 90k |
| **Busiest current stage** | **41** (5-3, marsh) | **290k** (1-1, sakura) | **18** (5-3) | **140k** (1-1) |

Every variant stays under the busiest current theme on both draw calls and triangles.

Where the budget goes:
- **Static city:** one facade mesh, plus the terrain's usual ground, road, prop, foliage and
  glow meshes.
- **Each moving part:** one call each (train, drones, drone shadows, holograms, portal).
- **Smoke in the ruins:** only a few columns, because every emitter draws from the shared
  particle pool. Too many columns starve the visible ones.

## What real maps would still need

- **Map data and sim:**
  - real MapDefs in `MAPS` and stages in `STAGES`; these change the co-op sim id, so they have to
    ship as one deploy;
  - a `city` block on `defineMap` (blocks, maglev, railway, areas). In the prototype this lives
    on the proto maps only;
  - blocked tiles under the maglev and round the gate are written by hand in the rows today.
    `defineMap` should stamp them.
- **Kit gaps:**
  - a night version of each theme (lit windows: the shader is ready for it);
  - a proper subway station top (the block is plain), varied tower crowns, curved buildings and
    flat intersections with real junction markings;
  - wires and crossing gates that animate (they are static), and the train's crossing timing;
  - a lower-cost setting for low-end phones on (c): shadows off for the skyline, fewer ruins.
- **Tests and tooling:**
  - tests for the city kit in `tests/render` beyond the theme checks;
  - stage thumbnails and the map picker for the new themes.
- **Story:** ruins variants for (b) and (d) if the story calls for them.
