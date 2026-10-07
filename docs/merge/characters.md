# Old ("Codex", Alpha 1.3.1) characters → merge report

Scope: everything about the OLD build's characters (3D chibis, designs, illustrations, kits) and a concrete
spec for running them inside the NEW runtime (`/home/user/sakura-game`, three 0.186) as the main roster,
with the NEW Blender chibis demoted to special skins / future units.

All paths below are absolute unless they start with `src/`, `tests/`, `public/` (= new repo) or are old-game
module names (= `scratchpad/oldgame/<file>`).
`$M` = `scratchpad/merge`.
The old JS is minified to a few very long lines, so **line numbers refer to the prettier-formatted copies in
`$M/fmt/<file>.js`** (same code, readable).

---

## 0. Key findings (read this first)

1. **The old characters are real, rigged, cute GLBs and they run unchanged on three r186.** I built a working
   prototype of a "codex" chibi source on three 0.186 (`$M/proto/merge-port.html`, served at
   `http://127.0.0.1:8765/merge-port.html`): old Draco GLB + old face atlas + old procedural acting + old
   procedural weapons, plus merged vertex-colour toon body, meshopt LOD, inverted-hull outline and the new
   game's softer toon ramp. Screenshots: `$M/shots/port-proto-row1..4.png`, `port-proto-hikari-lod1.png`,
   `port-proto-battle-zoom.png`. Only deprecation warnings (DRACOLoader `setDecoderConfig`), no errors.
2. **35 GLBs** in `oldgame/assets/models/`: 32 characters (16 base + 14 expansion + 2 summer) + 3 beach skins.
   All share one 27-joint skeleton, ~30k verts / ~52k tris each (**3× the new full models, 9× the new LODs**),
   Draco-compressed (8.44 MB for the 32, avg 264 KB), **no textures inside, no animation clips, no morph targets**.
3. **Colours are baked per GLB** in named material slots that are identical across all models
   ("Sakura hair", "Ivory satin", "Midnight indigo", "Satin champagne gold", "Sea-glass silk", …) — so palette
   recolours/skins are trivial at runtime. Only the iris is tinted at runtime (`unit.eye`, shader in
   `chibi.js` L9-40).
4. **One shared face atlas** (`face-atlas.png`, 1254², RGBA, 354 KB) with 4 expressions in a 2×2 grid
   (neutral / blink / attack / happy). Every face mesh maps to the top-left quadrant; expressions = texture
   offset. The new runtime expects 9 cells (`FACE_CELLS`); 5 must be mapped or painted.
5. **Animation is 100 % procedural** (`chibi-acting.js`, 417 lines): idle, walk, wave, cheer, held
   (pick-up wriggle), shy, curious + kind-specific attack envelope (0.48 s). It is a pure function of
   time/seed — no mixer needed; it maps cleanly onto the new `userData.animate(time, dt, state)` contract.
   30 chibis cost 1.44 ms/frame CPU on this VM.
6. **Weapons are procedural three.js meshes** (`chibi-weapons.js` for the base 16 + summer, `expansion-weapons.js`
   for the 14 expansion girls), parented to the `hand.R` bone. Big props (Luna's tail, Tsubaki's mortar tube,
   Kanna's drum, Hana's quiver+bird, Ruri's fox) are part of the GLB body mesh.
7. **Looks as-is have fixable flaws:** dark dirty lower-face band from the 8-texel toon ramp
   (`chibi-materials.js` L23), no body outlines, every girl uses the same dress template (bow + panelled skirt +
   star-band boots), skin poke-through on the back of the calves (`$M/shots/old-detail-a-back.png`), no
   halos. The prototype fixes the face band (new 3-step ramp `[168,222,255]`) and adds outlines; result in
   `port-proto-row*.png` is cleaner and closer to the new game's style while keeping the old designs.
8. **Performance plan is proven:** merging the 8–11 body primitives into one vertex-coloured SkinnedMesh +
   meshopt simplification (ratio 0.3 → ~17k tris, 0.15 → ~9.5k tris, visually fine at battle distance) +
   merged weapons → **~5 draw calls per chibi** (old: 18 for base girls, 40 for expansion girls). 30 chibis at
   LOD 0.15 with outlines = 151 draw calls / 538k tris.
9. **Missing illustrations found:** the 7 expansion pair portraits (`/assets/kaede-suzu.webp` etc., 1536×1024,
   left/right halves) were not in the mirror (built by string concatenation); I downloaded them from the live
   site to `$M/portraits/*.webp`.
10. **Content flags:** summer models `marina`, `amane` (base outfits) and `marina-beach`, `amane-beach`,
    `nami-beach` are swimwear on chibi bodies → do not ship; the 10-girl chibi sprite sheet `roster.webp`
    has cleavage/garter/fishnet fan-service on student characters → do not ship for students; Hikari's
    illustration is bust-focused → crop or repaint. Details in §7.
11. **The new sim lacks ~12 old mechanics** needed by old-only kits (aimed/telegraphed mortar, mirror relay
    origin, familiars, grounding flyers, air priority/×2 vs air, pull/gather, curse spread on death, life
    restore, bounty on nearby kills, execute, lingering zones, single-target/aimed hero ults). §6.4.
12. **Tests will break** when old-only ids are added: `tests/models/glb.test.js` asserts the V2 Blender format
    for *every* unit in `UNITS`. §5.9.

---

## 1. Where the old character code lives (read-only sources)

| File (old) | What it does | Key lines (`$M/fmt`) |
|---|---|---|
| `chibi-assets.js` | Loads all 35 GLBs (3 parallel workers) with `DRACOLoader` (`/vendor/draco/`, wasm, 2 workers) + the face atlas; prepares templates; `cloneChibiAsset(id)` = `SkeletonUtils.clone` | `preloadChibis` L20-93 (mesh flags L53-67: castShadow, frustumCulled=false, `FacePaint` → no shadows, renderOrder 2; atlas `flipY=false`, sRGB, anisotropy 4 L72-78); `cloneChibiAsset` L94-99 |
| `chibi-materials.js` | Converts Standard→`MeshToonMaterial` on templates, keeps PBR for metallic (>0.05), physical layers and FacePaint | ramp `LIGHT_BANDS=[0,0,0,0,102,144,190,190]` L23; `shouldKeep` L89-110; `materialFor` L112-141; `prepareTemplate` L143-151 |
| `chibi.js` | `makeChibi(unit)`: avatar groups, bone map, face paint + iris tint shader, rig, weapon attach, pedestal; `disposeChibi`; `ChibiViewer` (8 poses) | `paintFace` L9-40; `makeChibi` L41-143 (scene ×0.84 L50, root ×0.92 L141, weapon attach L102-112, pedestal L113-131); `disposeChibi` L144-164; viewer lights L194-212 |
| `chibi-acting.js` | Procedural acting for every pose + attack envelope + hair sway + blink/expression | `poseBone` L25-38; `bindChibiActingRig` L42-54; `animateChibi` L56-417 (wave L128, cheer/income-idle L148, held L182, walk L217, shy L246, curious L266, attack L284-372, hair L397-406, blink/expression L407-416) |
| `chibi-weapons.js` | Procedural weapons for base 16 + Marina/Amane, by `unit.kind` (and by id for marina/nami/amane/sango/umeko) | material cache L13-32; `mesh()` with ink hull L33-63; `weapon()` L270-610; `makeWeapon` L612-618 |
| `expansion-weapons.js` | 14 per-id builders | ids L5-20; builders L182-875 (kaede 183, suzu 238, chika 269, ruri 314, fuu 371, hana 417, kohaku 500, tsubaki 526, noa 574, iroha 622, ena 667, kanna 708, yoriko 746, seiran 810); `makeExpansionWeapon` L877-884 |
| `data.js` | `UNITS` (base 16) + push of expansion + summer; `SUBCLASSES`; detect/reveal overrides; `KIND_DAMAGE`; `TRAITS`; `HERO_SKILLS` | UNITS L15-337; SUBCLASSES L340-357; overrides L358-367; KIND_DAMAGE L394-412; TRAITS L413-457; HERO_SKILLS L865-903 |
| `expansion-roster.js` | `EXPANSION_UNITS` (14) via `girl()`; pair portraits; `EXPANSION_SKILLS`; `BATTLE_BRANCHES` (3 branches for every tower); `ROLE_GUIDES`; `EXPANSION_GRANTS` | girl() L2-39; units L40-279; portraits L280-298; skills L299-329; branches L331-492 (+marina L530-538); grants L516-528 |
| `summer-content.js` | `SUMMER_UNITS` (marina, amane), `BEACH_SKINS`, event stages/shop/story | units L10-68; skins L69-91 |
| `growth.js` | `RARITIES`, `BASE_RARITY`, `STARTERS`, `CHAPTER_UNLOCKS`, gear | L23-60 |
| `engine.js` | stats/upgrades/placement/ult for base kinds | `unitStats` L122-148; `upgradeCost` L203; `branchLock` L208-218; `canPlace` L365-403; `useAbility` L517-560 |
| `combat-expansion.js` | all kind behaviours (traps, sentries, familiars, mirror, mortar, wind, beam, curse…) + expansion ults | `applyBranchStats` L6-20; `canEngage` L36-52; `modifyHit` L190-235; `onDefeat` L236-280; `applyEffects` L281-337; `shoot` L338-377; `attackTowers` L413-685; `expansionAbility` L686-729 |
| `world.js` | battle use of chibis | L1021-1050: `makeChibi({...unit, skin})`, y=0.24, scale hero 0.93 / tower 0.85 × (1+0.02·level), turns to `t.aim` while attacking, `animateChibi(..., attackAge)` |
| `village.js` / `cinematics.js` | city (pedestal hidden, ×0.98, poses held/wave/walk) / gacha reveal (×1.15, attack/cheer/wave) | — |

Not available: the Codex handoff (`/home/user/sakura-game/docs/codex-handoff/…Handoff.txt` L141-152) mentions
`models-uncompressed/` and the Blender builder scripts, but that package is **not** in our possession; only the
Draco GLBs from the live site. Blender's bpy 4.2 here **cannot import Draco** (no `libextern_draco.so`), so any
offline processing must decode in a browser/three.js (see §5.6).

---

## 2. How the old chibis are built (technical anatomy)

### 2.1 GLB anatomy (parsed from the JSON chunk, `$M/tools/glbinfo.py`; runtime numbers from `$M/old-analysis.json`)

| Property | Value |
|---|---|
| Generator | Khronos glTF Blender I/O v4.5.48 |
| extensionsUsed/Required | `KHR_draco_mesh_compression` (both) |
| Meshes | 2 meshes: `Original authored character surface` (6–10 primitives, one per material) + `FaceExpression \| UV top-left neutral` (1 primitive, material `FacePaint`, 1001 verts / 1864 tris) |
| Attributes | POSITION, NORMAL, TEXCOORD_0, JOINTS_0, WEIGHTS_0 (no COLOR_0, no tangents, no morph targets) |
| Size | 30–34k verts, 51.7–53.6k tris per base/expansion girl (Chika 45.5k); summer 19.5–21.6k verts / 38–41k tris |
| Skins | 1 skin, **27 joints**: `root, body, tail, thigh.L, shin.L, foot.L, toe.L, thigh.R, shin.R, foot.R, toe.R, spine, chest, neck, head, hair, hair.L, hair.R, clavicle.L, upperarm.L, forearm.L, hand.L, clavicle.R, upperarm.R, forearm.R, hand.R, weapon` (GLTFLoader strips dots → `handR`, etc.) |
| Animations | **none** |
| Textures/images | **none** (face atlas is external) |
| Bounds (raw units) | feet at y=0, face toward **+z**; hair top 3.64–3.97, hats/ears up to 4.34 (Akane) / 4.26 (Luna); width ±0.94 (±1.28 with tails/twin-tails) |
| Body variants | 4 heights by head bone y: 2.008 (aoi, kage, midori, momo, sango, suzu, fuu, hana, yoriko), 2.068 (hikari, akane, shiro, hotaru, kaede, ruri, ena), 2.098 (rei, raika, nami, chika, tsubaki, kanna, marina, nami-beach), 2.149 (yuki, miko, luna, umeko, kohaku, noa, iroha, seiran, amane, amane-beach). Head ≈ 45 % of height (~2.2 heads tall). |
| Unused joint | `weapon` at (0.725, ~1.05, 0.123) — the runtime ignores it and attaches weapons to `hand.R`. |

### 2.2 Material slots (identical names in every GLB → runtime-recolourable)

| Slot name | Role | Example hikari / aoi | Kept as |
|---|---|---|---|
| `Skin \| warm porcelain` | skin | #ffe1ce (all) | toon |
| `Ivory satin` | main outfit (= data `outfit`) | #f8eee0 / #568c55 | toon |
| `Sakura hair` | hair (= data `hair`) | #f3a0bd / #529d67 | toon |
| `Hair shaded roots` | inner/back hair | #d98fab / #528c63 | toon |
| `Midnight indigo` | secondary (collar, skirt) | #273458 / #334a39 | toon |
| `Satin champagne gold` | trim (metal 0.45) | #e8b55a / #d5c57d | **kept PBR** (metal > 0.05) |
| `Sea-glass silk` | bow/accent (= data `eye`) | #43b8c2 / #88df94 | toon (metal 0.05 is not > 0.05) |
| `Boot sole` | soles | #4b4257 | toon |
| `FacePaint` | face decal shell | — | replaced by `MeshBasicMaterial` per instance |
| extras on some | `Seafoam hair tips` (umeko), `Moonsteel` metal 0.55 (chika, kohaku, iroha, yoriko), `Gold recess` metal 0.2 (chika, hana) | | PBR |

Base-16 slot colours equal the data palette exactly (aoi `Ivory satin` #568c55 = data `outfit`), i.e. colours
were **baked at export from data**; expansion GLBs are close but hand-tweaked (kaede hair #a74b36 vs data
#ad5148). At runtime the data palette is used only for the **iris tint** (`unit.eye`) and the pedestal ring
(`unit.color`). Full per-character slot dump: `$M/old-analysis.json` (`res.<id>.mats`).

### 2.3 Face atlas, expressions, blink

- `face-atlas.png` 1254×1254 RGBA, background transparent (1.41 M of 1.57 M px alpha 0). Loaded with
  `flipY=false`, so UV (0,0) = image top-left.
- Grid 2×2: **0 = neutral (TL)**, **1 = blink/smile closed eyes (TR)**, **2 = attack/determined brows + flat
  mouth (BL)**, **3 = happy closed eyes + open smile (BR)**. Teal eyes in the art.
- Face mesh UVs span (0.012, 0.098)–(0.488, 0.442) = inside the TL quadrant in every model.
- Expression switch (`chibi-acting.js` L407-416): `map.offset = ((e % 2) * 0.5, e >= 2 ? 0.5 : 0)`;
  `expression = attacking ? 2 : faceHappy ? 3 : blink ? 1 : 0`; blink every `4.7 + (seed % 7) * 0.11` s for
  0.12 s (window 0.08–0.20); `faceHappy` in cheer, held, shy and Momo's (income) idle.
- Per-instance material (`paintFace`, `chibi.js` L9-40): `MeshBasicMaterial{ map: atlas.clone(), transparent,
  alphaTest 0.12, depthWrite false, polygonOffset -1/-1, toneMapped false }` + `onBeforeCompile` that recolours
  only the teal iris pixels: `irisMask = smoothstep(.015,.12,g-r)*smoothstep(.012,.09,b-r)`,
  `rgb = mix(rgb, irisTint*(0.20+max(g,b)*1.45), irisMask*0.87)`; cache key `sakura-iris-v1`.
  `Texture.clone()` shares the image `Source`, so 30 instances = one GPU upload.

### 2.4 Acting (procedural, no clips)

- Rig binding (`makeChibi` L52-101 + `bindChibiActingRig`): bones by name stripped of non-letters and lower-cased;
  each bone stores `restQuaternion` and `avatar` (= the `animated_avatar` group). Hair chain: `hair`
  (weight 0.6), `hair.L`, `hair.R`, `tail` (also Luna's fox tail / ponytails). Seed = sum of id char codes.
- `poseBone(bone, x, y, z)` (L25-38) resets to rest and applies an XYZ delta **expressed in avatar space**,
  parent-first (pelvis → spine → chest → neck → head → clavicles → arms → forearms → hands → thighs → shins →
  feet → toes, L376-396). Every bone is reset every frame → no drift, deterministic.
- Poses: `idle` (breath 1.52 Hz + weight shift + look cycle 8.6 s), `wave`, `cheer` (crouch → pop → settle,
  3.6 s loop), `held` (squirm + kicking feet, uses `root.userData.dragTilt`), `walk` (gait `t*7`), `shy`,
  `curious`. Archer/sniper keep weapon-ready arm rest poses (L117-126).
- Attack: window 0.48 s, `anticipate = pulse(0,.09,.18)`, `strike = pulse(.09,.24,.48)`,
  `recoil = pulse(.24,.32,.48)`; 5 families: melee (`hero, slash, ninja, duelist, onihero`; onihero ×1.12,
  ninja/duelist ×0.86), archer (`arrow, falcon`), `sniper` (recoil), device (`engineer, trapper, mortar`),
  caster default (broad ×1.3 for `moonhero, tidehero, stormhero, puppethero, summoner`).
- `reduced` motion flag zeroes free motion. Cost: 1.44 ms/frame for 30 chibis (prototype bench, this VM);
  each `poseBone` calls `getWorldQuaternion` twice → ~21 world-matrix walks per chibi per frame (cacheable).

### 2.5 Weapons and props

- Built in **unscaled body space**, positioned at the `hand.R` world position + (0.045, 0, 0.08), scale 0.85,
  then `grip.attach(weapon)` (keeps world transform) (`chibi.js` L102-112).
- Base set by `unit.kind`: hero sword (gold guard, star, teal gem), slash katana (+ pink bow), arrow bow + arrow,
  sniper rifle, ninja 4-blade shuriken, poison round flask, income microphone, ice staff + crystal, fire staff
  + gold ring + red crystal + star, lightning staff + big gold star + ring, support staff + crossbar + white
  ribbons (gohei-like), moonhero staff + gold crescent + glowing orb, lantern hooked staff + glowing lantern;
  by id: marina rescue buoy, nami/amane gold trident, sango navy hand-cannon, umeko 7-spike shell staff.
- Expansion props (by id): kaede rapier with basket ring + jewel + tassel; suzu bell rack (gold crossbar with
  hanging bells, tassel); chika big wrench + gear; ruri open "familiar grimoire" with a fox familiar on it;
  fuu folding fan; hana bow + arrow; kohaku jewel staff with rings; tsubaki brass "mortar rangefinder"
  binoculars; noa "ward buckler" shield; iroha hand mirror; ena curse cards; kanna taiko mallet; yoriko puppet
  control bar + miniature puppet; seiran long spear/glaive.
- Materials: cached `MeshStandardMaterial` (roughness .66, gold metal .18/.24, some emissive glow 0.42–2.4);
  **ink outline** = duplicate mesh with `MeshBasicMaterial{color:#4c3b50 or #433c52, side:BackSide}` scaled
  ×1.007/1.008 (marked `userData.ink`). Weapon draw calls: 5–15 (base) to ~30 (expansion) meshes.

### 2.6 Materials, outlines, lighting, scale conventions

- Bodies: `MeshToonMaterial` + 8-texel `RedFormat` ramp; **no body outlines**; metallic trim stays PBR.
- `ChibiViewer` lighting (L194-212): Hemisphere #e5f5ff/#8c819b 1.25; key #fff0db 3.0 at (-3,6,5) with
  1024² PCFSoft shadows; fill #b7d7ff 1.3 at (3,2,-4); ACES filmic, exposure 1.14; PostFX bloom 0.25.
- Scale: scene ×0.84, root ×0.92 → ~2.86 world units tall in the viewer; battle adds ×0.85 (tower) / ×0.93
  (hero) × (1+0.02·level) → ~2.44 tall on a 28×16-unit map (old maps span x ±14, z ±8).
- Pedestal: cylinder r 0.63–0.67 (#e9e6db) + torus ring in `unit.color` (`userData.pedestal`, hidden in city).
- Disposal: shared geometry/materials flagged `sharedChibi`/`chibiShared`; per-instance face material + its
  cloned texture are disposed.

---

## 3. Pictures (all looked at)

| File (`$M/shots/…`) | Content |
|---|---|
| `old-lineup-base.png` | 16 base chibis, 3/4 view, exactly built by old `makeChibi` (old r180 modules, ChibiViewer lights, no PostFX) |
| `old-lineup-expansion.png` | 14 expansion chibis |
| `old-lineup-summer.png` | marina, amane, marina-beach, amane-beach, nami-beach (+ nami, sango for comparison) — swimwear, do not ship |
| `old-attack-base.png`, `old-attack-expansion.png` | attack pose (attackAge 0.22) — weapons visible, attack face |
| `old-turn-hikari-luna.png` | front / 3/4 / side / back of Hikari and Luna |
| `old-detail-a.png`, `old-detail-a-back.png` | close full-body front/back: raika, momo, hotaru, umeko, ruri, hana, tsubaki, suzu (back shows calf poke-through) |
| `old-faces-expr.png` | Hikari expressions 0-3 (neutral / blink / attack / happy) — shows the dark lower-face band |
| `old-faces-closeup1.png`, `old-faces-closeup2.png` | face close-ups shiro, akane, miko, umeko / kohaku, ena, seiran, yoriko |
| `old-lod-test-hikari.png` | meshopt simplification of the old GLB: ratio 1 / 0.5 / 0.3 / 0.15 (51.7k / 26.8k / 16.8k / 10.0k tris) |
| `illus-six.png` | hikari, luna, nami, hotaru, sango, umeko illustrations |
| `illus-roster-sprite.png` | the 5×2 `roster.webp` chibi sprite cells (aoi…momo) — fan-service flags |
| `illus-expansion.png` | 14 expansion halves from the 7 pair portraits (downloaded to `$M/portraits/`) |
| `illus-summer.png` | `/assets/summer/*.webp` = renders of the swimwear models |
| `academy-thumb.png` | `assets/academy.webp` (1536×1024 home background landscape, not a character) |
| `new-row-a.png`, `new-row-b.png`, `new-row-c.png` | NEW Blender chibis, same ids, via `node e2e/shot.mjs '/previews/models-v2.html?view=row&t=1.2&ids=…'` (`new-lineup.png` = crowd view) |
| `port-proto-row1..4.png` | **all 30 old girls through the r186 port prototype** (LOD 0.3, outlines, new ramp, new lights) |
| `port-proto-hikari-lod1.png` | port at full detail |
| `port-proto-battle-zoom.png`, `port-proto-battle-844.png`, `port-proto-bench30.png` | port at the new battle camera (ortho, 48° pitch, ×1.22) on 1280×720 and 844×390; 30-chibi bench |
| `$M/tour/old-t0.png`, `old-tut1.png`, `old-city.png`, `old-growth.png` | old app title, Hikari tutorial modal, city, upgrade view (fresh saves cannot reach a battle on the static mirror: `tutorial-start` does nothing, probably server-gated) |

Visual verdict on the old models: consistent cute proportions, clean painted anime eyes with the per-girl
iris tint, strong silhouettes from hats/ears/hair (Akane's witch hat, Luna's fox ears+tail, Tsubaki's cap +
mortar, Kanna's horns + drum). Weak points: same dress template on almost everyone; muddy lower face under
the old ramp; no outlines; calf poke-through at the back; hair strands split normals (outline hull shows small
jaggies on hair tips in the prototype — fix with smoothed outline normals, §5.5).

---

## 4. Art bible (one line each; 3D model first, illustration differences after "/")

Old palette = data `hair / outfit / eye` (the GLB slots match). Suggested new-schema `look` hints in [brackets].

**Base roster (16)**
1. **Hikari** (hero, Dawnblade) — long pink (#f3a0bd) hair to the waist with side locks, gold star clip + small white star; ivory short-sleeve blouse, navy sailor collar, big teal bow with gold diamond, navy skirt with ivory front panels & gold trim, navy/ivory star-band boots; short gold-hilted sword with star guard + teal gem. / Illus: adult, very long pink hair, white-gold armoured coat, blue corset dress, teal ribbons, white thigh boots, ornate sword. [long, swept, hairpin, sailor, sword]
2. **Luna** (hero, Moonfox Oracle) — lavender hair, large lavender fox ears (navy inner), huge fox tail, navy dress with lavender skirt, violet bow; staff with gold crescent + glowing blue orb. / Illus: fox girl in wisteria moonlight, long hair, navy/white dress, moon staff. [long, hime, foxEars, dress, staff, moon]
3. **Nami** (hero, Tide Admiral) — teal hair with navy underlayer, white captain's cap with navy band + gold shell badge, ivory blouse/navy collar, sky-blue bow, navy skirt; gold trident with aqua tips + ring. / Illus: admiral's navy-gold coat and white trousers, cap, trident. [wavy, split, captain cap, coat, trident]
4. **Aoi** (Wind Ranger) — short green hair with leaf ahoge and side ponytail, green tunic-dress, mint bow, green boots; wooden bow + arrow. / Sprite: long green ponytail, green cape, ornate bow. [ponytail, swept, leaf, tunic, bow]
5. **Rei** (Sakura Samurai) — navy-black bob with dark bow and gold star pin, indigo dress, lilac bow; katana with pink bow on the hilt. / Sprite: long dark ponytail, red ribbon, samurai armour over kimono. [bob, straight, ribbon, dress, katana]
6. **Yuki** (Frost Mage) — white/silver hair with snowflake pin, white + light-blue dress, ice-blue bow; staff with ice crystal. / Sprite: long white hair, white fur-trimmed robe, crystal staff. [bob, straight, hairpin, dress, staff]
7. **Akane** (Flame Witch) — orange-red hair, dark plum witch hat with red band + gold star, red dress with plum skirt, gold bow; staff with gold ring + red crystal + star. / Sprite: long red hair, witch hat, flame staff. [long, swept, witchHat, dress, staff]
8. **Shiro** (Moon Sniper) — silver-white hair, navy beret, navy/slate uniform, pale-blue bow; dark scoped rifle. / Sprite: white captain's cap, navy-gold coat. [short, straight, beret, blazer, rifle]
9. **Kage** (Shadow Ninja) — purple bob with a dark hitai-ate headband, purple/black dress, lilac bow; 4-point shuriken. / Sprite: purple ponytail, face mask, ninja outfit (fishnets — not reusable). [bob, messy, headband, dress, shuriken]
10. **Raika** (Storm Caller) — golden-blonde hair with two curled gold horn-like tufts, periwinkle/indigo dress, lilac bow; staff with big gold star + ring. / Sprite: long blonde hair, golden sun staff. [long, messy, horns(curl), dress, staff]
11. **Miko** (Shrine Keeper) — long black hair, big red bow, white blouse, red hakama-style skirt; gohei staff with crossbar + white paper streamers. / Sprite: classic red-white shrine maiden. [hime, ribbon, miko, gohei]
12. **Midori** (Potion Alchemist) — mint hair, round gold goggles on the head, green dress, lime bow; round green potion flask with star. / Sprite: mint twin buns + goggles, satchel. [bob, goggles, dress, flask]
13. **Momo** (Starlight Idol) — pink twin-tails with magenta triangle bows, magenta/white idol dress, purple bow; hand microphone; idles with a happy wink face. / Sprite: pink twin-tails, black bows, frilly idol dress, microphone. [twintails, ribbon, dress, mic]
14. **Hotaru** (Lantern Keeper) — honey-blonde bob with side tail + navy bow, teal dress, gold bow; hooked staff with glowing lantern. / Illus: orange bob, teal haori, beret with star, lantern staff, fireflies. [bob/side, ribbon, dress, lantern]
15. **Sango** (Coral Corsair) — coral hair, navy beret with shell badge, ivory blouse with navy collar, orange bow, navy skirt; navy hand-cannon with coral box + gold star. / Illus: coral hair, navy beret, white-pink sailor coat, brass telescope-cannon. [short, beret, sailor, cannon]
16. **Umeko** (Pearl Warden) — white hair with seafoam tips, gold shell hairpin, ivory/teal dress, mint bow; shell-fan staff with 7 seafoam spikes + pearl. / Illus: long white→green hair, sea-shrine robe, shell staff. [long, hime, flower(shell), dress, staff]

**Expansion (14)**
17. **Kaede** (Crimson Fencer) — red-orange hair with side ponytail + white feather, ivory/red dress, orange bow, red boots; rapier with gold ring guard + tassel. / Illus: long red hair, crimson coat, maple leaves.
18. **Suzu** (Bell Trapper) — golden-blonde hair with a big looped side curl, teal ribbons, gold bead clip, ivory blouse, teal skirt with gold bells on the belt; bell-rack staff. / Illus: blonde, teal-white kimono, bells.
19. **Chika** (Clockwork Mechanic) — orange short hair, teal goggles, mustard shirt, navy overalls, brown satchel, yellow boots; big wrench + gear. / Illus: orange bob, goggles, navy mechanic outfit, giant wrench.
20. **Ruri** (Familiar Keeper) — blue hair with a side braid + star clip, ivory/blue dress; open grimoire with a tiny white-lavender fox, second book at the hip. / Illus: navy hair, white fox familiar, white-blue robe.
21. **Fuu** (Wind Dancer) — mint twin-tails with leaf/star pins, mint/ivory dress; folding fan. / Illus: green twin-tails, green-white hanfu, fan.
22. **Hana** (Falcon Ranger) — auburn hair with leaf ahoge + side ponytail and feather, olive tunic, dark-green quiver on the back, small white falcon on the shoulder; bow + arrow. / Illus: brown braid, hawk on shoulder, ranger cloak.
23. **Kohaku** (Prism Scholar) — lavender hair, gold/purple crystal tiara, monocle, ivory/purple dress; jewel staff with rings. / Illus: lavender long hair, purple robe, crystal staff.
24. **Tsubaki** (Star Mortar) — navy hair, navy officer cap with gold star, navy military coat with gold buttons, long mortar tube + star backpack; brass rangefinder binoculars. / Illus: navy hair, navy-gold coat, telescope-mortar.
25. **Noa** (Sanctuary Keeper) — silver-white hair with small buns, ivory/pink dress; pink-gold ward shield. / Illus: white hair, pink-white habit, sakura shield.
26. **Iroha** (Mirror Artisan) — dark plum hair in buns with a round ornament, plum dress; hand mirror. / Illus: black hair, purple kimono, ornate mirror.
27. **Ena** (Curse Weaver) — rose-pink hair with a braid and black diamond ornament, dark plum/crimson dress; curse cards. / Illus: red-pink hair, black-red kimono, fan and red threads.
28. **Kanna** (hero, Oni Festival Champion) — coral-red hair with buns + gold rings, gold oni horns, red/black festival outfit, taiko drum at the hip; mallet. / Illus: red twin-tails, oni horns, festival drum.
29. **Yoriko** (hero, Dream Puppeteer) — lavender long ponytail, cat-ear headpiece, lilac/navy dress, small plush; puppet control bar + marionette. / Illus: lavender hair, full moon, puppet.
30. **Seiran** (hero, Storm Rider) — light-blue hair, gold dragon horns, ivory/teal dress with gold shoulder plates; long spear. / Illus: blue hair, dragon behind, spear.

**Summer (2) + beach skins (3) — document only**
31. **Marina** (Seaglass Lifeguard, SR) — peach short hair; teal swim top + skirt, bare legs, sandals; rescue buoy. Older simpler template (20k verts, 7 mats, no boots/bow). **Not shippable as is.**
32. **Amane** (Summer Sea Captain, SSR hero) — lavender bob; pink swim top + skirt, sandals; trident. **Not shippable as is.**
33-35. **marina-beach / amane-beach / nami-beach** — coral / navy / aqua swimsuits + gold circlet with flower. **Never ship.**

Non-swimwear replacements to plan: Marina → lifeguard hoodie/rash-guard jacket over a sailor-style
skirt + leggings + sneakers, whistle, buoy; Amane → pastel captain coat (Nami's cut, lavender/pink) or a
festival yukata; the "beach skins" → summer-festival yukata or sailor-summer uniforms.

---

## 5. Porting spec: a "codex" chibi source inside the new runtime

### 5.1 What the new runtime expects from a chibi (`src/models/index.js`, CONTRACTS.md §7, consumers)

| Contract item | Where used | Codex implementation |
|---|---|---|
| `preloadModels(ids=null, {detail})` → `Promise<boolean>`; safe to call repeatedly | `src/main.js` L62-70, `ui/battle/controller.js` L107-109, `ui/screens/student.js` L232, `ui/lobby/secretary.js` L323 | Load `public/models/codex/<id>.glb` with GLTFLoader + DRACOLoader, prepare template per detail (§5.4). Resolve `false` in Node (`canLoadCharacters()`). |
| `buildChibi(unitDef, {quality, pose, detail})` **synchronous** → `THREE.Group` | `render/actors.js` L262, `render/overlays.js` L226 (ghost), lobby, student, tests | If template ready → instantiate; else return the procedural placeholder and upgrade in place (reuse `upgradeInPlace` from `src/models/index.js` L88-101). |
| Feet at y=0, faces **+z**, `userData.height` ≈ 0.9 (heroes 0.98 in V2) | actors scale ×1.22 tower / ×1.36 hero (`actors.js` L12-13); secretary framing L148 | Old models already face +z with feet at 0. Use one constant scale for all girls: `k = 0.9 / (3.72·0.84)` on an outer group (prototype), heroes ×1.07 if you keep the V2 convention. Set `userData.height = 0.9` (or measured ×k). |
| `userData.animate(time, dt, state)`; states `idle, attack, cheer, victory, disabled, hurt, walk, pickup` | actors L296 (`idle/victory/disabled`), student viewer, lobby (`cheer/pickup/victory`) | `animateChibi(root, {time, dt, pose, attackAge})` with map `idle→idle, cheer→cheer, victory→cheer (+ happy), walk→walk, pickup→held, disabled/hurt→ new 'hurt' pose (or shy) + blink/dizzy face, attack→idle + repeating attackAge`. |
| `userData.playAttack()` | actors L393 (on sim `attack` events), lobby, student | store `attackAt = lastTime`; pass `attackAge = time - attackAt` (window 0.48 s). |
| `userData.setExpression(name|null)` with `FACE_CELLS = idle, blink, attack, happy, hurt, dizzy, wink, shy, surprised` | lobby L204/L404 (`attack, happy, surprised, wink, shy`) | Short term map onto 4 cells: idle→0, blink→1, attack→2, happy→3, wink→3 (or 1), shy→3, surprised→0, hurt→2, dizzy→1. Proper fix: paint a 3×3 atlas in the same style with all 9 cells (keep teal iris so the tint shader still works) and set `repeat=1/3`. |
| `userData.setHighlight(bool)` | actors L397 | swap body material to a cached highlighted toon (emissive #4d6dff 0.35) like `glbChibi.js` L245-255. |
| `userData.dispose()` + `disposeObject` honouring `geometry.userData.shared`, `material.userData.shared`, `texture.userData.shared` | actors L170, util.js | Flag template geometry/materials/atlas `userData.shared = true` (old code uses `sharedChibi`/`chibiShared`); dispose only the per-instance face material + cloned texture. |
| Outline meshes flagged `userData.isOutline` | actors L263 (shadows), overlays ghost, `makeSilhouette` | Body hull and weapon ink meshes get `userData.isOutline = true`. |
| Face mesh named `'face'` | `makeSilhouette` hides `o.name === 'face'` (util.js) | rename the FacePaint mesh to `face`. |
| Head bone named `head` | secretary `findHeadBone(/^head$/i)` | old bone is already `head`. |
| Materials cloneable with `onBeforeCompile` | overlays ghost clones materials and copies `onBeforeCompile`/`customProgramCacheKey` (L226-240) | iris shader and outline shader both use `onBeforeCompile` + cache keys → compatible. |
| `detailFor(quality)`, `characterUrl`, `FACE_CELLS`, `CHIBI_HEIGHT` exports | `tests/models/api.test.js` L35-38 | keep exports; add `codexUrl(id)`. |
| Node fallback | `tests/models/api.test.js` (buildChibi sync for every unit) | procedural V1 builder needs `palette` + `look` for every new unit (13 old-only ids need them). |

### 5.2 Proposed module layout (new repo, owner: models)

```
public/models/codex/<id>.glb          32 old GLBs as-is (Draco), manifest.json {id: {file, size, kind, eye}}
public/models/codex/face-atlas.png    (later: 3×3 atlas)
public/draco/draco_decoder.wasm, draco_wasm_wrapper.js   copied from node_modules/three/examples/jsm/libs/draco/ (0.186)
src/models/codex/roster.js    CODEX = { hikari: { glb:'hikari', kind:'hero', eye:'#43b8c2', color:'#ffd276', hero:true }, … }  (old kind/eye/color per id; never read sim data)
src/models/codex/assets.js    loader (GLTFLoader + DRACOLoader(`${BASE_URL}draco/`)), template cache keyed `${id}|${detail}`, prepare() (§5.4)
src/models/codex/acting.js    port of chibi-acting.js (import * as THREE from 'three'; add 'hurt' pose + optional battle look-up)
src/models/codex/weapons.js, expansionWeapons.js   ports of chibi-weapons.js / expansion-weapons.js (+ mergeWeapon)
src/models/codex/face.js      paintFace (iris shader) + expression → cell
src/models/codex/index.js     preloadCodex(ids, detail), buildCodexChibi(unitDef, opts) → group with the §5.1 userData API
src/models/index.js           dispatch: skin source 'codex' (default) | 'academy' (current V2 Blender GLB via glbChibi.js) | procedural fallback
```

Skin dispatch: `buildChibi(unitDef, { skin })` where the skin comes from the profile (`profile.units[id].skin`,
UI-owned) or `unitDef.defaultSkin`; each UnitDef gets `skins: [{ id:'codex', source:'codex' }, { id:'academy',
source:'academy', name:'Academy V2' }]` for the 19 shared ids (minus the 4 that become separate future units, §6.3).

Imports to change when porting: old modules import `./vendor/three.module.min.js` → `'three'`; drop `PostFX`
(`chibi.js` L1) and the pedestal (new renderer has footprint discs); `chibi-weapons.js` imports
`./expansion-weapons.js` (keep relative).

### 5.3 Draco decoder hosting

- Use the decoder that ships with three 0.186 (`node_modules/three/examples/jsm/libs/draco/draco_decoder.wasm`
  192 KB + `draco_wasm_wrapper.js` 58 KB) copied to `public/draco/` so Vite serves them under `BASE_URL`
  (`base: './'` in vite.config.js; build with `${import.meta.env.BASE_URL}draco/`).
- `new DRACOLoader().setDecoderPath(base + 'draco/')` — **do not call `setDecoderConfig({type:'wasm'})`** (r186
  warns "deprecated, removed in r194"; wasm is the default). Keep one DRACOLoader alive for the session (old
  code disposed it after the bulk load; lazy per-battle loading needs it again). `setWorkerLimit(2)`.
- Hosts that refuse `.glb`/`.wasm`: reuse the `__SAKURA_ASSET_EXT` hook (`glbChibi.js` L46-52) for GLBs;
  `.wasm` is generally served.
- Alternative (no decoder at runtime): pre-decode offline into meshopt/quantized GLBs (§5.6).

### 5.4 Template preparation (proven in `$M/proto/merge-port.html` `prepare()`)

1. `gltf.scene.updateMatrixWorld(true)`; split SkinnedMeshes into body primitives and the `FacePaint` mesh.
2. For each body primitive: clone geometry, keep `position, normal, skinIndex, skinWeight`, add a `color`
   attribute = the material's colour (THREE.Color is linear), record `{slot name, vertex start, count}` in
   `geometry.userData.slots` (→ runtime palette swaps: rewrite colour ranges by slot name).
3. `mergeGeometries` → one geometry; one `SkinnedMesh(merged, toon(vertexColors))` bound with
   `first.skeleton, first.bindMatrix`; remove the originals. Metallic trim loses PBR sheen (acceptable; could
   lighten trim colour slightly).
4. LOD via `three/addons/libs/meshopt_simplifier.module.js` (`MeshoptSimplifier.ready`,
   `simplify(indexU32, positionsF32, 3, targetIndexCount, 0.02, ['LockBorder'])`) — only the index buffer
   changes, so skin attributes stay valid. Measured: ratio 0.3 → 16.8–17.4k tris; 0.15 → 9.3–9.6k tris; at
   0.15 skirt/boot edges start to chip in close-ups (`old-lod-test-hikari.png`) but are invisible at battle
   size (`port-proto-battle-844.png`). Recommended: `full` = original (viewer, student screen, gacha),
   `lod` = 0.3 (battle on high), 0.15 (battle medium/low). Prep time ~60–125 ms per character in the browser
   (5 chars 619 ms, 10 chars 613–796 ms, incl. Draco decode).
5. Face: rename to `face`, keep its own geometry, per-instance `paintFace(unit.eye)`, `renderOrder 2`,
   no shadows.
6. Mark shared: `geometry.userData.shared = material.userData.shared = true`.

### 5.5 Looking as cute as (or cuter than) the old game

- **Ramp:** use the new `toon.js` 3-step ramp `[168, 222, 255]` (prototype) instead of the old 8-texel ramp with
  four zero texels — this removes the dirty lower-face band. Optional: separate skin primitive with
  `gradientMap('soft')` ([214,255], what V2 uses on faces).
- **Outlines:** inverted hull on the merged body (prototype width 0.016 raw units ≈ 0.43 % of height,
  `#3a2e44` × vertex colour, same shader as `toon.js` `outlineMaterial`). Hair tips show small jaggies because
  hair normals are split → compute an averaged "outline normal" attribute (merge by position) for the hull.
  For low quality skip outlines or give the hull a coarser index buffer (LOD 0.08) on the same vertices.
- **Weapons:** convert to toon + vertex colours and merge per weapon into 1 fill + 1 ink mesh (prototype
  `mergeWeapon`); keep emissive parts (Luna's orb, Hotaru's lantern) as separate glow meshes.
- **Lights:** prototype used the V2 preview rig (Hemisphere #fff/#c8d4ea 1.15, key #fff6ea 1.7 at (2.5,5,4),
  rim #bfe0ff 0.8, NoToneMapping) and looked right; no ACES needed.
- **Battle readability:** at the new 48° ortho pitch the big heads hide faces (`port-proto-battle-zoom.png`);
  add a small battle-only head look-up (e.g. head pitch −0.10 rad in `animate`) or tilt the avatar 6–8° toward
  the camera.
- **Fixes to schedule:** calf poke-through (back view) — push socks out or delete hidden skin faces;
  optional BA halo from `src/models/halo.js` `buildHalo(ctx)` attached to the `head` bone (old designs have none).

### 5.6 Offline alternative (precomputed files)

The prototype simplifies at load time. To ship precomputed `<id>.lod.glb`: decode in a browser page with three
0.186 (DRACOLoader works there), run the same merge/simplify, export with `GLTFExporter` (works on r186; on the
old r180 it fails for missing `TextureSource`), then optionally quantize. Blender bpy here cannot read Draco.

### 5.7 three r180 (old vendor, `vendor/three.core.min.js` REVISION "180") vs 0.186 — what matters

Verified by running the old modules on r186 (prototype):
- Works unchanged: GLTFLoader + DRACOLoader, `SkeletonUtils.clone`, `MeshToonMaterial.gradientMap`
  (DataTexture), `onBeforeCompile` + `customProgramCacheKey` on skinned materials, `Object3D.attach`,
  quaternion maths in acting, `Texture.clone` sharing `Source`.
- `DRACOLoader.setDecoderConfig` deprecated (removal in r194) → remove the call.
- `PCFSoftShadowMap` removed in 0.186 (falls back to PCFShadowMap with a console warning; already seen in the
  new previews) — the old ChibiViewer requested it.
- `TextureSource` is exported in r186 (not in r180) — only relevant for GLTFExporter.
- Decoder files must come from the same three version folder (use 0.186's `libs/draco`).

### 5.8 Performance and budgets (measured)

| | Old as-is (r180 viewer) | Prototype on r186 | V2 Blender chibi |
|---|---|---|---|
| tris / girl | 49.9–53.6k | 16.8–17.4k (LOD 0.3), 9.3–9.6k (0.15); ×2 with outline hull | 17.8k full, 5.6k LOD |
| draw calls / girl | ~18 base, ~40 expansion (293 meshes for 16, 553 for 14) | ~5 (body, hull, face, weapon fill, weapon ink, + glow parts) | 6 (3 prims + 3 outlines) |
| 30 girls in battle | — | 151 draw calls, 538k tris (LOD 0.15 + outlines), acting 1.44 ms/frame | — |
| download | 264 KB avg Draco, 8.44 MB for 32 + atlas 354 KB + decoder 250 KB | same | 380–460 KB full / 190–220 KB LOD, 19 girls ≈ 12 MB |

Load lazily per battle formation (like V2 `preloadModels(ids)`) — never all 32 at boot (the old game loaded all
35 up front; Codex itself flagged that as the main mobile cost).

### 5.9 Tests to add / change (new repo)

- `tests/models/glb.test.js` iterates **all** `UNITS` and requires the V2 format (3 primitives, 22-bone
  names like `upper_arm_L`, baked clips, `unitScale 2`, height 0.9/0.98, ≤480 KB) → restrict it to ids that
  have an `academy` skin in `public/models/characters/manifest.json`.
- New `tests/models/codex.test.js` (header-only, like `glbHeader.js`): manifest lists every codex unit; each GLB
  has `KHR_draco_mesh_compression`, 1 skin with the 27 joints (incl. `head`, `hand.R`, `hair`, `tail`), a
  `FacePaint` material, the 8 slot names, ≤ 300 KB.
- `tests/models/api.test.js` stays valid if every new UnitDef has `palette` + `look` for the procedural fallback.

---

## 6. Roster

### 6.1 Old roster — all 32 (data from `data.js`, `expansion-roster.js`, `summer-content.js`, `growth.js`)

`rate` = seconds between attacks (old convention; new uses attacks/s). Range in old world units (map 28×16;
≈ ×0.72 for the new 20×12 tiles). Flags: W water+land, D detect (veil sight), R reveal aura, G ground-only.
Base towers upgrade with 3 named tiers *and* the BTD branches (3 branches × 3 tiers, max two branches,
secondary ≤ tier 1 once primary ≥ 2; cost = `cost × (0.75 + tier × 0.6)`; per level ×1.55 damage, ×0.92
rate, +0.4 range; `engine.js` L122-148, L203-218). Heroes: level = min(9, kills/40), ×1.1 dmg, ×0.97 rate,
+0.1 range per level, one ult. Elements: physical, fire, frost, lightning, poison, holy, arcane
(`KIND_DAMAGE`), vs old enemy traits wild/ooze/armored/spectral/hexed/brute.

| # | id | Title | Role / subclass | kind → element | Rar | Cost | Dmg | Rate s | Range | Flags | Kit (combat-expansion / engine) | Upgrades + branches (effect) | Palette hair / outfit / eye / color | Portrait | Obtained (old) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | hikari | Dawnblade | Hero · Vanguard / cleave | hero → holy | SSR | 0 | 18 | 1.0 | 3.6 | D | splash r1.35 around target; ult **Celestial Bloom** cd58: 100+18/lvl holy to all, ignores armor, slow 50 % 2 s | — | #f3a0bd #f8eee0 #43b8c2 #ffd276 | `hikari.webp` 820×1230 RGBA | starter |
| 2 | aoi | Wind Ranger | Marksman / sustained DPS | arrow → physical | R | 180 | 9 | 0.6 | 4.3 | | single target | Feather Arrows, Windrunner, Emerald Tempest · Gale arrows (rapid), Focused volley (focus), Watchtower (sight) | #529d67 #568c55 #88df94 #93db75 | roster.webp cell 0 | starter |
| 3 | rei | Sakura Samurai | Melee · Cleaver / close defense | slash → physical | R | 240 | 22 | 0.9 | 2.65 | G | hits up to 4 (+2/cleave) in reach | Honed Edge, Petal Dance, Thousand Cuts · Petal cleave (cleave), Duelist stance (duelist), Counter-slash (interrupt) | #303851 #4c568a #b39eff #abc1ff | roster cell 1 | chapter `garden` / lesson `glade` |
| 4 | yuki | Frost Mage | Control / frost | ice → frost | R | 280 | 7 | 1.2 | 4.2 | | slow 50 % 2 s (stronger per level) | Deep Chill, Winter Veil, Absolute Zero · Deep winter (freeze), Brittle frost (vulnerability), Snowfield (zone) | #e4eff8 #659eca #77d9ef #a3eaff | roster cell 2 | tutorial reward |
| 5 | akane | Flame Witch | Splash · Artillery / burn | fire → fire | SR | 380 | 23 | 1.4 | 4.5 | | splash r1.5+0.15/lvl, burn 2 s (6×1.5^lvl dps) | Cinder Spark, Wildfire, Phoenix Heart · Phoenix embers (burn), Sunburst (splash), Molten heart (shred) | #dc634b #a54c56 #ffbb60 #ffb28e | roster cell 3 | chapter `shrine` / lesson `frost` |
| 6 | shiro | Moon Sniper | Precision · Marksman / armor breaker | sniper → physical | SSR | 450 | 58 | 1.9 | 8 | D | ignores armor, default target "priority" | Silver Bullet, Eagle Eye, Lunar Eclipse · Executioner (execute), Moon mark (mark), Silver cadence (rapid) | #d2d6de #414f68 #84bdf8 #d5d8ee | roster cell 4 | lesson `dunes` |
| 7 | kage | Shadow Ninja | Rapid · Skirmisher / multi-target | ninja → physical | SR | 300 | 8 | 0.55 | 3.9 | D | 3 targets (+multishot) | Twin Shadows, Night Blossom, Shadowstorm · Shadow flurry (multishot), Silent sabotage (interrupt), Night needles (pierce) | #70568a #574670 #d89fe8 #c1a2f8 | roster cell 5 | lesson `shrine` |
| 8 | raika | Storm Caller | Chain · Arcanist / chain DPS | lightning → lightning | SSR | 420 | 19 | 1.2 | 4.7 | | chain 3+level jumps within 3 u | Static Charge, Thunder Chorus, Divine Storm · Storm web (chain), Overcharge (breaker), Thunderclap (interrupt) | #e8c356 #6671a1 #e4b9ff #ffe58a | roster cell 6 | chapter `frost` |
| 9 | miko | Shrine Keeper | Support · Enchanter / aura | support → – | SR | 300 | 0 | – | 4.2 | | aura +25 % dmg (+12 %/lvl) & faster attacks; no stacking | Sacred Bell, Spirit Blessing, Celestial Shrine · Sacred chorus (aura), Swift prayer (tempo), Sanctuary (sanctuary) | #373448 #c65367 #bc80a3 #ffb8c4 | roster cell 7 | chapter `teacup` |
| 10 | midori | Potion Alchemist | DoT · Alchemist | poison → poison | SR | 340 | 11 | 1.15 | 4.2 | | splash poison 4 s (9×1.6^lvl dps), ignores armor | Potent Brew, Emerald Elixir, Forbidden Formula · Grand elixir (venom), Caustic brew (shred), Plague garden (splash) | #72c7ac #5d8975 #c3f290 #aeedb4 | roster cell 8 | lesson `marsh` |
| 11 | momo | Starlight Idol | Economy · Performer | income → – | R | 360 | 0 | – | 3.5 | | +65 +45/lvl coins per wave | Opening Act, Encore, Superstar · World tour (income), Opening act (bounty), Rousing encore (tempo) | #e985ba #a55b99 #9663ca #ffc0e5 | roster cell 9 | chapter `ribbon_orchard` |
| 12 | luna | Moonfox Oracle | Hero · Mystic / piercer | moonhero → arcane | SSR | 0 | 12 | 1.15 | 4.0 | D | 3 targets, armor-piercing, slow 30 % 0.9 s; ult **Ninefold Moonfall** cd64: 85+20/lvl arcane to all, slow 80 % 2 s, squad +15 % dmg 4 s | — | #c3b4e9 #343c72 #a69aff #a8dfff | `luna.webp` 810×1080 | chapter `rift` (limited) |
| 13 | hotaru | Lantern Keeper | Area control · Exorcist / reveal | lantern → holy | SSR | 440 | 14 | 1.6 | 3.8 | R | holy pulse on all in range, slow 20 % 1 s; holy seals phasing & suppresses fields | Firefly Song, Guiding Light, Thousand Lanterns · Exorcism (exorcism), Guiding light (sight), Spirit seals (freeze) | #eab184 #438f97 #e8ab4d #ffcf73 | `hotaru.webp` 810×1080 | lesson `grave` (limited) |
| 14 | nami | Tide Admiral | Hero · Tideguard / control | tidehero → frost | SR | 0 | 14 | 1.2 | 4.1 | W D | 2 targets, slow 35 % 1.4 s; ult **Ocean's Overture** cd62: 90+16/lvl frost to detected, slow 60 % 3 s (bosses half) | — | #3d9fb0 #eaf7f5 #53d8db #79dfed | `nami.webp` 768×1024 | lesson `coast` |
| 15 | sango | Coral Corsair | Artillery / fragmentation | cannon → physical | SR | 390 | 29 | 1.65 | 4.6 | W | splash, shreds 2 armor, +30 % vs barriers | Reef Powder, Coral Broadside, Pearlstorm Barrage · Reef breaker (shred), Fragmentation (splash), Siege shells (siege) | #e98288 #eff7ff #67caca #ffb3a3 | `sango.webp` 768×1024 | lesson `coast` (+adventure stage) |
| 16 | umeko | Pearl Warden | Support · Enchanter / detection | support → – | SR | 340 | 0 | – | 4.5 | W R | aura dmg buff + reveal aura | Pearl Lantern, Tidal Sanctuary, Ocean's Blessing · Ocean blessing (aura), Pearl beacon (beacon), Tidal sanctuary (sanctuary) | #e2f4ee #6ebcb4 #72bdaf #abe5de | `umeko.webp` 768×1024 | lesson `harbor` |
| 17 | kaede | Crimson Fencer | Duelist | duelist → physical | R | 310 | 17 | 0.7 | 2.7 | G | focus: +7.5 %/stack on same target, 8 stacks (+60 %); resets on switch | Field training, Specialist, Masterwork · Crimson focus (focus), Needle point (pierce), Riposte (interrupt) | #ad5148 #a6314a #edbf76 | pair `kaede-suzu` L | grant `dunes` |
| 18 | suzu | Bell Trapper | Trapper | trapper → holy | R | 290 | 22 | 2.4 | 4.2 | G | stockpiles ≤5 bell traps at aim point / nearest lane; holy burst r1.1 | … · Firework bells (splash), Binding bells (freeze: grounds), Spirit seals (sight) | #d6a65b #428d8b #f2cd7a | pair `kaede-suzu` R | grant `glade` |
| 19 | chika | Clockwork Mechanic | Engineer | engineer → physical | SR | 430 | 10 | 0.8 | 4.4 | | 2 sentries at ±0.85, 64 % dmg each, independent | … · Twin workshops (rapid), Heavy machinery (shred), Survey drones (sight) | #bd7647 #38475f #eaba57 | pair `chika-ruri` L | grant `forge` |
| 20 | ruri | Familiar Keeper | Summoner | summoner → arcane | SR | 400 | 22 | 1.1 | 4.8 | | fox familiar at the midpoint tower↔lane, range 3.3; hound (+targets) / falcon (air) / otter (+water reach) | … · Moonhound (hound), Star falcon (falcon), Tide otter (otter) | #577cce #e7eef6 #89c5fc | pair `chika-ruri` R | grant `marsh` |
| 21 | fuu | Wind Dancer | Displacement | wind → arcane | R | 340 | 8 | 1.45 | 4.2 | | pushes 3 targets back 0.65 path u (boss 0.12), per-enemy lock 1.5 s (boss 3 s) | … · Returning gale (push), Gathering dance (gather), Grounding breeze (ground) | #79c9b2 #eef6e8 #6ecebc | pair `fuu-hana` L | grant `sky` |
| 22 | hana | Falcon Ranger | Aerial hunter | falcon → physical | R | 300 | 14 | 0.8 | 5.3 | | air priority, ×2 vs air (+0.25/tier), grounds 2.2 s | … · Sky hunter (air), Falcon mark (mark), Rapid feathers (rapid) | #865844 #798d5b #dbc17c | pair `fuu-hana` R | grant `sky` |
| 23 | kohaku | Prism Scholar | Beam caster | beam → arcane | SSR | 480 | 25 | 1.25 | 5.3 | | line beam, width 0.35, pierces 4 (+2/tier) | … · Prism corridor (beam), Crystal fracture (shred), Resonant light (focus) | #b4a2d6 #eee7fa #b6b4ff | pair `kohaku-tsubaki` L | grant `crystal` |
| 24 | tsubaki | Star Mortar | Bombardment | mortar → physical | SR | 520 | 52 | 2.6 | 30 (map) | G | shell at aim point after 1 s warning, r1.6 | … · Siege star (siege), Meteor shower (splash), Signal shell (sight) | #313e6b #354566 #e9c97a | pair `kohaku-tsubaki` R | grant `festival` |
| 25 | noa | Sanctuary Keeper | Purifier | cleanse → holy | SR | 300 | 0 | – | 4.6 | | every 3 s: clears stuns, 2 s ward; +8 % dmg blessing | … · Pure sanctuary (sanctuary), Bright blessing (aura), Protective hymn (mend: lives on nearby kills) | #e1ddeb #f4e7e3 #e8adc4 | pair `noa-iroha` L | grant `harbor` |
| 26 | iroha | Mirror Artisan | Mirror caster | mirror → arcane | SSR | 460 | 20 | 1.1 | 5.2 | | places a mirror (aim point in range); bolts fire from the mirror, range 3.2 | … · Mirror hall (multishot), Silver reflection (reach), Shattered prism (splash) | #40304e #745580 #c8bfe1 | pair `noa-iroha` R | grant `bamboo` |
| 27 | ena | Curse Weaver | Hex caster | curse → arcane | SSR | 390 | 15 | 1.15 | 4.5 | | curse on hit (80 % dmg); on death bursts r1.5 and passes a 60 % curse, max 2 generations | … · Cursed bloom (splash), Withering script (antiheal), Shared fate (vulnerability) | #c27594 #64324e #e2a4cf | pair `ena-kanna` L | grant `grave` |
| 28 | kanna | Oni Festival Champion | Hero | onihero → physical | SSR | 0 | 20 | 1.15 | 3.1 | D G | focus ramp, shreds 4 armor, interrupts; ult **Festival Drumfall** cd65: strongest detected enemy 230+24/lvl ignores armor, shred 8 for 8 s, 30 % splash r2, stagger | — | #df6b82 #942e42 #efc562 | pair `ena-kanna` R | grant `festival` |
| 29 | yoriko | Dream Puppeteer | Hero | puppethero → arcane | SSR | 0 | 11 | 1.25 | 4.1 | D | 2 targets, slow 30 % 0.9 s; ult **Dream Detour** cd72: ordinary enemies back 5 path u (bosses 0.5), 65+12/lvl arcane, slow 50 % 3 s | — | #ad94cb #47416e #c6b8f1 | pair `yoriko-seiran` L | grant `rift` |
| 30 | seiran | Storm Rider | Hero | stormhero → lightning | SSR | 0 | 12 | 1.2 | 5.1 | W D | chain 3, air priority; ult **Dragonflight** cd66: r4 around aim point 125+18/lvl lightning, grounds 5 s, mark +18 % 5 s | — | #80b9e4 #3e8c9e #c0e9f2 | pair `yoriko-seiran` R | grant `rift` |
| 31 | marina | Seaglass Lifeguard (event, "age 23") | Area control · Tidekeeper / reveal | lantern → holy | SR | 370 | 11 | 1.65 | 4.4 | W R | Hotaru-like holy pulses + reveal | Rescue Signal, Seaglass Watch, Safe Harbour · Rescue beacon (exorcism), Coast watch (sight), Safe harbour (freeze) | #ed9b72 #5ec7cf #3eafa8 #ffb6a2 | `summer/marina.webp` (swimwear render) | free from beach story |
| 32 | amane | Summer Sea Captain (event hero, "age 26") | Hero · Tideguard | tidehero → frost | SSR | 0 | 15 | 1.25 | 4.2 | W D | Nami clone; ult **Seaglass Finale** cd70: 70+14/lvl frost, slow 3 s, squad +15 % 6 s | — | #b8a4e0 #f3b3ba #7771bc #ffe6a3 | `summer/amane.webp` (swimwear render) | Leviathan boss reward |

Expansion units all have generic upgrade tier names `Field training, Specialist, Masterwork`, `limited: true`,
`materialFamily` martial/spirit/wild/arcane (old families), and in-text `trait = desc`. Old rarity distribution:
SSR 12, SR 12, R 8.

### 6.2 The 19 shared ids — old vs new side by side

New stats from `src/data/units.js` (rate = attacks/s, range in tiles). New behaviours: `projectile, pulse, duel,
beam, chain, trap, turret`. "Disposition" follows the owner's latest direction
(`/home/user/sakura-game/docs/OWNER_REQUESTS.md` L278-283): old design becomes the main character; current V2
**Rei, Nami, Luna, Kaede** become separate future-release units (new names needed — the ids clash); the other
15 V2 designs become special skins on the matching old girl.

| id | OLD kit (title · rarity · cost · dmg/rate s/range) | NEW kit (title · rarity · role · type/elem · place · cost · behaviour dmg × /s · range · specials) | Design difference (old 3D vs new V2) | Disposition of the V2 design |
|---|---|---|---|---|
| hikari | Dawnblade · SSR · 0 · 18/1.0/3.6 · holy splash, D; ult Celestial Bloom | Dawnblade Captain · SSR · vanguard · holy · land · 520 · pulse 6×1/s · 2.1 · detection; ult Celestial Bloom nova 160 r4.5 stun 1.2 reveal 8 cd70 | old **pink** long hair, sailor dress, short sword / new **blonde** long hair, crown, white armour top + yellow skirt, crown halo | skin ("Sunlit Captain") |
| luna | Moonfox Oracle · SSR · 3 arcane beams pierce armor, slow | Moonlit Archmage · SSR · mystic · land · 620 · beam 4×0.8/s ×3 pierce 3 · 3.6 · antiAir; ult Moonfall timeWarp slow 0.5 5 s, rate ×1.3 8 s | old fox ears + tail, navy dress, crescent-orb staff / new witch hat, hime hair, dark robe, tome | **future unit** (new name) |
| nami | Tide Admiral · SR hero · W+land · 2 frost targets, D | Tideguard Commodore · SR hero · mystic/frost · **water only** · 460 · projectile 5×1/s · 3.2 · slow 20 %, splash 0.5; ult Tidal Wave tide 70 push 5 | old captain's cap, sailor dress, gold trident / new teal wavy hair, navy coat, flower, trident | **future unit** (new name) |
| aoi | Wind Ranger · R · 180 · 9/0.6/4.3 | Sky Archer · R · marksman · pierce · land · 200 · projectile 4×1.4/s · 3.2 | old green short hair + side tail, green tunic / new light-blue ponytail, white sailor + pink skirt | skin |
| rei | Sakura Samurai · R · 240 · 22/0.9/2.65 · cleave 4, G | Crescent Cleaver · R · cleaver · slash · land · 240 · pulse 4×0.9/s · 1.8 · no air | old navy bob, indigo dress, katana with bow / new black short hair, red headband, navy blazer, katana | **future unit** (new name) |
| yuki | Frost Mage · R · 280 · 7/1.2/4.2 · slow 50 % 2 s | Snowdrift Mage · R · controller · mystic/frost · land · 220 · projectile 2×1/s · 3 · splash 0.6, slow 30 % 1.5 s | old silver hair, snowflake pin, white-blue dress / new pale-blue bob, hood, blue dress | skin |
| akane | Flame Witch · SR · 380 · 23/1.4/4.5 · splash + burn | Firework Demolitionist · SR · bombardment · blast/fire · land · 480 · projectile 6×0.7/s · 3.1 · splash 1, burn 2/s 2 s, no air | old witch hat + staff / new red twin-tails, horns, orange jumpsuit, fan | skin |
| shiro | Moon Sniper · SSR · 450 · 58/1.9/8 · ignores armor, D | Silent Overwatch · SR · sniper · pierce · land · 450 · projectile 18×0.4/s · 10 · armorPen 3, elite ×1.25 | close match (white hair, beret, navy uniform, rifle); new hair long | skin |
| kage | Shadow Ninja · SR · 300 · 8/0.55/3.9 · 3 targets, D | Shadow Courier · SR · skirmisher · pierce · land · 400 · projectile 3×2/s ×2 pierce 2 · 3 · detection | old purple bob + headband, dress / new cat ears, black hoodie | skin |
| raika | Storm Caller · SSR · 420 · 19/1.2/4.7 · chain 3+lvl | Thunderdrum Prodigy · SR · chain · mystic/lightning · land · 480 · chain 5×0.9/s, 3 jumps · 3.2 · shock 30 % | old blonde with curled horn tufts, periwinkle dress / new yellow buns, black hoodie | skin |
| miko | Shrine Keeper · SR · 300 · aura +25 % | Shrine Blessing Keeper · SR · enchanter · holy · land · 450 · projectile 2×0.8/s · 2.8 · aura ×1.1 dmg r2.5 | both shrine maidens (black hair, red/white, gohei) | skin |
| midori | Potion Alchemist · SR · 340 · poison splash | Verdant Apothecary · SR · alchemist · mystic/poison · land · 420 · projectile 2×0.8/s · 3 · splash 0.7, poison 3/s 4 s | old mint hair + goggles, green dress / new green braid, goggles, apron | skin |
| momo | Starlight Idol · R · 360 · +65 coins/wave | Peach Merchant · R · economy · pierce · land · 300 · projectile 2×0.8/s · 2.8 · income 30/wave | old pink twin-tail **idol** with mic / new peach buns, bunny ears, apron, coin purse (merchant concept) | skin (concept differs) |
| hotaru | Lantern Keeper · SSR · 440 · holy pulse, slow, R | Firefly Exorcist · SSR · exorcist · holy · land · 650 · pulse 6×0.8/s · 2.6 · detection, reveal 3, silence 1 | old honey-blonde, teal dress, lantern staff / new navy hair, hood, white robe, lantern | skin |
| sango | Coral Corsair · SR · 390 · 29/1.65/4.6 · splash + shred, W+land | Coral Battery · SR · artillery · blast/water · **water only** · 560 · projectile 14×0.45/s · 4.2 · splash 0.8, soak, barrier ×1.25 | old coral hair, navy beret, sailor, hand-cannon / new coral side hair, goggles, sailor, cannon | skin |
| umeko | Pearl Warden · SR · 340 · aura + reveal, W+land | Lantern-Float Lookout · SR · support · mystic/water · **water only** · 380 · pulse 1×0.6/s · 2.4 · aura detection r2.6, soak | old white→seafoam hair, shell staff / new **magenta** side hair, flower, white dress, parasol | skin (very different look) |
| kaede | Crimson Fencer · R · 310 · 17/0.7/2.7 · focus +60 %, G | Crimson Maple Duelist · SSR · duelist · slash · land · 600 · duel 10×1.1/s · 2 · ramp 0.1/hit max 0.8, elite ×1.1 | old red-orange side tail, ivory/red dress, rapier / new dark-red ponytail, black coat, rapier | **future unit** (new name) |
| suzu | Bell Trapper · R · 290 · ≤5 holy traps, G | Bell Seal Trapper · SR · trapper · blast · land · 380 · trap 12 dmg, max 4, rate 0.4/s · 2.6 | old blonde side curl, teal skirt, bell rack / new orange fox ears, white kimono, bell | skin |
| chika | Clockwork Mechanic · SR · 430 · 2 sentries | Gadget Prodigy · SSR · engineer · pierce/lightning · land · 650 · turret max 2, 3 dmg × 1.5/s r2.6, shock 15 % | old orange hair, goggles, mustard shirt + navy overalls, wrench / new brown bob, goggles, yellow jumpsuit, wrench | skin |

Main kit differences to reconcile: new data rebalanced everything to the new anchors (Aoi 4 dmg × 1.4/s ≈ 5.6
DPS vs old 15) — **keep the new numbers/paths for shared ids and only re-skin**; new water girls are
water-only while old ones are amphibious (`placement: 'amphibious'` already exists in the vocabulary and
`src/sim/placement.js` L11); new rarities differ (old Kaede/Suzu R vs new SSR/SR, old Raika/Shiro SSR vs new SR).

### 6.3 Old-only characters (13) — proposed mapping into the new schema

| id | Proposed role (new `ROLES`; ✱ = new role key needed in `types.js`) | attackType / element | placement | behaviour today | Needs new sim feature |
|---|---|---|---|---|---|
| ruri | summoner ✱ (or engineer-like) | mystic | land | `turret` max 1 (familiar), placed toward lane | familiar spawn toward lane, specialisation hound/falcon/otter |
| fuu | displacement ✱ / controller | mystic | land | projectile ×3 + `knockback` 0.65 (exists, bosses resist via `KNOCKBACK_RESIST`) | pull/gather, grounding branch |
| hana | aerial hunter ✱ / marksman | pierce | land | projectile + mark | air-priority target mode, ×2 vs air (`airMul`), grounding status |
| kohaku | beam caster ✱ / chain | mystic | land | `beam` pierce 4 | (line semantics check) |
| tsubaki | bombardment | blast | land | projectile splash (stand-in) | aim point + 1 s telegraphed shell, map-wide range |
| noa | purifier ✱ / support | holy | land | aura `cleanse` + `dmgMul` | ward window, life restore on nearby kills |
| iroha | mirror caster ✱ | mystic | land | projectile | second firing origin (relay) chosen by the player |
| ena | hex caster ✱ / alchemist | mystic | land | projectile + mark/vulnerable | on-death curse spread (generations) |
| kanna | hero (oni) | slash | land | `duel` + ramp + shred status | ult type "strike strongest" (+shred, stagger) |
| yoriko | hero (puppeteer) | mystic | land | projectile ×2 + slow | ult = existing `tide` (pushback 5) ✓ |
| seiran | hero (storm) | mystic/lightning | amphibious | `chain` | ult with aim point + ground + mark; air priority |
| marina | exorcist (event) | holy | amphibious | `pulse` + reveal (Hotaru-like) | – (needs non-swimwear model) |
| amane | hero (event) | mystic/frost | amphibious | Nami-like projectile ×2 + slow | – (needs non-swimwear model) |

New `UnitDef` fields required per added unit: `kind, rarity, adult, role, attackType, element, placement,
materialFamily` (feather|blade|ember|rime|charm|rune|cog), `capabilities, pathCapabilities, acquisition,
palette{hair,hairShade,eyes,skin,outfit,outfitShade,accent,halo,weapon}, look{…}, bio, personality, quote,
tips, base, paths[3]×tiers[5], awakenPassive, hero?` (CONTRACTS.md §3). The old data gives
hair/outfit/eye/color + desc + 3 branch concepts each; tiers 4-5, bios and quotes must be written.

### 6.4 Old mechanics the new sim (`src/sim`) lacks

| # | Mechanic | Old source | Used by | New sim status |
|---|---|---|---|---|
| 1 | Player aim point (`setAim`) for towers/ults | `engine.js` L341-361 | Tsubaki, Iroha, Suzu, Seiran ult | none (no API, no UI) |
| 2 | Delayed telegraphed shell (1 s warning, `mortar-warning` event) | `combat-expansion.js` L421-431, L604-616 | Tsubaki | none |
| 3 | Second firing origin (mirror relay) | L567-603 | Iroha | none |
| 4 | Familiar positioned between tower and lane, 3 specialisations | L531-566 | Ruri | partial (`turret` spawns near tower) |
| 5 | Grounding airborne enemies (`e.grounded`) | L41-46, L333-336, L488, L625-627, L721 | Hana, Fuu, Suzu (binding), Seiran ult | none (only `canHitAir` gate) |
| 6 | Air-priority targeting + ×2 vs air | L357, L384-385 | Hana, Seiran | none (target modes first/last/strong/close/elite) |
| 7 | Pull / gather toward lead enemy | L617-633 | Fuu | none (`knockback` push only) |
| 8 | On-death curse spread (2 generations, 60 % decay) | L248-263, L329-332 | Ena | none |
| 9 | Restore lives on nearby kills (`mend`) | L273-279 | Noa | none |
| 10 | Coins on nearby kills (`bounty`) | L264-270 | Momo branch | none (ModSet has `income` only) |
| 11 | Execute wounded normals / elite bonus | L358-361 | Shiro branch | none (crit only) |
| 12 | Lingering slow zones | L415-420, L676-683 | Yuki branch | none |
| 13 | Ult: strongest-target strike + shred + stagger; aimed area + ground + mark; squad damage buff | L686-729; `engine.js` L517-560, `moonBlessing` L134/L559 | Kanna, Seiran, Luna/Amane | nova / timeWarp (rate buff only) / tide |
| 14 | Ward window (temporary immunity to stun after cleanse) | L176-188 | Noa | partial (aura `cleanse` clears `disabled`) |

Already covered by the new sim: duel ramp (Kaede/Kanna), traps (Suzu), turrets (Chika), chain (Raika/Seiran),
beam pierce (Kohaku/Luna), pulse (Hotaru/Marina), auras + detection + cleanse (Miko/Umeko/Noa), income,
knockback (Yoriko ult = `tide`), shred/mark/vulnerable/soak/silence/reveal statuses, amphibious placement,
holy stops phasing.

---

## 7. Content flags (do not ship as-is)

- `assets/models/marina.glb`, `amane.glb` (base outfits) and `marina-beach.glb`, `amane-beach.glb`,
  `nami-beach.glb`: swimsuit tops + midriff + skirts/bare legs on child-proportioned chibi bodies
  (`$M/shots/old-lineup-summer.png`). Also `assets/summer/*.webp` (renders of them). The old event text gives
  them adult ages (23/26) but they are still chibi bodies → excluded by the content rule. Plan non-swimwear
  outfits (§4 end) and drop the affection "beach skin" rewards (or turn them into festival yukata/sailor-summer
  outfits). The original owner request asked for "sexy bikini" outfits (`$M/../owner_requests.md` Request 40);
  the newer rule (`docs/OWNER_REQUESTS.md` L253: "no sexualised swimsuits for the academy girls") wins.
- `assets/roster.webp` (5×2 chibi sprites for aoi…momo, `$M/shots/illus-roster-sprite.png`): cleavage
  (rei, yuki, akane, kage, raika, miko, midori), garter straps (akane, momo), fishnets + exposed thighs (kage),
  very short shorts (aoi, shiro) on **student** characters → do not use; use 3D renders or the new SVG card art
  until repainted.
- `assets/hikari.webp`: adult hero, but corset/bust-focused framing and garter/thigh-high details
  (`$M/tour/old-tut1.png`, `old-growth.png`) → crop to a non-bust composition or repaint (contract: heroes may be
  glamorous but "no body-focused framing").
- The 7 expansion pair portraits and luna/nami/hotaru/sango/umeko illustrations look acceptable (adult-looking
  proportions though for students — a style note for the art pass, not a block).
- 3D chibi base outfits of all 30 non-summer girls are modest (sailor dresses, uniforms) → fine.

---

## 8. Recommendations (ordered)

1. Ship the old 30 girls through a `codex` model source exactly as prototyped (merge + LOD + outline + new ramp),
   lazily loaded per formation; old designs become the default skin.
2. Keep the NEW numbers/paths for the 19 shared ids; only swap visuals. Add the 4 V2 designs the owner likes
   (Rei, Nami, Luna, Kaede) as separate future units with new ids/names; the other 15 V2 chibis become an
   "Academy V2" skin per girl (glbChibi path stays intact).
3. Add the 11 non-summer old-only girls in waves, starting with kits the sim already supports (Kohaku beam,
   Yoriko, Noa, Ruri-as-turret, Kanna with a new ult type), then implement aim points/telegraphed shells,
   grounding + air priority, mirror relay, curse spread.
4. Paint a 3×3 face atlas (9 FACE_CELLS) in the old atlas style; keep teal irises for the tint shader.
5. Fix model nits in an offline pass: calf poke-through, smoothed outline normals for hair, battle look-up.
6. Re-dress Marina/Amane before they appear anywhere; never ship the beach GLBs or `roster.webp`.

## 9. Scratch artefacts produced (all under `$M`)

- `characters.md` (this report); `old-analysis.json` (per-model slots/bones/UV/bounds); `old-roster.json` (old
  roster extracted with node); `new-units-dump.txt` (new roster dump); `fmt/*.js` (formatted old sources).
- `portraits/*.webp` — 7 expansion pair portraits downloaded from the live site.
- `tools/glbinfo.py` (GLB JSON-chunk inspector: `python3 -I tools/glbinfo.py brief|full|nodes <glb…>`),
  `tools/shot.mjs` (screenshot a page that sets `window.__done`), `tools/analyze.mjs`, `tools/tour2.mjs`,
  `tools/oldroster.mjs`, `tools/sheets.py`, `tools/bpy_lod.py` (shows bpy cannot read Draco).
- `proto/merge-viewer.html` (old-pipeline lineup; served from `oldserve/merge-viewer.html`, params `ids, cols,
  yaw, yaws, poses, exprs, pose, age, sp, rowh, zoom, fy, labels, ped`), `proto/merge-lod.html`,
  `proto/merge-analyze.html`, **`proto/merge-port.html`** (r186 port prototype; params `ids, lod, outline, mw,
  ramp, pose, yaw, cam=battle, oh, pitch, bench`). The r186 copies of three + loaders + ported old modules it
  uses are in `scratchpad/oldserve/merge-tools/p186/`.
