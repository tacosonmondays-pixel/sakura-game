# Tripo batch 1 (Oct 31, 2026): the P1 list

The first Tripo batch: the eleven P1 models of `docs/art/ASSET_WISHLIST.md` (branch `docs/asset-wishlist`), made with
Tripo's v2 openapi (`text_to_model`, textured, then `animate_rig` for the bipeds) and processed in Blender (bpy 4.2)
by `tools/tripo/`. Board: `docs/art/tripo/batch-1-board.png` (every processed file in four views and one frame per
clip, plus the battle at 844x390). Branch `feature/tripo-batch-1` off `release/v0.1.66`. Display only: the sim id is
unchanged (`5ba58b3fc229`), no `COOP_PROTOCOL` bump.

The raw Tripo downloads are not in git (keep them in `tools/art/src/tripo/batch-1/` on the owner's machine; the task
ids below fetch them again from Tripo while its links last).

## Credits

Budget 350. Balance 705 before, **365 after: 340 spent**. Per task: `text_to_model` with texture = 20 credits,
`animate_rig` = 25, `animate_prerigcheck` = 0.

| # | model | task | type | credits | result |
|---|---|---|---|---|---|
| - | kogane (try 1) | `305930a2-f309-4b7a-9810-930a9998a9ec` | text_to_model | 20 | rejected: our script sent her portrait (illustration) prompt by mistake, so she came out with realistic proportions, not chibi; modest. Re-sent with the 3D prompt (below) |
| 1 | kogane | `6ddee26e-3686-4234-add8-4cca9069beba` | text_to_model | 20 | used |
| 1 | kogane rig check | `3333512a-ca25-4037-b2a1-08c06e808a21` | animate_prerigcheck | 0 | biped, riggable |
| 1 | kogane rig | `c98388c4-95f5-4d1e-aeea-28afaeaaf3f9` | animate_rig (biped, spec tripo) | 25 | used |
| 2 | norika | `d65e6d8c-2566-4d2b-af00-639571d268a8` | text_to_model | 20 | used |
| 2 | norika rig | `a260ebba-9e93-42c9-8d51-628d1f940650` | animate_rig | 25 | used |
| 3 | big_yellow | `1c3efff1-53a5-463d-b8e2-02148bdc6148` | text_to_model | 20 | used |
| 4 | norika_barricade | `08c1851a-df28-4640-bc54-5dc1b558f992` | text_to_model | 20 | used |
| 5 | norika_hold_line | `6246b602-0ee6-4256-82c9-ed7e8a94aa04` | text_to_model | 20 | **rejected**: scattered flat fragments. Not re-rolled (it would pass the 350 budget); stays procedural |
| 6 | suzu_bell | `91471fbd-28fb-43e7-9f04-9d2d4a2b8d5f` | text_to_model | 20 | used |
| 7 | brigade_trooper | `5f3ce63b-8b53-47d9-9e74-a9c916a2b4a3` | text_to_model | 20 | used |
| 7 | trooper rig check | `f97f27cd-e7f1-4d3c-878c-8c271990ad17` | animate_prerigcheck | 0 | biped |
| 7 | trooper rig | `deb3c5e5-6e0a-4cc1-b05c-73cc2c2dc077` | animate_rig | 25 | used |
| 8 | brigade_shieldline | `12b5387a-af24-4bf0-a5ad-1e27b749f549` | text_to_model | 20 | used |
| 8 | shieldline rig check | `ef5b3a3e-6aa3-41d5-98ef-9aee15cae99c` | animate_prerigcheck | 0 | biped |
| 8 | shieldline rig | `fc75a3d6-e307-489b-83f4-e7a1dbf273e5` | animate_rig | 25 | used |
| 9 | brigade_gnat | `d91d8ab2-85d4-445f-9c1d-fc6a6e10427b` | text_to_model | 20 | used (came out yellow-amber, not navy) |
| 10 | brigade_tortoise | `51b0b9b4-a913-4093-be20-fd70760796d5` | text_to_model | 20 | used (a cute face on the front) |
| 11 | brigade_badger | `f21ea2d4-8dc4-4127-8d66-46eb9adb62e7` | text_to_model | 20 | used |

Settings: the wishlist prompt of each row verbatim, negative prompt `realistic proportions, long legs, revealing
clothes, swimsuit, short skirt, cleavage, bare midriff, gore, blood, text, logo, base, pedestal, ground plane,
multiple characters, extra limbs`, `texture: true`, `pbr: false`, model version Tripo's default (v2.5-20250123),
`face_limit` = the budget (heroes 20000, Big Yellow 6000, elites 8000, normals 5000, barricade 1200, bell 1500,
barrier 800). No Tripo animations were bought: every clip is authored in Blender.

## Content check

Every model was looked at (Tripo's render, then our four-view sheets) before processing: the two staff heroes are
fully clothed in their work uniforms (hard hat, hi-vis jacket and sash, trousers, boots), nothing revealing, chibi
proportions; the troopers are fully armoured with visors; the props and vehicles are toys. Nothing was rejected for
content. Rejected for quality: Kogane try 1 (our prompt mix-up, not chibi) and the Hold the Line barrier (broken).

## What shipped

| id | file(s) | triangles | size | rig and clips | wired in |
|---|---|---|---|---|---|
| kogane | `characters/kogane.glb` / `.lod.glb` | 19,970 / 8,999 | 604,972 / 328,676 B | Tripo biped renamed (`root hips spine chest neck head shoulder/upper_arm/forearm/hand_L/R thigh/shin/foot/toe_L/R` + twist bones); `idle walk attack_wrench cheer hurt` | manifest `source: 'tripo'`; out of `STANDIN_UNITS` |
| norika | `characters/norika.glb` / `.lod.glb` | 19,996 / 8,999 | 573,680 / 308,908 B | same; `attack_sign` (the STOP paddle raised and pushed) | same |
| big_yellow | `props/big_yellow.glb` | 5,990 | 220,484 B | static (staffFx moves it) | staffFx walker + plow, instead of the box walker |
| norika_barricade | `props/norika_barricade.glb` | 800 | 57,432 B | static | staffFx barricades |
| suzu_bell | `props/suzu_bell.glb` | 800 | 59,360 B | static (swings on Bell Toll) | staffFx bells; actors.js drops the flat rune once they draw |
| brigade_trooper | `enemies/tripo/brigade_trooper.glb` | 5,000 | 187,980 B | Tripo biped; `move idle hit death special` | glbEnemy per-id model |
| brigade_shieldline | `enemies/tripo/brigade_shieldline.glb` | 4,990 | 190,256 B | Tripo biped; shield held in front | same |
| brigade_gnat | `enemies/tripo/brigade_gnat.glb` | 4,992 | 164,520 B | rigid `root` + `body`; hover clips | same |
| brigade_tortoise | `enemies/tripo/brigade_tortoise.glb` | 7,990 | 300,208 B | rigid; vehicle clips | same |
| brigade_badger | `enemies/tripo/brigade_badger.glb` | 7,984 | 330,580 B | rigid; vehicle clips | same |

Textures: Tripo's 2048² base colour, shipped as WebP (heroes 1024², LOD 512²; elites and Big Yellow 1024²; the rest
512²). Phone packing is the Meshy pipeline's `tools/meshy/lib/pack.py` (KHR_mesh_quantization + EXT_texture_webp,
**no meshopt or Draco**). Heroes are 1.224 game units tall like the imported Meshy figures.

## Prompts (verbatim, as sent)

The `prompt` of each `text_to_model` task, copied from the request we sent (the same text Tripo echoes back in
the task's `input.prompt`). The negative prompt and settings are in "Credits" above.

1. `kogane` (task `6ddee26e-3686-4234-add8-4cca9069beba`, face_limit 20000):

   > Facilities Crew Chief: chibi figure 2.5-3 heads tall, big round head, small soft body, short limbs, huge shiny anime eyes, light blush; an adult academy staff member as a slightly taller chibi (about 3 heads), professional outfit, modest, fully clothed; short messy brown hair, amber eyes, a white hard hat with a small sakura sticker and goggles on its brim, a safety-yellow work jacket with reflective tape over a navy staff polo, navy cargo work trousers, steel-toe boots, a big wrench. No halo (the game adds its own). A-pose (arms 45° down, feet slightly apart), facing front, gentle smile. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text.

2. `norika` (task `d65e6d8c-2566-4d2b-af00-639571d268a8`, face_limit 20000):

   > Traffic Safety Officer: chibi figure 2.5-3 heads tall, big round head, small soft body, short limbs, huge shiny anime eyes, light blush; an adult academy staff member as a slightly taller chibi (about 3 heads), professional outfit, modest, fully clothed; dark-brown hair in two low tied tails, blue eyes, a yellow safety cap, a navy staff blazer under a reflective lime high-visibility sash, white gloves, navy slacks, rain boots, a whistle on a lanyard, a round red STOP paddle on a short pole. No halo (the game adds its own). A-pose (arms 45° down, feet slightly apart), facing front, gentle smile. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text.

3. `big_yellow` (task `1c3efff1-53a5-463d-b8e2-02148bdc6148`, face_limit 6000):

   > Big Yellow: a little two-legged construction walker robot, safety yellow with navy trim and black-and-yellow hazard stripes, a rounded cab with a round window and a small sakura sticker, one arm with a rivet gun and one with a small plow blade, chunky bird-like legs, a warning light on top; cute toy-like proportions, about 1.75 times a chibi's height. Neutral standing pose. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. Nodes: `cab`, `arm_gun`, `arm_plow`, `leg_L`, `leg_R`, `light`.

4. `norika_barricade` (task `08c1851a-df28-4640-bc54-5dc1b558f992`, face_limit 1200):

   > A short road safety barricade: a white-and-red striped plank on two sturdy yellow A-frame legs with a small round amber warning light on top and reflective strips, toy-like proportions; soft anime style, clean rounded low-poly shapes, game-ready, single object

5. `norika_hold_line` (task `6246b602-0ee6-4256-82c9-ed7e8a94aa04`, face_limit 800):

   > A repeatable segment of low plastic traffic barrier, bright orange and white with a reflective stripe, interlocking ends, rounded toy-like shape; soft anime style, clean low-poly, game-ready, single object

6. `suzu_bell` (task `91471fbd-28fb-43e7-9f04-9d2d4a2b8d5f`, face_limit 1500):

   > A small festival bell trap that sits on a path: a golden temple bell hanging in a little wooden frame with teal ribbons and a red tassel, a pressure plate base, cheerful and toy-like; soft anime style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no text

7. `brigade_trooper` (task `5f3ce63b-8b53-47d9-9e74-a9c916a2b4a3`, face_limit 5000):

   > Response Trooper: a tower-defense enemy, a chibi city response trooper in navy padded protective gear with amber reflective stripes, a full rounded helmet with a tinted visor (no face visible), a small round shield. cute, readable at small size, no gore, no blood. A-pose, arms away from the body, legs straight. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text.

8. `brigade_shieldline` (task `12b5387a-af24-4bf0-a5ad-1e27b749f549`, face_limit 5000):

   > Shieldline Trooper: a tower-defense enemy, a chibi city response trooper in navy padded gear with amber stripes, a full helmet with a tinted visor (no face visible), carrying a big transparent riot shield. cute, readable at small size, no gore, no blood. A-pose, arms away from the body, legs straight. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text.

9. `brigade_gnat` (task `d91d8ab2-85d4-445f-9c1d-fc6a6e10427b`, face_limit 5000):

   > Gnat Spotter: a tower-defense enemy, a small navy-and-amber quadcopter spotter drone with one camera eye and a beacon light. cute, readable at small size, no gore, no blood. neutral hovering pose, arms (if any) slightly away from the body. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text.

10. `brigade_tortoise` (task `51b0b9b4-a913-4093-be20-fd70760796d5`, face_limit 8000):

   > Tortoise: a tower-defense enemy, a small rounded armoured response van in navy and amber, chunky wheels, a rear hatch, warning lights on the roof, cute toy-like proportions. cute, readable at small size, no gore, no blood. neutral rest pose, wheels/tracks on the ground. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text.

11. `brigade_badger` (task `f21ea2d4-8dc4-4127-8d66-46eb9adb62e7`, face_limit 8000):

   > Badger: a tower-defense enemy, a small cute tracked armoured vehicle in navy and amber with a badger painted on the side, a short stubby turret, toy-like proportions. cute, readable at small size, no gore, no blood. neutral rest pose, wheels/tracks on the ground. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text.

## How to rebuild

```
python3.11 tools/tripo/build_tripo_chibi.py --source <kogane rig GLB> --id kogane
python3.11 tools/tripo/build_tripo_chibi.py --source <norika rig GLB> --id norika
python3.11 tools/tripo/build_tripo_prop.py --source <big_yellow.glb> --id big_yellow --node walker --height 0.72 --tris 6000 --tex 1024
python3.11 tools/tripo/build_tripo_prop.py --source <norika_barricade.glb> --id norika_barricade --node barricade --width 0.78 --tris 800
python3.11 tools/tripo/build_tripo_prop.py --source <suzu_bell.glb> --id suzu_bell --node bell --height 0.42 --tris 800
python3.11 tools/tripo/build_tripo_enemy.py --source <trooper rig GLB> --id brigade_trooper --kind humanoid
python3.11 tools/tripo/build_tripo_enemy.py --source <shieldline rig GLB> --id brigade_shieldline --kind humanoid --shield
python3.11 tools/tripo/build_tripo_enemy.py --source <gnat.glb> --id brigade_gnat --kind hover
python3.11 tools/tripo/build_tripo_enemy.py --source <tortoise.glb> --id brigade_tortoise --kind vehicle --tris 8000 --tex 1024
python3.11 tools/tripo/build_tripo_enemy.py --source <badger.glb> --id brigade_badger --kind vehicle --tris 8000 --tex 1024
python3.11 tools/tripo/render_preview.py --glb <file> --out <sheet.png>      # four views + one frame per clip
```

Needs `pip install bpy==4.2.0 numpy Pillow` (Python 3.11); the preview renders need `libegl1`.

## Runtime (display only)

* **Heroes:** regular imported figures (`glbChibi.js`, `style: 'textured'`). While the file loads, the procedural
  placeholder keeps the staff heroes' chin-up (`STANDIN_CHIN_UP`). The clips tilt the chin up (Kogane 14°, Norika 20°)
  so the brims leave the eyes visible from the 48° camera. No measured eye boxes yet, so they do not blink.
* **Enemies:** `glbEnemy.js` `TRIPO_ENEMIES` / `tripoEnemyKey(def)`: an enemy on that list loads
  `models/enemies/tripo/<id>.glb` (its own manifest beside it) through the family loader, under the key `tripo/<id>`,
  and wears it with a textured toon body (status tints, hit flash, outline, death and the Brigade fall styles as
  before). Until it arrives the construct family mesh (or the procedural one) stands in and is upgraded in place.
  Every enemy preload asks for it with the family (`enemyModelKeys(def)`: the battle's `stageFamilies`, freeplay's
  next wave, the bestiary, the sandbox spawn picker and the online boss art), so it does not pop in mid-wave.
* **Props:** `src/render/tripoProps.js` loads each file the first time its kind is on the board (her barricades,
  Big Yellow, a Suzu trap) and frees them all with the battle caches (`clearTripoProps`, beside `clearPropCache`);
  `staffFx.js` swaps its box walker and barricade for them once loaded and draws Suzu's bells (unarmed bells smaller and grey; Bell Toll swings them). Hold the Line stays
  the procedural cone barrier.
* e2e: `node e2e/tripo-batch1.mjs --shots <dir>` (both heroes, the bells, the five Brigade enemies, no console errors).
* Tests: `tests/models/tripo.test.js`, the `tripo` branch of `tests/models/glb.test.js`, `tests/models/standins.test.js`.

## Open items for the owner board

* Hold the Line barrier: re-roll in the next batch (20 credits).
* Gnat: amber instead of navy; Badger: the painted badger is on the sides only. Both are fine at battle size; re-roll
  only if the owner wants the exact palette.
* Big Yellow is one rigid mesh (the wishlist's `cab / arm_gun / arm_plow / leg_L / leg_R / light` nodes are not
  split out); it steps and sways as the procedural walker did.
* The heroes have no blink (no eye boxes measured) and no hair or jacket bones.
* At battle size the Badger is about one road tile long (EnemyDef size 1.7).
