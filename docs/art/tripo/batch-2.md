# Tripo batch 2 (Oct 31, 2026): the owner's website batch

The owner generated the 54 rows of the Claude in Chrome checklist (`docs/art/tripo/chrome-batch-1.md`, on
`claude/sakura-sentinels`) on the Tripo **website** with their web credits and sent the downloads as five zips
(4.3 GB). The zips held **378 GLBs** from the owner's whole Tripo library, named by Tripo's own titles ("clock tower
3d model.glb"), and no `checklist.txt`, so every row was matched by eye from a turntable render of all 378
(contact sheets, outside the repo). Processed by `tools/tripo/` on branch `feature/tripo-batch-2` (off `main`
v0.1.67). Boards: `docs/art/tripo/batch-2-board.jpg` (heroes), `batch-2-board-enemies.jpg`, `batch-2-board-props.jpg`
(Hold the Line, the dragon head, the landmarks, the gear looks, the battle at 844x390).

**No Tripo API credits were used** (balance 365, as after batch 1). The raw downloads are not in git.

## Content check

Every model used here was looked at in four views: the four heroes are fully and modestly dressed (Luna's gown, Nami's
captain coat, Kanna's club jacket and trousers, Yoriko's stage coat), all chibi; no gore anywhere (deaths topple,
flatten or float away); no text or logos except the rejected scoreboard. Outside the 54 rows the library also holds
figures that would be rejected on sight: the wolf, cat and pink fox girls (`anime*wolf girl`, `cat girl`, `wolf girl`,
`pink fox girl`, `anthropomorphic fox girl`: leotard / bodysuit looks with bare legs). None of them is used.

## Rows

| # | pri | id | status | source and result |
|---|---|---|---|---|
| 1 | P1 | `norika_hold_line` | **done** | from “construction barrier 3d model.glb”; `props/norika_hold_line.glb` 39,664 B, 800 tris; staffFx Hold the Line barriers |
| 2 | P1 | `gear_spirit_hair` | **done** (icon source) | from “hair clip 3d model.glb”; `tools/blender/items/sources/tripo/gear_spirit_hair.glb` 112,712 B, 3,000 tris; not baked into an icon yet (item-art session) |
| 3 | P1 | `gear_spirit_necklace` | **done** (icon source) | from “heart pendant 3d model.glb”; `tools/blender/items/sources/tripo/gear_spirit_necklace.glb` 136,424 B, 3,000 tris; not baked into an icon yet (item-art session) |
| 4 | P1 | `gear_freeze_hair` | **done** (icon source) | from “pause button 3d model.glb”; `tools/blender/items/sources/tripo/gear_freeze_hair.glb` 99,196 B, 3,000 tris; not baked into an icon yet (item-art session) |
| 5 | P1 | `gear_freeze_necklace` | **done** (icon source) | from “pocket watch 3d model.glb”; `tools/blender/items/sources/tripo/gear_freeze_necklace.glb` 118,888 B, 2,999 tris; not baked into an icon yet (item-art session) |
| 6 | P1 | `gear_geometry_hair` | **done** (icon source) | from “triangle warning 3d model.glb”; `tools/blender/items/sources/tripo/gear_geometry_hair.glb` 99,764 B, 3,000 tris; not baked into an icon yet (item-art session) |
| 7 | P1 | `gear_geometry_necklace` | **done** (icon source) | from “round pendant 3d model.glb”; `tools/blender/items/sources/tripo/gear_geometry_necklace.glb` 156,892 B, 3,000 tris; not baked into an icon yet (item-art session) |
| 8 | P1 | `gear_party_hair` | **done** (icon source) | from “purple sneaker 3d model (2).glb”; `tools/blender/items/sources/tripo/gear_party_hair.glb` 135,048 B, 3,000 tris; not baked into an icon yet (item-art session) |
| 9 | P1 | `gear_party_necklace` | **done** (icon source) | from “purple cone prop 3d model.glb”; `tools/blender/items/sources/tripo/gear_party_necklace.glb` 123,316 B, 3,000 tris; not baked into an icon yet (item-art session) |
| 10 | P1 | `gear_treasurer_hair` | **done** (icon source) | from “teal handheld calculator 3d model.glb”; `tools/blender/items/sources/tripo/gear_treasurer_hair.glb` 113,744 B, 3,000 tris; not baked into an icon yet (item-art session) |
| 11 | P1 | `gear_treasurer_necklace` | **done** (icon source) | from “pendant necklace 3d model.glb”; `tools/blender/items/sources/tripo/gear_treasurer_necklace.glb` 130,212 B, 3,000 tris; not baked into an icon yet (item-art session) |
| 12 | P1 | `gear_power_hair` | **done** (icon source) | from “green lightning bolt 3d model.glb”; `tools/blender/items/sources/tripo/gear_power_hair.glb` 101,448 B, 3,000 tris; not baked into an icon yet (item-art session) |
| 13 | P1 | `gear_power_necklace` | **done** (icon source) | from “energy canister pendant 3d model.glb”; `tools/blender/items/sources/tripo/gear_power_necklace.glb` 117,852 B, 3,000 tris; not baked into an icon yet (item-art session) |
| 14 | P1 | `gear_hair` | **done** (icon source) | from “pink flower hairclip 3d model.glb”; `tools/blender/items/sources/tripo/gear_hair.glb` 110,124 B, 2,999 tris; not baked into an icon yet (item-art session) |
| 15 | P1 | `gear_necklace` | **done** (icon source) | from “pink heart locket 3d model.glb”; `tools/blender/items/sources/tripo/gear_necklace.glb` 117,712 B, 3,000 tris; not baked into an icon yet (item-art session) |
| 16 | P2 | `luna` | **done** | from “anime fox girl 3d model.glb”; `characters/luna.glb` 732,868 B, 19,999 tris / `.lod.glb` 393,432 B, 9,000 tris; auto-rigged, `idle walk attack_* cheer hurt` |
| 17 | P2 | `nami` | **done** | from “stylized chibi naval captain 3d model.glb”; `characters/nami.glb` 773,204 B, 20,000 tris / `.lod.glb` 406,180 B, 8,999 tris; auto-rigged, `idle walk attack_* cheer hurt` |
| 18 | P2 | `kanna` | **done** | from “chibi anime girl 3d model (2).glb”; `characters/kanna.glb` 765,344 B, 19,999 tris / `.lod.glb` 400,684 B, 9,000 tris; auto-rigged, `idle walk attack_* cheer hurt` |
| 19 | P2 | `yoriko` | **done** | from “3d chibi character.glb”; `characters/yoriko.glb` 698,764 B, 19,999 tris / `.lod.glb` 372,400 B, 8,999 tris; auto-rigged, `idle walk attack_* cheer hurt` |
| 20 | P2 | `seiran` | **missing** | no download matches her (golden horns, flight jacket, storm lance); she keeps her Blender figure |
| 21 | P2 | `seiran_sky_dragon` | **partly** | head from “dragon head 3d model.glb”: `props/seiran_dragon_head.glb` 159,740 B, 3,000 tris (rosterFx head); the tail download is a loose J curve with no clear joint, so the body beads and tail stay procedural (the built tail is not shipped). The head is as tall as the procedural head (0.45, review r1 L2: it read ~1.4× bigger at first) and faces where it flies (e2e) |
| 22 | P2 | `dragon_ashwing` | **done** | from “dragon 3d model (3).glb”; `enemies/tripo/dragon_ashwing.glb` 481,536 B, 12,000 tris |
| 23 | P2 | `fp_eclipse_wyrm` | **done** | from “dragon 3d model (2).glb”; `enemies/tripo/fp_eclipse_wyrm.glb` 647,860 B, 20,000 tris |
| 24 | P2 | `grave_lych` | **missing** | no crowned lich with a staff among the downloads (the hooded figures have no crown); keeps the family mesh |
| 25 | P2 | `fp_gloom_regent` | **done** | from “stylized character 3d model (2).glb”; `enemies/tripo/fp_gloom_regent.glb` 745,032 B, 19,999 tris |
| 26 | P2 | `fp_hyakki_daimyo` | **done** | from “samurai demon 3d model.glb”; `enemies/tripo/fp_hyakki_daimyo.glb` 926,356 B, 20,000 tris |
| 27 | P2 | `iron_colossus` | **done** | from “mecha robot 3d model.glb”; `enemies/tripo/iron_colossus.glb` 605,096 B, 11,999 tris |
| 28 | P2 | `fp_foundry_titan` | **done** | from “steampunk robot 3d model.glb”; `enemies/tripo/fp_foundry_titan.glb` 835,120 B, 20,000 tris |
| 29 | P2 | `slime_green` | **done** | from “cute slime 3d model (3).glb”; `enemies/tripo/slime_green.glb` 188,280 B, 5,000 tris |
| 30 | P2 | `goblin_runner` | **done** | from “green alien character 3d model.glb”; `enemies/tripo/goblin_runner.glb` 222,004 B, 4,999 tris |
| 31 | P2 | `orc_grunt` | **done** | from “orc warrior 3d model (2).glb”; `enemies/tripo/orc_grunt.glb` 253,280 B, 4,999 tris |
| 32 | P2 | `ghost_wisp` | **done** | from “ghost candle 3d model.glb”; `enemies/tripo/ghost_wisp.glb` 183,984 B, 5,000 tris |
| 33 | P2 | `ghoul_bonewalker` | **done** | from “cute skeleton 3d model.glb”; `enemies/tripo/ghoul_bonewalker.glb` 284,664 B, 4,999 tris |
| 34 | P2 | `oni_brute` | **done** | from “demon character 3d model.glb”; `enemies/tripo/oni_brute.glb` 254,728 B, 4,999 tris |
| 35 | P2 | `lizard_skink` | **done** | from “cartoon dinosaur 3d model.glb”; `enemies/tripo/lizard_skink.glb` 188,832 B, 5,000 tris |
| 36 | P2 | `construct_cogling` | **done** | from “steampunk robot 3d model (3).glb”; `enemies/tripo/construct_cogling.glb` 258,592 B, 4,999 tris |
| 37 | P2 | `beast_wolf` | **done** | from “cartoon wolf 3d model.glb”; `enemies/tripo/beast_wolf.glb` 240,964 B, 4,999 tris |
| 38 | P2 | `fae_sprite` | **done** | from “cute fairy 3d model (2).glb”; `enemies/tripo/fae_sprite.glb` 239,596 B, 4,999 tris |
| 39 | P2 | `plant_sprout` | **done** | from “cute plant creature 3d model.glb”; `enemies/tripo/plant_sprout.glb` 186,300 B, 5,000 tris |
| 40 | P2 | `dragon_wyvern` | **done** | from “dragon character 3d model.glb”; `enemies/tripo/dragon_wyvern.glb` 214,520 B, 4,999 tris |
| 41 | P2 | `dryFountain` | **done** | from “stone fountain 3d model.glb”; `props/landmarks/dryFountain.glb` 211,920 B, 4,000 tris |
| 42 | P2 | `oldLamp` | **done** | from “ornate street lamp 3d model.glb”; `props/landmarks/oldLamp.glb` 138,168 B, 2,500 tris |
| 43 | P2 | `clockTower` | **done** | from “clock tower 3d model.glb”; `props/landmarks/clockTower.glb` 271,204 B, 5,000 tris |
| 44 | P2 | `doorieStatue` | **done** | from “stylized panda 3d model.glb”; `props/landmarks/doorieStatue.glb` 107,972 B, 3,000 tris |
| 45 | P2 | `lockGate` | **done** | from “industrial water gate 3d model.glb”; `props/landmarks/lockGate.glb` 203,836 B, 3,998 tris |
| 46 | P2 | `greatWillow` | **done** | from “fantasy tree 3d model.glb”; `props/landmarks/greatWillow.glb` 404,396 B, 6,000 tris |
| 47 | P2 | `spindle` | **done** | from “futuristic tower 3d model.glb”; `props/landmarks/spindle.glb` 180,004 B, 4,000 tris |
| 48 | P2 | `hammerTear` | built, **not wired** | from “glowing crystal shard 3d model.glb”; the procedural tear keeps its pulsing glow (the point of the piece); file not shipped |
| 49 | P2 | `finishGantry` | **done** | from “race finish line 3d model.glb”; `props/landmarks/finishGantry.glb` 116,960 B, 3,000 tris |
| 50 | P2 | `scoreboard` | **rejected** | “digital scoreboard 3d model.glb” has printed text (HOME / GUEST / PERIOD / TIME); the brief asked for blank digits, no text |
| 51 | P2 | `ticketGates` | **done** | from “ice pedestal 3d model.glb”; `props/landmarks/ticketGates.glb` 90,992 B, 3,000 tris |
| 52 | P2 | `schoolBlock` | **done** | from “school building 3d model.glb”; `props/landmarks/schoolBlock.glb` 265,104 B, 5,000 tris; classroom wing (variant 0) only |
| 53 | P2 | `runeRing` | built, **not wired** | from “mystical stone circle 3d model.glb”; a ground feature (painted rune ring / merged ice), not a placed prop: no swap point yet; file not shipped |
| 54 | P2 | `icefall` | built, **not wired** | from “ice waterfall 3d model.glb”; a ground feature (painted rune ring / merged ice), not a placed prop: no swap point yet; file not shipped |

Totals: 47 done, 1 partly (the sky dragon: head only), 2 missing (`seiran`, `grave_lych`), 1 rejected (`scoreboard`),
3 built but not wired (`hammerTear`, `runeRing`, `icefall`). Re-rolls for the missing and rejected rows can go in the
next website batch (no API re-roll was needed or made).

## How they were made

* **Heroes** (`tools/tripo/build_tripo_chibi.py --source <download> --id <id>`): the website downloads are unrigged,
  so `tools/tripo/tripolib/autorig.py` fits a biped rig from the mesh (the arm line is the widest slice between 42 and
  60 % of the height; hands, shoulders, feet from the vertices; the hips at 0.55 of the shoulder height), skins it with
  Blender's automatic weights, gives any unweighted vertex its nearest bone, and keeps arm weights off hair hanging
  beside the arms (Kanna's twin tails; her arm line is pinned at 0.525). The bones carry batch 1's names, so the clips
  of `tripolib/clips_staff.py` animate them (`idle walk attack_<kind> cheer hurt`; arms come down 62° from the
  T-pose). Decimated to 20k / 9k before rigging; base colour WebP 1024² / 512² (the normal and metal/roughness maps
  of the downloads are dropped); battle height 1.224 like the other imported figures; `source: 'tripo'`.
* **Enemies** (`build_tripo_enemy.py`): humanoids (goblin, orc, ghoul, oni, lizard, the Daimyo, the Colossus, the
  Titan) auto-rigged like the heroes with `HumanoidClips`; the rest rigid (`hover`: ghost, fairy, wyvern, the two
  dragons, the Regent; `vehicle`: wolf, cogling; `blob`, new: slime and sprout hop and squash, and flatten for their
  poof). Budgets by tier: 5k / 512², bosses 12k and titans 20k / 1024².
* **Props** (`build_tripo_prop.py`): the Hold the Line segment (800 tris), the dragon head (`--center`, 3k tris), the
  landmarks (0.9 units tall, the game fits them), the gear looks (3k tris, 0.5 tall, 512²).

## Runtime (display only; sim id unchanged)

* Heroes: regular imported figures (manifest `source: 'tripo'`), replacing the temporary Blender chibis. Yoriko's doll
  follows her `hand_L` as before.
* Enemies: added to `glbEnemy.js` `TRIPO_ENEMIES` (the batch-1 path: own file, family mesh fallback, preloaded with
  the stage's families by `enemyModelKeys`). An enemy with a Tripo model now wears it instead of its family mesh and
  variant pieces.
* `src/render/tripoLandmarks.js`: in a browser, a map piece listed in `TRIPO_LANDMARKS` is placed as its own group;
  when `public/models/props/landmarks/<type>.glb` arrives, the procedural meshes are hidden and the model takes their
  place, fitted into their bounding box (by height, never wider than 1.1 × the footprint); glows and emitters stay,
  a blackout still dims its glow. In node (tests) every map is built exactly as before.
* Its glow meshes (lamps, lit windows: clock tower, great willow, spindle, ticket gates) stay on over the model and
  stay out of the fit, at night and in a blackout (review r1 M1; `tests/render/tripoLandmarks.test.js` builds every
  landmark stage with a mocked loader).
* Enemy LODs (review r1 L3): the twelve family enemies also ship `<id>.lod.glb` (~2k triangles, 256² texture,
  87–147 KB); below quality high the battle asks for them (`setEnemyDetail`, `TRIPO_ENEMY_LODS`); bosses and titans
  keep one file. A busy 1-6 wave at medium quality (60 family enemies, e2e): enemy triangles 599,920 → 239,910, frame
  648k → 288k triangles; draw calls unchanged (140: a LOD swaps geometry, not the number of meshes).
* `staffFx.js`: Hold the Line barriers swap to `norika_hold_line` like the barricades. `rosterFx.js`: the sky dragon's
  head swaps to `seiran_dragon_head` (body beads and tail procedural).
* Gear: `tools/blender/items/sources/tripo/*.glb` + README, for the item-art session; `itemArt` untouched. (Review r1
  L4 asked to move them out of git if that adds nothing: they are already in this branch's history, so they stay.)
* Tests: `tests/models/tripo.test.js` (enemies by tier, props, landmarks, `swapLandmark`), the `tripo` branch of
  `tests/models/glb.test.js` (the four heroes). e2e: `node e2e/tripo-batch2.mjs --shots <dir>` (the heroes, enemies and landmarks; Hold the Line and the dragon head
  after their ultimates, with zoomed shots; the busy-wave LOD numbers).

## Open items for the owner board

* Seiran and the Grave Lych: no matching download (re-roll in the next website batch). Seiran's dragon tail and the
  scoreboard (without text) too.
* The heroes' arms are short chibi arms on a fitted rig: the clips move them less than a Tripo-rigged figure's; no
  eye boxes (no blink); hair and coats follow the body rigidly.
* `runeRing` and `icefall` are built but have no swap point (ground features); `hammerTear` keeps its procedural glow.
* The Ash Wyvern and the dragons hover with rigid clips (no wing flaps).
