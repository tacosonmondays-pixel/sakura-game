# Chibi models V2 — pipeline notes

The academy girls are built by a programmatic Blender pipeline (`tools/blender/`, Blender 4.2 as the
`bpy` python module) and shipped as one GLB per unit in `public/models/characters/`. The method is the
one from the jaeysart "sitting chibi" tutorial (its example images are third-party, so they stay
on the owner's PC in the git-ignored `docs/reference/thirdparty/`): a handful of
quad **cages** that get a Catmull-Clark **Subdivision Surface**, creased edges where tips must stay
sharp, and a **painted face texture** instead of face geometry.

```
python3 tools/blender/build_characters.py              # all 19 units, full + LOD
python3 tools/blender/build_characters.py hikari aoi    # just these
python3 tools/blender/build_characters.py hikari --blend /tmp/hikari.blend   # also save a .blend to inspect
python3 tools/blender/build_characters.py --no-lod --no-anim                 # faster look-dev builds
```

Each unit takes ≈1.5 s. The roster (palette + look) is read straight from `src/data/units.js`
(`tools/blender/dump_units.mjs` dumps it to JSON through node). Output:

| file | what | budget |
|---|---|---|
| `<id>.glb` | full detail (quality `high`), ≈8–10k verts | ≤ 480 KB (typ. 360–450) |
| `<id>.lod.glb` | one subdivision level lower (quality `medium`/`low`), ≈2.6–3k verts | ≤ 240 KB (typ. 190–215) |
| `manifest.json` | `{ id: { file, lod, size, lodSize, animations, vertices } }` | |

## How a girl is constructed (`tools/blender/lib/`)

| module | content |
|---|---|
| `mesh.py` | cage primitives (`box`, `sphere` = 26-vertex rounded cube, `tube` along a path with elliptic cross-sections and pointed creased tips, `lathe`, `plate`), `finish()` = subsurf (+ mirror / solidify) baked into the mesh, `crease()`, vertex colours (`Col` attribute, linear RGB), bone vertex groups, `weight_by_bones()` (smooth nearest-two-segments weights for continuous limbs), `join()` |
| `proportions.py` | world-unit landmarks: girls 0.9 tall / head ≈45 %, heroes 0.98 tall / head ≈38 %, stubby limbs, big shoes, eye line |
| `body.py` | head (26-vertex cage shaped before subdivision: flat face plane, cheeks, narrow chin, round cranium; level 3), ears, neck, soft tapered torso, arms + mitten hands, legs with socks/tights, shoes + soles. The head gets **planar front-projection UVs** (u across the head, v chin→top); back-facing polygons collapse onto a skin-only texel so the face never wraps around |
| `face.py` | PIL face **atlas** (3×3 cells: idle, blink, attack, happy, hurt, dizzy, wink, shy, surprised): big glossy eyes with dark upper-lid stroke, iris gradient, lid shadow, two highlights, lashes, thin brows in the hair colour, tiny mouth, blush; styles `round/sharp/sleepy/sparkle/closed`, expressions `smile/smug/calm/determined/shy/cheerful`. 256² cells for girls, 341² for heroes; quantised to a palette PNG (≈50–70 KB) |
| `hair.py` | cap shell over the cranium (shrink-wrapped onto the real head mesh with a fixed gap, then thickened outwards, inner shell in `hairShade`), **bangs** (`straight/swept/split/hime/messy`), side locks, back curtains, tails and buns per `hairStyle` (`long/hime/wavy/bob/short/twintails/ponytail/side/braid/buns`). Every lock is one broad tapered tube with a creased pointed tip. Tails / long back hair get their own bones (`tail_L`, `tail_R`, `hair_back`) |
| `outfit.py` | colour plan per `look.outfit` (`spec()`) + extra cages: sailor collar, ribbons/bows, pleated skirts, cuffs, puff/wide sleeves, belts, breastplate + pauldrons + cape (armor), hood, apron, obi, pockets… |
| `accessory.py` | ribbon, bunny/cat/fox ears, hairpin, beret, witch hat (raises the halo), horns, flower, goggles, hood, headband, crown — all placed above the hair surface (`HAIR_TOP`) |
| `weapon.py` | one cage model per `look.weapon`, weighted to `hand_R` (bow/tome to `hand_L`); `kind_of()` maps weapons to attack kinds |
| `halo.py` | ring/star/petal/gear/moon/flame/wave/crown/snow/bolt/leaf/eye, emissive `halo` material, bone `halo` |
| `rig.py` | armature: `root, hips, spine, chest, neck, head, halo, shoulder/upper_arm/forearm/hand _L/_R, thigh/shin/foot _L/_R` (+ hair bones). No dots in bone names so three.js keeps them verbatim in track names |
| `anim.py` | actions authored as a few keyframes at 24 fps in armature space (`Poser.key(frame, {bone: (pitch, roll, yaw)})`), bezier → exported as CUBICSPLINE. Clips: `idle` (personality per expression, breathing, halo float), `walk`, `attack_<kind>` with anticipation → strike → recovery (`slash, thrust, bow, rifle, cannon, cast, throw, smash, sweep`), `cheer`, `victory` (weapon-specific pose), `hurt`, `pickup` (wriggle) |
| `export.py` | materials (`body` = vertex colours, `head` = face atlas, `halo` = emissive), glTF export (actions, no sampling, vertex colours), GLB re-packing (swap in the optimised PNG, write extras) |
| `optimize.py` | KHR_mesh_quantization post-pass: int16 positions, int8 normals, uint8 colours/joints/weights, uint16 UVs (head only), uint16 indices — about half the size, read natively by three.js |

The whole character is stored at **half scale** (so positions fit normalised int16) and the runtime
scales the root by `asset.extras.unitScale` (= 2). Feet at y = 0, faces +Z after export.

## Runtime (`src/models/`)

* `index.js` keeps the CONTRACT §7 API. `preloadModels(ids?, { detail })` loads GLBs (all units at full
  detail when called without arguments, a few files at a time). `buildChibi(unit, { quality, pose, detail })`
  is synchronous: it instantiates a loaded GLB (`detail` defaults to `full` for quality `high`, `lod`
  otherwise; if only the other detail is loaded it is used immediately and the preferred one is fetched for
  later builds), or returns the V1 procedural chibi as a placeholder and **upgrades the same group in
  place** when the GLB arrives. In node / offline the procedural fallback is what you get.
* `glbChibi.js`: GLTFLoader + SkeletonUtils.clone per instance, `MeshToonMaterial` (3-step ramp for the
  body, a soft 2-step ramp for the face so the painted eyes stay bright), unlit emissive halo with a
  coloured outline, inverted-hull outline clones that share the skeleton (skipped at quality `low`),
  `AnimationMixer` with crossfades, one-shot attacks layered over idle, blinking + expression cells
  via texture offset (`userData.setExpression('happy'|...|null)`).
* Draw calls per girl: body + head + halo (+ 3 outlines).

## Adding a character

1. Add the unit to `src/data/units.js` with `palette` + `look` (any combination of the existing
   hairStyle / bangs / accessory / outfit / weapon / halo / eyeStyle / expression values just works).
2. `python3 tools/blender/build_characters.py <id>` → `public/models/characters/<id>.glb` + `.lod.glb`,
   manifest updated.
3. Look at it: `node e2e/shot.mjs "/previews/models-v2.html?view=turn&id=<id>&t=0.5" out.png --wait "body[data-ready]"`
   (views: `turn`, `closeup`, `states`, `faces`, `row&ids=`, `game`, `lineup`, `upgrade`, `viewer`).
4. New hair style / outfit / accessory / weapon / halo: add a function to the matching library and
   register it in its dict (`STYLES`, `BANGS`, `OUTFITS`, `ACCESSORIES`, `WEAPONS`, `HALOS`).
5. `npx vitest run tests/models` checks every GLB header (clips, bones, materials, atlas, size).

## Judging quality

Always judge with three.js screenshots (Blender's EEVEE needs a GPU): round head, big eyes placed low,
broad hair sections with pointed tips (never thin jagged strands), hair fully covering the cranium from
every angle, nothing poking through, outline thin, halo readable on light backgrounds, poses without
stretching (`view=states`).

---

# Enemy models V2 — one rigged GLB per family

The 74 monsters of the bestiary (`src/data/enemies.js`, 12 families) share the chibi method
(quad cages → Catmull-Clark subsurf, creased tips, painted faces, toon + inverted-hull outline) but
ship as **one GLB per family** in `public/models/enemies/` (`tools/blender/enemies/`, same `bpy` 4.2):

```
python3 tools/blender/enemies/build_enemies.py              # all 12 families (~15 s)
python3 tools/blender/enemies/build_enemies.py orc dragon   # just these
python3 tools/blender/enemies/build_enemies.py slime --blend /tmp/slime.blend --no-anim
```

| file | content | budget |
|---|---|---|
| `<family>.glb` | the rigged base body + every prop / variant piece the family's defs use, clips `move idle hit death special` | ≤ 320 KB each, **≤ 2.5 MB for all 12** (currently ≈ 2.2 MB) |
| `manifest.json` | `{ family: { file, size, vertices, animations, props, variants, height, unitScale } }` | |

## Construction (`tools/blender/enemies/`)

| module | content |
|---|---|
| `dump_enemies.mjs` | dumps `ENEMIES` / `FAMILIES` to JSON (node) so the build only generates the props and variants that are actually used |
| `parts.py` | cage helpers on top of `lib/mesh.py` (`blob`, `box`, `tube`, `cone`, `lathe`, `plate`, `ring`, `gloss_on`, `head` with a planar face-UV window) and the **tint roles** painted into the vertex-colour alpha: `main` (× `def.color`), `accent` (× `def.accent`), `fixed` (literal colour: teeth, metal, gold) |
| `bodies.py` | the chunky Nendoroid **biped** (head ≈ body, stubby limbs, mitten hands, big feet) and the **quadruped**, plus ears (pointy / round / tall), snout, tusks, hair tufts |
| `props.py` | the whole `EnemyDef.model.props` vocabulary as separate cage parts tagged `prop:<name>` (helmet, hood, crown, tiara, horns, mask, goggles, scarf, cape, mane, shield, towerShield, club, axe, spear, sword, staff, lantern, bomb, smokePot, backpack, wrench, drum, fan, mirror, chains, candle, gears, chimney, cannon, crystals, leaves, flower, thorns, moss, mushroom, bubble, pearl, sparkle, ember, glider, bones…) placed on the family's anchors (head, top, back, hands, chest, neck); a family may build its own version and mark it `done` |
| `families/<family>.py` | the family body + variants: slime (fat jelly drop; rainbow / chest-mimic / knight / royal), goblin (scrawny runner; machine = copper boiler mech with a pilot), orc (belly brute), ghost (lantern sheet), ghoul, oni (horned festival demon), lizardfolk, construct (automaton / cogling / beetle / colossus), beast (quadruped wolf / boar / bear), fae (winged sprite), plant (sprout / pod / thornroot / mossling / treant on root legs), dragon (winged quadruped, matriarch) |
| `efaces.py` | PIL face **atlas** per family, 3×2 cells `idle blink hit angry dead cast` (glossy / sharp / angry / glow / visor / dot eyes, fangs, blush) |
| `erig.py` | archetype armatures: blob `root body top`, biped `root hips chest head arm_L/R leg_L/R`, quad `root body head leg_FL/FR/BL/BR tail_n`, plus wing bones |
| `eanim.py` | clips authored with the chibi `Poser`: move styles `hop waddle run stomp shamble float flutter gallop fly sway`, hits `squash recoil`, deaths `splat topple poof collapse wilt`, specials `cast siphon blink roar`; each family picks its set in `ctx['clips']` |
| `pack.py` | KHR_mesh_quantization packing: int16 positions, uint8 RGBA colours (alpha = tint role), uint16 UVs (face parts only), byte joints / weights, 16-bit indices, **no normals** (the runtime recomputes them from the smooth shells), identical accessors shared, exporter float noise trimmed |

Mesh objects are named `<vis>|<group>|<material>` (`base`, `prop-<name>`, `var-<variant>`; materials `body` / `glow`).
Whole families are stored at **half scale** (`asset.extras.unitScale` = 2); `extras` also carry `height`,
`faceCells`, `faceGrid`, `faceCorner`, `translucent` (slimes / ghosts) and the `variants` hide table
(e.g. `machine` hides `head torso arms legs`).

## Runtime (`src/models/glbEnemy.js`, `src/models/enemies.js`)

* `preloadEnemies(families?)` loads family GLBs (4 at a time); `buildEnemy(def)` is synchronous: a loaded
  family gives a GLB instance at once, otherwise the V1 procedural monster is returned as a placeholder and
  upgraded in place when the file arrives (node / offline stay procedural).
* An instance = the pieces `def.model` asks for (base groups minus the variant's hide list + `prop:*` +
  `var:*`) merged into **one skinned mesh per material** (body, glow) + one outline, bound to a
  `SkeletonUtils` clone of the family skeleton (merged geometry cached per family|variant|props). Tint
  roles are resolved in the shader from `def.color` / `def.accent`; the face atlas is blended over the
  tinted skin. Draw calls per monster: body + outline (+ glow).
* CONTRACT §7 hooks keep working (`animate`, `hitFlash`, `setVeiled`, `setBarrier`, `setPhasing`,
  `setStatus`) plus `playDeath()` → seconds, `playSpecial()`, `setCasting(bool)`, `setExpression(cell)`.
  The battle renderer plays `death` before disposing a killed monster, loops `special` while an oni field
  is projected, and fires `special` on blink wind-ups and boss phase changes.

## Judging quality

`/previews/enemies-v2.html` — `view=sheet` (every monster on one contact sheet; shoot it at ≥ 1600×1100
with `&still=1&shadows=0`), `view=lineup&page=1..4` (three families per page at 1280×720), `family&fam=`,
`turn&id=`, `states&id=` (idle / move / hit / death / special / cast), `hooks`, `game`, `viewer`.
`npx vitest run tests/models` checks every family GLB (clips, rig, materials, atlas, piece names, size
budget) and that every EnemyDef resolves to a built family with its variant and props.
