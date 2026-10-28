# Gate Arc · Step 4 build plan

Written Oct 28, 2026 against `feature/gate-arc` at the end of Step 3 (head ad0e43a; `main` v0.1.55 merged in: Acts 1-2
live at COOP 9; sim id `dd3e7ae71fb7` held by `PENDING_BUMP` on protocol 9; data hash `63d2b906`). The approved spec is
`docs/specs/GATE_ARC.md` (§7.3 the Brigade, §17 rows 4-6…4-10, §18 highway district, §19 Step 4) with
`docs/specs/gate-arc/MAPS.md` §1.5 and `STORY.md` §11 Act 4 and §7.3. This plan covers Step 4 only: the highway
district, the Brigade's dressing (Noon side and far north), the far-north dressing, the Brigade's first four
infantry/vehicle defs, Azami's join moving to 4-7, and Act 4 "The Checkpoint" (4-6…4-10). Nothing here ships; the
coordinator folds finished steps into a release (the release that carries Step 3/4 takes the next free COOP number at
ship time; the ultimates take 10).

Rules for every builder session are Steps 1-3's unchanged: push only `feature/gate-arc`, no force pushes or history
rewrites, no bare `git stash`, temp files in the session scratchpad, `rm -rf dist` after a build, ≥ 1.5 GB free, no
other games' or anime names, Sensei never gendered and never romantic, students never sexualised, no gore (loss is
shown by absence: a trooper "falls and fades out", "Trooper down!", a white visor helmet in the snow, a silence on
Kuroe's roll; never a wound, a body or blood), **no new or edited 3D models** (owner: "enemy rebuild sure but after";
"content before anything"), **no COOP bump** (`PENDING_BUMP` in `tests/art/itemArtRuntime.test.js` follows the sim id
on protocol 9). Every milestone: independent reviewer OK (≤ 3 fix rounds), hash log
`docs/specs/gate-arc/STEP4_HASHES.md`, owner boards `docs/review/gate-arc/step4/` (labelled JPEGs ≤ 400 KB).

### Expected hash moves

| Milestone | Sim id | Data hash | Why |
|---|---|---|---|
| S4a | **unchanged** | **unchanged** | render, previews, UI text and tests only (highway district, Brigade + far-north dressing, the barrier arm on a lane schedule, the snow-bridge deck look, backdrop variants). A done-when check |
| S4b | changes | changes | 5 maps in `maps.js` |
| S4c | changes | changes | 5 stages, 5 rule placements, the Frost Vanguard, four Brigade defs (+ the Gnat moves family), Azami's join stage (`stages.js` `unlocks`), the `brigade` family in `enemies.js` |
| S4d | unchanged vs S4c | unchanged vs S4c | story data, `catchUpJoins.js` legacy list and UI sit outside the sim graph (verify with `tools/simId.mjs`; if `unitsNewGirls.js` text changes for Azami's join line, the sim id moves: units are hashed) |

---

## 1. What Steps 1-3 already give us (reuse, do not rebuild)

| Need | Where it is |
|---|---|
| City kit, districts | `src/render/city/{cityKit,cityProps,buildings,oldTownProps,ruinProps}.js`; `themes.DISTRICTS` (`oldtown`) and `resolveLook(theme, scenery, stageLook, map)`; `MapDef.district` passthrough in `defineMap` |
| Lane schedule + barrier arms | `waveGen.laneCycle` (1-9) and the city kit's level-crossing arms (`scheduled` lanes dip on closed waves). 4-7's checkpoint barrier is the same mechanism with a barrier-arm prop instead of a railway |
| Rooftops `U` | 1-7 / 2-6 / 3-6; 4-6's booth islands |
| Inside-spawn lanes | path spec `{ inside: true, … }` (3-8). Not needed in Step 4 (4-9 spawns at the south edge, the Petal Gate's north mouth) |
| Brigade FX and barks | `src/render/fallStyles.js` (`BRIGADE_FALL`: troopers `fade`, vans/tanks `breakdown`, already listed), `src/ui/text/barks.js` (`BARKS` keyed by id; add the four units' lines), `src/ui/battle/barks.js` (no per-frame allocation; keep it so) |
| Act II stages | `ACT2_PLAN` rows 4-6…4-10 (below), `act2Stage`, `CHAPTERS[3].act2*` |
| Story | `g1`…`g3` as patterns; `ifOwned`; `ACT_SCENE_IDS`; the g3 loss-by-absence lint (extend to g4); backdrops: painted `STAGE_PLACE` first, then the act's skyline variant (`src/ui/story/backdrop.js` `PLACE_VARIANT`), then the academy tint |
| Veteran family achievements | `familiesFound`'s Act II rule (`src/systems/achievementMetrics.js` `familyNeeds`) |
| Join moves | Step 1's Yuzuha move: `LEGACY_JOIN_STAGES`, `rewards.js` legacy grant, `catchUpJoins.js` letters, `tests/sim/modesBot.js` free-unit ancestry |
| Budget measurement | `tests/render/terrainHash.js` recording canvas, as S1d/S2/S3 |

`ACT2_PLAN` for chapter 4 (computed, not typed): `hpPass` 2.15 on every row.

| Stage | Waves | hpScale | cashScale | startCash | Tier | requires |
|---|---|---|---|---|---|---|
| 4-6 | 25 | 5.61 | 1.78 | 800 | intermediate | `['4-5', '3-10']` (two-key) |
| 4-7 | 26 | 5.89 | 1.83 | 810 | advanced | 4-6 |
| 4-8 | 26 | 6.17 | 1.88 | 810 | advanced | 4-7 |
| 4-9 | 27 | 6.49 | 1.94 | 820 | advanced | 4-8 |
| 4-10 | 28 | 6.79 | 1.99 | 820 | expert | 4-9 (finale) |

---

## 2. Decisions this plan makes where the spec is silent (or where the owner overrides it)

1. **The Brigade without a Brigade model (owner override).** The four new units are **data on shipped GLBs**, through
   `def.model = { base, variant, props }` (as the Gnat): Response Trooper on the construct `sentry` (helmeted, upright),
   Shieldline Trooper on the construct `warden` with its `shield` prop, Tortoise on the construct `beetle` (`shell`),
   Badger on the construct `warden` without shield at a heavier size; all in Brigade navy `#2b3a5c` with amber `#f4a62a`
   and a white visor accent `#eef3f8`. No orc model for people: the troopers must never read as monsters. The real
   Brigade kit (white visors, carbines of our own design, rotors, the van's searchlight) waits for the enemy rebuild.
   *Owner question.*
2. **A `brigade` bestiary family, now that it has five members.** Step 3 kept the Gnat on `construct` because a
   one-member family would break two rules. With the Gnat + four units the family passes the ≥ 4 rule, so Step 4 adds
   `FAMILIES.brigade` (name "Gate Response Brigade", navy/amber, lore "Our own city. Signed up for floods and fires.")
   last in `FAMILY_ORDER`, and **moves the Gnat into it** (its `model.base` stays `construct`). Two guards come first:
   - **Non-vacuous families.** `familiesFound` counts a family only when at least one member is needed *and* every
     needed member is discovered (`needed.length > 0 && needed.every(found)`). Every Brigade member is introduced in an
     Act II stage, so without this a save that cannot open 3-9 would see the Brigade "complete" and gain a family
     achievement for nothing. Test both directions (a veteran's count never rises from the new family; once 3-9 is
     open the Brigade needs the Gnat, once 4-8 is open it needs the troopers, …).
   - **Manifest.** `tests/models/enemies.test.js` accepts a family whose defs all name a `model.base` with a shipped
     GLB (no `brigade.glb`); `FAMILY_IDS` 12 → 13; the bestiary tab, colour and blurb.
   *Owner question* (the alternative: keep everything on `construct` until the Brigade model exists).
3. **Brigade numbers** (STORY §7.3 sketch, before `hpScale`): Response Trooper hp 40 · speed 0.85 · light · armour 1 ·
   threat 3.5 · no other rule; Shieldline Trooper 60 · 0.75 · light · 0 · threat 6 · `guardian { radius 1.6,
   reduction 0.3 }` (blast ignores the guard, as the shipped guardian); Tortoise elite 240 · 0.6 · heavy · 3 · threat
   16 · `splitter { spawn: 'brigade_trooper', count: 3 }`; Badger elite 400 · 0.5 · heavy · 6 · threat 22, armour its
   only rule. Ids `brigade_trooper`, `brigade_shieldline`, `brigade_tortoise`, `brigade_badger` (the fall styles and
   bark tables already key on these). `introducedIn`: troopers 4-8, Tortoise 4-8 (wave 14), Badger 4-9.
4. **Fall and barks.** Troopers `fade` (no homeward sparkle, nothing left on the road), vans/tanks `breakdown`
   (`fallStyles.js` already maps them). Barks: Trooper spawn "Contact front!", beaten "Trooper down!"; Shieldline spawn
   "Shields! Form a line!", beaten "Close up! Close up!"; Tortoise spawn "Tortoise rolling!", beaten "Crew out! Crew
   out!"; Badger beaten "Fall back! Fall back!"; the last trooper of a group on 4-9: "Sorry! Sorry!". No wound words
   (the barks test's word list grows with them).
5. **Even waves on 4-8 are the Brigade.** The sim has no per-parity pool, so 4-8's pool is the orc/beast column and the
   Brigade comes as **fixed groups on every even wave** (`F(2k, 'brigade_trooper', n)`, `F(2k, 'brigade_shieldline',
   m)`, Gnats every 4th, a Tortoise from wave 14). `rear_ambush` (Wrong way) already sends even waves in from the goal
   end, so the Brigade's strike column comes up from the city behind the girls, as the spec says.
6. **Azami's barrier (4-7)** is `waveGen.laneCycle: [[1], [0, 1]]`: on odd waves the checkpoint gate (lane 0, the
   straight) is shut and the wave walks the long chicane (lane 1); even waves use both. The barrier arm is the
   level-crossing arm on a lane schedule (render prop `barrierArm`, S4a), at the fork, never across the chicane.
7. **Azami joins after 4-7** (GATE_ARC §17, Q-list "free-girl join slots move to 1-7, 4-7, 7-7"). Today 2-2 grants
   her (`stages.js` 2-2 `unlocks: ['azami']`, catch-up list `CATCH_UP_UNITS`). As Step 1 did for Yuzuha: 4-7 `unlocks:
   ['azami']`; 2-2 loses it; `LEGACY_JOIN_STAGES.azami = ['2-2']` and `PRE_UPDATE_JOIN_STAGES` (built): 2-2 counts
   **only for clears made before this build**. A save that cleared 2-2 before the update gets her once via the lobby
   catch-up letter naming 2-2 (the `joinWindow:azami` counter closes the window on the first catch-up run); a 2-2 win
   after the update no longer grants her. Her acquisition text reads "Joins after 4-7". `ch2.azami` still plays after
   2-2 (kind `join`) but she stays at her post ("When you need a gate held, come and find me."). The balance bot
   counts legacy stages as ancestors (`tests/sim/modesBot.js`); without Azami, 2-3 and 4-5 Hard flip in the balance
   rows (Easy and Normal hold). Gameplay change: a brand-new player meets Azami after 4-7, not 2-2.
   *Owner question with this default.*
8. **Highway is a district** (`MapDef.district: 'highway'` on `city` maps, as `oldtown`): concrete road style
   (`concrete`), gravel verges, sound walls, sign gantries, toll booths, jersey barriers; dusk on 4-7 (`scenery.dusk`
   or the stage `look`), frost on 4-6/4-8 (`scenery.props: ['frost']`), `snowCover` only on 4-8's north portals (a
   render keyword on the map's top rows, not the 8-6 table).
9. **The far north is the shipped `snow` theme** with Brigade and village dressing keywords (`sandbagPit`,
   `searchlightTower`, `tortoiseVan` parked, `frozenHut`, `dyingFire`, `villageHearth`, `sled`, `hotSpring`,
   `warBanner`, `stoneBridgePier`, `bridgeDeck`), so 4-9/4-10 stay Morning maps (`ERA_BY_THEME`), and Act II's
   Noon-only assumptions (city kit) must not be applied to them (check `cityKit` is skipped on `snow`).
10. **The Frost Vanguard** (`orc_frost_vanguard`): orc family, tier `miniboss`, the Orc Warlord GLB (`variant:
    'warlord'`, props `helmet`, `towerShield`, `cape`) in frost iron (`#9fb8cc`, accent `#e8f4ff`), size 2.3,
    `guardian { radius 1.8, reduction 0.3 }`, armour 6; phase 0.66 "The Vanguard plants its banner. Alpha Wolves answer
    the horn!" (`summoner: beast_alpha ×1 every 9`), phase 0.33 "NO. MORE. GUNS." (armour 8, slower). hp **≤ 4,000**
    (the miniboss anchor; start 3,950), threat ≈ 200, `introducedIn: '4-10'`, lore by absence ("The rearguard of a
    people running from the cold. It stood on the bridge until the children were across."). Joins `ENEMY_SPEAKERS`.
    No crown (orc's `crown_iron` belongs to the General at 4-5; keep the crown for Act I).
11. **Story places.** 4-6…4-8: a highway skyline variant of the city backdrop (`PLACE_VARIANT`: `noon_toll_plaza`,
    `noon_checkpoint` → `'highway'`, `noon_tunnel_mouth` → `'highwaySnow'`) drawn in S4a; 4-9/4-10: painted
    `STAGE_PLACE` entries from the shipped set (`'4-9': 'base-camp'`, `'4-10': 'mountain-pass'`), the far north being
    Morning ground. The story test covers all five.
12. **Six cutscenes, joins included** (GATE_ARC §17 / Q17): `g4.pro`, `g4.azami` (join), `g4.cross`, `g4.boss`,
    `g4.after`, `g4.epi`, plus the side `g4.logs`. Hana's line in `g4.cross` is an `ifUnit` line (everyone has the unit
    defined); if the owner wants it gated on ownership, a per-line `ifOwned` is a later feature.
13. **The Orc General's bridge** (`g4.after`) happens off-board in the story; 4-10's boss is the Frost Vanguard. The
    General does not appear in battle and is never shown falling: "The bridge goes. The General doesn't come back."
    (loss by absence, as written).
14. **Out of Step 4:** the Foam Trooper, Strider and HAMMER Carriage (Step 7); Kagari as a unit; new portraits for
    Kagari, Kuroe, Kohaku; in-battle radio lines beyond the barks; the x-10 cosmetics.

---

## 3. S4a · Highway district, Brigade and far-north dressing, the barrier arm (render only)

| File | Change |
|---|---|
| `src/render/themes.js` | `DISTRICTS.highway`: `concrete` road (≥ the setts' lightness), gravel verge ground, cool grey kerbs; frost tint keyword; dusk light preset reuse (`look.dusk`) |
| `src/render/textures.js` | `pathTexture('concrete')`: pale slabs with expansion joints and a faded lane line |
| `src/render/city/highwayProps.js` (new) | `tollBooth` (roof carries `U`; lit price board), `signGantry`, `soundWall`, `jerseyBarrier`, `barrierArm` (lane-schedule arm), `tunnelPortal` (jet fans, lamps), `stoppedLorry`, `restStop`; near + far LOD; ≤ 6 variants; caps |
| `src/render/city/brigadeProps.js` (new) | `sandbagPit`, `searchlightTower`, `tortoiseVan` (parked, a ticket under the wiper), `brigadeTent`, `droneDock` |
| `src/render/northProps.js` (new; Morning side) | `frozenHut`, `dyingFire`, `villageHearth` (a glow ring under the relay pad), `sled`, `hotSpring` (steam), `warBanner`, `stoneBridgePier`, `bridgeDeck` (the folding military deck look for the 4-10 bridge) |
| `src/render/terrain.js` | SCENERY keywords: `tollPlaza`, `checkpoint`, `tunnelPortals`, `snowCover` (top rows only), `brigadeCamp`, `frozenVillage`, `villageHearths`, `snowBridge`; the `barrierArm` follows `laneCycle` like the crossing arms |
| `src/art/backdrops.js`, `src/art/stageThumb.js` | city backdrop variants `highway` and `highwaySnow`; `highway` thumbnail palette |
| `previews/highway.html` + `previews/highwayMaps.js` | three fixtures (toll lens, checkpoint chicane with the arm on a schedule, frozen village on `snow`) outside `MAPS` |
| Tests | `tests/render/highway.test.js` (builders near/far, caps, deterministic, 0 transparent; concrete road lightest band), `tests/render/north.test.js`, a barrier-arm-on-schedule test (as the crossing's), `tests/render/terrainGolden.test.js` skips the new maps |

**Budget** as before (≤ 10 calls + ≤ 3 movers, < 90k / < 65k tris, ≤ 250 glows, ≤ 40 emitters, 0 sorted transparent).
**Done when** sim id and data hash equal Step 3's, budget rows in `STEP4_HASHES.md`, greyscale check at 844×390 (road,
gates, enemies), build OK, independent visual OK.

---

## 4. S4b · The five maps

Authoring tests as before: radius ≥ 1.4 (use r ≥ 1.5, every run between two corners ≥ 2r), bend < 14° per sample, flat
junctions ≥ 2 apart, tunnels ≥ 1 tile under `H`, edge spawns and exits, IoU < 0.65 and a different turning signature
against **all 64 maps**, **no new meander** (the two allowed are taken), every chapter-2+ map ≥ 8 water tiles within 3
of the road. Check every sketch with the scratch harness (`mapcheck.mjs`: overlay, IoU top 3, signature, meander) before
the test run. Coordinates: x east, y south.

| Stage | Map id · name | Path sketch (starting point, to be nudged) | Water | Watch |
|---|---|---|---|---|
| 4-6 | `noon_toll_plaza` · Toll Plaza · 22×12 · `district: 'highway'` | **Three-booth lens.** Main lane from the north-east `[23, 1.5]` curving down to the toll band at y 5.5, straight west along y 5.5 to x ≈ 6, then the off-ramp curving south-west to `[-1, 10.5]`. Two lanes fork off and rejoin it: north lane `{ fork: [17.5, 5.5] … y ≈ 2.8 between x 14 and 9 … join: [6.5, 5.5] }`, south lane `{ fork: [15.0, 5.5] … y ≈ 8.2 … join: [4.0, 5.5] }` (forks and joins ≥ 2 apart). Booth islands as `U` (2×1) on rows 4 and 6-7 between the lanes at x 10-13 | a concrete-channel stream along the north edge and a drainage pond south-east: ≥ 12 | Matriarch's Nest (three lanes converge), 2-7 (twin lanes merge): the lens re-merges into one |
| 4-7 | `noon_checkpoint` · Azami's Checkpoint · 20×12 · dusk · `district: 'highway'` | **Barrier chicane, mirrored from 1-9.** Spawn north `[13.5, -1]`; lane 0 straight down x 13.5 through the checkpoint gate to the join at `[13.5, 10.0]`, exit south `[13.5, 13]`. Lane 1 forks at `[13.5, 2.0]`, swings **west** round two barricade blocks in two S-bends (e.g. nodes `[11.5, 2.6]`, `[8.0, 3.2]`, `[6.0, 4.6]`, `[7.4, 6.2]`, `[10.4, 6.8]`, `[11.0, 8.2]`, `[8.6, 9.4]`, …) and joins at `[13.5, 10.0]`. Two S-bends give alternating lobes of ≈ 90-120°, never three ≥ 140° in a row (no meander) | a culvert stream (cols 16-19) and a fire-water pond by the tents: ≥ 10 | **1-9 Canal Crossing** (straight + D on the east): the straight is on the east here and the long lane is a snake on the west; Witchroot Tangle (braid) |
| 4-8 | `noon_tunnel_mouth` · Tunnel Mouth · 20×12 · `district: 'highway'`, snow on the north rows | **Dual carriageway.** Two independent lanes from two bores on the north edge: `[6.5, -1] → IN [6.5, 0.4] … OUT [6.5, 4.6] →` south, and `[12.5, -1] → IN … OUT [12.5, 4.6]`, each a 5-tile tunnel under `H` rows 0-4; then both swing east together in one gentle parallel S (≈ 2 tiles) so the pair is not two straight lines, and leave by two south exits (`[8.5, 13]`, `[14.5, 13]`). The central reservation (x 8-11) is buildable | a reservoir below the portals (cols 0-3, rows 6-11) and a drain on the east: ≥ 10 | straight-ish pairs on the raster: check IoU vs Twin Gorge / mountain maps; the S keeps signatures apart |
| 4-9 | `north_frozen_villages` · The Frozen Villages · 20×12 · `snow` | **Climb and horseshoe.** Spawn south at the Petal Gate's north mouth `[4.5, 13]` (the sandbag beachhead); the sled run straight north to y ≈ 6.5; a wide clockwise horseshoe over the village square (centre ≈ (10.5, 5.5), half-width ≈ 6, built with `curve()` or nodes); down the east side to y ≈ 9.0; a left turn east and a left turn north past the cairn to the exit `[18.5, -1]` (the road to Kagari's camp). Lobes ≈ +180, −180: two, so no meander. Three `villageHearth` relay pads inside the horseshoe, ≥ 5 apart (prism_conduits) | a hot spring in the square and an icy stream on the west: ≥ 10 | **1-6 / 2-6** (up, round, out): the horseshoe is a true half-ellipse over the board's middle and the exit is east-north, not west-north; Frozen Falls (omega) |
| 4-10 | `north_snow_bridge` · The Snow Bridge · 22×12 · `snow` | **Two columns, one bridge.** West lane: the gorge-rim road from `[-1, 1.5]` east and down to the bridgehead; north-east lane: the frozen riverbed from `[23, 2.0]` west and down; they join at `[11.0, 3.5]`; then one lane south over the ravine on the **8-tile bridge deck** (x 11, y 4 → 12, all `B` tiles over the river) and out at `[11.0, 13]`. Corners r ≥ 1.8 | the ravine river (rows 4-11, cols 5-17 minus the deck): ≥ 30 (MAPS asks ≥ 30) | Y shapes (Inner Sanctum, arena_library, 3-10's echo): the join sits high and the stem is a long straight deck; Sky Bridge (ravine dip) |

Dressing (map `decor` / `city` hints / stage `scenery.props`): 4-6 toll booths with lit price boards, a sign gantry,
sound walls, frost on the guard rails, a rest-stop vending row; 4-7 jersey barriers, Azami's citation stand, the
barrier arm, Brigade tents, searchlights, vans in the skirt with a ticket under each wiper; 4-8 tunnel portals with jet
fans and lamps, snow blowing out of the bores, a stopped lorry, frost creeping south; 4-9 the sandbagged beachhead at the
spawn, frozen huts with horned-family charms, a fire going out, sleds, a searchlight and a parked van, the three
hearths; 4-10 the old stone bridge piers beside the military deck, war banners, frozen pines, Brigade tents on the far
bank, the squad regrouping by the goal (dressing only, never units). A vast shadow crossing 4-9's board is a cloud-shadow
pass (render only, never named).

**Tests.** `tests/data/world.test.js`: map count 64 → 69; `district` 'highway'; every authoring test; water.
`tests/render/cityKit.test.js` / `highway.test.js`: caps for the new props. **Done when** authoring tests green and the
harness shows no meander, budget within limits on the five real maps (rows in `STEP4_HASHES.md`), hashes recorded,
`PENDING_BUMP` updated.

---

## 5. S4c · Stages, rules, skins, the Frost Vanguard, the Brigade family, Azami's join

### Stages (`src/data/stages.js`, `act2Stage`; `CHAPTERS[3].act2Name 'The Checkpoint'`, `act2Theme 'city'`, `act2Desc`)

| Stage | Rule (`STAGE_RULES`) | Skin | Pool (lead first) | Notes |
|---|---|---|---|---|
| 4-6 | `supply_ship` | Brigade Convoy ("A Brigade convoy drops 150 battle coins after every 4th wave…") | orc_grunt, orc_ironhide, orc_berserker, beast_wolf, slime_iron | booth roofs; frost |
| 4-7 | `heat_mirage` | Flare Smoke | orc_shieldbearer, orc_ironhide, orc_berserker, beast_wolf, beast_bear | `laneCycle: [[1], [0, 1]]`; `unlocks: ['azami']`; dusk |
| 4-8 | `rear_ambush` | Wrong Way | pool orc_ironhide, orc_berserker, beast_wolf; fixed even-wave Brigade groups (decision 5) | `introduces: ['brigade_trooper', 'brigade_shieldline', 'brigade_tortoise']` |
| 4-9 | `prism_conduits` (3 hearth pads) | Village Hearths | brigade_trooper, brigade_shieldline, brigade_gnat, brigade_tortoise (elite, from wave 8), beast_wolf, beast_bear | Badger fixed on each of the last three waves; `introduces: ['brigade_badger']` |
| 4-10 | `snowbell_blizzard` | Blizzard | orc_shieldbearer, orc_ironhide, beast_alpha (elite), beast_wolf, beast_bear, orc_warlord (elite, late) | boss `F(28, 'orc_frost_vanguard', 1, 2, 6)`, `introduces: ['orc_frost_vanguard']` |

Budgets start from the same-slot chapter-5 Act I budgets (Steps 2-3 used chapters 3 and 4) and are tuned only by the
Easy gate; run the per-stage Easy/Normal/Hard table early (the scratch `zz_bal` pattern) — Step 3's 3-6 shipped as the
campaign's hardest stage until the review caught it, so compare every new stage with its neighbours, not only the
Easy pass. The 4-8 even-wave Brigade groups and the 4-9 Brigade pool must not push either stage above 4-10. Skins keep
every number of the base description (`ruleSkins.test.js`; mind the reserved-name test: no skin word may equal a
Potential step name — Step 3 hit "Festival Bells").

### Enemies (`src/data/enemies.js`)
- `FAMILIES.brigade` + `FAMILY_ORDER` (last); `brigade_gnat` moves from `construct` to `brigade` (decision 2);
  `brigade_trooper`, `brigade_shieldline`, `brigade_tortoise`, `brigade_badger` (decisions 1, 3) with bestiary lore
  ("Signed up for floods and fires. Got a gate instead. Still says sorry." for the Trooper; the others in the same
  voice; no wound words).
- `orc_frost_vanguard` (decision 10).

### Systems
- `src/systems/achievementMetrics.js`: non-vacuous `familiesFound` (decision 2) + tests.
- `src/systems/catchUpJoins.js`: `LEGACY_JOIN_STAGES.azami = ['2-2']`; letters; `src/data/unitsNewGirls.js` Azami's
  `free(...)` text (decision 7).

### Tests that move (the Step 1-3 list, one more act)
- `tests/data/world.test.js`: STAGES 74 → 79, campaign 55 → 60, minibosses 7 → 8, `FAMILY_IDS` 12 → 13 (and every place
  that pins 12 families: bestiary tabs, `familyFound` metrics, achievement texts if any), campaign-enemy cap ≤ 110, the
  ≥ 4-per-family rule (brigade has 5), free recruits (Azami at 4-7), water.
- `tests/models/enemies.test.js`: the manifest accepts `model.base` families; each Brigade def resolves to its construct
  variant and props.
- `tests/data/act2Plan.test.js`: chapters 1-4 registered, `CAMPAIGN_IDS` 60.
- `tests/systems/act2Unlocks.test.js`, `tests/ui/campaignActs.test.js`: chapter 4's Act II waits for 4-5 **and** 3-10;
  chapters 5-8 one act.
- `tests/data/achievements.test.js` + ledger: `a_ch4_act2` live (append; never edit), counts 132 → 133, the act2 series
  grows to four steps.
- `tests/systems/catchUpJoins.test.js`: `NEW_JOINS` azami row `['azami', '2-2', '4-7']`, `LEGACY_JOIN_STAGES` equals
  `{ yuzuha: ['4-2'], azami: ['2-2'] }`, a 2-2 win still grants her, the lobby catch-up for a save that cleared 2-2.
- `tests/integration/balance.test.js` / `tests/sim/modesBot.js`: Azami's legacy ancestry; the Easy gate 60/60.
- `tests/systems/achievementMetrics.test.js`: the Brigade family is never counted while its needed set is empty; a
  veteran's count never rises with the new family; Frost Vanguard skip on orc while 4-10 is locked.
- `tests/integration/achievementsRetro.test.js`: update-day numbers unchanged (if they move, the family guard is wrong).
- Counters: events, missions (gems + `a_ch4_act2`), modes (medals 220 → 240, ribbons 1100 → 1200), profile trophies 74 →
  79, profile card, achievements model (series + category totals), engines wave digest (+ 132 waves + 150 endless),
  `consistency.test.js` Act II order through 4-10.
- `tests/render/brigadeFx.test.js`: real defs now include the four units (fade / breakdown by id).
- `tests/ui/barks.test.js`: the new lines (≤ 6 words, no wound words, one chip per side).

**Done when** `npm test` green, Easy gate 60/60 and a per-stage Easy/Normal/Hard table in `STEP4_HASHES.md`, an old
save keeps every unlock and every family achievement (and gains none for the Brigade), hashes recorded, independent
reviewer OK on data and sim.

---

## 6. S4d · Story (`src/data/story/scenes/g4.js`, registered after `ch4`)

| Id | Trigger | Title | Kind | Beats (STORY §11 Act 4) |
|---|---|---|---|---|
| `g4.pro` | before 4-6 | No Running on My Road | main | Azami's whistle stops an orc; "Citation: standing on public infrastructure." / "It's a very good booth."; Kage's SUSPECT BOARD, SEASON TWO |
| `g4.azami` | after 4-7 | Across the Barrier | main (join) | Azami joins ("No running in the halls — or on my road."), the dream of snow and fire ("Probably cheese before bed."); the parley with Kagari: the same words in one breath; the Ember Keeper's bow; "We're not the winter." |
| `g4.cross` | after 4-8 | The Other Side | main | a white visor helmet in the snow where a trooper fell (no body); Kohaku's meter: "His… just stopped."; "He was already home."; Azami: "I wrote his van a ticket on Tuesday."; the far north, children round a fire going out, something vast calling (never named); Hana (`ifUnit`): "Kaze won't fly."; choice: "Hold back wherever you can. Anyone who runs, let them run." / "Then it's mine. Not yours." |
| `g4.logs` | after 4-8 | Night Watch Logs | side | Yuzuha's radio catches the Commander's tired middle logs; "Somebody should tell her to sleep." / Nami: "Somebody should." |
| `g4.boss` | before 4-10 | The Frost Vanguard | main | the blizzard at the bridge; what is left of the squad huddles behind the girls (fewer than came; nobody says what happened); "NO. MORE. GUNS." / "Then let us through, and we'll take them home." |
| `g4.after` | after 4-10 | The Bridge | main | half the squad's channel quiet; HAMMER falls on the gate mouth; the General holds the bridge ("HONOUR!") until both columns are across; Hikari carries the last trooper of a section ("Sorry. …Sorry about the guns." / "I'm sorry about mine."); the bridge goes; the General doesn't come back; Kaede bows to the empty bridge |
| `g4.epi` | after 4-10 | Gates Bloom | main | Kohaku's chart (gates after every barrage, pinholes over the villages); Kage: "HAMMER MAKES GATES??"; Kuroe reads the squad's roll, not every name answers; Kaede carries the General's helmet home; Azami keeps the pages whose crews did not answer, writes "Citation: Commander Kuroe." and pockets it |

Writing rules as g1-g3 (8-18 spoken lines, ≤ 1 choice, ≤ 4 portraits, ≤ 3 on stage, lines ≤ 110 characters, titles ≤ 32,
no reserved names, Hikari in every main episode, shipped faces only, `{name:id}` tokens). **Loss by absence (STRICT):**
the g3 lint extends to g4 (no body, wound, blood, death or kill words; a fallen trooper is "down" or an empty helmet; the
General "doesn't come back"); the trooper who apologises has no name and survives; the vast thing in the sky is never
named. Sensei never gendered or romantic; Kagari speaks without contractions; Kuroe, Kohaku, Kagari speak as `unknown`
with plates. `ACT_SCENE_IDS['4:2']`; scene count 59 → 66.

**Tests.** content (count, archive order, Act II shape for chapter 4, the join scene, Hikari in main episodes, the
loss lint, the mystery lint), `storySceneIndex`, story system (the join plays after 4-7 and grants once; a legacy 2-2
save meets Azami via the catch-up letter and `g4.azami` still plays as a story scene). `node e2e/story.mjs`.

---

## 7. Step 4 verify and owner board

- Gates: full `npm test`; `node e2e/smoke.mjs`; `node e2e/engines.mjs`; `node e2e/story.mjs`; `e2e/gate-arc.mjs` extended:
  chapter 4's Act II waits for 4-5 and 3-10; 4-6 plays `g4.pro`; on 4-7 the barrier is down on wave 1 (lane 1 only) and
  up on wave 2; 4-8's wave 2 enters from the goal end with Brigade units; `nice npx vite build`, `rm -rf dist`. Run e2e
  on a quiet machine (no source edits, no parallel test runs: Step 3 lost a smoke run and two shot batches to that).
- Shots (844×390 and 1280×720): each map mid-battle; 4-7 with the barrier down and up; 4-8 an even wave (the Brigade from
  behind); 4-9 a Tortoise breaking (crew out) and a Badger; 4-10 the Frost Vanguard and the bridge deck; each scene; the
  chapter-4 campaign row (+ 390×844); the Brigade bestiary tab and two cards; a greyscale check of 4-8 and 4-9.
- Boards: `docs/review/gate-arc/step4/*.jpg` (≤ 400 KB each). Hashes in `STEP4_HASHES.md`; draft PR #28 updated;
  the board path sent to the coordinator.

**Commits.** (1) S4a render; (2) maps; (3) family guard + Brigade defs + the Frost Vanguard; (4) stages, rules, skins,
Azami; (5) story; (6) tests, balance rows, docs (`CONTRACTS.md`: `district: 'highway'`, the `brigade` family on shipped
GLBs, the non-vacuous family rule; `docs/CAMPAIGN.md` Checkpoint table; HANDOFF §3 row). Push after each.

---

## 8. Risks

1. **Vacuous family completion** if the guard lands after the family (decision 2): land the guard first, in its own
   commit, with its tests.
2. **Troopers on machine models** may read as robots, not people; the barks and lore carry the "our own people" note.
   Owner question.
3. **4-7 vs 1-9** shape clash (straight + detour): mirror and snake (decision table); check IoU and signature early.
4. **4-8 two near-straight lanes** may clash on the raster with mountain maps; the joint S is the lever.
5. **4-9 vs 1-6 / 2-6** (up, round, out): keep the horseshoe a true curve and the exit north-east.
6. **Balance**: Brigade armour (Badger 6) and guardian lines on 4-8/4-9 against the bot's free roster at chapter-5
   level; compare every stage with its neighbours (Step 3 lesson).
7. **Azami's move** touches catch-up letters, rewards and the balance bot's roster; veterans and new players must both
   keep her (legacy grant + catch-up).
8. **Pinned counters** move again (stages, achievements, missions, events, profile, families); each re-pin must be
   justified by the five stages or the new family, never by a regression.
9. **Grim tone on 4-8/4-9**: the fades, barks and scenes must stay within "loss by absence"; the story-safety review is
   strict here.

## 9. Owner questions (defaults taken)

- **Brigade look without a model:** the Response/Shieldline Troopers, Tortoise and Badger ship on construct models
  (sentry, warden, beetle) in navy/amber/white; the real Brigade kit waits for the enemy rebuild. OK, or hold the Brigade
  back and field only orcs and beasts until then (4-8 and 4-9 would lose their story beat)?
- **A `brigade` bestiary family now** (five members, the Gnat moves out of Constructs), with the non-vacuous family rule.
- **Azami joins after 4-7** (new players meet her there; saves that cleared 2-2 before the update keep her or get her once by letter; a 2-2 win after the update no longer brings her).
- 4-9/4-10 story places reuse the painted `base-camp` / `mountain-pass`; 4-6…4-8 use a drawn highway skyline. Painted
  "toll-plaza", "frozen-village" and "snow-bridge" pictures could replace them.
- Hana's `g4.cross` line plays for everyone (`ifUnit`, she exists); a per-line ownership gate is a later feature.
- Deferred art: the Brigade GLB family (`brigade.glb`, faces, clips), portraits for Kagari, Kuroe and Kohaku.
- Deferred: the 4-9 bark "Sorry! Sorry!" for a group's last trooper (it needs a "last of its group" trigger in the barks queue); the Badger has no spawn bark.
