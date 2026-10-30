# Gate Arc · Step 2 build plan

Written Oct 28, 2026 against `feature/gate-arc` at the end of Step 1 (sim id `9a102fd5d514`, data hash `592fe986`,
COOP 8). The approved spec is `docs/specs/GATE_ARC.md` (§17 rows 2-6…2-10, §18 `campus`, §19 Step 2) with
`docs/specs/gate-arc/MAPS.md` §1.3, `STORY.md` §11 Act 2 and `TECH.md` §3.1, §3.7, §3.10. This plan covers Step 2
only: the `campus` look, its night lighting, the `track` road, blackout dimming, and Act 2 "Hilltop After Dark"
(2-6…2-10). Nothing here ships; the branch merges into a bundled co-op release later.

Rules for every builder session are Step 1's (STEP1_BUILD_PLAN §0) unchanged: push only `feature/gate-arc`, no force
pushes or history rewrites, no bare `git stash`, temp files in the session scratchpad, `rm -rf dist` after a build,
≥ 1.5 GB free, no other games' or anime names, Sensei never gendered and never romantic, students never sexualised, no
gore (loss is shown by absence), **no enemy GLB changes** (new EnemyDefs on shipped GLBs only), **COOP_PROTOCOL stays
8** (`PENDING_BUMP` in `tests/art/itemArtRuntime.test.js` moves to the new sim id). The review gate (independent OK,
≤ 3 fix rounds), the hash log (`docs/specs/gate-arc/STEP2_HASHES.md`) and owner boards
(`docs/review/gate-arc/step2/`, labelled JPEGs ≤ 400 KB) apply to every milestone.

### Expected hash moves

| Milestone | Sim id | Data hash | Why |
|---|---|---|---|
| S2a | **unchanged** | **unchanged** | render, previews and tests only. This is a done-when check |
| S2b | changes | changes | 5 maps in `maps.js` (hashed by both) |
| S2c | changes | changes | 5 stages, 5 rule placements, 1 enemy |
| S2d | unchanged vs S2c | unchanged vs S2c | story data and the story player are outside the sim graph (check with `tools/simId.mjs`) |

GATE_ARC §19 calls Step 2 "render only: data hash": there is no sim **code** change, but `tools/simId.mjs` hashes the
data files `src/sim` imports, so the sim id still moves with MAPS/STAGES/ENEMIES (as in S1d).

---

## 1. What Step 1 already gives us (reuse, do not rebuild)

| Need | Where it is |
|---|---|
| `nightLight` read in `resolveLook` | `src/render/themes.js:410` (`look.light = t.nightLight ? {...} : moonlit preset`); `city` already carries one (`:351`). Step 2 only adds `campus.nightLight` and a test |
| Street props, gates, roofs | `src/render/city/cityProps.js` (`CITY_BUILDERS`, `CITY_VARIANTS`, `SHELTER_KINDS` incl. `schoolMain` / `schoolBack`), `buildings.js` (`cityBlock` variants), `cityKit.js` (`buildCity`, `buildRoofs`, `map.city` hints: `railway`, `waterBus`, `areas`, `goalGate`, `goalVariant`) |
| Roof tiles `U` | sim + render done in S1c; `ROOF_Y` 0.56 |
| Path helpers | `src/data/maps.js`: `street(corners, { r, tunnel })` (rounded corners, one tunnel per run), `curve(fn, t0, t1, n)` (used by shipped maps for ovals and curls), `echoMap` (not needed in Act 2) |
| Act II stages | `ACT2_PLAN` rows 2-6…2-10 (below) and `act2Stage(o)` in `src/data/stages.js`; `CHAPTERS[1].act2*` fields |
| Rule skins | `STAGE_RULE_SKINS` / `ruleTextFor` in `src/ui/text/rules.js` |
| Story | `src/data/story/scenes/g1.js` as the pattern; `format.js` `META_KEYS` (`act`, `note`), `ENEMY_SPEAKERS`; `sceneIndex.js` `ACT_SCENE_IDS`; player kicker for `act: 2`; Act II stage backgrounds fall back to the map theme's skyline SVG (`src/ui/story/backdrop.js`) |
| Story backdrop for campus | `themeBackdropSVG('campus')` needs a `THEME_SKY.campus` + skyline case in `src/art/backdrops.js` (S2a) |
| Budget measurement | the S1d node measurement (`tests/render/terrainHash.js` recording canvas) |

`ACT2_PLAN` for chapter 2 (computed, not typed): every row `hpPass` 1.77, `dropChapter` 3, `modeChapter` 3,
`medalGemMul` 0.5.

| Stage | Waves | hpScale | cashScale | startCash | Tier | requires |
|---|---|---|---|---|---|---|
| 2-6 | 22 | 2.87 | 1.34 | 750 | intermediate | `['2-5', '1-10']` (two-key) |
| 2-7 | 22 | 3.01 | 1.37 | 750 | intermediate | 2-6 |
| 2-8 | 24 | 3.15 | 1.41 | 760 | intermediate | 2-7 |
| 2-9 | 24 | 3.31 | 1.46 | 760 | advanced | 2-8 |
| 2-10 | 25 | 3.47 | 1.50 | 770 | advanced | 2-9 (finale) |

2-6 is the first real two-key stage: the array branch of `stageRequires` / `requirementsMet` / `requirementFor` and the
stage-screen lock text ("Clear 2-5 and 1-10") now run on live data, not only synthetic tests.

---

## 2. Decisions this plan makes where the spec is silent

1. **`track` road** is chosen per map, not per theme: `MapDef.city.road: 'track'` (a render hint like `railway`),
   read by `terrain.js` when it picks `look.path.style`. Only 2-9 uses it. Default campus road is `asphalt`; club-hut
   paths stay `brick` (exists).
2. **Blackout dimming** is opt-in per stage: `StageDef.look.blackout: true` (the render-only `look` field already exists
   for the lantern nights). While a `ruleState` event says the stage's rule is active, `BattleRenderer` eases glow
   geometry, glow sprites and light pools to ≈ 25 % and the hemisphere to ≈ 60 % over 0.4 s, and eases back after.
   It never touches enemy, girl, path or HUD readability (the road stays the lightest band). Act I stages that use
   `lunar_eclipse` (3-3, 3-5, 5-5, 7-4) have no `blackout` flag and look exactly as today. Used by 2-7 now; 3-10, 5-7,
   6-8 later. `look` is part of `STAGES`, so the flag rides the data hash (S2c).
3. **Night everywhere.** All five stages set `scenery.night: true`; `campus.nightLight` gives the lakeside school its own
   cool blue night with warm windows (values tuned on screen, start from the city's).
4. **The old lamp** (2-10) is a decor set piece `oldLamp` (wardstone in an iron lamp post, glow off until the after
   scene) on a blocked tile, placed with the decor `r` cover used by 1-10's `dryFountain`.
5. **Ownership-gated side scene.** `g2.class` waits for Ruri, Iroha, Ena or Fuu (STORY §11). The format's `ifUnit` means
   "the unit exists in code", not "the player owns her", so it cannot express this. Add scene meta `ifOwned: [ids]`
   (any-of), honoured by `storyTriggers.js` when queueing (the scene stays queued, not dropped, until one is owned) and
   by the archive (locked with "Needs Ruri, Iroha, Ena or Fuu"). Test it. *Owner question with this default.*
6. **NPC speakers.** Mahiru, Kohaku, Ms. Hazuki and the radio voice speak as `unknown` with a `name` plate (as Mahiru,
   Kuroe and Mori do in g1); Kinu, Rei, Sango, Hikari and the old class speak as their units. Old Lamp-Hugger joins
   `ENEMY_SPEAKERS` ("Lamp. Mine. Handsome."). The sleeping winged little one in `g2.boiler` never speaks and is never
   named as a species (STORY mystery rule).
7. **Uniform day (g2.pro)** is written as fittings of blazers and ties only: no changing on screen, no body
   description, Kinu counts stitches, Rei's tie joke. No costume art ships in Step 2 (task #173 stays separate).
8. **Ms. Hazuki** is Sensei's old colleague: the lunch-debt banter is colleague banter about receipts, never romantic.
9. **Scene count.** Act 2 has 11 scenes: 6 main (`pro`, `mid`, `boiler`, `boss`, `after`, `epi`) and 5 side
   (`kohaku`, `thirtyone`, `lunch`, `class`, `roof`), all kind `event`, `act: 2`, 0 gems. No content note (the arc's
   one note is on `g1.pro`).
10. **Out of Step 2:** in-battle radio lines, x-10 cosmetics ("Night Watch" title, stage still), portraits for Mahiru,
    Kohaku and Ms. Hazuki, new faces and music cues, uniform costumes, the Brigade kit (Step 3, may start in parallel
    as art + data only).

---

## 3. S2a · The campus look (render only)

**Goal.** A `campus` theme (Itomachi Hilltop High at night, lakeside) drawn within the phone budget, plus the `track`
road and blackout dimming, shown on preview boards. No stage uses them yet.

| File | Change |
|---|---|
| `src/render/themes.js` | `THEMES.campus`: `groundStyle 'grass'` lawns with `paved` path bands, `path.style 'asphalt'`, `building 'schoolBlock'`, `wall 'cityWall'`, frame ring of `planterBox` / `guardRail` / hedges, `trees ['streetTree', 'sakura']`, water `lake` look, `life { fireflies: true, koi: false, birds: false }`, `spawnGate 'petalRift'`, `goalGate 'shelterDoor'` with `goalVariant 'schoolMain'`, `look.city` kit config (campus block set), `nightLight` |
| `src/render/textures.js` | `pathTexture('track')`: red-brown lanes, white lane lines, lane numbers every ~6 tiles (the v-across UV trick of `asphalt`); test list += `track` |
| `src/render/city/cityProps.js` + `buildings.js` | **Campus kit:** `schoolBlock` (classroom wing, gym = Shelter 3 with a banner, clock tower with a lit face, club hut), `flowerBoxes` (roof dressing), `bikeShed`, `flagpole`, `goalPosts`, `scoreboard` (glow), `finishGantry`, `boatRack`, `oldLamp`, `searchlight` (disc on the water, drawn like cloud shadows: 0 calls), `clubHut`, `stands` (reuse). ≤ 6 variants, near + far LOD, per-prop triangle caps (TECH numbers × 1.25) |
| `src/render/city/cityKit.js` | campus block selection; `map.city.road`; `map.city.searchlight` hint (position, sweep arc) |
| `src/render/terrain.js` | `SCENERY` keywords (`schoolGrounds`, `clubHuts`, `rowingClub`, `sportsField`, `lakeLamps`, `fireflies`); `look.path.style` from `map.city.road` |
| `src/render/BattleRenderer.js` + `src/render/ambient.js` | **blackout:** a `dim` value eased toward 0.25 while `look.blackout` and the rule is active (from the `ruleState` events already routed to `ruleDecals`), applied to the glow mesh colour scale, glow-sprite opacity, light-pool alpha and `hemi`. No new draw calls; no per-frame allocation |
| `src/art/stageThumb.js`, `src/art/backdrops.js` | `MAP_THEMES.campus`; `THEME_SKY.campus` + a campus skyline (clock tower, gym roof, lake line) in `themeBackdropSVG` |
| `src/audio/routes.js` | `THEME_FAMILY.campus = 'moonlit'` (the shipped chapter-2 night family; a Hilltop cue is a later item) |
| `previews/campus.html` + `previews/campusMaps.js` | two fixture boards (lakeside court, running track) outside `MAPS` and the bundle, with a toggle that fires `ruleState` to show the blackout |
| Tests | `tests/render/terrain-v2.test.js` (`campus` in the theme loop, `track` style); `tests/render/cityKit.test.js` (campus builders near/far, caps, no transparent materials, deterministic per map id); `tests/render/blackout.test.js` (new: dim reaches the floor while active, returns to 1 after, never changes path or actor materials, a stage without the flag never dims); `tests/audio/routes.test.js`; `tests/ui/ui-v2.test.js` (campus backdrop) |

**Budget** (node measurement as S1d, each preview board at high/medium/low): ≤ 10 terrain draw calls + ≤ 3 instanced
movers, ≤ 90k / 65k triangles, ≤ 250 glow sprites, ≤ 40 emitters, 0 sorted transparent. Spec estimate 70-80k.

**Done when.** `npm test` green; **sim id and data hash equal Step 1's**; budget table in `STEP2_HASHES.md`; greyscale
check at 844×390 (road, gates and enemies visible at night, and during a blackout); build OK, `dist` removed;
independent visual reviewer OK.

**What the owner sees.** The campus preview at night (844×390, 1280×720, 390×844), the track board, a blackout
before/after pair, the shelter door (school variant) close-up.

---

## 4. S2b · The five maps (`src/data/maps.js`, theme `campus`, 20×12)

All five are night maps with **≥ 60 buildable water tiles** (`world.test.js:956-968` already enforces this for every
chapter-2 stage, and ≥ 8 water tiles within 3 tiles of the road). Paths obey the authoring tests: radius ≥ 1.4 (use
r ≥ 1.5 on corners, so every run between two corners is ≥ 2r long), bend < 14° per sample, ≤ 2 meanders, flat
junctions ≥ 2 apart, tunnels ≥ 1 tile under ≥ 2 `H`, edge spawns and exits, IoU < 0.65 and a different turning signature
against **all 54 maps** (including the five Rush Hour maps). Coordinates below are a starting sketch (x east, y south,
the board is x 0…20, y 0…12; points off the board are the edge run-ins), to be nudged by the tests.

| Stage | Map id · name | Path sketch | Water (≥ 60) | Nearest shapes → watch |
|---|---|---|---|---|
| 2-6 | `noon_school_gate` · School Gate | `street([[4.5,13],[4.5,9.5],[11.5,9.5],[11.5,6.0],[6.5,6.0],[6.5,-1]], { r: [1.8,1.8,1.6,1.6], tunnel: [[6.5,4.5],[6.5,0.5]] })`: up the hill road, two S-bends round the front-court flowerbeds, the 4-tile corridor under the main building (`H` over x 5-8, y 0-4), exit north at Shelter 3's door. ≈ 44 tiles. **U** roof tiles on the classroom wing **beside** the corridor (x 8-10, y 1-3), never over the path | the lake fills the east third (x 14-19): ≈ 70 | Thousand Steps (switchbacks + tunnel), 1-6 Station Plaza (also ends in an underpass): the chicane is flat and the tunnel runs north, not west |
| 2-7 | `noon_rowing_jetty` · Rowing Jetty | two paths from the south edge up two jetties 4 apart (`[[5.5,13],[5.5,7.5]…]` and `[[9.5,13],[9.5,7.5]…]`, decks over water), joining at the boat ramp ≈ `[7.5,6.0]` (the 1-9 join pattern), then one stem: east to x 16.5, a hairpin north (r 1.5) back west along y 3.0, a second bend north to exit `[3.5,-1]`. ≈ 26 + 26 + 30 tiles | the lake's south half between and beside the jetties: ≈ 80 | Twin Gorge (trident), 1-9 (fork + join): prongs are parallel decks, the stem is a Z of two hairpins; count meanders (2 max) |
| 2-8 | `noon_footbridges` · Canal Footbridges | `street([[-1,1.5],[3.5,1.5],[3.5,4.5],[7.5,4.5],[7.5,7.5],[11.5,7.5],[11.5,10.5],[15.5,10.5],[15.5,13]], { r: 1.5 })`: a staircase down to the south-east; each drop crosses an east-west mill canal on a short footbridge (canals on rows y 3, 6, 9) and the last run crosses a north-south canal. ≈ 48 tiles, 4 water decks | three canals + the side canal: ≈ 70 | Lantern Isles (long diagonal bridges): short decks on a stepped diagonal; no U-turns so 0 meanders, but check the alternating-turn signature against 1-6 and Thousand Steps |
| 2-9 | `noon_running_track` · The Running Track | spawn west through the marathon gate (`[-1,6.5]` → tunnel under the grandstand, x 0.5-2.5), one full anticlockwise lap of an oval built with `curve()` (centre ≈ (10,6), rx ≈ 6.5, ry ≈ 3.8), passing **over its own entry** on the grandstand footbridge (a crossing with `overpass`), then out north `[…,-1]`. `city.road: 'track'`. ≈ 56 tiles | the lake behind the back straight (north-east strip) + the steeplechase water jump in the infield: ≈ 60-65 (the tightest of the five; widen the lake first) | Blossom Loop, Sakura Colosseum (big ovals): IoU is the risk; offset the oval east and keep the entry tunnel long |
| 2-10 | `noon_boathouse_lamp` · The Boathouse Lamp | spawn east along the shore road (`[21,2.0]` → west to x 13), south out on the stone breakwater (x 13, y 2 → 8, ≈ 6-7 tiles over the lake), a 270° left curl round the old lamp (centre ≈ (14.6,8.0), r 1.6, via `curve()`), back north-west on a diagonal timber pier to the shore and through the boathouse (2-tile tunnel under the boat hall at y ≈ 3, x 4-6), exit west `[-1,3.0]`. ≈ 52 tiles. **The curl's return crosses the breakwater**: one flat crossing on the breakwater head (stone, not a deck) | open lake on both sides of the breakwater: ≈ 90 | Moonlight Pier (slashed O): a straight out, a curl and a diagonal back into a building; the flat crossing must sit ≥ 2 tiles from any other junction |

Dressing (map `decor` / `city` hints / stage `scenery.props`): 2-6 clock tower, "Shelter 3" banner, gym windows lit,
bike sheds, rooftop flower boxes on the `U` wing; 2-7 boat racks, coach's stand, a searchlight sweeping the water,
fireflies; 2-8 club huts (art, science, handicraft), boiler-house chimney steam, laundry lines, footbridge lanterns,
three sensor masts **on the prism-conduit pad tiles**; 2-9 lane numbers, finish gantry, bleachers, scoreboard glow, a
half-taken-down sports-day banner; 2-10 the old lamp, moored rowing eights, life rings, a searchlight on the breakwater.

**Tests.** `tests/data/world.test.js`: map count 54 → 59; every authoring test passes for the five; `THEMES` += `campus`;
the water test passes (≥ 60, ≥ 8 near the road). `tests/render/cityKit.test.js`: caps for `oldLamp`, `schoolBlock`.

**Budget.** Re-run the S1d node measurement on the five real maps at all three qualities; record in
`STEP2_HASHES.md`.

**Done when.** Authoring tests green, budget within limits, data hash and sim id recorded (both move).

---

## 5. S2c · Stages, rules, skins and the boss

### Stages (`src/data/stages.js`, via `act2Stage`, `CHAPTERS[1].act2 = ['2-6'…'2-10']`, `act2Name 'Hilltop After Dark'`, `act2Theme 'campus'`, `act2Desc`)

| Stage | Rule (`STAGE_RULES`) | Skin (`STAGE_RULE_SKINS`) | Pool (lead first) | Notes |
|---|---|---|---|---|
| 2-6 | `petal_sanctuary` | Shelter Intake | lizard_skink, slime_green, slime_pearl, goblin_runner | `scenery.props` school keywords |
| 2-7 | `lunar_eclipse` | Lights Out | lizard_skink, lizard_hunter, slime_pearl, slime_droplet | `look: { blackout: true }` |
| 2-8 | `prism_conduits` | Sensor Masts | lizard_hunter, lizard_sunscale, slime_prism, slime_pearl, goblin_dasher | pads where the masts stand |
| 2-9 | `firefly_chorus` | Starting Pistol | lizard_sunscale, lizard_hunter, slime_prism, slime_pearl, goblin_dasher, beast_boar | |
| 2-10 | `changing_tides` | Lake Swell | lizard_basilisk (elite), lizard_hunter, lizard_sunscale, slime_pearl, slime_prism, goblin | boss wave `F(25, 'lizard_lamp_hugger', 1, …)`, `introduces: ['lizard_lamp_hugger']` |

Budgets start from the same-slot chapter-3 Act I budgets (as S1d used chapter 2's) and are tuned only by the Easy
gate. All stages `scenery.night: true`. Families and rules are only ones seen by chapter 2 (MAPS §1.0); `lunar_eclipse`
first appears in Act I at 3-3, so its **rule** arrives earlier for Act II players: the rule is taught on its own card,
like every Act II rule, and the family rule (not the rule rule) is what the tests pin. *Owner question with this default.*
Skins keep every number of the base description (`ruleSkins.test.js`). `rules.test.js` placements = `CAMPAIGN_IDS.length − 3`.

### Boss (`src/data/enemies.js`)

`lizard_lamp_hugger` "Old Lamp-Hugger":
- lizard family, tier `miniboss`, the **Bog Basilisk GLB** (`variant: 'basilisk'`) at miniboss scale, warmer tint,
  a lamp-glass glint prop; **no new model**;
- `regen` (the basilisk's trait, stronger), two announced phases using chapter-2 mechanics (Marsh Hunters wade in;
  it curls tighter: armour up, slower);
- HP and threat above the Heir's and the 2-5 basilisk's, budgeted inside 2-10's last wave; start hp ≈ 4200, threat ≈ 170,
  tuned by the Easy gate;
- lore and counters by absence ("When the lamp lights, it lets go and goes home."), `introducedIn: '2-10'`;
- added to `ENEMY_SPEAKERS`.

Test pins: minibosses 5 → 6; the campaign-enemy cap (≤ 110) holds; `FAMILY_IDS` and the GLB budget unchanged.

### Tests (update)
- `tests/data/world.test.js`: STAGES 64 → 69, campaign 45 → 50, free-recruit and water checks, `laneCycle` none.
- `tests/data/act2Plan.test.js`: unchanged (plan already had the rows); add "registered rows equal the plan".
- `tests/systems/act2Unlocks.test.js`: **live two-key**: 2-6 locked with only 2-5 or only 1-10 cleared, open with
  both; `requirementFor('2-6')` names the missing one; an old save (veteran fixtures) keeps every Act I unlock and
  `nextStage` is unchanged.
- `tests/data/achievements.test.js`: `a_ch2_act2` becomes live (75 gems); counts, caps and the frozen ledger
  (appended, never edited).
- Counters pinned by Step 1 that move with five more stages: events, missions, modes, profile trophies, profile card,
  achievements model/retro, `campaignGolden` / `waves` stay Act I only.
- `tests/integration/balance.test.js`: the Easy gate wins 2-6…2-10 (**50/50**); `BALANCE=full` rows recorded in
  `STEP2_HASHES.md`.
- `tests/render/blackout.test.js`: 2-7's stage look carries the flag; no Act I stage does.

**Done when.** `npm test` green, Easy gate 50/50, an old save keeps every unlock, sim id and data hash recorded
(`PENDING_BUMP` updated), independent reviewer OK on data and sim.

---

## 6. S2d · Story (`src/data/story/scenes/g2.js`, registered after `ch2` in `src/data/story/index.js`)

| Id | Trigger | Title | Kind | Beats (STORY §11 Act 2) |
|---|---|---|---|---|
| `g2.pro` | before 2-6 | Exchange Students | main | Hilltop becomes Shelter 3; uniform fittings (blazers and ties only), Kinu counting stitches, Rei: "The tie is a garden hose. Respectfully."; Kinu returns Sensei's mended umbrella ("Forty-two stitches."); Ms. Hazuki kept Sensei's desk and mug; the lunch-debt argument resumes |
| `g2.kohaku` | after 2-6 | The Most Boring Object in the City | side | Kohaku corrects the whiteboard grammar, brings tea; her seam meter squeals at Hikari, Rei's tea and Wobble, and reads Sensei as zero |
| `g2.thirtyone` | after 2-6 | Thirty-One | side | Mahiru reads the same as the vending machine and offers Sensei her thirty-one |
| `g2.lunch` | after 2-7 | Lunch Debt | side | Sensei and Ms. Hazuki, and the receipts (colleague banter) |
| `g2.mid` | before 2-8 | Static | main | night watch on the jetty; Channel 9 catches "This is Commander Yūhi. Vesperline holds. The dawn is never late."; Hikari goes still; Mahiru: "She sounds like someone who's never scared." |
| `g2.boiler` | after 2-8 | Something Small | main | the boiler room; a small grey winged thing asleep in a knitted scarf ("It follows warm things. Please don't tell."); Hikari on Channel 9; choice "We should tell the Captain." / "Then we keep it warm. For now." → "Just a little longer. Please." |
| `g2.class` | after 2-9 | The Old Class | side, `ifOwned: ['ruri','iroha','ena','fuu']` | furious that Sensei vanished, then not furious at all; each girl's lines carry `ifUnit` |
| `g2.roof` | after 2-9 | Rooftop Flowers | side | Mahiru shows Rei the flower boxes; Rei approves "respectfully" |
| `g2.boss` | before 2-10 | Cats on a Stove | main | lizardfolk curled round the old lamp; Sango: "Like cats on a stove!"; the boss: "Lamp. Mine. Handsome."; Hikari: the lamp is the second dark stone |
| `g2.after` | after 2-10 | Roll Call of Static | main | "First light."; the lake lights under the jetty; the basilisk lets go and goes home; the radio reads "...prior: Itomachi, Noon..." like a roll call, then nothing |
| `g2.epi` | after 2-10 | Night Tea | main | Mahiru: "I'm not on the roster. I just carry things."; Hikari: "Carrying things is the whole job."; choice "You're like a small Captain." / "Sunshine, junior."; a flyer for the bell festival in three days |

Writing rules (as g1): 8-18 spoken lines, ≤ 1 choice, ≤ 4 portraits, opens with narration or Hikari, **Hikari speaks
in every main episode** (in person or on Channel 9), every line ≤ 110 characters, `{name:id}` tokens, shipped faces
only, backgrounds `stage:2-6…2-10` (campus skyline fallback) or shipped academy/cg. Sensei is never gendered, never
romantic; no ages; students never sexualised; the roll call is names of places, never bodies.

Other changes: `ACT_SCENE_IDS['2:2']` = the 11 ids; `format.js` `META_KEYS` += `ifOwned` (validated against
`UNIT_MAP`); `storyTriggers.js` holds an `ifOwned` scene in the queue until one is owned; the archive shows it locked
with the requirement.

**Tests.** `tests/story/content.test.js`: 39 → 50 scenes, archive order by (chapter, act, index), the Act II shape test
extended to chapter 2 (opener before 2-6, boss intro before 2-10, closer after 2-10, six main scenes), the war-word
lint still scoped to `g*`, the mystery lint covers g2 (the little one never named), Hikari in every main episode;
`tests/data/storySceneIndex.test.js`; `tests/story/system.test.js`: an `ifOwned` scene waits, then plays once a listed
girl is owned, and never plays twice.

**Done when.** Story suites green, `node e2e/story.mjs` passes, independent story-safety pass OK (no gore, Sensei never
gendered or romantic, students never sexualised, uniform scene clean).

---

## 7. Step 2 verify and owner board

- Gates: full `npm test`; `node e2e/smoke.mjs`; `node e2e/engines.mjs`; `node e2e/story.mjs`; `e2e/gate-arc.mjs`
  extended: a save with chapter 2 cleared but not 1-10 shows 2-6 locked with "Clear 1-10"; after 1-10, Act II of
  chapter 2 shows NEW; 2-6 plays `g2.pro`; the 2-7 battle dims during the eclipse; `nice npx vite build`, `rm -rf dist`.
- Shots (844×390 and 1280×720): each map mid-battle at night, a girl on the 2-6 roof, 2-7 lights-out before/after, 2-9
  track, Old Lamp-Hugger in battle and its bestiary card, one frame from each of the 11 scenes, the chapter-2 campaign
  row with NEW (plus 390×844), the two-key lock text on 2-6.
- Boards: `docs/review/gate-arc/step2/*.jpg` (labelled, ≤ 400 KB each). Hashes in `STEP2_HASHES.md` and the last commit
  message. Draft PR #28 description updated (milestones, verdicts, hashes, tests, boards, owner questions, left for
  Step 3).

**Commits.** (1) campus look + track + blackout + previews; (2) maps; (3) stages, rules, skins, boss; (4) story +
`ifOwned`; (5) tests, balance rows, docs (`CONTRACTS.md`: `map.city.road`, `look.blackout`, `ifOwned`;
`docs/CAMPAIGN.md` Hilltop table; HANDOFF §3 row). Push after each.

---

## 8. Risks

1. **2-9's oval vs Blossom Loop / Colosseum IoU** and **2-10's curl vs Moonlight Pier**: shapes may need several
   nudges; keep the entry tunnel and breakwater long, they are what differ.
2. **2-10's flat crossing on the breakwater** is a self-crossing the spec's row does not name; if it fails the
   junction tests, carry the return over the breakwater on a short timber overpass instead.
3. **2-6 rooftop next to a tunnel hall**: `U` beside `H` must not be read as part of the hall by `buildRoofs`; test
   that the hall and the roof block stay separate meshes in the merged facade.
4. **Water ≥ 60 on 2-9** is tight with a big infield; widen the lake before shrinking the oval.
5. **Blackout readability**: dimming must never hide enemies or the road; greyscale shot during the blackout is a gate.
6. **`lunar_eclipse` before 3-3** for Act II players (rule order); default keeps it (owner question).
7. **Two-key unlock on live data** for the first time; veterans who cleared chapter 2 but not 1-10 see 2-6 locked; the
   lock text must name 1-10 clearly.
8. **Pinned counters** move again (stages, achievements, missions, events, profile): each update must keep shipped
   rewards identical and the ledger append-only.
9. **NPC portraits** (Mahiru, Kohaku, Hazuki) are plates only; six of eleven scenes lean on them.

## 9. Owner questions (defaults taken)

- `g2.class` waits until the player owns Ruri, Iroha, Ena or Fuu (new `ifOwned`), rather than playing for everyone.
- 2-7 uses `lunar_eclipse` although Act I first teaches it at 3-3 (Act II players meet it earlier).
- Blackout dimming is per-stage opt-in (2-7 now), so Act I eclipse stages look unchanged.
- 2-10's return run crosses the breakwater at a flat crossing (fallback: a timber overpass).
- The 2-9 track road is a per-map hint (`city.road`), not a separate theme.
