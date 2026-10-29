# Gate Arc · Step 6 build plan

Written Oct 28, 2026 against `feature/gate-arc` at the end of Step 5 (head 8585c8d7; sim id `04df91a11220` held by
`PENDING_BUMP` on protocol 10; data hash `0652c02a`; 74 maps, 84 stages, 65 campaign ids, 87 campaign enemies (91
defs with the four freeplay giants), 9 minibosses, 75 scenes, 134 achievements). The approved spec is
`docs/specs/GATE_ARC.md` (§3.4 the Noon Gate's faction, §8.7 Kohaku and Tsubaki, §8.8 Tenka, §9-§10 the clue ladder,
§11 Act 6, §12 the Act 6 scenes and `side-6-starfall`, §13 Gatekeeper Unit 01, §14, §15, §17 rows 6-6…6-10 and the side
stage, §18.1-§18.9 the `vesper` kit, §19 Step 6, §20, §22) with `docs/specs/gate-arc/MAPS.md` §1.7, §1b.3 and §1.12,
`STORY.md` §11 Act 6 and `TECH.md` §4.2. This plan covers Step 6 only: the Vesperline kit (frozen and living), the
**viaduct** (a sim feature), the light-bridge, sentry-bay and transit-pad looks, the rest of the machines, the Rime
Wisp, Gatekeeper Unit 01, Act 6 "Vesperline" (6-6…6-10), the side stage `side-6-starfall` and the phone perf measure.
Nothing here ships; the coordinator folds finished steps into a release that takes the next free `COOP_PROTOCOL` at
ship time (main is on 10).

Rules for every builder session are Steps 1-5's unchanged: push only `feature/gate-arc`, no force pushes or history
rewrites, no bare `git stash`, temp files in the session scratchpad, `rm -rf dist` after a build, ≥ 1.5 GB free, no
other games' or anime names, Sensei never gendered and never romantic, students never sexualised, no gore (Kohaku is
*trapped and pulled out*, never hurt; Tsubaki *flickers*, she is not harmed; the Commander is a recording),
**no new or edited 3D models or GLBs** (owner: "don't touch 3D models; enemy rebuild later"; "content before
anything"), **never bump `COOP_PROTOCOL` on this branch** (`PENDING_BUMP` in `tests/art/itemArtRuntime.test.js`
follows the sim id on protocol 10: `{ 10: '<id>' }`). Every milestone: independent reviewer OK (≤ 3 fix rounds), hash
log `docs/specs/gate-arc/STEP6_HASHES.md` (the builder creates it with the plan row below), owner boards
`docs/review/gate-arc/step6/` (labelled JPEGs ≤ 400 KB).

(An uncommitted `@dawn` story-time change from another session was on the tree at plan time; nothing here needs it.)

### Expected hash moves

| Milestone | Sim id | Data hash | Why |
|---|---|---|---|
| plan row | `04df91a11220` | `0652c02a` | Step 5's verify row (COOP 10) |
| S6a | **unchanged** | **unchanged** | render, previews, backdrops, fall styles and tests only (`THEMES.vesper`, the frozen and living tables, the sky-rail / light-bridge / sentry-bay / transit-pad / Vesper Gate / Spindle looks, `rime_` fall style). A done-when check |
| S6v | **changes** | **unchanged** | the viaduct: `src/core/track.js` is in the sim graph (`src/sim/path.js` imports it). No shipped map uses the new markers, so every MapDef (and MAPS in the data hash) stays byte-identical: the new tracks golden proves it |
| S6b | changes | changes | six maps in `maps.js` (5 + the side map); 6-7 is the first map with a viaduct |
| S6c | changes | changes | 6 stages (5 + `side-6-starfall`, kind `side`), 6 rule placements, 5 enemy defs, `CHAPTERS[5].act2*` |
| S6d | unchanged vs S6c | unchanged vs S6c | story data and UI sit outside the sim graph (verify with `tools/simId.mjs`) |

S6a and S6v are independent (run them in parallel worktrees, as S5a ran beside S5b/S5c); S6b needs S6v; S6c needs
S6b; S6d needs only the stage ids and can start once S6c's stage table is fixed.

---

## 1. What Steps 1-5 already give us (reuse, do not rebuild)

| Need | Where it is |
|---|---|
| City kit, kits per theme, looks | `src/render/city/*`; a theme sharing the city kit with its own set (`campus`, `drowned`: `city.kit`); `resolveLook(theme, scenery, stageLook, map)` with the `ruined: 'burning'` table (`BURNING`) as the pattern for a second table; `look.blackout` (`src/render/blackout.js`, glow `keep` / `pulse`) |
| Decks and elevation | crossing modes (`applyCrossings`), `track.elev` (≤ `BRIDGE_HEIGHT` 0.62), `track.under` (hidden by the renderer, still targetable); `buildDecks` slabs any run with `elev > 0.015` and keeps piers off the lower road; deck looks by data (`map.bridge`); automatic water decks |
| Gates | `map.city.spawnGate` (`noonGate`, `petalRift`), `shelterDoor` variants, the subway mouth; one instanced mover per board (the Noon Gate's shards) |
| Rule decals | `src/render/ruleDecals.js` draws the `shifting_stars` rift points (`portals.at`, `at + jump`), vent rings, pads |
| Readability | `EnemyDef.line`, the boss-bar peek, `fallStyles.js` (`sparkle`, `fade`, `sparkFall`, `breakdown`; `vesper_` prefix → break apart in the def's accent) |
| Act II stages | `ACT2_PLAN` rows 6-6…6-10 (below), `act2Stage`, `CHAPTERS[5].act2*`, `ACT2_MECHANIC` (`src/ui/text/acts.js`), `STAGE_RULE_SKINS` |
| Story | `g1`…`g5`; `ACT_SCENE_IDS`; the absence and mystery lints; `stage:<id>@dusk|@night`; `PLACE_VARIANT` skylines; mid-scene `cue({ bg })`; NPC plates. Tenka is a unit since v0.1.57 and speaks as herself; Tsubaki and Kohaku stay plates (`{name:…}` tokens) |
| Measurement | `tests/render/terrainHash.js` (terrain budget rows), `e2e/solo-freeplay-perf.mjs` (rAF frame times, a fixed board via `ui.act.place`), `renderer.info` (`calls`, `triangles`), the scratch map checker (radius, bends, crossings, IoU top 3, signature, meander), the `zz_bal` balance pattern |
| Description check | `tests/data/descWaves.test.js` ("<enemies> from wave N" and "… come first" against `generateWave`) |

`ACT2_PLAN` for chapter 6 (computed, not typed): `hpPass` 1.77 on every row; drops and Ironclad read chapter 7.

| Stage | Waves | hpScale | cashScale | startCash | Tier | requires |
|---|---|---|---|---|---|---|
| 6-6 | 28 | 7.47 | 2.37 | 850 | intermediate | `['6-5', '5-10']` (two-key) |
| 6-7 | 28 | 7.84 | 2.44 | 860 | advanced | 6-6 |
| 6-8 | 29 | 8.23 | 2.51 | 860 | advanced | 6-7 |
| 6-9 | 29 | 8.62 | 2.59 | 870 | expert | 6-8 |
| 6-10 | 30 | 9.04 | 2.66 | 870 | expert | 6-9 (finale) |
| `side-6-starfall` | 30 | 9.94 (6-10 × 1.1) | 2.66 | 870 | expert | `'6-10'` (not in `ACT2_PLAN`; its own builder, §6) |

---

## 2. Decisions this plan makes where the spec is silent (or where the owner overrides it)

1. **Every new enemy is data on a shipped GLB (owner override of §18.9).** No `halo` variant (still deferred from
   Step 5), no new construct variant, no new ghost prop. The shipped `construct.glb` has variants `automaton, beetle,
   cogling, colossus, sentry, warden` and props `chimney, crystals, gears, helmet, shell, shield`; `ghost.glb` has
   `bearer, samurai, wisp, wraith` and `candle, chains, helmet, hood, lantern, mask, sword` (**no `crystals`**: §17's
   "rime crystals" and §18.9's "the shipped `crystals` prop" for the Rimebound do not exist on the ghost body, so the
   Rime Wisp ships as a tint with an outline and no prop). Deferred art: the `halo` construct variant, rime crystals on
   the ghost wisp, a Vesperline-only machine body for the enemy rebuild.
2. **Machines stay Constructs, the Rime Wisp is a Ghost.** `FAMILY_IDS` stays 13. Ids carry the faction:
   `vesper_lattice_shell`, `vesper_aegis`, `vesper_warden`, `vesper_gatekeeper` (construct), `rime_wisp` (ghost; Step 8
   adds `rime_slime`, `rime_wyvern`). The construct blurb gains "…raise barriers or grow glass lattices"; the ghost
   blurb gains "…and cold violet wisps that frost cannot slow". Family needed-sets grow only once the introducing stage
   is open (Step 4's Act II rule).
3. **One new machine per stage, in the order the spec's family rows imply.** §17 says the Vesper Aegis and the
   Lattice Shell both arrive "from 6-6", but its own 6-6 row lists only the Orb and the Lattice Shell and 6-7 leads
   with the Aegis. Default: Lattice Shell at 6-6, Vesper Aegis at 6-7, Vesper Warden at 6-8 (a late elite there; the
   lead at 6-9), Rime Wisp and Gatekeeper at 6-10. Every one uses a rule taught by chapter 6 (crystal 6-1, barrier 6-2,
   armour 4-1, ward 2-4) and is budgeted like the def it stands in for.
4. **Machine numbers** (before `hpScale`):

   | Id · name | Body (GLB · variant · props) | hp · speed · class · armour | Rule | threat · bounty | Colours (body / accent / `line`) · size | First |
   |---|---|---|---|---|---|---|
   | `vesper_lattice_shell` · Lattice Shell | construct · `beetle` · crystals (no `shell`: that dome is the Brigade Tortoise's) | 50 · 0.8 · heavy · 0 | `crystal { cap: 5, hits: 10 }` | 4.5 · 18 (as the Shellback) | frost-white glass `#dbe9f2` / `#5fe1f2` / `#1f3b4d` · 1.0 | 6-6 |
   | `vesper_aegis` · Vesper Aegis | construct · `automaton` · shield, gears | 50 · 0.8 · heavy · 0 | `barrier { hp: 60, regenDelay: 4 }` | 5 · 18 (as the Aegis Automaton) | ice-blue glass `#b9d6e6` / `#7ff0ff` / `#14303f` · 1.0 | 6-7 |
   | `vesper_warden` · Vesper Warden (elite) | construct · `warden` · crystals, shield | 300 · 0.6 · heavy · 0 | `barrier { hp: 200, regenDelay: 5 }` + `crystal { cap: 8, hits: 14 }` | 24 · 110 (as the Prism Warden) | white glass `#eef5fa` / `#3fd0e8` / `#1f3b4d` · 1.45 | 6-8 |
   | `rime_wisp` · Rime Wisp | ghost · `wisp` · none | 14 · 1.25 · spectral · 0 | `ward: 'frost'` (frost slows and freezes slide off; frost hits do half: `status.js` already does both) | 1.2 · 2 (as the Shrine Wisp) | violet-black `#3d2f6b` / `#b9a8ff` / pale rime `#e8e4ff` · 0.62 | 6-10 |

   **Greyscale (Step 5 lesson; the review measured the Orb ≈ 166, the Drone ≈ 104, the Gnat ≈ 63 at 844×390, the
   Brigade's navy near the Gnat).** Rule: **two defs on one body variant that can share a board, and any `vesper_*` /
   `brigade_*` pair on one variant, sit ≥ 50 apart in hex luma (Rec. 709, ≈ 27 rendered)**: Lattice Shell 231 vs
   Tortoise 110 and Shellback 177; Vesper Aegis 209 vs the Foundry Aegis 139; Vesper Warden 243 vs Shieldline 57, Badger
   76, Prism Warden 44; Gatekeeper 229 vs Iron Colossus 79; Rime Wisp 54 vs Shrine Wisp 232. Different variants are told
   apart by silhouette and size (small round Orb, low spiky Lattice Shell, upright Aegis with a shield, the big elite
   Warden). Body vs outline ≥ 80. The reviewer re-measures rendered values; a failing pair changes its data colour, never
   the road. Lore stays spoiler-free (no "Night", no nest), e.g. the Lattice Shell: "A cleaning machine that grew a coat
   of glass lattice in the cold. It still polishes the road as it walks."
5. **They break apart; the Rime Wisp flinches away** (render only). `fallStyles.js`: `vesper_lattice_shell` →
   `sparkFall`, `vesper_aegis`, `vesper_warden`, `vesper_gatekeeper` → `breakdown` (cyan sparks, white glass scrap;
   the Gatekeeper's in its amber accent); a new `rime_` prefix → `fade` with a violet tint, **never** the homeward
   sparkle (the Night's touched are not sent home; §3.4: "it flinches back"). No `fall` field on the def: `fall` is not
   in the `ENEMY_KEYS` schema. Keep the cheap early return (one char test per defeat).
6. **Gatekeeper Unit 01** (`vesper_gatekeeper`, §13): construct, tier `miniboss`, the Iron Colossus body (`colossus`,
   props `crystals`, `gears`, `chimney`: the heater), white glass `#dfe8ee`, accent amber `#ffb347` (the one warm thing
   on the board: it is still heating an empty shelter), `line` `#1f3b4d`, size 2.5, hp **3,950** (the miniboss anchor
   ≤ 4,000), speed 0.4, heavy, armour 5, threat 200, bounty 400, `crystal { cap: 12, hits: 24 }`. Phase 0.66 "HOLD THE
   LINE. Gatekeeper Unit 01 calls the line to its side!" (`summoner: vesper_line_sentry ×2 every 9`); phase 0.33 "Its
   heater core glows. The glass shell grows back thicker!" (armour 7, speed 0.34, `crystal { cap: 8, hits: 30 }`).
   Each phase restates the base traits (as the Willow). Lore: "The gate's last guardian. Its orders were to hold the
   line, and it has held it for a very long time, alone, with its heater on." Takes the longer lane, boss-bar peek, no
   crown (as 4-10, 5-10), does not speak (no `ENEMY_SPEAKERS` row), `introducedIn: '6-10'`. Minibosses 9 → 10.
7. **`vesper` is a new `THEMES` entry with two tables** (§18.1), sharing the city kit (`city.kit: 'vesper'`; the
   cleaning robot rides the drones' instanced pool). **Frozen** (`scenery.ruined: 'frozen'`, resolved beside
   `'burning'`): ground `glass` (frosted blue-grey panels, cyan cracks, snow), road `glassway` (white panels, cyan guide
   line: **the lightest band**), open leads and moats near-black blue (the darkest band: ice and islands render lighter
   than water), eclipse dusk, snow, frost haze, a cold aurora, holo signs flickering. **Living** (no `ruined`): white,
   sky blue, cherry trees in glass courtyards, bright morning; a preview fixture only until Arc 2. Gates: `sentryBay`
   spawn (hangar shutter, red lights), `vesperShelter` goal (one warm window). `THEME_FAMILY.vesper = 'ironclock'`.
8. **The viaduct is a sim feature with no new rule (S6v).** A viaduct is a long overpass: the same deck height, the
   same "everyone can hit it" targeting, the same ground-hazard exemption the shipped overpasses already have. No
   height-aware targeting (TECH §4.2: "not recommended: hurts readability"). Details in §4.
9. **The side stage is a new stage kind** (`kind: 'side'`, §20): not in `CAMPAIGN_IDS`, so not in co-op
   (`coopStages` lists `CAMPAIGN_IDS`; the spec: "not unless added on purpose"), not in campaign counters, medals or
   achievements; `requires: '6-10'`, `anchor: '6-10'`, drawn as a small card after 6-10 in chapter 6's Act II row,
   locked ("Clear 6-10") until then. Name **The Starfall Trial** on the map **The Starfall Deck**. Numbers: 6-10's
   plan row with hpScale × 1.1 (9.94), waves 30, tier expert, drops chapter 7's table, first clear
   `campaignFirstClear(6, false)` (coins and books, no recruit ticket), medal gems at the Act II rate (0.5), Easy /
   Normal / Hard like a campaign stage, no freeplay. *Owner question.*
10. **The duo's bond scenes are side scenes.** `g6.star1` / `g6.star2` (§12: kind `bond`) are for Kohaku and Tsubaki,
    who are not a unit yet (no LR duo in `units.js`); a bond scene without a unit has nowhere to live. Default: kind
    `event` (0 gems), triggered before and after `side-6-starfall`, listed in `ACT_SCENE_IDS['6:2']`. They move to the
    duo's bond memories when the duo ships. *Owner question.*
11. **Title fix:** §12 titles both `g6.doorie` and `g7.epi` "Doorie". `g7.epi` keeps it (it is the payoff);
    `g6.doorie` becomes **"For the Tea"**. Every other g6 title is free against all 75 shipped titles and the 180
    Potential step names (checked; "Museum of Noon" shares 6-8's stage name, which Act I scenes already do, e.g.
    "Crystal Vats").
12. **No free girl in Act 6.** The spec's join slots are 1-7, 4-7 and 7-7, so 6-7 `unlocks` nothing; Act 6 has six
    main episodes and no join. Tenka is a unit (since v0.1.57) and speaks as herself, but no Act 6 line may read as
    anyone joining the squad.
13. **Out of Step 6:** the `halo` variant and any new body; in-battle radio lines (6-8 Tenka's "The grid is older than
    your city. Probably."); the x-10 cosmetics (*Upstream*); Captain's Journal `lesson` pages (rule 8 is said aloud in
    `g6.after`); portraits for Tsubaki, Kohaku and Commander Yūhi; per-lane gate looks (`MapDef.gates`, Step 8);
    Vesperline music.

---

## 3. S6a · The Vesperline kit, the sky-rail and light-bridge looks, the gates (render only)

| File | Change |
|---|---|
| `src/render/themes.js` | `THEMES.vesper` (decision 7) with `nightLight`; `FROZEN` table (the `ruined: 'frozen'` look, like `BURNING`), `resolveLook` learns `'frozen'` (only on `vesper`; any other theme ignores it); the living table is the theme itself |
| `src/render/textures.js` | `paintGround` style `glass` (frosted panels, cyan crack lines, snow drifts on frozen); `pathTexture('glassway')` (white panels, cyan guide line) |
| `src/render/city/vesperProps.js` (new) | `glassTower` (skirt only, far LOD), `podium`, `lectureHall`, `holoSign` (glow geometry, a flicker group), `haloStatue`, `doorieStatue` (a round, faceless, lantern-carrying cartoon girl with a keychain cast at her belt; mascot-simple, no body detail), `doorieBus`, `prismBattery` (pad), `transitPad`, `frozenFountain`, `frostedPane`, `vesperTerminal`, `spindle` (the white tower: the foot on the board, the shaft rising into the skirt as the tallest prop in the game, far LOD), `frozenNest` (shipped `nest` + ice), `greyWool` (one thin grey thread in the ice: 6-10 only, small on purpose), `stationCanopy`, `starDome` (the observatory's cracked dome ribs and star-map shards, side map); near + far LOD, ≤ 6 variants each, caps |
| `src/render/city/cityProps.js` | `sentryBay` (spawn, ≥ 2 tiles across, red status lights), `vesperGate` (§18.4: white-gold glass ring round a black-violet disc, dark snow falling out; the brightest thing on 6-10), `vesperShelter` (goal, one warm window) |
| `src/render/trackMesh.js`, `terrain.js` | deck looks by data: `bridge: { glass: true }` (**light-bridge**: opaque glass deck, cyan edge glow, used for water decks and overpasses) and `bridge: { skyRail: true }` (**sky-rail girder**: a box-girder deck, pylons every ≈ 2 tiles along any raised run, a stranded pod hanging at the broken end); piers along a long raised run (not only beside a crossing), still kept clear of the lower road; the deck's shadow on the ground; tunnel style `gallery` (museum wing portal); SCENERY keywords `frostCauseway`, `prismBatteries`, `skyRailViaduct`, `frozenCanal`, `museumWings`, `doorieStatue`, `reflectingPools`, `towerRing`, `transitPads`, `cleaningRobot`, `spindleFoot`, `vesperTerminal`, `frozenNest`, `warmWindow`, `starDome`, `coldAurora`, `holoSigns` |
| `src/render/ruleDecals.js` | on `vesper` the `shifting_stars` rift points draw as **transit pads** (a glowing floor ring at `at` and its twin at `at + jump`, ≥ 1.5 tiles across) instead of star rifts |
| `src/render/ambient.js`, `blackout.js` | snow, frost haze, holo flicker, the cleaning robot circling (instanced, ≤ 1 group), aurora in the backdrop; blackout on `vesper` (6-8 Dead Grid): holo signs and exhibits go out, the warm window and the gates stay lit |
| `src/render/fallStyles.js` | decision 5 (`vesper_*` rows, the `rime_` prefix) |
| `src/art/backdrops.js`, `src/ui/story/backdrop.js`, `src/art/stageThumb.js` | `THEME_SKY.vesper` (eclipse dusk: a dark ring of sun, violet-teal sky); drawn variants `causeway`, `skyrail`, `museum` (the rotunda with the Doorie statue), `towers`, `spindle` (the white tower, the terminal ring), `starfall` (the cracked dome at night); `PLACE_VARIANT` rows for the six maps; `@night` re-lights each; thumbnail palette `vesper` |
| `src/audio/routes.js` | `THEME_FAMILY.vesper = 'ironclock'` |
| `previews/vesper.html` + `previews/vesperMaps.js` | seven fixtures outside `MAPS`: the causeway with two light-bridges and three batteries; the sky-rail with a hand-written `elev` span (S6v not needed) and an under-crossing; the museum in blackout; the tower ring with transit pads; the Spindle's foot with the Vesper Gate; the Starfall Deck at night; one **living** board (morning, cherry courtyards) |
| Tests | `tests/render/vesper.test.js` (builders near/far, caps, deterministic, 0 transparent; **the road is the lightest band and the ground is lighter than the water on frozen and living**; a raised run gets piers along it and none on the lower road; the transit pads stand at `at` and `at + jump`; the Vesper Gate is the brightest prop on its board), `fallStyles` (new vesper rows, `rime_` never `sparkle`, shipped defs unchanged), backdrop variants and `@night`, `terrainGolden` skips `vesper` (as city, campus, drowned) |

**Budget** as before (≤ 10 calls + ≤ 3 movers, < 90k / < 65k tris, ≤ 250 glows, ≤ 40 emitters, 0 sorted transparent;
§18.7 estimates `vesper` 65-75k, with the towers far LOD). Rows per fixture and quality in `STEP6_HASHES.md`.
**Done when** sim id and data hash equal the plan row, the budget rows are in, greyscale check at 844×390 (road,
gates, the Spindle, the Doorie statue, the sky-rail deck reading as raised, the transit pads, every Step 5 machine on a
`vesper` board), build OK, independent visual OK.

---

## 4. S6v · The viaduct (sim, M)

A viaduct is a long overpass that the road climbs onto on purpose, not only where it crosses itself. Today
elevation comes only from crossings (a deck of ≈ 4.2 tiles). S6v adds a marker pair, an elevation profile and one
crossing rule; it adds **no** enemy rule, command, message or random number.

**Authoring (`src/core/track.js`).** New markers `RAISE` (`'^'`) and `LOWER` (`'v'`), exported beside `TUNNEL_IN` /
`TUNNEL_OUT` and aliased in `maps.js` as `UP` / `DOWN`: "a viaduct starts at the previous control point … and ends at
the previous control point", like `IN` / `OUT`. `buildTrack` records `track.viaducts: [[a, b]]` (distances; the key is
written only when a track has one, so every shipped track object stays byte-identical). Errors (authoring, thrown at
module load like the tunnel errors): an unclosed or nested viaduct, a viaduct overlapping a tunnel, a span shorter than
`2 × VIADUCT_RAMP + 2` (≥ 2 tiles at full height), a viaduct on a fork prefix or join suffix (they inherit their
parent's elevation as today).

**Elevation.** `applyCrossings` (which already resets `elev` and `under`) first writes every viaduct:
`elev(d) = BRIDGE_HEIGHT × ramp(d − a) × ramp(b − d)` for `a ≤ d ≤ b`, where `ramp(u)` is the shipped smoothstep over
`VIADUCT_RAMP = BRIDGE_RAMP` (1.3 tiles), plain arithmetic (no trig, no `Math.pow`), rounded with `r4` like every
elevation value. The deck height is the overpass height, so `elev ≤ BRIDGE_HEIGHT` (world test) and every renderer
threshold keep working.

**Crossings with a viaduct.** Resolved before the authored modes:
- one pass on a viaduct's **flat top** (elev ≥ `BRIDGE_HEIGHT` − 0.01), the other on the ground: mode `bridge`, `over`
  = the viaduct pass, whatever the map authored (as a tunnel pass forces `tunnel`); the ground pass gets its `under`
  span (the shipped `DECK_HALF / sin(angle)` width, ≤ 1.6);
- one pass in a tunnel: `tunnel` as today (the viaduct runs above a buried pass);
- both passes on viaducts, or either pass on a **ramp** (0 < elev < top): an authoring error ("no three-level
  interchanges", "no crossing on a ramp"); the shipped "lower pass is itself on a bridge ramp" error stays.

*As built (stricter than the above):* the code measures distance, not elevation. A crossing on a viaduct must sit
≥ `VIADUCT_CLEAR` = `VIADUCT_RAMP + BRIDGE_FLAT` (2.1 tiles) from each foot, not merely on the flat top (≥ 1.3), so
the whole deck over the lower road is at full height; an ordinary overpass whose crossing is within 2.1 tiles of a
viaduct's span on either pass is rejected; the road passing under a viaduct keeps the same 2.1 tiles from its own
viaducts' feet. Where a lane shares road with its parent, the shared prefix / suffix must follow the parent's
elevation (within 0.015, `SEAM_TOL`: no overpass ramp of the lane reaching back over the seam) and the fork / join
seam must be on the ground, also when the parent's elevation there is itself inherited (nested forks and joins).

**What changes in the battle, exactly.** Nothing new is read by the sim beyond `elev` and `under`, which it already
reads:
- an enemy on a viaduct has `e.elev = 0.62` mid-span (`placeOnPath`); `e.hidden` stays false, so **every girl, hero,
  ult, ability and trap that can reach its 2D position can hit it** (`combat.js` checks only `hidden`), exactly as on
  a shipped overpass;
- the one ground-only rule, `forge_vents` burn zones (`rules.js burnZones`), already skips `e.elev > 0` and
  `e.underDeck`; S6b/S6c never author a vent zone on a raised or under-deck stretch (test);
- an enemy on the ground pass under the deck has `underDeck` true: hidden by the renderer, **still targetable** (as
  today);
- `rear_ambush`'s `reversePath` mirrors `elev` and `under` already, so a viaduct walked backwards is correct;
- placement: the viaduct's band is road (stamped like any road), so nobody builds on it or under it; tiles beside it
  stay buildable. `autoPlan` samples ignore elevation as before.

**Determinism and co-op.** The viaduct is pure geometry computed once per map at module load with `DET_MATH` and `r4`
on every engine; no `Math.random`, time or frame-rate input; no new command or message shape (a placement next to a
viaduct is the same place message). Both peers build MAPS from the same source, which the data hash covers, and
`track.js` is in the sim hash, so mixed builds cannot pair. `COOP_PROTOCOL` stays 10; `PENDING_BUMP { 10: '<S6v id>' }`.

**Golden tests that must stay unchanged** (take the new golden on 8585c8d7 **before** writing any S6v code):
- **new** `tests/core/tracksGolden.test.js` + `tracksGolden.json`: an FNV-1a digest per shipped map of every track
  (`points`, `cum`, `tunnels`, `elev`, `under`, `fork`, `join`, `inside`) and every crossing (`x, y, a, b, angle, mode,
  over`); all 74 entries unchanged by S6v and by S6b (new maps are added to the golden only after their review);
- `tests/sim/campaignGolden.test.js`, `modesGolden.test.js`, `abilitiesGolden.test.js`, `tests/render/terrainGolden`;
- `node e2e/engines.mjs`: wave tables `4381:f4a15f8d` and the scripted battle's 64 checkpoints `7db1eed1` (they move
  only in S6c, with the new stages);
- the data hash `0652c02a` (S6v changes no MapDef).

**Tests to add.** `tests/core/track.test.js`: markers parse; profile (0 at both feet, `BRIDGE_HEIGHT` on the flat top,
smooth 1.3-tile ramps, symmetric); `viaducts` spans recorded; each authoring error; a crossing under a viaduct becomes
`bridge` with the viaduct over even when the map asks `flat` or `bridgeUnder`; the ground pass gets `under` there and
nowhere else; deterministic (build twice → deep equal). `tests/sim/tracks.test.js`: on a viaduct fixture an enemy
mid-span has `elev` 0.62 and `isEligible` true; a vent zone under the span burns the ground walker only when it is not
under the deck and never the raised one; the under-crossing walker is `underDeck` and targetable; `reversePath` mirrors
the profile; `runHeadless` twice → the same digest; the band is unbuildable. `tests/online/lockstep.test.js`: two
CoopSims on the viaduct fixture with the same command log keep identical checksums. `tests/data/world.test.js`:
"crossings are resolved" learns the viaduct rule (a crossing with a viaduct pass is `bridge`, viaduct over, lower pass
< 0.05); a map's vent zones and transit-pad points sit on ground road, ≥ 2 tiles (along the road) from any crossing.

**Fallback** (spec §17): if S6v fails review three times, 6-7 becomes "two ordinary overpasses on the same line" (the
sky-rail deck look on two crossings) and the viaduct moves to Step 8 (8-6).

**Done when** the tests above pass, the golden list is unchanged, sim id recorded with `PENDING_BUMP`, data hash equal
to the plan row, `CONTRACTS.md` updated (markers, `track.viaducts`, the crossing rule), independent reviewer OK on sim
and determinism.

---

## 5. S6b · The six maps

Authoring tests as Step 5's: radius ≥ 1.4 (author ≥ 1.5), bend < 14° per sample, flat junctions ≥ 2 apart, tunnels
> 1 tile, edge spawns and exits (no `inside` lane in Step 6), IoU < 0.65 and a different turning signature against
**all 74 maps** (and each other), **no new meander** (Petal Lane and Furnace Core hold both slots: keep every
alternating lobe under 130°), ≥ 8 `~` within 3 of the road, ≥ 24 road and ≥ 30 land tiles, decor tiles block. Run every
sketch through the scratch checker first. The starting points below were run through it at plan time (results in the
Watch column); nudge, never trace. Coordinates: x east, y south. Theme `vesper` with `scenery.ruined: 'frozen'` on every
stage; `city: { kit: 'vesper', spawnGate: 'sentryBay' }` on 6-6…6-9 and the side map, `'vesperGate'` on 6-10.

| Stage | Map id · name | Path sketch (starting point) | Water | Watch (plan-time check) |
|---|---|---|---|---|
| 6-6 | `vesper_frost_causeway` · Frost Causeway · 20×12 | **Broken causeway W.** `[[-1, 3.0], L, [1.2, 3.0], [3.6, 5.2], [5.4, 8.2], [7.2, 9.0], [8.8, 7.6], [10.0, 4.8], [11.4, 3.6], [13.0, 4.8], [14.4, 7.6], [16.0, 8.8], [18.0, 8.2], [19.4, 7.0], L, [21, 7.0]]`: from the frozen lake in the west, two valleys and one crest, out east at the city gate. Three causeway "islands" (land) round x 1-4, 9-13 and 17-19; open leads (`~`) cut the causeway twice (x ≈ 5-7 and 14-16), so the road over them becomes two **light-bridges** (glass water decks, `bridge: { glass: true }`). Pads on the islands, e.g. `pad(2.5, 5.0)`, `pad(11.4, 5.6)`, `pad(18.0, 6.0)` (land beside the road) | open leads and the lake edge: ≥ 60 (the ice is ground) | len 31, min r 1.53, no crossing; signature +60 −133 +137 −119 +53 (no clash, not a meander, but two lobes are near 140°: do not deepen the valleys); top IoU Sky Bridge 0.52. Shallower W variants clashed with Takoyaki Row (+58 −126 +127 −60): keep the five-lobe shape |
| 6-7 | `vesper_skyrail` · Sky-Rail Viaduct · 22×12 | **Sky-rail S, then back underneath.** `[[5.5, -1], L, [5.5, 0.6], [6.4, 1.8], [8, 2.2], UP, L, [10.5, 2.2], [12.4, 3.2], [13.4, 5.2], [14.6, 7.4], [16.4, 8.6], DOWN, L, [18.4, 8.6], [19.8, 7.8], [20.2, 6.4], [19.4, 5.2], [17.8, 4.8], L, [3.8, 4.8], [2.6, 5.6], [2.2, 7.0], L, [2.2, 13]]`: in from the north, up onto the rail at x ≈ 9, an S down across the ruins on the rail, down the ramp at the broken span (x ≈ 16), a right-hand hook up the east side, then west along row 4.8 **under its own viaduct** at ≈ (13.2, 4.8) and out south-west. Place `UP` and `DOWN` so the crossing sits on the flat top (≥ 2.1 tiles from each foot) and the raised run is ≈ 8-10 tiles; `map.bridge: { skyRail: true }` | a frozen canal under the S and along the south: ≥ 10 | len 48, min r 2.21, one crossing at 67° (the viaduct over the return); signature −89 +67 −333 (no clash); top IoU Moon Bridge 0.50, Fireworks Square 0.47, **Reservoir Park 0.47** (5-9 is also "Z under its own first leg": keep the 22-wide board and the south-west exit); fallback: mirror east-west |
| 6-8 | `vesper_museum` · Museum of Noon · 20×12 | **Wings and rotunda.** `[[21, 9.0], L, [17.8, 9.0], IN, L, [14.6, 9.0], OUT, [13.4, 8.4], ...arc(10, 6.0, 3.4, 30, -210, 30).slice(1, -1), [6.6, 8.2], [5.8, 9.0], IN, L, [3.4, 9.0], OUT, [2.4, 9.6], [1.6, 10.4], L, [-1, 10.4]]`: in from the forecourt (south-east), through the east wing (a 3-tile `gallery` tunnel under `H`), half round the Doorie statue at (10, 6) over the north, through the west wing (2.4 tiles), out through the frozen garden in a small S to the west edge | reflecting pools inside the half circle (x 8-12, rows 5-7) and a garden pond: ≥ 12 | len 32, two tunnels; signature +95 −190 +95 −52 +57 (no clash); **min r 1.32 at the garden S: ease it to ≥ 1.5 but keep the small reverse wiggle** (smoothing it out flips the signature into a clash with School Gate; an exit at row 7.4 clashed with Gloomfen Boardwalk); top IoU Festival Street 0.52; nearest shape Gearworks Crossing |
| 6-9 | `vesper_tower_ring` · Lecture Tower Ring · 20×12 | **Phi.** `[[3.0, 13], L, [3.0, 10.6], [3.8, 9.2], [6.0, 8.6], [8.6, 8.4], [10.6, 7.4], [11.0, 6.0], L, [11.0, 3.6], [12.2, 2.2], [14.2, 2.4], [15.0, 4.0], [14.9, 6.0], [14.4, 8.2], [12.8, 9.6], [10.0, 10.2], [7.2, 9.6], [6.0, 8.0], [6.4, 6.6], [7.8, 5.8], L, [16.6, 5.8], [18.4, 5.4], [19.4, 4.2], L, [19.4, 3.0], [20.0, 1.6], [21, 1.2]]`, `crossings: ['bridge', 'flat', 'bridge']`: in from the south-west, up the vertical spoke through the plaza, a full lap of the ring round the towers (clockwise), then the horizontal spoke east across the plaza (a **flat** crossing with the vertical spoke at (11, 5.8): the scramble plaza) and out over the ring's east arc on a **light-bridge**; the ring itself rides over the entry road on the other light-bridge at ≈ (6.2, 8.6). Lecture-tower podiums `H` inside the four quarters | a ring canal outside the lap (south and east): ≥ 10 | len 54, three crossings (68°, 90° flat, 82°); signature +83 −88 +444 −89 +75 (no clash; entering from the west edge or exiting straight east clashed with Fireworks Square and Wildflower Meadow); top IoU Toll Plaza 0.54. **Transit pads:** the rule's `at 0.4 / jump 0.12` lands at d ≈ 21.8 → 28.3, next to the east-arc crossing (d 22.8): move the lap or the spoke so both pad points are ≥ 2 tiles from every crossing (test) |
| 6-10 | `vesper_spindle_foot` · The Spindle's Foot · 22×12 | **Double helix.** Lane 0: `[[4.5, -1], L, [4.5, 0.2], [5.6, 1.2], [8.4, 1.6], [11, 2.6], [13.6, 3.7], [15.4, 5.2], [15.0, 6.8], [13.4, 7.6], [11.6, 8.1], [10.7, 9.2], [10.3, 10.6], [9.4, 11.8], [8.6, 13]]`. Lane 1: `{ nodes: [[17.5, -1], L, [17.5, 0.2], [16.4, 1.2], [13.6, 1.6], [11, 2.6], [8.4, 3.7], [6.6, 5.2], [6.6, 7.0], [7.8, 8.4], [9.4, 9.0], [11.2, 9.3], [12.8, 9.4], [13.9, 10.2], [13.6, 11.2], [12.2, 11.6]], join: { path: 0, at: [9.7, 11.6] } }`, `crossings: ['bridge', 'bridgeUnder']`: two columns out of the Vesper Gate's terminal (north-west and north-east), crossing on a light-bridge north of the Spindle's foot (44°), round opposite sides of it, crossing again south of it (72°, the other lane over), and merging before the `vesperShelter` door on the south edge. The foot (`H`, x 9-13, rows 4-7) inside its ring moat | the Spindle's ring moat: ≥ 20 | lanes 25 and 31 (the Gatekeeper takes the longer one), min r **1.39 on lane 1's hook: widen it**; the join must sit ≥ 2.2 tiles past the south crossing's ramp; signature −85 +151 −68 \| +85 −153 +195 −52 (no clash); top IoU Drowned Willow 0.57, Blossom Court 0.54, The Dry Fountain 0.54 |
| side | `vesper_starfall` · The Starfall Deck · 20×12 | **Orrery.** `[[-1, 9.4], L, [4.4, 9.4], [6.4, 8.6], ...arc(12.0, 5.8, 4.6, 180, 450, 30), ...spiral(12.0, 5.8, 4.6, 2.0, 450, 540, 30).slice(1), ...arc(12.0, 5.8, 2.0, 540, 790, 30).slice(1), [11.0, 8.6], [10.6, 9.2], IN, L, [10.6, 11.8], OUT, L, [10.6, 13]]`: in from the west, three-quarters of the outer ring (clockwise), a quarter-turn spiral inward over the star-map pool on a **light-bridge** (glass water deck), three-quarters of the inner ring, and out along a spur that **tunnels under the outer ring** to the south edge. Meteor zones (`forge_vents`) on ground road only, e.g. `v(16.6, 5.8)`, `v(12.0, 3.8)`, `v(3.0, 9.4)` | the star-map pool between the rings: ≥ 12 | len 53, min r 1.61, one tunnel crossing (46°); signature −74 +603 −64 (no clash); top IoU Caldera Rim 0.62, Drowned Willow 0.59, Blossom Court 0.56 (**the riskiest map: the ring-in-ring idea is Blossom Court's spiral; never move the rings back to the centre**, an earlier centred sketch hit 0.64-0.70) |

(`UP` / `DOWN` in the 6-7 sketch mark roughly where the S6v markers go; the plan-time checker ran without them.)

Dressing (map `decor` / `city` hints / stage `scenery.props`): 6-6 frozen towers on the skyline, sky-rails hanging
over nothing, a halo statue at the city gate, a Doorie bus abandoned on the causeway; 6-7 sky-rail pods stuck mid-span
(one fallen), pylons, dead holo signs, a station canopy; 6-8 the gallery sign *Itomachi, Before*, the Doorie statue,
the picture-book case, frozen fountains; 6-9 podiums low and towers tall in the skirt, halo statues, the Defence Corps
sign, the cleaning robot circling the plaza; 6-10 the Spindle, the Vesper Gate's terminal and ring, the frozen nest
(far too big for any bird), one thread of grey wool in the ice, the empty shelter with its one warm window; side: the
cracked dome, the orrery's brass rings, star-map shards. Decor uses shipped types plus S6a's.

**Tests.** `tests/data/world.test.js`: maps 74 → 80; `THEMES` gains `vesper`; a viaduct map (6-7) passes every
authoring test and the new viaduct crossing check; water; vent zones and transit-pad points on ground road and clear of
crossings. `tests/core/tracksGolden`: the 74 shipped
digests unchanged; add the six after review. `tests/render/vesper.test.js`: caps on the real maps. **Done when**
authoring tests green, the harness shows no meander and no clash (top-3 IoU logged per map), budget rows on the six
real maps in `STEP6_HASHES.md`, hashes recorded, `PENDING_BUMP` updated.

---

## 6. S6c · Stages, rules, skins, the machines, the Rime Wisp, Gatekeeper Unit 01, the side stage

### Stages (`src/data/stages.js`, `act2Stage`; `CHAPTERS[5].act2Name 'Vesperline'`, `act2Theme 'vesper'`)

`act2Desc`: "Through the Noon Gate, holding Sensei's hands, into Vesperline: a city of glass on this same lake,
frozen in the moment it fell. Its machines still hold the line, and under its white tower one window is still warm."
(After the reveal: Act 6 opens after 6-5 and 5-10, so "Vesperline" may be named; no "Night", no nest, no "dragon".)
`ACT2_MECHANIC[6]`: "Glass machines that hold the line: barriers, crystal lattices and plate. On 6-7 the road runs up
a sky-rail viaduct, and enemies on it can still be hit."

| Stage · name | Rule (`STAGE_RULES`) · skin | Pool (lead first; `P(id, weight, from)`) | Fixed (`F(wave, id, n, spacing, delay)`) | Budget start | Recommended · fam | Notes |
|---|---|---|---|---|---|---|
| 6-6 · Frost Causeway | `prism_conduits` · Prism Batteries, three pads | vesper_patrol_orb 4, slime_crystal 3, vesper_lattice_shell 3 (3), slime_iron 2 (4), goblin_sapper 2 (6) | F(2, slime_crystal, 4, 0.6), F(3, lattice_shell, 3, 1.2), F(4, slime_iron, 3, 0.8), F(6, goblin_sapper, 3, 0.6) | [6, 300] | multiHit, priority · cog, rime | snow; `introduces: ['vesper_lattice_shell']`; the act's opener: easiest on Normal |
| 6-7 · Sky-Rail Viaduct | `heat_mirage` · Frost Haze | vesper_patrol_orb 3, slime_ember 3, goblin_sapper 2, vesper_aegis 3 (3), goblin_bomber 2 (5), vesper_line_sentry 2 (8) | F(2, goblin_sapper, 3, 0.6), F(3, aegis, 3, 1.2), F(5, goblin_bomber, 3, 0.6), F(8, line_sentry, 2, 2) | [6, 260] | barrierBreak, armorPen · ember, cog | snow; `introduces: ['vesper_aegis']`; no `unlocks` (decision 12) |
| 6-8 · Museum of Noon | `lunar_eclipse` · Dead Grid | vesper_line_sentry 3, ghost_wisp 3, goblin_sapper 2, vesper_aegis 2 (4), vesper_halo_drone 3 (6), ghost_phantom 2 (9), vesper_warden 1 (15) | F(4, aegis, 2, 1.5), F(6, halo_drone, 3, 1.2), F(9, phantom, 3, 1.0), F(15, warden, 1), F(29, warden, 2, 3, 6) | [4, 120] (two wings hide ≈ 5.6 tiles: Step 5's hidden-lane lesson) | armorPen, barrierBreak, priority · rune, charm | `look.blackout`; `introduces: ['vesper_warden']` |
| 6-9 · Lecture Tower Ring | `shifting_stars` · Transit Pads | vesper_line_sentry 3, vesper_lattice_shell 3, slime_crystal 2, slime_ember 2, vesper_halo_drone 2 (4), goblin_bomber 2 (7), vesper_warden 1 (10) | F(4, halo_drone, 3, 1.2), F(7, goblin_bomber, 3, 0.6), F(10, warden, 1), F(20, warden, 2, 3), F(29, warden, 3, 3, 6) | [6, 300] | barrierBreak, multiHit, armorPen · blade, feather | the Warden leads |
| 6-10 · Gatekeeper Unit 01 | `supply_ship` · Last Watch Caches | vesper_line_sentry 3, vesper_aegis 3, vesper_patrol_orb 2, slime_crystal 2, goblin_sapper 2, vesper_warden 1 (12) | F(12, warden, 1), F(20, warden, 2, 3), F(28, rime_wisp, 6, 0.5), F(29, rime_wisp, 8, 0.5), F(30, rime_wisp, 10, 0.5), F(30, vesper_gatekeeper, 1, 2, 6), F(30, warden, 2, 3, 10) | [6, 280] | barrierBreak, multiHit, priority, armorShred · cog, rune | `introduces: ['rime_wisp', 'vesper_gatekeeper']`; the Rime Wisps come from the Vesper Gate on the last three waves only |
| side · The Starfall Trial | `forge_vents` · Starfall, three zones | vesper_patrol_orb 3, vesper_lattice_shell 3, slime_crystal 2, vesper_aegis 2 (3), ghost_phantom 2 (5), vesper_halo_drone 2 (8), vesper_warden 1 (12) | F(3, aegis, 2, 1.5), F(5, phantom, 3, 1.0), F(8, halo_drone, 3, 1.2), F(12, warden, 1), F(30, warden, 3, 3, 6) | [6, 300] | multiHit, barrierBreak · cog, feather | night; families up to chapter 6, no Rime Wisp (the Night stays 6-10's) |

Descriptions (they must match the generated waves exactly; every "from wave N" is backed by a fixed group on wave N
and a pool `from` of N, and every "come first" list is exactly the enemies before the first claim; extend
`descWaves.test.js` to Act II chapter 6 and to `kind: 'side'`):
- 6-6: "Out across the frozen lake to Vesperline's gate, on a causeway broken in three and mended with fold-out
  light-bridges. Patrol Orbs and Quartz Slimes come first; Lattice Shells from wave 3, Iron Slimes from wave 4, Goblin
  Sappers from wave 6. Three prism batteries on the causeway still hold a charge."
- 6-7: "A sky-rail viaduct over the frozen ruins: the road climbs onto the rail, snakes along it, comes down at the
  broken span and runs back underneath. Enemies up on the rail can still be hit. Patrol Orbs, Ember Slimes and Goblin
  Sappers come first; the Vesper Aegis from wave 3, Goblin Bombers from wave 5, Line Sentries from wave 8."
- 6-8: "The museum's last generator keeps failing, and the column vanishes inside each gallery wing. Line Sentries,
  Shrine Wisps and Goblin Sappers come first; the Vesper Aegis from wave 4, Halo Drones from wave 6, Phantoms from wave
  9 and a Vesper Warden from wave 15. Hold the rotunda."
- 6-9: "Round the ring road between the frozen lecture towers, in along a spoke, across the plaza and out over the
  ring, where the city's broken transit pads still fire. Line Sentries, Lattice Shells, Quartz Slimes and Ember Slimes
  come first; Halo Drones from wave 4, Goblin Bombers from wave 7, Vesper Wardens from wave 10."
- 6-10: "At the foot of the white tower two columns come down from the gate's terminal, cross each other twice on
  light-bridges and meet before the shelter. Line Sentries, the Vesper Aegis, Patrol Orbs, Quartz Slimes and Goblin
  Sappers come first; Vesper Wardens from wave 12, Rime Wisps from wave 28. On the last wave Gatekeeper Unit 01 wakes."
- side: "The academy observatory's broken deck, under a cracked dome where the night-sky watch kept its post. Shards
  of the star map keep falling. Patrol Orbs, Lattice Shells and Quartz Slimes come first; the Vesper Aegis from wave 3,
  Phantoms from wave 5, Halo Drones from wave 8, Vesper Wardens from wave 12."

(The test's plural of "Vesper Aegis" is "vesper aegises", so the descriptions use the singular "the Vesper Aegis",
which the name matcher finds. If a "come first" list misses an early pool enemy, add a fixed group, never reword the
claim.)

Skins (name · short; each desc keeps every number of the base text, `ruleSkins.test.js`; none equals a Potential step
name or a shipped skin, checked): 6-6 Prism Batteries · Batteries ("A girl standing on a charged prism battery gets
+0.7 range and +25% damage. One girl per battery."); 6-7 Frost Haze · Haze ("Frost haze rolls off the frozen canal (6 s
in every 18) and cuts girls' range by 0.5. Every defeated enemy drops 1 extra coin."); 6-8 Dead Grid · Grid ("The
museum's last generator fails for 6 s (every 20 s) and the holo exhibits go dark: Holy deals 50% more damage and
spectral enemies move 20% faster."); 6-9 Transit Pads · Pads ("Each wave one power shines (+50%): Fire, Frost,
Lightning, Holy, Mystic in turn. Ordinary enemies slip through a broken transit pad once."); 6-10 Last Watch Caches ·
Caches ("The Last Watch's cached supplies turn up with 150 battle coins after every 4th wave. Lightning deals 20% more
damage."); side Starfall · Starfall ("Every 15 s shards of the dome's star map fall onto the road for 5 s, burning
ground enemies that cross them.").

**Budgets and balance.** Starting values above take Steps 4-5's lessons (hidden wings cut 6-8's start; 5-8's loop
over its own leg needed an opening spike, [33, 600], because one girl by the gantry covered three legs). **Step 6 rule:
no stage may be decided only by its opening waves.** 6-9's phi, 6-10's helix and the side's orrery give a girl near a
crossing two or three passes, so if the bot wins Hard there, change the map first (move the crossings away from
buildable land, put water round them) before raising the start; a start above [12, …] needs the reviewer's OK. Run the
per-stage Easy / Normal / Hard table early (autoPlan bot, F2P roster before the stage, chapter 7's expected level as
Step 5 used chapter 6's, map rules on, seed 1) and tune only budgets. **Targets:** Easy 70/70 at the gate; Normal won
with ≈ 50-90 lives on every Act 6 stage; Hard lost on every stage (at most one narrow win, never 6-10), **every Hard
loss at wave 10 or later**; 6-6 the act's easiest; **6-10 the hardest** (fewest Normal lives or earliest Hard loss); no
stage above 6-10; each row compared with 5-6…5-10 (Step 5's table) and 7-1…7-5. The side stage is optional and above
6-10 by design: Normal won with ≥ 30 lives, Hard lost, and it is not in the Easy gate.

### Enemies (`src/data/enemies.js`)
- `vesper_lattice_shell`, `vesper_aegis`, `vesper_warden`, `vesper_gatekeeper` in `CONSTRUCTS`; `rime_wisp` in
  `GHOSTS` (decisions 2-6); both blurbs. Campaign enemies 87 → 92 (cap 110), defs 91 → 96, minibosses 9 → 10.

### The side stage (decision 9)
- `src/data/stages.js`: a `sideStage(o)` builder (numbers from 6-10's plan row × 1.1, `kind: 'side'`, `chapter: 6`,
  `act: 2`, `anchor: '6-10'`, `requires: '6-10'`, `medalGemMul: 0.5`, `firstClear: campaignFirstClear(6, false)`, chapter
  7's drops) and a `SIDE_STAGES` list appended to `STAGES` after the bounties; `stageOrderKey` sorts it after its
  anchor; `CAMPAIGN_IDS` unchanged.
- UI: `src/ui/screens/campaignActs.js` draws side cards after their anchor (small card, its own thumbnail, lock text
  "Clear 6-10"); battle labels (`battleSave.js`, `inventory.js`, `results.js`, `hud.js`) say "Side · The Starfall
  Trial"; `stageModes.js` offers no freeplay or Ironclad on it.
- Every `kind === 'campaign'` reader is checked once (missions, achievement counters and metrics, profile trophies,
  rewards, unlocks, happening, hub states, freeplay, sandbox, formation): the side stage adds no mission, campaign medal
  or ribbon, trophy or achievement, and introduces no enemy.

### Tests that move (Steps 1-5's list, one more act)
- `tests/data/world.test.js`: STAGES 84 → 90, campaign 65 → 70, `STAGE_OPTIONAL` + `anchor`, minibosses +
  `vesper_gatekeeper`, campaign enemies 92 (≤ 110), ≥ 4 per family, `introducedIn`, the free-counter rule, `introduces`,
  the miniboss at 6-10 (no crown), the side stage's requires and anchor.
- `tests/models/enemies.test.js`: each new def resolves to a shipped variant and props (`beetle`, `automaton`,
  `warden`, `colossus`, ghost `wisp`); no new GLB, `GLB_FAMILIES` 12, no `halo`; body vs `line` ≥ 80; **the same-variant
  greyscale rule of decision 4** (pairs that share a stage pool or fixed list, and every `vesper_*` vs `brigade_*`
  pair on one variant, ≥ 50 apart).
- `tests/data/act2Plan.test.js` (chapters 1-6, `CAMPAIGN_IDS` 70); `act2Unlocks` / `campaignActs` (chapter 6's Act II
  waits for 6-5 **and** 5-10; the act banner draws `vesper`; the side card after 6-10, locked until 6-10 is cleared,
  never in `coopStages()`).
- `tests/data/achievements.test.js` + ledger: `a_ch6_act2` live (append; never edit), 134 → 135, act2 series of six.
- `tests/systems/achievementMetrics.test.js`: construct needs the new machines only once their stage is open, ghost
  needs the Rime Wisp only once 6-10 is open (a veteran's family count never drops or rises on update day);
  `achievementsRetro` unchanged; `balance.test.js` Easy gate 70/70.
- Counters: events, missions (gems + `a_ch6_act2`), modes (medals 260 → 280, ribbons 1300 → 1400; the side stage adds
  none), profile trophies 84 → 89, profile card, achievements model, engines wave digest (+ 144 campaign waves and the
  endless rows; Act I tables unchanged in `campaignGolden`), `consistency.test.js` Act II order through 6-10.
- `tests/ui/ruleSkins.test.js`: six skins (the side's included); `tests/render/fallStyles` against the real defs;
  `tests/data/descWaves.test.js` covers 6-6…6-10 and the side stage.

**Done when** `npm test` green, Easy gate 70/70 and the per-stage table in `STEP6_HASHES.md`, a greyscale shot of
6-7, 6-9 and 6-10 mid-battle (every machine, the Rime Wisps and the Gatekeeper readable at 844×390; an enemy on the
viaduct and one under it both readable), an old save keeps every unlock and every family achievement, hashes recorded,
independent reviewer OK on data and sim.

---

## 7. S6d · Story (`src/data/story/scenes/g6.js`, registered after `ch6`)

| Id | Trigger | Title | Kind | bg (place · time) | Beats (STORY §11 Act 6) |
|---|---|---|---|---|---|
| `g6.pro` | before 6-6 | Hold Hands | main | `stage:5-8` (the pump hall, the Noon Gate) → `cue({ bg: 'stage:6-6' })` after the crossing | Tsubaki's crossing drill, shown and not named as a rule (rule 8 is the act's one named rule): the gate throws travellers toward warmth and Vesperline has none, only Sensei comes out where they mean to, so everyone holds Sensei's hands; Hikari: "Everyone? …{name:kage}, that's a rice cracker."; through: glass towers frozen mid-eclipse, sky-rails hanging over nothing, halos on every statue; Yuki: "So this is where the cold came from."; Tenka, quietly: "Welcome home. …Mine, I mean."; Tsubaki times the crossing; Hikari leads them onto the causeway |
| `g6.sleep` | after 6-7 | Four in the Morning | side | `stage:6-7@night` (under the sky-rail station canopy) | Yuzuha, the sleepiest girl in the city, wide awake on watch at 4 a.m. beside her turret ("My turrets don't sleep, so I don't."); Hikari sits with them; the shadow: every clock in the city stopped at the same minute; choice "Go to sleep. I'll watch." / "Want some company?"; she falls asleep against the turret, not against anyone |
| `g6.mid` | before 6-8 | Museum of Noon | main | `stage:6-8` (the rotunda, the Doorie statue) | a gallery called *Itomachi, Before*; Iroha's painting of the Old Town on the wall (`ifUnit: 'iroha'`, off stage: "I painted that. Last week."); the Doorie statue, weathered faceless, a lantern and a keychain cast at her belt; Tenka: every child in Vesperline had a Doorie; *The Quiet Stones* under glass: a captain, a mother in the mountains, a little star in a hat; Hikari: "…That's us."; the museum's generator hums, the machines wake |
| `g6.chair` | after 6-8 | The Empty Chair | main | `stage:6-9` (narrated: the Defence Corps briefing room high in a lecture tower, the ring through the frosted glass) | a frosted chair labelled SENSEI, a mug, a cracked card: "SENSEI · Faculty Advisor · MISSING since the Fall."; Tenka: "That's you. In a city you've never been to."; Kage: "SUSPICIOUS." Nobody laughs; Hikari puts the card in Sensei's coat pocket, carefully |
| `g6.boss` | before 6-10 | The Last Recording | main | `stage:6-10` (the Vesper Gate's terminal at the Spindle's foot) | the Commander's last message plays (plate "Commander Yūhi", a recording): "To the girl at the door."; Kohaku: her prior-life entry is blacked out, by her own hand; the blade in her hand has a notch (Hikari looks at her own sword and says nothing); she taps twice over her heart; "I couldn't protect everyone alone. I should have asked."; "Sensei, if this reaches you: come earlier next time."; red letters on the terminal: HOLD THE LINE |
| `g6.after` | after 6-10 | Flicker | main | `stage:6-10` | the Gatekeeper's falling span of sky-rail traps {name:kohaku} on the stairs; Tsubaki's outline breaks up like a bad signal; Hikari and the girls lift the rail, Kohaku comes out unharmed, Tsubaki steadies at once; Tsubaki: Vesperline children look up their prior life on their first day, and hers is Kohaku; Tenka names rule 8: "Two lives of one soul can share an hour. Each keeps her own thread."; Chika finds the Gatekeeper was still heating an empty shelter and switches it off: "Real welds. …Goodnight." |
| `g6.epi` | after 6-10 | A Long Life | main | `stage:6-10` → `cue({ bg: 'shelter' })` (Itomachi, the next morning) | Tsubaki to Kohaku: "You'll live a long time. In a house by the lake. Too many tea plants. It's the only thing I ever looked up."; at the Spindle's foot a frozen nest far too big for any bird; Sensei picks a thread of grey knitted wool out of the ice; choice "Captain, look at this." / "(Show Hikari the thread.)" (both: Sensei shows it, the Act 5 turn holds; Hikari: "We keep it. And we keep looking."); back at Shelter 3, Ouka: "People need a festival."; the Starfall Trial opens (narration) |
| `g6.doorie` | after 6-10 | For the Tea | side | `shelter` (daylit) | Tenka, embarrassed, gives Mahiru her Doorie keychain to say thank you for the tea; "She holds doors. For luck."; Mahiru clips it to her bag and apologises to it; Hikari passing with a tray |
| `g6.star1` | before `side-6-starfall` | Guard the Night Sky | side (bond, decision 10) | `stage:side-6-starfall@night` | the observatory's broken deck under the cracked dome; the cadets' duty board: "Night-sky watch: Cadet Commander {name:tsubaki}"; the Commander told them to guard the academy's night sky; star-map shards still fall; Kohaku: "Then we guard it. Both academies. Yours and mine."; Hikari: "The sky's falling, Sentinels. Let's catch it." |
| `g6.star2` | after `side-6-starfall` | Not Your Past | side (bond) | `stage:side-6-starfall@night` | the last shard falls and the dome is quiet; Tsubaki tries to put her coat round Kohaku; Kohaku: "I'm not your past. I'm your friend."; Tsubaki, after a long moment: "…Noted. Twenty-one oh four."; Hikari leaves them the deck |

Writing rules as g1-g5 (8-18 spoken lines, ≤ 1 choice, ≤ 4 portraits, ≤ 3 on stage, lines ≤ 110 characters, titles
≤ 32, Hikari in every main episode, shipped faces only, `{name:id}` tokens). **Faces fit beats:** `g6.chair`, `g6.boss`
and `g6.after` use only `determined`, `sad`, `surprise`, `question`, `deadpan` and one `smile` at the kindness (Kage's
"SUSPICIOUS." is `deadpan`). **Absence (STRICT):** `isAbsenceAct` becomes `/^g[3-6]\./` (Kohaku is "trapped" and
"unharmed"; the city "fell", never how). **Mystery:** no dragon, wyvern, wyrm, drake, hatchling, egg, chick,
matriarch, lizard or reptile ("any bird" is the spec's own phrase); "nest" and "grey wool" only in `g6.epi`; no name is
read from the blacked-out entry; nobody calls the notch the Dawnblade's or links Hikari, Mahiru and the Commander.
**Continuity:** Toki is unwoven: no Toki plate or name anywhere in g6 and no line that the Last Watch was three; Tenka
speaks as herself; Tsubaki, Kohaku and the Commander are plates; nobody "joins". **Places and times (Step 5 lesson):**
the crossing starts in the drowned pump hall; the night watch is `@night`; the briefing room is narrated inside a
lecture tower over the tower-ring skyline; the morning after and the keychain play in the daylit shelter; the Starfall
Deck has its own drawn place (`STAGE_BG_RE` and the Act II theme fallback learn `side-<c>-<slug>` ids). Speakers as
themselves: Hikari, Yuki, Kage, Yuzuha, Chika, Ouka (a Noon native, as Kinu in g2), Tenka; Iroha `ifUnit`; Mahiru and
the rest as plates. Sensei is never gendered (the coat pocket is all that is narrated). `ACT_SCENE_IDS['6:2'] =
['g6.pro', 'g6.sleep', 'g6.mid', 'g6.chair', 'g6.boss', 'g6.after', 'g6.epi', 'g6.doorie', 'g6.star1', 'g6.star2']`;
scenes 75 → 85.

**Tests.** content (count, archive order, Act II shape for chapter 6: six main, four side, no join; `ARC1_MAIN.g6`;
Hikari in main episodes; the absence and g6 mystery lints; no Toki in g6; no "joins"; the face rule above; the card
line and Chika's line present), `storySceneIndex`, story system (`g6.pro` before 6-6; three after-scenes queue in order
after 6-10; `g6.star1` plays when the side stage is opened and `g6.star2` on its first clear; the side stage never
queues a chapter scene), the backgrounds test (every bg resolves, including `stage:side-6-starfall@night`).
`node e2e/story.mjs`.

---

## 8. Step 6 verify, the phone perf measure, owner board, commits, risks

### 8.1 Gates
Full `npm test`; `node e2e/smoke.mjs`; `node e2e/engines.mjs`; `node e2e/story.mjs`; `e2e/gate-arc.mjs` extended:
chapter 6's Act II waits for 6-5 and 5-10; 6-6 plays `g6.pro`; on 6-7 an enemy on the viaduct is drawn raised and is
hit (its HP drops while `elev > 0.5`), and an enemy under the deck is hidden then reappears; 6-8 dims during the
eclipse; 6-9 shows both transit pads and an enemy jumping between them; 6-10 shows the Vesper Gate, Rime Wisps from
wave 28 and the Gatekeeper's boss bar on the last wave; the side card appears after 6-10's clear and its battle opens
with `g6.star1`; the side stage is absent from the co-op stage list. `nice npx vite build`, `rm -rf dist`. Run e2e on
a quiet machine.

### 8.2 The phone perf measure (§19 Step 6 gate: "perf measure on a mid phone")
CI and the cloud container have no phone and no GPU (Chromium runs software WebGL), so the gate is two measurements
plus the owner's own phone:
1. **Terrain budget (node, absolute).** `tests/render/terrainHash.js` recording canvas on the six real maps at high,
   medium and low: ≤ 10 draw calls + ≤ 3 instanced movers, < 90k triangles high / < 65k low, ≤ 250 glows, ≤ 40
   emitters, 0 sorted transparent. Rows in `STEP6_HASHES.md` (§18.7 expects `vesper` 65-75k).
2. **In-battle frame time (Chromium, relative).** A new `e2e/map-perf.mjs` on the `e2e/solo-freeplay-perf.mjs`
   pattern: viewport 844×390, `deviceScaleFactor` 2, `isMobile`, quality `high` (the phone default), CPU throttled 4×
   through CDP `Emulation.setCPUThrottlingRate` (a mid phone's CPU against a laptop core); for each stage it opens
   `#/battle?stage=<id>&difficulty=normal`, places the same fixed 12-girl board through `ui.act.place`, starts wave 10
   at speed 1, warms 5 s, then records 20 s of rAF deltas (median, p95, worst), `renderer.info.render.calls` /
   `triangles` and the sim's step time. Stages: the references 1-6 (the busiest `city` board), 3-9 (`burning`) and 5-8
   (the Noon Gate mover), then 6-6…6-10 and the side stage. Three runs; the median of each statistic.
   **Gate:** on every Act 6 board and the side board, median frame time ≤ 1.10 × and p95 ≤ 1.15 × the worst reference
   board measured in the same run; in-battle triangles ≤ the worst reference + 15k; 0 page errors; at quality `low`
   every Act 6 board ≤ the worst reference at `low`. Numbers in `STEP6_HASHES.md` with the machine and the Chromium
   label. Absolute numbers are never compared across runs or machines.
3. **The owner's phone** (owner question): after the release ships, the owner plays 6-7 and 6-10 for a minute on their
   own mid phone; if it stutters where 5-8 does not, the first lever is the towers' far LOD, then holo glows, then
   snow density (never the road or the gates).

### 8.3 Shots and boards
844×390 and 1280×720: each map mid-battle (6-7 with an enemy on the viaduct and one under it; 6-8 in blackout; 6-9 the
pads and the plaza crossing; 6-10 the Vesper Gate, the Spindle, the Rime Wisps and the Gatekeeper), each scene, the
chapter-6 row with the side card (+ 390×844), the construct and ghost bestiary cards, a labelled greyscale contact
sheet of 6-6, 6-7, 6-9 and 6-10. Boards `docs/review/gate-arc/step6/*.jpg` (≤ 400 KB); draft PR #28 updated.

### 8.4 Commits
(1) S6a render; (2) S6v the viaduct + the tracks golden (the golden first, in its own commit, before any `track.js`
change); (3) maps; (4) the machines, the Rime Wisp, the Gatekeeper; (5) stages, rules, skins, the side stage; (6)
story; (7) tests, balance and perf rows, docs (`CONTRACTS.md`: `THEMES.vesper`, `ruined: 'frozen'`, the viaduct markers
and crossing rule, `track.viaducts`, `kind: 'side'` and `anchor`, the `rime_` fall style; `docs/CAMPAIGN.md` Vesperline
table and the side stage; HANDOFF §3 row). Push after each.

### 8.5 Risks
1. **The viaduct touches shared geometry**: the tracks golden is taken first and must stay identical; `viaducts` is
   written only when present; fallback two overpasses (§4).
2. **Shape clashes**: the side map vs Blossom Court / Drowned Willow, 6-7 vs Reservoir Park, 6-9 vs Fireworks Square /
   Wildflower Meadow, 6-6 vs Takoyaki Row and the meander rule. The sketches pass today; rerun the checker on every nudge.
3. **Over-covered crossings** (6-9, 6-10, side) make opening-wave stages (5-8's lesson): fix the map, not the start.
4. **White glass on a white road**: the road stays the lightest band; darken glass or ground, never the road.
5. **The side kind** touches every `kind === 'campaign'` reader: one pass each and a test that it adds no mission,
   medal, ribbon, trophy or co-op entry.
6. **Tone**: the chair, the recording and the flicker sit on the absence line (strict story-safety review); Doorie
   stays a round faceless mascot.
7. **Perf** is measured relative to shipped boards in a software-GL browser; it catches regressions, not absolute phone
   speed, so the owner's phone check stays.

---

## 9. Owner questions (defaults taken)

- **The side stage is "The Star Dome"** (renamed Oct 29): v0.1.59 shipped the Kohaku & Tsubaki duo () with
  an LR trial already called "Starfall Trial" (8-5 Nightmare as a stand-in until her own stage exists). Default: two
  separate things for now. Option: make  the duo's LR trial (its solo / no-support / duo-placed rules)
  and let  /  become the duo's bond scenes.
- **The duo's bio** (, "two friends from the academy… Tsubaki of the security club's cadet corps")
  differs from the Gate Arc story (Tsubaki is Vesperline's Last Watch cadet commander and meets Kohaku in g5). Default:
  leave both; the owner picks which is canon.
- **Follow-up (display, staff heroes):** Norika's barricades on 6-7's raised viaduct deck draw at ground height under the
  deck (src/render/staffFx.js); enemies stop on top. Lift by the deck height (render only).

- **Machines and the Rime Wisp without new art:** the Lattice Shell (beetle), Vesper Aegis (automaton), Vesper Warden
  (warden) and Gatekeeper Unit 01 (colossus) ship as white and ice-blue glass with cyan and dark outlines on the
  shipped construct bodies; the Rime Wisp is the shipped ghost wisp in violet-black with a pale outline and no crystals
  (the ghost model has none). Deferred art: the `halo` variant, rime crystals, Vesperline-only bodies. OK?
- **Families:** the machines stay in the Constructs tab and the Rime Wisp in the Ghosts tab (no "Rimebound" tab yet).
- **Gatekeeper Unit 01:** the Iron Colossus body at miniboss size, 3,950 HP, a glass shell, calls two Line Sentries at
  66 %, a thicker shell at 33 %, an amber heater glow (the one warm thing on the board).
- **The viaduct plays like a long overpass:** every girl can hit enemies on it, map vents skip them, nobody builds on
  or under it; no "only long-range girls can reach it" rule (the spec's default).
- **The Starfall Trial (`side-6-starfall`):** opens on 6-10's first clear as a small card after 6-10; 6-10's numbers ×
  1.1; first-clear coins and books, medal gems at the Act II rate (110), chapter 7's drops, no recruit ticket, no
  achievement; Easy / Normal / Hard; **not in co-op** and no freeplay. Should it pay more (it was planned as the LR
  duo's stage), or wait for the duo?
- **The duo's two scenes** play as side scenes (0 gems) before and after the Starfall Trial, titled "Guard the Night
  Sky" and "Not Your Past", and move to the duo's bond memories when Kohaku and Tsubaki become a unit.
- **`g6.doorie` is renamed "For the Tea"** so that "Doorie" stays Act 7's epilogue title.
- **6-9 uses the Shifting Stars rule** (first seen at 8-4) as the city's transit pads, so chapter-6 players meet it
  early, under its skin; and its phi has three crossings (two light-bridges and the plaza's flat crossing).
- **The Vesper Aegis arrives at 6-7**, not 6-6 (one new machine per stage).
- **Story places are drawn** (the causeway, the sky-rail, the museum rotunda, the tower ring, the Spindle, the
  Starfall Deck at night); painted Vesperline pictures could replace them. The briefing room plays over the tower-ring
  skyline; the keychain scene in the daylit shelter.
- **Perf:** which phone should the owner check 6-7 and 6-10 on after the release? (The branch gate is a throttled
  Chromium measure against 1-6, 3-9 and 5-8.)
- **The living Vesperline look** is built and tested now but appears only in Arc 2 and the cliffhanger still.
- Deferred: in-battle radio lines (Tenka on 6-8), the x-10 cosmetics (*Upstream*), a Vesperline music cue (the boards
  use the Foundry's battle family), portraits for Tsubaki, Kohaku and Commander Yūhi, a Captain's Journal page for rule
  8 (Tenka says it aloud in `g6.after`), per-lane gate looks (Step 8).
