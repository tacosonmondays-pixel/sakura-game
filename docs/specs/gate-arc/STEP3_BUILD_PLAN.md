# Gate Arc · Step 3 build plan

Written Oct 28, 2026 against `feature/gate-arc` at the end of Step 2 (head `b4a5eaa`, sim id `3ba0794e17d4`, data hash
`c279818a`, COOP 8). The approved spec is `docs/specs/GATE_ARC.md` (§13 the Ashen Warden, §17 rows 3-6…3-10, §18.1
Old Town and `ruined: 'burning'`, §18.4 `hammerTear`, §18.6 grim but readable, §18.9, §19 Step 3) with
`docs/specs/gate-arc/MAPS.md` §1.4, `STORY.md` §7.3 (the Brigade on the road) and §11 Act 3, and `TECH.md` §3.9, §3.10,
§4.2 ("a rift opening mid-board"). This plan covers Step 3 only: the Old Town district, the burning look, the mid-board
rift, the tear, Act 3 "The Bell Festival" (3-6…3-10), and the first Brigade unit (the Gnat spotters) with their fall FX
and barks. Nothing here ships; the coordinator folds steps into release candidates.

**Owner constraints that override the spec here.** "Content before anything" and "don't touch 3D models; the enemy
rebuild comes later": **no new GLB and no GLB edit in Step 3.** GATE_ARC §18.9's `brigade.glb` kit (trooper, Gnat,
Tortoise, Badger, Strider, HAMMER variants, face atlas, clips) is deferred whole. The Gnat ships as data on a shipped
GLB (§2 decision 1). Anything else the spec wants as new 3D art is listed under §9 Owner questions.

Rules for every builder session are Step 1/2's unchanged (STEP1_BUILD_PLAN §0): push only `feature/gate-arc`, no force
pushes or history rewrites, no bare `git stash`, temp files in the session scratchpad, `rm -rf dist` after a build,
≥ 1.5 GB free, no other games' or anime names anywhere, Sensei never gendered and never romantic, students never
sexualised, no gore (loss is shown by absence; war words only in `g*` scenes, as the content lint already allows),
**COOP_PROTOCOL stays 8** (`PENDING_BUMP` in `tests/art/itemArtRuntime.test.js` follows the sim id). Every milestone
gets the review gate (independent OK, ≤ 3 fix rounds, explicit effort levels on every helper: low for gates and shots,
medium/high for building, xhigh for the final reviews), the hash log (`docs/specs/gate-arc/STEP3_HASHES.md`) and owner
boards (`docs/review/gate-arc/step3/`, labelled JPEGs ≤ 400 KB).

### Expected hash moves

| Milestone | Sim id | Data hash | Why |
|---|---|---|---|
| S3a | **unchanged** | **unchanged** | render, previews, UI text and tests only (district, burning look, rift gate render, tear, Brigade FX and barks on fixtures). A done-when check |
| S3b | changes | changes | 5 maps in `maps.js` (`district`, per-path `inside` flag, the echo) |
| S3c | changes | changes | 5 stages (`scenery.ruined`), 5 rule placements, the Ashen Warden, the `brigade` family + the Gnat in `enemies.js` |
| S3d | unchanged vs S3c | unchanged vs S3c | story data and the story player sit outside the sim graph |

As in Steps 1-2, `tools/simId.mjs` hashes every data file the sim imports, so the sim id moves with MAPS / STAGES /
ENEMIES even though Step 3 adds **no sim code** (GATE_ARC §19: "rift [render + test]: data hash; the Brigade is art +
data only").

---

## 1. What Steps 1-2 already give us (reuse, do not rebuild)

| Need | Where it is |
|---|---|
| The `city` look by night | `THEMES.city` + `nightLight` (`src/render/themes.js`), stage `scenery.night: true`; the city kit (`src/render/city/cityKit.js`, `cityProps.js`, `buildings.js`) with `map.city` hints (`areas`, `railway`, `waterBus`, `pieces`, `searchlight`) |
| Rooftops `U` | sim + render since S1c; Old Town roofs are `U` tiles on `oldHouse` blocks (`buildRoofs`) |
| Act II stage builder | `ACT2_PLAN` rows 3-6…3-10 and `act2Stage(o)` (`src/data/stages.js`; passes `look`, `laneCycle`) |
| Rule skins | `STAGE_RULE_SKINS` / `ruleTextFor` (`src/ui/text/rules.js`); every number of the base description kept (`tests/ui/ruleSkins.test.js`) |
| Act II prep hint | `ACT2_MECHANIC` in `src/ui/text/acts.js` (add chapter 3's line) |
| Render-only dimming on a rule pulse | `src/render/blackout.js` + `BattleRenderer` `ruleState` routing: the tear's pulse hooks the same events |
| Echo maps | `echoMap(spec, o)` + `echoDiff` (`src/data/maps.js`), `echoProblems` / `MAX_ECHOES = 3` (`tests/data/world.test.js`); 1-10 is echo #1, 3-10 becomes #2 |
| Decor scale / cover | decor `s` (scale, Step 2) and `r` (cover, Step 1) in `terrain.js` |
| Story | `g1.js` / `g2.js` patterns; `format.js` (`META_KEYS` `act`, `note`, `ifOwned`; `ENEMY_SPEAKERS`); `ACT_SCENE_IDS`; `ifOwned` gating in `storyTriggers.js`, the archive and the scene route; Act II stage backgrounds (`src/ui/story/backdrop.js`: painted place → theme skyline SVG with `PLACE_VARIANT` → academy tint) |
| Veterans keep family achievements | `familiesFound` skips an Act II member whose stage the save cannot open (`src/systems/achievementMetrics.js`): the Ashen Warden is covered automatically; the new `brigade` family is a 13th family a veteran never had complete, so no count drops |
| Two-key unlock | 3-6 `requires: ['3-5', '2-10']` from `ACT2_PLAN`; lock text and Next-button guard work on live data since Step 2 |
| Map authoring harness | the Step 2 scratch checker (overlay + IoU top-3 + signature + meander + water counts), to be copied into the new session's scratchpad |

`ACT2_PLAN` for chapter 3 (computed, not typed): every row `hpPass` 1.4, `dropChapter` 4, `modeChapter` 4,
`medalGemMul` 0.5.

| Stage | Waves | hpScale | cashScale | startCash | Tier | requires |
|---|---|---|---|---|---|---|
| 3-6 | 24 | 2.87 | 1.54 | 770 | intermediate | `['3-5', '2-10']` (two-key) |
| 3-7 | 25 | 3.02 | 1.59 | 780 | advanced | 3-6 |
| 3-8 | 25 | 3.16 | 1.63 | 780 | advanced | 3-7 |
| 3-9 | 26 | 3.32 | 1.68 | 790 | advanced | 3-8 |
| 3-10 | 26 | 3.49 | 1.73 | 790 | advanced | 3-9 (finale) |

---

## 2. Decisions this plan makes where the spec is silent (or where the owner overrides it)

> **Builder's override of decisions 1-2 (Oct 28, before S3c):** no 13th family in Step 3. `brigade_gnat` joins the
> **construct** family (a city-built machine, drawn on the construct GLB, navy with an amber stripe), with Brigade lore.
> A one-member `brigade` family that the save cannot open yet would count as *complete* under `familiesFound`'s Act II
> rule (every member skipped) and hand out family achievements; it would also move the bestiary tabs and the 12-family
> pins for one enemy. The `brigade` family arrives with the Brigade GLB in the enemy rebuild (*owner question*). Text
> below that says "13th family" / `FAMILIES.brigade` reads as "construct family" for Step 3.

1. **The Gnat without a Brigade GLB.** A 13th family `brigade` is added to `FAMILIES` / `FAMILY_ORDER` as **data**
   (name "Gate Response Brigade", our own navy-and-amber city responders). Its one Step 3 member, `brigade_gnat`, draws
   on the **shipped construct GLB** through `model: { base: 'construct', variant: 'cogling', props: ['gears'] }`, tinted
   navy `#2b3a5c` with an amber `#f4a62a` accent, `size` ≈ 0.55 (knee height), so the bestiary and the battle show a
   small navy machine with an amber stripe. `buildEnemy` already honours `def.model.base`
   (`src/models/enemies.js:25`), so no loader change. The real Brigade kit (rotors, camera eye, LINK LOST screen) waits
   for the owner's enemy rebuild. *Owner question.*
2. **The family rule and the 4-per-family test.** `tests/data/world.test.js` pins 12 families and ≥ 4 defs per family.
   `FAMILY_IDS` becomes 13; the ≥ 4 rule exempts `brigade` with a comment ("grows to 8 by Step 7; Step 3 ships the Gnat
   only"). `tests/models/enemies.test.js`' manifest check accepts a family whose defs all name a `model.base` with a
   shipped GLB (no `brigade.glb` in the manifest).
3. **Gnat numbers.** STORY §7.3: hp 12 · speed 1.6 · light · armour 0 · threat 1.2, `hasty` (the goblin runner's numbers),
   tier normal, `introducedIn: '3-9'`, bounty as the goblin runner, leak 1. Fixed "spotter" groups on every sixth wave of
   3-9 only (`F(6k, 'brigade_gnat', 5, 0.35)`), never in the pool; no other stage fields it in Step 3.
4. **Rules outside the chapter.** §17 gives 3-7 `forge_vents` (Act I first at 6-3), 3-8 `alchemists_mist` (5-1) and 3-9
   `heat_mirage` (6-2), against the "families and rules seen by chapter *c*" line of STORY §4.5. As Step 2 did with
   `lunar_eclipse` on 2-7, the plan **keeps §17**: each Act II rule is taught on its own rule card and prep hint, and no
   test pins rules to chapters. *Owner question.*
5. **Old Town is a district, not a theme.** `MapDef.district: 'oldtown'` (§18.1) on `theme: 'city'` maps, read by the
   city kit to swap the building set (`oldHouse`: wooden walls, tiled roofs carrying `U`), the road style (`setts`) and
   the ground (plaster and stone). 3-6, 3-7, 3-9 use it; 3-8 and 3-10 are the shrine side (`city` + shrine pieces).
6. **`ruined: 'burning'` is a stage scenery flag** resolved in `resolveLook` like `night` / `fog`: `building` →
   `ruinBlock`, scatter → `rubble`, `burntCar`, `fallenPole`, `debris`; ash-dusted ground, scorch marks; low warm key
   light ≥ 1.2 (§18.6.3), dark sky, ≤ 6 smoke columns from the skirt, ≤ 12 fire glows on `H` / `X` tiles ≥ 1.5 tiles
   from the centreline, embers, ash fall, a stray cat. The road stays the lightest band. Used by 3-9 and 3-10; the flag
   is part of `STAGES` (data hash, S3c).
7. **Mid-board rift (3-8).** Per TECH §4.2: a per-path `inside: true` flag on the path spec; `trackMesh` skips the head
   run-out when the start is inside the board; `world.test.js`' edge-spawn check honours the flag; the spawn gate at an
   inside start is a `petalRift` standing on the water (a floating set piece, ≤ 1 extra draw call). The sim needs no
   change: enemies already spawn at a track's first point. Only 3-8 sets it.
8. **The tear (3-10).** `hammerTear` (§18.4): a jagged black-violet seam over the burning sanctum, glow geometry, no ring,
   crackling sparks; it **pulses with the rule** (`lunar_eclipse` → "The tear") through the same `ruleState` routing as
   the blackout (render only, scalars only, no per-frame allocation). 3-10 does not set `look.blackout`.
9. **Brigade fall FX.** Families get a render-side `fall` style: `brigade` machines (the Gnat) use `sparkFall`
   (reuses `fx.sparkle`, amber sparks, the body fades, nothing stays on the road) and **no homeward sparkle** (first
   light cannot send a Brigade unit home: STORY rule 5). Trooper fall-and-fade and the `breakdown` steam/scrap FX for
   heavier machines are written and covered by a fixture test, but no Step 3 stage fields a trooper or a vehicle.
10. **Brigade barks** (STORY §7.3): a render-only bark chip (≤ 6 words, the monster-banner style, ≤ 1.6 s, one at a time
    per side of the board) over a Brigade group on spawn and over a unit when beaten, from a table in
    `src/ui/text/barks.js` keyed by unit and event. Step 3 uses the Gnat's: spawn "Gnats up!" / "Channel 9, moving up!",
    beaten "LINK LOST" (the screen text, as a chip, since the model has no screen). The bestiary line: "Watches
    everything. Understands nothing. Reports both." No bark or line describes a wound or a body.
11. **The Ashen Warden** (`ghost_ashen_warden`): ghost family, tier `miniboss`, the Hollow Samurai GLB (`variant:
    'samurai'`, props `helmet`, `sword`, `mask`), charred tint (`#4a4440`, accent `#ffb347` embers), size 2.3, armour 3,
    `phasing { every: 5, duration: 1.5 }`; phase 0.66 "The Warden plants its blade. Lantern Bearers answer the bell!"
    (`summoner: ghost_lanternbearer ×1 every 8`), phase 0.33 "Ash falls from the empty armour. It will not bow." (armour
    5, phasing every 4). hp **≤ 4,000** (the balance anchor that capped Old Lamp-Hugger at 3,900; start 3,950), threat
    ≈ 190, `introducedIn: '3-10'`, lore by absence ("An empty armour that kept the watch at the Lakeside Shrine. When the
    bell rings over the ash, it rests."). Joins `ENEMY_SPEAKERS`. No crown drop (the ghost family has none; 2-10 had
    none either).
12. **NPC speakers.** Ms. Hazuki, Mahiru, Kuroe (Channel 9), Kagari, the old oni, the shrine keeper and the young oni
    speak as `unknown` with name plates, as in g1/g2. Hotaru, Umeko, Miko, Ena, Noa, Iroha, Fuu speak as their units
    (side scenes gate on `ifOwned` when the girl is the scene's point: `g3.noa`, `g3.iroha`, `g3.fuu`; STORY's *ifUnit*
    means "owned" in its sense, which is what `ifOwned` was built for in Step 2).
13. **Ms. Hazuki's fate is told by absence only.** `g3.after`: names read aloud in Shelter 3; she went back twice; "She
    does not answer." Nothing more is shown or said about her body or her death; `g3.epi` closes with Sensei reading her
    roll. The story-safety reviewer checks this scene first.
14. **Story places after main merges** (`STAGE_PLACE` from release/next, existing pictures only): 3-6
    `festival-street`, 3-7 `festival-street`, 3-8 `shrine-steps`, 3-9 `festival-street` (no burning picture exists),
    3-10 `shrine-bell`. Until then, Act II stage backgrounds fall back to the theme skyline SVG; Step 3 adds an `oldtown`
    night and a `burning` variant to `themeBackdropSVG` (`PLACE_VARIANT` keyed by map id). *Owner question: paint
    "old-town-night" and "old-town-burning" with tools/story-bg (own words, SFW).*
15. **Out of Step 3:** the Brigade GLB kit and every other Brigade unit (Steps 4/7), in-battle radio lines beyond the
    barks, x-10 cosmetics, portraits for NPCs, new faces and music cues, the HAMMER Carriage (7-9).

---

## 3. S3a · Old Town, burning, the rift gate, the tear, Brigade FX and barks (render only)

**Goal.** Every new look and effect on preview boards, no stage using it yet; hashes unchanged.

| File | Change |
|---|---|
| `src/render/city/cityKit.js`, `buildings.js` | `map.district === 'oldtown'`: the `oldHouse` block set (≤ 6 variants: two-storey shop house, merchant house with a curtain, storehouse, small shrine hall, lantern shop, bathhouse), roofs carrying `U`, near + far LOD |
| `src/render/city/oldTownProps.js` (new) | `lanternString` (glow geometry; every fourth lantern a sprite), `shopCurtain`, `stoneBasin`, `ringToss`, `bowStage`, `griddleStall` (steam emitter), `festivalPoster`, `easel`; ≤ 6 variants each, triangle caps |
| `src/render/city/ruinProps.js` (new) | `ruinBlock` (jagged top, missing corner, scorched, fire in ≤ 1 window in 4), `rubble`, `burntCar`, `fallenPole`, `debris`, `hammerTear`; fire glows only on `H`/`X` tiles ≥ 1.5 from the road |
| `src/render/themes.js` | `resolveLook`: `scenery.ruined === 'burning'` table (ground tint, key ≥ 1.2, sky, fog colour, accents amber); `district` road/ground styles |
| `src/render/textures.js` | `pathTexture('setts')` (stone setts, the v-across UV trick); `paintGround` `stone` / `plaster` / ash dusting; ground marks `scorch`, `cracks` in the shared atlas |
| `src/render/ambient.js` | burning: ≤ 6 smoke columns from the skirt, embers, ash fall, the stray cat; Old Town: lanterns swaying, stall steam |
| `src/render/trackMesh.js` | skip the head run-out for a track whose first point is inside the board (`inside`) |
| `src/render/terrain.js` | inside-start spawn gate (`petalRift` on water when the tile is `~`), the tear pulse hook |
| `src/render/BattleRenderer.js` | route `ruleState` to the tear (as to the blackout); per-family `fall` style (`brigade`: `sparkFall`, no homeward sparkle); bark chips |
| `src/render/fx.js` | `sparkFall` (amber sparks, reuses `sparkle`), `breakdown` (steam puff + scrap shards that fade with the body; fixture only) |
| `src/ui/text/barks.js` (new), `src/ui/battle/barks.js` (new) | the bark table (STORY §7.3) and the chip (one per side at a time, ≤ 1.6 s, ≥ 12 px on phone) |
| `src/art/backdrops.js` | `themeBackdropSVG('city', { variant: 'oldtown' | 'burning' })` |
| `src/art/stageThumb.js` | Old Town and burning palettes for the campaign card thumbnails |
| `previews/oldtown.html` + `previews/oldTownMaps.js` | three fixture boards outside `MAPS`: the Old Town lanes by night, the same ground burning, the lake rift; toggles for the tear pulse and a Gnat group (fall FX + barks) |
| Tests | `tests/render/oldTown.test.js` (builders near/far, caps, deterministic, 0 transparent), `tests/render/burning.test.js` (fire never within 1.5 tiles of the road, smoke ≤ 6, key ≥ 1.2, road lightest band in the ground palette), `tests/render/insideSpawn.test.js` (no run-out, gate at the inside start), `tests/render/tear.test.js` (pulses only while the rule is active, scalars), `tests/render/brigadeFx.test.js` (no homeward sparkle for `brigade`, nothing left on the road), `tests/ui/barks.test.js` (≤ 6 words, no wound words, one chip per side) |

**Budget** (node measurement as S1d/S2, each preview board at high/medium/low): ≤ 10 terrain draw calls + ≤ 3
instanced movers, ≤ 90k / 65k triangles (spec estimates: Old Town 80-88k, burning 75-85k), ≤ 250 glow sprites
(lantern strings are the risk), ≤ 40 emitters (≤ 6 smoke, ≤ 12 fire glows), 0 sorted transparent.

**Done when.** `npm test` green; **sim id and data hash equal Step 2's**; budget table in `STEP3_HASHES.md`; greyscale
contact-sheet check at 844×390 (road, gates and every enemy visible on the burning board, §19 gate); build OK, `dist`
removed; independent visual reviewer OK.

**What the owner sees.** Old Town at night, the same ground burning, the lake rift, the tear pulsing, a Gnat group with
its barks and spark fall (844×390, 1280×720, 390×844).

---

## 4. S3b · The five maps (`src/data/maps.js`, theme `city`, 20×12, night)

Authoring tests as Steps 1-2: radius ≥ 1.4 (use r ≥ 1.5, every run between two corners ≥ 2r), bend < 14° per sample,
flat junctions ≥ 2 apart, tunnels ≥ 1 tile, edge spawns and exits (3-8's rift lane flagged `inside`), IoU < 0.65 and a
different turning signature against **all 59 maps** (incl. the ten Noon maps). **No new meander:** `sakura_lane` and
`foundry_core` already use the two allowed, so every shape below is checked with the harness before the test run
(`isMeander`: one track whose alternating lobes ≥ 140° run three in a row). Every chapter-2+ map keeps ≥ 8 water tiles
within 3 tiles of the road. Coordinates are a starting sketch (x east, y south, board x 0…20, y 0…12).

| Stage | Map id · name | Path sketch | Water | Nearest shapes → watch |
|---|---|---|---|---|
| 3-6 | `noon_old_town` · Old Town Lanes · `district: 'oldtown'` | **Fret, alternating keys.** Spawn west `[-1, 7.5]`; key 1 hangs north (up, east, down: `[3.0,7.5]→[3.0,3.0]→[6.5,3.0]→[6.5,7.5]`), a short run east, key 2 hangs south (`[9.5,7.5]→[9.5,10.5]→[13.0,10.5]→[13.0,7.5]`), key 3 north again (`[15.5,7.5]→[15.5,3.0]→[18.0,3.0]→[18.0,6.0]`), exit east `[21, 6.0]`; `street(..., { r: 1.5 })`. Keys alternating north/south give lobes −90 +180 −90 +90 −180 +90…: the big lobes never sit next to each other, so `isMeander` is false (a run of same-direction keys, the spec's literal "squared spirals", **is** a meander: do not build it). The `U` roofs sit inside each key (2×2 or 2×3 `oldHouse` roofs) | the mill race along the south (row 11) and a stone washing basin: ≥ 12 | 1-7 Covered Arcade (comb teeth all south: a meander) and Sunken Hollow: alternating keys and the roofs inside them differ; check IoU vs 1-7 |
| 3-7 | `noon_takoyaki_row` · Takoyaki Row · `district: 'oldtown'` | **Lantern N.** Spawn north-west `[-1, 1.5]`; a long diagonal down to `[7.0, 10.0]`, a wide turn (r ≥ 2) up, a long diagonal up to `[13.0, 2.0]`, a wide turn down, a diagonal to exit south-east `[21, 10.5]`; diagonals as straight `L` runs between curve nodes. Two burn zones (`forge_vents`) on the two stall rows the road crosses mid-diagonal | a canal on the west edge (col 0-1, rows 5-11) with festival boats: ≥ 10, ≥ 8 near the road at the first diagonal | the Ashwing Summit arena (bolt with a curl): no curl; 2-8 staircase (stepped diagonal): long true diagonals, two wide reversals |
| 3-8 | `noon_shrine_steps` · Shrine Steps (fog) | **Two fronts, one climb.** Town road from the west `[-1, 8.5]` east to the foot of the steps `[8.5, 8.5]`; the rift lane `{ inside: true, nodes: [[16.5, 9.5], L, [12.0, 9.5], [10.2, 9.0]], join: { path: 0, at: [8.5, 8.5] } }` starts mid-lake on a jetty deck (bridge tiles) and comes ashore; then two switchbacks up the steps (east `[13.5, 6.0]`, hairpin r 1.5, west `[5.5, 3.5]`, hairpin, east) to the precinct gate, exit north `[11.5, -1]`. Two hairpins → at most two big alternating lobes: not a meander | the lake (east half, rows 7-11): ≥ 50 | Thousand Steps (switchbacks): the lake lane and the Z offset east; 1-9 (fork/join) and 2-7 (join): the join sits at the switchbacks' foot |
| 3-9 | `noon_old_town_burning` · Old Town, Burning · 3-6's ground | **Broken fret.** 3-6's rows with keys 1 and 3 filled by collapsed houses (rubble `X`); one long S from the west `[-1, 9.5]` round the first rubble mound (centre ≈ (6, 5), passing south of it), across the burnt block, round the second (≈ (13, 8), passing north of it), exit east `[21, 3.5]`. Built with nodes + `L` straights (2 wide lobes, one each way) | 3-6's mill race (hoses into it): ≥ 12 | **3-6 (same ground)**: must pass IoU < 0.65 against it (the S uses different rows from the keys); 2-9 (lap) and 2-10 (curl) are not close |
| 3-10 | `noon_lakeside_shrine` · The Lakeside Shrine · echo of `shrine_sanctum` | `echoMap(SHRINE_SANCTUM, { id, name, theme: 'city', echoDiff: [...] })`: Inner Sanctum's rows, paths, crossings and tunnel as shipped; `echoDiff` lists only changed tiles (charred trees `T` → rubble `X` on the precinct edges, if any), the burning look and the tear come from the stage (`ruined: 'burning'`) and decor (`hammerTear` over the sanctum, `shrineBell` as the third stone, a charred torii) | the shipped mirror ponds (≥ 8 near the road) | declared echo (exempt from its original only); `MAX_ECHOES` 3 → this is the second |

Dressing (map `decor` / `city` hints / stage `scenery.props`): 3-6 lantern strings, shop curtains, the festival poster,
an easel on a corner, cats on the roofs; 3-7 stalls, the ring toss, the bowing-contest stage, bunting, steam; 3-8 stone
steps, the bell tower's silhouette, a torii-shaped stone half-sunk in the shallows, the far shore's brazier glowing in
the fog; 3-9 burnt lantern strings, scorched curtains, the poster face down, the easel knocked over, fire glows, smoke,
embers, ash, hoses into the mill race; 3-10 the bell, a charred torii, the sanctum roof burning, charms on the steps.
The easel stays decor for everyone (an `ifUnit` decor gate is out of scope).

**Tests.** `tests/data/world.test.js`: map count 59 → 64; every authoring test for the five (the `inside` exemption only
for 3-8's rift lane); echoes 1 → 2; water; `district` in the MapDef contract (CONTRACTS.md). `tests/render/cityKit.test.js`:
caps for `oldHouse`, `ruinBlock`, `hammerTear`. `tests/render/terrainGolden.test.js`: skip the new maps as it skips
campus.

**Budget.** The node measurement on the five real maps at all three qualities, recorded in `STEP3_HASHES.md`.

**Done when.** Authoring tests green (and the harness shows no meander), budget within limits, sim id and data hash
recorded (both move), `PENDING_BUMP` updated.

---

## 5. S3c · Stages, rules, skins, the Ashen Warden and the Gnat

### Stages (`src/data/stages.js`, via `act2Stage`; `CHAPTERS[2].act2Name 'The Bell Festival'`, `act2Theme 'city'`, `act2Desc`)

| Stage | Rule (`STAGE_RULES`) | Skin (`STAGE_RULE_SKINS`) | Pool (lead first) | Notes |
|---|---|---|---|---|
| 3-6 | `moonlit_blessing` | Bell Festival | ghost_wisp, ghost_veilwraith, slime_violet, lizard_skink | `scenery: { night: true, props: [...] }` |
| 3-7 | `forge_vents` (2 zones on the stall rows) | Hot Griddles | ghost_wisp, ghost_phantom, goblin_smoke, goblin_dasher, slime_violet, slime_gold | zones placed where the road crosses the two stall rows |
| 3-8 | `alchemists_mist` | Lake Fog | ghost_veilwraith, ghost_phantom, ghost_lanternbearer (elite, from wave 10), slime_violet, lizard_hunter, orc_grunt | `scenery.fog: true`; the rift lane fields its share like any lane |
| 3-9 | `heat_mirage` | HAMMER's Smoke | ghost_phantom, ghost_lanternbearer, ghost_veilwraith, goblin_smoke | `scenery.ruined: 'burning'`; the Gnat spotters only as fixed groups every sixth wave; `introduces: ['brigade_gnat']` |
| 3-10 | `lunar_eclipse` | The Tear | ghost_hollowknight (elite), ghost_lanternbearer, ghost_phantom + earlier ch-1…3 families | `ruined: 'burning'`; boss `F(26, 'ghost_ashen_warden', 1, 2, 6)`, `introduces: ['ghost_ashen_warden']` |

Budgets start from the same-slot chapter-4 Act I budgets (as S1d used chapter 2's and S2 chapter 3's) and are tuned only
by the Easy gate. Skins keep every number of the base description. `rules.test.js` placements = `CAMPAIGN_IDS.length − 3`.

### Enemies (`src/data/enemies.js`)

- `ghost_ashen_warden` (decision 11).
- `FAMILIES.brigade` + `FAMILY_ORDER` (last), and `brigade_gnat` (decisions 1-3), with the bestiary lore line.

### Tests (update)
- `tests/data/world.test.js`: STAGES 69 → 74, campaign 50 → 55; minibosses 6 → 7; `FAMILY_IDS` 13 (with the `brigade`
  ≥ 4 exemption); the campaign-enemy cap (≤ 110) holds; the 5b balance anchors (miniboss hp ≤ 4,000).
- `tests/models/enemies.test.js`: the Gnat resolves to the construct GLB's `cogling` with `gears`; the manifest check
  accepts a `model.base` family.
- `tests/data/act2Plan.test.js`: chapters 1-3 registered; `CAMPAIGN_IDS` 55.
- `tests/systems/act2Unlocks.test.js` / `tests/ui/campaignActs.test.js`: chapter 3's Act II waits for 3-5 **and** 2-10;
  chapters 4-8 stay one act.
- `tests/data/achievements.test.js` + the ledger: `a_ch3_act2` live (append its row; never edit others); counts 131 →
  132, the act2 series grows to three steps.
- `tests/systems/achievementMetrics.test.js`: a veteran who had found every ghost keeps the family while 3-10 is locked
  (the Step 2 rule, now for the Warden); the 13th family never lowers `familiesFound`.
- Counters that move with five more stages (events, missions, modes 50 → 55 medals 200 → 220 ribbons 1000 → 1100,
  profile trophies 69 → 74, profile card, achievements model/retro, engines wave digest); `campaignGolden` / `waves`
  stay Act I only; `consistency.test.js` Act II order through 3-10.
- `tests/integration/balance.test.js`: the Easy gate wins all 55; `BALANCE=full` rows for 3-6…3-10 in `STEP3_HASHES.md`.
- `src/ui/text/acts.js`: `ACT2_MECHANIC[3]` ("The Bell Festival: Old Town roofs, hot griddles, a rift on the lake, the
  street gone. Finale: the Ashen Warden.").

**Done when.** `npm test` green, Easy gate 55/55, an old save keeps every unlock (and every family achievement), sim
id and data hash recorded (`PENDING_BUMP` updated), independent reviewer OK on data and sim.

---

## 6. S3d · Story (`src/data/story/scenes/g3.js`, registered after `ch3` in `src/data/story/index.js`)

| Id | Trigger | Title | Kind | Beats (STORY §11 Act 3) |
|---|---|---|---|---|
| `g3.pro` | before 3-6 | Bowing Contest | main | the Lakeside Shrine's bell festival; Miko and the shrine keeper bow for eleven minutes; Ena predicts the takoyaki stand will sell out; Ms. Hazuki buys Sensei takoyaki: "Now we're even." Choice "We are not even." / "Two more and we're even."; Mahiru wins a paper lantern at the ring toss |
| `g3.iroha` | after 3-7, `ifOwned: ['iroha']` | The Day Before | side | Iroha paints the Old Town |
| `g3.mid` | before 3-8 | Fog on the Water | main | Umeko: "The tide says... wait. It has never said wait like that."; the Petal Gate opens wide in the fog; on the far shore a palanquin with a great brazier and a column of shivering people with horns, tusks and lanterns; the old oni carrying children ("Little ones. Warm hands. Hold on."); the young oni keeper; Hotaru: "They're not angry. They're freezing." |
| `g3.hammer` | after 3-8 | Hammer | main | Kuroe on Channel 9: "Protocol HAMMER. Saturate the gate zone."; Hikari: "Don't— there are people on both shores!"; the barrage told by light and sound (the far shore glows, the sky over the shrine tears black-violet, the wind turns the fire into the Old Town); Ms. Hazuki: "Mahiru's still at the stalls." and runs back in; Hikari on Channel 9: "Those drones are HAMMER's eyes. Ground them." |
| `g3.noa` | after 3-9, `ifOwned: ['noa']` | Plasters First | side | she runs out of plasters for the first time, and keeps going (no wounds described: the empty box tells it) |
| `g3.boss` | before 3-10 | The Ashen Warden | main | the shrine burning; an empty armour will not bow: "Halt. The shrine... fell."; Hotaru: "It isn't lonely. It's grieving."; the bell is the third stone; "We'll keep the watch." |
| `g3.after` | after 3-10 | Roll Call → see below | main | "First light" in the ruins: the bell rings over ash and the fire lies down; Shelter 3; names read aloud; Ms. Hazuki went back in twice, once for Mahiru, once for a boy who dropped his phone; she does not answer (decision 13); Mahiru: "She came back for me. I'm nobody. Why would she come back for me?" |
| `g3.epi` | after 3-10 | Two Fires | main | morning; Sensei takes Ms. Hazuki's homeroom and reads her roll; at the end Mahiru says "Hazuki-sensei." and the class answers "Present."; Sensei leaves a lunch on her desk, the debt settled; across the lake, at a cold brazier, Kagari sends the captured Hilltop students home: "We came for warmth. You answered with fire."; the old oni's place at the brazier is empty |
| `g3.fuu` | after 3-10, `ifOwned: ['fuu']` | No Twirling | side | she carries the news of Ms. Hazuki over the rooftops, and doesn't twirl once |

**Title.** STORY calls `g3.after` "Roll Call", which `tests/data/potential.test.js` rejects as a reserved upgrade-step
name (Step 2 hit the same rule with "Roll Call of Static"). Default: **"Names Read Aloud"**. *Owner question.*

Writing rules (as g1/g2): 8-18 spoken lines, ≤ 1 choice, ≤ 4 portraits, ≤ 3 on stage, opens with narration or Hikari,
**Hikari speaks in every main episode** (in person or on Channel 9), lines ≤ 110 characters, titles ≤ 32 characters,
`{name:id}` tokens, shipped faces only, backgrounds `stage:3-6…3-10` (decision 14) or shipped academy/cg ids. This act
is the turn: loss is told by absence (an empty place at the brazier, a name with no answer, a lunch left on a desk),
never by bodies or wounds; the barrage is light, sound and wind. Sensei is never gendered and never romantic (the debt
with Ms. Hazuki is settled as colleague banter). No content note: the arc's one note is on `g1.pro` (the plan's default;
*owner question* whether Act 3 earns its own).

Other changes: `ACT_SCENE_IDS['3:2']` = the main six + the three `ifOwned` sides (as chapter 2 lists `g2.class`;
*owner question* carried from Step 2); `ENEMY_SPEAKERS` += `ghost_ashen_warden`.

**Tests.** `tests/story/content.test.js`: 50 → 59 scenes, archive order, the Act II shape test for chapter 3 (opener
before 3-6, boss intro before 3-10, closer after 3-10, six main scenes), war words still only in `g*`, Hikari in every
main episode, a "loss by absence" lint for g3 (no body / wound / blood words); `tests/data/storySceneIndex.test.js`;
`tests/story/system.test.js` (the three `ifOwned` sides wait, then play once).

**Done when.** Story suites green, `node e2e/story.mjs` passes, independent story-safety pass OK at xhigh effort (no
gore, loss by absence only, Ms. Hazuki's fate by absence only, Sensei never gendered or romantic, students never
sexualised, no other games' names).

---

## 7. Step 3 verify and owner board

- Gates: full `npm test`; `node e2e/smoke.mjs`; `node e2e/engines.mjs`; `node e2e/story.mjs`; `e2e/gate-arc.mjs`
  extended: chapter 3's Act II waits for 3-5 and 2-10 ("Clear 2-10 first" on a save with 3-5 only), then NEW; 3-6 plays
  `g3.pro` under "Chapter 3 · The Bell Festival"; the 3-8 battle's rift lane spawns mid-board (first enemy of that lane
  starts inside the board); the 3-9 battle is burning (`renderer.info` reports `ruined: 'burning'`) and fields Gnats on
  wave 6; the 3-10 tear pulses with the rule; `nice npx vite build`, `rm -rf dist`.
- Greyscale contact sheet (§19 gate): 3-9 and 3-10 at 844×390 in greyscale, road and every enemy visible.
- Shots (844×390 and 1280×720): each map mid-battle, a girl on an Old Town roof, the 3-8 rift lane, 3-9 with Gnats and a
  bark, 3-10 with the tear pulsing, the Ashen Warden in battle (wave 26) and its bestiary card, the Gnat's bestiary card,
  one frame from each scene, chapter 3's campaign row (locked and NEW, plus 390×844).
- Boards: `docs/review/gate-arc/step3/*.jpg` (labelled, ≤ 400 KB). Hashes in `STEP3_HASHES.md` and the last commit
  message. Draft PR #28 description updated (milestones, verdicts, hashes, tests, boards, owner questions, left for
  Step 4). Send the coordinator the head commit, gate results and the `STAGE_PLACE` rows (decision 14).

**Commits.** (1) Old Town + burning + rift render + tear + Brigade FX/barks + previews; (2) maps; (3) stages, rules,
skins, the Warden, the brigade family and the Gnat; (4) story; (5) tests, balance rows, docs (`CONTRACTS.md`:
`district`, `inside`, `scenery.ruined`, `model.base` families, barks; `docs/CAMPAIGN.md` Bell Festival table; HANDOFF §3
row). Push after each.

---

## 8. Risks

1. **A third meander.** The spec's 3-6 "three hooked keys in a row" is a meander if the keys hang the same way. Keys
   alternate north/south (decision in §4); the harness checks `isMeander` before the test run; never relax the cap.
2. **3-9 vs 3-6 IoU** (same ground): the S must use different rows from the keys; check the top-3 IoU list.
3. **3-6 vs 1-7** (both comb-like with roofs): alternating keys and the roof blocks inside them must keep IoU < 0.65.
4. **Burning readability:** fire, smoke and the dark sky must never hide the road or enemies; amber, never oni red; the
   greyscale sheet is a gate.
5. **Lantern strings and glow sprites** on 3-6/3-7 (≤ 250): glow geometry, every fourth lantern a sprite.
6. **The mid-board rift** touches `trackMesh` run-outs and the edge-spawn test: keep the exemption to flagged paths.
7. **A 13th family** touches bestiary tabs, family achievements, `FAMILY_IDS` and the model manifest test; the Gnat on
   the construct GLB must not make the bestiary claim the construct family is "found".
8. **Rules from later chapters** (forge vents, mist, mirage) arrive before Act I teaches them (decision 4).
9. **The story's turn** (HAMMER, Ms. Hazuki): the hardest safety pass of the arc so far; told by absence only.
10. **Pinned counters** move again (stages, achievements, missions, events, profile); the ledger stays append-only.
11. **The Warden's hp cap** (≤ 4,000 miniboss anchor) may make the finale soft; tune with phases and escorts, not hp.

## 9. Owner questions (defaults taken)

- **The Brigade's look (no new model now):** the Gnat ships on the construct GLB's `cogling`, navy and amber, as a
  13th family `brigade` in the bestiary; the real Brigade kit (§18.9: trooper, Gnat with rotors and a LINK LOST screen,
  Tortoise, Badger, Strider, HAMMER) waits for the enemy rebuild. OK, or hold the Gnat back until then (3-9 would field
  only ghosts and goblins)?
- **Deferred 3D/art items:** the Brigade GLB family (`tools/blender/enemies/families/brigade.py`), its face atlas and
  clips, the halo construct variant (Step 5). Painted story places "old-town-night" and "old-town-burning" (tools/story-bg)
  instead of reusing `festival-street`.
- 3-7, 3-8 and 3-9 use rules Act I first teaches at 6-3, 5-1 and 6-2.
- `g3.after` is titled "Names Read Aloud" (the spec's "Roll Call" is a reserved name in a test).
- No second content note before Act 3 (the arc's note is on `g1.pro`).
- The three `ifOwned` side scenes count in chapter 3's Act II scene list (as `g2.class` does).
- 3-6's keys alternate north and south instead of three identical keys in a row (the test allows no third meander).
