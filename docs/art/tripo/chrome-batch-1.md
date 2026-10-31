# Tripo website checklist, batch 1 (for a browser agent)

Self-contained: everything needed is on this page. You (the browser agent) generate 21 models on the Tripo
website with the owner's website credits, review each one, and save the downloads for the owner to upload to a Claude
session. Work top to bottom; stop after the number of rows the owner asked for (if they did not say: 10).

## Before you start

* Open https://www.tripo3d.ai. The owner signs in themselves; never type a password or payment details.
* Make a folder on the computer: `tripo-chrome-batch-1` (for example inside Downloads). Every file goes there.
* Make a text file in that folder, `checklist.txt`, and add one line per row as you go:
  `<row> <file name> done | retried | rejected: <reason>`.

## Settings for every row

* Generator: **Text to 3D** (text-to-model). Do not upload any picture.
* Prompt: paste the row's prompt exactly as written (the style line is already inside it).
* Negative prompt (if the page has the field): `realistic proportions, long legs, revealing clothes, swimsuit, short skirt, cleavage, bare midriff, gore, blood, text, logo, base, pedestal, ground plane, multiple characters, extra limbs`
* Style / stylisation preset: **none** (original).
* Texture: **on**, standard quality (1024). PBR: off. HD / 4K texture: off.
* Mesh: **triangles** (not quads). Face limit / polycount: the row's **target triangles** (or the nearest the page
  allows; if it only offers presets, pick the lowest one at or above the target).
* Pose (if offered for characters): **A-pose**.
* Rig: only where the row says ON (the page's humanoid / biped auto-rig).
* Download format: **GLB**. Save it as the row's **file name**, exactly. For a rigged row also download the rigged GLB
  and save it as the same name with `_rig` before `.glb` (e.g. `p2-16_luna_rig.glb`).

## Review every result before downloading

Turn the model around in the page's viewer. **Reject if**:
* realistic proportions (figures must be chibi: a very big round head, a small body, short arms and legs);
* broken: floating fragments, flat or crushed pieces, holes, parts melted into a blob, more than one object;
* a revealing outfit of any kind: swimsuit, bare midriff, short skirt, low neckline, see-through clothes, or anything
  posed or framed around the body. Every character is fully and modestly dressed; adults wear professional clothes;
* extra or missing limbs, extra heads, fused hands and props that make no sense;
* text or logos, a base / pedestal / ground plate, or any blood or gore.

A broken or wrong result: **retry once** (generate again with the same prompt). If the retry is also rejected, write
`rejected: <reason>` in the checklist and move on. A revealing result: never download it; write `rejected: content`.

## The rows

| # | pri | id | target triangles | rig | save as | prompt | note |
|---|---|---|---|---|---|---|---|
| 1 | P1 | `norika_hold_line` | 800 | off | `p1-01_norika_hold_line.glb` | A repeatable segment of low plastic traffic barrier, bright orange and white with a reflective stripe, interlocking ends, rounded toy-like shape; soft anime style, clean low-poly, game-ready, single object. One solid upright piece, standing on its own feet. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | re-roll: the first try came out in scattered flat pieces |
| 2 | P1 | `gear_spirit_hair` | 3000 | off | `p1-02_gear_spirit_hair.glb` | Pom Clip: a cute school accessory item, a hair clip with a small cheer pom-pom, in red with white and gold trim, chunky toy-like proportions, front three-quarter view. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | gear icon source (small item) |
| 3 | P1 | `gear_spirit_necklace` | 3000 | off | `p1-03_gear_spirit_necklace.glb` | Spirit Locket: a cute school accessory item, a heart locket with a megaphone charm, in red with white and gold trim, chunky toy-like proportions, front three-quarter view. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | gear icon source (small item) |
| 4 | P1 | `gear_freeze_hair` | 3000 | off | `p1-04_gear_freeze_hair.glb` | Pause-Button Clip: a cute school accessory item, a hair clip shaped like a round pause button, in ice blue with white and gold trim, chunky toy-like proportions, front three-quarter view. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | gear icon source (small item) |
| 5 | P1 | `gear_freeze_necklace` | 3000 | off | `p1-05_gear_freeze_necklace.glb` | Tag Timer: a cute school accessory item, a pendant stopwatch, in ice blue with white and gold trim, chunky toy-like proportions, front three-quarter view. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | gear icon source (small item) |
| 6 | P1 | `gear_geometry_hair` | 3000 | off | `p1-06_gear_geometry_hair.glb` | Set-Square Clip: a cute school accessory item, a triangle-ruler hair clip, in slate blue with white and gold trim, chunky toy-like proportions, front three-quarter view. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | gear icon source (small item) |
| 7 | P1 | `gear_geometry_necklace` | 3000 | off | `p1-07_gear_geometry_necklace.glb` | Crosshair Locket: a cute school accessory item, a round locket with a crosshair window, in slate blue with white and gold trim, chunky toy-like proportions, front three-quarter view. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | gear icon source (small item) |
| 8 | P1 | `gear_party_hair` | 3000 | off | `p1-08_gear_party_hair.glb` | Confetti Clip: a cute school accessory item, a clip with a burst of confetti stars, in purple with white and gold trim, chunky toy-like proportions, front three-quarter view. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | gear icon source (small item) |
| 9 | P1 | `gear_party_necklace` | 3000 | off | `p1-09_gear_party_necklace.glb` | Party Locket: a cute school accessory item, a locket shaped like a party popper, in purple with white and gold trim, chunky toy-like proportions, front three-quarter view. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | gear icon source (small item) |
| 10 | P1 | `gear_treasurer_hair` | 3000 | off | `p1-10_gear_treasurer_hair.glb` | Calculator Clip: a cute school accessory item, a tiny calculator hair clip, in mint green with white and gold trim, chunky toy-like proportions, front three-quarter view. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | gear icon source (small item) |
| 11 | P1 | `gear_treasurer_necklace` | 3000 | off | `p1-11_gear_treasurer_necklace.glb` | Coin Locket: a cute school accessory item, a gold coin pendant with a sakura stamp, in mint green with white and gold trim, chunky toy-like proportions, front three-quarter view. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | gear icon source (small item) |
| 12 | P1 | `gear_power_hair` | 3000 | off | `p1-12_gear_power_hair.glb` | Lightning Clip: a cute school accessory item, a lightning-bolt hair clip, in lime green with white and gold trim, chunky toy-like proportions, front three-quarter view. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | gear icon source (small item) |
| 13 | P1 | `gear_power_necklace` | 3000 | off | `p1-13_gear_power_necklace.glb` | Battery Locket: a cute school accessory item, a pendant shaped like a battery with a charge bar, in lime green with white and gold trim, chunky toy-like proportions, front three-quarter view. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | gear icon source (small item) |
| 14 | P1 | `gear_hair` | 3000 | off | `p1-14_gear_hair.glb` | Sakura Hair Clip: a cute school accessory item, a simple sakura-flower hair clip, in soft pink with white and gold trim, chunky toy-like proportions, front three-quarter view. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | gear icon source (small item) |
| 15 | P1 | `gear_necklace` | 3000 | off | `p1-15_gear_necklace.glb` | Heart Locket: a cute school accessory item, a simple heart locket on a thin chain, in soft pink with white and gold trim, chunky toy-like proportions, front three-quarter view. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | gear icon source (small item) |
| 16 | P2 | `luna` | 20000 | ON (humanoid / biped auto-rig), download both | `p2-16_luna.glb` | Moonfox Oracle: chibi figure 2.5-3 heads tall, big round head, small soft body, short limbs, huge shiny anime eyes, light blush; an adult academy staff member as a slightly taller chibi (about 3 heads), professional outfit, modest, fully clothed; long straight lavender hime-cut hair, lilac eyes, tall lavender fox ears and one big fluffy fox tail, a long midnight-navy gown with a lavender skirt and a violet bow, a staff crowned with a golden crescent around a glowing moon orb. No halo (the game adds its own). A-pose (arms 45° down, feet slightly apart), facing front, gentle smile. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | adult academy staff member as a chibi, professional outfit |
| 17 | P2 | `nami` | 20000 | ON (humanoid / biped auto-rig), download both | `p2-17_nami.glb` | Tide Admiral: chibi figure 2.5-3 heads tall, big round head, small soft body, short limbs, huge shiny anime eyes, light blush; an adult academy staff member as a slightly taller chibi (about 3 heads), professional outfit, modest, fully clothed; long teal wavy hair, aqua eyes, a white captain's cap with a gold shell badge, a navy-and-gold admiral's coat over a crisp white sailor blouse, a gilded trident. No halo (the game adds its own). A-pose (arms 45° down, feet slightly apart), facing front, gentle smile. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | adult academy staff member as a chibi, professional outfit |
| 18 | P2 | `kanna` | 20000 | ON (humanoid / biped auto-rig), download both | `p2-18_kanna.glb` | Drum Club Advisor: chibi figure 2.5-3 heads tall, big round head, small soft body, short limbs, huge shiny anime eyes, light blush; an adult academy staff member as a slightly taller chibi (about 3 heads), professional outfit, modest, fully clothed; coral-pink twin-tails ringed in gold, golden eyes, small ivory horns, a red-and-black club track jacket with a drum crest, dark slacks and running shoes, two carbon drumsticks and a shoulder-slung drum pad. No halo (the game adds its own). A-pose (arms 45° down, feet slightly apart), facing front, gentle smile. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | adult academy staff member as a chibi, professional outfit |
| 19 | P2 | `yoriko` | 20000 | ON (humanoid / biped auto-rig), download both | `p2-19_yoriko.glb` | Drama Club Director: chibi figure 2.5-3 heads tall, big round head, small soft body, short limbs, huge shiny anime eyes, light blush; an adult academy staff member as a slightly taller chibi (about 3 heads), professional outfit, modest, fully clothed; lavender hair in a high ponytail, lavender eyes, a cat-ear stage headset, a long navy staff coat cut like a stage coat over a lilac vest, gloves, a wooden puppeteer control bar in one hand (no strings, no doll: the doll is its own model). No halo (the game adds its own). A-pose (arms 45° down, feet slightly apart), facing front, gentle smile. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | adult academy staff member as a chibi, professional outfit |
| 20 | P2 | `seiran` | 20000 | ON (humanoid / biped auto-rig), download both | `p2-20_seiran.glb` | Sky Patrol Instructor: chibi figure 2.5-3 heads tall, big round head, small soft body, short limbs, huge shiny anime eyes, light blush; an adult academy staff member as a slightly taller chibi (about 3 heads), professional outfit, modest, fully clothed; light-blue wavy hair, pale-blue eyes, small golden horns, a flight headset, a light-blue flight jacket with gold shoulder boards and a teal tie, a knee-length pleated skirt over dark tights, flight boots, a telescoping storm lance. No halo (the game adds its own). A-pose (arms 45° down, feet slightly apart), facing front, gentle smile. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | adult academy staff member as a chibi, professional outfit |
| 21 | P2 | `seiran_sky_dragon` | 4000 | off | `p2-21_seiran_sky_dragon.glb` | Seiran's sky dragon: a long friendly serpent sky dragon, light blue and white with gold horns and teal whiskers, cloud-like fins. Send three separate pieces: `dragon_head` (head and neck), `dragon_segment` (one repeatable round body segment with two small fins), `dragon_tail` (tail tip with a cloud fin). soft anime style, clean rounded low-poly shapes, flat cel-shaded colours, game-ready. soft anime chibi style, sakura palette, clean rounded low-poly shapes, flat cel-shaded colours, game-ready, single object, no base, no text. | long serpent dragon companion |

## Handing the files back

When you stop, tell the owner: the folder `tripo-chrome-batch-1` holds the GLBs and `checklist.txt`. The owner zips
the folder (or picks the files) and uploads it to a Claude session working on the game. The session processes them
(decimate, rig, previews, import) and reports back with a board. Do not upload the files anywhere else.

## For the session that receives them

The prompts come from `docs/art/ASSET_WISHLIST.md` (branch `docs/asset-wishlist`); the gear prompts follow its gear
pattern. Keep the raw files out of git (`tools/art/src/tripo/<batch>/`), process them like
`docs/art/tripo/batch-1.md` on `feature/tripo-batch-1` (tools in `tools/tripo/`).
