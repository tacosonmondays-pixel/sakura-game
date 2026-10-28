# MAPS · the modern Act II and the future gate (Arc 1 "The Girl at the Door")

Map design for task #210: a second set of five stages for every chapter (x-6 … x-10), set in the other hours of the
Long Day. **Design only.** Nothing in any repo was edited, committed or pushed. The repo was read at `84ebdeb`
(branch `claude/sakura-sentinels`, v0.1.37) with `cat` / `git show`.

Built on, and checked against:
- `STORY.md` (this folder): the chosen arc. Its eight modern acts, map names, bosses, deaths and scene list are kept;
  §0.2 lists the few places where the maps change it, and why.
- `TECH.md` (this folder): the engine today, the city theme draft, the phone budget, the Act II checklist and the
  corrected difficulty rung (§5.2), which this file uses.
- `core-units/WHAT_ELSE.md` §2: the doubling plan (ids, slots, gate, rewards, rollout).
- The owner's canon in `OWNER_CHAT.md` §A: three eras, the Merge, one Sensei, interconnected souls, the future already
  destroyed.
- The Oct 20 look test in `scratchpad/proto-city/` (downtown, campus, surge, town).

This file names no other game, anime, studio or real place, and uses only our own organisations, gear and places, so
any part of it can move into `docs/` later.

---

## 0. At a glance

### 0.1 The per-chapter summary

"Act II of chapter *c*" is STORY's modern **Act *c***. Waves come from chapter *c+1*'s Act I. hpScale uses TECH
§5.2's corrected rung (the rung for chapter *c+1*'s Act I × chapter *c*'s own mean HP pass), because copying
chapter *c+1*'s numbers as they stand today makes Act 3 jump ×1.66 and makes Act 7 easier than 7-5. Engine tags:
**[ready]** the engine does it today (authoring and art only), **[render]** new renderer-only code, **[sim]** new
simulation code (changes the co-op sim hash).

| Ch | Act II (era · look) | Maps x-6 … x-10 | Twins (Act I) | Headline gimmicks | Families | Waves · hpScale | x-10 boss | New engine work | Release |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Rush Hour** (Noon · `city`, day) | Station Plaza · The Covered Arcade · Convenience Corner · Canal Crossing · The Dry Fountain *(echo of Blossom Court)* | 1-1…1-5 | station underpass · shop rooftops · scramble crossing · level-crossing barrier · Brigade airdrops | slime, goblin (+ orc grunt, boar) | 18-22 · 2.15-2.60 | The Frostbitten Heir | rooftops [sim, M] · lane schedule [sim, S] · echo exemption [test, XS] | Step 1 (infrastructure + Act 1) |
| 2 | **Hilltop After Dark** (Noon · `campus`, night) | School Gate · Rowing Jetty · Canal Footbridges · The Running Track · The Boathouse Lamp | 2-1…2-5 | the school rooftop over the corridor · lights out · sensor masts · the track · breakwater and boathouse | lizard, slime, goblin | 22-25 · 2.87-3.47 | Old Lamp-Hugger | blackout dimming [render, S] · track road [render, S] | Step 2 |
| 3 | **The Bell Festival** (Noon · Old Town night → `ruined: burning`) | Old Town Lanes · Takoyaki Row · Shrine Steps · Old Town, Burning *(3-6's ground)* · The Lakeside Shrine *(echo of Inner Sanctum)* | 3-1…3-5 | Old Town roofs · hot griddles · the Petal Gate opens mid-board · the street is gone · HAMMER's tear | ghost (+ all earlier); Brigade spotters on 3-9 | 24-26 · 2.87-3.49 | The Ashen Warden | mid-board rift [render+test, S] · burning look [render, M] · Brigade kit [art, M, built in parallel] | Step 3 |
| 4 | **The Checkpoint** (Noon highway → the Morning's far north, `snow` + Brigade gear) | Toll Plaza · Azami's Checkpoint · Tunnel Mouth · The Frozen Villages · The Snow Bridge | 4-1…4-5 | booth roofs · Azami's barrier · dual carriageway · village hearths · the folding bridge | orc, beast, **Brigade** (4-8's even waves, the lead on 4-9) | 25-28 · 5.61-6.79 | The Frost Vanguard | highway and Brigade kits [render, M] · 4-9 runs from the gate to the camp | Step 4 |
| 5 | **The Drowned Line** (Noon · under the city, fog) | Flooded Platform · Line 2 Tunnels · Pump Station · Reservoir Park · The Reservoir Willow | 5-1…5-5 | out of the subway · a line that is mostly tunnel · steam valves and the Noon Gate · under the dam · round the willow | ghoul, plant, **Vesperline's machines** (5-8, 5-9) | 26-28 · 6.37-7.72 | The Reservoir Willow | subway spawn [render, S] · drowned look [render, M] · Halo Drone variant [art, S] | Step 5 |
| 6 | **Vesperline** (Evening · `vesper`, frozen ruins) | Frost Causeway · Sky-Rail Viaduct · Museum of Noon · Lecture Tower Ring · The Spindle's Foot (+ the Starfall Trial side stage) | 6-1…6-5 | prism batteries · the viaduct · dead grid · transit pads · double helix | **Vesperline's machines** (+ Petal stragglers; Rimebound on 6-10) | 28-30 · 7.47-9.04 | Gatekeeper Unit 01 | viaduct [sim, M] · Vesperline kit [render, L] | Step 6 |
| 7 | **The Night Parade** (Noon · `ruined: after`, festival night) | The Arcade, After *(1-7's ground)* · Festival Stalls · Station Plaza, After *(1-6's ground)* · Hilltop's Two Doors · The Festival Stage | 7-1…7-5 | encore in the ruins · dance-tower roundabout · Brigade pontoons · two doors · fireworks | oni, fae, **Brigade** (7-8's even waves; 7-9 and the HAMMER Carriage) | 28-30 · 11.74-14.24 | The Ember Champion | roundabout [sim, M] · after look [render, S] | Step 7 |
| 8 | **Hearth of the Long Day** (Noon mountain → three skies) | Mountain Road · The Checkpoint, Open *(4-7's ground)* · Weather Station Road · Three Skies · The Summit Stone *(echo of Matriarch's Nest)* | 8-1…8-5 | highway viaduct · armoured-van roofs · radar masts · three hours on one board · three gates | dragon on the Petal lanes, machines on the Noon lanes, **the Night** on the Vesper lanes | 30-32 · 8.53-10.33 | The Shadow at the Gate | era-sector ground [render, M] | Step 8 |

**Totals:** 40 stages on 40 new MapDefs (MapDefs 49 → 89, plus 1 side-stage map). 33 are new layouts, 4 are new
routes on the ground of an earlier modern map ("the same street, after"), and 3 are declared **echoes**: literal
re-skins of an Act I map because they are the same place a thousand years later. Five future-era maps (all of Act 6)
plus the Starfall Trial; 8-9 and 8-10 carry the future as one era of three.

**Enemies:** four factions, one out of each gate plus the city's own Brigade (§1.12); 25 new enemy defs (8 bosses, 8
Brigade units, 6 Vesperline machines, 3 Rimebound) and one new model family, the Brigade (§3.10).

### 0.2 What this file changes in STORY.md (and why)

| STORY.md says | MAPS.md does | Why |
|---|---|---|
| Acts 3 and 7 replay earlier maps with the `ruined` flag (same rows, same route) | the "after" maps (3-9, 7-6, 7-8, 8-7) keep the earlier map's **ground** (rows, buildings, canal) but get a **new route**, because the destruction changed the streets | the owner asked for 40 clearly different maps; a remix replays the same fight; a new route through the same ruined street keeps the story image and plays differently (TECH §3.1: "a remix that should also play differently needs its own MapDef") |
| 3-10 is 3-8 with `ruined` | 3-10 is the echo of 3-5 Inner Sanctum, burning | the Hollow Samurai's "shrine that fell long ago" is this shrine; fighting on a layout the player already knows from the Morning is the paradox felt in the hands. 3-8 → 3-10 continuity stays: 3-8 climbs to the precinct gate, 3-10 is the precinct |
| Vesperline is the glass palette on `city` props | Vesperline gets its own kit (`vesper` theme + a frozen-ruins table) | the owner loves this look most; it is also Arc 2's whole setting, so it is worth building properly once |
| `g4.boss` (before 4-10) contains the crossing into the far north | split: a new third main scene **`g4.cross`** "The Other Side" plays after 4-8 (before 4-9); `g4.boss` keeps only the Frost Vanguard beat | 4-9 is already on the far side of the Petal Gate |
| `g8.mid` "Unarmed" (Azami lifts the barrier) plays before 8-8 | it plays **before 8-7** | 8-7 is "The Checkpoint, Open": the barrier must already be lifted |
| Act 4's rules include `rear_ambush` as "the forced crossing behind the line" | `rear_ambush` sits on 4-8 as "Wrong way" (highway tunnels carry two directions, and the far end now brings the Brigade's strike column); 4-9 keeps the pad rule, now on the village's hearths (two rows down) | the image of modern gear on fantasy snow is the premise the owner named: the Brigade's sandbagged beachhead at 4-9's spawn keeps it |
| (critic pass) with `g4.cross` added, Act 4 has seven cutscenes, and so does Act 7 with Wakaba's join | `g4.mid` "Across the Barrier" folds into Azami's join, which moves to **after 4-7** (her own checkpoint); `g7.board` folds into Wakaba's join after 7-7; the back-door night is two episodes | the owner's rule is 4-6 cutscenes per chapter, joins included; every act now has exactly six. STORY.md is updated to match |
| the Brigade lived in cutscenes and dressing only | the Brigade is an enemy family on the road where the story has it crossing or firing: 3-9 (spotter drones), 4-8 (even waves), 4-9 (the lead), 7-8 (even waves), 7-9 (the lead, with the HAMMER Carriage); from 8-7 it is an ally | the owner (Oct 20): "could the last set of enemies be military soldiers tanks and what not?"; STORY §4.5 and §7.3 are updated to match |
| 4-9 ran from the passes to the Petal Gate's north mouth, with the Brigade's gun pits as pads | 4-9 runs the other way: the squad comes out of the gate and climbs toward Kagari's camp; the pads are the village's three still-warm hearths; the beachhead, the vans and the searchlights stay as dressing at the spawn | the crossing is the fight: the girls hold the village between their own city's soldiers and the children |
| 8-7 … 8-10 fielded oni, fae and a construct | after `g8.mid` Kagari's people and the Brigade are allies, so those maps field wild creatures panicked by the Night on the Petal lanes, Vesperline's machines on the Noon lanes and the Night's Rimebound on the Vesper lanes | the finale is the one place where every gate's faction is on the board at once |
| Act 6's machines were the Foundry's construct defs | they are new Vesperline defs on the same construct GLB (white glass, cyan) plus one new body, the Halo Drone, and they first step out of the Noon Gate at 5-8 | the owner: the robots come from the Noon Gate |

---

## 1. The 40 modern maps

### 1.0 Conventions

- **Ids.** Stages `c-6 … c-10` (WHAT_ELSE §2.2). Map ids are new and snake_case, prefixed by where they are:
  `noon_` (Itomachi, Hilltop, the mountain road), `north_` (the Morning's far north), `vesper_` (Vesperline),
  `skies_` (the board that holds all three hours).
- **Twin.** Each Act II stage twins the Act I stage in the same slot (x-6 ↔ x-1 … x-10 ↔ x-5). "Borrows" is the
  idea carried across the hours, by the rule that the Day rhymes (STORY §4.3, rule 2): the slot's role, a set piece,
  a shape idea or a beat. It is never the trace, except for the three declared echoes (§2).
- **Size.** 20×12 unless noted (22×12 or 22×13 for the long or three-lane maps; wide maps already yaw on portrait
  screens, `camera.js:62`).
- **Tier** = chapter *c+1*'s Act I tier in the same slot (chapter 8's Act II is all expert).
- **Water.** Every map from chapter 2 on keeps ≥ 8 water tiles within 3 tiles of the road; chapter 2's five keep
  ≥ 60 buildable water tiles (`world.test.js:745-758`). Chapter 1 has water anyway.
- **Routes** obey the authoring tests: radius ≥ 1.4 tiles (no square street corners: every corner is an `arc`),
  no bend sharper than 14° per sample, spawns and exits on the edge unless flagged mid-board (§1.1 F, G), tunnels
  ≥ 1 tile, and silhouette IoU < 0.65 plus a different turning signature against every other map. Each row below names
  the nearest shipped shape and what keeps it apart, so the authoring workflow knows where the risk is.
- **Rule** = one of the 15 shipped map rules (every Act II stage has one, so `rules.test.js:24` stays true), shown
  under a modern **skin name**: display text only (`src/ui/text/rules.js` gains a per-stage skin), the numbers are
  the rule's own.
- **Families** follow the family rule, extended: Act II of chapter *c* uses only families **and rules** seen by chapter
  *c*. The three lines new to Act II (the Brigade, Vesperline's machines from 5-8, the Night's Rimebound) carry
  `introducedIn` on an Act II stage and use only rules already taught there (no flyers before 8-1). **At most three
  lead families per act**, so a wave reads at a glance; each row lists the lead families first. Which gate each family
  comes from is in §1.12.
- **Faction balance.** Brigade and Vesperline groups are budgeted by `threat` like any family (Response Trooper 3.5 ≈
  orc grunt, Shieldline Trooper 6 ≈ shieldbearer, Tortoise 16 plus its crew ≈ goblin chief, Badger 22 ≈ warlord, the
  HAMMER Carriage 160 ≈ the Orc General), so swapping a family's groups for theirs leaves every stage's waves, `hpScale`
  and tier as listed. The type chart shifts instead: Brigade troopers are light (slash and pierce), its machines heavy
  and armoured (blast, mystic, armour pierce), and the free-counter rule holds (armour pierce is free after 3-5,
  barrier break after 1-5, traps against sabotage after 5-5).

### 1.1 The gimmick catalogue

Every map has **one headline gimmick that only a modern (or future) map has** (sometimes two codes that work as one
idea, e.g. "E + A": the roof right over the corridor). Twenty kinds; none is the headline more than five times, and
none twice in one act except A in Act 2 (the corridor and the boathouse). "Also on" lists maps where the same feature
appears as a secondary element or only as the rule's flavour.

| Code | Gimmick | How | Engine | Headline on | Also on |
|---|---|---|---|---|---|
| A | **Underpass / building tunnel**: the road runs under a station concourse, a school corridor, a boathouse, a dam or a museum wing; the hall is drawn over it | tunnel under ≥ 2 `H` tiles draws a composed hall (`trackMesh.js:590-629`); new portal styles | [ready] + portal looks [render, S] | 1-6, 2-6, 2-10, 5-9, 6-8 | 1-10, 2-9, 3-10, 5-8, 8-8 |
| B | **Subway and highway tunnels**: long bores where the column cannot be hit | tunnels (`enemies.js:207`, `combat.js:25`) | [ready] | 4-8, 5-7 | 8-6 (snow shed) |
| C | **Flyover / footbridge / gantry** over the road's own earlier pass | crossings become bridges (`track.js:539-552`); concrete, steel, glass looks by data | [ready] | 2-9, 6-10 | 1-10, 5-8, 6-9 |
| D | **Scramble crossing**: a flat four-way junction with zebra crosswalks | flat crossing + `crosswalk` / `junctionBox` ground marks (TECH §3.3, 0 draw calls) | [ready] + marks [render, S] | 1-8 | 6-9; 7-7's fallback |
| E | **Rooftops**: flat roofs (tile `U`) girls can stand on | new tile char accepted as land; girl lifted to roof height ≤ 0.6 (TECH §4.2) | [sim, M] | 1-7, 2-6, 3-6, 4-6, 8-7 | – |
| F | **Mid-board rift**: a lane starts at a gate in the middle of the board | skip the run-out for an `inside: true` path end; the test honours the flag (TECH §4.2) | [render+test, S] | 3-8, 8-9 | – |
| G | **Out of the subway**: a lane starts inside a tunnel mouth mid-board | the run-out inherits the tunnel flag; gate glow at the mouth (TECH §4.2) | [render, S] (needs F) | 5-6 | – |
| H | **Viaduct**: a long raised section (6-8 tiles) with ramps | `RAISE` / `LOWER` markers like `IN` / `OUT`; piers in `buildDecks` (TECH §4.2) | [sim, M] | 6-7, 8-6 | – |
| I | **Lane barrier**: a level crossing or a checkpoint closes one lane on a wave schedule | `waveGen.laneCycle: [[0,1],[1]]` restricts the generated groups to the open lanes; the barrier prop reads the wave | [sim, S] | 1-9, 4-7 | – |
| J | **Roundabout**: two lanes share the ring for half a turn and leave by different exits | a `merge … split` path spec that copies a parent's middle section (TECH §4.2) | [sim, M] | 7-7 | – |
| K | **Power-out**: the lights fail in cycles; holy girls shine in the dark | `lunar_eclipse` + the renderer dims glow geometry and light pools while the rule is ACTIVE | [ready] + dimming [render, S] | 2-7, 3-10, 5-7, 6-8 | – |
| L | **Relay pads**: sensor masts, village hearths, prism batteries, radar masts | `prism_conduits` pads (+25 % damage, +0.7 range) with a modern prop on each | [ready] | 2-8, 4-9, 6-6, 8-8 | – |
| M | **Airdrops / caches**: Brigade crates parachute in every 4th wave | `supply_ship` + a parachute-crate effect | [ready] + effect [render, XS] | 1-10 | rule flavour on 4-6, 6-10 |
| N | **Hot zones**: takoyaki griddles, steam valves, fireworks | `forge_vents` zones on the road | [ready] | 3-7, 5-8, 7-10 | – |
| O | **Evacuation**: commuters or families file out each wave | `petal_sanctuary` (+3 lives per wave) | [ready] | – | rule flavour on 1-6, 2-6 |
| P | **Two exits**: two doors, two carriageways, two lanes leaving opposite ways | paths with different exit points | [ready] | 4-8, 5-10, 7-9 | 7-7 |
| Q | **Water decks**: jetties, piers, pontoons, light-bridges over open water | automatic water decks (`trackMesh.js:289`) with jetty / pontoon / glass looks | [ready] + deck looks [render, S] | 2-10, 4-10, 5-10, 6-6, 7-8 | 2-7, 2-8, 3-8, 5-6 |
| R | **Rift hops**: transit pads or era seams blink the column forward | `shifting_stars` portals `{ at: 0.4, jump: 0.12 }` | [ready] | 6-9, 8-9 | – |
| S | **The street is gone**: the earlier map's ground, a new road through the ruins | route variant on shared rows; rubble `X`, burnt lots `.` | [ready] | 3-9, 7-6, 8-7 | 7-8 |
| T | **Echo**: the same place as an Act I map, a thousand years later | literal re-skin + an `echoOf` field (§2.3) | [test, XS] | 1-10, 3-10, 8-10 | – |

### 1.2 Act 1 · Rush Hour (chapter 1 · Itomachi downtown · `city`, day)

Sensei's real home, warm and lived-in: shops with awnings, bus stops, vending machines, cherry trees in tree grates,
laundry on balconies, canals with water-buses, a railway on the skirt. Families: slime, goblin, orc grunt, boar.
The Brigade is dressing only (drones high overhead, airdrops on 1-10): its first silence is the act's last beat, so it
fields no waves before Act 3. Tiers beginner · intermediate ×3 · advanced. Rules: evacuation, rush hour, time sale, lock cycle, airdrop.

| Stage | Map id · name · size | Twin and what it borrows | Route (shape · splits · crossings · tunnels · elevation) | Nearest shipped shape → what differs |
|---|---|---|---|---|
| **1-6** | `noon_station_plaza` · **Station Plaza** · 20×12 | 1-1 Academy Terrace: the warm-up slot and its lesson, "one inner pocket covers both runs"; the terrace steps become the station's raised concourse | **Taxi-rank hairpin.** Spawn on the west bus lane (the first crack, a Petal Gate mouth in the asphalt), east along the bus lanes, one wide hairpin round the taxi-rank island, back west and under the station concourse (a 3-tile underpass, the station hall drawn over it), out north through the ticket-gate forecourt. 1 path, 1 tunnel, ≈ 40 tiles | Academy Terrace (S + hairpin): one hairpin only, and the run ends in an underpass |
| **1-7** | `noon_covered_arcade` · **The Covered Arcade** · 20×12 | 1-2 Petal Lane: the thieves (goblins after hand warmers and steamed buns instead of petals) and the brook's three beats, now three side alleys | **Comb.** The shopping street runs along the north third under the arcade's open glass ribs; three tall, narrow U-teeth drop south through the side alleys (5 tiles deep, r 1.5) and climb back; exit east. 1 path, ≈ 62 tiles | Petal Lane (three soft lobes): deep narrow teeth hung off one straight |
| **1-8** | `noon_corner_store` · **Convenience Corner** · 20×12 | 1-3 Blossom Loop: the loop that meets its own tail, and the gold slimes' sprint, but the loop meets itself on the ground, at a crossing | **Alpha at the scramble.** Spawn south, up the avenue, an anticlockwise loop round the convenience-store block, back across its own approach at the four-way scramble crossing in front of the store, exit west. 1 path, 1 flat junction, ≈ 50 tiles | Blossom Loop (bridge over its tail): flat crossing, and the loop is a rounded city block |
| **1-9** | `noon_canal_crossing` · **Canal Crossing** · 20×12 | 1-4 Sakura Creek: water splitting the board and the heavy column (orc grunts, boars); the creek's two crossings become a level crossing and a canal bridge | **Level-crossing bypass.** Spawn north; at the railway the road forks: the short lane straight over the level crossing, the long lane a wide D east round the canal basin, over the road bridge and back along the far quay; both rejoin before the south exit. 2 paths (fork + join), ≈ 30 + 55 tiles | Reed Maze (eye): one branch dead straight, the other a wide D, and the barrier picks the branch |
| **1-10** | `noon_dry_fountain` · **The Dry Fountain** · 20×12 | **Echo of 1-5 Blossom Court** (§2.3): the plaza's dry fountain is the Founders' Fountain basin a thousand years later (STORY P7) | Blossom Court's route as shipped: the fountain spiral, the deck over the outer ring (now a pedestrian deck), the arcade tunnel (now the shopping-arcade underpass). 1 path, 1 tunnel, 1 overpass. The basin tiles are dry paving inside the fountain rim until the scene after the battle | declared echo of `sakura_court` |

| Stage | Headline gimmick [engine] | Rule (skin) | Families (lead first) | Waves · hpScale · tier | Water · dressing and temporal scarring |
|---|---|---|---|---|---|
| 1-6 | **A · Station underpass**: the column vanishes under the concourse for 3 tiles; the far mouth is the place to stand [ready] | `petal_sanctuary` · *Rush-hour evacuation* | slime (green, gold), goblin (runner) | 18 · 2.15 · beginner | a canal along the south edge with a moored water-bus; the MISSING poster on the station wall (a pigeon on the face), bus shelters, a clock on the concourse, cherry petals pushing up through cracks in the asphalt |
| 1-7 | **E · Shop rooftops**: the two flat-roofed shop blocks between the teeth are roof tiles; a girl on a roof covers both alleys beside her [sim]. Fallback if rooftops slip: the roofs become loading yards (`.`) and the map plays the same | `tailwind` · *Rush hour* (every 16 s the crowd surges: enemies +25 % speed, +25 % physical damage taken) | goblin (runner, dasher), slime (green) | 20 · 2.25 · intermediate | a back-alley canal behind the south shops; shutters, bun steamers, lanterns for the coming festival, a cat asleep on a roof; the arcade's glass ribs drawn as frames only, never a roof mesh over the road |
| 1-8 | **D · Scramble crossing**: every enemy passes the store's corner twice, so a girl at the crossing works double [ready] + crosswalk marks [render] | `firefly_chorus` · *Time sale* (the store's speakers announce a time sale: +25 % damage for 6 s of every 16 s) | slime (gold, green), goblin (dasher), orc (grunt, a few) | 20 · 2.37 · intermediate | a pocket-park pond inside the loop and the canal edge to the west; the store's lit sign and hot case, bikes, the traffic signal cycling, goblin sacks of hand warmers (the family keyword: fantasy spilling into the street) |
| 1-9 | **I · Level-crossing barrier**: on even waves the arms are down and a train rolls through on the skirt rail; that wave's column must take the long D [sim, S] | `changing_tides` · *Lock cycle* (the canal lock fills every 18 s: slimes 65 % speed, lightning ×1.35) | orc (grunt), beast (boar), slime, goblin | 22 · 2.48 · intermediate | the canal basin (≥ 40 water tiles), lock gates with frost on them in late summer, a crossing bell, signal lamps, a water-bus pier |
| 1-10 | **T + M · Brigade airdrops over the echo plaza**: supply crates parachute onto the plaza every 4th wave, while drones circle with their guns unlocked [ready] + crate effect [render, XS] | `supply_ship` · *Brigade airdrop* | slime (green, gold, Royal Guard), goblin, orc (grunt), beast (boar) | 22 · 2.60 · advanced · **boss: The Frostbitten Heir** | the dry fountain (a dark wardstone) in the middle, frost on its rim, pigeons, the arcade's underpass, the station clock tower in the skirt |

### 1.3 Act 2 · Hilltop After Dark (chapter 2 · Itomachi Hilltop High · `campus`, night)

Sensei's old school on the hill above the lake, where Sakura Academy stands in the Morning: classroom wings, the
clock tower, the gym (Shelter 3), club huts on the old mill canals, the running track, the rowing jetties and the
boathouse. All five are night maps and lakeside maps (≥ 60 buildable water tiles each). Families: lizard, slime,
goblin (+ orc grunt, boar). Tiers intermediate ×3 · advanced ×2.

| Stage | Map id · name · size | Twin and what it borrows | Route | Nearest shipped shape → what differs |
|---|---|---|---|---|
| **2-6** | `noon_school_gate` · **School Gate** · 20×12 | 2-1 Moonlit Shore: the night landing on the lakeshore and the lighthouse at the end of the spit, here the clock tower over the front court | **Front-gate chicane.** Spawn south (the hill road from town), through the front gate, two S-bends round the front-court flowerbeds, then a 4-tile corridor through the main building's ground floor, exit north into the back court at Shelter 3's door. 1 path, 1 tunnel, ≈ 44 tiles | Thousand Steps (switchbacks + short tunnel): flat S-bends, and a long building tunnel at the very end |
| **2-7** | `noon_rowing_jetty` · **Rowing Jetty** · 20×12 | 2-2 Reed Maze: the boardwalk over water that splits in two, here two jetties that bring two columns ashore | **Tuning fork.** Two lanes start at the heads of two long rowing jetties out on the lake (the lizards swim up), run ashore side by side 4 tiles apart, merge at the boat ramp, and climb to the school as one stem through a double switchback. 2 paths (join), ≈ 26 + 26 + 30 tiles | Twin Gorge (trident): the prongs are parallel decks over water and the stem climbs in switchbacks |
| **2-8** | `noon_footbridges` · **Canal Footbridges** · 20×12 | 2-3 Lantern Isles: the island hop; Hilltop's club huts stand on islets in the old mill canals | **Staircase.** Spawn north-west; one lane descends toward the south-east in four rounded steps, each step a footbridge over a canal; exit south-east. 1 path, 4 water decks, ≈ 48 tiles | Lantern Isles (long diagonal bridges): short footbridges on a stepped diagonal |
| **2-9** | `noon_running_track` · **The Running Track** · 20×12 | 2-4 Twin Ferry: a road that crosses itself once on a bridge; the ferry bridge becomes the grandstand footbridge | **Stadium lap.** Spawn west through the marathon gate (a 2-tile tunnel under the grandstand), one full anticlockwise lap of the oval (the road painted as track lanes), over its own entry on the grandstand footbridge, exit north. 1 path, 1 tunnel, 1 overpass, ≈ 56 tiles | Blossom Loop / Sakura Colosseum: one big oval, entered by a tunnel, with the deck over its own entry |
| **2-10** | `noon_boathouse_lamp` · **The Boathouse Lamp** · 20×12 | 2-5 Moonlight Pier: the basilisk curled round the pier lantern, here round the boathouse's old lamp | **Breakwater curl.** Spawn east along the shore road, out along the stone breakwater (a 7-tile straight over the lake), a 270° curl round the old lamp at its head, back to shore on a diagonal timber pier and through the boathouse (a 2-tile tunnel under the boat hall), exit west. 1 path, 1 tunnel, long water decks, ≈ 52 tiles | Moonlight Pier (slashed O): no lap of the shore; a straight out, a curl, a diagonal back into a building |

| Stage | Headline gimmick [engine] | Rule (skin) | Families | Waves · hpScale · tier | Water · dressing |
|---|---|---|---|---|---|
| 2-6 | **E + A · The school rooftop**: the main building's flat roof (where Mahiru waters the flower boxes) is roof tiles right over the corridor exit; girls on the roof cover the court and the back yard [sim] | `petal_sanctuary` · *Shelter intake* (families arriving at Shelter 3: +3 lives per wave) | lizard (skink), slime (green, pearl), goblin (runner) | 22 · 2.87 · intermediate | the lake fills the east third with the rowing club's slipway; shoe lockers seen through the corridor windows, the clock tower, a "Shelter 3" banner, futons glowing in the gym windows, bike sheds, cherry trees, the rooftop flower boxes |
| 2-7 | **K · Lights out**: the campus generator fails in cycles; the jetty floodlights, windows and lamps go dark, and in the dark the holy girls shine [ready] + dimming [render, S] | `lunar_eclipse` · *Lights out* | lizard (skink, marsh hunter), slime (pearl, droplet) | 22 · 3.01 · intermediate | the lake's south half, between and beside the jetties (≥ 80); racks of rowing boats, a coach's stand with a megaphone, a searchlight sweeping the water, fireflies over the reeds |
| 2-8 | **L · Sensor masts**: three of the Science Club's seam-meter masts are relay pads [ready] | `prism_conduits` · *Sensor masts* | lizard (hunter, sunscale), slime (prism, pearl), goblin (dasher) | 24 · 3.15 · intermediate | the canal grid (≥ 70); club huts (art, science, handicraft), the boiler-house chimney steaming (the little one's room, dressing only), laundry lines, lanterns on the footbridges |
| 2-9 | **C · The track**: the infield is the biggest pocket in Act II, with the steeplechase water jump inside it; the grandstand footbridge stacks two passes [ready] + `track` road style [render, S] | `firefly_chorus` · *Starting pistol* | lizard (sunscale, hunter), slime (prism, pearl), goblin (dasher), beast (boar) | 24 · 3.31 · advanced | the lake behind the back straight and the water jump (≥ 60); lane numbers, a finish gantry, bleachers, a glowing scoreboard, a sports-day banner taken down halfway |
| 2-10 | **Q + A · Breakwater and boathouse**: the run out on the breakwater is a long strip for water girls on both sides; the boat hall swallows the column for 2 tiles [ready] | `changing_tides` · *Lake swell* | lizard (Bog Basilisk elites, hunter, sunscale), slime (pearl, prism), goblin | 25 · 3.47 · advanced · **boss: Old Lamp-Hugger** | open lake (≥ 90); the old lamp (a dark wardstone in an iron lamp post), moored rowing eights, life rings, the club crest, a searchlight on the breakwater |

### 1.4 Act 3 · The Bell Festival (chapter 3 · the Old Town and the Lakeside Shrine · night → burning)

The owner's "city destroyed". The first three maps are the warmest festival in the arc; after 3-8's barrage the last
two burn. Old Town is a district of the `city` look: wooden houses with tiled roofs, stone-sett lanes, lantern
strings, a mill race. Families: ghost (+ all earlier: veiled violet slimes and smoke throwers included) and, on 3-9 only,
the Brigade's Gnat spotter drones, HAMMER's eyes. Tiers intermediate · advanced ×4.

| Stage | Map id · name · size | Twin and what it borrows | Route | Nearest shipped shape → what differs |
|---|---|---|---|---|
| **3-6** | `noon_old_town` · **Old Town Lanes** · 20×12 | 3-1 Torii Corridor: the narrow neck and the lantern-lit approach, here the old merchant lanes strung with festival lanterns | **Fret.** Spawn west; three hooked keys in a row, like a meander border (each key: in, a squared spiral turn with r 1.4-1.6 corners, out); exit east. 1 path, ≈ 66 tiles | Sunken Hollow (one fish-hook): three hooks in a row, each a squared key |
| **3-7** | `noon_takoyaki_row` · **Takoyaki Row** · 20×12 | 3-2 Thousand Steps: the smoke and the climb, smoke from the griddles and the stall row climbing toward the shrine | **Lantern N.** Spawn north-west; three long diagonals (an N) down the slope between the stall rows, two wide turns at the row ends; exit south-east at the foot of the shrine steps. 1 path, ≈ 54 tiles | the Ashwing Summit arena (lightning bolt with a curl): three legs, no curl, wide turns |
| **3-8** | `noon_shrine_steps` · **Shrine Steps** · 20×12 · fog | 3-3 Moonveil Spiral ("Between Worlds"): the place where two worlds touch, here the lake fog where the Petal Gate tears wide open | **Rift on the water.** Two fronts: the town road from the west edge, and a lane that starts at a **mid-board rift** on the foggy lake and comes ashore on a jetty deck; they merge at the foot of the steps and climb in two switchbacks to the precinct gate (exit north). 2 paths (join), 1 mid-board spawn, ≈ 28 + 22 + 30 tiles | Thousand Steps (switchbacks): one lane begins in the middle of the lake |
| **3-9** | `noon_old_town_burning` · **Old Town, Burning** · 20×12 · `ruined: burning` · 3-6's ground | 3-4 Koi Garden ("Lantern Procession"): the procession of lanterns, now the fires; the figure-eight's two ponds become the two collapsed blocks the road goes round | **Broken fret.** 3-6's rows after HAMMER: two of the three keys are blocked by collapsed houses (rubble `X`), so the road cuts a long diagonal S through the burnt block, round the two rubble mounds, exit east. 1 path, ≈ 52 tiles | 3-6 (same ground): no keys, one long S; must pass IoU < 0.65 against 3-6 |
| **3-10** | `noon_lakeside_shrine` · **The Lakeside Shrine** · 20×12 · `ruined: burning` | **Echo of 3-5 Inner Sanctum** (§2.3): the shrine that fell; the Hollow Samurai of the Morning guards its memory | Inner Sanctum's route as shipped: two pilgrim roads merge before the sanctum doors and run under the sanctum. 2 paths (join), 1 tunnel | declared echo of `shrine_sanctum` |

| Stage | Headline gimmick [engine] | Rule (skin) | Families | Waves · hpScale · tier | Water · dressing |
|---|---|---|---|---|---|
| 3-6 | **E · Old Town roofs**: the lanes are so narrow that most buildable space is up on the tiled roofs; the street is lanterns and shop fronts [sim] | `moonlit_blessing` · *Bell festival* (when the shrine bell tolls: holy ×1.3) | ghost (wisp, veil wraith), slime (violet), lizard (skink) | 24 · 2.87 · intermediate | the mill race along the south and a stone washing basin; lantern strings (glow geometry), shop curtains, a festival poster, an easel on a corner (*ifUnit* Iroha), cats on the roofs |
| 3-7 | **N · Hot griddles**: gas burners under two stall rows scorch passing enemies every 15 s [ready] | `forge_vents` · *Hot griddles* (2 zones) | ghost (wisp, phantom), goblin (smoke thrower, dasher), slime (violet, gold) | 25 · 3.02 · advanced | a canal on the west edge with festival boats and a ring-toss tub; stalls, the ring toss where Mahiru wins her lantern, the bowing-contest stage, bunting, steam |
| 3-8 | **F · The Petal Gate opens mid-board**: the second lane has no run-in; enemies step straight out of the rift on the lake [render+test, S] | `alchemists_mist` · *Lake fog* (poison ×1.4; heavies 85 % speed) | ghost (veil wraith, phantom, Lantern Bearer), slime (violet), lizard (hunter), orc (grunt) | 25 · 3.16 · advanced | the lake (≥ 50); stone steps, the bell tower's silhouette at the top, a torii-shaped stone half-sunk in the shallows that the Morning's girls recognise (temporal scarring), the far shore's brazier glowing in the fog |
| 3-9 | **S · The street is gone**: the roofs girls stood on in 3-6 are gone; burnt lots are open ground and the road takes a new way [ready] | `heat_mirage` · *HAMMER's smoke* (range −0.5 for 6 s of every 18 s; +1 bounty) | ghost (phantom, Lantern Bearer, veil wraith), **brigade** (Gnat spotters: a fast group on every sixth wave), goblin (smoke thrower) | 26 · 3.32 · advanced | the mill race with hoses running into it; burnt lantern strings, scorched curtains, the festival poster face down, the easel knocked over (*ifUnit*), fire glows on ruins away from the road, smoke from the skirt, embers, ash fall, Gnats circling over the smoke with their camera eyes lit |
| 3-10 | **T + K · The tear**: HAMMER's black-violet tear hangs over the burning sanctum and pulses with the rule [ready] + tear prop [render, S] | `lunar_eclipse` · *The tear* (holy ×1.5, spectral +20 % speed while it pulses) | ghost (Hollow Samurai, Lantern Bearer, phantom) + all earlier | 26 · 3.49 · advanced · **boss: The Ashen Warden** | the mirror ponds of Inner Sanctum's rows; the bell (the third stone), a charred torii, the sanctum roof burning, scattered charms on the steps |

### 1.5 Act 4 · The Checkpoint (chapter 4 · the mountain highway, then the Morning's far north)

The owner's premise in one act: the city's own defence force crosses into the fantasy world, and the Sentinels hold the
line against it. Three highway maps on
the Noon side (`city` with a highway district: concrete road, sound walls, sign gantries, toll booths), then two
maps on the far side of the Petal Gate: the Morning's `snow` look dressed with the Brigade's modern gear (sandbags,
searchlights, armoured vans, a folding bridge). Families: orc, beast and the Brigade (4-8's even waves, the lead
on 4-9). Tiers intermediate · advanced ×3 · expert.

| Stage | Map id · name · size | Twin and what it borrows | Route | Nearest shipped shape → what differs |
|---|---|---|---|---|
| **4-6** | `noon_toll_plaza` · **Toll Plaza** · 22×12 | 4-1 Ironhold Switchbacks ("Iron Column"): the iron column coming down the mountain road, here through the toll barrier | **Three-booth lens.** Spawn north-east off the pass; the road fans into three toll lanes through three booths, re-merges past the barrier, and swings down the off-ramp to the south-west exit. 3 strands (two lanes fork and rejoin the middle one), ≈ 50 tiles of lanes | Matriarch's Nest (three lanes converge): one lane splits into three and back to one |
| **4-7** | `noon_checkpoint` · **Azami's Checkpoint** · 20×12 · dusk | 4-2 Sky Bridge ("Wolves on the Bridge"): the narrow crossing held against the pack, here a barricade line across the highway | **Barrier chicane.** Spawn north (the pass road); at the Brigade's barricade line the road splits: the short lane straight through the checkpoint gate, the long lane a chicane of two S-bends round the barricade blocks; they rejoin below; exit south. 2 paths (fork + join), ≈ 34 + 52 tiles | Witchroot Tangle (braid): one branch straight, one a snake, and the barrier picks the branch |
| **4-8** | `noon_tunnel_mouth` · **Tunnel Mouth** · 20×12 · snow at the north portals | 4-3 Stone Bastion ("Shield Wall"): the wall in the mountain, here two tunnel bores through it | **Dual carriageway.** Two lanes come out of two parallel highway bores on the north side (5 tiles each), run south side by side with a buildable central reservation between them, and leave by two exits. 2 paths, 2 tunnels, 2 exits, ≈ 40 + 40 tiles | none shipped: two independent parallel lanes |
| **4-9** | `north_frozen_villages` · **The Frozen Villages** · 20×12 · `snow` | 4-4 Twin Gorge ("Howl of the Alpha"): the valley floor where the canyon roads meet and the pack howls, here the frozen valley of the Emberfolk villages | **Climb and horseshoe.** Spawn south at the **Petal Gate's north mouth**, where the Brigade's squad has dug a sandbagged beachhead; a straight climb up the old sled run, a wide horseshoe round the frozen village square, and out north past the pass cairn (the exit is the road to Kagari's camp, where the children are). 1 path, ≈ 50 tiles | Frozen Falls (omega): a long straight, then an open horseshoe; no tunnel |
| **4-10** | `north_snow_bridge` · **The Snow Bridge** · 22×12 · `snow` | 4-5 Ironhold Gate ("The Iron General"): two roads meeting at one gate held by the General, here two columns meeting at the bridge the General holds after the battle | **Two columns, one bridge.** Two lanes, the gorge-rim road (west) and the frozen riverbed (north-east), converge at the bridgehead and cross the long snow bridge over the ravine as one (an 8-tile deck); exit south to the gate. 2 paths (join), ≈ 30 + 34 + 16 tiles | Sky Bridge (ravine dip): two lanes meet just before the long bridge |

| Stage | Headline gimmick [engine] | Rule (skin) | Families | Waves · hpScale · tier | Water · dressing |
|---|---|---|---|---|---|
| 4-6 | **E · Booth roofs**: the two booth islands inside the lens are roof tiles ("It's a very good booth.") [sim] | `supply_ship` · *Brigade convoy* | orc (grunt, ironhide, berserker), beast (wolf), slime (iron) | 25 · 5.61 · intermediate | a mountain stream in a concrete channel and a drainage pond; toll booths with lit price boards, a sign gantry, sound walls, frost on the guard rails in late summer, a rest-stop vending row |
| 4-7 | **I · Azami's barrier**: the checkpoint gate is shut on odd waves; that wave walks the long chicane [sim, S] | `heat_mirage` · *Flare smoke* (the Brigade's smoke flares) | orc (shieldbearer, ironhide, berserker), beast (wolf, bear) | 26 · 5.89 · advanced | a stream under the culvert and a fire-water pond by the tents; jersey barriers, Azami's citation stand, the barrier arm, Brigade tents, searchlights, armoured vans parked in the skirt, each with one of Azami's tickets under its wiper |
| 4-8 | **B + P · Twin bores**: each column is hidden for 5 tiles; the reservation between the carriageways covers both [ready] | `rear_ambush` · *Wrong way* (even waves come out of the far end: the Brigade's strike column, coming up from the city toward the gate) | orc (ironhide, berserker), beast (wolf) on odd waves; **brigade** (Response and Shieldline Troopers, Gnats; a Tortoise from wave 14) on even waves | 26 · 6.17 · advanced | a reservoir below the portals; tunnel portals with jet fans and lamps, snow blowing out of the north bores, a stopped lorry, frost creeping south across the asphalt |
| 4-9 | **L · Village hearths**: the village's three last warm hearths are relay pads, so the girls hold the warm places between the squad and the camp [ready] | `prism_conduits` · *Village hearths* | **brigade** (Response and Shieldline Troopers, Gnats, Tortoise elites; a Badger on each of the last three waves), beast (wolves and bears stampeding up the valley ahead of the guns) | 27 · 6.49 · advanced | a hot spring still steaming in the village (the last warm place) and an icy stream; frozen huts with horned-family charms, a fire going out, small sleds, a searchlight and an armoured van on the snow, the Petal Gate's mouth ringed with sandbags at the spawn (the squad's beachhead), a vast shadow crossing the board (a cloud-shadow pass; never named) |
| 4-10 | **Q · The folding bridge**: the Brigade's bridge-layer deck over the ravine is the one choke on the map, with the river under it for water girls [ready] + deck look [render, S] | `snowbell_blizzard` · *Blizzard* | orc (Warlord, shieldbearer, ironhide), beast (Alpha Wolf, wolf, bear) | 28 · 6.79 · expert · **boss: The Frost Vanguard** | the ravine river (≥ 30); the old stone bridge piers beside the military deck, the Host's war banners, frozen pines, Brigade tents on the far bank, what is left of the squad regrouping by the goal, fewer than came through the gate (the girls defend them from the rearguard), HAMMER's glow on the horizon |

### 1.6 Act 5 · The Drowned Line (chapter 5 · under the city · `drowned`, fog)

Itomachi's old Line 2, flooded and abandoned, runs in open cuttings and short bores under the city, so the battle
camera can see down into it. Then the reservoir park and the willow. This is where the future first leaks in:
Vesperline's glass shards in the drowned line, and the Noon Gate's mouth at 5-8, where Vesperline's machines step out
behind the Last Watch (they still hold the line, and the line is wherever the gate is). Families: ghoul, plant and,
from 5-8, the machines.
Tiers intermediate ×2 · advanced · expert ×2.

| Stage | Map id · name · size | Twin and what it borrows | Route | Nearest shipped shape → what differs |
|---|---|---|---|---|
| **5-6** | `noon_flooded_platform` · **Flooded Platform** · 20×12 | 5-1 Gloomfen Boardwalk ("Leeches in the Fog"): the boardwalk over black water in fog, here a platform edge over the flooded track bed | **Up from the platform.** The column climbs out of a flooded tunnel mouth **mid-board** (no run-in), walks the length of the platform (a deck over the flooded tracks), up the station stairs, round the station block at street level, exit east. 1 path, subway spawn, ≈ 46 tiles | Gloomfen Boardwalk (wander): starts mid-board, one long straight platform, then a hook |
| **5-7** | `noon_line2_tunnels` · **Line 2 Tunnels** · 20×12 | 5-2 Lantern Mire ("Blink and Bloom"): the causeway you lose sight of, here a line you can barely see | **Dashed line.** One gentle meander across the board that is 70 % tunnel: four bores separated by three open vent cuttings, the only places the column can be hit. 1 path, 4 tunnels, ≈ 58 tiles | Furnace Core (two tunnels): four bores, a low meander, kill boxes between them |
| **5-8** | `noon_pump_station` · **Pump Station** · 20×12 | 5-3 Witchroot Tangle ("Thorn and Moss"): roads that swap places, here pipes that cross over the road | **Pipe gantry loop.** Spawn at the north edge: the spawn gate is **the Noon Gate itself**, breathing frost and glass. Down past the pump hall, one big loop round the sump that passes through the pump hall (2-tile tunnel) and over its own first leg on a pipe gantry; exit west. 1 path, 1 tunnel, 1 overpass, ≈ 54 tiles | Blossom Loop / Machine Hangar: one loop, entered through a hall, over its own first leg |
| **5-9** | `noon_reservoir_park` · **Reservoir Park** · 20×12 · fog | 5-4 Sunken Hollow ("Congregation"): the hollow where the dead gather, here the lawn bowl under the dam | **Spillway Z.** The dam runs across the middle, the reservoir north of it, the park's lawn bowl south. Spawn at the west end of the dam crest and run east along it, a hairpin down the spillway steps, back west across the lawn bowl, then north through the dam's service tunnel, beneath its own first leg (a road-over-tunnel crossing), and out along the reservoir's west promenade; exit north. 1 path, 1 tunnel, ≈ 52 tiles | Blossom Court / Lych Crypt (road over tunnel): a Z whose last leg tunnels under its first |
| **5-10** | `noon_reservoir_willow` · **The Reservoir Willow** · 20×12 · fog, night | 5-5 Drowned Willow: the shivering willow at the heart of the water | **Yin-yang round the willow.** Two lanes start at two dams (north-west and south-east), cross the reservoir on causeways, and curl round the willow island on opposite sides in an S each, leaving by opposite corners. 2 paths, 2 exits, long water decks, ≈ 44 + 44 tiles | Drowned Willow (double spiral): two lanes, two exits, mirrored S curls on water |

| Stage | Headline gimmick [engine] | Rule (skin) | Families | Waves · hpScale · tier | Water · dressing |
|---|---|---|---|---|---|
| 5-6 | **G · Out of the subway**: the column appears from a tunnel mouth in the middle of the map; the flooded track bed beside the platform is water girls' ground [render, S] | `changing_tides` · *Rising water* | ghoul (bonewalker, leech, shambler), slime (rose, pearl), lizard (skink) | 26 · 6.37 · intermediate | the flooded track bed (≥ 40); Line 2 platform signs, a tiled wall with a mosaic of the lake, a train half-sunk at the far end, emergency lights, one vending machine still lit, retaining walls with the city's streets along their tops |
| 5-7 | **B + K · Emergency lights**: the column is untargetable for most of the map, and the tunnel lights cut out in cycles [ready] + dimming [render] | `lunar_eclipse` · *Emergency lights* | ghoul (skulker, shambler, bonewalker), plant (sprout, seedpod), ghost (phantom) | 27 · 6.68 · intermediate | flooded cuttings (≥ 20); stairs-and-canopy portals, signal lamps, a maintenance cart, roots through the tiles, Vesperline glass shards in the water (scarring: the future leaking in) |
| 5-8 | **N · Steam valves**: two relief valves on the road blast steam every 15 s [ready]; the spawn gate is the Noon Gate (its own look, §3.4) | `forge_vents` · *Steam valves* (2 zones) | **machines** out of the Noon Gate (Halo Drones, Line Sentries, Patrol Orbs), plant (thornroot, mossling), ghoul (leech) | 27 · 7.01 · advanced | the sump (≥ 30); giant pumps, pipe runs, a control-room window, glass shards floating round the gate, frost on the pipes |
| 5-9 | **A · Under the dam**: the last leg vanishes into the dam's service tunnel directly beneath the crest road the column walked first [ready] | `alchemists_mist` · *Reservoir fog* | ghoul (Grave Priest elites, skulker), plant (thornroot, treant elite), machines (a few Line Sentries, holding the line out from the gate) | 28 · 7.35 · expert | the reservoir (north) and the spillway pool (≥ 40); park lamps in fog, a bandstand, boats chained at the edge, rescue buoys, the willow's crown over the dam (the next map), Brigade search boats |
| 5-10 | **P + Q · Round the willow**: two lanes, two exits; every girl on the island sees both curls [ready] | `firefly_chorus` · *Fireflies* (over the reservoir at night) | plant (Elder Treant elites, thornroot, sprout), ghoul (Grave Priest, leech), slime (rose) | 28 · 7.72 · expert · **boss: The Reservoir Willow** (takes the longer lane) | open reservoir (≥ 100); the willow (the stone in its roots), the two dam walls, rescue boats, fireflies |

### 1.7 Act 6 · Vesperline (chapter 6 · the destroyed future · `vesper` + `ruined: frozen`)

The city that will one day stand on this lake, already dead: glass lecture towers frozen mid-eclipse, sky-rails
hanging over nothing, halos on every statue, snow in the courtyards, holo signs flickering in dead colours. The
enemies are the city's own machines (the construct body in Vesperline white glass and cyan, §1.12), still obeying "hold
the line", plus a few Petal stragglers drawn through the Noon Gate toward the one warm window in the city (rule 9), and
on 6-10's last waves the Night's first Rimebound. Families: machines (+ stragglers). Tiers intermediate · advanced ×2 · expert ×2.

| Stage | Map id · name · size | Twin and what it borrows | Route | Nearest shipped shape → what differs |
|---|---|---|---|---|
| **6-6** | `vesper_frost_causeway` · **Frost Causeway** · 20×12 | 6-1 Crystal Vats: the road that wraps each vat, here each frozen basin of the lake | **Broken causeway.** Spawn west on the frozen lake; the causeway into the city runs east in a long, shallow W, broken into three segments joined by two fold-out light-bridges over open water; exit east at the city gate. 1 path, 2 glass water decks, ≈ 44 tiles | Lantern Isles (island hop): a flat, horizontal W with short glass decks |
| **6-7** | `vesper_skyrail` · **Sky-Rail Viaduct** · 22×12 | 6-2 Conveyor Line ("Barrier Line"): the belt that runs over and under itself, here a sky-rail | **Sky-rail S.** Spawn north; the road climbs onto a broken sky-rail viaduct (8 tiles raised), snakes along it in a long S over the ruins, comes down the ramp at the broken span and runs back underneath its own viaduct; exit south-west. 1 path, 1 viaduct, 1 under-crossing, ≈ 58 tiles | Conveyor Line (figure-eight): one long raised S, then underneath it |
| **6-8** | `vesper_museum` · **Museum of Noon** · 20×12 | 6-3 Gearworks Crossing ("Sabotage!"): the on-ramp that dives under the line, here a road that dives through the museum's wings | **Wings and rotunda.** Spawn south-east at the forecourt, through the east wing (a 3-tile gallery tunnel), out into the open rotunda court, a half-circle round the weathered Doorie statue, through the west wing (3 tiles), and out west through the frozen garden in an S. 1 path, 2 tunnels, ≈ 56 tiles | Gearworks Crossing (cloverleaf): two symmetric building tunnels round a half-ring |
| **6-9** | `vesper_tower_ring` · **Lecture Tower Ring** · 20×12 | 6-4 Furnace Core ("Powder Kegs"): corridors between machines, here transit lanes between towers | **Phi.** Spawn west; three-quarters of the ring road round the tower ring, then straight in along a spoke, across the central plaza and out along the opposite spoke, crossing the ring twice (once on a light-bridge, once flat at a crossing); exit east. 1 path, 1 overpass, 1 flat junction, ≈ 60 tiles | none shipped: a ring cut by its own diameter |
| **6-10** | `vesper_spindle_foot` · **The Spindle's Foot** · 22×12 | 6-5 Machine Hangar ("The Goblin Machine"): loops that cross themselves round the machine, here round the white tower | **Double helix.** Two lanes from the Vesper Gate's terminal (north-west and north-east) spiral round the Spindle's foot in opposite directions, cross each other twice on light-bridges, and merge before the shelter in the south. 2 paths, 2 overpasses, 1 join, ≈ 46 + 46 tiles | Machine Hangar (coil spring): two lanes turning opposite ways round one centre |

| Stage | Headline gimmick [engine] | Rule (skin) | Families | Waves · hpScale · tier | Water · dressing |
|---|---|---|---|---|---|
| 6-6 | **L + Q · Prism batteries**: three still-charged batteries on the causeway islands are relay pads; the light-bridges are glass decks over open water [ready] + light-bridge look [render, S] | `prism_conduits` · *Prism batteries* | machines (Patrol Orb, Lattice Shell), slime (quartz, iron), goblin (sapper) | 28 · 7.47 · intermediate | open leads in the frozen lake (≥ 60; the ice is ground); frozen towers on the skyline, sky-rails hanging over nothing, a halo statue at the city gate, a Doorie bus abandoned on the causeway, a cold aurora |
| 6-7 | **H · The viaduct**: a long raised section; enemies on it stay targetable; the run back underneath stacks two passes [sim, M]. Fallback: two ordinary overpasses on the same line | `heat_mirage` · *Frost haze* | machines (Vesper Aegis, Patrol Orb, Line Sentry), goblin (bomber, sapper), slime (ember) | 28 · 7.84 · advanced | a frozen canal with open water (≥ 10); sky-rail pods stuck mid-span (one fallen), pylons, dead holo signs flickering, frost on glass, a station canopy |
| 6-8 | **A + K · Dead grid**: the column vanishes in each wing, and the museum's last generator fails in cycles: holo exhibits go out, holy girls shine [ready] + dimming [render] | `lunar_eclipse` · *Dead grid* | machines (Line Sentry, Vesper Aegis, Halo Drone), ghost (phantom, wisp), goblin (sapper) | 29 · 8.23 · advanced | reflecting pools in the rotunda (≥ 12); the gallery sign *Itomachi, Before*, Iroha's painting (*ifUnit*), the Doorie statue (faceless, a lantern, a keychain cast at its belt), the picture-book case, frozen fountains |
| 6-9 | **R · Transit pads**: the city's broken transit pads still fire: at 40 % of the road the column blinks forward by 12 % [ready] + pad glow [render, XS] | `shifting_stars` · *Transit pads* | machines (Vesper Warden elites, Line Sentry, Lattice Shell, Halo Drone), slime (quartz, ember), goblin (bomber) | 29 · 8.62 · expert | a ring canal round the towers (≥ 10); tower podiums low on the board and the glass towers tall in the skirt (height rule), halo statues, the Defence Corps sign, a cleaning robot still circling the plaza |
| 6-10 | **C · Counter-spiralling light-bridges**: every placement near the Spindle sees both lanes twice [ready] + light-bridge look [render] | `supply_ship` · *Last Watch caches* (Tsubaki's cached supplies) | machines (Vesper Warden, Line Sentry, Vesper Aegis) + earlier stragglers; the last three waves add Rime Wisps from the Vesper Gate's terminal | 30 · 9.04 · expert · **boss: Gatekeeper Unit 01** | the Spindle's ring moat (≥ 20); the Spindle (the tallest prop in the game, in the skirt), the Vesper Gate's terminal and frost-white ring, a frozen nest far too big for any bird, a thread of grey wool in the ice for the observant, the empty shelter the Gatekeeper still heats (one warm window) |

### 1.8 Act 7 · The Night Parade (chapter 7 · festival in the ruins · `ruined: after`, night)

The sweetest act before the worst night. Itomachi weeks after the fire: cold ash, tarps, relief tents, swept paths,
festival lanterns strung across burnt beams, then Hilltop's two doors. Families: oni, fae and the Brigade: Kuroe's
cordon round the festival (7-8) and the guns on the back street (7-9). Tiers advanced ×2 · expert ×3.

| Stage | Map id · name · size | Twin and what it borrows | Route | Nearest shipped shape → what differs |
|---|---|---|---|---|
| **7-6** | `noon_arcade_after` · **The Arcade, After** · 20×12 · 1-7's ground | 7-1 Lantern Street: two parades that merge and leave as one | **Broken comb.** 1-7's rows after the fire: the arcade's ribs are down and its alleys are blocked by fallen shopfronts, so two lanes (from the west end of the street and from a collapsed north alley) merge mid-street where the festival is set up, and run out east. 2 paths (join), ≈ 30 + 24 + 20 tiles | Lantern Street (lambda) and 1-7 (same ground): a T-merge, no teeth; must pass IoU < 0.65 against 1-7 |
| **7-7** | `noon_festival_stalls` · **Festival Stalls** · 20×12 | 7-2 Fireworks Square: the square every route passes through, here the dance tower's roundabout | **Dance-tower roundabout.** Two lanes enter (north and west), share the ring round the dance tower for half a turn, and leave by different exits (south and east). 2 paths sharing a middle section, 2 exits, ≈ 32 + 32 tiles | Fireworks Square (trefoil): two lanes share one ring and split again |
| **7-8** | `noon_plaza_after` · **Station Plaza, After** · 20×12 · 1-6's ground | 7-3 Moon Bridge ("Mirror Parade"): the river crossed and crossed again, here the plaza canal on the Brigade's pontoons | **Double pontoon S.** 1-6's rows after the war: the concourse has collapsed onto the underpass (rubble), so the road enters from the burnt bus terminal (east), runs west along the canal quay, crosses on a pontoon, climbs round the mound where the concourse fell in a tight S, crosses back on a second pontoon, and exits north through the ruined ticket gates. 1 path, 2 water decks, ≈ 58 tiles | Moon Bridge (three crossings) and 1-6 (same ground): two crossings round a mound; must pass IoU < 0.65 against 1-6 |
| **7-9** | `noon_two_doors` · **Hilltop's Two Doors** · 20×12 · `campus`, night | 7-4 Shrine Maze ("Drums of the Taiko"): the maze of ways in, here the school's two ways in | **Fork to two doors.** One lane from the burning town forks at the school gate: the long way round the front court to Shelter 3's main door (north), and the short way behind the gym to the east service door (east). 2 paths (fork), 2 exits, ≈ 50 + 34 tiles | Market Canal arena (fork to two exits): forks at a gate, one long and one short branch round a building |
| **7-10** | `noon_festival_stage` · **The Festival Stage** · 20×12 | 7-5 Champion's Stage: the lap round the stage, and the rematch on it | **Two half-moons.** The parade's two columns come down from the north and from the south, each wraps half of the festival stage, and they meet at the west exit (join). 2 paths (join), ≈ 40 + 40 tiles | Champion's Stage (lasso): no lap, no crossing; two arcs closing an O |

| Stage | Headline gimmick [engine] | Rule (skin) | Families | Waves · hpScale · tier | Water · dressing |
|---|---|---|---|---|---|
| 7-6 | **S · Encore in the ruins**: the roofs girls stood on in 1-7 are gone; every 3rd wave the festival pays coins and charges every ultimate [ready] | `festival_encore` · *Encore* | oni (brute, wind), fae (sprite, mirage), goblin (bomber) | 28 · 11.74 · advanced | 1-7's back-alley canal with a bucket chain; lanterns on burnt beams, tarps, relief tents, a festival poster redrawn by hand, the cat from 1-7 sitting on the rubble |
| 7-7 | **J · The roundabout**: a girl inside the ring hits both columns; the exits split them again [sim, M]. Fallback: the lanes cross once, flat, at the top of the ring | `moonlit_blessing` · *Lantern dance* (holy ×1.3 while the dance drums play) | oni (ward, bloom, wind), fae (illusionist, sprite), lizard (sunscale) | 29 · 12.33 · advanced | a fireworks-barge basin (≥ 10); the dance tower with its drums, stalls, Wakaba's water station, bunting, a stage being built |
| 7-8 | **Q · Brigade pontoons**: two temporary pontoon bridges float on the canal; water girls on both banks see each crossing [ready] + pontoon look [render, S] | `rear_ambush` · *Cordon* (even waves: the Brigade's cordon pushes in through the ruined ticket gates) | oni (brute, Taiko elites), fae (Mirror Queen elites, illusionist) on odd waves; **brigade** (Response, Shieldline and Foam Troopers; a Strider from wave 18) on even waves | 29 · 12.94 · expert | the plaza canal (≥ 40); the MISSING poster half-burnt, the station clock stopped, relief tents, lanterns on the lamp-posts |
| 7-9 | **P · Two doors**: two shelter doors to defend; the elites of the last three waves (Badgers, then **the HAMMER Carriage** on the last) take the short lane to the back door, by fixed groups with a lane [ready] | `snowbell_blizzard` · *Cold through the seams* (the Night's cold pouring from torn streets) | **brigade** (Response, Shieldline and Foam Troopers, Striders, Badger elites, the HAMMER Carriage), oni (ward, bloom: Kagari's outriders) | 30 · 13.58 · expert | the campus shore (≥ 20); the rooftop flower boxes seen from the court, a watering can on the back stairs, the main door with Azami's barrier, the back door's frozen motor, frost pouring from the torn street; after HAMMER's ranging shot (its 33 % phase) a black-violet tear crackles on the back street for the rest of the battle |
| 7-10 | **N · Fireworks**: the Box's fireworks racks fire into two zones on the road every 15 s ("the right amount of boom is A LOT") [ready] | `forge_vents` · *Fireworks* (2 zones) | oni (Champion boss, Taiko, ward, brute), fae (Mirror Queen) + all | 30 · 14.24 · expert · **boss: The Ember Champion** | the arcade canal (≥ 10); the great taiko on the stage (Kanna), fireworks racks, lanterns, the Ember's palanquin in the skirt, the ruined arcade behind |

### 1.9 Act 8 · Hearth of the Long Day (chapter 8 · the mountain road to the summit)

Grief turned into resolve, then the three hours on one mountain. The road climbs from the city through the
checkpoint (open now) to the weather station and the summit, where the three gates line up. Families: dragon
(panicked wyverns and drakes, never the brood) and the peaks' wild creatures on the Petal lanes, Vesperline's machines on
the Noon lanes and the Night's Rimebound on the Vesper lanes (8-9, 8-10). From `g8.mid` (before 8-7) Kagari's people and
the Brigade fight beside the cast, so 8-7 … 8-10 field no oni, fae or Brigade. Expert ×5.

| Stage | Map id · name · size | Twin and what it borrows | Route | Nearest shipped shape → what differs |
|---|---|---|---|---|
| **8-6** | `noon_mountain_road` · **Mountain Road** · 22×12 · `snowCover`, dawn | 8-1 Ashwing Ascent ("Wings over the Ascent"): the climb under wings, here the highway's curve at dawn | **Viaduct curve.** Spawn north-east; the highway sweeps round the valley on a curved viaduct (7 tiles raised), dives into a snow shed (a 3-tile tunnel), then drops down one switchback to the south-west exit. 1 path, 1 viaduct, 1 tunnel, ≈ 56 tiles | Ashwing Ascent (corkscrew): a raised curve and a snow shed, no loop |
| **8-7** | `noon_checkpoint_open` · **The Checkpoint, Open** · 20×12 · `snowCover` · 4-7's ground | 8-2 Frozen Falls: up one side and down the other, here straight through the gate that used to be shut | **Straight through, then a hook.** 4-7's rows: Azami's barrier is lifted, so one road runs straight through the checkpoint gate (4-7's short lane), then hooks right round the park of armoured vans and exits west; the old chicane is blocked by the vans. 1 path, ≈ 46 tiles | 4-7 (same ground): one lane, a J; must pass IoU < 0.65 against 4-7 |
| **8-8** | `noon_weather_station` · **Weather Station Road** · 20×12 · `snowCover` | 8-3 Caldera Rim: the rim lap that dives up a spit, here the hook round the radar platform | **Radar hook.** Spawn west; a long climb in a shallow Z, a hook round the radar dome's platform, through the station's service tunnel (2 tiles), exit north. 1 path, 1 tunnel, ≈ 52 tiles | Caldera Rim (kidney): a Z and a hook; the tunnel replaces the rim lap |
| **8-9** | `skies_three_skies` · **Three Skies** · 22×12 · era sectors | 8-4 Dragonback Ridge: the ridge where the star rift opens, here all three hours on one mountainside | **Cascade of three hours.** The board is painted in three sectors: the Morning's snowy pass (north-west), Itomachi's highway (middle), Vesperline's frozen glass terrace (south-east). The main lane runs from the north-west edge in a long S through all three; a Noon rift (the Noon Gate) opens mid-board in the middle sector and a Vesper rift (the Vesper Gate) mid-board in the south-east, and their short lanes join the main road at two points. 3 paths (2 mid-board spawns, 2 joins), ≈ 60 + 14 + 12 tiles | Dragonback Ridge (spine): lanes born mid-board, joining in sequence |
| **8-10** | `noon_summit_stone` · **The Summit Stone** · 22×13 | **Echo of 8-5 Matriarch's Nest** (§2.3): the same summit; the three lanes now come from the three gates | Matriarch's Nest's route as shipped: three lanes converge on one choke below the summit and run out together. 3 paths, 2 joins. Each spawn wears its era's gate (§3.4) | declared echo of `peaks_nest` (its concept string gets our own words; the shipped string's parenthetical is not copied) |

| Stage | Headline gimmick [engine] | Rule (skin) | Families | Waves · hpScale · tier | Water · dressing |
|---|---|---|---|---|---|
| 8-6 | **H · Highway viaduct**: the curve is raised over the valley; ground girls still reach it [sim, shipped in Step 6] | `tailwind` · *Mountain wind* | dragon (Ash Wyvern), goblin (glider), slime (bubble), orc (berserker) | 30 · 8.53 · expert | a valley stream and a hydro reservoir (≥ 10); dawn light, frost on the guard rails, a stopped bus, signs to the pass, footprints in the snow going uphill |
| 8-7 | **E + S · Armoured-van roofs**: the parked vans are roof tiles: Brigade and Sentinels stand together [sim] | `snowbell_blizzard` · *Pass blizzard* | dragon (wyvern, Ashdrake), beast (Alpha Wolf), goblin (glider) | 30 · 8.94 · expert | 4-7's stream and pond; the barrier arm raised, Azami's citation stand, lanterns of Kagari's people along the road, a mark in the snow where the Dawnblade was set down |
| 8-8 | **L · Radar masts**: three radar and antenna masts are relay pads [ready] | `prism_conduits` · *Radar masts* (the Brigade's, lent to the girls) | dragon (Ashdrake, Cinder Wyvern elites), goblin (glider), slime (bubble) | 31 · 9.39 · expert | a meltwater tank and a mountain tarn (≥ 10); radar domes, anemometers, a cable-car line overhead (skirt), Shiro's instruments, the moon twelve degrees north |
| 8-9 | **R + F · Era seams**: three looks on one board; at the first seam the column blinks forward through the fold; two lanes are born mid-board [ready] + mid-board rift (Step 3) + sector ground [render, M] | `shifting_stars` · *Three skies* | main lane: dragon (Cinder Wyvern, wyvern, Ashdrake); Noon rift: machines (Halo Drone, Vesper Warden); Vesper rift: **the Night** (Rime Wisp, Rime Slime, Night Wyvern elites) | 31 · 9.85 · expert | a spring in the Morning sector, a highway reservoir in the Noon sector, a frozen fountain basin in the Evening sector (≥ 12); three skies stacked over the board in the backdrop, a torii, guard rails and a broken sky-rail, one in each sector |
| 8-10 | **T · Three gates**: each lane opens from a different era's gate, in its era's colour, with the summit stone at the choke [render, S] | `moonlit_blessing` · *First light* (every 18 s the summit stone pulses: holy ×1.3) | Petal lane: dragon (Cinder Wyvern, wyvern); Noon lane: machines (Line Sentry, Vesper Warden); Vesper lane: **the Night** (Rime Wisps, Rime Slimes, Night Wyverns) and the boss | 32 · 10.33 · expert · **boss: The Shadow at the Gate** | the summit's crater pool from 8-5's rows (≥ 30); the summit stone, the Petal, Noon and Vesper gates, three skies; the freed Matriarch circles the board as an allied set piece, never a target, and the Brigade's searchlights and two Herons circle with her |

### 1.10 The x-10 bosses on their maps

Every boss is a new EnemyDef on an existing family GLB (STORY §12), so the campaign-enemy cap in `world.test.js:72`
rises by eight for the bosses (by 25 with the new factions, §3.10).

| Stage | Boss | Built from | Why this map suits it |
|---|---|---|---|
| 1-10 | **The Frostbitten Heir** | Slime Prince GLB, frost tint and crown; splits into Royal Guard Slimes; orc grunt escorts | the same throne a thousand years on: the fountain spiral keeps it circling the dry basin, and the underpass hides the split |
| 2-10 | **Old Lamp-Hugger** | Bog Basilisk at miniboss scale, regeneration; Marsh Hunters, Pearl Slimes | the curl round the lamp is the slowest stretch of road, where its regeneration fights the water girls |
| 3-10 | **The Ashen Warden** | Hollow Samurai GLB, charred, phasing; Lantern Bearers | the echo of its own Morning sanctum; the tear's pulse speeds the spectral escort |
| 4-10 | **The Frost Vanguard** | Orc Warlord GLB in frost iron, guardian; Alpha Wolf, Shieldbearers | its guardian aura covers both columns as they squeeze onto the one bridge |
| 5-10 | **The Reservoir Willow** | Elder Treant at miniboss scale, brood; Grave Priests | it walks the longer curl; its brood spills onto both causeways |
| 6-10 | **Gatekeeper Unit 01** | Iron Colossus at miniboss scale, crystal shell; Vesper Wardens | the double helix gives many small hits two passes; Chika switches it off in the scene after |
| 7-10 | **The Ember Champion** | Oni Champion GLB, three stances; Mirror Queen, Taiko Oni | the two half-moons put the stage (Kanna's drum) in the middle of both columns |
| 8-10 | **The Shadow at the Gate** | Eclipse Wyrm GLB at campaign tier; Cinder Wyverns; the shipped last-phase banner "The eclipse breaks — the Ashwing Matriarch tears free!" | three gates, one choke: the Night arrives through the Vesper lane; the freed mother circles as an ally |

**The Brigade's set piece (not an x-10):** the HAMMER Carriage drives the last wave of 7-9 down the short lane to the
back door (STORY §7.3). Its 33 % phase fires a ranging shot that leaves a black-violet tear on the back street, the
street the cold pours through in `g7.after`. The wave pays for it out of its elite budget (threat 160 ≈ the Orc
General), so 7-9 stays below 7-10 in total threat.

### 1.11 Variety audit

- **Topology spread:** 24 one-lane, 13 two-lane and 3 three-strand maps. Mid-board spawns on 3 maps (3-8, 5-6, 8-9).
  Tunnels on 13, a pass over the road's own earlier pass on 6 (1-10, 2-9, 5-8, 6-7, 6-9, 6-10), flat junctions on 2,
  two exits on 4, rooftops on 5, viaducts on 2, a roundabout on 1, lane barriers on 2.
- **Inside each act** every map differs from the others in lane count, crossing type or headline gimmick. Where two
  share a topology (3-8 and 3-10, 7-6 and 7-10: two lanes merging), one is born mid-board or wraps a stage.
- **Across acts** the closest pair is 1-9 and 4-7 (both an eye with a barrier); they differ in shape (a wide D round a
  basin against a snake round barricades) and in tone (a train going by against Azami's whistle).
- **Highest silhouette risk** (check first when authoring): 3-7 (an N), 6-6 (a shallow W), 7-6 against its twin's
  lambda, 7-8 against Moon Bridge. Each has a named fallback shape in the authoring brief: rotate or mirror the figure,
  or move the merge.
- **Faction spread** (§1.12): the Brigade on five maps (3-9 as a light wave, 4-8 and 7-8 on even waves, 4-9 and 7-9 as
  the lead), Vesperline's machines on nine (5-8, 5-9, all of Act 6, 8-9, 8-10), the Night on three (6-10's last waves,
  8-9, 8-10). No act has more than three lead families.

### 1.12 Factions by gate, act by act

Which gate each enemy comes from (STORY §4.5), and where it fights:

| Act | Lead families (≤ 3) | Petal Gate (the Emberfolk) | Noon Gate (Vesperline's machines) | Vesper Gate (the Night) | The Brigade (no gate) |
|---|---|---|---|---|---|
| 1 | slime, goblin | all five maps | – | – | dressing only: drones high overhead, airdrops on 1-10 |
| 2 | lizard, slime, goblin | all five | – | – | dressing: searchlights, the curfew |
| 3 | ghost (+ earlier) | all five | – (its tear opens at 3-10) | – | a light wave: Gnat spotter drones on 3-9, HAMMER's eyes |
| 4 | orc, beast, Brigade | 4-6 … 4-8; at home on the far side in 4-9 and 4-10 | – | – | 4-8's even waves (the strike column); the lead on 4-9 (the crossing) |
| 5 | ghoul, plant, machines | all five | out of the gate at 5-8; a few on 5-9 | – | dressing: search boats; the raid on Hilltop happens off the map |
| 6 | machines (+ stragglers) | stragglers drawn to the one warm window | all five | the first Rime Wisps on 6-10's last waves | none (Vesperline) |
| 7 | oni, fae, Brigade | all five | – | the cold only (7-9's rule) | 7-8's even waves (the cordon); the lead on 7-9 (the guns on the back street, the HAMMER Carriage) |
| 8 | dragon, machines, the Night | the Petal lanes: wild creatures panicked by the Night | the Noon lanes of 8-9 and 8-10 | the Vesper lanes of 8-9 and 8-10, and the Shadow at the Gate | allied from 8-7: van roofs, radar masts, searchlights, Herons overhead |

**The new defs outside the Brigade** (numbers before `hpScale`; the Brigade's eight are in STORY §7.3):

| Line | Def | Body | Rule | hp · speed · class · armour | First on |
|---|---|---|---|---|---|
| Vesperline's machines | Patrol Orb | construct cogling in white glass and cyan | none (plain fodder) | 35 · 1.05 · heavy · 0 | 5-8 |
| | Halo Drone | **new** construct variant `halo`: a floating glass ring with one cyan lens | blink (3 tiles every 5 s; slows and stuns interrupt it) | 30 · 1.0 · heavy · 0 | 5-8 |
| | Line Sentry | construct sentry | armour 4 | 70 · 0.7 · heavy · 4 | 5-8 |
| | Vesper Aegis | construct automaton | barrier 60 | 50 · 0.8 · heavy · 0 | 6-6 |
| | Lattice Shell | construct beetle | crystal shell (5 per hit for 10 hits) | 50 · 0.8 · heavy · 0 | 6-6 |
| | Vesper Warden (elite) | construct warden | barrier 200 + crystal shell | 300 · 0.6 · heavy · 0 | 6-8 |
| The Night | Rime Wisp | ghost wisp in frost violet, rime crystals | frost ward (`ward: 'frost'`: no slow, half frost damage) | 14 · 1.25 · spectral · 0 | 6-10 |
| | Rime Slime | slime drop in frost violet | frost ward (the one rule it copies) | 18 · 1.0 · light · 0 | 8-9 |
| | Night Wyvern (elite) | dragon wyvern in violet-black with rime | airborne + frost ward | 320 · 1.0 · scaled · 0 | 8-9 |

Every one uses only rules taught by its chapter (blink 5-2, armour 4-1, barrier 6-2, crystal 6-1, ward 2-4, airborne
8-1), and each is budgeted by `threat` like the def it stands in for (Patrol Orb as the Cogling, Line Sentry as the Iron
Sentry, Vesper Warden as the Prism Warden), so no stage's numbers move.

---

## 1b. The future gate

### 1b.1 Three gates, three hours

| Gate | Links | Its mouth on our maps | Look |
|---|---|---|---|
| **Petal Gate** (the fantasy gate) | Morning → Noon | the spawn of Acts 1-3, 4-6 … 4-8 and Act 7, and a lane of 8-10; its north mouth is the spawn of 4-9 (the Brigade's crossing) and the goal of 4-10 (the way home) | asphalt slabs and a bent sign leaning into a torn ring; violet-pink seams; petals and frost motes drift out (the creatures are running from the cold) |
| **Noon Gate** (the modern gate) | Noon → Evening | first as HAMMER's tear over the shrine (3-10); its settled mouth is 5-8's spawn, where Vesperline's machines step out; the cast's way into Vesperline before 6-6; a lane of 8-9 and 8-10 (machines again) | cyan-white seams in a ring of Vesperline glass shards turning slowly; frost breath; a cracked tile floor round it |
| **Vesper Gate** (the future gate) | Evening → Morning | the terminal at 6-10, a lane of 8-9 and 8-10 (the Night's Rimebound fall out of it); its Morning mouth is the shipped star rift on 8-4 | a white-gold ring of glass round a black-violet core: the Night inside it |

Not every spawn is a gate: Vesperline's own machines come out of **sentry bays** in their own city (hangar shutters
with red status lights, 6-6 … 6-9), the far north's natives come down the passes past a cairn (4-10; on 4-9 the cairn
is the goal), and the Brigade comes up its own roads (the far ends of 4-8 and 7-8, 7-9's town road) or through a gate
on purpose (4-9).

### 1b.2 How future maps enter the campaign: the options

| Option | What | Future maps | Cost | Story fit | Verdict |
|---|---|---|---|---|---|
| **A. A third act per chapter now** (x-11 … x-15) | every chapter gets five Vesperline stages | +40 | about Act II again (XL), and every chapter release grows by half | Vesperline is dead in Arc 1 and only revealed in Act 5; 40 maps of one ruined city would spoil the reveal and repeat one mood | **no** (reserve the ids, §5.1) |
| **B. The future inside Arc 1** | Act 6 is Vesperline; the Starfall Trial side stage; the Evening third of 8-9 and the Vesper lane of 8-10; future scarring on Act 5 (glass shards, the Noon Gate) | 5 + 1 side + 2 partial | the Vesperline kit (L, built once and reused by Arc 2), the viaduct (M), light-bridge and transit-pad looks (S) | exactly STORY.md | **yes (default)** |
| **C. A living-future act in Arc 2** | Arc 2's chapters (9 on) pair a Morning act (Hikari begins to flicker) with a living Vesperline act (Sensei as the new teacher) | 5 per Arc 2 chapter | the kit's living variant (S once the frozen kit exists) | Arc 2 is set in Vesperline years before its Fall | **yes (Arc 2)** |
| D. Future "paradox stages" sprinkled into Acts 1-5 | e.g. one Vesperline stage inside Act 2 | +2-3 | M each | breaks the Act 5 reveal ("Vesperline is Itomachi's future") | no |

**Default: B in Arc 1, C in Arc 2,** with A kept as a reserved slot for a later arc: once the future can be visited
alive, each chapter could gain an Evening act that tells the same chapter's story a third time.

### 1b.3 The future stages in Arc 1

| Stage | Map | Notes |
|---|---|---|
| 6-6 … 6-10 | the five Act 6 maps (§1.7) | the destroyed city; frost, glass, sentries |
| **`side-6-starfall`** | `vesper_starfall` · **The Starfall Deck** · 20×12 | the academy observatory's broken deck under a cracked dome, where Kohaku and Tsubaki promised to "guard the academy's night sky". Route **Orrery**: three-quarters of an outer ring, across a light-bridge onto an inner ring, three-quarters of it, and out along a spur that tunnels under the outer ring (1 path, 1 overpass, 1 tunnel). Gimmick: shards of the dome's star map fall as meteor zones (`forge_vents` · *Starfall*). Families: up to chapter 6. Difficulty: 6-10's numbers × 1.1. Opens on 6-10's first clear (`g6.epi`); its before and after scenes are the duo's bond scenes (STORY §8.7). Not in `CAMPAIGN_IDS` (§5.1) |
| 8-9 | `skies_three_skies` | one sector of three is Vesperline's frozen terrace |
| 8-10 | `noon_summit_stone` | the Vesper lane, where the Night arrives |

---

## 2. The twin rule

### 2.1 Default: new layouts in the modern grid

Thirty-three of the forty are new layouts. Why:
1. **The owner asked for a new story in new places** (a city, then a school, then the city destroyed). A creek-shaped
   road through a shopping street reads wrong: the city's language is straights, rounded corners, junctions, decks,
   tunnels and roofs, and the fantasy routes were drawn for meadows and shores.
2. **The gimmicks need routes built around them.** A level crossing needs a fork at a railway; rooftops need narrow
   blocks between two passes; a mid-board rift needs a lane that starts on the water.
3. **The tests already forbid traces** (silhouette IoU < 0.65 and the turning signature, `world.test.js:384` and the
   test after it), so a re-skin needs an exemption anyway.
4. **Reversed routes already exist** as the Reverse Route mode, with ribbons. A re-skinned route at higher numbers
   would feel like a mode, not a chapter.
5. **Doubling means doubling.** Act II at chapter *c+1*'s numbers on chapter *c*'s routes would make the second set
   of maps a difficulty setting.

### 2.2 The four "after" maps: the earlier map's ground, a new road

3-9 (3-6's ground), 7-6 (1-7's), 7-8 (1-6's) and 8-7 (4-7's) reuse the rows, buildings, canal and decor positions of
an earlier modern map and get a **new route** through them, because the destruction (or the lifted barrier) changed
the streets. The player sees the same street intact and then gone, and plays a different fight. Cost **S** each
instead of M: the ground, the decor and the thumbnail palette exist; only the paths, the rubble or vans, and the
balance are new. Each must pass IoU < 0.65 against its intact twin like any other map.

### 2.3 The three echoes: literal re-skins of Act I

| Stage | Echo of | Why it is the same place |
|---|---|---|
| **1-10** The Dry Fountain | 1-5 Blossom Court (`sakura_court`) | the plaza fountain is the Founders' Fountain basin; the letter Hikari dropped surfaced here (STORY P7) |
| **3-10** The Lakeside Shrine | 3-5 Inner Sanctum (`shrine_sanctum`) | the Hollow Samurai's "shrine that fell long ago" is this shrine, burning (STORY §5) |
| **8-10** The Summit Stone | 8-5 Matriarch's Nest (`peaks_nest`) | the same summit; its three lanes become the three gates |

They are the "Day rhymes" rule made playable, and each saves an M of authoring and gets a route already balanced for
a boss. **What is literal:** the rows (water and void tiles can only change where the story says, e.g. the dry
basin), the paths, the crossings, the tunnels. **What is new:** the theme, the decor, the rule, the waves, the boss.
**Data:** a field `echoOf: 'sakura_court'` on the MapDef; the silhouette and turning-signature tests skip declared
echo pairs, at most three, and only between maps of different eras. The stage card shows the Act I thumbnail as a
faint ghost behind the new one, and the first clear adds a line to the Captain's Journal: "We have been here before."

**Lean fallback** (only if a release runs late): the x-9 of that act becomes a route variant on the same act's x-7
ground (S instead of M), as §2.2 does. No further re-skins of Act I routes: an echo only works when the story says it
is the same place.

---

## 3. The theme kit

### 3.1 The looks

The modern era is **Itomachi**, Sensei's ordinary present-day city and school: warm, lived-in and bright. The future
era is **Vesperline**: clean white and glass, sky blue, holographic signs, and in Arc 1 only its ruins. The war-torn
variants are properly grim and still readable from the battle camera (§3.6).

| Era | Look | How it is made | Used by | Ground · road | Buildings | Light · weather |
|---|---|---|---|---|---|---|
| Noon | **`city`**, day | new `THEMES` entry (TECH §3.1 draft, warmed: tan, brick and terracotta walls, green awnings, more trees) | Act 1; 5-9, 5-10 | `paved` + painted kerbs · `asphalt` with dashed centre line | `cityBlock` (shop row, apartment with balconies, office, convenience store, clinic, police box) | day light; petals and paper litter on the wind |
| Noon | `city`, **night** | the stage's `night` + a per-theme `nightLight` (TECH §3.7) | 3-6 … 3-8, 5-10, Act 7 | as above | lit windows and signs as glow geometry | warm neon night |
| Noon | **Old Town district** | `MapDef.district: 'oldtown'` picks the builder set and road style | 3-6, 3-7, 3-9 | plaster and stone `setts` · `setts` road | `oldHouse` (wooden walls, tiled roofs that carry the `U` tiles), shop curtains | lantern strings |
| Noon | **highway district** | `district: 'highway'` | 4-6 … 4-8, 8-6, 8-7 | gravel verges · `concrete` with lane lines and rumble strips | toll booths, sound walls (border `H`), sign gantries | day, dusk; frost flurries |
| Noon | **`campus`** | new `THEMES` entry sharing the city props | Act 2, 7-9 | lawns (`grass`) and paved paths · `asphalt`, `brick` paths, `track` lanes (2-9) | `schoolBlock` (classroom wing, gym, clock tower, club hut) | night; fireflies by the lake |
| Noon | **`drowned`** | new `THEMES` entry | 5-6 … 5-8 | wet tile and concrete · `grating` walkways, platform edges | station boxes, retaining walls (border `H`), pump halls | fog; red and amber emergency glows |
| Noon | **`ruined: 'burning'`** | stage scenery flag resolved in `resolveLook` like `night` and `fog` (TECH §3.1), as a string | 3-9, 3-10 | ash-dusted paving, scorch and crack marks · the road stays the lightest band | `ruinBlock` (jagged tops, missing corners, fire in a window) | low warm key, dark orange-brown sky, smoke columns, embers, ash fall |
| Noon | **`ruined: 'after'`** | the same flag, second table | 7-6, 7-7, 7-8, 7-10 | cold grey ash, swept paths, tarps | `ruinBlock` cold, relief tents, scaffolding | night, cold blue key, warm lantern points |
| Noon | **`snowCover`** | stage scenery flag: whitens ground and roofs, snow weather | 4-8 (north half), 8-6 … 8-8 | snow over asphalt | as the district | thin cold dawn |
| Morning | `snow` + **Brigade dressing** | the shipped theme + scenery keywords (§3.3 Brigade kit) | 4-9, 4-10 | as shipped | frozen huts | snow |
| Evening | **`vesper`** + **`ruined: 'frozen'`** | new `THEMES` entry; `ruined` picks its frozen table | Act 6, the Starfall Deck | white glass panels, cracked (cracks painted cyan) · `glassway` (white panels with a cyan guide line) | `glassTower` (skirt), `podium`, `lectureHall` | eclipse dusk, a cold aurora, snow, frost haze |
| Evening | `vesper`, living | the same theme without `ruined` | Arc 2; the cliffhanger's still | clean white, sky blue | cherry trees in glass courtyards | bright morning, holo signs alive |
| all three | **era sectors** | `MapDef.ground: [{ type: 'eraSector', look, poly }]`: the ground painter paints each region with one look's ground and props from that look's table | 8-9 | three grounds on one canvas | from each era | three skies stacked in the backdrop |

The Oct 20 look test (`scratchpad/proto-city/`) reads well from the battle camera: kerbs, crosswalks and a lighter
road against the ground. Its clean white-and-glass palette is now **Vesperline's living look**. Itomachi needs warmer
materials (brick, timber, terracotta, signage, wires, laundry, more trees) and water on every map. Its destroyed
"surge" image is the base for `burning`, with three changes: a darker sky and skirt, smoke columns in the skirt, and
collapsed-tower silhouettes in the skyline.

### 3.2 Materials

| Kind | New entries | How |
|---|---|---|
| Ground styles | `paved` (TECH §3.2), `setts` (Old Town), `tile` (stations and platforms), `glass` (Vesperline panels with painted cracks and frost) | branches in `paintGround` / `detailTexture` (`textures.js:883`, `:1189`); test list `terrain-v2.test.js:17` |
| Road styles | `asphalt` (TECH §3.2), `track` (red lanes, white lane lines and numbers), `setts` (stone setts), `concrete` (highway lane lines, rumble strips), `glassway` (white panels and a cyan guide line), `grating` (reuse `metal`) | branches in `pathTexture` (`textures.js:1316`); 256 px greyscale tiles × `path.color` |
| Ground marks (0 draw calls, shared atlas) | `crosswalk`, `junctionBox`, `stopLine`, `platformEdge` (yellow tactile strip), `cracks`, `scorch`, `crater`, `frostCrack` | `AmbientSystem.drawMarks` (`ambient.js:338-362`) |
| Deck looks (`map.bridge`) | concrete flyover, steel footbridge, timber jetty, pontoon, military bridge-layer, pipe gantry, light-bridge (opaque glass deck with cyan edge glow), sky-rail girder | data on `look.bridge` / `map.bridge` (TECH §3.0) |
| Tunnel looks (`tunnel.style`) | `subway` (stairs and canopy), `highway` (concrete portal, jet fans, lamps), `corridor` (school ground floor), `station` (concourse hall), `boathouse`, `gallery` (museum wing), `snowshed` (open-sided), `service` (dam, weather station) | portal code `trackMesh.js:684-716`; halls `:590-629` |
| Water looks | canal (stone walls through `bank` / `shore`), lake, flooded track bed (near-black green), reservoir, open leads in ice (deep blue-black, ice as ground), hot spring (steam emitter) | `water.{deep, shallow, foam, glow}`; `life.koi` off in cities |

### 3.3 Props, by kit

All static props are **procedural** in the `props.js` pattern: boxes, cylinders and a few lathes with vertex colours,
merged into the `props`, `foliage` or `glowProps` mesh (one draw call each, however many there are), ≤ 6 variants
per builder, a `far` LOD for the skirt. Triangle counts are near-LOD estimates. Glow means unlit glow geometry;
"sprite" means an additive glow point (counted against the 250 budget).

**Street (Itomachi)**

| Prop | Variants | Tris | Glow / emitter | Placed by |
|---|---|---|---|---|
| `cityBlock` | shop row (awning, shutter, lit sign), apartment (balconies, laundry), office (glass bands), convenience store, clinic, police box | 100-250 + roof dressing 50-150 | signs and windows as glow geometry | interior `H`, height rule (TECH §3.5) |
| `cityTower` | skyline boxes 1.6-3.5 tall | 24-60 (far) | window bands at night | skirt |
| `cityWall` | retaining wall with hedge, construction fence | 40-110 | – | border `H` |
| `streetLamp`, `trafficLight` | – | 60, 70 | 1 sprite each; the signal cycles colour | pathside |
| `vendingMachine`, `busStop`, `billboard` | 3 each | 40-80 | glowing face | skirt, pathside |
| `parkedCar` | compact, van, mini truck, delivery cart | 60-90 | headlights at night | skirt |
| `roadCone`, `barricade`, `bollard`, `hydrant`, `mailbox`, `trashBin`, `bikeRack` | – | 16-60 | – | pathside, grass slots |
| `streetTree` | the `round` canopy in a square grate; cherry variant | 590 | – | `T` tiles (cap ≈ 25 near) |
| `powerPole` + wires, `planterBox`, `guardRail` | – | 30-60 | – | skirt, frame ring |
| `laundryLine`, `catOnWall`, `pigeonGroup` | the cute everyday layer | 20-30 | – | grass slots (`strays`) |
| `missingPoster` | pigeon, slime, parking-sticker, Doorie-sticker covers | 12 | – | decor (1-6, 7-8; the running gag) |

**Station, rail and canal:** `stationHall` (tunnel hall style), `ticketGates`, `platformCanopy`, `clockTower`,
`taxiShelter`; `railLine` (skirt track, sleepers as one strip), `levelCrossing` (arms, bell, lamps; reads the wave
for the barrier), `trainCar` (moving: **InstancedMesh**, ≤ 6 cars, one call), `waterBus`, `lockGate`, `canalSteps`.

**Arcade and Old Town:** `arcadeRibs` (glass frames only), `shopFront` (bakery, bookshop, bun stall, florist,
pharmacy, toy shop), `bunSteamer` (steam), `lanternString` (glow geometry; every fourth lantern a sprite),
`oldHouse` (wooden, tiled roof), `shopCurtain`, `stoneBasin`, `ringToss`, `bowStage`, `griddleStall` (the `stall`
prop with a hot plate glowing over its vent zone).

**Campus:** `schoolBlock`, `flowerBoxes` (the rooftop boxes Mahiru waters), `bikeShed`, `flagpole`, `goalPosts`,
`stands` (reuse), `scoreboard` (glow), `finishGantry`, `boatRack`, `oldLamp` (the wardstone lamp), `searchlight`
(sweeping disc drawn like cloud shadows: 0 calls), `clubHut`.

**Highway:** `tollBooth` (roof carries `U`), `signGantry`, `soundWall`, `jerseyBarrier`, `jetFan`, `restStopRow`.

**Brigade (our own organisation):** `sandbagPit` (the 4-9 beachhead), `droneDock` (status light), `searchlightTower`,
`tortoiseVan` (the armoured response van; its roof carries `U` in 8-7), `barrierArm`, `citationStand` (Azami's
clipboard on a post), `fieldTent` (reuse `tent`), `radioMast` (Channel 9), `pontoon` and `bridgeLayer` (deck looks),
`parachuteCrate` (the airdrop effect). These are dressing; the Brigade's units on the road are enemy models (§3.10).

**Drowned line and reservoir:** `platformEdge`, `stationStairs` (portal), `mosaicWall`, `sunkenTrain` (hero prop),
`emergencyLight` (red or amber sprite), `signalLamp`, `maintenanceCart`, `pumpUnit`, `pipeRun` (reuse `pipes`),
`valve` (steam over its vent zone), `damWall` (border), `spillwaySteps`, `bandstand`, `parkLamp`, `chainedBoats`,
`rescueBuoy`, the willow (reuse `willow`, large variant).

**Ruins:** `ruinBlock`, `rubble`, `burntCar`, `fallenPole`, `debris`, `gateCrystal` (the `crystal` decor in cold cyan
and violet, growing out of the asphalt near tears), `hammerTear` (black-violet glow geometry + a `debris` emitter),
`reliefTent`, `tarp`, `bucketChain`, `handPoster`, `scaffold`. Loss is told through objects people loved: a bus
shelter, a bakery awning, a school bag, a poster face down; never bodies (STORY §14).

**Festival (modern):** `danceTower` (with drums), `festivalStage`, `fireworksRack` (fireworks emitter), `waterStation`
(Wakaba's), bunting (reuse), paper lanterns (reuse).

**Far north crossing:** `frozenHut` (horned-family charms), `dyingFire` (a faint `campfire`), `villageHearth` (pad: a
stone hearth with a last glow), `sled`, `hotSpring` (steam), war banners (reuse), `stoneBridgePier`, `passCairn` (the
spawn of 4-10, the goal of 4-9), the Petal Gate's north mouth with sandbags (the spawn of 4-9, the goal of 4-10).

**Summit:** `radarDome`, `anemometer`, `antennaMast` (pad), `cableCar` (moving, InstancedMesh, ≤ 2), `weatherHut`,
`summitStone`.

**Vesperline:** `glassTower` (tall, skirt only; frozen mid-eclipse), `podium` (low, on the board), `lectureHall`,
`lightBridge` (deck), `skyRail` (viaduct deck, pylons, stranded pods), `holoSign` (glow geometry that flickers in dead
colours), `haloStatue` (weathered, a halo ring overhead), `doorieStatue` (a round, faceless lantern-carrying girl with
a keychain cast at her belt), `doorieBus` (abandoned, mascot livery), `transitPad` (glow), `prismBattery` (pad),
`sentryBay` (spawn: hangar shutter, red lights), `spindle` (the white tower; hero prop), `vesperTerminal` (the gate's
ring and console), `frozenFountain`, `frostedPane` (cracks as glow lines), `cleaningRobot` (moving, in the drones'
instanced pool), `vesperShelter` (one warm window), the frozen nest (reuse `nest` + ice).

### 3.4 Gates at the spawn and the goal

| Prop | Where | Build |
|---|---|---|
| `petalRift` | Petal Gate mouths in Itomachi | asphalt slabs, a lamp post and a bent sign leaning into a torn ring; violet-pink crack seams and a vertical portal disc as glow geometry; one sprite; a `debris` emitter (dark shards drifting in) plus petals and frost motes; `cracks` marks on the road round it |
| `noonGate` | 5-8, 8-9, 8-10 | a ring of slowly turning glass shards (one instanced group, ≤ 24), cyan-white seams, frost breath (the `steam` emitter tinted white) |
| `vesperGate` | 6-10, 8-9, 8-10 | a white-gold glass ring round a black-violet disc; the Night's cold falling out of it as dark snow |
| `hammerTear` | over 3-10's sanctum; healed scars on later maps | a jagged black-violet seam in the air, no ring, crackling sparks (`sparkle`) |
| `sentryBay`, `passCairn` | Act 6, the far north | not gates: where the city's machines and the north's natives come from |
| `shelterDoor` | the goal on Itomachi maps | Shelter 3's steel door with the shipped heart sign, so "what we protect" still reads as cute; variants: station shelter, school main door, school back door (7-9) |
| Petal Gate north mouth | the spawn of 4-9 (the Brigade's beachhead) and the goal of 4-10 | `petalRift` ringed with sandbags and a searchlight: the squad's way in, and everyone's way home |
| `vesperShelter` | the goal in Vesperline | a shelter door under a frosted canopy with one warm window |
| `summitStone` | the goal of 8-10 | the ward stone itself |

Selection is one line in `terrain.js:585` and `:592`: the torii keyword, else the stage's or theme's `spawnGate` /
`goalGate`; per-lane gates on three-lane maps come from `MapDef.gates: ['petalRift', 'noonGate', 'vesperGate']`.

### 3.5 Ambient life

| Look | Life (cute first) | Built from |
|---|---|---|
| `city` day | pigeons on wires, a cat on a wall, laundry swaying, shop flags, the traffic signal cycling, a train every 40 s on the skirt rail, a water-bus, paper litter and petals on the wind, Brigade drones crossing high | bird flock (lower, grey), petal particle with paper colours (`weatherColors`), a signal-cycle emitter, instanced train, drone flock |
| `city` night | lit windows and signs, vending machines humming, lamps throwing warm pools, searchlight sweeps | glow geometry, sprites, light pools (`ambient.js:303-311`), sweep discs |
| `campus` night | fireflies by the lake, a searchlight on the water, the clock face lit, futons glowing in the gym | `fireflies` on, sweep discs, glow geometry |
| Old Town festival | lantern strings swaying, steam from stalls, festival music | glow geometry with sway, `steam` emitters |
| `burning` | ash fall, embers, ≤ 6 smoke columns from the skirt, fire glows on ruins, a crow or two, a street lamp flickering, a stray cat in the rubble | snow particle in grey (slower), `smoke` / `embers` emitters, bird flock (black) |
| `after` | lanterns on burnt beams, relief-tent glows, cold breath, a bucket chain at the canal, the cat again | sprites, `steam` tinted white |
| `drowned` | dripping, ripples on the flooded tracks, emergency lights pulsing, a fox (scene) | rain ripples without rain, glow pulse |
| far north | snow, the hot spring's steam, a vast shadow crossing the board once a minute | snow weather, steam, a cloud-shadow pass |
| `vesper` frozen | snow, frost haze, holo signs flickering, a cleaning robot circling forever, a cold aurora, a sky-rail pod creaking | snow, glow flicker (a signal-cycle variant), instanced robot, backdrop |
| summit and three skies | wind-blown snow, cable car, the moon, three skies stacked | snow, instanced car, backdrop |

No traffic on the road: the road belongs to the enemies (TECH §3.8).

### 3.6 Grim, but readable

The destroyed looks must hurt and still play cleanly from the 48° battle camera:
1. **The road is always the clearest band on the board.** Ruined ground is darker and desaturated; the road keeps an
   ash-grey that is lighter than the ground in every look.
2. **Fire and smoke never sit on or over the road.** Fire glows only on `H` / `X` tiles at least 1.5 tiles from the
   centreline; smoke columns rise from the skirt and board edges and fade within 2 tiles of height.
3. **The sky goes dark, not the board.** The ruined key light stays ≥ 1.2; the darkness lives in the background,
   the backdrop and the fog colour.
4. **Enemy outlines and HP bars are untouched,** and fire is tuned amber-yellow so it never reads as an oni's red.
5. **The gate is the brightest thing on the map.**
6. **One accent per look:** amber for burning, cold blue-grey with warm lantern points for after, cyan-white for the
   frozen future.
7. **Contact-sheet check:** a greyscale screenshot at 844×390 still shows the road, the gates and every enemy.

### 3.7 The future kit in one paragraph

Vesperline at its height (Arc 2, and the cliffhanger's still): one great academy grown into a city on the lake, white
glass lecture towers, sky-rails running between them, light-bridges unfolding over the water, cherry trees in glass
courtyards, halos on the students, holo signs in sky blue, Doorie the round lantern girl on buses and lunch boxes, and
the Spindle glowing warm amber over everything. Vesperline in Arc 1: the same city frozen mid-eclipse. Glass cracked
and frosted, sky-rails broken mid-span with pods hanging, holo signs flickering in dead colours, halo statues weathered
faceless, snow drifting in the courtyards, fountains frozen in mid-splash, a cold aurora, sentries still holding a
line for no one, and one warm window in a shelter where a machine is still heating an empty room. Built on the same
props for both: `ruined: 'frozen'` swaps glass for frosted glass, lights for flicker, and adds snow, cracks and the
stranded pods.

### 3.8 Phone budget

High is the default on phones (`save.js:35-38`), so the budget is set for high. Per map's terrain (TECH §3.12):

| Item | Budget (high) | Budget (low) | Modern notes |
|---|---|---|---|
| Draw calls | ≤ 10 | ≤ 10 | ground, path, water, puddles, props, foliage, glowProps, overpassShadow, ≤ 2 floating set pieces; plus ≤ 3 instanced movers (train or cable car, drones and robot, glass shards) |
| Triangles | ≤ 90k | ≤ 65k | buildings ≤ 25k, street props ≤ 12k, trees ≤ 15k (≈ 25 near canopies), kerbs ≤ 4k (0 on low), skyline ≤ 15k |
| Glow sprites | ≤ 250 | ≤ 250 | festival nights are the risk (the shipped festival look reaches 223): lantern strings are glow geometry, every fourth lantern a sprite |
| Emitters | ≤ 40 | ≤ 40 | burning: ≤ 6 smoke columns and ≤ 12 fire glows; drowned: ≤ 8 drips |
| Transparency | 0 sorted transparent meshes | 0 | glass is opaque and tinted, with glow edges; holo signs are glow geometry; no real-time point lights |
| Textures | no new large ones | | one 256² road tile per style; marks in the shared atlas |

Estimates by look (to measure with `tools/measure.mjs` once built): `city` 70-85k; `campus` 70-80k (lawns are cheap,
cherry trees are not); Old Town 80-88k (many small roofs); `burning` 75-85k; `drowned` 50-60k; `vesper` 65-75k (the
towers are far LOD); era sectors 80-88k.

### 3.9 How each piece is built

- **Procedural (default, everything static):** the `props.js` pattern, merged per material, cached per (type, theme,
  day/night, variant, LOD). Hero set pieces are procedural too: the station concourse, the boathouse, the sunken
  train, the Spindle, the Doorie statue, the summit stone. This keeps one art style and keeps the height rule under
  our control.
- **InstancedMesh (≤ 64 each, one call): only for things that move every frame.** Trains, the cable car, drones, the
  cleaning robot, the Noon Gate's glass shards.
- **CC0 kits: not needed.** Allowed only for vehicles (cars, vans, buses, train cars) if the procedural boxes look too
  plain: a public-domain (CC0) low-poly pack, decimated to ≤ 300 triangles, recoloured to the palette, baked to vertex
  colours and merged like any prop, with the licence recorded in a credits file. Never for buildings.

### 3.10 Enemy models: the one exception to "no new monster models"

Every boss and every new def in the arc is drawn on an existing family GLB, with one exception: **the Brigade** is a new
family and needs its own model kit. It is built exactly like today's monsters (`tools/blender/enemies/`, the "Enemy
models V2" section of `docs/MODELS.md`): quad cages, subsurf, painted faces, toon and outline, one rigged GLB per family.

| Piece | What | Size |
|---|---|---|
| `families/brigade.py` (new) | the base body is the **trooper**: the chibi biped from `bodies.py` with a visor helmet, padded jacket, shoulder pads and big boots (`main` = navy, `accent` = amber). Variants hide the biped, as the construct's cogling does: `gnat` (a ball drone with four rotor rings and one lens), `tortoise` (six-wheeled van, domed roof, searchlight), `badger` (tracked light tank, turret, dozer blade), `strider` (keeps the legs; a cockpit bubble and a shield dish replace head and arms), `hammer` (eight-wheeled carriage, turntable barrel, stabiliser legs). A `heron` variant waits for Arc 2 | target ≤ 260 KB (goblin, the family that already carries a vehicle-sized machine, is 283 KB); test cap 320 KB |
| new props (`props.py`) | `visor`, `riotShield` (opaque pale blue with an amber stripe: no transparency), `carbine` (a stubby rifle of our own design, never a real-world model), `foamTanks`, `searchlight`, `rotors`; reused: `backpack` (the radio), `helmet` | inside the family file |
| face atlas (`efaces.py`) | `visor` eyes behind the helmet glass; the `dead` cell is the **visor gone dark** (no eyes at all), never crossed-out eyes on a person; the Gnat's face is a tiny screen that reads LINK LOST | – |
| clips (`eanim.py`) | move `run` (vehicles are weighted to the body, so the run's bob reads as a rumble), hit `recoil`, special `cast` (shields up, foam spray, HAMMER's brace), and **no new death style**: a beaten trooper uses the shipped fall-and-fade like every enemy, with the homeward sparkle switched off for this family (first light is not taking him anywhere), and nothing stays on the road. Optional (S): per-variant clips (`move@gnat` hover, `move@tortoise` roll, `death@badger` breakdown), picked by `glbEnemy.js` when they exist | – |
| battle FX (render only) | `breakdown` for the machines (a steam puff, sparks and a scatter of scrap that fades with the body) and the Gnat's `sparkFall` (it drops and breaks apart; reuses the `sparkle` emitter); no blood, no wound decals, no wreck left on the road | – |
| fallback | a V1 procedural stand-in (a box trooper, a box van) for node and offline, as every family has | – |
| Vesperline's machines | one new variant on the shipped construct GLB, `halo` (the Halo Drone: a floating glass ring with one cyan lens); every other machine is a tint (white glass, cyan) on a shipped construct body | ≈ +10 KB on `construct.glb` (181 KB today) |
| the Rimebound | tints (frost violet) and the shipped `crystals` prop as rime on the wisp, slime and wyvern bodies | 0 |

**Budget.** The twelve family GLBs total 2.27 MB today (2,265,988 bytes) against the 2.5 MB cap in
`tests/models/enemies.test.js:18`. The Brigade (≈ 0.26 MB) and the halo variant take it to ≈ 2.54 MB, so the total cap
rises to **2.8 MB**; the 320 KB per-family cap stays. Family GLBs load per stage (`preloadEnemies(families)`), so the
Brigade file only downloads on stages that field it, and on screen a Brigade unit costs what any monster costs: a body
and an outline (+ glow). Tests that move: the manifest and per-family checks pick up `brigade.glb` by themselves through
`FAMILY_ORDER`; `FAMILY_IDS` in `tests/data/world.test.js:41` gains `brigade`.

**Look rule.** Our own city responders, never a real army: navy and amber, white visors, the Brigade's gate-ring emblem,
no camouflage and no flags (owner question Q23 offers a more military look). **Effort:** M for the whole kit (one
enemy-model workflow with a lineup render and a critic pass), S for the halo variant, XS for the Rimebound tints.

---

## 4. Rollout

### 4.1 Steps

Sizes: XS under a day, S one or two days, M about a week (one builder workflow), L two to three weeks.

| Step | Contents | Maps | Engine (co-op) | Effort | Gates |
|---|---|---|---|---|---|
| **0. Prerequisites** | energy and reset (#134); the owner's balance model (D14, D15); Halloween live first (#209) | – | – | – | – |
| **1. Infrastructure + Act 1** | Act II data (TECH §5.3 A1-A15), unlocks and the two-row campaign screen (B), reward and achievement fixes (C), story-queue sort by (chapter, act, index) (D1); the `city` look v1 (paved, asphalt, kerbs, crosswalks, ≈ 25 street props, `petalRift`, `shelterDoor`, city ambient); **rooftops** and the **lane schedule**; the echo exemption; per-stage rule skins; 5 stages, the Frostbitten Heir, Act 1's 7 scenes | 5 | rooftops [sim, M], lane schedule [sim, S]: data and sim hash change | **L** | Easy-gate bot run on 1-6…1-10; a v0.1.26 save keeps every unlock; the IoU and turning tests; owner playtest |
| **2. Act 2** | `campus` look, `nightLight`, `track` road, blackout dimming; 5 stages, Old Lamp-Hugger, Act 2's scenes | 5 | render only: data hash | M+ | same gates; ≥ 60 water tiles on all five |
| **3. Act 3** | Old Town district, `ruined: burning`, the mid-board rift, the tear; 5 stages (one on 3-6's ground, one echo), the Ashen Warden; **the Brigade kit** (all eight units in one family GLB, §3.10, built by the enemy-model workflow in parallel with Step 2; only the Gnat spotters ship here), the trooper fall (the shipped fade, homeward sparkle off) and the breakdown FX, Brigade barks | 5 | rift [render+test]: data hash; the Brigade is art + data only (existing rules) | M+ (+ the kit, M, in parallel) | the contact-sheet greyscale check (§3.6); a Brigade lineup render and critic pass |
| **4. Act 4** | highway district, Brigade dressing kit, far-north dressing; 5 stages (4-9 runs from the gate to the camp), the Frost Vanguard; Azami joins after 4-7; Brigade defs: Response and Shieldline Troopers, the Tortoise, the Badger | 5 | render only | M+ | as above |
| **5. Act 5** | `drowned` look, the subway spawn, the Noon Gate look, the park kit; 5 stages, the Reservoir Willow; Vesperline's first machines out of the gate (Patrol Orb, Line Sentry, and the Halo Drone on the new `halo` variant) | 5 | subway spawn [render]: data hash | M+ | as above |
| **6. Act 6** | the Vesperline kit (frozen and living tables), the **viaduct**, light-bridge, sentry-bay and transit-pad looks; 5 stages + `side-6-starfall`, Gatekeeper Unit 01; the rest of the machines (Vesper Aegis, Lattice Shell, Vesper Warden) and the Rime Wisp | 5 + 1 | viaduct [sim, M]: data and sim hash | **L** | perf measure on a mid phone (glass and snow) |
| **7. Act 7** | `ruined: after`, festival-modern kit, the **roundabout**, two-door goals; 5 stages (two on Act 1 ground), the Ember Champion; Wakaba joins after 7-7; Brigade defs: the Foam Trooper, the Strider and the HAMMER Carriage (with the tear decal on its ranging shot) | 5 | roundabout [sim, M]: data and sim hash | M+ | as above |
| **8. Act 8** | `snowCover`, summit kit, era-sector ground, three gate looks per lane; 5 stages (one on 4-7's ground, one echo), the Shadow at the Gate, the finale and the cliffhanger; the Rime Slime and the Night Wyvern; the Brigade as allied dressing (van roofs, searchlights, Herons overhead) | 5 | render only | M+ | full-arc read-through of every scene in order |

**Total:** about XL (two L steps and six M+, plus the Brigade kit, M, in parallel). Art for 41 maps and 8 bosses sits
inside each step, on existing GLBs; the one new enemy model is the Brigade kit (§3.10). If the owner keeps the Brigade to
hazards only (Q20), the kit is not built; if the Brigade is in every modern act, the kit moves to Step 1.

### 4.2 The co-op update each release forces

- **Every step changes the co-op data hash**, because `MAPS` and `STAGES` are hashed (`src/online/coop/version.js:15-16`,
  `:53`): old and new clients cannot pair. Bundle each step with another change that already forces a co-op update,
  and never ship one during a live event week.
- **Steps 1, 6 and 7 also change the sim hash** (rooftops and the lane schedule; the viaduct; the roundabout:
  `tools/simId.mjs:19-27`). Render-only looks never split players (`tools/simId.mjs:6-9`).
- **`COOP_PROTOCOL` stays at 5:** no message changes shape (a rooftop placement is the same place message with an
  `x, y` on a `U` tile).
- **New enemy defs** (the bosses, the Brigade, Vesperline's machines, the Rimebound) ride the data hash (`ENEMIES` is
  hashed, `version.js:53`) that every step moves anyway. The Brigade adds no sim code, because every rule it uses
  already exists, so it never moves the sim hash.
- Act II appears in co-op by itself (`coopStages` lists `CAMPAIGN_IDS`, `src/data/coop.js:83-84`); the side stage
  does not, unless added on purpose.
- **Option:** pair Acts 4+5 and 7+8 into single releases (10 maps each) once the kit is stable, to halve the number of
  co-op splits. Default: one act per release, because each act ends on a story beat worth its own week.

### 4.3 Rewards

Per WHAT_ELSE §2.5's default ("half"), so Act II adds value without becoming the best farm:

| Reward | Per Act II | Arc 1 total |
|---|---|---|
| Medal gems | 110 per stage (10 / 20 / 30 / 50) → 550 per act | 4,400 gems |
| x-10 first clear | 100 + 20*c* gems + 1 recruit ticket (like x-5) | 1,520 gems + 8 tickets |
| First-clear coins and books | `campaignFirstClear(c)`: 1,500 + 500*c* coins + rare books per stage | ≈ 150,000 coins |
| Drops and energy | chapter *c+1*'s table and price (chapter 8 keeps 8's) | – |
| Achievements | "Chapter *c* · Act II complete" at half value; "80 campaign stages" goals; reword the "all 40" goals | ≈ 850 gems |
| Story | every Arc 1 episode is kind `event`, 0 gems (STORY Q8 default) | 0 |
| **Cosmetics (new, no gems)** | each x-10 first clear unlocks that act's stage still as a lobby background and a profile title: *Rush Hour Regular*, *Night Watch*, *We'll Keep the Watch*, *A Very Good Booth*, *Channel 9, Keep It Open*, *Upstream*, *Hydrate!*, *A Very Long Wall* | 8 backgrounds, 8 titles |

---

## 5. Room to grow

### 5.1 Ids and slots that never renumber

| Range | What | Status |
|---|---|---|
| `c-1 … c-5` | Act I · the Morning (fantasy) | shipped, never touched |
| `c-6 … c-10` | Act II · the Noon (modern) | this plan |
| `c-11 … c-15` | **reserved:** Act III · the Evening, for a later arc that revisits each chapter in living Vesperline | empty |
| `9-1 …` | Arc 2's chapters, each with its own acts (default: Act I in the Morning, Act II in living Vesperline) | Arc 2 |
| `side-<c>-<slug>` | side stages: kind `side`, not in `CAMPAIGN_IDS`, their own `requires`, drawn as a small card after their `anchor` stage (e.g. `side-6-starfall`, anchor `6-10`) | from Step 6 |

What makes this safe: every stage carries `act` (1 / 2 / 3), `finale` and an explicit `requires`, and every list is
sorted by (arc, chapter, act, *n*), not by position in an array (TECH A1, A4, B2, B3, D1). The campaign screen draws
one row per act, so a chapter can show two rows today and three later; Arc 2 chapters sit behind an arc tab. New side
stages, events and "memory stages" (replay an echo pair in the other era) slot in with an anchor and change nothing
else.

Map room: Arc 2 needs the living `vesper` look (an S once Step 6 exists), Itomachi rebuilding (the `city` look with a
`scaffold` table), and the "Fractured Gates" endgame, which reuses 8-9's era-sector ground. The modern and future
looks also suit Bounty and Total Assault arenas later.

### 5.2 Where the cutscenes trigger

From STORY §11, placed on stage ids. `before` plays when the stage is opened, `after` on the first clear, in the order
listed. **Main** episodes carry the plot; **join** episodes add a free girl; side scenes are optional (*ifUnit* ones
wait for that girl). One content note plays before `g1.pro`: "This arc contains war and loss."

| Act | Stage | Before | After |
|---|---|---|---|
| 1 | 1-6 | `g1.pro` Two Sunrises | `g1.mahiru` You Came Back |
| | 1-7 | – | `g1.yuzuha` Deploying (join) |
| | 1-8 | `g1.mid` Hot Case | side `g1.poster` Missing |
| | 1-10 | `g1.boss` The Dry Fountain | `g1.epi` First Silence |
| 2 | 2-6 | `g2.pro` Exchange Students | sides `g2.kohaku` The Most Boring Object in the City → `g2.thirtyone` Thirty-One |
| | 2-7 | – | side `g2.lunch` Lunch Debt |
| | 2-8 | `g2.mid` Static | `g2.boiler` Something Small (third main scene) |
| | 2-9 | – | sides `g2.class` (*ifUnit*), `g2.roof` |
| | 2-10 | `g2.boss` Cats on a Stove | `g2.after` Roll Call of Static → `g2.epi` Night Tea |
| 3 | 3-6 | `g3.pro` Bowing Contest | – |
| | 3-7 | – | side `g3.iroha` (*ifUnit*) |
| | 3-8 | `g3.mid` Fog on the Water | **`g3.hammer` Hammer** (the turn) |
| | 3-9 | – | side `g3.noa` (*ifUnit*) |
| | 3-10 | `g3.boss` The Ashen Warden | `g3.after` Roll Call → `g3.epi` Two Fires → side `g3.fuu` (*ifUnit*) |
| 4 | 4-6 | `g4.pro` No Running on My Road | – |
| | 4-7 | – | `g4.azami` Across the Barrier (join; carries the parley) |
| | 4-8 | – | **`g4.cross` The Other Side** (new: the crossing, moved out of `g4.boss`) → side `g4.logs` |
| | 4-10 | `g4.boss` (trimmed to the Frost Vanguard beat) | `g4.after` The Bridge → `g4.epi` Gates Bloom |
| 5 | 5-6 | `g5.pro` Lost Already | – |
| | 5-7 | – | side `g5.embers` The Keeper's Night |
| | 5-8 | `g5.mid` Two from the Fog | `g5.raid` Specimen 0 |
| | 5-9 | – | side `g5.whiteboard` The Long Day |
| | 5-10 | `g5.boss` The Register | `g5.after` Already Written → `g5.epi` Two Cups → side `g5.board` |
| 6 | 6-6 | `g6.pro` Hold Hands | – |
| | 6-7 | – | side `g6.sleep` Four in the Morning |
| | 6-8 | `g6.mid` Museum of Noon | `g6.chair` The Empty Chair |
| | 6-10 | `g6.boss` The Last Recording | `g6.after` Flicker → `g6.epi` A Long Life → side `g6.doorie`; opens `side-6-starfall` |
| | side-6-starfall | the duo's first bond scene | the duo's second bond scene |
| 7 | 7-6 | `g7.pro` Festival in the Ruins | – |
| | 7-7 | – | `g7.wakaba` Hydrate! (join; carries the wrong-door plan) |
| | 7-8 | `g7.mid` Same Sunrise | side `g7.fuu` (*ifUnit*) |
| | 7-10 | `g7.boss` The Parade | **`g7.after` The Back Door** → `g7.epi` Doorie → side `g7.azami` |
| 8 | 8-6 | `g8.pro` Stay Behind Me | side `g8.water` Ask the Water |
| | 8-7 | **`g8.mid` Unarmed** (moved from before 8-8) | side `g8.banner` Kinu's Banner |
| | 8-8 | – | side `g8.storm` (*ifUnit* Seiran) |
| | 8-9 | – | side `g8.tune` Mori's Tune |
| | 8-10 | `g8.boss` The Shadow at the Gate | `g8.after` First Light, Twice → `g8.epi` She Was Mahiru → **`g8.end` Come Earlier** (the cliffhanger) |

**Six cutscenes per act, joins included** (45 main + 3 join = 48), plus 21 side and 2 bond scenes. Free slots left for
later scenes (bond scenes, Arc 2 seeds, new girls): after 1-9, 3-6, 4-6, 4-9, 5-6, 6-9, 7-6 and 7-9, plus every
*before* that is empty. Every new map also gives its scenes a free background (`stage:<id>` stills).

The map gameplay plants clues too. In 7-9 the last waves' elites, the Brigade's Badgers and then the HAMMER Carriage,
take the back-door lane, and its ranging shot tears the back street (the player may notice where the danger really goes
before the twist); in 1-10 and 3-10 the echo ghost on the stage card says "We have been here
before"; 6-10's grey wool in the ice pays off in Act 8.

### 5.3 In-battle radio lines (more story, no more episodes)

A stage may carry `radio: [{ wave, speaker, line }]`: a Channel 9 line shown in the existing toast style at a wave's
start, two to four per stage, UI only (it rides in `STAGES`, which every release already changes). Examples: 1-9 wave
6, Mori: "Channel 9. Train coming through. Mind the barrier."; 4-7 wave 3, Azami: "Gate's shut. Long way round. No
running."; 7-9 wave 27, Kohaku: "Still decoding. Give me an hour."; 6-8 wave 10, Tenka: "The grid is older than your
city. Probably." The scene rules (8-18 lines, Hikari speaks) do not apply to radio lines; the spoiler rules (STORY §5)
do.

With the Brigade on the road: 3-9 wave 6, Hikari: "Those drones are HAMMER's eyes. Ground them. Gently."; 3-9 wave 12,
Mori: "Channel 9... very bad reception tonight. Very bad."; 4-8 wave 2, Kuroe: "All units, push for the gate. The
parley is over."; 4-8 wave 4, Hikari: "Then we hold the tunnels. Both ways."; 4-8 wave 12, Kohaku: "Captain? The
troopers don't sparkle. ...Why don't they sparkle?"; 4-9 wave 1, Azami: "Anyone who runs, we let run. Captain's orders."; 4-9
wave 25 (the first Badger), Hikari: "Not the hearths. Not the children. ...I'm sorry."; 5-8 wave 4, Tsubaki: "Those
are ours. They're still holding the line."; 5-8 wave 9, Tenka: "The line is wherever the gate is."; 7-8 wave 2,
Kuroe: "Cordon, hold the ticket gates. Sound off every wave."; 7-8 wave 10, Wakaba:
"Hydrate! Even the Brigade! Especially the Brigade!"; 7-9 wave 30, Mori: "HAMMER's on the back street. ...I'm sorry.";
8-7 wave 3, a trooper on a van roof: "Sorry about before. ...Where do you want me?"; 8-10 wave 1, Kuroe: "All units.
Hold the road with them."

**Brigade barks** (UI only, like the radio lines): a short callout over a Brigade group when it spawns ("Contact
front!", "Tortoise rolling!") and over a unit when it is beaten ("Trooper down!", "Close up!", "Fall back!", "Crew
out!"), and "Sorry! Sorry!" over the last trooper of a group still on the road; at most one on screen at a time, from the list in
STORY §7.3. No bark describes a wound.

---

## 6. Owner questions (each has a default)

1. **Echoes.** Three Act II maps are literal re-skins of an Act I map because they are the same place (1-10, 3-10,
   8-10). *Default:* yes, with the ghosted Act I thumbnail on the stage card. *Alternative:* all 40 new.
2. **Rooftops in the first release.** Five maps use them; they are new simulation code. *Default:* ship them in Step 1
   with the fallback (the roofs become ordinary lots). *Alternative:* first use in Act 3 (Old Town).
3. **A third act per chapter later.** *Default:* reserve `c-11 … c-15` for an Evening act after Arc 2; no future act
   per chapter in Arc 1.
4. **Release size.** *Default:* one act (5 maps) per release. *Alternative:* pair Acts 4+5 and 7+8.
5. **How grim.** *Default:* the rules in §3.6 (smoke and fire round the board, never over the road; a dark sky, a lit
   board). *Alternative:* darker boards, at some cost to readability on small phones.
6. **Scene moves** (§0.2): the crossing scene before 4-9, Azami's barrier scene before 8-7, and the two folds that keep
   every act at six cutscenes (the parley inside Azami's join, the wrong-door plan inside Wakaba's). *Default:* yes.
7. **The back-door foreshadowing in 7-9** (the last waves' elites, now the Brigade's guns, take the back-door lane; a
   watering can on the back stairs). *Default:* yes; it is quiet enough to miss and clear enough to remember.
8. **Brigade soldiers** (owner page Q19). **Answered Oct 20: a full lethal war, no gore** ("It can be a full lethal
   war!!"). On the road a beaten soldier falls and fades out like any enemy and nothing stays behind; machines break
   apart (STORY §14, §15). No map changes: the same eight units fight on the same five maps. The KO rule is withdrawn
   and stays only as the page's other option.
9. **How much Brigade** (Q20). *Default:* the main enemy on 4-8, 4-9, 7-8 and 7-9, a light wave on 3-9, allies from
   8-7. *Alternatives:* in every modern act except Vesperline (the kit moves to Step 1); only as hazards (no new model).
10. **The Brigade's boss** (Q21). *Default:* the HAMMER Carriage on 7-9's last wave. *Alternatives:* Kuroe's command
    van; no Brigade boss.
11. **The gunship** (Q22). *Default:* held back for freeplay and Arc 2 (flyers arrive at 8-1); allies overhead in Act
    8. *Alternatives:* a low-hovering Heron in Act 7; a flying Heron in Act 7.
12. **How military the Brigade looks** (Q23). *Default:* navy and amber city responders, no camouflage. *Alternative:*
    a full modern army look, still with our own emblem and never a real army or flag.
